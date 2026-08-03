import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import {
  callClaude, cors, loadProfile, loadExperience,
  getClientMemory, updateClientMemory,
  EmployeeProfile, ClientProject,
} from '../_shared/agent-core.ts';

const AGENT_SLUG = 'support';
const DEPARTMENT = 'support';

const CRITICAL_KEYWORDS = [
  'urgent', 'fraude', 'frauduleux', 'piratage', 'piraté', 'hacké', 'hack',
  'arnaque', 'escroc', 'escroquerie', 'vol', 'volé', 'remboursement total',
  'avocat', 'juridique', 'tribunal', 'plainte', 'litige', 'menace',
  'harcèlement', 'illégal', 'données volées', 'sécurité compromise',
  'carte bancaire', 'charge frauduleuse', 'chargeback', 'dispute',
];

function detectCriticalKeywords(ticket: SupportTicket): string {
  const text = `${ticket.subject} ${ticket.description}`.toLowerCase();
  const matched = CRITICAL_KEYWORDS.filter(kw => text.includes(kw));
  return matched.length ? `Mots-clés critiques : ${matched.join(', ')}` : '';
}

async function sendEscalationAlert(
  resendKey: string,
  adminEmail: string,
  project: ClientProject,
  ticket: SupportTicket,
  reason: string,
  kaiResponse: string,
): Promise<void> {
  if (!resendKey || !adminEmail) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Kai — Support AI <kai@creatorflowmarket.com>',
        to: [adminEmail],
        subject: `🚨 Escalade critique — ${project.client_name} : ${ticket.subject.slice(0, 60)}`,
        html: `<h2>🚨 Ticket critique détecté</h2>
<table cellpadding="6" style="border-collapse:collapse">
<tr><td><strong>Client</strong></td><td>${project.client_name}</td></tr>
<tr><td><strong>Projet</strong></td><td>${project.title}</td></tr>
<tr><td><strong>Ticket</strong></td><td>#${ticket.id} — ${ticket.subject}</td></tr>
<tr><td><strong>De</strong></td><td>${ticket.requester_name || 'N/A'} &lt;${ticket.requester_email || 'N/A'}&gt;</td></tr>
</table>
<h3>Raison de l'escalade</h3><p>${reason}</p>
<h3>Message du client</h3>
<blockquote style="border-left:4px solid #dc2626;padding-left:12px;color:#555">${ticket.description.slice(0, 500).replace(/\n/g, '<br>')}</blockquote>
<h3>Réponse de Kai (déjà envoyée au client)</h3>
<p style="color:#555">${kaiResponse.slice(0, 300).replace(/\n/g, '<br>')}</p>
<hr><p style="color:#888;font-size:12px">Kai — Support AI Employee, CreatorFlow Market</p>`,
      }),
    });
    console.log(`[support] Escalation alert sent to ${adminEmail} for ticket #${ticket.id}`);
  } catch (err) {
    console.error('[support] sendEscalationAlert error:', (err as Error).message);
  }
}

interface InternalRequest {
  id: string;
  project_id: string;
  from_dept: string;
  brief: string;
  objective?: string;
  decision_reason?: string;
}

interface SupportAdapter {
  type: 'zendesk' | 'freshdesk' | 'intercom' | 'webhook';
  // Zendesk
  subdomain?: string;
  email?: string;
  api_token?: string;
  // Freshdesk
  api_key?: string;
  // Intercom
  access_token?: string;
  admin_id?: string;
  // Webhook universel
  read_url?: string;
  write_url?: string;
  auth_header?: string;
  // Global
  max_tickets?: number;
}

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  requester_name?: string;
  requester_email?: string;
  created_at?: string;
}

interface ClientProjectWithSupport extends ClientProject {
  support_adapter: SupportAdapter;
}

// ─── TICKET ADAPTERS ─────────────────────────────────────────────────────────

