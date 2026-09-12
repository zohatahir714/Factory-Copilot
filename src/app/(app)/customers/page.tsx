"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client-api";
import { PageHeader, Table, Td, Empty, ErrorNote, cardStyle, btnPrimary, inputStyle, Field } from "@/components/ui";

interface Customer {
  id: string;
  name: string;
  city: string;
  phone?: string;
}

/** Customers (PRD user story 11 support): master list + create. */
export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", phone: "" });

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ customers: Customer[] }>("/api/customers");
      setItems(data.customers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customers");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/customers", {
        name: form.name,
        ...(form.city ? { city: form.city } : {}),
        ...(form.phone ? { phone: form.phone } : {}),
      });
      setShowForm(false);
      setForm({ name: "", city: "", phone: "" });
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
        title="Customers"
        subtitle="Buyer master — used by sales invoices and the Copilot"
        actions={<button style={btnPrimary} onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "+ New Customer"}</button>}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {showForm && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Name *"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="City"><input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <button style={btnPrimary} disabled={busy || !form.name} onClick={submit}>Create customer</button>
          </div>
        </section>
      )}
      {items.length === 0 && !error ? (
        <Empty>No customers yet.</Empty>
      ) : (
        <Table head={["Name", "City", "Phone"]}>
          {items.map((c) => (
            <tr key={c.id}>
              <Td>{c.name}</Td>
              <Td>{c.city || "—"}</Td>
              <Td>{c.phone ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
