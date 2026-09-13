# Product Requirements Document (PRD)
## PakERP Cloud Suite — AI-Native Enterprise ERP & Statutory FBR Tax Engine

**Project Name:** PakERP Cloud Suite  
**Platform Version:** 3.0.0-Production  
**Target Environment:** Vercel (Edge SPA) + Supabase (PostgreSQL 16 with RLS) + Groq Cloud (Llama 3.3 70B & Whisper Large v3)  
**Hackathon Category:** AI Agents, Enterprise Full-Stack & Legal Tech / Fintech  
**Target Domain:** Manufacturing, Textile Mills, Supply Chain & Financial Compliance  

---

## 1. Executive Summary & Vision
PakERP Cloud Suite is a modern, AI-orchestrated Enterprise Resource Planning (ERP) platform built specifically to address the complex operational, procurement, multi-tier inventory, double-entry financial accounting, and statutory tax compliance needs of modern industrial manufacturers and textile enterprises in Pakistan and emerging markets.

By combining ultra-low-latency voice/text AI agents (powered by **Groq Llama-3.3 70B Versatile** and **Groq Whisper Large v3**) with a deterministic **Statutory FBR Tax RAG (Retrieval-Augmented Generation)** knowledge system, PakERP enables executives, accountants, and floor supervisors to manage multi-million rupee operations with natural language and zero compliance risk.

---

## 2. Key Problem Statement & Industry Friction
1. **Fragmented Legacy ERPs:** Existing industrial software (SAP/Oracle legacy on-premise) is excessively rigid, cost-prohibitive, and lacks localized tax logic.
2. **Complex Statutory Compliance:** The Federal Board of Revenue (FBR) requires strict adherence to monthly sales tax returns (Annexure-C), 18% standard GST, withholding tax regimes (Section 153 of Income Tax Ordinance 2001 for ATL/non-ATL filers), and FBR POS QR-code stamping.
3. **Manual Factory Floor Friction:** Mill supervisors and warehouse managers struggle with keyboard-heavy desktop ERPs to log goods receipts, check yarn stock, or approve Purchase Orders.
4. **Data Desynchronization & Inaccurate Audits:** Lack of dual-tier state resilience causes operational downtime during connectivity drops.

---

## 3. High-Level Architecture & Tech Stack

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER (React 19 + Vite)                  │
│   • Executive Dashboard   • Chart of Accounts (Double Entry)  • FBR Hub      │
│   • Inventory & FIFO      • Procurement & 3-Way Match         • Cashbook     │
│   • Voice Assistant Modal • Supervisor Copilot Chat           • DB Inspector │
└──────────────────────┬───────────────────────────────┬───────────────────────┘
                       │                               │
        ┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
        │       AI AGENT TIER         │ │      DATA PERSISTENCE       │
        │ • Groq Llama-3.3 70B Engine │ │ • Supabase Cloud PostgreSQL │
        │ • Groq Whisper Large v3 STT │ │ • Row Level Security (RLS)  │
        │ • FBR Statutory RAG Engine  │ │ • Enterprise Local Storage  │
        │ • Multi-Agent Supervisor    │ │ • Real-time DB Inspector    │
        │ • Human Confirmation Guard  │ │ • AES-256 State Backup/Sync │
        └─────────────────────────────┘ └─────────────────────────────┘
