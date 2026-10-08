# Phase 3 content display and Neon follow-up — 8 October 2026

Authority: Master Plan §§2–4, 18–19 and the approved 8 October follow-up. This is a bounded correction to Phase 3, not completion of its pending learner-paced acceptance session or authorization for Phase 4.

## Implemented and published

All 38 kanji now have complete original generated meaning mnemonics stored as immutable supplementary explanation Content, with generated labels and retained WaniKani learning-component attribution. The user explicitly authorized these aids without a separate manual approval step; the existing importer captured fresh per-record provenance/approval receipts. Full WaniKani stories were not copied. The historical excerpt remains in source records, while the complete story replaces its display. Card rows were fingerprinted before and after publication and did not change.

Repeated words came from rendering approved dictionary explanations as standalone cards alongside book examples. Presentation now merges a unique approved matching word/reading supplement into its example, preserves independent/ambiguous readings and draft evidence, and does not edit book payloads. All 140 existing kanji book-example words already had readings; no new readings needed generation or collection. Per-word Meaning evidence and Sources & evidence panels are removed from detail study notes. Provenance remains accessible through source records and the entry-level source section.

Vocabulary has 145 distinct records: 108 textbook vocabulary entries and 37 kanji context references. The audit found zero exact duplicate groups across spelling, reading, part of speech and meaning. The catalog now displays this breakdown. Context records remain reference/support words and are not deleted or converted into core scheduled vocabulary.

The full existing local PostgreSQL database was transferred to the user-configured empty Neon database, preserving all 20 public tables, migration bookkeeping and learner records. All table fingerprints matched the backup before the active `.env` switch. The app was restarted on localhost port 3000 with Neon active. Local PostgreSQL remains for isolated tests and independent restore verification; there is no dual-write or synchronization engine. Original PDFs/imports remain local. The backup utility now supports TLS/direct Neon connections through the existing PostgreSQL Docker client. The active Neon server reports PostgreSQL 15.19. The PostgreSQL 17-to-15 migration removes only the unsupported `transaction_timeout` header from a private SQL export, then restores transactionally with stop-on-error.

Cloud compatibility: existing-card synchronization now reads non-retired objectives for the bounded 500-item pool once instead of probing every objective remotely. Missing cards use the existing creation/evidence path; existing states/prompts and eligibility rules are unchanged. Import transaction acquisition waits are explicitly bounded at 30 seconds; isolation and existing execution timeouts are retained, with edition confirmation using the same 30-second bound. The real active 193-item pool was verified within 23.4 seconds in a deliberately rolled-back transaction: zero cards would be created, and all writes were rolled back. The final build was restarted after this change.

## Verification

Final lint, typecheck and production build passed; `rtk proxy bun.cmd run test` had 23 passed and 26 intentionally skipped PostgreSQL cases. `rtk proxy bun.cmd run test:canonical` had 10 passed in a separate local database. `rtk proxy bun.cmd run test:browser` on the local data had four passed and seven synthetic-flow skips. All 38 real kanji pages passed complete-story, word uniqueness, reading and per-word disclosure checks locally. `rtk proxy node scripts/migrate-neon.mjs transfer-and-switch` completed the authorized transfer; its later safety revision additionally requires `--confirm-local-writers-stopped`. `rtk proxy bun.cmd run backup verify` backed up active Neon and verified its independent local restore. Both restore checks and the transfer matched all 20 table fingerprints. After the old server was stopped/restarted, local, Neon and the manifest were compared again: all 20 matched, so no source writes were missed during switching. Populated-Neon overwrite refusal was exercised successfully. `rtk git diff --check` and focused Node syntax/recovery/presentation checks passed.

The Neon vocabulary-count browser check passed. The exact screenshot page on the restarted active server passed all three affected-word uniqueness/reading checks, missing-excerpt/disclosure checks and mobile overflow checks; desktop/mobile captures were visually inspected. Impeccable's scoped detector reported no findings. The exhaustive 38-page Neon crawl exceeded both 120-second and 300-second aggregate limits while navigating, without a content assertion failure. The full remote crawl remains unverified; the complete local crawl and identical remote database fingerprints establish content/display coverage, while the active-server smoke establishes the connection switch. Remote page latency is a real limitation; Neon stored reviews now require internet. No additional broad crawl was run after the second timeout.

