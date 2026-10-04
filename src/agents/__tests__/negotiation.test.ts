/**
 * Multi-agent negotiation — Task 5, Phase 3.
 *
 * Written BEFORE `src/agents/negotiation/` existed, per PLAN.md §Verification.
 *
 * THE HONESTY PROPERTY UNDER TEST
 *   Two agents converge on a bounded price in a bounded number of rounds, and
 *   when they cannot converge they return `agreed: false` with a reason. They
 *   do not invent a deal. A negotiation that always succeeds is a decoration:
 *   the interesting behaviour is the refusal.
 *
 * READ `negotiate`'s DOC COMMENT before the second test. The brief's inputs
 * (`asking: 3000`, `ceiling: 1500`) are internally inconsistent — the buyer's
 * opening ask is above the ceiling it was handed. We refuse that rather than
 * quietly clamping the ask down to the ceiling, because clamping would invent
 * a concession the buyer never made. The comment there records the reasoning.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `payload.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { negotiate } from '../negotiation/negotiate.ts';
import { buyerAgent, supplierAgent } from '../negotiation/index.ts';

describe('agent negotiation — convergence', () => {
  it('converges to a price within 4 rounds', () => {
    const r = negotiate({ asking: 1450, floor: 1200, ceiling: 1500, maxRounds: 8 });
    assert.ok(r.agreed, `expected a deal, got refused: ${r.reason}`);
    assert.ok(r.rounds.length <= 4, `took ${r.rounds.length} rounds`);
    assert.ok(r.agreedPrice >= 1200, 'agreed price must clear the supplier floor');
    assert.ok(r.agreedPrice <= 1500, 'agreed price must respect the buyer ceiling');
  });

  it('fails honestly when offers cannot meet', () => {
    const r = negotiate({ asking: 3000, floor: 1200, ceiling: 1500, maxRounds: 8 });
    assert.strictEqual(r.agreed, false, 'must NOT invent a deal');
    assert.ok(r.reason, 'a refusal must carry a reason a human can act on');
    // The critical part: no price is asserted when nothing was agreed.
    assert.strictEqual(r.agreedPrice, null);
  });
});

describe('agent negotiation — the band is respected, never crossed', () => {
  const band = { floor: 1200, ceiling: 1500, maxRounds: 8 };

  it('never returns a price outside the agreed band, across many asks', () => {
    for (let asking = 800; asking <= 3000; asking += 50) {
      const r = negotiate({ ...band, asking });
      if (r.agreed) {
        assert.ok(
          r.agreedPrice! >= band.floor && r.agreedPrice! <= band.ceiling,
          `asking ${asking} produced ${r.agreedPrice}, outside [${band.floor}, ${band.ceiling}]`
        );
      } else {
        assert.strictEqual(r.agreedPrice, null, `asking ${asking} refused but still priced`);
      }
    }
  });

  it('the supplier never counters below its own floor', () => {
    const r = negotiate({ ...band, asking: 900 });
    for (const round of r.rounds) {
      if (round.by === 'supplier') {
        assert.ok(round.price >= band.floor, `supplier countered ${round.price}, below its floor`);
      }
    }
  });

  it('the buyer never offers above its own ceiling', () => {
    const r = negotiate({ ...band, asking: 1250 });
    for (const round of r.rounds) {
      if (round.by === 'buyer') {
        assert.ok(round.price <= band.ceiling, `buyer offered ${round.price}, above its ceiling`);
      }
    }
  });

  it('refuses when the supplier floor is above the buyer ceiling', () => {
    const r = negotiate({ asking: 1400, floor: 1700, ceiling: 1500, maxRounds: 8 });
    assert.strictEqual(r.agreed, false);
    assert.ok(/floor/i.test(r.reason!), 'the reason must name the floor');
  });

  it('refuses when the round budget is too small to converge', () => {
    const r = negotiate({ asking: 1450, floor: 1200, ceiling: 1500, maxRounds: 2 });
    assert.strictEqual(r.agreed, false);
    assert.ok(/round/i.test(r.reason!), 'the reason must name the round budget');
  });

  it('agrees when the buyer opens below the floor and the floor is acceptable', () => {
    const r = negotiate({ asking: 1000, floor: 1200, ceiling: 1500, maxRounds: 8 });
    assert.ok(r.agreed, `expected a deal, got refused: ${r.reason}`);
    assert.strictEqual(r.agreedPrice, 1200, 'the deal lands on the supplier floor');
  });
});

describe('agent negotiation — bounded and deterministic', () => {
  it('never exceeds maxRounds', () => {
    for (const maxRounds of [1, 2, 3, 5, 8, 50]) {
      const r = negotiate({ asking: 1450, floor: 1200, ceiling: 1500, maxRounds });
      assert.ok(r.rounds.length <= maxRounds, `maxRounds ${maxRounds} was exceeded`);
    }
  });

  it('is deterministic', () => {
    const args = { asking: 1450, floor: 1200, ceiling: 1500, maxRounds: 8 };
    assert.deepStrictEqual(negotiate(args), negotiate(args));
  });

  it('every round names both a speaker and a reason', () => {
    const r = negotiate({ asking: 1450, floor: 1200, ceiling: 1500, maxRounds: 8 });
    assert.ok(r.rounds.length >= 2, 'a negotiation needs more than one round to be one');
    for (const round of r.rounds) {
      assert.ok(round.by === 'buyer' || round.by === 'supplier');
      assert.ok(round.reason && round.reason.length > 0, 'each round must explain itself');
      assert.strictEqual(typeof round.price, 'number');
    }
  });
});

describe('the agents are inspectable on their own', () => {
  it('the supplier will not go below its floor', () => {
    for (const p of [0, 500, 1199, 1200, 5000]) {
      const move = supplierAgent.counter({ theirFloor: 1200, buyerOffer: p });
      assert.ok(move.price >= 1200, `supplier moved to ${move.price} for an offer of ${p}`);
      assert.ok(move.reason.length > 0);
    }
  });

  it('the buyer will not pay above its ceiling', () => {
    for (const p of [0, 500, 1499, 1500, 9000]) {
      const move = buyerAgent.consider({ theirCeiling: 1500, supplierOffer: p });
      assert.ok(move.price === null || move.price <= 1500, `buyer accepted ${move.price}`);
    }
  });

  it('the buyer declines a price above its ceiling rather than accepting it', () => {
    const move = buyerAgent.consider({ theirCeiling: 1500, supplierOffer: 1700 });
    assert.strictEqual(move.price, null);
    assert.ok(/ceiling/i.test(move.reason));
  });
});