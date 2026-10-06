-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "timezone" TEXT NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_items" (
    "userId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "familiarity" TEXT NOT NULL DEFAULT 'unseen',
    "introducedAt" TIMESTAMPTZ(6),
    "baselineStatus" TEXT NOT NULL DEFAULT 'none',
    "baselineVerifiedAt" TIMESTAMPTZ(6),
    "excludedFromTests" BOOLEAN NOT NULL DEFAULT false,
    "needsAttention" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "savedContextsJson" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "user_items_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "objective" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "promptSpecJson" JSONB NOT NULL,
    "answerSpecJson" JSONB NOT NULL,
    "contentId" UUID,
    "contextVocabularyItemId" UUID,
    "siblingKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "dueAt" TIMESTAMPTZ(6),
    "fsrsStateJson" JSONB NOT NULL,
    "stateVersion" INTEGER NOT NULL DEFAULT 0,
    "buriedUntil" TIMESTAMPTZ(6),
    "introducedAt" TIMESTAMPTZ(6),
    "introductionDay" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'daily',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'active',
    "timeBudgetMinutes" INTEGER NOT NULL DEFAULT 30,
    "selectionSeed" TEXT NOT NULL,
    "selectionSnapshotJson" JSONB NOT NULL,
    "assessmentResultJson" JSONB,

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_items" (
    "sessionId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "session_items_pkey" PRIMARY KEY ("sessionId","itemId","role")
);

-- CreateTable
CREATE TABLE "review_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "clientEventId" UUID NOT NULL,
    "reviewedAt" TIMESTAMPTZ(6) NOT NULL,
    "rating" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "libraryVersion" TEXT NOT NULL,
    "schedulerConfigJson" JSONB NOT NULL,
    "cardBeforeJson" JSONB NOT NULL,
    "cardAfterJson" JSONB NOT NULL,
    "libraryLogJson" JSONB NOT NULL,
    "promptSnapshotJson" JSONB NOT NULL,

    CONSTRAINT "review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "cardId" UUID,
    "contentId" UUID,
    "primaryTargetItemId" UUID NOT NULL,
    "clientEventId" UUID NOT NULL,
    "promptSnapshotJson" JSONB NOT NULL,
    "answerJson" JSONB NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ungraded',
    "feedbackJson" JSONB NOT NULL DEFAULT '{}',
    "grader" TEXT NOT NULL DEFAULT 'self',
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL,
    "revealedAt" TIMESTAMPTZ(6),
    "reviewLogId" UUID,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_items_userId_familiarity_idx" ON "user_items"("userId", "familiarity");

