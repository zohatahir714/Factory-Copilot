/**
 * INTEGRITY TESTS (brief-zoha H24–32) — run with `npm test` (tsx + node:test).
 * Exercises the SERVICE layer against the memory backend; the Supabase backend
 * enforces the same invariants in SQL (migrations 0004/0005).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getStore, resetStore } from "@/lib/services/store";
import { receiveGoods, previewReceive, createPO, listPOs } from "@/lib/services/purchase";
import { recordSale } from "@/lib/services/sales";
import { createProduct, lookupProduct } from "@/lib/services/products";
import { createSupplier } from "@/lib/services/parties";
import { recordExpense } from "@/lib/services/cashbook";
import { businessSummary, taxReport } from "@/lib/services/reports";

function freshStore() {
  resetStore();
  const store = getStore();
  store.__debug.reset?.();
  return store;
}

const store = freshStore();

test("stock truth = sum of movements (Rule 4)", async () => {
  for (const p of await store.listProducts()) {
    const movements = await store.listMovements(p.id);
    const sum = movements.reduce((t, m) => t + m.delta, 0);
    assert.equal(sum, p.current_stock, `product ${p.name}: Σmovements(${sum}) ≠ current_stock(${p.current_stock})`);
  }
});

test("receive goods updates stock, movements, PO status — atomically", async () => {
  const before = (await store.productById("p-2"))!.current_stock;
  const res = await receiveGoods({ po_id: "PO-15" });
  assert.equal(res.success, true, JSON.stringify(res.error));

  const after = (await store.productById("p-2"))!.current_stock;
  assert.equal(after, before + 100, "stock cache must rise by PO quantity");

  const movements = await store.listMovements("p-2");
  const last = movements[0];
  assert.equal(last.delta, 100);
  assert.equal(last.type, "purchase_receipt");
  assert.equal(last.reference_id, "PO-15");

  const po = await store.poById("PO-15");
  assert.equal(po!.status, "received");

  // Invariant holds after mutation
  const sum = (await store.listMovements("p-2")).reduce((t, m) => t + m.delta, 0);
  assert.equal(sum, after);
});

test("receive is idempotent — second attempt fails with PO_ALREADY_RECEIVED, no double stock", async () => {
  const stock = (await store.productById("p-2"))!.current_stock;
  const res = await receiveGoods({ po_id: "PO-15" });
  assert.equal(res.success, false);
  assert.equal(res.error?.code, "PO_ALREADY_RECEIVED");
  assert.equal((await store.productById("p-2"))!.current_stock, stock, "stock must not change on failed receive");
});

test("previewReceive mutates nothing", async () => {
  const snap = JSON.stringify(await store.listProducts()) + JSON.stringify(await store.listPOs());
  const res = await previewReceive({ po_id: "PO-14" });
  assert.equal(res.success, false); // PO-14 already received
  const res2 = await previewReceive({ po_id: "PO-14" });
  void res2;
  assert.equal(snap, JSON.stringify(await store.listProducts()) + JSON.stringify(await store.listPOs()));
});

test("sale commits invoice + movement + cash together; unpaid sale skips cash", async () => {
  const yarnBefore = (await store.productById("p-1"))!.current_stock;
  const res = await recordSale({ customer: "Al-Rehman Textiles", items: [{ product: "Cotton Yarn 40s", quantity: 20 }], payment_status: "unpaid" });
  assert.equal(res.success, true, JSON.stringify(res.error));
  const d = res.data as { invoice_id: string; total: number; remaining_stock: { remaining: number }[] };

  assert.equal((await store.productById("p-1"))!.current_stock, yarnBefore - 20);
  const last = (await store.listMovements("p-1"))[0];
  assert.equal(last.type, "sale_issue");
  assert.equal(last.delta, -20);

  // unpaid → no cash entry
  const cashBefore = (await store.listCashbook()).filter((e) => e.reference_id === d.invoice_id).length;
  assert.equal(cashBefore, 0);

  // paid → cash entry with the invoice total
  const res2 = await recordSale({ customer: "Sana Fabrics", items: [{ product: "Reactive Dye Red", quantity: 5 }], payment_status: "paid" });
  assert.equal(res2.success, true);
  const d2 = res2.data as { invoice_id: string; total: number };
  const cash = (await store.listCashbook()).find((e) => e.reference_id === d2.invoice_id);
  assert.ok(cash, "paid sale must append a cashbook row");
  assert.equal(cash!.amount, d2.total);
});

test("sale refuses insufficient stock and commits nothing (Rule 7)", async () => {
  const red = await store.productById("p-3");
  const before = red!.current_stock;
  const salesBefore = (await store.listSales()).length;
  const res = await recordSale({ customer: "Sana Fabrics", items: [{ product: "Reactive Dye Red", quantity: before + 1000 }] });
  assert.equal(res.success, false);
  assert.equal(res.error?.code, "INSUFFICIENT_STOCK");
  assert.equal((await store.productById("p-3"))!.current_stock, before, "no stock change on refusal");
  assert.equal((await store.listSales()).length, salesBefore, "no invoice on refusal");
  const sum = (await store.listMovements("p-3")).reduce((t, m) => t + m.delta, 0);
  assert.equal(sum, before, "movement invariant intact after refusal");
});

test("fuzzy did-you-mean suggestions on unknown product", async () => {
  const res = await lookupProduct({ product: "blue die" });
  assert.equal(res.success, false);
  assert.equal(res.error?.code, "PRODUCT_NOT_FOUND");
  assert.ok((res.error?.suggestions ?? []).length > 0, "suggestions should list near-matches");
  assert.ok((res.error?.suggestions ?? []).some((s) => s.includes("Blue")));
});

test("PO lifecycle: create → pending → receive; totals include tax", async () => {
  const res = await createPO({ supplier: "Al-Noor Chemicals", items: [{ product: "YRN-40S", quantity: 10 }] });
  assert.equal(res.success, true, JSON.stringify(res.error));
  const d = res.data as { po_id: string; total: number; status: string };
  assert.equal(d.status, "pending");
  // 10 × 850 = 8500 + 18% GST = 1530 → 10030
  assert.equal(d.total, 10030);

  const listed = await listPOs({ status: "pending" });
  assert.equal(listed.success, true);
  assert.ok((listed.data as { orders: { po_id: string }[] }).orders.some((o) => o.po_id === d.po_id));

  const rec = await receiveGoods({ po_id: d.po_id });
  assert.equal(rec.success, true);
  assert.equal((rec.data as { status: string }).status, "received");
});

test("createProduct rejects duplicate SKU; new product starts at zero stock", async () => {
  const res = await createProduct({ name: "Test Loom Oil", sku: "OIL-01", unit: "litre" });
  assert.equal(res.success, true);
  const p = (res.data as { id: string }).id;
  const dup = await createProduct({ name: "Other", sku: "OIL-01", unit: "litre" });
  assert.equal(dup.success, false);
  const stored = await store.productById(p);
  assert.equal(stored!.current_stock, 0);
});

test("createSupplier + expense flows update cash position", async () => {
  const s = await createSupplier({ name: "Pak Chemicals", city: "Lahore" });
  assert.equal(s.success, true);
  const cashBefore = (await businessSummary()).data as { cash_position: number };
  const res = await recordExpense({ amount: 1234, category: "transport", description: "Delivery van fuel" });
  assert.equal(res.success, true);
  const cashAfter = (await businessSummary()).data as { cash_position: number };
  assert.equal(cashAfter.cash_position, cashBefore.cash_position - 1234);
});

test("tax report: output − input with source references", async () => {
  const res = await taxReport({ month: new Date().toISOString().slice(0, 7) });
  assert.equal(res.success, true);
  const d = res.data as { output_tax: number; input_tax: number; net_payable: number; by_category: unknown[] };
  assert.equal(d.net_payable, d.output_tax - d.input_tax);
  assert.ok(d.by_category.length >= 2);
});

test("envelope shape (CONTRACTS §4) on success and failure", async () => {
  const okRes = await lookupProduct({ product: "YRN-40S" });
  assert.equal(okRes.success, true);
  assert.ok("data" in okRes && okRes.data !== null);
  assert.equal(okRes.error, null);
  assert.ok((okRes as { metadata?: { timestamp?: string } }).metadata?.timestamp);

  const errRes = await lookupProduct({ product: "nonexistent widget" });
  assert.equal(errRes.success, false);
  assert.equal(errRes.data, null);
  assert.equal(errRes.error?.code, "PRODUCT_NOT_FOUND");
});
