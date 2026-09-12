/**
 * Live E2E chat test — rehearses the PRD §36 demo flows against a running dev server.
 * Usage: BASE=http://localhost:3111 node tests/e2e-chat.mjs
 * Requires GROQ_API_KEY in the server's .env.local.
 */
const BASE = process.env.BASE ?? "http://localhost:3111";
const SID = `session_e2e_${Date.now().toString(36)}`;

async function chat(message) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: SID }),
  });
  if (!res.ok || !res.body) throw new Error(`chat HTTP ${res.status}`);

  const events = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try { events.push(JSON.parse(line.slice(5).trim())); } catch {}
      }
    }
  }
  return events;
}

const text = (events) =>
  events.filter((e) => e.type === "token").map((e) => e.text).join("").trim();

const firstOf = (events, type) => events.find((e) => e.type === type);

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures += 1;
};

async function confirm(actionId) {
  const res = await fetch(`${BASE}/api/tools/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action_id: actionId, action: "confirm" }),
  });
  return res.json();
}

/* Flow 1 — stock query (PRD Demo 1). Expected stock is read live from the
 * REST API so the test stays correct regardless of prior test mutations. */
console.log("\n=== Flow 1: stock query ===");
const stockRes = await fetch(`${BASE}/api/products/Cotton%20Yarn%2040s`);
const stockJson = await stockRes.json();
const expectedStock = stockJson?.data?.current_stock;
const e1 = await chat("Kitna cotton yarn bacha hai?");
const t1 = text(e1);
check("no error event", !firstOf(e1, "error"), firstOf(e1, "error")?.message ?? "");
check(
  "reply matches live stock",
  Number.isFinite(expectedStock) && t1.includes(String(expectedStock)),
  `expected ${expectedStock} — reply: ${t1.slice(0, 140)}`
);

/* Flow 2 — PO with confirmation card (PRD Demo 2 + §14 gate) */
console.log("\n=== Flow 2: PO -> confirmation card -> confirm ===");
const e2 = await chat("ColorChem se 100 kilo Reactive Dye Blue ka PO bana do");
const pending = firstOf(e2, "pending_action");
check("pending_action emitted", !!pending, pending ? pending.summary : text(e2).slice(0, 140));
if (pending) {
  const result = await confirm(pending.action_id);
  check("commit success", result.success === true, JSON.stringify(result.data ?? result.error));
  check("po_id assigned", typeof result.data?.po_id === "string", result.data?.po_id);
} else {
  failures += 1;
}

/* Flow 3 — business summary (PRD Demo 4) */
console.log("\n=== Flow 3: business summary ===");
const e3 = await chat("Aaj ka business summary do");
const t3 = text(e3);
check("no error event", !firstOf(e3, "error"), firstOf(e3, "error")?.message ?? "");
const toolData = e3.filter((e) => e.type === "tool_result" && e.response?.success)
  .map((e) => e.response?.data).find((d) => d && "sales_today" in d);
check("summary tool ran", !!toolData);
check("reply includes Rs. figure", /Rs\.\s?[\d,]+/.test(t3), t3.slice(0, 160));

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
