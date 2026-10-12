# Illustrated dashboard — 12 October 2026

User-approved refinement of the existing home dashboard: purple dashed character boxes in vocabulary's **Kanji in this word**, the exact WaniKani landscape footer on every page, an original study illustration, and daily/best streaks plus study, review, reading and weekly completion counts. The approved rules are recorded in the Master Plan's dashboard refinement.

Counts come from existing PostgreSQL records. Studied vocabulary/kanji/grammar counts are unique first introductions against verified imported core totals, not mastery. Reviews count saved ratings, including Again. Weekly counts require submitted cumulative tests. Streaks use the saved learner timezone; weeks start Monday. Opening a page, importing or generating a passage does not count as completion.

**Mark reading complete** saves one completed practice `StudySession` per generated passage/run under the existing learner lock. Retries and concurrent tabs preserve the first completion date. It works on saved drafts without granting content approval or changing learner familiarity, Attempts, ReviewLogs or FSRS. Completed reading assessments also contribute to reading totals; lesson exercises do not. The assessment API rejects completion-only session snapshots.

The footer asset is stored in `public/illustrations/wanikani-footer.gif`, sourced from [WaniKani's footer asset](https://assets.wanikani.com/assets/footer-bg-4d7ea4d5.gif), with Tofugu/WaniKani attribution in the shared footer. The original dashboard illustration is `public/illustrations/study-companion.svg`. Both work offline; no new dependency or schema migration was introduced.

## Verification

Verified with actual commands: production build and typecheck; lint; the timezone/streak unit test; 22 recall PostgreSQL tests; 10 assessment PostgreSQL tests; 13 generation PostgreSQL tests, including explicit completion, ownership, retries/concurrency, retained first completion, genuine rating totals, submitted versus unfinished weekly work and the assessment guard; and all 3 generation browser tests. The browser checks cover completion persistence after reload, dashboard totals, mobile overflow, the shared footer, purple dashed borders and existing reading/publication interactions. All database tests use isolated synthetic databases.

```powershell
rtk proxy bun run build
rtk proxy bun run typecheck
rtk proxy bun run lint
rtk proxy node --test tests/dashboard-activity.test.mjs
rtk proxy bun run test:review
rtk proxy bun run test:assessment
rtk proxy bun run test:generation:browser
rtk git diff --check
```

Desktop/mobile screenshots were visually inspected in ignored `.local/dashboard-desktop.png`, `.local/dashboard-mobile.png` and `.local/vocabulary-kanji-box.png`. These previews show synthetic counts. An earlier stale reader-guidance text assertion was replaced with a functional lookup-value assertion; no reader functionality was removed. The expanded browser scenario uses a 60-second test budget for the added page visits and screenshots. A read-only reviewer found the completion-session assessment boundary issue; it was reproduced, guarded and verified before completion.

## Manual Git handoff

The checkout already contains substantial earlier work, including edits in some of these files. Review that combined diff before staging. No commits, pushes or branch changes were performed.

```powershell
rtk git add -- FINALIZED_PROJECT_PLAN.md docs/dashboard-handoff.md src/app/page.tsx src/app/layout.tsx src/app/globals.css src/app/api/generation/route.ts src/components/dashboard-activity.tsx src/components/practice.tsx src/lib/server/review/activity.mjs src/lib/server/review/service.mjs src/lib/server/review/service.d.mts src/lib/server/generation/service.mjs src/lib/server/generation/service.d.mts src/lib/server/assessment/service.mjs public/illustrations/study-companion.svg public/illustrations/wanikani-footer.gif tests/dashboard-activity.test.mjs tests/generation-postgres.test.mjs tests/browser/generation.spec.ts
```

Suggested commit subject: `feat: add illustrated study dashboard and completion tracking`

**Graphify required: no.** This extends existing display and practice flows without a new architectural boundary.
