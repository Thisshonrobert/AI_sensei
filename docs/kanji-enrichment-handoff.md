# Corrected kanji enrichment handoff — 11 October 2026

All 16 supplied corrected JSON files (245 entries) have preserved originals, validated staging copies, sanitizer reports and a private readiness index. This is preparation for unreviewed staging; no database writes, canonical approvals, cards or learner-state changes occurred.

Two supplied files used `reviewed`, which the staging schema does not accept. Their new staging copies use `unreviewed` and retain the supplied label in `supplied_extraction_review_status`. Original files and source facts remain unchanged. These labels do not constitute canonical approval.

Twelve batches now have separate review packets covering 163 kanji: 163 original generated mnemonics and 126 records with checked component proposals. Four batches (82 entries) remain pending. The latest three batches cover 146–153, 156–157 and 160–170: 51 records, 86 dictionary meaning proposals, 29 generated kanji-meaning proposals and 51 mnemonics. They retain 54 unresolved dictionary occurrences and 18 records with unresolved component/reference evidence. Checked component proposals do not imply fully resolved breakdowns. All proposals remain unreviewed. Supplied mnemonic/component prose has uncertain field provenance and requires review before attribution to the textbook.

## Evidence and limits

- `private-data/kanji-corrected-enrichment-20261011/db-readiness-bundle-r4.json` indexes sanitized inputs and separate enrichment packets. A review packet is not a direct `import:load` input.
- `checkpoint-final-r4.json` in the same directory binds 269 artifacts; its fresh resume/hash check passed. Prior checkpoint artifacts and source files remain unchanged.
- `final-verification-r4.json` and batch-local parent reports record source preservation, schema/page/identity checks, mnemonic coverage and full unresolved-candidate/source-occurrence bindings. Source validation reported 29 warnings across the latest three batches. The 146–153 parent report r4 supersedes its r3 report's combined reading/meaning count; 25 dictionary meaning proposals were prepared.
- Existing tool tests passed: `rtk proxy node --test tests/pdf-batch.test.mjs tests/enrich-study-batch.test.mjs` (16 passed, zero failed).
- No PDF comparison or independent edition/page-offset confirmation was performed. Sanitization does not establish transcription accuracy or approval. Missing values in source evidence remain unchanged.
- Historical dictionary/reference attempts remain unknown and were not reset. The latest three batches made 132 new mechanical local JMdict form retrievals and 51 WaniKani page reads, one per new reference field. Cache comparisons confirmed prior retrieval evidence was preserved. New local counters are bound to first source occurrences in `local-attempt-delta-r4.json`; cached/repeated forms do not add another retrieval. No external dictionary retries occurred.
- An earlier worker made 54 WaniKani page reads for 19 records while correcting returned-output display, exceeding the two-read limit for 13 fields. Exact raw counts remain in hash-bound attempt evidence and checkpoint `attempt_limit_excess`; they are not capped, zero or retryable. The current workers opened each new page once. The 146–153 response truncated 17 reference records, which remain unresolved without rereads. One new provenance repair bound checked component labels to actually consulted URLs; earlier revisions and repair counters remain preserved.

## Continue

Run `rtk proxy node scripts/pdf-batch.mjs resume private-data/kanji-corrected-enrichment-20261011/checkpoint-final-r4.json`. Read `db-readiness-bundle-r4.json` and the checkpoint's excess-counter evidence, then only the next three batches: 172–193 (excerpt-local pages 1–22; 50 records, split internally), 196–198 (1–3), and 200–202 (1–3). Use the latest cache at `kanji-160-170/dictionary-cache-output-r1.json`; preserve batch identities. Keep page frames separate; do not infer original-PDF or printed-page offsets.

Recommended model: **gpt-6-luna, Medium** for bounded contextual sense alignment and original mnemonics, following the batch workflow's routing. Preserve originals, corrections, unresolved evidence, separate provenance, retry counters and unknown history. Do not retry exhausted reference fields or infer allowance from unknown historical counts. Process at most three new production batches per chat; no canonical promotion.

Graphify required: **no** — private content preparation and documentation do not change an architectural boundary.

Scoped staging: `rtk git add -- docs/kanji-enrichment-handoff.md`

Suggested commit subject: `docs: record corrected kanji enrichment checkpoint`
