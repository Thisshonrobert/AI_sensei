# Sprint Daily Recall and Match Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studied items reach recall immediately under per-type daily caps (70/30 first-recall vs due, lowest retrievability first). Missed cards return once in-session. Review more is available on request. Kanji become one card. A read-only Quizlet-style match game is added.

**Architecture:** A new pure module `review/selection.mjs` decides the cap split and ordering. `service.mjs` calls it from `startSession` and drops the activation-allowance machinery. A new read-only `practice/match.mjs` serves the game through its own GET route. There is no schema migration: settings and snapshot shape live in existing JSON columns.

**Tech Stack:** Next.js (repo-local version; read `node_modules/next/dist/docs/` before touching routes/pages), Node, Prisma + local PostgreSQL, ts-fsrs 5.4.2, zod, `node --test`, Playwright. Bun runs scripts.

**Spec:** [docs/plans/2026-10-26-sprint-recall-and-match.md](2026-10-26-sprint-recall-and-match.md) (approved 26 Oct 2026). Read it before any task.

## Global Constraints

- Prefix shell commands with `rtk` (`rtk proxy` when no filter exists). Use Bun for scripts and Node for runtime.
- **No commits by the implementer.** Each task ends with the scoped `rtk git add -- <paths>` command and a suggested subject for the learner. Never use broad staging.
- Never print DB credentials, API keys or learner data. Real-DB checks print aggregates only.
- No new dependency, table or Prisma migration.
- Caps default `{vocabulary:100, kanji:40, grammar:10}`, setting key `dailyReviewCaps`. Each is an integer from 0 to 300.
- Split: first-recall tier ≤ `Math.floor(0.7*remaining)`, due tier ≤ `Math.ceil(0.3*remaining)`. Unused share flows to the other tier.
- Retention stays 0.90; the FSRS configuration is unchanged.
- The match game writes nothing: no Attempt, ReviewLog, Card, StudySession or activity row, and no FSRS call.
- Match: 6 pairs per round, minimum 3, +1 s per miss, best time in `localStorage` (try/catch).
- Grammar recall behaviour is out of scope; grammar cards only pass through the same caps (cap 10).
- The working tree already holds uncommitted choice-mode work in `service.mjs`, `review.tsx` and others. Build on it; do not revert it. Do not touch `src/lib/server/generation/`.
- Verification before claims: `rtk bun run test`, `rtk bun run test:review`, `rtk proxy npx tsc --noEmit`, `rtk bun run lint`, `rtk bun run test:review:browser`.

## Review Focus

1. **Open version-1 session at release.** The real DB has one open daily session with a v1 snapshot. It must still render, accept answers and complete under the new rules, with no crash on a missing `mode` or repeated entries. Test in Task 3.
2. **Double-submitted Again rating.** Retrying `rate` with the same `clientEventId` must not re-queue the card a second time. The replay path returns before re-queueing. Test in Task 3.
3. **Local-midnight cap reset.** Caps count reviews in the learner's study day (`Asia/Calcutta`), not UTC. Answers at 23:50 and 00:10 local count against different days. Test in Task 2.
4. **Review more with nothing left.** When every active card is due or none exist, Review more returns an empty session view with a message, not an error. Test in Task 3.
5. **Match with a thin pool or no readings.** Fewer than 3 eligible pairs gives `{pairs:[]}` and the "Study and review more items first" message. A kanji with no on/kun reading shows the meaning only. Test in Task 6.

---

### Task 1: Pure selection module

**Files:**
- Create: `src/lib/server/review/selection.mjs`, `src/lib/server/review/selection.d.mts`
- Test: `tests/review-selection.test.mjs`

