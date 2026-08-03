import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import {
  callClaude, cors, loadProfile, loadExperience,
  getClientMemory, updateClientMemory, synthesizeExperience,
  loadWorkforceInsights, upsertWorkforceInsight,
  EmployeeProfile, ClientProject,
} from '../_shared/agent-core.ts';

interface ApolloPerson {
  name?: string;
  title?: string;
  linkedin_url?: string;
  city?: string;
  country?: string;
  organization?: { name?: string };
}

async function apolloSearch(
  apiKey: string,
  titles: string[],
  keywords: string,
  maxResults = 10,
): Promise<{ formatted: string; people: ApolloPerson[] }> {
  if (!apiKey || !keywords.trim()) return { formatted: '', people: [] };
  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({ api_key: apiKey, q_keywords: keywords, person_titles: titles, per_page: maxResults, page: 1 }),
    });
    if (!res.ok) return { formatted: '', people: [] };
    const data = await res.json();
    const people: ApolloPerson[] = data.people || [];
    if (!people.length) return { formatted: '', people: [] };
    const formatted = people.map(p => {
      const company = p.organization?.name || '';
      const location = [p.city, p.country].filter(Boolean).join(', ');
      const linkedin = p.linkedin_url ? `\n  LinkedIn : ${p.linkedin_url}` : '';
      return `• ${p.name || 'N/A'} — ${p.title || 'N/A'}${company ? ' @ ' + company : ''}${location ? ' (' + location + ')' : ''}${linkedin}`;
    }).join('\n\n');
    return { formatted, people };
  } catch (_) { return { formatted: '', people: [] }; }
}

