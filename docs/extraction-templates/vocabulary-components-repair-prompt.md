# Repair vocabulary component extraction

Use this prompt in Gemini or ChatGPT with the original vocabulary PDF excerpt and the corresponding existing vocabulary JSON. Keep both inputs private. No need to re-extract kanji or grammar. Use small batches that the model can inspect completely.

## Continue the original extraction chat

If that chat still has the PDF and extraction, paste this shorter prompt. Do not assume a long chat still has readable access to the original attachment.

```text
Continue the vocabulary extraction in this chat. Use the original PDF already attached and the vocabulary JSON you previously produced. Add the missing kanji/component boxes and their printed meanings beside EACH vocabulary word, including characters absent from the separate core kanji book.

Preserve every existing entry, its order, source_record_key (if present), word, reading, meaning, examples, notes, book identity, filename and page references exactly. Add only this field to each entry:
"kanji_components": [
  {"text":"exact box text", "meanings":["exact printed gloss"], "reading":null, "source_pdf_pages":[1], "source_printed_pages":[], "issues":[]}
]

Copy all boxes left to right, including repeated boxes. Preserve whole printed units such as 生きる or 卒業; do not split them into inferred character meanings/readings. Do not substitute a group-heading gloss for a box gloss. Include non-core components as vocabulary aids; do not create a separate kanji curriculum or scheduled cards.

Copy a component reading only if printed for that component. Never divide the vocabulary's whole reading into guessed kanji readings. Missing fields are null/[]; absent breakdowns use []. Flag unreadable/missing component glosses in the component's issues. Do not invent translations, use a dictionary gloss as book text, or silently drop uncertain entries. Keep review_status unreviewed.

Return the complete updated UTF-8 vocabulary JSON as a downloadable file, preserving every original record and field. Report before/after entry counts separately from the JSON. If the original PDF or complete prior JSON is no longer accessible, ask me to attach it again; do not reconstruct missing source evidence from memory. If output limits prevent a complete file, request smaller page batches rather than silently truncate it.
```

This updated full vocabulary JSON can go through normal staging (which preserves additive fields). Canonical component publication still requires review and explicit mapping to `usageJson.kanji_components`; file generation does not approve content. The standalone repair packet below is an alternative when a full extraction response is impractical.

## Standalone repair packet

For generated readings/example words, keep a separate `component_aids` array using the vocabulary template and main prompt rule 8b. A `japanese_word` containing kanji is an example-word spelling, not a kana reading. Do not put AI suggestions into book-origin component `reading` fields.

```text
Extract ONLY the component boxes and their printed meanings beside every vocabulary entry in this Nihongo no Mori JLPT N2 FAST PASS 合格単語 Vocabulary excerpt. The existing vocabulary JSON is an identity/locator aid, not evidence that a box was printed.

Book ID: [reuse the existing stable book_id]
Excerpt filename: [original PDF excerpt filename]
Excerpt-local PDF pages supplied: [one-based viewer positions]
Existing vocabulary JSON: [attach the matching batch]
Output filename: vocab_components_batch_001.json

Return one UTF-8 JSON object, without Markdown or commentary:
{
  "schema_version": 1,
  "content_type": "vocabulary_components_repair",
  "source": {"book_id":"...", "book_title":"JLPT N2 FAST PASS 合格単語 Vocabulary", "file_name":"..."},
  "pdf_pages_processed": [],
  "unreadable_pdf_pages": [],
  "entries": [
    {
      "source_record_key": null,
      "printed_entry_number": null,
      "word": "exact source word",
      "reading": null,
      "source_pdf_pages": [],
      "source_printed_pages": [],
      "kanji_components": [
        {"text":"exact box text", "meanings":[], "reading":null, "source_pdf_pages":[], "source_printed_pages":[], "issues":[]}
      ],
      "review_status": "unreviewed",
      "issues": []
    }
  ]
}

Rules:
1. Inspect every supplied page and preserve entry order. Match entries using printed entry number, exact word, full reading and page; preserve an existing source_record_key only when supplied and matched unambiguously. Otherwise null; never invent database IDs or silently merge homographs.
2. Copy every component box and its own printed meaning in left-to-right source order. Keep repeated boxes. Boxes can contain single characters, compounds, or words with kana. For example, preserve 生きる as 生きる and 卒業 as 卒業; do not force every box into a single-kanji record.
3. Include all components even when their characters are absent from the core kanji book. They are vocabulary study aids; extraction does not add core curriculum membership or scheduled cards.
4. Preserve exact printed English glosses, Japanese spelling, kana, punctuation and source distinctions. Do not use your knowledge or a dictionary to invent missing component meanings. Group headings are not substitutes for per-box glosses.
5. Copy box readings only if explicitly supplied for that box. Never split the whole vocabulary reading to infer individual kanji readings. Missing scalar fields are null; missing arrays are [].
6. Use excerpt-local one-based PDF pages and keep printed/main-book labels as separate strings. Record each box's own source page. Do not infer unsplit-PDF positions.
7. If no breakdown is printed, use [] and record "No component boxes printed". If a box/gloss is unreadable or cut off, preserve visible text, leave missing fields null/[], and describe the exact issue. Do not hide uncertain entries or claim completeness for a partial batch.
8. Set every review_status to unreviewed. Do not alter vocabulary meanings, add mnemonics or generate examples. Return only the requested JSON. If the batch is too large to inspect fully, request fewer pages before producing a supposedly complete file.
```

This repair format is a review packet, not a direct input to the current batch CLI. Compare it with the PDF, resolve identities/issues, then map accepted components to `Vocabulary.usageJson.kanji_components` through an explicit revision and source evidence. Retain the old source payload and review snapshots. Individual retained non-core characters use the existing canonical Kanji identity and relationship rules (Master Plan §3), without `core_kanji` membership or automatic activation. Multi-character box units remain vocabulary aids. Do not create another kanji table or scheduler.

## Correct a completion whose identities changed

```text
The previous completion contains 17 records, but none matches the 17 missing vocabulary identities in the attached remaining-entries.json. Do not reuse those changed word locators or match records by position.

Use remaining-entries.json as the immutable identity list. Reopen the original PDF and extract component boxes for exactly those 17 words. Preserve source_record_key, word, full vocabulary reading and source pages. If the PDF is inaccessible or disagrees with an identity, ask for clarification and flag it; do not substitute a new word.

Return one JSON object with entries (exactly those 17 source-only repair records) and component_aids (separate unreviewed study-aid proposals). Copy box text/meaning and any printed box reading into entries. Keep an absent source reading null.

For each requested aid, retain the same vocabulary identity and zero-based component index. Supply component_text, suggested_reading (kana), japanese_word (a natural example), japanese_word_reading (its full kana reading), japanese_word_meaning, origin (dictionary or generated), sources and issues using the attached vocabulary template's aid shape. Check dictionary senses/readings where possible and retain actual evidence URLs. AI suggestions must be labelled generated. A Japanese word containing kanji is not its kana reading; never split a parent's reading to infer character pronunciation. Uncertain values are null with issues.

Before returning the complete UTF-8 file, verify JSON parsing, exactly 17 entries, no duplicates, and an exact identity match to all 17 supplied locators. Do not claim original-PDF verification from generated aids.
```
