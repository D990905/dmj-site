-- ============================================================================
-- Phase C - Legacy auth-shim.js Bridge
-- 0001_initial.sql + 0002_rls_policies.sql 적용 후 실행
--
-- 목적: 기존 localStorage 기반 auth-shim.js 의 user/per-user 데이터 모델을
--       Supabase auth.users + profiles 위에 얹는 bridge.
--
-- 정책: 회원 2명 (Danny + 파트너) 이라 기존 데이터 마이그레이션은 X (option 1).
--       fresh start 로 Supabase 로 모든 신규 데이터 저장.
--
-- 변경:
--   1. profiles 테이블 확장 — 기존 auth-shim.js 회원 필드 추가
--   2. user_data 테이블 신규 — 기존 9개 localStorage namespace
--      (skill_assessment_v1, fmg_history, cart, consult_history, quotes_history,
--       orders, land_phase, water_stage, self_assessment_v1) 를
--      jsonb 로 통합 저장. 추후 Phase 13+ 에서 세분화 가능.
--   3. cart_items 테이블 신규 — 장바구니는 사용 빈도 높아 별도 테이블로 분리
--      (다른 namespace 보다 read/write 빈도 압도적)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. profiles 확장 — auth-shim.js 의 user fields 매핑
-- ─────────────────────────────────────────────────────────────────────────

-- 회원 등급 (commerce tier — Phase 12 의 speed_grade 와 별개 개념)
-- 9단계: 방문자 / 회원 / 단무지 / 단골 / 선주문 / 쥬니어팀 / 시니어팀 / 코어팀 / 관리자
alter table public.profiles
  add column if not exists tier text not null default 'member'
    check (tier in ('visitor','member','danmuji','dangol','preorder',
                    'junior','senior','core','admin')),
  add column if not exists tier_label text not null default '회원',
  add column if not exists tier_discount smallint not null default 0
    check (tier_discount between 0 and 100),

  -- 누적 구매액 — auto-upgrade 알고리즘에 사용
  add column if not exists total_spend_krw bigint not null default 0
    check (total_spend_krw >= 0),

  -- auth-shim.js 의 회원 입력 필드
  add column if not exists nickname text,
  add column if not exists gender text check (gender in ('m','f','other','')),
  add column if not exists birth_year smallint check (birth_year between 1900 and 2030),
  add column if not exists riding_start text,  -- 'YYYY-MM' 형식
  add column if not exists main_sports text[] not null default '{}',
    -- ['wing','foil','sup','surf','windsurf','kite']
  add column if not exists favorite_spot_text text;
    -- profiles.home_spot_id (FK) 와 별개. legacy text 입력 보존용.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. user_data — auth-shim.js per-user namespace 통합 저장
--    (user_id, suffix) 1:1. localStorage 키 dmj_user_<id>_<suffix> 와 동등.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.user_data (
  user_id uuid not null references public.profiles(id) on delete cascade,
  suffix text not null
    check (suffix in (
      'skill_assessment_v1',   -- 10축 스킬 진단 결과
      'self_assessment_v1',    -- 8동작 자가진단
      'fmg_history',           -- Find My Gear 추천 archive
      'land_phase',            -- 트레이닝 육상 stage
      'water_stage',           -- 트레이닝 해상 stage
      'consult_history',       -- 1:1 상담 신청 history
      'quotes_history',        -- 견적요청 history
      'orders'                 -- 주문 진행 timeline
      -- cart 는 별도 테이블 (아래 cart_items)
    )),
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, suffix)
);

create index user_data_user_idx on public.user_data(user_id);

create trigger user_data_updated_at
  before update on public.user_data
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. cart_items — 장바구니 (read/write 빈도 높음 → 별도 정형 테이블)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,           -- products.json sku
  variant_size text,                  -- '4.5m²', '105L' 등
  variant_color text,
  qty smallint not null default 1 check (qty > 0 and qty <= 99),
  unit_price_krw int not null check (unit_price_krw >= 0),
    -- 가격 snapshot. tier discount 는 client/server 별도 계산.
  notes text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cart_user_idx on public.cart_items(user_id, added_at desc);
