# Phase 3 frontend follow-up — 7 October 2026

Authority: FINALIZED_PROJECT_PLAN.md §§3, 5–7, 18–20 and A1/A2, plus the learner's explicit 7 October frontend request. This is a Phase 3 display/interaction follow-up; Phase 4 remains deferred. The request supersedes §20's intermediate Dictionary panel and editable-prefill acceptance check: selected text now opens an encoded Takoboto lookup directly on clicking Dictionary. Copied text is read only by that explicit click, with an inline fallback when permission or popup support is unavailable. The existing recall response-commitment gate and attention semantics remain intact.

## Implemented

- Vocabulary and Kanji lists link to `/vocabulary/flashcards` and `/kanji/flashcards`. Clicking the card flips it; native chevron buttons sit to its left/right. A visually hidden native flip control supports keyboard and screen readers while the Japanese content remains in a separate accessible region. Enter/Space, visible card focus, reduced motion, selection without flipping, position and entry-detail links are preserved. Navigation survives refresh through its URL, resets the face, preserves keyboard focus and respects deck boundaries.
- Vocabulary backs show reading, selected meaning, at most one supplied example and component meanings when available, without source disclosures or the missing-canonical message. Kanji backs show glyph/meaning, a selected source word's whole reading, on/kun readings and at most two source words. Full notes, mnemonics and evidence remain on the main detail page. Never derive per-character readings by splitting a compound. Queries remain bounded (50 catalog entries, one selected detail, existing content/citation limits, at most 24 kanji matches). No new dependencies, schema, scheduler or review mutations were added.
- Approved dictionary supplements are matched to source examples by exact word and nonempty whole reading. Exactly one approved match is required; drafts, wrong readings, missing readings and competing senses cannot fill a gap. The meaning stays separate from immutable book content with its own dictionary evidence. All 140 current source example words have an exact approved match in the real database. No new translations were necessary.
- Vocabulary extraction now requests source `kanji_components` boxes and their individual glosses, including compounds/kana units and repeated boxes. The old template omitted these fields; existing raw vocabulary and usage records contain no component breakdown. The separate repair prompt supplies an identity-safe review format for existing PDF batches. Staging preserves additive fields, but a later human-approved canonical revision must explicitly map them to `Vocabulary.usageJson.kanji_components`; no automatic repair/publication occurs. Existing canonical links remain a fallback. Incidental kanji do not become core curriculum members or scheduled cards.
- Vocabulary component displays now use centered glyph/reading/meaning tiles with the app's ivory palette, informed by the supplied WaniKani screenshot. Explicit source readings appear when present; missing readings are not invented. The repair document includes a shorter continuation prompt for the original extraction chat, preserving its existing JSON and asking for original attachments again if they are no longer readable.
- Vocabulary, Kanji and Grammar detail pages have previous/next chevrons beside the entry title. Two bounded adjacent-record SQL queries follow catalog order (`createdAt`, then ID), remain within the same approved kind and disable unavailable directions. Native links support keyboard activation and URL refresh; this does not introduce items or mutate learning/scheduling state. Navigation is across the full kind catalog, rather than an inferred search subset.
- Detail facts omit internal sense identity and empty/placeholder vocabulary part of speech. Repeated approved/reference labels and field-level citations are removed from normal study views. Native collapsed source/evidence disclosures preserve acceptance, attribution, source-page navigation and meaningful draft/content gaps. Clicking a source disclosure shows only its linked stored item/content inline, clearly labelled as a linked entry/current reference when historical; it does not claim to reconstruct the original PDF or expose a book/batch payload.
- Dictionary uses selection first, including pointer selection capture. Clipboard access occurs only on an enabled button click; a temporary user-opened window preserves activation across the permission prompt. Empty/denied clipboard access closes that window and offers a small inline input. A blocked popup offers an encoded link, receives focus, and closes with Escape. Existing study position and recall answer safeguards remain. Explicit attention flags still use the existing review route and do not schedule cards.
- Warm ivory surfaces, dark Japanese typography and restrained borders replace the previous tone. Radical glyph/name tiles have plus signs and matching mnemonic highlights; the canonical target meaning uses a distinct highlight. Full text is shown from a dedicated approved local full-mnemonic field. Excerpts are not completed, embellished or labelled complete. Attribution stays collapsed; learning mnemonics remain distinct from historical etymology.

## Verification actually run

