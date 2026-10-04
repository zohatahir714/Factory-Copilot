/**
 * A clarification has to be answerable.
 *
 * The user reported a loop: "when i ask for add a customer or supplier it ask
 * for name and city when i again add name and city it again fires". Both halves
 * were real and neither was the obvious one.
 *
 * THE ASK WAS A DEAD END. `clarificationReply` told the user to answer
 * "Rahim Traders, Lahore". That sentence matches no intent rule, so it routed
 * as unknown and the copilot REFUSED the exact string it had just requested.
 * The user's second turn looked like the first, so the loop looked unbreakable.
 *
 * THE WRITE THEN FABRICATED. Even once the name arrived, the city was defaulted
 * to "Pakistan" and the reply printed "Standard Credit Limit: Rs. 500,000",
 * "Lead Time: 3 days" and "Payment Terms: Net 30 Days" — literals at the call
 * site, presented as a customer's agreed commercial terms.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `commandMatrix.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  analyzeUserIntent,
  executeSupervisorTurn,
  mergeWithPendingCommand
} from '../../lib/agentSupervisor';
import { DEMO_PRODUCTS, DEMO_CUSTOMERS, DEMO_SUPPLIERS } from '../../data/fixtures';
import type { DatabaseState } from '../../lib/businessTools';

function demoState(): DatabaseState {
  return {
    products: DEMO_PRODUCTS,
    suppliers: DEMO_SUPPLIERS,
    customers: DEMO_CUSTOMERS,
    purchaseOrders: [],
    salesOrders: [],
    cashbook: [],
    inventoryMovements: [],
    complianceSources: []
  } as unknown as DatabaseState;
}

const repoFile = (rel: string): string =>
  fileURLToPath(new URL(`../../../${rel}`, import.meta.url));

/** Replays the shell loop: merge the answer, run the turn, remember the question. */
async function converse(turns: string[]) {
  let pending: string | null = null;
  const said: string[] = [];
  const replies: string[] = [];
  for (const utterance of turns) {
    const state = demoState();
    const effective = mergeWithPendingCommand(utterance, pending, state);
    const r = await executeSupervisorTurn(effective, state);
    pending = r.pendingCommand ?? null;
    said.push(effective);
    replies.push(r.message.content);
  }
  return { said, replies, last: replies[replies.length - 1] };
}

describe('asking for a name is answerable', () => {
  it('a party question hands the shell a command to wait on', async () => {
    const r = await executeSupervisorTurn('new customer add karo', demoState());
    assert.equal(r.pendingCommand, 'add customer');

    const s = await executeSupervisorTurn('new supplier add karo', demoState());
    assert.equal(s.pendingCommand, 'add supplier');
  });

  it('answering with a name and a city completes the command', async () => {
    const { said, last } = await converse(['new customer add karo', 'Rahim Traders, Lahore']);

    assert.equal(said[1], 'add customer Rahim Traders, Lahore', 'the answer is merged into the command');
    assert.match(last, /\*\*Name\*\*: Rahim Traders/);
    assert.match(last, /\*\*Location\*\*: Lahore/, 'the city the user typed is kept');
  });

  it('a supplier name and city likewise complete the command', async () => {
    const { said, last } = await converse(['new supplier add karo', 'Green Mills Ltd, Faisalabad']);
    assert.equal(said[1], 'add supplier Green Mills Ltd, Faisalabad');
    assert.match(last, /\*\*Name\*\*: Green Mills Ltd/);
    assert.match(last, /\*\*City \/ Hub\*\*: Faisalabad/);
  });

  it('the exact sentence the copilot asks for is the one it accepts', async () => {
    // The clarification quotes "Rahim Traders, Lahore" verbatim. That string is
    // refused on its own, so this is the sentence that must survive the merge.
    const bare = analyzeUserIntent('Rahim Traders, Lahore', demoState()).intent;
    assert.equal(bare, 'unrecognised_query');

    const { last } = await converse(['new customer add karo', 'Rahim Traders, Lahore']);
    assert.doesNotMatch(last, /reliable answer/, 'the answer to our own question must not be refused');
    assert.match(last, /Customer added/);
  });

  it('the question does not latch onto a later, unrelated turn', async () => {
    // Replaying "add customer" over a real command would create a customer the
    // user never asked for, on a sentence about yarn.
    const { said, last } = await converse(['new customer add karo', 'yarn ka stock kitna hai']);
    assert.equal(said[1], 'yarn ka stock kitna hai', 'a routable utterance is not hijacked');
    assert.match(last, /kg/);
    assert.doesNotMatch(last, /Customer added/);
  });

  it('nothing to wait on means the utterance passes through untouched', () => {
    const state = demoState();
    assert.equal(mergeWithPendingCommand('yarn ka stock kitna hai', null, state), 'yarn ka stock kitna hai');
    assert.equal(mergeWithPendingCommand('  ', 'add customer', state), '  ', 'an empty answer is not a command');
  });

  it('the pending command is cleared once the question is answered', async () => {
    let pending: string | null = null;
    const state = demoState();
    const first = await executeSupervisorTurn('new customer add karo', state);
    pending = first.pendingCommand ?? null;
    assert.ok(pending);

    const merged = mergeWithPendingCommand('Rahim Traders, Lahore', pending, state);
    const second = await executeSupervisorTurn(merged, state);
    assert.equal(second.pendingCommand, undefined, 'a completed command waits for nothing');
  });
});

