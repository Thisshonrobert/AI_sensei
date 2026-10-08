# Vocabulary component aids — 7 October 2026

Authority: Master Plan §§3, 5, 16, 18–19, the 5 October dictionary-enrichment clarification, and the learner's explicit request for an independent subagent audit and WaniKani-inspired component display. This is a bounded Phase 3 study-aid follow-up. It does not complete the pending learner-paced Phase 3 gate or start assessment/generation features.

## Published result

The independent linguistic audit matched 108/108 existing whole-word readings against official EDRDG JMdict, checked contextual reconstructions, corrected 26 component readings (23 incomplete dictionary-form verb readings and three contextual sound changes), and filled all 36 absent meanings using separately attributed dictionary enrichment. Display meanings were selected against JMdict/KANJIDIC2 rather than inheriting the original glosses unchecked. 心地 in 居心地 is a lexical reading group; replacing the separate 心 and 地 display boxes produces 212 display components while preserving all 213 original boxes privately.

This establishes dictionary-supported study aids, not original PDF transcription fidelity or native-speaker certainty. Optional する/POS annotations were outside this reading audit. Original missing textbook glosses remain missing in preserved evidence. Dictionary extracts retain EDRDG/Jim Breen attribution and CC BY-SA 4.0; generated review/selection remains labelled generated rather than becoming book facts.

The learner explicitly approved the exact 108-record publication bundle in chat. Approval-set SHA-256: `4e86c2bdd7fab75701d4e6ea8877e492d2df83bbe26181cc7110e5ac167fb7bb`. Linguistic-artifact SHA-256: `c51a283d8cb00958641b7a1f5790e5abdffce9bcd9cd9d72c12c0f0cbc51f192`.

The existing importer recorded exact approvals and published 108 `Content(kind=explanation, origin=generated)` additions. PostgreSQL verification found 108 approved additions, 212 components, dictionary citations, and one vocabulary link per addition. No canonical vocabulary fields/revisions, learner introductions, card state, sessions, attempts, or review history changed; before/after fingerprints matched. No schema or dependency changes were needed.

The existing detail and browse-flashcard tiles consume only one approved, current, exact word/reading/revision match. Drafts, superseded/stale records, competing matches, invalid component readings, empty meanings, and unresolved component types are rejected. Following the learner's presentation simplification, the ivory tiles show only glyph, kana reading, and meaning: no supplementary heading, dictionary-form label, or explanatory notes. Reading types and notes remain stored in the aid payload; attribution remains in the collapsed evidence section. Recall prompts and scheduling are unchanged.

Private artifacts remain under `private-data/imports/vocabulary-components-20261007/`: `linguistically-checked-components.json`, `linguistic-verification-report.md`, `component-aids-canonical-selection.json`, `component-aids-canonical-preview.json`, `component-aids-exact-approval-set.json`, and `component-aids-publication-result.json`. Do not stage them.

## Verification actually run

- Independent audit's Node assertions: 108 identity/readings/reconstructions; 212 kana display components with dictionary-supported meanings; original boxes and suggestions preserved; no unresolved display reading/meaning fields.
- `rtk proxy bun.cmd run test`: 20 passed, 25 database checks skipped by the ordinary unit runner. Focused component tests first failed with missing behavior and then passed; rerun after final identity-validation adjustment: 2 passed.
- `rtk proxy bun.cmd run lint`, `typecheck`, and `build`: passed with their actual commands. Bun/local PostgreSQL access needed approved execution outside the sandbox.
- `rtk proxy bun.cmd run test:review:browser`: 3 isolated PostgreSQL fixture checks and 7 production Edge browser flows passed. The initial new fixture failed on immutable-link transaction requirements; the next run exposed over-restrictive validation of existing whole-word notation. Both were corrected before the passing run.
- `rtk proxy node .local/publish-vocabulary-component-aids.mjs`: exact approved promotion succeeded; unchanged canonical fields and six learner/history tables confirmed.
- `rtk proxy node .local/verify-published-component-ui.mjs`: all 108 published current aid mappings, 212 components, four real corrected detail pages, flashcard conceal/reveal, mobile wrapping, zero non-GET requests, and unchanged learner history passed. Desktop/mobile tile screenshots inspected privately.
- `rtk git diff --check`: passed. No Git mutations executed.
- Independent bounded code review: no blocking findings; reviewer independently reran the two selector tests successfully. It reviewed the recorded browser/build/database evidence without rerunning those checks.
- After the learner requested removal of tile commentary, `build`, `lint`, and `git diff --check` passed again; the isolated runner passed 3 PostgreSQL fixture checks and 7 browser flows, including explicit absence of contextual notes, dictionary-form labels, and the supplementary heading. This presentation-only edit did not write to the real database.

## Manual Git handoff

Implementation: the component selector/schema/declaration, tile and attribution renderers, ivory CSS additions, and focused unit/browser regressions. Documentation: this handoff and the superseding notice in the existing frontend follow-up.

Integration prerequisite: existing uncommitted Phase 3/frontend work supplies the catalog, flashcard pages, reference components, browser fixture runner, and database migrations. `src/components/reference.tsx`, `src/app/globals.css`, and `tests/browser/browse.spec.ts` already contain earlier changes; `src/components/vocabulary-components.tsx` was already untracked. File-level staging includes those earlier contents. Review the existing Phase 3 handoff before integrating this bundle independently.

Excluded: other pre-existing dirty implementation/docs/schema/config files, AGENTS.md, the unchanged Master Plan, graphify-out/cache and manifest, private-data, `.local/` audit/publication scripts and screenshots, credentials, generated output, and synthetic databases. These database additions are local private content; committing frontend code does not transfer them to another database.

```powershell
rtk git add -- src/lib/server/content/vocabulary-components.mjs src/lib/server/content/vocabulary-components.d.mts src/components/vocabulary-components.tsx src/components/reference.tsx src/app/globals.css tests/vocabulary-components.test.mjs tests/browser/browse.spec.ts docs/vocabulary-component-aids-handoff.md docs/phase-3-frontend-followup.md
```

Suggested commit subject: `feat: display dictionary-checked vocabulary component aids`

Graphify required: **no** for this bounded display/content follow-up. The original Phase 3 architectural milestone retains its separate integration/clean-default-branch prerequisite. No regeneration ran.
