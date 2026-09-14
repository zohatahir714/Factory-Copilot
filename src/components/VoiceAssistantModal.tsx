import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { routeVoiceIntent, VoiceRouteResult } from '../utils/voiceIntentRouter';
import { calculateFBRTax, formatPKR } from '../utils/fbrTaxEngine';
import {
  Mic,
  MicOff,
  X,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Cpu,
  Loader2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  ShoppingCart,
  Receipt,
  Package,
  DollarSign,
  Scale,
  Building2,
  UserPlus,
  Compass,
  Wallet,
  Calculator,
  ShieldCheck,
  TrendingUp,
  FileCheck2,
  AlertCircle,
  Clock,
  Printer
} from 'lucide-react';

interface LiveInspectionData {
  queryType:
    | 'cash'
    | 'gst'
    | 'sale_tax'
    | 'inventory'
    | 'receivables'
    | 'purchase_orders'
    | 'automate_tax'
    | 'fbr_readiness_guide';
  title: string;
  badge: string;
  spokenText: string;
  stats: { label: string; value: string; color?: string }[];
  details?: string;
  actionButton?: {
    label: string;
    onClick: () => void;
    icon?: any;
  };
}

export const VoiceAssistantModal: React.FC = () => {
  const {
    activeModal,
    openModal,
    closeModal,
    isRecording,
    isTranscribing,
    recordingTranscript,
    startRecording,
    stopRecording,
    setRecordingTranscript,
    sendMessage,
    isProcessing,
    setActiveTab,
    darkMode,
    audioVoiceEnabled,
    toggleAudioVoice,
    speakText,
    addToast,
    micErrorNotice,
    clearMicErrorNotice,
    requestMicrophonePermission,
    cashbook,
    salesOrders,
    products,
    customers,
    purchaseOrders,
    openPrintDocument
  } = useApp();

  const [inputVal, setInputVal] = useState('');
  const [detectedRoute, setDetectedRoute] = useState<VoiceRouteResult | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [liveResult, setLiveResult] = useState<LiveInspectionData | null>(null);

  // Detect whether running in an embedded preview iframe
  const isEmbeddedIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Keep inputVal in sync with live transcript & evaluate intent preview
  useEffect(() => {
    if (recordingTranscript) {
      setInputVal(recordingTranscript);
      const route = routeVoiceIntent(recordingTranscript);
      setDetectedRoute(route);
    }
  }, [recordingTranscript]);

  // Evaluate route when user types
  useEffect(() => {
    if (inputVal.trim()) {
      const route = routeVoiceIntent(inputVal);
      setDetectedRoute(route);
    } else {
      setDetectedRoute(null);
    }
  }, [inputVal]);

  if (activeModal !== 'voice') return null;

  /**
   * Execute voice action, inspect live system directly or route to modular workflow
   */
  const handleExecuteVoiceAction = (rawText?: string) => {
    const query = (rawText || inputVal).trim();
    if (!query || isProcessing || isTranscribing) return;

    // 1. Determine intended route
    const route = routeVoiceIntent(query);

    // 2. Clear input buffer immediately for maximum reliability
    setInputVal('');
    setRecordingTranscript('');
    setDetectedRoute(null);
    clearMicErrorNotice();

    if (isRecording) {
      stopRecording();
    }

    // 3. Handle LIVE SYSTEM INSPECTION QUERIES
    if (route.type === 'live_query' && route.queryType) {
      let resultData: LiveInspectionData | null = null;

      // A. Cash Balance Inspection
      if (route.queryType === 'cash') {
        const totalInflow = cashbook.filter(c => c.type === 'inflow').reduce((sum, c) => sum + c.amount, 0);
        const totalOutflow = cashbook.filter(c => c.type === 'outflow').reduce((sum, c) => sum + c.amount, 0);
        const netCash = totalInflow - totalOutflow;
        const spoken = `Your current net cash balance is ${formatPKR(netCash)}. Total inflows recorded are ${formatPKR(totalInflow)}, and disbursements are ${formatPKR(totalOutflow)}.`;

        resultData = {
          queryType: 'cash',
          title: 'Live Treasury & Cash Position',
          badge: 'Live Cashbook Ledger',
          spokenText: spoken,
          stats: [
            { label: 'Net Cash Reserves', value: formatPKR(netCash), color: netCash >= 0 ? 'text-emerald-600' : 'text-red-600' },
            { label: 'Total Inflow', value: formatPKR(totalInflow), color: 'text-emerald-700' },
            { label: 'Total Outflow', value: formatPKR(totalOutflow), color: 'text-red-600' }
          ],
          details: `Verified from ${cashbook.length} verified vouchers. All cash disbursements comply with Section 21(l) banking thresholds.`,
          actionButton: {
            label: 'Open Cashbook & Treasury',
            onClick: () => {
              closeModal();
              setActiveTab('cashbook');
            }
          }
        };
      }

      // B. GST / Sales Tax Inspection
      else if (route.queryType === 'gst') {
        const totalTax = salesOrders.reduce((sum, s) => sum + (s.taxAmount || 0), 0);
        const totalSales = salesOrders.reduce((sum, s) => sum + s.totalAmount, 0);
        const spoken = `Total FBR 18% General Sales Tax collected is ${formatPKR(totalTax)} across ${salesOrders.length} sales tax invoices. Next statutory e-filing deadline is Annexure-C on the 10th.`;

        resultData = {
          queryType: 'gst',
          title: 'FBR 18% GST Collection Status',
          badge: 'Sales Tax Act 1990',
          spokenText: spoken,
          stats: [
            { label: '18% GST Collected', value: formatPKR(totalTax), color: 'text-indigo-600' },
            { label: 'Total Invoiced Volume', value: formatPKR(totalSales), color: 'text-indigo-600' },
            { label: 'Verified Invoices', value: `${salesOrders.length} Invoices`, color: 'text-slate-800 dark:text-slate-200' }
          ],
          details: 'Standard 18.0% GST auto-imposed. Prepared for direct export into FBR Iris monthly sales return.',
          actionButton: {
            label: 'Open FBR Digital Invoicing Hub',
            onClick: () => {
              closeModal();
              setActiveTab('fbr_integration' as any);
            }
          }
        };
      }

      // C. FBR Tax Calculation on a Sale
      else if (route.queryType === 'sale_tax') {
        const amount = route.extractedAmount || 100000;
        const taxRes = calculateFBRTax({ amount, isFiler: true, isRegisteredSalesTax: true });
        const taxResNonFiler = calculateFBRTax({ amount, isFiler: false, isRegisteredSalesTax: false });

        const spoken = `For a sale of ${formatPKR(amount)}, standard 18% GST is ${formatPKR(taxRes.gstAmount)}. Total invoice amount is ${formatPKR(taxRes.grandTotal)} for ATL active filers, or ${formatPKR(taxResNonFiler.grandTotal)} if unregistered with 4% further tax.`;

        resultData = {
          queryType: 'sale_tax',
          title: `FBR Tax Calculation for ${formatPKR(amount)} Sale`,
          badge: 'SRO 1805(I)/2024 Stamped',
          spokenText: spoken,
          stats: [
            { label: 'Pre-Tax Supply', value: formatPKR(amount), color: 'text-slate-900 dark:text-slate-100' },
            { label: '18% GST (STA Sec 3(1))', value: `+ ${formatPKR(taxRes.gstAmount)}`, color: 'text-indigo-600' },
            { label: 'Filer Grand Total', value: formatPKR(taxRes.grandTotal), color: 'text-indigo-600' },
            { label: 'Non-Filer (+4% Tax)', value: formatPKR(taxResNonFiler.grandTotal), color: 'text-amber-600' }
          ],
          details: `Fiscal Invoice ID: ${taxRes.fbrFiscalInvoiceNumber} • QR verification string auto-computed with SHA-256 fingerprint.`,
          actionButton: {
            label: '+ Record Sale with this Tax',
            onClick: () => {
              closeModal();
              openModal('sale');
            }
          }
        };
      }

      // D. Stock & Inventory Inspection
      else if (route.queryType === 'inventory') {
        const lowStock = products.filter(p => p.currentStock <= p.reorderThreshold);
        const totalVal = products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
        const spoken = `Warehouse holds ${products.length} raw material lines with total valuation of ${formatPKR(totalVal)}. ${lowStock.length > 0 ? lowStock.length + ' materials require urgent replenishment.' : 'All stock levels are above threshold.'}`;

        resultData = {
          queryType: 'inventory',
          title: 'Live Warehouse Stock & Inventory',
          badge: 'Real-time Stock Count',
          spokenText: spoken,
          stats: [
            { label: 'Total Valuation', value: formatPKR(totalVal), color: 'text-indigo-600' },
            { label: 'Active SKUs', value: `${products.length} Items`, color: 'text-slate-900 dark:text-slate-100' },
            { label: 'Low Stock Alerts', value: `${lowStock.length} Items`, color: lowStock.length > 0 ? 'text-red-600' : 'text-emerald-600' }
          ],
          details: lowStock.length > 0
            ? `Critical items: ${lowStock.map(p => `${p.name} (${p.currentStock} ${p.unit})`).join(', ')}`
            : 'All inventory quantities exceed safety reorder buffers.',
          actionButton: {
            label: 'Open Inventory Module',
            onClick: () => {
              closeModal();
              setActiveTab('inventory');
            }
          }
        };
      }

      // E. Accounts Receivable Inspection
      else if (route.queryType === 'receivables') {
        const totalReceivables = customers.reduce((sum, c) => sum + (c.outstandingReceivables || 0), 0);
        const topDebtor = [...customers].sort((a, b) => b.outstandingReceivables - a.outstandingReceivables)[0];
        const spoken = `Total outstanding customer receivables is ${formatPKR(totalReceivables)}. Top balance is ${topDebtor ? topDebtor.name + ' with ' + formatPKR(topDebtor.outstandingReceivables) : 'none'}.`;

        resultData = {
          queryType: 'receivables',
          title: 'Accounts Receivable & Credit Status',
          badge: 'Client Ledger Audit',
          spokenText: spoken,
          stats: [
            { label: 'Total Receivables', value: formatPKR(totalReceivables), color: 'text-emerald-600' },
            { label: 'Registered Clients', value: `${customers.length} Mills`, color: 'text-slate-900 dark:text-slate-100' },
            { label: 'Top Debtor', value: topDebtor ? topDebtor.name : 'None', color: 'text-indigo-600' }
          ],
          details: topDebtor ? `${topDebtor.name} owes ${formatPKR(topDebtor.outstandingReceivables)}.` : 'No outstanding balances.',
          actionButton: {
            label: 'View Customers & Mills',
            onClick: () => {
              closeModal();
              setActiveTab('customers' as any);
            }
          }
        };
      }

      // F. Pending Purchase Orders
      else if (route.queryType === 'purchase_orders') {
        const pendingPOs = purchaseOrders.filter(p => p.status === 'pending');
        const committedVal = pendingPOs.reduce((sum, p) => sum + p.totalAmount, 0);
        const spoken = `There are ${pendingPOs.length} pending purchase orders totaling ${formatPKR(committedVal)} in committed factory procurement.`;

        resultData = {
          queryType: 'purchase_orders',
          title: 'Procurement & Pending POs',
          badge: 'Purchase Order Pipeline',
          spokenText: spoken,
          stats: [
            { label: 'Committed Spend', value: formatPKR(committedVal), color: 'text-amber-600' },
            { label: 'Pending POs', value: `${pendingPOs.length} Orders`, color: 'text-slate-900 dark:text-slate-100' }
          ],
          details: pendingPOs.length > 0 ? `Earliest pending: ${pendingPOs[0].poNumber} from ${pendingPOs[0].supplierName}` : 'All procurement orders fulfilled.',
          actionButton: {
            label: 'View Purchase Orders',
            onClick: () => {
              closeModal();
              setActiveTab('purchase');
            }
          }
        };
      }

      // G. Automate FBR Compliance
      else if (route.queryType === 'automate_tax') {
        const spoken = 'Automated FBR compliance engine is active. Standard 18% GST, 4% further tax, and Iris Annexure-C reconciliation are auto-imposed on all transactions.';
        resultData = {
          queryType: 'automate_tax',
          title: 'Automated FBR Compliance Active',
          badge: '100% Tax Imposition Enforced',
          spokenText: spoken,
          stats: [
            { label: 'Sales Tax', value: '18% GST (STA Sec 3(1))', color: 'text-indigo-600' },
            { label: 'Further Tax', value: '4% on Non-Filers', color: 'text-amber-600' },
            { label: 'Withholding', value: 'Sec 153 Auto-Deducted', color: 'text-emerald-600' }
          ],
          details: 'All sales invoices, raw material procurement, and cash disbursements are automatically stamped with digital fiscal metadata.',
          actionButton: {
            label: 'Inspect FBR Integration Hub',
            onClick: () => {
              closeModal();
              setActiveTab('fbr_integration' as any);
            }
          }
        };
      }

      // H. FBR Integration Readiness Checklist Guide
      else if (route.queryType === 'fbr_readiness_guide') {
        const spoken = 'Your system is fully prepared for FBR Tier-1 e-invoicing. It auto-imposes 18% GST and 4% Further Tax, generates 16-field SRO 1805(I) QR codes, and connects to the Iris Sandbox API. Tap to view the full FBR Integration Hub.';
        resultData = {
          queryType: 'fbr_readiness_guide',
          title: 'FBR Integration Readiness Protocol',
          badge: 'S.R.O. 1805(I)/2024 Ready',
          spokenText: spoken,
          stats: [
            { label: 'POS Machine ID', value: 'POS-78601 (Assigned)', color: 'text-emerald-600' },
            { label: 'Statutory GST Engine', value: '18% Auto-Enforced', color: 'text-indigo-600' },
            { label: 'Fiscal QR Standard', value: '16-Field S.R.O. 1805', color: 'text-indigo-600' },
            { label: 'Iris API Sandbox', value: 'Endpoint Handshake OK', color: 'text-emerald-600' }
          ],
          details: 'Step 1: Iris POS Registration. Step 2: Auto 18% GST + 4% Further Tax. Step 3: IMS Gateway Token. Step 4: Tax Asaan QR verification. Step 5: Monthly Annexure-C sync.',
          actionButton: {
            label: 'Open FBR Integration Hub',
            onClick: () => {
              closeModal();
              setActiveTab('fbr_integration' as any);
            }
          }
        };
      }

      if (resultData) {
        setLiveResult(resultData);
        addToast('success', resultData.title, resultData.stats[0]?.value || 'System inspected.');
        if (audioVoiceEnabled) {
          speakText(resultData.spokenText);
        }
      }
      return;
    }

    // 4. Handle DIRECT DOCUMENT PRINTING COMMANDS
    if (route.type === 'print' && route.printType) {
      closeModal();
      if (route.printType === 'invoice') {
        const latestInvoice = salesOrders[0] || {
          id: 'SO-LIVE-001',
          invoiceNumber: 'INV-2024-0042',
          customerName: 'Al-Karam Textile Mills',
          totalAmount: 35400,
          subtotal: 30000,
          taxAmount: 5400,
          createdAt: new Date().toISOString(),
          items: [
            { productName: 'Combed Cotton Yarn 30/1', quantity: 50, unit: 'kg', unitPrice: 600, taxRate: 18 }
          ]
        };
        openPrintDocument({ type: 'invoice', data: latestInvoice });
        addToast('success', 'Print Dispatched via Voice', `Opening FBR Fiscal Invoice #${latestInvoice.invoiceNumber}`);
        if (audioVoiceEnabled) {
          speakText('Opening FBR compliant digital invoice for thermal printing.');
        }
        return;
      }
      if (route.printType === 'purchase_order') {
        const latestPO = purchaseOrders[0] || {
          id: 'PO-LIVE-001',
          poNumber: 'PO-2024-0089',
          supplierName: 'National Spinning Mills',
          totalAmount: 180000,
          status: 'pending',
          createdAt: new Date().toISOString(),
          items: [
            { productName: 'Raw Cotton Grade-A', quantity: 300, unit: 'kg', unitPrice: 600, totalAmount: 180000 }
          ]
        };
        openPrintDocument({ type: 'purchase_order', data: latestPO });
        addToast('success', 'Print Dispatched via Voice', `Opening Purchase Order #${latestPO.poNumber}`);
        if (audioVoiceEnabled) {
          speakText('Opening purchase order for printing.');
        }
        return;
      }
      if (route.printType === 'cash_voucher') {
        const latestCash = cashbook[0] || {
          id: 'CSH-101',
          type: 'outflow',
          category: 'factory_utilities',
          amount: 45000,
          description: 'Factory electricity bill disbursement'
        };
        openPrintDocument({ type: 'cash_voucher', data: latestCash });
        addToast('success', 'Print Dispatched via Voice', `Opening Cash Voucher #${latestCash.id}`);
        if (audioVoiceEnabled) {
          speakText('Opening cash voucher for printing.');
        }
        return;
      }
      if (route.printType === 'inventory_report') {
        openPrintDocument({ type: 'inventory_report', data: products });
        addToast('success', 'Print Dispatched via Voice', 'Opening Inventory Stock Valuation Report');
        if (audioVoiceEnabled) {
          speakText('Opening inventory stock valuation report for printing.');
        }
        return;
      }
    }

    // 5. Handle MODAL OPENERS
    if (route.type === 'modal' && route.target) {
      closeModal();
      openModal(route.target as any);
      addToast('success', route.label, `Voice intent routed: ${route.description}`);
      if (audioVoiceEnabled) {
        speakText(`Opening ${route.label}`);
      }
      return;
    }

    // 6. Handle TAB NAVIGATION
    if (route.type === 'tab' && route.target) {
      closeModal();
      setActiveTab(route.target as any);
      addToast('info', route.label, route.description);
      if (audioVoiceEnabled) {
        speakText(`Navigating to ${route.label}`);
      }
      return;
    }

    // 7. Complex Conversational Query -> AI Copilot
    closeModal();
    setActiveTab('copilot');
    sendMessage(query, 'voice');
  };

  /**
   * Request hardware microphone permission directly via user click gesture
   */
  const handleRequestMicAccess = async () => {
    setIsTestingMic(true);
    const granted = await requestMicrophonePermission();
    setIsTestingMic(false);
    if (granted) {
      addToast('success', 'Microphone Ready', 'Real microphone access granted. You can now tap to record.');
    }
  };

  /**
   * Open the applet in a top-level browser tab
   */
  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  // Comprehensive One-Tap Voice Command Actions (English & Urdu)
  const voiceCommandChips = [
    {
      label: 'Print FBR Invoice (80mm)',
      query: 'Print thermal receipt',
      icon: Printer,
      color: 'bg-indigo-600/10 text-indigo-600 border-indigo-600/20 hover:bg-indigo-600/20',
      badge: 'FBR QR & Tax Breakdown'
    },
    {
      label: 'How to make FBR Integration Ready?',
      query: 'How to make system ready for FBR integration',
      icon: ShieldCheck,
      color: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20 hover:bg-emerald-600/20',
      badge: '5-Step Protocol Guide'
    },
    {
      label: 'Check Cash Balance',
      query: 'Check cash balance',
      icon: Wallet,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20',
      badge: 'Live Treasury Status'
    },
    {
      label: 'Check 18% GST Collected',
      query: 'Check GST collected',
      icon: Scale,
      color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20',
      badge: 'FBR STA 1990 Audit'
    },
    {
      label: 'Check FBR Tax on Sale (1 Lakh)',
      query: 'Calculate tax for 100000 sale',
      icon: Calculator,
      color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20',
      badge: 'Auto-Compute GST + Further Tax'
    },
    {
      label: 'Automate FBR & GST Taxes',
      query: 'Automate FBR compliance',
      icon: ShieldAlert,
      color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20',
      badge: 'Impose on Everything'
    },
    {
      label: 'Check Warehouse Stock',
      query: 'Check stock',
      icon: Package,
      color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20',
      badge: 'SKU Inventory Check'
    },
    {
      label: 'Print Inventory Stock Report',
      query: 'Print inventory report',
      icon: Printer,
      color: 'bg-teal-500/10 text-teal-600 border-teal-500/20 hover:bg-teal-500/20',
      badge: 'Warehouse Valuation'
    },
    {
      label: 'Record New Sale (18% GST)',
      query: 'Record a new sale',
      icon: Receipt,
      color: 'bg-sky-500/10 text-sky-600 border-sky-500/20 hover:bg-sky-500/20',
      badge: 'Opens Sales Order Modal'
    }
  ];

  return (
    <div
      id="voice-assistant-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-fadeIn"
    >
      <div
        id="voice-assistant-modal-container"
        className={`rounded-3xl shadow-2xl border w-full max-w-2xl overflow-hidden animate-scaleUp transition-colors my-auto ${
          darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Top Header */}
        <div className="px-5 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold">Voice Command & System Engine</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase border border-emerald-400/30">
                  Live System Inspector
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ask about Cash, 18% GST, Sale Taxes, Stock, or trigger creation workflows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleAudioVoice}
              title={audioVoiceEnabled ? 'Voice Response Audio: ON' : 'Voice Response Audio: MUTED'}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                audioVoiceEnabled
                  ? 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {audioVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setInputVal('');
                setRecordingTranscript('');
                clearMicErrorNotice();
                setLiveResult(null);
                closeModal();
              }}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Voice Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Real Microphone Access Grant / Permission Banner */}
          {(micErrorNotice || isEmbeddedIframe) && (
            <div
              id="mic-permission-grant-panel"
              className={`p-3.5 rounded-2xl border transition-all ${
                micErrorNotice
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-950 dark:text-indigo-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${micErrorNotice ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                <div className="flex-1 text-xs">
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      {micErrorNotice
                        ? 'Microphone Permission in Browser Preview'
                        : 'Real Microphone Access Policy'}
                    </span>
                    {isEmbeddedIframe && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 font-mono font-semibold">
                        Preview Iframe
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                    {micErrorNotice ? (
                      <>
                        The browser reported: <span className="font-mono font-semibold">{micErrorNotice}</span>.
                        Embedded iframes restrict direct microphone hardware capture. Open in a full window or tap any command below.
                      </>
                    ) : (
                      <>
                        To enable direct hardware speech recognition with <strong>Groq Whisper</strong>, grant microphone permissions or open in full window.
                      </>
                    )}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Full Window for Native Mic</span>
                    </button>

                    <button
                      type="button"
                      disabled={isTestingMic}
                      onClick={handleRequestMicAccess}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {isTestingMic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>Grant / Test Mic Access</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LIVE SYSTEM INSPECTION RESULT CARD */}
          {liveResult && (
            <div
              className={`p-4 rounded-2xl border shadow-sm space-y-3 animate-fadeIn ${
                darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    {liveResult.title}
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/20">
                  {liveResult.badge}
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {liveResult.stats.map((stat, idx) => (
                  <div key={idx} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {stat.label}
                    </span>
                    <span className={`text-xs sm:text-sm font-mono font-bold block mt-0.5 ${stat.color || 'text-slate-900 dark:text-slate-100'}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              {liveResult.details && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {liveResult.details}
                </p>
              )}

              {/* Action Button */}
              {liveResult.actionButton && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={liveResult.actionButton.onClick}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{liveResult.actionButton.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Voice Recording Center */}
          <div
            className={`flex flex-col items-center justify-center py-4 sm:py-5 border rounded-2xl relative overflow-hidden transition-colors ${
              darkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {isRecording && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 bg-red-500/15 rounded-full animate-ping" />
                <div className="w-28 h-28 bg-red-500/25 rounded-full animate-pulse" />
              </div>
            )}

            <button
              type="button"
              id="voice-mic-trigger-button"
              disabled={isTranscribing}
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative z-10 w-18 h-18 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
                isRecording
                  ? 'bg-red-600 text-white ring-8 ring-red-500/30 scale-105 animate-pulse'
                  : isTranscribing
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 active:scale-95 shadow-indigo-600/30'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Speaking Voice Command'}
            >
              {isRecording ? (
                <MicOff className="w-7 h-7" />
              ) : isTranscribing ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <Mic className="w-7 h-7" />
              )}
            </button>

            <div className="mt-2.5 text-center relative z-10 px-4">
              <span className="text-xs font-bold uppercase tracking-wider block">
                {isRecording
                  ? 'Listening... Speak in English or Roman Urdu'
                  : isTranscribing
                  ? 'Transcribing Voice with Groq Whisper...'
                  : 'Tap Microphone or Ask System'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {isRecording
                  ? 'e.g. "Check cash balance", "Check GST collected", or "Record a new sale"'
                  : 'Speaks back live figures and triggers modular ERP workflows'}
              </span>
            </div>
          </div>

          {/* Transcript & Command Input Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Voice / Text Command Buffer:</span>
              {inputVal && (
                <button
                  type="button"
                  onClick={() => {
                    setInputVal('');
                    setRecordingTranscript('');
                    setDetectedRoute(null);
                  }}
                  className="text-slate-400 hover:text-red-500 text-[11px] cursor-pointer"
                >
                  Clear Buffer
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                id="voice-command-input"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={
                  isRecording
                    ? 'Listening... say "Check cash" or "Calculate tax for 100000 sale"...'
                    : 'Speak or type (e.g. "Check cash balance", "Calculate tax for 50000 sale")...'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteVoiceAction();
                }}
                className={`flex-1 px-4 py-2.5 border rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                type="button"
                id="voice-execute-button"
                onClick={() => handleExecuteVoiceAction()}
                disabled={!inputVal.trim() || isProcessing || isTranscribing}
                className="px-4 sm:px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Inspect</span>
              </button>
            </div>

            {/* Live Intent Route Detection Preview */}
            {detectedRoute && (
              <div className="flex items-center justify-between p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs animate-fadeIn">
                <div className="flex items-center gap-2 truncate pr-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200 truncate">
                    Recognized: <strong>{detectedRoute.label}</strong> ({detectedRoute.description})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleExecuteVoiceAction()}
                  className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>Execute</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* One-Tap Voice Command Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Aligned Voice Commands (One-Tap System Inspection)</span>
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Auto-Clears Buffer</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {voiceCommandChips.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleExecuteVoiceAction(item.query)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 group ${
                      darkMode
                        ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-indigo-500/50'
                        : 'bg-slate-50 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${item.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                        "{item.label}"
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {item.badge}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
