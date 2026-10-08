# Phase 5 handoff — 8 October 2026

Phase 5 implementation and automated acceptance checks are complete. The learner confirmed the API-key project's Free Tier in AI Studio on 8 October 2026; the bounded live Gemini sentence smoke test passed. Authority: Master Plan §§2, 4, 12–15, 18–20 and its authorization amendment. Phase 6 is unauthorized. No real generated Japanese or question answers were human-approved during implementation or live verification.

## Implemented behavior

/practice selects up to eight approved studied or enabled baseline targets using bounded SQL queries. Manual prompt export/structured import work without AI access or baseline rows. GenerationRun retains owner, prompt/input snapshot, model, reports and immutable draft/accepted revisions. Validation checks target use/omission, choices, evidence and half-open UTF-16 boundaries. Failed generation leaves review available. Generated output cannot overwrite source facts or change scheduling.

Approved kuromoji 0.1.2 analyzes registered phrases/variants before lemmas, candidate contextual readings, ambiguity, unresolved constructions, configured elementary particles, untracked support and kanji context. Model assertions do not establish language correctness. Production dictionary loading uses the installed package directory, server externalization and file tracing; the browser check exposed and verified the bundler-path fix. No custom Japanese parser was introduced.

The five reader aids are stored word/grammar help with formation references, individual sentence translation, three furigana modes, editable external dictionary lookup and saved vocabulary contexts. Proposed readings/explanations remain labelled. Verified ruby and context saves require human approval. Context saves enforce ownership, exact content/item revisions and sentence linkage, deduplicate and create no cards or FSRS events. Saved contexts appear on references and study backs.

Reusable publication requires exact draft/scope hash, current target/support revisions, human language confirmation and explicit dispositions for every flagged problem. Questions additionally need answer/distractor/evidence review. Approved generated questions reuse the assessment bank with ownership guards. Drafts and AI-only review are ineligible. Retirement appends revisions, excludes future selection and treats affected historical/current-session results as ungraded without erasing attempts.

Optional Gemini uses the configured gemini-3.1-flash-lite, server-only key header, structured JSON, bounded output and 25-second timeout. Five generations per rolling day; at most three generation calls (two corrections) plus one optional AI review per generation. Quota/network failures stop without paid fallback. Review failure retains a valid unverified draft. Same-model review only recommends ungraded practice. No background/per-tap calls or provider SDK dependency.

## Actual verification

- rtk proxy bun.cmd run test: 45 passed, 49 integration/recovery fixtures skipped, zero failures. Affected database fixtures run separately below.
- rtk proxy bun.cmd run test:generation: 6 passed, browser fixture skipped. Real isolated PostgreSQL plus local HTTP provider checks cover corrections, quota stop, zero baseline, ownership, canonical/FSRS preservation, malformed output, exact repeat-safe approval, saved contexts and scored eligibility/retirement.
- rtk proxy bun.cmd run test:generation:browser: 7 PostgreSQL fixtures and 1 Edge test passed. Export/import/reload, production analyzer, synthetic human publication, sentence help, focus/Escape, verified ruby, context saving, retirement, same-origin rejection, mobile wrapping and keyboard hiding.
- rtk proxy bun.cmd run test:assessment: 10 passed. rtk proxy bun.cmd run test:review: 22 passed, including 135-item flexible study.
- rtk proxy bun.cmd run lint, typecheck and build: exit 0. Build includes /practice and /api/generation.
- rtk proxy node .local/migrate-phase5.mjs: exit 0. Backup restored separately and all existing table fingerprints unchanged, including GenerationRun for the second additive migration. Temporary ignored long-form Compose ports bypassed an installed parser failure; tracked compose.yaml was preserved.
- rtk proxy node .local/phase5-pilot.mjs: ten bounded approved vocabulary forms; ten ready analyses, ten registered matches, zero review flags. Aggregate output only; no Japanese correctness certification.
- rtk git diff --check: exit 0.

