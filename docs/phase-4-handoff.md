# Phase 4 cumulative assessment handoff — 8 October 2026

Authority: FINALIZED_PROJECT_PLAN.md §§4, 11–13, 18 and weekly timing checks; [implementation plan](plans/2026-10-08-phase-4.md). The learner declared Phase 3 complete and authorized Phase 4. **Assessment implementation is present; full live-content acceptance is pending a human-reviewed eligible bank.** No real question was approved during engineering work. The existing 15 deferred questions remain draft; source-transcription acceptance still does not independently verify their answers or target links. Phase 5 was not started.

## Implemented

**Learner acceptance update — 8 October 2026:** the learner declares the base Phase 4 complete except for Graphify. This acceptance does not approve the existing draft questions or establish a populated live-content test. The approved extension below is separate pending work; the verification recorded here applies to the base assessment implementation only.

`/weekly` supports a mixed 20-question request and domain-only samples. Largest-remainder domain/stratum allocation, seeded ties, weak/recent/older/baseline eligibility, least-recent target preference, seven-day question-repeat avoidance and explicit answer-exposure conflicts use bounded SQL-backed records. Due status and active cards do not gate tests. Zero baseline works. Unseen/excluded N2 cannot fill shortages; sparse banks produce shorter tests with coverage/omission reports. A reading segment requires two nonconflicting questions attached to one approved eligible passage. Passage target links constrain eligibility without duplicating directly assessed targets.

The server stores selected complete question/rubric revisions, target IDs, strata, order, seed/policy, reading budget and passage text. Committed responses are durable/idempotent and cannot be edited. Unfinished HTTP views omit answers and feedback. Same-origin localhost requests, ownership checks and the existing user-row lock protect mutations. Daily and weekly sessions coexist; all daily queries/mutations now explicitly require daily mode.

The reading timer starts on explicit passage presentation, after committing short answers. Its server deadline survives refresh/backgrounding; furigana Off is frozen. Late responses are rejected and expired reading remains ungraded. Subsequent continuation creates a separate assisted practice session and preserves the timed result. Completed tests expose checked explanations, rule grades or self-scoring; vocabulary requires reading **and** selected meaning. Equivalent English paraphrases can be accepted through the rubric. Outcome summaries persist alongside timing, and assisted/expired/ungraded responses are excluded from unaided accuracy. Results never imply scaled JLPT scores or mastery.

Incorrect primary targets receive attention; the report offers at most three explicit reference-repair links. It creates/activates no cards. Any committed question can be reported as ambiguous, including rule-graded questions: the original grade/rubric remains in evidence, the effective result becomes ungraded, and that version is excluded from future tests. Ambiguity reporting does not infer a new learner failure. Confirmed validation errors unlock answer inputs; uncertain saves retain the original event/payload for exact retry.

The [bank contract](assessment-bank.md) provides explicit private user-authored intake with checked answer/support assertions and an exact hash/reviewer gate. Book content keeps canonical provenance/approval. No dependency, new table, AI provider or automatic source approval was added. Interactive study-reader annotations/five aids remain Phase 5 work; Phase 4 renders frozen plain text and post-test explanations/practice.

## Verification

| Command/check | Inspected result |
|---|---|
| `rtk proxy bun.cmd run test` | 33 passed, 35 database cases intentionally skipped; zero failures |
| `rtk proxy bun.cmd run test:assessment` | 9/9 isolated localhost PostgreSQL cases passed |
| `rtk proxy bun.cmd run test:review` | Final rerun against both migrations: 16/16 passed, zero skips/failures |
| `rtk proxy bun.cmd run lint` | Passed after review fixes |
| `rtk proxy bun.cmd run typecheck` | Passed after review fixes |
| `rtk proxy bun.cmd run build` | Passed after review fixes; `/weekly` and both mutation routes are Node/dynamic |
| `rtk proxy bun.cmd run test:assessment:browser` | Production Edge flow passed; one intentionally skipped active-library-only smoke |
| Read-only active-library Edge smoke on port 3102 | Passed unavailable-content/disabled-start, keyboard skip link and 375px overflow checks; desktop/mobile captures inspected privately |
| `rtk proxy bun.cmd run backup verify` | Before/after migrations, separate-target restore matched all 20 public table fingerprints |
| Active migration deploy/fingerprint check | Both additive migrations applied to the backed-up active local target; all existing data-table fingerprints unchanged, except expected migration bookkeeping |
| `rtk proxy bun.cmd run test:assessment:neon` | Final corrected-fixture run: 9/9 passed, zero skips/failures, in a fresh Neon database; approximately six minutes. Initial run had 6 passed and 2 fixture-setup failures at the default 5-second transaction timeout, corrected to the existing 30-second transaction bound. No live Neon data was used as fixtures. |
| Independent focused code review | Three P2 findings reproduced/fixed; focused recheck found no material remaining regression |
| `rtk git diff --check` | Passed; new files separately inspected |

The database tests exercise saved/repeated selection, hidden answers, ownership, exact retries, daily/weekly separation, nonempty passage targets, deadline persistence/late refusal, separate assisted continuation, rollback, enabled baseline/unseen/excluded targets, hash/idempotency gates and both self/rule ambiguity repair. A populated Card set and existing immutable ReviewLog were compared before/after assessment/self grading and remained identical. Browser verification includes correction after a synthetic confirmed validation rejection, commitment/reload, frozen deadline, hidden feedback, persisted component self-score, mobile wrapping and cross-origin refusal.

