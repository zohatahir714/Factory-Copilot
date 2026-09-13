import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  Calendar,
  Search,
  Printer,
  Download,
  BookOpen,
  Scale,
  TrendingUp,
  FileSpreadsheet,
  Users,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowRight,
  Filter
} from 'lucide-react';
import {
  calculateLedgerForAccount,
  calculateDailyCashbook,
  calculateTrialBalance,
  calculateProfitAndLoss,
  calculateBalanceSheet,
  calculateCashFlowStatement,
  calculateSalesPurchaseReport
} from '../utils/accountingEngine';

export const ReportsModule: React.FC = () => {
  const {
    cashbook,
    accounts,
    salesOrders,
    purchaseOrders,
    products,
    customers,
    suppliers,
    openPrintDocument,
    branding,
    currentUser,
    addToast
  } = useApp();

  const todayStr = new Date().toISOString().slice(0, 10);
  const startOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  // Main reports tab
  const [reportTab, setReportTab] = useState<'gl' | 'cashbook' | 'financials' | 'sales_purchase'>('gl');

  // Enhanced Date Picker State
  const [startDate, setStartDate] = useState(startOfMonthStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedSingleDate, setSelectedSingleDate] = useState(todayStr);
  const [activeDatePreset, setActiveDatePreset] = useState<'today' | 'this_month' | 'last_month' | 'fy' | 'custom'>('this_month');

  // GL Account Selector
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [glSearchTerm, setGlSearchTerm] = useState('');

  // Financials Sub-Tab
  const [financialSubTab, setFinancialSubTab] = useState<'tb' | 'pl' | 'bs' | 'cf'>('tb');

  // Sales & Purchase Report Sub-Controls
  const [tradeType, setTradeType] = useState<'sale' | 'purchase'>('sale');
  const [groupBy, setGroupBy] = useState<'person' | 'material'>('person');

  // Date Presets Handler
  const handleDatePreset = (preset: 'today' | 'this_month' | 'last_month' | 'fy') => {
    setActiveDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().slice(0, 10);
      setStartDate(d);
      setEndDate(d);
      setSelectedSingleDate(d);
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === 'fy') {
      // Pakistani Fiscal Year (July 1 - June 30)
      const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
      const start = `${year}-07-01`;
      const end = `${year + 1}-06-30`;
      setStartDate(start);
      setEndDate(end);
    }
  };

  // 1. General Ledger Calculation
  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId) || accounts[0];
  }, [accounts, selectedAccountId]);

  const ledgerResult = useMemo(() => {
    if (!selectedAccount) return { openingBalance: 0, rows: [], closingBalance: 0, totalDebit: 0, totalCredit: 0 };
    return calculateLedgerForAccount(cashbook, selectedAccount, startDate, endDate);
  }, [cashbook, selectedAccount, startDate, endDate]);

  // 2. Daily Cashbook Calculation
  const dailyCashbookResult = useMemo(() => {
    return calculateDailyCashbook(cashbook, accounts, selectedSingleDate);
  }, [cashbook, accounts, selectedSingleDate]);

  // 3. Financial Statements Calculations
  const trialBalanceResult = useMemo(() => {
    return calculateTrialBalance(accounts, cashbook, endDate);
  }, [accounts, cashbook, endDate]);

  const plResult = useMemo(() => {
    return calculateProfitAndLoss(accounts, cashbook, salesOrders, purchaseOrders, startDate, endDate);
  }, [accounts, cashbook, salesOrders, purchaseOrders, startDate, endDate]);

  const balanceSheetResult = useMemo(() => {
    return calculateBalanceSheet(accounts, cashbook, products, endDate);
  }, [accounts, cashbook, products, endDate]);

  const cashFlowResult = useMemo(() => {
    return calculateCashFlowStatement(cashbook, startDate, endDate);
  }, [cashbook, startDate, endDate]);

  // 4. Sales & Purchase Report Calculation
  const tradeReportResult = useMemo(() => {
    return calculateSalesPurchaseReport({
      salesOrders,
      purchaseOrders,
      products,
      customers,
      suppliers,
      type: tradeType,
      groupBy,
      startDate,
      endDate
    });
  }, [salesOrders, purchaseOrders, products, customers, suppliers, tradeType, groupBy, startDate, endDate]);

  // Filter accounts for GL Search
  const filteredGlAccounts = useMemo(() => {
    return accounts.filter(
      a =>
        a.name.toLowerCase().includes(glSearchTerm.toLowerCase()) ||
        a.code.toLowerCase().includes(glSearchTerm.toLowerCase())
    );
  }, [accounts, glSearchTerm]);

  // Handler for PDF Print trigger
  const handlePrintCurrentReport = () => {
    if (reportTab === 'gl') {
      openPrintDocument({
        type: 'cash_voucher',
        title: 'General Ledger Summary Voucher',
        data: {
          id: `GL-${selectedAccount?.code}`,
          type: 'inflow',
          amount: ledgerResult.closingBalance || 0,
          category: 'General Ledger',
          description: `General Ledger for ${selectedAccount?.code} - ${selectedAccount?.name} (${startDate} to ${endDate}). Opening: Rs. ${(ledgerResult.openingBalance || 0).toLocaleString()}, Total Debit: Rs. ${(ledgerResult.totalDebit || 0).toLocaleString()}, Total Credit: Rs. ${(ledgerResult.totalCredit || 0).toLocaleString()}, Closing: Rs. ${(ledgerResult.closingBalance || 0).toLocaleString()}`
        }
      });
    } else if (reportTab === 'cashbook') {
      openPrintDocument({
        type: 'cash_voucher',
        title: 'Daily Cashbook Summary Voucher',
        data: {
          id: `CB-${selectedSingleDate}`,
          type: 'inflow',
          amount: (dailyCashbookResult.closingCash || 0) + (dailyCashbookResult.closingBank || 0),
          category: 'Daily Cashbook',
          description: `Daily Cashbook Statement for ${selectedSingleDate}. Opening Cash: Rs. ${(dailyCashbookResult.openingCash || 0).toLocaleString()}, Opening Bank: Rs. ${(dailyCashbookResult.openingBank || 0).toLocaleString()}, Total Inflow: Rs. ${(dailyCashbookResult.totalInflow || 0).toLocaleString()}, Total Outflow: Rs. ${(dailyCashbookResult.totalOutflow || 0).toLocaleString()}, Closing Cash: Rs. ${(dailyCashbookResult.closingCash || 0).toLocaleString()}, Closing Bank: Rs. ${(dailyCashbookResult.closingBank || 0).toLocaleString()}`
        }
      });
    } else {
      addToast('info', 'Report Ready for Export', 'Use browser print (Ctrl+P) to print the high-resolution ledger report.');
      window.print();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Financial Reports & General Ledger
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enhanced date filter, ledger preview, daily cashbook with opening/closing, and statutory statements
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintCurrentReport}
            className="px-4 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Export PDF</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setReportTab('gl')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            reportTab === 'gl'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>General Ledger (GL)</span>
        </button>

        <button
          type="button"
          onClick={() => setReportTab('cashbook')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            reportTab === 'cashbook'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Daily Cashbook (Open/Close)</span>
        </button>

        <button
          type="button"
          onClick={() => setReportTab('financials')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            reportTab === 'financials'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Trial Balance & Financials</span>
        </button>

        <button
          type="button"
          onClick={() => setReportTab('sales_purchase')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            reportTab === 'sales_purchase'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Sale & Purchase Reports</span>
        </button>
      </div>

      {/* ENHANCED DATE PICKER & FILTER STRIP (Sticky & Accessible) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Enhanced Period Filter:</span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'fy', label: 'Fiscal Year (2024-25)' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePreset(p.id as any)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activeDatePreset === p.id
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {reportTab === 'cashbook' ? (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select Cashbook Audit Date
              </label>
              <input
                type="date"
                value={selectedSingleDate}
                onChange={(e) => {
                  setSelectedSingleDate(e.target.value);
                  setActiveDatePreset('custom');
                }}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActiveDatePreset('custom');
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActiveDatePreset('custom');
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold"
                />
              </div>
            </>
          )}

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => addToast('success', 'Report Refreshed', 'Calculated latest ledger entries from database.')}
              className="w-full py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GENERAL LEDGER (GL) - The requested primary ledger view with search */}
      {/* ========================================================================= */}
      {reportTab === 'gl' && (
        <div className="space-y-4">
          {/* GL Account Selector & Search Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="w-full sm:w-1/2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Select Chart of Accounts Head
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-semibold text-slate-900 dark:text-white"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} - {acc.name} ({(acc.category || acc.type || 'Account').toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-1/2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Search Account Head
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={glSearchTerm}
                  onChange={(e) => setGlSearchTerm(e.target.value)}
                  placeholder="Quick filter accounts..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>
            </div>
          </div>

          {/* Account Profile Strip */}
          {selectedAccount && (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 text-base">
                    {selectedAccount.code}
                  </span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedAccount.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                    {selectedAccount.category || selectedAccount.type}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Ledger Period: {startDate} to {endDate} • {ledgerResult.rows.length} Transaction(s)
                </p>
              </div>

              <div className="flex items-center gap-6 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Opening</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Rs. {(ledgerResult.openingBalance || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Net Closing</span>
                  <span className="text-base font-black text-emerald-800 dark:text-emerald-300">
                    Rs. {(ledgerResult.closingBalance || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* GL Ledger Statement Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 pl-4">Date</th>
                    <th className="p-3.5">Voucher #</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Narration / Particulars</th>
                    <th className="p-3.5 text-right">Debit (PKR)</th>
                    <th className="p-3.5 text-right">Credit (PKR)</th>
                    <th className="p-3.5 text-right pr-4">Balance (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/50 dark:bg-slate-800/20 font-bold">
                    <td className="p-3 pl-4 text-slate-500">{startDate}</td>
                    <td className="p-3 text-slate-500">-</td>
                    <td className="p-3 text-slate-500">OB</td>
                    <td className="p-3 font-sans text-slate-700 dark:text-slate-300 font-bold">
                      Opening Balance Carried Forward
                    </td>
                    <td className="p-3 text-right text-slate-500">-</td>
                    <td className="p-3 text-right text-slate-500">-</td>
                    <td className="p-3 text-right pr-4 text-slate-900 dark:text-white font-black">
                      Rs. {(ledgerResult.openingBalance || 0).toLocaleString()}
                    </td>
                  </tr>

                  {/* Transaction Rows */}
                  {ledgerResult.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="p-3 pl-4 text-slate-600 dark:text-slate-400">{row.date}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{row.voucherNumber}</td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                          {row.voucherType}
                        </span>
                      </td>
                      <td className="p-3 font-sans text-slate-800 dark:text-slate-200">
                        {row.narration}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                        {row.debit > 0 ? `Rs. ${(row.debit || 0).toLocaleString()}` : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                        {row.credit > 0 ? `Rs. ${(row.credit || 0).toLocaleString()}` : '-'}
                      </td>
                      <td className="p-3 text-right pr-4 font-black text-emerald-800 dark:text-emerald-300">
                        Rs. {(row.balance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Total Footer */}
                <tfoot className="bg-slate-100/70 dark:bg-slate-800/80 border-t-2 border-slate-300 dark:border-slate-700 font-mono font-bold text-xs">
                  <tr>
                    <td colSpan={4} className="p-3 pl-4 font-sans font-black uppercase text-slate-700 dark:text-slate-300">
                      Total Activity & Closing Balance
                    </td>
                    <td className="p-3 text-right text-slate-900 dark:text-white font-black">
                      Rs. {(ledgerResult.totalDebit || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right text-slate-900 dark:text-white font-black">
                      Rs. {(ledgerResult.totalCredit || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right pr-4 text-emerald-800 dark:text-emerald-300 font-black text-sm">
                      Rs. {(ledgerResult.closingBalance || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAILY CASHBOOK (OPENING & CLOSING BALANCES)                         */}
      {/* ========================================================================= */}
      {reportTab === 'cashbook' && (
        <div className="space-y-4">
          {/* Summary KPI Cards: Opening, Inflow, Outflow, Closing */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Opening Balance ({selectedSingleDate})
              </span>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
                Rs. {((dailyCashbookResult.openingCash || 0) + (dailyCashbookResult.openingBank || 0)).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Cash: Rs. {(dailyCashbookResult.openingCash || 0).toLocaleString()} • Bank: Rs. {(dailyCashbookResult.openingBank || 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Day Inflow (Receipts)
              </span>
              <div className="text-lg font-black font-mono text-emerald-800 dark:text-emerald-300 mt-1">
                + Rs. {(dailyCashbookResult.totalInflow || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {dailyCashbookResult.inflowEntries?.length || 0} Receipt(s)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-200 dark:border-red-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                Day Outflow (Disbursements)
              </span>
              <div className="text-lg font-black font-mono text-red-800 dark:text-red-300 mt-1">
                - Rs. {(dailyCashbookResult.totalOutflow || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {dailyCashbookResult.outflowEntries?.length || 0} Payment(s)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Closing Balance (End of Day)
              </span>
              <div className="text-lg font-black font-mono text-blue-800 dark:text-blue-300 mt-1">
                Rs. {((dailyCashbookResult.closingCash || 0) + (dailyCashbookResult.closingBank || 0)).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Cash: Rs. {(dailyCashbookResult.closingCash || 0).toLocaleString()} • Bank: Rs. {(dailyCashbookResult.closingBank || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Detailed Receipts & Payments for Date */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Receipts Column */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                  Cash & Bank Receipts (Inflow)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300">
                  Rs. {(dailyCashbookResult.totalInflow || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 divide-y divide-slate-100 dark:divide-slate-800">
                {dailyCashbookResult.inflowEntries?.length > 0 ? (
                  dailyCashbookResult.inflowEntries.map((e) => (
                    <div key={e.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {e.voucherNumber || e.id} - {e.description}
                        </div>
                        <div className="text-[10px] text-slate-500 capitalize">
                          Mode: {e.paymentMode || 'Cash'} • Category: {e.category}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        + Rs. {(e.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-xs text-slate-400">
                    No receipts recorded on {selectedSingleDate}
                  </p>
                )}
              </div>
            </div>

            {/* Payments Column */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 flex items-center justify-between">
                <span className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wider">
                  Cash & Bank Disbursements (Outflow)
                </span>
                <span className="text-xs font-mono font-bold text-red-800 dark:text-red-300">
                  Rs. {(dailyCashbookResult.totalOutflow || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 divide-y divide-slate-100 dark:divide-slate-800">
                {dailyCashbookResult.outflowEntries?.length > 0 ? (
                  dailyCashbookResult.outflowEntries.map((e) => (
                    <div key={e.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {e.voucherNumber || e.id} - {e.description}
                        </div>
                        <div className="text-[10px] text-slate-500 capitalize">
                          Mode: {e.paymentMode || 'Cash'} • Category: {e.category}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-red-600 dark:text-red-400">
                        - Rs. {(e.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-6 text-xs text-slate-400">
                    No disbursements recorded on {selectedSingleDate}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FINANCIAL STATEMENTS (TB, P&L, BALANCE SHEET, CASH FLOW)           */}
      {/* ========================================================================= */}
      {reportTab === 'financials' && (
        <div className="space-y-4">
          {/* Sub-selector for Financial Statement Type */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            {[
              { id: 'tb', label: 'Trial Balance' },
              { id: 'pl', label: 'Profit & Loss (P&L)' },
              { id: 'bs', label: 'Balance Sheet' },
              { id: 'cf', label: 'Cash Flow Statement' }
            ].map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setFinancialSubTab(sub.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  financialSubTab === sub.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {/* 3.1 TRIAL BALANCE */}
          {financialSubTab === 'tb' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Trial Balance as at {endDate}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Summary of ledger balances ensuring total debits equal total credits
                  </p>
                </div>
                {trialBalanceResult.isBalanced ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Trial Balance Balanced
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    Diff: Rs. {(trialBalanceResult.difference || 0).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 pl-4">Account Code</th>
                      <th className="p-3">Account Title</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Debit Balance (PKR)</th>
                      <th className="p-3 text-right pr-4">Credit Balance (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {trialBalanceResult.rows.map((row) => (
                      <tr key={row.accountId} className="hover:bg-slate-50/50">
                        <td className="p-3 pl-4 font-bold text-blue-700 dark:text-blue-400">
                          {row.code}
                        </td>
                        <td className="p-3 font-sans font-semibold text-slate-900 dark:text-white">
                          {row.name}
                        </td>
                        <td className="p-3 uppercase text-[10px] text-slate-500 font-bold">
                          {row.category}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                          {row.debitBalance > 0 ? `Rs. ${(row.debitBalance || 0).toLocaleString()}` : '-'}
                        </td>
                        <td className="p-3 text-right pr-4 font-bold text-slate-900 dark:text-white">
                          {row.creditBalance > 0 ? `Rs. ${(row.creditBalance || 0).toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-400 font-mono font-bold text-xs">
                    <tr>
                      <td colSpan={3} className="p-3 pl-4 font-sans font-black uppercase">
                        Grand Total
                      </td>
                      <td className="p-3 text-right font-black text-sm text-slate-900 dark:text-white">
                        Rs. {(trialBalanceResult.totalDebit || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-right pr-4 font-black text-sm text-slate-900 dark:text-white">
                        Rs. {(trialBalanceResult.totalCredit || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 3.2 PROFIT & LOSS */}
          {financialSubTab === 'pl' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-3xl space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Statement of Profit or Loss
                </h3>
                <p className="text-xs text-slate-500">
                  For the period {startDate} to {endDate}
                </p>
              </div>

              {/* Revenue */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Revenue & Turnover</span>
                  <span>Amount (PKR)</span>
                </div>
                {plResult.revenueItems.map((r, i) => (
                  <div key={i} className="flex justify-between text-xs font-mono py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-sans text-slate-800 dark:text-slate-200">{r.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      Rs. {(r.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold font-mono pt-1 text-emerald-700">
                  <span>Total Revenue:</span>
                  <span>Rs. {(plResult.totalRevenue || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* COGS & Gross Profit */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between text-xs font-mono py-1 text-slate-700 dark:text-slate-300">
                  <span className="font-sans font-semibold">Cost of Goods Sold (Procurement & Raw Materials):</span>
                  <span>Rs. {(plResult.costOfGoodsSold || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold font-mono py-2 bg-slate-50 dark:bg-slate-800/60 px-3 rounded-xl">
                  <span>Gross Profit:</span>
                  <span className="text-emerald-800 dark:text-emerald-300">
                    Rs. {(plResult.grossProfit || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Operating Expenses */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Operating Expenses</span>
                  <span>Amount (PKR)</span>
                </div>
                {plResult.expenseItems.map((e, i) => (
                  <div key={i} className="flex justify-between text-xs font-mono py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-sans text-slate-800 dark:text-slate-200">{e.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      Rs. {(e.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold font-mono pt-1 text-red-600">
                  <span>Total Operating Expenses:</span>
                  <span>Rs. {(plResult.totalExpenses || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Net Profit / Loss */}
              <div className="pt-4 border-t-2 border-slate-900 dark:border-white flex justify-between items-center">
                <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Net Operating Profit / (Loss):
                </span>
                <span
                  className={`text-xl font-black font-mono ${
                    (plResult.netProfit || 0) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'
                  }`}
                >
                  Rs. {(plResult.netProfit || 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* 3.3 BALANCE SHEET */}
          {financialSubTab === 'bs' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-3xl space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Balance Sheet
                  </h3>
                  <p className="text-xs text-slate-500">As at {endDate}</p>
                </div>
                {balanceSheetResult.isBalanced ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    Assets = Liabilities + Equity
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    Diff: Rs. {(balanceSheetResult.difference || 0).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Assets */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Assets (Current & Factory Plant)
                </h4>
                {balanceSheetResult.assets.map((a, i) => (
                  <div key={i} className="flex justify-between text-xs font-mono py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-sans text-slate-800 dark:text-slate-200">{a.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">Rs. {(a.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold font-mono pt-1 text-emerald-700">
                  <span>Total Assets:</span>
                  <span>Rs. {(balanceSheetResult.totalAssets || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Liabilities */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Liabilities & Payables
                </h4>
                {balanceSheetResult.liabilities.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs font-mono py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-sans text-slate-800 dark:text-slate-200">{l.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">Rs. {(l.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold font-mono pt-1 text-amber-700">
                  <span>Total Liabilities:</span>
                  <span>Rs. {(balanceSheetResult.totalLiabilities || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Equity */}
              <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Owner's Equity & Reserves
                </h4>
                {balanceSheetResult.equity.map((e, i) => (
                  <div key={i} className="flex justify-between text-xs font-mono py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-sans text-slate-800 dark:text-slate-200">{e.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">Rs. {(e.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold font-mono pt-1 text-blue-700">
                  <span>Total Equity:</span>
                  <span>Rs. {(balanceSheetResult.totalEquity || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Bottom Totals */}
              <div className="pt-4 border-t-2 border-slate-900 dark:border-white grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Assets</span>
                  <span className="text-lg font-black font-mono text-emerald-700">
                    Rs. {(balanceSheetResult.totalAssets || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Liabilities + Equity</span>
                  <span className="text-lg font-black font-mono text-blue-700">
                    Rs. {((balanceSheetResult.totalLiabilities || 0) + (balanceSheetResult.totalEquity || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3.4 CASH FLOW STATEMENT */}
          {financialSubTab === 'cf' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-3xl space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cash Flow Statement
                </h3>
                <p className="text-xs text-slate-500">Period: {startDate} to {endDate}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-mono py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-sans font-semibold">Cash Inflow from Operating Activities (Sales Receipts):</span>
                  <span className="font-bold text-emerald-700">+ Rs. {(cashFlowResult.operatingInflow || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-mono py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-sans font-semibold">Cash Outflow for Operations & Procurement:</span>
                  <span className="font-bold text-red-600">- Rs. {(cashFlowResult.operatingOutflow || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-mono py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-sans font-semibold">Net Cash from Financing Activities:</span>
                  <span className="font-bold text-slate-700">Rs. {(cashFlowResult.financingFlow || 0).toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t-2 border-slate-900 dark:border-white flex justify-between items-center">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    Net Increase / (Decrease) in Cash:
                  </span>
                  <span
                    className={`text-xl font-black font-mono ${
                      (cashFlowResult.netChangeInCash || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    Rs. {(cashFlowResult.netChangeInCash || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SALE & PURCHASE REPORTS (BY PERSON OR BY MATERIAL)                 */}
      {/* ========================================================================= */}
      {reportTab === 'sales_purchase' && (
        <div className="space-y-4">
          {/* Sub-controls: Sale vs Purchase, and By Person vs By Material */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Trade Mode Toggle */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTradeType('sale')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tradeType === 'sale'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Sales Report
              </button>
              <button
                type="button"
                onClick={() => setTradeType('purchase')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tradeType === 'purchase'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Purchase Report
              </button>
            </div>

            {/* Group By Toggle: By Person vs By Material */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setGroupBy('person')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  groupBy === 'person'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>By Person ({tradeType === 'sale' ? 'Customer' : 'Supplier'})</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('material')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  groupBy === 'material'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>By Material / Product</span>
              </button>
            </div>
          </div>

          {/* Trade KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total {tradeType === 'sale' ? 'Sales Revenue' : 'Procurement Value'}
              </span>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                Rs. {(tradeReportResult.totalAmount || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {tradeReportResult.totalTransactions || 0} Transaction(s) in selected period
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Tax / GST (18%)
              </span>
              <div className="text-xl font-black font-mono text-blue-700 dark:text-blue-400 mt-1">
                Rs. {(tradeReportResult.totalTax || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                FBR digital tax commitment
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Quantity Handled
              </span>
              <div className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {(tradeReportResult.totalQuantity || 0).toLocaleString()} Units
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Across all textile & raw material lots
              </div>
            </div>
          </div>

          {/* Trade Breakdown Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 pl-4">
                      {groupBy === 'person' ? 'Party Name (Client / Mill)' : 'Material / Product'}
                    </th>
                    <th className="p-3.5">Details</th>
                    <th className="p-3.5 text-right">Quantity</th>
                    <th className="p-3.5 text-right">Subtotal (PKR)</th>
                    <th className="p-3.5 text-right">Tax (PKR)</th>
                    <th className="p-3.5 text-right pr-4">Total Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {tradeReportResult.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="p-3.5 pl-4 font-sans font-bold text-slate-900 dark:text-white">
                        {row.name}
                      </td>
                      <td className="p-3.5 font-sans text-slate-500 text-[11px]">
                        {row.details || '-'}
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-900 dark:text-white">
                        {(row.quantity || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right text-slate-600 dark:text-slate-400">
                        Rs. {(row.subtotal || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right text-blue-700 dark:text-blue-400">
                        Rs. {(row.tax || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right pr-4 font-black text-slate-900 dark:text-white">
                        Rs. {(row.total || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-400 font-mono font-bold text-xs">
                  <tr>
                    <td colSpan={2} className="p-3.5 pl-4 font-sans font-black uppercase">
                      Total Summary
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900 dark:text-white">
                      {(tradeReportResult.totalQuantity || 0).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900 dark:text-white">
                      Rs. {((tradeReportResult.totalAmount || 0) - (tradeReportResult.totalTax || 0)).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-black text-blue-700 dark:text-blue-400">
                      Rs. {(tradeReportResult.totalTax || 0).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right pr-4 font-black text-emerald-800 dark:text-emerald-300 text-sm">
                      Rs. {(tradeReportResult.totalAmount || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
