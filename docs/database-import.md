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

No human page-by-page comparison with the original PDFs was performed by this task. Loaded records remain unreviewed staging material. Publication into Item/typed tables/Content/SourceEntry, scored question eligibility and new-pool card creation belong to the verified import workflow after source checking and the corresponding schema exist. Staging creates no UserItem familiarity, active cards or scheduler events.

See [extraction saving/importing instructions](extraction-templates/extraction-prompt.md) and the Master Plan §16 for source approval requirements. The importer command and actual verification evidence are recorded in [tooling & verification](tooling_Verification.md) after execution.
