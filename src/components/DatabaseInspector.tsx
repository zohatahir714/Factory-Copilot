import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package,
  ShoppingCart,
  Receipt,
  Wallet,
  Scale,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  FileCheck2,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Eye,
  Edit3,
  Trash2,
  ExternalLink,
  History,
  Printer,
  Building2,
  Users,
  Phone,
  Mail
} from 'lucide-react';

export const DatabaseInspector: React.FC = () => {
  const {
    activeTab,
    products,
    suppliers,
    customers,
    purchaseOrders,
    salesOrders,
    cashbook,
    complianceSources,
    inventoryMovements,
    quickReceivePO,
    openModal,
    openViewModal,
    openEditModal,
    openDeleteModal,
    openPrintDocument,
    currentUser
  } = useApp();

  const [tableFilter, setTableFilter] = useState('');

  const q = tableFilter.toLowerCase().trim();

  return (
    <div className="flex-1 bg-slate-50 p-4 md:p-6 overflow-y-auto">
      {/* 1. INVENTORY VIEW */}
      {activeTab === 'inventory' && (
        <div className="space-y-4 max-w-6xl mx-auto animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                    Raw Materials & Products Ledger
                  </h2>
                  <p className="text-xs text-slate-500">
                    Real-time stock valuation, unit pricing, and safety reorder thresholds
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter materials / SKU..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => openPrintDocument({ type: 'inventory_report', data: products })}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Print Stock Valuation Report"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Print Stock Report</span>
              </button>
              <button
                onClick={() => openModal('product')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Material / SKU</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">SKU Code</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Threshold</th>
                    <th className="py-3 px-4 text-right">Cost (PKR)</th>
                    <th className="py-3 px-4 text-right">Selling (PKR)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {products
                    .filter(p => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
                    .map((p) => {
                      const isLow = p.currentStock <= p.reorderThreshold;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">{p.sku}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                          <td className="py-3 px-4 text-slate-500">{p.category}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {p.currentStock.toLocaleString()} {p.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            {p.reorderThreshold} {p.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            Rs. {p.costPrice.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            Rs. {p.sellingPrice.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Optimal
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openViewModal('product', p)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openPrintDocument({ type: 'inventory_report', data: [p] })}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                                title="Print Material Spec Sheet"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal('product', p)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-colors cursor-pointer"
                                title="Edit Product"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {currentUser?.permissions?.canDeleteRecords && (
                                <button
                                  type="button"
                                  onClick={() => openDeleteModal('product', p.id, `${p.name} (${p.sku})`)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 transition-colors cursor-pointer"
                                  title="Delete Product (Super Admin)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PURCHASE ORDERS VIEW */}
      {activeTab === 'purchase' && (
        <div className="space-y-4 max-w-6xl mx-auto animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                    Purchase Orders & Procurement
                  </h2>
                  <p className="text-xs text-slate-500">
                    Supplier POs, committed expenditure, and receiving bay
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter POs..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white outline-none"
                />
              </div>
              <button
                onClick={() => openModal('purchase')}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Issue Purchase Order</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Ordered Items</th>
                    <th className="py-3 px-4 text-right">Committed Value (PKR)</th>
                    <th className="py-3 px-4">Date Issued</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {purchaseOrders
                    .filter(po => !q || po.poNumber.toLowerCase().includes(q) || po.supplierName.toLowerCase().includes(q))
                    .map((po) => {
                      const isPending = po.status === 'pending';
                      return (
                        <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">{po.poNumber}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{po.supplierName}</td>
                          <td className="py-3 px-4">
                            {po.items.map((it, idx) => (
                              <div key={idx} className="font-medium text-slate-800">
                                {it.quantity} {it.unit} • {it.productName}
                              </div>
                            ))}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            Rs. {po.totalAmount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                Pending Delivery
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Received
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => quickReceivePO(po.poNumber)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-colors cursor-pointer shadow-xs"
                                  title="Receive Goods"
                                >
                                  Receive
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openViewModal('po', po)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
                                title="View PO Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openPrintDocument({ type: 'purchase_order', data: po })}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
                                title="Print Official Purchase Order"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal('po', po)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-colors cursor-pointer"
                                title="Edit PO"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {currentUser?.permissions?.canDeleteRecords && (
                                <button
                                  type="button"
                                  onClick={() => openDeleteModal('po', po.id, `${po.poNumber} (${po.supplierName})`)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 transition-colors cursor-pointer"
                                  title="Delete PO (Super Admin)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. SALES & INVOICES VIEW */}
      {activeTab === 'sales' && (
        <div className="space-y-4 max-w-6xl mx-auto animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                    Sales Orders & FBR Tax Invoices
                  </h2>
                  <p className="text-xs text-slate-500">
                    FBR Sales Tax Act 1990 Section 3(1) deterministic 18% GST invoices
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter invoices..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white outline-none"
                />
              </div>
              <button
                onClick={() => openModal('sale')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record Sale & 18% GST</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Dispatched Items</th>
                    <th className="py-3 px-4 text-right">Subtotal (PKR)</th>
                    <th className="py-3 px-4 text-right">18% GST (PKR)</th>
                    <th className="py-3 px-4 text-right">Grand Total (PKR)</th>
                    <th className="py-3 px-4 text-center">FBR Iris Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {salesOrders
                    .filter(so => !q || so.invoiceNumber.toLowerCase().includes(q) || so.customerName.toLowerCase().includes(q))
                    .map((so) => (
                      <tr key={so.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">{so.invoiceNumber}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{so.customerName}</td>
                        <td className="py-3 px-4">
                          {so.items.map((it, idx) => (
                            <div key={idx} className="font-medium text-slate-800">
                              {it.quantity} {it.unit} • {it.productName}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          Rs. {(so.subtotal ?? Math.round((so.totalAmount || 0) / 1.18)).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                          Rs. {(so.taxAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          Rs. {(so.totalAmount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FileCheck2 className="w-3 h-3" /> Annex-C Ready
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openViewModal('sale', so)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
                              title="Inspect Tax Invoice"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openPrintDocument({ type: 'invoice', data: so })}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
                              title="Print FBR Tax Invoice (Annex-C)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal('sale', so)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-colors cursor-pointer"
                              title="Edit Status"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {currentUser?.permissions?.canDeleteRecords && (
                              <button
                                type="button"
                                onClick={() => openDeleteModal('sale', so.id, `${so.invoiceNumber} (${so.customerName})`)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 transition-colors cursor-pointer"
                                title="Delete Invoice (Super Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* 4. CASHBOOK & DISBURSEMENTS VIEW */}
      {activeTab === 'cashbook' && (
        <div className="space-y-4 max-w-6xl mx-auto animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                    Cashbook & Treasury Ledger
                  </h2>
                  <p className="text-xs text-slate-500">
                    Factory operating expenses, payroll wages, and bank collections
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter vouchers..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white outline-none"
                />
              </div>
              <button
                onClick={() => openModal('expense')}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Post Cash Entry</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Voucher Ref</th>
                    <th className="py-3 px-4">Flow Type</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount (PKR)</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {cashbook
                    .filter(c => !q || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
                    .map((c) => {
                      const isInflow = c.type === 'inflow';
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-500">{c.id}</td>
                          <td className="py-3 px-4">
                            {isInflow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> Inflow
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                <ArrowUpRight className="w-3 h-3 text-red-600" /> Outflow
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 capitalize font-semibold text-slate-800">{c.category.replace('_', ' ')}</td>
                          <td className="py-3 px-4 text-slate-600">{c.description}</td>
                          <td className={`py-3 px-4 text-right font-mono font-extrabold ${isInflow ? 'text-emerald-700' : 'text-red-700'}`}>
                            {isInflow ? '+' : '-'} Rs. {c.amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openViewModal('cashbook', c)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
                                title="View Voucher"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openPrintDocument({ type: 'cash_voucher', data: c })}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
                                title="Print Cash Voucher"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal('cashbook', c)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 transition-colors cursor-pointer"
                                title="Edit Voucher"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {currentUser?.permissions?.canDeleteRecords && (
                                <button
                                  type="button"
                                  onClick={() => openDeleteModal('cashbook', c.id, `Voucher ${c.id}: ${c.description}`)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 transition-colors cursor-pointer"
                                  title="Delete Voucher (Super Admin)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. COMPLIANCE & FBR RAG KNOWLEDGE VIEW */}
      {activeTab === 'compliance' && (
        <div className="space-y-4 max-w-6xl mx-auto animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                  FBR Statutory Knowledge Base (RAG Grounding)
                </h2>
                <p className="text-xs text-slate-500">
                  Official Pakistan tax acts, SRO circulars, and withholding schedules
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-800 text-xs font-bold rounded-lg border border-indigo-200">
                18 Grounded Statutes
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complianceSources.map((cs) => (
              <div
                key={cs.id}
                className="bg-white dark:bg-slate-900 surface-card surface-card-hover p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-50 text-indigo-800 border border-indigo-200">
                      {cs.authority} • {cs.effectiveYear}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {cs.documentName}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mt-2">{cs.title}</h3>
                  <div className="text-xs font-semibold text-indigo-700 font-mono mt-0.5">{cs.section}</div>

                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{cs.summary}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-indigo-700 font-bold">GST: {cs.defaultGSTRate}%</span>
                    <span className="text-indigo-700 font-bold">WHT: {cs.withholdingRate}%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openViewModal('compliance', cs)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View Excerpt</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. INVENTORY MOVEMENTS AUDIT TRAIL */}
      {activeTab === 'movements' && (
        <div className="space-y-4 max-w-6xl mx-auto animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                  Stock Audit Trail & Warehouse Movements
                </h2>
                <p className="text-xs text-slate-500">
                  Immutable chronological log of all stock adjustments, receipts, and production dispatches
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Log ID</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4 text-right">Quantity Delta</th>
                    <th className="py-3 px-4 text-right">Stock Balance</th>
                    <th className="py-3 px-4">Operator</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {inventoryMovements.map((mov) => {
                    const isPositive = mov.quantityDelta > 0;
                    return (
                      <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-400">{mov.id}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{mov.productName}</td>
                        <td className="py-3 px-4 capitalize font-medium text-slate-700">
                          {mov.movementType.replace('_', ' ')}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isPositive ? '+' : ''}{mov.quantityDelta.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {mov.balanceAfter.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{mov.createdBy}</td>
                        <td className="py-3 px-4 text-slate-500">{mov.notes || '—'}</td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {new Date(mov.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. SUPPLIERS & VENDORS VIEW */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4 max-w-6xl mx-auto animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                  Verified Raw Material Suppliers & Vendors
                </h2>
                <p className="text-xs text-slate-500">
                  Approved commercial partners, lead times, credit terms, and procurement history
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter suppliers / cities..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => openModal('supplier')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Supplier</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-transparent dark:border-white/10 shadow-[0_1px_2px_rgba(17,20,45,0.04),0_10px_28px_-14px_rgba(17,20,45,0.10)] dark:shadow-none shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Supplier / Vendor</th>
                    <th className="py-3 px-4">City / Region</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4 text-center">Lead Time</th>
                    <th className="py-3 px-4">Payment Terms</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {suppliers
                    .filter(s =>
                      s.name.toLowerCase().includes(q) ||
                      s.city.toLowerCase().includes(q) ||
                      (s.phone && s.phone.includes(q))
                    )
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{s.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{s.id}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{s.city}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{s.phone || '—'}</span>
                          </div>
                          {s.email && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{s.email}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">
                            {s.leadTimeDays} days
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{s.paymentTerms}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openModal('purchase')}
                              className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              title="Issue Purchase Order"
                            >
                              + Issue PO
                            </button>
                            <button
                              type="button"
                              onClick={() => openViewModal('supplier', s)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal('supplier', s)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Supplier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {currentUser?.permissions?.canDeleteRecords && (
                              <button
                                type="button"
                                onClick={() => openDeleteModal('supplier', s.id, s.name)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Delete Supplier"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {suppliers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No suppliers registered yet. Click &quot;Add Supplier&quot; to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. CUSTOMERS & TEXTILE MILLS VIEW */}
      {activeTab === 'customers' && (
        <div className="space-y-4 max-w-6xl mx-auto animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 surface-card p-5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base lg:text-lg font-bold text-slate-900 tracking-tight">
                  Registered Customers & Buyer Mills
                </h2>
                <p className="text-xs text-slate-500">
                  Client accounts, credit limits, outstanding receivables, and sales history
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter clients / cities..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => openModal('customer')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-transparent dark:border-white/10 shadow-[0_1px_2px_rgba(17,20,45,0.04),0_10px_28px_-14px_rgba(17,20,45,0.10)] dark:shadow-none shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Client / Mill Name</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4 text-right">Credit Limit</th>
                    <th className="py-3 px-4 text-right">Outstanding Receivables</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {customers
                    .filter(c =>
                      c.name.toLowerCase().includes(q) ||
                      c.city.toLowerCase().includes(q) ||
                      (c.phone && c.phone.includes(q))
                    )
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{c.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{c.id}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{c.city}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.phone || '—'}</span>
                          </div>
                          {c.email && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{c.email}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-600">
                          Rs. {(c.creditLimit || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          Rs. {(c.outstandingReceivables || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openModal('sale')}
                              className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              title="Record Sale Invoice"
                            >
                              + Sale
                            </button>
                            <button
                              type="button"
                              onClick={() => openViewModal('customer', c)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal('customer', c)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Customer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {currentUser?.permissions?.canDeleteRecords && (
                              <button
                                type="button"
                                onClick={() => openDeleteModal('customer', c.id, c.name)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Delete Customer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No customer accounts registered yet. Click &quot;Add Customer&quot; to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
