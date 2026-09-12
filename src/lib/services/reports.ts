import { z } from "zod";
import { ok, type ToolResponse } from "@/lib/responses";
import { getStore } from "./store";
import { money } from "@/lib/format";

/**
 * REPORTS SERVICE — every number here is computed from the store (PRD §28:
 * "All numbers must come from tools/database queries").
 */

export const TaxReportInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month as YYYY-MM, e.g. 2026-09"),
});

export async function businessSummary(): Promise<ToolResponse> {
  const store = getStore();
  const today = new Date().toISOString().slice(0, 10);
  const [sales, cashbook, products, purchaseOrders, suppliers] = await Promise.all([
    store.listSales(),
    store.listCashbook(),
    store.listProducts(),
    store.listPOs(),
    store.listSuppliers(),
  ]);

  const salesToday = sales.filter((s) => s.created_at.slice(0, 10) === today).reduce((sum, s) => sum + s.total_amount, 0);
  let cash = 0;
  for (const e of cashbook) cash += e.type === "income" ? e.amount : -e.amount;
  const lowStock = products
    .filter((p) => p.current_stock <= p.reorder_threshold)
    .map((p) => ({ product: p.name, stock: p.current_stock, unit: p.unit, reorder_threshold: p.reorder_threshold }));
  const pendingPOs = purchaseOrders
    .filter((po) => po.status === "pending")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((po) => {
      const supplier = suppliers.find((s) => s.id === po.supplier_id);
      return { po_id: po.id, supplier: supplier?.name ?? po.supplier_id, total: po.total_amount, total_display: money(po.total_amount), created_at: po.created_at };
    });
  const receivables = sales.filter((s) => s.payment_status === "unpaid").reduce((sum, s) => sum + s.total_amount, 0);
  const inventoryValue = products.reduce((sum, p) => sum + p.current_stock * p.cost_price, 0);

  return ok("get_business_summary", {
    sales_today: salesToday,
    sales_today_display: money(salesToday),
    cash_position: cash,
    cash_display: money(cash),
    inventory_value: inventoryValue,
    inventory_value_display: money(inventoryValue),
    low_stock: lowStock,
    pending_pos: pendingPOs,
    pending_po_count: pendingPOs.length,
    outstanding_receivables: receivables,
    receivables_display: money(receivables),
    recommended_action: lowStock.length > 0 ? `Reorder ${lowStock.map((l) => l.product).join(", ")}` : "No action needed",
  });
}

export async function taxReport(input: unknown): Promise<ToolResponse> {
  const { month } = TaxReportInput.parse(input);
  const store = getStore();
  const inMonth = (iso: string) => iso.slice(0, 7) === month;
  const [sales, purchaseOrders, taxDecisions] = await Promise.all([store.listSales(), store.listPOs(), store.listTaxDecisions()]);
  const outputTax = sales.filter((s) => inMonth(s.created_at)).reduce((sum, s) => sum + s.tax_amount, 0);
  // Input tax credit: tax actually recorded on RECEIVED purchase orders.
  const inputTax = purchaseOrders
    .filter((po) => po.status === "received" && inMonth(po.created_at))
    .reduce((sum, po) => sum + po.items.reduce((t, i) => t + i.tax_amount, 0), 0);
  const byCategory = taxDecisions.map((d) => ({
    category: d.category,
    tax_rate: d.tax_rate,
    tax_type: d.tax_type,
    source_document: d.source_document,
    source_reference: d.source_reference,
    effective_date: d.effective_date,
  }));
  const net = outputTax - inputTax;
  return ok("generate_tax_report", {
    month,
    output_tax: outputTax,
    output_tax_display: money(outputTax),
    input_tax: inputTax,
    input_tax_display: money(inputTax),
    net_payable: net,
    net_payable_display: money(net),
    by_category: byCategory,
    note: "Rates sourced from indexed tax decisions — verify with accountant/FBR before filing.",
  });
}
