# Personal JLPT N2 learning system

A private study application planned around verified Nihongo no Mori vocabulary, kanji, and grammar, reliable spaced recall, cumulative assessment, reading, and external listening.

[FINALIZED_PROJECT_PLAN.md](FINALIZED_PROJECT_PLAN.md) is the primary specification. [AGENTS.md](AGENTS.md) is the engineering entry point; [docs/documentation.md](docs/documentation.md) maps the supporting docs.

## Current status

The local Next.js reference application now has vocabulary, kanji, grammar, item-detail and source-detail pages. The user-authorized three-batch import contains 108 vocabulary items, 38 kanji and 10 grammar items, with 171 exact record/hash approvals. Dictionary and generated additions retain separate provenance; 15 grammar questions and 86 supplementary explanations remain unresolved drafts. Original files, staged payloads and source evidence are unchanged.

These batches were accepted **without PDF comparison**, an explicit user decision, not independent transcription verification. Real repeat imports, synthetic content-identity checks, build, lint, typecheck and a production-browser reference flow passed. Physical PDF intake/transcription gates remain unverified. There are no cards, scheduler, learner familiarity, assessments or generation provider. See [Phase 1 handoff](docs/phase-1-handoff.md) for exact evidence, exclusions and the manual Git bundle.

## First implementation scope

Master Plan §18 phase 1: establish the application and real dependency versions, incremental schema/migrations, a JSON importer, a small human-verified content batch, and source-aware item pages. Master Plan §16 defines the PDF inventory/extraction pilot. Study can begin before whole-book ingestion; a complete lower-level baseline is unnecessary.

The selected stack is Next.js/React/TypeScript/Tailwind with PostgreSQL/Prisma/Zod and later server-side `ts-fsrs`. Local Windows deployment is the default. See [database import](docs/database-import.md) for the user-selected Docker setup and staging boundary, and [tooling and verification](docs/tooling_Verification.md) for commands and evidence. This work does not complete all of phase 1.

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
