// Routes /blog/:slug → /blog-article?slug=:slug
// Browser URL changes but canonical tag in the page always declares /blog/SLUG as the SEO URL
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const slug = context.params.slug;
  if (!slug) return Response.redirect(new URL('/blog', url.origin).toString(), 302);
  return Response.redirect(
    new URL(`/blog-article?slug=${encodeURIComponent(slug)}`, url.origin).toString(),
    302
  );
}
