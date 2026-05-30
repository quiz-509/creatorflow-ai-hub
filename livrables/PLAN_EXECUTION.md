# CreatorFlow Market — Plan d'exécution MVP

**Objectif :** Passer d'un prototype à une plateforme utilisable par de vrais utilisateurs.  
**Méthode :** Analyse ligne par ligne du code source. Aucune théorie. Tout est précis et actionnable.

---

## État réel du code (vérification directe)

Avant tout plan, voici ce qui est **vraiment** implémenté vs ce qui est **fiction** :

| Fonctionnalité | Fichier | État réel |
|---|---|---|
| Auth (inscr./connexion/logout) | `connexion.html`, `inscription.html` | ✅ Fonctionnel Supabase |
| Dashboard client | `dashboard-client.html` | ✅ Données réelles Supabase |
| Dashboard expert | `dashboard-expert.html` | ✅ Données réelles Supabase |
| Dépôt de brief | `nouveau-brief.html` | ✅ Insert en base |
| Soumission de proposition | `dashboard-expert.html` modal | ✅ Insert `propositions` |
| Acceptation proposition | `dashboard-client.html` bouton | ✅ Update `propositions.statut` |
| Messagerie texte réel | `messages.html` | ✅ Supabase Realtime actif |
| Chargement conversations | `messages.html` | ✅ Fetch profiles + last message |
| Annuaire experts | `experts.html` | ❌ 100% mock (tableau EXPERTS) |
| Profils experts | `profil-expert.html` | ❓ Non vérifié (probablement mock) |
| Création de conversation | Aucun fichier | ❌ N'existe pas |
| Création de mission | Aucun fichier | ❌ N'existe pas automatiquement |
| Paiement | `paiement.html` | ❌ UI only, zéro backend |
| Academy enrollment | `academie.html`, `lecteur.html` | ❌ 100% mock/GSAP |
| Progression cours | `lecteur.html` | ❌ Mock |
| Système de reviews | Aucun fichier | ❌ Affiché seulement |
| Navigation mobile (dashboards) | `dashboard-*.html` | ❌ Sidebar cachée, pas de hamburger |
| Redirect connexion correcte | `connexion.html` ligne 92 | ❌ Toujours → expert |

---

## Les 10 fonctionnalités critiques classées par impact business

---

### #1 — Correction de la redirection à la connexion

**Pourquoi critique :** Tous les clients existants sont redirigés vers le dashboard expert. 100% des clients ont une expérience cassée dès la connexion.

**Effort :** 30 minutes  
**Impact utilisateur :** Bloquant pour tous les clients  
**Impact revenus :** Bloquant — un client qui atterrit sur le dashboard expert abandonne

**Fichier :** `connexion.html`  
**Ligne exacte :** 92  
**Ce qui existe :**
```js
if (data.session) window.location.href = 'dashboard-expert.html';
```
**Ce qui doit remplacer :**
```js
if (data.session) {
  const { data: profile } = await sb.from('profiles')
    .select('type_utilisateur').eq('id', data.session.user.id).single();
  window.location.href = profile?.type_utilisateur === 'client' 
    ? 'dashboard-client.html' : 'dashboard-expert.html';
}
```
**Table Supabase :** `profiles` (colonne `type_utilisateur` — déjà utilisée ligne 119 dans le même fichier)

---

### #2 — Annuaire experts connecté à Supabase

**Pourquoi critique :** C'est le produit principal visible. Un visiteur clique sur "Experts", voit 9 profils Unsplash hardcodés sans rapport avec la réalité. Si des vrais experts s'inscrivent, ils n'apparaissent pas. La marketplace n'existe pas.

**Effort :** 4-6 heures  
**Impact utilisateur :** Bloquant — le cœur de la marketplace est fictif  
**Impact revenus :** Bloquant — aucun client ne peut trouver un vrai expert

**Fichier :** `experts.html`  
**Ce qui existe :** Tableau `EXPERTS` hardcodé lignes 174-183, 9 profils fictifs  
**Ce qui doit le remplacer :**
```js
// Remplacer le tableau EXPERTS par :
const { data: experts } = await sb
  .from('profiles')
  .select('id, prenom, nom, bio, specialite, niveau, photo_url')
  .eq('type_utilisateur', 'expert')
  .order('created_at', { ascending: false });
```
**Tables Supabase :**
- `profiles` — colonnes nécessaires : `id`, `prenom`, `nom`, `bio`, `specialite`, `photo_url`, `type_utilisateur`
- `experts` — colonnes nécessaires : `id`, `tarif_horaire`, `note_moyenne`, `nb_avis`, `disponible`, `tags`

