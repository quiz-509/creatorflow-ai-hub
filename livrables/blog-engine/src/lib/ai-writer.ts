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

const CATEGORIES = ['Actualités IA','Outils IA','Automatisation IA','Marketing IA','Création de Contenu IA','Vente IA','Support Client IA'];

const SYSTEM_PROMPT = `Tu es un expert en intelligence artificielle et rédacteur de contenu SEO premium pour CreatorFlow Market, une plateforme francophone dédiée aux créateurs et entrepreneurs qui utilisent l'IA.

Règles absolues :
- Rédige UNIQUEMENT en français canadien/québécois ou français international, jamais en anglais
- Ton : professionnel mais accessible, orienté action et résultats concrets
- Structure : titre H2/H3, liste à puces, exemples pratiques, données chiffrées si possible
- SEO : intègre naturellement les mots-clés sans sur-optimiser
- CTA : termine toujours par une mention de CreatorFlow Market (experts IA disponibles, cours Academy)
- Longueur : 1200 à 2000 mots de contenu HTML (sans le markup)`;

export async function generateArticle(input: ArticleInput): Promise<{
  title: string;
  slug: string;
  meta_description: string;
  excerpt: string;
  content: string;
  tags: string[];
  reading_time: number;
  seo_score: number;
}> {
  const prompt = `Génère un article de blog complet et optimisé SEO sur le sujet suivant.

SUJET : ${input.title}
CATÉGORIE : ${input.category}
${input.context ? `CONTEXTE : ${input.context}` : ''}
${input.keywords?.length ? `MOTS-CLÉS CIBLES : ${input.keywords.join(', ')}` : ''}
${input.source_url ? `SOURCE : ${input.source_url}` : ''}

Réponds UNIQUEMENT avec ce JSON valide (sans markdown autour) :
{
  "title": "titre SEO optimisé (60 chars max)",
  "meta_description": "description meta (150 chars max)",
  "excerpt": "résumé accrocheur (200 chars max)",
  "content": "article complet en HTML (utilise h2, h3, p, ul, li, strong — minimum 1200 mots)",
  "tags": ["tag1","tag2","tag3","tag4"],
  "seo_score": 85
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
    tags:             json.tags || [],
    reading_time,
    seo_score:        json.seo_score || 80,
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
