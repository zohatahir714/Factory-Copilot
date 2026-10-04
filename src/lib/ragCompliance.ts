/**
 * Compliance & FBR RAG Knowledge Retrieval System
 * Compliant with PRD Section 10 & Section 26
 * "The AI must not rely on model memory for authoritative tax/regulatory information."
 *
 * This module is now a thin, grounded wrapper. The export signature and the
 * `RAGQueryResult` shape are unchanged so `agentSupervisor.ts` and
 * `ComplianceQueryModal.tsx` keep working, but the logic is not the same
 * object: every branch below is replaced by retrieval over `STATUTORY_CORPUS`,
 * and below the confidence gate the correct output is a refusal.
 *
 * What it used to do: four `if (q.includes(...))` branches and a default, all
 * returning `found: true` with a literal confidence between 0.96 and 0.99. The
 * withholding branch was the worst of it — it answered 4.5% in the structured
 * field while the prose said 9.0% for non-filers, and it did so for every
 * query containing the word "filer", ATL or not.
 */

import { ComplianceRAGSource } from '../types';
import { glossQuery } from './rag/urduGlossary';
import { tokenize } from './rag/retrieval';
import { retrieve, RAG_CONFIDENCE_GATE, RAG_MIN_QUERY_TERMS, STATUTORY_CORPUS } from './rag/index';
import type { StatuteChunk } from './rag/index';

export interface RAGQueryResult {
  found: boolean;
  source: ComplianceRAGSource | null;
  citation: string;
  gstRate: number;
  withholdingRate: number;
  filingDeadline: string;
  explanation: string;
  /**
   * The main point only: the rate that applies, plus the provision it comes
   * from. `explanation` quotes the passage in full, which is the right answer
   * when asked for detail and the wrong answer to "what is the rate" — the
   * figure the user asked for is one clause inside a 700-character quotation.
   * Both come from the same retrieved chunk; `shortAnswer` never paraphrases.
   */
  shortAnswer: string;
  requiresHumanVerification: boolean;
  confidence: number;
}

/**
 * Every figure in the answer comes from the chunk that was actually retrieved,
 * each labelled with the condition it applies under. A rate is never restated
 * without the condition attached, which is what removes the possibility of the
 * sentence and the structured field disagreeing.
 */
function figuresFrom(chunk: StatuteChunk): string[] {
  const figures: string[] = [];
  if (typeof chunk.withholdingRate === 'number') {
    figures.push(`Withholding tax: ${chunk.withholdingRate}% of the amount paid — ${chunk.title}`);
  }
  if (typeof chunk.gstRate === 'number') {
    figures.push(`Sales tax on the taxable supply: ${chunk.gstRate}%`);
  }
  if (chunk.filingDeadline) {
    figures.push(`Filing obligation: ${chunk.filingDeadline}`);
  }
  return figures;
}

/**
 * The question named too little to choose between provisions. This is not a
 * knowledge gap and is deliberately phrased as a question, not an apology.
 */
function tooShort(query: string): RAGQueryResult {
  return {
    found: false,
    source: null,
    citation: '',
    gstRate: 0,
    withholdingRate: 0,
    filingDeadline: '',
    shortAnswer:
      'Which tax do you mean — sales tax on the invoice, withholding under section 153, or export?',
    explanation: [
      `"${query}" does not name enough for me to pick the right provision.`,
      '',
      'Every provision in the indexed corpus is about tax, so a one-word question matches all of them equally and the ranking would be decided by alphabetical order rather than by meaning. Picking one of those and printing a rate would be a guess dressed as an answer.',
      '',
      'Ask one of these and I will quote the provision:',
      '',
      '• "What is the sales tax rate?" — Sales Tax Act 1990, s.3(1)',
      '• "What is the section 153 withholding rate?" — Income Tax Ordinance 2001, Fourth Schedule, Part III',
      '• "Is export zero rated?" — S.R.O. 345(I)/2024',
      '• "When is the sales tax return due?" — Sales Tax Act 1990, s.9 and s.10'
    ].join('\n'),
    requiresHumanVerification: false,
    confidence: 0
  };
}

/**
 * The answer is the retrieved text, quoted, plus the figures read off it. The
 * quoted passage is the source of the number; nothing here is paraphrased from
 * the model's own recollection of the law.
 */
