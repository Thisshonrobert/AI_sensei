ALTER TABLE study_sessions ADD COLUMN "elapsedActiveMs" integer NOT NULL DEFAULT 0;
ALTER TABLE study_sessions ADD COLUMN "activeSince" timestamptz;
ALTER TABLE study_sessions ADD CONSTRAINT session_elapsed_nonnegative CHECK ("elapsedActiveMs" >= 0);
-- No historical duration is invented for sessions created before this migration.
UPDATE study_sessions SET "activeSince" = CURRENT_TIMESTAMP WHERE status = 'active';

CREATE FUNCTION check_grammar_comparison() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ident uuid; c content; p jsonb; pattern_id uuid; sample jsonb;
BEGIN
 ident := (to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='content' THEN 'id' ELSE 'contentId' END)::uuid;
 SELECT * INTO c FROM content WHERE id=ident;
 p := c."payloadJson";
 IF c.status <> 'approved' OR p->>'explanationType' IS DISTINCT FROM 'grammar_comparison' THEN RETURN NULL; END IF;
 IF c.kind <> 'explanation' OR jsonb_typeof(p->'grammarItemIds') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'examples') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'comparison requires explicit pattern and example arrays'; END IF;
 IF jsonb_array_length(p->'grammarItemIds')<>2 OR jsonb_array_length(p->'examples')<>2 OR p->'grammarItemIds'->>0 IS NOT DISTINCT FROM p->'grammarItemIds'->>1
   OR jsonb_typeof(p->'difference') IS DISTINCT FROM 'string' OR length(trim(p->>'difference'))=0 OR length(p->>'difference')>4000
   OR (SELECT count(DISTINCT x->>'grammarItemId') FROM jsonb_array_elements(p->'examples') x)<>2
 THEN RAISE EXCEPTION 'comparison needs two distinct patterns and one example each'; END IF;
 FOR pattern_id IN SELECT value::uuid FROM jsonb_array_elements_text(p->'grammarItemIds') LOOP
  IF NOT EXISTS(SELECT 1 FROM items i JOIN content_items ci ON ci."itemId"=i.id WHERE i.id=pattern_id AND i.kind='grammar' AND i.status='approved' AND ci."contentId"=ident)
  THEN RAISE EXCEPTION 'comparison must link both approved grammar items'; END IF;
  SELECT x INTO sample FROM jsonb_array_elements(p->'examples') x WHERE (x->>'grammarItemId')::uuid=pattern_id;
  IF sample IS NULL OR NOT EXISTS(SELECT 1 FROM content s JOIN content_items ci ON ci."contentId"=s.id WHERE s.id=(sample->>'contentId')::uuid AND s.kind='sentence' AND s.status='approved' AND ci."itemId"=pattern_id AND jsonb_typeof(s."payloadJson"->'japanese')='string' AND length(trim(s."payloadJson"->>'japanese'))>0)
  THEN RAISE EXCEPTION 'comparison example must be an approved sentence linked to its pattern'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER grammar_comparison_integrity AFTER INSERT ON content DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_grammar_comparison();
CREATE CONSTRAINT TRIGGER grammar_comparison_links AFTER INSERT ON content_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_grammar_comparison();
