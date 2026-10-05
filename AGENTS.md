# AGENTS.md

## Project Overview

Build a private, single-user Japanese JLPT N2 study application. The goal is efficient exam preparation through verified Nihongo no Mori content, manageable recall, timed reading, and external listening—not learning software development.

**Primary authority:** [FINALIZED_PROJECT_PLAN.md](FINALIZED_PROJECT_PLAN.md), including its targeted amendments. This guide summarizes engineering constraints; it cannot override the Master Plan. The Zapier AGENTS.md was a documentation template only, not a project specification. If implementation exposes a conflict, report the exact plan section and affected behavior before redesigning it.

The approved stack is Next.js, React, TypeScript, Tailwind, PostgreSQL, Prisma, Zod, and server-side `ts-fsrs`. One application, one database, ordinary server modules. Local Windows use is the default; stored reviews must work without AI or internet. See Master Plan §§1–2, 17–19.

## Engineering Guide

- Optimize for trustworthy content and returning to study tomorrow. Keep maintenance proportional to a personal study tool.
- Use simple, readable, testable code; follow existing conventions and avoid unrelated refactoring.
- Implement one verified vertical slice at a time in the Master Plan's phase order. Do not prebuild later features.
- Keep database, scheduler, and Japanese analysis on the Node server runtime. Choose route handlers or server actions consistently within each feature; do not duplicate mutations across both.
- Retrieve bounded, explicit records through SQL. AI produces drafts; it cannot write textbook facts, approve content, or update scheduling state.
- Preserve source evidence, missing fields, accepted alternatives, and uncertainty. Fluent output is not verification.
- Check the relevant phase gate and invariant before changing content identity, review transactions, eligibility, or publication.

## Repository Structure

See [docs/repository-structure.md](docs/repository-structure.md) for current folders and deferred module boundaries.

- `FINALIZED_PROJECT_PLAN.md` — authoritative specification; retain its location and amendments.
- `src/app/` — future Next.js pages and feature mutations.
- `src/components/` — shared UI only when actual screens need it.
- `src/lib/server/` — server modules; begin with `content/` for verified import. Review, assessment, and generation arrive in their respective phases.
- `prisma/` — Source/ImportBatch staging and bounded canonical content/provenance migrations; learner and later-feature tables remain deferred.
- `scripts/` — bounded local import/backup utilities as their phases require them.
- `tests/` — focused unit, PostgreSQL integration, and study/resume browser checks as behavior exists.
- `docs/` — engineering guidance, existing illustrative extraction templates, and private-use UI references.
- `private-data/` — ignored originals, OCR, imports, backups, and existing inspection files; never put these in `public/`.
- `.local/` — ignored concise progress/handoff notes when needed.
- `graphify-out/` — optional generated engineering index, absent initially; not part of the application.

## Core Architectural Invariants

The detailed authority is Master Plan §§3–8, 12–15, 19–20. See [docs/architecture.md](docs/architecture.md).

1. Imported, introduced, familiar, and retrievable are distinct. Import creates reference/new-pool records, never implicit learner familiarity or active reviews.
2. One canonical Item has one matching typed Vocabulary/Kanji/Grammar row. Source relationships preserve edition/page provenance; do not merge vocabulary solely by spelling or English gloss.
3. Content uses one kind-discriminated table with explicit book/generated/user origin. Source evidence and approved content revisions are immutable; corrections preserve historical prompts and attempts.
4. One Card measures one stable recall objective. Vocabulary requires **reading plus selected meaning** with one rating/state; either failure means Again. Core kanji meaning and source-backed whole-word contextual reading have separate states. Missing context blocks the reading card. Incidental kanji cards remain opt-in.
5. Relationships never propagate ratings. Practice, reading aids, explanations, tests, AI feedback, and dictionary lookups do not update FSRS in V1.
6. A review atomically writes Attempt, immutable ReviewLog, and Card state. Event IDs are idempotent; stale state versions conflict. Store complete library state/log, configuration, version, and prompt snapshots.
7. Initial daily ceilings are five vocabulary, two core-kanji objective cards, one grammar card, and eight total. Backlog can pause introductions. Sibling burying changes presentation eligibility, not due dates or another card's state.
8. Scored tests use approved questions and introduced/learner-enabled baseline targets; unseen N2 is excluded. Selection and timed deadlines survive refresh. Short valid tests beat fabricated quotas.
9. A complete N5–N3 baseline is optional. Zero baseline rows must work. Untracked supporting language is not automatically unknown or known; explicit unresolved sense/reading/grammar problems require review before approved reuse.
10. AI is optional, on demand, bounded, and draft-only. Human approval precedes reusable publication; accepted answers/rubrics precede scored/scheduled questions. No paid fallback; generation failure leaves review available.
11. Reading/dashboard/grammar additions reuse existing records. No per-tap AI, separate reader scheduler, extra comparison tables, or analytics service. Span offsets are revision-bound half-open UTF-16 indices, including valid surrogate boundaries.
12. Localhost and server-only secrets are defaults. Protect local mutations from cross-origin requests, enforce ownership, and test backup restoration before relying on irreplaceable history. Internet deployment requires one-user authentication/authorization first.
13. No V1 microservices, message broker, LangGraph, autonomous study agents, pgvector/vector or graph database, custom SRS, or custom Japanese parser. Engineering Graphify is an optional index, not a learner-data system.

## Tooling & Verification

Read [docs/tooling_Verification.md](docs/tooling_Verification.md) and [docs/database-import.md](docs/database-import.md). Local PostgreSQL, Prisma/Zod staging and bounded canonical-import tools are present, with explicit record/hash approval and isolated synthetic PostgreSQL verification. Real batches remain unreviewed/unpromoted. There is no Next.js application, review scheduler, or study UI yet. Do not claim a build, lint, type check, or application test passed until its real command runs. Sanitized batches remain unreviewed until human source comparison; staging is not canonical promotion.

