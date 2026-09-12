import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import { getStore } from "./store";
import { money } from "@/lib/format";

/**
 * SALES SERVICE — invoice listing + the atomic sale (PRD Rule 7):
 * validate customer/products/stock → compute tax deterministically from tax
 * decisions → commit invoice + stock movements + cash entry together.
 * dryRun=true returns the priced preview (confirmation card) with NO mutation.
 */

export const RecordSaleInput = z.object({
  customer: z.string().min(1).describe("Customer name or id"),
  items: z
    .array(
      z.object({
        product: z.string().min(1).describe("Product name, SKU or id"),
        quantity: z.number().positive(),
        unit_price: z.number().nonnegative().optional(),
      })
    )
    .min(1),
  payment_status: z.enum(["paid", "unpaid"]).default("paid"),
});

export const ListSalesInput = z.object({
  limit: z.number().int().positive().max(200).optional(),
  payment_status: z.enum(["paid", "unpaid"]).optional(),
});

export async function listSales(input: unknown): Promise<ToolResponse> {
  const { limit, payment_status } = ListSalesInput.parse(input ?? {});
  const store = getStore();
  let rows = (await store.listSales()).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (payment_status) rows = rows.filter((s) => s.payment_status === payment_status);
  if (limit) rows = rows.slice(0, limit);
  const customers = await store.listCustomers();
  const products = await store.listProducts();
  return ok("list_sales", {
    count: rows.length,
    invoices: rows.map((s) => ({
      invoice_id: s.id,
      customer: customers.find((c) => c.id === s.customer_id)?.name ?? s.customer_id,
      items: s.items.map((i) => ({
        product: products.find((p) => p.id === i.product_id)?.name ?? i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        tax_amount: i.tax_amount,
      })),
      subtotal: s.subtotal,
      tax_amount: s.tax_amount,
      total: s.total_amount,
      total_display: money(s.total_amount),
      payment_status: s.payment_status,
      created_at: s.created_at,
    })),
  });
}

export async function recordSale(input: unknown, opts?: { dryRun?: boolean }): Promise<ToolResponse> {
  const parsed = RecordSaleInput.parse(input);
  const store = getStore();
  const customer = await store.findCustomer(parsed.customer);
  if (!customer) {
    const names = (await store.listCustomers()).map((c) => c.name);
    return fail("record_sale", "CUSTOMER_NOT_FOUND", `Customer not found: "${parsed.customer}"`, names);
  }

  // Pass 1: validate + price everything before any mutation (PRD Rule 7).
  const lines: { product_id: string; name: string; quantity: number; unit_price: number; tax_rate: number; tax_amount: number; product_ref: string }[] = [];
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of parsed.items) {
    const p = await store.findProduct(item.product);
    if (!p) {
      return fail("record_sale", "PRODUCT_NOT_FOUND", `Product not found: "${item.product}"`, await store.productSuggestions(item.product));
    }
    if (p.current_stock < item.quantity) {
      return fail("record_sale", "INSUFFICIENT_STOCK", `Only ${p.current_stock} ${p.unit} of ${p.name} available (requested ${item.quantity})`);
    }
    const unitPrice = item.unit_price ?? p.selling_price;
    const taxRate = await store.taxRateForCategory(p.category);
    const taxAmount = Math.round(unitPrice * item.quantity * taxRate);
    lines.push({ product_id: p.id, name: p.name, quantity: item.quantity, unit_price: unitPrice, tax_rate: taxRate, tax_amount: taxAmount, product_ref: p.name });
    subtotal += unitPrice * item.quantity;
    taxTotal += taxAmount;
  }
  const total = subtotal + taxTotal;
  const items = lines.map((l) => ({ product: l.name, quantity: l.quantity, unit_price: l.unit_price, tax_amount: l.tax_amount }));

  if (opts?.dryRun) {
    const current = await store.listProducts();
    return ok("record_sale", {
      pending_confirmation: true,
      summary: `Record sale of ${lines.map((l) => `${l.quantity} ${l.name}`).join(", ")} to ${customer.name} for ${money(total)} (${parsed.payment_status})?`,
      customer: customer.name,
      items,
      subtotal,
      tax_amount: taxTotal,
      total,
      total_display: money(total),
      payment_status: parsed.payment_status,
      stock_after: lines.map((l) => ({
        product: l.name,
        remaining: (current.find((p) => p.id === l.product_id)?.current_stock ?? 0) - l.quantity,
      })),
    });
  }

  // Pass 2: commit — invoice + movements + cash, all-or-nothing in the store.
  const result = await store.insertSaleWithMovements(
    {
      customer_id: customer.id,
      customer_ref: customer.name,
      items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, tax_amount: l.tax_amount, product_ref: l.name })),
      subtotal,
      tax_amount: taxTotal,
      total_amount: total,
      payment_status: parsed.payment_status,
    },
    lines.map((l) => ({ product_id: l.product_id, delta: -l.quantity, type: "sale_issue" as const })),
    parsed.payment_status === "paid"
      ? { type: "income" as const, amount: total, category: "sales", description: `Sale to ${customer.name}`, reference_type: "sale", reference_id: undefined }
      : null
  );

  if (!result.ok || !result.sale) {
    return fail("record_sale", result.error ?? "DB_ERROR", result.message ?? "Sale could not be committed — no changes were made.");
  }

  const invoice = result.sale;
  const stockNow = await store.listProducts();
  return ok("record_sale", {
    invoice_id: invoice.id,
    customer: customer.name,
    items,
    subtotal,
    tax_amount: taxTotal,
    total: invoice.total_amount,
    total_display: money(invoice.total_amount),
    payment_status: invoice.payment_status,
    remaining_stock: lines.map((l) => ({ product: l.name, remaining: stockNow.find((p) => p.id === l.product_id)?.current_stock ?? 0 })),
  });
}
