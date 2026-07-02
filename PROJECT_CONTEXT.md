# PROJECT_CONTEXT.md — CreatorFlow Market
> Source de vérité permanente. Ne jamais supprimer. Mis à jour à chaque changement majeur.
> Dernière mise à jour : 2026-07-02

---

## 1. URLS OFFICIELLES

| Environnement | URL |
|---------------|-----|
| Production | https://creatorflowmarket.com |
| Admin / CEO Cockpit | https://creatorflowmarket.com/admin |
| Employés IA | https://creatorflowmarket.com/employes |
| Blog | https://creatorflowmarket.com/blog |
| Experts | https://creatorflowmarket.com/experts.html |
| Académie | https://creatorflowmarket.com/academie.html |
| Dashboard client | https://creatorflowmarket.com/dashboard-client.html |
| Dashboard expert | https://creatorflowmarket.com/dashboard-expert.html |

**Supabase projet :** `https://cjtglfutckaogsmwhfsv.supabase.co`
**Supabase ref :** `cjtglfutckaogsmwhfsv`
**GitHub :** `https://github.com/quiz-509/creatorflow-ai-hub` (branche `main`)
**Hébergement :** Cloudflare Pages
**Deploy Edge Functions :** depuis `d:/Projects/creatorflow-market/livrables/` (pas la racine)

---

## 2. VISION

CreatorFlow Market n'est pas une marketplace. Ce n'est pas une académie. Ce n'est pas un CRM.

**C'est une entreprise complète pilotée par l'IA.**

Les clients arrivent avec un besoin. Les agents IA exécutent 80–90% du travail. Les experts humains interviennent uniquement quand leur jugement est irremplaçable. Le CEO supervise, valide les décisions critiques et pilote l'ensemble depuis un cockpit unique.

**Positionnement :** Marketplace hybride FR/créatif — experts humains + employés IA, pour créateurs de contenu, TPE et solopreneurs francophones.

---

## 3. STACK TECHNIQUE

| Couche | Technologie |
|--------|------------|
| Frontend | HTML/CSS/JS + React via CDN (pas de build) |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Edge Functions | Deno (Supabase Functions) |
| Hébergement | Cloudflare Pages |
| Scheduler | pg_cron (intégré Supabase) |
| HTTP client (interne) | pg_net (intégré Supabase) |
| Emails | Resend (domaine `creatorflowmarket.com` vérifié) |
| Paiements | Stripe (mode live, commissions 15% auto via Connect) |
| Blog pipeline | GitHub Actions → Claude API → Supabase |
| Recherche web | Tavily API |
| Lecture URL | Jina Reader (`r.jina.ai`) |
| IA | Anthropic Claude (Sonnet pour orchestration, Haiku pour heartbeats hebdo) |

---

## 4. ARCHITECTURE BASE DE DONNÉES (tables clés)

### Tables core
| Table | Rôle |
|-------|------|
| `profiles` | Utilisateurs (client / expert / admin) |
| `experts` | Profils experts avec compétences + catégories |
| `missions` | Missions client complètes |
| `conversations` | Messagerie entre client et expert |
| `reviews` | Avis clients sur experts |
| `expert_payouts` | Virements experts via Stripe Connect |
| `crm_contacts` | CRM prospects |

### Tables AI Workforce
| Table | Rôle |
|-------|------|
| `ai_agents` | Registre des employés IA |
| `agent_missions` | Missions assignées aux agents |
| `agent_actions_log` | Log de chaque action agent (avec colonne `input`) |
| `agent_memory` | Mémoire par agent et par client |
| `agent_reports` | Rapports produits par les agents |
| `pending_approvals` | Approbations CEO en attente |
| `client_files` | Fichiers uploadés liés aux missions |
| `company_memory` | Mémoire entreprise par employé (long terme) |
| `agent_heartbeats` | Log de chaque exécution automatique |
| `employee_handoffs` | Délégations formelles inter-employés |

### Tables Academy
| Table | Rôle |
|-------|------|
| `academy_courses` | Cours avec prix Stripe |
| `academy_modules` | Modules par cours |
| `academy_lessons` | Leçons par module |
| `academy_enrollments` | Inscriptions par user |
| `academy_progress` | Progression par leçon |

---

## 5. EDGE FUNCTIONS DÉPLOYÉES

| Function | Rôle | Type |
|----------|------|------|
| `ai-orchestrator` | Moteur central — tous les outils agents | Infrastructure |
| `ai-agent` | Agent de base (déprécié, remplacé par orchestrator) | Infrastructure |
| `agent-file-upload` | Upload fichiers clients | Infrastructure |
| `send-email` | Emails transactionnels via Resend | Infrastructure |
| `workflow-runner` | Exécution workflows n8n | Infrastructure |
| `create-checkout-session` | Stripe Checkout (Academy + missions) | Produit |
| `support-agent` | Support client plateforme (outil produit, pas AI Employee) | Produit |
| `blog-monitor` | Monitoring blog (ancienne génération, déclenché) | Legacy |
| `marketing-director` | Marketing Director sur demande (ancienne génération) | Legacy |
| `marketing-heartbeat` | **Marketing Director permanent — heartbeat quotidien** | AI Employee |

---

## 6. AI WORKFORCE — ÉTAT ACTUEL

### Constitution
Référence complète : `livrables/AI_WORKFORCE_OS.md` (Section 16 pour les migrations SQL)

### Distinction fondamentale
**AI Agent** = tâche unique. Outil. Ce n'est PAS ce qu'on construit.
**AI Employee** = poste permanent occupé en continu. Heartbeat quotidien. Mémoire long terme. Reporting spontané.

