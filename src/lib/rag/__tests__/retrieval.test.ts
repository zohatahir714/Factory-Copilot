/**
 * Grounded RAG — retrieval and the refusal gate.
 *
 * Written BEFORE the retrieval layer existed (PLAN.md Task 4, Step 1).
 *
 * The bug these cover was reproduced live: asking "withholding rate for
 * non-ATL filers" returned an answer whose sentence said 9.0% while the
 * structured field said 4.5%. And an out-of-corpus question — the best bowling
 * attack in Pakistan cricket — returned a confident Sales Tax Act answer,
 * because every branch returned `found: true` with a hardcoded confidence.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `reorder.test.ts`.
 *
 * PATH NOTE: `queryComplianceRAG` lives at `src/lib/ragCompliance.ts`, two
 * levels up from here. The first version of this file imported `../ragCompliance`,
 * which resolves to `src/lib/rag/ragCompliance` and fails to load — so this suite
 * was red for a bad import path, not because the retrieval layer was missing.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { queryComplianceRAG } from '../../ragCompliance';
import { RAG_CONFIDENCE_GATE, retrieve, STATUTORY_CORPUS } from '../index';
import { SEED_COMPLIANCE_SOURCES } from '../../../data/seedData';

const SOURCES = SEED_COMPLIANCE_SOURCES as any[];

describe('compliance grounding', () => {
  it('REFUSES an out-of-corpus question', () => {
    const r = queryComplianceRAG(SOURCES,
      'What is the best bowling attack in Pakistan cricket history?');
    assert.equal(r.found, false);
    assert.equal(r.gstRate, 0);
    assert.equal(r.withholdingRate, 0);
    assert.ok(r.confidence < RAG_CONFIDENCE_GATE,
      `confidence ${r.confidence} should be below the ${RAG_CONFIDENCE_GATE} gate`);
    assert.equal(r.source, null);
  });

  it('ANSWERS a withholding question with a §153 citation', () => {
    const r = queryComplianceRAG(SOURCES, 'withholding rate for non-ATL filers');
    assert.equal(r.found, true);
    assert.match(r.citation, /153/);
  });

  it('answers 9% for a NON-ATL filer — the live contradiction', () => {
    const nonAtl = queryComplianceRAG(SOURCES, 'withholding rate for non-ATL filers');
    assert.equal(nonAtl.withholdingRate, 9);

    const atl = queryComplianceRAG(SOURCES, 'withholding rate for ATL filers');
    assert.equal(atl.withholdingRate, 4.5);

    assert.notEqual(nonAtl.withholdingRate, atl.withholdingRate,
      'ATL and non-ATL rates must differ — this is the bug that shipped');
  });

  it('never cites an act it did not retrieve', () => {
    const r = queryComplianceRAG(SOURCES,
      'What is the best bowling attack in Pakistan cricket history?');
    assert.equal(r.citation, '');
  });

  it('flags a refusal for human verification', () => {
    const r = queryComplianceRAG(SOURCES, 'who won the 1992 World Cup?');
    assert.equal(r.requiresHumanVerification, true);
  });

  it('answers a standard-rate GST question at 18%', () => {
    const r = queryComplianceRAG(SOURCES, 'what is the standard GST rate on a taxable supply?');
    assert.equal(r.found, true);
    assert.equal(r.gstRate, 18);
    assert.match(r.citation, /Sales Tax Act/);
  });

  it('refuses the SN009 cotton-spinner gap instead of inventing a rule', () => {
    // FBR has published no template for SN009. Inventing one is the failure
    // this whole layer exists to prevent.
    const r = queryComplianceRAG(SOURCES,
      'cotton spinner buys from a cotton ginner, what tax applies?');
    assert.equal(r.found, false);
    assert.equal(r.gstRate, 0);
  });

  it('is deterministic — the same question gives the same answer', () => {
    const a = queryComplianceRAG(SOURCES, 'withholding rate for non-ATL filers');
    const b = queryComplianceRAG(SOURCES, 'withholding rate for non-ATL filers');
    assert.deepEqual(a, b);
  });
});

describe('retrieval', () => {
  it('scores an in-corpus question above the gate', () => {
    const hits = retrieve('withholding rate for non-ATL filers', STATUTORY_CORPUS);
    assert.ok(hits.length > 0);
    assert.ok(hits[0].score >= RAG_CONFIDENCE_GATE,
      `best score ${hits[0].score} below gate`);
  });

  it('scores an out-of-corpus question below the gate', () => {
    const hits = retrieve('best bowling attack in Pakistan cricket', STATUTORY_CORPUS);
    const best = hits[0]?.score ?? 0;
    assert.ok(best < RAG_CONFIDENCE_GATE, `best score ${best} should be below the gate`);
  });

  it('returns every chunk carrying a real citation', () => {
    for (const chunk of STATUTORY_CORPUS) {
      assert.ok(chunk.citation && chunk.citation.length > 5, `chunk ${chunk.id} has no citation`);
      assert.ok(chunk.body && chunk.body.length > 40, `chunk ${chunk.id} has no body`);
    }
  });
});