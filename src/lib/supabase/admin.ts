import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role admin client — SERVER ONLY, bypasses RLS (CONTRACTS §7, PRD Rule 3).
 * Used exclusively inside route handlers/services after session verification.
 * Never import from client components; never expose SUPABASE_SERVICE_ROLE_KEY.
 */
let cached: SupabaseClient | null = null;

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createAdminClient(): SupabaseClient | null {
  if (!isAdminConfigured()) return null;
  if (cached) return cached;
  cached = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return cached;
}
