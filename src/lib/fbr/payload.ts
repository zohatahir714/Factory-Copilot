/**
 * FBR Digital Invoicing payload builder — Task 6, Phase 2.
 *
 * A STAGE MAP OF WHAT THIS IS NOT
 *   We do not file with FBR. FBR requires a licensed integrator to transmit and
 *   this application is not one. Every payload this module emits carries
 *   `transmissionNote` so it cannot be mistaken for a filing. What we produce
 *   is the document a licensed integrator forwards untouched.
 *
 * THREE RULES THIS MODULE DOES NOT BREAK
 *
 *  1. NEVER INVENT. An absent NTN, buyer name, rate or tax base stays absent.
 *     `''` and `null` are honest; a plausible fabrication is a rejected
 *     filing. This mirrors `print/invoicePrintModel.ts` — same reasoning.
 *
 *  2. NEVER COERCE AN ENUM TO A NUMBER. `rate` is a string, always. "Exempt"
 *     is the string "Exempt". `extraTax` is a string, and for scenarios with
 *     none it is the EMPTY STRING, never 0. Both are pinned by the test suite.
 *
 *  3. NEVER SILENTLY RECONCILE. If the arithmetic disagrees with the scenario
 *     (wrong tax base, tax on an exempt sale, further tax that does not match
 *     the stated extraTax), we add a warning and ship the figures as given.
 *     Picking a winner here would hide the error from the person who has to
 *     file. Where the scenario declares a tax base we cannot verify — FBR has
 *     no published template, as with SN009 — the payload says so out loud.
 *
 * DETERMINISM: no clock, no randomness, no I/O. The same input always yields a
 * byte-identical payload, so a payload can be diffed across submissions.
 */
import { getScenario } from './scenarios';

export const TRANSMISSION_NOTE = 'Schema-valid payload for your licensed integrator';

export interface BuildDiPayloadInput {
  scenarioId: string;

  // The three money fields FBR reconciles on every submission.
  valueSalesExcludingST: number;
  salesTaxApplicable: number;
  furtherTax?: number;

  /**
   * Third Schedule scenarios (SN008) tax this figure rather than
   * valueSalesExcludingST. Omit it and we warn rather than guess a base.
   */
  notifiedValueOrRetailPrice?: number;

  // Header identity. All optional; absent values stay '' (rule 1).
  invoiceType?: string;
  documentNumber?: string;
  documentDate?: string;
  sellerNTN?: string;
  sellerSTRN?: string;
  buyerName?: string;
  buyerNTN?: string;
  buyerAddress?: string;
  buyerEmail?: string;
  /** Defaults to the scenario's own registration type. */
  buyerRegistrationType?: string;
}

export interface DiPayload {
  scenarioId: string;
  invoiceType: string;
  documentNumber: string;
  documentDate: string;

  sellerNTN: string;
  sellerSTRN: string;
  buyerName: string;
  buyerNTN: string;
  buyerAddress: string;
  buyerEmail: string;
  buyerRegistrationType: string;

  saleType: string;
  valueSalesExcludingST: number;
  valueSalesIncludingST: number;
  salesTaxApplicable: number;
  furtherTax: number;
  totalValues: number;

  /** String, always. "Exempt" stays "Exempt". */
  rate: string;
  /** String, always. '' for scenarios that declare no extra tax, never 0. */
  extraTax: string;
  /** Present only when the scenario taxes something other than the value. */
  notifiedValueOrRetailPrice: number | null;

  /** The tax base this scenario's figures imply, derived not assumed. */
  impliedTaxBase: number | null;
  /** False where FBR has published no template — the project's known gap. */
  scenarioPublished: boolean;
  /** Every discrepancy found, in the order found. Empty when the figures hold. */
  integratorWarnings: string[];
  transmissionNote: typeof TRANSMISSION_NOTE;
}

