# Vocabulary 889–1000 readiness

Prepared the user-supplied corrected JSON with the separate enrichment prompt. The Downloads original is unchanged; all real content and evidence remain ignored under `private-data/imports/vocab-0889-1000-20261012/`.

`db-staging-0889-1000.json` is ready for unreviewed staging: 112 sequential entries, 102 supplied examples and 161 component boxes. Source and staging validation returned zero warnings. The sanitizer preserved every source field, and the original/private copy have identical hashes. Ten entries have no supplied example; none were invented. No PDF comparison or database load was performed.

Use only `vocab-0889-1000_enrichment_review-v2.json` as the current review packet. It contains 80 headword dictionary proposals and 116 checked whole-word component examples. Thirty-two headwords, 45 component examples and 158 component readings remain unresolved, including all 151 isolated-character readings. Eleven decorated lemma readings are separately labelled `dictionary_lemma_reading`; they do not replace the printed book readings. Dictionary evidence and proposals remain unreviewed and separate from book content. The packet is not a direct importer input.

Initial worker selections used a lexical heuristic, followed by model context review and targeted parent checks. Parent correction fixed two contextual senses, two unrelated component examples, three omitted dictionary-form bindings, and independent evidence for a compound component reading. Final independent replay checked 277 dictionary citations across 91 lookup forms, with zero mismatches. All identities/component indices/statuses were checked. The 24 focused extraction/enrichment/import tests passed. Canonical approval, learner history, cards and FSRS remain untouched.

The worker edited its initial packet/report in place before the fresh-revision rule was enforced; intermediate bytes cannot be reconstructed. The first parent audit captured in-progress output and contains both actual failures and validator mapping assumptions. Those files remain historical evidence; final v2 output, correction evidence and the passing v2 audit are separate new files. Earlier per-field lookup/repair history is unknown and must not be reset. The parent used one corrective packet revision.

`db-ready-manifest.json` identifies current deliverables. `checkpoint-final.json` binds 26 artifacts; checkpoint resumption reconciled all hashes. `final-verification.json` records final counts and limits. Next action is review of remaining uncertainties and exact canonical decisions after explicit human authorization. No next source PDF pages were established.

Continuation prompt:

> Recommended model: `gpt-6-luna`, reasoning effort `medium`, for bounded contextual vocabulary review; use `gpt-6-sol` with `medium` effort only for flagged difficult records. Resume `private-data/imports/vocab-0889-1000-20261012/checkpoint-final.json` with `rtk proxy node scripts/pdf-batch.mjs resume`. Read the relevant plan amendments, enrichment prompt, current manifest and final verification. Review only the remaining uncertainties or explicit requested staging step. Preserve originals, final v2 evidence, unknown attempt history and retry limits. Do not infer source verification, approve/promote content, or create cards. No next PDF pages are established.

Manual handoff: `rtk git add -- docs/vocabulary-889-1000-readiness-handoff.md`

Suggested commit subject: `Document vocabulary 889–1000 staging and enrichment readiness`

Graphify required: no; private content preparation and documentation only.
