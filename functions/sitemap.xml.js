export async function onRequest() {
  const SUPABASE_URL = 'https://cjtglfutckaogsmwhfsv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei';
  const BASE = 'https://creatorflowmarket.com';

  const statics = [
    { loc: `${BASE}/`,         changefreq: 'weekly',  priority: '1.0' },
    { loc: `${BASE}/blog`,     changefreq: 'daily',   priority: '0.9' },
    { loc: `${BASE}/experts`,  changefreq: 'weekly',  priority: '0.8' },
    { loc: `${BASE}/academie`, changefreq: 'weekly',  priority: '0.8' },
    { loc: `${BASE}/pricing`,  changefreq: 'monthly', priority: '0.7' },
  ];

  let dynamics = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_articles?select=slug,published_at,updated_at&status=eq.published&order=published_at.desc&limit=1000`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await r.json();
    dynamics = (Array.isArray(rows) ? rows : []).map(a => ({
      loc: `${BASE}/blog/${a.slug}`,
      lastmod: (a.updated_at || a.published_at || '').split('T')[0],
      changefreq: 'monthly',
      priority: '0.7',
    }));
  } catch {}

  const block = u =>
    `  <url>\n    <loc>${u.loc}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...statics, ...dynamics].map(block).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
