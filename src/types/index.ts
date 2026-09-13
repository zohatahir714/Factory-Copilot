/**
 * AI Business Copilot for Manufacturing SMEs
 * Core Data Models & Agent Interface Schemas
 * Compliant with Master Build Specification PRD v3.0
 */

export interface Organization {
  id: string;
  name: string;
  ntnNumber: string; // National Tax Number (Pakistan)
  city: string;
  sector: string; // e.g. "Textile & Garment Manufacturing"
  createdAt: string;
}

export interface Profile {
  id: string;
  organizationId: string;
  fullName: string;
  role: 'Managing Director' | 'Factory Supervisor' | 'Accountant' | 'Inventory Lead';
  email: string;
  phone: string;
  createdAt: string;
}

export interface Product {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  category: string;
  unit: 'kg' | 'meters' | 'liters' | 'bags' | 'cones' | 'rolls';
  costPrice: number; // PKR
  sellingPrice: number; // PKR
  reorderThreshold: number;
  currentStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  leadTimeDays: number;
  paymentTerms: string; // e.g. "Net 30"
  createdAt: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  creditLimit: number;
  outstandingReceivables: number;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number; // PKR
  taxAmount: number; // PKR
  totalAmount: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g. "PO-1001"
  organizationId: string;
  supplierId: string;
  supplierName: string;
  status: 'pending' | 'received' | 'partially_received' | 'cancelled';
  totalAmount: number; // PKR
  items: PurchaseOrderItem[];
  createdBy: string;
  createdAt: string;
  receivedAt?: string;
  notes?: string;
}

export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number; // PKR
  taxRate: number; // percentage (e.g. 18% GST)
  taxAmount: number; // PKR
  totalAmount: number;
}

export interface SalesOrder {
  id: string;
  invoiceNumber: string; // e.g. "INV-2024-0042"
  organizationId: string;
  customerId: string;
  customerName: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partially_paid';
  items: SalesOrderItem[];
  createdBy: string;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  organizationId: string;
  productId: string;
  productName: string;
  quantityDelta: number; // positive = added, negative = deducted
  balanceAfter: number;
  movementType: 'purchase_receipt' | 'sales_dispatch' | 'production_issue' | 'stock_adjustment' | 'return';
  referenceId?: string; // PO id or Invoice id
  referenceType?: 'purchase_order' | 'sales_order' | 'manual';
  createdBy: string;
  createdAt: string;
  notes?: string;
}

export type VoucherType = 'CRV' | 'CPV' | 'BRV' | 'BPV' | 'JV';

