# Phase 1 implementation handoff — 5 October 2026

## Latest handoff — after WaniKani approval

Final user dispositions: both corrected source_answer_text values are now applied to PostgreSQL, preserving original question revisions. All 15 questions record questionReview.sourceAnswerTextVerified=true, grammarConnections=intentionally_deferred and usage=reference_only. They remain draft/ungraded and excluded from scored/scheduled use. The 11 separate supplements are accepted references with payload addedBy=AI, visible AI labels and retained acceptedLimitations. Generated origins remain generated; the normalized dictionary addition retains its immutable dictionary-backed user origin alongside the AI-assistance field. No book field is overwritten by these supplements. The remaining 90 draft records are 15 intentionally deferred question references and their 75 language aids, not 90 separate content errors. There are zero other supplemental drafts and zero kanji meaning gaps. Exact approval/promotion and repeat proofs are private-data/imports/final-content-decisions-20261005/promotion-receipt.json. This supersedes the pending-correction/101-draft status below.

Fresh verification for these final dispositions: 12 unit checks passed (10 database checks skipped in that suite); all 10 isolated PostgreSQL checks passed; lint, typecheck and production build passed; all four production browser flows passed in one run. A bounded real-data comparison confirms exactly two changed answer texts, 15 intentional deferrals and 11 explicitly AI-labelled additions. Grammar and kanji repeat promotions each write zero records with unchanged counts. Final proof: private-data/imports/final-content-decisions-20261005/final-verification.json. Implementation paths for this follow-up: src/lib/server/content/canonical-import.mjs, src/components/reference.tsx, tests/canonical-import.test.mjs, tests/canonical-postgres.test.mjs and tests/browser/catalog.spec.ts. Documentation paths: this handoff and docs/database-import.md. All private reports/scripts/evidence remain excluded; no Git mutation or new Graphify milestone.

The Phase 1 application/import engineering checks are complete under the user's explicit extraction acceptance. This does **not** mean every source fact was independently verified or every draft resolved. PostgreSQL has 108 vocabulary, 38 kanji and 10 grammar Items. The approved WaniKani update promoted all 38 kanji with separate dictionary citations, primary meanings, radical combinations, short meaning-mnemonic excerpts and links to full mnemonics; zero kanji meaning gaps remain. BeautifulSoup 4.14.3 parsed cached pages locally. Repeat promotion wrote zero new records and preserved counts.

There are still 101 unresolved Content drafts: 15 questions, 75 dependent question-language aids, and 11 other meaning/reading drafts. The user checked all 15 source_answer_text fields and changed two in the original grammar JSON. That corrected file is staged and previewed as batch b6a4f8e0-eef7-4ca5-9a2f-5305b0f41e17; it has not replaced canonical question drafts. Structured answer specifications/grammar targets remain unresolved. Original PDF transcription/edition verification remains unperformed under the user's acceptance exception.

Fresh checks: unit 11 passed (9 PostgreSQL cases skipped there); isolated PostgreSQL 9 passed; lint, typecheck and build passed. All three production browser flows passed: reference/source navigation, all ten English grammar explanations, and all 38 kanji mnemonic/radical displays. The latter passed on rerun with a 120-second allowance after the default 30-second timeout was insufficient.

Phase 2 has only a plan at docs/plans/2026-10-05-phase-2.md and the pinned approved ts-fsrs 5.4.2 dependency in package.json/bun.lock. No learner tables, cards, FSRS adapter, review transactions, or review UI have been implemented. The user will start Phase 2 in another chat. No Git mutations ran. Graphify required: no for this display/content follow-up; the original milestone policy still waits for integrated, clean-source confirmation.

Private evidence: private-data/imports/wanikani-review-20261005/promotion-receipt-with-radicals.json; canonical-selection-with-radicals.json; canonical-preview-with-radicals.json; mnemonics-radicals-bs4.json. Current unresolved list: private-data/reports/unresolved-drafts-20261005.md. These and .local/python-tools remain excluded from Git. Historical details below describe the original promotion before this follow-up.

