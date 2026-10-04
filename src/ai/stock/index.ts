/**
 * Stock sufficiency — the check that runs BEFORE any purchase.
 *
 * The request this answers is blunt: "before it adds, it should do the proper
 * stock check, and tell me whether I already have proper stock." Without it,
 * "buy 200 kg yarn" mints a purchase order for a mill sitting on 1,450 kg of
 * the same yarn. That is not a rare edge case; it is the default outcome of
 * every purchase command, and nobody caught it because nothing was checking.
 *
 * Everything here is a pure function over ledger rows. No writes, no state, no
 * network — the guard must be cheap enough to run on every turn without being
 * tempted to skip.
 */
import type { DatabaseState } from '../../lib/businessTools.ts';
import type { Product } from '../../types/index.ts';
import { findProductByName } from '../../lib/businessTools.ts';

export interface StockVerdict {
  product?: Product;
  /** The material as the user said it, when nothing in the catalogue matched. */
  askedFor: string;
  onHand: number;
  required: number;
  /** How much is missing. Zero when stock covers the requirement. */
  short: number;
  sufficient: boolean;
  unit: string;
  /** One terse line, already formatted, safe to show a user. */
  line: string;
}

/**
 * Compare what is on hand against what a purchase would consume.
 *
 * `required` is what the user said they need. When they said no quantity — "do
 * we have enough yarn?" — the reorder threshold is the yardstick, because that
 * is the level the mill already decided it must not fall below.
 */
export function stockVerdict(
  state: DatabaseState,
  askedFor: string,
  quantity?: number
): StockVerdict {
  const product = findProductByName(state.products ?? [], askedFor);
  const required = Number.isFinite(quantity as number) && (quantity as number) > 0
    ? Math.round(quantity as number)
    : product?.reorderThreshold ?? 0;

  if (!product) {
    return {
      askedFor,
      onHand: 0,
      required,
      short: required,
      sufficient: false,
      unit: '',
      line: `❓ "${askedFor}" is not in your catalogue — nothing on hand to check.`
    };
  }

  const onHand = Number(product.currentStock) || 0;
  const unit = product.unit || 'units';
  const short = Math.max(0, required - onHand);
  const sufficient = short === 0;

  const line = sufficient
    ? `✅ ${product.name}: ${onHand.toLocaleString()} ${unit} on hand covers the ${required.toLocaleString()} ${unit} you asked for.`
    : `⚠️ ${product.name}: ${onHand.toLocaleString()} ${unit} on hand — short ${short.toLocaleString()} ${unit} of the ${required.toLocaleString()} you asked for.`;

  return { product, askedFor, onHand, required, short, sufficient, unit, line };
}

/**
 * What the copilot should say about a purchase the mill may not need.
 *
 * Returns `undefined` when there is nothing worth saying, so the caller does
 * not print "everything is fine" on a command that has its own answer. When
 * stock already covers the quantity, the message says so plainly: ordering
 * anyway is the user's decision, but they make it knowing, not by omission.
 */
export function purchaseGuardNote(
  state: DatabaseState,
  askedFor: string,
  quantity?: number
): string | undefined {
  const v = stockVerdict(state, askedFor, quantity);
  if (!v.product) return undefined;

  if (v.sufficient) {
    return `Stock check: ${v.product.name} already at ${v.onHand.toLocaleString()} ${v.unit}, which covers the ${v.required.toLocaleString()} ${v.unit} you asked to buy. Ordering anyway? Confirm below if so.`;
  }
  return `Stock check: ${v.onHand.toLocaleString()} ${v.unit} on hand, ${v.short.toLocaleString()} ${v.unit} short — this purchase is needed.`;
}

/**
 * Every material that cannot cover the reorder threshold, with the gap.
 *
 * The same arithmetic the reorder agent uses, exposed so a plain question —
 * "did we have proper stock?" — and a purchase command are answered by one
 * implementation. Two definitions of "low stock" is how a dashboard and a
 * copilot end up disagreeing on the same ledger.
 */
export interface Shortfall {
  product: Product;
  onHand: number;
  short: number;
  unit: string;
}

export function shortfalls(state: DatabaseState): Shortfall[] {
  return (state.products ?? [])
    .filter(p => (Number(p.currentStock) || 0) <= (Number(p.reorderThreshold) || 0))
    .map(p => ({
      product: p,
      onHand: Number(p.currentStock) || 0,
      short: Math.max(0, (Number(p.reorderThreshold) || 0) - (Number(p.currentStock) || 0)),
      unit: p.unit || 'units'
    }))
    .sort((a, b) => b.short - a.short);
}

/**
 * One sentence covering the whole catalogue, for the general question.
 *
 * "Do we have proper stock" with no material named is answered against every
 * line, never against the first line that happens to match.
 */
export function stockHealthSummary(state: DatabaseState): string {
  const all = state.products ?? [];
  if (all.length === 0) return '📦 No materials in your catalogue yet.';

  const short = shortfalls(state);
  if (short.length === 0) {
    return `✅ All ${all.length} materials are above their reorder level — nothing needs buying.`;
  }

  const lines = short
    .map(s => `• ${s.product.name} — ${s.onHand.toLocaleString()} ${s.unit}, short ${s.short.toLocaleString()} ${s.unit}`)
    .join('\n');

  return `📦 ${all.length - short.length} of ${all.length} materials are fine. ${short.length} ${short.length === 1 ? 'needs' : 'need'} buying:\n${lines}`;
}
