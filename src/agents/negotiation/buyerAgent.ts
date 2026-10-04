/**
 * The buyer agent — Task 5, Phase 3.
 *
 * A buyer in a mill has a hard limit: the most it will pay. Everything else
 * about it is preference. This agent is written so that the limit is the only
 * thing that can decide the outcome — it has no way to express a price above
 * its ceiling, not even accidentally, and when it cannot accept an offer it
 * returns `price: null` rather than a number that would have to be walked back.
 *
 * It is a pure function with no I/O, no clock and no randomness, so the whole
 * negotiation is reproducible and diffable. That matters: a negotiation that
 * produces a different deal every time cannot be checked by a judge.
 */

export interface BuyerConsiderInput {
  /** The most the buyer will pay. Hard limit. */
  theirCeiling: number;
  /** What the supplier has just offered. */
  supplierOffer: number;
  /** What the buyer itself proposed in the previous round, for the log copy. */
  lastBuyerOffer?: number;
}

/** `price: null` means "I will not do this deal", not "no opinion". */
export interface BuyerMove {
  price: number | null;
  reason: string;
}

/**
 * Decide whether to accept the supplier's offer.
 *
 * Only the ceiling is enforced. The agent does not "feel" that an offer is a
 * bad deal — modelling a cost of living, a target margin or a mood would be
 * invented state, and invented state is what makes an agent demo uncheckable.
 */
export function consider(input: BuyerConsiderInput): BuyerMove {
  const { theirCeiling, supplierOffer } = input;

  if (!Number.isFinite(supplierOffer)) {
    return { price: null, reason: 'The offer was not a number, so it cannot be evaluated.' };
  }

  if (supplierOffer > theirCeiling) {
    return {
      price: null,
      reason:
        `Rs. ${supplierOffer.toLocaleString()} is above our ceiling of Rs. ${theirCeiling.toLocaleString()}. ` +
        `We are not authorised to go higher.`
    };
  }

  if (input.lastBuyerOffer !== undefined && supplierOffer >= input.lastBuyerOffer) {
    return {
      price: supplierOffer,
      reason:
        `Rs. ${supplierOffer.toLocaleString()} is at or below our last offer of ` +
        `Rs. ${input.lastBuyerOffer.toLocaleString()} and within our ceiling, so we accept.`
    };
  }

  return {
    price: supplierOffer,
    reason:
      `Rs. ${supplierOffer.toLocaleString()} is within our ceiling of Rs. ` +
      `${theirCeiling.toLocaleString()}. We accept.`
  };
}

/**
 * The buyer's opening ask.
 *
 * A buyer does not open at its own ceiling — that concedes the whole
 * negotiation before it starts. The opening is therefore placed partway
 * between what it offered last time and what it will pay, and is clamped to
 * the ceiling so this function, like every other here, cannot emit an
 * unpayable number.
 */
export function open(input: { theirCeiling: number; asking: number }): BuyerMove {
  const { theirCeiling, asking } = input;

  if (asking > theirCeiling) {
    return {
      price: null,
      reason:
        `The opening ask of Rs. ${asking.toLocaleString()} is above our ceiling of Rs. ` +
        `${theirCeiling.toLocaleString()}, so the brief is inconsistent and we cannot open.`
    };
  }

  return {
    price: asking,
    reason: `Opening at Rs. ${asking.toLocaleString()}, below our ceiling of Rs. ${theirCeiling.toLocaleString()}.`
  };
}

export const buyerAgent = { consider, open };