**Colonnes manquantes probables dans `profiles` :** `photo_url`, `specialite`  
**Colonnes manquantes probables dans `experts` :** `note_moyenne`, `nb_avis`, `tags` (tableau), `disponible`

**Migration Supabase à exécuter :**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS specialite TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS note_moyenne DECIMAL(3,2) DEFAULT 0;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS nb_avis INTEGER DEFAULT 0;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE experts ADD COLUMN IF NOT EXISTS disponible BOOLEAN DEFAULT true;
```

---

### #3 — Création automatique de mission + conversation à l'acceptation d'une proposition

**Pourquoi critique :** Quand un client clique "Accepter" dans son dashboard, le code fait seulement `UPDATE propositions SET statut='acceptee'`. Il ne crée pas de mission, pas de conversation. Le workflow s'arrête là. L'expert n'est jamais notifié. La relation client-expert ne peut pas commencer.

**Effort :** 3-4 heures  
**Impact utilisateur :** Bloquant — le workflow core de la marketplace est mort après l'acceptation  
**Impact revenus :** Bloquant — sans mission créée, le paiement n'a pas de référence

**Fichier :** `dashboard-client.html`  
**Lignes 453-457 — Ce qui existe :**
```js
onClick={async()=>{
  await sb.from('propositions').update({statut:'acceptee'}).eq('id',p.id);
  setPropositions(prev=>prev.map(x=>x.id===p.id?{...x,statut:'acceptee'}:x));
}}
```
**Ce qui doit le remplacer :**
```js
onClick={async()=>{
  // 1. Accepter la proposition
  await sb.from('propositions').update({statut:'acceptee'}).eq('id',p.id);
  
  // 2. Créer la mission
  const { data: mission } = await sb.from('missions').insert({
    client_id: user.id,
    expert_id: p.expert_id,
    brief_id: p.brief_id,
    titre: p.objet || 'Mission',
    prix: p.montant,
    delai: p.delai,
    statut: 'nouveau',
    progression: 0,
  }).select().single();
  
  // 3. Créer la conversation liée
  if (mission) {
    await sb.from('conversations').insert({
      client_id: user.id,
      expert_id: p.expert_id,
      mission_id: mission.id,
    });
  }
  
  setPropositions(prev=>prev.map(x=>x.id===p.id?{...x,statut:'acceptee'}:x));
}}
```
**Tables Supabase :**
- `missions` — colonnes : `id`, `client_id`, `expert_id`, `brief_id`, `titre`, `prix`, `delai`, `statut`, `progression`, `created_at`
- `conversations` — colonnes : `id`, `client_id`, `expert_id`, `mission_id`, `created_at`

**Migration Supabase :**
```sql
ALTER TABLE missions ADD COLUMN IF NOT EXISTS brief_id UUID REFERENCES briefs(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id);
```

---

### #4 — Navigation mobile fonctionnelle sur les dashboards

**Pourquoi critique :** ~60% du trafic web est mobile. La sidebar est cachée par `transform: translateX(-100%)` dans les deux dashboards, avec aucun bouton pour l'ouvrir. Un utilisateur mobile ne peut pas naviguer dans son dashboard.

**Effort :** 1-2 heures  
**Impact utilisateur :** Bloquant sur mobile (majorité des utilisateurs)  
**Impact revenus :** Direct — acquisition mobile impossible

**Fichiers :** `dashboard-client.html`, `dashboard-expert.html`  
**Ce qui manque :** Un bouton hamburger dans la nav + un state `sidebarOpen` + un overlay de fermeture

**Dans les deux fichiers, ajouter dans le composant `App` :**
```js
const [sidebarOpen, setSidebarOpen] = useState(false);
```

**Dans le JSX de la nav (ajouter après `.nav-right`) :**
```jsx
<button className="hamburger" onClick={() => setSidebarOpen(s => !s)}>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
</button>
```

**Modifier la sidebar :**
```jsx
<aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
```

**CSS à ajouter :**
```css
.hamburger { display:none; width:36px; height:36px; border-radius:8px; background:var(--surf); border:1px solid var(--border-2); align-items:center; justify-content:center; color:var(--text-2); }
@media(max-width:768px) {
  .hamburger { display:flex; }
  .sidebar { transform:translateX(-100%); transition:transform 280ms var(--ease); }
  .sidebar.open { transform:translateX(0); }
}
```

---

### #5 — Intégration paiement Stripe

**Pourquoi critique :** Sans paiement réel, CreatorFlow Market ne peut pas générer un seul euro de revenu. `paiement.html` est une maquette sans aucun backend. Le bouton "Confirmer le paiement" ne fait rien.

**Effort :** 8-12 heures (Stripe Checkout est le chemin le plus rapide)  
**Impact utilisateur :** Bloquant — aucune transaction possible  
**Impact revenus :** Critique — c'est le seul moyen de monétiser

**Fichier :** `paiement.html` + nécessite une **Supabase Edge Function**

**Architecture recommandée (Stripe Checkout) :**

**Étape 1 — Supabase Edge Function** `create-checkout-session` :
```typescript
// supabase/functions/create-checkout-session/index.ts
import Stripe from 'stripe';
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const { mission_id, amount, client_id } = await req.json();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: {
      currency: 'cad',
      product_data: { name: 'Mission CreatorFlow Market' },
      unit_amount: amount * 100,
    }, quantity: 1 }],
    mode: 'payment',
    success_url: `${origin}/paiement-succes.html?mission_id=${mission_id}`,
    cancel_url: `${origin}/paiement.html`,
    metadata: { mission_id, client_id },
  });
  return new Response(JSON.stringify({ url: session.url }));
});
```

**Étape 2 — Modifier `paiement.html`** : remplacer le bouton "Confirmer" par :
```js
const handlePay = async () => {
  const { data, error } = await sb.functions.invoke('create-checkout-session', {
    body: { mission_id: missionId, amount: montant, client_id: user.id }
  });
  if (!error) window.location.href = data.url;
};
```

**Tables Supabase :**
- `paiements` (à créer) : `id`, `mission_id`, `client_id`, `expert_id`, `montant`, `stripe_session_id`, `statut`, `created_at`

**Migration Supabase :**
```sql
CREATE TABLE paiements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id),
  client_id UUID REFERENCES profiles(id),
  expert_id UUID REFERENCES profiles(id),
  montant INTEGER NOT NULL,
  stripe_session_id TEXT,
  statut TEXT DEFAULT 'en_attente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### #6 — Academy enrollment fonctionnel

