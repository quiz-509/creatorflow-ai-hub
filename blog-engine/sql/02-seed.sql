-- ============================================================
-- Seed : Sources de veille + Articles de démonstration
-- ============================================================

-- SOURCES DE VEILLE IA
INSERT INTO blog_sources (name, url, feed_url, type, category) VALUES
  ('OpenAI Blog',        'https://openai.com/blog',                  'https://openai.com/blog/rss.xml',           'rss',     'Actualités IA'),
  ('Anthropic Blog',     'https://www.anthropic.com/news',           'https://www.anthropic.com/rss.xml',         'rss',     'Actualités IA'),
  ('Google AI Blog',     'https://ai.googleblog.com',                'https://ai.googleblog.com/feeds/posts/default','rss', 'Actualités IA'),
  ('Hugging Face Blog',  'https://huggingface.co/blog',              'https://huggingface.co/blog/feed.xml',      'rss',     'Outils IA'),
  ('MIT Tech Review AI', 'https://www.technologyreview.com/ai',      'https://www.technologyreview.com/feed/',    'rss',     'Actualités IA'),
  ('The Rundown AI',     'https://www.therundown.ai',                null,                                        'scraper', 'Actualités IA'),
  ('Product Hunt AI',    'https://www.producthunt.com/topics/artificial-intelligence', null,                      'api',     'Outils IA'),
  ('Reddit r/MachineLearning','https://www.reddit.com/r/MachineLearning', 'https://www.reddit.com/r/MachineLearning/.rss','rss','Actualités IA'),
  ('GitHub Trending AI', 'https://github.com/trending?l=python&since=daily', null,                                'scraper', 'Outils IA'),
  ('Towards Data Science','https://towardsdatascience.com',          'https://medium.com/feed/towards-data-science','rss', 'Automatisation IA')
ON CONFLICT DO NOTHING;

-- ARTICLES DE DÉMONSTRATION
INSERT INTO blog_articles (slug, title, subtitle, meta_description, excerpt, content, category, tags, author, reading_time, views, is_featured, seo_score, ai_generated, status, published_at) VALUES

('claude-4-anthropic-revolution-llm-2026',
 'Claude 4 d''Anthropic Révolutionne le Développement IA',
 'Le modèle le plus avancé d''Anthropic change la donne pour les créateurs',
 'Claude 4 d''Anthropic : 500k tokens, raisonnement avancé, nouvelles capacités. Tout ce que vous devez savoir.',
 'Anthropic vient de lancer Claude 4, son modèle le plus avancé. Avec des capacités de raisonnement étendues et une fenêtre de contexte de 500k tokens, ce modèle change la donne pour les développeurs et créateurs de contenu francophones.',
 '<h2>Claude 4 : Ce qui change vraiment</h2><p>Anthropic a lancé Claude 4, son modèle d''intelligence artificielle le plus performant à ce jour. Au-delà des chiffres impressionnants, ce qui marque une rupture c''est la capacité du modèle à maintenir un contexte cohérent sur des sessions de travail très longues.</p><h2>Les nouvelles fonctionnalités clés</h2><p>La fenêtre de contexte de 500 000 tokens permet d''analyser des documents entiers, des codebases complètes ou des transcriptions longues en une seule requête. Pour les créateurs de contenu, cela ouvre des possibilités inédites...</p><h2>Impact pour les créateurs francophones</h2><p>Pour les créateurs de contenu sur YouTube, TikTok et Instagram, Claude 4 représente une opportunité majeure : automatiser la recherche, la rédaction et l''optimisation SEO de façon plus naturelle que jamais.</p><h2>Prix et disponibilité</h2><p>Claude 4 est disponible via l''API Anthropic et dans Claude.ai. Les tarifs sont compétitifs face à GPT-4o.</p>',
 'Actualités IA',
 ARRAY['Claude 4','Anthropic','LLM','IA générative'],
 'CreatorFlow AI', 8, 2847, true, 92, true, 'published', NOW() - INTERVAL '3 days'),

('top-10-outils-ia-createurs-2026',
 '10 Outils IA Indispensables pour les Créateurs en 2026',
 'De la génération vidéo à l''automatisation sociale, le toolkit complet',
 '10 outils IA essentiels pour les créateurs de contenu en 2026 : génération vidéo, montage automatique, scripts IA.',
 'De la génération vidéo à l''automatisation des réseaux sociaux, voici les outils IA qui transforment le workflow des créateurs de contenu les plus performants.',
 '<h2>Pourquoi l''IA est devenue incontournable pour les créateurs</h2><p>En 2026, les créateurs de contenu qui n''utilisent pas l''IA produisent 3x moins de contenu que leurs concurrents. Voici les 10 outils qui font la différence.</p><h2>1. Sora (OpenAI) — Génération vidéo</h2><p>Sora permet de créer des vidéos professionnelles à partir d''un simple texte. Les créateurs l''utilisent pour les intro de vidéos, les transitions et les visuels de couverture.</p><h2>2. ElevenLabs — Voix IA</h2><p>La synthèse vocale la plus naturelle du marché. Idéal pour les podcasts, les vidéos YouTube et les réels Instagram.</p>',
 'Outils IA',
 ARRAY['Outils IA','Créateurs','Workflow','Productivité'],
 'CreatorFlow AI', 12, 5234, false, 88, true, 'published', NOW() - INTERVAL '6 days'),

('n8n-automatiser-contenu-reseaux-sociaux',
 'n8n : Automatiser 100% de Votre Contenu Réseaux Sociaux',
 'Le guide complet pour publier sans lever le petit doigt',
 'Guide n8n pour automatiser votre contenu Instagram, TikTok, YouTube et LinkedIn avec l''IA. Workflow complet inclus.',
 'Découvrez comment configurer un workflow n8n qui génère, planifie et publie automatiquement votre contenu sur Instagram, TikTok, YouTube et LinkedIn sans lever le petit doigt.',
 '<h2>Pourquoi n8n est l''outil d''automatisation idéal pour les créateurs</h2><p>n8n est open-source, auto-hébergeable et dispose de centaines d''intégrations natives. Contrairement à Zapier, il n''impose pas de limites strictes sur les exécutions.</p><h2>Architecture du workflow de publication automatique</h2><p>Notre workflow se compose de 4 étapes principales : (1) Génération d''idées via Claude AI, (2) Création du contenu multiformat, (3) Génération des visuels avec DALL-E, (4) Publication programmée sur chaque plateforme.</p>',
 'Automatisation IA',
 ARRAY['n8n','Automatisation','Réseaux Sociaux','Workflow'],
 'CreatorFlow AI', 15, 8912, false, 95, true, 'published', NOW() - INTERVAL '9 days')

ON CONFLICT (slug) DO NOTHING;