function shortGroundedAnswer(chunk: StatuteChunk, score: number): string {
  const kind = chunk.title.toLowerCase().includes('withholding') ? 'withholding tax'
    : chunk.title.toLowerCase().includes('sales tax') ? 'sales tax'
      : '';
  // The kind is only spelled out when the title does not already say it, so the
  // reply never reads "4.5% withholding tax — Withholding on supply of goods".
  const rate = typeof chunk.withholdingRate === 'number'
    ? `${chunk.withholdingRate}%${kind ? ` ${kind}` : ''}`
    : typeof chunk.gstRate === 'number'
      ? `${chunk.gstRate}%${kind ? ` ${kind}` : ''}`
      : null;
  const lead = rate ? `${rate} — ${chunk.title}` : chunk.title;
  // The filing deadline is deliberately absent: the main point is the rate the
  // user asked for, and it is still there in full behind "details".
  return `${lead}. \`${chunk.citation}\` (${(score * 100).toFixed(0)}% match).`;
}

function groundedAnswer(chunk: StatuteChunk, score: number): string {
  return [
    chunk.body,
    '',
    ...figuresFrom(chunk).map(f => `• ${f}`),
    '',
    `Provision: ${chunk.citation}`,
    `Retrieval confidence: ${(score * 100).toFixed(0)}% — the share of your question found in this provision.`
  ].join('\n');
}

/**
 * Say no, and say why. The closest provision is named as unquoted so the user
 * can see we searched, but it is not cited as authority for a question it does
 * not answer.
 */
function refuse(query: string, bestScore: number, closest: StatuteChunk | null): RAGQueryResult {
  const nearest = closest
    ? `The nearest provision in the index is "${closest.title}", which matched only ${(bestScore * 100).toFixed(0)}% of your question — below the ${(RAG_CONFIDENCE_GATE * 100).toFixed(0)}% threshold set for statutory answers, so it is not quoted here.`
    : 'No provision in the index matched any part of your question.';
  return {
    found: false,
    source: null,
    citation: '',
    gstRate: 0,
    withholdingRate: 0,
    filingDeadline: '',
    shortAnswer: closest
      ? `No provision scored above ${(RAG_CONFIDENCE_GATE * 100).toFixed(0)}%. Nearest is "${closest.title}" at ${(bestScore * 100).toFixed(0)}% — ask for "details", or have a licensed practitioner confirm.`
      : `No provision in the index matched. Ask for "details", or have a licensed practitioner confirm.`,
    explanation: [
      `I cannot answer "${query}" from the indexed statute.`,
      '',
      'Answering it would mean writing the law from memory, which is exactly what this retrieval layer exists to prevent — a plausible rate with no provision behind it is worse than no answer, because it looks authoritative.',
      '',
      nearest,
      '',
      'Have a licensed tax practitioner or the FBR help desk confirm this before acting on it. You can also extend the indexed corpus in src/lib/rag/corpus.ts once the provision is verified.'
    ].join('\n'),
    requiresHumanVerification: true,
    confidence: bestScore
  };
}

/**
 * Query the statutory corpus. The caller supplies the indexed `ComplianceRAGSource`
 * records only so a retrieved chunk can be linked back to the repository entry
 * it came from — no figure is ever read from them, because those records carry
 * one flat `withholdingRate` and cannot represent the ATL / non-ATL split.
 */
export function queryComplianceRAG(
  sources: ComplianceRAGSource[],
  query: string
): RAGQueryResult {
  const q = (query ?? '').trim();
  // Urdu-script questions are glossed into corpus vocabulary BEFORE scoring.
  // Without this they tokenize to nothing and every chunk ties at 0, so the
  // compliance agent refused the language the product is demoed in. The gate
  // still runs afterwards: glossing widens what can be RETRIEVED, never what
  // can be ANSWERED.
  const hits = retrieve(glossQuery(q), STATUTORY_CORPUS);
  const best = hits[0];

  // Too few terms to tell one provision from another. Refuse with the question
  // that unblocks it rather than letting an alphabetical tie-break pick a rate.
  if (tokenize(glossQuery(q)).length < RAG_MIN_QUERY_TERMS) {
    return tooShort(q);
  }

  if (!best || best.score < RAG_CONFIDENCE_GATE) {
    return refuse(q, best?.score ?? 0, best?.chunk ?? null);
  }

  const chunk = best.chunk;
  const linked = chunk.sourceId ? (sources ?? []).find(s => s.id === chunk.sourceId) ?? null : null;

  return {
    found: true,
    source: linked,
    citation: chunk.citation,
    gstRate: chunk.gstRate ?? 0,
    withholdingRate: chunk.withholdingRate ?? 0,
    filingDeadline: chunk.filingDeadline ?? '',
    explanation: groundedAnswer(chunk, best.score),
    shortAnswer: shortGroundedAnswer(chunk, best.score),
    requiresHumanVerification: false,
    confidence: best.score
  };
}