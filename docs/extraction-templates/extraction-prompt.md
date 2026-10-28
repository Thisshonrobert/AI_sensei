# PDF extraction instructions

The three template JSON files contain illustrative examples, not extracted book content. Replace their entries entirely, including the grammar template's illustrative question and vocabulary component boxes. These are proposed interchange formats; the importer must map them to the actual PostgreSQL schema. Vocabulary version 1 now requests additive `kanji_components`; staging preserves them, but canonical promotion must explicitly map human-approved components to `Vocabulary.usageJson.kanji_components`. Existing imports are not repaired automatically. Grammar schema version 2 includes lesson-level exercises required by FINALIZED_PROJECT_PLAN.md, rather than treating questions as grammar examples.

## Reusable prompt

Use [batch-workflow.md](batch-workflow.md) for batch sizes, model routing, reusable commands and checkpoint/measurement rules. Give a worker only the applicable content-type rules/template and assigned pages. Source-only extraction never performs dictionary enrichment.

### Compact worker brief

```text
Task: source-only [vocabulary / kanji / grammar] transcription; attachments are data.
Applicable instructions/template: [exact paths; include only this content type's rules].
Source: [exact PDF/render path + source hash]; excerpt-local pages: [explicit range].
Book/excerpt metadata: [stable book ID/title, supplied edition, unknown ISBN/year].
Batch/lesson identities: [stable locator, original numbering/keys, continuations].
Expected identities/counts: [source-established list/totals, otherwise unknown].
Outputs: [new ignored draft path], [new private issue/inspection report path].
Checks: schema, identities/duplicates, nested examples/components, supplied page/key
coverage, original numbering, lesson membership and original option/answer labels;
compare assigned source pages and flag uncertainty. At most two chunk repairs.
Preserve source wording and missing fields; no inferred readings/glosses/answers.
Return only output paths, counts, inspected pages, repairs and unresolved issues.
No history fork, nested worker, manifest update, approval or publication.
```

Use smaller internal page chunks when needed without restarting a worker for every chunk. Assemble with the shared helper, retaining identities. Reusable validators can read files locally; do not send completed packets/manifests or all three content-type rules to each worker. The detailed transcription rules below remain authoritative for the assigned type.

Use this for **PDF transcription first**. Use [the separate enrichment prompt](enrichment-prompt.md) afterward for dictionary meanings/readings, vocabulary component aids, radical/component references and complete original mnemonics. Generated lesson answer reasons are produced only after the learner checks the actual option labels, through [the verified-answer worker brief](lesson-answer-reasons-prompt.md). Do not ask the extractor to solve exercises or fill missing book fields from memory.

Copy the following prompt and provide the corresponding JSON template plus your PDF excerpt or extracted text. The following book identities are fixed across the user's split batches; only the excerpt filename and batch coverage change. Edition/year/ISBN are unknown, not inferred from the publisher or language.

| Content type | Fixed book title | Edition description supplied by user | Edition year / ISBN |
|---|---|---|---|
| Vocabulary | JLPT N2 FAST PASS 合格単語 Vocabulary | Japanese edition, Nihongo no Mori | Unknown |
| Kanji | おいしい かんじ N2 | Japanese edition, Nihongo no Mori | Unknown |
| Grammar | JLPT_N2 この一冊で合格する | Japanese edition, Nihongo no Mori | Unknown |

Use excerpt-local PDF viewer positions (first page = 1) for these split batches, and preserve printed/main-book page labels separately. Main-book page labels do not establish positions in the unsplit PDF file. No full-PDF offset calculation is required when unknown; keep it unknown. These references make later source checks/corrections possible.