```

### Core Technology Choices:
- **Frontend Framework:** React 19, TypeScript 5.8+, Vite 6
- **Styling & Design System:** Tailwind CSS v4, Lucide React, Motion (framer-motion standard)
- **Data Visualization & Analytics:** Recharts, D3.js primitives, QRCode canvas rendering
- **Database & Storage:** Supabase Cloud (PostgreSQL 16), Supabase JS SDK v2, Browser LocalStorage Tier
- **AI Inference Engine:** Groq Cloud API (`llama-3.3-70b-versatile` & `whisper-large-v3`) with Google Gemini 2.5 Flash as secondary/fallback
- **Deployment Platform:** Vercel (Edge-optimized SPA with dynamic SPA rewrites) & GitHub CI/CD

---

## 4. Complete Functional Modules Breakdown

### Module 1: Executive Analytics & Dynamic KPI Dashboard
- **Real-Time KPIs:** Live total revenue, monthly expenses, net profit margins, gross profit, and active FBR sales tax liability calculated dynamically from active ledger transactions.
- **Monthly Financial Trends:** Multi-axis interactive visual charts showing 6-month comparative trajectory for revenue, disbursements, and statutory withholding deductions.
- **Inventory Alerts Banner:** Instant notifications for low-stock yarn, dyes, packaging materials, and spares reaching critical reorder levels.
- **Quick Action Bar:** Direct triggers for creating sales invoices, purchase orders, cash receipts, and launching the Voice Copilot.

### Module 2: General Ledger & Double-Entry Accounting
- **Chart of Accounts (COA):** Standard 5-tier accounting tree (Assets: 1000s, Liabilities: 2000s, Equity: 3000s, Revenue: 4000s, Expenses: 5000s).
- **Journal Entries Engine:** Strict balanced debit/credit validation before posting. Automatically records debits and credits for all sales dispatches, supplier settlements, and tax payments.
- **Real-Time Trial Balance & P&L:** Instant computation of gross and operating profit without batch processing delays.

### Module 3: Pakistan FBR Statutory Tax Automation
- **FBR Sales Tax Act 1990 Compliance:** Standard 18% Sales Tax auto-calculated per invoice line item with HS code classification.
- **Income Tax Ordinance 2001 (Section 153):** Automatic withholding calculation (4.5% for ATL active filers, 9.0% for non-filers on supplies of goods).
- **Annexure-C & Annexure-H Engine:** Automated generation of FBR-compliant e-filing data arrays (Buyer NTN/STRN, Document Type, Rate, Value of Sales, Sales Tax charged).
- **FBR QR Code Invoice Verification:** Cryptographic QR payload generation with FBR invoice number, supplier NTN, buyer NTN, total taxable amount, and verification timestamp.
- **FBR Tax Filing Calendar:** Statutory milestone tracker for 10th (Annex-C), 15th (Payment), and 18th (Iris e-Return).

### Module 4: Industrial Inventory & Warehouse Management
- **Textile & Industrial SKU Management:** Multi-unit tracking (Bags, Cones, Kilograms, Liters, Meters, Cartons).
- **Automated Valuation:** Real-time calculation of Weighted Average Cost and FIFO valuations.
- **Safety Stock Triggers:** Dynamic flags for raw materials that fall below reorder thresholds.

### Module 5: Procurement & Vendor Lifecycle
- **Purchase Order (PO) Management:** End-to-end status tracking (`Draft`, `Approved`, `Partially Received`, `Completed`, `Cancelled`).
- **3-Way Matching:** Cross-verification between PO line quantities, Goods Receipt Notes (GRN), and Supplier Invoices.
- **Supplier Directory:** Full tracking of NTN, STRN, filer status, credit terms, and cumulative procurement spend.

### Module 6: Sales Invoicing & Customer Accounts
- **Commercial Tax Invoicing:** Multi-item invoices with customizable payment terms (Net 15, Net 30, COD).
- **Customer Credit Management:** Real-time credit limits, aging balances, and outstanding payment tracking.
- **Export & Domestic Dispatches:** Supports zero-rated SRO 345 export invoices as well as 18% standard domestic textile sales.

### Module 7: Cashbook & Petty Cash Disbursement
- **Daily Cashbook Register:** Real-time tracking of cash-in-hand, bank deposits, and factory petty cash.
- **Voucher Classification:** Categorized expenditure tagging (Utilities, Fuel, Daily Wages, Freight, Maintenance).
- **Audit-Ready Receipts:** Instant generation and print-ready formatting of expense vouchers.

### Module 8: Multi-Agent AI Supervisor & Voice Copilot
- **Groq Llama-3.3 70B Multi-Agent Routing:** Routes user requests across 4 specialized sub-agents:
  1. *Inventory Agent:* Stock checks, low-stock alerts, reorder triggers.
  2. *Purchase Agent:* Automatic vendor PO creation and goods receipt processing.
  3. *Accounting Agent:* Sales recording, tax reconciliation, cashbook disbursements.
  4. *Compliance Agent:* FBR tax citation lookup and statutory deadline advisory.
- **Groq Whisper Large v3 Voice Input:** Real-time multilingual voice transcription supporting English, Urdu, and Roman Urdu.
- **Text-to-Speech (TTS):** Spoken auditory feedback via Web Speech API synthesizer.
- **Human-in-the-Loop Confirmation:** High-risk actions (creating POs, logging expenses, booking sales) present a structured confirmation modal before committing to state.

### Module 9: Statutory RAG Compliance Engine
- **Zero AI Hallucination Guard:** Direct retrieval from indexed FBR statutory legal sources:
  - *Document 1:* FBR Sales Tax Act 1990 — Section 3 & Schedule III.
  - *Document 2:* Income Tax Ordinance 2001 — Section 153 Withholding Rates.
  - *Document 3:* FBR Statutory Filing Calendar & Annexure Guidelines.
  - *Document 4:* S.R.O. 345(I)/2024 — Textile Sector Zero-Rating Regulations.
- **Confidence Scoring & Citations:** Every AI tax recommendation includes law reference, section, applicable rate, and confidence score.

### Module 10: Role-Based Access Control (RBAC) & Governance
- **Super Admin:** Full system control, Supabase cloud configuration, user provisioning and revocation.
- **Admin:** Operational governance across procurement, sales, and inventory.
- **Head Accountant:** Financial ledger posting, cashbook approval, tax return generation.
- **Factory Supervisor:** Inventory tracking, goods receipt notes, stock adjustments.
- **Tax Auditor:** Read-only access to invoices, ledger logs, and FBR tax reports.

### Module 11: Real-Time Database Inspector & Supabase Diagnostics
- **Live Database Inspector:** In-app inspection tool to view table row counts, live cloud sync status, and storage utilization.
- **Supabase Cloud Auto-Sync:** Bi-directional sync with Supabase PostgreSQL tables (`profiles`, `products`, `suppliers`, `customers`, `purchase_orders`, `invoices`, `cashbook_entries`).

---

## 5. Non-Functional & Operational Requirements
- **Performance:** Sub-300ms UI responsiveness; Groq AI inference response time under 1.2 seconds.
- **Reliability & Offline-First:** 100% operational in local mode when cloud network is offline with automatic synchronization upon reconnection.
- **Security & Privacy:** Supabase Row Level Security (RLS) enabled on all tables; API keys stored in client environment variables; zero leak of passwords in plain logs.
- **Accessibility:** High-contrast light/dark themes passing WCAG AA standards.
