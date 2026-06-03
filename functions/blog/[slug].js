// Serves blog-article.html content at /blog/:slug
// Server-side fetch follows any .html redirects internally — browser never sees a redirect,
// so window.location.pathname stays as /blog/SLUG and the JS can extract the slug
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const res = await fetch(new URL('/blog-article', url.origin).toString());
  const html = await res.text();
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
