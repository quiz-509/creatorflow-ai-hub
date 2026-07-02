# CreatorFlow Market — Master Roadmap
> Document vivant. Mis à jour après chaque sprint. Source de vérité unique.
> Dernière mise à jour : 2026-07-02

---

## VISION PERMANENTE

CreatorFlow Market n'est pas une marketplace. Ce n'est pas une académie. Ce n'est pas un CRM.

**C'est une entreprise complète pilotée par l'IA.**

Les clients arrivent avec un besoin. Les agents IA exécutent 80-90% du travail. Les experts humains interviennent uniquement quand leur jugement est irremplaçable. Le CEO supervise, valide les décisions critiques et pilote l'ensemble depuis un cockpit unique.

Chaque ligne de code doit servir cette vision. Si une fonctionnalité ne rapproche pas le projet de cet état final, elle ne se construit pas.

---

## DIRECTIVE ARCHITECTURE AI WORKFORCE — RÈGLE PERMANENTE
> Ajoutée le 2026-07-01. Mise à jour le 2026-07-01. Ne jamais supprimer. S'applique à toutes les décisions techniques.

### La distinction fondamentale : AI Agent vs AI Employee

**Un AI Agent** accomplit une tâche unique : rédiger un email, répondre à un ticket, écrire un article.
C'est un outil. Ce n'est pas ce que nous construisons.

**Un AI Employee** est un membre permanent de l'entreprise.
C'est ce que nous construisons.

---

### Ce qu'est un AI Employee

Chaque AI Employee possède :

| Attribut | Description |
|----------|-------------|
| Fonction | Un rôle défini dans l'entreprise (Directeur Marketing, Head of Content, etc.) |
| Responsabilités permanentes | Des missions récurrentes, pas ponctuelles |
| Plusieurs compétences | Analyse, création, communication, suivi |
| Outils | Supabase, APIs, email, web search, fichiers |
| Mémoire | Historique des missions, décisions, contexte client |
| Objectifs | OKRs clairs, mesurables |
| KPIs | Métriques suivies dans le temps |
| Dossiers | Projets en cours, archivés, livrables |
| Clients | Relation continue, pas interaction unique |
| Collègues | Délègue à d'autres AI Employees, reçoit des handoffs |
| Autonomie temporelle | Travaille sur plusieurs jours, reprend une mission là où elle s'est arrêtée |

---

### Exemple — Le Marketing AI Employee

Il n'est PAS un agent qui écrit des emails.

Il EST le **Directeur Marketing de CreatorFlow**. Il peut :
- Analyser un marché et des concurrents
- Créer une stratégie de croissance
- Lancer et piloter une campagne
- Suivre les performances dans le temps
- Déléguer du contenu au Content Employee
- Déléguer de la prospection au Prospecting Employee
- Gérer un budget alloué
- Produire un rapport hebdomadaire au CEO
- Améliorer ses résultats en continu

Même logique pour : Content Employee, Prospecting Employee, Support Employee, CEO AI.

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

### 🔴 Bloquants critiques (sécurité — aucun lancement sans ça)
1. **RLS tables core** : `users`, `missions`, `crm_contacts`, `approvals` — données exposées sans ça
2. Remplacer email admin hardcodé par vérification rôle en base de données

### 🟠 Indispensables (AI Workforce opérationnel)
3. **Monitoring n8n** : alertes si workflow blog tombe
4. Content AI Employee (pour que Marketing Director puisse réellement déléguer)
5. Prospecting AI Employee

### 🟡 Importants (crédibilité produit)
6. Recruter 5 vrais experts (processus de vetting manuel)
7. Produire 1 cours complet Academy (formateur Rose — Marketing IA)
8. Migrer progression Academy localStorage → Supabase

---

## PRIORITÉS SPRINT 3 (Mois 2-3)

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

---

*Ce document est la propriété de CreatorFlow Market. Il doit être lu avant chaque session de développement.*
