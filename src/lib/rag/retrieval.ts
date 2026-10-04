/**
 * Grounded retrieval over the statutory corpus.
 *
 * The whole point of this layer is the refusal. The previous implementation —
 * a chain of `if (q.includes('withholding'))` branches — had no branch that
 * said "I don't know", so every question received a confident answer. Asking
 * about Pakistan's best bowling attack returned the Sales Tax Act, because
 * the default branch returned `found: true, confidence: 0.97`.
 *
 * Scoring is term coverage over a small, hand-checkable field weighting. It is
 * not a semantic model, and it does not pretend to be one: a term earns credit
 * only by literally appearing in the chunk, and the score is the fraction of
 * the question's meaningful terms that found a home. A question about cotton
 * ginners matches nothing but the word "tax", scores near zero, and is refused
 * — which is the correct outcome, because FBR has published no SN009 template
 * and the honest answer is that we do not have one.
 *
 * KNOWN LIMITATION: no synonyms, no stemming beyond a trivial plural strip, no
 * IDF. "9" does not match "nine per cent". Every such gap lowers a score,
 * which pushes toward refusal rather than toward a confident wrong answer —
 * the safe direction to be wrong in, but it is a limitation and not a design.
 */
import type { StatuteChunk } from './corpus';

/**
 * Minimum coverage for the retrieval layer to be willing to answer. Below this
 * the caller must refuse rather than quote the nearest passage.
 */
export const RAG_CONFIDENCE_GATE = 0.6;

/**
 * A question that contributes fewer than this many meaningful terms carries no
 * discrimination at all: every chunk that happens to contain the word ties at
 * 1.00 and the winner is decided by the alphabetical tie-break, not by meaning.
 * The bare word "tax" appears in every provision in the corpus. Asking for the
 * minimum term count turns that coin-flip into the one question that unblocks
 * it, which is the honest answer and a better demo than a lucky guess.
 */
export const RAG_MIN_QUERY_TERMS = 2;

/** Words carrying no retrieval signal. Note: 'non' is deliberately absent. */
const STOPWORDS = new Set([
  'a', 'about', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'if',
  'in', 'into', 'is', 'it', 'its', 'may', 'me', 'might', 'must', 'my', 'of', 'on', 'or',
  'our', 'shall', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'to', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your',
  // Roman-Urdu function words. The corpus is English statute, so none of these
  // can ever carry retrieval signal — but each one is a denominator term that
  // dragged a legitimate question under the gate. "kitna tax lagta hai" tokenised
  // to [kitna, tax, lagta, hai] and scored 0.25: two real words drowned by two
  // empty ones. Dropping them is recall, not leniency: the gate still runs on
  // the terms that remain.
  'hai', 'hain', 'ho', 'hoon', 'ka', 'ki', 'ke', 'ko', 'kyun', 'kya', 'kitna', 'kitni',
  'kitne', 'kro', 'karo', 'kar', 'kr', 'lagta', 'lagti', 'lagte', 'lage', 'mujhe',
  'batao', 'bata', 'bataye', 'batayen', 'sirf', 'wala', 'wali', 'wale', 'aur', 'ya',
  'par', 'pe', 'wa', 'wo', 'woh', 'abhi', 'phir', 'bhi', 'hi',
  // The same reasoning applies to the English verb the Roman-Urdu word maps to:
  // "lagta hai" is dropped above, so "applies" has to go too or the two
  // languages score the same question differently.
  'applies', 'apply', 'applied'
]);

/**
 * Lower-case, strip punctuation, and collapse a plural. Hyphens survive so that
 * "non-atl" stays one token — collapsing it to "atl" is what previously made the
 * two §153 limbs indistinguishable.
 */
export function normalise(raw: string): string {
  let w = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) {
    return w.slice(0, -1);
  }
  return w;
}

/** Split into normalised terms, dropping stopwords and single characters. */
export function tokenize(text: string): string[] {
  return text
    .split(/[^a-zA-Z0-9-]+/)
    .filter(Boolean)
    .map(normalise)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

interface Field {
  weight: number;
  /** Whole tokens, hyphens intact. */
  exact: Set<string>;
  /** Sub-parts of hyphenated tokens only, so partial credit is specific. */
  parts: Set<string>;
}

function makeField(text: string, weight: number): Field {
  const exact = new Set<string>();
  const parts = new Set<string>();
  for (const t of tokenize(text)) {
    exact.add(t);
    if (t.includes('-')) {
      for (const p of t.split('-')) if (p.length > 1) parts.add(p);
    }
  }
  return { weight, exact, parts };
}

/**
 * 1 when the term appears verbatim, 0.5 when it appears only as part of a
 * hyphenated compound or the compound only contains one of its parts. The
 * full/partial distinction is what separates "ATL" from "non-ATL": asking about
 * filers on the ATL scores a bare 0.5 against the non-ATL chunk but a full 1.0
 * against the ATL one, so the right rate wins the ranking.
 */
function matchQuality(term: string, f: Field): number {
  if (f.exact.has(term)) return 1;
  if (f.parts.has(term)) return 0.5;
  if (term.includes('-')) {
    for (const p of term.split('-')) {
      if (p.length > 1 && (f.exact.has(p) || f.parts.has(p))) return 0.5;
    }
  }
  return 0;
}

export interface ScoredChunk {
  chunk: StatuteChunk;
  /** Fraction of the question's meaningful terms found in this chunk, 0..1. */
  score: number;
}

const FIELD_WEIGHTS = {
  title: 1.0,
  keywords: 1.0,
  body: 0.6,
  citation: 0.2
};

/**
 * Rank the corpus against a question. Always returns every chunk, ranked, so a
 * refusal can report how close the nearest provision came without citing it.
 * Ties break on chunk id so the ranking is byte-identical between runs.
 */
export function retrieve(query: string, corpus: StatuteChunk[]): ScoredChunk[] {
  const terms = [...new Set(tokenize(query ?? ''))];
  if (terms.length === 0 || !corpus || corpus.length === 0) {
    return (corpus ?? []).map(chunk => ({ chunk, score: 0 }));
  }

  const scored = corpus.map(chunk => {
    const fields: Field[] = [
      makeField(chunk.title, FIELD_WEIGHTS.title),
      makeField((chunk.keywords ?? []).join(' '), FIELD_WEIGHTS.keywords),
      makeField(chunk.body, FIELD_WEIGHTS.body),
      makeField(chunk.citation, FIELD_WEIGHTS.citation)
    ];
    let earned = 0;
    for (const term of terms) {
      let best = 0;
      for (const f of fields) {
        const m = matchQuality(term, f);
        if (m > 0) best = Math.max(best, m * f.weight);
      }
      earned += best;
    }
    const score = earned / terms.length;
    return { chunk, score: Math.round(score * 10000) / 10000 };
  });

  scored.sort((a, b) => (b.score - a.score) || (a.chunk.id < b.chunk.id ? -1 : a.chunk.id > b.chunk.id ? 1 : 0));
  return scored;
}