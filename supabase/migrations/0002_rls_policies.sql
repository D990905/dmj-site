-- ============================================================================
-- Phase 12 - Row-Level Security Policies
-- 0001_initial.sql 적용 후 실행
--
-- 원칙:
--   - 모든 테이블 RLS enable
--   - Default deny (policy 없으면 차단)
--   - Admin은 profiles.is_admin = true 인 user (Danny + 운영진)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: is_admin() 체크 함수
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- spots — 모두 read, admin만 write
-- ─────────────────────────────────────────────────────────────────────────
alter table public.spots enable row level security;

create policy "spots_select_all"
  on public.spots for select
  using (is_active or public.is_admin());

create policy "spots_admin_write"
  on public.spots for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — 본인 RW, 타인은 public 정보만 read
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles_select_self_or_public"
  on public.profiles for select
  using (
    id = auth.uid()
    or is_public = true
    or public.is_admin()
  );

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- is_admin은 self-elevation 금지
    and is_admin = (select is_admin from public.profiles where id = auth.uid())
  );

create policy "profiles_admin_all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- INSERT는 trigger가 처리 (handle_new_user) → user policy 불필요

-- ─────────────────────────────────────────────────────────────────────────
-- inventory — 본인 CRUD, 타인은 for_sale=true만 read
-- ─────────────────────────────────────────────────────────────────────────
alter table public.inventory enable row level security;

create policy "inventory_select"
  on public.inventory for select
  using (
    user_id = auth.uid()
    or for_sale = true
    or public.is_admin()
  );

create policy "inventory_insert_self"
  on public.inventory for insert
  with check (user_id = auth.uid());

create policy "inventory_update_self"
  on public.inventory for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "inventory_delete_self"
  on public.inventory for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- rides — 본인 CRUD, 타인은 profiles.is_public=true 인 경우만 read
-- ─────────────────────────────────────────────────────────────────────────
alter table public.rides enable row level security;

create policy "rides_select"
  on public.rides for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = rides.user_id and p.is_public = true
    )
    or public.is_admin()
  );

create policy "rides_insert_self"
  on public.rides for insert
  with check (user_id = auth.uid());

create policy "rides_update_self"
  on public.rides for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "rides_delete_self"
  on public.rides for delete
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- certifications — 본인 read+insert, 타인은 approved만 read, admin이 review
-- ─────────────────────────────────────────────────────────────────────────
alter table public.certifications enable row level security;

create policy "certs_select"
  on public.certifications for select
  using (
    user_id = auth.uid()
    or status = 'approved'
    or public.is_admin()
  );

create policy "certs_insert_self_pending"
  on public.certifications for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'                  -- 신청만 가능
    and reviewer_id is null
    and certified_at is null
  );

create policy "certs_admin_update"
  on public.certifications for update
  using (public.is_admin())
  with check (public.is_admin());

-- 사용자가 자기 신청을 취소(delete) 가능 (단 pending만)
create policy "certs_delete_self_pending"
  on public.certifications for delete
  using (user_id = auth.uid() and status = 'pending');

-- ─────────────────────────────────────────────────────────────────────────
-- posts — 모두 read, 본인 CRUD
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts enable row level security;

create policy "posts_select_all"
  on public.posts for select using (true);

create policy "posts_insert_self"
  on public.posts for insert
  with check (user_id = auth.uid());

create policy "posts_update_self"
  on public.posts for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "posts_delete_self"
  on public.posts for delete
  using (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- comments — 모두 read, 본인 CRUD
-- ─────────────────────────────────────────────────────────────────────────
alter table public.comments enable row level security;

create policy "comments_select_all"
  on public.comments for select using (true);

create policy "comments_insert_self"
  on public.comments for insert
  with check (user_id = auth.uid());

create policy "comments_update_self"
  on public.comments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "comments_delete_self"
  on public.comments for delete
  using (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- discount_inventory — 모두 read (active만), admin만 write
-- ─────────────────────────────────────────────────────────────────────────
alter table public.discount_inventory enable row level security;

create policy "discount_select"
  on public.discount_inventory for select
  using (is_active or public.is_admin());

create policy "discount_admin_write"
  on public.discount_inventory for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- consultations — 본인 RW, admin RW, 그 외 차단
-- ─────────────────────────────────────────────────────────────────────────
alter table public.consultations enable row level security;

create policy "consult_select_self_or_admin"
  on public.consultations for select
  using (user_id = auth.uid() or consultant_id = auth.uid() or public.is_admin());

create policy "consult_insert_self"
  on public.consultations for insert
  with check (user_id = auth.uid() and status = 'pending');

create policy "consult_update_self_or_consultant"
  on public.consultations for update
  using (
    user_id = auth.uid()
    or consultant_id = auth.uid()
    or public.is_admin()
  )
  with check (
    user_id = auth.uid()
    or consultant_id = auth.uid()
    or public.is_admin()
  );

-- ─────────────────────────────────────────────────────────────────────────
-- notifications — 본인만 read, system이 insert (service_role bypass)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

create policy "notif_select_self"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notif_update_self_read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT는 service_role (Edge Function)이 RLS bypass하여 처리
-- 일반 user는 알림 직접 생성 불가

-- ============================================================================
-- 끝. 침투 테스트 체크리스트:
--   1. anonymous로 모든 테이블 select → public-read 외 차단되는지
--   2. user A가 user B의 inventory(for_sale=false) 조회 → 차단
--   3. user가 cert status를 'approved'로 직접 update → 차단
--   4. user가 자기 profile에 is_admin=true 설정 → 차단
--   5. user가 타인의 ride delete → 차단
-- ============================================================================
