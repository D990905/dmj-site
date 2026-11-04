-- Purchase application feature. Starts disabled with no merchant account configured.
-- Activation requires confirmed merchant, delivery, notification and retention settings.
-- No merchant account, customer data, supplier costs or credentials belong here.
BEGIN;
CREATE TABLE dmj_private.purchase_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 bank_name text, bank_account text, account_holder text,
 shipping_fee_krw integer CHECK(shipping_fee_krw>=0), shipping_scope text,
 delivery_basis text, retention_days integer CHECK(retention_days BETWEEN 1 AND 3650),
 privacy_notice text, notification_destination_confirmed boolean NOT NULL DEFAULT false,
 retention_operation_confirmed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO dmj_private.purchase_settings(id) VALUES(true);
ALTER TABLE dmj_private.purchase_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmj_private.purchase_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON dmj_private.purchase_settings FROM PUBLIC,anon,authenticated;
CREATE TABLE dmj_private.purchase_offers (
 product_id text PRIMARY KEY, product_name text NOT NULL, option_name text NOT NULL,
 regular_price_krw integer NOT NULL CHECK(regular_price_krw>0), sale_price_krw integer NOT NULL CHECK(sale_price_krw>0),
 ends_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true
);
INSERT INTO dmj_private.purchase_offers VALUES
 ('lvz-boom-fs63','BOOM FS SCC Hybrid 63','63 L / SCC Hybrid',3190000,2890000,'2026-11-09T00:00:00+09:00',true),
 ('lvz-boom-fs83','BOOM FS SCC Hybrid 83','83 L / SCC Hybrid',3290000,2950000,'2026-11-09T00:00:00+09:00',true),
 ('lvz-boom-fs95','BOOM FS SCC Hybrid 95','95 L / SCC Hybrid',3390000,2990000,'2026-11-09T00:00:00+09:00',true);
ALTER TABLE dmj_private.purchase_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmj_private.purchase_offers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON dmj_private.purchase_offers FROM PUBLIC,anon,authenticated;
CREATE TABLE dmj_private.purchase_applications (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id), product_id text NOT NULL,
 product_name text NOT NULL, option_name text NOT NULL, quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 20),
 unit_price_krw integer NOT NULL, shipping_fee_krw integer NOT NULL, total_krw bigint NOT NULL,
 status text NOT NULL DEFAULT 'awaiting_payment' CHECK(status IN ('awaiting_payment','payment_review','paid','cancelled','fulfilled')),
 buyer_name text, buyer_phone text, recipient_name text, recipient_phone text,
 postcode text, address text, address_detail text, country text, note text,
 consent_version text NOT NULL, consent_snapshot text NOT NULL, settings_version timestamptz NOT NULL,
 bank_snapshot jsonb NOT NULL, request_payload jsonb NOT NULL,
 contact_expires_at timestamptz NOT NULL, contacts_erased_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX purchase_applications_owner_created ON dmj_private.purchase_applications(user_id,created_at DESC);
ALTER TABLE dmj_private.purchase_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmj_private.purchase_applications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON dmj_private.purchase_applications FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.purchase_application_config() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s dmj_private.purchase_settings%ROWTYPE;
BEGIN
 SELECT * INTO s FROM dmj_private.purchase_settings WHERE id;
 IF NOT s.enabled OR s.bank_name IS NULL OR s.bank_account IS NULL OR s.account_holder IS NULL OR s.shipping_fee_krw IS NULL OR s.shipping_scope IS NULL OR s.delivery_basis IS NULL OR s.retention_days IS NULL OR s.privacy_notice IS NULL OR NOT s.notification_destination_confirmed OR NOT s.retention_operation_confirmed THEN RETURN jsonb_build_object('enabled',false); END IF;
 RETURN jsonb_build_object('enabled',true,'version',s.updated_at,'shipping_fee_krw',s.shipping_fee_krw,'shipping_scope',s.shipping_scope,'delivery_basis',s.delivery_basis,'retention_days',s.retention_days,'privacy_notice',s.privacy_notice,'offers',(SELECT jsonb_agg(to_jsonb(o)) FROM dmj_private.purchase_offers o WHERE active AND ends_at>now()));
