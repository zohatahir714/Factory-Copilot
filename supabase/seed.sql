-- supabase/seed.sql — ZOHA — demo entities (PRD §38) mirroring the in-memory
-- store seed exactly, so demo numbers are identical on both backends.
-- Run AFTER migrations 0001–0005. Demo login: demo@copilot.pk / demo1234
-- (create that auth user in the Supabase dashboard or via the signup route;
-- the org/profile rows here use fixed UUIDs so re-runs stay idempotent).

begin;

-- Fixed UUIDs so re-running the seed never duplicates demo data.
-- org        : 11111111-1111-4111-8111-111111111111
-- owner prof.: 22222222-2222-4222-8222-222222222222  (attach to auth user)
-- products   : a1a1a1a1-… through a3a3a1a1-… (see below)
insert into organizations (id, name)
values ('11111111-1111-4111-8111-111111111111', 'Demo Textiles')
on conflict (id) do nothing;

-- The demo auth user must exist in Supabase Auth first (dashboard → add user).
-- If the user isn't created yet, comment this insert out, create the user, re-run.
insert into profiles (id, organization_id, role)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'owner')
on conflict (id) do nothing;

insert into products (id, organization_id, sku, name, category, unit, cost_price, selling_price, reorder_threshold, current_stock)
values
  ('a1a1a1a1-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'YRN-40S', 'Cotton Yarn 40s',  'yarn', 'kg', 850,  980,  50, 0),
  ('a2a2a2a2-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'DYE-BLU', 'Reactive Dye Blue', 'dye',  'kg', 900,  1100, 20, 0),
  ('a3a3a3a3-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'DYE-RED', 'Reactive Dye Red',  'dye',  'kg', 880,  1080, 25, 0)
on conflict (id) do nothing;
-- Stock is NOT set directly: current_stock only moves via inventory_movements
-- (the trigger is the sole writer). Opening stock comes from the movements below.

insert into suppliers (id, organization_id, name, city, lead_time_days)
values
  ('b1b1b1b1-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'ColorChem Dyes',     'Karachi',     5),
  ('b2b2b2b2-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Al-Noor Chemicals',  'Faisalabad',  7)
on conflict (id) do nothing;

insert into customers (id, organization_id, name, city)
values
  ('c1c1c1c1-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Al-Rehman Textiles', 'Faisalabad'),
  ('c2c2c2c2-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Sana Fabrics',       'Lahore')
on conflict (id) do nothing;

-- Tax decisions (Sidra's compliance domain will own these later — seed mirrors store.ts)
insert into tax_decisions (organization_id, category, tax_rate, tax_type, source_document, source_reference, effective_date, confidence)
values
  ('11111111-1111-4111-8111-111111111111', 'yarn', 0.18, 'GST', 'FBR Sales Tax Guide (demo seed)', 'demo://fbr/gst-18', '2026-07-01', 0.9),
  ('11111111-1111-4111-8111-111111111111', 'dye',  0.18, 'GST', 'FBR Sales Tax Guide (demo seed)', 'demo://fbr/gst-18', '2026-07-01', 0.9)
on conflict (organization_id, category) do nothing;

-- Sequence bookkeeping: PO-14/PO-15, INV-101/INV-102, e-1/e-2, m-1..m-3 exist.
insert into org_sequences (org_id, name, value)
values
  ('11111111-1111-4111-8111-111111111111', 'purchase_order', 15),
  ('11111111-1111-4111-8111-111111111111', 'sales_order',    102),
  ('11111111-1111-4111-8111-111111111111', 'cashbook',       2),
  ('11111111-1111-4111-8111-111111111111', 'movement',       3)
on conflict (org_id, name) do update set value = greatest(org_sequences.value, excluded.value);

-- PO-14 (received, from Al-Noor): Cotton Yarn 40s × 200 @ 850, GST 18% = 30,600 → total 200,600
insert into purchase_orders (id, organization_id, code, supplier_id, status, total_amount, created_at, received_at)
values ('d1d1d1d1-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'PO-14',
        'b2b2b2b2-2222-4222-8222-222222222222', 'received', 200600, now() - interval '72 hours', now() - interval '70 hours')
on conflict (organization_id, code) do nothing;

insert into purchase_order_items (organization_id, purchase_order_id, product_id, quantity, unit_price, tax_amount)
values ('11111111-1111-4111-8111-111111111111', 'd1d1d1d1-1111-4111-8111-111111111111',
        'a1a1a1a1-1111-4111-8111-111111111111', 200, 850, 30600);

-- PO-15 (pending, from ColorChem): Reactive Dye Blue × 100 @ 900, GST 18% = 16,200 → total 106,200
insert into purchase_orders (id, organization_id, code, supplier_id, status, total_amount, created_at)
values ('d2d2d2d2-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'PO-15',
        'b1b1b1b1-1111-4111-8111-111111111111', 'pending', 106200, now() - interval '8 hours')
on conflict (organization_id, code) do nothing;

insert into purchase_order_items (organization_id, purchase_order_id, product_id, quantity, unit_price, tax_amount)
values ('11111111-1111-4111-8111-111111111111', 'd2d2d2d2-2222-4222-8222-222222222222',
        'a2a2a2a2-2222-4222-8222-222222222222', 100, 900, 16200);

-- Sales (INV-101 paid, INV-102 unpaid) — same lines as the in-memory store.
-- NOTE: sales Orders do not move stock in the seed (movements below do);
-- the live recordSale service inserts both atomically at runtime.
insert into sales_orders (id, organization_id, code, customer_id, subtotal, tax_amount, total_amount, payment_status, created_at)
values
  ('e1e1e1e1-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'INV-101',
   'c1c1c1c1-1111-4111-8111-111111111111', 49000, 8820, 57820, 'paid',   now() - interval '20 hours'),
  ('e2e2e2e2-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'INV-102',
   'c2c2c2c2-2222-4222-8222-222222222222', 11000, 1980, 12980, 'unpaid', now() - interval '40 hours')
on conflict (organization_id, code) do nothing;

insert into sales_order_items (organization_id, sales_order_id, product_id, quantity, unit_price, tax_rate, tax_amount)
values
  ('11111111-1111-4111-8111-111111111111', 'e1e1e1e1-1111-4111-8111-111111111111',
   'a1a1a1a1-1111-4111-8111-111111111111', 50, 980, 0.18, 8820),
  ('11111111-1111-4111-8111-111111111111', 'e2e2e2e2-2222-4222-8222-222222222222',
   'a2a2a2a2-2222-4222-8222-222222222222', 10, 1100, 0.18, 1980);

-- Cashbook rows (e-1 sale income, e-2 utilities expense)
insert into cashbook (id, organization_id, code, entry_type, amount, category, description, reference_type, reference_id, created_at)
values
  ('f1f1f1f1-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'e-1', 'income',  57820, 'sales',     'Sale INV-101 to Al-Rehman Textiles', 'sale', 'INV-101', now() - interval '20 hours'),
  ('f2f2f2f2-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'e-2', 'expense',  5000, 'utilities', 'Electricity bill',                    null,   null,      now() - interval '26 hours')
on conflict (organization_id, code) do nothing;

-- Movements — the ONLY stock writer. Closing stock matches store.ts exactly:
--   Cotton Yarn 40s:  200 − 50 = 320
--   Reactive Dye Blue: 70 (opening history) − 10 = 60
--   Reactive Dye Red:  15 (opening history, no demo movements)
insert into inventory_movements (id, organization_id, product_id, delta, movement_type, reference_type, reference_id, created_at)
values
  ('9a9a9a91-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'a1a1a1a1-1111-4111-8111-111111111111',  200, 'purchase_receipt', 'purchase_order', 'PO-14',   now() - interval '70 hours'),
  ('9a9a9a91-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'a1a1a1a1-1111-4111-8111-111111111111',  -50, 'sale_issue',       'sale',           'INV-101', now() - interval '20 hours'),
  ('9a9a9a91-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'a2a2a2a2-2222-4222-8222-222222222222',   70, 'adjustment',       'manual',         'opening', now() - interval '50 hours'),
  ('9a9a9a91-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'a2a2a2a2-2222-4222-8222-222222222222',  -10, 'sale_issue',       'sale',           'INV-102', now() - interval '40 hours'),
  ('9a9a9a91-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'a3a3a3a3-3333-4333-8333-333333333333',   15, 'adjustment',       'manual',         'opening', now() - interval '55 hours');

commit;
