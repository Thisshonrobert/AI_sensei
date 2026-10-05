# Verification scope

`import-batches.test.mjs` uses Node's built-in test runner for staging sanitation trust-boundary checks. Real database load/reload evidence belongs in docs/tooling_Verification.md. Add review integration and study/resume browser checks when those behaviors exist; no study application tests exist yet. See Master Plan §18 for full phase gates.

`canonical-import.test.mjs` checks hash/identity/selection boundaries. `canonical-postgres.test.mjs` verifies typed/provenance constraints, promotion approval/invalidation, repeat/correction no-ops, real SQL rollback, multiple-source kanji reuse, vocabulary/grammar distinctions, partial batches and draft-question exclusion. Run `rtk proxy npm run test:canonical` for these integration checks. `npm test` skips them unless the isolated runner supplies `CANONICAL_TEST_URL`; do not set that to the staging database.
