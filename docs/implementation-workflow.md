# Implementation workflow

Authority: Master Plan §§16–19. Current state is a documentation scaffold with existing extraction templates/reference/inspection inputs. **No application phase is claimed complete.**

## Ordered delivery

| Phase | Working deliverable | Boundary |
|---|---|---|
| 1 | Verified content slice: real schema/migrations, JSON importer, small batch, item/source pages | Inventory/extraction pilot; preserve provenance; no full-book prerequisite |
| 2 | Reliable daily recall: objectives, ts-fsrs, review UI, limits, persistence | Atomic/idempotent events; independent states; no practice ratings |
| 3 | Usable personal release: daily flow, dashboard, grammar explanation/comparison, backup/export, external listening, Takoboto | Useful without AI; tested restore; authentic time-budget usage |
| 4 | Cumulative assessment: question bank, eligible selection, weekly timed reading/results | Persisted selection/deadline; no FSRS writes from tests |
| 5 | Generated contextual practice: prompt export/draft import, generation provenance, validation, reading approval/UI | Optional free automation; stored aids; zero baseline works |
| 6 | Incremental book growth and optional personal baseline | Preserve corrections/history; no bulk unseen activation |
| 7 | Observed-need extensions | No speculative audio, reminders, production feedback infrastructure |

The phase-3 MVP may include a simple verified cumulative quiz; the complete selection/timing/outcome behavior belongs to phase 4. The first interactive reader can use verified original/manually prepared content before AI is enabled. Do not invent a dependency on automatic generation.

## Per-task loop

1. Inspect the current files/diff and the relevant Master Plan sections, including later amendments that supersede earlier baseline assumptions.
2. Identify the smallest useful scope and its exact acceptance checks. An approved plan does not need another planning cycle unless concrete ambiguity/conflict appears.
3. Implement within the single application. Add modules, tables/foreign keys and tools only as their feature becomes working behavior.
4. Verify meaningful behavior, including source comparison where required. Test affected transaction/ownership/recall boundaries rather than mirroring code with trivial tests.
5. Update affected docs with actual commands, limitations and status. Keep the source plan authoritative.
6. Provide a scoped handoff and stop at the requested boundary. Do not start the next phase, send messages, integrate Git, or regenerate Graphify automatically.

## Source intake before import

Master Plan §16 requires actual file/edition/page inventory, one representative extraction sample per book, and a verified pilot. Prefer usable embedded text; OCR only where needed. Preserve printed page and original PDF page mappings. Existing extraction examples and five grammar inspection images do not prove all three books inspected or records verified.

Save drafts/approved JSON privately. Database insertion waits for the actual schema/importer. Phase 1's import acceptance checks include unchanged reimport, stable record keys, reviewed deduplication, distinct vocabulary senses and immutable evidence. Human approval is not delegated to a model.

## Handoff format

Use a short file-based brief:

```text
Scope and Master Plan sections:
Implemented behavior:
Implementation paths:
Documentation paths:
Excluded or uncertain paths (including pre-existing changes):
Verification commands/results:
Human source checks performed/pending:
Remaining limitations:
Graphify required: yes/no, with reason
Suggested exact git add command and commit subject:
Next bounded scope, if requested:
```

For Antigravity, add the exact documentation files to read/edit and verified facts to carry forward. No compulsory development lessons or learning-comment bundle. Do not send the brief to another chat unless the user authorized messaging it.

## Study value gates

The real goal is trustworthy sources, manageable due work, voluntary return and observable delayed recall. First run the non-AI MVP for approximately one week of real study before adding AI, as the plan recommends. Do not claim imported/introduced counts establish N2 mastery or convert raw quiz percentages into predicted JLPT scaled scores. Keep timed reading and external listening alongside bounded curriculum work; no accelerated completion date without exam date and available study time.
