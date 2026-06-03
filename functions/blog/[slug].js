export async function onRequest(context) {
  const url = new URL(context.request.url);
  const slug = context.params.slug;

  if (!slug) {
    return Response.redirect(new URL('/blog', url.origin).toString(), 302);
  }

  // Fetch the static blog-article page via ASSETS binding.
  // Use /blog-article (no .html) — Pretty URLs serves it as 200, not a 301 redirect.
  let assetRes;
  try {
    assetRes = await context.env.ASSETS.fetch(
      new Request(`${url.origin}/blog-article`)
    );
  } catch (e) {
    return Response.redirect(
      new URL(`/blog-article?slug=${encodeURIComponent(slug)}`, url.origin).toString(),
      302
    );
  }

  // If the ASSETS binding returned a redirect instead of the HTML, fall back
  if (!assetRes.ok) {
    return Response.redirect(
      new URL(`/blog-article?slug=${encodeURIComponent(slug)}`, url.origin).toString(),
      302
    );
  }

  const html = await assetRes.text();

  // Inject the slug so getSlug() can read it without depending on URL parsing
  const injected = html.replace(
    '<head>',
    `<head><script>window.__BLOG_SLUG__=${JSON.stringify(slug)};</script>`
  );

  return new Response(injected, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });
}
