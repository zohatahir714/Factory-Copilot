/**
 * Coverage smoke — measures how wide the copilot actually is, across three
 * languages and every command class. Diagnostic only; not imported by the app.
 *
 * Run: `npx tsx scripts/repro-coverage.mts`
 *
 * HONESTY NOTE: this prints the phrases that still fall to the refusal. The
 * point is to see the gaps, not to report a clean sheet.
 */
import { analyzeUserIntent, executeSupervisorTurn } from '../src/lib/agentSupervisor.ts';
import { DEMO_PRODUCTS, DEMO_CUSTOMERS, DEMO_SUPPLIERS } from '../src/data/fixtures.ts';
import type { DatabaseState } from '../src/lib/businessTools.ts';

function demoState(): DatabaseState {
  return {
    products: DEMO_PRODUCTS, suppliers: DEMO_SUPPLIERS, customers: DEMO_CUSTOMERS,
    purchaseOrders: [], salesOrders: [], cashbook: [], inventoryMovements: [], complianceSources: []
  } as unknown as DatabaseState;
}

const CASES: [string, string][] = [
  // sale
  ['add sale to Noor Mills of this item', 'record_sale'],
  ['is item ki sale Noor Mills ko kar do', 'record_sale'],
  ['Noor Mills ko sale add karo', 'record_sale'],
  ['sale of 50 kg cotton yarn', 'record_sale'],
  ['50 kg yarn becho', 'record_sale'],
  ['نور ملز کو سیل کریں', 'record_sale'],
  // purchase
  ['100 kg cotton yarn ka purchase order banao', 'create_purchase_order'],
  ['Green Mills se 100 kg cotton yarn khareedna hai', 'create_purchase_order'],
  ['پرچیز آرڈر بنا دو', 'create_purchase_order'],
  // parties
  ['supplier add karo', 'add_supplier'],
  ['add supplier Nova Chemicals', 'add_supplier'],
  ['vendor register karo', 'add_supplier'],
  ['customer add karo', 'add_customer'],
  ['add customer Al-Karam Karachi', 'add_customer'],
  ['نیا کسٹمر شامل کریں', 'add_customer'],
  ['نیا سپلائر شامل کریں', 'add_supplier'],
  // product
  ['add product Silk Fabric', 'add_product'],
  ['naya product banao', 'add_product'],
  ['new material add karo', 'add_product'],
  // reads
  ['pending purchase orders', 'get_pending_orders'],
  ['how much cash do I have', 'get_cash_balance'],
  ['total receivables', 'get_receivables'],
  ['total payables', 'get_payables'],
  ['business summary', 'get_business_summary'],
  ['how much cotton yarn stock is there', 'check_inventory'],
  ['is cotton yarn in stock', 'check_inventory'],
  // "stock report" answers with the stock list rather than opening a print
  // dialog. Correct as a READ; noted here because printing is a separate verb.
  ['stock report', 'check_inventory'],
  // receive / expense
  ['pending goods receive karo', 'receive_goods'],
  ['record expense 5000 on fuel', 'record_expense'],
  ['expense likho 5000 rent', 'record_expense'],
  // navigation
  ['open dashboard', 'navigate'],
  ['go to products', 'navigate'],
  ['open cashbook', 'navigate'],
  ['go to sales', 'navigate'],
  ['open the copilot', 'navigate']
];

const state = demoState();
let ok = 0;
const wrong: string[] = [];

for (const [phrase, want] of CASES) {
  const got = analyzeUserIntent(phrase, state).intent;
  if (got === want) { ok++; console.log(`OK   ${want.padEnd(22)} | ${phrase}`); }
  else {
    wrong.push(`want=${want} got=${got} | ${phrase}`);
    console.log(`FAIL ${want.padEnd(22)} got=${got.padEnd(20)} | ${phrase}`);
  }
}

console.log(`\n=== COVERAGE ${ok}/${CASES.length} (${Math.round(ok / CASES.length * 100)}%) ===`);
if (wrong.length) { console.log('GAPS:'); wrong.forEach(w => console.log('  - ' + w)); }

// Show the live reply for the worst gap so it is not just a label.
for (const w of wrong.slice(0, 3)) {
  const phrase = w.split('| ')[1];
  const r = await executeSupervisorTurn(phrase, state);
  console.log(`\n"${phrase}" -> ${r.message.content.replace(/\s+/g, ' ').slice(0, 120)}`);
}
process.exit(wrong.length ? 1 : 0);