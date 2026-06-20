-- CRM + Workflow Engine

-- CRM Contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  company text,
  website text,
  role text,
  status text DEFAULT 'new' CHECK (status IN ('new','contacted','responded','qualified','meeting_scheduled','lost','won')),
  source_mission_id uuid REFERENCES agent_missions(id) ON DELETE SET NULL,
  agent_slug text,
  notes text,
  tags text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(email)
);

-- CRM Activities (log de toutes les interactions avec un contact)
CREATE TABLE IF NOT EXISTS crm_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES crm_contacts(id) ON DELETE CASCADE NOT NULL,
  mission_id uuid REFERENCES agent_missions(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('email_sent','email_opened','note','meeting','call','linkedin','follow_up')),
  subject text,
  content text,
  created_at timestamptz DEFAULT now()
);

-- Workflow Engine — définition d'un workflow multi-étapes
CREATE TABLE IF NOT EXISTS agent_workflows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  steps jsonb NOT NULL DEFAULT '[]',
  -- Chaque step: {index, agent_slug, objective_template, depends_on_step, wait_approval}
  trigger_type text DEFAULT 'manual' CHECK (trigger_type IN ('manual','cron','webhook','event')),
  schedule_cron text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Workflow Engine — exécution d'un workflow
CREATE TABLE IF NOT EXISTS workflow_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid REFERENCES agent_workflows(id) ON DELETE CASCADE,
  status text DEFAULT 'running' CHECK (status IN ('running','waiting','waiting_approval','completed','failed')),
  current_step int DEFAULT 0,
  context jsonb DEFAULT '{}',
  next_run_at timestamptz,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Workflow Engine — exécution de chaque étape
CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  agent_slug text NOT NULL,
  mission_id uuid REFERENCES agent_missions(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','waiting_approval')),
  output jsonb,
  started_at timestamptz,
  completed_at timestamptz
);

-- RLS
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contacts_service" ON crm_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "crm_activities_service" ON crm_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "agent_workflows_service" ON agent_workflows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "workflow_runs_service" ON workflow_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "workflow_step_runs_service" ON workflow_step_runs FOR ALL USING (true) WITH CHECK (true);
