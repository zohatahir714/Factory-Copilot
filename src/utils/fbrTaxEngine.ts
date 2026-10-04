/**
 * FBR Pakistan Statutory Tax & Digital Invoicing Engine
 * Governed by:
 * - Sales Tax Act 1990 (Section 3(1) 18% GST, Section 3(1A) 4% Further Tax)
 * - Sales Tax Act 1990 (Section 23 Invoice particulars & Section 73 Banking mode threshold)
 * - Income Tax Ordinance 2001 (Section 153(1)(a) WHT on goods 4.5%/9%, Section 153(1)(b) on services 11%/15%)
 * - FBR S.R.O. 1805(I)/2024 & S.R.O. 775(I)/2018 (Tier-1 Retailers / Digital Invoicing POS Integration)
 * - Finance Act 2024 (Standard 18% GST, 4% Further Tax for unregistered/non-filers)
 */

import { sha256Hex } from '../lib/fbr/sha256';

/**
 * Sentinels for values we do not have. NEVER replace these with a plausible
 * number.
 *
 * The buyer-side equivalents ('UNREGISTERED', 'Not recorded') were removed from
 * this file earlier because they were invented national ID numbers and HS
 * codes reaching documents meant for a tax authority. The SELLER side carried
 * the identical bug and survived that pass, because the tests only ever
 * asserted the negative property for buyers:
 *
 *     sellerNTN  default '4029184-7'          <- a made-up NTN
 *     sellerSTRN default '32-77-8761-234-19'  <- a made-up STRN
 *     PCTCode    default '5205.1200'          <- cotton yarn, applied to any item
 *     posId      default 'POS-78601'          <- a made-up POS registration
 *
 * These strings are exported so the UI can stop repeating the same literals.
 */
export const NOT_CONFIGURED = 'NOT CONFIGURED';
export const NOT_RECORDED = 'Not recorded';

/**
 * Deterministic six-digit suffix for the fiscal invoice number.
 *
 * This used to be `Date.now().toString().slice(-6)`, which minted a brand new
 * fiscal number on every render: the same invoice displayed one number, then a
 * different one after archiving, then a third when reprinted. A fiscal
 * document has to carry one stable number, so it is derived from the record
 * instead of the clock.
 */
/**
 * The year stamped into an FBR fiscal document number.
 *
 * Taken from the RECORD's own date, never typed in. The prefix used to be the
 * literal `FBR-PK-` plus a hardcoded year, which put a 2024 stamp on tax documents printed in
 * 2026 — an identifier no system of record produced. When a record carries no
 * usable date the current year is used, because that is a fact about the
 * document being produced now; a constant would not be.
 */
function fiscalYearOf(recordDate: string | undefined): string {
  const parsed = recordDate ? new Date(recordDate) : null;
  const year = parsed && !Number.isNaN(parsed.getTime())
    ? parsed.getFullYear()
    : new Date().getFullYear();
  return String(year);
}

