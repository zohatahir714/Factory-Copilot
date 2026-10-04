# Demo Script — PakERP Cloud Suite

**Audience:** hackathon judges. **Format:** screen recording with narration.
**Rule:** every step below was run against the real app unless it is explicitly
flagged ⚠️ as needing your own check. If a step is not listed here, it has not
been verified — do not put it in the video.

---

## 1 · Before you record (5 minutes)

```bash
npm install
npm run dev          # http://localhost:3000
```

Then, in the app:

1. Sign in — `admin@gmail.com` / `admin123`
2. On the dashboard, click **Reset & Seed Demo**

That wipes the cloud ledger and reloads the canonical factory, so the video
always opens on identical numbers. **Do this before every recording.**

### What will be on screen

| | |
|---|---|
| Revenue | **Rs. 16.78 L** across **6 invoices** |
| GST collected | **Rs. 255,942** |
| Cash + Bank | **Rs. 14.17 L** |
| Inventory | **Rs. 38.38 L** · **6 SKUs** · **1 below minimum** |
| Suppliers / Customers | **4** / **3** |
| Procurement | **Rs. 1.24 L** · 1 PO pending delivery |

Six materials, three mills, six invoices spanning 52 days, one diesel expense
voucher, opening bank and cash balances.

---

## 2 · The five features — what to click and what to say

### Feature 1 · Autonomous agents (the centrepiece)

**Do this:** sign in, then **do not touch anything**. Wait 30 seconds.

Two cards appear at the top of the dashboard, on their own:

> **Reorder Reactive Dye Blue** — 92% confidence
> *"Reactive Dye Blue has 3.3 days of cover, below the 14-day supplier lead
> time… Proposed 224 kg to cover the lead time plus a 30-day buffer."*
> — Internal reorder policy: cover ≥ lead time + 30-day buffer

> **Invoice INV-DEMO-1001 unpaid for 52 days** — 84% confidence
> — **FBR SRO 345(I)/2024** — recovery of outstanding trade debts beyond 30 days

**Say:**

> "Nobody asked it to do anything. It read the stock ledger, worked out that
> Reactive Dye Blue has three days of cover against a fourteen-day supplier lead
> time, and drafted a purchase order. It also flagged an invoice that's been
> unpaid for fifty-two days and cited the recovery statute.
>
> Look at the confidence — ninety-two percent. That's computed from days of
> cover, not a number somebody typed. And every claim carries its citation."

**Then click Reject** on the overdue invoice.

> "I'm rejecting this one. I'm not going to chase that debt today."

Wait 60 seconds. It does not come back.

> "It won't ask me again. The agent remembers what I decided."

---

### Feature 2 · Human approval gate

**Do this:** click **Approve** on the Reactive Dye Blue reorder.

The PO is written to the ledger. Open the **Agent audit trail** underneath.

**Say:**

> "Nothing reaches the books without me. I approved one, it wrote a purchase
> order, and it stamped the decision into an audit trail with the agent name,
> the confidence, and the citation.
>
> That's the guarantee — an autonomous system that you can actually supervise."

---

### Feature 3 · The ERP core — double-entry and 18% GST

> ⚠️ **Do this one in order.** The seeded ledger is inserted directly, so on a
> fresh reset the Trial Balance is **balanced but empty** — every row shows a
> dash. Recording it as-is looks like a dead screen.

**Do this:**

1. Click **Sales & 18% GST** → record one real sale
   (e.g. 40 kg Cotton Yarn to Faisalabad Powerlooms).
2. Now click **Reports & Financials** → **Trial Balance & Financials**.
3. Widen the period if needed — the default is a narrow recent window.
4. The header reads **"Trial Balance Balanced"** and the rows are now populated.

**Say:**

> "Underneath the agents it's a real ERP. I just recorded a sale — that posted a
> balanced double-entry voucher: debits equal credits, zero difference, and it
> reconciles against the invoice.
>
> Every dispatch raises an 18% GST invoice under the Sales Tax Act 1990. Further
> tax applies to supplies to buyers who aren't on the register, which is most of
> a textile SME's customers."

