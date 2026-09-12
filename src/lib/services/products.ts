import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import { money } from "@/lib/format";
import { getStore, type Product } from "./store";

/** PRODUCTS SERVICE — deterministic product/inventory-read operations. */

export const ListProductsInput = z.object({ q: z.string().optional() });
export const CreateProductInput = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  unit: z.string().min(1),
  category: z.string().optional(),
  cost_price: z.number().nonnegative().optional(),
  selling_price: z.number().nonnegative().optional(),
  reorder_threshold: z.number().nonnegative().optional(),
});
export const UpdateProductInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  cost_price: z.number().nonnegative().optional(),
  selling_price: z.number().nonnegative().optional(),
  now: z.number().nonnegative().optional(),
  reorder_threshold: z.number().nonnegative().optional(),
});

export async function listProducts(input: unknown): Promise<ToolResponse> {
  const { q } = ListProductsInput.parse(input ?? {});
  const store = getStore();
  let items = await store.listProducts();
  if (q) {
    const query = q.toLowerCase();
    items = items.filter((p) => p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query) || p.category.includes(query));
  }
  return ok("list_products", {
    count: items.length,
    products: items.map((p) => ({
      ...p,
      low_stock: p.current_stock <= p.reorder_threshold,
      stock_display: `${p.current_stock} ${p.unit}`,
    })),
  });
}

export async function lookupProduct(input: unknown): Promise<ToolResponse> {
  const { product } = z.object({ product: z.string().min(1) }).parse(input);
  const store = getStore();
  const p = await store.findProduct(product);
  if (!p) return fail("lookup_product", "PRODUCT_NOT_FOUND", `Product not found: "${product}"`, await store.productSuggestions(product));
  return ok("lookup_product", {
    id: p.id,
    product: p.name,
    sku: p.sku,
    current_stock: p.current_stock,
    unit: p.unit,
    cost_price: p.cost_price,
    selling_price: p.selling_price,
    reorder_threshold: p.reorder_threshold,
    low_stock_warning: p.current_stock <= p.reorder_threshold,
    tax_rate: await store.taxRateForCategory(p.category),
    stock_value: money(p.current_stock * p.cost_price),
  });
}

export async function createProduct(input: unknown): Promise<ToolResponse> {
  const data = CreateProductInput.parse(input);
  const store = getStore();
  const dup =
    (await store.findProduct(data.name)) ||
    (await store.productBySku(data.sku));
  if (dup) {
    return fail("create_product", "VALIDATION_ERROR", `Product or SKU already exists: ${data.name} / ${data.sku}`);
  }
  const product: Product = await store.insertProduct(data);
  return ok("create_product", { id: product.id, name: product.name, sku: product.sku, unit: product.unit, stock: product.current_stock });
}

export async function updateProduct(input: unknown): Promise<ToolResponse> {
  const data = UpdateProductInput.parse(input);
  const store = getStore();
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.sku !== undefined) patch.sku = data.sku;
  if (data.unit !== undefined) patch.unit = data.unit;
  if (data.category !== undefined) patch.category = data.category;
  if (data.cost_price !== undefined) patch.cost_price = data.cost_price;
  if (data.selling_price !== undefined) patch.selling_price = data.selling_price;
  if (data.reorder_threshold !== undefined) patch.reorder_threshold = data.reorder_threshold;
  const p = await store.updateProduct(data.id, patch);
  if (!p) return fail("update_product", "PRODUCT_NOT_FOUND", `Product not found: ${data.id}`);
  return ok("update_product", { id: p.id, name: p.name });
}
