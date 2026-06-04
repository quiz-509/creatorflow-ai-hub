#!/usr/bin/env node
// auto-archive.mjs — Archives articles with 0 views published more than 120 days ago
// Usage: SUPABASE_SECRET_KEY="sb_secret_..." node scripts/auto-archive.mjs

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cjtglfutckaogsmwhfsv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_KEY) { console.error('❌ Manque SUPABASE_SECRET_KEY'); process.exit(1); }

const DAYS_THRESHOLD = parseInt(process.env.ARCHIVE_DAYS || '120', 10);
const cutoff = new Date(Date.now() - DAYS_THRESHOLD * 24 * 60 * 60 * 1000).toISOString();

async function main() {
  console.log(`\n🗃️  auto-archive — articles publiés avant ${cutoff.slice(0,10)} avec 0 vues`);
  console.log('='.repeat(60));

  // Fetch candidates
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blog_articles?select=id,slug,title,views,published_at&status=eq.published&views=eq.0&published_at=lt.${cutoff}&limit=50`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) throw new Error(`Supabase fetch ${res.status}: ${await res.text()}`);
  const articles = await res.json();

  if (!articles.length) {
    console.log('✅ Aucun article à archiver.');
    return;
  }

  console.log(`\n${articles.length} article(s) à archiver :\n`);
  let archived = 0;

  for (const a of articles) {
    console.log(`  → ${a.title.substring(0, 60)} (${a.published_at.slice(0,10)})`);
    const patch = await fetch(
      `${SUPABASE_URL}/rest/v1/blog_articles?id=eq.${a.id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'archived' }),
      }
    );
    if (patch.ok) { console.log(`     ✅ Archivé`); archived++; }
    else console.error(`     ❌ Erreur PATCH ${patch.status}`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ ${archived}/${articles.length} articles archivés`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
