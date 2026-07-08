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
const AGENT_SLUG = 'prospecting';
const DEPARTMENT = 'prospecting';
const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Prospecting Employee IA <noreply@creatorflowmarket.com>';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ProspectingDeliverable {
  prospecting_type: string;
  summary: string;
  main_deliverable: string;
  target_profile: string;
  keywords: string;
  next_actions: string;
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

interface ProspectingPlan {
  analysis: string;
  icp: string;
  prospect_list: string;
  outreach_sequence: string;
  qualification_criteria: string;
  next_steps: string;
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
// Couche décision
// ---------------------------------------------------------------------------
function buildDecisionPrompt(
  project: { title: string; client_name: string; phase: string; objective?: string; blocker_flag?: boolean; blocker_reason?: string; due_date?: string },
  pendingTasks: Array<{ title: string }>,
  completedTasks: Array<{ title: string }>,
  history: Array<{ event_type: string; description: string; created_at: string }>,
): string {
  const overdue = project.due_date && new Date(project.due_date) < new Date();
  return `Tu es le Prospecting Employee de CreatorFlow Market, expert en acquisition et développement commercial. Révision de ton portefeuille.

PROJET : ${project.title} | CLIENT : ${project.client_name} | PHASE : ${project.phase}
OBJECTIF : ${(project.objective || '').slice(0, 180)}
BLOCAGE : ${project.blocker_flag ? 'OUI — ' + project.blocker_reason : 'Non'} | RETARD : ${overdue ? 'OUI' : 'Non'}

MES TÂCHES EN ATTENTE (${pendingTasks.length}) :
${pendingTasks.slice(0, 3).map(t => `- ${t.title}`).join('\n') || 'Aucune'}

MES TÂCHES COMPLÉTÉES (${completedTasks.length}) :
${completedTasks.slice(0, 3).map(t => `- ${t.title}`).join('\n') || 'Aucune'}

DERNIERS ÉVÉNEMENTS :
${history.slice(0, 5).map(h => `[${h.created_at.slice(0, 10)}] ${h.event_type} — ${h.description.slice(0, 70)}`).join('\n') || 'Aucun'}

Tu es RESPONSABLE du volet prospection de ce projet. Décide.

[ACTION]
execute (tâche en attente à traiter) | initiate (créer + démarrer une tâche proactivement — seulement si aucune activité récente) | escalate (projet bloqué, alerter Marketing Director) | hold (tout est en ordre) | complete (ma contribution prospection est terminée)

[REASON]
1-2 phrases.

[TASK_TITLE]
(si initiate uniquement)

[TASK_DESCRIPTION]
(si initiate uniquement)

[RECOMMENDED_ACTION]
(si escalate uniquement)`;
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
// Couche exécution
// ---------------------------------------------------------------------------
function buildProjectTaskPrompt(
  project: { title: string; client_name: string; objective?: string },
  task: { title: string; description?: string },
  isRevision = false,
  previousDeliverable = '',
  feedbackContext = '',
  clientMemory = '',
  peerContext = '',
): string {
  const revisionBlock = isRevision
    ? `⚠ RÉVISION — Le client demande des améliorations.\nRetour client : ${(task.description || '').slice(0, 300)}\n\n${previousDeliverable ? `LIVRABLE PRÉCÉDENT (à améliorer) :\n${previousDeliverable.slice(0, 600)}\n\n` : ''}Produis une version SUBSTANTIELLEMENT AMÉLIORÉE. Ne répète pas le précédent.`
    : `Produis un livrable de prospection complet et actionnable. Tu es responsable du résultat.`;
  const feedbackBlock = feedbackContext
    ? `\n═══ RETOURS CLIENTS PASSÉS ═══\n${feedbackContext}\nTiens compte de ces retours pour améliorer ce livrable.\n`
    : '';
  const memoryBlock = clientMemory
    ? `\n═══ PROFIL CLIENT — HISTORIQUE ═══\n${clientMemory}\n`
    : '';
  const peerBlock = peerContext
    ? `\n═══ CE QUE TES COLLÈGUES ONT DÉJÀ PRODUIT ═══\n${peerContext}\nAligne ta prospection avec le contenu et le support déjà livrés.\n`
    : '';
  return `Tu es le Prospecting Employee de CreatorFlow Market. Tu es RESPONSABLE du volet acquisition de ce projet client.

═══ PROJET CLIENT ═══
Client : ${project.client_name}
Projet : ${project.title}
Objectif : ${(project.objective || '').slice(0, 400)}
${memoryBlock}
═══ TÂCHE PROSPECTION ═══
${task.title}
${isRevision ? '' : (task.description || 'Développer une stratégie d\'acquisition adaptée à ce client.').slice(0, 700)}
${peerBlock}${feedbackBlock}
${revisionBlock}

[PROSPECTING_TYPE]
icp_definition | prospect_list | outreach_sequence | linkedin_strategy | email_campaign | market_analysis | lead_scoring | partnership_strategy

[SUMMARY]
2-3 phrases sur ce que tu as produit et pourquoi adapté à CE client.

[MAIN_DELIVERABLE]
Le livrable complet et prêt à utiliser.
ICP : Profil idéal + Pain points + Signaux d'achat + Canaux préférés
Prospect list : 15-20 prospects qualifiés avec entreprise / poste / LinkedIn / raison de cibler
Sequence outreach : Message 1 (J0) + Relance 1 (J3) + Relance 2 (J7) + Message final (J14)
Stratégie : Approche complète + Canaux + Timeline 30 jours + KPIs cibles

[TARGET_PROFILE]
Description précise du client idéal à cibler pour CE projet.

[KEYWORDS]
6-8 termes de recherche LinkedIn/Google pour trouver des prospects.

[NEXT_ACTIONS]
3 actions concrètes à lancer dans les 48h pour ce client.`;
}

function parseProspectingDeliverable(text: string): ProspectingDeliverable {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const rawType = extract('PROSPECTING_TYPE') || 'prospect_list';
  const prospecting_type = rawType.replace(/\*\*/g, '').replace(/#+/g, '').replace(/---/g, '').split('\n')[0].trim().slice(0, 60);
  return {
    prospecting_type: prospecting_type || 'prospect_list',
    summary: extract('SUMMARY') || text.slice(0, 300),
    main_deliverable: extract('MAIN_DELIVERABLE') || text,
    target_profile: extract('TARGET_PROFILE'),
    keywords: extract('KEYWORDS'),
    next_actions: extract('NEXT_ACTIONS'),
  };
}

function buildDeliveryEmailHtml(project: { title: string; client_name: string }, deliverable: ProspectingDeliverable, isRevision = false): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const preview = deliverable.main_deliverable.slice(0, 900);
  const kwTags = deliverable.keywords.split('\n').filter(k => k.trim()).slice(0, 7)
    .map(k => `<span style="display:inline-block;background:#0d0d2a;border:1px solid rgba(59,130,246,0.3);border-radius:99px;padding:3px 10px;font-size:11px;color:#93C5FD;margin:3px;">${k.trim()}</span>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo em{font-style:normal;color:#3B82F6;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);margin:14px 0;}
h2{font-size:18px;margin:4px 0;color:#BAE6FD;}.meta{font-size:12px;color:#9898B8;margin-bottom:16px;}
.s{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.sl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;}
.preview{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#3B82F6;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="logo">CreatorFlow <em>Prospecting Employee</em></div>
<div class="badge">${isRevision ? '🔄 Révision livrée' : '✓ Livrable produit'} — ${deliverable.prospecting_type.replace(/_/g, ' ')}</div>
<h2>${project.client_name}</h2>
<div class="meta">${dateStr} · ${project.title.slice(0, 70)}</div>
<div class="s"><div class="sl">Résumé</div><p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${deliverable.summary}</p></div>
${deliverable.target_profile ? `<div class="s"><div class="sl">Profil cible</div><p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${deliverable.target_profile}</p></div>` : ''}
<div class="s"><div class="sl">Livrable — aperçu</div><div class="preview">${preview}${deliverable.main_deliverable.length > 900 ? '\n\n[... voir rapport complet dans le CEO Cockpit]' : ''}</div></div>
${kwTags ? `<div class="s"><div class="sl">Termes de recherche</div><div style="margin-top:4px;">${kwTags}</div></div>` : ''}
${deliverable.next_actions ? `<div class="s"><div class="sl">Prochaines actions — 48h</div><p style="margin:0;font-size:13px;color:#D1D5DB;white-space:pre-wrap;line-height:1.7;">${deliverable.next_actions}</p></div>` : ''}
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir le Cockpit Projets →</a></p>
<div class="footer">Prospecting Employee IA · CreatorFlow Market · Livraison automatique</div>
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

async function getPeerDeliverables(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
): Promise<string> {
  const peerSlugs = ['content', 'support'];
  const { data: reports } = await supabase
    .from('agent_reports')
    .select('agent_slug, title, sections, content, created_at')
    .in('agent_slug', peerSlugs)
    .order('created_at', { ascending: false })
    .limit(20);

  const relevant = (reports || [])
    .filter(r => r.content?.project_id === projectId)
    .slice(0, 4);

  if (!relevant.length) return '';

  return relevant.map(r => {
    const summary = r.sections?.find((s: { heading: string }) => s.heading === 'Résumé');
    const main = r.sections?.find((s: { heading: string }) =>
      s.heading.toLowerCase().includes('livrable') || s.heading.toLowerCase().includes('profil') || s.heading.toLowerCase().includes('complet')
    );
    const preview = (summary?.content || main?.content || '').slice(0, 250);
    return `[${r.agent_slug.toUpperCase()} EMPLOYEE — ${r.title.slice(0, 60)}]\n${preview}`;
  }).join('\n\n');
}

async function getClientMemory(
  supabase: ReturnType<typeof createClient>,
  clientEmail: string,
): Promise<string> {
  if (!clientEmail) return '';
  const { data } = await supabase
    .from('client_memory')
    .select('memory, projects_count')
    .eq('client_email', clientEmail)
    .eq('department', DEPARTMENT)
    .maybeSingle();
  if (!data) return '';
  return `Client récurrent (${data.projects_count} projet${data.projects_count > 1 ? 's' : ''} passé${data.projects_count > 1 ? 's' : ''}) :\n${data.memory}`;
}

async function updateClientMemory(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  clientEmail: string,
  clientName: string,
  project: { title: string; objective?: string },
  deliverableSummary: string,
  deliverableType: string,
  feedbackContext: string,
): Promise<void> {
  if (!clientEmail) return;
  const { data: existing } = await supabase
    .from('client_memory')
    .select('memory, projects_count')
    .eq('client_email', clientEmail)
    .eq('department', DEPARTMENT)
    .maybeSingle();

  const prompt = `Tu es le Prospecting Employee de CreatorFlow Market. Synthétise ce que tu sais sur ce client pour t'en souvenir lors du prochain projet.

CLIENT : ${clientName}
PROJET LIVRÉ : ${project.title}
LIVRABLE : ${deliverableType} — ${deliverableSummary.slice(0, 300)}
${feedbackContext ? `RETOUR CLIENT : ${feedbackContext}` : ''}
${existing?.memory ? `CE QUE TU SAVAIS DÉJÀ :\n${existing.memory}` : '(Premier projet avec ce client)'}

Synthétise en 6-8 points bullet le profil de ce client :
- Secteur et type d'entreprise ciblée
- Canaux de prospection les plus efficaces pour lui
- Profil de prospect idéal validé
- Ce qui a bien fonctionné dans la stratégie
- Erreurs ou approches à éviter
- Niveau de maturité commerciale du client
- Recommandations pour le prochain projet`;

  try {
    const memory = await callClaude(anthropicKey, 'claude-haiku-4-5-20251001', 256, prompt);
    await supabase.from('client_memory').upsert({
      client_email: clientEmail,
      department: DEPARTMENT,
      memory: memory.slice(0, 2000),
      projects_count: (existing?.projects_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_email,department' });
  } catch (_) {}
}

function buildRevisionClientEmailHtml(project: { title: string; client_name: string }, deliverable: ProspectingDeliverable): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.w{max-width:600px;margin:0 auto;padding:28px 20px;}
.logo{font-size:16px;font-weight:800;padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo em{font-style:normal;color:#3B82F6;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(251,191,36,0.15);color:#FBBF24;border:1px solid rgba(251,191,36,0.3);margin:14px 0;}
h2{font-size:18px;margin:4px 0;color:#BAE6FD;}.meta{font-size:12px;color:#9898B8;margin-bottom:16px;}
.s{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.sl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;}
.prev{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#3B82F6;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
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

    const { data: mdAgent } = await supabase.from('ai_agents').select('id,name,slug').eq('id', project.responsible_agent_id || '').single();
    const feedbackContext = await getFeedbackContext(supabase, project.id);
    const clientMemory = await getClientMemory(supabase, project.client_email || '');
    const peerContext = await getPeerDeliverables(supabase, project.id);

    const raw = await callClaude(anthropicKey, 'claude-haiku-4-5-20251001', 2048,
      buildProjectTaskPrompt(project, task, isRevision, previousDeliverable, feedbackContext, clientMemory, peerContext));
    const deliverable = parseProspectingDeliverable(raw);

    const { data: report } = await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `${isRevision ? 'Révision' : 'Livrable'} Prospection — ${project.client_name} : ${deliverable.prospecting_type}`,
      sections: [
        { heading: 'Type de livrable', content: deliverable.prospecting_type },
        { heading: 'Résumé', content: deliverable.summary },
        { heading: 'Profil cible', content: deliverable.target_profile },
        { heading: 'Livrable complet', content: deliverable.main_deliverable },
        { heading: 'Termes de recherche', content: deliverable.keywords },
        { heading: 'Prochaines actions', content: deliverable.next_actions },
      ],
      report_type: isRevision ? 'prospecting_revision' : 'prospecting_deliverable',
      content: { task_id: task.id, project_id: project.id, deliverable, is_revision: isRevision },
    }).select('id').single();

    await supabase.from('project_tasks').update({ status: 'completed', result: deliverable.summary.slice(0, 500) }).eq('id', task.id);

    await supabase.from('project_history').insert({
      project_id: project.id,
      event_type: isRevision ? 'revision_delivered' : 'prospecting_delivered',
      old_value: { task_status: 'pending', task_title: task.title },
      new_value: { task_status: 'completed', prospecting_type: deliverable.prospecting_type, report_id: report?.id || null },
      actor_type: 'agent',
      actor_id: agent.id,
      note: `${isRevision ? 'Révision prospection' : deliverable.prospecting_type.replace(/_/g, ' ')} livré pour "${project.title.slice(0, 60)}"`,
    });

    await supabase.from('employee_handoffs').insert({
      from_agent: AGENT_SLUG,
      to_agent: mdAgent?.slug || 'marketing',
      handoff_type: isRevision ? 'revision_completed' : 'prospecting_completed',
      payload: {
        task_id: task.id, project_id: project.id, project_title: project.title,
        client_name: project.client_name, prospecting_type: deliverable.prospecting_type,
        summary: deliverable.summary.slice(0, 300), report_id: report?.id || null,
      },
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    await sendEmail(resendKey,
      isRevision
        ? `🔄 Révision livrée — ${project.client_name}`
        : `🎯 Prospection livrée — ${project.client_name} (${deliverable.prospecting_type.replace(/_/g, ' ')})`,
      buildDeliveryEmailHtml(project, deliverable, isRevision),
    );

    // Apprentissage — mémoriser ce client pour les prochains projets
    if (!isRevision && project.client_email) {
      await updateClientMemory(
        supabase, anthropicKey,
        project.client_email, project.client_name,
        project, deliverable.summary, deliverable.prospecting_type, feedbackContext,
      );
    }

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
    console.error('[prospecting] executeTask error:', (err as Error).message);
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
    description: `Prospecting Employee a escaladé vers Marketing Director : ${reason}`,
    metadata: { reason, recommended_action: recommendedAction },
  });
}

// ---------------------------------------------------------------------------
// Portfolio review — Project Ownership
// ---------------------------------------------------------------------------
async function reviewProjectPortfolio(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
): Promise<PortfolioResult> {
  const { data: agent } = await supabase.from('ai_agents').select('id,name').eq('slug', AGENT_SLUG).single();
  if (!agent) return { projects_reviewed: 0, actions_taken: 0, decisions: [] };

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

      const { data: history } = await supabase
        .from('project_history')
        .select('event_type, description, actor_type, created_at')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(6);

      let decision = await makeDecision(anthropicKey, project, pendingTasks, completedTasks, history || []);

      if (decision.action === 'initiate') {
        const recentWork = completedTasks.some((t: { updated_at?: string; created_at: string }) =>
          (t.updated_at || t.created_at) > minus24h
        );
        if (recentWork) {
          decision = { action: 'hold', reason: 'Activité récente détectée dans les 24h — attente.' };
        }
      }

      if (decision.action === 'execute' && pendingTasks.length > 0 && actions_taken < 2) {
        const success = await executeTask(supabase, anthropicKey, resendKey, agent, project, pendingTasks[0]);
        if (success) actions_taken++;
      } else if (decision.action === 'initiate' && pendingTasks.length === 0 && actions_taken < 2) {
        const { data: newTask } = await supabase.from('project_tasks').insert({
          project_id: project.id,
          assigned_department: DEPARTMENT,
          title: decision.task_title || `Initiative prospection — ${project.title.slice(0, 50)}`,
          description: decision.task_description || `Initiative autonome du Prospecting Employee sur le projet ${project.title}.`,
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

      await supabase.from('project_history').insert({
        project_id: project.id,
        event_type: 'portfolio_review',
        actor_type: 'agent',
        actor_id: agent.id,
        description: `Prospecting Employee — décision : ${decision.action}. ${decision.reason.slice(0, 100)}`,
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
// Legacy — missions CEO (conservé)
// ---------------------------------------------------------------------------
function parseProspectingPlan(text: string): ProspectingPlan {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const analysis = extract('ANALYSIS');
  if (analysis) {
    return { analysis, icp: extract('ICP'), prospect_list: extract('PROSPECT_LIST'), outreach_sequence: extract('OUTREACH'), qualification_criteria: extract('QUALIFICATION'), next_steps: extract('NEXT_STEPS') };
  }
  return { analysis: text.slice(0, 800), icp: '', prospect_list: text, outreach_sequence: '', qualification_criteria: '', next_steps: 'Voir rapport complet dans le CEO Cockpit.' };
}

function buildProspectingMissionPrompt(mission: { title: string; objective: string }): string {
  return `Tu es le Prospecting Employee de CreatorFlow Market. Mission CEO reçue.

═══ MISSION ═══
Titre : ${mission.title}
Objectif : ${mission.objective}

[ANALYSIS]
Analyse du besoin acquisition en 3-4 phrases.

[ICP]
Profil idéal client : secteur + taille + poste décideur + pain points + canaux préférés.

[PROSPECT_LIST]
15 prospects qualifiés : Prénom Nom | Poste | Entreprise | Secteur | Raison de cibler | Source LinkedIn/Google

[OUTREACH]
Séquence de 4 messages (J0, J3, J7, J14). Format : JOUR : Sujet | Corps complet.

[QUALIFICATION]
5 critères de qualification. Format : Critère | Signaux positifs | Signaux négatifs.

[NEXT_STEPS]
3 actions dans les 48h.`;
}

function buildMissionEmailHtml(mission: { title: string }, plan: ProspectingPlan): string {
  const dateStr = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.wrap{max-width:600px;margin:0 auto;padding:28px 20px;}
.header{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}.logo em{font-style:normal;color:#3B82F6;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(52,211,153,0.15);color:#34D399;border:1px solid rgba(52,211,153,0.3);margin:14px 0;}
h2{font-size:18px;margin:4px 0;color:#BAE6FD;}.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.s{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.sl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;}
.prev{font-size:12px;color:#A1A1C8;white-space:pre-wrap;line-height:1.7;font-family:monospace;}
.btn{display:inline-block;background:#3B82F6;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.footer{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
<div class="header"><div class="logo">CreatorFlow <em>Prospecting Employee</em></div></div>
<div class="badge">✓ Mission prise en charge</div>
<h2>${mission.title}</h2><div class="meta">${dateStr} · Mission CEO</div>
<div class="s"><div class="sl">Analyse</div><p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${plan.analysis}</p></div>
<div class="s"><div class="sl">ICP — Profil idéal</div><p style="margin:0;font-size:13px;color:#D1D5DB;line-height:1.6;">${plan.icp}</p></div>
<div class="s"><div class="sl">Prospects (aperçu)</div><div class="prev">${plan.prospect_list.slice(0, 700)}${plan.prospect_list.length > 700 ? '\n[... voir rapport complet]' : ''}</div></div>
<div class="s"><div class="sl">Séquence outreach</div><div class="prev">${plan.outreach_sequence.slice(0, 600)}${plan.outreach_sequence.length > 600 ? '\n[...]' : ''}</div></div>
<div class="s"><div class="sl">Prochaines étapes</div><p style="margin:0;font-size:13px;color:#D1D5DB;white-space:pre-wrap;line-height:1.7;">${plan.next_steps}</p></div>
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir le rapport complet →</a></p>
<div class="footer">Prospecting Employee IA · CreatorFlow Market</div>
</div></body></html>`;
}

async function executeMission(supabase: ReturnType<typeof createClient>, anthropicKey: string, resendKey: string, mission: { id: string; title: string; objective: string }): Promise<void> {
  const rawText = await callClaude(anthropicKey, 'claude-haiku-4-5-20251001', 2048, buildProspectingMissionPrompt(mission));
  const plan = parseProspectingPlan(rawText);

  await supabase.from('agent_outputs').insert({ mission_id: mission.id, output_type: 'prospecting_plan', output_data: { title: `Plan Prospection — ${mission.title}`, analysis: plan.analysis, icp: plan.icp, prospect_list: plan.prospect_list, outreach_sequence: plan.outreach_sequence, qualification_criteria: plan.qualification_criteria, next_steps: plan.next_steps }, status: 'completed' });

  const { data: report } = await supabase.from('agent_reports').insert({ agent_slug: AGENT_SLUG, title: `Plan Prospection — ${mission.title}`, sections: [{ heading: 'Analyse', content: plan.analysis }, { heading: 'ICP', content: plan.icp }, { heading: 'Prospects', content: plan.prospect_list }, { heading: 'Séquence outreach', content: plan.outreach_sequence }, { heading: 'Critères de qualification', content: plan.qualification_criteria }, { heading: 'Prochaines étapes', content: plan.next_steps }], report_type: 'prospecting_plan', content: { mission_id: mission.id, plan } }).select('id').single();

  await supabase.from('agent_actions_log').insert({ mission_id: mission.id, agent_slug: AGENT_SLUG, action_type: 'prospecting_mission', action_data: { objective: mission.objective.slice(0, 300), plan_preview: plan.analysis.slice(0, 300), report_id: report?.id || null }, input: { mission_id: mission.id, title: mission.title } });
  await supabase.from('agent_missions').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', mission.id);

  await sendEmail(resendKey, `🎯 Plan Prospection prêt — ${mission.title.slice(0, 55)}`, buildMissionEmailHtml(mission, plan));
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
