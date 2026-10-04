/**
 * The AI seam — one door, two resolvers, no failures.
 *
 * `resolve()` is the only thing the rest of the app calls. It asks the live
 * resolver first, falls back to the offline one, and returns `null` rather than
 * throwing if both decline. It NEVER rejects: a copilot that reports an error
 * instead of answering is the failure mode this whole layer exists to remove.
 *
 * The order is deliberate. The offline resolver runs on the LEARNED bank first,
 * because a phrase the user taught in Settings is a stronger instruction than
 * anything a model infers, and it costs nothing.
 */
import type { Resolver, ResolverResult } from './contract.ts';
import { resolveOffline } from './offlineResolver.ts';
import { resolveLive } from './liveResolver.ts';

export * from './contract.ts';
export {
  learnedPhrases,
  learnPhrase,
  forgetPhrase,
  clearLearnedPhrases,
  recentMisses,
  recordMiss,
  clearMisses,
  type LearnedPhrase
} from './misses.ts';
export { offlineResolver, resolveOffline } from './offlineResolver.ts';
export { liveResolver, resolveLive, LIVE_SYSTEM_PROMPT } from './liveResolver.ts';

/**
 * Classify an utterance, best effort, never throwing.
 *
 * `now` and `live` exist so tests can drive the chain deterministically without
 * a network or a wall clock.
 */
export async function resolve(
  utterance: string,
  opts: { live?: Resolver } = {}
): Promise<ResolverResult> {
  // A taught phrase wins outright. It is an explicit instruction from the user.
  const offline = resolveOffline(utterance);
  if (offline.call) return offline;

  const live = opts.live ?? resolveLive;
  try {
    const result = await live(utterance);
    if (result.call) return result;
    // The live model declined. Say why it was preferred over the local answer,
    // which is almost always a network failure rather than a reasoning one.
    return { reason: `offline: ${offline.reason ?? 'no match'}; live: ${result.reason ?? 'no match'}` };
  } catch (e) {
    // `resolveLive` already swallows its own errors; this catches a resolver
    // supplied by a caller or test, so the contract holds for all of them.
    return { reason: offline.reason ?? String(e) };
  }
}