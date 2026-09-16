/**
 * VOICE MIND — executor.ts (Stage 1: queries)
 * Deterministic dispatch. The mind understands; the executor computes from
 * live state — it NEVER calls the LLM and never writes in Stage 1.
 *
 * Response discipline (spec §3.5): the spoken answer is ONE Urdu sentence
 * with just the asked figure, from templates. The rich stat card still
 * renders in the modal for eyes.
 */

import { formatPKR, calculateFBRTax } from '../../utils/fbrTaxEngine';
import type { VoiceIntent, QueryTopic } from './fastPath';

export interface ExecutorStats {
  label: string;
  value: string;
  color?: string;
}

export interface ExecutorResult {
  kind: 'query' | 'clarify';
  /** Minimal Urdu sentence — the ONLY text spoken aloud. */
  spoken: string;
  title: string;
  badge: string;
  stats: ExecutorStats[];
  details?: string;
  /** Optional module to open (modal→module hand-off). */
  openModule?: string;
}

export interface ExecutorState {
  cashbook: Array<{ type: 'inflow' | 'outflow'; amount: number; createdAt: string }>;
  salesOrders: Array<{ totalAmount: number; taxAmount?: number; createdAt: string }>;
  products: Array<{ name: string; currentStock: number; reorderThreshold: number; costPrice: number; sellingPrice: number; unit: string }>;
  customers: Array<{ name: string; outstandingReceivables: number }>;
  suppliers: Array<{ name: string }>;
  purchaseOrders: Array<{ status: string; totalAmount: number; poNumber: string; supplierName: string }>;
}

/** Exact-match party resolution: customers (AR balance) first, then suppliers (pending PO commitment). */
export function resolveParty(
  name: string | null,
  state: ExecutorState
): { name: string; balance: number; role: 'customer' | 'supplier' } | null {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  const cust = state.customers.find(c => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()));
  if (cust) return { name: cust.name, balance: cust.outstandingReceivables, role: 'customer' };
  const supp = (state.suppliers as Array<{ name: string; pendingCommitment?: number }>).find(
    s => s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase())
  );
  if (supp) {
    const commitment = supp.pendingCommitment ?? 0;
    return { name: supp.name, balance: commitment, role: 'supplier' };
  }
  return null;
}

/** Period filter helper: today / this_month. fiscal_year falls back to all. */
export function inPeriod(isoDate: string, period: VoiceIntent['entities']['period']): boolean {
  if (!period) return true;
  const d = new Date(isoDate);
  const now = new Date();
  if (period === 'today') return d.toDateString() === now.toDateString();
  if (period === 'this_month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (period === 'last_month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }
  return true; // fiscal_year: ledger filters handle the window; voice keeps it broad
}

function fmt(n: number): string {
  return formatPKR(n);
}

