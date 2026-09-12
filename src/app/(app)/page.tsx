"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client-api";
import { money, shortDate, PageHeader, Table, Td, Badge, Empty, ErrorNote, cardStyle, btnPrimary } from "@/components/ui";

interface Summary {
  sales_today: number;
  cash_position: number;
  inventory_value: number;
  low_stock: { product: string; stock: number; unit: string; reorder_threshold: number }[];
  pending_pos: { po_id: string; supplier: string; total: number; created_at: string }[];
  outstanding_receivables: number;
  recommended_action: string;
}
interface Invoice {
  invoice_id: string;
  customer: string;
  total: number;
  payment_status: "paid" | "unpaid";
  created_at: string;
}

/** Dashboard (PRD §17.2): the owner's one-glance business position. */
export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiGet<Summary>("/api/dashboard"), apiGet<{ invoices: Invoice[] }>("/api/sales?limit=5")])
      .then(([s, sales]) => {
        setData(s);
        setInvoices(sales.invoices);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const kpi = (label: string, value: string, tone: "ok" | "warn" | "err" | "muted" = "muted", note?: string) => (
    <div style={cardStyle}>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {note && (
        <div style={{ marginTop: 8 }}>
          <Badge tone={tone}>{note}</Badge>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Today's position — every figure from the live database"
        actions={
          <Link href="/chat" style={{ textDecoration: "none" }}>
            <button style={btnPrimary}>💬 Ask the Copilot</button>
          </Link>
        }
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && <Empty>Loading business position…</Empty>}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {kpi("Today's Sales", money(data.sales_today))}
            {kpi("Cash Position", money(data.cash_position))}
            {kpi("Inventory Value", money(data.inventory_value))}
            {kpi("Outstanding Receivables", money(data.outstanding_receivables), data.outstanding_receivables > 0 ? "warn" : "ok", data.outstanding_receivables > 0 ? `${data.pending_pos.length} pending POs` : "clear")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>⚠️ Low Stock</h2>
              {data.low_stock.length === 0 ? (
                <Empty>All items above reorder threshold.</Empty>
              ) : (
                <Table head={["Product", "Stock", "Reorder at"]}>
                  {data.low_stock.map((l) => (
                    <tr key={l.product}>
                      <Td>{l.product}</Td>
                      <Td mono right>
                        <Badge tone="warn">{`${l.stock} ${l.unit}`}</Badge>
                      </Td>
                      <Td mono right>{l.reorder_threshold}</Td>
                    </tr>
                  ))}
                </Table>
              )}
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 0 }}>Recommended: {data.recommended_action}</p>
            </section>

            <section style={cardStyle}>
              <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>🧾 Pending Purchase Orders</h2>
              {data.pending_pos.length === 0 ? (
                <Empty>No pending POs.</Empty>
              ) : (
                <Table head={["PO", "Supplier", "Total", "Age"]}>
                  {data.pending_pos.map((p) => (
                    <tr key={p.po_id}>
                      <Td mono>{p.po_id}</Td>
                      <Td>{p.supplier}</Td>
                      <Td right><Money value={p.total} /></Td>
                      <Td>{shortDate(p.created_at)}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>
          </div>

          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 15 }}>Recent Invoices</h2>
            {invoices.length === 0 ? (
              <Empty>No sales recorded yet — record one from the Sales page or via the Copilot.</Empty>
            ) : (
              <Table head={["Invoice", "Customer", "Total", "Payment", "Date"]}>
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id}>
                    <Td mono>{inv.invoice_id}</Td>
                    <Td>{inv.customer}</Td>
                    <Td right><Money value={inv.total} /></Td>
                    <Td>
                      <Badge tone={inv.payment_status === "paid" ? "ok" : "warn"}>{inv.payment_status}</Badge>
                    </Td>
                    <Td>{shortDate(inv.created_at)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Money({ value }: { value: number }) {
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(value)}</span>;
}
