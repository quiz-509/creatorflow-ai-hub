# CreatorFlow Market — Master Roadmap
> Document vivant. Mis à jour après chaque sprint. Source de vérité unique.
> Dernière mise à jour : 2026-07-06
>
> **Constitution AI Workforce :** `livrables/AI_WORKFORCE_OS.md` — lire avant tout développement sur l'AI Workforce.
> **Contexte complet du projet :** `PROJECT_CONTEXT.md` — URLs, stack, APIs, règles permanentes, AI Workforce, roadmap.

## URLS OFFICIELLES (ne plus jamais demander)

| Environnement | URL |
|---------------|-----|
| Production | https://creatorflowmarket.com |
| Admin / CEO Cockpit | https://creatorflowmarket.com/admin |
| Employés IA | https://creatorflowmarket.com/employes |
| Supabase projet | https://cjtglfutckaogsmwhfsv.supabase.co |
| GitHub | https://github.com/quiz-509/creatorflow-ai-hub |

---

## RECADRAGE DÉFINITIF — VISION AI WORKFORCE (2026-07-06)
> Directive de Joacenel. Ne jamais supprimer. Remplace toute interprétation antérieure qui contredit ce qui suit.

### Ce qu'est un AI Employee — définition officielle et finale

Un AI Employee est un **véritable employé expert que CreatorFlow Market met à disposition de ses clients.**

Le client ne paye pas pour un texte. Il ne paye pas pour un rapport. Il **engage un employé IA** qui devient responsable de son projet.

Cet employé gère le projet de A à Z :
- Comprendre le besoin du client
- Planifier le travail de manière autonome
- Prendre des initiatives dans son domaine d'expertise
- Utiliser les outils disponibles
- Collaborer avec les autres AI Employees si le projet le nécessite
- Résoudre les problèmes rencontrés sans attendre qu'on lui dise quoi faire
- Livrer un résultat concret et mesurable
- Ne solliciter le CEO que pour les validations critiques

### Ce que le succès signifie

Le succès d'un AI Employee **ne se mesure pas à la qualité du texte qu'il produit.**

Il se mesure à sa **capacité à résoudre le problème du client de manière autonome, professionnelle et mesurable.**

### Règle de gel — aucun nouveau employé

**Aucun nouvel AI Employee ne sera développé tant que les 4 employés actuels ne se comportent pas comme de véritables professionnels capables de gérer des projets complexes de bout en bout.**

Les 4 employés actuels (Marketing Director, Content Employee, Prospecting Employee, Support Agent) doivent d'abord atteindre ce niveau avant toute expansion de l'équipe.

### Question de validation — version officielle finale

> « Est-ce que cette fonctionnalité rapproche réellement cet AI Employee du comportement d'un véritable employé humain expert qui prend en charge un projet client jusqu'à sa livraison ? »

**Si la réponse est NON — cette fonctionnalité ne fait pas partie de la vision. Ne pas construire.**

---

## STANDARDS PERMANENTS DE TOUT AI EMPLOYEE (2026-07-06)
> Ajoutés par Joacenel le 2026-07-06. S'appliquent aux 4 employés actuels et à tout futur employé. Ne jamais supprimer.

Ces 5 standards définissent ce que signifie être un vrai professionnel dans le contexte de CreatorFlow AI Workforce. Chaque AI Employee doit les satisfaire avant d'être considéré comme opérationnel au sens de la vision.

### Standard 1 — Responsabilité des résultats business

Un AI Employee ne livre pas des documents. Il est responsable des résultats.

- Il mesure l'impact réel de ses actions : CA généré, ROI, croissance d'audience, satisfaction client (NPS)
- Il produit un bilan de résultats, pas un bilan de livrables
- Si les résultats ne sont pas au rendez-vous à mi-parcours, il ajuste la stratégie sans attendre qu'on lui demande
- Il documente les résultats obtenus dans `agent_reports` avec les métriques avant/après
- Il est jugé sur ce que le client a obtenu, pas sur ce qu'il a produit

### Standard 2 — Gestion de portefeuille

Un AI Employee gère plusieurs clients simultanément, comme un professionnel sénior.

