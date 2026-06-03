// Serves blog-article.html for /blog/:slug paths
// Browser URL stays as /blog/SLUG — JS reads slug from window.location.pathname
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const assetUrl = new URL('/blog-article.html', url.origin).toString();
  return context.env.ASSETS.fetch(new Request(assetUrl, context.request));
}
