/**
 * Answer brevity — the copilot's core interaction contract.
 *
 * Written BEFORE the behaviour existed, per PLAN.md §Verification.
 *
 * THE PROBLEM
 *   Ask "how much stock do we have?" and the copilot returned a four-bullet
 *   markdown block: available stock, warehouse SKU, unit cost price, minimum
 *   reorder level. Three of those were unasked for. In a voice loop — the
 *   primary demo surface — the user needs the number, spoken back immediately.
 *   Everything else is one more word between the question and the answer.
 *
 * THE CONTRACT
 *   1. A direct factual question answers with the fact. Nothing else.
 *   2. Detail is available, but only when asked for by name.
 *   3. An answer never differs between voice and text. If it did, the voice
 *      path would be the untested one, and it is the one being demoed.
 *   4. Confirmations and writes are NEVER terse. Shortening the summary of a
 *      transaction a human is about to commit is how money goes into the wrong
 *      ledger. Brevity applies to reading, never to authorising.
 *
 * Rule 4 is the one that could be "optimised" away by accident, so it is
 * pinned hardest.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `payload.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { executeSupervisorTurn } from '../../lib/agentSupervisor';
import { DEMO_PRODUCTS, DEMO_CUSTOMERS, DEMO_SUPPLIERS } from '../../data/fixtures';
import type { DatabaseState } from '../../lib/businessTools';

function demoState(): DatabaseState {
  return {
    products: DEMO_PRODUCTS,
    suppliers: DEMO_SUPPLIERS,
    customers: DEMO_CUSTOMERS,
    purchaseOrders: [],
    salesOrders: [],
    cashbook: [],
    inventoryMovements: [],
    complianceSources: []
  } as unknown as DatabaseState;
}

/** Longest a bare answer may be before it counts as a paragraph. */
const MAX_TERSE_CHARS = 220;

describe('a direct factual question answers with the fact, and nothing else', () => {
  it('stock for one product is a single figure', async () => {
    const state = demoState();
    const r = await executeSupervisorTurn('how much cotton yarn stock is there?', state);
    const expected = DEMO_PRODUCTS.find(p => p.name === 'Cotton Yarn 150D')!;

    assert.ok(
      r.message.content.includes(`${expected.currentStock.toLocaleString()} ${expected.unit}`),
      `must state the real stock: ${r.message.content}`
    );
    assert.ok(
      r.message.content.length <= MAX_TERSE_CHARS,
      `bare answer must be short, got ${r.message.content.length} chars: ${r.message.content}`
    );
    // The unasked-for fields that made the old answer a wall of text.
    assert.doesNotMatch(r.message.content, /Warehouse SKU/i);
    assert.doesNotMatch(r.message.content, /Unit Cost Price/i);
  });

  it('still warns when the item is below its reorder point', async () => {
    const state = demoState();
    const low = DEMO_PRODUCTS.find(p => p.currentStock <= p.reorderThreshold)!;
    const r = await executeSupervisorTurn(`how much ${low.name} stock is there?`, state);

    assert.ok(r.message.content.includes(low.currentStock.toLocaleString()));
    // A bare number with no warning would be misleading for a low item.
    assert.match(r.message.content, /below|reorder|⚠/i);
    assert.ok(r.message.content.length <= MAX_TERSE_CHARS);
  });

  it('cash position is one number', async () => {
    const state = demoState();
    state.cashbook = [
      { id: 'C1', type: 'inflow', amount: 500000, category: 'sales', description: 'x', createdAt: new Date().toISOString() },
      { id: 'C2', type: 'outflow', amount: 12000, category: 'utilities', description: 'x', createdAt: new Date().toISOString() }
    ] as any;

    const r = await executeSupervisorTurn('what is my cash position', state);
    assert.match(r.message.content, /Rs\.\s*488,000/);
    assert.ok(
      r.message.content.length <= MAX_TERSE_CHARS,
      `got ${r.message.content.length} chars: ${r.message.content}`
    );
  });

  it('a low-stock sweep names only the items that are actually low', async () => {
    const r = await executeSupervisorTurn('show me low stock', demoState());
    const low = DEMO_PRODUCTS.filter(p => p.currentStock <= p.reorderThreshold);

    for (const p of low) {
      assert.ok(r.message.content.includes(p.name), `must name ${p.name}`);
    }
    for (const p of DEMO_PRODUCTS.filter(p => p.currentStock > p.reorderThreshold)) {
      assert.ok(!r.message.content.includes(p.name), `must NOT mention healthy item ${p.name}`);
    }
  });
});

