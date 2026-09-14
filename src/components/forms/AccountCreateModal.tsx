import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BookOpen, X, Check, Layers, AlertCircle } from 'lucide-react';
import { AccountCategory } from '../../types';

export const AccountCreateModal: React.FC = () => {
  const { activeModal, closeModal, addAccount, accounts } = useApp();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AccountCategory>('expense');
  const [type, setType] = useState('Operating Expense');
  const [openingBalance, setOpeningBalance] = useState<number | ''>(0);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (activeModal !== 'account') return null;

  // Auto-generate suggested code based on category
  const handleCategoryChange = (cat: AccountCategory) => {
    setCategory(cat);
    const categoryPrefixes: Record<AccountCategory, string> = {
      asset: '1',
      liability: '2',
      equity: '3',
      revenue: '4',
      expense: '5'
    };
    const prefix = categoryPrefixes[cat];
    const existingSameCat = accounts.filter(a => a.category === cat);
    const nextNum = (existingSameCat.length + 1) * 10;
    setCode(`${prefix}0${nextNum.toString().padStart(2, '0')}`);

    if (cat === 'asset') setType('Current Asset');
    else if (cat === 'liability') setType('Current Liability');
    else if (cat === 'equity') setType('Equity / Capital');
    else if (cat === 'revenue') setType('Operating Revenue');
    else if (cat === 'expense') setType('Operating Expense');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code.trim() || !name.trim()) {
      setError('Account code and name are required.');
      return;
    }

    if (accounts.some(a => a.code.toLowerCase() === code.trim().toLowerCase())) {
      setError(`Account code "${code}" already exists in Chart of Accounts.`);
      return;
    }

    addAccount({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category,
      type,
      openingBalance: Number(openingBalance) || 0,
      currentBalance: Number(openingBalance) || 0,
      description: description.trim() || undefined,
      isSystem: false,
      isActive: true
    });

    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-transparent dark:border-white/10 w-full max-w-lg overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Add Account to Chart of Accounts</h3>
              <p className="text-xs text-slate-500">Register new ledger account linked across vouchers and reports</p>
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
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Category Selector */}
          <div>
            <label className="field-label">
              Account Category
            </label>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(['asset', 'liability', 'equity', 'revenue', 'expense'] as AccountCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    category === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Account Code */}
            <div>
              <label className="field-label">
                Account Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 5040"
                required
                className="w-full px-3 py-2 text-xs field-input font-mono font-bold outline-none"
              />
            </div>

            {/* Account Type Classification */}
            <div>
              <label className="field-label">
                Sub-Classification
              </label>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. Operating Expense"
                required
                className="w-full px-3 py-2 text-xs field-input"
              />
            </div>
          </div>

          {/* Account Name */}
          <div>
            <label className="field-label">
              Account Title / Head Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Generator Diesel & Maintenance"
              required
              className="w-full px-3 py-2 text-xs field-input outline-none font-semibold"
            />
          </div>

          {/* Opening Balance */}
          <div>
            <label className="field-label">
              Opening Balance (PKR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
              <input
                type="number"
                min="0"
                step="1"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full pl-9 pr-3 py-2 text-xs field-input font-mono font-bold outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Starting balance carried forward from previous fiscal year</p>
          </div>

          {/* Description */}
          <div>
            <label className="field-label">
              Notes / Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Purpose or compliance notes for this account head..."
              className="w-full px-3 py-2 text-xs field-input resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow-sm active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Register Account</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
