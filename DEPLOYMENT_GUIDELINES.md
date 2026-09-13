# Deployment & Production Guidelines
## Deploying PakERP Cloud Suite on Vercel, Supabase & GitHub

This guide provides end-to-end instructions for deploying **PakERP Cloud Suite** to **Vercel** with **Supabase PostgreSQL** and **Groq Cloud AI**.

---

## 1. Prerequisites
Before beginning the deployment, ensure you have the following accounts:
1. **GitHub Account** (for version control and automated CI/CD)
2. **Vercel Account** (for edge frontend hosting + serverless API functions)
3. **Supabase Account** (for hosted PostgreSQL database and authentication)
4. **Groq Cloud Console Account** (for ultra-fast Llama-3.3 70B & Whisper large-v3 API keys at [console.groq.com](https://console.groq.com))
5. **Node.js 18+** and **npm** or **bun** installed locally

---

## 2. Security Model: Server-Side API Keys (PRD §40)

> **The Groq API key never reaches the browser.**

All Groq inference runs through same-origin serverless functions:

| Endpoint | Purpose | Upstream |
| :--- | :--- | :--- |
| `POST /api/groq/chat` | Llama-3.3 70B chat completions (Agent Supervisor) | `api.groq.com/openai/v1/chat/completions` |
| `POST /api/groq/transcribe` | Whisper large-v3 STT (Urdu & English voice) | `api.groq.com/openai/v1/audio/transcriptions` |
| `GET /api/groq/status` | Connection health check (reports model availability, never the key) | `api.groq.com/openai/v1/models` |

The functions enforce a model allowlist, payload size caps (64KB JSON / 20MB audio), message-count limits, and sanitized error responses. The key lives **only** in the `GROQ_API_KEY` environment variable — it cannot be found in DevTools, localStorage, or the JS bundle, and `vite.config.ts` no longer inlines any secret into the client build.

---

## 3. Supabase Cloud Database Provisioning

### Step 3.1: Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and click **"New Project"**.
2. Set your Project Name (e.g., `pakerp-production`), select your preferred Region (e.g., `Singapore` or `Frankfurt`), and set a strong database password.
3. Wait ~2 minutes for the database instance to provision.

### Step 3.2: Execute the Production PostgreSQL Schema
1. In your Supabase Project dashboard, navigate to the **SQL Editor** tab on the left sidebar.
2. Click **"New Query"**.
3. Open the file `supabase_schema.sql` from this repository, copy its entire contents, paste it into the Supabase SQL editor, and click **"Run"**.
4. Verify that the following 12 tables are created under **Table Editor**:
   - `organizations`
   - `profiles`
   - `chart_of_accounts`
   - `products`
   - `suppliers`
   - `customers`
   - `purchase_orders`
   - `invoices`
   - `invoice_items`
   - `cashbook_entries`
   - `tax_filings`
   - `compliance_sources`

### Step 3.3: Retrieve Supabase API Keys
1. Go to **Project Settings -> API**.
2. Copy the following values:
   - **Project URL:** `https://<your-project-ref>.supabase.co`
   - **anon / public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 4. Groq Cloud AI Setup (Llama 3.3 70B & Whisper)

1. Navigate to [console.groq.com/keys](https://console.groq.com/keys).
2. Click **"Create API Key"** and name it `pakerp-groq-key`.
3. Copy the secret key (starts with `gsk_...`).
4. **Do not** put it in any client-side config — it goes only into the environment variable configured below.

---

## 5. Local Development & Verification

### Step 5.1: Clone and Configure Environment
```bash
git clone https://github.com/<your-username>/pakerp-cloud-suite.git
cd pakerp-cloud-suite
cp .env.example .env
```

Update `.env` with your actual credentials:
```env
# Server-side only — used by the local API emulator (scripts/dev.mjs)
GROQ_API_KEY="gsk_..."

# Supabase (public, client-safe)
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Step 5.2: Install Dependencies & Run Locally
```bash
npm install
npm run lint        # TypeScript type safety
npm run dev         # Starts API emulator (:3001) + Vite dev server (:3000)
npm run build       # Production build
```

`npm run dev` launches two processes: the **Groq API emulator** on port 3001 (same contract as the Vercel functions, reading `GROQ_API_KEY` from `.env`) and the **Vite dev server** on port 3000 (which proxies `/api/*` to it). Without a key, the app still runs — AI features return a clear 503.

---

## 6. Deploying to Vercel

### Method A: One-Click GitHub Integration (Recommended)
1. Push your code to your GitHub repository:
   ```bash
   git add .
   git commit -m "feat: complete production PakERP suite with Supabase & Groq AI"
   git push origin main
   ```
2. Open [vercel.com/new](https://vercel.com/new).
3. Import your GitHub repository `pakerp-cloud-suite`.
4. In the **Configure Project** screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Expand **Environment Variables** and add:
   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `GROQ_API_KEY` | `gsk_...` | **Server-side only.** Used by `/api/groq/*` functions |
   | `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` | Supabase Project URL (client-safe) |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Supabase Public Anon Key (client-safe) |

   > **Do NOT** add `VITE_GROQ_API_KEY`. Any variable prefixed `VITE_` is embedded into the client bundle and readable by every visitor.
6. Click **"Deploy"**.
7. In ~60 seconds, your application will be live at `https://<your-app>.vercel.app`.

### Method B: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## 7. Single Page Application (SPA) Routing on Vercel
The repository includes a pre-configured `vercel.json` file in the root directory:
```json
{
  "version": 2,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/groq/transcribe.ts": { "maxDuration": 60 },
    "api/groq/chat.ts": { "maxDuration": 30 }
  }
}
```
SPA rewrites ensure client routes fall back cleanly to `index.html`, while the `api/groq/*` serverless functions serve the AI proxy endpoints.

---

## 8. Default Production Master Accounts
Upon initial deployment, you can immediately log in with the root master administrator credentials:

| Corporate Email | Password | Role | Privileges |
| :--- | :--- | :--- | :--- |
| **`adil@gmail.com`** | **`adil123`** | **Super Admin** | Full System & RBAC Governance |
| **`admin@pakerp.com`** | **`admin`** | **Super Admin** | Root Enterprise Administration |

*Note: Once logged in as Super Admin, navigate to **Settings -> User Accounts & RBAC** to provision operational accounts for Accountants, Mill Supervisors, and Tax Auditors. Change these default passwords before production use.*

---

## 9. Verification & Production Checklist

- [x] **Database Connectivity:** Navigate to **Settings -> Supabase & Cloud DB** and verify green status badge.
- [x] **Server-Side AI Proxy:** Navigate to **Settings -> Groq AI & Voice** and click **Test Connection** — it should report success via the server proxy with no key exposure.
- [x] **Voice Assistant Test:** Click the microphone button in the top header, grant browser microphone permission, and speak: *"Check yarn stock"* or *"Yarn ka stock kitna hai"*.
- [x] **Double-Entry Accounting Test:** Dispatch a sales invoice or log a vendor payment and verify that trial balance remains balanced ($Debit = Credit$).
- [x] **FBR Annexure-C Tax Test:** Open **FBR Integration Hub**, click **"Generate Annexure-C"**, and verify the JSON payload and 18% GST calculation.
- [x] **Data Inspection:** Open **Database Inspector** module to inspect live records in Supabase and local cache.
- [x] **Key Exposure Audit:** Open DevTools → Network and confirm no request to `api.groq.com` carries an `Authorization` header from the browser, and that no `gsk_` string exists in the JS bundle.
