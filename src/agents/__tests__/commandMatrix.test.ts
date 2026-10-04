/**
 * The command matrix — every phrasing a judge is likely to try.
 *
 * WHY THIS SUITE
 *   The copilot is demoed by saying things at it. Its credibility rests on
 *   every command doing what it says: the right agent, the real number, and a
 *   short answer. `answerBrevity.test.ts` proves brevity and
 *   `routing.test.ts` proves the refusal — neither sweeps the phrasings.
 *
 *   This one found a live bug the moment it was written. Plain English
 *   "Sell 50 kg cotton yarn to Rahim Traders" matched no sale rule at all,
 *   fell through to the inventory fallback, and was answered with a warehouse
 *   stock report. The user asked for a sale and was told how much dye was on
 *   the shelf — and nothing in the UI said the command had not been understood.
 *   That is the single worst failure this product can have, so every command
 *   class is pinned across all three input languages here.
 *
 * THREE LANGUAGES, BECAUSE THE PRODUCT CLAIMS THREE
 *   English, Roman Urdu, and Urdu in Arabic script. A command class that works
 *   in two of them is not "Urdu and English support", it is a demo that
 *   breaks on stage.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `payload.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { analyzeUserIntent, executeSupervisorTurn } from '../../lib/agentSupervisor';
import { DEMO_PRODUCTS, DEMO_CUSTOMERS, DEMO_SUPPLIERS } from '../../data/fixtures';
import { totalOutstandingReceivables } from '../../lib/businessTools';
import { buildFBRPosInvoicePayload } from '../../utils/fbrTaxEngine';
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

const COTTON = DEMO_PRODUCTS.find(p => p.sku === 'CY-150D')!;
const DYE = DEMO_PRODUCTS.find(p => p.sku === 'RD-BLU-100')!;

/** A read-only answer must not become a wall of text. */
const READ_MAX = 260;

type Row = {
  label: string;
  phrasings: string[];
  intent: string;
};

/**
 * One row per command class. Each class is tried in all three languages —
 * that equality is the point of the suite.
 */
const MATRIX: Row[] = [
  {
    label: 'stock level for a named item',
    intent: 'check_inventory',
    phrasings: [
      'how much cotton yarn stock is there',
      'cotton yarn ka stock kitna hai',
      'کتنے کپھی یارن اسٹاک ہے'
    ]
  },
  {
    label: 'low-stock alert',
    intent: 'check_inventory',
    phrasings: [
      'show me low stock',
      'kam stock batao',
      'کم اسٹاک والی اشیا'
    ]
  },
  {
    label: 'cash position',
    intent: 'get_cash_balance',
    phrasings: [
      'what is my cash position',
      'kitna cash hai',
      'کتنا کیش موجود ہے'
    ]
  },
  {
    label: 'executive summary',
    intent: 'get_business_summary',
    phrasings: [
      'business summary',
      'aaj ka hisaab batao',
      'آج کا بزنس سمری دو'
    ]
  },
  {
    label: 'record a sale',
    intent: 'record_sale',
    phrasings: [
      'sell 50 kg cotton yarn to Rahim Traders',
      '50 kg cotton yarn sell karo',
      '50 کلو یارن سیل کرو'
    ]
  },
  {
    label: 'raise a purchase order',
    intent: 'create_purchase_order',
    phrasings: [
      'create po for 100 kg cotton yarn',
      '100 kg yarn ka po banao',
      '100 کلو یارن کا پرچیز آرڈر بناؤ'
    ]
  },
  {
    label: 'reorder low stock',
    intent: 'reorder_materials',
    phrasings: [
      'reorder low stock',
      'dobara mangwa do',
      'دوبارہ منگوا دو'
    ]
  },
  {
    label: 'tax question',
    intent: 'compliance_query',
    phrasings: [
      'what is the section 153 withholding rate',
      'withholding tax kitna hai',
      'سیکشن 153 ٹیکس کتنی ہے'
    ]
  },
  {
    label: 'add a supplier',
    intent: 'add_supplier',
    phrasings: [
      'add supplier Nova Chemicals',
      'naya supplier banao Nova Chemicals',
      'نیا سپلائر شامل کریں Nova Chemicals'
    ]
  },
  {
    label: 'add a customer',
    intent: 'add_customer',
    phrasings: [
      'add customer Alpha Mills',
      'naya customer banao Alpha Mills',
      'نیا کسٹمر شامل کریں Alpha Mills'
    ]
  }
];

