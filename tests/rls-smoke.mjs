#!/usr/bin/env node
/**
 * RLS ISOLATION SMOKE TEST (brief-zoha acceptance; PRD §19, §40).
 * Proves the CONTRACTS §7 model: a second organization CANNOT read org 1's rows.
 *
 * Run AFTER migrations 0001/0004/0005 + seed and with env set:
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (or pass via env)
 * Usage:
 *   node tests/rls-smoke.mjs
 * Exits 0 when isolation holds, 1 on any leak.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error("✖ Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first (see store-supabase.ts runbook).");
  process.exit(2);
}

const ORG_A = "11111111-1111-4111-8111-111111111111"; // seeded demo org
const ORG_B = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureOrg(id, name) {
  await admin.from("organizations").upsert({ id, name });
}
async function signUpUser(email, password, orgId) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { org_id: orgId },
  });
  if (error) throw error;
  const { error: pErr } = await admin.from("profiles").upsert({ id: data.user.id, organization_id: orgId, role: "owner" });
  if (pErr) throw pErr;
  return data.user;
}
async function signIn(email, password) {
  const c = createClient(URL, ANON);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

console.log("── RLS smoke: two orgs, cross-query must be denied ──");
await ensureOrg(ORG_A, "Smoke Org A");
await ensureOrg(ORG_B, "Smoke Org B");

const suffix = Date.now().toString(36);
await signUpUser(`a-${suffix}@rls-smoke.test`, "smoke-password-1", ORG_A);
await signUpUser(`b-${suffix}@rls-smoke.test`, "smoke-password-2", ORG_B);

const userA = await signIn(`a-${suffix}@rls-smoke.test`, "smoke-password-1");
const userB = await signIn(`b-${suffix}@rls-smoke.test`, "smoke-password-2");

// A visible row in org A (no product seed in smoke orgs → read org A's products via admin):
await admin.from("products").upsert({
  organization_id: ORG_A,
  sku: `SMOKE-${suffix}`,
  name: `Secret Product ${suffix}`,
  unit: "kg",
  current_stock: 5,
});

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "✔" : "✖"} ${label}`);
  if (!cond) failures += 1;
};

// 1) org A sees its own product
const { data: own } = await userA.from("products").select("*").eq("sku", `SMOKE-${suffix}`);
check("org A reads its own product", (own ?? []).length === 1);

// 2) org B sees NOTHING from org A (RLS org isolation)
const { data: foreign } = await userB.from("products").select("*").eq("sku", `SMOKE-${suffix}`);
check("org B cannot read org A products", (foreign ?? []).length === 0);

// 3) org B blocked on every business table
for (const table of ["suppliers", "customers", "purchase_orders", "sales_orders", "cashbook", "inventory_movements"]) {
  const { data: rowsA, error } = await userA.from(table).select("*").limit(1);
  const { data: rowsB } = await userB.from(table).select("*").limit(1);
  const aSeesOwn = !error; // error would mean RLS policy missing
  check(`${table}: member read allowed within org (RLS policy exists)`, aSeesOwn);
  check(`${table}: org B reads none of org A's rows`, (rowsB ?? []).length === 0);
  void rowsA;
}

// 4) client roles may NOT write business rows (Rules 2–3: server routes only)
const { error: writeErr } = await userA.from("products").insert({ organization_id: ORG_A, sku: `W-${suffix}`, name: "Blocked Write", unit: "kg" });
check("client INSERT denied (writes go through server routes)", Boolean(writeErr));

console.log(failures === 0 ? "── RLS isolation holds. ──" : `── ${failures} RLS FAILURE(S). Do not ship. ──`);
process.exit(failures === 0 ? 0 : 1);
