import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase        = createClient(SUPABASE_URL, SUPABASE_KEY);
export const supabaseService = createClient(SUPABASE_URL, SERVICE_KEY);

export type Article = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  meta_description?: string;
  content?: string;
  excerpt?: string;
  category: string;
  tags: string[];
  author: string;
  featured_image?: string;
  og_image?: string;
  reading_time: number;
  views: number;
  is_featured: boolean;
  seo_score: number;
  ai_generated: boolean;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_at: string;
};

export type RawEvent = {
  id: string;
  source_id?: string;
  title: string;
  url?: string;
  summary?: string;
  event_type?: string;
  relevance_score: number;
  processed: boolean;
  detected_at: string;
};

export async function getPublishedArticles(options?: {
  category?: string;
  limit?: number;
  offset?: number;
  featured?: boolean;
}) {
  let q = supabase
    .from('blog_articles')
    .select('id,slug,title,subtitle,excerpt,category,tags,author,featured_image,reading_time,views,is_featured,published_at,seo_score', { count: 'exact' })
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (options?.category && options.category !== 'all') q = q.eq('category', options.category);
  if (options?.featured)                               q = q.eq('is_featured', true);
  if (options?.limit)                                  q = q.limit(options.limit);
  if (options?.offset)                                 q = q.range(options.offset, options.offset + (options.limit || 9) - 1);

  return q;
}

export async function getArticleBySlug(slug: string) {
  return supabase
    .from('blog_articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();
}

export async function incrementViews(slug: string) {
  return supabase.rpc('increment_blog_views', { article_slug: slug });
}
