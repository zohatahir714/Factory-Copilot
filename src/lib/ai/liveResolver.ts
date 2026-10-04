/**
 * The live resolver — Groq, used for understanding only.
 *
 * The model is given the list of tools and asked for one. It is given no ledger
 * data, no arithmetic, and no permission to write. Everything it returns is
 * checked twice before it can reach a tool: against the closed schema in
 * `contract.ts`, and then against the live ledger by the caller.
 *
 * Failure is expected, not exceptional: no key, expired key, rate limit, the
 * network at a venue being worse than the network at home. Every one of those
 * returns a reason and falls through to the deterministic path. The user sees
 * a normal answer, never an error — a copilot that says "the AI is down" mid
 * demo has failed in the most visible way possible.
 */
import { parseToolCall, toolSchemaForPrompt, type Resolver, type ResolverResult } from './contract.ts';

const SYSTEM_PROMPT = `You route commands for a Pakistani textile-mill ERP.
Pick exactly ONE tool from the list and fill its parameters.

Rules:
- Return ONLY JSON: {"tool":"...","params":{...},"confidence":0.0-1.0}
- Copy names, amounts and quantities verbatim from the user's words. Never invent one.
- If the user's words do not clearly match a tool, return {"tool":"","params":{},"confidence":0.1}
- "save", "record", "add", "register" mean the user wants to WRITE, not to read.
- confidence is how sure you are that this is the tool they meant.

Tools:
{{TOOLS}}`;

export const LIVE_SYSTEM_PROMPT = SYSTEM_PROMPT.replace('{{TOOLS}}', toolSchemaForPrompt());

/**
 * Ask the server-held key for a tool choice.
 *
 * `queryGroqChat` is imported dynamically so a build without the key, or a
 * test, never pulls the network client into the graph.
 */
export async function resolveLive(utterance: string): Promise<ResolverResult> {
  try {
    const { queryGroqChat } = await import('../groqClient.ts');
    const raw = await queryGroqChat(
      [{ role: 'user', content: utterance }],
      '',
      LIVE_SYSTEM_PROMPT
    );
    if (!raw) return { reason: 'empty completion' };
    return parseToolCall(raw);
  } catch (e) {
    // Expected whenever GROQ_API_KEY is absent or the network is down. The
    // offline resolver answers instead and the user is none the wiser.
    console.info(
      'Live resolver unavailable, routing locally:',
      e instanceof Error ? e.message : e
    );
    return { reason: 'resolver unreachable' };
  }
}

export const liveResolver: Resolver = resolveLive;