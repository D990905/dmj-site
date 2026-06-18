# §415 Sprint 1.1 — 트랙·메타 Cloud Sync 배포 runbook

작성: 2026-06-18 · 영역: 라이딩 대시보드 cross-device 동기화

---

## 0. 요약 (TL;DR)

라이딩 대시보드 "세션 저장하기" 시 **GPX 트랙 + 분석 요약 + 점수 + 메타**를
Supabase 에 올려 다른 기기에서 로그인하면 자동으로 보이게 한다.
**영상 파일은 cloud 에 올리지 않는다** (옥대표님 결정 2026-06-18 — 액션캠 용량).

- 클라이언트 코드 = **완료** (이 커밋). `cloud-sync.js` + app.js/profile.html 후킹.
- 백엔드(스키마·버킷) 적용 = **대시보드 보유자(옥대표님)가 수동 1회 실행 필요** —
  anon key 로는 DDL·버킷 생성 불가, service_role 은 금지(보안 lock)라 자동화 안 함.
- **아래 §A·§B 를 적용하기 전까지는 cloud sync 가 동작하지 않는다** (로컬 저장은 정상).

---

## A. 사전 확인 — 무엇이 이미 있고, 무엇이 없는가

2026-06-18 live(`uzwennkeoeihqyvnxech`) REST/Storage 프로빙 결과:

| 대상 | 상태 | 비고 |
|---|---|---|
| `public.rides` | **존재** | 0001 의 수동 라이딩 로그/인증용. **본 기능과 무관** |
| `public.riding_sessions` | **없음 (404)** | 0004 에 정의됐으나 **live 미적용** |
| `public.riding_files` | **없음 (404)** | 0004 에 정의됐으나 **live 미적용** |
| `tracks` 버킷 | **없음 (Bucket not found)** | 생성 필요 |
| `videos` 버킷 | **없음** | (이번 sprint 미사용 — 영상 cloud 업로드 X) |
| `public.spots`, `profiles`, `user_data`, `cart_items` | 존재 | 0004 의 FK 대상 OK |

> ⚠️ **중요 — 스키마 선택 정정.** §415 spec 초안은 신규 `rides` 테이블을
> 만들라고 했으나, `rides` 라는 이름은 이미 0001 의 **인증로그용 테이블**이
> 점유하고 있어(컬럼이 전혀 다름) `CREATE TABLE IF NOT EXISTS rides` 는
> no-op 이 되고 클라이언트가 깨진다. 그래서 **repo 에 이미 있는 0004 의
> `riding_sessions` + `riding_files` 설계를 채택**했다(옥대표님 confirm
> 2026-06-18). 이쪽이 멱등 upsert·jsonb metrics·video offset·RLS·인덱스를
> 이미 갖춘 정본 설계다.

---

## B. 배포 절차 (Supabase Dashboard / SQL Editor — 1회)

### B-1. 마이그레이션 0004 적용

`supabase/migrations/0004_riding_sessions_storage.sql` 전체를 SQL Editor 에서 실행.

- 순수 ADDITIVE (DROP 없음). 안전.
- 부수 효과: `user_data` CHECK 에 `gear`·`profile_extra` suffix 허용
  (= 2026-05-25 장비 소실 버그도 같이 고쳐짐 — 별개 이득).
- `riding_sessions.spot_id` → `public.spots` FK, 트리거 `set_updated_at`,
  정책 `is_admin()` 사용. 모두 live 에 존재 확인됨(§A).

> 0001~0003 이 부분 적용 상태일 수 있으니, 0004 실행 중 "function/relation
> does not exist" 가 나오면 해당 선행 마이그레이션의 누락 객체만 먼저 적용할 것.

### B-2. Storage 버킷 생성

Dashboard → Storage → **New bucket**:

- 이름: `tracks`
- **Private** (Public 체크 해제 — RLS 로만 접근)
- (권장) 파일 크기 제한: 50 MB 정도. GPX 는 gzip 후 보통 < 200 KB.

> `videos` 버킷은 이번 sprint 에서 **만들 필요 없음** (영상 cloud 업로드 X).
> 0004 의 videos 정책은 미래용으로 남겨둔다.

버킷 RLS 정책은 0004 가 이미 `storage.objects` 에 생성한다
(`tracks_select_own` 등 — 경로 첫 segment = `auth.uid()`). 버킷만 만들면 됨.

### B-3. 적용 검증 SQL

```sql
-- 테이블 존재
select to_regclass('public.riding_sessions'), to_regclass('public.riding_files');
-- 정책
select tablename, policyname from pg_policies
 where tablename in ('riding_sessions','riding_files') order by 1,2;
-- 버킷
select id, public from storage.buckets where id = 'tracks';
-- user_data CHECK 에 gear/profile_extra 포함 확인
select pg_get_constraintdef(oid) from pg_constraint
 where conname = 'user_data_suffix_check';
```

