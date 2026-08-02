-- Supprime les doublons éventuels en conservant la ligne la plus récente
DELETE FROM client_memory a
USING client_memory b
WHERE a.updated_at < b.updated_at
  AND a.client_email = b.client_email
  AND a.department = b.department;

-- Contrainte unique nécessaire pour les upserts par (client_email, department)
ALTER TABLE client_memory
  ADD CONSTRAINT client_memory_email_dept_unique
  UNIQUE (client_email, department);
