/**
 * Urdu retrieval glossary.
 *
 * WHY THIS EXISTS
 *   `tokenize()` keeps `[a-zA-Z0-9-]` only. The statutory corpus is English, so
 *   that is right for the corpus side — but it also means an Urdu-script
 *   question produces ZERO terms. `retrieve()` then returns every chunk at
 *   score 0 and the compliance agent refuses with "matched 0% of your
 *   question". The demo bar's own compliance chip ("اس ٹرانزیکشن پر کیا ٹیکس
 *   قانون لاگو ہے؟") therefore answered "I don't know" in the one language the
 *   product leads with. That is the exactness bug this file removes.
 *
 * WHAT IT IS, AND IS NOT
 *   A retrieval aid, not a translation and not an answer. It rewrites the
 *   QUESTION into the terms the indexed statute is written in, so the scoring
 *   function can do its job. Every figure in the reply still comes from the
 *   chunk that was retrieved and cited; the glossary can never produce a rate.
 *   The confidence gate is unchanged and still runs after glossing, so a
 *   question the corpus cannot answer is still refused — including in Urdu.
 *
 * WHY THE VALUES ARE SO SHORT
 *   Score is the fraction of the question's terms that found a home. Every
 *   glossed word is a denominator term, so padding a mapping with plausible
 *   English ("tax law act section applicable") drags the score of the correct
 *   chunk down with it. Each value below is the smallest set of corpus
 *   vocabulary that identifies the concept. `retrieval.test.ts` and
 *   `urduRetrieval.test.ts` pin both halves: the right chunk wins, and the
 *   unanswerable questions still refuse.
 */

/** Ordered longest-first so "انکم ٹیکس" is consumed before bare "ٹیکس". */
export const URDU_TERM_GLOSSARY: ReadonlyArray<readonly [string, string]> = [
  ['انکم ٹیکس', 'income tax'],
  ['سیلز ٹیکس', 'sales tax'],
  ['جی ایس ٹی', 'gst sales tax'],
  ['ٹیکس ریٹ', 'tax rate'],
  // "کتنا / کتنی / کتنے" is how Urdu asks for a FIGURE. The English equivalent
  // of "سیلز ٹیکس کتنی لگتی ہے" is "what is the sales tax RATE", and the word
  // 'rate' is what lets the standard-rate chunk outrank the filing calendar,
  // which mentions "sales tax" in its title but states no rate.
  ['کتنا', 'rate'],
  ['کتنی', 'rate'],
  ['کتنے', 'rate'],
  ['فائلنگ', 'filing return'],
  ['ڈیڈ لائن', 'filing deadline'],
  ['ٹرانزیکشن', 'supply sale'],
  ['ٹیکس', 'tax'],
  ['لاگو', 'rate'],
  ['قانون', 'act'],
  ['ریٹ', 'rate'],
  ['کٹی', 'deduct'],
  ['کٹنا', 'deduct'],
  ['کٹے', 'deduct'],
  ['کھسٹنگ', 'withholding'],
  ['فائلر', 'filer'],
  ['ای ٹی ایل', 'atl'],
  ['رجسٹرڈ', 'registered'],
  ['انرجسٹرڈ', 'unregistered'],
  ['برآمد', 'export'],
  ['ریٹرن', 'return'],
  ['فروخت', 'sale'],
  ['خریدار', 'recipient']
];

/**
 * Rewrite an Urdu-script question into corpus vocabulary. English and
 * Roman-Urdu text in the query is left untouched, so a mixed-language
 * question keeps both halves.
 */
export function glossQuery(query: string): string {
  let out = query ?? '';
  for (const [from, to] of URDU_TERM_GLOSSARY) {
    if (out.includes(from)) out = out.split(from).join(` ${to} `);
  }
  return out;
}