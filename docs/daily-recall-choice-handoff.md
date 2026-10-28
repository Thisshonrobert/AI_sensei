# Daily recall timing and paired-choice recall — handoff

Date: 18 October 2026. The learner approved amendment **A4**, choice mode as the default with automatic typed fallback, and keeping grammar cloze typed.

## Handoff summary

```text
Scope and Master Plan sections: daily recall timing and objective paired-choice recall (Master Plan §§8–10, 18–19; amendment A4; architecture "Recall correctness")
Implemented behavior: segmented active time with resume; server-generated four-option vocabulary/core-kanji recall with server-side grading and bilingual (hiragana + English) options, typed fallback, and Easy capped to Good
Implementation paths: see "Implementation paths" below
Documentation paths: FINALIZED_PROJECT_PLAN.md, docs/architecture.md, docs/tooling_Verification.md, docs/daily-recall-choice-handoff.md, docs/plans/2026-10-18-daily-recall-choice-mode.md
Excluded or uncertain paths: scripts/dev-server.mjs, tests/dev-server.test.mjs, graphify-out/cache/, graphify-out/manifest.json (pre-existing untracked; do not stage)
Verification performed: 3 timing unit tests, 12 combined unit tests, 25 isolated PostgreSQL review tests, read-only real-database option checks (75/85 core-kanji meaning sets bilingual, 0 language-mixed), clean lint/typecheck/build, 3 synthetic + 8 Playwright browser tests, repair dry run, and a read-only real-database view check
Remaining limitations: recognition is easier than production; a genuine >15-minute single-card pause is treated as idle; the choice set changes with stateVersion; grammar cloze, 10 of 85 core-kanji meaning cards (Japanese-only source gloss without a dictionary entry) and small pools stay typed; no AI validation
Graphify required: yes — new review/timing.mjs and review/choices.mjs modules and edges; regenerate only after the default branch is clean and current, and do not run it automatically
Next bounded scope: after roughly two weeks of real choice use, inspect review logs for inflated recall and decide whether a production check is needed for stable cards
```

## What changed

### 1. Active time is segmented and restart-safe

- `src/lib/server/review/timing.mjs` adds `IDLE_GAP_MS` (15 minutes), `sessionElapsedMs` and `hasIdleGap`. Saved `elapsedActiveMs` is retained; an open segment accrues only while it is at most 15 minutes old. A closed laptop or abandoned tab can no longer turn wall-clock days into active minutes.
- `startSession` completes or reactivates a prior session without counting an abandoned segment. `resumeSession` starts a new segment for a paused or stale active session. `stopSession` saves the clamped total. `SessionView.idleTooLong` is exposed.
- `POST /api/review {action:'resume'}` is new. The review page resumes an active session on mount, guards the client ticker with visibility and recent activity, and displays a clamped value.
- `scripts/repair-session-timing.mjs` is a one-time dry-run/apply repair (not applied).

Diagnosed defect: one open daily session had `activeSince` 4,735 minutes old and reported roughly 4,724 active minutes (budget 30). After the fix the same session reports `elapsedActiveMs=0`, `idleTooLong=true`, `timeBudgetReached=false`; resuming starts a fresh segment.

### 2. Scheduled recall uses a four-option objective choice

