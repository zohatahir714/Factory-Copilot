/**
 * Model configuration — the single place where Groq model IDs live.
 * PRD names Llama 3.1/3.3, but those IDs became Groq Enterprise-only (Aug 2026).
 * Current self-serve production models are used instead; swap here if Groq changes lineup.
 */
export const MODELS = {
  /** Supervisor agent: intent, routing, confirmation policy, final wording */
  supervisor: "openai/gpt-oss-120b",
  /** Domain agents (inventory/purchase/accounting/compliance): bounded, cheap, fast */
  domain: "openai/gpt-oss-20b",
  /** Voice transcription */
  whisper: "whisper-large-v3-turbo",
} as const;

/** Max tool-call round-trips per user message (PRD: keep latency < ~3s) */
export const MAX_TOOL_HOPS = 4;

/** Conversation memory window (PRD §16: 6–10 turns) */
export const MEMORY_WINDOW = 10;

/** Groq base URL — exported so tests can stub it */
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
