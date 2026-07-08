import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

async function callClaude(apiKey: string, model: string, maxTokens: number, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
  const block = msg.content.find((b: { type: string }) => b.type === 'text');
  return block && block.type === 'text' ? (block as { type: 'text'; text: string }).text : '';
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const CEO_EMAIL = 'pjoacenel@gmail.com';
const AGENT_SLUG = 'content';
const DEPARTMENT = 'content';
const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Content Employee IA <noreply@creatorflowmarket.com>';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ContentDeliverable {
  content_type: string;
  summary: string;
  main_deliverable: string;
  keywords: string;
  next_ideas: string;
}

interface ProjectDecision {
  action: 'execute' | 'initiate' | 'escalate' | 'hold' | 'complete';
  reason: string;
  task_title?: string;
  task_description?: string;
  recommended_action?: string;
}

interface PortfolioResult {
  projects_reviewed: number;
  actions_taken: number;
  decisions: Array<{ project_id: string; project_title: string; action: string; reason: string }>;
}

interface ContentPlan {
  analysis: string;
  editorial_calendar: string;
  first_article: string;
  seo_keywords: string;
  next_steps: string;
  requires_ceo_validation: boolean;
}

// ---------------------------------------------------------------------------
// Email
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
// Couche décision — Claude raisonne sur l'état du projet
// ---------------------------------------------------------------------------
function buildDecisionPrompt(
  project: { title: string; client_name: string; phase: string; objective?: string; blocker_flag?: boolean; blocker_reason?: string; due_date?: string },
  pendingTasks: Array<{ title: string }>,
  completedTasks: Array<{ title: string }>,
  history: Array<{ event_type: string; description: string; created_at: string }>,
): string {
  const overdue = project.due_date && new Date(project.due_date) < new Date();
  return `Tu es le Content Employee de CreatorFlow Market. Révision de ton portefeuille projets.

PROJET : ${project.title} | CLIENT : ${project.client_name} | PHASE : ${project.phase}
OBJECTIF : ${(project.objective || '').slice(0, 180)}
BLOCAGE : ${project.blocker_flag ? 'OUI — ' + project.blocker_reason : 'Non'} | RETARD : ${overdue ? 'OUI' : 'Non'}

MES TÂCHES EN ATTENTE (${pendingTasks.length}) :
${pendingTasks.slice(0, 3).map(t => `- ${t.title}`).join('\n') || 'Aucune'}

MES TÂCHES COMPLÉTÉES (${completedTasks.length}) :
${completedTasks.slice(0, 3).map(t => `- ${t.title}`).join('\n') || 'Aucune'}

DERNIERS ÉVÉNEMENTS :
${history.slice(0, 5).map(h => `[${h.created_at.slice(0, 10)}] ${h.event_type} — ${h.description.slice(0, 70)}`).join('\n') || 'Aucun'}

Tu es RESPONSABLE de ce projet jusqu'à la livraison de ton volet contenu. Décide.

[ACTION]
execute (tâche en attente à traiter) | initiate (créer + démarrer une tâche proactivement — seulement si aucune activité récente) | escalate (projet bloqué, alerter Marketing Director) | hold (tout est en ordre) | complete (ma contribution est terminée)

[REASON]
1-2 phrases.

[TASK_TITLE]
(si initiate uniquement — titre de la nouvelle tâche)

[TASK_DESCRIPTION]
(si initiate uniquement — brief de la tâche)

[RECOMMENDED_ACTION]
(si escalate uniquement — action pour Marketing Director)`;
}

function parseDecision(text: string): ProjectDecision {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const rawAction = extract('ACTION').split('\n')[0].trim().toLowerCase();
  const validActions = ['execute', 'initiate', 'escalate', 'hold', 'complete'];
  const action = (validActions.includes(rawAction) ? rawAction : 'hold') as ProjectDecision['action'];
  return {
    action,
    reason: extract('REASON') || 'Aucune raison fournie.',
    task_title: extract('TASK_TITLE') || undefined,
    task_description: extract('TASK_DESCRIPTION') || undefined,
    recommended_action: extract('RECOMMENDED_ACTION') || undefined,
  };
}

