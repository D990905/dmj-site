-- ============================================================================
-- Phase 12 — 0004 Riding Sessions + Storage (gap 보강)
-- 단무지공방 (dmjgroup.kr)
-- 생성일: 2026-06-10
--
-- 적용 순서: 0001 → 0002 → 0003 → 0004 (본 파일)
--
-- 목적 (spec: _experts/phase12_supabase_backend_spec.md):
--   1) user_data CHECK hotfix — 'gear'·'profile_extra' suffix 허용
--      (클라이언트 §184/§187 이 써 왔으나 CHECK 위반으로 서버 저장 실패해 온
--       버그 수정. 2026-05-25 장비 소실의 유력 원인.)
--   2) riding_sessions — 라이딩 대시보드 분석 세션(rd_sessions_v1) cloud 백업
--   3) riding_files   — GPX/영상 파일 메타 + Supabase Storage 경로
--   4) Storage 버킷(tracks·videos) RLS 정책
--
-- 설계 원칙 (0001 과 동일):
--   - PK uuid (gen_random_uuid), timestamp timestamptz
--   - 자주 쿼리/정렬하는 지표만 정형 컬럼, 진화하는 분석치는 jsonb
--   - RLS: 본인(auth.uid()) RW + is_admin() all  (0002 스타일)
--
-- ⚠️ 순수 ADDITIVE — DROP TABLE / DROP COLUMN 없음. CHECK 교체는 기존 행에 무해.
-- ⚠️ Storage 정책 섹션(맨 아래)은 Dashboard 에서 tracks·videos 버킷을
--    먼저 생성한 뒤 실행할 것 (runbook §C).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 1. user_data CHECK hotfix — gear · profile_extra 허용
--    (0003 의 user_data_suffix_check 를 교체. 기존 8개 + 신규 2개)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.user_data
  drop constraint if exists user_data_suffix_check;

alter table public.user_data
  add constraint user_data_suffix_check
  check (suffix in (
    'skill_assessment_v1',   -- 10축 스킬 진단 결과
    'self_assessment_v1',    -- 8동작 자가진단
    'fmg_history',           -- Find My Gear 추천 archive
    'land_phase',            -- 트레이닝 육상 stage
    'water_stage',           -- 트레이닝 해상 stage
    'consult_history',       -- 1:1 상담 신청 history
    'quotes_history',        -- 견적요청 history
    'orders',                -- 주문 진행 timeline
    'gear',                  -- §184 장비 컬렉션 (← 신규 허용)
    'profile_extra'          -- §187 확장 프로필 필드 (← 신규 허용)
  ));


-- ─────────────────────────────────────────────────────────────────────────
-- 2. riding_sessions — 라이딩 대시보드 분석 세션 (rd_sessions_v1 미러)
--    기존 public.rides(수동 로그/인증 플로우)와는 별개. 통합용 ride_id nullable.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.riding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- 멱등 upsert / 재업로드 식별
  client_session_id text not null,           -- rd_sessions_v1.id ('rd_<ts>_<rand>')
  session_signature text,                    -- GPX 구조 해시 (rd_titles/rd_edits 연동)

  -- 표시 메타
  name text,
  sport text check (sport in (
    'wingfoil','foilboarding','kitefoil','windfoil','sup','surf','windsurf','kite','other'
  )),
  session_date timestamptz,                  -- rd_sessions_v1.dateEpoch
  location text,
  spot_id uuid references public.spots(id) on delete set null,

  -- 날씨
  wind_dir_deg numeric(5,1),
  wind_speed_kt numeric(5,2),

  -- 자주 쿼리/정렬하는 핵심 지표만 정형 컬럼
  duration_sec integer check (duration_sec is null or duration_sec >= 0),
  moving_time_sec integer check (moving_time_sec is null or moving_time_sec >= 0),
  distance_m numeric(10,1) check (distance_m is null or distance_m >= 0),
  max_speed_ms numeric(6,2) check (max_speed_ms is null or max_speed_ms >= 0),
  avg_speed_moving_ms numeric(6,2) check (avg_speed_moving_ms is null or avg_speed_moving_ms >= 0),

  -- 진화하는 분석치 전체 (peak2s/peak10s/best500m/best1nm/alpha/VPS*/polarProfile/
  -- skillGroups/tackCount/gybeCount/avgEfficiency/trimp/hrRecoveryIndex 등)
  metrics jsonb not null default '{}',

  -- 미래 통합용 (rides 와 연결 시)
  ride_id uuid references public.rides(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 같은 유저의 같은 클라이언트 세션은 1행 (멱등 upsert)
  unique (user_id, client_session_id)
);

