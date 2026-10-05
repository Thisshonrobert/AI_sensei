# Tooling and verification

Authority: Master Plan §§8, 16, 18–20. **Current scope: local PostgreSQL, preserved staging, and a bounded canonical importer.** Additive content/provenance migrations, explicit record/hash approval, and isolated PostgreSQL checks now exist. No real records are promoted. No Next.js study application, scheduler, application build/lint/typecheck or browser tests exist. This slice does not complete the full phase-1 gate.

## Establish tooling in phase 1

Use the approved Next.js/React/TypeScript/Tailwind, Prisma/PostgreSQL, and Zod stack. Add `ts-fsrs` with phase-2 review behavior; pin and record its exact version. Evaluate the local Japanese analyzer when phase-5 validation needs it. Do not copy Bun, Turborepo or Kafka from the Zapier reference. Docker Compose for local PostgreSQL was explicitly selected by the user for this task.

Staging tooling uses Node `v24.20.0`, npm `11.6.2`, pinned Prisma/Prisma Client `6.19.0`, Zod `3.25.76`, and `package-lock.json`. The Compose image is `postgres:17-bookworm`; its real database is local, not Prisma's hosted service. `.env` holds POSTGRES_USER/PASSWORD/DB/PORT and matching DATABASE_URL; `.env.example` contains placeholders only.

For future application setup, record actual lint/typecheck/build/start commands only when implemented. Verify release-specific framework/library APIs against current official documentation. Do not automatically upgrade major database/ORM versions while preserving existing data.

## Staging commands

Run from the repository root. The importer requires explicit input file paths; the real private batches must never be committed.

```powershell
rtk proxy npm ci
rtk proxy npx prisma generate
rtk proxy docker compose up -d --wait postgres
rtk proxy npx prisma migrate deploy
rtk proxy npm test
rtk proxy npm run import:sanitize -- --files '<grammar-json-path>' '<kanji-json-path>' '<vocabulary-json-path>'
rtk proxy npm run import:load -- --files '<grammar-json-path>' '<kanji-json-path>' '<vocabulary-json-path>'
```

The three path arguments above are placeholders to replace with real paths, not commands that work unchanged. `import:sanitize` performs no database writes. `import:load` sanitizes first and loads unreviewed Source/ImportBatch data, preserving all records/questions and issues. Rerunning unchanged input must reuse the existing batch. No canonical approval, card activation or FSRS changes occur.

Prisma's documented migration workflow applies pending versioned migrations with [`prisma migrate deploy`](https://docs.prisma.io/docs/cli/migrate); generation is run separately for this CLI setup. Do not use a database reset to resolve an import error.

Bind the app/database locally. Keep database credentials and optional API keys server-only, outside Git. No paid account, automatic generation, or OCR installation is required to build the initial verified content slice.

## Command conventions

The user-provided RTK instruction requires shell commands to start with `rtk`. Use supported filters or `rtk proxy <command>` for passthrough. Examples of read-only repository inspection:

```powershell
rtk git status --short
rtk git diff --check
rtk proxy git ls-files --others --exclude-standard
```

`git diff --check` does not validate untracked file content. Inspect new documents and links separately. Stage/commit/push actions follow AGENTS.md's manual handoff unless explicitly authorized.

## Verification by behavior

| Phase | Evidence required before calling it complete |
|---|---|
| 1: verified content | Real migrations/import run; unchanged reimport is a no-op; canonical kanji reuse retains separate citations; vocabulary senses/readings remain distinct; source/generated labels and missing-field handling hold |
| 2: daily recall | Fixed-time transitions match pinned ts-fsrs; complete state round-trips; atomic rollback; duplicate event has one effect; stale parallel event conflicts; resume preserves due dates; A1/A2 objectives/ratings remain independent |
| 3: personal release | Realistic stop/resume session, global/per-type caps across timezone boundaries, sibling separation, restored backup, zero AI calls, dashboard/grammar explanation/comparison and Takoboto checks |
| 4: assessment | Cumulative eligible targets; no unseen N2/duplicates; sparse and zero-baseline pools; immutable refreshed selection; persistent server deadline/assistance; unchanged FSRS after tests |
| 5: generated practice | Manual import works without paid API or baseline rows; malformed/provenance-invalid drafts rejected; untracked support distinguished from explicit unresolved errors; approved question/rubric gates; failure leaves reviews usable; stored reader aids/annotations work |
| 6: growth | Corrections preserve history; edition-specific membership counts reconcile; optional baseline does not mass-activate cards; useful throughput |
| 7: extensions | Observed study need and measured benefit; existing recall correctness preserved |

The complete gates and targeted amendment checks remain in Master Plan §18. Do not substitute this abbreviated table for them.

## Appropriate checks

