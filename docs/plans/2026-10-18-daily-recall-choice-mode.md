# Daily recall update — reliable active time and objective paired-choice recall

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` task by task. Steps use checkbox (`- [ ]`) syntax. **This document is a plan only; no application code has been changed.**

**Goal:** Stop abandoned review sessions from reporting days of "active minutes", and replace free-text reading/meaning entry with a four-option, server-graded paired-choice response for vocabulary and core-kanji recall while keeping the FSRS transaction, answer-commitment gate and offline operation intact.

**Architecture:** Two independent changes.
1. Session timing becomes segmented: saved elapsed time plus an open segment only while the segment is fresh; an explicit `resume` action starts a new segment. No schema change.
2. A deterministic, offline choice builder draws real readings and meanings from approved items, constructs three wrong *pairs* that separate the reading component from the meaning component, and returns them without the correct choice ID. The service snapshots the offered options in the immutable Attempt, grades the selected option server-side, and feeds the same `readingCorrect`/`meaningCorrect` components the typed path already uses. Options are generated from local data only; AI is not used at review time.

**Tech Stack:** Next.js 16.3.8, React 19.3.0, TypeScript 5.9.3, Prisma 6.19.0 / PostgreSQL 17, Zod 3.25.76, ts-fsrs 5.4.2, Node test runner, Playwright 1.63.0, Bun 1.2.20 script wrapper.

**Spec:** `FINALIZED_PROJECT_PLAN.md` §§8–10, 18–19 and [architecture.md](../architecture.md), plus proposed amendment **A4** in Task 6. A4 is required because the current Master Plan explicitly says multiple-choice quizzes do not update FSRS in V1. This plan changes that only for scheduled recall, with the safeguards recorded below.

---

## Findings (verified before writing this plan)

### 1. Active-minutes defect — root cause confirmed against the live database

The review UI displays `view.elapsedActiveMs + tick*1000` in [review.tsx](../../src/components/review.tsx#L41). `elapsedActiveMs` comes from [service.mjs](../../src/lib/server/review/service.mjs#L130):

```js
const elapsed=(session,now)=>Math.min(2147483647,(session.elapsedActiveMs||0)+(session.status==='active'&&session.activeSince?Math.max(0,now-session.activeSince):0));
```

Consequences:

- Every read of an `active` session adds the **entire wall-clock gap** since `activeSince`, including days when the app was closed.
- `GET /api/review` returns the saved session without starting a timing segment ([route.ts](../../src/app/api/review/route.ts#L35-L36)).
- `startSession` returns an existing active session without resetting `activeSince`; only a `paused` session is reactivated ([service.mjs](../../src/lib/server/review/service.mjs#L139-L146)).
- A read-only diagnostic at 2026-10-18T16:13Z found one open daily session: `status=active`, `elapsedActiveMs=0`, `activeSince` **4,735 minutes old**, budget 30. That reproduces the reported 4,724 active minutes. `timeBudgetReached` is also forced true.

So the session did not "start before 2 minutes"; an earlier session was never stopped, and the page load counted the gap. Fixing only the display would hide the bad value; the service must stop accruing abandoned segments.

### 2. The requested multiple-choice format conflicts with the current plan

- §8 *Reviews versus practice/tests*: "multiple-choice quizzes … do **not** update FSRS in V1."
- §9: open-ended recall is listed as **Core**, with self-grading where equivalence is hard.
- §8.1 requires the prompt not to include the answer as a visible/labelled answer.

A four-option scheduled recall is recognition, not production. It is easier than typing and can inflate FSRS ratings if treated as identical evidence. The plan therefore proposes an explicit amendment (A4) with these constraints: both components are still tested by the option construction, grading is objective/server-side, the format is labelled in the Attempt/ReviewLog, `Easy` is unavailable in choice mode, and typed entry remains the fallback. If you prefer to keep scheduled recall strictly production, stop after Task 1 and treat Task 2+ as a practice-only feature.

---

## Decisions

These are recommendations with defaults; they are the points to confirm before implementation.

| ID | Decision | Recommended default | Why |
|---|---|---|---|
| D1 | Replace typing or keep both? | Choice mode is default for vocabulary and core kanji when at least three safe decoys exist. Typed entry remains automatic fallback and remains accepted by the API. | Removes typing for normal reviews without weakening the fallback when the pool is too small. |
| D2 | What do the four options contain? | Vocabulary: one hiragana reading + one English meaning per option. Kanji meaning: one hiragana reading + one English meaning per option (see the 19 October 2026 update below). Contextual kanji reading: hiragana readings. Grammar cloze: unchanged typed response. | Matches the request; grammar's cloze answer is a form inside a sentence and has no source-backed distractor set. |

> **Update — 19 October 2026.** A core-kanji meaning option originally carried an English meaning only, so a card whose distractors were Japanese-only source glosses made the single English option self-evident. Every option is now a hiragana reading paired with an English meaning. When no source example word's dictionary gloss matches the kanji's meaning, all four options fall back to the kanji's own on/kun reading in the same kind, so the correct option is never the only bare reading among whole-word readings. The 75-of-85 real-database check and the added "never mixes a bare kanji reading with word readings" unit test cover this.
| D3 | How are the three false options built? | From **real readings and meanings of other approved items**, paired deliberately (see below). No AI, no invented Japanese, no runtime network. | Auditable, offline, free, and it cannot hallucinate a word or a reading. |
| D4 | How is FSRS protected? | The service derives `readingCorrect`/`meaningCorrect` from the selected option; the client cannot supply them for objective attempts. `Easy` is clamped to `Good` for choice attempts and recorded as `requestedRating`/`effectiveRating`. | Recognition must not be silently upgraded to effortless production. |
| D5 | Which distractors are rejected? | Duplicate prompt word, exact duplicate reading+meaning, exact/accepted-gloss duplicate, and any same-reading decoy whose meaning overlaps the correct/accepted meaning. | Avoids a "wrong" option that is arguably correct. |
| D6 | No AI in this scope? | Yes. Revisit only if review logs show the choice mode is too easy after roughly two weeks of real use. | The project rule is to run the non-AI MVP first; per-review AI adds latency, cost, privacy and hallucination risk. |

**Optional alternative if you want a production check:** one card in ten (or cards with high FSRS stability) could still ask for typed reading, with choice mode for the rest. That is not in the tasks below; it is a small extension to D1 if desired.

---

## Distractor strategy — recommendation on "AI vs dictionary"

### Recommendation: neither runtime AI nor free-form dictionary output. Use controlled real-data pairs.

The three wrong options should be built from the learner's own approved pool (the accepted core import contains 108 vocabulary and 38 core-kanji items; the current local database exposed 500 approved vocabulary rows) and, later, validated JMdict entries. The key is not "find similar words"; it is **make each wrong option fail exactly one component**:

| Option | Reading | Meaning | Diagnostic value |
|---|---|---|---|
| Correct | target reading | target meaning | both correct |
| `same_reading` | target reading | another item's meaning | tests meaning; reading is not enough |
| `same_meaning` | another item's reading | target meaning | tests reading; meaning is not enough |
| `unrelated` | another reading | another meaning | baseline |

Example for `試験 / しけん / examination`:

- `しけん · examination` (correct)
- `しけん · time` (right reading, wrong meaning)
- `じかん · examination` (wrong reading, right meaning)
- `じけん · incident` (both wrong)

A read-only aggregate probe over the live pool (2026-10-18) built a four-option set for all 500 approved vocabulary rows, all 300 core-kanji rows with meanings, and all 138 active/new contextual-reading cards under these filters. That is coverage, not a quality judgment; the filters are deliberately conservative, and the UI still falls back to typing when a card cannot supply three safe options (for example, a brand-new item before its siblings exist).

This is better than a homophone-only strategy because homophones are rare and the pool is small. It guarantees both components are load-bearing, and every string is real data. A learner who knows only the reading sees two candidates; a learner who knows only the meaning sees two different candidates; only knowing both identifies one option.

### Difficulty ladder (deterministic, no model)

1. **Easy / cold card:** unrelated reading + unrelated meaning; decoys from a different part of speech.
2. **Normal:** `same_reading` meaning from the same part of speech; `same_meaning` reading from a visually similar word (shared kanji or similar length).
3. **Hard / stable card:** prefer decoys that share a kanji, share a mora pattern, or come from the same lesson/source; never use a synonym of the correct meaning for the `same_reading` option, because that could be a valid alternative meaning of the target.

Seed the choice order with `session.selectionSeed + card.id + card.stateVersion`. The set is stable across a reload before commitment and changes after a rating (new `stateVersion`), which prevents memorising option positions.

### Why AI is a poor fit here

- It would have to generate Japanese strings or glosses to add value; the project forbids treating generated language as a verified reading/meaning.
- A generated gloss can accidentally be a valid synonym of the target; the `same_reading` option then becomes arguably correct.
- Per-review calls break the offline default and add latency/cost; storing outputs needs a cache/approval path and a new table or private file.
- The local pool already supplies enough real distractors; JMdict (installed, 218,880 entries) can widen the pool later, but every candidate still needs the validity filters above.

**If AI is used later:** offline batch only, ranking existing real candidates (never writing Japanese), cached and human-spot-checked, never sending learner answers. That is a separate, deferred feature.

---

## File map

| File | Responsibility | Change |
|---|---|---|
| `src/lib/server/review/timing.mjs` | Pure segmented active-time rules | **Create** |
| `src/lib/server/review/timing.d.mts` | Types for the timing module | **Create** |
| `src/lib/server/review/text.mjs` | `normalizeReading`, gloss tokens/overlap | **Create** (extracted from service) |
| `src/lib/server/review/text.d.mts` | Types | **Create** |
| `src/lib/server/review/choices.mjs` | Pure deterministic choice builders and grading helpers | **Create** |
| `src/lib/server/review/choices.d.mts` | Types | **Create** |
| `src/lib/server/review/service.mjs` | Session timing, view projection, choice snapshot/grading | Modify around lines 130, 139–185, 218–257 |
| `src/lib/server/review/service.d.mts` | `SessionView`, input/result types | Modify |
| `src/app/api/review/route.ts` | `resume` action, choice fields, optional components | Modify |
| `src/components/review.tsx` | Four-option UI, keyboard, objective feedback, timer guard, resume on mount | Modify |
| `src/app/globals.css` | Choice list styling, focus/checked states, mobile | Modify |
| `scripts/repair-session-timing.mjs` | One-time dry-run/apply repair of stale open sessions | **Create** (optional run) |
| `tests/review-timing.test.mjs` | Unit tests for idle clamping | **Create** |
| `tests/review-choices.test.mjs` | Unit tests for option construction | **Create** |
| `tests/review-postgres.test.mjs` | Real-PostgreSQL timing + choice transaction tests | Modify |
| `tests/browser/review.spec.ts` | Choice flow, reload, keyboard, mobile | Modify |
| `FINALIZED_PROJECT_PLAN.md` | Amendment A4 and superseded §8/§9 wording | Modify after code verification |
| `docs/architecture.md` | Recall boundary note for choice mode | Modify |
| `docs/tooling_Verification.md` | Actual commands/results | Modify |
| `docs/daily-recall-choice-handoff.md` | Final handoff evidence | **Create** |

No Prisma migration, new dependency, new table or new service process is required. Options and grading metadata fit in existing `Attempt.answerJson`, `Attempt.promptSnapshotJson`, `Attempt.feedbackJson` and `Attempt.grader`.

---

## Global constraints

- Stored reviews must work with **no AI and no internet**. No runtime fetch in the choice path.
- Do not expose `answerSpecJson`, `correctChoiceId`, `tier`, or a correctness flag before commitment. Options necessarily contain the correct text; they must not mark or order it.
- Keep one User-row lock, atomic Attempt + ReviewLog + Card update, duplicate-event idempotency, and stale-`stateVersion` conflicts.
- No fabricated reading/meaning. Every option string comes from an approved item or is the pinned answer snapshot.
- `Bun` for package scripts; `Node` for server/test execution; prefix shell commands with `rtk`.
- Do not run review tests against the real library. `test:review` creates an isolated synthetic database.
- Preserve pre-existing untracked files (`scripts/dev-server.mjs`, `tests/dev-server.test.mjs`, `graphify-out/cache/`, `graphify-out/manifest.json`). Do not stage them.
- Manual Git only: never `git add .`, never commit/push as part of a task; the handoff gives exact scoped commands.
- Japanese text must use `lang="ja"`; controls keep 44 px minimum touch height; 375 px layout must not scroll horizontally.

---

## Task 1: Make active time segmented and restart-safe

**Files:**
- Create: `src/lib/server/review/timing.mjs`, `src/lib/server/review/timing.d.mts`, `tests/review-timing.test.mjs`
- Modify: `src/lib/server/review/service.mjs` (`elapsed`, `startSession`, `viewInTransaction`, `stopSession`), `src/lib/server/review/service.d.mts`, `src/app/api/review/route.ts`, `src/components/review.tsx`
- Create: `scripts/repair-session-timing.mjs`

**Interfaces:**
- Produces: `IDLE_GAP_MS`, `sessionElapsedMs(session, now)`, `hasIdleGap(session, now)`, `resumeSession(db, userId, sessionId, now)` and `SessionView.idleTooLong`.
- Consumes: existing `StudySession.elapsedActiveMs` and `StudySession.activeSince`; no new columns.

- [ ] **Step 1: Write the failing unit test**

Create `tests/review-timing.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_GAP_MS, hasIdleGap, sessionElapsedMs } from '../src/lib/server/review/timing.mjs';

