-- Approved private inquiry contact capture. Applied with Supabase migration history version 20261016051314.
-- Prerequisites: existing auth.uid(), dmj_private.is_ops_admin(),
-- dmj_private.submit_attributed_inquiry(), public.ops_inquiries.
BEGIN;
CREATE TABLE dmj_private.inquiry_contacts (
 inquiry_id uuid PRIMARY KEY REFERENCES public.ops_inquiries(id) ON DELETE CASCADE,
 callback_name text NOT NULL,
 callback_phone text NOT NULL,
 consent_version text NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now(),
 reply_note text NOT NULL DEFAULT '',
 replied_at timestamptz,
 replied_by uuid
);
ALTER TABLE dmj_private.inquiry_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmj_private.inquiry_contacts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON dmj_private.inquiry_contacts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION dmj_private.submit_contact_inquiry_v2(
 p_id uuid,p_product text,p_size text,p_experience text,p_setup text,p_note text,
 p_consent text,p_campaign text,p_channel text,p_source_consent text,
 p_callback_name text,p_callback_phone text,p_contact_consent text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_id uuid:=auth.uid(); result_id uuid; normalized_phone text;
BEGIN
 IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_id IS NULL OR p_contact_consent IS DISTINCT FROM 'inquiry-contact-2026-10-16'
 OR p_callback_name IS NULL OR length(btrim(p_callback_name)) NOT BETWEEN 1 AND 80
 OR p_callback_name ~ '[[:cntrl:]]'
 OR p_callback_phone IS NULL OR length(p_callback_phone)>24
 OR p_callback_phone !~ '^\+?[0-9() .-]+$'
 OR length(regexp_replace(p_callback_phone,'[^0-9]','','g')) NOT BETWEEN 8 AND 15
 OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 600
 THEN RAISE EXCEPTION 'Invalid inquiry contact'; END IF;
 normalized_phone:=regexp_replace(btrim(p_callback_phone),'[() .-]','','g');
 PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 IF EXISTS(SELECT 1 FROM public.ops_inquiries WHERE id=p_id) THEN
  IF NOT EXISTS(SELECT 1 FROM public.ops_inquiries WHERE id=p_id AND user_id=owner_id)
  THEN RAISE EXCEPTION 'Inquiry owner mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dmj_private.inquiry_contacts WHERE inquiry_id=p_id)
  THEN RAISE EXCEPTION 'Use a new inquiry ID'; END IF;
  RETURN p_id;
 END IF;
 result_id:=dmj_private.submit_attributed_inquiry(p_id,p_product,p_size,p_experience,p_setup,p_note,p_consent,p_campaign,p_channel,p_source_consent);
 INSERT INTO dmj_private.inquiry_contacts(inquiry_id,callback_name,callback_phone,consent_version)
 VALUES(result_id,btrim(p_callback_name),normalized_phone,p_contact_consent);
 RETURN result_id;
END $$;

CREATE FUNCTION public.submit_contact_inquiry_v2(
 p_id uuid,p_product text,p_size text,p_experience text,p_setup text,p_note text,
 p_consent text,p_campaign text,p_channel text,p_source_consent text,
 p_callback_name text,p_callback_phone text,p_contact_consent text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT dmj_private.submit_contact_inquiry_v2(p_id,p_product,p_size,p_experience,p_setup,p_note,p_consent,p_campaign,p_channel,p_source_consent,p_callback_name,p_callback_phone,p_contact_consent)
$$;

CREATE FUNCTION dmj_private.ops_inquiry_contact(p_id uuid)
RETURNS TABLE(callback_name text,callback_phone text,reply_note text,replied_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(dmj_private.is_ops_admin(),false)
 THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 RETURN QUERY SELECT c.callback_name,c.callback_phone,c.reply_note,c.replied_at
 FROM dmj_private.inquiry_contacts c WHERE c.inquiry_id=p_id;
END $$;
CREATE FUNCTION public.ops_inquiry_contact(p_id uuid)
RETURNS TABLE(callback_name text,callback_phone text,reply_note text,replied_at timestamptz)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM dmj_private.ops_inquiry_contact(p_id) $$;

CREATE FUNCTION dmj_private.ops_record_inquiry_reply(p_id uuid,p_reply text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(dmj_private.is_ops_admin(),false)
 THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF p_reply IS NULL OR length(btrim(p_reply)) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'Invalid reply record'; END IF;
 UPDATE dmj_private.inquiry_contacts SET reply_note=btrim(p_reply),replied_at=now(),replied_by=auth.uid() WHERE inquiry_id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'No captured contact'; END IF;
 UPDATE public.ops_inquiries SET status=CASE WHEN status='new' THEN 'contacted' ELSE status END WHERE id=p_id;
 RETURN p_id;
END $$;
CREATE FUNCTION public.ops_record_inquiry_reply(p_id uuid,p_reply text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT dmj_private.ops_record_inquiry_reply(p_id,p_reply) $$;

REVOKE ALL ON FUNCTION dmj_private.submit_contact_inquiry_v2(uuid,text,text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.submit_contact_inquiry_v2(uuid,text,text,text,text,text,text,text,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION dmj_private.ops_inquiry_contact(uuid),public.ops_inquiry_contact(uuid),dmj_private.ops_record_inquiry_reply(uuid,text),public.ops_record_inquiry_reply(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION dmj_private.submit_contact_inquiry_v2(uuid,text,text,text,text,text,text,text,text,text,text,text,text),public.submit_contact_inquiry_v2(uuid,text,text,text,text,text,text,text,text,text,text,text,text),dmj_private.ops_inquiry_contact(uuid),public.ops_inquiry_contact(uuid),dmj_private.ops_record_inquiry_reply(uuid,text),public.ops_record_inquiry_reply(uuid,text) TO authenticated;
COMMIT;
