import type { ToolResponse } from "@/lib/responses";

/** Client-side fetch helper: unwraps the §23 envelope, throws friendly errors. */

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const json = (await res.json()) as ToolResponse<T>;
  if (!res.ok || !json.success || json.data === null) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data;
}

export async function apiSend<T>(path: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ToolResponse<T>;
  if (!res.ok || !json.success || json.data === null) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
  return json.data;
}
