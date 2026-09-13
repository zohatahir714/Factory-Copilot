import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { toolGetBusinessSummary } from '../lib/businessTools';
import { MonthlyTrendsChart } from './MonthlyTrendsChart';
import {
  TrendingUp,
  Wallet,
  Package,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Mic,
  Plus,
  Clock,
  ChevronRight,
  FileCheck2,
  Building2,
  DollarSign,
  Eye,
  Settings,
  RefreshCw
} from 'lucide-react';

export const ExecutiveDashboard: React.FC = () => {
  const {
    products,
    suppliers,
    customers,
    purchaseOrders,
    salesOrders,
    cashbook,
    cashInHand,
    bankBalance,
    totalLiquidity,
    inventoryMovements,
    complianceSources,
    openModal,
    setActiveTab,
    quickReceivePO,
    openViewModal,
    branding,
    syncDatabase,
    addToast
  } = useApp();

  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'fy'>('today');
  const [isSyncing, setIsSyncing] = useState(false);

  // Business summary metrics
  const summary = toolGetBusinessSummary({
    products,
    suppliers,
    customers,
    purchaseOrders,
    salesOrders,
    cashbook,
    inventoryMovements,
    complianceSources
  });

  const totalInflow = cashbook.filter(c => c.type === 'inflow').reduce((sum, c) => sum + c.amount, 0);
  const totalOutflow = cashbook.filter(c => c.type === 'outflow').reduce((sum, c) => sum + c.amount, 0);
  const netCash = totalInflow - totalOutflow;

  const totalGstCollected = salesOrders.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
  const totalSalesRevenue = salesOrders.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  // Critical items below reorder threshold
  const criticalItems = products.filter(p => p.currentStock <= p.reorderThreshold);

  // Pending POs
  const pendingPOs = purchaseOrders.filter(p => p.status === 'pending');
  const committedPOValue = pendingPOs.reduce((sum, p) => sum + p.totalAmount, 0);

  // Total Outstanding Receivables
  const totalReceivables = customers.reduce((sum, c) => sum + c.outstandingReceivables, 0);

  // Trigger sync of database and refresh chart data
  const handleSyncData = () => {
    setIsSyncing(true);
    syncDatabase();
    setTimeout(() => {
      setIsSyncing(false);
      addToast('success', 'Data Synchronized', 'Visualized trend charts and ledger state refreshed from database.');
    }, 750);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn text-slate-900 dark:text-white">
      {/* Top Banner / Aligned Header Actions & Time Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Executive Manufacturing & Compliance Command
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[11px] font-bold">
              RAG Grounded
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {branding.companyName} • Deterministic 18% GST & FBR Iris E-Filing
          </p>
        </div>

        {/* Timeframe selector pills & quick actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sync Data Button with spinning animation */}
          <button
            type="button"
            onClick={handleSyncData}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60"
            title="Refresh trend charts & reload database state"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          {/* Timeframe filter pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold border border-slate-200/60 dark:border-slate-700">
            {(['today', 'week', 'month', 'fy'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                  timeFilter === filter
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {filter === 'fy' ? 'FY 24-25' : filter}
              </button>
            ))}
          </div>

          {/* Quick Voice Trigger */}
          <button
            onClick={() => openModal('voice')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Command</span>
          </button>
        </div>
      </div>

      {/* KPI Bento Grid: 6 Critical Operational Cards (Clickable & Enhanced) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Revenue & Tax Invoices */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('sales')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('sales')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          title="Click to open Sales & 18% GST Ledger"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Revenue & Invoices
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  View Module <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                Rs. {totalSalesRevenue.toLocaleString()}
              </span>
              {salesOrders.length > 0 && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                  <ArrowUpRight className="w-3.5 h-3.5" /> {salesOrders.length} {salesOrders.length === 1 ? 'Invoice' : 'Invoices'}
                </span>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>{salesOrders.length} Invoices Issued</span>
              <span className="text-purple-700 dark:text-purple-400 font-semibold font-mono">
                GST: Rs. {totalGstCollected.toLocaleString()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openModal('sale');
            }}
            className="mt-3 w-full py-1.5 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record New Sale (18% GST)</span>
          </button>
        </div>

        {/* Card 3: Cashbook Reserves & Liquidity */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('cashbook')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('cashbook')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          title="Click to open Cashbook & Treasury Ledger"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Net Cash & Bank Reserves
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  View Module <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                Rs. {totalLiquidity.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Reserves</span>
            </div>
            {/* Live Dual Treasury Breakdown: Cash in Hand & Bank Balance */}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Cash in Hand</p>
                <p className="text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-300 mt-0.5">
                  Rs. {cashInHand.toLocaleString()}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Bank Balance</p>
                <p className="text-xs font-mono font-extrabold text-blue-800 dark:text-blue-300 mt-0.5">
                  Rs. {bankBalance.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">In: Rs. {totalInflow.toLocaleString()}</span>
              <span className="text-red-600 dark:text-red-400 font-semibold">Out: Rs. {totalOutflow.toLocaleString()}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openModal('expense');
            }}
            className="mt-3 w-full py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post Voucher (CRV/CPV/JV)</span>
          </button>
        </div>

        {/* Card 4: Factory Inventory Health */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('inventory')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('inventory')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-lg hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          title="Click to open Raw Materials & Inventory Ledger"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Raw Materials Valuation
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  View Module <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Package className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                Rs. {summary.totalInventoryValuePKR.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{products.length} SKUs</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Critical Reorder Alert:</span>
              <span className={`font-bold font-mono px-2 py-0.5 rounded-full ${criticalItems.length > 0 ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400'}`}>
                {criticalItems.length} Items Low
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openModal('product');
            }}
            className="mt-3 w-full py-1.5 px-3 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 dark:hover:text-white text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Raw Material / SKU</span>
          </button>
        </div>

        {/* Card 5: Procurement & Active POs */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('purchase')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('purchase')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-lg hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          title="Click to open Purchase Orders & Mill Procurement"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Procurement & Vendor POs
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  View Module <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                Rs. {committedPOValue.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                {pendingPOs.length} Pending Delivery
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Suppliers Active:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{suppliers.length} Mills</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openModal('purchase');
            }}
            className="mt-3 w-full py-1.5 px-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Issue Purchase Order</span>
          </button>
        </div>

        {/* Card 6: Customer Receivables & Working Capital */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('customers')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('customers')}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-sky-500 dark:hover:border-sky-500 hover:shadow-lg hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          title="Click to open Customers Directory & Receivables"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Accounts Receivable
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                  View Module <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                Rs. {totalReceivables.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center">
                Awaiting Collection
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Primary Debtors:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{customers.length} Registered Clients</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openModal('customer');
            }}
            className="mt-3 w-full py-1.5 px-3 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-600 hover:text-white dark:hover:bg-sky-600 dark:hover:text-white text-sky-800 dark:text-sky-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register New Client</span>
          </button>
        </div>
      </div>

      {/* Monthly Purchase & Sales Volume Trends (Visual Trend Engine) */}
      <MonthlyTrendsChart
        salesOrders={salesOrders}
        purchaseOrders={purchaseOrders}
        onOpenCompliance={() => openModal('compliance')}
      />

      {/* Two-Column Operational Core: Low Stock Radar & Pending Procurement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Critical Stock Radar with 1-Click Action */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Low Stock Reorder Radar</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Materials breaching safety threshold</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
            >
              Full Inventory →
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {criticalItems.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                All raw material stock levels are sustained above required safety margins.
              </div>
            ) : (
              criticalItems.map(p => (
                <div key={p.id} className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      SKU: {p.sku} • In Stock: <span className="font-bold text-red-700 dark:text-red-400">{p.currentStock} {p.unit}</span> (Min: {p.reorderThreshold} {p.unit})
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openViewModal('product', p)}
                      className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openModal('purchase')}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Reorder PO
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Other active materials preview */}
            {products.filter(p => p.currentStock > p.reorderThreshold).slice(0, 3).map(p => (
              <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</div>
                  <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    SKU: {p.sku} • Stock: {p.currentStock} {p.unit}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 rounded font-mono font-bold text-[10px]">
                    Optimal
                  </span>
                  <button
                    onClick={() => openViewModal('product', p)}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Pending Procurement POs awaiting delivery */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Pending Purchase Orders</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Awaiting vendor factory delivery</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('purchase')}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 cursor-pointer"
            >
              All POs →
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {pendingPOs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                No outstanding purchase orders currently pending delivery.
              </div>
            ) : (
              pendingPOs.map(po => (
                <div key={po.id} className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{po.poNumber}</span>
                      <span className="font-semibold text-amber-900 dark:text-amber-300">{po.supplierName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      Committed: Rs. {po.totalAmount.toLocaleString()} • {po.items[0]?.quantity} {po.items[0]?.unit} {po.items[0]?.productName}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openViewModal('po', po)}
                      className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer"
                      title="View PO Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => quickReceivePO(po.poNumber)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                      title="Click to record goods arrival and restock warehouse"
                    >
                      Receive Goods
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Dispatched Sales & Tax Invoices */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recent Sales Orders & 18% GST Invoices</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Annexure-C e-filing compliant sales dispatches</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('sales')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
          >
            View All Sales →
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Material Supplied</th>
                <th className="py-2.5 px-3 text-right">Subtotal</th>
                <th className="py-2.5 px-3 text-right">18% GST</th>
                <th className="py-2.5 px-3 text-right">Grand Total</th>
                <th className="py-2.5 px-3 text-center">FBR Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {salesOrders.slice(0, 5).map(so => (
                <tr key={so.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{so.invoiceNumber}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{so.customerName}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    {so.items[0]?.quantity} {so.items[0]?.unit} {so.items[0]?.productName}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                    Rs. {(so.subtotal ?? Math.round((so.totalAmount || 0) / 1.18)).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-purple-700 dark:text-purple-400">
                    Rs. {(so.taxAmount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                    Rs. {(so.totalAmount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 text-[10px] font-bold">
                      <FileCheck2 className="w-3 h-3" /> Annex-C Ready
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => openViewModal('sale', so)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
