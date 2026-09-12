/**
 * MEMORY STORE — in-memory BizStore implementation, seeded per PRD §38.
 *
 * This is the dev-fallback backend used when Supabase env is absent. It is ALSO
 * the reference implementation of every invariant (PRD §12) that the Supabase
 * backend enforces in SQL (migrations 0004/0005):
 *  - stock truth lives in `movements`; `current_stock` is a cache updated only
 *    inside the same operation that appends the movement row (Rule 5),
 *  - multi-step mutations are all-or-nothing: validation happens BEFORE any
 *    write, so a failure mid-operation never leaves partial state (Rule 7),
 *  - tax rates come only from `taxDecisions` (category → rate).
 */

import type { BizStore, Product, Supplier, Customer, PurchaseOrder, Sale, CashEntry, Movement } from "./store-types";

export type { Product, Supplier, Customer, PurchaseOrder, Sale, CashEntry, Movement };

export interface Database {
  org: { id: string; name: string };
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  sales: Sale[];
  cashbook: CashEntry[];
  movements: Movement[];
  taxDecisions: { category: string; tax_rate: number; tax_type: string; source_document: string; source_reference: string; effective_date: string; confidence: number }[];
  seq: { po: number; invoice: number; cash: number; movement: number };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function seed(): Database {
  return {
    org: { id: "org_demo", name: "Demo Textiles" },
    products: [
      { id: "p-1", sku: "YRN-40S", name: "Cotton Yarn 40s", category: "yarn", unit: "kg", cost_price: 850, selling_price: 980, reorder_threshold: 50, current_stock: 320 },
      { id: "p-2", sku: "DYE-BLU", name: "Reactive Dye Blue", category: "dye", unit: "kg", cost_price: 900, selling_price: 1100, reorder_threshold: 20, current_stock: 60 },
      { id: "p-3", sku: "DYE-RED", name: "Reactive Dye Red", category: "dye", unit: "kg", cost_price: 880, selling_price: 1080, reorder_threshold: 25, current_stock: 15 },
    ],
    suppliers: [
      { id: "s-1", name: "ColorChem Dyes", city: "Karachi", lead_time_days: 5 },
      { id: "s-2", name: "Al-Noor Chemicals", city: "Faisalabad", lead_time_days: 7 },
    ],
    customers: [
      { id: "c-1", name: "Al-Rehman Textiles", city: "Faisalabad" },
      { id: "c-2", name: "Sana Fabrics", city: "Lahore" },
    ],
    purchaseOrders: [
      { id: "PO-14", supplier_id: "s-2", status: "received", items: [{ product_id: "p-1", quantity: 200, unit_price: 850, tax_amount: 30600 }], total_amount: 200600, created_at: hoursAgo(72), received_at: hoursAgo(70) },
      { id: "PO-15", supplier_id: "s-1", status: "pending", items: [{ product_id: "p-2", quantity: 100, unit_price: 900, tax_amount: 16200 }], total_amount: 106200, created_at: hoursAgo(8) },
    ],
    sales: [
      { id: "INV-101", customer_id: "c-1", items: [{ product_id: "p-1", quantity: 50, unit_price: 980, tax_rate: 0.18, tax_amount: 8820 }], subtotal: 49000, tax_amount: 8820, total_amount: 57820, payment_status: "paid", created_at: hoursAgo(20) },
      { id: "INV-102", customer_id: "c-2", items: [{ product_id: "p-2", quantity: 10, unit_price: 1100, tax_rate: 0.18, tax_amount: 1980 }], subtotal: 11000, tax_amount: 1980, total_amount: 12980, payment_status: "unpaid", created_at: hoursAgo(40) },
    ],
    cashbook: [
      { id: "e-1", type: "income", amount: 57820, category: "sales", description: "Sale INV-101 to Al-Rehman Textiles", reference_type: "sale", reference_id: "INV-101", created_at: hoursAgo(20) },
      { id: "e-2", type: "expense", amount: 5000, category: "utilities", description: "Electricity bill", created_at: hoursAgo(26) },
    ],
    movements: [
      { id: "m-1", product_id: "p-1", delta: 200, type: "purchase_receipt", reference_type: "purchase_order", reference_id: "PO-14", created_at: hoursAgo(70) },
      { id: "m-2", product_id: "p-1", delta: -50, type: "sale_issue", reference_type: "sale", reference_id: "INV-101", created_at: hoursAgo(20) },
      { id: "m-3", product_id: "p-2", delta: -10, type: "sale_issue", reference_type: "sale", reference_id: "INV-102", created_at: hoursAgo(40) },
      // Opening history so the invariant stock = Σ movements holds for EVERY product.
      { id: "m-4", product_id: "p-2", delta: 70, type: "adjustment", reference_type: "manual", reference_id: "opening", created_at: hoursAgo(50) },
      { id: "m-5", product_id: "p-3", delta: 15, type: "adjustment", reference_type: "manual", reference_id: "opening", created_at: hoursAgo(55) },
      { id: "m-6", product_id: "p-1", delta: 170, type: "adjustment", reference_type: "manual", reference_id: "opening", created_at: hoursAgo(75) },
    ],
    taxDecisions: [
      { category: "yarn", tax_rate: 0.18, tax_type: "GST", source_document: "FBR Sales Tax Guide (demo seed)", source_reference: "demo://fbr/gst-18", effective_date: "2026-07-01", confidence: 0.9 },
      { category: "dye", tax_rate: 0.18, tax_type: "GST", source_document: "FBR Sales Tax Guide (demo seed)", source_reference: "demo://fbr/gst-18", effective_date: "2026-07-01", confidence: 0.9 },
    ],
    seq: { po: 15, invoice: 102, cash: 2, movement: 6 },
  };
}

const globalStore = globalThis as unknown as { __bizDb?: Database };

/** Atomic multi-write transaction for the in-memory store (Rule 7). */
class MemoryTx {
  private undo: (() => void)[] = [];
  track<T>(list: T[], item: T): T {
    list.push(item);
    this.undo.push(() => {
      const i = list.indexOf(item);
      if (i >= 0) list.splice(i, 1);
    });
    return item;
  }
  commit(): void {
    this.undo = [];
  }
  rollback(): void {
    for (const fn of this.undo.reverse()) fn();
    this.undo = [];
  }
}

export function createMemoryStore(): BizStore {
  let db: Database = (globalStore.__bizDb ??= seed());

  const nextIds = {
    po: () => `PO-${++db.seq.po}`,
    invoice: () => `INV-${++db.seq.invoice}`,
    cash: () => `e-${++db.seq.cash}`,
    movement: () => `m-${++db.seq.movement}`,
  };

  const STOP_TOKENS = new Set(["kitna", "kitne", "kya", "hai", "bacha", "the", "a", "an", "of", "for", "do", "our", "some", "any", "se", "ka", "ki", "ko"]);

  return {
    backend: "memory",

    findProduct(nameOrSku) {
      const q = nameOrSku.trim().toLowerCase();
      const exact = db.products.find((p) => p.sku.toLowerCase() === q || p.name.toLowerCase() === q);
      if (exact) return exact;
      const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));
      if (tokens.length === 0) return undefined;
      let best: { p: Product; score: number } | undefined;
      for (const p of db.products) {
        const nameTokens = `${p.name} ${p.category}`.toLowerCase().split(/[^a-z0-9]+/);
        let score = 0;
        for (const t of tokens) {
          if (nameTokens.some((n) => n === t || n.startsWith(t) || t.startsWith(n))) score += 1;
        }
        if (score === tokens.length && (!best || score > best.score)) best = { p, score };
      }
      return best?.p;
    },

