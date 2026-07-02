-- ============================================================
-- CreatorFlow — Stripe Connect : colonnes experts + table payouts
-- Migration : 2026-07-02
-- ============================================================

-- Stripe Connect sur les profils experts
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payout_enabled BOOLEAN NOT NULL DEFAULT false;

-- Table de suivi des paiements reçus (post checkout.session.completed)
CREATE TABLE IF NOT EXISTS expert_payouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  expert_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  stripe_transfer_id TEXT,
  amount_total_cents INTEGER NOT NULL,
  amount_expert_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'cad',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','transferred','failed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Colonne stripe_payment_intent_id sur missions pour traçabilité
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_paid_at TIMESTAMPTZ;

-- RLS
ALTER TABLE expert_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expert_payouts_own_select" ON expert_payouts;
CREATE POLICY "expert_payouts_own_select" ON expert_payouts
  FOR SELECT USING (auth.uid() = expert_id OR auth.uid() = client_id);

DROP POLICY IF EXISTS "expert_payouts_service" ON expert_payouts;
CREATE POLICY "expert_payouts_service" ON expert_payouts
  FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_expert_payouts_expert ON expert_payouts(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_payouts_mission ON expert_payouts(mission_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account ON profiles(stripe_account_id) WHERE stripe_account_id IS NOT NULL;
