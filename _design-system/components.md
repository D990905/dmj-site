# Design System v2 — Components

| 항목 | 내용 |
|---|---|
| 문서 유형 | 5 표준 컴포넌트 HTML + CSS skeleton (알렉스가 swap 시 직접 인용) |
| Owner | Visual Designer (Rose Yoon) · 2026-06-06 |
| 의존 | `_design-system/tokens.css` single source |
| 벤치마크 | C1 Whoop hero · C2 §203 + Whoop card · C3 Garmin/Strava sparkline · C4 Garmin PR/Best/Avg · C5 Garmin telemetry strip |

> **읽는 법.** 각 컴포넌트마다 (1) 의도 / (2) HTML 구조 / (3) CSS spec / (4) Variants / (5) a11y. token (`var(--accent)` 등) 모두 `tokens.css` reference. 알렉스 Phase 2 swap 시 그대로 인용 가능.

---

## C1 — Hero Metric (Whoop hero 패턴)

### 의도

페이지 hero 가 라이프스타일 사진 X · **거대 mono 숫자 1 개** + 작은 unit + label. Whoop recovery score · Catapult player ID · Garmin VO2 max 식. 단무지 라이딩 분석 보고서 cover 의 VPS 91 점 · 라이딩 대시보드 hero · 페이지별 핵심 metric.

### HTML

```html
<section class="hero-metric" aria-label="VPS · Velocity Performance Score">
  <p class="hero-metric__eyebrow eyebrow">VPS · 종합</p>
  <p class="hero-metric__value num">
    91<span class="hero-metric__unit">/ 100</span>
  </p>
  <p class="hero-metric__label">오늘의 종합 라이딩 점수</p>

  <!-- Optional — 비교 metric (C4 inline) -->
  <div class="hero-metric__comparison">
    <span class="hero-metric__comparison-item">
      <span class="eyebrow">PR</span>
      <span class="num">94</span>
    </span>
    <span class="hero-metric__comparison-item">
      <span class="eyebrow">7d Avg</span>
      <span class="num">82</span>
    </span>
  </div>
</section>
```

### CSS

```css
.hero-metric {
  text-align: center;
  padding-block: var(--space-section);
  padding-inline: var(--gutter);
  max-width: var(--container-narrow);
  margin-inline: auto;
}
.hero-metric__eyebrow {
  margin: 0 0 var(--space-6);
  color: var(--accent);  /* eyebrow = accent emphasis */
}
.hero-metric__value {
  font-family: var(--font-numeral);
  font-size: var(--text-hero-metric);
  font-weight: var(--fw-semibold);
  line-height: 0.95;
  color: var(--fg-primary);
  letter-spacing: var(--num-letterspacing);
  font-variant-numeric: tabular-nums;
  margin: 0;
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-4);
}
.hero-metric__unit {
  font-size: var(--text-hero-unit);
  font-weight: var(--fw-medium);
  color: var(--fg-muted);
  letter-spacing: 0;
}
.hero-metric__label {
  font-size: var(--text-hero-label);
  color: var(--fg-secondary);
  margin: var(--space-6) auto 0;
  max-width: 32ch;
  line-height: 1.5;
}
.hero-metric__comparison {
  margin-top: var(--space-10);
  display: inline-flex;
  gap: var(--space-12);
}
.hero-metric__comparison-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.hero-metric__comparison-item .num {
  font-size: var(--text-h3);
  color: var(--fg-secondary);
}
```

### Variants

| Variant | 트리거 | 효과 |
|---|---|---|
| `.hero-metric--accent` | `<section class="hero-metric hero-metric--accent">` | value 자체 색 = accent (vibrant 강조, 단 보수 적용 — 큰 숫자 대비 부담) |
| `.hero-metric--compact` | `<section class="hero-metric hero-metric--compact">` | padding-block clamp 1/2, value clamp 1/2 — section 안의 sub-hero |

### a11y

