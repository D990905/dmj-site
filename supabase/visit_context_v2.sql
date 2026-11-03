-- Additive analytics context; NULL on legacy records means not collected.
alter table public.ops_visits add column if not exists context jsonb;
alter table public.ops_visits add constraint ops_visits_context_object check (context is null or jsonb_typeof(context)='object');
create or replace function public.ops_record_visit_v2(p_id uuid,p_session uuid,p_bucket text,p_page text,p_event text,p_consent text,p_context jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_consent is distinct from 'analytics-2026-11-03' or jsonb_typeof(p_context) is distinct from 'object' then raise exception 'Invalid analytics context';end if;
 -- Reuse existing validation, rate limiting, and idempotency under service_role.
 if not public.ops_record_visit(p_id,p_session,p_bucket,p_page,p_event,'analytics-2026-09-24') then return false;end if;
 update public.ops_visits set context=p_context,consent_version=p_consent where id=p_id and context is null;
 return true;
end $$;
revoke all on function public.ops_record_visit_v2(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ops_record_visit_v2(uuid,uuid,text,text,text,text,jsonb) to service_role;
