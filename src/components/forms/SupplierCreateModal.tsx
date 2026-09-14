import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Building2, Phone, Mail, MapPin, Clock, FileText, CheckCircle2 } from 'lucide-react';

export const SupplierCreateModal: React.FC = () => {
  const { activeModal, closeModal, createSupplierDirect } = useApp();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState<number | ''>(3);
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');

  if (activeModal !== 'supplier') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createSupplierDirect({
      name: name.trim(),
      city: city.trim() || 'Pakistan',
      phone: phone.trim() || '+92 300 0000000',
      email: email.trim() || 'vendor@example.com',
      leadTimeDays: Number(leadTimeDays) || 3,
      paymentTerms: paymentTerms.trim() || 'Net 30 Days'
    });

    setName('');
    setCity('');
    setPhone('');
    setEmail('');
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-transparent dark:border-white/10 w-full max-w-lg overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Register Raw Material Supplier</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Add trusted vendor for automated procurement & PO generation</p>
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
              Supplier / Company Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ColorChem Dyes & Auxiliaries"
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
                  placeholder="e.g. Karachi / Faisalabad"
                  className="w-full pl-9 pr-3.5 py-2 text-sm field-input"
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 21 34567890"
                  className="w-full pl-9 pr-3.5 py-2 text-sm field-input font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">
                Official Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="orders@supplier.com.pk"
                  className="w-full pl-9 pr-3.5 py-2 text-sm field-input"
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                Average Lead Time (Days)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-9 pr-3.5 py-2 text-sm field-input font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="field-label">
              Payment Terms
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30 Days, Advance, Cash on Delivery"
                className="w-full pl-9 pr-3.5 py-2 text-sm field-input"
              />
            </div>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs text-indigo-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>This vendor will be instantly wired into all Purchase Order creation and Cashbook payment dropdowns.</span>
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
              <span>Save Supplier</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
