---
name: blog-article-debug
description: Skill pour diagnostiquer et corriger les problèmes de chargement d'articles sur le blog de CreatorFlow Market. Activée quand l'utilisateur dit "article introuvable", "le blog ne charge pas", "les articles ne s'affichent pas", "debug le blog", ou demande explicitement cette skill.
---

# Skill : Debug Blog Articles CreatorFlow Market

## Mission

Diagnostiquer rapidement pourquoi un article de blog ne charge pas ou pourquoi la page affiche "Article introuvable", en vérifiant les 4 points de défaillance possibles dans l'ordre de probabilité.

---

## Architecture à connaître

```
URL visitée               Action
/blog                  →  blog.html (liste des articles, charge Supabase ou DEMO fallback)
/blog/:slug            →  functions/blog/[slug].js (Pages Function Cloudflare)
                               ↓
                          /blog-article?slug=SLUG (302 redirect)
                               ↓
                          blog-article.html (charge l'article depuis Supabase par slug)
```

**Fichiers clés :**
- `functions/blog/[slug].js` — routing Cloudflare
- `livrables/sites-web/_redirects` — NE DOIT PAS avoir de règle `/blog/:slug`
- `livrables/sites-web/blog.html` — liste des articles (Supabase + DEMO fallback)
- `livrables/sites-web/blog-article.html` — affichage d'un article
- `livrables/blog-engine/src/lib/ai-writer.ts` — générateur d'articles IA
- `livrables/blog-engine/sql/01-schema.sql` — schéma Supabase

**Supabase :**
- URL : `https://cjtglfutckaogsmwhfsv.supabase.co`
- Clé anon (frontend) : `sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei`
- Table : `blog_articles`, champ `status = 'published'` requis

---

## Phase 1 : Lire l'état actuel des fichiers

Lire dans cet ordre :
1. `functions/blog/[slug].js` — vérifier que la Function fait bien un 302 vers `/blog-article?slug=`
2. `livrables/sites-web/_redirects` — vérifier qu'il n'y a AUCUNE règle `/blog/:slug` (seulement des commentaires)
3. `livrables/sites-web/blog-article.html` — chercher la fonction `getSlug()` (ligne ~319) et la fonction qui charge l'article depuis Supabase

---

## Phase 2 : Diagnostiquer

### Point de défaillance 1 — Le routing (Pages Function)

**Symptôme :** L'URL finale est `/blog-article` sans `?slug=` dans la barre d'adresse.

**Causes possibles :**
- `_redirects` a une règle `/blog/:slug` qui écrase la Function (Cloudflare donne priorité à `_redirects`)
- La Function est absente ou mal nommée (doit être `functions/blog/[slug].js`)
- Cache navigateur sur l'ancienne redirect

**Test de vérification :**
- Tester en fenêtre Incognito sur une URL fraîche : `creatorflowmarket.com/blog/test-debug-123`
- Si l'URL devient `blog-article?slug=test-debug-123` → routing OK
- Si l'URL devient `blog-article` sans slug → routing cassé

**Fix routing cassé :**
- Vérifier que `_redirects` ne contient aucune règle active `/blog/:slug`
- Vérifier que `functions/blog/[slug].js` contient exactement :
  ```js
  export async function onRequest(context) {
    const url = new URL(context.request.url);
    const slug = context.params.slug;
    if (!slug) return Response.redirect(`${url.origin}/blog`, 302);
    return Response.redirect(`${url.origin}/blog-article?slug=${encodeURIComponent(slug)}`, 302);
  }
  ```

---

### Point de défaillance 2 — Le slug dans blog-article.html

**Symptôme :** L'URL est correcte (`?slug=...`) mais "Article introuvable" s'affiche quand même.

**Vérifier `getSlug()` dans blog-article.html :**
```js
const getSlug = () => {
  if (typeof window.__BLOG_SLUG__ === 'string' && window.__BLOG_SLUG__) return window.__BLOG_SLUG__;
  const qs = new URLSearchParams(window.location.search).get('slug');
  if (qs) return qs;
  const p = window.location.pathname;
  if (p.startsWith('/blog/') && p.length > 6) return p.slice(6).replace(/\/$/, '');
  return null;
};
```
Cette fonction est correcte si elle lit `?slug=` depuis l'URL. Si le slug est null, aucune requête Supabase n'est lancée.

---

### Point de défaillance 3 — Supabase : articles inexistants ou contrainte category

**Symptôme :** L'URL est correcte, le slug est lu, mais Supabase retourne 406 (Not Found) ou l'erreur "no rows returned".

**Cause probable 1 : Aucun article publié en base**
- Le blog affiche les données DEMO (slugs comme `claude-4-anthropic-revolution-llm-2026`) mais ces articles n'existent PAS dans Supabase
- L'AI writer génère des slugs avec timestamp : `claude-4-anthropic-revolution-llm-2026-1748823456789`
- Ces deux slugs sont différents → "Article introuvable" est normal pour les articles DEMO

**Cause probable 2 : Contrainte CHECK sur `category` bloque les inserts de l'AI writer**

Le schéma SQL actuel n'accepte que 7 catégories :
```sql
CHECK (category IN ('Actualités IA','Outils IA','Automatisation IA','Marketing IA',
                    'Création de Contenu IA','Vente IA','Support Client IA'))
```

Mais `ai-writer.ts` a 10 catégories dont : `'Tutoriels IA'`, `'Comparatifs IA'`, `'Guides IA'`.

Si l'AI writer essaie d'insérer avec une de ces 3 catégories → insert échoue → aucun article en base.