Requested Luna 6.1 was unavailable. The disclosed closest available model, GPT-6 Luna at medium effort, reviewed read-only. Scope-policy/support-revision and optional-review/call-budget findings were fixed. Its final focused review found no concrete blockers. Implementation review does not replace Japanese/answer approval.

### Live activation evidence — 8 October 2026

- `rtk proxy node .local/phase5-gemini-smoke.mjs`: exit 0 with access outside the restricted sandbox. Private `.env` configuration was checked without printing its contents: key present, exact model `gemini-3.1-flash-lite`, Free Tier confirmation true, provider enabled. Billing-tier evidence is the learner's AI Studio confirmation, not an API billing query.
- One existing approved, explicitly studied vocabulary target was selected by bounded SQL. One sentence-generation request and one optional same-model language-review request returned HTTP 200; no corrections or additional live runs were needed. Structured schema, half-open UTF-16 spans and target scope passed. Kuromoji was ready: 16 tokens, one registered target match, zero language problems and ten untracked supporting tokens. AI review returned `acceptable_for_ungraded_practice` with zero findings; this does not certify Japanese correctness.
- Run `585c8d90-e269-41eb-8572-9f8cc60b739c` retains one generated sentence at draft revision 1, with no questions. Reload through `generationView` was identical. Language status remains `unverified`, human approval false and scored eligibility false. All existing non-content/non-run table fingerprints and all pre-existing content records were unchanged, covering canonical/source facts, learner records, cards, attempts and review logs. No publication, context-save approval, scored question or FSRS mutation occurred.
- `rtk proxy bun.cmd exec "node --test tests/gemini-provider.test.mjs tests/generation-analyzer.test.mjs tests/generation-contract.test.mjs"`: 10 passed, zero failures/skips, executed outside the restricted sandbox. `rtk git diff --check`: exit 0. The earlier full application/database/browser checks above were not repeated; no implementation change required them. No additional review agent was used.
- Initial sandbox attempts failed before any API request: Prisma database access and the Node executable through Bun were restricted. Running the same checks with authorized external access resolved both; no application defect was found or code fix needed. Sanitized aggregate evidence and the smoke script remain ignored under `.local/` (`phase5-gemini-smoke-evidence.json` and `phase5-gemini-smoke.mjs`).

## Reported failure follow-up — 8 October 2026

The learner reported two failed sentence runs and requested default use of completed study material. Bounded, sanitized inspection found one run with two structured/UTF-16 failures followed by a network timeout, and one eight-target run with repeated kanji contextual-word violations. The analyzer incorrectly rejected valid single-kanji dictionary words such as 僕. Its regression failed before the fix and passed afterward: exact dictionary-word token boundaries now permit that case while a character-only span inside 健康 remains invalid. The prompt emphasizes compound-word spans, target IDs and exact offsets; correction feedback now identifies failing target/spans or structural fields. Timeout, call and quota limits remain unchanged.

The UI no longer requires target checkboxes. All approved studied or enabled baseline items not excluded from testing form the pool, counted and sampled in SQL without the previous 100-row display limit. Each sentence uses one target and a reading up to eight, with up to forty supporting records. Completed material is available over successive runs rather than forced into one output. Explicit target IDs remain supported for existing API/manual workflows. Failed runs show readable network/quota/provider/validation explanations and remain retained. Human publication, question approval and FSRS guards remain intact. No dependency or migration was added.

Fresh checks: `rtk proxy bun.cmd exec "node --test tests/generation-analyzer.test.mjs tests/gemini-provider.test.mjs tests/generation-contract.test.mjs"` passed 11 unit tests. `rtk proxy bun.cmd run test:generation` passed 7 checks plus one skipped browser fixture. The final `rtk proxy bun.cmd run test:generation:browser` passed 8 PostgreSQL checks and one Edge browser test, covering automatic export/import/reload, pool bounds, excluded items, zero baseline, canonical/FSRS preservation, human approval and readable failed-run state with no approval control. `rtk proxy bun.cmd run lint`, `rtk proxy bun.cmd run typecheck` and the final `rtk proxy bun.cmd run build` exited 0. Final focused browser-file lint and `rtk git diff --check` also exited 0. Initial browser retries exposed test-only keyboard readiness, missing-history-fixture and ambiguous-alert-selector issues; the test now waits for an enabled control, creates its own next history entry and scopes the alert to the practice region.