- Il maintient une vue de son portefeuille actif à tout moment (missions en cours, statuts, délais)
- Il ne mélange jamais les contextes clients entre eux
- Il alerte le CEO si sa capacité est saturée (seuil à définir par poste)
- Chaque matin dans son heartbeat, il passe en revue son portefeuille et priorise
- Il garde en mémoire l'historique de chaque client pour assurer la continuité entre les missions

### Standard 3 — Gestion des imprévus

Un AI Employee sait gérer les situations non planifiées jusqu'à leur résolution.

Protocoles obligatoires :

| Imprévu | Réponse attendue |
|---------|-----------------|
| Client insatisfait | Accusé de réception < 1h, analyse du problème, plan de correction proposé au client, escalade CEO si non résolu sous 24h |
| Changement de brief | Réévaluer l'impact sur le planning et le budget, notifier le client des conséquences, obtenir confirmation avant de continuer |
| Budget réduit | Proposer 3 alternatives hiérarchisées par impact/coût, laisser le client choisir, documenter la décision |
| Blocage technique | Tenter une solution alternative, escalader au CEO avec le problème ET une solution proposée |
| Délai impossible à tenir | Prévenir le client 48h avant le délai, proposer un nouveau délai réaliste avec justification |

Un AI Employee ne bloque jamais sur un imprévu sans communiquer. Le silence face à un problème est une faute professionnelle.

### Standard 4 — Moteur de priorisation

Un AI Employee sait décider quoi traiter en premier quand plusieurs missions sont actives.

Score de priorité = Urgence + Valeur client + Risque de dérapage

**Règles de priorisation :**
1. Mission en retard sur délai > toutes les autres
2. Client insatisfait > mission standard
3. Mission avec deadline < 48h > mission en cours sans deadline
4. Mission haute valeur (CA potentiel élevé) > mission basse valeur si délais équivalents
5. Mission bloquée (attente validation CEO) → mise en pause, passer à la suivante

La priorisation est recalculée à chaque heartbeat quotidien. Elle est documentée dans `agent_memory`.

### Standard 5 — Apprentissage dans le temps

Un AI Employee devient meilleur avec l'expérience. Il n'est pas statique.

- **Historique des missions** : chaque mission terminée est archivée avec ses résultats réels (succès, échecs, métriques)
- **Erreurs documentées** : quand un résultat n'est pas atteint, l'erreur est analysée et une correction est enregistrée pour éviter la répétition
- **Compétences évolutives** : ce qu'il a appris sur un type de client ou de secteur est mémorisé et réutilisé dans les missions similaires suivantes
- **Réputation interne** : un score de fiabilité construit sur la base des résultats réels (missions complétées dans les délais, satisfaction client, résultats business atteints)
- **Amélioration continue** : chaque mois, il produit un bilan de ses propres performances et propose une amélioration de ses processus au CEO

---

## DIRECTIVE PERMANENTE — VISION OFFICIELLE DE CREATORFLOW AI WORKFORCE
> Ajoutée le 2026-07-02. Ne jamais supprimer. Ne jamais remplacer. Référence absolue du projet.

### CreatorFlow AI Workforce N'EST PAS :
- un chatbot
- un assistant IA
- un générateur de texte
- un système qui répond uniquement aux prompts
- une collection d'agents qui exécutent une seule tâche

### CreatorFlow AI Workforce EST :

Une entreprise composée d'employés IA experts que CreatorFlow Market met à disposition de ses clients.

Chaque AI Employee occupe un poste permanent avec : une spécialité, des responsabilités permanentes, des objectifs, une mémoire, des outils, des KPIs, des procédures, une capacité à collaborer avec les autres employés IA.

**Lorsqu'un client achète un service, il ne reçoit pas un texte ou une réponse IA. Il engage un employé IA expert.**

Cet employé devient responsable du projet jusqu'à sa livraison. Il doit :
- comprendre le besoin du client
- planifier le travail
- utiliser les outils nécessaires
- collaborer avec d'autres AI Employees si le projet l'exige
- prendre des initiatives dans son domaine d'expertise
- résoudre les problèmes rencontrés
- produire un résultat concret
- demander uniquement les validations critiques au CEO
- livrer le projet terminé

