# Deployment & Production Guidelines
## Deploying PakERP Cloud Suite on Vercel, Supabase & GitHub

This guide provides end-to-end instructions for deploying **PakERP Cloud Suite** to **Vercel** with **Supabase PostgreSQL** and **Groq Cloud AI**.

---

## 1. Prerequisites
Before beginning the deployment, ensure you have the following accounts:
1. **GitHub Account** (for version control and automated CI/CD)
2. **Vercel Account** (for edge frontend hosting)
3. **Supabase Account** (for hosted PostgreSQL database and authentication)
4. **Groq Cloud Console Account** (for ultra-fast Llama-3.3 70B & Whisper large-v3 API keys at [console.groq.com](https://console.groq.com))
5. **Node.js 18+** and **npm** or **bun** installed locally

---

## 2. Supabase Cloud Database Provisioning

### Step 2.1: Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and click **"New Project"**.
2. Set your Project Name (e.g., `pakerp-production`), select your preferred Region (e.g., `Singapore` or `Frankfurt`), and set a strong database password.
3. Wait ~2 minutes for the database instance to provision.

### Step 2.2: Execute the Production PostgreSQL Schema
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

### Step 2.3: Retrieve Supabase API Keys
1. Go to **Project Settings -> API**.
2. Copy the following values:
   - **Project URL:** `https://<your-project-ref>.supabase.co`
   - **anon / public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 3. Groq Cloud AI Setup (Llama 3.3 70B & Whisper)

1. Navigate to [console.groq.com/keys](https://console.groq.com/keys).
2. Click **"Create API Key"** and name it `pakerp-groq-key`.
3. Copy the secret key (starts with `gsk_...`).

---

## 4. Local Development & Verification

### Step 4.1: Clone and Configure Environment
1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/pakerp-cloud-suite.git
   cd pakerp-cloud-suite
   ```
2. Create `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your actual credentials:
   ```env
   # Supabase Configuration (Prefixed with VITE_ for Vite bundling)
   VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
   VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

   # Groq Cloud AI Key (Used for Voice Whisper & Llama-3.3 Copilot)
   GROQ_API_KEY="gsk_..."
   VITE_GROQ_API_KEY="gsk_..."

   # Gemini API Key (Optional secondary engine)
   GEMINI_API_KEY="AIzaSy..."
   ```

### Step 4.2: Install Dependencies & Run Locally
```bash
# Install packages
npm install

# Run TypeScript linter to verify type safety
npm run lint

# Run development server (runs at http://localhost:3000)
npm run dev

# Test production build
npm run build
```

---

## 5. Deploying to Vercel

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
   | `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` | Your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Supabase Public Anon Key |
   | `VITE_GROQ_API_KEY` | `gsk_...` | Groq Cloud API Key |
   | `GROQ_API_KEY` | `gsk_...` | Groq Server-side Key |
   | `GEMINI_API_KEY` | `AIzaSy...` | Optional Gemini API Key |
6. Click **"Deploy"**.
7. In ~60 seconds, your application will be live at `https://<your-app>.vercel.app`.

### Method B: Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

---

## 6. Single Page Application (SPA) Routing on Vercel
The repository includes a pre-configured `vercel.json` file in the root directory:
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
This ensures all client routes fall back cleanly to `index.html` without 404 errors on deep-link refreshes.

---

## 7. Default Production Master Accounts
Upon initial deployment, you can immediately log in with the root master administrator credentials:

| Corporate Email | Password | Role | Privileges |
| :--- | :--- | :--- | :--- |
| **`adil@gmail.com`** | **`adil123`** | **Super Admin** | Full System & RBAC Governance |
| **`admin@pakerp.com`** | **`admin`** | **Super Admin** | Root Enterprise Administration |

*Note: Once logged in as Super Admin, navigate to **Settings -> User Accounts & RBAC** to provision operational accounts for Accountants, Mill Supervisors, and Tax Auditors.*

---

## 8. Verification & Production Checklist

- [x] **Database Connectivity:** Navigate to **Settings -> Supabase & Cloud DB** and verify green status badge.
- [x] **Voice Assistant Test:** Click the microphone button in the top header, grant browser microphone permission, and speak: *"Check yarn stock"* or *"Yarn ka stock kitna hai"*.
- [x] **Double-Entry Accounting Test:** Dispatch a sales invoice or log a vendor payment and verify that trial balance remains balanced ($Debit = Credit$).
- [x] **FBR Annexure-C Tax Test:** Open **FBR Integration Hub**, click **"Generate Annexure-C"**, and verify the JSON payload and 18% GST calculation.
- [x] **Data Inspection:** Open **Database Inspector** module to inspect live records in Supabase and local cache.
