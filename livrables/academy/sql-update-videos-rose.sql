-- ============================================================
-- MISE À JOUR DES VIDÉOS — Marketing IA avec Rose
-- Course ID : 0c9ca7a0-7006-437b-9c72-9f65df0a14f5
-- ============================================================
-- INSTRUCTIONS :
-- 1. Copie ce SQL dans l'éditeur Supabase (Table Editor > SQL Editor)
-- 2. Remplace chaque YOUTUBE_ID_X_X par l'ID de ta vidéo YouTube
--    Exemple : https://www.youtube.com/watch?v=dQw4w9WgXcQ → ID = dQw4w9WgXcQ
-- 3. Lance d'abord le STEP 1 pour voir les IDs actuels en base
-- 4. Lance ensuite les UPDATE un par un ou tous d'un coup
-- ============================================================

-- STEP 1 : Voir les leçons et leurs IDs actuels
SELECT id, title, ordre, content_url
FROM academy_lessons
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
ORDER BY ordre;

-- ============================================================
-- STEP 2 : Coller les URLs YouTube (format normal ou embed, les deux marchent)
-- ============================================================

-- MODULE 1 — STRATÉGIE ET POSITIONNEMENT

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_1_1'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Ce que l''IA change vraiment en marketing' OR titre = 'Ce que l''IA change vraiment en marketing');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_1_2'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Définir ton positionnement avec l''IA' OR titre = 'Définir ton positionnement avec l''IA');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_1_3'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Créer ton avatar client avec l''IA' OR titre = 'Créer ton avatar client avec l''IA');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_1_4'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Analyser ta concurrence avec l''IA' OR titre = 'Analyser ta concurrence avec l''IA');

-- MODULE 2 — MACHINE À CONTENU

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_2_1'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Le système de contenu IA (architecture)' OR titre = 'Le système de contenu IA (architecture)');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_2_2'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Générer 30 idées de contenu en 10 minutes' OR titre = 'Générer 30 idées de contenu en 10 minutes');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_2_3'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Écrire du contenu qui convertit' OR titre = 'Écrire du contenu qui convertit');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_2_4'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Créer des visuels professionnels sans designer' OR titre = 'Créer des visuels professionnels sans designer');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_2_5'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Recycler et maximiser chaque contenu' OR titre = 'Recycler et maximiser chaque contenu');

-- MODULE 3 — AUDIENCE ET RÉSEAUX SOCIAUX

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_3_1'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Choisir les bons réseaux selon ton business' OR titre = 'Choisir les bons réseaux selon ton business');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_3_2'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Optimiser ton profil pour convertir' OR titre = 'Optimiser ton profil pour convertir');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_3_3'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Créer un calendrier éditorial 90 jours avec l''IA' OR titre = 'Créer un calendrier éditorial 90 jours avec l''IA');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_3_4'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Croissance organique avec l''IA' OR titre = 'Croissance organique avec l''IA');

-- MODULE 4 — CONVERSION ET FUNNEL EMAIL

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_4_1'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Construire ta liste email avec un lead magnet IA' OR titre = 'Construire ta liste email avec un lead magnet IA');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_4_2'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Écrire une séquence email de bienvenue' OR titre = 'Écrire une séquence email de bienvenue');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_4_3'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Créer une landing page qui convertit' OR titre = 'Créer une landing page qui convertit');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_4_4'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Automatiser ton funnel complet' OR titre = 'Automatiser ton funnel complet');

-- MODULE 5 — PERFORMANCE ET CROISSANCE

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_5_1'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Les métriques qui comptent vraiment' OR titre = 'Les métriques qui comptent vraiment');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_5_2'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Créer son dashboard de performance IA' OR titre = 'Créer son dashboard de performance IA');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_5_3'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Analyser et optimiser avec l''IA' OR titre = 'Analyser et optimiser avec l''IA');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_5_4'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Construire ton roadmap de croissance 90 jours' OR titre = 'Construire ton roadmap de croissance 90 jours');

UPDATE academy_lessons
SET content_url = 'https://www.youtube.com/watch?v=YOUTUBE_ID_5_5'
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
  AND (title = 'Certification et prochaines étapes' OR titre = 'Certification et prochaines étapes');

-- VÉRIFICATION FINALE
SELECT id, title, ordre, content_url
FROM academy_lessons
WHERE course_id = '0c9ca7a0-7006-437b-9c72-9f65df0a14f5'
ORDER BY ordre;
