-- 0005_store_functions.sql — ZOHA — server-side atomic mutations (PRD Rule 6).
-- Number noted for the group chat per MASTER_PLAN §11a.7 before any PR.
--
-- create_purchase_order: supplier + items resolved by name OR id (same fuzzy
--   matching as the in-memory service), per-item tax from tax_decisions,
--   PO + items + sequence bump in ONE transaction.
-- receive_goods(p_code): PO → received + inventory_movements rows + stock-cache
--   trigger fires inside the SAME transaction, or everything rolls back
--   (PRD Rule 7). Idempotence: a received/cancelled PO raises PO_ALREADY_RECEIVED.

-- ─────────────────────────────────────────────────────────────────────────────
-- Fuzzy product resolution — mirrors store.ts findProduct (token overlap):
-- every ≥3-char alphanumeric token of the query must prefix-match a token of
-- name + category; common stopwords are filtered in the services layer.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function resolve_product(p_org uuid, p_ref text)
returns uuid language plpgsql stable as $$
declare
  v_id uuid;
  v_qtext text := regexp_replace(lower(trim(p_ref)), '[^a-z0-9]+', ' ', 'g');
begin
  select id into v_id from products
   where organization_id = p_org
     and (sku = p_ref or lower(name) = lower(trim(p_ref)))
   limit 1;
  if v_id is not null then return v_id; end if;

  select p.id into v_id
  from products p
  where p.organization_id = p_org
    and exists (
      select 1 from unnest(string_to_array(v_qtext, ' ')) qtk
      where length(qtk) >= 3
    )
    and not exists (
      select 1 from unnest(string_to_array(v_qtext, ' ')) qtk
      where length(qtk) >= 3
        and not exists (
          select 1
          from unnest(string_to_array(
                 regexp_replace(lower(p.name || ' ' || p.category), '[^a-z0-9]+', ' ', 'g'), ' '
               )) ntk
          where ntk = qtk
             or position(qtk in ntk) = 1
             or position(ntk in qtk) = 1
        )
    )
  limit 1;
  return v_id;
end;
$$;

create or replace function resolve_supplier(p_org uuid, p_ref text)
returns uuid language plpgsql stable as $$
declare v_id uuid;
begin
  select id into v_id from suppliers
   where organization_id = p_org and (id::text = p_ref or lower(name) = lower(trim(p_ref)))
   limit 1;
  if v_id is not null then return v_id; end if;
  select id into v_id from suppliers
   where organization_id = p_org
     and (lower(name) like '%' || lower(trim(p_ref)) || '%'
          or lower(trim(p_ref)) like '%' || lower(name) || '%')
   limit 1;
  return v_id;
end;
$$;

create or replace function resolve_customer(p_org uuid, p_ref text)
returns uuid language plpgsql stable as $$
declare v_id uuid;
begin
  select id into v_id from customers
   where organization_id = p_org and (id::text = p_ref or lower(name) = lower(trim(p_ref)))
   limit 1;
  if v_id is not null then return v_id; end if;
  select id into v_id from customers
   where organization_id = p_org
     and (lower(name) like '%' || lower(trim(p_ref)) || '%'
          or lower(trim(p_ref)) like '%' || lower(name) || '%')
   limit 1;
  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- create_purchase_order — atomic PO creation with tax computation
-- p_items: [{ "product": "Reactive Dye Blue", "quantity": 100, "unit_price": 900? }]
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function create_purchase_order(
  p_org uuid,
  p_supplier text,
  p_items jsonb,
  p_created_by uuid default null
)
returns jsonb language plpgsql as $$
declare
  v_supplier uuid;
  v_err text;
  v_rec record;
  v_product_row products;
  v_price numeric;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_total numeric := 0;
  v_code text;
  v_po uuid;
begin
  v_supplier := resolve_supplier(p_org, p_supplier);
  if v_supplier is null then
    raise exception 'SUPPLIER_NOT_FOUND: %', p_supplier;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'VALIDATION_ERROR: items must be a non-empty array';
  end if;

  create temp table po_line on commit drop as
    select (x->>'product') as product_ref,
           (x->>'quantity')::numeric as quantity,
           nullif(x->>'unit_price', '')::numeric as unit_price
    from jsonb_array_elements(p_items) x;

  if exists (select 1 from po_line where quantity is null or quantity <= 0) then
    raise exception 'VALIDATION_ERROR: every item needs quantity > 0';
  end if;

  -- resolve every product FIRST so a bad line aborts before any write
  select 'PRODUCT_NOT_FOUND: ' || l.product_ref into v_err
  from po_line l
  where resolve_product(p_org, l.product_ref) is null
  limit 1;
  if v_err is not null then
    raise exception '%', v_err;
  end if;

  v_code := 'PO-' || next_org_code(p_org, 'purchase_order');

  insert into purchase_orders (organization_id, code, supplier_id, status, total_amount, created_by)
  values (p_org, v_code, v_supplier, 'pending', 0, p_created_by)
  returning id into v_po;

  for v_rec in select * from po_line loop
    select * into v_product_row from products
     where id = resolve_product(p_org, v_rec.product_ref);
    v_price := coalesce(v_rec.unit_price, v_product_row.cost_price);
    v_tax_rate := coalesce((
      select tax_rate from tax_decisions
       where organization_id = p_org and category = v_product_row.category
       order by effective_date desc limit 1
    ), 0);
    v_tax_amount := round(v_price * v_rec.quantity * v_tax_rate);
    v_total := v_total + v_price * v_rec.quantity + v_tax_amount;

    insert into purchase_order_items
      (organization_id, purchase_order_id, product_id, quantity, unit_price, tax_amount)
    values
      (p_org, v_po, v_product_row.id, v_rec.quantity, v_price, v_tax_amount);
  end loop;

  update purchase_orders set total_amount = v_total where id = v_po;

  return jsonb_build_object(
    'po_id', v_code,
    'supplier', (select name from suppliers where id = v_supplier),
    'items', (
      select jsonb_agg(jsonb_build_object(
        'product', pr.name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'tax_amount', i.tax_amount
      ) order by pr.name)
      from purchase_order_items i
      join products pr on pr.id = i.product_id
      where i.purchase_order_id = v_po
    ),
    'total', v_total,
    'status', 'pending'
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- receive_goods — atomic: PO → received + movements + stock cache (Rule 7)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function receive_goods(p_org uuid, p_po_code text)
returns jsonb language plpgsql as $$
declare
  v_po purchase_orders;
  v_now timestamptz := now();
begin
  select * into v_po from purchase_orders
   where organization_id = p_org and code = p_po_code
   for update;
  if not found then
    raise exception 'PO_NOT_FOUND: %', p_po_code;
  end if;
  if v_po.status <> 'pending' then
    raise exception 'PO_ALREADY_RECEIVED: % is %', p_po_code, v_po.status;
  end if;

  update purchase_orders
     set status = 'received', received_at = v_now
   where id = v_po.id;

  insert into inventory_movements
    (organization_id, product_id, delta, movement_type, reference_type, reference_id, created_at)
  select v_po.organization_id, i.product_id, i.quantity, 'purchase_receipt', 'purchase_order', p_po_code, v_now
  from purchase_order_items i
  where i.purchase_order_id = v_po.id;

  return jsonb_build_object(
    'po_id', p_po_code,
    'status', 'received',
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product', pr.name,
        'quantity_received', i.quantity,
        'new_stock', pr.current_stock
      ) order by pr.name), '[]'::jsonb)
      from purchase_order_items i
      join products pr on pr.id = i.product_id
      where i.purchase_order_id = v_po.id
    )
  );
end;
$$;