- `src/lib/server/review/choices.mjs` builds the set deterministically from approved, source-verified items. Every option is a real hiragana reading paired with a real English meaning, so no option can be identified by its language. Vocabulary options pair the source reading with its meaning and deliberately isolate the components (`same_reading`, `same_meaning`, `unrelated`); core-kanji meaning options pair an English meaning with a reading drawn from a source example word (or the kanji's own on/kun reading when no example word's gloss matches). All four kanji options use the same kind of reading, so the correct option is never the odd one out. There is no AI, no network and no invented Japanese at review time.
- Unsafe decoys are rejected: the prompt word, an exact reading+meaning pair, an accepted gloss, and same-reading meanings that overlap the correct meaning. If fewer than three safe decoys exist, `recall` is `null` and the existing typed form is used.
- The view exposes only option text (`id`, `reading`, `meaning`) plus a format and fingerprint. It never sends `answerSpecJson`, `correctChoiceId` or `tier` before commitment. The offered set is stored in the immutable Attempt prompt snapshot.
- `commitResponse` validates the fingerprint, grades the selected option server-side (`grader='objective'`), and writes `readingCorrect`/`meaningCorrect`/`correct`. The client cannot supply components for an objective attempt; `rate` derives them from the stored feedback, caps `Easy` at `Good`, and records `requestedRating`/`effectiveRating`.
- The UI renders a keyboard-accessible radio group (keys `1`–`4`), commits before reveal, shows the selected pair and objective feedback, hides the self-assessment checkboxes for objective attempts, disables `Easy`, and falls back to typed entry automatically.
- Grammar cloze stays typed, as approved. No Prisma migration, dependency or new table was introduced; old Attempts keep `grader='self'`.

### 4. Core-kanji options show an English meaning with a hiragana reading

The kanji-meaning set previously offered one English source meaning beside Japanese-only glosses from other kanji records, so the English option announced itself as the answer. Options are now paired: a hiragana reading plus an English meaning on every option, drawn from a source example word whose dictionary gloss matches the kanji's meaning. When no example word matches, all four options fall back to the kanji's own on/kun reading, in the same kind, and the correct option is never the only bare reading next to whole-word readings. A reading is never invented, and a card that cannot produce three safe same-kind decoys keeps typed entry.

### 3. Documentation and amendment
- `FINALIZED_PROJECT_PLAN.md` records A4, updates §8, the §9 open-ended-recall row, and the §18 phase-2 acceptance check.
- `docs/architecture.md` adds the choice boundary to "Recall correctness".
- `docs/tooling_Verification.md` records the commands, results and the two test-only adjustments below.

### 5. Recall-before-study follow-up — 19 October 2026

The learner reported that reading the answer before the quiz made the choice trivial. A new scheduled card now shows its recall question first. The first `commitResponse` performs the activation that `introduce` used to perform (daily allowance and backlog checks, `Card` status/`introducedAt`/`introductionDay`/`dueAt`, `UserItem` first-study record, sibling burying) inside the same locked transaction, then writes the Attempt; the correct answer is revealed and the learner rates. The stored study reference is an optional collapsed **Read this card** control after reveal, so it cannot spoil the answer. `viewInTransaction` now builds the four-option set for `new` as well as `active` cards. The `introduce` endpoint is retained unchanged for compatibility and tests, but the review screen no longer calls it. No schema, dependency or scheduler change.

## Implementation paths

- `src/lib/server/review/timing.mjs`, `timing.d.mts`
- `src/lib/server/review/text.mjs`, `text.d.mts`
- `src/lib/server/review/choices.mjs`, `choices.d.mts`
- `src/lib/server/review/service.mjs`, `service.d.mts`
- `src/app/api/review/route.ts`
- `src/components/review.tsx`, `src/app/globals.css`
- `scripts/repair-session-timing.mjs`
- `tests/review-timing.test.mjs`, `tests/review-choices.test.mjs`
- `tests/review-postgres.test.mjs`, `tests/browser/review.spec.ts`

## Verification commands and results

```powershell
rtk proxy node --test --test-isolation=none tests/review-timing.test.mjs
rtk proxy node --test --test-isolation=none tests/review-choices.test.mjs tests/review-scheduler.test.mjs tests/review-timing.test.mjs
rtk bun run test:review
rtk bun run lint
rtk bun run typecheck
rtk bun run build
rtk bun run test:review:browser
rtk proxy node scripts/repair-session-timing.mjs
```

