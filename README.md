# Personal JLPT N2 learning system

A private study application planned around verified Nihongo no Mori vocabulary, kanji, and grammar, reliable spaced recall, cumulative assessment, reading, and external listening.

[FINALIZED_PROJECT_PLAN.md](FINALIZED_PROJECT_PLAN.md) is the primary specification. [AGENTS.md](AGENTS.md) is the engineering entry point; [docs/documentation.md](docs/documentation.md) maps the supporting docs.

## Current status

Documentation and directory scaffold only. Existing extraction templates are illustrative, not verified textbook records. No Next.js app, dependency versions, Prisma schema, database importer, scheduler, or application tests have been implemented. Existing page-inspection images are private inputs, not proof of completed ingestion.

## First implementation scope

Master Plan §18 phase 1: establish the application and real dependency versions, incremental schema/migrations, a JSON importer, a small human-verified content batch, and source-aware item pages. Master Plan §16 defines the PDF inventory/extraction pilot. Study can begin before whole-book ingestion; a complete lower-level baseline is unnecessary.

The selected stack is Next.js/React/TypeScript/Tailwind with PostgreSQL/Prisma/Zod and later server-side `ts-fsrs`. Local Windows deployment is the default. There are no runnable setup commands yet; [tooling and verification](docs/tooling_Verification.md) explains when they must be recorded.

Keep books, OCR, actual import data, backups, secrets, and learner history in ignored private storage. See [repository structure](docs/repository-structure.md) and [architecture](docs/architecture.md).