async function saveProspectsToCrm(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  requestId: string,
  people: ApolloPerson[],
  sector: string,
): Promise<number> {
  let saved = 0;
  for (const person of people) {
    if (!person.name) continue;
    try {
      if (person.linkedin_url) {
        const { data: existing } = await supabase
          .from('crm_contacts')
          .select('id')
          .eq('linkedin_url', person.linkedin_url)
          .eq('project_id', projectId)
          .maybeSingle();
        if (existing) continue;
      }
      const { error } = await supabase.from('crm_contacts').insert({
        name: person.name,
        role: person.title || '',
        company: person.organization?.name || '',
        linkedin_url: person.linkedin_url || null,
        sector: sector || null,
        status: 'identified',
        source_mission_id: requestId,
        agent_slug: AGENT_SLUG,
        project_id: projectId,
        notes: `Apollo.io — ${[person.city, person.country].filter(Boolean).join(', ')}`,
        tags: ['apollo', 'ai-identified'],
        next_action: 'outreach_1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (!error) saved++;
    } catch (err) {
      console.error('[prospecting] saveProspectsToCrm error for', person.name, (err as Error).message);
    }
  }
  return saved;
}

async function extractIcpForApollo(
  apiKey: string,
  brief: string,
  objective: string,
): Promise<{ titles: string[]; keywords: string }> {
  try {
    const raw = await callClaude(apiKey, 150,
      `Extrait les critères de recherche de prospects depuis ce brief marketing.

BRIEF : ${brief.slice(0, 400)}
OBJECTIF : ${(objective || '').slice(0, 200)}

Format exact (une ligne chacun, RIEN d'autre) :
[TITRES] titre1 | titre2 | titre3
[MOTS_CLES] industrie secteur type de client en 5 mots max`);

    const titlesMatch = raw.match(/\[TITRES\]([^\n]+)/);
    const kwMatch = raw.match(/\[MOTS_CLES\]([^\n]+)/);
    const titles = titlesMatch ? titlesMatch[1].split('|').map(t => t.trim()).filter(Boolean) : [];
    const keywords = kwMatch ? kwMatch[1].trim() : '';
    return { titles, keywords };
  } catch (_) {
    return { titles: [], keywords: '' };
  }
}

interface HunterEmail {
  value: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  confidence: number;
}

async function hunterDomainSearch(
  apiKey: string,
  domain: string,
  max = 5,
): Promise<{ formatted: string; emails: HunterEmail[] }> {
  if (!apiKey || !domain) return { formatted: '', emails: [] };
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=${max}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return { formatted: '', emails: [] };
    const data = await res.json();
    const emails: HunterEmail[] = data.data?.emails || [];
    if (!emails.length) return { formatted: '', emails: [] };
    const formatted = emails.map(e =>
      `• ${[e.first_name, e.last_name].filter(Boolean).join(' ')} — ${e.value}${e.position ? ' (' + e.position + ')' : ''} [confiance: ${e.confidence}%]`
    ).join('\n');
    return { formatted, emails };
  } catch (_) { return { formatted: '', emails: [] }; }
}

async function saveHunterContactsToCrm(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  requestId: string,
  domain: string,
  emails: HunterEmail[],
): Promise<number> {
  let saved = 0;
  for (const email of emails) {
    if (!email.value) continue;
    try {
      const { data: existing } = await supabase
        .from('crm_contacts')
        .select('id')
        .eq('email', email.value)
        .eq('project_id', projectId)
        .maybeSingle();
      if (existing) continue;
      const name = [email.first_name, email.last_name].filter(Boolean).join(' ');
      const { error } = await supabase.from('crm_contacts').insert({
        name: name || email.value,
        email: email.value,
        role: email.position || '',
        company: domain,
        website: `https://${domain}`,
        status: 'email_verified',
        source_mission_id: requestId,
        agent_slug: AGENT_SLUG,
        project_id: projectId,
        notes: `Hunter.io — confiance ${email.confidence}%`,
        tags: ['hunter', 'email-verified'],
        next_action: 'outreach_1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (!error) saved++;
    } catch (err) {
      console.error('[prospecting] saveHunterContactsToCrm error:', (err as Error).message);
    }
  }
  return saved;
}

async function extractDomainsForHunter(
  anthropicKey: string, brief: string, objective: string,
): Promise<string[]> {
  try {
    const raw = await callClaude(anthropicKey, 80,
      `Extrait les noms de domaine web (ex: exemple.com) mentionnés ou implicites dans ce brief de prospection.
BRIEF : ${brief.slice(0, 300)}
OBJECTIF : ${(objective || '').slice(0, 150)}
Réponds UNIQUEMENT avec les domaines séparés par des virgules. Si aucun domaine identifiable, réponds AUCUN.`);
    if (!raw || raw.trim().toUpperCase().includes('AUCUN')) return [];
    return raw.split(',')
      .map(d => d.trim().replace(/^https?:\/\//, '').split('/')[0].toLowerCase())
      .filter(d => d.includes('.') && d.length > 3);
  } catch (_) { return []; }
}

interface CrmContact {
  name: string;
  role?: string;
  company?: string;
  email?: string;
  status?: string;
  next_action?: string;
}

async function loadProjectCrmContacts(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
): Promise<string> {
  const { data } = await supabase
    .from('crm_contacts')
    .select('name, role, company, email, status, next_action')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(25);
  if (!data || !data.length) return '';
  const lines = (data as CrmContact[]).map(c => {
    const email = c.email ? ` — ${c.email}` : '';
    const action = c.next_action ? ` [→ ${c.next_action}]` : '';
    return `• ${c.name} — ${c.role || 'N/A'} @ ${c.company || 'N/A'}${email} [${c.status}]${action}`;
  });
  return `${data.length} contact(s) déjà dans le CRM :\n${lines.join('\n')}`;
}

const AGENT_SLUG = 'prospecting';
const DEPARTMENT = 'prospecting';

interface InternalRequest {
  id: string;
  project_id: string;
  from_dept: string;
  brief: string;
  objective?: string;
  decision_reason?: string;
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
    console.error('[prospecting] updateMetrics error:', (err as Error).message);
  }
}

function buildDeliverablePrompt(
  profile: EmployeeProfile,
  project: ClientProject,
  request: InternalRequest,
  experience: string,
  clientMemory: string,
  workforceInsights: string,
  crmContext: string,
  realProspects: string,
  hunterEmails: string,
): string {
  return `${profile.system_prompt_context}
${experience ? '\n═══ TON EXPÉRIENCE ACCUMULÉE ═══\n' + experience.slice(0, 400) + '\nApplique ces apprentissages dans ce livrable.\n' : ''}
${workforceInsights ? '\n═══ PATTERNS DÉTECTÉS SUR TOUTE LA PLATEFORME ═══\n' + workforceInsights + '\nCes patterns sont agrégés sur l\'ensemble des clients, pas seulement celui-ci. Utilise-les pour calibrer l\'ICP et prioriser les secteurs qui convertissent le mieux.\n' : ''}
${clientMemory ? '\n═══ MÉMOIRE CLIENT ═══\n' + clientMemory + '\nUtilise cette connaissance pour affiner l\'ICP, éviter de cibler des segments déjà épuisés et adapter la séquence outreach.\n' : ''}
${crmContext ? '\n═══ PIPELINE CRM ACTUEL ═══\n' + crmContext + '\nCes contacts sont déjà identifiés. Ne les re-cible pas — concentre-toi sur de nouveaux segments ou sur la progression de leur séquence outreach.\n' : ''}
${realProspects ? '\n═══ VRAIS PROSPECTS (Apollo.io — sauvegardés en CRM) ═══\n' + realProspects + '\nCes contacts ont été ajoutés automatiquement au CRM. Produis les livrables pour les activer.\n' : ''}
${hunterEmails ? '\n═══ EMAILS VÉRIFIÉS (Hunter.io — sauvegardés en CRM) ═══\n' + hunterEmails + '\nCes emails vérifiés sont dans le CRM. Intègre-les dans la séquence outreach.\n' : ''}
═══ PROJET CLIENT ═══
Client : ${project.client_name}
Projet : ${project.title}
Objectif général : ${(project.objective || '').slice(0, 400)}

═══ BRIEF D'ARIA ═══
${request.brief}
${request.decision_reason ? `\nContexte de la demande : ${request.decision_reason}` : ''}

Produis le livrable de prospection demandé. Tu es responsable de la qualité de ton travail.

[TYPE]
icp_persona | liste_prospects | séquence_outreach | stratégie_acquisition | qualification_leads | autre

[RÉSUMÉ]
2-3 phrases sur ce que tu as produit et pourquoi c'est adapté à ce client.

[LIVRABLE_COMPLET]
Le livrable complet, actionnable immédiatement. Minimum 400 mots.
ICP : Démographique + Psychographique + Points de douleur + Canaux préférés
Liste : Minimum 10 profils avec Nom/Poste/Entreprise/Raison de ciblage
Séquence : 5 messages complets (J1, J3, J7, J14, J30) avec objets et personnalisation
Stratégie : Canaux + Messagerie + KPIs + Plan 90 jours

[NOTES_POUR_ARIA]
2-3 points importants qu'Aria devrait communiquer au client ou décisions à prendre.`;
}

async function executeInternalRequest(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  apolloApiKey: string,
  hunterApiKey: string,
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
    const briefLower = (request.brief || '').toLowerCase();
    let crmSaved = 0;

    // Apollo — profils réels + sauvegarde CRM immédiate
    let realProspects = '';
    const needsRealProspects = ['liste_prospects', 'liste de prospects', 'liste prospects', 'trouver des prospects', 'contacts réels'].some(k => briefLower.includes(k));
    if (needsRealProspects && apolloApiKey) {
      const icp = await extractIcpForApollo(anthropicKey, request.brief, project.objective || '');
      if (icp.keywords || icp.titles.length) {
        const apolloResult = await apolloSearch(apolloApiKey, icp.titles, icp.keywords, 10);
        realProspects = apolloResult.formatted;
        if (apolloResult.people.length) {
          crmSaved += await saveProspectsToCrm(supabase, project.id, request.id, apolloResult.people, icp.keywords);
          console.log(`[prospecting] Apollo → ${apolloResult.people.length} prospects trouvés, ${crmSaved} sauvegardés en CRM`);
        }
      }
    }

    // CRM context : contacts déjà identifiés pour ce projet
    const crmContext = await loadProjectCrmContacts(supabase, project.id);

    // Hunter.io — emails vérifiés + sauvegarde CRM
    let hunterEmails = '';
    const needsEmails = ['email', 'trouver emails', 'email finder', 'emails vérifiés', 'contacts email', 'outreach'].some(k => briefLower.includes(k));
    if (needsEmails && hunterApiKey) {
      const domains = await extractDomainsForHunter(anthropicKey, request.brief, project.objective || '');
      const parts: string[] = [];
      for (const domain of domains.slice(0, 3)) {
        const hunterResult = await hunterDomainSearch(hunterApiKey, domain, 5);
        if (hunterResult.formatted) parts.push(`${domain} :\n${hunterResult.formatted}`);
        if (hunterResult.emails.length) {
          const hunterSaved = await saveHunterContactsToCrm(supabase, project.id, request.id, domain, hunterResult.emails);
          crmSaved += hunterSaved;
          console.log(`[prospecting] Hunter → ${domain}: ${hunterResult.emails.length} emails, ${hunterSaved} sauvegardés en CRM`);
        }
      }
      hunterEmails = parts.join('\n\n');
    }

    const workforceInsights = await loadWorkforceInsights(supabase, DEPARTMENT);

    const raw = await callClaude(anthropicKey, 2048, buildDeliverablePrompt(
      profile, project, request, experience, clientMemory, workforceInsights, crmContext, realProspects, hunterEmails,
    ));

    const extract = (tag: string): string => {
      const m = raw.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_ÉÈÀÙÎÔÂÊ]+\\]|$)`));
      return m ? m[1].trim() : '';
    };

    const prospectingType = extract('TYPE') || 'livrable_prospection';
    const summary = extract('RÉSUMÉ') || extract('RESUME') || raw.slice(0, 200);
    const deliverable = extract('LIVRABLE_COMPLET') || raw;
    const notes = extract('NOTES_POUR_ARIA') || '';

    const crmNote = crmSaved > 0 ? `\n\n${crmSaved} prospect(s) ajouté(s) au CRM.` : '';

    await supabase.from('internal_requests').update({
      status: 'completed',
      result: `[${prospectingType.toUpperCase()}]\n\n${deliverable}`,
      result_summary: `${prospectingType} — ${summary.slice(0, 200)}${notes ? '\n\nNotes : ' + notes.slice(0, 150) : ''}${crmNote}`,
      completed_at: new Date().toISOString(),
    }).eq('id', request.id);

    await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `${prospectingType} — ${project.client_name} : ${project.title.slice(0, 50)}`,
      sections: [
        { heading: 'Type', content: prospectingType },
        { heading: 'Résumé', content: summary },
        { heading: 'Livrable complet', content: deliverable },
        { heading: 'Notes pour Aria', content: notes },
        { heading: 'CRM', content: crmSaved > 0 ? `${crmSaved} contacts sauvegardés` : 'Aucun contact CRM ajouté cette mission' },
      ],
      report_type: 'prospecting_deliverable',
      content: { project_id: project.id, internal_request_id: request.id, crm_contacts_saved: crmSaved },
    });

    await supabase.from('project_history').insert({
      project_id: project.id,
      event_type: 'prospecting_delivered',
      old_value: { request_status: 'pending' },
      new_value: { request_status: 'completed', prospecting_type: prospectingType, crm_contacts_saved: crmSaved },
      actor_type: 'agent',
      note: `${profile.name} — ${prospectingType} livré. ${crmSaved > 0 ? crmSaved + ' contacts CRM ajoutés. ' : ''}${summary.slice(0, 100)}`,
    });

    await synthesizeExperience(supabase, anthropicKey, profile, project, prospectingType, summary);
    await updateClientMemory(supabase, anthropicKey, project.client_email || '', project.title, prospectingType, summary, profile.name, profile.title, DEPARTMENT);

    // Notifier Aria quand des prospects avec emails vérifiés sont prêts pour outreach
    if (crmSaved > 0) {
      const typeIsOutreach = ['outreach', 'séquence', 'liste', 'prospect'].some(k =>
        prospectingType.toLowerCase().includes(k),
      );
      if (typeIsOutreach) {
        await supabase.from('internal_requests').insert({
          project_id: project.id,
          from_dept: DEPARTMENT,
          to_dept: 'marketing',
          brief: `🎯 OUTREACH PRÊT — Maya a complété\n\n${crmSaved} prospect(s) avec emails vérifiés ajoutés au CRM.\nType de livrable : ${prospectingType}\nRésumé : ${summary.slice(0, 200)}\n\nLivrable complet disponible dans le rapport Maya. Maya recommande d'informer le client que sa campagne outreach est prête et de lui présenter le template J1.`,
          decision_reason: 'Maya a identifié des prospects avec emails vérifiés — campagne outreach prête pour revue client',
          status: 'pending',
        });
        console.log(`[prospecting] Aria notifiée : ${crmSaved} prospects CRM prêts pour outreach`);
      }
    }

    return true;
  } catch (err) {
    console.error('[prospecting] executeInternalRequest error:', (err as Error).message);
    await supabase.from('internal_requests').update({ status: 'pending' }).eq('id', request.id);
    return false;
  }
}

