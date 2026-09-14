import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { toolGetBusinessSummary } from '../lib/businessTools';
import { MonthlyTrendsChart } from './MonthlyTrendsChart';
import { FirstRunGuide } from './FirstRunGuide';
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
    <span className="font-mono text-[13px] text-slate-600 dark:text-slate-300">
      {COPILOT_PROMPTS[idx].slice(0, len)}
      <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] bg-indigo-500 animate-pulse" />
    </span>
  );
};

/* Shared KPI-card shell: borderless floating tile; whole card navigates. */
const kpiShell =
  'surface-card surface-card-hover active:scale-[0.99] group p-6 cursor-pointer flex flex-col';
const viewLink = 'viewlink';

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
    <div className="space-y-7 pb-14 animate-fadeIn text-slate-900 dark:text-white">
      {/* Workspace header: oversized display title, quiet meta, pill controls */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-5 pt-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
            {branding.companyName}
          </p>
          <h2 className="mt-1.5 text-3xl lg:text-[34px] leading-none font-bold tracking-tighter text-slate-900 dark:text-white">
            Executive Overview
          </h2>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            Double-entry ledger · 18% GST · FBR Iris e-filing — live, reconciled
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncData}
            disabled={isSyncing}
            className="btn-ghost border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 disabled:opacity-60"
            title="Refresh trend charts & reload database state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
          </button>

          <div className="flex items-center bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 p-1 rounded-full text-xs font-semibold">
            {(['today', 'week', 'month', 'fy'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1 rounded-full capitalize transition-colors cursor-pointer ${
                  timeFilter === filter
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {filter === 'fy' ? 'FY 24-25' : filter}
              </button>
            ))}
          </div>

          <button
            onClick={() => openModal('voice')}
            className="btn-primary"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice command</span>
          </button>
        </div>
      </div>

      {/* First-run setup guide — renders only while the ledger is empty */}
      <FirstRunGuide />

      {/* Bento KPI canvas: revenue is the hero tile (double width); the five
          operational surfaces + AI copilot complete the 6-col rhythm.
          Interaction is indigo (one accent); color elsewhere is status only. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">

        {/* 01 · Revenue & GST invoices → Sales module (hero tile) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('sales')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('sales')}
          className={`${kpiShell} lg:col-span-2`}
          title="Open Sales & 18% GST Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Revenue & Invoices
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">01</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[38px] lg:text-[42px] leading-none font-bold font-mono tracking-tighter text-slate-900 dark:text-white">
              Rs. {totalSalesRevenue.toLocaleString()}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="font-mono text-slate-500 dark:text-slate-400">
                GST collected <span className="font-semibold text-slate-700 dark:text-slate-300">Rs. {totalGstCollected.toLocaleString()}</span>
              </span>
              <span className={viewLink}>
                {salesOrders.length} invoices <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* 02 · Cash & bank reserves → Cashbook module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('cashbook')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('cashbook')}
          className={kpiShell}
          title="Open Cashbook & Treasury Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <Wallet className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Cash & Bank
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">02</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[30px] leading-none font-bold font-mono tracking-tighter text-slate-900 dark:text-white">
              Rs. {totalLiquidity.toLocaleString()}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Cash in hand
                </span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">Rs. {cashInHand.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" /> Bank
                </span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">Rs. {bankBalance.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-emerald-600 dark:text-emerald-400">In Rs. {totalInflow.toLocaleString()}</span>
                <span className="font-mono text-slate-400 dark:text-slate-500">Out Rs. {totalOutflow.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 03 · Raw materials valuation → Inventory module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('inventory')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('inventory')}
          className={kpiShell}
          title="Open Raw Materials & Inventory Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <Package className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Inventory
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">03</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[30px] leading-none font-bold font-mono tracking-tighter text-slate-900 dark:text-white">
              Rs. {summary.totalInventoryValuePKR.toLocaleString()}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">{products.length} SKUs tracked</span>
              {criticalItems.length > 0 ? (
                <span className="chip bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                  {criticalItems.length} below min
                </span>
              ) : (
                <span className="chip bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  All optimal
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 04 · Procurement commitments → Purchase Orders module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('purchase')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('purchase')}
          className={kpiShell}
          title="Open Purchase Orders & Mill Procurement"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <ShoppingCart className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Procurement
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">04</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[30px] leading-none font-bold font-mono tracking-tighter text-slate-900 dark:text-white">
              Rs. {committedPOValue.toLocaleString()}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {pendingPOs.length} pending · {suppliers.length} vendors
              </span>
              <span className={viewLink}>View <ChevronRight className="w-3 h-3" /></span>
            </div>
          </div>
        </div>

        {/* 05 · Receivables → Customers module */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('customers')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('customers')}
          className={kpiShell}
          title="Open Customers Directory & Receivables"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <DollarSign className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Receivables
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-300 dark:text-slate-600">05</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[30px] leading-none font-bold font-mono tracking-tighter text-slate-900 dark:text-white">
              Rs. {totalReceivables.toLocaleString()}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">{customers.length} registered clients</span>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Awaiting collection</span>
            </div>
          </div>
        </div>

        {/* 06 · AI Copilot — the product's differentiator, above the fold.
            Indigo-tinted glass distinguishes the AI surface from data surfaces. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('copilot')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('copilot')}
          className="surface-card surface-card-hover active:scale-[0.99] group p-6 cursor-pointer flex flex-col bg-gradient-to-br from-indigo-50/90 via-white to-white dark:from-indigo-950/30 dark:via-[#14151b] dark:to-[#14151b]"
          title="Open the grounded AI Copilot"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-500/90 dark:text-indigo-400/90">
              <Bot className="w-3.5 h-3.5" />
              AI Copilot
            </span>
            <span className="font-mono text-[11px] font-semibold text-indigo-300 dark:text-indigo-700">06</span>
          </div>
          <div className="mt-auto pt-6">
            <CopilotTypewriter />
            <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-indigo-500/80 dark:text-indigo-400/70">Cited answers, never invented</span>
              <span className={viewLink}>Ask now <ChevronRight className="w-3 h-3" /></span>
            </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Critical Stock Radar with 1-Click Action */}
        <div className="surface-card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 flex items-center justify-center">
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

          <div className="mt-4 space-y-2.5">
            {criticalItems.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                All raw material stock levels are sustained above required safety margins.
              </div>
            ) : (
              criticalItems.map(p => (
                <div key={p.id} className="p-3.5 rounded-2xl bg-red-50/70 dark:bg-red-950/20 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      SKU: {p.sku} • In Stock: <span className="font-bold text-red-600 dark:text-red-400">{p.currentStock} {p.unit}</span> (Min: {p.reorderThreshold} {p.unit})
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openViewModal('product', p)}
                      className="p-2 rounded-full bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openModal('purchase')}
                      className="px-3.5 py-1.5 rounded-full bg-red-500 hover:bg-red-600 active:scale-[0.97] text-white font-semibold text-xs transition-all cursor-pointer"
                    >
                      Reorder PO
                    </button>
                  </div>
                </div>
              ))
            )}

            {/* Other active materials preview */}
            {products.filter(p => p.currentStock > p.reorderThreshold).slice(0, 3).map(p => (
              <div key={p.id} className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.04] flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</div>
                  <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    SKU: {p.sku} • Stock: {p.currentStock} {p.unit}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="chip bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
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
        <div className="surface-card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center">
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

          <div className="mt-4 space-y-2.5">
            {pendingPOs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
                No outstanding purchase orders currently pending delivery.
              </div>
            ) : (
              pendingPOs.map(po => (
                <div key={po.id} className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/15 flex items-center justify-between text-xs">
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
                      className="p-2 rounded-full bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="View PO Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => quickReceivePO(po.poNumber)}
                      className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-white font-semibold text-xs transition-all cursor-pointer"
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
      <div className="surface-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center">
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
              <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
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
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {salesOrders.slice(0, 5).map(so => (
                <tr key={so.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors">
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
                    <span className="chip bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <FileCheck2 className="w-3 h-3" /> Annex-C Ready
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => openViewModal('sale', so)}
                      className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
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
