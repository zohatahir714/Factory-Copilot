import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import { getStore } from "./store";
import { money } from "@/lib/format";

/**
 * PURCHASE SERVICE — PO creation, listing, goods receipt.
 * receiveGoods goes through the store's atomic commit (PRD Rule 7): the PO,
 * movement rows and the stock cache update together — or nothing changes.
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
export const ListPOInput = z.object({ status: z.enum(["pending", "received", "cancelled"]).optional() });

export async function createPO(input: unknown, opts?: { dryRun?: boolean }): Promise<ToolResponse> {
  const data = CreatePOInput.parse(input);
  const store = getStore();
  const supplier = await store.findSupplier(data.supplier);
  if (!supplier) {
    const names = (await store.listSuppliers()).map((s) => s.name);
    return fail("create_purchase_order", "SUPPLIER_NOT_FOUND", `Supplier not found: "${data.supplier}"`, names);
  }

  // Resolve + price everything BEFORE any write (all-or-nothing, Rule 7).
  const items: { product_id: string; quantity: number; unit_price: number; tax_amount: number; product_ref: string }[] = [];
  const lines: { product_id: string; name: string; quantity: number; unit_price: number; tax_amount: number }[] = [];
  let total = 0;
  for (const item of data.items) {
    const p = await store.findProduct(item.product);
    if (!p) return fail("create_purchase_order", "PRODUCT_NOT_FOUND", `Product not found: "${item.product}"`, await store.productSuggestions(item.product));
    const unitPrice = item.unit_price ?? p.cost_price;
    const taxAmount = Math.round(unitPrice * item.quantity * (await store.taxRateForCategory(p.category)));
    items.push({ product_id: p.id, product_ref: p.name, quantity: item.quantity, unit_price: unitPrice, tax_amount: taxAmount });
    lines.push({ product_id: p.id, name: p.name, quantity: item.quantity, unit_price: unitPrice, tax_amount: taxAmount });
    total += unitPrice * item.quantity + taxAmount;
  }

  if (opts?.dryRun) {
    return ok("create_purchase_order", {
      pending_confirmation: true,
      summary: `Create PO for ${lines.map((l) => `${l.quantity} ${l.name}`).join(", ")} from ${supplier.name} for ${money(total)}?`,
      supplier: supplier.name,
      items: lines.map((l) => ({ product: l.name, quantity: l.quantity, unit_price: l.unit_price, tax_amount: l.tax_amount })),
      total,
      total_display: money(total),
    });
  }

  const po = await store.insertPO({ supplier_id: supplier.id, supplier_ref: supplier.name, items });
  return ok("create_purchase_order", {
    po_id: po.id,
    supplier: supplier.name,
    items: lines,
    total: po.total_amount,
    total_display: money(po.total_amount),
    status: po.status,
  });
}

export async function listPOs(input: unknown): Promise<ToolResponse> {
  const { status } = ListPOInput.parse(input ?? {});
  const store = getStore();
  let pos = (await store.listPOs()).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (status) pos = pos.filter((p) => p.status === status);
  const suppliers = await store.listSuppliers();
  const products = await store.listProducts();
  return ok("list_purchase_orders", {
    count: pos.length,
    orders: pos.map((po) => {
      const supplier = suppliers.find((s) => s.id === po.supplier_id);
      return {
        po_id: po.id,
        supplier: supplier?.name ?? po.supplier_id,
        status: po.status,
        total: po.total_amount,
        total_display: money(po.total_amount),
        created_at: po.created_at,
        received_at: po.received_at ?? null,
        items: po.items.map((i) => ({
          product: products.find((p) => p.id === i.product_id)?.name ?? i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_amount: i.tax_amount,
        })),
      };
    }),
  });
}

export async function previewReceive(input: unknown): Promise<ToolResponse> {
  const { po_id } = PORefInput.parse(input);
  const store = getStore();
  const po = await store.poById(po_id);
  if (!po) {
    const pending = (await store.listPOs()).filter((o) => o.status === "pending").map((o) => o.id);
    return fail("receive_goods", "PO_NOT_FOUND", `Purchase order not found: "${po_id}"`, pending);
  }
  if (po.status !== "pending") return fail("receive_goods", "PO_ALREADY_RECEIVED", `Purchase order ${po.id} was already ${po.status}`);
  const products = await store.listProducts();
  const suppliers = await store.listSuppliers();
  const supplier = suppliers.find((s) => s.id === po.supplier_id);
  const items = po.items.map((item) => {
    const p = products.find((prod) => prod.id === item.product_id);
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

export async function receiveGoods(input: unknown): Promise<ToolResponse> {
  const { po_id } = PORefInput.parse(input);
  const result = await getStore().receiveGoods(po_id);
  if (!result.ok) {
    const code = result.error ?? "PO_NOT_FOUND";
    return fail("receive_goods", code, result.message ?? "Goods receipt failed");
  }
  return ok("receive_goods", { po_id: result.po!.id, status: result.po!.status, items: result.movements });
}
