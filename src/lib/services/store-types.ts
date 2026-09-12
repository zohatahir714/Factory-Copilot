/**
 * STORE CONTRACT — the interface every backend implements (PRD §12 invariants).
 * Services depend ONLY on this interface; swapping memory ↔ Supabase changes
 * nothing above this line (services, REST APIs, AI tools).
 */

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  reorder_threshold: number;
  current_stock: number;
}

export interface Supplier {
  id: string;
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  lead_time_days: number;
}

export interface Customer {
  id: string;
  name: string;
  city?: string;
  phone?: string;
  email?: string;
}

export interface POItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  status: "pending" | "received" | "cancelled";
  items: POItem[];
  total_amount: number;
  created_at: string;
  received_at?: string;
}

export interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
}

export interface Sale {
  id: string;
  customer_id: string;
  items: SaleItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_status: "paid" | "unpaid";
  created_at: string;
}

export interface CashEntry {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface Movement {
  id: string;
  product_id: string;
  delta: number;
  type: "purchase_receipt" | "sale_issue" | "adjustment";
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface NewPOInput {
  supplier_id: string;
  /** Name/SKU reference kept for RPC-based backends that re-resolve server-side. */
  supplier_ref?: string;
  items: { product_id: string; quantity: number; unit_price?: number; tax_amount?: number; product_ref?: string }[];
}

export interface NewSaleInput {
  customer_id: string;
  customer_ref?: string;
  items: { product_id: string; quantity: number; unit_price: number; tax_rate: number; tax_amount: number; product_ref?: string }[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_status: "paid" | "unpaid";
}

export interface NewCashInput {
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  reference_type?: string;
  reference_id?: string;
}

export interface ReceiveResult {
  ok: boolean;
  error?: "PO_NOT_FOUND" | "PO_ALREADY_RECEIVED" | "PRODUCT_NOT_FOUND";
  message?: string;
  po?: PurchaseOrder;
  movements?: { product: string; quantity_received: number; new_stock: number }[];
}

export interface SaleCommitResult {
  ok: boolean;
  error?: "PRODUCT_NOT_FOUND" | "INSUFFICIENT_STOCK" | "DB_ERROR";
  message?: string;
  sale?: Sale;
  movements?: Movement[];
  cash?: CashEntry;
}

export interface BizStore {
  backend: "memory" | "supabase";

  /* ---- fuzzy resolution (did-you-mean lives in services) ---- */
  findProduct(nameOrSku: string): Promise<Product | undefined> | Product | undefined;
  productSuggestions(nameOrSku: string, max?: number): Promise<string[]> | string[];
  findSupplier(name: string): Promise<Supplier | undefined> | Supplier | undefined;
  findCustomer(name: string): Promise<Customer | undefined> | Customer | undefined;
  taxRateForCategory(category: string): Promise<number> | number;

  /* ---- products ---- */
  listProducts(): Promise<Product[]> | Product[];
  productById(id: string): Promise<Product | undefined> | Product | undefined;
  productBySku(sku: string): Promise<Product | undefined> | Product | undefined;
  productByName(name: string): Promise<Product | undefined> | Product | undefined;
  insertProduct(data: { name: string; sku: string; unit: string; category?: string; cost_price?: number; selling_price?: number; reorder_threshold?: number }): Promise<Product> | Product;
  updateProduct(id: string, patch: Partial<Pick<Product, "name" | "sku" | "unit" | "category" | "cost_price" | "selling_price" | "reorder_threshold">>): Promise<Product | undefined> | Product | undefined;

  /* ---- parties ---- */
  listSuppliers(): Promise<Supplier[]> | Supplier[];
  insertSupplier(data: { name: string; city?: string; phone?: string; email?: string; lead_time_days?: number }): Promise<Supplier> | Supplier;
  listCustomers(): Promise<Customer[]> | Customer[];
  insertCustomer(data: { name: string; city?: string; phone?: string; email?: string }): Promise<Customer> | Customer;

  /* ---- purchase orders ---- */
  listPOs(): Promise<PurchaseOrder[]> | PurchaseOrder[];
  poById(idOrCode: string): Promise<PurchaseOrder | undefined> | PurchaseOrder | undefined;
  insertPO(po: NewPOInput): Promise<PurchaseOrder> | PurchaseOrder;

  /* ---- sales — atomic commit path (Rule 7) ---- */
  listSales(): Promise<Sale[]> | Sale[];
  insertSaleWithMovements(
    sale: NewSaleInput,
    movements: { product_id: string; delta: number; type: Movement["type"] }[],
    cashEntry: NewCashInput | null
  ): Promise<SaleCommitResult> | SaleCommitResult;

  /* ---- goods receipt — atomic (Rule 7) ---- */
  receiveGoods(poIdOrCode: string): Promise<ReceiveResult> | ReceiveResult;

  /* ---- cashbook ---- */
  listCashbook(): Promise<CashEntry[]> | CashEntry[];
  insertCashEntry(entry: NewCashInput): Promise<CashEntry> | CashEntry;

  /* ---- movement audit (stock truth = Σ movements, PRD Rule 4) ---- */
  listMovements(productId?: string): Promise<Movement[]> | Movement[];

  /* ---- compliance inputs (tax decisions) ---- */
  listTaxDecisions(): Promise<{ category: string; tax_rate: number; tax_type: string; source_document: string; source_reference: string; effective_date: string; confidence: number }[]> | { category: string; tax_rate: number; tax_type: string; source_document: string; source_reference: string; effective_date: string; confidence: number }[];

  /** Dev/test hooks — NEVER used by services for business logic. */
  __debug: {
    /** Memory backend only: restore the PRD §38 seed. */
    reset?(): void;
  };
}
