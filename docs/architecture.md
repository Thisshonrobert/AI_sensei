# Architecture and boundaries

Authority: [Master Plan](../FINALIZED_PROJECT_PLAN.md) §§2–8, 12–20. This is a navigation summary, not another implementation specification.

## One local application

Next.js UI → Node server functions → PostgreSQL through Prisma. Server-side `ts-fsrs` owns schedule computations. Zod validates variable content/import payloads. Local extraction produces human-verified structured JSON; optional generation returns drafts for validation/approval. No separate backend deployment, broker, autonomous study agent, vector retrieval, or custom scheduler/parser.

Localhost is the default on the existing Windows PC. Protect mutation endpoints against cross-origin requests and check ownership throughout relations. Stored review/original examples remain usable without AI or internet. Before internet hosting, implement one-user authentication/authorization. Local PostgreSQL is default; Neon is a user-selected alternative with the same migrations and explicit data transfer/validation, never dual-database sync. Recheck any external plan/quota at setup rather than treating dated allowances as permanent.

## Data responsibilities

| Responsibility | Master Plan records | Boundary |
|---|---|---|
| Canonical learning content | Item; Vocabulary; Kanji; Grammar; VocabularyKanji | Identity is distinct from source membership and personal knowledge |
| Source/provenance and import | Source; SourceEntry; ImportBatch | Stable record keys, exact evidence, verified immutable source revisions |
| Examples and explanations | Content; ContentItem | One kind-discriminated store; explicit origin and revision-bound annotations |
| Learner knowledge | User; UserItem | Familiarity/baseline/attention/saved contexts are not schedule state |
| Recall | Card; ReviewLog | One stable objective and complete independent FSRS state per card |
| Practice/tests | StudySession; SessionItem; Attempt | Immutable selections/results; no V1 practice-to-FSRS propagation |
| Optional generation | GenerationRun | Bounded inputs/provenance/validator reports; cannot approve its own output |

These are the Master Plan's eighteen logical tables. Implement incrementally, adding later-feature foreign keys with those features. Consult §4 for exact fields, constraints, indexes, and transactions; this table does not authorize a different schema.

## Recall correctness

Phase 2 implements these recall boundaries in `src/lib/server/review/` and `/api/review`, with `/review` as the client interface. A single User-row lock serializes local mutations; composite foreign keys enforce ownership. Immutable session selections survive stop/restart. Response commitment persists an ungraded Attempt before reveal; rating atomically grades/links it with an append-only ReviewLog and one Card transition. See [Phase 2 handoff](phase-2-handoff.md) for tested behavior and explicit deferred features.

- Vocabulary default: writing → reading **and** selected sense, one card/state. Either component wrong gives Again; both correct permits Hard/Good/Easy according to effort. Store component feedback without a second transition.
- Core kanji: meaning and fixed source-backed whole-word contextual reading, separate cards/states. Up to 764 core cards after evidence is complete, not 764 immediately active cards. Missing source context is a visible content gap. Incidental cards remain opt-in.
- Grammar default: one verified contextual cloze with persisted cues/accepted answers; formation card only for demonstrated recurring attachment errors.
- Review submission rechecks/locks current state and atomically writes Attempt, ReviewLog, Card/dueAt/stateVersion. Unique event ID returns the original result on retry; a new stale event conflicts. Preserve full configuration, library version, before/after state and prompt revision.
- Undo only the latest review using saved before-state when no later review exists. Objective changes require reviewed replacements; do not copy learned state silently.
- Due work precedes introductions. Initial caps: 5 vocabulary + 2 core-kanji cards + 1 grammar, 8 global. Bury siblings across study days without changing due dates. No mass activation from import or baseline assumptions.

## Assessment and reading

Scored targets must be approved and introduced before test start or learner-enabled baseline. Freeze selected revisions, seed, policy, order and timer; shortages yield redistribution/shorter tests, never unseen quota fillers. Results and assistance labels do not reschedule cards. See §§11–12, 18.

The dashboard derives counts from the review queue and existing item/source/session records. Progress counts unique introduced items against the verified imported core pool, not mastery or predicted JLPT scaled scores.

Reading uses stored Content/ContentItem annotations and UserItem saved contexts. Five approved aids: contextual word popup, grammar explanation, sentence translation, manual furigana, and word-context saving. Timed mode hides help and freezes allowed ruby settings until submission; its server deadline survives refresh/backgrounding. Validate exact surfaces, sentence revisions, half-open UTF-16 spans, and surrogate boundaries. Saving/lookups never activate or rate cards. Takoboto is encoded external navigation after an explicit click, with popup/new-tab fallback. See §20.

Grammar rationale/comparison displays use approved stored explanations; hide answers until commitment/submission. Missing comparisons are omitted, missing sentence-specific rationale falls back to labelled general guidance. No per-review AI request or comparison engine.

## Source and generation gates

Use PDF text first; OCR only unusable pages. Preserve raw evidence separately from proposed normalized fields. Human source comparison precedes approved import; null/flagged missing fields never become model guesses. The existing extraction templates require mapping, not blind insertion. Lesson questions are Content questions, separate from examples; absent verified answer keys exclude scored use.

Manual prompt export/draft import is the initial AI path. Track `manual-import` and unknown model identity honestly. Optional automated providers need verified free access; quota errors pause and never trigger paid fallback. Apply timeouts and at most two correction retries. Persist/reuse accepted content instead of regenerating per interaction.

Structural, referential, provenance, scope, question-validity and language-quality checks precede human publication. Registered lexical/phrase/construction mappings help validation; token presence cannot prove sense or grammar correctness. Zero baseline rows must work. Untracked support can receive passage-level approval without becoming a learned item; explicit unresolved problems remain drafts. See §§13–16.

## Private storage and recovery

Keep originals/OCR/import JSON/dumps in ignored `private-data/`. Source previews stay private; no raw pages in `public/`, Graphify, or engineering memory. Preserve original PDFs, approved JSON, and database history; test restoration before the personal release depends on them. Hosted previews would require durable private storage, deferred until needed.
