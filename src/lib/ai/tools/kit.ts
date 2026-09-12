import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";

/**
 * TOOL KIT — shared types + helpers for all tool modules (PRD §13/§40).
 * The registry consumes these; the domain tool files (inventory/purchase)
 * provide the definitions so each lane owns its own tools.
 */

export type AgentDomain = "supervisor" | "inventory" | "purchase" | "accounting" | "compliance";
export type ExecutionMode = "preview" | "commit";

export interface ToolContext {
  organizationId: string;
  userId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  domain: Exclude<AgentDomain, "supervisor">;
  mutates: boolean;
  zodSchema: z.ZodTypeAny;
  parameters: Record<string, unknown>; // JSON Schema sent to Groq
  run: (args: unknown, ctx: ToolContext, mode: ExecutionMode) => Promise<ToolResponse>;
}

/** JSON Schema for Groq tool definitions (Zod v4 native converter). */
export function toParameters(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Wrap a service call with Zod validation and error mapping. */
export function fromService(name: string, schema: z.ZodTypeAny, service: (input: unknown) => Promise<ToolResponse>, args: unknown): Promise<ToolResponse> {
  try {
    schema.parse(args ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      const path = first.path.join(".") || "input";
      return Promise.resolve(fail(name, "VALIDATION_ERROR", `${path}: ${first.message}`));
    }
    throw err;
  }
  return service(args);
}

/** Wrap committed service data as a pending-confirmation preview payload. */
export function withPendingPreview(tool: string, summary: string, data: unknown): ToolResponse {
  return ok(tool, { pending_confirmation: true, summary, draft: data });
}
