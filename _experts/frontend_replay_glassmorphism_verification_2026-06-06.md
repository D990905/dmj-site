# frontend_replay_glassmorphism_verification_2026-06-06.md — §203 + §204 통합 검증 (Alex #4)

| 항목 | 내용 |
|---|---|
| 문서 유형 | 통합 검증 stamp (production code 변경 0 — verification only) |
| 작성 | 알렉스 박 (Frontend #4) · 2026-06-06 |
| 트리거 | §310 sprint dispatch (CoS David Ok) — riding-dashboard v2 staging 검증 |
| 영역 | `riding-dashboard-v2/` 의 replay viewer (.replay scope) — `replay-graphs` aside 4 mini-graph |
| 본인 영역 | 통합 검증 + 회귀 가드 + 정직 raise |
| Sam 영역 | §204-A~§204-G CSS + §204-B canvas halo + §301 dark tile (이미 완료) |
| 변경 line | 0 (verification only — Sam 구현 그대로 검증) |

---

## 0. TL;DR

옥대표님 verbatim (6/5): *"우측 4 차트 카드 뷰, 데이터는 흰색"* — §310 dispatch 도착 시점에 **샘 정 (#2) 이 v2 staging 안에 §204-A~§204-G 모두 코드 완료** (`riding-dashboard-v2/css/dashboard.css` line 2625-2763, 9 markers). 본 verification = 그 작업이 demo (`_demo/apple-watch-cards.html`) spec 과 정합하는지, 회귀 0 인지 검증.

**결과 — 통합 완료, 회귀 0.** 추가 markup 변경 0. 본 doc = trace stamp + DO_NOT_REVERT 가드.

---

## 1. 통합 mapping — demo → live replay

| 요소 | demo (`_demo/apple-watch-cards.html`) | live replay (v2/replay.js + dashboard.css) | 일치 |
|---|---|---|---|
| 4 카드 wrapper | `<aside class="gd-cards">` | `<aside class="replay__graphs" id="replay-graphs">` (replay.js line 721) | ✓ semantic 동등 |
| 카드 element | `<article class="gd-card gd-card--{sog,vmg,twa,hr}">` | `<div class="replay-graph">` (buildGraphs(), replay.js line 911-913) | ✓ class 별 색 인코딩 X (uniform white) — §203-B 정합 |
| Glass material | `backdrop-filter: blur(12px) saturate(160%)`, alpha 0.48 | `backdrop-filter: blur(8px) saturate(140%)`, alpha 0.40 (§204-A) | ✓ tradeoff (영상 visible ↑, GPU drain ↓) |
| Border | 1px solid rgba(255,255,255,0.08) | 1px solid rgba(255,255,255,0.18) (§204-A) | ✓ box-shadow 제거 후 윤곽 강조 의도 |
| Data line | `borderColor: rgba(255,255,255,0.95)` (Chart.js) | `MINI_LINE = '#FFFFFF'` (replay.js line 516, canvas 직접 draw) | ✓ §203-B uniform white |
| Data halo | drop-shadow 제거 (§203-B) | canvas `shadowBlur: 4` + dark color (§204-B line 1079) | ✓ 영상 위 가독성 추가 — demo 보다 진보 |
| Cursor | red `#FF3B30` (iOS system red) | orange `#FF5A1F` (CURSOR const, line 517) | ⚠ 색 differ — 의도된 (전체 dashboard UI 톤 일관) |
| 격자선 | demo 미적용 | rgba(255,255,255,0.22) (§204-B canvas line 1043) | ✓ live 만 적용 — 30초 창 시간 인지 필요 |

**색 차이 (cursor)**: 의도된 — replay viewer 의 다른 UI 요소 (replay-scrub track, replay-play btn) 와 톤 일관. 옥대표님 verbatim 에 "cursor 색" 정정 directive 0 — `세로선만 유지` 범위 안.

---

## 2. 회귀 가드 (DO_NOT_REVERT — frontend 영역)

### 2-1. Scope lock — 원본 dashboard 무수정

```
$ git diff --stat HEAD -- riding-dashboard/
(empty — 0 changes)

$ grep -c §204 riding-dashboard/css/dashboard.css
0
$ grep -c §204 riding-dashboard-v2/css/dashboard.css
9
```

✓ 원본 `riding-dashboard/` 은 byte-for-byte 그대로. 옥대표님 verbatim *"기존 대시보드는 그냥 그대로 두고"* 충족.

### 2-2. CSS specificity cascade

```css
.replay-graph { background: var(--rp-panel); ... }            /* line 2103 — base */
.replay .replay-graph { background: rgba(14,20,31,0.40); ... }/* line 2641 — §204-A override */
```

✓ specificity 0,0,2,0 vs 0,0,1,0 → `.replay .replay-graph` 우선. `.replay` 스코프 (overlay body class) 외부 0 영향. main dashboard `.dash` view 0 영향.

### 2-3. Syntax + balance

- `node -c js/replay.js` ✓ OK
- `node -c js/chart-theme.js` ✓ OK
- `dashboard.css` braces 863 / 863 balance ✓ OK

### 2-4. backdrop-filter fallback

`@supports not (backdrop-filter: blur(0))` (line 2654 + 2709) → 구 Firefox / Chromium 미지원 시 alpha 0.40 → 0.72 폴백. ✓ 회귀 안전.

### 2-5. prefers-reduced-motion 안전망

§204-G (line 2754-2762) — reduce motion 시 backdrop-filter 제거 + opaque background. ✓ a11y 정합.

---

## 3. 옥대표님 verbatim 충족도

| Verbatim | 충족 위치 |
|---|---|
| "우측의 독립된 차트 4개" | `replay-graphs` aside (4 metric slots — SOG · VMG · TWA · HR — replay.js metricSlots) |
| "투명한 다크 모드 카드 뷰" | `.replay .replay-graph` alpha 0.40 + glass material |
| "애플 워치 피트니스 앱 스타일" | backdrop-filter + 흰 line + min-height 74px (Apple HIG compact) |
| (정정) "데이터는 네온컬러 말고 그냥 흰색" | MINI_LINE = '#FFFFFF' (line 516) |
| "세로선은 기준점이니 손댈 필요 없고" | CURSOR (line 517) 유지 |
| "기존 대시보드는 그냥 그대로 두고" | 원본 `riding-dashboard/` git diff stat 0 |

---

## 4. 잔여 gap / 향후 sprint

- **CartoDB DarkMatter tile attribution** (§301): 첫 회 라이브 시 attribution 표시 확인 필요. 무료 사용 조건 충족. v2 staging 라이브 후 옥대표님 검수.
- **PDF v2 layout + page-break** (§302/§303 — Sam 영역): 본 검증 범위 X.
- **Apple Watch demo file 보존**: `_demo/apple-watch-cards.html` 는 spec lock + 시각 참고 자료. 라이브 무영향 standalone. **삭제 X** (다음 designer iteration 시 reference).

---

## 5. Sources

- §310 dispatch — David Ok (CoS) verbatim broadcast 2026-06-06
- §203 옥대표님 verbatim 6/5 — Apple Watch UI dispatch
- §203-B 옥대표님 정정 6/5 — 흰색 통일
- `_demo/apple-watch-cards.html` — Alex (#4) standalone demo
- `_experts/dataviz_replay_viewer_transparency_spec.md` — Sam (#2) §204 spec
- `riding-dashboard-v2/css/dashboard.css` line 2625-2763 — Sam §204-A~G impl
- `riding-dashboard-v2/js/replay.js` line 516 / 1034 / 1079 / 1491 — Sam §204-B + §301 impl

— Alex Park (#4 Frontend) · 2026-06-06 · 통합 검증 완료 + 회귀 0
