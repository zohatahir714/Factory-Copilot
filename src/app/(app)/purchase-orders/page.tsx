"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client-api";
import { money, shortDate, PageHeader, Table, Td, Badge, Empty, ErrorNote, cardStyle, btnPrimary, btnGhost, inputStyle, Field } from "@/components/ui";

interface POItem {
  product: string;
  quantity: number;
  unit_price: number;
  tax_amount: number;
}
interface PO {
  po_id: string;
  supplier: string;
  status: "pending" | "received";
  items: POItem[];
  total: number;
  created_at: string;
}
interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
}

/** Purchase Orders (PRD user stories 6–10): create, list, receive. */
export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState<{ po: PO; preview: { items: { product: string; current_stock: number; new_stock: number }[] } } | null>(null);
  const [form, setForm] = useState({ supplier: "", productId: "", quantity: "" });

  const load = useCallback(async () => {
    try {
      const [poData, prodData] = await Promise.all([
        apiGet<{ orders: PO[] }>("/api/purchase-orders"),
        apiGet<{ products: Product[] }>("/api/products"),
      ]);
      setPos(poData.orders);
      setProducts(prodData.products);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load purchase orders");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const product = products.find((p) => p.id === form.productId);
      await apiSend("/api/purchase-orders", {
        supplier: form.supplier,
        items: [{ product: product?.name ?? form.productId, quantity: Number(form.quantity) }],
      });
      setNotice("✅ Purchase order created — pending until goods are received.");
      setForm({ supplier: "", productId: "", quantity: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const startReceive = async (po: PO) => {
    try {
      const preview = await apiSend<{ items: { product: string; current_stock: number; new_stock: number }[] }>(`/api/purchase-orders/${po.po_id}/receive`, { dry_run: true });
      setReceiving({ po, preview });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    }
  };

  const confirmReceive = async () => {
    if (!receiving) return;
    setBusy(true);
    try {
      await apiSend(`/api/purchase-orders/${receiving.po.po_id}/receive`, {});
      setNotice(`✅ Goods received for ${receiving.po.po_id} — inventory updated with movement records.`);
      setReceiving(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        subtitle="Goods in — receiving updates inventory atomically"
        actions={<button style={btnPrimary} onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "+ New PO"}</button>}
      />
      {notice && <p style={{ color: "var(--ok)" }}>{notice}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}

      {showForm && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="Supplier *"><input style={inputStyle} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="ColorChem Dyes" /></Field>
            <Field label="Product *">
              <select style={inputStyle} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </Field>
            <Field label={`Quantity *`} hint="Unit price defaults to product cost; GST added per category rate">
              <input type="number" min="0" step="any" style={inputStyle} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <button style={btnPrimary} disabled={busy || !form.supplier || !form.productId || !form.quantity} onClick={submit}>Create PO</button>
          </div>
        </section>
      )}

      {pos.length === 0 && !error ? (
        <Empty>No purchase orders yet.</Empty>
      ) : (
        <Table head={["PO", "Supplier", "Items", "Total", "Status", "Created", ""]}>
          {pos.map((po) => (
            <tr key={po.po_id}>
              <Td mono>{po.po_id}</Td>
              <Td>{po.supplier}</Td>
              <Td>{po.items.map((i) => `${i.quantity} × ${i.product}`).join(", ")}</Td>
              <Td right>{money(po.total)}</Td>
              <Td>{po.status === "pending" ? <Badge tone="warn">pending</Badge> : <Badge tone="ok">received</Badge>}</Td>
              <Td>{shortDate(po.created_at)}</Td>
              <Td right>
                {po.status === "pending" && (
                  <button style={{ ...btnGhost, padding: "6px 12px" }} onClick={() => startReceive(po)}>
                    Receive
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {receiving && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} role="dialog" aria-modal>
          <div style={{ ...cardStyle, width: 460, maxWidth: "92vw" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>⚠️ Confirm goods receipt — {receiving.po.po_id}</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>From {receiving.po.supplier}. Stock will change:</p>
            <Table head={["Product", "Current", "New"]}>
              {receiving.preview.items.map((i) => (
                <tr key={i.product}>
                  <Td>{i.product}</Td>
                  <Td right>{i.current_stock}</Td>
                  <Td right><Badge tone="ok">{i.new_stock}</Badge></Td>
                </tr>
              ))}
            </Table>
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setReceiving(null)}>Cancel</button>
              <button style={btnPrimary} disabled={busy} onClick={confirmReceive}>Confirm receive</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