async function fetchZendeskTickets(a: SupportAdapter, since: string, max: number): Promise<SupportTicket[]> {
  const creds = btoa(`${a.email}/token:${a.api_token}`);
  const res = await fetch(
    `https://${a.subdomain}.zendesk.com/api/v2/tickets.json?status=new,open&sort_by=created_at&sort_order=desc&per_page=${max}`,
    { headers: { 'Authorization': `Basic ${creds}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const sinceDate = new Date(since);
  return (data.tickets || [])
    .filter((t: { created_at: string }) => new Date(t.created_at) > sinceDate)
    .map((t: { id: number; subject: string; description: string; via?: { source?: { from?: { name?: string; address?: string } } }; created_at: string }) => ({
      id: String(t.id), subject: t.subject || '', description: t.description || '',
      requester_name: t.via?.source?.from?.name || '', requester_email: t.via?.source?.from?.address || '',
      created_at: t.created_at,
    }));
}

async function replyZendesk(a: SupportAdapter, ticketId: string, body: string): Promise<{ success: boolean; error?: string }> {
  const creds = btoa(`${a.email}/token:${a.api_token}`);
  const res = await fetch(`https://${a.subdomain}.zendesk.com/api/v2/tickets/${ticketId}.json`, {
    method: 'PUT',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket: { comment: { body, public: true }, status: 'pending' } }),
  });
  return res.ok ? { success: true } : { success: false, error: (await res.text()).slice(0, 200) };
}

async function fetchFreshdeskTickets(a: SupportAdapter, since: string, max: number): Promise<SupportTicket[]> {
  const creds = btoa(`${a.api_key}:X`);
  const res = await fetch(
    `https://${a.subdomain}.freshdesk.com/api/v2/tickets?filter=new_and_my_open&per_page=${max}&order_type=desc`,
    { headers: { 'Authorization': `Basic ${creds}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const sinceDate = new Date(since);
  return (Array.isArray(data) ? data : [])
    .filter((t: { created_at: string }) => new Date(t.created_at) > sinceDate)
    .map((t: { id: number; subject: string; description_text: string; email?: string; created_at: string }) => ({
      id: String(t.id), subject: t.subject || '', description: t.description_text || '',
      requester_email: t.email || '', created_at: t.created_at,
    }));
}

async function replyFreshdesk(a: SupportAdapter, ticketId: string, body: string): Promise<{ success: boolean; error?: string }> {
  const creds = btoa(`${a.api_key}:X`);
  const res = await fetch(`https://${a.subdomain}.freshdesk.com/api/v2/tickets/${ticketId}/reply`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: `<p>${body.replace(/\n/g, '<br>')}</p>` }),
  });
  return res.ok ? { success: true } : { success: false, error: (await res.text()).slice(0, 200) };
}

async function fetchIntercomTickets(a: SupportAdapter, since: string, max: number): Promise<SupportTicket[]> {
  const sinceTs = Math.floor(new Date(since).getTime() / 1000);
  const res = await fetch(`https://api.intercom.io/conversations?state=open&created_since=${sinceTs}&per_page=${max}`, {
    headers: { 'Authorization': `Bearer ${a.access_token}`, 'Accept': 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.conversations || []).map((c: { id: string; source?: { subject?: string; body?: string; author?: { name?: string; email?: string } }; created_at?: number }) => ({
    id: c.id, subject: c.source?.subject || 'Support request',
    description: (c.source?.body || '').replace(/<[^>]*>/g, ''),
    requester_name: c.source?.author?.name || '', requester_email: c.source?.author?.email || '',
    created_at: c.created_at ? new Date(c.created_at * 1000).toISOString() : '',
  }));
}

async function replyIntercom(a: SupportAdapter, conversationId: string, body: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`https://api.intercom.io/conversations/${conversationId}/reply`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${a.access_token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ type: 'admin', admin_id: a.admin_id, message_type: 'comment', body }),
  });
  return res.ok ? { success: true } : { success: false, error: (await res.text()).slice(0, 200) };
}

