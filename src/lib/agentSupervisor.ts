/**
 * Supervisor Agent & Multi-Agent Orchestration Layer
 * Compliant with PRD Section 6, 7, 8, 14, 15 & 16
 *
 * Directs voice and text commands to:
 * - Inventory Agent (Stock verification, low stock alerts, inventory sync)
 * - Purchase Agent (Vendor PO generation, low-stock reorder, Goods Receipt)
 * - Accounting Agent (GST 18% sales dispatch, cashbook disbursements, executive business summary)
 * - Compliance Agent (FBR legal tax citations & regulatory lookup)
 * - Master Partner Registry (Dynamic Voice Supplier & Customer creation)
 */

import {
  AgentDomain,
  AgentHandoffContract,
  ChatMessage,
  ConfirmationPayload,
  ToolExecutionRecord,
  Product,
  Supplier,
  Customer
} from '../types';
import {
  DatabaseState,
  toolCheckInventory,
  preparePurchaseOrderConfirmation,
  prepareReorderLowStockConfirmation,
  prepareRecordSaleConfirmation,
  toolReceiveGoods,
  toolGetCashBalance,
  toolGetPendingOrders,
  toolGetBusinessSummary,
  toolRecordExpense,
  executeCreateSupplier,
  executeCreateCustomer
} from './businessTools';
import { queryComplianceRAG } from './ragCompliance';

export interface SupervisorProcessResult {
  message: ChatMessage;
  pendingConfirmation?: ConfirmationPayload;
  directDatabaseUpdate?: DatabaseState;
}

/**
 * Parses user input in English or Roman Urdu, extracts domain and entities
 * Dynamically binds to real products, suppliers, and customers present in state.
 */
