export async function onRequest(context) {
  const url = new URL(context.request.url);
  const slug = context.params.slug;
  const redirectUrl = `${url.origin}/blog-article?slug=${encodeURIComponent(slug || '')}`;
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:monospace;background:#111;color:#fff;padding:40px">
    <h2 style="color:#7C3AED">&#x2714; Pages Function en cours</h2>
    <p><b>slug capturé :</b> ${slug}</p>
    <p><b>URL de redirect :</b> ${redirectUrl}</p>
    <p style="margin-top:24px"><a href="${redirectUrl}" style="color:#A78BFA">Suivre le redirect →</a></p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
  );
}