create unique index cart_user_product_variant_uniq
  on public.cart_items(user_id, product_id, coalesce(variant_size,''), coalesce(variant_color,''));

create trigger cart_items_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RLS — 본인만 read/write
-- ─────────────────────────────────────────────────────────────────────────
alter table public.user_data enable row level security;

create policy "user_data_select_self"
  on public.user_data for select
  using (user_id = auth.uid());

create policy "user_data_insert_self"
  on public.user_data for insert
  with check (user_id = auth.uid());

create policy "user_data_update_self"
  on public.user_data for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_data_delete_self"
  on public.user_data for delete
  using (user_id = auth.uid());

create policy "user_data_admin_all"
  on public.user_data for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.cart_items enable row level security;

create policy "cart_items_self"
  on public.cart_items for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "cart_items_admin_read"
  on public.cart_items for select
  using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. handle_new_user trigger 보강 — 카카오 OAuth 메타데이터 매핑
--    Kakao 제공: { provider: 'kakao', name, picture, kakao_account: {...} }
--    profiles 의 nickname, avatar_url 자동 채움
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := new.email;
  v_provider text := new.raw_app_meta_data->>'provider';
  v_kakao_nickname text := new.raw_user_meta_data->>'name';
  v_kakao_picture text := new.raw_user_meta_data->>'picture';
  v_username text;
begin
  -- username: kakao_<id> 또는 email local-part. 충돌 회피.
  v_username := coalesce(
    new.raw_user_meta_data->>'username',
    case
      when v_provider = 'kakao' then 'kakao_' || substr(new.id::text, 1, 8)
      else split_part(coalesce(v_email,''), '@', 1)
    end,
    'rider_' || substr(new.id::text, 1, 8)
  );

  -- 중복 시 suffix 추가
  while exists (select 1 from public.profiles where username = v_username) loop
    v_username := v_username || '_' || substr(gen_random_uuid()::text, 1, 4);
  end loop;

  insert into public.profiles (
    id, username, display_name, nickname, avatar_url
  ) values (
    new.id,
    v_username,
    coalesce(v_kakao_nickname, v_email, v_username),
    v_kakao_nickname,
    v_kakao_picture
  );

  return new;
end;
$$;

-- trigger 는 0001 에서 이미 생성됨 → 함수만 교체

-- ─────────────────────────────────────────────────────────────────────────
-- 6. tier auto-upgrade 함수 — total_spend_krw 변경 시 자동 등급 승급
--    임계값: 단무지 100만원, 단골 300만원, 선주문 600만원 (Danny §175 추후 조정)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.recompute_tier()
returns trigger
language plpgsql
as $$
begin
  if new.tier = 'admin' then return new; end if;  -- admin 보호

  if new.total_spend_krw >= 6000000 then
    new.tier := 'preorder';
    new.tier_label := '선주문';
    new.tier_discount := 30;
  elsif new.total_spend_krw >= 3000000 then
    new.tier := 'dangol';
    new.tier_label := '단골 라이더';
    new.tier_discount := 20;
  elsif new.total_spend_krw >= 1000000 then
    new.tier := 'danmuji';
    new.tier_label := '단무지';
    new.tier_discount := 10;
  end if;
  return new;
end;
$$;

create trigger profiles_auto_tier
  before update of total_spend_krw on public.profiles
  for each row
  when (old.total_spend_krw is distinct from new.total_spend_krw)
  execute function public.recompute_tier();

-- ============================================================================
-- 끝. 적용 후 검증:
--   1. select column_name from information_schema.columns
--      where table_name='profiles' and column_name in
--      ('tier','total_spend_krw','nickname','gender','birth_year');
--   2. select * from public.user_data limit 0;  -- 빈 테이블 확인
--   3. select * from public.cart_items limit 0;
--   4. select rowsecurity from pg_tables where tablename in
--      ('user_data','cart_items');  -- t (RLS enabled)
-- ============================================================================
