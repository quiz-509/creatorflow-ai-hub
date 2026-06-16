-- Permet aux clients de commander des missions à un agent IA (marketplace), avec
-- validation qualité du CEO avant que le résultat soit livré au client.
ALTER TABLE agent_missions ADD COLUMN IF NOT EXISTS delivered_to_client boolean NOT NULL DEFAULT false;
ALTER TABLE agent_missions ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Les clients doivent pouvoir lire leurs propres missions (created_by = leur id)
CREATE POLICY "clients_read_own_missions" ON agent_missions
  FOR SELECT USING (created_by = auth.uid());

-- Les clients peuvent lire les livrables (agent_outputs) de leurs missions, une fois livrés
CREATE POLICY "clients_read_own_delivered_outputs" ON agent_outputs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agent_missions m
      WHERE m.id = agent_outputs.mission_id
        AND m.created_by = auth.uid()
        AND m.delivered_to_client = true
    )
  );
