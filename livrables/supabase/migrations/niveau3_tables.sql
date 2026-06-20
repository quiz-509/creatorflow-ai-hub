-- Niveau 3 — Actions externes contrôlées

-- Log immuable de toutes les actions externes des agents
CREATE TABLE IF NOT EXISTS agent_actions_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid REFERENCES agent_missions(id) ON DELETE SET NULL,
  agent_slug text NOT NULL,
  action_type text NOT NULL,
  action_data jsonb,
  context text,
  approved_by uuid REFERENCES auth.users(id),
  executed_at timestamptz,
  result jsonb,
  status text CHECK (status IN ('pending_approval','approved','rejected','executed','failed')) NOT NULL DEFAULT 'executed',
  created_at timestamptz DEFAULT now()
);

-- Catalogue des workflows n8n disponibles
CREATE TABLE IF NOT EXISTS n8n_workflows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  webhook_url text NOT NULL,
  input_schema jsonb,
  requires_approval boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE agent_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_actions_log_service" ON agent_actions_log;
CREATE POLICY "agent_actions_log_service" ON agent_actions_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "n8n_workflows_service" ON n8n_workflows;
CREATE POLICY "n8n_workflows_service" ON n8n_workflows FOR ALL USING (true) WITH CHECK (true);

-- published_at sur blog_articles (si pas encore présent)
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS published_at timestamptz;
