# PakERP Cloud Suite — Submission PRD

**AI-Native ERP & Statutory FBR Tax Engine for Pakistani Manufacturing SMEs**

> Upload this document as the project brief. It is written for a judge who has
> never seen the codebase, so every claim below points at something that runs.

---

## 1. Executive summary

PakERP Cloud Suite is an operations platform for Pakistani textile and
industrial SMEs, built around an AI copilot that answers in **Urdu, Roman Urdu
and English**, by voice or text.

The copilot answers three questions a mill owner asks every day:

1. **"What do we have?"** — stock, cash, receivables, from live ledger rows.
2. **"What should we buy?"** — a reorder decision, after checking what is
   already in the store.
3. **"What does the law say?"** — FBR and provincial tax, citing the provision.

The differentiator is not that it uses AI. It is that **it refuses rather than
guesses**, because a wrong stock figure becomes a purchase order and a wrong tax
rate becomes a penalty.

---

## 2. The problem

A Faisalabad cloth mill runs on three things: a desktop accounting package, a
notebook for stock, and WhatsApp. Three failures follow, and all three are
expensive.

| Problem | Consequence |
|---|---|
| The books are re-read by one person | Duplicate invoicing; a supplier paid after the price moved |
| Knowledge lives in the owner's head | The business stops when he travels |
| Tax law is applied from memory | The wrong rate, discovered at filing time |

Existing ERPs do not close this. Enterprise ERPs cost more than a mid-size
mill's annual margin, and their tax modules still cannot answer *"what rate
applies to **this** invoice?"* They are also English-only, while the operator
speaks Urdu.

### Our thesis

> Put an AI copilot in front of a **strictly deterministic** ERP.
> The AI decides *which* capability answers. It never decides a number.

---

## 3. What we built

### 3.1 The core modules (12)

Executive Dashboard · AI Copilot Terminal · Inventory & Materials · Purchase
Orders · Suppliers & Vendors · Stock Audit Trail · Sales & GST · Customers &
Mills · Cashbook & Vouchers · Reports & Financials · FBR Compliance RAG · FBR
Digital Invoicing.

Every module is reachable from the sidebar **or** by asking the copilot in
plain language.

### 3.2 The AI capability surface (14 skills, 5 submission flags)

The submission rule requires **2 skills minimum. We demonstrate 5.**

| Capability | Skill | What a judge will see |
|---|---|---|
| **Agentic AI** | Reorder Forecast | An agent proposes a purchase order on its own, from a moving average of dispatch history, with nobody asking |
| **AI Workflows** | Ledger Reader, Stock Sufficiency, Purchase Desk, Accounting Books, Master Registry, Screen Control, Document Print | Voice → purchase order → goods receipt → stock → balanced journal, chained |
| **Generative AI** | Compliance RAG | Answers with the document and section cited, and **refuses** when nothing matches |
| **Multi-Agent Systems** | Negotiation Room | A buyer agent and a supplier agent converge on a price across logged rounds |
| **AI-powered BPA** | Anomaly Watch, Material Variance, FBR Payload Builder | Invoices that violate a rule are flagged automatically, with the rule that fired |

Each skill names **the file that implements it**, and a test asserts that file
exists. A skill label the product does not honour cannot survive the suite.

### 3.3 The four decisions we would defend in a judging room

**① The AI cannot write.**
The resolver may choose one of 19 registered tools and fill their parameters.
It cannot compute a value, invent an entity, or reach the ledger. Every write
lands on a confirmation card that a human approves. This is a hard project rule
and it is enforced in code, not in policy.

**② Stock is checked before a purchase is offered.**
"Buy 200 kg yarn" on a mill holding 1,450 kg of yarn used to open a
confirmation card saying nothing about the stock in the store. Now it says:

> **Stock check: Cotton Yarn 150D already at 1,450 kg, which covers the 200 kg
> you asked to buy. Ordering anyway?**

Ordering anyway remains the user's decision. Making the decision without being
told was the bug.

