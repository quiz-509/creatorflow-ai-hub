const SUPABASE_URL = 'https://cjtglfutckaogsmwhfsv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei';
const BASE        = 'https://creatorflowmarket.com';

export async function onRequest(context) {
  const url  = new URL(context.request.url);
  const slug = context.params.slug;

  if (!slug) {
    return Response.redirect(`${url.origin}/blog.html`, 302);
  }

  // Fetch article from Supabase
  let article = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_articles?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=title,excerpt,content,featured_image,category,author,published_at,views,slug&limit=1`,
      {
        headers: {
          apikey: SUPABASE_URL.includes('supabase') ? SUPABASE_KEY : '',
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const rows = await r.json();
    article = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {}

  // Article not found → 404
  if (!article) {
    return Response.redirect(`${url.origin}/404.html`, 302);
  }

  const title       = article.title || 'Article — CreatorFlow Market';
  const description = article.excerpt || `${title} — Découvrez cet article sur CreatorFlow Market`;
  const image       = article.featured_image || `${BASE}/og-image.jpg`;
  const canonical   = `${BASE}/blog/${slug}`;
  const published   = article.published_at ? new Date(article.published_at).toISOString() : '';
  const category    = article.category || 'IA';
  const author      = article.author || 'CreatorFlow Market';

  // Sanitize description for safe HTML attribute
  const safeDesc  = description.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 200);
  const safeTitle = title.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Extract first 1200 chars of article text for Google snippet
  const bodyText = article.content
    ? article.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200)
    : safeDesc;

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} — CreatorFlow Market</title>
  <meta name="description" content="${safeDesc}">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index, follow">

  <!-- Open Graph -->
  <meta property="og:type"        content="article">
  <meta property="og:url"         content="${canonical}">
  <meta property="og:title"       content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image"       content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height"content="630">
  <meta property="og:site_name"   content="CreatorFlow Market">
  <meta property="og:locale"      content="fr_CA">
  ${published ? `<meta property="article:published_time" content="${published}">` : ''}
  <meta property="article:section" content="${category}">
  <meta property="article:author"  content="${author}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:site"        content="@creatorflowmkt">
  <meta name="twitter:title"       content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image"       content="${image}">

  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description.slice(0, 200),
    "image": image,
    "datePublished": published,
    "author": { "@type": "Person", "name": author },
    "publisher": {
      "@type": "Organization",
      "name": "CreatorFlow Market",
      "url": BASE
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical }
  })}</script>

  <!-- Redirect to full React app while preserving slug -->
  <style>
    body{margin:0;background:#04040A;color:#F4F4FF;font-family:'Inter',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px;text-align:center;}
    .logo{font-size:16px;font-weight:700;letter-spacing:-0.02em;margin-bottom:32px;color:#F4F4FF;}
    .logo em{font-style:normal;background:linear-gradient(135deg,#A78BFA,#06B6D4);-webkit-background-clip:text;background-clip:text;color:transparent;}
    .spin{width:24px;height:24px;border:2px solid rgba(255,255,255,0.1);border-top-color:#A78BFA;border-radius:50%;animation:s .7s linear infinite;margin:0 auto 16px;}
    @keyframes s{to{transform:rotate(360deg);}}
    p{font-size:14px;color:#9898B8;}
    /* Static article preview for crawlers */
    .seo-content{display:none;}
  </style>
</head>
<body>
  <a href="${BASE}" class="logo">CreatorFlow <em>Market</em></a>
  <div class="spin"></div>
  <p>Chargement de l'article…</p>

  <!-- Static content for search engine crawlers -->
  <article class="seo-content" itemscope itemtype="https://schema.org/Article">
    <h1 itemprop="headline">${safeTitle}</h1>
    <p itemprop="description">${safeDesc}</p>
    <div itemprop="articleBody">${bodyText}</div>
    <span itemprop="author">${author}</span>
    <span itemprop="datePublished">${published}</span>
  </article>

  <script>
    // Redirect to React app with slug preserved
    window.location.replace('/blog-article.html?slug=${encodeURIComponent(slug)}');
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'index, follow',
    },
  });
}
