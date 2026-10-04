/**
 * THE LIVE AI PATH — what the model is allowed to do.
 *
 * WHY THIS SUITE EXISTS NOW
 *   The Groq resolver runs in production (Vercel reports configured:true and
 *   answers in ~100ms) and has never once been covered by a test. Every other
 *   layer of this product is pinned; the one that talks to a language model was
 *   not. A regression there would surface on stage, in front of judges, as the
 *   copilot doing something nobody wrote a test for.
 *
 * WHY IT NEEDS NO NETWORK
 *   The dangerous half of the live path is not the HTTP call — it is what
 *   happens to the model's REPLY. `parseToolCall` is a pure function, so every
 *   safety property below is asserted against recorded model output, offline,
 *   forever. The tests that do touch the network assert only the contract that
 *   matters when there IS no network: never throw.
 *
 * WHAT IS BEING DEFENDED
 *   The model chooses one of 19 tools and fills in its parameters. It may not
 *   invent a tool, may not compute a value, and may not write without the human
 *   confirmation card. These tests exist so that if someone later "simplifies"
 *   the parser into trusting the completion, this file fails.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching the rest of the suite.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseToolCall, CONFIDENCE_GATE, toolSpec, TOOL_SPECS } from '../../lib/ai/contract.ts';
import type { ToolName } from '../../lib/ai/contract.ts';
import { resolve, resolveLive, resolveOffline } from '../../lib/ai/index.ts';
import type { Resolver } from '../../lib/ai/index.ts';

/** A realistic completion, exactly as Groq returns it. */
const goodCompletion = JSON.stringify({
  tool: 'record_sale',
  params: { customer: 'Noor Mills', product: 'cotton yarn', quantity: '50' },
  confidence: 0.9
});

describe('the model may only choose from the closed tool set', () => {
  it('accepts a well-formed call', () => {
    const r = parseToolCall(goodCompletion);
    assert.ok(r.call, `valid completion rejected: ${r.reason}`);
    assert.equal(r.call.tool, 'record_sale');
    assert.equal(r.call.params.customer, 'Noor Mills');
  });

  it('refuses a tool that does not exist', () => {
    // The single most important assertion in this file. A completion that names
    // an invented tool — "delete_all_rows", "run_sql" — must never become a
    // contract, however confident the model claims to be.
    for (const invented of ['delete_all_rows', 'run_sql', 'execute_command', 'record_sale_v2', '']) {
      const r = parseToolCall(JSON.stringify({ tool: invented, params: {}, confidence: 1 }));
      assert.equal(r.call, undefined, `invented tool "${invented}" was accepted`);
      assert.ok(r.reason && r.reason.length > 0, 'a rejection must say why, for the misses log');
    }
  });

  it('refuses a non-string or missing tool field', () => {
    for (const body of ['{"params":{},"confidence":1}', '{"tool":42}', '{"tool":null}', '{"tool":{"a":1}}']) {
      const r = parseToolCall(body);
      assert.equal(r.call, undefined, `malformed tool field accepted: ${body}`);
    }
  });

  it('refuses output that is not JSON at all', () => {
    // Models wrap JSON in prose. That is a refusal, not a repair opportunity —
    // guessing which sentence was the tool call is how wrong tools get picked.
    for (const body of ['Sure! {"tool":"record_sale"}', 'record_sale', '', '```json\n{}\n```', 'null']) {
      const r = parseToolCall(body);
      assert.equal(r.call, undefined, `non-JSON completion accepted: ${body}`);
    }
  });
});

describe('the confidence gate holds on model output', () => {
  it('refuses a confident-looking guess below the gate', () => {
    const r = parseToolCall(JSON.stringify({ tool: 'record_sale', params: {}, confidence: CONFIDENCE_GATE - 0.01 }));
    assert.equal(r.call, undefined, 'a below-gate call was accepted');
    assert.match(r.reason ?? '', /confidence/);
  });

  it('accepts exactly the gate, not below it', () => {
    const r = parseToolCall(JSON.stringify({ tool: 'stock_health', params: {}, confidence: CONFIDENCE_GATE }));
    assert.ok(r.call, `confidence exactly at the gate was rejected: ${r.reason}`);
  });

  it('clamps an over-confident completion instead of trusting it', () => {
    // 99% confidence from a model is a smell, not evidence. Clamping keeps the
    // value inside the contract instead of letting an absurd number through.
    const r = parseToolCall(JSON.stringify({ tool: 'stock_health', params: {}, confidence: 99 }));
    assert.ok(r.call);
    assert.ok(r.call.confidence <= 1, `confidence escaped the range: ${r.call.confidence}`);
  });

  it('defaults a missing confidence to below the gate', () => {
    // No confidence means no claim. Treating absence as a default PASS would let
    // a model omit the field and route anything.
    const r = parseToolCall(JSON.stringify({ tool: 'record_sale', params: {} }));
    assert.equal(r.call, undefined, 'a completion with no confidence was routed anyway');
  });
});

