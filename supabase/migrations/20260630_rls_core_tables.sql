-- ============================================================
-- CreatorFlow Market — RLS Core Tables
-- Migration : 2026-06-30
-- Auteur    : CTO CreatorFlow
-- Objectif  : Protéger toutes les tables core contre l'accès
--             non autorisé. Chaque utilisateur ne voit que
--             ses propres données. L'admin voit tout.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. HELPER : identifier l'admin côté serveur
--    SECURITY DEFINER = s'exécute avec les droits du owner,
--    pas du client — impossible de bypass depuis le frontend.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    auth.email() = 'pjoacenel@gmail.com'
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
$$;

-- Colonne is_admin sur profiles (future-proof : plusieurs admins possibles)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Marquer l'admin actuel
UPDATE profiles SET is_admin = true
WHERE email = 'pjoacenel@gmail.com';


-- ────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Lecture : soi-même toujours, admin voit tout,
--           les experts publiés visibles publiquement (marketplace)
CREATE POLICY "profiles: self read"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR auth_is_admin()
    OR (type_utilisateur = 'expert')  -- profils experts visibles pour le matching
  );

-- Création : uniquement son propre profil
CREATE POLICY "profiles: self insert"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Mise à jour : soi-même ou admin
CREATE POLICY "profiles: self update"
  ON profiles FOR UPDATE
  USING (id = auth.uid() OR auth_is_admin())
  WITH CHECK (id = auth.uid() OR auth_is_admin());

-- Suppression : admin uniquement
CREATE POLICY "profiles: admin delete"
  ON profiles FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 2. EXPERTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE experts ENABLE ROW LEVEL SECURITY;

-- Lecture : tout le monde (marketplace publique) — experts approuvés
--           Admin voit tous les statuts (pending, rejected, etc.)
CREATE POLICY "experts: public read approved"
  ON experts FOR SELECT
  USING (
    statut = 'approved'
    OR id = auth.uid()
    OR auth_is_admin()
  );

-- Création : l'expert crée son propre profil
CREATE POLICY "experts: self insert"
  ON experts FOR INSERT
  WITH CHECK (id = auth.uid());

-- Mise à jour : l'expert modifie son propre profil, admin modifie tout
CREATE POLICY "experts: self or admin update"
  ON experts FOR UPDATE
  USING (id = auth.uid() OR auth_is_admin())
  WITH CHECK (id = auth.uid() OR auth_is_admin());

-- Suppression : admin uniquement
CREATE POLICY "experts: admin delete"
  ON experts FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 3. MISSIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions: participant read"
  ON missions FOR SELECT
  USING (
    client_id = auth.uid()
    OR expert_id = auth.uid()
    OR auth_is_admin()
  );

CREATE POLICY "missions: client insert"
  ON missions FOR INSERT
  WITH CHECK (client_id = auth.uid() OR auth_is_admin());

CREATE POLICY "missions: participant or admin update"
  ON missions FOR UPDATE
  USING (
    client_id = auth.uid()
    OR expert_id = auth.uid()
    OR auth_is_admin()
  );

CREATE POLICY "missions: admin delete"
  ON missions FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 4. BRIEFS
-- ────────────────────────────────────────────────────────────
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefs: owner or admin read"
  ON briefs FOR SELECT
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "briefs: owner insert"
  ON briefs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "briefs: owner or admin update"
  ON briefs FOR UPDATE
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "briefs: admin delete"
  ON briefs FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 5. CONVERSATIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations: participant read"
  ON conversations FOR SELECT
  USING (
    client_id = auth.uid()
    OR expert_id = auth.uid()
    OR auth_is_admin()
  );

CREATE POLICY "conversations: client insert"
  ON conversations FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "conversations: participant update"
  ON conversations FOR UPDATE
  USING (client_id = auth.uid() OR expert_id = auth.uid() OR auth_is_admin());

CREATE POLICY "conversations: admin delete"
  ON conversations FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 6. MESSAGES
-- ────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Lecture : participants de la conversation seulement
CREATE POLICY "messages: participant read"
  ON messages FOR SELECT
  USING (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.client_id = auth.uid() OR c.expert_id = auth.uid())
    )
  );

-- Envoi : l'expéditeur authentifié
CREATE POLICY "messages: authenticated insert"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.client_id = auth.uid() OR c.expert_id = auth.uid())
    )
  );

CREATE POLICY "messages: admin delete"
  ON messages FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 7. PROPOSITIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE propositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propositions: participant read"
  ON propositions FOR SELECT
  USING (
    client_id = auth.uid()
    OR expert_id = auth.uid()
    OR auth_is_admin()
  );

-- L'expert soumet une proposition
CREATE POLICY "propositions: expert insert"
  ON propositions FOR INSERT
  WITH CHECK (expert_id = auth.uid());

-- Le client accepte/refuse, l'expert modifie la sienne, admin fait tout
CREATE POLICY "propositions: participant update"
  ON propositions FOR UPDATE
  USING (
    client_id = auth.uid()
    OR expert_id = auth.uid()
    OR auth_is_admin()
  );

