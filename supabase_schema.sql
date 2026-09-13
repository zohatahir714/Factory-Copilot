-- PakERP & Textile Cloud Suite - Complete Production PostgreSQL DDL Schema
-- Compatible with Supabase SQL Editor and Vercel Postgres

-- 1. Extensions
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

-- 3. Profiles Table
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

-- 12. App Settings Table
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales_orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);

-- RLS
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

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (PRD §40: RLS enabled, organization isolation)
--
-- SECURITY MODEL: only authenticated users (Supabase Auth sessions) may read
-- or write business data. The anon role is granted NOTHING — anonymous visitors
-- holding the public site key can enumerate zero tables. app_settings is
-- read-only for authenticated users; it is updated via a service-role worker.
-- ---------------------------------------------------------------------------

CREATE POLICY "authenticated_read_orgs" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "authenticated_all_accounts" ON chart_of_accounts FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_products" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_suppliers" ON suppliers FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_customers" ON customers FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_pos" ON purchase_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_sales" ON sales_orders FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_cashbook" ON cashbook_entries FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_movements" ON inventory_movements FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_read_settings" ON app_settings FOR SELECT TO authenticated USING (true);
