-- Existing recall objectives/history are untouched. Weekly and daily sessions coexist.
ALTER TABLE study_sessions DROP CONSTRAINT session_status;
ALTER TABLE study_sessions ADD CONSTRAINT session_status CHECK (status IN ('active','paused','completed') AND mode IN ('daily','weekly','test','practice'));
DROP INDEX sessions_one_open_daily;
CREATE UNIQUE INDEX sessions_one_open_daily ON study_sessions ("userId") WHERE mode='daily' AND status IN ('active','paused');
CREATE UNIQUE INDEX sessions_one_open_assessment ON study_sessions ("userId") WHERE mode IN ('weekly','test') AND status IN ('active','paused');
CREATE UNIQUE INDEX assessment_one_answer ON attempts ("sessionId","contentId") WHERE "cardId" IS NULL AND "contentId" IS NOT NULL;
CREATE INDEX assessment_bank ON content (kind,status);

CREATE FUNCTION preserve_assessment_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_mode text; before_timing jsonb; after_timing jsonb;
BEGIN
 IF TG_TABLE_NAME='study_sessions' THEN
  IF OLD.mode<>'daily' THEN
   IF NEW.mode<>OLD.mode OR NEW."selectionSeed"<>OLD."selectionSeed" OR NEW."startedAt"<>OLD."startedAt" OR NEW."timeBudgetMinutes"<>OLD."timeBudgetMinutes" OR (OLD.status='completed' AND (NEW.status<>'completed' OR NEW."endedAt" IS DISTINCT FROM OLD."endedAt")) THEN RAISE EXCEPTION 'assessment identity and completion are immutable'; END IF;
   before_timing:=OLD."assessmentResultJson"->'timing'; after_timing:=NEW."assessmentResultJson"->'timing';
   IF before_timing->>'startedAt' IS NOT NULL AND (after_timing->>'startedAt' IS DISTINCT FROM before_timing->>'startedAt' OR after_timing->>'deadline' IS DISTINCT FROM before_timing->>'deadline') THEN RAISE EXCEPTION 'reading deadline is immutable'; END IF;
   IF OLD.status='completed' AND after_timing IS DISTINCT FROM before_timing THEN RAISE EXCEPTION 'timed result is immutable'; END IF;
  END IF;
 ELSE
  SELECT mode INTO session_mode FROM study_sessions WHERE id=OLD."sessionId";
  IF session_mode<>'daily' THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'assessment response cannot be deleted'; END IF;
   IF NEW."primaryTargetItemId"<>OLD."primaryTargetItemId" OR NEW."contentId" IS DISTINCT FROM OLD."contentId" OR NEW."startedAt"<>OLD."startedAt" OR NEW."hintUsed"<>OLD."hintUsed" OR NEW."cardId" IS NOT NULL OR NEW."reviewLogId" IS NOT NULL OR (OLD."feedbackJson"->>'graded'='true' AND (NEW.outcome<>OLD.outcome OR NEW."feedbackJson"<>OLD."feedbackJson")) THEN RAISE EXCEPTION 'assessment response and final grade are immutable'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_assessment_session BEFORE UPDATE ON study_sessions FOR EACH ROW EXECUTE FUNCTION preserve_assessment_evidence();
CREATE TRIGGER preserve_assessment_attempt BEFORE UPDATE OR DELETE ON attempts FOR EACH ROW EXECUTE FUNCTION preserve_assessment_evidence();