CREATE POLICY "propositions: admin delete"
  ON propositions FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 8. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: owner read"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() OR auth_is_admin());

-- Les Edge Functions (service role) insèrent les notifs
-- Le service role bypass RLS automatiquement
CREATE POLICY "notifications: admin insert"
  ON notifications FOR INSERT
  WITH CHECK (auth_is_admin());

CREATE POLICY "notifications: owner mark read"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "notifications: admin delete"
  ON notifications FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 9. REVIEWS
-- ────────────────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Lecture publique (crédibilité marketplace)
CREATE POLICY "reviews: public read"
  ON reviews FOR SELECT
  USING (true);

-- Seul un client authentifié peut laisser un avis
CREATE POLICY "reviews: authenticated insert"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Pas de modification d'avis (intégrité)
-- Admin peut supprimer un avis abusif
CREATE POLICY "reviews: admin delete"
  ON reviews FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 10. REFERRALS
-- ────────────────────────────────────────────────────────────
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals: own or admin read"
  ON referrals FOR SELECT
  USING (
    referrer_id = auth.uid()
    OR referred_id = auth.uid()
    OR auth_is_admin()
  );

CREATE POLICY "referrals: system insert"
  ON referrals FOR INSERT
  WITH CHECK (referred_id = auth.uid() OR auth_is_admin());

CREATE POLICY "referrals: admin delete"
  ON referrals FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 11. SUPPORT TICKETS
-- ────────────────────────────────────────────────────────────
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets: owner or admin read"
  ON support_tickets FOR SELECT
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "support_tickets: authenticated insert"
  ON support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- L'admin résout les tickets (ai_response, status, resolved_at)
CREATE POLICY "support_tickets: admin update"
  ON support_tickets FOR UPDATE
  USING (auth_is_admin());

CREATE POLICY "support_tickets: admin delete"
  ON support_tickets FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 12. PENDING APPROVALS
-- ────────────────────────────────────────────────────────────
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;

-- Seul l'admin voit et gère les approbations
CREATE POLICY "pending_approvals: admin only"
  ON pending_approvals FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 13. CRM CONTACTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contacts: admin only"
  ON crm_contacts FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 14. CRM ACTIVITIES
-- ────────────────────────────────────────────────────────────
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_activities: admin only"
  ON crm_activities FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 15. ACADEMY COURSES
-- ────────────────────────────────────────────────────────────
ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;

-- Lecture publique des cours publiés
CREATE POLICY "academy_courses: public read published"
  ON academy_courses FOR SELECT
  USING (statut = 'published' OR auth_is_admin());

-- Seul l'admin crée et modifie les cours
CREATE POLICY "academy_courses: admin write"
  ON academy_courses FOR INSERT
  WITH CHECK (auth_is_admin());

CREATE POLICY "academy_courses: admin update"
  ON academy_courses FOR UPDATE
  USING (auth_is_admin());

CREATE POLICY "academy_courses: admin delete"
  ON academy_courses FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 16. ACADEMY ENROLLMENTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_enrollments: own or admin read"
  ON academy_enrollments FOR SELECT
  USING (user_id = auth.uid() OR auth_is_admin());

-- Après paiement Stripe (Edge Function avec service role)
CREATE POLICY "academy_enrollments: own insert"
  ON academy_enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "academy_enrollments: admin update"
  ON academy_enrollments FOR UPDATE
  USING (auth_is_admin());

CREATE POLICY "academy_enrollments: admin delete"
  ON academy_enrollments FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 17. AGENT TABLES (AI Workforce)
--     Toutes admin-only en lecture depuis le client.
--     Les Edge Functions utilisent le service role (bypass RLS).
-- ────────────────────────────────────────────────────────────
ALTER TABLE agent_actions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_actions_log: admin or mission owner read"
  ON agent_actions_log FOR SELECT
  USING (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = agent_actions_log.mission_id
        AND (m.client_id = auth.uid() OR m.expert_id = auth.uid())
    )
  );
CREATE POLICY "agent_actions_log: admin write"
  ON agent_actions_log FOR INSERT
  WITH CHECK (auth_is_admin());

ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_reports: admin only"
  ON agent_reports FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

ALTER TABLE agent_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_missions: admin only"
  ON agent_missions FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

ALTER TABLE agent_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_outputs: admin or mission owner read"
  ON agent_outputs FOR SELECT
  USING (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM missions m
      WHERE m.id = agent_outputs.mission_id
        AND (m.client_id = auth.uid() OR m.expert_id = auth.uid())
    )
  );
CREATE POLICY "agent_outputs: admin write"
  ON agent_outputs FOR INSERT
  WITH CHECK (auth_is_admin());

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents: admin only"
  ON ai_agents FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_tasks: admin only"
  ON ai_tasks FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflow_runs: admin only"
  ON workflow_runs FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- VÉRIFICATION FINALE
-- Après l'exécution, vérifier avec :
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
-- ────────────────────────────────────────────────────────────
