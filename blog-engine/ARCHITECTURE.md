# CreatorFlow AI News Engine — Architecture

## Vue d'ensemble

Système de blog automatisé spécialisé IA, produisant du contenu SEO francophone sans intervention humaine.

```
Sources IA (RSS/API)
    ↓
n8n Monitor (toutes les 6h)
    ↓
Scoring de pertinence
    ↓
Claude API — Génération article
    ↓
Supabase (stockage)
    ↓
Next.js Blog (affichage) ← blog.creatorflowmarket.com
    ↓
Posts sociaux automatiques
```

## Stack technique

| Couche         | Technologie                                      |
|----------------|--------------------------------------------------|
| Frontend       | Next.js 14 + Tailwind + Shadcn UI (App Router)   |
| Existing site  | blog.html (React CDN — déployé sur Cloudflare)   |
| Base de données| Supabase (PostgreSQL + RLS)                      |
| ORM            | Prisma                                           |
| IA rédaction   | Claude Sonnet 4.6 (principal) + GPT-4o (backup)  |
| Automatisation | n8n (self-hosted ou cloud)                       |
| Déploiement    | Cloudflare Pages / Vercel                        |
| SEO            | Sitemap auto + RSS Feed + IndexNow               |
| Images         | DALL-E 3 / Flux (génération automatique)         |

## Structure des dossiers

```
blog-engine/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Blog home (ISR)
│   │   ├── [slug]/page.tsx       # Article detail (SSG)
│   │   ├── sitemap.ts            # Sitemap auto
│   │   ├── rss.xml/route.ts      # RSS Feed
│   │   └── api/
│   │       ├── monitor/route.ts  # Endpoint déclenchement veille
│   │       └── generate/route.ts # Génération manuelle
│   ├── components/
│   │   ├── ArticleCard.tsx
│   │   ├── FeaturedArticle.tsx
│   │   ├── CategoryFilter.tsx
│   │   ├── Newsletter.tsx
│   │   └── Dashboard.tsx
│   └── lib/
│       ├── supabase.ts           # Client + requêtes
│       ├── ai-writer.ts          # Génération Claude
│       └── news-monitor.ts       # Veille RSS
├── n8n/
│   └── workflow-news-engine.json # Workflow importable n8n
├── sql/
│   ├── 01-schema.sql             # Tables + RLS
│   └── 02-seed.sql               # Sources + articles demo
└── prisma/
    └── schema.prisma
```

## Plan de déploiement

### Étape 1 — Base (1-2h)
1. Exécuter `01-schema.sql` + `02-seed.sql` dans Supabase
2. Déployer `blog.html` (déjà fait — existe sur le site)
3. Tester la page blog sur le site existant

### Étape 2 — News Engine (4-6h)
1. `npm install` dans `blog-engine/`
2. Configurer `.env.local` :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://cjtglfutckaogsmwhfsv.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=...
   ANTHROPIC_API_KEY=sk-ant-...
   MONITOR_SECRET=ton-secret-ici
   ```
3. `npm run dev` pour tester
4. Déployer sur Cloudflare Pages ou Vercel

### Étape 3 — Automatisation (2-3h)
1. Installer n8n (Docker ou n8n.cloud)
2. Importer `n8n/workflow-news-engine.json`
3. Configurer les credentials (Anthropic API, Supabase)
4. Tester un cycle manuel
5. Activer le schedule (toutes les 6h)

### Étape 4 — Réseaux sociaux (optionnel)
- Ajouter Buffer/Hootsuite API dans n8n pour publication auto
- Ou utiliser Make.com avec les templates sociaux

## Coûts estimés (mensuel)

| Service          | Coût          |
|------------------|---------------|
| Supabase         | Gratuit (Free tier) |
| Cloudflare Pages | Gratuit       |
| n8n (self-hosted)| ~5$/mois (VPS) ou n8n.cloud 20$|
| Claude API       | ~15-30$/mois (5-10 articles/jour) |
| Total            | **~20-55$/mois** |

## Monétisation prévue

1. **Affiliation** : liens vers outils IA dans chaque article
2. **Leads CreatorFlow Market** : CTA experts + Academy dans chaque article
3. **Newsletter Premium** : séquence email automatisée
4. **Sponsoring** : une fois 10k visiteurs/mois atteints
