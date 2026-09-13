import { ChartOfAccount, CashbookEntry } from '../types';

/**
 * Standard Pakistani Enterprise Chart of Accounts (COA)
 * Production Base Template - Zero Hardcoded Balances & Zero Demo Transactions
 */
export const INITIAL_CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  // 1. Assets (1xxx)
  {
    id: 'acc_1001',
    organizationId: 'org_sme_01',
    code: '1001',
    name: 'Cash in Hand (Factory Vault)',
    type: 'Asset',
    subType: 'Cash',
    openingBalance: 0,
    description: 'Physical currency held in main factory vault for operating disbursements',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_1002',
    organizationId: 'org_sme_01',
    code: '1002',
    name: 'Petty Cash (Admin Office)',
    type: 'Asset',
    subType: 'Cash',
    openingBalance: 0,
    description: 'Petty cash float for office refreshments and postal deliveries',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_1010',
    organizationId: 'org_sme_01',
    code: '1010',
    name: 'Meezan Bank Ltd (Islamic Current A/c)',
    type: 'Asset',
    subType: 'Bank',
    openingBalance: 0,
    description: 'Primary corporate business operating account',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_1011',
    organizationId: 'org_sme_01',
    code: '1011',
    name: 'Habib Bank Ltd - HBL (Collection A/c)',
    type: 'Asset',
    subType: 'Bank',
    openingBalance: 0,
    description: 'Client receivables deposit and trade financing account',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_1020',
    organizationId: 'org_sme_01',
    code: '1020',
    name: 'Accounts Receivable (Trade Debtors)',
    type: 'Asset',
    subType: 'Accounts Receivable',
    openingBalance: 0,
    description: 'Outstanding invoices receivable from client mills and apparel houses',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_1030',
    organizationId: 'org_sme_01',
    code: '1030',
    name: 'Raw Materials & Yarn Inventory',
    type: 'Asset',
    subType: 'Inventory',
    openingBalance: 0,
    description: 'Stock valuation of raw cotton, synthetic yarn cones, and chemical dyes',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_1040',
    organizationId: 'org_sme_01',
    code: '1040',
    name: 'Finished Goods Inventory',
    type: 'Asset',
    subType: 'Inventory',
    openingBalance: 0,
    description: 'Finished textile rolls and packaged fabric ready for dispatch',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_1050',
    organizationId: 'org_sme_01',
    code: '1050',
    name: 'Plant, Looms & Factory Machinery',
    type: 'Asset',
    subType: 'Fixed Asset',
    openingBalance: 0,
    description: 'Heavy weaving machinery, looms, spindles, and industrial air compressors',
    isSystem: false,
    createdAt: new Date().toISOString()
  },

  // 2. Liabilities (2xxx)
  {
    id: 'acc_2001',
    organizationId: 'org_sme_01',
    code: '2001',
    name: 'Accounts Payable (Trade Creditors)',
    type: 'Liability',
    subType: 'Accounts Payable',
    openingBalance: 0,
    description: 'Trade credit obligations to raw cotton and chemical suppliers',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_2010',
    organizationId: 'org_sme_01',
    code: '2010',
    name: 'FBR Sales Tax (18% GST) Payable',
    type: 'Liability',
    subType: 'Current Liability',
    openingBalance: 0,
    description: 'Net statutory sales tax payable to Federal Board of Revenue on Annexure-C',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_2020',
    organizationId: 'org_sme_01',
    code: '2020',
    name: 'Income Tax Withholding (WHT) Payable',
    type: 'Liability',
    subType: 'Current Liability',
    openingBalance: 0,
    description: 'WHT deducted under Section 153(1)(a) payable via e-payment CPR',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_2030',
    organizationId: 'org_sme_01',
    code: '2030',
    name: 'Accrued Factory Wages & Overtime',
    type: 'Liability',
    subType: 'Current Liability',
    openingBalance: 0,
    description: 'Monthly accrued factory production labor wages and overtime bonuses',
    isSystem: false,
    createdAt: new Date().toISOString()
  },

  // 3. Equity (3xxx)
  {
    id: 'acc_3001',
    organizationId: 'org_sme_01',
    code: '3001',
    name: "Owner's Capital / Partner Equity",
    type: 'Equity',
    subType: 'Equity',
    openingBalance: 0,
    description: 'Direct paid-up capital invested by managing partners',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_3010',
    organizationId: 'org_sme_01',
    code: '3010',
    name: 'Retained Earnings',
    type: 'Equity',
    subType: 'Equity',
    openingBalance: 0,
    description: 'Cumulative retained business profits carried forward',
    isSystem: true,
    createdAt: new Date().toISOString()
  },

  // 4. Revenue (4xxx)
  {
    id: 'acc_4001',
    organizationId: 'org_sme_01',
    code: '4001',
    name: 'Sales Revenue (Finished Textiles & Yarn)',
    type: 'Revenue',
    subType: 'Sales',
    openingBalance: 0,
    description: 'Gross billing from dispatch of manufactured textiles and yarn',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_4010',
    organizationId: 'org_sme_01',
    code: '4010',
    name: 'By-Product & Textile Scrap Sales',
    type: 'Revenue',
    subType: 'Sales',
    openingBalance: 0,
    description: 'Proceeds from sale of cotton waste, spinning remnants, and scrap',
    isSystem: false,
    createdAt: new Date().toISOString()
  },

  // 5. Expenses (5xxx)
  {
    id: 'acc_5001',
    organizationId: 'org_sme_01',
    code: '5001',
    name: 'Cost of Goods Sold (Raw Materials Consumed)',
    type: 'Expense',
    subType: 'Cost of Sales',
    openingBalance: 0,
    description: 'Direct raw materials, yarn, and chemicals consumed in weaving lines',
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_5010',
    organizationId: 'org_sme_01',
    code: '5010',
    name: 'Factory Electricity, WAPDA & Gas Power',
    type: 'Expense',
    subType: 'Operating Expense',
    openingBalance: 0,
    description: 'Industrial tariff electricity, gas supply, and backup generator diesel',
    isSystem: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_5020',
    organizationId: 'org_sme_01',
    code: '5020',
    name: 'Factory Floor Wages & Production Salaries',
    type: 'Expense',
    subType: 'Operating Expense',
    openingBalance: 0,
    description: 'Salaries and weekly piece-rate wages for loom operators and technicians',
    isSystem: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_5030',
    organizationId: 'org_sme_01',
    code: '5030',
    name: 'Freight & Cartage Outward (Logistics)',
    type: 'Expense',
    subType: 'Operating Expense',
    openingBalance: 0,
    description: 'Truck dispatch and freight costs to customer factories and dry ports',
    isSystem: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_5040',
    organizationId: 'org_sme_01',
    code: '5040',
    name: 'Machinery Maintenance, Spare Parts & Oil',
    type: 'Expense',
    subType: 'Operating Expense',
    openingBalance: 0,
    description: 'Loom lubricants, bearing replacements, and routine machine servicing',
    isSystem: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'acc_5050',
    organizationId: 'org_sme_01',
    code: '5050',
    name: 'General & Office Administration Expenses',
    type: 'Expense',
    subType: 'Operating Expense',
    openingBalance: 0,
    description: 'Printing, stationary, office internet, and audit compliance expenses',
    isSystem: false,
    createdAt: new Date().toISOString()
  }
];

// Production state: All mock vouchers cleared
export const INITIAL_CASHBOOK_VOUCHERS: CashbookEntry[] = [];
