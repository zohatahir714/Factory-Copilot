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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-transparent dark:border-white/10 w-full max-w-xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Add Raw Material / SKU</h3>
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
              <label className="field-label">
                SKU / Material Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. YRN-POLY-150D"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3.5 py-2 text-sm field-input font-mono uppercase"
              />
            </div>

            <div>
              <label className="field-label">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm field-input font-medium text-slate-800"
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
            <label className="field-label">
              Material / Product Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Polyester DTY Yarn 150D/48F Semi-Dull"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm field-input font-medium text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="field-label">
                Unit of Measure
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as any)}
                className="w-full px-3.5 py-2 text-sm field-input font-medium text-slate-800"
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
              <label className="field-label">
                Cost Price (PKR) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm field-input font-mono"
              />
            </div>

            <div>
              <label className="field-label">
                Selling Price (PKR) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm field-input font-mono font-bold text-indigo-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">
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
              <label className="field-label">
                Safety Reorder Threshold ({unit}) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm field-input font-mono"
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
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-bold shadow-sm active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
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
