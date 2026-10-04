/**
 * The skill layer is load-bearing, so it is pinned here.
 *
 * Two failure modes are guarded, and both were real:
 *
 * 1. THE DASHBOARD PROMISED A CONVERSATION NOBODY HAD. Card 06 typed three
 *    sample prompts into a card whose only action was to open the copilot — the
 *    card showed "Yarn ka stock kitna hai?" in a typewriter. The typewriter is
 *    gone; the card now renders the registry, and this file stops it coming
 *    back.
 *
 * 2. A SKILL THE PRODUCT DOES NOT RUN. The registry names the file behind each
 *    row, and the first test reads those files off disk. A label with no
 *    implementation behind it cannot survive here.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `commandMatrix.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzeUserIntent, executeSupervisorTurn } from '../../lib/agentSupervisor';
import {
  AGENT_SKILLS,
  SKILL_CAPABILITIES,
  SKILL_COUNT,
  selectSkills,
  skillById,
  skillLabelsFor
} from '../skills.ts';
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

/** Every intent the supervisor emits, reached through real phrasings. */
const ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['yarn ka stock kitna hai', 'check_inventory'],
  ['sync inventory', 'sync_inventory'],
  ['business summary do', 'get_business_summary'],
  ['how much cash do we have', 'get_cash_balance'],
  ['total receivables kitne hain', 'get_receivables'],
  ['payables batao', 'get_payables'],
  ['pending orders kya hain', 'get_pending_orders'],
  ['which items are above minimum', 'stock_health'],
  ['do we need to buy more material', 'reorder_advice'],
  ['create a purchase order for 200 kg yarn', 'create_purchase_order'],
  ['po ke goods receipt karo', 'receive_goods'],
  ['diesel ka kharcha add karo Rs 12000', 'record_expense'],
  ['new supplier add karo', 'add_supplier'],
  ['new customer add karo', 'add_customer'],
  ['new product add karo', 'add_product'],
  ['what is the section 153 tax rate', 'compliance_query'],
  ['stock report print karo', 'print'],
  ['dashboard kholo', 'navigate']
];

