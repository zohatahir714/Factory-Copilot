/**
 * FBR anomaly detection — Task 2 tests.
 *
 * Written BEFORE `src/agents/anomaly.ts` existed (per PLAN.md §Verification).
 * The first seven cases are the track's specification tests.
 * The rest are regression guards added while implementing.
 *
 * DEVIATION FROM TRACK DOC: the doc's snippets import `expect` from `node:test`.
 * Node v24's `node:test` exports no `expect`, so that import yields `undefined`
 * and every case dies on `expect is not a function`. The assertions below are a
 * faithful one-to-one translation onto `node:assert/strict`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectAnomalies } from '../anomaly';
import type { DatabaseState } from '../anomaly';

// Fixed "today" so overdue-arithmetic never depends on when the suite runs.
const NOW = new Date('2026-10-04T00:00:00.000Z');

function makeState(partial: Partial<DatabaseState> = {}): DatabaseState {
  return { salesOrders: [], products: [], ...partial };
}

describe('anomaly detection', () => {
  it('flags an invoice unpaid for more than 30 days', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{ id: 's1', invoiceNumber: 'INV-1', totalAmount: 50000, status: 'unpaid', date: '2026-08-01' }],
      }),
      { now: NOW }
    );
    assert.strictEqual(found.length, 1);
    assert.match(found[0].citations[0], /153|SRO|Standing Instructions/i);
  });

  it('flags negative stock', () => {
    const found = detectAnomalies(
      makeState({
        products: [{ id: 'p1', name: 'Yarn', sku: 'Y-1', currentStock: -5, unit: 'kg', reorderThreshold: 10 }],
      }),
      { now: NOW }
    );
    assert.ok(found.some((f) => /negative/i.test(f.title)), 'expected a negative-stock anomaly');
  });

  it('flags a GST mismatch between invoice total and 18% of subtotal', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{
          id: 's1', invoiceNumber: 'INV-2',
          subtotal: 1000, gstAmount: 150, totalAmount: 1150,
          buyerRegistrationType: 'Registered', status: 'paid', date: '2026-10-01',
        }],
      }),
      { now: NOW }
    );
    assert.ok(found.some((f) => /gst/i.test(f.title)), 'expected a GST anomaly');
  });

  it('DOES NOT flag a legitimate sale to an unregistered buyer  (regression guard)', () => {
    // 1000 + 18% GST (180) + 4% further tax (40) = 1220. This is CORRECT, not an anomaly.
    const found = detectAnomalies(
      makeState({
        salesOrders: [{
          id: 's2', invoiceNumber: 'INV-3',
          subtotal: 1000, gstAmount: 180, furtherTax: 40, totalAmount: 1220,
          buyerRegistrationType: 'Unregistered', status: 'paid', date: '2026-10-01',
        }],
      }),
      { now: NOW }
    );
    assert.strictEqual(found.some((f) => /gst/i.test(f.title)), false);
    assert.strictEqual(found.length, 0, 'a correct unregistered-buyer sale must be silent');
  });

  it('DOES NOT flag a sale to an unregistered buyer missing further tax', () => {
    // Same invoice but furtherTax omitted — this one IS an anomaly, but of the
    // further-tax kind, not the GST kind.
    const found = detectAnomalies(
      makeState({
        salesOrders: [{
          id: 's3', invoiceNumber: 'INV-4',
          subtotal: 1000, gstAmount: 180, furtherTax: 0, totalAmount: 1180,
          buyerRegistrationType: 'Unregistered', status: 'paid', date: '2026-10-01',
        }],
      }),
      { now: NOW }
    );
    assert.ok(found.some((f) => /further tax/i.test(f.title)), 'expected a further-tax anomaly');
    assert.ok(
      found.find((f) => /further tax/i.test(f.title))!.citations[0].includes('3(1A)'),
      'further-tax anomaly must cite §3(1A)'
    );
  });

  it('returns an empty array on a clean ledger', () => {
    assert.strictEqual(detectAnomalies(makeState({}), { now: NOW }).length, 0);
  });

  it('does not throw on an empty ledger', () => {
    assert.doesNotThrow(() => detectAnomalies(makeState({}), { now: NOW }));
  });

  // ---- regression guards -------------------------------------------------

  it('does not throw on an empty or absent state', () => {
    assert.doesNotThrow(() => detectAnomalies({}));
    assert.doesNotThrow(() => detectAnomalies({} as DatabaseState));
    assert.deepStrictEqual(detectAnomalies({}), []);
  });

  it('does NOT flag an invoice paid 45 days ago', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{ id: 's1', invoiceNumber: 'INV-5', totalAmount: 50000, status: 'paid', date: '2026-08-20' }],
      }),
      { now: NOW }
    );
    assert.strictEqual(found.length, 0);
  });

  it('does NOT flag an invoice unpaid for fewer than 30 days', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{ id: 's1', invoiceNumber: 'INV-6', totalAmount: 50000, status: 'unpaid', date: '2026-09-20' }],
      }),
      { now: NOW }
    );
    assert.strictEqual(found.length, 0);
  });

  it('flags a partially-paid invoice that is also overdue', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{ id: 's1', invoiceNumber: 'INV-7', totalAmount: 50000, status: 'partially_paid', date: '2026-07-01' }],
      }),
      { now: NOW }
    );
    assert.strictEqual(found.length, 1);
  });

  it('flags a zero-amount invoice', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{
          id: 's1', invoiceNumber: 'INV-8',
          subtotal: 0, gstAmount: 0, totalAmount: 0,
          buyerRegistrationType: 'Registered', status: 'paid', date: '2026-10-01',
        }],
      }),
      { now: NOW }
    );
    assert.ok(found.some((f) => /zero|no consideration/i.test(f.title)), 'expected a zero-amount anomaly');
    assert.ok(found.every((f) => f.citations.length > 0), 'every anomaly must cite a source');
  });

  // The real SalesOrder shape has no buyerRegistrationType. Without it we
  // cannot tell which rate applies, so we must stay silent rather than guess —
  // this is the difference between a useful detector and a noisy one.
  it('stays silent on tax rate when buyer registration is unknown', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{
          id: 's1', invoiceNumber: 'INV-9',
          subtotal: 1000, gstAmount: 150, totalAmount: 1150,
          status: 'paid', date: '2026-10-01',
        }],
      }),
      { now: NOW }
    );
    assert.strictEqual(found.length, 0, 'unclassifiable buyer must not raise a rate anomaly');
  });

  it('reads the repo SalesOrder shape (paymentStatus + taxAmount)', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{
          id: 's1', invoiceNumber: 'INV-10',
          subtotal: 1000, taxAmount: 150, totalAmount: 1150,
          paymentStatus: 'paid', createdAt: '2026-10-01',
          buyerRegistrationType: 'Registered',
        }],
      }),
      { now: NOW }
    );
    assert.ok(found.some((f) => /gst/i.test(f.title)), 'taxAmount must be read as the GST amount');
  });

  it('emits every anomaly as a flag_anomaly proposal with a real citation', () => {
    const found = detectAnomalies(
      makeState({
        salesOrders: [{
          id: 's1', invoiceNumber: 'INV-11',
          subtotal: 1000, gstAmount: 150, furtherTax: 0, totalAmount: 1150,
          buyerRegistrationType: 'Unregistered', status: 'unpaid', date: '2026-06-01',
        }],
        products: [{ id: 'p1', name: 'Yarn', sku: 'Y-1', currentStock: -5, unit: 'kg', reorderThreshold: 10 }],
      }),
      { now: NOW }
    );
    assert.ok(found.length >= 4, `expected several anomalies, got ${found.length}`);
    for (const f of found) {
      assert.strictEqual(f.tool, 'flag_anomaly');
      assert.strictEqual(f.status, 'proposed');
      assert.ok(f.citations.length > 0, `${f.title} cited nothing`);
      assert.ok(f.citations.every((c) => c.trim().length > 0), `${f.title} cited an empty string`);
      assert.ok(f.confidence > 0 && f.confidence <= 1, `${f.title} confidence out of range`);
      assert.ok(f.id.length > 0 && f.agentId.length > 0, `${f.title} missing identity`);
      assert.ok(f.rationale.length > 0, `${f.title} has no rationale`);
      assert.match(f.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('gives two anomalies in one run distinct ids', () => {
    const state = makeState({
      products: [
        { id: 'p1', name: 'A', sku: 'A-1', currentStock: -5, unit: 'kg', reorderThreshold: 10 },
        { id: 'p2', name: 'B', sku: 'B-1', currentStock: -2, unit: 'kg', reorderThreshold: 10 },
      ],
    });
    const ids = detectAnomalies(state, { now: NOW }).map((f) => f.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'ids must be unique');
  });

  it('accepts the repo SalesOrder array without a cast', () => {
    // Compile-time check that the lean DatabaseState stays assignable from the
    // app's own SalesOrder model.
    const repoSalesOrder = {
      id: 'x', invoiceNumber: 'INV-X', subtotal: 1000, totalAmount: 1180,
      paymentStatus: 'unpaid', createdAt: '2026-06-01',
    };
    const state: DatabaseState = { salesOrders: [repoSalesOrder] };
    assert.ok(detectAnomalies(state, { now: NOW }).length >= 1);
  });
});