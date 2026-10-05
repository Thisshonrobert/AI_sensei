# Database implementation

The staging migration preserves Source/ImportBatch. The additive canonical migration implements the phase-1 Item/typed rows, SourceEntry, Content/ContentItem and VocabularyKanji structures, plus immutable ItemRevision snapshots and PromotionApproval receipts. PostgreSQL deferred constraints enforce exactly one matching typed row, current snapshot consistency and same-item field evidence. Evidence, content revisions and approvals are append-only; superseding source/content revisions retain their predecessors.

Use versioned migrations, never reset the staging database. SQL triggers/checks are handwritten because Prisma cannot express them; preserve them when creating later migrations. Local PostgreSQL is the default. See [import workflow](../docs/database-import.md) and [verification](../docs/tooling_Verification.md). Scheduling/learner/assessment/generation tables remain deferred.
