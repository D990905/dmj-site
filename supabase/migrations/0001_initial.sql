-- ============================================================================
-- Phase 12 - Initial Schema
-- 단무지공방 (dmjgroup.kr)
-- 생성일: 2026-05-05
--
-- 적용 순서:
--   0001_initial.sql        ← 본 파일 (테이블 + 인덱스 + 트리거)
--   0002_rls_policies.sql   ← RLS 정책 (별도 분리)
--   0003_seed_spots.sql     ← 한국 spot 초기 데이터
--
-- 설계 원칙:
--   - 모든 PK는 uuid (gen_random_uuid)
--   - 모든 timestamp는 timestamptz
--   - soft-delete 안 씀 (early stage; 필요 시 Phase 13에서 도입)
--   - jsonb는 conditions·request_data처럼 스키마가 진화하는 필드에만
--   - text[] 배열은 인덱스가 어려우므로 cardinality 낮은 곳에만 사용
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: updated_at 자동 갱신 trigger 함수
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. spots — 한국 라이딩 spot 카탈로그
--    seed data (0003_seed_spots.sql)에서 한강·동해·제주 주요 spot 채움
-- ─────────────────────────────────────────────────────────────────────────
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                       -- '한강 광나루', '양양 죽도', '제주 함덕'
  region text not null check (region in ('seoul','west','east','south','jeju')),
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  khoa_station_id text,                            -- 물때 매칭용 (서해·남해)
  best_wind_dir text,                              -- 'NW', 'S', 'NE-E' 등 자유 텍스트
  min_wind_kn smallint,                            -- 최소 풍속 (knot)
  max_wind_kn smallint,                            -- 최대 풍속
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index spots_region_idx on public.spots(region) where is_active;
create index spots_geo_idx on public.spots(lat, lng) where is_active;

create trigger spots_updated_at
  before update on public.spots
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 2. profiles — auth.users 1:1 확장
--    handle_new_user() trigger가 회원가입 시 자동 row 생성
-- ─────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  weight_kg smallint check (weight_kg between 30 and 200),
  height_cm smallint check (height_cm between 100 and 230),
  home_spot_id uuid references public.spots(id) on delete set null,

  -- 통계 (캐시; 정확도는 trigger로 동기화)
  total_rides int not null default 0,
  total_minutes int not null default 0,

  -- 인증 등급 (CERTIFICATION_SYSTEM.md 참조)
  speed_grade text not null default 'beginner'
    check (speed_grade in ('beginner','cruise','performance','race','pro')),
  skill_certs text[] not null default '{}',         -- ['heel-tacker','multi-jiber',...]
  combo_cert text check (combo_cert in ('pro-rider','master-rider','nt-track')),

  -- 공개 설정
  is_public boolean not null default false,         -- 라이딩 로그 공개 여부
  is_admin boolean not null default false,          -- Danny + 운영진

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles(username);
create index profiles_speed_grade_idx on public.profiles(speed_grade) where is_public;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 회원가입 시 profiles row 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username',
             'rider_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name',
             split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. inventory — 사용자 보유 장비
--    product_id는 정적 catalog products.json의 sku (예: 'levitaz-fw-680')
-- ─────────────────────────────────────────────────────────────────────────
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,                        -- products.json sku
  category text not null
    check (category in ('wing','foil-front','foil-stab','foil-mast','foil-fuselage',
                        'board','harness','helmet','vest','boots','other')),
  size text,                                       -- '4.5m²', '105L', '85cm'
  condition text not null default 'good'
    check (condition in ('new','like-new','good','fair','poor')),
  purchased_at date,
  purchase_price_krw int,
  notes text,
  for_sale boolean not null default false,
  asking_price_krw int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_user_idx on public.inventory(user_id);
create index inventory_product_idx on public.inventory(product_id);
create index inventory_for_sale_idx on public.inventory(for_sale, category) where for_sale;

create trigger inventory_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. rides — 라이딩 로그
--    conditions jsonb: {wind_kn, gust_kn, wave_m, water_temp_c, air_temp_c, ...}
-- ─────────────────────────────────────────────────────────────────────────
create table public.rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  spot_id uuid references public.spots(id) on delete set null,
  rode_at timestamptz not null,
  duration_min int not null check (duration_min > 0),
  max_speed_kn numeric(4,1),
  avg_speed_kn numeric(4,1),
  used_inventory_ids uuid[] not null default '{}',
  conditions jsonb not null default '{}',
  notes text,
  video_urls text[] not null default '{}',
  photo_urls text[] not null default '{}',
  is_certification_evidence boolean not null default false,  -- 인증 신청에 사용 표시
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rides_user_date_idx on public.rides(user_id, rode_at desc);
create index rides_spot_idx on public.rides(spot_id, rode_at desc);
create index rides_conditions_idx on public.rides using gin(conditions);

create trigger rides_updated_at
  before update on public.rides
  for each row execute function public.set_updated_at();

-- profiles.total_rides·total_minutes 캐시 동기화
create or replace function public.sync_profile_ride_stats()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles
      set total_rides = total_rides + 1,
          total_minutes = total_minutes + new.duration_min
      where id = new.user_id;
  elsif (tg_op = 'DELETE') then
    update public.profiles
      set total_rides = greatest(0, total_rides - 1),
          total_minutes = greatest(0, total_minutes - old.duration_min)
      where id = old.user_id;
  elsif (tg_op = 'UPDATE') and (old.duration_min <> new.duration_min) then
    update public.profiles
      set total_minutes = greatest(0, total_minutes - old.duration_min + new.duration_min)
      where id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger rides_sync_stats
  after insert or update or delete on public.rides
  for each row execute function public.sync_profile_ride_stats();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. certifications — 인증 신청·승인 history