Prefix shell commands with `rtk`, using `rtk proxy` for commands without a suitable filter, as required by the user-provided RTK instructions. Never expose database credentials, API keys, raw books, or learner history in command output.

## Documentation

**Yes, concise documentation is necessary** for source verification, scheduler correctness, phase acceptance, backup recovery, and safe handoffs. It is not a development course. Read [docs/documentation.md](docs/documentation.md) for the document map and update rules. Keep the Master Plan authoritative and avoid copying it into competing specifications.

## Graphify

Read [docs/graphify.md](docs/graphify.md). Optional engineering navigation only; absence must not block studying or implementation. Refresh after a major implemented architectural milestone has been merged/pushed and the user confirms an up-to-date clean source. Do not regenerate for every small change or this documentation scaffold. Exclude secrets, books, OCR, imports, backups, and learner records.

## Skills

- Use relevant planning, debugging, testing, review, and verification skills for engineering work, with scope proportional to the task.
- Use `ponytail` for simple maintainable implementation and Graphify for existing engineering graph queries when useful.
- Use frontend design/accessibility skills for actual approved screens, preserving the Master Plan's UI constraints.
- Use token-optimizer only for a requested audit or concrete context problem; no routine full state dump.
- **Do not require `/teach`, developer lessons, interview exercises, or learner checkpoints.** Product grammar explanation/production practice remains Japanese learning under the Master Plan, separate from software-development teaching.
- Use only skills/tools actually available. No skill, plugin, or model installation is a prerequisite to the core study loop.

## Tool Roles & Model Routing

These are engineering handoff conventions, not application services or new architectural requirements. The learner selects tools/models; do not assume the Zapier project's names or presets are available here.

- **Planning tool:** examines requirements against the existing Master Plan. Changes require an explicit recorded decision; another planning chat cannot silently supersede it.
- **Implementation tool (Codex or another selected coding tool):** implements the current approved phase, verifies behavior, and reports paths/results/limitations without compulsory teaching.
- **Documentation tool (Antigravity when selected):** maintains scoped engineering docs from verified implementation evidence and may handle confirmed Graphify milestones. It does not invent implemented behavior or change curriculum/scheduler decisions.
- Route complex review transactions, schema integrity, security, and difficult debugging to a stronger reasoning model. Use a lower-cost capable model for bounded documentation or mechanical changes. Keep current user-selected settings by default; model brand/price is not a correctness gate.
- Do not confuse coding models with the app's optional generation provider: initial practice uses prompt export/manual draft import. Automated free API/local-model options remain subject to Master Plan §§2, 15–16.

### Manual Git and Antigravity Handoff

- Default: the user stages, commits, pushes, merges, switches branches, and pulls. This scaffold adds no automatic phase scripts, PR automation, heartbeat, or direct-to-main push policy.
- Inspect changes read-only; preserve existing edits. At handoff, list exact paths as `Implementation`, `Documentation`, and `Excluded or uncertain`, plus verification evidence and unresolved issues.
- Provide an exact `git add -- <path>...` suggestion for the intended bundle and a commit subject. Never suggest `git add .` or broad dirty-directory staging. Include the Master Plan/existing references only if the user intends them in that commit; do not silently absorb previously untracked files.
- State `Graphify required: yes/no` under the milestone policy. When yes, wait for confirmation that the phase is integrated and the default branch is clean/up to date before regeneration. Hand off exact generated paths separately.
- An Antigravity brief identifies the plan sections, exact docs to edit, verified behavior/checks, remaining gaps, and files to exclude. Prepare the brief here; sending it to another chat requires user authorization.
- Explicit user authorization for a Git action takes precedence over these defaults. Never force push or include unrelated/private files implicitly.

## Token Efficiency & Memory (claude-mem)

- File-first authority: Master Plan, current files, Git diff, and actual verification evidence. Optional `.local/progress.md` is a short resume aid, not a specification or learner database.
- Read the current phase and affected records rather than the full repository repeatedly. Specify files to read/edit/exclude in handoffs.
- Use claude-mem only if configured and available. Retrieve a small relevant engineering summary; do not dump history or store private books, credentials, or learner responses there. Its absence cannot block work.
- Reuse completed work after checking the diff and evidence; do not restart interrupted tasks from chat memory alone.

### Token Budget Guardrails

- Default to one agent for sequential/shared-file work. Delegate only with user authorization or applicable workflow instructions and truly independent scope; no routine parallel orchestration.
- Execute the approved plan without replanning every task. Escalate concrete contradictions or missing decisions.
- Keep reports concise; save detailed diagnostics to ignored local files when needed, with secrets redacted.
- Run focused verification, fix affected failures, and complete the required phase checks. Repeat only when new edits/failures justify it.
- Report genuine remaining work; do not label partial work complete to save tokens. Stop after the requested scope and handoff.

## Implementation Workflow

1. Read the relevant Master Plan section/amendments, current files, and uncommitted changes. Identify the next phase's acceptance evidence.
2. Define a bounded file/behavior scope. Preserve existing extraction templates as illustrative interchange formats, not canonical data or finished importer schemas.
3. Follow phases 1–7 in Master Plan §18: verified content slice → reliable daily recall → usable personal release → cumulative assessment → generated practice → incremental growth → optional extensions.
4. Implement the smallest working slice and its meaningful checks. Keep absent source data flagged; source approval is a human quality gate.
5. Verify phase behavior and relevant amendment checks. Record commands/results and distinguish implemented, manually verified, pending, and deferred work.
6. Update only affected docs, then provide the manual Git/documentation handoff. Suggest next scope/model capability only when useful; do not start the next phase automatically.
