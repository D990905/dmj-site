# Phase 12 — Backend Architecture

**작성일**: 2026-05-05
**Phase**: 12 (Backend foundation)
**전제**: Phase 11 (22 SKU 정적 catalog) 완성됨
**목표**: 회원·재고·인증·커뮤니티 기반의 dynamic 서비스로 확장

---

## 1. 시스템 아키텍처

### 1.1 도메인 분리 전략

세 개의 entry point로 책임을 분리한다. 정적 마케팅과 인증 PWA, 관리자 도구를 한 코드베이스에 섞지 않는다.

```
┌─────────────────────────────────────────────────────────────┐
│                         사용자                               │
└─────────────────────────────────────────────────────────────┘
                │                  │                │
                ▼                  ▼                ▼
        ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
        │ dmjgroup.kr  │   │ app.dmjgroup │  │ admin.dmj... │
        │  (정적)       │   │  .kr (PWA)   │  │  (관리자)     │
        │               │   │               │  │               │
        │ Phase 11      │   │ React + Vite │  │ React (분리)  │
        │ HTML/CSS/JS  │   │ Supabase JS  │  │ Supabase JS  │
        │ Cloudflare   │   │ Service      │  │ RLS admin    │
        │ Pages        │   │ Worker       │  │ role         │
        └──────┬───────┘   └──────┬───────┘  └──────┬───────┘
               │                  │                  │
               └──────────────────┼──────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │      Supabase (Tokyo)     │
                    │                            │
                    │  PostgreSQL 15            │
                    │  + Auth (이메일/Google)    │
                    │  + Storage (사진/영상)     │
                    │  + Realtime (커뮤니티)     │
                    │  + Edge Functions         │
                    │  + Row-Level Security     │
                    └──────────┬─────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                              ▼
        ┌──────────────┐              ┌──────────────┐
        │ KHOA API     │              │ Open-Meteo   │
        │ (물때·조위)    │              │ (바람·파고)    │
        └──────────────┘              └──────────────┘
```

### 1.2 데이터 흐름 (예: Spot 추천)

```
사용자 → app.dmjgroup.kr
  → POST /functions/recommend (Edge Function)
    → SELECT inventory WHERE user_id = ?
    → SELECT spots WHERE distance < 100km
    → fetch KHOA(spot.station_id, date)
    → fetch Open-Meteo(spot.lat, spot.lng, date)
    → JOIN discount_inventory WHERE matches user gap
  → return { spot, conditions, recommended_gear, discount_offers }
사용자에게 카드 형식으로 표시
```

### 1.3 인증 흐름

```
회원가입 → Supabase Auth → auth.users row 생성
  → trigger: handle_new_user() → profiles row 자동 생성
  → 이메일 verify → JWT 발급
  → 이후 모든 요청에 JWT → RLS가 user_id 자동 매칭
```

---

## 2. 기술 스택 결정 근거

### 2.1 Backend: Supabase

| 옵션              | 장점                                      | 단점                           | 결정 |
|------------------|------------------------------------------|-------------------------------|-----|
| **Supabase**     | PostgreSQL 풀 + Auth/Storage/Realtime 포함, RLS로 백엔드 코드 최소화, 무료 tier 500MB DB·1GB Storage | Vendor lock-in 약간 있음        | ✅ |
| Firebase         | 성숙한 mobile SDK                         | NoSQL → 복잡 query 어려움, RLS 비교적 약함 | ✗ |
| 자체 서버 (Node+PG) | 완전 제어                                  | 운영 부담, Auth/Storage 직접 구현 | ✗ (추후 매출 발생 후 검토) |

**핵심 근거**: 라이딩 로그·인증 history·커뮤니티는 관계형 query가 빈번. PostgreSQL의 `jsonb` + 표준 SQL이 NoSQL보다 진단·집계에 유리하다. RLS로 backend 코드 50% 절감.

### 2.2 Frontend: React + Vite (PWA)

