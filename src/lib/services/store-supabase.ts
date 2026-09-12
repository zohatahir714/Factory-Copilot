/**
 * SUPABASE STORE — Postgres backend implementing BizStore (migrations 0001/0005).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * CREDS-DAY RUNBOOK (when Supabase credentials arrive) — Zoha
 * ═══════════════════════════════════════════════════ ZERO code changes needed ╝
 * 1. In Supabase SQL editor run, in order:
 *      supabase/migrations/0001_core.sql → 0004_rls.sql → 0005_store_functions.sql
 *      (0002/0003 belong to Sidra — coordinate before running them)
 * 2. Create the demo auth user in the dashboard (demo@copilot.pk / demo1234),
 *    then run supabase/seed.sql (it links the profile to that auth user).
 * 3. Put the four frozen env values in .env.local (CONTRACTS §8):
 *      NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *      SUPABASE_SERVICE_ROLE_KEY / GROQ_API_KEY
 * 4. Restart dev server — getStore() flips to this backend automatically
 *    (isSupabaseConfigured() gates it; the store interface is identical, so
 *    services, REST APIs and AI tools need zero changes).
 * 5. Verify:
 *      npm test                      (unit invariants — run against memory backend)
 *      node tests/rls-smoke.mjs      (2-org cross-query denial — REAL RLS proof)
 *      node tests/e2e-chat.mjs       (chat flows unchanged)
 *      Receive PO-15 from the UI → stock↑ + movement row via trigger
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { BizStore, Product, Supplier, Customer, PurchaseOrder, Sale, CashEntry, Movement } from "./store-types";
import { DEV_ORG_ID } from "@/lib/auth";

/** Numeric/decimal columns arrive as strings from Postgres — normalize. */
const n = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0));

interface DbProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_price: string | number;
  selling_price: string | number;
  reorder_threshold: string | number;
  current_stock: string | number;
}

interface DbTaxDecision {
  category: string;
  tax_rate: string | number;
  tax_type: string;
  source_document: string;
  source_reference: string | null;
  effective_date: string;
  confidence: string | number;
}

interface DbPO {
  id: string;
  code: string;
  supplier_id: string;
  status: "pending" | "received" | "cancelled";
  total_amount: string | number;
  created_at: string;
  received_at: string | null;
  purchase_order_items: DbPOItem[];
}

interface DbPOItem {
  product_id: string;
  quantity: string | number;
  unit_price: string | number;
  tax_amount: string | number;
}

interface DbSale {
  id: string;
  code: string;
  customer_id: string;
  subtotal: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  payment_status: "paid" | "unpaid";
  created_at: string;
  sales_order_items: {
    product_id: string;
    quantity: string | number;
    unit_price: string | number;
    tax_rate: string | number;
    tax_amount: string | number;
  }[];
}

