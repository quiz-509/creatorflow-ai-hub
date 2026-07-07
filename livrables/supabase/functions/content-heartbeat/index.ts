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
const AGENT_SLUG = 'content';
const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Content Employee IA <noreply@creatorflowmarket.com>';

const ALERT_THRESHOLDS = {
  silence_hours: 96,
  min_articles_7d: 2,
  pipeline_sources_min: 1,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ContentPlan {
  analysis: string;
  editorial_calendar: string;
  first_article: string;
  seo_keywords: string;
  next_steps: string;
  requires_ceo_validation: boolean;
}

// ---------------------------------------------------------------------------
// Lecture KPIs Blog
// ---------------------------------------------------------------------------
async function readBlogKPIs(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const minus7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const minus30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: total_published },
    { count: articles_7d },
    { count: articles_30d },
    { data: last_article },
    { count: draft_count },
    { count: active_sources },
    { count: subscribers },
    { count: subscribers_7d },
  ] = await Promise.all([
    supabase.from('blog_articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('blog_articles').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', minus7d),
    supabase.from('blog_articles').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', minus30d),
    supabase.from('blog_articles').select('title, published_at, slug').eq('status', 'published').order('published_at', { ascending: false }).limit(1),
    supabase.from('blog_articles').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('blog_sources').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('blog_subscribers').select('*', { count: 'exact', head: true }),
    supabase.from('blog_subscribers').select('*', { count: 'exact', head: true }).gte('created_at', minus7d),
  ]);

  const last_article_date = last_article?.[0]?.published_at || null;
  const hours_since_last = last_article_date
    ? Math.round((now.getTime() - new Date(last_article_date).getTime()) / (1000 * 60 * 60))
    : 999;

  const cadence_30d = articles_30d && articles_30d > 0
    ? Math.round((articles_30d / 30) * 7 * 10) / 10
    : 0;

  return {
    snapshot_date: now.toISOString(),
    total_published: total_published || 0,
    articles_7d: articles_7d || 0,
    articles_30d: articles_30d || 0,
    cadence_per_week: cadence_30d,
    draft_count: draft_count || 0,
    active_sources: active_sources || 0,
    subscribers: subscribers || 0,
    subscribers_7d: subscribers_7d || 0,
    last_article_title: last_article?.[0]?.title || 'Aucun',
    last_article_date,
    last_article_slug: last_article?.[0]?.slug || '',
    hours_since_last,
  };
}

