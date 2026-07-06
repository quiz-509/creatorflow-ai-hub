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
const AGENT_SLUG = 'support';
const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Support Agent IA <noreply@creatorflowmarket.com>';

const ALERT_THRESHOLDS = {
  negative_reviews_max: 2,
  pending_conversations_max: 5,
  new_users_without_action_days: 7,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SupportPlan {
  analysis: string;
  faq_draft: string;
  response_templates: string;
  improvement_strategy: string;
  next_steps: string;
  requires_ceo_validation: boolean;
}

// ---------------------------------------------------------------------------
// Lecture KPIs Support
// ---------------------------------------------------------------------------
async function readSupportKPIs(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const minus48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const [
    { count: total_reviews },
    { count: reviews_7d },
    { count: negative_reviews },
    { count: negative_7d },
    { data: recent_reviews },
    { count: total_conversations },
    { count: conversations_48h },
    { count: profiles_total },
    { count: profiles_7d },
    { count: experts_total },
    { count: missions_total },
    { count: missions_completed },
  ] = await Promise.all([
    supabase.from('reviews').select('*', { count: 'exact', head: true }),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).gte('created_at', minus7d),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).lte('rating', 2),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).lte('rating', 2).gte('created_at', minus7d),
    supabase.from('reviews').select('rating, comment, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).gte('updated_at', minus48h),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', minus7d),
    supabase.from('experts').select('*', { count: 'exact', head: true }),
    supabase.from('agent_missions').select('*', { count: 'exact', head: true }),
    supabase.from('agent_missions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
  ]);

  const satisfaction_rate = total_reviews && total_reviews > 0
    ? Math.round(((total_reviews - (negative_reviews || 0)) / total_reviews) * 100)
    : 100;

  return {
    snapshot_date: now.toISOString(),
    total_reviews: total_reviews || 0,
    reviews_7d: reviews_7d || 0,
    negative_reviews: negative_reviews || 0,
    negative_7d: negative_7d || 0,
    satisfaction_rate,
    recent_reviews: recent_reviews || [],
    total_conversations: total_conversations || 0,
    active_conversations_48h: conversations_48h || 0,
    profiles_total: profiles_total || 0,
    new_users_7d: profiles_7d || 0,
    experts_total: experts_total || 0,
    missions_total: missions_total || 0,
    missions_completed: missions_completed || 0,
    mission_completion_rate: missions_total && missions_total > 0
      ? Math.round(((missions_completed || 0) / missions_total) * 100)
      : 0,
  };
}

