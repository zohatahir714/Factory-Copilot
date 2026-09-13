/**
 * Supabase Cloud PostgreSQL Client & Authentication Engine
 * Production Ready for Vercel & Supabase Deployments
 */

import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';
import {
  AuthUser,
  UserRole,
  RolePermissions
} from './types';

// Helper to compute role permissions
export const getRolePermissions = (role: UserRole): RolePermissions => {
  switch (role) {
    case 'Super Admin':
      return {
        canManageUsers: true,
        canDeleteRecords: true,
        canEditSettings: true,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Admin':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Head Accountant':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: false,
        canManageProcurement: false,
        canManageSalesAndTax: true,
        canManageCashbook: true,
        canPrintDocuments: true
      };
    case 'Factory Supervisor':
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: true,
        canManageProcurement: true,
        canManageSalesAndTax: false,
        canManageCashbook: false,
        canPrintDocuments: true
      };
    case 'Tax Auditor':
    default:
      return {
        canManageUsers: false,
        canDeleteRecords: false,
        canEditSettings: false,
        canManageInventory: false,
        canManageProcurement: false,
        canManageSalesAndTax: false,
        canManageCashbook: false,
        canPrintDocuments: true
      };
  }
};

// Environment variable retrieval
export const getSupabaseConfig = () => {
  const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const envUrl = env.VITE_SUPABASE_URL || '';
  const envKey = env.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('copilot_supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('copilot_supabase_key') || '' : '';

  const supabaseUrl = (localUrl || envUrl || '').trim();
  const supabaseKey = (localKey || envKey || '').trim();

  return {
    supabaseUrl,
    supabaseKey,
    isConfigured: Boolean(supabaseUrl && supabaseKey)
  };
};

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  const { supabaseUrl, supabaseKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  if (cachedClient && lastUrl === supabaseUrl && lastKey === supabaseKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    lastUrl = supabaseUrl;
    lastKey = supabaseKey;
    return cachedClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
};

export interface DatabaseHealthStatus {
  status: 'connected' | 'disconnected' | 'local_only' | 'error';
  message: string;
  url?: string;
  tables?: {
    name: string;
    exists: boolean;
    rowCount?: number;
  }[];
}

/**
 * Test Supabase Database Connection & Ping Key Tables
 */
export const checkSupabaseHealth = async (): Promise<DatabaseHealthStatus> => {
  const { supabaseUrl, isConfigured } = getSupabaseConfig();
  if (!isConfigured) {
    return {
      status: 'local_only',
      message: 'Running in Local-First Mode. Supabase project credentials not configured.'
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      status: 'error',
      message: 'Failed to construct Supabase connection client.'
    };
  }

  try {
    const tableNames = [
      'profiles',
      'products',
      'suppliers',
      'customers',
      'purchase_orders',
      'sales_orders',
      'cashbook_entries',
      'chart_of_accounts'
    ];

    const tablesResults = await Promise.all(
      tableNames.map(async (tbl) => {
        try {
          const { count, error } = await client.from(tbl).select('*', { count: 'exact', head: true });
          if (error) {
            return { name: tbl, exists: false, rowCount: 0 };
          }
          return { name: tbl, exists: true, rowCount: count ?? 0 };
        } catch {
          return { name: tbl, exists: false, rowCount: 0 };
        }
      })
    );

    const anyAccessible = tablesResults.some(t => t.exists);

    if (anyAccessible) {
      return {
        status: 'connected',
        message: 'Connected to Supabase Cloud Database (PostgreSQL & Auth Active).',
        url: supabaseUrl,
        tables: tablesResults
      };
    } else {
      return {
        status: 'disconnected',
        message: 'Connected to Supabase endpoint, but SQL schema tables are not yet migrated.',
        url: supabaseUrl,
        tables: tablesResults
      };
    }
  } catch (err: any) {
    return {
      status: 'error',
      message: `Supabase Connection Error: ${err?.message || 'Network unreachable'}`
    };
  }
};

/* =========================================================================
   SUPABASE AUTHENTICATION ENGINE
   ========================================================================= */

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  companyName?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  message: string;
  error?: string;
  session?: Session | null;
  needsEmailVerification?: boolean;
}

/**
 * Sign in existing user via Supabase Auth
 */
export const supabaseSignIn = async (email: string, password: string): Promise<AuthResponse> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase client is not configured with project URL & Anon Key.'
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim()
    });

    if (error) {
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }

    if (!data.user) {
      return {
        success: false,
        message: 'No user record returned from Supabase Auth.'
      };
    }

    let role: UserRole = (data.user.user_metadata?.role as UserRole) || 'Super Admin';
    let fullName = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User';

    // Attempt to enrich with profiles table record
    try {
      const { data: profileRow } = await client
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileRow) {
        if (profileRow.role) role = profileRow.role as UserRole;
        if (profileRow.full_name) fullName = profileRow.full_name;
      }
    } catch {
      // Fallback gracefully
    }

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email || email,
      name: fullName,
      role,
      permissions: getRolePermissions(role)
    };

    return {
      success: true,
      user: authUser,
      session: data.session,
      message: `Welcome back, ${fullName}!`
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Authentication error. Please check your credentials.'
    };
  }
};

