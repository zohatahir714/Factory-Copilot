import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import {
  CreateCustomerSchema,
  RecordSaleSchema,
  RecordExpenseSchema,
  GetCashBalanceSchema,
  GetBusinessSummarySchema,
  GenerateTaxReportSchema,
  SearchComplianceDocsSchema,
} from "./schemas";
import * as partiesSvc from "@/lib/services/parties";
import * as salesSvc from "@/lib/services/sales";
import * as cashbookSvc from "@/lib/services/cashbook";
import * as reportsSvc from "@/lib/services/reports";
import { getStore } from "@/lib/services/store";
import { fromService, toParameters, withPendingPreview, type AgentDomain, type ExecutionMode, type ToolContext, type ToolDefinition } from "./kit";
import { inventoryTools } from "./inventory";
import { purchaseTools } from "./purchase";

/**
 * TOOL REGISTRY — the validated, allow-listed bridge between the model and the
 * BUSINESS SERVICE LAYER (src/lib/services/*). Tools contain no business logic
 * themselves: they map the model's arguments onto service calls and return the
 * standard envelope. The same services back the REST APIs and forms.
 *
 * Domain tools live in their owners' files (brief-zoha: inventory.ts/purchase.ts
 * by Zoha; accounting/compliance tool files follow from Sidra/the owner).
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

/* ------------------------------ accounting + compliance ------------------------------ */

const accountingComplianceTools: ToolDefinition[] = [
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
        if (await getStore().findCustomer(input.name)) {
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
      const decisions = (await getStore().listTaxDecisions()).filter((d) => q.includes(d.category) || q.includes("gst") || q.includes("tax"));
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

/* ------------------------------ registry ------------------------------ */

const tools: ToolDefinition[] = [...inventoryTools, ...purchaseTools, ...accountingComplianceTools];

/** Per-agent tool allow-list (PRD §40: enforced, not advisory). */
export const TOOL_ALLOW_LIST: Record<AgentDomain, string[]> = {
  supervisor: ["check_inventory", "get_cash_balance", "get_pending_orders", "get_business_summary", "search_compliance_docs"],
  inventory: ["check_inventory", "create_product"],
  purchase: ["create_purchase_order", "get_pending_orders", "receive_goods", "create_supplier"],
  accounting: ["record_sale", "record_expense", "get_cash_balance", "get_business_summary", "create_customer"],
  compliance: ["generate_tax_report", "search_compliance_docs"],
};

/** Tool definitions in Groq/OpenAI tool-calling format. */
export function toolDefinitionsForModel() {
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

export type { AgentDomain, ExecutionMode, ToolContext, ToolDefinition } from "./kit";
