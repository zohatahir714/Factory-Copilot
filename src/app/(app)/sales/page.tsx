"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/client-api";
import { money, shortDate, PageHeader, Table, Td, Badge, Empty, ErrorNote, cardStyle, btnPrimary, inputStyle, Field } from "@/components/ui";

interface Invoice {
  invoice_id: string;
  customer: string;
  items: { product: string; quantity: number; unit_price: number; tax_amount: number }[];
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_status: "paid" | "unpaid";
  created_at: string;
}
interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  selling_price: number;
  current_stock: number;
}
interface Customer {
  id: string;
  name: string;
}

/** Sales & Invoicing (PRD user stories 11–15): record with live totals, list invoices. */
export default function SalesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ customerId: "", productId: "", quantity: "", payment: "paid" });

  const load = useCallback(async () => {
    try {
      const [sales, prods, custs] = await Promise.all([
        apiGet<{ invoices: Invoice[] }>("/api/sales"),
        apiGet<{ products: Product[] }>("/api/products"),
        apiGet<{ customers: Customer[] }>("/api/customers"),
      ]);
      setInvoices(sales.invoices);
      setProducts(prods.products);
      setCustomers(custs.customers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sales");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = products.find((p) => p.id === form.productId);
  const quantity = Number(form.quantity) || 0;

  // Live preview: unit price from the product, GST from its category rate (18% demo).
  const preview = useMemo(() => {
    if (!selected || quantity <= 0) return null;
    const unitPrice = selected.selling_price;
    const subtotal = unitPrice * quantity;
    const tax = Math.round(subtotal * 0.18);
    return { unitPrice, subtotal, tax, total: subtotal + tax, overStock: quantity > selected.current_stock };
  }, [selected, quantity]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/sales", {
        customer: customers.find((c) => c.id === form.customerId)?.name ?? form.customerId,
        items: [{ product: selected?.name ?? form.productId, quantity }],
        payment_status: form.payment,
      });
      setNotice("✅ Sale recorded — invoice created, stock decremented, cash posted.");
      setForm({ customerId: "", productId: "", quantity: "", payment: "paid" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sale failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Sales & Invoices"
        subtitle="GST computed deterministically from category tax decisions"
        actions={<button style={btnPrimary} onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "+ New Sale"}</button>}
      />
      {notice && <p style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}

      {showForm && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="Customer *">
              <select style={inputStyle} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Product *">
              <select style={inputStyle} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.current_stock} {p.unit} in stock</option>
                ))}
              </select>
            </Field>
            <Field label={`Quantity *${selected ? ` (${selected.unit})` : ""}`} hint={selected ? `Selling price ${money(selected.selling_price)}` : undefined}>
              <input type="number" min="0" step="any" style={inputStyle} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label="Payment">
              <select style={inputStyle} value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })}>
                <option value="paid">Paid (posts cash)</option>
                <option value="unpaid">Credit (receivable)</option>
              </select>
            </Field>
          </div>

          {preview && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--panel-2)", borderRadius: 10, fontSize: 14, display: "flex", gap: 18, flexWrap: "wrap" }}>
              <span>Subtotal <strong>{money(preview.subtotal)}</strong></span>
              <span>GST (18%) <strong>{money(preview.tax)}</strong></span>
              <span>Total <strong style={{ fontSize: 16 }}>{money(preview.total)}</strong></span>
              {preview.overStock && <Badge tone="err">exceeds stock ({selected?.current_stock} {selected?.unit} available)</Badge>}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button style={btnPrimary} disabled={busy || !form.customerId || !form.productId || quantity <= 0 || !!preview?.overStock} onClick={submit}>
              Record sale
            </button>
          </div>
        </section>
      )}

      {invoices.length === 0 && !error ? (
        <Empty>No invoices yet.</Empty>
      ) : (
        <Table head={["Invoice", "Customer", "Items", "Subtotal", "GST", "Total", "Payment", "Date"]}>
          {invoices.map((inv) => (
            <tr key={inv.invoice_id}>
              <Td mono>{inv.invoice_id}</Td>
              <Td>{inv.customer}</Td>
              <Td>{inv.items.map((i) => `${i.quantity} × ${i.product}`).join(", ")}</Td>
              <Td right>{money(inv.subtotal)}</Td>
              <Td right>{money(inv.tax_amount)}</Td>
              <Td right><strong>{money(inv.total)}</strong></Td>
              <Td><Badge tone={inv.payment_status === "paid" ? "ok" : "warn"}>{inv.payment_status}</Badge></Td>
              <Td>{shortDate(inv.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