/** Compose the result for a query intent. Null topic → clarify. */
export function executeQuery(intent: VoiceIntent, state: ExecutorState): ExecutorResult {
  const topic: QueryTopic = intent.topic;
  switch (topic) {
    case 'cash': {
      const inflow = state.cashbook.filter(c => c.type === 'inflow').reduce((s, c) => s + c.amount, 0);
      const outflow = state.cashbook.filter(c => c.type === 'outflow').reduce((s, c) => s + c.amount, 0);
      const net = inflow - outflow;
      return {
        kind: 'query',
        spoken: `خالص نقد ${fmt(net)} روپے ہے۔`,
        title: 'Live Treasury & Cash Position',
        badge: 'Cashbook Ledger',
        stats: [
          { label: 'Net Cash', value: fmt(net), color: net >= 0 ? 'text-emerald-600' : 'text-red-600' },
          { label: 'Inflow', value: fmt(inflow), color: 'text-emerald-700' },
          { label: 'Outflow', value: fmt(outflow), color: 'text-red-600' }
        ],
        details: `Computed from ${state.cashbook.length} vouchers.`,
        openModule: 'cashbook'
      };
    }
    case 'gst': {
      const totalTax = state.salesOrders.reduce((s, v) => s + (v.taxAmount || 0), 0);
      const totalSales = state.salesOrders.reduce((s, v) => s + v.totalAmount, 0);
      return {
        kind: 'query',
        spoken: `کل ${fmt(totalTax)} روپے GST وصول ہوا ہے۔`,
        title: 'FBR 18% GST Collection',
        badge: 'Sales Tax Act 1990',
        stats: [
          { label: 'GST Collected', value: fmt(totalTax), color: 'text-indigo-600' },
          { label: 'Invoiced Volume', value: fmt(totalSales), color: 'text-indigo-600' },
          { label: 'Invoices', value: `${state.salesOrders.length}`, color: 'text-slate-900 dark:text-slate-200' }
        ],
        details: 'Annexure-C e-filing deadline: 10th of month.',
        openModule: 'fbr_integration'
      };
    }
    case 'inventory': {
      const low = state.products.filter(p => p.currentStock <= p.reorderThreshold);
      const valuation = state.products.reduce((s, p) => s + p.currentStock * p.costPrice, 0);
      return {
        kind: 'query',
        spoken: low.length
          ? `گودام میں ${state.products.length} آئٹم ہیں، ${low.length} کو ری آرڈر چاہیے۔`
          : `گودام میں ${state.products.length} آئٹم، کل ویلیویشن ${fmt(valuation)} روپے ہے۔`,
        title: 'Warehouse Stock & Inventory',
        badge: 'Live Stock Count',
        stats: [
          { label: 'Valuation', value: fmt(valuation), color: 'text-indigo-600' },
          { label: 'SKUs', value: `${state.products.length}`, color: 'text-slate-900 dark:text-slate-200' },
          { label: 'Low Stock', value: `${low.length}`, color: low.length ? 'text-red-600' : 'text-emerald-600' }
        ],
        details: low.length ? `Critical: ${low.map(p => `${p.name} (${p.currentStock} ${p.unit})`).join(', ')}` : 'All stock above reorder thresholds.',
        openModule: 'inventory'
      };
    }
    case 'receivables': {
      const party = resolveParty(intent.entities.party, state);
      if (party) {
        if (party.role === 'supplier') {
          return {
            kind: 'query',
            spoken: `${party.name} کو ${fmt(party.balance)} روپے ادا کرنے ہیں۔`,
            title: `Payable — ${party.name}`,
            badge: 'AP Sub-ledger',
            stats: [{ label: 'Outstanding', value: fmt(party.balance), color: 'text-amber-600' }],
            details: 'Bound to the live supplier registry (open PO commitments).',
            openModule: 'cashbook'
          };
        }
        return {
          kind: 'query',
          spoken: `${party.name} پر ${fmt(party.balance)} روپے وصولی باقی ہے۔`,
          title: `Receivable — ${party.name}`,
          badge: 'AR Sub-ledger',
          stats: [{ label: 'Outstanding', value: fmt(party.balance), color: 'text-emerald-600' }],
          details: 'Bound to the live customer registry.',
          openModule: 'customers'
        };
      }
      const total = state.customers.reduce((s, c) => s + (c.outstandingReceivables || 0), 0);
      const top = [...state.customers].sort((a, b) => b.outstandingReceivables - a.outstandingReceivables)[0];
      return {
        kind: 'query',
        spoken: `کل وصولی ${fmt(total)} روپے ہے۔`,
        title: 'Accounts Receivable',
        badge: 'AR Total',
        stats: [
          { label: 'Total AR', value: fmt(total), color: 'text-emerald-600' },
          { label: 'Customers', value: `${state.customers.length}`, color: 'text-slate-900 dark:text-slate-200' },
          { label: 'Top Debtor', value: top?.name || '—', color: 'text-indigo-600' }
        ],
        details: top ? `${top.name} owes ${fmt(top.outstandingReceivables)}.` : undefined,
        openModule: 'customers'
      };
    }
    case 'payables': {
      const committed = state.purchaseOrders.filter(p => p.status === 'pending').reduce((s, p) => s + p.totalAmount, 0);
      return {
        kind: 'query',
        spoken: `سپلائرز کو ${fmt(committed)} روپے ادا کرنے ہیں۔`,
        title: 'Supplier Payables & Commitments',
        badge: 'AP 2001',
        stats: [
          { label: 'Open PO Commitments', value: fmt(committed), color: 'text-amber-600' },
          { label: 'Suppliers', value: `${state.suppliers.length}`, color: 'text-slate-900 dark:text-slate-200' }
        ],
        details: 'Mirrors open purchase orders posted to AP (2001).',
        openModule: 'cashbook'
      };
    }
    case 'profit_loss': {
      const scoped = intent.entities.period
        ? state.salesOrders.filter(s => inPeriod(s.createdAt, intent.entities.period))
        : state.salesOrders;
      const revenue = scoped.reduce((s, v) => s + v.totalAmount - (v.taxAmount || 0), 0);
      const expenses = state.cashbook.filter(c => c.type === 'outflow' && inPeriod(c.createdAt, intent.entities.period))
        .reduce((s, c) => s + c.amount, 0);
      const net = revenue - expenses;
      const periodLabel = intent.entities.period === 'this_month' ? 'اس ماہ' : intent.entities.period === 'today' ? 'آج' : 'کل';
      return {
        kind: 'query',
        spoken: `${periodLabel} خالص ${net >= 0 ? 'منافع' : 'نقصان'} ${fmt(Math.abs(net))} روپے ہے۔`,
        title: 'Profit & Loss Snapshot',
        badge: 'Live from ledger',
        stats: [
          { label: 'Revenue (ex-GST)', value: fmt(revenue), color: 'text-emerald-600' },
          { label: 'Expenses', value: fmt(expenses), color: 'text-red-600' },
          { label: net >= 0 ? 'Net Profit' : 'Net Loss', value: fmt(Math.abs(net)), color: net >= 0 ? 'text-emerald-600' : 'text-red-600' }
        ],
        details: 'Authoritative statement lives in Reports → P&L.',
        openModule: 'reports'
      }
    }
    case 'parties': {
      const ar = state.customers.reduce((s, c) => s + (c.outstandingReceivables || 0), 0);
      return {
        kind: 'query',
        spoken: `${state.customers.length} گاہک اور ${state.suppliers.length} سپلائر رجسٹرڈ ہیں۔`,
        title: 'Customer & Supplier Registry',
        badge: 'Partner Registry',
        stats: [
          { label: 'Customers', value: `${state.customers.length}`, color: 'text-indigo-600' },
          { label: 'Suppliers', value: `${state.suppliers.length}`, color: 'text-indigo-600' },
          { label: 'Total AR', value: fmt(ar), color: 'text-emerald-600' }
        ],
        details: 'Each party auto-creates its AR/AP sub-ledger in the Chart of Accounts.',
        openModule: 'customers'
      };
    }
    case 'day_book': {
      const today = new Date().toISOString().slice(0, 10);
      const todays = state.cashbook.filter(v => v.createdAt.slice(0, 10) === today);
      const inflow = todays.filter(v => v.type === 'inflow').reduce((s, v) => s + v.amount, 0);
      const outflow = todays.filter(v => v.type === 'outflow').reduce((s, v) => s + v.amount, 0);
      return {
        kind: 'query',
        spoken: `آج ${todays.length} انٹریز: وصول ${fmt(inflow)}، ادا ${fmt(outflow)}۔`,
        title: "Today's Day Book",
        badge: today,
        stats: [
          { label: 'Entries', value: `${todays.length}`, color: 'text-slate-900 dark:text-slate-200' },
          { label: 'Inflow', value: fmt(inflow), color: 'text-emerald-600' },
          { label: 'Outflow', value: fmt(outflow), color: 'text-red-600' }
        ],
        details: 'Full statement: Reports → Daily Cashbook.',
        openModule: 'reports'
      };
    }
    case 'purchase_orders': {
      const pending = state.purchaseOrders.filter(p => p.status === 'pending');
      const committed = pending.reduce((s, p) => s + p.totalAmount, 0);
      return {
        kind: 'query',
        spoken: `${pending.length} پرچیز آرڈرز پینڈنگ ہیں، ${fmt(committed)} روپے کی۔`,
        title: 'Procurement Pipeline',
        badge: 'Pending POs',
        stats: [
          { label: 'Committed Spend', value: fmt(committed), color: 'text-amber-600' },
          { label: 'Pending POs', value: `${pending.length}`, color: 'text-slate-900 dark:text-slate-200' }
        ],
        details: pending.length ? `Earliest: ${pending[0].poNumber} — ${pending[0].supplierName}.` : 'All orders fulfilled.',
        openModule: 'purchase'
      };
    }
    case 'sale_tax': {
      const amount = intent.entities.amount || 100000;
      const filer = calculateFBRTax({ amount, isFiler: true, isRegisteredSalesTax: true });
      const nonFiler = calculateFBRTax({ amount, isFiler: false, isRegisteredSalesTax: false });
      return {
        kind: 'query',
        spoken: `${fmt(amount)} روپے کی سیل پر GST ${fmt(filer.gstAmount)} روپے بنتا ہے۔`,
        title: `FBR Tax Calculation — ${fmt(amount)}`,
        badge: 'SRO 1805(I)/2024',
        stats: [
          { label: 'Pre-Tax Supply', value: fmt(amount), color: 'text-slate-900 dark:text-slate-100' },
          { label: '18% GST', value: `+ ${fmt(filer.gstAmount)}`, color: 'text-indigo-600' },
          { label: 'Filer Total', value: fmt(filer.grandTotal), color: 'text-indigo-600' },
          { label: 'Non-Filer (+4%)', value: fmt(nonFiler.grandTotal), color: 'text-amber-600' }
        ],
        details: `Fiscal Invoice ID: ${filer.fbrFiscalInvoiceNumber}`,
        openModule: 'sales'
      };
    }
    default:
      return {
        kind: 'clarify',
        spoken: intent.clarification || 'معاف کیجیے — یہ سوال میری فہرست میں نہیں۔ دوبارہ پوچھیے؟',
        title: 'Clarification needed',
        badge: 'Voice Mind',
        stats: []
      };
  }
}