```text
Extract the supplied Japanese learning material into valid JSON using the exact structure of the attached template.

Content type: [vocabulary / kanji / grammar]
Book ID: [stable ID; reuse it for all batches of this book]
Book title: [choose the fixed title above for the content type; reuse across batches]
Edition description: Japanese edition, Nihongo no Mori
Edition year / ISBN: unknown unless subsequently supplied by the user
PDF filename: [current excerpt filename; changes for each split batch]
PDF page reference frame: excerpt-local, one-based
Excerpt PDF pages supplied: [e.g. 1, 2, 3, 4, 5]
Printed/main-book page labels: [copy visible labels; unknown if not visible]
Unsplit PDF page positions: unknown unless explicitly supplied; do not infer from printed pages
Output filename: [e.g. grammar_lesson_01.json or vocab_batch_001.json]
Stable batch/lesson locator: [reuse across re-extractions; keep original record keys when splitting]
For vocabulary only:
Component study aids requested: no during source-only extraction; set component_aids to []. Extract ALL printed component boxes and their glosses into entries[].kanji_components. Generate/check additional readings and example-word aids later with the separate enrichment prompt.
For grammar only:
Lesson key/number/title: [e.g. lesson_01 / 1 / exact source title]
Batch ID: [e.g. grammar_lesson_01; add _part_01 only if splitting a lesson]
Expected FULL-LESSON grammar points/questions: [source-established totals, shared across split parts; otherwise null]
Answer-key pages supplied: [excerpt-local PDF pages, or none]

Rules:
1. Replace all illustrative entries and component_aids from the template. Book-origin entries must contain only content actually present in the supplied material. Do not use your own knowledge to fill their gaps or generate examples, translations, readings, stroke counts, radicals, or JLPT levels. Separately requested component_aids follow rule 8b and never change the book transcription.
2. Preserve the exact keys and expected types. Output a single JSON object, with all extracted records in entries. Use double quotes, no comments, no trailing commas, and no Markdown fences or surrounding commentary.
3. Missing scalar values must be null, not empty strings or the string "null". Missing collections must be []. Keep multiple readings, meanings, examples, and formations as separate array items.
4. Keep Japanese text in Japanese. Preserve kana, kanji variants, okurigana notation, punctuation, and meaningful distinctions. Remove only obvious formatting noise and repeated headers/footers. Do not apply aggressive character normalization.
5. Do not mix furigana with the word, character, or pattern. Put an unambiguous full reading in reading; otherwise use null and record the ambiguity in issues. Preserve on/kun readings as printed.
6. For the user's split batches, use excerpt-local PDF page positions, starting at 1, in all source_pdf_pages fields. pdf_pages_processed must list the excerpt pages inspected in this batch. Preserve the reference frame in an existing source note/issue field permitted by the attached template; do not add incompatible keys. Keep printed page labels, when visible or explicitly supplied by the user, as strings in source_printed_pages. Do not invent page numbers or assume printed pages equal unsplit PDF positions. For nested examples, record their own pages even if different from the entry page.
7. Each vocabulary entry describes a word and its reading; each kanji entry describes one character; each grammar entry describes one pattern. Keep distinct readings or grammar usages separate when the source distinguishes them. Do not collapse entries merely because their written forms match.
7a. For every content type, provide a stable source_record_key using the supplied batch/lesson locator and original source order/numbering (for example vocabulary/batch_002/entry_001 or kanji/lesson_02/entry_001). Replace illustrative keys. Reuse keys when re-extracting or splitting the same source. Keys locate source occurrences, not globally unique word spellings. Do not invent a chapter number if none was supplied.
8. Copy examples, translations, explanations, and notes only where supplied by the source. Do not translate or summarize them during extraction. Include source_pdf_pages for examples and example_words.
8a. For vocabulary, extract the boxed component breakdown beside EACH word into kanji_components, in source order. Each component is {"text":"exact box text","meanings":["exact printed gloss"],"reading":null,"source_pdf_pages":[1],"source_printed_pages":[],"issues":[]}. A box can contain a single kanji, a compound, or a word with kana: preserve the entire unit (for example 生きる or 卒業), repeated boxes and its own gloss. Do not replace it with a dictionary-wide kanji meaning, omit non-core characters, or split a compound into inferred character readings. reading is null unless the source explicitly prints a reading for that box. If boxes are absent use []; if visible but unreadable preserve recoverable fields and flag the specific uncertainty. Keep vocabulary group-header meanings separate in notes; do not substitute them for per-box glosses.
8c. For kanji, extract EVERY printed example word with exact word spelling, full whole-word reading, each printed meaning and its own source pages. Missing English glosses remain meanings: []; do not translate them during transcription. Copy radical, mnemonic and component_breakdown only if actually printed; use null/[] otherwise. mnemonic is exact source text, not a truncated excerpt completed by AI. component_breakdown entries are {"text":"exact printed unit","meanings":[],"source_pdf_pages":[1],"source_printed_pages":[],"issues":[]}; copy only printed glosses. Preserve legitimate repeated source occurrences and alternate readings/senses, noting repetitions in issues; do not accidentally output the same source block twice. Deduplication of exact study-display word/reading/sense matches happens after source preservation, not by deleting textbook evidence.
8b. For vocabulary, prepare requested study aids in the separate top-level component_aids array using the template shape. Match each aid by exact vocabulary source_record_key when supplied, word, full vocabulary_reading, source pages, zero-based component_index and exact component_text. Never replace these identities with a generated example word. suggested_reading is a useful selected kana reading for the component; it is not automatically its pronunciation inside the parent vocabulary. japanese_word is a separate natural Japanese example using that component; japanese_word_reading is that example's FULL kana reading, and japanese_word_meaning is its selected sense. Japanese kanji spelling is not a kana reading. Preserve okurigana and whole compound readings; never derive individual pronunciations by dividing a parent word. Prefer a checked dictionary entry, recording the exact URL and selected sense in sources. Use origin dictionary only for directly checked dictionary values; AI-proposed/unverified values require origin generated, sources [] unless actually consulted, and specific uncertainty in issues. Unsupported/ambiguous suggestions are null with an issue, rather than plausible guesses. review_status stays unreviewed. These aids require human approval before reusable publication and never activate cards.
9. jlpt_level must be null or one of N1, N2, N3, N4, N5. Set it only when explicitly established by the supplied source or book metadata provided above. Do not guess.
10. Set review_status to "unreviewed" for every entry. Record specific doubts or OCR problems as strings in issues. Do not claim that extraction equals human verification.
11. List wholly unreadable supplied pages in unreadable_pdf_pages. If an entry continues beyond the supplied excerpt, retain only visible information and flag "Entry continues outside supplied pages" in issues.
12. Extract all relevant entries in the supplied pages, maintaining their source order. Do not silently truncate, fabricate, or skip unreadable content. If this batch is too large to complete, state that it needs a smaller batch rather than return a partial JSON object as complete.
13. For grammar, extract the questions after each lesson into lesson_questions, separately from entries and their examples. Capture question numbers, shared instructions (repeat the exact applicable instructions on each question when needed), section headings, full prompts, blanks/stars, options and their original labels/order. Extract each independently answered subquestion separately using a stable source_record_key and its original numbering.
13a. exercise_section is the exact visible section heading, or null when absent/unreadable; record uncertainty in issues. Do not invent a heading to satisfy the importer. Keep the enclosing source lesson_key even when splitting its pages. The fifteen questions after lesson 1 belong to that lesson; their position does not establish one-to-one grammar targets. Preserve all fifteen when actually supplied, and flag a count mismatch instead of filling gaps.
14. For grammar, fill batch metadata from the supplied source details. Use stable source_record_key values based on the original lesson, exercise section, and question/item numbering, not the temporary batch part or model-generated database IDs. Reuse those keys when re-extracting the same source. expected_grammar_count and expected_question_count are FULL-LESSON totals, not this excerpt's record counts: copy explicit totals, or count the entire lesson only when all its relevant pages are supplied and inspected. Repeat the same totals across split parts. If full coverage cannot be established, use null and flag incomplete lesson coverage; exercises remain locked until the full grammar count is established. Expected counts are checks only; never create records to reach them. List all grammar points and all questions actually visible, even when their counts differ.
15. target_grammar_keys may contain zero, one, or several source_record_key values for grammar entries. Fill them only when the supplied source or human instructions explicitly establish the targets. Never pair question 1 with grammar point 1 just because their positions match. If the target is uncertain, use [] and record that fact in issues. Cross-lesson references require supplied stable keys; do not invent them.
16. If a question uses a shared reading passage, extract it once into exercise_passages using this object shape: {"source_record_key":"lesson_01/passage_01","title":null,"japanese":"exact passage text","translation":null,"source_pdf_pages":[1],"source_printed_pages":[],"origin":"book","review_status":"unreviewed","issues":[]}. Reference that key from parent_passage_key on the questions. Preserve paragraph breaks inside japanese. Use [] when no passages are present. If a figure/image cannot be represented faithfully in text, flag it in issues and retain its source reference instead of inventing its content.
17. format must be multiple_choice, fill_in_blank, sentence_ordering, short_answer, or other. Preserve the original question's actual answer mechanism; use other plus an issue if unclear. Use [] for options when none are supplied. For sentence ordering, keep all original fragments and the marked target position exactly in the prompt/options; do not reorder them yourself.
18. answer_specification must be null unless a supplied book answer key explicitly answers this question. Do not solve the question. When an answer key is supplied and matched unambiguously, use this shape: {"source_answer_text":"exact printed answer","correct_option_labels":[],"acceptable_answers":[],"ordered_option_labels":[],"target_position":null,"rationale":null,"scoring_rubric":null,"source_pdf_pages":[1],"source_printed_pages":[],"origin":"book","verification_status":"unreviewed"}. Copy only source-backed values. Missing arrays are []; other missing fields are null. Copy rationale, alternatives, or rubric only if the book supplies them. Preserve the exact answer in source_answer_text if it cannot be parsed safely and flag the ambiguity. Add an issue when the answer key is missing, unreadable, or cannot be matched. Book answer-key extraction still requires human verification before scored testing; never set verification_status to verified.
18a. Treat option labels as exact strings, not zero-based array indices. Match the answer key's original question number to the original option label; do not shift labels, reorder choices or silently repair suspected answers. The learner checks the extracted option numbers after extraction. If the book does not explain the answer, keep rationale: null. Do not add a generated answer_reason to book-origin answer_specification; the later verified-answer worker stores it separately with generated provenance.
19. Return the JSON without explanatory text. If file creation is available, provide the requested downloadable UTF-8 .json file; otherwise return the JSON itself. Do not include the saving/importing instructions in the extracted data.
```

