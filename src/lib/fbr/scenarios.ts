/**
 * FBR Digital Invoicing sandbox scenarios — Task 6, Phase 2.
 *
 * A STAGE MAP OF WHAT THIS IS NOT
 *   We do not file with FBR. FBR requires a licensed integrator to transmit,
 *   and this application is not one. What these scenarios buy us is the ability
 *   to emit the payload their integrator forwards untouched, with the
 *   arithmetic already correct.
 *
 * WHY THE STRINGS LOOK WRONG
 *   Several of FBR's own enum values contain typos. They are reproduced here
 *   byte-for-byte and MUST NOT be "corrected":
 *
 *     SN024  `Goods as per SRO.297(|)/2023`   <- pipe, not a capital I
 *     SN021  `Cement /Concrete Block`         <- space before the slash
 *     SN005  extraTax is the EMPTY STRING      <- not "0"
 *     SN006  rate is the string "Exempt"       <- not 0
 *
 *   A tidied string is a rejected payload. `payload.test.ts` pins each of
 *   these so a well-meaning cleanup fails the build instead of the filing.
 *
 * SCOPE NOTE: the sample figures below are FBR's published sandbox examples for
 * the scenarios where the track documents gave them, and round self-consistent
 * placeholders elsewhere. They exercise the arithmetic; they are not evidence
 * of FBR's published values, and the scenario ids and sale-type strings must be
 * confirmed against FBR's live sandbox before anyone relies on them in a real
 * filing. See `published` below.
 */

export interface FbrScenario {
  id: string;
  /** FBR's enum string, verbatim including any typo. */
  saleType: string;
  /** FBR's rate enum as a string. "Exempt" is a string, never 0. */
  rate: string;
  /** extraTax is a string: '' for scenarios that have none, never 0. */
  extraTax: string;
  buyerRegistrationType: string;
  /**
   * Whether FBR has published a template for this. SN009 is false — that
   * absence is the project's wedge, not an oversight in this file.
   */
  published: boolean;
  /**
   * WHAT THIS SCENARIO'S TAX IS COMPUTED ON. Added for the reconciler: the
   * single most common integration failure is taxing valueSalesExcludingST
   * when FBR taxes the notified value or retail price instead, and that
   * mistake is invisible unless the scenario declares which base is correct.
   * 'none' means the scenario carries no sales tax at all (SN006).
   */
  taxBase: 'transactionValue' | 'notifiedValueOrRetailPrice' | 'none';

  /** How this scenario is taxed, used by the reconciler and by the UI copy. */
  notes: string;

  // Round self-consistent figures for the conformance sweep.
  sampleValueSalesExcludingST: number;
  sampleSalesTaxApplicable: number;
  sampleFurtherTax: number;
}

export const FBR_SCENARIOS: FbrScenario[] = [
  {
    id: 'SN001',
    saleType: 'Goods at standard rate (default)',
    rate: '18%',
    extraTax: '',
    buyerRegistrationType: 'Registered',
    published: true,
    taxBase: 'transactionValue',
    notes: 'The foundation case. Standard rate, ATL-registered buyer.',
    sampleValueSalesExcludingST: 500,
    sampleSalesTaxApplicable: 90,
    sampleFurtherTax: 0
  },
  {
    id: 'SN002',
    saleType: 'Goods at standard rate (default)',
    rate: '18%',
    extraTax: '2%',
    buyerRegistrationType: 'Unregistered',
    published: true,
    taxBase: 'transactionValue',
    notes: 'The common SME case. Further tax applies on top of sales tax.',
    sampleValueSalesExcludingST: 500,
    sampleSalesTaxApplicable: 90,
    sampleFurtherTax: 10
  },
  {
    id: 'SN005',
    saleType: 'Reduced rate',
    rate: '5%',
    extraTax: '',
    buyerRegistrationType: 'Registered',
    published: true,
    taxBase: 'transactionValue',
    notes: 'extraTax is the EMPTY STRING for this scenario, not "0".',
    sampleValueSalesExcludingST: 500,
    sampleSalesTaxApplicable: 25,
    sampleFurtherTax: 0
  },
  {
    id: 'SN006',
    saleType: 'Exempt',
    rate: 'Exempt',
    extraTax: '',
    buyerRegistrationType: 'Registered',
    published: true,
    taxBase: 'none',
    notes: 'rate is the STRING "Exempt". Coercing it to 0 fails validation.',
    sampleValueSalesExcludingST: 500,
    sampleSalesTaxApplicable: 0,
    sampleFurtherTax: 0
  },
  {
    id: 'SN008',
    saleType: 'Goods as per Third Schedule',
    rate: '18%',
    extraTax: '',
    buyerRegistrationType: 'Registered',
    published: true,
    taxBase: 'notifiedValueOrRetailPrice',
    notes:
      'Third Schedule: tax is computed on the notified value or retail price, ' +
      'NOT on the transaction value. The most common integration failure — ' +
      'FBR sample taxes 2000 of retail value, not 1000 of transaction value.',
    sampleValueSalesExcludingST: 1000,
    sampleSalesTaxApplicable: 360,
    sampleFurtherTax: 0
  },
  {
    id: 'SN009',
    saleType: 'Cotton spinners (buying from cotton ginners)',
    rate: '18%',
    extraTax: '',
    buyerRegistrationType: 'Registered',
    published: false,
    taxBase: 'transactionValue',
    notes:
      'FBR has published no template for this scenario. We represent it ' +
      'explicitly so the gap is visible rather than silently missing, and so ' +
      'nothing downstream invents a rate for it.',
    sampleValueSalesExcludingST: 500,
    sampleSalesTaxApplicable: 90,
    sampleFurtherTax: 0
  },
  {
    id: 'SN021',
    saleType: 'Cement /Concrete Block',
    rate: '18%',
    extraTax: '',
    buyerRegistrationType: 'Registered',
    published: true,
    taxBase: 'transactionValue',
    notes: "FBR's enum has a space before the slash. Verbatim.",
    sampleValueSalesExcludingST: 500,
    sampleSalesTaxApplicable: 90,
    sampleFurtherTax: 0
  },
  {
    id: 'SN024',
    saleType: 'Goods as per SRO.297(|)/2023',
    rate: '1%',
    extraTax: '',
    buyerRegistrationType: 'Registered',
    published: true,
    taxBase: 'transactionValue',
    notes: "FBR's enum contains a PIPE where a capital I was likely intended. Verbatim.",
    sampleValueSalesExcludingST: 500,
    sampleSalesTaxApplicable: 5,
    sampleFurtherTax: 0
  }
];

const BY_ID = new Map(FBR_SCENARIOS.map(s => [s.id, s]));

export function getScenario(id: string): FbrScenario | undefined {
  return BY_ID.get(id);
}

/** Scenarios FBR actually publishes a template for. SN009 is excluded. */
export const PUBLISHED_SCENARIOS = FBR_SCENARIOS.filter(s => s.published);