**Pourquoi critique :** `academie.html` est entièrement GSAP + données hardcodées. Un utilisateur ne peut pas s'inscrire à un cours. La progression n'est jamais sauvegardée. C'est un pilier de revenus entièrement fictif.

**Effort :** 6-10 heures  
**Impact utilisateur :** Bloquant — aucune valeur délivrée sur ce pilier  
**Impact revenus :** Majeur — second flux de revenus après la marketplace

**Fichiers :** `academie.html`, `cours.html`, `lecteur.html`

**Tables Supabase à créer :**
```sql
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  instructeur_id UUID REFERENCES profiles(id),
  prix INTEGER DEFAULT 0,
  categorie TEXT,
  niveau TEXT,
  image_url TEXT,
  nb_inscrits INTEGER DEFAULT 0,
  publié BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  course_id UUID REFERENCES courses(id),
  progression INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE TABLE lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id),
  titre TEXT NOT NULL,
  contenu TEXT,
  video_url TEXT,
  ordre INTEGER,
  duree_minutes INTEGER
);

CREATE TABLE lesson_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  lesson_id UUID REFERENCES lessons(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);
```

**Changements dans `academie.html` :**
- Remplacer les cours hardcodés par `sb.from('courses').select('*').eq('publié', true)`
- Bouton "S'inscrire" → `sb.from('enrollments').insert({ user_id, course_id, progression: 0 })`

**Changements dans `lecteur.html` :**
- Sauvegarder la completion : `sb.from('lesson_completions').insert({ user_id, lesson_id })`
- Mettre à jour la progression : `sb.from('enrollments').update({ progression: newPct }).eq('user_id', uid).eq('course_id', cid)`

---

### #7 — Système de reviews fonctionnel

**Pourquoi critique :** Les étoiles sont affichées partout sur la plateforme mais aucun utilisateur ne peut en soumettre. Les notes sont fictives (ex: 4.9 hardcodé). Dans une marketplace, les avis sont le mécanisme de confiance #1. Sans eux, les experts sont tous égaux et personne ne peut faire confiance à personne.

