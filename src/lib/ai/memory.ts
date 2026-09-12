import { MEMORY_WINDOW } from "@/lib/ai/model-config";
import type { ChatMessage } from "@/lib/ai/types";

/**
 * CONVERSATION MEMORY (PRD §16) — short-term context, 6–10 turns.
 *
 * In-memory Map keyed by session is intentional for the hackathon milestone
 * H4–10. Replacement contract: swap these functions for Supabase
 * `chat_sessions`/`chat_messages` reads/writes (migration 0003, Sidra) —
 * the orchestrator does not change.
 */

const globalStore = globalThis as unknown as { __chatMemory?: Map<string, ChatMessage[]> };
const memory: Map<string, ChatMessage[]> = (globalStore.__chatMemory ??= new Map());

/** Load the recent window for a session (oldest first). */
export function loadRecentMessages(sessionId: string): ChatMessage[] {
  return [...(memory.get(sessionId) ?? [])];
}

/** Append a turn, trimming to the window. */
export function appendMessage(sessionId: string, message: ChatMessage): void {
  const list = memory.get(sessionId) ?? [];
  list.push(message);
  memory.set(sessionId, list.slice(-MEMORY_WINDOW));
}

/** Test/dev helper. */
export function clearSession(sessionId: string): void {
  memory.delete(sessionId);
}