The first isolated Neon runner incorrectly ran canonical-import and review files concurrently against one shared synthetic database. It produced fixture write conflicts and accumulated-fixture transaction timeouts; the remaining long-running worker was stopped after about 14 minutes. Its report had 10 passed and 13 failed and is **not** a passing integration result. The initial sequential core run had two passed and one setup failure while acquiring an import transaction connection. After bounded acquisition waits and proportionate 2/1/1-record fixtures, a fresh sequential Neon run passed all four focused checks: duplicate/concurrent events with stale-state refusal, rollback, process restart/resume, and batched existing-card synchronization. Real study data was not used as a fixture target. A local full review run had 15 passed and one comparison-selection failure caused by unrelated prior fixtures entering the scenario; its isolated run passed. The comparison scenario now buries unrelated synthetic cards for presentation, leaving its own two targets eligible without changing FSRS/due dates. An initial suspension attempt was rejected by the new-card due-state constraint and was replaced with this valid presentation isolation. The final `rtk proxy bun.cmd run test:review` passed **16/16**, with zero skips or failures. The batched-lookup regression was observed failing before implementation (two per-card probes) and passing afterward (zero probes and identical card rows).

| Final check | Inspected result |
|---|---|
| `lint`, `typecheck`, `build` | Passed after the cloud compatibility changes |
| `test` | 23 passed; 26 PostgreSQL checks intentionally skipped by this unit command |
| `test:canonical` | 10/10 passed in isolated local PostgreSQL |
| `test:review` | 16/16 passed in isolated local PostgreSQL |
| Fresh sequential Neon transaction check | 4/4 passed; actual migrations deployed in that separate target |
| Full local reference browser suite | 4 passed; 7 synthetic-flow skips; all 38 kanji covered |
| Active final-build screenshot-page smoke | Passed; three affected words unique with readings, no excerpt notice/per-word evidence, no mobile overflow |
| Neon count browser check | Passed; 108 textbook + 37 context records |
| Full Neon 38-page crawl | Timed out during navigation at 120 and 300 seconds; not claimed passing |
| Transfer and recovery | 20/20 table fingerprints matched; local and active-Neon backups restored independently; post-restart source/target/manifest all matched |
| Actual active-pool sync dry run | 193 items; zero new cards; 23.4 seconds; all writes deliberately rolled back |
| Scoped code review and Impeccable detector | No outstanding targeted review findings; detector returned no findings |
| `rtk git diff --check` | Passed |

## Manual Git handoff

Implementation: `.env.example`, scripts/backup.mjs, scripts/canonical-import.mjs, scripts/migrate-neon.mjs, both existing isolated PostgreSQL runners, canonical importer connection waits, review synchronization, reference presentation module/type, catalog, detail/catalog pages, reference/mnemonic components and focused unit/PostgreSQL/browser tests.

Documentation: the narrowly authorized Master Plan addition, backup recovery runbook, Phase 3 handoff cross-reference and this follow-up. Existing files contain earlier uncommitted Phase 3/component changes; the commands below stage their complete current contents, not just this follow-up. Review their combined diffs or stage hunks manually if separate commits are wanted.

Integration prerequisite: include or integrate the existing [Phase 3 bundle](phase-3-handoff.md), [frontend follow-up](phase-3-frontend-followup.md) and [vocabulary component aid bundle](vocabulary-component-aids-handoff.md) first. This follow-up uses their existing components/migrations; its staging list alone is not a standalone release from the current committed baseline. Preserve their separate evidence, exclusions and pending acceptance gates.

Excluded: every other pre-existing edit/untracked file, `.env` and temporary connection files, all private-data/.local artifacts, mnemonic/source packets and approval receipts, backups/SQL exports, learner records, Graphify outputs/cache, node_modules, build output and test-results. No dependency or schema change was introduced by this follow-up. No Git mutation was executed.

