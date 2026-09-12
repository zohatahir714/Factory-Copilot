import type { ToolResponse } from "@/lib/responses";

/** Roles we persist/pipe to the model. `tool` rows carry tool results. */
export type ChatRole = "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  /** JSON string as returned by the model */
  arguments: string;
}

export interface ToolResultMessage {
  role: "tool";
  tool_call_id: string;
  tool_name: string;
  /** The standard envelope, stringified for the model */
  content: string;
  /** Parsed envelope for UI/trace use */
  response: ToolResponse;
}

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | ToolResultMessage;

/** Conversation context handed to the orchestrator per request. */
export interface ConversationContext {
  organizationId: string;
  organizationName: string;
  userId: string;
  userName: string;
  sessionId: string;
  today: string;
}

/**
 * Events streamed from POST /api/chat (SSE) — CONTRACTS §6.
 * The client renders cards from `pending_action` and tokens from `token`.
 */
export type ChatStreamEvent =
  | { type: "status"; step: "routing" | "tool_call" | "thinking"; label: string }
  | { type: "token"; text: string }
  | { type: "tool_result"; tool: string; response: ToolResponse }
  | {
      type: "pending_action";
      action_id: string;
      tool: string;
      summary: string;
      payload: unknown;
    }
  | { type: "done"; message_id: string }
  | { type: "error"; code: string; message: string };
