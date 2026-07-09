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
const FROM_CLIENT = 'CreatorFlow Market <noreply@creatorflowmarket.com>';
const FROM_CEO = 'Aria — CreatorFlow Market <noreply@creatorflowmarket.com>';

// ---------------------------------------------------------------------------
// Email CSS partagé
// ---------------------------------------------------------------------------
const S = `body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.w{max-width:600px;margin:0 auto;padding:28px 20px;}
.hd{padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo{font-size:16px;font-weight:800;color:#F4F4FF;}
.logo em{font-style:normal;color:#818CF8;}
.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;margin:14px 0;}
.h2{font-size:18px;margin:4px 0 2px;color:#C7D2FE;}
.meta{font-size:12px;color:#9898B8;margin-bottom:16px;}
.sec{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.lbl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;}
.txt{font-size:13px;color:#D1D5DB;line-height:1.75;white-space:pre-wrap;}
.btn{display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;padding:10px 24px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.ft{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EmployeeProfile {
  slug: string;
  name: string;
  avatar_emoji: string;
  title: string;
  system_prompt_context: string;
  communication_tone: string;
}

interface ClientProject {
  id: string;
  brief_id: string;
  client_id: string;
  client_email: string;
  client_name: string;
  department_id: string;
  responsible_agent_id: string;
  title: string;
  objective: string;
  phase: string;
  priority_score: number;
  status: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

interface OwnerDecision {
  action: string;
  reason: string;
  collaborator_brief: string;
  client_message: string;
}

interface InternalRequest {
  to_dept: string;
  status: string;
  brief?: string;
  result?: string;
  result_summary?: string;
}

interface HistoryEvent {
  event_type: string;
  note: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------
async function sendToClient(
  resendKey: string, to: string, subject: string, html: string,
  projectId: string, phase: string, agentId: string,
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  if (!to) return;
  const safe = subject.replace(/[\r\n\t]/g, ' ').trim();

  // Toujours tracer dans client_communications — indépendamment de la config email
  try {
    await supabase.from('client_communications').insert({
      project_id: projectId, direction: 'outbound', phase,
      subject: safe, content_preview: html.replace(/<[^>]*>/g, '').slice(0, 300),
      sent_by_agent_id: agentId, sent_at: new Date().toISOString(),
    });
  } catch (_) {}

  // Envoyer l'email seulement si Resend est configuré
  if (!resendKey) return;
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_CLIENT, to: [to], subject: safe, html }),
    });
  } catch (_) {}
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
  } catch (_) {}
}

async function writeHistory(
  supabase: ReturnType<typeof createClient>,
  projectId: string, eventType: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  actorId: string, note?: string,
): Promise<void> {
  await supabase.from('project_history').insert({
    project_id: projectId, event_type: eventType,
    old_value: oldValue, new_value: newValue,
    actor_type: 'agent', actor_id: actorId,
    note: note ?? null,
  });
}

async function getClientInfo(
  supabase: ReturnType<typeof createClient>, userId: string,
): Promise<{ email: string; name: string }> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const email = data?.user?.email ?? '';
    const name = data?.user?.user_metadata?.full_name ?? email.split('@')[0] ?? 'Client';
    return { email, name };
  } catch (_) {
    return { email: '', name: 'Client' };
  }
}

async function recalcAgentLoad(
  supabase: ReturnType<typeof createClient>, agentId: string,
): Promise<void> {
  const { count } = await supabase.from('client_projects')
    .select('*', { count: 'exact', head: true })
    .eq('responsible_agent_id', agentId).eq('status', 'active');
  const n = count || 0;
  await supabase.from('ai_agents').update({
    current_projects: n,
    availability: n >= 5 ? 'overloaded' : 'available',
  }).eq('id', agentId);
}

// ---------------------------------------------------------------------------
// Chargement du profil Aria depuis la DB
// ---------------------------------------------------------------------------
async function loadOwnerProfile(
  supabase: ReturnType<typeof createClient>,
): Promise<EmployeeProfile | null> {
  const { data } = await supabase
    .from('employee_profiles')
    .select('slug, name, avatar_emoji, title, system_prompt_context, communication_tone')
    .eq('slug', AGENT_SLUG)
    .single();
  return data || null;
}

// ---------------------------------------------------------------------------
// Expérience accumulée d'Aria (cross-clients)
// ---------------------------------------------------------------------------
async function loadOwnerExperience(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('employee_experience')
    .select('experience_text, projects_count')
    .eq('employee_slug', AGENT_SLUG)
    .single();
  if (!data || !data.experience_text || data.projects_count === 0) return '';
  return data.experience_text;
}

async function synthesizeOwnerExperience(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
  project: ClientProject,
): Promise<void> {
  try {
    const { data: exp } = await supabase
      .from('employee_experience')
      .select('experience_text, projects_count')
      .eq('employee_slug', AGENT_SLUG)
      .single();
    const count = (exp?.projects_count || 0) + 1;
    const currentExp = exp?.experience_text || '';
    const newExp = await callClaude(anthropicKey, 400, `Tu es ${profile.name}, ${profile.title} chez CreatorFlow Market.

