/**
 * Public surface of the grounded retrieval layer.
 *
 * `retrieval.ts` deliberately does not import `corpus.ts`, so this module is
 * the one place that knows both exist and there is no import cycle.
 */
export { retrieve, tokenize, normalise, RAG_CONFIDENCE_GATE, RAG_MIN_QUERY_TERMS } from './retrieval';
export type { ScoredChunk } from './retrieval';
export { STATUTORY_CORPUS } from './corpus';
export type { StatuteChunk } from './corpus';
export { glossQuery, URDU_TERM_GLOSSARY } from './urduGlossary';