# CreatorFlow AI Workforce OS
## Constitution de l'AI Workforce — v1.0
> Rédigé le 2026-07-02. Document permanent. Ne jamais supprimer.
> Cette Constitution s'applique à chaque AI Employee, chaque nouvelle feature, chaque décision architecturale concernant l'AI Workforce.

---

## PRÉAMBULE

CreatorFlow Market n'est pas une plateforme qui propose des chatbots.
C'est une entreprise dirigée par un CEO humain, assistée par une équipe d'employés IA permanents.

Ces employés occupent des postes réels dans l'entreprise. Ils travaillent chaque jour, même sans mission client. Ils surveillent leurs KPIs, produisent des rapports, proposent des initiatives et exécutent 80 à 90% du travail opérationnel.

**Le CEO dirige. Il ne travaille pas.**

Ce document est la loi fondamentale de cette organisation. Tout développement futur concernant l'AI Workforce doit s'y conformer. Toute décision technique qui contredit cette Constitution est incorrecte par définition.

---

## SECTION 1 — TAXONOMIE OFFICIELLE

### 1.1 Ce qu'est un AI Employee

Un AI Employee est un poste permanent au sein de CreatorFlow Market. Il :

- Existe indépendamment des missions clients
- Travaille chaque jour via un heartbeat automatique (pg_cron)
- Surveille ses KPIs sans qu'on lui demande
- Produit des rapports spontanément
- Prend des initiatives dans son périmètre
- A une mémoire qui persiste entre les jours, semaines, mois
- Reçoit des missions clients comme une partie de son travail, pas comme sa seule raison d'exister
- Collabore avec les autres employés via des handoffs structurés
- Rend des comptes au CEO via des rapports hebdomadaires automatiques

### 1.2 Ce qu'est un AI Agent (outil)

Un AI Agent exécute une tâche unique déclenchée par un humain ou un autre système. Il n'existe pas entre deux appels. Il n'a pas de poste. C'est un outil, pas un employé.

**Exemple dans cette codebase :** la fonction `ai-orchestrator` telle qu'elle existe aujourd'hui. Elle est excellente comme moteur d'exécution — elle devient un AI Employee quand on la combine avec un heartbeat, une mémoire d'entreprise et des routines autonomes.

### 1.3 Ce qu'est un outil produit (hors AI Workforce)

Le Support Agent (chat client sur la plateforme) est un composant produit orienté utilisateur externe. Ce n'est pas un AI Employee. Il n'est pas soumis à cette Constitution. Il reste maintenu séparément.

### 1.4 Tableau de classification

| Type | Exemple | Heartbeat | Mémoire | Initiative | Poste permanent |
|------|---------|-----------|---------|-----------|----------------|
| AI Employee | Marketing Director | Oui | Entreprise + Client | Oui | Oui |
| AI Agent | ai-orchestrator seul | Non | Session ou Client | Non | Non |
| Outil produit | Support chat | Non | Session | Non | Non |
| Monitor | blog-monitor | Oui | Non | Alerte seule | Non |

---

## SECTION 2 — REGISTRE OFFICIEL DES EMPLOYÉS

### 2.1 Effectif actuel (2026-07-02)

| Poste | Slug | Statut | Responsabilités principales |
|-------|------|--------|---------------------------|
| Marketing Director | `marketing` | Prototype → à upgrader | Stratégie, délégation, rapports CEO, KPIs marché |
| Content Employee | `content` | Shell — à construire | Articles, scripts, posts, textes client |
| Prospecting Employee | `prospecting` | Shell — à construire | Leads, CRM, outreach, qualification |
| _(Design Employee)_ | `design` | Prévu — Phase 2 | Visuels, branding, assets clients |

### 2.2 Processus d'embauche d'un nouvel employé

Pour qu'un AI Employee soit officiellement opérationnel, il doit satisfaire la checklist suivante :

- [ ] Entrée dans la table `ai_agents` avec slug, rôle, OKRs documentés
- [ ] System prompt ("brief") rédigé avec persona permanente, pas temporaire
- [ ] Heartbeat pg_cron configuré (au minimum quotidien)
- [ ] Routine de monitoring KPI intégrée dans le heartbeat
- [ ] Mémoire d'entreprise initialisée (`company_memory`)
- [ ] Rapport hebdomadaire configuré (pg_cron lundi matin)
- [ ] Seuils d'alerte définis et codés
- [ ] Log de heartbeat dans `agent_heartbeats`
- [ ] Test du cycle complet (heartbeat → rapport → alerte) en staging

---

## SECTION 3 — ARCHITECTURE PERMANENTE

### 3.1 Vue d'ensemble des couches

