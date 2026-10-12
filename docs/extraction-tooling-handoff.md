# Extraction tooling improvement handoff — 10 October 2026

Scope: the user's extraction-efficiency observations, applied to the private draft workflow under Master Plan §16, §18 PDF intake, §19 provenance and the 5/9 October enrichment amendments. This is not Phase 6 application growth or an application phase completion. The Master Plan, schema, dependencies and UI were not changed by this task.

## Implemented

- `scripts/pdf-batch.mjs`: shared importer-backed validation, exact-identity/page checks, source-preserving assembly, exclusive outputs, hash-bound checkpoints and compact resume/continuation output. CLI paths must be ignored under private-data and have no symlink/junction ancestors. Explicit retry maps reject malformed/exhausted counters; historical unknown counts remain unknown.
- `scripts/enrich-study-batch.mjs`: explicit single/multi-batch plans, existing local JMdict reuse, edition/form retrieval cache, reading/sense/context decisions, useful separate unreviewed proposals and per-batch unresolved queues. Existing nonempty/reviewed fields, component corrections and mnemonics remain intact. No model or network lookup runs in this command.
- Shorter AGENTS extraction guardrails; detailed commands, compact worker input, local-dictionary-first enrichment, 36-entry measured vocabulary pilot, adaptive kanji/lesson boundaries, selective model routing and completion metrics live in the three extraction documents. Future checkpoints emit continuation prompts directly without `/status`.

## Actual backlog evidence

The real command processed **20 existing batches**, using latest explicit revisions for two source batches and retaining originals. It covered 248 source entries, 417 nested examples and 519 printed component occurrences. The 586 distinct dictionary forms reproduced the earlier 533-match audit. Of 774 word occurrences, 312 resolved conservatively and yielded 624 useful unreviewed reading/meaning fields; 462 remain in contextual review queues. Queues contain 257 sense/context mismatches, 54 ambiguous readings, 91 ambiguous senses, 59 missing matches and one supplied-reading mismatch. Distinct form counts and source occurrence counts are different measurements.

The new packets retain 22 previously complete mnemonics; **no new mnemonics were generated**. Ambiguous case selection, missing component references/aids, missing requested mnemonics and human dictionary/content approval remain pending. The dictionary pass does not certify source transcription or establish missing textbook wording/answers. The enrichment loop took 1,008 ms excluding plan preflight/input loading; this is not a full extraction pilot/time/usage measurement. No new PDF extraction or source comparison was performed, and the larger pilot remains unrun.

Private outputs are in `private-data/pdf-drafts-20261009/tooling-20261010/`: `enrichment-plan.json`, 20 new `.enrichment.json` packets, 20 `.cases.json` queues, `dictionary-cache.json`, `summary.json`, `checkpoint-spec.json` and `checkpoint.json`. The new checkpoint/resume verified **130 artifact hashes**, including originals, prior drafts/packets, new outputs and saved reference evidence. Prior manifest/checkpoints are unchanged; the new checkpoint supersedes their obsolete continuation guidance. Historical per-case targeted retry counts are explicitly unestablished and must be reconciled before further targeted lookups, not reset to zero.

## Verification

- `rtk proxy node --test tests/pdf-batch.test.mjs tests/enrich-study-batch.test.mjs`: **16 passed, 0 failed**. Includes source/correction preservation, duplicates, assembly, coverage/null components, dictionary restrictions/ambiguity/missing matches, cache edition/context/truncation, fresh-output preflight, retry map shape/limits, changed-file resume rejection and Windows mixed-case path termination.
- `rtk bun run test`: **89 passed, 57 skipped, 0 failed** (146 total). The Windows sandbox prevented Bun reading cwd; this same authorized command succeeded outside that sandbox. Skipped database integration checks did not run.
- `rtk proxy node scripts/enrich-study-batch.mjs run private-data/pdf-drafts-20261009/tooling-20261010/enrichment-plan.json`: passed against installed local JMdict; source/prior-packet hashes unchanged.
- `rtk proxy node scripts/pdf-batch.mjs checkpoint private-data/pdf-drafts-20261009/tooling-20261010/checkpoint-spec.json private-data/pdf-drafts-20261009/tooling-20261010/checkpoint.json`: passed; 130 artifacts.
- `rtk proxy node scripts/pdf-batch.mjs resume private-data/pdf-drafts-20261009/tooling-20261010/checkpoint.json`: passed; hashes/validations rechecked and compact continuation returned.
- Read-only reviewer identified two issues (Windows path casing termination and malformed retry maps); both fixed, regression-tested and confirmed in follow-up review. No remaining actionable review issue reported in that scope.
- `rtk git diff --check`: passed. Build/lint/typecheck/browser/live database checks were not run for this local-script/documentation scope; no application-release claim is made.

## Manual integration

**Implementation:** `scripts/pdf-batch.mjs`, `scripts/enrich-study-batch.mjs`, `tests/pdf-batch.test.mjs`, `tests/enrich-study-batch.test.mjs`.

**Documentation:** `AGENTS.md`, `docs/extraction-templates/batch-workflow.md`, `docs/extraction-templates/enrichment-prompt.md`, `docs/extraction-templates/extraction-prompt.md`, this handoff.

**Excluded or uncertain:** all private outputs; all unrelated existing application/schema/package/plan/reader/exercise/Graphify edits. AGENTS and the extraction prompt already had edits, and the workflow/enrichment prompt already existed as untracked work before this task: staging their whole files includes that earlier content. Review the shared-file diff before using this command; use scoped interactive staging if you want only this task's hunks.

**Integration prerequisite:** the reused `src/lib/server/generation/dictionary.mjs` currently exists as an unrelated untracked reader file, and `scripts/import-batches.mjs` has earlier changes. Integrate the necessary existing reader/import work separately; the command below deliberately does not silently absorb those files. No dependencies were introduced by these helpers.

```powershell
rtk git add -- scripts/pdf-batch.mjs scripts/enrich-study-batch.mjs tests/pdf-batch.test.mjs tests/enrich-study-batch.test.mjs AGENTS.md docs/extraction-templates/batch-workflow.md docs/extraction-templates/enrichment-prompt.md docs/extraction-templates/extraction-prompt.md docs/extraction-tooling-handoff.md
```

Suggested commit subject: `Add reusable PDF batch and dictionary enrichment tools`.

**Graphify required: no.** This is a bounded local-tooling improvement, not a major application architecture milestone. No Git mutations or graph refresh were executed.

## Copy-ready continuation

```text
Resume extraction preparation in C:\Users\thiss\Documents\ChatGPT\AI_sensei from private-data/pdf-drafts-20261009/tooling-20261010/checkpoint.json. Read AGENTS.md and docs/extraction-templates/batch-workflow.md; run the reusable resume command to verify saved hashes. Load only the compact checkpoint and one selected batch's .cases.json plus its relevant source context and checked component references. Finish bounded sense/reading review and missing requested component aids/original mnemonics in new separate revisions; reconcile unknown historical lookup/repair counts before targeted retries. Preserve original source files, reviewed corrections, independent provenance and human approval gates. Do not re-extract completed PDFs or create per-batch helpers. After the enrichment backlog is resolved, measure one 36-entry vocabulary pilot beginning at excerpt-local page 41 of 109-337vocab.pdf (candidate pages 41–48; inspect actual boundaries/continuations before assigning counts or keys). Use one bounded worker without history fork or nested delegation, selective supported model routing and at most two targeted attempts per field/chunk across resumes. Process at most three NEW production batches per chat and provide a direct continuation prompt on stopping. No publication, database/learner/FSRS changes or Git mutations.
```
