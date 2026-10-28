# Sprint daily recall and match game — design

Date: 26 October 2026. Status: **draft, awaiting learner approval**. Nothing here is implemented yet.

Exam: JLPT N2, December 2026 (about six weeks out; the learner plans a one-month sprint).

## 1. Why

The learner says daily recall "is not working as intended". The live study database shows why:

| Fact (26 Oct 2026, aggregates only) | Value |
|---|---|
| Items marked studied | 143 (116 in the last 7 days) |
| Cards that have ever entered recall (`status='active'`) | 15 |
| Cards of studied items still waiting (`status='new'`) | 150 (96 vocabulary, 54 kanji) |
| Reviews ever logged | 34, over 5 days |
| Daily activation allowance | 5 vocabulary / 2 kanji / 1 grammar / 8 total |

"Mark as studied" only queues an item's cards. They enter recall only through a "continue learning" session, at most 8 a day, and never while any review is due (`startSession`, `viewInTransaction`, `activateCard` in `src/lib/server/review/service.mjs`). At that pace the current studied backlog alone takes about 20 days to clear. On a 50–100-word study day almost nothing studied reaches recall before the exam.

What does work: FSRS scheduling (ts-fsrs 5.4.2, retention 0.90) for the 15 active cards, the server-graded four-option choice mode (A4/A5), segmented timing and sibling burying.

Other gaps found:

- The session's card list is frozen at start, so a card answered Again never returns in the same session.
- `commitResponse` rejects a card that is not yet due, so there is no early review and no "review more".
- Kanji have two cards each (meaning, and reading in a word). The learner finds that redundant.

## 2. How the learner studies (their words, summarised)

- Each day they first study new N2 content at their own pace. The amount varies: 10–100 vocabulary, 10–20 kanji, 5–10 grammar points.
- Later the same day they review what they studied yesterday and the day before.
- For N3/N4 they kept a separate note of hard words and reviewed it. They want the app to do that job now.
- Heavy-day review capacity: **100 vocabulary, 30–40 kanji, 10 grammar**.
- They do not want to re-revise everything they studied before (for example words 1–499 while learning 500–550). They want the items they are most likely to forget.

## 3. Goals, non-goals, anti-goals

**Goals**

1. Everything marked studied reaches recall within a day, with no small activation allowance.
2. One daily review session, capped per type, filled with the items most at risk of being forgotten.
3. A missed card comes back once later in the same session.
4. Optional "review more" pulls the next most at-risk cards early.
5. One kanji card: the kanji as the prompt, with options pairing a reading and a meaning.
6. A Quizlet-style match game for vocabulary and kanji, as pure practice.

**Non-goals**

- Grammar recall changes. The learner explicitly left grammar out. No `grammar_cloze` cards exist today; the existing grammar code path is left as it is.
- Custom interval formulas, a custom optimiser, exam-date interval caps or a changed retention target. FSRS stays as configured (§8 of the master plan).
- New tables, Prisma migrations or new dependencies.
- Leaderboards, sound or animation polish for the match game.

**Anti-goals (a failure even if it "works")**

- Review piles up into hundreds of cards a day.
- The match game changes FSRS state or creates ReviewLogs.
- Fabricated recall: studied marking or match play must never create a rating.
- Any loss of review history when kanji reading cards are retired.

## 4. Daily recall — selection strategy

### 4.1 Caps

New user setting `dailyReviewCaps`: `{vocabulary:100, kanji:40, grammar:10}`, editable on the dashboard (replacing the activation-allowance controls). The cap counts cards **answered today** per type, across all sessions of the study day, so starting a second session cannot exceed it. "Review more" (§4.4) is the only way past the cap, and only on explicit request.

These numbers are the learner's stated heavy-day capacity. They are a ceiling, not a target.

### 4.2 Queue order

When a daily session starts, fill the queue from these tiers in order, skipping buried cards and siblings already chosen, until each type's remaining cap is used:

1. **First recall of studied items.** Cards with `status='new'` whose item has `user_items.introducedAt` set, oldest study first. This is the learner's "review what I studied yesterday". On the first day after release this tier holds the ~150 waiting cards; the caps fit them in one or two days.
2. **Due cards.** Active cards with `dueAt <= now`, ordered by **lowest current retrievability first** (`fsrs.get_retrievability(card, now, false)` from the pinned ts-fsrs). Learning and relearning cards (recent misses) fall here naturally: they have low stability and so low retrievability. This replaces today's oldest-due-first order.

