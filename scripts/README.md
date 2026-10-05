# Local utilities

`import-batches.mjs` validates/sanitizes the supplied extraction JSON and loads unreviewed payloads into Source/ImportBatch staging under Master Plan §16. It preserves private evidence and does not publish textbook facts, activate cards or create scheduler events. See docs/tooling_Verification.md for exact commands. Backup/export/restore utilities remain phase-3 work; there is no Git automation or phase orchestration.
