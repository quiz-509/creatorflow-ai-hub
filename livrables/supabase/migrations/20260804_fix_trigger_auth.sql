-- Fix : les triggers on_brief_insert et on_internal_request_insert utilisaient
-- current_setting('app.service_role_key', true) pour s'authentifier auprès des
-- Edge Functions. Cette valeur n'a jamais pu être configurée : sur Supabase managé,
-- le rôle "postgres" du dashboard n'a pas les droits pour ALTER DATABASE ... SET
-- un paramètre custom (ERROR 42501: permission denied to set parameter).
--
-- Conséquence en prod : Authorization: Bearer <vide> → rejeté par la passerelle
-- Supabase (401) avant même d'atteindre le code de la fonction. Le bloc
-- EXCEPTION WHEN OTHERS avalait l'erreur silencieusement — le brief/la requête
-- s'insérait normalement, mais Aria/Léo/Maya/Kai ne recevaient jamais l'appel.
--
-- Fix : réutiliser le même token que les pg_cron heartbeats (déjà fonctionnel en
-- prod, cf. 20260801_pg_cron_content_prospecting_support.sql) — une clé publique
-- Supabase suffit pour passer la vérification JWT de la passerelle, les fonctions
-- utilisent leur propre SUPABASE_SERVICE_ROLE_KEY en interne pour écrire en DB.

CREATE OR REPLACE FUNCTION notify_brief_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/marketing-heartbeat',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei"}'::jsonb,
    body := jsonb_build_object('action', 'intake_only', 'brief_id', NEW.id::text)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_brief_intake] pg_net error for brief %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_internal_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_function_name text;
BEGIN
  v_function_name := CASE NEW.to_dept
    WHEN 'content'     THEN 'content-heartbeat'
    WHEN 'prospecting' THEN 'prospecting-heartbeat'
    WHEN 'support'     THEN 'support-heartbeat'
    ELSE NULL
  END;

  IF v_function_name IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://cjtglfutckaogsmwhfsv.supabase.co/functions/v1/' || v_function_name,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_KGyuEEu7EqdF0xiLaL9dig_UZKnu9Ei"}'::jsonb,
    body := jsonb_build_object('action', 'process_request', 'request_id', NEW.id::text, 'to_dept', NEW.to_dept)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_internal_request] pg_net error for request % → %: %', NEW.id, NEW.to_dept, SQLERRM;
  RETURN NEW;
END;
$$;