**L'objectif d'un AI Employee n'est jamais de produire du texte. Son objectif est de résoudre le problème du client et de fournir un résultat professionnel.**

### Question de validation obligatoire avant chaque feature

> « Est-ce que cette fonctionnalité rapproche réellement cet AI Employee du comportement d'un véritable employé expert capable de prendre en charge un projet client de A à Z ? »

**Si la réponse est NON — ne pas construire.**

---

## VISION PERMANENTE

CreatorFlow Market n'est pas une marketplace. Ce n'est pas une académie. Ce n'est pas un CRM.

**C'est une entreprise complète pilotée par l'IA.**

Les clients arrivent avec un besoin. Les agents IA exécutent 80-90% du travail. Les experts humains interviennent uniquement quand leur jugement est irremplaçable. Le CEO supervise, valide les décisions critiques et pilote l'ensemble depuis un cockpit unique.

Chaque ligne de code doit servir cette vision. Si une fonctionnalité ne rapproche pas le projet de cet état final, elle ne se construit pas.

---

## DIRECTIVE ARCHITECTURE AI WORKFORCE — RÈGLE PERMANENTE
> Ajoutée le 2026-07-01. Mise à jour le 2026-07-02. Ne jamais supprimer. S'applique à toutes les décisions techniques.
> **Référence complète :** `livrables/AI_WORKFORCE_OS.md` — Constitution v1.0 rédigée le 2026-07-02. Ce document contient les règles détaillées, les templates, les migrations SQL et le guide d'implémentation complet. Ce qui suit est un résumé.

### La distinction fondamentale : AI Agent vs AI Employee

**Un AI Agent** accomplit une tâche unique : rédiger un email, répondre à un ticket, écrire un article.
C'est un outil. Ce n'est pas ce que nous construisons.

**Un AI Employee** est un membre permanent de l'entreprise.
Ce n'est pas un exécutant déclenché par une mission. C'est un poste occupé en permanence.

---

### PHILOSOPHIE FONDAMENTALE — L'employé permanent vs l'exécutant déclenché

> "Je ne construis pas des employés IA qui attendent une mission. Je construis des employés permanents qui occupent un poste dans l'entreprise."
> — Joacenel, 2026-07-02

**La différence est totale :**

| Exécutant déclenché ❌ | Employé permanent ✅ |
|----------------------|-------------------|
| Attend qu'on lui assigne une mission | Travaille en permanence, même sans mission client |
| Un appel HTTP → une réponse → fin | Heartbeat quotidien automatique via pg_cron |
| Mémoire éphémère d'une session | Mémoire structurée long terme entre les jours |
| Produit un document quand sollicité | Produit des rapports spontanément |
| Alertes CEO seulement sur demande | Alertes CEO dès qu'un seuil est franchi |
| Pas d'accès aux données réelles | Lit Stripe + Supabase + web chaque matin |
| Mission = unité de travail | Jour = unité de travail |
| Réactif | Proactif |

**Un AI Employee qui attend une mission avant de travailler n'est pas un employé. C'est un freelance.**

---

### Ce qu'est un AI Employee

Chaque AI Employee possède :

| Attribut | Description |
|----------|-------------|
| Poste permanent | Un rôle continu dans l'entreprise, pas ponctuel |
| Heartbeat quotidien | Se déclenche chaque matin automatiquement (pg_cron) |
| KPI monitoring | Surveille ses métriques en permanence, pas sur demande |
| Seuils d'alerte | Conditions qui déclenchent une action ou une escalade CEO automatiquement |
| Initiative autonome | Peut proposer une campagne, un rapport, une action sans qu'on lui demande |
| Mémoire long terme | Se souvient de ce qu'il a fait la semaine passée, le mois passé |
| Routines récurrentes | Tâches quotidiennes, hebdomadaires, mensuelles définies |
| Outils | Supabase, Stripe, web search, email, fichiers, APIs externes |
| Collègues | Délègue à d'autres AI Employees, reçoit des handoffs |
| Reporting spontané | Produit ses rapports sans attendre qu'on les lui demande |

---

### Journée type d'un AI Employee permanent

**Chaque matin (automatique) :**
- Consulte ses KPIs du jour
- Compare avec la veille et la semaine passée
- Détecte les anomalies et opportunités
- Génère un bilan matinal dans agent_reports
- Alerte le CEO si un seuil est franchi