describe('every command class routes in all three languages', () => {
  for (const row of MATRIX) {
    for (const phrase of row.phrasings) {
      it(`${row.label} — "${phrase.slice(0, 42)}"`, () => {
        const c = analyzeUserIntent(phrase, demoState());
        assert.strictEqual(
          c.intent,
          row.intent,
          `"${phrase}" should route to ${row.intent}, got ${c.intent}`
        );
      });
    }
  }
});

describe('a command does one thing, not the nearest other thing', () => {
  // The regression that motivated this file. A sale request must never be
  // answered with a warehouse report: the user is owed a confirmation or an
  // honest failure, never a different question's answer.
  const salePhrasings = [
    'sell 50 kg cotton yarn to Rahim Traders',
    'sell me 200 kg of cotton yarn',
    'create an invoice for 30 kg cotton yarn',
    '50 kg cotton yarn sell karo',
    '50 کلو یارن سیل کرو'
  ];

  for (const phrase of salePhrasings) {
    it(`a sale request is never answered as inventory: "${phrase.slice(0, 40)}"`, async () => {
      const r = await executeSupervisorTurn(phrase, demoState());
      const c = r.message.content;

      // EITHER a confirmation, OR the question asking which customer — but never
      // a different command's answer.
      //
      // This used to demand a confirmation unconditionally, which pinned the
      // defect: with no customer named the sale was still "confirmed", against
      // whichever client sat at index 0. Asking is now the correct outcome, so
      // the assertion below no longer accepts it.
      assert.ok(
        r.pendingConfirmation || /Could not prepare sales/i.test(c) || /detail(s)? needed/i.test(c),
        `"${phrase}" must either confirm a sale or ask which customer, got: ${c.slice(0, 160)}`
      );
      assert.doesNotMatch(
        c,
        /Warehouse Inventory Status|below minimum|Available Stock/i,
        `"${phrase}" was answered with an inventory report instead`
      );
    });
  }

  it('a stock question is never answered as a sale', () => {
    const c = analyzeUserIntent('how much cotton yarn stock is there', demoState());
    assert.strictEqual(c.intent, 'check_inventory');
    assert.notStrictEqual(c.intent, 'record_sale');
  });

  // Found by sweeping this suite's own phrasings. Both were live defects.
  const readNotWrite: ReadonlyArray<readonly [string, string, string]> = [
    ['pending purchase orders', 'get_pending_orders', 'asked what was outstanding and got a PO approval form'],
    ['pending orders', 'get_pending_orders', 'asked what was outstanding and got a PO approval form'],
    ['how much cash do we have', 'get_cash_balance', 'the most obvious question in the product was refused'],
    ['kitne paise hain', 'get_cash_balance', 'Roman Urdu for the same cash question was refused'],
    ['how much cash do we have in the bank', 'get_cash_balance', 'cash balance worded as a bank question was refused']
  ];

  for (const [phrase, intent, why] of readNotWrite) {
    it(`a read is never answered with a write: "${phrase}" — ${why}`, async () => {
      const c = analyzeUserIntent(phrase, demoState());
      assert.strictEqual(c.intent, intent);

      const r = await executeSupervisorTurn(phrase, demoState());
      assert.ok(
        !r.pendingConfirmation,
        `"${phrase}" must not open a confirmation card, got: ${r.message.content.slice(0, 160)}`
      );
      assert.doesNotMatch(
        r.message.content,
        /Prepared for Confirmation|please review and confirm/i,
        `"${phrase}" was answered with a write confirmation`
      );
    });
  }

  it('an expense phrased with "cash" is still an expense, not a balance read', () => {
    // The cash rule matches the bare word, so its exclusions are the only thing
    // keeping a cash expense out of the balance answer.
    const c = analyzeUserIntent('pay 5000 cash expense for the utility bill', demoState());
    assert.strictEqual(c.intent, 'record_expense');
  });
});

