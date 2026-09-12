import { ok } from "@/lib/responses";
import { createClient } from "@/lib/supabase/server";

/** POST /api/auth/logout — clears the session. */
export async function POST() {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  return Response.json(ok("logout", { signed_in: false }));
}
