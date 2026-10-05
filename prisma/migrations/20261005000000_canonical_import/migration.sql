-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "fieldOriginsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary" (
    "itemId" UUID NOT NULL,
    "writtenForm" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "senseKey" TEXT NOT NULL,
    "meaningEn" TEXT NOT NULL,
    "acceptedGlossesJson" JSONB NOT NULL,
    "alternativeFormsJson" JSONB NOT NULL,
    "usageJson" JSONB NOT NULL,

    CONSTRAINT "vocabulary_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "kanji" (
    "itemId" UUID NOT NULL,
    "glyph" TEXT NOT NULL,
    "meaningsJson" JSONB NOT NULL,
    "onReadingsJson" JSONB NOT NULL,
    "kunReadingsJson" JSONB NOT NULL,
    "notes" TEXT,

    CONSTRAINT "kanji_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "grammar" (
    "itemId" UUID NOT NULL,
    "pattern" TEXT NOT NULL,
    "patternVariantsJson" JSONB NOT NULL,
    "explanationJa" TEXT,
    "explanationEn" TEXT,
    "nuance" TEXT,
    "formationRulesJson" JSONB NOT NULL,
    "usageJson" JSONB NOT NULL,

    CONSTRAINT "grammar_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "vocabulary_kanji" (
    "vocabularyItemId" UUID NOT NULL,
    "kanjiItemId" UUID NOT NULL,
    "occurrencesJson" JSONB NOT NULL,

    CONSTRAINT "vocabulary_kanji_pkey" PRIMARY KEY ("vocabularyItemId","kanjiItemId")
);

-- CreateTable
CREATE TABLE "content" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "supersedesId" UUID,
    "parentContentId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "contentId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "annotationsJson" JSONB,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("contentId","itemId","role")
);

-- CreateTable
CREATE TABLE "source_entries" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "itemId" UUID,
    "contentId" UUID,
    "sourceRecordKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "supersedesId" UUID,
    "printedPage" TEXT,
    "pdfPageIndex" INTEGER,
    "lessonKey" TEXT,
    "lessonTitle" TEXT,
    "orderInSource" INTEGER,
    "curriculumRole" TEXT,
    "originalPayloadJson" JSONB NOT NULL,
    "fieldPresenceJson" JSONB NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ(6),
    "importBatchId" UUID,

    CONSTRAINT "source_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_revisions" (
    "itemId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "typedJson" JSONB NOT NULL,
    "fieldOriginsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_revisions_pkey" PRIMARY KEY ("itemId","revision")
);

