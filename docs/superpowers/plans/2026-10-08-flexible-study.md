# Flexible study implementation plan

**Authority:** FINALIZED_PROJECT_PLAN.md §§8, 10, 12, 18; approved 8 October 2026.
**Goal:** Record explicit study independently of recall activation, with persisted adjustable allowances and honest waiting counts.
**Architecture:** Reuse UserItem.introducedAt, dormant Card records, Card.introductionDay counts, and User.settingsJson under the existing user-row transaction lock. Keep routes in /api/review. No new dependency or database table. Execute inline; Git remains manual.

- [x] Add failing PostgreSQL tests for idempotent completion, all item types, suspended/retired preservation, 135 studied items/165 dormant objectives, oldest waiting selection, allowance increases/retries/concurrency/rollover/backlog, and weekly eligibility/frozen selection.
- [x] Implement targeted card preparation, explicit completion and item pool status. Completion only fills absent introduction evidence and unseen familiarity; never changes existing cards. Retired objectives remain retired.
- [x] Persist configurable per-type/global allowances and idempotent daily increases. Derive usage from introductionDay under the existing lock; check current backlog and eligibility on each activation. Prefer oldest studied waiting objectives; retain the existing explicit study-first new-card flow for unstudied reference items. Bound each session's new batch to 20 cards.
- [x] Add keyboard/touch completion on detail pages and compact dashboard waiting counts, gaps, configuration and deliberate daily increase controls using existing styles. Add focused browser checks.
- [x] Run Node tests via Bun, isolated PostgreSQL review/assessment checks, lint, typecheck, build and isolated production browser checks. Inspect output; record limitations.
- [x] Review the diff against §18, update affected handoff/tooling docs, provide exact scoped manual staging and Graphify integration prerequisite. Exclude graph caches and private files.
