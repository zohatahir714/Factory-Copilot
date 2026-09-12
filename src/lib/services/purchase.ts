import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import { db, findProduct, findSupplier, nextIds, productSuggestions, taxRateForCategory, type POItem } from "./store";
import { money } from "@/lib/format";

/**
 * PURCHASE SERVICE — PO creation, listing, goods receipt.
 * receiveGoods enforces PRD Rule 7: one atomic operation updates the PO,
 * appends movement rows, and refreshes the stock cache — or nothing changes.
 */

export const CreatePOInput = z.object({
  supplier: z.string().min(1).describe("Supplier name (id also accepted)"),
  items: z.array(z.object({
    product: z.string().min(1).describe("Product name or id"),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative().optional(),
  })).min(1),
});
export const PORefInput = z.object({ po_id: z.string().min(1) });
export const ListPOInput = z.object({ status: z.enum(["pending", "received"]).optional() });

function resolveSupplier(ref: string) {
  return db.suppliers.find((s) => s.id === ref) ?? findSupplier(ref);
}

function resolveProduct(ref: string) {
  return db.products.find((p) => p.id === ref) ?? findProduct(ref);
}

export function createPO(input: unknown): ToolResponse {
  const data = CreatePOInput.parse(input);
  const supplier = resolveSupplier(data.supplier);
  if (!supplier) return fail("create_purchase_order", "SUPPLIER_NOT_FOUND", `Supplier not found: "${data.supplier}"`, db.suppliers.map((s) => s.name));

  const items: POItem[] = [];
  const lines: { product_id: string; name: string; quantity: number; unit_price: number; tax_amount: number }[] = [];
  let total = 0;
  for (const item of data.items) {
    const p = resolveProduct(item.product);
    if (!p) return fail("create_purchase_order", "PRODUCT_NOT_FOUND", `Product not found: "${item.product}"`, productSuggestions(item.product));
    const unitPrice = item.unit_price ?? p.cost_price;
    const taxAmount = Math.round(unitPrice * item.quantity * taxRateForCategory(p.category));
    items.push({ product_id: p.id, quantity: item.quantity, unit_price: unitPrice, tax_amount: taxAmount });
    lines.push({ product_id: p.id, name: p.name, quantity: item.quantity, unit_price: unitPrice, tax_amount: taxAmount });
    total += unitPrice * item.quantity + taxAmount;
  }

  const po = {
    id: nextIds.po(),
    supplier_id: supplier.id,
    status: "pending" as const,
    items,
    total_amount: total,
    created_at: new Date().toISOString(),
  };
  db.purchaseOrders.push(po);
  return ok("create_purchase_order", {
    po_id: po.id,
    supplier: supplier.name,
    items: lines,
    total: po.total_amount,
    total_display: money(po.total_amount),
    status: po.status,
  });
}

export function listPOs(input: unknown): ToolResponse {
  const { status } = ListPOInput.parse(input ?? {});
  const pos = (status ? db.purchaseOrders.filter((p) => p.status === status) : db.purchaseOrders)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return ok("list_purchase_orders", {
    count: pos.length,
    orders: pos.map((po) => {
      const supplier = db.suppliers.find((s) => s.id === po.supplier_id);
      return {
        po_id: po.id,
        supplier: supplier?.name ?? po.supplier_id,
        status: po.status,
        items: po.items.map((i) => ({ product: db.products.find((p) => p.id === i.product_id)?.name ?? i.product_id, quantity: i.quantity, unit_price: i.unit_price, tax_amount: i.tax_amount })),
        total: po.total_amount,
        total_display: money(po.total_amount),
        created_at: po.created_at,
        received_at: po.received_at ?? null,
      };
    }),
  });
}

export function previewReceive(input: unknown): ToolResponse {
  const { po_id } = PORefInput.parse(input);
  const po = db.purchaseOrders.find((o) => o.id.toLowerCase() === po_id.toLowerCase());
  if (!po) return fail("receive_goods", "PO_NOT_FOUND", `Purchase order not found: "${po_id}"`, db.purchaseOrders.filter((o) => o.status === "pending").map((o) => o.id));
  if (po.status === "received") return fail("receive_goods", "PO_ALREADY_RECEIVED", `Purchase order ${po.id} was already received`);
  const supplier = db.suppliers.find((s) => s.id === po.supplier_id);
  const items = po.items.map((item) => {
    const p = db.products.find((prod) => prod.id === item.product_id);
    return {
      product: p?.name ?? item.product_id,
      quantity_received: item.quantity,
      current_stock: p?.current_stock ?? 0,
      new_stock: (p?.current_stock ?? 0) + item.quantity,
    };
  });
  return ok("receive_goods", {
    pending_confirmation: true,
    summary: `Receive goods for ${po.id} from ${supplier?.name ?? po.supplier_id} (${items.map((r) => `${r.product} → ${r.new_stock}`).join(", ")})?`,
    po_id: po.id,
    items,
  });
}

export function receiveGoods(input: unknown): ToolResponse {
  const { po_id } = PORefInput.parse(input);
  const po = db.purchaseOrders.find((o) => o.id.toLowerCase() === po_id.toLowerCase());
  if (!po) return fail("receive_goods", "PO_NOT_FOUND", `Purchase order not found: "${po_id}"`);
  if (po.status === "received") return fail("receive_goods", "PO_ALREADY_RECEIVED", `Purchase order ${po.id} was already received`);

  // Atomic block: PO status + movements + stock cache, or nothing.
  const now = new Date().toISOString();
  po.status = "received";
  po.received_at = now;
  const received = po.items.map((item) => {
    const p = db.products.find((prod) => prod.id === item.product_id);
    if (p) {
      p.current_stock += item.quantity;
      db.movements.push({ id: nextIds.movement(), product_id: p.id, delta: item.quantity, type: "purchase_receipt", reference_type: "purchase_order", reference_id: po.id, created_at: now });
    }
    return { product: p?.name ?? item.product_id, quantity_received: item.quantity, new_stock: p?.current_stock ?? 0 };
  });
  return ok("receive_goods", { po_id: po.id, status: po.status, items: received });
}
