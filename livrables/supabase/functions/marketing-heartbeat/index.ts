import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

async function callClaude(apiKey: string, maxTokens: number, prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
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
const AGENT_SLUG = 'marketing';
const RESEND_URL = 'https://api.resend.com/emails';
const FROM_CEO = 'Marketing Director IA <noreply@creatorflowmarket.com>';
const FROM_CLIENT = 'CreatorFlow Market <noreply@creatorflowmarket.com>';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Agent { id: string; name: string; slug: string; current_projects: number; max_projects: number; }
interface ClientProject {
  id: string; brief_id: string; client_id: string; client_email: string; client_name: string;
  department_id: string; responsible_agent_id: string; title: string; objective: string;
  phase: string; priority_score: number; status: string; baseline_kpis: Record<string, unknown>;
  due_date: string; created_at: string; updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extract(text: string, tag: string): string {
  const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`));
  return m ? m[1].trim() : '';
}

async function getAvailableAgent(supabase: ReturnType<typeof createClient>): Promise<Agent | null> {
  const { data: dept } = await supabase.from('departments').select('id').eq('slug', AGENT_SLUG).single();
  if (!dept) return null;
  const { data: agents } = await supabase
    .from('ai_agents').select('id, name, slug, current_projects, max_projects')
    .eq('department_id', dept.id).eq('status', 'active').neq('availability', 'unavailable')
    .order('current_projects', { ascending: true }).limit(5);
  return (agents as Agent[])?.find(a => a.current_projects < (a.max_projects || 5)) ?? null;
}

async function getClientInfo(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ email: string; name: string }> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const email = data?.user?.email ?? '';
    const name = data?.user?.user_metadata?.full_name ?? email.split('@')[0] ?? 'Client';
    return { email, name };
  } catch (_) {
    return { email: '', name: 'Client' };
  }
}

async function sendToClient(
  resendKey: string, to: string, subject: string, html: string,
  projectId: string, phase: string, agentId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  if (!resendKey || !to) return;
  const safe = subject.replace(/[\r\n\t]/g, ' ').trim();
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_CLIENT, to: [to], subject: safe, html }),
    });
    await supabase.from('client_communications').insert({
      project_id: projectId, direction: 'outbound', phase,
      subject: safe, content_preview: html.replace(/<[^>]*>/g, '').slice(0, 300),
      sent_by_agent_id: agentId,
    });
  } catch (_) { /* silencieux */ }
}

async function sendToCEO(resendKey: string, subject: string, html: string): Promise<void> {
  if (!resendKey) return;
  const safe = subject.replace(/[\r\n\t]/g, ' ').trim();
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_CEO, to: [CEO_EMAIL], subject: safe, html }),
    });
  } catch (_) { /* silencieux */ }
}

async function recalcAgentLoad(supabase: ReturnType<typeof createClient>, agentId: string): Promise<void> {
  const { count } = await supabase.from('client_projects')
    .select('*', { count: 'exact', head: true })
    .eq('responsible_agent_id', agentId).eq('status', 'active');
  const n = count || 0;
  await supabase.from('ai_agents').update({
    current_projects: n,
    availability: n >= 5 ? 'overloaded' : 'available',
  }).eq('id', agentId);
}

async function writeHistory(
  supabase: ReturnType<typeof createClient>,
  projectId: string, eventType: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  actorId: string, note?: string
): Promise<void> {
  await supabase.from('project_history').insert({
    project_id: projectId, event_type: eventType,
    old_value: oldValue, new_value: newValue,
    actor_type: 'agent', actor_id: actorId,
    note: note ?? null,
  });
}

async function createInitialMilestones(
  supabase: ReturnType<typeof createClient>,
  projectId: string, departmentId: string
): Promise<void> {
  const now = new Date();
  const d = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
  await supabase.from('project_milestones').insert([
    { project_id: projectId, title: 'Audit de la situation',  due_date: d(24),      status: 'pending', owner_department_id: departmentId },
    { project_id: projectId, title: 'Stratégie 90 jours',    due_date: d(48),      status: 'pending', owner_department_id: departmentId },
    { project_id: projectId, title: 'Livraison finale',      due_date: d(30 * 24), status: 'pending', owner_department_id: departmentId },
  ]);
}

async function completeMilestone(
  supabase: ReturnType<typeof createClient>,
  projectId: string, title: string
): Promise<void> {
  await supabase.from('project_milestones')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('project_id', projectId).eq('title', title);
}

async function writeProjectKpis(
  supabase: ReturnType<typeof createClient>,
  projectId: string, baselineText: string
): Promise<void> {
  const lines = baselineText.split('\n').filter(l => l.trim().length > 3).slice(0, 5);
  if (!lines.length) return;
  await supabase.from('project_kpis').insert(
    lines.map(line => {
      const parts = line.split('—').map(p => p.trim());
      return { project_id: projectId, metric_name: parts[0] || line.slice(0, 80) };
    })
  );
}

// ---------------------------------------------------------------------------
// Phase 1 — INTAKE: nouveau brief → projet + email client
// ---------------------------------------------------------------------------
async function handleIntake(
  supabase: ReturnType<typeof createClient>,
  resendKey: string,
  brief: { id: string; description: string; user_id: string }
): Promise<string | null> {
  const agent = await getAvailableAgent(supabase);
  if (!agent) {
    await sendToCEO(resendKey,
      '⚠ Aucun Marketing Employee disponible',
      ceoBuildAlert('Aucun Marketing Employee disponible. Le brief ne peut pas être assigné automatiquement.', brief.description)
    );
    return null;
  }

  const { data: dept } = await supabase.from('departments').select('id').eq('slug', AGENT_SLUG).single();
  const { email: clientEmail, name: clientName } = await getClientInfo(supabase, brief.user_id);
  const title = (brief.description || '').slice(0, 100);

  const { data: project } = await supabase.from('client_projects').insert({
    brief_id: brief.id,
    client_id: brief.user_id,
    client_email: clientEmail,
    client_name: clientName,
    department_id: dept?.id,
    responsible_agent_id: agent.id,
    title,
    objective: brief.description,
    phase: 'intake',
    priority_score: 50,
    status: 'active',
  }).select('id').single();

  if (!project) return null;

  await supabase.from('ai_agents')
    .update({ current_projects: (agent.current_projects || 0) + 1 })
    .eq('id', agent.id);

  await supabase.from('briefs')
    .update({ statut: 'in_progress', project_id: project.id })
    .eq('id', brief.id);

  await writeHistory(supabase, project.id, 'phase_change', null,
    { phase: 'intake', agent: agent.name, client: clientName },
    agent.id, 'Brief ramassé automatiquement'
  );
  if (dept?.id) await createInitialMilestones(supabase, project.id, dept.id);

  if (clientEmail) {
    await sendToClient(resendKey, clientEmail,
      `Votre projet est pris en charge — ${title.slice(0, 50)}`,
      clientBuildIntake(clientName, brief.description, project.id),
      project.id, 'intake', agent.id, supabase
    );
  }

  await sendToCEO(resendKey,
    `📋 Nouveau projet — ${title.slice(0, 60)}`,
    ceoBuildNewProject(project.id, brief.description, clientName, clientEmail, agent.name)
  );

  return project.id;
}

// ---------------------------------------------------------------------------
// Phase 2 — AUDIT: analyse du brief → email client
// ---------------------------------------------------------------------------
async function handleAudit(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  project: ClientProject
): Promise<void> {
  const raw = await callClaude(anthropicKey, 2048, promptAudit(project));
  const findings = extract(raw, 'FINDINGS');
  const opportunities = extract(raw, 'OPPORTUNITIES');
  const baseline = extract(raw, 'BASELINE');
  const questions = extract(raw, 'QUESTIONS');

  await supabase.from('agent_reports').insert({
    agent_slug: AGENT_SLUG,
    title: `Audit — ${project.title}`,
    sections: [
      { heading: 'Constats', content: findings },
      { heading: 'Opportunités', content: opportunities },
      { heading: 'Baseline KPIs', content: baseline },
      { heading: 'Questions client', content: questions },
    ],
    report_type: 'project_audit',
    content: { project_id: project.id },
  });

  await supabase.from('client_projects').update({
    phase: 'audit',
    baseline_kpis: { findings, opportunities, baseline_summary: baseline },
  }).eq('id', project.id);

  await writeHistory(supabase, project.id, 'phase_change',
    { phase: 'intake' }, { phase: 'audit' },
    project.responsible_agent_id, 'Audit complété par Claude'
  );
  await writeProjectKpis(supabase, project.id, baseline);
  await completeMilestone(supabase, project.id, 'Audit de la situation');

  if (project.client_email) {
    await sendToClient(resendKey, project.client_email,
      `Audit de votre situation — ${project.title.slice(0, 50)}`,
      clientBuildAudit(project.client_name, project.title, findings, opportunities, questions),
      project.id, 'audit', project.responsible_agent_id, supabase
    );
  }
}

// ---------------------------------------------------------------------------
// Phase 3 — STRATEGY: plan 90j + délégation Content/Prospecting
// ---------------------------------------------------------------------------
async function handleStrategy(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  project: ClientProject
): Promise<void> {
  const raw = await callClaude(anthropicKey, 2048, promptStrategy(project));
  const strategy = extract(raw, 'STRATEGY');
  const actionPlan = extract(raw, 'ACTION_PLAN');
  const contentTasks = extract(raw, 'CONTENT_TASKS');
  const prospectingTasks = extract(raw, 'PROSPECTING_TASKS');
  const kpis = extract(raw, 'KPIS');

  if (contentTasks) {
    await supabase.from('project_tasks').insert({
      project_id: project.id, assigned_department: 'content',
      title: `Contenu — ${project.title}`, description: contentTasks, status: 'pending',
    });
  }

  if (prospectingTasks) {
    await supabase.from('project_tasks').insert({
      project_id: project.id, assigned_department: 'prospecting',
      title: `Prospection — ${project.title}`, description: prospectingTasks, status: 'pending',
    });
  }

  await supabase.from('agent_reports').insert({
    agent_slug: AGENT_SLUG,
    title: `Stratégie — ${project.title}`,
    sections: [
      { heading: 'Stratégie', content: strategy },
      { heading: "Plan d'action", content: actionPlan },
      { heading: 'Tâches Content', content: contentTasks },
      { heading: 'Tâches Prospecting', content: prospectingTasks },
      { heading: 'KPIs cibles', content: kpis },
    ],
    report_type: 'project_strategy',
    content: { project_id: project.id },
  });

  await supabase.from('client_projects')
    .update({ phase: 'execution' })
    .eq('id', project.id);

  await writeHistory(supabase, project.id, 'phase_change',
    { phase: 'audit' }, { phase: 'execution', tasks_delegated: [contentTasks ? 'content' : null, prospectingTasks ? 'prospecting' : null].filter(Boolean) },
    project.responsible_agent_id, 'Stratégie construite, délégation effectuée'
  );
  await completeMilestone(supabase, project.id, 'Stratégie 90 jours');

  if (project.client_email) {
    await sendToClient(resendKey, project.client_email,
      `Votre stratégie marketing — ${project.title.slice(0, 50)}`,
      clientBuildStrategy(project.client_name, project.title, strategy, actionPlan, kpis),
      project.id, 'strategy', project.responsible_agent_id, supabase
    );
  }

  await sendToCEO(resendKey,
    `📊 Stratégie prête — ${project.title.slice(0, 60)}`,
    ceoBuildStrategy(project, strategy, contentTasks, prospectingTasks)
  );
}

// ---------------------------------------------------------------------------
// Phase 5 — DELIVER: rapport final au client
// ---------------------------------------------------------------------------
async function handleDeliver(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  project: ClientProject
): Promise<void> {
  const { data: tasks } = await supabase.from('project_tasks')
    .select('title, status, result').eq('project_id', project.id);

  const raw = await callClaude(anthropicKey, 2048, promptDeliver(project, tasks || []));
  const results = extract(raw, 'RESULTS');
  const impact = extract(raw, 'IMPACT');
  const nextSteps = extract(raw, 'NEXT_STEPS');

  await supabase.from('client_projects').update({
    phase: 'completed', status: 'completed',
    results_kpis: { results, impact },
  }).eq('id', project.id);

  await writeHistory(supabase, project.id, 'phase_change',
    { phase: 'execution' }, { phase: 'completed', results_summary: results.slice(0, 200) },
    project.responsible_agent_id, 'Projet livré au client'
  );
  await completeMilestone(supabase, project.id, 'Livraison finale');
  await recalcAgentLoad(supabase, project.responsible_agent_id);

  if (project.client_email) {
    await sendToClient(resendKey, project.client_email,
      `Votre projet est terminé — ${project.title.slice(0, 50)}`,
      clientBuildDelivery(project.client_name, project.title, results, impact, nextSteps),
      project.id, 'delivery', project.responsible_agent_id, supabase
    );
  }

  await sendToCEO(resendKey,
    `✅ Projet livré — ${project.title.slice(0, 60)}`,
    ceoBuildAlert(`Le projet "${project.title}" est terminé et livré au client.`, `Client : ${project.client_name} (${project.client_email})`)
  );
}

// ---------------------------------------------------------------------------
// CHECK — revue quotidienne de tous les projets actifs
// ---------------------------------------------------------------------------
async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string
): Promise<{ briefs_picked_up: number; projects_reviewed: number; actions: string[] }> {
  const now = new Date();
  const actions: string[] = [];

  // 1. Ramasser les briefs non assignés
  const { data: newBriefs } = await supabase
    .from('briefs')
    .select('id, description, user_id, statut')
    .not('statut', 'in', '("in_progress","assigned","completed","cancelled")')
    .is('project_id', null)
    .order('created_at', { ascending: true })
    .limit(2);

  for (const brief of newBriefs || []) {
    if (!brief.user_id || !brief.description) continue;
    const pid = await handleIntake(supabase, resendKey, brief);
    if (pid) actions.push(`intake:${pid}`);
  }

  // 2. Revue des projets actifs marketing
  const { data: dept } = await supabase.from('departments').select('id').eq('slug', AGENT_SLUG).single();
  if (!dept) return { briefs_picked_up: (newBriefs?.length || 0), projects_reviewed: 0, actions };

  const { data: projects } = await supabase
    .from('client_projects')
    .select('*')
    .eq('department_id', dept.id)
    .eq('status', 'active')
    .order('priority_score', { ascending: false });

  let auditDone = false;
  let strategyDone = false;
  let deliverDone = false;

  for (const project of (projects as ClientProject[]) || []) {
    const hoursElapsed = (now.getTime() - new Date(project.updated_at).getTime()) / 3_600_000;

    // Phase intake → audit (après 2h)
    if (!auditDone && project.phase === 'intake' && hoursElapsed >= 2) {
      await handleAudit(supabase, anthropicKey, resendKey, project);
      actions.push(`audit:${project.id}`);
      auditDone = true;
      continue;
    }

    // Phase audit → strategy (après 24h)
    if (!strategyDone && project.phase === 'audit' && hoursElapsed >= 24) {
      await handleStrategy(supabase, anthropicKey, resendKey, project);
      actions.push(`strategy:${project.id}`);
      strategyDone = true;
      continue;
    }

    // Phase execution → deliver (si toutes tâches complètes)
    if (!deliverDone && project.phase === 'execution') {
      const { data: tasks } = await supabase
        .from('project_tasks').select('status').eq('project_id', project.id);

      const allDone = tasks?.length ? tasks.every((t: { status: string }) => t.status === 'completed') : false;
      const hasNoTasks = !tasks?.length;

      if (hasNoTasks && hoursElapsed >= 72) {
        // Pas de tâches déléguées et 72h passées — livrer quand même
        await handleDeliver(supabase, anthropicKey, resendKey, project);
        actions.push(`deliver:${project.id}`);
        deliverDone = true;
      } else if (allDone) {
        await handleDeliver(supabase, anthropicKey, resendKey, project);
        actions.push(`deliver:${project.id}`);
        deliverDone = true;
      } else if (hoursElapsed >= 72) {
        // Mise à jour hebdomadaire au client
        const pending = tasks?.filter((t: { status: string }) => t.status !== 'completed').length || 0;
        if (project.client_email) {
          await sendToClient(resendKey, project.client_email,
            `Mise à jour de votre projet — ${project.title.slice(0, 50)}`,
            clientBuildProgress(project.client_name, project.title, (tasks?.length || 0) - pending, tasks?.length || 0),
            project.id, 'execution', project.responsible_agent_id, supabase
          );
          await supabase.from('client_projects').update({ updated_at: new Date().toISOString() }).eq('id', project.id);
          actions.push(`progress_update:${project.id}`);
        }
      }
    }

    // Alerte si en retard sur la deadline
    if (project.due_date && new Date(project.due_date) < now) {
      await sendToCEO(resendKey,
        `🔴 Projet en retard — ${project.title.slice(0, 60)}`,
        ceoBuildAlert(`Le projet "${project.title}" a dépassé sa deadline.`,
          `Client : ${project.client_name} | Phase actuelle : ${project.phase}`)
      );
      actions.push(`overdue:${project.id}`);
    }
  }

  // 3. Recalculer la disponibilité de tous les agents
  const { data: agents } = await supabase
    .from('ai_agents').select('id, max_projects').eq('status', 'active');

  for (const agent of agents || []) {
    await recalcAgentLoad(supabase, agent.id);
  }

  return { briefs_picked_up: newBriefs?.length || 0, projects_reviewed: projects?.length || 0, actions };
}

// ---------------------------------------------------------------------------
// Prompts Claude
// ---------------------------------------------------------------------------
function promptAudit(p: ClientProject): string {
  return `Tu es le Marketing Director de CreatorFlow Market. Tu prends en charge ce projet client.

PROJET : ${p.title}
OBJECTIF : ${p.objective}

Produis un audit de la situation actuelle basé sur ce brief.

[FINDINGS]
3-5 constats précis sur la situation actuelle (forces, faiblesses, risques).

[OPPORTUNITIES]
3 opportunités concrètes : opportunité — pourquoi pertinente — action recommandée.

[BASELINE]
4-5 KPIs à mesurer. Format : Métrique — Comment mesurer — Valeur cible.

[QUESTIONS]
2-3 questions précises à poser au client pour affiner la stratégie.`;
}

function promptStrategy(p: ClientProject): string {
  return `Tu es le Marketing Director de CreatorFlow Market.

PROJET : ${p.title}
OBJECTIF : ${p.objective}
AUDIT : ${JSON.stringify(p.baseline_kpis).slice(0, 600)}

Construis la stratégie complète sur 90 jours.

[STRATEGY]
4-5 axes stratégiques. Pour chaque axe : nom — objectif — pourquoi prioritaire.

[ACTION_PLAN]
Plan 30/60/90 jours. Format : Semaine X — Action — Livrable.

[CONTENT_TASKS]
Tâches de contenu à déléguer. Format : Tâche — Description — Deadline.

[PROSPECTING_TASKS]
Tâches de prospection à déléguer. Format : Tâche — Description — Deadline.

[KPIS]
4-5 KPIs cibles à J+90. Format : KPI — Baseline — Cible.`;
}

function promptDeliver(p: ClientProject, tasks: Array<{ title: string; status: string; result?: string }>): string {
  const tasksSummary = tasks.map(t => `${t.title} (${t.status}) : ${t.result || 'en cours'}`).join('\n');
  return `Tu es le Marketing Director de CreatorFlow Market. Produis le rapport final de ce projet.

PROJET : ${p.title}
OBJECTIF : ${p.objective}
TÂCHES : ${tasksSummary || 'Aucune tâche déléguée.'}

[RESULTS]
Ce qui a été accompli concrètement. Factuel et précis.

[IMPACT]
Impact mesurable sur l'activité du client. Avant/après si possible.

[NEXT_STEPS]
3 recommandations pour maintenir l'élan après la livraison.`;
}

// ---------------------------------------------------------------------------
// HTML — Emails client (FROM: CreatorFlow Market)
// ---------------------------------------------------------------------------
const S = `body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.w{max-width:580px;margin:0 auto;padding:28px 20px;}
.hd{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}.logo em{font-style:normal;color:#4F46E5;}
h2{font-size:18px;margin:20px 0 4px;color:#A5B4FC;}
.meta{font-size:12px;color:#9898B8;margin-bottom:20px;}
.sec{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.lbl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;}
.txt{font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:14px;background:rgba(79,70,229,0.15);color:#A5B4FC;border:1px solid rgba(79,70,229,0.3);}
.btn{display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.ft{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}`;

const dash = 'https://creatorflowmarket.com/dashboard-client.html';

function clientBuildIntake(name: string, objective: string, projectId: string): string {
  const d = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${S}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Market</em></div></div>
<div class="badge">✓ Projet pris en charge</div>
<h2>Bonjour ${name},</h2><div class="meta">${d}</div>
<div class="sec"><div class="lbl">Votre mission</div><div class="txt">${objective}</div></div>
<div class="sec"><div class="lbl">Ce qui se passe maintenant</div><div class="txt">Votre dossier est entre les mains de votre équipe CreatorFlow Market. Un audit complet de votre situation vous sera envoyé dans les prochaines 24h.

Vous n'avez rien à faire — nous gérons tout.</div></div>
<p style="text-align:center"><a href="${dash}" class="btn">Suivre l'avancement →</a></p>
<div class="ft">CreatorFlow Market · Réf. ${projectId.slice(0,8).toUpperCase()}</div>
</div></body></html>`;
}

function clientBuildAudit(name: string, title: string, findings: string, opportunities: string, questions: string): string {
  const d = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${S}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Market</em></div></div>
<div class="badge">📋 Audit — Étape 1/3</div>
<h2>Audit de votre situation</h2><div class="meta">${d} · ${title}</div>
<div class="sec"><div class="lbl">Constats</div><div class="txt">${findings}</div></div>
<div class="sec"><div class="lbl">Opportunités identifiées</div><div class="txt">${opportunities}</div></div>
${questions ? `<div class="sec"><div class="lbl">Questions pour affiner la stratégie</div><div class="txt">${questions}</div></div>` : ''}
<p style="font-size:13px;color:#D1D5DB;">Votre stratégie complète vous sera envoyée dans les prochaines 24h.</p>
<p style="text-align:center"><a href="${dash}" class="btn">Voir mon dossier →</a></p>
<div class="ft">CreatorFlow Market · Audit préparé par votre équipe</div>
</div></body></html>`;
}

function clientBuildStrategy(name: string, title: string, strategy: string, actionPlan: string, kpis: string): string {
  const d = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${S}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Market</em></div></div>
<div class="badge">🚀 Stratégie — Étape 2/3</div>
<h2>Votre stratégie marketing sur 90 jours</h2><div class="meta">${d} · ${title}</div>
<div class="sec"><div class="lbl">Stratégie</div><div class="txt">${strategy}</div></div>
<div class="sec"><div class="lbl">Plan d'action</div><div class="txt">${actionPlan}</div></div>
<div class="sec"><div class="lbl">KPIs à atteindre</div><div class="txt">${kpis}</div></div>
<p style="font-size:13px;color:#D1D5DB;">Votre équipe passe maintenant à l'exécution. Vous recevrez des mises à jour régulières.</p>
<p style="text-align:center"><a href="${dash}" class="btn">Suivre l'exécution →</a></p>
<div class="ft">CreatorFlow Market · Stratégie préparée par votre équipe</div>
</div></body></html>`;
}

function clientBuildProgress(name: string, title: string, done: number, total: number): string {
  const d = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${S}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Market</em></div></div>
<div class="badge">📈 Mise à jour projet</div>
<h2>Avancement de votre projet</h2><div class="meta">${d} · ${title}</div>
<div class="sec"><div class="lbl">Progression</div><div class="txt">${done} tâches complétées sur ${total} (${pct}%)

Votre équipe travaille activement. Vous serez notifié dès que la livraison finale est prête.</div></div>
<p style="text-align:center"><a href="${dash}" class="btn">Voir le détail →</a></p>
<div class="ft">CreatorFlow Market · Mise à jour automatique</div>
</div></body></html>`;
}

function clientBuildDelivery(name: string, title: string, results: string, impact: string, nextSteps: string): string {
  const d = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${S}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Market</em></div></div>
<div class="badge">✅ Livraison finale — Étape 3/3</div>
<h2>Votre projet est terminé</h2><div class="meta">${d} · ${title}</div>
<div class="sec"><div class="lbl">Ce qui a été accompli</div><div class="txt">${results}</div></div>
<div class="sec"><div class="lbl">Impact sur votre activité</div><div class="txt">${impact}</div></div>
<div class="sec"><div class="lbl">Prochaines étapes recommandées</div><div class="txt">${nextSteps}</div></div>
<p style="text-align:center"><a href="${dash}" class="btn">Voir le rapport complet →</a></p>
<div class="ft">CreatorFlow Market · Merci de votre confiance.</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// HTML — Emails CEO (FROM: Marketing Director IA)
// ---------------------------------------------------------------------------
const SC = `body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.w{max-width:580px;margin:0 auto;padding:28px 20px;}
.hd{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}.logo em{font-style:normal;color:#4F46E5;}
h2{font-size:18px;margin:20px 0 4px;color:#A5B4FC;}
.sec{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.lbl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;}
.txt{font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;}
.btn{display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.ft{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}`;

const cockpit = 'https://creatorflowmarket.com/admin';

function ceoBuildAlert(message: string, context: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SC}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Marketing Director</em></div></div>
<h2>⚠ Alerte</h2>
<div class="sec"><div class="txt">${message}\n\n${context}</div></div>
<p style="text-align:center"><a href="${cockpit}" class="btn">Ouvrir le Cockpit →</a></p>
<div class="ft">Marketing Director IA · CreatorFlow Market</div>
</div></body></html>`;
}

function ceoBuildNewProject(projectId: string, objective: string, clientName: string, clientEmail: string, agentName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SC}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Marketing Director</em></div></div>
<h2>Nouveau projet assigné automatiquement</h2>
<div class="sec"><div class="lbl">Détails</div><div class="txt">Client : ${clientName} (${clientEmail})
Objectif : ${objective.slice(0,300)}
Responsable : ${agentName}
Réf. : ${projectId.slice(0,8).toUpperCase()}</div></div>
<p style="text-align:center"><a href="${cockpit}" class="btn">Voir dans le Cockpit →</a></p>
<div class="ft">Marketing Director IA · CreatorFlow Market</div>
</div></body></html>`;
}

function ceoBuildStrategy(p: ClientProject, strategy: string, contentTasks: string, prospecting: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SC}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Marketing Director</em></div></div>
<h2>Stratégie prête — ${p.title}</h2>
<div class="sec"><div class="lbl">Stratégie</div><div class="txt">${strategy.slice(0,400)}</div></div>
${contentTasks ? `<div class="sec"><div class="lbl">Délégué → Content Employee</div><div class="txt">${contentTasks.slice(0,250)}</div></div>` : ''}
${prospecting ? `<div class="sec"><div class="lbl">Délégué → Prospecting Employee</div><div class="txt">${prospecting.slice(0,250)}</div></div>` : ''}
<p style="text-align:center"><a href="${cockpit}" class="btn">Voir dans le Cockpit →</a></p>
<div class="ft">Marketing Director IA · CreatorFlow Market</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';

  let body: { run_type?: string; brief_id?: string; project_id?: string } = {};
  try { body = await req.json(); } catch (_) { /* GET or no body */ }

  const runType = body.run_type || 'check';

  try {
    // ── INTAKE direct (admin cockpit → assigner un brief spécifique) ──────────
    if (runType === 'intake' && body.brief_id) {
      const { data: brief } = await supabase
        .from('briefs').select('id, description, user_id, statut').eq('id', body.brief_id).single();
      if (!brief) return new Response(JSON.stringify({ error: 'Brief introuvable' }), { status: 404, headers: cors });
      const pid = await handleIntake(supabase, resendKey, brief);
      return new Response(JSON.stringify({ ok: true, project_id: pid, duration_ms: Date.now() - startTime }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── CHECK / DAILY heartbeat ───────────────────────────────────────────────
    if (runType === 'check' || runType === 'daily') {
      const result = await handleCheck(supabase, anthropicKey, resendKey);

      await supabase.from('agent_heartbeats').insert({
        agent_slug: AGENT_SLUG,
        run_type: 'daily',
        status: 'ok',
        kpis_snapshot: { projects_reviewed: result.projects_reviewed, actions_taken: result.actions.length, briefs_picked_up: result.briefs_picked_up },
        alerts_triggered: [],
        duration_ms: Date.now() - startTime,
      });

      await supabase.from('ai_agents')
        .update({ last_active: new Date().toISOString() })
        .eq('slug', AGENT_SLUG);

      return new Response(JSON.stringify({ ok: true, run_type: 'check', ...result, duration_ms: Date.now() - startTime }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // ── MISSION (legacy CEO cockpit — conservé pour compatibilité) ────────────
    if (runType === 'mission') {
      const result = await handleCheck(supabase, anthropicKey, resendKey);
      return new Response(JSON.stringify({ ok: true, run_type: 'mission', ...result, duration_ms: Date.now() - startTime }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'run_type inconnu' }), { status: 400, headers: cors });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