**En continu :**
- Surveille les seuils configurés
- Détecte les opportunités (contenu viral, concurrent actif, segment sous-exploité)
- Prend des initiatives dans son périmètre sans demander permission
- Escalade au CEO uniquement les décisions hors périmètre

**Chaque semaine (automatique) :**
- Rapport de performance hebdomadaire au CEO
- Veille concurrentielle
- Proposition d'une initiative pour la semaine suivante

**Chaque mois (automatique) :**
- Audit complet de son domaine
- Révision des objectifs
- Budget consommé vs prévu
- Recommandations stratégiques pour le mois suivant

---

### Exemple — Le Marketing AI Employee

Il n'est PAS un agent qui attend une mission.

Il EST le **Directeur Marketing permanent de CreatorFlow**. Sans qu'on lui demande :
- Il consulte le MRR chaque matin et alerte si ça baisse
- Il surveille le funnel de conversion et identifie les fuites
- Il analyse les performances du blog et propose les sujets suivants
- Il fait une veille concurrentielle chaque vendredi
- Il produit un rapport hebdomadaire le lundi sans qu'on lui demande
- Il propose une campagne quand il détecte une opportunité
- Il délègue au Content Employee, au Prospecting Employee
- Il gère un budget marketing et rend des comptes dessus
- Quand un client arrive avec une mission, il prend le lead — mais ce n'est pas sa seule raison d'exister

Même logique pour : Content Employee, Prospecting Employee.

---

### Note — Support Agent (distinction importante)

Le Support qu'on a construit est un **AI Agent support client** pour les utilisateurs de la plateforme CreatorFlow Market. C'est un outil produit, pas un AI Employee de l'entreprise. Il ne fait pas partie de l'AI Workforce interne.

---

### Question de validation avant tout développement

> "Est-ce que je construis une **nouvelle fonction pour un employé** qui a une carrière dans cette entreprise, ou est-ce que je construis encore un **chatbot spécialisé** dans une seule tâche ?"

Si c'est un chatbot spécialisé → mauvaise direction, arrêter.
Si c'est une fonction d'un employé permanent → bonne direction, continuer.

---

### Architecture cible d'un AI Employee (standard technique)

```
AI Employee
├── identity/          → rôle, fonction, OKRs, KPIs
├── memory/            → agent_memory (conversations, décisions, contexte)
├── tools/             → liste des outils disponibles pour ce poste
├── missions/          → missions en cours, archivées (agent_missions)
├── reports/           → rapports produits (agent_reports)
├── colleagues/        → handoff vers d'autres employees
└── approval_queue/    → actions en attente de validation CEO
```

Chaque AI Employee :
1. Reçoit une mission avec contexte complet
2. Décompose en sous-tâches planifiées
3. Exécute sur plusieurs heures ou jours
4. Prend des décisions seul pour les actions standards
5. Escalade au CEO pour : budget > seuil défini, action irréversible, litige, décision stratégique
6. Reprend exactement où il s'est arrêté après une pause ou une validation
7. Rapporte les résultats dans agent_actions_log et agent_reports
8. Collabore avec les autres employees via handoffs structurés

---

### Note sur le Support AI Employee (produit)

Le chat support client est un composant produit légitime — il assiste les utilisateurs de la plateforme. Il est conservé. Il correspond à la définition d'un AI Employee (mémoire, outils, tickets, escalade) mais son rôle est orienté client externe, pas opérations internes.

La priorité absolue reste la construction de l'AI Workforce interne opérationnel.

---

## PIPELINE D'EXÉCUTION DES MISSIONS — MODÈLE OPÉRATIONNEL
> Ajouté le 2026-07-01. C'est le flux de travail standard de l'entreprise CreatorFlow.

