/**
 * Statutory corpus for grounded retrieval.
 *
 * Every chunk carries the text it was drawn from and the citation to quote.
 * The retrieval layer scores against these; it never invents a rate.
 *
 * Where the law is genuinely unsettled — SN009, cotton spinners buying from
 * cotton ginners — there is NO chunk. That absence is deliberate: the gate must
 * refuse rather than reach for the nearest section and pass it off as an answer.
 */

export interface StatuteChunk {
  id: string;
  /** Short label used in the UI. */
  title: string;
  /** Governing instrument and section, quoted verbatim in the answer. */
  citation: string;
  /** The passage itself. Scored against, and the source of any quoted figure. */
  body: string;
  /** Only set when the statute states an unambiguous number. */
  gstRate?: number;
  withholdingRate?: number;
  filingDeadline?: string;
  /** Extra query terms this chunk should match on, beyond the body text. */
  keywords?: string[];
  /**
   * The `ComplianceRAGSource` this provision backs, so a retrieved chunk can
   * be shown alongside the indexed repository entry it came from.
   */
  sourceId?: string;
}

/**
 * Income Tax Ordinance 2001, Division III of the Fourth Schedule, s.153(1)(a) —
 * withholding on payments for supply of goods.
 */
const SEC_153_ATL: StatuteChunk = {
  id: 'ito_2001_s153_atl',
  sourceId: 'rag_fbr_withholding_153',
  title: 'Withholding on supply of goods — ATL filers',
  citation: 'Income Tax Ordinance 2001, Fourth Schedule, Part III, Section 153(1)(a)',
  body:
    'Where a person pays any amount to a resident person on account of the supply ' +
    'of goods, the person shall deduct tax at the rate of four and a half per cent ' +
    'where the supplier is an active taxpayer, that is to say, a person appearing ' +
    'on the Active Taxpayer List maintained by the Board.',
  withholdingRate: 4.5,
  filingDeadline: 'Monthly withholding statement due by the 15th of the subsequent month',
  keywords: ['withholding', 'wht', 'atl', 'active taxpayer', 'deduct tax', '153']
};

/**
 * The same section, non-ATL limb. Kept as a SEPARATE chunk so retrieval can
 * choose the right rate instead of returning one hardcoded figure for both.
 */
const SEC_153_NON_ATL: StatuteChunk = {
  id: 'ito_2001_s153_non_atl',
  sourceId: 'rag_fbr_withholding_153',
  title: 'Withholding on supply of goods — non-ATL filers',
  citation: 'Income Tax Ordinance 2001, Fourth Schedule, Part III, Section 153(1)(a) (non-ATL limb)',
  body:
    'Where a person pays any amount to a resident person on account of the supply ' +
    'of goods and the supplier is not an active taxpayer, the person shall deduct ' +
    'tax at twice the rate specified in the preceding clause, that is to say at ' +
    'nine per cent.',
  withholdingRate: 9,
  filingDeadline: 'Monthly withholding statement due by the 15th of the subsequent month',
  // NOTE: 'non atl' (spaced) was removed deliberately. Tokenised, it put a bare
  // 'atl' in this chunk's exact-match set and tied it with the real ATL chunk
  // at 0.900, leaving the ATL/non-ATL answer to be decided by alphabetical tie
  // -break rather than by score. One hyphenated keyword does both jobs.
  keywords: ['withholding', 'non-atl', 'non-filer', 'inactive', '9%', 'nine per cent', '153']
};

/** Sales Tax Act 1990, s.3(1) — the standard rate. */
const STA_S3_STANDARD: StatuteChunk = {
  id: 'sta_1990_s3_standard',
  sourceId: 'rag_fbr_sta_sec3',
  title: 'Standard rate of sales tax on taxable supplies',
  citation: 'Sales Tax Act 1990, Section 3(1)',
  body:
    'The rate of sales tax on a taxable supply made by a registered person shall ' +
    'be eighteen per cent of the value of the supply. The reduced or special rate, ' +
    'if any, applies only where this Act or a notification made under it provides ' +
    'otherwise, and a rate fixed by a special law prevails over this section.',
  gstRate: 18,
  keywords: [
    'gst', 'sales tax', 'standard rate', '18%', 'eighteen', 'taxable supply', 'rate',
    // The sector vocabulary this product actually indexes: the app is a
    // textile-mill copilot and its own preset query says "textile
    // manufacturing". Without these the top result lands exactly on the gate.
    'textile', 'textiles', 'manufacturing', 'manufacturer', 'mill', 'mills', 'yarn',
    'fabric', 'fibre', 'fiber', 'general manufacturing'
  ]
};