Follow-up: all ten stored approved generated grammar English explanations now appear prominently beside the Japanese explanation, with a Generated label and citations. The confusing empty book-English field is removed; no database content or approval status changed. Their recorded generation configuration is GPT-6 Sol, medium effort. Lint/typecheck/build and two production-browser flows passed, including every grammar point. A complete private unresolved inventory is at `private-data/reports/unresolved-drafts-20261005.md`: 15 questions, 75 dependent question-language aids, nine word-meaning drafts and two name-reading drafts; 14 kanji meaning-origin gaps are listed separately. This small display follow-up adds no new Graphify milestone.

Authority: Master Plan §§2–4, 16, 18; the user's explicit acceptance of the existing extraction and instruction to preview, record exact approvals and promote. Independent PDF comparison is not claimed. No phase-2 work or Git integration ran.

## Implemented and verified

- Real canonical data: 108 vocabulary, 38 kanji, 10 grammar items; 171 exact record/hash approvals. Vocabulary and kanji batches are promoted; grammar is partial with 15 unresolved draft questions.
- Supplementary reference: 169 approved explanations and 86 draft explanations. These include dictionary word meanings and generated grammar assistance. One normalized dictionary match, eight composed phrase meanings, uncertain names/fragments and every question-language addition stay draft. The 14 questionable extracted kanji-gloss origins remain excluded from canonical meanings; original evidence is retained.
- Private v2 selections, previews, exact approval receipts and preservation/repeat proofs live under ignored `private-data/imports/promotion-20261005/`. Approval records bind exact source, decisions, citations, origins, uncertainties and dependencies. Acceptance basis explicitly says no PDF comparison.
- All three raw-file hashes, all three staged payloads and all 171 top-level source payloads are unchanged. Real staging reload inserts no batches. Real canonical reload inserts no records and preserves batch status/commit metadata.
- The read-only Next.js app has reference lists, search/pagination, details, citations, separate origins, missing fields and visible unresolved drafts. Exact source links survive refresh and retain historical field evidence. Ordinary source browsing omits superseded Content; focused historical evidence is labelled. Raw JSON/PDF files and database credentials are not served.

## Verification evidence

| Command / check | Result |
|---|---|
| `rtk bun run test` | 11 passed; 9 PostgreSQL checks skipped intentionally |
| `rtk bun run test:canonical` | 9 passed in fresh isolated PostgreSQL; no real fixture writes |
| `rtk bun run lint` | Passed |
| `rtk bun run typecheck` | Passed, including real Next route generation |
| `rtk bun run build` | Passed, all reference routes server-rendered on Node |
| `rtk bun run test:browser` | Passed in installed Edge against the real accepted reference library |
| Private real staging/canonical repeat checks | No duplicate records; persistent metadata/counts unchanged |
| Private preservation check | Three raw and staged sources plus 171 canonical source payloads unchanged |
| Desktop/mobile visual inspection | Reference shelf inspected at 1280 px and 375 px; local images ignored |

The isolated identity checks establish one canonical 実 with two book citations, vocabulary reading/POS/sense separation, grammar construction separation, exact approval invalidation, atomic SQL rollback, correction history and citation omission/restoration. This is synthetic evidence, not a second real-book 実 citation or a language verification claim.

Browser scope: exact citation navigation/refresh, book/dictionary/generated/acceptance/draft labels, question exclusion notices, keyboard skip-link focus, narrow-screen wrapping, empty and repeated queries, invalid IDs and private-path 404. It does not verify a study/review session, which is not implemented.

## Remaining source gates and deferred work

The user's three-batch acceptance overrides manual comparison for this import only. Actual PDF inventory, physical edition/year/ISBN, representative extraction samples and independent page/transcription comparison from Master Plan §§16/18 remain unverified. Do not describe this as full source-quality Phase-1 acceptance. No full-book import, source PDF preview, vocabulary-kanji relation enrichment, scheduler/cards, learner introduction, assessments, automated generation or backup restore is claimed. Do not start phase 2 automatically.

## Implementation paths