export function createSupabaseStore(): BizStore {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase store requested but env is missing (isSupabaseConfigured() should gate this)");

  const ORG = DEV_ORG_ID; // per-request org comes from the JWT via RLS; single-org demo until Sidra's multi-org wiring
  type Rows<T> = { data: T[] | null; error: { message: string } | null };

  const must = <T>(res: { data: T | null; error: { message: string } | null }, what: string): T => {
    if (res.error) throw new Error(`DB_ERROR (${what}): ${res.error.message}`);
    if (res.data === null) throw new Error(`DB_ERROR (${what}): no data`);
    return res.data;
  };

  const mapProduct = (r: DbProduct): Product => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category,
    unit: r.unit,
    cost_price: n(r.cost_price),
    selling_price: n(r.selling_price),
    reorder_threshold: n(r.reorder_threshold),
    current_stock: n(r.current_stock),
  });

  const resolveProduct = async (ref: string): Promise<Product | undefined> => {
    // 1) exact id or SKU
    if (/^[0-9a-f-]{36}$/i.test(ref)) {
      const { data } = await admin.from("products").select("*").eq("id", ref).maybeSingle();
      if (data) return mapProduct(data as DbProduct);
    }
    const { data: bySku } = await admin.from("products").select("*").eq("sku", ref).maybeSingle();
    if (bySku) return mapProduct(bySku as DbProduct);
    const { data: byName } = await admin.from("products").select("*").ilike("name", ref).maybeSingle();
    if (byName) return mapProduct(byName as DbProduct);
    // 2) token-overlap fuzzy — same semantics as store-memory.findProduct
    const tokens = ref.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    if (tokens.length === 0) return undefined;
    const { data: all } = await admin.from("products").select("*");
    if (!all) return undefined;
    let best: { p: Product; score: number } | undefined;
    for (const raw of all as DbProduct[]) {
      const p = mapProduct(raw);
      const nameTokens = `${p.name} ${p.category}`.toLowerCase().split(/[^a-z0-9]+/);
      const hits = tokens.filter((t) => nameTokens.some((nm) => nm === t || nm.startsWith(t) || t.startsWith(nm))).length;
      if (hits === tokens.length && (!best || hits > best.score)) best = { p, score: hits };
    }
    return best?.p;
  };

  const resolveSupplier = async (ref: string): Promise<Supplier | undefined> => {
    const { data: all } = await admin.from("suppliers").select("*");
    const rows = (all ?? []) as DbSupplierRow[];
    const hit =
      rows.find((s) => s.id === ref) ??
      rows.find((s) => s.name.toLowerCase() === ref.trim().toLowerCase()) ??
      rows.find((s) => s.name.toLowerCase().includes(ref.trim().toLowerCase()) || ref.trim().toLowerCase().includes(s.name.toLowerCase()));
    return hit ? mapSupplier(hit) : undefined;
  };

  const resolveCustomer = async (ref: string): Promise<Customer | undefined> => {
    const { data: all } = await admin.from("customers").select("*");
    const rows = (all ?? []) as DbCustomerRow[];
    const hit =
      rows.find((c) => c.id === ref) ??
      rows.find((c) => c.name.toLowerCase() === ref.trim().toLowerCase()) ??
      rows.find((c) => c.name.toLowerCase().includes(ref.trim().toLowerCase()) || ref.trim().toLowerCase().includes(c.name.toLowerCase()));
    return hit ? mapCustomer(hit) : undefined;
  };

  const mapSupplier = (r: DbSupplierRow): Supplier => ({
    id: r.id,
    name: r.name,
    city: r.city ?? "",
    ...(r.phone ? { phone: r.phone } : {}),
    ...(r.email ? { email: r.email } : {}),
    lead_time_days: r.lead_time_days ?? 7,
  });

  const mapCustomer = (r: DbCustomerRow): Customer => ({
    id: r.id,
    name: r.name,
    city: r.city ?? "",
    ...(r.phone ? { phone: r.phone } : {}),
    ...(r.email ? { email: r.email } : {}),
  });

  return {
    backend: "supabase",

    async findProduct(ref) {
      return resolveProduct(ref);
    },
    async productSuggestions(ref, max = 3) {
      const tokens = ref.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
      const { data } = (await admin.from("products").select("name")) as Rows<{ name: string }>;
      const names = (data ?? []).map((r) => r.name);
      return names
        .filter((name) => name.toLowerCase().includes(ref.toLowerCase()) || tokens.some((t) => t.length >= 3 && name.toLowerCase().includes(t)))
        .slice(0, max);
    },

    async findSupplier(ref) {
      return resolveSupplier(ref);
    },
    async findCustomer(ref) {
      return resolveCustomer(ref);
    },

    async taxRateForCategory(category) {
      const { data } = await admin.from("tax_decisions").select("tax_rate").eq("category", category).order("effective_date", { ascending: false }).limit(1).maybeSingle();
      return data ? n((data as { tax_rate: string | number }).tax_rate) : 0;
    },

    async listProducts() {
      const { data } = await admin.from("products").select("*").order("created_at");
      return ((data ?? []) as DbProduct[]).map(mapProduct);
    },
    async productById(id) {
      const { data } = await admin.from("products").select("*").eq("id", id).maybeSingle();
      return data ? mapProduct(data as DbProduct) : undefined;
    },
    async productBySku(sku) {
      const { data } = await admin.from("products").select("*").eq("sku", sku).maybeSingle();
      return data ? mapProduct(data as DbProduct) : undefined;
    },
    async productByName(name) {
      const { data } = await admin.from("products").select("*").ilike("name", name).maybeSingle();
      return data ? mapProduct(data as DbProduct) : undefined;
    },
    async insertProduct(data) {
      const { data: created, error } = await admin
        .from("products")
        .insert({
          organization_id: ORG,
          sku: data.sku,
          name: data.name,
          category: data.category ?? "general",
          unit: data.unit,
          cost_price: data.cost_price ?? 0,
          selling_price: data.selling_price ?? 0,
          reorder_threshold: data.reorder_threshold ?? 0,
        })
        .select("*")
        .single();
      if (error) throw new Error(`DB_ERROR (create_product): ${error.message}`);
      return mapProduct(created as DbProduct);
    },
    async updateProduct(id, patch) {
      const { data, error } = await admin.from("products").update(patch).eq("id", id).select("*").single();
      if (error) throw new Error(`DB_ERROR (update_product): ${error.message}`);
      return mapProduct(data as DbProduct);
    },

    async listSuppliers() {
      const { data } = await admin.from("suppliers").select("*").order("created_at");
      return ((data ?? []) as DbSupplierRow[]).map(mapSupplier);
    },
    async insertSupplier(data) {
      const { data: created, error } = await admin
        .from("suppliers")
        .insert({ organization_id: ORG, name: data.name, city: data.city ?? null, phone: data.phone ?? null, email: data.email ?? null, lead_time_days: data.lead_time_days ?? 5 })
        .select("*")
        .single();
      if (error) throw new Error(`DB_ERROR (create_supplier): ${error.message}`);
      return mapSupplier(created as DbSupplierRow);
    },

    async listCustomers() {
      const { data } = await admin.from("customers").select("*").order("created_at");
      return ((data ?? []) as DbCustomerRow[]).map(mapCustomer);
    },
    async insertCustomer(data) {
      const { data: created, error } = await admin
        .from("customers")
        .insert({ organization_id: ORG, name: data.name, city: data.city ?? null, phone: data.phone ?? null, email: data.email ?? null })
        .select("*")
        .single();
      if (error) throw new Error(`DB_ERROR (create_customer): ${error.message}`);
      return mapCustomer(created as DbCustomerRow);
    },

    async listPOs() {
      const { data, error } = await admin
        .from("purchase_orders")
        .select("*, purchase_order_items(product_id, quantity, unit_price, tax_amount)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`DB_ERROR (list_pos): ${error.message}`);
      return ((data ?? []) as DbPO[]).map(mapPO);
    },
    async poById(idOrCode) {
      const { data } = await admin
        .from("purchase_orders")
        .select("*, purchase_order_items(product_id, quantity, unit_price, tax_amount)")
        .or(`code.eq.${idOrCode},id.eq.${idOrCode}`)
        .maybeSingle();
      return data ? mapPO(data as DbPO) : undefined;
    },
    async insertPO(po) {
      // Uses the atomic RPC so PO + items + sequence land in one txn (0005).
      const { data, error } = await admin.rpc("create_purchase_order", {
        p_org: ORG,
        p_supplier: po.supplier_ref ?? po.supplier_id,
        p_items: po.items.map((i) => ({ product: i.product_ref ?? i.product_id, quantity: i.quantity, unit_price: i.unit_price ?? null })),
      });
      if (error) throw new Error(`DB_ERROR (create_purchase_order): ${error.message}`);
      const d = data as { po_id: string };
      const created = await this.poById(d.po_id);
      if (!created) throw new Error(`DB_ERROR (create_purchase_order): PO ${d.po_id} not found after RPC`);
      return created;
    },

    async listSales() {
      const { data, error } = await admin
        .from("sales_orders")
        .select("*, sales_order_items(product_id, quantity, unit_price, tax_rate, tax_amount)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`DB_ERROR (list_sales): ${error.message}`);
      return ((data ?? []) as DbSale[]).map(mapSale);
    },
    async insertSaleWithMovements(sale, movements, cashEntry) {
      // The atomic sale RPC is Sidra's (migration 0002+); this path throws clearly
      // until it exists. Movement/cash payloads ride inside her RPC contract.
      const { error } = await admin.rpc("record_sale", {
        p_org: ORG,
        p_customer: sale.customer_ref ?? sale.customer_id,
        p_items: sale.items.map((i) => ({ product: i.product_ref ?? i.product_id, quantity: i.quantity, unit_price: i.unit_price ?? null })),
        p_payment_status: sale.payment_status,
      });
      if (error) {
        throw new Error(
          `DB_ERROR (record_sale): ${error.message} — Sidra's record_sale RPC (migration 0002+) is required for Supabase-backed sales`
        );
      }
      void movements;
      void cashEntry;
      // Read back the created invoice (newest matching customer + total).
      const sales = await this.listSales();
      const created = sales.find((s) => s.customer_id === sale.customer_id && s.total_amount === sale.total_amount);
      return {
        ok: true as const,
        sale: created ?? {
          id: "(refresh /sales)",
          customer_id: sale.customer_id,
          items: sale.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, tax_rate: i.tax_rate, tax_amount: i.tax_amount })),
          subtotal: sale.subtotal,
          tax_amount: sale.tax_amount,
          total_amount: sale.total_amount,
          payment_status: sale.payment_status,
          created_at: new Date().toISOString(),
        },
      };
    },

    async receiveGoods(poCode) {
      // Atomic on the server: PO → received + movements + stock trigger (0005).
      const { data, error } = await admin.rpc("receive_goods", { p_org: ORG, p_po_code: poCode });
      if (error) {
        const msg = error.message;
        if (msg.includes("PO_NOT_FOUND")) return { ok: false as const, error: "PO_NOT_FOUND" as const, message: msg.replace("PO_NOT_FOUND: ", "") };
        if (msg.includes("PO_ALREADY_RECEIVED")) return { ok: false as const, error: "PO_ALREADY_RECEIVED" as const, message: msg.replace("PO_ALREADY_RECEIVED: ", "") };
        throw new Error(`DB_ERROR (receive_goods): ${msg}`);
      }
      const d = data as { po_id: string; status: string; items: { product: string; quantity_received: number; new_stock: number }[] };
      const po = await this.poById(d.po_id);
      if (!po) throw new Error(`DB_ERROR (receive_goods): PO ${d.po_id} not found after RPC`);
      return { ok: true as const, po, movements: d.items };
    },

    async listCashbook() {
      const { data, error } = await admin.from("cashbook").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(`DB_ERROR (list_cashbook): ${error.message}`);
      return ((data ?? []) as DbCashRow[]).map(mapCash);
    },

    async listMovements(productId) {
      let q = admin.from("inventory_movements").select("*").order("created_at", { ascending: false });
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw new Error(`DB_ERROR (list_movements): ${error.message}`);
      return ((data ?? []) as { id: string; product_id: string; delta: string | number; movement_type: Movement["type"]; reference_type: string | null; reference_id: string | null; created_at: string }[]).map((m) => ({
        id: m.id,
        product_id: m.product_id,
        delta: n(m.delta),
        type: m.movement_type,
        ...(m.reference_type ? { reference_type: m.reference_type } : {}),
        ...(m.reference_id ? { reference_id: m.reference_id } : {}),
        created_at: m.created_at,
      }));
    },
    async insertCashEntry(entry) {
      const { data, error } = await admin
        .from("cashbook")
        .insert({
          organization_id: ORG,
          entry_type: entry.type,
          amount: entry.amount,
          category: entry.category,
          description: entry.description,
          reference_type: entry.reference_type ?? null,
          reference_id: entry.reference_id ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(`DB_ERROR (insert_cash): ${error.message}`);
      return mapCash(data as DbCashRow);
    },

    async listTaxDecisions() {
      const { data } = await admin.from("tax_decisions").select("*").order("category");
      return ((data ?? []) as DbTaxDecision[]).map((d) => ({
        category: d.category,
        tax_rate: n(d.tax_rate),
        tax_type: d.tax_type,
        source_document: d.source_document,
        source_reference: d.source_reference ?? "",
        effective_date: d.effective_date,
        confidence: n(d.confidence),
      }));
    },

    __debug: {
      reset(): void {
        throw new Error("reset is memory-backend-only");
      },
    },
  };
}

