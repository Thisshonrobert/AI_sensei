-- Append one explicit ambiguity disposition, retaining the originally recorded grade.
CREATE OR REPLACE FUNCTION preserve_assessment_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE session_mode text; before_timing jsonb; after_timing jsonb; repair boolean;
BEGIN
 IF TG_TABLE_NAME='study_sessions' THEN
  IF NEW.mode<>OLD.mode THEN RAISE EXCEPTION 'session mode is immutable'; END IF;
  IF OLD.mode<>'daily' THEN
   IF NEW."selectionSeed"<>OLD."selectionSeed" OR NEW."startedAt"<>OLD."startedAt" OR NEW."timeBudgetMinutes"<>OLD."timeBudgetMinutes" OR (OLD.status='completed' AND (NEW.status<>'completed' OR NEW."endedAt" IS DISTINCT FROM OLD."endedAt")) THEN RAISE EXCEPTION 'assessment identity and completion are immutable'; END IF;
   before_timing:=OLD."assessmentResultJson"->'timing'; after_timing:=NEW."assessmentResultJson"->'timing';
   IF before_timing->>'startedAt' IS NOT NULL AND (after_timing->>'startedAt' IS DISTINCT FROM before_timing->>'startedAt' OR after_timing->>'deadline' IS DISTINCT FROM before_timing->>'deadline') THEN RAISE EXCEPTION 'reading deadline is immutable'; END IF;
   IF OLD.status='completed' AND after_timing IS DISTINCT FROM before_timing THEN RAISE EXCEPTION 'timed result is immutable'; END IF;
  END IF;
 ELSE
  SELECT mode INTO session_mode FROM study_sessions WHERE id=OLD."sessionId";
  IF session_mode<>'daily' THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'assessment response cannot be deleted'; END IF;
   repair:=NEW.outcome='ungraded' AND NEW."feedbackJson"->>'repairRequested'='true' AND COALESCE(OLD."feedbackJson"->>'repairRequested','false')='false' AND NEW."feedbackJson"->>'originalOutcome'=OLD.outcome
    AND (NEW."feedbackJson"-ARRAY['repairRequested','originalOutcome','reportedAt'])=(OLD."feedbackJson"-ARRAY['repairRequested','originalOutcome','reportedAt']);
   IF NEW."primaryTargetItemId"<>OLD."primaryTargetItemId" OR NEW."contentId" IS DISTINCT FROM OLD."contentId" OR NEW."startedAt"<>OLD."startedAt" OR NEW."hintUsed"<>OLD."hintUsed" OR NEW."cardId" IS NOT NULL OR NEW."reviewLogId" IS NOT NULL OR (OLD."feedbackJson"->>'graded'='true' AND (NEW.outcome<>OLD.outcome OR NEW."feedbackJson"<>OLD."feedbackJson") AND NOT COALESCE(repair,false)) THEN RAISE EXCEPTION 'assessment response and grade evidence are immutable'; END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