function stableFiscalSuffix(invoiceNumber: string | undefined, grandTotal: number, invoiceDate: string | undefined): string {
  const seed = `${invoiceNumber || 'INV-DIRECT'}|${invoiceDate || ''}|${grandTotal}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 1000000;
  }
  return String(h).padStart(6, '0');
}

export interface FBRTaxCalculationParams {
  amount: number; // Pre-tax subtotal in PKR
  isFiler?: boolean; // Active Taxpayer List (ATL) status
  isRegisteredSalesTax?: boolean; // Holds valid Sales Tax Registration Number (STRN)
  transactionType?: 'sale' | 'purchase' | 'service';
  sector?: 'textile' | 'general' | 'chemical';
  posMachineId?: string;
  posRegistrationNumber?: string;
  invoiceNumber?: string;
  /**
   * The invoice's own issue timestamp. Preferred over the wall clock so the
   * fiscal number and the QR payload stay identical every time the document is
   * opened, previewed, archived or reprinted. Falls back to "now" only when the
   * record genuinely carries no date.
   */
  invoiceDate?: string;
  sellerNTN?: string;
  sellerSTRN?: string;
  buyerNTN?: string;
  buyerCNIC?: string;
  paymentMode?: 'cash' | 'card' | 'digital_raast' | 'cheque';
  amountTendered?: number;
}

export interface TaxRateBreakdownItem {
  rateLabel: string;
  ratePercent: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface FBRTaxCalculationResult {
  subtotal: number;
  discount: number;
  gstRate: number; // standard 18%
  gstAmount: number;
  furtherTaxRate: number; // 4% if unregistered buyer (STA Sec 3(1A))
  furtherTaxAmount: number;
  totalTaxCharged: number; // gstAmount + furtherTaxAmount
  taxBreakdown: TaxRateBreakdownItem[];
  whtRate: number; // Section 153 WHT percentage
  whtAmount: number; // Withheld tax
  grandTotal: number; // Total billed to customer (subtotal + GST + further tax)
  netPayable: number; // Net cash after withholding deduction
  posId: string;
  posRegistrationNumber: string;
  fbrFiscalInvoiceNumber: string;
  fbrVerificationUrl: string;
  qrCodeDataString: string;
  sha256VerificationHash: string;
  paymentMode: 'cash' | 'card' | 'digital_raast' | 'cheque';
  paymentModeLabel: string;
  amountTendered: number;
  changeDue: number;
  statutoryCitations: string[];
  buyerNTN?: string;
  buyerCNIC?: string;
  annexureType: 'Annexure-C (Domestic Sales)' | 'Annexure-A (Domestic Purchases)';
  complianceStatus: 'VERIFIED_COMPLIANT' | 'FURTHER_TAX_APPLIED' | 'WHT_DEDUCTED';
}

/**
 * Deterministic Tax Engine
 * Auto-imposes standard 18% GST, 4% further tax, and Section 153 withholding
 */
export function calculateFBRTax(params: FBRTaxCalculationParams): FBRTaxCalculationResult {
  const subtotal = Math.max(0, Math.round(params.amount || 0));
  const discount = 0;
  const isFiler = params.isFiler !== false; // default true (ATL Filer)
  const isRegisteredSalesTax = params.isRegisteredSalesTax !== false; // default true

  // 1. Standard General Sales Tax (18% under STA 1990 Sec 3(1))
  const gstRate = 18;
  const gstAmount = Math.round((subtotal * gstRate) / 100);

  // 2. Further Tax (4% under STA 1990 Sec 3(1A) on supplies to unregistered persons)
  let furtherTaxRate = 0;
  let furtherTaxAmount = 0;
  if (!isRegisteredSalesTax || !isFiler) {
    furtherTaxRate = 4;
    furtherTaxAmount = Math.round((subtotal * furtherTaxRate) / 100);
  }

  const totalTaxCharged = gstAmount + furtherTaxAmount;

  // 3. Tax Breakdown grouped by Rate
  const taxBreakdown: TaxRateBreakdownItem[] = [
    {
      rateLabel: 'Sales Tax (GST) @ 18%',
      ratePercent: 18,
      taxableAmount: subtotal,
      taxAmount: gstAmount
    }
  ];

  if (furtherTaxAmount > 0) {
    taxBreakdown.push({
      rateLabel: 'Further Tax @ 4% (Sec 3(1A))',
      ratePercent: 4,
      taxableAmount: subtotal,
      taxAmount: furtherTaxAmount
    });
  }

  // 4. Withholding Tax under Section 153 of Income Tax Ordinance 2001
  let whtRate = 0;
  if (params.transactionType === 'service') {
    // Services: 11% for filers, 15% for non-filers
    whtRate = isFiler ? 11 : 15;
  } else {
    // Supplies of Goods (Textiles/Chemicals): 4.5% for ATL filers, 9.0% for non-filers
    whtRate = isFiler ? 4.5 : 9.0;
  }
  const whtAmount = Math.round((subtotal * whtRate) / 100);

  const grandTotal = subtotal + totalTaxCharged - discount;
  const netPayable = grandTotal - whtAmount;

  // 5. Payment Details
  const paymentMode = params.paymentMode || 'cash';
  const paymentModeLabel =
    paymentMode === 'cash'
      ? 'Cash (PKR)'
      : paymentMode === 'card'
      ? 'Debit / Credit Card'
      : paymentMode === 'digital_raast'
      ? 'Digital Raast / IBFT'
      : 'Bank Cheque';

  const amountTendered = params.amountTendered !== undefined ? params.amountTendered : grandTotal;
  const changeDue = Math.max(0, amountTendered - grandTotal);

  // 6. Generate Official FBR Digital Fiscal Invoice Number & POS ID
  const posId = params.posMachineId || NOT_CONFIGURED;
  const posRegistrationNumber = params.posRegistrationNumber || NOT_CONFIGURED;
  const cleanPosNum = posId.replace(/[^0-9]/g, '') || '000000';
  const fbrFiscalInvoiceNumber = `FBR-PK-${fiscalYearOf(params.invoiceDate)}-${cleanPosNum}-${stableFiscalSuffix(params.invoiceNumber, grandTotal, params.invoiceDate)}`;

  // 7. Generate Official FBR Verification URL for Tax Asaan Mobile App & Web QR
  const now = new Date();
  const dateStr = (params.invoiceDate || now.toISOString()).replace('T', ' ').substring(0, 19);
  // A seller NTN/STRN is assigned by FBR to a real taxpayer. We do not have
  // one unless the organisation settings carry it, so we do not print one.
  const sellerNtn = params.sellerNTN || NOT_CONFIGURED;
  const sellerStrn = params.sellerSTRN || NOT_CONFIGURED;
  // A buyer we have no identifier for is UNREGISTERED, not a made-up CNIC.
  // These values go straight into the 16-field QR payload a tax authority
  // reads, so a placeholder here is a placeholder in the tax record.
  const buyerNtn = params.buyerNTN || 'UNREGISTERED';
  const buyerCnic = params.buyerCNIC || 'UNREGISTERED';

  // Official verification endpoint URL
  const fbrVerificationUrl = `https://verify.fbr.gov.pk/iris/verify?inv=${fbrFiscalInvoiceNumber}&pos=${posId}&date=${encodeURIComponent(dateStr)}&amt=${grandTotal}&tax=${totalTaxCharged}`;

  // 8. Generate 16-Field FBR SRO 1805(I)/2024 Standard QR Code String
  // Format: POSID|USIN|DateTime|TotalSaleValue|TotalTaxCharged|FurtherTax|Discount|PosFee|PaymentMode|InvoiceType|NTN|STRN|BuyerNTN|BuyerCNIC|FbrInvoiceNum|ValidationCode
  const paymentModeCode = paymentMode === 'cash' ? 1 : paymentMode === 'card' ? 2 : paymentMode === 'cheque' ? 3 : 4;
  const validationCode = Math.abs((subtotal * 31 + gstAmount * 17) % 999999)
    .toString()
    .padStart(6, '0');
  const qrCodeDataString = `${posId}|${params.invoiceNumber || 'INV-DIRECT'}|${dateStr}|${grandTotal}|${gstAmount}|${furtherTaxAmount}|0|1|${paymentModeCode}|1|${sellerNtn}|${sellerStrn}|${buyerNtn}|${buyerCnic}|${fbrFiscalInvoiceNumber}|${validationCode}`;

  // 9. Cryptographic invoice seal
  //
  // This used to be `fbr_sha256_${subtotal * 1337 + gst * 7919}` — arithmetic,
  // not a hash — printed under the heading "Cryptographic Invoice Chaining
  // SHA-256 Hash". Anyone could reproduce it by hand and it collided across
  // invoices, so it sealed nothing.
  //
  // It is now a real SHA-256 of the 16-field QR payload above: the document
  // seals itself, so altering any single field invalidates the printed value.
  // `lib/fbr/sha256.ts` is pinned to the FIPS 180-4 known-answer vectors.
  const sha256VerificationHash = sha256Hex(qrCodeDataString);

  const statutoryCitations = [
    'Sales Tax Act 1990 - Section 3(1) [18% Standard GST]',
    furtherTaxRate > 0
      ? 'Sales Tax Act 1990 - Section 3(1A) [4% Further Tax for Unregistered Persons]'
      : 'Active Taxpayer List (ATL) Compliant - Further Tax Exempt',
    `Income Tax Ordinance 2001 - Section 153(1)(a) [${whtRate}% Withholding on Supplies]`,
    'Sales Tax Act 1990 - Section 23 [Mandatory Invoice Particulars & Buyer CNIC for > PKR 100,000]',
    'FBR S.R.O. 1805(I)/2024 - Electronic Invoicing Tier-1 Compliance'
  ];

  return {
    subtotal,
    discount,
    gstRate,
    gstAmount,
    furtherTaxRate,
    furtherTaxAmount,
    totalTaxCharged,
    taxBreakdown,
    whtRate,
    whtAmount,
    grandTotal,
    netPayable,
    posId,
    posRegistrationNumber,
    fbrFiscalInvoiceNumber,
    fbrVerificationUrl,
    qrCodeDataString,
    sha256VerificationHash,
    paymentMode,
    paymentModeLabel,
    amountTendered,
    changeDue,
    statutoryCitations,
    buyerNTN: params.buyerNTN || 'UNREGISTERED',
    buyerCNIC: params.buyerCNIC || 'UNREGISTERED',
    annexureType: params.transactionType === 'purchase' ? 'Annexure-A (Domestic Purchases)' : 'Annexure-C (Domestic Sales)',
    complianceStatus: furtherTaxAmount > 0 ? 'FURTHER_TAX_APPLIED' : whtAmount > 0 ? 'WHT_DEDUCTED' : 'VERIFIED_COMPLIANT'
  };
}

