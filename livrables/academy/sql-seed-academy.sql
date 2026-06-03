-- ============================================================
-- SEED ACADEMY — Phelix, Rémy, Jay, Louvie
-- À exécuter dans : Supabase > SQL Editor
-- Idempotent : ON CONFLICT DO NOTHING, sûr à relancer
-- ============================================================
-- IDs utilisés :
--   Phelix  course  : 10000000-0000-0000-0000-000000000000
--   Rémy    course  : 20000000-0000-0000-0000-000000000000
--   Jay     course  : 30000000-0000-0000-0000-000000000000
--   Louvie  course  : 40000000-0000-0000-0000-000000000000
--   Modules : {c#}{m#}000000-0000-0000-0000-000000000000
--   Leçons  : {c#}{m#}{l#}00000-0000-0000-0000-000000000000
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. PHELIX — Agents IA Autonomes
-- ════════════════════════════════════════════════════════════

INSERT INTO academy_courses (id, slug, title, subtitle, instructor, level, duration_minutes, total_lessons, prix, is_published, created_at)
VALUES (
  '10000000-0000-0000-0000-000000000000',
  'agents-ia-avec-phelix',
  'Agents IA Autonomes avec Phelix',
  'Construis des agents IA qui travaillent pour toi 24h/24. De zéro à ton premier agent en production, sans écrire une seule ligne de code.',
  'Phelix', 'Intermédiaire', 480, 22, 147, true, NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO academy_modules (id, course_id, title) VALUES
  ('11000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Fondamentaux des Agents IA'),
  ('12000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Construire son Premier Agent'),
  ('13000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Mémoire et Contexte'),
  ('14000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Agents Multi-tâches et Workflows'),
  ('15000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000', 'Déploiement et Production')
ON CONFLICT (id) DO NOTHING;

-- Module 1
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('10000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000000', 'Qu''est-ce qu''un agent IA ?', 1),
  ('10000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000000', 'Agent vs chatbot vs automatisation'),
  ('10000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000000', 'L''écosystème des frameworks agents', 3),
  ('10000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000000', 'Choisir son stack selon le projet'),
  ('10000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000000', 'Tour d''horizon des outils (n8n, Make, LangChain)', 5);

-- Module 2
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('10000000-0000-0000-0000-000000000000', '12000000-0000-0000-0000-000000000000', 'Architecture d''un agent (mémoire, outils, instructions)', 1),
  ('10000000-0000-0000-0000-000000000000', '12000000-0000-0000-0000-000000000000', 'Ton premier agent avec n8n'),
  ('10000000-0000-0000-0000-000000000000', '12000000-0000-0000-0000-000000000000', 'Ajouter des outils : recherche web, fichiers, calcul'),
  ('10000000-0000-0000-0000-000000000000', '12000000-0000-0000-0000-000000000000', 'Tester et déboguer un agent'),
  ('10000000-0000-0000-0000-000000000000', '12000000-0000-0000-0000-000000000000', 'Gérer les erreurs et les limites de l''agent', 5);

-- Module 3
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('10000000-0000-0000-0000-000000000000', '13000000-0000-0000-0000-000000000000', 'Mémoire court terme vs long terme'),
  ('10000000-0000-0000-0000-000000000000', '13000000-0000-0000-0000-000000000000', 'Bases vectorielles pour agents (Pinecone, Supabase)'),
  ('10000000-0000-0000-0000-000000000000', '13000000-0000-0000-0000-000000000000', 'RAG : retrieval augmented generation pratique'),
  ('10000000-0000-0000-0000-000000000000', '13000000-0000-0000-0000-000000000000', 'Optimiser la fenêtre de contexte');

-- Module 4
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('10000000-0000-0000-0000-000000000000', '14000000-0000-0000-0000-000000000000', 'Orchestrer plusieurs agents'),
  ('10000000-0000-0000-0000-000000000000', '14000000-0000-0000-0000-000000000000', 'Délégation et sous-agents'),
  ('10000000-0000-0000-0000-000000000000', '14000000-0000-0000-0000-000000000000', 'Agents avec accès email et agenda'),
  ('10000000-0000-0000-0000-000000000000', '14000000-0000-0000-0000-000000000000', 'Automatiser des flux de travail complexes');

-- Module 5
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('10000000-0000-0000-0000-000000000000', '15000000-0000-0000-0000-000000000000', 'Héberger son agent (Railway, Render)'),
  ('10000000-0000-0000-0000-000000000000', '15000000-0000-0000-0000-000000000000', 'Monitoring et alertes'),
  ('10000000-0000-0000-0000-000000000000', '15000000-0000-0000-0000-000000000000', 'Sécurité et limites d''accès', 3),
  ('10000000-0000-0000-0000-000000000000', '15000000-0000-0000-0000-000000000000', 'Créer une interface pour tes clients');


-- ════════════════════════════════════════════════════════════
-- 2. RÉMY — Automatisation IA
-- ════════════════════════════════════════════════════════════

INSERT INTO academy_courses (id, slug, title, subtitle, instructor, level, duration_minutes, total_lessons, prix, is_published, created_at)
VALUES (
  '20000000-0000-0000-0000-000000000000',
  'automatisation-ia-avec-remy',
  'Automatisation IA avec Rémy',
  'Construis des systèmes qui tournent 24h/24 sans ton intervention. Make, n8n et IA combinés pour automatiser chaque partie de ton business.',
  'Rémy', 'Débutant', 420, 22, 127, true, NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO academy_modules (id, course_id, title) VALUES
  ('21000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'Introduction à l''Automatisation IA'),
  ('22000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'Make (Integromat) Maîtrisé'),
  ('23000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'n8n — Automatisation Open Source'),
  ('24000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'IA dans les Workflows'),
  ('25000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', 'Systèmes Complets')
ON CONFLICT (id) DO NOTHING;

-- Module 1
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('20000000-0000-0000-0000-000000000000', '21000000-0000-0000-0000-000000000000', 'Pourquoi automatiser avec l''IA en 2025', 1),
  ('20000000-0000-0000-0000-000000000000', '21000000-0000-0000-0000-000000000000', 'Les outils essentiels : Make, n8n, Zapier'),
  ('20000000-0000-0000-0000-000000000000', '21000000-0000-0000-0000-000000000000', 'Ton premier workflow en 15 minutes'),
  ('20000000-0000-0000-0000-000000000000', '21000000-0000-0000-0000-000000000000', 'Connecter ses apps préférées'),
  ('20000000-0000-0000-0000-000000000000', '21000000-0000-0000-0000-000000000000', 'Cartographier les tâches automatisables de ton business');

-- Module 2
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('20000000-0000-0000-0000-000000000000', '22000000-0000-0000-0000-000000000000', 'Interface Make de A à Z'),
  ('20000000-0000-0000-0000-000000000000', '22000000-0000-0000-0000-000000000000', 'Triggers, actions, filtres et routeurs'),
  ('20000000-0000-0000-0000-000000000000', '22000000-0000-0000-0000-000000000000', 'Gestion des erreurs et webhooks'),
  ('20000000-0000-0000-0000-000000000000', '22000000-0000-0000-0000-000000000000', 'Templates Make pour créateurs'),
  ('20000000-0000-0000-0000-000000000000', '22000000-0000-0000-0000-000000000000', 'Projets pratiques avec Make');

-- Module 3
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('20000000-0000-0000-0000-000000000000', '23000000-0000-0000-0000-000000000000', 'Installer et configurer n8n'),
  ('20000000-0000-0000-0000-000000000000', '23000000-0000-0000-0000-000000000000', 'Workflows avancés avec code JavaScript'),
  ('20000000-0000-0000-0000-000000000000', '23000000-0000-0000-0000-000000000000', 'Intégrer une IA dans tes workflows n8n'),
  ('20000000-0000-0000-0000-000000000000', '23000000-0000-0000-0000-000000000000', 'n8n en production (auto-hébergé)');

-- Module 4
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('20000000-0000-0000-0000-000000000000', '24000000-0000-0000-0000-000000000000', 'Appeler GPT-4 via API dans Make et n8n'),
  ('20000000-0000-0000-0000-000000000000', '24000000-0000-0000-0000-000000000000', 'Analyse de sentiment et extraction de données'),
  ('20000000-0000-0000-0000-000000000000', '24000000-0000-0000-0000-000000000000', 'Génération de contenu automatique'),
  ('20000000-0000-0000-0000-000000000000', '24000000-0000-0000-0000-000000000000', 'Traitement automatisé de documents et PDFs');

-- Module 5
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('20000000-0000-0000-0000-000000000000', '25000000-0000-0000-0000-000000000000', 'Système de gestion client automatisé'),
  ('20000000-0000-0000-0000-000000000000', '25000000-0000-0000-0000-000000000000', 'Pipeline de contenu automatique'),
  ('20000000-0000-0000-0000-000000000000', '25000000-0000-0000-0000-000000000000', 'Tableau de bord IA pour ton business'),
  ('20000000-0000-0000-0000-000000000000', '25000000-0000-0000-0000-000000000000', 'Maintenance et monitoring de tes systèmes');


-- ════════════════════════════════════════════════════════════
-- 3. JAY — Développement IA
-- ════════════════════════════════════════════════════════════

INSERT INTO academy_courses (id, slug, title, subtitle, instructor, level, duration_minutes, total_lessons, prix, is_published, created_at)
VALUES (
  '30000000-0000-0000-0000-000000000000',
  'developpement-ia-avec-jay',
  'Développement IA avec Jay',
  'Crée des outils et applications IA en quelques heures. API OpenAI, LangChain, RAG et déploiement : le cursus complet du développeur IA.',
  'Jay', 'Avancé', 600, 22, 197, true, NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO academy_modules (id, course_id, title) VALUES
  ('31000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000000', 'Fondamentaux LLM pour Développeurs'),
  ('32000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000000', 'LangChain et LlamaIndex'),
  ('33000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000000', 'RAG et Bases Vectorielles'),
  ('34000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000000', 'Construire des Produits IA'),
  ('35000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000000', 'Fine-tuning et IA Avancée')
ON CONFLICT (id) DO NOTHING;

-- Module 1
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('30000000-0000-0000-0000-000000000000', '31000000-0000-0000-0000-000000000000', 'Architecture des LLMs (transformers, tokens)'),
  ('30000000-0000-0000-0000-000000000000', '31000000-0000-0000-0000-000000000000', 'API OpenAI et Anthropic — tour complet'),
  ('30000000-0000-0000-0000-000000000000', '31000000-0000-0000-0000-000000000000', 'Gestion des tokens, coûts et limites'),
  ('30000000-0000-0000-0000-000000000000', '31000000-0000-0000-0000-000000000000', 'Prompt engineering pour développeurs'),
  ('30000000-0000-0000-0000-000000000000', '31000000-0000-0000-0000-000000000000', 'Structured outputs et function calling');

-- Module 2
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('30000000-0000-0000-0000-000000000000', '32000000-0000-0000-0000-000000000000', 'Introduction à LangChain'),
  ('30000000-0000-0000-0000-000000000000', '32000000-0000-0000-0000-000000000000', 'Chaînes, mémoire et agents LangChain'),
  ('30000000-0000-0000-0000-000000000000', '32000000-0000-0000-0000-000000000000', 'LlamaIndex pour la recherche documentaire'),
  ('30000000-0000-0000-0000-000000000000', '32000000-0000-0000-0000-000000000000', 'Combiner LangChain et LlamaIndex'),
  ('30000000-0000-0000-0000-000000000000', '32000000-0000-0000-0000-000000000000', 'Outils et plugins custom');

-- Module 3
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('30000000-0000-0000-0000-000000000000', '33000000-0000-0000-0000-000000000000', 'Embeddings : transformer le texte en vecteurs'),
  ('30000000-0000-0000-0000-000000000000', '33000000-0000-0000-0000-000000000000', 'Choisir sa base vectorielle (Pinecone, Chroma, Weaviate)'),
  ('30000000-0000-0000-0000-000000000000', '33000000-0000-0000-0000-000000000000', 'Pipeline RAG complet de A à Z'),
  ('30000000-0000-0000-0000-000000000000', '33000000-0000-0000-0000-000000000000', 'Optimisation et reranking');

-- Module 4
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('30000000-0000-0000-0000-000000000000', '34000000-0000-0000-0000-000000000000', 'Interface chat avec React'),
  ('30000000-0000-0000-0000-000000000000', '34000000-0000-0000-0000-000000000000', 'API backend IA avec FastAPI'),
  ('30000000-0000-0000-0000-000000000000', '34000000-0000-0000-0000-000000000000', 'Authentification et gestion des utilisateurs'),
  ('30000000-0000-0000-0000-000000000000', '34000000-0000-0000-0000-000000000000', 'Déploiement sur Railway et Render');

-- Module 5
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('30000000-0000-0000-0000-000000000000', '35000000-0000-0000-0000-000000000000', 'Quand et pourquoi fine-tuner ?'),
  ('30000000-0000-0000-0000-000000000000', '35000000-0000-0000-0000-000000000000', 'Fine-tuning GPT-3.5 Turbo — pratique'),
  ('30000000-0000-0000-0000-000000000000', '35000000-0000-0000-0000-000000000000', 'Évaluation et métriques de performance'),
  ('30000000-0000-0000-0000-000000000000', '35000000-0000-0000-0000-000000000000', 'Monétiser son application IA');


-- ════════════════════════════════════════════════════════════
-- 4. LOUVIE — Business & Prompts
-- ════════════════════════════════════════════════════════════

INSERT INTO academy_courses (id, slug, title, subtitle, instructor, level, duration_minutes, total_lessons, prix, is_published, created_at)
VALUES (
  '40000000-0000-0000-0000-000000000000',
  'business-prompts-avec-louvie',
  'Business & Prompts avec Louvie',
  'Maîtrise les LLMs pour transformer chaque aspect de ton business. De la rédaction à la stratégie, l''IA comme co-pilote de ta croissance.',
  'Louvie', 'Débutant', 360, 22, 97, true, NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO academy_modules (id, course_id, title) VALUES
  ('41000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000000', 'Maîtriser le Prompt Engineering'),
  ('42000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000000', 'ChatGPT et Claude pour le Business'),
  ('43000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000000', 'Stratégie de Contenu IA'),
  ('44000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000000', 'Automatiser son Business'),
  ('45000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000000', 'Monétiser ses Compétences IA')
ON CONFLICT (id) DO NOTHING;

-- Module 1
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('40000000-0000-0000-0000-000000000000', '41000000-0000-0000-0000-000000000000', 'Anatomie d''un bon prompt', 1),
  ('40000000-0000-0000-0000-000000000000', '41000000-0000-0000-0000-000000000000', 'Les 6 principes fondamentaux du prompting'),
  ('40000000-0000-0000-0000-000000000000', '41000000-0000-0000-0000-000000000000', 'Chain-of-thought et few-shot prompting'),
  ('40000000-0000-0000-0000-000000000000', '41000000-0000-0000-0000-000000000000', 'Construire ta bibliothèque de prompts'),
  ('40000000-0000-0000-0000-000000000000', '41000000-0000-0000-0000-000000000000', 'Prompts systèmes et personnalisation avancée');

-- Module 2
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('40000000-0000-0000-0000-000000000000', '42000000-0000-0000-0000-000000000000', 'Configurer GPT et Claude pour ton business'),
  ('40000000-0000-0000-0000-000000000000', '42000000-0000-0000-0000-000000000000', 'Rédaction : emails, articles, scripts'),
  ('40000000-0000-0000-0000-000000000000', '42000000-0000-0000-0000-000000000000', 'Analyse et résumé de documents'),
  ('40000000-0000-0000-0000-000000000000', '42000000-0000-0000-0000-000000000000', 'Créer des Custom GPTs personnalisés'),
  ('40000000-0000-0000-0000-000000000000', '42000000-0000-0000-0000-000000000000', 'Projets de la semaine : 5 cas business concrets');

-- Module 3
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('40000000-0000-0000-0000-000000000000', '43000000-0000-0000-0000-000000000000', 'Calendrier éditorial 90 jours avec l''IA', 1),
  ('40000000-0000-0000-0000-000000000000', '43000000-0000-0000-0000-000000000000', 'Adapter le ton selon chaque plateforme'),
  ('40000000-0000-0000-0000-000000000000', '43000000-0000-0000-0000-000000000000', 'SEO et optimisation de contenu IA'),
  ('40000000-0000-0000-0000-000000000000', '43000000-0000-0000-0000-000000000000', 'Recycler et démultiplier chaque contenu');

-- Module 4
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('40000000-0000-0000-0000-000000000000', '44000000-0000-0000-0000-000000000000', 'Identifier les tâches automatisables'),
  ('40000000-0000-0000-0000-000000000000', '44000000-0000-0000-0000-000000000000', 'Service client avec IA'),
  ('40000000-0000-0000-0000-000000000000', '44000000-0000-0000-0000-000000000000', 'Reporting et analytics IA'),
  ('40000000-0000-0000-0000-000000000000', '44000000-0000-0000-0000-000000000000', 'Système d''onboarding automatisé', 4);

-- Module 5
INSERT INTO academy_lessons (course_id, module_id, title, order_num) VALUES
  ('40000000-0000-0000-0000-000000000000', '45000000-0000-0000-0000-000000000000', 'Positionner ton offre autour de l''IA', 1),
  ('40000000-0000-0000-0000-000000000000', '45000000-0000-0000-0000-000000000000', 'Tarification et vente de services IA'),
  ('40000000-0000-0000-0000-000000000000', '45000000-0000-0000-0000-000000000000', 'Créer et vendre ses prompts'),
  ('40000000-0000-0000-0000-000000000000', '45000000-0000-0000-0000-000000000000', 'Construire un business autour de l''IA', 4);


-- ============================================================
-- VÉRIFICATION FINALE
-- ============================================================
SELECT c.title, c.instructor, c.prix, c.level,
       COUNT(DISTINCT m.id) AS modules,
       COUNT(DISTINCT l.id) AS lessons
FROM academy_courses c
LEFT JOIN academy_modules m ON m.course_id = c.id
LEFT JOIN academy_lessons l ON l.course_id = c.id
WHERE c.id IN (
  '10000000-0000-0000-0000-000000000000',
  '20000000-0000-0000-0000-000000000000',
  '30000000-0000-0000-0000-000000000000',
  '40000000-0000-0000-0000-000000000000'
)
GROUP BY c.id, c.title, c.instructor, c.prix, c.level
ORDER BY c.instructor;