${currentExp ? `EXPÉRIENCE ACTUELLE (${exp?.projects_count || 0} projets) :\n${currentExp.slice(0, 500)}\n` : ''}PROJET VENANT D'ÊTRE LIVRÉ :
Client : ${project.client_name}
Projet : ${project.title}
Contexte : ${(project.objective || '').slice(0, 200)}

Synthétise ton expérience accumulée en 8-10 bullet points concis (1 ligne chacun).
Focus : profils clients récurrents, stratégies gagnantes, signaux d'escalade à anticiper, quand solliciter quel collaborateur, erreurs à éviter.
Format : bullet points uniquement, sans intro ni conclusion.`);
    await supabase.from('employee_experience').update({
      experience_text: newExp.trim(),
      projects_count: count,
      last_synthesized: new Date().toISOString(),
    }).eq('employee_slug', AGENT_SLUG);
  } catch (err) {
    console.error('[marketing] synthesizeOwnerExperience error:', (err as Error).message);
  }
}

async function updateOwnerMetrics(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
): Promise<void> {
  try {
    const [totalRes, activeRes, completedRes, durationRes, feedbackRes, incidentRes] = await Promise.all([
      supabase.from('client_projects').select('*', { count: 'exact', head: true }),
      supabase.from('client_projects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('client_projects').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('client_projects').select('created_at, updated_at').eq('status', 'completed').not('updated_at', 'is', null).limit(50),
      supabase.from('project_feedback').select('score').limit(100),
      supabase.from('project_history').select('note, created_at').in('event_type', ['escalated', 'revision_requested']).order('created_at', { ascending: false }).limit(1),
    ]);
    const total = totalRes.count || 0;
    const active = activeRes.count || 0;
    const completed = completedRes.count || 0;
    const feedbacks = feedbackRes.data || [];
    const avgSatisfaction = feedbacks.length
      ? feedbacks.reduce((s: number, f: { score: number }) => s + (f.score || 0), 0) / feedbacks.length : 0;
    const successRate = feedbacks.length
      ? (feedbacks.filter((f: { score: number }) => f.score >= 2).length / feedbacks.length) * 100
      : completed > 0 ? (completed / Math.max(total, 1)) * 100 : 0;
    let avgDays = 0;
    if (durationRes.data?.length) {
      const ms = durationRes.data.reduce((s: number, p: { created_at: string; updated_at: string }) =>
        s + (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()), 0);
      avgDays = ms / durationRes.data.length / 86400000;
    }
    const lastIncident = incidentRes.data?.[0]?.note || null;
    const lastIncidentAt = incidentRes.data?.[0]?.created_at || null;
    const { data: exp } = await supabase.from('employee_experience').select('experience_text').eq('employee_slug', AGENT_SLUG).single();
    const metaRaw = await callClaude(anthropicKey, 200, `Tu es ${profile.name}, ${profile.title}.
Métriques : ${total} projets gérés, ${completed} livrés, ${active} actifs, satisfaction ${avgSatisfaction.toFixed(1)}/5, succès ${successRate.toFixed(0)}%, durée moy ${avgDays.toFixed(1)}j.
${exp?.experience_text ? 'Expérience : ' + exp.experience_text.slice(0, 250) : ''}