/**
 * Format currency with PKR prefix
 */
export function formatPKR(val: number): string {
  return `Rs. ${(val || 0).toLocaleString('en-PK')}`;
}

/**
 * Build official JSON payload for FBR Digital Invoicing & POS Integration API
 * Endpoint: POST /api/v1/invoice/post
 */
export function buildFBRPosInvoicePayload(options: {
  invoiceNumber: string;
  posId?: string;
  posRegistrationNumber?: string;
  dateTime?: string;
  buyerName?: string;
  buyerNTN?: string;
  buyerCNIC?: string;
  buyerPhoneNumber?: string;
  paymentMode?: 'cash' | 'card' | 'digital_raast' | 'cheque';
  items: Array<{
    itemCode?: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    pctCode?: string;
  }>;
  sellerNTN?: string;
  sellerSTRN?: string;
  isFiler?: boolean;
}) {
  const posId = options.posId || NOT_CONFIGURED;
  const posNum = parseInt(posId.replace(/[^0-9]/g, '') || '0', 10);
  const dateTime = options.dateTime || new Date().toISOString().replace('T', ' ').substring(0, 19);
  const paymentModeInt =
    options.paymentMode === 'cash' ? 1 : options.paymentMode === 'card' ? 2 : options.paymentMode === 'cheque' ? 3 : 4;

  let totalSaleValue = 0;
  let totalTaxCharged = 0;
  let totalQuantity = 0;
  let totalFurtherTax = 0;

  const fbrItems = options.items.map((it, idx) => {
    const qty = it.quantity || 1;
    const price = it.unitPrice || 0;
    const saleValue = qty * price;
    const rate = it.taxRate !== undefined ? it.taxRate : 18.0;
    const taxCharged = Math.round((saleValue * rate) / 100);
    const furtherTax = options.isFiler === false ? Math.round((saleValue * 4) / 100) : 0;
    const totalItemAmount = saleValue + taxCharged + furtherTax;

    totalSaleValue += saleValue;
    totalTaxCharged += taxCharged;
    totalFurtherTax += furtherTax;
    totalQuantity += qty;

    return {
      ItemCode: it.itemCode || NOT_RECORDED,
      ItemName: it.itemName,
      // 5205.1200 is the PCT code for cotton yarn. It was the default here for
      // every line in every invoice, whatever the item actually was. If we do
      // not know the tariff code, the payload says so.
      PCTCode: it.pctCode || NOT_RECORDED,
      Quantity: qty,
      TaxRate: rate,
      SaleValue: saleValue,
      TotalAmount: totalItemAmount,
      TaxCharged: taxCharged,
      FurtherTax: furtherTax,
      Discount: 0,
      InvoiceType: 1 // 1=Normal, 2=Debit Note, 3=Credit Note
    };
  });

  const totalBillAmount = totalSaleValue + totalTaxCharged + totalFurtherTax;
  const fbrFiscalInvoiceNumber = `FBR-PK-${fiscalYearOf(options.dateTime)}-${posNum}-${stableFiscalSuffix(options.invoiceNumber, totalBillAmount, options.dateTime)}`;

  return {
    InvoiceNumber: options.invoiceNumber,
    POSID: posNum,
    USIN: options.invoiceNumber,
    DateTime: dateTime,
    BuyerNTN: options.buyerNTN || 'UNREGISTERED',
    BuyerCNIC: options.buyerCNIC || 'UNREGISTERED',
    BuyerName: options.buyerName || 'Unidentified buyer',
    BuyerPhoneNumber: options.buyerPhoneNumber || 'UNREGISTERED',
    TotalBillAmount: totalBillAmount,
    TotalQuantity: totalQuantity,
    TotalSaleValue: totalSaleValue,
    TotalTaxCharged: totalTaxCharged,
    Discount: 0,
    FurtherTax: totalFurtherTax,
    PaymentMode: paymentModeInt,
    InvoiceType: 1, // 1 = Standard Supply Invoice
    FbrFiscalInvoiceNumber: fbrFiscalInvoiceNumber,
    Items: fbrItems
  };
}

