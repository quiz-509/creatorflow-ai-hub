import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));

    // Mode : démarrer un workflow ou continuer un run existant
    const { workflow_slug, run_id, client_id } = body as {
      workflow_slug?: string;
      run_id?: string;
      client_id?: string;
    };

    // Continuer un run existant (appelé après approbation CEO)
    if (run_id) {
      return await continueRun(supabase, supabaseUrl, serviceKey, run_id);
    }

    // Démarrer un nouveau workflow
    if (!workflow_slug) {
      return new Response(JSON.stringify({ error: 'workflow_slug ou run_id requis.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: workflow, error: wfErr } = await supabase
      .from('agent_workflows')
      .select('*')
      .eq('slug', workflow_slug)
      .eq('is_active', true)
      .single();
    if (wfErr || !workflow) throw new Error(`Workflow "${workflow_slug}" introuvable.`);

    const steps = workflow.steps as Array<{
      index: number; agent_slug: string; objective_template: string; wait_approval?: boolean;
    }>;
    if (!steps?.length) throw new Error('Ce workflow n\'a aucune étape définie.');

    // Créer le run
    const { data: run, error: runErr } = await supabase
      .from('workflow_runs')
      .insert({ workflow_id: workflow.id, status: 'running', current_step: 0, context: { client_id: client_id || null } })
      .select('id')
      .single();
    if (runErr || !run) throw new Error('Impossible de créer le run.');

    // Exécuter l'étape 0
    const result = await executeStep(supabase, supabaseUrl, serviceKey, run.id, steps[0], { client_id: client_id || null }, steps.length);

    return new Response(JSON.stringify({ run_id: run.id, ...result }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});

async function continueRun(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  runId: string,
) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  const { data: run, error: runErr } = await supabase
    .from('workflow_runs')
    .select('*, agent_workflows(steps)')
    .eq('id', runId)
    .single();
  if (runErr || !run) throw new Error('Run introuvable.');

  const steps = (run.agent_workflows as { steps: Array<{ index: number; agent_slug: string; objective_template: string; wait_approval?: boolean }> }).steps;
  const nextStep = run.current_step + 1;

  if (nextStep >= steps.length) {
    await supabase.from('workflow_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId);
    return new Response(JSON.stringify({ run_id: runId, status: 'completed', message: 'Workflow terminé.' }), { headers: cors });
  }

  await supabase.from('workflow_runs').update({ status: 'running', current_step: nextStep }).eq('id', runId);
  const result = await executeStep(supabase, supabaseUrl, serviceKey, runId, steps[nextStep], run.context as Record<string, unknown>, steps.length);
  return new Response(JSON.stringify({ run_id: runId, ...result }), { headers: cors });
}

async function executeStep(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  runId: string,
  step: { index: number; agent_slug: string; objective_template: string; wait_approval?: boolean },
  context: Record<string, unknown>,
  totalSteps: number,
) {
  // Créer le step_run
  const { data: stepRun } = await supabase
    .from('workflow_step_runs')
    .insert({ run_id: runId, step_index: step.index, agent_slug: step.agent_slug, status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single();

  // Résoudre l'objective_template avec le contexte
  let objective = step.objective_template;
  for (const [k, v] of Object.entries(context)) {
    objective = objective.replace(`{{${k}}}`, String(v ?? ''));
  }

  // Appeler l'orchestrateur
  const res = await fetch(`${supabaseUrl}/functions/v1/ai-orchestrator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
    body: JSON.stringify({ agent_slug: step.agent_slug, objective, client_id: context.client_id || null }),
  });
  const json = await res.json() as { mission_id?: string; status?: string; result_summary?: string; error?: string };

  const stepStatus = json.status === 'completed' ? 'completed' : json.status === 'waiting_approval' ? 'waiting_approval' : 'failed';

  // Mettre à jour step_run
  await supabase.from('workflow_step_runs').update({
    status: stepStatus,
    mission_id: json.mission_id || null,
    output: { result_summary: json.result_summary, status: json.status },
    completed_at: new Date().toISOString(),
  }).eq('id', stepRun?.id);

  // Mettre à jour le context du run avec les outputs de cette étape
  const newContext = { ...context, [`step_${step.index}_summary`]: (json.result_summary || '').slice(0, 500), [`step_${step.index}_mission_id`]: json.mission_id };
  await supabase.from('workflow_runs').update({ context: newContext }).eq('id', runId);

  const isLastStep = step.index === totalSteps - 1;

  if (stepStatus === 'waiting_approval') {
    await supabase.from('workflow_runs').update({ status: 'waiting_approval' }).eq('id', runId);
    return { status: 'waiting_approval', step: step.index, message: `Étape ${step.index + 1}/${totalSteps} en attente d'approbation CEO.`, mission_id: json.mission_id };
  }

  if (stepStatus === 'failed') {
    await supabase.from('workflow_runs').update({ status: 'failed' }).eq('id', runId);
    return { status: 'failed', step: step.index, error: json.result_summary };
  }

  if (isLastStep) {
    await supabase.from('workflow_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId);
    return { status: 'completed', step: step.index, message: `Workflow terminé en ${totalSteps} étapes.` };
  }

  // Étape suivante immédiate (pas de wait_approval)
  await supabase.from('workflow_runs').update({ current_step: step.index + 1 }).eq('id', runId);
  return { status: 'step_completed', step: step.index, next_step: step.index + 1, message: `Étape ${step.index + 1}/${totalSteps} terminée.` };
}
