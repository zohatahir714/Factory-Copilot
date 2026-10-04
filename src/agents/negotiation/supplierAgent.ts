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
 * Posture: a supplier does not accept the opening offer and does not open at
 * its floor — either would give away margin that was never conceded. It moves
 * HALF the remaining gap, and is clamped to its floor. An offer already below
 * the floor gets a flat "that is our floor" rather than a counter below it.
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

  // Concede half the gap between the buyer's offer and our floor. Never below
  // the floor, never above what the buyer already offered.
  const concession = Math.max(0, Math.floor((buyerOffer - theirFloor) / 2));
  const price = Math.min(buyerOffer, Math.max(theirFloor, buyerOffer - concession));

  if (price >= buyerOffer) {
    return {
      price,
      reason:
        `Rs. ${buyerOffer.toLocaleString()} already meets our floor of Rs. ` +
        `${theirFloor.toLocaleString()}, so we have nothing further to concede.`
    };
  }

  return {
    price,
    reason:
      `Moving to Rs. ${price.toLocaleString()}. That is halfway between your Rs. ` +
      `${buyerOffer.toLocaleString()} and our floor of Rs. ${theirFloor.toLocaleString()}.`
  };
}

export const supplierAgent = { counter };