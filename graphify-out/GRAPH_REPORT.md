# Graph Report - AI_sensei  (2026-10-28)

## Corpus Check
- 161 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 938 nodes · 2481 edges · 59 communities (38 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 39
- Community 43
- Community 44
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 57
- Community 58

## God Nodes (most connected - your core abstractions)
1. `localDatabaseUrl()` - 27 edges
2. `generateDraft()` - 24 edges
3. `createUser()` - 20 edges
4. `normalizeReading()` - 18 edges
5. `POST()` - 17 edges
6. `restoreDatabase()` - 16 edges
7. `Detail()` - 16 edges
8. `resolveKanjiMeanings()` - 16 edges
9. `prepareReader()` - 16 edges
10. `syncCards()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `fixture()` --calls--> `createUser()`  [EXTRACTED]
  tests/generation-postgres.test.mjs → src/lib/server/review/service.mjs
- `run()` --calls--> `previewBatch()`  [EXTRACTED]
  scripts/canonical-import.mjs → src/lib/server/content/canonical-import.mjs
- `run()` --calls--> `previewPromotion()`  [EXTRACTED]
  scripts/canonical-import.mjs → src/lib/server/content/canonical-import.mjs
- `run()` --calls--> `promote()`  [EXTRACTED]
  scripts/canonical-import.mjs → src/lib/server/content/canonical-import.mjs
- `run()` --calls--> `recordApproval()`  [EXTRACTED]
  scripts/canonical-import.mjs → src/lib/server/content/canonical-import.mjs

## Import Cycles
- None detected.

## Communities (59 total, 21 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (93): answer, caps, dynamic, failure(), GET(), id, input, local() (+85 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (49): dynamic, failure(), GET(), id, input, local(), POST(), runtime (+41 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (48): collectRequests(), createLookupCache(), enrichBatch(), kana(), normalizeGloss(), preparePacket(), requireAbsent(), resolveCandidates() (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (43): privatePath(), run(), dynamic, failure(), GET(), id, input, local() (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (45): dynamic, GET(), kind, local(), runtime, send(), first(), kanjiAnswer() (+37 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (30): installDictionary(), updateDictionary(), analyzeDraft(), elementaryParticles, forms(), kana(), kanaHints(), kanaReplacements() (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (32): ReviewPage(), AnswerView(), call(), labels, Review(), rate(), replace(), response() (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (30): addContent(), addition, approvalToken(), citation, contentSchemas, evidence(), grammar, hashJson() (+22 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (26): allowedKanji(), anchor, draftJsonSchema, draftSchema, id, ids, integer, N5_N3_KANJI (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (27): dynamic, failure(), GET(), id, input, local(), POST(), runtime (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (15): apply, db, now, url, AssessmentError, AssessmentQuestion, AssessmentResult, AssessmentView (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.30
Nodes (16): exampleMeaning(), DetailItem, FlashcardFacts(), DetailItem, ItemFacts(), KanjiMeanings(), supplied(), Citations() (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.31
Nodes (15): backupDatabase(), containerFor(), databaseConnection(), guardedDirectory(), hashFile(), historyTables, inventory(), local() (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (13): Flashcards(), Catalog(), BrowseFlashcard(), ItemLink(), name(), Kind, kinds, pageInput() (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (15): anchor, anchorProperties, annotationJsonSchema, annotationPrompt(), annotationSchema, dictionarySense(), hiragana(), locate() (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.24
Nodes (9): localDatabaseUrl(), run(), run(), run(), run(), admin, adminUrl, base (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (9): Home(), DailyBudget(), DashboardActivity(), Dictionary(), lookup(), openTerm(), showFallback(), fields (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.21
Nodes (6): config, Detail(), EntryNavigation(), MarkStudied(), itemNeighbors(), studyStatus()

### Community 18 - "Community 18"
Cohesion: 0.21
Nodes (12): run(), bankHash(), id, ids, parseBank(), passageSchema, publishBank(), questionSchema (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.20
Nodes (12): MatchPage(), bestKey(), loadPairs(), MatchGame(), apply(), deal(), tap(), readBest() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.24
Nodes (9): availableModels(), cooldowns, GeminiError, geminiFallbackRequest(), geminiRequest(), nextPacificMidnight(), normalizeModelId(), requestFailure() (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (9): failureMessage(), Practice(), mutate(), open(), refresh(), resetApproval(), PracticeReading(), fragments() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.28
Nodes (13): compare(), fieldRank(), hasEnglishText(), isKanjiMeaningSupplement(), KANJI_MEANING_FIELD_PATHS, placeholder(), provenanceRank(), resolveKanjiMeanings() (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (10): CatalogContent, CatalogItem, Citation, citationSelect, contentSelect, itemSelect, kanjiMeaningSelect, sourceSelect (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.24
Nodes (8): PracticePage(), providerConfiguration(), generationList(), generationPoolCount(), LOCAL_USER_ID, draft(), fixture(), providerDraft()

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (12): approvalSchema, eligible(), exportSchema, generationTargets(), MAX_REVIEW_FINDINGS, modelReviewJsonSchema, modelReviewSchema, plain() (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (6): db, failures, items, MEANING_PATHS, raw, sources

### Community 27 - "Community 27"
Cohesion: 0.40
Nodes (8): Source(), Sources(), ContentBlock(), Origin(), Pagination(), isUuid(), sourceDetail(), sourceList()

### Community 28 - "Community 28"
Cohesion: 0.28
Nodes (3): findAvailablePort(), run(), retireKanjiReadingCards()

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (6): admin, base, db, env, migration, tests

### Community 31 - "Community 31"
Cohesion: 0.50
Nodes (5): fieldSupplement(), meaning(), reading(), referencePresentation(), text()

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (7): Draft, GenerationError, ReaderReference, ReaderWord, Run, RunSummary, Target

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (6): Choice, ChoiceSet, ChoiceTier, DictionaryCandidate, KanjiChoiceItem, KanjiExample

### Community 34 - "Community 34"
Cohesion: 0.60
Nodes (4): commands, refreshLocal(), run(), validateTarget()

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (3): dynamic, metadata, runtime

### Community 36 - "Community 36"
Cohesion: 0.40
Nodes (3): counts, db, unresolved

### Community 37 - "Community 37"
Cohesion: 0.70
Nodes (4): KanjiMnemonic(), object(), strings(), text()

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (3): kana, label, vocabularyComponentAidSchema

## Knowledge Gaps
- **11 isolated node(s):** `KANJI_MEANING_FIELD_PATHS`, `comparisonSchema`, `vocabularyComponentAidSchema`, `N5_N3_KANJI`, `MAX_REVIEW_FINDINGS` (+6 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 336 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PracticeReading()` connect `Community 21` to `Community 24`, `Community 17`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `KANJI_MEANING_FIELD_PATHS`, `comparisonSchema`, `vocabularyComponentAidSchema` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05216581276199348 - nodes in this community are weakly interconnected._
- **Why does `localDictionary()` connect `Community 2` to `Community 0`, `Community 36`, `Community 5`, `Community 9`, `Community 25`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07539682539682539 - nodes in this community are weakly interconnected._
- **Why does `Dictionary()` connect `Community 16` to `Community 17`, `Community 13`, `Community 6`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06810035842293907 - nodes in this community are weakly interconnected._