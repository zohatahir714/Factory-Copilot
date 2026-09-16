/**
 * VOICE MIND — mind.ts
 * The understanding layer: parses a free-form Urdu/Roman/English utterance
 * into a validated VoiceIntent using Groq structured output, with a
 * live-state digest so spoken entities bind to real records.
 *
 * Contract (spec §3.4):
 *  - confidence < 0.6 or unknown entity → clarification question (no action)
 *  - invalid JSON → one strict retry → throw (caller falls back to chat)
 *  - network failure → throw (caller falls back per spec §6)
 *
 * buildMindPrompt() and parseMindResponse() are exported pure so the
 * fixture suite can test understanding deterministically without network.
 */

import { queryGroqChat } from '../groqClient';
import { normalizeUtterance, extractAmount, extractQuantityUnit } from './normalize';
import { tryFastPath, tryFastPathTax, EMPTY_ENTITIES, type VoiceIntent, type VoiceAction, type QueryTopic } from './fastPath';

/** Minimal live-state snapshot embedded in the mind's prompt (spec §3.3). */
export interface LiveStateDigest {
  businessName?: string;
  customers: Array<{ name: string; city?: string; balance?: number }>;
  suppliers: Array<{ name: string; city?: string }>;
  products: Array<{ name: string; sku: string; unit: string; stock?: number }>;
}

const MIND_SYSTEM_PROMPT = `You are the Voice Mind of PakERP Cloud Suite, a Pakistani textile-SME ERP.
Parse the user's spoken utterance into ONE JSON object. No prose, no markdown — JSON only.

Schema:
{
  "action": "query" | "create_sale" | "create_purchase_order" | "create_cash_voucher" | "create_supplier" | "create_customer" | "create_product" | "navigate" | "print" | "guide" | "compliance" | "unknown",
  "topic": "cash" | "gst" | "sale_tax" | "inventory" | "receivables" | "payables" | "profit_loss" | "parties" | "day_book" | "purchase_orders" | null,
  "entities": {
    "party": "<customer or supplier name exactly as it appears in the digest, or null>",
    "product": "<product name exactly as in digest, or null>",
    "quantity": <number or null>,
    "unit": "kg" | "meters" | "liters" | "bags" | "cones" | "rolls" | "pieces" | null,
    "amount": <number or null>,
    "period": "today" | "this_month" | "last_month" | "fiscal_year" | null,
    "module": "dashboard" | "inventory" | "purchase" | "sales" | "cashbook" | "reports" | "fbr_integration" | "compliance" | "copilot" | "settings" | null,
    "document": "invoice" | "purchase_order" | "cash_voucher" | "inventory_report" | null
  },
  "confidence": <0.0-1.0>,
  "clarification": "<Urdu question to ask the user when confidence < 0.6 or an entity matches nothing, else null>"
}

Rules:
1. The utterance may be Urdu script, Roman Urdu, or English — treat all as equal.
2. Bind spoken entity words to the LIVE DIGEST below. «سبیر» → the customer whose name contains it. «یارن» → the product whose name matches. If a referenced EXISTING entity matches nothing, set confidence ≤ 0.5 and put an Urdu clarifying question in "clarification".
2b. EXCEPTION — creation flows introduce NEW records: for create_supplier / create_customer / create_product, extract the NEW name verbatim from the utterance into "party" (supplier/customer) or "product" (product) even though it is not in the digest. Example: «Adil Textiles نام سے نیا سپلائر رجسٹر کرو» → party: "Adil Textiles". Never ask for clarification when the new name is clearly stated.
3. Convert Urdu number words: پچاس=50, سو=100, ہزار/چھیاسی etc. «چھیاسی ہزار» = 86000. لاکھ=100000, کروڑ=10000000.
4. «سیل»/«بیک»/«فروخت» about goods → create_sale. «منگواؤ»/«آرڈر»/«خریداری» → create_purchase_order. «ادا کرو»/«خرچ»/«واؤچر» with cash → create_cash_voucher.
5. Questions about data («کتنا», «کتنی», «بتاؤ», how much, what is) → action "query" + the right topic.
6. Tax law / SRO / section questions → action "compliance". "How do I X" / «کیسے» / «سمجھائیں» → action "guide" with entities.module set to the topic (sale/purchase/cashbook/reports/compliance/system).
6b. Period words: «آج»=today, «اس ماہ»/«is mahine»=this_month, «پچھلے مہینے»/«pichhle mahine»=last_month, «مالی سال»=fiscal_year — set entities.period for query topics like profit_loss/day_book.
6c. Navigation: «کھولو»/«kholo»/«دکھاؤ» + module name → action "navigate"; entities.module from: dashboard, inventory, purchase, sales, cashbook, reports, compliance, copilot, settings, fbr_integration, customers, suppliers, movements. Printing: «پرنٹ»/«چھاپ»/print → action "print"; entities.document: invoice/purchase_order/cash_voucher/inventory_report.
7. NEVER invent entities not in the digest. NEVER guess. Answer in JSON only.`;

