export async function onRequest(context) {
  const url = new URL(context.request.url);
  const slug = context.params.slug;
  if (!slug) return Response.redirect(`${url.origin}/blog`, 302);
  return Response.redirect(`${url.origin}/blog-article?slug=${encodeURIComponent(slug)}`, 302);
}
