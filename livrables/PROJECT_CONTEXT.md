# PROJECT_CONTEXT.md — CreatorFlow Market
> Source de vérité du projet. Dernière mise à jour : 2026-06-15.

---

## 1. VISION DU PROJET

CreatorFlow Market est une **marketplace hybride** combinant :
- Des **experts humains certifiés** en intelligence artificielle
- Des **employés IA virtuels** (AI Workforce) qui automatisent certaines tâches

**Mission** : Connecter entreprises et créateurs avec les meilleurs talents IA — humains ou virtuels — pour accélérer leur croissance.

**Public cible** : Entrepreneurs, PME, créateurs francophones cherchant expertise et automatisation IA.

**Domaine** : creatorflowmarket.com

**Admin / CEO** : pjoacenel@gmail.com

---

## 2. ARCHITECTURE ACTUELLE

### Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | HTML/CSS + React 18 UMD (sans JSX, sans Babel) |
| CSS | design-system.css + `<style>` inline par page |
| Base de données | Supabase (PostgreSQL + Auth + RLS) |
| Edge Functions | Supabase Edge Functions (Deno/TypeScript) |
| Paiements | Stripe Checkout Sessions (CAD) |
| Emails | Resend (domaine : creatorflowmarket.com) |
| Blog engine | Next.js 14 + Anthropic Claude API (app séparée) |
| Déploiement | Cloudflare Pages (auto-deploy, branch : main) |
| Repository | github.com/quiz-509/creatorflow-ai-hub |
| Analytics | GA4 (G-GPSF5ZNZMF) + Consent Mode v2 |

### Identifiants Supabase

- **URL** : https://cjtglfutckaogsmwhfsv.supabase.co
- **Anon Key** : sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei
- **Sécurité** : RLS activé sur toutes les tables sensibles

### Principe React

Chaque page HTML est **standalone** : React est chargé via CDN unpkg, aucune compilation. Les composants sont écrits avec `React.createElement()` directement. Pas de JSX, pas de Next.js côté frontend public.

---

## 3. STRUCTURE DES DOSSIERS

```
livrables/
├── sites-web/               # Toutes les pages HTML (Cloudflare Pages)
│   ├── design-system.css    # Design system global partagé
│   ├── analytics.js         # GA4 + Consent Mode v2
│   ├── cookie-banner.js     # Bannière cookies RGPD
│   ├── _redirects           # Config Cloudflare Pages
│   ├── [pages].html         # Toutes les pages (voir section 4)
│   └── functions/           # Cloudflare Pages Functions (blog)
├── supabase/
│   └── functions/
│       ├── create-checkout-session/index.ts
│       └── send-email/index.ts
├── blog-engine/             # App Next.js génération articles IA
│   ├── src/lib/ai-writer.ts
│   ├── src/lib/news-monitor.ts
│   └── src/app/api/monitor/route.ts
└── PROJECT_CONTEXT.md       # Ce fichier
```

---

## 4. PAGES EXISTANTES

### Pages publiques

| Page | Fichier | Description |
|------|---------|-------------|
| Accueil | index.html | Landing page principale |
| Marketplace | experts.html | Liste experts filtrables |
| Profil expert | profil-expert.html | Fiche détaillée expert |
| Recrutement | landing-expert.html | Page pour devenir expert |
| Brief | brief.html | Créer un brief projet |
| Nouveau brief | nouveau-brief.html | Formulaire brief complet |
| Paiement | paiement.html | Checkout Stripe + succès |
| Académie | academie.html | Catalogue de cours IA |
| Cours | cours.html | Lecteur de cours |
| Blog | blog.html | Liste articles |
| Article | blog-article.html | Article individuel |
| Catégorie | blog-category.html | Articles par catégorie |
| Recherche | recherche.html | Recherche globale |
| Pricing | pricing.html | Tarifs et abonnements |
| Parrainage | programme-parrainage.html | Programme affilié |
| CGU | cgu.html | Conditions d'utilisation |
| Confidentialité | politique-confidentialite.html | Politique vie privée |
| 404 | 404.html | Page d'erreur |

### Pages authentifiées

| Page | Fichier | Rôle requis |
|------|---------|-------------|
| Dashboard client | dashboard-client.html | client |
| Dashboard expert | dashboard-expert.html | expert |
| Mission (chat) | mission.html | client + expert |
| Messages | messages.html | tous |
| Notifications | notifications.html | tous |
| Rapport mission | rapport-mission.html | client + expert |
| Lecteur vidéo | lecteur.html | inscrit |
| Créer cours | creer-cours.html | expert |
| Profil | profil.html | tous |
| Paramètres | parametres.html | tous |
| Onboarding | onboarding.html | nouveau utilisateur |
| Connexion | connexion.html | public |
| Inscription | inscription.html | public |

