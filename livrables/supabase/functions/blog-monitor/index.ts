import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const RESEND_URL = 'https://api.resend.com/emails';
const ALERT_TO   = 'pjoacenel@gmail.com';
const FROM       = 'CreatorFlow Market <noreply@creatorflowmarket.com>';
const THRESHOLD_HOURS = 96; // alerte si rien publié depuis 96h (4 jours)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const since = new Date(Date.now() - THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();

    const { data: recentArticles, error } = await supabase
      .from('blog_articles')
      .select('id, title, published_at')
      .eq('status', 'published')
      .gte('published_at', since)
      .limit(1);

    if (error) throw new Error(`Supabase query failed: ${error.message}`);

    const hasRecentArticle = recentArticles && recentArticles.length > 0;

    if (hasRecentArticle) {
      return new Response(JSON.stringify({
        ok: true,
        status: 'healthy',
        last_article: recentArticles[0].title,
        published_at: recentArticles[0].published_at,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Aucun article récent — chercher le dernier publié
    const { data: lastArticle } = await supabase
      .from('blog_articles')
      .select('title, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1)
      .single();

    const lastPublished = lastArticle?.published_at
      ? new Date(lastArticle.published_at).toLocaleString('fr-CA', { timeZone: 'America/Toronto' })
      : 'Inconnu';

    const lastTitle = lastArticle?.title ?? 'Aucun article trouvé';

    // Envoyer l'alerte email via Resend
    const apiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#04040A;color:#F4F4FF;margin:0;padding:0;}
  .wrap{max-width:560px;margin:0 auto;padding:32px 20px;}
  .header{text-align:center;padding:20px 0;border-bottom:1px solid rgba(255,255,255,0.1);}
  .logo{font-size:18px;font-weight:800;color:#F4F4FF;}
  .logo em{font-style:normal;color:#EF4444;}
  .alert{background:#1a0a0a;border:1px solid #EF4444;border-radius:12px;padding:24px;margin:24px 0;}
  .badge{display:inline-block;background:#EF4444;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:12px;}
  h2{font-size:20px;margin:0 0 8px;color:#FCA5A5;}
  p{font-size:14px;color:#9898B8;line-height:1.6;margin:0 0 10px;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;}
  .row:last-child{border:none;}
  .label{color:#9898B8;}
  .val{font-weight:600;color:#F4F4FF;}
  .btn{display:inline-block;background:#EF4444;color:#fff;text-decoration:none;padding:10px 24px;border-radius:999px;font-weight:700;font-size:13px;margin:16px 0;}
  .footer{text-align:center;font-size:11px;color:#55557A;padding:20px 0 0;border-top:1px solid rgba(255,255,255,0.05);}
</style></head><body><div class="wrap">
  <div class="header"><div class="logo">CreatorFlow <em>⚠ ALERTE</em></div></div>
  <div class="alert">
    <div class="badge">PIPELINE BLOG — ARRÊT DÉTECTÉ</div>
    <h2>Aucun article publié depuis ${THRESHOLD_HOURS}h</h2>
    <p>Le pipeline de génération d'articles semble inactif. Vérifie GitHub Actions immédiatement.</p>
    <div class="row"><span class="label">Dernier article</span><span class="val">${lastTitle}</span></div>
    <div class="row"><span class="label">Publié le</span><span class="val">${lastPublished}</span></div>
    <div class="row"><span class="label">Seuil d'alerte</span><span class="val">${THRESHOLD_HOURS}h sans publication</span></div>
    <div class="row"><span class="label">Détecté le</span><span class="val">${new Date().toLocaleString('fr-CA', { timeZone: 'America/Toronto' })}</span></div>
  </div>
  <p style="text-align:center">
    <a href="https://github.com/quiz-509/creatorflow-ai-hub/actions" class="btn">Vérifier GitHub Actions →</a>
  </p>
  <div class="footer">CreatorFlow Market · Monitoring automatique</div>
</div></body></html>`;

    const emailRes = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [ALERT_TO],
        subject: `⚠️ ALERTE — Pipeline blog CreatorFlow inactif depuis ${THRESHOLD_HOURS}h`,
        html,
      }),
    });

    const emailJson = await emailRes.json();

    // Logger l'alerte dans agent_actions_log
    await supabase.from('agent_actions_log').insert({
      agent_slug: 'blog-monitor',
      action_type: 'alert_sent',
      input: { threshold_hours: THRESHOLD_HOURS, last_article: lastTitle, last_published: lastPublished },
      output: { email_sent: emailRes.ok, resend_id: emailJson.id },
      status: emailRes.ok ? 'success' : 'error',
    });

    return new Response(JSON.stringify({
      ok: true,
      status: 'alert_sent',
      last_article: lastTitle,
      last_published: lastPublished,
      email_sent: emailRes.ok,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
