/**
 * Invoice print model — what a fiscal invoice is allowed to state.
 *
 * This exists because the print modal used to render the same invoice two
 * different ways: the per-line rows came from `data.items` with each item's own
 * `taxRate`, while the totals panel re-ran `calculateFBRTax` over the subtotal.
 * Print out a 1% or exempt line and the table said "18%" beside a 1% amount,
 * because the rate cell was a hardcoded literal. Print out an invoice whose
 * stored `taxAmount` differed from a flat 18% and the totals panel contradicted
 * the ledger it was supposedly copying. A fiscal document that disagrees with
 * itself is the failure this whole layer exists to prevent.
 *
 * The rules below, in order of importance:
 *
 *   1. NEVER invent an identifier. The old code did
 *        buyerCNIC: data?.buyerCNIC || '35201-9876543-1'
 *      and `Customer` has no `ntin` or `cnic` field at all, so that fallback
 *      fired on every single invoice — a fabricated national ID number printed
 *      on an FBR fiscal invoice. `buyerIdentifiers` is now populated only from
 *      values the record actually carries.
 *   2. NEVER state a rate that the record does not carry. `taxRate` and `hsCode`
 *      are `null` when absent, and the caller renders an em dash.
 *   3. NEVER print a WHT figure that was not computed. `SalesOrder` has no
 *      withholding field, so the printed "WHT Sec 153(1)(a) Deduction (4.5%)"
 *      was a constant. Worse, 4.5% is only the ATL rate; a non-ATL supplier is
 *      9% under the same section. `wht` is null unless the invoice states it.
 *   4. Report disagreements rather than picking a winner. If the line items do
 *      not reconcile to the stored totals, both are returned and a warning is
 *      raised for a human to resolve.
 */

export interface InvoicePrintLine {
  index: number;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** Null when the line carries no rate. Never defaulted to a printed number. */
  taxRate: number | null;
  taxableValue: number;
  taxAmount: number;
  lineTotal: number;
  /** Only present when the line actually carries one. */
  hsCode: string | null;
}

export interface InvoicePrintTotals {
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  /** True when these came off the stored invoice rather than being summed. */
  fromLedger: boolean;
  /** Only stated when the record carries a further-tax figure. */
  furtherTaxAmount: number | null;
}

export interface InvoicePrintModel {
  invoiceNumber: string;
  /** ISO date string from the record, or null. */
  issuedOn: string | null;
  customerName: string;
  /** Only identifiers the record actually carries. May legitimately be empty. */
  buyerIdentifiers: string[];
  lines: InvoicePrintLine[];
  totals: InvoicePrintTotals;
  /** Null unless the invoice states a withholding rate. */
  wht: { rate: number; base: number; amount: number } | null;
  /** Gaps a human must close before this document is filed. */
  warnings: string[];
}

/** A rupee, so sub-paisa drift does not register as a discrepancy. */
const RUPEE = 1;