- Unit checks: reading normalization and meaning alternatives, eligibility/selection/shortage logic, scope reason codes, Unicode annotation boundaries.
- Real PostgreSQL integration checks: schema constraints, idempotent imports, review concurrency/atomicity, publication provenance, ownership and history preservation. A mocked database cannot establish these guarantees.
- Focused browser flow: study/reveal/rate/refresh/resume; keyboard/focus, Japanese legibility, mobile input, ruby, answer leakage, empty/loading/error states. Add timed-reader checks with that feature.
- Manual source checks: actual book editions/pages, readings, meanings, formations, question answer keys. Automation cannot replace this approval.
- Recovery check: restore a real backup into a separate target and verify source records, cards and review history before relying on the personal release.

Use small synthetic or permitted fixtures; keep actual textbook batches and learner data private. Avoid a snapshot suite for every reference page. Run the focused checks and real required lint/typecheck/build commands once available; rerun affected checks after fixes.

## Report evidence honestly

### Verified staging setup — 5 October 2026

- `docker compose config --quiet`: valid configuration. Compose service `postgres` is running healthy at `127.0.0.1:5433`, with a persistent named volume.
- `.env` connection fields match DATABASE_URL; no credentials are printed or tracked. Private input/output paths and environment files are ignored; Prisma migration SQL remains trackable.
- `prisma validate`, `prisma generate`, and migration deploy succeeded. Migration `20261004000000_import_staging` creates only Source/ImportBatch staging plus Prisma migration bookkeeping.
- `npm test`: six passing checks, including option-order safety, malformed batch/answer rejection, page coverage flags, grammar preservation and versioned raw-evidence retention on Windows.
- Initial database load created three draft batches; unchanged reload returns the same batches without insertion. Three Source rows and three ImportBatch rows contain 108 vocabulary entries, 38 kanji, 10 grammar points and 15 questions.
- Independent database/file comparison confirmed raw SHA-256 hashes and bytes match the original Downloads files, stagedJson equals sanitized JSON, and all supplied source fields remain preserved. Additional provisional locators/issues do not rewrite source wording.
- Grammar: 30 review flags (15 missing target links, 15 unreviewed answer keys). Kanji: 62 flags (38 provisional locators, 24 missing critical-field flags). Vocabulary: 108 provisional locator flags. No page-coverage or expected-count mismatch was reported for these batches.
- Edition/level authority remain unspecified rather than guessed. All batches are draft/unreviewed; no canonical publication, learner introductions, cards, FSRS events, scored question approval or human PDF verification occurred.
- Application build/lint/typecheck/browser flow and backup restore remain unimplemented/unverified. Full Master Plan phase 1 is not complete.

For each handoff record command, outcome, relevant environment, and limitations. Distinguish automated checks, human source verification, pending acceptance, and deferred scope. Never call OCR accuracy, a backup restore, offline operation, or an application test verified merely because instructions or placeholders exist.

### Bounded canonical slice — 5 October 2026

- `rtk proxy npm test`: nine passing unit/staging checks; eight PostgreSQL checks deliberately skipped here unless the isolated runner supplies its test URL. The original six staging tests remain passing.
- `rtk proxy npm run test:canonical`: eight passing real PostgreSQL tests in a newly created `ai_sensei_canonical_test_<uuid>` database. The runner reads the local connection privately, creates a distinct localhost target, deploys versioned migrations there and never resets/writes fixture data into staging. Target names/logs are retained in ignored `.local/`; these synthetic targets are not a backup of the study database.
- Covered: exact approval/changed-payload invalidation, unchanged repeat/correction no-ops, real second-write SQL failure with full rollback, automatic exact kanji reuse with two source citations, vocabulary reading/POS/sense distinctions, grammar construction distinctions, immutable source/content/snapshot revisions, wrong typed/provenance rejection, independent dictionary evidence, partial batches/draft-question exclusion, read-only inventory and explicit edition confirmation.
- `rtk proxy npx prisma validate` and `rtk proxy npx prisma generate`: succeeded with pinned Prisma 6.19.0. `rtk proxy npx prisma migrate deploy`: additive `20261005000000_canonical_import` and `20261005010000_content_link_guard` applied to the local staging database after isolated testing. The second migration closes a reproduced late-target-insertion gap without modifying the already applied first migration. No reset, volume removal or textbook promotion ran.
- Three real `import:canonical inventory` commands saved private dry-run inventories: grammar 25 records, kanji 38, vocabulary 108. All 171 remain blocked for source/edition/page/identity review; no record approval was created. Raw hashes and staged JSON still match preserved sanitizer-v2 evidence.
- The private packet separately preserves dictionary URLs/snapshot hashes and AI link rationales. Its structure/count/reference checks do not verify transcription or approve dictionary senses/grammar links/answers. The user-confirmed absence of separate individual-kanji book glosses is recorded; nonempty extracted glosses still need origin checking.
- Human-approved source review/pilot import, item/source pages and the remaining phase-1 gate are pending. §16's eventual card creation is explicitly deferred to §18 phase 2. No application build, lint, typecheck, browser flow, scheduler or backup restoration is claimed.
