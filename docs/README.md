# Documentation

Everything in this folder is reference material. If you only read one thing,
read the [README](../README.md) in the repository root — it is the entry point
and answers what the product is, how to run it, and what it does not do.

## Start here

| Document | What it is | Read it if |
|---|---|---|
| [SUBMISSION_PRD.md](./SUBMISSION_PRD.md) | The judge-facing product and architecture brief, including the six-minute demo script and the stated limitations | You are judging, or you want the whole picture in one pass |
| [PRD.md](./PRD.md) | The full product requirements document — modules, data model, business rules | You need the specification behind a feature |

## Architecture diagrams

Each `.html` is a self-contained, offline-capable diagram. Open it in any
browser; no server or network connection is needed. The matching `.json` beside
it is the source the diagram was generated from, kept so the diagrams can be
edited and regenerated rather than hand-painted.

| Diagram | Shows |
|---|---|
| [pakerp-agentic-architecture.html](./architecture/pakerp-agentic-architecture.html) | The agentic target architecture: copilot, skills, tools and the human approval gate |
| [pakerp-ai-pipeline-map.html](./architecture/pakerp-ai-pipeline-map.html) | How an utterance becomes an answer — routing, retrieval, the confidence gate, the tool call |
| [pakerp-database-map.html](./architecture/pakerp-database-map.html) | Tables, relationships and how ledger movements feed stock and variance |
| [pakerp-deployment-topology.html](./architecture/pakerp-deployment-topology.html) | Deployment shape: static frontend, serverless AI proxy, Supabase, and where secrets live |

The same architecture is summarised as text and Mermaid in
[README §2](../README.md) for anyone reading on GitHub rather than opening a file.

## Database

The schema and its migrations live in [`supabase/`](../supabase), not here:

- [`supabase/schema.sql`](../supabase/schema.sql) — the full schema, readable top to bottom
- [`supabase/migration-2026-09-cloud-first.sql`](../supabase/migration-2026-09-cloud-first.sql) — Supabase becomes the system of record
- [`supabase/migration-2026-10-rls-hardening.sql`](../supabase/migration-2026-10-rls-hardening.sql) — row-level security, applied per tenant

## A note on what is deliberately absent

This folder contains no internal planning notes, status trackers, or
known-defect lists. Those exist and are useful while building, but shipping them
in a public repository makes a finished project look unfinished. Everything here
is written to be read by someone who did not build it.