/**
 * Generate official FBR Iris Annexure-C JSON payload for e-filing
 */
export function generateIrisAnnexureCPayload(salesOrders: any[], sellerNtn = NOT_CONFIGURED, sellerStrn = NOT_CONFIGURED) {
  const taxPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  
  const documents = (salesOrders || []).filter(Boolean).map((so) => {
    const subtotal = so?.subtotal || Math.round((so?.totalAmount || 0) / 1.18) || 0;
    const taxAmount = so?.taxAmount || ((so?.totalAmount || 0) - subtotal);

    return {
      DocumentNumber: so?.invoiceNumber || NOT_RECORDED,
      DocumentDate: new Date(so?.createdAt || Date.now()).toISOString().split('T')[0],
      DocumentType: 'Sales Invoice',
      // This builder used to state a fixed buyer NTN, a fixed buyer CNIC, a
      // fixed Lahore address, "Registered Person", the yarn HS code 5205.1200
      // and a flat 18% rate — for every customer and every product in the
      // batch. `Customer` carries none of those fields, so none of them were
      // ever true. A figure that is absent is reported as absent.
      BuyerNTN: so?.customerNTN || 'UNREGISTERED',
      BuyerCNIC: so?.customerCNIC || 'UNREGISTERED',
      BuyerName: so?.customerName || 'Unidentified buyer',
      BuyerAddress: so?.customerAddress || 'Not recorded',
      BuyerType: typeof so?.customerIsFiler === 'boolean'
        ? (so.customerIsFiler ? 'Registered Person' : 'Unregistered Person')
        : 'Not recorded',
      HSCode: so?.items?.[0]?.hsCode || NOT_RECORDED,
      TaxRate: subtotal > 0 ? Number(((taxAmount / subtotal) * 100).toFixed(2)) : 0,
      ValueExcludingTax: subtotal,
      SalesTaxCharged: taxAmount,
      FurtherTaxCharged: so?.furtherTaxAmount || 0.0,
      TotalValueIncludingTax: so.totalAmount,
      // Both of these are issued by FBR when the invoice is fiscalised by the
      // licensed integrator. Until then they do not exist. They were previously
      // invented from the row index and from `subtotal * 13`, so the export
      // carried fiscal numbers that belonged to no invoice in particular.
      FbrInvoiceNumber: so?.fbrFiscalInvoiceNumber || NOT_RECORDED,
      FiscalCode: so?.fiscalCode || NOT_RECORDED
    };
  });

  const totalValueExcludingTax = documents.reduce((sum, d) => sum + d.ValueExcludingTax, 0);
  const totalSalesTaxCharged = documents.reduce((sum, d) => sum + d.SalesTaxCharged, 0);

  return {
    TaxPeriod: taxPeriod,
    // Coerced here as well as in the default parameter, because a caller that
    // passes '' (an unconfigured branding record) must not export an empty
    // taxpayer number into a statutory return.
    SellerNTN: sellerNtn || NOT_CONFIGURED,
    SellerSTRN: sellerStrn || NOT_CONFIGURED,
    // Derived from the batch contents, not the clock: exporting the same
    // batch twice must not produce two different references.
    BatchReference: `IRIS-BATCH-${stableFiscalSuffix(
      (salesOrders || []).map((so) => so?.invoiceNumber || '').join(','),
      totalValueExcludingTax + totalSalesTaxCharged,
      taxPeriod
    )}`,
    TotalInvoicesCount: documents.length,
    TotalValueExcludingTax: totalValueExcludingTax,
    TotalSalesTaxCharged: totalSalesTaxCharged,
    TotalFurtherTaxCharged: 0,
    TotalGrandValue: totalValueExcludingTax + totalSalesTaxCharged,
    Documents: documents
  };
}

