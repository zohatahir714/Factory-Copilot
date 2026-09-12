import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import { getStore } from "./store";

/** PARTIES SERVICE — suppliers and customers. */

export const CreateSupplierInput = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  lead_time_days: z.number().int().positive().optional(),
});
export const CreateCustomerInput = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});
export const ListPartiesInput = z.object({ q: z.string().optional() });

export async function listSuppliers(input: unknown): Promise<ToolResponse> {
  const { q } = ListPartiesInput.parse(input ?? {});
  const store = getStore();
  let items = await store.listSuppliers();
  if (q) items = items.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return ok("list_suppliers", { count: items.length, suppliers: items });
}

export async function createSupplier(input: unknown): Promise<ToolResponse> {
  const data = CreateSupplierInput.parse(input);
  const store = getStore();
  if (await store.findSupplier(data.name)) return fail("create_supplier", "VALIDATION_ERROR", `Supplier already exists: ${data.name}`);
  const supplier = await store.insertSupplier(data);
  return ok("create_supplier", { id: supplier.id, name: supplier.name });
}

export async function listCustomers(input: unknown): Promise<ToolResponse> {
  const { q } = ListPartiesInput.parse(input ?? {});
  const store = getStore();
  let items = await store.listCustomers();
  if (q) items = items.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return ok("list_customers", { count: items.length, customers: items });
}

export async function createCustomer(input: unknown): Promise<ToolResponse> {
  const data = CreateCustomerInput.parse(input);
  const store = getStore();
  if (await store.findCustomer(data.name)) return fail("create_customer", "VALIDATION_ERROR", `Customer already exists: ${data.name}`);
  const customer = await store.insertCustomer(data);
  return ok("create_customer", { id: customer.id, name: customer.name });
}
