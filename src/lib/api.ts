import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";

/**
 * Shared helpers for REST routes (PRD §18). Every route returns the §23
 * envelope; business mutations happen only through the service layer (Rule 3).
 */

export function jsonOk(data: unknown, status = 200): Response {
  return Response.json(ok("api", data), { status });
}

export function jsonFail(status: number, code: string, message: string, suggestions?: string[]): Response {
  return Response.json(fail("api", code as never, message, suggestions), { status });
}

export async function readJson(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false, res: jsonFail(400, "VALIDATION_ERROR", "Body must be valid JSON") };
  }
}

export function zodFail(name: string, err: z.ZodError): Response {
  const first = err.issues[0];
  const path = first.path.join(".") || "input";
  return Response.json(fail(name, "VALIDATION_ERROR", `${path}: ${first.message}`), { status: 400 });
}

export type { ToolResponse };