- `aria-label` 명확 (스크린리더 = "VPS · Velocity Performance Score")
- `<p>` semantic + heading hierarchy 는 상위 컨텍스트에 의존
- `tabular-nums` + `letter-spacing -0.04em` — 큰 숫자 column 정렬 보장
- `prefers-reduced-motion` — 본 컴포넌트 animation 0 (정적, 자동 통과)

---

## C2 — Glassmorphism Data Card

### 의도

KPI · metric 표시의 핵심. Whoop daily summary 카드 / Vakaros performance card 식. `backdrop-filter blur` + `rgba border` + value + sparkline footer + delta indicator. 라이딩 대시보드 stats · 보고서 카드 · 산업 사이트 KPI 모두 같은 패턴.

### HTML

```html
<article class="data-card">
  <header class="data-card__head">
    <h3 class="data-card__title">최고 속도</h3>
    <span class="data-card__delta data-card__delta--up">▲ 8.4%</span>
  </header>

  <p class="data-card__value num">
    26.9<span class="data-card__unit">kt</span>
  </p>

  <!-- C3 Sparkline strip inline -->
  <div class="data-card__sparkline">
    <svg class="sparkline" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline class="sparkline__line"
        points="0,18 10,15 20,16 30,11 40,9 50,6 60,8 70,4 80,5 90,2 100,3" />
      <circle class="sparkline__dot sparkline__dot--last" cx="100" cy="3" r="2.5" />
    </svg>
  </div>

  <footer class="data-card__footer">
    <span class="data-card__meta">7일 평균 24.8 kt</span>
    <span class="data-card__meta data-card__meta--accent">PR 28.4 kt</span>
  </footer>
</article>
```

### CSS

```css
.data-card {
  position: relative;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-card);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  transition: background var(--dur-base) var(--ease),
              border-color var(--dur-base) var(--ease),
              transform var(--dur-fast) var(--ease);
  overflow: hidden;
}
.data-card:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  transform: translateY(-1px);
}

.data-card__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-4);
}
.data-card__title {
  margin: 0;
  font-family: var(--font-label);
  font-size: var(--text-eyebrow);
  font-weight: var(--fw-medium);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--fg-muted);
}
.data-card__delta {
  font-family: var(--font-numeral);
  font-size: var(--text-caption);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
}
.data-card__delta--up   { color: var(--status-very-good); }
.data-card__delta--down { color: var(--status-very-bad); }
.data-card__delta--flat { color: var(--fg-muted); }

.data-card__value {
  font-family: var(--font-numeral);
  font-size: var(--text-h1);
  font-weight: var(--fw-semibold);
  color: var(--fg-primary);
  letter-spacing: var(--num-letterspacing);
  line-height: 1;
  margin: 0 0 var(--space-4);
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}
.data-card__unit {
  font-size: var(--text-h3);
  font-weight: var(--fw-medium);
  color: var(--fg-secondary);
  letter-spacing: 0;
}

.data-card__sparkline {
  width: 100%;
  height: 32px;
  margin-bottom: var(--space-4);
}

.data-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
  font-family: var(--font-label);
  font-size: var(--text-meta);
  color: var(--fg-muted);
}
.data-card__meta--accent { color: var(--accent); }
```

### Variants

| Variant | 효과 |
|---|---|
| `.data-card--hero` | radius `--radius-xl`, padding `--space-10`, value clamp(48px, 5vw, 64px). landing hero KPI 강조 |
| `.data-card--compact` | padding `--space-card-sm`, value `--text-h2`. dashboard sub-stat |
| `.data-card--accent` | border `var(--accent)` + glow `--glow-accent-sm`. 강조 카드 (current PR / 결정 대기 등) |
| `.data-card--status-{good,bad,mid}` | left border 3px solid status 색. 상태 신호 |

### a11y

- `<article>` semantic (독립 informational unit)
- 자체 `<h3>` heading — page hierarchy 안에서 적정
- delta indicator `aria-label` (예: `aria-label="이전 대비 8.4% 상승"`) — 시각 ▲ + screen reader text 동반
- focus-visible — outline accent ring (tokens.css `:focus-visible` global)