```
┌─────────────────────────────────────────────────────────────┐
│  CEO COCKPIT (admin.html)                                   │
│  Tableaux de bord, approbations, inbox, bouton Lancer       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / Supabase Realtime
┌──────────────────────────▼──────────────────────────────────┐
│  COUCHE ORCHESTRATION                                        │
│  ai-orchestrator (Edge Function)                            │
│  Moteur d'exécution : boucle agentique, outils, logs        │
└─────────┬──────────────────────────┬────────────────────────┘
          │                          │
┌─────────▼──────────┐   ┌───────────▼──────────────────────┐
│  COUCHE HEARTBEAT  │   │  COUCHE MÉMOIRE                  │
│  pg_cron (Supabase)│   │  agent_memory (client-level)     │
│  Déclenche chaque  │   │  company_memory (entreprise)     │
│  employé le matin  │   │  agent_reports (historique)      │
└─────────┬──────────┘   └──────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────┐
│  COUCHE DONNÉES (Supabase PostgreSQL)                       │
│  ai_agents, agent_missions, agent_reports                   │
│  agent_memory, agent_actions_log, agent_outputs             │
│  pending_approvals, crm_contacts, crm_activities            │
│  blog_articles, n8n_workflows, expert_payouts               │
│  + agent_heartbeats, company_memory (à créer)               │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Tables existantes réutilisées

Ces tables existent en production. Ne pas les recréer. Les utiliser telles quelles.

| Table | Usage dans l'OS |
|-------|----------------|
| `ai_agents` | Registre officiel des employés. slug = identifiant permanent |
| `agent_missions` | Missions assignées (client ou internes). Statut du travail en cours |
| `agent_reports` | Rapports structurés produits spontanément ou sur mission |
| `agent_memory` | Mémoire persistante par (agent_slug × client_id). Mémoire client |
| `agent_actions_log` | Log immuable de chaque action externe exécutée |
| `agent_outputs` | Livrables produits (rapport, contenu, liste, stratégie...) |
| `pending_approvals` | File d'approbation CEO. Statut : pending → approved / rejected |
| `crm_contacts` | Contacts qualifiés par Prospecting Employee |
| `crm_activities` | Log des interactions CRM (email, note, relance) |
| `blog_articles` | Articles du blog. Content Employee peut créer des drafts |
| `n8n_workflows` | Catalogue des workflows automatisables |

### 3.3 Tables à créer pour l'OS

Ces tables n'existent pas encore. Elles sont nécessaires pour le fonctionnement permanent.

#### `company_memory`
Mémoire partagée au niveau entreprise (pas liée à un client).

```sql
CREATE TABLE IF NOT EXISTS company_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug text NOT NULL,
  memory_type text NOT NULL,
  content jsonb NOT NULL,
  valid_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_slug, memory_type)
);
```

Types de `memory_type` standard :
- `kpi_baseline` — métriques de référence pour détecter les anomalies
- `weekly_context` — résumé de la semaine en cours
- `monthly_goals` — objectifs du mois
- `strategic_context` — orientation stratégique, priorités CEO
- `competitor_intel` — veille concurrentielle récente
- `employee_okrs` — OKRs de l'employé pour le trimestre

#### `agent_heartbeats`
Log de chaque exécution de heartbeat.

```sql
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug text NOT NULL,
  run_type text NOT NULL CHECK (run_type IN ('daily','weekly','monthly','alert')),
  status text NOT NULL CHECK (status IN ('ok','alert_sent','error')),
  kpis_snapshot jsonb,
  alerts_triggered jsonb DEFAULT '[]',
  report_id uuid REFERENCES agent_reports(id),
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_heartbeats_agent ON agent_heartbeats(agent_slug, created_at DESC);
```

#### `employee_handoffs`
Messages formels d'un employé à un autre.

```sql
CREATE TABLE IF NOT EXISTS employee_handoffs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  mission_id uuid REFERENCES agent_missions(id) ON DELETE SET NULL,
  handoff_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','completed','rejected')),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_handoffs_to ON employee_handoffs(to_agent, status);
```

---

## SECTION 4 — CYCLE DE VIE D'UN AI EMPLOYEE

### 4.1 La journée d'un AI Employee (routine quotidienne)

Chaque matin à 8h00 heure de Montréal (13h00 UTC), pg_cron déclenche le heartbeat quotidien de chaque employé.

**Séquence obligatoire du heartbeat quotidien :**

```
1. Lire les KPIs du jour depuis Supabase
   → Métriques propres au poste (voir Section 5)

2. Comparer avec la baseline (company_memory.kpi_baseline)
   → Calculer les deltas : % de variation sur 24h, 7j, 30j

3. Vérifier les seuils d'alerte configurés
   → Si un seuil est franchi → notify_ceo() immédiatement
   → Logger dans agent_heartbeats avec status='alert_sent'

