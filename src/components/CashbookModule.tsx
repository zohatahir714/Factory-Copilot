import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Wallet,
  Building2,
  Receipt,
  Plus,
  Search,
  Filter,
  FileText,
  Printer,
  Edit3,
  Trash2,
  Eye,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  BookOpen,
  ArrowRight,
  Download,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { CashbookEntry, ChartOfAccount, VoucherType } from '../types';

export const CashbookModule: React.FC = () => {
  const {
    cashbook,
    accounts,
    cashInHand,
    bankBalance,
    totalLiquidity,
    openModal,
    openViewModal,
    openEditModal,
    openDeleteModal,
    openPrintDocument,
    setActiveTab,
    currentUser,
    addToast
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'vouchers' | 'coa' | 'quick_entry'>('vouchers');
  const [searchTerm, setSearchTerm] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('all');
  const [coaCategoryFilter, setCoaCategoryFilter] = useState<string>('all');

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return cashbook.filter((entry) => {
      const matchesSearch =
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.voucherNumber && entry.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.chequeNumber && entry.chequeNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        entry.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        voucherTypeFilter === 'all'
          ? true
          : entry.voucherType === voucherTypeFilter ||
            (voucherTypeFilter === 'inflow' && entry.type === 'inflow') ||
            (voucherTypeFilter === 'outflow' && entry.type === 'outflow');

      return matchesSearch && matchesType;
    });
  }, [cashbook, searchTerm, voucherTypeFilter]);

  // Filtered Chart of Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchesSearch =
        acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.type.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        coaCategoryFilter === 'all' ? true : acc.category === coaCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [accounts, searchTerm, coaCategoryFilter]);

  // Format voucher badge
  const getVoucherBadge = (type?: VoucherType, flow?: 'inflow' | 'outflow') => {
    if (type === 'CRV') {
      return <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-bold">CRV (Cash Receipt)</span>;
    }
    if (type === 'CPV') {
      return <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 font-mono text-xs font-bold">CPV (Cash Payment)</span>;
    }
    if (type === 'BRV') {
      return <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-mono text-xs font-bold">BRV (Bank Receipt)</span>;
    }
    if (type === 'BPV') {
      return <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-mono text-xs font-bold">BPV (Bank Payment)</span>;
    }
    if (type === 'JV') {
      return <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-mono text-xs font-bold">JV (Journal Voucher)</span>;
    }
    return flow === 'inflow' ? (
      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-xs font-bold">Receipt</span>
    ) : (
      <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-mono text-xs font-bold">Payment</span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Quick Financial Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 surface-card p-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Cashbook, Vouchers & Treasury
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Double-entry voucher system, integrated Chart of Accounts & live liquid reserves
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Most Important General Ledger Button */}
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>General Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => openModal('expense')}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Post New Voucher</span>
          </button>

          <button
            type="button"
            onClick={() => openModal('account')}
            className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account Head</span>
          </button>
        </div>
      </div>

      {/* 3 Real-time Treasury Liquidity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cash in Hand */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Cash in Hand (Drawer)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300">
              Rs. {(cashInHand || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Main Cash (Head 1001) available for immediate disbursements
            </p>
          </div>
        </div>

        {/* Bank Balance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Bank Balance (All Accounts)
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-indigo-800 dark:text-indigo-300">
              Rs. {(bankBalance || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Aggregated across Meezan Bank, HBL & Allied Bank
            </p>
          </div>
        </div>

        {/* Total Liquid Capital */}
        <div className="surface-card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Liquid Reserves
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              Rs. {(totalLiquidity || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Combined liquidity across {cashbook.length} audited vouchers
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('vouchers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'vouchers'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Vouchers Ledger ({cashbook.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('coa')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'coa'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Chart of Accounts ({accounts.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: VOUCHERS LEDGER */}
      {activeSubTab === 'vouchers' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80 dark:bg-white/[0.04] p-4 rounded-2xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by voucher #, cheque, narration..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
              />
            </div>

            {/* Voucher Type Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {[
                { id: 'all', label: 'All Vouchers' },
                { id: 'CRV', label: 'CRV (Cash Rec)' },
                { id: 'CPV', label: 'CPV (Cash Pay)' },
                { id: 'BRV', label: 'BRV (Bank Rec)' },
                { id: 'BPV', label: 'BPV (Bank Pay)' },
                { id: 'JV', label: 'JV (Journal)' }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setVoucherTypeFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    voucherTypeFilter === pill.id
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-transparent dark:border-white/10 shadow-[0_1px_2px_rgba(17,20,45,0.04),0_10px_28px_-14px_rgba(17,20,45,0.10)] dark:shadow-none overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 pl-4">Voucher #</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Payment Mode & Ref</th>
                    <th className="p-3.5">Account / Narration</th>
                    <th className="p-3.5 text-right">Amount (PKR)</th>
                    <th className="p-3.5 text-center">Entries</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVouchers.length > 0 ? (
                    filteredVouchers.map((entry) => {
                      const isMulti = Boolean(entry.entries && entry.entries.length > 0);
                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-3.5 pl-4 font-mono font-bold text-slate-900 dark:text-white">
                            {entry.voucherNumber || entry.id}
                          </td>
                          <td className="p-3.5">
                            {getVoucherBadge(entry.voucherType, entry.type)}
                          </td>
                          <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                            {new Date(entry.createdAt).toLocaleDateString('en-PK', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="p-3.5">
                            <div className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                              {entry.paymentMode || (entry.category === 'cash' ? 'Cash' : 'Bank')}
                            </div>
                            {entry.chequeNumber && (
                              <div className="text-[10px] font-mono text-slate-500">
                                Chq: {entry.chequeNumber}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 max-w-xs">
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {entry.description}
                            </div>
                            <div className="text-[10px] text-slate-500 capitalize">
                              Head: {entry.category?.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold">
                            <span
                              className={
                                entry.type === 'inflow'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }
                            >
                              {entry.type === 'inflow' ? '+' : '-'} Rs.{' '}
                              {(entry.amount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {isMulti ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                {entry.entries?.length} rows
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">Single</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              {/* View Voucher */}
                              <button
                                type="button"
                                onClick={() => openViewModal('cashbook', entry)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="View Voucher Breakdown"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Print / PDF Generation */}
                              <button
                                type="button"
                                onClick={() => openPrintDocument({ type: 'cash_voucher', data: entry })}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors cursor-pointer"
                                title="Print / Download PDF Voucher"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Edit Voucher */}
                              <button
                                type="button"
                                onClick={() => openEditModal('cashbook', entry)}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors cursor-pointer"
                                title="Edit Voucher"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Delete Voucher */}
                              <button
                                type="button"
                                onClick={() => openDeleteModal('cashbook', entry.id, entry.voucherNumber || entry.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                title="Delete Voucher"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No vouchers match the selected criteria. Click "Post New Voucher" to record transactions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CHART OF ACCOUNTS */}
      {activeSubTab === 'coa' && (
        <div className="space-y-4">
          {/* CoA Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80 dark:bg-white/[0.04] p-4 rounded-2xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Chart of Accounts (code or name)..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
              />
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {[
                { id: 'all', label: 'All Categories' },
                { id: 'asset', label: 'Assets (1000)' },
                { id: 'liability', label: 'Liabilities (2000)' },
                { id: 'equity', label: 'Equity (3000)' },
                { id: 'revenue', label: 'Revenue (4000)' },
                { id: 'expense', label: 'Expenses (5000)' }
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setCoaCategoryFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    coaCategoryFilter === pill.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accounts Grid / Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-transparent dark:border-white/10 shadow-[0_1px_2px_rgba(17,20,45,0.04),0_10px_28px_-14px_rgba(17,20,45,0.10)] dark:shadow-none overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5 pl-4">Account Code</th>
                    <th className="p-3.5">Account Head Title</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Sub-Classification</th>
                    <th className="p-3.5 text-right">Opening Balance</th>
                    <th className="p-3.5 text-right">Current Balance</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAccounts.map((acc) => (
                    <tr
                      key={acc.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3.5 pl-4 font-mono font-black text-indigo-700 dark:text-indigo-400">
                        {acc.code}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">{acc.name}</div>
                        {acc.description && (
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                            (acc.category || acc.type || '').toLowerCase() === 'asset'
                              ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                              : (acc.category || acc.type || '').toLowerCase() === 'liability'
                              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                              : (acc.category || acc.type || '').toLowerCase() === 'equity'
                              ? 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300'
                              : (acc.category || acc.type || '').toLowerCase() === 'revenue'
                              ? 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300'
                              : 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {acc.category || acc.type}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">{acc.type}</td>
                      <td className="p-3.5 text-right font-mono text-slate-500">
                        Rs. {(acc.openingBalance || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        Rs. {(acc.currentBalance ?? acc.openingBalance ?? 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center">
                        {acc.isSystem ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                            System
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            Custom
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal('account', acc)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Account Head"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {!acc.isSystem && (
                            <button
                              type="button"
                              onClick={() => openDeleteModal('account', acc.id, `${acc.code} - ${acc.name}`)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                              title="Delete Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
