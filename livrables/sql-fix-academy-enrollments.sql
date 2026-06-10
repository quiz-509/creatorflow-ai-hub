-- ============================================================
-- Fix Académie — renommer enrollments → academy_enrollments
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- Vérifier si academy_enrollments existe déjà
DO $$
BEGIN
  -- Si academy_enrollments n'existe pas, renommer enrollments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'academy_enrollments'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'enrollments'
    ) THEN
      ALTER TABLE enrollments RENAME TO academy_enrollments;
      RAISE NOTICE 'Table renommée : enrollments → academy_enrollments';
    ELSE
      -- Créer la table si elle n'existe ni sous un nom ni sous l'autre
      CREATE TABLE academy_enrollments (
        id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
        course_id   UUID        REFERENCES courses(id) ON DELETE CASCADE,
        prix_paye   INTEGER     DEFAULT 0,
        progression INTEGER     DEFAULT 0,
        completed   BOOLEAN     DEFAULT false,
        enrolled_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, course_id)
      );
      RAISE NOTICE 'Table créée : academy_enrollments';
    END IF;
  ELSE
    RAISE NOTICE 'academy_enrollments existe déjà — aucune action';
  END IF;
END $$;

-- RLS sur academy_enrollments
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='academy_enrollments' AND policyname='Utilisateur voit ses inscriptions') THEN
    CREATE POLICY "Utilisateur voit ses inscriptions" ON academy_enrollments
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='academy_enrollments' AND policyname='Utilisateur crée ses inscriptions') THEN
    CREATE POLICY "Utilisateur crée ses inscriptions" ON academy_enrollments
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='academy_enrollments' AND policyname='Utilisateur met à jour sa progression') THEN
    CREATE POLICY "Utilisateur met à jour sa progression" ON academy_enrollments
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Recréer le trigger sur le bon nom de table
CREATE OR REPLACE FUNCTION update_course_enrollments()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE courses SET nb_inscrits = nb_inscrits + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE courses SET nb_inscrits = GREATEST(nb_inscrits - 1, 0) WHERE id = OLD.course_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_course_enrollments ON academy_enrollments;
CREATE TRIGGER trg_update_course_enrollments
  AFTER INSERT OR DELETE ON academy_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_course_enrollments();

-- Vérification finale
SELECT COUNT(*) AS total_inscriptions FROM academy_enrollments;