4. Vérifier les handoffs en attente (employee_handoffs WHERE to_agent=slug AND status='pending')
   → Si handoff reçu → créer une mission interne pour le traiter

5. Produire le bilan matinal
   → INSERT dans agent_reports (report_type='daily_kpi')
   → Logger dans agent_heartbeats avec status='ok'

6. Prendre une initiative si conditions remplies
   → Voir Section 9 — Prise d'initiative autonome
```

### 4.2 La semaine d'un AI Employee

Chaque lundi à 9h00 heure de Montréal (14h00 UTC) :

```
1. Agréger les KPIs des 7 derniers jours
2. Comparer avec objectifs hebdomadaires (company_memory.weekly_context)
3. Veille concurrentielle (search_web — 2 recherches max)
4. Rédiger le rapport hebdomadaire (agent_reports, report_type='weekly_summary')
5. Proposer une initiative pour la semaine (employee_initiatives ou notify_ceo)
6. Mettre à jour company_memory.weekly_context avec le résumé
7. Envoyer rapport au CEO via notify_ceo()
```

### 4.3 Le mois d'un AI Employee

Le premier lundi du mois à 9h00 :

```
1. Audit complet du domaine (30 derniers jours)
2. Performance vs OKRs du mois
3. Budget consommé vs prévu (si applicable)
4. Recommandations stratégiques pour le mois suivant
5. Proposer révision des OKRs si nécessaire
6. Mettre à jour company_memory.kpi_baseline avec les nouvelles références
7. Envoyer rapport mensuel au CEO
```

### 4.4 Le traitement d'une mission client

Quand le CEO assigne une mission via le CEO Cockpit :

```
1. Réception : agent_missions.statut = 'assigned'
2. Analyse du brief : lecture du contexte (client_memory + company_memory.strategic_context)
3. Décomposition : planification des sous-tâches (logged dans agent_actions_log)
4. Exécution : boucle agentique via ai-orchestrator (jusqu'à 15 itérations)
5. Décision autonome : pour toute action standard dans le périmètre
6. Escalade CEO : pour toute décision hors périmètre (voir Section 8)
7. Délégation : si sous-tâche appartient à un autre employé → employee_handoffs
8. Livrable : agent_outputs (output complet, pas un résumé)
9. Rapport : agent_reports (résumé de mission, résultats, points ouverts)
10. Clôture : agent_missions.status = 'completed' + notify_ceo()
```

---

## SECTION 5 — KPIs PAR POSTE

### 5.1 Marketing Director

Données lues depuis Supabase + Stripe chaque matin :

| KPI | Source | Seuil d'alerte |
|-----|--------|----------------|
| MRR (Monthly Recurring Revenue) | Stripe via `expert_payouts` | Baisse > 20% en 7j |
| Nouveaux utilisateurs (7j) | `profiles` table | Baisse > 30% vs semaine précédente |
| Taux de conversion brief → mission | `briefs` + `agent_missions` | < 20% sur 30j |
| Articles publiés (7j) | `blog_articles` | 0 article en 96h |
| Tickets support ouverts | `support_tickets` | > 10 ouverts depuis plus de 48h |
| Missions complétées (7j) | `agent_missions` | 0 mission complétée en 7j (si clients actifs) |

### 5.2 Content Employee

| KPI | Source | Seuil d'alerte |
|-----|--------|----------------|
| Articles en draft non publiés depuis > 48h | `blog_articles` | Alert si > 3 |
| Dernière publication | `blog_articles.published_at` | Alert si > 96h |
| Missions contenu actives | `agent_missions` WHERE agent_slug='content' | — |
| Sujets en queue | `company_memory.topics_queue` | Alert si vide |

### 5.3 Prospecting Employee

| KPI | Source | Seuil d'alerte |
|-----|--------|----------------|
| Nouveaux contacts CRM (7j) | `crm_contacts` | 0 en 7j |
| Contacts contactés vs total new | `crm_contacts` | Taux < 50% sur 30j |
| Approbations email en attente | `pending_approvals` | > 5 en attente depuis > 48h |
| Taux réponse (approximation) | `crm_contacts` WHERE status='responded' | < 10% sur 30j |

---

## SECTION 6 — MÉMOIRE

### 6.1 Types de mémoire et leur usage

| Type | Table | Scope | Durée |
|------|-------|-------|-------|
| Mémoire client | `agent_memory` | agent_slug × client_id | Permanente |
| Mémoire entreprise | `company_memory` | agent_slug × memory_type | Permanente (mise à jour) |
| Historique missions | `agent_missions` (completed) | Toutes missions complétées | Archive |
| Log d'actions | `agent_actions_log` | Immuable | Permanent |
| Historique rapports | `agent_reports` | Tous rapports | Archive |

### 6.2 Règles d'accès à la mémoire

- Chaque employé lit SA propre mémoire d'entreprise (`agent_slug = son slug`)
- Chaque employé peut lire la mémoire client d'un autre employé UNIQUEMENT si le client lui est identifié dans la mission
- Le Marketing Director peut lire `company_memory` de tous les employés pour produire des rapports consolidés
- Aucun employé ne modifie directement la mémoire d'un autre employé

### 6.3 Routine de mise à jour de la mémoire

La mémoire d'entreprise est mise à jour :
- Après chaque heartbeat hebdomadaire (`weekly_context`)
- Après chaque audit mensuel (`kpi_baseline`, `monthly_goals`)
- Après toute décision stratégique CEO communiquée dans le Cockpit

**Format recommandé pour `company_memory.content` (jsonb) :**

```json
{
  "snapshot_date": "2026-07-02",
  "summary": "...",
  "key_metrics": { "mrr": 0, "users": 0 },
  "priorities": ["..."],
  "blockers": ["..."],
  "notes": "..."
}
```

---

## SECTION 7 — OUTILS DISPONIBLES PAR NIVEAU

Ces outils sont déjà implémentés dans `ai-orchestrator/index.ts`. Ils ne sont pas à recréer.

### Niveau 1 — Lecture interne (toujours disponible, sans restriction)
- `read_blog_articles` — articles du blog (statut, catégorie)
- `read_blog_subscribers` — abonnés newsletter
- `read_open_briefs` — briefs clients ouverts
- `read_support_tickets` — tickets support
- `read_mission_history` — historique des missions du client

### Niveau 1 — Écriture interne (disponible, loggée)
- `create_blog_draft` — crée un draft (jamais publie directement)
- `create_support_ticket` / `update_support_ticket`
- `create_report` — rapport structuré dans `agent_reports`
- `create_output` — livrable dans `agent_outputs`
- `notify_ceo` — notification email CEO immédiate

### Niveau 2 — Web et mémoire (disponible, quotas)
- `search_web` — Tavily (max 4 par mission, max 2 par heartbeat)
- `read_url` — Jina Reader (lecture d'une URL)
- `read_client_memory` / `save_to_memory` — mémoire client persistante
- `find_images` / `find_videos` — Unsplash / YouTube

### Niveau 3 — Actions externes (approval CEO obligatoire)
- `send_email` — envoi email réel à un tiers
- `publish_article` — publication d'un article (statut draft → published)
- `trigger_workflow` — déclenchement workflow n8n

### CRM (disponible Prospecting + Marketing Director)
- `save_to_crm` / `read_crm_contacts` / `update_crm_contact` / `log_crm_activity`

### Heartbeat uniquement (pas dans ai-orchestrator)
- `read_stripe_metrics` — à implémenter : lecture des données Stripe via API
- `read_company_memory` / `update_company_memory` — mémoire entreprise
- `log_heartbeat` — enregistrement dans `agent_heartbeats`

---

## SECTION 8 — HIÉRARCHIE ET GOUVERNANCE

### 8.1 Structure de commandement

```
CEO (Joacenel)
    │
    ├── Marketing Director ← chef de projet missions client
    │       ├── Content Employee ← reçoit missions via handoff
    │       ├── Prospecting Employee ← reçoit missions via handoff
    │       └── Design Employee (prévu Phase 2)
    │
    └── blog-monitor ← composant technique, pas un employé
```

### 8.2 Règles de commandement

1. **Le CEO ne travaille pas.** Il décide, valide, reçoit. Il ne rédige pas de contenu, ne prospecte pas, n'exécute pas de missions.

2. **Le Marketing Director est le chef de projet.** Pour toute mission client, il orchestre. Il délègue. Il compile. Il rapporte au CEO.

3. **Content et Prospecting reçoivent des missions du Marketing Director** via `employee_handoffs`, pas directement du CEO (sauf exception explicite).

4. **Chaque employé est autonome dans son périmètre.** Il décide seul pour les actions standards. Il n'attend pas la permission pour produire un rapport ou rédiger un contenu.

5. **Chaque employé rend compte spontanément.** Rapport hebdomadaire le lundi, rapport mensuel le premier lundi du mois.

### 8.3 Droits et périmètre de décision

| Action | Autonomie | Approval CEO |
|--------|-----------|-------------|
| Rédiger un draft de contenu | Oui | Non |
| Créer un rapport interne | Oui | Non |
| Sauvegarder en mémoire | Oui | Non |
| Ajouter un contact au CRM | Oui | Non |
| Envoyer un email à un tiers | Non | Obligatoire |
| Publier un article | Non | Obligatoire |
| Déclencher un workflow n8n | Non (si requires_approval) | Obligatoire |
| Dépenser un budget > 50 USD | Non | Obligatoire |
| Prendre une décision irréversible | Non | Obligatoire |
| Proposer une initiative | Oui (notify_ceo) | Pour exécution seulement |

---

## SECTION 9 — PRISE D'INITIATIVE AUTONOME

### 9.1 Définition

Une initiative est une action proposée ou exécutée par un employé sans qu'un humain l'ait demandée, mais qui est justifiée par les données ou la situation.

### 9.2 Conditions déclenchantes

Un employé peut prendre une initiative si :
- Il détecte une opportunité dans ses KPIs (ex : sujet de blog performant non exploité)
- Il détecte un risque non encore signalé (ex : baisse MRR avant le seuil d'alerte)
- Il observe qu'un collègue a un blocage qu'il peut débloquer
- Ses OKRs du mois lui donnent un objectif non encore adressé

### 9.3 Types d'initiatives autorisées sans approbation CEO

- Rédiger un draft de contenu et le proposer via `notify_ceo`
- Ajouter des contacts au CRM après une recherche web
- Mettre à jour sa propre mémoire d'entreprise
- Créer un rapport d'analyse et l'envoyer au CEO
- Déléguer une sous-tâche à un collègue via `employee_handoffs`

### 9.4 Format d'une proposition d'initiative (notify_ceo)

```
Sujet : [INITIATIVE] Marketing Director — Campagne blog IA générative

Contexte :
J'ai détecté que les articles sur "IA générative" ont un taux de lecture 3x supérieur 
à notre moyenne. Il n'y a aucun article sur ce sujet prévu dans la queue.

Initiative proposée :
Rédiger 3 articles sur "IA générative pour créateurs de contenu" et les planifier 
sur les 2 prochaines semaines.

Impact estimé :
+15% trafic blog, renforcement du positionnement SEO.

Action requise :
Approuve ou modifie cette initiative depuis le CEO Cockpit.
```

---

## SECTION 10 — COLLABORATION INTER-EMPLOYÉS (HANDOFFS)

### 10.1 Qu'est-ce qu'un handoff

Un handoff est un message formel d'un employé à un autre, tracé dans `employee_handoffs`. Il remplace les prompts informels et garantit que chaque délégation est trackée, acceptée et exécutée.

### 10.2 Structure d'un handoff

```json
{
  "from_agent": "marketing",
  "to_agent": "content",
  "mission_id": "uuid-de-la-mission-parente",
  "handoff_type": "content_creation",
  "payload": {
    "objective": "Rédiger un article de 1200 mots sur...",
    "tone": "professionnel, direct, francophone",
    "target_audience": "créateurs de contenu débutants",
    "deadline": "2026-07-05T17:00:00Z",
    "deliverable": "article complet prêt à publier",
    "context": "Mission client #uuid — client veut 3 articles sur l'IA"
  }
}
```

### 10.3 Cycle de vie d'un handoff

```
Marketing Director crée le handoff → status = 'pending'
Content Employee détecte le handoff lors de son prochain heartbeat
Content Employee accepte → status = 'accepted' + crée agent_mission interne
Content Employee exécute → produit un agent_output
Content Employee signale fin → status = 'completed'
Marketing Director reçoit notification → intègre dans son rapport client
```

### 10.4 Règles des handoffs

- Tout handoff doit avoir un `deadline` clair
- Tout handoff doit avoir un `deliverable` précis (pas "aide-moi avec le contenu")
- Le destinataire a 24h pour accepter ou signaler un blocage
- Si bloqué → `notify_ceo` avec raison

---

## SECTION 11 — COMMUNICATION

### 11.1 Types de messages vers le CEO

| Type | Déclencheur | Urgence | Format |
|------|------------|---------|--------|
| Alerte critique | Seuil KPI franchi | Immédiat | Email via notify_ceo + log heartbeat |
| Approbation requise | Avant action sensible | 24h max | `pending_approvals` + email CEO |
| Rapport quotidien | Heartbeat chaque matin | Archivé (pas d'email sauf anomalie) | `agent_reports` |
| Rapport hebdomadaire | Lundi 9h | Email CEO | `agent_reports` + email |
| Rapport mensuel | Premier lundi du mois | Email CEO | `agent_reports` + email |
| Proposition d'initiative | Conditionnelle | Non urgent | Email via notify_ceo |
| Mission complétée | Fin de mission | Informatif | Email + `agent_reports` |

### 11.2 Format standard des emails CEO

Tous les emails CEO envoyés par les employés suivent ce format :

```
Objet : [TYPE] Nom de l'employé — Sujet court

RÉSUMÉ EN 2 LIGNES
Ce qui s'est passé. Ce que ça signifie.

DONNÉES
• Métrique 1 : valeur (delta vs précédent)
• Métrique 2 : valeur
...

ACTION REQUISE (si applicable)
Ce que le CEO doit faire. Lien direct.

CONTEXTE COMPLET
Voir rapport : [lien vers admin.html]
```

### 11.3 Ce que le CEO NE reçoit pas (par défaut)

- Le contenu détaillé de chaque draft créé (seulement le fait qu'il existe)
- Les recherches web effectuées (seulement les résultats importants)
- Les mises à jour de mémoire routine
- Les logs CRM de routine (seulement les contacts qualifiés avec opportunité)

---

## SECTION 12 — GESTION DES ERREURS ET RÉSILIENCE

### 12.1 Erreurs dans le heartbeat

Si le heartbeat échoue (erreur Supabase, timeout Anthropic, API externe down) :

```
1. Logger dans agent_heartbeats avec status='error' et le message d'erreur
2. Ne pas re-tenter immédiatement (laisser pg_cron faire le prochain cycle)
3. Si 3 heartbeats consécutifs échouent → notify_ceo (alerte infrastructure)
4. Ne jamais crasher silencieusement
```

### 12.2 Erreurs dans une mission client

Si une mission échoue après timeout ou erreur :

```
1. agent_missions.status = 'failed'
2. agent_missions.result_summary = message d'erreur explicite
3. Notifier le CEO si mission payante
4. Préserver tout ce qui a été produit avant l'échec (agent_outputs déjà sauvegardés)
```

### 12.3 Soft timeout (règle technique)

Toutes les Edge Functions d'exécution d'agent DOIVENT implémenter un soft timeout à 110 000ms (10s avant le kill Supabase à 150s). Déjà en place dans `ai-orchestrator`. Reproduire dans toutes les futures fonctions heartbeat.

### 12.4 Idempotence

Toutes les opérations d'écriture DOIVENT être idempotentes :
- Utiliser `upsert` avec `onConflict` plutôt que `insert` pour les données de mémoire
- Vérifier l'existence avant de créer (exemple : vérifier si un heartbeat du jour existe déjà)
- Jamais deux rapports quotidiens pour le même employé le même jour

---

## SECTION 13 — SÉCURITÉ ET PÉRIMÈTRE D'ACTION

### 13.1 Règles absolues de sécurité (non négociables)

1. **Aucun employé ne lit ou n'envoie des données d'authentification.**
2. **Aucun employé n'accède à `auth.users` directement.** Seulement via `profiles`.
3. **Aucune URL locale ou interne n'est consultable** via `read_url` (déjà bloqué dans le code).
4. **Les clés API ne transitent jamais** dans les messages d'un agent. Elles restent dans les env vars Supabase.
5. **Avant tout envoi email externe** : approbation CEO dans `pending_approvals`. Sans exception.
6. **Avant toute publication de contenu** : approbation CEO. Sans exception.
7. **Chaque action externe est loggée** dans `agent_actions_log` AVANT exécution, pas après.

### 13.2 Limites de consommation par heartbeat

| Ressource | Limite par heartbeat quotidien |
|-----------|-------------------------------|
| Appels Anthropic | 1 appel max (rapport KPI) |
| Recherches web (Tavily) | 2 max (pour veille quotidienne) |
| Emails CEO | 1 max sauf alerte critique |
| Tokens Anthropic par heartbeat | 4096 max (sonnet-4-6) |

### 13.3 Limites de consommation par mission client

Déjà configurées dans `ai-orchestrator` :
- Max 15 itérations
- Max 4 recherches web par mission
- Max 8192 tokens par appel Anthropic
- Soft timeout 110s

### 13.4 Protection RLS

Tous les agents fonctionnent avec la `SUPABASE_SERVICE_ROLE_KEY`. Cette clé bypasse le RLS. Cela est intentionnel et acceptable parce que :
- Les agents sont des processus internes, pas des utilisateurs externes
- Chaque action est loggée dans `agent_actions_log`
- L'audit trail remplace le RLS comme couche de sécurité pour les actions d'agents

---

## SECTION 14 — APPRENTISSAGE CONTINU

### 14.1 Comment un employé s'améliore

Un AI Employee s'améliore via :

1. **Mémoire client** — Se souvient du ton, des préférences, de l'ICP de chaque client. Évite de redemander la même chose.

2. **Baseline KPI** — Après chaque mois, met à jour `company_memory.kpi_baseline` avec les nouvelles métriques normales. Les alertes se recalibrent automatiquement.

3. **Historique des initiatives** — Suit quelles initiatives ont été approuvées vs rejetées par le CEO. Ajuste les propositions futures.

4. **Feedback CEO** — Le CEO peut laisser un commentaire lors de l'approbation/rejet d'une action. Ce feedback est stocké dans `company_memory.feedback_log` et relu au prochain heartbeat.

### 14.2 Ce qui n'est PAS de l'apprentissage (à ne pas confondre)

- Modifier le system prompt dynamiquement en cours de mission → NON. Le brief est fixe.
- Fine-tuner le modèle de base → NON. Hors scope, non nécessaire.
- Accumuler des données d'entraînement → NON. L'apprentissage se fait par la mémoire structurée, pas par les poids du modèle.

---

## SECTION 15 — GUIDE D'IMPLÉMENTATION D'UN NOUVEL EMPLOYÉ

Pour implémenter un nouvel AI Employee conforme à cette Constitution :

### Étape 1 — Registre

```sql
INSERT INTO ai_agents (slug, name, role, description)
VALUES ('content', 'Content Employee', 'Responsable Contenu', 'Rédaction articles, scripts, posts, textes clients');
```

### Étape 2 — Brief permanent (system prompt)

Le brief d'un AI Employee permanent diffère fondamentalement d'un agent de mission :

```
Tu es [Titre], un employé permanent de CreatorFlow Market.
Tu as un poste, des responsabilités, des OKRs.
Tu n'attends pas qu'on te demande quelque chose pour travailler.
Ta journée commence par lire tes KPIs, identifier les opportunités et anomalies, 
et prendre les initiatives qui sont dans ton périmètre.

OKRs du trimestre :
- [OKR 1]
- [OKR 2]

KPIs dont tu es responsable :
- [KPI 1 avec seuil]
- [KPI 2 avec seuil]

Ton périmètre d'action autonome :
- [Ce que tu peux faire sans demander]

Tu escalades au CEO uniquement pour :
- [Liste exhaustive des cas d'escalade]
```

### Étape 3 — Heartbeat Edge Function

Créer une Edge Function dédiée `[slug]-heartbeat/index.ts` :

```typescript
// Structure type d'un heartbeat
async function runDailyHeartbeat(supabase, anthropic, agentSlug) {
  const startTime = Date.now();
  
  // 1. Lire les KPIs
  const kpis = await readEmployeeKPIs(supabase, agentSlug);
  
  // 2. Comparer avec baseline
  const { data: baseline } = await supabase
    .from('company_memory')
    .select('content')
    .eq('agent_slug', agentSlug)
    .eq('memory_type', 'kpi_baseline')
    .single();
  
  // 3. Détecter alertes
  const alerts = detectAlerts(kpis, baseline?.content);
  
  // 4. Appel Anthropic pour le bilan (si nécessaire)
  // ...
  
  // 5. Insérer rapport
  const { data: report } = await supabase
    .from('agent_reports')
    .insert({ agent_slug: agentSlug, report_type: 'daily_kpi', ... })
    .select('id').single();
  
  // 6. Logger le heartbeat
  await supabase.from('agent_heartbeats').insert({
    agent_slug: agentSlug,
    run_type: 'daily',
    status: alerts.length > 0 ? 'alert_sent' : 'ok',
    kpis_snapshot: kpis,
    alerts_triggered: alerts,
    report_id: report.id,
    duration_ms: Date.now() - startTime,
  });
}
```

### Étape 4 — pg_cron (heartbeat quotidien)

```sql
-- À exécuter dans le SQL Editor Supabase
SELECT cron.schedule(
  '[slug]-heartbeat-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/[slug]-heartbeat',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"run_type": "daily"}'::jsonb
  );
  $$
);

