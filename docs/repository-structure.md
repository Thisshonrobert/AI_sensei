# Repository structure

Authority: Master Plan §§2, 16, 18. Folder names are engineering organization within the approved single application, not new services. This scaffold reserves locations without prebuilding future interfaces.

```text
AI_sensei/
├── AGENTS.md
├── README.md
├── compose.yaml                # User-selected local PostgreSQL container
├── .env.example                # Sanitized configuration example; .env ignored
├── package.json                # Bun-managed app/import tooling (Node runtime)
├── bun.lock                    # Exact tooling dependency graph
├── FINALIZED_PROJECT_PLAN.md
├── src/
│   ├── app/                    # Reference screens, /review and same-origin /api/review
│   ├── components/             # UI shared by actual features
│   └── lib/server/             # content/ import + review/ scheduler/transactions
├── prisma/                     # Staging, canonical provenance and Phase 2 recall migrations
├── scripts/import-batches.mjs  # Sanitize and load unreviewed JSON batches
├── tests/                      # Node unit, isolated PostgreSQL and reference-browser checks
├── docs/
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── tooling_Verification.md
│   ├── documentation.md
│   ├── graphify.md
│   ├── implementation-workflow.md
│   ├── database-import.md
│   ├── extraction-templates/   # Existing illustrative JSON/prompt
│   └── references/             # Existing Satori reading-layout reference
└── private-data/               # Entire tree ignored
    ├── sources/                # Originals by source ID
    ├── ocr/                    # Raw text, positions, confidence, page images
    ├── imports/                # Draft/approved JSON with stable source keys
    ├── backups/                # PostgreSQL dumps/export manifests
    └── inspection/             # Existing private inspection images
```

`src/app/` now implements reference lists, item details and source details, plus loading/error/not-found states. `src/components/reference.tsx` contains shared provenance/reference UI. `src/lib/server/db.ts` is server-only; content/catalog modules retrieve bounded explicit records. Prisma and scripts retain staging/canonical import; tests include Node, isolated PostgreSQL and production-browser checks. Exact authorized real promotion is complete under acceptance without PDF comparison; physical PDF intake/transcription remains unverified. No later-phase modules were prebuilt.

## Add only with working behavior

Phase 2 is now implemented: `src/lib/server/review/` contains the pinned FSRS adapter and persistent recall service; `src/components/review.tsx` supplies the recall/reveal/rate interface. `scripts/test-review-postgres.mjs` creates isolated synthetic databases for transaction and browser checks. Assessment/generation modules remain absent. Current evidence is in [Phase 2 handoff](phase-2-handoff.md).

- Phase 2: `src/lib/server/review/` owns scheduler configuration, persisted objectives, queue eligibility, and transactional review submission.
- Phase 3: the same review service supplies dashboard/budget/attention behavior; `content/study.mjs` retrieves approved backs/comparisons; `components/study-content.tsx`, `dictionary.tsx` and `daily-budget.tsx` render them. `scripts/backup.mjs` owns private backup/export and separate-target verified restore. Evidence is in [Phase 3 handoff](phase-3-handoff.md).
- Phase 4: `src/lib/server/assessment/` owns cumulative eligibility, selection snapshots, timing, and scoring separate from FSRS.
- Phase 5: `src/lib/server/generation/` owns bounded prompt export/manual draft import, language-scope validation, and publication gates.
- Add shared database helpers/validation only when the implementing slice needs them. Do not establish empty service interfaces for every future feature.
- `public/` later contains deliberately public app assets only. Book pages, learner records, and private fonts/credentials never belong there.
- `.local/` may hold concise ignored progress/handoff notes. `graphify-out/` is created only by an explicitly scoped engineering-index run.

PostgreSQL's real data directory is managed by PostgreSQL outside this layout. PDFs are private files referenced through source metadata, not database blobs. Approved JSON and database backups remain private portable recovery material.

Extraction templates are proposed interchange formats. The phase-1 importer must explicitly map them to the Master Plan's schema, preserving provenance and verifying original PDF-page versus printed-page conventions. Do not import their sample entries as book content.
