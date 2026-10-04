# `src/ai` — the AI layer

Everything the product knows how to **answer** or **refuse**, behind one door.

## Why this folder exists

Before it, the AI was spread across `src/agents/` (proposals), `src/lib/` (tools),
`src/lib/rag/` (statutes) and a 1,500-line supervisor that decided which of them
answered you. Questions about *the software itself* belonged to none of them and
were refused.

The rule now: **a capability is real only if all three of these are true.**

| Piece | Where | What it guarantees |
|---|---|---|
| The module | `src/ai/<capability>/index.ts` | Pure functions, no writes, no network |
| The skill | `src/agents/skills.ts` | Named the file that implements it |
| The route | `src/lib/agentSupervisor.ts` | Reachable by a real sentence |

`src/agents/__tests__/aiLayer.test.ts` reads this folder and fails if any module
is unreachable, or if a skill names a file that is not here.

## Layout

```
src/ai/
  index.ts          barrel — import from here
  stock/index.ts    stock sufficiency + the pre-purchase guard
  loss/index.ts     material variance, and the caveat it always carries
  software/index.ts the app's own map: modules, and what each is for
```

## What each one will and will not say

**`stock`** — compares on-hand against what a purchase would consume. Runs on
*every* purchase command, so "buy 200 kg yarn" on 1,450 kg of yarn says so
before it opens a confirmation card.

**`loss`** — reconciles material received against material issued to
production, per supplier. It reports **stock variance, not weighed physical
loss**: the ledger cannot see a roll that tore on the loom, and the answer says
so in its own last line rather than letting a number imply a measurement it
never was. When the ledger holds no production-issue or purchase-receipt
movements, it says that instead of returning an empty table.

**`software`** — answers "how do I print a PO" from the module registry. It
returns `null` for anything it has no entry for, so a phrase about the business
("show me cash") is never misread as a question about the Cashbook module.

## Invariants

1. **Pure.** No writes. A guard that mutates cannot be run on every turn.
2. **No fabrication.** An absent fact is `undefined` or "not set yet" — never a
   plausible default. See the credit-limit and city bugs this folder replaced.
3. **Refuse rather than guess.** `softwareAnswer` returns `null` by default;
   `lossAnswer` reports missing data rather than an empty result.
4. **Derived counts.** The skill count and module count on the dashboard are
   computed from the registries, never typed, so a UI claim cannot disagree
   with the code.
