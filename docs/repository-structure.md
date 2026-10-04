# Repository structure

Authority: Master Plan §§2, 16, 18. Folder names are engineering organization within the approved single application, not new services. This scaffold reserves locations without prebuilding future interfaces.

```text
AI_sensei/
├── AGENTS.md
├── README.md
├── FINALIZED_PROJECT_PLAN.md
├── src/
│   ├── app/                    # Next.js screens/mutations in phase 1
│   ├── components/             # UI shared by actual features
│   └── lib/server/content/     # Content identity, validation, local import
├── prisma/                     # Schema and migrations in phase 1
├── scripts/                    # Actual import/backup utilities as needed
├── tests/fixtures/             # Small synthetic or permitted fixtures
├── docs/
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── tooling_Verification.md
│   ├── documentation.md
│   ├── graphify.md
│   ├── implementation-workflow.md
│   ├── extraction-templates/   # Existing illustrative JSON/prompt
│   └── references/             # Existing Satori reading-layout reference
└── private-data/               # Entire tree ignored
    ├── sources/                # Originals by source ID
    ├── ocr/                    # Raw text, positions, confidence, page images
    ├── imports/                # Draft/approved JSON with stable source keys
    ├── backups/                # PostgreSQL dumps/export manifests
    └── inspection/             # Existing private inspection images
```

Small README placeholders keep source/prisma/script/test folders visible in Git. They are not executable implementation.

## Add only with working behavior

- Phase 2: `src/lib/server/review/` owns scheduler configuration, persisted objectives, queue eligibility, and transactional review submission.
- Phase 4: `src/lib/server/assessment/` owns cumulative eligibility, selection snapshots, timing, and scoring separate from FSRS.
- Phase 5: `src/lib/server/generation/` owns bounded prompt export/manual draft import, language-scope validation, and publication gates.
- Add shared database helpers/validation only when the implementing slice needs them. Do not establish empty service interfaces for every future feature.
- `public/` later contains deliberately public app assets only. Book pages, learner records, and private fonts/credentials never belong there.
- `.local/` may hold concise ignored progress/handoff notes. `graphify-out/` is created only by an explicitly scoped engineering-index run.

PostgreSQL's real data directory is managed by PostgreSQL outside this layout. PDFs are private files referenced through source metadata, not database blobs. Approved JSON and database backups remain private portable recovery material.

Extraction templates are proposed interchange formats. The phase-1 importer must explicitly map them to the Master Plan's schema, preserving provenance and verifying original PDF-page versus printed-page conventions. Do not import their sample entries as book content.
