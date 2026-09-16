/**
 * CLOUD REPOSITORY — the single Supabase data layer for PakERP Cloud Suite.
 *
 * Every module's state hydrates from these tables on sign-in, and every
 * mutation writes through to Supabase. localStorage is never the system of
 * record for business data — it only mirrors state for instant paint before
 * the cloud round-trip completes.
 *
 * All tables are RLS-guarded: only authenticated users read/write business
 * data, and the anon role is granted nothing.
 */

import { getSupabaseClient } from '../supabaseClient';

/* ------------------------------------------------------------------ */
/* Row types — mirror the Postgres schema (src/supabaseClient.ts DDL)  */
/* ------------------------------------------------------------------ */

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  reorder_threshold: number;
  sku?: string | null;
  organization_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierRow {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  ntn_number: string | null;
  strn_number: string | null;
  is_filer: boolean;
  payment_terms: string | null;
  lead_time_days?: number | null;
  rating: number;
  total_spend: number;
  organization_id: string | null;
  created_at?: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  ntn_number?: string | null;
  strn_number?: string | null;
  cnic?: string | null;
  is_filer?: boolean;
  credit_limit: number;
  outstanding_balance: number;
  payment_terms?: string | null;
  organization_id: string | null;
  created_at?: string;
}

export interface PurchaseOrderRow {
  id: string;
  po_number: string;
  supplier_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  notes: string | null;
  supplier_name?: string | null;
  created_by?: string | null;
  items?: unknown;
  created_at: string;
  received_at: string | null;
  organization_id: string | null;
}

export interface SalesOrderRow {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  further_tax_amount: number;
  total_amount: number;
  tax_category: string;
  payment_status: string;
  buyer_ntn: string | null;
  buyer_cnic: string | null;
  is_filer: boolean;
  fbr_fiscal_code: string | null;
  fbr_status: string;
  customer_name?: string | null;
  created_by?: string | null;
  items?: unknown;
  created_at: string;
  organization_id: string | null;
}

export interface CashbookRow {
  id: string;
  voucher_number: string;
  voucher_type: string;
  type: string;
  payment_mode: string;
  bank_account_id: string | null;
  bank_account_name: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  amount: number;
  category: string;
  description: string | null;
  reference_number: string | null;
  reference_id?: string | null;
  reference_type?: string | null;
  entries: unknown;
  prepared_by: string | null;
  approved_by: string | null;
  created_by: string | null;
  created_at: string;
  organization_id: string | null;
}

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  sub_type: string | null;
  opening_balance: number;
  description: string | null;
  is_system: boolean;
  category?: string | null;
  organization_id: string | null;
  created_at?: string;
}

export interface MovementRow {
  id: string;
  product_id: string | null;
  product_name: string | null;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  organization_id: string | null;
}

export interface AppSettingsRow {
  id: string;
  company_name: string;
  tagline: string | null;
  ntn_number: string | null;
  strn_number: string | null;
  city: string | null;
  logo_base64: string | null;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

/** Normalizes a Postgres error into a readable message for toasts. */
const errMsg = (error: { message?: string } | null): string => error?.message || 'Database error';

/** Fails fast when the cloud client is unavailable. */
function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');
  return client;
}

/** Loads every row of a table, ordered oldest-first for stable rendering. */
async function loadAll<T>(table: string): Promise<T[]> {
  const client = requireClient();
  const { data, error } = await client.from(table).select('*').order('created_at', { ascending: true });
  if (error) throw new Error(errMsg(error));
  return (data || []) as T[];
}

/** Inserts a row, returning the stored record (server defaults included). */
async function insertRow(table: string, row: Record<string, unknown> | any): Promise<void> {
  const client = requireClient();
  const { error } = await client.from(table).insert(row);
  if (error) throw new Error(errMsg(error));
}

/** Updates a row by id, returning any server-assigned fields. */
async function updateRow(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const client = requireClient();
  const { error } = await client.from(table).update(patch).eq('id', id);
  if (error) throw new Error(errMsg(error));
}

/** Deletes a row by id. */
async function deleteRow(table: string, id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw new Error(errMsg(error));
}

/* ------------------------------------------------------------------ */
/* Read side — hydrate the whole app on sign-in                        */
/* ------------------------------------------------------------------ */

export interface CloudSnapshot {
  products: ProductRow[];
  suppliers: SupplierRow[];
  customers: CustomerRow[];
  purchaseOrders: PurchaseOrderRow[];
  salesOrders: SalesOrderRow[];
  cashbook: CashbookRow[];
  accounts: AccountRow[];
  movements: MovementRow[];
  branding: AppSettingsRow | null;
}

