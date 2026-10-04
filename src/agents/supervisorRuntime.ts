/**
 * Autonomous supervisor runtime.
 *
 * A tick reads live ledger state and returns PROPOSALS ONLY. It never writes.
 * Nothing reaches the ledger except through an explicit human approval, which
 * is the one rule in PLAN.md that is never relaxed.
 *
 * Domain decisions live in `reorder.ts` and `anomaly.ts` (Zoha's track); this
 * module only schedules them, stamps a stable identity on each proposal, and
 * suppresses anything the user has already resolved.
 */
import type { AgentProposal, AuditEntry } from './types.ts';
import type { DatabaseState } from '../lib/businessTools.ts';
import type { Supplier } from '../types/index.ts';
import { computeReorder, movingAverageDailyDemand, type SalesHistoryEntry } from './reorder.ts';
import { detectAnomalies } from './anomaly.ts';

/** Demand is averaged over the trailing 30 days of dispatch history. */
export const DEMAND_WINDOW_DAYS = 30;

export interface TickContext {
  /** Every proposal raised so far, so resolved ones can be suppressed. */
  priorProposals?: AgentProposal[];
}

export interface TickResult {
  proposals: AgentProposal[];
  audit: AuditEntry[];
}

/**
 * Stable identity for a proposal.
 *
 * Deliberately excludes `id` and `createdAt`, which differ on every tick —
 * including them would defeat the whole point, since the same low-stock item
 * would look like a new proposal each time and the anti-thrash filter could
 * never match it.
 */
export function fingerprintOf(proposal: AgentProposal): string {
  const { fingerprint: _ignored, ...payload } = proposal.payload ?? {};
  return `${proposal.agentId}:${proposal.tool}:${stableStringify(payload)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${k}:${stableStringify(v)}`).join(',')}}`;
}

/**
 * Dispatch history for one product, derived from invoice line items.
 *
 * Returns [] when there is no history, which makes `movingAverageDailyDemand`
 * return 0 — and a zero-demand item is skipped rather than reordered.
 */
function salesHistoryFor(state: DatabaseState, productId: string): SalesHistoryEntry[] {
  const history: SalesHistoryEntry[] = [];
  for (const order of state.salesOrders ?? []) {
    for (const item of order?.items ?? []) {
      if (item?.productId !== productId) continue;
      history.push({
        date: order.createdAt ?? '',
        quantity: Number(item.quantity) || 0
      });
    }
  }
  return history;
}

/**
 * The supplier this material is actually bought from.
 *
 * `Product` carries no supplier column, so the link lives on the purchase
 * order: the most recent PO containing this product names its supplier. That
 * is real ledger evidence. Guessing — "use the first supplier", "use any
 * supplier" — would produce a purchase order addressed to someone who may not
 * sell the material, which is worse than proposing nothing.
 */
function supplierFor(state: DatabaseState, productId: string): Supplier | undefined {
  const orders = [...(state.purchaseOrders ?? [])]
    .filter(po => (po?.items ?? []).some(i => i?.productId === productId))
    .sort((a, b) => new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime());

  const po = orders[0];
  if (!po) return undefined;

  const linked = (state.suppliers ?? []).find(s => s.id === po.supplierId);
  if (linked) return linked;

  // The PO may outlive a deleted supplier record; keep the name and lead time
  // off the PO itself rather than dropping a legitimate reorder.
  if (!po.supplierName) return undefined;
  return {
    id: po.supplierId ?? '',
    name: po.supplierName,
    leadTimeDays: 7
  } as Supplier;
}

function inventoryAgent(state: DatabaseState): AgentProposal[] {
  const products = state.products ?? [];
  const out: AgentProposal[] = [];

  for (const product of products) {
    const supplier = supplierFor(state, product.id);
    if (!supplier) continue;

    const decision = computeReorder({
      currentStock: Number(product.currentStock) || 0,
      reorderThreshold: Number(product.reorderThreshold) || 0,
      avgDailyDemand: movingAverageDailyDemand(
        salesHistoryFor(state, product.id), DEMAND_WINDOW_DAYS
      ),
      unit: product.unit,
      productId: product.id,
      productName: product.name,
      supplierId: supplier.id,
      supplierName: supplier.name,
      unitPricePKR: Number(product.costPrice) || 0,
      leadTimeDays: Number(supplier.leadTimeDays) || 7
    });

    if (decision.shouldReorder && decision.proposal) out.push(decision.proposal);
  }
  return out;
}

function complianceAgent(state: DatabaseState): AgentProposal[] {
  return detectAnomalies(state);
}

let auditSeq = 0;

function toAuditEntry(proposal: AgentProposal): AuditEntry {
  return {
    id: `aud_${Date.now().toString(36)}${(auditSeq++).toString(36)}`,
    agentId: proposal.agentId,
    action: proposal.title,
    detail: proposal.rationale,
    confidence: proposal.confidence,
    citations: proposal.citations,
    timestamp: new Date().toISOString()
  };
}

export async function tick(
  state: DatabaseState,
  ctx: TickContext = {}
): Promise<TickResult> {
  // Anti-thrash: anything the user resolved — approved OR rejected — is not
  // raised again. An approved action is already done; a rejected one has been
  // declined. Re-raising either is the loop that burns a demo.
  const resolved = new Set(
    (ctx.priorProposals ?? [])
      .filter(p => p.status === 'rejected' || p.status === 'approved')
      .map(fingerprintOf)
  );

  const candidates = [...inventoryAgent(state), ...complianceAgent(state)];

  const proposals = candidates
    .filter(p => !resolved.has(fingerprintOf(p)))
    .map(p => ({ ...p, payload: { ...p.payload, fingerprint: fingerprintOf(p) } }));

  return { proposals, audit: proposals.map(toAuditEntry) };
}