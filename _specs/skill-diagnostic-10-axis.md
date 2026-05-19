# 10-Axis Pentagon Skill Diagnostic — Spec Document

**문서 버전:** v1.0 (draft, Danny 검수 대기)
**작성일:** 2026-05-12
**상태:** SPEC ONLY — 구현 X. Phase B 기능 후보.
**관련 audit:** §audit-2026-05-12 (MISSING flag)
**Lock 후보:** §163 (Danny 승인 시 lock — 단무지공방 distinct USP)

---

## 1. Concept Overview

### Why 10 axes, not 5?

단무지공방 사이트의 기존 시각화 자산은 **5축 radar chart** (`feedback_dmj_performance_5axis_chart.md` · §141)으로, 4 라이더 레벨 (입문·초급/중급자/상급자/선수레벨)별로 카테고리 분기된 dark/light 자동 감지 10-ring 동심 5각형 그래프다. 이 차트는 **장비 추천 시각화**에 최적화되어 있다 — 보드·윙·포일·세이프티 각 카테고리의 퍼포먼스 영역을 보여주는 게 목적.

하지만 **라이더 본인의 스킬 진단**에는 5축으로 부족하다. Danny의 코칭 인사이트:

> "대부분의 라이더는 한쪽 택이 약하다. 포트 택은 자이브가 깔끔한데 스타보드 택은 풀어내지 못하거나, 그 반대. 5축으로 평균을 내면 이 비대칭이 보이지 않는다."

**핵심 인사이트:** 5 skills × {port tack / starboard tack} = **10 axes**.

비대칭 라이더의 약점 영역을 시각적으로 즉시 인식할 수 있는 진단 도구. 이는 단무지공방의 distinct USP — 다른 distributor·샵에서는 제공하지 않는 1:1 컨설팅 자산.

### Speed는 별도 1-D 지표

Speed (top-end 속도)는 pentagon에서 분리한다. 이유:

- 속도는 **택 대칭**과 관계 없음 (양쪽 택 모두 같은 top speed)
- 속도는 **스킬보다 장비 의존도가 높음** — 윙·포일 선택이 라이더 스킬보다 더 결정적
- 별도 1-D 지표로 노출하면 라이더가 "스킬 향상 ≠ 속도 향상" 구조를 직관적으로 이해

### Use case

1:1 컨설팅 시점에서:
1. 라이더가 자가 평가 quiz 완료 (5-7분)
2. Pentagon + Speed bar 결과 시각화
3. Danny가 약점 영역 정확히 짚어 **추천 셋업·트레이닝** 제안
4. 컨설팅 신청 form에 결과 자동 첨부 → 사전 준비 강화

---

## 2. 5 Skill Axes (per tack)

5 skills × 2 tacks (port + starboard) = **10 pentagon axes**.

### 2-1. 5 Skills 정의

| # | Skill | 한국어 | 설명 |
|---|-------|--------|------|
| 1 | Upwind | 풍상 항해 | 풍상 각도 + 속도 + 일관성. 어택앵글 유지 능력. |
| 2 | Jibe | 자이브 | 다운윈드 회전 완성도. 포일 lift 유지·윙 핸드오버. |
| 3 | Tack | 택 | 업윈드 회전 완성도. mast foot 위치 변경·윙 회전. |
| 4 | Pumping | 펌핑 | 저풍속 take-off + glide 연결. 윙·포일 동기화. |
| 5 | Counter-balance / Stance | 카운터밸런스·스탠스 | 풋스트랩 안정성 + 상체 균형. cavitation 회피 능력. |

### 2-2. 왜 이 5개? (Not 7, not 3)

**Coverage:** 위 5 skills이 wingfoil progression의 **80% 병목**을 커버한다 (Danny 코칭 데이터 기반).

**제외한 후보:**
- Surfing-style turn — 상급자 이상에만 해당, 입문·초급에 노이즈
- Downwind — Counter-balance/Stance에 흡수 가능
- Foiling start — Pumping에 포함
- Wave entry — 지역 한정 (한국 동해 swell 시즌 제한적)

**왜 7이 아닌가:** Quiz 11 questions (10 + 1 speed) 이상이면 라이더 fatigue. 5-7분 cap 유지.

**왜 3이 아닌가:** 너무 압축되면 비대칭 진단이 흐려짐. 5는 wingfoil 코칭의 standard breakdown.

### 2-3. 5-level rubric

각 axis (예: port_upwind)는 1-5 점:

