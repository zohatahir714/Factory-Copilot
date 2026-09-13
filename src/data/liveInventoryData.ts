/**
 * Clean Production State Interfaces
 * All seeded and hardcoded demo transactions completely removed per user directive.
 */

import { Product, Supplier, Customer, PurchaseOrder, SalesOrder, CashbookEntry, InventoryMovement } from '../types';

export const LIVE_SUPPLIERS: Supplier[] = [];
export const LIVE_CUSTOMERS: Customer[] = [];
export const LIVE_PRODUCTS: Product[] = [];
export const LIVE_INITIAL_POS: PurchaseOrder[] = [];
export const LIVE_INITIAL_SALES: SalesOrder[] = [];
export const LIVE_INITIAL_CASHBOOK: CashbookEntry[] = [];
export const LIVE_INITIAL_MOVEMENTS: InventoryMovement[] = [];
