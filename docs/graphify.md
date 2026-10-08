# Graphify policy

Graphify is an **optional engineering navigation index** over permitted code/docs. It is not an application graph database, Japanese prerequisite engine, learner-memory system, or retrieval dependency. The Master Plan rejects graph databases/complex RAG in V1; this policy does not change that boundary.

## Current status and cadence

The Phase 4 cumulative assessment and flexible-study extension milestone is integrated and indexed. **Graphify required: yes for this architectural milestone; refresh completed on 2026-10-08** from commit `6008f171f8d96fcea0abb315f6536c0de0f2acdc` on clean `main` matching `origin/main`. The code-only allowlist contains 91 code files; the outputs contain 519 nodes, 1,216 edges, and 29 communities across `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, and `graphify-out/graph.html`. Graphify 0.9.76 ran without LLM calls (zero input/output tokens) using AST extraction scoped via `.graphifyignore`. Machine-local caches and untracked inputs are excluded. Routine content/display follow-ups and documentation-only updates do not require separate graph refreshes.

Refresh when a major implemented architectural boundary changes or a substantial implementation phase is complete and integrated. Small edits, comment-only changes, and routine documentation updates do not require refresh. A graph never replaces the Master Plan or current files; check source locations and freshness when using it.

## Manual milestone workflow

1. At implementation handoff, state whether a refresh is required and why.
2. The user commits/pushes/merges the phase bundle, updates the default branch, and confirms it is ready. Do not assume a branch name or integration status.
3. Use a clean up-to-date default branch or a clean worktree based on it. Stop if unrelated edits or private material could enter the index.
4. If Graphify is available, follow its current skill/tool workflow with a narrowly scoped permitted corpus. Exclude private inputs **before** extraction; Git ignore alone is not a guarantee of scanner exclusion. Review inputs and generated outputs for private content before any handoff.
5. Verify actual generated paths, source references, freshness and reported extraction limitations. Never fabricate graph nodes/edges or a completion report when no tool ran.
6. Hand off only the named generated milestone outputs (normally `graph.json`, `GRAPH_REPORT.md`, `graph.html`) with an exact staging command and separate suggested commit subject. Exclude machine-local interpreter paths, caches, costs and query memory.

Do not install tools, hooks, graph databases, watchers, or automated commits just to satisfy this section. Tool absence does not block implementation or studying; report a refresh as pending when needed. User-authorized Git actions can override the manual default.

## Permitted corpus and privacy

Use narrowly selected engineering source files, Prisma schema/migrations, and sanitized engineering documentation. Existing graph queries can guide file discovery, but implementation evidence and the Master Plan remain authoritative.

Exclude `private-data/`, `.local/`, `.env*`, credentials/keys, raw PDFs/images/OCR, real extraction/import batches, PostgreSQL dumps, learner responses/history, `docs/references/` imagery, `.git/`, dependencies/build/test output, and previous graph output. Exclude illustrative extraction templates unless a specific engineering query needs them. No remote publishing of the graph is part of this policy.

Do not treat Graphify's own inferred edges as verified curriculum relationships. Record ambiguity and tool costs honestly; include only sanitized facts in tracked reports.
