// deno-lint-ignore-file no-explicit-any
/**
 * admin-auth — privileged user provisioning for PakERP Cloud Suite.
 *
 * Signups are disabled on the project (correct: no self-registration), so
 * accounts are created here with the service-role key via the Admin API.
 *
 * Security model:
 *   - The caller MUST present a valid access JWT of an existing user whose
 *     profiles.role = 'Super Admin'. The function verifies the caller with
 *     supabase.auth.getUser() (never trusts request body claims) and checks
 *     the role server-side.
 *   - The first Super Admin is seeded by running this function with the
 *     bootstrap secret; afterwards only Super Admins can manage accounts.
 *   - The service key never leaves this function.
 *
 * Actions:
 *   bootstrap  { email, password, fullName }      → needs SETUP_TOKEN match
 *   create     { email, password, fullName, role }→ needs Super Admin JWT
 *   list       {}                                  → needs Super Admin JWT
 *   delete     { userId }                          → needs Super Admin JWT
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SETUP_TOKEN = Deno.env.get("SETUP_TOKEN") ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-setup-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();
    const action = body?.action as string;

    // ---- bootstrap: create the very first Super Admin (token-gated) ----
    if (action === "bootstrap") {
      if (!SETUP_TOKEN || req.headers.get("x-setup-token") !== SETUP_TOKEN) {
        return new Response(JSON.stringify({ error: "Invalid setup token" }), {
          status: 401, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const { email, password, fullName } = body;
      const { data, error } = await admin.auth.admin.createUser({
        email: String(email || "").trim().toLowerCase(),
        password: String(password || ""),
        email_confirm: true,
        user_metadata: { full_name: fullName || "Super Admin", role: "Super Admin" },
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });

      await admin.from("profiles").upsert({
        id: data.user!.id,
        email: data.user!.email,
        full_name: fullName || "Super Admin",
        role: "Super Admin",
      });

      return new Response(JSON.stringify({ ok: true, userId: data.user!.id }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ---- all other actions require a verified Super Admin caller ----
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const { data: callerData, error: callerErr } = await admin.auth.getUser(authHeader.slice(7));
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ error: "Invalid caller token" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const { data: prof } = await admin
      .from("profiles").select("role").eq("id", callerData.user.id).maybeSingle();
    if (prof?.role !== "Super Admin") {
      return new Response(JSON.stringify({ error: "Super Admin privileges required" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password, fullName, role } = body;
      const { data, error } = await admin.auth.admin.createUser({
        email: String(email || "").trim().toLowerCase(),
        password: String(password || ""),
        email_confirm: true,
        user_metadata: { full_name: fullName || email, role: role || "Admin" },
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
      await admin.from("profiles").upsert({
        id: data.user!.id,
        email: data.user!.email,
        full_name: fullName || email,
        role: role || "Admin",
      });
      return new Response(JSON.stringify({ ok: true, userId: data.user!.id }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers();
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
      const users = data.users.map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.user_metadata?.full_name || u.email,
        role: u.user_metadata?.role || "Admin",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
      }));
      return new Response(JSON.stringify({ users }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { userId, role, fullName, password } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const attrs: any = {};
      if (role || fullName) {
        attrs.user_metadata = {};
        if (role) attrs.user_metadata.role = role;
        if (fullName) attrs.user_metadata.full_name = fullName;
      }
      if (password) attrs.password = String(password);
      const { error } = await admin.auth.admin.updateUserById(userId, attrs);
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
      if (role || fullName) {
        const patch: any = {};
        if (role) patch.role = role;
        if (fullName) patch.full_name = fullName;
        await admin.from("profiles").update(patch).eq("id", userId);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      if (userId === callerData.user.id) {
        return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
      await admin.from("profiles").delete().eq("id", userId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