    productSuggestions(nameOrSku, max = 3) {
      const q = nameOrSku.trim().toLowerCase();
      return db.products
        .filter((p) => p.name.toLowerCase().includes(q) || p.category.includes(q) || q.split(/[^a-z0-9]+/).some((t) => t.length >= 3 && p.name.toLowerCase().includes(t)))
        .slice(0, max)
        .map((p) => p.name);
    },

    findSupplier(name) {
      const q = name.trim().toLowerCase();
      return db.suppliers.find((s) => s.name.toLowerCase() === q || s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()));
    },

    findCustomer(name) {
      const q = name.trim().toLowerCase();
      return db.customers.find((c) => c.name.toLowerCase() === q || c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
    },

    taxRateForCategory(category) {
      return db.taxDecisions.find((d) => d.category === category)?.tax_rate ?? 0;
    },

    listProducts() {
      return db.products;
    },
    productById(id) {
      return db.products.find((p) => p.id === id);
    },
    productBySku(sku) {
      return db.products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
    },
    productByName(name) {
      return db.products.find((p) => p.name.toLowerCase() === name.toLowerCase());
    },
    insertProduct(data) {
      const product: Product = {
        id: `p-${db.products.length + 1}`,
        ...data,
        category: data.category ?? "general",
        cost_price: data.cost_price ?? 0,
        selling_price: data.selling_price ?? 0,
        reorder_threshold: data.reorder_threshold ?? 0,
        current_stock: 0,
      };
      db.products.push(product);
      return product;
    },
    updateProduct(id, patch) {
      const p = db.products.find((x) => x.id === id);
      if (!p) return undefined;
      Object.assign(p, patch);
      return p;
    },

    listSuppliers() {
      return db.suppliers;
    },
    insertSupplier(data) {
      const supplier: Supplier = {
        id: `s-${db.suppliers.length + 1}`,
        name: data.name,
        city: data.city ?? "",
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.email ? { email: data.email } : {}),
        lead_time_days: data.lead_time_days ?? 5,
      };
      db.suppliers.push(supplier);
      return supplier;
    },

    listCustomers() {
      return db.customers;
    },
    insertCustomer(data) {
      const customer: Customer = {
        id: `c-${db.customers.length + 1}`,
        name: data.name,
        city: data.city ?? "",
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.email ? { email: data.email } : {}),
      };
      db.customers.push(customer);
      return customer;
    },

    listPOs() {
      return db.purchaseOrders;
    },
    poById(id) {
      return db.purchaseOrders.find((o) => o.id.toLowerCase() === id.toLowerCase());
    },
    insertPO(po) {
      const rec: PurchaseOrder = {
        id: nextIds.po(),
        supplier_id: po.supplier_id,
        status: "pending",
        items: po.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price ?? 0, tax_amount: i.tax_amount ?? 0 })),
        total_amount: po.items.reduce((t, i) => t + (i.unit_price ?? 0) * i.quantity + (i.tax_amount ?? 0), 0),
        created_at: new Date().toISOString(),
      };
      db.purchaseOrders.push(rec);
      return rec;
    },

    listSales() {
      return db.sales;
    },
    insertSaleWithMovements(sale, movements, cashEntry) {
      // All-or-nothing: nothing is written until every step validates.
      const tx = new MemoryTx();
      for (const m of movements) {
        const p = db.products.find((x) => x.id === m.product_id);
        if (!p) {
          tx.rollback();
          return { ok: false as const, error: "PRODUCT_NOT_FOUND" as const, message: `Product not found: ${m.product_id}` };
        }
        if (m.delta < 0 && p.current_stock + m.delta < 0) {
          tx.rollback();
          return { ok: false as const, error: "INSUFFICIENT_STOCK" as const, message: `Insufficient stock for ${p.name}` };
        }
      }
      const invoice: Sale = {
        id: nextIds.invoice(),
        customer_id: sale.customer_id,
        items: sale.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, tax_rate: i.tax_rate, tax_amount: i.tax_amount })),
        subtotal: sale.subtotal,
        tax_amount: sale.tax_amount,
        total_amount: sale.total_amount,
        payment_status: sale.payment_status,
        created_at: new Date().toISOString(),
      };
      tx.track(db.sales, invoice);
      const written: Movement[] = movements.map((m) =>
        tx.track(db.movements, { id: nextIds.movement(), product_id: m.product_id, delta: m.delta, type: m.type, created_at: new Date().toISOString() })
      );
      let cash: CashEntry | undefined;
      if (cashEntry) {
        cash = tx.track(db.cashbook, {
          id: nextIds.cash(),
          ...cashEntry,
          // The invoice id is generated here, so the store stamps the reference.
          reference_id: cashEntry.reference_id ?? invoice.id,
          created_at: new Date().toISOString(),
        });
      }
      for (const m of written) {
        const p = db.products.find((x) => x.id === m.product_id)!;
        p.current_stock += m.delta;
      }
      tx.commit();
      return { ok: true as const, sale: invoice, movements: written, cash };
    },

    receiveGoods(poId) {
      const po = db.purchaseOrders.find((o) => o.id.toLowerCase() === poId.toLowerCase());
      if (!po) return { ok: false as const, error: "PO_NOT_FOUND" as const, message: `Purchase order not found: "${poId}"` };
      if (po.status !== "pending") {
        return { ok: false as const, error: "PO_ALREADY_RECEIVED" as const, message: `Purchase order ${po.id} was already ${po.status}` };
      }
      // Validate every product BEFORE mutating (all-or-nothing).
      for (const item of po.items) {
        if (!db.products.some((p) => p.id === item.product_id)) {
          return { ok: false as const, error: "PRODUCT_NOT_FOUND" as const, message: `Product missing for PO item: ${item.product_id}` };
        }
      }
      const now = new Date().toISOString();
      po.status = "received";
      po.received_at = now;
      const movements = po.items.map((item) => {
        const p = db.products.find((prod) => prod.id === item.product_id)!;
        const movement: Movement = { id: nextIds.movement(), product_id: p.id, delta: item.quantity, type: "purchase_receipt", reference_type: "purchase_order", reference_id: po.id, created_at: now };
        db.movements.push(movement);
        p.current_stock += item.quantity;
        return { product: p.name, quantity_received: item.quantity, new_stock: p.current_stock };
      });
      return { ok: true as const, po, movements };
    },

    listCashbook() {
      return db.cashbook;
    },
    insertCashEntry(entry) {
      const rec: CashEntry = { id: nextIds.cash(), ...entry, created_at: new Date().toISOString() };
      db.cashbook.push(rec);
      return rec;
    },

    listMovements(productId) {
      const rows = productId ? db.movements.filter((m) => m.product_id === productId) : db.movements.slice();
      return rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    listTaxDecisions() {
      return db.taxDecisions;
    },

    /** Dev/test helper — the SQL backend enforces the same via migrations. */
    __debug: {
      reset(): void {
        globalStore.__bizDb = seed();
        db = globalStore.__bizDb;
      },
    },
  };
}