배포 후 클라이언트에서 한 번 더 REST 프로빙으로 404 → 200 전환 확인 가능.

---

## C. 클라이언트 구조 (이미 적용됨 — 참고)

| 파일 | 변경 |
|---|---|
| `riding-dashboard/js/cloud-sync.js` | **신규** `window.RDCloud` — push/pull/ensureTrack/migrate/autoSync |
| `riding-dashboard/js/app.js` | 저장 시 `pushSessionToCloud`, 다시 보기 cloud-aware 래퍼, `rd:cloud-synced` 재렌더 + 딥링크 재시도 |
| `riding-dashboard/index.html` | `cloud-sync.js` 로드 |
| `profile.html` | `cloud-sync.js` 로드 + `rd:cloud-synced` → 최근 라이딩 재렌더 |

### 데이터 매핑
- `riding_sessions.client_session_id` = 로컬 `rd_<uid>_sessions_v1[].id` (멱등 upsert 키)
- `riding_sessions.metrics` (jsonb) = **로컬 컴팩트 레코드 전체** → pull 시 무손실 복원.
  정형 컬럼(distance_m·max_speed_ms·wind_* 등)은 쿼리/정렬용 중복.
- `metrics._hasVideo` = 저장 시점 로컬 영상 blob 유무 (Sprint 1.3 "영상 없음" 안내용)
- 트랙 GPX → `tracks/<uid>/<client_session_id>/track.gpx.gz` (gzip; 미지원 환경은 `track.gpx`)
- `riding_files` = 트랙 파일 메타 1행 (kind='track'). 영상 행은 만들지 않는다.

### 동작 흐름
1. **저장**: `Storage.saveSession`(로컬) → `RDCloud.pushSession`(cloud). cloud 실패해도 로컬 유지.
2. **로그인**: `dmj-auth-change` → `autoSync` = `migrateLocalToCloud`(로컬 전용 세션 1회 업로드)
   → `pullSessions`(cloud-first 병합) → `rd:cloud-synced` → 3개 렌더러 재렌더.
3. **다시 보기 / ?session 딥링크**: 로컬 트랙 있으면 즉시 로드, 없으면
   `ensureTrack` 이 `tracks` 버킷에서 GPX 다운로드(gz→평문 fallback) 후 로드.

---

## D. 마이그레이션 / fallback 정책

- **로컬 → cloud 1회 마이그레이션**: 첫 로그인 시 로컬 전용 세션을 upsert.
  완료 flag = `rd_<uid>_cloud_migrated_v1`. 부분 실패 시 flag 미설정 → 다음 로그인 재시도.
- **충돌 정책**: 같은 `client_session_id` 는 **cloud 우선** (pull 이 로컬을 덮음).
- **오프라인 / 비로그인 / Supabase 실패**: 전부 로컬로 graceful fallback.
  push/pull/ensureTrack 은 reject 하지 않고 `{ok:false}` 반환 — 본 기능은 저장을 막지 않는다.
- **localStorage full**: ensureTrack 이 받은 트랙을 못 쓰면 `{ok:false}` → "요약만" 안내.

---

## E. 영상 cloud 미업로드 — 결정 근거

> 옥대표님 verbatim 2026-06-18:
> "영상을 업로드해서 트랙킹 데이터랑 싱크해서 그 싱크된 영상파일을 다운로드 받을 수
> 있게 해주고 대신 저장은 안되는 시스템으로 구축하면?" / "다운로드 의무아님, 보통
> 액션카메라 영상은 용량이 큼."

- 영상 = 로컬(IndexedDB `rd_<uid>_video_blobs_v1`)만. Supabase 절대 X.
- 다른 기기에서 `metrics._hasVideo=true` 인데 로컬 blob 없음 → "영상이 이 기기에
  없습니다. 다시 올려주세요." 안내 UX = **Sprint 1.3 영역** (본 sprint 범위 밖).

---

## F. 보안 lock

- **anon(publishable) key 만 사용**. service_role 절대 X.
- RLS 가 `user_id = auth.uid()` 격리 강제 — 다른 사용자 행/파일 접근 불가.
- Storage 경로 첫 segment = `auth.uid()` 정책 → 본인 폴더만 R/W.

---

## G. 배포 후 self-verify 체크리스트 (옥대표님/대시보드 보유자)

§415 spec 의 6단계. **B 적용 후** 실행:

1. 본인 GPX 업로드 → 세션 저장 → `select count(*) from riding_sessions` 1 증가 확인
2. Storage `tracks/<uid>/<sessionid>/track.gpx.gz` 1개 생성 확인
3. 같은 브라우저 localStorage 클리어 → 재로그인 → 마이페이지 최근 라이딩에 동일 세션 표시
4. 세션 클릭(다시 보기) → 트랙·분석·점수 재현 (영상은 없음)
5. 저장 당시 풍향·풍속이 그대로 복원됐는지 확인
6. 다른 계정 로그인 → 옥대표님 세션 안 보임 (RLS 격리)
