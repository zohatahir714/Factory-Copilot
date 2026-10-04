import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { toolGetBusinessSummary, totalOutstandingReceivables } from '../lib/businessTools';
import { MonthlyTrendsChart } from './MonthlyTrendsChart';
import { FirstRunGuide } from './FirstRunGuide';
import AgentApprovalQueue from './AgentApprovalQueue';
import { AGENT_SKILLS, SKILL_CAPABILITIES, SKILL_COUNT } from '../agents/skills.ts';
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

/* Compact PKR for KPI tiles: lakh/crore notation keeps nine-figure ledgers
   inside their cards (standard Pakistani business formatting). */
const fmtPKR = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `Rs. ${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `Rs. ${(n / 1e5).toFixed(2)} L`;
  return `Rs. ${Math.round(n).toLocaleString()}`;
};

/* Shared KPI-card shell: borderless floating tile; whole card navigates.
   Polish: hover lifts with a wider shadow and a brighter machined ring. */
const kpiShell =
  'surface-card surface-card-hover active:scale-[0.99] group p-6 cursor-pointer flex flex-col hover:ring-1 hover:ring-indigo-200/70 dark:hover:ring-indigo-400/20';
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
    addToast,
    agentProposals,
    agentAudit,
    agentBusyId,
    approveAgentProposal,
    rejectAgentProposal
  } = useApp();

  const [isReloading, setIsReloading] = useState(false);

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

  // Total Outstanding Receivables — the SAME helper the copilot's business
  // summary uses. Reverted to the pre-existing behaviour on purpose: this KPI
  // had been changed to sum unpaid invoices, which left the dashboard reading
  // Rs. 7.79 L while the copilot read Rs. 0 for the same ledger. Whether the
  // customer balance field or the invoice ledger is the better source is a
  // product decision to make ONCE, deliberately — not by whichever caller was
  // last edited.
  const totalReceivables = totalOutstandingReceivables(customers);

  // Re-read the saved ledgers. Renamed from "Sync": `syncDatabase` reloads from
  // localStorage, so the old toast claiming data was "refreshed from database"
  // misdescribed what it does. It matters after a backup restore.
  const handleReload = () => {
    setIsReloading(true);
    syncDatabase();
    setTimeout(() => {
      setIsReloading(false);
      addToast('success', 'Ledgers reloaded', 'Products, orders, sales and cashbook re-read from saved storage.');
    }, 500);
  };

  return (
    <div className="space-y-7 pb-14 animate-fadeIn text-slate-900 dark:text-white">
      {/* Autonomous agent surface. Sits above everything so a proposal raised
          on its own is visible without the user going looking for it. */}
      <AgentApprovalQueue
        proposals={agentProposals}
        audit={agentAudit}
        onApprove={approveAgentProposal}
        onReject={rejectAgentProposal}
        busyId={agentBusyId}
      />

      {/* Workspace header: oversized display title, quiet meta, pill controls */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-5 pt-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
            {branding.companyName}
          </p>
          <h2 className="mt-1.5 text-3xl lg:text-[34px] leading-none font-bold font-display tracking-tighter text-slate-900 dark:text-white">
            Executive Overview
          </h2>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            Double-entry ledger · STA 1990 sales tax arithmetic · FBR-compliant payload export
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            disabled={isReloading}
            className="btn-ghost border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 disabled:opacity-60"
            title="Re-read products, orders, sales and cashbook from saved storage"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} />
            <span>{isReloading ? 'Reloading…' : 'Reload'}</span>
          </button>

          {/* REMOVED: the today / week / month / FY pill group.
              `timeFilter` was written, styled against, and then read by nothing
              else — not one KPI below was scoped by it. Clicking "month" left
              every number identical, so the control asserted a capability the
              dashboard did not have. A filter that visibly does nothing is worse
              than no filter, so it has been removed rather than shipped broken.
              The figures below are whole-ledger totals and are labelled as such. */}

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 stagger">

        {/* 01 · Revenue & GST invoices → Sales module (hero tile) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('sales')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('sales')}
          className={`${kpiShell} lg:col-span-2`}
          title="Open Sales & GST Ledger"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Revenue & Invoices
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">01</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[32px] xl:text-[40px] leading-none font-bold font-display tracking-tighter text-slate-900 dark:text-white" title={`Rs. ${totalSalesRevenue.toLocaleString()}`}>
              {fmtPKR(totalSalesRevenue)}
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
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <Wallet className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Cash & Bank
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">02</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[26px] xl:text-[30px] leading-none font-bold font-display tracking-tighter text-slate-900 dark:text-white">
              {fmtPKR(totalLiquidity)}
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
                <span className="font-mono text-emerald-700 dark:text-emerald-300">In Rs. {totalInflow.toLocaleString()}</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">Out Rs. {totalOutflow.toLocaleString()}</span>
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
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <Package className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Inventory
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">03</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[26px] xl:text-[30px] leading-none font-bold font-display tracking-tighter text-slate-900 dark:text-white">
              {fmtPKR(summary.totalInventoryValuePKR)}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">{products.length} SKUs tracked</span>
              {criticalItems.length > 0 ? (
                <span className="chip bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                  {criticalItems.length} below min
                </span>
              ) : (
                <span className="chip bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
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
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <ShoppingCart className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Pending Orders
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">04</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[26px] xl:text-[30px] leading-none font-bold font-display tracking-tighter text-slate-900 dark:text-white">
              {fmtPKR(committedPOValue)}
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
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <DollarSign className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              Receivables
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">05</span>
          </div>
          <div className="mt-auto pt-6">
            <p className="text-[26px] xl:text-[30px] leading-none font-bold font-display tracking-tighter text-slate-900 dark:text-white">
              {fmtPKR(totalReceivables)}
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">{customers.length} registered clients</span>
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Awaiting collection</span>
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
          className="surface-card surface-card-hover active:scale-[0.99] group p-6 cursor-pointer flex flex-col lg:col-span-6 lg:flex-row lg:items-center lg:gap-8 bg-gradient-to-br from-indigo-50/90 via-white to-white dark:from-indigo-950/30 dark:via-[#14151b] dark:to-[#14151b]"
          title="Open the grounded AI Copilot"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
              <Bot className="w-3.5 h-3.5" />
              AI Copilot
            </span>
            <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              {SKILL_COUNT} skills
            </span>
          </div>
          <div className="mt-auto pt-6 lg:pt-0 lg:flex-1 lg:mt-0">
            {/* THE SKILL LAYER, COUNTED FROM CODE.
                This card used to cycle three typed example prompts, two of them
                in quotes, as if the user had asked them. Nothing had: they were
                decoration — a hardcoded question about yarn stock sitting above
                a ledger it did not describe. Every line here is now derived
                from the registry in src/agents/skills.ts, which is the same
                table the copilot uses to decide which skill answers you. */}
            <div className="flex flex-wrap gap-1.5">
              {AGENT_SKILLS.slice(0, 6).map(skill => (
                <span
                  key={skill.id}
                  title={`${skill.does} (${skill.implementedIn})`}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-200/70 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                >
                  {skill.label}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-400">
              Voice or text — each answer is routed by intent and labelled with the skill that ran.
            </p>
            <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-white/5 flex items-center justify-between text-xs lg:mt-0 lg:border-t-0 lg:border-l lg:border-l-indigo-100 dark:lg:border-l-white/10 lg:pl-8 lg:shrink-0">
              <span className="text-indigo-600 dark:text-indigo-300">
                {SKILL_CAPABILITIES.join(' · ')}
              </span>
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
                  <span className="chip bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
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
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recent Sales Orders & GST Invoices</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dispatches included in the monthly Annexure-C export
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('sales')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 cursor-pointer"
          >
            View All Sales →
          </button>
        </div>

        <div className="mt-4 overflow-x-auto max-h-80 overflow-y-auto">
          <table className="data-table">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Material Supplied</th>
                <th className="py-2.5 px-3 text-right">Subtotal</th>
                <th className="py-2.5 px-3 text-right">GST</th>
                <th className="py-2.5 px-3 text-right">Grand Total</th>
                <th className="py-2.5 px-3 text-center">Fiscalisation</th>
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
                    {/* Was an unconditional green "Annex-C Ready" chip on every
                        row. Nothing computed it, so it claimed a filing state
                        for every invoice in the ledger. Fiscalisation happens
                        outside this application, so the honest reading is:
                        a fiscal invoice number exists, or it does not yet. */}
                    {so.fbrFiscalInvoiceNumber ? (
                      <span
                        className="chip bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                        title={`Fiscal invoice number ${so.fbrFiscalInvoiceNumber} recorded against this sale.`}
                      >
                        <FileCheck2 className="w-3 h-3" /> Fiscalised
                      </span>
                    ) : (
                      <span
                        className="chip bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                        title="No fiscal invoice number recorded. This sale has not been transmitted to FBR by your licensed integrator."
                      >
                        Not fiscalised
                      </span>
                    )}
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
