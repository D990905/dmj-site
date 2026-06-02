# dataviz_dashboard_ia_spec.md — 인프라 #9 Orchestrator Dashboard 의 information architecture + 시각 spec

> ## ⚠ DEPRECATED — γ 채택 (2026-06-02)
>
> **본 spec 작성 시점 (2026-05-31) 에 시스템 A `admin/dashboard/` (cytoscape PWA · 21 task × 8 expert 다크 cockpit graph) 의 존재를 인지 못 한 부주의가 있었습니다.** 시스템 A 가 본 spec 의 IA 80% 를 이미 cover (cytoscape graph = Persona board + Today 통합 · side panel = Decision · sheet = Reference).
>
> **로즈 윤 12:33 γ 패턴과 동일** — 본 spec 의 §1 IA 4 영역 layout 은 **deprecate**, 살아있는 산출물만 시스템 A 에 PR contribute.
>
> ### 유효 산출물 (살아있음)
>
> | § | 내용 | 후속 |
> |---|---|---|
> | **§2-1** Directive state → status 색 매핑 logic | `chart-theme.js` 5 단계 status 토큰 → directive state 5 매핑 | 시스템 A 의 `--c-green`/`--c-yellow`/`--c-red` 토큰으로 재맵 (다크 cockpit theme) |
> | **§2-2** Persona category 색 (6→9 확장 요청) | 로즈 `brand_color_spec §2-1` 8 persona hex 와 통합 (로즈 12:33 PR 4 PersonaAvatar gradient 패턴 동일) | 로즈 spec 으로 흡수 — 본인 권장 X |
> | **§3** 차트 4 종 — 비용 burndown · persona 활용도 · ship cadence · decision sparkline | implementation-ready spec | **신규 `dataviz_pr_dashboard_contributions.md`** 로 분리 작성 — 시스템 A `admin/dashboard/metrics.html` 또는 collapse panel PR |
> | **§5-2** 샘 정 책임 영역 (lie factor 검수 · 시각 토큰) | 살아있음 — PR pair 패턴 | 유지 |
>
> ### Deprecate 된 부분 (시스템 A 가 cover)
>
> - **§1 IA 4 영역 layout** (Today / Persona board / Decision log / Reference shelf) — 시스템 A canonical
> - **§4 3D vs 2D 분리** — γ 채택으로 자연 해소 (시스템 A 가 2D)
> - **§0-1 결정 요청 3 건** — #1 (GitHub Pages 정적) γ 패턴으로 해소, #2 (3D 분리) 자연 해소, #3 (push → polling → realtime) #11 daemon plan align
>
> ### Reference 보존
>
> 본문 (§1 ~ §9) 은 reference 용 보존. 추후 시스템 A 가 다른 갈래로 가는 결정 발생 시 (예: hybrid Astro overlay) 본 spec 의 IA framework 재참조 가능.
>
> **— 샘 정 · 2026-06-02 · 정직 우선 · 본인 작업 deprecate 도 OK**

