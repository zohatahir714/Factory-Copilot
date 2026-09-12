"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceButton } from "@/components/VoiceButton";

/**
 * /chat — the Copilot screen (PRD §17.1). Streams /api/chat (SSE), renders
 * status, tokens, tool results and the §14 confirmation card. Voice input via
 * VoiceButton lands in the same pipeline — voice is just another input method.
 * The software screens (dashboard, products, POs…) live in the (app) group.
 */

interface PendingActionEvent {
  action_id: string;
  tool: string;
  summary: string;
  payload: unknown;
}

interface ToolResultEvent {
  tool: string;
  response: { success: boolean; data: unknown; error: { code: string; message: string; suggestions?: string[] } | null };
}

interface DisplayMessage {
  role: "user" | "assistant" | "system";
  text: string;
  pending?: PendingActionEvent;
  toolResult?: ToolResultEvent;
}

const QUICK_ACTIONS = [
  "Aaj ka business summary do",
  "Kitna cotton yarn bacha hai?",
  "Pending POs batao",
  "Cash position kya hai?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const sessionIdRef = useRef<string>("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionIdRef.current = `session_${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, statusLabel]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;

      setBusy(true);
      setInput("");
      setStatusLabel("Thinking…");
      setMessages((prev) => [...prev, { role: "user", text: message }]);

      let assistant = "";
      let sawAnyToken = false;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, session_id: sessionIdRef.current }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: { message: "Chat service unavailable" } }));
          throw new Error(err?.error?.message ?? "Chat service unavailable");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const flushEvent = (raw: string) => {
          if (!raw.startsWith("data:")) return;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(raw.slice(5).trim());
          } catch {
            return;
          }

          switch (event.type) {
            case "status":
              setStatusLabel(String(event.label ?? ""));
              break;
            case "token":
              assistant += String(event.text ?? "");
              sawAnyToken = true;
              setStatusLabel(null);
              upsertAssistant(assistant);
              break;
            case "tool_result":
              setMessages((prev) => [
                ...prev,
                { role: "system", text: "", toolResult: { tool: String(event.tool), response: event.response as ToolResultEvent["response"] } },
              ]);
              break;
            case "pending_action":
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  text: assistant || "Please confirm:",
                  pending: event as unknown as PendingActionEvent,
                },
              ]);
              assistant = "";
              sawAnyToken = false;
              break;
            case "error":
              setMessages((prev) => [...prev, { role: "system", text: String(event.message ?? "Something went wrong.") }]);
              setStatusLabel(null);
              break;
            case "done":
              setStatusLabel(null);
              if (!sawAnyToken) upsertAssistant(assistant);
              break;
          }
        };

        const upsertAssistant = (text: string) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant" && !last.pending) {
              next[next.length - 1] = { ...last, text };
            } else {
              next.push({ role: "assistant", text });
            }
            return next;
          });
        };

        // Read the SSE stream, split on double newlines.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            for (const line of part.split("\n")) flushEvent(line);
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `⚠️ ${err instanceof Error ? err.message : "Chat failed. Please retry."}` },
        ]);
      } finally {
        setBusy(false);
        setStatusLabel(null);
      }
    },
    [busy]
  );

  const resolvePending = useCallback(
    async (actionId: string, verb: "confirm" | "cancel") => {
      const res = await fetch("/api/tools/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId, action: verb }),
      });
      const json = await res.json();
      if (verb === "cancel") {
        setMessages((prev) => [...prev, { role: "system", text: "Cancelled — nothing was changed." }]);
        return;
      }
      if (json.success) {
        setMessages((prev) => [...prev, { role: "assistant", text: `✅ Done: ${describeResult(json.data)}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "system", text: `❌ ${json.error?.message ?? "Could not complete the action."}` }]);
      }
    },
    []
  );

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100dvh", maxWidth: 880, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
        <div>
          <strong>AI Business Copilot</strong>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Demo Textiles · Owner</div>
        </div>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>text · voice</span>
      </header>

      <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "16px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--muted)", marginTop: 40, textAlign: "center" }}>
            <p style={{ fontSize: 18 }}>Try: &ldquo;ColorChem se 100 kilo blue dye ka PO bana do&rdquo;</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
              {QUICK_ACTIONS.map((q) => (
                <button key={q} onClick={() => send(q)} style={chipStyle}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.text && <Bubble role={m.role} text={m.text} />}
            {m.toolResult && <ToolCard event={m.toolResult} />}
            {m.pending && <ConfirmCard pending={m.pending} onResolve={resolvePending} disabled={busy} />}
          </div>
        ))}

        {statusLabel && <div style={{ color: "var(--muted)", fontSize: 13 }}>⚙️ {statusLabel}</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Type your message… e.g. "kitna yarn bacha hai?"'
          style={{ flex: 1, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", outline: "none" }}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()} style={sendStyle}>
          Send
        </button>
        <VoiceButton onSend={(t) => send(t)} disabled={busy} />
      </form>
    </main>
  );
}

/* ------------------------------- components ------------------------------- */

function Bubble({ role, text }: { role: string; text: string }) {
  const isUser = role === "user";
  return (
    <div
      style={{
        maxWidth: "80%",
        whiteSpace: "pre-wrap",
        padding: "10px 14px",
        borderRadius: 14,
        background: isUser ? "var(--accent-strong)" : role === "system" ? "transparent" : "var(--panel-2)",
        border: role === "system" ? "1px dashed var(--border)" : "1px solid var(--border)",
        color: role === "system" ? "var(--muted)" : "var(--text)",
      }}
    >
      {text}
    </div>
  );
}

function ToolCard({ event }: { event: ToolResultEvent }) {
  const { response } = event;
  const rows = previewRows(event.tool, response.data);
  return (
    <div style={{ ...cardStyle, borderColor: response.success ? "var(--border)" : "var(--err)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
        🛠 {event.tool} · {response.success ? "ok" : response.error?.code}
      </div>
      {response.success ? (
        rows?.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: "3px 8px 3px 0", color: "var(--muted)" }}>{k}</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null
      ) : (
        <div>
          <div>❌ {response.error?.message}</div>
          {response.error?.suggestions?.length ? (
            <div style={{ color: "var(--muted)", marginTop: 4 }}>Did you mean: {response.error.suggestions.join(" · ")}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ConfirmCard({ pending, onResolve, disabled }: { pending: PendingActionEvent; onResolve: (id: string, verb: "confirm" | "cancel") => void; disabled: boolean }) {
  return (
    <div style={{ ...cardStyle, borderColor: "var(--warn)" }}>
      <div style={{ fontSize: 12, color: "var(--warn)", marginBottom: 6 }}>⚠️ Confirmation required</div>
      <div style={{ marginBottom: 10 }}>{pending.summary}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={disabled} onClick={() => onResolve(pending.action_id, "confirm")} style={{ ...btnStyle, background: "var(--ok)", borderColor: "var(--ok)", color: "#06281a" }}>
          Confirm
        </button>
        <button disabled={disabled} onClick={() => onResolve(pending.action_id, "cancel")} style={btnStyle}>
          Cancel
        </button>
        <span style={{ alignSelf: "center", color: "var(--muted)", fontSize: 12 }}>to edit, just type the correction</span>
      </div>
    </div>
  );
}

/* --------------------------------- helpers -------------------------------- */

function describeResult(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.po_id) return `${d.po_id} created (${d.total_display ?? d.total ?? ""})`;
    if (d.invoice_id) return `invoice ${d.invoice_id} recorded (${d.total_display ?? ""})`;
    if (d.entry_id) return `expense ${d.entry_id} recorded`;
    if (d.status === "received") return `goods received for ${d.po_id}`;
    if (d.name) return `${d.name} created`;
  }
  return "completed";
}

function previewRows(tool: string, data: unknown): [string, string][] | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  switch (tool) {
    case "check_inventory":
      return [
        ["Product", String(d.product)],
        ["Stock", `${d.current_stock} ${d.unit}`],
        ["Reorder at", String(d.reorder_threshold)],
        ["Status", d.low_stock_warning ? "⚠️ low" : "✅ ok"],
      ];
    case "get_cash_balance":
      return [["Cash", String(d.display)]];
    case "get_pending_orders": {
      const orders = Array.isArray(d.orders) ? (d.orders as Record<string, unknown>[]) : [];
      return orders.map((o, i) => [`#${i + 1}`, `${o.po_id} · ${o.supplier} · ${o.total}`]);
    }
    case "get_business_summary":
      return [
        ["Sales today", String(d.sales_today_display)],
        ["Cash", String(d.cash_display)],
        ["Pending POs", String(d.pending_po_count)],
        ["Receivables", String(d.receivables_display)],
        ["Low stock", Array.isArray(d.low_stock) && d.low_stock.length ? (d.low_stock as Record<string, unknown>[]).map((l) => `${l.product} (${l.stock} ${l.unit})`).join(", ") : "none"],
        ["Action", String(d.recommended_action)],
      ];
    case "generate_tax_report":
      return [
        ["Output tax", String(d.output_tax)],
        ["Input tax", String(d.input_tax)],
        ["Net payable", String(d.net_payable_display)],
      ];
    default:
      return null;
  }
}

/* ---------------------------------- styles -------------------------------- */

const cardStyle: React.CSSProperties = {
  maxWidth: "85%",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "10px 14px",
};

const chipStyle: React.CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 13,
};

const btnStyle: React.CSSProperties = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 8,
  padding: "6px 14px",
};

const sendStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
};
