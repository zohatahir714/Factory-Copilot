-- 0004_rls.sql — ZOHA — RLS isolation (PRD §12, §19) + stock-cache trigger (Rules 4–7)
-- Read model: clients (anon/authenticated) may SELECT only their own org's rows.
-- Write model: clients may NOT write business rows at all — every mutation goes
-- through server routes using the service-role client (CONTRACTS §7, PRD Rules 2–3).
-- current_stock is writable ONLY by the movement trigger below — never by a
-- direct UPDATE (enforced by forbid_direct_stock_write()).

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger (all mutable tables)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'products', 'suppliers', 'customers',
    'purchase_orders', 'sales_orders', 'cashbook'
  ] loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Stock cache trigger — current_stock changes ONLY with a movement row
-- (PRD Rule 5: cache updated inside the txn that inserts the movement)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function sync_current_stock() returns trigger
language plpgsql as $$
begin
  update products
     set current_stock = current_stock + new.delta
   where id = new.product_id
     and organization_id = new.organization_id;
  if not found then
    raise exception 'MOVEMENT_ORPHAN: product % not found in org %', new.product_id, new.organization_id;
  end if;
  return new;
end;
$$;

create trigger inventory_movements_sync_stock
  after insert on inventory_movements
  for each row execute function sync_current_stock();

-- Direct client writes to the cache are forbidden even for the service role's
-- own safety net; the RPCs and seed insert movements instead of stock values.
create or replace function forbid_direct_stock_write() returns trigger
language plpgsql as $$
begin
  raise exception 'DIRECT_STOCK_WRITE_FORBIDDEN: change stock only via inventory_movements';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — org isolation on every table (PRD Rule 1, §19)
-- ─────────────────────────────────────────────────────────────────────────────

alter table organizations            enable row level security;
alter table profiles                 enable row level security;
alter table products                 enable row level security;
alter table suppliers                enable row level security;
alter table customers                enable row level security;
alter table purchase_orders          enable row level security;
alter table purchase_order_items     enable row level security;
alter table sales_orders             enable row level security;
alter table sales_order_items        enable row level security;
alter table inventory_movements      enable row level security;
alter table cashbook                 enable row level security;
alter table tax_decisions            enable row level security;
alter table org_sequences            enable row level security;

-- Members see their own organization.
create policy org_self_read on organizations
  for select using (id = current_org_id());

create policy profile_self_read on profiles
  for select using (organization_id = current_org_id());

-- Every business table: SELECT scoped to org; INSERT/UPDATE/DELETE denied to
-- client roles entirely (no policy = denied under RLS). The service-role key
-- bypasses RLS for the server-side services (CONTRACTS §7, PRD Rule 3).
create policy products_org_read on products
  for select using (organization_id = current_org_id());
create policy suppliers_org_read on suppliers
  for select using (organization_id = current_org_id());
create policy customers_org_read on customers
  for select using (organization_id = current_org_id());
create policy purchase_orders_org_read on purchase_orders
  for select using (organization_id = current_org_id());
create policy purchase_order_items_org_read on purchase_order_items
  for select using (organization_id = current_org_id());
create policy sales_orders_org_read on sales_orders
  for select using (organization_id = current_org_id());
create policy sales_order_items_org_read on sales_order_items
  for select using (organization_id = current_org_id());
create policy inventory_movements_org_read on inventory_movements
  for select using (organization_id = current_org_id());
create policy cashbook_org_read on cashbook
  for select using (organization_id = current_org_id());
create policy tax_decisions_org_read on tax_decisions
  for select using (organization_id = current_org_id());
create policy org_sequences_org_read on org_sequences
  for select using (org_id = current_org_id());
