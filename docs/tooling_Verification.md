# Tooling and verification

Authority: Master Plan §§8, 16, 18–20. **Current status: documentation scaffold only.** No package manifest, lockfile, executable scripts, schema, migrations, or application checks exist yet. Folder placeholders do not prove implementation readiness.

## Establish tooling in phase 1

Use the approved Next.js/React/TypeScript/Tailwind, Prisma/PostgreSQL, and Zod stack. Add `ts-fsrs` with phase-2 review behavior; pin and record its exact version. Evaluate the local Japanese analyzer when phase-5 validation needs it. Do not choose Bun, Turborepo, Docker, Kafka, or other Zapier tooling from the reference template.

At actual setup, record the tested Node/package-manager versions, lockfile, real install/start/lint/typecheck/test/build commands, migration procedure, and server-only environment keys in this file. Select one package manager then; none is selected by this documentation scaffold. Do not publish invented `npm run` commands before those scripts exist. Verify release-specific framework/library APIs against current official documentation during implementation.

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

For each handoff record command, outcome, relevant environment, and limitations. Distinguish automated checks, human source verification, pending acceptance, and deferred scope. Never call OCR accuracy, a backup restore, offline operation, or an application test verified merely because instructions or placeholders exist.
