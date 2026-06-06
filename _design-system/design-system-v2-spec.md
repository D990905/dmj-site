# Design System v2 — Spec

| 항목 | 내용 |
|---|---|
| 문서 유형 | Design System v2 Phase 1 산출 spec — 결정 + 근거 + 가정 + 미해결 |
| Owner | Visual Designer (Rose Yoon) · 2026-06-06 |
| Sprint | 오전 3h · 본인 owner |
| Deliverable | `tokens.css` · `components.md` · `preview.html` · 본 spec.md (4 file in `site/_design-system/`) |
| 옥대표님 검증 ETA | 30초 view (본 §0 결정 + preview.html accent picker 라이브) |

> **읽는 법.** §0 핵심 결정 (옥대표님 30초 검증) · §1 8 벤치마크 → 7 패턴 매핑 (근거) · §2 본인 default 가정 · §3 미해결 (옥대표님 1글자 결정) · §4 v1 와의 관계 · §5 다음 sprint (알렉스 · 샘 · 메이) 핸드오프.

---

## 0. 핵심 결정 (옥대표님 30초 검증)

| # | 결정 | Rationale |
|---|---|---|
| **1** | **Dark-first** — `:root[data-theme="dark"]` default · light = Phase 2 lock 시 | 벤치마크 8/8 다크. sports science telemetry 정통. cockpit feel |
| **2** | **Single source = `tokens.css`** · CSS custom properties only · JS 의존 0 | 알렉스 swap 시 import 1줄. v1 의 `style.css` 와 별도 system, 공존 가능 |
| **3** | **Mono numeral OBLIGATORY** — 숫자 = JetBrains Mono · `tabular-nums` + `ss01` · `-0.04em` letterspacing | 벤치마크 8/8 mono. column 정렬 + slashed-zero (0↔O 구분) + telemetry visual identity 핵심 |
| **4** | **Glassmorphism standard** — `backdrop-filter: blur(24px)` + `rgba(255,255,255,0.04)` bg + `rgba(255,255,255,0.08)` border | 옥대표님 명시 §203 패턴 확장. Whoop / Vakaros 카드 정통 |
| **5** | **Hero = mono numeral + 작은 unit + label** (라이프스타일 사진 X) | Whoop / Vakaros / Form / Catapult 5/8 동일. 차트가 사진 대체 — 옥대표님 lock |
| **6** | **Brand accent 1색 lock** — 3 옵션 (SEA / SUN / NEON), default = SEA, 옥대표님 1글자 결정 대기 | 벤치마크 8/8 단일 accent. preview.html 인터랙티브 picker 로 옥대표님 즉시 view |
| **7** | **White-space breathing** — `--space-section: clamp(80px, 12vw, 160px)` major section padding | Vakaros / Whoop / 8thirty4 의 dense + breathing balance. data 답답함 회피 |
| **8** | **Sparkline 재사용 SVG 컴포넌트** — JS lib 의존 0 · `vector-effect: non-scaling-stroke` | Garmin / Strava metro 패턴. SVG path = data, 동적 generation 알렉스 영역 |
| **9** | **v1 brand triplet (navy/sea/sun) 와 hex 일치 유지** | 단무지공방 brand identity 연속성. v2 sea (#3B82F6) ↔ v1 sea (#1F8FFF) 만 hue 미세 변경 (다크 위 vibrant 보정) — 옥대표님 시각 검증 시 OK 면 fix |

---

## 1. 8 벤치마크 → 7 패턴 매핑

옥대표님 lock 의 7 패턴이 각각 8 벤치마크 의 어느 motif 차용했는지:

| 패턴 | Primary 벤치마크 | Secondary 차용 | 본 system 적용 |
|---|---|---|---|
| **1. Dark-first** | whoop.com (recovery 다크 cockpit) · catapultsports.com | trainingpeaks · 8thirty4 | `--bg-base #0A0E1A` (시스템 A `admin/dashboard/` 와 일치) · `color-scheme: dark` |
| **2. Mono numeral telemetry** | vakaros.com (atlas2 큰 mono) · garmin.com/connect | form.com · trainingpeaks | `--font-numeral: 'JetBrains Mono'` · `tabular-nums` · `ss01` |
| **3. 숫자 hero** | whoop.com (recovery score hero) | form swim · catapult player ID | C1 `.hero-metric` · `--text-hero-metric: clamp(72px, 12vw, 160px)` |
| **4. Glassmorphism 데이터 카드** | whoop.com daily summary · vakaros.com perf card | §203 단무지 시작 패턴 | C2 `.data-card` · `backdrop-filter: blur(24px)` · `rgba(255,255,255,0.04)` |
| **5. Sparkline strip** | garmin.com/connect (sparkline footer) · strava.com/metro | catapultsports | C3 `.sparkline` SVG · `--sparkline-*` 토큰 |
| **6. Comparison metric** | garmin (PR/Best/Avg) · trainingpeaks · whoop | form swim | C4 `.comparison` · 3-col current 강조 |
| **7. White-space breathing** | vakaros · 8thirty4 · form swim | strava metro | `--space-section: clamp(80px, 12vw, 160px)` |

**8 벤치마크 모두 cover** — 단 사이트별 character 균등:
- Whoop (다크 + recovery score 거대 numeral)
- Vakaros (telemetry monitor 톤 + 단일 accent)
- Form (메트릭 first, lifestyle 뒤로)
- Catapult (B2B 차트 showcase + 무겁지 않은 톤)
- Garmin (sparkline + comparison strip)
- TrainingPeaks (시계열 viz 표준)
- Strava metro (데이터 자체 = identity)
- 8thirty4 (분석 보고서 미적 표준)

**방향 = C Hybrid (Whoop 데이터 카드 + Vakaros 세일링 톤 + 단무지 brand accent)** — 옥대표님 lock 그대로.

---

## 2. 본인 default 가정 (Phase 1 옥대표님 명시 X, 본인 결정)

| 항목 | 본인 default | 사유 |
|---|---|---|
| Base bg | `#0A0E1A` | `admin/dashboard/` (시스템 A) 와 hex 일치 → 두 system 사이 visual transition 자연 |
| Surface bg | `#121829` · `#1A2238` | navy → 1step 밝은 elevation. shadow + opacity 가 아닌 색 자체로 depth |
| Mono font | **JetBrains Mono** primary · IBM Plex Mono fallback · SF Mono / Menlo system fallback | Vakaros / Linear 도 JetBrains. ss01 (0/O 구분) feature 활성 |
| Display font | **Inter** | Geist / Söhne 같은 modern sans 동급. Pretendard 한글과 cap height 일치 |
| Body font | **Pretendard Variable** | 한국어 first · Inter 와 visual 일치 · 5월 31 v1 spec 일관 |
| Hero metric size | `clamp(72px, 12vw, 160px)` | Whoop 160px / Vakaros 120px / 본인 mobile 72px → desktop 160px 의 fluid scale |
| Spacing scale | 4px sub-base · `--space-1` 부터 `--space-40` · `--space-section` clamp() | v1 의 `--space-*` 와 동일 base. v2 가 더 큰 `--space-section` 추가 |
| Radius | `--radius-lg: 16px` (card default) · `--radius-xl: 24px` (hero) | Whoop 12-16px · Vakaros 14px · 본인 16px (둘 사이) |
| Glass blur | `24px` | Whoop ~16px · Apple Liquid Glass 28-32px · 본인 중간 24px (성능 + 시각 균형) |
| Side P/S | `#E12B2B` 좌현 홍 · `#00A651` 우현 녹 | 국제 항해 표준 (DataViz §2 일관). v1 chart-theme.js 와 hex 일치 |
| Status 5단계 | very-good/good/mid/bad/very-bad · vibrant 다크 적합 hex | v1 chart-theme.js status 5 앵커와 isomorphic — DataViz 협업 일관. 다크 bg 위 saturation 미세 boost |

**가정 정확성 검증**: tokens.css + preview.html 의 시각 검증. 옥대표님 view 시 ❌ 발견 → 본인 1글자 답으로 즉시 정정.

---

## 3. 미해결 — 옥대표님 1글자 결정 필요

### 3-1. ★ **Brand accent 1개 lock** (최우선 결정)

옥대표님 view 시 `_design-system/preview.html` 의 상단 accent picker 3 swatch 가운데 1개 click → 라이브 미리보기. 30초 결정 가능.

| Option | Hex | Vibe | 본 system 적합도 |
|---|---|---|---|
| **(A) SEA `#3B82F6`** ★ 본인 권장 | 깊은 sea blue | Vakaros / Catapult · sport science B2B · 단무지 brand sea 와 isomorphic | hero · card · sparkline 모두 자연. status green/red 와 hue 분리 OK |
| **(B) SUN `#FFB800`** | warm gold | Whoop / dramatic · v1 단무지 brand sun 직접 | hero 강한 visual impact, 단 sparkline + 카드 border 에 너무 vibrant. status yellow (mid) 와 hue 충돌 risk |
| **(C) NEON `#00E676`** | sport green | Strava metro / Catapult / B2B sport · cyberpunk feel | 단무지 brand triplet 외 색 · status veryGood green 과 충돌 |

**Visual 권장: (A) SEA**
- 사유 1 — 단무지 v1 brand sea 와 hex 거의 일치 (다크 위 vibrant 보정만), brand identity 연속
- 사유 2 — status 5단계 (green/yellow/orange/red) 와 hue 완전 분리, conflict risk 0
- 사유 3 — Vakaros / Catapult 세일링 sport science 톤과 직접 일치 (8 벤치마크 중 가장 fit)

옥대표님 결정: **A / B / C 중 1글자**. 결정 후 본인 tokens.css 의 `--accent: var(--accent-sea/sun/neon)` 한 줄 수정 → 다른 모든 컴포넌트 자동 swap.

### 3-2. ★ Mono font primary 확정

| Option | Hex | Vibe | 본 system 적합도 |
|---|---|---|---|
| **(A) JetBrains Mono** ★ 본인 default | 가장 popular · ss01 활성 · variable wght | 본 default |
| **(B) IBM Plex Mono** | 더 humanist · slightly less vibrant | Linear / Stripe 옵션 |

본인 default = A (JetBrains). 옥대표님 visual feedback 시 B 도 가능 (preview.html 의 `.num` 클래스 font-family 만 swap, 1줄 수정).

### 3-3. light mode 진입 시점

다크 first lock 후 light variant 가 어느 시점에 필요한지? 본인 placeholder 만 작성 (`:root[data-theme="light"]`). 옥대표님 별도 lock 시 본인 full token 작성.

### 3-4. v1 와의 공존 — `style.css` 와의 priority

`tokens.css` 가 `style.css` 보다 후 import 면 v2 override. 본인 권장:
- **새 페이지 (dashboard, 보고서, landing redesign)** = v2 (`<html data-theme="dark">` + `tokens.css`)
- **기존 메인 사이트 (index, levitaz, ppc, takoon, wip, level/*, style/*)** = v1 유지 (light)
- 점진 migration — 알렉스 sprint 후 페이지별 결정

---

## 4. v1 와의 관계

### 4-1. 공존 정책

| Layer | v1 (current) | v2 (new) |
|---|---|---|
| Theme | light default | dark default |
| 토큰 prefix | `--color-navy` · `--fs-xs` 등 | `--bg-base` · `--fg-primary` · `--text-h1` 등 |
| Numeral | `.num` class (Inter + `tnum`) | `.num` class (JetBrains Mono + `tnum` + `ss01` + `-0.04em`) — v2 가 더 dramatic |
| Brand color | brand triplet (navy/sea/sun) — v1 spec §1-4 | single accent — v2 §3-1 |
| 적용 페이지 | index.html · level/* · style/* · 제품 페이지 · cart/quote/profile | dashboard · 보고서 · 새 landing · 새 페이지 |

### 4-2. 같은 `.num` class 충돌

v1 `.num` (Inter `tnum`) vs v2 `.num` (JetBrains Mono `tnum` + ss01 + letter-spacing). **충돌**.

해결: v2 `.num` 이 `tokens.css` 의 마지막에 정의되어 v1 override 가능. 단 v1 페이지 (light) 에 영향 — v2 tokens.css 가 v1 페이지에 안 import 되면 OK. **import scope 가 page 별 결정**.

권장: v2 페이지만 `tokens.css` import. v1 페이지는 무시. 점진 migration 시 본인 별도 spec 작성.

---

## 5. 다음 sprint 핸드오프

### 5-1. 알렉스 박 (#4 Frontend) · 점심 후 4h

- `<link rel="stylesheet" href="/_design-system/tokens.css">` site 전역 적용 (v2 페이지만)
- **`<html data-theme="dark">`** 또는 `<body data-theme="dark">` 신설 페이지에
- **landing index.html sub-section 1-2 개** v2 swap 시도 (예: 신규 "SailTech 라이딩 분석" hero section + 4 KPI card grid)
- **product 1-2 샘플** v2 적용 시도 (옵션)
- `components.md` 의 HTML/CSS skeleton 그대로 인용
- 시각 회귀 검증 (v1 페이지 영향 0 확인)

본인 (Rose) standby — 알렉스 implementation 시 시각 검증 + a11y QA round.

### 5-2. 샘 정 (#2 DataViz) · 저녁 2h

- `riding-dashboard/` 토큰 적용 — 기존 `chart-theme.js` 와 v2 token 매핑
- DataViz 표준 refresh — chart bg `--bg-surface` · grid `var(--sparkline-bg-grid)` · status 5 앵커 (이미 isomorphic, 토큰 alias 만)
- replay viewer (다크) 의 `--rp-*` 와 v2 토큰 통합 검토 — 본인 협업 가능

### 5-3. 메이 한 (#5 UX) + 옥대표님 라이브 검수 · 마지막 1h

- 모바일 (iPhone) · 데스크탑 · iOS Safari 시각 검증
- a11y heuristic (focus visible · 모바일 touch target · 한국어 widow · WCAG)
- 옥대표님 1 hour 라이브 (preview.html + 알렉스 swap 결과) view + 1글자 결정 (accent A/B/C + 진입 시점)

---

## 6. 정직 raise (어떤 결정 hard 했나)

본인 작업 중 most ambiguous 결정 3건:

1. **Accent 색 — SEA vs SUN** : 둘 다 valid argument 있음. SEA 가 brand 연속 + status hue conflict 0 → 본인 권장. 단 SUN 이 Whoop 식 dramatic 강함. **옥대표님 mental model 우선** — 직접 picker 로 결정.

2. **Body font — Pretendard vs Inter** : 한국어 content 가 70%+ 추정 → Pretendard Variable 가 정공. 단 v2 의 sports science 톤은 영문 위주 (Inter / Geist) 가 더 fit. 본인 default = Pretendard (한국어 우선), 영문 hero (`.font-display`) 만 Inter. **옥대표님 시각 검증 시 변경 가능**.

3. **Body line-height — 1.5 vs 1.65** : 한국어 본문 = 1.55-1.65 정통. 영문 본문 = 1.4-1.5. v2 가 영문 위주 dashboard 라 1.55 절충. **옥대표님 view 시 visual feedback** 으로 조정.

---

## 7. 부록 — file 위치

```
site/_design-system/
├── tokens.css                  ← Single source CSS variables
├── components.md               ← 5 컴포넌트 HTML+CSS spec
├── preview.html                ← 라이브 demo (옥대표님 30초 view)
└── design-system-v2-spec.md    ← 본 문서 (결정 + 근거 + 가정 + 미해결)
```

**Push 권장**: `_design-system/*` 4 file daemon whitelist 추가 (`AUTO_PUSH_ALLOW_PATHS`) — 본인 영역. 본 sprint 산출 즉시 push 후 알렉스 sprint 진입.

---

_Last updated: 2026-06-06 (오전 sprint 완료)_
_Phase 1 본인 owner — Design System v2 spec + tokens + 컴포넌트 + preview. 옥대표님 1글자 결정 (accent SEA/SUN/NEON) 후 알렉스 sprint 진입._
