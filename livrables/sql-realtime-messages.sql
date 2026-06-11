-- Activer Supabase Realtime sur messages et conversations
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
