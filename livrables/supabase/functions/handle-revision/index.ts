import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CEO_EMAIL = 'pjoacenel@gmail.com';
const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'CreatorFlow Market <noreply@creatorflowmarket.com>';

async function notifyCEO(resendKey: string, projectTitle: string, clientName: string, reason: string): Promise<void> {
  if (!resendKey) return;
  const subject = `🔄 Révision demandée — ${projectTitle.slice(0, 60)}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
.w{max-width:580px;margin:0 auto;padding:28px 20px;}
.logo{font-size:16px;font-weight:800;padding:16px 0 20px;border-bottom:1px solid rgba(255,255,255,0.1);}
.logo em{font-style:normal;color:#4F46E5;}
h2{font-size:18px;margin:20px 0 4px;color:#A5B4FC;}
.sec{background:#0d0d1a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 18px;margin:12px 0;}
.lbl{font-size:10px;font-weight:700;color:#9898B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;}
.txt{font-size:13px;color:#D1D5DB;line-height:1.7;white-space:pre-wrap;}
.btn{display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
.ft{text-align:center;font-size:11px;color:#55557A;padding:16px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="w">
<div class="logo">CreatorFlow <em>Market</em></div>
<h2>Révision demandée par le client</h2>
<div class="sec"><div class="lbl">Projet</div><div class="txt">${projectTitle}</div></div>
<div class="sec"><div class="lbl">Client</div><div class="txt">${clientName}</div></div>
<div class="sec"><div class="lbl">Raison</div><div class="txt">${reason || 'Non précisée'}</div></div>
<p style="text-align:center"><a href="https://creatorflowmarket.com/admin" class="btn">Voir dans le Cockpit →</a></p>
<div class="ft">Le Marketing Director va créer les tâches de révision automatiquement.</div>
</div></body></html>`;
  try {
    await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [CEO_EMAIL], subject, html }),
    });
  } catch (_) {}
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  let body: { project_id?: string; reason?: string; department?: string } = {};
  try { body = await req.json(); } catch (_) {
    return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const { project_id, reason, department } = body;
  if (!project_id || !/^[0-9a-f-]{36}$/i.test(project_id)) {
    return new Response(JSON.stringify({ error: 'project_id invalide' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';

  // Vérifier que le projet existe
  const { data: project, error: projectError } = await supabase
    .from('client_projects')
    .select('id, title, client_name, client_email, status')
    .eq('id', project_id)
    .single();

  if (projectError || !project) {
    return new Response(JSON.stringify({ error: 'Projet introuvable' }), {
      status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Vérifier qu'il n'y a pas déjà une révision en cours
  const { data: existing } = await supabase
    .from('project_revisions')
    .select('id, status')
    .eq('project_id', project_id)
    .in('status', ['pending', 'in_progress'])
    .limit(1);

  if (existing?.length) {
    return new Response(JSON.stringify({
      ok: true,
      message: 'Une révision est déjà en cours pour ce projet.',
      revision_id: existing[0].id,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  // Créer la révision
  const { data: revision, error: revError } = await supabase
    .from('project_revisions')
    .insert({
      project_id,
      requested_by: 'client',
      reason: (reason || '').slice(0, 1000),
      department: department || null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (revError) {
    return new Response(JSON.stringify({ error: 'Erreur lors de la création de la révision' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // Notifier le CEO
  await notifyCEO(resendKey, project.title, project.client_name, reason || '');

  return new Response(JSON.stringify({
    ok: true,
    message: 'Révision enregistrée. Votre demande sera traitée très prochainement.',
    revision_id: revision?.id,
  }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
