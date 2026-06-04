#!/usr/bin/env node
// Usage: node scripts/generate-article.js
// Or with args: node scripts/generate-article.js --title "Mon titre" --category "Guides IA"

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local manually (Node 20 --env-file alternative)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('❌ Fichier .env.local introuvable. Crée-le à partir de .env.local.example');
  process.exit(1);
}

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORIES = [
  'Actualités IA','Outils IA','Automatisation IA','Marketing IA',
  'Création de Contenu IA','Vente IA','Support Client IA',
  'Tutoriels IA','Comparatifs IA','Guides IA'
];

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const title    = getArg('--title')    || 'Guide complet : Comment automatiser son business avec l\'IA en 2026';
const category = getArg('--category') || 'Guides IA';
const keywords = getArg('--keywords') || '';

if (!CATEGORIES.includes(category)) {
  console.error(`❌ Catégorie invalide: "${category}"\nCatégories valides: ${CATEGORIES.join(', ')}`);
  process.exit(1);
}

const SYSTEM_PROMPT = `Tu es un rédacteur de contenu IA senior et expert SEO pour CreatorFlow Market — plateforme mondiale francophone pour créateurs, entrepreneurs et professionnels qui dominent leur marché avec l'IA.

STYLE : HubSpot Blog + Ahrefs + Vercel. Percutant, dense en valeur, professionnel mais accessible.

STRUCTURE HTML OBLIGATOIRE dans cet ordre exact :

── 1. ACCROCHE ──
Premier paragraphe : stat forte ou fait surprenant. Mot-clé principal dès la 1ère phrase.

── 2. SECTION POURQUOI C'EST IMPORTANT ──
<section class="why-matters">
  <h2>Pourquoi [sujet] change la donne en 2026</h2>
  <p>2-3 phrases de contexte et enjeux business concrets.</p>
  <div class="stats-row">
    <div class="stat-block"><span class="stat-num">X%</span><span class="stat-lbl">description courte</span></div>
    <div class="stat-block"><span class="stat-num">XK</span><span class="stat-lbl">description courte</span></div>
    <div class="stat-block"><span class="stat-num">Xx</span><span class="stat-lbl">description courte</span></div>
  </div>
</section>

── 3. CORPS PRINCIPAL ──
H2/H3/H4, paragraphes 2-4 lignes max, listes, au moins 2 blockquotes avec chiffres.
Callouts :
<div class="callout callout-tip"><strong>💡 Astuce :</strong> texte</div>
<div class="callout callout-warn"><strong>⚠️ Attention :</strong> texte</div>
<div class="callout callout-info"><strong>ℹ️ Info :</strong> texte</div>

── 4. CAS D'UTILISATION ──
<section class="use-cases">
  <h2>4 cas d'utilisation concrets</h2>
  <div class="uc-grid">
    <div class="uc-card"><div class="uc-icon">📈</div><h3 class="uc-title">Marketing</h3><p class="uc-desc">Cas concret avec chiffres.</p><div class="uc-result">✅ Résultat : gain mesurable</div></div>
    <div class="uc-card"><div class="uc-icon">🎬</div><h3 class="uc-title">Création de contenu</h3><p class="uc-desc">Cas concret avec chiffres.</p><div class="uc-result">✅ Résultat : gain mesurable</div></div>
    <div class="uc-card"><div class="uc-icon">⚡</div><h3 class="uc-title">Automatisation</h3><p class="uc-desc">Cas concret avec chiffres.</p><div class="uc-result">✅ Résultat : gain mesurable</div></div>
    <div class="uc-card"><div class="uc-icon">💰</div><h3 class="uc-title">Vente</h3><p class="uc-desc">Cas concret avec chiffres.</p><div class="uc-result">✅ Résultat : gain mesurable</div></div>
  </div>
</section>

── 5. TABLEAU COMPARATIF ──
<section class="comparison-section">
  <h2>[Outil/Sujet] vs alternatives : comparatif 2026</h2>
  <div class="table-wrap">
    <table class="comp-table">
      <thead><tr><th>Critère</th><th class="best">[Principal] ⭐</th><th>[Concurrent A]</th><th>[Concurrent B]</th></tr></thead>
      <tbody>
        <!-- 6 à 8 lignes : Prix, Facilité, Fonctionnalité x3, Intégrations, Support, Verdict -->
        <!-- Utiliser ✅ ⚠️ ❌ dans les cellules -->
      </tbody>
    </table>
  </div>
</section>

── 6. LONGUEUR ──
2000 à 3000 mots au total.

RÈGLES SEO :
- JAMAIS "créateurs francophones" — dire "créateurs", "entrepreneurs", "professionnels"
- Portée mondiale francophone
- Mot-clé principal dans H1, accroche, au moins 2 H2
- Questions longue traîne comme titres H2/H3`;

