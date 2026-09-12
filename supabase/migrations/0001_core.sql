-- 0001_core.sql — ZOHA — the 12 core tables (PRD §11 verbatim intent).
-- Run order: 0001 → 0002 → 0003 → 0004 → 0005 → seed.sql
-- Conventions: UUID PKs (gen_random_uuid()), organization_id on every business
-- table (PRD Rule 1), CHECK constraints for quantities/amounts, org indexes.
-- Human-readable codes (PO-15, INV-101, e-3, m-4) come from per-org sequences
-- so tool responses keep the shapes already consumed by screens and chat.

create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- Organizations & profiles (auth/org model — CONTRACTS §7)
-- ─────────────────────────────────────────────────────────────────────────────

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_org_idx on profiles (organization_id);

-- Helper used by RLS policies (0004) and services: org of the current JWT.
create or replace function current_org_id() returns uuid
language sql stable as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id',
    ''
  )::uuid;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Per-org numbering sequences (PO-15, INV-101, …)
-- ─────────────────────────────────────────────────────────────────────────────

create table org_sequences (
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null check (name in ('purchase_order', 'sales_order', 'cashbook', 'movement')),
  value bigint not null default 0,
  primary key (org_id, name)
);

create or replace function next_org_code(p_org uuid, p_name text) returns bigint
language plpgsql as $$
declare
  v bigint;
begin
  insert into org_sequences as s (org_id, name, value)
  values (p_org, p_name, 1)
  on conflict (org_id, name) do update set value = s.value + 1
  returning value into v;
  return v;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Master data
-- ─────────────────────────────────────────────────────────────────────────────

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null default 'other',
  unit text not null default 'kg',
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  reorder_threshold numeric(12,2) not null default 0 check (reorder_threshold >= 0),
  current_stock numeric(12,2) not null default 0,  -- cache (Rules 4–7); only the movement trigger writes it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_org_sku_uq on products (organization_id, sku);
create index products_org_name_trgm on products using gin (name gin_trgm_ops);
create index products_org_idx on products (organization_id);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  city text,
  phone text,
  email text,
  lead_time_days int not null default 7 check (lead_time_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suppliers_org_idx on suppliers (organization_id);

create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  city text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_org_idx on customers (organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Purchase orders
-- ───────────────── pending|received|cancelled ────────────────────────────────
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,                             -- 'PO-15' style display code
  supplier_id uuid not null references suppliers(id),
  status text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  received_at timestamptz,
  unique (organization_id, code)
);
create index purchase_orders_org_status_idx on purchase_orders (organization_id, status);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0)
);
create index purchase_order_items_org_po_idx on purchase_order_items (organization_id, purchase_order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sales orders — unpaid|paid (matches services/sales.ts exactly)
-- ─────────────────────────────────────────────────────────────────────────────
create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,                             -- 'INV-101' style display code
  customer_id uuid not null references customers(id),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  payment_status text not null default 'paid' check (payment_status in ('paid', 'unpaid')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index sales_orders_org_status_idx on sales_orders (organization_id, payment_status);

create table sales_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  sales_order_id uuid not null references sales_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  tax_rate numeric(6,4) not null default 0 check (tax_rate >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0)
);
create index sales_order_items_org_so_idx on sales_order_items (organization_id, sales_order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Inventory movements — single source of stock truth (PRD Rules 4–7)
-- ─────────────────────────────────────────────────────────────────────────────
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id),
  delta numeric(12,2) not null,
  movement_type text not null check (movement_type in ('purchase_receipt', 'sale_issue', 'adjustment')),
  reference_type text,                            -- 'purchase_order' | 'sale' | 'manual'
  reference_id text,
  created_at timestamptz not null default now()
);
create index inventory_movements_org_product_idx on inventory_movements (organization_id, product_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Cashbook & tax decisions
-- ─────────────────────────────────────────────────────────────────────────────
create table cashbook (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,                             -- 'e-3' style display code
  entry_type text not null check (entry_type in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'other',
  description text,
  reference_type text,
  reference_id text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index cashbook_org_created_idx on cashbook (organization_id, created_at desc);

create table tax_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  category text not null,
  tax_rate numeric(6,4) not null check (tax_rate >= 0),
  tax_type text not null default 'GST',
  source_document text not null,
  source_reference text,
  effective_date date not null,
  confidence numeric(4,3) not null default 1 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  unique (organization_id, category)
);
create index tax_decisions_org_idx on tax_decisions (organization_id);
