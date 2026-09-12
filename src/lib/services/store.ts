/**
 * BUSINESS DATA STORE — the single source of truth for the service layer.
 *
 * This module is now a FACTORY: services depend on the `BizStore` interface
 * (store-types.ts), with two interchangeable backends:
 *
 *   • store-memory.ts    — in-memory seeded store (PRD §38). Dev fallback when
 *                          Supabase env is absent; also the demo/test backend.
 *   • store-supabase.ts  — Postgres via Supabase (migrations 0001/0004/0005),
 *                          RLS-isolated, RPC-atomic. The production backend.
 *
 * REPLACEMENT CONTRACT (Zoha's lane): every service signature stays identical,
 * so REST APIs and AI tools do not change. Invariants enforced in BOTH backends
 * (PRD §12): stock truth lives in `movements` (current_stock is a cache written
 * only in the same operation as the movement); multi-step mutations are
 * all-or-nothing; tax rates come only from `taxDecisions`.
 */

import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createMemoryStore } from "./store-memory";
import { createSupabaseStore } from "./store-supabase";
import type { BizStore, Product, Supplier, Customer, PurchaseOrder, Sale, CashEntry, Movement } from "./store-types";

export type { Product, Supplier, Customer, PurchaseOrder, Sale, CashEntry, Movement, BizStore } from "./store-types";

let cached: BizStore | null = null;

/** The process-wide store. Memory until Supabase env exists, Supabase after. */
export function getStore(): BizStore {
  if (cached) return cached;
  cached = isSupabaseConfigured() ? createSupabaseStore() : createMemoryStore();
  return cached;
}

/** Test helper — force a backend / re-create the singleton. */
export function resetStore(): void {
  cached = null;
}