const at = new Date('2026-10-18T10:00:00Z');
const open = overrides => ({ status: 'active', elapsedActiveMs: 0, activeSince: at, ...overrides });

test('a fresh open segment counts, an abandoned segment does not', () => {
  assert.equal(sessionElapsedMs(open({ activeSince: new Date(at - 60_000) }), at), 60_000);
  assert.equal(sessionElapsedMs(open({ activeSince: new Date(at - IDLE_GAP_MS) }), at), IDLE_GAP_MS);
  assert.equal(sessionElapsedMs(open({ activeSince: new Date(at - IDLE_GAP_MS - 1) }), at), 0);
  assert.equal(hasIdleGap(open({ activeSince: new Date(at - IDLE_GAP_MS - 1) }), at), true);
});

test('saved time is retained and clamped, paused time never accrues', () => {
  assert.equal(sessionElapsedMs(open({ elapsedActiveMs: 5 * 60_000, activeSince: new Date(at - 60_000) }), at), 6 * 60_000);
  assert.equal(sessionElapsedMs({ status: 'paused', elapsedActiveMs: 7, activeSince: null }, at), 7);
  assert.equal(sessionElapsedMs(open({ elapsedActiveMs: 2_147_483_647, activeSince: new Date(at - 60_000) }), at), 2_147_483_647);
});
```

- [ ] **Step 2: Run it to confirm the failure**

Run: `rtk proxy node --test tests/review-timing.test.mjs`
Expected: FAIL because `src/lib/server/review/timing.mjs` does not exist.

- [ ] **Step 3: Implement the timing module**

Create `src/lib/server/review/timing.mjs`:

```js
// Active study time is segmented: accumulated elapsed time plus at most one open
// segment. A closed laptop or abandoned tab must never turn wall-clock days into
// "active minutes", so an open segment older than IDLE_GAP_MS contributes nothing
// until resumeSession starts a new segment.
export const IDLE_GAP_MS = 15 * 60 * 1000;
export const MAX_ACTIVE_MS = 2147483647;

export function sessionElapsedMs(session, now) {
  const saved = Math.min(MAX_ACTIVE_MS, Math.max(0, Number(session.elapsedActiveMs) || 0));
  if (session.status !== 'active' || !session.activeSince) return saved;
  const gap = Math.max(0, now.getTime() - session.activeSince.getTime());
  if (gap > IDLE_GAP_MS) return saved;
  return Math.min(MAX_ACTIVE_MS, saved + gap);
}