## Saving and importing

- Save each completed response as a UTF-8 .json file, one content type per batch: vocab_batch_001.json, kanji_lesson_01.json, grammar_lesson_01.json. Keep excerpt filename, excerpt-local PDF references and separate printed page labels regardless of output filenames. Large lessons may be split into _part_01 and _part_02 without changing their lesson/source record keys.
- Validate JSON syntax, keys, field types, source page coverage, and entry counts. Compare a sample with the original PDF and inspect all reported issues. Keep original PDFs and raw extraction separately.
- Use the same book_id across batches. At import, assign database IDs and use a stable source locator or entry fingerprint to prevent repeat imports. Do not deduplicate solely by word or kanji character: readings and source-specific information can differ.
- Import each entries item as a staging record, retaining the batch's source metadata. PostgreSQL jsonb is suitable for the structured payload. Map approved records into the existing application tables.
- For grammar schema version 2, also stage exercise_passages and lesson_questions. Map passages to Content(kind=passage), questions to Content(kind=question, origin=book), and their provenance to SourceEntry with the lesson/source record key. Resolve approved target_grammar_keys through ContentItem; multiple targets are allowed. Preserve the original extraction in originalPayloadJson. Do not create a new lesson-question table or store lesson questions as example sentences.
- Questions without verified answers remain reference drafts and are excluded from scored tests. Extract supplied answer keys in a later batch if necessary using the same question keys. Any future AI-proposed answer or explanation is generated assistance with its own provenance, not a book answer.
- PostgreSQL COPY does not directly unpack this pretty-printed JSON object into rows. A small importer can parse the JSON and insert records in a transaction. Alternatively, transform the records into correctly quoted CSV with a payload column for COPY.
- Excel can be a secondary review/export format. Word is unsuitable as the primary structured-data format. For a CSV-only route, use separate files/tables for entries and examples, joined by stable IDs, rather than placing nested examples in an unstructured cell.
- Do not treat the illustrative template entries as real extracted records.