**70/30 split (learner's decision).** Within each type's remaining cap, tier 1 may take at most 70% (rounded down) and tier 2 at most 30% (rounded up). Whichever tier has fewer eligible cards gives its unused share to the other. Example: with a 100-vocabulary cap and 150 waiting plus 80 due, the session holds 70 first-recall + 30 due cards. With 20 waiting and 80 due it holds 20 + 80. With the cap partly used earlier in the day, the split applies to what remains. The split stops a heavy study day from pushing all due older cards to the next day.

Not-due active cards are never added automatically. At retention 0.90 a card becomes due when its predicted recall falls to about 90%, so tier 2 is already "most likely to forget soon". Cards the learner keeps getting right have long intervals and stay out of the queue. This is how words 1–499 avoid bulk re-revision.

Removed rules:

- The per-type activation allowance, the global allowance of 8, "Add another batch", and the backlog pause on activation. The cap in §4.1 is the only workload control.
- The rule that defers new cards while any review is due.
- `startSession`'s `other` source: cards of items never marked studied. Recall only covers what the learner explicitly studied (*builder's call recorded here: the learner always studies in the app first, then marks studied*).

The two start buttons ("Start due reviews" / "Continue learning") become one **Start daily review**. The `includeNew` flag is removed from the API.

### 4.3 Missed cards return once in-session

After `rate` with an effective rating of Again (1), append one new snapshot entry for that card at the end of the session's queue, with the card's new `stateVersion`. Each card is re-queued at most once per session. When the learner reaches it, it is reviewed even though its FSRS due time (the 10-minute relearning step) may not have arrived (see §4.5). This is a genuine FSRS review at its actual timestamp, not a synthetic one.

### 4.4 Review more

When the session is empty, offer **Review more (20)**. It starts a new session of up to 20 active cards that are not due, lowest retrievability first, ignoring the daily cap. It is never offered automatically. Each is a genuine early review; FSRS handles the short elapsed time.

### 4.5 Server rule changes (`service.mjs`)

- `commitResponse`: replace "Card is not due" with "the card is an entry of this session's snapshot". The snapshot is server-built, so the client still cannot pick arbitrary cards.
- `viewInTransaction`: drop the new-card allowance check and the "defer new while any due" check. Keep the `stateVersion` match against the **latest** snapshot entry for that card.
- `activateCard`: drop the allowance and backlog checks. Keep the activation fields (`introducedAt`, `introductionDay`, initial FSRS state) and sibling burying.
- Sibling burying stays as it is (until next study day). It no longer interacts with kanji reading cards, which are retired.
- `dashboard`: show today's answered count per type against the caps, due count, waiting first-recall count, and whether "review more" is available. Drop the activation fields.

## 5. Kanji: one card (amendment A6, reverses A2's second objective)

