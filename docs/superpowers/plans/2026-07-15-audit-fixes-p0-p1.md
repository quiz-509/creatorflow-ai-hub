# Audit Fixes P0 + P1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 4 bugs P0 bloquants et les 3 améliorations P1 identifiés dans l'audit du 2026-07-15, pour porter CreatorFlow Market de 35/100 à ~52/100 de conformité vision.

**Architecture:** Edge Functions Deno déployées sur Supabase. Les fixes sont indépendants — chaque task peut être exécutée séparément. Les migrations SQL s'exécutent directement dans le SQL Editor Supabase.

**Tech Stack:** Deno (TypeScript), Supabase (PostgreSQL + Edge Functions), Resend, Anthropic API, Stripe API

## Global Constraints

- Deploy Edge Functions: `npx supabase functions deploy <name> --project-ref cjtglfutckaogsmwhfsv` depuis `D:\Projects\creatorflow-market\livrables\`
- SQL Migrations: exécuter dans https://supabase.com/dashboard/project/cjtglfutckaogsmwhfsv/sql/new
- Ne jamais accepter de clé API dans le chat — tout dans Supabase Secrets
- Ne jamais reconstruire l'architecture existante — enrichir de façon incrémentale
- Model Haiku: `claude-haiku-4-5-20251001` | Model Sonnet: `claude-sonnet-4-5`
- Fichier principal marketing-heartbeat: `livrables/supabase/functions/marketing-heartbeat/index.ts`

---

## Task 1: Corriger le bug `stripeKey` hors scope (P0)

**Fichiers:**
- Modify: `livrables/supabase/functions/marketing-heartbeat/index.ts` lignes 1061-1067 et 1141

**Problème:** `handleCheck()` appelle `reviewOwnerPortfolio(supabase, anthropicKey, resendKey, braveApiKey, stripeKey, profile)` à la ligne 1087, mais `stripeKey` n'est pas dans la signature de `handleCheck()`. La valeur est déclarée dans `Deno.serve()` (ligne 1118) mais n'est jamais passée à `handleCheck()` (ligne 1141). Résultat: `stripeKey = undefined`, les données Stripe ne remontent jamais dans les décisions d'Aria.

**Interfaces:**
- Consumes: `stripeKey: string` depuis `Deno.env.get('STRIPE_SECRET_KEY')`
- Produces: `handleCheck()` avec `stripeKey` correctement propagé à `reviewOwnerPortfolio()`

- [ ] **Step 1: Modifier la signature de `handleCheck()`**

Fichier: `livrables/supabase/functions/marketing-heartbeat/index.ts`

Trouver (ligne ~1061):
```typescript
async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  braveApiKey: string,
  profile: EmployeeProfile,
): Promise<{ briefs_picked_up: number; projects_reviewed: number; actions: string[] }> {
```

Remplacer par:
```typescript
async function handleCheck(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  resendKey: string,
  braveApiKey: string,
  stripeKey: string,
  profile: EmployeeProfile,
): Promise<{ briefs_picked_up: number; projects_reviewed: number; actions: string[] }> {
```

- [ ] **Step 2: Corriger l'appel de `handleCheck()` dans `Deno.serve()`**

Trouver (ligne ~1141):
```typescript
const result = await handleCheck(supabase, anthropicKey, resendKey, braveApiKey, profile);
```

Remplacer par:
```typescript
const result = await handleCheck(supabase, anthropicKey, resendKey, braveApiKey, stripeKey, profile);
```

- [ ] **Step 3: Vérifier que `reviewOwnerPortfolio` est bien appelé avec stripeKey dans handleCheck**

Confirmer que la ligne ~1087 est bien:
```typescript
const { projects_reviewed, actions: ownerActions } = await reviewOwnerPortfolio(
  supabase, anthropicKey, resendKey, braveApiKey, stripeKey, profile,
);
```
Si oui, aucune modification nécessaire sur cette ligne.

- [ ] **Step 4: Déployer**

```powershell
cd D:\Projects\creatorflow-market\livrables
npx supabase functions deploy marketing-heartbeat --project-ref cjtglfutckaogsmwhfsv
```

- [ ] **Step 5: Vérifier le déploiement**

Aller sur https://supabase.com/dashboard/project/cjtglfutckaogsmwhfsv/functions
Confirmer que `marketing-heartbeat` est listé avec un timestamp récent.

---

## Task 2: Corriger la constraint `agent_heartbeats.status` (P0)

**Fichiers:**
- SQL Migration: nouveau fichier à exécuter dans Supabase SQL Editor

**Problème:** La constraint actuelle est `CHECK (status IN ('ok','alert_sent','error'))` mais tous les heartbeats insèrent `status: 'running'` au début et `status: 'completed'` à la fin. Chaque heartbeat génère une erreur Postgres silencieuse. Les logs d'exécution sont vides depuis le déploiement.

**Interfaces:**
- Produces: table `agent_heartbeats` acceptant les valeurs `'ok'`, `'alert_sent'`, `'error'`, `'running'`, `'completed'`

- [ ] **Step 1: Exécuter la migration SQL dans Supabase**

Ouvrir https://supabase.com/dashboard/project/cjtglfutckaogsmwhfsv/sql/new et exécuter:

```sql
-- Fix constraint agent_heartbeats.status
-- Supprime l'ancienne constraint et en crée une nouvelle qui accepte tous les statuts utilisés
ALTER TABLE agent_heartbeats
  DROP CONSTRAINT IF EXISTS agent_heartbeats_status_check;

ALTER TABLE agent_heartbeats
  ADD CONSTRAINT agent_heartbeats_status_check
  CHECK (status IN ('ok', 'alert_sent', 'error', 'running', 'completed'));
```

- [ ] **Step 2: Vérifier**

Dans le SQL Editor, exécuter:
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'agent_heartbeats_status_check';
```

Résultat attendu: une ligne avec `check_clause` contenant `'running'` et `'completed'`.

- [ ] **Step 3: Tester un insert**

```sql
INSERT INTO agent_heartbeats (agent_slug, run_type, status, started_at)
VALUES ('marketing', 'test', 'running', NOW());

SELECT * FROM agent_heartbeats WHERE agent_slug = 'marketing' ORDER BY created_at DESC LIMIT 1;
```

Résultat attendu: la ligne est insérée sans erreur.

- [ ] **Step 4: Nettoyer le test**

```sql
DELETE FROM agent_heartbeats WHERE run_type = 'test' AND agent_slug = 'marketing';
```

---

## Task 3: Corriger l'authentification admin (P0)

**Fichiers:**
- Modify: `livrables/sites-web/admin.html` ligne 254

**Problème:** `const ADMIN_EMAIL = 'pjoacenel@gmail.com'` est hardcodé. N'importe qui qui connaît cet email peut potentiellement accéder au cockpit si la logique de vérification est mal configurée. De plus, cela rend impossible l'ajout d'autres admins sans modifier le code.

**Solution minimale:** Vérifier que l'utilisateur connecté a `profiles.is_admin = true` dans Supabase, en plus (ou à la place) de la vérification par email.

- [ ] **Step 1: Ajouter la colonne is_admin à profiles (si absente)**

Dans Supabase SQL Editor:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Donner le statut admin à Joacenel
UPDATE profiles SET is_admin = true
WHERE email = 'pjoacenel@gmail.com';

-- Vérifier
SELECT id, email, is_admin FROM profiles WHERE is_admin = true;
```

- [ ] **Step 2: Modifier la vérification dans admin.html**

Trouver la ligne 254:
```javascript
const ADMIN_EMAIL = 'pjoacenel@gmail.com';
```

Trouver ensuite la logique de vérification d'accès (chercher où `ADMIN_EMAIL` est utilisé) et la remplacer par une vérification Supabase:

```javascript
// Vérifier les droits admin via Supabase
async function checkAdminAccess(user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  return profile?.is_admin === true;
}
```

- [ ] **Step 3: Intégrer `checkAdminAccess` au point de vérification existant**

Trouver où `ADMIN_EMAIL` est comparé (ex: `if (user.email !== ADMIN_EMAIL)`) et remplacer par:
```javascript
const isAdmin = await checkAdminAccess(user);
if (!isAdmin) {
  // redirection ou affichage erreur (garder le comportement existant)
  window.location.href = '/connexion.html?redirect=admin.html';
  return;
}
```

- [ ] **Step 4: Déployer admin.html via git**

```powershell
cd D:\Projects\creatorflow-market
git add livrables/sites-web/admin.html
git commit -m "fix: admin auth — vérification is_admin Supabase au lieu d'email hardcodé"
git push origin main
```

---

## Task 4: Configurer pg_cron pour Content, Prospecting, Support (P0)

**Fichiers:**
- SQL Migration: nouveau fichier à exécuter dans Supabase SQL Editor

**Problème:** Seul `marketing-heartbeat` a un pg_cron configuré. `content-heartbeat`, `prospecting-heartbeat` et `support-heartbeat` ne s'exécutent jamais automatiquement — ils attendent d'être appelés manuellement. En production, les 3 employees subordonnés sont inertes.

**URL pattern:** `https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/<function-name>`

- [ ] **Step 1: Vérifier le pg_cron existant pour marketing**

Dans Supabase SQL Editor:
```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
```

Noter le format exact utilisé pour le job marketing existant (URL, headers, schedule).

- [ ] **Step 2: Ajouter les 3 heartbeats manquants**

```sql
-- Content Employee — 12h30 UTC chaque jour
SELECT cron.schedule(
  'content-heartbeat-daily',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/content-heartbeat',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"run_type": "daily"}'::jsonb
  );
  $$
);

-- Prospecting Employee — 13h00 UTC chaque jour
SELECT cron.schedule(
  'prospecting-heartbeat-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/prospecting-heartbeat',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"run_type": "daily"}'::jsonb
  );
  $$
);

