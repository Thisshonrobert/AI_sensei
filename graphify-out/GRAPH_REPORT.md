# Graph Report - AI_sensei  (2026-10-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 639 nodes · 1527 edges · 34 communities (20 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `051707ca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [kind]/[id]/page.tsx
- content/canonical-import.mjs
- generation/service.mjs
- review/service.mjs
- assessment/service.mjs
- study.mjs
- import-batches.mjs
- scripts
- react
- compilerOptions
- bank.mjs
- package.json
- devDependencies
- analyzer.mjs
- layout.tsx
- dependencies
- vocabulary-components.mjs
- @playwright/test
- generation/service.d.mts
- assessment/service.d.mts
- study.d.mts
- next-env.d.ts
- gemini.d.mts
- ref_node_assert
- comparisonSchema
- vocabularyComponentAidSchema
- MAX_APPROVAL_BODY_CHARS
- MAX_REVIEW_FINDINGS
- LOCAL_USER_ID

## God Nodes (most connected - your core abstractions)
1. `scripts` - 24 edges
2. `@prisma/client` - 22 edges
3. `localDatabaseUrl()` - 20 edges
4. `POST()` - 17 edges
5. `introduce()` - 17 edges
6. `zod` - 17 edges
7. `restoreDatabase()` - 16 edges
8. `createUser()` - 16 edges
9. `startSession()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/generation-postgres.test.mjs → src/lib/server/review/service.mjs
- `run()` --calls--> `previewPromotion()`  [EXTRACTED]
  scripts/canonical-import.mjs → src/lib/server/content/canonical-import.mjs
- `run()` --calls--> `recordApproval()`  [EXTRACTED]
  scripts/canonical-import.mjs → src/lib/server/content/canonical-import.mjs
- `approvedGrammar()` --calls--> `promote()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/content/canonical-import.mjs
- `coreContext()` --calls--> `promote()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/content/canonical-import.mjs

## Import Cycles
- None detected.

## Communities (34 total, 9 thin omitted)

### Community 0 - "[kind]/[id]/page.tsx"
Cohesion: 0.06
Nodes (63): server-only, Flashcards(), Detail(), Catalog(), Home(), Source(), Sources(), DailyBudget() (+55 more)

### Community 1 - "content/canonical-import.mjs"
Cohesion: 0.06
Nodes (63): ref_node_child_process, ref_node_crypto, ref_node_fs, ref_node_test, @prisma/client, backupDatabase(), containerFor(), databaseConnection() (+55 more)

### Community 2 - "generation/service.mjs"
Cohesion: 0.06
Nodes (63): dynamic, failure(), GET(), id, input, local(), POST(), runtime (+55 more)

### Community 3 - "review/service.mjs"
Cohesion: 0.08
Nodes (71): ts-fsrs, allowances, answer, dynamic, failure(), GET(), id, input (+63 more)

### Community 4 - "assessment/service.mjs"
Cohesion: 0.09
Nodes (46): zod, dynamic, failure(), GET(), id, input, local(), POST() (+38 more)

### Community 5 - "study.mjs"
Cohesion: 0.08
Nodes (31): call(), labels, Review(), rate(), replace(), response(), start(), submit() (+23 more)

### Community 6 - "import-batches.mjs"
Cohesion: 0.12
Nodes (23): answerSchema, batchSchemas, commonEntry, example, exampleWord, loadLocalEnv(), loadStaged(), pages (+15 more)

### Community 7 - "scripts"
Cohesion: 0.08
Nodes (24): scripts, assessment:bank, backup, build, db:refresh-local, db:target, dev, import:canonical (+16 more)

### Community 8 - "react"
Cohesion: 0.12
Nodes (11): react, ActivationControls(), fields, BrowseFlashcard(), failureMessage(), Practice(), mutate(), open() (+3 more)

### Community 9 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 10 - "bank.mjs"
Cohesion: 0.21
Nodes (13): ref_node_util, run(), bankHash(), id, ids, parseBank(), passageSchema, publishBank() (+5 more)

### Community 11 - "package.json"
Cohesion: 0.12
Nodes (15): name, packageManager, private, type, eslint, eslint-config-next, postcss, prisma (+7 more)

### Community 12 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, @playwright/test, postcss, prisma, tailwindcss, @tailwindcss/postcss (+4 more)

### Community 13 - "analyzer.mjs"
Cohesion: 0.29
Nodes (7): kuromoji, analyzeDraft(), elementaryParticles, forms(), kana(), tokenizer(), word

### Community 14 - "layout.tsx"
Cohesion: 0.22
Nodes (6): config, next, src_app_globals, dynamic, metadata, runtime

### Community 15 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, kuromoji, next, @prisma/client, react, react-dom, server-only, ts-fsrs (+1 more)

### Community 16 - "vocabulary-components.mjs"
Cohesion: 0.25
Nodes (6): kana, label, vocabularyComponentAidSchema, content, item, payload

### Community 18 - "generation/service.d.mts"
Cohesion: 0.33
Nodes (5): Draft, GenerationError, Run, RunSummary, Target

### Community 19 - "assessment/service.d.mts"
Cohesion: 0.40
Nodes (4): AssessmentError, AssessmentQuestion, AssessmentResult, AssessmentView

### Community 20 - "study.d.mts"
Cohesion: 0.40
Nodes (4): GrammarComparison, StudyContent, StudyExample, StudySource

## Knowledge Gaps
- **220 isolated node(s):** `DetailItem`, `DetailItem`, `DetailItem`, `Draft`, `GenerationError` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `zod` connect `assessment/service.mjs` to `content/canonical-import.mjs`, `generation/service.mjs`, `review/service.mjs`, `study.mjs`, `import-batches.mjs`, `bank.mjs`, `package.json`, `vocabulary-components.mjs`, `study.d.mts`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `content/canonical-import.mjs` to `[kind]/[id]/page.tsx`, `generation/service.mjs`, `review/service.mjs`, `assessment/service.mjs`, `study.mjs`, `import-batches.mjs`, `bank.mjs`, `package.json`, `assessment/service.d.mts`, `study.d.mts`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `DetailItem`, `DetailItem`, `DetailItem` to the rest of the system?**
  _220 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `[kind]/[id]/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05987703822507351 - nodes in this community are weakly interconnected._
- **Should `content/canonical-import.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06323396567299007 - nodes in this community are weakly interconnected._
- **Should `generation/service.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06265432098765432 - nodes in this community are weakly interconnected._