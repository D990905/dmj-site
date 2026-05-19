# Phase 12 — Sprint Plan

**작성일**: 2026-05-05
**참조**: PHASE12_ARCHITECTURE.md, CERTIFICATION_SYSTEM.md
**산출물 범위**: Sprint 1~2 (총 3-5주, 1인 part-time 기준)

---

## 0. 마일스톤 요약

| Sprint | 기간   | 핵심 deliverable                                  | 검증 기준                          |
|--------|-------|--------------------------------------------------|-----------------------------------|
| 1      | 1-2주 | 회원가입 + 프로필 + Inventory CRUD                  | 사용자 1명이 가입→장비 5개 등록 5분 |
| 2      | 2-3주 | 라이딩 로그 + 인증 system + 커뮤니티 기본 게시판     | beta tester 5명 가입·로그·게시 가능 |
| 3 (이후) | -    | 추천 알고리즘 + 컨설팅 form + Danny admin dashboard | -                                 |

---

## 1. Sprint 1 — Foundation (1-2주)

### 목표
**"가입한 user가 자기 장비를 등록할 수 있다."** 이 한 문장이 끝까지 작동하면 sprint 성공.

### 1.1 Day 1-2 — Supabase 셋업

#### Task S1-1: Supabase 프로젝트 생성
- 리전: **Tokyo (Northeast Asia)** — 한국 latency 최소
- DB password 강력하게 설정·1Password 보관
- API key (anon, service_role) 안전한 곳에 보관
- 프로젝트 이름: `dmjgroup-prod`

**완료 기준**: `https://<project>.supabase.co` 접속 가능

#### Task S1-2: 로컬 Supabase CLI 셋업
```bash
# (macOS)
brew install supabase/tap/supabase
cd "/Users/dannyok/Documents/Claude/Projects/단무지공방 홈페이지 만들기/site"
supabase init
supabase link --project-ref <ref-id>
```

**완료 기준**: `supabase db pull` 동작

#### Task S1-3: Migration 적용
```bash
# 0001_initial.sql, 0002_rls_policies.sql 이미 작성됨
supabase db push
```

**완료 기준**:
- Studio dashboard에서 10개 테이블 visible
- 모든 테이블 RLS = ON 표시

#### Task S1-4: Seed 데이터 (한국 spots)
별도 작성: `0003_seed_spots.sql`. 최소 spot 8곳:
- 한강 광나루 / 망원
- 양양 죽도 / 동산 / 광진
- 강릉 사천
- 제주 함덕 / 김녕

**완료 기준**: `select count(*) from spots` = 8

---

### 1.2 Day 3-4 — Auth 흐름

#### Task S1-5: app.dmjgroup.kr 프로젝트 부트스트랩
```bash
cd site/
npm create vite@latest app -- --template react-ts
cd app
npm install @supabase/supabase-js react-router-dom
npm install -D vite-plugin-pwa
```

`src/lib/supabase.ts` 작성 — env 변수 (.env.local에 anon key).

**완료 기준**: `npm run dev` 시 빈 React 앱 가동

#### Task S1-6: 로그인·회원가입 페이지
- 이메일 + 비밀번호 (Supabase Auth)
- Google OAuth (Supabase 콘솔에서 enable; client ID는 Google Cloud)
- "비밀번호 찾기" 링크 (`auth.resetPasswordForEmail`)
- 로그인 후 `/dashboard`로 redirect

**완료 기준**:
- 가입 → 이메일 verify → 로그인 동작
- `auth.users` + `profiles` row 자동 생성 확인

#### Task S1-7: 보호된 라우트 + AuthContext
- `<RequireAuth>` HOC: JWT 없으면 `/login`으로
- `useUser()` 훅: 현재 user + profile 정보 노출
- 로그아웃 버튼

**완료 기준**: 비로그인 시 `/dashboard` 접근 차단

---

### 1.3 Day 5-7 — 프로필 + Inventory

#### Task S1-8: 프로필 페이지 (`/profile`)
- 표시: avatar, username, display_name, weight, height, home_spot
- 편집: form + `update profiles ...`
- avatar 업로드 → Supabase Storage `avatars/` bucket

**완료 기준**: 본인 프로필 편집·저장·재로드 OK

#### Task S1-9: Inventory CRUD (`/inventory`)
- 리스트: 카드 grid (썸네일은 products.json 매칭)
- 추가: drawer/modal — product 선택 (검색) + size + condition + 메모
- 편집: 인라인 또는 modal
- 삭제: 확인 다이얼로그