async function fetchWebhookTickets(a: SupportAdapter, since: string, max: number): Promise<SupportTicket[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (a.auth_header) headers['Authorization'] = a.auth_header;
  const res = await fetch(a.read_url!, { method: 'POST', headers, body: JSON.stringify({ since, max }) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.tickets || data || []).slice(0, max);
}

async function replyWebhook(a: SupportAdapter, ticketId: string, body: string): Promise<{ success: boolean; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (a.auth_header) headers['Authorization'] = a.auth_header;
  const res = await fetch(a.write_url!, {
    method: 'POST', headers,
    body: JSON.stringify({ ticket_id: ticketId, reply: body, replied_at: new Date().toISOString() }),
  });
  return res.ok ? { success: true } : { success: false, error: (await res.text()).slice(0, 200) };
}

async function fetchTickets(adapter: SupportAdapter, since: string): Promise<SupportTicket[]> {
  const max = adapter.max_tickets || 5;
  try {
    if (adapter.type === 'zendesk') return await fetchZendeskTickets(adapter, since, max);
    if (adapter.type === 'freshdesk') return await fetchFreshdeskTickets(adapter, since, max);
    if (adapter.type === 'intercom') return await fetchIntercomTickets(adapter, since, max);
    if (adapter.type === 'webhook' && adapter.read_url) return await fetchWebhookTickets(adapter, since, max);
    return [];
  } catch (err) {
    console.error('[support] fetchTickets error:', (err as Error).message);
    return [];
  }
}

async function postReply(adapter: SupportAdapter, ticketId: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (adapter.type === 'zendesk') return await replyZendesk(adapter, ticketId, body);
    if (adapter.type === 'freshdesk') return await replyFreshdesk(adapter, ticketId, body);
    if (adapter.type === 'intercom') return await replyIntercom(adapter, ticketId, body);
    if (adapter.type === 'webhook' && adapter.write_url) return await replyWebhook(adapter, ticketId, body);
    return { success: false, error: `Adapter "${adapter.type}" non reconnu ou write_url manquant` };
  } catch (err) {
    return { success: false, error: (err as Error).message.slice(0, 200) };
  }
}

function buildTicketResponsePrompt(
  profile: EmployeeProfile,
  project: ClientProject,
  ticket: SupportTicket,
  experience: string,
  clientMemory: string,
  criticalAlert: string,
): string {
  return `${profile.system_prompt_context}
${experience ? '\n═══ TON EXPÉRIENCE & KNOWLEDGE BASE ═══\n' + experience.slice(0, 600) + '\nApplique ce savoir pour répondre précisément.\n' : ''}
${clientMemory ? '\n═══ MÉMOIRE CLIENT ═══\n' + clientMemory + '\nAdapte le ton et les références aux habitudes connues de ce client.\n' : ''}
${criticalAlert ? '\n⚠️ ALERTE CRITIQUE ═══\n' + criticalAlert + '\nCe ticket est pré-identifié critique. Réponds avec empathie maximale, sois rassurant, et indique clairement qu\'une intervention humaine suit.\n' : ''}
═══ CONTEXTE PROJET ═══
Client : ${project.client_name}
Projet : ${project.title}
Objectif : ${(project.objective || '').slice(0, 300)}

═══ TICKET DE SUPPORT ═══
Sujet : ${ticket.subject}
De : ${ticket.requester_name || 'Utilisateur'}${ticket.requester_email ? ' <' + ticket.requester_email + '>' : ''}
Message :
${ticket.description.slice(0, 800)}

Rédige une réponse professionnelle, directe et utile.
- Réponds précisément à la question posée
- Ton adapté au profil du client (${project.client_name})
- Maximum 3 paragraphes courts
- Termine par une proposition d'aide supplémentaire
- En français, sauf si le ticket est dans une autre langue

[RÉPONSE]
La réponse complète, prête à envoyer.

[ESCALADE]
OUI ou NON. Si OUI, 1 phrase expliquant pourquoi une intervention humaine est nécessaire.`;
}

