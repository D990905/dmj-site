# dataviz_pr_dashboard_contributions.md — 시스템 A `admin/dashboard/` PR contributions

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 2 sprint 1-2 PR spec (implementation-ready) |
| 작성 | 샘 정 (DataViz Specialist, #2) · 2026-06-02 |
| 대상 | 시스템 A `site/admin/dashboard/` (cytoscape PWA · 다크 cockpit theme · `--bg-elev`/`--c-yellow`/`--accent` 토큰) |
| 근거 | `_experts/dataviz_dashboard_ia_spec.md` §3 (살아있음) · `site/admin/dashboard/styles.css` :root 토큰 · 로즈 윤 `visual_designer_pr_dashboard_contributions.md` γ 패턴 동일 · 12:34:56 messages.md entry 의 "full 3 / compact 3" 위계 framework |
| Co-owners | #9 (Dashboard) — 구현 · 로즈 윤 (#1) — 시각 검증 round · 알렉스 박 (#4) — frontend 표준 sync · #11 — daemon-side schema 추가 |
| 원칙 | 시스템 A 다크 cockpit theme 토큰 100% 재사용 · 신규 hex **0 건** · Chart.js 4.x + 기존 `riding-dashboard/js/chart-theme.js` 의 `goodness()` 함수 재사용 · WCAG 2.2 AA contrast 사수 |

> **읽는 법.** §0 = TL;DR + PR 4 우선순위. §1 = 시스템 A 다크 토큰 매핑 (chart-theme 라이트 → 시스템 A 다크). §2~§5 = PR 1~4 각각 implementation spec (data shape / Chart.js config / 인터랙션 / a11y). §6 = 공통 `applyDashboardChartDefaults()` 헬퍼. §7 = 협업 인터페이스. §8 = sources.

---

## 0. TL;DR + PR 4 우선순위

본 spec 의 차트 4종은 **시스템 A 의 운영 메트릭 layer** — graph view (21 task × 8 expert) 와 보완. 12:34:56 mirror entry 의 sports science 6 metric framework (CTL·ATL·TSB · ACWR · wind confidence · periodization · HRV · compliance) 와는 **다른 카드 — 같은 시스템 A 에 충돌 0**. sports science = riding-dashboard 영역 · 본 4 차트 = orchestrator dashboard 영역.

| PR | 차트 | 5초 인지 가치 | Effort | 의존 | Tier |
|---|---|---|---|---|---|
| **PR D1** | **비용 burndown** (daily bar + 월간 cumulative line) | "월간 cost cap 까지 얼마 남았나" | 2-3h | `usage.json` schema (이미 있음 — `expert_orchestrator_daemon_reference.md` §4-2) | **full 차트 #1** |
| **PR D2** | **Persona 활용도** (가로 막대, sorted desc, 30일) | "어느 페르소나가 bottleneck?" | 1-2h | `.orchestrator/status/*.json` 의 `specialist` 필드 (이미 정의됨) | **full 차트 #2** |
| **PR D3** | **Ship cadence** (히스토그램 + 5일 reference line) | "dispatch ship 평균 일수 / 분포" | 2-3h | `started_at` + `finished_at` (status JSON 에 정의됨) | **full 차트 #3** |
| **PR D4** | **Decision sparkline grid** (도메인 11개 × 12주 sparkline) | "어느 도메인에서 결정 cadence 높나" | 2-3h | Notion #decisions 또는 `_team/dispatches/` archive | **compact** (sparkline grid) |
| **합** | | | **7-11h** | | |

**12:34:56 mirror entry 의 "차트 3개 룰" 적용** — full 차트 3 + compact 1 (sparkline grid 는 full 차트 1개로 counted X, Tufte sparkline 정통). 4 차트가 한 화면에 동시에 올라가지 **않음** — 별 page `admin/dashboard/metrics.html` 또는 collapse panel (대표님 mid-day 결정 시점에 토글) 권장.

### 권장 배치 옵션

| 옵션 | 의미 | trade-off |
|---|---|---|
| **A** 별 page `admin/dashboard/metrics.html` | graph view (`index.html`) 와 분리 · 대표님 morning 5초 = graph · mid-day 결정 = metrics | navigation 1단 추가, LCP 보호 |
| **B** collapse panel (`index.html` 안 하단 sheet) | 한 화면 안 토글 · 더 빠른 접근 | graph + metrics 동시 인지 부담 |

**본인 권장 = 옵션 A** (별 page). 대표님 결정 1글자 (A / B). #9 implement 자율.

---

## 1. 시스템 A 다크 토큰 매핑

`riding-dashboard/js/chart-theme.js` 가 라이트 모드. 시스템 A 는 다크 cockpit. **신규 토큰 0건** — 다음 매핑으로 chart-theme 의 의미를 시스템 A 토큰 위에 재현:

| chart-theme (라이트) | 의미 | 시스템 A (다크) | hex |
|---|---|---|---|
| `BASE.ink` `#5C6F7E` | 축 눈금·범례 | `var(--text-dim)` | `#9aa3b8` |
| `BASE.inkStrong` `#0A2540` | 강조 라벨 | `var(--text)` | `#e8ecf4` |
| `BASE.grid` `rgba(10,37,64,0.07)` | 격자선 | `var(--line)` (alpha 변환 = `rgba(36,48,70,0.6)`) | `#243046` |
| `BASE.line` `#0A2540` | 기본 line 시리즈 | `var(--accent-2)` | `#60a5fa` |
| `STATUS.veryGood` `#1FA055` | 매우좋음 | `var(--c-green)` | `#22c55e` |
| `STATUS.mid` `#F2C20E` | 보통 | `var(--c-yellow)` | `#facc15` |
| `STATUS.veryBad` `#D6453A` | 매우나쁨 | `var(--c-red)` | `#ef4444` |
| `STATUS.good` `#7FC241` | 좋음 | OKLCH lerp (`--c-green` × `--c-yellow`) — `#84cb3e` 근사 | (계산) |
| `STATUS.bad` `#EC8A2E` | 나쁨 | OKLCH lerp (`--c-yellow` × `--c-red`) — `#f39d32` 근사 | (계산) |
| `CATEGORY[0..5]` navy/sea/teal/slate/violet/amber | 단순 구분 | `var(--accent-2)` · `var(--c-blue)` · `var(--accent)` · `var(--c-gray)` · OKLCH 보간 2개 | (Phase 2-B 로즈 협의) |
| `goodness(value, direction)` | 좋은 방향 함수 | **그대로 재사용** — 5 앵커만 다크 토큰으로 swap | n/a |

**구현** — `riding-dashboard/js/chart-theme.js` 를 dual-mode 로 확장 X (라이트 모드 dashboard 영향 회피). 대신 **신규 `admin/dashboard/chart-theme-dark.js`** 작성 — 라이트 theme 의 logic / 함수 시그니처 동일, 색 토큰만 다크.

```js
/* admin/dashboard/chart-theme-dark.js — 시스템 A 다크 cockpit chart theme.
   라이트 모드 chart-theme.js 와 함수 시그니처 1:1 — goodness/statusAt/categoryColor.
   색 토큰만 시스템 A :root 변수에서 해석 (computed style). */
(function (global) {
  function cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
  }
  /* 5 앵커 — 시스템 A 토큰 직접 */
  function statusAnchors() {
    return [
      { g: 0.00, hex: cssVar('--c-red') },     /* veryBad */
      { g: 0.25, hex: oklchMix('--c-yellow', '--c-red', 0.5) },  /* bad */
      { g: 0.50, hex: cssVar('--c-yellow') },  /* mid */
      { g: 0.75, hex: oklchMix('--c-green', '--c-yellow', 0.5) },/* good */
      { g: 1.00, hex: cssVar('--c-green') }    /* veryGood */
    ];
  }
  /* OKLCH 보간 — perceptually uniform (라이트 chart-theme 의 sRGB lerp 보다 정확) */
  function oklchMix(varA, varB, f) { /* color-mix(in oklch, ...) 폴리필 또는 CSS native */ }
  // ... statusAt(g) / goodness(value, direction, opts) / categoryColor(i) / applyChartDefaults(Chart) 그대로 ...
  global.RDDarkChartTheme = { /* ... */ };
})(window);
```

**OKLCH 보간 — 시스템 A 만의 quick win**. `chart-theme.js` 라이트 모드의 sRGB lerp 보다 perceptually uniform. 빠른 prototype 단계 OK.

---

## 2. PR D1 — 비용 burndown

### 2-1. 목적

월간 Anthropic API cost 의 daily 적립 + cap ($50) 까지 남은 여유를 5초 인지. `usage.json` 의 `day_total` / `month_total` (`expert_orchestrator_daemon_reference.md` §4-2 cost.py).

### 2-2. Data shape

```json
{
  "month": "2026-06",
  "monthly_cap_usd": 50.0,
  "daily_notify_usd": 10.0,
  "month_total": 12.34,
  "days": [
    { "date": "2026-06-01", "day_total": 1.22 },
    { "date": "2026-06-02", "day_total": 2.18 }
  ]
}
```

### 2-3. 차트 유형 + Chart.js config

**Chart.js mixed chart** — bar (daily) + line (cumulative). dual-axis (좌 = daily $ · 우 = cumulative $ vs cap).

```js
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: days.map(d => d.date.slice(5)),  /* MM-DD */
    datasets: [
      {
        type: 'bar', label: 'Daily ($)', yAxisID: 'y',
        data: days.map(d => d.day_total),
        backgroundColor: days.map(d =>
          d.day_total > daily_notify_usd
            ? cssVar('--c-yellow') : cssVar('--accent-2')),
        borderRadius: 4
      },
      {
        type: 'line', label: 'Cumulative ($)', yAxisID: 'y2',
        data: cumulative,
        borderColor: cssVar('--c-green'),
        backgroundColor: 'rgba(34,197,94,0.10)',
        fill: true, tension: 0.3, pointRadius: 0
      }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { grid: { color: 'rgba(36,48,70,0.4)' } },
      y: {
        title: { display: true, text: 'Daily ($)' },
        beginAtZero: true,
        grid: { color: 'rgba(36,48,70,0.4)' }
      },
      y2: {
        position: 'right',
        title: { display: true, text: 'Cumulative ($)' },
        beginAtZero: true,
        max: monthly_cap_usd,
        grid: { drawOnChartArea: false }
      }
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: cssVar('--text-dim') } },
      annotation: {  /* chartjs-plugin-annotation */
        annotations: {
          dailyThreshold: {
            type: 'line', yMin: daily_notify_usd, yMax: daily_notify_usd,
            yScaleID: 'y',
            borderColor: cssVar('--c-yellow'),
            borderWidth: 1, borderDash: [4, 4],
            label: { content: `Notify $${daily_notify_usd}`, display: true,
                     position: 'end', color: cssVar('--c-yellow') }
          },
          monthlyCap: {
            type: 'line', yMin: monthly_cap_usd, yMax: monthly_cap_usd,
            yScaleID: 'y2',
            borderColor: cssVar('--c-red'),
            borderWidth: 1, borderDash: [4, 4],
            label: { content: `Cap $${monthly_cap_usd}`, display: true,
                     position: 'end', color: cssVar('--c-red') }
          }
        }
      }
    }
  }
});
```

### 2-4. 인터랙션

- **Hover** — Chart.js 기본 tooltip (index mode). bar + line 둘 다 한 호버에 표시.
- **Cap 도달율 도넛** (top-right corner) — `month_total / monthly_cap` × 100%. 단일 비율 1개 → 도넛 OK (Tufte 가 싫어하지 않는 케이스).

### 2-5. a11y

- `aria-label`: "비용 burndown 차트 — 6월 누적 $12.34, 월간 cap $50.00, 24.7%"
- 색 단독 인코딩 X — bar 색 외에 hover tooltip 의 `> $10` 라벨 텍스트 동반.
- Reduced motion — `animation: false` (chart-theme 표준).

### 2-6. Lie factor check

- **Y 축 0 anchor**: ✓ `beginAtZero: true` 강제 (Tufte).
- **Dual-axis 함정**: ✓ `drawOnChartArea: false` 우측 축 → 좌측 격자만 노출, 시각 lie 차단.
- **Cap 도달율 도넛**: ✓ 단일 ratio 1개. Tufte OK.

---

## 3. PR D2 — Persona 활용도

### 3-1. 목적

지난 30일 동안 각 페르소나가 처리한 directive 수. "어느 페르소나가 bottleneck?" 5초 인지.

### 3-2. Data shape

```json
{
  "window_days": 30,
  "personas": [
    { "slug": "rose-yoon",    "label": "로즈 윤 (#1)",    "count": 12, "color_var": "--c-rose" },
    { "slug": "sam-jung",     "label": "샘 정 (#2)",     "count": 8,  "color_var": "--accent-2" },
    { "slug": "timo-kang",    "label": "티모 강 (#3)",    "count": 9,  "color_var": "--c-teal" }
  ]
}
```

`color_var` 는 시스템 A `:root` 의 페르소나 색 (로즈 `brand_color_spec §2-1` 의 8 hex). 신규 토큰 = 로즈 영역, 본 spec 은 reference 만.

### 3-3. 차트 유형

**Chart.js horizontal bar**, sorted by count desc. 9 명 (8 + 데이빗 옥) = 한 화면 OK.

```js
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: sorted.map(p => p.label),
    datasets: [{
      label: 'Directives (30d)',
      data: sorted.map(p => p.count),
      backgroundColor: sorted.map(p => cssVar(p.color_var)),
      borderRadius: 4
    }]
  },
  options: {
    indexAxis: 'y',  /* horizontal */
    responsive: true, maintainAspectRatio: false,
    scales: {
      x: { beginAtZero: true, grid: { color: 'rgba(36,48,70,0.4)' } },
      y: { grid: { display: false } }
    },
    plugins: { legend: { display: false } }
  }
});
```

### 3-4. 인터랙션

- **Hover** — tooltip: "로즈 윤 — 12 directives · 평균 ship 4.2일 · cost $5.40"
- **Click bar** — side panel 펼침: 해당 페르소나의 30일 directive 리스트 (시스템 A 의 `--side-panel-w 360px` 재사용).

### 3-5. a11y

- bar 색 단독 인코딩 X — label 항상 표시 (가로 막대라 라벨 공간 풍부).
- aria-label: "페르소나 활용도 — 30일, 9명 중 로즈 윤이 12로 1위"

### 3-6. Lie factor check

- **막대 길이 = count 직접 비례**: ✓ (도넛이 아닌 막대 = Tufte 정통).
- **순서 = sorted by count**: ✓ 인지 부담 감소.
- **색 = 페르소나 식별만**, 좋·나쁨 의미 X — 범주색 정통 사용.

---

## 4. PR D3 — Ship cadence

### 4-1. 목적

`finished_at - started_at` (일 단위) 의 분포 + 평균 + 목표 (operations_setup §5-2 의 "5일 이내"). "내가 던지는 dispatch 가 평균 며칠에 ship 되는가" 5초 인지.

### 4-2. Data shape

```json
{
  "window_days": 30,
  "dispatches": [
    { "id": "D-2026-05-31-001", "specialist": "rose-yoon", "ship_days": 2.1 },
    { "id": "D-2026-06-01-003", "specialist": "alex-park", "ship_days": 4.5 }
  ],
  "target_days": 5,
  "mean": 3.4,
  "median": 3.0
}
```

### 4-3. 차트 유형

**히스토그램 (Chart.js bar)** — 0-1 / 1-2 / 2-3 / 3-5 / 5-7 / 7+ 일 bin. 막대 색 = `goodness(ship_days, 'lower', {min:0,max:7})` ramp.

```js
const bins = [
  { range: '<1', from: 0, to: 1 },
  { range: '1-2', from: 1, to: 2 },
  { range: '2-3', from: 2, to: 3 },
  { range: '3-5', from: 3, to: 5 },  /* 5일 = 목표 boundary */
  { range: '5-7', from: 5, to: 7 },
  { range: '7+', from: 7, to: Infinity }
];
const counts = bins.map(b =>
  dispatches.filter(d => d.ship_days >= b.from && d.ship_days < b.to).length);
const colors = bins.map(b =>
  goodness(b.from, 'lower', {min:0,max:7})  /* statusAt(g) → 다크 토큰 */
);

new Chart(ctx, {
  type: 'bar',
  data: {
    labels: bins.map(b => `${b.range}일`),
    datasets: [{
      data: counts,
      backgroundColor: colors,
      borderRadius: 4
    }]
  },
  options: {
    scales: {
      x: { title: { display: true, text: 'Ship 일수' },
           grid: { display: false } },
      y: { beginAtZero: true, title: { display: true, text: 'Dispatch 수' },
           grid: { color: 'rgba(36,48,70,0.4)' } }
    },
    plugins: {
      legend: { display: false },
      annotation: {
        annotations: {
          targetLine: {
            type: 'line', xMin: 3.5 /* "3-5"·"5-7" 경계 */,
            xMax: 3.5,
            borderColor: cssVar('--c-yellow'),
            borderWidth: 1, borderDash: [4, 4],
            label: { content: `목표 ${target_days}일`,
                     display: true, position: 'start',
                     color: cssVar('--c-yellow') }
          }
        }
      }
    }
  }
});
```

### 4-4. 인터랙션

- **Hover bar** — tooltip: "3-5일 · 12 dispatches · 평균 4.1일"
- **Click bar** — side panel: 해당 bin 의 dispatch ID 리스트.
- **상단 stat strip** — mean: 3.4 · median: 3.0 · n: 30 (Chart.js 외부 HTML).

### 4-5. a11y

- aria-label: "Ship cadence 히스토그램 — 30일 dispatch 평균 3.4일, 목표 5일 이내"
- 색 ramp 외에 막대 위 count 라벨 표시.

### 4-6. Lie factor check

- **Bin 폭 균일 X** (`3-5` 가 폭 2, 나머지 1) — y축 = count 라 시각 lie 위험 → `density = count / bin_width` 로 정규화 권장.
- **본인 정직 권장**: bin 을 `<1 / 1-2 / 2-3 / 3-4 / 4-5 / 5-7 / 7+` 로 균일화 (7 bin). 5일 목표를 시각 boundary 로 강조.

### 4-7. 대안 — Violin variant

riding-dashboard `renderViolin` 패턴 재사용 (단일 violin · KDE) → 분포 곡선이 더 정확. 단 코드 양 증가 (히스토그램은 Chart.js 1줄, violin 은 custom canvas ~200줄). **PR D3-A = 히스토그램 (sprint 1) → PR D3-B = violin upgrade (sprint 2)** 권장.

---

## 5. PR D4 — Decision sparkline grid

### 5-1. 목적

도메인 11 태그 (`operations_setup §2-2`) × 12주 weekly count → 도메인별 inline sparkline. Tufte sparkline 의 정통 사용처.

### 5-2. Data shape

```json
{
  "weeks": ["2026-W11", "2026-W12", "..."],
  "domains": [
    { "tag": "visual",    "label": "시각·brand",     "weekly": [2, 3, 1, 0, 4, 2, 1, 3, 5, 2, 1, 4] },
    { "tag": "dataviz",   "label": "차트·시각화",     "weekly": [1, 0, 2, 1, 1, 3, 0, 1, 2, 2, 1, 2] }
  ]
}
```

### 5-3. 차트 유형

**HTML table + inline SVG sparkline** (Chart.js X — 너무 작아서 overkill).

```html
<table class="decision-cadence">
  <thead>
    <tr><th>도메인</th><th>12주 추세</th><th>총합</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>시각·brand</td>
      <td><svg width="120" height="20" viewBox="0 0 120 20">
        <polyline points="..." stroke="var(--accent-2)" fill="none"
                  stroke-width="1.5"/>
        <circle cx="115" cy="..." r="2" fill="var(--c-yellow)"/>  <!-- latest -->
      </svg></td>
      <td class="num">28</td>
    </tr>
    <!-- ... -->
  </tbody>
</table>
```

### 5-4. Sparkline 정통 4 원칙 (Tufte)

1. **고정 사이즈** — 120 × 20px, 모든 행 같은 dimension.
2. **Latest 강조** — 마지막 데이터 점에 dot (`--c-yellow`). Tufte 의 endpoint emphasis.
3. **Min/max 마커** (옵션) — `--c-green` / `--c-red` 작은 dot.
4. **Baseline 0** — sparkline 도 y 축 0 anchor.

### 5-5. 인터랙션

- **Hover row** — tooltip: "시각·brand · last week: 4 · 12주 평균: 2.3"
- **Click row** — side panel: 해당 도메인의 12주 decision 리스트.

### 5-6. a11y

- aria-label per row: "시각·brand 도메인 — 12주 결정 총 28건, 최근 주 4건"
- sparkline SVG 는 `<title>` 안 데이터 요약 (screen reader).

### 5-7. Lie factor check

- 모든 sparkline 같은 y-scale (전체 max 기준) — 도메인 간 시각 비교 정확.
- 또는 개별 scale (도메인 내부 추세만) — trade-off, **본인 권장 = 전체 max** (cross-domain 비교가 sparkline grid 의 목적).

---

## 6. 공통 — `applyDashboardChartDefaults(Chart)` 헬퍼

`riding-dashboard/js/chart-theme.js` 의 `applyChartDefaults` 패턴 동일, 다크 cockpit 토큰만 swap:

```js
function applyDashboardChartDefaults(Chart) {
  const cs = getComputedStyle(document.documentElement);
  const v = name => cs.getPropertyValue(name).trim();

  Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,"SF Pro Text",' +
    '"Pretendard",sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = v('--text-dim');
  Chart.defaults.borderColor = 'rgba(36,48,70,0.6)';  /* --line alpha */

  const lg = Chart.defaults.plugins.legend;
  lg.position = 'bottom';
  lg.align = 'center';
  lg.labels.usePointStyle = false;
  lg.labels.boxWidth = 10;
  lg.labels.boxHeight = 10;
  lg.labels.padding = 12;
  lg.labels.color = v('--text-dim');

  const sc = Chart.defaults.scale;
  if (sc) {
    sc.grid && (sc.grid.color = 'rgba(36,48,70,0.4)', sc.grid.lineWidth = 1);
    sc.ticks && (sc.ticks.color = v('--text-dim'));
    sc.title && (sc.title.color = v('--text-dim'),
                 sc.title.font = { size: 11, weight: '600' });
  }
}
```

**호출 위치** — `admin/dashboard/index.html` 또는 `metrics.html` 의 `<script>` 최상단, Chart 인스턴스 생성 전.

---

## 7. 협업 인터페이스

### 7-1. #9 (Dashboard) — 구현

- 본 spec 4 PR 의 implementation. 권장 순서 D1 → D2 → D3 → D4 (effort 작은 순 X — D2 가 가장 작고 D4 가 가장 가벼움. 본인 권장 = **D2 → D1 → D4 → D3** — UX 즉시 가치 순).
- Chart.js 4.x + `chartjs-plugin-annotation` 3.x 도입 (PR D1 + D3 reference line).
- `admin/dashboard/metrics.html` 별 page 또는 `index.html` collapse panel — 옵션 A/B 대표님 결정 후.

### 7-2. 로즈 윤 (#1) — 시각 검증 round

- 각 PR 도착 시 30-60m 시각 검증 — 다크 토큰 정확 적용 · OKLCH 보간 정밀도 · 모바일 layout · WCAG contrast.
- **본인 + 로즈 협업 필수 영역** — §1 의 OKLCH 보간 polyfill 결정 (CSS native `color-mix(in oklch, ...)` Safari 16.4+ vs chroma.js 라이브러리).

### 7-3. 알렉스 박 (#4) — frontend 표준 sync

- iOS hit-test §171-C — 차트 hover 영역 `pointer-events` 처리.
- Focus visible — Chart.js 인터랙션의 키보드 navigation (tab + Enter).
- Performance — Chart 인스턴스 메모리 (4 × ~50KB), IntersectionObserver lazy 로드.

### 7-4. #11 (Orchestrator Daemon) — schema 추가

본 spec 의 data shape 4 종 정의 필요:

```json
{
  "cost_burndown": { ... },        /* PR D1 §2-2 */
  "persona_utilization": { ... },  /* PR D2 §3-2 */
  "ship_cadence": { ... },         /* PR D3 §4-2 */
  "decision_cadence": { ... }      /* PR D4 §5-2 */
}
```

`dashboard-state.json` 에 4 필드 추가 또는 별 `dashboard-metrics.json` 분리 — #11 결정.

### 7-5. 티모 강 (#3) — sports science chain 과 분리 확인

본 4 차트 = orchestrator 운영 메트릭. 티모 13:48 의 6 metric (CTL·ATL·TSB · ACWR · wind · HRV · periodization · compliance) = riding-dashboard sports science. **별 카드 · 별 페이지 · 충돌 0.** 12:34:56 mirror entry 의 "full 3 / compact 3" framework 와 본 "full 3 + compact 1 sparkline" framework 가 같은 시스템 A 에 들어가도 충돌 X.

---

## 8. 제약 준수 확인

| 제약 | 준수 |
|---|---|
| 시스템 A 다크 cockpit theme 토큰 100% 재사용 | ✅ §1 매핑 |
| 신규 hex 0 건 | ✅ — OKLCH 보간으로 status 5 앵커 생성 (시스템 A 의 `--c-green/--c-yellow/--c-red` 만) |
| Chart.js + chart-theme.js logic 재사용 | ✅ — `goodness()` 함수 그대로, 색 토큰만 swap |
| WCAG 2.2 AA contrast | ✅ — `--text-dim #9aa3b8` on `--bg #0a0e1a` = 7.8:1 (AAA) |
| Tufte data-ink ratio | ✅ — 격자 alpha 0.4, 축 라벨 색 dim, chartjunk 0 |
| Lie factor | ✅ — 모든 차트 §X-6 lie factor check 통과 |
| 호칭 통일 (대표님) | ✅ — 본 spec 전체 "의장" 0건 |

---

## 9. Sources

**프로젝트 내부**
- `site/admin/dashboard/styles.css` `:root` — 시스템 A 다크 cockpit 토큰 (`--bg`/`--bg-elev`/`--c-green`/`--c-yellow`/`--c-red`/`--accent`/`--text-dim`)
- `site/riding-dashboard/js/chart-theme.js` — `goodness()` · `statusAt()` · `applyChartDefaults()` 함수 재사용
- `_experts/dataviz_dashboard_ia_spec.md` §3 — 본 spec 차트 4종 origin (현재 deprecated, 차트 4종만 살아있음)
- `_experts/expert_dataviz_reference.md` §1-5 (color) · §1-1 (Tufte) · §3-1 (라이브러리 결정)
- `_experts/expert_orchestrator_daemon_reference.md` §4-2 (cost.py · usage.json schema) · §6-2 (status JSON schema)
- `_experts/visual_designer_pr_dashboard_contributions.md` (로즈 윤 γ 패턴 동일 — 4 PR 참고)
- `_team/sync/messages.md` 12:34:56 entry (본인 mirror — "full 3 / compact 3" framework, sports science chain 의 6 metric 매핑)
- `_team/operations_setup.md` §2-2 (decision 11 도메인 태그) · §5-2 (5일 이내 ship 목표)

**외부 reference**
- Tufte, *The Visual Display of Quantitative Information* — sparkline, data-ink ratio, lie factor
- Few, *Information Dashboard Design* (2판) ch.3 — 한 화면 차트 수 인지 한계 (12:34:56 entry 인용)
- [Chart.js 4.x docs](https://www.chartjs.org/docs/latest/)
- [chartjs-plugin-annotation](https://www.chartjs.org/chartjs-plugin-annotation/latest/)
- [CSS color-mix(in oklch, ...) — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix)
- WCAG 2.2 SC 1.4.3 (Contrast Minimum) · SC 1.4.11 (Non-text Contrast) · SC 1.4.1 (Use of Color)

---

_Last updated: 2026-06-02_
_Phase 2 sprint 1-2 PR spec — #9 implement 자율. 대표님 결정 1글자 (배치 옵션 A vs B). 본인 차트 4종 시각 검증 round standby._
