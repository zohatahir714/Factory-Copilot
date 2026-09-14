import React, { useState, useEffect } from 'react';
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
  Mic,
  ChevronRight,
  FileCheck2,
  DollarSign,
  Eye,
  RefreshCw,
  Bot
} from 'lucide-react';

/* Perpetual micro-interaction (design-taste §9 · Command Input): the copilot card
   cycles real example prompts with a blinking caret. Isolated mini-component so
   the timer never re-renders the dashboard; disabled for reduced-motion users. */
const COPILOT_PROMPTS = [
  '"Yarn ka stock kitna hai?"',
  '"Create a PO for 200 kg yarn"',
  '"What is the Section 153 tax rate?"'
];

const CopilotTypewriter: React.FC = () => {
  const [idx, setIdx] = useState(0);
  const [len, setLen] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLen(COPILOT_PROMPTS[0].length);
      return;
    }
    const full = COPILOT_PROMPTS[idx].length;
    const t = setTimeout(() => {
      if (dir === 1) {
        if (len < full) setLen(l => l + 1);
        else setDir(-1);
      } else {
        if (len > 0) setLen(l => l - 1);
        else {
          setDir(1);
          setIdx(i => (i + 1) % COPILOT_PROMPTS.length);
        }
      }
    }, dir === 1 ? (len < full ? 45 : 1600) : 22);
    return () => clearTimeout(t);
  }, [idx, len, dir]);

  return (
    <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
      {COPILOT_PROMPTS[idx].slice(0, len)}
      <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] bg-indigo-500 animate-pulse" />
    </span>
  );
};

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
      addToast('success', 'Data Synchronized', 'Trend charts and ledger state refreshed from database.');
    }, 750);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn text-slate-900 dark:text-white">
      {/* Workspace header: identity + controls on one line */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Executive Overview
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
              FBR Annexure-C Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {branding.companyName} · Double-entry ledger · 18% GST · FBR Iris e-filing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncData}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            title="Refresh trend charts & reload database state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing…' : 'Sync data'}</span>
          </button>

          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-1 rounded-xl text-xs font-semibold">
            {(['today', 'week', 'month', 'fy'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                  timeFilter === filter
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {filter === 'fy' ? 'FY 24-25' : filter}
              </button>
            ))}
          </div>

          <button
            onClick={() => openModal('voice')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice command</span>
          </button>
        </div>
      </div>

      {/* KPI grid: five operational entry points + the AI Copilot card.
          Interaction is indigo (one accent); color elsewhere is status only. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* 01 · Revenue & GST invoices → Sales module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('sales')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('sales')}
          className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-100/70 dark:hover:shadow-none hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
          title="Open Sales & 18% GST Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">01</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Revenue & Invoices
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              Rs. {totalSalesRevenue.toLocaleString()}
            </span>
            {salesOrders.length > 0 && (
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center">
                <ArrowUpRight className="w-3 h-3" /> {salesOrders.length}
              </span>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="font-mono text-slate-500 dark:text-slate-400">
              GST Rs. {totalGstCollected.toLocaleString()}
            </span>
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-60 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
              View module <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 02 · Cash & bank reserves → Cashbook module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('cashbook')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('cashbook')}
          className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-100/70 dark:hover:shadow-none hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
          title="Open Cashbook & Treasury Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">02</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cash & Bank Reserves
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              Rs. {totalLiquidity.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400/80">Cash in hand</p>
                <p className="text-xs font-mono font-semibold text-emerald-800 dark:text-emerald-300 mt-0.5">
                  Rs. {cashInHand.toLocaleString()}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Bank balance</p>
                <p className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                  Rs. {bankBalance.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
              <span className="text-emerald-600 dark:text-emerald-400">In Rs. {totalInflow.toLocaleString()}</span>
              <span className="text-slate-400 dark:text-slate-500">Out Rs. {totalOutflow.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 03 · Raw materials valuation → Inventory module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('inventory')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('inventory')}
          className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-100/70 dark:hover:shadow-none hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
          title="Open Raw Materials & Inventory Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">03</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Raw Materials Valuation
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              Rs. {summary.totalInventoryValuePKR.toLocaleString()}
            </span>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{products.length} SKUs</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Reorder alerts</span>
            {criticalItems.length > 0 ? (
              <span className="font-mono font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                {criticalItems.length} low
              </span>
            ) : (
              <span className="font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                All optimal
              </span>
            )}
          </div>
        </div>

        {/* 04 · Procurement commitments → Purchase Orders module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('purchase')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('purchase')}
          className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-100/70 dark:hover:shadow-none hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
          title="Open Purchase Orders & Mill Procurement"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">04</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Procurement Committed
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              Rs. {committedPOValue.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {pendingPOs.length} pending · {suppliers.length} suppliers
            </span>
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-60 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
              View module <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* 05 · Receivables → Customers module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('customers')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('customers')}
          className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-100/70 dark:hover:shadow-none hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
          title="Open Customers Directory & Receivables"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">05</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Accounts Receivable
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              Rs. {totalReceivables.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">{customers.length} registered clients</span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400/90">Awaiting collection</span>
          </div>
        </div>

        {/* 06 · AI Copilot — the product's differentiator, above the fold.
            Tinted card distinguishes the AI surface from the five data surfaces. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('copilot')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('copilot')}
          className="group bg-indigo-50/60 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200/70 dark:border-indigo-800/50 p-5 hover:border-indigo-300 dark:hover:border-indigo-500/70 hover:shadow-lg hover:shadow-indigo-100/70 dark:hover:shadow-none hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer flex flex-col"
          title="Open the grounded AI Copilot"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold text-indigo-300 dark:text-indigo-600">06</span>
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800/50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-colors duration-200">
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-indigo-500/80 dark:text-indigo-400/80">
            AI Copilot · RAG Grounded
          </p>
          <div className="mt-2 flex-1 flex items-center">
            <CopilotTypewriter />
          </div>
          <div className="mt-3 pt-3 border-t border-indigo-200/50 dark:border-indigo-800/40 flex items-center justify-between text-xs">
            <span className="text-indigo-500/70 dark:text-indigo-400/70">Cited answers, never invented</span>
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-60 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
              Ask now <ChevronRight className="w-3 h-3" />
            </span>
          </div>
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
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Low Stock Reorder Radar</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Materials breaching safety threshold</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
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
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer"
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
                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded font-mono font-semibold text-[10px]">
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
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Pending Purchase Orders</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Awaiting vendor factory delivery</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('purchase')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
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
                <div key={po.id} className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{po.poNumber}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{po.supplierName}</span>
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
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer"
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
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recent Sales Orders & 18% GST Invoices</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Annexure-C e-filing compliant sales dispatches</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('sales')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
          >
            View All Sales →
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
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
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-600 dark:text-slate-400">
                    Rs. {(so.taxAmount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                    Rs. {(so.totalAmount ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
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
