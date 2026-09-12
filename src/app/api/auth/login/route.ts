import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/responses";
import { createClient } from "@/lib/supabase/server";
import { zodFail, readJson } from "@/lib/api";

/** POST /api/auth/login — email/password sign-in (cookies set server-side). */
const LoginInput = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return Response.json(
      fail("login", "UNAUTHORIZED", "Supabase is not configured on this server — dev-fallback mode is active, no login required."),
      { status: 503 }
    );
  }
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  try {
    const { email, password } = LoginInput.parse(parsed.body);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return Response.json(fail("login", "UNAUTHORIZED", error.message), { status: 401 });
    }
    return Response.json(ok("login", { signed_in: true }));
  } catch (err) {
    return zodFail("login", err as import("zod").ZodError);
  }
}