-- Heartbeat hebdomadaire (lundi 14h UTC)
SELECT cron.schedule(
  '[slug]-heartbeat-weekly',
  '0 14 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/[slug]-heartbeat',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"run_type": "weekly"}'::jsonb
  );
  $$
);
```

### Étape 5 — Vérification de conformité

Avant de déclarer un employé opérationnel, vérifier :

| Critère | Vérifié ? |
|---------|----------|
| Entrée dans `ai_agents` | [ ] |
| Brief permanent (pas "tu aides quand on te le demande") | [ ] |
| Heartbeat quotidien pg_cron actif | [ ] |
| Au moins 3 KPIs définis avec seuils | [ ] |
| Mémoire d'entreprise initialisée | [ ] |
| Rapport hebdomadaire configuré | [ ] |
| Seuils d'alerte CEO testés | [ ] |
| Log dans `agent_heartbeats` fonctionnel | [ ] |
| Handoffs entrants gérés | [ ] |

---

## SECTION 16 — MIGRATIONS NÉCESSAIRES POUR L'OS

Ces migrations ne sont pas encore appliquées. Elles sont nécessaires pour l'OS.

### Priorité 1 (avant tout nouveau employé permanent)

```sql
-- company_memory
CREATE TABLE IF NOT EXISTS company_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug text NOT NULL,
  memory_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  valid_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_slug, memory_type)
);

