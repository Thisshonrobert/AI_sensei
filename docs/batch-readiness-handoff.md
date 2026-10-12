# Batch extraction and lesson exercise handoff — 9 October 2026

Authority: the batch/lesson clarification in `FINALIZED_PROJECT_PLAN.md`, §§3–4, 8, 14–16, 18–20, and the learner's explicit request. This is a bounded follow-up using existing storage; it does not establish a new phase acceptance or approve scored questions.

## Result

- PDF extraction is source-only and covers all printed vocabulary component boxes, kanji example words/readings/meanings, and grammar lesson questions/options/answers. Missing headings remain null; stable record keys preserve split-batch identities. All three templates pass the actual staging sanitizer. Separate enrichment and answer-reason prompts describe later work and honest provenance.
- `/grammar/exercises` unlocks after the positive source-established full-lesson count is present and every source-verified, approved grammar point for the source/lesson is explicitly studied. Current source rows and staged split-batch keys/counts prevent incomplete lessons from unlocking; unknown totals stay locked. Imported/viewed grammar and a fully promoted batch status do not substitute for completion.
- Ungraded practice freezes question revisions, verified answers and available explanations in existing practice sessions. Commitment precedes feedback; refresh retains responses. Daily/weekly assessment paths cannot accept these sessions. No scheduler/familiarity/scored outcome writes occur in this feature. Limits: 2,000 library metadata groups/entries, 500 source rows per lesson, 100 questions per session.
- An engineering subagent generated and stored 12 original English `answer_reason` drafts in separate generated explanation Content. The worker requires exact human answer approval, current revision and a binding to prompt/options/answer decisions. A repeat inserted zero. Independent final local inspection found 15 draft/ungraded questions, 12 unambiguous verified answers and 12 exact explanations. All 15 source question/answer records remained unchanged in the worker's comparison. No historical learner-table fingerprints were taken; learner-state preservation is established by synthetic integration checks and the restricted write path, not a real-history before/after audit.
- Q11, Q12 and Q15 remain unresolved: stored answer labels and ★ ordering sequences conflict (respectively 4 vs 2, 1 vs 2, 4 vs 1). Human book clarification is pending. Those questions remain available ungraded without answer/reason feedback; no answer was guessed or corrected.

The tested build is running on localhost:3001. Feedback in an existing session is intentionally a historical snapshot; reasons added or corrected later appear in a new session, not silently in a running one.

## Historical extraction answers

The initial vocabulary suggestions were supplied by the learner; retained evidence does not identify their original model. Codex subsequently audited all 108 whole-word identities with EDRDG/JMdict, corrected 26 component readings and filled 36 component meanings. See `vocabulary-component-aids-handoff.md`.

All 140 kanji book example words already had readings. Repeated display came from rendering book examples and supplements separately; unique matching entries were merged for display while raw evidence remained intact. Missing meanings received separate dictionary evidence. The local library contains 38 complete original generated mnemonics with WaniKani component attribution, rather than copied complete WaniKani stories. See `phase-3-content-neon-followup.md`. New batches still require independent review; old acceptance does not approve them.

## Actual verification

- `rtk proxy bun.cmd run test`: 63 passed, 56 database-dependent checks skipped, zero failed.
- `rtk proxy bun.cmd run test:lesson-exercises:browser`: three isolated PostgreSQL checks passed, one browser check passed. Covers partial split-batch gating, durable commitment/reveal/resume, ownership, answer redaction, cross-origin rejection and 390 px fit.
- `rtk proxy bun.cmd run test:assessment`: ten isolated PostgreSQL checks passed.
- `rtk proxy bun.cmd run build`, `lint`, `typecheck`: passed independently.
- `rtk git diff --check`: passed.
- Bounded local answer-reason inspection: 15 questions, 12 verified unambiguous answers, 12 exact generated reasons, 15 draft/ungraded questions, zero inserts.

Actual PDF transcription, correctness of newly generated explanations and the three conflicting ordering answers are not established by engineering tests. No new dependencies or migrations were introduced by this follow-up.

## Manual Git handoff

Implementation: importer nullable heading fix and its regression; lesson service/API/page/component and unit/PostgreSQL/browser runners; separate reason helper/types/CLI/tests; grammar catalog link; two package scripts and the assessment session namespace guard.

Documentation: Master Plan clarification, three affected extraction files, two new prompts, database/tooling notes, the bounded plan and this handoff.

Excluded: all `private-data/` and `.local/` evidence, credentials, learner records, Graphify output, prior Phase 5 plans/migrations/provider/analyzer tests and other unrelated dirty files. `package.json` and `src/lib/server/assessment/service.mjs` contain prior Phase 5 changes. Stage only this follow-up's two lesson scripts and the lesson session guard with patch staging. The existing Phase 5 work is an integration prerequisite; do not present this bundle as an independent clean-base cherry-pick without reviewing those changes.

```powershell
rtk git add -- FINALIZED_PROJECT_PLAN.md docs/database-import.md docs/tooling_Verification.md docs/batch-readiness-handoff.md docs/plans/2026-10-09-batch-readiness.md docs/extraction-templates/extraction-prompt.md docs/extraction-templates/enrichment-prompt.md docs/extraction-templates/lesson-answer-reasons-prompt.md docs/extraction-templates/kanji.template.json docs/extraction-templates/vocabulary.template.json scripts/import-batches.mjs scripts/lesson-answer-reasons.mjs scripts/test-lesson-exercises-postgres.mjs 'src/app/[kind]/page.tsx' src/app/api/lesson-exercises src/app/grammar/exercises src/components/lesson-exercises.tsx src/lib/server/lesson-exercises src/lib/server/content/lesson-answer-reasons.mjs src/lib/server/content/lesson-answer-reasons.d.mts tests/import-batches.test.mjs tests/lesson-answer-reasons.test.mjs tests/lesson-exercises.test.mjs tests/lesson-exercises-postgres.test.mjs tests/browser/lesson-exercises.spec.ts
rtk git add -p -- package.json src/lib/server/assessment/service.mjs
```

Suggested commit subject: `fix: prepare source batches and unlock ungraded lesson exercises`.

Graphify required: no — bounded follow-up, no new architecture or storage model. No Git mutations or Graphify refresh were executed.
