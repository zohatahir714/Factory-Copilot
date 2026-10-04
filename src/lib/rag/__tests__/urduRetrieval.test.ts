/**
 * Urdu retrieval — the compliance agent used to be blind in Urdu.
 *
 * WHY THIS SUITE
 *   `tokenize()` keeps `[a-zA-Z0-9-]` only. The statutory corpus is English, so
 *   that is correct for the corpus — and it silently meant an Urdu-script
 *   question produced ZERO terms, every chunk tied at 0.00, and the copilot
 *   refused the demo bar's own compliance chip with "matched 0% of your
 *   question". The product's headline claim is Urdu support; the tax layer,
 *   the part a judge is most likely to probe, was the one place it failed.
 *
 *   Two fixes are pinned here and they are in tension on purpose: glossing must
 *   make the right provision retrievable, and it must NOT make the corpus
 *   answer questions it has no provision for. A glossary that only widens
 *   recall looks like an improvement until someone asks about credit cards.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { queryComplianceRAG } from '../../ragCompliance';
import { glossQuery } from '../urduGlossary';
import { retrieve, RAG_CONFIDENCE_GATE, RAG_MIN_QUERY_TERMS, STATUTORY_CORPUS, tokenize } from '../index';
import type { ComplianceRAGSource } from '../../../types';

const NO_SOURCES: ComplianceRAGSource[] = [];

function top(q: string): { id: string; score: number } {
  const hits = retrieve(glossQuery(q), STATUTORY_CORPUS);
  return { id: hits[0].chunk.id, score: hits[0].score };
}

describe('an Urdu question produces searchable terms', () => {
  it('a bare Urdu word is unsearchable raw, and one term short even glossed', () => {
    assert.deepEqual(tokenize('ٹیکس'), [], 'raw tokenisation is the blind spot');
    assert.deepEqual(
      tokenize(glossQuery('ٹیکس')),
      ['tax'],
      'glossing can only supply the concept, never a second term to judge it by'
    );
    assert.equal(
      tokenize(glossQuery('ٹیکس')).length < RAG_MIN_QUERY_TERMS,
      true,
      'which is why the min-terms guard has to exist as well'
    );
  });

  it('the demo bar compliance chip retrieves the standard sales tax rate', () => {
    // Verbatim prompt sent by the chip in CopilotChatView.tsx.
    const r = queryComplianceRAG(NO_SOURCES, 'اس ٹرانزیکشن پر کیا ٹیکس قانون لاگو ہے؟');
    assert.equal(r.found, true, 'the chip the demo bar sends must answer');
    assert.equal(r.citation, 'Sales Tax Act 1990, Section 3(1)');
    assert.equal(r.gstRate, 18);
  });

  const ranking: ReadonlyArray<readonly [string, string]> = [
    ['سیلز ٹیکس کتنی لگتی ہے', 'sta_1990_s3_standard'],
    ['ٹیکس ریٹ کتنا ہے', 'sta_1990_s3_standard'],
    ['سیکشن 153 کٹی ریٹ کتنی ہے', 'ito_2001_s153_atl'],
    ['سیلز ٹیکس فائلنگ کی آخری تاریخ کیا ہے', 'fbr_monthly_calendar'],
    ['برآمد پر ٹیکس کیا لاگو ہوتا ہے', 'sro_345_export_eou']
  ];

  for (const [q, expected] of ranking) {
    it(`"${q}" retrieves ${expected}`, () => {
      assert.equal(top(q).id, expected);
    });
  }

  it('the same question in Urdu and Roman Urdu reaches the same provision', () => {
    // Cross-language disagreement is the failure mode that reads as a bug on
    // stage: the judge hears the same sentence twice and gets two rates.
    const urdu = top('سیلز ٹیکس کتنی لگتی ہے');
    const roman = top('sirf tax rate kitna hai');
    assert.equal(roman.id, urdu.id);
    assert.ok(roman.score >= RAG_CONFIDENCE_GATE && urdu.score >= RAG_CONFIDENCE_GATE);
  });
});

describe('glossing widens retrieval, never answers', () => {
  const mustRefuse: ReadonlyArray<readonly [string, string]> = [
    ['کیا کریڈیٹ کارڈ لاگو ہوتا ہے', 'no provision covers card payments'],
    ['بینک امریکا میں کتنے ایڈمز ہیں', 'nothing in a tax corpus answers this'],
    ['best bowling attack in Pakistan cricket', 'the canonical non-tax question']
  ];

  for (const [q, why] of mustRefuse) {
    it(`refuses "${q}" — ${why}`, () => {
      const r = queryComplianceRAG(NO_SOURCES, q);
      assert.equal(r.found, false);
      assert.equal(r.gstRate, 0);
      assert.equal(r.withholdingRate, 0);
    });
  }

  it('a one-term question asks which tax instead of guessing a rate', () => {
    // "tax" appears in every provision, so ranking it is an alphabetical
    // coin-flip. The refusal has to come back as a question the user can
    // answer, not as an apology.
    const r = queryComplianceRAG(NO_SOURCES, 'ٹیکس');
    assert.equal(r.found, false);
    assert.match(r.shortAnswer, /which tax/i);
    assert.ok(!/18|9|4\.5/.test(r.shortAnswer), 'must not print a rate it did not retrieve');
  });

  it('the short answer quotes the provision, never a paraphrase of it', () => {
    const r = queryComplianceRAG(NO_SOURCES, 'سیکشن 153 کٹی ریٹ کتنی ہے');
    assert.equal(r.found, true);
    assert.match(r.shortAnswer, /4\.5%/);
    assert.ok(
      r.shortAnswer.includes(r.citation),
      'the terse form still names the authority it is quoting'
    );
    assert.ok(
      r.shortAnswer.length < r.explanation.length,
      'the terse form must be the shorter of the two'
    );
  });
});