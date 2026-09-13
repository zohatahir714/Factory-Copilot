import {
  ChartOfAccount,
  CashbookEntry,
  SalesOrder,
  PurchaseOrder,
  Customer,
  Supplier,
  Product
} from '../types';

export interface GeneralLedgerTransaction {
  date: string;
  voucherNumber: string;
  voucherType: string;
  narration: string;
  chequeNo?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface GeneralLedgerReport {
  account: ChartOfAccount;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  transactions: GeneralLedgerTransaction[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export interface DailyCashbookReport {
  date: string;
  openingBalanceCash: number;
  openingBalanceBank: number;
  totalOpeningBalance: number;
  receipts: Array<{
    id: string;
    voucherNumber: string;
    voucherType: string;
    accountName: string;
    description: string;
    paymentMode: string;
    amount: number;
  }>;
  payments: Array<{
    id: string;
    voucherNumber: string;
    voucherType: string;
    accountName: string;
    description: string;
    paymentMode: string;
    amount: number;
  }>;
  totalReceipts: number;
  totalPayments: number;
  netDailyChange: number;
  closingBalanceCash: number;
  closingBalanceBank: number;
  totalClosingBalance: number;
}

export interface TrialBalanceItem {
  code: string;
  name: string;
  type: string;
  subType: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  asOfDate: string;
  items: TrialBalanceItem[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
}

export interface ProfitLossReport {
  fromDate: string;
  toDate: string;
  revenueItems: Array<{ name: string; amount: number }>;
  totalRevenue: number;
  cogsItems: Array<{ name: string; amount: number }>;
  totalCOGS: number;
  grossProfit: number;
  grossMarginPercentage: number;
  expenseItems: Array<{ name: string; amount: number }>;
  totalExpenses: number;
  netProfit: number;
  netMarginPercentage: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  currentAssets: Array<{ name: string; amount: number }>;
  totalCurrentAssets: number;
  fixedAssets: Array<{ name: string; amount: number }>;
  totalFixedAssets: number;
  totalAssets: number;
  currentLiabilities: Array<{ name: string; amount: number }>;
  totalCurrentLiabilities: number;
  longTermLiabilities: Array<{ name: string; amount: number }>;
  totalLongTermLiabilities: number;
  totalLiabilities: number;
  equityItems: Array<{ name: string; amount: number }>;
  retainedEarningsCurrent: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
}

export interface CashFlowReport {
  fromDate: string;
  toDate: string;
  operatingInflows: number;
  operatingOutflows: number;
  netOperatingCash: number;
  investingCash: number;
  financingCash: number;
  netCashFlow: number;
  openingCashAndBank: number;
  closingCashAndBank: number;
}

/**
 * Calculates current balance for every account based on initial balance and all voucher lines.
 * For Asset & Expense: Balance = Opening + Debits - Credits
 * For Liability, Equity, Revenue: Balance = Opening + Credits - Debits
 */
export function calculateAccountBalances(
  accounts: ChartOfAccount[],
  vouchers: CashbookEntry[]
): Record<string, number> {
  const balances: Record<string, number> = {};

  accounts.forEach((acc) => {
    balances[acc.id] = acc.openingBalance || 0;
  });

  vouchers.forEach((v) => {
    if (v.entries && v.entries.length > 0) {
      v.entries.forEach((e) => {
        const acc = accounts.find((a) => a.id === e.accountId || a.code === e.accountCode);
        if (acc) {
          const isDebitNormal = acc.type === 'Asset' || acc.type === 'Expense';
          const delta = (e.debit || 0) - (e.credit || 0);
          balances[acc.id] = (balances[acc.id] || 0) + (isDebitNormal ? delta : -delta);
        }
      });
    } else {
      // Fallback for flat entries without multi-entry lines
      const defaultCashAcc = accounts.find((a) => a.subType === 'Cash');
      if (defaultCashAcc) {
        if (v.type === 'inflow') {
          balances[defaultCashAcc.id] = (balances[defaultCashAcc.id] || 0) + v.amount;
        } else {
          balances[defaultCashAcc.id] = (balances[defaultCashAcc.id] || 0) - v.amount;
        }
      }
    }
  });

  return balances;
}

/**
 * Live Cash in Hand and Bank Balances
 */
export function calculateLiquidTreasury(
  accounts: ChartOfAccount[],
  vouchers: CashbookEntry[]
): { cashInHand: number; bankBalance: number; totalLiquidity: number } {
  const balances = calculateAccountBalances(accounts, vouchers);

  let cashInHand = 0;
  let bankBalance = 0;

  accounts.forEach((acc) => {
    const bal = balances[acc.id] || 0;
    if (acc.subType === 'Cash') {
      cashInHand += bal;
    } else if (acc.subType === 'Bank') {
      bankBalance += bal;
    }
  });

  return {
    cashInHand: Math.max(0, cashInHand),
    bankBalance: Math.max(0, bankBalance),
    totalLiquidity: Math.max(0, cashInHand + bankBalance)
  };
}

/**
 * Generates the General Ledger for any specific account
 */
export function generateGeneralLedger(
  account: ChartOfAccount,
  vouchers: CashbookEntry[],
  fromDate: string,
  toDate: string
): GeneralLedgerReport {
  const isDebitNormal = account.type === 'Asset' || account.type === 'Expense';
  let openingBalance = account.openingBalance || 0;

  const fromTime = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${toDate}T23:59:59.999Z`).getTime();

  // Accumulate prior movements into opening balance
  vouchers.forEach((v) => {
    const vTime = new Date(v.createdAt).getTime();
    if (vTime < fromTime && v.entries && v.entries.length > 0) {
      v.entries.forEach((e) => {
        if (e.accountId === account.id || e.accountCode === account.code) {
          const delta = (e.debit || 0) - (e.credit || 0);
          openingBalance += isDebitNormal ? delta : -delta;
        }
      });
    }
  });

  // Collect transactions inside window
  const periodTransactions: GeneralLedgerTransaction[] = [];
  let runningBal = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  // Sort chronological
  const sortedVouchers = [...vouchers].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  sortedVouchers.forEach((v) => {
    const vTime = new Date(v.createdAt).getTime();
    if (vTime >= fromTime && vTime <= toTime) {
      if (v.entries && v.entries.length > 0) {
        v.entries.forEach((e) => {
          if (e.accountId === account.id || e.accountCode === account.code) {
            const deb = e.debit || 0;
            const cred = e.credit || 0;
            const delta = deb - cred;
            runningBal += isDebitNormal ? delta : -delta;
            totalDebit += deb;
            totalCredit += cred;

            periodTransactions.push({
              date: v.createdAt.split('T')[0],
              voucherNumber: v.voucherNumber || v.id,
              voucherType: v.voucherType || (v.type === 'inflow' ? 'CRV' : 'CPV'),
              narration: e.description || v.description,
              chequeNo: e.chequeNo || v.chequeNumber,
              debit: deb,
              credit: cred,
              runningBalance: runningBal
            });
          }
        });
      } else {
        // Flat entry fallback
        if (account.subType === 'Cash' || account.code === '1001') {
          const deb = v.type === 'inflow' ? v.amount : 0;
          const cred = v.type === 'outflow' ? v.amount : 0;
          const delta = deb - cred;
          runningBal += isDebitNormal ? delta : -delta;
          totalDebit += deb;
          totalCredit += cred;

          periodTransactions.push({
            date: v.createdAt.split('T')[0],
            voucherNumber: v.voucherNumber || v.id,
            voucherType: v.type === 'inflow' ? 'CRV' : 'CPV',
            narration: v.description,
            chequeNo: v.chequeNumber,
            debit: deb,
            credit: cred,
            runningBalance: runningBal
          });
        }
      }
    }
  });

  return {
    account,
    fromDate,
    toDate,
    openingBalance,
    transactions: periodTransactions,
    totalDebit,
    totalCredit,
    closingBalance: runningBal
  };
}

/**
 * Generates Daily Cashbook Report for a specific date
 */
export function generateDailyCashbook(
  targetDate: string,
  accounts: ChartOfAccount[],
  vouchers: CashbookEntry[]
): DailyCashbookReport {
  const cashAccounts = accounts.filter((a) => a.subType === 'Cash');
  const bankAccounts = accounts.filter((a) => a.subType === 'Bank');

  const startOfDay = new Date(`${targetDate}T00:00:00.000Z`).getTime();
  const endOfDay = new Date(`${targetDate}T23:59:59.999Z`).getTime();

  // 1. Calculate opening balances prior to start of day
  let openingCash = cashAccounts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);
  let openingBank = bankAccounts.reduce((sum, a) => sum + (a.openingBalance || 0), 0);

  vouchers.forEach((v) => {
    const vTime = new Date(v.createdAt).getTime();
    if (vTime < startOfDay) {
      if (v.entries && v.entries.length > 0) {
        v.entries.forEach((e) => {
          const isCash = cashAccounts.some((a) => a.id === e.accountId || a.code === e.accountCode);
          const isBank = bankAccounts.some((a) => a.id === e.accountId || a.code === e.accountCode);
          if (isCash) openingCash += (e.debit || 0) - (e.credit || 0);
          if (isBank) openingBank += (e.debit || 0) - (e.credit || 0);
        });
      } else {
        if (v.paymentMode === 'bank') {
          openingBank += v.type === 'inflow' ? v.amount : -v.amount;
        } else {
          openingCash += v.type === 'inflow' ? v.amount : -v.amount;
        }
      }
    }
  });

  // 2. Identify receipts and payments strictly on targetDate
  const receipts: DailyCashbookReport['receipts'] = [];
  const payments: DailyCashbookReport['payments'] = [];

  vouchers.forEach((v) => {
    const vDate = v.createdAt.split('T')[0];
    if (vDate === targetDate) {
      const mode = v.paymentMode || (v.voucherType?.startsWith('B') ? 'bank' : 'cash');
      const item = {
        id: v.id,
        voucherNumber: v.voucherNumber || v.id,
        voucherType: v.voucherType || (v.type === 'inflow' ? 'CRV' : 'CPV'),
        accountName: v.entries?.[0]?.accountName || v.category.replace('_', ' ').toUpperCase(),
        description: v.description,
        paymentMode: mode,
        amount: v.amount
      };

      if (v.type === 'inflow') {
        receipts.push(item);
      } else {
        payments.push(item);
      }
    }
  });

  const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const netDailyChange = totalReceipts - totalPayments;

  // Compute closing balances
  let closingCash = openingCash;
  let closingBank = openingBank;

  receipts.forEach((r) => {
    if (r.paymentMode === 'bank') closingBank += r.amount;
    else closingCash += r.amount;
  });

  payments.forEach((p) => {
    if (p.paymentMode === 'bank') closingBank -= p.amount;
    else closingCash -= p.amount;
  });

  return {
    date: targetDate,
    openingBalanceCash: openingCash,
    openingBalanceBank: openingBank,
    totalOpeningBalance: openingCash + openingBank,
    receipts,
    payments,
    totalReceipts,
    totalPayments,
    netDailyChange,
    closingBalanceCash: closingCash,
    closingBalanceBank: closingBank,
    totalClosingBalance: closingCash + closingBank
  };
}

/**
 * Generates Trial Balance
 */
export function generateTrialBalance(
  accounts: ChartOfAccount[],
  vouchers: CashbookEntry[],
  asOfDate: string
): TrialBalanceReport {
  const asOfTime = new Date(`${asOfDate}T23:59:59.999Z`).getTime();
  const balances: Record<string, { debit: number; credit: number }> = {};

  accounts.forEach((acc) => {
    const isDebitNormal = acc.type === 'Asset' || acc.type === 'Expense';
    let bal = acc.openingBalance || 0;

    vouchers.forEach((v) => {
      const vTime = new Date(v.createdAt).getTime();
      if (vTime <= asOfTime && v.entries && v.entries.length > 0) {
        v.entries.forEach((e) => {
          if (e.accountId === acc.id || e.accountCode === acc.code) {
            const delta = (e.debit || 0) - (e.credit || 0);
            bal += isDebitNormal ? delta : -delta;
          }
        });
      }
    });

    if (isDebitNormal) {
      balances[acc.id] = { debit: Math.max(0, bal), credit: bal < 0 ? Math.abs(bal) : 0 };
    } else {
      balances[acc.id] = { debit: bal < 0 ? Math.abs(bal) : 0, credit: Math.max(0, bal) };
    }
  });

  const items: TrialBalanceItem[] = accounts.map((acc) => ({
    code: acc.code,
    name: acc.name,
    type: acc.type,
    subType: acc.subType,
    debit: balances[acc.id]?.debit || 0,
    credit: balances[acc.id]?.credit || 0
  }));

  const totalDebit = items.reduce((s, it) => s + it.debit, 0);
  const totalCredit = items.reduce((s, it) => s + it.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);

  return {
    asOfDate,
    items,
    totalDebit,
    totalCredit,
    isBalanced: difference < 1,
    difference
  };
}

/**
 * Generates Profit & Loss Statement (P&L)
 */
export function generateProfitLoss(
  accounts: ChartOfAccount[],
  vouchers: CashbookEntry[],
  salesOrders: SalesOrder[],
  fromDate: string,
  toDate: string
): ProfitLossReport {
  const fromTime = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${toDate}T23:59:59.999Z`).getTime();

  // Revenue from Sales Orders + Revenue accounts
  const periodSales = salesOrders.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= fromTime && t <= toTime;
  });
  const salesRevenueVal = periodSales.reduce((s, o) => s + (o.subtotal || o.totalAmount * 0.847), 0);

  const revenueItems: Array<{ name: string; amount: number }> = [
    { name: 'Sales Revenue (Manufactured Textiles & Yarn)', amount: Math.round(salesRevenueVal) }
  ];

  // Additional revenues from accounts
  accounts
    .filter((a) => a.type === 'Revenue' && a.code !== '4001')
    .forEach((a) => {
      let bal = 0;
      vouchers.forEach((v) => {
        const vt = new Date(v.createdAt).getTime();
        if (vt >= fromTime && vt <= toTime && v.entries) {
          v.entries.forEach((e) => {
            if (e.accountId === a.id || e.accountCode === a.code) {
              bal += (e.credit || 0) - (e.debit || 0);
            }
          });
        }
      });
      if (bal > 0) revenueItems.push({ name: a.name, amount: bal });
    });

  const totalRevenue = revenueItems.reduce((s, r) => s + r.amount, 0);

  // Cost of Goods Sold
  const cogsItems: Array<{ name: string; amount: number }> = [];
  accounts
    .filter((a) => a.subType === 'Cost of Sales')
    .forEach((a) => {
      let bal = a.openingBalance || 0;
      vouchers.forEach((v) => {
        const vt = new Date(v.createdAt).getTime();
        if (vt >= fromTime && vt <= toTime && v.entries) {
          v.entries.forEach((e) => {
            if (e.accountId === a.id || e.accountCode === a.code) {
              bal += (e.debit || 0) - (e.credit || 0);
            }
          });
        }
      });
      // Estimate COGS from period sales if no explicit vouchers
      if (bal === 0 && totalRevenue > 0) {
        bal = Math.round(totalRevenue * 0.62); // 62% manufacturing COGS ratio
      }
      cogsItems.push({ name: a.name, amount: bal });
    });

  const totalCOGS = cogsItems.reduce((s, c) => s + c.amount, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const grossMarginPercentage = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Operating Expenses
  const expenseItems: Array<{ name: string; amount: number }> = [];
  accounts
    .filter((a) => a.type === 'Expense' && a.subType !== 'Cost of Sales')
    .forEach((a) => {
      let bal = 0;
      vouchers.forEach((v) => {
        const vt = new Date(v.createdAt).getTime();
        if (vt >= fromTime && vt <= toTime) {
          if (v.entries) {
            v.entries.forEach((e) => {
              if (e.accountId === a.id || e.accountCode === a.code) {
                bal += (e.debit || 0) - (e.credit || 0);
              }
            });
          } else if (v.category === 'utilities' && a.code === '5010') {
            bal += v.amount;
          }
        }
      });
      if (bal > 0) expenseItems.push({ name: a.name, amount: bal });
    });

  const totalExpenses = expenseItems.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const netMarginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    fromDate,
    toDate,
    revenueItems,
    totalRevenue,
    cogsItems,
    totalCOGS,
    grossProfit,
    grossMarginPercentage,
    expenseItems,
    totalExpenses,
    netProfit,
    netMarginPercentage
  };
}

/**
 * Generates Balance Sheet
 */
export function generateBalanceSheet(
  accounts: ChartOfAccount[],
  vouchers: CashbookEntry[],
  salesOrders: SalesOrder[],
  asOfDate: string
): BalanceSheetReport {
  const asOfTime = new Date(`${asOfDate}T23:59:59.999Z`).getTime();

  // Helper to calculate balance as of date
  const getBal = (acc: ChartOfAccount) => {
    const isDebitNormal = acc.type === 'Asset' || acc.type === 'Expense';
    let bal = acc.openingBalance || 0;
    vouchers.forEach((v) => {
      const vt = new Date(v.createdAt).getTime();
      if (vt <= asOfTime && v.entries) {
        v.entries.forEach((e) => {
          if (e.accountId === acc.id || e.accountCode === acc.code) {
            const delta = (e.debit || 0) - (e.credit || 0);
            bal += isDebitNormal ? delta : -delta;
          }
        });
      }
    });
    return Math.max(0, bal);
  };

  const currentAssets = accounts
    .filter((a) => a.type === 'Asset' && a.subType !== 'Fixed Asset')
    .map((a) => ({ name: a.name, amount: getBal(a) }));
  const totalCurrentAssets = currentAssets.reduce((s, a) => s + a.amount, 0);

  const fixedAssets = accounts
    .filter((a) => a.type === 'Asset' && a.subType === 'Fixed Asset')
    .map((a) => ({ name: a.name, amount: getBal(a) }));
  const totalFixedAssets = fixedAssets.reduce((s, a) => s + a.amount, 0);

  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const currentLiabilities = accounts
    .filter((a) => a.type === 'Liability' && a.subType !== 'Long Term Liability')
    .map((a) => ({ name: a.name, amount: getBal(a) }));
  const totalCurrentLiabilities = currentLiabilities.reduce((s, l) => s + l.amount, 0);

  const longTermLiabilities = accounts
    .filter((a) => a.type === 'Liability' && a.subType === 'Long Term Liability')
    .map((a) => ({ name: a.name, amount: getBal(a) }));
  const totalLongTermLiabilities = longTermLiabilities.reduce((s, l) => s + l.amount, 0);

  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

  const equityItems = accounts
    .filter((a) => a.type === 'Equity')
    .map((a) => ({ name: a.name, amount: getBal(a) }));
  const baseEquity = equityItems.reduce((s, e) => s + e.amount, 0);

  // Approximate Net Profit retained
  const pnl = generateProfitLoss(accounts, vouchers, salesOrders, '2024-01-01', asOfDate);
  const retainedEarningsCurrent = pnl.netProfit;

  const totalEquity = baseEquity + retainedEarningsCurrent;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const diff = Math.abs(totalAssets - totalLiabilitiesAndEquity);

  return {
    asOfDate,
    currentAssets,
    totalCurrentAssets,
    fixedAssets,
    totalFixedAssets,
    totalAssets,
    currentLiabilities,
    totalCurrentLiabilities,
    longTermLiabilities,
    totalLongTermLiabilities,
    totalLiabilities,
    equityItems,
    retainedEarningsCurrent,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced: diff < 10,
    difference: diff
  };
}

/**
 * Generates Sale Report (By Person or By Material)
 */
export function generateSaleReport(
  salesOrders: SalesOrder[],
  customers: Customer[],
  products: Product[],
  fromDate: string,
  toDate: string,
  groupBy: 'person' | 'material'
) {
  const fromTime = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${toDate}T23:59:59.999Z`).getTime();

  const filtered = salesOrders.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= fromTime && t <= toTime;
  });

  if (groupBy === 'person') {
    const byCustomer: Record<
      string,
      {
        customerName: string;
        orderCount: number;
        totalQty: number;
        subtotal: number;
        taxAmount: number;
        totalAmount: number;
        orders: Array<{
          invoiceNumber: string;
          date: string;
          productNames: string;
          quantity: number;
          totalAmount: number;
          paymentStatus: string;
        }>;
      }
    > = {};

    filtered.forEach((so) => {
      const key = so.customerId || so.customerName || 'Walk-in';
      if (!byCustomer[key]) {
        byCustomer[key] = {
          customerName: so.customerName || 'Valued Mill Client',
          orderCount: 0,
          totalQty: 0,
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
          orders: []
        };
      }

      const row = byCustomer[key];
      row.orderCount += 1;
      const orderQty = so.items?.reduce((s, it) => s + it.quantity, 0) || 0;
      row.totalQty += orderQty;
      row.subtotal += so.subtotal || so.totalAmount * 0.847;
      row.taxAmount += so.taxAmount || so.totalAmount * 0.153;
      row.totalAmount += so.totalAmount;

      row.orders.push({
        invoiceNumber: so.invoiceNumber,
        date: so.createdAt.split('T')[0],
        productNames: so.items?.map((it) => it.productName).join(', ') || 'Manufactured Fabric',
        quantity: orderQty,
        totalAmount: so.totalAmount,
        paymentStatus: so.paymentStatus
      });
    });

    return {
      groupBy: 'person',
      fromDate,
      toDate,
      records: Object.values(byCustomer),
      totalOrders: filtered.length,
      grandTotal: filtered.reduce((s, o) => s + o.totalAmount, 0),
      grandTax: filtered.reduce((s, o) => s + o.taxAmount, 0)
    };
  } else {
    // By Material
    const byMaterial: Record<
      string,
      {
        productName: string;
        sku: string;
        unit: string;
        totalQty: number;
        orderCount: number;
        totalRevenue: number;
        avgRate: number;
      }
    > = {};

    filtered.forEach((so) => {
      so.items?.forEach((it) => {
        const key = it.productId || it.productName;
        if (!byMaterial[key]) {
          byMaterial[key] = {
            productName: it.productName,
            sku: products.find((p) => p.id === it.productId)?.sku || 'MAT-TEXT',
            unit: it.unit || 'meters',
            totalQty: 0,
            orderCount: 0,
            totalRevenue: 0,
            avgRate: it.unitPrice || 0
          };
        }

        const row = byMaterial[key];
        row.totalQty += it.quantity;
        row.orderCount += 1;
        row.totalRevenue += it.totalAmount;
        row.avgRate = Math.round(row.totalRevenue / row.totalQty);
      });
    });

    return {
      groupBy: 'material',
      fromDate,
      toDate,
      records: Object.values(byMaterial),
      totalOrders: filtered.length,
      grandTotal: filtered.reduce((s, o) => s + o.totalAmount, 0),
      grandTax: filtered.reduce((s, o) => s + o.taxAmount, 0)
    };
  }
}

/**
 * Generates Purchase Report (By Person or By Material)
 */
export function generatePurchaseReport(
  purchaseOrders: PurchaseOrder[],
  suppliers: Supplier[],
  products: Product[],
  fromDate: string,
  toDate: string,
  groupBy: 'person' | 'material'
) {
  const fromTime = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${toDate}T23:59:59.999Z`).getTime();