> "Un AI Employee qui attend une mission avant de travailler n'est pas un employé. C'est un freelance."

### Registre officiel des AI Employees

| Employé | Slug | Statut | Heartbeat |
|---------|------|--------|-----------|
| Marketing Director | `marketing` | Opérationnel | Quotidien 9h MTL (13h UTC) + Hebdo lundi |
| Content Employee | `content` | À construire (Phase C) | Non configuré |
| Prospecting Employee | `prospecting` | À construire (Phase D) | Non configuré |

### Architecture d'un AI Employee (standard obligatoire)
Chaque employé doit avoir :
- Heartbeat quotidien via pg_cron
- KPI monitoring (lit Stripe + Supabase chaque matin)
- Seuils d'alerte automatiques
- Mémoire long terme dans `company_memory`
- Log dans `agent_heartbeats`
- Reporting spontané dans `agent_reports`
- Email CEO si alerte ou rapport hebdo

### pg_cron configuré
```sql
-- Marketing Director — quotidien 13h UTC
'marketing-heartbeat-daily' → '0 13 * * *'

-- Marketing Director — hebdo lundi 14h UTC
'marketing-heartbeat-weekly' → '0 14 * * 1'
```

### Pipeline missions (modèle opérationnel)
```
Client → CEO reçoit → assigne au Marketing Director
→ Marketing délègue (Content / Prospecting / Design)
→ Chaque employee rapporte au Marketing Director
→ Marketing compile → CEO valide → Exécution → Rapport final
```

Règle absolue : **Le CEO ne travaille pas. Il décide, valide, reçoit.**

---

## 7. RÈGLES PERMANENTES DE DÉVELOPPEMENT

1. **Ne jamais reconstruire l'architecture existante** — intégrer au-dessus
2. **Ne jamais supprimer une fonctionnalité existante** sans raison explicite
3. **Toujours analyser avant de modifier** — lire le fichier avant d'éditer
4. **Réutiliser les composants, tables et APIs existants** avant d'en créer de nouveaux
5. **Produire un rapport avant toute modification majeure**
6. **Deploy Edge Functions depuis `livrables/`** — pas depuis la racine du projet
7. **Soft timeout 110 000ms** sur toutes les Edge Functions (hard kill Supabase = 150s)
8. **Idempotence SQL** — toujours `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`
9. **RLS obligatoire** sur toutes les nouvelles tables
10. **Ne jamais accepter de clé API dans le chat** — uniquement dans Supabase Secrets

### Question de validation avant tout développement
> "Est-ce que je construis une **fonction pour un employé permanent** ou un **chatbot spécialisé** dans une seule tâche ?"
> Chatbot → arrêter. Employé permanent → continuer.

---

## 8. APIS ET SERVICES EXTERNES

| Service | Usage | Config |
|---------|-------|--------|
| Anthropic Claude | Orchestration + génération | `ANTHROPIC_API_KEY` dans Supabase Secrets |
| Stripe | Paiements live + Connect | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` dans Supabase Secrets |
| Resend | Emails transactionnels | `RESEND_API_KEY` dans Supabase Secrets. FROM: `noreply@creatorflowmarket.com` |
| Tavily | Recherche web pour agents | Dans ai-orchestrator |
| Jina Reader | Lecture URL web | `r.jina.ai` — pas de clé requise |
| GitHub Actions | Pipeline blog auto (Lun/Mer/Ven 10h UTC) | `ANTHROPIC_API_KEY` + `SUPABASE_SECRET_KEY` dans GitHub Secrets |
| n8n | Workflows automatisation | `workflow-runner` Edge Function |
| Cloudflare | Pages + Functions (SSR blog) + DNS | Domaine `creatorflowmarket.com` |

---

## 9. ACADEMIE — FORMATEURS IA

| Formateur | Spécialité | Prix |
|-----------|-----------|------|
| Rose | Marketing IA | 97$ CAD |
| Phelix | Agents IA | 147$ CAD |
| Rémy | Automatisation | 127$ CAD |
| Jay | Développement IA | 197$ CAD |
| Louvie | Business & Prompts | 97$ CAD |

Pipeline création : Leonardo AI (avatar) → ElevenLabs (voix) → Hedra (vidéo)

---

## 10. SÉCURITÉ — POINTS CRITIQUES

| Problème | Sévérité | État |
|---------|---------|------|
| Email admin hardcodé dans le code | CRITIQUE | Non corrigé — aucun lancement commercial sans fix |
| Stripe Webhook Secret | ÉLEVÉ | À configurer dans Stripe Dashboard → copier dans Supabase Secrets |
| RLS 18+ tables | Appliqué | Migration 2026-07-02 |

---

## 11. ROADMAP RÉSUMÉE

| Phase | Contenu | État |
|-------|---------|------|
| Phase A | OS AI Workforce (3 tables, company_memory, heartbeat infra) | COMPLÉTÉ |
| Phase B | Marketing Director permanent (heartbeat daily/weekly, pg_cron) | COMPLÉTÉ |
| Phase C | Content Employee permanent | À faire |
| Phase D | Prospecting Employee permanent | À faire |
| Sprint 4 | Algorithme matching, CRM pipeline, bêta privée 10 clients | À planifier |

---

## 12. CE QUE LE CEO NE DOIT PAS RECEVOIR PAR EMAIL

- Bilan quotidien sans alerte (stocké dans agent_reports seulement)
- Logs techniques
- Erreurs internes récupérées automatiquement

**Le CEO reçoit :** alertes KPI franchies, rapport hebdo Marketing Director, propositions d'initiative hors périmètre.

---

*Ce fichier est la mémoire permanente du projet. Le lire en début de session remplace toutes les questions de contexte.*