create index if not exists riding_sessions_user_date_idx
  on public.riding_sessions(user_id, session_date desc);
create index if not exists riding_sessions_sig_idx
  on public.riding_sessions(user_id, session_signature);
create index if not exists riding_sessions_metrics_idx
  on public.riding_sessions using gin(metrics);

create trigger riding_sessions_updated_at
  before update on public.riding_sessions
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────
-- 3. riding_files — GPX/영상 파일 메타 (실파일은 Supabase Storage)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.riding_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.riding_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,  -- RLS/quota denorm

  kind text not null check (kind in ('track','video')),
  storage_bucket text not null check (storage_bucket in ('tracks','videos')),
  storage_path text not null,                -- '<user_id>/<session_id>/<filename>'
  file_name text not null,                   -- 원본 파일명 (영상 sync 키)
  mime_type text,                            -- 'application/gpx+xml' / 'video/mp4'
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),

  -- rd_videosync_v1 의 GPS sync offset (영상만)
  video_offset_sec numeric(8,2),

  created_at timestamptz not null default now(),

  unique (storage_bucket, storage_path)
);

create index if not exists riding_files_session_idx
  on public.riding_files(session_id);
create index if not exists riding_files_user_kind_idx
  on public.riding_files(user_id, kind);


-- ─────────────────────────────────────────────────────────────────────────
-- 4. RLS — riding_sessions / riding_files (0002 스타일: 본인 RW + admin all)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.riding_sessions enable row level security;

create policy "riding_sessions_select_self"
  on public.riding_sessions for select
  using (user_id = auth.uid());

create policy "riding_sessions_insert_self"
  on public.riding_sessions for insert
  with check (user_id = auth.uid());

create policy "riding_sessions_update_self"
  on public.riding_sessions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "riding_sessions_delete_self"
  on public.riding_sessions for delete
  using (user_id = auth.uid());

create policy "riding_sessions_admin_all"
  on public.riding_sessions for all
  using (public.is_admin())
  with check (public.is_admin());


alter table public.riding_files enable row level security;

create policy "riding_files_select_self"
  on public.riding_files for select
  using (user_id = auth.uid());

create policy "riding_files_insert_self"
  on public.riding_files for insert
  with check (user_id = auth.uid());

create policy "riding_files_update_self"
  on public.riding_files for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "riding_files_delete_self"
  on public.riding_files for delete
  using (user_id = auth.uid());

create policy "riding_files_admin_all"
  on public.riding_files for all
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================================
-- 5. Storage 버킷 RLS 정책
--    참고: 아래 정책은 storage.objects 에 대한 규칙이라 버킷 존재와 무관하게
--          생성됨. 단, 실제 업로드가 동작하려면 Dashboard 에서 'tracks'·'videos'
--          버킷을 Private 으로 생성해야 함 (runbook §C). 생성 순서는 무관.
--
--    경로 규약: 객체 path 의 첫 segment = auth.uid()  →  본인 폴더만 접근.
--      예) tracks/<user_id>/<session_id>/track.gpx
--          videos/<user_id>/<session_id>/clip01.mp4
--    storage.foldername(name)[1] = path 의 첫 폴더명.
-- ============================================================================

-- tracks 버킷 — 본인 폴더만 R/W
create policy "tracks_select_own"
  on storage.objects for select
  using (bucket_id = 'tracks' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "tracks_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'tracks' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "tracks_update_own"
  on storage.objects for update
  using (bucket_id = 'tracks' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'tracks' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "tracks_delete_own"
  on storage.objects for delete
  using (bucket_id = 'tracks' and (storage.foldername(name))[1] = auth.uid()::text);

-- videos 버킷 — 본인 폴더만 R/W
create policy "videos_select_own"
  on storage.objects for select
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "videos_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "videos_update_own"
  on storage.objects for update
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "videos_delete_own"
  on storage.objects for delete
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 끝. 검증:
--   select suffix from (values ('gear'),('profile_extra')) v(suffix);  -- CHECK 통과 확인
--   \d public.riding_sessions   /   \d public.riding_files
--   select * from pg_policies where tablename in ('riding_sessions','riding_files');
-- ============================================================================
