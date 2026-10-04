/**
 * The AI skill layer.
 *
 * Every AI capability this product has is registered here with the module that
 * implements it and the surface a judge can reach it on. Two reasons it is a
 * table rather than a paragraph:
 *
 * 1. ROUTING IS DECIDED HERE, ONCE. `analyzeUserIntent` already produces a
 *    deterministic intent; this file turns that intent into the set of skills
 *    that answered it. The copilot cannot claim a skill it did not run, because
 *    the claim is derived from the intent rather than written into the answer.
 *
 * 2. A SKILL WITH NO IMPLEMENTATION IS NOT A SKILL. Each row names the file
 *    that does the work. `src/agents/__tests__/skills.test.ts` reads this file
 *    and asserts those files exist, so the table cannot drift into a list of
 *    labels the product does not honour.
 *
 * `implementedIn` paths are repository-relative and deliberately extensionless:
 * `tsconfig.json` sets `allowImportingTsExtensions`, but a path in a UI-facing
 * table is not an import and should read the way a person types it.
 */

export type SkillId =
  | 'ledger_reader'
  | 'stock_sufficiency'
  | 'material_loss'
  | 'software_guide'
  | 'purchase_desk'
  | 'reorder_forecast'
  | 'anomaly_watch'
  | 'accounting_books'
  | 'master_registry'
  | 'compliance_rag'
  | 'fbr_payload_builder'
  | 'negotiation_room'
  | 'screen_control'
  | 'document_print';

/** The submission skill flags this product demonstrates, spelled out. */
export type SkillCapability =
  | 'Agentic AI'
  | 'AI Workflows'
  | 'Generative AI'
  | 'Multi-Agent Systems'
  | 'AI-powered BPA';

export interface AgentSkill {
  id: SkillId;
  /** Short name for a badge. */
  label: string;
  /** Which submission skill flag this row evidences. */
  capability: SkillCapability;
  /** One honest line: what it actually does. */
  does: string;
  /** The file that implements it. Checked by the test suite. */
  implementedIn: string;
  /**
   * Supervisor intents this skill answers. Skills with no entry are not
   * reached by typing — they run on a tick, or from a screen.
   */
  intents?: readonly string[];
  /** Where in the running app a person can reach this skill. */
  surfaces?: readonly string[];
}

