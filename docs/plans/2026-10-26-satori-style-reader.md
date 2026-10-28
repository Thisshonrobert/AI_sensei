# Satori-style practice reader — plan (26 October 2026)

Status: **approved 26 Oct 2026 as amendment A7** in [FINALIZED_PROJECT_PLAN.md](../../FINALIZED_PROJECT_PLAN.md).
Decisions: D1 = Waller N5–N3 lists, D2 = second annotate call, D3 = N5–N3 kanji count as known for furigana.
Work order step 1 (every token a reader word, content-word underline, local conjugation labels) and step 2 (inline 訳 sentence-notes button replaces the Sentence help block) and step 3 (default "According to my knowledge" furigana from studied kanji + `kanji-n5-n3.json`, 619 Waller kanji incl. 分 (N5) and 身的無可坊畑 (N3) supplements) and step 4 (multi-word JMdict expression entries on each member word) done. Step 5 (generation allows target/support kanji ∪ 619 Waller N5–N3 kanji; prompt asks for usual kanji spelling within that list) implemented 28 Oct; Postgres/browser tests and one live Gemini passage verified 28 Oct (分 and six N3-band kanji had no level upstream and are now supplemented). Step 6 (annotate call after review: glosses checked against token boundaries and JMdict lemma+reading, labelled dictionary/AI sense; ≤25 grammar notes; sentence literal/notes; stored as `report.annotation` for content revision 1, failures stored as `annotation.failure` and fall back to dictionary candidates) implemented 28 Oct; unit/Postgres/browser tests pass; live passage verified 28 Oct (68/92 non-target content words glossed, 49 dictionary / 21 AI senses, 9 grammar notes, 3 sentence notes); する-verb lemmas now fall back to the JMdict noun entry.

## 1. What Satori Reader actually does (inspected 26 Oct 2026, public demo at satorireader.com/how-it-works)

Observed from the demo's DOM and popups:

| Feature | How it behaves |
|---|---|
| Every word is a token | Each sentence is split into `word` spans, particles included. Kanji words carry ruby (`fg` furigana span) plus a per-word kanji-knowledge class (`all` / `some` / `none` / `na`). |
| Contextual definition | Tapping a word shows **one** dictionary sense, the one used in this sentence, with part of speech (e.g. 降る → "to precipitate; to fall (e.g. rain) [godan verb, intransitive]"). It does not show every JMdict sense. |
| Expression entries | A word inside a set phrase shows its own entry **and** the phrase entry (と / いう / 間 each also show あっという間; 悲鳴 also shows 悲鳴を上げる). |
| Sentence form | Inflected words show the dictionary form plus a conjugation label: 降っていた → "Progressive \| past". |
| Word notes | Some words carry an extra marker. Tapping shows an "Other note" (木々: plural reduplication with 山々, 国々, 人々), or a note such as "often appears in kana (why?)". |
| Sentence notes | A button at the end of each sentence opens "MEANING", a careful translation, plus optional literal and grammar notes. |
| Kanji display | Kanji: *As written / According to my knowledge / None*. Furigana: *All / According to my knowledge / None*. "Knowledge" means the kanji the learner has marked known. |
| Study cards | "Add to your studylist" from any entry. The card keeps the whole sentence (and audio). |
| Audio | Per-sentence human narration. **Out of scope here** (no human audio; TTS is not the ask). |

## 2. What this app already has

`src/lib/server/generation/reader.mjs` and `src/components/practice-reading.tsx` already cover part of this:

- kuromoji tokenization, longest JMdict compound on real token boundaries, and auxiliaries grouped onto verbs (て + いる, ます, ない).
- Furigana modes: Off / On request / All verified readings.
- A word popup with a reading, the target's annotated sense, JMdict candidate senses, Takoboto lookup, "save this context" and "needs attention".
- Per-sentence translations in a separate "Sentence help" `<details>`.

Gaps against Satori:

1. Kana-only words are not tappable (`if(!han(surface))continue`). Only target words get an annotation underline.
2. Non-target words show *all* JMdict candidates (up to 8 entries × 8 senses), not the sense used here.
3. There is no conjugation label, no phrase or expression entry, and no inline grammar note.
4. Sentence help sits in one block after the passage, not on each sentence.
5. Furigana has no "according to my knowledge" mode, and there is no kanji display setting.
6. **The passage may only use kanji that appear in the supplied target or support forms**; every other word is forced into kana (8 Oct clarification). This is why passages are kana-heavy.

## 3. Proposed design

### 3.1 Allow N5–N3 kanji in passages (needs amendment)
- Allowed kanji = target/support kanji ∪ **an N5–N3 kanji inventory**.
- The prompt rule changes from "only these kanji" to "these kanji plus the N5–N3 list". The existing correction retry still rejects kanji outside that union.
- Inventory options (decision **D1**):
  - **a. Jonathan Waller JLPT N5–N3 kanji lists** (tanos.co.uk, CC BY). About 650 kanji, closest to the "N3" intent. Recommended, with attribution kept.
  - b. KANJIDIC2 old-JLPT levels 4–3, plus school grades 1–3. Already EDRDG-licensed, but a looser proxy.
