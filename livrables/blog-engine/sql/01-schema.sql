-- ============================================================
-- CreatorFlow AI News Engine — Schéma Supabase
-- À exécuter dans : Supabase > SQL Editor
-- ============================================================

-- 1. ARTICLES
CREATE TABLE IF NOT EXISTS blog_articles (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug             TEXT        UNIQUE NOT NULL,
  title            TEXT        NOT NULL,
  subtitle         TEXT,
  meta_description TEXT        CHECK (char_length(meta_description) <= 160),
  content          TEXT,
  excerpt          TEXT,
  category         TEXT        DEFAULT 'Actualités IA'
                               CHECK (category IN ('Actualités IA','Outils IA','Automatisation IA','Marketing IA','Création de Contenu IA','Vente IA','Support Client IA')),
  tags             TEXT[]      DEFAULT '{}',
  author           TEXT        DEFAULT 'CreatorFlow AI',
  author_avatar    TEXT,
  status           TEXT        DEFAULT 'draft'
                               CHECK (status IN ('draft','published','archived')),
  featured_image   TEXT,
  og_image         TEXT,
  reading_time     INTEGER     DEFAULT 5,
  views            INTEGER     DEFAULT 0,
  likes            INTEGER     DEFAULT 0,
  is_featured      BOOLEAN     DEFAULT false,
  seo_score        INTEGER     DEFAULT 0  CHECK (seo_score BETWEEN 0 AND 100),
  ai_generated     BOOLEAN     DEFAULT true,
  source_url       TEXT,
  schema_markup    JSONB,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_articles_status     ON blog_articles(status);
CREATE INDEX IF NOT EXISTS idx_blog_articles_category   ON blog_articles(category);
CREATE INDEX IF NOT EXISTS idx_blog_articles_published  ON blog_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_articles_featured   ON blog_articles(is_featured);
CREATE INDEX IF NOT EXISTS idx_blog_articles_slug       ON blog_articles(slug);

-- 2. SOURCES DE VEILLE
CREATE TABLE IF NOT EXISTS blog_sources (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT        NOT NULL,
  url              TEXT        NOT NULL,
  feed_url         TEXT,
  type             TEXT        DEFAULT 'rss' CHECK (type IN ('rss','api','scraper')),
  category         TEXT,
  is_active        BOOLEAN     DEFAULT true,
  last_checked     TIMESTAMPTZ,
  check_interval   INTEGER     DEFAULT 360,  -- minutes
  articles_found   INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ÉVÉNEMENTS BRUTS (avant traitement IA)
CREATE TABLE IF NOT EXISTS blog_raw_events (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id        UUID        REFERENCES blog_sources(id) ON DELETE SET NULL,
  title            TEXT        NOT NULL,
  url              TEXT,
  summary          TEXT,
  event_type       TEXT        CHECK (event_type IN ('new_tool','update','funding','acquisition','model_release','trend','tutorial')),
  relevance_score  INTEGER     DEFAULT 50  CHECK (relevance_score BETWEEN 0 AND 100),
  processed        BOOLEAN     DEFAULT false,
  article_id       UUID        REFERENCES blog_articles(id) ON DELETE SET NULL,
  detected_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_events_processed ON blog_raw_events(processed);
CREATE INDEX IF NOT EXISTS idx_raw_events_score     ON blog_raw_events(relevance_score DESC);

-- 4. POSTS RÉSEAUX SOCIAUX
CREATE TABLE IF NOT EXISTS blog_social_posts (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id       UUID        REFERENCES blog_articles(id) ON DELETE CASCADE,
  platform         TEXT        NOT NULL CHECK (platform IN ('linkedin','twitter','facebook','instagram')),
  content          TEXT        NOT NULL,
  image_url        TEXT,
  status           TEXT        DEFAULT 'pending' CHECK (status IN ('pending','published','failed')),
  published_at     TIMESTAMPTZ,
  external_post_id TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ABONNÉS NEWSLETTER
CREATE TABLE IF NOT EXISTS blog_subscribers (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email            TEXT        UNIQUE NOT NULL,
  status           TEXT        DEFAULT 'active' CHECK (status IN ('active','unsubscribed')),
  source           TEXT        DEFAULT 'blog',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FONCTIONS UTILITAIRES
-- ============================================================

-- Incrémenter les vues
CREATE OR REPLACE FUNCTION increment_blog_views(article_slug TEXT)
RETURNS void AS $$
  UPDATE blog_articles SET views = views + 1 WHERE slug = article_slug AND status = 'published';
$$ LANGUAGE sql SECURITY DEFINER;

-- Mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_articles_updated_at
  BEFORE UPDATE ON blog_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE blog_articles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_raw_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_subscribers  ENABLE ROW LEVEL SECURITY;

-- Lecture publique des articles publiés
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_articles' AND policyname='public read published') THEN
    CREATE POLICY "public read published" ON blog_articles FOR SELECT USING (status = 'published');
  END IF;
END $$;

-- Abonnés : insertion publique
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blog_subscribers' AND policyname='public insert subscribers') THEN
    CREATE POLICY "public insert subscribers" ON blog_subscribers FOR INSERT WITH CHECK (true);
  END IF;
END $$;
