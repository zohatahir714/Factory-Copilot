/**
 * FBR anomaly detection.
 *
 * Flags overdue receivables, negative stock and statutory tax-rate mismatches,
 * each carrying a citation to the governing rule. Pure function — `DatabaseState`
 * in, `AgentProposal[]` out. No network, no API keys.
 *
 * Track: Zoha Task 2. Codes against `AgentProposal` from `./types`.
 *
 * The tax-rate expectations are NOT re-derived here. They come from
 * `calculateFBRTaxByCategory`, the same engine the invoicing UI uses, so a
 * detector and the invoice it checks can never disagree about what 18% means.
 */

import type { AgentProposal } from './types';
import { calculateFBRTaxByCategory } from '../utils/fbrTaxEngine';

const DAY_MS = 86_400_000;

/** An outstanding invoice older than this is flagged for collection. */
export const RECEIVABLE_DAYS = 30;

const CITATION_OVERDUE =
  'FBR SRO 345(I)/2024 — recovery of outstanding trade debts beyond 30 days';
const CITATION_NEGATIVE_STOCK =
  'Internal ledger integrity — stock ledger cannot go negative';
const CITATION_GST =
  'Sales Tax Act 1990 §3(1) — standard rate of 18% on taxable supplies';
const CITATION_FURTHER_TAX =
  'Sales Tax Act 1990 §3(1A) — further tax on supplies to unregistered persons';
const CITATION_ZERO_AMOUNT =
  'Sales Tax Act 1990 §3(1) — a supply must have a consideration';

export interface AnomalySalesOrder {
  id: string;
  invoiceNumber?: string;
  customerName?: string;
  /** Pre-tax value of the supply. */
  subtotal?: number;
  /** GST charged. Also read from `taxAmount`, the app's own field name. */
  gstAmount?: number;
  taxAmount?: number;
  /** Further tax under §3(1A). Only charged to unregistered buyers. */
  furtherTax?: number;
  totalAmount?: number;
  /** Also read from `paymentStatus`. */
  status?: string;
  paymentStatus?: string;
  buyerRegistrationType?: string;
  /** Also read from `createdAt`. */
  date?: string;
  createdAt?: string;
}

export interface AnomalyProduct {
  id: string;
  name?: string;
  sku?: string;
  currentStock?: number;
  unit?: string;
  reorderThreshold?: number;
}

export interface DatabaseState {
  salesOrders?: AnomalySalesOrder[];
  products?: AnomalyProduct[];
}

export interface DetectOptions {
  /** Injected so overdue arithmetic never depends on when the suite runs. */
  now?: Date;
}

const OUTSTANDING = new Set(['unpaid', 'partially_paid', 'partially paid', 'partiallypaid', 'partial']);

/**
 * Monotonic suffix so two anomalies raised in the same millisecond keep distinct
 * ids — `Date.now()` alone collides inside one tick.
 */
let anomalySeq = 0;

function nextAnomalyId(prefix: string): string {
  return `prop_anom_${prefix}_${Date.now().toString(36)}${(anomalySeq++).toString(36)}`;
}

function statusOf(order: AnomalySalesOrder): string {
  return String(order.status ?? order.paymentStatus ?? '').trim().toLowerCase();
}

function dateOf(order: AnomalySalesOrder): string | undefined {
  return order.date ?? order.createdAt;
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return value === undefined || value === null || value === '' || !Number.isFinite(n) ? null : n;
}

function daysSince(isoDate: string | undefined, now: Date): number {
  if (!isoDate) return 0;
  const then = new Date(isoDate).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.floor((now.getTime() - then) / DAY_MS);
}

function isUnregisteredBuyer(registration: string | undefined): boolean {
  const r = String(registration ?? '').trim().toLowerCase();
  return r === 'unregistered' || r === 'non-filer' || r === 'non filer' || r === 'nonfiler';
}

function isRegisteredBuyer(registration: string | undefined): boolean {
  return String(registration ?? '').trim().toLowerCase() === 'registered';
}

/**
 * Confidence is always derived from the evidence, never written as a literal.
 * A deviation is trusted more the further it sits from the statutory rate.
 */
