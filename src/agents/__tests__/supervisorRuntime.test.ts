/**
 * Autonomous supervisor runtime — tick safety.
 *
 * Written BEFORE `src/agents/supervisorRuntime.ts` existed (PLAN.md Task 3,
 * Step 1). Covers the two failure modes the audit implies and no happy-path
 * task tests:
 *
 *   Review Focus #2 — the agent ticks against a completely empty ledger.
 *                     It must propose nothing and must not divide by zero.
 *   Review Focus #3 — a user rejects an autonomous proposal. The agent must
 *                     not re-propose the identical action on its next tick.
 *
 * The second one is the thrash loop. An agent that re-raises a rejected
 * proposal every 30 seconds burns the demo and trains the judge to ignore the
 * queue.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `reorder.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { tick, fingerprintOf } from '../supervisorRuntime';
import type { AgentProposal } from '../types';
import type { DatabaseState } from '../../lib/businessTools';

/** Empty ledger — every array present, nothing in it. */
function emptyState(): DatabaseState {
  return {
    products: [], suppliers: [], customers: [],
    purchaseOrders: [], salesOrders: [], inventoryMovements: [],
    cashbook: [], complianceSources: []
  };
}

/** One product below threshold, with a supplier that can actually supply it. */
function lowStockState(): DatabaseState {
  return {
    ...emptyState(),
    products: [{
      id: 'p1', organizationId: 'org1', sku: 'CY30', name: 'Cotton Yarn 30/1',
      category: 'yarn', unit: 'kg', costPrice: 1200, sellingPrice: 1450,
      reorderThreshold: 50, currentStock: 0,
      createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z'
    }],
    suppliers: [{
      id: 's1', organizationId: 'org1', name: 'Green Mills Ltd', city: 'Faisalabad',
      phone: '', email: '', leadTimeDays: 7, paymentTerms: 'Net 30',
      createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z'
    } as any],
    purchaseOrders: [{
      id: 'po1', poNumber: 'PO-1001', organizationId: 'org1',
      supplierId: 's1', supplierName: 'Green Mills Ltd',
      status: 'received', totalAmount: 120000,
      items: [{ id: 'poi1', purchaseOrderId: 'po1', productId: 'p1',
                productName: 'Cotton Yarn 30/1', quantity: 100, unit: 'kg',
                unitPrice: 1200, taxAmount: 21600, totalAmount: 141600 }],
      createdBy: 'u1', createdAt: '2026-09-15T00:00:00.000Z'
    } as any],
    salesOrders: [{
      id: 's1o', invoiceNumber: 'INV-1', date: '2026-09-01',
      subtotal: 1000, gstAmount: 180, totalAmount: 1180,
      status: 'unpaid', customerId: 'c1', customerName: 'Faisalabad Powerlooms',
      items: [{ productId: 'p1', productName: 'Cotton Yarn 30/1', quantity: 40, unit: 'kg', unitPrice: 1450, amount: 58000 }],
      createdAt: '2026-09-01T00:00:00.000Z'
    } as any]
  };
}

describe('agent tick safety', () => {
  it('proposes nothing on an empty ledger and does not throw', async () => {
    const out = await tick(emptyState());
    assert.equal(out.proposals.length, 0);
  });

  it('does not throw on a state missing every optional array', async () => {
    const out = await tick({} as any);
    assert.equal(out.proposals.length, 0);
  });

  it('never produces a NaN or out-of-range confidence', async () => {
    const out = await tick(lowStockState());
    for (const p of out.proposals) {
      assert.ok(Number.isFinite(p.confidence), `confidence not finite: ${p.confidence}`);
      assert.ok(p.confidence >= 0 && p.confidence <= 1, `confidence out of range: ${p.confidence}`);
    }
  });

  it('every proposal carries at least one citation', async () => {
    const out = await tick(lowStockState());
    for (const p of out.proposals) {
      assert.ok(Array.isArray(p.citations) && p.citations.length > 0,
        `proposal ${p.id} has no citation`);
    }
  });

  it('every proposal is emitted as proposed, never pre-approved', async () => {
    const out = await tick(lowStockState());
    for (const p of out.proposals) assert.equal(p.status, 'proposed');
  });

  it('does not re-propose a rejected action', async () => {
    const first = await tick(lowStockState());
    assert.ok(first.proposals.length > 0, 'fixture should produce at least one proposal');

    const rejected: AgentProposal[] = first.proposals.map(p => ({ ...p, status: 'rejected' as const }));
    const second = await tick(lowStockState(), { priorProposals: rejected });

    const firstPrints = new Set(first.proposals.map(fingerprintOf));
    for (const p of second.proposals) {
      assert.equal(firstPrints.has(fingerprintOf(p)), false,
        `rejected proposal was re-raised: ${fingerprintOf(p)}`);
    }
  });

  it('does not re-propose an approved action either — it is already done', async () => {
    const first = await tick(lowStockState());
    const resolved: AgentProposal[] = first.proposals.map(p => ({ ...p, status: 'approved' as const }));
    const second = await tick(lowStockState(), { priorProposals: resolved });
    const firstPrints = new Set(first.proposals.map(fingerprintOf));
    for (const p of second.proposals) {
      assert.equal(firstPrints.has(fingerprintOf(p)), false,
        `already-applied proposal was re-raised: ${fingerprintOf(p)}`);
    }
  });

  it('still proposes an action the user has not seen', async () => {
    const first = await tick(lowStockState());
    // Resolve only the FIRST proposal; the rest must survive to the next tick.
    const resolved: AgentProposal[] = first.proposals.map((p, i) => ({
      ...p, status: i === 0 ? ('approved' as const) : ('proposed' as const)
    }));
    const second = await tick(lowStockState(), { priorProposals: resolved });
    const resolvedPrints = new Set(resolved.filter(p => p.status !== 'proposed').map(fingerprintOf));
    const fresh = second.proposals.filter(p => !resolvedPrints.has(fingerprintOf(p)));
    assert.equal(second.proposals.length, fresh.length);
  });

  it('skips a low-stock item with no supplier, and says why', async () => {
    const state = lowStockState();
    // No supplier record AND no purchase order naming one — nothing in the
    // ledger says who this material comes from, so proposing anyone would be a
    // guess.
    state.suppliers = [];
    state.purchaseOrders = [];
    const out = await tick(state);
    const reorders = out.proposals.filter(p => p.tool === 'create_purchase_order');
    assert.equal(reorders.length, 0);
  });

  it('drafts a PO for a low-stock item whose supplier is known from its PO history', async () => {
    const out = await tick(lowStockState());
    const reorders = out.proposals.filter(p => p.tool === 'create_purchase_order');
    assert.equal(reorders.length, 1, 'expected one draft PO from the recorded supplier');
    assert.equal(reorders[0].agentId, 'purchase');
    assert.match(String(reorders[0].payload.supplierName), /Green Mills/);
  });

  it('appends an audit entry for every proposal', async () => {
    const out = await tick(lowStockState());
    assert.equal(out.audit.length, out.proposals.length);
  });
});