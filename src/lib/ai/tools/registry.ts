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
import {
  findProduct,
  mockDb,
  nextIds,
  productSuggestions,
  type MockProduct,
} from "./mock-data";

/**
 * TOOL REGISTRY — the validated, allow-listed bridge between the model and the
 * business layer. Implementations currently call the MOCK dataset; per the
 * replacement contract in mock-data.ts, each run() switches to a real service
 * call without changing schemas or envelopes.
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

const money = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-PK")}`;

/** JSON Schema for Groq tool definitions (Zod v4 native converter). */
function toParameters(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Tax rate lookup: product-category decision table (Sidra's service later). */
function taxRateForProduct(p: MockProduct): number {
  const decision = mockDb.taxDecisions.find((d) => d.category === p.category);
  return decision?.tax_rate ?? 0;
}

export function summaryData() {
  const today = new Date().toISOString().slice(0, 10);
  const salesToday = mockDb.sales
    .filter((s) => s.created_at.slice(0, 10) === today)
    .reduce((sum, s) => sum + s.total_amount, 0);
  const cash = mockDb.cashbook.reduce(
    (sum, e) => sum + (e.type === "income" ? e.amount : -e.amount),
    0
  );
  const lowStock = mockDb.products
    .filter((p) => p.current_stock <= p.reorder_threshold)
    .map((p) => ({ product: p.name, stock: p.current_stock, unit: p.unit, reorder_threshold: p.reorder_threshold }));
  const pendingPOs = mockDb.purchaseOrders
    .filter((po) => po.status === "pending")
    .map((po) => {
      const supplier = mockDb.suppliers.find((s) => s.id === po.supplier_id);
      return { po_id: po.id, supplier: supplier?.name ?? po.supplier_id, total: po.total_amount, created_at: po.created_at };
    });
  const receivables = mockDb.sales
    .filter((s) => s.payment_status === "unpaid")
    .reduce((sum, s) => sum + s.total_amount, 0);
  return { salesToday, cash, lowStock, pendingPOs, receivables };
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
    run: async (args) => {
      const { product } = CheckInventorySchema.parse(args);
      const p = findProduct(product);
      if (!p) {
        return fail("check_inventory", "PRODUCT_NOT_FOUND", `Product not found: "${product}"`, productSuggestions(product));
      }
      return ok("check_inventory", {
        product: p.name,
        sku: p.sku,
        current_stock: p.current_stock,
        unit: p.unit,
        reorder_threshold: p.reorder_threshold,
        low_stock_warning: p.current_stock <= p.reorder_threshold,
      });
    },
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
      if (findProduct(input.name) || mockDb.products.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase())) {
        return fail("create_product", "VALIDATION_ERROR", `Product or SKU already exists: ${input.name} / ${input.sku}`);
      }
      if (mode === "preview") {
        return ok("create_product", {
          pending_confirmation: true,
          summary: `Create product "${input.name}" (SKU ${input.sku}, unit ${input.unit})`,
          draft: input,
        });
      }
      const product: MockProduct = {
        id: `p-${mockDb.products.length + 1}`,
        sku: input.sku,
        name: input.name,
        category: input.category ?? "general",
        unit: input.unit,
        cost_price: input.cost_price ?? 0,
        selling_price: input.selling_price ?? 0,
        reorder_threshold: input.reorder_threshold ?? 0,
        current_stock: 0,
      };
      mockDb.products.push(product);
      return ok("create_product", {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        stock: product.current_stock,
      });
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
      if (mockDb.suppliers.some((s) => s.name.toLowerCase() === input.name.toLowerCase())) {
        return fail("create_supplier", "VALIDATION_ERROR", `Supplier already exists: ${input.name}`);
      }
      if (mode === "preview") {
        return ok("create_supplier", {
          pending_confirmation: true,
          summary: `Create supplier "${input.name}"${input.city ? ` (${input.city})` : ""}`,
          draft: input,
        });
      }
      const supplier = {
        id: `s-${mockDb.suppliers.length + 1}`,
        name: input.name,
        city: input.city ?? "",
        lead_time_days: input.lead_time_days ?? 5,
      };
      mockDb.suppliers.push(supplier);
      return ok("create_supplier", { supplier_id: supplier.id, name: supplier.name });
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
      const input = CreatePurchaseOrderSchema.parse(args);
      const supplier = mockDb.suppliers.find(
        (s) => s.name.toLowerCase().includes(input.supplier.toLowerCase()) || input.supplier.toLowerCase().includes(s.name.toLowerCase())
      );
      if (!supplier) {
        return fail("create_purchase_order", "SUPPLIER_NOT_FOUND", `Supplier not found: "${input.supplier}"`, mockDb.suppliers.map((s) => s.name));
      }
      const items: { product_id: string; name: string; quantity: number; unit_price: number; tax_amount: number }[] = [];
      let total = 0;
      for (const item of input.items) {
        const p = findProduct(item.product);
        if (!p) {
          return fail("create_purchase_order", "PRODUCT_NOT_FOUND", `Product not found: "${item.product}"`, productSuggestions(item.product));
        }
        const unitPrice = item.unit_price ?? p.cost_price;
        const taxAmount = Math.round(unitPrice * item.quantity * taxRateForProduct(p));
        items.push({ product_id: p.id, name: p.name, quantity: item.quantity, unit_price: unitPrice, tax_amount: taxAmount });
        total += unitPrice * item.quantity + taxAmount;
      }
      const lines = items.map((i) => ({ product: i.name, quantity: i.quantity, unit_price: i.unit_price, tax_amount: i.tax_amount }));
      if (mode === "preview") {
        return ok("create_purchase_order", {
          pending_confirmation: true,
          summary: `Create PO for ${items.map((i) => `${i.quantity} ${i.name}`).join(", ")} from ${supplier.name} for ${money(total)}?`,
          supplier: supplier.name,
          items: lines,
          total,
          total_display: money(total),
        });
      }
      const po = {
        id: nextIds.po(),
        supplier_id: supplier.id,
        status: "pending" as const,
        items,
        total_amount: total,
        created_at: new Date().toISOString(),
      };
      mockDb.purchaseOrders.push(po);
      return ok("create_purchase_order", {
        po_id: po.id,
        supplier: supplier.name,
        items: lines,
        total: po.total_amount,
        total_display: money(po.total_amount),
        status: po.status,
      });
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
      const orders = summaryData().pendingPOs;
      return ok("get_pending_orders", { count: orders.length, orders });
    },
  },
  {
    name: "receive_goods",
    description: "Receive goods against a purchase order: stock increases per PO items. Write action — returns a preview of stock changes; commits only after user confirmation.",
    domain: "purchase",
    mutates: true,
    zodSchema: ReceiveGoodsSchema,
    parameters: toParameters(ReceiveGoodsSchema),
    run: async (args, _ctx, mode) => {
      const { po_id } = ReceiveGoodsSchema.parse(args);
      const po = mockDb.purchaseOrders.find((o) => o.id.toLowerCase() === po_id.toLowerCase());
      if (!po) {
        return fail("receive_goods", "PO_NOT_FOUND", `Purchase order not found: "${po_id}"`, mockDb.purchaseOrders.filter((o) => o.status === "pending").map((o) => o.id));
      }
      if (po.status === "received") {
        return fail("receive_goods", "PO_ALREADY_RECEIVED", `Purchase order ${po.id} was already received`);
      }
      const supplier = mockDb.suppliers.find((s) => s.id === po.supplier_id);
      const projected = po.items.map((item) => {
        const p = mockDb.products.find((prod) => prod.id === item.product_id);
        return {
          product: p?.name ?? item.product_id,
          quantity_received: item.quantity,
          current_stock: p?.current_stock ?? 0,
          new_stock: (p?.current_stock ?? 0) + item.quantity,
        };
      });
      if (mode === "preview") {
        return ok("receive_goods", {
          pending_confirmation: true,
          summary: `Receive goods for ${po.id} from ${supplier?.name ?? po.supplier_id} (${projected.map((r) => `${r.product} → ${r.new_stock}`).join(", ")})?`,
          po_id: po.id,
          items: projected,
        });
      }
      po.status = "received";
      for (const item of po.items) {
        const p = mockDb.products.find((prod) => prod.id === item.product_id);
        if (p) p.current_stock += item.quantity;
      }
      const received = po.items.map((item) => {
        const p = mockDb.products.find((prod) => prod.id === item.product_id);
        return { product: p?.name ?? item.product_id, quantity_received: item.quantity, new_stock: p?.current_stock ?? 0 };
      });
      return ok("receive_goods", { po_id: po.id, status: po.status, items: received });
    },
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
      if (mockDb.customers.some((c) => c.name.toLowerCase() === input.name.toLowerCase())) {
        return fail("create_customer", "VALIDATION_ERROR", `Customer already exists: ${input.name}`);
      }
      if (mode === "preview") {
        return ok("create_customer", {
          pending_confirmation: true,
          summary: `Create customer "${input.name}"${input.city ? ` (${input.city})` : ""}`,
          draft: input,
        });
      }
      const customer = { id: `c-${mockDb.customers.length + 1}`, name: input.name, city: input.city ?? "" };
      mockDb.customers.push(customer);
      return ok("create_customer", { customer_id: customer.id, name: customer.name });
    },
  },
  {
    name: "record_sale",
    description: "Record a sale: validates stock, computes tax deterministically from tax decisions, creates the invoice, decrements stock, and records cash when paid. Write action — returns a priced preview; commits only after user confirmation.",
    domain: "accounting",
    mutates: true,
    zodSchema: RecordSaleSchema,
    parameters: toParameters(RecordSaleSchema),
    run: async (args, _ctx, mode) => {
      const input = RecordSaleSchema.parse(args);
      const customer = mockDb.customers.find(
        (c) => c.name.toLowerCase().includes(input.customer.toLowerCase()) || input.customer.toLowerCase().includes(c.name.toLowerCase())
      );
      if (!customer) {
        return fail("record_sale", "CUSTOMER_NOT_FOUND", `Customer not found: "${input.customer}"`, mockDb.customers.map((c) => c.name));
      }
      const items: { product_id: string; name: string; quantity: number; unit_price: number; tax_rate: number; tax_amount: number; line_total: number }[] = [];
      let subtotal = 0;
      let taxTotal = 0;
      // Pass 1: validate everything before any mutation (PRD Rule 7).
      for (const item of input.items) {
        const p = findProduct(item.product);
        if (!p) {
          return fail("record_sale", "PRODUCT_NOT_FOUND", `Product not found: "${item.product}"`, productSuggestions(item.product));
        }
        if (p.current_stock < item.quantity) {
          return fail("record_sale", "INSUFFICIENT_STOCK", `Only ${p.current_stock} ${p.unit} of ${p.name} available (requested ${item.quantity})`);
        }
        const unitPrice = item.unit_price ?? p.selling_price;
        const taxRate = taxRateForProduct(p);
        const taxAmount = Math.round(unitPrice * item.quantity * taxRate);
        items.push({ product_id: p.id, name: p.name, quantity: item.quantity, unit_price: unitPrice, tax_rate: taxRate, tax_amount: taxAmount, line_total: unitPrice * item.quantity + taxAmount });
        subtotal += unitPrice * item.quantity;
        taxTotal += taxAmount;
      }
      const total = subtotal + taxTotal;
      const lines = items.map((i) => ({ product: i.name, quantity: i.quantity, unit_price: i.unit_price, tax_amount: i.tax_amount }));
      const remaining = items.map((i) => {
        const p = mockDb.products.find((prod) => prod.id === i.product_id);
        return { product: i.name, remaining: (p?.current_stock ?? 0) - i.quantity };
      });
      if (mode === "preview") {
        return ok("record_sale", {
          pending_confirmation: true,
          summary: `Record sale of ${items.map((i) => `${i.quantity} ${i.name}`).join(", ")} to ${customer.name} for ${money(total)} (${input.payment_status})?`,
          customer: customer.name,
          items: lines,
          subtotal,
          tax_amount: taxTotal,
          total,
          total_display: money(total),
          payment_status: input.payment_status,
          stock_after: remaining,
        });
      }
      // Pass 2: commit mutations.
      for (const item of items) {
        const p = mockDb.products.find((prod) => prod.id === item.product_id);
        if (p) p.current_stock -= item.quantity;
      }
      const invoice = {
        id: nextIds.invoice(),
        customer_id: customer.id,
        items,
        subtotal,
        tax_amount: taxTotal,
        total_amount: total,
        payment_status: input.payment_status,
        created_at: new Date().toISOString(),
      };
      mockDb.sales.push(invoice);
      if (input.payment_status === "paid") {
        mockDb.cashbook.push({ id: nextIds.cash(), type: "income", amount: invoice.total_amount, category: "sales", description: `Sale to ${customer.name} (${invoice.id})`, created_at: invoice.created_at });
      }
      return ok("record_sale", {
        invoice_id: invoice.id,
        customer: customer.name,
        items: lines,
        subtotal,
        tax_amount: taxTotal,
        total: invoice.total_amount,
        total_display: money(invoice.total_amount),
        payment_status: invoice.payment_status,
        remaining_stock: items.map((i) => {
          const p = mockDb.products.find((prod) => prod.id === i.product_id);
          return { product: i.name, remaining: p?.current_stock ?? 0 };
        }),
      });
    },
  },
  {
    name: "record_expense",
    description: "Record a cash expense. Write action — returns a preview; commits only after user confirmation.",
    domain: "accounting",
    mutates: true,
    zodSchema: RecordExpenseSchema,
    parameters: toParameters(RecordExpenseSchema),
    run: async (args, _ctx, mode) => {
      const input = RecordExpenseSchema.parse(args);
      if (mode === "preview") {
        return ok("record_expense", {
          pending_confirmation: true,
          summary: `Record expense of ${money(input.amount)} (${input.category})?`,
          draft: input,
        });
      }
      const entry = {
        id: nextIds.cash(),
        type: "expense" as const,
        amount: input.amount,
        category: input.category,
        description: input.description ?? input.category,
        created_at: new Date().toISOString(),
      };
      mockDb.cashbook.push(entry);
      const cash = summaryData().cash;
      return ok("record_expense", { entry_id: entry.id, amount: entry.amount, category: entry.category, new_cash_position: cash, cash_display: money(cash) });
    },
  },
  {
    name: "get_cash_balance",
    description: "Get the current cash position (cashbook income − expense). Read-only.",
    domain: "accounting",
    mutates: false,
    zodSchema: GetCashBalanceSchema,
    parameters: toParameters(GetCashBalanceSchema),
    run: async () => {
      const cash = summaryData().cash;
      return ok("get_cash_balance", { cash_position: cash, display: money(cash), as_of: new Date().toISOString() });
    },
  },
  {
    name: "get_business_summary",
    description: "One-command business overview: sales today, cash, low stock, pending POs, outstanding receivables. Read-only.",
    domain: "accounting",
    mutates: false,
    zodSchema: GetBusinessSummarySchema,
    parameters: toParameters(GetBusinessSummarySchema),
    run: async () => {
      const s = summaryData();
      return ok("get_business_summary", {
        sales_today: s.salesToday,
        sales_today_display: money(s.salesToday),
        cash_position: s.cash,
        cash_display: money(s.cash),
        low_stock: s.lowStock,
        pending_pos: s.pendingPOs,
        pending_po_count: s.pendingPOs.length,
        outstanding_receivables: s.receivables,
        receivables_display: money(s.receivables),
        recommended_action: s.lowStock.length > 0 ? `Reorder ${s.lowStock.map((l) => l.product).join(", ")}` : "No action needed",
      });
    },
  },

  // ---------------- COMPLIANCE ----------------
  {
    name: "generate_tax_report",
    description: "Monthly GST-style report: output tax from sales, input tax from received purchases, net payable. Read-only.",
    domain: "compliance",
    mutates: false,
    zodSchema: GenerateTaxReportSchema,
    parameters: toParameters(GenerateTaxReportSchema),
    run: async (args) => {
      const { month } = GenerateTaxReportSchema.parse(args);
      const inMonth = (iso: string) => iso.slice(0, 7) === month;
      const outputTax = mockDb.sales.filter((s) => inMonth(s.created_at)).reduce((sum, s) => sum + s.tax_amount, 0);
      const inputTax = mockDb.purchaseOrders
        .filter((po) => po.status === "received" && inMonth(po.created_at))
        .reduce((sum, po) => sum + Math.round(po.items.reduce((t, i) => t + i.unit_price * i.quantity, 0) * 0.18), 0);
      const byCategory = mockDb.taxDecisions.map((d) => ({ category: d.category, tax_rate: d.tax_rate, tax_type: d.tax_type, source_document: d.source_document, effective_date: d.effective_date }));
      return ok("generate_tax_report", {
        month,
        output_tax: outputTax,
        input_tax: inputTax,
        net_payable: outputTax - inputTax,
        net_payable_display: money(outputTax - inputTax),
        by_category: byCategory,
        note: "Rates sourced from indexed tax decisions — verify with accountant/FBR before filing.",
      });
    },
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
      const decisions = mockDb.taxDecisions.filter((d) => q.includes(d.category) || q.includes("gst") || q.includes("tax"));
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