async function processInternalRequests(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  apolloApiKey: string,
  hunterApiKey: string,
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
      const success = await executeInternalRequest(supabase, anthropicKey, apolloApiKey, hunterApiKey, profile, request, experience);
      if (success) {
        processed++;
        actions.push(`executed:${request.id.slice(0, 8)}`);
      }
    }
  }

  await updateMetrics(supabase, anthropicKey, profile);

  return { requests_processed: processed, actions };
}

// ---------------------------------------------------------------------------
// Séquences outreach — Maya génère les emails personnalisés pour chaque prospect
// ---------------------------------------------------------------------------
interface CrmContact {
  id: string;
  project_id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  icp_score: number;
  notes: string;
}

interface ProjectInfo {
  id: string;
  title: string;
  objective: string;
  client_name: string;
  client_email: string;
}

async function processOutreachDrafts(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  profile: EmployeeProfile,
): Promise<number> {
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id, project_id, name, email, role, company, icp_score, notes')
    .eq('next_action', 'outreach_1')
    .not('email', 'is', null)
    .neq('email', '')
    .order('icp_score', { ascending: false })
    .limit(15);

  if (!contacts?.length) return 0;

  // Grouper par projet
  const byProject = new Map<string, CrmContact[]>();
  for (const c of contacts as CrmContact[]) {
    if (!byProject.has(c.project_id)) byProject.set(c.project_id, []);
    byProject.get(c.project_id)!.push(c);
  }

  let drafted = 0;

  for (const [projectId, projectContacts] of byProject) {
    const { data: project } = await supabase
      .from('client_projects')
      .select('id, title, objective, client_name, client_email')
      .eq('id', projectId)
      .eq('status', 'active')
      .maybeSingle();

    if (!project) continue;

    const contactsToProcess = projectContacts.slice(0, 5);
    const drafts: string[] = [];

    for (const contact of contactsToProcess) {
      try {
        const prompt = `Tu es ${profile.name}, ${profile.title} de CreatorFlow Market.

Tu prépares un email d'outreach B2B pour le client "${(project as ProjectInfo).client_name}" qui vise à contacter "${contact.name}" (${contact.role}${contact.company ? ' @ ' + contact.company : ''}).

Objectif du client : ${(project as ProjectInfo).objective || (project as ProjectInfo).title}
Score ICP du prospect : ${contact.icp_score || 5}/10
Notes : ${contact.notes ? contact.notes.slice(0, 200) : 'Aucune'}

Rédige un email d'outreach B2B professionnel, court et percutant.
Réponds UNIQUEMENT dans ce format exact :
OBJET: [sujet max 60 caractères]
CORPS:
[3-4 phrases max. Personnalisé au rôle/entreprise. Appel à l'action clair (ex: "15 min de call ?"). Ton pro mais humain.]`;

        const emailDraft = await callClaude(anthropicKey, 400, prompt);
        const subject = emailDraft.match(/OBJET:\s*(.+)/)?.[1]?.trim() || `Opportunité — ${contact.name}`;
        const body = emailDraft.match(/CORPS:\s*([\s\S]+)/)?.[1]?.trim() || emailDraft;

        drafts.push(
          `### ${contact.name} — ${contact.role}${contact.company ? ' @ ' + contact.company : ''}\n` +
          `**Email :** ${contact.email}\n\n` +
          `**Objet :** ${subject}\n\n` +
          `${body}`,
        );

        await supabase.from('crm_contacts').update({
          next_action: 'outreach_drafted',
          last_contacted_at: new Date().toISOString(),
          notes: `${(contact.notes || '').trim()}\n[Draft outreach_1 généré le ${new Date().toISOString().slice(0, 10)}]`.trim(),
          updated_at: new Date().toISOString(),
        }).eq('id', contact.id);

        drafted++;
      } catch (err) {
        console.error(`[prospecting] draft error for ${contact.id}:`, (err as Error).message);
      }
    }

    if (!drafts.length) continue;

    await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `Outreach prêt — ${(project as ProjectInfo).client_name} : ${drafts.length} email(s) personnalisé(s)`,
      sections: [
        {
          heading: 'Résumé',
          content: `${drafts.length} email(s) d'outreach rédigé(s) et prêts à envoyer pour le projet "${(project as ProjectInfo).title}".`,
        },
        { heading: 'Emails à envoyer', content: drafts.join('\n\n---\n\n') },
      ],
      report_type: 'outreach_sequence',
      content: {
        project_id: projectId,
        contacts_count: drafts.length,
        contact_ids: contactsToProcess.map((c) => c.id),
      },
    });

    // Notifier Aria pour qu'elle prévienne le client
    await supabase.from('internal_requests').insert({
      project_id: projectId,
      from_dept: DEPARTMENT,
      to_dept: 'marketing',
      brief: `📩 OUTREACH PRÊT — ${drafts.length} email(s) personnalisé(s) pour "${(project as ProjectInfo).title}"\n\nPremier exemple :\n${drafts[0].slice(0, 600)}`,
      objective: 'Informer le client que ses emails d\'outreach sont prêts à envoyer',
      decision_reason: `Maya a rédigé ${drafts.length} email(s) outreach personnalisé(s) — client doit valider et envoyer`,
      status: 'pending',
    });

    console.log(`[prospecting] outreach drafted: ${drafts.length} emails for project ${projectId}`);
  }

  return drafted;
}

