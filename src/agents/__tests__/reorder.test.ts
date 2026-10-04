/**
 * Auto-reorder engine — Task 1 tests.
 *
 * Written BEFORE `src/agents/reorder.ts` existed (per PLAN.md §Verification).
 * The first four describe blocks are the track's specification tests.
 * The rest are regression guards added while implementing.
 *
 * DEVIATION FROM TRACK DOC: the doc's snippets import `expect` from `node:test`.
 * Node v24's `node:test` exports no `expect` (runtime exports are `assert`,
 * `describe`, `it`, `mock`, …), so that import yields `undefined` and every
 * case dies on `expect is not a function`. The assertions below are a faithful
 * one-to-one translation onto `node:assert/strict`; no assertion was weakened.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { movingAverageDailyDemand, computeReorder } from '../reorder';

// Sales history: [{ date: '2026-09-01', quantity: 10 }, ...]
describe('moving average demand', () => {
  it('averages the last N days', () => {
    const history = [
      { date: '2026-09-01', quantity: 10 },
      { date: '2026-09-02', quantity: 20 },
      { date: '2026-09-03', quantity: 30 }
    ];
    assert.strictEqual(movingAverageDailyDemand(history, 3), 20);
  });

  it('returns 0 for an empty history rather than NaN', () => {
    assert.strictEqual(movingAverageDailyDemand([], 30), 0);
  });

  // REGRESSION GUARD: the track doc's sample implementation anchors the window
  // on `Date.now()`. With fixed fixtures written in the past that filter
  // discards every record and returns 0 instead of 20 — a suite that only goes
  // green when the fixtures happen to sit inside the wall-clock window. The
  // window must be anchored on the most recent history entry instead.
  it('is anchored on the latest history entry, not the wall clock', () => {
    const longAgo = [
      { date: '2019-01-01', quantity: 30 },
      { date: '2019-01-02', quantity: 30 },
      { date: '2019-01-03', quantity: 30 }
    ];
    assert.strictEqual(movingAverageDailyDemand(longAgo, 3), 30);
  });

  it('excludes records older than the window', () => {
    const history = [
      { date: '2026-09-01', quantity: 1000 }, // outside a 2-day window
      { date: '2026-09-02', quantity: 10 },
      { date: '2026-09-03', quantity: 20 }
    ];
    assert.strictEqual(movingAverageDailyDemand(history, 2), 15);
  });

  it('never returns NaN for unparseable dates', () => {
    assert.strictEqual(movingAverageDailyDemand([{ date: 'not-a-date', quantity: 12 }], 30), 0);
  });

  it('treats a non-positive window as no history', () => {
    assert.strictEqual(movingAverageDailyDemand([{ date: '2026-09-01', quantity: 10 }], 0), 0);
  });
});

describe('reorder decision', () => {
  it('proposes a PO when days of cover is under the threshold', () => {
    const r = computeReorder({
      currentStock: 10,
      reorderThreshold: 20,
      avgDailyDemand: 5,
      unit: 'kg',
      productId: 'p1', productName: 'Cotton Yarn',
      supplierId: 's1', supplierName: 'Green Mills',
      unitPricePKR: 1450, leadTimeDays: 7
    });
    assert.strictEqual(r.shouldReorder, true);
    assert.strictEqual(r.proposal?.tool, 'create_purchase_order');
    assert.ok((r.proposal?.citations.length ?? 0) > 0, 'proposal must cite a source');
  });

  it('does NOT propose when stock is healthy', () => {
    const r = computeReorder({
      currentStock: 500, reorderThreshold: 20, avgDailyDemand: 5,
      unit: 'kg', productId: 'p1', productName: 'Cotton Yarn',
      supplierId: 's1', supplierName: 'Green Mills',
      unitPricePKR: 1450, leadTimeDays: 7
    });
    assert.strictEqual(r.shouldReorder, false);
  });

  it('SKIPS an item with no supplier and says why  (Review Focus #4)', () => {
    const r = computeReorder({
      currentStock: 1, reorderThreshold: 20, avgDailyDemand: 5,
      unit: 'kg', productId: 'p1', productName: 'Cotton Yarn',
      supplierId: '', supplierName: '',
      unitPricePKR: 0, leadTimeDays: 7
    });
    assert.strictEqual(r.shouldReorder, false);
    assert.match(r.skipReason ?? '', /supplier/i);
  });

  it('never proposes when demand history is empty  (Review Focus #2)', () => {
    const r = computeReorder({
      currentStock: 0, reorderThreshold: 20, avgDailyDemand: 0,
      unit: 'kg', productId: 'p1', productName: 'Cotton Yarn',
      supplierId: 's1', supplierName: 'Green Mills',
      unitPricePKR: 1450, leadTimeDays: 7
    });
    assert.strictEqual(r.shouldReorder, false);
  });

  // Track doc V3: 10kg stock, 5/day demand, 7-day lead -> ceil(5 * 37 - 10) = 175
  it('orders lead time + 30-day buffer, minus stock on hand', () => {
    const r = computeReorder({
      currentStock: 10, reorderThreshold: 20, avgDailyDemand: 5,
      unit: 'kg', productId: 'p1', productName: 'Cotton Yarn',
      supplierId: 's1', supplierName: 'Green Mills',
      unitPricePKR: 1450, leadTimeDays: 7
    });
    assert.strictEqual(r.daysOfCover, 2);
    assert.strictEqual(r.proposal?.payload.quantity, 175);
  });

  it('reorders when cover is exactly the lead time, not only below it', () => {
    const r = computeReorder({
      currentStock: 35, reorderThreshold: 20, avgDailyDemand: 5,
      unit: 'kg', productId: 'p1', productName: 'Cotton Yarn',
      supplierId: 's1', supplierName: 'Green Mills',
      unitPricePKR: 1450, leadTimeDays: 7
    });
    assert.strictEqual(r.daysOfCover, 7);
    assert.strictEqual(r.shouldReorder, true);
  });

  it('produces a fully populated AgentProposal', () => {
    const r = computeReorder({
      currentStock: 10, reorderThreshold: 20, avgDailyDemand: 5,
      unit: 'kg', productId: 'p1', productName: 'Cotton Yarn',
      supplierId: 's1', supplierName: 'Green Mills',
      unitPricePKR: 1450, leadTimeDays: 7
    });
    const p = r.proposal!;
    assert.match(p.id, /^prop_reorder_p1_/);
    assert.strictEqual(p.agentId, 'purchase');
    assert.strictEqual(p.tool, 'create_purchase_order');
    assert.strictEqual(p.status, 'proposed');
    assert.strictEqual(p.title, 'Reorder Cotton Yarn');
    assert.match(p.rationale, /2\.0 days/);
    assert.match(p.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.strictEqual(p.resolvedAt, undefined);
    assert.deepStrictEqual(p.payload, {
      supplierId: 's1',
      supplierName: 'Green Mills',
      productId: 'p1',
      productName: 'Cotton Yarn',
      quantity: 175,
      unitPricePKR: 1450
    });
  });

  it('computes confidence from urgency — never a literal, never out of range', () => {
    const base = {
      reorderThreshold: 20, unit: 'kg', productId: 'p1', productName: 'Cotton Yarn',
      supplierId: 's1', supplierName: 'Green Mills', unitPricePKR: 1450, leadTimeDays: 7
    };
    const critical = computeReorder({ ...base, currentStock: 0, avgDailyDemand: 5 });
    const mild = computeReorder({ ...base, currentStock: 34, avgDailyDemand: 5 });

    for (const r of [critical, mild]) {
      assert.ok(r.proposal!.confidence > 0, 'confidence must be computed, not zero');
      assert.ok(r.proposal!.confidence <= 1, 'confidence must stay in 0..1');
    }
    // Less cover => more urgent => higher confidence.
    assert.ok(critical.proposal!.confidence > mild.proposal!.confidence);
  });

  it('gives two proposals for the same product distinct ids', () => {
    const input = {
      currentStock: 10, reorderThreshold: 20, avgDailyDemand: 5,
      unit: 'kg', productId: 'p1', productName: 'Cotton Yarn',
      supplierId: 's1', supplierName: 'Green Mills',
      unitPricePKR: 1450, leadTimeDays: 7
    };
    assert.notStrictEqual(
      computeReorder(input).proposal!.id,
      computeReorder(input).proposal!.id
    );
  });
});