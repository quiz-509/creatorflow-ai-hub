import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

async function callClaude(apiKey: string, model: string, maxTokens: number, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = msg.content.find((b: { type: string }) => b.type === 'text');
  return block && block.type === 'text' ? (block as { type: 'text'; text: string }).text : '';
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CEO_EMAIL = 'pjoacenel@gmail.com';
const AGENT_SLUG = 'prospecting';
const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Prospecting Employee IA <noreply@creatorflowmarket.com>';

const ALERT_THRESHOLDS = {
  no_new_leads_days: 7,
  stale_contacts_max: 10,
  min_contacts_7d: 1,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ProspectingPlan {
  analysis: string;
  target_profile: string;
  outreach_sequence: string;
  linkedin_strategy: string;
  next_steps: string;
  requires_ceo_validation: boolean;
}

// ---------------------------------------------------------------------------
// Lecture KPIs CRM
// ---------------------------------------------------------------------------
async function readCRMKPIs(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const minus14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: total_contacts },
    { count: new_7d },
    { count: new_30d },
    { count: status_new },
    { count: status_contacted },
    { count: status_qualified },
    { count: stale_contacts },
    { count: missions_completed_30d },
    { count: profiles_total },
    { count: profiles_7d },
    { data: recent_contacts },
  ] = await Promise.all([
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }),
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).gte('created_at', minus7d),
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).gte('created_at', minus30d),
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).eq('status', 'contacted'),
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).eq('status', 'qualified'),
    supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).eq('status', 'new').lte('created_at', minus14d),
    supabase.from('agent_missions').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', minus30d),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', minus7d),
    supabase.from('crm_contacts').select('name, email, status, role, created_at').order('created_at', { ascending: false }).limit(3),
  ]);

  const conversion_rate = total_contacts && total_contacts > 0
    ? Math.round(((status_qualified || 0) / total_contacts) * 100)
    : 0;

  const days_since_new = new_7d === 0
    ? Math.round((now.getTime() - new Date(minus7d).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    snapshot_date: now.toISOString(),
    total_contacts: total_contacts || 0,
    new_7d: new_7d || 0,
    new_30d: new_30d || 0,
    status_new: status_new || 0,
    status_contacted: status_contacted || 0,
    status_qualified: status_qualified || 0,
    stale_contacts: stale_contacts || 0,
    conversion_rate_pct: conversion_rate,
    missions_completed_30d: missions_completed_30d || 0,
    platform_users: profiles_total || 0,
    new_users_7d: profiles_7d || 0,
    days_since_new_lead: days_since_new,
    recent_contacts: recent_contacts || [],
  };
}

// ---------------------------------------------------------------------------
// Détection des alertes
// ---------------------------------------------------------------------------
function detectAlerts(kpis: Record<string, number | string | unknown[]>) {
  const alerts: Array<{ type: string; message: string; severity: 'critical' | 'warning' }> = [];

  if (typeof kpis.new_7d === 'number' && kpis.new_7d < ALERT_THRESHOLDS.min_contacts_7d && typeof kpis.total_contacts === 'number' && kpis.total_contacts > 0) {
    alerts.push({
      type: 'no_new_leads',
      message: `Aucun nouveau prospect cette semaine — pipeline d'acquisition à relancer`,
      severity: 'critical',
    });
  }

  if (typeof kpis.stale_contacts === 'number' && kpis.stale_contacts >= ALERT_THRESHOLDS.stale_contacts_max) {
    alerts.push({
      type: 'stale_leads',
      message: `${kpis.stale_contacts} contacts "new" sans suivi depuis +14j — relance requise`,
      severity: 'warning',
    });
  }

  if (typeof kpis.status_new === 'number' && kpis.status_new > 5 && typeof kpis.status_contacted === 'number' && kpis.status_contacted === 0) {
    alerts.push({
      type: 'no_outreach',
      message: `${kpis.status_new} leads en attente — aucune prise de contact initiée`,
      severity: 'warning',
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Email CEO
// ---------------------------------------------------------------------------
async function sendEmail(apiKey: string, subject: string, html: string) {
  const safeSubject = subject.replace(/[\r\n\t]/g, ' ').trim();
  if (!apiKey) return;
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [CEO_EMAIL], subject: safeSubject, html }),
    });
  } catch (_) { /* silencieux */ }
}

