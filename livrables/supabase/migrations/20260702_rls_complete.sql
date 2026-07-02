-- ============================================================
-- CreatorFlow Market — RLS Complet & Sécurisé
-- Migration : 2026-07-02
-- Idempotente : DROP IF EXISTS avant chaque policy.
-- À appliquer dans : Supabase > SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Fonction helper : identifier l'admin
-- SECURITY DEFINER = impossible à bypass depuis le frontend.
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

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE profiles SET is_admin = true
WHERE email = 'pjoacenel@gmail.com';


-- ────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profils visibles authentifiés" ON profiles;
DROP POLICY IF EXISTS "Utilisateur gère son profil" ON profiles;
DROP POLICY IF EXISTS "profiles: self read" ON profiles;
DROP POLICY IF EXISTS "profiles: self insert" ON profiles;
DROP POLICY IF EXISTS "profiles: self update" ON profiles;
DROP POLICY IF EXISTS "profiles: admin delete" ON profiles;

CREATE POLICY "profiles: select"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR auth_is_admin()
    OR (type_utilisateur = 'expert')
  );

CREATE POLICY "profiles: insert"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: update"
  ON profiles FOR UPDATE
  USING (id = auth.uid() OR auth_is_admin())
  WITH CHECK (id = auth.uid() OR auth_is_admin());

CREATE POLICY "profiles: delete"
  ON profiles FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 2. EXPERTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE experts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Experts visibles par tous" ON experts;
DROP POLICY IF EXISTS "Expert gère son profil" ON experts;
DROP POLICY IF EXISTS "experts: public read approved" ON experts;
DROP POLICY IF EXISTS "experts: self insert" ON experts;
DROP POLICY IF EXISTS "experts: self or admin update" ON experts;
DROP POLICY IF EXISTS "experts: admin delete" ON experts;

CREATE POLICY "experts: select"
  ON experts FOR SELECT
  USING (statut = 'approved' OR id = auth.uid() OR auth_is_admin());

CREATE POLICY "experts: insert"
  ON experts FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "experts: update"
  ON experts FOR UPDATE
  USING (id = auth.uid() OR auth_is_admin())
  WITH CHECK (id = auth.uid() OR auth_is_admin());

CREATE POLICY "experts: delete"
  ON experts FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 3. MISSIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants voient leurs missions" ON missions;
DROP POLICY IF EXISTS "Client crée une mission" ON missions;
DROP POLICY IF EXISTS "Participants mettent à jour la mission" ON missions;
DROP POLICY IF EXISTS "missions: participant read" ON missions;
DROP POLICY IF EXISTS "missions: client insert" ON missions;
DROP POLICY IF EXISTS "missions: participant or admin update" ON missions;
DROP POLICY IF EXISTS "missions: admin delete" ON missions;

CREATE POLICY "missions: select"
  ON missions FOR SELECT
  USING (client_id = auth.uid() OR expert_id = auth.uid() OR auth_is_admin());

CREATE POLICY "missions: insert"
  ON missions FOR INSERT
  WITH CHECK (client_id = auth.uid() OR auth_is_admin());

CREATE POLICY "missions: update"
  ON missions FOR UPDATE
  USING (client_id = auth.uid() OR expert_id = auth.uid() OR auth_is_admin());

CREATE POLICY "missions: delete"
  ON missions FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 4. BRIEFS
-- ────────────────────────────────────────────────────────────
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Briefs visibles par authentifiés" ON briefs;
DROP POLICY IF EXISTS "Client crée un brief" ON briefs;
DROP POLICY IF EXISTS "Client met à jour son brief" ON briefs;
DROP POLICY IF EXISTS "briefs: owner or admin read" ON briefs;
DROP POLICY IF EXISTS "briefs: owner insert" ON briefs;
DROP POLICY IF EXISTS "briefs: owner or admin update" ON briefs;
DROP POLICY IF EXISTS "briefs: admin delete" ON briefs;

CREATE POLICY "briefs: select"
  ON briefs FOR SELECT
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "briefs: insert"
  ON briefs FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "briefs: update"
  ON briefs FOR UPDATE
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "briefs: delete"
  ON briefs FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 5. CONVERSATIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants voient leurs conversations" ON conversations;
DROP POLICY IF EXISTS "Participant crée une conversation" ON conversations;
DROP POLICY IF EXISTS "conversations: participant read" ON conversations;
DROP POLICY IF EXISTS "conversations: client insert" ON conversations;
DROP POLICY IF EXISTS "conversations: participant update" ON conversations;
DROP POLICY IF EXISTS "conversations: admin delete" ON conversations;

CREATE POLICY "conversations: select"
  ON conversations FOR SELECT
  USING (client_id = auth.uid() OR expert_id = auth.uid() OR auth_is_admin());

CREATE POLICY "conversations: insert"
  ON conversations FOR INSERT
  WITH CHECK (client_id = auth.uid() OR expert_id = auth.uid());

