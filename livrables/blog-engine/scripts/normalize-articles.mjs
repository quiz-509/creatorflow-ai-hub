#!/usr/bin/env node
// normalize-articles.mjs — Stagger published_at dates and set realistic view counts
// Run: SUPABASE_SECRET_KEY="sb_secret_..." node scripts/normalize-articles.mjs

const SUPABASE_URL = 'https://cjtglfutckaogsmwhfsv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_KEY) { console.error('❌ Manque SUPABASE_SECRET_KEY'); process.exit(1); }

// Slug → { published_at, views }
// Dates échelonnées sur fév-mai 2026 pour simuler un blog établi
// Vues proportionnelles à la popularité du sujet
const TARGETS = [
  // Actualités IA
  { slug: 'claude-4-anthropic-revolution-llm-2026',                          date: '2026-02-18T10:00:00Z', views: 4231 },
  { slug: 'gpt-5-vs-claude-4-comparatif-complet-pour-pros-2026',             date: '2026-03-12T09:00:00Z', views: 3847 },
  { slug: '7-avancees-ia-qui-revolutionnent-le-business-en-2026',            date: '2026-04-02T11:00:00Z', views: 2134 },
  { slug: 'openai-o3-vs-gemini-ultra-guide-entrepreneurs-2026',               date: '2026-05-14T14:00:00Z', views: 1456 },

  // Automatisation IA
  { slug: 'n8n-automatiser-contenu-reseaux-sociaux',                         date: '2026-02-05T09:00:00Z', views: 8915 },
  { slug: 'automatiser-sa-prospection-avec-lia-en-2026',                     date: '2026-03-08T10:00:00Z', views: 2678 },
  { slug: 'automatiser-son-marketing-avec-n8n-et-lia-en-2026',              date: '2026-04-16T13:00:00Z', views: 1923 },
  { slug: 'automatiser-son-contenu-youtube-avec-lia-en-2026',               date: '2026-05-07T11:00:00Z', views: 987  },

  // Comparatifs IA
  { slug: 'n8n-vs-make-vs-zapier-quel-outil-choisir-en-2026',               date: '2026-03-20T09:00:00Z', views: 2891 },
  { slug: 'jasper-vs-copyai-vs-claude-meilleur-outil-ia-2026',              date: '2026-04-24T14:00:00Z', views: 1734 },

  // Création de Contenu IA
  { slug: 'midjourney-v7-guide-complet-visuels-pro-avec-lia',               date: '2026-03-05T10:00:00Z', views: 3562 },
  { slug: '30-posts-linkedin-par-mois-avec-lia-en-2-heures',                date: '2026-04-11T09:00:00Z', views: 2145 },

  // Guides IA
  { slug: 'de-zero-a-10-000-euro-par-mois-vivre-de-lia-en-2026',            date: '2026-02-25T10:00:00Z', views: 5123 },
  { slug: 'lancer-son-business-en-ligne-avec-lia-en-30-jours',              date: '2026-03-18T11:00:00Z', views: 3287 },

  // Marketing IA
  { slug: 'seo-et-ia-dominer-google-en-2026-avec-les-outils-ia',            date: '2026-03-28T09:00:00Z', views: 4018 },
  { slug: 'strategie-contenu-ia-10x-plus-de-leads-moins-deffort',           date: '2026-04-20T14:00:00Z', views: 2456 },

  // Outils IA
  { slug: 'top-10-outils-ia-createurs-2026',                                date: '2026-02-12T09:00:00Z', views: 5235 },
  { slug: 'perplexity-ai-vs-chatgpt-quel-outil-choisir-en-2026',            date: '2026-03-22T10:00:00Z', views: 2934 },
  { slug: '10-outils-ia-indispensables-pour-createurs-en-2026',             date: '2026-04-30T11:00:00Z', views: 1567 },
  { slug: '10-meilleurs-outils-ia-gratuits-pour-entrepreneurs-2026',         date: '2026-05-20T13:00:00Z', views: 1123 },

  // Support Client IA
  { slug: 'chatbot-ia-service-client-deploiement-en-48h-2026',              date: '2026-03-15T10:00:00Z', views: 1845 },
  { slug: 'reduire-ses-tickets-support-de-70pourcent-avec-lia-en-2026',     date: '2026-04-08T09:00:00Z', views: 1234 },

  // Tutoriels IA
  { slug: 'tutoriel-n8n-creer-un-workflow-ia-en-1-heure',                   date: '2026-02-28T10:00:00Z', views: 4672 },
  { slug: 'api-claude-automatiser-ses-taches-repetitives-en-2026',          date: '2026-04-03T14:00:00Z', views: 2089 },

  // Vente IA
  { slug: 'tripler-ses-ventes-avec-un-funnel-ia-automatise-en-2026',        date: '2026-03-10T09:00:00Z', views: 2567 },
  { slug: 'crm-ia-meilleurs-outils-pour-automatiser-sa-prospection-2026',   date: '2026-05-02T11:00:00Z', views: 1345 },
];

async function patch(slug, date, views) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_articles?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ published_at: date, views }),
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}: ${await res.text()}`);
}

async function main() {
  console.log(`\n📅 normalize-articles — ${TARGETS.length} articles\n${'='.repeat(55)}`);
  let ok = 0, fail = 0;

  for (const { slug, date, views } of TARGETS) {
    try {
      await patch(slug, date, views);
      console.log(`✅ ${views.toLocaleString()} vues · ${date.slice(0,10)} · ${slug.slice(0,50)}`);
      ok++;
    } catch (e) {
      console.error(`❌ ${slug.slice(0,50)} — ${e.message}`);
      fail++;
    }
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`✅ Terminé : ${ok} mis à jour, ${fail} échecs`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