async function processSupportTickets(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  adminEmail: string,
  profile: EmployeeProfile,
): Promise<{ tickets_processed: number; actions: string[] }> {
  const experience = await loadExperience(supabase, AGENT_SLUG);
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  const { data: projects } = await supabase
    .from('client_projects')
    .select('id, title, client_name, client_email, objective, support_adapter')
    .eq('status', 'active')
    .not('support_adapter', 'is', null);

  const actions: string[] = [];
  let totalProcessed = 0;

  for (const project of (projects || []) as ClientProjectWithSupport[]) {
    const adapter = project.support_adapter;
    const tickets = await fetchTickets(adapter, since);
    if (!tickets.length) continue;

    console.log(`[support] ${tickets.length} ticket(s) for project ${project.id} (${adapter.type})`);

    const clientMemory = await getClientMemory(supabase, project.client_email || '', DEPARTMENT);
    let ticketsSummary = '';

    for (const ticket of tickets) {
      try {
        const criticalAlert = detectCriticalKeywords(ticket);
        if (criticalAlert) console.log(`[support] 🚨 Critical ticket #${ticket.id}: ${criticalAlert}`);

        const raw = await callClaude(anthropicKey, 600,
          buildTicketResponsePrompt(profile, project, ticket, experience, clientMemory, criticalAlert));

        const replyMatch = raw.match(/\[RÉPONSE\]([\s\S]*?)(?=\[ESCALADE\]|$)/);
        const escaladeMatch = raw.match(/\[ESCALADE\]([\s\S]*?)$/);
        const reply = replyMatch ? replyMatch[1].trim() : raw.slice(0, 500);
        const escaladeText = escaladeMatch ? escaladeMatch[1].trim() : 'NON';
        const needsEscalation = escaladeText.toUpperCase().startsWith('OUI');

        const result = await postReply(adapter, ticket.id, reply);

        // Escalade : mot-clé critique OU Claude dit OUI
        const finalEscalation = needsEscalation || !!criticalAlert;
        const escalationReason = criticalAlert
          ? `${criticalAlert}${needsEscalation ? ' — Confirmé par Kai : ' + escaladeText.slice(4, 100) : ''}`
          : escaladeText.slice(4, 200);

        await supabase.from('project_history').insert({
          project_id: project.id,
          event_type: finalEscalation ? 'support_escalated' : 'support_ticket_answered',
          old_value: { ticket_id: ticket.id, status: 'open' },
          new_value: { ticket_id: ticket.id, replied: result.success, escalation: finalEscalation, critical_keyword: !!criticalAlert, adapter_type: adapter.type },
          actor_type: 'agent',
          note: finalEscalation
            ? `🚨 ${profile.name} — Escalade ticket #${ticket.id} : "${ticket.subject.slice(0, 60)}". ${escalationReason.slice(0, 150)}`
            : `${profile.name} — Ticket #${ticket.id} traité (${adapter.type}) : "${ticket.subject.slice(0, 60)}". Répondu : ${result.success}`,
        });

        if (finalEscalation) {
          // Email d'alerte immédiat à l'admin
          await sendEscalationAlert(resendKey, adminEmail, project, ticket, escalationReason, reply);

          await supabase.from('internal_requests').insert({
            project_id: project.id,
            from_dept: 'support',
            to_dept: 'marketing',
            brief: `🚨 ESCALADE SUPPORT\n\nTicket #${ticket.id} : "${ticket.subject}"\n\nRaison : ${escalationReason.slice(0, 200)}\n\nMessage original :\n${ticket.description.slice(0, 300)}`,
            decision_reason: criticalAlert ? 'Ticket critique détecté automatiquement par Kai — mots-clés critiques' : 'Ticket complexe détecté par Kai — requiert intervention ou décision Aria',
            status: 'pending',
          });
        }

        ticketsSummary += `Ticket #${ticket.id} — "${ticket.subject.slice(0, 60)}" : ${finalEscalation ? 'escaladé🚨' : 'répondu'}. `;
        totalProcessed++;
        actions.push(`ticket:${ticket.id.slice(0, 8)}:${result.success ? 'replied' : 'failed'}${finalEscalation ? ':escalated' : ''}${criticalAlert ? ':critical' : ''}`);
      } catch (err) {
        console.error(`[support] ticket ${ticket.id} error:`, (err as Error).message);
      }
    }

    if (ticketsSummary) {
      await updateClientMemory(supabase, anthropicKey, project.client_email || '', project.title, 'tickets_support', ticketsSummary.trim(), profile.name, profile.title, DEPARTMENT);
    }
  }

  // Enrichir la knowledge base de Kai après chaque batch de tickets
  if (totalProcessed > 0) {
    const globalSummary = actions.join(' | ');
    await synthesizeExperience(supabase, anthropicKey, profile,
      { id: '', title: `${totalProcessed} ticket(s) traité(s)`, client_name: 'multi-clients', client_email: '' } as ClientProject,
      'ticket_batch', globalSummary,
    );
  }

  return { tickets_processed: totalProcessed, actions };
}