export function hasIdleGap(session, now) {
  if (session.status !== 'active' || !session.activeSince) return false;
  return now.getTime() - session.activeSince.getTime() > IDLE_GAP_MS;
}
```

Create `src/lib/server/review/timing.d.mts`:

```ts
export const IDLE_GAP_MS: number;
export const MAX_ACTIVE_MS: number;
export function sessionElapsedMs(session: {status:string; elapsedActiveMs?:number|null; activeSince?:Date|null}, now: Date): number;
export function hasIdleGap(session: {status:string; activeSince?:Date|null}, now: Date): boolean;
```

- [ ] **Step 4: Run the unit test**

Run: `rtk proxy node --test tests/review-timing.test.mjs`
Expected: 2 passing tests.

- [ ] **Step 5: Write the failing integration test**

Append to `tests/review-postgres.test.mjs` (import `resumeSession` at the top):

```js
test('abandoned active session does not accrue wall-clock days and resume starts a fresh segment', {skip:!enabled}, async()=>{
  const u=await fixture({count:1});
  const s=await startSession(db,u.id,{now,includeNew:true});
  await db.studySession.update({where:{id:s.id},data:{activeSince:new Date(+now-3*86400000)}});
  let v=await sessionView(db,u.id,s.id,now);
  assert.equal(v.elapsedActiveMs,0);
  assert.equal(v.idleTooLong,true);
  assert.equal(v.timeBudgetReached,false);
  await resumeSession(db,u.id,s.id,now);
  v=await sessionView(db,u.id,s.id,new Date(+now+20*60000));
  assert.equal(v.elapsedActiveMs,20*60000);
  assert.equal(v.idleTooLong,false);
  const stopped=new Date(+now+21*60000);
  await stopSession(db,u.id,s.id,stopped);
  v=await sessionView(db,u.id,s.id,new Date(+stopped+60*60000));
  assert.equal(v.elapsedActiveMs,20*60000);
});
```

- [ ] **Step 6: Run it to confirm the failure**

Run: `rtk bun run test:review`
Expected: FAIL — `resumeSession` is not exported and `idleTooLong` is undefined.

- [ ] **Step 7: Replace the elapsed calculation in the service**

In `src/lib/server/review/service.mjs`, add:

```js
import { hasIdleGap, sessionElapsedMs } from './timing.mjs';
```

Delete the old `elapsed` helper (line 130) and replace every use:

- `startSession` completion: `elapsedActiveMs: sessionElapsedMs(prior, now)`
- `viewInTransaction`: `const duration = sessionElapsedMs(session, now);`
- `stopSession`: `elapsedActiveMs: sessionElapsedMs(s, now)`

`startSession` prior branch becomes:

```js
if(prior) {
  const view=await viewInTransaction(tx,user,prior,now);
  if(view.card){
    if(prior.status==='paused'||hasIdleGap(prior,now))await tx.studySession.update({where:{id:prior.id},data:{status:'active',activeSince:now}});
    return {id:prior.id};
  }
  await tx.studySession.update({where:{id:prior.id},data:{status:'completed',endedAt:now,elapsedActiveMs:sessionElapsedMs(prior,now),activeSince:null}});
}
```

Add the resume function next to `sessionView`:

```js
export async function resumeSession(db,userId,id,now=new Date()) {
  return locked(db,userId,async(tx,user)=>{
    const session=await ownedSession(tx,userId,id);
    if(session.status==='completed')throw new ReviewError('Session is completed');
    if(session.status==='paused'||hasIdleGap(session,now))await tx.studySession.update({where:{id},data:{status:'active',activeSince:now}});
    return viewInTransaction(tx,user,{...session,status:'active',activeSince:session.status==='paused'||hasIdleGap(session,now)?now:session.activeSince},now,{choices:true});
  });
}
```

Add to the view result:

```js
idleTooLong: hasIdleGap(session, now),
```

- [ ] **Step 8: Add the `resume` API action**

In `src/app/api/review/route.ts`, import `resumeSession`, add to the union:

```ts
z.object({action:z.literal('resume'),sessionId:id}).strict(),
```

and handle it before `stop`:

```ts
if(data.action==='resume')return send(await resumeSession(db,LOCAL_USER_ID,data.sessionId));
```

- [ ] **Step 9: Update the client types and mount flow**

In `src/lib/server/review/service.d.mts`, add `idleTooLong:boolean` to `SessionView` and export:

```ts
export function resumeSession(db:PrismaClient,userId:string,id:string,now?:Date):Promise<SessionView>;
```

In `src/components/review.tsx`, change the initial effect to resume an existing active session:

```tsx
useEffect(()=>{call<SessionView|null>().then(async saved=>{
  let next=saved;
  if(initialStart&&(!saved||saved.status==='paused'||!saved.card))next=await call<SessionView>({action:'start',includeNew:initialStart==='learning'});
  else if(saved?.status==='active')next=await call<SessionView>({action:'resume',sessionId:saved.sessionId});
  setView(next);setAnswer(next?.attempt?.answer||{});event.current=next?.attempt?.clientEventId||null;
}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[initialStart]);
```

Guard the ticker so a hidden tab cannot add wall-clock time:

```tsx
const lastActivity=useRef(Date.now());
useEffect(()=>{
  const wake=()=>{lastActivity.current=Date.now();};
  for(const type of ['pointerdown','keydown','focus'])window.addEventListener(type,wake);
  return()=>{for(const type of ['pointerdown','keydown','focus'])window.removeEventListener(type,wake);};
},[]);
useEffect(()=>{
  if(view?.status!=='active'||view.idleTooLong)return;
  const timer=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastActivity.current<15*60*1000)setTick(t=>t+1);},1000);
  return()=>clearInterval(timer);
},[view?.status,view?.idleTooLong]);
```

Display a clamped value. Inside the existing `{view&&(...)}` progress block, replace the elapsed expression with:

```tsx
const activeMs=view.elapsedActiveMs+(view.idleTooLong?0:tick*1000);
<p className="status">{Math.max(0,Math.floor(activeMs/60000))} active minutes / {view.timeBudgetMinutes} minute block budget</p>
```

- [ ] **Step 10: Add the one-time repair script**

Create `scripts/repair-session-timing.mjs`:

```js
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { hasIdleGap } from '../src/lib/server/review/timing.mjs';

const apply = process.argv.includes('--apply');
const url = new URL(await localDatabaseUrl());
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Local database required');
const db = new PrismaClient({ datasourceUrl: url.toString(), errorFormat: 'minimal' });
const now = new Date();
try {
  const open = await db.studySession.findMany({ where: { mode: 'daily', status: 'active' }, select: { id: true, status: true, activeSince: true, elapsedActiveMs: true } });
  const stale = open.filter(session => hasIdleGap(session, now));
  console.log(JSON.stringify({ open: open.length, stale: stale.length, apply }));
  if (apply && stale.length) await db.studySession.updateMany({ where: { id: { in: stale.map(session => session.id) } }, data: { status: 'paused', activeSince: null } });
} finally { await db.$disconnect(); }
```

Run dry-run first: `rtk proxy node scripts/repair-session-timing.mjs`
Expected: `{"open":1,"stale":1,"apply":false}` for the current database. Do **not** apply until Task 1's code passes; then `rtk proxy node scripts/repair-session-timing.mjs --apply` (optional; the UI resume already fixes the display).

- [ ] **Step 11: Verify**

Run, in order:

```powershell
rtk proxy node --test tests/review-timing.test.mjs
rtk bun run test:review
rtk bun run lint
rtk bun run typecheck
```

Expected: timing tests pass; review integration tests pass (including the new stale-session test); lint/typecheck clean. Then `rtk bun run build` and manually open `/review` after stopping any old server. The page must show `0 active minutes` (or the real accumulated time), not 4,724. Start a session, wait two minutes, refresh, and confirm the value stays near 2, not days.

- [ ] **Step 12: Commit (manual, only after verification)**

```powershell
rtk git add -- src/lib/server/review/timing.mjs src/lib/server/review/timing.d.mts src/lib/server/review/service.mjs src/lib/server/review/service.d.mts src/app/api/review/route.ts src/components/review.tsx scripts/repair-session-timing.mjs tests/review-timing.test.mjs tests/review-postgres.test.mjs
```

Suggested subject: `fix: stop abandoned review sessions from accruing active minutes`

---

## Task 2: Add the pure choice builder

**Files:**
- Create: `src/lib/server/review/text.mjs`, `text.d.mts`, `choices.mjs`, `choices.d.mts`, `tests/review-choices.test.mjs`
- Modify later: `service.mjs` (Task 3)

**Interfaces:**
- Produces:
  - `buildVocabChoices({target,candidates,seed}) → ChoiceSet|null`
  - `buildKanjiMeaningChoices({target,candidates,seed}) → ChoiceSet|null`
  - `buildKanjiReadingChoices({target,candidates,seed}) → ChoiceSet|null`
  - `ChoiceSet = {format, choices, correctChoiceId, fingerprint}`; each choice is `{id, reading?, meaning?, tier}`.
- Consumes: plain objects only; no Prisma, no I/O, no network.

- [ ] **Step 1: Write the failing unit tests**

Create `tests/review-choices.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKanjiMeaningChoices, buildKanjiReadingChoices, buildVocabChoices } from '../src/lib/server/review/choices.mjs';

const target={itemId:'t',writtenForm:'試験',reading:'しけん',meaning:'examination',acceptedGlosses:['exam'],partOfSpeech:'noun'};
const candidates=[
 {itemId:'a',writtenForm:'時間',reading:'じかん',meaning:'time',partOfSpeech:'noun'},
 {itemId:'b',writtenForm:'事件',reading:'じけん',meaning:'incident',partOfSpeech:'noun'},
 {itemId:'c',writtenForm:'用事',reading:'ようじ',meaning:'errand',partOfSpeech:'noun'},
];

test('vocabulary options pair real readings and meanings and isolate both components',()=>{
 const set=buildVocabChoices({target,candidates,seed:'session:card:0'});
 assert.ok(set);
 assert.equal(set.choices.length,4);
 assert.equal(new Set(set.choices.map(c=>`${c.reading}|${c.meaning}`)).size,4);
 const correct=set.choices.find(c=>c.id===set.correctChoiceId);
 assert.equal(correct.reading,'しけん');
 assert.equal(correct.meaning,'examination');
 assert.ok(set.choices.some(c=>c.tier==='same_reading'&&c.reading==='しけん'&&c.meaning!=='examination'));
 assert.ok(set.choices.some(c=>c.tier==='same_meaning'&&c.meaning==='examination'&&c.reading!=='しけん'));
 assert.ok(set.choices.some(c=>c.tier==='unrelated'));
 assert.equal(set.choices.some(c=>c.reading==='しけん'&&c.meaning==='exam'),false);
});

test('choice construction is deterministic and never uses the prompt word',()=>{
 const first=buildVocabChoices({target,candidates,seed:'same'});
 const second=buildVocabChoices({target,candidates,seed:'same'});
 assert.deepEqual(first,second);
 assert.equal(first.choices.some(c=>c.meaning===target.writtenForm),false);
 assert.match(first.fingerprint,/^[a-f0-9]{16}$/);
 assert.equal(buildVocabChoices({target,candidates:[candidates[0]],seed:'x'}),null);
});

