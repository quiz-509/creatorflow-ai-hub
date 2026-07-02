-- ============================================================
-- CreatorFlow — AI Workforce OS v1.0 — Tables fondamentales
-- Migration : 2026-07-02
-- Référence : livrables/AI_WORKFORCE_OS.md Section 16
-- ============================================================

-- 1. company_memory — mémoire partagée par employé (niveau entreprise, pas client)
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

CREATE INDEX IF NOT EXISTS idx_company_memory_agent ON company_memory(agent_slug, memory_type);
ALTER TABLE company_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_memory_service" ON company_memory;
CREATE POLICY "company_memory_service" ON company_memory FOR ALL USING (auth_is_admin() OR true) WITH CHECK (true);

-- 2. agent_heartbeats — log de chaque exécution automatique de chaque employé
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug text NOT NULL,
  run_type text NOT NULL CHECK (run_type IN ('daily','weekly','monthly','alert')),
  status text NOT NULL CHECK (status IN ('ok','alert_sent','error')),
  kpis_snapshot jsonb DEFAULT '{}',
  alerts_triggered jsonb DEFAULT '[]',
  report_id uuid REFERENCES agent_reports(id) ON DELETE SET NULL,
  error_message text,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_agent_date ON agent_heartbeats(agent_slug, created_at DESC);
ALTER TABLE agent_heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "heartbeats_service" ON agent_heartbeats;
CREATE POLICY "heartbeats_service" ON agent_heartbeats FOR ALL USING (true) WITH CHECK (true);

-- 3. employee_handoffs — messages formels inter-employés (délégation tracée)
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
CREATE INDEX IF NOT EXISTS idx_handoffs_from ON employee_handoffs(from_agent, created_at DESC);
ALTER TABLE employee_handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "handoffs_service" ON employee_handoffs;
CREATE POLICY "handoffs_service" ON employee_handoffs FOR ALL USING (true) WITH CHECK (true);

-- 4. Colonne input sur agent_actions_log (utilisée par blog-monitor, standardiser)
ALTER TABLE agent_actions_log ADD COLUMN IF NOT EXISTS input jsonb;

-- 5. Initialiser company_memory pour Marketing Director
INSERT INTO company_memory (agent_slug, memory_type, content)
VALUES
  ('marketing', 'kpi_baseline', '{
    "snapshot_date": "2026-07-02",
    "users_total": 0,
    "users_7d": 0,
    "missions_completed_7d": 0,
    "briefs_open": 0,
    "articles_published_7d": 0,
    "tickets_open": 0,
    "mrr_estimate": 0,
    "notes": "Baseline initiale — sera mise à jour après le premier heartbeat hebdomadaire"
  }'),
  ('marketing', 'strategic_context', '{
    "snapshot_date": "2026-07-02",
    "priorities": [
      "Attirer les 5 premiers experts réels",
      "Valider le pipeline blog (3 articles/semaine)",
      "Atteindre 10 missions complétées avant la bêta",
      "Construire la notoriété SEO via le blog"
    ],
    "positioning": "Marketplace hybride FR/créatif : experts humains + employés IA",
    "target_audience": "Créateurs de contenu, TPE, solopreneurs francophones",
    "blockers": ["0 expert réel", "Contenu Academy à produire"],
    "notes": "Phase pré-bêta. Priorité absolue : avoir quelque chose à montrer à des utilisateurs réels."
  }'),
  ('marketing', 'monthly_goals', '{
    "month": "2026-07",
    "goals": [
      "3 articles/semaine publiés sur le blog",
      "Pipeline blog opérationnel sans intervention manuelle",
      "Marketing Director heartbeat quotidien actif",
      "Content + Prospecting Employees opérationnels"
    ]
  }')
ON CONFLICT (agent_slug, memory_type) DO NOTHING;
