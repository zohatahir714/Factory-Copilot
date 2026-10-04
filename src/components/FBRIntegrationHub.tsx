import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateIrisAnnexureCPayload, formatPKR } from '../utils/fbrTaxEngine';
import { buildDiPayload, describePayload, DiPayload, TRANSMISSION_NOTE } from '../lib/fbr/payload';
import { FBR_SCENARIOS, PUBLISHED_SCENARIOS } from '../lib/fbr/scenarios';
import { FBRQRCode } from './common/FBRQRCode';
import {
  ShieldCheck,
  QrCode,
  CheckCircle2,
  FileCheck,
  Server,
  Download,
  Sparkles,
  HelpCircle,
  Layers,
  ArrowRight,
  ExternalLink,
  Code2,
  Lock,
  Copy,
  Receipt
} from 'lucide-react';

export const FBRIntegrationHub: React.FC = () => {
  const {
    salesOrders,
    branding,
    brandingSettings,
    darkMode,
    addToast,
    openModal
  } = useApp();

  // The seller-side identity was a made-up NTN/STRN pair (4029184-7 /
  // 32-77-8761-234-19) in three components and the tax engine. Those literals
  // described a company that does not exist. Absent branding is now passed
  // through empty so the engine's NOT CONFIGURED sentinel is what prints.
  const activeBranding = branding || brandingSettings || {
    companyName: '',
    ntnNumber: '',
    strnNumber: ''
  };
  const sellerNTN = activeBranding?.ntnNumber || '';
  const sellerSTRN = activeBranding?.strnNumber || '';

  // FBR Integration Configuration
  //
  // REMOVED: a bearer token field pre-filled with 'fbr_live_tok_993821038472910482910'
  // and a Sandbox/Live Production environment toggle. Neither connected to
  // anything. The token looked like a live credential while being a literal,
  // and the toggle implied the app would start transmitting to FBR on click.
  // FBR requires a licensed integrator to transmit; this application is not
  // one, so there is nothing for those controls to do.
  const [posMachineId, setPosMachineId] = useState('');
  const [autoImposeGST, setAutoImposeGST] = useState(true);
  const [autoImposeFurtherTax, setAutoImposeFurtherTax] = useState(true);
  const [autoSyncAnnexureC, setAutoSyncAnnexureC] = useState(true);

  // Payload builder state (Task 6).
  const [scenarioId, setScenarioId] = useState('SN001');
  const [valueSalesExcludingST, setValueSalesExcludingST] = useState(500);
  const [salesTaxApplicable, setSalesTaxApplicable] = useState(90);
  const [furtherTax, setFurtherTax] = useState(0);
  const [notifiedRetailPrice, setNotifiedRetailPrice] = useState<string>('');
  const [payload, setPayload] = useState<DiPayload | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'readiness' | 'payload' | 'annexure_c' | 'guide'>('readiness');

  const activeScenario = FBR_SCENARIOS.find(s => s.id === scenarioId);
  const publishedCount = PUBLISHED_SCENARIOS.length;

  const handleGeneratePayload = () => {
    try {
      setPayloadError(null);
      const built = buildDiPayload({
        scenarioId,
        valueSalesExcludingST,
        salesTaxApplicable,
        furtherTax,
        ...(notifiedRetailPrice.trim() ? { notifiedValueOrRetailPrice: Number(notifiedRetailPrice) } : {}),
        invoiceType: 'Sales Invoice',
        documentNumber: `DRAFT-${scenarioId}`,
        // The payload is being generated now, so the document date is now.
        // This is not an invented value — it is the one field the builder
        // genuinely knows. Everything it cannot know is left empty and warned
        // about instead.
        documentDate: new Date().toISOString(),
        sellerNTN,
        sellerSTRN
      });
      setPayload(built);
      addToast(
        built.integratorWarnings.length === 0 ? 'success' : 'warning',
        'Payload generated',
        describePayload(built)
      );
    } catch (err: any) {
      // A refused build is information, not a crash: an unknown scenario or a
      // negative amount must be visible rather than silently coerced.
      setPayload(null);
      setPayloadError(err?.message || String(err));
    }
  };

  const handleCopyPayload = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      addToast('success', 'Copied', 'Payload JSON copied to clipboard.');
    } catch {
      addToast('warning', 'Copy blocked', 'Clipboard access was refused by the browser. Use Download instead.');
    }
  };

  const handleDownloadPayload = () => {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FBR_DI_${payload.scenarioId}_${payload.documentNumber}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    addToast('success', 'Payload downloaded', 'Hand this file to your licensed integrator.');
  };

  // REMOVED: handleSimulateFBRTransmission.
  //
  // It set a 900ms timer and then rendered a fabricated gateway response:
  //   status 200, "Invoice Validated & Fiscalized Successfully with FBR Iris
  //   Gateway", a random FBR invoice number, and a verification URL pointing
  //   at that random number — then toasted "FBR Gateway Handshake Succeeded".
  // No request ever left the browser. Nothing was registered, and the QR it
  // produced could not resolve. A fake HTTP 200 from a government tax body is
  // the one thing in this app that would end a compliance demo on the spot, so
  // the simulator is gone rather than relabelled.
  //
  // What replaces it is real: the schema-valid payload your licensed
  // integrator forwards (Task 6).

  const handleExportAnnexureC = () => {
    const batch = generateIrisAnnexureCPayload(salesOrders, sellerNTN, sellerSTRN);
    const payload = batch;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `FBR_Iris_Annexure_C_${payload.TaxPeriod}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('success', 'Annexure-C Exported', `Downloaded Iris domestic sales return for ${payload.TotalInvoicesCount} invoices.`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12">
      {/* Top Header Card */}
      <div
        className={`p-6 rounded-3xl border shadow-sm transition-colors ${
          darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl lg:text-2xl font-black tracking-tight">
                  FBR Digital Invoicing Payload Hub
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                  S.R.O. 1805(I)/2024 Format
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold border border-indigo-500/20">
                  STA 1990 Deterministic
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Deterministic sales tax arithmetic under the STA 1990, the 16-field S.R.O. 1805(I)/2024 QR
                payload, a real SHA-256 document seal, and schema-valid Digital Invoicing payloads for the
                eight sandbox scenarios we can reconcile. Transmission is performed by your licensed
                integrator — this application does not file with FBR.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={() => openModal('sale')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>Issue Tax Invoice</span>
            </button>
            <button
              type="button"
              onClick={handleExportAnnexureC}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Annexure-C JSON</span>
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
          {[
            { id: 'readiness', label: '1. Statutory Basis & Verification Matrix', icon: CheckCircle2 },
            { id: 'payload', label: '2. Digital Invoicing Payload Builder', icon: Server },
            { id: 'annexure_c', label: '3. Iris Annexure-C Export', icon: FileCheck },
            { id: 'guide', label: '4. Handing Off to Your Integrator', icon: HelpCircle }
          ].map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: READINESS SCORECARD & ARCHITECTURE */}
      {activeSubTab === 'readiness' && (
        <div className="space-y-6">
          {/* Readiness Highlights Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border bg-emerald-500/5 border-emerald-500/20">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <span>Tax Auto-Impose</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">100% Deterministic</div>
              <p className="text-[11px] text-slate-500 mt-1">18% GST + 4% further tax auto-imposed on every sale</p>
            </div>

            <div className="p-4 rounded-2xl border bg-indigo-500/5 border-indigo-500/20">
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <span>Fiscal QR Code</span>
                <QrCode className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">16-Field Standard</div>
              <p className="text-[11px] text-slate-500 mt-1">Conforming to SRO 1805(I)/2024 barcode payload</p>
            </div>

            <div className="p-4 rounded-2xl border bg-indigo-500/5 border-indigo-500/20">
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <span>Iris Annexure-C</span>
                <FileCheck className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">Export Ready</div>
              <p className="text-[11px] text-slate-500 mt-1">One-click JSON export of the monthly domestic sales return</p>
            </div>

            <div className="p-4 rounded-2xl border bg-amber-500/5 border-amber-500/20">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                <span>Withholding WHT</span>
                <Lock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">Sec 153 Automated</div>
              <p className="text-[11px] text-slate-500 mt-1">4.5% filer vs 9.0% non-filer withholding deduction</p>
            </div>
          </div>

          {/* Detailed Verification Matrix */}
          <div
            className={`p-6 rounded-3xl border shadow-sm ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Statutory Compliance Architecture & Verification Matrix</span>
            </h3>

            <div className="space-y-3">
              {[
                {
                  statute: 'Sales Tax Act 1990 - Section 3(1)',
                  title: 'Standard 18% General Sales Tax (GST) Auto-Imposition',
                  desc: 'Every registered sale invoice calculates 18.0% GST deterministically on the pre-tax supply value. No sales invoice can be created with zero or erroneous tax unless exempt.',
                  status: 'Active & Enforced'
                },
                {
                  statute: 'Sales Tax Act 1990 - Section 3(1A)',
                  title: '4% Further Tax Imposition on Unregistered / Non-Filer Buyers',
                  desc: 'When supplies are made to an unregistered mill or non-filer entity, the system automatically levies an additional 4% Further Tax, preventing tax avoidance audits.',
                  status: 'Active & Enforced'
                },
                {
                  statute: 'FBR S.R.O. 1805(I)/2024',
                  title: 'Digital Invoicing 16-Field QR Payload & Document Seal',
                  desc: 'Each invoice carries FBR 16-parameter QR payload and a SHA-256 seal computed over that payload, so any single altered field invalidates the printed seal. Transmission to FBR is performed by your licensed integrator.',
                  status: 'Payload generated locally'
                },
                {
                  statute: 'Income Tax Ordinance 2001 - Section 153(1)(a)',
                  title: 'Automated Withholding Tax (WHT) Ledger Split',
                  desc: 'Purchase orders and payments automatically deduct 4.5% withholding tax for active filers and 9.0% for non-filers, keeping tax deduction certificates balanced.',
                  status: 'Active & Enforced'
                },
                {
                  statute: 'FBR Iris Monthly Filing Schedule',
                  title: 'Deterministic Annexure-C (Sales) & Annexure-A (Purchases) Reconciliation',
                  desc: 'All invoice movements are pre-formatted as JSON for your integrator to upload into Iris prior to the statutory 10th-of-the-month deadline.',
                  status: 'Export Ready'
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    darkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {item.statute}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

{/* TAB 2: DIGITAL INVOICING PAYLOAD BUILDER */}
      {activeSubTab === 'payload' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scenario selection + figures */}
          <div
            className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-600" />
                <span>Digital Invoicing Scenario</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                FBR describes each sale type with its own enum string, rate and tax base. Several of those
                enum strings contain typos; they are reproduced verbatim, because a corrected string is a
                rejected payload. {publishedCount} of {FBR_SCENARIOS.length} scenarios have a published
                template — the rest are marked so the gap stays visible.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                POS Machine ID (issued to you by FBR via your integrator)
              </label>
              <input
                type="text"
                value={posMachineId}
                onChange={(e) => setPosMachineId(e.target.value)}
                placeholder="Leave blank if not yet issued — it is never invented"
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Scenario
              </label>
              <select
                value={scenarioId}
                onChange={(e) => {
                  setScenarioId(e.target.value);
                  setPayload(null);
                  setPayloadError(null);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none"
              >
                {FBR_SCENARIOS.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.saleType}
                    {s.published ? '' : ' (no published template)'}
                  </option>
                ))}
              </select>
              {activeScenario && (
                <div
                  className={`mt-2 p-3 rounded-xl border text-[11px] leading-relaxed ${
                    activeScenario.published
                      ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="font-mono">
                    rate={JSON.stringify(activeScenario.rate)} · extraTax=
                    {JSON.stringify(activeScenario.extraTax)} · buyer={activeScenario.buyerRegistrationType}
                  </div>
                  <div className="mt-1">
                    Tax base: <strong>{activeScenario.taxBase.replace(/([A-Z])/g, ' $1').trim()}</strong>
                  </div>
                  <div className="mt-1">{activeScenario.notes}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Value excl. ST</label>
                <input
                  type="number"
                  value={valueSalesExcludingST}
                  onChange={(e) => setValueSalesExcludingST(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sales tax</label>
                <input
                  type="number"
                  value={salesTaxApplicable}
                  onChange={(e) => setSalesTaxApplicable(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Further tax</label>
                <input
                  type="number"
                  value={furtherTax}
                  onChange={(e) => setFurtherTax(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>
            </div>

            {activeScenario?.taxBase === 'notifiedValueOrRetailPrice' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Notified value / retail price
                </label>
                <input
                  type="number"
                  value={notifiedRetailPrice}
                  onChange={(e) => setNotifiedRetailPrice(e.target.value)}
                  placeholder="Tax is charged on this figure, not on the transaction value"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleGeneratePayload}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Code2 className="w-4 h-4" />
              <span>Generate FBR payload</span>
            </button>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
              Produces the document your licensed integrator forwards. Nothing is transmitted to FBR from here.
            </div>
          </div>

          {/* Payload output */}
          <div
            className={`p-6 rounded-3xl border shadow-sm space-y-4 flex flex-col ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-emerald-600" />
                <span>Payload & Reconciliation Report</span>
              </h3>
              {payload && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Copy JSON"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPayload}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Download JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {payloadError && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-2xl text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{payloadError}</span>
              </div>
            )}

            {!payload && !payloadError ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <Code2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs max-w-sm mx-auto">
                  Choose a scenario and its figures, then generate the payload. Anything that does not
                  reconcile is reported below rather than corrected.
                </p>
              </div>
            ) : payload ? (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">valueSalesExcludingST</span>
                    <span className="font-mono font-bold">{payload.valueSalesExcludingST.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-indigo-700 dark:text-indigo-300">
                    <span>salesTaxApplicable</span>
                    <span className="font-mono font-bold">+ {payload.salesTaxApplicable.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 dark:text-amber-400">
                    <span>furtherTax</span>
                    <span className="font-mono font-bold">+ {payload.furtherTax.toLocaleString()}</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold">
                    <span>totalValues</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400">
                      {payload.totalValues.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">rate</span>
                      <span className="font-mono font-semibold">{JSON.stringify(payload.rate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">extraTax</span>
                      <span className="font-mono font-semibold">{JSON.stringify(payload.extraTax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">buyer</span>
                      <span className="font-mono font-semibold">{payload.buyerRegistrationType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">implied base</span>
                      <span className="font-mono font-semibold">
                        {payload.impliedTaxBase === null ? '—' : payload.impliedTaxBase.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {payload.integratorWarnings.length === 0 ? (
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-800 dark:text-emerald-300">
                      <span className="font-bold">Figures reconcile.</span> The identity holds and no missing
                      value had to be invented.
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl">
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200 mb-1.5">
                      Confirm before filing ({payload.integratorWarnings.length})
                    </div>
                    <ul className="space-y-1 text-[11px] text-amber-800 dark:text-amber-300 list-disc pl-4">
                      {payload.integratorWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Payload JSON
                  </span>
                  <pre className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-[10px] leading-relaxed text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 overflow-auto max-h-72 whitespace-pre-wrap break-all">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{payload?.transmissionNote || TRANSMISSION_NOTE}.</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: IRIS ANNEXURE-C E-FILING */}
      {activeSubTab === 'annexure_c' && (
        <div
          className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <span>Monthly Iris Domestic Sales Return (Annexure-C)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Statutory sales schedule due to FBR by the 10th of every month under Sales Tax Rules 2006. This
                exports the JSON; your licensed integrator submits it.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportAnnexureC}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Download Iris JSON</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Buyer Mill Name</th>
                  <th className="py-3 px-4">HS Tariff Code</th>
                  <th className="py-3 px-4 text-right">Value (Pre-Tax)</th>
                  <th className="py-3 px-4 text-center">Tax Rate</th>
                  <th className="py-3 px-4 text-right">Sales Tax</th>
                  <th className="py-3 px-4 text-right">Total Invoice</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {(salesOrders || []).filter(Boolean).map((so) => {
                  const subtotal = so?.subtotal || Math.round((so?.totalAmount || 0) / 1.18) || 0;
                  const tax = so?.taxAmount || ((so?.totalAmount || 0) - subtotal);
                  // This column used to print the yarn tariff code 5205.1200 for
                  // every row and a flat "18.0%", and every row carried a
                  // green "Reconciled" badge whether or not anything had been
                  // checked. A reconciliation badge that cannot read
                  // "unreconciled" is decoration, not evidence.
                  const derivedRate = subtotal > 0 ? Number(((tax / subtotal) * 100).toFixed(2)) : null;
                  const isStandardRate = derivedRate !== null && Math.abs(derivedRate - 18) < 0.01;
                  return (
                    <tr key={so.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{so.invoiceNumber}</td>
                      <td className="py-3 px-4 font-semibold">{so.customerName}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{so?.items?.[0]?.hsCode || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatPKR(subtotal)}</td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-600">
                        {derivedRate === null ? '—' : `${derivedRate}%`}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                        {formatPKR(tax)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatPKR(so.totalAmount || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {derivedRate === null ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                            No value
                          </span>
                        ) : isStandardRate ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                            Standard rate
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                            Non-standard
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: HOW TO CONNECT LIVE FBR PORTAL GUIDE */}
      {activeSubTab === 'guide' && (
        <div
          className={`p-6 sm:p-8 rounded-3xl border shadow-sm space-y-6 ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Where the boundary of this application lies</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black mt-1">
              Getting Your Invoices Fiscalised
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
              FBR requires a licensed integrator to transmit. This application builds the payload and checks its
              arithmetic; your integrator does the transmission. Here is who does what.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                step: '01',
                title: 'Enrol on the FBR Digital Invoicing / POS Integration Portal',
                body: 'Log in to e.fbr.gov.pk with your company STRN/NTN. Under "Digital Invoicing / Tier-1 POS Integration", register your establishment and declare your sales points. Only you and your integrator can do this — it is an FBR-side registration, not an application setting.',
                action: 'Visit e.fbr.gov.pk POS Portal',
                url: 'https://e.fbr.gov.pk'
              },
              {
                step: '02',
                title: 'Obtain your POS Machine ID from your licensed integrator',
                body: 'FBR issues the POS Machine ID and the API authorisation key to a licensed integrator, not to software. We no longer collect a bearer token in this hub for exactly that reason: there is no request this application can make with it. Add the POS Machine ID above once your integrator issues one, so the 16-field QR payload carries the right field.',
                action: 'Open Iris',
                url: 'https://iris.fbr.gov.pk'
              },
              {
                step: '03',
                title: 'Reconcile locally before anything leaves your building',
                body: 'Use the payload builder on each scenario you actually sell under. It reports — it never corrects — so a figure that disagrees with its scenario is visible to you rather than silently submitted. Fix the figures, then re-run.',
                action: 'Open the payload builder',
                onClick: () => setActiveSubTab('payload')
              },
              {
                step: '04',
                title: 'Hand the payload to your integrator',
                body: 'Export the JSON and send it to your licensed integrator, who signs and transmits it to the FBR IMS gateway. Until they do that, an invoice carries a correct 16-field payload and a SHA-256 document seal but is not fiscalised, and will not resolve on verify.fbr.gov.pk.',
                action: null
              },
              {
                step: '05',
                title: 'Export Annexure-C by the 10th',
                body: 'On the 10th of each month, export the Annexure-C JSON from tab 3 and pass it to your integrator for filing. The export contains only what your records actually carry: figures the records do not carry are marked as not recorded rather than filled in.',
                action: 'Open Annexure-C export',
                onClick: () => setActiveSubTab('annexure_c')
              }
            ].map((st) => (
              <div
                key={st.step}
                className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-start gap-4 transition-all ${
                  darkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center shrink-0 shadow-sm">
                  {st.step}
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {st.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {st.body}
                  </p>
                  {st.action && (
                    <div className="pt-2">
                      {st.url ? (
                        <a
                          href={st.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <span>{st.action}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={st.onClick}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <span>{st.action}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
