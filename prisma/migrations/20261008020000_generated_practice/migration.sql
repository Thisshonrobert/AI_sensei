CREATE TABLE generation_runs (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 "sessionId" uuid, purpose text NOT NULL CHECK (purpose IN ('sentence','passage')),
 provider text NOT NULL DEFAULT 'manual-import' CHECK (provider='manual-import'),
 "modelId" text NOT NULL DEFAULT 'unknown', "promptVersion" text NOT NULL,
 "inputSnapshotJson" jsonb NOT NULL, "validatorVersion" text NOT NULL,
 "validationReportJson" jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'exported' CHECK (status IN ('exported','draft','approved','failed','hidden','retired')),
 "createdAt" timestamptz NOT NULL DEFAULT now(), "completedAt" timestamptz,
 FOREIGN KEY ("sessionId","userId") REFERENCES study_sessions(id,"userId") ON DELETE RESTRICT
);
CREATE INDEX generation_runs_owner ON generation_runs("userId","createdAt");
ALTER TABLE content ADD COLUMN "generationRunId" uuid REFERENCES generation_runs(id) ON DELETE RESTRICT;
CREATE FUNCTION preserve_generation_input() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.id<>OLD.id OR NEW."userId"<>OLD."userId" OR NEW."sessionId" IS DISTINCT FROM OLD."sessionId" OR NEW.purpose<>OLD.purpose OR NEW.provider<>OLD.provider OR NEW."promptVersion"<>OLD."promptVersion" OR NEW."inputSnapshotJson"<>OLD."inputSnapshotJson" OR NEW."createdAt"<>OLD."createdAt" THEN RAISE EXCEPTION 'generation input and ownership are immutable'; END IF;
 IF OLD.status IN ('approved','retired') AND (NEW."modelId"<>OLD."modelId" OR NEW."validationReportJson"<>OLD."validationReportJson" OR NEW."completedAt" IS DISTINCT FROM OLD."completedAt" OR NEW.status NOT IN ('approved','retired')) THEN RAISE EXCEPTION 'accepted generation evidence is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER generation_evidence BEFORE UPDATE OR DELETE ON generation_runs FOR EACH ROW EXECUTE FUNCTION preserve_generation_input();
CREATE FUNCTION check_generation_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."generationRunId" IS NOT NULL AND NEW.origin<>'generated' THEN RAISE EXCEPTION 'generation cannot claim source origin'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER generation_origin BEFORE INSERT ON content FOR EACH ROW EXECUTE FUNCTION check_generation_content();
