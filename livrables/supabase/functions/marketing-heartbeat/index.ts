import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CEO_EMAIL = 'pjoacenel@gmail.com';
const AGENT_SLUG = 'marketing';
const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Marketing Director IA <noreply@creatorflowmarket.com>';

// Seuils d'alerte (Constitution Section 5.1)
const ALERT_THRESHOLDS = {
  users_7d_drop_pct: 30,    // -30% nouveaux users vs semaine précédente
  conversion_rate_min: 20,  // < 20% brief → mission sur 30j
  articles_silence_hours: 96, // 0 article en 96h
  tickets_open_max: 10,     // > 10 tickets ouverts depuis > 48h
  mrr_drop_pct: 20,         // -20% MRR en 7j
};

// ---------------------------------------------------------------------------
// Lecture KPIs depuis Supabase
// ---------------------------------------------------------------------------
async function readKPIs(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const minus14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const minus96h = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString();
  const minus48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const [
    { count: users_total },
    { count: users_7d },
    { count: users_prev_7d },
    { count: missions_completed_7d },
    { count: briefs_open },
    { count: briefs_total_30d },
    { count: missions_started_30d },
    { data: last_article },
    { count: articles_7d },
    { count: tickets_open_48h },
    { count: pending_approvals },
    { data: payouts_7d },
    { data: payouts_prev_7d },
    { count: crm_contacts_total },
    { count: crm_7d },
    { count: handoffs_pending },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', minus7d),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', minus14d).lt('created_at', minus7d),
    supabase.from('agent_missions').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', minus7d),
    supabase.from('briefs').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('briefs').select('*', { count: 'exact', head: true }).gte('created_at', minus30d),
    supabase.from('agent_missions').select('*', { count: 'exact', head: true }).gte('started_at', minus30d),
    supabase.from('blog_articles').select('title, published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1),
    supabase.from('blog_articles').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', minus7d),
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open').lte('created_at', minus48h),
    supabase.from('pending_approvals').select('*', { count: 'exact', head: true }).eq('statut', 'pending'),
    supabase.from('expert_payouts').select('amount').gte('created_at', minus7d).eq('status', 'completed'),
    supabase.from('expert_payouts').select('amount').gte('created_at', minus14d).lt('created_at', minus7d).eq('status', 'completed'),
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }),
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).gte('created_at', minus7d),
    supabase.from('employee_handoffs').select('*', { count: 'exact', head: true }).eq('to_agent', AGENT_SLUG).eq('status', 'pending'),
  ]);

  const mrr_7d = (payouts_7d || []).reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
  const mrr_prev = (payouts_prev_7d || []).reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
  const last_article_date = last_article?.[0]?.published_at || null;
  const hours_since_last_article = last_article_date
    ? Math.round((now.getTime() - new Date(last_article_date).getTime()) / (1000 * 60 * 60))
    : 999;

  const conversion_30d = briefs_total_30d && briefs_total_30d > 0
    ? Math.round(((missions_started_30d || 0) / briefs_total_30d) * 100)
    : 0;

  const users_delta_pct = users_prev_7d && users_prev_7d > 0
    ? Math.round((((users_7d || 0) - users_prev_7d) / users_prev_7d) * 100)
    : 0;

  const mrr_delta_pct = mrr_prev > 0
    ? Math.round(((mrr_7d - mrr_prev) / mrr_prev) * 100)
    : 0;

  return {
    snapshot_date: now.toISOString(),
    users_total: users_total || 0,
    users_7d: users_7d || 0,
    users_prev_7d: users_prev_7d || 0,
    users_delta_pct,
    missions_completed_7d: missions_completed_7d || 0,
    briefs_open: briefs_open || 0,
    conversion_30d_pct: conversion_30d,
    articles_7d: articles_7d || 0,
    last_article_title: last_article?.[0]?.title || 'Aucun',
    last_article_date,
    hours_since_last_article,
    tickets_open_stale: tickets_open_48h || 0,
    pending_approvals: pending_approvals || 0,
    mrr_estimate_7d: mrr_7d,
    mrr_prev_7d: mrr_prev,
    mrr_delta_pct,
    crm_contacts_total: crm_contacts_total || 0,
    crm_7d: crm_7d || 0,
    handoffs_pending: handoffs_pending || 0,
  };
}

