"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/client-api";
import { money, dateTime, PageHeader, Table, Td, Badge, Empty, ErrorNote, cardStyle, btnPrimary, inputStyle, Field } from "@/components/ui";

interface Entry {
  id: string;
  type: "income" | "expense";
  amount: number;
  amount_display: string;
  category: string;
  description: string;
  created_at: string;
}
interface Ledger {
  balance_display: string;
  income_display: string;
  expense_display: string;
  entries: Entry[];
}

/** Cashbook (PRD user stories 16–18): position, ledger, expenses. */
export default function CashbookPage() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ amount: "", category: "utilities", description: "" });

  const load = useCallback(async () => {
    try {
      setLedger(await apiGet<Ledger>("/api/cashbook"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cashbook");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend("/api/cashbook", {
        amount: Number(form.amount),
        category: form.category,
        ...(form.description ? { description: form.description } : {}),
      });
      setShowForm(false);
      setForm({ amount: "", category: "utilities", description: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Expense failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Cashbook"
        subtitle="Cash in, cash out — the running position of the business"
        actions={<button style={btnPrimary} onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "+ Add Expense"}</button>}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {ledger && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div style={cardStyle}>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>Cash Position</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{ledger.balance_display}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>Total Income</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--ok)" }}>{ledger.income_display}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>Total Expenses</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "var(--err)" }}>{ledger.expense_display}</div>
          </div>
        </div>
      )}

      {showForm && (
        <section style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Amount (Rs.) *"><input type="number" min="0" step="any" style={inputStyle} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Category *">
              <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="utilities">Utilities</option>
                <option value="salaries">Salaries</option>
                <option value="rent">Rent</option>
                <option value="transport">Transport</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Description"><input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. electricity bill" /></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <button style={btnPrimary} disabled={busy || !form.amount} onClick={submit}>Record expense</button>
          </div>
        </section>
      )}

      {!ledger && !error ? (
        <Empty>Loading ledger…</Empty>
      ) : ledger && ledger.entries.length === 0 ? (
        <Empty>No cash entries yet.</Empty>
      ) : ledger ? (
        <Table head={["When", "Type", "Category", "Description", "Amount"]}>
          {ledger.entries.map((e) => (
            <tr key={e.id}>
              <Td>{dateTime(e.created_at)}</Td>
              <Td><Badge tone={e.type === "income" ? "ok" : "err"}>{e.type}</Badge></Td>
              <Td>{e.category}</Td>
              <Td>{e.description}</Td>
              <Td right><span style={{ color: e.type === "income" ? "var(--ok)" : "var(--err)", fontVariantNumeric: "tabular-nums" }}>{e.amount_display}</span></Td>
            </tr>
          ))}
        </Table>
      ) : null}
    </>
  );
}
