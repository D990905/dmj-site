# Phase 12 — Supabase Backend Spec (Day 1)

**작성일:** 2026-06-10
**대상:** dmjgroup.kr (단무지공방 홈페이지)
**Sprint:** Phase 12 — 회원/마이페이지/라이딩 대시보드 데이터의 cloud 백엔드화
**상태:** Day 1 = AS-IS 감사 + gap 분석 + 보강 schema spec. 클라이언트 코드 변경은 Day 2+.

---

## ⚠️ 0. 가장 먼저 — 전제 정정 (옥대표님 必讀)

본 sprint 의 dispatch 전제는 *"현재 dmjgroup.kr 의 데이터 = localStorage 만, Supabase 백엔드를 새로 set up"* 이었습니다. **코드베이스 감사 결과 이 전제는 부분적으로 사실과 다릅니다.** 이미 상당한 Supabase 백엔드가 존재하고 라이브로 연결되어 있습니다:

| 항목 | 실제 상태 |
|---|---|
| Supabase 프로젝트 | **이미 존재** — `https://uzwennkeoeihqyvnxech.supabase.co` (라이브, 클라이언트가 호출 중) |
| 클라이언트 SDK | `assets/js/supabase-auth.js` (711줄) — 약 20개 HTML 페이지에 포함 (profile · login · signup · cart · membership · consult · find-my-gear · ppc 제품군 등) |
| 인증 | Supabase Auth (이메일/비밀번호) **+ Kakao OAuth** 이미 구현 |
| Schema migration | `supabase/migrations/` 에 **이미 3개** 존재 — `0001_initial.sql` · `0002_rls_policies.sql` · `0003_legacy_auth_bridge.sql` |
| 적용된 테이블 | `profiles` · `spots` · `inventory` · `rides` · `certifications` · `posts` · `comments` · `discount_inventory` · `consultations` · `notifications` · `user_data` · `cart_items` (총 12개) |
| 회원/프로필/장바구니/장비 | **이미 Supabase write-through** (localStorage + 백그라운드 upsert) |

→ 따라서 Day 1 의 산출물은 *"새 프로젝트 + 새 schema 생성"* 이 아니라 **(1) 기존 백엔드 정확히 문서화 + (2) 진짜로 비어 있는 gap 보강** 입니다. dispatch 가 요청한 `001_initial_schema.sql` 은 기존 `0001_initial.sql` 과 충돌하므로 **만들지 않았고**, 대신 보강 migration `0004_riding_sessions_storage.sql` 을 작성했습니다.

이 정정은 옥대표님 review 후 얼마든지 재조정 가능합니다. 아래는 정정된 현실 위에서의 설계입니다.

---

## 1. AS-IS — 이미 구현된 백엔드

### 1.1 적용된 schema (migrations 0001–0003)

```
profiles            auth.users 1:1 bridge + 회원 tier + 회원 입력필드(nickname·gender·birth_year·
                    riding_start·main_sports·favorite_spot 등) + total_spend_krw + is_admin
spots               한국 라이딩 spot 카탈로그 (한강·동해·제주 …), 0003 seed 예정
inventory           ★ 유저 장비 테이블 (user_id · product_id · category[wing/foil-front/foil-stab/
                    foil-mast/foil-fuselage/board/harness/helmet/vest/boots/other] · size ·
                    condition · purchased_at · purchase_price_krw · for_sale · asking_price_krw)
rides               라이딩 로그 (rode_at · duration_min · max/avg_speed_kn · conditions jsonb ·
                    used_inventory_ids[] · video_urls[] · photo_urls[] · spot_id · 인증증빙 flag)
certifications      인증 신청·승인 history
posts / comments    커뮤니티
discount_inventory  할인 재고
consultations       1:1 상담
notifications       알림
user_data           ★ per-user jsonb namespace 버킷 — (user_id, suffix) PK
                    suffix CHECK 허용: skill_assessment_v1 · self_assessment_v1 · fmg_history ·
                    land_phase · water_stage · consult_history · quotes_history · orders (8개)
cart_items          장바구니 (정형 테이블, read/write 빈도 高)
```

RLS 는 0002 에서 전 테이블 enable, default-deny, `auth.uid()` 본인 기준 + `is_admin()` 헬퍼.

### 1.2 클라이언트 sync 매핑 (supabase-auth.js)

