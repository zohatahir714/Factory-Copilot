/**
 * CLOUD SYNC — maps app entities (camelCase) to Supabase rows (snake_case)
 * and provides the hydrate/push layer AppContext uses so Supabase is the
 * system of record. Fire-and-forget: a cloud failure surfaces as a console
 * error (and optional toast) but never blocks the UI update.
 */

import { cloudRepo, loadAppSettings } from './cloudRepo';
import type {
  Product, Supplier, Customer, PurchaseOrder, SalesOrder,
  InventoryMovement, ChartOfAccount, CashbookEntry, BrandingSettings
} from '../types';
import type {
  ProductRow, SupplierRow, CustomerRow, PurchaseOrderRow, SalesOrderRow,
  CashbookRow, AccountRow, MovementRow, AppSettingsRow
} from './cloudRepo';

/* ------------------------------------------------------------------ */
/* Mappers: app entity → SQL row                                       */
/* ------------------------------------------------------------------ */

export const toProductRow = (p: Product): ProductRow => ({
  id: p.id,
  name: p.name,
  category: p.category,
  unit: p.unit,
  cost_price: p.costPrice,
  selling_price: p.sellingPrice,
  current_stock: p.currentStock,
  reorder_threshold: p.reorderThreshold,
  sku: p.sku,
  organization_id: p.organizationId || null
});

export const toSupplierRow = (s: Supplier): SupplierRow => ({
  id: s.id,
  name: s.name,
  city: s.city,
  phone: s.phone,
  email: s.email,
  ntn_number: null,
  strn_number: null,
  is_filer: true,
  payment_terms: s.paymentTerms,
  lead_time_days: (s as any).leadTimeDays ?? 7,
  rating: 5,
  total_spend: 0,
  organization_id: s.organizationId || null
});

export const toCustomerRow = (c: Customer): CustomerRow => ({
  id: c.id,
  name: c.name,
  city: c.city,
  phone: c.phone,
  email: c.email,
  is_filer: true,
  credit_limit: c.creditLimit,
  outstanding_balance: c.outstandingReceivables,
  organization_id: c.organizationId || null
});

export const toPurchaseOrderRow = (po: PurchaseOrder): PurchaseOrderRow => ({
  id: po.id,
  po_number: po.poNumber,
  supplier_id: po.supplierId || null,
  product_id: po.items?.[0]?.productId || null,
  quantity: po.items?.reduce((s, i) => s + i.quantity, 0) ?? 0,
  unit_price: po.items?.[0]?.unitPrice ?? 0,
  total_amount: po.totalAmount,
  status: po.status,
  notes: po.notes || null,
  supplier_name: po.supplierName,
  created_by: po.createdBy,
  items: po.items as unknown,
  created_at: po.createdAt,
  received_at: po.receivedAt || null,
  organization_id: po.organizationId || null
});

export const toSalesOrderRow = (so: SalesOrder): SalesOrderRow => ({
  id: so.id,
  invoice_number: so.invoiceNumber,
  customer_id: so.customerId || null,
  product_id: so.items?.[0]?.productId || null,
  quantity: so.items?.reduce((s, i) => s + i.quantity, 0) ?? 0,
  unit_price: so.items?.[0]?.unitPrice ?? 0,
  subtotal: so.subtotal,
  tax_rate: so.items?.[0]?.taxRate ?? 18,
  tax_amount: so.taxAmount,
  further_tax_amount: 0,
  total_amount: so.totalAmount,
  tax_category: 'Standard 18% GST',
  payment_status: so.paymentStatus,
  buyer_ntn: null,
  buyer_cnic: null,
  is_filer: true,
  fbr_fiscal_code: null,
  fbr_status: 'pending_clearance',
  customer_name: so.customerName,
  created_by: so.createdBy,
  items: so.items as unknown,
  created_at: so.createdAt,
  organization_id: so.organizationId || null
});

export const toCashbookRow = (e: CashbookEntry): CashbookRow => ({
  id: e.id,
  voucher_number: e.voucherNumber || e.id,
  voucher_type: e.voucherType || 'JV',
  type: e.type,
  payment_mode: e.paymentMode || 'cash',
  bank_account_id: e.bankAccountId || null,
  bank_account_name: e.bankAccountName || null,
  cheque_number: e.chequeNumber || null,
  cheque_date: e.chequeDate || null,
  amount: e.amount,
  category: e.category,
  description: e.description,
  reference_number: e.referenceId || null,
  entries: (e.entries || []) as unknown,
  prepared_by: e.preparedBy || null,
  approved_by: e.approvedBy || null,
  created_by: e.createdBy,
  reference_id: e.referenceId || null,
  reference_type: e.referenceType || null,
  created_at: e.createdAt,
  organization_id: e.organizationId || null
});

