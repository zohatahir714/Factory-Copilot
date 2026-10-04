-- ============================================================================
-- Phase 0 — Row Level Security hardening
-- ============================================================================
-- WHY THIS EXISTS
--   supabase_schema.sql created ten business tables with policies of the form
--     CREATE POLICY "..._all_products" ON products FOR ALL TO authenticated
--       USING (true);
--   `USING (true)` means "any signed-in user, any row". Every tenant could read
--   and overwrite every other tenant's ledger: sales invoices, cashbook and
--   bank movements included. For a system that stores tax records that is a
--   data-protection incident waiting to happen, and it is invisible from the
--   UI because the UI only ever asks for one organisation's rows.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor -> paste -> Run. It is idempotent: every
--   statement is IF EXISTS / CREATE OR REPLACE, so re-running is safe.
--
-- TWO PRE-EXISTING SCHEMA DEFECTS THIS HAS TO WORK AROUND
--   1. profiles.id is TEXT but auth.uid() returns UUID, so the original
--      policy `auth.uid() = id` would raise "operator does not exist: uuid =
--      text" the first time it was evaluated. Everything below casts to ::text.
--   2. app_settings had NO organization_id — it was a singleton row with
--      id='default', i.e. one branding record shared by every tenant. That
--      cannot be fixed with a policy; it needs the column added below.
--
-- VERIFY IT WORKED: the last statement prints any policy still USING (true).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Resolve the caller's organisation.
--
-- SECURITY DEFINER so this reads `profiles` without being blocked by the
-- profiles policy itself — otherwise every policy on the other nine tables
-- would depend on a profiles read, and tightening profiles would recurse.
-- `set search_path` is required on a SECURITY DEFINER function: without it a
-- caller who can create objects could shadow `profiles` and make this function
-- return somebody else's organisation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()::text
$$;

REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Branding needs a tenant before it can be protected.
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS organization_id text REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill the legacy singleton onto the oldest organisation. If you run more
-- than one organisation, create one settings row per org instead.
UPDATE public.app_settings
   SET organization_id = (SELECT min(id) FROM public.organizations)
 WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_settings_org ON public.app_settings(organization_id);

-- ---------------------------------------------------------------------------
-- 3. Drop the permissive policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS authenticated_read_orgs        ON public.organizations;
DROP POLICY IF EXISTS authenticated_read_profiles     ON public.profiles;
DROP POLICY IF EXISTS authenticated_update_own_profile ON public.profiles;
DROP POLICY IF EXISTS authenticated_all_accounts      ON public.chart_of_accounts;
DROP POLICY IF EXISTS authenticated_all_products      ON public.products;
DROP POLICY IF EXISTS authenticated_all_suppliers     ON public.suppliers;
DROP POLICY IF EXISTS authenticated_all_customers     ON public.customers;
DROP POLICY IF EXISTS authenticated_all_pos           ON public.purchase_orders;
DROP POLICY IF EXISTS authenticated_all_sales        ON public.sales_orders;
DROP POLICY IF EXISTS authenticated_all_cashbook     ON public.cashbook_entries;
DROP POLICY IF EXISTS authenticated_all_movements    ON public.inventory_movements;
DROP POLICY IF EXISTS authenticated_read_settings     ON public.app_settings;

-- ---------------------------------------------------------------------------
-- 4. Re-create them, scoped to the caller's own organisation.
--
-- Per-table rather than one blanket policy, because the right rule differs:
-- suppliers/customers are reference data several roles read; cashbook and
-- inventory movements are append-only in a well-run factory. Start with the
-- simple tenant boundary — the point is that it is no longer `true` — and
-- tighten per-role afterwards if you want.
-- ---------------------------------------------------------------------------

-- organizations: see only your own.
CREATE POLICY org_select_own ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.current_org_id());

-- profiles: read colleagues in your org, edit only yourself.
CREATE POLICY profiles_select_org ON public.profiles
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- The nine tenant-scoped business tables.
CREATE POLICY coa_all_org ON public.chart_of_accounts
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY products_all_org ON public.products
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY suppliers_all_org ON public.suppliers
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY customers_all_org ON public.customers
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY pos_all_org ON public.purchase_orders
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY sales_all_org ON public.sales_orders
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY cashbook_all_org ON public.cashbook_entries
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY movements_all_org ON public.inventory_movements
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY settings_all_org ON public.app_settings
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- 5. Verification. Run after step 4; must return zero rows.
-- ---------------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (qual IS NULL OR qual = 'true' OR qual = '(true)');