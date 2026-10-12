# Practice reader follow-up — 9 October 2026

Authority: Master Plan §§18 and 20, the 8 October hover/continuous-passage amendments, and the learner's explicit approval in this chat for the reader design with stored definitions and external Takoboto lookup. This is a bounded Phase 5 UI follow-up, not acceptance of the whole phase or authorization for Phase 6.

## Implemented behavior

- Annotated targets receive a light-blue whole-word underline on hover, keyboard focus or active selection. Existing stored ruby appears on hover/focus in On request mode; Off still hides it. Proposed draft readings and contextual explanations remain labelled.
- Clicking a target opens one viewport-bounded definition box near its trigger on desktop. It follows scroll/resize; narrow screens use a scrollable bottom sheet. Escape/Close restore trigger focus, and outside pointer interaction dismisses the box. The existing target selector supplies another keyboard route.
- The panel displays the stored item definition separately from the revision-bound contextual explanation. Missing definitions are explicit. Unannotated words are not automatically given invented readings or definitions.
- An editable lookup starts from the vocabulary's written form, or the whole annotated span for other targets. An explicit click opens an encoded Takoboto query in the existing named desktop popup or a mobile tab. Blocked popups expose a normal new-tab link. No automatic remote fetch, iframe, scraping, API integration or voice controls were added.
- Add to studylist uses the existing approved-vocabulary sentence-context mutation. Draft passages cannot save context. Successful saves show confirmation and disable repeat saving within that reader view; the stored context survives reload and appears on the vocabulary page. This is the existing saved-context feature, not a new independent studylist or automatic card activation. Server-side ownership, exact revision, deduplication and scheduling guards are unchanged.

## Verification

The expanded browser regression first failed against the original underline colour before implementation.

- `rtk bun run test`: 63 passed, 56 database-gated tests skipped, zero failures.
- `rtk bun run typecheck`: passed.
- `rtk bun run build`: passed, including TypeScript; repeated after final CSS refinement.
- `rtk bun run lint`: passed, including the final test/spacing refinement.
- `rtk bun run test:generation:browser`: final run passed 11 isolated PostgreSQL checks and both production Edge browser tests. Tests cover hover/focus/Off, popup/mobile bounds, Escape/focus restoration, editable encoded lookup, named desktop/mobile destination selection, blocked-popup fallback, draft-save gating, successful context saving and stored-context rendering. Existing continuous-passage/publication/security checks remain intact.
- Desktop/mobile synthetic screenshots were inspected in two bounded rounds. The final popup is viewport-bounded and scrollable on mobile. Ignored screenshots: `.local/reader-popup-desktop.png`, `.local/reader-popup-mobile.png`.
- Impeccable's mechanical detector produced one rounded-border warning for the requested 3px word underline. This is a false positive on an inline word with `border-radius: 0`, not a rounded card accent. No new visual direction was introduced.
- Scoped static review found no actionable defects. No live Takoboto result content, native Japanese correctness, or real learner interaction is claimed by synthetic tests. No live AI request was made.
- `rtk git diff --check`: passed; the focused implementation/test diff check also passed after the handoff was written.

## Manual Git handoff

**Implementation:** `src/components/practice-reading.tsx`, `src/app/globals.css`, `tests/browser/generation.spec.ts`.

**Documentation:** `docs/reader-handoff.md`.

**Excluded or uncertain:** all other pre-existing dirty/untracked files, `.env*`, private data, Graphify artifacts/caches, ignored `.local/` evidence and build/test output. All three implementation/test paths already contained authorized continuous-passage edits when this task began. The scoped command below includes those existing edits in these shared files; review their complete diff before staging. No Git mutation ran, no dependency or migration was added, and JMdict integration remains separate scope.

```powershell
rtk git add -- src/components/practice-reading.tsx src/app/globals.css tests/browser/generation.spec.ts docs/reader-handoff.md
```

Suggested commit subject: `feat: add contextual reader popup and studylist actions`

Graphify required: no — bounded UI refinement with existing server mutations, no architectural milestone or integration prerequisite.

## Local JMdict reader extension — 10 October 2026

The learner explicitly authorized this follow-up on 9 October. Master Plan §20 now records the authorization without replacing other phase decisions. This remains a bounded Phase 5 study-reader extension; it is not acceptance of all Phase 5 or authorization for Phase 6.

All analyzer-segmented Japanese passage words containing kanji receive the existing underline/ruby interaction and shared desktop popup/mobile sheet, including supporting/non-target/untracked words. Whole dictionary compounds and inflected surfaces use the already approved kuromoji analyzer, exact local JMdict forms and lemma candidates. Retained revision-bound annotations take precedence; overlaps are deterministic, malformed UTF-16 spans and partial-character lexical spans do not become dictionary words. Ordinary particles cannot be absorbed into unrelated longer expressions, and continuative verb stems cannot replace their verb lemma with a noun homograph. Ambiguous alternatives, missing readings/entries, unavailable analysis and dictionary-preview limits remain explicit. Keyboard navigation has one passage tab stop plus arrow/Home/End movement, with the existing selector and focus restoration preserved.