- Stored as a versioned local file (`private-data/` is not needed; it is open data), e.g. `src/lib/server/generation/kanji-n5-n3.json`, with its source and licence recorded. It is not a familiarity claim. The reviewer prompt keeps flagging advanced words.

### 3.2 Underline every content word
- `prepareReader` emits a word for every non-symbol token. Kana words and particles become tappable.
- Content words (nouns, verbs, adjectives, adverbs) get the underline. Particles and auxiliaries are tappable but not underlined, which matches Satori's quieter look.

### 3.3 Contextual sense (one sense per word)
- **A second, small model call after the passage passes validation ("annotate" step, decision D2).** It returns `glosses: [{quote, occurrence, lemma, reading, sense, pos}]` for each content word. A second call keeps the existing generation schema under Gemini's guided-decoding state limit.
- Local check: `quote` must resolve to token boundaries, and `lemma` + `reading` must be a JMdict candidate.
  - If `sense` matches one of that entry's JMdict senses, show it as "dictionary sense chosen for this context".
  - Otherwise show it as "AI sense, not in dictionary", and keep the JMdict senses collapsed under it.
- If the call fails or quota is out (free tier: 20 requests/model/day), the reader falls back to today's dictionary-candidate popup. Generation never fails because of annotation.

### 3.4 Sentence form (conjugation label), local and deterministic
- A small rule table over kuromoji tokens: た → past, て+いる → progressive, ない → negative, ます → polite, られる → passive/potential, させる → causative, たい → want, ば/たら → conditional, よう/う → volitional.
- The popup shows the dictionary form, then the label: 降っていた → 降る · Progressive | past. No model is needed. Unit-test each rule.

### 3.5 Expression entries
- During lookup, also try spans that cross particles (up to 4 tokens) against JMdict, e.g. 悲鳴を上げる or あっという間.
- A hit is shown as a second "Expression" entry in the popup of each member word.

### 3.6 Grammar notes on spans
- The same annotate call returns `grammarNotes: [{quote, occurrence, pattern, explanation}]` for N5–N3 constructions and the supplied grammar targets.
- Spans get a small marker. A grammar target links to its `/grammar/[id]` page. Every other note is labelled "AI note, unverified".
- Validation is the same as for glosses: the quote must exist, notes must not overlap illegally, and there is a cap of about 25 notes.

### 3.7 Sentence notes inline
- Move each sentence translation behind a small button at the end of that sentence (like Satori's notes button). It opens "Meaning", plus optional `literal` / `note` fields from the annotate call.
- Remove the separate "Sentence help" block.

### 3.8 Kanji and furigana by my knowledge
- Known kanji = kanji items marked studied (`UserItem.introducedAt`). Optionally (D3) also treat the N5–N3 inventory as known.
- Furigana: *All / According to my knowledge (only words containing a kanji not known) / Off*. Kanji display stays "as written" in v1. Kana-only display is optional later.
- Timed mode keeps its frozen Off setting (Phase 4 invariant unchanged).

### 3.9 Add to study
- Already present: "save this context" and "needs attention". For a non-target word that exists in the catalog, add "open entry". Words not in the catalog stay Takoboto-only. Lookups never schedule or rate cards (invariant unchanged).

## 4. Contract and storage
- `contract.mjs`: a new optional `annotation` object on the run (`glosses`, `grammarNotes`, `sentenceNotes`, `annotatorModel`, `revision`). It is tied to the draft revision. A text change invalidates it, the same way `reader.revision` works today.
- Spans are stored as half-open UTF-16 ranges with surrogate checks (existing helpers).
- Nothing is promoted to canonical content. Annotations stay part of the ungraded practice run.

## 5. Work order (each step is shippable and has tests)
1. Underline all content words, plus the local conjugation labels (3.2, 3.4). No model or rule change.
2. Sentence notes inline (3.7).
3. Furigana by knowledge (3.8).
4. Expression entries (3.5).
5. **After the amendment:** N5–N3 kanji inventory and the prompt or validator change (3.1).
6. **After the amendment:** the annotate call for contextual senses and grammar notes (3.3, 3.6), with fallback.

Verification for every step: `bun run test`, `bun run lint`, `bun run test:generation`, `bun run test:generation:browser`, plus one live generated passage checked in the browser.

## 6. Decisions needed from you
- **D1** N5–N3 kanji source: Waller lists (recommended) or the KANJIDIC2 proxy.
- **D2** A second Gemini call per passage for contextual senses and grammar notes (one more free-tier request each time), or local dictionary candidates only.
- **D3** Whether "according to my knowledge" treats all N5–N3 kanji as known, or only the kanji you have marked studied.
- Approval to amend the 8 October kanji-scope rule and the Phase 5 reading-aid list in FINALIZED_PROJECT_PLAN.md.
