-- Niveau 1 & 2 — tables pour l'évolution des agents IA

-- Rapports structurés générés par les agents
CREATE TABLE IF NOT EXISTS agent_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid REFERENCES agent_missions(id) ON DELETE CASCADE,
  agent_slug text NOT NULL,
  title text NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Mémoire persistante par agent × client (Niveau 2)
CREATE TABLE IF NOT EXISTS agent_memory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_slug text NOT NULL,
  client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  context_type text NOT NULL,
  content text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_slug, client_id, context_type)
);

-- Fichiers uploadés par les clients pour leurs missions (Niveau 2)
CREATE TABLE IF NOT EXISTS client_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES agent_missions(id) ON DELETE SET NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  content_extracted text,
  file_type text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- Colonnes additionnelles sur support_tickets
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS agent_response text;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- RLS
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_reports_service" ON agent_reports;
CREATE POLICY "agent_reports_service" ON agent_reports FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "agent_memory_service" ON agent_memory;
CREATE POLICY "agent_memory_service" ON agent_memory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "client_files_own_select" ON client_files;
CREATE POLICY "client_files_own_select" ON client_files FOR SELECT USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "client_files_service" ON client_files;
CREATE POLICY "client_files_service" ON client_files FOR ALL USING (true) WITH CHECK (true);
