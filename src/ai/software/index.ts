/**
 * Questions about THIS software.
 *
 * "everything i ask ai about the software it will search properly through
 * every route" — which is really two complaints at once. A user who types "how
 * do I print a purchase order" got the compliance RAG, or a refusal, because
 * the supervisor only knew about the ledger and the statute. Anything about the
 * app itself fell between them.
 *
 * So this module owns the app's own map: what each module is, what it is for,
 * and which words reach it. It is a single source the routing tables read, so
 * a module cannot be navigable but undescribed, or described but unreachable.
 *
 * What it deliberately does NOT do is answer questions it has no entry for. A
 * registry that guesses is worse than one that says "I don't know that".
 */
import type { SkillId } from '../../agents/skills.ts';

export interface SoftwareModule {
  /** Matches the tab id the shell switches to. */
  id: string;
  label: string;
  /** One line a judge can read and understand. */
  does: string;
  /** Words that mean "the user means this module". */
  matches: string;
  /** Skills a question inside this module will be routed through. */
  skills: readonly SkillId[];
}

/**
 * The app's own map. Derived from what the code actually does — every entry
 * here corresponds to a tab that exists and a skill that is registered.
 */
export const MODULE_REGISTRY: readonly SoftwareModule[] = [
  {
    id: 'dashboard',
    label: 'Executive Dashboard',
    does: 'Revenue, cash, stock value, receivables and pending orders in one view.',
    matches: 'dashboard|home|overview|summary screen|executive',
    skills: ['ledger_reader']
  },
  {
    id: 'inventory',
    label: 'Inventory & Materials',
    does: 'Every SKU with on-hand quantity, reorder level and price.',
    matches: 'inventory|materials|stock list|warehouse|godown',
    skills: ['ledger_reader', 'stock_sufficiency']
  },
  {
    id: 'purchase',
    label: 'Purchase Orders',
    does: 'Raise, receive and track purchase orders against registered suppliers.',
    matches: 'purchase orders?|po|vendor orders|procurement|khareed',
    skills: ['purchase_desk', 'reorder_forecast']
  },
  {
    id: 'suppliers',
    label: 'Suppliers & Vendors',
    does: 'The supplier register, with lead time and payment terms per vendor.',
    matches: 'suppliers?|vendors?|spliers',
    skills: ['master_registry', 'purchase_desk']
  },
  {
    id: 'customers',
    label: 'Customers & Mills',
    does: 'The customer register, with credit limit and receivables per mill.',
    matches: 'customers?|clients?|mills?|grahak',
    skills: ['master_registry', 'ledger_reader']
  },
  {
    id: 'sales',
    label: 'Sales & GST',
    does: 'Sales dispatches and the 18% GST invoices they raise.',
    matches: 'sales|invoices?|dispatch|gst invoice',
    skills: ['accounting_books']
  },
  {
    id: 'cashbook',
    label: 'Cashbook & Vouchers',
    does: 'Cash and bank in and out, with receipt and payment vouchers.',
    matches: 'cashbook|cash book|vouchers?|kharcha|paisa',
    skills: ['accounting_books', 'document_print']
  },
  {
    id: 'compliance',
    label: 'FBR Compliance RAG',
    does: 'Answers tax questions from the indexed FBR corpus with the provision cited, and refuses when unsure.',
    matches: 'compliance|tax rules?|statute|fbr rules?|kanoon',
    skills: ['compliance_rag']
  },
  {
    id: 'fbr_integration',
    label: 'FBR Digital Invoicing',
    does: 'Builds a schema-valid digital-invoice payload for a licensed integrator to transmit.',
    matches: 'fbr integration|digital invoic|fbr digital|invoice payload',
    skills: ['fbr_payload_builder']
  },
  {
    id: 'reports',
    label: 'Reports & Financials',
    does: 'Sales and purchase annexures, tax reconciliation and financial statements.',
    matches: 'reports?|financials?|annexure|gl|profit and loss',
    skills: ['ledger_reader']
  },
  {
    id: 'copilot',
    label: 'AI Copilot Terminal',
    does: 'Voice or text in Urdu, Roman Urdu or English; every answer is routed and labelled with the skill that ran.',
    matches: 'copilot|assistant|chat|voice',
    skills: ['ledger_reader']
  },
  {
    id: 'settings',
    label: 'Settings & Branding',
    does: 'Company identity, tax identity, users, and reset or seed the demo ledger.',
    matches: 'settings|branding|users?|reset|seed',
    skills: []
  }
];

