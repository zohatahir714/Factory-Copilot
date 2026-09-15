import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
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
  const { activeModal, closeModal, createVoucherDirect, accounts, currentUser, suppliers, customers, ensurePartyAccount } = useApp();

  const [voucherType, setVoucherType] = useState<VoucherType>('CPV');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [bankAccountId, setBankAccountId] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [description, setDescription] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));

  // Multi-entry line items (party = saved customer/supplier this line settles with)
  const [lines, setLines] = useState<Array<{
    id: string;
    accountId: string;
    description: string;
    debit: number | '';
    credit: number | '';
    party?: string;
  }>>([
    { id: 'line_1', accountId: '', description: '', debit: 15000, credit: 0, party: '' },
    { id: 'line_2', accountId: '', description: '', debit: 0, credit: 15000, party: '' }
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

  /* ONE searchable account picker: every CoA head + saved parties in a single
     list. Selecting a party auto-creates their sub-ledger account.
     NOTE: all hooks must live above the early return below. */
  interface AccountOption {
    key: string;
    label: string;
    hint: string;
    group: string;
    partyName?: string;
    partyKind?: 'customer' | 'supplier';
  }
  const [pickerLineId, setPickerLineId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerActiveIdx, setPickerActiveIdx] = useState(-1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const accountOptions: AccountOption[] = useMemo(() => {
    const coa: AccountOption[] = accounts.map(a => ({
      key: a.id,
      label: a.name,
      hint: `${a.code}`,
      group: 'Chart of Accounts'
    }));
    const cust: AccountOption[] = customers
      .filter(c => !accounts.some(a => a.name.toLowerCase() === c.name.toLowerCase()))
      .map(c => ({
        key: `party_${c.id}`,
        label: c.name,
        hint: 'Customer — auto-creates AR account',
        group: 'Customers & Mills',
        partyName: c.name,
        partyKind: 'customer' as const
      }));
    const supp: AccountOption[] = suppliers
      .filter(s => !accounts.some(a => a.name.toLowerCase() === s.name.toLowerCase()))
      .map(s => ({
        key: `party_${s.id}`,
        label: s.name,
        hint: 'Supplier — auto-creates AP account',
        group: 'Suppliers & Vendors',
        partyName: s.name,
        partyKind: 'supplier' as const
      }));
    return [...coa, ...cust, ...supp];
  }, [accounts, customers, suppliers]);

  const resolveAccount = (line: { accountId: string }): AccountOption | undefined =>
    line.accountId ? accountOptions.find(o => o.key === line.accountId) : undefined;

  const pickerListRef = useRef<HTMLDivElement>(null);

  /** Flat (group-flattened) filtered list — keyboard index space. */
  const flatFiltered: AccountOption[] = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return accountOptions;
    return accountOptions.filter(o => `${o.hint} ${o.label} ${o.group}`.toLowerCase().includes(q));
  }, [accountOptions, pickerQuery]);

  // Anchor the highlight when the list legitimately changes: on open and on
  // query change. (An effect on flatFiltered would fight arrow keys — its
  // identity churns every render, resetting the active index mid-navigation.)
  const openPicker = (lineId: string) => {
    setPickerQuery('');
    setPickerActiveIdx(accountOptions.length > 0 ? 0 : -1);
    setPickerLineId(lineId);
  };

  // Keep the active option inside the scrollport (scrolls only when needed).
  useEffect(() => {
    if (pickerLineId == null || pickerActiveIdx < 0 || !pickerListRef.current) return;
    const el = pickerListRef.current.querySelector<HTMLElement>(`[data-idx="${pickerActiveIdx}"]`);
    if (!el) return;
    const box = pickerListRef.current;
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }, [pickerActiveIdx, pickerLineId]);

  const commitPicker = (lineId: string, opt: AccountOption) => {
    if (!opt) return;
    if (opt.partyName && opt.partyKind) {
      const acc = ensurePartyAccount(opt.partyName, opt.partyKind);
      if (acc) {
        handleLineChange(lineId, 'accountId', acc.id);
        handleLineChange(lineId, 'party', opt.partyName);
        setPickerLineId(null);
        setPickerQuery('');
        return;
      }
    }
    handleLineChange(lineId, 'accountId', opt.key);
    handleLineChange(lineId, 'party', '');
    setPickerLineId(null);
    setPickerQuery('');
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerLineId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (activeModal !== 'expense') return null;

  /** Keyboard model for the combobox. Bound on BOTH the trigger and the
      search field so the widget works from whichever has focus.
      ↑↓ move · Home/End jump · Enter commits · Esc closes · Tab closes.
      Enter only submits the voucher when the picker is closed. */
  const handlePickerKeyDown = (e: React.KeyboardEvent, lineId: string) => {
    const open = pickerLineId === lineId;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        openPicker(lineId);
      }
      return;
    }
    const last = flatFiltered.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setPickerActiveIdx(i => (i < 0 ? 0 : (i + 1) % flatFiltered.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setPickerActiveIdx(i => (i <= 0 ? last : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setPickerActiveIdx(last >= 0 ? 0 : -1);
        break;
      case 'End':
        e.preventDefault();
        setPickerActiveIdx(last);
        break;
      case 'Enter':
        e.preventDefault();
        if (pickerActiveIdx >= 0 && pickerActiveIdx < flatFiltered.length) {
          commitPicker(lineId, flatFiltered[pickerActiveIdx]);
        }
        break;
      case 'Escape':
      case 'Tab':
        setPickerLineId(null);
        setPickerQuery('');
        break;
    }
  };

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

    // Party-aware category: a line whose account is a party sub-ledger marks
    // the voucher as supplier_payment / customer_payment for reporting.
    const partyLine = lines.find(l => l.party);
    const partyIsSupplier = partyLine ? suppliers.some(s => s.name === partyLine.party) : false;
    const partyIsCustomer = partyLine ? customers.some(c => c.name === partyLine.party) : false;
    const resolvedCategory = partyIsSupplier
      ? 'supplier_payment'
      : partyIsCustomer
        ? 'customer_payment'
        : undefined;

    const selectedBank = accounts.find(a => a.id === bankAccountId);

    const voucherLineItems: VoucherLineItem[] = lines.map(l => {
      const acc = accounts.find(a => a.id === l.accountId);
      const narrated = l.party
        ? `${l.party} — ${l.description.trim() || `${voucherType} settlement`} `
        : l.description;
      return {
        id: l.id,
        accountId: l.accountId,
        accountCode: acc?.code || '',
        accountName: acc?.name || 'Unknown Account',
        description: narrated.trim() || description.trim() || `${voucherType} Entry`,
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
      category: resolvedCategory,
      entries: voucherLineItems,
      preparedBy: currentUser?.name || 'Managing Director'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-950/45 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-transparent dark:border-white/10 w-full max-w-3xl my-auto overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
              {voucherType}
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Post Multi-Entry Accounting Voucher</h3>
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
            <label className="field-label">
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
              <label className="field-label">
                Voucher Date
              </label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs field-input font-mono"
              />
            </div>

            {/* Bank Account Details if Bank Voucher */}
            {(voucherType === 'BRV' || voucherType === 'BPV') && (
              <>
                <div>
                  <label className="field-label">
                    Bank Account Head
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs field-input font-semibold"
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
                  <label className="field-label">
                    Cheque / Ref No.
                  </label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="e.g. CHQ-992144"
                    className="w-full px-3 py-1.5 text-xs field-input font-mono"
                  />
                </div>
              </>
            )}

            {/* General Narration */}
            <div className={voucherType === 'BRV' || voucherType === 'BPV' ? 'sm:col-span-3' : 'sm:col-span-2'}>
              <label className="field-label">
                General Description / Narration
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Overall voucher purpose or reference..."
                className="w-full px-3 py-1.5 text-xs field-input"
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

            {/* No overflow-hidden here: the account combobox dropdown is absolutely
                positioned and must escape the table. Rounded corners are handled
                per-cell so the wrapper can stay open. */}
            <div className="border border-slate-200 dark:border-white/10 rounded-xl bg-white shadow-2xs [&_tbody>tr:last-child>td:first-child]:rounded-bl-[0.85rem] [&_tbody>tr:last-child>td:last-child]:rounded-br-[0.85rem]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] [&>tr>th:first-child]:rounded-tl-[0.85rem] [&>tr>th:last-child]:rounded-tr-[0.85rem]">
                  <tr>
                    <th className="p-2.5 pl-3 w-64 sm:w-80">Account (CoA · Customers · Suppliers)</th>
                    <th className="p-2.5">Item Narration</th>
                    <th className="p-2.5 text-right w-24 sm:w-28">Debit (PKR)</th>
                    <th className="p-2.5 text-right w-24 sm:w-28">Credit (PKR)</th>
                    <th className="p-2.5 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2 pl-3">
                        <div ref={pickerLineId === line.id ? pickerRef : undefined} className="relative">
                          <button
                            type="button"
                            role="combobox"
                            aria-expanded={pickerLineId === line.id}
                            aria-haspopup="listbox"
                            aria-controls={listId}
                            aria-autocomplete="list"
                            onKeyDown={(e) => handlePickerKeyDown(e, line.id)}
                            onClick={() => {
                              if (pickerLineId === line.id) { setPickerLineId(null); setPickerQuery(''); }
                              else openPicker(line.id);
                            }}
                            className="w-full px-2.5 py-1.5 text-left text-xs field-input outline-none font-semibold flex items-center justify-between gap-1.5"
                            title="Search chart of accounts, customers and suppliers"
                          >
                            <span className="truncate">{
                              resolveAccount(line)
                                ? `${resolveAccount(line)!.hint} · ${resolveAccount(line)!.label}`
                                : 'Search account…'
                            }</span>
                            <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.23 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                          </button>

                          {pickerLineId === line.id && (() => {
                            const filtered = flatFiltered;
                            const groups = [...new Set(filtered.map(o => o.group))];
                            // Map flat keyboard index → option (group headers are not selectable).
                            let running = 0;
                            return (
                              <div
                                ref={pickerListRef}
                                id={listId}
                                role="listbox"
                                className="absolute z-30 mt-1 w-[min(24rem,85vw)] max-h-80 overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#1a1b23] shadow-xl border border-transparent dark:border-white/10 p-1.5 animate-fadeIn"
                              >
                                <div className="sticky top-0 bg-white dark:bg-[#1a1b23] p-1 pb-1.5 z-10">
                                  <input
                                    autoFocus
                                    type="text"
                                    role="searchbox"
                                    value={pickerQuery}
                                    onChange={(e) => { setPickerQuery(e.target.value); setPickerActiveIdx(0); }}
                                    onKeyDown={(e) => handlePickerKeyDown(e, line.id)}
                                    placeholder="Type to search accounts, customers, suppliers…  (↑↓ browse · Enter select · Esc close)"
                                    aria-label="Search accounts, customers and suppliers"
                                    className="w-full px-3 py-1.5 text-xs field-input outline-none"
                                  />
                                </div>
                                {filtered.length === 0 && (
                                  <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">No matches for “{pickerQuery}”</div>
                                )}
                                {groups.map(g => (
                                  <div key={g} className="mt-1">
                                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{g}</div>
                                    {filtered.filter(o => o.group === g).map(o => {
                                      const idx = running++;
                                      const active = idx === pickerActiveIdx;
                                      return (
                                        <button
                                          key={o.key}
                                          type="button"
                                          role="option"
                                          data-idx={idx}
                                          aria-selected={active}
                                          onMouseMove={() => setPickerActiveIdx(idx)}
                                          onClick={() => commitPicker(line.id, o)}
                                          className={`w-full px-2.5 py-1.5 text-left rounded-lg transition-colors cursor-pointer ${
                                            active
                                              ? 'bg-indigo-600 text-white'
                                              : 'text-slate-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-500/15'
                                          }`}
                                        >
                                          <div className="text-xs font-semibold truncate">{o.label}</div>
                                          <div className={`text-[10px] font-mono ${active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>{o.hint}</div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => handleLineChange(line.id, 'description', e.target.value)}
                          placeholder="Line narration..."
                          className="w-full px-2 py-1.5 text-xs field-input outline-none"
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
                          className="w-full px-2 py-1.5 text-xs field-input text-right font-mono font-bold text-slate-900 dark:text-white outline-none"
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
                          className="w-full px-2 py-1.5 text-xs field-input text-right font-mono font-bold text-slate-900 dark:text-white outline-none"
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
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-full shadow-sm active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
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
