import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Wallet,
  X,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Scale
} from 'lucide-react';
import { VoucherType, VoucherLineItem, PaymentMode } from '../../types';

export const CashbookCreateModal: React.FC = () => {
  const { activeModal, closeModal, createVoucherDirect, accounts, currentUser } = useApp();

  const [voucherType, setVoucherType] = useState<VoucherType>('CPV');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [bankAccountId, setBankAccountId] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [description, setDescription] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));

  // Multi-entry line items
  const [lines, setLines] = useState<Array<{
    id: string;
    accountId: string;
    description: string;
    debit: number | '';
    credit: number | '';
  }>>([
    { id: 'line_1', accountId: '', description: '', debit: 15000, credit: 0 },
    { id: 'line_2', accountId: '', description: '', debit: 0, credit: 15000 }
  ]);

  const [error, setError] = useState('');

  // Auto set bank accounts
  const bankAccounts = accounts.filter(a => a.type.toLowerCase().includes('bank') || a.code === '1002' || a.code === '1003');
  const cashAccounts = accounts.filter(a => a.code === '1001' || a.type.toLowerCase().includes('cash'));

  // Default accounts initialization based on voucher type
  useEffect(() => {
    if (voucherType === 'CRV') {
      setPaymentMode('cash');
      const cashAcc = cashAccounts[0]?.id || accounts.find(a => a.code === '1001')?.id || '';
      const custAcc = accounts.find(a => a.code === '1005')?.id || '';
      setLines([
        { id: `l_${Date.now()}_1`, accountId: cashAcc, description: 'Cash received into factory drawer', debit: 25000, credit: 0 },
        { id: `l_${Date.now()}_2`, accountId: custAcc, description: 'Received from customer against delivery', debit: 0, credit: 25000 }
      ]);
    } else if (voucherType === 'CPV') {
      setPaymentMode('cash');
      const cashAcc = cashAccounts[0]?.id || accounts.find(a => a.code === '1001')?.id || '';
      const expAcc = accounts.find(a => a.code === '5002' || a.code === '5001')?.id || '';
      setLines([
        { id: `l_${Date.now()}_1`, accountId: expAcc, description: 'Factory diesel generator fuel payment', debit: 15000, credit: 0 },
        { id: `l_${Date.now()}_2`, accountId: cashAcc, description: 'Disbursed from cash in hand', debit: 0, credit: 15000 }
      ]);
    } else if (voucherType === 'BRV') {
      setPaymentMode('bank');
      const bankAcc = bankAccounts[0]?.id || '';
      const custAcc = accounts.find(a => a.code === '1005')?.id || '';
      setBankAccountId(bankAcc);
      setLines([
        { id: `l_${Date.now()}_1`, accountId: bankAcc, description: 'Bank transfer received from client', debit: 50000, credit: 0 },
        { id: `l_${Date.now()}_2`, accountId: custAcc, description: 'Customer payment clearance', debit: 0, credit: 50000 }
      ]);
    } else if (voucherType === 'BPV') {
      setPaymentMode('bank');
      const bankAcc = bankAccounts[0]?.id || '';
      const suppAcc = accounts.find(a => a.code === '2001')?.id || '';
      setBankAccountId(bankAcc);
      setLines([
        { id: `l_${Date.now()}_1`, accountId: suppAcc, description: 'Raw cotton vendor payment', debit: 45000, credit: 0 },
        { id: `l_${Date.now()}_2`, accountId: bankAcc, description: 'Cheque issued from bank', debit: 0, credit: 45000 }
      ]);
    } else if (voucherType === 'JV') {
      setPaymentMode('journal');
      const debAcc = accounts.find(a => a.category === 'expense')?.id || '';
      const credAcc = accounts.find(a => a.category === 'liability')?.id || '';
      setLines([
        { id: `l_${Date.now()}_1`, accountId: debAcc, description: 'Depreciation / adjustment debit', debit: 20000, credit: 0 },
        { id: `l_${Date.now()}_2`, accountId: credAcc, description: 'Accumulated adjustment credit', debit: 0, credit: 20000 }
      ]);
    }
  }, [voucherType]);

  if (activeModal !== 'expense') return null;

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference === 0 && totalDebit > 0;

  const handleAddLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: `line_${Date.now()}_${Math.random().toString().slice(2, 6)}`,
        accountId: accounts[0]?.id || '',
        description: '',
        debit: 0,
        credit: 0
      }
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleLineChange = (id: string, field: string, value: any) => {
    setLines(prev =>
      prev.map(line => {
        if (line.id !== id) return line;
        if (field === 'debit') {
          return { ...line, debit: value === '' ? '' : Number(value), credit: value ? 0 : line.credit };
        }
        if (field === 'credit') {
          return { ...line, credit: value === '' ? '' : Number(value), debit: value ? 0 : line.debit };
        }
        return { ...line, [field]: value };
      })
    );
  };

  const handleAutoBalance = () => {
    if (totalDebit > totalCredit) {
      const diff = totalDebit - totalCredit;
      const balancingAcc = voucherType.startsWith('B')
        ? (bankAccountId || bankAccounts[0]?.id || accounts[0]?.id)
        : voucherType === 'CRV' || voucherType === 'CPV'
        ? (cashAccounts[0]?.id || accounts[0]?.id)
        : accounts[0]?.id;

      setLines(prev => [
        ...prev,
        {
          id: `auto_${Date.now()}`,
          accountId: balancingAcc || '',
          description: 'Balancing credit entry',
          debit: 0,
          credit: diff
        }
      ]);
    } else if (totalCredit > totalDebit) {
      const diff = totalCredit - totalDebit;
      setLines(prev => [
        ...prev,
        {
          id: `auto_${Date.now()}`,
          accountId: accounts[0]?.id || '',
          description: 'Balancing debit entry',
          debit: diff,
          credit: 0
        }
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (lines.length < 2) {
      setError('A double-entry voucher requires at least two line items.');
      return;
    }

    if (!isBalanced) {
      setError(`Double-entry out of balance! Difference is Rs. ${difference.toLocaleString()}. Total Debit must equal Total Credit.`);
      return;
    }

    const hasEmptyAccount = lines.some(l => !l.accountId);
    if (hasEmptyAccount) {
      setError('Please select an account head for each entry row.');
      return;
    }

    const selectedBank = accounts.find(a => a.id === bankAccountId);

    const voucherLineItems: VoucherLineItem[] = lines.map(l => {
      const acc = accounts.find(a => a.id === l.accountId);
      return {
        id: l.id,
        accountId: l.accountId,
        accountCode: acc?.code || '',
        accountName: acc?.name || 'Unknown Account',
        description: l.description.trim() || description.trim() || `${voucherType} Entry`,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0
      };
    });

    createVoucherDirect({
      voucherType,
      paymentMode,
      bankAccountId: paymentMode === 'bank' ? bankAccountId : undefined,
      bankAccountName: paymentMode === 'bank' ? selectedBank?.name : undefined,
      chequeNumber: paymentMode === 'bank' ? chequeNumber : undefined,
      chequeDate: paymentMode === 'bank' ? chequeDate : undefined,
      description: description.trim() || `${voucherType} Voucher - ${lines[0]?.description || 'Multi-entry'}`,
      voucherDate,
      amount: totalDebit,
      entries: voucherLineItems,
      preparedBy: currentUser?.name || 'Managing Director'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl my-auto overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
              {voucherType}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Post Multi-Entry Accounting Voucher</h3>
              <p className="text-xs text-slate-500">
                General Ledger double-entry system with automatic balancing & audit trail
              </p>
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
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Voucher Type Tabs (CRV, CPV, BRV, BPV, JV) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Voucher Type
            </label>
            <div className="grid grid-cols-5 gap-2 p-1.5 bg-slate-100 rounded-xl">
              {[
                { type: 'CRV', label: 'Cash Receipt (CRV)', icon: <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> },
                { type: 'CPV', label: 'Cash Payment (CPV)', icon: <ArrowUpRight className="w-3.5 h-3.5 text-red-600" /> },
                { type: 'BRV', label: 'Bank Receipt (BRV)', icon: <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-600" /> },
                { type: 'BPV', label: 'Bank Payment (BPV)', icon: <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" /> },
                { type: 'JV', label: 'Journal Voucher (JV)', icon: <Scale className="w-3.5 h-3.5 text-indigo-600" /> }
              ].map((v) => (
                <button
                  key={v.type}
                  type="button"
                  onClick={() => setVoucherType(v.type as VoucherType)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    voucherType === v.type
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {v.icon}
                    <span className="font-mono font-black">{v.type}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal truncate max-w-full">{v.label.split(' ')[1]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Voucher Meta Info: Date, Bank Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Voucher Date
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-mono"
              />
            </div>

            {/* Bank Account Details if Bank Voucher */}
            {(voucherType === 'BRV' || voucherType === 'BPV') && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Bank Account Head
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-semibold"
                  >
                    <option value="">Select Bank...</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Cheque / Ref No.
                  </label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="e.g. CHQ-992144"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-mono"
                  />
                </div>
              </>
            )}

            {/* General Narration */}
            <div className={voucherType === 'BRV' || voucherType === 'BPV' ? 'sm:col-span-3' : 'sm:col-span-2'}>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                General Description / Narration
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Overall voucher purpose or reference..."
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none"
              />
            </div>
          </div>

          {/* Multi-Entry Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Double-Entry Line Items ({lines.length})
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-2.5 pl-3 w-48 sm:w-56">Account Head (CoA)</th>
                    <th className="p-2.5">Item Narration</th>
                    <th className="p-2.5 text-right w-28 sm:w-32">Debit (PKR)</th>
                    <th className="p-2.5 text-right w-28 sm:w-32">Credit (PKR)</th>
                    <th className="p-2.5 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2 pl-3">
                        <select
                          value={line.accountId}
                          onChange={(e) => handleLineChange(line.id, 'accountId', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-semibold"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name} ({acc.category})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                          placeholder="Line narration..."
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.debit}
                          onChange={(e) => handleLineChange(line.id, 'debit', e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold text-slate-900 outline-none"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.credit}
                          onChange={(e) => handleLineChange(line.id, 'credit', e.target.value)}
                          placeholder="0"
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold text-slate-900 outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Balance Verification Strip */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                {isBalanced ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    Double-Entry Balanced (Difference: Rs. 0)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    Unbalanced: Diff Rs. {difference.toLocaleString()}
                  </span>
                )}

                {!isBalanced && (
                  <button
                    type="button"
                    onClick={handleAutoBalance}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                  >
                    Auto-Balance
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 font-mono font-bold">
                <div>
                  <span className="text-slate-500 mr-1.5">Total Debit:</span>
                  <span className="text-slate-900 text-sm">Rs. {totalDebit.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 mr-1.5">Total Credit:</span>
                  <span className="text-slate-900 text-sm">Rs. {totalCredit.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Post {voucherType} Voucher</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