**Why this order matters:** recording the sale first is what fills the Trial
Balance. Do it after Feature 1 so the agent's own figures are still the ones on
screen when you narrate them.

---

### Feature 4 · Urdu voice control

> ⚠️ **Verify this one before you record it.** The Urdu number and material
> parsing is proven by the 73-case fixture suite, but the full spoken utterance
> → confirmation-modal path needs the microphone, and I have not recorded it
> end to end. Run it once with narration before the take.

**Do this:** click the **Voice** button (microphone icon). Say:

> **"پنچاس کلو یارن سیل کرو"** — *sell 50 kg of yarn*

**Say:**

> "It's voice-first. A Pakistani SME owner doesn't want to type. Speak Urdu or
> Roman Urdu and it parses the amount, the material, and the action — then asks
> for confirmation before it writes anything."

The confirmation modal opens. **Cancel it** — don't complete the sale, it would
change the numbers for the rest of the video.

**If the modal doesn't open:** fall back to typing the same phrase into the
Copilot box, which routes through the same intent parser. Do not spend recording
time debugging voice — Feature 1 is the shot that matters.

---

### Feature 5 · Deterministic Copilot

**Do this:** click **AI Copilot Terminal**. Ask:

> **"what is my cash balance?"**

**Say:**

> "The Copilot answers from the ledger. And notice — this runs with no API key
> at all. The deterministic engine is the floor, not a fallback. A missing
> credential can't take the demo down."

---

## 3 · Closing line

> "PakERP is a compliance reasoning layer for Pakistani textile SMEs. The market
> is crowded with generic ERPs and crowded with e-invoicing transmitters. What's
> empty is the intersection of statutory reasoning, the textile domain, and
> agents that act on their own but never act without you."

---

## 4 · Words we never use

| ❌ Never say | ✅ Say instead |
|---|---|
| "We integrate with FBR" | "We generate a schema-valid payload for your licensed integrator" |
| "We file with FBR" | "Your integrator forwards it untouched" |
| "It's AI-powered" | "Grounded in the statute, cited to the section, refusing when unsure" |
| "It's simulated / demo data" | "It's a seeded ledger" |

**Why the FBR rule matters:** FBR requires a **licensed integrator** for
transmission, and we are not one. Saying otherwise is a factual error any judge
who works in tax can catch in one sentence. It costs more than the feature is
worth.

---

## 5 · Do NOT demo these yet

These are known gaps. Showing them will cost you more than omitting them.

| Don't show | Why |
|---|---|
| A cricket or off-topic question to the Copilot | **It answers instead of refusing.** The grounding gate is the next build. Asking it something absurd and getting an inventory report undermines the whole pitch. |
| The §153 withholding answer verbatim | **It contradicts itself** — the sentence says 9% for non-filers, the box below says 4.5%. Unfixed. |
| "Generate FBR payload" | Not built yet. |
| The negotiation view | Not built yet. |
| Anything about multi-tenant isolation | RLS policies are still open. Don't claim it. |

**If a judge asks about refusal or grounding**, the honest answer is:
*"That's the next milestone — the retriever and the confidence gate. Right now
the retrieval layer is keyword matching, and we know that, which is why it isn't
in the demo."* That answer scores better than a wrong one.

---

## 6 · If something breaks mid-recording

| Symptom | Say |
|---|---|
| No agent cards appear | You didn't seed. Click **Reset & Seed Demo**, wait 30s. |
| Voice modal doesn't open | Skip it. Type the phrase in the Copilot box instead. |
| One card, not two | Caught a tick before the seed finished loading. Wait for the next one. |
| Copilot shows a red error | Should not happen — the fallback is guarded. Re-record if it does. |
| Trial balance rows all show dashes | Expected on a fresh seed. Record one sale first (Feature 3). |

---

## 7 · Rehearsal

Record the full thing **twice** before the real take:

1. Once with narration, to get the timing
2. Once silent, to check nothing is read from the screen

Budget **3–4 minutes**. The 90-second cut is Feature 1 alone — the agent
appearing unprompted is the shot that carries the whole submission.