### Pages admin (CEO uniquement)

| Page | Fichier | Description |
|------|---------|-------------|
| Panel admin | admin.html | Tabs : dashboard, experts, users, missions, payments, blog |
| Créer expert | admin-creer-expert.html | Création manuelle d'expert |

---

## 5. TABLES SUPABASE

### Tables existantes (confirmées)

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| profiles | Profils utilisateurs | id, prenom, nom, email, photo_url, role (client/expert) |
| experts | Profils experts IA | id, specialite, bio, tarif_heure, competences[], categories[], statut (approved/pending), disponible, note_moyenne, nb_avis |
| missions | Missions actives | id, client_id, expert_id, titre, categorie, prix, statut, progression, created_at |
| briefs | Briefs clients | id, client_id, categorie, description, budget, statut (ouvert/ferme) |
| propositions | Propositions experts | id, expert_id, brief_id, montant, delai, message, statut (en_attente/acceptee/refusee) |
| conversations | Fils de discussion | id, client_id, expert_id, mission_id |
| messages | Messages mission | id, conversation_id, sender_id, contenu, created_at |
| academy_enrollments | Inscriptions cours | id, user_id, course_id, created_at |
| academy_courses | Cours disponibles | id, titre, description, prix, niveau, duree |
| blog_articles | Articles blog | id, title, slug, content, category, status (published/draft), created_at |
| blog_subscribers | Abonnés newsletter | id, email, created_at |
| reviews | Avis experts | id, expert_id, client_id, note, commentaire |

### Tables non existantes (à créer pour AI Workforce)

| Table | Description |
|-------|-------------|
| ai_agents | Configuration et état des 4 agents IA |
| ai_tasks | Historique des tâches exécutées par les agents |

---

## 6. APIs EXISTANTES

### Supabase Edge Functions

| Fonction | URL | Input | Output |
|----------|-----|-------|--------|
| create-checkout-session | /functions/v1/create-checkout-session | `{ mission_id, amount_cents, mission_titre, success_url, cancel_url }` | `{ url: stripe_checkout_url }` |
| send-email | /functions/v1/send-email | `{ type, to, data }` | `{ ok: true }` |

### Templates email (send-email)

| Type | Déclencheur | Destinataire |
|------|------------|--------------|
| nouvelle_proposition | Expert postule sur brief | Client |
| proposition_acceptee | Client accepte proposition | Expert |
| paiement_confirme | Paiement Stripe succès | Client + Expert |
| nouveau_message | Nouveau message mission | Destinataire |

### APIs externes utilisées

| Service | Usage | Env var |
|---------|-------|---------|
| Stripe | Paiements CAD | STRIPE_SECRET_KEY |
| Resend | Emails transactionnels | RESEND_API_KEY |
| Anthropic Claude | Génération articles blog | ANTHROPIC_API_KEY (blog-engine) |
| Google Analytics | Tracking GA4 | Hardcodé : G-GPSF5ZNZMF |

---

## 7. FONCTIONNALITÉS TERMINÉES

- **Auth** : inscription, connexion, onboarding, profil, paramètres
- **Marketplace** : listing experts, filtres (catégorie, budget, disponibilité, tri), profil détaillé
- **Workflow mission** : brief → proposition → acceptation → paiement → mission active → messagerie → rapport
- **Paiement Stripe** : checkout CAD, succès par redirect `?payment=success`, mise à jour statut mission
- **Emails** : 4 types transactionnels (Resend), templates HTML branded dark theme
- **Académie** : catalogue cours, inscriptions, lecteur
- **Blog** : génération automatique articles par IA (Claude), stockage Supabase
- **Admin panel** : 6 tabs (dashboard, experts, users, missions, payments, blog)
- **SEO** : meta tags, Open Graph, Twitter Card, schema.org, sitemap
- **Analytics** : GA4 + Consent Mode v2 + bannière cookies RGPD
- **Légal** : CGU, politique de confidentialité
- **Responsive** : breakpoints 1024/980/768/640/480px
- **Programme de parrainage** : page dédiée
- **Loading states** : skeletons (ds-sk) sur experts, académie, profil
- **Empty states** : ds-empty sur toutes les pages sans données

---

## 8. FONCTIONNALITÉS EN COURS

- **AI Workforce** : département de 4 agents IA (Marketing, Content, Prospecting, Support)
  - Tables Supabase à créer
  - Tab admin à ajouter dans admin.html
  - Edge Function ai-agent à créer
  - Page publique optionnelle

