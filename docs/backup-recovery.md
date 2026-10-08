# PostgreSQL backup and recovery

Authority: Master Plan §§2, 18–19 and the approved 8 October 2026 follow-up. Supports localhost PostgreSQL and the user-selected Neon host with TLS. The existing PostgreSQL 17 Docker Compose service supplies the client tools and independent local restore targets. This is database recovery, not device synchronization.

Use the running `postgres` service and the private `.env` configuration. `DATABASE_URL` is the active study database. The later user clarification keeps local development on Docker; `LOCAL_DATABASE_URL` selects that local connection, and `POSTGRES_DATABASE_URL` selects Neon for explicit imports and backups. See [local-neon-workflow.md](local-neon-workflow.md) for the snapshot refresh and hosting environment setup. Node reads these settings without printing credentials. Remote backup uses a direct Neon connection with TLS, rather than the pooled application endpoint. No dependency installation or Git action is needed. The Bun wrapper on this host requires `bun.cmd`; the following convention was exercised outside the execution sandbox.

## Create and verify a backup

```powershell
rtk proxy bun.cmd run backup verify
```

This creates a fresh ignored `private-data/backups/check-<uuid>/` directory, then restores into a newly created `ai_sensei_restore_<uuid>` database. It does not replace the study database. The command prints only private output location and safe verification metadata.

Each artifact directory contains:

- `database.dump`: complete custom-format PostgreSQL database archive, including schema, migrations, canonical/source records and learner history.
- `history.jsonl`: private, versioned export of User, UserItem, Card, StudySession, SessionItem, Attempt and ReviewLog rows. It is readable export, not a standalone recovery format.
- `manifest.json`: dump/export SHA-256 hashes plus each public table's row count and fingerprint.
- `restore-<target>.json`: created only after a successful restore and exact all-table comparison.

The dump, fingerprints and history export share one repeatable-read exported PostgreSQL snapshot. Recovery uses [PostgreSQL custom archives](https://www.postgresql.org/docs/17/app-pgdump.html) and [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) with no owner/ACL restoration, one transaction and exit-on-error. Table fingerprints compare record contents, including scheduling state and prompt/history snapshots. The archive restores constraints, indexes and functions; representative integrity behavior is separately covered by PostgreSQL tests.

To retain a deliberately named backup, this exact command was exercised during Phase 3 verification:

```powershell
rtk proxy bun.cmd run backup backup private-data/backups/phase3-release-20261006
```

It refuses an existing directory. For subsequent backups use a new private directory name. Do not edit or mix files from different snapshots.

## Restore safely

This explicit named restore was exercised for that backup:

```powershell
rtk proxy bun.cmd run backup restore private-data/backups/phase3-release-20261006 ai_sensei_restore_phase3_release_20261006
```

The target must have the `ai_sensei_restore_` prefix and must not already exist. Source-target equality, the configured study database, redirected backup directories, artifact hash mismatches and existing targets are refused. No reset, DROP DATABASE, overwrite, volume removal or automatic connection switch occurs. Failed targets remain separate for private inspection; retry with a fresh name after diagnosing the failure. Do not treat a directory without a verified restore report as proven recoverable.

To actually resume from a verified restored target, stop the app and manually change only the database name in private `.env`, retaining localhost credentials/port. Start the app and confirm the saved session/history. This connection switch has not been executed as part of Phase 3, and is not automated. Keep the original study database until the recovered copy is accepted.

## Evidence and limits

On 8 October 2026, all 20 public table fingerprints matched after the full local-to-Neon transfer, including migration bookkeeping and learner records. A separate local restore was verified before switching the active connection. A subsequent backup taken from the active Neon database also restored locally with all 20 fingerprints matching. The active server reports PostgreSQL 15.19. The PostgreSQL 17 client needed a compatibility path for that older target: export the archive to private SQL, remove only the unsupported `SET transaction_timeout = 0;` header, and apply it with `psql --single-transaction` and `ON_ERROR_STOP`. Every table must still match before the connection switch.

For a future explicitly authorized empty Neon target set as `POSTGRES_DATABASE_URL`, **stop the local app and all import writers first and keep them stopped through switching**. Then use `rtk proxy node scripts/migrate-neon.mjs transfer-and-switch --confirm-local-writers-stopped`. The tool also refuses other connected local database clients and a nonempty Neon schema. This is a one-time transfer, not synchronization; do not rerun it against the populated active database. Original PDFs/imports remain local. The local database is a retained recovery copy, not a second active database. Existing recovery commands restore into distinct local targets. Switching from a verified local restore back to study remains a deliberate recovery decision.

On 6 October 2026, real backups restored successfully into distinct targets before and after the Phase 3 migration; all 20 public table fingerprints matched. The real library had zero ReviewLog rows. `test:recovery` separately backed up and restored synthetic records with nonempty review history, full state and immutable prompts. Synthetic fixtures never wrote to the study database. Existing-target refusal was also exercised.

Original PDFs, OCR, private import files and `.env` are outside PostgreSQL and need separate private preservation. Database roles/global server configuration are not included by pg_dump. The current tools verify local recovery on this installation, not another machine or a future PostgreSQL major version. Dumps/export contain private book fragments and learner data: keep them out of Git, `public/`, Graphify and tool output.
