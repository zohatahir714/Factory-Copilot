-- ============================================================================
-- PAKERP CLOUD-FIRST EVOLUTION — run once in Supabase Dashboard → SQL Editor
-- Aligns the schema with the app entities (items, sku, created_by, …) and
-- lets authenticated users persist branding. Safe to re-run (idempotent).
-- ============================================================================

-- 1. Columns the app entities need that the base schema lacked
alter table products add column if not exists sku text;
alter table suppliers add column if not exists lead_time_days integer default 7;

alter table purchase_orders add column if not exists supplier_name text;
alter table purchase_orders add column if not exists created_by text;
alter table purchase_orders add column if not exists items jsonb default '[]'::jsonb;

alter table sales_orders add column if not exists customer_name text;
alter table sales_orders add column if not exists created_by text;
alter table sales_orders add column if not exists items jsonb default '[]'::jsonb;

alter table cashbook_entries add column if not exists reference_id text;
alter table cashbook_entries add column if not exists reference_type text;

alter table chart_of_accounts add column if not exists category text;
alter table chart_of_accounts add column if not exists current_balance numeric(15,2) default 0;

-- 2. Branding must be writable by signed-in users (was SELECT-only)
drop policy if exists "authenticated_read_settings" on app_settings;
drop policy if exists "authenticated_all_settings" on app_settings;
create policy "authenticated_all_settings"
  on app_settings for all to authenticated
  using (true) with check (true);

-- 3. Indexes for the hot paths
create index if not exists idx_sales_created_at on sales_orders(created_at);
create index if not exists idx_cashbook_created_at on cashbook_entries(created_at);
create index if not exists idx_po_supplier on purchase_orders(supplier_id);