- Timing unit tests: 2 passed.
- Combined unit tests: 9 passed.
- Isolated review integration suite: 25 passed, 0 failed.
- Lint, typecheck and production build: clean/successful.
- Browser: 3 synthetic setup tests and 8 Playwright tests passed, desktop and 375 px.
- Repair dry run: `{"open":1,"stale":1,"apply":false}`.
- Read-only real-database check: `elapsedActiveMs=0`, `idleTooLong=true`, `timeBudgetReached=false`, 4 `vocab_pair` choices, and no `correctChoiceId`, `tier`, `answerSpecJson` or committed `answer` in the unrevealed payload.

### Two deliberate test-only adjustments

1. The plan's sample stale-session test credited a 20-minute open segment, which the plan's own 15-minute idle threshold classifies as idle. Tests use 10-minute segments and add a second stop/resume segment; the 25-minute budget assertion is preserved. Production behavior keeps the 15-minute threshold.
2. The browser runner's three synthetic fixtures now import distinct meanings instead of the shared `test sense N`. Shared meanings are correctly rejected as ambiguous same-reading decoys, so without distinct meanings the browser pool could not exercise the choice UI. Direct `Vocabulary.meaningEn` updates are blocked by the immutable-revision trigger; the change is at fixture import only.

## Human source checks

None. This work did not verify PDFs, textbook facts, readings, meanings or the real learner's content quality. Choice options are drawn from already-approved items; a source correction still requires the existing review path.

## Remaining limitations

- **Recognition is easier than production.** A4, `grader='objective'`, the `Easy` cap, the stored `choiceFormat` and typed fallback keep this visible. Revisit only after real use suggests inflated recall.
- **Core-kanji options need a dictionary match.** 75 of 85 core-kanji meaning cards currently build a bilingual set; the 10 that do not (Japanese-only source gloss with no matching dictionary entry) keep typed entry. No reading or meaning is fabricated to fill the gap.
- **Bare readings.** When no source example word matches the kanji's meaning, all four options use the kanji's own on/kun reading. The reading kind is uniform across the four options by construction; a mixed set is impossible.
- **Idle cutoff.** A genuine pause longer than 15 minutes on one card is not counted; the next resume starts a new segment. The block budget is 15–60 minutes and cards are short, so this is deliberate.
- **Option set changes with `stateVersion`.** Reloading before commitment keeps the same set; a new rating changes it, which prevents memorising positions.
- **Small pools.** A new or isolated item without three safe decoys uses typed entry. No reading or meaning is fabricated to fill the gap.
- **Kanji reading choice** needs at least three other active/new contextual-reading cards in the local pool.
- **No AI validation or generation** is part of the review path.
- The stale-session repair was left as a dry run; `--apply` is optional and either state is resumable.

## Git handoff (manual only)

Do not stage the pre-existing untracked files. Suggested scoped commands and subjects:

```powershell
rtk git add -- src/lib/server/review/timing.mjs src/lib/server/review/timing.d.mts src/lib/server/review/text.mjs src/lib/server/review/text.d.mts src/lib/server/review/choices.mjs src/lib/server/review/choices.d.mts src/lib/server/review/service.mjs src/lib/server/review/service.d.mts src/app/api/review/route.ts src/components/review.tsx src/app/globals.css scripts/repair-session-timing.mjs tests/review-timing.test.mjs tests/review-choices.test.mjs tests/review-postgres.test.mjs tests/browser/review.spec.ts
```

Suggested subject: `feat: add segmented recall timing and objective paired-choice recall`

```powershell
rtk git add -- FINALIZED_PROJECT_PLAN.md docs/architecture.md docs/tooling_Verification.md docs/daily-recall-choice-handoff.md docs/plans/2026-10-18-daily-recall-choice-mode.md
```

Suggested subject: `docs: record paired-choice recall amendment and verification`

Graphify required: **yes**, because `review/timing.mjs` and `review/choices.mjs` add new modules and edges. Regenerate only after the default branch is clean and up to date; do not run it automatically.