**Effort :** 4-6 heures  
**Impact utilisateur :** Élevé — décision d'achat directement impactée  
**Impact revenus :** Élevé — conversion +30-40% avec de vraies reviews

**Fichiers :** `rapport-mission.html`, `profil-expert.html`, `experts.html`

**Tables Supabase à créer :**
```sql
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id),
  client_id UUID REFERENCES profiles(id),
  expert_id UUID REFERENCES profiles(id),
  note INTEGER CHECK(note >= 1 AND note <= 5),
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mission_id, client_id)
);
```

**Trigger Supabase pour mettre à jour `experts.note_moyenne` :**
```sql
CREATE OR REPLACE FUNCTION update_expert_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE experts
  SET note_moyenne = (SELECT AVG(note) FROM reviews WHERE expert_id = NEW.expert_id),
      nb_avis = (SELECT COUNT(*) FROM reviews WHERE expert_id = NEW.expert_id)
  WHERE id = NEW.expert_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_review_insert
AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION update_expert_rating();
```

**Dans `rapport-mission.html` :** ajouter un bloc de notation (étoiles cliquables) + `sb.from('reviews').insert({ mission_id, client_id, expert_id, note, commentaire })`

**Dans `profil-expert.html` :** remplacer les notes hardcodées par `sb.from('reviews').select('*').eq('expert_id', id)`

---

### #8 — Page de pricing

**Pourquoi critique :** Sans page de pricing, aucun visiteur ne peut évaluer si la plateforme est accessible pour lui. C'est un frein de conversion numéro 1. Il n'y a pas besoin de créer un fichier complexe, juste d'afficher la structure tarifaire clairement.

**Effort :** 2-3 heures  
**Impact utilisateur :** Élevé — bloquant pour la décision d'achat  
**Impact revenus :** Très élevé — aucun funnel de conversion ne fonctionne sans pricing transparent

**Fichier à créer :** `pricing.html`

**Contenu minimum à définir avant développement :**
- Commission plateforme sur les missions (ex : 10-15%)
- Tarif Academy (par cours ou abonnement mensuel)
- Plans experts (gratuit vs premium)
- Garanties (satisfait ou remboursé ?)

**Liens à ajouter :** dans `index.html` mega-menu, dans `inscription.html` sidebar, dans les dashboards

---

### #9 — Profil expert avec données réelles

**Pourquoi critique :** `profil-expert.html` est la page de décision d'un client avant de contacter un expert. Si les données sont fictives ou génériques, la décision ne peut pas se faire. C'est la page de conversion la plus importante de la marketplace.

**Effort :** 3-4 heures  
**Impact utilisateur :** Bloquant — les clients ne peuvent pas évaluer un vrai expert  
**Impact revenus :** Direct sur la conversion brief → proposition

**Fichier :** `profil-expert.html`

**Ce qui doit être chargé depuis Supabase :**
```js
// Récupérer l'ID depuis l'URL : ?id=UUID
const expertId = new URLSearchParams(window.location.search).get('id');

const { data: profile } = await sb.from('profiles').select('*').eq('id', expertId).single();
const { data: expert } = await sb.from('experts').select('*').eq('id', expertId).single();
const { data: reviews } = await sb.from('reviews').select('*, profiles(prenom, nom)').eq('expert_id', expertId).order('created_at', { ascending: false }).limit(10);
const { data: missions } = await sb.from('missions').select('id, titre, statut').eq('expert_id', expertId).eq('statut', 'termine').limit(5);
```

**Lien depuis `experts.html` :**
Dans `experts.html`, le bouton "Voir le profil" doit pointer vers `profil-expert.html?id=${expert.id}` (actuellement le tableau mock n'a pas d'UUIDs Supabase).

---

### #10 — CGU et Politique de confidentialité

**Pourquoi critique :** Obligation légale au Québec (Loi 25 / Loi sur la protection des renseignements personnels). Tout formulaire qui collecte un email, un nom, ou une donnée personnelle sans politique de confidentialité rend le site non-conforme et expose à des sanctions. De plus, sans CGU, la plateforme n't a aucune protection juridique en cas de litige client-expert.

**Effort :** 2-3 heures (rédaction + intégration)  
**Impact utilisateur :** Légal — non-conformité = risque réel  
**Impact revenus :** Confiance — les professionnels vérifient l'existence de ces pages avant de signer

**Fichiers à créer :** `cgu.html`, `politique-confidentialite.html`