| localStorage 키 | Supabase 대상 | 방식 |
|---|---|---|
| 회원 인증 | Supabase Auth + Kakao OAuth | SDK 세션 (`dmj_sb_auth`) + 캐시 (`dmj_user_cache`) |
| `dmj_user_<id>_skill_assessment_v1` 등 8 namespace | `user_data(user_id, suffix, data jsonb)` | write-through |
| `dmj_user_<id>_cart` | `cart_items` (delete+reinsert) | write-through |
| `dmj_user_<id>_total_spend` | `profiles.total_spend_krw` (tier 트리거) | write |
| `dmj_user_<id>_gear` (§184) | `user_data` suffix=`'gear'` | write-through ⚠️ **2.1 버그 참조** |
| `dmj_user_<id>_profile_extra` (§187) | `user_data` suffix=`'profile_extra'` | write-through ⚠️ **2.1 버그 참조** |

---

## 2. Gap 분석 — 옥대표님 두 시나리오 vs 현실

### 2.1 시나리오 1 — "회원가입 후 장비 list → 모든 device 동기화"

**상태: 부분 구현 + 유력한 버그.**

- 정식 장비 테이블 `public.inventory` 가 **이미 존재**하지만, 클라이언트(§184)는 장비를 거기에 쓰지 않고 `user_data` 에 `suffix='gear'` jsonb blob 으로 씁니다.
- 그런데 `user_data.suffix` 의 CHECK 제약(0003)은 8개 suffix만 허용하고 **`'gear'` 와 `'profile_extra'` 는 목록에 없습니다.** 즉 클라이언트가 보내는 gear/profile_extra upsert 는 Postgres CHECK 위반으로 **거부**됩니다 (HTTP 400, localStorage 만 남고 서버 미저장).

> **🔴 유력한 근본 원인:** 옥대표님이 2026-05-25 캐시 정리 후 본인 계정·장비를 잃은 사건 ([[project_dmj_mypage_no_backend]]) 은 바로 이 때문일 가능성이 높습니다. gear 가 서버에 한 번도 저장된 적 없이 localStorage 에만 있었고, 캐시 비우면 소실. **DB 로그(Supabase → Logs → Postgres)에서 `user_data_suffix_check` 위반 400 을 확인하면 확정됩니다.**

**해결 (Day 1 = SQL, Day 2 = 클라이언트):**
1. **즉시 (0004 포함):** `user_data` CHECK 에 `'gear'`·`'profile_extra'` 추가 → 현재 클라이언트 write 가 즉시 살아남. **(가장 낮은 risk, 최우선)**
2. **Day 2+ (권장 장기):** 장비를 jsonb blob 대신 정식 `inventory` 테이블로 이관. 쿼리·정렬·"판매중(for_sale)" 마켓 기능까지 재사용 가능. task dispatch 가 요청한 `user_equipment` 테이블 = **기존 `inventory` 가 그 역할**. 새로 만들지 않고 재사용.

### 2.2 시나리오 2 — "라이딩 대시보드 트랙·영상 업로드 → 다음 로그인 시 보존"

**상태: 미구현 (진짜 gap).**

- `riding-dashboard/` 의 데이터는 **100% 브라우저 로컬**:
  - `rd_sessions_v1` — 세션 분석 메타(VPS·polar·skillGroups·거리·속도 등 50+ 필드), localStorage, 최대 50개
  - `rd_track_v1_<id>` — 원본 GPX, localStorage, 8MB 상한
  - 영상 blob — **IndexedDB** (`rd_video_blobs_v1`), 브라우저 로컬
  - `rd_rider_v1` · `rd_edits_v1` · `rd_titles_v1` · `rd_videosync_v1` — 전부 localStorage
- Supabase 연동 **0**. `riding-dashboard/index.html` 이 `supabase-auth.js` 를 포함하는 건 상단 네비 로그인 표시용일 뿐, 라이딩 데이터는 동기화하지 않음.
- 기존 `public.rides` 테이블은 *별개 개념* — 수동 라이딩 로그(rode_at·duration·notes·video_urls 텍스트 URL)이며, 대시보드의 자동 산출 분석(rd_sessions_v1)과 1:1 대응하지 않음. `video_urls` 는 text[] URL 일 뿐 Storage 버킷 backing 없음.

→ **이것이 옥대표님이 가장 원하는, 아직 손대지 않은 영역.** 다음을 신규 추가:
  - `riding_sessions` — rd_sessions_v1 의 풍부한 분석 메타 미러 (분석 수치는 jsonb 로 유연 저장)
  - `riding_files` — GPX/영상 파일 메타 + Supabase **Storage** 경로
  - Storage 버킷 `tracks/` · `videos/` + per-user RLS

> 설계 선택: 기존 `rides`(수동 로그/인증 플로우)를 **건드리지 않고** 신규 `riding_sessions` 를 별도로 둡니다. 두 모델을 섞으면 `rides_sync_stats`·`certifications` 트리거가 깨질 위험이 큽니다. 미래 통합용으로 `riding_sessions.ride_id` nullable FK 만 남겨 둡니다.