---

## C3 — Sparkline Strip (재사용 컴포넌트)

### 의도

작은 시계열 SVG, hero 의 trend visual cue. 카드 footer · table 셀 inline · KPI 직하 모두 같은 spec. Garmin Connect / Strava metro 패턴. SVG 단순, JS 라이브러리 의존 X.

### HTML

```html
<!-- Standalone -->
<svg class="sparkline" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
  <!-- Optional grid -->
  <line class="sparkline__grid" x1="0" y1="12" x2="100" y2="12" />

  <!-- Optional area fill (under line) -->
  <polygon class="sparkline__area"
    points="0,18 10,15 20,16 30,11 40,9 50,6 60,8 70,4 80,5 90,2 100,3 100,24 0,24" />

  <!-- Line -->
  <polyline class="sparkline__line"
    points="0,18 10,15 20,16 30,11 40,9 50,6 60,8 70,4 80,5 90,2 100,3" />

  <!-- Last point dot -->
  <circle class="sparkline__dot sparkline__dot--last" cx="100" cy="3" r="2.5" />
</svg>
```

### CSS

```css
.sparkline {
  width: 100%;
  height: 32px;
  display: block;
  overflow: visible;
}
.sparkline__line {
  fill: none;
  stroke: var(--sparkline-stroke);
  stroke-width: var(--sparkline-stroke-width);
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;  /* preserve stroke under viewBox scale */
}
.sparkline__area {
  fill: var(--sparkline-area-fill);
  stroke: none;
}
.sparkline__grid {
  stroke: var(--sparkline-bg-grid);
  stroke-width: 0.5;
  vector-effect: non-scaling-stroke;
}
.sparkline__dot {
  fill: var(--sparkline-dot);
  stroke: var(--bg-surface);  /* halo against card bg */
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}
.sparkline__dot--last { fill: var(--accent); }
```

### Variants

| Variant | 효과 |
|---|---|
| `.sparkline--lg` | height 56px (hero 직하 또는 dashboard widget) |
| `.sparkline--mini` | height 16px (inline table 셀 · "[속도 ↗]" 표기) |
| `.sparkline--area` | area fill 활성 (강조 시) |
| `.sparkline--status-good/bad` | stroke 색이 status 토큰으로 swap |

### a11y

- `aria-hidden="true"` — 장식 (실 data 는 옆의 num value 가 전달). 만약 main content 면 `<title>` `<desc>` 추가
- `vector-effect: non-scaling-stroke` — viewBox 비례 스케일 시 stroke 두께 보장 (시각 일관)
- `prefers-reduced-motion` — 본 정적, 자동 통과

---

## C4 — Comparison Metric (PR / Best / Avg)

### 의도

같은 metric 의 3 시점 (또는 3 기준점) 비교. PR (Personal Record) · Best · Avg. Garmin / TrainingPeaks / Whoop 의 progression viewer. 가로 배치 + 현재값 강조.

### HTML

```html
<dl class="comparison" aria-label="속도 비교 — PR · 현재 · 평균">
  <div class="comparison__item">
    <dt class="comparison__label eyebrow">PR</dt>
    <dd class="comparison__value num">28.4<span class="comparison__unit">kt</span></dd>
  </div>
  <div class="comparison__item comparison__item--current">
    <dt class="comparison__label eyebrow">오늘</dt>
    <dd class="comparison__value num">26.9<span class="comparison__unit">kt</span></dd>
    <dd class="comparison__delta data-card__delta--up">▲ 8.4%</dd>
  </div>
  <div class="comparison__item">
    <dt class="comparison__label eyebrow">7d Avg</dt>
    <dd class="comparison__value num">24.8<span class="comparison__unit">kt</span></dd>
  </div>
</dl>
```

### CSS