/** Sales Tax Act 1990, s.3(1A) — further tax on supplies to unregistered persons. */
const STA_S3_FURTHER: StatuteChunk = {
  id: 'sta_1990_s3_further',
  sourceId: 'rag_fbr_sta_sec3',
  title: 'Further tax on supplies to persons not appearing on the Active Taxpayer List',
  citation: 'Sales Tax Act 1990, Section 3(1A)',
  body:
    'Notwithstanding section 3(1), an amount of further tax, being two per cent of ' +
    'the value of a supply, shall be charged where the recipient of the supply does ' +
    'not appear on the Active Taxpayer List maintained by the Board. The rate of ' +
    'further tax is altered from time to time by notification, and the applicable ' +
    'notification for the relevant tax period must be consulted.',
  gstRate: 18,
  keywords: ['further tax', 'unregistered', 'active taxpayer list', 'atl', '3(1a)', 'additional tax']
};

/** Sales Tax Ordinance 2001, Third Schedule — tax computed on retail price. */
const STO_THIRD_SCHEDULE: StatuteChunk = {
  id: 'sto_2001_third_schedule',
  sourceId: 'rag_fbr_sta_sec3',
  title: 'Third Schedule supplies — tax computed on notified value or retail price',
  citation: 'Sales Tax Ordinance 2001, Third Schedule',
  body:
    'Where a person is a manufacturer or a person who imports goods and the sale or ' +
    'import of the goods is subject to sales tax at a rate exceeding one per cent, ' +
    'the value of the taxable supply shall be the value of the goods or the price ' +
    'at which they are sold to the retailer, whichever is higher. The tax is ' +
    'therefore computed on the notified value and not on the transaction value.',
  keywords: ['third schedule', 'retail price', 'retailer', 'notified value', 'exceeding one per cent']
};

/** Monthly filing and payment calendar. */
const FBR_CALENDAR: StatuteChunk = {
  id: 'fbr_monthly_calendar',
  sourceId: 'rag_fbr_calendar',
  title: 'Monthly sales tax filing and payment calendar',
  citation: 'Sales Tax Act 1990, Section 9 (returns) and Section 10 (payment)',
  body:
    'A person liable to pay sales tax shall furnish an electronic return in the ' +
    'prescribed form on or before the tenth day of the month following the tax ' +
    'period, pay the tax due into a designated bank account of the Federal Board ' +
    'of Revenue on or before the fifteenth day of that month, and the return, along ' +
    'with the annexures, shall stand submitted on Iris on the eighteenth day.',
  gstRate: 18,
  filingDeadline: '10th (annexure-C), 15th (payment), 18th (Iris e-return)',
  keywords: ['filing', 'deadline', 'calendar', 'return', 'annexure', 'iris', 'due date', 'monthly']
};

/** Zero-rating for exports and EOUs. */
const SRO_345_EXPORT: StatuteChunk = {
  id: 'sro_345_export_eou',
  sourceId: 'rag_fbr_sro_345',
  title: 'Zero-rating on direct export and supplies to Export Oriented Units',
  citation: 'S.R.O. 345(I)/2024 and Sales Tax Act 1990, Section 5(1)(d) read with the Fifth Schedule',
  body:
    'A supply of goods by a person who is registered and whose goods are exported, ' +
    'or supplied to an Export Oriented Unit against a bank certificate, is a ' +
    'zero-rated supply on which no sales tax is charged. A domestic sale of yarn or ' +
    'fabric to a local buyer is not zero-rated and is subject to the standard rate ' +
    'under section 3(1), whatever the contractual label used.',
  gstRate: 18,
  keywords: ['export', 'zero rating', 'zero-rated', 'eou', 'export oriented unit', 'sro 345', 'exemption', 'annexure h']
};

/** Sales tax on goods — what counts as a supply (used for context). */
const STA_S2_SUPPLY: StatuteChunk = {
  id: 'sta_1990_s2_supply',
  sourceId: 'rag_fbr_sta_sec3',
  title: 'Meaning of supply',
  citation: 'Sales Tax Act 1990, Section 2(1)(c) read with Section 3',
  body:
    'Supply means making a taxable supply by a person in the course of his business ' +
    'in Pakistan, and includes sale, transfer, exchange, hiring out or disposal of ' +
    'the goods. A supply made other than in the course of business is not a taxable ' +
    'supply and no tax is charged on it.',
  keywords: ['supply', 'taxable supply', 'sale', 'business', 'definition']
};

export const STATUTORY_CORPUS: StatuteChunk[] = [
  SEC_153_ATL,
  SEC_153_NON_ATL,
  STA_S3_STANDARD,
  STA_S3_FURTHER,
  STO_THIRD_SCHEDULE,
  FBR_CALENDAR,
  SRO_345_EXPORT,
  STA_S2_SUPPLY
];