**Liens à ajouter :**
- Footer de `index.html`, `inscription.html`, `connexion.html`
- Case à cocher dans `inscription.html` : "J'accepte les CGU et la politique de confidentialité"

---

## Roadmap d'exécution

---

### Phase 1 — MVP Utilisable (Semaine 1-2)
**Objectif :** Un vrai client peut trouver un expert réel, envoyer un brief, recevoir une proposition, l'accepter, et commencer à communiquer.

| # | Tâche | Fichier | Durée |
|---|---|---|---|
| 1 | Fix redirect connexion | `connexion.html` L.92 | 30 min |
| 2 | Hamburger mobile dashboards | `dashboard-client.html`, `dashboard-expert.html` | 1h |
| 3 | Annuaire experts → Supabase | `experts.html` | 4h |
| 4 | Création mission + conversation à l'acceptation | `dashboard-client.html` | 3h |
| 5 | Profil expert avec données réelles | `profil-expert.html` | 4h |
| 6 | Migration Supabase (colonnes manquantes) | Console Supabase | 1h |
| 7 | CGU + Politique confidentialité | Nouveaux fichiers | 3h |

**Total Phase 1 :** ~16 heures de développement

**Critère de succès :** Un utilisateur peut créer un compte, trouver un vrai expert, déposer un brief, recevoir une proposition, l'accepter, voir la mission créée et envoyer un premier message.

---

### Phase 2 — Marketplace Crédible (Semaine 3-5)
**Objectif :** Le cycle complet fonctionne : brief → proposition → mission → paiement → review.

| # | Tâche | Fichier | Durée |
|---|---|---|---|
| 8 | Intégration Stripe Checkout | `paiement.html` + Edge Function | 10h |
| 9 | Page de pricing | `pricing.html` | 3h |
| 10 | Système de reviews | `rapport-mission.html`, `profil-expert.html` | 6h |
| 11 | Notification email (Supabase Edge Functions + Resend) | Edge Functions | 8h |
| 12 | Academy enrollment + progression | `academie.html`, `cours.html`, `lecteur.html` | 8h |
| 13 | Mise à jour des stats landing (données réelles) | `index.html` | 2h |
| 14 | Workflow certification expert (statut + badge) | `inscription.html`, admin | 6h |

**Total Phase 2 :** ~43 heures de développement

**Critère de succès :** Un client peut payer une mission. Un expert reçoit un email de nouvelle opportunité. Un cours peut être acheté et suivi avec progression sauvegardée.

---

### Phase 3 — Marketplace Premium (Mois 2-3)
**Objectif :** Les mécanismes de croissance et de différenciation sont en place.

| # | Tâche | Description | Durée |
|---|---|---|---|
| 15 | Programme parrainage fonctionnel | Codes uniques + tracking + commission auto | 8h |
| 16 | Analytics expert (vues, conversion, revenus) | Nouveau tableau de bord expert enrichi | 10h |
| 17 | Matching IA sur les briefs | Embeddings + fonction de scoring expert/brief | 16h |
| 18 | Communauté / forum | Page discussions, Q&A par spécialité | 12h |
| 19 | Panel admin | Modération experts, suivi transactions, litiges | 20h |
| 20 | Recherche full-text | `recherche.html` connecté à Supabase full-text search | 4h |

**Total Phase 3 :** ~70 heures de développement

---

## Ce qui manque par pilier (précision technique)

---

### Expert Marketplace

**Manque :**
- Annuaire non connecté à Supabase
- Profil expert ne charge pas les données réelles
- Pas de création de conversation post-acceptation
- Pas de mission créée post-acceptation
- Reviews non soumissibles
- Disponibilité non persistée (toggle dans dashboard expert ne sauvegarde rien)

**Fichiers concernés :**
- `experts.html` — remplacer tableau `EXPERTS` par requête Supabase
- `profil-expert.html` — charger profil via `?id=` param
- `dashboard-client.html` — enrichir le handler "Accepter"
- `dashboard-expert.html` — persister le toggle disponibilité

**Tables Supabase concernées :** `profiles`, `experts`, `missions`, `conversations`, `reviews`

**API/Services :** Supabase Auth, Supabase Database, Supabase Realtime (messages déjà actif)

---

### Services Marketplace

**État :** Ce pilier annoncé sur la landing n'existe **pas** en tant que module distinct. Il n'y a pas de page `services.html`, pas de table `services`, pas de workflow distinct des missions.