Format exact :
[COMPÉTENCES] comp1 | comp2 | comp3
[OBJECTIF] Une phrase sur ton objectif Q3 2026
[FORMATION] Une phrase sur ce que tu travailles à améliorer`);
    const tag = (t: string) => { const m = metaRaw.match(new RegExp(`\\[${t}\\]([^\\n]+)`)); return m ? m[1].trim() : ''; };
    const skills = tag('COMPÉTENCES').split('|').map((s: string) => s.trim()).filter(Boolean);
    await supabase.from('employee_metrics').update({
      total_projects: total, active_projects: active, completed_projects: completed,
      avg_satisfaction: Math.round(avgSatisfaction * 100) / 100,
      avg_duration_days: Math.round(avgDays * 10) / 10,
      success_rate: Math.round(successRate * 100) / 100,
      last_incident: lastIncident, last_incident_at: lastIncidentAt,
      skills_mastered: skills, quarterly_objectives: tag('OBJECTIF'), training_focus: tag('FORMATION'),
      updated_at: new Date().toISOString(),
    }).eq('employee_slug', AGENT_SLUG);
  } catch (err) {
    console.error('[marketing] updateOwnerMetrics error:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Contexte client
// ---------------------------------------------------------------------------
async function getClientMemory(
  supabase: ReturnType<typeof createClient>, clientEmail: string,
): Promise<string> {
  if (!clientEmail) return '';
  const { data } = await supabase
    .from('client_memory')
    .select('memory, projects_count')
    .eq('client_email', clientEmail)
    .eq('department', AGENT_SLUG)
    .maybeSingle();
  if (!data) return '';
  return `Client récurrent (${data.projects_count} projet${data.projects_count > 1 ? 's' : ''}) :\n${data.memory}`;
}

async function getLastClientContact(
  supabase: ReturnType<typeof createClient>, projectId: string,
): Promise<string> {
  const { data } = await supabase
    .from('client_communications')
    .select('sent_at, subject')
    .eq('project_id', projectId)
    .eq('direction', 'outbound')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return '';
  const h = Math.round((Date.now() - new Date(data.sent_at).getTime()) / 3_600_000);
  return `il y a ${h}h — "${(data.subject || '').slice(0, 60)}"`;
}

// ---------------------------------------------------------------------------
// Constructeurs d'emails
// ---------------------------------------------------------------------------
function buildClientEmail(
  profile: EmployeeProfile,
  clientName: string,
  badgeText: string,
  badgeColor: string,
  subject: string,
  message: string,
  projectId: string,
  cta?: { text: string; url: string },
): string {
  const d = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  const ctaHtml = cta
    ? `<p style="text-align:center;margin:20px 0"><a href="${cta.url}" class="btn">${cta.text}</a></p>`
    : '';
  const paragraphs = message
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<div class="sec"><div class="txt">${p.trim().replace(/\n/g, '<br>')}</div></div>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${S}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Market</em></div></div>
<div class="badge" style="background:rgba(79,70,229,0.15);color:${badgeColor};border:1px solid rgba(79,70,229,0.3);">${badgeText}</div>
<div class="h2">${clientName}</div>
<div class="meta">${d} · ${subject.slice(0, 70)}</div>
${paragraphs}
${ctaHtml}
<div class="ft">${profile.name} · ${profile.title} · CreatorFlow Market</div>
</div></body></html>`;
}