describe('read answers carry the real figure and stay short', () => {
  it('stock answers state the real quantity', async () => {
    const r = await executeSupervisorTurn('how much cotton yarn stock is there', demoState());
    assert.ok(
      r.message.content.includes(COTTON.currentStock.toLocaleString()),
      `expected ${COTTON.currentStock.toLocaleString()}, got: ${r.message.content}`
    );
    assert.ok(
      r.message.content.length <= READ_MAX,
      `got ${r.message.content.length} chars: ${r.message.content}`
    );
  });

  it('a low item is flagged low in every language', async () => {
    for (const phrase of [
      'how much reactive dye blue stock is there',
      'reactive dye blue ka stock kitna hai',
      'ری ایکٹو ڈائی بلو اسٹاک کتنا ہے'
    ]) {
      const r = await executeSupervisorTurn(phrase, demoState());
      assert.ok(
        r.message.content.includes(DYE.currentStock.toLocaleString()),
        `"${phrase}" must state ${DYE.currentStock}`
      );
      assert.match(
        r.message.content,
        /below|reorder|⚠/i,
        `"${phrase}" must warn that the item is below its reorder level`
      );
    }
  });

  // Product matching compared the question against the English `Product.name`
  // only. Asked "کتنے یارن اسٹاک ہے" the copilot matched nothing, fell through to
  // the low-stock sweep, and answered with REACTIVE DYE BLUE's quantity — yarn
  // was asked about, dye was reported, in one sentence, with nothing on screen
  // saying the question had been misread. These pin the item, not just a number.
  const namedItem: ReadonlyArray<readonly [string, typeof COTTON]> = [
    ['کتنے یارن اسٹاک ہے', COTTON],
    ['کتنا یارن بچا ہے', COTTON],
    ['کتنے کپھ اسٹاک ہے', COTTON],
    ['یارن کا اسٹاک بتا دو', COTTON],
    ['کتنے بوبن ہیں', DEMO_PRODUCTS.find(p => p.sku === 'BOB-STD')!],
    ['how much yarn stock', COTTON]
  ];

  for (const [phrase, item] of namedItem) {
    it(`"${phrase}" answers about ${item.name}, not some other material`, async () => {
      const r = await executeSupervisorTurn(phrase, demoState());
      const c = r.message.content;
      assert.ok(
        c.includes(item.currentStock.toLocaleString()),
        `"${phrase}" must state ${item.name} at ${item.currentStock}, got: ${c}`
      );
      assert.ok(
        c.includes(item.name),
        `"${phrase}" must name the material it is reporting on, got: ${c}`
      );
      assert.ok(
        !c.includes(DYE.name),
        `"${phrase}" answered with a DIFFERENT material than the one asked about: ${c}`
      );
    });
  }

  it('no read answer anywhere exceeds the ceiling', async () => {
    const reads = [
      'how much cotton yarn stock is there',
      'show me low stock',
      'what is my cash position',
      'business summary',
      'sync inventory',
      'pending purchase orders',
      'what is the section 153 withholding rate'
    ];

    for (const phrase of reads) {
      const r = await executeSupervisorTurn(phrase, demoState());
      assert.ok(
        r.message.content.length <= 420,
        `"${phrase}" produced ${r.message.content.length} chars: ${r.message.content.slice(0, 200)}`
      );
    }
  });
});

