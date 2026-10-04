-- ============================================================================
-- PRE-FLIGHT — run this BEFORE migration-2026-10-rls-hardening.sql
-- ============================================================================
-- WHY THIS FILE EXISTS
--   The RLS migration scopes every table with:
--
--       USING (organization_id = public.current_org_id())
--
--   and current_org_id() reads the caller's organisation out of `profiles`:
--
--       SELECT organization_id FROM public.profiles WHERE id = auth.uid()::text
--
--   Right now `organizations` and `profiles` are both EMPTY, and nothing in the
--   application ever writes a row to either table. So if you apply the RLS
--   migration on its own, current_org_id() returns NULL for every signed-in
--   user, `organization_id = NULL` is never true, and the app will sign in
--   successfully and then show an empty ledger — every product, invoice and
--   cashbook entry invisible.
--
--   That is not a migration bug. It is the migration working exactly as
--   designed against a tenant that does not exist yet. This file creates the
--   tenant.
--
-- SAFE TO RE-RUN: every statement is IF NOT EXISTS / ON CONFLICT.
-- Change the email below if you sign in with a different account.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The organisation the demo data belongs to.
--
-- 'org_demo' must match DEMO_ORGANIZATION_ID in src/data/fixtures.ts. Every
-- seeded product, supplier, customer and order already carries this id — this
-- only creates the row they point at.
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, city, sector)
VALUES ('org_demo', 'PakERP Demo Textile SME', 'Faisalabad', 'Textile manufacturing')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. The profile that links your sign-in to that organisation.
--
-- profiles.id is TEXT while auth.uid() returns UUID, which is why the
-- migration casts to ::text. Matched on email so you do not have to paste a
-- UUID by hand.
--
-- IF THIS UPDATES 0 ROWS, the email below does not match an auth user. Sign in
-- to the app once, then re-check the email — do not continue until this works.
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, organization_id, full_name, role, email)
SELECT u.id::text, 'org_demo', 'Demo Owner', 'owner', u.email
  FROM auth.users u
 WHERE u.email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE
   SET organization_id = EXCLUDED.organization_id,
       email = EXCLUDED.email;

-- ---------------------------------------------------------------------------
-- 3. Confirm the link actually resolved.
--
-- Expect exactly one row with organization_id = 'org_demo'.
-- If this returns nothing, your sign-in email is wrong — fix step 2 first.
-- ---------------------------------------------------------------------------
SELECT p.id, p.email, p.organization_id
  FROM public.profiles p;

-- ---------------------------------------------------------------------------
-- 4. Confirm no ledger row is left unscoped.
--
-- Rows with a NULL organization_id will be invisible once RLS is on, because
-- `organization_id = current_org_id()` can never be true for NULL. Anything
-- listed here gets attached to the demo tenant.
--
-- Expect zero rows. If you get some, run the UPDATE below, then re-run this.
-- ---------------------------------------------------------------------------
SELECT 'products' AS tbl, count(*) FROM public.products          WHERE organization_id IS NULL
UNION ALL SELECT 'suppliers',      count(*) FROM public.suppliers      WHERE organization_id IS NULL
UNION ALL SELECT 'customers',      count(*) FROM public.customers      WHERE organization_id IS NULL
UNION ALL SELECT 'purchase_orders',count(*) FROM public.purchase_orders WHERE organization_id IS NULL
UNION ALL SELECT 'sales_orders',   count(*) FROM public.sales_orders    WHERE organization_id IS NULL
UNION ALL SELECT 'cashbook',       count(*) FROM public.cashbook_entries WHERE organization_id IS NULL
UNION ALL SELECT 'movements',      count(*) FROM public.inventory_movements WHERE organization_id IS NULL
UNION ALL SELECT 'accounts',       count(*) FROM public.chart_of_accounts  WHERE organization_id IS NULL;

-- Uncomment ONLY if step 4 listed rows.
-- UPDATE public.products           SET organization_id = 'org_demo' WHERE organization_id IS NULL;
-- UPDATE public.suppliers          SET organization_id = 'org_demo' WHERE organization_id IS NULL;
-- UPDATE public.customers          SET organization_id = 'org_demo' WHERE organization_id IS NULL;
-- UPDATE public.purchase_orders    SET organization_id = 'org_demo' WHERE organization_id IS NULL;
-- UPDATE public.sales_orders       SET organization_id = 'org_demo' WHERE organization_id IS NULL;
-- UPDATE public.cashbook_entries   SET organization_id = 'org_demo' WHERE organization_id IS NULL;
-- UPDATE public.inventory_movements SET organization_id = 'org_demo' WHERE organization_id IS NULL;
-- UPDATE public.chart_of_accounts  SET organization_id = 'org_demo' WHERE organization_id IS NULL;
