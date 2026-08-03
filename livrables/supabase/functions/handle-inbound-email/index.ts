import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, resend-signature, svix-id, svix-timestamp, svix-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    // Resend inbound format — can be nested under .data or flat
    const payload = body.data || body;
    const rawFrom: string = payload.from || payload.sender || '';
    const subject: string = (payload.subject || '').slice(0, 500);
    const text: string = (payload.text || payload.plain_text || '')
      .replace(/\r\n/g, '\n')
      .slice(0, 1000);
    const html: string = payload.html || '';

    // Extract plain email address from "Name <email@domain>" format
    const emailMatch = rawFrom.match(/<([^>]+)>/);
    const senderEmail = (emailMatch ? emailMatch[1] : rawFrom).toLowerCase().trim();

    if (!senderEmail || !senderEmail.includes('@')) {
      console.log('[inbound] no valid sender email in payload');
      return new Response(JSON.stringify({ ok: true, skipped: 'no_sender' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Find active project for this sender
    const { data: project } = await supabase
      .from('client_projects')
      .select('id, title, client_name, client_email')
      .ilike('client_email', senderEmail)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!project) {
      console.log('[inbound] no active project for sender:', senderEmail);
      return new Response(JSON.stringify({ ok: true, matched: false, sender: senderEmail }),
        { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Strip quoted reply content (everything after the first "---" or "> " block)
    const cleanText = text.split(/\n[-_]{3,}\n|\n>[ ]|\nOn .* wrote:/)[0].trim();
    const contentPreview = (cleanText || html.replace(/<[^>]*>/g, '').slice(0, 500)).slice(0, 500);

    // Log inbound message in client_communications
    await supabase.from('client_communications').insert({
      project_id: project.id,
      direction: 'inbound',
      phase: 'reply',
      subject,
      content_preview: contentPreview,
      sent_at: new Date().toISOString(),
    });

    // Log in project history so Aria le voit dans son prochain run
    await supabase.from('project_history').insert({
      project_id: project.id,
      event_type: 'client_replied',
      old_value: null,
      new_value: { from: senderEmail, subject: subject.slice(0, 100) },
      actor_type: 'client',
      note: `Réponse client reçue : "${subject.slice(0, 80)}" — ${contentPreview.slice(0, 200)}`,
    });

    console.log(`[inbound] saved reply from ${senderEmail} → project ${project.id} (${project.title})`);

    return new Response(
      JSON.stringify({ ok: true, matched: true, project_id: project.id, client: project.client_name }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[inbound] error:', (err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