/** Build the complete system prompt including the live digest. */
export function buildMindPrompt(digest: LiveStateDigest): string {
  const lines: string[] = [];
  lines.push(`Business: ${digest.businessName || 'Unknown'} • Date: ${new Date().toISOString().slice(0, 10)} • GST 18%`);
  if (digest.customers.length) {
    lines.push('CUSTOMERS: ' + digest.customers.map(c => `${c.name}${c.city ? ` (${c.city})` : ''}${typeof c.balance === 'number' ? ` [owes Rs.${c.balance}]` : ''}`).join(' | '));
  }
  if (digest.suppliers.length) {
    lines.push('SUPPLIERS: ' + digest.suppliers.map(s => `${s.name}${s.city ? ` (${s.city})` : ''}`).join(' | '));
  }
  if (digest.products.length) {
    lines.push('PRODUCTS: ' + digest.products.map(p => `${p.name} (SKU ${p.sku}, per ${p.unit})`).join(' | '));
  }
  return `${MIND_SYSTEM_PROMPT}\n\nLIVE DIGEST (bind entities ONLY to these):\n${lines.join('\n')}`;
}

const VALID_ACTIONS: VoiceAction[] = [
  'query', 'create_sale', 'create_purchase_order', 'create_cash_voucher',
  'create_supplier', 'create_customer', 'create_product',
  'navigate', 'print', 'guide', 'compliance', 'unknown'
];
const VALID_TOPICS: QueryTopic[] = [
  'cash', 'gst', 'sale_tax', 'inventory', 'receivables', 'payables',
  'profit_loss', 'parties', 'day_book', 'purchase_orders', null
];

/**
 * Validate + coerce the model's JSON into a VoiceIntent.
 * Returns null when the response is structurally unusable (triggers retry).
 */
export function parseMindResponse(raw: string): VoiceIntent | null {
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let obj: any;
  try { obj = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;

  const action: VoiceAction = VALID_ACTIONS.includes(obj.action) ? obj.action : 'unknown';
  const topic: QueryTopic = VALID_TOPICS.includes(obj.topic) ? obj.topic : null;
  const e = obj.entities && typeof obj.entities === 'object' ? obj.entities : {};
  const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

  return {
    action,
    topic,
    entities: {
      party: str(e.party), product: str(e.product),
      quantity: num(e.quantity), unit: str(e.unit),
      amount: num(e.amount),
      period: ['today', 'this_month', 'last_month', 'fiscal_year'].includes(e.period) ? e.period : null,
      module: str(e.module), document: str(e.document)
    },
    confidence: typeof obj.confidence === 'number' ? Math.min(1, Math.max(0, obj.confidence)) : 0,
    clarification: str(obj.clarification),
    source: 'mind'
  };
}

export interface MindResult {
  intent: VoiceIntent;
  /** True when the fast-path answered (no LLM call was made). */
  fromFastPath: boolean;
}

/**
 * Understand one utterance. Fast-path first; everything else goes to the
 * Groq mind with one strict retry on invalid JSON.
 *
 * @param parseOverride test seam — injects a fake parse (fixture suite).
 */
export async function understand(
  rawUtterance: string,
  digest: LiveStateDigest,
  parseOverride?: (raw: string) => VoiceIntent | null
): Promise<MindResult> {
  const fast = tryFastPath(rawUtterance) || tryFastPathTax(rawUtterance);
  if (fast) return { intent: fast, fromFastPath: true };

  const utterance = normalizeUtterance(rawUtterance);
  const parse = parseOverride || parseMindResponse;
  const systemPrompt = buildMindPrompt(digest);

  let last: VoiceIntent | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await queryGroqChat(
      [{ role: 'user', content: attempt === 0 ? utterance : `${utterance}\n\n(Prior reply was not valid JSON matching the schema. Return JSON ONLY.)` }],
      '',
      systemPrompt
    );
    last = parse(reply);
    if (last) break;
  }
  if (!last) throw new Error('MIND_INVALID_JSON');

  if (last.confidence < 0.6 || last.action === 'unknown') {
    return {
      intent: {
        ...last,
        action: 'unknown',
        clarification: last.clarification || 'معاف کیجیے — سمجھ نہیں آیا۔ دوبارہ بتائیے؟',
        source: 'clarify'
      },
      fromFastPath: false
    };
  }
  return { intent: last, fromFastPath: false };
}
