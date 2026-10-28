# AGENTS.md

## Execution Requirements

These invariants govern every turn; they cannot be overridden:

1. **Authority:** [FINALIZED_PROJECT_PLAN.md](FINALIZED_PROJECT_PLAN.md) is the primary specification. Read relevant sections and amendments before making architectural or feature decisions.
2. **Tooling & Runtimes:**
   - Prefix shell commands with `rtk` (use `rtk proxy` for commands without an existing filter).
   - Use Bun for package management and scripts (`packageManager` / `bun.lock`).
   - Use Node for server runtime, database operations, and import scripts.
3. **Manual Git Mutations:**
   - Never execute or suggest broad staging (`git add .`), broad directory staging, or force pushes.
   - Git commits, pushes, and branch changes remain manual unless explicitly authorized by the user.
   - At each handoff, provide the exact scoped command: `rtk git add -- <path>...` and a suggested commit subject. Include `Graphify required: yes/no`.
4. **Verification before Claims:** Run actual verification commands and inspect their output before reporting checks passed. Report unverified checks explicitly.
5. **Privacy & Secrets:** Keep database credentials, API keys, private book data/PDFs, and learner history out of command and chat output.
6. **Implementation Agent:** Implementation is done by Claude Code only; do not assume Codex or other coding tools. Apply the `karpathy-guidelines` skill whenever writing, reviewing, or refactoring code: surface assumptions, keep it simple, make surgical changes, and define verifiable success criteria.
7. **Continuation Prompts:** Every continuation prompt must state the recommended model and reasoning-effort setting for the next task, with a brief rationale. Follow the relevant workflow's model routing, choose only a model/effort supported in the destination chat, and name any limitation if the preferred setting is unavailable.

---

## Project Overview

Private, single-user Japanese JLPT N2 study application. The focus is trustworthy Nihongo no Mori content, manageable spaced recall (FSRS), timed reading, and external listening—not learning software development. Local Windows use is default; stored reviews work without AI or internet.

---

## Context Pointers (Progressive Disclosure)

Consult these reference documents on demand when working on specific areas of the project:

### 1. Data Extraction & Enrichment (Active Focus)
- **PDF Extraction & Enrichment Workflow:** Read [docs/extraction-templates/batch-workflow.md](docs/extraction-templates/batch-workflow.md) before starting any textbook batch.
  - Keep extracted drafts strictly in git-ignored `private-data/`.
  - Use installed local JMdict before web lookups (`src/lib/server/generation/dictionary.mjs`).
  - Use reusable local scripts for validation, assembly, and checkpoints (`scripts/pdf-batch.mjs`, `scripts/enrich-study-batch.mjs`).
  - Never guess missing readings, answers, or book facts; preserve source uncertainties as null/unresolved.
  - Stop after at most three new production batches per chat and provide a continuation checkpoint prompt.
- **Prompts & Schemas:** Consult [docs/extraction-templates/extraction-prompt.md](docs/extraction-templates/extraction-prompt.md), [docs/extraction-templates/enrichment-prompt.md](docs/extraction-templates/enrichment-prompt.md), and [docs/extraction-templates/lesson-answer-reasons-prompt.md](docs/extraction-templates/lesson-answer-reasons-prompt.md).

### 2. Database Population & Imports (Active Focus)
- **Database Import & Batch Staging:** Read [docs/database-import.md](docs/database-import.md) when staging, sanitizing, or loading extracted batches.
  - Local PostgreSQL runs via Docker Compose (`compose.yaml`).
  - Sanitization checks structure and source provenance before loading unreviewed staging records (`ImportBatch`).
  - Canonical promotion requires explicit human review and approval records.

### 3. Tooling, Testing & Verification
- **Test Commands & Verification Matrices:** Read [docs/tooling_Verification.md](docs/tooling_Verification.md) for full commands (`test:review`, `test:assessment`, `test:generation`, browser tests), staging commands, and environment setups.

### 4. System Architecture & Invariants
- **Domain Boundaries & Core Rules:** Read [docs/architecture.md](docs/architecture.md) for the 18 logical records, independent FSRS card states, response-commitment gate, sibling burying rules, and reading aid boundaries.

### 5. Repository Structure
- **Folder Boundaries & Module Paths:** Read [docs/repository-structure.md](docs/repository-structure.md) for current layout and deferred boundaries.

### 6. Phased Implementation Workflow
- **Phased Implementation & Acceptance:** Read [docs/implementation-workflow.md](docs/implementation-workflow.md) for phase gates (Phases 1–5 are implemented; future extensions remain gated).

### 7. Documentation & Handoffs
- **Document Map & Rules:** Read [docs/documentation.md](docs/documentation.md) for document updates and handoff structure.
- **Graphify Navigation:** Read [docs/graphify.md](docs/graphify.md) for rules on generating the engineering index.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
