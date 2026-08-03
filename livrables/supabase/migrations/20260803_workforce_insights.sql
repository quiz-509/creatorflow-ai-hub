-- P0-2 (roadmap AI-native) : mémoire analytique cross-clients
-- Patterns détectés à l'échelle de la plateforme (pas par employé, pas par client isolé)
-- Ex: "secteur SaaS B2B convertit 3x mieux" — visible par Maya ET par Aria pour qualifier les briefs entrants

CREATE TABLE IF NOT EXISTS workforce_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  domain text NOT NULL,           -- 'marketing' | 'content' | 'prospecting' | 'support'
  insight_key text NOT NULL,      -- ex: 'secteur_saas_b2b'
  insight_text text NOT NULL,     -- ex: 'Secteur "saas b2b" : 42% de conversion (12/29 prospects qualifiés ou plus).'
  sample_size integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (domain, insight_key)
);

CREATE INDEX IF NOT EXISTS idx_workforce_insights_domain ON workforce_insights(domain);

-- Le secteur ICP est déjà extrait par Claude à chaque recherche Apollo (extractIcpForApollo)
-- mais n'était jamais persisté sur le contact — on l'ajoute pour pouvoir l'agréger par la suite.
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS sector text;
