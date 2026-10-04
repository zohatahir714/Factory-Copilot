/**
 * The tool contract the AI resolver must speak.
 *
 * This is the whole idea of the project in one file. The model is allowed to
 * choose WHICH existing, deterministic tool answers you and to fill in its
 * parameters. It is not allowed to compute anything, invent an entity, or write
 * to the ledger. Money moves only through the functions in `businessTools.ts`,
 * which are already tested; a tool call is a routing decision, not an
 * instruction.
 *
 * The schema is CLOSED on purpose. An open "what would you like to do?" prompt
 * gives the model room to invent a capability this product does not have. Every
 * entry below corresponds to a real exported tool and a real supervisor intent,
 * and `aiContract.test.ts` fails if any of the three drift apart.
 *
 * NAMING: the offline resolver is deliberately not called a "mock". The bundle
 * must contain no placeholder vocabulary at all, and a filename that lies about
 * what ships is a smell anyway — this resolver is the shipped behaviour for
 * every machine without an API key, not a stand-in for one.
 */

/** Parameters a tool call may carry. Free-form by design, verified before use. */
export type ToolParams = Record<string, string | number | undefined>;

export interface ToolCall {
  tool: ToolName;
  params: ToolParams;
  /**
   * 0..1, the model's own estimate that it understood. Below GATE the call is
   * discarded and the deterministic refusal path runs — a low-confidence guess
   * is worse than an honest "I did not understand that".
   */
  confidence: number;
}

export interface ResolverResult {
  call?: ToolCall;
  /** Why it failed, for the misses log. Never surfaced as a user-facing error. */
  reason?: string;
}

export type Resolver = (utterance: string) => Promise<ResolverResult>;

export type ToolName =
  | 'check_stock'
  | 'stock_health'
  | 'get_cash_balance'
  | 'get_receivables'
  | 'get_payables'
  | 'get_profit'
  | 'get_business_summary'
  | 'get_pending_orders'
  | 'material_loss'
  | 'compliance_query'
  | 'receive_goods'
  | 'create_purchase_order'
  | 'record_sale'
  | 'record_expense'
  | 'add_supplier'
  | 'add_customer'
  | 'add_product'
  | 'navigate'
  | 'print';

export interface ToolSpec {
  name: ToolName;
  /** Sent to the model verbatim; this IS the tool's documentation. */
  summary: string;
  /** The supervisor intent this tool call maps onto. */
  intent: string;
  /**
   * The agent domain that intent belongs to.
   *
   * This has to be right or the answer is wrong: the supervisor routes by
   * domain as well as intent, so a resolved read tagged "supervisor" fell
   * through every domain branch and came out of the far end as a tax answer to
   * a goods-receipt question.
   */
  domain: 'inventory' | 'purchase' | 'accounting' | 'compliance' | 'supervisor';
  /** True when the action writes or opens something — always behind a card. */
  writes: boolean;
  /** Params that must resolve to a real ledger row before the call is allowed. */
  requiresLedgerEntity?: 'product' | 'supplier' | 'customer';
  /** Navigation target, for the `navigate` tool. */
  module?: string;
}

/** Below this the model is guessing, and guessing is refused. */
export const CONFIDENCE_GATE = 0.55;

