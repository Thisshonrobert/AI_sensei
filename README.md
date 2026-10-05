# Personal JLPT N2 learning system

A private study application planned around verified Nihongo no Mori vocabulary, kanji, and grammar, reliable spaced recall, cumulative assessment, reading, and external listening.

[FINALIZED_PROJECT_PLAN.md](FINALIZED_PROJECT_PLAN.md) is the primary specification. [AGENTS.md](AGENTS.md) is the engineering entry point; [docs/documentation.md](docs/documentation.md) maps the supporting docs.

## Current status

The repository now includes a Docker Compose PostgreSQL setup, private environment configuration, a minimal Prisma staging schema, and JSON sanitation/import tooling. The supplied textbook batches remain unreviewed staging material. Existing extraction templates are illustrative, not verified textbook records. No Next.js study app, canonical-content promotion, scheduler or study UI exists yet. Existing page-inspection images are private inputs, not proof of completed ingestion.

## First implementation scope

Master Plan §18 phase 1: establish the application and real dependency versions, incremental schema/migrations, a JSON importer, a small human-verified content batch, and source-aware item pages. Master Plan §16 defines the PDF inventory/extraction pilot. Study can begin before whole-book ingestion; a complete lower-level baseline is unnecessary.

The selected stack is Next.js/React/TypeScript/Tailwind with PostgreSQL/Prisma/Zod and later server-side `ts-fsrs`. Local Windows deployment is the default. See [database import](docs/database-import.md) for the user-selected Docker setup and staging boundary, and [tooling and verification](docs/tooling_Verification.md) for commands and evidence. This work does not complete all of phase 1.

Keep books, OCR, actual import data, backups, secrets, and learner history in ignored private storage. See [repository structure](docs/repository-structure.md) and [architecture](docs/architecture.md).
