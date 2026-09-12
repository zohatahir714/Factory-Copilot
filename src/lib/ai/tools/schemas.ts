import { z } from "zod";

/**
 * Tool input schemas — CONTRACTS §3. These are the frozen contracts between
 * the model, the tool registry and (later) Zoha's/Sidra's real services.
 * Outputs are produced by the tools themselves as standard envelopes (§4).
 */

export const CheckInventorySchema = z.object({
  product: z.string().min(1).describe("Product name or SKU, as the user said it"),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  unit: z.string().min(1).describe("e.g. kg, meter, piece"),
  category: z.string().optional(),
  cost_price: z.number().nonnegative().optional(),
  selling_price: z.number().nonnegative().optional(),
  reorder_threshold: z.number().nonnegative().optional(),
});

export const CreateSupplierSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  lead_time_days: z.number().int().positive().optional(),
});

export const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const PurchaseItemSchema = z.object({
  product: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative().optional(),
});

export const CreatePurchaseOrderSchema = z.object({
  supplier: z.string().min(1),
  items: z.array(PurchaseItemSchema).min(1),
});

export const GetPendingOrdersSchema = z.object({}).strict();

export const ReceiveGoodsSchema = z.object({
  po_id: z.string().min(1).describe("Purchase order id, e.g. PO-15"),
});

export const SaleItemSchema = z.object({
  product: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative().optional(),
});

export const RecordSaleSchema = z.object({
  customer: z.string().min(1),
  items: z.array(SaleItemSchema).min(1),
  payment_status: z.enum(["paid", "unpaid"]).default("paid"),
});

export const RecordExpenseSchema = z.object({
  amount: z.number().positive(),
  category: z.enum(["utilities", "salaries", "rent", "transport", "other"]),
  description: z.string().optional(),
});

export const GetCashBalanceSchema = z.object({}).strict();

export const GetBusinessSummarySchema = z.object({}).strict();

export const GenerateTaxReportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month as YYYY-MM, e.g. 2026-09"),
});

export const SearchComplianceDocsSchema = z.object({
  question: z.string().min(1),
});
