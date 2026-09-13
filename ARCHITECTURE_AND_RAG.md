# AI Architecture & Statutory RAG System
## Technical Architecture & Agent Orchestration in PakERP Cloud Suite

---

## 1. System Architecture Overview

PakERP Cloud Suite is engineered with a multi-tier agentic architecture combining:
1. **Low-Latency Voice Ingestion:** Groq Whisper Large v3 STT.
2. **Multi-Agent Orchestrator:** Groq Llama-3.3 70B Versatile with bilingual natural language understanding (English & Roman Urdu).
3. **Statutory Tax RAG Engine:** Strict deterministic regulatory retrieval grounding AI tax recommendations in official Pakistan Federal Board of Revenue (FBR) legal statutes.
4. **Deterministic Business Tools:** Direct atomic mutations on double-entry accounting ledgers, FIFO inventory, and purchase orders.
5. **Dual-Tier Data Sync:** Real-time Supabase PostgreSQL with local-first offline resilience.

```text
                                  ┌─────────────────────────────┐
                                  │      User Voice Input       │
                                  │  (English / Roman Urdu)     │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │    Groq Whisper Large v3    │
                                  │   (Audio-to-Text Pipeline)  │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  AGENT SUPERVISOR ORCHESTRATOR                                  │
│                                (Groq Llama-3.3 70B Versatile)                                   │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │
                  ┌──────────────────────────────┼──────────────────────────────┐
                  │                              │                              │
                  ▼                              ▼                              ▼
   ┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
   │       INVENTORY AGENT        │ │        PURCHASE AGENT        │ │       ACCOUNTING AGENT       │
   │  • Stock inquiries           │ │  • PO Generation             │ │  • Sales & 18% GST Booking   │
   │  • Low-stock alerts          │ │  • 3-Way Matching            │ │  • Cashbook Disbursement     │
   │  • Reorder triggers          │ │  • Goods Receipt (GRN)       │ │  • Trial Balance Balancing   │
   └──────────────┬───────────────┘ └──────────────┬───────────────┘ └──────────────┬───────────────┘
                  │                              │                              │
                  └──────────────────────────────┼──────────────────────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │   COMPLIANCE RAG ENGINE     │
                                  │ • Income Tax Ord. Sec 153   │
                                  │ • Sales Tax Act 1990 Sec 3  │
                                  │ • SRO 345(I)/2024 (Textile) │
                                  │ • FBR Iris Filing Schedule  │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │  HUMAN CONFIRMATION MODAL   │
                                  │ (Guards Financial & Stock)  │
                                  └──────────────┬──────────────┘
                                                 │ Approved
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │  ATOMIC DB MUTATION ENGINE  │
                                  │  • Supabase Cloud Postgres  │
                                  │  • Web Speech Synthesizer   │
                                  └─────────────────────────────┘
```

---

## 2. Multi-Agent Routing & Entity Resolution

### 2.1 Intent Classification
Incoming natural language commands are parsed across five operational domains:
- `INVENTORY`: e.g., *"Check yarn balance"*, *"Cotton dye ka stock kitna hai"*.
- `PURCHASE`: e.g., *"Order 50 bags of cotton yarn from Indus Mills"*, *"Purchase order banao"*.
- `ACCOUNTING`: e.g., *"Record sale of 100 meters fabric to Crescent Textiles"*, *"Pay 15000 for electricity bill"*.
- `COMPLIANCE`: e.g., *"What is the withholding tax on supplies for filers?"*, *"FBR Annexure-C ki last date kya hai"*.
- `GENERAL`: e.g., *"Give me a business summary"*, *"Overall revenue status"*.

### 2.2 Deterministic Entity Resolution
Rather than allowing the LLM to hallucinate random identifiers, the Agent Supervisor performs fuzzy matching against active in-memory and database entities:
```typescript
// Dynamically resolves real products, suppliers, and customers present in database
const matchedProduct = availableProducts.find(p => 
  p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
);
const matchedSupplier = availableSuppliers.find(s =>
  s.name.toLowerCase().includes(term)
);
```

