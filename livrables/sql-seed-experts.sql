-- ============================================================
-- CreatorFlow Market — Seed 5 experts réels
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Ajouter la colonne statut si elle n'existe pas
ALTER TABLE experts ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'pending';

-- 2. Créer les comptes auth (contourne l'inscription normale)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
)
VALUES
  (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'marie.fontaine@creatorflow.dev',
    crypt('Temp2026!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"prenom":"Marie-Claire","nom":"Fontaine","type_utilisateur":"expert"}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'jean.kouassi@creatorflow.dev',
    crypt('Temp2026!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"prenom":"Jean-Baptiste","nom":"Kouassi","type_utilisateur":"expert"}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'a1b2c3d4-0003-4000-8000-000000000003',
    'aminata.diallo@creatorflow.dev',
    crypt('Temp2026!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"prenom":"Aminata","nom":"Diallo","type_utilisateur":"expert"}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'theo.bergeron@creatorflow.dev',
    crypt('Temp2026!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"prenom":"Théo","nom":"Bergeron","type_utilisateur":"expert"}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'a1b2c3d4-0005-4000-8000-000000000005',
    'isabelle.chen@creatorflow.dev',
    crypt('Temp2026!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"prenom":"Isabelle","nom":"Chen","type_utilisateur":"expert"}',
    'authenticated', 'authenticated', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Mettre à jour les profils (le trigger les a créés)
UPDATE profiles SET
  prenom = 'Marie-Claire', nom = 'Fontaine',
  type_utilisateur = 'expert',
  photo_url = 'https://i.pravatar.cc/300?u=marie.fontaine'
WHERE id = 'a1b2c3d4-0001-4000-8000-000000000001';

UPDATE profiles SET
  prenom = 'Jean-Baptiste', nom = 'Kouassi',
  type_utilisateur = 'expert',
  photo_url = 'https://i.pravatar.cc/300?u=jean.kouassi'
WHERE id = 'a1b2c3d4-0002-4000-8000-000000000002';

UPDATE profiles SET
  prenom = 'Aminata', nom = 'Diallo',
  type_utilisateur = 'expert',
  photo_url = 'https://i.pravatar.cc/300?u=aminata.diallo'
WHERE id = 'a1b2c3d4-0003-4000-8000-000000000003';

UPDATE profiles SET
  prenom = 'Théo', nom = 'Bergeron',
  type_utilisateur = 'expert',
  photo_url = 'https://i.pravatar.cc/300?u=theo.bergeron'
WHERE id = 'a1b2c3d4-0004-4000-8000-000000000004';

UPDATE profiles SET
  prenom = 'Isabelle', nom = 'Chen',
  type_utilisateur = 'expert',
  photo_url = 'https://i.pravatar.cc/300?u=isabelle.chen'
WHERE id = 'a1b2c3d4-0005-4000-8000-000000000005';

-- 4. Insérer les fiches experts
INSERT INTO experts (
  id, specialite, bio, competences, categories,
  tarif_heure, disponible, note_moyenne, nb_avis,
  photo_url, statut
)
VALUES
  (
    'a1b2c3d4-0001-4000-8000-000000000001',
    'IA & Automatisation',
    'Consultante en transformation IA avec 6 ans d''expérience. J''aide les entrepreneurs et PME à automatiser leurs processus et intégrer l''IA dans leur workflow quotidien. Certifiée Google Cloud AI et OpenAI.',
    ARRAY['ChatGPT', 'Make (Integromat)', 'n8n', 'Zapier', 'Prompt Engineering', 'LLM Fine-tuning'],
    ARRAY['Intelligence Artificielle', 'Automatisation'],
    120,
    true,
    4.9,
    34,
    'https://i.pravatar.cc/300?u=marie.fontaine',
    'approved'
  ),
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Marketing Digital & Growth',
    'Growth marketer francophone spécialisé dans l''acquisition organique et payante. J''ai accompagné +40 marques d''Afrique et d''Europe francophone à scaler leur présence en ligne avec des budgets maîtrisés.',
    ARRAY['Meta Ads', 'Google Ads', 'SEO', 'Email Marketing', 'Funnel de vente', 'Analytics'],
    ARRAY['Marketing Digital', 'Réseaux Sociaux'],
    95,
    true,
    4.8,
    27,
    'https://i.pravatar.cc/300?u=jean.kouassi',
    'approved'
  ),
  (
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Création de Contenu & Personal Branding',
    'Créatrice de contenu et stratège en personal branding. J''aide les entrepreneurs à construire une présence digitale authentique sur YouTube, TikTok et Instagram. Plus de 2M vues générées pour mes clients.',
    ARRAY['YouTube', 'TikTok', 'Instagram', 'Stratégie éditoriale', 'Script vidéo', 'Canva Pro'],
    ARRAY['Création de Contenu', 'Réseaux Sociaux'],
    85,
    true,
    4.7,
    19,
    'https://i.pravatar.cc/300?u=aminata.diallo',
    'approved'
  ),
  (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Développement Web & No-Code',
    'Développeur full-stack et expert No-Code basé à Montréal. Je construis des plateformes web performantes et des MVP en un temps record. Spécialisé Webflow, Bubble et Next.js.',
    ARRAY['Next.js', 'Supabase', 'Webflow', 'Bubble', 'React', 'Tailwind CSS'],
    ARRAY['Développement Web', 'No-Code / Low-Code'],
    130,
    false,
    4.9,
    41,
    'https://i.pravatar.cc/300?u=theo.bergeron',
    'approved'
  ),
  (
    'a1b2c3d4-0005-4000-8000-000000000005',
    'SEO & Analytics',
    'Experte SEO et data analyst. J''optimise la visibilité organique des sites web avec une approche data-driven. Ancienne consultante chez une agence digitale parisienne, maintenant freelance internationale.',
    ARRAY['SEO technique', 'Google Search Console', 'Google Analytics 4', 'Ahrefs', 'Semrush', 'Core Web Vitals'],
    ARRAY['SEO & Analytics', 'Marketing Digital'],
    110,
    true,
    4.6,
    22,
    'https://i.pravatar.cc/300?u=isabelle.chen',
    'approved'
  )
ON CONFLICT (id) DO UPDATE SET
  specialite   = EXCLUDED.specialite,
  bio          = EXCLUDED.bio,
  competences  = EXCLUDED.competences,
  categories   = EXCLUDED.categories,
  tarif_heure  = EXCLUDED.tarif_heure,
  disponible   = EXCLUDED.disponible,
  note_moyenne = EXCLUDED.note_moyenne,
  nb_avis      = EXCLUDED.nb_avis,
  photo_url    = EXCLUDED.photo_url,
  statut       = EXCLUDED.statut;

-- 5. Vérification finale
SELECT
  p.prenom, p.nom, e.specialite, e.tarif_heure,
  e.note_moyenne, e.nb_avis, e.statut, e.disponible
FROM experts e
JOIN profiles p ON p.id = e.id
WHERE e.statut = 'approved'
ORDER BY e.note_moyenne DESC;