Automatic approval review initially rejected the additional real Gemini kanji retest as beyond the earlier single-test authorization. The learner then explicitly authorized it. `rtk proxy node .local/phase5-kanji-smoke.mjs` exited 0 on 8 October 2026: one generation call and one optional AI language-review call returned HTTP 200, with no corrections. The existing explicitly studied kanji 僕 was used; structured output, UTF-16 spans, target scope and local registered-kanji recognition passed. Kuromoji was ready with 11 tokens, zero language problems and six untracked supporting tokens. AI review returned `acceptable_for_ungraded_practice` with zero findings, which does not certify correctness.

Run `60962ff1-9a39-4d43-8a65-ea3143ebb4cc` retains exactly one generated sentence at draft revision 1 with no questions. Reload was identical; language status remains `unverified`, human approval false and scored eligibility false. Existing canonical/learner table fingerprints and pre-existing content were unchanged, including FSRS, attempts and review logs. No publication or scheduling mutation occurred. Aggregate evidence is ignored at `.local/phase5-kanji-smoke-evidence.json`; no secrets, source text or learner history were printed. This verifies the corrected live kanji sentence path; live passage generation was not exercised. The earlier successful sentence is preserved.

**Follow-up implementation:** the exact paths below cover UI/API, selection, analysis and regressions. **Documentation:** Master Plan automatic-pool clarification and this handoff. Shared paths retain existing Phase 5 edits; staging this follow-up alone does not include every dependency in the original full Phase 5 bundle below.

```powershell
rtk git add -- src/components/practice.tsx src/app/practice/page.tsx src/app/api/generation/route.ts src/lib/server/generation/service.mjs src/lib/server/generation/service.d.mts src/lib/server/generation/analyzer.mjs tests/generation-analyzer.test.mjs tests/generation-postgres.test.mjs tests/browser/generation.spec.ts FINALIZED_PROJECT_PLAN.md docs/phase-5-handoff.md
```

Follow-up subject: `fix: automate practice targets and correct kanji word validation`. Exclude `.env`, `.local/`, private data and preserved Graphify sidecars. Graphify awaits integration and confirmation of a clean/up-to-date default branch. Phase 6 remains unauthorized.

## Activation and limitations

### Passage-only practice and UI refinement — 8 October 2026

The learner requested a passage-only generation flow, greater cumulative coverage, quieter failure handling and clearer rounded UI. The new Master Plan amendment supersedes the eight-target passage sample. SQL takes up to 100 eligible introduced targets from the latest study week's seven-day window plus up to 20 random older/eligible baseline targets; up to 40 additional records are supporting context. All selected targets are requested naturally, with explicit omissions shown under Study coverage. This includes an 85-item recent study week, but does not promise natural inclusion of every item in fifteen lines. New provider generation is passage-only. Historical sentence drafts and manual API transport remain compatible; export/download/import and dictionary/selected-text controls are removed from the practice UI.

Sanitized inspection of the real failures found repeated wrong vocabulary/whole-word kanji spans and earlier UTF-16 failures, not a missing key. The provider now quotes exact text and identifies repeated occurrences; server code resolves positions before strict validation and independent analysis. Missing quotes and surrogate-splitting annotations still fail. Generation is bounded at 16,000 output tokens, 60 seconds per generation call and two correction retries; optional review keeps its existing bounds. Five run requests per rolling day still include failed requests, so hiding failures does not bypass quota. Only usable draft/approved/retired runs appear in saved practice; failed runs remain internal diagnostics and errors appear as dismissible alerts. Larger approved passages retain all target/exposure links through the assessment schema's 120-ID bound.

