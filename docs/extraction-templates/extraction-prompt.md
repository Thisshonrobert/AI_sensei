# PDF extraction instructions

The three template JSON files contain illustrative examples, not extracted book content. Replace their entries entirely, including the grammar template's illustrative question. These are proposed interchange formats; the importer must map them to the actual PostgreSQL schema. Grammar schema version 2 includes lesson-level exercises required by FINALIZED_PROJECT_PLAN.md, rather than treating questions as grammar examples.

## Reusable prompt

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
For grammar only:
Lesson key/number/title: [e.g. lesson_01 / 1 / exact source title]
Batch ID: [e.g. grammar_lesson_01; add _part_01 only if splitting a lesson]
Expected grammar points/questions: [counts if known; otherwise null]
Answer-key pages supplied: [excerpt-local PDF pages, or none]

Rules:
1. Replace all illustrative entries from the template. Extract only content actually present in the supplied material. Do not use your own knowledge to fill gaps or generate examples, translations, readings, stroke counts, radicals, or JLPT levels.
2. Preserve the exact keys and expected types. Output a single JSON object, with all extracted records in entries. Use double quotes, no comments, no trailing commas, and no Markdown fences or surrounding commentary.
3. Missing scalar values must be null, not empty strings or the string "null". Missing collections must be []. Keep multiple readings, meanings, examples, and formations as separate array items.
4. Keep Japanese text in Japanese. Preserve kana, kanji variants, okurigana notation, punctuation, and meaningful distinctions. Remove only obvious formatting noise and repeated headers/footers. Do not apply aggressive character normalization.
5. Do not mix furigana with the word, character, or pattern. Put an unambiguous full reading in reading; otherwise use null and record the ambiguity in issues. Preserve on/kun readings as printed.
6. For the user's split batches, use excerpt-local PDF page positions, starting at 1, in all source_pdf_pages fields. pdf_pages_processed must list the excerpt pages inspected in this batch. Preserve the reference frame in an existing source note/issue field permitted by the attached template; do not add incompatible keys. Keep printed page labels, when visible or explicitly supplied by the user, as strings in source_printed_pages. Do not invent page numbers or assume printed pages equal unsplit PDF positions. For nested examples, record their own pages even if different from the entry page.
7. Each vocabulary entry describes a word and its reading; each kanji entry describes one character; each grammar entry describes one pattern. Keep distinct readings or grammar usages separate when the source distinguishes them. Do not collapse entries merely because their written forms match.
8. Copy examples, translations, explanations, and notes only where supplied by the source. Do not translate or summarize them during extraction. Include source_pdf_pages for examples and example_words.
9. jlpt_level must be null or one of N1, N2, N3, N4, N5. Set it only when explicitly established by the supplied source or book metadata provided above. Do not guess.
10. Set review_status to "unreviewed" for every entry. Record specific doubts or OCR problems as strings in issues. Do not claim that extraction equals human verification.
11. List wholly unreadable supplied pages in unreadable_pdf_pages. If an entry continues beyond the supplied excerpt, retain only visible information and flag "Entry continues outside supplied pages" in issues.
12. Extract all relevant entries in the supplied pages, maintaining their source order. Do not silently truncate, fabricate, or skip unreadable content. If this batch is too large to complete, state that it needs a smaller batch rather than return a partial JSON object as complete.
13. For grammar, extract the questions after each lesson into lesson_questions, separately from entries and their examples. Capture question numbers, shared instructions (repeat the exact applicable instructions on each question when needed), section headings, full prompts, blanks/stars, options and their original labels/order. Extract each independently answered subquestion separately using a stable source_record_key and its original numbering.
14. For grammar, fill batch metadata from the supplied source details. Use stable source_record_key values based on the original lesson, exercise section, and question/item numbering, not the temporary batch part or model-generated database IDs. Reuse those keys when re-extracting the same source. Expected counts are checks only; never create records to reach them. List all grammar points and all questions actually visible, even when their counts differ.
15. target_grammar_keys may contain zero, one, or several source_record_key values for grammar entries. Fill them only when the supplied source or human instructions explicitly establish the targets. Never pair question 1 with grammar point 1 just because their positions match. If the target is uncertain, use [] and record that fact in issues. Cross-lesson references require supplied stable keys; do not invent them.
16. If a question uses a shared reading passage, extract it once into exercise_passages using this object shape: {"source_record_key":"lesson_01/passage_01","title":null,"japanese":"exact passage text","translation":null,"source_pdf_pages":[1],"source_printed_pages":[],"origin":"book","review_status":"unreviewed","issues":[]}. Reference that key from parent_passage_key on the questions. Preserve paragraph breaks inside japanese. Use [] when no passages are present. If a figure/image cannot be represented faithfully in text, flag it in issues and retain its source reference instead of inventing its content.
17. format must be multiple_choice, fill_in_blank, sentence_ordering, short_answer, or other. Preserve the original question's actual answer mechanism; use other plus an issue if unclear. Use [] for options when none are supplied. For sentence ordering, keep all original fragments and the marked target position exactly in the prompt/options; do not reorder them yourself.
18. answer_specification must be null unless a supplied book answer key explicitly answers this question. Do not solve the question. When an answer key is supplied and matched unambiguously, use this shape: {"source_answer_text":"exact printed answer","correct_option_labels":[],"acceptable_answers":[],"ordered_option_labels":[],"target_position":null,"rationale":null,"scoring_rubric":null,"source_pdf_pages":[1],"source_printed_pages":[],"origin":"book","verification_status":"unreviewed"}. Copy only source-backed values. Missing arrays are []; other missing fields are null. Copy rationale, alternatives, or rubric only if the book supplies them. Preserve the exact answer in source_answer_text if it cannot be parsed safely and flag the ambiguity. Add an issue when the answer key is missing, unreadable, or cannot be matched. Book answer-key extraction still requires human verification before scored testing; never set verification_status to verified.
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