export const AGENT_SKILLS: readonly AgentSkill[] = [
  {
    id: 'ledger_reader',
    label: 'Ledger Reader',
    capability: 'AI Workflows',
    does: 'Answers stock, cash, receivables, payables and summary questions from live rows only.',
    implementedIn: 'src/lib/businessTools.ts',
    intents: [
      'check_inventory',
      'get_business_summary',
      'get_cash_balance',
      'get_receivables',
      'get_payables',
      'get_profit',
      'get_pending_orders',
      'stock_health',
      'sync_inventory'
    ],
    surfaces: ['Copilot chat', 'Voice assistant']
  },
  {
    id: 'stock_sufficiency',
    label: 'Stock Sufficiency',
    capability: 'AI Workflows',
    does: 'Compares what is on hand against what a purchase would consume, and says so before an order is raised.',
    implementedIn: 'src/ai/stock/index.ts',
    intents: ['stock_check', 'stock_sufficiency', 'create_purchase_order', 'reorder_materials'],
    surfaces: ['Copilot chat', 'Voice assistant', 'Purchase Desk']
  },
  {
    id: 'material_loss',
    label: 'Material Variance',
    capability: 'AI-powered BPA',
    does: 'Reconciles material received against material issued to production, per supplier, and names the variance.',
    implementedIn: 'src/ai/loss/index.ts',
    intents: ['material_loss'],
    surfaces: ['Copilot chat', 'Voice assistant', 'Stock Audit Trail']
  },
  {
    id: 'software_guide',
    label: 'Software Guide',
    capability: 'Generative AI',
    does: 'Answers questions about this app — what a module does and how to reach it — from the module registry.',
    implementedIn: 'src/ai/software/index.ts',
    intents: ['about_software', 'list_capabilities'],
    surfaces: ['Copilot chat', 'Voice assistant']
  },
  {
    id: 'purchase_desk',
    label: 'Purchase Desk',
    capability: 'AI Workflows',
    does: 'Drafts a purchase order and records goods receipt against real suppliers and SKUs.',
    implementedIn: 'src/lib/businessTools.ts',
    intents: ['create_purchase_order', 'receive_goods', 'reorder_materials'],
    surfaces: ['Copilot chat', 'Voice assistant', 'Approval queue']
  },
  {
    id: 'reorder_forecast',
    label: 'Reorder Forecast',
    capability: 'Agentic AI',
    does: 'Averages the trailing dispatch history and proposes a purchase order when cover falls under lead time.',
    implementedIn: 'src/agents/reorder.ts',
    intents: ['reorder_advice'],
    surfaces: ['Approval queue']
  },
  {
    id: 'anomaly_watch',
    label: 'Anomaly Watch',
    capability: 'AI-powered BPA',
    does: 'Scans posted documents for negative stock, overdue receivables and rate mismatches, and flags them with the rule that fired.',
    implementedIn: 'src/agents/anomaly.ts',
    surfaces: ['Approval queue']
  },
  {
    id: 'accounting_books',
    label: 'Accounting Books',
    capability: 'AI Workflows',
    does: 'Records sales and expenses as balanced journal vouchers behind a confirmation card.',
    implementedIn: 'src/utils/accountingEngine.ts',
    intents: ['record_sale', 'record_expense'],
    surfaces: ['Copilot chat', 'Voice assistant', 'Cashbook']
  },
  {
    id: 'master_registry',
    label: 'Master Registry',
    capability: 'AI Workflows',
    does: 'Creates a product, supplier or customer only from what the user said, and asks for the rest.',
    implementedIn: 'src/lib/businessTools.ts',
    intents: ['add_product', 'add_supplier', 'add_customer'],
    surfaces: ['Copilot chat', 'Voice assistant']
  },
  {
    id: 'compliance_rag',
    label: 'Compliance RAG',
    capability: 'Generative AI',
    does: 'Retrieves FBR and provincial passages, answers with the document and section, and refuses when nothing scores above the gate.',
    implementedIn: 'src/lib/rag/retrieval.ts',
    intents: ['compliance_query'],
    surfaces: ['Copilot chat', 'Voice assistant', 'Compliance module']
  },
  {
    id: 'fbr_payload_builder',
    label: 'FBR Payload Builder',
    capability: 'AI-powered BPA',
    does: 'Builds a schema-valid digital-invoice payload and reports missing fields instead of filling them in.',
    implementedIn: 'src/lib/fbr/payload.ts',
    surfaces: ['FBR Digital Invoicing']
  },
  {
    id: 'negotiation_room',
    label: 'Negotiation Room',
    capability: 'Multi-Agent Systems',
    does: 'Runs a buyer agent against a supplier agent over a price band and logs each round and concession.',
    implementedIn: 'src/agents/negotiation/negotiate.ts',
    surfaces: ['Database Inspector']
  },
  {
    id: 'screen_control',
    label: 'Screen Control',
    capability: 'AI Workflows',
    does: 'Opens the module a command names, on voice and on text alike.',
    implementedIn: 'src/lib/agentSupervisor.ts',
    intents: ['navigate'],
    surfaces: ['Copilot chat', 'Voice assistant']
  },
  {
    id: 'document_print',
    label: 'Document Print',
    capability: 'AI Workflows',
    does: 'Prints an invoice, purchase order, cash voucher or stock report built from ledger rows.',
    implementedIn: 'src/lib/print/invoicePrintModel.ts',
    intents: ['print'],
    surfaces: ['Copilot chat', 'Voice assistant']
  }
];

const BY_ID = new Map<SkillId, AgentSkill>(AGENT_SKILLS.map(s => [s.id, s]));

/** Intent -> skills, in registry order. Built once; the table above is the source. */
const BY_INTENT = ((): Map<string, SkillId[]> => {
  const m = new Map<string, SkillId[]>();
  for (const skill of AGENT_SKILLS) {
    for (const intent of skill.intents ?? []) {
      const list = m.get(intent) ?? [];
      list.push(skill.id);
      m.set(intent, list);
    }
  }
  return m;
})();

export function skillById(id: SkillId): AgentSkill | undefined {
  return BY_ID.get(id);
}

/**
 * The skills that answered an intent.
 *
 * Returns `[]` for an intent no skill claims — `unrecognised_query` and any
 * future intent added to `analyzeUserIntent` before it is registered here. The
 * copilot then shows no skill badge, which is the honest outcome: nothing ran.
 */
export function selectSkills(intent: string): SkillId[] {
  if (!intent) return [];
  return [...(BY_INTENT.get(intent) ?? [])];
}

/** Badge labels for an intent, for the copilot to render under an answer. */
export function skillLabelsFor(intent: string): string[] {
  return selectSkills(intent).map(id => BY_ID.get(id)?.label ?? id);
}

/** How many skills are registered. Derived, so the UI never states a literal. */
export const SKILL_COUNT = AGENT_SKILLS.length;

/**
 * The distinct submission skill flags the registry evidences, sorted.
 *
 * This is what the dashboard renders, and it is computed rather than typed, so
 * claiming "N AI skills" on a card cannot disagree with the code.
 */
export const SKILL_CAPABILITIES: readonly SkillCapability[] = Array.from(
  new Set(AGENT_SKILLS.map(s => s.capability))
).sort();
