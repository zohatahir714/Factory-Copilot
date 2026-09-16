/**
 * VOICE MIND — normalize.ts
 * Urdu/ASR text cleanup shared by fastPath and mind. Pure functions, no deps.
 *
 * Why this exists: Urdu ASR (ur-PK + Whisper) transcribes numbers as
 * Arabic-Indic digits (۵۰), splits common words oddly, and mixes scripts.
 * Every downstream matcher works on the normalized Latin-digit form.
 */

/** Arabic-Indic (۰-۹) and extended (۰-۹) digits → ASCII. */
const AR_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

/** Common Urdu ASR variants folded to one canonical word. */
const WORD_FOLD: Array<[RegExp, string]> = [
  [/\bکش\b/g, 'کیش'],           // ASR hears "kash" for "cash"
  [/\bکیش\b/g, 'کیش'],
  [/\bstoke?\b/g, 'stock'],      // "stoke" → stock
  [/\bhistock\b/g, 'stock'],
  [/\bcesh\b/g, 'cash'],
  [/\bcashbook\b/g, 'cash book'],
  [/\binvoice?s\b/g, 'invoice'],
  [/\bpurchase orders?\b/g, 'purchase order'],
  [/\bpoes\b/g, 'po']
];

/**
 * Normalize an utterance: unify digits, fold ASR variants, collapse whitespace.
 * Returns the normalized string; keeps original script (Urdu stays Urdu).
 */
export function normalizeUtterance(raw: string): string {
  let t = (raw || '').toString();
  t = t.replace(/[۰-۹٠-٩]/g, (d) => AR_DIGITS[d] ?? d);
  for (const [re, rep] of WORD_FOLD) t = t.replace(re, rep);
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Urdu/Roman number words → value. Handles compound forms:
 * «پچاس ہزار» (50 thousand), «دو لاکھ» (2 lakh), «ایک کروڑ».
 * Scans left-to-right, multiplying by the unit that follows.
 */
const URDU_NUM: Record<string, number> = {
  'صفر': 0, 'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'چھ': 6, 'سات': 7,
  'آٹھ': 8, 'نو': 9, 'دس': 10, 'بیس': 20, 'تیس': 30, 'چالیس': 40, 'پچاس': 50,
  'ساٹھ': 60, 'ستر': 70, 'اسی': 80, 'نواسى': 90, 'نواسی': 90, 'سو': 100,
  'چھیاسی': 86, 'چوراسی': 84, 'چھیہتر': 76, 'چھہتر': 76, 'باون': 52, 'ترپن': 53
};
const URDU_UNITS: Record<string, number> = { 'ہزار': 1e3, 'لاکھ': 1e5, 'کروڑ': 1e7 };

export function urduNumberToValue(words: string[]): number | null {
  let total: number | null = null;
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const n = URDU_NUM[w];
    if (n !== undefined) {
      let value = n;
      // Multiply by a unit word that immediately follows (ہزار/لاکھ/کروڑ).
      let j = i + 1;
      while (j < words.length && URDU_UNITS[words[j]]) {
        value *= URDU_UNITS[words[j]];
        j++;
      }
      total = (total ?? 0) + value;
      i = j;
      continue;
    }
    // Standalone unit word after a bare number (e.g. "50 ہزار").
    if (URDU_UNITS[w] && total !== null) {
      total *= URDU_UNITS[w];
      i++;
      continue;
    }
    i++;
  }
  return total;
}

/** Match Urdu number words in a string and return the first value found. */
export function firstUrduNumber(text: string): number | null {
  const words = text.split(' ');
  return urduNumberToValue(words);
}

/**
 * Extract a monetary amount from normalized text: digits with units
 * (lakh/hazar/k/crore) or Urdu number words. Returns null if none.
 */
export function extractAmount(text: string): number | null {
  const crore = text.match(/(\d+(?:\.\d+)?)\s*(?:crore|kror|کروڑ)/i);
  if (crore) return Math.round(parseFloat(crore[1]) * 1e7);
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|لاکھ)/i);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 1e5);
  const hazar = text.match(/(\d+(?:\.\d+)?)\s*(?:hazar|hazaar|thousand|ہزار)/i);
  if (hazar) return Math.round(parseFloat(hazar[1]) * 1e3);
  const k = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return Math.round(parseFloat(k[1]) * 1e3);
  const digits = text.match(/\b(\d{1,3}(?:,\d{3})+|\d{3,})\b/);
  if (digits) return parseInt(digits[1].replace(/,/g, ''), 10);
  return firstUrduNumber(text);
}

/**
 * Extract a quantity + unit: «50 کلو», "200 kg", «دو سو کلو».
 * Returns null if no quantity phrase is present.
 */
const URDU_QTY: Record<string, number> = {
  'ایک': 1, 'دو': 2, 'تین': 3, 'چار': 4, 'پانچ': 5, 'دس': 10, 'بیس': 20,
  'پچاس': 50, 'سو': 100, 'دو سو': 200, 'پانچ سو': 500, 'ہزار': 1000
};
/** Roman Urdu numerals that multiply a following سو/ہزار (e.g. «do سو»). */
const ROMAN_MULTIPLIER: Record<string, number> = {
  do: 2, teen: 3, char: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20, pachas: 50
};
const UNIT_PATTERNS: Array<[RegExp, string]> = [
  // Lookarounds instead of \b: \b fails around Urdu script (non-ASCII word chars).
  [/(?<![A-Za-z])(?:kg|kilo|kilos|کلو|کیلو)(?![A-Za-z])/i, 'kg'],
  [/(?<![A-Za-z])(?:meters?|metres?|میٹر)(?![A-Za-z])/i, 'meters'],
  [/(?<![A-Za-z])(?:liters?|litres?|لیٹر)(?![A-Za-z])/i, 'liters'],
  [/(?<![A-Za-z])(?:bags?|بیگ|بوری)(?![A-Za-z])/i, 'bags'],
  [/(?<![A-Za-z])(?:cones?|کون)(?![A-Za-z])/i, 'cones'],
  [/(?<![A-Za-z])(?:rolls?|رول)(?![A-Za-z])/i, 'rolls'],
  [/(?<![A-Za-z])(?:pieces?|pcs|عدد)(?![A-Za-z])/i, 'pieces']
];

export function extractQuantityUnit(text: string): { quantity: number; unit: string } | null {
  for (const [re, unit] of UNIT_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const before = text.slice(0, m.index ?? 0).trim();
    const numMatch = before.match(/(\d+(?:\.\d+)?)\s*$/);
    if (numMatch) return { quantity: parseFloat(numMatch[1]), unit };
    // Urdu number words immediately before the unit word — compound pairs
    // first («دو سو» = 200, incl. mixed Roman «do سو»), then the trailing word.
    const words = before.split(' ').filter(Boolean);
    if (words.length >= 2 && URDU_QTY[words.slice(-2).join(' ')] !== undefined) {
      return { quantity: URDU_QTY[words.slice(-2).join(' ')], unit };
    }
    for (let k = words.length - 1; k >= Math.max(0, words.length - 3); k--) {
      if (URDU_QTY[words[k]] === undefined) continue;
      let quantity = URDU_QTY[words[k]];
      // Roman numeral immediately before سو/ہزار multiplies («do سو» = 200).
      const prev = words[k - 1];
      if (prev && ROMAN_MULTIPLIER[prev.toLowerCase()] !== undefined) {
        quantity *= ROMAN_MULTIPLIER[prev.toLowerCase()];
      }
      return { quantity, unit };
    }
  }
  return null;
}
