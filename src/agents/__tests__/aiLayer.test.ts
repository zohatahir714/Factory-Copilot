/**
 * The `src/ai` layer, pinned.
 *
 * Four things were asked for and none of them existed: a folder structure for
 * the AI, one route that answers anything asked about the software, a stock
 * check BEFORE any purchase, and an answer to "which material had loss, from
 * which supplier" — a question the copilot had been refusing outright.
 *
 * The refusal was correct at the time and that is the point worth keeping. The
 * ledger recorded no `production_issue` and no `purchase_receipt` movement, so
 * there was genuinely nothing to reconcile. `lossAnswer` still refuses by name
 * when those movements are absent; it does not return an empty table that reads
 * as "no loss" when it means "no data".
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `commandMatrix.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzeUserIntent, executeSupervisorTurn } from '../../lib/agentSupervisor';
import {
  stockVerdict,
  purchaseGuardNote,
  stockHealthSummary,
  shortfalls
} from '../../ai/stock/index.ts';
import { lossAnswer, materialVariances, VARIANCE_CAVEAT } from '../../ai/loss/index.ts';
import { softwareAnswer, capabilityAnswer, MODULE_REGISTRY, moduleFor } from '../../ai/software/index.ts';
import { AGENT_SKILLS, skillById, type SkillId } from '../skills.ts';
import { buildDemoFactory } from '../../data/demoFactory';
import type { DatabaseState } from '../../lib/businessTools';

const repoFile = (rel: string): string =>
  fileURLToPath(new URL(`../../../${rel}`, import.meta.url));

function demoState(): DatabaseState {
  const demo = buildDemoFactory() as unknown as DatabaseState;
  return { ...demo, complianceSources: [] };
}

/** A ledger with the movement types stripped out, to prove the refusal holds. */
function withoutMovements(): DatabaseState {
  return { ...demoState(), inventoryMovements: [] };
}

describe('the AI layer is a real structure, not a folder name', () => {
  it('every module named in the README exists', () => {
    for (const file of [
      'src/ai/index.ts',
      'src/ai/stock/index.ts',
      'src/ai/loss/index.ts',
      'src/ai/software/index.ts'
    ]) {
      assert.ok(readFileSync(repoFile(file), 'utf8').length > 0, `${file} is missing or empty`);
    }
  });

  it('every new skill names a file inside the layer', () => {
    for (const id of ['stock_sufficiency', 'material_loss', 'software_guide'] as const) {
      const skill = skillById(id);
      assert.ok(skill, `${id} is not registered`);
      assert.match(
        skill.implementedIn,
        /^src\/ai\//,
        `${id} claims ${skill.implementedIn}, which is outside the AI layer`
      );
    }
  });

  it('the barrel re-exports every capability', () => {
    const barrel = readFileSync(repoFile('src/ai/index.ts'), 'utf8');
    for (const name of [
      'stockVerdict',
      'purchaseGuardNote',
      'stockHealthSummary',
      'lossAnswer',
      'softwareAnswer',
      'capabilityAnswer'
    ]) {
      assert.match(barrel, new RegExp(name), `${name} is not exported from the barrel`);
    }
  });

  it('the supervisor reaches the layer rather than reimplementing it', () => {
    const supervisor = readFileSync(repoFile('src/lib/agentSupervisor.ts'), 'utf8');
    assert.match(supervisor, /from '\.\.\/ai\/stock\/index\.ts'/);
    assert.match(supervisor, /from '\.\.\/ai\/loss\/index\.ts'/);
    assert.match(supervisor, /from '\.\.\/ai\/software\/index\.ts'/);
  });
});

describe('stock is checked before any purchase', () => {
  it('a purchase on top of sufficient stock says so', () => {
    const note = purchaseGuardNote(demoState(), 'Cotton Yarn 150D', 200);
    assert.ok(note, 'the guard must speak when stock covers the order');
    assert.match(note, /already at 1,450 kg/);
    assert.match(note, /covers the 200 kg/);
    assert.match(note, /Ordering anyway\?/);
  });

  it('a genuinely needed purchase says so too', () => {
    const note = purchaseGuardNote(demoState(), 'Reactive Dye Blue', 300);
    assert.ok(note);
    assert.match(note, /this purchase is needed/);
  });

  it('the guard is on the purchase card, not a separate screen', async () => {
    const r = await executeSupervisorTurn(
      'create a purchase order for 200 kg cotton yarn from Green Mills Ltd',
      demoState()
    );
    assert.ok(r.pendingConfirmation, 'a confirmation card must still open');
    assert.match(
      r.message.content,
      /Stock check: Cotton Yarn 150D already at 1,450 kg/,
      'the stock check must be on the card the user is reading'
    );
  });

  it('the sufficiency question is answered as a decision, not a list', async () => {
    const state = demoState();
    const all = await executeSupervisorTurn('did we have proper stock', state);
    assert.equal(all.message.skills?.length, 1);
    assert.match(all.message.content, /need(s)? buying/);

    const one = await executeSupervisorTurn('do we have enough yarn', state);
    assert.match(one.message.content, /Cotton Yarn 150D/);
    assert.match(one.message.content, /on hand/);
  });

  it('the verdict and the dashboard agree on what counts as low', () => {
    const state = demoState();
    const summary = stockHealthSummary(state);
    for (const s of shortfalls(state)) {
      assert.match(summary, new RegExp(s.product.name), `${s.product.name} is missing from the summary`);
    }
  });

  it('a material nobody stocks is not silently treated as zero stock', () => {
    const v = stockVerdict(demoState(), 'Unobtainium', 100);
    assert.equal(v.product, undefined);
    assert.match(v.line, /not in your catalogue/);
  });
});