| Level | 명칭 | 설명 |
|-------|------|------|
| 1 | 처음 시도 | 시도해본 적 X 또는 한두 번 실패 |
| 2 | 가끔 성공 | 10% 미만 성공률. 의식적 노력 필요. |
| 3 | 일관성 확보 | 50% 이상 성공률. 풍속·조건 좋으면 안정. |
| 4 | 자신 있음 | 80% 이상 성공률. 다양한 조건에서 가능. |
| 5 | 대회 수준 | 95%+. 풍속 변화·러프 컨디션에서도 안정. 코칭 가능 수준. |

---

## 3. Speed (별도 1-D 지표)

Pentagon **밖에** 별도 1-D 막대로 표시.

### Why separate

- 속도는 **택 대칭** (양쪽 같음)
- 속도는 **장비 의존** (포일 선택, 윙 사이즈)
- Pentagon에 넣으면 비대칭 진단 시각이 흐려짐

### 5-level rubric

| Level | 기준 | 비고 |
|-------|------|------|
| L1 | 15 knots 까지 안정 | 입문·초급 일반 |
| L2 | 20 knots 까지 안정 | 중급자 진입 |
| L3 | 25 knots 자신 있음 | 상급자 기본 |
| L4 | 30 knots 자신 있음 | 상급자·선수레벨 |
| L5 | 30+ knots 자신 있음 | 선수레벨, 레이스 경험 |

### 측정 단위

- knots 사용 (wingfoil 업계 표준)
- 한국어 UI 라벨: "노트" 또는 "knots" 병기

---

## 4. UI Design Proposal

### 4-1. Self-assessment quiz

**시점 옵션 (Open Question #1, §8 참조):**
- A) 회원가입 직후 (모든 회원 데이터 확보)
- B) 컨설팅 신청 시 (sales funnel 연동)
- C) 자유 접근 (메뉴에서 항시 접근 가능)

**Quiz 구조:**
- 총 **11 questions** = 5 skills × 2 tacks + 1 speed
- 각 question: 5-level Likert (한국어 conversational description)
- 진행 시간: **5-7분**
- localStorage 자동 저장 (중간 이탈 시 복원)

**예시 question (port_jibe):**

> **포트 택 자이브 (다운윈드 회전 — 윈드 방향 등지고 회전)**
>
> - 1) 시도해본 적 없거나 한두 번 떨어졌음
> - 2) 가끔 성공하지만 포일이 떨어짐 (10% 미만)
> - 3) 풍속 좋으면 성공률 50%+ — 윙 핸드오버까지 일관성 확보
> - 4) 다양한 조건에서 자신 있음 (80%+) — 러프 컨디션도 OK
> - 5) 대회 수준 — 코칭 가능, 95%+ 성공률

### 4-2. Result visualization

#### Pentagon radar chart (10 axes)

```
       Port Upwind        Starboard Upwind
            ↑                    ↑
     Port Stance ←        → Starboard Stance
                    [center]
     Port Pumping ←        → Starboard Pumping
            ↓                    ↓
       Port Jibe          Starboard Jibe
            ↘                    ↙
            Port Tack    Starboard Tack
```

**시각 spec:**
- 10 axes를 360° 균등 분배 (각 36°)
- **좌측 절반 = port** (5 axes, 180° span: 90°~270°)
- **우측 절반 = starboard** (5 axes, 180° span: 270°~90° 시계방향)
- 외곽 ring = 5 (max), 내부 center = 0
- 10-ring 동심 펜타곤 grid (1단위마다 ring)
- 라이더 점수 = 채워진 polygon (반투명 fill)
- 비대칭 라이더 → polygon의 좌·우 크기 차이로 즉시 시각화

#### Speed bar (별도)

Pentagon 하단에 가로 막대:
- 5 segment (L1-L5)
- 현재 레벨 highlight + label
- Pentagon과 시각적으로 분리 (다른 metric임을 명확화)

#### 색상 (4 라이더 레벨 분기)

`reference_dmj_level_4_categories.md` (§155) 매핑:

| 레벨 | 색상 | Hex |
|------|------|-----|
| 입문·초급 | 초록 | `#4caf50` (tentative) |
| 중급자 | 청록 | `#26a69a` (tentative) |
| 상급자 | 주황 | `#ff9800` (tentative) |
| 선수레벨 | 골드 | `#ffc107` (tentative) |

자동 분류 임계값은 **Open Question #3** (§8 참조).

#### 다크/라이트 자동 감지

`feedback_dmj_performance_5axis_chart.md` (§141) spec 재사용:
- `prefers-color-scheme` 감지
- 라이트 모드: 흰 배경 + 어두운 axis 라벨
- 다크 모드: 어두운 배경 + 흰 axis 라벨

### 4-3. 약점 영역 분석 + 트레이닝 추천

결과 page 하단에 자동 분석 섹션:

**예시 output:**

