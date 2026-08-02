-- Quality Gate Aria : colonnes d'évaluation qualité dans internal_requests
-- Aria évalue chaque livrable Léo avant livraison client

ALTER TABLE internal_requests
  ADD COLUMN IF NOT EXISTS quality_score     smallint,
  ADD COLUMN IF NOT EXISTS quality_feedback  text,
  ADD COLUMN IF NOT EXISTS quality_reviewed_at timestamptz;

-- Index pour que Aria retrouve rapidement les livrables non évalués
CREATE INDEX IF NOT EXISTS idx_ir_quality_pending
  ON internal_requests (to_dept, status, quality_reviewed_at)
  WHERE to_dept = 'content' AND status = 'completed';

COMMENT ON COLUMN internal_requests.quality_score IS '0-10 — évalué par Aria. < 6 = renvoyé à Léo pour révision.';
COMMENT ON COLUMN internal_requests.quality_feedback IS 'Retour qualitatif structuré d''Aria vers Léo.';
COMMENT ON COLUMN internal_requests.quality_reviewed_at IS 'Timestamp de l''évaluation qualité par Aria.';