function buildCEOAlertEmail(title: string, message: string, context: string): string {
  const d = new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${S}</style></head><body><div class="w">
<div class="hd"><div class="logo">CreatorFlow <em>Market</em></div></div>
<div class="badge" style="background:rgba(239,68,68,0.15);color:#FCA5A5;border:1px solid rgba(239,68,68,0.3);">Alerte CEO</div>
<div class="h2">${title}</div>
<div class="meta">${d}</div>
<div class="sec"><div class="lbl">Message</div><div class="txt">${message}</div></div>
${context ? `<div class="sec"><div class="lbl">Contexte</div><div class="txt">${context}</div></div>` : ''}
<div class="ft">Aria · Marketing Employee · CreatorFlow Market</div>
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Prompt de décision — Aria raisonne sur son projet
// ---------------------------------------------------------------------------
function buildOwnerDecisionPrompt(
  profile: EmployeeProfile,
  project: ClientProject,
  history: HistoryEvent[],
  internalRequests: InternalRequest[],
  lastClientContact: string,
  clientMemory: string,
  experience: string,
): string {
  const hoursSince = Math.round(
    (Date.now() - new Date(project.updated_at).getTime()) / 3_600_000,
  );
  const pending = internalRequests.filter(r => r.status === 'pending');
  const completed = internalRequests.filter(r => r.status === 'completed');

  const reqStatus = internalRequests.length
    ? internalRequests.map(r =>
        `• ${r.to_dept.toUpperCase()}: ${r.status}${r.result_summary ? ' — ' + r.result_summary.slice(0, 120) : ''}`,
      ).join('\n')
    : 'Aucune requête collaborateur envoyée';

  return `${profile.system_prompt_context}
${experience ? '\n═══ TON EXPÉRIENCE ACCUMULÉE ═══\n' + experience.slice(0, 400) + '\nApplique ces apprentissages dans ta décision pour ce projet.\n' : ''}
═══ PROJET EN COURS ═══
Titre : ${project.title}
Client : ${project.client_name}
Objectif : ${(project.objective || '').slice(0, 500)}
Phase actuelle : ${project.phase}
Inactif depuis : ${hoursSince}h
Dernier contact client : ${lastClientContact || 'Aucun contact envoyé'}
${clientMemory ? `\n═══ PROFIL CLIENT CONNU ═══\n${clientMemory}\n` : ''}
═══ COLLABORATEURS ═══
${reqStatus}
${completed.length ? `→ ${completed.length} collaborateur(s) ont livré. Tu peux synthétiser.` : ''}
${pending.length ? `→ ${pending.length} requête(s) encore en cours chez les collaborateurs.` : ''}

═══ HISTORIQUE RÉCENT ═══
${history.slice(0, 6).map(h => `[${(h.created_at || '').slice(0, 10)}] ${h.note || h.event_type}`).join('\n') || 'Aucun événement'}

En tant que responsable exclusive de ${project.client_name}, quelle est ta prochaine action ?

[ACTION]
contacter_client | auditer | solliciter_content | solliciter_prospecting | solliciter_support | synthétiser | livrer | validation_CEO | attendre

[RAISON]
1-2 phrases de raisonnement professionnel. Pourquoi cette action maintenant ?

[BRIEF_COLLABORATEUR]
(si solliciter_* — brief précis : contexte du projet, objectif client, et ce que tu attends exactement du collaborateur)

[MESSAGE_CLIENT]
(si contacter_client, auditer, synthétiser, ou livrer — le message complet envoyé au client. Minimum 150 mots. Ton professionnel et direct. Signe avec ton prénom.)`;
}

function parseOwnerDecision(text: string): OwnerDecision {
  const extract = (tag: string): string => {
    const m = text.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_ÉÈÀÙÎÔÂÊ]+\\]|$)`));
    return m ? m[1].trim() : '';
  };
  const rawAction = extract('ACTION').split('\n')[0].trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // strip accents for matching
  const map: Record<string, string> = {
    'contacter_client': 'contacter_client',
    'auditer': 'auditer',
    'solliciter_content': 'solliciter_content',
    'solliciter_prospecting': 'solliciter_prospecting',
    'solliciter_support': 'solliciter_support',
    'synthetiser': 'synthétiser',
    'livrer': 'livrer',
    'validation_ceo': 'validation_CEO',
    'attendre': 'attendre',
  };
  const action = map[rawAction] || 'attendre';
  return {
    action,
    reason: extract('RAISON') || extract('REASON') || 'Aucune raison fournie.',
    collaborator_brief: extract('BRIEF_COLLABORATEUR'),
    client_message: extract('MESSAGE_CLIENT'),
  };
}

// ---------------------------------------------------------------------------
// Exécution de la décision
// ---------------------------------------------------------------------------
async function executeOwnerDecision(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  profile: EmployeeProfile,
  project: ClientProject,
  agentId: string,
  decision: OwnerDecision,
): Promise<void> {
  const { action, reason, collaborator_brief, client_message } = decision;

  // Toujours tracer la décision
  await writeHistory(
    supabase, project.id, 'owner_decision',
    { phase: project.phase },
    { action, decision_reason: reason },
    agentId,
    `${profile.name} — décision : ${action}. ${reason.slice(0, 200)}`,
  );

  // ── contacter_client ──────────────────────────────────────────────────────
  if (action === 'contacter_client' && client_message && project.client_email) {
    const subj = `Mise à jour — ${project.title.slice(0, 55)}`;
    await sendToClient(
      resendKey, project.client_email, subj,
      buildClientEmail(profile, project.client_name, '✦ Message d\'Aria', '#A5B4FC', subj, client_message, project.id),
      project.id, 'update', agentId, supabase,
    );
    await supabase.from('client_projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', project.id);
    return;
  }

  // ── auditer ───────────────────────────────────────────────────────────────
  if (action === 'auditer') {
    const auditPrompt = `${profile.system_prompt_context}