// ---------------------------------------------------------------------------
// Détection des alertes
// ---------------------------------------------------------------------------
function detectAlerts(kpis: Record<string, number | string>) {
  const alerts: Array<{ type: string; message: string; severity: 'critical' | 'warning' }> = [];

  if (typeof kpis.hours_since_last_article === 'number' && kpis.hours_since_last_article >= ALERT_THRESHOLDS.articles_silence_hours) {
    alerts.push({
      type: 'blog_silence',
      message: `Pipeline blog inactif depuis ${kpis.hours_since_last_article}h (dernier : "${kpis.last_article_title}")`,
      severity: 'critical',
    });
  }

  if (typeof kpis.users_delta_pct === 'number' && kpis.users_delta_pct <= -ALERT_THRESHOLDS.users_7d_drop_pct) {
    alerts.push({
      type: 'users_drop',
      message: `Nouveaux utilisateurs en baisse de ${Math.abs(kpis.users_delta_pct)}% vs semaine précédente`,
      severity: 'critical',
    });
  }

  if (typeof kpis.conversion_30d_pct === 'number' && kpis.conversion_30d_pct < ALERT_THRESHOLDS.conversion_rate_min && typeof kpis.briefs_open === 'number' && kpis.briefs_open > 0) {
    alerts.push({
      type: 'low_conversion',
      message: `Taux de conversion brief → mission : ${kpis.conversion_30d_pct}% (seuil : ${ALERT_THRESHOLDS.conversion_rate_min}%)`,
      severity: 'warning',
    });
  }

  if (typeof kpis.tickets_open_stale === 'number' && kpis.tickets_open_stale >= ALERT_THRESHOLDS.tickets_open_max) {
    alerts.push({
      type: 'tickets_overload',
      message: `${kpis.tickets_open_stale} tickets ouverts depuis plus de 48h — action support requise`,
      severity: 'warning',
    });
  }

  if (typeof kpis.mrr_delta_pct === 'number' && kpis.mrr_delta_pct <= -ALERT_THRESHOLDS.mrr_drop_pct && (kpis.mrr_estimate_7d as number) > 0) {
    alerts.push({
      type: 'mrr_drop',
      message: `Revenus en baisse de ${Math.abs(kpis.mrr_delta_pct)}% vs semaine précédente`,
      severity: 'critical',
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Email CEO
// ---------------------------------------------------------------------------
async function sendEmail(apiKey: string, subject: string, html: string) {
  if (!apiKey) return;
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [CEO_EMAIL], subject, html }),
    });
  } catch (_) { /* non-critique */ }
}