export const toAccountRow = (a: ChartOfAccount): AccountRow => ({
  id: a.id,
  code: a.code,
  name: a.name,
  type: a.type,
  sub_type: a.subType || null,
  opening_balance: a.openingBalance,
  description: a.description || null,
  is_system: !!a.isSystem,
  category: (a as any).category || null,
  organization_id: a.organizationId || null
});

export const toMovementRow = (m: InventoryMovement): MovementRow => ({
  id: m.id,
  product_id: m.productId || null,
  product_name: m.productName || null,
  type: m.movementType,
  quantity: m.quantityDelta,
  previous_stock: m.balanceAfter - m.quantityDelta,
  new_stock: m.balanceAfter,
  reference_type: m.referenceType || null,
  reference_id: m.referenceId || null,
  notes: m.notes || null,
  created_by: m.createdBy,
  created_at: m.createdAt,
  organization_id: m.organizationId || null
});

/* ------------------------------------------------------------------ */
/* Mappers: SQL row → app entity                                       */
/* ------------------------------------------------------------------ */

export const fromProductRow = (r: ProductRow): Product => ({
  id: r.id,
  organizationId: r.organization_id || '',
  sku: (r as any).sku || '',
  name: r.name,
  category: r.category,
  unit: r.unit as Product['unit'],
  costPrice: Number(r.cost_price),
  sellingPrice: Number(r.selling_price),
  reorderThreshold: Number(r.reorder_threshold),
  currentStock: Number(r.current_stock),
  createdAt: (r as any).created_at || new Date().toISOString(),
  updatedAt: (r as any).updated_at || new Date().toISOString()
});

export const fromSupplierRow = (r: SupplierRow): Supplier => ({
  id: r.id,
  organizationId: r.organization_id || '',
  name: r.name,
  city: r.city || '',
  phone: r.phone || '',
  email: r.email || '',
  leadTimeDays: (r as any).lead_time_days ?? 7,
  paymentTerms: r.payment_terms || '',
  createdAt: (r as any).created_at || new Date().toISOString()
});

export const fromCustomerRow = (r: CustomerRow): Customer => ({
  id: r.id,
  organizationId: r.organization_id || '',
  name: r.name,
  city: r.city || '',
  phone: r.phone || '',
  email: r.email || '',
  creditLimit: Number(r.credit_limit),
  outstandingReceivables: Number(r.outstanding_balance),
  createdAt: (r as any).created_at || new Date().toISOString()
});

export const fromPurchaseOrderRow = (r: PurchaseOrderRow): PurchaseOrder => ({
  id: r.id,
  poNumber: r.po_number,
  organizationId: r.organization_id || '',
  supplierId: r.supplier_id || '',
  supplierName: (r as any).supplier_name || '',
  status: r.status as PurchaseOrder['status'],
  totalAmount: Number(r.total_amount),
  items: ((r as any).items as PurchaseOrder['items']) || [],
  createdBy: (r as any).created_by || 'System',
  createdAt: r.created_at,
  receivedAt: r.received_at || undefined,
  notes: r.notes || undefined
});

export const fromSalesOrderRow = (r: SalesOrderRow): SalesOrder => ({
  id: r.id,
  invoiceNumber: r.invoice_number,
  organizationId: r.organization_id || '',
  customerId: r.customer_id || '',
  customerName: (r as any).customer_name || '',
  subtotal: Number(r.subtotal),
  taxAmount: Number(r.tax_amount),
  totalAmount: Number(r.total_amount),
  paymentStatus: r.payment_status as SalesOrder['paymentStatus'],
  items: ((r as any).items as SalesOrder['items']) || [],
  createdBy: (r as any).created_by || 'System',
  createdAt: r.created_at
});

