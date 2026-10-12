# Resolved database intake — 12 October 2026

The learner requested database loading and explicitly authorized publication of the current source and enrichment without another PDF comparison. Record/hash approvals retain `reviewBasis: user_accepted_without_pdf_comparison`; this is acceptance, not a claim of PDF fidelity, dictionary correctness, or verified question answers. The target was the configured local PostgreSQL database. No Neon write or Git mutation occurred.

All 59 selected prepared source batches were loaded: 55 new and four reused. Canonical publication persisted 1,019 vocabulary entries, 125 grammar points, and 356 kanji source entries. Exact kanji identities retained 353 new items and three existing matches. Current approved typed-row totals are 1,164 vocabulary (including 37 pre-existing reference words), 391 kanji, and 135 grammar. These counts do not establish complete coverage of the physical edition; the kanji total differs from the plan's claimed 382.

Dictionary and generated enrichment remain separately attributed. Existing early kanji supplements were preserved through nine additional review batches; their source records reuse existing canonical identities. One incoming kanji omission initially displaced an existing meaning. A further append-only correction restored the previously approved meaning with its original verified field evidence. All historical snapshots remain intact, and the final check found zero unresolved empty-array correction candidates.

Of 195 selected grammar questions, 194 were retained as canonical draft references. Their answer/target gates remain unverified, so this intake grants no scored or scheduled eligibility. Lesson 12, exercise 2, question 15 has an invalid ordering position and remains staged. At the learner's request it is the sole record in ignored `private-data/final_review_needed/`. Three vocabulary records also remain staged because their readings are missing: source numbers 118, 134, and 139. No reading or ordering position was guessed. Unresolved enrichment remains draft.

Private evidence is in `private-data/resolved-import-20261012/`: hash-bound inputs, staging receipts, exact selections/previews/approval receipts, promotion and repeat results, supplementation and preservation-correction receipts, `database-verification-final.json`, `learner-preservation-final.json`, and `remaining-review.json`. Backups are in `private-data/backups/pre-resolved-import-20261012/` and `private-data/backups/final-resolved-import-20261012/`; an intermediate post-import backup is also retained. Original source files were preserved. Copies requiring the staging schema's `unreviewed` label retain their supplied review label separately.

Actual verification: eight importer tests and seven canonical/catalog/study-content tests passed. Direct PostgreSQL checks confirmed staged file hashes, approved item/source acceptance records, and published counts. Every production promotion was immediately repeated with zero new promoted records. Before/final backup fingerprints matched for all eight learner/history tables, including cards, review logs, sessions, attempts, and generation runs. No cards, familiarity, FSRS state, or learner-history changes occurred. UI/browser checks and a restore exercise were not run for this data-only intake.

Manual Git handoff:

```powershell
rtk git add -- docs/resolved-database-import-handoff.md
```

Suggested commit subject: `docs: record accepted database intake and remaining review`

Graphify required: **no** — data operations and a documentation handoff do not change architectural boundaries.

If continuing after the learner supplies corrections, use **gpt-6.1-sol, Medium** for exact record/hash approvals and append-only source revisions. Read `docs/database-import.md`, this handoff, and private `remaining-review.json`; preserve prior receipts and backups, import only supplied corrections, and leave unverified answers/readings unresolved. No new extraction or reference lookup is necessary merely to resume this intake.

## Final four corrections — 12 October 2026

The learner subsequently supplied the exact question correction and authorized using the three retained affix ruby readings as main readings. Rendering excerpt page 8 of the original lesson-12 PDF confirmed the fourth star slot, printed page 254, original options, and key/order. A new question draft fixes the four-slot prompt and zero-based target position, records the verified answer and human answer-text check, and retains deferred grammar targets/ungraded usage. The three affixes were published with their retained source readings. Original staging payloads and the isolated review file remain unchanged; `private-data/final_review_needed/resolution-20261012.json` marks that file resolved.

The four-record pending list above is historical. Current correction/approval receipts, direct verification and an empty remaining-review snapshot are in `private-data/resolved-import-20261012/final-four-corrections/`. Every correction promotion was repeated with zero new records. Approved typed-row totals are now **1,167 vocabulary, 391 kanji, and 135 grammar**: vocabulary includes 1,130 prepared book records and 37 existing reference words. The learner reports book totals of 1,100 vocabulary, 382 kanji and 135 grammar points; vocabulary/kanji count reconciliation and unresolved enrichment remain separate unfinished work. No overall book-fidelity or completeness claim is made by these four corrections.