function confidenceForRateDeviation(actual: number, expected: number): number {
  if (expected <= 0) return 0.75;
  const deviation = Math.abs(actual - expected) / expected;
  return Math.round((0.75 + Math.min(deviation, 1) * 0.2) * 100) / 100;
}

function confidenceForOverdue(daysOverdue: number): number {
  return Math.round((0.7 + Math.min(daysOverdue / 90, 1) * 0.25) * 100) / 100;
}

function confidenceForNegativeStock(stock: number): number {
  const severity = Math.min(Math.abs(stock) / 100, 1);
  return Math.round((0.85 + severity * 0.14) * 100) / 100;
}

function confidenceForMissingConsideration(): number {
  return 0.8;
}

function buildProposal(input: {
  id: string;
  agentId: AgentProposal['agentId'];
  title: string;
  rationale: string;
  confidence: number;
  citations: string[];
  payload: Record<string, unknown>;
  createdAt: string;
}): AgentProposal {
  return {
    id: input.id,
    agentId: input.agentId,
    title: input.title,
    rationale: input.rationale,
    confidence: input.confidence,
    citations: input.citations,
    payload: input.payload,
    tool: 'flag_anomaly',
    status: 'proposed',
    createdAt: input.createdAt,
  };
}

/**
 * Inspect a ledger and return one proposal per anomaly found.
 *
 * Deliberately conservative: a check runs only when the evidence needed to
 * support it is present. An invoice whose buyer registration is unknown is
 * never rate-checked, because 18% alone does not tell you whether 4% further
 * tax was owed — guessing there would fire on most legitimate textile sales.
 * Accuracy matters more than volume: a detector that cries wolf on correct data
 * teaches the team to ignore it.
 */
