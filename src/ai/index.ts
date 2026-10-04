/**
 * The AI layer — one door.
 *
 * Everything the product knows how to answer lives behind this barrel:
 *
 *   stock/     "do we have enough yarn?" and the check that guards every purchase
 *   loss/      "which material had loss, and from which supplier?"
 *   software/  "how do I print a purchase order?" — questions about THIS app
 *
 * The rule that shaped the folder: a capability is only real once it is a
 * module here AND a skill in `src/agents/skills.ts` AND reachable from the
 * supervisor. Those three are wired to each other by tests, so the layer cannot
 * claim something it does not do.
 *
 * Import from here, not from the individual modules, so a capability can be
 * moved without touching every call site.
 */
export {
  stockVerdict,
  purchaseGuardNote,
  shortfalls,
  stockHealthSummary,
  type StockVerdict,
  type Shortfall
} from './stock/index.ts';

export {
  materialVariances,
  lossCandidates,
  overIssued,
  lossAnswer,
  VARIANCE_CAVEAT,
  type MaterialVariance
} from './loss/index.ts';

export {
  MODULE_REGISTRY,
  moduleFor,
  moduleLabel,
  softwareAnswer,
  capabilityAnswer,
  type SoftwareModule
} from './software/index.ts';
