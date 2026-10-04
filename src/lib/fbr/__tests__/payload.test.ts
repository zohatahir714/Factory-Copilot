/**
 * FBR Digital Invoicing payload conformance — Task 6, Phase 2.
 *
 * Written BEFORE `payload.ts` existed, per PLAN.md §Verification.
 *
 * Why this matters: FBR requires a licensed integrator to transmit, so we
 * cannot file. What we CAN do — and what this suite proves — is emit the
 * payload shape their integrator can forward untouched. The arithmetic is the
 * whole product: an integrator that rejects the document is a wasted filing.
 *
 * The scenarios below are the cases real integrations get wrong. Several of
 * FBR's own strings contain typos that are load-bearing — a "corrected" string
 * will be rejected by the sandbox. They are encoded verbatim in `scenarios.ts`
 * and pinned here so nobody tidies them by accident.
 *
 * DEVIATION FROM TRACK DOC: the doc's snippets import `expect` from
 * `node:test`. Node v26's `node:test` exports no `expect` (runtime exports are
 * `assert`, `describe`, `it`, `mock`, ...), so that import yields `undefined`
 * and every case dies on `expect is not a function`. Translated onto
 * `node:assert/strict`, matching `reorder.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDiPayload } from '../payload';
import { getScenario, FBR_SCENARIOS } from '../scenarios';

/** A complete, reconciling header so a case tests one defect, not six. */
const CLEAN_HEADER = {
  documentNumber: 'INV-2026-0001',
  documentDate: '2026-10-01',
  sellerNTN: '1234567-8',
  sellerSTRN: '12-3456-7890-12-3',
  buyerName: 'Demo Textile Mills',
  buyerNTN: '7654321-0'
};

describe('FBR payload conformance — reconciliation', () => {
  it('SN001 — standard rate, registered buyer reconciles', () => {
    const p = buildDiPayload({
      scenarioId: 'SN001',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 90,
      furtherTax: 20
    });
    // The identity FBR's sandbox checks on every submission.
    assert.strictEqual(p.totalValues, 610);
    assert.strictEqual(p.saleType, 'Goods at standard rate (default)');
  });

  it('holds the identity for EVERY scenario we support', () => {
    for (const sc of FBR_SCENARIOS) {
      const p = buildDiPayload({
        scenarioId: sc.id,
        valueSalesExcludingST: sc.sampleValueSalesExcludingST,
        salesTaxApplicable: sc.sampleSalesTaxApplicable,
        furtherTax: sc.sampleFurtherTax
      });
      assert.strictEqual(
        p.totalValues,
        sc.sampleValueSalesExcludingST + sc.sampleSalesTaxApplicable + sc.sampleFurtherTax,
        `${sc.id} must reconcile`
      );
    }
  });

  it('rounds to two decimals and never leaves a float artefact', () => {
    const p = buildDiPayload({
      scenarioId: 'SN001',
      valueSalesExcludingST: 0.1,
      salesTaxApplicable: 0.2,
      furtherTax: 0
    });
    assert.strictEqual(p.totalValues, 0.3);
  });
});

describe('FBR payload conformance — the cases integrations get wrong', () => {
  it('SN002 — unregistered buyer carries further tax', () => {
    const p = buildDiPayload({
      scenarioId: 'SN002',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 90,
      furtherTax: 20
    });
    assert.strictEqual(p.buyerRegistrationType, 'Unregistered');
    assert.ok(p.furtherTax > 0);
  });

  it('SN008 — Third Schedule taxes the RETAIL price, not the transaction value', () => {
    // FBR sample: valueSalesExcludingST 1000, notified/retail 2000,
    // salesTaxApplicable 360 = 18% of 2000. Taxing 1000 would give 180 and
    // is the single most common integration failure.
    const p = buildDiPayload({
      scenarioId: 'SN008',
      valueSalesExcludingST: 1000,
      salesTaxApplicable: 360,
      furtherTax: 0
    });
    assert.strictEqual(p.salesTaxApplicable, 360);
    assert.strictEqual(p.totalValues, 1360);
  });

  it('SN009 — cotton spinners and ginners has no published template', () => {
    // Our wedge. FBR has no template, so we must not emit a confident payload
    // for it. It is registered as a known gap rather than silently absent.
    const sc = getScenario('SN009');
    assert.ok(sc, 'SN009 must be represented so the gap is visible');
    assert.strictEqual(sc.published, false);
  });

  it('refuses to build a payload for an unregistered scenario', () => {
    assert.throws(
      () =>
        buildDiPayload({
          scenarioId: 'SN999',
          valueSalesExcludingST: 500,
          salesTaxApplicable: 90
        }),
      /SN999/
    );
  });
});

describe('FBR payload conformance — verbatim strings', () => {
  it('SN024 keeps the pipe, not a capital I', () => {
    assert.strictEqual(getScenario('SN024')!.saleType, 'Goods as per SRO.297(|)/2023');
  });

  it('SN021 keeps the space before the slash', () => {
    assert.strictEqual(getScenario('SN021')!.saleType, 'Cement /Concrete Block');
  });

  it('SN005 extraTax is an empty string, not 0', () => {
    const p = buildDiPayload({
      scenarioId: 'SN005',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 0,
      furtherTax: 0
    });
    assert.strictEqual(p.extraTax, '');
  });

  it('SN006 rate is the string "Exempt", not 0', () => {
    const p = buildDiPayload({
      scenarioId: 'SN006',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 0,
      furtherTax: 0
    });
    assert.strictEqual(p.rate, 'Exempt');
    assert.strictEqual(typeof p.rate, 'string');
  });

  it('never coerces a rate to a number', () => {
    for (const sc of FBR_SCENARIOS) {
      const p = buildDiPayload({
        scenarioId: sc.id,
        valueSalesExcludingST: sc.sampleValueSalesExcludingST,
        salesTaxApplicable: sc.sampleSalesTaxApplicable,
        furtherTax: sc.sampleFurtherTax
      });
      assert.strictEqual(typeof p.rate, 'string', `${sc.id} rate must stay a string`);
    }
  });
});