The active `.env` **and** inherited process connection classified as local during this work. Earlier Neon-active documentation is historical; no connection setting was switched. Neon compatibility verification uses only the explicit configured `POSTGRES_DATABASE_URL` in a fresh isolated remote database. Synthetic targets/logs remain private for inspection. No real source/learner rows were used as fixtures.

## Remaining gate and handoff

The learner must review actual question answers, primary targets, supporting constructions/distractors and any passage before scored publication. This is the remaining content gate, not permission to redesign Phase 4. No full live weekly test or source accuracy is claimed from synthetic tests. Availability is explicit until a valid approved/introduced pool exists. User-authored revision-editor tooling, interactive reading aids and generated practice remain deferred.

Implementation: `package.json`; both new assessment migrations; `scripts/assessment-bank.mjs`; `scripts/test-assessment-postgres.mjs`; `src/lib/server/assessment/`; `src/lib/server/review/service.mjs`; `src/app/api/assessment/route.ts`; `src/app/api/review/route.ts`; `src/app/weekly/page.tsx`; `src/components/assessment.tsx`; scoped `src/app/page.tsx`/`globals.css` changes; three assessment Node files and `tests/browser/assessment.spec.ts`.

Documentation: `AGENTS.md`, `FINALIZED_PROJECT_PLAN.md` (explicit learner acceptance/authorization record), `README.md`, this handoff, bank contract, implementation plan, Phase 3 acceptance update and affected architecture/import/tooling/document-map/workflow/repository summaries. These are intentional Phase 4 status updates; no later-phase implementation is bundled.

Excluded: pre-existing untracked `graphify-out/cache/` and `graphify-out/manifest.json`; all existing graph outputs; `.local/` diagnostics/screenshots/deployment helpers; all private bank fixtures/backups/imports; secrets and connection files; dependencies/build/browser output. Git remains untouched.

**Graphify required: yes** for the implemented assessment architecture milestone, after integration and learner confirmation that the default branch is clean and up to date. Do not regenerate now or include current machine-local graph caches.

Suggested manual staging command:

```powershell
rtk git add -- package.json prisma/migrations/20261008000000_cumulative_assessment/migration.sql prisma/migrations/20261008010000_assessment_repairs/migration.sql scripts/assessment-bank.mjs scripts/test-assessment-postgres.mjs src/lib/server/assessment src/lib/server/review/service.mjs src/app/api/assessment/route.ts src/app/api/review/route.ts src/app/weekly/page.tsx src/components/assessment.tsx src/app/page.tsx src/app/globals.css tests/assessment-bank.test.mjs tests/assessment-postgres.test.mjs tests/assessment-selection.test.mjs tests/browser/assessment.spec.ts AGENTS.md FINALIZED_PROJECT_PLAN.md README.md docs/plans/2026-10-08-phase-4.md docs/phase-4-handoff.md docs/assessment-bank.md docs/phase-3-handoff.md docs/architecture.md docs/database-import.md docs/tooling_Verification.md docs/documentation.md docs/implementation-workflow.md docs/repository-structure.md
```

Suggested commit subject: `feat: implement cumulative assessment and persistent timed reading`

## Approved Phase 4 extension — implementation pending

The learner approved recording every deliberately studied item while pacing review activation in manageable batches. The authoritative behavior and acceptance gate are in [Master Plan §8](../FINALIZED_PROJECT_PLAN.md#phase-4-extension-flexible-study-completion-and-review-activation) and §18. Add Mark as studied to each vocabulary, kanji and grammar detail page; show the waiting/active/unavailable states and adjustable activation allowances, including explicit extra batches. Studied marking creates no synthetic FSRS event. Approved weekly questions may target studied items before card activation; tests remain cumulative samples with honest omissions.

Study starts **10 October 2026**. Use **15 December 2026** as a provisional preparation deadline, not a verified exam date: **66 study days** precede it (10 October–14 December inclusive). Workday study time and a personal daily target are unspecified. This update records approved scope only; no extension UI, database behavior or test is claimed implemented.

Documentation scope: `FINALIZED_PROJECT_PLAN.md`, `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/implementation-workflow.md`, `docs/phase-4-handoff.md`. Implementation: none in this update. Excluded: all pre-existing application/test/package/migration changes, other documentation changes, graph outputs/caches and private data. These six files also contain earlier uncommitted Phase 4 work: full-file staging includes that work and is not an extension-only commit. Keep the existing base-phase bundle separate in intent when reviewing the combined diff.

Verification for this documentation update: the changed prose was inspected; `rtk git diff --check -- FINALIZED_PROJECT_PLAN.md AGENTS.md README.md docs/architecture.md docs/implementation-workflow.md docs/phase-4-handoff.md` passed for tracked changes, and the untracked handoff was inspected separately. PowerShell date subtraction independently returned 66 days. Application checks were not rerun for prose-only changes; extension acceptance remains unverified.

**Graphify required: no** for this documentation-only extension approval. The base Phase 4 milestone's Graphify follow-up remains pending integration and confirmation that the default branch is clean/up to date.

After reviewing the earlier Phase 4 edits in these shared files, the exact manual staging command for these documentation paths is:

```powershell
rtk git add -- FINALIZED_PROJECT_PLAN.md AGENTS.md README.md docs/architecture.md docs/implementation-workflow.md docs/phase-4-handoff.md
```

Suggested subject for the reviewed documentation bundle: `docs: record phase 4 acceptance and flexible study extension`
