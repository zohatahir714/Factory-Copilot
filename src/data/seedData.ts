/**
 * Industrial Manufacturing SME Clean Operating Data
 * Zero demo transactional seed data - Ready for production operations
 */

import {
  Organization,
  Profile,
  Product,
  Supplier,
  Customer,
  PurchaseOrder,
  SalesOrder,
  InventoryMovement,
  CashbookEntry,
  ComplianceRAGSource,
  TaxDecision
} from '../types';

export const SEED_ORGANIZATION: Organization = {
  id: 'org_sme_01',
  name: 'Industrial Manufacturing Solutions',
  ntnNumber: '1234567-8',
  city: 'Lahore, Pakistan',
  sector: 'Industrial Manufacturing Operations',
  createdAt: new Date().toISOString()
};

export const SEED_PROFILE: Profile = {
  id: 'usr_adil_superadmin',
  organizationId: 'org_sme_01',
  fullName: 'Adil',
  role: 'Managing Director',
  email: 'adil@gmail.com',
  phone: '+92 300 1234567',
  createdAt: new Date().toISOString()
};

// All transactional demo records removed per user specification
export const SEED_PRODUCTS: Product[] = [];
export const SEED_SUPPLIERS: Supplier[] = [];
export const SEED_CUSTOMERS: Customer[] = [];
export const SEED_PURCHASE_ORDERS: PurchaseOrder[] = [];
export const SEED_SALES_ORDERS: SalesOrder[] = [];
export const SEED_INVENTORY_MOVEMENTS: InventoryMovement[] = [];
export const SEED_CASHBOOK: CashbookEntry[] = [];

// Official Statutory FBR Regulatory Documents (Ground truth legal knowledge base for RAG)
export const SEED_COMPLIANCE_SOURCES: ComplianceRAGSource[] = [
  {
    id: 'rag_fbr_sta_sec3',
    title: 'Standard Sales Tax Liability on Manufactured Supplies',
    authority: 'FBR',
    documentName: 'Sales Tax Act 1990 (As amended by Finance Act 2024)',
    section: 'Section 3, Subsection (1) & (2)',
    effectiveYear: '2024-2025',
    summary: 'Imposes 18% standard General Sales Tax (GST) on value of all taxable supplies made by a registered manufacturer in Pakistan.',
    fullExcerpt: 'Subject to the provisions of this Act, there shall be charged, levied and paid a tax known as sales tax at the rate of eighteen per cent (18%) of the value of goods manufactured or produced in Pakistan, payable at the time of delivery or invoicing.',
    applicableCategories: ['Yarn & Fibers', 'Dyes & Chemicals', 'Process Chemicals', 'General Manufacturing'],
    defaultGSTRate: 18,
    withholdingRate: 4.5,
    filingDeadlineDays: 15
  },
  {
    id: 'rag_fbr_sro_345',
    title: 'Textile Zero-Rating & Local Supply Tax Regimes (Export Processing)',
    authority: 'FBR',
    documentName: 'FBR S.R.O. 345(I)/2024 - Sector Guidelines',
    section: 'Schedule V & SRO Provisions',
    effectiveYear: '2024-2025',
    summary: 'Direct local sales to domestic buyers are strictly subject to 18% GST; only direct exports or sales to certified Export Oriented Units (EOU) under Annexure-H qualify for 0% zero-rating.',
    fullExcerpt: 'Domestic sale of raw materials, finished commodities, and industrial goods manufactured within registered mills shall bear standard GST rate of 18%. Any concessional input tax adjustment requires electronic STGO verification on Iris portal.',
    applicableCategories: ['Yarn & Fibers', 'Raw Materials'],
    defaultGSTRate: 18,
    withholdingRate: 4.5,
    filingDeadlineDays: 15
  },
  {
    id: 'rag_fbr_withholding_153',
    title: 'Income Tax Withholding on Sale of Goods',
    authority: 'FBR',
    documentName: 'Income Tax Ordinance 2001 - Division III Part III',
    section: 'Section 153(1)(a)',
    effectiveYear: '2024-2025',
    summary: 'Prescribed withholding tax deduction by corporate buyers upon payment for supplies: 4.5% for Active Taxpayer List (ATL) filers, 9.0% for non-filers.',
    fullExcerpt: 'Every prescribed person making a payment in full or part including a payment by way of advance to a resident person on the sale of goods shall deduct tax from the gross amount payable at the rate of 4.5% for companies on ATL, and double rate for non-ATL status.',
    applicableCategories: ['All Supplies', 'Raw Materials', 'Finished Goods'],
    defaultGSTRate: 18,
    withholdingRate: 4.5,
    filingDeadlineDays: 15
  },
  {
    id: 'rag_fbr_calendar',
    title: 'Sales Tax E-Filing Calendar & Payment Deadlines',
    authority: 'FBR',
    documentName: 'FBR Rule 14 - Filing of Monthly Electronic Returns',
    section: 'Sales Tax Rules 2006, Chapter II',
    effectiveYear: '2024-2025',
    summary: 'Annexure-C (Domestic Sales Invoices) must be submitted by the 10th of every month; payment of tax due by the 15th; complete monthly return by the 18th.',
    fullExcerpt: 'Every registered manufacturer shall furnish the electronic summary of sales invoices (Annexure-C) by the 10th day of the subsequent month. Sales tax liability shall be deposited in National Bank of Pakistan by the 15th day, and the return submitted by the 18th day.',
    applicableCategories: ['All Categories'],
    defaultGSTRate: 18,
    withholdingRate: 0,
    filingDeadlineDays: 15
  }
];

export const SEED_TAX_DECISIONS: TaxDecision[] = [];