**③ The RAG refuses, and that is the feature.**
Eight statute chunks, lexical retrieval with trigram overlap scoring, an Urdu
glossary, and a **0.60 confidence gate**. Below it, the system says *"no
provision covers that"* and names the nearest source. Asked *"best bowling
attack in Pakistan cricket"*, it refuses. The previous implementation returned
a confident 18% for anything.

**④ Material loss is reported as a variance, never as a measurement.**
We reconcile material *received* against material *issued to production*. A
roll that tore on a loom is invisible to the ledger. The answer carries its own
caveat in the last line: *"Stock variance (received − issued to production),
not a weighed physical loss — the ledger records no shop-floor waste."*

---

## 4. How the AI layer is structured

```
src/ai/              the answer layer — pure functions, no writes
  stock/             sufficiency + the pre-purchase guard
  loss/              material variance + its caveat
  software/          the app's own map, so questions about the app answer

src/lib/ai/          the understanding layer — picks a tool, never a number
  contract.ts        closed 19-tool schema, confidence gate
  offlineResolver    ships by default, no API key, word-order independent
  liveResolver       Groq, server-held key, same schema
  misses.ts          the misses log and the learned-phrase bank

src/agents/skills.ts the registry every layer is checked against
src/lib/agentSupervisor.ts   the single command interpreter
```

**The rule:** a capability is real only if a module, a skill and a route all
exist. `aiLayer.test.ts` reads the folder and fails if any module is
unreachable, or if a skill names a file that is not there.

### Teaching: the fix for "I have to tell you each time"

Every utterance the deterministic rules cannot place is logged. **Settings →
Teaching** lists them; binding one to a capability makes it work immediately —
offline, on that machine, with no build and no commit.

This matters because the supervisor's rules were exact clauses in a fixed
order: *"pending goods receive karo"* worked and *"receive pending goods"* did
not. Same words, opposite outcome. No amount of hand-wiring fixes word order.
The resolver is word-order independent, and the teaching bank closes the last
gap without a code change.

---

## 5. RAG architecture

```
        ┌──────────────── VOICE ─────────────────┐
        │ MediaRecorder · Urdu/English/Roman Urdu│
        └───────────────────┬────────────────────┘
                            ▼
        ┌──────────────────────────────────────────┐
        │      AGENT SUPERVISOR (deterministic)   │
        │   intent + domain router · 19 tools     │
        └──┬──────────────┬───────────────┬───────┘
           │              │               │
   ┌───────▼──────┐ ┌─────▼──────┐ ┌──────▼──────────┐
   │ LEDGER       │ │ GROUNDED   │ │ RESOLVER        │
   │ live rows    │ │ RAG        │ │ offline → Groq  │
   │ businessTools│ │ 8 chunks   │ │ (misses only)   │
   └───────┬──────┘ │ ★ refuse   │ └──────┬──────────┘
           │        │   < 0.60   │        │
           │        └─────┬──────┘        │
           │              ▼               │
           │   ┌────────────────────┐     │
           │   │ Cite document &    │     │
           │   │ section, or refuse │     │
           │   └────────────────────┘     │
           ▼                              ▼
   ┌────────────────────────────────────────────────┐
   │      CONFIRMATION CARD — human-in-the-loop     │
   │      No silent writes. Ever.                   │
   └──────────────────────┬─────────────────────────┘
                          ▼
                  LEDGER (Supabase, RLS)
```

### The retrieval pipeline

| Stage | Implementation |
|---|---|
| Normalise | lowercase, strip punctuation, stoplist |
| Urdu glossing | `ٹیکس` → `tax`, so a Roman-Urdu question reaches the same chunk |
| Retrieval | field-weighted lexical + trigram overlap over 8 chunks |
| Scoring | authority weighting, term coverage, document match |
| **Gate** | `RAG_CONFIDENCE_GATE = 0.60` — below it, **refuse** |
| Compose | quote the provision; never paraphrase a rate |

