#!/usr/bin/env node
// populate-images.mjs — Assign curated Unsplash cover images to all blog articles
// Run from: d:/jarvis-starter-kit/livrables/blog-engine
// Usage: node scripts/populate-images.mjs

const UNSPLASH_KEY  = process.env.UNSPLASH_ACCESS_KEY;
const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://cjtglfutckaogsmwhfsv.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SECRET_KEY;

if (!UNSPLASH_KEY) { console.error('❌ Manque UNSPLASH_ACCESS_KEY'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('❌ Manque SUPABASE_SECRET_KEY'); process.exit(1); }

// Curated queries per slug keyword (partial match, first match wins)
const QUERY_MAP = [
  ['gpt-5',                    'ai chatbot interface technology dark'],
  ['claude-4',                 'machine learning neural network blue'],
  ['openai-o3',                'artificial intelligence futuristic technology'],
  ['gemini',                   'google ai technology digital interface'],
  ['avancees-ia',              'artificial intelligence innovation business'],
  ['automatiser-son-marketing','digital marketing automation dashboard'],
  ['automatiser-sa-prospecti', 'sales business prospecting technology'],
  ['automatiser-son-contenu',  'youtube video content creator studio'],
  ['n8n-automatiser-contenu',  'social media automation workflow'],
  ['jasper',                   'copywriting content writing creative workspace'],
  ['n8n-vs-make',              'software workflow automation comparison'],
  ['make-vs-zapier',           'automation integration software'],
  ['midjourney',               'digital art creative colorful design'],
  ['linkedin',                 'linkedin professional networking business'],
  ['zero-a-10',                'entrepreneur success growth money laptop'],
  ['lancer-son-business',      'startup launch entrepreneur office'],
  ['seo-et-ia',                'seo google search analytics screen'],
  ['strategie-contenu',        'content marketing strategy analytics'],
  ['meilleurs-outils',         'productivity tools technology modern workspace'],
  ['perplexity',               'ai search research technology screen'],
  ['outils-ia-indispensables', 'creator digital tools workspace technology'],
  ['top-10-outils',            'creator digital tools workspace technology'],
  ['reduire-ses-tickets',      'customer support helpdesk technology'],
  ['chatbot-ia',               'chatbot customer service conversation ai'],
  ['api-claude',               'developer coding programming dark screen'],
  ['tutoriel-n8n',             'workflow diagram automation process technology'],
  ['crm-ia',                   'crm sales management dashboard technology'],
  ['tripler-ses-ventes',       'sales growth funnel conversion success'],
  ['automatisation',           'automation workflow technology process'],
  ['n8n',                      'automation workflow nodes technology'],
];

// Fallback by category
const CATEGORY_QUERIES = {
  'Actualités IA':            'artificial intelligence technology innovation',
  'Automatisation IA':        'automation workflow technology process',
  'Comparatifs IA':           'technology comparison analysis digital',
  'Création de Contenu IA':   'content creation digital creative studio',
  'Guides IA':                'business guide success entrepreneur laptop',
  'Marketing IA':             'digital marketing strategy analytics',
  'Outils IA':                'technology tools productivity workspace',
  'Support Client IA':        'customer service support technology',
  'Tutoriels IA':             'tutorial learning technology screen code',
  'Vente IA':                 'sales business growth technology success',
};

async function getUnsplashImage(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5&content_filter=high`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (!res.ok) throw new Error(`Unsplash ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const photo = data.results?.[0];
  if (!photo) throw new Error(`Aucun résultat pour: "${query}"`);
  // Use 'regular' size (1080px wide) — high quality, reasonable file size
  return photo.urls.regular;
}

function pickQuery(article) {
  const slug = article.slug.toLowerCase();
  for (const [key, query] of QUERY_MAP) {
    if (slug.includes(key)) return query;
  }
  return CATEGORY_QUERIES[article.category] || 'artificial intelligence technology';
}

async function updateArticle(id, imageUrl) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_articles?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey':         SUPABASE_KEY,
      'Authorization':  `Bearer ${SUPABASE_KEY}`,
      'Content-Type':   'application/json',
      'Prefer':         'return=minimal',
    },
    body: JSON.stringify({ featured_image: imageUrl, og_image: imageUrl }),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${await res.text()}`);
}

async function main() {
  console.log('\n📸 populate-images — CreatorFlow Market Blog');
  console.log('='.repeat(55));

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blog_articles?select=id,slug,title,category,featured_image&status=eq.published&limit=100`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) throw new Error(`Supabase fetch ${res.status}: ${await res.text()}`);
  const articles = await res.json();

  console.log(`\n${articles.length} articles trouvés\n`);

  let ok = 0, skip = 0, fail = 0;

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const num = `[${i + 1}/${articles.length}]`;

    if (a.featured_image) {
      console.log(`${num} ⏭  SKIP (image déjà définie) — ${a.title.substring(0, 45)}`);
      skip++;
      continue;
    }

    const query = pickQuery(a);
    console.log(`${num} 🔍 "${query}"`);
    console.log(`     ${a.title.substring(0, 65)}`);

    try {
      const imageUrl = await getUnsplashImage(query);
      await updateArticle(a.id, imageUrl);
      console.log(`     ✅ OK — ${imageUrl.substring(0, 70)}...`);
      ok++;
    } catch (e) {
      console.error(`     ❌ ${e.message}`);
      fail++;
    }

    // Demo app: 50 req/hour → safe at 2s/article
    if (i < articles.length - 1) await new Promise(r => setTimeout(r, 2200));
  }

  console.log('\n' + '='.repeat(55));
  console.log(`✅ Terminé — ${ok} images assignées | ${skip} ignorées | ${fail} échecs`);
  console.log('\n⚠️  Rappel: attribuer les photos Unsplash dans les 30 jours (guideline Unsplash)');
}

main().catch(err => {
  console.error('\n💥 Erreur fatale:', err.message);
  process.exit(1);
});
