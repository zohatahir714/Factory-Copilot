/**
 * VOICE MIND — fastPath.ts
 * ≤10 unambiguous instant commands: zero-latency, works fully offline.
 * Everything else falls through to the mind (Groq). Returns the same
 * VoiceIntent shape the mind produces so the executor has one contract.
 */

import { normalizeUtterance, extractAmount } from './normalize';

export type VoiceAction =
  | 'query' | 'create_sale' | 'create_purchase_order' | 'create_cash_voucher'
  | 'create_supplier' | 'create_customer' | 'create_product'
  | 'navigate' | 'print' | 'guide' | 'compliance' | 'unknown';

export type QueryTopic =
  | 'cash' | 'gst' | 'sale_tax' | 'inventory' | 'receivables' | 'payables'
  | 'profit_loss' | 'parties' | 'day_book' | 'purchase_orders' | null;

export interface VoiceEntities {
  party: string | null;
  product: string | null;
  quantity: number | null;
  unit: string | null;
  amount: number | null;
  period: 'today' | 'this_month' | 'last_month' | 'fiscal_year' | null;
  module: string | null;
  document: string | null;
}

export interface VoiceIntent {
  action: VoiceAction;
  topic: QueryTopic;
  entities: VoiceEntities;
  confidence: number;
  clarification: string | null;
  /** 'fast' = regex hit, 'mind' = Groq-parsed, 'clarify' = needs user reply */
  source: 'fast' | 'mind' | 'clarify';
}

export const EMPTY_ENTITIES: VoiceEntities = {
  party: null, product: null, quantity: null, unit: null, amount: null,
  period: null, module: null, document: null
};

function intent(
  action: VoiceAction,
  topic: QueryTopic,
  patch: Partial<VoiceEntities>,
  confidence: number
): VoiceIntent {
  return { action, topic, entities: { ...EMPTY_ENTITIES, ...patch }, confidence, clarification: null, source: 'fast' };
}

/**
 * Fast-path matcher. Returns null when the utterance is not one of the
 * handful of unambiguous instant commands — the caller then escalates
 * to the mind. Deliberately conservative: anything partial must NOT
 * match here (that's how the old system collapsed to stock checks).
 */
export function tryFastPath(raw: string): VoiceIntent | null {
  const q = normalizeUtterance(raw);
  if (!q) return null;

  // — Navigation (unambiguous verb + module) —
  const NAV: Array<[RegExp, string]> = [
    [/^(?:ڈیش بورڈ|dashboard)(?:\s*(?:کھولو|کھول|kholo|open|show|دکھاؤ))?$/, 'dashboard'],
    [/^(?:رپورٹس?|reports?)(?:\s*(?:کھولو|کھول|kholo|open|show|دکھاؤ))?$/, 'reports'],
    [/^(?:کیش بک|cashbook)(?:\s*(?:کھولو|کھول|kholo|open|show|دکھاؤ))?$/, 'cashbook'],
    [/^(?:سیٹنگز?|settings)(?:\s*(?:کھولو|کھول|kholo|open|show|دکھاؤ))?$/, 'settings']
  ];
  for (const [re, module] of NAV) {
    if (re.test(q)) return intent('navigate', null, { module }, 0.95);
  }

  // — Cash position: «کتنا کیش ہے» / "cash kitna hai" / "cash balance" —
  if (/^(?:کتنا\s+)?کیش(?:\s*(?:ہے|کتنا|کتنی|چیک کرو|بقا))?|\bcash(?:\s+(?:balance|kitna|position|check))?\b/i.test(q)
      && !/تعداد|quantity|stock|اسٹاک/.test(q)) {
    return intent('query', 'cash', {}, 0.92);
  }

  // — GST collected: «GST کتنا وصول ہوا» / "gst collected" —
  if (/\bgst\b|جی ایس ٹی|ٹیکس\s+وصول/i.test(q) && /(وصول|collected|total|کتنا|kitna)/i.test(q)
      && !/sale\s*(?:par|پر)|سیل\s*پر/.test(q)) {
    return intent('query', 'gst', {}, 0.9);
  }

  return null;
}

/** Tax-on-amount: instant when a clean amount is present. */
export function tryFastPathTax(raw: string): VoiceIntent | null {
  const q = normalizeUtterance(raw);
  const amount = extractAmount(q);
  if (amount && /(?:ٹیکس|tax|gst)\b/i.test(q) && /(?:سیل|sale|calculate|نکلو|پر|on)/i.test(q)) {
    return intent('query', 'sale_tax', { amount }, 0.9);
  }
  return null;
}
