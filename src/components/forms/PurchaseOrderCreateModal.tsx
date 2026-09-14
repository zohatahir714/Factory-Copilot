import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ShoppingCart, X, Check, Building2, Package, Clock, ShieldCheck } from 'lucide-react';

export const PurchaseOrderCreateModal: React.FC = () => {
  const { activeModal, closeModal, openModal, suppliers, products, createPurchaseOrderDirect } = useApp();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(100);

  if (activeModal !== 'purchase') return null;

  const selectedSupplier = suppliers.find(s => s.id === supplierId) || suppliers[0];
  const selectedProduct = products.find(p => p.id === productId) || products[0];

  const unitPrice = selectedProduct?.costPrice || 0;
  const totalAmount = unitPrice * (quantity || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedProduct || quantity <= 0) return;

    createPurchaseOrderDirect({
      supplierId: selectedSupplier.id,
      productId: selectedProduct.id,
      quantity
    });

    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-transparent dark:border-white/10 w-full max-w-xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Issue Purchase Order</h3>
              <p className="text-xs text-slate-500">Procure raw materials with automated supplier terms</p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Verified Supplier *
              </label>
              <button
                type="button"
                onClick={() => openModal('supplier')}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                + Add New Supplier
              </button>
            </div>
            <div className="relative">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm field-input font-medium text-slate-900"
              >
                {suppliers.length === 0 ? (
                  <option value="">No suppliers registered yet - Click + Add New Supplier</option>
                ) : (
                  suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city}) • Terms: {s.paymentTerms}
                    </option>
                  ))
                )}
              </select>
            </div>
            {selectedSupplier && (
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-400" /> {selectedSupplier.city}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" /> Lead Time: {selectedSupplier.leadTimeDays} days
                </span>
                <span className="text-emerald-700 font-semibold">
                  Payment: {selectedSupplier.paymentTerms}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="field-label">
              Raw Material / Item to Order *
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm field-input font-medium text-slate-900"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name} (Stock: {p.currentStock} {p.unit}) @ Rs. {(p.costPrice || 0).toLocaleString()}/{p.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">
                Quantity ({selectedProduct?.unit || 'units'}) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-sm field-input font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="field-label">
                Contract Unit Cost (PKR)
              </label>
              <div className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono text-slate-700">
                Rs. {(unitPrice || 0).toLocaleString()} / {selectedProduct?.unit}
              </div>
            </div>
          </div>

          {/* Committed Total Preview */}
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs text-amber-900">
              <span className="font-medium">Total Committed Order Value:</span>
              <span className="font-bold text-base font-mono text-amber-900">
                Rs. {(totalAmount || 0).toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-amber-800 flex items-center gap-1.5 pt-1 border-t border-amber-200/60">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>FBR Withholding Tax Rule: Sec 153(1)(a) applicable upon vendor disbursement</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-bold shadow-sm active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Issue Purchase Order</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