describe('a general stock question reports what is actually in stock', () => {
  // THE REPORTED DEFECT. "کتنے اسٹاک ہے" returned the LOW-STOCK list only:
  //
  //     ⚠️ 1 below minimum
  //     • Reactive Dye Blue — 18 kg
  //
  // One item, one line, and nothing on screen saying the other five materials
  // were left out. It reads as "this is your stock", and it is a lie by
  // omission — the factory holds six SKUs worth Rs. 39.43 L. A stock question
  // with no item named is a question about the whole warehouse, so the whole
  // warehouse is the answer.
  const general = [
    'کتنے اسٹاک ہے',
    'اسٹاک کتنا ہے؟',
    'how much stock is there',
    'stock bata do',
    'what is in stock'
  ];

  for (const phrase of general) {
    it(`"${phrase}" lists the whole catalogue`, async () => {
      const r = await executeSupervisorTurn(phrase, demoState());
      const c = r.message.content;

      const named = DEMO_PRODUCTS.filter(p => c.includes(p.name));
      assert.ok(
        named.length >= DEMO_PRODUCTS.length - 1,
        `"${phrase}" named ${named.length} of ${DEMO_PRODUCTS.length} materials: ${c}`
      );

      // And the figures, not just the names.
      assert.ok(
        c.includes(COTTON.currentStock.toLocaleString()),
        `"${phrase}" must state the yarn quantity it holds, got: ${c}`
      );
      assert.ok(
        c.includes(DYE.currentStock.toLocaleString()),
        `"${phrase}" must state the dye quantity it holds, got: ${c}`
      );

      // The low-stock warning is still owed, and still first.
      assert.match(c, /⚠|below|reorder/i, `"${phrase}" must keep the reorder warning`);
    });
  }

  it('a general stock answer stays short enough to read', async () => {
    const r = await executeSupervisorTurn('how much stock is there', demoState());
    assert.ok(
      r.message.content.length <= 420,
      `got ${r.message.content.length} chars: ${r.message.content}`
    );
  });
});

describe('a command missing an ingredient asks instead of guessing', () => {
  // THE SECOND REPORTED DEFECT. "پرچیز آرڈر بنا دو" produced a fully populated
  // Purchase Order confirmation card: supplier "Green Mills Ltd", product
  // "Cotton Yarn 150D", quantity 100 — all three invented from whichever record
  // happened to be first in the array. The user was then asked to press
  // "Confirm & Save" on a purchase order they never specified. A fabricated
  // figure behind a confirm button is the worst thing this product can do.
  const underSpecified = [
    'purchase order banao',
    'po banao',
    'make a purchase order',
    'پرچیز آرڈر بنا دو'
  ];

  for (const phrase of underSpecified) {
    it(`"${phrase}" asks which supplier and which material`, async () => {
      const r = await executeSupervisorTurn(phrase, demoState());
      const c = r.message.content;

      assert.ok(!r.pendingConfirmation, `"${phrase}" must not open a confirmation card`);
      assert.doesNotMatch(
        c,
        /Prepared for Confirmation|Total Committed|Confirm & Save/i,
        `"${phrase}" fabricated a purchase order: ${c}`
      );
      assert.match(c, /supplier/i, `"${phrase}" must ask which supplier: ${c}`);
      assert.match(
        c,
        /material|item|product/i,
        `"${phrase}" must ask which material: ${c}`
      );
      assert.ok(
        c.length <= 260,
        `"${phrase}" must ask in one or two lines, got ${c.length} chars: ${c}`
      );
    });
  }

  it('a purchase order that names a supplier and material still confirms', async () => {
    // The fix must not turn the write path off. Only the guesses go.
    const r = await executeSupervisorTurn(
      'create po for 100 kg cotton yarn from Green Mills',
      demoState()
    );
    assert.ok(r.pendingConfirmation, 'a fully specified PO must still be prepared');
    assert.match(
      r.pendingConfirmation!.details.supplier,
      /Green Mills/i,
      'the supplier the user named is the one used'
    );
  });

  it('a sale with no customer named asks rather than picking the first one', async () => {
    const r = await executeSupervisorTurn('sell 50 kg cotton yarn', demoState());
    assert.ok(!r.pendingConfirmation, 'no customer was named, so nothing may be confirmed');
    assert.match(r.message.content, /customer|client/i, r.message.content);
  });

  it('a sale that names a customer still confirms', async () => {
    const r = await executeSupervisorTurn(
      'sell 50 kg cotton yarn to Rahim Traders',
      demoState()
    );
    assert.ok(r.pendingConfirmation, 'a fully specified sale must still be prepared');
  });

  it('every real supplier and material is offered as a choice, never invented', async () => {
    const c = (await executeSupervisorTurn('purchase order banao', demoState())).message.content;
    for (const s of DEMO_SUPPLIERS) {
      assert.ok(c.includes(s.name), `the question must offer the real supplier ${s.name}: ${c}`);
    }
  });
});

