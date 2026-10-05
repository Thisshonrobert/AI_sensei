# Personal JLPT N2 learning system

A private study application planned around verified Nihongo no Mori vocabulary, kanji, and grammar, reliable spaced recall, cumulative assessment, reading, and external listening.

[FINALIZED_PROJECT_PLAN.md](FINALIZED_PROJECT_PLAN.md) is the primary specification. [AGENTS.md](AGENTS.md) is the engineering entry point; [docs/documentation.md](docs/documentation.md) maps the supporting docs.

## Current status

The repository includes local PostgreSQL, preserved JSON staging, and a bounded canonical-content importer with explicit record/hash approval, immutable evidence/revisions, and synthetic PostgreSQL checks. The supplied textbook batches remain unreviewed; no real records have been promoted. A private review packet contains separately cited dictionary candidates and draft grammar links. Existing extraction templates remain illustrative. No Next.js study app, scheduler, item/source pages or study UI exists yet; phase 1 is incomplete.

## First implementation scope

Master Plan §18 phase 1: establish the application and real dependency versions, incremental schema/migrations, a JSON importer, a small human-verified content batch, and source-aware item pages. Master Plan §16 defines the PDF inventory/extraction pilot. Study can begin before whole-book ingestion; a complete lower-level baseline is unnecessary.

The selected stack is Next.js/React/TypeScript/Tailwind with PostgreSQL/Prisma/Zod and later server-side `ts-fsrs`. Local Windows deployment is the default. See [database import](docs/database-import.md) for the user-selected Docker setup and staging boundary, and [tooling and verification](docs/tooling_Verification.md) for commands and evidence. This work does not complete all of phase 1.

Keep books, OCR, actual import data, backups, secrets, and learner history in ignored private storage. See [repository structure](docs/repository-structure.md) and [architecture](docs/architecture.md).
