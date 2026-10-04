/**
 * The negotiation driver — Task 5, Phase 3.
 *
 * STAGE MAP OF WHAT THIS IS AND IS NOT
 *   This is a two-agent price negotiation over a bounded number of rounds. It
 *   is NOT a market, NOT a forecast and NOT a model of what a real mill would
 *   accept. Each agent holds exactly one number it will not cross — the
 *   supplier's floor, the buyer's ceiling — and the interesting behaviour is
 *   what happens when those two numbers cannot meet.
 *
 * WHY FAILURE IS A FIRST-CLASS RESULT
 *   A negotiation harness that always returns a price is a decoration; you
 *   cannot tell the difference between "converged" and "made something up".
 *   So `agreed` is false and `agreedPrice` is null whenever no deal exists, and
 *   `reason` always says which limit was hit. Nothing here rounds a number in
 *   order to make a deal land.
 *
 * ON THE INCONSISTENT-BRIEF CASE
 *   The brief `negotiate({ asking: 3000, floor: 1200, ceiling: 1500 })` asks a
 *   buyer to open at 3000 while capping itself at 1500. The two statements
 *   contradict each other. Clamping the ask down to 1500 would produce a deal,
 *   but it would be a deal the buyer never agreed to — the clamp would be
 *   inventing a concession on the buyer's behalf. So this refuses and says why.
 *   The same principle runs through the rest of the codebase: an absent or
 *   contradictory input is reported, never resolved.
 *
 * Determinism: no clock, no randomness, no I/O. Same inputs, same transcript.
 */
import { buyerAgent } from './buyerAgent.ts';
import { supplierAgent } from './supplierAgent.ts';

export type NegotiationSide = 'buyer' | 'supplier';

export interface NegotiationRound {
  /** 1-based round number. */
  round: number;
  by: NegotiationSide;
  /** What this side put on the table this round. */
  price: number;
  reason: string;
}

export interface NegotiateInput {
  /** The buyer's opening ask, in PKR. */
  asking: number;
  /** The supplier's minimum acceptable price. */
  floor: number;
  /** The buyer's maximum acceptable price. */
  ceiling: number;
  /** Hard cap on rounds. Convergence must happen inside it or we report failure. */
  maxRounds: number;
}

export interface NegotiateResult {
  agreed: boolean;
  /** The agreed price, or null. Never populated when `agreed` is false. */
  agreedPrice: number | null;
  rounds: NegotiationRound[];
  /** Why it failed. Null on success. Written for a human, not a machine. */
  reason: string | null;
  /** Rounds the budget allowed, for the UI to show progress against. */
  maxRounds: number;
}

const pkr = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

export function negotiate(input: NegotiateInput): NegotiateResult {
  const { asking, floor, ceiling, maxRounds } = input;
  const rounds: NegotiationRound[] = [];

  const refuse = (reason: string): NegotiateResult => ({
    agreed: false,
    agreedPrice: null,
    rounds,
    reason,
    maxRounds
  });

  // --- Input validation. Every one of these is a brief the caller got wrong. ---
  if (![asking, floor, ceiling].every(Number.isFinite)) {
    return refuse('asking, floor and ceiling must all be numbers.');
  }
  if (floor > ceiling) {
    return refuse(
      `The supplier's floor of ${pkr(floor)} is above the buyer's ceiling of ${pkr(ceiling)}, ` +
        `so no price satisfies both sides.`
    );
  }
  if (maxRounds < 1) {
    return refuse('At least one round must be allowed.');
  }

  const opening = buyerAgent.open({ theirCeiling: ceiling, asking });
  if (opening.price === null) {
    return refuse(opening.reason);
  }

  let buyerPrice = opening.price;
  let supplierPrice = floor;
  rounds.push({ round: 1, by: 'buyer', price: buyerPrice, reason: opening.reason });

  // Round 2 — the supplier counters. No seller accepts the opening offer.
  if (rounds.length >= maxRounds) {
    return refuse(
      `No agreement was reached within ${maxRounds} round${maxRounds === 1 ? '' : 's'}. ` +
        `Allow more rounds, or revisit the floor and ceiling.`
    );
  }

  const supplierMove = supplierAgent.counter({
    theirFloor: floor,
    buyerOffer: buyerPrice,
    lastSupplierOffer: supplierPrice
  });
  supplierPrice = supplierMove.price;
  rounds.push({ round: rounds.length + 1, by: 'supplier', price: supplierPrice, reason: supplierMove.reason });

  // Round 3 — the buyer decides.
  if (rounds.length >= maxRounds) {
    return refuse(
      `No agreement was reached within ${maxRounds} round${maxRounds === 1 ? '' : 's'}. ` +
        `Allow more rounds, or revisit the floor and ceiling.`
    );
  }

  const buyerMove = buyerAgent.consider({
    theirCeiling: ceiling,
    supplierOffer: supplierPrice,
    lastBuyerOffer: buyerPrice
  });

  if (buyerMove.price === null) {
    rounds.push({
      round: rounds.length + 1,
      by: 'buyer',
      price: buyerPrice,
      reason: `${buyerMove.reason} The negotiation ends without a deal.`
    });
    return refuse(buyerMove.reason);
  }

  rounds.push({
    round: rounds.length + 1,
    by: 'buyer',
    price: buyerMove.price,
    reason: buyerMove.reason
  });

  return {
    agreed: true,
    agreedPrice: buyerMove.price,
    rounds,
    reason: null,
    maxRounds
  };
}