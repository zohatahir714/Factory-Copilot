/**
 * Public surface of the negotiation feature — Task 5, Phase 3.
 */
export { negotiate } from './negotiate.ts';
export type {
  NegotiateInput,
  NegotiateResult,
  NegotiationRound,
  NegotiationSide
} from './negotiate.ts';
export { buyerAgent } from './buyerAgent.ts';
export { supplierAgent } from './supplierAgent.ts';
export type { BuyerMove } from './buyerAgent.ts';
export type { SupplierMove } from './supplierAgent.ts';