async function makeDecision(
  anthropicKey: string,
  project: { title: string; client_name: string; phase: string; objective?: string; blocker_flag?: boolean; blocker_reason?: string; due_date?: string },
  pendingTasks: Array<{ title: string }>,
  completedTasks: Array<{ title: string }>,
  history: Array<{ event_type: string; description: string; created_at: string }>,
): Promise<ProjectDecision> {
  const raw = await callClaude(anthropicKey, 'claude-haiku-4-5-20251001', 256, buildDecisionPrompt(project, pendingTasks, completedTasks, history));
  return parseDecision(raw);
}

// ---------------------------------------------------------------------------
// Couche exécution — produire le livrable de contenu
// ---------------------------------------------------------------------------
function buildProjectTaskPrompt(
  project: { title: string; client_name: string; objective?: string },
  task: { title: string; description?: string },
  kpis: Array<{ metric_name: string }>,
  isRevision = false,
  previousDeliverable = '',
  feedbackContext = '',
): string {
  const kpiList = kpis.length
    ? kpis.map(k => `- ${k.metric_name}`).join('\n')
    : '- Visibilité en ligne\n- Engagement audience\n- Génération de leads';
  const revisionBlock = isRevision
    ? `⚠ RÉVISION — Le client demande des améliorations.\nRetour client : ${(task.description || '').slice(0, 300)}\n\n${previousDeliverable ? `LIVRABLE PRÉCÉDENT (à améliorer) :\n${previousDeliverable.slice(0, 600)}\n\n` : ''}Produis une version SUBSTANTIELLEMENT AMÉLIORÉE. Ne répète pas le précédent.`
    : `Produis un livrable complet et prêt à publier. Tu es responsable du résultat.`;
  const feedbackBlock = feedbackContext
    ? `\n═══ RETOURS CLIENTS PASSÉS ═══\n${feedbackContext}\nTiens compte de ces retours pour améliorer ce livrable.\n`
    : '';
  return `Tu es le Content Employee de CreatorFlow Market. Tu es RESPONSABLE de ce projet client.

═══ PROJET CLIENT ═══
Client : ${project.client_name}
Projet : ${project.title}
Objectif : ${(project.objective || '').slice(0, 400)}

═══ TÂCHE ═══
${task.title}
${isRevision ? '' : (task.description || 'Produire du contenu marketing de qualité adapté au client.').slice(0, 700)}

═══ KPIs À AMÉLIORER ═══
${kpiList}
${feedbackBlock}
${revisionBlock}

[CONTENT_TYPE]
article_blog | script_youtube | posts_sociaux | newsletter | strategie_editoriale

[SUMMARY]
2-3 phrases sur ce que tu as produit et pourquoi adapté à CE client spécifiquement.

[MAIN_DELIVERABLE]
Le livrable complet et prêt à publier. Minimum 500 mots.
Article : Titre H1 + Accroche + 3 sections H2 + Conclusion + CTA
Script : Accroche (0-15s) + Corps (3 parties) + Outro + Description YouTube
Posts : 5 posts complets avec texte + hashtags + heure recommandée

[KEYWORDS]
6-8 mots-clés SEO ou hashtags les plus pertinents pour ce client.

[NEXT_IDEAS]
3 idées de contenu complémentaires pour les 2 prochaines semaines.`;
}

