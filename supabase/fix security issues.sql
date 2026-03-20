-- Supabase Migration: Fix Security Advisor Issues
-- Project: Fexio (mjdodpwwmluljhpfilsc)
-- Generated: 2026-03-18

-- ============================================================
-- 1. CRITICAL: Security Definer Views
--    Recreate views with SECURITY INVOKER so they respect RLS
-- ============================================================

-- WICHTIG: Ersetze <DEINE VIEW QUERY> mit der tatsächlichen Query.
-- Du findest sie im SQL Editor mit:
--   SELECT definition FROM pg_views WHERE viewname = 'monthly_revenue';
--   SELECT definition FROM pg_views WHERE viewname = 'project_time_summary';

DROP VIEW IF EXISTS public.monthly_revenue;
CREATE VIEW public.monthly_revenue
WITH (security_invoker = true)
AS
  -- TODO: Hier die bestehende View-Query einfügen
  SELECT 1; -- Platzhalter entfernen!

DROP VIEW IF EXISTS public.project_time_summary;
CREATE VIEW public.project_time_summary
WITH (security_invoker = true)
AS
  -- TODO: Hier die bestehende View-Query einfügen
  SELECT 1; -- Platzhalter entfernen!


-- ============================================================
-- 2. Function Search Path Mutable
--    Fixen des search_path um Schema-Manipulation zu verhindern
-- ============================================================

ALTER FUNCTION public.get_my_company_id() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;


-- ============================================================
-- 3. Auth RLS Initialization Plan
--    RLS auf bank_transactions aktivieren (falls noch nicht aktiv)
-- ============================================================

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. Multiple Permissive Policies auf bank_transactions
--    Erst prüfen welche Policies existieren, dann konsolidieren
-- ============================================================

-- Schritt 1: Zeige alle bestehenden Policies (im SQL Editor ausführen):
--   SELECT policyname, cmd, qual, with_check, permissive
--   FROM pg_policies
--   WHERE tablename = 'bank_transactions';

-- Schritt 2: Beispiel wie man Policies konsolidiert:
--   Lösche die zu breiten Policies und ersetze sie durch eine engere.
--   Passe die Namen und Bedingungen an deine Logik an.

-- DROP POLICY IF EXISTS "beispiel_alte_policy_1" ON public.bank_transactions;
-- DROP POLICY IF EXISTS "beispiel_alte_policy_2" ON public.bank_transactions;
-- DROP POLICY IF EXISTS "beispiel_alte_policy_3" ON public.bank_transactions;

-- CREATE POLICY "users_own_transactions" ON public.bank_transactions
--   FOR ALL
--   USING (
--     company_id = (SELECT public.get_my_company_id())
--   )
--   WITH CHECK (
--     company_id = (SELECT public.get_my_company_id())
--   );