```powershell
rtk git add -- .env.example scripts/backup.mjs scripts/canonical-import.mjs scripts/migrate-neon.mjs scripts/test-canonical-postgres.mjs scripts/test-review-postgres.mjs src/lib/server/content/canonical-import.mjs src/lib/server/review/service.mjs src/lib/server/content/reference-presentation.mjs src/lib/server/content/reference-presentation.d.mts src/lib/server/content/catalog.ts 'src/app/[kind]/page.tsx' 'src/app/[kind]/[id]/page.tsx' src/components/reference.tsx src/components/kanji-mnemonic.tsx tests/reference-presentation.test.mjs tests/recovery.test.mjs tests/review-postgres.test.mjs tests/browser/catalog.spec.ts tests/browser/browse.spec.ts FINALIZED_PROJECT_PLAN.md docs/backup-recovery.md docs/phase-3-handoff.md docs/phase-3-content-neon-followup.md
```

Suggested commit subject: `fix: complete kanji study aids and migrate study data to Neon`

Graphify required: **no** for this bounded presentation/content and equivalent PostgreSQL host follow-up. The pre-existing major Phase 3 milestone still requires its refresh after integration and confirmation of a clean, up-to-date default branch. Do not regenerate against this dirty checkout.

## Later clarification: local development, Neon publication

The user's later 8 October request supersedes the active-Neon development setting above. Docker is now the active local app connection; Neon already contains all prepared batches and remains the explicit target for subsequent batches and eventual hosting. [local-neon-workflow.md](local-neon-workflow.md) describes the small command wrapper and deliberate snapshot refresh. No schema/dependency, automatic synchronization, approval bypass for textbook facts, or deployment was introduced.

Study detail pages omit the accepted-addition limitation paragraphs and vocabulary component explanatory boilerplate. Source records retain these statements; origin badges remain. Existing Meaning/Sources evidence hiding and deduplication remain in effect.

A real Neon inventory initially failed its 30-second transaction limit due to one candidate query per entry, including with a direct connection. The inventory now fetches explicit candidate identities in groups of 50, bounded to 1,000 candidates per group (overflow fails closed), and retains the existing maximum 20 candidates per identity. Read-only inventory does not approve anything. Neon maintenance commands use the existing direct TLS connection helper. A repeated inventory for the real 108-record vocabulary batch succeeded; `alreadyApproved: 0` is an inventory field, not a change to published records or their stored approvals.

Verification: production build, lint and typecheck passed; Node suite 25 passed/26 integration skips; actual local PostgreSQL importer suite 10/10 passed. Focused browser test passed for AI origin badges with no detail limitation notices. Active-server checks confirmed the vocabulary copy is absent, local connection settings match Docker, and the three screenshot words remain unique with readings and no mobile overflow. The explicit Neon inventory succeeded while leaving the local app connection unchanged. A fresh Neon snapshot restored to a new local database with all 20 fingerprints matching; the previous database was preserved. No learner-history merge was attempted. The learner-paced Phase 3 acceptance gate remains pending.

Implementation for this clarification: package.json, .env.example, scripts/database-target.mjs, src/lib/server/content/canonical-import.mjs, src/components/reference.tsx, tests/database-target.test.mjs, tests/inventory.test.mjs, tests/browser/catalog.spec.ts. Documentation: Master Plan clarification, local-Neon workflow, recovery correction, and this handoff. Several listed files already contain earlier authorized uncommitted changes; review combined diffs or stage hunks for separate commits. Prior Phase 3/component integration prerequisites above still apply.

Excluded: `.env`, private source/approval packets, all private-data backups/inventories, `.local` helpers/screenshots, retained previous/synthetic databases, every unrelated edit, generated/build outputs and learner records. No Git mutation was executed.

```powershell
rtk git add -- .env.example package.json scripts/database-target.mjs src/lib/server/content/canonical-import.mjs src/components/reference.tsx tests/database-target.test.mjs tests/inventory.test.mjs tests/browser/catalog.spec.ts FINALIZED_PROJECT_PLAN.md docs/local-neon-workflow.md docs/backup-recovery.md docs/phase-3-content-neon-followup.md
```

Suggested commit subject: `fix: simplify study copy and separate local development from Neon imports`

Graphify required: **no** for this bounded follow-up; retain the existing major-milestone integration prerequisite.