// ---------------------------------------------------------------------------
// computeProspectingInsights — détecte les patterns de conversion par secteur
// à l'échelle de toute la plateforme (P0-2 : mémoire analytique cross-clients)
// ---------------------------------------------------------------------------
const CONVERTED_STATUSES = ['qualified', 'meeting_scheduled', 'won'];
const MIN_SAMPLE_SIZE = 10;

async function computeProspectingInsights(
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('sector, status')
    .eq('agent_slug', AGENT_SLUG)
    .not('sector', 'is', null)
    .neq('sector', '');

  if (!contacts?.length) return 0;

  const bySector = new Map<string, { total: number; converted: number }>();
  for (const c of contacts as { sector: string; status: string }[]) {
    const key = c.sector.trim().toLowerCase();
    if (!key) continue;
    const stats = bySector.get(key) || { total: 0, converted: 0 };
    stats.total++;
    if (CONVERTED_STATUSES.includes(c.status)) stats.converted++;
    bySector.set(key, stats);
  }

  let updated = 0;
  for (const [sector, stats] of bySector) {
    if (stats.total < MIN_SAMPLE_SIZE) continue;
    const rate = Math.round((stats.converted / stats.total) * 100);
    await upsertWorkforceInsight(
      supabase,
      DEPARTMENT,
      `secteur_${sector.replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`,
      `Secteur "${sector}" : ${rate}% de conversion (${stats.converted}/${stats.total} prospects qualifiés ou plus).`,
      stats.total,
    );
    updated++;
  }
  return updated;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const startTime = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY') || '';
    const hunterApiKey = Deno.env.get('HUNTER_API_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const profile = await loadProfile(supabase, AGENT_SLUG);
    if (!profile) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Profil employee_profiles introuvable pour slug=prospecting' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG, run_type: 'daily',
      status: 'running', started_at: new Date().toISOString(),
    });

    const result = await processInternalRequests(supabase, anthropicKey, apolloApiKey, hunterApiKey, profile);

    // Séquences outreach — génère les emails pour les prospects qualifiés
    const outreachDrafted = await processOutreachDrafts(supabase, anthropicKey, profile);
    if (outreachDrafted > 0) result.actions.push(`outreach_drafted:${outreachDrafted}`);

    // Mémoire analytique cross-clients — détecte les patterns de conversion par secteur
    const insightsUpdated = await computeProspectingInsights(supabase);
    if (insightsUpdated > 0) result.actions.push(`insights_updated:${insightsUpdated}`);

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG, run_type: 'daily',
      status: 'completed', started_at: new Date().toISOString(),
      decisions: result.actions,
    });

    return new Response(
      JSON.stringify({ ok: true, ...result, outreach_drafted: outreachDrafted, duration_ms: Date.now() - startTime }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[prospecting] fatal error:', (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
