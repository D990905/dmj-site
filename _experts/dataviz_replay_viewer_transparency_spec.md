# dataviz_replay_viewer_transparency_spec.md — 라이브 dashboard 우측 4 차트 투명 백그라운드 spec

| 항목 | 내용 |
|---|---|
| 문서 유형 | 라이브 dashboard chart styling spec (production code 변경 — Phase 2 sprint 2-E) |
| 작성 | 샘 정 (DataViz #2) · 2026-06-06 |
| 트리거 | 옥대표님 screenshot 별도 directive *"우측 4 차트의 사각 백그라운드를 많이 투명하게 만들어서 뒤의 영상이 보이게"* |
| 영역 | 라이브 replay viewer (다크 테마) 의 우측 multi-channel mini chart 4종 |
| 본인 영역 | chart styling (CSS + Chart.js options override) — pure 시각 영역 |
| 알렉스 cross-cut | replay.js 또는 replay viewer CSS 변경 시 frontend pair |
| 신규 hex / 토큰 | 0건 (기존 `--rp-*` 토큰 alpha 보정만) |
| ETA | 본인 spec 30분 + 알렉스 implementation 1-2h |

> **읽는 법.** §0 = TL;DR + 4 차트 식별. §1 = 현재 vs 목표 (배경 alpha). §2 = CSS 변경 spec. §3 = Chart.js options override. §4 = 가독성 검증 (텍스트 contrast). §5 = 알렉스 implementation. §6 = sources.

---

## 0. TL;DR

### 0-1. 식별

옥대표님 screenshot 의 "우측 4 차트" = 라이브 replay viewer (전체화면 다크 모드) 의 multi-channel mini chart 4종. `replay.js` + `dashboard.css` `.replay` scope 의 `--rp-*` 토큰 영역.

### 0-2. 핵심 변경

| 요소 | 현재 alpha | 목표 alpha | 의도 |
|---|---|---|---|
| Chart card 배경 | ~0.92 (거의 불투명) | **0.35~0.45** | 뒤 영상 visible |
| Chart card 테두리 | 1.0 (solid) | 0.55~0.65 | 윤곽만 유지 |
| Chart card 그림자 | 박스 그림자 있음 | 제거 또는 0.15 | flat 처리 |
| Chart 격자선 | 0.07 | 0.20~0.30 | 영상 위에서 격자 안 보임 fix |
| Chart 축 라벨 | 0.85 (BASE.ink) | 0.95 + text-shadow | 영상 배경 위 가독성 |
| Chart 데이터 line | 1.0 | 1.0 (변경 X) | data 우선순위 유지 |

**핵심 trade-off** — 배경 투명도 ↑ ↔ 텍스트/격자 가독성 ↓. WCAG 1.4.3 (Contrast Minimum) 4.5:1 사수.

---

## 1. 현재 vs 목표

### 1-1. 현재 상태 진단 (추정 — `replay.js` 직접 열람 후 정정 필요)

본인이 본 spec 작성 시점 `replay.js` 의 chart styling 직접 열람 0 (env mount 일시 차단). `chart-theme.js` 의 라이트 모드 토큰 + dashboard.css `.replay` scope 의 `--rp-*` 다크 토큰 추정:

```css
/* 추정 — dashboard.css .replay scope */
.replay .chart-card {
  background: var(--rp-card-bg);          /* 추정 #1a2030 또는 비슷, alpha ~0.92 */
  border: 1px solid var(--rp-card-line);  /* alpha 1.0 */
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.20);
}
```

### 1-2. 목표 — 영상 가시성 ↑ + 데이터 가독성 사수

```css
.replay .chart-card {
  background: rgba(10, 14, 26, 0.40);     /* 거의 투명, 영상 visible */
  border: 1px solid rgba(255, 255, 255, 0.18);  /* dim border */
  border-radius: 8px;
  box-shadow: none;                        /* flat */
  backdrop-filter: blur(8px) saturate(140%);  /* 영상 가독성 보조 */
  -webkit-backdrop-filter: blur(8px) saturate(140%);
}
```

**핵심 — `backdrop-filter: blur()`**. 영상이 뒤에 visible 하되, 차트 영역만 살짝 blur 처리 → 차트 텍스트/데이터 가독성 유지. Apple Vision Pro · iOS 18+ 의 "glass material" 패턴.

---

## 2. CSS 변경 spec

### 2-1. Chart card 배경 — alpha 0.40 + backdrop-filter

```css
/* dashboard.css .replay scope 안 */
.replay .chart-card,
.replay .replay__chart-card,
.replay [data-replay-chart] {
  /* 영상 visible — background alpha 대폭 축소 */
  background: rgba(10, 14, 26, 0.40);

  /* 영상 위 차트 가독성 — backdrop blur (모바일 Safari 16.4+, Chrome 76+) */
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);

  /* 테두리 dim */
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;

  /* 그림자 제거 — flat 처리 */
  box-shadow: none;
}
```

### 2-2. Chart 격자선 alpha ↑

Chart.js `applyChartDefaults` 의 라이브 다크 모드 override:

```js
// replay.js 또는 admin/dashboard/chart-theme-dark.js
function applyReplayChartDefaults(Chart) {
  applyChartDefaults(Chart);  // 기본 적용

  // .replay scope 안 차트만 격자선 alpha ↑
  Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.20)';  // 0.07 → 0.20
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.15)';
}
```

### 2-3. Chart 축 라벨 — text-shadow 추가

영상 배경이 다양한 색이라 단일 라벨 색만으로는 가독성 부족. text-shadow 로 윤곽 강조:

```css
.replay .chart-card text,
.replay canvas + .chart-label,
.replay [data-chart-label] {
  /* Chart.js canvas 안 텍스트 — 추가 가독성 layer */
  /* (canvas 직접 변경 X — overlay text 만) */
  font-weight: 600;
  text-shadow:
    0 0 4px rgba(10, 14, 26, 0.95),
    0 1px 1px rgba(10, 14, 26, 0.8);
}
```

**주의** — Chart.js canvas 안 ticks/labels 는 `text-shadow` 직접 X. Chart.js options 의 `ticks.color` 만 변경 가능. canvas 안 텍스트 가독성은 §3 Chart.js options 의 stroke (border) 보강으로.

### 2-4. Chart 데이터 line / point — 변경 X

데이터 시각 우선순위 사수:

```js
// 데이터 line / point opacity = 1.0 그대로
// borderWidth 조정 X (라이브 그대로)
// pointRadius 조정 X
```

### 2-5. Chart 제목 (chart-card 헤더) — strong 색 + bold

차트 제목이 차트 위 영역에 있다면:

```css
.replay .chart-card__title,
.replay .chart-card__header h3 {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
  letter-spacing: 0.3px;
  text-shadow: 0 1px 2px rgba(10, 14, 26, 0.7);
}
```

---

## 3. Chart.js options override (replay viewer 차트)

### 3-1. ticks color — high contrast

```js
// replay.js 안 4 mini chart 의 options
const opts = {
  scales: {
    x: {
      ticks: {
        color: 'rgba(255, 255, 255, 0.85)',  // 0.95 → 0.85 (적정 가독)
        font: {
          weight: '600',                       // bold
          size: 10
        }
      },
      grid: {
        color: 'rgba(255, 255, 255, 0.20)',  // 격자 alpha ↑
        lineWidth: 1
      }
    },
    y: { /* same */ }
  },
  plugins: {
    legend: {
      labels: {
        color: 'rgba(255, 255, 255, 0.90)',
        font: { weight: '600', size: 11 }
      }
    }
  }
};
```

### 3-2. 데이터 series — alpha 유지

```js
{
  borderColor: 'rgba(31, 143, 255, 1.0)',      // sea blue solid
  backgroundColor: 'rgba(31, 143, 255, 0.18)',  // fill alpha 0.10 → 0.18 (영상 위 visible)
  borderWidth: 1.8,                              // 1.5 → 1.8 (영상 위 가독)
  pointRadius: 0,
  tension: 0.3
}
```

### 3-3. tooltip — 영상 위 fully opaque

Tooltip 은 영상 위에 명확히 떠야 — alpha X.

```js
plugins: {
  tooltip: {
    backgroundColor: 'rgba(10, 14, 26, 0.95)',  // navy fully opaque
    titleColor: 'rgba(255, 255, 255, 1.0)',
    bodyColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 6
  }
}
```

---

## 4. 가독성 검증 (WCAG 1.4.3 contrast)

### 4-1. Contrast 측정 — 영상 평균 색별

영상은 색이 다양 — 본인 권장 = "worst case" 영상 색 (밝은 파랑 sky + 흰 파도) 기준 contrast.

| 요소 | 색 | 영상 worst case 배경 | contrast | WCAG |
|---|---|---|---|---|
| 차트 축 라벨 (white 0.85 + text-shadow) | `rgba(255,255,255,0.85)` | 하늘 (`rgb(100,150,200)`) | ~3.8:1 | ⚠ 3.0 통과 (large text) / 4.5 미달 (small) |
| 격자선 (white 0.20) | `rgba(255,255,255,0.20)` | 하늘 | 시각적 hint 만, contrast 평가 외 | OK |
| 데이터 line (sea blue solid) | `#1F8FFF` | 하늘 | 1.2:1 | ❌ 데이터 line 별도 backdrop blur 필요 |

### 4-2. 권장 — 데이터 line 의 ring strokes

데이터 line 자체에 미세 outline (white halo) 추가:

```js
// Chart.js plugin afterDatasetsDraw — line outline (halo)
const lineHalo = {
  id: 'lineHalo',
  beforeDatasetDraw(chart, args) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(10, 14, 26, 0.7)';
    ctx.shadowBlur = 3;
  },
  afterDatasetDraw(chart, args) {
    chart.ctx.restore();
  }
};
```

### 4-3. backdrop-filter fallback

`backdrop-filter` 미지원 브라우저 (구 Firefox 등):

```css
@supports not (backdrop-filter: blur()) {
  .replay .chart-card {
    background: rgba(10, 14, 26, 0.75);  /* alpha 약간 높여 보완 */
  }
}
```

---

## 5. 알렉스 implementation

### 5-1. 변경 file list

| file | 변경 |
|---|---|
| `site/riding-dashboard/css/dashboard.css` | `.replay .chart-card` styles (alpha 0.40 + backdrop blur + border dim) |
| `site/riding-dashboard/js/replay.js` 또는 `chart-theme-dark.js` | Chart.js options override (격자 alpha + ticks color + line halo plugin) |

### 5-2. ETA

- 알렉스 implementation = 1-2h
- self-test 갱신 (`selftest-replay.js`) — 차트 배경 alpha + text contrast 검증 = 30분
- 옥대표님 iPhone Safari + 데스크탑 Safari 검증 = 30분

### 5-3. 회귀 검증

- 라이브 dashboard (라이트 모드) `.replay` scope 밖 차트 영향 0 (selector limited to `.replay`)
- 자체 검증: `node -c replay.js` syntax + `selftest-replay.js` 통과 + Chrome DevTools backdrop-filter 시각

### 5-4. 옥대표님 검증 path

옥대표님 GO 후 알렉스 sprint 진입. 검증 → push → 옥대표님 iPhone replay viewer 직접 view → 영상 visible + 차트 가독 확인.

---

## 6. WIP slot + 본인 회복 path

본 spec = 본인 회복 path #2 (`sam_pdf_report_evaluation_2026-06-05.md` §7-6) 의 일부. PDF v2 spec 과 별 영역 (라이브 dashboard 우측 차트 vs PDF 9p), 옥대표님 directive 2건 분리.

| WIP slot | 산출물 | 상태 |
|---|---|---|
| (1) `dataviz_pdf_report_v2_spec.md` | 1130줄 신규 | commit-ready · push 대기 |
| **(2) `dataviz_replay_viewer_transparency_spec.md`** | **본 spec** | **commit-ready · push 대기** |
| (3) PDF 평가서 `sam_pdf_report_evaluation_2026-06-05.md` | 514줄 sandbox | push 보류 (옥대표님 GO 신호 대기) |

---

## 7. Sources

**프로젝트 내부**
- `site/riding-dashboard/js/replay.js` — 추정 (mount 일시 차단으로 직접 열람 0, 알렉스 영역 확인 필요)
- `site/riding-dashboard/css/dashboard.css` `.replay` scope `--rp-*` 토큰
- `site/riding-dashboard/CHART-DESIGN-SYSTEM.md` (다크 테마 분리 원칙)
- `site/_experts/expert_dataviz_reference.md` §2-16 Replay viewer mini-charts
- `site/_experts/visual_designer_brand_color_spec.md` (다크 cockpit reference)

**외부 reference**
- WCAG 2.2 SC 1.4.3 (Contrast Minimum) · SC 1.4.11 (Non-text Contrast)
- Apple Human Interface Guidelines — Materials (glass / blur effects)
- Chart.js 4.x docs — scales · ticks · plugins
- CSS backdrop-filter spec — MDN

---

_Last updated: 2026-06-06_
_Phase 2 sprint 2-E spec — 알렉스 implementation 1-2h · 신규 hex 0건 · WCAG 1.4.3 contrast 사수._