describe('the receivables figure has exactly one owner', () => {
  // THIS WORK CREATED THE SPLIT. The dashboard KPI was changed to sum unpaid
  // INVOICES while the copilot's business summary kept summing the CUSTOMER
  // balance field. The same ledger then read "Rs. 7.79 L" on the dashboard and
  // "Outstanding Receivables: Rs. 0" one screen away — the product contradicting
  // itself about money owed, which is the one number a finance manager will
  // check first.
  //
  // `totalOutstandingReceivables` is now the single owner of that figure. Both
  // surfaces call it. There is no second derivation to drift.
  function stateWithArrears(): DatabaseState {
    const base = demoState();
    return {
      ...base,
      customers: base.customers.map((c, i) => ({
        ...c,
        outstandingReceivables: i === 0 ? 513_300 : i === 1 ? 265_500 : 0
      }))
    } as unknown as DatabaseState;
  }

  it('the copilot summary reports the owner, not its own arithmetic', async () => {
    const state = stateWithArrears();
    const expected = totalOutstandingReceivables(state.customers);
    const r = await executeSupervisorTurn('business summary', state);

    // The terse summary is what this command actually renders — "📊 Sales … ·
    // Cash … · Receivables Rs. …". Pinning the detailed wording would have
    // tested a form this phrase never produces.
    assert.match(
      r.message.content,
      new RegExp(`Receivables Rs\\. ${expected.toLocaleString()}`),
      `summary must state Rs. ${expected.toLocaleString()}, got: ${r.message.content}`
    );
  });

  it('the dashboard calls the owner instead of re-deriving receivables', () => {
    const src = readFileSync(
      new URL('../../components/ExecutiveDashboard.tsx', import.meta.url),
      'utf8'
    );

    assert.match(
      src,
      /totalOutstandingReceivables/,
      'the dashboard must call the shared helper, not compute its own figure'
    );
    assert.doesNotMatch(
      src,
      /paymentStatus === 'unpaid'/,
      'the dashboard re-derives receivables from invoices, which is the second definition that caused the disagreement'
    );
  });

  it('both surfaces therefore report the same figure', async () => {
    const state = stateWithArrears();
    const r = await executeSupervisorTurn('business summary', state);
    const owner = totalOutstandingReceivables(state.customers);

    assert.equal(owner, 778_800, 'the owner sums the two customers carrying a balance');
    assert.ok(
      r.message.content.includes(`Rs. ${owner.toLocaleString()}`),
      'and that is what the copilot shows'
    );
  });
});