Dictionary candidates have no automatic Item mapping or persistence. The existing approved vocabulary context-save path remains guarded. Unmatched words retain explicit Takoboto lookup/blocked-popup fallback and an explanation of the existing draft/import and human review path. No canonical, learner-familiarity, card or FSRS writes, per-hover/per-click network/AI, voice feature, dependency, application table or migration were added.

See [reader-dictionary.md](reader-dictionary.md) for official licence/attribution, bounded local-index behavior and monthly maintenance. The official English file is installed in ignored storage with 218,880 entries and source hash/version, a copied EDRDG licence and notices. The updater publishes a complete fresh immutable edition before switching the pointer, even for an unchanged download. The reader displays source/licence links and update status. Refresh at least monthly with `rtk proxy node scripts/update-reader-dictionary.mjs`; no automation was created.

### Verification evidence

- `rtk proxy bun.cmd run test`: 73 passed, 57 database-gated skips, zero failures; ten dictionary/reader unit regressions cover spelling/reading/sense restrictions, inherited POS, compounds, inflections, ambiguity, missing/supplementary entries, annotation precedence/overlap/partial spans, UTF-16 and immutable edition publication. The two correctness findings from a bounded read-only reviewer were reproduced and fixed.
- `rtk proxy bun.cmd run typecheck`, `rtk proxy bun.cmd run build`, and `rtk proxy bun.cmd run lint`: passed on the final reader version, including the partial-annotation guard and clarified provenance label.
- `rtk proxy bun.cmd run test:generation:browser`: final rebuilt version passed all 12 isolated PostgreSQL checks and all three production Edge browser checks. Database comparison verifies unchanged Item/Vocabulary/UserItem/Card/Attempt/ReviewLog/Content data on reader retrieval and rejected unmatched saving. Browser coverage includes non-target words, candidate readings/meanings/POS, inflection lemma, ambiguity, missing readings/entries, keyboard navigation, real touch context/mobile bounds, no lookup-time API request, attribution, preserved draft/revision and existing approved studylist/Takoboto regressions.
- First mobile test failure was a missing touch-enabled browser context; that test setup was fixed. Docker engine startup required the user's manual startup. Windows sandbox prevented Bun workspace access and temporary-directory rename; authorized checks ran outside that sandbox. No real library was reset.
- One batched desktop/mobile screenshot inspection completed: popup bounds, readable candidate definitions and scrollable mobile bottom sheet were inspected. Ignored evidence: `.local/reader-dictionary-desktop.png` and `.local/reader-dictionary-mobile.png`. Impeccable's only detector warning is the existing requested 3px inline underline (`border-radius: 0`), not a rounded-card accent.
- `rtk git diff --check`: passed after the final handoff edits. Structural/synthetic tests and dictionary installation do not establish complete coverage, naturalness or native contextual Japanese correctness. No live application AI call or Takoboto-result correctness was tested.

### Manual Git handoff

**Implementation:** `scripts/update-reader-dictionary.mjs`; `src/lib/server/generation/analyzer.mjs`, `dictionary.mjs`, `reader.mjs`, `reader.d.mts`, `service.mjs`, `service.d.mts`; `src/app/api/generation/route.ts`; `src/components/practice-reading.tsx`; `src/app/globals.css`; `tests/reader-dictionary.test.mjs`, `tests/generation-postgres.test.mjs`, `tests/browser/generation.spec.ts`.

**Documentation:** this handoff, `docs/reader-dictionary.md`, and only the new §20 amendment/operation paragraphs in `FINALIZED_PROJECT_PLAN.md`.

**Excluded or uncertain:** all other pre-existing dirty/untracked edits, `.env*`, private books/imports/learner data, the ignored dictionary index/editions/licence copy, `.local/`, build/test output and Graphify artifacts/caches. The reader UI/CSS/browser test and this handoff already contained authorized earlier reader changes; the listed file staging includes those existing shared-file changes. `analyzer.mjs` was already untracked and contains the prior approved kuromoji analysis implementation; its complete file is required, not just the new reading-token helper. The existing modified `package.json`, `bun.lock`, `next.config.ts` and untracked generation runner belong to prior work and remain excluded; integrate their approved kuromoji/tooling prerequisites separately if not already integrated. No Git mutation ran.

Stage the exact reader bundle after reviewing these shared files:

```powershell
rtk git add -- scripts/update-reader-dictionary.mjs src/lib/server/generation/analyzer.mjs src/lib/server/generation/dictionary.mjs src/lib/server/generation/reader.mjs src/lib/server/generation/reader.d.mts src/lib/server/generation/service.mjs src/lib/server/generation/service.d.mts src/app/api/generation/route.ts src/components/practice-reading.tsx src/app/globals.css tests/reader-dictionary.test.mjs tests/generation-postgres.test.mjs tests/browser/generation.spec.ts docs/reader-dictionary.md docs/reader-handoff.md
rtk git add -p -- FINALIZED_PROJECT_PLAN.md
```

For the interactive Master Plan command, stage only the two new §20 dictionary paragraphs; exclude the pre-existing batch/lesson clarification hunks.

Suggested commit subject: `feat: add local JMdict reference help across practice passages`

Graphify required: yes — the new server-side dictionary/reference retrieval path should enter the engineering index after integration. Wait for the learner to confirm the bundle is integrated and the default branch is clean/up to date; keep dictionary/reference data outside the graph corpus and hand off any generated paths separately.
