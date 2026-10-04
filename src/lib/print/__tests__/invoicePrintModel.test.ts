/**
 * Invoice print model — regression guards.
 *
 * Each test corresponds to a specific thing the printed invoice got wrong.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `reorder.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildInvoicePrintModel } from '../invoicePrintModel';

/**
 * Shaped like a real `SalesOrder` from the ledger. Note what is NOT here:
 * no buyerNTN, no buyerCNIC, no hsCode, no whtRate. `Customer` carries none of
 * those, which is precisely why the old modal printed an invented CNIC on
 * every single invoice.
 */
const invoice = {
  invoiceNumber: 'INV-DEMO-1001',
  customerId: 'c1',
  customerName: 'Faisalabad Powerlooms',
  subtotal: 435000,
  taxAmount: 78300,
  totalAmount: 513300,
  paymentStatus: 'unpaid',
  createdAt: '2026-09-01T09:30:00.000Z',
  items: [
    { productName: 'Cotton Yarn 150D', quantity: 300, unit: 'kg', unitPrice: 1450, taxRate: 18, taxAmount: 78300, totalAmount: 513300 }
  ]
};

describe('buyer identifiers are never invented', () => {
  it('emits NO identifier when the record carries none', () => {
    const m = buildInvoicePrintModel(invoice);
    assert.deepStrictEqual(m.buyerIdentifiers, []);
  });

  it('warns that the invoice is unvalidatable without a buyer identifier', () => {
    const m = buildInvoicePrintModel(invoice);
    assert.ok(
      m.warnings.some(w => /NTN|CNIC|STRN/.test(w)),
      'a missing buyer identifier must be surfaced, not silently defaulted'
    );
  });

  it('never emits a made-up CNIC on a record with none', () => {
    const serialised = JSON.stringify(buildInvoicePrintModel(invoice));
    assert.doesNotMatch(serialised, /35201-/, 'fabricated CNIC pattern must not reappear');
    assert.doesNotMatch(serialised, /1928471/, 'fabricated NTN must not reappear');
  });

  it('uses the identifiers when the record genuinely carries them', () => {
    const m = buildInvoicePrintModel({ ...invoice, buyerNTN: '4029184-7', buyerCNIC: '35201-9998887-5' });
    assert.deepStrictEqual(m.buyerIdentifiers, ['NTN 4029184-7', 'CNIC 35201-9998887-5']);
  });
});

describe('tax rates come from the line, not from a literal', () => {
  it('reports the rate the line actually states', () => {
    const m = buildInvoicePrintModel({
      ...invoice,
      items: [{ productName: 'Reduced Rategoods', quantity: 1, unit: 'kg', unitPrice: 1000, taxRate: 1, taxAmount: 10, totalAmount: 1010 }]
    });
    assert.strictEqual(m.lines[0].taxRate, 1);
    assert.notStrictEqual(m.lines[0].taxRate, 18);
  });

  it('returns null — never 18 — when the line states no rate', () => {
    const m = buildInvoicePrintModel({
      ...invoice,
      items: [{ productName: 'Unrated goods', quantity: 1, unit: 'kg', unitPrice: 1000, taxAmount: 0, totalAmount: 1000 }]
    });
    assert.strictEqual(m.lines[0].taxRate, null);
  });

  it('warns about a line that carries no rate', () => {
    const m = buildInvoicePrintModel({
      ...invoice,
      items: [{ productName: 'Unrated goods', quantity: 1, unit: 'kg', unitPrice: 1000, taxAmount: 0, totalAmount: 1000 }]
    });
    assert.ok(m.warnings.some(w => /no tax rate/i.test(w)));
  });

  it('omits the HS code rather than printing a fixed one', () => {
    const m = buildInvoicePrintModel(invoice);
    assert.strictEqual(m.lines[0].hsCode, null);
    assert.doesNotMatch(JSON.stringify(m), /5205\.1200/);
  });

  it('keeps a real HS code when the line carries one', () => {
    const m = buildInvoicePrintModel({
      ...invoice,
      items: [{ ...invoice.items[0], hsCode: '3407.0000' }]
    });
    assert.strictEqual(m.lines[0].hsCode, '3407.0000');
  });
});