describe('one layer interprets every command', () => {
  // TWO OWNERS. The copilot routes through `analyzeUserIntent`. The floating
  // voice assistant routes through mind.ts -> executor.ts. The audit ran the
  // SAME UTTERANCE on both surfaces and got two different answers:
  //
  //   copilot  -> "Supplier? dEMO"
  //   modal    -> "Supplier not found" / "this supplier is not registered"
  //
  // Same app, same ledger, one screen apart. The old executor's `prepareWrite`
  // guessed a supplier from its own list and reported a lookup failure; the
  // supervisor asks. Two interpreters means the answer depends on which button
  // you pressed, which is the opposite of the point of a copilot.
  //
  // The supervisor wins the ownership: it is deterministic (mind.ts needs an API
  // key and degrades to null without one), it is where every behavioural test
  // in this repo points, and it is the path the demo chips send.
  const AUDIT_UTTERANCE = 'پرچیز آرڈر بناو';

  it('the copilot answers the audit utterance by asking, not by failing a lookup', async () => {
    const r = await executeSupervisorTurn(AUDIT_UTTERANCE, demoState());
    assert.match(
      r.message.content,
      /Supplier\?/,
      `the copilot must ask which supplier, got: ${r.message.content}`
    );
    assert.doesNotMatch(
      r.message.content,
      /Supplier not found/i,
      'the copilot must not fail a supplier lookup it never attempted'
    );
  });

  it('the floating voice surface delegates instead of interpreting', () => {
    const src = readFileSync(
      new URL('../../components/VoiceAssistantModal.tsx', import.meta.url),
      'utf8'
    );

    assert.doesNotMatch(
      src,
      /from '\.\.\/lib\/voice\/mind'/,
      'the modal must not run its own intent model'
    );
    assert.doesNotMatch(
      src,
      /from '\.\.\/lib\/voice\/executor'/,
      'the modal must not run its own executor'
    );
    assert.doesNotMatch(
      src,
      /from '\.\.\/lib\/voice\/fastPath'/,
      'the modal must not run its own fast-path matcher'
    );
    assert.match(
      src,
      /sendMessage\(\s*query,\s*'voice'\s*\)/,
      'the modal must hand the utterance to the shared path'
    );
  });
});