**Interfaces:**
- Produces:
  - `DEFAULT_CAPS = {vocabulary:100,kanji:40,grammar:10}`
  - `splitCap(remaining:number, waiting:number, due:number) => {first:number, due:number}`
  - `retrievability(state:object, now:Date, config:{parameters:object}) => number`: 0 for `state.state===0` (new), otherwise `fsrs(config.parameters).get_retrievability(state, now, false)`
  - `planQueue({waiting:Card[], due:Card[], caps, used, now, config, siblings:(a,b)=>boolean}) => Card[]`. `Card` is the Prisma card row; `used` is `{vocabulary,kanji,grammar}` answered today. `waiting` is pre-sorted oldest study first. `planQueue` sorts `due` by ascending retrievability (ties by `dueAt`, then `id`). Per type it takes `splitCap(caps[t]-used[t], …)`, skipping cards that are siblings of an already chosen card. Output order: all chosen first-recall cards, then due cards.
  - `category(card) => 'vocabulary'|'kanji'|'grammar'`: move this from `service.mjs` and import it there.

- [ ] **Step 1: Write the failing tests**

```js
test('splitCap holds 70/30 and flows unused share', () => {
  assert.deepEqual(splitCap(100,150,80), {first:70,due:30});
  assert.deepEqual(splitCap(100,20,80),  {first:20,due:80});
  assert.deepEqual(splitCap(100,150,5),  {first:95,due:5});
  assert.deepEqual(splitCap(0,10,10),    {first:0,due:0});
  assert.deepEqual(splitCap(7,10,10),    {first:4,due:3});
});
test('planQueue orders due by lowest retrievability and respects per-type caps and siblings', ...);
// Build due cards from ts-fsrs createEmptyCard + schedule() with different stabilities.
// Assert: the lower-retrievability card comes first; vocabulary cap 2 with 3 waiting + 3 due gives 1 first + 1 due (floor 1.4=1, ceil .6=1);
// a sibling pair yields one card; kanji is unaffected by the vocabulary cap; used counts reduce remaining.
test('retrievability is 0 for new state and in (0,1] for reviewed state', ...);
```

- [ ] **Step 2: Run them and confirm they fail.** `rtk proxy node --test tests/review-selection.test.mjs` should fail with a module-not-found error.
- [ ] **Step 3: Implement `selection.mjs` and `selection.d.mts`** to the interfaces above.
- [ ] **Step 4: Run them and confirm they pass.** `rtk proxy node --test tests/review-selection.test.mjs` should pass.
- [ ] **Step 5: Checkpoint.** `rtk git add -- src/lib/server/review/selection.mjs src/lib/server/review/selection.d.mts tests/review-selection.test.mjs`, subject `feat: add sprint recall queue selection`.

### Task 2: Caps replace activation allowances in `startSession`

