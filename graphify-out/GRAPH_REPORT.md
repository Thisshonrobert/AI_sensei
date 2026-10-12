# Graph Report - AI_sensei  (2026-10-12)

## Corpus Check
- Corpus is ~37,653 words - fits in a single context window. You may not need a graph.

## Summary
- 766 nodes · 1818 edges · 33 communities (20 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `abcfe155`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Practice Generation
- Study Catalog Navigation
- Spaced Review Transactions
- Database Backup Recovery
- Study Dashboard
- Cumulative Assessment
- Grammar Lesson Exercises
- Canonical Content Approval
- Batch Extraction Enrichment
- Reader Dictionary Analysis
- Import Batch Staging
- Project Script Commands
- TypeScript Compiler Settings
- Package Identity
- Assessment Bank Publication
- Development Dependencies
- Runtime Dependencies
- Application Layout Configuration
- Browser Acceptance Tests
- Generation Type Contracts
- Practice Interaction
- Next.js Type References
- Gemini Provider Configuration
- Comparison Validation
- Vocabulary Aid Validation
- Approval Request Limits
- Review Finding Limits
- Local User Identity

## God Nodes (most connected - your core abstractions)
1. `@prisma/client` - 27 edges
2. `scripts` - 26 edges
3. `localDatabaseUrl()` - 24 edges
4. `createUser()` - 20 edges
5. `zod` - 19 edges
6. `POST()` - 17 edges
7. `introduce()` - 17 edges
8. `restoreDatabase()` - 16 edges
9. `generateDraft()` - 16 edges
10. `startSession()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/generation-postgres.test.mjs → src/lib/server/review/service.mjs
- `reason()` --calls--> `answerReasonData()`  [EXTRACTED]
  tests/lesson-answer-reasons.test.mjs → src/lib/server/content/lesson-answer-reasons.mjs
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/assessment-postgres.test.mjs → src/lib/server/review/service.mjs
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/lesson-exercises-postgres.test.mjs → src/lib/server/review/service.mjs
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs

## Import Cycles
- None detected.

## Communities (33 total, 8 thin omitted)

### Community 0 - "Practice Generation"
Cohesion: 0.05
Nodes (68): dynamic, failure(), GET(), id, input, local(), POST(), runtime (+60 more)

### Community 1 - "Study Catalog Navigation"
Cohesion: 0.06
Nodes (60): Flashcards(), Detail(), Catalog(), Source(), Sources(), BrowseFlashcard(), EntryNavigation(), exampleMeaning() (+52 more)

### Community 2 - "Spaced Review Transactions"
Cohesion: 0.08
Nodes (69): ts-fsrs, allowances, answer, dynamic, failure(), GET(), id, input (+61 more)

### Community 3 - "Database Backup Recovery"
Cohesion: 0.07
Nodes (46): @prisma/client, backupDatabase(), containerFor(), databaseConnection(), guardedDirectory(), hashFile(), historyTables, inventory() (+38 more)

### Community 4 - "Study Dashboard"
Cohesion: 0.06
Nodes (42): react, Home(), ActivationControls(), fields, DailyBudget(), DashboardActivity(), Dictionary(), close() (+34 more)

### Community 5 - "Cumulative Assessment"
Cohesion: 0.08
Nodes (46): server-only, zod, dynamic, failure(), GET(), id, input, local() (+38 more)

### Community 6 - "Grammar Lesson Exercises"
Cohesion: 0.10
Nodes (40): privatePath(), run(), dynamic, failure(), GET(), id, input, local() (+32 more)

### Community 7 - "Canonical Content Approval"
Cohesion: 0.11
Nodes (33): run(), addContent(), addition, approvalToken(), citation, confirmEdition(), contentSchemas, evidence() (+25 more)

### Community 8 - "Batch Extraction Enrichment"
Cohesion: 0.17
Nodes (25): collectRequests(), createLookupCache(), enrichBatch(), kana(), normalizeGloss(), preparePacket(), requireAbsent(), resolveCandidates() (+17 more)

### Community 9 - "Reader Dictionary Analysis"
Cohesion: 0.12
Nodes (22): kuromoji, installDictionary(), updateDictionary(), analyzeDraft(), elementaryParticles, forms(), kana(), readingTokens() (+14 more)

### Community 10 - "Import Batch Staging"
Cohesion: 0.11
Nodes (22): answerSchema, batchSchemas, commonEntry, example, exampleWord, loadLocalEnv(), loadStaged(), pages (+14 more)

### Community 11 - "Project Script Commands"
Cohesion: 0.08
Nodes (26): scripts, assessment:bank, backup, build, db:refresh-local, db:target, dev, import:canonical (+18 more)

### Community 12 - "TypeScript Compiler Settings"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 13 - "Package Identity"
Cohesion: 0.12
Nodes (15): name, packageManager, private, type, eslint, eslint-config-next, postcss, prisma (+7 more)

### Community 14 - "Assessment Bank Publication"
Cohesion: 0.23
Nodes (12): run(), bankHash(), id, ids, parseBank(), passageSchema, publishBank(), questionSchema (+4 more)

### Community 15 - "Development Dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, @playwright/test, postcss, prisma, tailwindcss, @tailwindcss/postcss (+4 more)

### Community 16 - "Runtime Dependencies"
Cohesion: 0.22
Nodes (9): dependencies, kuromoji, next, @prisma/client, react, react-dom, server-only, ts-fsrs (+1 more)

### Community 17 - "Application Layout Configuration"
Cohesion: 0.25
Nodes (5): config, next, dynamic, metadata, runtime

### Community 19 - "Generation Type Contracts"
Cohesion: 0.25
Nodes (7): Draft, GenerationError, ReaderReference, ReaderWord, Run, RunSummary, Target

### Community 20 - "Practice Interaction"
Cohesion: 0.43
Nodes (6): failureMessage(), Practice(), mutate(), open(), refresh(), resetApproval()

## Knowledge Gaps
- **244 isolated node(s):** `config`, `name`, `private`, `type`, `packageManager` (+239 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 311 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `zod` connect `Cumulative Assessment` to `Practice Generation`, `Study Catalog Navigation`, `Spaced Review Transactions`, `Database Backup Recovery`, `Study Dashboard`, `Grammar Lesson Exercises`, `Canonical Content Approval`, `Import Batch Staging`, `Package Identity`, `Assessment Bank Publication`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `Database Backup Recovery` to `Practice Generation`, `Study Catalog Navigation`, `Spaced Review Transactions`, `Study Dashboard`, `Cumulative Assessment`, `Grammar Lesson Exercises`, `Canonical Content Approval`, `Import Batch Staging`, `Package Identity`, `Assessment Bank Publication`, `Browser Acceptance Tests`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `scripts` connect `Project Script Commands` to `Package Identity`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `config`, `name`, `private` to the rest of the system?**
  _244 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Practice Generation` be split into smaller, more focused modules?**
  _Cohesion score 0.05131578947368421 - nodes in this community are weakly interconnected._
- **Should `Study Catalog Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.05995410212277682 - nodes in this community are weakly interconnected._
- **Should `Spaced Review Transactions` be split into smaller, more focused modules?**
  _Cohesion score 0.08081791626095423 - nodes in this community are weakly interconnected._
## Refresh Provenance and Limitations
- Refreshed on 2026-10-12 from clean tracked `main`, verified against remote `origin/main`: `abcfe1554d5a29149cf1e12e67f72fa541eeaa75`.
- Graphify 0.9.61; 134 tracked code inputs selected by an explicit allowlist before detection. No LLM calls; zero input/output tokens.
- Private data, environment files, documents, media, untracked inputs, dependencies, and prior graph outputs were excluded.
- Nine SQL inputs produced no graph contributions because `tree_sitter_sql` is unavailable. Prisma schema files are unsupported by this code extractor.
- Graph health warning: 203 raw edges have dangling endpoints; 5 self-loop edges; 33 same-endpoint edges collapse in the undirected graph. The graph is a navigation aid, not complete dependency evidence.
