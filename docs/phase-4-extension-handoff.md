# Phase 4 flexible-study extension handoff — 8 October 2026

Authority: [Master Plan](../FINALIZED_PROJECT_PLAN.md) §§8, 10, 12, 18; [implementation checklist](superpowers/plans/2026-10-08-flexible-study.md). Implementation and automated extension gates are verified. No Phase 5 work or real question/source approval occurred.

Vocabulary, kanji and grammar detail pages offer keyboard/touch **Mark as studied**. It records first introduction without a daily cap, preserves existing familiarity and first date on retries/concurrent tabs, and leaves existing card states/history intact. Targeted preparation creates only source-gated dormant objectives; suspended and retired objectives are preserved. Missing grammar prompts/contextual readings remain visible.

Dashboard counts distinguish studied today, waiting objectives/items, partially activated items, missing content, due reviews and consumed activation allowances. Defaults remain 5/2/1 and 8 total. Native number controls save deliberate defaults or an explicit increase for today, with proposed counts shown before activation. These controls change allowances only; **Continue learning** retains the existing study-first/first-recall flow. The oldest studied waiting objectives precede unstudied reference cards. New sessions contain at most 20 new objectives. Operational input ranges are 0–100 per category and 0–300 global; daily extra totals are bounded to 1,000 per field and 100 distinct increase requests. These are safety bounds, not study targets.

Reuse: UserItem introduction, dormant Card, Card.introductionDay and User.settingsJson under the existing user-row lock. Temporary increases are effective only on their original timezone study day; durable request receipts prevent a lost-response retry granting a second increase after midnight. Consumed allowance cannot reset through reload/new sessions/configuration. Lowering allowances defers excess selected objectives without changing the saved selection or card schedules. No schema migration, dependency, artificial Attempt/rating/ReviewLog, scheduler replacement or automatic mass activation was added. Existing answer-exposure/sibling deferrals remain enforced. Studied inactive targets may enter a new approved weekly sample; running selections stay frozen.

## Actual verification

Commands ran through Bun scripts with Node execution; PostgreSQL and Edge fixtures used separate synthetic localhost databases. No learner library was populated/reset. Ignored `.local/` retains sanitized runner results, fixture targets and screenshots.

| Command | Result |
|---|---|
| `rtk proxy bun.cmd run test` | 33 unit checks passed; database checks skipped here and run through their isolated runners |
| `rtk proxy bun.cmd run test:review` | 21 full PostgreSQL checks passed, including 135 studied items / 165 dormant objectives and existing recall regressions |
| `rtk proxy bun.cmd run test:review "--filter=flexible deliberate extra\|flexible study completion"` | 2 focused checks passed after final test additions: six genuine vocabulary activations with an explicit increase; preserved familiar status/notes/exclusion |
| `rtk proxy bun.cmd run test:review "--filter=flexible activation allowances\|flexible parallel"` | 2 focused checks passed for cross-day retries, concurrent activation, reduced allowances and backlog preservation |
| `rtk proxy bun.cmd run test:assessment` | 10 PostgreSQL checks passed, including studied inactive eligibility and unchanged running selection |
| `rtk proxy bun.cmd run lint` | Passed |
| `rtk proxy bun.cmd run typecheck` | Passed |
| `rtk proxy bun.cmd run build` | Passed, all existing routes retained |
| `rtk proxy bun.cmd run test:review:browser` | 8 production Edge checks passed: all three completion actions, keyboard/touch, refresh, saved defaults/increases, mobile layout and prior study/review regressions |
| `rtk proxy bun.cmd run test:assessment:browser` | 1 passed; 1 active-library availability check intentionally skipped on synthetic bank fixture |
| `rtk git diff --check` | Passed |

Independent focused review found two P2 issues (cross-day increase retries and lowering allowances with an open session). Both were corrected with PostgreSQL regressions; read-only recheck found no remaining substantive issue. The large 135-item fixture runs last so older tests retain their intended reference pools.

## Limits and integration

Live scored questions still require their independent answer/target/support approvals. Existing three source batches retain acceptance without PDF comparison. No real learner study-duration/pace claim or complete book coverage is implied. Study starts 10 October; 15 December is only a provisional preparation deadline. No Neon verification was run for this extension; its transaction checks ran on PostgreSQL locally, with no active connection switch. There is no schema change to deploy.

**Graphify required: yes.** This is a completed recall/assessment architectural milestone. Refresh only after the user integrates this bundle and confirms a clean, up-to-date default branch; the existing base Phase 4 follow-up remains pending. Graphify does not block studying.

Implementation: `src/app/[kind]/[id]/page.tsx`, `src/app/api/review/route.ts`, `src/app/globals.css`, `src/app/page.tsx`, `src/components/activation-controls.tsx`, `src/components/mark-studied.tsx`, `src/components/daily-budget.tsx`, `src/lib/server/review/service.mjs`, `src/lib/server/review/service.d.mts`, `tests/review-postgres.test.mjs`, `tests/assessment-postgres.test.mjs`, `tests/browser/review.spec.ts`.

Documentation: `AGENTS.md`, `FINALIZED_PROJECT_PLAN.md`, `README.md`, `docs/architecture.md`, `docs/documentation.md`, `docs/implementation-workflow.md`, `docs/tooling_Verification.md`, `docs/phase-4-handoff.md`, this handoff, `docs/superpowers/plans/2026-10-08-flexible-study.md`. Only extension status/evidence changed in shared base-phase docs; no later-phase preparation is included.

Excluded: pre-existing `graphify-out/cache/` and `graphify-out/manifest.json`, all other graph outputs, `.local/`, private books/imports/backups, credentials and learner data. Git mutations remain manual.

```powershell
rtk git add -- "src/app/[kind]/[id]/page.tsx" src/app/api/review/route.ts src/app/globals.css src/app/page.tsx src/components/activation-controls.tsx src/components/mark-studied.tsx src/components/daily-budget.tsx src/lib/server/review/service.mjs src/lib/server/review/service.d.mts tests/review-postgres.test.mjs tests/assessment-postgres.test.mjs tests/browser/review.spec.ts AGENTS.md FINALIZED_PROJECT_PLAN.md README.md docs/architecture.md docs/documentation.md docs/implementation-workflow.md docs/tooling_Verification.md docs/phase-4-handoff.md docs/phase-4-extension-handoff.md docs/superpowers/plans/2026-10-08-flexible-study.md
```

Suggested commit subject: `feat: separate studied items from review activation`
