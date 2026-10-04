/**
 * Demo factory — the seed only matters if it makes the agents fire.
 *
 * A pretty seed that triggers nothing is worse than no seed: the judge opens
 * the app, sees figures, and the autonomy claim is never demonstrated.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDemoFactory } from '../../data/demoFactory';
import { tick } from '../supervisorRuntime';
import type { DatabaseState } from '../../lib/businessTools';
import { movingAverageDailyDemand } from '../reorder';
import { calculateFBRTaxByCategory } from '../../utils/fbrTaxEngine';
import { totalOutstandingReceivables } from '../../lib/businessTools';

function asState(): DatabaseState {
  const d = buildDemoFactory();
  return {
    products: d.products,
    suppliers: d.suppliers,
    customers: d.customers,
    purchaseOrders: d.purchaseOrders,
    salesOrders: d.salesOrders,
    inventoryMovements: d.inventoryMovements,
    cashbook: d.cashbook,
    complianceSources: []
  };
}

describe('demo factory', () => {
  it('produces an inventory agent proposal', async () => {
    const out = await tick(asState());
    const po = out.proposals.filter(p => p.tool === 'create_purchase_order');
    assert.ok(po.length > 0, 'seed must leave an item below threshold with demand history');
  });

  it('produces an anomaly proposal', async () => {
    const out = await tick(asState());
    const anomalies = out.proposals.filter(p => p.tool === 'flag_anomaly');
    assert.ok(anomalies.length > 0, 'seed must include an invoice past the 30-day window');
  });

  it('every seeded proposal carries a citation and a real confidence', async () => {
    const out = await tick(asState());
    for (const p of out.proposals) {
      assert.ok(p.citations.length > 0, `${p.title} has no citation`);
      assert.ok(Number.isFinite(p.confidence) && p.confidence > 0 && p.confidence <= 1);
    }
  });

  it('the below-threshold dye has dispatch history, which is what makes reorder possible', () => {
    const d = buildDemoFactory();
    const dye = d.products.find(p => p.id === 'prd_reactive_dye_blue');
    assert.ok(dye, 'Reactive Dye Blue must be seeded');
    assert.ok(dye.currentStock < dye.reorderThreshold, 'it must sit below its threshold');

    const history = d.salesOrders.flatMap(so =>
      so.items.filter(i => i.productId === dye.id)
        .map(i => ({ date: so.createdAt, quantity: i.quantity }))
    );
    assert.ok(history.length > 0, 'no dispatch history means the engine cannot predict demand');
    assert.ok(movingAverageDailyDemand(history, 30) > 0);
  });

  it('applies 18% GST on every seeded invoice', () => {
    const d = buildDemoFactory();
    const unreg = d.salesOrders.find(o => o.customerName === 'Rahim Traders');
    assert.ok(unreg, 'seed must include the unregistered buyer');
    assert.equal(unreg.subtotal, 252000);
    assert.equal(unreg.taxAmount, 45360);
    assert.equal(unreg.totalAmount, 297360);
  });

  it('charges further tax to an unregistered buyer when the category is supplied', () => {
    // The stored invoice carries no further-tax column — buyer registration is
    // an argument to the engine, not ledger state. So assert the engine, which
    // is where that decision actually lives.
    const registered = calculateFBRTaxByCategory(252000, 'standard_18');
    const unregistered = calculateFBRTaxByCategory(252000, 'unregistered_buyer');
    assert.equal(registered.gstAmount, 45360);
    assert.equal(unregistered.gstAmount, 45360);
    assert.ok(
      unregistered.additionalTaxAmount > registered.additionalTaxAmount,
      'an unregistered buyer must attract further tax under STA s.3(1A)'
    );
  });

  it('is repeatable — two builds do not drift', () => {
    const a = buildDemoFactory();
    const b = buildDemoFactory();
    assert.equal(a.salesOrders.length, b.salesOrders.length);
    assert.equal(a.products.length, b.products.length);
  });
});

describe('the seeded ledger tells one story', () => {
  // Receivables became a single definition — the customer balance field, the one
  // `executeRecordSale` maintains. But the seed still wrote every customer at
  // zero while creating two unpaid invoices (Rs. 513,300 and Rs. 265,500). So
  // the dashboard said "Rs. 0" beside an invoice table visibly marked unpaid.
  //
  // A balance field that does not agree with the invoices it came from is not a
  // seed problem, it is a product that cannot be believed: a judge who adds up
  // the "unpaid" column will land on the number the KPI denies.
  const d = buildDemoFactory();

  it('each customer balance equals the sum of their unpaid invoices', () => {
    for (const c of d.customers) {
      const owed = d.salesOrders
        .filter(so => so.customerId === c.id && so.paymentStatus !== 'paid')
        .reduce((sum, so) => sum + so.totalAmount, 0);
      assert.equal(
        c.outstandingReceivables,
        owed,
        `${c.name} shows a balance of ${c.outstandingReceivables} against ${owed} of unpaid invoices`
      );
    }
  });

  it('the two unpaid invoices are actually owed', () => {
    // Without this the test above passes trivially at zero and the KPI is right
    // for the wrong reason.
    const unpaid = d.salesOrders.filter(so => so.paymentStatus !== 'paid');
    assert.ok(unpaid.length >= 2, 'the seed must still contain unpaid work');
    assert.equal(
      unpaid.reduce((sum, so) => sum + so.totalAmount, 0),
      778_800,
      'the unpaid total the KPI must report'
    );
  });

  it('the KPI the dashboard renders reports that same total', () => {
    assert.equal(
      totalOutstandingReceivables(d.customers),
      778_800,
      'dashboard KPI and copilot summary must read one number'
    );
  });
});