  const filtered = purchaseOrders.filter((p) => {
    const t = new Date(p.createdAt).getTime();
    return t >= fromTime && t <= toTime;
  });

  if (groupBy === 'person') {
    const bySupplier: Record<
      string,
      {
        supplierName: string;
        poCount: number;
        totalQty: number;
        totalAmount: number;
        orders: Array<{
          poNumber: string;
          date: string;
          items: string;
          quantity: number;
          totalAmount: number;
          status: string;
        }>;
      }
    > = {};

    filtered.forEach((po) => {
      const key = po.supplierId || po.supplierName || 'General Supplier';
      if (!bySupplier[key]) {
        bySupplier[key] = {
          supplierName: po.supplierName || 'National Vendor',
          poCount: 0,
          totalQty: 0,
          totalAmount: 0,
          orders: []
        };
      }

      const row = bySupplier[key];
      row.poCount += 1;
      const poQty = po.items?.reduce((s, it) => s + it.quantity, 0) || 0;
      row.totalQty += poQty;
      row.totalAmount += po.totalAmount;

      row.orders.push({
        poNumber: po.poNumber,
        date: po.createdAt.split('T')[0],
        items: po.items?.map((it) => it.productName).join(', ') || 'Raw Materials',
        quantity: poQty,
        totalAmount: po.totalAmount,
        status: po.status
      });
    });

    return {
      groupBy: 'person',
      fromDate,
      toDate,
      records: Object.values(bySupplier),
      totalPOs: filtered.length,
      grandTotal: filtered.reduce((s, po) => s + po.totalAmount, 0)
    };
  } else {
    // By Material
    const byMaterial: Record<
      string,
      {
        productName: string;
        unit: string;
        totalQty: number;
        poCount: number;
        totalCost: number;
        avgCost: number;
      }
    > = {};

    filtered.forEach((po) => {
      po.items?.forEach((it) => {
        const key = it.productId || it.productName;
        if (!byMaterial[key]) {
          byMaterial[key] = {
            productName: it.productName,
            unit: it.unit || 'kg',
            totalQty: 0,
            poCount: 0,
            totalCost: 0,
            avgCost: it.unitPrice || 0
          };
        }

        const row = byMaterial[key];
        row.totalQty += it.quantity;
        row.poCount += 1;
        row.totalCost += it.totalAmount;
        row.avgCost = Math.round(row.totalCost / row.totalQty);
      });
    });

    return {
      groupBy: 'material',
      fromDate,
      toDate,
      records: Object.values(byMaterial),
      totalPOs: filtered.length,
      grandTotal: filtered.reduce((s, po) => s + po.totalAmount, 0)
    };
  }
}

