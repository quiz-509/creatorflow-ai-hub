const CAT_SLUGS = {
  'actualites-ia':        'Actualités IA',
  'outils-ia':            'Outils IA',
  'automatisation-ia':    'Automatisation IA',
  'marketing-ia':         'Marketing IA',
  'creation-contenu-ia':  'Création de Contenu IA',
  'vente-ia':             'Vente IA',
  'support-client-ia':    'Support Client IA',
  'tutoriels-ia':         'Tutoriels IA',
  'comparatifs-ia':       'Comparatifs IA',
  'guides-ia':            'Guides IA',
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const slug = context.params.slug;
  const cat = CAT_SLUGS[slug];
  if (!cat) return Response.redirect(`${url.origin}/blog`, 302);
  return Response.redirect(`${url.origin}/blog-category?cat=${encodeURIComponent(cat)}`, 302);
}
