# Local utilities

`import-batches.mjs` validates/sanitizes the supplied extraction JSON and loads unreviewed payloads into Source/ImportBatch staging under Master Plan §16. It preserves private evidence and does not publish textbook facts, activate cards or create scheduler events. See docs/tooling_Verification.md for exact commands. Backup/export/restore utilities remain phase-3 work; there is no Git automation or phase orchestration.

`canonical-import.mjs` provides private inventory/preview output, explicit edition confirmation, record/hash approval, and transactional promotion. `test-canonical-postgres.mjs` creates a uniquely named localhost test database and applies migrations there before synthetic checks; it never resets or writes fixture data into staging. Logs/target metadata stay in ignored `.local/`. Commands and the approval boundary are in [database import](../docs/database-import.md).
