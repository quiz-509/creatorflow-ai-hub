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
ALTER TABLE experts ADD COLUMN IF NOT EXISTS specialite   TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS bio          TEXT;
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

-- ─── 9. ACADEMY — TABLE courses ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  titre            TEXT        NOT NULL,
  description_courte TEXT,
  description      TEXT,
  categorie        TEXT,
  niveau           TEXT        DEFAULT 'Débutant',
  langue           TEXT        DEFAULT 'Français',
  prix             INTEGER     DEFAULT 0,
  image_url        TEXT,
  statut           TEXT        DEFAULT 'brouillon',
  note_moyenne     DECIMAL(3,2) DEFAULT 0,
  nb_avis          INTEGER     DEFAULT 0,
  nb_inscrits      INTEGER     DEFAULT 0,
  duree_totale     INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. ACADEMY — TABLE modules ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modules (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id  UUID        REFERENCES courses(id) ON DELETE CASCADE,
  titre      TEXT        NOT NULL,
  ordre      INTEGER     DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 11. ACADEMY — TABLE lessons ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id    UUID        REFERENCES courses(id) ON DELETE CASCADE,
  module_id    UUID        REFERENCES modules(id) ON DELETE CASCADE,
  titre        TEXT        NOT NULL,
  type         TEXT        DEFAULT 'video',
  contenu_url  TEXT,
  duree        INTEGER     DEFAULT 0,
  ordre        INTEGER     DEFAULT 1,
  gratuite     BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 12. ACADEMY — TABLE enrollments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enrollments (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   UUID        REFERENCES courses(id) ON DELETE CASCADE,
  prix_paye   INTEGER     DEFAULT 0,
  progression INTEGER     DEFAULT 0,
  completed   BOOLEAN     DEFAULT false,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- ─── 13. ACADEMY — TABLE lesson_completions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_completions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id    UUID        REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- ─── 14. RLS — courses ────────────────────────────────────────────────────────
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='courses' AND policyname='Cours publiés visibles') THEN
    CREATE POLICY "Cours publiés visibles" ON courses
      FOR SELECT USING (statut = 'publié' OR auth.uid() = instructor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='courses' AND policyname='Instructeur crée ses cours') THEN
    CREATE POLICY "Instructeur crée ses cours" ON courses
      FOR INSERT WITH CHECK (auth.uid() = instructor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='courses' AND policyname='Instructeur modifie ses cours') THEN
    CREATE POLICY "Instructeur modifie ses cours" ON courses
      FOR UPDATE USING (auth.uid() = instructor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='courses' AND policyname='Instructeur supprime ses cours') THEN
    CREATE POLICY "Instructeur supprime ses cours" ON courses
      FOR DELETE USING (auth.uid() = instructor_id);
  END IF;
END $$;

-- ─── 15. RLS — modules ────────────────────────────────────────────────────────
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='modules' AND policyname='Modules lisibles par tous') THEN
    CREATE POLICY "Modules lisibles par tous" ON modules FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='modules' AND policyname='Instructeur crée ses modules') THEN
    CREATE POLICY "Instructeur crée ses modules" ON modules
      FOR INSERT WITH CHECK (auth.uid() = (SELECT instructor_id FROM courses WHERE id = course_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='modules' AND policyname='Instructeur supprime ses modules') THEN
    CREATE POLICY "Instructeur supprime ses modules" ON modules
      FOR DELETE USING (auth.uid() = (SELECT instructor_id FROM courses WHERE id = course_id));
  END IF;
END $$;

-- ─── 16. RLS — lessons ────────────────────────────────────────────────────────
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lessons' AND policyname='Leçons lisibles par tous') THEN
    CREATE POLICY "Leçons lisibles par tous" ON lessons FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lessons' AND policyname='Instructeur crée ses leçons') THEN
    CREATE POLICY "Instructeur crée ses leçons" ON lessons
      FOR INSERT WITH CHECK (auth.uid() = (SELECT instructor_id FROM courses WHERE id = course_id));
  END IF;
END $$;

-- ─── 17. RLS — enrollments ────────────────────────────────────────────────────
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enrollments' AND policyname='Utilisateur voit ses inscriptions') THEN
    CREATE POLICY "Utilisateur voit ses inscriptions" ON enrollments
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enrollments' AND policyname='Utilisateur crée ses inscriptions') THEN
    CREATE POLICY "Utilisateur crée ses inscriptions" ON enrollments
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enrollments' AND policyname='Utilisateur met à jour sa progression') THEN
    CREATE POLICY "Utilisateur met à jour sa progression" ON enrollments
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── 18. RLS — lesson_completions ─────────────────────────────────────────────
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lesson_completions' AND policyname='Utilisateur gère ses completions') THEN
    CREATE POLICY "Utilisateur gère ses completions" ON lesson_completions
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─── 19. Trigger : nb_inscrits mis à jour après enrollment ────────────────────
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

DROP TRIGGER IF EXISTS trg_update_course_enrollments ON enrollments;
CREATE TRIGGER trg_update_course_enrollments
  AFTER INSERT OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_course_enrollments();

-- ─── 20. Trigger : duree_totale recalculée après ajout/suppression de leçon ───
CREATE OR REPLACE FUNCTION update_course_duration()
RETURNS TRIGGER AS $$
DECLARE target_id UUID;
BEGIN
  target_id := COALESCE(NEW.course_id, OLD.course_id);
  UPDATE courses
    SET duree_totale = (SELECT COALESCE(SUM(duree), 0) FROM lessons WHERE course_id = target_id)
    WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_course_duration ON lessons;
CREATE TRIGGER trg_update_course_duration
  AFTER INSERT OR UPDATE OR DELETE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_course_duration();