UI changes preserve the paper/forest palette, add consistent 14px study surfaces and clearer form borders, enlarge and center vocabulary/kanji headings, remove the dictionary badge, and arrange publication review as a checklist with explicit issue resolutions. Stored help, sentence translation, furigana and human publication/question gates remain. A whitespace-only boundary adjustment lets quoted sentence translations align with newline-separated text without accepting different sentence content.

The focused review identified prompt-size and approval-capacity gaps. Both were reproduced before fixes. Optional prompt meanings/formations/variants are now explicitly budgeted excerpts while target identity forms and the complete immutable scope remain intact. The 85-item regression includes long source explanations and preserves every selected target under 40,000 prompt characters. Approval capacity is derived from the allowed text/use/issue/model-finding bounds (6,560 findings), and the approval-only HTTP body bound accounts for maximum-length dispositions; other requests retain the 64,000-character limit. Every actual finding still requires its own disposition. Tests exercise all 480 findings from a 240-use grammar draft and a real approval request beyond 64,000 characters; an incomplete disposition list still fails.

Fresh evidence:

- `rtk proxy bun.cmd run test`: 51 passed, 52 database/recovery fixtures skipped, zero failures. The affected isolated suites ran separately below.
- Final `rtk proxy bun.cmd run test:generation`: 9 passed, browser fixture skipped. Subsequent final `rtk proxy bun.cmd run test:generation:browser`: all 10 PostgreSQL fixtures and 2 production Edge browser tests passed. Coverage includes 85 recent plus five old items with long reference explanations, full 240-use/480-finding approval, large HTTP approval bodies, eligible/excluded selection, failure filtering, corrections/quota stops, immutable canonical/learner state, reload, approval/retirement, help, ruby, context save, same-origin rejection, mobile fit and alert dismissal.
- `rtk proxy bun.cmd run test:assessment`: 10 passed after increasing bounded target/exposure capacity. `rtk proxy bun.cmd run lint`, `rtk proxy bun.cmd run typecheck` and the final `rtk proxy bun.cmd run build`: exit 0. `rtk git diff --check`: exit 0. Impeccable's mechanical detector returned no findings. Desktop/mobile practice screenshots were inspected and remain ignored in `.local/`.
- `rtk proxy node .local/live-passage-check.mjs`: one live generation call and one optional AI review, both successful, using three synthetic targets (two kanji and one vocabulary) in an isolated local test database. All three targets covered; zero omissions/corrections; two sentence units and two questions; analyzer ready; identical persisted reload; zero approved content or cards. No real learner data was sent. This verifies the quote-based provider path, not Japanese correctness or live 85-target coverage. Two prior fixture setup attempts failed before any API calls on canonical-identity/immutable-revision constraints; the corrected fixture satisfies both.
- `rtk proxy powershell -NoProfile -File .local/restart-practice-server.ps1` restarted only the validated project server on localhost:3001. `rtk proxy node .local/verify-ui-refinement.mjs` verified the running practice controls and both real word screens read-only: centered 102px desktop titles, 14px radii and no horizontal overflow at 390px. Output was aggregate only, with no book text or learner history.
- Initial sandbox checks could not access Bun's working directory/database. Required checks ran with approved external access. Browser test updates were needed for the new collapsed summaries and to exclude Next.js's route-announcer alert from dismissal assertions; the final test passed.

**Implementation:** `src/components/practice.tsx`, `src/components/practice-reading.tsx`, `src/components/reference.tsx`, `src/app/practice/page.tsx`, `src/app/globals.css`, `src/app/api/generation/route.ts`, `src/lib/server/generation/contract.mjs`, `src/lib/server/generation/service.mjs`, `src/lib/server/generation/service.d.mts`, `src/lib/server/generation/gemini.mjs`, `src/lib/server/generation/reading.mjs`, `src/lib/server/assessment/bank.mjs`, `tests/generation-anchors.test.mjs`, `tests/generation-postgres.test.mjs`, `tests/reading-context.test.mjs`, `tests/assessment-bank.test.mjs`, `tests/browser/generation.spec.ts`.

