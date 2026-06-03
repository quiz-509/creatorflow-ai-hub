import Parser from 'rss-parser';
import { supabaseService } from './supabase';
import { scoreRelevance, saveAndPublishArticle } from './ai-writer';

const parser = new Parser();

const RSS_SOURCES = [
  { name: 'OpenAI',          url: 'https://openai.com/blog/rss.xml',                           category: 'Actualités IA' },
  { name: 'Anthropic',       url: 'https://www.anthropic.com/rss.xml',                         category: 'Actualités IA' },
  { name: 'Google AI',       url: 'https://ai.googleblog.com/feeds/posts/default',             category: 'Actualités IA' },
  { name: 'Hugging Face',    url: 'https://huggingface.co/blog/feed.xml',                      category: 'Outils IA' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/',                    category: 'Actualités IA' },
  { name: 'Towards DS',      url: 'https://medium.com/feed/towards-data-science',              category: 'Automatisation IA' },
  { name: 'Reddit ML',       url: 'https://www.reddit.com/r/MachineLearning/.rss',             category: 'Actualités IA' },
  { name: 'Reddit LocalLLM', url: 'https://www.reddit.com/r/LocalLLaMA/.rss',                 category: 'Outils IA' },
];

export const CATEGORY_MAP: Record<string, string> = {
  'chatgpt': 'Actualités IA', 'openai': 'Actualités IA', 'claude': 'Actualités IA',
  'anthropic': 'Actualités IA', 'gemini': 'Actualités IA', 'google ai': 'Actualités IA',
  'n8n': 'Automatisation IA', 'make': 'Automatisation IA', 'zapier': 'Automatisation IA',
  'workflow': 'Automatisation IA', 'automation': 'Automatisation IA',
  'marketing': 'Marketing IA', 'seo': 'Marketing IA', 'social media': 'Marketing IA',
  'content': 'Création de Contenu IA', 'video': 'Création de Contenu IA', 'image': 'Création de Contenu IA',
  'sales': 'Vente IA', 'vente': 'Vente IA', 'copywriting': 'Vente IA',
  'customer': 'Support Client IA', 'chatbot': 'Support Client IA', 'support': 'Support Client IA',
};

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return cat;
  }
  return 'Actualités IA';
}

async function isAlreadyProcessed(url: string): Promise<boolean> {
  const { data } = await supabaseService
    .from('blog_raw_events')
    .select('id')
    .eq('url', url)
    .limit(1);
  return (data?.length || 0) > 0;
}

async function fetchFeed(source: typeof RSS_SOURCES[0]) {
  try {
    const feed = await parser.parseURL(source.url);
    const events = [];

    for (const item of (feed.items || []).slice(0, 10)) {
      if (!item.title || !item.link) continue;
      if (await isAlreadyProcessed(item.link)) continue;

      const summary   = item.contentSnippet || item.summary || '';
      const score     = await scoreRelevance(item.title, summary);
      const category  = detectCategory(item.title + ' ' + summary) || source.category;

      events.push({
        title:           item.title,
        url:             item.link,
        summary,
        event_type:      'update',
        relevance_score: score,
        processed:       false,
        detected_at:     item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        _category:       category,
      });
    }

    return events;
  } catch (err) {
    console.error(`[monitor] ${source.name} failed:`, err);
    return [];
  }
}

export async function runMonitorCycle(autoPublishThreshold = 75) {
  console.log('[monitor] Cycle de veille démarré...');
  let totalNew = 0;

  for (const source of RSS_SOURCES) {
    const events = await fetchFeed(source);

    for (const evt of events) {
      const { _category, ...eventData } = evt;

      const { data } = await supabaseService
        .from('blog_raw_events')
        .insert(eventData)
        .select()
        .single();

      if (!data) continue;
      totalNew++;

      if (evt.relevance_score >= autoPublishThreshold) {
        try {
          const article = await saveAndPublishArticle({
            title:      evt.title,
            category:   _category,
            source_url: evt.url,
            context:    evt.summary,
          });

          await supabaseService
            .from('blog_raw_events')
            .update({ processed: true, article_id: article.id })
            .eq('id', data.id);

          console.log(`[monitor] Article publié: ${article.title}`);
        } catch (err) {
          console.error('[monitor] Erreur génération article:', err);
        }
      }
    }
  }

  console.log(`[monitor] Cycle terminé. ${totalNew} nouveaux événements.`);
  return totalNew;
}
