-- ============================================================
-- Patch experts — colonnes manquantes
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE experts ADD COLUMN IF NOT EXISTS niveau   TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS linkedin TEXT;
ALTER TABLE experts ADD COLUMN IF NOT EXISTS statut   TEXT DEFAULT 'pending';

-- Mettre les experts déjà approuvés (seed) à 'approved' si statut est null
UPDATE experts SET statut = 'approved'
WHERE statut IS NULL AND nb_avis > 0;

-- Confirmation
SELECT id, specialite, statut, niveau, linkedin FROM experts ORDER BY created_at DESC;