**Documentation:** this handoff, the Master Plan amendment and `docs/tooling_Verification.md`.

**Excluded or uncertain:** `.env`, `.local/` scripts/evidence/screenshots, private data, existing graph sidecars, build/test artifacts and other prior dirty files. No new dependency, migration or Git mutation. Several scoped files already contain the uncommitted Phase 5 implementation; the command below stages their complete current contents, not just this follow-up. Integrate/stage the existing Phase 5 bundle from the full handoff as a prerequisite; this command alone is not a standalone implementation of Phase 5.

```powershell
rtk git add -- src/components/practice.tsx src/components/practice-reading.tsx src/components/reference.tsx src/app/practice/page.tsx src/app/globals.css src/app/api/generation/route.ts src/lib/server/generation/contract.mjs src/lib/server/generation/service.mjs src/lib/server/generation/service.d.mts src/lib/server/generation/gemini.mjs src/lib/server/generation/reading.mjs src/lib/server/assessment/bank.mjs tests/generation-anchors.test.mjs tests/generation-postgres.test.mjs tests/reading-context.test.mjs tests/assessment-bank.test.mjs tests/browser/generation.spec.ts FINALIZED_PROJECT_PLAN.md docs/phase-5-handoff.md docs/tooling_Verification.md
```

Suggested subject: `fix: generate cumulative passages and polish study UI`.

**Graphify required: yes for the pending Phase 5 milestone; no additional refresh for this UI refinement.** Wait for integration and learner confirmation of a clean/up-to-date default branch. Phase 6 remains unauthorized.

The API key is configured privately; no key was printed or committed. `GEMINI_MODEL=gemini-3.1-flash-lite` and `GEMINI_FREE_TIER_CONFIRMED=true` are configured. Live response compatibility is verified for the one bounded sentence run above, including optional AI language review and persisted draft reload. Student Gemini benefits alone do not establish API billing tier. Restart the app normally to load the private environment changes; the smoke test loaded `.env` independently and did not restart or terminate a user server. Passage generation and real human publication/scored-question approval were not exercised by this live test.

Manual intake and saved study remain available without AI. Real reusable/scored content needs its own human decisions. Internet deployment requires the existing one-user authentication/authorization gate; no deployment occurred. Phase 6 was not started.

## Manual Git handoff

**Implementation:** exact bundle below includes generation/analyzer/provider/reader, additive migrations, shared item/study/assessment integration, UI/configuration and tests. Shared edits belong to Phase 5; no later-phase preparation.

**Documentation:** Master Plan decision amendment, this handoff, Phase 5 plan, repository structure and tooling guidance.

**Excluded:** existing untracked graphify-out/cache/ and graphify-out/manifest.json; .env; all .local/, private data/backups, node_modules and build/test outputs. No Git mutation executed. Existing graph query launcher failed with uv trampoline failed to canonicalize script path; source inspection was used and graph preserved.

```powershell
rtk git add -- .env.example package.json bun.lock next.config.ts prisma/schema.prisma prisma/migrations/20261008020000_generated_practice/migration.sql prisma/migrations/20261008030000_gemini_drafts/migration.sql src/lib/server/generation src/lib/server/assessment/service.mjs src/lib/server/content/study.mjs src/lib/server/content/study.d.mts src/app/api/generation/route.ts src/app/practice/page.tsx "src/app/[kind]/[id]/page.tsx" src/components/practice.tsx src/components/practice-reading.tsx src/components/study-content.tsx src/app/layout.tsx src/app/globals.css scripts/test-generation-postgres.mjs tests/generation-contract.test.mjs tests/generation-analyzer.test.mjs tests/gemini-provider.test.mjs tests/reading-context.test.mjs tests/generation-postgres.test.mjs tests/browser/generation.spec.ts FINALIZED_PROJECT_PLAN.md docs/plans/2026-10-08-phase-5.md docs/phase-5-handoff.md docs/repository-structure.md docs/tooling_Verification.md
```