CREATE POLICY "conversations: update"
  ON conversations FOR UPDATE
  USING (client_id = auth.uid() OR expert_id = auth.uid() OR auth_is_admin());

CREATE POLICY "conversations: delete"
  ON conversations FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 6. MESSAGES
-- ────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants voient les messages" ON messages;
DROP POLICY IF EXISTS "Participant envoie un message" ON messages;
DROP POLICY IF EXISTS "messages: participant read" ON messages;
DROP POLICY IF EXISTS "messages: authenticated insert" ON messages;
DROP POLICY IF EXISTS "messages: admin delete" ON messages;

CREATE POLICY "messages: select"
  ON messages FOR SELECT
  USING (
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.client_id = auth.uid() OR c.expert_id = auth.uid())
    )
  );

CREATE POLICY "messages: insert"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.client_id = auth.uid() OR c.expert_id = auth.uid())
    )
  );

CREATE POLICY "messages: delete"
  ON messages FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 7. PROPOSITIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE propositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants voient les propositions" ON propositions;
DROP POLICY IF EXISTS "Expert soumet une proposition" ON propositions;
DROP POLICY IF EXISTS "Client met à jour le statut proposition" ON propositions;
DROP POLICY IF EXISTS "propositions: participant read" ON propositions;
DROP POLICY IF EXISTS "propositions: expert insert" ON propositions;
DROP POLICY IF EXISTS "propositions: participant update" ON propositions;
DROP POLICY IF EXISTS "propositions: admin delete" ON propositions;

CREATE POLICY "propositions: select"
  ON propositions FOR SELECT
  USING (client_id = auth.uid() OR expert_id = auth.uid() OR auth_is_admin());

CREATE POLICY "propositions: insert"
  ON propositions FOR INSERT
  WITH CHECK (expert_id = auth.uid());

CREATE POLICY "propositions: update"
  ON propositions FOR UPDATE
  USING (client_id = auth.uid() OR expert_id = auth.uid() OR auth_is_admin());

CREATE POLICY "propositions: delete"
  ON propositions FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 8. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: owner read" ON notifications;
DROP POLICY IF EXISTS "notifications: admin insert" ON notifications;
DROP POLICY IF EXISTS "notifications: owner mark read" ON notifications;
DROP POLICY IF EXISTS "notifications: admin delete" ON notifications;

CREATE POLICY "notifications: select"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "notifications: insert"
  ON notifications FOR INSERT
  WITH CHECK (auth_is_admin());

CREATE POLICY "notifications: update"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "notifications: delete"
  ON notifications FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 9. REVIEWS
-- ────────────────────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Avis visibles par tous" ON reviews;
DROP POLICY IF EXISTS "Clients soumettent des avis" ON reviews;
DROP POLICY IF EXISTS "reviews: public read" ON reviews;
DROP POLICY IF EXISTS "reviews: authenticated insert" ON reviews;
DROP POLICY IF EXISTS "reviews: admin delete" ON reviews;

CREATE POLICY "reviews: select"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "reviews: insert"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "reviews: delete"
  ON reviews FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 10. REFERRALS
-- ────────────────────────────────────────────────────────────
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals: own or admin read" ON referrals;
DROP POLICY IF EXISTS "referrals: system insert" ON referrals;
DROP POLICY IF EXISTS "referrals: admin delete" ON referrals;

CREATE POLICY "referrals: select"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR auth_is_admin());

CREATE POLICY "referrals: insert"
  ON referrals FOR INSERT
  WITH CHECK (referred_id = auth.uid() OR auth_is_admin());

CREATE POLICY "referrals: delete"
  ON referrals FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 11. SUPPORT TICKETS
-- ────────────────────────────────────────────────────────────
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets: owner or admin read" ON support_tickets;
DROP POLICY IF EXISTS "support_tickets: authenticated insert" ON support_tickets;
DROP POLICY IF EXISTS "support_tickets: admin update" ON support_tickets;
DROP POLICY IF EXISTS "support_tickets: admin delete" ON support_tickets;

CREATE POLICY "support_tickets: select"
  ON support_tickets FOR SELECT
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "support_tickets: insert"
  ON support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "support_tickets: update"
  ON support_tickets FOR UPDATE
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "support_tickets: delete"
  ON support_tickets FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 12. PENDING APPROVALS (admin seulement)
-- ────────────────────────────────────────────────────────────
ALTER TABLE pending_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_approvals: admin only" ON pending_approvals;

CREATE POLICY "pending_approvals: admin only"
  ON pending_approvals FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 13. CRM CONTACTS (admin seulement)
-- ────────────────────────────────────────────────────────────
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_contacts: admin only" ON crm_contacts;

CREATE POLICY "crm_contacts: admin only"
  ON crm_contacts FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 14. CRM ACTIVITIES (admin seulement)
-- ────────────────────────────────────────────────────────────
ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_activities: admin only" ON crm_activities;

