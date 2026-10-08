# Personal JLPT N2 learning system

A private study application planned around verified Nihongo no Mori vocabulary, kanji, and grammar, reliable spaced recall, cumulative assessment, reading, and external listening.

[FINALIZED_PROJECT_PLAN.md](FINALIZED_PROJECT_PLAN.md) is the primary specification. [AGENTS.md](AGENTS.md) is the engineering entry point; [docs/documentation.md](docs/documentation.md) maps the supporting docs.

## Current status

The local Next.js application has source-aware reference pages and persistent daily recall at `/review`. Phase 2 adds combined vocabulary objectives, independent kanji meaning/context objectives, ts-fsrs 5.4.2, atomic/idempotent review writes, daily limits and stop/resume. The accepted core import contains 108 vocabulary, 38 kanji and 10 grammar items. Additional source-word vocabulary references stay unscheduled. The local pool has 184 dormant cards; no learner introductions or reviews were created during engineering verification.

These batches were accepted **without PDF comparison**, an explicit user decision, not independent transcription verification. Ten grammar scheduling objectives remain blocked; all 15 reference-only questions and their 75 language aids stay draft. Accepted dictionary/generated assistance retains its origin and limitations.

Phase 3 adds a review-first dashboard, unique introduced-item progress, focused cards with stored examples, approved grammar explanations/comparisons, editable block budgets, explicit Takoboto lookup/attention flags, an external listening link and local backup/export/verified restore. See [Phase 3 handoff](docs/phase-3-handoff.md) and [recovery runbook](docs/backup-recovery.md). Real and nonempty synthetic backups were restored into separate targets. A learner-paced 25–35-minute session remains an acceptance check; no assessments or generation provider exist.

## Approved delivery boundary

Master Plan §18 Phase 3 is implemented with release acceptance pending the learner-paced session. Real grammar questions/comparisons require their own approvals. Master Plan §16 still defines the independent PDF inventory/extraction gate. Study can begin before whole-book ingestion; a complete lower-level baseline is unnecessary. Phase 4 has not started.

The selected stack is Next.js/React/TypeScript/Tailwind with PostgreSQL/Prisma/Zod and server-side `ts-fsrs`. Local Windows deployment is the default. See [database import](docs/database-import.md) for the user-selected Docker setup and staging boundary, and [tooling and verification](docs/tooling_Verification.md) for commands and evidence. Independent source-quality gates remain unverified.

Keep books, OCR, actual import data, backups, secrets, and learner history in ignored private storage. See [repository structure](docs/repository-structure.md) and [architecture](docs/architecture.md).

## Local tooling

Bun 1.2.20 is the primary package manager/script runner; import tools and the application server run on Node. RTK supports Bun directly.

```powershell
rtk bun install --frozen-lockfile
rtk bunx prisma generate
rtk bun run test
rtk bun run test:canonical
rtk bun run lint
rtk bun run typecheck
rtk bun run build
rtk bun run test:browser
rtk bun run start
```

`test:canonical` uses a fresh isolated PostgreSQL database. Browser checks use the installed Microsoft Edge browser and the real accepted reference library; build first and stop any existing server on port 3000 before running them. `start` serves the production app at [localhost](http://127.0.0.1:3000). `dev` starts the development server at the same local address. See the tooling guide for setup and approval boundaries.