```
Nouveau client
      ↓
CEO reçoit la mission
(analyse le besoin, définit les objectifs, alloue le budget)
      ↓
CEO décide : Qui doit travailler ?
      ↓
Marketing Director (lead de la mission client)
      ↓
Marketing Director délègue selon les besoins :
  ├── Prospecting Employee  → qualification, outreach, leads
  ├── Content Employee      → textes, articles, scripts
  └── Design Employee       → visuels, branding, assets
      ↓
Chaque employee exécute sa partie et rapporte au Marketing Director
      ↓
Marketing Director compile et prépare la stratégie complète
      ↓
CEO valide (ou demande des ajustements)
      ↓
Exécution (les employees passent à l'action)
      ↓
Suivi continu (KPIs, ajustements en temps réel)
      ↓
Rapport final au CEO
      ↓
Mission terminée — archivée dans l'historique client
```

### Règles du pipeline

1. **Le CEO ne travaille pas** — il décide, valide, reçoit les rapports. Il ne rédige pas, ne prospecte pas, ne crée pas de contenu.
2. **Le Marketing Director est le chef de projet** pour toutes les missions client. Il orchestre, il ne fait pas tout lui-même.
3. **Chaque délégation est une mission structurée** avec objectif, deadline, livrable attendu — pas un prompt vague.
4. **Chaque employee rapporte** au Marketing Director avec un statut clair : en cours, bloqué, terminé, en attente de validation.
5. **Le CEO valide uniquement** les décisions stratégiques, les dépenses au-delà du seuil, les actions irréversibles.
6. **Toute mission est tracée** dans agent_missions de l'entrée à la clôture.

---

## FRAMEWORK DE DÉCISION (appliqué à chaque feature)

Avant tout développement, répondre à :
1. Est-ce que ça rapproche CreatorFlow de l'entreprise IA autonome ?
2. Quel pilier est concerné ?
3. Indispensable / Important / Secondaire ?
4. Impact sur l'autonomie des agents IA ?
5. Impact sur le CEO (cockpit) ?
6. Impact sur le client ?
7. Impact sur les experts ?

---

## ÉTAT RÉEL DES PILIERS — 2026-06-30

### Pilier 1 — Marketplace
**Avancement : 35%**

| Composant | État | Notes |
|-----------|------|-------|
| Pages HTML (36 pages) | ✅ Existe | UI complète |
| Vrais experts | ❌ 0 | Fallback personas |
| Matching algorithm | ❌ | Tri par date seulement |
| Stripe Connect | ✅ | Commissions 15% auto — webhook secret à configurer |
| Dashboard revenus expert | ✅ | Onglet "Mes revenus" + table payouts |
| Escrow | ❌ | Absent |
| Reviews réels | ❌ | 0 avis |
| Dispute resolution | ❌ | Absent |

**Dépendances bloquantes :** Configurer webhook Stripe (signing secret). Vrais experts avant toute mission réelle.

---

### Pilier 2 — AI Workforce
**Avancement : 45%**

| Composant | État | Notes |
|-----------|------|-------|
| UI agents (4 agents) | ✅ | Shell visuel |
| Support AI Employee | ✅ | Edge Fn, mémoire, tool use, logs |
| Marketing Director AI Employee | ✅ | Boucle agentique 10 itérations, 6 outils, mémoire mission, délégation Content/Prospecting, rapports CEO |
| CEO Cockpit | ✅ | Inbox briefs, assignation missions, board employees, approbations, bouton Lancer |
| Content Employee | ❌ | Shell uniquement |
| Prospecting Employee | ❌ | Shell uniquement |
| Orchestration multi-agents | ⚠️ | Délégation Marketing → Content/Prospecting fonctionne, exécution réelle à compléter |
| Monitoring agents | ❌ | Absent |

**Réalité actuelle :** 2 AI Employees opérationnels (Support + Marketing Director). Le Marketing Director peut déléguer aux autres, mais Content/Prospecting doivent être implémentés.
**Chemin critique :** Content Employee → Prospecting Employee → boucle complète.

---

### Pilier 3 — Academy
**Avancement : 35%**

| Composant | État | Notes |
|-----------|------|-------|
| Structure pages | ✅ | 4 pages HTML |
| 5 formateurs IA | ✅ | Avatars + voix + vidéos intro |
| Stripe paiement | ✅ | Enrôlement fonctionnel |
| Contenu réel leçons | ❌ | 0 leçon réelle |
| Progression cloud | ❌ | localStorage uniquement |
| Certificats vérifiables | ❌ | jsPDF non signé |
| Lecteur HLS | ❌ | HTML5 basique |
| Quiz/évaluations | ❌ | Absent |

