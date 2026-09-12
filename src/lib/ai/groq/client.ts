import Groq from "groq-sdk";

/**
 * Server-only module. NEVER import this from a client component —
 * the API key must not reach the browser (PRD §19).
 */

let cached: Groq | null = null;

/** True when the error came from Groq rate limiting or a provider-side outage (PRD §29). */
export function isProviderError(err: unknown): boolean {
  if (err instanceof GroqConfigError) return false;
  const anyErr = err as { status?: number; code?: string; message?: string };
  if (typeof anyErr?.status === "number") {
    return anyErr.status === 429 || anyErr.status >= 500;
  }
  // SDK network failures surface as fetch errors with a message but no status
  if (anyErr instanceof Error && /fetch|network|ECONN|timeout/i.test(anyErr.message)) {
    return true;
  }
  return false;
}

export class GroqConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroqConfigError";
  }
}

/**
 * Returns the shared Groq SDK client (OpenAI-compatible).
 * Throws GroqConfigError at request time if GROQ_API_KEY is missing.
 */
export function getGroqClient(): Groq {
  if (cached) return cached;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqConfigError(
      "GROQ_API_KEY is not set. Add it to .env.local (server-side only)."
    );
  }

  // No custom baseURL: the SDK's default already points at
  // https://api.groq.com/openai/v1 — appending it again double-prefixes the path.
  cached = new Groq({ apiKey });
  return cached;
}

/** Test helper — clears the cached client between tests. */
export function resetGroqClient(): void {
  cached = null;
}
