const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FROM = 'CreatorFlow Market <notifications@creatorflowmarket.com>';
const RESEND_URL = 'https://api.resend.com/emails';

function baseTemplate(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'Inter',Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
    .wrap{max-width:560px;margin:0 auto;padding:32px 20px;}
    .header{text-align:center;padding:28px 0 20px;border-bottom:1px solid rgba(255,255,255,0.08);}
    .logo{font-size:18px;font-weight:800;color:#F4F4FF;}
    .logo em{font-style:normal;color:#A78BFA;}
    .body{padding:28px 0;}
    .card{background:#0C0C18;border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:24px;margin:16px 0;}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;}
    .row:last-child{border:none;}
    .label{color:#9898B8;}
    .val{font-weight:600;}
    .btn{display:inline-block;background:linear-gradient(135deg,#9333EA,#7C3AED);color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:14px;margin:16px 0;}
    .footer{text-align:center;font-size:11px;color:#55557A;padding:20px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
    h2{font-size:20px;font-weight:800;margin:0 0 8px;}
    p{font-size:14px;color:#9898B8;line-height:1.6;margin:0 0 12px;}
  </style></head><body><div class="wrap">
    <div class="header"><div class="logo">CreatorFlow <em>Market</em></div></div>
    <div class="body">${content}</div>
    <div class="footer">CreatorFlow Market · creatorflowmarket.com<br>Marketplace de talents IA certifiés</div>
  </div></body></html>`;
}

const templates: Record<string, (d: Record<string, string>) => { subject: string; html: string }> = {
  nouvelle_proposition: (d) => ({
    subject: `📬 Nouvelle proposition pour votre brief — ${d.categorie || 'Projet'}`,
    html: baseTemplate(`
      <h2>Nouvelle proposition reçue</h2>
      <p>Un expert vient de postuler sur votre brief <strong>${d.categorie || 'Projet'}</strong>.</p>
      <div class="card">
        <div class="row"><span class="label">Expert</span><span class="val">${d.expert_name}</span></div>
        <div class="row"><span class="label">Montant proposé</span><span class="val">${d.montant}$ CAD</span></div>
        ${d.delai ? `<div class="row"><span class="label">Délai</span><span class="val">${d.delai}</span></div>` : ''}
        ${d.message ? `<div class="row"><span class="label">Message</span><span class="val" style="max-width:280px;text-align:right">${d.message.slice(0, 100)}${d.message.length > 100 ? '…' : ''}</span></div>` : ''}
      </div>
      <p style="text-align:center"><a href="https://creatorflowmarket.com/dashboard-client.html" class="btn">Voir la proposition →</a></p>
    `),
  }),

  proposition_acceptee: (d) => ({
    subject: `🎉 Votre proposition a été acceptée !`,
    html: baseTemplate(`
      <h2>Félicitations, proposition acceptée !</h2>
      <p><strong>${d.client_name}</strong> a accepté votre proposition. Une mission vient d'être créée.</p>
      <div class="card">
        <div class="row"><span class="label">Mission</span><span class="val">${d.mission_titre}</span></div>
        <div class="row"><span class="label">Montant</span><span class="val">${d.montant}$ CAD</span></div>
        <div class="row"><span class="label">Client</span><span class="val">${d.client_name}</span></div>
      </div>
      <p style="text-align:center"><a href="https://creatorflowmarket.com/dashboard-expert.html" class="btn">Voir ma mission →</a></p>
    `),
  }),

  paiement_confirme: (d) => ({
    subject: `✅ Paiement confirmé — Mission ${d.mission_titre}`,
    html: baseTemplate(`
      <h2>Paiement confirmé</h2>
      <p>Le paiement pour la mission <strong>${d.mission_titre}</strong> a bien été enregistré.</p>
      <div class="card">
        <div class="row"><span class="label">Mission</span><span class="val">${d.mission_titre}</span></div>
        <div class="row"><span class="label">Montant</span><span class="val">${d.montant}$ CAD</span></div>
        <div class="row"><span class="label">Client</span><span class="val">${d.client_name}</span></div>
        <div class="row"><span class="label">Expert</span><span class="val">${d.expert_name}</span></div>
        <div class="row"><span class="label">Statut</span><span class="val" style="color:#10B981">✓ Confirmé</span></div>
      </div>
      <p style="text-align:center"><a href="https://creatorflowmarket.com/dashboard-client.html" class="btn">Voir la mission →</a></p>
    `),
  }),

  nouveau_message: (d) => ({
    subject: `💬 Nouveau message de ${d.sender_name}`,
    html: baseTemplate(`
      <h2>Nouveau message</h2>
      <p><strong>${d.sender_name}</strong> vous a envoyé un message concernant la mission <strong>${d.mission_titre}</strong>.</p>
      <div class="card" style="border-left:3px solid #7C3AED">
        <p style="color:#F4F4FF;font-style:italic;margin:0">"${d.message_preview}"</p>
      </div>
      <p style="text-align:center"><a href="https://creatorflowmarket.com/messages.html" class="btn">Répondre →</a></p>
    `),
  }),
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { type, to, data } = await req.json();

    if (!type || !to || !templates[type]) {
      return new Response(JSON.stringify({ error: 'type ou destinataire manquant' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { subject, html } = templates[type](data || {});
    const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';

    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html }),
    });

    const json = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: json }), {
        status: res.status, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: json.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
