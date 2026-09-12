import { z } from "zod";
import { fail, ok } from "@/lib/responses";
import {
  CreateSupplierSchema,
  CreatePurchaseOrderSchema,
  GetPendingOrdersSchema,
  ReceiveGoodsSchema,
} from "./schemas";
import * as partiesSvc from "@/lib/services/parties";
import * as purchaseSvc from "@/lib/services/purchase";
import { getStore } from "@/lib/services/store";
import { fromService, toParameters, withPendingPreview, type ToolDefinition } from "./kit";

/** PURCHASE TOOLS (PRD §13 purchase; brief-zoha: tools/purchase.ts). */

export const purchaseTools: ToolDefinition[] = [
  {
    name: "create_supplier",
    description: "Create a new supplier. Write action — returns a preview; commits only after user confirmation.",
    domain: "purchase",
    mutates: true,
    zodSchema: CreateSupplierSchema,
    parameters: toParameters(CreateSupplierSchema),
    run: async (args, _ctx, mode) => {
      const input = CreateSupplierSchema.parse(args);
      if (mode === "preview") {
        if (await getStore().findSupplier(input.name)) {
          return fail("create_supplier", "VALIDATION_ERROR", `Supplier already exists: ${input.name}`);
        }
        return withPendingPreview("create_supplier", `Create supplier "${input.name}"${input.city ? ` (${input.city})` : ""}`, input);
      }
      return partiesSvc.createSupplier(args);
    },
  },
  {
    name: "create_purchase_order",
    description: "Create a purchase order for a supplier. Write action — returns a priced preview (supplier, items, tax, total); commits only after user confirmation.",
    domain: "purchase",
    mutates: true,
    zodSchema: CreatePurchaseOrderSchema,
    parameters: toParameters(CreatePurchaseOrderSchema),
    run: async (args, _ctx, mode) =>
      mode === "preview"
        ? purchaseSvc.createPO(args, { dryRun: true })
        : purchaseSvc.createPO(args),
  },
  {
    name: "get_pending_orders",
    description: "List pending purchase orders with supplier, total and age. Read-only.",
    domain: "purchase",
    mutates: false,
    zodSchema: GetPendingOrdersSchema,
    parameters: toParameters(GetPendingOrdersSchema),
    run: async () => {
      const res = await purchaseSvc.listPOs({ status: "pending" });
      if (!res.success) return res;
      const d = res.data as { orders: { po_id: string; supplier: string; total: number; created_at: string }[] };
      return ok("get_pending_orders", { count: d.orders.length, orders: d.orders });
    },
  },
  {
    name: "receive_goods",
    description: "Receive goods against a purchase order: stock increases per PO items. Write action — returns a preview of stock changes; commits only after user confirmation.",
    domain: "purchase",
    mutates: true,
    zodSchema: ReceiveGoodsSchema,
    parameters: toParameters(ReceiveGoodsSchema),
    run: async (args, _ctx, mode) => (mode === "preview" ? purchaseSvc.previewReceive(args) : purchaseSvc.receiveGoods(args)),
  },
];
