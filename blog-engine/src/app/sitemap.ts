import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = 'https://blog.creatorflowmarket.com';

  const { data: articles } = await supabase
    .from('blog_articles')
    .select('slug,published_at,updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const articleUrls = (articles || []).map(a => ({
    url:            `${BASE}/${a.slug}`,
    lastModified:   new Date(a.updated_at || a.published_at),
    changeFrequency:'weekly' as const,
    priority:       0.8,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...articleUrls,
  ];
}
