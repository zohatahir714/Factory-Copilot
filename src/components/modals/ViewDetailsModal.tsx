import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Printer,
  Package,
  ShoppingCart,
  Receipt,
  Wallet,
  Scale,
  Calendar,
  Building,
  User,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Building2,
  Users
} from 'lucide-react';

export const ViewDetailsModal: React.FC = () => {
  const { viewingItem, closeViewModal, branding, openPrintDocument } = useApp();

  if (!viewingItem) return null;

  const { type } = viewingItem;
  const data = viewingItem.data || {};

  const handlePrint = () => {
    closeViewModal();
    if (type === 'sale') {
      openPrintDocument({ type: 'invoice', data });
    } else if (type === 'po') {
      openPrintDocument({ type: 'purchase_order', data });
    } else if (type === 'cashbook') {
      openPrintDocument({ type: 'cash_voucher', data });
    } else if (type === 'product') {
      openPrintDocument({ type: 'inventory_report', data: [data] });
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
              {type === 'product' && <Package className="w-5 h-5" />}
              {type === 'po' && <ShoppingCart className="w-5 h-5" />}
              {type === 'sale' && <Receipt className="w-5 h-5" />}
              {type === 'cashbook' && <Wallet className="w-5 h-5" />}
              {type === 'compliance' && <Scale className="w-5 h-5" />}
              {type === 'supplier' && <Building2 className="w-5 h-5" />}
              {type === 'customer' && <Users className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold capitalize">
                {type === 'product' && 'Product & Raw Material Details'}
                {type === 'po' && `Purchase Order ${data.poNumber}`}
                {type === 'sale' && `FBR Tax Invoice ${data.invoiceNumber}`}
                {type === 'cashbook' && `Financial Cash Voucher #${data.id}`}
                {type === 'compliance' && 'Statutory Tax Legal Excerpt'}
                {type === 'supplier' && `Supplier: ${data.name}`}
                {type === 'customer' && `Customer: ${data.name}`}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {branding?.companyName || 'Master Textile Mills Ltd'} • NTN: {branding?.ntnNumber || '4029184-7'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Print Document"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={closeViewModal}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* PRODUCT VIEW */}
          {type === 'product' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Material Name</span>
                  <span className="text-sm font-bold text-slate-900">{data.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">SKU Identifier</span>
                  <span className="text-sm font-bold font-mono text-blue-700">{data.sku}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Category</span>
                  <span className="font-semibold text-slate-800">{data.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Measurement Unit</span>
                  <span className="font-mono text-slate-800">{data.unit}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">Cost Price</span>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    Rs. {Number(data.costPrice).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">Selling Price</span>
                  <span className="text-sm font-bold font-mono text-emerald-700">
                    Rs. {Number(data.sellingPrice).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">Current Stock</span>
                  <span className="text-sm font-bold font-mono text-blue-700">
                    {data.currentStock} {data.unit}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <span>Minimum Safety Threshold:</span>
                <span className="font-bold font-mono">{data.reorderThreshold} {data.unit}</span>
              </div>
            </div>
          )}

          {/* PURCHASE ORDER VIEW */}
          {type === 'po' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase">Vendor</span>
                  <div className="text-sm font-bold text-slate-900">{data.supplierName}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] uppercase">Status</span>
                  <div>
                    {data.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                        <Clock className="w-3 h-3" /> Pending Delivery
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> Goods Restocked
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Committed Line Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="p-2.5">Material</th>
                        <th className="p-2.5 text-right">Quantity</th>
                        <th className="p-2.5 text-right">Unit Price</th>
                        <th className="p-2.5 text-right">Total (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.items?.map((it: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-medium text-slate-900">{it.productName}</td>
                          <td className="p-2.5 text-right font-mono">{it.quantity} {it.unit}</td>
                          <td className="p-2.5 text-right font-mono">Rs. {it.unitPrice?.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono font-bold">Rs. {it.totalAmount?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold">Total Committed Value:</span>
                <span className="text-base font-extrabold font-mono text-emerald-400">
                  Rs. {Number(data.totalAmount).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* SALES INVOICE VIEW */}
          {type === 'sale' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-blue-900 font-bold text-sm">FBR Sales Tax Act 1990 Registered Invoice</div>
                  <div className="text-[11px] text-blue-700 font-mono">STRN: {branding.strnNumber} • Tier-1 POS Integrated</div>
                </div>
                <div className="text-right font-mono text-blue-900 font-bold">
                  {data.invoiceNumber}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px]">Buyer Name:</span>
                  <div className="font-bold text-slate-900">{data.customerName}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">Payment Status:</span>
                  <div className="font-semibold text-emerald-700 capitalize">{data.paymentStatus}</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 text-right">Quantity</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Taxable Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items?.map((it: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-medium text-slate-900">{it.productName}</td>
                        <td className="p-2.5 text-right font-mono">{it.quantity} {it.unit}</td>
                        <td className="p-2.5 text-right font-mono">Rs. {it.unitPrice?.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono font-bold">Rs. {it.totalAmount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax Calculations */}
              <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal Taxable Amount:</span>
                  <span className="font-bold">Rs. {(Number(data.subtotal) || Math.round(Number(data.totalAmount || 0) / 1.18) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span>Sales Tax @ 18% (Section 3(1)):</span>
                  <span className="font-bold">Rs. {(Number(data.taxAmount) || 0).toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                  <span>Grand Total (Net Payable):</span>
                  <span>Rs. {(Number(data.totalAmount) || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* CASHBOOK VIEW */}
          {type === 'cashbook' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Voucher Reference</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {data.voucherNumber || data.id}
                  </span>
                  {data.voucherType && (
                    <span className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-bold text-[10px]">
                      {data.voucherType}
                    </span>
                  )}
                </div>
                <div>
                  {data.type === 'inflow' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                      <ArrowDownLeft className="w-4 h-4" /> Receipt / Inflow
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold">
                      <ArrowUpRight className="w-4 h-4" /> Payment / Outflow
                    </span>
                  )}
                </div>
              </div>

              {/* Payment details */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Payment Mode</span>
                  <span className="font-semibold text-slate-900 capitalize">{data.paymentMode || 'Cash'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Cheque / Ref</span>
                  <span className="font-mono text-slate-900">{data.chequeNumber || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase">General Description</span>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium">{data.description}</div>
                </div>
              </div>

              {/* Multi-entry line items table if present */}
              {data.entries && data.entries.length > 0 && (
                <div>
                  <span className="text-slate-700 font-bold uppercase text-[10px] block mb-1.5">
                    Double-Entry Line Items ({data.entries.length})
                  </span>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Account Head</th>
                          <th className="p-2.5">Narration</th>
                          <th className="p-2.5 text-right">Debit (PKR)</th>
                          <th className="p-2.5 text-right">Credit (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {data.entries.map((it: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">
                              {it.accountCode} - {it.accountName}
                            </td>
                            <td className="p-2.5 font-sans text-slate-600">{it.description}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              {Number(it.debit) > 0 ? `Rs. ${(Number(it.debit) || 0).toLocaleString()}` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              {Number(it.credit) > 0 ? `Rs. ${(Number(it.credit) || 0).toLocaleString()}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <span>Voucher Total Amount:</span>
                <span className={`text-base font-extrabold font-mono ${data.type === 'inflow' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.type === 'inflow' ? '+' : '-'} Rs. {(Number(data.amount) || 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* ACCOUNT HEAD VIEW */}
          {type === 'account' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Account Code</span>
                  <span className="font-mono font-black text-blue-700 text-lg">{data.code}</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold uppercase text-xs">
                  {data.category}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase">Account Title</span>
                  <div className="text-base font-bold text-slate-900">{data.name}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase">Sub-Classification</span>
                  <div className="text-xs text-slate-700">{data.type}</div>
                </div>
                {data.description && (
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Description</span>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-slate-800">{data.description}</div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Opening Balance</span>
                  <span className="font-bold text-slate-900">Rs. {Number(data.openingBalance || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Balance</span>
                  <span className="font-bold text-emerald-700">Rs. {Number(data.currentBalance || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* COMPLIANCE SOURCE VIEW */}
          {type === 'compliance' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <span className="text-[10px] font-mono font-bold text-purple-800 uppercase">{data.authority} AUTHORITY • {data.effectiveYear}</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">{data.title}</h4>
                <div className="text-xs text-blue-700 font-mono mt-1 font-semibold">{data.documentName} — {data.section}</div>
              </div>

              <div>
                <span className="text-slate-500 font-bold block mb-1">Executive Summary</span>
                <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">{data.summary}</p>
              </div>

              <div>
                <span className="text-slate-500 font-bold block mb-1">Official Legal Excerpt</span>
                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] leading-relaxed border border-slate-800">
                  "{data.fullExcerpt}"
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Standard GST Rate</span>
                  <span className="font-mono font-bold text-blue-700 text-sm">{data.defaultGSTRate}%</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Withholding Tax Rate</span>
                  <span className="font-mono font-bold text-purple-700 text-sm">{data.withholdingRate}%</span>
                </div>
              </div>
            </div>
          )}

          {/* SUPPLIER VIEW */}
          {type === 'supplier' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-mono font-bold text-blue-700 uppercase">Registered Vendor Profile</span>
                <h4 className="text-base font-bold text-slate-900 mt-1">{data.name}</h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {data.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">City / Location</span>
                  <span className="font-bold text-slate-900 text-xs">{data.city || 'Pakistan'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Lead Time</span>
                  <span className="font-bold text-slate-900 text-xs font-mono">{data.leadTimeDays || 3} Days</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone</span>
                  <span className="font-mono text-slate-800 text-xs">{data.phone || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Terms</span>
                  <span className="font-bold text-slate-900 text-xs">{data.paymentTerms || 'Net 30 Days'}</span>
                </div>
              </div>

              {data.email && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Official Email</span>
                  <span className="font-mono text-blue-700 text-xs">{data.email}</span>
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER VIEW */}
          {type === 'customer' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">Customer / Client Mill Account</span>
                <h4 className="text-base font-bold text-slate-900 mt-1">{data.name}</h4>
                <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {data.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">City / Location</span>
                  <span className="font-bold text-slate-900 text-xs">{data.city || 'Pakistan'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Credit Limit</span>
                  <span className="font-bold text-blue-700 text-xs font-mono">Rs. {Number(data.creditLimit || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone Number</span>
                  <span className="font-mono text-slate-800 text-xs">{data.phone || 'N/A'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Outstanding Receivables</span>
                  <span className={`font-bold font-mono text-xs ${Number(data.outstandingReceivables) > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                    Rs. {Number(data.outstandingReceivables || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {data.email && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Email Address</span>
                  <span className="font-mono text-blue-700 text-xs">{data.email}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={closeViewModal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