/** Loads the complete business dataset in one parallel pass. */
export async function loadCloudSnapshot(): Promise<CloudSnapshot> {
  const [products, suppliers, customers, purchaseOrders, salesOrders, cashbook, accounts, movements, branding] =
    await Promise.all([
      loadAll<ProductRow>('products'),
      loadAll<SupplierRow>('suppliers'),
      loadAll<CustomerRow>('customers'),
      loadAll<PurchaseOrderRow>('purchase_orders'),
      loadAll<SalesOrderRow>('sales_orders'),
      loadAll<CashbookRow>('cashbook_entries'),
      loadAll<AccountRow>('chart_of_accounts'),
      loadAll<MovementRow>('inventory_movements'),
      loadAppSettings()
    ]);
  return { products, suppliers, customers, purchaseOrders, salesOrders, cashbook, accounts, movements, branding };
}

/** Reads the single branding/settings row (id = 'default'). */
export async function loadAppSettings(): Promise<AppSettingsRow | null> {
  const client = requireClient();
  const { data, error } = await client.from('app_settings').select('*').eq('id', 'default').maybeSingle();
  if (error) throw new Error(errMsg(error));
  return (data as AppSettingsRow) || null;
}

/* ------------------------------------------------------------------ */
/* Write side — one function per business mutation                     */
/* ------------------------------------------------------------------ */

export const cloudRepo = {
  products: {
    insert: (r: ProductRow) => insertRow('products', r),
    update: (id: string, p: Partial<ProductRow>) => updateRow('products', id, p),
    remove: (id: string) => deleteRow('products', id)
  },
  suppliers: {
    insert: (r: SupplierRow) => insertRow('suppliers', r),
    update: (id: string, s: Partial<SupplierRow>) => updateRow('suppliers', id, s),
    remove: (id: string) => deleteRow('suppliers', id)
  },
  customers: {
    insert: (r: CustomerRow) => insertRow('customers', r),
    update: (id: string, c: Partial<CustomerRow>) => updateRow('customers', id, c),
    remove: (id: string) => deleteRow('customers', id)
  },
  purchaseOrders: {
    insert: (r: PurchaseOrderRow) => insertRow('purchase_orders', r),
    update: (id: string, p: Partial<PurchaseOrderRow>) => updateRow('purchase_orders', id, p),
    remove: (id: string) => deleteRow('purchase_orders', id)
  },
  salesOrders: {
    insert: (r: SalesOrderRow) => insertRow('sales_orders', r),
    update: (id: string, s: Partial<SalesOrderRow>) => updateRow('sales_orders', id, s),
    remove: (id: string) => deleteRow('sales_orders', id)
  },
  cashbook: {
    insert: (r: CashbookRow) => insertRow('cashbook_entries', r),
    update: (id: string, c: Partial<CashbookRow>) => updateRow('cashbook_entries', id, c),
    remove: (id: string) => deleteRow('cashbook_entries', id)
  },
  accounts: {
    insert: (r: AccountRow) => insertRow('chart_of_accounts', r),
    update: (id: string, a: Partial<AccountRow>) => updateRow('chart_of_accounts', id, a),
    remove: (id: string) => deleteRow('chart_of_accounts', id)
  },
  movements: {
    insert: (r: MovementRow) => insertRow('inventory_movements', r),
    update: (id: string, m: Partial<MovementRow>) => updateRow('inventory_movements', id, m),
    remove: (id: string) => deleteRow('inventory_movements', id)
  },
  appSettings: {
    /** Upserts the single branding row (id='default'); RLS is read-only here, */
    /* so this succeeds only for users granted the update policy (service path). */
    save: async (r: AppSettingsRow) => {
      const client = requireClient();
      const { error } = await client.from('app_settings').upsert(r);
      if (error) throw new Error(errMsg(error));
    }
  },

  /** Wipes all business rows (Settings → Reset Ledger). Order matters for FKs. */
  wipeBusinessData: async () => {
    const client = requireClient();
    const tables = [
      'inventory_movements',
      'cashbook_entries',
      'sales_orders',
      'purchase_orders',
      'chart_of_accounts',
      'products',
      'customers',
      'suppliers'
    ];
    for (const table of tables) {
      const { error } = await client.from(table).delete().neq('id', '');
      if (error) throw new Error(errMsg(error));
    }
  }
};
