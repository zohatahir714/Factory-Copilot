import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import {
  CheckInventorySchema,
  CreateCustomerSchema,
  CreateProductSchema,
  CreatePurchaseOrderSchema,
  CreateSupplierSchema,
  GenerateTaxReportSchema,
  GetBusinessSummarySchema,
  GetCashBalanceSchema,
  GetPendingOrdersSchema,
  RecordSaleSchema,
  ReceiveGoodsSchema,
  RecordExpenseSchema,
  SearchComplianceDocsSchema,
} from "./schemas";
import * as productsSvc from "@/lib/services/products";
import * as partiesSvc from "@/lib/services/parties";
import * as purchaseSvc from "@/lib/services/purchase";
import * as salesSvc from "@/lib/services/sales";
import * as cashbookSvc from "@/lib/services/cashbook";
import * as reportsSvc from "@/lib/services/reports";
import { db } from "@/lib/services/store";

/**
 * TOOL REGISTRY — the validated, allow-listed bridge between the model and the
 * BUSINESS SERVICE LAYER (src/lib/services/*). Tools contain no business logic
 * themselves: they map the model's arguments onto service calls and return the
 * standard envelope. The same services back the REST APIs and forms.
 *
 * Execution modes (PRD §14 confirmation policy):
 *  - "preview": mutating tools validate + compute a draft (real totals, real
 *    entity resolution) but DO NOT commit. The draft powers the confirmation
 *    card ("Create PO for 100kg Reactive Dye Blue ... Rs. 90,000?").
 *  - "commit": performs the mutation. Only reached via /api/tools/confirm
 *    after the user clicks Confirm.
 *  Read-only tools ignore the mode.
 *
 * Security model (PRD §40):
 *  - every input is Zod-validated before execution,
 *  - agents may only call tools in their allow-list,
 *  - the model can never inject SQL — tools own all data access.
 */

export type AgentDomain = "supervisor" | "inventory" | "purchase" | "accounting" | "compliance";
export type ExecutionMode = "preview" | "commit";

export interface ToolContext {
  organizationId: string;
  userId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  domain: Exclude<AgentDomain, "supervisor">;
  mutates: boolean;
  zodSchema: z.ZodTypeAny;
  parameters: Record<string, unknown>; // JSON Schema sent to Groq
  run: (args: unknown, ctx: ToolContext, mode: ExecutionMode) => Promise<ToolResponse>;
}

/* ---------------------------------- helpers --------------------------------- */