Tu analyses un nouveau projet client pour en comprendre le contexte, identifier les opportunités et poser les bases de la stratégie.

CLIENT : ${project.client_name}
PROJET : ${project.title}
BRIEF : ${(project.objective || '').slice(0, 600)}

[ANALYSE]
3-4 constats clés sur la situation actuelle.

[OPPORTUNITÉS]
3 opportunités marketing concrètes et actionnables.

[QUESTIONS]
2-3 questions à poser au client pour affiner la stratégie.

[MESSAGE_CLIENT]
Le message complet envoyé au client (minimum 200 mots). Tu partages tes premières analyses, montres que tu as compris leur situation, et poses tes questions. Signe avec ton prénom.`;

    const raw = await callClaude(anthropicKey, 2048, auditPrompt);
    const ex = (tag: string) => {
      const m = raw.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_ÉÈÀÙ]+\\]|$)`));
      return m ? m[1].trim() : '';
    };

    await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `Audit — ${project.title}`,
      sections: [
        { heading: 'Analyse', content: ex('ANALYSE') },
        { heading: 'Opportunités', content: ex('OPPORTUNIT') || ex('OPPORTUNITES') },
        { heading: 'Questions client', content: ex('QUESTIONS') },
      ],
      report_type: 'owner_audit',
      content: { project_id: project.id },
    });

    await supabase.from('client_projects')
      .update({ phase: 'audit', updated_at: new Date().toISOString() })
      .eq('id', project.id);

    const msgClient = ex('MESSAGE_CLIENT') || client_message;
    if (msgClient && project.client_email) {
      const subj = `Notre analyse de votre projet — ${project.title.slice(0, 50)}`;
      await sendToClient(
        resendKey, project.client_email, subj,
        buildClientEmail(profile, project.client_name, '🔍 Analyse initiale', '#A5B4FC', subj, msgClient, project.id,
          { text: 'Voir votre espace client →', url: 'https://creatorflowmarket.com/dashboard-client.html' }),
        project.id, 'audit', agentId, supabase,
      );
    }
    return;
  }

  // ── solliciter_content / prospecting / support ────────────────────────────
  if (['solliciter_content', 'solliciter_prospecting', 'solliciter_support'].includes(action)) {
    const toDept = action.replace('solliciter_', '');
    if (!collaborator_brief) return;

    // Ne pas envoyer si requête déjà en cours pour ce département
    const { data: existing } = await supabase
      .from('internal_requests')
      .select('id')
      .eq('project_id', project.id)
      .eq('to_dept', toDept)
      .eq('status', 'pending')
      .limit(1);
    if (existing?.length) return;

    await supabase.from('internal_requests').insert({
      project_id: project.id,
      from_dept: AGENT_SLUG,
      to_dept: toDept,
      brief: collaborator_brief,
      objective: (project.objective || '').slice(0, 500),
      status: 'pending',
      decision_reason: reason,
    });

    await supabase.from('client_projects')
      .update({ phase: 'execution', updated_at: new Date().toISOString() })
      .eq('id', project.id);
    return;
  }

  // ── synthétiser ───────────────────────────────────────────────────────────
  if (action === 'synthétiser') {
    const { data: completedReqs } = await supabase
      .from('internal_requests')
      .select('to_dept, brief, result, result_summary')
      .eq('project_id', project.id)
      .eq('status', 'completed');

    if (!completedReqs?.length) return;

    const synthPrompt = `${profile.system_prompt_context}

Tu as reçu les travaux de tes collaborateurs pour le projet de ${project.client_name}. Synthétise-les en un message client cohérent.

PROJET : ${project.title}
OBJECTIF : ${(project.objective || '').slice(0, 300)}

TRAVAUX REÇUS :
${completedReqs.map(r =>
  `[${r.to_dept.toUpperCase()}]\nBrief donné : ${(r.brief || '').slice(0, 200)}\nRésultat : ${(r.result || r.result_summary || '').slice(0, 500)}`
).join('\n\n')}

Rédige un message professionnel pour le client (minimum 300 mots) qui :
- Présente les livrables de façon claire et valorisante
- Explique comment les utiliser concrètement
- Indique les prochaines étapes recommandées
- Invite le client à réagir

Ne mentionne jamais le nom de tes collaborateurs. Tu es leur unique point de contact. Signe avec ton prénom.`;

    const synthesis = client_message || await callClaude(anthropicKey, 2048, synthPrompt);
    if (!synthesis || !project.client_email) return;

    const subj = `Vos livrables sont prêts — ${project.title.slice(0, 50)}`;
    await sendToClient(
      resendKey, project.client_email, subj,
      buildClientEmail(profile, project.client_name, '✅ Livrables prêts', '#34D399', subj, synthesis, project.id,
        { text: 'Voir vos livrables →', url: 'https://creatorflowmarket.com/dashboard-client.html' }),
      project.id, 'synthesis', agentId, supabase,
    );

    await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `Synthèse — ${project.title}`,
      sections: [{ heading: 'Synthèse livrée au client', content: synthesis }],
      report_type: 'owner_synthesis',
      content: { project_id: project.id },
    });

    await supabase.from('client_projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', project.id);
    return;
  }

  // ── livrer ────────────────────────────────────────────────────────────────
  if (action === 'livrer') {
    const livraisonPrompt = `${profile.system_prompt_context}

Tu clôtures le projet de ${project.client_name}. Rédige le message de livraison finale.

PROJET : ${project.title}
OBJECTIF INITIAL : ${(project.objective || '').slice(0, 300)}

Rédige un message de clôture (minimum 200 mots) qui :
- Confirme que le projet est terminé
- Récapitule ce qui a été accompli
- Donne 3 recommandations concrètes pour la suite
- Invite à évaluer la collaboration

Signe avec ton prénom.`;

    const finalMsg = client_message || await callClaude(anthropicKey, 1024, livraisonPrompt);

    await supabase.from('client_projects')
      .update({ phase: 'completed', status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', project.id);

    if (finalMsg && project.client_email) {
      const feedbackUrl = `https://creatorflowmarket.com/feedback.html?pid=${project.id}`;
      const msgWithFeedback = `${finalMsg}\n\n---\nVotre avis compte : ${feedbackUrl}`;
      const subj = `Votre projet est terminé — ${project.title.slice(0, 50)}`;
      await sendToClient(
        resendKey, project.client_email, subj,
        buildClientEmail(profile, project.client_name, '🎉 Projet clôturé', '#34D399', subj, msgWithFeedback, project.id,
          { text: 'Évaluer la collaboration →', url: feedbackUrl }),
        project.id, 'delivery', agentId, supabase,
      );
    }

    await recalcAgentLoad(supabase, agentId);
    await synthesizeOwnerExperience(supabase, anthropicKey, profile, project);

    await sendToCEO(resendKey,
      `✅ Projet clôturé — ${project.client_name}`,
      buildCEOAlertEmail(
        `Projet clôturé`,
        `Le projet "${project.title}" a été livré et clôturé par ${profile.name}.`,
        `Client : ${project.client_name} (${project.client_email || 'email inconnu'})`,
      ),
    );
    return;
  }

  // ── validation_CEO ────────────────────────────────────────────────────────
  if (action === 'validation_CEO') {
    await sendToCEO(resendKey,
      `⚠ Validation requise — ${project.client_name}`,
      buildCEOAlertEmail(
        'Validation CEO requise',
        `${profile.name} demande une validation pour le projet "${project.title}".`,
        `Client : ${project.client_name}\nRaison : ${(client_message || reason).slice(0, 400)}`,
      ),
    );
    return;
  }

  // ── attendre → déjà loggé dans l'historique ──────────────────────────────
}

// ---------------------------------------------------------------------------
// Revue du portefeuille — cœur du modèle Owner
// ---------------------------------------------------------------------------
async function reviewOwnerPortfolio(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  profile: EmployeeProfile,
): Promise<{ projects_reviewed: number; actions: string[] }> {
  const { data: agent } = await supabase
    .from('ai_agents').select('id').eq('slug', AGENT_SLUG).single();
  if (!agent) return { projects_reviewed: 0, actions: [] };

  const { data: dept } = await supabase
    .from('departments').select('id').eq('slug', AGENT_SLUG).single();

  const { data: projects } = await supabase
    .from('client_projects')
    .select('*')
    .eq('department_id', dept?.id)
    .eq('status', 'active')
    .order('priority_score', { ascending: false })
    .limit(5);

  const experience = await loadOwnerExperience(supabase);
  const actions: string[] = [];

  for (const project of (projects as ClientProject[]) || []) {
    try {
      const [{ data: history }, { data: internalReqs }, lastContact, clientMemory] = await Promise.all([
        supabase.from('project_history')
          .select('event_type, note, created_at')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('internal_requests')
          .select('to_dept, status, brief, result, result_summary')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false }),
        getLastClientContact(supabase, project.id),
        getClientMemory(supabase, project.client_email || ''),
      ]);

      const raw = await callClaude(
        anthropicKey, 512,
        buildOwnerDecisionPrompt(
          profile, project,
          (history || []) as HistoryEvent[],
          (internalReqs || []) as InternalRequest[],
          lastContact, clientMemory, experience,
        ),
      );
      const decision = parseOwnerDecision(raw);

      await executeOwnerDecision(
        supabase, anthropicKey, resendKey,
        profile, project, agent.id, decision,
      );

      actions.push(`${project.title.slice(0, 30)}: ${decision.action}`);
    } catch (err) {
      console.error('[marketing] reviewOwnerPortfolio error:', (err as Error).message);
    }
  }

  return { projects_reviewed: projects?.length || 0, actions };
}

