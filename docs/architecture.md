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
- Core kanji (A6): one objective per core kanji. The kanji is the prompt and choice options pair a hiragana reading with an English meaning. The earlier source-backed contextual-reading card is no longer created; `scripts/retire-kanji-reading-cards.mjs` retires existing ones (dry run by default) and keeps their logs. Incidental cards remain opt-in.
- Grammar default: one verified contextual cloze with persisted cues/accepted answers; formation card only for demonstrated recurring attachment errors.
- Scheduled recall choice (A4): vocabulary, core-kanji meaning and contextual-reading objectives may be answered as four options. Options pair real readings/meanings drawn from other approved source-verified items; a core-kanji meaning option is a hiragana reading plus an English meaning and its four options share one reading kind, so the answer is never identifiable by language or reading shape. The view exposes option text only (no `answerSpecJson`, `correctChoiceId` or `tier`) until commitment. The server stores the offered set in the Attempt prompt snapshot, grades the selected option objectively (`grader='objective'`), derives the same `readingCorrect`/`meaningCorrect` components, and caps `Easy` at `Good` while recording `requestedRating`/`effectiveRating`. Grammar cloze and pools with fewer than three safe decoys keep typed entry.
- Review submission rechecks/locks current state and atomically writes Attempt, ReviewLog, Card/dueAt/stateVersion. Unique event ID returns the original result on retry; a new stale event conflicts. Preserve full configuration, library version, before/after state and prompt revision.
- A new scheduled card is answered before its answer or study reference is shown (A5). The first commit performs the same activation as introduction (first-study record, sibling burying) inside the locked transaction and is the card's first FSRS event; reveal and rating follow. The stored study reference is an optional collapsed control after reveal. The retained `introduce` endpoint is compatibility only and is not required by the screen.
- Undo only the latest review using saved before-state when no later review exists. Objective changes require reviewed replacements; do not copy learned state silently.
- Daily recall (A6, `review/selection.mjs`): one queue per session from studied items only. Per-type daily caps (`settingsJson.dailyReviewCaps`, default 100 vocabulary / 40 kanji / 10 grammar) count distinct cards answered in the learner's study day. Within the remaining cap, up to 70% are first recalls of studied items (oldest study first) and at least 30% are due cards ordered by lowest ts-fsrs retrievability; unused share flows to the other tier. There are no activation allowances or backlog pause. Session selections stay immutable (snapshot `policyVersion` 2 adds `mode`): a card whose first review in the session is Again returns once at the end, derived from that session's review logs. Any card in the session's selection may be answered before its FSRS due time; "Review more" starts an explicit early-review session of up to 20 not-due cards, lowest retrievability first. Sibling burying until the next study day is unchanged and changes presentation only.

- Match practice (`practice/match.mjs`, `GET /api/practice/match`): read-only. It offers reviewed (active) vocabulary or core-kanji cards not due before the next study day and not pending in an open session, lowest retrievability first, six unique-meaning pairs per round. Grading and the best time stay in the browser; no Attempt, ReviewLog, Card, session or FSRS change is written.

## Assessment and reading

Phase 4 implements cumulative selection in `assessment/selection.mjs`, private reviewed bank intake in `assessment/bank.mjs`, and locked session/answer/timer/scoring transactions in `assessment/service.mjs`. `/weekly` uses the same-origin local `/api/assessment` route. The additive migration separates daily and scored-session uniqueness, freezes deadlines and committed responses, and leaves cards/review logs unchanged. The complete approved question/rubric revision is retained server-side in the selection; unfinished HTTP views omit answers/feedback. Timed reading begins on explicit presentation and uses frozen furigana Off. Later continuation is a separate assisted practice session. Phase 5's five interactive reading aids remain deferred. See [Phase 4 handoff](phase-4-handoff.md).

Phase 3 reuses the review due selector for the dashboard. StudySession active timing is separate from immutable selections and FSRS. Backs fetch bounded approved examples/comparisons only during introduction or after commitment, retaining pinned answers and source revisions. Published comparisons have database link/example checks. Attention updates reuse owned UserItem records; introduction updates preexisting unseen records without clearing flags. Local backup/export shares one PostgreSQL snapshot and restores only into a new distinct target. See [Phase 3 handoff](phase-3-handoff.md).

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