describe('model parameters are sanitised before use', () => {
  it('drops values that are not finite strings or numbers', () => {
    const r = parseToolCall(JSON.stringify({
      tool: 'record_sale',
      params: {
        customer: 'Noor Mills',
        blank: '   ',
        nested: { a: 1 },
        list: ['x'],
        infinite: null,
        nothing: NaN,
        qty: 50
      },
      confidence: 0.9
    }));
    assert.ok(r.call);
    const p = r.call.params as Record<string, unknown>;
    assert.equal(p.customer, 'Noor Mills');
    assert.equal(p.qty, 50);
    for (const junk of ['blank', 'nested', 'list', 'infinite', 'nothing']) {
      assert.equal(junk in p, false, `unsanitised param "${junk}" reached the tool call`);
    }
  });

  it('trims whitespace rather than storing it as a name', () => {
    const r = parseToolCall(JSON.stringify({ tool: 'add_customer', params: { name: '  Noor Mills  ' }, confidence: 0.9 }));
    assert.equal((r.call?.params as Record<string, unknown>).name, 'Noor Mills');
  });
});

describe('the write gate is a property of the tool, not of the model', () => {
  // The model cannot talk its way past the confirmation card, because whether a
  // tool writes is declared in the closed schema and enforced downstream. Every
  // write tool must be marked as one, or the human-in-the-loop rule has a hole.
  const WRITE_TOOLS = TOOL_SPECS.filter(s => s.writes).map(s => s.name);
  const MUST_WRITE: ToolName[] = [
    'record_sale', 'create_purchase_order', 'add_customer', 'add_supplier', 'add_product',
    'receive_goods', 'record_expense'
  ];
  const MUST_NOT_WRITE: ToolName[] = ['stock_health', 'get_cash_balance', 'get_receivables', 'get_business_summary', 'navigate', 'print'];

  // Exactly seven tools may write. Asserted as a set rather than a lower bound:
  // a bound would not notice an eighth tool being quietly marked writable, which
  // is precisely the change that would open a hole in the confirmation gate.
  it('covers every write-capable tool', () => {
    assert.deepEqual(WRITE_TOOLS.slice().sort(), MUST_WRITE.slice().sort(),
      'the set of write-capable tools changed; a new write tool needs the confirmation path re-checked');
    for (const name of MUST_WRITE) {
      assert.equal(toolSpec(name)?.writes, true, `${name} must be declared as a write`);
    }
  });

  it('keeps the read-only tools read-only', () => {
    for (const name of MUST_NOT_WRITE) {
      assert.equal(toolSpec(name)?.writes, false, `${name} must not be declared as a write`);
    }
  });

  it('gives every tool a declared intent and domain', () => {
    for (const s of TOOL_SPECS) {
      assert.ok(s.intent && s.intent.length > 0, `${s.name} has no intent`);
      assert.ok(s.domain && s.domain.length > 0, `${s.name} has no domain`);
    }
  });
});

describe('resolve never throws, whatever the model or the network does', () => {
  // There is no network in this environment, so `resolveLive` genuinely fails
  // here. That is the point: the demo must degrade to the offline path on bad
  // wifi rather than showing the user an error.
  it('survives the live resolver being unreachable', async () => {
    const r = await resolveLive('add sale to Noor Mills');
    assert.equal(r.call, undefined, 'a live failure must not produce a tool call');
    assert.ok(r.reason && r.reason.length > 0, 'a live failure must say why');
  });

  // An utterance the OFFLINE resolver cannot place, so control genuinely
  // reaches the live path. Using a phrase the offline bank already resolves
  // would pass without ever calling the model — a green test that proves nothing.
  const UNPLACED = 'xyzzy plugh frotz blorb';

  it('survives a live resolver that throws outright', async () => {
    const explode: Resolver = async () => { throw new Error('socket hang up'); };
    const r = await resolve(UNPLACED, { live: explode });
    assert.ok(r.reason, 'a throwing resolver must be contained, not propagated');
    assert.equal(r.call, undefined);
  });

  it('survives a live resolver that returns garbage', async () => {
    const garbage: Resolver = async () => ({ call: undefined, reason: 'nonsense' });
    const r = await resolve(UNPLACED, { live: garbage });
    assert.equal(r.call, undefined);
    assert.ok(r.reason);
  });

  it('uses the live resolver when the offline one abstains', async () => {
    // Offline scoring is the fast path; the model is the fallback for the long
    // tail. This asserts the chain actually reaches the model rather than
    // quietly never calling it.
    let asked = 0;
    const spy: Resolver = async () => { asked++; return { call: undefined, reason: 'no match' }; };
    await resolve('xyzzy plugh frotz', { live: spy });
    assert.equal(asked, 1, 'the live resolver was never consulted');
  });

  it('lets a taught phrase win without consulting the model', async () => {
    // A phrase the user explicitly taught is an instruction, not a guess, and it
    // must not be second-guessed by a model that has never heard of it.
    let asked = 0;
    const spy: Resolver = async () => { asked++; return { call: undefined, reason: 'no match' }; };
    const offline = resolveOffline('get_pending_orders');
    assert.ok(offline.call, 'the seeded offline path should resolve a taught phrase');
    const r = await resolve('get_pending_orders', { live: spy });
    assert.ok(r.call, 'a taught phrase failed to resolve');
    assert.equal(asked, 0, 'a taught phrase should not reach the model');
  });
});