| 옵션               | 결정 사유                                      |
|-------------------|----------------------------------------------|
| **React + Vite**  | ✅ 빠른 dev server, 작은 번들, PWA plugin 성숙  |
| Next.js           | SSR이 필요 없는 인증된 dashboard에 과한 무게      |
| Svelte            | 좋지만 ecosystem 작음, Danny 학습 곡선          |

**PWA 선택 근거**: iOS/Android 앱 스토어 등록 비용·심사 시간 회피. "홈 화면 추가" 한 번에 native 앱처럼 동작. Service Worker로 오프라인 라이딩 로그 입력 가능.

### 2.3 정적 사이트: Phase 11 그대로 유지

회원가입 없이 catalog 탐색 가능해야 SEO·진입 장벽 낮음. 인증된 user는 detail page에 "내 장비에 추가" 버튼이 활성화되도록 client-side에서 Supabase JWT 체크 후 토글.

### 2.4 외부 API

| API          | 용도                  | 비용                      |
|--------------|----------------------|--------------------------|
| KHOA         | 한국 물때·조위·수온     | 무료 (API 키 등록)         |
| Open-Meteo   | 바람·파고·기온         | 무료 (10,000 calls/day)   |
| Supabase     | DB·Auth·Storage      | 무료 tier (500MB·1GB)    |
| Cloudflare   | 정적 호스팅·CDN        | 무료                      |

**Phase 12 총 예상 비용**: $0/월 (트래픽 < 100 활성 user 기준)

---

## 3. 보안 모델 (RLS)

### 3.1 원칙

- **모든 테이블에 RLS 활성화**. 단 한 곳도 예외 없음.
- **Default deny**: policy 없으면 접근 불가.
- **Admin role**: `auth.users.raw_user_meta_data->>'role' = 'admin'` 조건으로 Danny에게만 부여.

### 3.2 Policy 매트릭스

| 테이블              | 본인 (own) | 타인 (others)                | Admin     |
|---------------------|-----------|------------------------------|-----------|
| profiles            | RW        | R (public 필드만)             | RW        |
| inventory           | CRUD      | R (`for_sale=true` only)     | R         |
| rides               | CRUD      | R (profiles.is_public=true)  | R         |
| certifications      | R, INSERT | R (approved만)               | RWUD      |
| posts               | CRUD      | R                            | RWUD      |
| comments            | CRUD      | R                            | RWUD      |
| discount_inventory  | -         | R                            | CRUD      |
| consultations       | RW (own)  | -                            | RW        |
| spots               | -         | R                            | CRUD      |

### 3.3 민감 데이터 분리

- `profiles.weight_kg`, `height_cm` → 본인만 read·write. 추천 알고리즘은 `auth.uid()` 기반으로 본인 데이터만 fetch.
- `consultations.request_data` jsonb → 본인 + 담당 consultant만 read.
- 영상/사진 → Supabase Storage, signed URL (만료 1시간) only.

---

## 4. 디렉토리 구조 (제안)

```
site/
├── (Phase 11 정적 그대로)              # dmjgroup.kr
│   ├── index.html
│   ├── catalog.html
│   ├── products/...
│   └── assets/js/auth-bridge.js       # NEW: Supabase JWT 체크
│
├── docs/
│   ├── PHASE12_ARCHITECTURE.md         # 이 문서
│   ├── PHASE12_SPRINT_PLAN.md
│   └── CERTIFICATION_SYSTEM.md
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_initial.sql            # 핵심 스키마
│   │   ├── 0002_rls_policies.sql       # RLS (분리 관리)
│   │   └── 0003_seed_spots.sql         # 한국 spot 초기 데이터
│   ├── functions/
│   │   ├── recommend/index.ts          # Edge Function
│   │   └── khoa-proxy/index.ts
│   └── seed.sql
│
└── app/                                # NEW: app.dmjgroup.kr (별도 deploy)
    ├── package.json
    ├── vite.config.ts
    ├── public/
    │   └── manifest.webmanifest        # PWA
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── lib/supabase.ts
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── Inventory.tsx
    │   │   ├── Rides.tsx
    │   │   ├── Community.tsx
    │   │   └── Profile.tsx
    │   ├── components/
    │   └── hooks/
    └── README.md
```

