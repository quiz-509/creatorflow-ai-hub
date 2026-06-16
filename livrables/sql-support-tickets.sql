-- Table support_tickets : tickets de support clients/experts, traités par le Support AI Agent
CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  ai_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_support_tickets" ON support_tickets
  FOR ALL USING (auth_is_admin());

CREATE POLICY "users_read_own_tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_create_own_tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