-- CreateTable
CREATE TABLE "promotion_approvals" (
    "id" UUID NOT NULL,
    "importBatchId" UUID NOT NULL,
    "recordKey" TEXT NOT NULL,
    "reviewHash" TEXT NOT NULL,
    "reviewJson" JSONB NOT NULL,
    "reviewer" TEXT NOT NULL,
    "approvedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "items_kind_canonicalKey_key" ON "items"("kind", "canonicalKey");

-- CreateIndex
CREATE INDEX "vocabulary_writtenForm_reading_idx" ON "vocabulary"("writtenForm", "reading");

-- CreateIndex
CREATE UNIQUE INDEX "kanji_glyph_key" ON "kanji"("glyph");

-- CreateIndex
CREATE UNIQUE INDEX "content_supersedesId_key" ON "content"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "source_entries_supersedesId_key" ON "source_entries"("supersedesId");

-- CreateIndex
CREATE INDEX "source_entries_importBatchId_idx" ON "source_entries"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "source_entries_sourceId_sourceRecordKey_revision_key" ON "source_entries"("sourceId", "sourceRecordKey", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_approvals_importBatchId_recordKey_reviewHash_key" ON "promotion_approvals"("importBatchId", "recordKey", "reviewHash");

-- AddForeignKey
ALTER TABLE "vocabulary" ADD CONSTRAINT "vocabulary_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanji" ADD CONSTRAINT "kanji_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar" ADD CONSTRAINT "grammar_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_kanji" ADD CONSTRAINT "vocabulary_kanji_vocabularyItemId_fkey" FOREIGN KEY ("vocabularyItemId") REFERENCES "vocabulary"("itemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_kanji" ADD CONSTRAINT "vocabulary_kanji_kanjiItemId_fkey" FOREIGN KEY ("kanjiItemId") REFERENCES "kanji"("itemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_parentContentId_fkey" FOREIGN KEY ("parentContentId") REFERENCES "content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_entries" ADD CONSTRAINT "source_entries_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_entries" ADD CONSTRAINT "source_entries_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_entries" ADD CONSTRAINT "source_entries_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_entries" ADD CONSTRAINT "source_entries_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_entries" ADD CONSTRAINT "source_entries_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "source_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_revisions" ADD CONSTRAINT "item_revisions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_approvals" ADD CONSTRAINT "promotion_approvals_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express these cross-table/deferred/append-only invariants.
ALTER TABLE source_entries ADD COLUMN "promotionReviewHash" TEXT;
ALTER TABLE items ADD CHECK (kind IN ('vocabulary','kanji','grammar')),
 ADD CHECK (status IN ('draft','approved','retired')), ADD CHECK (revision > 0);
ALTER TABLE content ADD CHECK (kind IN ('sentence','passage','question','explanation')),
 ADD CHECK (origin IN ('book','generated','user')), ADD CHECK (status IN ('draft','approved','rejected','retired')),
 ADD CHECK (revision > 0), ADD CHECK (jsonb_typeof("payloadJson") = 'object');
ALTER TABLE source_entries ADD CHECK (("itemId" IS NULL) <> ("contentId" IS NULL)),
 ADD CHECK (revision > 0), ADD CHECK ("pdfPageIndex" IS NULL OR "pdfPageIndex" >= 0),
 ADD CHECK ("verificationStatus" IN ('verified','unreviewed')),
 ADD CHECK (("verificationStatus" = 'verified') = ("verifiedAt" IS NOT NULL));
ALTER TABLE content_items ADD CHECK (role IN ('target','support','mention'));

CREATE FUNCTION reject_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable evidence: append a superseding revision'; END $$;
CREATE TRIGGER immutable_source_entries BEFORE UPDATE OR DELETE ON source_entries FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();
CREATE TRIGGER immutable_item_revisions BEFORE UPDATE OR DELETE ON item_revisions FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();
CREATE TRIGGER immutable_approvals BEFORE UPDATE OR DELETE ON promotion_approvals FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();
CREATE TRIGGER immutable_content BEFORE UPDATE OR DELETE ON content FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();
CREATE TRIGGER immutable_content_links BEFORE UPDATE OR DELETE ON content_items FOR EACH ROW EXECUTE FUNCTION reject_evidence_mutation();

CREATE FUNCTION guard_item_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id<>OLD.id OR NEW.kind<>OLD.kind OR NEW."canonicalKey"<>OLD."canonicalKey" OR NEW.revision<OLD.revision OR NEW.revision>OLD.revision+1
 THEN RAISE EXCEPTION 'canonical identity is immutable; revision must advance sequentially'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER item_identity BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION guard_item_identity();

CREATE FUNCTION guard_typed_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW."itemId"<>OLD."itemId" THEN RAISE EXCEPTION 'typed identity is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER vocabulary_identity BEFORE UPDATE ON vocabulary FOR EACH ROW EXECUTE FUNCTION guard_typed_identity();
CREATE TRIGGER kanji_identity BEFORE UPDATE ON kanji FOR EACH ROW EXECUTE FUNCTION guard_typed_identity();
CREATE TRIGGER grammar_identity BEFORE UPDATE ON grammar FOR EACH ROW EXECUTE FUNCTION guard_typed_identity();

CREATE FUNCTION check_revision_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ref text;
BEGIN
 FOR ref IN SELECT jsonb_array_elements_text(jsonb_path_query_array(NEW."fieldOriginsJson",'$.*')) LOOP
  IF NOT EXISTS(SELECT 1 FROM source_entries WHERE id::text=ref AND "itemId"=NEW."itemId" AND "verificationStatus"='verified')
  THEN RAISE EXCEPTION 'revision provenance must resolve to verified same-item evidence'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER revision_provenance BEFORE INSERT ON item_revisions FOR EACH ROW EXECUTE FUNCTION check_revision_provenance();

CREATE FUNCTION check_item_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ident uuid; row_item items; v int; k int; g int; origins jsonb; ref text; snapshot jsonb;
BEGIN
 ident := COALESCE(to_jsonb(NEW),to_jsonb(OLD))->>CASE WHEN TG_TABLE_NAME='items' THEN 'id' ELSE 'itemId' END;
 SELECT * INTO row_item FROM items WHERE id=ident;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT count(*) INTO v FROM vocabulary WHERE "itemId"=ident;
 SELECT count(*) INTO k FROM kanji WHERE "itemId"=ident;
 SELECT count(*) INTO g FROM grammar WHERE "itemId"=ident;
 IF v+k+g <> 1 OR (row_item.kind='vocabulary' AND v<>1) OR (row_item.kind='kanji' AND k<>1) OR (row_item.kind='grammar' AND g<>1)
 THEN RAISE EXCEPTION 'Item requires exactly one matching typed row'; END IF;
 IF row_item.kind='kanji' AND NOT EXISTS(SELECT 1 FROM kanji WHERE "itemId"=ident AND glyph=row_item."canonicalKey")
 THEN RAISE EXCEPTION 'kanji canonical identity mismatch'; END IF;
 SELECT "fieldOriginsJson","typedJson" INTO origins,snapshot FROM item_revisions WHERE "itemId"=ident AND revision=row_item.revision;
 IF NOT FOUND OR origins <> row_item."fieldOriginsJson" THEN RAISE EXCEPTION 'immutable current revision required'; END IF;
 IF snapshot <> (CASE row_item.kind WHEN 'vocabulary' THEN (SELECT to_jsonb(t)-'itemId' FROM vocabulary t WHERE "itemId"=ident)
  WHEN 'kanji' THEN (SELECT to_jsonb(t)-'itemId' FROM kanji t WHERE "itemId"=ident)
  ELSE (SELECT to_jsonb(t)-'itemId' FROM grammar t WHERE "itemId"=ident) END)
 THEN RAISE EXCEPTION 'typed row differs from immutable revision'; END IF;
 IF (SELECT array_agg(field_key ORDER BY field_key) FROM jsonb_object_keys(origins) field_key) IS DISTINCT FROM (SELECT array_agg(field_key ORDER BY field_key) FROM jsonb_object_keys(snapshot) field_key)
 THEN RAISE EXCEPTION 'each typed field requires evidence provenance'; END IF;
 FOR ref IN SELECT jsonb_array_elements_text(jsonb_path_query_array(origins,'$.*')) LOOP
  IF NOT EXISTS(SELECT 1 FROM source_entries WHERE id::text=ref AND "itemId"=ident AND "verificationStatus"='verified')
  THEN RAISE EXCEPTION 'field provenance must resolve to verified evidence for same item'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER item_integrity AFTER INSERT OR UPDATE ON items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_item_integrity();
CREATE CONSTRAINT TRIGGER vocabulary_integrity AFTER INSERT OR UPDATE OR DELETE ON vocabulary DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_item_integrity();
CREATE CONSTRAINT TRIGGER kanji_integrity AFTER INSERT OR UPDATE OR DELETE ON kanji DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_item_integrity();
CREATE CONSTRAINT TRIGGER grammar_integrity AFTER INSERT OR UPDATE OR DELETE ON grammar DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_item_integrity();
CREATE CONSTRAINT TRIGGER revision_integrity AFTER INSERT ON item_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_item_integrity();

CREATE FUNCTION check_source_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev source_entries; batch_source uuid; typ text;
BEGIN
 IF NEW."importBatchId" IS NOT NULL THEN
  SELECT "sourceId" INTO batch_source FROM import_batches WHERE id=NEW."importBatchId";
  IF batch_source IS DISTINCT FROM NEW."sourceId" THEN RAISE EXCEPTION 'source/batch mismatch'; END IF;
 END IF;
 IF NEW."supersedesId" IS NULL AND NEW.revision <> 1 THEN RAISE EXCEPTION 'first evidence revision must be one'; END IF;
 IF NEW."supersedesId" IS NOT NULL THEN
  SELECT * INTO prev FROM source_entries WHERE id=NEW."supersedesId";
  IF prev."sourceId" <> NEW."sourceId" OR prev."sourceRecordKey" <> NEW."sourceRecordKey" OR NEW.revision <> prev.revision+1
    OR prev."itemId" IS DISTINCT FROM NEW."itemId" OR (prev."itemId" IS NULL AND prev."contentId" IS NOT NULL AND
       NOT EXISTS(SELECT 1 FROM content WHERE id=NEW."contentId" AND "supersedesId"=prev."contentId"))
  THEN RAISE EXCEPTION 'invalid superseding evidence'; END IF;
 END IF;
 IF NEW."contentId" IS NOT NULL THEN
  SELECT origin INTO typ FROM content WHERE id=NEW."contentId";
  IF typ='book' AND NOT EXISTS(SELECT 1 FROM sources WHERE id=NEW."sourceId" AND "sourceType"='book')
  THEN RAISE EXCEPTION 'book origin requires book source'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER source_revision BEFORE INSERT ON source_entries FOR EACH ROW EXECUTE FUNCTION check_source_revision();

CREATE FUNCTION check_content_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ident uuid; c content; p content;
BEGIN
 ident := COALESCE(to_jsonb(NEW),to_jsonb(OLD))->>CASE WHEN TG_TABLE_NAME='content' THEN 'id' ELSE 'contentId' END;
 SELECT * INTO c FROM content WHERE id=ident;
 IF c.origin='book' AND NOT EXISTS(SELECT 1 FROM source_entries e JOIN sources s ON s.id=e."sourceId" WHERE e."contentId"=ident AND s."sourceType"='book' AND (c.status<>'approved' OR e."verificationStatus"='verified'))
 THEN RAISE EXCEPTION 'book content requires book evidence'; END IF;
 IF c."supersedesId" IS NULL AND c.revision<>1 THEN RAISE EXCEPTION 'first content revision must be one'; END IF;
 IF c."supersedesId" IS NOT NULL THEN
  SELECT * INTO p FROM content WHERE id=c."supersedesId";
  IF c.kind<>p.kind OR c.origin<>p.origin OR c.revision<>p.revision+1 THEN RAISE EXCEPTION 'invalid content revision'; END IF;
 END IF;
 IF c.kind='question' AND c.status='approved' THEN
  IF (c."payloadJson"->>'answerVerified') IS DISTINCT FROM 'true' OR (c."payloadJson"->>'targetsVerified') IS DISTINCT FROM 'true'
    OR NOT EXISTS(SELECT 1 FROM content_items ci JOIN items i ON i.id=ci."itemId" WHERE ci."contentId"=ident AND ci.role='target' AND i.status='approved')
  THEN RAISE EXCEPTION 'approved question requires verified answer and approved target'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER content_integrity AFTER INSERT ON content DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_content_integrity();
CREATE CONSTRAINT TRIGGER content_link_integrity AFTER INSERT OR UPDATE OR DELETE ON content_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_content_integrity();
