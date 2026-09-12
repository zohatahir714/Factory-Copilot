import { z } from "zod";
import type { ExecutionMode, ToolContext } from "@/lib/ai/tools/registry";

/**
 * PENDING ACTION STORE — the confirmation state machine (PRD §14).
 *
 * Flow: mutating tool call in chat → orchestrator runs the tool in "preview"
 * mode → draft is stored here with an action_id → `pending_action` SSE event
 * renders a Confirm/Edit/Cancel card → user clicks Confirm →
 * POST /api/tools/confirm re-executes the SAME tool with the SAME args in
 * "commit" mode. Cancel deletes. Edit re-enters the chat loop as a new user
 * message.
 *
 * In-memory Map is intentional for the hackathon (single Vercel region,
 * short-lived drafts). Post-hackathon: persist to a `pending_actions` table.
 */

export interface PendingAction {
  action_id: string;
  tool: string;
  args: unknown;
  summary: string;
  payload: unknown;
  ctx: ToolContext;
  agent: Exclude<keyof typeof import("@/lib/ai/tools/registry").TOOL_ALLOW_LIST, "supervisor">;
  status: "pending" | "committed" | "cancelled";
  created_at: string;
  /** Auto-expire after 15 minutes. */
  expires_at: number;
}

const TTL_MS = 15 * 60 * 1000;
const MAX_ACTIONS = 200;

const globalStore = globalThis as unknown as { __pendingActions?: Map<string, PendingAction> };
const store: Map<string, PendingAction> = (globalStore.__pendingActions ??= new Map());

export function createPendingAction(input: Omit<PendingAction, "action_id" | "status" | "created_at" | "expires_at">): PendingAction {
  // Opportunistic cleanup of expired entries.
  const now = Date.now();
  for (const [id, a] of store) {
    if (a.expires_at < now || a.status !== "pending") store.delete(id);
  }
  if (store.size >= MAX_ACTIONS) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  const action: PendingAction = {
    ...input,
    action_id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: "pending",
    created_at: new Date().toISOString(),
    expires_at: now + TTL_MS,
  };
  store.set(action.action_id, action);
  return action;
}

export function getPendingAction(actionId: string): PendingAction | undefined {
  const a = store.get(actionId);
  if (!a) return undefined;
  if (a.expires_at < Date.now() || a.status !== "pending") return undefined;
  return a;
}

export function markCommitted(actionId: string): void {
  const a = store.get(actionId);
  if (a) a.status = "committed";
}

export function cancelAction(actionId: string): boolean {
  const a = store.get(actionId);
  if (!a || a.status !== "pending") return false;
  a.status = "cancelled";
  return true;
}

/** Guards /api/tools/confirm input. */
export const ConfirmActionSchema = z.object({
  action_id: z.string().min(1),
});