- `syncCards` stops creating `kanji_reading_context` cards.
- A one-time, idempotent step (in `syncCards` or a small script with dry-run and apply, *builder's call*) sets existing `kanji_reading_context` cards with status `new` or `active` to `retired`. Nothing is deleted; their ReviewLogs and Attempts stay. There are 2 active and 136 waiting such cards today.
- `kanji_meaning` remains the single kanji card: the prompt is the kanji glyph and the four options each pair a hiragana reading with an English meaning, as built today by `buildKanjiMeaningChoices` (refinement of 19 Oct). The cue text changes to "Choose the reading and meaning".
- Known limit, unchanged: when no bilingual set can be formed (10 of 85 core-kanji cards at last count), typed meaning entry remains the fallback. No reading or meaning is fabricated.
- `vocabularyKanji` links already created stay; they are harmless.
- Update `FINALIZED_PROJECT_PLAN.md` with amendment **A6** (one kanji objective; activation allowance replaced by daily caps; retrievability ordering; in-session Again repeat; early review on request). Also update `docs/architecture.md` (independent kanji objectives, workload control). The master plan's Phase 4 statement "do not impose a catch-up quota" still holds: caps are the learner's ceiling, not a quota.

## 6. Match game

Modelled on Quizlet Match (per Quizlet's help page: six pairs per round, tap a term then its match, matched pairs disappear, scored by time; wrong matches add a time penalty).

### 6.1 Play

- Route `/practice/match`, linked from the dashboard and the practice page.
- Choose **Vocabulary** or **Kanji**.
- A round shows **6 pairs as 12 tiles** in a shuffled grid.
  - Vocabulary: one tile shows the written form; its partner shows the English meaning.
  - Kanji: one tile shows the kanji; its partner shows "reading · meaning", from the same source data as the kanji choice options. *Builder's call: kanji tiles may show the meaning only when no source-backed reading is available.*
- The learner taps a Japanese tile first, then a meaning tile. Correct: both tiles disappear. Wrong: both shake and **+1 second** is added. Tapping a meaning tile first does nothing. Tapping the selected tile again deselects it.
- A timer starts on the first tap. The round ends when the board is clear and shows the time, the number of misses and the best time this browser has recorded for that mode (`localStorage`, wrapped in try/catch). **Play again** deals the next 6.
- Keyboard and screen-reader access: tiles are buttons with `aria-pressed`; the result is announced via `aria-live`.

### 6.2 Which items

- Only items the learner has already marked studied, and only those with at least one review (`status='active'`). This keeps a match from being the first exposure.
- Exclude cards that are due today or sit in today's open session queue. The master plan (§8, "Reviews versus practice/tests") forbids testing an answer right after it was exposed in practice. Excluding today's due cards satisfies that without storing exposure records.
- Pick lowest retrievability first, so the game targets weak items, with random tie-breaks. No two tiles in a round may share a meaning (normalised), so a pair is never ambiguous.
- If fewer than 6 eligible pairs exist, play with what exists (minimum 3), or show "Study and review more items first".

### 6.3 Pure practice

The match game reads only. It writes no Attempt, ReviewLog, Card change, StudySession or activity event, and calls no FSRS function. The pairs are fetched from a new read-only `GET /api/practice/match?kind=vocabulary|kanji` (local-only and no-store, like `/api/review`). The answer key is in the payload; that is acceptable for ungraded practice. Grading happens in the browser.

## 7. Data changes

- No schema migration.
- `users.settingsJson`: add `dailyReviewCaps`. Stop reading `newCardLimits`, `activationIncrease` and `activationBatchReceipts`, but leave the stored values in place.
- `study_sessions.selectionSnapshotJson.entries`: may now contain the same `cardId` twice (an Again repeat). Bump `policyVersion` to 2. Version-1 sessions stay readable: the view finishes or completes them as today.
- `cards`: `kanji_reading_context` rows become `retired`.

## 8. UI changes

- `src/components/review.tsx`: one start button. Progress shows answered vs today's caps per type. Repeated missed cards are labelled "Again". When the session is empty, show "Review more (20)".
- `src/app/page.tsx` dashboard: replace the activation status line and `ActivationControls` with today's progress against the caps, the waiting first-recall count, and a small caps editor (re-use the `activation-controls.tsx` slot). Add a link to Match.
- New `src/components/match-game.tsx` and `src/app/practice/match/page.tsx`.

## 9. Tests

Run with `bun run test`, `bun run test:review`, `npx tsc --noEmit`, `bun run lint` and `bun run test:review:browser`.

- **Unit** (`tests/review-selection.test.mjs`, new, pure function): given cards with FSRS states, a time and caps, the queue is first-recall cards (oldest study first), then due cards by ascending retrievability. Caps are per type. The 70/30 split holds when both tiers overflow, and unused share flows to the other tier when one is short (cases: 150 waiting + 80 due → 70+30; 20 + 80 → 20+80; 150 + 5 → 95+5). Siblings are excluded. Not-due cards are never included unless in review-more mode.
- **Unit** (`tests/match-pairs.test.mjs`, new): pair selection excludes due and new cards and duplicate meanings, returns at most 6, and orders by lowest retrievability.
- **PostgreSQL** (`tests/review-postgres.test.mjs`, extended):
  - Marking 30 vocabulary items studied puts all 30 in today's session, beyond the old cap of 5.
  - The cap is enforced across two sessions on the same day.
  - An Again card reappears once at the end of the session and its second review writes a second ReviewLog. A second Again does not re-queue it again.
  - Review more reviews not-due cards and records genuine logs.
  - The retire step marks `kanji_reading_context` cards retired, keeps their logs, and running it twice changes nothing.
  - `syncCards` no longer creates reading cards.
  - The match endpoint writes nothing: row counts of attempts, review_logs, cards (by `stateVersion`) and study_sessions are unchanged after calls.
  - Existing tests that assert the 8-card allowance or backlog pause are rewritten to the new rules, not deleted silently. List each changed assertion in the handoff.
- **Browser** (`tests/browser/review.spec.ts` plus a new `match.spec.ts`): the single start button, an Again card returning, a match round completed with one deliberate miss (time includes +1 s), at desktop and 375 px.

## 10. Rollout on the real database

1. Back up the study database (existing restore workflow) before running the retire step.
2. Run the retire step as a dry run, report counts, then apply.
3. On the first day after release, expect a session of up to 100 vocabulary and 40 kanji covering the ~150 waiting studied cards.

## 11. Decided by the learner

- Daily review caps: 100 vocabulary, 30–40 kanji (40 used), 10 grammar.
- Each cap is split 70% newly studied (first recall) / 30% due older cards, with unused share flowing to the other tier.
- Studied items should reach recall without the small daily allowance; review should surface what is most likely to be forgotten, not the whole backlog.
- Kanji: one card, the kanji as the prompt, options showing reading with meaning; no second card.
- Grammar recall: outside this plan.
- Match game: Quizlet-style, tap the word then its meaning, shuffled tiles, for vocabulary and kanji.
- Match game is pure practice and never affects review scheduling.

## 12. Calls made by the designer (check these)

- Retention stays 0.90; no exam-date interval cap.
- Not-due cards only via explicit "Review more (20)".
- Again cards return once per session, at the end of the queue.
- Cards of never-studied items no longer enter daily recall.
- Match: 6 pairs, +1 s per miss, best time stored in the browser only, only reviewed items, excluding cards due today.
- Kanji match tiles show "reading · meaning".

## 13. Left to the builder

Exact component layout and styling; whether the retire step lives in `syncCards` or a script; query shape for retrievability (computing it in JS over the active cards is fine at this scale, about 2,000 cards maximum); handling version-1 open sessions at release.
