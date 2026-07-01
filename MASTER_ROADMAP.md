# CreatorFlow Market — Master Roadmap
> Document vivant. Mis à jour après chaque sprint. Source de vérité unique.
> Dernière mise à jour : 2026-06-30

---

## VISION PERMANENTE

CreatorFlow Market n'est pas une marketplace. Ce n'est pas une académie. Ce n'est pas un CRM.

**C'est une entreprise complète pilotée par l'IA.**

Les clients arrivent avec un besoin. Les agents IA exécutent 80-90% du travail. Les experts humains interviennent uniquement quand leur jugement est irremplaçable. Le CEO supervise, valide les décisions critiques et pilote l'ensemble depuis un cockpit unique.

Chaque ligne de code doit servir cette vision. Si une fonctionnalité ne rapproche pas le projet de cet état final, elle ne se construit pas.

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
**Avancement : 25%**

| Composant | État | Notes |
|-----------|------|-------|
| Pages HTML (36 pages) | ✅ Existe | UI complète |
| Vrais experts | ❌ 0 | Fallback personas |
| Matching algorithm | ❌ | Tri par date seulement |
| Stripe Connect | ❌ | Paiements sans commission automatique |
| Escrow | ❌ | Absent |
| Reviews réels | ❌ | 0 avis |
| Dispute resolution | ❌ | Absent |

**Dépendances bloquantes :** Stripe Connect avant tout revenu réel. Vrais experts avant toute mission réelle.

---

### Pilier 2 — AI Workforce
**Avancement : 15%**

| Composant | État | Notes |
|-----------|------|-------|
| UI agents (4 agents) | ✅ | Shell visuel |
| Backend agents | ❌ | Non implémenté |
| Mémoire agents | ❌ | Absent |
| Tool use réel | ❌ | Absent |
| Orchestration | ❌ | Absent |
| Monitoring agents | ❌ | Absent |

**Réalité actuelle :** Les agents sont des formulaires qui appellent Claude. Pas des employés IA.
**Chemin critique :** Implémenter 1 vrai agent opérationnel (Support) avant d'en promettre 4.

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
**Avancement : 40%**

| Composant | État | Notes |
|-----------|------|-------|
| Stats cards | ✅ | Count basique |
| Approbation experts | ✅ | Fonctionnel |
| CRM onglet | ✅ | Basique |
| Gestion missions | ✅ | Liste + actions |
| Auth sécurisée | ❌ | Email hardcodé — CRITIQUE |
| Analytics réels | ❌ | Pas de graphiques |
| Monitoring agents IA | ❌ | Absent |
| Logs d'actions | ❌ | Absent |
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
| RLS absent tables core | 🔴 CRITIQUE | Non corrigé |
| CSP unsafe-eval | 🟠 ÉLEVÉ | Non corrigé |
| Clés API env.local | 🟠 ÉLEVÉ | À surveiller |
| Headers Cloudflare | ✅ | Configurés |
| RLS blog tables | ✅ | Actif |

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

## PRIORITÉS IMMÉDIATES (Sprint 1 — Semaines 1-2)

### 🔴 Bloquants critiques (sécurité)
1. Corriger RLS sur `users`, `missions`, `crm_contacts`, `approvals`
2. Remplacer email admin hardcodé par rôle en base de données
3. Vérifier et recharger le solde Anthropic API

### 🟠 Indispensables (valeur produit)
4. Implémenter Stripe Connect pour commissions marketplace
5. ~~Ajouter empty states dans dashboard client et expert~~ ✅
6. Onboarding guidé post-inscription (checklist 3 étapes)

### 🟡 Importants (crédibilité)
7. Recruter 5 vrais experts (processus de vetting manuel)
8. Produire 1 cours complet Academy (formateur Rose — Marketing IA)
9. Migrer progression Academy localStorage → Supabase

---

## PRIORITÉS SPRINT 2 (Semaines 3-6)

- Implémenter 1 vrai agent IA (Support Agent avec mémoire + tool use)
- Analytics CEO : MRR, missions en cours, revenus, graphiques
- Logs d'actions admin
- Monitoring n8n (alertes si workflow tombe)
- Tests E2E flux critique (inscription → paiement → livraison)

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

---

*Ce document est la propriété de CreatorFlow Market. Il doit être lu avant chaque session de développement.*