**핵심 UX**: products.json 검색 시 sku autocomplete. 사용자가 "Levitaz FW680" 타이핑 → 매칭 → product_id 자동 입력.

**완료 기준**: 장비 5개 등록 후 새로고침해도 유지

#### Task S1-10: 정적 사이트 통합 (`auth-bridge.js`)
`site/assets/js/auth-bridge.js` 신규:
- 페이지 로드 시 Supabase JWT 체크
- 로그인 상태면 우상단 "마이페이지" 버튼 (→ app.dmjgroup.kr)
- 비로그인이면 "로그인" 버튼
- product detail page에 "내 장비에 추가" 버튼 활성화 (인증 시) — 클릭 → app으로 deep link

**완료 기준**:
- catalog.html에서 로그인 상태 visible
- product detail에서 "내 장비에 추가" 한 번에 inventory 추가됨

---

### 1.4 Sprint 1 끝 — Verification

#### Task S1-V: 침투 테스트 + Smoke Test
- ✅ Anonymous로 `/profile`·`/inventory` 접근 차단
- ✅ User A가 User B의 inventory를 직접 update 시도 → RLS reject
- ✅ User가 자기 profile.is_admin=true 시도 → RLS reject
- ✅ Lighthouse PWA score ≥ 90 (`app.dmjgroup.kr`)
- ✅ Mobile (iPhone Safari) "홈 화면 추가" 동작 확인

**Sprint 1 완료 정의**: Danny가 자신의 계정으로 가입→로그인→장비 5개 등록→정적 사이트에서 로그인 상태 visible 까지 5분 안에 가능.

---

## 2. Sprint 2 — Logs + Certs + Community (2-3주)

### 목표
**"라이딩 로그를 쌓고, 인증을 신청하고, 커뮤니티에 글을 쓸 수 있다."**

### 2.1 Week 1 — 라이딩 로그

#### Task S2-1: 라이딩 입력 form (`/rides/new`)
- 필수: spot 선택 (드롭다운, search), rode_at (datetime), duration_min
- 선택: max_speed_kn, used_inventory_ids (체크박스 grid), conditions (jsonb form), 메모
- 사진/영상 업로드 → Storage `rides/<user_id>/<ride_id>/`

**완료 기준**: 로그 1개 작성 → `total_rides` profile 카운터 +1

#### Task S2-2: 라이딩 리스트 + 상세 (`/rides`, `/rides/:id`)
- 리스트: 시간순 카드 (spot, duration, conditions 요약)
- 상세: 미디어 갤러리 + 사용 장비 + 조건 + 인증 evidence 토글

#### Task S2-3: 통계 카드 (대시보드)
- 총 라이딩 횟수, 총 시간, 최고 속도, 가장 자주 가는 spot, 가장 많이 쓴 장비
- 단순 SQL aggregation; Edge Function 불필요

---

### 2.2 Week 2 — 인증 system

#### Task S2-4: 인증 신청 page (`/certifications/apply`)
- 카테고리 선택 → speed/skill/combo
- cert_type 선택 (CERTIFICATION_SYSTEM.md 기준 enum)
- evidence ride 선택 (기존 라이딩 로그에서 multi-select)
- evidence 영상 추가 업로드 (선택)
- 제출 → status='pending'

#### Task S2-5: 인증 history page (`/certifications`)
- 본인 신청 history (pending/approved/rejected)
- approved 인증은 훈장 visualization (대시보드 hero에도 표시)

#### Task S2-6: 인증 훈장 시각화
- SVG 또는 emoji 기반 badge component
- speed_grade는 5-tier 색상 (회색 → 녹색 → 파랑 → 빨강 → 금)
- skill cert는 작은 칩 (chip) 그리드
- combo는 큰 metallic badge

#### Task S2-7: Danny admin review page (`/admin/certifications`)
- pending 리스트 (오래된 순)
- 신청 상세 → evidence ride·video 확인
- approve / reject + reviewer_notes
- approve 클릭 시 trigger가 자동으로 profile 동기화 (apply_certification 함수)
- 결과 → notifications 자동 insert (Edge Function)

---

### 2.3 Week 3 — 커뮤니티

#### Task S2-8: 게시판 (`/community`)
- type 필터 (ride-log/question/review/event/tip)
- 카드 리스트 (title, snippet, 작성자, 시간, like/comment count)
- 새 글 작성 button → `/community/new`