CREATE POLICY "crm_activities: admin only"
  ON crm_activities FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 15. ACADEMY COURSES
-- ────────────────────────────────────────────────────────────
ALTER TABLE academy_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academy_courses: public read published" ON academy_courses;
DROP POLICY IF EXISTS "academy_courses: admin write" ON academy_courses;
DROP POLICY IF EXISTS "academy_courses: admin update" ON academy_courses;
DROP POLICY IF EXISTS "academy_courses: admin delete" ON academy_courses;
DROP POLICY IF EXISTS "Cours publiés visibles" ON academy_courses;

CREATE POLICY "academy_courses: select"
  ON academy_courses FOR SELECT
  USING (statut = 'published' OR statut = 'publié' OR auth_is_admin());

CREATE POLICY "academy_courses: insert"
  ON academy_courses FOR INSERT
  WITH CHECK (auth_is_admin());

CREATE POLICY "academy_courses: update"
  ON academy_courses FOR UPDATE
  USING (auth_is_admin());

CREATE POLICY "academy_courses: delete"
  ON academy_courses FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 16. ACADEMY ENROLLMENTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateur voit ses inscriptions" ON academy_enrollments;
DROP POLICY IF EXISTS "Utilisateur crée ses inscriptions" ON academy_enrollments;
DROP POLICY IF EXISTS "Utilisateur met à jour sa progression" ON academy_enrollments;
DROP POLICY IF EXISTS "academy_enrollments: own or admin read" ON academy_enrollments;
DROP POLICY IF EXISTS "academy_enrollments: own insert" ON academy_enrollments;
DROP POLICY IF EXISTS "academy_enrollments: admin update" ON academy_enrollments;
DROP POLICY IF EXISTS "academy_enrollments: admin delete" ON academy_enrollments;

CREATE POLICY "academy_enrollments: select"
  ON academy_enrollments FOR SELECT
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "academy_enrollments: insert"
  ON academy_enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "academy_enrollments: update"
  ON academy_enrollments FOR UPDATE
  USING (user_id = auth.uid() OR auth_is_admin());

CREATE POLICY "academy_enrollments: delete"
  ON academy_enrollments FOR DELETE
  USING (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 17. AI WORKFORCE — tables internes
-- Les Edge Functions utilisent le service role (bypass RLS auto).
-- Le client ne peut lire que ce qui le concerne.
-- ────────────────────────────────────────────────────────────
ALTER TABLE agent_actions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_actions_log: admin or mission owner read" ON agent_actions_log;
DROP POLICY IF EXISTS "agent_actions_log: admin write" ON agent_actions_log;

CREATE POLICY "agent_actions_log: select"
  ON agent_actions_log FOR SELECT
  USING (auth_is_admin());

CREATE POLICY "agent_actions_log: insert"
  ON agent_actions_log FOR INSERT
  WITH CHECK (auth_is_admin());

-- agent_reports
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_reports: admin only" ON agent_reports;
DROP POLICY IF EXISTS "agent_reports_service" ON agent_reports;

CREATE POLICY "agent_reports: admin only"
  ON agent_reports FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- agent_missions
ALTER TABLE agent_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_missions: admin only" ON agent_missions;

CREATE POLICY "agent_missions: admin only"
  ON agent_missions FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- agent_memory
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_memory_service" ON agent_memory;
DROP POLICY IF EXISTS "agent_memory: admin only" ON agent_memory;

CREATE POLICY "agent_memory: admin only"
  ON agent_memory FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- ai_agents
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agents: admin only" ON ai_agents;

CREATE POLICY "ai_agents: admin only"
  ON ai_agents FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- ai_tasks
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_tasks: admin only" ON ai_tasks;

CREATE POLICY "ai_tasks: admin only"
  ON ai_tasks FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- workflow_runs
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_runs: admin only" ON workflow_runs;

CREATE POLICY "workflow_runs: admin only"
  ON workflow_runs FOR ALL
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- 18. CLIENT FILES
-- ────────────────────────────────────────────────────────────
ALTER TABLE client_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_files_own_select" ON client_files;
DROP POLICY IF EXISTS "client_files_service" ON client_files;

CREATE POLICY "client_files: select"
  ON client_files FOR SELECT
  USING (auth.uid() = client_id OR auth_is_admin());

CREATE POLICY "client_files: insert"
  ON client_files FOR INSERT
  WITH CHECK (auth.uid() = client_id OR auth_is_admin());

CREATE POLICY "client_files: delete"
  ON client_files FOR DELETE
  USING (auth.uid() = client_id OR auth_is_admin());


-- ────────────────────────────────────────────────────────────
-- VÉRIFICATION FINALE — coller dans un 2e onglet SQL Editor
-- pour confirmer que le RLS est actif sur toutes les tables.
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Résultat attendu : rowsecurity = true sur toutes les lignes.
-- ────────────────────────────────────────────────────────────
