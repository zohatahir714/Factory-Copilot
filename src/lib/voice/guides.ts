/**
 * VOICE MIND — guides.ts
 * Deterministic module walkthroughs (spec §5.2): procedural questions return
 * numbered step cards with module links + an اگلا قدم next-step chip.
 * Pure data — the chat surface renders them.
 */

export interface GuideStep {
  text: string;
  /** Optional module to open for this step. */
  module?: string;
}

export interface GuideCard {
  id: string;
  title: string;
  badge: string;
  steps: GuideStep[];
  /** Suggested next command shown as an اگلا قدم chip. */
  nextStep?: { label: string; prompt: string };
  /** Module opened by the card's primary button. */
  primaryModule?: string;
}

const GUIDES: Record<string, GuideCard> = {
  system: {
    id: 'system',
    title: 'یہ سسٹم آپ کا کیا کام آسانی کرے گا؟',
    badge: 'مکمل رہنمائی',
    steps: [
      { text: 'پہلے اپنا مال (پروڈکٹس) درج کریں — نام، یونٹ، قیمت', module: 'inventory' },
      { text: 'سپلائرز رجسٹر کریں جن سے مال منگواؤں گے', module: 'suppliers' },
      { text: 'گاہک رجسٹر کریں جن کو بیچنا ہے', module: 'customers' },
      { text: 'پرچیز آرڈر بنا کر مال منگوائیں، ملازمت کے بعد گڈز ریسیو کریں', module: 'purchase' },
      { text: 'سیل کریں — 18% GST انوائس خود بن جائے گی', module: 'sales' },
      { text: 'کیش بک میں وصولی اور اخراجات درج کریں', module: 'cashbook' },
      { text: 'رپورٹس میں لیجر، ٹرائل بیلنس اور P&L دیکھیں', module: 'reports' }
    ],
    nextStep: { label: 'اب پروڈکٹ شامل کریں', prompt: 'inventory کھولو' },
    primaryModule: 'inventory'
  },
  sale: {
    id: 'sale',
    title: 'سیل کیسے درج کریں؟',
    badge: 'قدم بہ قدم',
    steps: [
      { text: 'گاہک رجسٹرڈ ہونا چاہیے (نہ ہو تو پہلے گاہک شامل کریں)', module: 'customers' },
      { text: 'سیل ماڈیول کھولیں اور «نیا سیل» دبائیں', module: 'sales' },
      { text: 'گاہک، پروڈکٹ اور تعداد منتخب کریں — 18% GST خود لگے گا' },
      { text: 'انوائس محفوظ کریں — لیجر میں خود پوسٹ ہو جائے گی' }
    ],
    nextStep: { label: 'اب آواز سے سیل درج کریں', prompt: 'Lahore Apparel House کو 25 کلو یارن بیچو' },
    primaryModule: 'sales'
  },
  purchase: {
    id: 'purchase',
    title: 'پرچیز آرڈر کیسے بنائیں؟',
    badge: 'قدم بہ قدم',
    steps: [
      { text: 'سپلائر رجسٹرڈ ہونا چاہیے', module: 'suppliers' },
      { text: 'پرچیز ماڈیول کھولیں اور «نیا PO» دبائیں', module: 'purchase' },
      { text: 'سپلائر، مال اور تعداد منتخب کریں — کلف جاری ہو جائے گا' },
      { text: 'مال آنے پر گڈز ریسیو کریں — اسٹاک خود بڑھے گا' }
    ],
    nextStep: { label: 'اب آواز سے PO بنائیں', prompt: 'Adil Textiles سے 200 کلو یارن منگواؤ' },
    primaryModule: 'purchase'
  },
  cashbook: {
    id: 'cashbook',
    title: 'کیش واؤچر کیسے درج کریں؟',
    badge: 'قدم بہ قدم',
    steps: [
      { text: 'کیش بک ماڈیول کھولیں', module: 'cashbook' },
      { text: '«نیا واؤچر» دبائیں — اکاؤنٹ، رقم، تفصیل دیں' },
      { text: 'واؤچر محفوظ کریں — لیجر اور ڈے بک میں خود آ جائے گا' }
    ],
    nextStep: { label: 'آواز سے واؤچر', prompt: '50000 کا کیش واؤچر بناو' },
    primaryModule: 'cashbook'
  },
  reports: {
    id: 'reports',
    title: 'رپورٹس کیسے دیکھیں؟',
    badge: 'قدم بہ قدم',
    steps: [
      { text: 'رپورٹس ماڈیول کھولیں', module: 'reports' },
      { text: 'ٹیب منتخب کریں: جنرل لیجر، ٹرائل بیلنس، P&L، ڈیلی کیش بک' },
      { text: 'اکاؤنٹ لینس اور تاریخ کی حد چنیں' }
    ],
    nextStep: { label: 'منافع پوچھیں', prompt: 'اس ماہ کا منافع بتاؤ' },
    primaryModule: 'reports'
  },
  compliance: {
    id: 'compliance',
    title: 'FBR کمپلائنس کیسے چیک کریں؟',
    badge: 'قدم بہ قدم',
    steps: [
      { text: 'کمپلائنس ماڈیول میں ٹیکس سوال لکھیں (مثلاً Section 153)', module: 'compliance' },
      { text: 'Jواب صرف حوالہ شدہ دستاویزات سے آتا ہے — ریٹ یا ڈیڈلائن کبھی بناوٹی نہیں' },
      { text: 'FBR ہب میں انٹیگریشن اسٹیٹس دیکھیں', module: 'fbr_integration' }
    ],
    nextStep: { label: 'GST قانون پوچھیں', prompt: 'سیل پر کیا ٹیکس قانون لاگو ہے؟' },
    primaryModule: 'compliance'
  }
};

/** Route a guide intent to its card. Falls back to the system tour. */
export function getGuideCard(topic: string | null): GuideCard {
  const key = (topic || '').toLowerCase();
  if (key.includes('sale') || key.includes('سیل')) return GUIDES.sale;
  if (key.includes('purchase') || key.includes('آرڈر')) return GUIDES.purchase;
  if (key.includes('cash') || key.includes('واؤچر')) return GUIDES.cashbook;
  if (key.includes('report') || key.includes('لیجر')) return GUIDES.reports;
  if (key.includes('compliance') || key.includes('ٹیکس')) return GUIDES.compliance;
  return GUIDES.system;
}

export function allGuideTopics(): string[] {
  return Object.keys(GUIDES);
}