---

## 3. TO-BE Schema — 0004 보강

`supabase/migrations/0004_riding_sessions_storage.sql` (별도 파일). 요지:

### 3.1 `user_data` CHECK 패치 (시나리오 1 hotfix)
```sql
alter table public.user_data drop constraint if exists user_data_suffix_check;
alter table public.user_data add constraint user_data_suffix_check
  check (suffix in ( ...기존 8개..., 'gear', 'profile_extra' ));
```

### 3.2 `riding_sessions` (시나리오 2)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→profiles | not null, on delete cascade |
| `client_session_id` | text | rd_sessions_v1 의 `id` (`rd_<ts>_<rand>`) — 멱등 upsert 키 |
| `session_signature` | text | GPX 구조 해시 — 동일 트랙 재업로드 식별 (rd_titles/rd_edits 연동) |
| `name` | text | 세션 제목 |
| `sport` | text | wingfoil/foilboarding/kitefoil/… (CHECK) |
| `session_date` | timestamptz | `dateEpoch` |
| `location` | text · `spot_id` uuid FK→spots(nullable) | |
| `wind_dir_deg` · `wind_speed_kt` | numeric | 날씨 |
| `duration_sec`·`moving_time_sec`·`distance_m`·`max_speed_ms`·`avg_speed_moving_ms` | numeric | 핵심 지표(쿼리/정렬용 정형 컬럼) |
| `metrics` | jsonb | rd_sessions_v1 전체(peak2s/peak10s/best500m/VPS/polarProfile/skillGroups/trimp 등 진화하는 분석치) |
| `ride_id` | uuid FK→rides(nullable) | 미래 통합용 |
| `created_at`·`updated_at` | timestamptz | |

- 인덱스: `(user_id, session_date desc)`, `unique(user_id, client_session_id)`, gin(metrics)
- 정형 컬럼 + jsonb 혼합: 자주 쿼리/정렬하는 지표만 컬럼화, 나머지 분석치는 jsonb (기존 0001 의 `rides.conditions` 패턴과 동일 철학)

### 3.3 `riding_files` (Storage 메타)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK→riding_sessions | on delete cascade |
| `user_id` | uuid FK→profiles | RLS·quota 용 (denormalized) |
| `kind` | text | `'track'`(GPX) / `'video'` (CHECK) |
| `storage_bucket` | text | `'tracks'` / `'videos'` |
| `storage_path` | text | `<user_id>/<session_id>/<filename>` |
| `file_name` | text | 원본 파일명 (영상 sync 키) |
| `mime_type` | text | `application/gpx+xml` / `video/mp4` |
| `size_bytes` | bigint | quota 집계 |
| `video_offset_sec` | numeric(nullable) | rd_videosync_v1 의 GPS sync offset |
| `created_at` | timestamptz | |

- 인덱스: `(session_id)`, `(user_id, kind)`

### 3.4 RLS (0002 스타일 그대로 — `auth.uid()` 본인 + `is_admin()`)
`riding_sessions`·`riding_files` 각 SELECT/INSERT/UPDATE/DELETE = `user_id = auth.uid()`, admin all.

### 3.5 Storage 버킷 정책
- 버킷 `tracks` (GPX) · `videos` (영상) — **private** (공개 X).
- 경로 규약: 객체 path 의 첫 segment = `auth.uid()` → `storage.objects` RLS 로 본인 폴더만 R/W.
- 한도(권장 default, 옥대표님 조정 가능):
  - GPX: 파일당 ≤ 10 MB
  - 영상: 파일당 ≤ 500 MB, 사용자당 합계 ≤ 5 GB (Supabase Free tier 총 1GB Storage → **유료 Pro($25/mo, 100GB) 필요**. 4.4 참조)

> 버킷 생성/Storage RLS SQL 은 0004 에 포함하되, 일부 Supabase 환경은 Dashboard UI 로 버킷 먼저 만든 뒤 정책 SQL 을 실행해야 함 — runbook 에 단계 명시.

---

## 4. 운영 정책

### 4.1 Auth 흐름
- **현행 유지:** 이메일/비밀번호 + Kakao OAuth (이미 구현). 추가 소셜(Google/Apple)은 옥대표님 결정 사항 — 기본 권장 = **현행 유지, 추가 안 함** (관리 단순). 필요 시 Day 2+ 분리 task.