describe('detail is available, but only when asked for by name', () => {
  it('"details" unlocks the full stock record', async () => {
    const state = demoState();
    const terse = await executeSupervisorTurn('cotton yarn stock', state);
    const r = await executeSupervisorTurn('cotton yarn stock details please', state);

    assert.match(r.message.content, /Warehouse SKU/i);
    assert.ok(
      r.message.content.length > terse.message.content.length,
      'the detailed form must actually be longer than the bare one'
    );
  });

  it('the Urdu request for detail also unlocks it', async () => {
    const r = await executeSupervisorTurn('کتنے اسٹاک ہے تفصیل سے', demoState());
    assert.ok(r.message.content.length > 120, `expected the detailed form, got: ${r.message.content}`);
  });

  it('a bare question does not get the detailed form', async () => {
    const terse = await executeSupervisorTurn('cotton yarn stock', demoState());
    const detailed = await executeSupervisorTurn('cotton yarn stock details', demoState());
    assert.ok(terse.message.content.length < detailed.message.content.length);
  });
});

describe('voice and text must produce the same answer', () => {
  const questions = [
    'how much cotton yarn stock is there?',
    'what is my cash position',
    'show me low stock',
    'how much cotton yarn stock details'
  ];

  for (const q of questions) {
    it(`identical for: "${q.slice(0, 40)}"`, async () => {
      const text = await executeSupervisorTurn(q, demoState(), 'text');
      const voice = await executeSupervisorTurn(q, demoState(), 'voice');
      assert.strictEqual(
        voice.message.content,
        text.message.content,
        'the spoken answer must be the same answer'
      );
    });
  }
});

describe('confirmations and writes are never shortened', () => {
  it('a sales confirmation keeps its full amount breakdown', async () => {
    const state = demoState();
    state.purchaseOrders = [];
    const r = await executeSupervisorTurn('sell 50 kg cotton yarn to Rahim Traders', state);

    assert.ok(r.pendingConfirmation, 'a sale must still require confirmation');
    const c = r.message.content;
    // A human is about to commit this to the ledger. Every figure they need to
    // check it must be on screen.
    assert.match(c, /Customer/i);
    assert.match(c, /Subtotal/i);
    assert.match(c, /GST/i);
    assert.match(c, /Total/i);
    assert.ok(c.length > MAX_TERSE_CHARS, `confirmation must stay detailed, got ${c.length} chars`);
  });

  it('a purchase-order confirmation keeps its detail', async () => {
    const state = demoState();
    state.purchaseOrders = [];
    // The supplier is named because an unnamed supplier is no longer guessed. This
    // test is about LENGTH — a confirmation must never be shortened — so it
    // supplies every ingredient and checks the one thing it is actually about.
    const r = await executeSupervisorTurn(
      'create po for 100 kg cotton yarn from Green Mills',
      state
    );

    assert.ok(r.pendingConfirmation, 'a fully specified PO must still be prepared');
    assert.ok(r.message.content.length > 120, 'PO confirmation must stay detailed');
  });

  it('a goods receipt reports what it wrote to stock', async () => {
    const state = demoState();
    state.purchaseOrders = [
      {
        id: 'PO-1',
        poNumber: 'PO-2001',
        supplierName: DEMO_SUPPLIERS[0].name,
        status: 'pending',
        totalAmount: 100000,
        createdAt: new Date().toISOString(),
        items: [{ productId: DEMO_PRODUCTS[0].id, productName: DEMO_PRODUCTS[0].name, quantity: 50, unit: DEMO_PRODUCTS[0].unit, unitPrice: 1000, totalAmount: 50000 }]
      }
    ] as any;

    const r = await executeSupervisorTurn('receive goods PO-2001', state);
    assert.ok(
      /stock|received|granted/i.test(r.message.content),
      'a receipt must say what it did to stock'
    );
  });
});

describe('the refusal stays honest and stays short', () => {
  it('refuses without the five-bullet capability list', async () => {
    const r = await executeSupervisorTurn('What is the best bowling attack in Pakistan?', {} as any);

    assert.match(r.message.content, /don't have a reliable answer/i);
    assert.ok(
      r.message.content.length <= 320,
      `refusal must be brief, got ${r.message.content.length} chars: ${r.message.content}`
    );
    assert.doesNotMatch(r.message.content, /Purchase orders and goods receipt/i);
  });
});