describe('navigate and print are commands, not data questions', () => {
  // FIVE COMMANDS BROKEN BY THE SINGLE-OWNER CHANGE. When the voice modal
  // stopped running its own mind.ts/executor.ts pipeline and began handing
  // utterances to the supervisor, the supervisor had no navigate or print
  // intent. Those five chips fell through to whatever rule matched their
  // words: "dashboard kholo" was answered with a BUSINESS SUMMARY, because
  // "dashboard" is not a rule and the fallback found one.
  //
  // A command answered with a different command's answer is the exact failure
  // this suite was written to kill. Navigation and print are commands, so the
  // layer that now owns commands has to own these too.
  const NAVIGATE: ReadonlyArray<readonly [string, string]> = [
    ['dashboard kholo', 'dashboard'],
    ['reports kholo', 'reports']
  ];

  const PRINT: ReadonlyArray<readonly [string, string]> = [
    ['invoice print karo', 'invoice'],
    ['stock report print karo', 'inventory_report']
  ];

  const FBR_READY = 'FBR integration ready kaise ho';

  for (const [phrase, module] of NAVIGATE) {
    it(`"${phrase}" navigates to ${module}`, async () => {
      assert.strictEqual(analyzeUserIntent(phrase, demoState()).intent, 'navigate');

      const r = await executeSupervisorTurn(phrase, demoState());
      assert.deepEqual(
        r.directive,
        { type: 'navigate', module },
        `"${phrase}" must carry a navigate directive, got: ${JSON.stringify(r.directive)}`
      );
      assert.ok(
        !/Sales Rs\.|items in stock|below minimum/i.test(r.message.content),
        `"${phrase}" was answered with data instead of navigating: ${r.message.content}`
      );
      assert.ok(r.message.content.length <= 160, 'navigation answers in one short line');
    });
  }

  for (const [phrase, document] of PRINT) {
    it(`"${phrase}" prints the ${document}`, async () => {
      // A print command needs something to print. `demoState()` ships empty
      // sales orders, which is exactly why the separate test below exists.
      const state = {
        ...demoState(),
        salesOrders: [{
          id: 'so_x', invoiceNumber: 'INV-TEST-1', organizationId: 'org_demo',
          customerId: 'c1', customerName: 'Rahim Traders',
          subtotal: 1000, taxAmount: 180, totalAmount: 1180,
          paymentStatus: 'unpaid', items: [], createdBy: 'u', createdAt: new Date().toISOString()
        }]
      } as unknown as DatabaseState;

      assert.strictEqual(analyzeUserIntent(phrase, state).intent, 'print');

      const r = await executeSupervisorTurn(phrase, state);
      assert.equal(r.directive?.type, 'print');
      assert.equal((r.directive as any)?.document, document);
      assert.ok(
        !/Sales Rs\.|items in stock|below minimum/i.test(r.message.content),
        `"${phrase}" was answered with data instead of printing: ${r.message.content}`
      );
      assert.ok(r.message.content.length <= 160, 'print answers in one short line');
    });
  }

  it('"FBR integration ready" opens the integration module, not a tax rate', async () => {
    const r = await executeSupervisorTurn(FBR_READY, demoState());
    assert.deepEqual(r.directive, { type: 'navigate', module: 'fbr_integration' });
    assert.doesNotMatch(
      r.message.content,
      /Sales Tax Act|withholding|%\s*GST/i,
      `readiness is not a statutory rate question: ${r.message.content}`
    );
    assert.ok(r.message.content.length <= 200, 'and answers in a line or two');
  });

  it('nothing prints from an empty ledger without saying so', async () => {
    const empty = { ...demoState(), salesOrders: [], products: [] } as unknown as DatabaseState;
    const r = await executeSupervisorTurn('invoice print karo', empty);
    assert.equal(
      r.directive,
      undefined,
      'there is no invoice to print, so nothing may be sent to the print dialog'
    );
    assert.match(
      r.message.content,
      /no invoice|nothing to print|موجود نہیں/i,
      `it must say there is nothing to print, got: ${r.message.content}`
    );
    assert.doesNotMatch(
      r.message.content,
      /چھپ رہا ہے|printing/i,
      'and it must not claim to have printed anything'
    );
  });

  it('navigation is not gated to text input — voice must reach it too', () => {
    const src = readFileSync(
      new URL('../../context/AppContext.tsx', import.meta.url),
      'utf8'
    );
    assert.doesNotMatch(
      src,
      /action === 'navigate' && method === 'text'/,
      "the navigate lane is unreachable from voice input while it is gated on method === 'text'"
    );
  });
});