// ─────────────────────────────────────────────────────────────────────────────


async function synthesizeExperience(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
  project: ClientProject,
  deliverableType: string,
  summary: string,
): Promise<void> {
  try {
    const { data: exp } = await supabase
      .from('employee_experience')
      .select('experience_text, projects_count')
      .eq('employee_slug', profile.slug)
      .single();

    const count = (exp?.projects_count || 0) + 1;
    const currentExp = exp?.experience_text || '';

    const prompt = `Tu es ${profile.name}, ${profile.title} chez CreatorFlow Market.

${currentExp ? `EXPÉRIENCE ACTUELLE (${exp?.projects_count || 0} interactions) :\n${currentExp.slice(0, 600)}\n` : ''}
NOUVELLES INTERACTIONS TRAITÉES :
Contexte : ${project.client_name} — ${project.title}
Type : ${deliverableType}
Résumé : ${summary.slice(0, 300)}

Synthétise ta base de connaissance en 2 sections :

PATTERNS (5-7 bullets, 1 ligne chacun) :
Types de demandes récurrentes, ton le plus efficace, signaux d'escalade, points de friction onboarding, cas complexes résolus.

KNOWLEDGE BASE (3-5 Q/R) :
Questions client fréquentes avec les meilleures réponses validées. Format strict :
Q: [question du client en clair]
R: [réponse concise et actionnable, max 2 phrases]

Commence directement par "PATTERNS" sans introduction. Aucune conclusion.`;

    const newExp = await callClaude(anthropicKey, 600, prompt);
    await supabase.from('employee_experience').update({
      experience_text: newExp.trim(),
      projects_count: count,
      last_synthesized: new Date().toISOString(),
    }).eq('employee_slug', profile.slug);
  } catch (err) {
    console.error('[support] synthesizeExperience error:', (err as Error).message);
  }
}