function buildDailyAlertHtml(kpis: Record<string, number | string>, alerts: Array<{ type: string; message: string; severity: string }>) {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const alertRows = alerts.map(a =>
    `<div class="alert ${a.severity}"><span class="badge">${a.severity === 'critical' ? '🔴 CRITIQUE' : '🟡 ATTENTION'}</span><p>${a.message}</p></div>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:580px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#A855F7;}
h2{font-size:18px;margin:20px 0 4px;color:#E9D5FF;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;}
.card{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;}
.card-label{font-size:11px;color:#9898B8;margin-bottom:4px;}
.card-value{font-size:22px;font-weight:700;color:#F4F4FF;}
.card-delta{font-size:11px;margin-top:2px;}
.up{color:#34D399;}.down{color:#EF4444;}.flat{color:#9898B8;}
.alert{border-radius:8px;padding:12px 14px;margin:8px 0;}
.alert.critical{background:#1a0a0a;border:1px solid #EF4444;}
.alert.warning{background:#1a1500;border:1px solid #F59E0B;}
.badge{font-size:10px;font-weight:700;display:block;margin-bottom:4px;color:#F4F4FF;}
.alert p{margin:0;font-size:13px;color:#D1D5DB;}
.btn{display:inline-block;background:#A855F7;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Marketing Director</em></div></div>
<h2>Bilan quotidien</h2>
<div class="meta">${dateStr}</div>
<div class="grid">
  <div class="card">
    <div class="card-label">Utilisateurs total</div>
    <div class="card-value">${kpis.users_total}</div>
    <div class="card-delta ${Number(kpis.users_7d) > 0 ? 'up' : 'flat'}">+${kpis.users_7d} cette semaine</div>
  </div>
  <div class="card">
    <div class="card-label">Briefs ouverts</div>
    <div class="card-value">${kpis.briefs_open}</div>
    <div class="card-delta flat">Conversion 30j : ${kpis.conversion_30d_pct}%</div>
  </div>
  <div class="card">
    <div class="card-label">Articles publiés (7j)</div>
    <div class="card-value">${kpis.articles_7d}</div>
    <div class="card-delta ${Number(kpis.hours_since_last_article) < 96 ? 'up' : 'down'}">Dernier il y a ${kpis.hours_since_last_article}h</div>
  </div>
  <div class="card">
    <div class="card-label">Missions complétées (7j)</div>
    <div class="card-value">${kpis.missions_completed_7d}</div>
    <div class="card-delta flat">Tickets stagnants : ${kpis.tickets_open_stale}</div>
  </div>
  <div class="card">
    <div class="card-label">Revenus estimés (7j)</div>
    <div class="card-value">${Number(kpis.mrr_estimate_7d).toFixed(0)} $</div>
    <div class="card-delta ${Number(kpis.mrr_delta_pct) >= 0 ? 'up' : 'down'}">${Number(kpis.mrr_delta_pct) >= 0 ? '+' : ''}${kpis.mrr_delta_pct}% vs sem. préc.</div>
  </div>
  <div class="card">
    <div class="card-label">Contacts CRM</div>
    <div class="card-value">${kpis.crm_contacts_total}</div>
    <div class="card-delta ${Number(kpis.crm_7d) > 0 ? 'up' : 'flat'}">+${kpis.crm_7d} cette semaine</div>
  </div>
</div>
${alerts.length > 0 ? `<h2>⚠ Alertes (${alerts.length})</h2>${alertRows}` : '<p style="color:#34D399;font-size:13px;">✓ Aucune anomalie détectée aujourd\'hui.</p>'}
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin.html" class="btn">Ouvrir le CEO Cockpit →</a></p>
<div class="footer">Marketing Director IA · CreatorFlow Market · Rapport automatique quotidien</div>
</div></body></html>`;
}

function buildWeeklyReportHtml(kpis: Record<string, number | string>, analysis: string) {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const analysisHtml = analysis
    .split('\n')
    .filter(l => l.trim())
    .map(l => `<p style="margin:0 0 8px;font-size:13px;color:#D1D5DB;">${l}</p>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:580px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#A855F7;}
h2{font-size:18px;margin:20px 0 8px;color:#E9D5FF;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.section{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px;margin:12px 0;}
.btn{display:inline-block;background:#A855F7;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Marketing Director</em></div></div>
<h2>Rapport hebdomadaire</h2>
<div class="meta">${dateStr}</div>
<div class="section">
  <p style="margin:0 0 4px;font-size:11px;color:#9898B8;font-weight:700;">MÉTRIQUES CLÉ</p>
  <p style="font-size:13px;color:#D1D5DB;margin:8px 0 0;">Utilisateurs : <strong>${kpis.users_total}</strong> (+${kpis.users_7d} cette semaine) — Briefs ouverts : <strong>${kpis.briefs_open}</strong> — Articles 7j : <strong>${kpis.articles_7d}</strong></p>
</div>
<div class="section">
  <p style="margin:0 0 8px;font-size:11px;color:#9898B8;font-weight:700;">ANALYSE & RECOMMANDATIONS</p>
  ${analysisHtml}
</div>
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin.html" class="btn">Ouvrir le CEO Cockpit →</a></p>
<div class="footer">Marketing Director IA · CreatorFlow Market · Rapport hebdomadaire automatique</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Analyse Anthropic (hebdomadaire uniquement)
// ---------------------------------------------------------------------------
async function generateWeeklyAnalysis(
  anthropicKey: string,
  kpis: Record<string, number | string>,
  strategicContext: Record<string, unknown>,
  alerts: Array<{ type: string; message: string; severity: string }>
): Promise<string> {
  if (!anthropicKey) return 'Clé Anthropic non configurée.';

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const alertText = alerts.length > 0
    ? `ALERTES ACTIVES : ${alerts.map(a => a.message).join(' | ')}`
    : 'Aucune alerte critique cette semaine.';

  const prompt = `Tu es le Marketing Director permanent de CreatorFlow Market.
Voici les KPIs de la semaine et le contexte stratégique.

KPIs :
- Utilisateurs total : ${kpis.users_total} (+${kpis.users_7d} cette semaine, ${kpis.users_delta_pct}% vs semaine précédente)
- Briefs ouverts : ${kpis.briefs_open}
- Taux de conversion brief → mission (30j) : ${kpis.conversion_30d_pct}%
- Articles publiés cette semaine : ${kpis.articles_7d}
- Dernière publication : il y a ${kpis.hours_since_last_article}h
- Tickets support stagnants : ${kpis.tickets_open_stale}
- Revenus estimés (7j) : ${kpis.mrr_estimate_7d}$ (${kpis.mrr_delta_pct}% vs semaine précédente)
- Contacts CRM : ${kpis.crm_contacts_total} (+${kpis.crm_7d} cette semaine)
- Approbations en attente : ${kpis.pending_approvals}

Contexte stratégique :
${JSON.stringify(strategicContext, null, 2)}

${alertText}

Rédige un rapport hebdomadaire court (5-8 points). Pour chaque point : observation factuelle + recommandation concrète.
Sois direct. Pas de blabla. Le CEO lit ça en 2 minutes. Format : texte simple, une ligne par point, pas de markdown.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find(b => b.type === 'text');
  return text?.type === 'text' ? text.text : 'Analyse indisponible.';
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: { run_type?: string } = {};
  try { body = await req.json(); } catch (_) { /* GET de test */ }
  const runType = (body.run_type || 'daily') as 'daily' | 'weekly' | 'monthly' | 'alert';

  try {
    // 1. Lire les KPIs
    const kpis = await readKPIs(supabase);

    // 2. Détecter les alertes
    const alerts = detectAlerts(kpis as Record<string, number | string>);

    // 3. Lire le contexte stratégique (company_memory)
    const { data: stratMem } = await supabase
      .from('company_memory')
      .select('content')
      .eq('agent_slug', AGENT_SLUG)
      .eq('memory_type', 'strategic_context')
      .single();
    const strategicContext = stratMem?.content || {};

    // 4. Créer le rapport dans agent_reports
    const isWeekly = runType === 'weekly' || runType === 'monthly';
    let reportTitle: string;
    let reportSections: Array<{ heading: string; content: string }>;
    let analysis = '';

    if (isWeekly) {
      analysis = await generateWeeklyAnalysis(anthropicKey, kpis as Record<string, number | string>, strategicContext, alerts);
      reportTitle = `Rapport hebdomadaire Marketing Director — ${new Date().toLocaleDateString('fr-CA')}`;
      reportSections = [
        { heading: 'Métriques de la semaine', content: JSON.stringify(kpis, null, 2) },
        { heading: 'Alertes', content: alerts.length > 0 ? alerts.map(a => `${a.severity.toUpperCase()} — ${a.message}`).join('\n') : 'Aucune alerte.' },
        { heading: 'Analyse & Recommandations', content: analysis },
      ];
    } else {
      reportTitle = `Bilan quotidien Marketing Director — ${new Date().toLocaleDateString('fr-CA')}`;
      reportSections = [
        { heading: 'KPIs du jour', content: JSON.stringify(kpis, null, 2) },
        { heading: 'Alertes', content: alerts.length > 0 ? alerts.map(a => `${a.severity.toUpperCase()} — ${a.message}`).join('\n') : 'Aucune alerte.' },
      ];
    }

    const { data: report } = await supabase
      .from('agent_reports')
      .insert({
        agent_slug: AGENT_SLUG,
        title: reportTitle,
        sections: reportSections,
        report_type: isWeekly ? 'weekly_summary' : 'daily_kpi',
        content: { kpis, alerts },
      })
      .select('id')
      .single();

    // 5. Mettre à jour la baseline si hebdomadaire
    if (isWeekly) {
      await supabase
        .from('company_memory')
        .upsert({
          agent_slug: AGENT_SLUG,
          memory_type: 'kpi_baseline',
          content: {
            snapshot_date: new Date().toISOString(),
            users_total: kpis.users_total,
            users_7d: kpis.users_7d,
            missions_completed_7d: kpis.missions_completed_7d,
            briefs_open: kpis.briefs_open,
            articles_7d: kpis.articles_7d,
            tickets_open_stale: kpis.tickets_open_stale,
            mrr_estimate_7d: kpis.mrr_estimate_7d,
            conversion_30d_pct: kpis.conversion_30d_pct,
            crm_contacts_total: kpis.crm_contacts_total,
            notes: `Baseline mise à jour automatiquement — ${runType}`,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'agent_slug,memory_type' });

      // Mettre à jour weekly_context
      await supabase
        .from('company_memory')
        .upsert({
          agent_slug: AGENT_SLUG,
          memory_type: 'weekly_context',
          content: {
            week_start: new Date().toISOString(),
            summary: analysis.slice(0, 500),
            alerts_count: alerts.length,
            key_metrics: {
              users_7d: kpis.users_7d,
              articles_7d: kpis.articles_7d,
              missions_7d: kpis.missions_completed_7d,
            },
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'agent_slug,memory_type' });
    }

    // 6. Envoyer emails selon le type de run
    if (alerts.length > 0) {
      // Alertes = email immédiat, quel que soit le type de run
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      const subject = criticalAlerts.length > 0
        ? `🔴 ALERTE Marketing — ${criticalAlerts[0].message.slice(0, 60)}`
        : `🟡 Attention Marketing — ${alerts[0].message.slice(0, 60)}`;
      await sendEmail(resendKey, subject, buildDailyAlertHtml(kpis as Record<string, number | string>, alerts));
    } else if (isWeekly) {
      // Rapport hebdomadaire sans alerte
      await sendEmail(
        resendKey,
        `📊 Rapport hebdomadaire Marketing Director — ${new Date().toLocaleDateString('fr-CA')}`,
        buildWeeklyReportHtml(kpis as Record<string, number | string>, analysis)
      );
    }
    // Bilan quotidien sans alerte = pas d'email (juste le rapport en base)

    // 7. Mettre à jour ai_agents.last_active
    await supabase
      .from('ai_agents')
      .update({ last_active: new Date().toISOString() })
      .eq('slug', AGENT_SLUG);

    // 8. Logger le heartbeat
    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG,
      run_type: runType,
      status: alerts.length > 0 ? 'alert_sent' : 'ok',
      kpis_snapshot: kpis,
      alerts_triggered: alerts,
      report_id: report?.id || null,
      duration_ms: Date.now() - startTime,
    });

    return new Response(JSON.stringify({
      ok: true,
      run_type: runType,
      status: alerts.length > 0 ? 'alert_sent' : 'ok',
      kpis_summary: {
        users_total: kpis.users_total,
        users_7d: kpis.users_7d,
        articles_7d: kpis.articles_7d,
        hours_since_last_article: kpis.hours_since_last_article,
        briefs_open: kpis.briefs_open,
        mrr_estimate_7d: kpis.mrr_estimate_7d,
      },
      alerts_count: alerts.length,
      alerts: alerts.map(a => ({ type: a.type, severity: a.severity, message: a.message })),
      report_id: report?.id,
      duration_ms: Date.now() - startTime,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    const duration = Date.now() - startTime;
    try {
      await supabase.from('agent_heartbeats').insert({
        agent_slug: AGENT_SLUG,
        run_type: runType,
        status: 'error',
        error_message: (err as Error).message,
        duration_ms: duration,
      });
    } catch (_) { /* silencieux */ }

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