// ---------------------------------------------------------------------------
// Détection des alertes blog
// ---------------------------------------------------------------------------
function detectAlerts(kpis: Record<string, number | string>) {
  const alerts: Array<{ type: string; message: string; severity: 'critical' | 'warning' }> = [];

  if (typeof kpis.hours_since_last === 'number' && kpis.hours_since_last >= ALERT_THRESHOLDS.silence_hours) {
    alerts.push({
      type: 'blog_silence',
      message: `Pipeline blog silencieux depuis ${kpis.hours_since_last}h — dernier article : "${kpis.last_article_title}"`,
      severity: 'critical',
    });
  }

  if (typeof kpis.articles_7d === 'number' && kpis.articles_7d < ALERT_THRESHOLDS.min_articles_7d && typeof kpis.total_published === 'number' && kpis.total_published > 0) {
    alerts.push({
      type: 'low_cadence',
      message: `Cadence faible : ${kpis.articles_7d} article(s) cette semaine (objectif : ${ALERT_THRESHOLDS.min_articles_7d}+)`,
      severity: 'warning',
    });
  }

  if (typeof kpis.active_sources === 'number' && kpis.active_sources < ALERT_THRESHOLDS.pipeline_sources_min) {
    alerts.push({
      type: 'sources_inactive',
      message: `Aucune source blog active — le pipeline de génération automatique est arrêté`,
      severity: 'critical',
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
// HTML — Rapport quotidien blog
// ---------------------------------------------------------------------------
function buildDailyReportHtml(kpis: Record<string, number | string>, alerts: Array<{ type: string; message: string; severity: string }>) {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const alertRows = alerts.map(a =>
    `<div class="alert ${a.severity}"><span class="badge">${a.severity === 'critical' ? '🔴 CRITIQUE' : '🟡 ATTENTION'}</span><p>${a.message}</p></div>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:580px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#06B6D4;}
h2{font-size:18px;margin:20px 0 4px;color:#BAE6FD;}
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
.btn{display:inline-block;background:#06B6D4;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Content Employee</em></div></div>
<h2>Bilan blog quotidien</h2>
<div class="meta">${dateStr}</div>
<div class="grid">
  <div class="card">
    <div class="card-label">Articles publiés (7j)</div>
    <div class="card-value ${Number(kpis.articles_7d) >= 2 ? 'up' : 'warn'}">${kpis.articles_7d}</div>
    <div class="card-sub">Cadence : ${kpis.cadence_per_week}/semaine (30j)</div>
  </div>
  <div class="card">
    <div class="card-label">Total publié</div>
    <div class="card-value">${kpis.total_published}</div>
    <div class="card-sub">${kpis.articles_30d} ce mois</div>
  </div>
  <div class="card">
    <div class="card-label">Dernier article</div>
    <div class="card-value ${Number(kpis.hours_since_last) < 96 ? 'up' : 'crit'}">${kpis.hours_since_last}h</div>
    <div class="card-sub">${String(kpis.last_article_title).slice(0, 40)}</div>
  </div>
  <div class="card">
    <div class="card-label">Abonnés blog</div>
    <div class="card-value">${kpis.subscribers}</div>
    <div class="card-sub ${Number(kpis.subscribers_7d) > 0 ? 'up' : ''}">+${kpis.subscribers_7d} cette semaine</div>
  </div>
  <div class="card">
    <div class="card-label">Brouillons en cours</div>
    <div class="card-value">${kpis.draft_count}</div>
    <div class="card-sub">Sources actives : ${kpis.active_sources}</div>
  </div>
</div>
${alerts.length > 0 ? `<h2>⚠ Alertes (${alerts.length})</h2>${alertRows}` : '<p style="color:#34D399;font-size:13px;">✓ Pipeline blog nominal — aucune anomalie.</p>'}
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Ouvrir le CEO Cockpit →</a></p>
<div class="footer">Content Employee IA · CreatorFlow Market · Rapport automatique quotidien</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// HTML — Email mission contenu
// ---------------------------------------------------------------------------
function buildMissionEmailHtml(
  mission: { title: string; objective: string },
  plan: ContentPlan,
  reportId: string | null,
  requiresValidation: boolean
): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const calendarLines = plan.editorial_calendar
    .split('\n').filter(l => l.trim())
    .map(l => `<li style="margin-bottom:6px;font-size:13px;color:#D1D5DB;">${l}</li>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#06B6D4;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:14px;}
.ok{background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);}
.warn{background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);}
h2{font-size:18px;margin:0 0 4px;color:#BAE6FD;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.section{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.section-label{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}
ul{padding-left:18px;margin:0;}
.article-preview{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#06B6D4;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Content Employee</em></div></div>
<div class="badge ${requiresValidation ? 'warn' : 'ok'}">${requiresValidation ? '⚠ Validation CEO requise' : '✓ Mission prise en charge'}</div>
<h2>${mission.title}</h2>
<div class="meta">${dateStr} · Mission assignée par le CEO</div>

<div class="section">
  <div class="section-label">Analyse du brief</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${plan.analysis}</p>
</div>

<div class="section">
  <div class="section-label">Calendrier éditorial</div>
  <ul>${calendarLines || `<li style="color:#D1D5DB;font-size:13px;">${plan.editorial_calendar}</li>`}</ul>
</div>

<div class="section">
  <div class="section-label">Mots-clés SEO prioritaires</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.7;">${plan.seo_keywords}</p>
</div>

<div class="section">
  <div class="section-label">Premier article — aperçu</div>
  <div class="article-preview">${plan.first_article.slice(0, 800)}${plan.first_article.length > 800 ? '\n\n[... voir rapport complet dans le cockpit]' : ''}</div>
</div>

<div class="section">
  <div class="section-label">Prochaines étapes — 48h</div>
  <p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;">${plan.next_steps}</p>
</div>

<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir le rapport complet →</a></p>
<div class="footer">Content Employee IA · CreatorFlow Market · Mission automatique</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Parser — format sections texte
// ---------------------------------------------------------------------------
function parseContentPlan(text: string): ContentPlan {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const analysis = extract('ANALYSIS');
  if (analysis) {
    const validationRaw = extract('VALIDATION').toLowerCase();
    return {
      analysis,
      editorial_calendar: extract('CALENDAR'),
      first_article: extract('FIRST_ARTICLE'),
      seo_keywords: extract('SEO_KEYWORDS'),
      next_steps: extract('NEXT_STEPS'),
      requires_ceo_validation: validationRaw.includes('true'),
    };
  }
  return {
    analysis: text.slice(0, 800),
    editorial_calendar: '',
    first_article: text,
    seo_keywords: '',
    next_steps: 'Voir rapport complet dans le CEO Cockpit.',
    requires_ceo_validation: false,
  };
}

// ---------------------------------------------------------------------------
// ── PROJECT TASK PIPELINE (AI Workforce OS) ──────────────────────────────
// Tâches déléguées par le Marketing Director via project_tasks
// ---------------------------------------------------------------------------
interface ContentDeliverable {
  content_type: string;
  summary: string;
  main_deliverable: string;
  keywords: string;
  next_ideas: string;
}

function buildProjectTaskPrompt(
  project: { title: string; client_name: string; objective?: string },
  task: { title: string; description?: string },
  kpis: Array<{ metric_name: string }>
): string {
  const kpiList = kpis.length
    ? kpis.map(k => `- ${k.metric_name}`).join('\n')
    : '- Visibilité en ligne\n- Engagement audience\n- Génération de leads';
  return `Tu es le Content Employee permanent de CreatorFlow Market.

Tu viens de recevoir une tâche déléguée par le Marketing Director.
Ton rôle : produire un livrable de contenu complet, professionnel et immédiatement utilisable pour le client.

═══ PROJET CLIENT ═══
Client : ${project.client_name}
Projet : ${project.title}
Objectif : ${(project.objective || '').slice(0, 400)}

═══ TÂCHE DÉLÉGUÉE ═══
${task.title}

Brief du Marketing Director :
${(task.description || 'Produire du contenu marketing de qualité adapté au client.').slice(0, 700)}

═══ KPIs À AMÉLIORER ═══
${kpiList}

═══ TON MANDAT ═══
Tu es expert en contenu digital francophone : YouTube, TikTok, Instagram, blog SEO, newsletter, LinkedIn.
Tu produis des contenus qui génèrent du trafic, construisent l'autorité et convertissent en clients.
Tu livres un VRAI livrable prêt à publier — pas un plan, pas des conseils généraux.

═══ FORMAT RÉPONSE ═══
Réponds exactement avec ces sections :

[CONTENT_TYPE]
article_blog | script_youtube | posts_sociaux | newsletter | strategie_editoriale

[SUMMARY]
2-3 phrases sur ce que tu as produit et pourquoi adapté à ce client spécifiquement.

[MAIN_DELIVERABLE]
Le livrable complet et prêt à publier. Minimum 500 mots.
- Article : Titre H1 + Accroche + 3 sections H2 + Conclusion + CTA
- Script : Accroche (0-15s) + Corps (3 parties) + Outro + Description YouTube
- Posts : 5 posts complets avec texte + hashtags + heure de publication recommandée

[KEYWORDS]
6-8 mots-clés SEO ou hashtags les plus pertinents pour ce client.

[NEXT_IDEAS]
3 idées de contenu complémentaires pour les 2 prochaines semaines avec angle et format.`;
}

function parseDeliverable(text: string): ContentDeliverable {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  return {
    content_type: extract('CONTENT_TYPE') || 'article_blog',
    summary: extract('SUMMARY') || text.slice(0, 300),
    main_deliverable: extract('MAIN_DELIVERABLE') || text,
    keywords: extract('KEYWORDS'),
    next_ideas: extract('NEXT_IDEAS'),
  };
}

function buildDeliveryEmailHtml(
  project: { title: string; client_name: string },
  deliverable: ContentDeliverable
): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const preview = deliverable.main_deliverable.slice(0, 900);
  const kwTags = deliverable.keywords
    .split('\n').filter(k => k.trim()).slice(0, 7)
    .map(k => `<span style="display:inline-block;background:#0d0d2a;border:1px solid rgba(124,58,237,0.3);border-radius:99px;padding:3px 10px;font-size:11px;color:#A78BFA;margin:3px;">${k.trim()}</span>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo em{font-style:normal;color:#06B6D4;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);margin:14px 0;}
h2{font-size:18px;margin:4px 0;color:#BAE6FD;}
.meta{font-size:12px;color:#9898B8;margin-bottom:16px;}
.s{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.sl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;}
.preview{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#7C3AED;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="logo">CreatorFlow <em>Content Employee</em></div>
<div class="badge">✓ Livrable produit — ${deliverable.content_type.replace(/_/g,' ')}</div>
<h2>${project.client_name}</h2>
<div class="meta">${dateStr} · ${project.title.slice(0, 70)}</div>
<div class="s"><div class="sl">Résumé</div><p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${deliverable.summary}</p></div>
<div class="s"><div class="sl">Livrable — aperçu</div><div class="preview">${preview}${deliverable.main_deliverable.length > 900 ? '\n\n[... voir rapport complet dans le CEO Cockpit]' : ''}</div></div>
${kwTags ? `<div class="s"><div class="sl">Mots-clés / Hashtags</div><div style="margin-top:4px;">${kwTags}</div></div>` : ''}
${deliverable.next_ideas ? `<div class="s"><div class="sl">Prochaines idées — 2 semaines</div><p style="margin:0;font-size:13px;color:#D1D5DB;white-space:pre-wrap;line-height:1.7;">${deliverable.next_ideas}</p></div>` : ''}
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir le Cockpit Projets →</a></p>
<div class="footer">Content Employee IA · CreatorFlow Market · Livraison automatique</div>
</div></body></html>`;
}

async function processProjectTasks(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string
): Promise<{ tasks_processed: number; results: Array<{ task_id: string; success: boolean; content_type?: string }> }> {
  // Pick up pending tasks delegated by Marketing Director
  const { data: tasks } = await supabase
    .from('project_tasks')
    .select('id, project_id, title, description, status')
    .eq('assigned_department', 'content')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(2); // Max 2 per heartbeat to stay within timeout

  if (!tasks?.length) return { tasks_processed: 0, results: [] };

  const { data: contentAgent } = await supabase.from('ai_agents').select('id').eq('slug', AGENT_SLUG).single();
  const results: Array<{ task_id: string; success: boolean; content_type?: string }> = [];

  for (const task of tasks) {
    try {
      // Load full project context
      const [{ data: project }, { data: kpis }] = await Promise.all([
        supabase.from('client_projects')
          .select('id,title,client_name,client_email,objective,phase,responsible_agent_id')
          .eq('id', task.project_id).single(),
        supabase.from('project_kpis').select('metric_name').eq('project_id', task.project_id).limit(5),
      ]);

      if (!project) { results.push({ task_id: task.id, success: false }); continue; }

      // Get Marketing Director info for handoff
      const { data: mdAgent } = await supabase.from('ai_agents')
        .select('id,name,slug').eq('id', project.responsible_agent_id).single();

      // Produce the content deliverable via Claude
      const raw = await callClaude(
        anthropicKey, 'claude-haiku-4-5-20251001', 2048,
        buildProjectTaskPrompt(project, task, kpis || [])
      );
      const deliverable = parseDeliverable(raw);

      // 1. Save full deliverable to agent_reports
      const { data: report } = await supabase.from('agent_reports').insert({
        agent_slug: AGENT_SLUG,
        title: `Livrable — ${project.client_name} : ${deliverable.content_type}`,
        sections: [
          { heading: 'Type de livrable', content: deliverable.content_type },
          { heading: 'Résumé', content: deliverable.summary },
          { heading: 'Livrable complet', content: deliverable.main_deliverable },
          { heading: 'Mots-clés', content: deliverable.keywords },
          { heading: 'Prochaines idées', content: deliverable.next_ideas },
        ],
        report_type: 'content_deliverable',
        content: { task_id: task.id, project_id: task.project_id, deliverable },
      }).select('id').single();

      // 2. Mark task completed, save result summary
      await supabase.from('project_tasks')
        .update({ status: 'completed', result: deliverable.summary.slice(0, 500) })
        .eq('id', task.id);

      // 3. Write to project_history (immutable audit trail)
      await supabase.from('project_history').insert({
        project_id: task.project_id,
        event_type: 'content_delivered',
        old_value: { task_status: 'pending', task_title: task.title },
        new_value: { task_status: 'completed', content_type: deliverable.content_type, report_id: report?.id || null },
        actor_type: 'agent',
        actor_id: contentAgent?.id || null,
        note: `${deliverable.content_type.replace(/_/g,' ')} livré pour "${project.title.slice(0, 60)}"`,
      });

      // 4. Notify Marketing Director via employee_handoffs
      await supabase.from('employee_handoffs').insert({
        from_agent: AGENT_SLUG,
        to_agent: mdAgent?.slug || 'marketing',
        handoff_type: 'content_completed',
        payload: {
          task_id: task.id,
          project_id: task.project_id,
          project_title: project.title,
          client_name: project.client_name,
          content_type: deliverable.content_type,
          summary: deliverable.summary.slice(0, 300),
          report_id: report?.id || null,
        },
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // 5. Send notification email to CEO
      await sendEmail(
        resendKey,
        `📝 Contenu livré — ${project.client_name} (${deliverable.content_type.replace(/_/g,' ')})`,
        buildDeliveryEmailHtml(project, deliverable)
      );

      results.push({ task_id: task.id, success: true, content_type: deliverable.content_type });

    } catch (err) {
      console.error('[content] task error:', task.id, (err as Error).message);
      results.push({ task_id: task.id, success: false });
    }
  }

  return { tasks_processed: results.length, results };
}

// ---------------------------------------------------------------------------
// Prompt mission contenu
// ---------------------------------------------------------------------------
function buildContentMissionPrompt(
  mission: { title: string; objective: string },
  kpis: Record<string, number | string>
): string {
  return `Tu es le Content Employee permanent de CreatorFlow Market.

Tu viens de recevoir une mission de contenu du CEO. Prends-la en charge immédiatement et produis un plan éditorial complet + un premier article.

═══ MISSION ═══
Titre : ${mission.title}
Objectif : ${mission.objective}

═══ ÉTAT DU BLOG ═══
- Articles publiés total : ${kpis.total_published}
- Articles cette semaine : ${kpis.articles_7d}
- Cadence actuelle : ${kpis.cadence_per_week} articles/semaine
- Abonnés : ${kpis.subscribers}
- Dernier article : il y a ${kpis.hours_since_last}h ("${kpis.last_article_title}")

═══ TON RÔLE ═══
Tu es expert en création de contenu digital pour créateurs, solopreneurs et TPE francophones.
Tu maîtrises : SEO, copywriting, storytelling, formats courts/longs, newsletters, réseaux sociaux.
Ton travail : produire du contenu qui génère du trafic, construit l'autorité et convertit.

═══ FORMAT DE RÉPONSE ═══
Réponds avec ces sections exactement, dans cet ordre :

[ANALYSIS]
Analyse du besoin en 3-4 phrases. Ce que le CEO veut vraiment. Les enjeux SEO et audience.

[CALENDAR]
Calendrier éditorial 4 semaines. Format : Semaine X — Jour : Titre | Format | Angle | Mot-clé principal. Un article par ligne.

[SEO_KEYWORDS]
10 mots-clés prioritaires avec volume estimé et intention de recherche. Un par ligne.

[FIRST_ARTICLE]
Premier article COMPLET et professionnel. Titre H1 + Introduction (accroche) + 3-4 sections avec sous-titres H2 + Conclusion + CTA. 600-800 mots minimum.

[NEXT_STEPS]
3 actions concrètes dans les 48h pour démarrer le plan éditorial.

[VALIDATION]
false`;
}

// ---------------------------------------------------------------------------
// Exécution d'une mission contenu
// ---------------------------------------------------------------------------
async function executeMission(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  mission: { id: string; title: string; objective: string }
): Promise<{ report_id: string | null; requires_validation: boolean }> {
  const kpis = await readBlogKPIs(supabase);

  const rawText = await callClaude(
    anthropicKey,
    'claude-haiku-4-5-20251001',
    2048,
    buildContentMissionPrompt(mission, kpis as Record<string, number | string>)
  );
  const plan = parseContentPlan(rawText);

  await supabase.from('agent_outputs').insert({
    mission_id: mission.id,
    output_type: 'content_plan',
    output_data: {
      title: `Plan Contenu — ${mission.title}`,
      analysis: plan.analysis,
      editorial_calendar: plan.editorial_calendar,
      first_article: plan.first_article,
      seo_keywords: plan.seo_keywords,
      next_steps: plan.next_steps,
    },
    status: 'completed',
  });

  const { data: report } = await supabase
    .from('agent_reports')
    .insert({
      agent_slug: AGENT_SLUG,
      title: `Plan Contenu — ${mission.title}`,
      sections: [
        { heading: 'Analyse du brief', content: plan.analysis },
        { heading: 'Calendrier éditorial', content: plan.editorial_calendar },
        { heading: 'Mots-clés SEO', content: plan.seo_keywords },
        { heading: 'Premier article', content: plan.first_article },
        { heading: 'Prochaines étapes', content: plan.next_steps },
      ],
      report_type: 'content_plan',
      content: { mission_id: mission.id, plan },
    })
    .select('id')
    .single();

  await supabase.from('agent_actions_log').insert({
    mission_id: mission.id,
    agent_slug: AGENT_SLUG,
    action_type: 'content_mission',
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
      type: 'content_plan',
      data: {
        mission_id: mission.id,
        mission_title: mission.title,
        plan_summary: plan.editorial_calendar.slice(0, 500),
        report_id: report?.id || null,
        asked_by: AGENT_SLUG,
      },
      status: 'pending',
    });
  }

  await sendEmail(
    resendKey,
    plan.requires_ceo_validation
      ? `⚠ Validation requise — Content Employee : ${mission.title.slice(0, 55)}`
      : `📝 Plan Contenu prêt — ${mission.title.slice(0, 55)}`,
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
  const runType = (body.run_type || (isDbWebhook ? 'mission' : 'daily')) as 'daily' | 'mission' | 'project_tasks';

  try {
    // ── MISSION CEO (legacy) ──────────────────────────────────────────────────
    if (runType === 'mission') {
      const missionResults = await processMissions(supabase, anthropicKey, resendKey);
      return new Response(JSON.stringify({
        ok: true,
        run_type: 'mission',
        ...missionResults,
        duration_ms: Date.now() - startTime,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── PROJECT TASKS ONLY (explicit trigger) ─────────────────────────────────
    if (runType === 'project_tasks') {
      const taskResults = await processProjectTasks(supabase, anthropicKey, resendKey);
      return new Response(JSON.stringify({
        ok: true,
        run_type: 'project_tasks',
        ...taskResults,
        duration_ms: Date.now() - startTime,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── HEARTBEAT QUOTIDIEN ───────────────────────────────────────────────────
    // Step 1: Traiter les project_tasks déléguées par le Marketing Director
    const taskResults = await processProjectTasks(supabase, anthropicKey, resendKey);
    const actions: string[] = taskResults.tasks_processed > 0
      ? taskResults.results.map(r => r.success ? `content_delivered:${r.content_type}` : 'task_error')
      : [];

    // Step 2: Monitoring blog KPIs (routine quotidienne)
    const kpis = await readBlogKPIs(supabase);
    const alerts = detectAlerts(kpis as Record<string, number | string>);

    const reportTitle = `Bilan blog Content Employee — ${new Date().toLocaleDateString('fr-CA')}`;
    const { data: report } = await supabase
      .from('agent_reports')
      .insert({
        agent_slug: AGENT_SLUG,
        title: reportTitle,
        sections: [
          { heading: 'KPIs blog', content: JSON.stringify(kpis, null, 2) },
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
        ? `🔴 ALERTE Blog — ${critical[0].message.slice(0, 60)}`
        : `🟡 Attention Blog — ${alerts[0].message.slice(0, 60)}`;
      await sendEmail(resendKey, subject, buildDailyReportHtml(kpis as Record<string, number | string>, alerts));
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
      project_tasks: {
        tasks_processed: taskResults.tasks_processed,
        actions,
      },
      kpis_summary: {
        articles_7d: kpis.articles_7d,
        cadence_per_week: kpis.cadence_per_week,
        hours_since_last: kpis.hours_since_last,
        total_published: kpis.total_published,
        subscribers: kpis.subscribers,
      },
      alerts_count: alerts.length,
      alerts: alerts.map(a => ({ type: a.type, severity: a.severity, message: a.message })),
      report_id: report?.id,
      duration_ms: Date.now() - startTime,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
