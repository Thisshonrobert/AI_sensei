# Phase 2 handoff — 6 October 2026

Authority: Master Plan §§4–8, 10, 18–19 and A1/A2; approved plan [2026-10-05-phase-2.md](plans/2026-10-05-phase-2.md). Git integration remains manual. Phase 3 is not started.

## Working behavior

`/review` provides due-only reviews, optional new learning, explicit study → hide → unaided response → commit/reveal → self-assessment → rating, and stop/resume. Responses are durable at commitment. Uncommitted typing is not saved. Answers and source links are omitted from the unrevealed front; source evidence becomes available on the back. No AI or network service is called during stored review.

The additive `20261006000000_daily_recall` migration is applied locally. User, UserItem, Card, StudySession, SessionItem, Attempt and ReviewLog have real foreign keys, composite ownership constraints, one live objective version, one open session, immutable selections/objectives/committed responses and append-only logs. No assessment/generation service is added.

Pool preparation created **184 dormant cards**: 108 combined vocabulary, 38 core-kanji meaning and 38 fixed whole-word contextual-reading objectives. Repeat preparation created zero. There are zero local UserItem, Attempt or ReviewLog rows. Ten grammar objectives remain blocked because their questions lack approved structured answers/targets. Incidental kanji and accepted supplementary references receive no automatic scheduled cards. The original canonical records and source evidence remained unchanged.

Approved book context words missing a Vocabulary row receive literal reference-only rows with copied evidence and missing POS/meaning flags. This adds reference records, not vocabulary familiarity or vocabulary cards. Exact writing/reading overlap supplies a sibling key across distinct senses; canonical identities are preserved. All existing source acceptance remains **without independent PDF comparison**; engineering checks do not universally verify Japanese content.

`ts-fsrs` stays pinned at 5.4.2. Complete resolved configuration is stored on User and every log: retention 0.90, shipped weights, maximum interval, short-term scheduling, `1m,10m` learning and `10m` relearning steps. Fuzz is explicitly disabled for reproducible initial operation. Every complete library card/log field round-trips through JSON; indexed dueAt is updated in the same transaction.

Response commitment creates an ungraded Attempt before reveal. Rating atomically updates that Attempt, appends ReviewLog and changes exactly one Card/stateVersion. Failure preserves the committed response for retry, with no orphan log or advanced card. A user-row lock serializes mutations in this personal app. Duplicate event IDs return the original receipt; another stale event conflicts. Reading normalization preserves the original response and stores a kana/whitespace comparison; final assessment remains human, including equivalent meaning paraphrases. Either vocabulary component failure forces Again.

Selection is bounded and persisted. Due cards precede introductions; a newly due learning step interrupts remaining introductions into a fresh due-first block. Initial ceilings are 5 vocabulary, 2 kanji objective cards, 1 grammar and 8 total per User timezone day. The initial review block budget is 40 cards (an approximate 20-minute allowance), with backlog pausing new cards. Sibling burying changes presentation eligibility only. Missed allowances do not accumulate. Stop/resume preserves selection, committed responses and due dates. A repair suggestion appears after five failed recalls in 30 days.

## Verification

Executed using `rtk proxy bun.cmd run …` because this session's PowerShell Bun wrapper was blocked. Bun still runs scripts; database/server/test execution uses Node. Prisma generation and local migration deploy also ran through `rtk proxy node node_modules/prisma/build/index.js …`.

| Check | Actual result |
|---|---|
| `test` | 16 passed; 22 PostgreSQL cases deliberately skipped here |
| `test:review` | All 12 passed in fresh isolated PostgreSQL after the final changes |
| `test:canonical` | All 10 existing PostgreSQL import checks passed |
| `lint`, `typecheck`, `build` | Passed after the final implementation changes |
| `test:review:browser` | Production Edge recall/reveal/rate, active refresh, stop/reload/resume, forced-Again controls and cross-origin rejection passed; synthetic database only |
| `test:browser` | All four production reference flows passed; isolated review test intentionally skipped |
| Real pool preparation/repeat | 184 new / 0 repeat; original canonical/source evidence unchanged; no learner activation/events |
| `rtk git diff --check` | Passed |

Tests cover complete pinned transitions, duplicate concurrent events, stale submissions, real PostgreSQL rollback after log insertion, process disconnect/restart, timezone/DST boundaries, global/type limits, duplicate word cues, missing context, heavy backlog and both directions of vocabulary/kanji objective independence. Desktop/mobile screenshots were inspected privately. Synthetic test databases and diagnostics are retained under ignored `.local/`; no real learner reviews were created by browser tests.