-- ─────────────────────────────────────────────────────────────────────────
create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  cert_type text not null,                         -- 'heel-tacker','speed-pro','pro-rider' 등
  cert_category text not null
    check (cert_category in ('speed','skill','combo')),
  cert_method text not null
    check (cert_method in ('auto-gps','auto-video','coach-review','peer-review','self-declared')),
  evidence_ride_ids uuid[] not null default '{}',  -- rides 참조
  evidence_url text,                               -- Storage signed URL or external
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_notes text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','revoked')),
  certified_at timestamptz,
  expires_at date,                                 -- skill cert 1-2년 expiry; speed/combo는 null
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index certs_user_idx on public.certifications(user_id, status);
create index certs_pending_idx on public.certifications(status, created_at) where status = 'pending';
create index certs_type_idx on public.certifications(cert_type, status);

create trigger certs_updated_at
  before update on public.certifications
  for each row execute function public.set_updated_at();

-- 인증 승인 시 profiles의 skill_certs / combo_cert / speed_grade 동기화
create or replace function public.apply_certification()
returns trigger
language plpgsql
as $$
begin
  if (new.status = 'approved' and (old.status is null or old.status <> 'approved')) then
    if new.cert_category = 'skill' then
      update public.profiles
        set skill_certs = array(select distinct unnest(skill_certs || array[new.cert_type]))
        where id = new.user_id;
    elsif new.cert_category = 'speed' then
      update public.profiles
        set speed_grade = case new.cert_type
          when 'speed-beginner' then 'beginner'
          when 'speed-cruise' then 'cruise'
          when 'speed-performance' then 'performance'
          when 'speed-race' then 'race'
          when 'speed-pro' then 'pro'
          else speed_grade
        end
        where id = new.user_id;
    elsif new.cert_category = 'combo' then
      update public.profiles
        set combo_cert = new.cert_type
        where id = new.user_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger certs_apply_to_profile
  after insert or update on public.certifications
  for each row execute function public.apply_certification();

-- ─────────────────────────────────────────────────────────────────────────
-- 6. posts — 커뮤니티 게시글
-- ─────────────────────────────────────────────────────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null
    check (type in ('ride-log','question','review','event','tip')),
  title text not null,
  body text,
  spot_id uuid references public.spots(id) on delete set null,
  ride_id uuid references public.rides(id) on delete set null,
  product_ids text[] not null default '{}',        -- review 시 제품 sku
  media_urls text[] not null default '{}',
  view_count int not null default 0,
  like_count int not null default 0,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_type_date_idx on public.posts(type, created_at desc);
create index posts_user_idx on public.posts(user_id, created_at desc);
create index posts_spot_idx on public.posts(spot_id, created_at desc);

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. comments — 게시글 댓글 (대댓글 포함)
-- ─────────────────────────────────────────────────────────────────────────
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_post_idx on public.comments(post_id, created_at);
create index comments_parent_idx on public.comments(parent_comment_id);

create trigger comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 8. discount_inventory — 단무지 재고 할인 풀
--    matched_user_ids는 추천 알고리즘이 채움 (notification 발송 추적용)
-- ─────────────────────────────────────────────────────────────────────────
create table public.discount_inventory (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,                        -- products.json sku
  size text,
  condition text not null default 'new'
    check (condition in ('new','demo','b-stock','last-stock')),
  base_price_krw int not null check (base_price_krw > 0),
  discount_price_krw int not null check (discount_price_krw > 0),
  discount_pct smallint generated always as
    (round(100.0 - (discount_price_krw::numeric / base_price_krw * 100))::smallint) stored,
  reason text,                                     -- 'last-stock','demo','discontinued'
  available_until date,
  matched_user_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index discount_active_idx on public.discount_inventory(is_active, available_until)
  where is_active;
create index discount_product_idx on public.discount_inventory(product_id) where is_active;

create trigger discount_updated_at
  before update on public.discount_inventory
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 9. consultations — 컨설팅 요청·답변
-- ─────────────────────────────────────────────────────────────────────────
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null
    check (type in ('spot-recommendation','tour-planning','gear-purchase','skill-feedback','other')),
  request_data jsonb not null default '{}',        -- {spot_id, target_date, target_skill, budget, ...}
  recommendation jsonb,                            -- {gear: [...], conditions: {...}, notes: ...}
  consultant_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','in-progress','completed','cancelled')),
  user_satisfaction smallint check (user_satisfaction between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index consult_user_idx on public.consultations(user_id, created_at desc);
create index consult_pending_idx on public.consultations(status, created_at)
  where status in ('pending','in-progress');

create trigger consult_updated_at
  before update on public.consultations
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 10. notifications — 알림 큐 (재고 매칭, 인증 결과, 댓글 등)
-- ─────────────────────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null
    check (type in ('discount-match','cert-approved','cert-rejected',
                    'comment-reply','consultation-update','event','system')),
  title text not null,
  body text,
  link_url text,                                   -- 클릭 시 이동
  related_id uuid,                                 -- 관련 cert/discount/post id
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notif_user_unread_idx on public.notifications(user_id, is_read, created_at desc);

-- ============================================================================
-- 끝.
-- 다음 migration: 0002_rls_policies.sql 에서 RLS enable + policy 정의
-- ============================================================================
