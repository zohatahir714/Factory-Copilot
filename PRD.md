# Product Requirements Document
## PakERP Cloud Suite — AI-Native ERP & Statutory FBR Tax Engine

**Version:** 3.0.0 — Production (reflects the deployed build)
**Platform:** React 19 + Vite · Supabase PostgreSQL 17 · Groq (server-side) · Vercel
**Event:** PakAngels / Aspire Pakistan — GenAI & Agentic AI Hackathon
**Live system:** https://factory-copilot-r6xy.vercel.app

---

## 1. Executive Summary

PakERP Cloud Suite is an AI-native enterprise resource planning platform for
Pakistani textile and manufacturing SMEs. It unifies double-entry accounting,
multi-tier inventory, procurement, and sales invoicing with statutory FBR tax
automation — then puts the whole factory under natural-language control
through a governed multi-agent copilot with voice input (Urdu / Roman Urdu /
English) and a **grounded statutory RAG engine** that cites the exact section
of law behind every tax answer and **refuses to answer when confidence is
below threshold**.

Every claim in this document reflects the shipped production build, not a
roadmap. Section 11 lists the end-to-end verifications performed against the
live deployment.

## 2. Problem Statement

| Friction | PakERP answer |
|---|---|
| Legacy ERPs (SAP/Oracle) are rigid and cost-prohibitive for SMEs | Cloud-native suite deployable in minutes on Vercel + Supabase free tiers |
| FBR compliance is manual: Annexure-C, 18% GST, §153 withholding, filing calendar | Statutory rules encoded in software; RAG answers cite the governing section |
| Keyboard-heavy desktop ERPs on the factory floor | Voice copilot: *"Yarn ka stock kitna hai?"* → spoken, grounded answer |
| AI tools hallucinate tax figures — dangerous in compliance | Retrieval-gated RAG with citations and a hard refusal path below the confidence floor |
| Connectivity drops halt operations | Local-first persistence (browser storage) with cloud sync to Supabase |

## 3. System Architecture

```text
┌──────────────────────────── CLIENT (React 19 + Vite SPA) ────────────────────────────┐
│  Executive Dashboard   General Ledger    Inventory      Procurement    Sales         │
│  Cashbook              FBR Tax Hub       Compliance/RAG  AI Copilot    Voice Modal   │
│  Settings & RBAC       Database Inspector                                              │
└──────────────┬───────────────────────────────────────────┬───────────────────────────┘
               │ same-origin fetch (no third-party calls)  │ @supabase/supabase-js
               ▼                                           ▼
┌── SERVERLESS AI TIER (Vercel functions) ──────────┐  ┌── DATA TIER (Supabase PG 17) ──┐
│  /api/groq/chat        model allowlist + caps     │  │  11 tables, RLS on every one   │
│  /api/groq/transcribe  Whisper large-v3, 20MB cap │  │  authenticated-only policies   │
│  /api/groq/status      health probe (key-blind)   │  │  anon: read = ∅, write = deny  │
│  GROQ_API_KEY lives ONLY here                     │  └────────────────────────────────┘
└───────────────────────────────────────────────────┘
```

**Key design decision:** all model traffic is same-origin. The browser bundle
was scanned post-build and contains **zero** occurrences of `gsk_` key
material, `process.env`, or direct `api.groq.com` calls.

## 4. Functional Modules