export const fromCashbookRow = (r: CashbookRow): CashbookEntry => ({
  id: r.id,
  voucherNumber: r.voucher_number,
  voucherType: r.voucher_type as CashbookEntry['voucherType'],
  organizationId: r.organization_id || '',
  type: r.type as CashbookEntry['type'],
  paymentMode: r.payment_mode as CashbookEntry['paymentMode'],
  bankAccountId: r.bank_account_id || undefined,
  bankAccountName: r.bank_account_name || undefined,
  chequeNumber: r.cheque_number || undefined,
  chequeDate: r.cheque_date || undefined,
  amount: Number(r.amount),
  category: r.category,
  description: r.description || '',
  referenceId: (r as any).reference_id || r.reference_number || undefined,
  referenceType: (r as any).reference_type || undefined,
  createdBy: r.created_by || 'System',
  createdAt: r.created_at,
  entries: (r.entries as CashbookEntry['entries']) || [],
  preparedBy: r.prepared_by || undefined,
  approvedBy: r.approved_by || undefined
});

export const fromAccountRow = (r: AccountRow): ChartOfAccount => ({
  id: r.id,
  organizationId: r.organization_id || '',
  code: r.code,
  name: r.name,
  type: r.type,
  category: (r as any).category || undefined,
  subType: r.sub_type || undefined,
  openingBalance: Number(r.opening_balance),
  description: r.description || undefined,
  isSystem: r.is_system,
  createdAt: (r as any).created_at || new Date().toISOString()
});

export const fromMovementRow = (r: MovementRow): InventoryMovement => ({
  id: r.id,
  organizationId: r.organization_id || '',
  productId: r.product_id || '',
  productName: r.product_name || '',
  quantityDelta: Number(r.quantity),
  balanceAfter: Number(r.new_stock),
  movementType: r.type as InventoryMovement['movementType'],
  referenceId: r.reference_id || undefined,
  referenceType: (r.reference_type as InventoryMovement['referenceType']) || undefined,
  createdBy: r.created_by || 'System',
  createdAt: r.created_at,
  notes: r.notes || undefined
});

/* ------------------------------------------------------------------ */
/* Hydration: Supabase → app state (called once after sign-in)         */
/* ------------------------------------------------------------------ */

export interface HydratedState {
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  cashbook: CashbookEntry[];
  accounts: ChartOfAccount[];
  inventoryMovements: InventoryMovement[];
  branding: BrandingSettings | null;
}

export async function hydrateFromCloud(): Promise<HydratedState> {
  const { loadCloudSnapshot } = await import('./cloudRepo');
  const s = await loadCloudSnapshot();
  return {
    products: s.products.map(fromProductRow),
    suppliers: s.suppliers.map(fromSupplierRow),
    customers: s.customers.map(fromCustomerRow),
    purchaseOrders: s.purchaseOrders.map(fromPurchaseOrderRow),
    salesOrders: s.salesOrders.map(fromSalesOrderRow),
    cashbook: s.cashbook.map(fromCashbookRow),
    accounts: s.accounts.map(fromAccountRow),
    inventoryMovements: s.movements.map(fromMovementRow),
    branding: null // branding hydration handled separately via loadAppSettings
  };
}

/** Loads branding (app_settings) into the app's BrandingSettings shape. */
export async function hydrateBranding(): Promise<Partial<BrandingSettings> | null> {
  const r = await loadAppSettings();
  if (!r) return null;
  return {
    companyName: r.company_name,
    tagline: r.tagline || '',
    ntnNumber: r.ntn_number || '',
    strnNumber: r.strn_number || '',
    city: r.city || '',
    logoBase64: r.logo_base64 || ''
  } as Partial<BrandingSettings>;
}

/* ------------------------------------------------------------------ */
/* Push: one call per mutation, fire-and-forget                        */
/* ------------------------------------------------------------------ */

/** Logs a cloud failure without blocking the UI. */
const report = (what: string, err: unknown) =>
  console.error(`[cloudSync] ${what} failed:`, err);

