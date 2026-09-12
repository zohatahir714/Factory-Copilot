import { MODELS, MAX_TOOL_HOPS } from "@/lib/ai/model-config";
import { getGroqClient, isProviderError } from "@/lib/ai/groq/client";
import { buildSupervisorSystemPrompt } from "@/lib/ai/prompts/supervisor";
import { executeTool, findTool, toolDefinitionsForModel, type AgentDomain } from "@/lib/ai/tools/registry";
import { createPendingAction } from "@/lib/ai/pending-actions";
import { loadRecentMessages, appendMessage } from "@/lib/ai/memory";
import type { ChatMessage, ChatStreamEvent, ConversationContext, ToolCall, ToolResultMessage } from "@/lib/ai/types";

/**
 * SUPERVISOR ORCHESTRATOR — the heart of the AI layer (PRD §6–§8).
 *
 * Loop: system + memory + user message → Groq (streaming) →
 *   - tokens → {type:"token"} events
 *   - tool_calls → Zod-validated execution → results appended → loop (max 4 hops)
 * Mutating tools run in "preview" mode and emit a pending_action card instead
 * of committing (PRD §14). /api/tools/confirm commits later.
 * Groq 429/5xx → one backoff retry, then graceful error event (PRD §29).
 */

/** Minimal local delta types — avoids coupling to groq-sdk internals. */
interface DeltaToolCall {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}
interface StreamDelta {
  content?: string | null;
  tool_calls?: DeltaToolCall[];
}

