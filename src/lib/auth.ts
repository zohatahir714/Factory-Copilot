import { createClient } from "@/lib/supabase/server";

/**
 * AUTH / ORG MODEL (CONTRACTS §7)
 * organization_id is derived from the JWT app_metadata — never from a
 * client-supplied body. The signup route writes org_id into app_metadata via
 * the admin client.
 *
 * DEV FALLBACK: when Supabase env is absent (no credentials yet), every route
 * gets the demo org so the whole app keeps running on the in-memory store.
 * The store factory (services/store.ts) keys off the same DEV_ORG_ID.
 */

export const DEV_ORG_ID = "11111111-1111-4111-8111-111111111111"; // matches supabase/seed.sql
export const DEV_ORG_NAME = "Demo Textiles (dev fallback)";

export interface SessionContext {
  /** Supabase user id, or "dev-user" without Supabase. */
  userId: string;
  organizationId: string;
  authenticated: boolean;
}

export async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();
  if (!supabase) {
    return { userId: "dev-user", organizationId: DEV_ORG_ID, authenticated: false };
  }
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) {
    return { userId: "dev-user", organizationId: DEV_ORG_ID, authenticated: false };
  }
  const orgId = (user.app_metadata?.org_id as string | undefined) ?? null;
  if (!orgId) {
    return { userId: user.id, organizationId: DEV_ORG_ID, authenticated: false };
  }
  return { userId: user.id, organizationId: orgId, authenticated: true };
}
