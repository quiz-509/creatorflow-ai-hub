-- Fix constraint agent_heartbeats.status
-- Supprime l'ancienne constraint et en crée une nouvelle qui accepte tous les statuts utilisés
ALTER TABLE agent_heartbeats
  DROP CONSTRAINT IF EXISTS agent_heartbeats_status_check;

ALTER TABLE agent_heartbeats
  ADD CONSTRAINT agent_heartbeats_status_check
  CHECK (status IN ('ok', 'alert_sent', 'error', 'running', 'completed'));