Suggested subject: feat: add contextual practice with local analysis and Gemini drafts

**Graphify required: yes.** Refresh only after integration and learner confirmation of a clean/up-to-date default branch. Generated paths are a separate later bundle; exclude current untracked sidecars.

### Example word card visibility correction

The learner's screenshot identified the example word cards, rather than only the detail heading. Compact word examples now center the Japanese word, reading and meaning, use larger semibold Japanese text, and have clearer 2px borders with 18px corners. Sentence paragraphs and evidence retain their existing presentation. This is presentation only; no source records or scheduling changed.

Verification: `rtk proxy bun.cmd run lint`, `rtk proxy bun.cmd run typecheck`, and `rtk proxy bun.cmd run build` passed. The running screenshot page was checked in Edge at 1280px and 390px: centered word/readings, 2px border, 18px corners, Japanese text above 40px, and no horizontal overflow. The production app on port 3001 was reloaded. The ignored browser check and screenshot in `.local/` are excluded.

Scoped follow-up staging (the shared files also contain the earlier uncommitted Phase 5 UI changes):

```powershell
rtk git add -- src/components/reference.tsx src/app/globals.css docs/phase-5-handoff.md
```

Suggested subject: `fix: center and enlarge example word cards`

Graphify required: no for this display correction; the Phase 5 integration prerequisite above remains pending.

### Generation allowance increase

The learner increased the allowance to ten requests per rolling 24 hours, superseding the five-request allowance described earlier. Server enforcement and the practice status/error text use the new allowance. Failed requests continue to count. No migration or dependency changes.

Verification: `rtk proxy bun.cmd run test:generation` passed 10 isolated PostgreSQL tests (one browser fixture skipped), including acceptance of ten requests, rejection of the eleventh, and allowance after the rolling window expires. Lint and production build passed. The reloaded app on port 3001 shows the updated allowance. No real API generation was needed.

Implementation: generation service, practice component, and the quota integration test. Documentation: Master Plan clarification and this handoff. Excluded: all `.local/` verification outputs and unrelated edits. These shared files contain earlier uncommitted Phase 5 changes.

```powershell
rtk git add -- src/lib/server/generation/service.mjs src/components/practice.tsx tests/generation-postgres.test.mjs FINALIZED_PROJECT_PLAN.md docs/phase-5-handoff.md
```

Suggested subject: `fix: increase generation allowance to ten`

Graphify required: no for this allowance adjustment; the Phase 5 integration prerequisite remains pending.

### Reader underline and hover readings

The learner requests the supplied Satori Reader interaction as a reference: hovering a word underlines it without coloring its background and reveals the stored whole-word kanji reading above it. On request also reveals ruby on keyboard focus; Off removes ruby and approved All keeps it visible. Draft hover readings are explicitly labelled proposed. Clicking retains the existing meaning panel below. Hidden request ruby reserves space to avoid moving text when hovered. No AI calls, source writes or scheduling changes.

Implementation: `src/components/practice-reading.tsx`, `src/app/globals.css`, and reader regression checks in `tests/browser/generation.spec.ts`. Documentation: Master Plan clarification and this handoff. Exclude `.local/`, test outputs and unrelated edits; shared files include earlier Phase 5 work.

```powershell
rtk git add -- src/components/practice-reading.tsx src/app/globals.css tests/browser/generation.spec.ts FINALIZED_PROJECT_PLAN.md docs/phase-5-handoff.md
```

Suggested subject: `fix: reveal reading above underlined reader words`

Verification: lint and production build passed. `rtk proxy bun.cmd run test:generation:browser` passed all 11 isolated PostgreSQL checks and both Edge browser tests, including hidden/unhidden hover ruby, transparent hover background, keyboard Tab focus, Off mode, and unchanged click meaning/help behavior. The production app was reloaded on port 3001. The first browser attempt started before the build was ready; after correcting test focus to use actual keyboard navigation, the final run passed.

Graphify required: no for this reader refinement; the Phase 5 integration prerequisite remains pending.