describe('every registered skill is a real skill', () => {
  it('the registry is bigger than the two-skill submission minimum', () => {
    assert.ok(
      SKILL_COUNT > 2,
      `the submission rule asks for more than 2 skills; the registry has ${SKILL_COUNT}`
    );
    assert.equal(SKILL_COUNT, AGENT_SKILLS.length);
  });

  for (const skill of AGENT_SKILLS) {
    it(`${skill.label} names a module that exists (${skill.implementedIn})`, () => {
      assert.ok(
        existsSync(repoFile(skill.implementedIn)),
        `${skill.label} claims ${skill.implementedIn}, which is not in the repository`
      );
      assert.equal(skillById(skill.id)?.label, skill.label, 'the id map must resolve every row');
    });
  }

  it('the capability flags are the documented five, no more', () => {
    const DOCUMENTED = [
      'AI Workflows',
      'AI-powered BPA',
      'Agentic AI',
      'Generative AI',
      'Multi-Agent Systems'
    ];
    for (const c of SKILL_CAPABILITIES) {
      assert.ok(DOCUMENTED.includes(c), `${c} is not a documented submission skill flag`);
    }
    assert.ok(
      SKILL_CAPABILITIES.length >= 4,
      'a product demoing only two AI skills cannot claim the rest'
    );
    assert.deepEqual(
      [...SKILL_CAPABILITIES],
      [...SKILL_CAPABILITIES].sort(),
      'the dashboard renders this list in order'
    );
  });

  it('ids are unique — two rows may not share one badge', () => {
    const ids = AGENT_SKILLS.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('the layer routes, and covers every intent', () => {
  for (const [phrase, intent] of ROUTES) {
    it(`"${phrase}" reaches ${intent} and a skill claims it`, () => {
      const actual = analyzeUserIntent(phrase, demoState()).intent;
      assert.equal(actual, intent, `"${phrase}" routes elsewhere`);

      const skills = selectSkills(intent);
      assert.ok(
        skills.length > 0,
        `${intent} is reachable but no registered skill claims it, so the copilot would answer with no skill badge`
      );
      for (const id of skills) {
        assert.ok(skillById(id), `${id} is emitted by the router but absent from the registry`);
      }
    });
  }

  it('an out-of-scope question claims no skill rather than a wrong one', () => {
    const intent = analyzeUserIntent('who won the cricket match', demoState()).intent;
    assert.equal(intent, 'unrecognised_query');
    assert.deepEqual(selectSkills(intent), []);
    assert.deepEqual(skillLabelsFor(intent), []);
  });

  it('an unknown intent is an empty list, never a crash', () => {
    assert.deepEqual(selectSkills(''), []);
    assert.deepEqual(selectSkills('an_intent_nobody_registered'), []);
  });

  // Two commands the user reported as misrouted: each asked for a write and
  // received a read. "50 kg yarn ka sale record karo" matched neither 'sale
  // karo' nor 'record sale' and fell through to the stock rule, so the user
  // who asked to record a sale was answered with a warehouse stock report.
  it('a sale with the material in between still routes to record_sale', () => {
    const c = analyzeUserIntent('50 kg yarn ka sale record karo', demoState());
    assert.equal(c.intent, 'record_sale');
    assert.ok(c.entities.missing?.includes('customer'), 'a nameless sale still asks, never guesses');
  });

  // "po ke goods receipt karo" — 'receipt', not 'received'. The rule matched
  // noun and verb only when they were one word, so this reached the refusal
  // lane and the receipt had to be typed by hand.
  it('a goods receipt in the noun form still routes to receive_goods', () => {
    assert.equal(
      analyzeUserIntent('po ke goods receipt karo', demoState()).intent,
      'receive_goods'
    );
  });

  it('the misroutes stay fixed from voice exactly as on text', () => {
    const state = demoState();
    for (const phrase of ['50 kg yarn ka sale record karo', 'po ke goods receipt karo']) {
      assert.equal(
        selectSkills(analyzeUserIntent(phrase, state).intent).length > 0,
        true,
        `"${phrase}" lost its skill on the way in`
      );
    }
  });
});

describe('an answer says which skill ran', () => {
  it('a stock question is labelled with the ledger reader', async () => {
    const r = await executeSupervisorTurn('yarn ka stock kitna hai', demoState());
    assert.deepEqual(r.message.skills, ['ledger_reader']);
  });

  it('a tax question is labelled with the compliance RAG', async () => {
    const r = await executeSupervisorTurn('what is the section 153 tax rate', demoState());
    assert.deepEqual(r.message.skills, ['compliance_rag']);
  });

  it('a command that opens a screen is labelled with screen control', async () => {
    const r = await executeSupervisorTurn('dashboard kholo', demoState());
    assert.ok(r.message.skills?.includes('screen_control'));
    assert.equal(r.directive?.type, 'navigate');
  });

  it('voice and text carry the same skills for the same words', async () => {
    const state = demoState();
    const spoken = await executeSupervisorTurn('yarn ka stock kitna hai', state, 'voice');
    const typed = await executeSupervisorTurn('yarn ka stock kitna hai', state, 'text');
    assert.deepEqual(spoken.message.skills, typed.message.skills);
    assert.equal(spoken.message.content, typed.message.content);
  });

  it('an unrecognised question is answered with no skill badge', async () => {
    const r = await executeSupervisorTurn('who won the cricket match', demoState());
    assert.deepEqual(r.message.skills, undefined, 'claiming a skill that did not run is the bug');
  });

  it('the answer text is untouched by the labelling', async () => {
    const state = demoState();
    const r = await executeSupervisorTurn('how much cash do we have', state);
    assert.doesNotMatch(r.message.content, /Ledger Reader|skill/i);
  });
});

describe('the hardcoded prompt card cannot come back', () => {
  const dashboard = readFileSync(repoFile('src/components/ExecutiveDashboard.tsx'), 'utf8');
  const chat = readFileSync(repoFile('src/components/CopilotChatView.tsx'), 'utf8');
  const supervisor = readFileSync(repoFile('src/lib/agentSupervisor.ts'), 'utf8');

  it('the dashboard no longer types questions nobody asked', () => {
    assert.doesNotMatch(
      dashboard,
      /COPILOT_PROMPTS|CopilotTypewriter/,
      'the typewriter and its hardcoded prompt list must not return'
    );
    assert.doesNotMatch(
      dashboard,
      /Yarn ka stock kitna hai|Create a PO for 200 kg yarn|Section 153 tax rate/,
      'a sample prompt is fabricated UI copy: the card never asked it'
    );
  });

  it('the card states the skill layer from the registry instead', () => {
    assert.match(dashboard, /from '\.\.\/agents\/skills\.ts'/);
    assert.match(dashboard, /SKILL_COUNT/, 'the count must be derived, never typed');
    assert.match(dashboard, /AGENT_SKILLS/, 'the skills shown must come from the registry');
    assert.match(dashboard, /setActiveTab\('copilot'\)/, 'the card still only opens the copilot');
  });

  it('the copilot renders the badge from the registry', () => {
    assert.match(chat, /renderSkillBadges\(msg\.skills\)/);
    assert.match(chat, /skillById/, 'badge labels come from the registry, not from the component');
  });

  it('the supervisor cannot be detached from the layer', () => {
    assert.match(
      supervisor,
      /import \{ selectSkills \} from '\.\.\/agents\/skills\.ts'/,
      'without this the badge silently disappears from every answer'
    );
  });
});