describe('FBR payload conformance — the reconciler reports, never corrects', () => {
  // The probe proved these warnings fire. Without assertions here the whole
  // reconciler could rot to `return []` and the suite would still be green.
  const hasWarning = (warnings: string[], needle: RegExp) => warnings.some(w => needle.test(w));

  it('stays silent when a fully populated standard-rate invoice reconciles', () => {
    const p = buildDiPayload({
      scenarioId: 'SN001',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 90,
      ...CLEAN_HEADER
    });
    assert.deepStrictEqual(p.integratorWarnings, [], 'a clean invoice must produce no warnings');
    assert.strictEqual(p.impliedTaxBase, 500);
  });

  it('catches Third Schedule tax taken on the transaction value', () => {
    const p = buildDiPayload({
      scenarioId: 'SN008',
      valueSalesExcludingST: 1000,
      salesTaxApplicable: 180, // 18% of 1000 — the classic mistake
      ...CLEAN_HEADER
    });
    assert.ok(
      hasWarning(p.integratorWarnings, /transaction value/i),
      'must flag that the tax base is the transaction value'
    );
    // The figures are shipped AS GIVEN, not silently recomputed.
    assert.strictEqual(p.salesTaxApplicable, 180);
  });

  it('accepts Third Schedule tax taken on the retail price', () => {
    const p = buildDiPayload({
      scenarioId: 'SN008',
      valueSalesExcludingST: 1000,
      salesTaxApplicable: 360, // 18% of 2000 retail
      notifiedValueOrRetailPrice: 2000,
      ...CLEAN_HEADER
    });
    assert.strictEqual(p.impliedTaxBase, 2000);
    assert.ok(
      !hasWarning(p.integratorWarnings, /transaction value/i),
      'correct retail-base tax must not raise the tax-base warning'
    );
  });

  it('catches tax charged on an Exempt sale', () => {
    const p = buildDiPayload({
      scenarioId: 'SN006',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 25,
      ...CLEAN_HEADER
    });
    assert.ok(hasWarning(p.integratorWarnings, /Exempt/));
    assert.strictEqual(p.impliedTaxBase, null, 'Exempt has no derivable tax base');
  });

  it('catches furtherTax that contradicts the declared extraTax', () => {
    const p = buildDiPayload({
      scenarioId: 'SN002',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 90,
      furtherTax: 3, // 2% of 500 is 10
      ...CLEAN_HEADER
    });
    assert.ok(hasWarning(p.integratorWarnings, /furtherTax/));
    assert.strictEqual(p.furtherTax, 3, 'the given figure is shipped, not overwritten');
  });

  it('flags SN009 as unpublished on the payload itself, not only in the table', () => {
    const p = buildDiPayload({
      scenarioId: 'SN009',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 90,
      ...CLEAN_HEADER
    });
    assert.strictEqual(p.scenarioPublished, false);
    assert.ok(hasWarning(p.integratorWarnings, /no template/i));
  });

  it('reports missing identity instead of inventing it', () => {
    const p = buildDiPayload({
      scenarioId: 'SN001',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 90
    });
    assert.strictEqual(p.buyerNTN, '', 'an absent NTN stays absent');
    assert.strictEqual(p.sellerNTN, '', 'an absent seller NTN is never inferred');
    assert.strictEqual(p.sellerSTRN, '', 'an absent STRN is never inferred');
    assert.strictEqual(p.documentDate, '');
    assert.ok(hasWarning(p.integratorWarnings, /sellerNTN/));
    assert.ok(hasWarning(p.integratorWarnings, /sellerSTRN/));
    assert.ok(hasWarning(p.integratorWarnings, /buyerNTN/));
  });

  it('keeps buyerRegistrationType from the scenario unless overridden', () => {
    const p = buildDiPayload({
      scenarioId: 'SN002',
      valueSalesExcludingST: 500,
      salesTaxApplicable: 90,
      furtherTax: 10,
      ...CLEAN_HEADER
    });
    assert.strictEqual(p.buyerRegistrationType, 'Unregistered');
    // A buyer marked Unregistered does not need an NTN, so no warning there.
    assert.ok(!hasWarning(p.integratorWarnings, /buyerNTN/));
  });
});

describe('FBR payload conformance — honesty about what we are', () => {
  it('is deterministic', () => {
    const args = { scenarioId: 'SN001', valueSalesExcludingST: 500, salesTaxApplicable: 90, furtherTax: 20 };
    assert.deepStrictEqual(buildDiPayload(args), buildDiPayload(args));
  });

  it('declares transmission requires a licensed integrator', () => {
    // The payload must never imply the app files on the user's behalf.
    const p = buildDiPayload({ scenarioId: 'SN001', valueSalesExcludingST: 500, salesTaxApplicable: 90, furtherTax: 20 });
    assert.strictEqual(p.transmissionNote, 'Schema-valid payload for your licensed integrator');
  });

  it('refuses a negative value rather than emitting one', () => {
    assert.throws(
      () => buildDiPayload({ scenarioId: 'SN001', valueSalesExcludingST: -1, salesTaxApplicable: 0, furtherTax: 0 }),
      /negative/i
    );
  });
});