/** Two decimals, half-up. Kills float artefacts like 0.30000000000000004. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function requireAmount(label: string, value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `FBR payload: ${label} must be a finite number, received ${String(value)}.`
    );
  }
  if (value < 0) {
    throw new Error(
      `FBR payload: ${label} is negative (${value}). Refusing to emit a negative amount.`
    );
  }
  return round2(value);
}

/** '18%' -> 18. 'Exempt' -> null. Enum strings are never coerced to numbers. */
function ratePercent(rate: string): number | null {
  const match = /^(\d+(?:\.\d+)?)%$/.exec(rate.trim());
  return match ? Number(match[1]) : null;
}

export function buildDiPayload(input: BuildDiPayloadInput): DiPayload {
  const { scenarioId } = input;
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    // Rule 1 in its strongest form: an unknown scenario must not be guessed at.
    throw new Error(
      `Unknown FBR scenario "${scenarioId}". No sale type, rate or registration ` +
        `type is invented for an unknown scenario. Use a scenario id from ` +
        `FBR_SCENARIOS.`
    );
  }

  const valueSalesExcludingST = requireAmount('valueSalesExcludingST', input.valueSalesExcludingST);
  const salesTaxApplicable = requireAmount('salesTaxApplicable', input.salesTaxApplicable);
  const furtherTax = requireAmount('furtherTax', input.furtherTax ?? 0);
  const notifiedValueOrRetailPrice =
    input.notifiedValueOrRetailPrice === undefined
      ? null
      : requireAmount('notifiedValueOrRetailPrice', input.notifiedValueOrRetailPrice);

  // The identity FBR's sandbox checks on every single submission.
  const valueSalesIncludingST = round2(valueSalesExcludingST + salesTaxApplicable);
  const totalValues = round2(valueSalesExcludingST + salesTaxApplicable + furtherTax);

  const warnings: string[] = [];

  if (!scenario.published) {
    warnings.push(
      `FBR has published no template for ${scenario.id} (${scenario.saleType}). ` +
        `These figures are illustrative and must be confirmed with your licensed ` +
        `integrator before filing.`
    );
  }

  // --- Tax base reconciliation. Report, never correct. ---------------------
  const percent = ratePercent(scenario.rate);
  let impliedTaxBase: number | null = null;

  if (percent === null) {
    if (salesTaxApplicable > 0) {
      warnings.push(
        `rate is "${scenario.rate}" but salesTaxApplicable is ${salesTaxApplicable}. ` +
          `This scenario carries no sales tax; confirm the rate before filing.`
      );
    }
  } else if (percent === 0) {
    // Defensive: a "0%" rate with tax on it would divide by zero below.
    if (salesTaxApplicable > 0) {
      warnings.push(
        `rate is "0%" but salesTaxApplicable is ${salesTaxApplicable}. Confirm the rate.`
      );
    }
  } else {
    impliedTaxBase = round2((salesTaxApplicable * 100) / percent);
    const onTransactionValue = round2((valueSalesExcludingST * percent) / 100);

    if (scenario.taxBase === 'notifiedValueOrRetailPrice') {
      if (notifiedValueOrRetailPrice === null) {
        warnings.push(
          `${scenario.id} taxes the notified value or retail price, not the ` +
            `transaction value, but notifiedValueOrRetailPrice was not supplied. ` +
            `The tax base is unverified.`
        );
      }
      if (onTransactionValue === salesTaxApplicable) {
        warnings.push(
          `salesTaxApplicable (${salesTaxApplicable}) is exactly ${scenario.rate} of ` +
            `valueSalesExcludingST (${valueSalesExcludingST}), so the tax base is ` +
            `the transaction value. ${scenario.id} taxes the notified value or retail ` +
            `price instead. Confirm the base before filing.`
        );
      } else if (notifiedValueOrRetailPrice !== null) {
        const expected = round2((notifiedValueOrRetailPrice * percent) / 100);
        if (expected !== salesTaxApplicable) {
          warnings.push(
            `salesTaxApplicable (${salesTaxApplicable}) is not ${scenario.rate} of the ` +
              `supplied notifiedValueOrRetailPrice (${notifiedValueOrRetailPrice}); ` +
              `that would be ${expected}. The figures are shipped as given.`
          );
        }
      }
    } else if (scenario.taxBase === 'transactionValue' && onTransactionValue !== salesTaxApplicable) {
      warnings.push(
        `salesTaxApplicable (${salesTaxApplicable}) is not ${scenario.rate} of ` +
          `valueSalesExcludingST (${valueSalesExcludingST}); that would be ` +
          `${onTransactionValue}. The figures imply a tax base of ${impliedTaxBase}.`
      );
    }
  }

  // --- furtherTax vs the declared extraTax percentage. ----------------------
  const extraPercent = ratePercent(scenario.extraTax);
  if (extraPercent !== null && extraPercent > 0) {
    const expectedFurther = round2((valueSalesExcludingST * extraPercent) / 100);
    if (expectedFurther !== furtherTax) {
      warnings.push(
        `furtherTax (${furtherTax}) is not ${scenario.extraTax} of ` +
          `valueSalesExcludingST (${valueSalesExcludingST}); that would be ` +
          `${expectedFurther}. The figures are shipped as given.`
      );
    }
  }

  // --- Missing identity is reported, never fabricated. ----------------------
  const documentNumber = input.documentNumber ?? '';
  const documentDate = input.documentDate ?? '';
  const sellerNTN = input.sellerNTN ?? '';
  const sellerSTRN = input.sellerSTRN ?? '';
  const buyerName = input.buyerName ?? '';
  const buyerNTN = input.buyerNTN ?? '';
  const buyerAddress = input.buyerAddress ?? '';
  const buyerEmail = input.buyerEmail ?? '';
  const buyerRegistrationType = input.buyerRegistrationType ?? scenario.buyerRegistrationType;

  if (!documentNumber) warnings.push('documentNumber was not supplied; your integrator will need one.');
  if (!documentDate) warnings.push('documentDate was not supplied; FBR requires the document date.');
  if (!sellerNTN) warnings.push('sellerNTN was not supplied; it is never inferred from the organisation.');
  if (!sellerSTRN) warnings.push('sellerSTRN was not supplied; the STRN identifies the registered seller.');
  if (!buyerName) warnings.push('buyerName was not supplied.');
  if (!buyerNTN && buyerRegistrationType === 'Registered') {
    warnings.push(
      'Buyer is marked Registered but buyerNTN is empty. Confirm the buyer is an ' +
        'Active Taxpayer before filing.'
    );
  }

  return {
    scenarioId: scenario.id,
    invoiceType: input.invoiceType ?? 'Sales Invoice',
    documentNumber,
    documentDate,
    sellerNTN,
    sellerSTRN,
    buyerName,
    buyerNTN,
    buyerAddress,
    buyerEmail,
    buyerRegistrationType,
    saleType: scenario.saleType,
    valueSalesExcludingST,
    valueSalesIncludingST,
    salesTaxApplicable,
    furtherTax,
    totalValues,
    rate: scenario.rate,
    extraTax: scenario.extraTax,
    notifiedValueOrRetailPrice,
    impliedTaxBase,
    scenarioPublished: scenario.published,
    integratorWarnings: warnings,
    transmissionNote: TRANSMISSION_NOTE
  };
}

/**
 * One-line description for the UI. Deliberately says "payload" and never
 * "filed", "submitted" or "reported to FBR".
 */
export function describePayload(payload: DiPayload): string {
  const clean = payload.integratorWarnings.length === 0;
  return clean
    ? `${payload.scenarioId} — ${payload.saleType}: ${payload.totalValues} total, figures reconcile.`
    : `${payload.scenarioId} — ${payload.saleType}: ${payload.totalValues} total, ${payload.integratorWarnings.length} item(s) to confirm before filing.`;
}