const RX = new Map(
  MODULE_REGISTRY.map(m => [m.id, new RegExp(m.matches, 'i')])
);

/** Which module a phrase is about, if any. */
export function moduleFor(text: string): SoftwareModule | undefined {
  return MODULE_REGISTRY.find(m => RX.get(m.id)?.test(text));
}

export function moduleLabel(id: string): string {
  return MODULE_REGISTRY.find(m => m.id === id)?.label ?? id;
}

/** Words that mean "the user is asking about the app", not about the business. */
const ABOUT_THE_APP = /\b(how (do|can|to)|where (is|do i find)|kaise|kahan|kahan se|which (module|screen|page)|this (software|app|system)|is there|can i)\b/i;

/**
 * Answer a question about the software itself, or return null.
 *
 * Two shapes are supported and no more: "what is <module>" and "how do I use
 * <module>". Anything else returns null so the caller falls through to the
 * ledger and the statute rather than inventing an answer about the app.
 */
export function softwareAnswer(query: string): string | null {
  const q = query.trim();
  if (!q) return null;

  const asked = moduleFor(q);
  if (!asked) return null;

  // Only answer when the sentence is really about the software. "Show me cash"
  // must not be read as a question about the Cashbook module.
  if (!ABOUT_THE_APP.test(q)) return null;

  const howTo = /\b(how (do|can|to)|kaise)\b/i.test(q);
  const skills = asked.skills.length > 0
    ? ` Ask me for it in your own words — ${asked.skills.map(s => s.replace(/_/g, ' ')).join(', ')}.`
    : '';

  if (howTo) {
    return `🧭 **${asked.label}** — ${asked.does} Open it from the sidebar, or just ask me and I will take you there.${skills}`;
  }
  return `🧭 **${asked.label}** — ${asked.does}`;
}

/**
 * The nearest real capabilities to an utterance the router did not place.
 *
 * This is what replaces a dead end. "receive pending goods" once answered
 * "I don't have a reliable answer to that" and stopped; now it names the two or
 * three things this product can actually do that sound closest, so the user is
 * always one word away from a working command.
 *
 * Suggestions come from the registries, so this can never name a capability the
 * app does not have.
 */
export function suggestCapabilities(query: string, limit = 3): string[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  if (words.length === 0) return [];

  return MODULE_REGISTRY
    .map(m => {
      const haystack = `${m.label} ${m.does} ${m.matches}`.toLowerCase();
      return { m, score: words.filter(w => haystack.includes(w)).length };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => `**${x.m.label}**`);
}

/**
 * A refusal that is still useful.
 *
 * Says plainly the sentence was not understood, points at the teaching log, and
 * lists the nearest real capabilities. It never guesses a command: a wrong
 * guess here would be a write to the ledger.
 */
export function refusalWithSuggestions(query: string): string {
  // Suggestions are LABELS, not descriptions. The full "what this module does"
  // text is what blew this past the 320-character budget — three sentences of
  // prose is a wall of text, and a refusal the user skims is a refusal that
  // does not get read. Two labels is enough to point, and cheap enough to keep.
  const suggestions = suggestCapabilities(query, 2);
  return [
    // The opening line is kept deliberately stable. Two suites pin it as the
    // signal that a refusal happened rather than a wrong answer, and a refusal
    // that changes its wording every time it is reworded is a refusal nobody can
    // assert on.
    `🤔 I don't have a reliable answer to "${query.trim()}".`,
    '',
    'I answer from your ledger and FBR statute — never a guess.',
    '',
    suggestions.length > 0
      ? ['Did you mean:', ...suggestions.map(s => `• ${s}`)].join('\n')
      : 'Try "stock kitna hai", "pending orders", "goods receive karo".',
    '',
    '_Settings → Teaching lists this so you can teach me the phrase once._'
  ].join('\n');
}

/**
 * The full map, for "what can this thing do".
 *
 * Honest by construction: the list is the registry, so a module cannot be
 * claimed without being listed, and the count is derived rather than typed.
 */
export function capabilityAnswer(): string {
  const lines = MODULE_REGISTRY
    .map(m => `• **${m.label}** — ${m.does}`)
    .join('\n');
  return `🧭 ${MODULE_REGISTRY.length} modules, all reachable from the sidebar or by asking me:\n${lines}`;
}
