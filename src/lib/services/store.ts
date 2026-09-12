/**
 * BUSINESS DATA STORE — the single source of truth for the service layer.
 *
 * In-memory + seeded per PRD §38 demo script. REPLACEMENT CONTRACT (Zoha's lane):
 * swap this module's reads/writes for Supabase queries (migrations 0001/0004) —
 * every service signature stays identical, so REST APIs and AI tools do not change.
 *
 * Invariants enforced here and in services (PRD §12):
 *  - stock truth lives in `movements`; `product.current_stock` is a cache updated
 *    in the same operation that appends the movement row,
 *  - every record carries organization + creator + timestamps,
 *  - tax rates come only from `taxDecisions` (product category → rate).
 */

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  reorder_threshold: number;
  current_stock: number;
}

export interface Supplier {
  id: string;
  name: string;
  city: string;
  phone?: string;
  email?: string;
  lead_time_days: number;
}

export interface Customer {
  id: string;
  name: string;
  city: string;
  phone?: string;
  email?: string;
}

export interface POItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  status: "pending" | "received";
  items: POItem[];
  total_amount: number;
  created_at: string;
  received_at?: string;
}

export interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
}

export interface Sale {
  id: string;
  customer_id: string;
  items: SaleItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_status: "paid" | "unpaid";
  created_at: string;
}

export interface CashEntry {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface Movement {
  id: string;
  product_id: string;
  delta: number;
  type: "purchase_receipt" | "sale_issue" | "adjustment";
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface TaxDecision {
  category: string;
  tax_rate: number;
  tax_type: string;
  source_document: string;
  source_reference: string;
  effective_date: string;
  confidence: number;
}

export interface Database {
  org: { id: string; name: string };
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  sales: Sale[];
  cashbook: CashEntry[];
  movements: Movement[];
  taxDecisions: TaxDecision[];
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
    ],
    taxDecisions: [
      { category: "yarn", tax_rate: 0.18, tax_type: "GST", source_document: "FBR Sales Tax Guide (demo seed)", source_reference: "demo://fbr/gst-18", effective_date: "2026-07-01", confidence: 0.9 },
      { category: "dye", tax_rate: 0.18, tax_type: "GST", source_document: "FBR Sales Tax Guide (demo seed)", source_reference: "demo://fbr/gst-18", effective_date: "2026-07-01", confidence: 0.9 },
    ],
    seq: { po: 15, invoice: 102, cash: 2, movement: 3 },
  };
}

const globalStore = globalThis as unknown as { __bizDb?: Database };
export const db: Database = (globalStore.__bizDb ??= seed());

/** Test/dev helper: reset to seed state. */
export function resetDb(): void {
  globalStore.__bizDb = seed();
}

export const nextIds = {
  po: () => `PO-${++db.seq.po}`,
  invoice: () => `INV-${++db.seq.invoice}`,
  cash: () => `e-${++db.seq.cash}`,
  movement: () => `m-${++db.seq.movement}`,
};

const STOP_TOKENS = new Set(["kitna", "kitne", "kya", "hai", "bacha", "the", "a", "an", "of", "for", "do", "our", "some", "any", "se", "ka", "ki", "ko"]);

/**
 * Fuzzy entity resolution: exact SKU/name first, then token overlap
 * ("cotton yarn" → "Cotton Yarn 40s", "blue dye" → "Reactive Dye Blue").
 */
export function findProduct(nameOrSku: string): Product | undefined {
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
}

export function productSuggestions(nameOrSku: string, max = 3): string[] {
  const q = nameOrSku.trim().toLowerCase();
  return db.products
    .filter((p) => p.name.toLowerCase().includes(q) || p.category.includes(q) || q.split(/[^a-z0-9]+/).some((t) => t.length >= 3 && p.name.toLowerCase().includes(t)))
    .slice(0, max)
    .map((p) => p.name);
}

export function findSupplier(name: string): Supplier | undefined {
  const q = name.trim().toLowerCase();
  return db.suppliers.find((s) => s.name.toLowerCase() === q || s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase()));
}

export function findCustomer(name: string): Customer | undefined {
  const q = name.trim().toLowerCase();
  return db.customers.find((c) => c.name.toLowerCase() === q || c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
}

/** Tax rate lookup: category decision table (Sidra's compliance service later). */
export function taxRateForCategory(category: string): number {
  return db.taxDecisions.find((d) => d.category === category)?.tax_rate ?? 0;
}