-- Support Agent — 13h30 UTC chaque jour
SELECT cron.schedule(
  'support-heartbeat-daily',
  '30 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/support-heartbeat',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"run_type": "daily"}'::jsonb
  );
  $$
);
```

**Note:** Si `current_setting('app.service_role_key')` ne fonctionne pas, adapter en utilisant le format exact du job marketing existant observé à l'étape précédente.

- [ ] **Step 3: Vérifier les 3 jobs**

```sql
SELECT jobname, schedule, active FROM cron.job
WHERE jobname IN ('content-heartbeat-daily', 'prospecting-heartbeat-daily', 'support-heartbeat-daily');
```

Résultat attendu: 3 lignes avec `active = true`.

---

## Task 5: Aria → Sonnet pour les décisions complexes (P1)

**Fichiers:**
- Modify: `livrables/supabase/functions/marketing-heartbeat/index.ts` ligne 7

**Problème:** Toutes les décisions d'Aria utilisent Haiku (ligne 7: `model: 'claude-haiku-4-5-20251001'`). Pour des décisions de portefeuille client avec données Stripe + analytics + historique, Haiku produit des résultats superficiels. Sonnet doit être utilisé pour `buildOwnerDecisionPrompt` uniquement. Haiku reste pour les tâches légères (métriques, synthèse d'expérience).

**Interfaces:**
- Consumes: `ANTHROPIC_API_KEY` (déjà en Supabase Secrets)
- Produces: deux constantes de modèle distinctes dans le code

- [ ] **Step 1: Ajouter une constante DECISION_MODEL**

Trouver en haut du fichier (ligne ~1-15, après les imports):
```typescript
const MODEL = 'claude-haiku-4-5-20251001';
```

Ou trouver où le modèle est défini (ligne 7). Ajouter après:
```typescript
const MODEL = 'claude-haiku-4-5-20251001';           // tâches légères: métriques, synthèse
const DECISION_MODEL = 'claude-sonnet-4-5';           // décisions client complexes
```

- [ ] **Step 2: Identifier les appels à `callClaude` qui utilisent des décisions complexes**

Chercher dans le fichier tous les appels `callClaude(` et identifier ceux qui utilisent `buildOwnerDecisionPrompt` (décision de portefeuille):

```bash
grep -n "buildOwnerDecisionPrompt\|callClaude" livrables/supabase/functions/marketing-heartbeat/index.ts
```

- [ ] **Step 3: Remplacer MODEL par DECISION_MODEL pour les décisions de portefeuille**

Dans la fonction `reviewOwnerPortfolio`, trouver l'appel Claude qui utilise `buildOwnerDecisionPrompt` et remplacer `MODEL` par `DECISION_MODEL`:

```typescript
// Avant:
const decision = await callClaude(anthropicKey, MODEL, buildOwnerDecisionPrompt(...), 256);

// Après:
const decision = await callClaude(anthropicKey, DECISION_MODEL, buildOwnerDecisionPrompt(...), 512);
```

Augmenter aussi le max_tokens à 512 pour Sonnet — il produira des décisions plus riches.

- [ ] **Step 4: Déployer**

```powershell
cd D:\Projects\creatorflow-market\livrables
npx supabase functions deploy marketing-heartbeat --project-ref cjtglfutckaogsmwhfsv
```

---

## Task 6: Activer `company_memory` dans marketing-heartbeat (P1)

**Fichiers:**
- Modify: `livrables/supabase/functions/marketing-heartbeat/index.ts`

**Problème:** La table `company_memory` existe en DB (créée dans la migration) mais n'est jamais lue ni écrite dans le heartbeat. Aria perd la mémoire stratégique de l'entreprise entre les sessions — elle ne sait pas quels types de clients réussissent, quels secteurs performent, quels patterns se répètent.

**Interfaces:**
- Consumes: table `company_memory` avec colonnes `key`, `value`, `updated_at`
- Produces: contexte entreprise injecté dans `buildOwnerDecisionPrompt`, mise à jour après chaque livraison

- [ ] **Step 1: Vérifier la structure de company_memory**

Dans Supabase SQL Editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'company_memory' ORDER BY ordinal_position;
```

Noter les colonnes exactes.

- [ ] **Step 2: Ajouter la fonction `loadCompanyMemory()`**

Dans `marketing-heartbeat/index.ts`, après les autres fonctions utilitaires (ex: après `loadOwnerProfile`), ajouter:

```typescript
async function loadCompanyMemory(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('company_memory')
    .select('key, value')
    .order('updated_at', { ascending: false })
    .limit(10);
  if (!data || data.length === 0) return '';
  return data.map((m: { key: string; value: string }) => `${m.key}: ${m.value}`).join('\n');
}
```

- [ ] **Step 3: Ajouter `updateCompanyMemory()` pour enregistrer après livraison**

```typescript
async function updateCompanyMemory(
  supabase: ReturnType<typeof createClient>,
  anthropicKey: string,
  recentActions: string[]
): Promise<void> {
  if (recentActions.length === 0) return;
  const summary = await callClaude(
    anthropicKey, MODEL,
    `Tu es le système de mémoire de CreatorFlow Market. 
Voici les actions réalisées aujourd'hui par le Marketing Director: ${recentActions.join(', ')}.
Identifie 1 à 3 patterns ou insights stratégiques à retenir (format: "clé: valeur courte").
Réponds uniquement avec les insights, un par ligne.`,
    128
  );
  const lines = summary.split('\n').filter((l: string) => l.includes(':'));
  for (const line of lines) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length > 0) {
      await supabase.from('company_memory').upsert({
        key: key.trim(),
        value: rest.join(':').trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    }
  }
}
```

- [ ] **Step 4: Injecter `companyMemory` dans `buildOwnerDecisionPrompt`**

Dans `handleCheck()`, charger la mémoire avant la revue de portefeuille:
```typescript
const companyMemory = await loadCompanyMemory(supabase);
```

Trouver `buildOwnerDecisionPrompt` et vérifier s'il a déjà un paramètre pour la mémoire entreprise. S'il n'en a pas, ajouter un paramètre `companyContext: string` et l'injecter dans le prompt:
```
${companyContext ? `\n═══ MÉMOIRE ENTREPRISE ═══\n${companyContext}\n` : ''}
```

- [ ] **Step 5: Appeler `updateCompanyMemory` à la fin de `handleCheck`**

```typescript
// À la fin de handleCheck(), avant le return:
if (actions.length > 0) {
  await updateCompanyMemory(supabase, anthropicKey, actions);
}
```

- [ ] **Step 6: Déployer**

```powershell
cd D:\Projects\creatorflow-market\livrables
npx supabase functions deploy marketing-heartbeat --project-ref cjtglfutckaogsmwhfsv
```

---

## Task 7: Ajouter les index DB manquants (P1)

**Fichiers:**
- SQL Migration: exécuter dans Supabase SQL Editor

**Problème:** Trois requêtes critiques exécutées à chaque heartbeat n'ont pas d'index. Chaque run fait un full table scan sur `internal_requests`, `project_history` et `client_communications`. Avec de vrais clients, ces requêtes deviendront lentes rapidement.

- [ ] **Step 1: Exécuter la migration d'index**

Dans Supabase SQL Editor:
```sql
-- Index pour internal_requests (exécuté à chaque heartbeat Content/Prospecting/Support)
CREATE INDEX IF NOT EXISTS idx_internal_requests_dept_status
  ON internal_requests(to_dept, status);

-- Index pour project_history (audit trail lu à chaque revue de portefeuille)
CREATE INDEX IF NOT EXISTS idx_project_history_project_date
  ON project_history(project_id, created_at DESC);

-- Index pour client_communications (lu pour chaque projet actif)
CREATE INDEX IF NOT EXISTS idx_client_communications_project
  ON client_communications(project_id, direction);
```

- [ ] **Step 2: Vérifier les index**

```sql
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_internal_requests_dept_status',
  'idx_project_history_project_date',
  'idx_client_communications_project'
);
```

Résultat attendu: 3 lignes.

---

## Ordre d'exécution recommandé

1. **Task 2** (constraint SQL) — risque zéro, aucun déploiement requis
2. **Task 7** (index SQL) — risque zéro, aucun déploiement requis
3. **Task 1** (stripeKey fix) — modifier + déployer marketing-heartbeat
4. **Task 5** (Sonnet) — modifier + déployer marketing-heartbeat (combiner avec Task 1)
5. **Task 6** (company_memory) — modifier + déployer marketing-heartbeat (combiner avec Tasks 1+5)
6. **Task 4** (pg_cron) — SQL uniquement, après confirmation que les heartbeats content/prospecting/support fonctionnent
7. **Task 3** (admin auth) — modifier + déployer admin.html via git push

**Optimisation:** Tasks 1 + 5 + 6 peuvent être combinées en un seul déploiement de `marketing-heartbeat`.

---
*Plan généré le 2026-07-15 — Audit P0/P1 CreatorFlow Market*
*Estimation: 1 session de travail (2-3h)*