Commands use RTK, Bun scripts and Node runtime/database execution. Bun and Docker access required approved execution outside the filesystem sandbox. The user's existing server on port 3000 was left running; isolated browser checks used 3100 and read-only reference checks used 3101. Detailed logs/screenshots stay in ignored `.local/`.

For the continuation-prompt/tile/detail-arrow change, `build`, `lint`, `typecheck`, `rtk git diff --check` and the four read-only reference-browser flows were rerun successfully. The reference flow now covers first-boundary disabling, keyboard next, refresh, previous returning to the same item and 375px wrapping for all three kinds. The vocabulary mobile screenshot was inspected. Unit/scheduling checks below are the preceding flashcard verification, not a new run for this display-only continuation. No new content approval/publication or Git mutation occurred.

| Command/check | Inspected result |
|---|---|
| `rtk proxy bun.cmd run test` | 18 passed, 25 database cases intentionally skipped |
| `rtk proxy bun.cmd run lint` | Passed |
| `rtk proxy bun.cmd run typecheck` | Passed, including actual Next route generation |
| `rtk proxy bun.cmd run build` | Passed; Node renders the new flashcard route |
| `rtk proxy bun.cmd run test:review:browser` | 3 synthetic PostgreSQL fixture checks and 6 production Edge flows passed |
| `rtk proxy node .local/run-reference-ui-check.mjs` | Wrapper ran Bun `test:browser tests/browser/catalog.spec.ts` on port 3101; 4 read-only production reference flows passed |
| `rtk proxy node .local/verify-current-example-meanings.mjs` | 140 current source words; 140 unique exact approved meanings; zero ambiguous/missing matches |
| Mnemonic promotion preview | 38 existing kanji reused; 38 original generated additions validated; human approval pending |
| Desktop/mobile screenshots | Inspected at 1280 px / 375 px, including side chevrons, compact backs and full detail-page mnemonic text |
| `rtk git diff --check` | Passed |

Browser coverage includes hidden fronts, flip by Space/Enter/card click, side-chevron geometry, previous/next and boundary focus, URL refresh, two-word limit, absent card evidence disclosures, accessible answer headings, mobile wrapping, reduced motion, full detail-page mnemonic/excerpt display, radical/meaning highlighting, draft exclusion, exact/ambiguous dictionary supplement selection, selected/copied/denied-clipboard/blocked-popup lookup, Escape/focus return, exact source-record navigation, and unchanged scheduled commit/reveal/rate/stop/resume. External Dictionary destinations were fulfilled with synthetic browser responses: actual Takoboto internet availability and every browser's clipboard policy are not established by these checks.

Read-only browsing issued zero non-GET requests. Before/after SHA-256 fingerprints matched for all synthetic Card, UserItem, StudySession, SessionItem, Attempt and ReviewLog rows. The test therefore covers activation/familiarity as well as FSRS state/history. No real learner review or new source approval was performed.

The new browsing regression first failed at the missing entry point. Review caught lost navigation focus and unfocused popup fallback; explicit assertions reproduced both failures, and passed after the fixes. Targeted review confirmed both resolved. One mechanical design-detector warning about an existing thick draft border was corrected; the detector was run once, with screenshot verification after the change.

## Remaining gaps

### Vocabulary completion review — 7 October

**Superseded by the later corrected-input audit and approved publication:** all 108 identities now match; the independent official-dictionary audit corrected 26 readings, filled 36 dictionary meanings, and grouped 心地 correctly. The learner approved the exact bundle and 108 supplementary generated-origin aids (212 display components) were published without changing textbook fields or learner history. See [vocabulary component handoff](vocabulary-component-aids-handoff.md) for exact hashes, evidence, limitations, and scoped integration commands. The historical unmatched-input findings below apply to the earlier completion only.

The supplied completion parses as 17 records with 20 components, but none of its word locators matches the original 17 missing identities (or any of the original 108 vocabulary words). Combining it with the recovered 91 therefore does not complete the batch. Private side-by-side review and aggregate validation remain under ignored `private-data/imports/vocabulary-components-20261007/`. No canonical revision or content publication occurred. A corrected identity-preserving completion is required before an exact approval preview; source correctness still requires human review.

All 20 completion `reading` fields are null. The additional `japanese_word` values are externally generated suggestions declared by the learner, not source readings; 18 contain kanji. No linguistic/dictionary correctness was established for these unmatched records. The main prompt/template now distinguish source component boxes from separate unreviewed `component_aids` containing suggested kana readings, Japanese example words and full example readings with actual origin/evidence. Staging does not automatically publish these aids. The existing tile renderer uses approved stored component readings; no unmatched suggestion was inserted into it.