`admin/`은 Sprint 3 이후 분리. 우선 `app/?admin=true` 쿼리로 임시 운영.

---

## 5. 배포 전략

| 컴포넌트         | 호스팅              | 배포 방식                |
|----------------|--------------------|-----------------------|
| dmjgroup.kr    | Cloudflare Pages    | git push → 자동 빌드    |
| app.dmjgroup.kr | Cloudflare Pages   | Vite build → static   |
| Supabase       | Supabase Cloud (Tokyo) | CLI: `supabase db push` |
| Edge Functions | Supabase Edge      | `supabase functions deploy` |

**DNS 설정 필요**:
- `dmjgroup.kr` → Cloudflare Pages (현재)
- `app.dmjgroup.kr` → Cloudflare Pages (NEW, CNAME)
- `admin.dmjgroup.kr` → Cloudflare Pages (Sprint 3+)

---

## 6. 무엇을 미루는가 (Phase 13+)

다음은 **명시적으로 Phase 12 범위 밖**이다. 시간 낭비 방지.

- GPS 자동 sync (Phase 13: 모바일 GPS app 또는 GPX 업로드 파서)
- 영상 자동 분석 (Phase 14: ML 모델 또는 외부 API)
- 결제 (Phase 15: Toss Payments / Stripe Korea)
- 다국어 (영어/일본어) (Phase 16+)
- Native 앱 (PWA로 충분; 별도 native 구현은 매출 검증 후)

---

## 7. 위험 요소 + 완화책

| 위험                             | 영향   | 완화                                       |
|---------------------------------|-------|-------------------------------------------|
| Supabase 무료 tier 초과 (500MB) | 중    | 영상은 Storage 외부(예: Cloudflare R2) 미러링 검토 |
| KHOA API 변경/down              | 중    | Edge Function에 cache 1시간, fallback 표시 |
| RLS policy 실수로 data 노출      | 큼    | Sprint 1 종료 시 RLS 침투 테스트 (peer test) |
| Danny 1인 운영 → 인증 review 적체 | 큼    | Sprint 2부터 peer review 옵션 + Auto-GPS 우선 도입 |
| PWA iOS Safari 제한사항          | 작음  | iOS Add-to-Home 안내 문서 + push notification 우회 |

---

## 8. 결정 로그

| #  | 결정                                          | 근거                                |
|----|----------------------------------------------|------------------------------------|
| D1 | Supabase 채택 (Firebase 대신)                 | RLS + PostgreSQL + 무료 tier        |
| D2 | PWA (Native 앱 X)                             | 앱 스토어 비용·심사 회피, Service Worker로 충분 |
| D3 | dmjgroup.kr 정적 유지, app.dmjgroup.kr 신규    | SEO·진입 장벽·코드 분리              |
| D4 | Tokyo region                                  | 한국 사용자 latency 최소 (Singapore 대비 -30ms) |
| D5 | Edge Function으로 외부 API proxy              | API key 클라이언트 노출 방지·cache    |
| D6 | jsonb로 ride.conditions, consultation.data 저장 | 스키마 진화 비용 낮추기 (early-stage)  |
| D7 | 인증 cert에 expires_at 추가                    | skill은 1-2년 유지, 재인증 유도        |
| D8 | profiles.is_public 토글 추가 예정              | 라이딩 로그 공개 여부 선택권 (Sprint 2) |

---

## 9. 다음 step

1. ✅ 본 문서 (Architecture)
2. ✅ DB schema migration 작성 (`0001_initial.sql`)
3. ✅ Sprint Plan 작성
4. ✅ Certification System 명세
5. ⏳ Danny 결정 항목 confirm 후 Sprint 1 kickoff

**다음 Task에서**: Supabase 프로젝트 생성 + migration 적용 + Auth flow 코딩.