```css
.comparison {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;  /* current 약간 wider */
  gap: var(--space-card-gap);
  padding: var(--space-card);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}
.comparison__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;
  text-align: center;
  padding: var(--space-2) 0;
}
.comparison__item + .comparison__item {
  border-left: 1px solid var(--border-subtle);
}
.comparison__label {
  margin: 0;
  color: var(--fg-muted);
}
.comparison__value {
  margin: 0;
  font-family: var(--font-numeral);
  font-size: var(--text-h2);
  font-weight: var(--fw-semibold);
  color: var(--fg-secondary);  /* 일반은 secondary */
  letter-spacing: var(--num-letterspacing);
  line-height: 1;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-1);
}
.comparison__unit {
  font-size: var(--text-body-sm);
  color: var(--fg-muted);
  letter-spacing: 0;
}
.comparison__item--current .comparison__value {
  font-size: clamp(28px, 4vw, 44px);
  color: var(--fg-primary);  /* current 강조 */
}
.comparison__item--current::before {
  content: "";
  position: absolute;
  inset: -1px var(--space-4) -1px;
  border-radius: var(--radius-md);
  background: var(--accent-subtle);
  z-index: -1;
}
.comparison__delta {
  margin: 0;
  font-family: var(--font-numeral);
  font-size: var(--text-caption);
}
.comparison__delta.data-card__delta--up   { color: var(--status-very-good); }
.comparison__delta.data-card__delta--down { color: var(--status-very-bad); }

@media (max-width: 640px) {
  .comparison {
    grid-template-columns: 1fr;
  }
  .comparison__item + .comparison__item {
    border-left: 0;
    border-top: 1px solid var(--border-subtle);
    padding-top: var(--space-4);
  }
}
```

### Variants

| Variant | 효과 |
|---|---|
| `.comparison--inline` | hero 안 가로 stack (HeroMetric C1 의 hero-metric__comparison 와 같은 패턴) — 단순 inline-flex |
| `.comparison--{2,3,4}-col` | 2/3/4 stat 가로 |
| `.comparison--accent` | current item bg = accent gradient |

### a11y

- `<dl>` description list semantic — 정통
- `aria-label` 동반 (스크린리더 가 컴포넌트 의도 인지)
- mobile 640px 미만 1-col reflow

---

## C5 — Telemetry Strip (카드 하단 미니 metric bar)

### 의도

카드 footer · page 하단 sticky strip · session card 의 sub-metric bar. SOG / HR / TWA / Heel / Pitch 같은 5+ metric 한 줄. Garmin Connect activity card 의 stat row 패턴. 단무지 라이딩 대시보드 의 stat strip 도 같은 컴포넌트.

### HTML

```html
<div class="telemetry-strip" role="list">
  <div class="telemetry-strip__item" role="listitem">
    <span class="telemetry-strip__label eyebrow">SOG</span>
    <span class="telemetry-strip__value num">17.0</span>
    <span class="telemetry-strip__unit">kt</span>
  </div>
  <div class="telemetry-strip__item" role="listitem">
    <span class="telemetry-strip__label eyebrow">HR</span>
    <span class="telemetry-strip__value num">149</span>
    <span class="telemetry-strip__unit">bpm</span>
  </div>
  <div class="telemetry-strip__item" role="listitem">
    <span class="telemetry-strip__label eyebrow">TWA</span>
    <span class="telemetry-strip__value num">38°</span>
  </div>
  <div class="telemetry-strip__item" role="listitem">
    <span class="telemetry-strip__label eyebrow">HEEL</span>
    <span class="telemetry-strip__value num">12.4°</span>
  </div>
  <div class="telemetry-strip__item" role="listitem">
    <span class="telemetry-strip__label eyebrow">DIST</span>
    <span class="telemetry-strip__value num">15.48</span>
    <span class="telemetry-strip__unit">km</span>
  </div>
</div>
```

### CSS

