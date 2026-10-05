-- A published revision includes its target/support links. Adding a link later
-- must create a new Content revision rather than changing historical targets.
CREATE FUNCTION guard_content_link_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE inserted_by xid;
BEGIN
 SELECT xmin INTO inserted_by FROM content WHERE id=NEW."contentId";
 IF inserted_by IS DISTINCT FROM pg_current_xact_id()::xid
 THEN RAISE EXCEPTION 'immutable content links: create links with the content revision'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER content_link_insert BEFORE INSERT ON content_items FOR EACH ROW EXECUTE FUNCTION guard_content_link_insert();
