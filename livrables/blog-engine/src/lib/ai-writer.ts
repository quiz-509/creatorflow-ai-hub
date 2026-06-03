import Anthropic from '@anthropic-ai/sdk';
import { supabaseService } from './supabase';
import slugify from 'slugify';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ArticleInput = {
  title: string;
  category: string;
  source_url?: string;
  context?: string;
  keywords?: string[];
};

const CATEGORIES = ['Actualités IA','Outils IA','Automatisation IA','Marketing IA','Création de Contenu IA','Vente IA','Support Client IA','Tutoriels IA','Comparatifs IA','Guides IA'];

const SYSTEM_PROMPT = `Tu es un rédacteur de contenu IA de niveau senior pour CreatorFlow Market — une plateforme mondiale en français pour créateurs, entrepreneurs et professionnels qui veulent dominer leur marché avec l'IA.

STYLE : Pense HubSpot Blog + Ahrefs + Vercel. Percutant, dense en valeur, professionnel mais accessible.

STRUCTURE OBLIGATOIRE DE CHAQUE ARTICLE (en HTML) :

1. Accroche choc : premier paragraphe avec un fait surprenant, une statistique ou une tension forte. Ex: "En 2026, les business qui n'automatisent pas avec l'IA perdent 40% de parts de marché face à leurs concurrents."

2. Corps structuré avec H2/H3/H4 :
   - Paragraphes courts (2-4 lignes max)
   - Listes à puces pour les points clés
   - Au moins 2 blockquotes avec des insights experts
   - Des chiffres et données chiffrées dans chaque section
   - Un tableau de comparaison si pertinent (HTML <table>)
   - Des callouts styled avec class="callout callout-tip" ou callout-warn ou callout-info

3. Section "Cas d'usage concrets" (si pertinent) :
   - Marketing, Création de contenu, Automatisation, Vente
   - Exemple réel + résultat mesurable

4. Section FAQ (5-7 questions, au format JSON séparé)

RÈGLES :
- JAMAIS "créateurs francophones" — dire "créateurs", "entrepreneurs", "professionnels"
- Portée mondiale, ex. concrets variés (pas seulement Québec/France)
- SEO naturel : mots-clés intégrés sans sur-optimiser
- CTA final : mention CreatorFlow Market (experts IA, Academy)
- Longueur : 1800 à 3000 mots de contenu HTML

IMPORTANT : Les callouts se codent ainsi :
<div class="callout callout-tip"><strong>💡 Astuce :</strong> texte ici</div>
<div class="callout callout-warn"><strong>⚠️ Attention :</strong> texte ici</div>
<div class="callout callout-info"><strong>ℹ️ À savoir :</strong> texte ici</div>`;

export async function generateArticle(input: ArticleInput): Promise<{
  title: string;
  slug: string;
  meta_description: string;
  excerpt: string;
  content: string;
  key_takeaways: string[];
  faq: { question: string; answer: string }[];
  tags: string[];
  reading_time: number;
  seo_score: number;
}> {
  const prompt = `Génère un article de blog premium complet sur le sujet suivant.

SUJET : ${input.title}
CATÉGORIE : ${input.category}
${input.context ? `CONTEXTE : ${input.context}` : ''}
${input.keywords?.length ? `MOTS-CLÉS CIBLES : ${input.keywords.join(', ')}` : ''}
${input.source_url ? `SOURCE : ${input.source_url}` : ''}

Réponds UNIQUEMENT avec ce JSON valide (sans markdown autour) :
{
  "title": "titre SEO puissant (55-65 chars)",
  "meta_description": "meta description SEO (145-158 chars)",
  "excerpt": "accroche percutante pour cards (180-220 chars)",
  "content": "article HTML complet (H2/H3/H4, blockquotes, callouts, table si pertinent — minimum 1800 mots)",
  "key_takeaways": ["point clé 1", "point clé 2", "point clé 3", "point clé 4", "point clé 5"],
  "faq": [
    {"question": "Question fréquente 1 ?", "answer": "Réponse complète et utile."},
    {"question": "Question fréquente 2 ?", "answer": "Réponse complète et utile."},
    {"question": "Question fréquente 3 ?", "answer": "Réponse complète et utile."},
    {"question": "Question fréquente 4 ?", "answer": "Réponse complète et utile."},
    {"question": "Question fréquente 5 ?", "answer": "Réponse complète et utile."}
  ],
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "seo_score": 88
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0] as { text: string }).text.trim();
  const json = JSON.parse(raw.replace(/^```json\n?/, '').replace(/\n?```$/, ''));

  const wordCount = json.content.replace(/<[^>]+>/g, '').split(/\s+/).length;
  const reading_time = Math.max(4, Math.round(wordCount / 200));

  return {
    title:            json.title,
    slug:             slugify(json.title, { lower: true, strict: true, locale: 'fr' }),
    meta_description: json.meta_description,
    excerpt:          json.excerpt,
    content:          json.content,
    key_takeaways:    json.key_takeaways || [],
    faq:              json.faq || [],
    tags:             json.tags || [],
    reading_time,
    seo_score:        json.seo_score || 82,
  };
}

export async function saveAndPublishArticle(input: ArticleInput) {
  const article = await generateArticle(input);

  const slug = `${article.slug}-${Date.now()}`;

  const { data, error } = await supabaseService
    .from('blog_articles')
    .insert({
      ...article,
      slug,
      category:   input.category,
      source_url: input.source_url,
      author:     'CreatorFlow AI',
      status:     'published',
      ai_generated: true,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function scoreRelevance(title: string, summary: string): Promise<number> {
  const aiKeywords = ['ia','intelligence artificielle','llm','gpt','claude','gemini','chatgpt','openai','anthropic','google ai','meta ai','microsoft ai','automation','workflow','agent','model','fine-tuning','rag','embedding','prompt','generative'];
  const text = (title + ' ' + summary).toLowerCase();
  const matches = aiKeywords.filter(kw => text.includes(kw)).length;
  return Math.min(100, matches * 12 + 30);
}
