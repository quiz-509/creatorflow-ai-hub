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

const AGENT_SLUG = 'content';
const DEPARTMENT = 'content';

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
Focus : types de livrables maîtrisés, profils clients récurrents, ce qui fonctionne, difficultés, meilleures pratiques.
Format : bullet points uniquement, sans intro ni conclusion.`;

    const newExp = await callClaude(anthropicKey, 400, prompt);
    await supabase.from('employee_experience').update({
      experience_text: newExp.trim(),
      projects_count: count,
      last_synthesized: new Date().toISOString(),
    }).eq('employee_slug', profile.slug);
  } catch (err) {
    console.error('[content] synthesizeExperience error:', (err as Error).message);
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
    console.error('[content] updateMetrics error:', (err as Error).message);
  }
}

function buildDeliverablePrompt(
  profile: EmployeeProfile,
  project: ClientProject,
  request: InternalRequest,
  experience: string,
): string {
  return `${profile.system_prompt_context}
${experience ? '\n═══ TON EXPÉRIENCE ACCUMULÉE ═══\n' + experience.slice(0, 400) + '\nApplique ces apprentissages dans ce livrable.\n' : ''}
═══ PROJET CLIENT ═══
Client : ${project.client_name}
Projet : ${project.title}
Objectif général : ${(project.objective || '').slice(0, 400)}

═══ BRIEF D'ARIA ═══
${request.brief}
${request.decision_reason ? `\nContexte de la demande : ${request.decision_reason}` : ''}

Produis le livrable demandé. Tu es responsable de la qualité de ton travail.

[TYPE]
article_blog | script_youtube | posts_sociaux | newsletter | stratégie_éditoriale | autre

[RÉSUMÉ]
2-3 phrases sur ce que tu as produit et pourquoi c'est adapté à ce client.

[LIVRABLE_COMPLET]
Le livrable complet, prêt à être utilisé. Minimum 400 mots.
Article : Titre H1 + Accroche + 3 sections H2 + Conclusion + CTA
Script : Accroche (0-15s) + Corps (3 parties) + Outro
Posts : 5 posts complets avec texte + hashtags
Newsletter : Objet + Corps complet + CTA

[NOTES_POUR_ARIA]
2-3 notes techniques ou recommandations qu'Aria pourrait communiquer au client.`;
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

    if (!project) {
      console.error('[content] project not found:', request.project_id);
      return false;
    }

    await supabase.from('internal_requests').update({ status: 'in_progress' }).eq('id', request.id);

    const raw = await callClaude(anthropicKey, 2048, buildDeliverablePrompt(profile, project, request, experience));

    const extract = (tag: string): string => {
      const m = raw.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z_ÉÈÀÙÎ]+\\]|$)`));
      return m ? m[1].trim() : '';
    };

    const contentType = extract('TYPE') || 'livrable_contenu';
    const summary = extract('RÉSUMÉ') || extract('RESUME') || raw.slice(0, 200);
    const deliverable = extract('LIVRABLE_COMPLET') || raw;
    const notes = extract('NOTES_POUR_ARIA') || '';

    await supabase.from('internal_requests').update({
      status: 'completed',
      result: `[${contentType.toUpperCase()}]\n\n${deliverable}`,
      result_summary: `${contentType} — ${summary.slice(0, 200)}${notes ? '\n\nNotes : ' + notes.slice(0, 150) : ''}`,
      completed_at: new Date().toISOString(),
    }).eq('id', request.id);

    await supabase.from('agent_reports').insert({
      agent_slug: AGENT_SLUG,
      title: `${contentType} — ${project.client_name} : ${project.title.slice(0, 50)}`,
      sections: [
        { heading: 'Type', content: contentType },
        { heading: 'Résumé', content: summary },
        { heading: 'Livrable complet', content: deliverable },
        { heading: 'Notes pour Aria', content: notes },
      ],
      report_type: 'content_deliverable',
      content: { project_id: project.id, internal_request_id: request.id, content_type: contentType },
    });

    await supabase.from('project_history').insert({
      project_id: project.id,
      event_type: 'content_delivered',
      old_value: { request_status: 'pending' },
      new_value: { request_status: 'completed', content_type: contentType },
      actor_type: 'agent',
      note: `${profile.name} (${profile.title}) — livrable produit : ${contentType}. ${summary.slice(0, 100)}`,
    });

    await synthesizeExperience(supabase, anthropicKey, profile, project, contentType, summary);

    return true;
  } catch (err) {
    console.error('[content] executeInternalRequest error:', (err as Error).message);
    await supabase.from('internal_requests').update({ status: 'pending' }).eq('id', request.id);
    return false;
  }
}

async function processInternalRequests(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
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

    const supabase = createClient(supabaseUrl, supabaseKey);

    const profile = await loadProfile(supabase);
    if (!profile) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Profil employee_profiles introuvable pour slug=content' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('agent_heartbeats').insert({
      agent_slug: AGENT_SLUG, run_type: 'daily',
      status: 'running', started_at: new Date().toISOString(),
    });

    const result = await processInternalRequests(supabase, anthropicKey, profile);

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
    console.error('[content] fatal error:', (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