/**
 * ADAPTER EXPORTS FOR ReportsModule
 */

export function calculateLedgerForAccount(
  cashbook: CashbookEntry[],
  account: ChartOfAccount,
  startDate: string,
  endDate: string
) {
  const isDebitNormal =
    account.type === 'Asset' ||
    account.type === 'Expense' ||
    account.category?.toLowerCase() === 'asset' ||
    account.category?.toLowerCase() === 'expense';

  let openingBalance = account.openingBalance || 0;
  const fromTime = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${endDate}T23:59:59.999Z`).getTime();

  // Accumulate prior movements into opening balance
  cashbook.forEach((v) => {
    const vTime = new Date(v.createdAt).getTime();
    if (vTime < fromTime) {
      if (v.entries && v.entries.length > 0) {
        v.entries.forEach((e) => {
          if (e.accountId === account.id || e.accountCode === account.code) {
            const delta = (e.debit || 0) - (e.credit || 0);
            openingBalance += isDebitNormal ? delta : -delta;
          }
        });
      } else {
        const isCashOrBank = account.subType === 'Cash' || account.subType === 'Bank' || account.code.startsWith('10');
        if (isCashOrBank) {
          openingBalance += v.type === 'inflow' ? v.amount : -v.amount;
        }
      }
    }
  });

  const rows: Array<{
    date: string;
    voucherNumber: string;
    voucherType: string;
    narration: string;
    debit: number;
    credit: number;
    balance: number;
  }> = [];

  let runningBal = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const sortedVouchers = [...cashbook].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  sortedVouchers.forEach((v) => {
    const vTime = new Date(v.createdAt).getTime();
    if (vTime >= fromTime && vTime <= toTime) {
      if (v.entries && v.entries.length > 0) {
        v.entries.forEach((e) => {
          if (e.accountId === account.id || e.accountCode === account.code) {
            const deb = e.debit || 0;
            const cred = e.credit || 0;
            const delta = deb - cred;
            runningBal += isDebitNormal ? delta : -delta;
            totalDebit += deb;
            totalCredit += cred;

            rows.push({
              date: v.createdAt.split('T')[0],
              voucherNumber: v.voucherNumber || v.id,
              voucherType: v.voucherType || (v.type === 'inflow' ? 'CRV' : 'CPV'),
              narration: e.description || v.description,
              debit: deb,
              credit: cred,
              balance: runningBal
            });
          }
        });
      } else {
        const isCashOrBank = account.subType === 'Cash' || account.subType === 'Bank' || account.code.startsWith('10');
        if (isCashOrBank) {
          const deb = v.type === 'inflow' ? v.amount : 0;
          const cred = v.type === 'outflow' ? v.amount : 0;
          const delta = deb - cred;
          runningBal += isDebitNormal ? delta : -delta;
          totalDebit += deb;
          totalCredit += cred;

          rows.push({
            date: v.createdAt.split('T')[0],
            voucherNumber: v.voucherNumber || v.id,
            voucherType: v.type === 'inflow' ? 'CRV' : 'CPV',
            narration: v.description,
            debit: deb,
            credit: cred,
            balance: runningBal
          });
        }
      }
    }
  });

  return {
    openingBalance,
    rows,
    closingBalance: runningBal,
    totalDebit,
    totalCredit
  };
}

export function calculateDailyCashbook(
  cashbook: CashbookEntry[],
  accounts: ChartOfAccount[],
  selectedSingleDate: string
) {
  const rep = generateDailyCashbook(selectedSingleDate, accounts, cashbook);
  return {
    openingCash: rep.openingBalanceCash,
    openingBank: rep.openingBalanceBank,
    totalInflow: rep.totalReceipts,
    totalOutflow: rep.totalPayments,
    closingCash: rep.closingBalanceCash,
    closingBank: rep.closingBalanceBank,
    inflowEntries: rep.receipts.map((r) => ({
      id: r.id,
      voucherNumber: r.voucherNumber,
      description: r.description,
      paymentMode: r.paymentMode,
      category: r.accountName,
      amount: r.amount
    })),
    outflowEntries: rep.payments.map((p) => ({
      id: p.id,
      voucherNumber: p.voucherNumber,
      description: p.description,
      paymentMode: p.paymentMode,
      category: p.accountName,
      amount: p.amount
    }))
  };
}

export function calculateTrialBalance(
  accounts: ChartOfAccount[],
  cashbook: CashbookEntry[],
  endDate: string
) {
  const tb = generateTrialBalance(accounts, cashbook, endDate);
  return {
    isBalanced: tb.isBalanced,
    difference: tb.difference,
    rows: tb.items.map((it) => {
      const acc = accounts.find((a) => a.code === it.code);
      return {
        accountId: acc?.id || it.code,
        code: it.code,
        name: it.name,
        category: acc?.category || it.type,
        debitBalance: it.debit,
        creditBalance: it.credit
      };
    }),
    totalDebit: tb.totalDebit,
    totalCredit: tb.totalCredit
  };
}

export function calculateProfitAndLoss(
  accounts: ChartOfAccount[],
  cashbook: CashbookEntry[],
  salesOrders: SalesOrder[],
  purchaseOrders: PurchaseOrder[],
  startDate: string,
  endDate: string
) {
  const pnl = generateProfitLoss(accounts, cashbook, salesOrders, startDate, endDate);
  return {
    revenueItems: pnl.revenueItems,
    totalRevenue: pnl.totalRevenue,
    costOfGoodsSold: pnl.totalCOGS,
    grossProfit: pnl.grossProfit,
    expenseItems: pnl.expenseItems,
    totalExpenses: pnl.totalExpenses,
    netProfit: pnl.netProfit
  };
}

export function calculateBalanceSheet(
  accounts: ChartOfAccount[],
  cashbook: CashbookEntry[],
  products: Product[],
  endDate: string
) {
  const bs = generateBalanceSheet(accounts, cashbook, [], endDate);
  return {
    isBalanced: bs.isBalanced,
    difference: bs.difference,
    assets: [...bs.currentAssets, ...bs.fixedAssets],
    totalAssets: bs.totalAssets,
    liabilities: [...bs.currentLiabilities, ...bs.longTermLiabilities],
    totalLiabilities: bs.totalLiabilities,
    equity: [...bs.equityItems, { name: 'Retained Earnings (Current Period)', amount: bs.retainedEarningsCurrent }],
    totalEquity: bs.totalEquity
  };
}

export function calculateCashFlowStatement(
  cashbook: CashbookEntry[],
  startDate: string,
  endDate: string
) {
  const fromTime = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${endDate}T23:59:59.999Z`).getTime();

  let operatingInflow = 0;
  let operatingOutflow = 0;

  cashbook.forEach((v) => {
    const t = new Date(v.createdAt).getTime();
    if (t >= fromTime && t <= toTime) {
      if (v.type === 'inflow') {
        operatingInflow += v.amount;
      } else {
        operatingOutflow += v.amount;
      }
    }
  });

  const netChangeInCash = operatingInflow - operatingOutflow;

  return {
    operatingInflow,
    operatingOutflow,
    financingFlow: 0,
    netChangeInCash
  };
}

