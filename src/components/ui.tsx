"use client";

import type { ReactNode } from "react";
import { money, shortDate, dateTime } from "@/lib/format";

/** Shared UI kit — one visual language across the software screens (PRD §17.3). */

export const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontWeight: 600,
};

export const btnGhost: React.CSSProperties = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "10px 16px",
};

export const inputStyle: React.CSSProperties = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "var(--text)",
  outline: "none",
  width: "100%",
};

export const cardStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
};

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        {subtitle && <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </header>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--muted)", fontWeight: 500, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, mono, right }: { children: ReactNode; mono?: boolean; right?: boolean }) {
  return (
    <td style={{ padding: "10px", borderBottom: "1px solid var(--border)", textAlign: right ? "right" : "left", whiteSpace: mono || right ? "nowrap" : undefined, fontVariantNumeric: mono ? "tabular-nums" : undefined }}>
      {children}
    </td>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "err" | "muted"; children: ReactNode }) {
  const map = {
    ok: { color: "var(--ok)", bg: "rgba(62,207,142,.12)" },
    warn: { color: "var(--warn)", bg: "rgba(245,166,35,.12)" },
    err: { color: "var(--err)", bg: "rgba(239,68,68,.12)" },
    muted: { color: "var(--muted)", bg: "var(--panel-2)" },
  } as const;
  const t = map[tone];
  return <span style={{ color: t.color, background: t.bg, padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{children}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      {children}
      {hint && <span style={{ color: "var(--muted)", fontSize: 12 }}>{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ color: "var(--muted)", padding: "24px 0", textAlign: "center", fontSize: 14 }}>{children}</div>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div style={{ color: "var(--err)", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", padding: "10px 14px", borderRadius: 10, fontSize: 14 }}>{children}</div>;
}

export function Money({ value }: { value: number }) {
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(value)}</span>;
}

export { money, shortDate, dateTime };
