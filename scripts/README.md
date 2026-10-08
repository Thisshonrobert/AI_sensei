# Local utilities

`import-batches.mjs` validates/sanitizes extraction JSON and loads unreviewed Source/ImportBatch staging under Master Plan §16. It never publishes facts or activates cards. `backup.mjs` creates private dump/history artifacts and verifies separate-target restores; see [recovery](../docs/backup-recovery.md). There is no Git automation or phase orchestration.

`canonical-import.mjs` provides private inventory/preview output, explicit edition confirmation, record/hash approval, and transactional promotion. `test-canonical-postgres.mjs` creates a uniquely named localhost test database and applies migrations there before synthetic checks; it never resets or writes fixture data into staging. Logs/target metadata stay in ignored `.local/`. Commands and the approval boundary are in [database import](../docs/database-import.md).
