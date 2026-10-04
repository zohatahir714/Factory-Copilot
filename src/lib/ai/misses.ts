/**
 * The misses log — the feature that stops you having to tell me anything.
 *
 * Every utterance the deterministic rules miss, and the resolver cannot place,
 * is recorded here. The copilot can then offer its nearest real capabilities
 * instead of a dead end, and Settings can list the phrases it did not know so
 * the user can teach it in one click.
 *
 * The learned bank is read by the offline resolver at classification time, so
 * teaching works immediately, offline, with no deploy and no commit. It is the
 * difference between "tell Adil and wait for a build" and "add it yourself".
 *
 * Storage is localStorage and nothing else. It holds phrases the user typed —
 * no ledger data, no credentials, nothing worth syncing, which is why it is not
 * part of the cloud snapshot.
 */
import type { ToolName } from './contract.ts';

export interface LearnedPhrase {
  phrase: string;
  tool: ToolName;
  /** Extra parameters captured with the phrase, merged at classification time. */
  params: Record<string, string>;
  addedAt: string;
}

const BANK_KEY = 'factoryCopilot.learnedPhrases.v1';

/** In-memory mirror so classification does not pay a JSON parse per turn. */
let cache: LearnedPhrase[] | null = null;

function readStorage(): LearnedPhrase[] {
  try {
    const raw = localStorage.getItem(BANK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LearnedPhrase[]) : [];
  } catch {
    // Private mode, quota, or a corrupt value. An unusable bank must not break
    // the copilot, so it degrades to "nothing learned" rather than throwing.
    return [];
  }
}

/** Every learned phrase, oldest first. Safe to call outside a browser. */
export function learnedPhrases(): LearnedPhrase[] {
  if (typeof localStorage === 'undefined') return [];
  if (!cache) cache = readStorage();
  return cache;
}

function write(entries: LearnedPhrase[]): void {
  cache = entries;
  try {
    localStorage.setItem(BANK_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable. The in-memory copy still works for this
    // session, so the feature degrades to "until you reload" rather than
    // failing the click.
  }
}

/**
 * Teach the copilot a phrase.
 *
 * Exact-match on the whole utterance, which is what makes it trustworthy: it
 * cannot fire on an unrelated sentence. Adding the same phrase twice replaces
 * it rather than accumulating duplicates.
 */
export function learnPhrase(
  phrase: string,
  tool: ToolName,
  params: Record<string, string> = {}
): LearnedPhrase[] {
  const trimmed = phrase.trim();
  if (!trimmed) return learnedPhrases();

  const entry: LearnedPhrase = {
    phrase: trimmed,
    tool,
    params,
    addedAt: new Date().toISOString()
  };
  const rest = learnedPhrases().filter(
    p => p.phrase.toLowerCase() !== trimmed.toLowerCase()
  );
  const next = [...rest, entry];
  write(next);
  return next;
}

export function forgetPhrase(phrase: string): LearnedPhrase[] {
  const next = learnedPhrases().filter(p => p.phrase.toLowerCase() !== phrase.trim().toLowerCase());
  write(next);
  return next;
}

export function clearLearnedPhrases(): void {
  write([]);
}

/* --- THE MISSES LOG -------------------------------------------------------
 * A bounded ring of utterances nothing could route. Bounded because an
 * unbounded log in localStorage is how a demo machine runs out of quota six
 * minutes before a judge walks in. */

const MISS_KEY = 'factoryCopilot.misses.v1';
const MISS_LIMIT = 40;
let missCache: string[] | null = null;

export function recentMisses(): string[] {
  if (typeof localStorage === 'undefined') return [];
  if (!missCache) {
    try {
      const raw = localStorage.getItem(MISS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      missCache = Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      missCache = [];
    }
  }
  return missCache;
}

/**
 * Record an utterance that nothing could route.
 *
 * Duplicates are collapsed rather than counted: a user retrying the same
 * sentence three times is one thing they did not understand, not three.
 */
export function recordMiss(utterance: string): string[] {
  const text = utterance.trim();
  if (!text) return recentMisses();
  const current = recentMisses().filter(m => m.toLowerCase() !== text.toLowerCase());
  const next = [text, ...current].slice(0, MISS_LIMIT);
  missCache = next;
  try {
    localStorage.setItem(MISS_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: the log is an aid, never a dependency of answering.
  }
  return next;
}

/** Drop one phrase from the misses log — the user deciding it was not worth teaching. */
export function forgetMiss(utterance: string): string[] {
  const text = utterance.trim().toLowerCase();
  const next = recentMisses().filter(m => m.toLowerCase() !== text);
  missCache = next;
  try {
    localStorage.setItem(MISS_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: the log is an aid, never a dependency of answering.
  }
  return next;
}

export function clearMisses(): void {
  missCache = [];
  try {
    localStorage.removeItem(MISS_KEY);
  } catch {
    // Nothing to do; the in-memory copy is already cleared.
  }
}