**Manque :**
- Définir la différence entre "Expert" (profil freelance) et "Service" (prestation packagée avec prix fixe)
- Créer `services.html` (catalogue de services packagés)
- Créer `service-detail.html` (achat direct, sans brief)
- Table `services` : `id`, `expert_id`, `titre`, `description`, `prix`, `delai`, `categorie`

**Fichiers à créer :** `services.html`, `service-detail.html`

**Tables Supabase à créer :**
```sql
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expert_id UUID REFERENCES profiles(id),
  titre TEXT NOT NULL,
  description TEXT,
  prix INTEGER NOT NULL,
  delai TEXT,
  categorie TEXT,
  inclus TEXT[],
  nb_commandes INTEGER DEFAULT 0,
  publié BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE commandes_service (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES services(id),
  client_id UUID REFERENCES profiles(id),
  expert_id UUID REFERENCES profiles(id),
  statut TEXT DEFAULT 'en_attente',
  prix INTEGER,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Academy

**État :** `academie.html` est entièrement GSAP/mock. `cours.html` et `lecteur.html` sont des maquettes statiques. `creer-cours.html` existe mais n'insère rien en base.

**Manque :**
- Tables `courses`, `lessons`, `enrollments`, `lesson_completions` inexistantes en base
- `academie.html` ne charge pas de cours depuis Supabase
- `cours.html` ne charge pas les modules/leçons depuis Supabase
- `lecteur.html` ne sauvegarde pas la progression
- `creer-cours.html` ne soumet pas de cours en base
- Pas de paiement de cours (séparé de la marketplace)

**Fichiers concernés :**
- `academie.html` — fetch `courses` depuis Supabase + bouton enrollment
- `cours.html` — fetch `courses` + `lessons` depuis Supabase
- `lecteur.html` — fetch leçon + save `lesson_completions` + update `enrollments.progression`
- `creer-cours.html` — insert `courses` + `lessons`

**Tables Supabase à créer :** `courses`, `lessons`, `enrollments`, `lesson_completions` (voir SQL section #6)

**API :** Supabase Storage (pour les vidéos/fichiers de cours)

---

### Ressources

**État :** `blog.html` existe avec des articles hardcodés. Pas de CMS, pas de table.

**Manque :**
- Table `articles` non créée (ou vide)
- `blog.html` n'utilise pas Supabase
- Pas de page d'article individuel
- Pas de système de tags/catégories dynamique

**Fichiers concernés :**
- `blog.html` — fetch `articles` depuis Supabase

**Fichiers à créer :** `article.html` (détail d'un article)

**Tables Supabase à créer :**
```sql
CREATE TABLE articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  contenu TEXT,
  auteur_id UUID REFERENCES profiles(id),
  categorie TEXT,
  tags TEXT[],
  image_url TEXT,
  publié BOOLEAN DEFAULT false,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Communauté

**État :** Le pilier n'existe pas. `programme-parrainage.html` est statique. Aucune page communautaire n'est développée.

**Manque :** Tout est à créer.

**Fichiers à créer :**
- `communaute.html` — fil de discussions, questions/réponses
- `fil-discussion.html` — thread individuel

**Tables Supabase à créer :**
```sql
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auteur_id UUID REFERENCES profiles(id),
  titre TEXT NOT NULL,
  contenu TEXT,
  categorie TEXT,
  tags TEXT[],
  nb_vues INTEGER DEFAULT 0,
  nb_reponses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reponses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  auteur_id UUID REFERENCES profiles(id),
  contenu TEXT NOT NULL,
  is_solution BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Résumé exécutif

| Phase | Durée | Résultat |
|---|---|---|
| **Phase 1** | 2 semaines | Flux principal fonctionnel — vrais experts, vrais briefs, vraie messagerie |
| **Phase 2** | 3-4 semaines | Cycle complet — paiement, reviews, academy, emails |
| **Phase 3** | 6-8 semaines | Différenciation — matching IA, analytics, communauté, admin |

**Ordre de priorité absolu (par impact/effort) :**
1. Fix redirect connexion (30 min, impact critique)
2. Hamburger mobile (1h, 60% des utilisateurs)
3. Annuaire experts → Supabase (4h, cœur du produit)
4. Création mission + conversation (3h, workflow core)
5. Stripe Checkout (10h, premier revenu)

Ces 5 items représentent ~19 heures de travail et transforment le prototype en un produit testable avec de vrais utilisateurs.
