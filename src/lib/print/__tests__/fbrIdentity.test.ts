/**
 * FBR payload identity guards.
 *
 * The fabricated-buyer-identity bug appeared THREE times in one file before it
 * was fully removed: in `calculateFBRTax`, in `buildFBRPosInvoicePayload`, and
 * again in `generateIrisAnnexureCPayload`. Each looked locally reasonable —
 * "if we do not know the buyer's NTN, use a realistic one" — and each put a
 * made-up national ID number into a payload intended for a tax authority.
 *
 * These tests exist because the pattern recurs. They assert the negative
 * property directly, so a future placeholder cannot be reintroduced by someone
 * who has never seen this file's history.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `reorder.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
// `fbrTaxEngine` lives at `src/utils/`, three levels up from here.
import { calculateFBRTax, buildFBRPosInvoicePayload, generateIrisAnnexureCPayload } from '../../../utils/fbrTaxEngine';

/** Every placeholder that was ever shipped in a buyer-identity field. */
const FORBIDDEN = ['35201-9876543-1', '35201-1111111-1', '1928471-2', '1234567-8'];

const baseCalc = {
  amount: 435000,
  invoiceNumber: 'INV-DEMO-1001',
  invoiceDate: '2026-09-01T09:30:00.000Z',
  isFiler: true
};

describe('no fabricated buyer identity reaches any payload', () => {
  it('calculateFBRTax QR string carries no placeholder CNIC or NTN', () => {
    const r = calculateFBRTax(baseCalc as any);
    for (const bad of FORBIDDEN) {
      assert.ok(!r.qrCodeDataString.includes(bad), `QR payload must not contain ${bad}`);
      assert.ok(!String(r.buyerCNIC || '').includes(bad), `buyerCNIC must not be ${bad}`);
    }
  });

  it('marks an unknown buyer UNREGISTERED rather than inventing an identity', () => {
    const r = calculateFBRTax(baseCalc as any);
    assert.strictEqual(r.qrCodeDataString.includes('|UNREGISTERED|'), true);
  });

  it('buildFBRPosInvoicePayload carries no placeholder identity', () => {
    const p = buildFBRPosInvoicePayload({
      invoiceNumber: 'INV-DEMO-1001',
      buyerName: 'Rahim Traders',
      items: [{ itemCode: 'X', description: 'Dye', quantity: 1, unitPrice: 100, taxRate: 18 }]
    } as any);
    const serialised = JSON.stringify(p);
    for (const bad of FORBIDDEN) {
      assert.ok(!serialised.includes(bad), `payload must not contain ${bad}`);
    }
  });

  it('generateIrisAnnexureCPayload carries no placeholder identity or yarn HS code', () => {
    const batch = generateIrisAnnexureCPayload([
      { invoiceNumber: 'INV-DEMO-1001', customerName: 'Rahim Traders', subtotal: 252000, taxAmount: 45360, totalAmount: 297360 }
    ]) as any;
    const documents = batch.Documents ?? batch.documents ?? [];
    // Guard against passing vacuously: the assertions below mean nothing if the
    // builder returned no documents at all.
    assert.strictEqual(documents.length, 1, 'the batch must actually contain the invoice');
    assert.strictEqual(documents[0].DocumentNumber, 'INV-DEMO-1001');
    assert.strictEqual(documents[0].BuyerNTN, 'UNREGISTERED');
    const serialised = JSON.stringify(batch);
    for (const bad of FORBIDDEN) {
      assert.ok(!serialised.includes(bad), `batch must not contain ${bad}`);
    }
    // A dye is not 5205.1200 (cotton yarn), and we do not know the code.
    assert.strictEqual(documents[0].HSCode, 'Not recorded');
    // 45,360 / 252,000 = 18% — derived from the record rather than asserted.
    assert.strictEqual(documents[0].TaxRate, 18);
    assert.ok(!serialised.includes('Industrial Area, Lahore'), 'must not invent a buyer address');
  });
});

describe('fiscal identifiers are stable for the life of an invoice', () => {
  it('calculateFBRTax returns one fiscal number across calls', () => {
    const a = calculateFBRTax(baseCalc as any);
    const b = calculateFBRTax(baseCalc as any);
    assert.ok(a.fbrFiscalInvoiceNumber, 'a fiscal invoice number is always produced');
    assert.strictEqual(a.fbrFiscalInvoiceNumber, b.fbrFiscalInvoiceNumber);
  });

  it('calculateFBRTax returns one verification hash across calls', () => {
    // The printed "SHA-256 Digitally Sealed" line used to append Date.now(),
    // so a seal that changed every render verified nothing.
    assert.strictEqual(
      calculateFBRTax(baseCalc as any).sha256VerificationHash,
      calculateFBRTax(baseCalc as any).sha256VerificationHash
    );
  });

  it('buildFBRPosInvoicePayload returns one fiscal number across calls', () => {
    const args = {
      invoiceNumber: 'INV-DEMO-1001',
      items: [{ itemCode: 'X', description: 'Dye', quantity: 1, unitPrice: 100, taxRate: 18 }]
    } as any;
    const first = buildFBRPosInvoicePayload(args).FbrFiscalInvoiceNumber;
    const second = buildFBRPosInvoicePayload(args).FbrFiscalInvoiceNumber;
    // Assert the value is actually present, so this cannot pass by comparing
    // undefined to undefined.
    assert.ok(first, 'the payload must carry a fiscal invoice number');
    assert.strictEqual(first, second);
  });

  it('different invoices still get different fiscal numbers', () => {
    const a = calculateFBRTax({ ...baseCalc, invoiceNumber: 'INV-A' } as any).fbrFiscalInvoiceNumber;
    const b = calculateFBRTax({ ...baseCalc, invoiceNumber: 'INV-B' } as any).fbrFiscalInvoiceNumber;
    assert.notStrictEqual(a, b);
  });
});