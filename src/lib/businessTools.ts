/**
 * Deterministic Business Tools Layer
 * Compliant with PRD Section 1, 12, 13, 14 & 23
 * "AI decides what needs to happen; deterministic business tools decide what actually happens."
 */

import {
  Product,
  Supplier,
  Customer,
  PurchaseOrder,
  SalesOrder,
  InventoryMovement,
  CashbookEntry,
  ConfirmationPayload,
  ComplianceRAGSource
} from '../types';

export interface DatabaseState {
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  inventoryMovements: InventoryMovement[];
  cashbook: CashbookEntry[];
  complianceSources: ComplianceRAGSource[];
}

export interface ToolResult<T = any> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    suggestedActions?: string[];
  } | null;
  metadata: {
    tool: string;
    timestamp: string;
    executionMs: number;
  };
}

/**
 * Fuzzy matching helper for names and SKUs (supports Roman Urdu & English inputs)
 */
export function findProductByName(products: Product[], query: string): Product | undefined {
  const q = query.toLowerCase().trim();
  // exact or substring
  return products.find(p => {
    const pName = p.name.toLowerCase();
    const pSku = p.sku.toLowerCase();
    if (pName.includes(q) || pSku.includes(q)) return true;
    // Roman Urdu keywords: "cotton", "yarn", "dye", "blue dye", "red dye", "soda", "ash", "peroxide", "poly"
    if (q.includes('cotton') || q.includes('yarn')) return pSku.includes('CTN') || pName.includes('Cotton');
    if (q.includes('blue dye') || (q.includes('blue') && q.includes('dye'))) return pSku.includes('BLU');
    if (q.includes('red dye') || (q.includes('red') && q.includes('dye'))) return pSku.includes('RED');
    if (q.includes('dye') && !q.includes('red')) return pSku.includes('BLU');
    if (q.includes('soda') || q.includes('ash')) return pSku.includes('SDA');
    if (q.includes('peroxide') || q.includes('hydrogen')) return pSku.includes('HYD');
    if (q.includes('poly') || q.includes('filament')) return pSku.includes('PLY');
    return false;
  });
}

export function findSupplierByName(suppliers: Supplier[], query: string): Supplier | undefined {
  const q = query.toLowerCase().trim();
  return suppliers.find(s => {
    const sName = s.name.toLowerCase();
    if (sName.includes(q)) return true;
    if (q.includes('colorchem') || q.includes('color chem') || q.includes('colourchem')) return sName.includes('colorchem');
    if (q.includes('sitara') || q.includes('chemical')) return sName.includes('sitara');
    if (q.includes('lucky') || q.includes('spinning')) return sName.includes('lucky');
    return false;
  });
}

export function findCustomerByName(customers: Customer[], query: string): Customer | undefined {
  const q = query.toLowerCase().trim();
  return customers.find(c => {
    const cName = c.name.toLowerCase();
    if (cName.includes(q)) return true;
    if (q.includes('rehman') || q.includes('al-rehman') || q.includes('al rehman')) return cName.includes('al-rehman');
    if (q.includes('chenab') || q.includes('garment')) return cName.includes('chenab');
    if (q.includes('nishat')) return cName.includes('nishat');
    return false;
  });
}

/**
 * P0 Tool: check_inventory
 */
export function toolCheckInventory(
  state: DatabaseState,
  params: { product?: string }
): ToolResult<{
  product: Product | null;
  allProducts: Product[];
  lowStockItems: Product[];
}> {
  const start = performance.now();
  const lowStockItems = state.products.filter(p => p.currentStock <= p.reorderThreshold);

  if (!params.product || params.product.trim() === '' || params.product.toLowerCase() === 'all') {
    return {
      success: true,
      data: {
        product: null,
        allProducts: state.products,
        lowStockItems
      },
      error: null,
      metadata: {
        tool: 'check_inventory',
        timestamp: new Date().toISOString(),
        executionMs: Math.round(performance.now() - start)
      }
    };
  }

  const found = findProductByName(state.products, params.product);
  if (!found) {
    return {
      success: false,
      data: null,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: `Product matching "${params.product}" was not found in Lahore Textiles catalog.`,
        suggestedActions: state.products.map(p => p.name)
      },
      metadata: {
        tool: 'check_inventory',
        timestamp: new Date().toISOString(),
        executionMs: Math.round(performance.now() - start)
      }
    };
  }

  return {
    success: true,
    data: {
      product: found,
      allProducts: state.products,
      lowStockItems
    },
    error: null,
    metadata: {
      tool: 'check_inventory',
      timestamp: new Date().toISOString(),
      executionMs: Math.round(performance.now() - start)
    }
  };
}

