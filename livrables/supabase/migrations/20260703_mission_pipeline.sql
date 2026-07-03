-- Migration : Mission Pipeline — Marketing Director
-- Phase A+B — Pièce 1 : infrastructure pour run_type='mission'

-- 1. Colonne started_at sur agent_missions (pour marquer quand le MD démarre une mission)
ALTER TABLE public.agent_missions
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- 2. Élargir le CHECK sur agent_heartbeats pour inclure 'mission'
--    (utilisé si on veut tracer les runs mission dans les heartbeats à l'avenir)
ALTER TABLE public.agent_heartbeats
  DROP CONSTRAINT IF EXISTS agent_heartbeats_run_type_check;

ALTER TABLE public.agent_heartbeats
  ADD CONSTRAINT agent_heartbeats_run_type_check
  CHECK (run_type IN ('daily', 'weekly', 'monthly', 'alert', 'mission'));

-- 3. Index pour accélérer la requête "missions assignées en attente"
CREATE INDEX IF NOT EXISTS idx_agent_missions_status_agent
  ON public.agent_missions (agent_id, status)
  WHERE status = 'assigned';

-- 4. Index pour accélérer la recherche dans agent_outputs par mission
CREATE INDEX IF NOT EXISTS idx_agent_outputs_mission_id
  ON public.agent_outputs (mission_id);

-- 5. Index pour agent_actions_log par mission
CREATE INDEX IF NOT EXISTS idx_agent_actions_log_mission_id
  ON public.agent_actions_log (mission_id);
