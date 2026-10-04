/**
 * Seeded demo factory.
 *
 * Built on top of `fixtures.ts` so the ledger and the voice entity vocabulary
 * cannot drift apart.
 *
 * Expected shape once loaded (verify before a demo):
 *   - Reactive Dye Blue sits below its 120 kg reorder threshold WITH dispatch
 *     history, so the autonomous reorder engine proposes a real PO.
 *   - INV-DEMO-1001 is unpaid and older than 30 days, so the anomaly engine
 *     raises an overdue-receivable flag with its statutory citation.
 *   - Rahim Traders is an unregistered buyer, so the further-tax path under
 *     STA s.3(1A) is exercised.
 *
 * Dates are relative to today so the demo never rots.
 */
import type {
  PurchaseOrder, SalesOrder, InventoryMovement, CashbookEntry, Customer
} from '../types/index';
import {
  DEMO_SUPPLIERS, DEMO_CUSTOMERS, DEMO_PRODUCTS, DEMO_ORGANIZATION_ID, demoDate
} from './fixtures';

const ORG = DEMO_ORGANIZATION_ID;
const GST_RATE = 18;

const COTTON = 'prd_cotton_yarn_150d';
const POLY = 'prd_polyester_dty';
const DYE_BLUE = 'prd_reactive_dye_blue';
const SOFTENER = 'prd_softener';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function salesOrder(args: {
  id: string; invoiceNumber: string; customer: Customer; productId: string;
  productName: string; quantity: number; unit: string; unitPrice: number;
  daysAgo: number; paymentStatus: SalesOrder['paymentStatus'];
}): SalesOrder {
  const subtotal = round2(args.quantity * args.unitPrice);
  const gstAmount = round2((subtotal * GST_RATE) / 100);
  // No further tax on the stored invoice: `SalesOrder` has no such column and
  // buyer registration is supplied to `calculateFBRTaxByCategory` at creation
  // time. Inventing one here would assert a figure the ledger cannot support.
  const totalAmount = round2(subtotal + gstAmount);

  return {
    id: args.id,
    invoiceNumber: args.invoiceNumber,
    organizationId: ORG,
    customerId: args.customer.id,
    customerName: args.customer.name,
    subtotal,
    taxAmount: gstAmount,
    totalAmount,
    paymentStatus: args.paymentStatus,
    items: [{
      id: `${args.id}_i1`,
      salesOrderId: args.id,
      productId: args.productId,
      productName: args.productName,
      quantity: args.quantity,
      unit: args.unit,
      unitPrice: args.unitPrice,
      taxRate: GST_RATE,
      taxAmount: gstAmount,
      totalAmount
    }],
    createdBy: 'admin',
    createdAt: demoDate(args.daysAgo)
  } as SalesOrder;
}

function purchaseOrder(args: {
  id: string; poNumber: string; supplierId: string; supplierName: string;
  productId: string; productName: string; quantity: number; unit: string;
  unitPrice: number; daysAgo: number; status: PurchaseOrder['status'];
}): PurchaseOrder {
  const subtotal = round2(args.quantity * args.unitPrice);
  const taxAmount = round2((subtotal * GST_RATE) / 100);

  return {
    id: args.id,
    poNumber: args.poNumber,
    organizationId: ORG,
    supplierId: args.supplierId,
    supplierName: args.supplierName,
    status: args.status,
    totalAmount: round2(subtotal + taxAmount),
    items: [{
      id: `${args.id}_i1`,
      purchaseOrderId: args.id,
      productId: args.productId,
      productName: args.productName,
      quantity: args.quantity,
      unit: args.unit,
      unitPrice: args.unitPrice,
      taxAmount,
      totalAmount: round2(subtotal + taxAmount)
    }],
    createdBy: 'admin',
    createdAt: demoDate(args.daysAgo)
  } as PurchaseOrder;
}

export interface DemoFactory {
  suppliers: typeof DEMO_SUPPLIERS;
  customers: typeof DEMO_CUSTOMERS;
  products: typeof DEMO_PRODUCTS;
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  inventoryMovements: InventoryMovement[];
  cashbook: CashbookEntry[];
}