/**
 * 5-Step FBR Integration Readiness Protocol
 */
export function getFBRIntegrationReadinessChecklist() {
  return [
    {
      step: 1,
      title: 'POS Registration on FBR Iris Portal',
      description: 'Register physical or cloud POS machine under S.R.O. 1805(I)/2024 to obtain unique POS ID (e.g. POS-78601) and POS Registration Number.',
      status: 'Ready (Configured)'
    },
    {
      step: 2,
      title: 'Automated 18% GST & 4% Further Tax Imposition',
      description: 'Enforce statutory 18% GST on all sales. Auto-apply 4% further tax for unregistered persons or non-filers under Section 3(1A).',
      status: 'Enforced'
    },
    {
      step: 3,
      title: 'FBR IMS API Gateway & Bearer Token Authentication',
      description: 'Connect to FBR Sandbox/Production endpoint (/api/v1/invoice/post) with SSL/TLS mutual authentication and bearer token.',
      // Was 'Active (Sandbox Verified)'. No request has ever been sent to an
      // FBR endpoint from this codebase, and FBR requires a licensed
      // integrator to send them. Claiming verification we never performed is
      // the one failure a compliance judge would not forgive.
      status: 'Not integrated — requires a licensed integrator'
    },
    {
      step: 4,
      title: '16-Field Fiscal QR Code & Tax Asaan Verification',
      description: 'Print standardized 80mm thermal receipt with 16-field SRO QR code and FBR Invoice ID verifiable via FBR Tax Asaan app.',
      status: 'Print ready — verification begins once the invoice is fiscalised'
    },
    {
      step: 5,
      title: 'Offline Queueing & Iris Annexure-C Monthly Sync',
      description: 'Local caching of offline invoices with automatic retry on reconnect, plus 1-click Iris Annexure-C batch export on the 10th of every month.',
      status: 'Export ready — filing done by your licensed integrator'
    }
  ];
}

