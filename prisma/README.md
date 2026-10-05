# Database implementation

The initial schema/migration implements only Master Plan §4 Source and ImportBatch staging. UUID IDs, JSONB payloads, UTC timestamps, source foreign keys and source/hash uniqueness preserve batch provenance and repeat safety. Approved canonical tables and later-feature relationships arrive with their actual workflows. Local PostgreSQL is the default; the user selected Docker Compose for this setup. See docs/tooling_Verification.md for execution evidence.