export function calculateSalesPurchaseReport(params: {
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  type: 'sale' | 'purchase';
  groupBy: 'person' | 'material';
  startDate: string;
  endDate: string;
}) {
  const { salesOrders, purchaseOrders, products, customers, suppliers, type, groupBy, startDate, endDate } = params;

  if (type === 'sale') {
    const rep = generateSaleReport(salesOrders, customers, products, startDate, endDate, groupBy);
    const rows = rep.records.map((r: any, idx: number) => {
      if (groupBy === 'person') {
        return {
          id: `so-party-${idx}`,
          name: r.customerName,
          details: `${r.orderCount} invoice(s)`,
          quantity: r.totalQty,
          subtotal: r.subtotal,
          tax: r.taxAmount,
          total: r.totalAmount
        };
      } else {
        return {
          id: `so-mat-${idx}`,
          name: r.productName,
          details: `SKU: ${r.sku} • Avg Rate: Rs. ${r.avgRate}/${r.unit}`,
          quantity: r.totalQty,
          subtotal: Math.round(r.totalRevenue / 1.18),
          tax: Math.round(r.totalRevenue - r.totalRevenue / 1.18),
          total: r.totalRevenue
        };
      }
    });

    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

    return {
      totalAmount: rep.grandTotal,
      totalTax: rep.grandTax,
      totalQuantity: totalQty,
      totalTransactions: rep.totalOrders,
      rows
    };
  } else {
    const rep = generatePurchaseReport(purchaseOrders, suppliers, products, startDate, endDate, groupBy);
    const rows = rep.records.map((r: any, idx: number) => {
      if (groupBy === 'person') {
        return {
          id: `po-party-${idx}`,
          name: r.supplierName,
          details: `${r.poCount} purchase order(s)`,
          quantity: r.totalQty,
          subtotal: r.totalAmount,
          tax: 0,
          total: r.totalAmount
        };
      } else {
        return {
          id: `po-mat-${idx}`,
          name: r.productName,
          details: `Unit: ${r.unit} • Avg Cost: Rs. ${r.avgCost}/${r.unit}`,
          quantity: r.totalQty,
          subtotal: r.totalCost,
          tax: 0,
          total: r.totalCost
        };
      }
    });

    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

    return {
      totalAmount: rep.grandTotal,
      totalTax: 0,
      totalQuantity: totalQty,
      totalTransactions: rep.totalPOs,
      rows
    };
  }
}
