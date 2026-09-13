/**
 * Enterprise Voice Intent & Live System Inspection Router
 * Supports English & Roman Urdu spoken voice commands for:
 * 1. Live system inquiries (Cash balance, GST collected, FBR tax calculation on sale, Stock levels, Receivables, FBR readiness checklist)
 * 2. Automated FBR tax imposition toggles
 * 3. Document Print dispatch (Thermal 80mm receipt, A4 tax invoice, PO, Voucher, Inventory)
 * 4. Direct modular workflow openers (Purchase, Sales, Inventory, Cashbook, Compliance)
 * 5. Conversational AI Copilot routing
 */

export interface VoiceRouteResult {
  matched: boolean;
  type: 'live_query' | 'print' | 'modal' | 'tab' | 'copilot';
  queryType?:
    | 'cash'
    | 'gst'
    | 'sale_tax'
    | 'inventory'
    | 'receivables'
    | 'purchase_orders'
    | 'automate_tax'
    | 'fbr_readiness_guide';
  printType?: 'invoice' | 'purchase_order' | 'cash_voucher' | 'inventory_report';
  target?: string;
  label: string;
  description: string;
  extractedAmount?: number;
  extractedProduct?: string;
}

export function routeVoiceIntent(rawTranscript: string): VoiceRouteResult {
  const query = (rawTranscript || '').toLowerCase().trim();

  if (!query) {
    return {
      matched: false,
      type: 'copilot',
      label: 'Empty Command',
      description: 'No speech input detected'
    };
  }

  // Extract potential numeric amounts (e.g. "50000", "100,000", "2 lakh", "50 hazar", "100k")
  let extractedAmount: number | undefined;
  const lakhMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i);
  if (lakhMatch) {
    extractedAmount = Math.round(parseFloat(lakhMatch[1]) * 100000);
  } else {
    const hazarMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:hazar|thousand)/i);
    if (hazarMatch) {
      extractedAmount = Math.round(parseFloat(hazarMatch[1]) * 1000);
    } else {
      const kMatch = query.match(/(\d+(?:\.\d+)?)\s*k\b/i);
      if (kMatch) {
        extractedAmount = Math.round(parseFloat(kMatch[1]) * 1000);
      } else {
        const numMatch = query.match(/\b(\d[\d,]{2,})\b/);
        if (numMatch) {
          extractedAmount = parseInt(numMatch[1].replace(/,/g, ''), 10);
        }
      }
    }
  }

  // ==========================================
  // 1. DIRECT DOCUMENT PRINTING COMMANDS
  // ==========================================

  // A. Print FBR Sales Invoice / 80mm Thermal Receipt
  if (
    /print.*(?:invoice|receipt|thermal|bill|sale)|(?:invoice|receipt|thermal|bill).*print|raseed.*print|parcha.*print|print.*fbr.*invoice/i.test(query)
  ) {
    return {
      matched: true,
      type: 'print',
      printType: 'invoice',
      label: 'Print FBR 80mm Thermal Invoice',
      description: 'Triggering official FBR digital fiscal invoice with verification QR code & tax breakdown.'
    };
  }

  // B. Print Purchase Order
  if (/print.*(?:po\b|purchase.*order)|(?:po\b|purchase.*order).*print/i.test(query)) {
    return {
      matched: true,
      type: 'print',
      printType: 'purchase_order',
      label: 'Print Purchase Order',
      description: 'Triggering official factory procurement purchase order document.'
    };
  }

  // C. Print Cash Voucher
  if (/print.*(?:voucher|cash.*voucher|expense)|(?:voucher|cash.*voucher).*print/i.test(query)) {
    return {
      matched: true,
      type: 'print',
      printType: 'cash_voucher',
      label: 'Print Cash Voucher',
      description: 'Triggering treasury cash disbursement / receipt voucher document.'
    };
  }

  // D. Print Inventory Report
  if (/print.*(?:inventory|stock|valuation)|(?:inventory|stock).*print/i.test(query)) {
    return {
      matched: true,
      type: 'print',
      printType: 'inventory_report',
      label: 'Print Inventory Stock Report',
      description: 'Triggering warehouse inventory valuation and stock audit document.'
    };
  }

  // ==========================================
  // 2. LIVE SYSTEM INSPECTION QUERIES
  // ==========================================

  // A. FBR Integration Readiness Checklist Guide
  if (
    /how.*make.*system.*ready.*fbr|how.*ready.*fbr|fbr.*integration.*ready|fbr.*ready.*kaise|fbr.*setup.*guide|fbr.*integration.*checklist|how.*to.*connect.*fbr|ready.*for.*fbr/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'live_query',
      queryType: 'fbr_readiness_guide',
      label: 'FBR Integration Readiness Protocol',
      description: 'Inspecting 5-step statutory readiness: Iris POS ID, 18% GST auto-rule, 16-field QR, and Sandbox handshake.'
    };
  }

  // B. Cash Position / Treasury Live Inspection
  if (
    /check.*cash|kitna.*cash|cash.*balance|cash.*position|cash.*kitna|paisa.*kitna|rokar.*kitni|treasury.*status|how much cash|check.*balance/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'live_query',
      queryType: 'cash',
      label: 'Live Cash Reserves Check',
      description: 'Inspecting real-time ledger inflows, disbursements, and net cash position.'
    };
  }

  // C. FBR Tax / GST on a Specific Sale Calculation
  if (
    /(?:tax|gst|fbr).*on.*(?:a\s+)?sale|sale.*(?:tax|gst)|calculate.*tax.*sale|check.*tax.*sale|fbr.*tax.*checking|tax.*for.*sale|sale.*par.*tax/i.test(
      query
    ) ||
    (extractedAmount && /(?:calculate|check|compute).*(?:gst|tax|fbr)/i.test(query))
  ) {
    return {
      matched: true,
      type: 'live_query',
      queryType: 'sale_tax',
      extractedAmount: extractedAmount || 100000,
      label: 'FBR Tax Calculation on Sale',
      description: `Computing statutory 18% GST and 4% further tax breakdown on ${
        extractedAmount ? 'Rs. ' + extractedAmount.toLocaleString() : 'Rs. 100,000 sample'
      }.`
    };
  }

  // D. GST / Sales Tax Collected Across Invoices
  if (
    /check.*gst|gst.*kitna|sales.*tax.*collected|tax.*collected|total.*tax|fbr.*tax.*status|gst.*status|tax.*kitna.*bana|how much gst/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'live_query',
      queryType: 'gst',
      label: 'Total FBR 18% GST Collected',
      description: 'Inspecting all issued invoices, total GST collected, and Annexure-C filing deadline.'
    };
  }

  // E. Live Inventory & Raw Material Stock Check
  if (
    /check.*stock|kitna.*stock|inventory.*check|low.*stock|kitna.*mal|stock.*kitna|check.*cotton|check.*yarn|check.*dye|stock.*level|how much stock/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'live_query',
      queryType: 'inventory',
      label: 'Live Stock & Warehouse Check',
      description: 'Inspecting raw material stock, reorder thresholds, and warehouse valuation.'
    };
  }

  // F. Outstanding Receivables & Client Balances
  if (
    /check.*receivable|who owes|kitne.*paise.*lene|outstanding|customer.*balance|pending.*payments.*from.*customer|receivables.*status/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'live_query',
      queryType: 'receivables',
      label: 'Accounts Receivable Check',
      description: 'Inspecting outstanding customer debts, credit limits, and collection status.'
    };
  }

  // G. Pending Purchase Orders / Committed Spend
  if (
    /check.*purchase.*order|pending.*po|pending.*purchase|procurement.*status|pending.*orders/i.test(query)
  ) {
    return {
      matched: true,
      type: 'live_query',
      queryType: 'purchase_orders',
      label: 'Procurement & Pending POs Check',
      description: 'Inspecting open purchase orders and committed factory procurement capital.'
    };
  }

  // H. Automate FBR Compliance & Tax Imposition
  if (
    /automate.*fbr|auto.*impose.*gst|automate.*tax|turn on.*tax.*automation|auto.*tax.*on|fbr.*compliance.*auto|auto.*tax.*everything/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'live_query',
      queryType: 'automate_tax',
      label: 'Automate FBR Compliance & Taxes',
      description: 'Activating automated 18% GST imposition, 4% further tax for non-filers, and Annexure-C sync.'
    };
  }

  // ==========================================
  // 3. MODAL POPUP WORKFLOW OPENERS
  // ==========================================

  // Purchase Order
  if (
    /record.*purchase|new purchase|create.*purchase.*order|issue.*purchase.*order|new po\b|purchase.*order|buy.*material|khareedari|po bana/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'modal',
      target: 'purchase',
      label: 'Purchase Order Creation',
      description: 'Opening Purchase Order Create Workflow'
    };
  }

  // Sale & Invoice
  if (
    /record.*sale|new sale|create.*sale|issue.*invoice|18%.*gst.*invoice|tax invoice|sell.*goods|sales.*order|sale karo|farokht/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'modal',
      target: 'sale',
      label: 'Sales & 18% GST Invoice',
      description: 'Opening Sales Invoice Workflow'
    };
  }

  // Raw Material / SKU
  if (
    /add.*raw.*material|new.*product|add.*product|add.*material|new.*sku|create.*material|naya.*raw.*material|item.*add/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'modal',
      target: 'product',
      label: 'Raw Material Registration',
      description: 'Opening SKU / Raw Material Workflow'
    };
  }

  // Cash / Expense Entry
  if (
    /add.*cash|post.*cash|record.*expense|add.*expense|bijli.*bill|electricity.*bill|utility.*bill|cash.*payment|cash.*receipt|kharcha.*add|rokar/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'modal',
      target: 'expense',
      label: 'Cashbook & Treasury',
      description: 'Opening Cashflow Entry Workflow'
    };
  }

  // Compliance RAG Knowledge
  if (
    /verify.*compliance|check.*fbr.*rule|tax.*rule|section 153|sro.*rule|verify.*tax|tax.*law/i.test(query)
  ) {
    return {
      matched: true,
      type: 'modal',
      target: 'compliance',
      label: 'FBR Compliance Verification',
      description: 'Opening Tax Compliance Verification Tool'
    };
  }

  // FBR Integration Hub Tab
  if (
    /fbr.*hub|fbr.*integration|digital.*invoicing.*hub|fbr.*readiness|fbr.*pos|sro 1805|iris.*integration|connect.*fbr/i.test(
      query
    )
  ) {
    return {
      matched: true,
      type: 'tab',
      target: 'fbr_integration',
      label: 'FBR Digital Invoicing Hub',
      description: 'Opening FBR Integration Readiness Center'
    };
  }

  // Supplier Onboarding
  if (/register.*supplier|add.*supplier|new.*supplier|add.*vendor|new.*vendor|naya.*supplier/i.test(query)) {
    return {
      matched: true,
      type: 'modal',
      target: 'supplier',
      label: 'Supplier Registration',
      description: 'Opening Supplier Onboarding Workflow'
    };
  }

  // Customer Onboarding
  if (/register.*customer|add.*customer|new.*customer|add.*client|new.*client|naya.*customer|add.*mill/i.test(query)) {
    return {
      matched: true,
      type: 'modal',
      target: 'customer',
      label: 'Customer Registration',
      description: 'Opening Client & Mill Registration'
    };
  }

  // ==========================================
  // 4. TAB NAVIGATION INTENTS
  // ==========================================
  if (/open.*inventory|go to.*inventory|show.*stock|show.*inventory/i.test(query)) {
    return {
      matched: true,
      type: 'tab',
      target: 'inventory',
      label: 'Inventory Module',
      description: 'Navigating to Inventory & Materials Ledger'
    };
  }

  if (/open.*purchase|show.*purchase|procurement.*list/i.test(query)) {
    return {
      matched: true,
      type: 'tab',
      target: 'purchase',
      label: 'Purchase Orders Module',
      description: 'Navigating to Purchase Orders'
    };
  }

  if (/open.*sales|show.*sales|show.*invoices|invoices.*list/i.test(query)) {
    return {
      matched: true,
      type: 'tab',
      target: 'sales',
      label: 'Sales & Invoices Module',
      description: 'Navigating to Sales & 18% GST Invoices'
    };
  }

  if (/open.*cashbook|show.*cashbook|treasury.*view|open.*treasury/i.test(query)) {
    return {
      matched: true,
      type: 'tab',
      target: 'cashbook',
      label: 'Cashbook & Treasury Module',
      description: 'Navigating to Cashbook & Treasury'
    };
  }

  if (/open.*compliance|show.*compliance|fbr.*module/i.test(query)) {
    return {
      matched: true,
      type: 'tab',
      target: 'compliance',
      label: 'Compliance Module',
      description: 'Navigating to FBR Compliance RAG'
    };
  }

  if (/open.*dashboard|executive.*dashboard|home/i.test(query)) {
    return {
      matched: true,
      type: 'tab',
      target: 'dashboard',
      label: 'Executive Dashboard',
      description: 'Navigating to Executive Dashboard'
    };
  }

  // Default fallback to Conversational Copilot
  return {
    matched: false,
    type: 'copilot',
    label: 'AI Copilot Query',
    description: 'Passing command to AI Copilot Supervisor'
  };
}