/**
 * Register a new user via Supabase Auth & provision Profile record
 */
export const supabaseSignUp = async (params: SignUpParams): Promise<AuthResponse> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase client is not configured with project URL & Anon Key.'
    };
  }

  try {
    const { data, error } = await client.auth.signUp({
      email: params.email.trim(),
      password: params.password.trim(),
      options: {
        data: {
          full_name: params.fullName.trim(),
          role: params.role,
          phone: params.phone?.trim() || '',
          company_name: params.companyName?.trim() || ''
        }
      }
    });

    if (error) {
      return {
        success: false,
        message: error.message,
        error: error.message
      };
    }

    if (!data.user) {
      return {
        success: false,
        message: 'User registration could not be completed.'
      };
    }

    // Try inserting into profiles table if table exists
    try {
      await client.from('profiles').upsert([
        {
          id: data.user.id,
          full_name: params.fullName.trim(),
          role: params.role,
          email: params.email.trim(),
          phone: params.phone?.trim() || ''
        }
      ]);
    } catch (pErr) {
      console.warn('Profile table insert notice:', pErr);
    }

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email || params.email,
      name: params.fullName.trim(),
      role: params.role,
      permissions: getRolePermissions(params.role)
    };

    const isConfirmed = Boolean(data.session);

    return {
      success: true,
      user: authUser,
      session: data.session,
      needsEmailVerification: !isConfirmed,
      message: isConfirmed
        ? 'Account successfully created and authenticated!'
        : 'Registration successful! If Supabase email confirmation is enabled, please verify your email before signing in.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to register account.'
    };
  }
};

/**
 * Send password reset email via Supabase Auth
 */
export const supabaseResetPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase client is not configured with project URL & Anon Key.'
    };
  }

  try {
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: `Password reset recovery link sent to ${email}. Please check your inbox.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Password reset request failed.'
    };
  }
};

/**
 * Sign out active Supabase user session
 */
export const supabaseSignOut = async (): Promise<void> => {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (e) {
      console.error('Supabase signout error:', e);
    }
  }
};

/**
 * Get active Supabase session
 */
export const supabaseGetSession = async (): Promise<Session | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
};

/**
 * Fetch all registered user profiles from Supabase database
 */
export const fetchSupabaseProfiles = async (): Promise<{ id: string; full_name: string; role: string; email: string; phone?: string; status?: string; created_at?: string }[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('Could not fetch profiles from Supabase:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Error fetching Supabase profiles:', err);
    return [];
  }
};

/**
 * Update user profile in Supabase
 */
export const updateSupabaseProfile = async (id: string, updates: { full_name?: string; role?: string; phone?: string; status?: string }): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('profiles').update(updates).eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

/**
 * Delete user profile from Supabase
 */
export const deleteSupabaseProfile = async (id: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('profiles').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
};

/**
 * Complete PostgreSQL DDL Script for Supabase Migration
 */
export const SUPABASE_SQL_SCHEMA = `-- PakERP & Textile Cloud Suite - Supabase PostgreSQL Schema
-- Run this SQL in your Supabase Project Dashboard -> SQL Editor

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ntn_number TEXT,
    city TEXT,
    sector TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Profiles / Users Table
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Chart of Accounts Table
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sub_type TEXT,
    opening_balance NUMERIC(15, 2) DEFAULT 0,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Products & Raw Materials Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    current_stock NUMERIC(15, 2) NOT NULL DEFAULT 0,
    reorder_threshold NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Suppliers / Vendors Table
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    city TEXT,
    phone TEXT,
    email TEXT,
    ntn_number TEXT,
    strn_number TEXT,
    is_filer BOOLEAN DEFAULT true,
    payment_terms TEXT,
    rating NUMERIC(3, 1) DEFAULT 5.0,
    total_spend NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Customers & Textile Mills Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    city TEXT,
    phone TEXT,
    email TEXT,
    ntn_number TEXT,
    strn_number TEXT,
    cnic TEXT,
    is_filer BOOLEAN DEFAULT true,
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    outstanding_balance NUMERIC(15, 2) DEFAULT 0,
    payment_terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Purchase Orders (Procurement) Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    po_number TEXT NOT NULL UNIQUE,
    organization_id TEXT,
    supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    quantity NUMERIC(15, 2) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    received_at TIMESTAMPTZ
);