> ### 진단 결과
>
> **가장 약한 영역:** 포트 택 자이브 (2/5)
> **가장 강한 영역:** 스타보드 택 펌핑 (4/5)
> **비대칭 지수:** 좌우 차이 평균 1.2 pt — **중간 비대칭**
>
> ### 추천 트레이닝
> 1. **자이브 기본기 글 읽기** → [/glossary.html#jibe](링크)
> 2. **1:1 컨설팅 신청** → 포트 택 약점 집중 진단 (₩XX)
> 3. **추천 셋업 변경 검토** → 자이브 안정성 위한 wing/foil 추천
>
> ### Find My Gear cross-link
> 현재 셋업 진단 → [/find-my-gear.html](링크)

---

## 5. Data Model (Phase 12 backend)

### 5-1. Table `rider_assessment`

| Column | Type | Note |
|--------|------|------|
| `id` | uuid PK | |
| `rider_id` | uuid FK → `riders` | |
| `assessment_date` | timestamp | |
| `source` | enum: self / coach / hybrid | 자가 vs 코치 평가 구분 |
| `port_upwind` | int 1-5 | |
| `port_jibe` | int 1-5 | |
| `port_tack` | int 1-5 | |
| `port_pumping` | int 1-5 | |
| `port_stance` | int 1-5 | |
| `starboard_upwind` | int 1-5 | |
| `starboard_jibe` | int 1-5 | |
| `starboard_tack` | int 1-5 | |
| `starboard_pumping` | int 1-5 | |
| `starboard_stance` | int 1-5 | |
| `speed_level` | int 1-5 | |
| `notes` | text | 라이더 자유 메모 |
| `coach_override_by` | uuid FK → `users` nullable | Danny / 조수철 등 |
| `coach_override_at` | timestamp nullable | |

### 5-2. Time series

- 라이더가 **매월** 자가 평가 → progression curve 시각화
- Coach override (Danny가 컨설팅 후 직접 수정 가능 → 객관성 보강)
- Admin UI에서 라이더별 모든 assessment history 조회

### 5-3. Privacy

- 라이더 본인 + 코치 (Danny + 조수철 + 권한자 — **Open Question #4**)만 접근
- 익명화 통계 (전체 회원 distribution)는 별도 view로 노출 가능

---

## 6. Implementation Scope (Phase별)

### Phase 1 — MVP (1-2주 예상)

**범위:**
- 정적 HTML quiz (`find-my-gear.html` 패턴 응용)
- 결과 시각화 SVG pentagon (vanilla JS, 외부 라이브러리 X)
- localStorage 임시 저장
- 결과 page 자동 분석 (약점 영역 텍스트 + 글로서리 cross-link)
- 4 라이더 레벨 색상 자동 분류

**제외:**
- 백엔드 저장 X
- 시간 series chart X
- Admin UI X
- 코치 override X

**산출물:**
- `/site/skill-diagnostic.html`
- `/site/assets/js/skill-pentagon.js`
- `/site/assets/css/skill-pentagon.css`

### Phase 2 — 백엔드 연동 (Phase 12와 함께)

**범위:**
- Supabase `rider_assessment` 테이블
- 회원 로그인 시 history 조회
- 시간 series chart (월별 progression curve)
- Coach override admin UI
- 컨설팅 신청 form에 결과 자동 첨부

**의존성:** Phase 12 (`project_dmj_phase12_auth.md` · §156) 백엔드 연동 완료 필요.

### Phase 3 — Advanced (향후)

- **AI 추천:** 라이더 progression curve 패턴 분석 → 셋업 추천 자동화
- **코치 video annotation 통합:** 컨설팅 시 영상 첨부 + 타임라인 annotation
- **그룹 비교:** 동일 레벨 라이더 분포 view (익명화)

---

## 7. CSS / Asset Requirements

### 7-1. 새 CSS class

```css
.skill-pentagon { /* SVG wrapper */ }
.skill-pentagon__axis { /* 10개 axis 라인 */ }
.skill-pentagon__ring { /* 10-ring grid */ }
.skill-pentagon__fill { /* 라이더 점수 polygon */ }
.skill-pentagon__label { /* axis 라벨 (포트/스타보드 5개씩) */ }
.skill-pentagon__label--port { /* 좌측 라벨 */ }
.skill-pentagon__label--starboard { /* 우측 라벨 */ }
.speed-bar { /* 별도 1-D 막대 */ }
.speed-bar__segment { /* L1-L5 각 segment */ }
.speed-bar__current { /* 현재 레벨 highlight */ }
```

### 7-2. 색상 토큰

`feedback_dmj_performance_5axis_chart.md` (§141)의 색상 시스템 재사용:
- dark/light 자동 감지
- 10-ring 동심 grid
- 흰색 axis 라벨 (다크 모드 기준)
- max-width 520px

### 7-3. SVG 자체 작성

- **외부 라이브러리 의존 최소화** — recharts, d3 X
- Vanilla JS + SVG `<polygon>` `<line>` `<text>` 직접 작성
- 단무지 사이트 lint Rule 17 준수 (자산 운영 정책)

### 7-4. 반응형

- Desktop: pentagon 520px max
- Mobile: 320px min, axis 라벨 축약 (예: "포트 자이브" → "P-Jibe")
- 인쇄용 stylesheet (컨설팅 시 출력본 사용 시)

---

## 8. Open Questions for Danny

### Q1. 자가 평가 시점

**선택:**
- A) 회원가입 직후 (모든 회원 데이터 확보, 진입 장벽 ↑)
- B) 컨설팅 신청 시 (sales funnel 강화, 데이터 범위 ↓)
- C) 자유 접근 (메뉴 항상 노출, 진입 장벽 X, 데이터 정합성 ↓)

