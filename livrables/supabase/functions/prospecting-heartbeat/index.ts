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

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_SLUG = 'prospecting';
const DEPARTMENT = 'prospecting';

interface EmployeeProfile {
  slug: string;
  name: string;
  title: string;
  system_prompt_context: string;
}

interface InternalRequest {
  id: string;
  project_id: string;
  from_dept: string;
  brief: string;
  objective?: string;
  decision_reason?: string;
}

interface ClientProject {
  id: string;
  title: string;
  client_name: string;
  client_email?: string;
  objective?: string;
}

async function loadProfile(supabase: ReturnType<typeof createClient>): Promise<EmployeeProfile | null> {
  const { data } = await supabase
    .from('employee_profiles')
    .select('slug, name, title, system_prompt_context')
    .eq('slug', AGENT_SLUG)
    .single();
  return data || null;
}

async function loadExperience(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('employee_experience')
    .select('experience_text, projects_count')
    .eq('employee_slug', AGENT_SLUG)
    .single();
  if (!data || !data.experience_text || data.projects_count === 0) return '';
  return data.experience_text;
}

async function getClientMemory(
  supabase: ReturnType<typeof createClient>, clientEmail: string,
): Promise<string> {
  if (!clientEmail) return '';
  const { data } = await supabase
    .from('client_memory')
    .select('memory, projects_count')
    .eq('client_email', clientEmail)
    .eq('department', DEPARTMENT)
    .maybeSingle();
  if (!data) return '';
  return `Client récurrent (${data.projects_count} mission${data.projects_count > 1 ? 's' : ''}) :\n${data.memory}`;
}

async function updateClientMemory(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  clientEmail: string,
  projectTitle: string,
  deliverableType: string,
  summary: string,
): Promise<void> {
  if (!clientEmail) return;
  try {
    const { data: existing } = await supabase
      .from('client_memory')
      .select('memory, projects_count')
      .eq('client_email', clientEmail)
      .eq('department', DEPARTMENT)
      .maybeSingle();

    const count = (existing?.projects_count || 0) + 1;
    const currentMemory = existing?.memory || '';

    const newMemory = await callClaude(anthropicKey, 300,
      `Tu es Maya, Prospecting Employee chez CreatorFlow Market.
${currentMemory ? `MÉMOIRE EXISTANTE (${existing?.projects_count || 0} mission(s)) :\n${currentMemory.slice(0, 400)}\n` : ''}
LIVRABLE VENANT D'ÊTRE PRODUIT :
Projet : ${projectTitle}
Type : ${deliverableType}
Résumé : ${summary.slice(0, 200)}

Synthétise la mémoire client en 5-7 bullet points. Focus : ICP validé, secteurs ciblés, canaux d'acquisition efficaces, séquences qui ont fonctionné, contraintes de prospection spécifiques.
Format : bullet points uniquement, sans intro ni conclusion.`);

    const { error } = await supabase.from('client_memory').upsert({
      client_email: clientEmail,
      department: DEPARTMENT,
      memory: newMemory.trim(),
      projects_count: count,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_email,department' });
    if (error) console.error('[prospecting] updateClientMemory upsert error:', error.message);
  } catch (err) {
    console.error('[prospecting] updateClientMemory error:', (err as Error).message);
  }
}

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

${currentExp ? `EXPÉRIENCE ACTUELLE (${exp?.projects_count || 0} livrables) :\n${currentExp.slice(0, 500)}\n` : ''}
LIVRABLE VENANT D'ÊTRE PRODUIT :
Client : ${project.client_name}
Projet : ${project.title}
Type : ${deliverableType}
Résumé : ${summary.slice(0, 200)}

Synthétise ton expérience accumulée en 8-10 bullet points concis (1 ligne chacun).
Focus : secteurs clients récurrents, ICPs qui fonctionnent, canaux d'acquisition efficaces, erreurs à éviter, séquences qui convertissent.
Format : bullet points uniquement, sans intro ni conclusion.`;

    const newExp = await callClaude(anthropicKey, 400, prompt);
    await supabase.from('employee_experience').update({
      experience_text: newExp.trim(),
      projects_count: count,
      last_synthesized: new Date().toISOString(),
    }).eq('employee_slug', profile.slug);
  } catch (err) {
    console.error('[prospecting] synthesizeExperience error:', (err as Error).message);
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
    console.error('[prospecting] updateMetrics error:', (err as Error).message);
  }
}

function buildDeliverablePrompt(
  profile: EmployeeProfile,
  project: ClientProject,
  request: InternalRequest,
  experience: string,
  clientMemory: string,
  crmContext: string,
  realProspects: string,
  hunterEmails: string,
): string {
  return `${profile.system_prompt_context}
${experience ? '\n═══ TON EXPÉRIENCE ACCUMULÉE ═══\n' + experience.slice(0, 400) + '\nApplique ces apprentissages dans ce livrable.\n' : ''}
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

    const clientMemory = await getClientMemory(supabase, project.client_email || '');
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
          crmSaved += await saveProspectsToCrm(supabase, project.id, request.id, apolloResult.people);
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

    const raw = await callClaude(anthropicKey, 2048, buildDeliverablePrompt(
      profile, project, request, experience, clientMemory, crmContext, realProspects, hunterEmails,
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
    await updateClientMemory(supabase, anthropicKey, project.client_email || '', project.title, prospectingType, summary);

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
  const experience = await loadExperience(supabase);

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

    const profile = await loadProfile(supabase);
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

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG, run_type: 'daily',
      status: 'completed', started_at: new Date().toISOString(),
      decisions: result.actions,
    });

    return new Response(
      JSON.stringify({ ok: true, ...result, duration_ms: Date.now() - startTime }),
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