/** Compose the clarification result for a low-confidence mind answer. */
export function clarifyResult(intent: VoiceIntent): ExecutorResult {
  return {
    kind: 'clarify',
    spoken: intent.clarification || 'معاف کیجیے — سمجھ نہیں آیا۔ دوبارہ بتائیے؟',
    title: 'Voice Mind',
    badge: 'Clarification',
    stats: []
  };
}

/**
 * STAGE 2 — WRITE PREPARATION
 * Resolves a create_* intent against live state and produces a pending
 * payload for the spoken-confirmation loop. Pure: no network, no writes.
 * Pricing mirrors the commit path exactly:
 *  - sale: unitPrice = product.sellingPrice, 18% GST on subtotal
 *  - PO:   unitPrice = product.costPrice (createPurchaseOrderDirect pricing)
 */
export interface PendingWrite {
  action: 'create_sale' | 'create_purchase_order' | 'create_cash_voucher' | 'create_supplier' | 'create_customer' | 'create_product';
  /** Urdu confirmation sentence the voice speaks and the card shows. */
  confirmSpoken: string;
  /** Display label for the confirmation card. */
  label: string;
  /** Payload consumed by the modal's commit switch. */
  payload: Record<string, unknown>;
}

const COMMIT_SALE = { taxRate: 18, isFiler: true } as const;