END $$;
CREATE FUNCTION public.purchase_application_receipt(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r dmj_private.purchase_applications%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 SELECT * INTO r FROM dmj_private.purchase_applications WHERE id=p_id AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'application_unavailable'; END IF;
 RETURN jsonb_build_object('id',r.id,'product_name',r.product_name,'option',r.option_name,'quantity',r.quantity,'unit_price_krw',r.unit_price_krw,'shipping_fee_krw',r.shipping_fee_krw,'total_krw',r.total_krw,'status',r.status,'bank',r.bank_snapshot,'created_at',r.created_at);
END $$;
CREATE FUNCTION public.submit_purchase_application(p_id uuid,p_settings_version timestamptz,p_product text,p_option text,p_quantity integer,p_contact jsonb,p_consent text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s dmj_private.purchase_settings%ROWTYPE;o dmj_private.purchase_offers%ROWTYPE; existing dmj_private.purchase_applications%ROWTYPE;uid uuid:=auth.uid();payload jsonb;field text;v text;reference text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'authentication_required';END IF;
 SELECT * INTO s FROM dmj_private.purchase_settings WHERE id FOR SHARE;
 IF NOT s.enabled THEN RAISE EXCEPTION 'purchase_not_ready';END IF;
 IF p_settings_version IS DISTINCT FROM s.updated_at THEN RAISE EXCEPTION 'settings_changed';END IF;
 IF p_id IS NULL OR p_consent IS DISTINCT FROM 'purchase-2026-11-04-v1' OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 20 OR p_contact IS NULL OR jsonb_typeof(p_contact)<>'object' OR pg_column_size(p_contact)>16000 OR (p_contact-ARRAY['buyer_name','buyer_phone','recipient_name','recipient_phone','postcode','address','address_detail','country','note'])<>'{}'::jsonb THEN RAISE EXCEPTION 'invalid_application';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_contact) e WHERE jsonb_typeof(e.value)<>'string') THEN RAISE EXCEPTION 'invalid_contact';END IF;
 FOR field IN SELECT unnest(ARRAY['buyer_name','buyer_phone','recipient_name','recipient_phone','postcode','address','country']) LOOP
  v:=btrim(p_contact->>field);IF v IS NULL OR length(v)<1 OR length(v)>300 OR v~'[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_contact';END IF;
 END LOOP;
 IF length(p_contact->>'buyer_name')>80 OR length(p_contact->>'recipient_name')>80 OR length(coalesce(p_contact->>'address_detail',''))>200 OR length(coalesce(p_contact->>'note',''))>600 OR length(p_contact->>'postcode')>20 OR length(p_contact->>'country')>80 THEN RAISE EXCEPTION 'invalid_contact';END IF;
 FOR field IN SELECT unnest(ARRAY['buyer_phone','recipient_phone']) LOOP
  v:=p_contact->>field;IF length(v)>24 OR v!~'^\+?[0-9() .-]+$' OR length(regexp_replace(v,'[^0-9]','','g')) NOT BETWEEN 8 AND 15 THEN RAISE EXCEPTION 'invalid_phone';END IF;
 END LOOP;
 payload:=jsonb_build_object('product',p_product,'option',p_option,'quantity',p_quantity,'contact',p_contact,'consent',p_consent,'settings',p_settings_version);
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT * INTO existing FROM dmj_private.purchase_applications WHERE id=p_id;
 IF FOUND THEN
  IF existing.user_id<>uid OR existing.request_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'application_conflict';END IF;
  RETURN public.purchase_application_receipt(p_id);
 END IF;
 IF (SELECT count(*) FROM dmj_private.purchase_applications WHERE user_id=uid AND created_at>now()-interval '1 day')>=20 OR EXISTS(SELECT 1 FROM dmj_private.purchase_applications WHERE user_id=uid AND created_at>now()-interval '30 seconds') THEN RAISE EXCEPTION 'try_later';END IF;
 SELECT * INTO o FROM dmj_private.purchase_offers WHERE product_id=p_product AND option_name=p_option AND active FOR SHARE;
 IF NOT FOUND OR o.ends_at<=now() THEN RAISE EXCEPTION 'offer_unavailable';END IF;
 IF s.bank_name IS NULL OR s.bank_account IS NULL OR s.account_holder IS NULL OR s.shipping_fee_krw IS NULL OR s.shipping_scope IS NULL OR s.delivery_basis IS NULL OR s.retention_days IS NULL OR s.privacy_notice IS NULL OR NOT s.notification_destination_confirmed OR NOT s.retention_operation_confirmed THEN RAISE EXCEPTION 'purchase_not_ready';END IF;
 INSERT INTO dmj_private.purchase_applications(id,user_id,product_id,product_name,option_name,quantity,unit_price_krw,shipping_fee_krw,total_krw,buyer_name,buyer_phone,recipient_name,recipient_phone,postcode,address,address_detail,country,note,consent_version,consent_snapshot,settings_version,bank_snapshot,request_payload,contact_expires_at)
 VALUES(p_id,uid,p_product,o.product_name,p_option,p_quantity,o.sale_price_krw,s.shipping_fee_krw,o.sale_price_krw::bigint*p_quantity+s.shipping_fee_krw,btrim(p_contact->>'buyer_name'),btrim(p_contact->>'buyer_phone'),btrim(p_contact->>'recipient_name'),btrim(p_contact->>'recipient_phone'),btrim(p_contact->>'postcode'),btrim(p_contact->>'address'),btrim(coalesce(p_contact->>'address_detail','')),btrim(p_contact->>'country'),btrim(coalesce(p_contact->>'note','')),p_consent,s.privacy_notice,s.updated_at,jsonb_build_object('bank_name',s.bank_name,'account',s.bank_account,'holder',s.account_holder),payload,now()+make_interval(days=>s.retention_days));
 reference:='구매 신청 · 접수번호 '||p_id::text||E'\n상품: '||o.product_name||' · '||p_quantity||'개 · 입금 확인 대기';
 -- Existing inquiry insert trigger queues the existing operator LMS. No customer contact or address is copied into the notification source.
 INSERT INTO public.ops_inquiries(id,user_id,product_id,size,experience,setup,note,consent_version,status) VALUES(p_id,uid,p_product,p_option,'','',reference,p_consent,'new');
 RETURN public.purchase_application_receipt(p_id);
