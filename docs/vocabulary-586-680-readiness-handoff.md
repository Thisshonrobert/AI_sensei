# Vocabulary 586–680 database readiness

Prepared the supplied corrected vocabulary batch for unreviewed database staging using the separate enrichment prompt. The original is preserved byte-for-byte. The sanitized payload preserves all source fields, identities and issues. No database load or canonical approval was performed.

Ignored `private-data/imports/vocab-0586-0680-20261012/` contains `db-ready-source.json`, `db-ready-manifest.json`, final `enrichment-v3.json`, `review-report-v3.json`, independent `parent-evidence-audit-v3.json`, `final-value-validation-v2.json`, and `checkpoint-final-v2.json`. Earlier outputs remain evidence; v3 supersedes duplicate component aids in v2.

Source validation passed with no structural warnings: 95 entries, 95 examples, 169 component boxes, and exact sequential keys 586–680. Fifteen source-reported scan-layout ambiguities remain. No PDF comparison was performed, so automated readiness does not certify transcription or page completeness.

Local JMdict provides unreviewed meaning proposals for 93 headwords and 146 whole-word component examples. Two patterned headwords and 23 optional component-example slots remain unresolved. Exactly one aid is retained per source component index; all 169 isolated component readings remain null. Six decorated adjective forms use separately labelled dictionary lemmas without replacing source readings.

Independent checks reproduced all 392 dictionary references across 116 forms, including the targeted lemma evidence hashes, with zero mismatches. Field and example values match their cited evidence. All 24 focused PDF/enrichment/import tests passed. These checks establish mechanical provenance, not human contextual or source approval. The report retains recorded attempt limits and unknown earlier history.

To stage the preserved input when requested:

```powershell
rtk bun run import:load --files private-data/imports/vocab-0586-0680-20261012/source-working.json
```

The separate enrichment review packet is not a direct importer input. Canonical promotion requires explicit human decisions and exact approvals. No cards, familiarity, publication or FSRS changes were made.

Continuation: resume the checkpoint and review only the relevant uncertainties and final enrichment. Recommended model: `gpt-6-sol`, reasoning effort `medium`, for bounded provenance and review preparation. Do not retry exhausted fields or infer missing book facts.

Graphify required: no; private batch preparation and a sanitized documentation handoff.

Manual documentation staging:

```powershell
rtk git add -- docs/vocabulary-586-680-readiness-handoff.md
```

Suggested commit subject: `docs: record vocabulary 586–680 database readiness`
