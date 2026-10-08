# Local development and Neon content

Authority: user clarification on 8 October 2026; Phase 3 follow-up only. Local Docker is the development/study connection (`DATABASE_URL` and `LOCAL_DATABASE_URL`). `POSTGRES_DATABASE_URL` selects the persistent Neon content database. Hosting uses that Neon URL as its `DATABASE_URL` environment setting. Existing prepared batches were already transferred to Neon.

Prepare each private JSON batch once. Run the existing staging, inventory, exact selection approval and promotion steps against Neon explicitly; do not re-extract or ask AI to regenerate the same content. Existing approval rules still apply to textbook facts; the separately approved fictional mnemonic waiver remains scoped to those stories.

```powershell
rtk bun run db:target neon load --files private-data/imports/YOUR_BATCH.json
rtk bun run db:target neon canonical inventory --batch YOUR_BATCH_ID --output private-data/imports/YOUR_INVENTORY.json
```

For subsequent `preview`, `approve`, `edition` and `promote` commands, use `rtk bun run db:target neon canonical` followed by the same explicit options documented in [database-import.md](database-import.md). The target is inherited by the existing Node importer using the direct Neon maintenance connection; it does not change the local app connection. `local` is available for intentionally local importer checks. No credential is passed in a command argument.

After publishing a batch, refresh the local development snapshot with:

```powershell
rtk bun run db:refresh-local
```

This backs up Neon, restores all tables into a **new** Docker database, verifies every table fingerprint, then updates the private local connection settings. Restart Next.js afterwards. It preserves the previous local database and the private backup. It never overwrites Neon or an existing local database, and performs no AI calls. Reuse the same local snapshot until new content needs to be fetched; no automatic per-launch network transfer runs.

Study history belongs to the database used while studying. A refreshed snapshot contains Neon's history; reviews made only in a previous local database remain there and are not merged into Neon. Continue using the local database for development; when hosting starts, use the hosted database for continuing progress. This explicit snapshot workflow avoids a synchronization system. Keep old local databases until their history is no longer needed.

Verification and manual handoff are recorded in [phase-3-content-neon-followup.md](phase-3-content-neon-followup.md). No schema, dependency, hosting deployment or scheduler behavior changes are included.
