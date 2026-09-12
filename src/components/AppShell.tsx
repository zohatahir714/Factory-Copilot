"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** App shell: sidebar + content area (PRD §17.1 layout, full-page screens). */

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/chat", label: "Copilot Chat", icon: "💬" },
  { href: "/products", label: "Products", icon: "📦" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: "🧾" },
  { href: "/sales", label: "Sales", icon: "₨" },
  { href: "/cashbook", label: "Cashbook", icon: "💰" },
  { href: "/suppliers", label: "Suppliers", icon: "🏭" },
  { href: "/customers", label: "Customers", icon: "👥" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      <aside
        style={{
          width: 220,
          borderRight: "1px solid var(--border)",
          background: "var(--panel)",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: "sticky",
          top: 0,
          height: "100dvh",
        }}
      >
        <div style={{ padding: "6px 8px 14px" }}>
          <strong style={{ fontSize: 15 }}>AI Business Copilot</strong>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>Demo Textiles</div>
        </div>
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 8,
                textDecoration: "none",
                color: active ? "var(--text)" : "var(--muted)",
                background: active ? "var(--panel-2)" : "transparent",
                fontWeight: active ? 600 : 400,
                fontSize: 14,
              }}
            >
              <span aria-hidden style={{ width: 18, textAlign: "center" }}>{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </aside>
      <main style={{ flex: 1, padding: "20px 24px", minWidth: 0 }}>{children}</main>
    </div>
  );
}
