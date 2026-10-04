/**
 * Supervisor routing — regression guards for the fallback.
 *
 * The bug: `analyzeUserIntent` ended with an unconditional
 * "Default to Inventory Stock Check". Every sentence matching none of the
 * preceding rules was answered with a warehouse report. Asking about Pakistan's
 * best bowling attack returned the stock level of Reactive Dye Blue — the
 * copilot substituted the nearest agent that had something to say instead of
 * admitting it did not know.
 *
 * Grounding the refusal in the router is what makes the RAG refusal reachable:
 * a question about tax law still reaches ROUTE 4, but a question about nothing
 * in this system stops at the router instead of being answered as inventory.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `reorder.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { analyzeUserIntent, executeSupervisorTurn } from '../../lib/agentSupervisor';

describe('out-of-scope questions must not borrow an agent', () => {
  const outOfScope = [
    'What is the best bowling attack in Pakistan cricket history?',
    'who won the 1992 World Cup?',
    'what is the boiling point of water?'
  ];

  for (const question of outOfScope) {
    it(`refuses rather than answering as inventory: "${question.slice(0, 40)}"`, () => {
      const c = analyzeUserIntent(question);
      assert.notStrictEqual(c.intent, 'check_inventory');
      assert.strictEqual(c.intent, 'unrecognised_query');
    });
  }

  it('answers with an explicit refusal, not a stock report', async () => {
    const result = await executeSupervisorTurn(
      'What is the best bowling attack in Pakistan cricket history?',
      {} as any
    );
    assert.match(result.message.content, /don't have a reliable answer/i);
    // The warehouse report is the failure mode — it must not appear at all.
    assert.doesNotMatch(result.message.content, /Warehouse Inventory Status|Reactive Dye/i);
  });
});

describe('real questions still route', () => {
  it('sends an inventory question to the inventory agent', () => {
    assert.strictEqual(analyzeUserIntent('how much stock do we have?').intent, 'check_inventory');
  });

  it('sends the Urdu demo flow to the inventory agent', () => {
    // The dashboard's own demo chip. It must not fall through to the refusal.
    assert.strictEqual(analyzeUserIntent('اسٹاک کتنا ہے؟').intent, 'check_inventory');
  });

  it('sends a tax question to the compliance agent', () => {
    assert.strictEqual(analyzeUserIntent('FBR tax rule for exports?').intent, 'compliance_query');
  });

  it('sends a withholding question to the compliance agent', () => {
    const c = analyzeUserIntent('withholding rate for non-ATL filers');
    assert.strictEqual(c.intent, 'compliance_query');
    assert.strictEqual(c.domain, 'compliance');
  });

  /**
   * The six chips on the AI Copilot Terminal — the PROMPT each one sends, not
   * the text printed on it.
   *
   * These used to be pinned as the chip LABELS ("سیل انوئس (18% GST)",
   * "گڈز ریسیو"), which is a vacuous pass: `triggerDemoPrompt` sends the
   * `prompt` field, not the `label`. So the suite proved that strings a judge
   * never sees route correctly, while the string a judge actually sends —
   * "50 کلو یارن سیل کرو" — did not route at all. They are read from the same
   * source the UI renders so the two cannot drift apart again.
   */
  const DEMO_PROMPTS: Array<[string, string]> = [
    ['کتنے اسٹاک ہے', 'check_inventory'],
    ['100 کلو ڈائی کا پرچیز آرڈر بنا دو', 'create_purchase_order'],
    ['50 کلو یارن سیل کرو', 'record_sale'],
    ['آج کا مکمل بزنس سمری دو', 'get_business_summary'],
    ['اس ٹرانزیکشن پر کیا ٹیکس قانون لاگو ہے؟', 'compliance_query'],
    ['پی او کے گڈز ریسیو کرو', 'receive_goods']
  ];

  for (const [chip, expected] of DEMO_PROMPTS) {
    it(`routes demo chip prompt "${chip}" to ${expected}`, () => {
      assert.strictEqual(analyzeUserIntent(chip).intent, expected);
    });
  }

  it('no demo chip prompt falls through to the refusal', () => {
    for (const [chip] of DEMO_PROMPTS) {
      assert.notStrictEqual(analyzeUserIntent(chip).intent, 'unrecognised_query', chip);
    }
  });

  it('the prompts pinned here are the prompts the screen actually sends', () => {
    // Guards against this file drifting from the UI again: the strings the
    // copilot renders must be exactly the strings this suite tests.
    const source = readFileSync(
      new URL('../../components/CopilotChatView.tsx', import.meta.url),
      'utf8'
    );
    for (const [prompt] of DEMO_PROMPTS) {
      assert.ok(
        source.includes(`prompt: '${prompt}'`),
        `the demo bar no longer sends "${prompt}" — update this suite`
      );
    }
  });
});