export const TOOL_SPECS: readonly ToolSpec[] = [
  { name: 'check_stock', summary: 'How much of one material is on hand', intent: 'check_inventory', domain: 'inventory', writes: false, requiresLedgerEntity: 'product' },
  { name: 'stock_health', summary: 'Which materials are below their reorder level', intent: 'stock_health', domain: 'inventory', writes: false },
  { name: 'get_cash_balance', summary: 'Cash in hand and bank balance', intent: 'get_cash_balance', domain: 'accounting', writes: false },
  { name: 'get_receivables', summary: 'Total money owed by customers', intent: 'get_receivables', domain: 'accounting', writes: false },
  { name: 'get_payables', summary: 'Total money owed to suppliers', intent: 'get_payables', domain: 'purchase', writes: false },
  { name: 'get_profit', summary: 'Sales minus purchases (not a full profit figure)', intent: 'get_profit', domain: 'accounting', writes: false },
  { name: 'get_business_summary', summary: 'Overall business summary for the period', intent: 'get_business_summary', domain: 'accounting', writes: false },
  { name: 'get_pending_orders', summary: 'Purchase orders still awaiting delivery', intent: 'get_pending_orders', domain: 'purchase', writes: false },
  { name: 'material_loss', summary: 'Which material was received but never issued to production, and from which supplier', intent: 'material_loss', domain: 'inventory', writes: false },
  { name: 'compliance_query', summary: 'An FBR or provincial tax question answered from statute', intent: 'compliance_query', domain: 'compliance', writes: false },

  { name: 'receive_goods', summary: 'Record goods received against a pending purchase order', intent: 'receive_goods', domain: 'purchase', writes: true },
  { name: 'create_purchase_order', summary: 'Raise a purchase order for a material from a supplier', intent: 'create_purchase_order', domain: 'purchase', writes: true, requiresLedgerEntity: 'product' },
  { name: 'record_sale', summary: 'Record a sale of material to a customer', intent: 'record_sale', domain: 'accounting', writes: true, requiresLedgerEntity: 'product' },
  { name: 'record_expense', summary: 'Record an expense and post its voucher', intent: 'record_expense', domain: 'accounting', writes: true },
  { name: 'add_supplier', summary: 'Register a new supplier', intent: 'add_supplier', domain: 'purchase', writes: true },
  { name: 'add_customer', summary: 'Register a new customer or mill', intent: 'add_customer', domain: 'accounting', writes: true },
  { name: 'add_product', summary: 'Add a new material to the catalogue', intent: 'add_product', domain: 'inventory', writes: true },

  { name: 'navigate', summary: 'Open a screen of the application', intent: 'navigate', domain: 'supervisor', writes: false },
  { name: 'print', summary: 'Print an invoice, purchase order, voucher or stock report', intent: 'print', domain: 'supervisor', writes: false }
];

const BY_NAME = new Map<ToolName, ToolSpec>(TOOL_SPECS.map(t => [t.name, t]));

export function toolSpec(name: ToolName): ToolSpec | undefined {
  return BY_NAME.get(name);
}

export const TOOL_NAMES = TOOL_SPECS.map(t => t.name);

/** The block of text describing every tool, sent to the model. */
export function toolSchemaForPrompt(): string {
  return TOOL_SPECS
    .map(t => `- ${t.name} — ${t.summary}${t.writes ? ' (writes to the ledger, asks for confirmation)' : ''}`)
    .join('\n');
}

/**
 * The model's JSON response, validated against the closed schema.
 *
 * A model can return a tool this product does not have, a confidence of
 * "high", or a number where a string belongs. Every one of those is a refusal
 * case, not something to coerce — coercing is how a model ends up running a
 * tool nobody chose.
 */
export function parseToolCall(raw: string): ResolverResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { reason: 'response was not JSON' };
  }
  if (!parsed || typeof parsed !== 'object') return { reason: 'response was not an object' };

  const obj = parsed as Record<string, unknown>;
  const name = obj.tool;
  if (typeof name !== 'string' || !BY_NAME.has(name as ToolName)) {
    return { reason: `unknown tool: ${String(name)}` };
  }

  const rawParams = (obj.params ?? {}) as Record<string, unknown>;
  const params: ToolParams = {};
  for (const [k, v] of Object.entries(rawParams)) {
    if (typeof v === 'string' && v.trim() !== '') params[k] = v.trim();
    else if (typeof v === 'number' && Number.isFinite(v)) params[k] = v;
  }

  const rawConfidence = typeof obj.confidence === 'number' ? obj.confidence : 0.5;
  const confidence = Math.max(0, Math.min(1, rawConfidence));

  if (confidence < CONFIDENCE_GATE) {
    return { reason: `confidence ${confidence} below the ${CONFIDENCE_GATE} gate` };
  }

  return { call: { tool: name as ToolName, params, confidence } };
}