| # | Module | Shipped capability |
|---|--------|--------------------|
| 1 | **Executive Dashboard** | KPIs computed live from the ledger (revenue, expenses, GST liability, receivables, liquidity), 6-month trend chart, low-stock alerts, honest empty states — no mock numbers |
| 2 | **General Ledger** | 22-account five-tier COA, voucher engine (journal / cash / bank, receipts & payments), strict debit=credit validation enforced at posting, trial balance, P&L, GL with opening/closing balances |
| 3 | **FBR Tax Hub** | 18% GST per invoice line, §153 withholding (4.5% ATL / 9% non-ATL), Annexure-C data generation, FBR invoice QR payload, statutory filing calendar (10th / 15th / 18th) |
| 4 | **Inventory** | Multi-unit SKUs (bags, cones, kg, liters, meters), reorder thresholds, weighted-average valuation, zero-stock-until-receipt rule, stock audit trail referencing the PO / invoice behind every movement |
| 5 | **Procurement** | Supplier directory (NTN, STRN, filer status, credit terms), PO lifecycle (Draft → Approved → Partially Received → Completed / Cancelled), goods receipt increments stock and liabilities |
| 6 | **Sales** | Customer directory with credit limits, multi-item invoices, GST + withholding computation with statutory citation attached, receivables aging, automatic stock decrement on dispatch |
| 7 | **Cashbook** | Daily cash/bank register, categorized vouchers (utilities, fuel, wages, freight, maintenance), print-ready voucher format, live treasury totals |
| 8 | **AI Copilot** | Multi-agent supervisor (see §6) with human-in-the-loop confirmation on high-risk actions |
| 9 | **Compliance RAG** | Grounded statutory Q&A with citations and confidence gating (see §5) |
| 10 | **Voice** | Whisper large-v3 STT + browser TTS (see §7) |
| 11 | **Settings & RBAC** | Five roles (Super Admin, Admin, Head Accountant, Factory Supervisor, Tax Auditor — read-only), branding persistence, user provisioning, Super-Admin-gated database configuration |

**Cross-module integrity:** every business action writes through one ledger.
PO receipt creates a payable; dispatch decrements stock and creates a
receivable plus tax liability; a cash receipt clears the receivable and moves
the treasury. Unbalanced vouchers are structurally impossible.

## 5. Statutory RAG Engine (deep dive)

**Design goal:** the model may explain the law, but it may never *source* the
law. Answers are composed from retrieved statutory text with citations, and
the system refuses rather than guesses.

### 5.1 Knowledge corpus

Four indexed statutory sources:

1. Sales Tax Act 1990 — Section 3 & Schedule III (18% standard rate)
2. Income Tax Ordinance 2001 — Section 153 withholding rates (ATL 4.5% / non-ATL 9%)
3. FBR statutory filing calendar & annexure guidelines
4. S.R.O. 345(I)/2024 — textile sector zero-rating

### 5.2 Pipeline

```text
corpus → parse (title/meta/body) → ~300-word chunks on paragraph boundaries
      → index → query time:
          query → lexical retrieval (overlap scoring + stoplist,
                  trigram similarity where pg_trgm is available)
                → confidence scoring
                ├── ≥ gate: compose answer FROM chunks → citation card
                │           {section, rate, effective date, confidence}
                └── < gate: structured refusal — no rate, no deadline invented
```

**Why lexical retrieval:** the Groq platform provides no embeddings endpoint,
so the retrieval layer is deterministic and auditable by design — every answer
can be traced to the exact chunks that produced it. The retrieval step sits
behind a single interface, so an embedding-backed hybrid (pgvector + lexical)
can replace it without touching the confidence-gating pipeline (§13).

### 5.3 Observed behavior (live)

Query — *"What withholding rate applies to supplies of goods for a non-ATL
filer?"* → answer cites **Section 153(1)(a)**, surfaces **4.5% ATL / 9%
non-ATL**, and carries a confidence score with the source document's
effective date.

## 6. Multi-Agent Supervisor

A deterministic supervisor engine routes each user request to one of four
sub-agents — **Inventory**, **Purchase**, **Accounting**, **Compliance** —
each backed by the live application state, so answers reflect real stock,
real vouchers, and real receivables rather than the model's imagination.

- **LLM augmentation, optional by design:** when the server-side key is
  configured, responses are polished by `openai/gpt-oss-120b` through the
  proxy; without it, the deterministic engine still answers completely
  (verified in production).
- **Human-in-the-loop:** high-risk actions (creating POs, logging expenses,
  booking sales) return a structured proposal and require explicit
  confirmation in a modal before any state is written.
- **Model resilience:** the proxy maintains a model catalog with aliasing of
  legacy slugs, so provider-side model rotations never break saved settings.

## 7. Voice Integration

```text
mic capture (browser) ──multipart upload──▶ /api/groq/transcribe
     │                                        │ stream body (20MB cap)
     │                                        │ MIME allowlist
     │                                        │ manual multipart parse
     │                                        ▼
     │                                 Groq Whisper large-v3
     │                                        │ {text}
     ▼                                        ▼
deterministic agent ◀── transcript routed to supervisor ◀──┘
     │
     └── answer ──▶ SpeechSynthesis (TTS, browser-local, no network)
```

