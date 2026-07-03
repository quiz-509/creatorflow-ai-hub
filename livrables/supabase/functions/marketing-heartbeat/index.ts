import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

// Appel direct à l'API Anthropic via fetch (compatible Supabase Edge Functions)
async function callClaude(
  apiKey: string,
  model: string,
  maxTokens: number,
  prompt: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

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
  users_7d_drop_pct: 30,
  conversion_rate_min: 20,
  articles_silence_hours: 96,
  tickets_open_max: 10,
  mrr_drop_pct: 20,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MissionPlan {
  analysis: string;
  strategy: string;
  deliverable: string;
  next_steps: string;
  requires_ceo_validation: boolean;
  ceo_validation: string;
}

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
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Ouvrir le CEO Cockpit →</a></p>
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
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Ouvrir le CEO Cockpit →</a></p>
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

  return await callClaude(anthropicKey, 'claude-haiku-4-5-20251001', 1024, prompt) || 'Analyse indisponible.';
}

// ---------------------------------------------------------------------------
// MISSION PIPELINE — Marketing Director prend en charge une mission client
// ---------------------------------------------------------------------------

function parseMissionPlan(text: string): MissionPlan {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        analysis: String(parsed.analysis || ''),
        strategy: String(parsed.strategy || ''),
        deliverable: String(parsed.deliverable || ''),
        next_steps: String(parsed.next_steps || ''),
        requires_ceo_validation: Boolean(parsed.requires_ceo_validation),
        ceo_validation: String(parsed.ceo_validation || ''),
      };
    }
  } catch (_) { /* fallback ci-dessous */ }
  return {
    analysis: text.slice(0, 600),
    strategy: 'Plan disponible dans le livrable complet.',
    deliverable: text,
    next_steps: 'Voir rapport complet dans le CEO Cockpit.',
    requires_ceo_validation: false,
    ceo_validation: '',
  };
}

function buildMissionPrompt(
  mission: { title: string; objective: string },
  strategicContext: Record<string, unknown>,
  kpis: Record<string, number | string>
): string {
  return `Tu es le Marketing Director permanent de CreatorFlow Market.

Le CEO vient de t'assigner une mission. Tu dois l'analyser en profondeur, créer un plan stratégique concret et produire un premier livrable professionnel complet.

═══ MISSION ASSIGNÉE ═══
Titre : ${mission.title}
Objectif : ${mission.objective}

═══ CONTEXTE STRATÉGIQUE ═══
${JSON.stringify(strategicContext, null, 2)}

═══ KPIs ACTUELS ═══
- Utilisateurs total : ${kpis.users_total} (+${kpis.users_7d} cette semaine)
- Briefs ouverts : ${kpis.briefs_open} | Conversion 30j : ${kpis.conversion_30d_pct}%
- Articles publiés (7j) : ${kpis.articles_7d} | Contacts CRM : ${kpis.crm_contacts_total}
- Revenus estimés (7j) : ${kpis.mrr_estimate_7d} $

═══ TON RÔLE ═══
Tu es expert en marketing digital pour créateurs de contenu, solopreneurs et TPE francophones.
Tu maîtrises : stratégie de contenu, growth marketing, copywriting, réseaux sociaux, email marketing, SEO.
Ton travail n'est pas de répondre à une question. C'est de prendre en charge cette mission concrètement dès maintenant.

═══ FORMAT DE RÉPONSE ═══
Réponds UNIQUEMENT avec un objet JSON valide. Pas de markdown autour, pas de backticks, juste le JSON.

{
  "analysis": "Analyse du besoin en 3-4 phrases précises. Ce que le client veut vraiment. Les enjeux derrière la demande.",
  "strategy": "Stratégie complète en 6-8 points numérotés. Objectifs mesurables, canaux prioritaires, approche, timeline 4 semaines, KPIs de succès.",
  "deliverable": "Premier livrable COMPLET et professionnel. PAS un résumé, PAS un plan — le vrai contenu. Si stratégie de contenu : le calendrier semaine par semaine avec thèmes, formats, accroches, hashtags. Si campagne email : les 3 premiers emails complets rédigés. Si plan marketing : le plan détaillé actionnable.",
  "next_steps": "3 actions concrètes exécutables dans les 48h pour faire avancer cette mission.",
  "requires_ceo_validation": false,
  "ceo_validation": ""
}

Note : requires_ceo_validation = true uniquement si la mission implique une dépense budgétaire, un contact client externe direct, ou une décision stratégique hors de ton périmètre habituel.`;
}

function buildMissionEmailHtml(
  mission: { title: string; objective: string },
  plan: MissionPlan,
  reportId: string | null,
  requiresValidation: boolean
): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const strategyLines = plan.strategy
    .split('\n')
    .filter(l => l.trim())
    .map(l => `<li style="margin-bottom:6px;font-size:13px;color:#D1D5DB;">${l}</li>`)
    .join('');
  const deliverablePreview = plan.deliverable.length > 800
    ? plan.deliverable.slice(0, 800) + '\n\n[... voir rapport complet dans le cockpit]'
    : plan.deliverable;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#A855F7;}