END $$;
CREATE FUNCTION public.ops_purchase_applications() RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(dmj_private.is_ops_admin(),false) THEN RAISE EXCEPTION 'administrator_required';END IF;
 RETURN QUERY SELECT to_jsonb(a)-'request_payload'-'bank_snapshot' FROM dmj_private.purchase_applications a ORDER BY created_at DESC LIMIT 200;
END $$;
CREATE FUNCTION public.ops_purchase_settings() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF auth.uid() IS NULL OR NOT coalesce(dmj_private.is_ops_admin(),false) THEN RAISE EXCEPTION 'administrator_required';END IF;RETURN (SELECT to_jsonb(s) FROM dmj_private.purchase_settings s WHERE id);END $$;
CREATE FUNCTION public.ops_save_purchase_settings(p_settings jsonb,p_expected timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s dmj_private.purchase_settings%ROWTYPE;onoff boolean:=coalesce((p_settings->>'enabled')::boolean,false);
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(dmj_private.is_ops_admin(),false) THEN RAISE EXCEPTION 'administrator_required';END IF;
 IF p_settings IS NULL OR jsonb_typeof(p_settings)<>'object' OR pg_column_size(p_settings)>16000 THEN RAISE EXCEPTION 'invalid_settings';END IF;
 SELECT * INTO s FROM dmj_private.purchase_settings WHERE id FOR UPDATE;IF p_expected IS DISTINCT FROM s.updated_at THEN RAISE EXCEPTION 'settings_changed';END IF;
 IF onoff AND (length(btrim(coalesce(p_settings->>'bank_name','')))<1 OR length(btrim(coalesce(p_settings->>'bank_account','')))<1 OR length(btrim(coalesce(p_settings->>'account_holder','')))<1 OR (p_settings->>'shipping_fee_krw') IS NULL OR (p_settings->>'shipping_fee_krw')::integer<0 OR length(btrim(coalesce(p_settings->>'shipping_scope','')))<1 OR length(btrim(coalesce(p_settings->>'delivery_basis','')))<1 OR nullif(p_settings->>'retention_days','') IS NULL OR (p_settings->>'retention_days')::integer NOT BETWEEN 1 AND 3650 OR length(btrim(coalesce(p_settings->>'privacy_notice','')))<1 OR NOT coalesce((p_settings->>'notification_destination_confirmed')::boolean,false) OR NOT coalesce((p_settings->>'retention_operation_confirmed')::boolean,false)) THEN RAISE EXCEPTION 'merchant_settings_incomplete';END IF;
 UPDATE dmj_private.purchase_settings SET enabled=onoff,bank_name=nullif(btrim(p_settings->>'bank_name'),''),bank_account=nullif(btrim(p_settings->>'bank_account'),''),account_holder=nullif(btrim(p_settings->>'account_holder'),''),shipping_fee_krw=(p_settings->>'shipping_fee_krw')::integer,shipping_scope=nullif(btrim(p_settings->>'shipping_scope'),''),delivery_basis=nullif(btrim(p_settings->>'delivery_basis'),''),retention_days=(p_settings->>'retention_days')::integer,privacy_notice=nullif(btrim(p_settings->>'privacy_notice'),''),notification_destination_confirmed=coalesce((p_settings->>'notification_destination_confirmed')::boolean,false),retention_operation_confirmed=coalesce((p_settings->>'retention_operation_confirmed')::boolean,false),updated_at=clock_timestamp() WHERE id;
 RETURN true;
END $$;
CREATE FUNCTION public.ops_transition_purchase_application(p_id uuid,p_status text,p_expected timestamptz,p_payment_confirmed boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r dmj_private.purchase_applications%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(dmj_private.is_ops_admin(),false) THEN RAISE EXCEPTION 'administrator_required';END IF;
 SELECT * INTO r FROM dmj_private.purchase_applications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'application_changed';END IF;
 IF NOT coalesce(((p_status='paid' AND p_payment_confirmed AND r.status IN ('awaiting_payment','payment_review')) OR (p_status='fulfilled' AND r.status='paid') OR (p_status='cancelled' AND r.status IN ('awaiting_payment','payment_review'))),false) THEN RAISE EXCEPTION 'invalid_status_transition';END IF;
 UPDATE dmj_private.purchase_applications SET status=p_status,updated_at=clock_timestamp() WHERE id=p_id;RETURN true;
END $$;
-- Retention worker: redact contact fields and request copies only, preserve accounting/product/status records.
CREATE FUNCTION dmj_private.erase_expired_purchase_contacts() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;BEGIN UPDATE dmj_private.purchase_applications SET buyer_name=NULL,buyer_phone=NULL,recipient_name=NULL,recipient_phone=NULL,postcode=NULL,address=NULL,address_detail=NULL,country=NULL,note=NULL,request_payload='{}',contacts_erased_at=now() WHERE contact_expires_at<=now() AND contacts_erased_at IS NULL;GET DIAGNOSTICS n=ROW_COUNT;RETURN n;END $$;
REVOKE ALL ON FUNCTION public.purchase_application_config(),public.purchase_application_receipt(uuid),public.submit_purchase_application(uuid,timestamptz,text,text,integer,jsonb,text),public.ops_purchase_applications(),public.ops_purchase_settings(),public.ops_save_purchase_settings(jsonb,timestamptz),public.ops_transition_purchase_application(uuid,text,timestamptz,boolean),dmj_private.erase_expired_purchase_contacts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_application_config() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_application_receipt(uuid),public.submit_purchase_application(uuid,timestamptz,text,text,integer,jsonb,text),public.ops_purchase_applications(),public.ops_purchase_settings(),public.ops_save_purchase_settings(jsonb,timestamptz),public.ops_transition_purchase_application(uuid,text,timestamptz,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION dmj_private.erase_expired_purchase_contacts() TO service_role;
-- Existing pg_cron runs only this feature's configured, expired contact cleanup.
SELECT cron.schedule('dmj_purchase_contact_retention','17 * * * *','SELECT dmj_private.erase_expired_purchase_contacts()');
COMMIT;
