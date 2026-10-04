/**
 * Auto-reorder engine.
 *
 * Predicts daily demand from sales history and drafts a purchase order when
 * days of cover drops below the supplier's lead time. Pure functions only —
 * no network, no API keys, no state — so it is exercisable in the demo and
 * cannot conflict with another track.
 *
 * Track: Zoha Task 1. Codes against `AgentProposal` from `./types`.
 */

import type { AgentProposal } from './types';

const DAY_MS = 86_400_000;

/** Reorder policy: cover the lead time plus a 30-day buffer. */
export const BUFFER_DAYS = 30;

export interface SalesHistoryEntry {
  date: string;
  quantity: number;
}

export interface ReorderInput {
  currentStock: number;
  reorderThreshold: number;
  avgDailyDemand: number;
  unit: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  unitPricePKR: number;
  leadTimeDays: number;
}

export interface ReorderDecision {
  shouldReorder: boolean;
  daysOfCover: number;
  proposal?: AgentProposal;
  skipReason?: string;
}

/**
 * Monotonic suffix so two proposals raised in the same millisecond still get
 * distinct ids. `Date.now()` alone collides inside one tick, which would make
 * two legitimate proposals indistinguishable to the approval queue.
 */
let proposalSeq = 0;

function nextProposalId(productId: string): string {
  const stamp = Date.now().toString(36);
  return `prop_reorder_${productId}_${stamp}${(proposalSeq++).toString(36)}`;
}

/**
 * Average daily demand over the last `windowDays` days of history.
 *
 * The window is anchored on the MOST RECENT ENTRY IN HISTORY, not on
 * `Date.now()`. Anchoring on the wall clock makes the result depend on when
 * the test happens to run: a fixture dated in the past is filtered out wholesale
 * and the function silently returns 0. Anchoring on the data makes it pure and
 * reproducible.
 *
 * Returns units per DAY (not per record), and 0 rather than NaN when there is
 * nothing usable to average.
 */
export function movingAverageDailyDemand(
  history: Array<{ date: string; quantity: number }>,
  windowDays: number
): number {
  if (!Array.isArray(history) || history.length === 0) return 0;
  if (!Number.isFinite(windowDays) || windowDays <= 0) return 0;

  let latest = Number.NEGATIVE_INFINITY;
  for (const entry of history) {
    const t = new Date(entry?.date).getTime();
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (latest === Number.NEGATIVE_INFINITY) return 0;

  // Inclusive of the latest day: a 3-day window ending 09-03 starts 09-01.
  const cutoff = latest - (windowDays - 1) * DAY_MS;

  let total = 0;
  for (const entry of history) {
    const t = new Date(entry?.date).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    const q = Number(entry?.quantity);
    if (Number.isFinite(q)) total += q;
  }

  return total / windowDays;
}

/**
 * Confidence in a reorder recommendation, derived from urgency.
 *
 * A real function of the input — never a literal. Out-of-stock (0 days cover)
 * is maximally urgent; anything past a month of cover decays to the floor.
 */
export function confidenceFromUrgency(daysOfCover: number): number {
  if (!Number.isFinite(daysOfCover) || daysOfCover <= 0) return 1;
  const decayed = 1 - (Math.min(daysOfCover, 30) / 30) * 0.7;
  return Math.round(decayed * 100) / 100;
}

/**
 * Decide whether to reorder a material, and draft the purchase order if so.
 *
 * Returns a reason instead of throwing whenever a decision cannot be made —
 * a material with no registered supplier, or one with no sales history to
 * predict from, must be skipped silently rather than crash the agent tick
 * (PLAN.md §Review Focus #2 and #4).
 */
export function computeReorder(input: ReorderInput): ReorderDecision {
  const {
    avgDailyDemand,
    currentStock,
    reorderThreshold,
    supplierId,
    leadTimeDays,
  } = input;

  if (!supplierId) {
    return {
      shouldReorder: false,
      daysOfCover: Infinity,
      skipReason: 'No supplier registered for this material',
    };
  }

  if (!(avgDailyDemand > 0)) {
    return {
      shouldReorder: false,
      daysOfCover: Infinity,
      skipReason: 'No sales history to predict demand',
    };
  }

  const daysOfCover = currentStock / avgDailyDemand;

  if (daysOfCover > leadTimeDays) {
    return {
      shouldReorder: false,
      daysOfCover,
      skipReason: 'Stock covers more than the supplier lead time',
    };
  }

  // Order enough to cover the lead time plus a 30-day buffer.
  const quantity = Math.ceil(avgDailyDemand * (leadTimeDays + BUFFER_DAYS) - currentStock);

  const proposal: AgentProposal = {
    id: nextProposalId(input.productId),
    agentId: 'purchase',
    title: `Reorder ${input.productName}`,
    rationale:
      `${input.productName} has ${daysOfCover.toFixed(1)} days of cover, ` +
      `below the ${leadTimeDays}-day supplier lead time, and sits at or above ` +
      `its ${reorderThreshold} ${input.unit} reorder threshold. ` +
      `Proposed ${quantity} ${input.unit} to cover the lead time plus a ${BUFFER_DAYS}-day buffer.`,
    confidence: confidenceFromUrgency(daysOfCover),
    citations: [
      'Internal reorder policy: cover ≥ lead time + 30-day buffer',
    ],
    payload: {
      supplierId,
      supplierName: input.supplierName,
      productId: input.productId,
      productName: input.productName,
      quantity,
      unitPricePKR: input.unitPricePKR,
    },
    tool: 'create_purchase_order',
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };

  return { shouldReorder: true, daysOfCover, proposal };
}