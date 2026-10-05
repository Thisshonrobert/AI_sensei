# Documentation policy

**Documentation is necessary, but keep it concise.** This project stores textbook evidence and irreplaceable review history. Engineers need durable instructions for import provenance, recall transactions, publication gates, verification, and recovery. The learner needs to study Japanese, not complete a software-development course.

## Source precedence

1. The user's explicit project decisions and approved amendments.
2. [FINALIZED_PROJECT_PLAN.md](../FINALIZED_PROJECT_PLAN.md), the primary project specification.
3. [AGENTS.md](../AGENTS.md) and focused engineering docs that summarize/apply the plan.
4. Current code and verification evidence for what is actually implemented, not permission to contradict the specification.

The Zapier guide contributes organization and style only. Its architecture, model presets, phase automation, learning comments, and services are not project requirements. Report plan/implementation conflicts explicitly; do not silently resolve them through a new doc or stale memory.

## Document map

| Document | Purpose |
|---|---|
| [README](../README.md) | Current status and entry points |
| [AGENTS](../AGENTS.md) | Engineering constraints, tools, handoffs and token discipline |
| [Master Plan](../FINALIZED_PROJECT_PLAN.md) | Features, schema, learning behavior, phases and full acceptance criteria |
| [Repository structure](repository-structure.md) | Present folders, private storage, deferred modules |
| [Architecture](architecture.md) | Responsibilities and invariants with plan references |
| [Tooling & verification](tooling_Verification.md) | Honest tooling status and meaningful evidence requirements |
| [Database import](database-import.md) | Local Docker PostgreSQL lifecycle and unreviewed JSON staging boundary |
| [Implementation workflow](implementation-workflow.md) | Ordered phase scope, status, and handoff format |
| [Graphify](graphify.md) | Optional engineering index, milestone/privacy policy |
| [Extraction prompt](extraction-templates/extraction-prompt.md) | Existing illustrative interchange templates and manual source extraction |
| [Reading reference](references/satori-reader-reading-ui.png) | Existing internal UI reference for Master Plan §20; not a shipped app asset |

## Update rules

- Update affected docs in the same phase bundle when behavior, constraints, commands, environment, or recovery procedure changes. Do not write a report for every minor edit.
- Keep implementation status factual. Add real setup commands only after they exist and have been exercised. Source inspection is not source approval; valid JSON is not verified Japanese.
- Link exact Master Plan sections instead of duplicating its whole schema or generating a second master plan. Record approved decision changes there and reconcile summaries.
- Add a concise backup/restore runbook with phase 3 when its actual commands and successful restore evidence exist. Do not label speculative instructions tested.
- Keep raw diagnostics/progress in ignored `.local/` when needed; private source data and learner results stay in `private-data/`/PostgreSQL. Docs contain sanitized engineering facts.
- No mandatory `/teach`, developer lessons, explanatory learning comments, daily work diaries, or repeated architecture reviews. Japanese teaching features follow the plan's own product rules.

Documentation alone does not establish an application phase's completion. Application tests and the full Master Plan §18 gates remain required.