export function prepareWrite(intent: VoiceIntent, state: ExecutorState): { ok: true; pending: PendingWrite } | { ok: false; reason: ExecutorResult } {
  const e = intent.entities;

  switch (intent.action) {
    case 'create_sale': {
      const customer = resolveParty(e.party, state);
      if (!customer || customer.role !== 'customer') {
        return { ok: false, reason: { kind: 'clarify', spoken: 'یہ گاہک رجسٹرڈ نہیں — پہلے گاہک رجسٹر کریں۔', title: 'Customer not found', badge: 'Voice Write', stats: [] } };
      }
      const product = state.products.find(p =>
        (e.product && (p.name.toLowerCase().includes(e.product.toLowerCase()) || e.product.toLowerCase().includes(p.name.toLowerCase())))
      );
      if (!product) {
        return { ok: false, reason: { kind: 'clarify', spoken: 'کون سا مال بیچنا ہے؟', title: 'Product needed', badge: 'Voice Write', stats: [] } };
      }
      const quantity = e.quantity;
      if (!quantity || quantity <= 0) {
        return { ok: false, reason: { kind: 'clarify', spoken: 'کتنا مال بیچنا ہے؟', title: 'Quantity needed', badge: 'Voice Write', stats: [] } };
      }
      if (quantity > product.currentStock) {
        return { ok: false, reason: { kind: 'clarify', spoken: `اسٹاک ناکافی ہے — دستیاب ${product.currentStock} ${product.unit} ہے۔`, title: 'Insufficient stock', badge: 'Voice Write', stats: [{ label: 'Available', value: `${product.currentStock} ${product.unit}`, color: 'text-red-600' }] } };
      }
      const subtotal = product.sellingPrice * quantity;
      const taxAmount = Math.round((subtotal * COMMIT_SALE.taxRate) / 100);
      const totalAmount = subtotal + taxAmount;
      return {
        ok: true,
        pending: {
          action: 'create_sale',
          confirmSpoken: `${customer.name} کو ${quantity} ${product.unit} ${product.name}، کل ${fmt(totalAmount)} روپے (GST سمیت) — tasdeeq karein؟`,
          label: `Sell ${quantity} ${product.unit} ${product.name} → ${customer.name}`,
          payload: { customerKey: customer.name, productKey: product.name, quantity, subtotal, taxRate: COMMIT_SALE.taxRate, taxAmount, totalAmount, isFiler: COMMIT_SALE.isFiler }
        }
      };
    }
    case 'create_purchase_order': {
      const supplier = resolveParty(e.party, state);
      if (!supplier || supplier.role !== 'supplier') {
        return { ok: false, reason: { kind: 'clarify', spoken: 'یہ سپلائر رجسٹرڈ نہیں — پہلے سپلائر رجسٹر کریں۔', title: 'Supplier not found', badge: 'Voice write', stats: [] } };
      }
      const product = state.products.find(p =>
        (e.product && (p.name.toLowerCase().includes(e.product.toLowerCase()) || e.product.toLowerCase().includes(p.name.toLowerCase())))
      );
      if (!product) {
        return { ok: false, reason: { kind: 'clarify', spoken: 'کون سا مال منگواؤنا ہے؟', title: 'Product needed', badge: 'Voice Write', stats: [] } };
      }
      const quantity = e.quantity;
      if (!quantity || quantity <= 0) {
        return { ok: false, reason: { kind: 'clarify', spoken: 'کتنا منگواؤنا ہے؟', title: 'Quantity needed', badge: 'Voice Write', stats: [] } };
      }
      const totalAmount = product.costPrice * quantity;
      return {
        ok: true,
        pending: {
          action: 'create_purchase_order',
          confirmSpoken: `${supplier.name} سے ${quantity} ${product.unit} ${product.name}، کل ${fmt(totalAmount)} روپے — tasdeeq karein؟`,
          label: `Order ${quantity} ${product.unit} ${product.name} ← ${supplier.name}`,
          payload: { supplierKey: supplier.name, productKey: product.name, quantity, totalAmount }
        }
      };
    }
    case 'create_cash_voucher': {
      const amount = e.amount;
      if (!amount || amount <= 0) {
        return { ok: false, reason: { kind: 'clarify', spoken: 'کتنی رقم کا واؤچر ہے؟', title: 'Amount needed', badge: 'Voice Write', stats: [] } };
      }
      const desc = e.product || 'Voice Cash Voucher';
      return {
        ok: true,
        pending: {
          action: 'create_cash_voucher',
          confirmSpoken: `${fmt(amount)} روپے کا کیش واؤچر — tasdeeq karein؟`,
          label: `Cash voucher Rs. ${amount.toLocaleString()}`,
          payload: { amount, description: desc, type: 'outflow' }
        }
      };
    }
    case 'create_supplier': {
      const name = e.party;
      if (!name) {
        return { ok: false, reason: { kind: 'clarify', spoken: 'سپلائر کا نام بتائیے۔', title: 'Supplier name needed', badge: 'Voice Write', stats: [] } };
      }
      return {
        ok: true,
        pending: {
          action: 'create_supplier',
          confirmSpoken: `نیا سپلائر «${name}» رجسٹر کریں؟`,
          label: `Register supplier: ${name}`,
          payload: { name, city: '', phone: '', email: '', leadTimeDays: 7, paymentTerms: 'Net 30' }
        }
      };
    }
    case 'create_customer': {
      const name = e.party;
      if (!name) {
        return { ok: false, reason: { kind: 'clarify', spoken: 'گاہک کا نام بتائیے۔', title: 'Customer name needed', badge: 'Voice Write', stats: [] } };
      }
      return {
        ok: true,
        pending: {
          action: 'create_customer',
          confirmSpoken: `نیا گاہک «${name}» رجسٹر کریں؟`,
          label: `Register customer: ${name}`,
          payload: { name, city: '', phone: '', email: '', creditLimit: 0 }
        }
      };
    }
    case 'create_product': {
      const name = e.product || e.party;
      if (!name) {
        return { ok: false, reason: { kind: 'clarify', spoken: 'پروڈکٹ کا نام بتائیے۔', title: 'Product name needed', badge: 'Voice Write', stats: [] } };
      }
      return {
        ok: true,
        pending: {
          action: 'create_product',
          confirmSpoken: `نیا پروڈکٹ «${name}» شامل کریں؟`,
          label: `Register product: ${name}`,
          payload: { name, sku: name.replace(/\s+/g, '-').toUpperCase().slice(0, 12), category: 'general', unit: (e.unit as any) || 'kg', costPrice: 0, sellingPrice: 0, reorderThreshold: 0, currentStock: 0 }
        }
      };
    }
    default:
      return { ok: false, reason: clarifyResult(intent) };
  }
}