**Dépendance critique :** Produire le contenu avant de vendre.

---

### Pilier 4 — Blog
**Avancement : 65%**

| Composant | État | Notes |
|-----------|------|-------|
| Pipeline n8n → Claude | ✅ | Opérationnel |
| GitHub Actions schedule | ✅ | Lun/Mer/Ven 10h UTC |
| SSR Cloudflare Functions | ✅ | SEO opérationnel |
| Sitemap + RSS | ✅ | Dynamiques |
| Google Search Console | ✅ | Vérifié, 33 URLs |
| Solde Anthropic API | ⚠️ | Critique — vérifier |
| Qualité contenu | ⚠️ | Générique, à différencier |
| Images articles | ⚠️ | À améliorer |
| Maillage interne | ❌ | Absent |

**C'est le pilier le plus solide. Priorité : maintenir le solde Anthropic.**

---

### Pilier 5 — Ressources
**Avancement : 10%**

| Composant | État | Notes |
|-----------|------|-------|
| Page ressources | ❌ | Inexistante |
| Ebooks | ❌ | 0 |
| Templates | ❌ | 0 |
| Prompts | ❌ | 0 |
| Monétisation | ❌ | Non définie |

**Pilier le plus incomplet. Faible priorité pour l'instant.**

---

### Pilier 6 — Dashboard Client
**Avancement : 55%**

| Composant | État | Notes |
|-----------|------|-------|
| Vue missions | ✅ | Fonctionnel |
| Paiement Stripe | ✅ | Fonctionnel |
| Messagerie | ✅ | Realtime Supabase |
| Onboarding guidé | ✅ | Welcome checklist banner (3 étapes) |
| Empty states | ✅ | Banners client + expert, CTA missions expert |
| Notifications temps réel | ⚠️ | Page existe, fiabilité à tester |
| Mobile | ✅ | Hamburger menu |

---

### Pilier 7 — Dashboard CEO (Admin)
**Avancement : 60%**

| Composant | État | Notes |
|-----------|------|-------|
| Stats cards | ✅ | Count basique |
| Approbation experts | ✅ | Fonctionnel |
| CRM onglet | ✅ | Basique |
| Gestion missions | ✅ | Liste + actions |
| Analytics CEO | ✅ | MRR, revenus 6 mois, users 6 mois, funnel missions |
| CEO Cockpit AI | ✅ | Inbox briefs, assignation, board employees, approbations, bouton Lancer Mission |
| Auth sécurisée | ❌ | Email hardcodé — CRITIQUE |
| Monitoring agents IA | ❌ | Absent |
| Logs d'actions | ⚠️ | agent_actions_log existe, viewer absent |
| Vue financière Stripe | ❌ | Absent |

---

### Pilier 8 — CRM
**Avancement : 20%**

| Composant | État | Notes |
|-----------|------|-------|
| Table crm_contacts | ✅ | Existe |
| Status workflow | ✅ | new → contacted |
| Pipeline visuel | ❌ | Absent |
| Email sequences | ❌ | Absent |
| Lead scoring | ❌ | Absent |
| Reporting | ❌ | Absent |

**C'est une liste de contacts, pas un CRM.**

---

### Pilier 9 — Automatisation
**Avancement : 35%**

| Composant | État | Notes |
|-----------|------|-------|
| n8n blog pipeline | ✅ | 1 workflow opérationnel |
| Emails transactionnels | ✅ | 4 templates Resend |
| Sitemap/RSS auto | ✅ | Cloudflare Functions |
| Onboarding auto | ❌ | Manuel |
| Matching auto | ❌ | Inexistant |
| Relances clients | ❌ | Inexistant |
| Monitoring workflows | ❌ | Inexistant |

---

### Pilier 10 — Sécurité
**Avancement : 28%**