async function updateMetrics(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
): Promise<void> {
  try {
    const [totalRes, completedRes, activeRes, durationRes] = await Promise.all([
      supabase.from('internal_requests').select('*', { count: 'exact', head: true }).eq('to_dept', DEPARTMENT),
      supabase.from('internal_requests').select('*', { count: 'exact', head: true }).eq('to_dept', DEPARTMENT).eq('status', 'completed'),
      supabase.from('internal_requests').select('*', { count: 'exact', head: true }).eq('to_dept', DEPARTMENT).in('status', ['pending', 'in_progress']),
      supabase.from('internal_requests').select('created_at, completed_at').eq('to_dept', DEPARTMENT).eq('status', 'completed').not('completed_at', 'is', null).limit(50),
    ]);

    const total = totalRes.count || 0;
    const completed = completedRes.count || 0;
    const active = activeRes.count || 0;
    const successRate = total > 0 ? (completed / total) * 100 : 0;

    let avgDays = 0;
    if (durationRes.data?.length) {
      const ms = durationRes.data.reduce((s: number, r: { created_at: string; completed_at: string }) =>
        s + (new Date(r.completed_at).getTime() - new Date(r.created_at).getTime()), 0);
      avgDays = ms / durationRes.data.length / 86400000;
    }

    const { data: exp } = await supabase.from('employee_experience').select('experience_text').eq('employee_slug', profile.slug).single();

    const metaRaw = await callClaude(anthropicKey, 200, `Tu es ${profile.name}, ${profile.title}.
Métriques : ${total} livrables traités, ${completed} complétés, succès ${successRate.toFixed(0)}%, durée moy ${avgDays.toFixed(1)}j.
${exp?.experience_text ? 'Expérience : ' + exp.experience_text.slice(0, 250) : ''}

Format exact :
[COMPÉTENCES] comp1 | comp2 | comp3
[OBJECTIF] Une phrase sur ton objectif Q3 2026
[FORMATION] Une phrase sur ce que tu travailles à améliorer`);

    const tag = (t: string) => { const m = metaRaw.match(new RegExp(`\\[${t}\\]([^\\n]+)`)); return m ? m[1].trim() : ''; };
    const skills = tag('COMPÉTENCES').split('|').map((s: string) => s.trim()).filter(Boolean);

    await supabase.from('employee_metrics').update({
      total_projects: total,
      active_projects: active,
      completed_projects: completed,
      success_rate: Math.round(successRate * 100) / 100,
      avg_duration_days: Math.round(avgDays * 10) / 10,
      skills_mastered: skills,
      quarterly_objectives: tag('OBJECTIF'),
      training_focus: tag('FORMATION'),
      updated_at: new Date().toISOString(),
    }).eq('employee_slug', profile.slug);
  } catch (err) {
    console.error('[support] updateMetrics error:', (err as Error).message);
  }
}

function buildDeliverablePrompt(
  profile: EmployeeProfile,
  project: ClientProject,
  request: InternalRequest,
  experience: string,
  clientMemory: string,
): string {
  return `${profile.system_prompt_context}
${experience ? '\n═══ TON EXPÉRIENCE ACCUMULÉE ═══\n' + experience.slice(0, 400) + '\nApplique ces apprentissages dans ce livrable.\n' : ''}
${clientMemory ? '\n═══ MÉMOIRE CLIENT ═══\n' + clientMemory + '\nAdapte le livrable aux problèmes récurrents et à l\'environnement technique connu de ce client.\n' : ''}
═══ PROJET CLIENT ═══
Client : ${project.client_name}
Projet : ${project.title}
Objectif général : ${(project.objective || '').slice(0, 400)}

═══ BRIEF D'ARIA ═══
${request.brief}
${request.decision_reason ? `\nContexte de la demande : ${request.decision_reason}` : ''}

Produis le livrable de support demandé. Tu es responsable de la qualité de ton travail.

[TYPE]
faq | templates_réponse | guide_onboarding | matrice_escalade | documentation_produit | autre

[RÉSUMÉ]
2-3 phrases sur ce que tu as produit et pourquoi c'est adapté à ce client.

[LIVRABLE_COMPLET]
Le livrable complet, prêt à l'emploi. Minimum 400 mots.
FAQ : Minimum 10 questions/réponses organisées par thème
Templates : Minimum 5 templates complets avec variables de personnalisation
Guide onboarding : Étapes numérotées + captures d'écran décrites + points de validation
Matrice escalade : Niveaux + critères + procédures + délais + responsables

[NOTES_POUR_ARIA]
2-3 points importants qu'Aria devrait communiquer au client ou surveiller.`;
}

