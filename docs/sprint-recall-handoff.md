# Sprint daily recall and match practice — handoff

Date: 26 October 2026. Amendment **A6**, approved by the learner. Design: [docs/plans/2026-10-26-sprint-recall-and-match.md](plans/2026-10-26-sprint-recall-and-match.md). Plan: [docs/plans/2026-10-26-sprint-recall-and-match-implementation.md](plans/2026-10-26-sprint-recall-and-match-implementation.md).

## Handoff summary

```text
Scope and Master Plan sections: daily recall selection, workload control and kanji objectives (Master Plan §§8–10, 18–19; amendment A6; architecture "Recall correctness")
Implemented behavior: studied items enter recall at once under per-type daily caps (100/40/10) split 70% first recall / 30% due, due cards by lowest retrievability; Again returns once per session; Review more (20); one core-kanji objective; read-only match game
Implementation paths: see "Implementation paths"
Documentation paths: FINALIZED_PROJECT_PLAN.md, docs/architecture.md, docs/tooling_Verification.md, docs/sprint-recall-handoff.md, docs/plans/2026-10-26-sprint-recall-and-match*.md
Excluded or uncertain paths: src/lib/server/generation/ (separate Gemini work), scripts/dev-server.mjs, tests/dev-server.test.mjs, graphify-out/ (pre-existing; do not stage with this work)
Verification performed: see docs/tooling_Verification.md (unit 136/0, review 39/39, browser 9/9, tsc, lint, build)
Remaining limitations: grammar recall unchanged; caps are not time-aware
Graphify required: yes — new review/selection.mjs and practice/match.mjs modules and edges
Next bounded scope: after a week of sprint use, check daily answered counts against caps and whether 30% due share keeps the due backlog flat
```

## What changed

1. **Selection (`src/lib/server/review/selection.mjs`).** `splitCap`, `retrievability` (ts-fsrs `get_retrievability`) and `planQueue`. Per type: up to 70% of the remaining cap for first recalls of studied items (oldest study first) and at least 30% for due cards by ascending retrievability; a short tier's share flows to the other. Siblings are skipped.
2. **Service (`src/lib/server/review/service.mjs`).**
   - `dailyReviewCaps` setting with `updateCaps`. The caps count distinct cards answered in the study day (`Asia/Calcutta` midnight).
   - Removed: activation allowances, "Add another batch", backlog pause, new-card deferral while reviews are due, cards of never-studied items, and `includeNew`.
   - Snapshot `policyVersion: 2` with `mode: 'daily' | 'more'`. Session selections remain immutable (DB trigger). A card whose first review in the session was Again returns once at the end, derived from the session's review logs, so retries cannot add more.
   - `commitResponse` accepts any card in the session's selection before its FSRS due time; `startSession({reviewMore:true})` offers up to 20 not-due cards and returns `{id:null}` when none exist.
   - Kanji: `kanji_reading_context` cards are no longer created; the kanji-meaning cue is "Choose the reading and meaning."
3. **Retire script (`scripts/retire-kanji-reading-cards.mjs`).** Dry run by default; `--apply` sets `status='retired'`. Prints counts only. Idempotent; logs are kept.
4. **API and screens.**
   - `/api/review`: `start {reviewMore?}`, `caps`. Removed `activationLimits` and `extraBatch`.
   - Review screen: one "Start daily review" button, "Review more (20)", "Again" tag, "Reviewed today" against caps.
   - Dashboard: caps editor (`review-caps.tsx` replaces the deleted `activation-controls.tsx`) and a Practice card linking to Match.
5. **Match game.**
   - `src/lib/server/practice/match.mjs` and `GET /api/practice/match?kind=vocabulary|kanji`, which are read-only.
   - `src/components/match-game.tsx` and `/practice/match`: 6 pairs, tap word then meaning, +1 s per miss, best time in `localStorage`. Candidates are reviewed cards not due before the next study day and not pending in an open session.

## Final review

A fresh reviewer approved with fixes: 0 Critical, 2 Important. Both are fixed, test first.
- An open session from an earlier study day is now completed, so today's queue is built fresh. The dashboard and `GET /api/review` only offer a same-day session through `currentSession`.
- "Review more" answers do not count toward the daily cap.