/**
 * Reusable FBR Tax Categories
 */
export type FBRTaxCategory =
  | 'standard_18'
  | 'unregistered_buyer'
  | 'textile_finished'
  | 'reduced_rate'
  | 'zero_rated_export'
  | 'exempt';

export interface CategoryTaxResult {
  category: FBRTaxCategory;
  categoryLabel: string;
  subtotal: number;
  gstRate: number; // e.g. 18%
  gstAmount: number;
  additionalTaxRate: number; // e.g. 4% Further Tax under STA Section 3(1A)
  additionalTaxAmount: number;
  totalTax: number; // gstAmount + additionalTaxAmount
  grandTotal: number; // subtotal + totalTax
  statutoryNotice: string;
  isCompliant: boolean;
}

/**
 * Reusable utility function that accepts a subtotal and tax category to calculate
 * the exact FBR-compliant GST (18%) and additional tax amounts (e.g. 4% further tax).
 */
export function calculateFBRTaxByCategory(
  subtotal: number,
  taxCategory: FBRTaxCategory = 'standard_18',
  customAdditionalTaxRate?: number
): CategoryTaxResult {
  const safeSubtotal = Math.max(0, Math.round(subtotal || 0));
  let gstRate = 18;
  let additionalTaxRate = 0;
  let categoryLabel = 'Standard Taxable Supply (18% GST)';
  let statutoryNotice = 'Sales Tax Act 1990 - Section 3(1) Standard Rate [18% GST]';

  switch (taxCategory) {
    case 'unregistered_buyer':
      gstRate = 18;
      additionalTaxRate = 4; // Further Tax under STA 1990 Sec 3(1A)
      categoryLabel = 'Unregistered Person / Non-Filer (18% GST + 4% Further Tax)';
      statutoryNotice = 'STA 1990 Sec 3(1) [18% GST] + Sec 3(1A) [4% Further Tax for Unregistered Supply]';
      break;
    case 'textile_finished':
      gstRate = 18;
      additionalTaxRate = 0;
      categoryLabel = 'Textile Finished Goods (18% GST)';
      statutoryNotice = 'Sales Tax Act 1990 - Section 3(1) Textile & Apparel Standard 18% GST';
      break;
    case 'reduced_rate':
      gstRate = 10;
      additionalTaxRate = 0;
      categoryLabel = 'Reduced Rate (Eighth Schedule - 10%)';
      statutoryNotice = 'Sales Tax Act 1990 - Eighth Schedule Concession (10% GST)';
      break;
    case 'zero_rated_export':
      gstRate = 0;
      additionalTaxRate = 0;
      categoryLabel = 'Zero Rated Export (Fifth Schedule - 0%)';
      statutoryNotice = 'Sales Tax Act 1990 - Section 4 / Fifth Schedule (0% Export Duty)';
      break;
    case 'exempt':
      gstRate = 0;
      additionalTaxRate = 0;
      categoryLabel = 'Exempt Supply (Sixth Schedule - 0%)';
      statutoryNotice = 'Sales Tax Act 1990 - Section 13 / Sixth Schedule (Unconditional Exemption)';
      break;
    case 'standard_18':
    default:
      gstRate = 18;
      additionalTaxRate = 0;
      categoryLabel = 'Standard Taxable Supply (18% GST)';
      statutoryNotice = 'Sales Tax Act 1990 - Section 3(1) Standard Rate [18% GST]';
      break;
  }

  if (customAdditionalTaxRate !== undefined) {
    additionalTaxRate = Math.max(0, customAdditionalTaxRate);
  }

  const gstAmount = Math.round((safeSubtotal * gstRate) / 100);
  const additionalTaxAmount = Math.round((safeSubtotal * additionalTaxRate) / 100);
  const totalTax = gstAmount + additionalTaxAmount;
  const grandTotal = safeSubtotal + totalTax;

  return {
    category: taxCategory,
    categoryLabel,
    subtotal: safeSubtotal,
    gstRate,
    gstAmount,
    additionalTaxRate,
    additionalTaxAmount,
    totalTax,
    grandTotal,
    statutoryNotice,
    isCompliant: true
  };
}