.status-badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:14px;}
.status-ok{background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);}
.status-warn{background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);}
h2{font-size:18px;margin:0 0 4px;color:#E9D5FF;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.section{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.section-label{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}
.section-warn{border-color:rgba(245,158,11,0.3);background:rgba(245,158,11,0.05);}
.section-warn .section-label{color:#F59E0B;}
ul{padding-left:18px;margin:0;}
.deliverable{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#A855F7;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Marketing Director</em></div></div>
<div class="status-badge ${requiresValidation ? 'status-warn' : 'status-ok'}">${requiresValidation ? '⚠ Validation CEO requise' : '✓ Mission prise en charge'}</div>
<h2>${mission.title}</h2>
<div class="meta">${dateStr} · Mission assignée par le CEO</div>

<div class="section">
  <div class="section-label">Analyse du brief</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${plan.analysis}</p>
</div>

<div class="section">
  <div class="section-label">Stratégie proposée</div>
  <ul>${strategyLines || `<li style="color:#D1D5DB;font-size:13px;">${plan.strategy}</li>`}</ul>
</div>

<div class="section">
  <div class="section-label">Premier livrable</div>
  <div class="deliverable">${deliverablePreview}</div>
</div>

${requiresValidation ? `
<div class="section section-warn">
  <div class="section-label">Validation requise avant exécution</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;">${plan.ceo_validation}</p>
</div>` : ''}

<div class="section">
  <div class="section-label">Prochaines étapes — 48h</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;">${plan.next_steps}</p>
</div>

<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir le rapport complet →</a></p>
<div class="footer">Marketing Director IA · CreatorFlow Market · Mission automatique</div>
</div></body></html>`;
}

async function executeMission(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  mission: { id: string; title: string; objective: string }
): Promise<{ report_id: string | null; requires_validation: boolean }> {
  console.log('[executeMission] start mission_id=', mission.id);

  // 1. Contexte stratégique
  console.log('[executeMission] step 1: company_memory');
  const { data: stratMem } = await supabase
    .from('company_memory')
    .select('content')
    .eq('agent_slug', AGENT_SLUG)
    .eq('memory_type', 'strategic_context')
    .single();
  const strategicContext = stratMem?.content || {};

  // 2. KPIs pour contextualiser l'analyse
  console.log('[executeMission] step 2: readKPIs');
  const kpis = await readKPIs(supabase);

  // 3. Analyse profonde via Claude Sonnet
  console.log('[executeMission] step 3: callClaude (key set=', !!anthropicKey, ')');
  const rawText = await callClaude(
    anthropicKey,
    'claude-sonnet-4-6',
    4096,
    buildMissionPrompt(mission, strategicContext, kpis as Record<string, number | string>)
  );
  console.log('[executeMission] step 3 done, rawText length=', rawText.length);
  const plan = parseMissionPlan(rawText);

  // 4. Livrable dans agent_outputs
  await supabase.from('agent_outputs').insert({
    mission_id: mission.id,
    output_type: 'marketing_plan',
    output_data: {
      title: `Plan Marketing — ${mission.title}`,
      analysis: plan.analysis,
      strategy: plan.strategy,
      deliverable: plan.deliverable,
      next_steps: plan.next_steps,
    },
    status: 'completed',
  });

  // 5. Rapport structuré dans agent_reports
  const { data: report } = await supabase
    .from('agent_reports')
    .insert({
      agent_slug: AGENT_SLUG,
      title: `Plan Marketing — ${mission.title}`,
      sections: [
        { heading: 'Analyse du brief', content: plan.analysis },
        { heading: 'Stratégie proposée', content: plan.strategy },
        { heading: 'Livrable initial', content: plan.deliverable },
        { heading: 'Prochaines étapes (48h)', content: plan.next_steps },
        { heading: 'Validation CEO', content: plan.requires_ceo_validation ? plan.ceo_validation : 'Aucune — exécution autonome autorisée.' },
      ],
      report_type: 'mission_plan',
      content: { mission_id: mission.id, plan },
    })
    .select('id')
    .single();

  // 6. Log immuable de l'action
  await supabase.from('agent_actions_log').insert({
    mission_id: mission.id,
    agent_slug: AGENT_SLUG,
    action_type: 'mission_analysis',
    action_data: {
      objective: mission.objective.slice(0, 300),
      plan_preview: plan.analysis.slice(0, 300),
      report_id: report?.id || null,
    },
    input: { mission_id: mission.id, title: mission.title, objective: mission.objective },
  });

  // 7. Mission → in_progress
  await supabase
    .from('agent_missions')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', mission.id);

  // 8. Approbation CEO si nécessaire
  if (plan.requires_ceo_validation) {
    await supabase.from('pending_approvals').insert({
      type: 'mission_plan',
      data: {
        mission_id: mission.id,
        mission_title: mission.title,
        plan_summary: plan.strategy.slice(0, 500),
        report_id: report?.id || null,
        asked_by: AGENT_SLUG,
      },
      status: 'pending',
    });
  }

  // 9. Email CEO avec plan complet
  await sendEmail(
    resendKey,
    plan.requires_ceo_validation
      ? `⚠ Validation requise — Marketing Director : ${mission.title.slice(0, 55)}`
      : `📋 Plan Marketing prêt — ${mission.title.slice(0, 55)}`,
    buildMissionEmailHtml(mission, plan, report?.id || null, plan.requires_ceo_validation)
  );

  return { report_id: report?.id || null, requires_validation: plan.requires_ceo_validation };
}

async function processMissions(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
): Promise<{ missions_processed: number; results: Array<{ mission_id: string; success: boolean; report_id?: string | null; error?: string }> }> {
  console.log('[processMissions] step 1: recherche agent slug=', AGENT_SLUG);
  const { data: agent, error: agentError } = await supabase
    .from('ai_agents')
    .select('id')
    .eq('slug', AGENT_SLUG)
    .single();
  console.log('[processMissions] agent=', JSON.stringify(agent), 'error=', agentError?.message);

  if (!agent) return { missions_processed: 0, results: [], debug_agent_error: agentError?.message } as never;

  console.log('[processMissions] step 2: recherche missions assigned pour agent', agent.id);
  const { data: missions, error: missionsError } = await supabase
    .from('agent_missions')
    .select('id, title, objective, status, created_at')
    .eq('agent_id', agent.id)
    .eq('status', 'assigned')
    .order('created_at', { ascending: true })
    .limit(3);
  console.log('[processMissions] missions count=', missions?.length, 'error=', missionsError?.message);

  if (!missions?.length) return { missions_processed: 0, results: [], debug_missions_error: missionsError?.message } as never;

  const results: Array<{ mission_id: string; success: boolean; report_id?: string | null; error?: string }> = [];

  for (const mission of missions) {
    try {
      const result = await executeMission(supabase, anthropicKey, resendKey, mission);
      results.push({ mission_id: mission.id, success: true, ...result });
    } catch (err) {
      await supabase.from('agent_actions_log').insert({
        mission_id: mission.id,
        agent_slug: AGENT_SLUG,
        action_type: 'mission_error',
        action_data: { error: (err as Error).message },
        input: { mission_id: mission.id },
      }).catch(() => {});
      results.push({ mission_id: mission.id, success: false, error: (err as Error).message });
    }
  }

  return { missions_processed: results.length, results };
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
  const runType = (body.run_type || 'daily') as 'daily' | 'weekly' | 'monthly' | 'alert' | 'mission';

  try {
    // ── MISSION : Marketing Director prend en charge les missions assignées ──
    if (runType === 'mission') {
      const missionResults = await processMissions(supabase, anthropicKey, resendKey);
      return new Response(JSON.stringify({
        ok: true,
        run_type: 'mission',
        ...missionResults,
        duration_ms: Date.now() - startTime,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── HEARTBEAT : surveillance KPIs + alertes ─────────────────────────────
    const kpis = await readKPIs(supabase);
    const alerts = detectAlerts(kpis as Record<string, number | string>);

    const { data: stratMem } = await supabase
      .from('company_memory')
      .select('content')
      .eq('agent_slug', AGENT_SLUG)
      .eq('memory_type', 'strategic_context')
      .single();
    const strategicContext = stratMem?.content || {};

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

    if (isWeekly) {
      await supabase.from('company_memory').upsert({
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

      await supabase.from('company_memory').upsert({
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

    if (alerts.length > 0) {
      const criticalAlerts = alerts.filter(a => a.severity === 'critical');
      const subject = criticalAlerts.length > 0
        ? `🔴 ALERTE Marketing — ${criticalAlerts[0].message.slice(0, 60)}`
        : `🟡 Attention Marketing — ${alerts[0].message.slice(0, 60)}`;
      await sendEmail(resendKey, subject, buildDailyAlertHtml(kpis as Record<string, number | string>, alerts));
    } else if (isWeekly) {
      await sendEmail(
        resendKey,
        `📊 Rapport hebdomadaire Marketing Director — ${new Date().toLocaleDateString('fr-CA')}`,
        buildWeeklyReportHtml(kpis as Record<string, number | string>, analysis)
      );
    }

    await supabase
      .from('ai_agents')
      .update({ last_active: new Date().toISOString() })
      .eq('slug', AGENT_SLUG);

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
    if (runType !== 'mission') {
      try {
        await supabase.from('agent_heartbeats').insert({
          agent_slug: AGENT_SLUG,
          run_type: runType,
          status: 'error',
          error_message: (err as Error).message,
          duration_ms: duration,
        });
      } catch (_) { /* silencieux */ }
    }

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