Deferred minor findings:
- Stale `includeNew` arguments in the assessment and generation PostgreSQL tests, and "activation allowances" copy in `daily-budget.tsx` and `assessment.tsx`.
- Performance: `fsrs()` is built per card, the review-more load is unbounded, the dashboard computes the queue, and the `reviewedAt` day filter cannot use an index.
- Skipped siblings are not backfilled when a session is planned.
- Match de-duplicates answers only, so homographs can give identical Japanese tiles.
- Match accessibility: misses and matches are not announced, and focus is lost when a tile hides.
- Empty daily starts create empty sessions.
- Old open sessions gain derived Again repeats.

## Rewritten tests (old assertion → new)

- `flexible activation allowances persist…` and `flexible deliberate extra allowance…`: deleted. Replaced by `daily caps validate, persist and show on the dashboard`.
- `global eight and 5/2/1 type caps…` → `per-type daily caps hold for vocabulary, kanji and grammar…`: caps 5/2/1, with a used object that has no `total`.
- `heavy backlog pauses all new introductions…` → `heavy backlog no longer blocks first recall…`: 4 new + 41 due in one session.
- `learning step becoming due interrupts introductions…` → `a due learning card does not defer first recall of studied items`.
- `flexible parallel activation cannot overspend…` → `parallel starts share one session, double introduce has one effect, and re-marking keeps cards`.
- `source-complete core creates exactly two independent objectives…` → `…exactly one kanji objective with a reading-and-meaning cue`.
- `contextual reading, vocabulary and kanji meaning successes never propagate…` → `a kanji meaning success never propagates scheduler state to other cards`.
- Waiting pool: partial/blocked/missing 1/2/2 → 0/1/1. 135-item study: 165 dormant objectives → 135.
- Dashboard test: `used.vocabulary` 1 → 0 (introducing is not answering); introduced 1 → 2 (the fixture now marks items studied); empty-session budget 20 → 30.
- Study-date assertions now expect the preserved earlier study time.
- The fixture gained `studied` (default true). The browser seed marks synthetic vocabulary studied.

## Human source checks

None. No PDFs, readings or meanings were verified. Match and choice text come from already-approved items.

## Real-database rollout

- The backup completed at ignored `private-data/backups/pre-sprint-recall-20261026-b` (21 tables). An earlier attempt at `…-20261026` failed; its partial folder is not a usable backup.
- Retire step **applied on 26 October 2026** with the learner's approval: 138 `kanji_reading_context` cards retired, 0 remaining, review logs unchanged (34). The first attempt failed on the `card_due_state` check for never-reviewed cards. The script now sets their `dueAt` from their own stored FSRS state, and the retire test covers that case.
- First daily session estimate (read-only): 97 vocabulary (96 first recalls + 1 due), 28 kanji (27 + 1).

## Git handoff (manual only)

```powershell
rtk git add -- src/lib/server/review/selection.mjs src/lib/server/review/selection.d.mts src/lib/server/review/service.mjs src/lib/server/review/service.d.mts scripts/retire-kanji-reading-cards.mjs scripts/test-review-postgres.mjs tests/review-selection.test.mjs tests/review-postgres.test.mjs
```

Suggested subject: `feat: sprint daily recall caps, retrievability order and in-session repeats`

```powershell
rtk git add -- src/app/api/review/route.ts src/components/review.tsx src/components/review-caps.tsx src/components/activation-controls.tsx src/app/page.tsx src/app/globals.css src/lib/server/practice/match.mjs src/lib/server/practice/match.d.mts src/app/api/practice/match/route.ts src/components/match-game.tsx src/app/practice/match/page.tsx src/app/practice/page.tsx tests/match-pairs.test.mjs tests/browser/review.spec.ts
```

Suggested subject: `feat: daily review screen, caps editor and read-only match game`

```powershell
rtk git add -- FINALIZED_PROJECT_PLAN.md docs/architecture.md docs/tooling_Verification.md docs/sprint-recall-handoff.md docs/plans/2026-10-26-sprint-recall-and-match.md docs/plans/2026-10-26-sprint-recall-and-match-implementation.md
```

Suggested subject: `docs: record sprint recall amendment A6 and handoff`

**Overlap with uncommitted work.** `service.mjs`, `service.d.mts`, `review.tsx`, `route.ts`, `globals.css`, the two test files and the master-plan and architecture docs also contain the uncommitted choice-mode work (`docs/daily-recall-choice-handoff.md`). Commit that first if the history should keep the two features apart.

Graphify required: **yes**. Regenerate only after the default branch is clean.