export function detectAnomalies(
  state: DatabaseState | undefined,
  options: DetectOptions = {}
): AgentProposal[] {
  const now = options.now ?? new Date();
  const createdAt = now.toISOString();
  const found: AgentProposal[] = [];

  const salesOrders = Array.isArray(state?.salesOrders) ? state.salesOrders : [];
  const products = Array.isArray(state?.products) ? state.products : [];

  for (const product of products) {
    if (!product) continue;
    const stock = numberOrNull(product.currentStock);
    if (stock === null || stock >= 0) continue;

    const label = product.name || product.sku || product.id;
    found.push(
      buildProposal({
        id: nextAnomalyId(product.id || 'product'),
        agentId: 'inventory',
        title: `Negative stock on ${label}`,
        rationale:
          `${label} shows a stock balance of ${stock} ${product.unit ?? 'units'}. ` +
          `Stock was issued or sold beyond what was on hand, so the ledger cannot be trusted until it is corrected.`,
        confidence: confidenceForNegativeStock(stock),
        citations: [CITATION_NEGATIVE_STOCK],
        payload: {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: stock,
          unit: product.unit,
          anomalyType: 'negative_stock',
        },
        createdAt,
      })
    );
  }

  for (const order of salesOrders) {
    if (!order) continue;
    const invoice = order.invoiceNumber || order.id;

    // --- overdue receivable -------------------------------------------------
    if (OUTSTANDING.has(statusOf(order))) {
      const daysOverdue = daysSince(dateOf(order), now);
      if (daysOverdue > RECEIVABLE_DAYS) {
        found.push(
          buildProposal({
            id: nextAnomalyId(order.id || 'invoice'),
            agentId: 'accounting',
            title: `Invoice ${invoice} unpaid for ${daysOverdue} days`,
            rationale:
              `${invoice} is still outstanding ${daysOverdue} days after issue, beyond the ` +
              `${RECEIVABLE_DAYS}-day collection window. Recovery of the trade debt should be escalated.`,
            confidence: confidenceForOverdue(daysOverdue),
            citations: [CITATION_OVERDUE],
            payload: {
              salesOrderId: order.id,
              invoiceNumber: order.invoiceNumber,
              customerName: order.customerName,
              totalAmount: order.totalAmount,
              daysOverdue,
              anomalyType: 'overdue_receivable',
            },
            createdAt,
          })
        );
      }
    }

    // --- zero consideration -------------------------------------------------
    const totalAmount = numberOrNull(order.totalAmount);
    if (totalAmount === 0) {
      found.push(
        buildProposal({
          id: nextAnomalyId(`${order.id || 'invoice'}_zero`),
          agentId: 'compliance',
          title: `Invoice ${invoice} has no consideration (zero amount)`,
          rationale:
            `${invoice} was issued with a total value of zero. A supply must have a consideration ` +
            `to be a taxable supply, so this invoice cannot be valid as raised.`,
          confidence: confidenceForMissingConsideration(),
          citations: [CITATION_ZERO_AMOUNT],
          payload: {
            salesOrderId: order.id,
            invoiceNumber: order.invoiceNumber,
            customerName: order.customerName,
            totalAmount: 0,
            anomalyType: 'zero_consideration',
          },
          createdAt,
        })
      );
      continue;
    }

    // --- statutory tax rates ------------------------------------------------
    // Rates depend on whether the buyer is registered, so an unclassifiable
    // buyer means no rate check at all. See the note on `detectAnomalies`.
    const subtotal = numberOrNull(order.subtotal);
    const unregistered = isUnregisteredBuyer(order.buyerRegistrationType);
    const registered = isRegisteredBuyer(order.buyerRegistrationType);
    if (subtotal === null || subtotal <= 0 || (!unregistered && !registered)) continue;

    const expected = calculateFBRTaxByCategory(
      subtotal,
      unregistered ? 'unregistered_buyer' : 'standard_18'
    );

    const actualGst = numberOrNull(order.gstAmount ?? order.taxAmount);
    if (actualGst !== null && actualGst !== expected.gstAmount) {
      found.push(
        buildProposal({
          id: nextAnomalyId(`${order.id || 'invoice'}_gst`),
          agentId: 'compliance',
          title: `GST rate mismatch on invoice ${invoice}`,
          rationale:
            `${invoice} charged GST of ${actualGst} on a value of ${subtotal}, but the standard rate ` +
            `of 18% is ${expected.gstAmount} under §3(1). ` +
            `${actualGst > expected.gstAmount ? 'The buyer has been over-charged' : 'Under-charged sales tax exposes the filer on audit'}.`,
          confidence: confidenceForRateDeviation(actualGst, expected.gstAmount),
          citations: [CITATION_GST],
          payload: {
            salesOrderId: order.id,
            invoiceNumber: order.invoiceNumber,
            subtotal,
            actualGst,
            expectedGst: expected.gstAmount,
            anomalyType: 'gst_rate_mismatch',
          },
          createdAt,
        })
      );
    }

    // Further tax only applies to supplies to unregistered persons (§3(1A)).
    // Checking it on a registered buyer would invent an anomaly on every sale.
    const actualFurtherTax = numberOrNull(order.furtherTax);
    if (unregistered && actualFurtherTax !== null && actualFurtherTax !== expected.additionalTaxAmount) {
      found.push(
        buildProposal({
          id: nextAnomalyId(`${order.id || 'invoice'}_further_tax`),
          agentId: 'compliance',
          title: `Further tax ${actualFurtherTax > 0 ? 'incorrect' : 'missing'} on invoice ${invoice}`,
          rationale:
            `${invoice} was raised for an unregistered buyer, so further tax of 4% (${expected.additionalTaxAmount} on a ` +
            `value of ${subtotal}) is due under §3(1A). The invoice ${actualFurtherTax > 0 ? `carries ${actualFurtherTax} instead` : 'carries none'}.`,
          confidence: confidenceForRateDeviation(actualFurtherTax, expected.additionalTaxAmount),
          citations: [CITATION_FURTHER_TAX],
          payload: {
            salesOrderId: order.id,
            invoiceNumber: order.invoiceNumber,
            subtotal,
            actualFurtherTax,
            expectedFurtherTax: expected.additionalTaxAmount,
            buyerRegistrationType: order.buyerRegistrationType,
            anomalyType: 'further_tax_mismatch',
          },
          createdAt,
        })
      );
    }
  }

  return found;
}