/**
 * P0 Tool: prepare_purchase_order_confirmation
 * Gated with Confirmation Policy before database write
 */
export function preparePurchaseOrderConfirmation(
  state: DatabaseState,
  params: { supplier: string; product: string; quantity: number }
): ToolResult<{ confirmation: ConfirmationPayload }> {
  const start = performance.now();
  const supplier = findSupplierByName(state.suppliers, params.supplier);
  const product = findProductByName(state.products, params.product);

  if (!supplier) {
    return {
      success: false,
      data: null,
      error: {
        code: 'SUPPLIER_NOT_FOUND',
        message: `Supplier "${params.supplier}" not found in registered suppliers.`,
        suggestedActions: state.suppliers.map(s => s.name)
      },
      metadata: { tool: 'create_purchase_order', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  if (!product) {
    return {
      success: false,
      data: null,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: `Product "${params.product}" not found in catalog.`,
        suggestedActions: state.products.map(p => p.name)
      },
      metadata: { tool: 'create_purchase_order', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  const unitPrice = product.costPrice;
  const totalAmountPKR = unitPrice * params.quantity;
  const nextPoNum = `PO-${1000 + state.purchaseOrders.length + 1}`;

  const confirmation: ConfirmationPayload = {
    id: `conf_${Date.now()}`,
    actionType: 'create_purchase_order',
    title: `Create Purchase Order: ${nextPoNum}`,
    description: `Create PO for ${params.quantity} ${product.unit} ${product.name} from ${supplier.name} for Rs. ${totalAmountPKR.toLocaleString()}?`,
    details: {
      poNumber: nextPoNum,
      supplier: supplier.name,
      supplierCity: supplier.city,
      product: product.name,
      sku: product.sku,
      quantity: params.quantity,
      unit: product.unit,
      unitPricePKR: unitPrice,
      totalAmountPKR,
      leadTimeDays: supplier.leadTimeDays
    },
    totalAmountPKR,
    executeParams: {
      supplierId: supplier.id,
      supplierName: supplier.name,
      productId: product.id,
      productName: product.name,
      quantity: params.quantity,
      unit: product.unit,
      unitPrice,
      totalAmount: totalAmountPKR
    },
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  return {
    success: true,
    data: { confirmation },
    error: null,
    metadata: {
      tool: 'prepare_purchase_order',
      timestamp: new Date().toISOString(),
      executionMs: Math.round(performance.now() - start)
    }
  };
}

/**
 * P0 Tool: prepare_reorder_low_stock
 * Detects low-stock items or specific material deficit, computes reorder quantity,
 * pairs with appropriate supplier, and returns ready-to-execute confirmation payload.
 */
export function prepareReorderLowStockConfirmation(
  state: DatabaseState,
  params: { specificProduct?: string; customQuantity?: number } = {}
): ToolResult<{ confirmation: ConfirmationPayload; affectedProducts: Product[] }> {
  const start = performance.now();

  if (params.specificProduct && params.specificProduct.trim() && params.specificProduct.toLowerCase() !== 'all') {
    const product = findProductByName(state.products, params.specificProduct);
    if (!product) {
      return {
        success: false,
        data: null,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `Product "${params.specificProduct}" was not found in catalog for reorder.`,
          suggestedActions: state.products.map(p => p.name)
        },
        metadata: { tool: 'reorder_materials', timestamp: new Date().toISOString(), executionMs: 5 }
      };
    }

    const supplier = findSupplierByName(
      state.suppliers,
      product.category.toLowerCase().includes('dye') ? 'ColorChem' :
      product.category.toLowerCase().includes('yarn') ? 'Lucky' :
      product.category.toLowerCase().includes('pack') ? 'Engro' : 'Sitara'
    ) || state.suppliers[0];

    const reorderQty = params.customQuantity && params.customQuantity > 0
      ? params.customQuantity
      : Math.max(product.reorderThreshold, product.reorderThreshold * 2 - product.currentStock);

    const totalAmountPKR = product.costPrice * reorderQty;
    const nextPoNum = `PO-${1000 + state.purchaseOrders.length + 1}`;

    const confirmation: ConfirmationPayload = {
      id: `conf_reorder_${Date.now()}`,
      actionType: 'create_purchase_order',
      title: `⚡ Reorder Purchase Order: ${product.name}`,
      description: `Create replenishment PO (${nextPoNum}) for ${reorderQty} ${product.unit} of ${product.name} from ${supplier ? supplier.name : 'Supplier'}? (Current stock: ${product.currentStock} ${product.unit}, Threshold: ${product.reorderThreshold} ${product.unit})`,
      details: {
        poNumber: nextPoNum,
        supplier: supplier ? supplier.name : 'Primary Supplier',
        product: product.name,
        sku: product.sku,
        currentStock: product.currentStock,
        reorderThreshold: product.reorderThreshold,
        quantity: reorderQty,
        unit: product.unit,
        unitPricePKR: product.costPrice,
        totalAmountPKR,
        leadTimeDays: supplier ? supplier.leadTimeDays : 3
      },
      totalAmountPKR,
      executeParams: {
        supplierId: supplier ? supplier.id : 'sup_default',
        supplierName: supplier ? supplier.name : 'Primary Supplier',
        productId: product.id,
        productName: product.name,
        quantity: reorderQty,
        unit: product.unit,
        unitPrice: product.costPrice,
        totalAmount: totalAmountPKR
      },
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    return {
      success: true,
      data: { confirmation, affectedProducts: [product] },
      error: null,
      metadata: { tool: 'reorder_materials', timestamp: new Date().toISOString(), executionMs: Math.round(performance.now() - start) }
    };
  }

  // Scan all low-stock materials
  const lowStock = state.products.filter(p => p.currentStock <= p.reorderThreshold);
  if (lowStock.length === 0) {
    return {
      success: false,
      data: null,
      error: {
        code: 'ALL_STOCK_HEALTHY',
        message: 'All inventory materials are currently healthy and above their reorder thresholds. No emergency reorder needed.',
        suggestedActions: state.products.slice(0, 4).map(p => `Reorder ${p.name}`)
      },
      metadata: { tool: 'reorder_materials', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  // Pick the most critical deficit product to create targeted PO
  const sortedByDeficit = [...lowStock].sort((a, b) => {
    const ratioA = a.currentStock / Math.max(1, a.reorderThreshold);
    const ratioB = b.currentStock / Math.max(1, b.reorderThreshold);
    return ratioA - ratioB;
  });

  const criticalItem = sortedByDeficit[0];
  const supplier = findSupplierByName(
    state.suppliers,
    criticalItem.category.toLowerCase().includes('dye') ? 'ColorChem' :
    criticalItem.category.toLowerCase().includes('yarn') ? 'Lucky' :
    criticalItem.category.toLowerCase().includes('pack') ? 'Engro' : 'Sitara'
  ) || state.suppliers[0];

  const reorderQty = Math.max(criticalItem.reorderThreshold, criticalItem.reorderThreshold * 2 - criticalItem.currentStock);
  const totalAmountPKR = criticalItem.costPrice * reorderQty;
  const nextPoNum = `PO-${1000 + state.purchaseOrders.length + 1}`;

  const confirmation: ConfirmationPayload = {
    id: `conf_reorder_low_${Date.now()}`,
    actionType: 'create_purchase_order',
    title: `⚡ Low-Stock Reorder PO: ${criticalItem.name}`,
    description: `Found ${lowStock.length} materials below reorder threshold. Create replenishment PO (${nextPoNum}) for critical item ${criticalItem.name} (${reorderQty} ${criticalItem.unit}) from ${supplier ? supplier.name : 'Supplier'} for Rs. ${totalAmountPKR.toLocaleString()}?`,
    details: {
      poNumber: nextPoNum,
      lowStockCount: lowStock.length,
      criticalProduct: criticalItem.name,
      supplier: supplier ? supplier.name : 'Primary Supplier',
      product: criticalItem.name,
      sku: criticalItem.sku,
      currentStock: criticalItem.currentStock,
      reorderThreshold: criticalItem.reorderThreshold,
      quantity: reorderQty,
      unit: criticalItem.unit,
      unitPricePKR: criticalItem.costPrice,
      totalAmountPKR
    },
    totalAmountPKR,
    executeParams: {
      supplierId: supplier ? supplier.id : 'sup_default',
      supplierName: supplier ? supplier.name : 'Primary Supplier',
      productId: criticalItem.id,
      productName: criticalItem.name,
      quantity: reorderQty,
      unit: criticalItem.unit,
      unitPrice: criticalItem.costPrice,
      totalAmount: totalAmountPKR
    },
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  return {
    success: true,
    data: { confirmation, affectedProducts: lowStock },
    error: null,
    metadata: { tool: 'reorder_materials', timestamp: new Date().toISOString(), executionMs: Math.round(performance.now() - start) }
  };
}

/**
 * P0 Tool: execute_create_purchase_order (Deterministic DB commit)
 */
export function executeCreatePurchaseOrder(
  state: DatabaseState,
  params: {
    supplierId: string;
    supplierName: string;
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalAmount: number;
  }
): { newPo: PurchaseOrder; updatedState: DatabaseState } {
  const nextPoNum = `PO-${1000 + state.purchaseOrders.length + 1}`;
  const newPoId = `po_${Date.now()}`;

  const newPo: PurchaseOrder = {
    id: newPoId,
    poNumber: nextPoNum,
    organizationId: state.products[0]?.organizationId || 'org_lahore_textiles_01',
    supplierId: params.supplierId,
    supplierName: params.supplierName,
    status: 'pending',
    totalAmount: params.totalAmount,
    items: [
      {
        id: `poi_${Date.now()}`,
        purchaseOrderId: newPoId,
        productId: params.productId,
        productName: params.productName,
        quantity: params.quantity,
        unit: params.unit,
        unitPrice: params.unitPrice,
        taxAmount: 0,
        totalAmount: params.totalAmount
      }
    ],
    createdBy: 'Tariq Mahmood',
    createdAt: new Date().toISOString(),
    notes: 'Generated via AI Business Copilot Supervisor'
  };

  const updatedPurchaseOrders = [newPo, ...state.purchaseOrders];
  return {
    newPo,
    updatedState: {
      ...state,
      purchaseOrders: updatedPurchaseOrders
    }
  };
}

/**
 * P0 Tool: receive_goods (against PO)
 * Increases inventory stock and appends inventory_movement record
 */
export function toolReceiveGoods(
  state: DatabaseState,
  params: { poIdOrNumber: string }
): ToolResult<{
  po: PurchaseOrder;
  updatedProduct: Product;
  movement: InventoryMovement;
  updatedState: DatabaseState;
}> {
  const start = performance.now();
  const q = params.poIdOrNumber.toLowerCase().trim();

  // find PO
  const po = state.purchaseOrders.find(
    p => p.id.toLowerCase() === q || p.poNumber.toLowerCase() === q || p.poNumber.toLowerCase().includes(q)
  );

  if (!po) {
    return {
      success: false,
      data: null,
      error: {
        code: 'PO_NOT_FOUND',
        message: `Purchase Order "${params.poIdOrNumber}" was not found.`,
        suggestedActions: state.purchaseOrders.map(p => `${p.poNumber} (${p.supplierName} - ${p.status})`)
      },
      metadata: { tool: 'receive_goods', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  if (po.status === 'received') {
    return {
      success: false,
      data: null,
      error: {
        code: 'PO_ALREADY_RECEIVED',
        message: `Purchase Order ${po.poNumber} has already been received on ${po.receivedAt || 'earlier date'}.`
      },
      metadata: { tool: 'receive_goods', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  const item = po.items[0];
  const targetProduct = state.products.find(p => p.id === item.productId);
  if (!targetProduct) {
    return {
      success: false,
      data: null,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: `Associated product ${item.productName} no longer exists in database.`
      },
      metadata: { tool: 'receive_goods', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  // Multi-step atomic update
  const newStock = targetProduct.currentStock + item.quantity;
  const updatedProduct: Product = {
    ...targetProduct,
    currentStock: newStock,
    updatedAt: new Date().toISOString()
  };

  const updatedPo: PurchaseOrder = {
    ...po,
    status: 'received',
    receivedAt: new Date().toISOString()
  };

  const movement: InventoryMovement = {
    id: `mov_${Date.now()}`,
    organizationId: targetProduct.organizationId,
    productId: targetProduct.id,
    productName: targetProduct.name,
    quantityDelta: item.quantity,
    balanceAfter: newStock,
    movementType: 'purchase_receipt',
    referenceId: po.poNumber,
    referenceType: 'purchase_order',
    createdBy: 'Tariq Mahmood',
    createdAt: new Date().toISOString(),
    notes: `Goods received against ${po.poNumber} from ${po.supplierName}`
  };

  const updatedState: DatabaseState = {
    ...state,
    products: state.products.map(p => (p.id === updatedProduct.id ? updatedProduct : p)),
    purchaseOrders: state.purchaseOrders.map(p => (p.id === po.id ? updatedPo : p)),
    inventoryMovements: [movement, ...state.inventoryMovements]
  };

  return {
    success: true,
    data: {
      po: updatedPo,
      updatedProduct,
      movement,
      updatedState
    },
    error: null,
    metadata: {
      tool: 'receive_goods',
      timestamp: new Date().toISOString(),
      executionMs: Math.round(performance.now() - start)
    }
  };
}

/**
 * P0 Tool: prepare_record_sale_confirmation
 * Verifies stock availability, calculates 18% standard GST deterministically, prepares confirmation
 */
export function prepareRecordSaleConfirmation(
  state: DatabaseState,
  params: { customer: string; product: string; quantity: number }
): ToolResult<{ confirmation: ConfirmationPayload }> {
  const start = performance.now();
  const customer = findCustomerByName(state.customers, params.customer);
  const product = findProductByName(state.products, params.product);

  if (!customer) {
    return {
      success: false,
      data: null,
      error: {
        code: 'CUSTOMER_NOT_FOUND',
        message: `Customer "${params.customer}" not registered in database.`,
        suggestedActions: state.customers.map(c => c.name)
      },
      metadata: { tool: 'record_sale', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  if (!product) {
    return {
      success: false,
      data: null,
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: `Product "${params.product}" not found in catalog.`,
        suggestedActions: state.products.map(p => p.name)
      },
      metadata: { tool: 'record_sale', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  // Stock check: LLM must never invent inventory
  if (product.currentStock < params.quantity) {
    return {
      success: false,
      data: null,
      error: {
        code: 'INSUFFICIENT_STOCK',
        message: `Insufficient inventory! Requested: ${params.quantity} ${product.unit}, but only ${product.currentStock} ${product.unit} of ${product.name} is available in warehouse.`
      },
      metadata: { tool: 'record_sale', timestamp: new Date().toISOString(), executionMs: 5 }
    };
  }

  // Deterministic financial calculation: 18% GST (Sales Tax Act 1990)
  const unitPrice = product.sellingPrice;
  const subtotal = unitPrice * params.quantity;
  const taxRate = 18;
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const totalAmountPKR = subtotal + taxAmount;
  const nextInvNum = `INV-2024-${String(40 + state.salesOrders.length + 1).padStart(4, '0')}`;

  const confirmation: ConfirmationPayload = {
    id: `conf_${Date.now()}`,
    actionType: 'record_sale',
    title: `Record Sale & Issue Invoice: ${nextInvNum}`,
    description: `Sell ${params.quantity} ${product.unit} ${product.name} to ${customer.name} for Rs. ${totalAmountPKR.toLocaleString()} (Subtotal: Rs. ${subtotal.toLocaleString()} + 18% GST: Rs. ${taxAmount.toLocaleString()})?`,
    details: {
      invoiceNumber: nextInvNum,
      customer: customer.name,
      customerCity: customer.city,
      product: product.name,
      sku: product.sku,
      quantity: params.quantity,
      unit: product.unit,
      unitPricePKR: unitPrice,
      subtotalPKR: subtotal,
      gstRate: '18% Standard GST (FBR Section 3(1))',
      gstAmountPKR: taxAmount,
      totalAmountPKR,
      currentStock: product.currentStock,
      remainingStockAfterSale: product.currentStock - params.quantity
    },
    totalAmountPKR,
    executeParams: {
      customerId: customer.id,
      customerName: customer.name,
      productId: product.id,
      productName: product.name,
      quantity: params.quantity,
      unit: product.unit,
      unitPrice,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount: totalAmountPKR
    },
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  return {
    success: true,
    data: { confirmation },
    error: null,
    metadata: {
      tool: 'prepare_record_sale',
      timestamp: new Date().toISOString(),
      executionMs: Math.round(performance.now() - start)
    }
  };
}

/**
 * P0 Tool: execute_record_sale (Deterministic DB commit with rollback safety)
 * Deducts stock, creates inventory movement, creates sales order, updates customer receivables
 */
export function executeRecordSale(
  state: DatabaseState,
  params: {
    customerId: string;
    customerName: string;
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
  }
): {
  newInvoice: SalesOrder;
  movement: InventoryMovement;
  updatedProduct: Product;
  updatedState: DatabaseState;
} {
  const targetProduct = state.products.find(p => p.id === params.productId);
  if (!targetProduct || targetProduct.currentStock < params.quantity) {
    throw new Error('Database integrity check failed: Stock insufficient at commit time.');
  }

  const nextInvNum = `INV-2024-${String(40 + state.salesOrders.length + 1).padStart(4, '0')}`;
  const newOrderId = `so_${Date.now()}`;
  const newStock = targetProduct.currentStock - params.quantity;

  const updatedProduct: Product = {
    ...targetProduct,
    currentStock: newStock,
    updatedAt: new Date().toISOString()
  };

  const newInvoice: SalesOrder = {
    id: newOrderId,
    invoiceNumber: nextInvNum,
    organizationId: targetProduct.organizationId,
    customerId: params.customerId,
    customerName: params.customerName,
    subtotal: params.subtotal,
    taxAmount: params.taxAmount,
    totalAmount: params.totalAmount,
    paymentStatus: 'unpaid',
    items: [
      {
        id: `soi_${Date.now()}`,
        salesOrderId: newOrderId,
        productId: params.productId,
        productName: params.productName,
        quantity: params.quantity,
        unit: params.unit,
        unitPrice: params.unitPrice,
        taxRate: params.taxRate,
        taxAmount: params.taxAmount,
        totalAmount: params.totalAmount
      }
    ],
    createdBy: 'Tariq Mahmood',
    createdAt: new Date().toISOString()
  };

  const movement: InventoryMovement = {
    id: `mov_${Date.now()}`,
    organizationId: targetProduct.organizationId,
    productId: targetProduct.id,
    productName: targetProduct.name,
    quantityDelta: -params.quantity,
    balanceAfter: newStock,
    movementType: 'sales_dispatch',
    referenceId: nextInvNum,
    referenceType: 'sales_order',
    createdBy: 'Tariq Mahmood',
    createdAt: new Date().toISOString(),
    notes: `Dispatch to ${params.customerName} on ${nextInvNum}`
  };

  // Update customer receivables
  const updatedCustomers = state.customers.map(c => {
    if (c.id === params.customerId) {
      return {
        ...c,
        outstandingReceivables: c.outstandingReceivables + params.totalAmount
      };
    }
    return c;
  });

  const updatedState: DatabaseState = {
    ...state,
    products: state.products.map(p => (p.id === updatedProduct.id ? updatedProduct : p)),
    salesOrders: [newInvoice, ...state.salesOrders],
    inventoryMovements: [movement, ...state.inventoryMovements],
    customers: updatedCustomers
  };

  return {
    newInvoice,
    movement,
    updatedProduct,
    updatedState
  };
}

/**
 * P0 Tool: record_expense
 */
export function toolRecordExpense(
  state: DatabaseState,
  params: { amount: number; category: string; description: string }
): { entry: CashbookEntry; updatedState: DatabaseState } {
  const newEntry: CashbookEntry = {
    id: `csh_${Date.now()}`,
    organizationId: state.products[0]?.organizationId || 'org_lahore_textiles_01',
    type: 'outflow',
    amount: params.amount,
    category: (params.category as any) || 'utilities',
    description: params.description || 'Factory operating disbursement',
    createdBy: 'Tariq Mahmood',
    createdAt: new Date().toISOString()
  };

  return {
    entry: newEntry,
    updatedState: {
      ...state,
      cashbook: [newEntry, ...state.cashbook]
    }
  };
}

/**
 * P0 Tool: get_cash_balance
 */
export function toolGetCashBalance(state: DatabaseState): {
  totalInflow: number;
  totalOutflow: number;
  netCashPosition: number;
  recentEntries: CashbookEntry[];
} {
  const totalInflow = state.cashbook
    .filter(c => c.type === 'inflow')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalOutflow = state.cashbook
    .filter(c => c.type === 'outflow')
    .reduce((sum, c) => sum + c.amount, 0);

  const netCashPosition = totalInflow - totalOutflow;

  return {
    totalInflow,
    totalOutflow,
    netCashPosition,
    recentEntries: state.cashbook.slice(0, 5)
  };
}

/**
 * P0 Tool: get_pending_orders
 */
export function toolGetPendingOrders(state: DatabaseState): {
  pendingPurchaseOrders: PurchaseOrder[];
  count: number;
  totalPendingValuePKR: number;
} {
  const pendingPurchaseOrders = state.purchaseOrders.filter(p => p.status === 'pending');
  const totalPendingValuePKR = pendingPurchaseOrders.reduce((sum, p) => sum + p.totalAmount, 0);
  return {
    pendingPurchaseOrders,
    count: pendingPurchaseOrders.length,
    totalPendingValuePKR
  };
}

/**
 * P0 Tool: get_business_summary
 * Direct implementation of PRD Section 28:
 * "Sales, Cash, Low Stock, Pending POs, Outstanding Receivables, Recommended Action"
 */
export function toolGetBusinessSummary(state: DatabaseState): {
  todaySalesPKR: number;
  cashPositionPKR: number;
  lowStockItems: Product[];
  pendingPOsCount: number;
  outstandingReceivablesPKR: number;
  totalInventoryValuePKR: number;
  recommendedAction: string;
} {
  // Today sales
  const todaySalesPKR = state.salesOrders.reduce((sum, s) => sum + s.totalAmount, 0);

  // Cash position
  const cash = toolGetCashBalance(state);

  // Low stock
  const lowStockItems = state.products.filter(p => p.currentStock <= p.reorderThreshold);

  // Pending POs
  const pendingPOs = state.purchaseOrders.filter(p => p.status === 'pending');

  // Receivables
  const outstandingReceivablesPKR = state.customers.reduce((sum, c) => sum + c.outstandingReceivables, 0);

  // Inventory value
  const totalInventoryValuePKR = state.products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);

  let recommendedAction = 'Operations normal. All critical material thresholds sustained.';
  if (lowStockItems.length > 0) {
    const mostCritical = lowStockItems.sort((a, b) => (a.currentStock / a.reorderThreshold) - (b.currentStock / b.reorderThreshold))[0];
    recommendedAction = `⚠️ Critical Reorder Alert: Reorder ${mostCritical.name} immediately (Current stock: ${mostCritical.currentStock} ${mostCritical.unit}, Threshold: ${mostCritical.reorderThreshold} ${mostCritical.unit}).`;
  }

  return {
    todaySalesPKR,
    cashPositionPKR: cash.netCashPosition,
    lowStockItems,
    pendingPOsCount: pendingPOs.length,
    outstandingReceivablesPKR,
    totalInventoryValuePKR,
    recommendedAction
  };
}

/**
 * P0 Tool: executeCreateSupplier
 */
export function executeCreateSupplier(
  state: DatabaseState,
  params: {
    name: string;
    city?: string;
    phone?: string;
    email?: string;
    leadTimeDays?: number;
    paymentTerms?: string;
  }
): { newSupplier: Supplier; updatedState: DatabaseState } {
  const newSupplier: Supplier = {
    id: `sup_${Date.now()}`,
    organizationId: state.suppliers[0]?.organizationId || 'org_sme_01',
    name: params.name.trim(),
    city: params.city?.trim() || 'Pakistan',
    phone: params.phone?.trim() || '',
    email: params.email?.trim() || '',
    leadTimeDays: params.leadTimeDays || 3,
    paymentTerms: params.paymentTerms || 'Net 30 Days',
    createdAt: new Date().toISOString()
  };
  return {
    newSupplier,
    updatedState: {
      ...state,
      suppliers: [newSupplier, ...state.suppliers]
    }
  };
}

/**
 * P0 Tool: executeCreateCustomer
 */
export function executeCreateCustomer(
  state: DatabaseState,
  params: {
    name: string;
    city?: string;
    phone?: string;
    email?: string;
    creditLimit?: number;
    outstandingReceivables?: number;
  }
): { newCustomer: Customer; updatedState: DatabaseState } {
  const newCustomer: Customer = {
    id: `cust_${Date.now()}`,
    organizationId: state.customers[0]?.organizationId || 'org_sme_01',
    name: params.name.trim(),
    city: params.city?.trim() || 'Pakistan',
    phone: params.phone?.trim() || '',
    email: params.email?.trim() || '',
    creditLimit: params.creditLimit || 500000,
    outstandingReceivables: params.outstandingReceivables || 0,
    createdAt: new Date().toISOString()
  };
  return {
    newCustomer,
    updatedState: {
      ...state,
      customers: [newCustomer, ...state.customers]
    }
  };
}