async function executeInternalRequest(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
  request: InternalRequest,
  experience: string,
): Promise<boolean> {
  try {
    const { data: project } = await supabase
      .from('client_projects')
      .select('id, title, client_name, client_email, objective')
      .eq('id', request.project_id)
      .single();
    if (!project) return false;

    await supabase.from('internal_requests').update({ status: 'in_progress' }).eq('id', request.id);

    const clientMemory = await getClientMemory(supabase, project.client_email || '', DEPARTMENT);
    const raw = await callClaude(anthropicKey, 2048, buildDeliverablePrompt(profile, project, request, experience, clientMemory));

    const extract = (tag: string): string => {
      const m = raw.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_ÉÈÀÙÎÔÂÊ]+\\]|$)`));
      return m ? m[1].trim() : '';
    };

    const supportType = extract('TYPE') || 'livrable_support';
    const summary = extract('RÉSUMÉ') || extract('RESUME') || raw.slice(0, 200);
    const deliverable = extract('LIVRABLE_COMPLET') || raw;
    const notes = extract('NOTES_POUR_ARIA') || '';

    await supabase.from('internal_requests').update({
      status: 'completed',
      result: `[${supportType.toUpperCase()}]\n\n${deliverable}`,
      result_summary: `${supportType} — ${summary.slice(0, 200)}${notes ? '\n\nNotes : ' + notes.slice(0, 150) : ''}`,
      completed_at: new Date().toISOString(),
    }).eq('id', request.id);

    await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `${supportType} — ${project.client_name} : ${project.title.slice(0, 50)}`,
      sections: [
        { heading: 'Type', content: supportType },
        { heading: 'Résumé', content: summary },
        { heading: 'Livrable complet', content: deliverable },
        { heading: 'Notes pour Aria', content: notes },
      ],
      report_type: 'support_deliverable',
      content: { project_id: project.id, internal_request_id: request.id },
    });

    await supabase.from('project_history').insert({
      project_id: project.id,
      event_type: 'support_delivered',
      old_value: { request_status: 'pending' },
      new_value: { request_status: 'completed', support_type: supportType },
      actor_type: 'agent',
      note: `${profile.name} — livrable produit : ${supportType}. ${summary.slice(0, 100)}`,
    });

    await synthesizeExperience(supabase, anthropicKey, profile, project, supportType, summary);
    await updateClientMemory(supabase, anthropicKey, project.client_email || '', project.title, supportType, summary, profile.name, profile.title, DEPARTMENT);

    return true;
  } catch (err) {
    console.error('[support] executeInternalRequest error:', (err as Error).message);
    await supabase.from('internal_requests').update({ status: 'pending' }).eq('id', request.id);
    return false;
  }
}

async function processInternalRequests(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
): Promise<{ requests_processed: number; actions: string[] }> {
  const experience = await loadExperience(supabase, AGENT_SLUG);

  const { data: requests } = await supabase
    .from('internal_requests')
    .select('id, project_id, from_dept, brief, objective, decision_reason')
    .eq('to_dept', DEPARTMENT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(3);

  const actions: string[] = [];
  let processed = 0;

  if (requests?.length) {
    for (const request of requests as InternalRequest[]) {
      const success = await executeInternalRequest(supabase, anthropicKey, profile, request, experience);
      if (success) {
        processed++;
        actions.push(`executed:${request.id.slice(0, 8)}`);
      }
    }
  }

  await updateMetrics(supabase, anthropicKey, profile);

  return { requests_processed: processed, actions };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'pjoacenel@gmail.com';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const profile = await loadProfile(supabase, AGENT_SLUG);
    if (!profile) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Profil employee_profiles introuvable pour slug=support' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG, run_type: 'daily',
      status: 'running', started_at: new Date().toISOString(),
    });

    const [internalResult, ticketResult] = await Promise.all([
      processInternalRequests(supabase, anthropicKey, profile),
      processSupportTickets(supabase, anthropicKey, resendKey, adminEmail, profile),
    ]);

    const allActions = [...internalResult.actions, ...ticketResult.actions];

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG, run_type: 'daily',
      status: 'completed', started_at: new Date().toISOString(),
      decisions: allActions,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        requests_processed: internalResult.requests_processed,
        tickets_processed: ticketResult.tickets_processed,
        actions: allActions,
        duration_ms: Date.now() - startTime,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[support] fatal error:', (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
