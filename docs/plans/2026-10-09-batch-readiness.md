# Batch readiness and lesson exercise follow-up

Authority: FINALIZED_PROJECT_PLAN.md §§3–4, 8, 14–16, 18–20 and the learner's 9 October request. Use existing tables and Node/Bun tooling. No dependencies or Git mutations. Preserve unrelated edits.

Approved behavior: PDF extraction copies all visible source fields, vocabulary component boxes, kanji example words and grammar lesson questions/answers without inventing missing values. External meanings/readings and original mnemonics are separate attributed enrichment. Missing exercise section headings are null. Source duplicates are retained as evidence, not multiplied into study cards. Human verifies question option labels before answer-reason generation.

Lesson exercise: group by source book and lessonKey, aggregating split batches. Unlock after every approved grammar item in that lesson has an explicit introduction/studied timestamp. Imported or merely viewed items do not unlock it. Offer the source lesson questions as ungraded practice, preserve selection/responses across refresh, reveal only after response commitment. Use existing StudySession(mode=practice) and Content; do not update familiarity, cards, FSRS or scored-test eligibility. A verified book answer remains separate from generated explanation Content with payload answer_reason, exact question/revision/answer binding and generated labels. Conflicting/missing answer verification must block reason generation and omit feedback rather than guess.

Tasks:

- [x] Fix staging's nullable exercise_section mismatch with a failing regression; validate all three public templates.
- [x] Strengthen source extraction and template missing-data/duplicate/component instructions; add an independent provenance-aware enrichment prompt and answer-reason worker brief.
- [x] Implement bounded lesson list/unlock and persistent ungraded exercise UI/API using existing storage, same-origin/ownership protections and meaningful isolated checks.
- [x] Inspect existing 15 answer-verification records privately. Dispatch an engineering subagent for the 12 unambiguous human-verified answers and store reasons separately. Report Q11/Q12/Q15 conflicts; remaining content work awaits human book clarification.
- [x] Verify applicable unit/PostgreSQL/browser/build/lint/typecheck behavior; record actual results, exact staging paths, exclusions, commit subject and Graphify policy in `docs/batch-readiness-handoff.md`.

No autonomous application agent or per-question AI call is introduced. The requested subagent runs as a bounded engineering/content-enrichment step after human answer verification, rather than a paid/background application service. Human source/question approval and immutable evidence remain independent of ungraded availability.
