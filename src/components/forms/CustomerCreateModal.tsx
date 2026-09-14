import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Users, Phone, Mail, MapPin, CreditCard, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const CustomerCreateModal: React.FC = () => {
  const { activeModal, closeModal, createCustomerDirect } = useApp();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState<number | ''>(2000000);
  const [outstandingReceivables, setOutstandingReceivables] = useState<number | ''>(0);

  if (activeModal !== 'customer') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createCustomerDirect({
      name: name.trim(),
      city: city.trim() || 'Pakistan',
      phone: phone.trim() || '+92 300 0000000',
      email: email.trim() || 'client@example.com',
      creditLimit: Number(creditLimit) || 0,
      outstandingReceivables: Number(outstandingReceivables) || 0
    });

    setName('');
    setCity('');
    setPhone('');
    setEmail('');
    setCreditLimit(2000000);
    setOutstandingReceivables(0);
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-transparent dark:border-white/10 w-full max-w-lg overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Register Client / Garment Mill</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Add B2B customer for sales orders, invoicing & credit limits</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="field-label">
              Customer / Mill Name *
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Al-Rehman Textiles & Exports"
                className="w-full pl-9 pr-3.5 py-2 text-sm field-input font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">
                City / Location *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Lahore / Faisalabad"
                  className="w-full pl-9 pr-3.5 py-2 text-sm field-input"
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                Contact Phone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 42 35789012"
                  className="w-full pl-9 pr-3.5 py-2 text-sm field-input font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">
                Accounts Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="accounts@customer.pk"
                  className="w-full pl-9 pr-3.5 py-2 text-sm field-input"
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                Credit Limit (PKR)
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-9 pr-3.5 py-2 text-sm field-input font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="field-label">
              Opening Outstanding Receivables (PKR)
            </label>
            <input
              type="number"
              min="0"
              value={outstandingReceivables}
              onChange={(e) => setOutstandingReceivables(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full px-3.5 py-2 text-sm field-input font-mono"
            />
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs text-indigo-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>This customer will immediately appear in Sales Order creation, Invoice generation, and Cashbook customer receipt dropdowns.</span>
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-full shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Save Customer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