export interface VoucherLineItem {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  chequeNo?: string;
  chequeDate?: string;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type PaymentMode = 'cash' | 'bank' | 'journal';

export type AccountSubType =
  | 'Cash'
  | 'Bank'
  | 'Accounts Receivable'
  | 'Inventory'
  | 'Current Asset'
  | 'Fixed Asset'
  | 'Accounts Payable'
  | 'Current Liability'
  | 'Long Term Liability'
  | 'Equity'
  | 'Sales'
  | 'Cost of Sales'
  | 'Operating Expense'
  | 'Financial Expense'
  | 'Tax Expense';

export interface ChartOfAccount {
  id: string;
  organizationId: string;
  code: string; // e.g. "1001"
  name: string; // e.g. "Cash in Hand (Main Vault)"
  type: AccountType | string;
  category?: AccountCategory | string;
  subType?: AccountSubType | string;
  openingBalance: number; // PKR
  currentBalance?: number;
  description?: string;
  isSystem?: boolean;
  createdAt: string;
}

export interface CashbookEntry {
  id: string;
  voucherNumber?: string;
  voucherType?: VoucherType;
  organizationId: string;
  type: 'inflow' | 'outflow';
  paymentMode?: 'cash' | 'bank' | 'journal';
  bankAccountId?: string;
  bankAccountName?: string;
  chequeNumber?: string;
  chequeDate?: string;
  amount: number; // PKR
  category: 'customer_payment' | 'supplier_payment' | 'utilities' | 'wages' | 'raw_materials' | 'freight' | 'fbr_tax_payment' | 'misc' | string;
  description: string;
  referenceId?: string;
  referenceType?: string;
  createdBy: string;
  createdAt: string;
  entries?: VoucherLineItem[];
  preparedBy?: string;
  approvedBy?: string;
}

export interface TaxDecision {
  id: string;
  organizationId: string;
  productId?: string;
  productCategory: string;
  taxRate: number; // 18% standard GST or 0% / 1% SRO exempt
  taxType: 'Sales Tax (GST)' | 'Income Tax Withholding' | 'Further Tax' | 'Special Procedure';
  sourceDocument: string; // e.g. "Sales Tax Act 1990 - Section 3(1)"
  sourceReference: string; // e.g. "FBR S.R.O. 345(I)/2024 - Schedule III"
  effectiveDate: string;
  confidence: number; // 0.0 to 1.0
  notes: string;
  createdAt: string;
}

// Multi-Agent System Types
export type AgentDomain = 'supervisor' | 'inventory' | 'purchase' | 'accounting' | 'compliance';

export interface AgentHandoffContract {
  intent: string;
  domain: AgentDomain;
  entities: Record<string, any>;
  userId: string;
  organizationId: string;
  requiresConfirmation: boolean;
  rawPrompt: string;
}

export interface ConfirmationPayload {
  id: string;
  actionType: 'create_purchase_order' | 'record_sale' | 'record_expense' | 'receive_goods' | 'stock_adjustment' | 'create_supplier' | 'create_customer';
  title: string;
  description: string;
  details: Record<string, any>;
  totalAmountPKR?: number;
  executeParams: Record<string, any>;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface ToolExecutionRecord {
  toolName: string;
  domain: AgentDomain;
  status: 'success' | 'warning' | 'error';
  inputs: Record<string, any>;
  output: any;
  timestamp: string;
  executionMs: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  inputMethod?: 'text' | 'voice';
  audioTranscription?: string;
  routedAgent?: AgentDomain;
  toolExecution?: ToolExecutionRecord;
  confirmationRequired?: ConfirmationPayload;
  structuredData?: {
    type: 'inventory' | 'purchase_order' | 'invoice' | 'business_summary' | 'compliance_rule' | 'expense' | 'generic';
    data: any;
  };
}

export interface ComplianceRAGSource {
  id: string;
  title: string;
  authority: 'FBR' | 'PRA' | 'SRB' | 'Customs' | 'Ministry of Commerce';
  documentName: string;
  section: string;
  effectiveYear: string;
  summary: string;
  fullExcerpt: string;
  applicableCategories: string[];
  defaultGSTRate: number;
  withholdingRate: number;
  filingDeadlineDays: number;
}

export type UserRole =
  | 'Super Admin'
  | 'Admin'
  | 'Head Accountant'
  | 'Factory Supervisor'
  | 'Tax Auditor';

export interface RolePermissions {
  canManageUsers: boolean;
  canDeleteRecords: boolean;
  canEditSettings: boolean;
  canManageInventory: boolean;
  canManageProcurement: boolean;
  canManageSalesAndTax: boolean;
  canManageCashbook: boolean;
  canPrintDocuments: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  permissions: RolePermissions;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  password?: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface BrandingSettings {
  companyName: string;
  tagline: string;
  ntnNumber: string;
  strnNumber: string;
  city: string;
  logoBase64: string;
}

export interface AISettings {
  groqApiKey: string;
  selectedModel: string;
  whisperModel: string;
  systemLanguage: 'en' | 'ur' | 'both';
}

export type ViewableItemType = 'product' | 'po' | 'sale' | 'cashbook' | 'compliance' | 'supplier' | 'customer' | 'account';
export type EditableItemType = 'product' | 'po' | 'sale' | 'cashbook' | 'supplier' | 'customer' | 'account';
export type PrintDocumentType =
  | 'invoice'
  | 'purchase_order'
  | 'cash_voucher'
  | 'inventory_report'
  | 'general_ledger'
  | 'cashbook_report'
  | 'financial_statement'
  | 'sales_purchase_report';

export interface PrintDocumentPayload {
  type: PrintDocumentType;
  title: string;
  data: any;
}