**Fix SQL à exécuter dans Supabase :**
```sql
ALTER TABLE blog_articles
  DROP CONSTRAINT IF EXISTS blog_articles_category_check;

ALTER TABLE blog_articles
  ADD CONSTRAINT blog_articles_category_check
  CHECK (category IN (
    'Actualités IA','Outils IA','Automatisation IA','Marketing IA',
    'Création de Contenu IA','Vente IA','Support Client IA',
    'Tutoriels IA','Comparatifs IA','Guides IA'
  ));
```

---

### Point de défaillance 4 — Le fallback DEMO masque le problème

**Symptôme :** Le blog `/blog` affiche des articles mais avec des vues de `2 856` (valeur DEMO hardcodée).

Si Supabase échoue (erreur de connexion, RLS bloquant, 0 articles), `blog.html` charge automatiquement les données DEMO. Ces articles DEMO ont des slugs propres SANS timestamp. Cliquer dessus mène à "Article introuvable" car ils n'existent pas en base.

**Comment confirmer que le blog charge du DEMO :**
- Les vues affichées correspondent aux valeurs exactes du tableau DEMO dans `blog.html`
- Les dates sont fixes (pas dynamiques)
- Ouvrir DevTools → Console → chercher une erreur Supabase

---

## Phase 3 : Rapport de diagnostic

Après avoir lu les fichiers et analysé les symptômes décrits par l'utilisateur, produire ce rapport :

```
## Diagnostic Blog CreatorFlow Market

### Routing /blog/:slug
[ OK / CASSÉ ] — raison si cassé

### Lecture du slug dans blog-article.html
[ OK / CASSÉ ] — raison si cassé

### Articles Supabase
[ Articles présents / Aucun article / Erreur Supabase ] — détail

### Contrainte category
[ OK / MISMATCH ] — liste des catégories bloquées si mismatch

### Cause principale identifiée
[Description claire du problème]

### Actions recommandées (dans l'ordre)
1. [Action 1 avec commande ou SQL exact]
2. [Action 2]
3. [Action 3]
```

---

## Phase 4 : Fixes courants

### Fix A — Aucun article en base (le plus fréquent)

Vérifier d'abord la contrainte category (voir Fix B), puis lancer l'AI writer :
```bash
cd livrables/blog-engine
npm run generate -- --title "Guide complet ChatGPT pour créateurs" --category "Guides IA"
```

Ou depuis le dashboard Next.js si disponible : `npm run dev` puis `/api/generate`.

### Fix B — Contrainte category bloquante

Exécuter dans Supabase SQL Editor :
```sql
ALTER TABLE blog_articles DROP CONSTRAINT IF EXISTS blog_articles_category_check;
ALTER TABLE blog_articles ADD CONSTRAINT blog_articles_category_check
  CHECK (category IN (
    'Actualités IA','Outils IA','Automatisation IA','Marketing IA',
    'Création de Contenu IA','Vente IA','Support Client IA',
    'Tutoriels IA','Comparatifs IA','Guides IA'
  ));
```

Puis mettre à jour le schéma local `livrables/blog-engine/sql/01-schema.sql` pour rester cohérent.

### Fix C — _redirects écrase la Pages Function

Si `_redirects` a une règle active pour `/blog/:slug` :
1. La supprimer (laisser seulement des commentaires)
2. Commit + push → déploiement Cloudflare automatique
3. Tester en Incognito

### Fix D — Cache navigateur sur ancien slug

Si le routing fonctionne en Incognito mais pas en navigation normale :
- Ctrl+Shift+Delete → Tout le temps → Fichiers et images en cache + Cookies
- Ou tester avec un slug jamais visité avant

### Fix E — Ajouter les colonnes SEO manquantes

Si l'AI writer échoue à cause de colonnes inexistantes :
```sql
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS secondary_keywords TEXT[] DEFAULT '{}';
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS longtail_keywords  TEXT[] DEFAULT '{}';
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS paa_questions      TEXT[] DEFAULT '{}';
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS seo_opportunities  TEXT[] DEFAULT '{}';
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS topic_cluster      TEXT   DEFAULT '';
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS key_takeaways      TEXT[] DEFAULT '{}';
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS faq                JSONB  DEFAULT '[]';
```

---

## Bug connu résolu — sb.rpc().catch() TypeError

**Symptôme :** Article trouvé en Supabase mais "Article introuvable" s'affiche quand même.

**Cause :** `sb.rpc('increment_blog_views',{article_slug:slug}).catch(()=>{})` — le CDN `@supabase/supabase-js@2` retourne un objet thenable sans `.catch()` natif. Le TypeError est capté par le `catch` global qui appelle `setNotFound(true)` et écrase `setArticle(data)`.

**Fix appliqué (ligne ~629 de blog-article.html) :**
```js
// ❌ Avant (bug)
sb.rpc('increment_blog_views',{article_slug:slug}).catch(()=>{});

// ✅ Après (fix)
sb.rpc('increment_blog_views',{article_slug:slug}).then(null, ()=>{});
```

**Leçon :** Ne jamais utiliser `.catch()` sur les retours de `sb.rpc()` en CDN. Utiliser `.then(null, handler)` ou `await` dans un try-catch séparé.

---

## Règles importantes

- **Toujours tester en fenêtre Incognito** pour éliminer le cache navigateur
- **Ne jamais modifier `_redirects`** pour ajouter une règle `/blog/:slug` — ça casse le slug dans l'URL
- **Les slugs DEMO ne sont pas en Supabase** — c'est normal, il faut des articles réels
- **Vérifier Supabase RLS** si les requêtes retournent 0 résultats sans erreur (la policy "public read published" doit exister)
- Communication en français, pas de tirets longs