## Limits and next boundary

Phase 3 still owns focused dashboard, richer study/back content, grammar rationale/comparisons, realistic session-time acceptance, backup/export with a tested restore, external listening and Takoboto integration. There is no undo/replacement UI, scheduler optimizer, weekly assessment, AI generation, reader or internet authentication. The pool scan is capped at 500 approved Items; selection at 100 candidates and 100 due cards. Larger intake requires revisiting these bounds in Phase 6. Do not rely on irreplaceable history until Phase 3 backup restoration is verified.

## Manual Git and documentation handoff

Implementation: package script additions; the Phase 2 schema/migration; review service/adapter/types; API/UI/navigation/styles; isolated test runner and three review test files.

Documentation: README, approved plan checklist, this handoff, architecture, database-import, repository-structure, tooling_Verification and implementation-workflow. The Master Plan, AGENTS and Phase 1 handoff are unchanged. No later-phase implementation is bundled.

Excluded: pre-existing untracked `graphify-out/cache/` and `graphify-out/manifest.json`; all `.local/`, private-data, credentials, synthetic databases, screenshots, build output and test-results. bun.lock and dependency versions are unchanged. No Git mutation ran.

```powershell
rtk git add -- package.json prisma/schema.prisma prisma/migrations/20261006000000_daily_recall/migration.sql src/lib/server/review/scheduler.mjs src/lib/server/review/service.mjs src/lib/server/review/service.d.mts src/app/api/review/route.ts src/app/review/page.tsx src/components/review.tsx src/app/globals.css src/app/layout.tsx src/app/page.tsx scripts/test-review-postgres.mjs tests/review-scheduler.test.mjs tests/review-postgres.test.mjs tests/browser/review.spec.ts README.md docs/plans/2026-10-05-phase-2.md docs/phase-2-handoff.md docs/architecture.md docs/database-import.md docs/repository-structure.md docs/tooling_Verification.md docs/implementation-workflow.md
```

Suggested commit subject: `feat: implement reliable daily recall with persistent FSRS reviews`

## Graphify refresh after integration

The Phase 2 architectural milestone was merged to `main` at `5b872d0ae430b19233790f89299326fb2a647cdb`; local `main` matched `origin/main` with zero divergence and no source changes. The user requested the refresh after integration. Graphify 0.9.76 used an explicit 35-file engineering allowlist (22 existing application/test/configuration/migration files plus the Phase 2 implementation files listed above), totaling about 13,327 words. Documentation, `.local/`, `.env*`, `private-data/`, books/OCR/imports/backups, learner records, dependency/build output and prior graph output were excluded before extraction. No LLM or network extraction was used; token cost was zero.

Generated outputs: `graphify-out/graph.json` (329 nodes, 699 edges, 14 communities), `graphify-out/GRAPH_REPORT.md`, and `graphify-out/graph.html`. The graph references 33 source files and all resolve. Five test files yielded no AST symbols. Raw extraction diagnostics showed five dangling endpoint edges, 18 external-reference edges, four self-loops and 17 same-endpoint groups; the final graph has zero missing/dangling/external-reference endpoints and zero collapsed endpoint pairs, with three self-loops. The report records these extraction limitations. Privacy and freshness checks found no private or machine-specific source paths; `built_at_commit` matches the integrated commit. The installed skill version reports 0.9.61 while the local package used to generate these outputs is 0.9.76.

Graphify required: yes for this integrated Phase 2 milestone; refresh complete. The ignored machine-local `graphify-out/cache/`, `graphify-out/manifest.json`, interpreter marker and extraction/analysis sidecars are excluded from staging. No application tests were run for this index-only refresh.

Manual Git handoff for this refresh:

```powershell
rtk git add -- graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/graph.html docs/graphify.md docs/phase-2-handoff.md
```

Suggested commit subject: `docs: refresh Graphify index for Phase 2 recall`

Antigravity brief, if the learner selects it: read Master Plan §§4–8/18 A1/A2 and this handoff; edit only the affected engineering docs above from verified evidence. Preserve the unresolved grammar/source-quality gates and Phase 3 boundary. Exclude all private/machine-local material. Sending this brief to another chat is not authorized.