// ---------------------------------------------------------------------------
// Détection des alertes
// ---------------------------------------------------------------------------
function detectAlerts(kpis: Record<string, number | string | unknown[]>) {
  const alerts: Array<{ type: string; message: string; severity: 'critical' | 'warning' }> = [];

  if (typeof kpis.negative_7d === 'number' && kpis.negative_7d >= ALERT_THRESHOLDS.negative_reviews_max) {
    alerts.push({
      type: 'negative_reviews_spike',
      message: `${kpis.negative_7d} avis négatifs (≤2 étoiles) reçus cette semaine — intervention requise`,
      severity: 'critical',
    });
  }

  if (typeof kpis.satisfaction_rate === 'number' && kpis.satisfaction_rate < 80 && typeof kpis.total_reviews === 'number' && kpis.total_reviews > 0) {
    alerts.push({
      type: 'low_satisfaction',
      message: `Taux de satisfaction à ${kpis.satisfaction_rate}% — en dessous du seuil critique (80%)`,
      severity: 'critical',
    });
  }

  if (typeof kpis.new_users_7d === 'number' && kpis.new_users_7d > 3 && typeof kpis.active_conversations_48h === 'number' && kpis.active_conversations_48h === 0) {
    alerts.push({
      type: 'no_support_activity',
      message: `${kpis.new_users_7d} nouveaux utilisateurs cette semaine sans activité support — onboarding à vérifier`,
      severity: 'warning',
    });
  }

  if (typeof kpis.mission_completion_rate === 'number' && kpis.missions_total > 5 && kpis.mission_completion_rate < 50) {
    alerts.push({
      type: 'low_mission_completion',
      message: `Taux de complétion des missions à ${kpis.mission_completion_rate}% — satisfaction client à risque`,
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
// HTML — Rapport quotidien Support
// ---------------------------------------------------------------------------
function buildDailyReportHtml(kpis: Record<string, number | string | unknown[]>, alerts: Array<{ type: string; message: string; severity: string }>) {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const alertRows = alerts.map(a =>
    `<div class="alert ${a.severity}"><span class="badge">${a.severity === 'critical' ? '🔴 CRITIQUE' : '🟡 ATTENTION'}</span><p>${a.message}</p></div>`
  ).join('');

  const recentReviews = Array.isArray(kpis.recent_reviews)
    ? (kpis.recent_reviews as Array<{ rating: number; comment: string; created_at: string }>)
        .map(r => `<div class="review-card ${r.rating <= 2 ? 'negative' : r.rating >= 4 ? 'positive' : 'neutral'}">
          <div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
          <p>${r.comment ? r.comment.slice(0, 120) + (r.comment.length > 120 ? '...' : '') : '(sans commentaire)'}</p>
        </div>`)
        .join('')
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:580px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#8B5CF6;}
h2{font-size:18px;margin:20px 0 4px;color:#C4B5FD;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;}
.card{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;}
.card-label{font-size:11px;color:#9898B8;margin-bottom:4px;}
.card-value{font-size:22px;font-weight:700;color:#F4F4FF;}
.card-sub{font-size:11px;margin-top:2px;color:#9898B8;}
.up{color:#34D399;}.warn{color:#F59E0B;}.crit{color:#EF4444;}
.alert{border-radius:8px;padding:12px 14px;margin:8px 0;}
.alert.critical{background:#1a0a0a;border:1px solid #EF4444;}
.alert.warning{background:#1a1500;border:1px solid #F59E0B;}
.badge{font-size:10px;font-weight:700;display:block;margin-bottom:4px;color:#F4F4FF;}
.alert p{margin:0;font-size:13px;color:#D1D5DB;}
.review-card{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 12px;margin:6px 0;}
.review-card.negative{border-color:#EF444440;}
.review-card.positive{border-color:#34D39940;}
.stars{font-size:13px;margin-bottom:4px;color:#F59E0B;}
.review-card p{margin:0;font-size:12px;color:#D1D5DB;}
.btn{display:inline-block;background:#8B5CF6;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Support Agent</em></div></div>
<h2>Bilan Support quotidien</h2>
<div class="meta">${dateStr}</div>
<div class="grid">
  <div class="card">
    <div class="card-label">Satisfaction utilisateurs</div>
    <div class="card-value ${Number(kpis.satisfaction_rate) >= 80 ? 'up' : 'crit'}">${kpis.satisfaction_rate}%</div>
    <div class="card-sub">${kpis.total_reviews} avis total</div>
  </div>
  <div class="card">
    <div class="card-label">Avis négatifs ≤2★</div>
    <div class="card-value ${Number(kpis.negative_reviews) > 0 ? 'crit' : 'up'}">${kpis.negative_reviews}</div>
    <div class="card-sub ${Number(kpis.negative_7d) > 0 ? 'crit' : ''}">${kpis.negative_7d > 0 ? `+${kpis.negative_7d} cette semaine` : 'Aucun récent'}</div>
  </div>
  <div class="card">
    <div class="card-label">Utilisateurs plateforme</div>
    <div class="card-value">${kpis.profiles_total}</div>
    <div class="card-sub ${Number(kpis.new_users_7d) > 0 ? 'up' : ''}">+${kpis.new_users_7d} cette semaine</div>
  </div>
  <div class="card">
    <div class="card-label">Missions complétées</div>
    <div class="card-value ${Number(kpis.mission_completion_rate) >= 50 ? 'up' : 'warn'}">${kpis.mission_completion_rate}%</div>
    <div class="card-sub">${kpis.missions_completed}/${kpis.missions_total} missions</div>
  </div>
</div>
${alerts.length > 0 ? `<h2>⚠ Alertes (${alerts.length})</h2>${alertRows}` : '<p style="color:#34D399;font-size:13px;">✓ Support nominal — aucune anomalie détectée.</p>'}
${recentReviews ? `<h2>Derniers avis reçus</h2>${recentReviews}` : ''}
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Ouvrir le CEO Cockpit →</a></p>
<div class="footer">Support Agent IA · CreatorFlow Market · Rapport automatique quotidien</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// HTML — Email mission support
// ---------------------------------------------------------------------------
function buildMissionEmailHtml(
  mission: { title: string; objective: string },
  plan: SupportPlan,
  reportId: string | null,
  requiresValidation: boolean
): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#8B5CF6;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:14px;}
.ok{background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);}
.warn{background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);}
h2{font-size:18px;margin:0 0 4px;color:#C4B5FD;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.section{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.section-label{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}
.content{font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;}
.btn{display:inline-block;background:#8B5CF6;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Support Agent</em></div></div>
<div class="badge ${requiresValidation ? 'warn' : 'ok'}">${requiresValidation ? '⚠ Validation CEO requise' : '✓ Mission prise en charge'}</div>
<h2>${mission.title}</h2>
<div class="meta">${dateStr} · Mission assignée par le CEO</div>

<div class="section">
  <div class="section-label">Analyse du brief</div>
  <div class="content">${plan.analysis}</div>
</div>

<div class="section">
  <div class="section-label">FAQ — Questions fréquentes &amp; réponses</div>
  <div class="content">${plan.faq_draft}</div>
</div>

<div class="section">
  <div class="section-label">Templates de réponse prêts à l'emploi</div>
  <div class="content">${plan.response_templates}</div>
</div>

<div class="section">
  <div class="section-label">Stratégie d'amélioration support</div>
  <div class="content">${plan.improvement_strategy}</div>
</div>

<div class="section">
  <div class="section-label">Prochaines étapes — 48h</div>
  <div class="content">${plan.next_steps}</div>
</div>

<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir le rapport complet →</a></p>
<div class="footer">Support Agent IA · CreatorFlow Market · Mission automatique</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Parser — format sections texte
// ---------------------------------------------------------------------------
function parseSupportPlan(text: string): SupportPlan {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const analysis = extract('ANALYSIS');
  if (analysis) {
    return {
      analysis,
      faq_draft: extract('FAQ'),
      response_templates: extract('TEMPLATES'),
      improvement_strategy: extract('STRATEGY'),
      next_steps: extract('NEXT_STEPS'),
      requires_ceo_validation: extract('VALIDATION').toLowerCase().includes('true'),
    };
  }
  return {
    analysis: text.slice(0, 800),
    faq_draft: '',
    response_templates: text,
    improvement_strategy: '',
    next_steps: 'Voir rapport complet dans le CEO Cockpit.',
    requires_ceo_validation: false,
  };
}

// ---------------------------------------------------------------------------
// Prompt mission support
// ---------------------------------------------------------------------------
function buildSupportMissionPrompt(
  mission: { title: string; objective: string },
  kpis: Record<string, number | string | unknown[]>
): string {
  return `Tu es le Support Agent permanent de CreatorFlow Market.

Tu viens de recevoir une mission du CEO. Prends-la en charge et produis un plan d'amélioration support complet avec des livrables opérationnels.

═══ MISSION ═══
Titre : ${mission.title}
Objectif : ${mission.objective}

═══ ÉTAT SUPPORT ═══
- Taux de satisfaction : ${kpis.satisfaction_rate}%
- Avis négatifs (≤2★) : ${kpis.negative_reviews} total | ${kpis.negative_7d} cette semaine
- Conversations actives (48h) : ${kpis.active_conversations_48h}
- Utilisateurs plateforme : ${kpis.profiles_total} (+${kpis.new_users_7d} cette semaine)
- Experts inscrits : ${kpis.experts_total}
- Missions complétées : ${kpis.missions_completed}/${kpis.missions_total} (${kpis.mission_completion_rate}%)

═══ TON RÔLE ═══
Tu es expert en service client, expérience utilisateur et support pour plateformes digitales B2B/B2C.
Tu maîtrises : gestion des plaintes, rédaction de FAQ, templates de réponse, NPS, escalade, onboarding.
Ton travail : améliorer l'expérience utilisateur et réduire les frictions sur CreatorFlow Market.

═══ CONTEXTE CREATORFLOW MARKET ═══
Marketplace hybride experts humains + employés IA pour créateurs, solopreneurs et TPE francophones.
Utilisateurs : clients cherchant des experts IA, experts offrant leurs services, learners de l'Academy.
Points de contact : formulaire brief, messagerie interne, page profil expert, paiement Stripe, Academy.

═══ FORMAT DE RÉPONSE ═══
Réponds avec ces sections exactement, dans cet ordre :

[ANALYSIS]
Analyse du besoin support en 3-4 phrases. Identifier les points de friction, les risques et l'approche recommandée.

[FAQ]
5 questions fréquentes avec leurs réponses complètes, adaptées au contexte CreatorFlow Market.
Format : Q: [question] / R: [réponse complète]

[TEMPLATES]
3 templates de réponse prêts à l'emploi pour les situations de support les plus courantes.
Format : Template 1 — Sujet : [sujet] / Corps : [texte complet]

[STRATEGY]
Stratégie d'amélioration support en 5 points concrets : processus, outils, métriques, formation, automatisation.

[NEXT_STEPS]
3 actions concrètes exécutables dans les 48h pour améliorer immédiatement le support.

[VALIDATION]
false

Note : [VALIDATION] = true uniquement si la mission nécessite des outils payants ou des ressources humaines supplémentaires.`;
}

// ---------------------------------------------------------------------------
// Exécution d'une mission support
// ---------------------------------------------------------------------------
async function executeMission(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  mission: { id: string; title: string; objective: string }
): Promise<{ report_id: string | null; requires_validation: boolean }> {
  const kpis = await readSupportKPIs(supabase);

  const rawText = await callClaude(
    anthropicKey,
    'claude-haiku-4-5-20251001',
    2048,
    buildSupportMissionPrompt(mission, kpis as Record<string, number | string | unknown[]>)
  );
  const plan = parseSupportPlan(rawText);

  await supabase.from('agent_outputs').insert({
    mission_id: mission.id,
    output_type: 'support_plan',
    output_data: {
      title: `Plan Support — ${mission.title}`,
      analysis: plan.analysis,
      faq_draft: plan.faq_draft,
      response_templates: plan.response_templates,
      improvement_strategy: plan.improvement_strategy,
      next_steps: plan.next_steps,
    },
    status: 'completed',
  });

  const { data: report } = await supabase
    .from('agent_reports')
    .insert({
      agent_slug: AGENT_SLUG,
      title: `Plan Support — ${mission.title}`,
      sections: [
        { heading: 'Analyse', content: plan.analysis },
        { heading: 'FAQ', content: plan.faq_draft },
        { heading: 'Templates de réponse', content: plan.response_templates },
        { heading: 'Stratégie support', content: plan.improvement_strategy },
        { heading: 'Prochaines étapes', content: plan.next_steps },
      ],
      report_type: 'support_plan',
      content: { mission_id: mission.id, plan },
    })
    .select('id')
    .single();

  await supabase.from('agent_actions_log').insert({
    mission_id: mission.id,
    agent_slug: AGENT_SLUG,
    action_type: 'support_mission',
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
      type: 'support_plan',
      data: {
        mission_id: mission.id,
        mission_title: mission.title,
        plan_summary: plan.improvement_strategy.slice(0, 500),
        report_id: report?.id || null,
        asked_by: AGENT_SLUG,
      },
      status: 'pending',
    });
  }

  await sendEmail(
    resendKey,
    plan.requires_ceo_validation
      ? `⚠ Validation requise — Support Agent : ${mission.title.slice(0, 55)}`
      : `🛡 Plan Support prêt — ${mission.title.slice(0, 55)}`,
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
    const kpis = await readSupportKPIs(supabase);
    const alerts = detectAlerts(kpis as Record<string, number | string | unknown[]>);

    const { data: report } = await supabase
      .from('agent_reports')
      .insert({
        agent_slug: AGENT_SLUG,
        title: `Bilan Support Agent — ${new Date().toLocaleDateString('fr-CA')}`,
        sections: [
          { heading: 'KPIs Support', content: JSON.stringify({ satisfaction_rate: kpis.satisfaction_rate, total_reviews: kpis.total_reviews, negative_reviews: kpis.negative_reviews, new_users_7d: kpis.new_users_7d }, null, 2) },
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
        ? `🔴 ALERTE Support — ${critical[0].message.slice(0, 60)}`
        : `🟡 Attention Support — ${alerts[0].message.slice(0, 60)}`;
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
        satisfaction_rate: kpis.satisfaction_rate,
        total_reviews: kpis.total_reviews,
        negative_reviews: kpis.negative_reviews,
        new_users_7d: kpis.new_users_7d,
        mission_completion_rate: kpis.mission_completion_rate,
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
