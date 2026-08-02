-- Trigger event-driven : brief soumis → Aria traitée dans les secondes, pas 24h

-- Fonction déclenchée sur chaque INSERT dans la table briefs
CREATE OR REPLACE FUNCTION notify_brief_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Appel asynchrone via pg_net — ne bloque pas l'INSERT
  PERFORM net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/marketing-heartbeat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'action', 'intake_only',
      'brief_id', NEW.id::text
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'INSERT client si le trigger échoue
  RAISE WARNING '[notify_brief_intake] pg_net error for brief %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Supprimer l'ancien trigger si il existe
DROP TRIGGER IF EXISTS on_brief_insert ON briefs;

-- Créer le trigger AFTER INSERT
CREATE TRIGGER on_brief_insert
  AFTER INSERT ON briefs
  FOR EACH ROW
  EXECUTE FUNCTION notify_brief_intake();
