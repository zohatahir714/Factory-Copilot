import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import AccountCombobox from '../AccountCombobox';
import {
  calculateFBRTaxByCategory,
  formatPKR,
  validateNTN,
  validateCNIC,
  FBRTaxCategory
} from '../../utils/fbrTaxEngine';
import {
  Receipt,
  X,
  Check,
  AlertTriangle,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Info,
  CheckCircle2,
  Building2,
  UserCheck
} from 'lucide-react';

export const SalesOrderCreateModal: React.FC = () => {
  const {
    activeModal,
    closeModal,
    openModal,
    customers,
    products,
    recordSaleDirect,
    branding,
    brandingSettings
  } = useApp();

  const activeBranding = branding || brandingSettings || {
    companyName: 'Master Textile Mills Ltd',
    ntnNumber: '4029184-7',
    strnNumber: '32-77-8761-234-19'
  };

  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(50);

  // Compliance Auto-Check Toggle State
  const [complianceAutoCheck, setComplianceAutoCheck] = useState<boolean>(true);

  // Tax Category State
  const [taxCategory, setTaxCategory] = useState<FBRTaxCategory>('standard_18');

  // Buyer Tax Identifier State (NTN or CNIC)
  const [buyerNTN, setBuyerNTN] = useState<string>('1928471-2');
  const [buyerCNIC, setBuyerCNIC] = useState<string>('35201-9876543-1');

  // Derived Filer State based on Category
  const isFiler = taxCategory !== 'unregistered_buyer';

  // Synchronize customer details when selection changes
  useEffect(() => {
    if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [customers, customerId]);

  if (activeModal !== 'sale') return null;

  const selectedCustomer = customers.find(c => c.id === customerId) || customers[0];
  const selectedProduct = products.find(p => p.id === productId) || products[0];

  const unitPrice = selectedProduct?.sellingPrice || 0;
  const currentStock = selectedProduct?.currentStock || 0;
  const hasInsufficientStock = quantity > currentStock;

  const subtotal = unitPrice * (quantity || 0);

  // Execute Reusable Tax Calculation Function
  const taxResult = calculateFBRTaxByCategory(subtotal, taxCategory);

  // Validate Buyer Identification under FBR Compliance Rules
  const ntnValidation = validateNTN(buyerNTN);
  const cnicValidation = validateCNIC(buyerCNIC);

  // When Compliance Auto-Check is enabled, validate format:
  // Active filers require valid 7/8-digit NTN
  // Unregistered buyers require valid 13-digit CNIC
  const isIdentifierValid = isFiler ? ntnValidation.valid : cnicValidation.valid;
  const complianceBlocked = complianceAutoCheck && !isIdentifierValid;

  const handleTaxCategoryChange = (newCategory: FBRTaxCategory) => {
    setTaxCategory(newCategory);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedProduct || quantity <= 0 || hasInsufficientStock) return;

    // Compliance Gate: Do not allow sale to be finalized if auto-check fails
    if (complianceBlocked) {
      return;
    }

    recordSaleDirect({
      customerId: selectedCustomer.id,
      productId: selectedProduct.id,
      quantity,
      subtotal: taxResult.subtotal,
      taxRate: taxResult.gstRate + taxResult.additionalTaxRate,
      taxAmount: taxResult.totalTax,
      totalAmount: taxResult.grandTotal,
      taxCategory,
      buyerNTN: isFiler ? buyerNTN : undefined,
      buyerCNIC: !isFiler ? buyerCNIC : undefined,
      isFiler
    });

    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-transparent dark:border-white/10 w-full max-w-xl overflow-hidden animate-scaleUp my-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Record Sale & FBR Tax Invoice</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                  STA 1990 Automated
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Statutory 18% GST auto-imposed with SRO 1805(I)/2024 compliance auto-check
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Compliance Auto-check Toggle Switch Banner */}
          <div className={`p-3 rounded-xl border transition-all ${
            complianceAutoCheck
              ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
              : 'bg-slate-100 border-slate-300 text-slate-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  complianceAutoCheck ? 'bg-indigo-600 text-white' : 'bg-slate-400 text-white'
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Compliance Auto-Check
                    </span>
                    {complianceAutoCheck ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Enforcing
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-400 text-white text-[10px] font-bold">
                        Bypassed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-80">
                    Auto-calculates statutory 18% GST and locks finalization until buyer NTN/CNIC format is valid
                  </p>
                </div>
              </div>

              {/* Interactive Toggle Control */}
              <button
                type="button"
                onClick={() => setComplianceAutoCheck(!complianceAutoCheck)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  complianceAutoCheck
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-300 hover:bg-slate-400 text-slate-800'
                }`}
              >
                {complianceAutoCheck ? (
                  <>
                    <ToggleRight className="w-4 h-4" />
                    <span>ON</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4" />
                    <span>OFF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Customer Selection & Buyer Tax Details */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Customer / Buyer Mill *
              </label>
              <button
                type="button"
                onClick={() => openModal('customer')}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                + Add New Customer
              </button>
            </div>
            <AccountCombobox
              options={customers.map(c => ({
                key: c.id,
                label: c.name,
                hint: `${c.city} · Receivables: Rs. ${(c.outstandingReceivables || 0).toLocaleString()}`,
                group: 'Customers & Mills'
              }))}
              value={customerId}
              onSelect={(o) => setCustomerId(o.key)}
              placeholder={customers.length === 0 ? 'No customers yet — click + Add New Customer' : 'Search customers by name or city…'}
              searchPlaceholder="Type customer name or city…  (↑↓ browse · Enter select · Esc close)"
              ariaLabel="Search customers"
              listWidthClassName="w-full"
              renderTrigger={(sel) =>
                sel ? `${sel.label} — ${sel.hint}` : (customers.length === 0 ? 'No customers yet — click + Add New Customer' : 'Select customer…')
              }
            />
          </div>

          {/* Tax Category Selector (Uses calculateFBRTaxByCategory) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                FBR Statutory Tax Category *
              </label>
              <span className="text-[11px] font-semibold text-indigo-700">
                STA 1990 Rates
              </span>
            </div>
            <select
              value={taxCategory}
              onChange={(e) => handleTaxCategoryChange(e.target.value as FBRTaxCategory)}
              className="w-full px-3.5 py-2.5 text-sm field-input font-medium text-slate-900"
            >
              <option value="standard_18">Standard Supply @ 18% GST (Active Taxpayer)</option>
              <option value="unregistered_buyer">Unregistered Buyer @ 18% GST + 4% Further Tax (22% Total)</option>
              <option value="textile_finished">Textile Finished Goods @ 18% GST</option>
              <option value="reduced_rate">Eighth Schedule Concession @ 10% GST</option>
              <option value="zero_rated_export">Fifth Schedule (0% Export Duty)</option>
              <option value="exempt">Sixth Schedule (0% Tax Exempt)</option>
            </select>
          </div>

          {/* Customer NTN / CNIC Input with Real-Time Validation */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                {isFiler ? 'Buyer Corporate NTN (7 or 8 Digits)' : 'Buyer National CNIC (13 Digits)'}:
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isIdentifierValid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : complianceAutoCheck
                  ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {isIdentifierValid ? '✓ Valid Format' : '✗ Invalid Format'}
              </span>
            </div>

            {isFiler ? (
              <div>
                <input
                  type="text"
                  value={buyerNTN}
                  onChange={(e) => setBuyerNTN(e.target.value)}
                  placeholder="e.g. 1928471-2"
                  className={`w-full px-3 py-2 text-xs font-mono font-bold bg-white border rounded-lg outline-none ${
                    ntnValidation.valid
                      ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                      : complianceAutoCheck
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                      : 'border-slate-300'
                  }`}
                />
                {!ntnValidation.valid && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {ntnValidation.message}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={buyerCNIC}
                  onChange={(e) => setBuyerCNIC(e.target.value)}
                  placeholder="e.g. 35201-9876543-1"
                  className={`w-full px-3 py-2 text-xs font-mono font-bold bg-white border rounded-lg outline-none ${
                    cnicValidation.valid
                      ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                      : complianceAutoCheck
                      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                      : 'border-slate-300'
                  }`}
                />
                {!cnicValidation.valid && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {cnicValidation.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Product Selection */}
          <div>
            <label className="field-label">
              Finished Goods / Product *
            </label>
            <AccountCombobox
              options={products.map(p => ({
                key: p.id,
                label: p.name,
                hint: `${p.sku} · In stock: ${p.currentStock} ${p.unit} · Rs. ${(p.sellingPrice || 0).toLocaleString()}/${p.unit}`,
                group: 'Finished Goods'
              }))}
              value={productId}
              onSelect={(o) => setProductId(o.key)}
              placeholder={products.length === 0 ? 'No products registered yet' : 'Search products by name or SKU…'}
              searchPlaceholder="Type product name or SKU…  (↑↓ browse · Enter select · Esc close)"
              ariaLabel="Search products"
              listWidthClassName="w-full"
              renderTrigger={(sel) => (sel ? `${sel.label} — ${sel.hint}` : 'Select product…')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">
                Dispatched Quantity ({selectedProduct?.unit || 'units'}) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white border rounded-lg focus:ring-2 outline-none font-mono font-bold text-slate-900 ${
                  hasInsufficientStock
                    ? 'border-red-500 focus:ring-red-500/20 focus:border-red-600'
                    : 'border-slate-300 focus:ring-indigo-500/20 focus:border-indigo-600'
                }`}
              />
              {hasInsufficientStock && (
                <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Insufficient stock! Only {currentStock} {selectedProduct?.unit} available.
                </p>
              )}
            </div>

            <div>
              <label className="field-label">
                Unit Sale Price (PKR)
              </label>
              <div className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono text-slate-800 font-semibold">
                Rs. {(unitPrice || 0).toLocaleString()} / {selectedProduct?.unit}
              </div>
            </div>
          </div>

          {/* Automated FBR Tax Breakdown (calculateFBRTaxByCategory Result) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200 pb-1.5">
              <span>Statutory Tax Breakdown</span>
              <span className="font-mono text-emerald-700">FBR SRO 1805(I)/2024 Verified</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal (Pre-tax supplies):</span>
              <span className="font-mono font-semibold text-slate-900">{formatPKR(taxResult.subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-indigo-700 font-medium">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Sales Tax (GST @ {taxResult.gstRate}%):
              </span>
              <span className="font-mono font-bold text-indigo-800">+ {formatPKR(taxResult.gstAmount)}</span>
            </div>

            {taxResult.additionalTaxAmount > 0 && (
              <div className="flex items-center justify-between text-amber-700 font-medium">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Further Tax (@ {taxResult.additionalTaxRate}% - Unregistered):
                </span>
                <span className="font-mono font-bold text-amber-800">+ {formatPKR(taxResult.additionalTaxAmount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-slate-900">
              <span>Invoice Grand Total:</span>
              <span className="text-base font-mono font-extrabold text-indigo-700">
                {formatPKR(taxResult.grandTotal)}
              </span>
            </div>

            <div className="mt-1 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
              <span className="font-semibold text-slate-700">Statutory Notice: </span>
              <span>{taxResult.statutoryNotice}</span>
            </div>
          </div>

          {/* Compliance Block Warning if Auto-Check is active and format invalid */}
          {complianceBlocked && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">FBR Compliance Auto-Check Gate Active:</span>
                Sale cannot be finalized until customer has a valid {isFiler ? '7/8-digit NTN' : '13-digit CNIC'} format.
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={hasInsufficientStock || quantity <= 0 || complianceBlocked}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer ${
                complianceBlocked
                  ? 'bg-slate-400 cursor-not-allowed opacity-75'
                  : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'
              }`}
              title={complianceBlocked ? 'FBR Compliance Check Blocked' : 'Issue Invoice'}
            >
              <Check className="w-4 h-4" />
              <span>
                {complianceBlocked
                  ? 'Locked: Valid NTN/CNIC Required'
                  : 'Issue FBR Tax Invoice & Dispatch'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