function parseDeliverable(text: string): ContentDeliverable {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const rawType = extract('CONTENT_TYPE') || 'article_blog';
  const content_type = rawType.replace(/\*\*/g, '').replace(/#+/g, '').replace(/---/g, '').split('\n')[0].trim().slice(0, 60);
  return {
    content_type: content_type || 'article_blog',
    summary: extract('SUMMARY') || text.slice(0, 300),
    main_deliverable: extract('MAIN_DELIVERABLE') || text,
    keywords: extract('KEYWORDS'),
    next_ideas: extract('NEXT_IDEAS'),
  };
}

function buildDeliveryEmailHtml(project: { title: string; client_name: string }, deliverable: ContentDeliverable, isRevision = false): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const preview = deliverable.main_deliverable.slice(0, 900);
  const kwTags = deliverable.keywords.split('\n').filter(k => k.trim()).slice(0, 7)
    .map(k => `<span style="display:inline-block;background:#0d0d2a;border:1px solid rgba(124,58,237,0.3);border-radius:99px;padding:3px 10px;font-size:11px;color:#A78BFA;margin:3px;">${k.trim()}</span>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo em{font-style:normal;color:#06B6D4;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);margin:14px 0;}
h2{font-size:18px;margin:4px 0;color:#BAE6FD;}.meta{font-size:12px;color:#9898B8;margin-bottom:16px;}
.s{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.sl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;}
.preview{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#7C3AED;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="logo">CreatorFlow <em>Content Employee</em></div>
<div class="badge">${isRevision ? '🔄 Révision livrée' : '✓ Livrable produit'} — ${deliverable.content_type.replace(/_/g, ' ')}</div>
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

async function sendEmailTo(apiKey: string, to: string, subject: string, html: string) {
  const safeSubject = subject.replace(/[\r\n\t]/g, ' ').trim();
  if (!apiKey || !to) return;
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: safeSubject, html }),
    });
  } catch (_) {}
}

async function getFeedbackContext(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
): Promise<string> {
  const { data: feedbacks } = await supabase
    .from('project_feedback')
    .select('score, comment, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!feedbacks?.length) return '';

  const avg = feedbacks.reduce((s: number, f: { score: number }) => s + f.score, 0) / feedbacks.length;
  const comments = feedbacks
    .filter((f: { comment?: string }) => f.comment?.trim())
    .slice(0, 3)
    .map((f: { score: number; comment: string }) => `• (${f.score}/3) ${f.comment.slice(0, 150)}`)
    .join('\n');

  if (avg >= 2.5 && !comments) return '';

  return `Score moyen client : ${avg.toFixed(1)}/3 (${feedbacks.length} évaluation${feedbacks.length > 1 ? 's' : ''})\n${comments}`;
}

function buildRevisionClientEmailHtml(project: { title: string; client_name: string }, deliverable: ContentDeliverable): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.w{max-width:600px;margin:0 auto;padding:28px 20px;}
.logo{font-size:16px;font-weight:800;padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo em{font-style:normal;color:#06B6D4;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(251,191,36,0.15);color:#FBBF24;border:1px solid rgba(251,191,36,0.3);margin:14px 0;}
h2{font-size:18px;margin:4px 0;color:#BAE6FD;}.meta{font-size:12px;color:#9898B8;margin-bottom:16px;}
.s{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.sl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;}
.prev{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#06B6D4;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.ft{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="w">
<div class="logo">CreatorFlow <em>Market</em></div>
<div class="badge">🔄 Votre révision est prête</div>
<h2>${project.client_name}</h2><div class="meta">${dateStr} · ${project.title.slice(0, 70)}</div>
<div class="s"><div class="sl">Ce qui a été amélioré</div><p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${deliverable.summary}</p></div>
<div class="s"><div class="sl">Livrable révisé — aperçu</div><div class="prev">${deliverable.main_deliverable.slice(0, 600)}${deliverable.main_deliverable.length > 600 ? '\n\n[... rapport complet disponible dans votre espace client]' : ''}</div></div>
<p style="text-align:center"><a href="https://creatorflowmarket.com/dashboard-client.html" class="btn">Voir le rapport complet →</a></p>
<div class="ft">CreatorFlow Market · Votre équipe IA</div>
</div></body></html>`;
}

async function executeTask(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  agent: { id: string },
  project: { id: string; title: string; client_name: string; client_email?: string; objective?: string; responsible_agent_id?: string },
  task: { id: string; title: string; description?: string },
): Promise<boolean> {
  try {
    const isRevision = task.title.startsWith('RÉVISION');

    // Charger le livrable précédent si c'est une révision
    let previousDeliverable = '';
    if (isRevision) {
      const { data: prevReports } = await supabase
        .from('agent_reports')
        .select('sections, content, created_at')
        .eq('agent_slug', AGENT_SLUG)
        .order('created_at', { ascending: false })
        .limit(10);
      const prevReport = prevReports?.find(r => r.content?.project_id === project.id);
      if (prevReport?.sections) {
        const mainSection = prevReport.sections.find((s: { heading: string; content: string }) =>
          s.heading.toLowerCase().includes('livrable') || s.heading.toLowerCase().includes('complet')
        );
        previousDeliverable = mainSection?.content?.slice(0, 700) || '';
      }
    }

    const { data: kpis } = await supabase.from('project_kpis').select('metric_name').eq('project_id', project.id).limit(5);
    const { data: mdAgent } = await supabase.from('ai_agents').select('id,name,slug').eq('id', project.responsible_agent_id || '').single();
    const feedbackContext = await getFeedbackContext(supabase, project.id);

    const raw = await callClaude(anthropicKey, 'claude-haiku-4-5-20251001', 2048,
      buildProjectTaskPrompt(project, task, kpis || [], isRevision, previousDeliverable, feedbackContext));
    const deliverable = parseDeliverable(raw);

    const { data: report } = await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `${isRevision ? 'Révision' : 'Livrable'} — ${project.client_name} : ${deliverable.content_type}`,
      sections: [
        { heading: 'Type de livrable', content: deliverable.content_type },
        { heading: 'Résumé', content: deliverable.summary },
        { heading: 'Livrable complet', content: deliverable.main_deliverable },
        { heading: 'Mots-clés', content: deliverable.keywords },
        { heading: 'Prochaines idées', content: deliverable.next_ideas },
      ],
      report_type: isRevision ? 'content_revision' : 'content_deliverable',
      content: { task_id: task.id, project_id: project.id, deliverable, is_revision: isRevision },
    }).select('id').single();

    await supabase.from('project_tasks').update({ status: 'completed', result: deliverable.summary.slice(0, 500) }).eq('id', task.id);

    await supabase.from('project_history').insert({
      project_id: project.id,
      event_type: isRevision ? 'revision_delivered' : 'content_delivered',
      old_value: { task_status: 'pending', task_title: task.title },
      new_value: { task_status: 'completed', content_type: deliverable.content_type, report_id: report?.id || null },
      actor_type: 'agent',
      actor_id: agent.id,
      note: `${isRevision ? 'Révision' : deliverable.content_type.replace(/_/g, ' ')} livré pour "${project.title.slice(0, 60)}"`,
    });

    await supabase.from('employee_handoffs').insert({
      from_agent: AGENT_SLUG,
      to_agent: mdAgent?.slug || 'marketing',
      handoff_type: isRevision ? 'revision_completed' : 'content_completed',
      payload: {
        task_id: task.id, project_id: project.id, project_title: project.title,
        client_name: project.client_name, content_type: deliverable.content_type,
        summary: deliverable.summary.slice(0, 300), report_id: report?.id || null,
      },
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    // Email CEO
    await sendEmail(resendKey,
      isRevision
        ? `🔄 Révision livrée — ${project.client_name}`
        : `📝 Contenu livré — ${project.client_name} (${deliverable.content_type.replace(/_/g, ' ')})`,
      buildDeliveryEmailHtml(project, deliverable, isRevision),
    );

    // Si révision : envoyer au client + clore la révision + fermer le projet
    if (isRevision) {
      if (project.client_email) {
        await sendEmailTo(resendKey, project.client_email,
          `🔄 Votre révision est prête — ${project.title.slice(0, 55)}`,
          buildRevisionClientEmailHtml(project, deliverable),
        );
      }
      await supabase.from('project_revisions')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('project_id', project.id)
        .eq('status', 'in_progress');
      await supabase.from('client_projects')
        .update({ status: 'completed', phase: 'completed', updated_at: new Date().toISOString() })
        .eq('id', project.id);
    }

    return true;
  } catch (err) {
    console.error('[content] executeTask error:', (err as Error).message);
    return false;
  }
}

async function escalateProject(
  supabase: ReturnType<typeof createClient>,
  agent: { id: string },
  project: { id: string; title: string; client_name: string },
  reason: string,
  recommendedAction: string,
): Promise<void> {
  await supabase.from('employee_handoffs').insert({
    from_agent: AGENT_SLUG,
    to_agent: 'marketing',
    handoff_type: 'escalation',
    payload: { project_id: project.id, project_title: project.title, client_name: project.client_name, reason, recommended_action: recommendedAction },
    status: 'pending',
  });
  await supabase.from('project_history').insert({
    project_id: project.id,
    event_type: 'escalation',
    actor_type: 'agent',
    actor_id: agent.id,
    description: `Content Employee a escaladé vers Marketing Director : ${reason}`,
    metadata: { reason, recommended_action: recommendedAction },
  });
}

// ---------------------------------------------------------------------------
// Portfolio review — cœur du modèle Project Ownership
// ---------------------------------------------------------------------------
async function reviewProjectPortfolio(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
): Promise<PortfolioResult> {
  const { data: agent } = await supabase.from('ai_agents').select('id,name').eq('slug', AGENT_SLUG).single();
  if (!agent) return { projects_reviewed: 0, actions_taken: 0, decisions: [] };

  // Trouver tous les projets actifs où ce département a des tâches
  const minus30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: taskRows } = await supabase
    .from('project_tasks')
    .select('id, project_id, title, description, status, created_at, updated_at')
    .eq('assigned_department', DEPARTMENT)
    .gte('created_at', minus30d)
    .order('created_at', { ascending: false });

  const projectIds = [...new Set((taskRows || []).map((t: { project_id: string }) => t.project_id))];
  if (!projectIds.length) return { projects_reviewed: 0, actions_taken: 0, decisions: [] };

  const { data: projects } = await supabase
    .from('client_projects')
    .select('id, title, client_name, client_email, phase, status, priority_score, objective, blocker_flag, blocker_reason, due_date, responsible_agent_id, updated_at')
    .in('id', projectIds)
    .eq('status', 'active')
    .order('priority_score', { ascending: false })
    .limit(3);

  const decisions: PortfolioResult['decisions'] = [];
  let actions_taken = 0;
  const minus24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  for (const project of (projects || [])) {
    try {
      const myTasks = (taskRows || []).filter((t: { project_id: string }) => t.project_id === project.id);
      const pendingTasks = myTasks.filter((t: { status: string }) => t.status === 'pending');
      const completedTasks = myTasks.filter((t: { status: string }) => t.status === 'completed');

      // Récupérer l'historique récent du projet
      const { data: history } = await supabase
        .from('project_history')
        .select('event_type, description, actor_type, created_at')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(6);

      let decision = await makeDecision(anthropicKey, project, pendingTasks, completedTasks, history || []);

      // Guard : pas d'initiate si activité dans les 24h
      if (decision.action === 'initiate') {
        const recentWork = completedTasks.some((t: { updated_at?: string; created_at: string }) =>
          (t.updated_at || t.created_at) > minus24h
        );
        if (recentWork) {
          decision = { action: 'hold', reason: 'Activité récente détectée dans les 24h — attente.' };
        }
      }

      // Exécuter la décision
      if (decision.action === 'execute' && pendingTasks.length > 0 && actions_taken < 2) {
        const success = await executeTask(supabase, anthropicKey, resendKey, agent, project, pendingTasks[0]);
        if (success) actions_taken++;
      } else if (decision.action === 'initiate' && pendingTasks.length === 0 && actions_taken < 2) {
        const { data: newTask } = await supabase.from('project_tasks').insert({
          project_id: project.id,
          assigned_department: DEPARTMENT,
          title: decision.task_title || `Initiative contenu — ${project.title.slice(0, 50)}`,
          description: decision.task_description || `Initiative autonome du Content Employee sur le projet ${project.title}.`,
          status: 'pending',
        }).select('id, title, description').single();
        if (newTask) {
          const success = await executeTask(supabase, anthropicKey, resendKey, agent, project, newTask);
          if (success) actions_taken++;
        }
      } else if (decision.action === 'escalate') {
        await escalateProject(supabase, agent, project, decision.reason, decision.recommended_action || '');
        actions_taken++;
      }

      // Tracer la décision dans l'historique (même si hold/complete)
      await supabase.from('project_history').insert({
        project_id: project.id,
        event_type: 'portfolio_review',
        actor_type: 'agent',
        actor_id: agent.id,
        description: `Content Employee — décision : ${decision.action}. ${decision.reason.slice(0, 100)}`,
        metadata: { action: decision.action, reason: decision.reason },
      });

      decisions.push({ project_id: project.id, project_title: project.title, action: decision.action, reason: decision.reason });
    } catch (err) {
      decisions.push({ project_id: project.id, project_title: project.title, action: 'error', reason: (err as Error).message });
    }
  }

  return { projects_reviewed: projects?.length || 0, actions_taken, decisions };
}

