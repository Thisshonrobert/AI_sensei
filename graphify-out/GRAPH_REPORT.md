# Graph Report - AI_sensei  (2026-10-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 421 nodes · 925 edges · 27 communities (16 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `12cab1bf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- service.mjs
- src/lib/server/content/catalog.ts
- content/canonical-import.mjs
- backup.mjs
- study.mjs
- import-batches.mjs
- compilerOptions
- scripts
- zod
- package.json
- app/page.tsx
- devDependencies
- src/app/layout.tsx
- dependencies
- referencePresentation
- kanji-mnemonic.tsx
- @playwright/test
- next-env.d.ts
- ref_node_assert
- comparisonSchema
- vocabularyComponentAidSchema
- LOCAL_USER_ID

## God Nodes (most connected - your core abstractions)
1. `scripts` - 18 edges
2. `introduce()` - 16 edges
3. `restoreDatabase()` - 16 edges
4. `@prisma/client` - 16 edges
5. `compilerOptions` - 16 edges
6. `startSession()` - 15 edges
7. `POST()` - 14 edges
8. `object()` - 14 edges
9. `promote()` - 14 edges
10. `localDatabaseUrl()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs
- `ready()` --calls--> `commitResponse()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs
- `selected()` --calls--> `commitResponse()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs
- `Home()` --calls--> `dashboard()`  [EXTRACTED]
  src/app/page.tsx → src/lib/server/review/service.mjs
- `ready()` --calls--> `introduce()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/review/service.mjs

## Import Cycles
- None detected.

## Communities (27 total, 6 thin omitted)

### Community 0 - "service.mjs"
Cohesion: 0.10
Nodes (56): ref_node_util, ts-fsrs, answer, dynamic, failure(), GET(), id, input (+48 more)

### Community 1 - "src/lib/server/content/catalog.ts"
Cohesion: 0.09
Nodes (46): server-only, Flashcards(), Detail(), Catalog(), Source(), Sources(), EntryNavigation(), exampleMeaning() (+38 more)

### Community 2 - "content/canonical-import.mjs"
Cohesion: 0.09
Nodes (41): ref_node_crypto, ref_node_test, @prisma/client, run(), addContent(), addition, approvalToken(), citation (+33 more)

### Community 3 - "backup.mjs"
Cohesion: 0.13
Nodes (32): ref_node_child_process, ref_node_fs, backupDatabase(), containerFor(), databaseConnection(), guardedDirectory(), hashFile(), historyTables (+24 more)

### Community 4 - "study.mjs"
Cohesion: 0.09
Nodes (28): call(), labels, Review(), rate(), replace(), response(), start(), submit() (+20 more)

### Community 5 - "import-batches.mjs"
Cohesion: 0.12
Nodes (23): answerSchema, batchSchemas, commonEntry, example, exampleWord, loadLocalEnv(), loadStaged(), pages (+15 more)

### Community 6 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 7 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, backup, build, db:refresh-local, db:target, dev, import:canonical, import:load (+10 more)

### Community 8 - "zod"
Cohesion: 0.12
Nodes (13): zod, GrammarComparison, StudyContent, StudyExample, StudySource, VocabularyComponent, VocabularyComponentAid, kana (+5 more)

### Community 9 - "package.json"
Cohesion: 0.12
Nodes (15): name, packageManager, private, type, eslint, eslint-config-next, postcss, prisma (+7 more)

### Community 10 - "app/page.tsx"
Cohesion: 0.18
Nodes (10): react, Home(), BrowseFlashcard(), DailyBudget(), Dictionary(), close(), lookup(), openTerm() (+2 more)

### Community 11 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, @playwright/test, postcss, prisma, tailwindcss, @tailwindcss/postcss (+4 more)

### Community 12 - "src/app/layout.tsx"
Cohesion: 0.22
Nodes (6): config, next, src_app_globals, dynamic, metadata, runtime

### Community 13 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, next, @prisma/client, react, react-dom, server-only, ts-fsrs, zod

### Community 14 - "referencePresentation"
Cohesion: 0.52
Nodes (4): meaning(), reading(), referencePresentation(), text()

### Community 15 - "kanji-mnemonic.tsx"
Cohesion: 0.70
Nodes (4): KanjiMnemonic(), object(), strings(), text()

## Knowledge Gaps
- **152 isolated node(s):** `DetailItem`, `DetailItem`, `DetailItem`, `Answer`, `Dashboard` (+147 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 183 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `content/canonical-import.mjs` to `src/lib/server/content/catalog.ts`, `backup.mjs`, `study.mjs`, `import-batches.mjs`, `zod`, `package.json`, `kanji-mnemonic.tsx`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `zod` connect `zod` to `service.mjs`, `content/canonical-import.mjs`, `study.mjs`, `import-batches.mjs`, `package.json`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `DetailItem`, `DetailItem`, `DetailItem` to the rest of the system?**
  _152 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `service.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09508196721311475 - nodes in this community are weakly interconnected._
- **Should `src/lib/server/content/catalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09453551912568306 - nodes in this community are weakly interconnected._
- **Should `content/canonical-import.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._