---

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 1 spec (DEPRECATED — γ 채택, 위 notice 참조) |
| 작성 | 샘 정 (DataViz Specialist, #2) · 2026-05-31 · 2026-06-02 deprecated |
| 대상 | 인프라 #9 Orchestrator Dashboard 의 IA + 시각 layer |
| 근거 | `_experts/expert_orchestrator_daemon_reference.md` §6-2 protocol · `_team/operations_setup.md` (Notion #decisions schema) · `site/riding-dashboard/CHART-DESIGN-SYSTEM.md` · `_experts/expert_dataviz_reference.md` §1 의 Tufte·color·mobile 원칙 |
| Co-owners | Frontend (#4 알렉스 박) — 구현 · Backend (#10) — status JSON 스키마 · Orchestrator (#11) — `.orchestrator/status/*.json` 공급 · Visual Designer (#1 로즈 윤) — 토큰 일관성 |
| 후속 | `dataviz_pr_dashboard_contributions.md` (신규 · 차트 4종 implementation-ready spec) |

> **읽는 법.** §0 = TL;DR + Open Q2 (GitHub 인증 vs Pages 노출) 답변. §1 = IA — 4 영역 layout. §2 = 시각 위계 — status 색 매핑 (chart-theme 토큰 재사용). §3 = 추천 차트 4 종 + 비추천 1 종. §4 = 3D 가상 사무실 분리 권장. §5 = 알렉스 박 협업 인터페이스. Phase 1 산출은 본 spec — 구현 0줄.

---

## 0. TL;DR + Open Q 답변

### 0-1. 핵심 결정 3 건 (Danny 결정 요청)

| # | 결정 | 권장 | 이유 |
|---|---|---|---|
| 1 | **Dashboard 호스팅** (Open Q2) | **GitHub Pages 정적** | (1) auth 불필요 — 즉시 사용 (2) 인프라 #11 의 `.orchestrator/status/*.json` 을 raw URL fetch 로 직접 읽음 (3) Phase 1 push 인프라 그대로 활용 (4) Phase 2 Supabase 도입 시 fetch URL 만 교체 |
| 2 | **3D 가상 사무실 vs 2D 통합 대시보드** | **분리 — 2D 우선** | 3D 는 정보 전달 효율이 2D 대비 낮음 (Tufte chartjunk). 2D 가 ship 후 3D 는 Phase 3+ 또는 Gather Town 같은 가벼운 옵션 |
| 3 | **실시간 vs push 단위 갱신** | **push 단위 (Phase 1) → 30 초 polling (Phase 2 full mode)** | #11 daemon 의 polling interval 과 일치. 진정한 realtime 은 Supabase realtime 채널 필요 (Phase 2-B) |

### 0-2. Phase 1 즉시 가치

알렉스 박이 옵션 A (정적 HTML + JSON fetch) 로 1 sprint 안에 ship 가능. 의존성 0 — Vanilla JS + Chart.js (이미 riding-dashboard 에 있음) 재사용.

---

## 1. Information Architecture — 4 영역

### 1-1. 전체 layout (desktop · 1280px)

```
┌──────────────────────────────────────────────────────────┐
│ Header — "SailTechCo Operations" + last sync timestamp  │
├──────────────────────────────────────────────────────────┤
│ Today (60% width) │ Persona board (40% width)            │
│ ── 결정 대기 ──  │ ── 8 persona grid ──                  │
│ ── 진행 중 ──    │ (각 카드 = 현재 task + state)         │
│ ── 오늘 종료 ──  │                                       │
├──────────────────────────────────────────────────────────┤
│ Decision log (full width — sortable / filterable table)  │
├──────────────────────────────────────────────────────────┤
│ Reference shelf (검색 가능 카드 grid — _experts/*.md)    │
├──────────────────────────────────────────────────────────┤
│ Metrics (4 차트 — §3 참조)                                │
└──────────────────────────────────────────────────────────┘
```

### 1-2. 모바일 layout (< 768px)

위에서 아래로 stack — Today → Persona → Decision (요약) → Metrics → Reference. **`_experts/expert_dataviz_reference.md` §1-6 의 5 원칙** 적용 (one screen one decision · 5초 핵심 파악 · 44–48px touch · progressive disclosure · critical path 우선 로드).

### 1-3. 각 영역의 information schema

**① Today** — 대표님의 0.5 초 시야. 데이빗 옥 부재 시 dispatch 큐 가시화.

| 카드 | source | refresh |
|---|---|---|
| 결정 대기 ✓⏳⚠️ | Notion #decisions (status=open) | manual push |
| 오늘 dispatch in_progress | `.orchestrator/status/*.json` (state=in_progress) | 30s polling |
| 어제 종료 (commits + cost) | 같은 파일 (state=done, finished_at=어제) | 30s polling |

**② Persona board** — 8 persona × 데이빗 옥 grid (3×3, 9 칸). 각 칸:

```
[avatar] 샘 정 (DataViz #2)
─────────────────
🔵 in_progress
"Phase 2-A target polar overlay spec"
last update: 2분 전
cost so far: $0.42 / $1.50 cap
─────────────────
다음 핸드오프: 알렉스 박 (#4)
```

state 색 = §2-1 의 5 단계 status 토큰 (chart-theme 재사용).

**③ Decision log** — 표 (sort by 일자·도메인·owner·status). Notion #decisions 와 양방향 sync (Phase 2). 

| col | 데이터 | 정렬 |
|---|---|---|
| 일자 | `2026-05-31` | default desc |
| 도메인 | `[dataviz]` 등 (operations_setup §2-2 의 11 태그) | filter chip |
| 결정 한 줄 | summary | 검색 |
| owner | 페르소나 | filter |
| status | open/in-progress/done/revisit | 색 + filter |
| dispatch link | D-YYYY-MM-DD-NNN | click → 상세 |

**④ Reference shelf** — `site/_experts/*.md` (15 파일 ~6,100줄) 카드 grid + full-text search. 페르소나 아바타 + 문서 길이 + 마지막 수정일.

**⑤ Metrics** — §3 의 4 차트.

---

## 2. 시각 위계 — chart-theme.js 토큰 재사용

### 2-1. Directive state → status 색 매핑

`site/riding-dashboard/js/chart-theme.js` 의 5 단계 status 토큰을 **그대로 재사용**. 신규 토큰 추가 0 건.

| Directive state | 색 토큰 | hex | 의미 |
|---|---|---|---|
| `done` (성공·commits 있음) | `status.veryGood` | `#1FA055` | 완료, 결과 좋음 |
| `in_progress` (정상) | `status.good` | `#7FC241` | 진행 중 |
| `pending` (queue 대기) | `status.mid` | `#F2C20E` | 대기 |
| `error` (retry 가능) | `status.bad` | `#EC8A2E` | 경고, 재시도 |
| `error` (cost cap 초과·non-retryable) | `status.veryBad` | `#D6453A` | 실패, 사람 개입 필요 |

**이유** — `CHART-DESIGN-SYSTEM.md` 의 핵심 원칙 "상태색 = 성과 잘함/못함 전용" 과 일치. directive state 가 정확히 "성과" 영역.

### 2-2. 페르소나 식별 색 — 범주색 토큰

8 페르소나 × 데이빗 옥 = 9 명에게 **chart-theme `category` 토큰** 할당 (좋·나쁨 의미 없음 — 단순 구분):

| persona | category index | hex |
|---|---|---|
| 로즈 윤 (#1 Visual) | `category[0]` | `#0A2540` (navy) |
| 샘 정 (#2 DataViz) | `category[1]` | `#1F8FFF` (sea blue) |
| 티모 강 (#3 Sports Sci) | `category[2]` | `#1FB6B6` (teal) |
| 알렉스 박 (#4 Frontend) | `category[3]` | `#6B7A8D` (slate) |
| 메이 한 (#5 UX) | `category[4]` | `#7A5FA8` (violet) |
| 캔 최 (#6 Marketing) | `category[5]` | `#C58A2E` (amber) |
| 히로 구 (#7 Hardware) | 신규 (`category[6]`) — Visual Designer 결정 | TBD |
| 왕 정 (#8 Mobile) | 신규 (`category[7]`) — Visual Designer 결정 | TBD |
| 데이빗 옥 (Orchestrator) | 신규 (`category[8]`) — Visual Designer 결정 | TBD |

**Open question** — `category` 토큰을 6 → 9 개로 확장 필요. **로즈 윤 결정 사항** (색 추가 spec). 후보: muted-rose · forest-green · clay 등 status·side·hrZone 색과 충돌 X 인 톤. 로즈가 결정.

### 2-3. 데이터-잉크 비율 원칙 (Tufte 적용)

- **격자선** = `base.grid` alpha 0.07 (riding-dashboard 와 동일)
- **카드 테두리** = `base.border-soft` (operations_setup §2-4 dashboard.css 와 동일)
- **status 색은 채움(fill) 만, border 는 inkStrong (navy)** — directive 카드에 빨강·초록 테두리를 두르면 dashboard 가 어지러움
- **persona category 색은 avatar 옆 4px stripe 만** — 카드 전체를 색으로 칠하지 말 것

### 2-4. WCAG 2.2 AA 준수

- 모든 텍스트 contrast ≥ 4.5:1. status 색 위 텍스트는 흰색 (라이트 모드 대시보드).
- focus-visible ring 2px solid `#1F8FFF` (sea blue), 4px offset — 알렉스 박 #4 의 a11y 기본값과 동일.
- color 단독 인코딩 금지 — state 는 색 + 아이콘 + 텍스트 라벨 3중 (✓⏳⚠️ + "in_progress").

---

## 3. 추천 차트 4 종 + 비추천 1 종

### 3-1. 차트 1 — 비용 burndown (일·월)

- **유형** Chart.js line + area (월간 누적 line, daily bar)
- **데이터** `~/.config/orchestrator/usage.json` (cost.py 가 누적) → JSON 으로 dashboard 에 노출
- **X** 일자 · **Y1** day_total ($) · **Y2** month_total / monthly_cap ratio (도넛)
- **임계 표시** — daily_notify_usd = $10 horizontal line, monthly_cap = $50 horizontal line
- **데이터-잉크** ✅ — 단순 line + 임계선. Tufte 충실
- **인터랙션** hover → 그날 directive 리스트 popup

### 3-2. 차트 2 — Persona 활용도 (지난 30일)

- **유형** 가로 막대 (horizontal bar, sorted by count)
- **데이터** `.orchestrator/status/*.json` 의 specialist 필드 집계 (last 30d)
- **X** count of done directives · **Y** persona (9 명)
- **색** persona category 토큰 (§2-2)
- **데이터-잉크** ✅
- **인터랙션** click → 해당 persona 의 30 일 directive list

### 3-3. 차트 3 — Dispatch ship cadence (분포 + 평균)

- **유형** 바이올린 (또는 히스토그램) + 평균선
- **데이터** finished_at - started_at (단위: 일)
- **목표값** operations_setup §5-2 의 "5일 이내" — vertical reference line
- **데이터-잉크** ✅ — riding-dashboard `renderViolin` 인프라 재사용 가능 (좌우 비교 X 면 단일 violin)
- **인터랙션** hover → 그 cadence 의 dispatch 리스트

### 3-4. 차트 4 — Decision cadence (주별)

- **유형** sparkline (Tufte 정통) — 각 도메인 (11 태그) 옆에 작은 워드사이즈 차트
- **데이터** Notion #decisions 의 도메인별 weekly count (last 12 weeks)
- **데이터-잉크** ✅ — 한 도메인당 12 데이터 포인트, 1 줄 inline
- **인터랙션** hover → 그 주의 결정 리스트

### 3-5. 비추천 — Pie / Donut 의 과다 사용

페르소나 활용도를 도넛으로 표시하는 것은 **반대**. 9 슬라이스 = 각도 비교 불가. **가로 막대 sorted by % 가 정답** (Tufte). 단 비용 cap 도달율 같은 "단일 비율 % 1 개" 는 도넛 OK.

---

## 4. 3D 가상 사무실 vs 2D 대시보드 — 분리 권장

### 4-1. 정보 가치 비교 표

| 정보 항목 | 2D dashboard | 3D office | 정확성 |
|---|---|---|---|
| "지금 누가 무슨 task?" | 0.5 초 | 3 초 (카메라 회전) | 2D > 3D |
| "이 결정의 alternatives?" | 1 클릭 | 불가 | 2D > 3D |
| "비용 burndown" | 차트 1 장 | 불가 | 2D > 3D |
| "팀 morale·소속감" | 없음 | 가치 있음 | 3D > 2D |
| "외부 손님에게 보여주기" | 정보 dense | impressive but slow | trade-off |

### 4-2. 권장 — 2 트랙 분리

**트랙 A (Phase 1·2)** — 2D 통합 대시보드. 본 spec 의 §1~§3.

**트랙 B (Phase 3+ 또는 잠정 Gather Town)** — 3D 또는 2.5D 가상 사무실. **morale·brand·외부 손님용 — 워크플로우 ❌**. 인프라 #11/#10/#9 와 별도 트랙.

**오늘 당장 데이빗 옥 부재 메우기** — 둘 다 안 만들고 임시로 **Notion `#decisions` + `_team/index.html` 정적 페이지** 로 운영 (operations_setup §1-3 이미 정의됨). 본 spec 의 dashboard 가 ship 되면 자연스럽게 대체.

---

## 5. 알렉스 박 (#4) 협업 인터페이스

### 5-1. 알렉스 박이 결정할 영역 (frontend 구현)

- **빌드** — Vanilla JS + Chart.js 권장 (riding-dashboard 와 dependency 일치). React 도입은 보류 (overkill).
- **호스팅** — GitHub Pages 의 `site/_team/dashboard.html` (또는 `/dashboard/`). 정적 HTML + JS 만.
- **데이터 fetch** — fetch (raw URL) `https://raw.githubusercontent.com/{owner}/{repo}/main/.orchestrator/status/*.json` — 단, Pages 내 동일 origin 으로 옮기는 게 CORS 안전. 알렉스 결정.
- **polling** — 30 초 SetInterval (인프라 #11 daemon 과 일치)
- **a11y** — focus-visible, prefers-reduced-motion, role=main / nav / region 등 landmark.
- **performance** — Critical CSS inline, 차트는 IntersectionObserver lazy.

### 5-2. 샘 정 (#2 — 본인) 이 책임지는 영역

- **시각 토큰** — §2 의 status / category 색 매핑, 알렉스에게 토큰 import 권장 (`chart-theme.js` 재사용)
- **차트 4 종 구현 reference** — riding-dashboard `renderViolin`·`renderProgression` 패턴 재사용 권장. 코드 sample 은 별도 PR (Phase 2 에서 알렉스와 페어)
- **Lie factor 검수** — 비용 chart 의 monthly_cap line, ship cadence 의 5 일 목표선 모두 시각 lie 없는지 확인

### 5-3. 로즈 윤 (#1) 결정 필요

- **§2-2 의 category 토큰 9 개 확장** — 색 결정 + WCAG contrast 검증
- **Persona avatar 디자인** — 9 개 캐릭터 일관성 (Phase 2)

### 5-4. 백엔드 (#10) 와의 contract — Supabase + GitHub Issues hybrid

Danny 정의 명시: **#10 Backend = Supabase + GitHub Issues hybrid (공존)**. 따라서 dashboard 는 두 surface 를 **함께** 읽고, 각자의 강점을 분담한다:

| Surface | 강점 | 책임 영역 |
|---|---|---|
| **GitHub Issues** | git native, 무료, 외부 stakeholder (조수철·4 브랜드 본사) 의 view 권한 부여 쉬움 | **Directive queue (입력)** — 사람이 issue 만들면 #11 이 pick. 외부와 공유되는 결정 archive. |
| **Supabase** | realtime 채널, row-level 쿼리, 집계 (count/avg/group by) 가 SQL 로 강함 | **상태 + 비용 + 메트릭스 (집계)** — daemon heartbeat, cost runrate, persona 활용도 집계, dashboard 의 chart 4 종 데이터. |
| **`.orchestrator/status/*.json`** (git committed) | Pages raw URL 로 zero-auth 노출 | **Status snapshot (출력)** — 양쪽의 binding view. Phase 1 의 primary, Phase 2 에서도 fallback 으로 유지. |

Dashboard 의 fetch 전략:

- **Phase 1 (즉시)** — `.orchestrator/status/*.json` 만 fetch. GitHub Issues 는 Notion #decisions 와 paired view (read-only embed). Supabase 없음.
- **Phase 2 (인프라 #10 활성화 후)** — Supabase realtime 채널을 dashboard 에 직접 wire (chart 4 종이 라이브). GitHub Issues 는 directive queue UI 로 노출 (대표님이 brower 에서 issue 만들기 / 닫기). `.orchestrator/status/*.json` 은 정적 fallback 유지.

**스키마 정합성** — Orchestrator §6-2 의 status JSON 스키마가 **Supabase row 와 GitHub Issue body 모두에 1:1 매핑** 가능해야 함. **Backend (#10) 결정 사항** — 같은 directive_id 가 양쪽 시스템에 동시 존재할 때 source-of-truth 누가 가져갈지 (권장 = Supabase 가 truth, GitHub Issue 는 mirror).

---

## 6. 제약 준수 확인

| 제약 | 준수 |
|---|---|
| chart-theme 토큰 의미 유지 | ✅ — §2-1, §2-2 모두 기존 status / category 토큰 재사용 |
| Phase 1 production 코드 변경 X | ✅ — 본 spec 만, 구현은 알렉스 박 (#4) |
| 데이빗 옥 부재 운영 | ✅ — operations_setup §1-3 manual 운영과 병행 가능 |
| 3D 가상 사무실의 ROI 검토 | ✅ — §4 에서 분리 권장 |
| feedback_dashboard_viz_chart_over_table | ✅ — §3 의 4 차트 + sparkline. 표는 Decision log 만 |

---

## 7. Phase 2 마이그 경로 (hybrid 전제)

1. **Phase 2-A** — 알렉스 박 구현 sprint 1. 정적 HTML + `.orchestrator/status/*.json` fetch + 4 차트. GitHub Issues 는 read-only embed. **Supabase 없이도 dashboard 동작.** 1~2 주.
2. **Phase 2-B** — 인프라 #10 Supabase 활성화 후 **dashboard 에 추가 wiring**. URL 교체가 아니라 **hybrid surface 추가** — Supabase realtime 채널이 chart 4 종을 live 로 갱신, `.orchestrator/status/*.json` 은 fallback 유지. 1 주.
3. **Phase 2-C** — Notion #decisions 와 GitHub Issues 양방향 sync (Notion API + GitHub webhook). 외부 stakeholder 시야가 자연스럽게 통합. 0.5~1 주.

총 3~4 주 estimate. 알렉스 박 sprint allocation 확인 필요.

**hybrid 의 미세 결정 사항** — `directive_id` 가 양쪽 (Supabase / GitHub Issue) 에 동시 존재 시 source-of-truth. **권장 = Supabase = truth, GitHub Issue = mirror** (Backend #10 결정). 이유: realtime 채널의 갱신 속도가 GitHub webhook 보다 빠르고, 충돌 시 dashboard 가 stale read 안 함.

---

## 8. Open questions (샘 정 → 다른 페르소나)

1. **(로즈 윤 #1)** category 토큰 확장 6 → 9. 추천 hex + WCAG contrast 검증.
2. **(알렉스 박 #4)** 빌드 — Vanilla JS + Chart.js 동의? React 도입 ROI 평가는?
3. **(왕 정 #8)** Mobile (iOS·Android) 에서 dashboard 보기 — webview vs PWA? Phase 2 후보.
4. **(데이빗 옥 / Danny)** Notion #decisions 양방향 sync 의 우선순위 — Phase 2-C 시점 OK?
5. **(메이 한 #5)** Dashboard 의 onboarding flow — 첫 방문자 (외부 손님 / 신규 페르소나) 의 첫 30초 어떻게 안내?

---

## 9. Sources

- `site/_experts/expert_orchestrator_daemon_reference.md` — Orchestrator #11 의 §6-2 protocol
- `site/_team/operations_setup.md` — Notion #decisions schema · Slack 채널 · Calendar
- `site/_team/team_personas.md` — 8 페르소나 + 데이빗 옥 정의
- `site/riding-dashboard/CHART-DESIGN-SYSTEM.md` — 색 4계열 분리 원칙
- `site/_experts/expert_dataviz_reference.md` — §1-1 Tufte · §1-5 color · §1-6 mobile
- Tufte, *The Visual Display of Quantitative Information* — sparklines, data-ink ratio
- [Chart.js docs](https://www.chartjs.org/docs/latest/)
- [GitHub Pages](https://docs.github.com/en/pages)

---

_Last updated: 2026-05-31_
_Phase 1 spec 완료 — 알렉스 박 (#4) 구현 대기. Danny 결정 3 건 (§0-1) 후 sprint 시작 가능._
