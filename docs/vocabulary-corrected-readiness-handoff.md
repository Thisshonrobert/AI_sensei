# Corrected vocabulary preparation — 11 October 2026

Scope: three user-supplied corrected vocabulary files covering ranges 289–337, 338–377, and 378–481. Earlier ranges were not checked in this task.

Private artifacts live in ignored `private-data/imports/vocab-corrected-0289-0481/`. The latest `db-ready-manifest-v3.json` identifies hash-preserved originals, sanitized inputs, validation reports, the explicit staging command, and enrichment revisions v2/v2/v5. Separate enrichment review packets retain dictionary provenance and unreviewed status; they are not direct importer inputs. Resume from `checkpoint-final-v2.json`; earlier revisions and checkpoints remain evidence.

Source schema checks passed for 193 entries, 191 examples, and 363 component occurrences with no structural warnings. Explicit source-number keys cover 289–337 and 378–481 without gaps. The middle batch retains excerpt-local identities; printed numbering was not independently established. Entries reference odd excerpt pages, and two entries have no examples. No PDF comparison was performed, so page completeness and transcription accuracy remain unverified.

Enrichment contains dictionary proposals for 190 of 193 headwords and 58 complete component-word aids. Three headwords and six multi-character component cases remain unresolved, alongside 299 isolated component readings. Existing source glosses are retained. All additions remain unreviewed; useful dictionary proposals do not certify book wording or resolve individual-character pronunciations. Local JMdict was used; no Takoboto/web lookups were performed.

Verification: `rtk proxy node --test tests/pdf-batch.test.mjs tests/enrich-study-batch.test.mjs tests/import-batches.test.mjs` passed all 24 tests. The final independent audit reproduced 756 dictionary field/aid references with zero mismatches. Checkpoint resumption reconciled all 26 artifact hashes. Private `final-verification-v3.json` and per-batch reports contain the evidence. No database writes, canonical approval, card creation, scheduler changes, or Git mutations were performed.

Keep original book evidence separate from dictionary fields. Dictionary lemma readings must not replace readings of decorated printed forms. Isolated component readings remain unresolved when whole-word evidence cannot establish them. Human review and exact approval remain separate from staging readiness.

Graphify required: no; this is private content preparation with a sanitized documentation handoff.
