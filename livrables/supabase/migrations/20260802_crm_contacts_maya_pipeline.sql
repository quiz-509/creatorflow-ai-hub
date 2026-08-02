-- Migration : Maya CRM pipeline
-- Ajoute les colonnes nécessaires pour un vrai pipeline de prospection structuré

ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES client_projects(id),
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action text DEFAULT 'outreach_1',
  ADD COLUMN IF NOT EXISTS icp_score integer DEFAULT 5;

-- Déduplication : un prospect identifié (même LinkedIn) par projet
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_linkedin_project_unique
  ON crm_contacts(linkedin_url, project_id)
  WHERE linkedin_url IS NOT NULL AND linkedin_url != '';

-- Déduplication : un email vérifié par projet
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_email_project_unique
  ON crm_contacts(email, project_id)
  WHERE email IS NOT NULL AND email != '';

-- Performance : requêtes par projet et statut
CREATE INDEX IF NOT EXISTS idx_crm_contacts_project_status
  ON crm_contacts(project_id, status);