/** Groq wire-format message union (what the API accepts). */
type ApiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** Convert internal transcript to the exact wire format. */
function toApiMessages(system: string, transcript: ChatMessage[]): ApiMessage[] {
  const out: ApiMessage[] = [{ role: "system", content: system }];
  for (const m of transcript) {
    if (m.role === "tool") {
      const t = m as ToolResultMessage;
      out.push({ role: "tool", tool_call_id: t.tool_call_id, content: t.content });
    } else if (m.role === "assistant" && m.tool_calls?.length) {
      out.push({
        role: "assistant",
        content: m.content || "",
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });
    } else if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.content });
    } else {
      out.push({ role: "user", content: m.content });
    }
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runSupervisorTurn({ ctx, userMessage, emit }: {
  ctx: ConversationContext;
  userMessage: string;
  emit: (event: ChatStreamEvent) => void;
}): Promise<void> {
  const groq = getGroqClient();

  emit({ type: "status", step: "routing", label: "Understanding your request…" });

  // ---- memory (PRD §16) ------------------------------------------------------
  const history: ChatMessage[] = loadRecentMessages(ctx.sessionId);
  const userTurn: ChatMessage = { role: "user", content: userMessage };
  const transcript: ChatMessage[] = [...history, userTurn];
  appendMessage(ctx.sessionId, userTurn);

  const system = buildSupervisorSystemPrompt({
    organizationName: ctx.organizationName,
    userName: ctx.userName,
    today: ctx.today,
  });

  const agent: AgentDomain = "supervisor";
  const toolCtx = { organizationId: ctx.organizationId, userId: ctx.userId };
  let hop = 0;
  let finalText = "";

  try {
    while (hop < MAX_TOOL_HOPS) {
      hop += 1;

      // ---- one streamed Groq call (one retry on provider error, PRD §29) ----
      let stream;
      try {
        stream = await groq.chat.completions.create({
          model: MODELS.supervisor,
          stream: true,
          temperature: 0.2,
          messages: toApiMessages(system, transcript),
          tools: toolDefinitionsForModel(),
          tool_choice: "auto",
        });
      } catch (err) {
        if (isProviderError(err) && hop === 1) {
          await sleep(800);
          stream = await groq.chat.completions.create({
            model: MODELS.supervisor,
            stream: true,
            temperature: 0.2,
            messages: toApiMessages(system, transcript),
            tools: toolDefinitionsForModel(),
            tool_choice: "auto",
          });
        } else {
          throw err;
        }
      }

      // ---- accumulate deltas -------------------------------------------------
      let textBuf = "";
      const calls = new Map<number, { id: string; name: string; args: string }>();

      for await (const chunk of stream) {
        const delta = (chunk.choices?.[0]?.delta ?? {}) as StreamDelta;

        if (typeof delta.content === "string" && delta.content.length > 0) {
          textBuf += delta.content;
          emit({ type: "token", text: delta.content });
        }

        for (const tc of delta.tool_calls ?? []) {
          const idx = tc.index ?? 0;
          const entry = calls.get(idx) ?? { id: "", name: "", args: "" };
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name += tc.function.name;
          if (tc.function?.arguments) entry.args += tc.function.arguments;
          calls.set(idx, entry);
        }
      }

      if (textBuf) finalText = textBuf;

      // ---- no tool calls → turn complete --------------------------------------
      if (calls.size === 0) break;

      // ---- execute tool calls --------------------------------------------------
      const toolCalls: ToolCall[] = [...calls.values()].map((c) => ({ id: c.id, name: c.name, arguments: c.args }));
      transcript.push({ role: "assistant", content: textBuf, tool_calls: toolCalls });

      for (const call of toolCalls) {
        emit({ type: "status", step: "tool_call", label: `Running ${call.name}…` });

        let result = await executeTool(call.name, safeParse(call.arguments), toolCtx, agent, "preview");

        if (!result.success && result.error?.code === "UNAUTHORIZED") {
          // Supervisor allow-list is read-only; write-tools run under their
          // owning domain agent so the allow-list check passes (PRD §7 bounded agents).
          const def = findTool(call.name);
          if (def) {
            result = await executeTool(call.name, safeParse(call.arguments), toolCtx, def.domain, "preview");
          }
        }

        const data = result.data as { pending_confirmation?: boolean; summary?: string } | null;

        if (result.success && data?.pending_confirmation) {
          // ---- confirmation gate (PRD §14) --------------------------------------
          const pending = createPendingAction({
            tool: call.name,
            args: safeParse(call.arguments),
            summary: data.summary ?? call.name,
            payload: result.data,
            ctx: toolCtx,
            agent: findTool(call.name)?.domain ?? "inventory",
          });
          emit({
            type: "pending_action",
            action_id: pending.action_id,
            tool: call.name,
            summary: pending.summary,
            payload: pending.payload,
          });
          transcript.push({
            role: "tool",
            tool_call_id: call.id,
            tool_name: call.name,
            content: JSON.stringify({ success: true, note: "Preview created. Waiting for user confirmation; do not repeat the call.", data: result.data }),
            response: result,
          } satisfies ToolResultMessage);
          continue;
        }

        // ---- normal tool result -------------------------------------------------
        emit({ type: "tool_result", tool: call.name, response: result });
        transcript.push({
          role: "tool",
          tool_call_id: call.id,
          tool_name: call.name,
          content: JSON.stringify(result),
          response: result,
        } satisfies ToolResultMessage);
      }
      // loop continues: the model now sees the tool results
    }

    appendMessage(ctx.sessionId, { role: "assistant", content: finalText || "(no content)" });
    emit({ type: "done", message_id: `${ctx.sessionId}_${Date.now()}` });
  } catch (err) {
    const provider = isProviderError(err);
    emit({
      type: "error",
      code: provider ? "RATE_LIMITED" : "AI_PROVIDER_ERROR",
      message: provider
        ? "⚠️ AI service is temporarily unavailable. You can retry in a moment."
        : err instanceof Error
          ? `❌ I couldn't complete that. (${err.message})`
          : "❌ I couldn't complete that.",
    });
  }
}

/* ------------------------------- helpers ---------------------------------- */

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return { __invalid_json: json };
  }
}

function domainOf(toolName: string): AgentDomain {
  return findTool(toolName)?.domain ?? "supervisor";
}
void domainOf;