ALTER TABLE company_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_memory_service" ON company_memory FOR ALL USING (true) WITH CHECK (true);

-- agent_heartbeats
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug text NOT NULL,
  run_type text NOT NULL CHECK (run_type IN ('daily','weekly','monthly','alert')),
  status text NOT NULL CHECK (status IN ('ok','alert_sent','error')),
  kpis_snapshot jsonb DEFAULT '{}',
  alerts_triggered jsonb DEFAULT '[]',
  report_id uuid REFERENCES agent_reports(id),
  error_message text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_agent_date ON agent_heartbeats(agent_slug, created_at DESC);
ALTER TABLE agent_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "heartbeats_service" ON agent_heartbeats FOR ALL USING (true) WITH CHECK (true);

-- employee_handoffs
CREATE TABLE IF NOT EXISTS employee_handoffs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  mission_id uuid REFERENCES agent_missions(id) ON DELETE SET NULL,
  handoff_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','completed','rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_handoffs_to_pending ON employee_handoffs(to_agent, status);
ALTER TABLE employee_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "handoffs_service" ON employee_handoffs FOR ALL USING (true) WITH CHECK (true);
```

### Priorité 2 (amélioration Stripe KPI)

Ajouter une colonne `input` dans `agent_actions_log` — déjà partiellement utilisée dans blog-monitor. Vérifier que la colonne existe, sinon :

```sql
ALTER TABLE agent_actions_log ADD COLUMN IF NOT EXISTS input jsonb;
```

---

## SECTION 17 — ÉTAT ACTUEL VS CIBLE

| Capacité | Existant | Cible OS | Gap |
|----------|----------|----------|-----|
| Exécution de mission | `ai-orchestrator` | Inchangé | Aucun |
| Heartbeat quotidien | `blog-monitor` uniquement | Tous les employés | Créer heartbeat par employé |
| Mémoire client | `agent_memory` | Inchangé | Aucun |
| Mémoire entreprise | Absente | `company_memory` | Créer table + outils |
| Log heartbeats | Absent | `agent_heartbeats` | Créer table |
| Handoffs inter-employés | Absent | `employee_handoffs` | Créer table + logique |
| Rapports hebdomadaires | Manuels | Automatiques (pg_cron) | Créer cron + fonction |
| Alertes KPI | `blog-monitor` uniquement | Tous les employés | Étendre le pattern |
| Web search | Tavily dans `ai-orchestrator` | Inchangé | Aucun |
| Lecture URL | Jina Reader | Inchangé | Aucun |
| Approval CEO | `pending_approvals` | Inchangé | Aucun |

---

## SECTION 18 — ORDRE DE PRIORITÉ D'IMPLÉMENTATION

Cette séquence transforme l'OS de document en réalité opérationnelle.

**Phase A — Infrastructure de base (bloquer tout nouveau employé avant ça)**

1. Appliquer migration Priorité 1 (company_memory, agent_heartbeats, employee_handoffs)
2. Ajouter outils heartbeat dans ai-orchestrator : `read_company_memory`, `update_company_memory`, `log_heartbeat`
3. Tester avec Marketing Director en mode heartbeat

**Phase B — Marketing Director permanent**

1. Créer `marketing-heartbeat` Edge Function (lit KPIs Stripe + Supabase, détecte alertes, génère bilan)
2. Configurer pg_cron quotidien + hebdomadaire pour Marketing
3. Initialiser `company_memory` pour Marketing (baseline KPIs, OKRs)
4. Valider : 3 jours de heartbeats sans erreur

**Phase C — Content Employee permanent**

1. Créer `content-heartbeat` Edge Function
2. Implémenter gestion des handoffs entrants (vérifie `employee_handoffs` à chaque heartbeat)
3. Configurer pg_cron
4. Tester délégation Marketing → Content via handoff

**Phase D — Prospecting Employee permanent**

1. Créer `prospecting-heartbeat` Edge Function
2. Implémenter gestion handoffs + monitoring CRM
3. Configurer pg_cron

---

## AMENDEMENTS

Cette Constitution peut être amendée uniquement par le CEO (Joacenel). Chaque amendement doit :
- Être daté
- Citer la section modifiée
- Expliquer la raison du changement
- Être intégré directement dans ce document (pas en annexe)

| Date | Section | Changement |
|------|---------|-----------|
| 2026-07-02 | Toutes | Version initiale — v1.0 |

---

*Ce document est la propriété de CreatorFlow Market. Toute décision architecturale sur l'AI Workforce doit être conforme à cette Constitution.*