| Vulnérabilité | Sévérité | État |
|--------------|---------|------|
| Email admin hardcodé HTML | 🔴 CRITIQUE | Non corrigé |
| RLS absent tables core | 🔴 CRITIQUE | Non corrigé — PROCHAINE PRIORITÉ |
| CSP unsafe-eval | 🟠 ÉLEVÉ | Non corrigé |
| Clés API env.local | 🟠 ÉLEVÉ | À surveiller |
| Stripe webhook secret | 🟠 ÉLEVÉ | À configurer manuellement (Stripe Dashboard) |
| Headers Cloudflare | ✅ | Configurés |
| RLS blog tables | ✅ | Actif |
| RLS expert_payouts | ✅ | Actif (migration 2026-07-02) |

**Aucun lancement commercial possible sans corriger les 2 critiques.**

---

### Pilier 11 — Analytics
**Avancement : 40%**

| Composant | État |
|-----------|------|
| Google Analytics | ❌ |
| Stripe dashboard | ✅ (externe) |
| MRR (mois en cours vs précédent) | ✅ | Onglet Analytics CEO |
| Revenus 6 mois (graphe bar) | ✅ | Chart.js |
| Croissance users 6 mois (graphe line) | ✅ | Chart.js |
| Funnel brief → mission | ✅ | Horizontal bars |
| Churn / LTV | ❌ |
| Agent performance | ❌ |

---

## DETTE TECHNIQUE

| Problème | Impact | Effort |
|---------|--------|--------|
| Inline JSX massif (2000+ lignes/fichier) | Maintenabilité catastrophique | Élevé |
| Zéro test | Chaque déploiement est un risque | Élevé |
| React via CDN | Performance, pas de tree-shaking | Moyen |
| CSS dupliqué entre pages | Incohérence, maintenance lourde | Moyen |
| Supabase URL hardcodée partout | Fragilité au changement | Faible |
| n8n sans monitoring | Workflow tombé = invisible | Faible |

---

## ÉTAT RÉALISÉ — Sprint 1 & 2 (2026-06-30 → 2026-07-02)

### ✅ Complété
- RLS 25 tables (partiel) + email admin sécurisé → check DB
- Welcome banners client + expert, CTA missions expert
- Analytics CEO (MRR, revenus 6 mois, users 6 mois, funnel)
- Support AI Employee (Edge Fn, mémoire, tool use, logs)
- CEO Cockpit (inbox, assignation, board, approbations, bouton Lancer)
- **Stripe Connect** : commissions 15% auto, expert_payouts table, dashboard revenus expert
- **Marketing Director AI Employee** : boucle agentique 10 itérations, 6 outils, mémoire, délégation, rapports

### ⚠️ Action manuelle requise (toi)
- Stripe Dashboard → configurer webhook → copier `STRIPE_WEBHOOK_SECRET` dans Supabase Secrets
- Tester le Marketing Director : créer un brief → assigner à Marketing → cliquer "▶ Lancer"

---

## PRIORITÉS IMMÉDIATES (Sprint 3 — maintenant)

### 🔴 Bloquant absolu (infrastructure AI Workforce OS)
Avant tout nouveau AI Employee, appliquer la migration suivante dans le SQL Editor Supabase :
`livrables/AI_WORKFORCE_OS.md` — Section 16 (migrations Priorité 1 : `company_memory`, `agent_heartbeats`, `employee_handoffs`)

Cette migration est le fondement de tout. Sans elle, aucun employé permanent ne peut fonctionner.

### 🔴 Sécurité (aucun lancement commercial sans ça)
- Remplacer email admin hardcodé par vérification rôle en base de données (`is_admin` dans `profiles`)
- RLS validé sur toutes les tables — déjà fait le 2026-07-02

### 🟠 Phase A — AI Workforce OS (infrastructure de base)
1. Appliquer migration OS (Section 16 de la Constitution)
2. Ajouter outils heartbeat dans `ai-orchestrator` : `read_company_memory`, `update_company_memory`, `log_heartbeat`
3. Valider avec Marketing Director : 1 heartbeat manuel réussi

### 🟠 Phase B — Marketing Director permanent
4. Créer `marketing-heartbeat` Edge Function (KPIs Stripe + Supabase, alertes, rapport matinal)
5. pg_cron quotidien + hebdomadaire pour Marketing Director
6. Initialiser `company_memory` avec baseline KPIs et OKRs Marketing

