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

const AGENT_SLUG = 'support';
const DEPARTMENT = 'support';

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

function buildDeliverablePrompt(
  profile: EmployeeProfile,
  project: ClientProject,
  request: InternalRequest,
): string {
  return `${profile.system_prompt_context}

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
): Promise<boolean> {
  try {
    const { data: project } = await supabase
      .from('client_projects')
      .select('id, title, client_name, client_email, objective')
      .eq('id', request.project_id)
      .single();
    if (!project) return false;

    await supabase.from('internal_requests').update({ status: 'in_progress' }).eq('id', request.id);

    const raw = await callClaude(anthropicKey, 2048, buildDeliverablePrompt(profile, project, request));

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
  const { data: requests } = await supabase
    .from('internal_requests')
    .select('id, project_id, from_dept, brief, objective, decision_reason')
    .eq('to_dept', DEPARTMENT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(3);

  if (!requests?.length) return { requests_processed: 0, actions: [] };

  const actions: string[] = [];
  let processed = 0;

  for (const request of requests as InternalRequest[]) {
    const success = await executeInternalRequest(supabase, anthropicKey, profile, request);
    if (success) {
      processed++;
      actions.push(`executed:${request.id.slice(0, 8)}`);
    }
  }

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
        JSON.stringify({ ok: false, error: 'Profil employee_profiles introuvable pour slug=support' }),
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
    console.error('[support] fatal error:', (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