export function roundToRupee(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Collect buyer identifiers that genuinely exist on the record.
 *
 * Any fallback literal here would re-introduce the fabricated-CNIC bug, so an
 * absent field yields an empty list and a warning instead.
 */
function collectBuyerIdentifiers(data: any): { ids: string[]; warned: boolean } {
  const ids: string[] = [];
  const ntn = typeof data?.buyerNTN === 'string' ? data.buyerNTN.trim() : '';
  const cnic = typeof data?.buyerCNIC === 'string' ? data.buyerCNIC.trim() : '';
  const strn = typeof data?.buyerSTRN === 'string' ? data.buyerSTRN.trim() : '';
  if (ntn) ids.push(`NTN ${ntn}`);
  if (cnic) ids.push(`CNIC ${cnic}`);
  if (strn) ids.push(`STRN ${strn}`);
  return { ids, warned: ids.length === 0 };
}

/**
 * Build the printable model for a sales invoice.
 *
 * Pure: no clock, no locale, no currency formatting. Given the same record it
 * returns the same model, which is what makes the assertions below meaningful.
 */
export function buildInvoicePrintModel(data: any): InvoicePrintModel {
  const warnings: string[] = [];

  const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];

  // Pass 1 — read the lines exactly as recorded.
  const lines: InvoicePrintLine[] = rawItems.map((it: any, idx: number) => {
    const quantity = num(it?.quantity) ?? 0;
    const unitPrice = num(it?.unitPrice) ?? 0;
    const taxableValue = roundToRupee(quantity * unitPrice);
    // Prefer the stored tax amount; fall back to rate x value only when the
    // line states a rate. Never assume a rate the line does not carry.
    const statedRate = num(it?.taxRate);
    const statedTax = num(it?.taxAmount);
    const taxAmount = statedTax ?? (statedRate !== null ? roundToRupee((taxableValue * statedRate) / 100) : 0);
    const lineTotal = num(it?.totalAmount) ?? roundToRupee(taxableValue + taxAmount);
    const hs = typeof it?.hsCode === 'string' && it.hsCode.trim() ? it.hsCode.trim() : null;

    if (statedRate === null) warnings.push(`Line ${idx + 1} (${it?.productName || 'unnamed'}) has no tax rate on record.`);

    return {
      index: idx + 1,
      productName: String(it?.productName ?? '').trim() || `Item ${idx + 1}`,
      quantity,
      unit: String(it?.unit ?? '').trim(),
      unitPrice: roundToRupee(unitPrice),
      taxRate: statedRate,
      taxableValue,
      taxAmount: roundToRupee(taxAmount),
      lineTotal: roundToRupee(lineTotal),
      hsCode: hs
    };
  });

  const lineSubtotal = roundToRupee(lines.reduce((s, l) => s + l.taxableValue, 0));
  const lineTax = roundToRupee(lines.reduce((s, l) => s + l.taxAmount, 0));
  const lineTotal = roundToRupee(lines.reduce((s, l) => s + l.lineTotal, 0));

  // Pass 2 — prefer the stored totals, and report any disagreement.
  const ledgerSubtotal = num(data?.subtotal);
  const ledgerTax = num(data?.taxAmount);
  const ledgerTotal = num(data?.totalAmount);
  const fromLedger = ledgerSubtotal !== null && ledgerTax !== null && ledgerTotal !== null;

  const subtotal = fromLedger ? roundToRupee(ledgerSubtotal) : lineSubtotal;
  const taxAmount = fromLedger ? roundToRupee(ledgerTax) : lineTax;
  const grandTotal = fromLedger ? roundToRupee(ledgerTotal) : lineTotal;

  if (fromLedger && rawItems.length > 0) {
    if (Math.abs(ledgerSubtotal - lineSubtotal) > RUPEE) {
      warnings.push(`Line items total Rs. ${lineSubtotal.toLocaleString()} but the invoice header records Rs. ${ledgerSubtotal.toLocaleString()}.`);
    }
    if (Math.abs(ledgerTax - lineTax) > RUPEE) {
      warnings.push(`Line tax totals Rs. ${lineTax.toLocaleString()} but the invoice header records Rs. ${ledgerTax.toLocaleString()}.`);
    }
    if (Math.abs(ledgerTotal - lineTotal) > RUPEE) {
      warnings.push(`Line totals Rs. ${lineTotal.toLocaleString()} but the invoice header records Rs. ${ledgerTotal.toLocaleString()}.`);
    }
    if (Math.abs(roundToRupee(subtotal + taxAmount) - grandTotal) > RUPEE) {
      warnings.push(`Subtotal plus tax is Rs. ${roundToRupee(subtotal + taxAmount).toLocaleString()}, which does not equal the recorded grand total of Rs. ${grandTotal.toLocaleString()}.`);
    }
  }

  if (rawItems.length === 0) {
    warnings.push('This invoice has no line items.');
  }

  const buyer = collectBuyerIdentifiers(data);
  if (buyer.warned) {
    warnings.push('No buyer NTN, CNIC or STRN is recorded. An FBR fiscal invoice cannot be validated without it.');
  }

  // WHT is stated only when the record states it. `SalesOrder` carries no
  // withholding field, so in practice this stays null and the printed invoice
  // simply has no withholding line — which is correct, because the buyer
  // deducts it; the seller does not print it as a charge.
  const whtRate = num(data?.whtRate);
  const wht = whtRate !== null
    ? {
      rate: whtRate,
      base: roundToRupee(subtotal),
      amount: num(data?.whtAmount) ?? roundToRupee((subtotal * whtRate) / 100)
    }
    : null;

  return {
    invoiceNumber: String(data?.invoiceNumber ?? '').trim() || 'UNNUMBERED',
    issuedOn: typeof data?.createdAt === 'string' && data.createdAt ? data.createdAt : null,
    customerName: String(data?.customerName ?? '').trim() || 'Unnamed buyer',
    buyerIdentifiers: buyer.ids,
    lines,
    totals: {
      subtotal,
      taxAmount,
      grandTotal,
      fromLedger,
      furtherTaxAmount: num(data?.furtherTaxAmount)
    },
    wht,
    warnings
  };
}