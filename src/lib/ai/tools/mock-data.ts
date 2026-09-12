/**
 * MOCK BUSINESS DATA — a stand-in for the real service layer (Zoha: products/
 * inventory/purchase; Sidra: sales/cashbook/reports/compliance) while the
 * orchestrator is being built. Seeded to match docs/PRD_v3.0.md §38 demo script.
 *
 * REPLACEMENT CONTRACT: each function here maps 1:1 to a future service call.
 * When a real service lands, change only the corresponding tool in registry.ts
 * to call the service — the tool schemas and response envelopes do not change.
 */

export interface MockProduct {
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

export interface MockSupplier {
  id: string;
  name: string;
  city: string;
  lead_time_days: number;
}

export interface MockCustomer {
  id: string;
  name: string;
  city: string;
}

export interface MockPurchaseOrder {
  id: string;
  supplier_id: string;
  status: "pending" | "received";
  items: { product_id: string; quantity: number; unit_price: number }[];
  total_amount: number;
  created_at: string;
}

export interface MockCashEntry {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  created_at: string;
}

export interface MockSale {
  id: string;
  customer_id: string;
  items: { product_id: string; quantity: number; unit_price: number; tax_rate: number }[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_status: "paid" | "unpaid";
  created_at: string;
}

export interface MockTaxDecision {
  category: string;
  tax_rate: number;
  tax_type: string;
  source_document: string;
  source_reference: string;
  effective_date: string;
  confidence: number;
}

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

export const mockDb = {
  products: [
    { id: "p-1", sku: "YRN-40S", name: "Cotton Yarn 40s", category: "yarn", unit: "kg", cost_price: 850, selling_price: 980, reorder_threshold: 50, current_stock: 320 },
    { id: "p-2", sku: "DYE-BLU", name: "Reactive Dye Blue", category: "dye", unit: "kg", cost_price: 900, selling_price: 1100, reorder_threshold: 20, current_stock: 60 },
    { id: "p-3", sku: "DYE-RED", name: "Reactive Dye Red", category: "dye", unit: "kg", cost_price: 880, selling_price: 1080, reorder_threshold: 25, current_stock: 15 },
  ] as MockProduct[],

  suppliers: [
    { id: "s-1", name: "ColorChem Dyes", city: "Karachi", lead_time_days: 5 },
    { id: "s-2", name: "Al-Noor Chemicals", city: "Faisalabad", lead_time_days: 7 },
  ] as MockSupplier[],

  customers: [
    { id: "c-1", name: "Al-Rehman Textiles", city: "Faisalabad" },
    { id: "c-2", name: "Sana Fabrics", city: "Lahore" },
  ] as MockCustomer[],

  purchaseOrders: [
    { id: "PO-14", supplier_id: "s-2", status: "received", items: [{ product_id: "p-1", quantity: 200, unit_price: 850 }], total_amount: 170000, created_at: hoursAgo(72) },
    { id: "PO-15", supplier_id: "s-1", status: "pending", items: [{ product_id: "p-2", quantity: 100, unit_price: 900 }], total_amount: 90000, created_at: hoursAgo(8) },
  ] as MockPurchaseOrder[],

  cashbook: [
    { id: "e-1", type: "income", amount: 125000, category: "sales", description: "Sale to Al-Rehman Textiles", created_at: hoursAgo(20) },
    { id: "e-2", type: "expense", amount: 5000, category: "utilities", description: "Electricity bill", created_at: hoursAgo(26) },
  ] as MockCashEntry[],

  sales: [
    { id: "INV-101", customer_id: "c-1", items: [{ product_id: "p-1", quantity: 50, unit_price: 980, tax_rate: 0.18 }], subtotal: 49000, tax_amount: 8820, total_amount: 57820, payment_status: "paid", created_at: hoursAgo(20) },
    { id: "INV-102", customer_id: "c-2", items: [{ product_id: "p-2", quantity: 10, unit_price: 1100, tax_rate: 0.18 }], subtotal: 11000, tax_amount: 1980, total_amount: 12980, payment_status: "unpaid", created_at: hoursAgo(40) },
  ] as MockSale[],

  taxDecisions: [
    { category: "yarn", tax_rate: 0.18, tax_type: "GST", source_document: "FBR Sales Tax Guide (demo seed)", source_reference: "demo://fbr/gst-18", effective_date: "2026-07-01", confidence: 0.9 },
    { category: "dye", tax_rate: 0.18, tax_type: "GST", source_document: "FBR Sales Tax Guide (demo seed)", source_reference: "demo://fbr/gst-18", effective_date: "2026-07-01", confidence: 0.9 },
  ] as MockTaxDecision[],
};

/** Next ids for created records (mock stand-in for DB sequences). */
let poSeq = 15;
let invSeq = 102;
let cashSeq = 2;
export const nextIds = {
  po: () => `PO-${++poSeq}`,
  invoice: () => `INV-${++invSeq}`,
  cash: () => `e-${++cashSeq}`,
};

const STOP_TOKENS = new Set(["kitna", "kitne", "kya", "hai", "bacha", "the", "a", "an", "of", "for", "do", "our", "some", "any"]);

/**
 * Fuzzy product resolution: exact SKU/name first, then token overlap
 * ("cotton yarn" → "Cotton Yarn 40s", "blue dye" → "Reactive Dye Blue").
 * The real service (Zoha: products.findByNameOrSku) must match this behavior.
 */
export function findProduct(nameOrSku: string): MockProduct | undefined {
  const q = nameOrSku.trim().toLowerCase();
  const exact = mockDb.products.find(
    (p) => p.sku.toLowerCase() === q || p.name.toLowerCase() === q
  );
  if (exact) return exact;

  const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));
  if (tokens.length === 0) return undefined;

  let best: { p: MockProduct; score: number } | undefined;
  for (const p of mockDb.products) {
    const nameTokens = `${p.name} ${p.category}`.toLowerCase().split(/[^a-z0-9]+/);
    let score = 0;
    for (const t of tokens) {
      if (nameTokens.some((n) => n === t || n.startsWith(t) || t.startsWith(n))) score += 1;
    }
    // every query token must hit somewhere in name/category
    if (score === tokens.length && (!best || score > best.score)) best = { p, score };
  }
  return best?.p;
}

/** Fuzzy fallback: substring match in either direction, for did-you-mean. */
export function productSuggestions(nameOrSku: string, max = 3): string[] {
  const q = nameOrSku.trim().toLowerCase();
  return mockDb.products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        q.includes(p.name.toLowerCase().split(" ")[0]) ||
        p.category.includes(q)
    )
    .slice(0, max)
    .map((p) => p.name);
}
