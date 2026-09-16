/**
 * VOICE MIND — fixture suite (spec §8.1)
 * Deterministic: mocks the network seam so the mind's prompt-building and
 * response parsing are tested without Groq. Run: node scripts/voice-fixture-test.mjs
 */

let passed = 0, failed = 0;
const failures = [];

function eq(actual, expected, label) {
  if (actual === expected) { passed++; return; }
  failed++;
  failures.push(`${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
}

function ok(cond, label) {
  if (cond) { passed++; return; }
  failed++;
  failures.push(label);
}

// ---------------------------------------------------------------------------
// 1 · normalize.ts — digits, ASR folds, Urdu numbers, amounts, quantities
// ---------------------------------------------------------------------------
import { normalizeUtterance, extractAmount, extractQuantityUnit, firstUrduNumber } from '../src/lib/voice/normalize.ts';

eq(normalizeUtterance('۵۰ کلو'), '50 کلو', 'normalize: Arabic-Indic digits fold');
eq(normalizeUtterance('  cash   book  '), 'cash book', 'normalize: whitespace + word fold');
eq(extractAmount('1 lakh ki sale'), 100000, 'amount: 1 lakh');
eq(extractAmount('چھیاسی ہزار'), 86000, 'amount: Urdu «چھیاسی ہزار» = 86,000');
eq(extractAmount('2 crore deal'), 20000000, 'amount: 2 crore');
eq(extractAmount('Rs. 64,900'), 64900, 'amount: comma digits');
eq(extractAmount('50k'), 50000, 'amount: 50k');
eq(firstUrduNumber('پچاس کلو یارن'), 50, 'urdu number: پچاس = 50');
eq(extractQuantityUnit('50 کلو یارن')?.unit, 'kg', 'qty: کلو → kg');
eq(extractQuantityUnit('50 کلو یارن')?.quantity, 50, 'qty: 50');
eq(extractQuantityUnit('do سو kg')?.quantity, 200, 'qty: mixed Roman «do سو» = 200');
const qty = extractQuantityUnit('300 kg cotton');
eq(qty?.quantity, 300, 'qty: 300 kg');
eq(qty?.unit, 'kg', 'qty unit: kg');

// ---------------------------------------------------------------------------
// 2 · fastPath.ts — instant commands, and NOTHING else (anti-stock-collapse)
// ---------------------------------------------------------------------------
import { tryFastPath, tryFastPathTax } from '../src/lib/voice/fastPath.ts';

const cashHit = tryFastPath('کتنا کیش ہے');
eq(cashHit?.action, 'query', 'fast: کتنا کیش ہے → query');
eq(cashHit?.topic, 'cash', 'fast: کتنا کیش ہے → cash');
eq(tryFastPath('cash balance')?.topic, 'cash', 'fast: cash balance → cash');
eq(tryFastPath('dashboard kholo')?.action, 'navigate', 'fast: dashboard kholo → navigate');
eq(tryFastPath('ڈیش بورڈ کھولو')?.module ?? tryFastPath('ڈیش بورڈ کھولو')?.entities.module, 'dashboard', 'fast: ڈیش بورڈ → dashboard module');
eq(tryFastPath('اب کیا حال ہے دوست')?.action ?? null, null, 'fast: random chatter → null (escalates to mind)');
const taxHit = tryFastPathTax('1 lakh ki sale par tax kitna');
eq(taxHit?.topic, 'sale_tax', 'fast-tax: 1 lakh sale tax');
eq(taxHit?.entities.amount, 100000, 'fast-tax: amount extracted');

// ---------------------------------------------------------------------------
// 3 · mind.ts — prompt builder + response parser (pure, no network)
// ---------------------------------------------------------------------------
import { buildMindPrompt, parseMindResponse } from '../src/lib/voice/mind.ts';

const digest = {
  businessName: 'Al-Noor Textile Mills',
  customers: [{ name: 'Sabir Textile Mills', city: 'Faisalabad', balance: 25000 }],
  suppliers: [{ name: 'National Spinning Mills', city: 'Lahore' }],
  products: [{ name: 'Combed Cotton Yarn 30/1', sku: 'YRN-30', unit: 'kg', stock: 120 }]
};

const prompt = buildMindPrompt(digest);
ok(prompt.includes('Sabir Textile Mills'), 'mind prompt: customer digest embedded');
ok(prompt.includes('YRN-30'), 'mind prompt: product SKU embedded');
ok(prompt.includes('JSON only'), 'mind prompt: JSON-only contract');

// The canonical regression: a free-form sale sentence parsed by the mind.
const saleJson = JSON.stringify({
  action: 'create_sale',
  topic: null,
  entities: { party: 'Sabir Textile Mills', product: 'Combed Cotton Yarn 30/1', quantity: 50, unit: 'kg', amount: 64900, period: null, module: null, document: null },
  confidence: 0.94,
  clarification: null
});
const saleIntent = parseMindResponse(saleJson);
eq(saleIntent?.action, 'create_sale', 'mind parse: create_sale action');
eq(saleIntent?.entities.party, 'Sabir Textile Mills', 'mind parse: party bound');
eq(saleIntent?.entities.quantity, 50, 'mind parse: quantity');
eq(saleIntent?.confidence, 0.94, 'mind parse: confidence kept');

// Prose-wrapped JSON must still parse.
const wrapped = parseMindResponse('Here is the JSON: {"action":"query","topic":"cash","entities":{},"confidence":0.9,"clarification":null}');
eq(wrapped?.topic, 'cash', 'mind parse: prose-wrapped JSON tolerated');

// Garbage must return null (drives the strict retry); invalid action coerces to 'unknown'.
eq(parseMindResponse('Sorry, I did not understand.'), null, 'mind parse: prose-only → null');
ok(parseMindResponse('{"action":"warp_drive"}')?.action === 'unknown', 'mind parse: unknown action coerced to "unknown"');

// Low confidence → clarify flag handled by understand() (tested via executor below).
const lowJson = parseMindResponse('{"action":"create_sale","topic":null,"entities":{"party":null},"confidence":0.3,"clarification":"کس گاہک کو؟"}');
eq(lowJson?.confidence, 0.3, 'mind parse: low confidence preserved');
eq(lowJson?.clarification, 'کس گاہک کو؟', 'mind parse: clarification preserved');

// ---------------------------------------------------------------------------
// 4 · executor.ts — queries compute from state; spoken answers are minimal
// ---------------------------------------------------------------------------
import { executeQuery, resolveParty, inPeriod } from '../src/lib/voice/executor.ts';

const state = {
  cashbook: [
    { type: 'inflow', amount: 60000, createdAt: new Date().toISOString() },
    { type: 'outflow', amount: 15000, createdAt: new Date().toISOString() }
  ],
  salesOrders: [{ totalAmount: 64900, taxAmount: 9900, createdAt: new Date().toISOString() }],
  products: [
    { name: 'Yarn 30/1', currentStock: 40, reorderThreshold: 50, costPrice: 500, unit: 'kg' },
    { name: 'Yarn 40/2', currentStock: 200, reorderThreshold: 50, costPrice: 700, unit: 'kg' }
  ],
  customers: [
    { name: 'Sabir Textile Mills', outstandingReceivables: 25000 },
    { name: 'Gul Ahmed', outstandingReceivables: 40000 }
  ],
  suppliers: [{ name: 'National Spinning Mills' }],
  purchaseOrders: [{ status: 'pending', totalAmount: 85000, poNumber: 'PO-1001', supplierName: 'National Spinning Mills' }]
};

const cashRes = executeQuery({ action: 'query', topic: 'cash', entities: {}, confidence: 1, clarification: null, source: 'fast' }, state);
eq(cashRes?.kind, 'query', 'executor: cash → query');
eq(cashRes?.spoken.includes('45,000') || cashRes?.spoken.includes('45000'), true, 'executor: cash spoken contains net 45,000');
eq(cashRes?.stats.length, 3, 'executor: cash stat card has 3 stats');

const gstRes = executeQuery({ action: 'query', topic: 'gst', entities: {}, confidence: 1, clarification: null, source: 'fast' }, state);
eq(gstRes?.spoken.includes('9,900') || gstRes?.spoken.includes('9900'), true, 'executor: gst spoken contains 9,900');

const arParty = executeQuery(
  { action: 'query', topic: 'receivables', entities: { party: 'Sabir' }, confidence: 1, clarification: null, source: 'mind' },
  state
);
eq(arParty?.spoken.includes('Sabir'), true, 'executor: party-scoped AR names the party');
eq(arParty?.spoken.includes('25,000') || arParty?.spoken.includes('25000'), true, 'executor: party AR contains 25,000');
eq(resolveParty('sabir', state)?.name, 'Sabir Textile Mills', 'resolveParty: partial match');
eq(resolveParty(null, state), null, 'resolveParty: null → null');

const arTotal = executeQuery({ action: 'query', topic: 'receivables', entities: {}, confidence: 1, clarification: null, source: 'fast' }, state);
eq(arTotal?.spoken.includes('65,000') || arTotal?.spoken.includes('65000'), true, 'executor: total AR = 65,000');

const pl = executeQuery({ action: 'query', topic: 'profit_loss', entities: { period: 'this_month' }, confidence: 1, clarification: null, source: 'mind' }, state);
// revenue ex-GST 55,000 − expenses 15,000 = 40,000 profit
eq(pl?.spoken.includes('40,000') || pl?.spoken.includes('40000'), true, 'executor: P&L this month = 40,000 profit');

const inv = executeQuery({ action: 'query', topic: 'inventory', entities: {}, confidence: 1, clarification: null, source: 'fast' }, state);
eq(inv?.spoken.includes('ری آرڈر') || inv?.spoken.includes('1'), true, 'executor: inventory flags 1 low item');

const tax = executeQuery({ action: 'query', topic: 'sale_tax', entities: { amount: 100000 }, confidence: 1, clarification: null, source: 'fast' }, state);
eq(tax?.spoken.includes('18,000') || tax?.spoken.includes('18000'), true, 'executor: sale tax 18% of 100k = 18,000');

const unknown = executeQuery({ action: 'query', topic: null, entities: {}, confidence: 0.9, clarification: null, source: 'mind' }, state);
eq(unknown?.kind, 'clarify', 'executor: null topic → clarify (never stock)');

const clarify = executeQuery(
  { action: 'unknown', topic: null, entities: {}, confidence: 0.4, clarification: 'کس گاہک کو؟', source: 'clarify' },
  state
);
eq(clarify?.spoken, 'کس گاہک کو؟', 'executor: clarification spoken verbatim');

ok(inPeriod(new Date().toISOString(), 'today'), 'inPeriod: today true for now');
ok(!inPeriod(new Date(2020, 0, 1).toISOString(), 'this_month'), 'inPeriod: 2020 not this month');

// ---------------------------------------------------------------------------
// 5 · Extended: Roman Urdu sale sentences, period words, supplier payments
// ---------------------------------------------------------------------------

// — Roman Urdu sale sentences (mind path — parse-level assertions) —
const romanSale1 = parseMindResponse(JSON.stringify({
  action: 'create_sale', topic: null,
  entities: { party: 'Gul Ahmed', product: 'Yarn 30/1', quantity: 75, unit: 'kg', amount: 88000, period: null, module: null, document: null },
  confidence: 0.91, clarification: null
}));
eq(romanSale1?.action, 'create_sale', 'roman sale: action');
eq(romanSale1?.entities.quantity, 75, 'roman sale: quantity 75');
eq(romanSale1?.entities.unit, 'kg', 'roman sale: unit kg');

const romanSale2 = parseMindResponse(JSON.stringify({
  action: 'create_sale', topic: null,
  entities: { party: 'Sabir Textile Mills', product: null, quantity: 200, unit: 'bags', amount: null, period: null, module: null, document: null },
  confidence: 0.88, clarification: null
}));
eq(romanSale2?.entities.quantity, 200, 'roman sale: 200 bags qty');
ok(romanSale2?.entities.amount === null, 'roman sale: absent amount stays null (never guessed)');

// — Period words («پچھلے مہینے», last month, fiscal year) —
const plLastMonth = executeQuery(
  { action: 'query', topic: 'profit_loss', entities: { period: 'last_month' }, confidence: 1, clarification: null, source: 'mind' },
  state
);
ok(plLastMonth?.spoken.length > 0, 'period: last_month P&L returns spoken');
ok(plLastMonth?.title.includes('Profit'), 'period: last_month P&L card titles');

const dayBookPeriod = executeQuery(
  { action: 'query', topic: 'day_book', entities: { period: 'today' }, confidence: 1, clarification: null, source: 'mind' },
  state
);
ok(dayBookPeriod?.spoken.includes('آج'), 'period: day_book spoken anchors to آج');

// inPeriod boundary cases: month edges
const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
ok(inPeriod(monthStart.toISOString(), 'this_month'), 'inPeriod: 1st of month is this_month');
const lastMonthDay = new Date(); lastMonthDay.setMonth(lastMonthDay.getMonth() - 1);
ok(!inPeriod(lastMonthDay.toISOString(), 'this_month'), 'inPeriod: last month day is NOT this_month');
ok(inPeriod(lastMonthDay.toISOString(), 'last_month'), 'inPeriod: last month day IS last_month');

// — Supplier payment phrasings: resolveParty must bind suppliers —
const suppState = { ...state, suppliers: [{ name: 'National Spinning Mills', pendingCommitment: 85000 }] };
const suppHit = resolveParty('national', suppState);
eq(suppHit?.name, 'National Spinning Mills', 'supplier resolve: partial “national”');
eq(suppHit?.role, 'supplier', 'supplier resolve: role=supplier');
eq(suppHit?.balance, 85000, 'supplier resolve: pending commitment as balance');

const suppQuery = executeQuery(
  { action: 'query', topic: 'receivables', entities: { party: 'National' }, confidence: 1, clarification: null, source: 'mind' },
  suppState
);
ok(suppQuery?.spoken.includes('ادا کرنے ہیں'), 'supplier AP phrasing: «ادا کرنے ہیں» spoken');
ok(suppQuery?.title.includes('Payable'), 'supplier AP card titled Payable');

// Customer still wins when both registries could match (AR-first).
const bothHit = resolveParty('sabir', { ...suppState, suppliers: [{ name: 'Sabir Traders', pendingCommitment: 1000 }] });
eq(bothHit?.role, 'customer', 'resolve precedence: customer wins over same-name supplier');

// — Amount extraction from Roman payment phrasings —
eq(extractAmount('national ko 2 lakh ka payment'), 200000, 'amount: roman “2 lakh ka payment”');
eq(extractAmount('suppliers ko pichhle mahine 50 hazar adaa kiya'), 50000, 'amount: “50 hazar adaa kiya”');
eq(extractAmount('پچاس ہزار کا واؤچر'), 50000, 'amount: Urdu «پچاس ہزار کا واؤچر»');

// — Fast-path must NOT swallow write phrasings (they need the mind) —
ok(tryFastPath('sale karni hai 50 kg') === null, 'fast-path: sale sentence escalates to mind');
ok(tryFastPath('supplier ko payment karni hai') === null, 'fast-path: supplier payment escalates to mind');
ok(tryFastPath('national ko 50000 ka voucher banao') === null, 'fast-path: voucher creation escalates to mind');

// — Fast-path negation guards stay correct —
ok(tryFastPath('stock kitna hai') === null || tryFastPath('stock kitna hai')?.topic !== 'cash', 'fast-path: stock question never routes to cash');

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`\n=== VOICE MIND FIXTURES: ${passed} passed, ${failed} failed ===`);
if (failures.length) {
  console.log('\nFAILURES:');
  failures.forEach(f => console.log('  ✗ ' + f));
  process.exit(1);
}