/** JSON Schema for Groq tool definitions (Zod v4 native converter). */
function toParameters(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Wrap a service call with Zod validation and error mapping. */
function fromService(name: string, schema: z.ZodTypeAny, service: (input: unknown) => ToolResponse, args: unknown): ToolResponse {
  try {
    schema.parse(args ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      const path = first.path.join(".") || "input";
      return fail(name, "VALIDATION_ERROR", `${path}: ${first.message}`);
    }
    throw err;
  }
  return service(args);
}

/* ------------------------------ P0 tool definitions ------------------------------ */

const tools: ToolDefinition[] = [
  // ---------------- INVENTORY ----------------
  {
    name: "check_inventory",
    description: "Check available stock for a product by name or SKU. Read-only.",
    domain: "inventory",
    mutates: false,
    zodSchema: CheckInventorySchema,
    parameters: toParameters(CheckInventorySchema),
    run: async (args) => fromService("check_inventory", CheckInventorySchema, productsSvc.lookupProduct, args),
  },
  {
    name: "create_product",
    description: "Create a new product. Write action — returns a preview; commits only after user confirmation.",
    domain: "inventory",
    mutates: true,
    zodSchema: CreateProductSchema,
    parameters: toParameters(CreateProductSchema),
    run: async (args, _ctx, mode) => {
      const input = CreateProductSchema.parse(args);
      const duplicate =
        db.products.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase()) ||
        db.products.some((p) => p.name.toLowerCase() === input.name.toLowerCase());
      if (duplicate) {
        return fail("create_product", "VALIDATION_ERROR", `Product or SKU already exists: ${input.name} / ${input.sku}`);
      }
      if (mode === "preview") {
        return withPendingPreview("create_product", `Create product "${input.name}" (SKU ${input.sku}, unit ${input.unit})`, input);
      }
      return productsSvc.createProduct(args);
    },
  },

  // ---------------- PURCHASE ----------------
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
        if (db.suppliers.some((s) => s.name.toLowerCase() === input.name.toLowerCase())) {
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
    run: async (args, _ctx, mode) => {
      if (mode === "preview") {
        // Dry-run createPO: it validates and prices, but the service commits.
        // To keep the store untouched, snapshot/rollback around the call.
        const snapshot = serializeDb();
        try {
          const created = purchaseSvc.createPO(args);
          if (!created.success) return created;
          const d = created.data as { po_id: string; supplier: string; total: number; total_display: string; items: unknown[] };
          const input = CreatePurchaseOrderSchema.parse(args);
          return ok("create_purchase_order", {
            pending_confirmation: true,
            summary: `Create PO for ${input.items.map((i) => `${i.quantity} ${(d.items as { product: string }[])[input.items.indexOf(i)]?.product ?? i.product}`).join(", ")} from ${d.supplier} for ${d.total_display}?`,
            supplier: d.supplier,
            items: d.items,
            total: d.total,
            total_display: d.total_display,
          });
        } finally {
          restoreDb(snapshot);
        }
      }
      return purchaseSvc.createPO(args);
    },
  },
  {
    name: "get_pending_orders",
    description: "List pending purchase orders with supplier, total and age. Read-only.",
    domain: "purchase",
    mutates: false,
    zodSchema: GetPendingOrdersSchema,
    parameters: toParameters(GetPendingOrdersSchema),
    run: async () => {
      const res = purchaseSvc.listPOs({ status: "pending" });
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

  // ---------------- ACCOUNTING ----------------
  {
    name: "create_customer",
    description: "Create a new customer. Write action — returns a preview; commits only after user confirmation.",
    domain: "accounting",
    mutates: true,
    zodSchema: CreateCustomerSchema,
    parameters: toParameters(CreateCustomerSchema),
    run: async (args, _ctx, mode) => {
      const input = CreateCustomerSchema.parse(args);
      if (mode === "preview") {
        if (db.customers.some((c) => c.name.toLowerCase() === input.name.toLowerCase())) {
          return fail("create_customer", "VALIDATION_ERROR", `Customer already exists: ${input.name}`);
        }
        return withPendingPreview("create_customer", `Create customer "${input.name}"${input.city ? ` (${input.city})` : ""}`, input);
      }
      return partiesSvc.createCustomer(args);
    },
  },
  {
    name: "record_sale",
    description: "Record a sale: validates stock, computes tax deterministically from tax decisions, creates the invoice, decrements stock, and records cash when paid. Write action — returns a priced preview; commits only after user confirmation.",
    domain: "accounting",
    mutates: true,
    zodSchema: RecordSaleSchema,
    parameters: toParameters(RecordSaleSchema),
    run: async (args, _ctx, mode) => salesSvc.recordSale(args, { dryRun: mode === "preview" }),
  },
  {
    name: "record_expense",
    description: "Record a cash expense. Write action — returns a preview; commits only after user confirmation.",
    domain: "accounting",
    mutates: true,
    zodSchema: RecordExpenseSchema,
    parameters: toParameters(RecordExpenseSchema),
    run: async (args, _ctx, mode) => cashbookSvc.recordExpense(args, { dryRun: mode === "preview" }),
  },
  {
    name: "get_cash_balance",
    description: "Get the current cash position (cashbook income − expense). Read-only.",
    domain: "accounting",
    mutates: false,
    zodSchema: GetCashBalanceSchema,
    parameters: toParameters(GetCashBalanceSchema),
    run: async () => cashbookSvc.getCashPosition(),
  },
  {
    name: "get_business_summary",
    description: "One-command business overview: sales today, cash, low stock, pending POs, outstanding receivables. Read-only.",
    domain: "accounting",
    mutates: false,
    zodSchema: GetBusinessSummarySchema,
    parameters: toParameters(GetBusinessSummarySchema),
    run: async () => reportsSvc.businessSummary(),
  },

  // ---------------- COMPLIANCE ----------------
  {
    name: "generate_tax_report",
    description: "Monthly GST-style report: output tax from sales, input tax from received purchases, net payable. Read-only.",
    domain: "compliance",
    mutates: false,
    zodSchema: GenerateTaxReportSchema,
    parameters: toParameters(GenerateTaxReportSchema),
    run: async (args) => reportsSvc.taxReport(args),
  },
  {
    name: "search_compliance_docs",
    description: "Search the compliance knowledge base for regulatory guidance with source references. Read-only.",
    domain: "compliance",
    mutates: false,
    zodSchema: SearchComplianceDocsSchema,
    parameters: toParameters(SearchComplianceDocsSchema),
    run: async (args) => {
      const { question } = SearchComplianceDocsSchema.parse(args);
      // Placeholder retrieval until Sidra's trigram RAG lands (MASTER_PLAN §9).
      const q = question.toLowerCase();
      const decisions = db.taxDecisions.filter((d) => q.includes(d.category) || q.includes("gst") || q.includes("tax"));
      if (decisions.length === 0) {
        return ok("search_compliance_docs", {
          chunks: [],
          confidence: 0,
          note: "I couldn't find sufficient authoritative guidance in the indexed sources. Please verify this with the accountant/FBR.",
        });
      }
      return ok("search_compliance_docs", {
        chunks: decisions.map((d) => ({ title: d.source_document, source_url: d.source_reference, effective_date: d.effective_date, snippet: `${d.tax_type} rate for ${d.category}: ${(d.tax_rate * 100).toFixed(0)}%` })),
        confidence: decisions.reduce((max, d) => Math.max(max, d.confidence), 0),
      });
    },
  },
];

/* ------------------------------ preview helpers ------------------------------ */

/** Wrap committed service data as a pending-confirmation preview payload. */
function withPendingPreview(tool: string, summary: string, data: unknown): ToolResponse {
  return ok(tool, { pending_confirmation: true, summary, draft: data });
}

/** JSON snapshot of the store for dry-run rollback. */
function serializeDb(): string {
  return JSON.stringify({
    products: db.products,
    suppliers: db.suppliers,
    customers: db.customers,
    purchaseOrders: db.purchaseOrders,
    sales: db.sales,
    cashbook: db.cashbook,
    movements: db.movements,
    seq: db.seq,
  });
}

function restoreDb(snapshot: string): void {
  const s = JSON.parse(snapshot) as typeof db;
  db.products = s.products;
  db.suppliers = s.suppliers;
  db.customers = s.customers;
  db.purchaseOrders = s.purchaseOrders;
  db.sales = s.sales;
  db.cashbook = s.cashbook;
  db.movements = s.movements;
  db.seq = s.seq;
}

/* ------------------------------ allow-lists & API ------------------------------ */

/** Per-agent tool allow-list (PRD §40: enforced, not advisory). */
export const TOOL_ALLOW_LIST: Record<AgentDomain, string[]> = {
  supervisor: ["check_inventory", "get_cash_balance", "get_pending_orders", "get_business_summary", "search_compliance_docs"],
  inventory: ["check_inventory", "create_product"],
  purchase: ["create_purchase_order", "get_pending_orders", "receive_goods", "create_supplier"],
  accounting: ["record_sale", "record_expense", "get_cash_balance", "get_business_summary", "create_customer"],
  compliance: ["generate_tax_report", "search_compliance_docs"],
};

/** Tool definitions in Groq/OpenAI tool-calling format. */
export function toolDefinitionsForModel(): {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function toolDefinitionsForDomain(domain: Exclude<AgentDomain, "supervisor">) {
  return toolDefinitionsForModel().filter((t) => (TOOL_ALLOW_LIST[domain] ?? []).includes(t.function.name));
}

export function isToolAllowed(name: string, agent: AgentDomain): boolean {
  return (TOOL_ALLOW_LIST[agent] ?? []).includes(name);
}

export function findTool(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}

export function toolCatalog() {
  return tools.map(({ name, description, domain, mutates }) => ({ name, description, domain, mutates }));
}

export async function executeTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
  agent: AgentDomain = "supervisor",
  mode: ExecutionMode = "commit"
): Promise<ToolResponse> {
  const tool = findTool(name);
  if (!tool) {
    return fail(name, "VALIDATION_ERROR", `Unknown tool: ${name}`);
  }
  if (!isToolAllowed(name, agent)) {
    return fail(name, "UNAUTHORIZED", `Tool ${name} is not in the ${agent} allow-list`);
  }
  try {
    return await tool.run(args, ctx, mode);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      const path = first.path.join(".") || "input";
      return fail(name, "VALIDATION_ERROR", `${path}: ${first.message}`);
    }
    return fail(name, "DB_ERROR", "Tool execution failed");
  }
}