export const push = {
  productCreate: (p: Product) => cloudRepo.products.insert(toProductRow(p)).catch(e => report('productCreate', e)),
  productUpdate: (p: Partial<Product> & { id: string }) =>
    cloudRepo.products.update(p.id, {
      ...(p.name !== undefined && { name: p.name }),
      ...(p.category !== undefined && { category: p.category }),
      ...(p.unit !== undefined && { unit: p.unit }),
      ...(p.costPrice !== undefined && { cost_price: p.costPrice }),
      ...(p.sellingPrice !== undefined && { selling_price: p.sellingPrice }),
      ...(p.currentStock !== undefined && { current_stock: p.currentStock }),
      ...(p.reorderThreshold !== undefined && { reorder_threshold: p.reorderThreshold })
    }).catch(e => report('productUpdate', e)),
  productDelete: (id: string) => cloudRepo.products.remove(id).catch(e => report('productDelete', e)),

  supplierCreate: (s: Supplier) => cloudRepo.suppliers.insert(toSupplierRow(s)).catch(e => report('supplierCreate', e)),
  supplierUpdate: (id: string, s: Partial<Supplier>) =>
    cloudRepo.suppliers.update(id, {
      ...(s.name !== undefined && { name: s.name }),
      ...(s.city !== undefined && { city: s.city }),
      ...(s.phone !== undefined && { phone: s.phone }),
      ...(s.email !== undefined && { email: s.email }),
      ...(s.paymentTerms !== undefined && { payment_terms: s.paymentTerms })
    }).catch(e => report('supplierUpdate', e)),
  supplierDelete: (id: string) => cloudRepo.suppliers.remove(id).catch(e => report('supplierDelete', e)),

  customerCreate: (c: Customer) => cloudRepo.customers.insert(toCustomerRow(c)).catch(e => report('customerCreate', e)),
  customerUpdate: (id: string, c: Partial<Customer>) =>
    cloudRepo.customers.update(id, {
      ...(c.name !== undefined && { name: c.name }),
      ...(c.city !== undefined && { city: c.city }),
      ...(c.phone !== undefined && { phone: c.phone }),
      ...(c.email !== undefined && { email: c.email }),
      ...(c.creditLimit !== undefined && { credit_limit: c.creditLimit }),
      ...(c.outstandingReceivables !== undefined && { outstanding_balance: c.outstandingReceivables })
    }).catch(e => report('customerUpdate', e)),
  customerDelete: (id: string) => cloudRepo.customers.remove(id).catch(e => report('customerDelete', e)),

  poCreate: (po: PurchaseOrder) => cloudRepo.purchaseOrders.insert(toPurchaseOrderRow(po)).catch(e => report('poCreate', e)),
  poUpdate: (id: string, po: Partial<PurchaseOrder>) =>
    cloudRepo.purchaseOrders.update(id, {
      ...(po.status !== undefined && { status: po.status }),
      ...(po.totalAmount !== undefined && { total_amount: po.totalAmount }),
      ...(po.receivedAt !== undefined && { received_at: po.receivedAt }),
      ...(po.notes !== undefined && { notes: po.notes })
    }).catch(e => report('poUpdate', e)),
  poDelete: (id: string) => cloudRepo.purchaseOrders.remove(id).catch(e => report('poDelete', e)),

  saleCreate: (so: SalesOrder) => cloudRepo.salesOrders.insert(toSalesOrderRow(so)).catch(e => report('saleCreate', e)),
  saleUpdate: (id: string, so: Partial<SalesOrder>) =>
    cloudRepo.salesOrders.update(id, {
      ...(so.paymentStatus !== undefined && { payment_status: so.paymentStatus }),
      ...(so.totalAmount !== undefined && { total_amount: so.totalAmount })
    }).catch(e => report('saleUpdate', e)),
  saleDelete: (id: string) => cloudRepo.salesOrders.remove(id).catch(e => report('saleDelete', e)),

  cashbookCreate: (e: CashbookEntry) => cloudRepo.cashbook.insert(toCashbookRow(e)).catch(e => report('cashbookCreate', e)),
  cashbookUpdate: (id: string, e: Partial<CashbookEntry>) =>
    cloudRepo.cashbook.update(id, {
      ...(e.amount !== undefined && { amount: e.amount }),
      ...(e.description !== undefined && { description: e.description }),
      ...(e.category !== undefined && { category: e.category })
    }).catch(e => report('cashbookUpdate', e)),
  cashbookDelete: (id: string) => cloudRepo.cashbook.remove(id).catch(e => report('cashbookDelete', e)),

  accountCreate: (a: ChartOfAccount) => cloudRepo.accounts.insert(toAccountRow(a)).catch(e => report('accountCreate', e)),
  accountUpdate: (id: string, a: Partial<ChartOfAccount>) =>
    cloudRepo.accounts.update(id, {
      ...(a.name !== undefined && { name: a.name }),
      ...(a.openingBalance !== undefined && { opening_balance: a.openingBalance }),
      ...(a.description !== undefined && { description: a.description })
    }).catch(e => report('accountUpdate', e)),
  accountDelete: (id: string) => cloudRepo.accounts.remove(id).catch(e => report('accountDelete', e)),

  movementCreate: (m: InventoryMovement) => cloudRepo.movements.insert(toMovementRow(m)).catch(e => report('movementCreate', e)),

  brandingSave: (b: Partial<BrandingSettings>) => {
    const row: AppSettingsRow = {
      id: 'default',
      company_name: b.companyName || 'PakERP',
      tagline: b.tagline || null,
      ntn_number: b.ntnNumber || null,
      strn_number: b.strnNumber || null,
      city: b.city || null,
      logo_base64: b.logoBase64 || null,
      updated_at: new Date().toISOString()
    };
    return cloudRepo.appSettings.save(row).catch(e => report('brandingSave', e));
  }
};

