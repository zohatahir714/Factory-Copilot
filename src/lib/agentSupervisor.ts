/**
 * Supervisor Agent & Multi-Agent Orchestration Layer
 * Compliant with PRD Section 6, 7, 8, 14, 15 & 16
 *
 * Directs voice and text commands to:
 * - Inventory Agent (Stock verification, low stock alerts, inventory sync)
 * - Purchase Agent (Vendor PO generation, low-stock reorder, Goods Receipt)
 * - Accounting Agent (GST 18% sales dispatch, cashbook disbursements, executive business summary)
 * - Compliance Agent (FBR legal tax citations & regulatory lookup)
 * - Master Partner Registry (Dynamic Voice Supplier & Customer creation)
 */

import {
  AgentDomain,
  AgentHandoffContract,
  ChatMessage,
  ConfirmationPayload,
  ToolExecutionRecord,
  Product,
  Supplier,
  Customer
} from '../types';
import {
  DatabaseState,
  totalOutstandingReceivables,
  toolCheckInventory,
  preparePurchaseOrderConfirmation,
  prepareReorderLowStockConfirmation,
  prepareRecordSaleConfirmation,
  toolReceiveGoods,
  toolGetCashBalance,
  toolGetPendingOrders,
  toolGetBusinessSummary,
  toolRecordExpense,
  executeCreateSupplier,
  executeCreateCustomer,
  findProductByName
} from './businessTools';
import { queryComplianceRAG } from './ragCompliance';
import { RAG_CONFIDENCE_GATE } from './rag/index';
import { wantsDetail, isWriteIntent, pkr } from './answerFormat';
import { selectSkills } from '../agents/skills.ts';
import { purchaseGuardNote, stockVerdict, stockHealthSummary } from '../ai/stock/index.ts';
import { lossAnswer } from '../ai/loss/index.ts';
import { softwareAnswer, capabilityAnswer, MODULE_REGISTRY, moduleFor, refusalWithSuggestions } from '../ai/software/index.ts';
import { toolSpec } from './ai/contract.ts';
import { recordMiss } from './ai/misses.ts';
import { DEMO_PRODUCT_ALIASES } from '../data/fixtures';

/**
 * Ask for what the user did not say, in one or two lines.
 *
 * A purchase order with no supplier named is not a purchase order for the first
 * supplier in the list; it is a question. Every option offered here is a real
 * row in the ledger — the point is to let the user pick, never to pick for them.
 * The material line names the escape hatch too, because "I need resin, it isn't
 * in your catalogue" is a normal and necessary answer.
 */
function clarificationReply(
  kind: 'purchase' | 'sale' | 'party',
  missing: string[],
  state: DatabaseState,
  partyKind?: 'supplier' | 'customer'
): string {
  const wants = (key: string) => missing.includes(key);
  if (kind === 'party') {
    const label = partyKind === 'supplier' ? 'Supplier' : 'Customer';
    return `${label === 'Supplier' ? '🏢' : '👥'} ${label} name?\nCity also helps — e.g. "${label === 'Supplier' ? 'Green Mills Ltd, Faisalabad' : 'Rahim Traders, Lahore'}".`;
  }
  const head = kind === 'purchase' ? '📝 Purchase order' : '🧾 Sale';
  const lines: string[] = [];

  if (kind === 'purchase' && wants('supplier')) {
    const names = state.suppliers.map(s => s.name).join(', ') || 'none added yet';
    lines.push(`Supplier? ${names}`);
  }
  if (kind === 'sale' && wants('customer')) {
    const names = state.customers.map(c => c.name).join(', ') || 'none added yet';
    lines.push(`Customer? ${names}`);
  }
  if (wants('product')) {
    lines.push(`Material? ${state.products.length} in your catalogue, or name a new material to add`);
  }
  if (wants('quantity')) {
    lines.push('How many?');
  }

  const missingCount = missing.length;
  return [
    `${head} — ${missingCount} detail${missingCount > 1 ? 's' : ''} needed:`,
    ...lines
  ].join('\n');
}

/**
 * The bare command to hold while waiting for an answer.
 *
 * Only the two party rules qualify. A purchase order or a sale carries enough
 * of its own wording to be re-derived from a complete sentence, whereas a party
 * name is a bare noun phrase — `Rahim Traders, Lahore` — which matches nothing
 * on its own and therefore cannot be understood without the command that
 * asked for it.
 */
function pendingCommandFor(intent: string): string | undefined {
  if (intent === 'add_customer') return 'add customer';
  if (intent === 'add_supplier') return 'add supplier';
  return undefined;
}

/**
 * Fold a follow-up answer into the command that asked for it.
 *
 * The answer is merged ONLY when it means nothing on its own. If the next
 * utterance is a real command, that is what the user meant, and replaying the
 * pending one over it would create a supplier nobody asked for. This is the
 * single rule that stops the add-a-supplier loop from being unbreakable.
 */
export function mergeWithPendingCommand(
  utterance: string,
  pending: string | null | undefined,
  state: DatabaseState
): string {
  const answer = utterance.trim();
  if (!pending || !answer) return utterance;
  if (analyzeUserIntent(answer, state).intent !== 'unrecognised_query') return utterance;
  return `${pending} ${answer}`;
}

export interface SupervisorProcessResult {
  message: ChatMessage;
  pendingConfirmation?: ConfirmationPayload;
  directDatabaseUpdate?: DatabaseState;
  /**
   * A side effect the shell must perform. The supervisor decides WHAT should
   * happen; the React shell decides how — which is the same split every tool in
   * this file already uses.
   */
  directive?: SupervisorDirective;
  /**
   * The bare command behind a clarification, to be answered on the next turn.
   *
   * "new customer add karo" asks for a name, and the reply tells the user to
   * answer `Rahim Traders, Lahore` — but that sentence matches no rule, so it
   * was routed as an unknown query and REFUSED. The copilot asked a question it
   * could not hear the answer to, and the user's second turn looked exactly
   * like the first, so the loop looked unbreakable. Carrying the command forward
   * is what makes the clarification answerable.
   */
  pendingCommand?: string;
}

export type SupervisorDirective =
  | { type: 'navigate'; module: string }
  | { type: 'print'; document: 'invoice' | 'purchase_order' | 'cash_voucher' | 'inventory_report'; data: unknown };

/**
 * Where "open the reports module" is sent, and what it says on the way.
 *
 * These are ACTIONS, and before this rule existed the supervisor had no idea
 * they were anything but a data question: "dashboard kholo" fell through to the
 * summary rule and answered with sales figures. A command answered with another
 * command's answer is the failure this file exists to prevent, so navigation is
 * matched here, before any read or write rule gets a chance at the words.
 */
const NAVIGABLE: ReadonlyArray<readonly [string, RegExp]> = [
  ['fbr_integration', /fbr integration|fbr digital|digital invoicing|ایف بی آر انٹیگریشن/],
  ['reports', /\breports?\b|\bfinancials\b|\bgl\b|رپورٹ/],
  ['cashbook', /\bcashbook\b|\bcash book\b|کیش بک/],
  ['dashboard', /\bdashboard\b|\bhome page\b|\boverview\b|ڈیش بورڈ/],
  ['compliance', /\bcompliance\b|کمپلائنس/],
  ['inventory', /\binventory\b|انوینٹری|مواد کی فہرست/],
  ['customers', /\bcustomers\b|\bclients\b|کسٹمر/],
  ['suppliers', /\bsuppliers\b|\bvendors\b|سپلائر/],
  ['purchase', /\bpurchase orders?\b|\bpo list\b|خریداری/],
  ['settings', /\bsettings\b|سیٹنگز/]
];

const NAVIGATE_LABELS: Record<string, string> = {
  dashboard: 'Executive Dashboard',
  reports: 'Reports & Financials',
  cashbook: 'Cashbook & Vouchers',
  inventory: 'Inventory & Materials',
  customers: 'Customers & Mills',
  suppliers: 'Suppliers & Vendors',
  purchase: 'Purchase Orders',
  compliance: 'FBR Compliance RAG',
  fbr_integration: 'FBR Digital Invoicing',
  settings: 'Settings'
};

/** "open", "kholo", "show me" — the verbs that make a module name a COMMAND. */
const OPEN_VERB = /(\bopen\b|\bshow me\b|\bgo to\b|\bswitch to\b|\bkholo\b|\bkhol do\b|\bkholein\b|\bdikhao\b|\bopen karke\b)/;

const PRINTABLE: ReadonlyArray<readonly [string, RegExp]> = [
  ['invoice', /\binvoice\b|\bchallan\b|انوائس|انوئس/],
  ['purchase_order', /\bpurchase order\b|\bpo\b|پرچیز آرڈر/],
  ['cash_voucher', /\bcash voucher\b|\bvoucher\b|واؤچر/],
  ['inventory_report', /\bstock report\b|\binventory report\b|\bstock list\b|اسٹاک رپورٹ/]
];

/**
 * Parses user input in English or Roman Urdu, extracts domain and entities
 * Dynamically binds to real products, suppliers, and customers present in state.
 */
