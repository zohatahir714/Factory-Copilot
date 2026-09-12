import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import { db, findCustomer, findProduct, nextIds, productSuggestions, taxRateForCategory } from "./store";
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

function resolveCustomer(ref: string) {
  return db.customers.find((c) => c.id === ref) ?? findCustomer(ref);
}

function resolveProduct(ref: string) {
  return db.products.find((p) => p.id === ref) ?? findProduct(ref);
}

export function listSales(input: unknown): ToolResponse {
  const { limit, payment_status } = ListSalesInput.parse(input ?? {});
  let rows = db.sales.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (payment_status) rows = rows.filter((s) => s.payment_status === payment_status);
  if (limit) rows = rows.slice(0, limit);
  return ok("list_sales", {
    count: rows.length,
    invoices: rows.map((s) => ({
      invoice_id: s.id,
      customer: db.customers.find((c) => c.id === s.customer_id)?.name ?? s.customer_id,
      items: s.items.map((i) => ({
        product: db.products.find((p) => p.id === i.product_id)?.name ?? i.product_id,
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

export function recordSale(input: unknown, opts?: { dryRun?: boolean }): ToolResponse {
  const parsed = RecordSaleInput.parse(input);
  const customer = resolveCustomer(parsed.customer);
  if (!customer) {
    return fail("record_sale", "CUSTOMER_NOT_FOUND", `Customer not found: "${parsed.customer}"`, db.customers.map((c) => c.name));
  }

  // Pass 1: validate + price everything before any mutation (PRD Rule 7).
  const lines: { product_id: string; name: string; quantity: number; unit_price: number; tax_rate: number; tax_amount: number }[] = [];
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of parsed.items) {
    const p = resolveProduct(item.product);
    if (!p) {
      return fail("record_sale", "PRODUCT_NOT_FOUND", `Product not found: "${item.product}"`, productSuggestions(item.product));
    }
    if (p.current_stock < item.quantity) {
      return fail("record_sale", "INSUFFICIENT_STOCK", `Only ${p.current_stock} ${p.unit} of ${p.name} available (requested ${item.quantity})`);
    }
    const unitPrice = item.unit_price ?? p.selling_price;
    const taxRate = taxRateForCategory(p.category);
    const taxAmount = Math.round(unitPrice * item.quantity * taxRate);
    lines.push({ product_id: p.id, name: p.name, quantity: item.quantity, unit_price: unitPrice, tax_rate: taxRate, tax_amount: taxAmount });
    subtotal += unitPrice * item.quantity;
    taxTotal += taxAmount;
  }
  const total = subtotal + taxTotal;
  const items = lines.map((l) => ({ product: l.name, quantity: l.quantity, unit_price: l.unit_price, tax_amount: l.tax_amount }));

  if (opts?.dryRun) {
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
        remaining: (db.products.find((p) => p.id === l.product_id)?.current_stock ?? 0) - l.quantity,
      })),
    });
  }

  // Pass 2: commit — invoice + movements + cash, all or nothing.
  const now = new Date().toISOString();
  const invoice = {
    id: nextIds.invoice(),
    customer_id: customer.id,
    items: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, tax_amount: l.tax_amount })),
    subtotal,
    tax_amount: taxTotal,
    total_amount: total,
    payment_status: parsed.payment_status,
    created_at: now,
  };
  for (const l of lines) {
    const p = db.products.find((x) => x.id === l.product_id);
    if (p) {
      p.current_stock -= l.quantity;
      db.movements.push({ id: nextIds.movement(), product_id: p.id, delta: -l.quantity, type: "sale_issue", reference_type: "sale", reference_id: invoice.id, created_at: now });
    }
  }
  db.sales.push(invoice);
  if (parsed.payment_status === "paid") {
    db.cashbook.push({ id: nextIds.cash(), type: "income", amount: total, category: "sales", description: `Sale ${invoice.id} to ${customer.name}`, reference_type: "sale", reference_id: invoice.id, created_at: now });
  }

  return ok("record_sale", {
    invoice_id: invoice.id,
    customer: customer.name,
    items,
    subtotal,
    tax_amount: taxTotal,
    total: invoice.total_amount,
    total_display: money(invoice.total_amount),
    payment_status: invoice.payment_status,
    remaining_stock: lines.map((l) => ({ product: l.name, remaining: db.products.find((p) => p.id === l.product_id)?.current_stock ?? 0 })),
  });
}