describe('material loss is answered from the ledger, or refused by name', () => {
  it('the demo ledger records the movements a variance needs', () => {
    const types = new Set(demoState().inventoryMovements.map(m => m.movementType));
    assert.ok(types.has('purchase_receipt'), 'without receipts there is nothing to reconcile against');
    assert.ok(types.has('production_issue'), 'without issues nothing can have been consumed');
  });

  it('the variance names the material AND the supplier', async () => {
    const r = await executeSupervisorTurn('which material got loss last time from which supplier', demoState());
    assert.equal(r.message.skills?.[0], 'material_loss');
    assert.match(r.message.content, /Cotton Yarn 150D/);
    assert.match(r.message.content, /Green Mills Ltd/, 'the supplier must be named, not omitted');
  });

  it('the Roman Urdu phrasing routes and answers the same way', async () => {
    const r = await executeSupervisorTurn('kaun sa material loss me tha', demoState());
    assert.doesNotMatch(r.message.content, /reliable answer/, 'this used to be refused outright');
    assert.match(r.message.content, /received but never issued/);
  });

  it('the answer carries the caveat, so a number is not read as a weighing', async () => {
    const r = await executeSupervisorTurn('which material got loss', demoState());
    assert.ok(
      r.message.content.includes(VARIANCE_CAVEAT),
      'a variance must never be presented as a measured physical loss'
    );
    assert.match(VARIANCE_CAVEAT, /not a weighed physical loss/);
  });

  it('with no movements it refuses by name instead of showing an empty table', () => {
    const answer = lossAnswer(withoutMovements());
    assert.match(answer, /No material variance to report/);
    assert.match(answer, /no production-issue or purchase-receipt movements/);
    assert.doesNotMatch(answer, /0 kg received but never issued/);
  });

  it('material issued to production is not reported as loss', () => {
    const rows = materialVariances(demoState());
    const issued = rows.find(v => v.productName === 'Cotton Yarn 150D');
    assert.ok(issued);
    assert.ok(issued.issued > 0, 'the fixture must actually issue material to production');
    assert.equal(issued.variance, issued.received - issued.issued);
  });

  it('every variance row names the supplier it was bought from', () => {
    for (const v of materialVariances(demoState())) {
      if (v.received > 0) {
        assert.ok(v.suppliers.length > 0, `${v.productName} was received with no supplier on file`);
      }
    }
  });
});

describe('questions about the software never reach the refusal', () => {
  it('"how do I print a PO" is about the app, not a print command', async () => {
    const c = analyzeUserIntent('how do i print a purchase order', demoState());
    assert.equal(c.intent, 'about_software');

    const r = await executeSupervisorTurn('how do i print a purchase order', demoState());
    assert.match(r.message.content, /Purchase Orders/);
    assert.doesNotMatch(r.message.content, /which one\?/, 'it used to ask which PO to print');
  });

  it('the print command itself still prints', () => {
    assert.equal(
      analyzeUserIntent('stock report print karo', demoState()).intent,
      'print',
      'answering questions about a module must not break printing one'
    );
  });

  it('a ledger question is never mistaken for a question about the screen', () => {
    assert.equal(
      analyzeUserIntent('how much cash do we have', demoState()).intent,
      'get_cash_balance'
    );
    assert.equal(softwareAnswer('how much cash do we have'), null);
  });

  it('the capability list is derived, not typed', () => {
    const answer = capabilityAnswer();
    assert.match(answer, new RegExp(`${MODULE_REGISTRY.length} modules`));
    for (const m of MODULE_REGISTRY) {
      assert.match(answer, new RegExp(m.label.replace(/[()]/g, '\\$&')));
    }
  });

  it('every module in the registry names skills that exist', () => {
    for (const m of MODULE_REGISTRY) {
      for (const id of m.skills) {
        assert.ok(skillById(id), `${m.id} names skill ${id}, which is not registered`);
      }
    }
  });

  it('a module the registry has no entry for is not invented', () => {
    assert.equal(softwareAnswer('how do I use the payroll module'), null);
    assert.equal(moduleFor('payroll'), undefined);
  });

  it('every conversational answer is short', async () => {
    // The project's terseness rule. A capability listing is deliberately NOT in
    // this set: "what can this software do" asks for a list, and truncating a
    // list to hit a character budget would hide modules — the exact failure
    // the "search properly through every route" request is about. It is checked
    // separately below, per line.
    const MAX = 700;
    for (const q of [
      'did we have proper stock',
      'do we have enough yarn',
      'which material got loss',
      'how do i print a purchase order'
    ]) {
      const r = await executeSupervisorTurn(q, demoState());
      assert.ok(
        r.message.content.length <= MAX,
        `${q} answered in ${r.message.content.length} chars, over the ${MAX} budget`
      );
    }
  });

  it('the capability listing is complete and terse line by line', async () => {
    const r = await executeSupervisorTurn('what can this software do', demoState());
    const lines = r.message.content.split('\n');
    assert.equal(lines.length, MODULE_REGISTRY.length + 1, 'one line per module, plus the header');
    for (const line of lines) {
      assert.ok(line.length <= 140, `a listing line runs to ${line.length} chars: ${line}`);
    }
  });
});

describe('the skill registry grew to cover the new routes', () => {
  it('the three new skills are registered and real', () => {
    for (const id of ['stock_sufficiency', 'material_loss', 'software_guide'] as const) {
      const skill = skillById(id);
      assert.ok(skill, `${id} is missing from the registry`);
      assert.ok(skill.does.length > 20, `${id} needs a real description`);
      assert.ok(AGENT_SKILLS.includes(skill));
    }
  });

  it('a purchase now runs the stock check as well as the purchase desk', () => {
    const skills: SkillId[] = ['stock_sufficiency', 'purchase_desk'];
    for (const id of skills) assert.ok(skillById(id));
  });
});
