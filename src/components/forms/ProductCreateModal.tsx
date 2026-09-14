import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Package, X, Check, Calculator, AlertCircle } from 'lucide-react';

export const ProductCreateModal: React.FC = () => {
  const { activeModal, closeModal, createProductDirect } = useApp();

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Yarns & Spinning');
  const [unit, setUnit] = useState<'kg' | 'meters' | 'liters' | 'bags' | 'cones' | 'rolls'>('kg');
  const [costPrice, setCostPrice] = useState<number | ''>(1200);
  const [sellingPrice, setSellingPrice] = useState<number | ''>(1450);
  const [reorderThreshold, setReorderThreshold] = useState<number | ''>(50);

  if (activeModal !== 'product') return null;

  const cost = Number(costPrice) || 0;
  const sell = Number(sellingPrice) || 0;
  const marginPKR = sell - cost;
  const marginPct = cost > 0 ? ((marginPKR / cost) * 100).toFixed(1) : '0';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim() || cost <= 0 || sell <= 0) return;

    createProductDirect({
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category,
      unit,
      costPrice: cost,
      sellingPrice: sell,
      reorderThreshold: Number(reorderThreshold) || 0,
      currentStock: 0 // Strictly locked: Inventory can only be added through a Purchase Order
    });

    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Add Raw Material / SKU</h3>
              <p className="text-xs text-slate-500">Register new factory inventory into Supabase ledger</p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                SKU / Material Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. YRN-POLY-150D"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-800"
              >
                <option value="Yarns & Spinning">Yarns & Spinning</option>
                <option value="Dyes & Colorants">Dyes & Colorants</option>
                <option value="Processing Chemicals">Processing Chemicals</option>
                <option value="Packaging Materials">Packaging Materials</option>
                <option value="Finished Fabric">Finished Fabric</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Material / Product Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Polyester DTY Yarn 150D/48F Semi-Dull"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Unit of Measure
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as any)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-medium text-slate-800"
              >
                <option value="kg">Kilograms (kg)</option>
                <option value="meters">Meters (m)</option>
                <option value="liters">Liters (L)</option>
                <option value="bags">Bags (50kg)</option>
                <option value="cones">Cones</option>
                <option value="rolls">Rolls</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Cost Price (PKR) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Selling Price (PKR) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-mono font-bold text-indigo-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Initial Stock Balance
              </label>
              <div className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono text-slate-600 font-bold flex items-center justify-between">
                <span>0 {unit}</span>
                <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Requires Purchase Order
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Safety Reorder Threshold ({unit}) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Strict Procurement Rule: Inventory cannot be added manually. Issue and receive a verified Purchase Order to add physical stock to warehouse.</span>
          </div>

          {/* Real-time Profit Margin Indicator */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-800 font-semibold">
              <Calculator className="w-4 h-4 text-indigo-600" />
              <span>Unit Profit Margin:</span>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-indigo-900">
                Rs. {marginPKR.toLocaleString()} / {unit}
              </span>
              <span className="ml-2 px-1.5 py-0.5 bg-indigo-200/60 text-indigo-800 rounded font-bold text-[11px]">
                {marginPct}% markup
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Commit Product to Ledger</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
