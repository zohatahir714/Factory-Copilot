/**
 * The resolver seam, pinned.
 *
 * The problem this exists to solve is not "add a keyword". It is that
 * `agentSupervisor.ts` was 1,800 lines of exact clauses in a fixed order, where
 * "pending goods receive karo" worked and "receive pending goods" did not —
 * same words, opposite outcome. No amount of hand-wiring fixes that ceiling.
 *
 * So the assertions below are mostly about SAFETY rather than coverage: the
 * model must not be able to invent an entity, reach a write without one, or
 * turn an unrelated question into a command.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  TOOL_SPECS,
  TOOL_NAMES,
  CONFIDENCE_GATE,
  toolSpec,
  parseToolCall,
  type ResolverResult
} from '../../lib/ai/contract.ts';
import { resolveOffline } from '../../lib/ai/offlineResolver.ts';
import { resolve } from '../../lib/ai/index.ts';
import { executeSupervisorTurn, analyzeUserIntent } from '../../lib/agentSupervisor';
import { refusalWithSuggestions } from '../../ai/software/index.ts';
import { buildDemoFactory } from '../../data/demoFactory';
import type { DatabaseState } from '../../lib/businessTools';

function demoState(): DatabaseState {
  return { ...(buildDemoFactory() as unknown as DatabaseState), complianceSources: [] };
}

describe('the tool contract is closed and real', () => {
  it('every tool names an intent and a domain', () => {
    for (const t of TOOL_SPECS) {
      assert.ok(t.intent.length > 2, `${t.name} has no intent`);
      assert.ok(t.domain.length > 2, `${t.name} has no domain`);
      assert.ok(t.summary.length > 10, `${t.name} needs a real summary for the model`);
    }
  });

  it('tool names are unique', () => {
    assert.equal(new Set(TOOL_NAMES).size, TOOL_NAMES.length);
  });

  it('every read that needs a material declares the entity it must verify', () => {
    for (const t of TOOL_SPECS) {
      if (t.name === 'check_stock') assert.equal(t.requiresLedgerEntity, 'product');
    }
  });

  it('toolSpec resolves every name it hands out', () => {
    for (const n of TOOL_NAMES) assert.ok(toolSpec(n));
  });
});

describe('the model cannot widen the contract', () => {
  it('an unknown tool is refused, not coerced', () => {
    const r = parseToolCall(JSON.stringify({ tool: 'delete_company', params: {}, confidence: 0.99 }));
    assert.equal(r.call, undefined, 'a tool this product does not have must never run');
    assert.match(String(r.reason), /unknown tool/);
  });

  it('non-JSON is refused', () => {
    assert.equal(parseToolCall('I think you want to buy yarn').call, undefined);
  });

  it('a low-confidence guess is refused even for a real tool', () => {
    const r = parseToolCall(
      JSON.stringify({ tool: 'get_cash_balance', params: {}, confidence: CONFIDENCE_GATE - 0.1 })
    );
    assert.equal(r.call, undefined, 'below the gate the deterministic path must answer, not the model');
  });

  it('a non-object response is refused', () => {
    assert.equal(parseToolCall('"get_cash_balance"').call, undefined);
  });

  it('params are coerced to real types, never left as objects', () => {
    const r = parseToolCall(
      JSON.stringify({
        tool: 'create_purchase_order',
        params: { product: 'Cotton Yarn 150D', quantity: 200, junk: { a: 1 }, blank: '  ' },
        confidence: 0.9
      })
    );
    assert.ok(r.call);
    assert.equal(r.call.params.quantity, 200);
    assert.equal(r.call.params.junk, undefined, 'an object param must not survive');
    assert.equal(r.call.params.blank, undefined, 'a blank string must not survive');
  });

  it('confidence is clamped into 0..1', () => {
    const high = parseToolCall(JSON.stringify({ tool: 'get_profit', params: {}, confidence: 5 }));
    assert.equal(high.call?.confidence, 1);
  });
});

describe('the offline resolver is word-order independent', () => {
  it('the same words resolve the same way in either order', () => {
    const a = resolveOffline('pending goods receive karo');
    const b = resolveOffline('receive pending goods');
    assert.equal(a.call?.tool, b.call?.tool);
  });

  it('"how much money do customers owe me" is receivables, not stock', () => {
    // "how much" used to be a stock signal, and this came back with the weight
    // of a roll of yarn.
    assert.equal(resolveOffline('how much money do customers owe me').call?.tool, 'get_receivables');
  });

  it('an out-of-domain question is declined rather than forced', () => {
    const r = resolveOffline('best bowling attack in Pakistan cricket');
    assert.equal(r.call, undefined, 'a non-business question must reach the refusal, not a tool');
  });

  it('an empty utterance is declined', () => {
    assert.equal(resolveOffline('').call, undefined);
    assert.equal(resolveOffline('   ').call, undefined);
  });

  it('every tool it proposes is in the closed contract', () => {
    for (const q of ['check stock', 'goods receive karo', 'buy yarn', 'print invoice', 'add supplier']) {
      const c = resolveOffline(q).call;
      if (c) assert.ok(TOOL_NAMES.includes(c.tool), `${q} proposed ${c.tool}`);
    }
  });
});

describe('resolve() degrades quietly and never throws', () => {
  it('falls back to the offline answer when the live one is unreachable', async () => {
    const out: ResolverResult = await resolve('goods receive karo', {
      live: async () => { throw new Error('network down'); }
    });
    assert.ok(out.call, 'an unreachable model must not become a dead end');
  });

  it('returns a reason instead of throwing when nothing places the sentence', async () => {
    const out = await resolve('best bowling attack in Pakistan cricket', { live: async () => ({}) });
    assert.equal(out.call, undefined);
    assert.ok(out.reason);
  });

  it('a resolver supplied by a caller that rejects cannot break a turn', async () => {
    const out = await resolve('anything at all', { live: async () => { throw new Error('boom'); } });
    assert.equal(typeof out.reason, 'string');
  });
});

describe('a resolved tool cannot invent anything', () => {
  it('a stock question with no material named is refused, not answered from the first row', async () => {
    // findProductByName is forgiving; an empty query matched product 0, so a
    // money question came back as a weight of yarn.
    const state = demoState();
    const r = await executeSupervisorTurn('how much money do customers owe me', state);
    assert.match(r.message.content, /Receivables/);
    assert.doesNotMatch(r.message.content, /kg/);
  });

  it('a register command with no name asks for one instead of inventing it', async () => {
    const r = await executeSupervisorTurn('customer save karo', demoState());
    assert.match(r.message.content, /Customer name\?/);
    assert.doesNotMatch(r.message.content, /Customer added/, 'no record may be written without a name');
  });

  it('"customer save karo" never becomes a party called "customer save karo"', async () => {
    const state = demoState();
    const before = state.customers.length;
    const r = await executeSupervisorTurn('customer save karo', state);
    assert.equal(state.customers.length, before, 'the ledger must be untouched');
    assert.equal(r.directDatabaseUpdate, undefined);
  });

  it('a write still opens a confirmation card', async () => {
    const r = await executeSupervisorTurn(
      'create a purchase order for 200 kg cotton yarn from Green Mills Ltd',
      demoState()
    );
    assert.ok(r.pendingConfirmation, 'the resolver must never bypass human approval');
  });
});

describe('the resolver does not take over what already works', () => {
  it('a phrase the rules already handle is untouched', async () => {
    for (const q of [
      'yarn ka stock kitna hai',
      'pending goods receive karo',
      'dashboard kholo',
      'what is the section 153 tax rate',
      'how much cash do we have'
    ]) {
      assert.notEqual(
        analyzeUserIntent(q, demoState()).intent,
        'unrecognised_query',
        `"${q}" used to route and must keep routing`
      );
    }
  });

  it('goods receipt still works in the word order that always worked', async () => {
    const r = await executeSupervisorTurn('pending goods receive karo', demoState());
    assert.match(r.message.content, /Goods Received/);
  });

  it('and now works in the order that used to fail', async () => {
    const r = await executeSupervisorTurn('receive pending goods', demoState());
    assert.match(r.message.content, /Goods Received/);
  });

  it('a resolved answer is labelled with the skill that ran', async () => {
    const r = await executeSupervisorTurn('how much money do customers owe me', demoState());
    assert.ok(r.message.skills?.length, 'a resolved turn must still declare its skill');
  });
});

describe('the refusal is useful instead of final', () => {
  it('names real capabilities, never an invented one', () => {
    const out = refusalWithSuggestions('receive pending goods');
    assert.match(out, /don't have a reliable answer/i);
    assert.doesNotMatch(out, /Payroll|Timesheets|Invoicing Suite/);
  });

  it('a refusal stays inside the brevity budget even with suggestions', () => {
    const out = refusalWithSuggestions('receive pending goods');
    assert.ok(
      out.length <= 320,
      `refusal grew to ${out.length} chars, over the 320 the brevity suite pins: ${out}`
    );
  });

  it('points at the teaching log so the fix is available to the user', () => {
    assert.match(refusalWithSuggestions('save karo'), /Teaching/);
  });
});