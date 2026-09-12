import { z } from "zod";
import { fail, ok, type ToolResponse } from "@/lib/responses";
import { db, findCustomer, findSupplier } from "./store";

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

export function listSuppliers(input: unknown): ToolResponse {
  const { q } = ListPartiesInput.parse(input ?? {});
  const items = q ? db.suppliers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : db.suppliers;
  return ok("list_suppliers", { count: items.length, suppliers: items });
}

export function createSupplier(input: unknown): ToolResponse {
  const data = CreateSupplierInput.parse(input);
  if (findSupplier(data.name)) return fail("create_supplier", "VALIDATION_ERROR", `Supplier already exists: ${data.name}`);
  const supplier = {
    id: `s-${db.suppliers.length + 1}`,
    name: data.name,
    city: data.city ?? "",
    ...(data.phone ? { phone: data.phone } : {}),
    ...(data.email ? { email: data.email } : {}),
    lead_time_days: data.lead_time_days ?? 5,
  };
  db.suppliers.push(supplier);
  return ok("create_supplier", { id: supplier.id, name: supplier.name });
}

export function listCustomers(input: unknown): ToolResponse {
  const { q } = ListPartiesInput.parse(input ?? {});
  const items = q ? db.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : db.customers;
  return ok("list_customers", { count: items.length, customers: items });
}

export function createCustomer(input: unknown): ToolResponse {
  const data = CreateCustomerInput.parse(input);
  if (findCustomer(data.name)) return fail("create_customer", "VALIDATION_ERROR", `Customer already exists: ${data.name}`);
  const customer = {
    id: `c-${db.customers.length + 1}`,
    name: data.name,
    city: data.city ?? "",
    ...(data.phone ? { phone: data.phone } : {}),
    ...(data.email ? { email: data.email } : {}),
  };
  db.customers.push(customer);
  return ok("create_customer", { id: customer.id, name: customer.name });
}
