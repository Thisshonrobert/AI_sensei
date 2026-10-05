# Graph Report - AI_sensei  (2026-10-06)

## Corpus Check
- Corpus is ~7,021 words - fits in a single context window. You may not need a graph.

## Summary
- 223 nodes · 349 edges · 13 communities (10 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0f409110`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Canonical content schema
- Import approval pipeline
- Reference and source routes
- Catalog query layer
- Browser and build tooling
- Shared reference components
- Development dependencies
- Project scripts
- Runtime dependencies
- Application shell and layout
- Import staging schema

## God Nodes (most connected - your core abstractions)
1. `"source_entries"` - 14 edges
2. `scripts` - 12 edges
3. `"items"` - 11 edges
4. `reviewRecord()` - 9 edges
5. `next` - 9 edges
6. `prepare()` - 8 edges
7. `promote()` - 8 edges
8. `"content"` - 8 edges
9. `hashJson()` - 7 edges
10. `"kanji"` - 7 edges

## Surprising Connections (you probably didn't know these)
- `approve()` --calls--> `previewPromotion()`  [EXTRACTED]
  tests/canonical-postgres.test.mjs → src/lib/server/content/canonical-import.mjs
- `approve()` --calls--> `recordApproval()`  [EXTRACTED]
  tests/canonical-postgres.test.mjs → src/lib/server/content/canonical-import.mjs
- `"source_entries"` --references--> `"sources"`  [EXTRACTED]
  prisma/migrations/20261005000000_canonical_import/migration.sql → prisma/migrations/20261004000000_import_staging/migration.sql
- `listItems()` --calls--> `pageInput()`  [EXTRACTED]
  src/lib/server/content/catalog.ts → src/lib/server/content/catalog-input.ts
- `sourceList()` --calls--> `pageInput()`  [EXTRACTED]
  src/lib/server/content/catalog.ts → src/lib/server/content/catalog-input.ts

## Import Cycles
- None detected.

## Communities (13 total, 3 thin omitted)

### Community 0 - "Canonical content schema"
Cohesion: 0.09
Nodes (38): check_item_integrity(), check_revision_provenance(), "content", "content_items", content_supersedesId_key, "grammar", grammar_identity, grammar_integrity (+30 more)

### Community 1 - "Import approval pipeline"
Cohesion: 0.11
Nodes (29): addContent(), addition, approvalToken(), citation, confirmEdition(), contentSchemas, evidence(), grammar (+21 more)

### Community 3 - "Catalog query layer"
Cohesion: 0.11
Nodes (21): @prisma/client, server-only, CatalogContent, CatalogItem, Citation, citationSelect, contentSelect, Kind (+13 more)

### Community 4 - "Browser and build tooling"
Cohesion: 0.10
Nodes (19): name, packageManager, private, type, eslint, eslint-config-next, @playwright/test, postcss (+11 more)

### Community 5 - "Shared reference components"
Cohesion: 0.25
Nodes (9): Citations(), ContentBlock(), Fact(), ItemLink(), name(), object(), Origin(), summary() (+1 more)

### Community 6 - "Development dependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, eslint-config-next, @playwright/test, postcss, prisma, tailwindcss, @tailwindcss/postcss (+4 more)

### Community 7 - "Project scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, import:canonical, import:load, import:sanitize, lint, start (+4 more)

### Community 8 - "Runtime dependencies"
Cohesion: 0.25
Nodes (8): dependencies, next, @prisma/client, react, react-dom, server-only, ts-fsrs, zod

### Community 9 - "Application shell and layout"
Cohesion: 0.33
Nodes (3): dynamic, metadata, runtime

### Community 10 - "Import staging schema"
Cohesion: 0.60
Nodes (4): "import_batches", import_batches_createdAt_idx, import_batches_sourceId_fileHash_key, "sources"

## Knowledge Gaps
- **70 isolated node(s):** `CatalogContent`, `CatalogItem`, `Citation`, `addition`, `citation` (+65 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 105 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Reference and source routes` to `Application shell and layout`, `Browser and build tooling`, `Shared reference components`?**
  _High betweenness centrality (0.215) - this node is a cross-community bridge._
- **What connects `CatalogContent`, `CatalogItem`, `Citation` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Canonical content schema` be split into smaller, more focused modules?**
  _Cohesion score 0.08585858585858586 - nodes in this community are weakly interconnected._
- **Why does `@prisma/client` connect `Catalog query layer` to `Import approval pipeline`, `Browser and build tooling`, `Shared reference components`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Should `Import approval pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Why does `zod` connect `Browser and build tooling` to `Import approval pipeline`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Should `Reference and source routes` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._


## Extraction Notes

- Scope: 22 allowlisted code files (19 application, test, and configuration files plus 3 schema migrations), 7,021 words. No documentation, private data, books, or learner records were scanned.
- Three test files produced no symbol nodes: tests/browser/catalog.spec.ts, tests/canonical-import.test.mjs, and tests/catalog-queries.test.mjs.
- Graphify reported 3 self-loop edges corresponding to SQL self-reference constraints for content supersession/parenting and source-entry supersession. It reported 0 dangling or missing endpoints and 0 collapsed edge pairs.
- Twenty source-free external-symbol nodes had checkout-path-derived IDs. Their machine-specific prefix was removed; all nodes and links were retained under sanitized IDs.
- Extraction used Graphify 0.9.76 in code-only mode, with no LLM calls or token charges.
