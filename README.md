<div align="center">

# PakERP Cloud Suite

**AI-Native ERP & Statutory FBR Tax Engine for Pakistani Manufacturing SMEs**

React 19 · Vite · TypeScript · Supabase PostgreSQL · Groq (server-side) · Vercel

</div>

---

## Overview

PakERP Cloud Suite is an enterprise operations platform built for textile and
industrial SMEs in Pakistan. It combines double-entry accounting, multi-tier
inventory, procurement, and sales with an AI copilot and a grounded statutory
RAG engine covering FBR sales tax, withholding rules, and filing calendars.

**Live demo:** https://factory-copilot-r6xy.vercel.app

## Highlights

- **Double-entry General Ledger** — Chart of Accounts, balanced vouchers, trial balance, P&L
- **Procurement & Inventory** — POs, goods receipts, weighted-average valuation, low-stock triggers
- **FBR Tax Automation** — 18% GST line items, Section 153 withholding (ATL 4.5% / non-ATL 9%), invoice QR payloads
- **Statutory RAG Engine** — answers cite Sales Tax Act 1990, ITO 2001 §153, SRO 345(I)/2024 with confidence scores; refuses below threshold instead of hallucinating
- **AI Copilot** — multi-agent supervisor (Inventory / Purchase / Accounting / Compliance) over Groq, **key stays server-side** behind `/api/groq/*` proxies
- **Voice** — Groq Whisper Large v3 transcription, English / Urdu / Roman Urdu
- **RBAC** — Super Admin, Admin, Head Accountant, Factory Supervisor, Tax Auditor

## Security Model

- API keys live **only** in server environment variables; the browser bundle
  contains no key material (verified: no `gsk_*`, no `process.env` in client JS)
- All Groq traffic flows through three hardened serverless endpoints:
  `/api/groq/chat`, `/api/groq/transcribe`, `/api/groq/status`
- Supabase Row Level Security on every table — anonymous requests can neither
  read nor write; `SECURITY DEFINER` helpers are revoked from public roles

## Run Locally

```bash
npm install
```

Create `.env.local` (never committed):

```ini
GROQ_API_KEY=gsk_your_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_key
```

```bash
npm run dev
```

The dev script starts a local API emulator on `:3001` (mirroring the Vercel
serverless functions) plus Vite on `:3000`.

## Deploy to Vercel

1. Import the repo → Framework preset **Vite**, build `npm run build`, output `dist`
2. Environment variables (Production + Preview):
   - `GROQ_API_KEY` — server-side only, never `VITE_`-prefixed
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Apply `supabase_schema.sql` in the Supabase SQL Editor

## Project Structure

```
api/groq/          Serverless proxies (chat · transcribe · status)
src/components/    Feature modules & UI
src/context/       App state (auth, data, AI settings)
src/lib/           Groq client, agent supervisor, RAG engine
supabase_schema.sql  Tables + RLS bootstrap
```

## Team

Built for the PakAngels / Aspire Pakistan GenAI & Agentic AI Hackathon.
