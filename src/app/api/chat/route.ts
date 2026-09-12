import { NextRequest } from "next/server";
import { runSupervisorTurn } from "@/lib/ai/orchestrator";
import type { ChatStreamEvent, ConversationContext } from "@/lib/ai/types";
import { makeRequestId } from "@/lib/responses";

/**
 * POST /api/chat — streaming chat endpoint (SSE), CONTRACTS §6.
 * Body: { message: string, session_id?: string }
 *
 * Events: status · token · tool_result · pending_action · done · error
 *
 * Auth note (H4–10 milestone): while Supabase auth (Zoha, M0) is not wired
 * yet, a DEMO org/user context is used. Before merge to `develop` post-M0,
 * replace buildContext() with the session-derived context — the orchestrator
 * already takes org/user ids, so nothing else changes.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function buildContext(req: NextRequest): ConversationContext {
  // TODO(M0): derive from Supabase session (auth.jwt -> org_id). Demo until then.
  const demoOrg = req.headers.get("x-demo-org") ?? "Demo Textiles";
  const demoUser = req.headers.get("x-demo-user") ?? "Owner";
  return {
    organizationId: "org_demo",
    organizationName: demoOrg,
    userId: "user_demo",
    userName: demoUser,
    sessionId: req.headers.get("x-demo-session") ?? `session_${makeRequestId()}`,
    today: new Date().toISOString().slice(0, 10),
  };
}

export async function POST(req: NextRequest) {
  let body: { message?: string; session_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "Body must be JSON: { message }");
  }

  const message = body.message?.trim();
  if (!message) {
    return jsonError(400, "VALIDATION_ERROR", "message is required");
  }

  const ctx = buildContext(req);
  if (body.session_id) ctx.sessionId = body.session_id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await runSupervisorTurn({ ctx, userMessage: message, emit: send });
      } catch (err) {
        // Orchestrator handles its own errors; this is a last resort.
        send({
          type: "error",
          code: "AI_PROVIDER_ERROR",
          message: "⚠️ I couldn't complete that. Please try again.",
        });
        console.error("[chat] unhandled:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ success: false, data: null, error: { code, message } }, { status });
}
