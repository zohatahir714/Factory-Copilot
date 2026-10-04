/**
 * Guarded access to the Voice Mind.
 *
 * `understand` throws when the model is unreachable (`MIND_INVALID_JSON`, a
 * 503, a missing key). Callers used to await it inside a single outer try, so
 * that throw surfaced as a raw "System error" and the deterministic supervisor
 * below it never ran. This wrapper makes the mind strictly optional: it either
 * returns a result or returns `null`, and never rejects.
 *
 * The `understandFn` override exists so the fallback is testable without a
 * network. Production callers omit it and get the real module.
 */
import type { LiveStateDigest, MindResult } from './mind.ts';

export type UnderstandFn = (
  rawUtterance: string,
  digest: LiveStateDigest,
  parseOverride?: (raw: string) => import('./fastPath').VoiceIntent | null
) => Promise<MindResult>;

export async function safeUnderstand(
  rawUtterance: string,
  digest: LiveStateDigest,
  understandFn?: UnderstandFn
): Promise<MindResult | null> {
  try {
    const fn = understandFn ?? (await import('./mind')).understand;
    return await fn(rawUtterance, digest);
  } catch (e) {
    // Expected whenever GROQ_API_KEY is absent or the network is down. The
    // deterministic supervisor answers from live ledger state regardless.
    console.info(
      'Voice mind unavailable, using deterministic supervisor:',
      e instanceof Error ? e.message : e
    );
    return null;
  }
}