/** Full replace-set sync for the business-tools path (applyDatabaseUpdate). */
export function pushBulk(update: {
  products?: Product[];
  purchaseOrders?: PurchaseOrder[];
  salesOrders?: SalesOrder[];
  cashbook?: CashbookEntry[];
  inventoryMovements?: InventoryMovement[];
  customers?: Customer[];
}, prev: {
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  cashbook: CashbookEntry[];
  inventoryMovements: InventoryMovement[];
  customers: Customer[];
}) {
  // Products: diff by id, then by updatedAt for stock changes
  if (update.products) {
    const prevById = new Map(prev.products.map(p => [p.id, p]));
    for (const p of update.products) {
      const before = prevById.get(p.id);
      if (!before) push.productCreate(p);
      else if (before.currentStock !== p.currentStock
        || before.sellingPrice !== p.sellingPrice
        || before.costPrice !== p.costPrice
        || before.name !== p.name) push.productUpdate({ id: p.id, name: p.name, currentStock: p.currentStock, sellingPrice: p.sellingPrice, costPrice: p.costPrice });
    }
    for (const before of prev.products) {
      if (!update.products.some(p => p.id === before.id)) push.productDelete(before.id);
    }
  }
  if (update.purchaseOrders) {
    const prevIds = new Set(prev.purchaseOrders.map(x => x.id));
    for (const po of update.purchaseOrders) if (!prevIds.has(po.id)) push.poCreate(po);
    const newIds = new Set(update.purchaseOrders.map(x => x.id));
    for (const po of prev.purchaseOrders) {
      if (newIds.has(po.id)) {
        const now = update.purchaseOrders.find(x => x.id === po.id)!;
        if (now.status !== po.status || now.receivedAt !== po.receivedAt) push.poUpdate(po.id, { status: now.status, receivedAt: now.receivedAt });
      } else push.poDelete(po.id);
    }
  }
  if (update.salesOrders) {
    const prevIds = new Set(prev.salesOrders.map(x => x.id));
    for (const so of update.salesOrders) if (!prevIds.has(so.id)) push.saleCreate(so);
    const newIds = new Set(update.salesOrders.map(x => x.id));
    for (const so of prev.salesOrders) {
      if (newIds.has(so.id)) {
        const now = update.salesOrders.find(x => x.id === so.id)!;
        if (now.paymentStatus !== so.paymentStatus) push.saleUpdate(so.id, { paymentStatus: now.paymentStatus });
      } else push.saleDelete(so.id);
    }
  }
  if (update.cashbook) {
    const prevIds = new Set(prev.cashbook.map(x => x.id));
    for (const e of update.cashbook) if (!prevIds.has(e.id)) push.cashbookCreate(e);
    const newIds = new Set(update.cashbook.map(x => x.id));
    for (const e of prev.cashbook) if (!newIds.has(e.id)) push.cashbookDelete(e.id);
  }
  if (update.inventoryMovements) {
    const prevIds = new Set(prev.inventoryMovements.map(x => x.id));
    for (const m of update.inventoryMovements) if (!prevIds.has(m.id)) push.movementCreate(m);
  }
  if (update.customers) {
    const prevIds = new Set(prev.customers.map(x => x.id));
    for (const c of update.customers) if (!prevIds.has(c.id)) push.customerCreate(c);
    const newIds = new Set(update.customers.map(x => x.id));
    for (const c of prev.customers) {
      if (newIds.has(c.id)) {
        const now = update.customers.find(x => x.id === c.id)!;
        if (now.outstandingReceivables !== c.outstandingReceivables) push.customerUpdate(c.id, { outstandingReceivables: now.outstandingReceivables });
      } else push.customerDelete(c.id);
    }
  }
}
