// Gate-tuning aid — prints the real retrieval score for each query, and the
// next-best chunk, so the confidence margins can be inspected instead of
// assumed. Run: `npx tsx scripts/rag-scores.mts`. Not imported by the app.
//
// This exists because the unit tests only assert that the right chunk wins.
// They do not show you that it wins by 0.125 instead of 0.001, and a tie
// broken by an alphabetical tie-break instead of by score is a bug that still
// passes every assertion.
import { retrieve, RAG_CONFIDENCE_GATE, STATUTORY_CORPUS } from '../src/lib/rag/index';

const queries = [
  'withholding rate for non-ATL filers',
  'withholding rate for ATL filers',
  'what is the standard GST rate on a taxable supply?',
  'What is the standard GST rate for textile manufacturing?',
  'Withholding tax section 153 rate for active filers',
  'FBR monthly sales tax filing deadlines and Annexure-C',
  'SRO 345(I)/2024 export zero-rating criteria',
  'What is the best bowling attack in Pakistan cricket history?',
  'best bowling attack in Pakistan cricket',
  'who won the 1992 World Cup?',
  'cotton spinner buys from a cotton ginner, what tax applies?'
];

console.log(`gate = ${RAG_CONFIDENCE_GATE}\n`);
for (const q of queries) {
  const hits = retrieve(q, STATUTORY_CORPUS);
  const top = hits.slice(0, 3).map(h => `${h.chunk.id}=${h.score.toFixed(3)}`).join('  ');
  const verdict = (hits[0]?.score ?? 0) >= RAG_CONFIDENCE_GATE ? 'ANSWER' : 'REFUSE ';
  console.log(`${verdict} [${(hits[0]?.score ?? 0).toFixed(3)}] ${q}\n         ${top}`);
}