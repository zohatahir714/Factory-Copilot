"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client-api";
import { money, PageHeader, Table, Td, Badge, Empty, ErrorNote, cardStyle, btnPrimary, inputStyle, Field } from "@/components/ui";

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  reorder_threshold: number;
  current_stock: number;
  low_stock: boolean;
  stock_display: string;
}

/** Products & Inventory (PRD user stories 1–5): list, search, create. */
export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", unit: "kg", category: "", cost_price: "", selling_price: "", reorder_threshold: "" });

  const load = useCallback(async (query?: string) => {
    try {
      const data = await apiGet<{ products: Product[] }>(`/api/products${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      setItems(data.products);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const num = (v: string) => (v === "" ? undefined : Number(v));
      await apiSend("/api/products", {
        name: form.name,
        sku: form.sku,
        unit: form.unit,
        ...(form.category ? { category: form.category } : {}),
        ...(num(form.cost_price) !== undefined ? { cost_price: num(form.cost_price) } : {}),
        ...(num(form.selling_price) !== undefined ? { selling_price: num(form.selling_price) } : {}),
        ...(num(form.reorder_threshold) !== undefined ? { reorder_threshold: num(form.reorder_threshold) } : {}),
      });
      setNotice(`✅ Product "${form.name}" created — stock starts at 0; receive goods or ask the Copilot to adjust.`);
      setForm({ name: "", sku: "", unit: "kg", category: "", cost_price: "", selling_price: "", reorder_threshold: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Products & Inventory"
        subtitle="Master list — stock truth is tracked through movements"
        actions={
          <>
            <input placeholder="Search name / SKU…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)} style={{ ...inputStyle, width: 220 }} />
            <button style={btnPrimary} onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Close" : "+ New Product"}
            </button>
          </>
        }
      />
      {notice && <p style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {showForm && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Name *"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="SKU *"><input style={inputStyle} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Unit *"><input style={inputStyle} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
            <Field label="Category"><input style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="yarn / dye / fabric" /></Field>
            <Field label="Cost price"><input type="number" style={inputStyle} value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></Field>
            <Field label="Selling price"><input type="number" style={inputStyle} value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} /></Field>
            <Field label="Reorder threshold"><input type="number" style={inputStyle} value={form.reorder_threshold} onChange={(e) => setForm({ ...form, reorder_threshold: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button style={btnPrimary} disabled={busy || !form.name || !form.sku} onClick={submit}>Create product</button>
          </div>
        </section>
      )}
      {items.length === 0 && !error ? (
        <Empty>No products match.</Empty>
      ) : (
        <Table head={["SKU", "Name", "Category", "Stock", "Cost", "Selling", "Status"]}>
          {items.map((p) => (
            <tr key={p.id}>
              <Td mono>{p.sku}</Td>
              <Td>{p.name}</Td>
              <Td>{p.category}</Td>
              <Td right>{p.stock_display}</Td>
              <Td right>{money(p.cost_price)}</Td>
              <Td right>{money(p.selling_price)}</Td>
              <Td>{p.low_stock ? <Badge tone="warn">low stock</Badge> : <Badge tone="ok">ok</Badge>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