- **Languages:** English, Urdu, Roman Urdu (Whisper multilingual + domain
  prompt seeded with manufacturing and FBR vocabulary).
- **Hardening shipped:** POST-only, 20MB streaming cap, MIME allowlist,
  server-controlled model (client cannot choose), extension-correct upstream
  filenames, sanitized errors.
- **Verified end-to-end** in production with a real WAV upload.
- TTS runs entirely in the browser via the Web Speech API — no key, no call.

## 8. Security & Compliance Model

| Control | Implementation | Verified |
|---|---|---|
| Server-side keys | `GROQ_API_KEY` exists only in Vercel env vars; three proxies are the sole consumers | ✅ bundle scan: 0 key patterns |
| Chat abuse guard | Model allowlist + legacy aliasing, 64KB body cap, ≤24 messages, per-message and total length caps | ✅ |
| Voice abuse guard | 20MB streaming cap, MIME allowlist, fixed model | ✅ |
| Status probe | Reports health and model count, never the key | ✅ |
| Database | RLS enabled on all 11 tables; policies grant **authenticated only**; anonymous read and write verified denied (`42501`); `SECURITY DEFINER` helper revoked from public roles; security advisor: **0 findings** | ✅ live probes |
| RBAC | Five roles; database-configuration UI gated to Super Admin | ✅ |
| Error hygiene | Upstream errors sanitized before reaching the client; no stack traces, no key fragments | ✅ |

## 9. Data Model (Supabase PostgreSQL)

`organizations`, `profiles`, `chart_of_accounts`, `products`, `suppliers`,
`customers`, `purchase_orders`, `sales_orders`, `cashbook_entries`,
`inventory_movements`, `app_settings` — plus the statutory RAG chunk store.
Schema bootstrap: `supabase_schema.sql`.

**Persistence strategy:** local-first writes for offline resilience, cloud
sync to Supabase when connected — the app remains operational through
connectivity drops.

## 10. Deployment & Operations

- **Vercel:** SPA rewrites for deep links, serverless functions
  (`maxDuration` 60s transcribe / 30s chat), environment-driven config,
  production + preview targets. Git-linked auto-deploys.
- **Supabase:** project `nzqhxceszzxsttzlwxsj` (PostgreSQL 17), schema
  applied, RLS hardened, advisor-clean.
- **Local dev parity:** `npm run dev` boots an API emulator mirroring the
  three production endpoints, so on-prem behavior matches production.

## 11. Quality Evidence — end-to-end verifications performed

| Flow | Result on the live deployment |
|---|---|
| Supplier → Product → PO → Receive → stock 0→100 | ✅ stock, valuation, payables updated |
| Sale invoice 50 × 1,450 → GST math | ✅ 72,500 + 13,050 = **85,550** exact; receivables + tax liability updated; stock decremented; LOW STOCK boundary logic correct |
| Audit trail | ✅ +100 / −50 movements with PO and invoice references |
| Double-entry voucher | ✅ posting blocked on unbalanced rows; GL reflects posted voucher; dates persist correctly |
| RAG compliance query | ✅ §153(1)(a) citation, 4.5%/9%, confidence score |
| Copilot grounded answer | ✅ real stock figure with SKU and threshold warning |
| Whisper transcription | ✅ real audio upload through the production proxy |
| Anonymous DB probes (read & write) | ✅ hard `42501` policy denials |
| Client bundle key-exposure scan | ✅ zero key material |
| SPA deep links | ✅ HTTP 200 on arbitrary routes |

## 12. Success Metrics

- **Compliance accuracy:** every tax answer carries a statutory citation or a refusal — target 0 uncited tax claims
- **Loop integrity:** every business action balances the ledger — target 0 unbalanced postings
- **Latency:** AI responses < 1.2s through the proxy (observed ~200ms proxy overhead + upstream)
- **Resilience:** core flows remain operational offline via the local tier

## 13. Roadmap

1. Embedding-backed hybrid retrieval (pgvector + lexical) behind the existing retrieval interface
2. Organization-level tenancy in the UI (schema and policies already in place)
3. FBR Iris e-filing integration and POS QR scanning
4. Urdu-first voice UX with on-device wake word
5. Approval workflows for POs and vouchers per RBAC role
