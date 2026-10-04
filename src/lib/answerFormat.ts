/**
 * Answer verbosity — how much the copilot says.
 *
 * WHY THIS EXISTS
 *   The copilot answered "how much stock do we have?" with four bullets:
 *   available stock, warehouse SKU, unit cost price, minimum reorder level.
 *   Three of those were never asked for. In a voice loop — the primary demo
 *   surface — the user wants the number spoken back and nothing between them
 *   and it.
 *
 * THE RULE, AND ITS ONE EXCEPTION
 *   Read-only questions answer with the fact. Detail is one word away, because
 *   "one word away" and "not available" are very different products.
 *
 *   The exception is everything that writes. A confirmation a human is about to
 *   commit to the ledger, a goods receipt, a recorded disbursement — those stay
 *   fully detailed, always. Shortening the summary of a transaction about to be
 *   authorised is how money ends up in the wrong place. Brevity applies to
 *   reading, never to authorising. `isWriteIntent` marks that boundary, and
 *   `__tests__/answerBrevity.test.ts` pins it, because it is the part that
 *   would be "optimised" away first.
 */

/**
 * Phrases that ask for the long form.
 *
 * Deliberately excludes anything that could match a bare question. "cotton yarn
 * stock" must NOT unlock detail, or the terse answer never ships.
 */
const DETAIL_PATTERNS: RegExp[] = [
  /\bdetail/i,
  /\bbreakdown\b/i,
  /\bexplain\b/i,
  /\bwhy\b/i,
  /\bmore\b/i,
  /\bfull\b/i,
  /\bshow all\b/i,
  // Urdu / Arabic script, because the demo chips are in Urdu.
  /تفصیل/, // tafseel — details
  /مزید/, // mazeed — more
  /مکمل/, // mukammal — complete
  /سب/, // sab — all
  /تینے/, // tay — all
  /کیسے/, // kaise — how (as in "how did you calculate this")
];

/**
 * True when the user asked for the expanded answer by name.
 *
 * Applied to the RAW input, before routing, so it works identically for voice
 * and text. A voice transcription and the typed equivalent of the same sentence
 * must not produce different answers — the voice path is the one being demoed
 * and it is the one most likely to be under-tested.
 */
export function wantsDetail(input: string): boolean {
  if (!input) return false;
  return DETAIL_PATTERNS.some(re => re.test(input));
}

/**
 * Intents that change the ledger and therefore must never be shortened.
 *
 * Mirrors the write routes in `agentSupervisor`. Used as a defensive belt to
 * the existing branching: if a new read-only route is added later and someone
 * wires it up eagerly, this is the check that catches it.
 */
const WRITE_INTENTS = new Set([
  'record_sale',
  'create_purchase_order',
  'reorder_materials',
  'receive_goods',
  'record_expense',
  'add_supplier',
  'add_customer'
]);

export function isWriteIntent(intent: string): boolean {
  return WRITE_INTENTS.has(intent);
}

/** PKR with Indian/Pakistani digit grouping. */
export const pkr = (n: number): string => `Rs. ${(Math.round(n) || 0).toLocaleString('en-PK')}`;