-- CreateIndex
CREATE INDEX "cards_userId_status_dueAt_idx" ON "cards"("userId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "cards_userId_introductionDay_idx" ON "cards"("userId", "introductionDay");
CREATE INDEX "cards_userId_siblingKey_idx" ON "cards"("userId", "siblingKey");

-- CreateIndex
CREATE UNIQUE INDEX "cards_userId_itemId_objective_templateVersion_key" ON "cards"("userId", "itemId", "objective", "templateVersion");

-- CreateIndex
CREATE UNIQUE INDEX "cards_id_userId_key" ON "cards"("id", "userId");

-- CreateIndex
CREATE INDEX "study_sessions_userId_status_idx" ON "study_sessions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "study_sessions_id_userId_key" ON "study_sessions"("id", "userId");

-- CreateIndex
CREATE INDEX "review_logs_cardId_reviewedAt_idx" ON "review_logs"("cardId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_logs_userId_clientEventId_key" ON "review_logs"("userId", "clientEventId");

-- CreateIndex
CREATE UNIQUE INDEX "review_logs_id_userId_key" ON "review_logs"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_reviewLogId_key" ON "attempts"("reviewLogId");

-- CreateIndex
CREATE INDEX "attempts_userId_primaryTargetItemId_submittedAt_idx" ON "attempts"("userId", "primaryTargetItemId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_reviewLogId_userId_key" ON "attempts"("reviewLogId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_userId_clientEventId_key" ON "attempts"("userId", "clientEventId");

-- AddForeignKey
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_contextVocabularyItemId_fkey" FOREIGN KEY ("contextVocabularyItemId") REFERENCES "vocabulary"("itemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "study_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_items" ADD CONSTRAINT "session_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_cardId_userId_fkey" FOREIGN KEY ("cardId", "userId") REFERENCES "cards"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_sessionId_userId_fkey" FOREIGN KEY ("sessionId", "userId") REFERENCES "study_sessions"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_sessionId_userId_fkey" FOREIGN KEY ("sessionId", "userId") REFERENCES "study_sessions"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_cardId_userId_fkey" FOREIGN KEY ("cardId", "userId") REFERENCES "cards"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_primaryTargetItemId_fkey" FOREIGN KEY ("primaryTargetItemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_reviewLogId_userId_fkey" FOREIGN KEY ("reviewLogId", "userId") REFERENCES "review_logs"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- V1 has one live version of each stable objective, including dormant cards.
CREATE UNIQUE INDEX cards_one_live_objective ON cards ("userId","itemId",objective) WHERE status <> 'retired';
CREATE UNIQUE INDEX sessions_one_open_daily ON study_sessions ("userId") WHERE status IN ('active','paused');
ALTER TABLE cards ADD CONSTRAINT card_status CHECK (status IN ('new','active','suspended','retired'));
ALTER TABLE cards ADD CONSTRAINT card_versions CHECK ("stateVersion">=0 AND "templateVersion">0);
ALTER TABLE cards ADD CONSTRAINT card_due_state CHECK ((status='new' AND "dueAt" IS NULL) OR (status<>'new' AND "dueAt" IS NOT NULL AND "dueAt"=("fsrsStateJson"->>'due')::timestamptz));
ALTER TABLE cards ADD CONSTRAINT card_introduction CHECK (("introducedAt" IS NULL)=("introductionDay" IS NULL));
ALTER TABLE review_logs ADD CONSTRAINT review_rating CHECK (rating BETWEEN 1 AND 4 AND "durationMs">=0);
ALTER TABLE study_sessions ADD CONSTRAINT session_status CHECK (status IN ('active','paused','completed') AND mode='daily');
ALTER TABLE user_items ADD CONSTRAINT familiarity_status CHECK (familiarity IN ('unseen','introduced','practicing','familiar'));
CREATE TRIGGER immutable_review_logs BEFORE UPDATE OR DELETE ON review_logs FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();

CREATE FUNCTION check_card_objective() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE typ text; context content; word vocabulary; glyph text; ref text;
BEGIN
 SELECT kind INTO typ FROM items WHERE id=NEW."itemId" AND status='approved';
 IF NEW.objective='vocab_reading_meaning' THEN
  IF typ IS DISTINCT FROM 'vocabulary' OR NOT (NEW."answerSpecJson" ?& ARRAY['reading','meaning']) THEN RAISE EXCEPTION 'combined vocabulary objective requires reading and selected meaning'; END IF;
 ELSIF NEW.objective IN ('kanji_meaning','kanji_reading_context') THEN
  IF typ IS DISTINCT FROM 'kanji' OR NOT EXISTS(SELECT 1 FROM source_entries WHERE "itemId"=NEW."itemId" AND "curriculumRole"='core_kanji' AND "verificationStatus"='verified') THEN RAISE EXCEPTION 'automatic kanji cards require core source membership'; END IF;
  IF NEW.objective='kanji_meaning' AND NOT NEW."answerSpecJson" ? 'meaning' THEN RAISE EXCEPTION 'kanji meaning missing'; END IF;
 ELSIF NEW.objective='grammar_cloze' THEN
  SELECT * INTO context FROM content WHERE id=NEW."contentId";
  IF typ IS DISTINCT FROM 'grammar' OR context.status IS DISTINCT FROM 'approved' OR context.kind IS DISTINCT FROM 'question' OR context."payloadJson"->>'answerVerified' IS DISTINCT FROM 'true' OR context."payloadJson"->>'targetsVerified' IS DISTINCT FROM 'true'
    OR context."payloadJson"->>'format' IS DISTINCT FROM 'fill_in_blank' OR NOT NEW."answerSpecJson" ? 'response'
    OR NOT EXISTS(SELECT 1 FROM content_items WHERE "contentId"=context.id AND "itemId"=NEW."itemId" AND role='target')
  THEN RAISE EXCEPTION 'grammar cloze requires approved question and explicit target'; END IF;
 ELSE RAISE EXCEPTION 'unsupported V1 objective'; END IF;
 IF NEW.objective='kanji_reading_context' THEN
  SELECT * INTO context FROM content WHERE id=NEW."contentId";
  SELECT * INTO word FROM vocabulary WHERE "itemId"=NEW."contextVocabularyItemId";
  SELECT k.glyph INTO glyph FROM kanji k WHERE k."itemId"=NEW."itemId";
  IF context.status IS DISTINCT FROM 'approved' OR context.origin IS DISTINCT FROM 'book' OR context.kind IS DISTINCT FROM 'sentence'
    OR context."payloadJson"->>'sourceWord' IS DISTINCT FROM 'true'
    OR context."payloadJson"->>'japanese' IS DISTINCT FROM word."writtenForm" OR context."payloadJson"->>'reading' IS DISTINCT FROM word.reading
    OR NEW."promptSpecJson"->>'text' IS DISTINCT FROM word."writtenForm" OR NEW."answerSpecJson"->>'reading' IS DISTINCT FROM word.reading
    OR position(glyph in word."writtenForm")=0
    OR NOT EXISTS(SELECT 1 FROM vocabulary_kanji WHERE "vocabularyItemId"=word."itemId" AND "kanjiItemId"=NEW."itemId")
    OR NOT EXISTS(SELECT 1 FROM source_entries WHERE "contentId"=context.id AND "verificationStatus"='verified')
  THEN RAISE EXCEPTION 'context card requires approved whole-word source evidence and relationship'; END IF;
 ELSIF NEW."contextVocabularyItemId" IS NOT NULL THEN RAISE EXCEPTION 'unexpected context vocabulary'; END IF;
 FOR ref IN SELECT jsonb_array_elements_text(NEW."promptSpecJson"->'sourceEntryIds') LOOP
  IF NOT EXISTS(SELECT 1 FROM source_entries WHERE id::text=ref AND "verificationStatus"='verified') THEN RAISE EXCEPTION 'card evidence missing'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER card_objective BEFORE INSERT ON cards FOR EACH ROW EXECUTE FUNCTION check_card_objective();

CREATE FUNCTION preserve_recall_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='cards' THEN
  IF NEW."userId"<>OLD."userId" OR NEW."itemId"<>OLD."itemId" OR NEW.objective<>OLD.objective OR NEW."templateVersion"<>OLD."templateVersion"
    OR NEW."promptSpecJson"<>OLD."promptSpecJson" OR NEW."answerSpecJson"<>OLD."answerSpecJson" OR NEW."contentId" IS DISTINCT FROM OLD."contentId" OR NEW."contextVocabularyItemId" IS DISTINCT FROM OLD."contextVocabularyItemId" OR NEW."siblingKey" IS DISTINCT FROM OLD."siblingKey"
    OR (OLD."introducedAt" IS NOT NULL AND (NEW."introducedAt" IS DISTINCT FROM OLD."introducedAt" OR NEW."introductionDay" IS DISTINCT FROM OLD."introductionDay"))
  THEN RAISE EXCEPTION 'recall objective and introduction evidence are immutable'; END IF;
 ELSIF TG_TABLE_NAME='study_sessions' THEN
  IF NEW."selectionSnapshotJson"<>OLD."selectionSnapshotJson" OR NEW."userId"<>OLD."userId" THEN RAISE EXCEPTION 'session selection is immutable'; END IF;
 ELSE
  IF OLD."reviewLogId" IS NOT NULL OR NEW."answerJson"<>OLD."answerJson" OR NEW."promptSnapshotJson"<>OLD."promptSnapshotJson" OR NEW."clientEventId"<>OLD."clientEventId" OR NEW."userId"<>OLD."userId" OR NEW."cardId" IS DISTINCT FROM OLD."cardId" OR NEW."sessionId"<>OLD."sessionId" OR NEW."submittedAt"<>OLD."submittedAt"
  THEN RAISE EXCEPTION 'committed recall response is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_card BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION preserve_recall_evidence();
CREATE TRIGGER preserve_session BEFORE UPDATE ON study_sessions FOR EACH ROW EXECUTE FUNCTION preserve_recall_evidence();
CREATE TRIGGER preserve_attempt BEFORE UPDATE ON attempts FOR EACH ROW EXECUTE FUNCTION preserve_recall_evidence();
CREATE TRIGGER immutable_session_items BEFORE UPDATE OR DELETE ON session_items FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();