async function generate() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY manquant dans .env.local'); process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local'); process.exit(1);
  }

  console.log(`\n🤖 Génération de l'article...`);
  console.log(`   Titre    : ${title}`);
  console.log(`   Catégorie: ${category}`);
  if (keywords) console.log(`   Mots-clés: ${keywords}`);

  const prompt = `Génère un article de blog premium complet.

SUJET : ${title}
CATÉGORIE : ${category}
${keywords ? `MOTS-CLÉS : ${keywords}` : ''}

Réponds UNIQUEMENT avec ce JSON valide (sans markdown) :
{
  "title": "titre SEO puissant (55-65 chars)",
  "meta_description": "meta description SEO (145-158 chars)",
  "excerpt": "accroche percutante pour cards (180-220 chars)",
  "content": "article HTML complet (minimum 1800 mots)",
  "key_takeaways": ["point 1","point 2","point 3","point 4","point 5"],
  "faq": [
    {"question":"Q1 ?","answer":"Réponse 1."},
    {"question":"Q2 ?","answer":"Réponse 2."},
    {"question":"Q3 ?","answer":"Réponse 3."},
    {"question":"Q4 ?","answer":"Réponse 4."},
    {"question":"Q5 ?","answer":"Réponse 5."}
  ],
  "secondary_keywords": ["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8","kw9","kw10"],
  "longtail_keywords": ["comment faire X avec l'IA","meilleur outil IA pour Y","guide complet Z IA 2026","X automatisation workflow","X pour débutants"],
  "paa_questions": ["Q PAA 1 ?","Q PAA 2 ?","Q PAA 3 ?","Q PAA 4 ?","Q PAA 5 ?"],
  "seo_opportunities": ["Opportunité 1","Opportunité 2","Opportunité 3"],
  "topic_cluster": "Nom du cluster thématique",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "seo_score": 88
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const json = JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, ''));

  const wordCount = json.content.replace(/<[^>]+>/g, '').split(/\s+/).length;
  const reading_time = Math.max(4, Math.round(wordCount / 200));
  const slug = `${slugify(json.title, { lower: true, strict: true, locale: 'fr' })}-${Date.now()}`;

  console.log(`\n✅ Article généré : "${json.title}"`);
  console.log(`   Slug         : ${slug}`);
  console.log(`   Mots         : ~${wordCount}`);
  console.log(`   Lecture      : ${reading_time} min`);
  console.log(`   SEO score    : ${json.seo_score}/100`);

  console.log('\n💾 Insertion dans Supabase...');

  const { data, error } = await sb.from('blog_articles').insert({
    slug,
    title:               json.title,
    meta_description:    json.meta_description,
    excerpt:             json.excerpt,
    content:             json.content,
    category,
    tags:                json.tags || [],
    author:              'CreatorFlow AI',
    reading_time,
    views:               0,
    is_featured:         false,
    seo_score:           json.seo_score || 82,
    ai_generated:        true,
    status:              'published',
    published_at:        new Date().toISOString(),
    key_takeaways:       json.key_takeaways || [],
    faq:                 json.faq || [],
    secondary_keywords:  json.secondary_keywords || [],
    longtail_keywords:   json.longtail_keywords || [],
    paa_questions:       json.paa_questions || [],
    seo_opportunities:   json.seo_opportunities || [],
    topic_cluster:       json.topic_cluster || '',
  }).select().single();

  if (error) {
    console.error('❌ Erreur Supabase:', error.message);
    process.exit(1);
  }

  console.log(`\n🎉 Article publié !`);
  console.log(`   URL : https://creatorflowmarket.com/blog/${data.slug}`);
  console.log(`   ID  : ${data.id}`);
}

generate().catch(err => {
  console.error('❌ Erreur inattendue:', err.message);
  process.exit(1);
});