#### Task S2-9: 글 작성 + 상세
- 작성: title, body (markdown), type, spot 태그, ride 링크, 이미지 업로드
- 상세: 본문 + 댓글 list + 댓글 작성 form
- 대댓글 (parent_comment_id)

#### Task S2-10: Realtime 알림
- Supabase Realtime channel: `notifications:user_id=<uid>`
- bell 아이콘에 unread count
- 클릭 → drawer + read 처리

---

### 2.4 Sprint 2 끝 — Verification

- ✅ Beta tester 3명 가입 → 각자 라이딩 로그 5개+ 작성
- ✅ Beta tester 1명이 인증 신청 → Danny review → approve → badge visible
- ✅ Beta tester 모두 커뮤니티 게시 + 댓글
- ✅ Realtime 알림 working
- ✅ RLS 침투 테스트 재실행 (S1-V 항목 + cert 관련 신규)

---

## 3. Sprint 3+ — 미정 (참고)

다음 task에서 별도 plan 작성. 미리 적어두는 항목:
- Spot 추천 Edge Function (KHOA + Open-Meteo + inventory match)
- 컨설팅 form + Danny dashboard
- 단무지 discount_inventory 매칭 알고리즘 + 알림
- 영상 자동 분석 (외부 API research)

---

## 4. Sprint 1 첫 주 Task List (즉시 시작 가능)

다음 task에서 구현할 순서:

```
[Day 1]
☐ S1-1  Supabase 프로젝트 생성 (Tokyo)
☐ S1-2  CLI 설치 + supabase init + link
☐ S1-3  migration push (0001 + 0002)
☐ S1-4  0003_seed_spots.sql 작성 + push

[Day 2]
☐ S1-5  app/ Vite project bootstrap + Supabase client
☐ S1-6  Login + Signup page (이메일)
☐ S1-7  RequireAuth + AuthContext

[Day 3-4]
☐ S1-8  Profile page (read + edit)
☐ S1-9a Inventory list + create

[Day 5-6]
☐ S1-9b Inventory edit + delete
☐ S1-10 정적 사이트 auth-bridge.js
☐ S1-V  Verification (RLS + Lighthouse)
```

---

## 5. Danny 결정 필요 항목 (Sprint 1 시작 전)

| #  | 결정사항                                            | 옵션                                       | 추천      |
|----|----------------------------------------------------|-------------------------------------------|----------|
| Q1 | Supabase 프로젝트 명                                | `dmjgroup`, `dmj-prod`                    | `dmjgroup-prod` |
| Q2 | OAuth provider 어디까지?                            | 이메일만 / +Google / +Apple / +Kakao        | 이메일+Google (Sprint 1) → Kakao (Sprint 2) |
| Q3 | app.dmjgroup.kr 도메인 즉시 분리?                   | 분리 / `dmjgroup.kr/app` 서브패스            | 분리 (CNAME) |
| Q4 | username 정책                                       | 자동생성만 / 사용자 변경 가능                  | Sprint 1: 자동, 변경은 Sprint 2 |
| Q5 | 사진/영상 max 크기                                   | 10MB / 25MB / 50MB                        | 사진 10MB, 영상 50MB (무료 1GB tier 고려) |
| Q6 | 인증 expiry policy                                  | speed: 영구, skill: 1년, 2년, 영구          | speed 영구, skill 2년, combo 영구 |
| Q7 | profiles.is_public default                          | true (오픈) / false (private)              | false (사용자가 opt-in) |
| Q8 | products.json sku 정책                              | 그대로 string / FK 테이블 신규               | Sprint 1: string, Sprint 3에 products 테이블 도입 검토 |

---

## 6. 측정 지표 (KPI)

Sprint 종료 시 측정:

| 지표                            | Sprint 1 목표 | Sprint 2 목표 |
|--------------------------------|--------------|--------------|
| 가입 → inventory 등록 시간       | < 5 분        | < 3 분        |
| Lighthouse PWA score           | ≥ 90         | ≥ 95         |
| RLS 침투 테스트 통과율          | 100%         | 100%         |
| Beta tester 활성 user           | 1 (Danny)    | ≥ 5          |
| 평균 ride log/user/주           | -            | ≥ 1          |

---

**다음 step**: Q1-Q8 결정 → Sprint 1 Day 1 시작.
