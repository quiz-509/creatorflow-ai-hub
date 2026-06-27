export async function onRequest() {
  const SUPABASE_URL = 'https://cjtglfutckaogsmwhfsv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei';
  const BASE = 'https://creatorflowmarket.com';

  let articles = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_articles?select=slug,title,meta_description,excerpt,category,published_at,author,tags&status=eq.published&order=published_at.desc&limit=50`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    articles = await r.json() || [];
  } catch {}

  const now = new Date().toUTCString();
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const items = (Array.isArray(articles) ? articles : []).map(a => {
    const link = `${BASE}/blog/${a.slug}`;
    const pub = a.published_at ? new Date(a.published_at).toUTCString() : now;
    const cats = (Array.isArray(a.tags) ? a.tags : [])
      .map(t => `      <category>${esc(t)}</category>`).join('\n');
    return `    <item>
      <title><![CDATA[${a.title || ''}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description><![CDATA[${a.meta_description || a.excerpt || ''}]]></description>
      <pubDate>${pub}</pubDate>
      <dc:creator>CreatorFlow AI</dc:creator>
${cats}
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Blog IA — CreatorFlow Market</title>
    <link>${BASE}/blog</link>
    <description>Actualités IA, outils, tutoriels et stratégies pour créateurs et entrepreneurs du monde entier.</description>
    <language>fr</language>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE}/og-image.jpg</url>
      <title>CreatorFlow Market — Blog IA</title>
      <link>${BASE}/blog</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
}