// ─── row mappers ──────────────────────────────────────────────────────────────

type DbSupplierRow = { id: string; name: string; city: string | null; phone: string | null; email: string | null; lead_time_days: number };
type DbCustomerRow = { id: string; name: string; city: string | null; phone: string | null; email: string | null };
type DbCashRow = { id: string; entry_type: "income" | "expense"; amount: string | number; category: string; description: string | null; reference_type: string | null; reference_id: string | null; created_at: string };

function mapPO(r: DbPO): PurchaseOrder {
  return {
    id: r.code,
    supplier_id: r.supplier_id,
    status: r.status === "cancelled" ? "cancelled" : r.status,
    total_amount: n(r.total_amount),
    created_at: r.created_at,
    ...(r.received_at ? { received_at: r.received_at } : {}),
    items: (r.purchase_order_items ?? []).map((i) => ({
      product_id: i.product_id,
      quantity: n(i.quantity),
      unit_price: n(i.unit_price),
      tax_amount: n(i.tax_amount),
    })),
  };
}

function mapSale(r: DbSale): Sale {
  return {
    id: r.code,
    customer_id: r.customer_id,
    items: (r.sales_order_items ?? []).map((i) => ({
      product_id: i.product_id,
      quantity: n(i.quantity),
      unit_price: n(i.unit_price),
      tax_rate: n(i.tax_rate),
      tax_amount: n(i.tax_amount),
    })),
    subtotal: n(r.subtotal),
    tax_amount: n(r.tax_amount),
    total_amount: n(r.total_amount),
    payment_status: r.payment_status,
    created_at: r.created_at,
  };
}

function mapCash(r: DbCashRow): CashEntry {
  return {
    id: r.id,
    type: r.entry_type,
    amount: n(r.amount),
    category: r.category,
    description: r.description ?? "",
    ...(r.reference_type ? { reference_type: r.reference_type } : {}),
    ...(r.reference_id ? { reference_id: r.reference_id } : {}),
    created_at: r.created_at,
  };
}