**Corpus:** 8 statute chunks, each carrying the instrument and section verbatim
as its citation — for example *"Income Tax Ordinance 2001, Fourth Schedule,
Part III, Section 153(1)(a)"*, *"Sales Tax Act 1990, Section 3(1)"* and
*"S.R.O. 345(I)/2024 …"*. Each chunk also links to the indexed source entry it
came from, so a citation is a real pointer and not a generated string.

---

## 6. Technical architecture

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Recharts |
| Voice | Groq Whisper large-v3 (STT), browser `SpeechSynthesis` (TTS) |
| LLM | Groq `gpt-oss-120b`, **server-held key** |
| API | Express proxy on `:3001`; Vercel serverless in production |
| Data | Supabase PostgreSQL with Row Level Security |
| Tests | `node:test` + `tsx` — **398 tests, 0 failing** |

**Codebase:** 107 TypeScript files · ~33,600 lines · 19 test files.

### Security posture

- `GROQ_API_KEY` is read **only** in the server process. It is never sent to the
  browser and cannot appear in DevTools, localStorage or network traffic.
- `.env` and `dist/` are git-ignored; no key is committed.
- Supabase uses **Row Level Security**, not application-level filtering.
- Browser-side calls are capped by a model allowlist and payload-size limits.

---

## 7. Demo script — 6 minutes

1. **Dashboard (30s).** Six KPI tiles. Card 06 lists the registered AI skills.
   The collapsed banner reads *"1 agent proposal awaiting your approval —
   nothing is written until you approve."*
2. **The refusal (45s).** Ask *"kaun sa material loss me tha"* → answer with
   variance, supplier names, and the caveat line.
3. **The gate (45s).** *"Section 153 ka rate?"* → cited provision. Then
   *"credit card pe tax lagta hai?"* → **refusal.** *(This is the moment.)*
4. **The stock guard (60s).** *"create a purchase order for 200 kg cotton yarn
   from Green Mills Ltd"* → the confirmation card opens **with** the stock check.
5. **The autonomous agent (60s).** The approval queue holds an agent's own
   proposal: INV-DEMO-1001 outstanding 52 days. Approve or reject it — the
   ledger changes only on approval.
6. **Teaching (60s).** Type a command nobody wired — say *"customer save karo"*
   → the copilot asks for the name it needs. Then Settings → Teaching shows it
   logged; bind it once; ask again. It works. **No rebuild.**

---

## 8. Limitations — stated before a judge finds them

| # | Limitation | Status |
|---|---|---|
| 1 | **We are not a licensed FBR integrator.** | Pakistani law reserves transmission to a licensed integrator. We produce a **schema-valid payload for your integrator**. We do not file with FBR. |
| 2 | Material variance ≠ weighed physical loss | Needs batch-level weight capture (planned) |
| 3 | RLS migration must be applied manually | Paste into Supabase SQL Editor |
| 4 | Timestamp-based IDs can collide | Duplicate-key risk on cloud sync |
| 5 | Live LLM route untested at venue scale | Every route degrades to the offline resolver |
| 6 | Credit limit is recorded, not enforced | Nothing blocks an invoice exceeding it |
| 7 | Demo seed is modest | 6 SKUs · 4 suppliers · 3 customers |

---

## 9. What is next

1. Batch-level weight reconciliation → measured loss, not a difference of two numbers
2. Credit-check enforcement at invoice time
3. Synced teaching bank, so a phrase taught once follows the repo
4. Streaming speech-to-text
5. Multi-mill tenancy (a group with two plants)
6. Seasonality-aware demand forecasting

---

## 10. Repository

- **Live demo:** https://factory-copilot-r6xy.vercel.app
- **README** (architecture, run instructions, screenshots): [README.md](./README.md)
- **Tests:** `npm test` → 398 passing
- **License:** MIT

---

*Built by the PakERP team. Every number in this document is computed from the
codebase at the time of writing; none is illustrative.*