---

## 3. Statutory FBR Tax RAG Knowledge Retrieval System

To adhere strictly to regulatory compliance rules, the AI **never relies on raw LLM pre-training weights** for tax percentages or legal advice. Instead, all tax queries pass through the **Compliance RAG Retrieval Engine** (`src/lib/ragCompliance.ts`).

### 3.1 Indexed Statutory Knowledge Sources
1. **Income Tax Ordinance, 2001 (Section 153 — Payments for Goods & Services):**
   - Active Taxpayer List (ATL) Filers: **4.5%** deduction on supply of goods.
   - Non-Filers / Inactive: **9.0%** standard withholding penalty rate.
   - Filing Deadline: Monthly statement submitted by 15th of the subsequent month.
2. **Sales Tax Act, 1990 (Section 3 — Scope of Tax & Standard Rates):**
   - Standard General Sales Tax: **18.0%** across all domestic taxable supplies.
   - Filing Deadlines: Annexure-C (10th of month), Tax Payment (15th of month), Iris Electronic Return (18th of month).
3. **FBR S.R.O. 345(I)/2024 (Textile Sector Zero-Rating Exemption Rules):**
   - Domestic sales of yarn and fabric are strictly subject to standard 18% GST.
   - Only direct export consignments or certified Export Oriented Units (EOU) qualify for 0% zero-rating under electronic Annexure-H.

### 3.2 Structured RAG Query Result
Every compliance response provides:
- Exact legal document citation (e.g., *Income Tax Ordinance 2001, Section 153(1)(a)*).
- Applicable GST rate & withholding rate.
- Exact statutory filing deadline.
- Official regulatory explanation.
- Human verification flags and confidence score ($0.95 - 0.99$).

---

## 4. Voice Processing & TTS Synthesis Pipeline

1. **Audio Capture:** Captures high-definition audio via browser `MediaRecorder` API (WebM/Opus or WAV format).
2. **Groq Whisper Transcription:** Audio buffer is streamed to `https://api.groq.com/openai/v1/audio/transcriptions` with model `whisper-large-v3`, auto-detecting English and Urdu speech.
3. **Agent Action Execution:** Transcribed prompt is fed to `agentSupervisor.ts` to compute tool executions and RAG citations.
4. **Speech Output:** Synthesizes voice responses using the browser Web Speech Synthesis API (`window.speechSynthesis`) with optimized natural pacing.

---

## 5. Double-Entry Accounting Invariance Guarantee

Every financial transaction processed by the AI or user interface follows strict double-entry accounting equations:

$$\sum \text{Debits} = \sum \text{Credits}$$

### Automatic Journal Posting Matrix:

| Event | Debit Account | Credit Account | Tax / Secondary Entry |
| :--- | :--- | :--- | :--- |
| **Sales Dispatch (18% GST)** | `1020 - Accounts Receivable` | `4010 - Sales Revenue` | `2030 - Sales Tax Payable (18%)` |
| **Supplier PO Fulfillment** | `1040 - Raw Material Inventory` | `2010 - Accounts Payable` | `1050 - Input Tax Receivable` |
| **Petty Cash Expense** | `5010..5090 - Expense Account` | `1010 - Petty Cash` | N/A |
| **Customer Payment Received** | `1015 - Bank Clearing` | `1020 - Accounts Receivable` | `1060 - WHT Deducted at Source` |

---

## 6. Supabase Database Schema Entity Relationship

```text
  [ organizations ]
         │ 1:N
         ├───► [ profiles (Users & Roles) ]
         ├───► [ chart_of_accounts ]
         ├───► [ products (Raw & Finished Goods) ]
         ├───► [ suppliers ] ──1:N──► [ purchase_orders ]
         ├───► [ customers ] ──1:N──► [ invoices ] ──1:N──► [ invoice_items ]
         ├───► [ cashbook_entries ]
         └───► [ tax_filings (Annex-C & Annex-H) ]
```