```css
.telemetry-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 0;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  overflow: hidden;
}
.telemetry-strip__item {
  padding: var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  border-right: 1px solid var(--border-subtle);
}
.telemetry-strip__item:last-child { border-right: 0; }
.telemetry-strip__label {
  color: var(--fg-muted);
}
.telemetry-strip__value {
  font-family: var(--font-numeral);
  font-size: var(--text-h4);
  font-weight: var(--fw-semibold);
  color: var(--fg-primary);
  letter-spacing: var(--num-letterspacing);
  line-height: 1.1;
}
.telemetry-strip__unit {
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  color: var(--fg-muted);
}

@media (max-width: 640px) {
  .telemetry-strip {
    grid-auto-flow: column;
    grid-template-columns: none;
    grid-auto-columns: minmax(96px, 1fr);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
  .telemetry-strip__item { scroll-snap-align: start; }
}
```

### Variants

| Variant | 효과 |
|---|---|
| `.telemetry-strip--sticky` | `position: sticky; bottom: 0` — 페이지 하단 fixed stat bar |
| `.telemetry-strip--lg` | item padding 큼, value `--text-h3` |
| `.telemetry-strip--compact` | item padding 작음, label 안 보임 (그저 num + unit) |
| `.telemetry-strip__item--accent` | 강조 item — bg `--accent-subtle`, value `--accent` |

### a11y

- `role="list"` + `role="listitem"` — 데이터 list 의미 명시 (div 의 default semantic 없음)
- 모바일 가로 스크롤 + scroll-snap — touch UX 정통
- 각 metric 의 `<label>` (eyebrow) + value + unit 분리 — screen reader 가 "SOG 17.0 kt" 처럼 자연 발화

---

## 종합 — 컴포넌트 dependency 매트릭스

| Component | 토큰 의존 | 다른 컴포넌트 포함? |
|---|---|---|
| C1 Hero Metric | accent · font-numeral · text-hero-* | 옵션: C4 inline |
| C2 Glass Data Card | glass-bg/border/blur · sparkline-* · status-* | 포함: C3 |
| C3 Sparkline Strip | sparkline-stroke/area/dot/grid · accent | 독립 |
| C4 Comparison Metric | glass-* · num · accent-subtle · status-* | 옵션: C3 inline (각 item 에 작은 sparkline) |
| C5 Telemetry Strip | glass-* · num · accent · border-subtle | 독립 |

**조합 패턴** (실 사용):
- **Dashboard hero**: C1 + C4 (`comparison` inline) — 큰 score + 비교 stat
- **Stat grid**: C2 × 4 grid — 4 KPI card with sparkline + delta
- **Activity card**: C2 + C5 (footer telemetry strip) — single 활동 summary
- **Page bottom sticky**: C5 `--sticky` — 전 페이지 telemetry 항상 보임 (DataViz §1-6 mobile 정보 밀도 원칙)

---

## 부록 — 알렉스 implementation 권장 순서

알렉스 sprint 1 (4h) 의 컴포넌트 적용 순서:

1. **tokens.css import** — `<link rel="stylesheet" href="/_design-system/tokens.css">` + `<html data-theme="dark">` (또는 `<body data-theme="dark">`)
2. **C3 Sparkline 함수** — JS 의 reusable `renderSparkline(svgEl, points)` helper. SVG path 동적 생성
3. **C2 Glass Data Card** — landing index.html 의 trust-bar 직하에 4 KPI card grid 적용 (Visual reference §2-1 의 hero summary 패턴 재사용 + glassmorphism)
4. **C1 Hero Metric** — 리포트 cover · 라이딩 대시보드 hero · landing 의 sub-hero
5. **C4 Comparison Metric** — Dashboard 의 PR/오늘/평균 비교 view
6. **C5 Telemetry Strip** — 페이지 footer 또는 카드 내부 sub-stat bar

각 step 후 시각 회귀 0 확인 (token-only, 색·spacing 모두 token reference). 알렉스 자율 페이스.

---

_Last updated: 2026-06-06_
_Design System v2 — 5 컴포넌트 spec. tokens.css single source 의존. Phase 1 = 본인 owner sprint 산출. Phase 2 = 알렉스 sweep 적용._