// ---------------------------------------------------------------------------
// Legacy — missions CEO via agent_missions (conservé)
// ---------------------------------------------------------------------------
function parseContentPlan(text: string): ContentPlan {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const analysis = extract('ANALYSIS');
  if (analysis) {
    return { analysis, editorial_calendar: extract('CALENDAR'), first_article: extract('FIRST_ARTICLE'), seo_keywords: extract('SEO_KEYWORDS'), next_steps: extract('NEXT_STEPS'), requires_ceo_validation: extract('VALIDATION').toLowerCase().includes('true') };
  }
  return { analysis: text.slice(0, 800), editorial_calendar: '', first_article: text, seo_keywords: '', next_steps: 'Voir rapport complet dans le CEO Cockpit.', requires_ceo_validation: false };
}

function buildContentMissionPrompt(mission: { title: string; objective: string }): string {
  return `Tu es le Content Employee de CreatorFlow Market. Mission reçue du CEO.

═══ MISSION ═══
Titre : ${mission.title}
Objectif : ${mission.objective}

[ANALYSIS]
Analyse du besoin en 3-4 phrases.

[CALENDAR]
Calendrier éditorial 4 semaines. Format : Semaine X — Jour : Titre | Format | Angle.

[SEO_KEYWORDS]
10 mots-clés prioritaires. Un par ligne.

[FIRST_ARTICLE]
Premier article COMPLET. Titre H1 + Introduction + 3 sections H2 + Conclusion + CTA. 600+ mots.

[NEXT_STEPS]
3 actions concrètes dans les 48h.

[VALIDATION]
false`;
}