describe('printed totals must match the ledger', () => {
  it('uses the stored header totals', () => {
    const m = buildInvoicePrintModel(invoice);
    assert.strictEqual(m.totals.fromLedger, true);
    assert.strictEqual(m.totals.subtotal, 435000);
    assert.strictEqual(m.totals.taxAmount, 78300);
    assert.strictEqual(m.totals.grandTotal, 513300);
  });

  it('falls back to summing the lines when the header is absent', () => {
    const m = buildInvoicePrintModel({ items: invoice.items });
    assert.strictEqual(m.totals.fromLedger, false);
    assert.strictEqual(m.totals.subtotal, 435000);
    assert.strictEqual(m.totals.taxAmount, 78300);
    assert.strictEqual(m.totals.grandTotal, 513300);
  });

  it('REPORTS a disagreement instead of silently printing one side', () => {
    const m = buildInvoicePrintModel({ ...invoice, taxAmount: 99999 });
    assert.strictEqual(m.totals.taxAmount, 99999, 'ledger figure is what the invoice says');
    assert.ok(
      m.warnings.some(w => /header records/.test(w)),
      'the mismatch between the lines and the header must be raised'
    );
  });

  it('flags a header that does not add up', () => {
    const m = buildInvoicePrintModel({ ...invoice, totalAmount: 600000 });
    assert.ok(m.warnings.some(w => /does not equal/.test(w)));
  });

  it('stays quiet when the lines and the header agree', () => {
    const m = buildInvoicePrintModel(invoice);
    assert.deepStrictEqual(m.warnings.filter(w => /Line |Subtotal plus/.test(w)), []);
  });
});

describe('withholding is stated only when it was computed', () => {
  it('is null for an invoice record, which carries no withholding field', () => {
    const m = buildInvoicePrintModel(invoice);
    assert.strictEqual(m.wht, null);
    assert.doesNotMatch(JSON.stringify(m), /4\.5/, 'the hardcoded 4.5% must not reappear');
  });

  it('is stated when the record does carry a rate', () => {
    const m = buildInvoicePrintModel({ ...invoice, whtRate: 9, whtAmount: 39150 });
    assert.deepStrictEqual(m.wht, { rate: 9, base: 435000, amount: 39150 });
  });

  it('computes the amount from the rate when only the rate is given', () => {
    const m = buildInvoicePrintModel({ ...invoice, whtRate: 4.5 });
    assert.deepStrictEqual(m.wht, { rate: 4.5, base: 435000, amount: 19575 });
  });
});

describe('model integrity', () => {
  it('is deterministic', () => {
    assert.deepStrictEqual(buildInvoicePrintModel(invoice), buildInvoicePrintModel(invoice));
  });

  it('survives a record with no items at all', () => {
    const m = buildInvoicePrintModel({ invoiceNumber: 'INV-EMPTY' });
    assert.deepStrictEqual(m.lines, []);
    assert.ok(m.warnings.some(w => /no line items/i.test(w)));
    assert.strictEqual(m.totals.subtotal, 0);
  });

  it('survives missing or junk field types without producing NaN', () => {
    const m = buildInvoicePrintModel({
      invoiceNumber: null,
      customerName: undefined,
      items: [{ productName: null, quantity: 'x', unitPrice: null }]
    });
    assert.ok(Number.isFinite(m.lines[0].taxableValue));
    assert.ok(Number.isFinite(m.totals.grandTotal));
    assert.strictEqual(m.invoiceNumber, 'UNNUMBERED');
    assert.strictEqual(m.lines[0].productName, 'Item 1');
  });

  it('keeps the recorded issue date', () => {
    assert.strictEqual(buildInvoicePrintModel(invoice).issuedOn, '2026-09-01T09:30:00.000Z');
  });
});