import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let body: { project_id?: string; score?: number; comment?: string } = {};
  try { body = await req.json(); } catch (_) {
    return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { project_id, score, comment } = body;

  if (!project_id || !/^[0-9a-f-]{36}$/i.test(project_id)) {
    return new Response(JSON.stringify({ error: 'project_id invalide' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (!score || ![1, 2, 3].includes(Number(score))) {
    return new Response(JSON.stringify({ error: 'score invalide (1, 2 ou 3 attendu)' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: project, error: projectError } = await supabase
    .from('client_projects')
    .select('id, title, client_name')
    .eq('id', project_id)
    .single();

  if (projectError || !project) {
    return new Response(JSON.stringify({ error: 'Projet introuvable' }), {
      status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { error: insertError } = await supabase
    .from('project_feedback')
    .insert({
      project_id,
      score: Number(score),
      comment: (comment || '').slice(0, 1000) || null,
    });

  if (insertError) {
    return new Response(JSON.stringify({ error: 'Erreur lors de l\'enregistrement' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    message: 'Merci pour votre retour. Il aidera votre équipe à s\'améliorer.',
  }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