### 🟠 Phase C — Content Employee permanent
7. Construire Content Employee avec heartbeat, gestion handoffs, monitoring articles
8. Tester délégation Marketing → Content via `employee_handoffs`

### 🟠 Phase D — Prospecting Employee permanent
9. Construire Prospecting Employee avec heartbeat, monitoring CRM, gestion handoffs

### 🟡 Importants (crédibilité produit)
10. Recruter 5 vrais experts (processus de vetting manuel)
11. Produire 1 cours complet Academy (formateur Rose — Marketing IA)
12. Migrer progression Academy localStorage → Supabase

---

## PRIORITÉS SPRINT 4 (Mois 2-3)

- Algorithme de matching (filtrage intelligent expert-client)
- CRM avec pipeline visuel (kanban statuts)
- Relances email automatiques (clients inactifs, experts sans mission)
- Migration hors CDN React (Vite + build process)
- Bêta privée : 10 clients + 5 experts réels

---

## RISQUES MAJEURS

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|-----------|
| RGPD — données exposées sans RLS | Élevée | Catastrophique | Sprint 1 — urgent |
| Anthropic balance vide | Élevée | Fort (blog mort) | Recharger immédiatement |
| Promesse agents IA non tenue | Élevée | Réputation | 1 vrai agent avant marketing |
| Dette technique bloque la croissance | Certaine à 6 mois | Fort | Migration progressive Vite |
| 0 expert réel = 0 mission possible | Certaine | Fatal | Recrutement manuel prioritaire |
| Concurrent bien financé | Moyen | Fort | Exécution rapide + niche FR |

---

## NOTE GLOBALE ACTUELLE

| Dimension | Note |
|-----------|------|
| Vision | 9/10 |
| Exécution technique | 4/10 |
| Sécurité | 3/10 |
| Valeur produit réelle | 3/10 |
| Blog (seul pilier mature) | 7/10 |
| **Global** | **38/100** |

---

## HISTORIQUE DES SPRINTS

| Date | Sprint | Changements |
|------|--------|------------|
| 2026-06-30 | Audit initial | Création du Master Roadmap |
| 2026-06-30 | Sprint 1 — Sécurité | RLS 25 tables core, email admin retiré du HTML → check DB |
| 2026-07-01 | Sprint 1 — UX | Welcome banners client + expert, CTA missions expert |
| 2026-07-01 | Sprint 2 — Analytics | Onglet Analytics CEO : MRR, revenus 6 mois, users 6 mois, funnel missions |
| 2026-07-01 | Sprint 2 — AI Workforce | Support AI Employee (Edge Fn + mémoire + outils + logs) |
| 2026-07-01 | Sprint 2 — CEO Cockpit | Inbox briefs, assignation missions, board employees, approbations |
| 2026-07-02 | Sprint 1 — Marketplace | Stripe Connect : commissions 15% auto, stripe-connect-onboarding, stripe-webhook, expert_payouts, dashboard revenus expert |
| 2026-07-02 | Vision AI Workforce | Marketing Director AI Employee : boucle agentique 10 itérations, 6 outils, mémoire mission, délégation Content/Prospecting, rapports CEO, bouton Lancer dans Cockpit |
| 2026-07-02 | AI Workforce OS | Constitution v1.0 rédigée — 18 sections, 16 règles, 3 tables à créer, guide d'implémentation complet, taxonomie officielle. Fichier : `livrables/AI_WORKFORCE_OS.md` |
| 2026-07-06 | AI Workforce Phase D | 4 employés IA déployés : Marketing Director + Content Employee + Prospecting Employee + Support Agent. Heartbeats pg_cron actifs. Emails confirmés end-to-end. |
| 2026-07-06 | Recadrage vision | Directive définitive Joacenel : AI Employee = employé expert client de A à Z. Succès = résoudre le problème client, pas produire du texte. Gel des nouveaux employés jusqu'à maturité des 4 actuels. |
| 2026-07-06 | Standards AI Employee | 5 standards permanents ajoutés : résultats business, gestion de portefeuille, gestion des imprévus, moteur de priorisation, apprentissage dans le temps. S'appliquent aux 4 employés actuels et tout futur employé. |

---

*Ce document est la propriété de CreatorFlow Market. Il doit être lu avant chaque session de développement.*
