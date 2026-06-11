-- ============================================================
-- PARRAINAGE — Tracking réel
-- À exécuter dans Supabase SQL Editor
-- ============================================================

-- 1. Colonne referral_code sur profiles (code unique persisté)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by TEXT; -- code du parrain

-- 2. Table referrals
CREATE TABLE IF NOT EXISTS referrals (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id    UUID REFERENCES profiles(id) ON DELETE SET NULL, -- le parrain
  referred_id    UUID REFERENCES profiles(id) ON DELETE SET NULL, -- le filleul
  referral_code  TEXT NOT NULL,                                   -- code utilisé
  status         TEXT DEFAULT 'pending',                          -- pending | rewarded
  credited_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Index pour les lookups fréquents
CREATE INDEX IF NOT EXISTS idx_referrals_referrer   ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred   ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_profiles_ref_code    ON profiles(referral_code);

-- 4. RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_read_own" ON referrals
  FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "referrals_insert_system" ON referrals
  FOR INSERT WITH CHECK (true); -- insertion côté app au signup

-- 5. Fonction pour créditer le parrain quand une mission est payée
-- (optionnel — à déclencher via Edge Function sur paiement confirmé)
CREATE OR REPLACE FUNCTION credit_referral(p_referred_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE referrals
  SET status = 'rewarded', credited_at = NOW()
  WHERE referred_id = p_referred_id
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