test('kanji meaning and reading options are distinct and fall back when the pool is too small',()=>{
 const meaning=buildKanjiMeaningChoices({target:{glyph:'試',meaning:'test',meanings:['test']},candidates:[{glyph:'時',meanings:['time']},{glyph:'事',meanings:['thing']},{glyph:'用',meanings:['use']}],seed:'k'});
 assert.ok(meaning);
 assert.equal(meaning.choices.length,4);
 assert.equal(new Set(meaning.choices.map(c=>c.meaning)).size,4);
 assert.equal(meaning.choices.find(c=>c.id===meaning.correctChoiceId).meaning,'test');
 const reading=buildKanjiReadingChoices({target:{itemId:'t',reading:'しけん'},candidates:[{itemId:'a',reading:'じかん'},{itemId:'b',reading:'じけん'},{itemId:'c',reading:'ようじ'}],seed:'r'});
 assert.ok(reading);
 assert.equal(reading.choices.length,4);
 assert.equal(new Set(reading.choices.map(c=>c.reading)).size,4);
 assert.equal(buildKanjiMeaningChoices({target:{glyph:'試',meaning:'test',meanings:['test']},candidates:[],seed:'x'}),null);
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `rtk proxy node --test tests/review-choices.test.mjs`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Extract shared text helpers**

Create `src/lib/server/review/text.mjs`:

```js
export const normalizeReading = value => value.normalize('NFKC').replace(/\s+/gu,'').replace(/[ァ-ヶ]/gu,char=>String.fromCodePoint(char.codePointAt(0)-0x60));
const STOP = new Set(['the','and','for','with','from','this','that','someone','something','thing','things']);
export function glossTokens(value) {
  return new Set((String(value).toLowerCase().match(/[a-z]+/g)||[]).filter(word=>word.length>2&&!STOP.has(word)));
}
export function glossOverlap(a,b) {
  const left=glossTokens(a);
  return [...glossTokens(b)].some(word=>left.has(word));
}
```

Create `src/lib/server/review/text.d.mts`:

```ts
export function normalizeReading(value:string):string;
export function glossTokens(value:string):Set<string>;
export function glossOverlap(a:string,b:string):boolean;
```

In `service.mjs`, import and re-export the existing function so the assessment service keeps working:

```js
import { normalizeReading } from './text.mjs';
export { normalizeReading };
```

Delete the old `normalizeReading` declaration. Verify `tests/review-scheduler.test.mjs` still imports it successfully.

- [ ] **Step 4: Implement the choice builders**

Create `src/lib/server/review/choices.mjs`:

```js
import { glossOverlap, normalizeReading } from './text.mjs';

export const CHOICE_COUNT = 4;

function hash(value) {
  let h = 2166136261 >>> 0;
  for (const char of String(value)) { h ^= char.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
function longHash(value) { return `${hash(value)}${hash(`${value}|2`)}`; }
function random(seed) {
  let state = Number.parseInt(hash(seed), 16) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffled(items, seed) {
  const next = random(seed), copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
function pairKey(choice) { return `${normalizeReading(choice.reading || '')}|${String(choice.meaning || '').trim().toLowerCase()}`; }
function optionId(seed, index, choice) { return longHash(`${seed}|${index}|${pairKey(choice)}`).slice(0, 12); }
function fingerprint(seed, format, choices) { return longHash(`${seed}|${format}|${choices.map(choice => `${choice.id}|${pairKey(choice)}`).join(';')}`).slice(0, 16); }

function assemble(seed, format, correct, decoys) {
  const unique = new Map([[pairKey(correct), correct]]);
  for (const decoy of decoys) {
    if (unique.size >= CHOICE_COUNT) break;
    const key = pairKey(decoy);
    if (!unique.has(key)) unique.set(key, decoy);
  }
  if (unique.size !== CHOICE_COUNT) return null;
  const choices = shuffled([...unique.values()], `${seed}|order`).map((choice, index) => ({
    id: optionId(seed, index, choice),
    ...(choice.reading ? { reading: choice.reading } : {}),
    ...(choice.meaning ? { meaning: choice.meaning } : {}),
    tier: choice.tier,
  }));
  return { format, choices, correctChoiceId: choices.find(choice => pairKey(choice) === pairKey(correct)).id, fingerprint: fingerprint(seed, format, choices) };
}

export function buildVocabChoices({ target, candidates, seed }) {
  if (!target?.reading?.trim() || !target?.meaning?.trim()) return null;
  const accepted = [target.meaning, ...(target.acceptedGlosses || [])].filter(Boolean);
  const safe = [];
  for (const item of candidates || []) {
    if (!item?.reading?.trim() || !item?.meaning?.trim()) continue;
    if (item.meaning === 'Meaning not supplied by source') continue;
    if (item.itemId === target.itemId || item.writtenForm === target.writtenForm) continue;
    if (accepted.some(gloss => String(gloss).trim().toLowerCase() === String(item.meaning).trim().toLowerCase())) continue;
    safe.push({ itemId: item.itemId, reading: item.reading, meaning: item.meaning, pos: item.partOfSpeech || '' });
  }
  const used = new Set([pairKey({ reading: target.reading, meaning: target.meaning })]);
  const take = (pool, tier) => {
    for (const item of shuffled(pool, `${seed}|${tier}`)) {
      const key = pairKey(item);
      if (!used.has(key)) { used.add(key); return item; }
    }
    return null;
  };
  const sameReading = safe.filter(item => !glossOverlap(item.meaning, accepted.join(' ')));
  const otherReadings = safe.filter(item => normalizeReading(item.reading) !== normalizeReading(target.reading));
  const samePos = otherReadings.filter(item => item.pos && item.pos === target.partOfSpeech);
  const sameReadingCandidate = take(sameReading, 'same_reading');
  const readingForMeaning = take(samePos, 'same_meaning') || take(otherReadings, 'same_meaning_fallback');
  const unrelated = take(otherReadings, 'unrelated') || take(safe, 'unrelated_fallback');
  const decoys = [
    ...(sameReadingCandidate ? [{ reading: target.reading, meaning: sameReadingCandidate.meaning, tier: 'same_reading' }] : []),
    ...(readingForMeaning ? [{ reading: readingForMeaning.reading, meaning: target.meaning, tier: 'same_meaning' }] : []),
    ...(unrelated ? [{ reading: unrelated.reading, meaning: unrelated.meaning, tier: 'unrelated' }] : []),
  ];
  return assemble(seed, 'vocab_pair', { reading: target.reading, meaning: target.meaning, tier: 'correct' }, decoys);
}

export function buildKanjiMeaningChoices({ target, candidates, seed }) {
  const correct = { meaning: target.meaning, tier: 'correct' };
  const seen = new Set([pairKey(correct)]);
  const pool = [];
  for (const item of candidates || []) {
    if (item.glyph === target.glyph) continue;
    for (const meaning of item.meanings || []) {
      if (!String(meaning).trim()) continue;
      if ((target.meanings || [target.meaning]).some(accepted => glossOverlap(meaning, accepted))) continue;
      const entry = { meaning, tier: 'unrelated' };
      if (seen.has(pairKey(entry))) continue;
      seen.add(pairKey(entry));
      pool.push(entry);
    }
  }
  return assemble(seed, 'kanji_meaning', correct, shuffled(pool, `${seed}|kanji-meaning`).slice(0, CHOICE_COUNT - 1));
}

export function buildKanjiReadingChoices({ target, candidates, seed }) {
  if (!target?.reading?.trim()) return null;
  const correct = { reading: target.reading, tier: 'correct' };
  const seen = new Set([pairKey(correct)]);
  const pool = [];
  for (const item of candidates || []) {
    const reading = String(item?.reading || '').trim();
    if (!reading || item.itemId === target.itemId) continue;
    if (normalizeReading(reading) === normalizeReading(target.reading)) continue;
    const entry = { reading, tier: 'unrelated' };
    if (seen.has(pairKey(entry))) continue;
    seen.add(pairKey(entry));
    pool.push(entry);
  }
  return assemble(seed, 'kanji_reading', correct, shuffled(pool, `${seed}|kanji-reading`).slice(0, CHOICE_COUNT - 1));
}
```

Create `src/lib/server/review/choices.d.mts`:

```ts
export type ChoiceTier = 'correct'|'same_reading'|'same_meaning'|'unrelated';
export type Choice = {id:string; reading?:string; meaning?:string; tier:ChoiceTier};
export type ChoiceSet = {format:'vocab_pair'|'kanji_meaning'|'kanji_reading'; choices:Choice[]; correctChoiceId:string; fingerprint:string};
export function buildVocabChoices(input:{target:{itemId?:string;writtenForm?:string;reading:string;meaning:string;acceptedGlosses?:string[];partOfSpeech?:string};candidates:{itemId?:string;writtenForm?:string;reading?:string;meaning?:string;partOfSpeech?:string}[];seed:string}):ChoiceSet|null;
export function buildKanjiMeaningChoices(input:{target:{glyph?:string;meaning:string;meanings?:string[]};candidates:{glyph?:string;meanings?:string[]}[];seed:string}):ChoiceSet|null;
export function buildKanjiReadingChoices(input:{target:{itemId?:string;reading:string};candidates:{itemId?:string;reading?:string}[];seed:string}):ChoiceSet|null;
```

- [ ] **Step 5: Run the unit tests**

Run: `rtk proxy node --test tests/review-choices.test.mjs`
Expected: 3 passing tests.

If the vocab test fails because `same_reading` and `same_meaning` consume the same candidate in a way that leaves no third decoy, check that `take` marks each key used and that `samePos` excludes the target reading. With three candidates the test must pass.

- [ ] **Step 6: Commit (manual)**

```powershell
rtk git add -- src/lib/server/review/text.mjs src/lib/server/review/text.d.mts src/lib/server/review/choices.mjs src/lib/server/review/choices.d.mts tests/review-choices.test.mjs src/lib/server/review/service.mjs
```

Suggested subject: `feat: add deterministic paired-choice options for recall`

---

## Task 3: Integrate choices into the review service and API

**Files:**
- Modify: `src/lib/server/review/service.mjs`, `src/lib/server/review/service.d.mts`, `src/app/api/review/route.ts`
- Modify: `tests/review-postgres.test.mjs`

**Interfaces:**
- Consumes: `buildVocabChoices`, `buildKanjiMeaningChoices`, `buildKanjiReadingChoices`, `normalizeReading`, `glossOverlap` from Task 2.
- Produces: `SessionView.recall`, server-side grading (`Attempt.grader='objective'`), `commitResponse` result `grader`, and `rate` that ignores client components for objective attempts.

- [ ] **Step 1: Add a meanings override to the test fixture, then write the failing integration tests**

The existing synthetic fixture gives every word a meaning containing `test sense`, which is intentionally rejected by the same-reading gloss guard. Add an optional override instead of weakening production filters. Change the existing `fixture` signature and its `entries` line to:

```js
async function fixture({count=8,kanji=false,meanings=null}={}) {
  // signature line above; keep the existing body's source/batch/approval code unchanged
  const entries=Array.from({length:count},(_,i)=>({source_record_key:`entry-${i}`,word:`試験${i}`,reading:`しけん${i}`,pos:'noun',sense:`test-${i}`,meanings:[meanings?.[i%meanings.length]||`test sense ${i}`],source_pdf_pages:[1],source_printed_pages:['1'],review_status:'unreviewed',issues:[],examples:[]}));
  // the records, batch, approvals, user and syncCards code stays exactly as it is
}
```

Only those two lines change; do not alter the promotion or user setup.

Add to `tests/review-postgres.test.mjs`:

```js
const distinctMeanings=['time','incident','errand','plan'];

test('choice recall exposes four options, hides the answer snapshot, and grades both components server-side', {skip:!enabled}, async()=>{
  const u=await fixture({count:4,meanings:distinctMeanings});
  const s=await startSession(db,u.id,{now,includeNew:true});
  let v=await sessionView(db,u.id,s.id,now);
  await introduce(db,u.id,s.id,v.card.id,now);
  v=await sessionView(db,u.id,s.id,now);
  assert.ok(v.recall);
  assert.equal(v.recall.choices.length,4);
  assert.equal(v.answer,undefined);
  assert.equal(v.card.answerSpecJson,undefined);
  assert.equal('correctChoiceId' in v.recall,false);
  assert.equal(v.recall.choices.some(choice=>'tier' in choice),false);
  const card=await db.card.findUnique({where:{id:v.card.id}});
  const correct=v.recall.choices.find(choice=>choice.reading===card.answerSpecJson.reading&&choice.meaning===card.answerSpecJson.meaning);
  assert.ok(correct,'the correct pair is one of the four options');
  const input={sessionId:s.id,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:randomUUID(),answer:{choiceId:correct.id,choiceFingerprint:v.recall.fingerprint}};
  const committed=await commitResponse(db,u.id,input,now);
  assert.equal(committed.grader,'objective');
  assert.deepEqual(await commitResponse(db,u.id,input,now),committed,'choice retry is idempotent');
  const attempt=await db.attempt.findUnique({where:{userId_clientEventId:{userId:u.id,clientEventId:input.clientEventId}}});
  assert.equal(attempt.grader,'objective');
  assert.equal(attempt.feedbackJson.readingCorrect,true);
  assert.equal(attempt.feedbackJson.meaningCorrect,true);
  assert.equal(attempt.promptSnapshotJson.choices.length,4);
  const reveal=await sessionView(db,u.id,s.id,now);
  assert.equal(reveal.recall,null);
  assert.equal(reveal.attempt.choice.reading,correct.reading);
  assert.equal(reveal.attempt.choice.meaning,correct.meaning);
  assert.equal(reveal.attempt.components.correct,true);
  assert.equal(await rate(db,u.id,{...input,rating:4,components:{}},now).then(r=>r.rating),3,'choice mode caps Easy at Good');
});

test('a wrong component forces Again and a stale choice fingerprint is rejected', {skip:!enabled}, async()=>{
  const u=await fixture({count:4,meanings:distinctMeanings});
  const s=await startSession(db,u.id,{now,includeNew:true});
  let v=await sessionView(db,u.id,s.id,now);
  await introduce(db,u.id,s.id,v.card.id,now);
  v=await sessionView(db,u.id,s.id,now);
  const card=await db.card.findUnique({where:{id:v.card.id}});
  const partial=v.recall.choices.find(choice=>choice.reading===card.answerSpecJson.reading&&choice.meaning!==card.answerSpecJson.meaning);
  assert.ok(partial,'a same-reading decoy must exist');
  const input={sessionId:s.id,cardId:v.card.id,stateVersion:v.card.stateVersion,clientEventId:randomUUID(),answer:{choiceId:partial.id,choiceFingerprint:v.recall.fingerprint}};
  await commitResponse(db,u.id,input,now);
  assert.equal((await rate(db,u.id,{...input,rating:4,components:{readingCorrect:true,meaningCorrect:true}},now)).rating,1);
  const next=await fixture({count:4,meanings:distinctMeanings});
  const ns=await startSession(db,next.id,{now,includeNew:true});
  let nv=await sessionView(db,next.id,ns.id,now);
  await introduce(db,next.id,ns.id,nv.card.id,now);
  nv=await sessionView(db,next.id,ns.id,now);
  const stale={sessionId:ns.id,cardId:nv.card.id,stateVersion:nv.card.stateVersion,clientEventId:randomUUID(),answer:{choiceId:nv.recall.choices[0].id,choiceFingerprint:'0000000000000000'}};
  await assert.rejects(()=>commitResponse(db,next.id,stale,now),/changed|offered/i);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `rtk bun run test:review`
Expected: FAIL — `v.recall` is undefined.

- [ ] **Step 3: Add the choice pool and view projection**

In `src/lib/server/review/service.mjs`, import:

```js
import { buildKanjiMeaningChoices, buildKanjiReadingChoices, buildVocabChoices } from './choices.mjs';
```

Add helpers near `viewInTransaction`:

```js
const choiceObjectives = new Set(['vocab_reading_meaning','kanji_meaning','kanji_reading_context']);
function feedbackComponents(feedback) {
  const result = {};
  for (const key of ['correct','readingCorrect','meaningCorrect']) if (typeof feedback?.[key] === 'boolean') result[key] = feedback[key];
  return Object.keys(result).length ? result : undefined;
}
function chosenChoice(attempt) {
  const id = attempt.answerJson?.choiceId;
  const choices = attempt.promptSnapshotJson?.choices;
  if (!id || !Array.isArray(choices)) return undefined;
  const choice = choices.find(item => item?.id === id);
  return choice ? { id: choice.id, ...(choice.reading ? { reading: choice.reading } : {}), ...(choice.meaning ? { meaning: choice.meaning } : {}) } : undefined;
}
async function recallChoices(tx, user, card, session) {
  if (!choiceObjectives.has(card.objective)) return null;
  const seed = `${session.selectionSeed}:${card.id}:${card.stateVersion}`;
  if (card.objective === 'vocab_reading_meaning') {
    const vocabulary = await tx.vocabulary.findUnique({ where: { itemId: card.itemId }, select: { writtenForm: true, partOfSpeech: true } });
    if (!vocabulary) return null;
    const rows = await tx.vocabulary.findMany({
      where: { itemId: { not: card.itemId }, item: { status: 'approved', sourceEntries: { some: evidenceWhere } } },
      select: { itemId: true, writtenForm: true, reading: true, meaningEn: true, partOfSpeech: true },
      take: 240, orderBy: { itemId: 'asc' },
    });
    return buildVocabChoices({
      target: { itemId: card.itemId, writtenForm: vocabulary.writtenForm, reading: card.answerSpecJson.reading, meaning: card.answerSpecJson.meaning, acceptedGlosses: strings(card.answerSpecJson.acceptedGlosses), partOfSpeech: vocabulary.partOfSpeech },
      candidates: rows.map(row => ({ itemId: row.itemId, writtenForm: row.writtenForm, reading: row.reading, meaning: row.meaningEn, partOfSpeech: row.partOfSpeech })),
      seed,
    });
  }
  if (card.objective === 'kanji_meaning') {
    const kanji = await tx.kanji.findUnique({ where: { itemId: card.itemId }, select: { glyph: true, meaningsJson: true } });
    if (!kanji) return null;
    const rows = await tx.kanji.findMany({
      where: { itemId: { not: card.itemId }, item: { status: 'approved', sourceEntries: { some: { ...evidenceWhere, curriculumRole: 'core_kanji' } } } },
      select: { glyph: true, meaningsJson: true }, take: 240, orderBy: { itemId: 'asc' },
    });
    return buildKanjiMeaningChoices({
      target: { glyph: kanji.glyph, meaning: card.answerSpecJson.meaning, meanings: strings(kanji.meaningsJson) },
      candidates: rows.map(row => ({ glyph: row.glyph, meanings: strings(row.meaningsJson) })),
      seed,
    });
  }
  const rows = await tx.card.findMany({
    where: { userId: user.id, objective: 'kanji_reading_context', status: { in: ['new','active'] }, itemId: { not: card.itemId } },
    select: { itemId: true, answerSpecJson: true }, take: 240, orderBy: { id: 'asc' },
  });
  return buildKanjiReadingChoices({
    target: { itemId: card.itemId, reading: card.answerSpecJson.reading },
    candidates: rows.map(row => ({ itemId: row.itemId, reading: row.answerSpecJson?.reading })),
    seed,
  });
}
```

In `viewInTransaction`, after the current card/attempt selection and before the return:

```js
const duration = sessionElapsedMs(session, now);
const choiceSet = choices && card && card.status === 'active' && !attempt ? await recallChoices(tx, user, card, session) : null;
```

Change the function signature to `async function viewInTransaction(tx,user,session,now,{choices=false}={})` so the dashboard, introduction check and `selectedCard` do not pay for option queries. Only the UI-facing calls request them:

```js
export async function sessionView(db,userId,id,now=new Date()) {
  return locked(db,userId,async(tx,user)=>viewInTransaction(tx,user,await ownedSession(tx,userId,id),now,{choices:true}));
}
```

`resumeSession` must also call `viewInTransaction(...,{choices:true})`; `startSession`, `introduce`, `selectedCard` and `dashboard` keep the default `false`.

Add to the returned object:

```js
idleTooLong: hasIdleGap(session, now),
recall: choiceSet ? {
  format: choiceSet.format,
  fingerprint: choiceSet.fingerprint,
  choices: choiceSet.choices.map(({ id, reading, meaning }) => ({ id, ...(reading ? { reading } : {}), ...(meaning ? { meaning } : {}) })),
} : null,
```

and extend `attempt`:

```js
attempt: attempt ? {
  clientEventId: attempt.clientEventId,
  answer: attempt.answerJson,
  readingMatch: attempt.feedbackJson.readingMatch,
  grader: attempt.grader,
  components: feedbackComponents(attempt.feedbackJson),
  choice: chosenChoice(attempt),
} : undefined,
```

- [ ] **Step 4: Grade the committed choice**

Add helpers above `commitResponse`:

```js
function normalizeGloss(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}
function gradeChoice(card, choice) {
  const answer = card.answerSpecJson;
  if (card.objective === 'vocab_reading_meaning') {
    const readingCorrect = normalizeReading(choice.reading || '') === normalizeReading(answer.reading || '');
    const meaningCorrect = [answer.meaning, ...strings(answer.acceptedGlosses)].filter(Boolean)
      .some(gloss => normalizeGloss(gloss) === normalizeGloss(choice.meaning));
    return { readingCorrect, meaningCorrect, correct: readingCorrect && meaningCorrect, readingMatch: readingCorrect };
  }
  if (card.objective === 'kanji_reading_context') {
    const correct = normalizeReading(choice.reading || '') === normalizeReading(answer.reading || '');
    return { correct, readingMatch: correct };
  }
  const correct = [answer.meaning, ...strings(answer.acceptedGlosses)].filter(Boolean)
    .some(gloss => normalizeGloss(gloss) === normalizeGloss(choice.meaning));
  return { correct };
}
```

In `commitResponse`, after `const card = await selectedCard(...)`:

```js
const session = await ownedSession(tx, user.id, data.sessionId);
const choices = data.answer.choiceId ? await recallChoices(tx, user, card, session) : null;
if (data.answer.choiceId && !data.answer.choiceFingerprint) throw new ReviewError('Choice fingerprint required', 400);
let answerJson = data.answer, feedback = {}, grader = 'self';
if (data.answer.choiceId) {
  if (!choices) throw new ReviewError('Choice response unavailable; reload the card');
  if (data.answer.choiceFingerprint !== choices.fingerprint) throw new ReviewError('Choices changed; reload the card');
  const choice = choices.choices.find(item => item.id === data.answer.choiceId);
  if (!choice) throw new ReviewError('Selected choice was not offered; reload the card');
  answerJson = { choiceId: choice.id, choiceFingerprint: choices.fingerprint };
  feedback = { choiceId: choice.id, ...gradeChoice(card, choice) };
  grader = 'objective';
} else {
  const required = card.objective === 'vocab_reading_meaning' ? ['reading','meaning'] : card.objective === 'kanji_meaning' ? ['meaning'] : card.objective === 'kanji_reading_context' ? ['reading'] : ['response'];
  if (required.some(key => typeof data.answer[key] !== 'string' || !data.answer[key].trim())) throw new ReviewError('Commit each required response, or write “forgot”', 400);
  feedback = card.answerSpecJson.reading ? { normalizedReading: normalizeReading(data.answer.reading), readingMatch: normalizeReading(data.answer.reading) === normalizeReading(card.answerSpecJson.reading) } : {};
}
```

Replace the `attempt.create` payload with `answerJson`, `feedbackJson: feedback`, `grader`, and extend `promptSnapshotJson`:

```js
promptSnapshotJson: {
  prompt: card.promptSpecJson, answer: card.answerSpecJson,
  stateVersion: card.stateVersion, templateVersion: card.templateVersion,
  ...(choices ? { choiceFormat: choices.format, choices: choices.choices, correctChoiceId: choices.correctChoiceId } : {}),
},
```

Return `grader` as well:

```js
return { clientEventId: data.clientEventId, answer: card.answerSpecJson, readingMatch: feedback.readingMatch, grader };
```

Also update the existing duplicate-event branch at the top of `commitResponse` so a retry returns the same shape:

```js
if(previous){
  if(previous.cardId!==data.cardId||previous.sessionId!==data.sessionId||previous.promptSnapshotJson.stateVersion!==data.stateVersion||!isDeepStrictEqual(previous.answerJson,data.answer))throw new ReviewError('Event ID already used with another response');
  return {clientEventId:previous.clientEventId,answer:previous.promptSnapshotJson.answer,readingMatch:previous.feedbackJson.readingMatch,grader:previous.grader};
}
```

- [ ] **Step 5: Stop trusting client components for objective attempts**

In `rate`, replace the components/rating lines with:

```js
const components = attempt.grader === 'objective' ? attempt.feedbackJson : data.components;
const requestedRating = attempt.grader === 'objective' ? Math.min(3, data.rating) : data.rating;
const rating = effectiveRating(card.objective, requestedRating, components);
```

When updating the attempt feedback, keep both values:

```js
feedbackJson: { ...attempt.feedbackJson, requestedRating: data.rating, effectiveRating: rating }
```

- [ ] **Step 6: Update the API schema and types**

In `src/app/api/review/route.ts`:

```ts
const answer=z.object({
  reading:z.string().max(500).optional(),
  meaning:z.string().max(2000).optional(),
  response:z.string().max(2000).optional(),
  choiceId:z.string().min(8).max(40).optional(),
  choiceFingerprint:z.string().regex(/^[a-f0-9]{8,32}$/).optional(),
}).strict();
```

Make `components` optional:

```ts
z.object({action:z.literal('rate'),...response,rating:z.number().int().min(1).max(4),components:z.record(z.boolean()).optional()}).strict(),
```

In `src/lib/server/review/service.mjs`, make the same `components` optional in `ratingSchema`, and add the choice fields to `responseSchema`. Keep the base as a `ZodObject` so `.extend()` still works (do not add `.refine`):

```js
const answerSchema=z.object({
  reading:z.string().max(500).optional(),
  meaning:z.string().max(2000).optional(),
  response:z.string().max(2000).optional(),
  choiceId:z.string().min(8).max(40).optional(),
  choiceFingerprint:z.string().regex(/^[a-f0-9]{8,32}$/).optional(),
}).strict();
const responseSchema=z.object({sessionId:uuid,cardId:uuid,stateVersion:z.number().int().nonnegative(),clientEventId:uuid,answer:answerSchema}).strict();
const ratingSchema=responseSchema.extend({rating:z.number().int().min(1).max(4),components:z.record(z.boolean()).optional()});
```

Validate the "id and fingerprint together" rule inside `commitResponse`, not with `.refine`.

In `service.d.mts`:

```ts
export type Answer = {reading?:string;meaning?:string;response?:string;choiceId?:string;choiceFingerprint?:string;acceptedGlosses?:string[];alternatives?:string[]};
export type Choice = {id:string; reading?:string; meaning?:string};
export type RecallChoices = {format:'vocab_pair'|'kanji_meaning'|'kanji_reading'; choices:Choice[]; fingerprint:string};
export type SessionView = {sessionId:string;status:string;completed:number;total:number;deferred:number;due:number;actionableDue:number;buriedDue:number;introductionsPaused:boolean;elapsedActiveMs:number;timeBudgetMinutes:number;timeBudgetReached:boolean;idleTooLong:boolean;used:Record<string,number>;limits:Record<string,number>;repairSuggested:boolean;card:ReviewCard|null;recall?:RecallChoices|null;attempt?:{clientEventId:string;answer:Answer;readingMatch?:boolean;grader?:string;components?:Record<string,boolean>;choice?:Choice};answer?:Answer;study?:StudyContent|null};
export function commitResponse(db:PrismaClient,userId:string,input:ResponseInput,now?:Date):Promise<{clientEventId:string;answer:Answer;readingMatch?:boolean;grader:string}>;
```

- [ ] **Step 7: Run the integration tests**

Run: `rtk bun run test:review`
Expected: all review tests pass, including the two new choice tests and the stale-session test. Existing typed-answer tests must still pass; their `answer:{reading,meaning}` path is unchanged.

If an existing test with `fixture({count:1})` now returns `recall:null`, assert it explicitly in the new tests but do not change older tests.

- [ ] **Step 8: Commit (manual)**

```powershell
rtk git add -- src/lib/server/review/service.mjs src/lib/server/review/service.d.mts src/app/api/review/route.ts tests/review-postgres.test.mjs
```

Suggested subject: `feat: grade four-option recall inside the review transaction`

---

## Task 4: Build the four-option recall UI

**Files:**
- Modify: `src/components/review.tsx`, `src/app/globals.css`, `tests/browser/review.spec.ts`

**Interfaces:**
- Consumes: `view.recall`, `view.attempt.grader`, `view.attempt.components`, `view.attempt.choice`, `view.idleTooLong`.
- Produces: keyboard-accessible radio group, committed choice request, objective feedback, typed fallback.

- [ ] **Step 1: Add option selection state and request**

In `review.tsx`:

```tsx
const [choiceId,setChoiceId]=useState('');
function replace(next:SessionView|null){setTick(0);setChoiceId('');setView(next);setAnswer(next?.attempt?.answer||{});event.current=next?.attempt?.clientEventId||null;setTeaching(null);setStudy(null);setComponents({});requestAnimationFrame(()=>heading.current?.focus());}
```

Update `response()`:

```tsx
function response():ResponseInput {
  if(!view||!card)throw new Error('Reload the session');
  event.current=view.attempt?.clientEventId||event.current||crypto.randomUUID();
  const committed=view.attempt?.answer
    ||(view.recall&&choiceId?{choiceId,choiceFingerprint:view.recall.fingerprint}:answer);
  return {sessionId:view.sessionId,cardId:card.id,stateVersion:card.stateVersion,clientEventId:event.current,answer:committed};
}
```

- [ ] **Step 2: Render the choice group before reveal**

Replace the current `card.status==='active'&&!teaching&&!revealed` block with:

```tsx
{card.status==='active'&&!teaching&&!revealed&&view?.recall&&(
  <form onSubmit={e=>{e.preventDefault();if(choiceId)void submit();}} className="recall-form choice-form">
    <fieldset className="recall-choices" disabled={busy}>
      <legend>Choose the correct {view.recall.format==='vocab_pair'?'reading and meaning pair':view.recall.format==='kanji_meaning'?'meaning':'reading'}</legend>
      {view.recall.choices.map((choice,index)=>(
        <label key={choice.id} data-choice-id={choice.id} data-reading={choice.reading||''} data-meaning={choice.meaning||''} className="choice">
          <input type="radio" name="recall-choice" value={choice.id} checked={choiceId===choice.id} onChange={()=>setChoiceId(choice.id)} onKeyDown={e=>{if(/^[1-4]$/.test(e.key)){e.preventDefault();setChoiceId(view.recall!.choices[Number(e.key)-1].id);}}}/>
          <span className="choice-index" aria-hidden="true">{index+1}</span>
          {choice.reading&&<span lang="ja" className="japanese choice-reading">{choice.reading}</span>}
          {choice.meaning&&<span className="choice-meaning">{choice.meaning}</span>}
        </label>
      ))}
    </fieldset>
    <p className="muted">One option pairs the source-backed reading with the selected meaning.</p>
    <button disabled={busy||!choiceId}>Commit choice and reveal</button>
  </form>
)}
```

Keep the existing typed form as the `!view?.recall` fallback. Change only its render condition from `card.status==='active'&&!teaching&&!revealed` to `card.status==='active'&&!teaching&&!revealed&&!view?.recall`; the reading/meaning/response labels and inputs stay unchanged.

- [ ] **Step 3: Show the committed choice and objective feedback**

Change the committed answer block:

```tsx
{view!.attempt!.grader==='objective'&&view!.attempt!.choice
  ? <p><span className="field-label">Selected: </span>{view!.attempt!.choice.reading||view!.attempt!.choice.meaning}{view!.attempt!.choice.reading&&view!.attempt!.choice.meaning?' · ':''}{view!.attempt!.choice.meaning||''}</p>
  : Object.entries(view!.attempt!.answer).filter(([,x])=>typeof x==='string').map(([key,v])=><p key={key}><span className="field-label">{key}: </span>{v}</p>)}
```

Hide the checkbox self-assessment for objective attempts and show server-derived feedback:

```tsx
const objective=view?.attempt?.grader==='objective';
const feedback=view?.attempt?.components;
const success=objective?!!feedback?.correct:vocab?components.readingCorrect&&components.meaningCorrect:components.correct;
```

Wrap the existing `<fieldset className="self-assessment">…</fieldset>` in `{!objective&&( … )}` without changing its checkboxes. Add the objective feedback paragraph next to it:

```tsx
{objective&&<p className="notice" data-testid="objective-feedback">
  {feedback?.correct
    ? 'Both components correct.'
    : vocab&&feedback?.readingCorrect
      ? 'Reading correct, meaning different. This is Again.'
      : vocab&&feedback?.meaningCorrect
        ? 'Meaning correct, reading different. This is Again.'
        : 'Both components incorrect. This is Again.'}
</p>}
```

Update the rating buttons:

```tsx
<button key={label} aria-label={label} disabled={busy||(i>0&&!success)||(objective&&i===3)} onClick={()=>rate(i+1)}>
```

and send components only for the self-graded path:

```tsx
function rate(rating:number){return work(async()=>{
  const result=await call<{rating:number}>({action:'rate',...response(),rating,
    components:objective?{}:vocab?{readingCorrect:!!components.readingCorrect,meaningCorrect:!!components.meaningCorrect}:{correct:!!components.correct}});
  replace(await call<SessionView>());setMessage(`Saved · ${['','Again','Hard','Good','Easy'][result.rating]}`);
});}
```

`objective`, `feedback`, and `success` must be computed after `view`/`card` are known and before the JSX return; keep the existing `success` derived from local checkboxes only for the typed path.

- [ ] **Step 4: Add styles**

In `globals.css`, after the `.recall-form` rules:

```css
.choice-form { margin-top: 1rem; }
.recall-choices { border: 1px solid #cdd0c3; border-radius: var(--study-radius); padding: 1rem; display: grid; gap: .6rem; background: #fffdf8; }
.recall-choices legend { font-weight: 600; padding: 0 .35rem; }
.recall-choices label { display: grid; grid-template-columns: auto auto minmax(0,1fr); gap: .65rem; align-items: baseline; padding: .7rem .8rem; border: 1px solid #d8dacf; border-radius: 10px; cursor: pointer; min-height: 44px; }
.recall-choices label:hover { border-color: #8c9783; }
.recall-choices label:has(input:checked) { border-color: #344639; background: #f2f5e9; }
.recall-choices label:focus-within { outline: 2px solid #344639; outline-offset: 2px; }
.recall-choices input { width: 1.15rem; height: 1.15rem; accent-color: #344639; }
.choice-index { color: #69705d; font-size: .8rem; min-width: 1rem; }
.choice-reading { font-size: 1.05rem; }
.choice-meaning { overflow-wrap: anywhere; }
@media(max-width:650px){ .recall-choices label { grid-template-columns: auto auto 1fr; } }
```

- [ ] **Step 5: Update the browser test**

In `tests/browser/review.spec.ts`, replace the free-text steps in the recall test. After "Study this new card":

```ts
const taught=page.getByTestId('revealed-answer');
const reading=await taught.locator('[data-field="reading"]').innerText();
const meaning=await taught.locator('[data-field="meaning"]').innerText();
await page.getByRole('button',{name:'Hide and recall'}).click();
await expect(page.locator('.recall-choices label')).toHaveCount(4);
await expect(page.locator('.recall-choices [data-correct]')).toHaveCount(0);
await page.locator('.recall-choices label').filter({hasText:reading}).filter({hasText:meaning}).first().click();
await page.getByRole('button',{name:'Commit choice and reveal'}).click();
await expect(page.getByTestId('revealed-answer')).toBeVisible();
await expect(page.getByTestId('objective-feedback')).toContainText('Both components correct');
```

To make the `data-field` locators possible, add attributes in `AnswerView`:

```tsx
{answer.reading&&<p lang="ja" data-field="reading" className="japanese sentence">{answer.reading}</p>}
{answer.meaning&&<p data-field="meaning">{answer.meaning}</p>}
```

After reload/resume, assert the committed choice is still visible:

```ts
await expect(page.locator('.committed-answer')).toContainText(reading);
await expect(page.getByTestId('objective-feedback')).toBeVisible();
```

For the second card, deliberately choose a wrong option and assert Again only:

```ts
const labels=page.locator('.recall-choices label');
const count=await labels.count();
let wrong=0;
for(let i=0;i<count;i++){const label=labels.nth(i);if(await label.getAttribute('data-reading')!==reading||await label.getAttribute('data-meaning')!==meaning){wrong=i;break;}}
await labels.nth(wrong).click();
await page.getByRole('button',{name:'Commit choice and reveal'}).click();
await expect(page.getByTestId('objective-feedback')).toContainText('Again');
await expect(page.getByRole('button',{name:'Good',exact:true})).toBeDisabled();
await expect(page.getByRole('button',{name:'Easy',exact:true})).toBeDisabled();
await page.getByRole('button',{name:'Again',exact:true}).click();
```

Use the taught answer from the second card for that comparison (capture again before hiding). Add a keyboard check on the first card:

```ts
await page.locator('.recall-choices input').first().focus();
await page.keyboard.press('1');
await expect(page.locator('.recall-choices input').first()).toBeChecked();
```

Do not keep the old `Reading response` / `Meaning response` interactions in the objective test. Keep them only in a separate typed-fallback test if you add one with a synthetic one-item database; the default synthetic pool has enough candidates.

- [ ] **Step 6: Verify**

```powershell
rtk bun run lint
rtk bun run typecheck
rtk bun run build
rtk bun run test:review:browser
```

Expected: lint/typecheck clean, production build succeeds, the review browser flow passes at desktop and 375 px. Inspect `.local/review-desktop.png` and `.local/review-mobile.png` for readable Japanese, four options, no horizontal overflow, and no visible correctness marker before commitment.

- [ ] **Step 7: Commit (manual)**

```powershell
rtk git add -- src/components/review.tsx src/app/globals.css tests/browser/review.spec.ts
```

Suggested subject: `feat: add four-option paired recall to the review screen`

---

## Task 5: Verify the end-to-end behavior manually

**Files:** none (verification only).

- [ ] **Step 1: Build and start against the real local database**

```powershell
rtk bun run build
rtk bun run start
```

Open `http://127.0.0.1:3000/review`. The active-minutes line must show the real saved time (currently 0), not 4,724. If the old active session is still open, the client resumes it and starts a fresh segment.

- [ ] **Step 2: Check the stale-session repair**

Dry run: `rtk proxy node scripts/repair-session-timing.mjs`
Expected: `stale` is 1 before repair and 0 after the UI has resumed/stopped the session, or after `--apply`. Do not run `--apply` unless you want the session paused; either state is resumable.

- [ ] **Step 3: Check the choice flow**

- Study a new vocabulary card, hide the answer, choose the correct pair, commit, and confirm "Both components correct" and that only Hard/Good are available.
- Reload: the chosen pair and feedback must persist; options must not reappear.
- Resume after stop: same card, same committed response.
- Deliberately choose a wrong same-reading option on another card: expect "Reading correct, meaning different", Good/Easy disabled, Again only.
- Inspect the network response for an unrevealed card: no `answerSpecJson`, no `correctChoiceId`, no `tier`.
- Resize to 375 px: four options stack, no horizontal scroll, radio labels tap correctly.

- [ ] **Step 4: Confirm offline behavior**

Stop the network (or use the existing Playwright external-route abort). Starting a session and committing a choice must still work; no external request is needed.

---

## Task 6: Document the change and amend the Master Plan

**Files:**
- Modify: `FINALIZED_PROJECT_PLAN.md`, `docs/architecture.md`, `docs/tooling_Verification.md`
- Create: `docs/daily-recall-choice-handoff.md`

- [ ] **Step 1: Add amendment A4**

In `FINALIZED_PROJECT_PLAN.md`, in the amendment table at the top, add:

| ID | Intentional change | Affected sections |
|---|---|---|
| A4 | Scheduled vocabulary and core-kanji recall may use a four-option objective response instead of free-text entry; the choice is server-graded and stored as a genuine review with `grader='objective'` and a `choiceFormat` in the Attempt prompt snapshot. Unscheduled multiple-choice practice/tests still do not update FSRS. | 8, 9, 10, 18, 19 |

Add the full amendment paragraph immediately below the table (wording to keep exact):

> **Approved recall-format amendment — 18 October 2026:** scheduled vocabulary and core-kanji recall may present a four-option objective response in place of free-text entry. A vocabulary option pairs one hiragana reading with one English meaning, so the existing combined objective still requires both components; a core-kanji meaning option uses English meanings and a contextual-reading option uses hiragana readings only. Exactly one option is correct. The other three are constructed from real readings and meanings of other approved, source-verified items; no AI-generated Japanese, reading or meaning is used at review time, and no new table, dependency or service is introduced. A wrong option is rejected when it duplicates the prompt word, an accepted reading or gloss, or (for the same-reading option) overlaps the correct meaning; if fewer than three safe distractors exist, the card falls back to typed entry. The learner selects and commits before correctness is shown; the server stores the offered set in the immutable Attempt, grades the choice, and derives the same `readingCorrect`/`meaningCorrect` components used by the typed path. The Attempt and ReviewLog record the choice format; `Easy` is capped to `Good` for choice attempts. This supersedes the §8 statement that multiple-choice quizzes never update FSRS **only** for scheduled recall; unscheduled practice, lesson exercises and weekly tests remain non-scheduling.

- [ ] **Step 2: Update the affected sections**

- §8 *Reviews versus practice/tests*: add "Scheduled recall may use the A4 objective paired-choice format; unscheduled multiple-choice practice/tests still never update FSRS."
- §9 table: change the `Open-ended recall` row's decision to "Core" and its implementation to "Prefer open-ended recall, or the A4 paired-choice format for scheduled vocabulary/core-kanji recall; use self-grading only where equivalence is hard."
- §18 phase-2 acceptance checks: add "choice recall grades both components server-side, hides `answerSpecJson`/`correctChoiceId` until commitment, returns the original result on retry, and falls back to typed entry when the pool cannot supply three safe decoys."

- [ ] **Step 3: Update architecture and verification docs**

- `docs/architecture.md` *Recall correctness*: add one bullet describing the choice projection, `grader='objective'`, server-derived components, `Easy` cap, and typed fallback.
- `docs/tooling_Verification.md`: add a dated section with the actual commands from Tasks 1–4 and their outputs, explicitly separating automated results from the manual browser check. Do not claim PDF/source verification.
- Create `docs/daily-recall-choice-handoff.md` using the handoff format from [docs/implementation-workflow.md](../implementation-workflow.md#L39-L55), including:
  - Scope and Master Plan sections: §§8–10, 18–19 and A4.
  - What changed in timing and recall format.
  - The verified bug numbers (4,735 minutes at diagnosis) and the fix behavior.
  - Commands/results, including the manual `/review` check.
  - Limitations: recognition vs production; option set changes with `stateVersion`; kanji reading choice falls back to typed when fewer than three context readings exist; no AI validation.
  - Graphify required: **yes** — new `review/choices.mjs` and `review/timing.mjs` modules and edges; regenerate only after the default branch is clean and up to date. Do not run Graphify automatically.

- [ ] **Step 4: Final verification and diff check**

```powershell
rtk bun run test
rtk bun run test:review
rtk bun run lint
rtk bun run typecheck
rtk bun run build
rtk git diff --check
```

Expected: all pass. Inspect `rtk git status --short`; only the intended files plus pre-existing untracked files should appear.

- [ ] **Step 5: Handoff (manual Git only)**

```powershell
rtk git add -- FINALIZED_PROJECT_PLAN.md docs/architecture.md docs/tooling_Verification.md docs/daily-recall-choice-handoff.md docs/plans/2026-10-18-daily-recall-choice-mode.md
```

Suggested subject: `docs: record paired-choice recall amendment and verification`

---

## Verification matrix

| Requirement | Automated check | Manual check |
|---|---|---|
| Abandoned session shows real time, not days | `tests/review-timing.test.mjs`; stale-session test in `tests/review-postgres.test.mjs` | Open `/review` after a restart; value stays near real minutes |
| Stop/resume keeps accumulated time | Existing review tests plus new stop assertion | Stop, wait, resume; time continues from saved value |
| Four options with the right components | `tests/review-choices.test.mjs` (vocab pairs reading + meaning; kanji meaning/reading use their component) | Inspect a vocabulary card at 375 px |
| Exactly one correct option | Unit test `correctChoiceId`; integration test finds the pair | Commit each option type on synthetic data |
| Both components load-bearing | Unit tier test; integration partial-choice test | Wrong reading vs wrong meaning produces distinct feedback |
| No answer leak before commitment | Integration asserts no `answerSpecJson`/`correctChoiceId`; browser asserts no marker | Inspect unrevealed network payload |
| Objective grading, not client self-grade | Integration commits wrong choice with `rating:4` → effective `1` | Good disabled after wrong choice |
| Typed fallback | Unit null with one candidate; existing typed tests | Card with a one-item synthetic pool |
| Idempotency/atomicity preserved | Existing duplicate/stale/rollback tests | Retry after a simulated failure |
| Offline operation | Browser test aborts external routes | Disable network; commit a choice |
| Mobile/accessibility | Playwright 375 px, focus check | Keyboard 1–4, Enter, arrow keys |

---

## Risks and boundaries

- **Recognition is easier than production.** A4, `grader='objective'`, the `Easy` cap, the stored `choiceFormat`, and typed fallback keep the limitation visible. If delayed recall looks inflated after a few weeks, reintroduce a production check for stable cards.
- **Option text necessarily contains the correct answer.** This is inherent to multiple choice. Correctness is not marked, ordered, or included in the answer snapshot; the commitment gate remains.
- **The same-meaning option can look like an alternative reading.** Only the source-backed reading is accepted; the UI says "source-backed reading". If a word has multiple valid readings, this is a possible ambiguity; fall back to typed entry if observed.
- **Small pools / new items.** The current database covered every probed vocabulary, core-kanji-meaning and contextual-reading card, but a newly created objective (or an isolated synthetic one-item pool) may lack three safe decoys. It must fall back to typed entry; do not fabricate readings or meanings to fill the gap.
- **Idle threshold.** A genuine 16-minute pause on one card is treated as idle. That is a deliberate trade-off; the block budget is 15–60 minutes and cards are short.
- **No AI.** Deferred, not rejected forever; the `tier` field makes later distractor-quality analysis possible without new infrastructure.
- **No migration.** Options live in JSON snapshots; old Attempts without `grader` remain self-graded. Do not backfill.

---

## Handoff summary for this plan document

```text
Scope and Master Plan sections: daily recall timing (§§8, 10, 19) and proposed A4 (§§8–10, 18–19)
Implemented behavior: plan only; no application code changed
Implementation paths: see File map
Documentation paths: docs/plans/2026-10-18-daily-recall-choice-mode.md
Excluded or uncertain paths: pre-existing untracked scripts/dev-server.mjs, tests/dev-server.test.mjs, graphify-out/cache/, graphify-out/manifest.json
Verification performed: read-only session diagnostic (4,735 active minutes from a 3-day-old activeSince); code inspection; no tests run for new behavior
Remaining limitations: A4 requires approval; choice mode is recognition; no AI validation
Graphify required: yes, after implementation (new review modules), not now
Suggested exact git add:
rtk git add -- docs/plans/2026-10-18-daily-recall-choice-mode.md
Suggested commit subject: docs: plan daily recall choice mode and active-time fix
```