function buildMissionEmailHtml(mission: { title: string; objective: string }, plan: ContentPlan, requiresValidation: boolean): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const calendarLines = plan.editorial_calendar.split('\n').filter(l => l.trim()).map(l => `<li style="margin-bottom:6px;font-size:13px;color:#D1D5DB;">${l}</li>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}.logo em{font-style:normal;color:#06B6D4;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:14px;}
.ok{background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);}
.warn{background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3);}
h2{font-size:18px;margin:0 0 4px;color:#BAE6FD;}.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.section{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.section-label{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}
ul{padding-left:18px;margin:0;}
.article-preview{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#06B6D4;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Content Employee</em></div></div>
<div class="badge ${requiresValidation ? 'warn' : 'ok'}">${requiresValidation ? '⚠ Validation CEO requise' : '✓ Mission prise en charge'}</div>
<h2>${mission.title}</h2><div class="meta">${dateStr} · Mission CEO</div>
<div class="section"><div class="section-label">Analyse</div><p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${plan.analysis}</p></div>
<div class="section"><div class="section-label">Calendrier éditorial</div><ul>${calendarLines || `<li>${plan.editorial_calendar}</li>`}</ul></div>
<div class="section"><div class="section-label">Mots-clés SEO</div><p style="margin:0;font-size:13px;color:#D1D5DB;">${plan.seo_keywords}</p></div>
<div class="section"><div class="section-label">Premier article</div><div class="article-preview">${plan.first_article.slice(0, 800)}${plan.first_article.length > 800 ? '\n\n[... voir rapport complet]' : ''}</div></div>
<div class="section"><div class="section-label">Prochaines étapes</div><p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;">${plan.next_steps}</p></div>
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir le rapport complet →</a></p>
<div class="footer">Content Employee IA · CreatorFlow Market</div>
</div></body></html>`;
}