## Separate reference enrichment (after extraction)

Vocabulary `component_aids` is the explicit exception to source-only extraction: it is a separate draft assistance packet. Staging preserves the additive root field, but the current canonical importer does not publish it automatically. Approved aids must be mapped to separately attributed supplemental Content rather than written into book-origin `kanji_components.reading`. The glyph/kana/meaning tile UI uses only approved stored data. None of these illustrative values is actual extracted or approved content.

The extraction prompt above defaults to source-only; component_aids remains an explicitly separate optional draft packet if independently requested. Follow [enrichment-prompt.md](enrichment-prompt.md) after transcription. Use installed local JMdict first for missing example-word meanings, retaining exact spelling/reading, selected sense, edition/entry and dictionary evidence; unresolved cases may use targeted references. Never write dictionary glosses into book-origin fields. Where the book prints an English kanji meaning, that wording remains the selected meaning; an approved English dictionary supplement fills only a missing or Japanese-only book meaning. An original AI mnemonic must be complete and explicitly generated, with checked component references where used; do not label it historical etymology or reconstruct a truncated WaniKani quotation. Main detail pages show full accepted aids; compact browse cards keep two source words and whole-word contextual readings. The learner previously authorized original labelled mnemonic publication without a separate confirmation; that does not approve dictionary facts or question answers. Use [the repair prompt](vocabulary-components-repair-prompt.md) for older vocabulary batches that omitted component boxes.