```text
package.json
bun.lock
package-lock.json (existing intentional Bun-migration deletion)
tsconfig.json
next-env.d.ts
next.config.ts
postcss.config.mjs
eslint.config.mjs
playwright.config.ts
src/app/layout.tsx
src/app/globals.css
src/app/page.tsx
src/app/error.tsx
src/app/loading.tsx
src/app/not-found.tsx
src/app/[kind]/page.tsx
src/app/[kind]/[id]/page.tsx
src/app/sources/page.tsx
src/app/sources/[id]/page.tsx
src/components/reference.tsx
src/lib/server/db.ts
src/lib/server/content/catalog.ts
src/lib/server/content/catalog-input.ts
src/lib/server/content/canonical-import.mjs
tests/canonical-import.test.mjs
tests/canonical-postgres.test.mjs
tests/catalog-queries.test.mjs
tests/browser/catalog.spec.ts
```

## Documentation paths

```text
AGENTS.md
README.md
docs/database-import.md
docs/repository-structure.md
docs/tooling_Verification.md
docs/implementation-workflow.md
docs/graphify.md
docs/phase-1-handoff.md
docs/plans/2026-10-05-phase-1.md
src/app/README.md
src/components/README.md
src/lib/server/content/README.md
tests/README.md
```

Existing Bun-migration edits in shared package/status docs are retained in this coherent bundle. The package.json/bun.lock bundle also includes the explicitly authorized ts-fsrs 5.4.2 preparation for Phase 2; no scheduler implementation is included. Review the combined diff before staging.

## Excluded or uncertain

- `docs/extraction-templates/extraction-prompt.md`: pre-existing extraction-template changes; preserved and excluded from this suggested bundle.
- `FINALIZED_PROJECT_PLAN.md`: currently modified outside this handoff; preserve and exclude until its separate amendment is reviewed for inclusion. `docs/plans/2026-10-05-phase-2.md` is next-phase preparation and excluded from this phase bundle. Prisma schema/migrations and existing extraction JSON/reference assets are unchanged; do not stage incidentally.
- `private-data/`, `.local/`, `.env*` secrets, `.next/`, dependencies, test output and retained isolated databases: private/generated; excluded. Real database promotion does not travel in the code commit. Keep its private approval/evidence exports locally.

## Manual Git handoff

Suggested subject: `feat: complete phase 1 imports and source-aware reference app`

From the repository root, inspect the combined diff and then stage only this intended bundle:

```powershell
rtk git add -- package.json bun.lock package-lock.json tsconfig.json next-env.d.ts next.config.ts postcss.config.mjs eslint.config.mjs playwright.config.ts 'src/app/layout.tsx' 'src/app/globals.css' 'src/app/page.tsx' 'src/app/error.tsx' 'src/app/loading.tsx' 'src/app/not-found.tsx' 'src/app/[kind]/page.tsx' 'src/app/[kind]/[id]/page.tsx' 'src/app/sources/page.tsx' 'src/app/sources/[id]/page.tsx' src/components/reference.tsx src/lib/server/db.ts src/lib/server/content/catalog.ts src/lib/server/content/catalog-input.ts src/lib/server/content/canonical-import.mjs tests/canonical-import.test.mjs tests/canonical-postgres.test.mjs tests/catalog-queries.test.mjs tests/browser/catalog.spec.ts AGENTS.md README.md docs/database-import.md docs/repository-structure.md docs/tooling_Verification.md docs/implementation-workflow.md docs/graphify.md docs/phase-1-handoff.md docs/plans/2026-10-05-phase-1.md src/app/README.md src/components/README.md src/lib/server/content/README.md tests/README.md
```

**Graphify required: yes**, for the implemented application/content milestone, after integration. Regeneration is pending user confirmation that the default branch is clean and up to date; no index was regenerated.

## Antigravity brief

Plan sections: §§2–4, 16, 18. Update only the status/verification docs listed above from the checks in this handoff; preserve acceptance-without-comparison, dictionary/generated origins and draft gaps. Exclude original books/imports/private receipts, secrets, templates and learner data. Do not invent source verification, cards, study behavior, backup restoration or completed physical PDF intake. Graphify is a separate confirmed post-integration step. This brief was prepared here, not sent to another chat.