// ---------------------------------------------------------------------------
// Intake — prise en charge d'un nouveau brief
// ---------------------------------------------------------------------------
async function handleIntake(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  profile: EmployeeProfile,
  brief: { id: string; description: string; user_id: string },
): Promise<string | null> {
  const [{ data: dept }, { data: agent }] = await Promise.all([
    supabase.from('departments').select('id').eq('slug', AGENT_SLUG).single(),
    supabase.from('ai_agents').select('id,name,current_projects,max_projects').eq('slug', AGENT_SLUG).single(),
  ]);
  if (!agent || (agent.current_projects || 0) >= (agent.max_projects || 5)) {
    await sendToCEO(resendKey,
      '⚠ Capacité maximale atteinte — brief en attente',
      buildCEOAlertEmail(
        'Aucun Marketing Employee disponible',
        'Un brief vient d\'arriver mais la capacité maximale est atteinte.',
        `Brief : ${brief.description.slice(0, 300)}`,
      ),
    );
    return null;
  }

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

  await supabase.from('briefs')
    .update({ statut: 'in_progress', project_id: project.id })
    .eq('id', brief.id);

  await supabase.from('ai_agents')
    .update({ current_projects: (agent.current_projects || 0) + 1 })
    .eq('id', agent.id);

  await writeHistory(
    supabase, project.id, 'intake',
    null, { agent: AGENT_SLUG, client: clientName },
    agent.id, `Projet pris en charge par ${profile.name}`,
  );

  // Email d'accueil au client — généré par Claude avec l'identité d'Aria
  if (clientEmail) {
    const welcomePrompt = `${profile.system_prompt_context}

Un nouveau client vient de te confier un projet. Rédige un message d'accueil (150-200 mots) qui :
- Confirme que tu as bien reçu leur demande et que tu en es la responsable
- Montre que tu as lu et compris leur brief
- Explique que tu vas analyser la situation et revenir avec tes premières recommandations sous 24-48h
- Donne confiance dès le premier contact

BRIEF DU CLIENT : ${brief.description.slice(0, 400)}

Signe avec ton prénom uniquement. Ne mentionne pas d'autres membres d'équipe.`;

    const welcomeMsg = await callClaude(anthropicKey, 512, welcomePrompt);
    const subj = `Votre projet est entre de bonnes mains — ${title.slice(0, 50)}`;
    await sendToClient(
      resendKey, clientEmail, subj,
      buildClientEmail(profile, clientName, '✦ Projet reçu', '#A5B4FC', subj, welcomeMsg, project.id),
      project.id, 'intake', agent.id, supabase,
    );
  }

  await sendToCEO(resendKey,
    `📋 Nouveau projet — ${clientName}`,
    buildCEOAlertEmail(
      'Nouveau projet entrant',
      `${profile.name} a pris en charge un nouveau projet de ${clientName}.`,
      `Projet : "${title}"\nClient : ${clientEmail || 'email inconnu'}\nBrief : ${brief.description.slice(0, 300)}`,
    ),
  );

  return project.id;
}

