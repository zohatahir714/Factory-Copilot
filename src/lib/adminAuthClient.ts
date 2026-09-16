/**
 * ADMIN AUTH CLIENT — browser calls to the `admin-auth` Edge Function.
 * User management (create/list/update/delete) goes through Supabase Auth's
 * Admin API; the function verifies the caller is a Super Admin server-side.
 */

import { getSupabaseClient } from '../supabaseClient';
import type { UserRole } from '../types';

export interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
  lastSignInAt: string | null;
}

async function callAdminFn<T>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');
  const { data: sess } = await client.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const baseUrl = (client as any).supabaseUrl as string;
  const res = await fetch(`${baseUrl}/functions/v1/admin-auth`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: (client as any).supabaseKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}

export const adminAuth = {
  listUsers: () => callAdminFn<{ users: ManagedUser[] }>({ action: 'list' }).then(r => r.users),
  createUser: (p: { email: string; password: string; fullName: string; role: UserRole }) =>
    callAdminFn<{ ok: boolean; userId: string }>({ action: 'create', ...p }),
  updateUser: (p: { userId: string; role?: string; fullName?: string; password?: string }) =>
    callAdminFn<{ ok: boolean }>({ action: 'update', ...p }),
  deleteUser: (userId: string) => callAdminFn<{ ok: boolean }>({ action: 'delete', userId })
};
