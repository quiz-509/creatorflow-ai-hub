-- Task 7: Index DB manquants identifiés dans l'audit 2026-07-15
-- Trois requêtes critiques exécutées à chaque heartbeat n'avaient pas d'index.
-- Avec de vrais clients, ces requêtes sans index causent des full table scans.

-- Index pour internal_requests (exécuté à chaque heartbeat Content/Prospecting/Support)
-- Filtre par to_dept et status — combinaison commune dans les heartbeats
CREATE INDEX IF NOT EXISTS idx_internal_requests_dept_status
  ON internal_requests(to_dept, status);

-- Index pour project_history (audit trail lu à chaque revue de portefeuille)
-- Filtre par project_id et trie par created_at DESC
CREATE INDEX IF NOT EXISTS idx_project_history_project_date
  ON project_history(project_id, created_at DESC);

-- Index pour client_communications (lu pour chaque projet actif)
-- Filtre par project_id et direction (inbound/outbound)
CREATE INDEX IF NOT EXISTS idx_client_communications_project
  ON client_communications(project_id, direction);