// ---------------------------------------------------------------------------
// HTML — Rapport quotidien CRM
// ---------------------------------------------------------------------------
function buildDailyReportHtml(kpis: Record<string, number | string | unknown[]>, alerts: Array<{ type: string; message: string; severity: string }>) {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const alertRows = alerts.map(a =>
    `<div class="alert ${a.severity}"><span class="badge">${a.severity === 'critical' ? '🔴 CRITIQUE' : '🟡 ATTENTION'}</span><p>${a.message}</p></div>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:580px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#F59E0B;}
h2{font-size:18px;margin:20px 0 4px;color:#FDE68A;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;}
.card{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;}
.card-label{font-size:11px;color:#9898B8;margin-bottom:4px;}
.card-value{font-size:22px;font-weight:700;color:#F4F4FF;}
.card-sub{font-size:11px;margin-top:2px;color:#9898B8;}
.up{color:#34D399;}.warn{color:#F59E0B;}.crit{color:#EF4444;}
.pipeline{display:flex;gap:6px;margin:16px 0;}
.stage{flex:1;background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;text-align:center;}
.stage-label{font-size:10px;color:#9898B8;margin-bottom:4px;}
.stage-val{font-size:20px;font-weight:700;color:#F4F4FF;}
.alert{border-radius:8px;padding:12px 14px;margin:8px 0;}
.alert.critical{background:#1a0a0a;border:1px solid #EF4444;}
.alert.warning{background:#1a1500;border:1px solid #F59E0B;}
.badge{font-size:10px;font-weight:700;display:block;margin-bottom:4px;color:#F4F4FF;}
.alert p{margin:0;font-size:13px;color:#D1D5DB;}
.btn{display:inline-block;background:#F59E0B;color:#000;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Prospecting Employee</em></div></div>
<h2>Bilan CRM quotidien</h2>
<div class="meta">${dateStr}</div>
<div class="grid">
  <div class="card">
    <div class="card-label">Total contacts CRM</div>
    <div class="card-value">${kpis.total_contacts}</div>
    <div class="card-sub ${Number(kpis.new_7d) > 0 ? 'up' : 'warn'}">+${kpis.new_7d} cette semaine</div>
  </div>
  <div class="card">
    <div class="card-label">Taux de conversion</div>
    <div class="card-value ${Number(kpis.conversion_rate_pct) >= 20 ? 'up' : 'warn'}">${kpis.conversion_rate_pct}%</div>
    <div class="card-sub">new → qualifié</div>
  </div>
  <div class="card">
    <div class="card-label">Utilisateurs plateforme</div>
    <div class="card-value">${kpis.platform_users}</div>
    <div class="card-sub ${Number(kpis.new_users_7d) > 0 ? 'up' : ''}>+${kpis.new_users_7d} cette semaine</div>
  </div>
  <div class="card">
    <div class="card-label">Leads stagnants (+14j)</div>
    <div class="card-value ${Number(kpis.stale_contacts) > 0 ? 'warn' : 'up'}">${kpis.stale_contacts}</div>
    <div class="card-sub">sans suivi</div>
  </div>
</div>
<h2>Pipeline de conversion</h2>
<div class="pipeline">
  <div class="stage"><div class="stage-label">Nouveaux</div><div class="stage-val">${kpis.status_new}</div></div>
  <div class="stage"><div class="stage-label">Contactés</div><div class="stage-val">${kpis.status_contacted}</div></div>
  <div class="stage"><div class="stage-label">Qualifiés</div><div class="stage-val">${kpis.status_qualified}</div></div>
</div>
${alerts.length > 0 ? `<h2>⚠ Alertes (${alerts.length})</h2>${alertRows}` : '<p style="color:#34D399;font-size:13px;">✓ Pipeline prospecting nominal — aucune anomalie.</p>'}
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Ouvrir le CEO Cockpit →</a></p>
<div class="footer">Prospecting Employee IA · CreatorFlow Market · Rapport automatique quotidien</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// HTML — Email mission prospecting
// ---------------------------------------------------------------------------
function buildMissionEmailHtml(
  mission: { title: string; objective: string },
  plan: ProspectingPlan,
  reportId: string | null,
  requiresValidation: boolean
): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const sequenceLines = plan.outreach_sequence
    .split('\n').filter(l => l.trim())
    .map(l => `<li style="margin-bottom:8px;font-size:13px;color:#D1D5DB;">${l}</li>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#F59E0B;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:14px;}
.ok{background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);}
.warn{background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);}
h2{font-size:18px;margin:0 0 4px;color:#FDE68A;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.section{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.section-label{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}
ul{padding-left:18px;margin:0;}
.sequence{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;}
.btn{display:inline-block;background:#F59E0B;color:#000;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Prospecting Employee</em></div></div>
<div class="badge ${requiresValidation ? 'warn' : 'ok'}">${requiresValidation ? '⚠ Validation CEO requise' : '✓ Mission prise en charge'}</div>
<h2>${mission.title}</h2>
<div class="meta">${dateStr} · Mission assignée par le CEO</div>

<div class="section">
  <div class="section-label">Analyse du brief</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${plan.analysis}</p>
</div>

<div class="section">
  <div class="section-label">Profil cible — ICP</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;">${plan.target_profile}</p>
</div>

<div class="section">
  <div class="section-label">Séquence d'outreach (3 emails)</div>
  <ul>${sequenceLines || `<li style="color:#D1D5DB;font-size:13px;">${plan.outreach_sequence}</li>`}</ul>
</div>

<div class="section">
  <div class="section-label">Stratégie LinkedIn</div>
  <div class="sequence">${plan.linkedin_strategy}</div>
</div>

<div class="section">
  <div class="section-label">Prochaines étapes — 48h</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;">${plan.next_steps}</p>
</div>

<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir le rapport complet →</a></p>
<div class="footer">Prospecting Employee IA · CreatorFlow Market · Mission automatique</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Parser — format sections texte
// ---------------------------------------------------------------------------
function parseProspectingPlan(text: string): ProspectingPlan {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const analysis = extract('ANALYSIS');
  if (analysis) {
    return {
      analysis,
      target_profile: extract('TARGET_PROFILE'),
      outreach_sequence: extract('OUTREACH_SEQUENCE'),
      linkedin_strategy: extract('LINKEDIN_STRATEGY'),
      next_steps: extract('NEXT_STEPS'),
      requires_ceo_validation: extract('VALIDATION').toLowerCase().includes('true'),
    };
  }
  return {
    analysis: text.slice(0, 800),
    target_profile: '',
    outreach_sequence: text,
    linkedin_strategy: '',
    next_steps: 'Voir rapport complet dans le CEO Cockpit.',
    requires_ceo_validation: false,
  };
}

// ---------------------------------------------------------------------------
// Prompt mission prospecting
// ---------------------------------------------------------------------------
function buildProspectingMissionPrompt(
  mission: { title: string; objective: string },
  kpis: Record<string, number | string | unknown[]>
): string {
  return `Tu es le Prospecting Employee permanent de CreatorFlow Market.

Tu viens de recevoir une mission de prospection du CEO. Prends-la en charge et produis un plan d'acquisition complet avec une séquence d'outreach opérationnelle.

═══ MISSION ═══
Titre : ${mission.title}
Objectif : ${mission.objective}

═══ ÉTAT DU CRM ═══
- Contacts total : ${kpis.total_contacts}
- Nouveaux cette semaine : ${kpis.new_7d}
- Statut pipeline : ${kpis.status_new} nouveaux | ${kpis.status_contacted} contactés | ${kpis.status_qualified} qualifiés
- Taux de conversion : ${kpis.conversion_rate_pct}%
- Utilisateurs plateforme : ${kpis.platform_users} (+${kpis.new_users_7d} cette semaine)

═══ TON RÔLE ═══
Tu es expert en growth marketing, prospection B2B et acquisition digitale pour créateurs de contenu, solopreneurs et TPE francophones.
Tu maîtrises : cold emailing, LinkedIn outreach, lead scoring, qualification BANT, séquences automatisées.
Ton travail : identifier les bons prospects et produire des messages qui génèrent des réponses.

═══ CONTEXTE CREATORFLOW MARKET ═══
CreatorFlow Market est une marketplace hybride experts humains + employés IA pour créateurs, solopreneurs et TPE francophones.
Cible principale : créateurs de contenu, freelances, solopreneurs qui veulent déléguer leur marketing, contenu et prospection.

═══ FORMAT DE RÉPONSE ═══
Réponds avec ces sections exactement, dans cet ordre :

[ANALYSIS]
Analyse du besoin en 3-4 phrases. Qui cibler, pourquoi, quelle approche.

[TARGET_PROFILE]
Profil client idéal (ICP) détaillé : secteur, taille, poste décideur, pain points, canaux, signaux d'achat. Format structuré, une ligne par critère.

[OUTREACH_SEQUENCE]
3 emails d'outreach complets et prêts à envoyer. Format : Email 1 — Objet : ... / Corps : ... | Email 2 — Objet : ... / Corps : ... | Email 3 — Objet : ... / Corps : ...

[LINKEDIN_STRATEGY]
Stratégie LinkedIn en 5 points : profil à optimiser, types de posts à publier, commentaires stratégiques, connexions à cibler, message de connexion type.

[NEXT_STEPS]
3 actions concrètes exécutables dans les 48h pour lancer la campagne.

[VALIDATION]
false

Note : [VALIDATION] = true uniquement si la mission nécessite un budget publicitaire ou l'accès à des outils payants non disponibles.`;
}

// ---------------------------------------------------------------------------
// Exécution d'une mission prospecting
// ---------------------------------------------------------------------------
async function executeMission(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  mission: { id: string; title: string; objective: string }
): Promise<{ report_id: string | null; requires_validation: boolean }> {
  const kpis = await readCRMKPIs(supabase);

  const rawText = await callClaude(
    anthropicKey,
    'claude-haiku-4-5-20251001',
    2048,
    buildProspectingMissionPrompt(mission, kpis as Record<string, number | string | unknown[]>)
  );
  const plan = parseProspectingPlan(rawText);

  await supabase.from('agent_outputs').insert({
    mission_id: mission.id,
    output_type: 'prospecting_plan',
    output_data: {
      title: `Plan Prospecting — ${mission.title}`,
      analysis: plan.analysis,
      target_profile: plan.target_profile,
      outreach_sequence: plan.outreach_sequence,
      linkedin_strategy: plan.linkedin_strategy,
      next_steps: plan.next_steps,
    },
    status: 'completed',
  });

  const { data: report } = await supabase
    .from('agent_reports')
    .insert({
      agent_slug: AGENT_SLUG,
      title: `Plan Prospecting — ${mission.title}`,
      sections: [
        { heading: 'Analyse', content: plan.analysis },
        { heading: 'Profil cible (ICP)', content: plan.target_profile },
        { heading: 'Séquence outreach', content: plan.outreach_sequence },
        { heading: 'Stratégie LinkedIn', content: plan.linkedin_strategy },
        { heading: 'Prochaines étapes', content: plan.next_steps },
      ],
      report_type: 'prospecting_plan',
      content: { mission_id: mission.id, plan },
    })
    .select('id')
    .single();

  await supabase.from('agent_actions_log').insert({
    mission_id: mission.id,
    agent_slug: AGENT_SLUG,
    action_type: 'prospecting_mission',
    action_data: {
      objective: mission.objective.slice(0, 300),
      plan_preview: plan.analysis.slice(0, 300),
      report_id: report?.id || null,
    },
    input: { mission_id: mission.id, title: mission.title },
  });

  await supabase
    .from('agent_missions')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', mission.id);

  if (plan.requires_ceo_validation) {
    await supabase.from('pending_approvals').insert({
      type: 'prospecting_plan',
      data: {
        mission_id: mission.id,
        mission_title: mission.title,
        plan_summary: plan.target_profile.slice(0, 500),
        report_id: report?.id || null,
        asked_by: AGENT_SLUG,
      },
      status: 'pending',
    });
  }

  await sendEmail(
    resendKey,
    plan.requires_ceo_validation
      ? `⚠ Validation requise — Prospecting Employee : ${mission.title.slice(0, 55)}`
      : `🎯 Plan Prospecting prêt — ${mission.title.slice(0, 55)}`,
    buildMissionEmailHtml(mission, plan, report?.id || null, plan.requires_ceo_validation)
  );

  return { report_id: report?.id || null, requires_validation: plan.requires_ceo_validation };
}

// ---------------------------------------------------------------------------
// Traitement des missions assignées
// ---------------------------------------------------------------------------
async function processMissions(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
): Promise<{ missions_processed: number; results: Array<{ mission_id: string; success: boolean; report_id?: string | null; error?: string }> }> {
  const { data: agent } = await supabase
    .from('ai_agents')
    .select('id')
    .eq('slug', AGENT_SLUG)
    .single();

  if (!agent) return { missions_processed: 0, results: [] } as never;

  const { data: missions } = await supabase
    .from('agent_missions')
    .select('id, title, objective, status, created_at')
    .eq('agent_id', agent.id)
    .eq('status', 'assigned')
    .order('created_at', { ascending: true })
    .limit(3);

  if (!missions?.length) return { missions_processed: 0, results: [] } as never;

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

  let body: { run_type?: string; type?: string; table?: string } = {};
  try { body = await req.json(); } catch (_) { /* GET */ }
  const isDbWebhook = body.type === 'INSERT' && body.table === 'agent_missions';
  const runType = (body.run_type || (isDbWebhook ? 'mission' : 'daily')) as 'daily' | 'mission';

  try {
    // ── MISSION ──────────────────────────────────────────────────────────────
    if (runType === 'mission') {
      const missionResults = await processMissions(supabase, anthropicKey, resendKey);
      return new Response(JSON.stringify({
        ok: true,
        run_type: 'mission',
        ...missionResults,
        duration_ms: Date.now() - startTime,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── HEARTBEAT QUOTIDIEN ───────────────────────────────────────────────────
    const kpis = await readCRMKPIs(supabase);
    const alerts = detectAlerts(kpis as Record<string, number | string | unknown[]>);

    const { data: report } = await supabase
      .from('agent_reports')
      .insert({
        agent_slug: AGENT_SLUG,
        title: `Bilan CRM Prospecting Employee — ${new Date().toLocaleDateString('fr-CA')}`,
        sections: [
          { heading: 'KPIs CRM', content: JSON.stringify(kpis, null, 2) },
          { heading: 'Alertes', content: alerts.length > 0 ? alerts.map(a => `${a.severity.toUpperCase()} — ${a.message}`).join('\n') : 'Aucune alerte.' },
        ],
        report_type: 'daily_kpi',
        content: { kpis, alerts },
      })
      .select('id')
      .single();

    if (alerts.length > 0) {
      const critical = alerts.filter(a => a.severity === 'critical');
      const subject = critical.length > 0
        ? `🔴 ALERTE Prospecting — ${critical[0].message.slice(0, 60)}`
        : `🟡 Attention Prospecting — ${alerts[0].message.slice(0, 60)}`;
      await sendEmail(resendKey, subject, buildDailyReportHtml(kpis as Record<string, number | string | unknown[]>, alerts));
    }

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG,
      run_type: 'daily',
      status: alerts.length > 0 ? 'alert_sent' : 'ok',
      kpis_snapshot: kpis,
      alerts_triggered: alerts,
      report_id: report?.id || null,
      duration_ms: Date.now() - startTime,
    });

    await supabase
      .from('ai_agents')
      .update({ last_active: new Date().toISOString() })
      .eq('slug', AGENT_SLUG);

    return new Response(JSON.stringify({
      ok: true,
      run_type: 'daily',
      status: alerts.length > 0 ? 'alert_sent' : 'ok',
      kpis_summary: {
        total_contacts: kpis.total_contacts,
        new_7d: kpis.new_7d,
        status_new: kpis.status_new,
        status_contacted: kpis.status_contacted,
        status_qualified: kpis.status_qualified,
        conversion_rate_pct: kpis.conversion_rate_pct,
      },
      alerts_count: alerts.length,
      report_id: report?.id,
      duration_ms: Date.now() - startTime,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
