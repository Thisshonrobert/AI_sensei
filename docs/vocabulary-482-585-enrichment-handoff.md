# Vocabulary 482–585 enrichment

Prepared a separate unreviewed enrichment packet for all 104 supplied vocabulary records under the Master Plan's extraction/provenance amendments. The original JSON is preserved byte-for-byte; a separate working copy changes only review labels to the staging schema's `unreviewed` value. No database load or canonical promotion was performed.

Ignored `private-data/imports/vocab-0482-0585-20261011/` holds the preserved source, working copy, final `enrichment-v9.json`, `cases-v9.json`, `review-report-v9.json`, independent `parent-audit-v2.json`, and hash-bound `checkpoint-final.json`. Intermediate revisions remain available. Earlier aggregate lookup counters cannot establish per-field retry history; the final report records that limitation and the evidence-hash repair separately.

The final packet contains 208 reading/meaning proposals and all 196 source component aids. Each aid supplies a locally checked whole-word example; 131 use explicitly labelled parent-word examples. Isolated kanji pronunciations are not inferred from compounds. Seven adjectival surface forms retain their supplied identity/reading and use separately labelled dictionary lemmas. Two entries retain multiple source-supported senses; contextual narrowing remains unresolved because examples are absent.

Structural source validation passed with no warnings and exact 482–585 identity coverage. Independent verification reproduced all 408 dictionary evidence objects across 145 forms, including selected readings/senses and full-candidate evidence hashes. All 16 focused PDF/enrichment tests passed. Visual comparison covered 24 headwords and 48 component boxes on local PDF pages 1, 13 and 25; it does not certify the whole source. The supplied source filename differs from the larger local PDF inspected. The supplied JSON has no examples for the last eight records; no missing textbook content was generated.

Enrichment preparation is complete with the stated uncertainties. Dictionary sense selection remains an unreviewed proposal; human approval and publication remain separate.

Graphify required: no; this is private content enrichment and a sanitized documentation handoff.

Manual staging for this documentation only:

```powershell
rtk git add -- docs/vocabulary-482-585-enrichment-handoff.md
```

Suggested commit subject: `docs: record vocabulary 482–585 enrichment`