// ---------------------------------------------------------------------------
// Révisions — transformées en internal_requests
// ---------------------------------------------------------------------------
async function processRevisionRequests(
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const { data: revisions } = await supabase
    .from('project_revisions')
    .select('id, project_id, reason, department')
    .eq('status', 'pending')
    .limit(3);

  if (!revisions?.length) return 0;
  let processed = 0;

  for (const rev of revisions) {
    try {
      const dept = rev.department || 'content';

      // Vérifier qu'il n'y a pas déjà une requête de révision en cours
      const { data: existing } = await supabase
        .from('internal_requests')
        .select('id')
        .eq('project_id', rev.project_id)
        .eq('to_dept', dept)
        .eq('status', 'pending')
        .limit(1);

      if (!existing?.length) {
        await supabase.from('internal_requests').insert({
          project_id: rev.project_id,
          from_dept: AGENT_SLUG,
          to_dept: dept,
          brief: `RÉVISION DEMANDÉE PAR LE CLIENT\nRaison : ${rev.reason}`,
          status: 'pending',
          decision_reason: 'Révision demandée par le client via le formulaire',
        });
      }

      await supabase.from('project_revisions')
        .update({ status: 'in_progress' })
        .eq('id', rev.id);

      processed++;
    } catch (err) {
      console.error('[marketing] processRevisionRequests error:', (err as Error).message);
    }
  }
  return processed;
}

