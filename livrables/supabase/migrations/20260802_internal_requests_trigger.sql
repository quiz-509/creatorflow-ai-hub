-- Trigger event-driven : internal_request créé → collaborateur traite immédiatement
-- Élimine la latence de 24h entre Aria et ses collaborateurs (Léo, Maya, Kai)

CREATE OR REPLACE FUNCTION notify_internal_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_function_name text;
BEGIN
  -- Mapper le département vers la Edge Function correspondante
  v_function_name := CASE NEW.to_dept
    WHEN 'content'     THEN 'content-heartbeat'
    WHEN 'prospecting' THEN 'prospecting-heartbeat'
    WHEN 'support'     THEN 'support-heartbeat'
    ELSE NULL
  END;

  IF v_function_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Appel asynchrone via pg_net — ne bloque pas l'INSERT
  PERFORM net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/' || v_function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'action', 'process_request',
      'request_id', NEW.id::text,
      'to_dept', NEW.to_dept
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_internal_request] pg_net error for request % → %: %', NEW.id, NEW.to_dept, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_internal_request_insert ON internal_requests;

CREATE TRIGGER on_internal_request_insert
  AFTER INSERT ON internal_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_internal_request();