describe('a new party is described by what was said, and nothing else', () => {
  it('no city is given, so no city is claimed', async () => {
    const { last } = await converse(['new customer add karo', 'Rahim Traders']);
    assert.match(last, /\*\*Location\*\*: not set yet/);
    assert.doesNotMatch(last, /Pakistan/, 'the old default wrote the city "Pakistan" for every party');
  });

  it('the city is absent from the intent when nobody said one', () => {
    const c = analyzeUserIntent('add customer Rahim Traders', demoState());
    assert.equal(c.entities.city, undefined);
    assert.equal(c.entities.name, 'Rahim Traders');
  });

  it('no credit limit is invented', async () => {
    const { last } = await converse(['new customer add karo', 'Rahim Traders']);
    assert.match(last, /\*\*Credit limit\*\*: not set yet/);
    assert.doesNotMatch(last, /500,000/, 'Rs. 500,000 was a literal, not an agreed limit');
  });

  it('no lead time or payment terms are invented', async () => {
    const { last } = await converse(['new supplier add karo', 'Green Mills Ltd']);
    assert.match(last, /\*\*Lead time\*\*: not set yet/);
    assert.match(last, /\*\*Payment terms\*\*: not set yet/);
    assert.doesNotMatch(last, /Net 30 Days/);
  });

  it('the created record carries no fabricated city', async () => {
    const r = await executeSupervisorTurn('add customer Rahim Traders', demoState());
    const created = (r.directDatabaseUpdate?.customers ?? [])[0];
    assert.equal(created?.name, 'Rahim Traders');
    assert.notEqual(
      created?.city,
      'Pakistan',
      'the ledger must not record a city the user never gave'
    );
  });

  it('a name that is only a verb is still not a name', () => {
    const c = analyzeUserIntent('new customer add karo', demoState());
    assert.deepEqual(c.entities.missing, ['name']);
  });
});

describe('the loop cannot come back', () => {
  const supervisor = readFileSync(repoFile('src/lib/agentSupervisor.ts'), 'utf8');
  const context = readFileSync(repoFile('src/context/AppContext.tsx'), 'utf8');
  const queue = readFileSync(repoFile('src/components/AgentApprovalQueue.tsx'), 'utf8');

  it('the shell folds the answer in and clears the question', () => {
    assert.match(
      context,
      /mergeWithPendingCommand\(content, pendingCommandRef\.current, dbState\)/,
      'the merge must happen in the shell, or the answer is never heard'
    );
    assert.match(
      context,
      /pendingCommandRef\.current = turnResult\.pendingCommand \?\? null/,
      'the question must be re-armed only when one is actually asked'
    );
  });

  it('the supervisor still reports the pending command', () => {
    assert.match(supervisor, /pendingCommand: pendingCommandFor\(contract\.intent\)/);
  });

  it('the fabricated party defaults are gone from the write path', () => {
    assert.doesNotMatch(
      supervisor,
      /leadTimeDays: 3|creditLimit: 500000|'New Supplier'|'New Buyer Mill'/,
      'a name, a city or a credit limit must never be invented at the call site'
    );
    assert.doesNotMatch(supervisor, /let city = 'Pakistan'/);
  });

  it('the agent proposals panel is collapsed on the dashboard', () => {
    assert.match(
      queue,
      /<details className="group/,
      'the queue opens one line and expands on click'
    );
    assert.match(queue, /Nothing is written until you approve/);
    assert.doesNotMatch(queue, /<header className="flex items-center gap-2 border-b/);
  });
});