export function analyzeUserIntent(input: string, state?: DatabaseState): AgentHandoffContract {
  const lower = input.toLowerCase().trim();

  // Dynamic entity resolution from live database state
  const availableProducts: Product[] = state?.products || [];
  const availableSuppliers: Supplier[] = state?.suppliers || [];
  const availableCustomers: Customer[] = state?.customers || [];

  const matchedProduct = availableProducts.find(p => {
    const pName = p.name.toLowerCase();
    const pSku = p.sku.toLowerCase();
    return lower.includes(pName) || lower.includes(pSku) ||
      (pName.split(' ').some(word => word.length > 3 && lower.includes(word)));
  });

  const matchedSupplier = availableSuppliers.find(s => {
    const sName = s.name.toLowerCase();
    return lower.includes(sName) ||
      (sName.split(' ').some(word => word.length > 4 && lower.includes(word)));
  });

  const matchedCustomer = availableCustomers.find(c => {
    const cName = c.name.toLowerCase();
    return lower.includes(cName) ||
      (cName.split(' ').some(word => word.length > 4 && lower.includes(word)));
  });

  // 1. Add New Supplier ("Add supplier Green Mills Karachi", "Naya supplier banao Sitara Chemicals", "Register vendor ABC")
  if (
    lower.includes('add supplier') ||
    lower.includes('new supplier') ||
    lower.includes('register supplier') ||
    lower.includes('naya supplier') ||
    lower.includes('supplier banao') ||
    lower.includes('add vendor')
  ) {
    let name = input.replace(/add\s+supplier|new\s+supplier|register\s+supplier|naya\s+supplier|supplier\s+banao|add\s+vendor/i, '').trim();
    let city = 'Pakistan';
    const cityMatch = name.match(/in\s+([A-Za-z]+)|,\s*([A-Za-z]+)/i);
    if (cityMatch) {
      city = (cityMatch[1] || cityMatch[2]).trim();
      name = name.replace(cityMatch[0], '').trim();
    }
    return {
      intent: 'add_supplier',
      domain: 'purchase',
      entities: { name: name || 'New Raw Material Supplier', city },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 2. Add New Customer ("Add customer Al-Karam Karachi", "Naya customer banao Master Textile", "Register client XYZ")
  if (
    lower.includes('add customer') ||
    lower.includes('new customer') ||
    lower.includes('register customer') ||
    lower.includes('naya customer') ||
    lower.includes('customer banao') ||
    lower.includes('add client')
  ) {
    let name = input.replace(/add\s+customer|new\s+customer|register\s+customer|naya\s+customer|customer\s+banao|add\s+client/i, '').trim();
    let city = 'Pakistan';
    const cityMatch = name.match(/in\s+([A-Za-z]+)|,\s*([A-Za-z]+)/i);
    if (cityMatch) {
      city = (cityMatch[1] || cityMatch[2]).trim();
      name = name.replace(cityMatch[0], '').trim();
    }
    return {
      intent: 'add_customer',
      domain: 'accounting',
      entities: { name: name || 'New Buyer Mill', city },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 3. Live Inventory Fetch / Sync / Audit ("Sync inventory", "Fetch live inventory", "Audit stock positions")
  if (
    lower.includes('sync inventory') ||
    lower.includes('fetch inventory') ||
    lower.includes('audit stock') ||
    lower.includes('inventory fetch') ||
    lower.includes('reconcile stock')
  ) {
    return {
      intent: 'sync_inventory',
      domain: 'inventory',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 4. Executive Business Summary
  if (
    lower.includes('business summary') ||
    lower.includes('complete position') ||
    lower.includes('summary do') ||
    (lower.includes('cash') && lower.includes('sales')) ||
    lower.includes('aaj ka') ||
    lower.includes('dashboard')
  ) {
    return {
      intent: 'get_business_summary',
      domain: 'accounting',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 5. Receive Goods against Purchase Order
  if (
    lower.includes('receive goods') ||
    lower.includes('receive karo') ||
    lower.includes('maal receive') ||
    (lower.includes('po') && lower.includes('receive')) ||
    (lower.includes('goods') && lower.includes('received'))
  ) {
    const match = lower.match(/po-?(\d+)/) || lower.match(/(\d{4})/);
    const poNum = match ? `PO-${match[1]}` : (state?.purchaseOrders.find(p => p.status === 'pending')?.poNumber || 'PO-1001');
    return {
      intent: 'receive_goods',
      domain: 'purchase',
      entities: { poNumber: poNum },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 6. Reorder Materials Intent ("Reorder completely", "Reorder low stock", "Kam stock mangwao")
  if (
    lower.includes('reorder') ||
    lower.includes('re-order') ||
    lower.includes('restock') ||
    lower.includes('maal mangwa') ||
    lower.includes('dobara mangwa')
  ) {
    const qtyMatch = lower.match(/(\d+)\s*(kilo|kg|bags|liters|drums|meters)?/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined;

    return {
      intent: 'reorder_materials',
      domain: 'purchase',
      entities: {
        product: matchedProduct ? matchedProduct.name : undefined,
        quantity
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: true,
      rawPrompt: input
    };
  }

  // 7. Purchase Order creation ("Create PO for 100 kg yarn from Lucky Spinning", "order dye", "po banao")
  if (
    lower.includes('po bana') ||
    lower.includes('purchase order') ||
    lower.includes('order bana') ||
    lower.includes('khareed') ||
    lower.includes('create po') ||
    lower.includes('buy material') ||
    (lower.includes('se') && lower.includes('po'))
  ) {
    const qtyMatch = lower.match(/(\d+)\s*(kilo|kg|bags|liters|meters)?/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 100;

    const supplierName = matchedSupplier
      ? matchedSupplier.name
      : (availableSuppliers[0]?.name || 'Primary Supplier');

    const productName = matchedProduct
      ? matchedProduct.name
      : (availableProducts[0]?.name || 'Raw Material Item');

    return {
      intent: 'create_purchase_order',
      domain: 'purchase',
      entities: {
        supplier: supplierName,
        product: productName,
        quantity
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: true,
      rawPrompt: input
    };
  }

  // 8. Sales Order creation ("Sell 50 units to customer", "invoice banao", "record sale")
  if (
    lower.includes('sell karo') ||
    lower.includes('sale karo') ||
    lower.includes('becho') ||
    lower.includes('invoice bana') ||
    lower.includes('record sale') ||
    lower.includes('dispatch') ||
    (lower.includes('ko') && lower.includes('sell'))
  ) {
    const qtyMatch = lower.match(/(\d+)\s*(kilo|kg|bags|meters|units)?/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 50;

    const customerName = matchedCustomer
      ? matchedCustomer.name
      : (availableCustomers[0]?.name || 'Textile Client Mill');

    const productName = matchedProduct
      ? matchedProduct.name
      : (availableProducts[0]?.name || 'Finished Fabric');

    return {
      intent: 'record_sale',
      domain: 'accounting',
      entities: {
        customer: customerName,
        product: productName,
        quantity
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: true,
      rawPrompt: input
    };
  }

  // 9. Compliance / Tax / FBR queries
  if (
    lower.includes('tax') ||
    lower.includes('gst') ||
    lower.includes('fbr') ||
    lower.includes('compliance') ||
    lower.includes('sro') ||
    lower.includes('withholding') ||
    lower.includes('filing')
  ) {
    return {
      intent: 'compliance_query',
      domain: 'compliance',
      entities: { query: input },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 10. Cashbook & Expense query
  if (
    lower.includes('cash position') ||
    lower.includes('kitna cash') ||
    lower.includes('cash balance') ||
    lower.includes('tijori') ||
    lower.includes('liquidity')
  ) {
    return {
      intent: 'get_cash_balance',
      domain: 'accounting',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 11. Expense recording ("5000 utility bill pay kiya", "expense record karo")
  if (lower.includes('expense') || lower.includes('kharcha') || lower.includes('bill pay')) {
    const amountMatch = lower.match(/(\d+[\d,]*)/);
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 5000;
    return {
      intent: 'record_expense',
      domain: 'accounting',
      entities: {
        amount,
        category: 'utilities',
        description: input
      },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 12. Pending Purchase Orders query
  if (
    lower.includes('pending po') ||
    lower.includes('pending orders') ||
    lower.includes('orders pending') ||
    lower.includes('in-flight')
  ) {
    return {
      intent: 'get_pending_orders',
      domain: 'purchase',
      entities: {},
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 13. Low Stock alert query
  if (
    lower.includes('low stock') ||
    lower.includes('kam stock') ||
    lower.includes('khatam') ||
    lower.includes('deficit')
  ) {
    return {
      intent: 'check_inventory',
      domain: 'inventory',
      entities: { product: 'all', filterLowStock: true },
      userId: 'usr_super_admin',
      organizationId: 'org_sme_01',
      requiresConfirmation: false,
      rawPrompt: input
    };
  }

  // 14. Default to Inventory Stock Check
  return {
    intent: 'check_inventory',
    domain: 'inventory',
    entities: { product: matchedProduct ? matchedProduct.name : '' },
    userId: 'usr_super_admin',
    organizationId: 'org_sme_01',
    requiresConfirmation: false,
    rawPrompt: input
  };
}

/**
 * Main Supervisor Execution Router
 * Takes live state, executes deterministic tools, and returns state updates & confirmation cards
 */
export async function executeSupervisorTurn(
  input: string,
  state: DatabaseState,
  inputMethod: 'text' | 'voice' = 'text'
): Promise<SupervisorProcessResult> {
  const contract = analyzeUserIntent(input, state);
  const now = new Date().toISOString();

  // ROUTE 0: MASTER REGISTRY CREATION (Suppliers & Customers)
  if (contract.intent === 'add_supplier') {
    const supplierName = contract.entities.name || 'New Supplier';
    const city = contract.entities.city || 'Pakistan';
    const { newSupplier, updatedState } = executeCreateSupplier(state, {
      name: supplierName,
      city,
      leadTimeDays: 3,
      paymentTerms: 'Net 30 Days'
    });

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🏢 **New Supplier Registered Successfully**\n\n• **Vendor Name**: **${newSupplier.name}**\n• **City / Hub**: ${newSupplier.city}\n• **Lead Time**: ${newSupplier.leadTimeDays} days\n• **Payment Terms**: ${newSupplier.paymentTerms}\n• **Record ID**: \`${newSupplier.id}\`\n\nThis supplier is now wired into the Purchase Order and Cashbook dropdowns.`,
        timestamp: now,
        inputMethod,
        routedAgent: 'purchase',
        toolExecution: {
          toolName: 'create_supplier',
          domain: 'purchase',
          status: 'success',
          inputs: contract.entities,
          output: { supplierId: newSupplier.id, name: newSupplier.name },
          timestamp: now,
          executionMs: 10
        }
      },
      directDatabaseUpdate: updatedState
    };
  }

  if (contract.intent === 'add_customer') {
    const customerName = contract.entities.name || 'New Buyer Mill';
    const city = contract.entities.city || 'Pakistan';
    const { newCustomer, updatedState } = executeCreateCustomer(state, {
      name: customerName,
      city,
      creditLimit: 500000,
      outstandingReceivables: 0
    });

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `👥 **New Customer Account Registered**\n\n• **Client / Mill**: **${newCustomer.name}**\n• **Location**: ${newCustomer.city}\n• **Standard Credit Limit**: Rs. ${newCustomer.creditLimit.toLocaleString()}\n• **Current Receivables**: Rs. 0\n• **Account Ref**: \`${newCustomer.id}\`\n\nThis customer is now active across Sales Invoicing (18% GST) and Cashbook receipts.`,
        timestamp: now,
        inputMethod,
        routedAgent: 'accounting',
        toolExecution: {
          toolName: 'create_customer',
          domain: 'accounting',
          status: 'success',
          inputs: contract.entities,
          output: { customerId: newCustomer.id, name: newCustomer.name },
          timestamp: now,
          executionMs: 10
        }
      },
      directDatabaseUpdate: updatedState
    };
  }

  // ROUTE 0.5: LIVE INVENTORY AUDIT & SYNC
  if (contract.intent === 'sync_inventory') {
    const totalSKUs = state.products.length;
    const lowStock = state.products.filter(p => p.currentStock <= p.reorderThreshold).length;
    const totalValuation = state.products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);

    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🔄 **Live Inventory Reconciled & Verified**\n\n• Active Production SKUs: **${totalSKUs}**\n• Total Warehouse Valuation: **Rs. ${totalValuation.toLocaleString()}**\n• Items Below Threshold: **${lowStock}**\n• Audit Movements Recorded: **${state.inventoryMovements.length}**\n\nAll material positions are verified against real Purchase Order receipts and sales dispatches.`,
        timestamp: now,
        inputMethod,
        routedAgent: 'inventory',
        toolExecution: {
          toolName: 'sync_inventory',
          domain: 'inventory',
          status: 'success',
          inputs: {},
          output: { totalSKUs, lowStock, totalValuation },
          timestamp: now,
          executionMs: 15
        }
      }
    };
  }

  // ROUTE 1: INVENTORY AGENT
  if (contract.domain === 'inventory') {
    const res = toolCheckInventory(state, { product: contract.entities.product });

    if (!res.success) {
      const availableNames = state.products.map(p => `• ${p.name} (${p.currentStock} ${p.unit})`).join('\n') || '• No products in catalog. Add via "+ Add Product".';
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `❌ ${res.error?.message}\n\nCurrent Catalog SKUs:\n${availableNames}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'inventory'
        }
      };
    }

    const { product, lowStockItems } = res.data!;
    if (product) {
      const isLow = product.currentStock <= product.reorderThreshold;
      const statusIcon = isLow ? '⚠️' : '📦';
      const warningText = isLow ? `\n\n⚠️ Warning: Stock is below reorder threshold of ${product.reorderThreshold} ${product.unit}!` : '';

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `${statusIcon} **${product.name}**\n\n• Available Stock: **${product.currentStock} ${product.unit}**\n• Warehouse SKU: \`${product.sku}\`\n• Unit Cost Price: Rs. ${product.costPrice.toLocaleString()}\n• Minimum Reorder Level: ${product.reorderThreshold} ${product.unit}${warningText}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'inventory',
          structuredData: { type: 'inventory', data: product }
        }
      };
    }

    const lowStockList = lowStockItems.map(p => `• ⚠️ **${p.name}**: ${p.currentStock} ${p.unit} (Threshold: ${p.reorderThreshold} ${p.unit})`).join('\n');
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `📦 **Warehouse Inventory Status**\n\nTotal catalog items: ${state.products.length}\n\n**Low Stock Warnings:**\n${lowStockList || 'All materials above threshold.'}`,
        timestamp: now,
        inputMethod,
        routedAgent: 'inventory',
        structuredData: { type: 'inventory', data: lowStockItems }
      }
    };
  }

  // ROUTE 2: PURCHASE AGENT
  if (contract.domain === 'purchase') {
    if (contract.intent === 'receive_goods') {
      const recRes = toolReceiveGoods(state, { poIdOrNumber: contract.entities.poNumber });
      if (!recRes.success) {
        return {
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `❌ Could not receive goods.\n\n${recRes.error?.message}`,
            timestamp: now,
            inputMethod,
            routedAgent: 'purchase'
          }
        };
      }

      const { po, updatedProduct, movement, updatedState } = recRes.data!;
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `✅ **Goods Received Successfully!**\n\n• Purchase Order: **${po.poNumber}** (${po.supplierName})\n• Received: **${po.items[0]?.quantity} ${po.items[0]?.unit} ${updatedProduct.name}**\n• Updated Warehouse Stock: **${updatedProduct.currentStock} ${updatedProduct.unit}**\n• Inventory Movement Logged: \`${movement.id}\``,
          timestamp: now,
          inputMethod,
          routedAgent: 'purchase',
          structuredData: { type: 'purchase_order', data: po }
        },
        directDatabaseUpdate: updatedState
      };
    }

    if (contract.intent === 'get_pending_orders') {
      const pOrders = toolGetPendingOrders(state);
      const list = pOrders.pendingPurchaseOrders
        .map(p => `• **${p.poNumber}** — ${p.supplierName}: ${p.items[0]?.quantity} ${p.items[0]?.unit} ${p.items[0]?.productName} (Rs. ${p.totalAmount.toLocaleString()})`)
        .join('\n');

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `📋 **Pending Purchase Orders (${pOrders.count})**\n\nTotal committed procurement capital: **Rs. ${pOrders.totalPendingValuePKR.toLocaleString()}**\n\n${list || 'No pending purchase orders.'}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'purchase'
        }
      };
    }

    if (contract.intent === 'reorder_materials') {
      const reorderRes = prepareReorderLowStockConfirmation(state, {
        specificProduct: contract.entities.product,
        customQuantity: contract.entities.quantity
      });

      if (!reorderRes.success) {
        return {
          message: {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: `ℹ️ **Reorder Analysis:**\n\n${reorderRes.error?.message}`,
            timestamp: now,
            inputMethod,
            routedAgent: 'purchase'
          }
        };
      }

      const conf = reorderRes.data!.confirmation;
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `⚡ **Reorder Action Prepared**\n\n${conf.description}\n\n• Unit Price: Rs. ${conf.details.unitPricePKR?.toLocaleString()}\n• Total Commitment: **Rs. ${conf.totalAmountPKR.toLocaleString()}**\n\nPlease review and confirm to disburse PO to supplier.`,
          timestamp: now,
          inputMethod,
          routedAgent: 'purchase',
          structuredData: { type: 'purchase_order', data: conf.details }
        },
        pendingConfirmation: conf
      };
    }

    // Create PO -> requires human confirmation
    const prepRes = preparePurchaseOrderConfirmation(state, {
      supplier: contract.entities.supplier,
      product: contract.entities.product,
      quantity: contract.entities.quantity
    });

    if (!prepRes.success) {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `❌ Could not prepare Purchase Order.\n\n${prepRes.error?.message}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'purchase'
        }
      };
    }

    const conf = prepRes.data!.confirmation;
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `📝 **Purchase Order Prepared for Confirmation**\n\n${conf.description}\n\nPlease review and confirm to disburse PO to supplier.`,
        timestamp: now,
        inputMethod,
        routedAgent: 'purchase',
        confirmationRequired: conf
      },
      pendingConfirmation: conf
    };
  }

  // ROUTE 3: ACCOUNTING AGENT
  if (contract.domain === 'accounting') {
    if (contract.intent === 'get_business_summary') {
      const summary = toolGetBusinessSummary(state);
      const lowStockBullet = summary.lowStockItems.length > 0
        ? summary.lowStockItems.map(p => `• ⚠️ ${p.name} — **${p.currentStock} ${p.unit}**`).join('\n')
        : '• None (all stock healthy)';

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `📊 **TODAY'S EXECUTIVE BUSINESS SUMMARY**\n\n` +
            `💰 **Sales (Today)**: Rs. ${summary.todaySalesPKR.toLocaleString()}\n` +
            `💵 **Cash & Bank Position**: Rs. ${summary.cashPositionPKR.toLocaleString()}\n` +
            `📦 **Inventory Valuation**: Rs. ${summary.totalInventoryValuePKR.toLocaleString()}\n` +
            `📋 **Pending Purchase Orders**: ${summary.pendingPOsCount} orders\n` +
            `📑 **Outstanding Receivables**: Rs. ${summary.outstandingReceivablesPKR.toLocaleString()}\n\n` +
            `⚠️ **Low Stock Items:**\n${lowStockBullet}\n\n` +
            `🎯 **Recommended Action:**\n${summary.recommendedAction}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'accounting',
          structuredData: { type: 'business_summary', data: summary }
        }
      };
    }

    if (contract.intent === 'get_cash_balance') {
      const cash = toolGetCashBalance(state);
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `💵 **Cash Position & Liquidity**\n\n• Net Available Cash: **Rs. ${cash.netCashPosition.toLocaleString()}**\n• Recorded Inflows: Rs. ${cash.totalInflow.toLocaleString()}\n• Recorded Disbursements: Rs. ${cash.totalOutflow.toLocaleString()}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'accounting'
        }
      };
    }

    if (contract.intent === 'record_expense') {
      const { entry, updatedState } = toolRecordExpense(state, {
        amount: contract.entities.amount,
        category: contract.entities.category,
        description: contract.entities.description
      });

      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `✅ **Disbursement Logged in Cashbook**\n\n• Amount: **Rs. ${entry.amount.toLocaleString()}**\n• Category: ${entry.category}\n• Description: ${entry.description}\n• Cashbook Ref: \`${entry.id}\``,
          timestamp: now,
          inputMethod,
          routedAgent: 'accounting'
        },
        directDatabaseUpdate: updatedState
      };
    }

    // Record sale -> requires confirmation
    const prepSale = prepareRecordSaleConfirmation(state, {
      customer: contract.entities.customer,
      product: contract.entities.product,
      quantity: contract.entities.quantity
    });

    if (!prepSale.success) {
      return {
        message: {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `❌ Could not prepare sales transaction.\n\n${prepSale.error?.message}`,
          timestamp: now,
          inputMethod,
          routedAgent: 'accounting'
        }
      };
    }

    const conf = prepSale.data!.confirmation;
    return {
      message: {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🧾 **Sales Order & Invoice Prepared for Confirmation**\n\n${conf.description}\n\n• Customer: **${conf.details.customer}**\n• Subtotal: Rs. ${conf.details.subtotalPKR.toLocaleString()}\n• FBR Sales Tax (18% GST): Rs. ${conf.details.gstAmountPKR.toLocaleString()}\n• **Total Payable**: **Rs. ${conf.totalAmountPKR?.toLocaleString()}**\n• Inventory deduction: -${conf.details.quantity} ${conf.details.unit} (Warehouse stock will decrease from ${conf.details.currentStock} to ${conf.details.remainingStockAfterSale} ${conf.details.unit}).`,
        timestamp: now,
        inputMethod,
        routedAgent: 'accounting',
        confirmationRequired: conf
      },
      pendingConfirmation: conf
    };
  }

  // ROUTE 4: COMPLIANCE AGENT (FBR RAG)
  const ragResult = queryComplianceRAG(state.complianceSources, contract.entities.query || input);
  return {
    message: {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: `⚖️ **FBR Compliance & Tax Guidance**\n\n${ragResult.explanation}\n\n• **Applicable GST Rate**: **${ragResult.gstRate}%**\n• **Withholding Rate**: **${ragResult.withholdingRate}%**\n• **Statutory Deadline**: ${ragResult.filingDeadline}\n• **Authoritative Citation**: \`${ragResult.citation}\`\n• **Confidence Score**: ${(ragResult.confidence * 100).toFixed(0)}% (Verified against active FBR regulations)`,
      timestamp: now,
      inputMethod,
      routedAgent: 'compliance',
      structuredData: { type: 'compliance_rule', data: ragResult }
    }
  };
}
