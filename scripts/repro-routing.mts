/**
 * Repro harness — drives the REAL supervisor with the phrasings that were
 * reported as failing, and prints the routed intent plus the reply so routing
 * is visible instead of inferred. Diagnostic only; not imported by the app.
 *
 * Run: `npx tsx scripts/repro-routing.mts`
 *
 * NOTE: intent comes from `analyzeUserIntent`, NOT from the supervisor result
 * — `SupervisorProcessResult` carries no intent field, so reading it yields
 * `undefined` and makes every phrase look like a hit.
 */
import { executeSupervisorTurn, analyzeUserIntent } from '../src/lib/agentSupervisor.ts';
import { DEMO_PRODUCTS, DEMO_CUSTOMERS, DEMO_SUPPLIERS } from '../src/data/fixtures.ts';
import type { DatabaseState } from '../src/lib/businessTools.ts';

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

/** The intent each phrasing MUST reach to be considered correctly handled. */
const CASES: { phrase: string; want: string }[] = [
  { phrase: 'add sale to noor mills of this item', want: 'record_sale' },
  { phrase: 'noor mills ko sale add karo', want: 'record_sale' },
  { phrase: 'noor mills ko is item ki sale karo', want: 'record_sale' },
  { phrase: 'is item ki sale noor mills ko kar do', want: 'record_sale' },
  { phrase: 'نور ملز کو اس آئٹم کی سیل کریں', want: 'record_sale' },
  { phrase: 'نور ملز کو سیل کریں', want: 'record_sale' },
  { phrase: 'sell to noor mills', want: 'record_sale' },
  { phrase: 'new customer add karo rahim mills', want: 'add_customer' },
  { phrase: 'add customer rahim mills', want: 'add_customer' },
  { phrase: 'نیا کسٹمر شامل کریں', want: 'add_customer' },
  { phrase: 'new supplier add karo', want: 'add_supplier' },
  { phrase: 'supplier add karo', want: 'add_supplier' },
  { phrase: 'نیا سپلائر شامل کریں', want: 'add_supplier' }
];

const state = demoState();
let ok = 0;
const broken: string[] = [];

for (const { phrase, want } of CASES) {
  const got = analyzeUserIntent(phrase, state).intent;
  const r = await executeSupervisorTurn(phrase, state);
  const hit = got === want;
  if (hit) ok++;
  else broken.push(`${phrase}\n      want=${want} got=${got}`);
  console.log(`${hit ? 'OK  ' : 'FAIL'} want=${want.padEnd(13)} got=${got.padEnd(22)} | ${phrase}`);
  console.log(`     reply: ${r.message.content.replace(/\s+/g, ' ').slice(0, 96)}`);
}

console.log(`\nROUTED_CORRECTLY=${ok}/${CASES.length} BROKEN=${broken.length}`);
if (broken.length) {
  console.log('\nBROKEN CASES:');
  for (const b of broken) console.log(`  - ${b}`);
}
process.exit(broken.length ? 1 : 0);