async function executeMission(supabase: ReturnType<typeof createClient>, anthropicKey: string, resendKey: string, mission: { id: string; title: string; objective: string }): Promise<void> {
  const rawText = await callClaude(anthropicKey, 'claude-haiku-4-5-20251001', 2048, buildContentMissionPrompt(mission));
  const plan = parseContentPlan(rawText);

  await supabase.from('agent_outputs').insert({ mission_id: mission.id, output_type: 'content_plan', output_data: { title: `Plan Contenu — ${mission.title}`, analysis: plan.analysis, editorial_calendar: plan.editorial_calendar, first_article: plan.first_article, seo_keywords: plan.seo_keywords, next_steps: plan.next_steps }, status: 'completed' });

  const { data: report } = await supabase.from('agent_reports').insert({ agent_slug: AGENT_SLUG, title: `Plan Contenu — ${mission.title}`, sections: [{ heading: 'Analyse', content: plan.analysis }, { heading: 'Calendrier éditorial', content: plan.editorial_calendar }, { heading: 'Mots-clés SEO', content: plan.seo_keywords }, { heading: 'Premier article', content: plan.first_article }, { heading: 'Prochaines étapes', content: plan.next_steps }], report_type: 'content_plan', content: { mission_id: mission.id, plan } }).select('id').single();

  await supabase.from('agent_actions_log').insert({ mission_id: mission.id, agent_slug: AGENT_SLUG, action_type: 'content_mission', action_data: { objective: mission.objective.slice(0, 300), plan_preview: plan.analysis.slice(0, 300), report_id: report?.id || null }, input: { mission_id: mission.id, title: mission.title } });
  await supabase.from('agent_missions').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', mission.id);

  if (plan.requires_ceo_validation) {
    await supabase.from('pending_approvals').insert({ type: 'content_plan', data: { mission_id: mission.id, mission_title: mission.title, plan_summary: plan.editorial_calendar.slice(0, 500), report_id: report?.id || null, asked_by: AGENT_SLUG }, status: 'pending' });
  }

  await sendEmail(resendKey, plan.requires_ceo_validation ? `⚠ Validation requise — Content : ${mission.title.slice(0, 55)}` : `📝 Plan Contenu prêt — ${mission.title.slice(0, 55)}`, buildMissionEmailHtml(mission, plan, plan.requires_ceo_validation));
}