describe('a printed tax document carries no invented identifiers', () => {
  // The FBR document number was `FBR-PK-2024-<pos>-<suffix>`. The suffix was
  // always derived from the record; the YEAR was a literal, so a document
  // printed in October 2026 bore a 2024 stamp on a tax invoice. Same class as
  // the fabricated NTN and the toy "cryptographic" hash already removed: an
  // identifier on a statutory document that no system of record produced.
  //
  // It must now come from the record's own date, and there must be no literal
  // year left in the source to drift again.
  const invoice = (invoiceNumber: string, createdAt: string) => ({
    id: `so_${invoiceNumber}`, invoiceNumber, organizationId: 'org_demo',
    customerId: 'c1', customerName: 'Rahim Traders',
    subtotal: 435000, taxAmount: 78300, totalAmount: 513300,
    paymentStatus: 'unpaid' as const, items: [],
    createdBy: 'u', createdAt
  });

  it('the fiscal document number takes its year from the record', () => {
    const built = buildFBRPosInvoicePayload({
      invoiceNumber: 'INV-DEMO-1001',
      dateTime: '2026-10-04T09:30:00.000Z',
      buyerName: 'Faisalabad Powerlooms',
      items: [{ itemName: 'Cotton Yarn 150D', quantity: 300, unitPrice: 1450, taxRate: 18 }]
    });

    assert.match(
      built.FbrFiscalInvoiceNumber,
      /^FBR-PK-2026-/,
      `a 2026 invoice must not carry a 2024 stamp, got: ${built.FbrFiscalInvoiceNumber}`
    );
    assert.doesNotMatch(
      built.FbrFiscalInvoiceNumber,
      /2024/,
      `no literal year may appear, got: ${built.FbrFiscalInvoiceNumber}`
    );
  });

  it('no literal year survives anywhere in the fiscal number builder', () => {
    const src = readFileSync(
      new URL('../../utils/fbrTaxEngine.ts', import.meta.url),
      'utf8'
    );
    assert.doesNotMatch(
      src,
      /FBR-PK-20\d\d/,
      'the FBR-PK-<year> prefix must be built, never typed'
    );
  });

  it('with several invoices, print ASKS which one instead of guessing', async () => {
    // This test used to demand a silent pick of the newest invoice. That is the
    // behaviour the user reported as "auto saving with its own hardcoded
    // things": a guess with a printer attached, invisible until paper feeds.
    // The rule is now ask-first, the same one the purchase-order command uses.
    const state = {
      ...demoState(),
      salesOrders: [
        invoice('INV-DEMO-1001', '2026-08-02T09:00:00.000Z'),
        invoice('INV-DEMO-1002', '2026-09-20T09:00:00.000Z')
      ]
    } as unknown as DatabaseState;

    const r = await executeSupervisorTurn('invoice print karo', state);

    assert.equal(
      r.directive,
      undefined,
      'nothing may be sent to the printer while the choice is open'
    );
    assert.match(r.message.content, /which one/i, r.message.content);
    assert.ok(
      r.message.content.includes('INV-DEMO-1001') &&
        r.message.content.includes('INV-DEMO-1002'),
      `both candidates must be offered, got: ${r.message.content}`
    );
    assert.ok(r.message.content.length <= 400, 'and stay short');
  });

  it('with exactly one invoice, print it and name it', async () => {
    const state = {
      ...demoState(),
      salesOrders: [invoice('INV-DEMO-1001', '2026-08-02T09:00:00.000Z')]
    } as unknown as DatabaseState;

    const r = await executeSupervisorTurn('invoice print karo', state);
    const directive = r.directive as any;

    assert.equal(directive?.document, 'invoice');
    assert.ok(directive?.data?.invoiceNumber, 'the directive carries the record');
    assert.ok(
      r.message.content.includes('INV-DEMO-1001'),
      `the reply must name what is printing, got: ${r.message.content}`
    );
    assert.ok(r.message.content.length <= 160);
  });

  it('the stock report names the report it picked', async () => {
    const r = await executeSupervisorTurn('stock report print karo', demoState());
    assert.match(
      r.message.content,
      /stock report|اسٹاک رپورٹ/i,
      r.message.content
    );
    assert.ok(r.message.content.length <= 160);
  });
});

describe('no answer ever leaks a placeholder', () => {
  const phrasings = [
    'how much cotton yarn stock is there',
    'what is my cash position',
    'business summary',
    'sell 50 kg cotton yarn to Rahim Traders',
    'create po for 100 kg cotton yarn',
    'what is the section 153 withholding rate'
  ];

  for (const phrase of phrasings) {
    it(`no invented identity: "${phrase.slice(0, 40)}"`, async () => {
      const r = await executeSupervisorTurn(phrase, demoState());
      const c = r.message.content;
      // These literals were shipped at some point in this codebase and must
      // never reappear in an assistant answer.
      for (const bad of ['4029184', '32-77-8761', '35201-9876543', 'Master Textile Mills']) {
        assert.ok(!c.includes(bad), `answer leaked ${bad}: ${c.slice(0, 200)}`);
      }
      assert.doesNotMatch(c, /TODO|FIXME|undefined|NaN/, `answer leaked a sentinel: ${c.slice(0, 200)}`);
    });
  }
});