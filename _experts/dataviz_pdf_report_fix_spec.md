# dataviz_pdf_report_fix_spec.md — 라이딩 분석 보고서 PDF 6 이슈 fix spec

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 2 sprint PDF fix spec (implementation = 알렉스 박 #4 / 본인 = 시각 인코딩) |
| 작성 | 샘 정 (DataViz Specialist, #2) · 2026-06-05 |
| 대상 | `site/riding-dashboard/js/pdf-export.js` (53KB, 875줄) + 라이브 dashboard cascade 검증 |
| 근거 | `pdf-export.js` 직접 열람 · `app.js:3948~4505` state.whatif 데이터 source · CoS 데이빗 옥 진단 6 이슈 |
| 트리거 | 옥대표님 *"라이딩 분석 보고서 추가해줘"* (2026-06-05) — 라이브 차트 색감 fix 후속 sprint |
| Co-owners | 알렉스 박 (#4) — pdf-export.js implementation · 로즈 윤 (#1) — 토큰 영향 0 확인 |

> **읽는 법.** §0 = TL;DR + 우선순위. §1 = PDF cascade 검증 (라이브 fix 자동 inherit 여부). §2 = p.8 What-if 형식 spec (CRITICAL). §3 = medium 4건 spec (p.3·p.4·p.6·p.7). §4 = 알렉스 implementation path. §5 = sources. **Phase 1 spec — 구현 X (알렉스 영역)**.

---

## 0. TL;DR + 우선순위

| # | 이슈 | tier | 본인 spec | 알렉스 impl | ETA |
|---|---|---|---|---|---|
| **1** | **p.8 What-if 데이터 dump (run-on text)** | 🔴 CRITICAL | §2 — 표 + line chart spec | pdf-export.js `buildWhatIfPage()` 재작성 | 본인 0.5h · 알렉스 2-3h |
| 2 | p.4 속도 분포 pie cascade | ✅ 자동 inherit (§1) | 없음 — 6/5 라이브 fix 가 자동 cascade | 검증만 (옥대표님 iPhone PDF 1회) | 0 |
| 3 | p.3 GPS map 너무 작음 | 🟡 medium | layout 우선 — 알렉스 영역 | 풍향 박스 좁히기 + map maxHeight 확대 | 알렉스 1h |
| 4 | p.4 고속 구간 5건 textContent dump | 🟡 medium | §3-1 — 표 spec | runsList textContent → 표 변환 | 본인 0.3h · 알렉스 1h |
| 5 | p.6 HR line dense + scatter messy | 🟡 medium | §3-2 — 시각 단순화 spec | maxHeight / opacity / radius 조정 | 본인 0.5h · 알렉스 0.5h |
| 6 | p.7 Coach 텍스트만 + callout 부재 | 🟡 medium | §3-3 — callout box 2개 spec | callout HTML 생성 | 본인 0.5h · 알렉스 1h |

**Phase 2 sprint 동봉 vs 분리 — 본인 권장 동봉**. 6 이슈 모두 `pdf-export.js` 한 파일 영역. 알렉스 sprint 1 closure (§182 P0 fix) 직후 sprint 2 진입 시 묶음. 분리하면 두 sprint 로 cost 증가.

---

## 1. PDF cascade 검증 — 라이브 fix 자동 inherit 여부

### 1-1. 캡처 방식 매트릭스

`pdf-export.js` 직접 열람 (line 580~770) — 차트별 캡처 방식 진단:

| 영역 | 캡처 방식 (code ref) | cascade |
|---|---|---|
| **p.3 GPS map** | `html2canvas(mapEl)` (line 220) — Leaflet 컨테이너 전체 캡처 | ✅ 라이브 fix 자동 inherit |
| **p.4 속도 시계열** | `canvasToDataURL('speed-chart')` (line 581) — Chart.js canvas 직접 캡처 | ✅ |
| **p.4 속도 분포 pie** | `canvasToDataURL('histogram-chart')` (line 582) | ✅ **본인 6/5 라이브 fix `speedColor → statusAt(f)` 자동 inherit** |
| **p.4 고속 구간 5건** | `runsList.textContent` (line 596) — `.replace(/\s+/g, ' ').slice(0, 600)` | ❌ run-on 가능 |
| p.5 폴라 | `canvasToDataURL('target-polar-canvas')` (line 629) | ✅ |
| p.5 바이올린 | `canvasToDataURL('violin-canvas')` (line 636) | ✅ |
| p.6 HR trend | `canvasToDataURL('hr-trend-chart')` (line 650) | ✅ |
| p.6 HR zone | `canvasToDataURL('hr-zone-chart')` (line 651) | ✅ |
| p.6 HR eff | `canvasToDataURL('hr-eff-chart')` (line 652) | ✅ — 단 시각 dense (§3-2) |
| **p.7 Coach** | `card.querySelectorAll('p, li, h3, h4, ...').textContent` (line 678~687) | 🟡 부분 (구조 보존, callout 없음) |
| **p.8 What-if** | `coach.querySelectorAll('.coach__whatif, [class*="whatif"]').textContent` (line 702~712) | ❌ run-on dump (CRITICAL) |
| p.9 Appendix | hardcoded text (line 730~756) | ✅ 변경 영향 0 |

### 1-2. 결론

- **Chart.js / canvas / Leaflet 기반 영역 (p.3 map · p.4 pie · p.4 시계열 · p.5 폴라/바이올린 · p.6 HR 3차트) → 본인 라이브 fix 자동 inherit ✅**
- **textContent 추출 영역 (p.4 고속 구간 · p.7 Coach · p.8 What-if) → 별도 fix 필요 ❌**
- 본인 6/5 `speedColor → statusAt` 라이브 fix 는 **p.4 속도 분포 pie 의 PDF 출력에 자동 반영**. CoS step A 답: cascade ✓.

### 1-3. 검증 행동

옥대표님 iPhone Safari 에서 라이브 dashboard → PDF preview 모달 → p.4 pie 색 시각 확인 1회. 다른 검증 불필요. 본 spec 의 cascade 매트릭스가 코드 직접 evidence 기반.

---

## 2. p.8 What-if 형식 spec (CRITICAL)

### 2-1. 현재 문제 정확 진단

`pdf-export.js:699~723` `buildWhatIfPage()` 의 textContent 추출:

```js
var sections = coach ? coach.querySelectorAll(
  '.coach__whatif, [class*="whatif"], .whatif') : [];
for (var i = 0; i < sections.length; i++) {
  var txt = String(sections[i].textContent || '').trim();
  if (txt) html += '<p>' + esc(txt) + '</p>';
}
```

라이브 dashboard 의 `sweep-row` 구조:

```html
<div class="sweep-row">
  <span class="sweep-row__size">5.5 m²</span>
  <span class="sweep-row__track"><span class="sweep-row__bar" style="width:..."></span></span>
  <span class="sweep-row__val">VMG 8.1 kt</span>
  <span class="sweep-row__tag"><span class="sweep-tag">현재 윙</span></span>
</div>
```

`textContent` 가 5 child element 의 텍스트를 **공백 없이 평탄화** → `"5.5 m²VMG 8.1 kt현재 윙"`. 6 row 누적 → `"VMG 8.1 kt5.5 m²VMG 9.0 kt6.0 m²..."` run-on dump.

### 2-2. 데이터 source — state.whatif 직접 접근

`app.js:3948~3958`:

```js
state.whatif = RDCoach.computeWhatIf(state.analysis, state.rider,
                                      state.windSpeedKt);
```

`coach.js:337~510` `computeWhatIf()` 반환 schema:

```js
{
  ok: true,
  anchored: true,
  measVmgKt: 8.1,                  // 실측 풍상 VMG 앵커
  currentWingM2: 5.5,
  optimumWingM2: 7.0,              // 최적 (피크)
  comfortWingM2: 6.5,              // 편안함 (정점 -0.5)
  optimumVmgKt: 10.1,
  deltaVmg: 2.0,                   // 추천 윙 vs 현재 윙 VMG 차이
  sweepPoints: [                   // ★ p.8 데이터 source
    { area_m2: 5.0, vmgKt: 7.2, isActual: false, isOptimum: false, isComfort: false, feasible: true },
    { area_m2: 5.5, vmgKt: 8.1, isActual: true,  ... },
    { area_m2: 6.0, vmgKt: 9.0, isActual: false, ... },
    { area_m2: 6.5, vmgKt: 9.6, isActual: false, isComfort: true, ... },
    { area_m2: 7.0, vmgKt: 10.1, isActual: false, isOptimum: true, ... },
    { area_m2: 7.5, vmgKt: 9.8, isActual: false, ... }
  ],
  recommendChange: true,
  meaningfulDeltaThresholdKt: 0.5,
  step_m2: 0.5
}
```

`textContent` 우회 — `state.whatif.sweepPoints` 직접 사용 가능. `window.RDApp.getState()` 또는 `pdf-export.js` 가 module-level state 접근 (이미 `$('coach-card')` 사용 패턴 = global state 접근 OK).

### 2-3. 표 spec

| column | header | data | style |
|---|---|---|---|
| 윙 (m²) | "윙 (m²)" | `p.area_m2.toFixed(1)` | 좌측 정렬 · 700 weight · `#0A2540` |
| VMG (kt) | "VMG (kt)" | `p.vmgKt.toFixed(1)` | 우측 정렬 · 600 weight |
| Δ% | "Δ% (vs 현재)" | `((p.vmgKt - measVmgKt) / measVmgKt * 100).toFixed(1) + '%'` | 우측 정렬 · 색: positive = `--good` / negative = `--bad` |
| 태그 | "" | `p.isActual ? '현재' : p.isOptimum ? '🌟 최적' : p.isComfort ? '편안함' : ''` | 우측 작은 chip |

### 2-4. Line chart spec

| 요소 | 값 |
|---|---|
| 라이브러리 | Chart.js (이미 pdf-export.js 에 로드됨 — `html2canvas` + jsPDF 환경) |
| 차트 type | `line` (Tufte 권장 — 연속 함수면 선이 막대보다 옳음) |
| X axis | 윙 사이즈 (m²) · linear scale · ticks: sweep points 의 `area_m2` |
| Y axis | VMG (kt) · linear scale · `beginAtZero: false` (윙 sweep 의 VMG 차이 강조) |
| Line | `borderColor: #1F8FFF` (sea) · `borderWidth: 2` · `tension: 0.3` (smooth curve) |
| Point — current | `area_m2 === measWingM2` 인 점 → `radius: 6` · `backgroundColor: var(--text)` · 라벨 "현재" |
| Point — optimum | `isOptimum` 점 → `radius: 8` · `backgroundColor: var(--good)` (#1FA055) · 라벨 "🌟 최적" |
| Point — comfort | `isComfort` 점 → `radius: 6` · `backgroundColor: var(--warn)` (#E0A100) · 라벨 "편안함" |
| Anchor line | `measVmgKt` 가로 horizontal reference line (dashed `#7E93A8`) · 라벨 "실측 VMG (앵커)" |
| 신규 hex | **0건** — chart-theme 토큰 100% 재사용 |
| LCP | PDF 출력 1회성 (모달) — lazy 부적격, 즉시 렌더 |

### 2-5. buildWhatIfPage 재작성 — pseudo code (알렉스 implement)

```js
function buildWhatIfPage(page) {
  var wi = (window.RDApp && RDApp.getState && RDApp.getState().whatif)
           || (window.state && window.state.whatif);  // fallback
  var b = el('div', 'pdf-block');

  if (!wi || !wi.ok || !wi.sweepPoints || !wi.sweepPoints.length) {
    /* 풍향 미확정 fallback (현재와 동일) */
    var p = el('div', 'pdf-narrative');
    p.innerHTML = '<h4>' + esc(T('윙 사이즈 추천')) + '</h4>' +
                  '<p>' + esc(T('풍향·풍속·라이더 입력이 확정되면 활성화됩니다.')) + '</p>';
    b.appendChild(p);
    page.appendChild(b);
    return page;
  }

  /* ① 표 생성 */
  b.appendChild(el('h3', 'pdf-block__h', esc(T('윙 사이즈 추천'))));
  b.appendChild(el('p', 'pdf-block__sub',
    esc(T('현재 ' + wi.currentWingM2 + ' m² · 추천 ' + wi.optimumWingM2 + ' m² · Δ ' + wi.deltaVmg.toFixed(1) + ' kt VMG'))));

  var table = el('table', 'pdf-whatif-table');
  table.innerHTML =
    '<thead><tr>' +
      '<th>윙 (m²)</th><th>VMG (kt)</th><th>Δ% (vs 현재)</th><th></th>' +
    '</tr></thead><tbody>' +
    wi.sweepPoints.map(function (p) {
      var delta = (p.vmgKt - wi.measVmgKt) / wi.measVmgKt * 100;
      var deltaColor = delta > 0.5 ? '#1FA055' : (delta < -0.5 ? '#D6453A' : '#7E93A8');
      var tag = p.isOptimum ? '🌟 최적' : p.isActual ? '현재' : p.isComfort ? '편안함' : '';
      var feasible = p.feasible !== false;
      var rowOpacity = feasible ? 1 : 0.55;
      return '<tr style="opacity:' + rowOpacity + '">' +
        '<td>' + p.area_m2.toFixed(1) + '</td>' +
        '<td>' + p.vmgKt.toFixed(1) + '</td>' +
        '<td style="color:' + deltaColor + '">' + delta.toFixed(1) + '%</td>' +
        '<td>' + esc(tag) + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody>';
  b.appendChild(table);

  /* ② Line chart 생성 — 별 canvas + Chart.js 인스턴스 */
  var chartCanvas = el('canvas', 'pdf-whatif-chart');
  chartCanvas.width = 720;
  chartCanvas.height = 280;
  b.appendChild(chartCanvas);
  // 동기 Chart.js 인스턴스 (PDF 캡처 전 완성 보장)
  var ctx = chartCanvas.getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: wi.sweepPoints.map(function (p) { return p.area_m2.toFixed(1); }),
      datasets: [{
        label: 'VMG (kt)',
        data: wi.sweepPoints.map(function (p) { return p.vmgKt; }),
        borderColor: '#1F8FFF', borderWidth: 2, tension: 0.3,
        pointRadius: wi.sweepPoints.map(function (p) {
          return p.isOptimum ? 8 : (p.isActual ? 6 : p.isComfort ? 6 : 3);
        }),
        pointBackgroundColor: wi.sweepPoints.map(function (p) {
          return p.isOptimum ? '#1FA055'
               : p.isActual ? '#0A2540'
               : p.isComfort ? '#E0A100'
               : '#1F8FFF';
        }),
        fill: false
      }]
    },
    options: {
      responsive: false,
      animation: false,
      scales: {
        x: { title: { display: true, text: '윙 사이즈 (m²)' } },
        y: { title: { display: true, text: 'VMG (kt)' }, beginAtZero: false }
      },
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            anchorLine: {
              type: 'line', yMin: wi.measVmgKt, yMax: wi.measVmgKt,
              borderColor: '#7E93A8', borderWidth: 1, borderDash: [4, 3],
              label: { content: '실측 VMG (앵커)', display: true, color: '#7E93A8' }
            }
          }
        }
      }
    }
  });

  page.appendChild(b);
  return page;
}
```

### 2-6. CSS (pdf-export.js `injectPdfStyle()` 추가)

```css
.pdf-whatif-table {
  width: 100%; border-collapse: collapse; margin: 12px 0;
  font-size: 12px;
}
.pdf-whatif-table th, .pdf-whatif-table td {
  padding: 6px 8px; text-align: left;
  border-bottom: 1px solid #E5EAF0;
}
.pdf-whatif-table th {
  background: #F4F7FA; color: #0A2540; font-weight: 700;
  font-size: 11px; text-transform: none;
}
.pdf-whatif-table td:nth-child(2),
.pdf-whatif-table td:nth-child(3) {
  text-align: right; font-variant-numeric: tabular-nums;
}
.pdf-whatif-table td:nth-child(4) {
  text-align: right; font-size: 11px;
}
.pdf-whatif-chart { max-width: 100%; height: auto; margin-top: 12px; }
```

---

## 3. Medium 4건 spec

### 3-1. p.4 고속 구간 5건 표 spec

**현재** (`pdf-export.js:592~603`) — `runsList.textContent` 추출 후 `.replace(/\s+/g, ' ').slice(0, 600)`. run-on 텍스트.

**fix** — `state.runs` 또는 `analysis.runs` 직접 접근 (state.analysis 의 run 산출치).

| column | header | data |
|---|---|---|
| # | 순위 | 인덱스 1-5 |
| 평균 (kt) | 평균 속도 | `run.avgSpeedKt.toFixed(1)` |
| 최고 (kt) | 최고 속도 | `run.maxSpeedKt.toFixed(1)` |
| 심박 (bpm) | 평균 HR | `run.avgHr ? run.avgHr + ' bpm' : '—'` |
| 시간 | duration | `run.durationStr (e.g. "7min 19sec")` |
| 거리 | 진행 거리 | `(run.distanceM / 1000).toFixed(2) + ' km'` |
| 풍향 | TWA / 점유 방향 | `run.windDir || '—'` |

**시각** — `pdf-whatif-table` 같은 CSS 패턴 재사용 (column header style + tabular-nums).

### 3-2. p.6 HR line dense + scatter messy spec

**현재** — `hr-trend-chart` canvas 의 라이브 인스턴스 직접 캡처. 라이브 dashboard 의 dense line (수천 포인트) + scatter messy 가 그대로 cascade.

**fix** — PDF 출력용 별 simplified 인스턴스:

| 차트 | 라이브 → PDF 변경 |
|---|---|
| HR trend | `pointRadius: 0` 유지 + line `borderWidth: 1.2 → 1.6` + line tension `0.3 → 0.4` (smooth) + LTTB 다운샘플 (옵션, 1000 → 200 포인트, 시각 동일) |
| HR eff scatter | `pointRadius: 3 → 4` + `pointAlpha: 1.0 → 0.6` (overlap 시 가독) + 시리즈별 linear 추세선 overlay (옵션 — `expert_dataviz_reference.md §2-11 P1`) |

**알렉스 영역 — PDF 출력 시 chart options override**:

```js
function captureHrTrendForPdf() {
  var inst = window.RDCharts && RDCharts.getHrInstance();
  if (!inst) return null;
  // 임시 options 적용 → toDataURL → 원복
  var origLW = inst.data.datasets[0].borderWidth;
  inst.data.datasets[0].borderWidth = 1.6;
  inst.update('none');
  var dataUrl = inst.canvas.toDataURL('image/png');
  inst.data.datasets[0].borderWidth = origLW;
  inst.update('none');
  return dataUrl;
}
```

### 3-3. p.7 Coach 핵심 metric callout box

**현재** (`pdf-export.js:671~696`) — coach-card 의 `<p>, <li>, <h3>...` 추출 후 `.join('<br><br>')`. 텍스트만, 시각 강조 0.

**fix** — Coach 핵심 metric 2 개를 callout box 로 분리:

| callout | content | 색 |
|---|---|---|
| **VPS 종합 점수** | "🏆 VPS 종합 72 / 100 (mid)" + 직전 세션 대비 Δ | `var(--accent)` 좌측 border 4px + `var(--accent-soft)` 배경 |
| **추천 윙** | "🌟 추천 윙 7.0 m² (+2.0 kt VMG)" or "현재 윙 적정" | `var(--good)` 좌측 border + `var(--good-soft)` 배경 |

기존 narrative text 는 callout 아래에 그대로 유지. 위계 = callout (강조) > narrative (보조).

**CSS**:

```css
.pdf-coach-callout {
  border-left: 4px solid; padding: 12px 16px; margin: 8px 0 16px;
  border-radius: 4px; font-size: 13px;
}
.pdf-coach-callout--vps {
  border-color: #1F8FFF;
  background: rgba(31,143,255,0.08);
}
.pdf-coach-callout--whatif {
  border-color: #1FA055;
  background: rgba(31,160,85,0.08);
}
.pdf-coach-callout strong { color: #0A2540; }
```

### 3-4. p.3 GPS map 너무 작음 — 알렉스 layout 영역

본인 spec 영역 X (시각 인코딩 변경 없음, layout 만). 알렉스 자율 — 풍향 박스 width 축소 + `pdf-img--map` maxHeight 확대.

---

## 4. 알렉스 implementation path 권장

### 4-1. 우선순위 + sprint 분배

| sprint | PR 항목 | ETA |
|---|---|---|
| **sprint 2-A** (P0 CRITICAL) | §2 What-if 형식 — 표 + line chart + state.whatif 직접 접근 | 2-3h |
| sprint 2-B (P1 medium) | §3-1 고속 구간 표 + §3-2 HR chart override + §3-3 Coach callout | 2-3h |
| sprint 2-C (layout) | §3-4 GPS map 확대 + 풍향 박스 축소 | 1h |

총 sprint 2 estimate **5-7h**. 알렉스 sprint 1 closure (§182 P0 fix 완료) 직후 진입 가능.

### 4-2. 알렉스 확인 항목

- `state.whatif` 접근 — `window.RDApp.getState()` 또는 module-level state 노출 방식 확인. 본 spec §2-5 pseudo code 의 fallback 패턴 검증.
- Chart.js 인스턴스 동기 렌더 — PDF 캡처 전 chart instance 완성 보장 (`responsive: false` + `animation: false` 권장).
- `html2canvas` 의 canvas 캡처 한계 — 신규 Chart.js 인스턴스가 그려진 canvas 가 html2canvas 의 cross-origin 제약 통과해야 (`canvas.toDataURL` 직접 사용 권장, html2canvas 우회).
- self-test 갱신 — `selftest-pdf-render.js` 에 What-if 표 + line chart 존재 확인 case 추가.

### 4-3. 신규 hex / 토큰 영향

- **신규 hex 0건** — chart-theme 토큰 100% 재사용 (status / accent / good / warn / bad).
- **CSS 토큰** — `pdf-export.js` `injectPdfStyle()` 안에 추가만. 라이브 dashboard CSS 영향 0.
- **로즈 윤 (#1) 영역 영향 0** — 토큰 변경 없음.

---

## 5. WIP slot 영향 + 본인 영역 분리

| WIP slot | 현황 | 본 spec 영향 |
|---|---|---|
| (1) `dataviz_pr_dashboard_contributions.md` push 대기 | commit-ready | 변경 0 |
| (2) `dataviz_polish_p1_spec.md` standby work | 미작성 (티모 confirm 대기) | 변경 0 |
| (3) 6 metric chart system extension | 티모 confirm 대기 | 변경 0 |
| **(신규) dataviz_pdf_report_fix_spec.md** | **본 문서 — 옥대표님 trigger 로 추가** | **commit-ready · push 대기** |

WIP limit 3 위반 — 본인이 옥대표님 trigger 받아 (4) 신규 추가. CoS 결정 가능:
- **옵션 a** — (2) `dataviz_polish_p1_spec.md` 보류 (티모 confirm 도착할 때까지 미작성 = 작업 X = WIP slot 점유 X) → 4 슬롯이지만 실제 active 3
- **옵션 b** — (1) push 우선 처리 (옥대표님 push 신호 후 slot 비움) → 본 신규 spec 으로 채움

본인 권장 = **옵션 a**. (2) 는 의미상 "대기" 라 active 아님.

---

## 6. Sources

**프로젝트 내부 (코드 직접 열람)**
- `site/riding-dashboard/js/pdf-export.js` line 580~723 (P4 / P5 / P6 / P7 / P8 빌더)
- `site/riding-dashboard/js/app.js` line 3948~3958 (`state.whatif` 갱신) · line 4400~4505 (sweep-row DOM 구조)
- `site/riding-dashboard/js/coach.js` line 337~510 (`computeWhatIf()` schema)
- `site/riding-dashboard/js/charts.js` (본인 6/5 라이브 fix `speedColor → statusAt`)
- `_experts/expert_dataviz_reference.md` §2-11 (HR eff 추세선 P1 권장)
- `_experts/dataviz_pr_dashboard_contributions.md` (시스템 A 다크 cockpit 토큰 패턴, 본 spec 의 라이트 모드 PDF 와 별 영역)

**외부 reference**
- Tufte, *The Visual Display of Quantitative Information* — 연속 함수 = 선 우선 (§2-4 line chart 결정)
- Chart.js 4.x docs · chartjs-plugin-annotation 3.x
- jsPDF 2.5.1 · html2canvas 1.4.1 (`pdf-export.js` 직접 명시)

---

_Last updated: 2026-06-05_
_Phase 2 sprint 2 PDF fix spec — 알렉스 박 (#4) implementation 대기. 옥대표님 추가 GO 신호 후 진입. 본인 시각 검증 round standby._