**Danny 추천 받기:** A/B/C 중 또는 hybrid?

### Q2. 5 skills 확정

위 5개 (Upwind / Jibe / Tack / Pumping / Counter-balance) OK?

**대안 후보:**
- Surfing-style turn (상급자 이상)
- Ocean swell entry (지역 한정)
- Downwind glide (Counter-balance 흡수 가능)

**Danny 결재 필요:** 5개 lock vs 6-7 확장?

### Q3. 라이더 레벨 자동 분류 임계값

10 axes 합산 (max 50) + speed (max 5) = **총 55점** 기준:

**Tentative 임계값 (Danny 검토):**

| 레벨 | 점수 범위 |
|------|-----------|
| 입문·초급 | 0-22 (avg 2.0 미만) |
| 중급자 | 23-33 (avg 2.0-3.0) |
| 상급자 | 34-44 (avg 3.0-4.0) |
| 선수레벨 | 45-55 (avg 4.0+) |

**Danny 결재:** 임계값 OK? 또는 다른 가중치 (speed × 2, asymmetry penalty 등)?

### Q4. 코치 override 권한

**옵션:**
- A) Danny only
- B) Danny + 조수철
- C) Danny + 조수철 + 시니어 팀라이더 (3명, `project_dmj_team_rider_support.md` · §162 참조)

**Danny 결재:** 권한 범위 + 시니어 팀라이더 포함 여부?

---

## 9. References

### 사이트 내 관련 문서

- **기존 5축 차트 spec:** `feedback_dmj_performance_5axis_chart.md` (§141)
- **4 라이더 레벨 canonical:** `reference_dmj_level_4_categories.md` (§155)
- **컨설팅 talking points:** `reference_dmj_speed_consulting_talking_points.md` (§153)
- **Find My Gear 패턴 참조:** `site/find-my-gear.html`
- **Phase 12 Auth shell:** `project_dmj_phase12_auth.md` (§156)
- **팀라이더 지원 정책 (Q4 관련):** `project_dmj_team_rider_support.md` (§162)
- **글로서리 (skill 정의 원천):** `site/glossary.html`

### 외부 참조

- Wingfoil progression standard taxonomy (업계 일반)
- Danny 코칭 경험 기반 비대칭 가설

---

## 10. Lock Policy (DO_NOT_REVERT)

Danny 승인 후 **§163 으로 lock**:

### 보호 항목

1. **"포트/스타보드 비대칭 진단" 개념** — 단무지공방 distinct USP. 5축 평균 회귀 영구 금지.
2. **10 axes 구조** (5 skills × 2 tacks) — 다른 분기 (예: 5 skills × 3 conditions) 회귀 금지.
3. **Speed 분리 1-D 지표** — pentagon에 흡수 회귀 금지.
4. **5 skills 정의** (Upwind / Jibe / Tack / Pumping / Counter-balance) — Open Question #2 확정 후 lock.
5. **4 라이더 레벨 색상 매핑** — `reference_dmj_level_4_categories.md` (§155) 정합성 유지.

### Lint pattern

```
WARN if /5축.*pentagon|5.axis.*pentagon|symmetric.*skill/i in site
WARN if /port.*starboard.*평균|port.*starboard.*average/i in site
```

### 정책 무효화 조건

이 spec은 다음 경우 무효화:
- Danny가 §163 lock 거부
- 사용자 데이터 30+ assessments 수집 후 5 skills 정의 재검토 필요시
- 사이트 architecture 전면 개편 (Phase 13+)

---

**문서 끝.**

**Danny 검토 요청 항목:**
- §1 컨셉 OK?
- §2 5 skills 정의 OK? (Open Q #2)
- §3 Speed 별도 분리 OK?
- §4 UI 디자인 방향 OK?
- §6 Phase 1 MVP 범위 OK?
- §8 4 open questions 결재
- §10 §163 lock 승인?
