"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client-api";
import { PageHeader, Table, Td, Empty, ErrorNote, cardStyle, btnPrimary, inputStyle, Field } from "@/components/ui";

interface Supplier {
  id: string;
  name: string;
  city: string;
  phone?: string;
  lead_time_days: number;
}

/** Suppliers (PRD user story 6 support): master list + create. */
export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", phone: "", lead_time_days: "5" });

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ suppliers: Supplier[] }>("/api/suppliers");
      setItems(data.suppliers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/suppliers", {
        name: form.name,
        ...(form.city ? { city: form.city } : {}),
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.lead_time_days ? { lead_time_days: Number(form.lead_time_days) } : {}),
      });
      setShowForm(false);
      setForm({ name: "", city: "", phone: "", lead_time_days: "5" });
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
        title="Suppliers"
        subtitle="Vendor master — used by purchase orders and the Copilot"
        actions={<button style={btnPrimary} onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "+ New Supplier"}</button>}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {showForm && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Name *"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="City"><input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Lead time (days)"><input type="number" style={inputStyle} value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <button style={btnPrimary} disabled={busy || !form.name} onClick={submit}>Create supplier</button>
          </div>
        </section>
      )}
      {items.length === 0 && !error ? (
        <Empty>No suppliers yet.</Empty>
      ) : (
        <Table head={["Name", "City", "Phone", "Lead time"]}>
          {items.map((s) => (
            <tr key={s.id}>
              <Td>{s.name}</Td>
              <Td>{s.city || "—"}</Td>
              <Td>{s.phone ?? "—"}</Td>
              <Td right>{s.lead_time_days} days</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