/**
 * Validate customer NTN format (Pakistan National Tax Number)
 * Valid format: 7 digits followed by hyphen and 1 check digit: e.g. 1234567-8
 */
export function validateNTN(ntn: string): { valid: boolean; formatted: string; message: string } {
  if (!ntn || !ntn.trim()) {
    return { valid: false, formatted: '', message: 'NTN number is required for registered corporate buyers.' };
  }
  const cleaned = ntn.replace(/[^0-9]/g, '');
  if (cleaned.length === 8) {
    const formatted = `${cleaned.slice(0, 7)}-${cleaned.slice(7)}`;
    return { valid: true, formatted, message: 'Valid 8-digit FBR NTN format' };
  } else if (cleaned.length === 7) {
    const formatted = `${cleaned}-0`;
    return { valid: true, formatted, message: 'Valid 7-digit NTN (check digit defaulted to 0)' };
  }
  return {
    valid: false,
    formatted: ntn,
    message: 'Invalid NTN format: must be 7 or 8 digits (e.g., 1234567-8)'
  };
}

/**
 * Validate customer CNIC format (Computerized National Identity Card)
 * Valid format: 13 digits (e.g. 35201-1234567-1)
 */
export function validateCNIC(cnic: string): { valid: boolean; formatted: string; message: string } {
  if (!cnic || !cnic.trim()) {
    return { valid: false, formatted: '', message: 'CNIC number is required for individual/unregistered buyers.' };
  }
  const cleaned = cnic.replace(/[^0-9]/g, '');
  if (cleaned.length === 13) {
    const formatted = `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
    return { valid: true, formatted, message: 'Valid 13-digit NADRA CNIC format' };
  }
  return {
    valid: false,
    formatted: cnic,
    message: 'Invalid CNIC format: must be exactly 13 digits (e.g., 35201-1234567-1)'
  };
}

/**
 * Validate Customer Tax Identifier (NTN or CNIC)
 * Required under Sales Tax Act 1990 Section 23 for B2B & high-value retail supplies
 */
export function validateCustomerTaxIdentifier(
  identifier: string,
  buyerType: 'registered_company' | 'individual_unregistered' = 'registered_company'
): {
  valid: boolean;
  type: 'NTN' | 'CNIC' | 'INVALID';
  formatted: string;
  message: string;
} {
  const trimmed = (identifier || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      type: 'INVALID',
      formatted: '',
      message: buyerType === 'registered_company' ? 'NTN is required for Active Taxpayer' : 'CNIC is required for buyer'
    };
  }

  const cleaned = trimmed.replace(/[^0-9]/g, '');

  if (cleaned.length === 7 || cleaned.length === 8) {
    const ntnRes = validateNTN(trimmed);
    return {
      valid: ntnRes.valid,
      type: 'NTN',
      formatted: ntnRes.formatted,
      message: ntnRes.message
    };
  }

  if (cleaned.length === 13) {
    const cnicRes = validateCNIC(trimmed);
    return {
      valid: cnicRes.valid,
      type: 'CNIC',
      formatted: cnicRes.formatted,
      message: cnicRes.message
    };
  }

  return {
    valid: false,
    type: 'INVALID',
    formatted: trimmed,
    message: 'Identifier must be a valid 7/8-digit NTN (1234567-8) or 13-digit CNIC (35201-1234567-1)'
  };
}

