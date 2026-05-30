-- ============================================
-- CreatorFlow Market — Migration v1
-- À exécuter dans : Supabase > SQL Editor
-- ============================================

-- ─── 1. TABLE profiles — colonnes manquantes ──────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prenom          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nom             TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS type_utilisateur TEXT DEFAULT 'client';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS entreprise      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url       TEXT;

-- ─── 2. TABLE experts — colonnes manquantes ───────────────────────────────────
ALTER TABLE experts ADD COLUMN IF NOT EXISTS competences  TEXT[]       DEFAULT '{}';
ALTER TABLE experts ADD COLUMN IF NOT EXISTS categories   TEXT[]       DEFAULT '{}';
ALTER TABLE experts ADD COLUMN IF NOT EXISTS tarif_heure  INTEGER      DEFAULT 0;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS disponible   BOOLEAN      DEFAULT true;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS note_moyenne DECIMAL(3,2) DEFAULT 0;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS nb_avis      INTEGER      DEFAULT 0;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS photo_url    TEXT;

-- ─── 3. TABLE reviews — création ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id    UUID        REFERENCES missions(id) ON DELETE SET NULL,
  client_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  expert_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  note          INTEGER     NOT NULL CHECK (note >= 1 AND note <= 5),
  commentaire   TEXT,
  client_prenom TEXT,
  client_nom    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mission_id, client_id)
);

-- ─── 4. RLS — profiles ────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles'
    AND policyname='Profils visibles authentifiés'
  ) THEN
    CREATE POLICY "Profils visibles authentifiés" ON profiles
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='profiles'
    AND policyname='Utilisateur gère son profil'
  ) THEN
    CREATE POLICY "Utilisateur gère son profil" ON profiles
      FOR ALL USING (auth.uid() = id);
  END IF;
END $$;

-- ─── 5. RLS — experts ─────────────────────────────────────────────────────────
ALTER TABLE experts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='experts'
    AND policyname='Experts visibles par tous'
  ) THEN
    CREATE POLICY "Experts visibles par tous" ON experts
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='experts'
    AND policyname='Expert gère son profil'
  ) THEN
    CREATE POLICY "Expert gère son profil" ON experts
      FOR ALL USING (auth.uid() = id);
  END IF;
END $$;

-- ─── 6. RLS — reviews ─────────────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='reviews'
    AND policyname='Avis visibles par tous'
  ) THEN
    CREATE POLICY "Avis visibles par tous" ON reviews
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='reviews'
    AND policyname='Clients soumettent des avis'
  ) THEN
    CREATE POLICY "Clients soumettent des avis" ON reviews
      FOR INSERT WITH CHECK (auth.uid() = client_id);
  END IF;
END $$;

-- ─── 7. Trigger : note_moyenne + nb_avis mis à jour après chaque review ───────
CREATE OR REPLACE FUNCTION update_expert_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE experts
  SET
    note_moyenne = (SELECT COALESCE(AVG(note::DECIMAL), 0) FROM reviews WHERE expert_id = NEW.expert_id),
    nb_avis      = (SELECT COUNT(*) FROM reviews WHERE expert_id = NEW.expert_id)
  WHERE id = NEW.expert_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_expert_rating ON reviews;
CREATE TRIGGER trg_update_expert_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_expert_rating();

-- ─── 8. Trigger : profil auto-créé à l'inscription ───────────────────────────
-- Crée un profil vide dès qu'un compte auth est créé
-- (backup de l'insert explicite dans inscription.html)
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, prenom, nom, type_utilisateur)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'prenom',
    NEW.raw_user_meta_data->>'nom',
    COALESCE(NEW.raw_user_meta_data->>'type_utilisateur', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_profile ON auth.users;
CREATE TRIGGER trg_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_on_signup();