async function processMissions(supabase: ReturnType<typeof createClient>, anthropicKey: string, resendKey: string): Promise<{ missions_processed: number }> {
  const { data: agent } = await supabase.from('ai_agents').select('id').eq('slug', AGENT_SLUG).single();
  if (!agent) return { missions_processed: 0 };

  const { data: missions } = await supabase.from('agent_missions').select('id, title, objective, status, created_at').eq('agent_id', agent.id).eq('status', 'assigned').order('created_at', { ascending: true }).limit(2);
  if (!missions?.length) return { missions_processed: 0 };

  for (const mission of missions) {
    try { await executeMission(supabase, anthropicKey, resendKey, mission); }
    catch (err) { await supabase.from('agent_actions_log').insert({ mission_id: mission.id, agent_slug: AGENT_SLUG, action_type: 'mission_error', action_data: { error: (err as Error).message }, input: { mission_id: mission.id } }).catch(() => {}); }
  }

  return { missions_processed: missions.length };
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
    if (runType === 'mission') {
      const r = await processMissions(supabase, anthropicKey, resendKey);
      return new Response(JSON.stringify({ ok: true, run_type: 'mission', ...r, duration_ms: Date.now() - startTime }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Heartbeat quotidien — Project Ownership
    const portfolio = await reviewProjectPortfolio(supabase, anthropicKey, resendKey);

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG,
      run_type: 'daily',
      status: portfolio.actions_taken > 0 ? 'tasks_processed' : 'ok',
      kpis_snapshot: { projects_reviewed: portfolio.projects_reviewed, actions_taken: portfolio.actions_taken, decisions: portfolio.decisions.map(d => ({ project: d.project_title.slice(0, 40), action: d.action })) },
      alerts_triggered: portfolio.decisions.filter(d => d.action === 'escalate').map(d => ({ type: 'escalation', message: d.reason })),
      duration_ms: Date.now() - startTime,
    });

    await supabase.from('ai_agents').update({ last_active: new Date().toISOString() }).eq('slug', AGENT_SLUG);

    return new Response(JSON.stringify({
      ok: true,
      run_type: 'daily',
      projects_reviewed: portfolio.projects_reviewed,
      actions_taken: portfolio.actions_taken,
      decisions: portfolio.decisions,
      duration_ms: Date.now() - startTime,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
