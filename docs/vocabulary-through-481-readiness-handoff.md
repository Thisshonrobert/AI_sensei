# Vocabulary through 481 — staging preparation

Prepared on 11 October 2026 under the Master Plan's extraction, provenance and separate approval rules. No new extraction or application changes were made.

The preserved inputs contain 481 vocabulary records: 108 in the historically approved initial batch, 180 across ten existing batches for 109–288, and 193 across three corrected batches for 289–481. The initial batch and corrected 338–377 batch retain excerpt-local keys; their printed numbering was not independently verified. Other ranges have exact source-number coverage. Do not merge repeated words or source identities by spelling.

Ignored `private-data/imports/vocab-through-0481-readiness-20261011/` contains the database-ready manifest, source and dictionary audits, staging evidence and checkpoint. The manifest names exact paths/hashes and a scoped Node staging command for the 373 later source records. It excludes the initial 108 records from re-import and keeps enrichment packets separate from importer inputs. Current revisions are selected from the prior rev51 manifest and the corrected-batch bounded-review checkpoint, including enrichment v7 for 378–481.

All source drafts pass structural validation. Three missing source readings remain null with warnings. Prepared staging payloads equal the selected source payloads; original files, prior revisions and retry histories are preserved. Dictionary reference checks distinguish reproducible evidence from unverified proposals; historical unresolved notes and current queues remain separate. Staging readiness does not establish dictionary sense accuracy, PDF fidelity or human approval.

The 24 focused PDF/enrichment/import tests passed. The initial batch's 108 historical approval receipts match its saved selection hash. A live inventory attempt could not reach the configured local PostgreSQL server, so current database contents are unverified. No database load, canonical approval/promotion, card creation, scheduler change or Git mutation occurred. New batches remain unreviewed. Load only into the explicitly chosen database; canonical promotion still needs the existing exact human review/approval workflow in [database-import.md](database-import.md).

Graphify required: no; this is content preparation and a sanitized documentation handoff.

Manual staging for this documentation only:

```powershell
rtk git add -- docs/vocabulary-through-481-readiness-handoff.md
```

Suggested commit subject: `docs: record vocabulary through 481 staging readiness`
