# Phase 3 personal release handoff

**Acceptance update — 8 October 2026:** the learner explicitly declared Phase 3 completed and requested Phase 4 implementation. This supersedes the historical pending acceptance/Phase 4 prohibition below. Actual prior engineering evidence remains unchanged; no additional learner-paced timing measurement is claimed. See [Phase 4 handoff](phase-4-handoff.md).

Authority: FINALIZED_PROJECT_PLAN.md §§3–10, 17–20 and A1/A2; approved [Phase 3 design](plans/2026-10-06-phase-3-design.md). Implementation verified on 6 October 2026. **Acceptance remains pending a learner-paced 25–35-minute daily block and 5–10-minute review-only stop/resume.** Automated timing tests establish persistence, not actual study usability. Do not start Phase 4 on this evidence alone.

The [8 October content and Neon follow-up](phase-3-content-neon-followup.md) supersedes the earlier pending mnemonic preview: the user authorized complete original generated memory aids without another manual approval step, and all 38 were published through the existing provenance path. It also combines repeated word supplements in presentation and transfers the active database to Neon with verified recovery. Earlier local-only database descriptions are historical; the learner-paced Phase 3 gate remains pending.

The approved [7 October frontend follow-up](phase-3-frontend-followup.md) adds card-click browsing with side chevrons, compact backs, collapsed inline evidence, radical highlights and warm ivory surfaces. It connects existing approved dictionary meanings to all 140 current kanji example words. Vocabulary component boxes require the updated extraction/repair prompt; 38 complete original generated mnemonics have a private exact preview awaiting human approval. It supersedes the historical Dictionary-panel description below with direct selection/explicit-click clipboard lookup. See that follow-up for actual checks, remaining content gates and its separate shared-file Git scope.

## Implemented behavior

The dashboard uses the actual bounded review selector for due/eligible work, persisted resume and unavailable-content states. It distinguishes imported core Items from unique introductions, excludes contextual vocabulary/incidental kanji, and reports daily 5/2/1 and eight-total ceilings. An editable overall block budget retains the 20-minute review-only ceiling. Active elapsed time survives stop/reload/resume and excludes stopped periods; the budget offers a stopping point without changing due dates or rating cards.

Recall uses one dominant objective card, explicit study-first/hide/commit/reveal, paired stored answers and committed responses, then self-assessment and four ratings. Either vocabulary component failure forces Again. Approved bounded examples, sources, kanji readings and stored grammar formation appear only during teaching/reveal. Grammar sentence rationale falls back to labelled general guidance. Curated comparisons reuse approved explanation Content linked to both patterns; malformed/draft/superseded records are omitted. Both patterns and linked example snapshots participate in human approval; stale approvals reject, and later pattern corrections hide comparisons. Pattern corrections must be promoted separately before approving comparisons.

Quizlet informed interaction hierarchy only. The original application styling and finalized N2 objectives remain authoritative. UI/UX Pro and Taste were unavailable; installed frontend-design and Impeccable skills supplied frontend guidance without adding dependencies or changing scheduler architecture.

The dictionary captures selected text on explicit opening, remains editable, encodes Takoboto queries, uses a desktop named popup with fallback and a mobile tab, and restores focus on close. It is unavailable on an unrevealed recall front. Explicit canonical-item attention sets only UserItem.needsAttention; an unseen flag does not prevent subsequent real introduction. Listening is an optional external link. No external navigation records learning or changes FSRS.

The additive personal-release migration stores elapsedActiveMs/activeSince and guards published comparison structure. The existing pool retains its approved status, missing source fields and blocked objectives. No real learner review or new content approval was fabricated. The 15 real grammar questions and ten unavailable grammar objectives still require their explicit human decisions; the independent PDF transcription check remains unverified.

## Actual verification

Commands used `rtk proxy bun.cmd run <script>` with Node runtime/database execution. Docker Desktop and the existing localhost PostgreSQL service were started. Prisma generation and additive migration deploy ran after a verified pre-migration backup. No Git mutation ran.