-- 9. Sales Orders (FBR Invoices) Table
CREATE TABLE IF NOT EXISTS sales_orders (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    organization_id TEXT,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    quantity NUMERIC(15, 2) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    tax_amount NUMERIC(15, 2) NOT NULL,
    further_tax_amount NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL,
    tax_category TEXT DEFAULT 'Standard 18% GST',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    buyer_ntn TEXT,
    buyer_cnic TEXT,
    is_filer BOOLEAN DEFAULT true,
    fbr_fiscal_code TEXT,
    fbr_status TEXT DEFAULT 'pending_clearance',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Cashbook & Accounting Vouchers Table
CREATE TABLE IF NOT EXISTS cashbook_entries (
    id TEXT PRIMARY KEY,
    voucher_number TEXT NOT NULL,
    voucher_type TEXT NOT NULL,
    organization_id TEXT,
    type TEXT NOT NULL,
    payment_mode TEXT NOT NULL DEFAULT 'cash',
    bank_account_id TEXT,
    bank_account_name TEXT,
    cheque_number TEXT,
    cheque_date DATE,
    amount NUMERIC(15, 2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    reference_number TEXT,
    entries JSONB DEFAULT '[]'::jsonb,
    prepared_by TEXT,
    approved_by TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Inventory Movement Audit Trail Table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    product_name TEXT,
    type TEXT NOT NULL,
    quantity NUMERIC(15, 2) NOT NULL,
    previous_stock NUMERIC(15, 2) NOT NULL,
    new_stock NUMERIC(15, 2) NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Branding & App Configuration Table
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    company_name TEXT NOT NULL,
    tagline TEXT,
    ntn_number TEXT,
    strn_number TEXT,
    city TEXT,
    logo_base64 TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);

-- Enable Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow Public / Anon Key Access for Enterprise Single-Tenant Suite
CREATE POLICY "Allow public all on organizations" ON organizations FOR ALL USING (true);
CREATE POLICY "Allow public all on profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "Allow public all on chart_of_accounts" ON chart_of_accounts FOR ALL USING (true);
CREATE POLICY "Allow public all on products" ON products FOR ALL USING (true);
CREATE POLICY "Allow public all on suppliers" ON suppliers FOR ALL USING (true);
CREATE POLICY "Allow public all on customers" ON customers FOR ALL USING (true);
CREATE POLICY "Allow public all on purchase_orders" ON purchase_orders FOR ALL USING (true);
CREATE POLICY "Allow public all on sales_orders" ON sales_orders FOR ALL USING (true);
CREATE POLICY "Allow public all on cashbook_entries" ON cashbook_entries FOR ALL USING (true);
CREATE POLICY "Allow public all on inventory_movements" ON inventory_movements FOR ALL USING (true);
CREATE POLICY "Allow public all on app_settings" ON app_settings FOR ALL USING (true);
`;
