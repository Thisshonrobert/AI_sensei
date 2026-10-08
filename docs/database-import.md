# Local PostgreSQL and extracted batch staging

This setup implements the user's Docker Compose choice for local PostgreSQL. It keeps the Master Plan §§4, 16 source-verification boundary: sanitized extraction is staging data, not approved canonical learning content.

## Database lifecycle

`compose.yaml` starts PostgreSQL 17 with a health check, a named persistent volume, and a host port bound to `127.0.0.1:5433` by default. The ignored `.env` holds a generated local password and matching `DATABASE_URL`. `.env.example` is a sanitized template only. Do not print resolved Compose configuration or connection URLs containing credentials.

```powershell
rtk proxy docker compose config --quiet
rtk proxy docker compose up -d --wait postgres
rtk proxy docker compose ps
rtk proxy docker compose stop postgres
```

Stopping preserves data. Do not use `down -v` or remove the named volume when preserving imported records. Initial image download requires internet; the running local database does not need a cloud account. Docker is selected by the user for this task, not a general Master Plan prerequisite.

The image/volume/environment conventions follow the [official PostgreSQL image documentation](https://github.com/docker-library/docs/blob/master/postgres/content.md). PostgreSQL 17 uses `/var/lib/postgresql/data` here; do not change the major image version as an automatic data migration.

## Input and quality boundary

Inputs provided for this task:

- `grammer_batch1.json`: schema version 2; 10 grammar points, 15 lesson questions, no exercise passages.
- `KANJI_batch_001.json`: schema version 1; 38 kanji entries.
- `vocab_batch1.json`: schema version 1; 108 vocabulary entries.

The original files remain in the user's Downloads directory. Private copies, sanitized JSON and reports stay under ignored `private-data/imports/`. Never commit real textbook batches or upload them to a model service as part of sanitation.

Sanitization checks JSON structure/types, source metadata/page references, duplicate locators, question links, missing fields and statuses. Preserve Japanese spellings, readings, senses, formations, source wording and unresolved issues. Do not guess missing readings, answers, page mappings or grammar targets. Do not deduplicate records just because words/kanji repeat: source-specific evidence matters.

The database stores source metadata in `Source` and the full sanitized payload/validation issues in `ImportBatch` JSONB. The batch retains all entries and grammar questions/passages. Stable source identity and file hash prevent an unchanged batch from being loaded twice. Source corrections are separate draft batches, not silent replacement of existing evidence.

No human page-by-page source comparison was performed. On 5 October 2026 the user explicitly accepted the existing three extraction batches without PDF comparison and instructed exact approval/promotion using the dictionary/generated additions. That exception is recorded privately and in each selected record's `reviewBasis`; it does not assert transcription verification. The approved selections have now been promoted. Future batches require their own decisions. Card creation is deferred to §18 phase 2 despite §16's eventual import/card step. Staging and canonical import create no learner familiarity, cards or scheduler events.

### Future-batch enrichment and review policy

For each future vocabulary, kanji, and grammar batch, preserve the book payload and source evidence, then record added meanings/details with field-level provenance. Consult Takoboto, JLPT Sensei, and Bunpro where relevant and available. For kanji, capture a clearly labelled learner mnemonic and WaniKani-informed radical/component breakdown when available; do not present mnemonic decomposition as historical etymology. Grammar connections/comparisons are deferred. The user manually verifies grammar question answers before approval. Any needed meaning or explanation unavailable in those references may be proposed by AI only as explicitly labelled generated content and remains unapproved until human review. This policy does not retroactively certify the existing three batches or their additions.

See [extraction saving/importing instructions](extraction-templates/extraction-prompt.md) and the Master Plan §16 for source approval requirements. The importer command and actual verification evidence are recorded in [tooling & verification](tooling_Verification.md) after execution.

## Bounded canonical import

Phase 3 adds `20261006010000_personal_release`: two session timing fields and deferred integrity checks for approved grammar comparisons. A comparison needs two distinct approved grammar Items linked through ContentItem, a nonempty distinction, and one approved linked sentence per pattern. Existing questions are not approved by this migration. A real database backup was restored into a separate target both before and after the migration; see [recovery](backup-recovery.md).

Curated comparisons use the existing record/hash approval workflow: add an explanation supplement with `explanationType: "grammar_comparison"`, two `grammarItemIds`, a checked `difference`, and two `{ grammarItemId, contentId }` examples referencing already approved linked sentences. The reviewed target must be one of those grammar IDs. An accepted addition links both patterns; generated/user origin and source evidence remain separate. `unresolved: true` keeps incomplete comparisons draft and omitted from study. No real comparison or deferred question was approved during Phase 3 engineering verification.

Phase 2 adds the separate, additive `20261006000000_daily_recall` migration, applied locally on 6 October 2026. Import still creates no learner familiarity or review events. Explicit recall-pool preparation creates dormant cards from approved records; literal approved context words may add reference-only Vocabulary rows and copied SourceEntry evidence, without vocabulary activation. Existing canonical/source evidence is preserved. The 15 intentionally deferred grammar questions remain unscheduled. See [Phase 2 handoff](phase-2-handoff.md).

`20261005000000_canonical_import` adds only phase-1 content/provenance structures. `ItemRevision` retains immutable typed snapshots; `PromotionApproval` records explicit local human confirmation. These implement the plan's revision/approval guarantees without adding a learning service. Exactly one matching typed row is enforced at transaction commit. Field origins resolve to verified SourceEntry evidence for that same item. Content/source evidence and approvals are append-only; corrections use a new draft batch and superseding revisions. The original raw/sanitized files and existing batches remain unchanged.

`20261005010000_content_link_guard` also freezes ContentItem membership after the content's creation transaction. Create content and all target/support/mention links atomically; changed targets require a new revision. The later phase-3 restore workflow must restore content and links together in one transaction (or use a separately verified trigger-aware restore); no backup restoration has been tested here. The guard uses PostgreSQL's documented [transaction IDs](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-PG-SNAPSHOT) and [row system columns](https://www.postgresql.org/docs/17/ddl-system-columns.html).

Vocabulary uses an explicitly reviewed canonical key and lexeme/reading/POS/target-sense fields, never spelling/gloss deduplication. Grammar uses an explicitly reviewed construction identity; pattern text is not unique. Kanji uses one retained glyph identity: NFC for ordinary glyphs, preserving compatibility code points and variation selectors because NFC itself would collapse some compatibility characters. No NFKC, traditional-form or visual-lookalike folding occurs. Exact approved kanji/typed matches resolve to reuse automatically and that resolved ID/revision is included in the approval hash. Conflicting canonical fields require an explicit correction decision.

Supplied `source_pdf_pages` are one-based extraction locators whose PDF/excerpt frame must be confirmed by the reviewer. `SourceEntry.pdfPageIndex` is zero-based within the confirmed source file. Printed pages remain separate strings. All supplied arrays and nested pages stay in originalPayloadJson; do not assume a constant offset. Nested examples/source words inherit a primary parent locator only when their supplied PDF page arrays match exactly; otherwise primary fields remain null and their own source arrays are preserved, pending precise mapping. Freeze existing provisional keys and map reviewed/reordered drafts back to them. Source keys are not canonical learning identities.

The local command has five modes:

```powershell
# Read-only: saves raw payloads/candidates/issues privately; makes no approval.
rtk bun run import:canonical inventory --batch '<batch-uuid>' --output 'private-data/imports/review/inventory.json'
# Confirm edition once, after checking physical edition/file identity.
rtk bun run import:canonical edition --source '<source-uuid>' --edition '<edition-identity>' --confirm 'edition:<source-uuid>:<editionConfirmationHash>:<edition-identity>' --reviewer '<your-name>'
# Review exact selected records and canonical decisions; output must be a NEW private file.
rtk bun run import:canonical preview --selection 'private-data/imports/review/selection.json' --output 'private-data/imports/review/preview.json'
# Run only after explicit human approval of this exact record/hash and decisions.
rtk bun run import:canonical approve --selection 'private-data/imports/review/selection.json' --record '<source-record-key>' --confirm '<confirmationToken-from-preview>' --reviewer '<your-name>'
rtk bun run import:canonical promote --selection 'private-data/imports/review/selection.json'
```

Replace placeholders and create the private directory first. Output files use exclusive creation, so old previews/evidence cannot be overwritten. Inventory is allowed while edition/source review is pending; promotion preview and approval require a confirmed edition and reviewed selection. Edition confirmation only fills an unset edition on an unpromoted source; a different edition requires a distinct Source identity, not reassignment of prior citations.

Selection shape: `{ batchId, records: [...] }`. Each record names `recordKey`, `family` (`entry/question/passage`), confirmed primary `printedPage`/`pdfPageIndex` (nullable), and explicitly reviewed `identityVerified`/`sourceVerified` decisions. Entry records include `match` (`create` with `canonicalKey`, or `reuse/correct` with `itemId` and `expectedRevision`), complete matching `typed` fields from the Prisma schema, `fieldPresence`, `fieldOrigins`, optional dictionary `citations`, and optional `kanjiLinks`. `fieldPresence` distinguishes `supplied/not_supplied/unknown`. Field origins use `book`, `citation:<zero-based-index>`, or a verified same-item SourceEntry UUID. Missing book facts cannot be filled under book provenance; independent enrichment requires its own citation. Dictionary citations include source ID, stable dictionary record key, original dictionary evidence/URL/hash in `originalPayloadJson`, field presence and pages. A new dictionary Source also supplies `sourceTitle`/`sourceUrl`; it is created only within approved promotion, separately from the book.

Question records include `targets` (`itemId` or selected `recordKey`), `answerVerified`, and `targetsVerified`. Target dependencies must be approved grammar or selected reviewed grammar records. Parent passages must already exist or precede questions in the selection. Examples/source words are preserved as source-backed Content and immutable raw payloads, even when optional readings/meanings are missing. Non-book origin is rejected by this importer; AI explanations/links stay separate draft assistance. Question answer/option validity is checked, but local checks cannot establish answer correctness.

Approval hashes bind exact source payload, reviewed decisions, source/edition/lesson context, citations and canonical dependency revisions. A status flag in JSON does not create an approval; the explicit per-record token command does. Changed drafts/decisions invalidate approval. After a record has been persisted, changes require a new draft JSON/batch (retain original evidence; additional review metadata may distinguish a new batch), not editing its receipt. Unchanged repeat promotion, including corrections, is a no-op. One database transaction writes the selected records, citations/content and batch progress. Unapproved/unresolved records stay staged; an explicitly source-reviewed question can additionally be retained as a canonical draft. Any draft question keeps the batch partial and cannot be selected by a future scored bank. `promoted` batch status means all top-level records are approved, not that cards exist or phase 1 is complete.

The ignored manual packet preserves 171 source records, 24 confirmed kanji-gloss omissions, 14 nonempty kanji-gloss origin checks, 140 example-word dictionary checks and 15 AI grammar-link proposals. The user's accepted selections add 24 separately cited kanji meanings and 131 exact dictionary word-meaning references; one normalized word match and eight composed phrase meanings remain draft. The 14 unestablished individual-gloss origins stay out of canonical meanings, with original values retained in immutable source evidence. All 15 question answers/targets remain unapproved. No original PDFs were opened, uploaded or re-extracted.

### Explicit acceptance and supplementary publication

Final Phase 1 dispositions on 5 October 2026: the user's two corrected answer texts were promoted in immutable question revisions. Optional `questionReview` records a human source-answer-text check separately from structured answer/rubric verification, plus `grammarConnections: intentionally_deferred` and `usage: reference_only`. Deferral cannot contain verified targets or target links; it never grants scored/scheduled eligibility. The 11 separately accepted assistance fields carry `addedBy: AI`, an explicit human acceptance disposition and original `acceptedLimitations`; they retain dictionary/generated provenance and never replace book wording. Current drafts are the 15 reference-only questions and 75 dependent aids; there are no other supplemental drafts. The user's acceptance is a publication decision, not independent source-language verification.

`reviewBasis` may be `source_compared` or `user_accepted_without_pdf_comparison`. The latter is only usable with separate explicit human authorization; a JSON flag is insufficient. The existing `verificationStatus=verified` marks completion of the authorized import gate, while `SourceEntry.fieldPresenceJson.reviewBasis` and the immutable approval decision distinguish acceptance from PDF comparison. A bibliographic edition may remain unknown for explicit acceptance; the current Sources retain only user-reported Japanese edition descriptions and state that year/ISBN and physical verification are unknown.

Each optional `additions` decision contains `key`, `origin` (`generated` or `user`), `payload`, `unresolved` and independent dictionary `citations`. It is included in the exact record hash. Dictionary-derived supplementary Content uses schema origin `user` plus dictionary Source evidence and a visible dictionary label; it never becomes `book`. Supplementary Content is an `explanation` linked to its item or question parent. Source book payloads and answer specifications remain unchanged. Nonempty uncertainty blocks approved publication. Corrected additions append Content revisions; dictionary snapshots belong to individual Content revisions, so omitted/restored citations cannot corrupt superseding chains. No GenerationRun/provider or automatic generation is introduced.

Private `promotion-20261005/` contains immutable v2 selections/previews, per-record exact approval receipts, promotion results, preservation proof and real repeat-metadata proof. Vocabulary and kanji batches are promoted; grammar stays partial because its 15 questions are drafts. Real repeat staging creates no batches; real repeat canonical promotion creates no records and preserves commit timestamps. See [Phase 1 handoff](phase-1-handoff.md) for evidence and the remaining PDF gates.
### Phase 3 comparison dependencies

Approved comparison additions capture both approved grammar revisions/typed records and both current approved linked sentence snapshots in the existing approval hash. Correcting either pattern before promotion invalidates approval; a subsequent correction hides the published comparison until a new comparison revision is reviewed. Promote pattern corrections separately before reviewing a comparison; correction-plus-comparison selections are explicitly rejected. Draft additions remain unverified. No real comparison was approved during implementation.
