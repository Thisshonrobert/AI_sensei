# Website verification — 13 October 2026

Scope: final engineering audit of the existing study website, including layout, navigation, recall, assessments, lesson exercises, reading aids and unwanted evidence disclosures. This is not a new content approval or a declaration that deferred project phases are complete.

## Changes

- Removed source/evidence links and disclosures from the dashboard, shared navigation, entry details, grammar explanations/comparisons, recall study backs and assessment results. Dedicated `/sources` pages and stored provenance remain available. Generated/draft labels, missing-data handling, dictionary licences and publication gates remain intact.
- Corrected practice copy to one connected passage of up to ten sentences, matching the current Master Plan amendment.
- Added a browser regression for the study routes at 320, 375, 768 and 1280 pixels. Updated catalog/dashboard checks for expanded library counts, approved versus draft supplements, native versus supplemental English explanations, collapsed settings and awaited navigation. Catalog explanation/mnemonic loops explicitly cover the first page, not the entire library.

## Verification

All shell commands used RTK. Bun scripts execute Node; database mutation tests use isolated synthetic localhost databases. Actual learner records were only viewed by the catalog/layout checks. No live AI call, source promotion, scheduled learner event, commit, push or branch change was performed by this audit.

- Final `bun run test`: 91 passed, 58 integration checks skipped by this unit runner; those domains were exercised through the dedicated runners below. The earlier audit run passed 90 before concurrent development-server testing was added.
- `bun run test:canonical`: 10 PostgreSQL checks passed.
- `bun run test:review`: 22 PostgreSQL checks passed.
- `bun run test:assessment`: 10 PostgreSQL checks passed.
- `bun run test:generation`: 12 passed, one browser fixture skipped; browser mode subsequently passed all 13 database/fixture checks.
- `bun run test:lesson-exercises:postgres`: two passed, one browser fixture skipped; browser mode subsequently passed all three database/fixture checks.
- `bun run test:review:browser`: eight browser checks passed, including keyboard/touch, activation settings, commitment/reveal/rating, stop/reload/resume, unchanged study state for browsing, dictionary fallback and grammar comparisons.
- `bun run test:assessment:browser`: one synthetic timed-assessment browser check passed; the separate active-library availability test was skipped by its existing opt-in gate.
- `bun run test:generation:browser`: three browser checks passed, including reader popup/furigana/mobile behavior, publication safeguards and large approval requests.
- `bun run test:lesson-exercises:browser`: one browser check passed, covering answer redaction, commitment, refresh, cross-origin rejection and mobile wrapping.
- Production layout scan: 14 routes/surfaces across four widths, 56 checks; all returned 200, with no detected horizontal overflow, unlabelled inputs, undersized visible buttons, browser errors or study evidence controls. Desktop/mobile screenshots were inspected privately. This is a targeted scan, not a complete WCAG certification.
- Independent code review: no actionable UI regression; first-page catalog coverage limitation recorded above.
- Impeccable detector: no findings on the eight changed UI files.

- Final catalog/browser run: six passed, including source-page navigation/refresh, origin labels, approved kanji examples, dynamic vocabulary counts and the four-width study-route regression. A free-port wrapper invoked the existing Bun browser script with `PLAYWRIGHT_PORT` set; it remains private under `.local/`.
- `bun run lint`, `bun run typecheck` and `bun run build`: passed after the UI edits; final lint passed after the browser-test updates. `git diff --check` passed.

## Limits and handoff

Source transcription, Japanese correctness, real generated-language publication and real question approval remain human content gates. Live Gemini service behavior, remote database connectivity and backup restore were not re-exercised in this UI audit; previous recovery evidence is not replaced by these tests. Stored review checks used local synthetic databases without AI. Phase 6 remains outside this task.

An existing server on port 3000 was preserved; the final catalog checks used a free port. Concurrent unrelated development-server changes are outside this audit's staging bundle.

Graphify required: **no** — routine presentation and verification changes; no architectural boundary changed. Private screenshots/logs and pre-existing machine-local graph caches are excluded from the handoff.
