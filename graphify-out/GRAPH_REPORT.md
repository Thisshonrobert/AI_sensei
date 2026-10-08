# Graph Report - AI_sensei  (2026-10-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 519 nodes · 1216 edges · 29 communities (18 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6008f171`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [kind]/[id]/page.tsx
- review/service.mjs
- backup.mjs
- assessment/service.mjs
- study.mjs
- content/canonical-import.mjs
- import-batches.mjs
- scripts
- compilerOptions
- bank.mjs
- package.json
- devDependencies
- referencePresentation
- selection.mjs
- layout.tsx
- dependencies
- @playwright/test
- assessment/service.d.mts
- study.d.mts
- next-env.d.ts
- ref_node_assert
- comparisonSchema
- vocabularyComponentAidSchema
- LOCAL_USER_ID

## God Nodes (most connected - your core abstractions)
1. `scripts` - 22 edges
2. `@prisma/client` - 20 edges
3. `localDatabaseUrl()` - 18 edges
4. `POST()` - 17 edges
5. `introduce()` - 17 edges
6. `startSession()` - 16 edges
7. `restoreDatabase()` - 16 edges
8. `compilerOptions` - 16 edges
9. `locked()` - 15 edges
10. `syncCards()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/assessment-postgres.test.mjs → src/lib/server/review/service.mjs
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs
- `approvedGrammar()` --calls--> `syncCards()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs
- `coreContext()` --calls--> `syncCards()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs
- `fixture()` --calls--> `syncCards()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs

## Import Cycles
- None detected.

## Communities (29 total, 6 thin omitted)

### Community 0 - "[kind]/[id]/page.tsx"
Cohesion: 0.06
Nodes (58): react, server-only, Flashcards(), Detail(), Catalog(), Home(), Source(), Sources() (+50 more)

### Community 1 - "review/service.mjs"
Cohesion: 0.09
Nodes (64): ts-fsrs, allowances, answer, dynamic, failure(), GET(), id, input (+56 more)

### Community 2 - "backup.mjs"
Cohesion: 0.11
Nodes (38): ref_node_child_process, ref_node_crypto, ref_node_fs, @prisma/client, backupDatabase(), containerFor(), databaseConnection(), guardedDirectory() (+30 more)

### Community 3 - "assessment/service.mjs"
Cohesion: 0.12
Nodes (39): zod, dynamic, failure(), GET(), id, input, local(), POST() (+31 more)

### Community 4 - "study.mjs"
Cohesion: 0.07
Nodes (35): Dictionary(), close(), lookup(), openTerm(), showFallback(), call(), labels, Review() (+27 more)

### Community 5 - "content/canonical-import.mjs"
Cohesion: 0.11
Nodes (35): ref_node_test, run(), addContent(), addition, approvalToken(), citation, confirmEdition(), contentSchemas (+27 more)

### Community 6 - "import-batches.mjs"
Cohesion: 0.11
Nodes (23): answerSchema, batchSchemas, commonEntry, example, exampleWord, loadLocalEnv(), loadStaged(), pages (+15 more)

### Community 7 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, assessment:bank, backup, build, db:refresh-local, db:target, dev, import:canonical (+14 more)

### Community 8 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 9 - "bank.mjs"
Cohesion: 0.21
Nodes (13): ref_node_util, run(), bankHash(), id, ids, parseBank(), passageSchema, publishBank() (+5 more)

### Community 10 - "package.json"
Cohesion: 0.12
Nodes (15): name, packageManager, private, type, eslint, eslint-config-next, postcss, prisma (+7 more)

### Community 11 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, @playwright/test, postcss, prisma, tailwindcss, @tailwindcss/postcss (+4 more)

### Community 12 - "referencePresentation"
Cohesion: 0.23
Nodes (6): ActivationControls(), fields, meaning(), reading(), referencePresentation(), text()

### Community 13 - "selection.mjs"
Cohesion: 0.25
Nodes (7): allocate(), domains, POLICY_VERSION, selectAssessment(), stamp(), strata, now

### Community 14 - "layout.tsx"
Cohesion: 0.22
Nodes (6): config, next, src_app_globals, dynamic, metadata, runtime

### Community 15 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, next, @prisma/client, react, react-dom, server-only, ts-fsrs, zod

### Community 17 - "assessment/service.d.mts"
Cohesion: 0.40
Nodes (4): AssessmentError, AssessmentQuestion, AssessmentResult, AssessmentView

### Community 18 - "study.d.mts"
Cohesion: 0.40
Nodes (4): GrammarComparison, StudyContent, StudyExample, StudySource

## Knowledge Gaps
- **184 isolated node(s):** `DetailItem`, `DetailItem`, `DetailItem`, `AssessmentError`, `AssessmentQuestion` (+179 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 225 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `backup.mjs` to `[kind]/[id]/page.tsx`, `assessment/service.mjs`, `study.mjs`, `content/canonical-import.mjs`, `import-batches.mjs`, `bank.mjs`, `package.json`, `assessment/service.d.mts`, `study.d.mts`?**
  _High betweenness centrality (0.181) - this node is a cross-community bridge._
- **Why does `zod` connect `assessment/service.mjs` to `[kind]/[id]/page.tsx`, `review/service.mjs`, `study.mjs`, `content/canonical-import.mjs`, `import-batches.mjs`, `bank.mjs`, `package.json`, `study.d.mts`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `DetailItem`, `DetailItem`, `DetailItem` to the rest of the system?**
  _184 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `[kind]/[id]/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06263173742848539 - nodes in this community are weakly interconnected._
- **Should `review/service.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.08780903665814152 - nodes in this community are weakly interconnected._
- **Should `backup.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10857142857142857 - nodes in this community are weakly interconnected._