### 4.2 키 정책 (보안)
- 클라이언트 = `sb_publishable_...` (publishable/anon 키). **현재 코드의 키는 publishable 이 맞음 — service_role 누출 없음. ✅**
- `service_role` 키 = 절대 클라이언트·git X. Day 1 기준 service_role 사용처 = **없음** (모든 접근이 anon + RLS). 유지 권장.
- 만약 향후 server-side 작업(대량 마이그레이션·webhook)이 필요하면 Vercel/Cloudflare 환경변수에만 service_role 저장, 클라이언트 번들 X.

### 4.3 마이그레이션 path (기존 사용자)
- 현행 supabase-auth.js 가 이미 *로그인 시 1회 자동 이관* 로직 보유: `dmj_users[email]` → profiles/user_data (§169-K, §184, §187).
- gear 는 2.1 의 CHECK 버그로 **이관이 실패해 왔을 것** → 0004 CHECK 패치 후 다음 로그인 시 자동 이관 정상화. 추가 수작업 불필요(권장).
- 라이딩 대시보드 기존 로컬 데이터: Day 2+ 에 "이 브라우저의 N개 세션을 클라우드에 백업" 1회성 업로더 제공(권장). 자동 백그라운드 업로드는 영상 용량 때문에 명시적 사용자 액션으로.

### 4.4 비용 영향 ⚠️
- 영상 저장은 Supabase **Free tier(1GB Storage·2GB 전송)** 를 빠르게 초과. 라이딩 영상 1개가 수백 MB.
- **Pro plan($25/mo, 100GB Storage, 250GB 전송) 사실상 필수.** 옥대표님 결정 필요 항목 — 4.x 의 단일 최대 비용 변수.
- 대안(옵션): 영상은 Supabase Storage 대신 외부(YouTube 비공개/Cloudflare R2)로 두고 `riding_files` 에 URL 만 저장. Day 2 설계 시 재검토.

### 4.5 CI/CD 영향
- 현 사이트 = GitHub Pages static. Supabase URL·publishable 키는 **이미 `supabase-auth.js` 에 하드코딩** (publishable 키라 안전). 별도 build-time inject 불필요 — 현행 유지.
- service_role 미사용이므로 빌드 파이프라인 변경 없음.

---

## 5. Sprint plan (Day 2–7)

| Day | 작업 | 산출/검증 |
|---|---|---|
| **1 (本)** | AS-IS 감사 + gap spec + `0004` SQL + runbook | 본 문서 3종 + commit |
| **2** | 🔴 **gear hotfix** — 0004 CHECK 적용 + 회귀 검증. 2.1 버그 확정(DB 로그) | 옥대표님 로그인→gear 저장→다른 브라우저 로그인→gear 표시 확인 |
| **3** | `riding_sessions`/`riding_files` 테이블 + Storage 버킷 생성·정책 | Dashboard 에서 버킷 확인, RLS 테스트(타인 데이터 차단) |
| **4** | riding-dashboard 클라이언트: 세션 메타 + GPX 업로드 sync 로직 (storage.js → Supabase) | 세션 저장→로그아웃→재로그인→세션 복원 |
| **5** | riding-dashboard 영상 업로드(IndexedDB→Storage) + 진행률 UI + quota 가드 | 영상 업로드→다른 device 재생 |
| **6** | 장비 정식 `inventory` 테이블 이관(선택) + 마이페이지 장비 UI 연결 | 장비 CRUD 동기화 |
| **7** | 통합 회귀 + 마이그레이션(기존 로컬 세션 1회 백업 도구) + 문서화 | 전 시나리오 E2E |

---

## 6. 회귀 가드 (전 Day 공통)
- `riding-dashboard/` byte-for-byte 보존 (Day 4 전까지 손 X)
- `riding-dashboard-v2/` 손 X
- `assets/` `level/` 등 다른 영역 손 X (Day 6 이전)
- 진행 중 §405/§406 commit 영향 0
- 0004 는 **순수 additive** (DROP/ALTER COLUMN 없음, CHECK 교체만 — 기존 행에 영향 X)

---

## 7. 옥대표님 결정 대기 항목 (요약)
1. **[최우선·blocker]** 기존 Supabase 프로젝트 `uzwennkeoeihqyvnxech` 에 옥대표님이 **로그인·관리 권한**을 갖고 계신가? (Day 2 의 SQL 적용·Storage 생성에 필수) — runbook §A 참조.
2. 라이딩 영상 저장: Supabase Pro($25/mo) 결제 OK? 아니면 외부(R2/YouTube) URL 방식? (§4.4)
3. 소셜 로그인 현행(Kakao만) 유지 OK? (§4.1)
4. 장비를 정식 `inventory` 테이블로 이관 vs jsonb 유지 — 권장은 이관(Day 6). (§2.1)

> 1·2·3 은 옥대표님 1줄 confirm 으로 충분. 4 는 Day 6 진입 전까지 결정하면 됨.
