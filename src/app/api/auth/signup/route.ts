import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/responses";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { zodFail, readJson } from "@/lib/api";

/**
 * POST /api/auth/signup — creates organization → profile → writes org_id into
 * the JWT app_metadata (CONTRACTS §7). Server-side only (admin client).
 */
const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  organization_name: z.string().min(1),
  full_name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return Response.json(
      fail("signup", "UNAUTHORIZED", "Supabase is not configured on this server — signup unavailable in dev-fallback mode."),
      { status: 503 }
    );
  }
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.res;
  try {
    const input = SignupInput.parse(parsed.body);
    const admin = createAdminClient()!;

    const { data: auth, error: authErr } = await admin.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (authErr || !auth.user) {
      return Response.json(fail("signup", "DB_ERROR", authErr?.message ?? "Signup failed"), { status: 400 });
    }

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: input.organization_name })
      .select("id")
      .single();
    if (orgErr || !org) {
      return Response.json(fail("signup", "DB_ERROR", orgErr?.message ?? "Organization creation failed"), { status: 500 });
    }

    const { error: profErr } = await admin.from("profiles").insert({
      id: auth.user.id,
      organization_id: org.id,
      role: "owner",
    });
    if (profErr) {
      return Response.json(fail("signup", "DB_ERROR", profErr.message), { status: 500 });
    }

    // org_id travels inside the JWT (app_metadata) — RLS reads it via current_org_id().
    const { error: metaErr } = await admin.auth.admin.updateUserById(auth.user.id, {
      app_metadata: { org_id: org.id },
    });
    if (metaErr) {
      return Response.json(fail("signup", "DB_ERROR", metaErr.message), { status: 500 });
    }

    return Response.json(ok("signup", { user_id: auth.user.id, organization_id: org.id }), { status: 201 });
  } catch (err) {
    return zodFail("signup", err as import("zod").ZodError);
  }
}