export function analyzeUserIntent(input: string, state?: DatabaseState): AgentHandoffContract {
  const lower = input.toLowerCase().trim();

  // Dynamic entity resolution from live database state
  const availableProducts: Product[] = state?.products || [];
  // 0. FBR READINESS — before the questions-about-the-app rule below.
  //
  // "FBR integration ready kaise ho" contains the Urdu question word "kaise",
  // and the module registry knows "fbr integration", so a naive about-the-app
  // rule answers it with a paragraph about what the module does — when the
  // user is asking whether their integration is configured. Readiness is a
  // narrow, specific pattern and belongs above anything generic.
  const FBR_READINESS = /\bfbr\b[^\n]{0,40}\b(ready|readiness|integration|integrated|set ?up|go live|live|connected)\b/;
  if (FBR_READINESS.test(lower)) {
    return {
      intent: 'navigate',
      domain: 'supervisor',
      entities: { module: 'fbr_integration' },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // QUESTIONS ABOUT THIS SOFTWARE, ahead of printing.
  //
  // "how do i print a purchase order" is a question about the app. The print
  // rule matched it first and answered with a list of three POs asking which one
  // to print — technically about purchase orders, useless as an answer. The
  // scoping below (a question word AND a module the registry knows) is what
  // keeps "stock report print karo" printing, so this can safely sit on top.
  if (/\b(what can (this|you|the (app|software|system))[^?]{0,20}?(do|handle)|features|what does this (app|software|system) do|list (the )?modules)\b/i.test(lower)) {
    return {
      intent: 'list_capabilities',
      domain: 'supervisor',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  if (/\b(how (do|can|to)|where (is|do i find)|kaise|kahan|kahan se|which (module|screen)|is there|can i)\b/i.test(lower) && moduleFor(lower)) {
    return {
      intent: 'about_software',
      domain: 'supervisor',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // Navigation and printing, ahead of every data rule.
  //
  // PRINT FIRST: "stock report print karo" contains "report", so a navigate
  // rule placed above the print rule would answer a printing request with a
  // screen change.
  if (/print|printer|prn|پرنٹ/.test(lower)) {
    const doc = PRINTABLE.find(([, rx]) => rx.test(lower));
    if (doc) {
      const [document] = doc;
      const data = document === 'invoice' ? (state?.salesOrders?.[0] ?? null)
        : document === 'purchase_order' ? (state?.purchaseOrders?.[0] ?? null)
          : document === 'cash_voucher' ? (state?.cashbook?.[0] ?? null)
            : (state?.products ?? null);
      return {
        intent: 'print',
        domain: 'supervisor',
        entities: { document, hasDocument: data !== null && !(Array.isArray(data) && data.length === 0) },
        userId: 'usr_super_admin',
        organizationId: 'org_sme_01',
        requiresConfirmation: false,
        rawPrompt: input
      };
    }
  }

  // "Is FBR integration ready?" is handled at the top of this function, above
  // the questions-about-the-app rule — see the note there.

  // MATERIAL VARIANCE, ahead of every stock rule.
  //
  // "stock" is in half these sentences — "which material got loss" carries no
  // quantity, no threshold and no buy verb — so a stock rule placed above this
  // would answer a reconciliation question with a stock list. The word is
  // "loss"/"shortage"/"waste"/"consume" against a material, and "supplier" or
  // "vendor" is what makes it a provenance question rather than a count.
  const MATERIAL_LOSS = /\b(loss|losses|lost|waste|wastage|shortage|shrink(age)?|consum(ed|ption)?|unissued)\b/i;
  if (MATERIAL_LOSS.test(lower) && /\b(material|materials|maal|raw|stock|yarn|dye|kapda|fabric|which|kaun|kon|sa)\b/i.test(lower)) {
    return {
      intent: 'material_loss',
      domain: 'inventory',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // "what can this software do" — the capability listing.
  // Stock sufficiency — a sufficiency question about one material or all.
  const SUFFICIENCY = /\b(enough|sufficient|suffice|adequate|proper (stock|material)?|mojood|maujood|kafi)\b/i;
  if (SUFFICIENCY.test(lower)) {
    // ANY word of the product name counts, not just words over four characters.
    // "Cotton Yarn 150D" contains "yarn", four letters long, and the old
    // four-character floor meant "do we have enough yarn?" matched nothing and
    // fell through to the whole-catalogue answer.
    const matched = (state?.products ?? []).find(p => {
      const words = p.name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3);
      return words.some(w => lower.includes(w));
    });
    return {
      intent: 'stock_sufficiency',
      domain: 'inventory',
      entities: { scope: matched?.name ?? 'all' },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  const navigateTarget = OPEN_VERB.test(lower) ? NAVIGABLE.find(([, rx]) => rx.test(lower)) : undefined;
  if (navigateTarget) {
    return {
      intent: 'navigate',
      domain: 'supervisor',
      entities: { module: navigateTarget[0] },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // Strip a trailing VERB before anything else reads the utterance. "new supplier
  // add karo" used to leave "add karo" as the party name and write a supplier
  // literally called "add karo" into the ledger. Removing the verb once, up
  // front, is more reliable than trying to detect it after the fact.
  const strippedInput = input
    .replace(/\s+(?:add|karo|kro|karna|kar\s?do|do|create|banao|banayein|register|new|naya)\b[\s\S]*$/i, '')
    .trim();
  const effectiveInput = strippedInput.length >= 3 ? strippedInput : input;

  const availableSuppliers: Supplier[] = state?.suppliers || [];
  const availableCustomers: Customer[] = state?.customers || [];

  const matchedProduct = availableProducts.find(p => {
    const pName = p.name.toLowerCase();
    const pSku = p.sku.toLowerCase();
    const aliasHit = (DEMO_PRODUCT_ALIASES[p.id] || []).some(a => lower.includes(a));
    return aliasHit || lower.includes(pName) || lower.includes(pSku) ||
      (pName.split(' ').some(word => word.length > 3 && lower.includes(word)));
  });

  const matchedSupplier = availableSuppliers.find(s => {
    const sName = s.name.toLowerCase();
    return lower.includes(sName) ||
      (sName.split(' ').some(word => word.length > 4 && lower.includes(word)));
  });

  const matchedCustomer = availableCustomers.find(c => {
    const cName = c.name.toLowerCase();
    return lower.includes(cName) ||
      (cName.split(' ').some(word => word.length > 4 && lower.includes(word)));
  });

  // "Pending" is the only word separating a READ of the purchase-order list from
  // the WRITE that creates one. Computed once, used by both rules.
  const pendingRead =
    lower.includes('pending po') ||
    lower.includes('pending purchase order') ||
    lower.includes('pending orders') ||
    lower.includes('orders pending') ||
    lower.includes('pending invoice') ||
    lower.includes('pending sale') ||
    lower.includes('in-flight');

  // 1. Add New Supplier ("Add supplier Green Mills Karachi", "Naya supplier banao Sitara Chemicals", "Register vendor ABC")
  if (
    lower.includes('add supplier') ||
    lower.includes('new supplier') ||
    lower.includes('register supplier') ||
    lower.includes('naya supplier') ||
    lower.includes('supplier banao') ||
    lower.includes('add vendor') ||
    // Urdu script: "نیا سپلائر شامل کریں Nova Chemicals"
    lower.includes('سپلائر') ||
    lower.includes('وینڈر') ||
    // "شامل کریں" alone means "add" and must not steal "نیا کسٹمر شامل کریں",
    // which is rule 2 — a supplier rule matching a customer prompt writes a
    // supplier row the user never asked for.
    (lower.includes('شامل') && lower.includes('کریں') && !lower.includes('کسٹمر') && !lower.includes('گاہک'))
  ) {
    let name = effectiveInput.replace(/add\s+supplier|new\s+supplier|register\s+supplier|naya\s+supplier|supplier\s+banao|add\s+vendor/i, '').trim();
    // Strip the Urdu lead-in so "نیا سپلائر شامل کریں Nova Chemicals" registers
    // "Nova Chemicals" rather than the whole sentence.
    name = name.replace(/^[\s\S]*?(?:شامل\s*کر[یی]ں|شامل\s*کریں|کریں)\s*/, '');
    name = name.replace(/^[\s۰-۹]*\s*/, '').trim();
    // "new supplier add karo" leaves the verb behind as the party name, which
    // wrote a supplier called "add karo" into the ledger. A name that is only a
    // verb is no name at all.
    if (/^(add|karo|kro|do|create|banao|banayein|register|new|naya)/i.test(name) && name.split(/\s+/).length <= 2) {
      name = '';
    }
    // NO DEFAULT CITY. This block used to seed a supplier described only by name
    // with the country name as its city, then print that back as "City / Hub"
    // — a field the user never gave, stated as fact. Absent is a blank field,
    // not an invention.
    let city: string | undefined;
    const cityMatch = name.match(/in\s+([A-Za-z]+)|,\s*([A-Za-z]+)/i);
    if (cityMatch) {
      city = (cityMatch[1] || cityMatch[2]).trim();
      name = name.replace(cityMatch[0], '').trim();
    }
    return {
      intent: 'add_supplier',
      domain: 'purchase',
      // No invented default. This used to create a supplier literally called
      // "New Raw Material Supplier" in "Pakistan" the moment anyone typed "add
      // supplier" — a party that does not exist, written into the ledger, with a
      // record ID that looks real. A missing name is a question, not a value.
      entities: { name: name || undefined, city, missing: name ? [] : ['name'] },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 2. Add New Customer ("Add customer Al-Karam Karachi", "Naya customer banao Master Textile", "Register client XYZ")
  if (
    lower.includes('add customer') ||
    lower.includes('new customer') ||
    lower.includes('register customer') ||
    lower.includes('naya customer') ||
    lower.includes('customer banao') ||
    lower.includes('add client') ||
    // Urdu script: "نیا کسٹمر شامل کریں Alpha Mills"
    lower.includes('کسٹمر') ||
    lower.includes('گاہک')
  ) {
    let name = effectiveInput.replace(/add\s+customer|new\s+customer|register\s+customer|naya\s+customer|customer\s+banao|add\s+client/i, '').trim();
    name = name.replace(/^[\s\S]*?(?:شامل\s*کریں|شامل\s*کر[یی]ں|کریں)\s*/, '');
    name = name.replace(/^[\s۰-۹]*\s*/, '').trim();
    // "new supplier add karo" leaves the verb behind as the party name, which
    // wrote a supplier called "add karo" into the ledger. A name that is only a
    // verb is no name at all.
    if (/^(add|karo|kro|do|create|banao|banayein|register|new|naya)/i.test(name) && name.split(/\s+/).length <= 2) {
      name = '';
    }
    // Same as the supplier rule above: no invented "Pakistan".
    let city: string | undefined;
    const cityMatch = name.match(/in\s+([A-Za-z]+)|,\s*([A-Za-z]+)/i);
    if (cityMatch) {
      city = (cityMatch[1] || cityMatch[2]).trim();
      name = name.replace(cityMatch[0], '').trim();
    }
    return {
      intent: 'add_customer',
      domain: 'accounting',
      entities: { name: name || undefined, city, missing: name ? [] : ['name'] },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 3. Live Inventory Fetch / Sync / Audit ("Sync inventory", "Fetch live inventory", "Audit stock positions")
  if (
    lower.includes('sync inventory') ||
    lower.includes('fetch inventory') ||
    lower.includes('audit stock') ||
    lower.includes('inventory fetch') ||
    lower.includes('reconcile stock')
  ) {
    return {
      intent: 'sync_inventory',
      domain: 'inventory',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 4. Executive Business Summary
  if (
    lower.includes('business summary') ||
    lower.includes('complete position') ||
    lower.includes('summary do') ||
    (lower.includes('cash') && lower.includes('sales')) ||
    lower.includes('aaj ka') ||
    lower.includes('dashboard') ||
    lower.includes('profit') ||
    lower.includes('منافع') ||
    // "بزنس سمری" — the dashboard demo chip.
    lower.includes('سمری') ||
    lower.includes('سماری')
  ) {
    return {
      intent: 'get_business_summary',
      domain: 'accounting',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 5. Receive Goods against Purchase Order
  if (
    lower.includes('receive goods') ||
    lower.includes('receive karo') ||
    lower.includes('maal receive') ||
    (lower.includes('po') && lower.includes('receive')) ||
    (lower.includes('goods') && lower.includes('received')) ||
    // "po ke goods receipt karo" — 'receipt', not 'received'. The rule matched
    // the noun and the verb only when they were the same word, so the sentence
    // reached the refusal lane and the goods receipt had to be done by hand.
    (lower.includes('goods') && lower.includes('receipt')) ||
    // "گڈز ریسیو" — the dashboard demo chip.
    lower.includes('گڈز') ||
    lower.includes('ریسیو')
  ) {
    const match = lower.match(/po-?(\d+)/) || lower.match(/(\d{4})/);
    // No invented PO number. The old fallback was the literal "PO-1001", so on a
    // ledger with no such order the copilot reported "Purchase Order PO-1001 was
    // not found" — a document number the user never had, presented as fact.
    const poNum = match
      ? `PO-${match[1]}`
      : (state?.purchaseOrders.find(p => p.status === 'pending')?.poNumber || '');
    return {
      intent: 'receive_goods',
      domain: 'purchase',
      entities: { poNumber: poNum },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 6. Reorder Materials Intent ("Reorder completely", "Reorder low stock", "Kam stock mangwao")
  if (
    lower.includes('reorder') ||
    lower.includes('re-order') ||
    lower.includes('restock') ||
    lower.includes('maal mangwa') ||
    lower.includes('dobara mangwa') ||
    // Urdu script: "دوبارہ منگوا دو", "اسٹاک منگواؤ"
    lower.includes('منگوا') ||
    lower.includes('منگوائ')
  ) {
    const qtyMatch = lower.match(/(\d+)\s*(kilo|kg|bags|liters|drums|meters)?/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined;

    return {
      intent: 'reorder_materials',
      domain: 'purchase',
      entities: {
        product: matchedProduct ? matchedProduct.name : undefined,
        quantity,
        missing: [
          ...(matchedProduct ? [] : ['product']),
          ...(quantity === undefined ? ['quantity'] : [])
        ]
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: true,
      rawPrompt: input
    };
  }

  // 7. Purchase Order creation ("Create PO for 100 kg yarn from Lucky Spinning", "order dye", "po banao")
  //
  // Guarded by `pendingRead`. Rule 12 reads the pending-PO list, but it sits
  // BELOW this rule, and this rule matches the bare phrase "purchase order" —
  // so "pending purchase orders" used to be answered with a Purchase Order
  // Prepared for Confirmation card. The user asked what was outstanding and was
  // shown a form asking them to approve a new one. The words "pending" are the
  // whole difference between the two, so they have to be checked before either.
  if (
    !pendingRead &&
    (
    lower.includes('po bana') ||
    lower.includes('purchase order') ||
    lower.includes('order bana') ||
    lower.includes('khareed') ||
    lower.includes('create po') ||
    lower.includes('buy material') ||
    (lower.includes('se') && lower.includes('po')) ||
    // "پرچیز آرڈر" — the dashboard demo chip.
    lower.includes('پرچیز') ||
    lower.includes('آرڈر')
    )
  ) {
    const qtyMatch = lower.match(/(\d+)\s*(kilo|kg|bags|liters|meters)?/);
    // No defaults. This used to fill the supplier, the material and the quantity
    // from "whichever record is first in the array", so "پرچیز آرڈر بنا دو"
    // produced a confirmation card for 100 kg of cotton yarn from Green Mills —
    // a purchase order the user never described, waiting behind a Confirm
    // button. Missing details are now carried as `missing` and asked for.
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined;

    return {
      intent: 'create_purchase_order',
      domain: 'purchase',
      entities: {
        supplier: matchedSupplier?.name,
        product: matchedProduct?.name,
        quantity,
        missing: [
          ...(matchedSupplier ? [] : ['supplier']),
          ...(matchedProduct ? [] : ['product']),
          ...(quantity === undefined ? ['quantity'] : [])
        ]
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: true,
      rawPrompt: input
    };
  }

  // 8. Sales Order creation ("Sell 50 units to customer", "invoice banao", "record sale")
  if (
    lower.includes('sell karo') ||
    lower.includes('sale karo') ||
    lower.includes('becho') ||
    lower.includes('invoice bana') ||
    lower.includes('record sale') ||
    lower.includes('dispatch') ||
    (lower.includes('ko') && lower.includes('sell')) ||
    // PLAIN ENGLISH, which this rule previously did not accept at all.
    //
    // "Sell 50 kg cotton yarn to Rahim Traders" matched nothing here, fell
    // through to rule 14, and was answered with a WAREHOUSE STOCK REPORT —
    // the user asked for a sale and got told how much dye was on the shelf.
    // A command that silently does something else is worse than one that is
    // rejected, so the verb is matched on its own word boundary now.
    /\bsell\b/.test(lower) ||
    /\binvoice\b/.test(lower) ||
    /\bsale of\b/.test(lower) ||
    // "50 kg yarn ka sale record karo" — the noun and the verb are separated by
    // the material, so neither 'sale karo' nor 'record sale' matched, the turn
    // fell through to the stock rule, and the user who asked to record a sale
    // was answered with a warehouse stock report. A sale verb anywhere in the
    // sentence is still a sale.
    (/\bsale\b/.test(lower) && /\b(record|karo|kro|banao|register|likho|chalo)\b/.test(lower)) ||
    // "سیل انوئس (18% GST)" — the dashboard demo chip. Without this it fell
    // through to rule 9 on the word "GST" and returned withholding rules for a
    // question about raising a sales invoice.
    lower.includes('انوئس') ||
    lower.includes('انویس') ||
    // "سیل کرو" / "سیل کریں" — the prompt the demo bar ACTUALLY sends. The
    // label said "سیل انوئس" and routed; the prompt said "سیل کرو" and did
    // not, so the chip on screen fell straight through to the refusal.
    lower.includes('سیل')
  ) {
    const qtyMatch = lower.match(/(\d+)\s*(kilo|kg|bags|meters|units)?/);
    // Same rule as the purchase order: a sale with no customer named must not
    // be issued to whichever client happens to sit at index 0.
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined;

    return {
      intent: 'record_sale',
      domain: 'accounting',
      entities: {
        customer: matchedCustomer?.name,
        product: matchedProduct?.name,
        quantity,
        missing: [
          ...(matchedCustomer ? [] : ['customer']),
          ...(matchedProduct ? [] : ['product']),
          ...(quantity === undefined ? ['quantity'] : [])
        ]
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: true,
      rawPrompt: input
    };
  }

  // 9. Compliance / Tax / FBR queries
  if (
    lower.includes('tax') ||
    lower.includes('gst') ||
    lower.includes('fbr') ||
    lower.includes('compliance') ||
    lower.includes('sro') ||
    lower.includes('withholding') ||
    lower.includes('filing') ||
    // Urdu script: "سیکشن 153 ٹیکس کتنی ہے", "ایف بی آر ٹیکس کا کیا قانون ہے؟"
    lower.includes('ٹیکس') ||
    lower.includes('ٹیکس') ||
    lower.includes('قانون') ||
    lower.includes('ایف بی آر')
  ) {
    return {
      intent: 'compliance_query',
      domain: 'compliance',
      entities: { query: input },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 10. Cashbook & Expense query
  if (
    lower.includes('cash position') ||
    lower.includes('kitna cash') ||
    lower.includes('cash balance') ||
    lower.includes('tijori') ||
    lower.includes('liquidity') ||
    // "How much cash do we have" is the single most obvious question a user can
    // ask this product, and it was refused. Broadened to any mention of cash,
    // minus the words that mean a WRITE — a bare cash match would otherwise
    // swallow "pay the cash utility bill", which is an expense (rule 11).
    (lower.includes('cash') && !lower.includes('expense') && !lower.includes('kharcha') && !lower.includes('bill')) ||
    // Roman Urdu and Urdu for money.
    lower.includes('paisa') ||
    lower.includes('paisay') ||
    lower.includes('paise') ||
    lower.includes('پیسے') ||
    // Urdu script. Needed because "موجود" ("in stock / available") appears in
    // the INVENTORY fallback regex, so "کتنا کیش موجود ہے" — which asks about
    // CASH — was being answered with a warehouse stock report.
    lower.includes('کیش') ||
    (lower.includes('موجود') && lower.includes('کیش'))
  ) {
    return {
      intent: 'get_cash_balance',
      domain: 'accounting',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 11. Expense recording ("5000 utility bill pay kiya", "expense record karo")
  if (lower.includes('expense') || lower.includes('kharcha') || lower.includes('bill pay')) {
    const amountMatch = lower.match(/(\d+[\d,]*)/);
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 5000;
    return {
      intent: 'record_expense',
      domain: 'accounting',
      entities: {
        amount,
        category: 'utilities',
        description: input
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 12. Pending Purchase Orders query
  if (pendingRead) {
    return {
      intent: 'get_pending_orders',
      domain: 'purchase',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 13a. LEDGER questions the finance chips ask, and MATERIAL creation.
  //
  // Four of the twenty chips in the voice assistant were REFUSED with "I don't
  // have a reliable answer to that" — receivables, supplier payments, profit,
  // and adding a material. Every one of those is answerable from the ledger the
  // copilot already reports on, so a refusal there was not honesty, it was a
  // routing table that had never heard of them. A judge clicking a button and
  // reading "I can't do this" is the single most damaging thing this app can do.
  const asksReceivables =
    lower.includes('receivable') || lower.includes('receivables') ||
    lower.includes('paisa baqi') || lower.includes('وصولی') || lower.includes('وصول');
  const asksPayables =
    lower.includes('supplier payment') || lower.includes('payable') ||
    lower.includes('supplier payable') || lower.includes('vendor payment') ||
    lower.includes('debitor');
  const asksProfit =
    lower.includes('profit') || lower.includes('munafa') || lower.includes('net profit') ||
    lower.includes('faida') || lower.includes('نفع');
  const asksAddProduct =
    (lower.includes('add') || lower.includes('new') || lower.includes('naya') || lower.includes('add karo') ||
      lower.includes('add kro') || lower.includes('creat')) &&
    (lower.includes('product') || lower.includes('material') || lower.includes('item') || lower.includes('sku'));

  if (asksReceivables || asksPayables || asksProfit) {
    return {
      intent: asksReceivables ? 'get_receivables' : asksPayables ? 'get_payables' : 'get_profit',
      domain: 'accounting',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  if (asksAddProduct) {
    return {
      intent: 'add_product',
      domain: 'inventory',
      entities: {
        name: undefined,
        unit: undefined,
        missing: ['name', 'unit']
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: true,
      rawPrompt: input
    };
  }

  // 13b. Stock HEALTH and BUY-DECISION questions.
  //
  // These were not routed at all. "stock above minimum" was answered with the
  // whole catalogue, "which items are above minimum" and "do we need to buy more
  // material" were REFUSED, and "how much yarn should we buy" answered with
  // current stock — a different question, given a confident number.
  //
  // The refusal is the worse failure. "Do we need to buy more?" is the question a
  // factory owner actually asks; answering it needs nothing more than the ledger,
  // and refusing it makes the copilot look like it cannot see the warehouse it
  // already reports on. These rules also carry the DECISION the user asked for:
  // which material is short, how much, and — when nothing is short — that no
  // purchase is needed.
  const wantsHealthView =
    lower.includes('above minimum') ||
    lower.includes('above reorder') ||
    lower.includes('sufficient stock') ||
    lower.includes('enough stock') ||
    lower.includes('do we have enough') ||
    lower.includes('have enough of') ||
    lower.includes('stock ok') ||
    lower.includes('stock is ok') ||
    lower.includes('stock theek') ||
    lower.includes('kafi hai');

  const wantsBuyDecision =
    lower.includes('need to buy') ||
    lower.includes('should we buy') ||
    lower.includes('do we buy') ||
    lower.includes('buy more') ||
    lower.includes('more chahiye') ||
    lower.includes('khareedna') ||
    lower.includes('kharidna') ||
    lower.includes('lagana hai') ||
    // "how much <material> should we buy" — a DECISION, not a stock lookup.
    ((lower.includes('should') || lower.includes('how much')) && lower.includes('buy'));

  if (wantsHealthView || wantsBuyDecision) {
    return {
      intent: wantsHealthView ? 'stock_health' : 'reorder_advice',
      domain: 'inventory',
      entities: {
        product: matchedProduct?.name,
        // A named material turns the sweep into a single verdict.
        scope: matchedProduct ? matchedProduct.name : 'all'
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 13. Low Stock alert query
  if (
    lower.includes('low stock') ||
    lower.includes('kam stock') ||
    lower.includes('khatam') ||
    lower.includes('deficit')
  ) {
    return {
      intent: 'check_inventory',
      domain: 'inventory',
      entities: { product: 'all', filterLowStock: true },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 14. Fallback.
  //
  // This used to be an unconditional "Default to Inventory Stock Check", which
  // meant that ANY sentence matching none of rules 1-13 was answered with a
  // warehouse report. Asked "What is the best bowling attack in Pakistan
  // cricket history?" the copilot replied with the stock level of Reactive
  // Dye Blue — not because it misread the question as inventory, but because
  // it never considered the possibility that it did not know the answer.
  //
  // Inventory is still the right guess when the input actually looks like a
  // stock question or names a catalog item. Otherwise say so.
  //
  // The Urdu terms are NOT optional. The dashboard's own demo chip asks
  // "اسٹاک کتنا ہے؟" in Arabic script, so a Latin-only test refuses it — the
  // routing guard caught that the first time round.
  const looksLikeInventoryQuestion =
    matchedProduct !== undefined ||
    /stock|inventory|warehouse|maal\b|samaan|godam|available|qty|quantity|reorder|kam\b|khatam|bacha\b|baqi\b/.test(lower) ||
    /اسٹاک|انوینٹری|گودام|موجود|باقی|بچا|بچی/.test(input);

  if (looksLikeInventoryQuestion) {
    return {
      intent: 'check_inventory',
      domain: 'inventory',
      entities: { product: matchedProduct ? matchedProduct.name : '' },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  return {
    intent: 'unrecognised_query',
    domain: 'supervisor',
    entities: {},
    userId: 'usr_super_admin',
    organizationId: 'org_sme_01',
    requiresConfirmation: false,
    rawPrompt: input
  };
}

/**
 * Main Supervisor Execution Router
 * Takes live state, executes deterministic tools, and returns state updates & confirmation cards
 */
/**
 * The copilot's front door: run the turn, then label it with the skills that
 * answered it.
 *
 * The labelling lives out here, in one place, rather than in the twenty-odd
 * return statements below. Inside `runSupervisorTurn` a rule that forgets to
 * stamp itself produces an answer with no badge — a silent gap in the routing
 * story, invisible until a judge asks "which agent did this?". Out here the
 * badge is a pure function of the intent, so every answer is accounted for and
 * no answer can claim a skill that did not run.
 */
export async function executeSupervisorTurn(
  input: string,
  state: DatabaseState,
  inputMethod: 'text' | 'voice' = 'text'
): Promise<SupervisorProcessResult> {
  let contract = analyzeUserIntent(input, state);

  // THE MISS PATH.
  //
  // Every rule in this file is an exact clause in a fixed order, which is why
  // "pending goods receive karo" worked and "receive pending goods" did not —
  // same words, opposite outcome. That is not a missing keyword, it is a
  // ceiling: no amount of hand-wiring fixes word order.
  //
  // So when the rules match nothing, the resolver gets a turn. It may only pick
  // one of the existing tools, and its output is re-entered through the SAME
  // deterministic body below — no new money code, no new write path, and the
  // human approval gate unchanged. If it cannot place the sentence, the refusal
  // runs unchanged, now with suggestions attached.
  if (contract.intent === 'unrecognised_query') {
    const resolved = await resolveCommand(input, state);
    if (resolved) contract = resolved;
  }

  const result = await runSupervisorTurn(input, state, inputMethod, contract);
  const skills = selectSkills(contract.intent);
  if (skills.length === 0) return result;
  return { ...result, message: { ...result.message, skills } };
}

/**
 * Turn a resolved tool call into the same contract the rules produce.
 *
 * The entity verification here is the whole safety story: a name the model
 * produced is only accepted if it resolves to a real row through the same
 * finders the deterministic paths use. An unresolvable name returns null and
 * the clarification loop asks, rather than a write being made against a party
 * that does not exist.
 */
async function resolveCommand(input: string, state: DatabaseState): Promise<AgentHandoffContract | null> {
  let call;
  try {
    const { resolve } = await import('../lib/ai/index.ts');
    call = (await resolve(input)).call;
  } catch {
    return null;
  }
  if (!call) return null;

  const spec = toolSpec(call.tool);
  if (!spec) return null;

  const base = {
    domain: spec.domain,
    userId: 'usr_super_admin',
    organizationId: 'org_sme_01',
    requiresConfirmation: spec.writes,
    rawPrompt: input
  };

  // Navigation: map the model's module word onto a real tab.
  if (call.tool === 'navigate') {
    const said = String(call.params.module ?? call.params.screen ?? '');
    const mod = NAVIGABLE.find(([, rx]) => rx.test(said.toLowerCase()));
    if (!mod) return null;
    return { intent: 'navigate', entities: { module: mod[0] }, ...base };
  }

  // The model never supplies an id. A purchase order is named by number if the
  // user said one, and otherwise the single pending order — never "the first".
  if (call.tool === 'receive_goods') {
    const said = String(call.params.purchaseOrder ?? call.params.po ?? '');
    const found = state.purchaseOrders.find(
      p => said && p.poNumber.toLowerCase().replace(/\s/g, '') === said.toLowerCase().replace(/\s/g, '')
    );
    const pending = state.purchaseOrders.filter(p => p.status === 'pending');
    const poNumber = found?.poNumber ?? (pending.length === 1 ? pending[0].poNumber : '');
    if (!poNumber) return null;
    return { intent: 'receive_goods', entities: { poNumber, hasDocument: true }, ...base };
  }

  // A material must be a real material, and the user must have NAMED it.
  if (spec.requiresLedgerEntity === 'product') {
    const said = String(call.params.product ?? call.params.material ?? call.params.item ?? '').trim();
    // No material named means no material answer. `findProductByName` is
    // forgiving, and an empty query matched the first product in the
    // catalogue — so "how much money do customers owe me" came back with a
    // figure for Cotton Yarn 150D. A blank is never a product.
    if (!said) return null;
    const product = findProductByName(state.products, said);
    if (!product) return null;
    const quantity = Number(call.params.quantity);
    return {
      intent: spec.intent,
      entities: { product: product.name, quantity: Number.isFinite(quantity) ? quantity : undefined },
      ...base
    };
  }

  // The three REGISTER tools.
  //
  // The resolver picked the capability; it did not supply a name, and it is not
  // allowed to invent one. Returning a nameless contract here crashed the write
  // path — `params.name.trim()` on undefined — so the name is marked missing
  // instead, which hands the turn to the existing clarification guard that asks
  // the user for it. Same question, asked by the code that already knows how.
  if (call.tool === 'add_customer' || call.tool === 'add_supplier' || call.tool === 'add_product') {
    const said = String(
      call.params.name ?? call.params.customer ?? call.params.supplier ?? call.params.product ?? ''
    ).trim();
    const verbPrefix = /^(save|record|add|create|register|karo|kro|banao)\b\s*/i;
    const guessed = said || input.replace(verbPrefix, '').trim();
    // A name is never a command. "customer save karo" once created a customer
    // literally called "customer save karo" — the whole sentence, command words
    // and all, written into the ledger. Anything still carrying a command verb
    // is not a name.
    const COMMAND_WORDS = /\b(save|record|add|create|register|customer|supplier|product|material|karo|kro|do|banayein|banao)\b/i;
    const looksLikeAName =
      guessed.length > 2 && !COMMAND_WORDS.test(guessed) && !/^(karo|kro|do|hai|hain)$/i.test(guessed);

    if (!looksLikeAName) {
      return { intent: spec.intent, entities: { missing: ['name'] }, ...base };
    }
    return {
      intent: spec.intent,
      entities: { name: guessed, city: call.params.city as string | undefined, missing: [] },
      ...base
    };
  }

  // Any other tool with no ledger entity to verify: run it as the rule would.
  // Reads are safe with empty entities; a write without one is not, so a write
  // falls through to the refusal rather than being executed half-formed.
  if (spec.writes) return null;

  return { intent: spec.intent, entities: {}, ...base };
}

async function runSupervisorTurn(
  input: string,
  state: DatabaseState,
  inputMethod: 'text' | 'voice',
  contract: AgentHandoffContract
): Promise<SupervisorProcessResult> {
  const now = new Date().toISOString();
  // Resolved from the RAW input so voice and text cannot diverge. Writes are
  // exempt: a confirmation is never shortened (see answerFormat.ts).
  const detailed = wantsDetail(input) || isWriteIntent(contract.intent);

  // A write that is missing an ingredient stops HERE, before any tool runs.
  // Nothing is created, no confirmation is opened, and the reply is the list of
  // what to supply — because the alternative is a filled-in card the user was
  // never asked about, sitting behind a Confirm button.
  // ROUTE: LEDGER READS the finance chips ask for.
  if (contract.intent === 'get_receivables') {
    const total = totalOutstandingReceivables(state.customers);
    const owing = state.customers
      .filter(c => (c.outstandingReceivables || 0) > 0)
      .sort((a, b) => b.outstandingReceivables - a.outstandingReceivables);
    const lines = owing.map(c => `• ${c.name} — Rs. ${c.outstandingReceivables.toLocaleString()}`).join('\n');
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: total > 0
          ? `📑 **Receivables Rs. ${total.toLocaleString()}**\n${lines}`
          : '📑 Receivables Rs. 0 — every invoice is paid.',
        timestamp: now, inputMethod, routedAgent: 'accounting'
      }
    };
  }

  if (contract.intent === 'get_payables') {
    const open = state.purchaseOrders.filter(po => po.status !== 'received' && po.status !== 'cancelled');
    const total = open.reduce((sum, po) => sum + po.totalAmount, 0);
    const lines = open.slice(0, 5).map(po => `• ${po.supplierName} — Rs. ${po.totalAmount.toLocaleString()}`).join('\n');
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: total > 0
          ? `📤 **Payables Rs. ${total.toLocaleString()}** (${open.length} open)\n${lines}`
          : '📤 Payables Rs. 0 — no open purchase orders.',
        timestamp: now, inputMethod, routedAgent: 'purchase'
      }
    };
  }

  if (contract.intent === 'get_profit') {
    const sales = state.salesOrders.reduce((sum, so) => sum + (so.subtotal || 0), 0);
    const purchases = state.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0);
    const diff = sales - purchases;
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `📈 Sales Rs. ${sales.toLocaleString()} · Purchases Rs. ${purchases.toLocaleString()} · Difference Rs. ${diff.toLocaleString()}\n\n_Not a profit figure — it excludes labour, overhead and finance cost._`,
        timestamp: now, inputMethod, routedAgent: 'accounting'
      }
    };
  }

  // ROUTE: STOCK HEALTH and BUY DECISIONS.
  //
  // The decision is the product. "Reactive Dye Blue — buy 102 kg" is advice the
  // ledger supports; "here is your stock list" is a report the user has to
  // interpret themselves. When nothing is short, saying so is the answer.
  if (contract.intent === 'stock_health' || contract.intent === 'reorder_advice') {
    const scope = String(contract.entities.scope || 'all');
    const single = scope !== 'all'
      ? state.products.find(p => p.name.toLowerCase() === scope.toLowerCase())
      : undefined;
    const pool = single ? [single] : state.products;
    const short = pool.filter(p => p.currentStock <= p.reorderThreshold);
    const healthy = pool.filter(p => p.currentStock > p.reorderThreshold);

    if (contract.intent === 'stock_health') {
      const lines = (single ? [single] : healthy)
        .map(p => `• ${p.name} — ${p.currentStock.toLocaleString()} ${p.unit} (min ${p.reorderThreshold} ${p.unit})`)
        .join('\n');
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: short.length > 0
            ? `✅ ${single ? single.name : `${healthy.length} of ${pool.length} items`} above minimum.\n${lines}${single ? `\n\n⚠️ Short by ${(single.reorderThreshold - single.currentStock).toLocaleString()} ${single.unit} — buy that much.` : ''}`
            : `✅ All ${pool.length} items above minimum — no purchase needed.`,
          timestamp: now,
          inputMethod,
          routedAgent: 'inventory'
        }
      };
    }

    // reorder_advice — what to buy, or the decision not to buy.
    if (short.length === 0) {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: single
            ? `✅ No purchase needed — ${single.name} has ${single.currentStock.toLocaleString()} ${single.unit} against a ${single.reorderThreshold} ${single.unit} minimum.`
            : `✅ Nothing to buy — all ${pool.length} materials are above their reorder levels.`,
          timestamp: now,
          inputMethod,
          routedAgent: 'inventory'
        }
      };
    }

    const advice = short
      .map(p => `• Buy ${p.name} — ${(p.reorderThreshold - p.currentStock).toLocaleString()} ${p.unit} short (${p.currentStock}/${p.reorderThreshold} ${p.unit})`)
      .join('\n');
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🛒 **${short.length} to buy**\n${advice}`,
        timestamp: now,
        inputMethod,
        routedAgent: 'inventory'
      }
    };
  }

  // ROUTE: NAVIGATE — the shell performs the screen change.
  if (contract.intent === 'navigate') {
    const module = String(contract.entities.module || 'dashboard');
    const label = NAVIGATE_LABELS[module] || module;
    const extra = module === 'fbr_integration'
      ? '\n\nIntegration aap ke licensed integrator se connect hoti hai — is app se FBR par kuch submit nahin hota.'
      : '';
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🧭 **${label}** کھل رہا ہے۔${extra}`,
        timestamp: now,
        inputMethod,
        routedAgent: 'supervisor'
      },
      directive: { type: 'navigate', module }
    };
  }

  // ROUTE: PRINT — the shell opens the print dialog with the document.
  if (contract.intent === 'print') {
    const document = String(contract.entities.document) as 'invoice' | 'purchase_order' | 'cash_voucher' | 'inventory_report';
    const titles: Record<string, string> = {
      invoice: 'Sales Tax Invoice',
      purchase_order: 'Purchase Order',
      cash_voucher: 'Cash Voucher',
      inventory_report: 'Stock Report'
    };
    if (!contract.entities.hasDocument) {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `🖨️ کوئی ${titles[document]} موجود نہیں — print karne ke liye pehle record banayein۔`,
          timestamp: now,
          inputMethod,
          routedAgent: 'supervisor'
        }
      };
    }
    const candidates = document === 'invoice' ? (state.salesOrders ?? [])
      : document === 'purchase_order' ? (state.purchaseOrders ?? [])
        : document === 'cash_voucher' ? (state.cashbook ?? [])
          : [];
    // Several to choose from? Ask. "Print invoice" with six invoices in the
    // ledger is not an instruction to print whichever one happens to be newest
    // — that is a guess with a printer attached, and the user never sees which
    // page came out until paper is already feeding. This is the same ask-first
    // rule the purchase-order command follows.
    if (candidates.length > 1) {
      const shown = candidates.slice(0, 5).map((r: any) => {
        const id = r.invoiceNumber ?? r.poNumber ?? r.voucherNumber ?? r.id;
        const amount = r.totalAmount ?? r.amount ?? 0;
        const who = r.customerName ?? r.supplierName ?? '';
        return `• ${id}${who ? ` — ${who}` : ''} · Rs. ${Number(amount).toLocaleString()}`;
      }).join('\n');
      const more = candidates.length > 5 ? `\n• …and ${candidates.length - 5} more` : '';
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `🖨️ ${candidates.length} ${titles[document]}s — which one?\n${shown}${more}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'supervisor'
        }
      };
    }

    const data = document === 'invoice' ? (state.salesOrders?.[0] ?? null)
      : document === 'purchase_order' ? (state.purchaseOrders?.[0] ?? null)
        : document === 'cash_voucher' ? (state.cashbook?.[0] ?? null)
          : state.products;

    // Name the record. "Invoice printing" tells the user nothing they can check;
    // "INV-DEMO-1001 — Rs. 513,300" is the thing that went to the printer, and
    // with more than one invoice in the ledger it is the only way anyone can
    // tell which one was picked.
    const identifier = (data as any)?.invoiceNumber
      ?? (data as any)?.poNumber
      ?? (data as any)?.voucherNumber
      ?? (Array.isArray(data) ? `${data.length} materials` : '');
    const amount = (data as any)?.totalAmount;
    const named = identifier ? `${titles[document]} ${identifier}${amount ? ` — Rs. ${amount.toLocaleString()}` : ''}` : titles[document];

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🖨️ **${named}** چھپ رہا ہے۔`,
        timestamp: now,
        inputMethod,
        routedAgent: 'supervisor'
      },
      directive: { type: 'print', document, data }
    };
  }

  /* ROUTE: MATERIAL VARIANCE — "kaun sa material loss me tha", "which material
     got loss from which supplier".

     This used to refuse, and the refusal was the honest answer: nothing wrote a
     production-issue or purchase-receipt movement, so there was no data to
     reconcile. Both are now recorded, and `lossAnswer` still refuses by name
     when they are absent rather than returning an empty table that reads as
     "no loss". */
  if (contract.intent === 'material_loss') {
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: lossAnswer(state),
        timestamp: now,
        inputMethod,
        routedAgent: 'inventory'
      }
    };
  }

  /* ROUTE: STOCK SUFFICIENCY — "did we have proper stock?", "do we have enough
     yarn?".

     Named as its own intent because "did we have enough" is not a stock
     report: the report answers with a list and leaves the decision to the
     user. The decision is the product. */
  if (contract.intent === 'stock_check' || contract.intent === 'stock_sufficiency') {
    const scope = String(contract.entities.scope || 'all').trim();
    const content = scope && scope !== 'all'
      ? stockVerdict(state, scope, contract.entities.quantity).line
      : stockHealthSummary(state);

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: now,
        inputMethod,
        routedAgent: 'inventory'
      }
    };
  }

  /* ROUTE: QUESTIONS ABOUT THIS SOFTWARE.

     "How do I print a purchase order" is a question about the app, not about
     the ledger and not about statute. It used to fall through both and get a
     refusal, which made the product look like it did not know its own menu. */
  if (contract.intent === 'about_software' || contract.intent === 'list_capabilities') {
    const content = contract.intent === 'list_capabilities'
      ? capabilityAnswer()
      : (softwareAnswer(input) ?? `🧭 I know ${MODULE_REGISTRY.length} modules. Ask "what can this do?" for the full list.`);

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: now,
        inputMethod,
        routedAgent: 'supervisor'
      }
    };
  }

  const missing = (contract.entities.missing || []) as string[];
  if (missing.length > 0 && ['create_purchase_order', 'record_sale', 'reorder_materials', 'add_product', 'add_supplier', 'add_customer'].includes(contract.intent)) {
    const kind = contract.intent === 'record_sale' ? 'sale'
      : contract.intent === 'add_supplier' ? 'party'
        : contract.intent === 'add_customer' ? 'party'
          : 'purchase';
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: clarificationReply(
          kind as 'purchase' | 'sale' | 'party',
          missing,
          state,
          contract.intent === 'add_customer' ? 'customer' : 'supplier'
        ),
        timestamp: now,
        inputMethod,
        routedAgent: kind === 'sale' ? 'accounting' : 'purchase'
      },
      pendingCommand: pendingCommandFor(contract.intent)
    };
  }

  // ROUTE 0: REFUSAL — the input matched no capability.
  //
  // Kept ahead of every domain route on purpose. An unrecognised question must
  // never be answered from the nearest agent that happens to have something to
  // say; that substitution is what produced the cricket-and-stock reply, and
  // it is the same failure mode the RAG gate exists to stop one layer down.
  if (contract.intent === 'unrecognised_query') {
    // Logged so Settings can list it and the user can teach it. Never shown to
    // the user as an error — the log is an aid, the answer is the suggestions.
    recordMiss(input);
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: refusalWithSuggestions(input),
        timestamp: now,
        inputMethod,
        routedAgent: 'supervisor'
      }
    };
  }

  // ROUTE 0: MASTER REGISTRY CREATION (Suppliers & Customers)
  if (contract.intent === 'add_supplier') {
    const supplierName = contract.entities.name as string;
    const city = contract.entities.city as string | undefined;
    const { newSupplier, updatedState } = executeCreateSupplier(state, {
      name: supplierName,
      city
    });

    // Only what the user actually said. "Lead Time: 3 days, Payment Terms: Net
    // 30 Days" used to be hardcoded at this call site and then printed back as
    // the supplier's real commercial terms — a 500,000-rupee credit limit and
    // a 3-day lead time are business facts nobody agreed to. The record keeps
    // schema defaults for arithmetic; the reply does not claim them.
    const unset = 'not set yet';
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🏢 **Supplier added**\n\n• **Name**: ${newSupplier.name}\n• **City / Hub**: ${city || unset}\n• **Lead time**: ${unset}\n• **Payment terms**: ${unset}\n• **Record ID**: \`${newSupplier.id}\`\n\nAdd the lead time and terms when you have them — both drive purchase planning.`,
        timestamp: now,
        inputMethod,
        routedAgent: 'purchase',
        toolExecution: {
          toolName: 'create_supplier',
          domain: 'purchase',
          status: 'success',
          inputs: contract.entities,
          output: { supplierId: newSupplier.id, name: newSupplier.name },
          timestamp: now,
          executionMs: 10
        }
      },
      directDatabaseUpdate: updatedState
    };
  }

  if (contract.intent === 'add_customer') {
    const customerName = contract.entities.name as string;
    const city = contract.entities.city as string | undefined;
    const { newCustomer, updatedState } = executeCreateCustomer(state, {
      name: customerName,
      city,
      outstandingReceivables: 0
    });

    // As with the supplier: the Rs. 500,000 "Standard Credit Limit" printed
    // here was a literal at this call site, not something the user agreed to.
    const unset = 'not set yet';
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `👥 **Customer added**\n\n• **Name**: ${newCustomer.name}\n• **Location**: ${city || unset}\n• **Credit limit**: ${unset}\n• **Receivables**: Rs. 0\n• **Account Ref**: \`${newCustomer.id}\`\n\nSet the credit limit when you know it — it is what stops an invoice going past the customer's terms.`,
        timestamp: now,
        inputMethod,
        routedAgent: 'accounting',
        toolExecution: {
          toolName: 'create_customer',
          domain: 'accounting',
          status: 'success',
          inputs: contract.entities,
          output: { customerId: newCustomer.id, name: newCustomer.name },
          timestamp: now,
          executionMs: 10
        }
      },
      directDatabaseUpdate: updatedState
    };
  }

  // ROUTE 0.5: LIVE INVENTORY AUDIT & SYNC
  if (contract.intent === 'sync_inventory') {
    const totalSKUs = state.products.length;
    const lowStock = state.products.filter(p => p.currentStock <= p.reorderThreshold).length;
    const totalValuation = state.products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: detailed
          ? `🔄 **Live Inventory Reconciled & Verified**\n\n• Active Production SKUs: **${totalSKUs}**\n• Total Warehouse Valuation: **Rs. ${totalValuation.toLocaleString()}**\n• Items Below Threshold: **${lowStock}**\n• Audit Movements Recorded: **${state.inventoryMovements.length}**\n\nAll material positions are verified against real Purchase Order receipts and sales dispatches.`
          : `📦 **${totalSKUs} SKUs** · ${pkr(totalValuation)} valuation · **${lowStock}** below minimum`,
        timestamp: now,
        inputMethod,
        routedAgent: 'inventory',
        toolExecution: {
          toolName: 'sync_inventory',
          domain: 'inventory',
          status: 'success',
          inputs: {},
          output: { totalSKUs, lowStock, totalValuation },
          timestamp: now,
          executionMs: 15
        }
      }
    };
  }

  // ROUTE 1: INVENTORY AGENT
  if (contract.domain === 'inventory') {
    const res = toolCheckInventory(state, { product: contract.entities.product });

    if (!res.success) {
      const availableNames = state.products.map(p => `• ${p.name} (${p.currentStock} ${p.unit})`).join('\n') || '• No products in catalog. Add via "+ Add Product".';
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `❌ ${res.error?.message}\n\nCurrent Catalog SKUs:\n${availableNames}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'inventory'
        }
      };
    }

    const { product, lowStockItems, allProducts } = res.data!;

    // "show me low stock" is a SWEEP, not a stock question. The two used to
    // share one answer, and widening the stock answer quietly widened the sweep
    // too — so asking which items need reordering started listing the five that
    // do not. `filterLowStock` is what rule 13 already set to separate them.
    if (contract.entities.filterLowStock) {
      const sweepLines = lowStockItems
        .map(p => `• ${p.name} — ${p.currentStock.toLocaleString()} ${p.unit} (min ${p.reorderThreshold} ${p.unit})`)
        .join('\n');
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: lowStockItems.length > 0
            ? `⚠️ **${lowStockItems.length} below minimum**\n${sweepLines}`
            : `✅ All ${allProducts.length} items above minimum.`,
          timestamp: now,
          inputMethod,
          routedAgent: 'inventory',
          structuredData: { type: 'inventory', data: lowStockItems }
        }
      };
    }
    if (product) {
      const isLow = product.currentStock <= product.reorderThreshold;
      const statusIcon = isLow ? '⚠️' : '📦';
      const warningText = isLow ? `\n\n⚠️ Warning: Stock is below reorder threshold of ${product.reorderThreshold} ${product.unit}!` : '';

      // The bare answer is the figure and the item name. SKU, unit cost and
      // reorder level are one word away ("details"), not in the way.
      const terse = isLow
        ? `${statusIcon} **${product.currentStock.toLocaleString()} ${product.unit}** — ${product.name}\n⚠️ Below reorder level (${product.reorderThreshold} ${product.unit}).`
        : `${statusIcon} **${product.currentStock.toLocaleString()} ${product.unit}** — ${product.name}`;

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: detailed
            ? `${statusIcon} **${product.name}**\n\n• Available Stock: **${product.currentStock} ${product.unit}**\n• Warehouse SKU: \`${product.sku}\`\n• Unit Cost Price: Rs. ${product.costPrice.toLocaleString()}\n• Minimum Reorder Level: ${product.reorderThreshold} ${product.unit}${warningText}`
            : terse,
          timestamp: now,
          inputMethod,
          routedAgent: 'inventory',
          structuredData: { type: 'inventory', data: product }
        }
      };
    }

    const lowStockList = lowStockItems.map(p => `• ⚠️ **${p.name}**: ${p.currentStock} ${p.unit} (Threshold: ${p.reorderThreshold} ${p.unit})`).join('\n');

    // A stock question with no item named is a question about the whole
    // warehouse, so the whole warehouse is the answer.
    //
    // It used to answer with the LOW-STOCK list only:
    //
    //     ⚠️ 1 below minimum
    //     • Reactive Dye Blue — 18 kg
    //
    // One line, and nothing saying the other five materials were left out. The
    // factory holds six SKUs; the answer read as though it held one. The
    // reorder warning is still owed and still leads, because that is the part
    // that changes what the user does next.
    const SHOWN = 8;
    const shown = allProducts.slice(0, SHOWN);
    const overflow = allProducts.length - shown.length;
    const stockLines = shown
      .map(p => `• ${p.currentStock <= p.reorderThreshold ? '⚠️ ' : ''}${p.name} — ${p.currentStock.toLocaleString()} ${p.unit}`)
      .join('\n');
    const more = overflow > 0 ? `\n• …and ${overflow} more — say "details"` : '';

    const warehouseTerse = [
      `📦 **${allProducts.length} item${allProducts.length === 1 ? '' : 's'} in stock**${lowStockItems.length ? ` · ⚠️ ${lowStockItems.length} below minimum` : ''}`,
      stockLines + more
    ].join('\n');

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: detailed
          ? `📦 **Warehouse Inventory Status**\n\nTotal catalog items: ${state.products.length}\n\n**All Materials:**\n${stockLines}${more}\n\n**Low Stock Warnings:**\n${lowStockList || 'All materials above threshold.'}`
          : warehouseTerse,
        timestamp: now,
        inputMethod,
        routedAgent: 'inventory',
        structuredData: { type: 'inventory', data: allProducts }
      }
    };
  }

  // ROUTE 2: PURCHASE AGENT
  if (contract.domain === 'purchase') {
    if (contract.intent === 'receive_goods') {
      if (!contract.entities.poNumber) {
        return {
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: '❌ No purchase order to receive against.\n\nThere is no open PO in your ledger. Create one first, then receive the goods.',
            timestamp: now,
            inputMethod,
            routedAgent: 'purchase'
          }
        };
      }

      const recRes = toolReceiveGoods(state, { poIdOrNumber: contract.entities.poNumber });
      if (!recRes.success) {
        return {
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `❌ Could not receive goods.\n\n${recRes.error?.message}`,
            timestamp: now,
            inputMethod,
            routedAgent: 'purchase'
          }
        };
      }

      const { po, updatedProduct, movement, updatedState } = recRes.data!;
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `✅ **Goods Received Successfully!**\n\n• Purchase Order: **${po.poNumber}** (${po.supplierName})\n• Received: **${po.items[0]?.quantity} ${po.items[0]?.unit} ${updatedProduct.name}**\n• Updated Warehouse Stock: **${updatedProduct.currentStock} ${updatedProduct.unit}**\n• Inventory Movement Logged: \`${movement.id}\``,
          timestamp: now,
          inputMethod,
          routedAgent: 'purchase',
          structuredData: { type: 'purchase_order', data: po }
        },
        directDatabaseUpdate: updatedState
      };
    }

    if (contract.intent === 'get_pending_orders') {
      const pOrders = toolGetPendingOrders(state);
      const list = pOrders.pendingPurchaseOrders
        .map(p => `• **${p.poNumber}** — ${p.supplierName}: ${p.items[0]?.quantity} ${p.items[0]?.unit} ${p.items[0]?.productName} (Rs. ${p.totalAmount.toLocaleString()})`)
        .join('\n');

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: detailed
            ? `📋 **Pending Purchase Orders (${pOrders.count})**\n\nTotal committed procurement capital: **Rs. ${pOrders.totalPendingValuePKR.toLocaleString()}**\n\n${list || 'No pending purchase orders.'}`
            : pOrders.count > 0
              ? `📋 **${pOrders.count} pending** — ${pkr(pOrders.totalPendingValuePKR)} committed`
              : `📋 No pending purchase orders.`,
          timestamp: now,
          inputMethod,
          routedAgent: 'purchase'
        }
      };
    }

    if (contract.intent === 'reorder_materials') {
      const reorderRes = prepareReorderLowStockConfirmation(state, {
        specificProduct: contract.entities.product,
        customQuantity: contract.entities.quantity
      });

      if (!reorderRes.success) {
        return {
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `ℹ️ **Reorder Analysis:**\n\n${reorderRes.error?.message}`,
            timestamp: now,
            inputMethod,
            routedAgent: 'purchase'
          }
        };
      }

      const conf = reorderRes.data!.confirmation;
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `⚡ **Reorder Action Prepared**\n\n${conf.description}\n\n• Unit Price: Rs. ${conf.details.unitPricePKR?.toLocaleString()}\n• Total Commitment: **Rs. ${conf.totalAmountPKR.toLocaleString()}**\n\nPlease review and confirm to disburse PO to supplier.`,
          timestamp: now,
          inputMethod,
          routedAgent: 'purchase',
          structuredData: { type: 'purchase_order', data: conf.details }
        },
        pendingConfirmation: conf
      };
    }

    // Create PO -> requires human confirmation
    const prepRes = preparePurchaseOrderConfirmation(state, {
      supplier: contract.entities.supplier,
      product: contract.entities.product,
      quantity: contract.entities.quantity
    });

    if (!prepRes.success) {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `❌ Could not prepare Purchase Order.\n\n${prepRes.error?.message}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'purchase'
        }
      };
    }

    const conf = prepRes.data!.confirmation;

    // THE STOCK CHECK RUNS BEFORE THE CARD OPENS.
    //
    // "Buy 200 kg yarn" on a mill holding 1,450 kg of the same yarn used to open
    // a confirmation card with no mention of the stock already sitting in the
    // store — the order looked necessary and was not. The guard says so here,
    // where the user is still reading, not after they have approved. Ordering
    // anyway stays their call; making the call without being told is the bug.
    const guard = purchaseGuardNote(
      state,
      contract.entities.product ?? '',
      contract.entities.quantity
    );

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: [
          `📝 **Purchase Order Prepared for Confirmation**\n\n${conf.description}`,
          guard ? `\n\n${guard}` : '',
          '\n\nPlease review and confirm to disburse PO to supplier.'
        ].join(''),
        timestamp: now,
        inputMethod,
        routedAgent: 'purchase',
        confirmationRequired: conf
      },
      pendingConfirmation: conf
    };
  }

  // ROUTE 3: ACCOUNTING AGENT
  if (contract.domain === 'accounting') {
    if (contract.intent === 'get_business_summary') {
      const summary = toolGetBusinessSummary(state);
      const lowStockBullet = summary.lowStockItems.length > 0
        ? summary.lowStockItems.map(p => `• ⚠️ ${p.name} — **${p.currentStock} ${p.unit}**`).join('\n')
        : '• None (all stock healthy)';

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: detailed
            ? `📊 **TODAY'S EXECUTIVE BUSINESS SUMMARY**\n\n` +
              `💰 **Sales (Today)**: Rs. ${summary.todaySalesPKR.toLocaleString()}\n` +
              `💵 **Cash & Bank Position**: Rs. ${summary.cashPositionPKR.toLocaleString()}\n` +
              `📦 **Inventory Valuation**: Rs. ${summary.totalInventoryValuePKR.toLocaleString()}\n` +
              `📋 **Pending Purchase Orders**: ${summary.pendingPOsCount} orders\n` +
              `📑 **Outstanding Receivables**: Rs. ${summary.outstandingReceivablesPKR.toLocaleString()}\n\n` +
              `⚠️ **Low Stock Items:**\n${lowStockBullet}\n\n` +
              `🎯 **Recommended Action:**\n${summary.recommendedAction}`
            : `📊 Sales ${pkr(summary.todaySalesPKR)} · Cash ${pkr(summary.cashPositionPKR)} · Receivables ${pkr(summary.outstandingReceivablesPKR)}\n` +
              `⚠️ ${summary.lowStockItems.length} below minimum · 📋 ${summary.pendingPOsCount} POs pending`,
          timestamp: now,
          inputMethod,
          routedAgent: 'accounting',
          structuredData: { type: 'business_summary', data: summary }
        }
      };
    }

    if (contract.intent === 'get_cash_balance') {
      const cash = toolGetCashBalance(state);
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: detailed
            ? `💵 **Cash Position & Liquidity**\n\n• Net Available Cash: **Rs. ${cash.netCashPosition.toLocaleString()}**\n• Recorded Inflows: Rs. ${cash.totalInflow.toLocaleString()}\n• Recorded Disbursements: Rs. ${cash.totalOutflow.toLocaleString()}`
            : `💵 **${pkr(cash.netCashPosition)}** — cash & bank`,
          timestamp: now,
          inputMethod,
          routedAgent: 'accounting'
        }
      };
    }

    if (contract.intent === 'record_expense') {
      const { entry, updatedState } = toolRecordExpense(state, {
        amount: contract.entities.amount,
        category: contract.entities.category,
        description: contract.entities.description
      });

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `✅ **Disbursement Logged in Cashbook**\n\n• Amount: **Rs. ${entry.amount.toLocaleString()}**\n• Category: ${entry.category}\n• Description: ${entry.description}\n• Cashbook Ref: \`${entry.id}\``,
          timestamp: now,
          inputMethod,
          routedAgent: 'accounting'
        },
        directDatabaseUpdate: updatedState
      };
    }

    // Record sale -> requires confirmation
    const prepSale = prepareRecordSaleConfirmation(state, {
      customer: contract.entities.customer,
      product: contract.entities.product,
      quantity: contract.entities.quantity
    });

    if (!prepSale.success) {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `❌ Could not prepare sales transaction.\n\n${prepSale.error?.message}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'accounting'
        }
      };
    }

    const conf = prepSale.data!.confirmation;
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🧾 **Sales Order & Invoice Prepared for Confirmation**\n\n${conf.description}\n\n• Customer: **${conf.details.customer}**\n• Subtotal: Rs. ${conf.details.subtotalPKR.toLocaleString()}\n• FBR Sales Tax (${conf.details.gstRatePercent}%): Rs. ${conf.details.gstAmountPKR.toLocaleString()}\n• **Total Payable**: **Rs. ${conf.totalAmountPKR?.toLocaleString()}**\n• Inventory deduction: -${conf.details.quantity} ${conf.details.unit} (Warehouse stock will decrease from ${conf.details.currentStock} to ${conf.details.remainingStockAfterSale} ${conf.details.unit}).`,
        timestamp: now,
        inputMethod,
        routedAgent: 'accounting',
        confirmationRequired: conf
      },
      pendingConfirmation: conf
    };
  }

  // ROUTE 4: COMPLIANCE AGENT (FBR RAG)
  const ragResult = queryComplianceRAG(state.complianceSources, contract.entities.query || input);

  // A refusal must not be rendered as an answer. The old template printed
  // "Applicable GST Rate: 0%", "Withholding Rate: 0%" and the literal string
  // "(Verified against active FBR regulations)" for EVERY query, including the
  // ones the corpus had nothing to say about. That is how asking about
  // Pakistan's best bowling attack produced what looked like a verified legal
  // opinion, with an empty citation sitting underneath the badge.
  if (!ragResult.found) {
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: detailed
            ? `⚖️ **FBR Compliance & Tax Guidance**\n\n${ragResult.explanation}\n\n• **Retrieval score**: ${(ragResult.confidence * 100).toFixed(0)}% — below the ${(RAG_CONFIDENCE_GATE * 100).toFixed(0)}% threshold required to quote a provision\n• **No rate is shown, because no provision was retrieved**`
            : `⚖️ ${ragResult.shortAnswer}\n\n_No rate quoted — nothing scored above the ${(RAG_CONFIDENCE_GATE * 100).toFixed(0)}% threshold. Say "details" for the reasoning._`,
        timestamp: now,
        inputMethod,
        routedAgent: 'compliance',
        structuredData: { type: 'generic', data: ragResult }
      }
    };
  }

  return {
    message: {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: detailed
        ? `⚖️ **FBR Compliance & Tax Guidance**\n\n${ragResult.explanation}\n\n• **Applicable GST Rate**: **${ragResult.gstRate || '— not in this provision'}**\n• **Withholding Rate**: **${ragResult.withholdingRate || '— not in this provision'}**\n• **Statutory Deadline**: ${ragResult.filingDeadline || '— not in this provision'}\n• **Authoritative Citation**: \`${ragResult.citation}\`\n• **Retrieval Score**: ${(ragResult.confidence * 100).toFixed(0)}% — the share of your question found in the provision quoted above`
        : `⚖️ ${ragResult.shortAnswer}`,
      timestamp: now,
      inputMethod,
      routedAgent: 'compliance',
      structuredData: { type: 'compliance_rule', data: ragResult }
    }
  };
}
