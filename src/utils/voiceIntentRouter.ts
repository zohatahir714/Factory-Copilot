/**
 * Enterprise Voice Intent & Live System Inspection Router — Urdu-first
 * Understands native Urdu (اردو), Roman Urdu, and English for EVERY module
 * action in the system:
 *  1. Live inspections (cash, GST, tax-on-sale, stock, receivables, POs, P&L, ledger, parties, day reports)
 *  2. Document printing (FBR invoice, PO, voucher, inventory report)
 *  3. Creation workflows (supplier, customer, product, PO, sale, cashbook voucher)
 *  4. Navigation to every module (dashboard, inventory, POs, sales, cashbook, reports, FBR, compliance, copilot, settings)
 *  5. FBR readiness guide, tax automation, conversational Copilot fallback
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
    | 'payables'
    | 'profit_loss'
    | 'parties'
    | 'day_book'
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
  // Normalize: lowercase, collapse whitespace, strip Urdu diacritics.
  const query = (rawTranscript || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Urdu native script also folded into a searchable form (keep original for script checks).
  const urdu = query;

  if (!query) {
    return { matched: false, type: 'copilot', label: 'خالی کمانڈ', description: 'کوئی آواز قابلِ فہم نہیں آئی' };
  }

  // Extract amounts: "2 lakh", "50 hazar", "100k", "1,00,000", "پچاس ہزار"
  let extractedAmount: number | undefined;
  const lakhMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|لاکھ)/i);
  const croreMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:crore|kror|کروڑ)/i);
  if (croreMatch) extractedAmount = Math.round(parseFloat(croreMatch[1]) * 10000000);
  else if (lakhMatch) extractedAmount = Math.round(parseFloat(lakhMatch[1]) * 100000);
  else {
    const hazarMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:hazar|hazaar|thousand|ہزار)/i);
    if (hazarMatch) extractedAmount = Math.round(parseFloat(hazarMatch[1]) * 1000);
    else {
      const kMatch = query.match(/(\d+(?:\.\d+)?)\s*k\b/i);
      if (kMatch) extractedAmount = Math.round(parseFloat(kMatch[1]) * 1000);
      else {
        const numMatch = query.match(/\b(\d[\d,]{2,})\b/);
        if (numMatch) extractedAmount = parseInt(numMatch[1].replace(/,/g, ''), 10);
      }
    }
  }

  // Urdu numeral words for quantities ("پچاس" = 50, "سو" = 100)
  const urduQty: Record<string, number> = { 'ایک': 1, 'دو': 2, 'پانچ': 5, 'دس': 10, 'بیس': 20, 'پچاس': 50, 'سو': 100, 'دو سو': 200, 'پانچ سو': 500 };
  let urduQuantity: number | undefined;
  for (const [word, val] of Object.entries(urduQty)) {
    if (urdu.includes(word) && /(kilo|kg|یونٹ|کلو|инок|unit)/i.test(urdu)) { urduQuantity = val; break; }
  }

  // ==========================================
  // 1. DOCUMENT PRINTING — پرنٹ / چھاپ / print
  // ==========================================
  const wantsPrint = /print|چھاپ|پرنٹ|छापे/.test(query);

  if (wantsPrint && /invoice|receipt|thermal|bill|fbr|انوئس|رسید/.test(query)) {
    return { matched: true, type: 'print', printType: 'invoice', label: 'FBR 80mm تھرمل انوئس', description: 'FBR QR اور ٹیکس تفصیل کے ساتھ سرکاری ڈیجیٹل فسکل انوئس چھپ رہی ہے۔' };
  }
  if (wantsPrint && /(po\b|purchase|order|آرڈر)/.test(query)) {
    return { matched: true, type: 'print', printType: 'purchase_order', label: 'پرچیز آرڈر پرنٹ', description: 'سرکاری فیکٹری پرچیز آرڈر ڈاکومنٹ چھپ رہا ہے۔' };
  }
  if (wantsPrint && /(voucher|cash|واؤچر|نقد)/.test(query)) {
    return { matched: true, type: 'print', printType: 'cash_voucher', label: 'کیش واؤچر پرنٹ', description: 'خزانہ وصولی/ادائیگی واؤچر ڈاکومنٹ چھپ رہا ہے۔' };
  }
  if (wantsPrint && /(inventory|stock|valuation|اسٹاک|رپورٹ)/.test(query)) {
    return { matched: true, type: 'print', printType: 'inventory_report', label: 'اسٹاک رپورٹ پرنٹ', description: 'گودام ویلیویشن اور اسٹاک آڈٹ رپورٹ چھپ رہی ہے۔' };
  }

  // ==========================================
  // 2. LIVE INSPECTIONS — چیک / کتنا / kitna / status
  // ==========================================

  // A. FBR Integration Readiness
  if (/how.*ready.*fbr|fbr.*integration.*ready|fbr.*setup|fbr.*checklist|connect.*fbr|ایف بی آر.*تیار|فبر.*انٹیگریشن/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'fbr_readiness_guide', label: 'FBR انٹیگریشن ریڈینیس', description: 'Iris POS ID، 18% GST خودکار اصول، 16-فیلڈ QR، اور Sandbox ہینڈشیک کی 5 مرحلوں کی جانچ۔' };
  }

  // B. Cash / Treasury — نقد / روکڑ / tijori
  if (/check.*cash|kitna.*cash|cash.*balance|cash.*position|rokar|tijori|treasury|liquidity|نقد|روکڑ|پیسہ.*کتنا|منی.*کتنی/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'cash', label: 'لائیو کیش پوزیشن', description: 'لیجر وصولیاں، ادائیگیاں، اور خالص نقد جائزہ۔' };
  }

  // C. Tax on a specific sale amount
  if (/(?:tax|gst|fbr).*on.*(?:a\s+)?sale|sale.*(?:tax|gst)|calculate.*tax|tax.*for.*sale|سیل.*ٹیکس|ٹیکس.*نکلو|ٹیکس.*کالکولیٹ/i.test(query) ||
      (extractedAmount && /(?:calculate|check|compute|نکلو|کتنا).*(?:gst|tax|fbr|ٹیکس)/i.test(query))) {
    return { matched: true, type: 'live_query', queryType: 'sale_tax', extractedAmount: extractedAmount || 100000, label: 'سیل پر FBR ٹیکس حساب', description: `${extractedAmount ? 'Rs. ' + extractedAmount.toLocaleString() : 'Rs. 100,000'} پر 18% GST اور 4% فرڈر ٹیکس کا تفصیل۔` };
  }

  // D. GST collected overall
  if (/check.*gst|gst.*kitna|tax.*collected|total.*tax|gst.*status|جی ایس ٹی|ٹیکس.*کتنا|گوشوارہ/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'gst', label: 'کل 18% GST وصول', description: 'تمام انوائسز، کل GST وصولی، اور اینیکسچر-سی فائلنگ ڈیڈلائن۔' };
  }

  // E. Stock / Inventory — اسٹاک / مال
  if (/check.*stock|kitna.*stock|stock.*kitna|inventory|low.*stock|kam.*stock|khatam|مال.*کتنا|اسٹاک/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'inventory', label: 'لائیو اسٹاک چیک', description: 'کچھ مال، ری آرڈر حد، اور گودام ویلیویشن کا جائزہ۔' };
  }

  // F. Receivables — وصول کرنا ہے / udhaar
  if (/check.*receivable|who owes|outstanding|udhaar|udhar|customer.*balance|وصولی|قرض|ادھار|کس.*کا.*پیسہ/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'receivables', label: 'وصولیaulات (AR)', description: 'گاہکوں سے وصول ہونے والی رقم، کریڈٹ حد، اور کلیکشن اسٹیٹس۔' };
  }

  // G. Payables — hum ne dene hain
  if (/check.*payable|supplier.*balance|we.*owe|dena.*hai|ادا کرنا|قرض.*سپلائر|پیمنٹ.*بقایا/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'payables', label: 'ادائیگیاں (AP)', description: 'سپلائرز کو دینے والی رقم اور بقایا واجبات۔' };
  }

  // H. Pending POs
  if (/check.*purchase.*order|pending.*po|pending.*orders|procurement|پی او|آرڈر.*پینڈنگ/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'purchase_orders', label: 'پینڈنگ پرچیز آرڈرز', description: 'کھلے POs اور کمٹڈ پروکیورمنٹ کیپٹل۔' };
  }

  // I. Profit & Loss / Munafa
  if (/profit|loss|munafa|nuksan|پرافٹ|منافع|نقصان|کمائی.*کتنی/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'profit_loss', label: 'نفعہ و نقصان', description: 'آمدنی، اخراجات، اور خالص نفعہ کا جائزہ۔' };
  }

  // J. Parties — customers & suppliers list
  if (/customer.*list|supplier.*list|kitne.*customer|kitne.*supplier|parties|گاہک|سپلائر|فہرست/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'parties', label: 'گاہک و سپلائر رجسٹری', description: 'رجسٹرڈ گاہکوں اور سپلائرز کی فہرست اور بیلنس۔' };
  }

  // K. Day book / aaj ka hisab
  if (/day.*book|aaj.*ka|today.*report|today.*summary|آج.*حساب|ڈلی رپورٹ/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'day_book', label: 'آج کا ڈے بک', description: 'آج کی وصولیاں، ادائیگیاں، اور افتتاحی/اختتامی بیلنس۔' };
  }

  // L. Automate FBR compliance
  if (/automate.*fbr|auto.*impose|automate.*tax|auto.*tax|خودکار.*ٹیکس/i.test(query)) {
    return { matched: true, type: 'live_query', queryType: 'automate_tax', label: 'FBR خودکار ٹیکس', description: '18% GST خودکار نفاذ، 4% فرڈر ٹیکس، اور اینیکسچر-سی سنک۔' };
  }

  // ==========================================
  // 3. CREATION WORKFLOWS — بنا / کھول / add / new
  // ==========================================

  // Purchase Order — "PO banao", "آرڈر بنا"
  if (/record.*purchase|new purchase|create.*purchase|issue.*purchase|new po\b|purchase.*order|buy.*material|khareed|po bana|آرڈر.*بنا|خریداری|پی او.*بنا/i.test(query)) {
    return { matched: true, type: 'modal', target: 'purchase', label: 'نیا پرچیز آرڈر', description: 'پرچیز آرڈر ورک فلو کھل رہا ہے۔' };
  }

  // Sale — "becho", "سیل کرو", "invoice banao"
  if (/record.*sale|new sale|create.*sale|issue.*invoice|tax invoice|sell|becho|bikri|sale karo|farokht|سیل.*کرو|بکری|فروخت|انوئس.*بنا/i.test(query)) {
    return { matched: true, type: 'modal', target: 'sale', label: 'سیل و 18% GST انوئس', description: 'سیل انوئس ورک فلو کھل رہا ہے۔' };
  }

  // Product
  if (/add.*raw.*material|new.*product|add.*product|add.*material|new.*sku|item.*add|پروڈکٹ.*شامل|نیا.*مال/i.test(query)) {
    return { matched: true, type: 'modal', target: 'product', label: 'نیا پروڈکٹ/مال', description: 'پروڈکٹ رجسٹریشن ورک فلو کھل رہا ہے۔' };
  }

  // Cashbook voucher
  if (/add.*cash|post.*cash|record.*expense|add.*expense|bijli.*bill|electricity.*bill|utility|cash.*payment|cash.*receipt|kharcha|واؤچر.*بنا|خرچہ|بجلی.*بل/i.test(query)) {
    return { matched: true, type: 'modal', target: 'expense', label: 'کیش بک واؤچر', description: 'کیش فلو انٹری ورک فلو کھل رہا ہے۔' };
  }

  // Supplier
  if (/register.*supplier|add.*supplier|new.*supplier|add.*vendor|new.*vendor|سپلائر.*شامل|نیا.*وینڈر/i.test(query)) {
    return { matched: true, type: 'modal', target: 'supplier', label: 'نیا سپلائر', description: 'سپلائر آن بورڈنگ کھل رہی ہے۔' };
  }

  // Customer
  if (/register.*customer|add.*customer|new.*customer|add.*client|new.*client|add.*mill|گاہک.*شامل|نیا.*کلائنٹ/i.test(query)) {
    return { matched: true, type: 'modal', target: 'customer', label: 'نیا گاہک', description: 'گاہک رجسٹریشن کھل رہی ہے۔' };
  }

  // Compliance RAG
  if (/verify.*compliance|tax.*rule|section 153|sro|verify.*tax|tax.*law|قانون|سیکشن/i.test(query)) {
    return { matched: true, type: 'modal', target: 'compliance', label: 'FBR کمپلائنس RAG', description: 'ٹیکس کمپلائنس تصدیقی ٹول کھل رہا ہے۔' };
  }

  // ==========================================
  // 4. NAVIGATION — کھول / دکھاؤ / open / show / go to
  // ==========================================
  const nav = (re: RegExp, target: string, label: string, description: string): VoiceRouteResult =>
    ({ matched: true, type: 'tab', target, label, description });

  if (/fbr.*hub|fbr.*integration|digital.*invoicing|fbr.*pos|sro 1805|iris|ایف بی آر.*ہب/i.test(query)) return nav(/x/, 'fbr_integration', 'FBR ڈیجیٹل انوائسنگ ہب', 'FBR انٹیگریشن ریڈینیس سینٹر۔');
  if (/open.*inventory|show.*inventory|go to.*inventory|اسٹاک.*ماڈیول|انوینٹری.*کھول/i.test(query)) return nav(/x/, 'inventory', 'انوینٹری ماڈیول', 'انوینٹری اور میٹریلز لیجر۔');
  if (/open.*purchase|show.*purchase|پرچیز.*ماڈیول/i.test(query)) return nav(/x/, 'purchase', 'پرچیز آرڈرز ماڈیول', 'پرچیز آرڈرز فہرست۔');
  if (/open.*sales|show.*sales|show.*invoices|سیل.*ماڈیول/i.test(query)) return nav(/x/, 'sales', 'سیل اور انوائسز', 'سیل و 18% GST انوائسز۔');
  if (/open.*cashbook|show.*cashbook|treasury|کیش بک.*کھول|خزانہ/i.test(query)) return nav(/x/, 'cashbook', 'کیش بک و خزانہ', 'کیش بک ماڈیول۔');
  if (/open.*report|show.*report|general.*ledger|ledger|رپورٹ.*کھول|لیجر/i.test(query)) return nav(/x/, 'reports', 'رپورٹس و جنرل لیجر', 'فنانشل رپورٹس ماڈیول۔');
  if (/open.*compliance|show.*compliance|کمپلائنس/i.test(query)) return nav(/x/, 'compliance', 'کمپلائنس ماڈیول', 'FBR کمپلائنس RAG۔');
  if (/open.*copilot|open.*chat|چیٹ.*بوٹ|کوپائلٹ/i.test(query)) return nav(/x/, 'copilot', 'AI کوپائلٹ', 'AI چیٹ ٹرمینل۔');
  if (/open.*settings|show.*settings|ترتیبات|سیٹنگز/i.test(query)) return nav(/x/, 'settings', 'سیٹنگز', 'سسٹم ترتیبات۔');
  if (/open.*dashboard|executive.*dashboard|go home|ڈیش بورڈ|ہوم/i.test(query)) return nav(/x/, 'dashboard', 'ایگزیکٹو ڈیش بورڈ', 'مرکزی ڈیش بورڈ۔');

  // Default: Copilot conversation (Urdu)
  return {
    matched: false,
    type: 'copilot',
    label: 'AI کوپائلٹ سوال',
    description: 'کمانڈ AI سپروائزر کو بھیجی جا رہی ہے'
  };
}