---

## 9. FONCTIONNALITÉS PRÉVUES

- **AI Workforce — Phase 2** : Edge Function `ai-agent` (routeur Claude/OpenAI)
- **AI Workforce — Phase 3** : Page publique `ai-workforce.html` pour les clients
- **Mentions légales** : page dédiée (actuellement inline dans CGU)
- **Webhook Stripe** : optionnel pour fiabiliser la détection paiement

---

## 10. DÉCISIONS TECHNIQUES IMPORTANTES

### React UMD sans JSX
Chaque page charge React 18 via CDN. Les composants utilisent `React.createElement()`. Cette approche évite tout tooling (Webpack, Vite, Babel) et permet le déploiement direct sur Cloudflare Pages sans build step.

### Stripe : redirect-based, pas de webhook
La détection du succès paiement se fait via le query param `?payment=success` dans l'URL de retour Stripe. Quand Stripe redirige vers `paiement.html?mission_id=X&payment=success`, le code client met à jour la mission et envoie les emails. Valide pour MVP.

### Statut mission : en_attente_paiement → en_cours
Depuis le 2026-06-15 : quand un client accepte une proposition, la mission est créée avec `statut: 'en_attente_paiement'` et le client est immédiatement redirigé vers `paiement.html`. Après paiement confirmé, le statut passe à `'en_cours'`.

### Admin : protection par email
L'accès admin est protégé par `email === 'pjoacenel@gmail.com'` côté client. La sécurité réelle est assurée par les RLS Supabase.

### Pattern tab admin
Ajouter un tab dans admin.html = 3 opérations :
1. Ajouter `{ id, label, icon }` dans le tableau `items[]` du composant `Sidebar`
2. Ajouter `tabId: ComposantFonction` dans l'objet `tabs` du composant `App`
3. Écrire la fonction `NouveauTab()`

### Fichiers avec séquences `\x` (hex escapes)
Certains fichiers contiennent des caractères français stockés en hex (`\xE9` pour é, `\xF4` pour ô). L'Edit tool échoue sur ces fichiers. Utiliser PowerShell : `[System.IO.File]::ReadAllText` + `IndexOf` + `Substring` + `WriteAllText`.

### Gestion des `overflow-x`
`overflow-x:hidden` doit être sur **à la fois** `html` ET `body` pour fonctionner sur tous les navigateurs.

---

## 11. CONVENTIONS DU PROJET

### CSS / Design

| Token | Valeur | Usage |
|-------|--------|-------|
| --bg | #04040A | Fond principal |
| --surf | #0C0C18 | Surface cards |
| --surf-2 | #101020 | Surface secondaire |
| --v | #7C3AED | Violet principal |
| --vs | #A78BFA | Violet clair |
| --c | #06B6D4 | Cyan accent |
| --green | #10B981 | Succès |
| --amber | #F59E0B | Avertissement |
| --red | #EF4444 | Erreur |
| --text | #F4F4FF | Texte principal |
| --text-2 | #9898B8 | Texte secondaire |
| --text-3 | #55557A | Texte tertiaire |

### Fonts

- **Titres** : Plus Jakarta Sans (700/800)
- **Corps** : Inter (400/500/600)

### Composants réutilisables (CSS classes)

| Classe | Usage |
|--------|-------|
| `.stat-card` | Carte statistique avec icône |
| `.section-card` | Container de section avec header |
| `.data-table` | Tableau de données stylé |
| `.badge-green/amber/red/purple/blue/gray` | Badges de statut |
| `.modal` + `.modal-overlay` | Modale avec backdrop |
| `.btn-approve` / `.btn-reject` | Boutons d'action admin |
| `.spin` | Spinner de chargement |
| `.ds-sk` + variantes | Skeletons loading |
| `.ds-empty` | État vide avec icône et texte |
| `.avail-dot-live` | Indicateur disponibilité animé |

### Langue
Le projet est **entièrement en français**. Toutes les interfaces, messages, emails et contenus sont en français canadien.

### Conventions de nommage (Supabase)
- Statuts mission : `en_attente_paiement`, `en_cours`, `en_revision`, `termine`, `annule`
- Statuts expert : `approved`, `pending`, `rejected`
- Statuts brief : `ouvert`, `ferme`
- Statuts proposition : `en_attente`, `acceptee`, `refusee`

### Règle de non-régression
Avant toute modification : lire le fichier, identifier ce qui fonctionne, ne modifier que ce qui est nécessaire. Aucune réécriture globale.
