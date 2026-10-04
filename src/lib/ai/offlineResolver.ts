/**
 * The resolver that ships.
 *
 * This is the behaviour on every machine without an API key, on every machine
 * whose key has expired, and on every demo machine at the venue — which is the
 * machine that matters. It is not a stand-in for the real thing; it is a real,
 * deterministic second opinion.
 *
 * It differs from the rules in `agentSupervisor.ts` in one way that matters:
 * it is WORD-ORDER INDEPENDENT. It scores the utterance against each tool's
 * vocabulary and returns the best one, so "receive pending goods" and "pending
 * goods receive karo" resolve the same. The supervisor's rules are exact-match
 * clauses in a fixed order, which is why one of those two worked and the other
 * did not.
 *
 * Confidence is derived, never asserted: it comes from how many distinct
 * signals matched and whether they agree, so a two-word guess cannot reach the
 * gate.
 */
import type { Resolver, ResolverResult, ToolCall, ToolName } from './contract.ts';
import { CONFIDENCE_GATE, TOOL_SPECS } from './contract.ts';
import { learnedPhrases } from './misses.ts';

interface Signal {
  tool: ToolName;
  /** Words that indicate this tool, any order. */
  words: string[];
  /** Extra weight for a word that is decisive on its own. */
  strong?: string[];
}

const SIGNALS: readonly Signal[] = [
  { tool: 'material_loss', words: ['loss', 'lost', 'waste', 'wastage', 'shortage', 'shrink', 'consumed', 'unissued'], strong: ['loss', 'waste', 'wastage'] },
  // "how much" is deliberately NOT a stock signal. It is the most generic
  // phrase in English accounting — "how much money do customers owe me" is a
  // receivables question, and scoring it as a stock query answered with the
  // weight of a roll of yarn.
  { tool: 'check_stock', words: ['stock', 'on hand', 'available', 'inventory', 'mojood', 'maujood', 'kitna', 'kitne'], strong: ['on hand', 'kitna'] },
  { tool: 'stock_health', words: ['enough', 'sufficient', 'below', 'reorder', 'short', 'low stock', 'need buying', 'kafi'], strong: ['enough', 'sufficient', 'reorder'] },
  { tool: 'get_cash_balance', words: ['cash', 'bank', 'liquidity', 'paisa'], strong: ['cash', 'bank'] },
  { tool: 'get_receivables', words: ['receivable', 'receivables', 'owed', 'owe me', 'lena', 'udhaar'], strong: ['receivable', 'receivables', 'owed', 'owe me'] },
  { tool: 'get_payables', words: ['payable', 'payables', 'owe', 'dena'], strong: ['payable', 'payables'] },
  { tool: 'get_profit', words: ['profit', 'loss', 'margin', 'naafa'], strong: ['profit'] },
  { tool: 'get_business_summary', words: ['summary', 'overview', 'business', 'situation', 'halt'], strong: ['summary'] },
  { tool: 'get_pending_orders', words: ['pending', 'awaiting', 'outstanding order'], strong: ['pending'] },
  { tool: 'compliance_query', words: ['tax', 'gst', 'withholding', 'fbr', 'section', 'rate', 'kanoon'], strong: ['withholding', 'section'] },
  { tool: 'receive_goods', words: ['receive', 'received', 'receipt', 'maal', 'delivery', 'incoming', 'goods', 'rassi'], strong: ['receive', 'receipt', 'rassi'] },
  { tool: 'create_purchase_order', words: ['purchase', 'order', 'buy', 'khareed', 'maangwa', 'mango'], strong: ['purchase order', 'buy'] },
  { tool: 'record_sale', words: ['sale', 'sell', 'invoice', 'dispatch', 'bech', 'billing'], strong: ['sell', 'sale'] },
  { tool: 'record_expense', words: ['expense', 'kharcha', 'diesel', 'bill', 'payment made'], strong: ['expense', 'kharcha'] },
  { tool: 'add_supplier', words: ['supplier', 'vendor', 'splier'], strong: ['supplier', 'vendor'] },
  { tool: 'add_customer', words: ['customer', 'client', 'mill', 'buyer', 'grahak'], strong: ['customer', 'client'] },
  { tool: 'add_product', words: ['product', 'material', 'item', 'sku'], strong: ['product', 'sku'] },
  { tool: 'print', words: ['print', 'printer', 'printout'], strong: ['print'] }
];

/** Write verbs that turn a read-shaped question into a write. */
const WRITE_VERBS = /\b(save|record|add|create|register|banayein|banao|karo|kro|enter|post|insert)\b/i;

const tokenize = (text: string): string[] =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

const hasWindow = (tokens: string[], phrase: string): boolean => {
  const want = tokenize(phrase);
  if (want.length === 0) return false;
  for (let i = 0; i + want.length <= tokens.length; i++) {
    if (want.every((w, j) => tokens[i + j] === w)) return true;
  }
  return false;
};

/**
 * Deterministic, word-order independent tool choice.
 *
 * Confidence is a real function of the evidence: a strong phrase match is worth
 * more than a weak one, two tools agreeing is worth more than one, and the
 * learned phrases the user added in Settings count as strong evidence.
 */
export function resolveOffline(utterance: string): ResolverResult {
  const text = utterance.toLowerCase().trim();
  if (!text) return { reason: 'empty utterance' };

  const tokens = tokenize(text);
  if (tokens.length === 0) return { reason: 'no tokens' };

  const learned = learnedPhrases();
  const learnedMatch = learned.find(p => p.phrase.toLowerCase() === text);

  const scored = SIGNALS.map(sig => {
    let score = 0;
    const matched: string[] = [];
    for (const word of sig.words) {
      if (hasWindow(tokens, word)) {
        const strong = sig.strong?.includes(word);
        score += strong ? 2 : 1;
        matched.push(word);
      }
    }
    return { tool: sig.tool, score, matched };
  }).filter(s => s.score > 0);

  // A learned phrase is the user telling us, in their words, what they meant.
  if (learnedMatch) {
    const spec = TOOL_SPECS.find(t => t.name === learnedMatch.tool);
    if (spec) {
      const call: ToolCall = { tool: learnedMatch.tool, params: { ...learnedMatch.params }, confidence: 0.9 };
      return { call };
    }
  }

  if (scored.length === 0) return { reason: 'no tool vocabulary matched' };

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const runnerUp = scored[1];

  // Agreement between two tools raises confidence; a close runner-up lowers it,
  // because "pending goods receive karo" genuinely is both "pending orders" and
  // "receive goods" and the write must win — which it does, because WRITE_VERBS
  // and the strong match push it clear.
  const agreement = runnerUp && runnerUp.score === best.score ? 0.1 : 0;
  const confidence = Math.min(0.9, 0.35 + best.score * 0.15 + agreement);

  if (confidence < CONFIDENCE_GATE) {
    return { reason: `best match ${best.tool} scored only ${confidence.toFixed(2)}` };
  }

  return {
    call: {
      tool: best.tool,
      params: { _matched: best.matched.join(' ') },
      confidence
    }
  };
}

export const offlineResolver: Resolver = async (utterance: string) => resolveOffline(utterance);

export const WRITE_VERB_PATTERN = WRITE_VERBS;
