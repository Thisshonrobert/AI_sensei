# Phase 3 — personal release design proposal

Authority: [Master Plan](../../FINALIZED_PROJECT_PLAN.md) §§3–10, 17–20 and A1/A2. The user requested Phase 3 on 6 October 2026 after completing Phase 2 documentation and Graphify. This proposal applies that scope; it does not amend the Master Plan.

Status: design approved by the user on 6 October 2026; implementation and automated/recovery verification finished. Phase 3 acceptance awaits the learner-paced session below. See [implementation handoff](../phase-3-handoff.md) for actual evidence and scoped manual staging. Git mutations remain manual.

## Design direction

Extend the established notebook interface: warm paper, dark ink, restrained green controls, red evidence accents and locally available Mincho Japanese text. Keep ordinary text selection, visible keyboard focus, large touch targets and natural Japanese wrapping. No new dependencies, downloaded brand assets, remote fonts or required animation.

Use [Quizlet's documented flashcard interactions](https://help.quizlet.com/hc/en-us/articles/360030988091-Studying-with-Flashcards) as a functional reference. Its explicit reveal and simple progression inform the hierarchy; the application's response commitment and FSRS rules remain authoritative. No copied Quizlet branding, UI, assets or exact design. UI/UX Pro and Taste are requested frontend skills but were not found in the available catalog or local skill directories. Use available frontend-design and Impeccable guidance without changing backend architecture or functionality to suit a skill.

The recommended approach extends existing routes, components and server modules. A separate flashcard subsystem would duplicate the tested recall service; a whole-app redesign would expand scope without improving the phase gate.

## Dashboard and daily flow

The home page prioritizes a single Start/Resume reviews action with the count of the eligible queue it actually opens. A smaller Continue learning action follows it, with remaining daily allowances and an explicit backlog pause state. Distinguish all due cards, currently eligible cards, sibling-buried cards, deferred selections and missing approved content. A paused session resumes its persisted selection and committed response.

Show an approximate review duration as an estimate, never as a scheduler guarantee. Support an editable daily time budget using existing settings/session fields; retain 20 minutes for review and 30 minutes overall as initial defaults. Offer an unobtrusive stopping point rather than silently completing cards or changing due dates. Stop/save summarizes saved recalls, remaining due work and any existing repair suggestion. Time spent should exclude stopped periods and survive resume; it must not reset daily card allowances.

Secondary progress uses unique introduced Items divided by the imported core pool for vocabulary, core kanji and grammar. One kanji counts once even if both objectives exist. Reference-only context vocabulary and incidental kanji are not imported core progress. Imported totals, introductions and recall evidence are labelled separately; do not call introductions mastery.

Reference browsing and external listening are secondary links. Reading and tests remain deferred to their phases; no fake active destinations. The listening link uses the Master Plan's Japanesetest4you destination. Opening it is navigation, not proof of listening completion.

## Flashcard interaction and original-example study

One dominant card carries an objective label, large Japanese prompt, fixed cue, response fields and an explicit Commit response and reveal action. New cards retain Study first → Hide and recall. The vocabulary front requires both reading and selected meaning; kanji fronts retain their independent meaning or fixed whole-word contextual-reading task.

After commitment, the card back shows the stored answer beside the committed response, then self-assessment and Again/Hard/Good/Easy with short effort descriptions. Either vocabulary component failing forces Again. Save completion before presenting the next card. Native form submission and buttons provide keyboard operation without global shortcuts that interfere with Japanese input. Answers must be absent from unrevealed HTML, response payloads, tooltips and accessibility labels.

Below the answer, show bounded approved original examples and separately labelled approved supplements with source links. Kanji backs include stored readings and additional source-backed word contexts when available. These are supplementary material; never rotate the scheduled prompt or infer success for related objectives. Missing examples/readings remain explicit. Opening a detail or explanation does not activate or rate cards.

## Grammar reveal and comparisons

Grammar reveal displays the fixed answer, formation, accepted alternatives and approved sentence-specific rationale. If no rationale exists, label the sourced rule General guidance. Use existing Grammar fields and Content(kind=explanation), with origin/citations visible.

Curated comparisons use approved explanation content linked to both grammar Items. They show a checked distinction and one approved example per pattern, two columns on desktop and stacked on mobile. Access from either item; omit draft, malformed, missing or superseded comparisons. Prioritize already introduced patterns without treating a view as introduction. No comparison table, engine, parser or automatic content authoring.

The existing real grammar questions remain blocked: the Phase 2 handoff records 15 deferred questions and ten unavailable grammar objectives. Do not infer answers, targets or approval from the request to implement Phase 3. Test the UI with synthetic approved fixtures; report unavailable real content separately.

## Dictionary and attention

A small corner dictionary control opens an editable lookup panel, clear of mobile actions. Explicit opening captures selected text; selection alone causes no navigation. Retain editing and ordinary text selection. Escape/close restores focus.

An explicit Takoboto action encodes the query in https://takoboto.jp/?q=, opens a reusable named popup on desktop with a new-tab fallback, and uses a new tab on mobile. Preserve session and scroll position. Do not scrape, embed, proxy or automatically fetch results. During unrevealed recall, keep lookup unavailable so dictionary help cannot contaminate unaided recall.

Mark unfamiliar is available only for a resolved canonical Item and sets its owned UserItem.needsAttention flag. It never creates/activates a Card, changes familiarity or writes a ReviewLog. Unmatched selections offer lookup and existing import guidance without creating canonical content. The Phase 5 reader and saved sentence-context controls remain deferred.

## Backup/export and recovery

Provide a local Node CLI around the existing Docker/PostgreSQL setup for a complete database backup, private manifest and learner-history export. Defaults write under ignored private-data/backups; credentials and learner payloads are never printed. A database backup is the recovery artifact; an export is separately labelled and must not imply restorability. Original book/OCR files remain private and require separate file preservation.

Restore only into a newly created distinct localhost database. Refuse the configured study database or an existing/nonempty target. Never reset the real database, remove a volume or overwrite history. Run a real backup/restore of the study database into an isolated target, verifying migrations, canonical/source relationships, card objective/state data and history without exposing contents. Since the Phase 2 study database had no attempts or reviews, also restore an isolated synthetic database containing committed responses and ReviewLogs to establish nonempty history recovery.

Document exercised commands and actual restore evidence only after they run. Keep manifests, dumps, exports and restored private records out of Git, Graphify, browser payloads and screenshots.

## Implementation boundaries

- Extend src/app/page.tsx and src/app/globals.css for dashboard/visual hierarchy; preserve reference pages.
- Extend src/components/review.tsx, src/lib/server/review/service.mjs and its declarations for bounded back content, daily summary and session-time behavior. Reuse queue eligibility; do not build a second selector.
- Extend src/lib/server/content/catalog.ts and existing grammar detail rendering for bounded approved comparisons. Add a small shared study-content component only if both detail and back views need it.
- Add a dictionary panel and one server route/module for validated owned attention updates, following the existing same-origin localhost checks. Keep review mutations at /api/review.
- Add a local backup/export runner under scripts/ and meaningful restore checks using the existing isolated PostgreSQL runner conventions. Reuse installed packages and Node built-ins.
- Change schema only if an existing field cannot represent required durable daily timing; identify the exact gap before adding an additive migration. No changes to persisted scheduled objectives or scheduler configuration.
- Update affected status docs and add a recovery runbook and Phase 3 handoff after implementation verification.

## Acceptance checklist

- [x] Dashboard count/action matches the actual queue, including paused, empty, buried/deferred, backlog and unavailable-content states.
- [x] Unique introduced/core-pool progress counts a two-card kanji once and excludes reference-only/incidental records.
- [x] Original-example study and reveal have bounded approved content and visible provenance, with no answer leakage.
- [x] Grammar formation/rationale fallback, both-sided approved comparison access, responsive layout and unchanged scheduling/familiarity pass synthetic checks; real grammar approval remains explicit.
- [x] Selected text prefills editable lookup; encoded click/popup fallback, mobile new tab, close/focus restoration and scroll/session preservation work. Attention updates cannot create or rate cards.
- [ ] Realistic 25–35-minute daily flow and 5–10-minute review-only stop/resume are exercised. Automated synthetic timing establishes persistence but does not substitute for actual learner-paced acceptance.
- [x] Global/per-type ceilings and cross-day sibling separation pass across sessions, restart and local timezone boundaries; daily timing cannot bypass limits.
- [x] Complete real backup restores safely into a separate target; a nonempty synthetic history also round-trips. Export is checked independently.
- [x] Stored review works with external network blocked and zero AI calls. Listening/lookup remain optional explicit external navigation.
- [x] Required unit, isolated PostgreSQL, reference/review browser, lint, typecheck and build commands actually run. Desktop/mobile, keyboard, Japanese input and error/loading states are inspected.

Use rtk-prefixed Bun script commands, with Node for runtime/database/import work. If the local PowerShell Bun wrapper remains blocked, use the already documented rtk proxy bun.cmd run convention. No Git mutations are authorized.

## Implementation handoff

Preparation was committed/pushed by the user before implementation. The [Phase 3 handoff](../phase-3-handoff.md) now contains the exact implementation/documentation bundle, exclusions, real verification results, recovery evidence and suggested commit subject. Graphify required: yes after integration and confirmation of clean, up-to-date source; no refresh against uncommitted implementation.
