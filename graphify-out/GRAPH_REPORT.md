# Graph Report - AI_sensei  (2026-10-06)

## Corpus Check
- 35 files · ~13,327 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 329 nodes · 699 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b872d0a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- For future refreshes, follow the allowlisted corpus workflow in `docs/graphify.md`; do not scan the repository root broadly.

## Community Hubs (Navigation)
- Review API and runtime
- Content and database integrity
- Canonical import service
- Reference and source routes
- Runtime dependencies
- Daily recall database schema
- Review interface and service
- Project scripts and checks
- Local import test runner
- Application shell and layout
- Review service types
- Review user configuration

## God Nodes (most connected - your core abstractions)
1. `"items"` - 15 edges
2. `"cards"` - 15 edges
3. `introduce()` - 15 edges
4. `scripts` - 14 edges
5. `"source_entries"` - 14 edges
6. `startSession()` - 13 edges
7. `"attempts"` - 12 edges
8. `POST()` - 12 edges
9. `promote()` - 12 edges
10. `syncCards()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `approve()` --calls--> `previewPromotion()`  [EXTRACTED]
  tests/canonical-postgres.test.mjs → src/lib/server/content/canonical-import.mjs
- `approvedGrammar()` --calls--> `previewPromotion()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/content/canonical-import.mjs
- `coreContext()` --calls--> `previewPromotion()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/content/canonical-import.mjs
- `fixture()` --calls--> `previewPromotion()`  [EXTRACTED]
  tests/review-postgres.test.mjs → src/lib/server/content/canonical-import.mjs
- `approve()` --calls--> `recordApproval()`  [EXTRACTED]
  tests/canonical-postgres.test.mjs → src/lib/server/content/canonical-import.mjs

## Import Cycles
- None detected.

## Communities (14 total, 3 thin omitted)

### Community 0 - "Review API and runtime"
Cohesion: 0.09
Nodes (51): ts-fsrs, zod, answer, dynamic, failure(), GET(), id, input (+43 more)

### Community 1 - "Content and database integrity"
Cohesion: 0.08
Nodes (42): "import_batches", import_batches_createdAt_idx, import_batches_sourceId_fileHash_key, "sources", check_item_integrity(), check_revision_provenance(), "content", "content_items" (+34 more)

### Community 2 - "Canonical import service"
Cohesion: 0.09
Nodes (38): @prisma/client, addContent(), addition, approvalToken(), citation, confirmEdition(), contentSchemas, evidence() (+30 more)

### Community 3 - "Reference and source routes"
Cohesion: 0.12
Nodes (35): next, server-only, Detail(), Catalog(), Source(), Sources(), Citations(), ContentBlock() (+27 more)

### Community 4 - "Runtime dependencies"
Cohesion: 0.05
Nodes (36): dependencies, next, @prisma/client, react, react-dom, server-only, ts-fsrs, zod (+28 more)

### Community 5 - "Daily recall database schema"
Cohesion: 0.12
Nodes (30): "attempts", attempts_reviewLogId_key, attempts_reviewLogId_userId_key, attempts_userId_clientEventId_key, attempts_userId_primaryTargetItemId_submittedAt_idx, card_objective, "cards", cards_id_userId_key (+22 more)

### Community 6 - "Review interface and service"
Cohesion: 0.23
Nodes (12): react, ReviewPage(), AnswerView(), call(), labels, Review(), rate(), replace() (+4 more)

### Community 7 - "Project scripts and checks"
Cohesion: 0.14
Nodes (14): scripts, build, dev, import:canonical, import:load, import:sanitize, lint, start (+6 more)

### Community 8 - "Local import test runner"
Cohesion: 0.25
Nodes (3): admin, adminUrl, base

### Community 9 - "Application shell and layout"
Cohesion: 0.33
Nodes (3): dynamic, metadata, runtime

### Community 10 - "Review service types"
Cohesion: 0.33
Nodes (5): Answer, ResponseInput, ReviewCard, ReviewError, SessionView

## Knowledge Gaps
- **88 isolated node(s):** `name`, `private`, `type`, `packageManager`, `dev` (+83 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 115 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Reference and source routes` to `Review API and runtime`, `Application shell and layout`, `Runtime dependencies`, `Review interface and service`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _88 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Review API and runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.09335839598997493 - nodes in this community are weakly interconnected._
- **Why does `@prisma/client` connect `Canonical import service` to `Local import test runner`, `Review service types`, `Reference and source routes`, `Runtime dependencies`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Should `Content and database integrity` be split into smaller, more focused modules?**
  _Cohesion score 0.07673469387755102 - nodes in this community are weakly interconnected._
- **Why does `zod` connect `Review API and runtime` to `Canonical import service`, `Runtime dependencies`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Should `Canonical import service` be split into smaller, more focused modules?**
  _Cohesion score 0.09308510638297872 - nodes in this community are weakly interconnected._
## Raw extraction integrity note
- Graphify diagnostics found 0 missing endpoints, 5 dangling endpoint edges, 18 external-reference edges, 4 self-loops, and 17 same-endpoint edge groups before build. The final exported graph has 0 missing/dangling/external-reference edges, 3 self-loops, and 0 collapsed endpoint pairs.
- Five test files yielded no AST symbols. Code-only extraction used no LLM; input/output token cost was 0.
