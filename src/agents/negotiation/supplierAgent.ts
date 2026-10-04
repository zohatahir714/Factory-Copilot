/**
 * The supplier agent — Task 5, Phase 3.
 *
 * A supplier has a hard limit too: below its floor it cannot sell at all. This
 * agent is built so that number is unreachable by construction. Every return
 * path passes through `Math.max(theirFloor, ...)`, which is what makes the
 * "the supplier never counters below its own floor" property in the test suite
 * hold structurally rather than by careful arithmetic.
 *
 * Like the buyer, it is pure — no I/O, no clock, no randomness.
 */

export interface SupplierCounterInput {
  /** Below this the supplier cannot sell. Hard limit. */
  theirFloor: number;
  /** What the buyer has just offered. */
  buyerOffer: number;
  /** What the supplier itself proposed last round, for the log copy. */
  lastSupplierOffer?: number;
}

export interface SupplierMove {
  price: number;
  reason: string;
}

/**
 * Decide the supplier's counter.
 *
 * Posture: a supplier does not open at its floor — that gives away margin
 * that was never conceded. When the buyer's offer clears the floor it accepts
 * explicitly; an offer already below the floor gets a flat "that is our
 * floor" rather than a number below it.
 */
export function counter(input: SupplierCounterInput): SupplierMove {
  const { theirFloor, buyerOffer } = input;

  if (!Number.isFinite(buyerOffer)) {
    return {
      price: theirFloor,
      reason: 'The offer was not a number, so we restate our floor.'
    };
  }

  if (buyerOffer < theirFloor) {
    return {
      price: theirFloor,
      reason:
        `Rs. ${buyerOffer.toLocaleString()} is below our floor of Rs. ${theirFloor.toLocaleString()}. ` +
        `Our floor is Rs. ${theirFloor.toLocaleString()}.`
    };
  }

  // The buyer met our floor: close at their number, and say so plainly.
  return {
    price: buyerOffer,
    reason:
      `Rs. ${buyerOffer.toLocaleString()} meets our floor of Rs. ` +
      `${theirFloor.toLocaleString()}. We accept.`
  };
}

export const supplierAgent = { counter };