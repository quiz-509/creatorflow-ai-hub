-- ============================================================
-- CreatorFlow — Cockpit CEO : colonnes agent_missions
-- Migration : 2026-07-01
-- ============================================================

-- S'assurer que agent_missions a toutes les colonnes nécessaires
ALTER TABLE agent_missions
  ADD COLUMN IF NOT EXISTS titre text,
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'assigned',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS context text,
  ADD COLUMN IF NOT EXISTS brief_id uuid REFERENCES briefs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Index pour les requêtes cockpit
CREATE INDEX IF NOT EXISTS idx_agent_missions_agent_slug ON agent_missions(agent_slug);
CREATE INDEX IF NOT EXISTS idx_agent_missions_statut ON agent_missions(statut);
CREATE INDEX IF NOT EXISTS idx_agent_missions_updated ON agent_missions(updated_at DESC);

-- S'assurer que pending_approvals a une colonne statut
ALTER TABLE pending_approvals
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'pending';

-- Index pending_approvals
CREATE INDEX IF NOT EXISTS idx_pending_approvals_statut ON pending_approvals(statut);

-- S'assurer que agent_reports a les bonnes colonnes
ALTER TABLE agent_reports
  ADD COLUMN IF NOT EXISTS report_type text DEFAULT 'mission_report',
  ADD COLUMN IF NOT EXISTS content jsonb;

-- Trigger updated_at sur agent_missions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_agent_missions_updated_at ON agent_missions;
CREATE TRIGGER update_agent_missions_updated_at
  BEFORE UPDATE ON agent_missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