export function buildDemoFactory(): DemoFactory {
  const powerlooms = DEMO_CUSTOMERS[0];
  const sialkot = DEMO_CUSTOMERS[1];
  const rahim = DEMO_CUSTOMERS[2];
  const greenMills = DEMO_SUPPLIERS[0];
  const colourchem = DEMO_SUPPLIERS[1];

  const purchaseOrders: PurchaseOrder[] = [
    purchaseOrder({
      id: 'po_demo_1', poNumber: 'PO-2001',
      supplierId: greenMills.id, supplierName: greenMills.name,
      productId: COTTON, productName: 'Cotton Yarn 150D',
      quantity: 1000, unit: 'kg', unitPrice: 1200,
      daysAgo: 45, status: 'received'
    }),
    purchaseOrder({
      id: 'po_demo_2', poNumber: 'PO-2002',
      supplierId: colourchem.id, supplierName: colourchem.name,
      productId: DYE_BLUE, productName: 'Reactive Dye Blue',
      quantity: 200, unit: 'kg', unitPrice: 1650,
      daysAgo: 60, status: 'received'
    }),
    purchaseOrder({
      id: 'po_demo_3', poNumber: 'PO-2003',
      supplierId: DEMO_SUPPLIERS[2].id, supplierName: DEMO_SUPPLIERS[2].name,
      productId: SOFTENER, productName: 'Softener Liquid',
      quantity: 250, unit: 'liters', unitPrice: 420,
      daysAgo: 8, status: 'pending'
    })
  ];

  const salesOrders: SalesOrder[] = [
    // 52 days old and unpaid — past the 30-day collection window, so the
    // anomaly engine flags it with its citation.
    salesOrder({
      id: 'so_demo_1', invoiceNumber: 'INV-DEMO-1001',
      customer: powerlooms, productId: COTTON, productName: 'Cotton Yarn 150D',
      quantity: 300, unit: 'kg', unitPrice: 1450,
      daysAgo: 52, paymentStatus: 'unpaid'
    }),
    salesOrder({
      id: 'so_demo_2', invoiceNumber: 'INV-DEMO-1002',
      customer: sialkot, productId: POLY, productName: 'Polyester DTY 150D',
      quantity: 180, unit: 'kg', unitPrice: 1250,
      daysAgo: 28, paymentStatus: 'unpaid'
    }),
    // Unregistered buyer — further tax under STA s.3(1A) applies on top of GST.
    salesOrder({
      id: 'so_demo_3', invoiceNumber: 'INV-DEMO-1003',
      customer: rahim, productId: DYE_BLUE, productName: 'Reactive Dye Blue',
      quantity: 120, unit: 'kg', unitPrice: 2100,
      daysAgo: 12, paymentStatus: 'paid'
    }),
    salesOrder({
      id: 'so_demo_4', invoiceNumber: 'INV-DEMO-1004',
      customer: powerlooms, productId: COTTON, productName: 'Cotton Yarn 150D',
      quantity: 260, unit: 'kg', unitPrice: 1450,
      daysAgo: 9, paymentStatus: 'paid'
    }),
    // Recent dispatch of the below-threshold dye — this is the demand history
    // the reorder engine needs before it will propose anything.
    salesOrder({
      id: 'so_demo_5', invoiceNumber: 'INV-DEMO-1005',
      customer: sialkot, productId: DYE_BLUE, productName: 'Reactive Dye Blue',
      quantity: 45, unit: 'kg', unitPrice: 2100,
      daysAgo: 3, paymentStatus: 'paid'
    }),
    salesOrder({
      id: 'so_demo_6', invoiceNumber: 'INV-DEMO-1006',
      customer: sialkot, productId: SOFTENER, productName: 'Softener Liquid',
      quantity: 60, unit: 'liters', unitPrice: 640,
      daysAgo: 2, paymentStatus: 'paid'
    })
  ];

  const inventoryMovements: InventoryMovement[] = salesOrders.map((so, idx) => ({
    id: `mv_${so.id}`,
    organizationId: ORG,
    productId: so.items[0].productId,
    productName: so.items[0].productName,
    quantityDelta: -so.items[0].quantity,
    balanceAfter: Math.max(0, 1500 - idx * 250),
    movementType: 'sales_dispatch' as const,
    referenceType: 'sales_order' as const,
    referenceId: so.id,
    createdBy: 'admin',
    createdAt: so.createdAt,
    notes: `Dispatch against ${so.invoiceNumber}`
  }));

  /* RECEIPTS AND PRODUCTION ISSUES.
     Both movement types already existed on the type and nothing wrote them, so
     "which material had loss" had no data to reconcile and the copilot refused
     — correctly, but uselessly. These are seeded from the purchase orders
     above (a received PO books a receipt) and from the production runs the
     dispatch pattern implies.

     The numbers are chosen so the variance question has a real answer with
     real structure: COTTON and DYE_BLUE are issued to production, SOFTENER was
     received and never issued, and the demo opening stock is deliberately left
     out of the receipts so the variance stays honest rather than being closed
     off by a made-up opening balance. */
  const receiptMovements: InventoryMovement[] = purchaseOrders
    .filter(po => po.status === 'received')
    .map(po => ({
      id: `mv_${po.id}_in`,
      organizationId: ORG,
      productId: po.items[0].productId,
      productName: po.items[0].productName,
      quantityDelta: po.items[0].quantity,
      balanceAfter: po.items[0].quantity,
      movementType: 'purchase_receipt' as const,
      referenceType: 'purchase_order' as const,
      referenceId: po.id,
      createdBy: 'admin',
      createdAt: po.createdAt,
      notes: `Goods received against ${po.poNumber} from ${po.supplierName}`
    }));

  // What each consumed run drew off the store. Cotton and dye both went to the
  // line; softener came in and sat there.
  const PRODUCTION_RUNS: ReadonlyArray<readonly [string, string, number, number]> = [
    [COTTON, 'Cotton Yarn 150D', 820, 50],
    [DYE_BLUE, 'Reactive Dye Blue', 150, 55]
  ];

  const productionMovements: InventoryMovement[] = PRODUCTION_RUNS.map(
    ([productId, productName, quantity, daysAgo]) => ({
      id: `mv_issue_${productId}`,
      organizationId: ORG,
      productId,
      productName,
      quantityDelta: -quantity,
      balanceAfter: 0,
      movementType: 'production_issue' as const,
      referenceType: 'manual' as const,
      referenceId: undefined,
      createdBy: 'admin',
      createdAt: demoDate(daysAgo),
      notes: `Issued to production batch — ${productName}`
    })
  );

  inventoryMovements.push(...receiptMovements, ...productionMovements);

  const cashbook: CashbookEntry[] = [
    {
      id: 'cb_demo_1', voucherNumber: 'BRV-9001', voucherType: 'BRV',
      organizationId: ORG, type: 'inflow', paymentMode: 'bank',
      bankAccountName: 'Meezan Bank — Operating',
      category: 'misc', description: 'Opening bank balance',
      amount: 875000, createdAt: demoDate(90), createdBy: 'admin'
    },
    {
      id: 'cb_demo_2', voucherNumber: 'CPV-9001', voucherType: 'CPV',
      organizationId: ORG, type: 'inflow', paymentMode: 'cash',
      category: 'misc', description: 'Opening cash float',
      amount: 125000, createdAt: demoDate(90), createdBy: 'admin'
    },
    {
      // The brief's worked example: a diesel expense that must auto-voucher
      // into a balanced journal.
      id: 'cb_demo_3', voucherNumber: 'CPV-3001', voucherType: 'CPV',
      organizationId: ORG, type: 'outflow', paymentMode: 'cash',
      category: 'utilities', description: 'Generator diesel — monthly',
      amount: 12000, createdAt: demoDate(6), createdBy: 'admin'
    },
    {
      id: 'cb_demo_4', voucherNumber: 'BRV-3002', voucherType: 'BRV',
      organizationId: ORG, type: 'inflow', paymentMode: 'bank',
      bankAccountName: 'Meezan Bank — Operating',
      category: 'customer_payment', description: 'Receipt against INV-DEMO-1004',
      referenceId: 'so_demo_4', amount: 428550,
      createdAt: demoDate(5), createdBy: 'admin'
    }
  ];

  // Customer balances are DERIVED from the invoices seeded above, exactly the
  // way `executeRecordSale` maintains them: every invoice still unpaid is money
  // owed by that customer.
  //
  // The seed used to copy the fixture customers across at zero, which left the
  // dashboard reporting Rs. 0 of receivables while the table beside it listed a
  // 52-day-old unpaid invoice for Rs. 513,300. Both numbers came from this
  // ledger and they contradicted each other, so neither could be defended.
  const owedByCustomer = new Map<string, number>();
  for (const so of salesOrders) {
    if (so.paymentStatus === 'paid') continue;
    owedByCustomer.set(so.customerId, (owedByCustomer.get(so.customerId) || 0) + so.totalAmount);
  }
  const customers = DEMO_CUSTOMERS.map(c => ({
    ...c,
    outstandingReceivables: owedByCustomer.get(c.id) || 0
  }));

  return {
    suppliers: DEMO_SUPPLIERS,
    customers,
    products: DEMO_PRODUCTS,
    purchaseOrders,
    salesOrders,
    inventoryMovements,
    cashbook
  };
}