| Check | Inspected result |
|---|---|
| `test` | 18 passed; 25 PostgreSQL cases intentionally skipped |
| `test:recovery` | 15 isolated PostgreSQL review checks passed; nonempty synthetic history restored; all 20 table fingerprints matched |
| `test:review --filter="existing hash-approved"` | Final comparison correction/approval/idempotency regression passed, including same-selection correction refusal |
| `test:canonical` | 10 isolated PostgreSQL import checks passed |
| `lint`, `typecheck`, `build` | Passed after application changes |
| `test:review:browser` | Two fixture checks and two production Edge flows passed: recall/refresh/stop/resume and dashboard/comparison/dictionary/attention |
| `test:browser` | Four production reference flows passed; two isolated review flows deliberately skipped |
| Real backup/restore | Before and after migration: all 20 table fingerprints matched in separate databases; real ReviewLog count was zero |
| Named runbook backup/restore | Exercised successfully; repeated restore refused the existing target without overwrite |
| `rtk git diff --check` | Passed |

PostgreSQL coverage includes duplicate/concurrent events, atomic rollback, stale-state conflict, ownership, full pinned state, process restart, timezone/DST boundaries, cross-session ceilings, sibling separation, missing context, backlog pause, objective independence and active-time persistence. Browser checks use synthetic records exclusively; Japanese entry, reveal gating, keyboard/focus, mobile clearance and explicit popup behavior are exercised. Desktop/mobile screenshots were inspected privately. External HTTPS was blocked during stored review; no AI provider/call is involved. Actual external-site availability is unverified.

See [backup recovery](backup-recovery.md) for exact exercised commands and limitations. Original PDFs/OCR/imports and private configuration need separate preservation. Restored targets/test databases remain separate for inspection; the app's private connection was not switched.

## Manual Git handoff

Implementation: package scripts; personal-release schema/migration; backup and isolated runner; dashboard/detail/review/API/layout/styles; budget/dictionary/study components; canonical comparison import and study/review server modules/types; focused unit, PostgreSQL and browser checks.

Documentation: AGENTS.md, README, architecture, database-import, documentation map, implementation-workflow, repository-structure, tooling_Verification, approved Phase 3 design, backup recovery, this handoff, and app/component/script READMEs. The Master Plan and historical Phase 2 handoff are unchanged. No later-phase preparation is bundled.

Excluded or uncertain: pre-existing graphify-out/cache/ and graphify-out/manifest.json; all private-data, .local, credentials, dumps/exports, screenshots, synthetic/restored databases, build output and test-results. bun.lock/dependency versions are unchanged. No new dependency was installed.

Execute these scoped commands manually after review:

```powershell
rtk git add -- package.json prisma/schema.prisma prisma/migrations/20261006010000_personal_release/migration.sql scripts/backup.mjs scripts/test-review-postgres.mjs src/app/page.tsx src/app/review/page.tsx src/app/api/review/route.ts 'src/app/[kind]/[id]/page.tsx' src/app/layout.tsx src/app/globals.css src/components/review.tsx src/components/daily-budget.tsx src/components/dictionary.tsx src/components/study-content.tsx src/lib/server/content/canonical-import.mjs src/lib/server/content/study.mjs src/lib/server/content/study.d.mts src/lib/server/review/service.mjs src/lib/server/review/service.d.mts tests/review-postgres.test.mjs tests/browser/review.spec.ts tests/browser/catalog.spec.ts tests/recovery.test.mjs tests/study-content.test.mjs
rtk git add -- AGENTS.md README.md docs/architecture.md docs/database-import.md docs/documentation.md docs/implementation-workflow.md docs/repository-structure.md docs/tooling_Verification.md docs/plans/2026-10-06-phase-3-design.md docs/backup-recovery.md docs/phase-3-handoff.md src/app/README.md src/components/README.md scripts/README.md
```

Suggested commit subject: `feat: add personal study dashboard, recall UX and verified recovery`

Graphify required: **yes**, after integration and confirmation that the default branch is clean and up to date. Do not regenerate against this uncommitted implementation. Index only approved engineering source; exclude all private and machine-local material. Generated paths will receive a separate handoff.

Antigravity brief, if selected: use this handoff, the approved design and Master Plan Phase 3 gate; maintain only the documentation paths above from actual evidence. Preserve pending learner-paced acceptance, blocked real grammar and PDF-quality limits. Sending this brief to another chat is not authorized.
