import { NextRequest } from "next/server";
import { executeTool } from "@/lib/ai/tools/registry";
import {
  ConfirmActionSchema,
  cancelAction,
  getPendingAction,
  markCommitted,
} from "@/lib/ai/pending-actions";
import { fail, ok } from "@/lib/responses";

/**
 * POST /api/tools/confirm — executes a pending action in "commit" mode
 * (PRD §14: Confirm button). Same tool, same args, commit mode.
 * POST /api/tools/confirm with { action_id, action: "cancel" } discards it.
 *
 * Auth note: the pending action stores the org/user ctx captured at preview
 * time, so no privileged data crosses the client — the client only sends the
 * opaque action_id. TODO(M0): also verify the Supabase session matches
 * pending.ctx.userId before committing.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { action_id?: string; action?: "confirm" | "cancel" };
  try {
    body = await req.json();
  } catch {
    return Response.json(fail("confirm", "VALIDATION_ERROR", "Body must be JSON"), { status: 400 });
  }

  const parsed = ConfirmActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(fail("confirm", "VALIDATION_ERROR", "action_id is required"), { status: 400 });
  }

  const actionId = parsed.data.action_id;
  const verb = body.action ?? "confirm";

  if (verb === "cancel") {
    const cancelled = cancelAction(actionId);
    if (!cancelled) {
      return Response.json(fail("confirm", "VALIDATION_ERROR", "Pending action not found or already resolved"), { status: 404 });
    }
    return Response.json(ok("confirm", { action_id: actionId, status: "cancelled" }));
  }

  const pending = getPendingAction(actionId);
  if (!pending) {
    return Response.json(
      fail("confirm", "VALIDATION_ERROR", "Pending action not found, expired, or already resolved"),
      { status: 404 }
    );
  }

  const result = await executeTool(pending.tool, pending.args, pending.ctx, pending.agent, "commit");
  if (result.success) {
    markCommitted(actionId);
  }
  return Response.json(result, { status: result.success ? 200 : 400 });
}
