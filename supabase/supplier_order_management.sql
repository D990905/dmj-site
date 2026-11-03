create table public.ops_supplier_lists (
 id uuid primary key default gen_random_uuid(),source_key text unique,name text not null check(length(name) between 1 and 120),
 status text not null default 'draft' check(status in ('draft','ready')),revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.ops_supplier_items (
 id uuid primary key default gen_random_uuid(),list_id uuid not null references public.ops_supplier_lists(id),source_key text unique,
 list_group text not null check(list_group in ('undelivered','additional')),
 model text not null check(length(model) between 1 and 120 and model ~ '^[ -~]+$'),
 size text not null default '' check(length(size)<=80 and size ~ '^[ -~]*$'),
 quantity integer check(quantity between 1 and 10000),
 amount_paid numeric(14,2) check(amount_paid between 0 and 999999999999.99),
 planned_unit_cost numeric(14,2) check(planned_unit_cost between 0 and 999999999999.99),
 currency text check(currency ~ '^[A-Z]{3}$'),
 status text not null check(status in ('planned','undelivered','shipped','received','cancelled')),
 notes text not null default '' check(length(notes)<=1000 and notes ~ '^[ -~]*$'),
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check (list_group='additional' or planned_unit_cost is null),
 check (quantity is null or planned_unit_cost is null or quantity*planned_unit_cost<=999999999999.99)
);
alter table public.ops_supplier_lists enable row level security;
alter table public.ops_supplier_items enable row level security;
revoke all on public.ops_supplier_lists,public.ops_supplier_items from anon,authenticated;
grant select,insert,update on public.ops_supplier_lists,public.ops_supplier_items to authenticated;
create policy supplier_lists_admin on public.ops_supplier_lists for all to authenticated using ((select public.is_ops_admin())) with check ((select public.is_ops_admin()));
create policy supplier_items_admin on public.ops_supplier_items for all to authenticated using ((select public.is_ops_admin())) with check ((select public.is_ops_admin()));
create function public.ops_supplier_list_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.revision<>1 or new.status<>'draft' then raise exception 'New list must be a draft';end if;
 else
  if new.id<>old.id or new.source_key is distinct from old.source_key or new.revision<>old.revision+1 then raise exception 'Revision conflict';end if;
  if new.status='ready' then
   if not exists(select 1 from public.ops_supplier_items where list_id=new.id and status<>'cancelled') or exists(select 1 from public.ops_supplier_items where list_id=new.id and status<>'cancelled' and (quantity is null or ((amount_paid is not null or planned_unit_cost is not null) and currency is null))) then raise exception 'Confirm quantities and currencies before completing this list';end if;
  end if;
 end if;
 new.updated_at=clock_timestamp();return new;
end $$;
create trigger supplier_list_guard before insert or update on public.ops_supplier_lists for each row execute function public.ops_supplier_list_guard();
create function public.ops_supplier_item_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare current_status text;
begin
 select status into current_status from public.ops_supplier_lists where id=new.list_id for update;
 if current_status is distinct from 'draft' then raise exception 'Reopen the list before editing';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.list_id<>old.list_id or new.source_key is distinct from old.source_key or new.revision<>old.revision+1 then raise exception 'Revision conflict';end if;
 elsif new.revision<>1 then raise exception 'New item revision must be 1';end if;
 update public.ops_supplier_lists set revision=revision+1 where id=new.list_id;
 new.updated_at=clock_timestamp();return new;
end $$;
create trigger supplier_item_guard before insert or update on public.ops_supplier_items for each row execute function public.ops_supplier_item_guard();
revoke all on function public.ops_supplier_list_guard(),public.ops_supplier_item_guard() from public,anon,authenticated;
grant execute on function public.ops_supplier_list_guard(),public.ops_supplier_item_guard() to authenticated;
create index supplier_items_list_idx on public.ops_supplier_items(list_id,created_at,id);