// ---------------------------------------------------------------------------
// handleCheck — point d'entrée principal
// ---------------------------------------------------------------------------
async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  profile: EmployeeProfile,
): Promise<{ briefs_picked_up: number; projects_reviewed: number; actions: string[] }> {
  const actions: string[] = [];

  // 1. Ramasser les nouveaux briefs
  const { data: newBriefs } = await supabase
    .from('briefs')
    .select('id, description, user_id, statut')
    .not('statut', 'in', '("in_progress","assigned","completed","cancelled")')
    .is('project_id', null)
    .order('created_at', { ascending: true })
    .limit(2);

  for (const brief of newBriefs || []) {
    if (!brief.user_id || !brief.description) continue;
    const pid = await handleIntake(supabase, anthropicKey, resendKey, profile, brief);
    if (pid) actions.push(`intake:${pid}`);
  }

  // 2. Revue du portefeuille — Claude décide pour chaque projet
  const { projects_reviewed, actions: ownerActions } = await reviewOwnerPortfolio(
    supabase, anthropicKey, resendKey, profile,
  );
  actions.push(...ownerActions);

  // 3. Révisions → internal_requests
  const revisionsCreated = await processRevisionRequests(supabase);
  if (revisionsCreated > 0) actions.push(`revision_requests_created:${revisionsCreated}`);

  // 4. Mise à jour des métriques RH
  await updateOwnerMetrics(supabase, anthropicKey, profile);

  return {
    briefs_picked_up: newBriefs?.length || 0,
    projects_reviewed,
    actions,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Charger le profil d'Aria depuis la DB
    const profile = await loadOwnerProfile(supabase);
    if (!profile) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Profil employee_profiles introuvable pour slug=marketing' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const runType = body.run_type || body.type || 'check';

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG,
      run_type: runType,
      status: 'running',
      started_at: new Date().toISOString(),
    });

    const result = await handleCheck(supabase, anthropicKey, resendKey, profile);

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG,
      run_type: 'daily',
      status: 'completed',
      started_at: new Date().toISOString(),
      decisions: result.actions,
    });

    return new Response(
      JSON.stringify({ ok: true, run_type: runType, ...result, duration_ms: Date.now() - startTime }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[marketing] fatal error:', (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
