import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Save, Edit3, Lock, Building2, Users } from 'lucide-react';

export const EditItemModal: React.FC = () => {
  const {
    editingItem,
    closeEditModal,
    updateProduct,
    updatePurchaseOrder,
    updateSalesOrder,
    updateCashbookEntry,
    updateAccount,
    updateSupplier,
    updateCustomer
  } = useApp();

  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (editingItem?.data) {
      setFormData({ ...editingItem.data });
    }
  }, [editingItem]);

  if (!editingItem) return null;

  const { type, data } = editingItem;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'product') {
      updateProduct(data.id, {
        name: formData.name,
        category: formData.category,
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
        reorderThreshold: Number(formData.reorderThreshold)
        // Note: currentStock is strictly locked and can only be updated via received Purchase Orders
      });
    } else if (type === 'po') {
      updatePurchaseOrder(data.id, {
        status: formData.status,
        notes: formData.notes
      });
    } else if (type === 'sale') {
      updateSalesOrder(data.id, {
        paymentStatus: formData.paymentStatus
      });
    } else if (type === 'cashbook') {
      updateCashbookEntry(data.id, {
        amount: Number(formData.amount),
        description: formData.description,
        category: formData.category
      });
    } else if (type === 'supplier') {
      updateSupplier(data.id, {
        name: formData.name,
        city: formData.city,
        phone: formData.phone,
        email: formData.email,
        leadTimeDays: Number(formData.leadTimeDays) || 3,
        paymentTerms: formData.paymentTerms || 'Net 30 Days'
      });
    } else if (type === 'customer') {
      updateCustomer(data.id, {
        name: formData.name,
        city: formData.city,
        phone: formData.phone,
        email: formData.email,
        creditLimit: Number(formData.creditLimit) || 0
      });
    } else if (type === 'account') {
      updateAccount(data.id, {
        name: formData.name,
        type: formData.type,
        description: formData.description,
        openingBalance: Number(formData.openingBalance) || 0
      });
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'product': return 'Product / SKU';
      case 'po': return 'Purchase Order';
      case 'sale': return 'Sales Invoice';
      case 'cashbook': return 'Cash Voucher';
      case 'account': return 'Chart of Account Head';
      case 'supplier': return 'Supplier / Vendor';
      case 'customer': return 'Customer / Mill';
      default: return 'Record';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'supplier': return <Building2 className="w-4 h-4" />;
      case 'customer': return <Users className="w-4 h-4" />;
      default: return <Edit3 className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              {getIcon()}
            </div>
            <div>
              <h3 className="text-sm font-bold capitalize">
                Edit {getTitle()}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Identifier: {data.sku || data.poNumber || data.invoiceNumber || data.id}
              </p>
            </div>
          </div>
          <button
            onClick={closeEditModal}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* PRODUCT EDIT */}
          {type === 'product' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product / Material Name</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category || 'Yarns & Spinning'}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="Yarns & Spinning">Yarns & Spinning</option>
                  <option value="Dyes & Colorants">Dyes & Colorants</option>
                  <option value="Processing Chemicals">Processing Chemicals</option>
                  <option value="Packaging Materials">Packaging Materials</option>
                  <option value="Finished Fabric">Finished Fabric</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cost Price (PKR)</label>
                  <input
                    type="number"
                    required
                    value={formData.costPrice || 0}
                    onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price (PKR)</label>
                  <input
                    type="number"
                    required
                    value={formData.sellingPrice || 0}
                    onChange={e => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Current Stock ({data.unit})</label>
                    <span className="flex items-center gap-1 text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5" /> Locked
                    </span>
                  </div>
                  <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 font-bold flex items-center justify-between">
                    <span>{data.currentStock} {data.unit}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Inventory only increments through received Purchase Orders.</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Safety Reorder Threshold</label>
                  <input
                    type="number"
                    required
                    value={formData.reorderThreshold || 0}
                    onChange={e => setFormData({ ...formData, reorderThreshold: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Alerts supervisor when balance drops below this amount.</p>
                </div>
              </div>
            </>
          )}

          {/* SUPPLIER EDIT */}
          {type === 'supplier' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier / Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Location</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Faisalabad, Pakistan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+92 41 1234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.leadTimeDays || 3}
                    onChange={e => setFormData({ ...formData, leadTimeDays: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={formData.paymentTerms || 'Net 30 Days'}
                    onChange={e => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </>
          )}

          {/* CUSTOMER EDIT */}
          {type === 'customer' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer / Client Mill Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Region</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Lahore, Pakistan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+92 300 1234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Limit (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.creditLimit || 0}
                    onChange={e => setFormData({ ...formData, creditLimit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* PO EDIT */}
          {type === 'po' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Status</label>
                <select
                  value={formData.status || 'pending'}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="pending">Pending Vendor Delivery</option>
                  <option value="received">Received & Warehouse Restocked</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes & Procurement Tracking</label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Gate pass number, carrier details..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </>
          )}

          {/* SALE INVOICE EDIT */}
          {type === 'sale' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Status</label>
                <select
                  value={formData.paymentStatus || 'unpaid'}
                  onChange={e => setFormData({ ...formData, paymentStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="unpaid">Unpaid / Awaiting Receivables</option>
                  <option value="paid">Fully Settled & Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                </select>
              </div>
            </>
          )}

          {/* CASHBOOK EDIT */}
          {type === 'cashbook' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Voucher Amount (PKR)</label>
                <input
                  type="number"
                  required
                  value={formData.amount || 0}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Disbursement Category</label>
                <select
                  value={formData.category || 'misc'}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none capitalize"
                >
                  <option value="utilities">Utilities (Electricity / Gas)</option>
                  <option value="wages">Factory Wages / Salaries</option>
                  <option value="freight">Freight & Transport</option>
                  <option value="raw_materials">Raw Materials</option>
                  <option value="supplier_payment">Supplier Payment</option>
                  <option value="customer_payment">Customer Inflow</option>
                  <option value="fbr_tax_payment">FBR Tax / PSID Payment</option>
                  <option value="misc">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Memo</label>
                <input
                  type="text"
                  required
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </>
          )}

          {/* ACCOUNT HEAD EDIT */}
          {type === 'account' && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Title</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sub-Classification</label>
                <input
                  type="text"
                  value={formData.type || ''}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Balance (PKR)</label>
                <input
                  type="number"
                  value={formData.openingBalance || 0}
                  onChange={e => setFormData({ ...formData, openingBalance: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
