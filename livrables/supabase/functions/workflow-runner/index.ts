import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Step = { index: number; agent_slug: string; objective_template: string; wait_approval?: boolean };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { workflow_slug, run_id, client_id } = body as { workflow_slug?: string; run_id?: string; client_id?: string };

    if (run_id) {
      return await triggerNextStep(supabase, supabaseUrl, serviceKey, run_id);
    }

    if (!workflow_slug) {
      return new Response(JSON.stringify({ error: 'workflow_slug ou run_id requis.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: workflow, error: wfErr } = await supabase
      .from('agent_workflows').select('*').eq('slug', workflow_slug).eq('is_active', true).single();
    if (wfErr || !workflow) throw new Error(`Workflow "${workflow_slug}" introuvable.`);

    const steps = workflow.steps as Step[];
    if (!steps?.length) throw new Error('Ce workflow n\'a aucune étape définie.');

    const { data: run, error: runErr } = await supabase
      .from('workflow_runs')
      .insert({ workflow_id: workflow.id, status: 'running', current_step: 0, context: { client_id: client_id || null } })
      .select('id').single();
    if (runErr || !run) throw new Error('Impossible de créer le run.');

    return await dispatchStep(supabase, supabaseUrl, serviceKey, run.id, steps[0], { client_id: client_id || null }, steps.length, req);

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});

async function triggerNextStep(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  runId: string,
) {
  const { data: run, error } = await supabase
    .from('workflow_runs')
    .select('*, agent_workflows(steps)')
    .eq('id', runId).single();
  if (error || !run) throw new Error('Run introuvable.');

  const steps = (run.agent_workflows as { steps: Step[] }).steps;
  const nextStep = run.current_step as number;

  if (nextStep >= steps.length) {
    await supabase.from('workflow_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', runId);
    return new Response(JSON.stringify({ run_id: runId, status: 'completed', message: 'Workflow terminé.' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return await dispatchStep(supabase, supabaseUrl, serviceKey, runId, steps[nextStep], run.context as Record<string, unknown>, steps.length, null);
}

async function dispatchStep(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  runId: string,
  step: Step,
  context: Record<string, unknown>,
  totalSteps: number,
  req: Request | null,
) {
  // Créer le step_run
  const { data: stepRun } = await supabase
    .from('workflow_step_runs')
    .insert({ run_id: runId, step_index: step.index, agent_slug: step.agent_slug, status: 'running', started_at: new Date().toISOString() })
    .select('id').single();

  // Résoudre le template d'objectif
  let objective = step.objective_template;
  for (const [k, v] of Object.entries(context)) {
    objective = objective.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
  }

  // Appel asynchrone de l'orchestrateur — ne bloque pas la réponse HTTP
  const runOrchestrator = async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-orchestrator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey },
        body: JSON.stringify({ agent_slug: step.agent_slug, objective, client_id: context.client_id || null }),
      });
      const json = await res.json() as { mission_id?: string; status?: string; result_summary?: string };

      const stepStatus = json.status === 'completed' ? 'completed'
        : json.status === 'waiting_approval' ? 'waiting_approval' : 'failed';

      await supabase.from('workflow_step_runs').update({
        status: stepStatus,
        mission_id: json.mission_id || null,
        output: { result_summary: (json.result_summary || '').slice(0, 1000) },
        completed_at: new Date().toISOString(),
      }).eq('id', stepRun?.id);

      // Mettre à jour context + current_step
      const { data: runNow } = await supabase.from('workflow_runs').select('context').eq('id', runId).single();
      const newContext = {
        ...(runNow?.context as Record<string, unknown> || {}),
        [`step_${step.index}_summary`]: (json.result_summary || '').slice(0, 500),
        [`step_${step.index}_mission_id`]: json.mission_id,
      };

      if (stepStatus === 'waiting_approval') {
        await supabase.from('workflow_runs').update({ status: 'waiting_approval', context: newContext }).eq('id', runId);
      } else if (stepStatus === 'failed') {
        await supabase.from('workflow_runs').update({ status: 'failed', context: newContext }).eq('id', runId);
      } else {
        const isLast = step.index + 1 >= totalSteps;
        await supabase.from('workflow_runs').update({
          context: newContext,
          current_step: step.index + 1,
          status: isLast ? 'completed' : 'waiting',
          completed_at: isLast ? new Date().toISOString() : null,
        }).eq('id', runId);
      }
    } catch (err) {
      await supabase.from('workflow_step_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', stepRun?.id);
      await supabase.from('workflow_runs').update({ status: 'failed' }).eq('id', runId);
    }
  };

  // Utiliser EdgeRuntime.waitUntil si disponible (Supabase Edge Runtime)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const edgeRuntime = globalThis as any;
  if (edgeRuntime.EdgeRuntime?.waitUntil) {
    edgeRuntime.EdgeRuntime.waitUntil(runOrchestrator());
  } else {
    // Fallback synchrone pour les environnements sans waitUntil
    await runOrchestrator();
  }

  return new Response(JSON.stringify({
    run_id: runId,
    status: 'step_dispatched',
    step: step.index,
    step_run_id: stepRun?.id,
    message: `Étape ${step.index + 1}/${totalSteps} démarrée. Vérifiez workflow_step_runs.status pour suivre l'avancement.`,
  }), { headers: { ...cors, 'Content-Type': 'application/json' } });
}
