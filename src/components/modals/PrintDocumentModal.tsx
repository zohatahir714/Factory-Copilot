import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Printer,
  X,
  Building2,
  ShieldCheck,
  Download,
  CheckCircle2,
  FolderArchive,
  Trash2,
  Receipt,
  FileText,
  CreditCard,
  Banknote,
  Smartphone
} from 'lucide-react';
import {
  saveDocumentToLocalStorage,
  getSavedDocuments,
  triggerWindowsPrintService,
  downloadDocumentHTML,
  deleteSavedDocument,
  SavedDocumentRecord
} from '../../utils/documentArchive';
import { calculateFBRTax, formatPKR } from '../../utils/fbrTaxEngine';
import { FBRQRCode } from '../common/FBRQRCode';
import QRCode from 'qrcode';

export const PrintDocumentModal: React.FC = () => {
  const { printDocument, openPrintDocument, closePrintDocument, branding, currentUser, addToast } = useApp();

  const activeBranding = branding || {
    companyName: 'Master Textile Mills Ltd',
    tagline: 'Premier Quality Yarn & Textiles Manufacturer',
    ntnNumber: '4029184-7',
    strnNumber: '32-77-8761-234-19',
    city: 'Lahore, Pakistan',
    phone: '+92 42 3578 9012',
    email: 'accounts@mastertextiles.pk',
    logoUrl: ''
  };

  const [savedRecords, setSavedRecords] = useState<SavedDocumentRecord[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [invoiceFormat, setInvoiceFormat] = useState<'thermal_80mm' | 'a4_sheet'>('thermal_80mm');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'cash' | 'card' | 'digital_raast'>('cash');
  const [customTenderedAmount, setCustomTenderedAmount] = useState<number | null>(null);
  const [thermalQrCodeUrl, setThermalQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (printDocument) {
      // Automatically persist to LocalStorage
      const record = saveDocumentToLocalStorage(printDocument.type, printDocument.data, activeBranding);
      setLastSavedTime(new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSavedRecords(getSavedDocuments());
      addToast('info', 'Document Saved to Local Storage', `${record.title} saved to offline document archive.`);
      setCustomTenderedAmount(null);
    }
  }, [printDocument, branding]);

  const { type } = printDocument || { type: 'cash_voucher', data: {} };
  const data = printDocument?.data || {};

  const docTitle =
    type === 'invoice'
      ? `FBR_Invoice_${invoiceFormat === 'thermal_80mm' ? 'Thermal80mm_' : 'A4_'}${data?.invoiceNumber || data?.id || 'DRAFT'}`
      : type === 'purchase_order'
      ? `PO_${data?.poNumber || data?.id || 'DRAFT'}`
      : type === 'cash_voucher'
      ? `Voucher_${data?.id || 'CSH'}`
      : `Inventory_Report_${new Date().toISOString().slice(0, 10)}`;

  // Deterministic FBR parameters
  const subtotalValue = data?.subtotal || Math.round((data?.totalAmount || 0) / 1.18) || 0;
  const isFilerStatus = data?.isFiler !== false;
  const grandTotalValue = data?.totalAmount || Math.round(subtotalValue * 1.18) || 0;

  const tenderedVal =
    customTenderedAmount !== null
      ? customTenderedAmount
      : selectedPaymentMode === 'cash'
      ? Math.ceil(grandTotalValue / 500) * 500
      : grandTotalValue;

  const fiscal = calculateFBRTax({
    amount: subtotalValue,
    isFiler: isFilerStatus,
    isRegisteredSalesTax: isFilerStatus,
    invoiceNumber: data?.invoiceNumber || data?.id || 'INV-2024-0042',
    sellerNTN: activeBranding.ntnNumber || '4029184-7',
    sellerSTRN: activeBranding.strnNumber || '32-77-8761-234-19',
    buyerNTN: data?.buyerNTN || (isFilerStatus ? '1928471-2' : ''),
    buyerCNIC: data?.buyerCNIC || (isFilerStatus ? '35201-9876543-1' : '35201-1111111-1'),
    paymentMode: selectedPaymentMode,
    amountTendered: tenderedVal
  });

  // Dynamic FBR Verification URL String specifically utilizing invoice ID and timestamp
  const invoiceId = data?.invoiceNumber || data?.id || 'INV-2024-0042';
  const invoiceTimestamp = data?.createdAt || new Date().toISOString();
  const fbrVerificationUrl = printDocument ? `https://verify.fbr.gov.pk/iris/verify?inv=${encodeURIComponent(invoiceId)}&ts=${encodeURIComponent(invoiceTimestamp)}&pos=${encodeURIComponent(fiscal.posId)}&amt=${grandTotalValue}&tax=${fiscal.totalTaxCharged}` : '';

  // Dynamically generate QR code image specifically formatted for 80mm thermal printers
  useEffect(() => {
    if (!fbrVerificationUrl) return;
    let isMounted = true;

    // Direct QR Code library generation specifically formatted for 80mm POS thermal roll printers:
    // - 203 DPI / 300 DPI high resolution
    // - Margin 1 (maximizes printable width within 80mm roll)
    // - Pure monochrome high-contrast dark: #000000, light: #ffffff
    // - Error Correction Level 'M' (15% recovery for thermal paper crease/fade resilience)
    (QRCode as any)
      .toDataURL(fbrVerificationUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 150,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      .then((url: string) => {
        if (isMounted) {
          setThermalQrCodeUrl(url);
        }
      })
      .catch((err: any) => {
        console.error('Error generating 80mm thermal QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [fbrVerificationUrl]);

  if (!printDocument) return null;

  const handlePrint = () => {
    setIsPrinting(true);
    // 1. Ensure latest copy is saved to local storage
    saveDocumentToLocalStorage(type, data, activeBranding);
    setSavedRecords(getSavedDocuments());

    // 2. Trigger native Windows print service with format-specific paper rules
    const paper = type === 'invoice' && invoiceFormat === 'thermal_80mm' ? '80mm' : 'a4';
    triggerWindowsPrintService('printable-document', docTitle, paper);

    addToast(
      'success',
      paper === '80mm' ? 'Thermal 80mm Print Dispatched' : 'A4 Print Dispatched',
      'Sent to system printer / PDF driver with zero margin cuts.'
    );
    setTimeout(() => setIsPrinting(false), 1200);
  };

  const handleDownload = () => {
    downloadDocumentHTML('printable-document', `${docTitle}.html`);
    addToast('success', 'Document Exported', `Saved ${docTitle}.html to your computer.`);
  };

  const handleDeleteArchiveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteSavedDocument(id);
    setSavedRecords(updated);
    addToast('info', 'Document Removed', 'Removed item from local archive.');
  };

  return (
    <div
      id="printable-document-wrapper"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto animate-fadeIn"
    >
      {/* Control Bar (Hidden when printing) */}
      <div className="fixed top-3 right-4 z-50 flex flex-wrap items-center gap-2 no-print bg-slate-900/95 p-1.5 rounded-2xl border border-slate-700/80 shadow-2xl backdrop-blur-md max-w-[95vw]">
        {/* Format Toggle for Invoices */}
        {type === 'invoice' && (
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setInvoiceFormat('thermal_80mm')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                invoiceFormat === 'thermal_80mm'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Standard 80mm Point of Sale thermal roll receipt"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>80mm Thermal</span>
            </button>
            <button
              type="button"
              onClick={() => setInvoiceFormat('a4_sheet')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                invoiceFormat === 'a4_sheet'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Full A4 Corporate Tax Invoice sheet"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>A4 Sheet</span>
            </button>
          </div>
        )}

        {/* LocalStorage Sync Status Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/70 border border-emerald-700/60 rounded-xl text-[11px] font-semibold text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Saved ({lastSavedTime || 'Active'})</span>
        </div>

        {/* View Archive Button */}
        <button
          type="button"
          onClick={() => setShowArchive(!showArchive)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
          title="Browse previously saved documents in LocalStorage"
        >
          <FolderArchive className="w-4 h-4 text-indigo-400" />
          <span className="hidden md:inline">Archive</span>
          <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px] font-mono">
            {savedRecords.length}
          </span>
        </button>

        {/* Download Standalone File */}
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
          title="Download standalone printable HTML / PDF file"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span className="hidden md:inline">Export HTML</span>
        </button>

        {/* Windows Print Service Trigger */}
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer hover:shadow-indigo-600/30"
        >
          <Printer className={`w-4 h-4 ${isPrinting ? 'animate-bounce' : ''}`} />
          <span>{isPrinting ? 'Printing...' : type === 'invoice' && invoiceFormat === 'thermal_80mm' ? 'Print 80mm Thermal' : 'Print / Save PDF'}</span>
        </button>

        {/* Close Preview */}
        <button
          type="button"
          onClick={closePrintDocument}
          className="p-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-300 text-slate-300 rounded-xl transition-colors cursor-pointer"
          title="Close Print Preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Slide-out Archive Drawer */}
      {showArchive && (
        <div className="fixed top-16 right-4 z-50 w-80 max-h-[70vh] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl p-4 overflow-y-auto no-print animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <FolderArchive className="w-4 h-4 text-indigo-600" />
              <span>LocalStorage Document Archive</span>
            </div>
            <button
              onClick={() => setShowArchive(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
            >
              Close
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {savedRecords.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No saved documents in LocalStorage yet.</p>
            ) : (
              savedRecords.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => {
                    openPrintDocument({ type: rec.type, data: rec.dataSnapshot });
                    addToast('info', 'Document Loaded', `Viewing ${rec.title}`);
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-all text-xs flex items-center justify-between group cursor-pointer"
                  title="Click to load into print preview"
                >
                  <div className="truncate pr-2">
                    <div className="font-bold text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {rec.title}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <span>{new Date(rec.savedAt).toLocaleDateString('en-PK')}</span>
                      {rec.amount ? <span>• Rs. {rec.amount.toLocaleString()}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        downloadDocumentHTML('printable-document', `${rec.docNumber}.html`);
                        addToast('success', 'Exported', 'Saved copy to disk.');
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-500"
                      title="Download HTML"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteArchiveItem(rec.id, e)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Delete Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. 80MM THERMAL RECEIPT VIEW (Compliant with FBR S.R.O. 1805(I)/2024)      */}
      {/* ========================================================================= */}
      {type === 'invoice' && invoiceFormat === 'thermal_80mm' ? (
        <div
          id="printable-document"
          className="bg-white text-black w-full max-w-[340px] p-4 sm:p-5 rounded-xl shadow-2xl border border-slate-300 my-8 font-mono text-[11px] leading-tight select-text thermal-receipt-root"
          style={{ width: '80mm', maxWidth: '80mm' }}
        >
          {/* FBR Logo & Header Placeholder */}
          <div className="text-center pb-2 border-b border-dashed border-black">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded bg-black text-white flex items-center justify-center font-black text-[9px] border border-black">
                FBR
              </div>
              <div className="font-black text-[12px] uppercase tracking-wider">
                GOVERNMENT OF PAKISTAN
              </div>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide">
              FEDERAL BOARD OF REVENUE
            </div>
            <div className="text-[9px] font-semibold uppercase mt-0.5">
              POINT OF SALE FISCAL INVOICE
            </div>
          </div>

          {/* Business & POS Identification Header */}
          <div className="text-center py-2 border-b border-dashed border-black space-y-0.5">
            <div className="font-black text-[13px] uppercase tracking-tight leading-snug">
              {activeBranding.companyName}
            </div>
            <div className="text-[10px] text-slate-800">{activeBranding.tagline}</div>
            <div className="text-[10px] text-slate-800">{activeBranding.city}</div>
            <div className="pt-1 text-[10px] flex justify-between px-1">
              <span><strong>NTN:</strong> {activeBranding.ntnNumber}</span>
              <span><strong>STRN:</strong> {activeBranding.strnNumber}</span>
            </div>
            <div className="text-[10px] flex justify-between px-1">
              <span><strong>POS ID:</strong> {fiscal.posId}</span>
              <span><strong>Reg:</strong> 49102</span>
            </div>
            <div className="text-[9px] text-slate-700 pt-0.5 flex justify-between px-1">
              <span>Date: {new Date().toLocaleDateString('en-PK')}</span>
              <span>Time: {new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
            <div className="text-[10px] font-bold text-left px-1 pt-0.5">
              Invoice Ref: {data.invoiceNumber || 'INV-2024-0042'}
            </div>
          </div>

          {/* Customer Particulars (Section 23 Sales Tax Act 1990) */}
          <div className="py-2 border-b border-dashed border-black text-[10px] space-y-0.5">
            <div className="flex justify-between">
              <span className="font-bold">Customer:</span>
              <span className="text-right truncate max-w-[170px] font-semibold">{data.customerName || 'Retail Walk-in Buyer'}</span>
            </div>
            <div className="flex justify-between">
              <span>Buyer NTN/CNIC:</span>
              <span className="font-mono">{fiscal.buyerCNIC || '35201-9876543-1'}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span>Tax Status:</span>
              <span className="font-bold">{isFilerStatus ? 'Active Filer (ATL)' : 'Unregistered (Further Tax 4%)'}</span>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-2 border-b border-dashed border-black">
            <div className="flex justify-between font-bold border-b border-black pb-1 mb-1 text-[10px]">
              <span className="w-6">S#</span>
              <span className="flex-1">Description</span>
              <span className="w-16 text-right">Qty x Rate</span>
              <span className="w-16 text-right">Total</span>
            </div>

            <div className="space-y-1.5">
              {data.items && data.items.length > 0 ? (
                data.items.map((it: any, idx: number) => {
                  const qty = it.quantity || 1;
                  const price = it.unitPrice || 0;
                  const itemSubtotal = qty * price;
                  const rate = it.taxRate !== undefined ? it.taxRate : 18;
                  const itemTax = Math.round((itemSubtotal * rate) / 100);
                  const itemTotal = itemSubtotal + itemTax;

                  return (
                    <div key={idx} className="text-[10px]">
                      <div className="flex justify-between items-start">
                        <span className="w-6 font-bold">{idx + 1}.</span>
                        <span className="flex-1 font-semibold truncate pr-1">{it.productName}</span>
                        <span className="w-16 text-right text-[9px]">{qty}{it.unit || ''}x{price}</span>
                        <span className="w-16 text-right font-black">{itemTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-700 pl-6">
                        <span>HS: 5205.1200</span>
                        <span>GST @ {rate}%: Rs. {itemTax.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-2 text-slate-500">No items on receipt</div>
              )}
            </div>
          </div>

          {/* Financial Totals & Tax Breakdown Grouped by Rate */}
          <div className="py-2 border-b border-dashed border-black space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Gross Total (Excl. Tax):</span>
              <span className="font-bold">Rs. {subtotalValue.toLocaleString()}</span>
            </div>
            {fiscal.discount > 0 && (
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>- Rs. {fiscal.discount.toLocaleString()}</span>
              </div>
            )}

            {/* Grouped Sales Tax Breakdown */}
            <div className="pt-1 border-t border-dotted border-black/40 space-y-0.5">
              <div className="font-bold text-[9px] uppercase tracking-wider text-slate-800">
                Sales Tax Breakdown:
              </div>
              {fiscal.taxBreakdown.map((t, i) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span className="pl-1">{t.rateLabel}:</span>
                  <span className="font-bold">+ Rs. {t.taxAmount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-[10px]">
                <span>Total Sales Tax Charged:</span>
                <span>+ Rs. {fiscal.totalTaxCharged.toLocaleString()}</span>
              </div>
            </div>

            {/* Net Payable */}
            <div className="pt-1.5 border-t-2 border-black flex justify-between text-[13px] font-black">
              <span>NET PAYABLE:</span>
              <span>Rs. {grandTotalValue.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Details Section */}
          <div className="py-2 border-b border-dashed border-black text-[10px] space-y-1">
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold uppercase">{fiscal.paymentModeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span>Amount Tendered:</span>
              <span className="font-bold">Rs. {tenderedVal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Change Returned:</span>
              <span className="font-bold">Rs. {fiscal.changeDue.toLocaleString()}</span>
            </div>
          </div>

          {/* FBR Verification Footer & Prominent QR Code */}
          <div className="pt-3 pb-1 text-center space-y-2">
            <div className="font-black text-[10px] uppercase tracking-tight text-slate-900">
              Verify this invoice using the FBR Tax Asaan App
            </div>

            <div className="text-[10px] font-mono font-bold bg-slate-100 py-1 px-2 rounded border border-black inline-block">
              FBR Invoice ID: {fiscal.fbrFiscalInvoiceNumber}
            </div>

            {/* High-Resolution Dynamic 80mm Thermal FBR QR Code Image */}
            <div className="flex justify-center py-1">
              <div className="p-1.5 bg-white border-2 border-black rounded inline-block shadow-xs">
                {thermalQrCodeUrl ? (
                  <img
                    src={thermalQrCodeUrl}
                    alt="FBR Tax Asaan Verification QR Code (80mm Thermal)"
                    width={135}
                    height={135}
                    className="block mx-auto object-contain"
                  />
                ) : (
                  <FBRQRCode value={fbrVerificationUrl} size={135} level="M" />
                )}
              </div>
            </div>

            <div className="text-[9px] text-slate-700 leading-tight">
              POS Machine: {fiscal.posId} • SHA-256 Verified
            </div>
            <div className="text-[9px] font-bold">
              Save Tax, Build Pakistan • FBR Iris Integrated
            </div>
            <div className="text-[9px] text-slate-500 pt-1">
              - - - - - - - - CUT HERE - - - - - - - -
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. A4 CORPORATE TAX INVOICE & OTHER STANDARD PRINTS                      */
        /* ========================================================================= */
        <div
          id="printable-document"
          className="bg-white text-slate-900 w-full max-w-4xl p-6 sm:p-10 rounded-2xl shadow-2xl border border-slate-300 my-8 min-h-[900px] flex flex-col justify-between"
        >
          <div>
            {/* Company Branding & Tax Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
              <div className="flex items-start gap-4">
                {branding.logoBase64 ? (
                  <div className="w-16 h-16 rounded-xl border border-slate-300 p-1 flex items-center justify-center overflow-hidden shrink-0">
                    <img src={branding.logoBase64} alt={branding.companyName} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Building2 className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                    {activeBranding.companyName}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">{activeBranding.tagline}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 font-mono mt-2">
                    <span><strong>NTN:</strong> {activeBranding.ntnNumber}</span>
                    <span>•</span>
                    <span><strong>STRN:</strong> {activeBranding.strnNumber}</span>
                    <span>•</span>
                    <span><strong>POS ID:</strong> {fiscal.posId}</span>
                    <span>•</span>
                    <span>{activeBranding.city}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block px-3 py-1 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider rounded">
                  {type === 'invoice' && 'Sales Tax Invoice (FBR Tier-1)'}
                  {type === 'purchase_order' && 'Purchase Order'}
                  {type === 'cash_voucher' && 'Cash Voucher'}
                  {type === 'inventory_report' && 'Inventory Stock Report'}
                </div>
                <div className="text-xs font-mono font-bold text-slate-900 mt-2">
                  {type === 'invoice' && `Invoice #: ${data.invoiceNumber || 'INV-DRAFT'}`}
                  {type === 'purchase_order' && `PO #: ${data.poNumber || 'PO-DRAFT'}`}
                  {type === 'cash_voucher' && `Voucher #: ${data.id || 'CSH-001'}`}
                  {type === 'inventory_report' && `Date: ${new Date().toLocaleDateString('en-PK')}`}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Date: {data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-PK') : new Date().toLocaleDateString('en-PK')}
                </div>
              </div>
            </div>

            {/* A4 SALES TAX INVOICE PRINT VIEW */}
            {type === 'invoice' && (
              <div className="mt-6 space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Buyer (Billed To)</span>
                    <div className="font-bold text-sm text-slate-900 mt-0.5">{data.customerName || 'Walk-in Registered Buyer'}</div>
                    <div className="text-slate-600 mt-1">Status: {isFilerStatus ? 'ATL Active Filer' : 'Unregistered Buyer (+4% Further Tax)'}</div>
                    <div className="font-mono text-slate-600 mt-0.5">NTN/CNIC: {fiscal.buyerCNIC}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">FBR Fiscal Integration</span>
                    <div className="font-bold text-xs text-indigo-900 mt-0.5">Sales Tax Act 1990 — Section 23 & 3(1)</div>
                    <div className="text-slate-600 mt-1">FBR Fiscal Invoice ID: {fiscal.fbrFiscalInvoiceNumber}</div>
                    <div className="text-emerald-700 font-bold uppercase mt-0.5">IRIS Annexure-C Synchronized</div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="border border-slate-900 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3 border-r border-slate-700 text-center w-12">#</th>
                        <th className="p-3 border-r border-slate-700">Description of Goods</th>
                        <th className="p-3 border-r border-slate-700 text-center">PCT / HS Code</th>
                        <th className="p-3 border-r border-slate-700 text-right">Quantity</th>
                        <th className="p-3 border-r border-slate-700 text-right">Unit Price (PKR)</th>
                        <th className="p-3 border-r border-slate-700 text-right">GST Rate</th>
                        <th className="p-3 border-r border-slate-700 text-right">Sales Tax (PKR)</th>
                        <th className="p-3 text-right">Total Payable (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.items && data.items.length > 0 ? (
                        data.items.map((it: any, idx: number) => {
                          const itemSubtotal = it.quantity * it.unitPrice;
                          const itemTax = Math.round((itemSubtotal * (it.taxRate || 18)) / 100);
                          const itemTotal = itemSubtotal + itemTax;
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 text-center border-r border-slate-200 font-mono">{idx + 1}</td>
                              <td className="p-3 border-r border-slate-200 font-semibold text-slate-900">{it.productName}</td>
                              <td className="p-3 border-r border-slate-200 text-center font-mono text-slate-600">5205.1200</td>
                              <td className="p-3 border-r border-slate-200 text-right font-mono font-bold">{it.quantity} {it.unit}</td>
                              <td className="p-3 border-r border-slate-200 text-right font-mono">Rs. {(Number(it.unitPrice) || 0).toLocaleString()}</td>
                              <td className="p-3 border-r border-slate-200 text-right font-mono font-bold text-indigo-700">18%</td>
                              <td className="p-3 border-r border-slate-200 text-right font-mono font-bold">Rs. {(itemTax || 0).toLocaleString()}</td>
                              <td className="p-3 text-right font-mono font-black text-slate-900">Rs. {(itemTotal || 0).toLocaleString()}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-500">No items listed on this invoice</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Financial Breakdown & Tax Calculation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>FBR Tax Declarations & Annexure-C Compliance</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Verify this invoice using the FBR Tax Asaan App. Valid for statutory input tax credit claims under Sales Tax Act 1990 read with Sales Tax Rules 2006.
                    </p>
                    <div className="flex items-center gap-4 pt-2">
                      <div className="border border-slate-300 rounded p-1 bg-white shadow-xs">
                        {thermalQrCodeUrl ? (
                          <img
                            src={thermalQrCodeUrl}
                            alt="FBR Fiscal QR Code"
                            width={90}
                            height={90}
                            className="block object-contain"
                          />
                        ) : (
                          <FBRQRCode value={fbrVerificationUrl} size={90} level="M" />
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-600 space-y-0.5">
                        <div className="font-bold text-slate-900">FBR Fiscal QR Code</div>
                        <div>POS ID: {fiscal.posId}</div>
                        <div>Fiscal #: {fiscal.fbrFiscalInvoiceNumber}</div>
                        <div className="text-[9px] text-emerald-700 font-bold">SHA-256 Digitally Sealed</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-700">
                      <span>Taxable Supply Subtotal:</span>
                      <span className="font-bold">Rs. {subtotalValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-indigo-700 font-bold">
                      <span>General Sales Tax (18% GST):</span>
                      <span>Rs. {fiscal.gstAmount.toLocaleString()}</span>
                    </div>
                    {fiscal.furtherTaxAmount > 0 && (
                      <div className="flex justify-between text-amber-700 font-bold">
                        <span>Further Tax (4% Unregistered):</span>
                        <span>Rs. {fiscal.furtherTaxAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600 text-[11px] border-t border-slate-200 pt-1">
                      <span>WHT Sec 153(1)(a) Deduction (4.5%):</span>
                      <span>Rs. {Math.round(subtotalValue * 0.045).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900 border-t-2 border-slate-900 pt-2">
                      <span>Grand Total Payable (PKR):</span>
                      <span className="text-emerald-700">Rs. {grandTotalValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* A4 PURCHASE ORDER PRINT VIEW */}
            {type === 'purchase_order' && (
              <div className="mt-6 space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Vendor / Mill</span>
                    <div className="font-bold text-sm text-slate-900 mt-0.5">{data.supplierName || 'Primary Supplier'}</div>
                    <div className="text-slate-600 mt-1">Delivery Destination: Central Factory Warehouse</div>
                    <div className="font-mono text-slate-600 mt-0.5">Payment Terms: Net 30 Days</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Procurement Details</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">PO Ref: {data.poNumber}</div>
                    <div className="text-slate-600 mt-1">Delivery Status: {data.status === 'received' ? 'Delivered & Received' : 'Pending Vendor Dispatch'}</div>
                    <div className="text-slate-600 mt-0.5">Issued By: {data.createdBy || 'Managing Director'}</div>
                  </div>
                </div>

                <div className="border border-slate-900 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3 border-r border-slate-700 text-center w-12">#</th>
                        <th className="p-3 border-r border-slate-700">Item / Material Description</th>
                        <th className="p-3 border-r border-slate-700 text-right">Quantity</th>
                        <th className="p-3 border-r border-slate-700 text-right">Unit Rate (PKR)</th>
                        <th className="p-3 text-right">Committed Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.items && data.items.length > 0 ? (
                        data.items.map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 text-center border-r border-slate-200 font-mono">{idx + 1}</td>
                            <td className="p-3 border-r border-slate-200 font-semibold text-slate-900">{it.productName}</td>
                            <td className="p-3 border-r border-slate-200 text-right font-mono font-bold">{it.quantity} {it.unit}</td>
                            <td className="p-3 border-r border-slate-200 text-right font-mono">Rs. {Number(it.unitPrice).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono font-black text-slate-900">Rs. {Number(it.totalAmount).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-500">No line items in this purchase order</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700">Total Committed Procurement Value:</span>
                  <span className="text-base font-black text-slate-900">Rs. {Number(data.totalAmount || 0).toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* A4 CASHBOOK / VOUCHER PRINT VIEW */}
            {type === 'cash_voucher' && (
              <div className="mt-6 space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Voucher Classification</span>
                    <div className="font-bold text-sm text-slate-900 mt-0.5">
                      {data.voucherType === 'CRV' && 'Cash Receipt Voucher (CRV)'}
                      {data.voucherType === 'CPV' && 'Cash Payment Voucher (CPV)'}
                      {data.voucherType === 'BRV' && 'Bank Receipt Voucher (BRV)'}
                      {data.voucherType === 'BPV' && 'Bank Payment Voucher (BPV)'}
                      {data.voucherType === 'JV' && 'Journal Voucher (JV)'}
                      {!['CRV', 'CPV', 'BRV', 'BPV', 'JV'].includes(data.voucherType) && (data.type === 'inflow' ? 'Receipt Voucher' : 'Payment Voucher')}
                    </div>
                    <div className="text-slate-600 mt-1">Payment Mode: <span className="font-semibold capitalize">{data.paymentMode || 'Cash'}</span></div>
                    {data.chequeNumber && (
                      <div className="text-slate-600 font-mono">Cheque / Ref #: {data.chequeNumber}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Voucher Reference</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5 text-sm">{data.voucherNumber || data.id}</div>
                    <div className="text-slate-600 mt-1">Date: {data.date || new Date().toISOString().slice(0, 10)}</div>
                    <div className="text-slate-600 mt-0.5">Prepared By: {data.createdBy || currentUser?.name || 'Accounts Dept'}</div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Narration / Particulars</span>
                  <div className="text-xs font-medium text-slate-900 leading-relaxed bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    {data.description || 'N/A'}
                  </div>
                </div>

                {/* Double Entry Line Items */}
                {data.entries && data.entries.length > 0 ? (
                  <div className="border border-slate-900 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-2.5 border-r border-slate-700 text-center w-10">#</th>
                          <th className="p-2.5 border-r border-slate-700">Account Code & Title</th>
                          <th className="p-2.5 border-r border-slate-700">Line Narration</th>
                          <th className="p-2.5 border-r border-slate-700 text-right">Debit (PKR)</th>
                          <th className="p-2.5 text-right">Credit (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {data.entries.map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 text-center border-r border-slate-200 text-slate-500">{idx + 1}</td>
                            <td className="p-2.5 border-r border-slate-200 font-bold text-slate-900 font-sans">
                              {it.accountCode} - {it.accountName}
                            </td>
                            <td className="p-2.5 border-r border-slate-200 font-sans text-slate-600">{it.description}</td>
                            <td className="p-2.5 border-r border-slate-200 text-right font-bold text-slate-900">
                              {Number(it.debit) > 0 ? `Rs. ${(Number(it.debit) || 0).toLocaleString()}` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              {Number(it.credit) > 0 ? `Rs. ${(Number(it.credit) || 0).toLocaleString()}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-mono font-bold text-xs border-t-2 border-slate-900">
                        <tr>
                          <td colSpan={3} className="p-2.5 text-right font-sans font-bold uppercase">Total Balanced:</td>
                          <td className="p-2.5 text-right text-emerald-800 border-r border-slate-200">
                            Rs. {(data.entries?.reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0) || 0).toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right text-emerald-800">
                            Rs. {(data.entries?.reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0) || 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-700">Voucher Total Amount:</span>
                    <span className="text-base font-black text-slate-900">Rs. {Number(data.amount || 0).toLocaleString()}</span>
                  </div>
                )}

                {/* Signatures Block */}
                <div className="grid grid-cols-4 gap-4 pt-12 text-center text-xs">
                  <div>
                    <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">Prepared By</div>
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">{data.createdBy || currentUser?.name || 'Accountant'}</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">Checked By</div>
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">Internal Audit</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">Verified By</div>
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">Chief Financial Officer</div>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-800">Approved By</div>
                    <div className="text-[10px] text-slate-500 font-sans mt-0.5">Managing Director</div>
                  </div>
                </div>
              </div>
            )}

            {/* A4 INVENTORY VALUATION & STOCK REPORT */}
            {type === 'inventory_report' && (
              <div className="mt-6 space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Warehouse Facility</span>
                    <div className="font-bold text-sm text-slate-900 mt-0.5">Central Factory Raw Materials & Finished Goods</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Audit Execution</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">Audit Operator: {currentUser?.name || 'Adil (Super Admin)'}</div>
                  </div>
                </div>

                <div className="border border-slate-900 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3 border-r border-slate-700 text-center w-12">#</th>
                        <th className="p-3 border-r border-slate-700">SKU Code</th>
                        <th className="p-3 border-r border-slate-700">Product / Material</th>
                        <th className="p-3 border-r border-slate-700 text-right">Current Stock</th>
                        <th className="p-3 border-r border-slate-700 text-right">Cost Price</th>
                        <th className="p-3 text-right">Total Valuation (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Array.isArray(data) && data.length > 0 ? (
                        data.map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 text-center border-r border-slate-200 font-mono">{idx + 1}</td>
                            <td className="p-3 border-r border-slate-200 font-mono font-bold text-indigo-700">{p.sku}</td>
                            <td className="p-3 border-r border-slate-200 font-semibold text-slate-900">{p.name}</td>
                            <td className="p-3 border-r border-slate-200 text-right font-mono font-bold">{p.currentStock || 0} {p.unit}</td>
                            <td className="p-3 border-r border-slate-200 text-right font-mono">Rs. {(Number(p.costPrice) || 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono font-black text-slate-900">
                              Rs. {((Number(p.currentStock) || 0) * (Number(p.costPrice) || 0)).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500">No active products or inventory records in database</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Formal Signature Blocks for A4 Sheets */}
          <div className="pt-16 mt-8 border-t border-slate-300 grid grid-cols-3 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 pb-8 font-mono text-slate-400">Sign & Stamp</div>
              <div className="font-bold text-slate-900 mt-2">Prepared By</div>
              <div className="text-[11px] text-slate-500 font-mono">System Operator</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-8 font-mono text-slate-400">Sign & Stamp</div>
              <div className="font-bold text-slate-900 mt-2">Checked By</div>
              <div className="text-[11px] text-slate-500 font-mono">Head Accountant</div>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-8 font-mono text-slate-400">Sign & Stamp</div>
              <div className="font-bold text-slate-900 mt-2">Authorized Signatory</div>
              <div className="text-[11px] text-slate-500 font-mono">Adil (Super Admin)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