For this input-review/prompt update, only the private validation scripts and three extraction documents changed. JSON parsing of the public template and `rtk git diff --check` passed. Application build/browser checks were not rerun for this documentation-only update; prior UI evidence above remains unchanged.

Scoped documentation handoff for this update (includes earlier edits in these shared files):

```powershell
rtk git add -- docs/extraction-templates/extraction-prompt.md docs/extraction-templates/vocabulary.template.json docs/extraction-templates/vocabulary-components-repair-prompt.md docs/phase-3-frontend-followup.md
```

Suggested subject: `docs: separate vocabulary component extraction and generated study aids`. Exclude all input/recovered files, private review reports, `.local/` scripts and other dirty implementation/docs. Graphify required: **no**. The original Phase 3 integration and learner-paced acceptance gates remain pending.

All 38 approved dictionary mnemonic references contain excerpts. Complete original AI-generated memory aids have been prepared in ignored `private-data/imports/ui-enrichment-20261007/`, with readable review, source/origin information, canonical selection and exact approval hashes. Only a draft mirror batch was created; none of these new aids has been approved or published. Publication requires the learner's exact approval under the Master Plan, then the existing importer; generated aids must retain generated origin and component attribution. This does not certify book transcription or copy full WaniKani prose. The detail renderer supports approved `generatedKanjiMnemonic` content. Vocabulary boxes still require the original PDF repair extraction and human decisions. Original PDF comparison, deferred grammar question decisions and learner-paced Phase 3 acceptance remain pending as recorded in [Phase 3 handoff](phase-3-handoff.md). No Phase 4 work or scheduled-review redesign occurred.

UI/UX Pro and Taste were unavailable; frontend-design/Impeccable guidance was used. No tool or dependency installation was required.

## Manual Git handoff

Implementation: the exact frontend, bounded catalog query, browser/config and fixture-runner paths in the first staging command below. Documentation: the four paths in the second command.

**Integration prerequisite:** the repository already had uncommitted Phase 3 implementation. This follow-up depends on its dashboard/study/review modules and personal-release migration. Shared pages/styles, Dictionary/study components, browser tests, fixture runner, app/component READMEs and the Phase 3 handoff already held earlier changes. File-level staging below includes those earlier edits in shared files; it cannot isolate only this chat's hunks. Review/integrate the existing Phase 3 bundle using its separate handoff before treating this as a standalone follow-up commit. No later-phase preparation is included.

Excluded or uncertain: other pre-existing dirty Phase 3 backend/schema/recovery/docs files, AGENTS.md, root README, graphify-out/cache and manifest, all `.local/`, private-data, credentials, private screenshots, synthetic databases, build/test output and generated next-env.d.ts. The Master Plan and dependency versions/lockfile were not changed. Next type generation/build regenerated next-env.d.ts; it is not part of this handoff. No Git mutation ran.

Execute manually after reviewing the prerequisite and shared-file scope:

```powershell
rtk git add -- 'src/app/[kind]/page.tsx' 'src/app/[kind]/[id]/page.tsx' 'src/app/[kind]/flashcards/page.tsx' src/app/page.tsx src/app/layout.tsx src/app/globals.css src/components/reference.tsx src/components/item-facts.tsx src/components/browse-flashcard.tsx src/components/flashcard-facts.tsx src/components/vocabulary-components.tsx src/components/entry-navigation.tsx src/components/example-meaning.ts src/components/kanji-mnemonic.tsx src/components/dictionary.tsx src/components/study-content.tsx src/lib/server/content/catalog.ts playwright.config.ts scripts/test-review-postgres.mjs tests/browser/browse.spec.ts tests/browser/catalog.spec.ts tests/browser/review.spec.ts
rtk git add -- docs/phase-3-frontend-followup.md docs/phase-3-handoff.md docs/extraction-templates/extraction-prompt.md docs/extraction-templates/vocabulary.template.json docs/extraction-templates/vocabulary-components-repair-prompt.md src/app/README.md src/components/README.md
```

Suggested commit subject: `feat: simplify flashcard interaction and show approved word meanings`

Graphify required: **no** for this display follow-up. The earlier Phase 3 architectural milestone still has its own pending refresh, after integration and confirmation that the default branch is clean/up to date. No graph was regenerated against this dirty tree.
