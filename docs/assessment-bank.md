# Reviewed assessment bank

Authority: Master Plan §§4, 11–13, 18. `/weekly` consumes only approved, current question revisions with checked answers, targets and supporting language. The existing 15 reference questions remain draft. Engineering fixtures are synthetic and never become real study content.

For book questions, retain the canonical importer's source/record/hash approval workflow. The assessment metadata described below must be preserved in the reviewed question payload; passage questions use `parentContentId` and the same `passageId`. Do not convert a source question to user origin to bypass its evidence gate.

For original manually prepared questions, create a private JSON file under `private-data/`. `assessment:bank` records **user** authorship and an exact hash/reviewer receipt; it does not claim book or generated provenance. Review every answer, target sense/reading, distractor and essential supporting construction before publication. Untracked support can be approved at passage/question level without inventing baseline items. No parser/AI/provider is involved.

## File contract

Top level: `{ "version": 1, "passages": [], "questions": [...] }`, at most 20 passages and 500 questions. Assign fresh UUIDs for content; use existing approved canonical Item UUIDs for links. The same unchanged file/reviewer is a no-op. Changed existing content is refused. Book corrections retain the canonical importer's reviewed revision workflow; this user-authored intake creates revision 1 only. A checked replacement may be published with a fresh ID while the reported original stays blocked and its history remains intact. A general user-authored revision editor remains deferred. No mutable question editor is added.

Each question includes:

| Field | Requirement |
|---|---|
| `id` | Fresh content UUID |
| `domain` | `vocabulary`, `kanji`, `grammar`, or `reading` |
| `objective` | `vocab_reading_meaning`, `kanji_meaning`, `kanji_reading_context`, `grammar_cloze`, `grammar_formation`, or `comprehension`, matching the domain |
| `primaryTargetItemId`, `targetIds` | Approved canonical IDs; primary must be in the nonempty target list |
| `supportingItemIds` | Approved registered support IDs, or empty when support is untracked and manually reviewed |
| `exposesItemIds` | Explicit canonical IDs whose answers this wording/support reveals; checked by the reviewer to prevent cross-question cueing |
| `prompt`, `format`, `options` | Nonempty checked prompt; `multiple_choice`, `fill_in_blank`, or `short_answer`; options are `{label,text}` records, empty for an open answer |
| `supportingReviewed`, `unresolved` | Exactly `true` and `false`; these assertions must reflect human review |
| `rubric` | `{mode, expectedAnswer, explanation, acceptableAnswers}`; mode `choice`, `reading`, or `self` |
| `passageId` | Required only for reading; references a passage in the same private file |

Choice rubrics need at least two uniquely labelled options and accepted labels from those options. Reading-rule grading is only for the whole-word contextual kanji objective; it normalizes kana/width/whitespace without erasing long-vowel distinctions. Combined vocabulary uses self scoring of **both reading and selected meaning**, with a checked rubric allowing equivalent English paraphrases. Grammar/open-response equivalence can use self scoring. Unknown or ambiguous answers stay ungraded; reporting a flawed question preserves the original grade as evidence, removes it from unaided scoring, and blocks future reuse until a reviewed correction.

Each passage includes `id`, `title`, `japanese`, `targetIds`, `supportingItemIds`, `exposesItemIds`, `supportingReviewed: true`, and `unresolved: false`. It needs at least two reviewed questions with distinct directly assessed targets. Passage targets constrain eligibility without counting their repeated mentions as extra questions. The timed pilot stores original Japanese text with furigana Off; interactive annotations, translations, saved contexts and generation remain Phase 5 work.

## Commands

```powershell
rtk proxy bun.cmd run assessment:bank preview --file private-data/<reviewed-bank>.json
rtk proxy bun.cmd run assessment:bank publish --file private-data/<reviewed-bank>.json --confirm <exact-preview-hash> --reviewer <human-reviewer>
```

Replace the placeholders after reviewing the private file. Preview emits only counts/hash and performs no database writes. Publication uses the active database target, validates every linked canonical item and writes content/links atomically. It creates no UserItem, Card, ReviewLog or learner introduction. A question can be approved before its target is introduced; eligibility is checked separately when a test starts. Do not run publication just because a JSON file passes its schema.

Selection is bounded to 2,000 eligible targets and 1,000 approved questions, with a visible ceiling notice when reached. Weakness uses attention or primary-target failures in the previous 30 days; recent introductions use seven calendar days. Seeded strata use largest-remainder allocation and weak/recent/older/baseline tie order. Due status and card existence do not gate eligibility. Availability, shortages and format coverage are separate from accuracy.