**Files:**
- Modify: `src/lib/server/review/service.mjs` (`createUser`, `counts`, `effectiveLimits`, `dueSelection`, `startSession`, `viewInTransaction`, `activateCard`, `dashboard`; delete `updateActivationLimits`, `addActivationBatch`, `allowanceSchema`, `limits`)
- Modify: `src/lib/server/review/service.d.mts`
- Test: `tests/review-postgres.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`planQueue`, `DEFAULT_CAPS`, `category`).
- Produces:
  - `answeredToday(tx,user,now) => Promise<{vocabulary,kanji,grammar}>`: distinct `cardId`s with a `review_logs` row whose `reviewedAt` falls in the user's study day (`to_char("reviewedAt" AT TIME ZONE tz,'YYYY-MM-DD') = studyDay(now,tz)`), grouped by `category`.
  - `userCaps(user) => {vocabulary,kanji,grammar}`: `settingsJson.dailyReviewCaps`, else `DEFAULT_CAPS`.
  - `updateCaps(db,userId,values) => Promise<{caps}>`: zod object of three ints 0–300, strict.
  - `startSession(db,userId,{now, reviewMore=false})`. The `includeNew` option is removed. Task 3 implements `reviewMore`.
  - `SessionView.used`/`limits` now mean answered today and caps, as `Record<'vocabulary'|'kanji'|'grammar',number>`. Remove `introductionsPaused` from `SessionView` and `Dashboard`. `Dashboard` gains `caps`, `waitingFirstRecall:number` and `reviewMoreAvailable:boolean`, and loses `configuredLimits`.
- Rules:
  - The waiting set is the existing `waiting` SQL (studied items' `new` cards, oldest `introducedAt` first). Delete the `other` query.
  - The due set is active, eligible, `dueAt<=now` cards with no `take` limit.
  - The snapshot becomes `{policyVersion:2, mode:'daily', studyDay, entries}`.
  - In `viewInTransaction`, delete the allowance check (line ~271) and the "new deferred while due" check (~272). In `activateCard`, delete the allowance and backlog checks. `createUser` writes `dailyReviewCaps` in place of `newCardLimits`/`reviewCardBudget`.

- [ ] **Step 1: Update the fixture and write the failing tests.** In `fixture()`, replace the `newCardLimits` update with `markStudied`-equivalent `userItem` rows: `introducedAt` = `now` minus `(count-i)` minutes, so the oldest is the first fixture item. Add a `fixture({studied=true})` option. Tests that check studied marking itself (l.69, l.379, l.428) pass `studied:false`. Then add these tests:

```js
test('thirty studied vocabulary all enter one session beyond the old allowance', ...); // fixture count 30 → view.total===30
test('cap holds across two sessions in one study day and resets at local midnight', ...);
// caps {vocabulary:3}; answer 3 → second startSession has card===null;
// a review at 2026-10-06T18:20Z (23:50 IST) counts for day 1; startSession at 18:40Z (00:10 IST) has capacity again.
test('70/30 split mixes first-recall and due cards', ...); // cap 10, 10 waiting + 10 due → 7 + 3, first-recall first
test('due cards come lowest retrievability first', ...);
```

Rewrite the tests that encode removed rules. List each one, with old → new assertion, in the handoff:
  - `flexible activation allowances persist…` (l.92) and `flexible deliberate extra allowance…` (l.419): delete them, and replace them with an `updateCaps` validation test (rejects 301 and −1; persists).
  - `global eight and 5/2/1 type caps…` (l.271): rewrite to per-type daily caps.
  - `heavy backlog pauses all new introductions…` (l.288) and `flexible parallel activation…/backlog pauses…` (l.394): rewrite. Heavy backlog no longer blocks first recall; the 70/30 split applies. Parallel `startSession` still returns one session.
  - `learning step becoming due interrupts introductions…` (l.248): rewrite. A due learning card now competes in the due tier and does not defer first recall.
  - `caps hold across repeated sessions…` (l.228) and `flexible study records 135 items…` (l.428): keep the intent and update their numbers to the new caps.
  - Replace every `{includeNew:…}` call with `{}`.
- [ ] **Step 2: Run them and confirm the new tests fail.** `rtk bun run test:review` should show the new tests failing.
- [ ] **Step 3: Implement the service changes** per the rules above.
- [ ] **Step 4: Run the checks and confirm they pass.** `rtk bun run test:review` should pass; `rtk proxy npx tsc --noEmit` will still show errors in `route.ts` and `src/app/page.tsx`. Those are fixed in Task 5. If the suite must be green per task, do Task 5's API edits now.
- [ ] **Step 5: Checkpoint.** `rtk git add -- src/lib/server/review/service.mjs src/lib/server/review/service.d.mts tests/review-postgres.test.mjs`, subject `feat: replace activation allowances with daily review caps`.

### Task 3: Again repeats once, snapshot-scoped early review, Review more

**Files:**
- Modify: `src/lib/server/review/service.mjs` (`viewInTransaction`, `selectedCard`, `commitResponse`, `rate`, `startSession`)
- Test: `tests/review-postgres.test.mjs`

**Interfaces:**
- Consumes: Task 2 snapshot v2 and `startSession(…,{reviewMore})`.
- Produces: snapshot entries `{cardId, stateVersion, role:'new'|'review'|'again'}`. One card may appear twice, with the second entry `role:'again'`.
- Rules:
  - **Done-ness by occurrence.** The k-th entry for a card (1-based) is done when the session has ≥ k attempts with `reviewLogId` for that card. This replaces the `done` Set.
  - **`selectedCard`** finds the entry whose `cardId` and `stateVersion` both match. This replaces the `find` on `cardId` alone.
  - **`commitResponse`** drops `if(card.dueAt>now) throw 'Card is not due'`. Eligibility is "matching snapshot entry" (already enforced by `selectedCard`).
  - **`rate`**, only on the non-replay path (after the `prior` early return): if the effective rating is 1 and the snapshot has no `again` entry for this card, append `{cardId, stateVersion: card.stateVersion+1, role:'again'}` to `selectionSnapshotJson.entries`.
  - **`startSession({reviewMore:true})`**: up to 20 active, eligible cards with `dueAt>now`, lowest retrievability first, sibling-filtered, caps ignored, with snapshot `mode:'more'`. An empty result creates no session and returns `{id:null}`. The route maps that to a view of `null` with a message (Task 5).
  - **v1 snapshots** (no `mode`, no repeats) go through the same code: occurrence counting gives the same result as the old Set.

- [ ] **Step 1: Write the failing tests**

```js
test('an Again card returns once at the end of the session as a genuine second review', ...);
// answer card A wrong → view.total increases by 1; last entry role 'again'; its review writes a 2nd ReviewLog with reviewedAt=actual time;
// Again on the repeat → no third entry.
test('replaying the same Again rating event does not re-queue twice', ...);
test('review more serves not-due cards lowest retrievability first and writes genuine logs', ...);
test('review more with no not-due cards returns no session', ...);
test('a version-1 snapshot session still renders, accepts an answer and completes', ...);
// write a session row with policyVersion:1 entries directly, then sessionView/commitResponse/rate
```

- [ ] **Step 2: Run them and confirm they fail.** `rtk bun run test:review` should show the new tests failing.
- [ ] **Step 3: Implement the rules above.**
- [ ] **Step 4: Run them and confirm they pass.** `rtk bun run test:review` should pass.
- [ ] **Step 5: Checkpoint.** `rtk git add -- src/lib/server/review/service.mjs tests/review-postgres.test.mjs`, subject `feat: repeat missed cards in-session and add review more`.

### Task 4: Kanji become one card (A6)

**Files:**
- Modify: `src/lib/server/review/service.mjs` (`syncCards`: delete the `kanji_reading_context` creation block and its gap reason; change the `kanji_meaning` cue to `'Choose the reading and meaning.'`)
- Modify: `src/lib/server/review/service.mjs` `studyStatus` and the `poolSummary` SQL: the expected kanji objectives become `['kanji_meaning']` (1, not 2). The dashboard `missingContext` count is deleted.
- Create: `scripts/retire-kanji-reading-cards.mjs`, with dry-run by default and `--apply`. It sets `status='retired'` on `kanji_reading_context` cards with status `new` or `active`, and prints `{found, retired, apply}` only.
- Test: `tests/review-postgres.test.mjs`

**Interfaces:**
- Produces: `retireKanjiReadingCards(db,{apply}) => Promise<{found:number,retired:number,apply:boolean}>`, exported from the script module so the test can call it. Leave `buildKanjiReadingChoices` and the `kanji_reading` format in place for already-open sessions; do not delete them.

- [ ] **Step 1: Rewrite the tests and write the new ones.**
  - Rewrite `source-complete core creates exactly two independent objectives…` (l.131) to exactly one `kanji_meaning` objective.
  - Rewrite `contextual reading, vocabulary and kanji meaning successes never propagate…` (l.298): drop its contextual-reading half and keep the vocabulary/kanji independence.
  - Add `retire step retires reading cards, keeps their logs, and is idempotent`: seed a reading card with a ReviewLog, then run the dry run (`retired:0`), apply, and apply again (`found:0`). The log count is unchanged.
- [ ] **Step 2: Run them and confirm they fail.** `rtk bun run test:review` should show those failures.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** `rtk bun run test:review` should pass.
- [ ] **Step 5: Checkpoint.** `rtk git add -- src/lib/server/review/service.mjs scripts/retire-kanji-reading-cards.mjs tests/review-postgres.test.mjs`, subject `feat: single kanji recall card and reading-card retire script`.

### Task 5: API, review screen and dashboard

**Files:**
- Modify: `src/app/api/review/route.ts`
  - `start` becomes `{action:'start', reviewMore:z.boolean().optional()}`. A `null` id responds `{empty:true}`.
  - Add `{action:'caps', values:{vocabulary,kanji,grammar}}`.
  - Delete `activationLimits` and `extraBatch`.
- Modify: `src/components/review.tsx`
  - One **Start daily review** button.
  - Progress line `vocabulary {used}/{cap} · kanji … · grammar …`.
  - Entries with `role==='again'` show an "Again" label. This needs the `SessionView.card.role` field, which comes from the matched entry; add it in `viewInTransaction` and the types.
  - When `!card`, show **Review more (20)**. If the response is `empty`, show "Nothing else to review early." Drop the `initialStart==='learning'` branch: any `start` param starts the daily review.
- Modify: `src/app/page.tsx`. Replace the activation status line and `ActivationControls` with today's caps progress, `waitingFirstRecall`, and a caps editor. Add links to `/review?start=daily` and `/practice/match`.
- Replace `src/components/activation-controls.tsx` with `src/components/review-caps.tsx`: three number inputs (0–300) posting `caps`. Delete the old file.
- Modify: `src/app/globals.css` only as needed.
- Test: `tests/browser/review.spec.ts`

- [ ] **Step 1: Update the browser test.** Its start button is "Start daily review". Add `a missed card returns once labelled Again`, at desktop and 375 px.
- [ ] **Step 2: Run it and confirm it fails.** `rtk bun run test:review:browser` should fail.
- [ ] **Step 3: Implement.** Read the repo's Next docs under `node_modules/next/dist/docs/` for route and page conventions first.
- [ ] **Step 4: Run the checks and confirm they pass.**
  - `rtk bun run test:review:browser` passes.
  - `rtk proxy npx tsc --noEmit` is clean.
  - `rtk bun run lint` is clean.
  - `rtk bun run test` passes.
- [ ] **Step 5: Checkpoint.** `rtk git add -- src/app/api/review/route.ts src/components/review.tsx src/app/page.tsx src/components/review-caps.tsx src/components/activation-controls.tsx src/app/globals.css src/lib/server/review/service.mjs src/lib/server/review/service.d.mts tests/browser/review.spec.ts`, subject `feat: daily review screen and caps dashboard`.

### Task 6: Match game

**Files:**
- Create: `src/lib/server/practice/match.mjs`, `src/lib/server/practice/match.d.mts`
- Create: `src/app/api/practice/match/route.ts`
  - GET only. Copy `local()`, the cross-site check and the `no-store` header from `src/app/api/review/route.ts`. Validate `kind` with zod.
- Create: `src/components/match-game.tsx`, `src/app/practice/match/page.tsx`
- Modify: `src/app/practice/page.tsx` to add a link.
- Modify: `scripts/test-review-postgres.mjs` to add `tests/browser/match.spec.ts` to the browser run list (line ~44).
- Test: `tests/match-pairs.test.mjs`, `tests/review-postgres.test.mjs`, `tests/browser/match.spec.ts`

**Interfaces:**
- Consumes: `retrievability` (Task 1), `nextStudyDay` (scheduler), `normalizeReading` (text.mjs).
- Produces:
  - `pickMatchPairs(candidates:{id,prompt,answer,r}[], {size=6, random=Math.random}) => {id,prompt,answer}[]`:
    1. Drop candidates whose normalised `answer` (NFKC, trim, lowercase) duplicates an earlier one.
    2. Sort by `r` ascending, shuffling equal `r` with `random`.
    3. Take `size`.
    4. Return `[]` if fewer than 3 remain.
  - `matchPairs(db,userId,kind:'vocabulary'|'kanji',now) => Promise<{kind, pairs:{id,prompt,answer}[]}>`. Read-only Prisma reads, with no `locked()` transaction.
    - Candidates are active cards (`vocab_reading_meaning` or `kanji_meaning`) of approved items.
    - Exclude cards with `dueAt < nextStudyDay(now,tz)` and card IDs in an open daily session's snapshot.
    - Vocabulary: `prompt` = prompt text, `answer` = `answerSpecJson.meaning`.
    - Kanji: `prompt` = glyph. `answer` = `"<reading> · <meaning>"`, where reading is the first kun reading, else the first on reading, passed through `normalizeReading` to hiragana. With no reading, `answer` is the first meaning only.
- UI rules: as in spec §6.1 (tap the Japanese tile, then the meaning; wrong pair = shake + 1000 ms penalty; the timer starts on the first tap; tiles are `<button aria-pressed>`; the result is announced via `aria-live`; best time is keyed `match-best-${kind}`).

- [ ] **Step 1: Write the failing tests**

```js
// tests/match-pairs.test.mjs
test('pickMatchPairs takes the six lowest-r with unique answers', ...);
test('pickMatchPairs returns [] below three pairs', ...);
// tests/review-postgres.test.mjs
test('match excludes new, due-today and in-session cards and writes nothing', ...);
// snapshot counts of attempts, review_logs, study_sessions and sum(cards.stateVersion) are unchanged after 3 calls
test('kanji match answer pairs hiragana reading with meaning, meaning only when no reading', ...);
// tests/browser/match.spec.ts: complete a round with one deliberate miss; the time shown ≥ 1.0 s; mobile 375 px
```

- [ ] **Step 2: Run them and confirm they fail.** `rtk proxy node --test tests/match-pairs.test.mjs` and `rtk bun run test:review` should fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the checks and confirm they pass.** `rtk bun run test`, `rtk bun run test:review`, `rtk bun run test:review:browser`, `rtk proxy npx tsc --noEmit` and `rtk bun run lint` should all pass.
- [ ] **Step 5: Checkpoint.** `rtk git add -- src/lib/server/practice/match.mjs src/lib/server/practice/match.d.mts src/app/api/practice/match/route.ts src/components/match-game.tsx src/app/practice/match/page.tsx src/app/practice/page.tsx scripts/test-review-postgres.mjs tests/match-pairs.test.mjs tests/review-postgres.test.mjs tests/browser/match.spec.ts`, subject `feat: add read-only match practice game`.

### Task 7: Docs, amendment A6 and real-DB rollout

**Files:**
- Modify: `FINALIZED_PROJECT_PLAN.md`. Add an A6 row to the amendment table and a dated note. Update §8 "Workload control" and the Phase 4 extension bullets on allowances, and the §18 acceptance checks.
- Modify: `docs/architecture.md` (kanji objective count, workload control, match game as unscheduled practice) and `docs/tooling_Verification.md` (new commands and results).
- Create: `docs/sprint-recall-handoff.md`, in the handoff format of `docs/daily-recall-choice-handoff.md`. Include the list of rewritten test assertions from Tasks 2 and 4 and `Graphify required: yes` (new `selection.mjs` and `practice/match.mjs` modules).

- [ ] **Step 1: Write the docs.**
- [ ] **Step 2: Real-DB rollout.** Ask the learner before each real-DB write.
  1. Back up the study database with the existing restore/backup workflow in `docs/database-import.md`.
  2. Run `rtk proxy node scripts/retire-kanji-reading-cards.mjs` (dry run) and report `found`.
  3. On approval, run it with `--apply`.
  4. Run a read-only check that `startSession` would select ≤ 100 vocabulary and ≤ 40 kanji, without starting a session, and report the counts only.
- [ ] **Step 3: Run the final full verification** (the commands in Global Constraints). Paste the pass/fail counts into the handoff.
- [ ] **Step 4: Checkpoint.** `rtk git add -- FINALIZED_PROJECT_PLAN.md docs/architecture.md docs/tooling_Verification.md docs/sprint-recall-handoff.md docs/plans/2026-10-26-sprint-recall-and-match.md docs/plans/2026-10-26-sprint-recall-and-match-implementation.md`, subject `docs: record sprint recall amendment A6 and handoff`.
