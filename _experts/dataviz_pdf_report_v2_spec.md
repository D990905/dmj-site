# dataviz_pdf_report_v2_spec.md — 라이딩 분석 보고서 PDF v2 전면 재설계 spec

| 항목 | 내용 |
|---|---|
| 문서 유형 | Lead Spec — implementation-ready (Chart.js config · CSS token · DOM data-* hook · pseudo-code) |
| Lead owner | 샘 정 (Sam Jung, DataViz #2) · 2026-06-05 |
| 트리거 | 옥대표님 직접 directive *"보고서 다시 제대로 작업하라"* (38/100 PDF v1 → v2 재설계) |
| 본인 회복 | 자가 평가 30/100 회복 — `sam_pdf_report_evaluation_2026-06-05.md` §7-6 약속의 #2 산출물 |
| 협업 prerequisites | 티모 (Sports Science — Top 3 metric + 학술 ref) · 메이 (UX — narrative arc) · 로즈 (Visual — typography hierarchy) · 알렉스 (Frontend — implementation 후순위) |
| 산출 | implementation-ready spec, 알렉스가 받아서 그대로 빌드 가능 수준 |
| ETA | 본인 단독 spec = 4-6h · 알렉스 implementation = 5-7h |

> **읽는 법.** §0 = TL;DR + v1 → v2 변경 표. §1 = 5 영역 합의 사항 (5 전문가 공통) · §2 = 토큰 시스템 reference. **§3 = Phase 0 Executive Summary 페이지 (P0 CRITICAL)** · **§4 = Phase 1 Comparison context (P0)** · **§5 = Phase 2 Recommendation callout (P0)** · **§6 = Phase 3 Caption + Limitations + estimate/measured flag (P1)**. §7 = 페이지별 v2 구조 (12p). §8 = 알렉스 implementation path. §9 = 협업 chain prerequisites. §10 = sources.

---

## 0. TL;DR

### 0-1. v1 38/100 → v2 목표 80+/100

| 영역 (v1 점수) | v2 회복 path | 본 spec § |
|---|---|---|
| Chart 디자인 (55) | estimate/measured flag + caption 추가 | §6 |
| **Information design (25)** | **Executive Summary 페이지 신규 + narrative arc + hero callout** | **§3 + §7** |
| **Comparative context (10)** | **vs baseline delta chip + sparkline + dashed overlay** | **§4** |
| **Actionable recommendation (30)** | **3-chip callout (✓ 강점 · ⚠ 개선 · ★ 권장)** | **§5** |
| Data-honesty (50) | estimate flag 시각 인코딩 + per-chart limitation | §6 |

목표 합산 = 38 → 80 (+42점). P0 3건 (§3·§4·§5) 채택 시 -38 회복, P1 §6 추가 시 +4 보강 = **목표 82/100**.

### 0-2. v1 vs v2 구조 변경표

| p | v1 (현재) | v2 (재설계) | 변경 사유 |
|---|---|---|---|
| 1 | Cover | Cover (brand identity 적용 — 로즈 brand_color_spec) | brand 일관성 |
| **2** | Summary KPI (평면 grid) | **★ Executive Summary** (Grade chip + Top 3 highlight + Top 1 next-action) | **30초 핵심 파악** |
| 3 | GPS map + 풍향 (풍향 박스 큼) | GPS map (확대) + 풍향 (사이드 chip) + caption | 시각 hierarchy |
| 4 | 속도 시계열 + 분포 pie + 고속구간 (textContent dump) | 속도 시계열 + 분포 pie + **고속 구간 표** + caption | textContent 종결 |
| 5 | 폴라 + 바이올린 | 폴라 + **best overlay dashed** + 바이올린 + caption | comparison context |
| 6 | HR trend + zone + eff (dense) | HR trend (LTTB 다운샘플) + zone (라벨) + eff (추세선) + caption | data-ink |
| 7 | Coach narrative (텍스트만) | Coach narrative + **★ Recommendation callout 3-chip** | actionable |
| **8** | What-if (run-on text) | **★ What-if 표 + line chart** (`dataviz_pdf_report_fix_spec.md §2` 적용) | CRITICAL fix |
| 9 | Appendix | Appendix + **per-chart limitation 명시** | data-honesty |
| **10** | (v1 미확정) | **★ Season trend** (12 세션 sparkline grid + 진도 % rank) | comparison |
| **11** | (v1 미확정) | **★ Next sprint plan** (티모 학술 ref 기반 3 metric 목표) | actionable |
| 12 | (v1 미확정) | Footer (생성일 · 보고서 ID · 단무지 brand mark) | brand 일관성 |

**★ 표시 = v2 신규 / 전면 재설계 핵심**. P0 = §3+§4+§5+§7-p8.

### 0-3. 토큰·신규 hex 정책

- **신규 hex = 0건**. 기존 chart-theme.js statusAt 5 앵커 + 시스템 A 다크 토큰 (admin/dashboard) + style.css 메인 사이트 토큰 100% 재사용.
- OKLCH 보간 업그레이드는 별 spec (`expert_dataviz_reference.md §3-4`) — v2 첫 ship 후 검토.

---

## 1. 5 전문가 합의 사항 (전제)

본 spec 의 4 Phase 는 5 전문가 합의 핵심 진단 반영:

1. **Narrative arc 부재** (메이 + 로즈 + 본인 합의) — 각 페이지 isolated, story 0
2. **Executive Summary 부재** (본인 + 메이 + 캔 합의) — 30초 핵심 파악 불가
3. **Comparison 부재** (본인 + 티모 합의) — 베이스라인·이전 세션·시즌 0
4. **Actionable recommendation 부재** (티모 + 메이 + 본인 합의) — Coach narrative 만, 다음 행동 명시 0
5. **화면 그대로 갖다 붙임** (옥대표님 verbatim, 5 전문가 정확 인정) — Tufte / Few 의 "data 가 자기 story 를 말하는가" 원칙 위반

→ Phase 0 (Executive Summary) + Phase 1 (Comparison) + Phase 2 (Recommendation) = **3건 P0** 즉시 적용 시 5/5 합의 항목 해결. Phase 3 (Caption + Limitations) = P1 보강.

---

## 2. 토큰 시스템 reference (구현 anchor)

### 2-1. 라이트 모드 (PDF 출력 = 라이트)

```js
// chart-theme.js — statusAt 5 앵커 (5/27 작성, 6/5 라이브 fix 후 통일)
const STATUS = {
  veryGood: '#1FA055',   // 매우좋음
  good:     '#7FC241',   // 좋음
  mid:      '#F2C20E',   // 보통
  bad:      '#EC8A2E',   // 나쁨
  veryBad:  '#D6453A'    // 매우나쁨
};

const BASE = {
  ink:       '#5C6F7E',           // 축 눈금·범례
  inkStrong: '#0A2540',           // 강조 라벨 (navy)
  inkDim:    '#6E7C8A',           // 보조·캡션
  grid:      'rgba(10,37,64,0.07)',
  line:      '#0A2540',           // 기본 line (navy)
  fill:      'rgba(31,143,255,0.10)'
};

const SIDE = {
  port:        '#E12B2B',  // 포트 (좌)
  starboard:   '#00A651',  // 스타보드 (우)
  portInk:     '#C42121',
  starboardInk:'#0B7C44'
};
```

### 2-2. PDF 전용 추가 토큰 (CSS)

```css
/* 본 spec 의 신규 CSS 토큰 — pdf-export.js injectPdfStyle() 추가 */
:root {
  /* status soft 배경 — callout / chip 용 */
  --pdf-good-soft: rgba(31,160,85,0.10);
  --pdf-warn-soft: rgba(224,161,0,0.10);
  --pdf-bad-soft: rgba(214,69,58,0.10);
  --pdf-accent-soft: rgba(31,143,255,0.08);
  --pdf-text-soft: rgba(126,147,168,0.10);

  /* Grade chip — 큰 letter */
  --pdf-grade-A: #1FA055;
  --pdf-grade-B: #7FC241;
  --pdf-grade-C: #F2C20E;
  --pdf-grade-D: #EC8A2E;
  --pdf-grade-F: #D6453A;

  /* estimate flag */
  --pdf-estimate-line: #7E93A8;  /* 회색 */
  --pdf-estimate-dash: 4 3;       /* dashed pattern */
  --pdf-estimate-opacity: 0.6;

  /* measured flag */
  --pdf-measured-line: #0A2540;   /* navy */
  --pdf-measured-opacity: 1.0;
}
```

### 2-3. Grade chip 매핑

| Grade | Score | hex 토큰 | 의미 |
|---|---|---|---|
| **A** | 85+ | `--pdf-grade-A` `#1FA055` | 우수 (veryGood) |
| **B** | 70-84 | `--pdf-grade-B` `#7FC241` | 양호 (good) |
| **C** | 55-69 | `--pdf-grade-C` `#F2C20E` | 보통 (mid) |
| **D** | 40-54 | `--pdf-grade-D` `#EC8A2E` | 미흡 (bad) |
| **F** | <40 | `--pdf-grade-F` `#D6453A` | 부족 (veryBad) |

본인 영역 = score → grade 변환 함수 + 색 매핑. 임계값 (85/70/55/40) = 본인 권장, **티모 학술 ref 검증 필요** (Sports Science 영역 점수 분포 normality 확인).

---

## 3. ★ Phase 0 — Executive Summary 페이지 (P0 CRITICAL)

### 3-1. 위치 + 목적

- **위치**: p.2 (Cover 다음, 모든 details 전)
- **목적**: 30초 안 핵심 파악. Few _Information Dashboard Design_ ch.3 "one screen, one decision" 원칙.
- **사용자**: 옥대표님 본인 + 외부 stakeholder (코치·후원사 등) 첫 시야.

### 3-2. Layout — 세로 3-zone

```
┌─────────────────────────────────────────┐
│  Executive Summary                       │  ← 페이지 헤더
├─────────────────────────────────────────┤
│                                          │
│   ┌──────┐    오늘 세션 Grade            │  ← Zone 1 (40% 높이)
│   │      │    [B+] 78 / 100              │     Grade chip (큰)
│   │  B   │    Top: 평균 대비 +12% 빠름   │     + verdict 한 줄
│   │      │                                │
│   └──────┘                                │
│                                          │
├─────────────────────────────────────────┤
│                                          │
│   Top 3 Highlights                       │  ← Zone 2 (40% 높이)
│                                          │
│   ✓ 평균 속도 18.7 kt (시즌 top 15%)    │
│   ✓ 회전 효율 88% (시즌 +8%p)            │
│   ⚠ 우현 풍하 VMG 65% target (개선)     │
│                                          │
├─────────────────────────────────────────┤
│                                          │
│   ★ 다음 세션 (1줄)                       │  ← Zone 3 (20% 높이)
│                                          │
│   "14kt 임계 5분 유지 + 우현 자이브       │
│    -2초 손실 목표"                        │
│                                          │
└─────────────────────────────────────────┘
```

### 3-3. Zone 1 — Grade chip + verdict

#### 3-3-1. Grade chip 시각 spec

```html
<div class="pdf-grade-chip" data-grade="B">
  <span class="pdf-grade-chip__letter">B</span>
  <span class="pdf-grade-chip__score">78 / 100</span>
  <span class="pdf-grade-chip__label">오늘 세션</span>
</div>
```

```css
.pdf-grade-chip {
  display: inline-flex;
  align-items: center;
  gap: 16px;
  padding: 20px 28px;
  border-radius: 12px;
  border-left: 8px solid;          /* grade 색 */
  background: var(--pdf-text-soft);
}
.pdf-grade-chip[data-grade="A"] { border-color: var(--pdf-grade-A); background: var(--pdf-good-soft); }
.pdf-grade-chip[data-grade="B"] { border-color: var(--pdf-grade-B); background: rgba(127,194,65,0.10); }
.pdf-grade-chip[data-grade="C"] { border-color: var(--pdf-grade-C); background: var(--pdf-warn-soft); }
.pdf-grade-chip[data-grade="D"] { border-color: var(--pdf-grade-D); background: rgba(236,138,46,0.10); }
.pdf-grade-chip[data-grade="F"] { border-color: var(--pdf-grade-F); background: var(--pdf-bad-soft); }

.pdf-grade-chip__letter {
  font-size: 64px;                  /* hero size */
  font-weight: 800;
  line-height: 1;
  color: var(--ink);
}
.pdf-grade-chip[data-grade="A"] .pdf-grade-chip__letter { color: var(--pdf-grade-A); }
.pdf-grade-chip[data-grade="B"] .pdf-grade-chip__letter { color: var(--pdf-grade-B); }
.pdf-grade-chip[data-grade="C"] .pdf-grade-chip__letter { color: var(--pdf-grade-C); }
.pdf-grade-chip[data-grade="D"] .pdf-grade-chip__letter { color: var(--pdf-grade-D); }
.pdf-grade-chip[data-grade="F"] .pdf-grade-chip__letter { color: var(--pdf-grade-F); }

.pdf-grade-chip__score {
  font-size: 24px;
  font-weight: 700;
  color: var(--ink-strong);
}
.pdf-grade-chip__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}
```

#### 3-3-2. Score → Grade 변환 함수

```js
function scoreToGrade(score) {
  if (score >= 85) return { letter: 'A', tone: 'veryGood' };
  if (score >= 70) return { letter: 'B', tone: 'good' };
  if (score >= 55) return { letter: 'C', tone: 'mid' };
  if (score >= 40) return { letter: 'D', tone: 'bad' };
  return { letter: 'F', tone: 'veryBad' };
}
```

**데이터 source** — `state.vps.overall.score` (`coach.js:computeVPS` 산출).

#### 3-3-3. Verdict 한 줄 — dynamic

**예시** (state.vps.overall + state.session.summary 기반):

| 조건 | verdict 템플릿 |
|---|---|
| score ≥ 85 + 시즌 top 10% | "오늘 = 시즌 베스트급 (top {pct}%)" |
| score 70-84 + delta vs 평균 > +10% | "오늘 = 시즌 평균 대비 +{deltaPct}% 빠름" |
| score 55-69 | "오늘 = 시즌 평균 수준 ({rankPct}th percentile)" |
| score 40-54 | "오늘 = 시즌 평균 미달 — {improvedMetric} 개선 필요" |
| score < 40 | "오늘 = 풍속·컨디션 한계 — {limitFactor} 영향" |

**Pseudo-code**:

```js
function buildVerdict(vps, history) {
  if (!vps || !vps.overall) return '데이터 부족 — 풍향 확정 필요';
  const score = vps.overall.score;
  const seasonAvg = mean(history.map(h => h.vps));
  const deltaPct = ((score - seasonAvg) / seasonAvg * 100).toFixed(0);
  const rank = percentileRank(history.map(h => h.vps), score);

  if (score >= 85) return `오늘 = 시즌 베스트급 (top ${100 - rank}%)`;
  if (score >= 70 && deltaPct > 10) return `오늘 = 시즌 평균 대비 +${deltaPct}% 빠름`;
  if (score >= 55) return `오늘 = 시즌 평균 수준 (${rank}th percentile)`;
  if (score >= 40) return `오늘 = 시즌 평균 미달 — 회전 효율 개선 필요`;
  return `오늘 = 풍속·컨디션 한계`;
}
```

**티모 협업 필요** — verdict 템플릿의 학술 정합성 (예: percentile rank vs z-score 어느 게 코칭에 더 정합?). Pre-spec ping `messages.md` (§9).

### 3-4. Zone 2 — Top 3 Highlights

#### 3-4-1. 시각 spec

```html
<ul class="pdf-highlights">
  <li class="pdf-highlight pdf-highlight--good">
    <span class="pdf-highlight__icon">✓</span>
    <span class="pdf-highlight__metric">평균 속도 18.7 kt</span>
    <span class="pdf-highlight__context">(시즌 top 15%)</span>
  </li>
  <li class="pdf-highlight pdf-highlight--good">
    <span class="pdf-highlight__icon">✓</span>
    <span class="pdf-highlight__metric">회전 효율 88%</span>
    <span class="pdf-highlight__context">(시즌 +8%p)</span>
  </li>
  <li class="pdf-highlight pdf-highlight--warn">
    <span class="pdf-highlight__icon">⚠</span>
    <span class="pdf-highlight__metric">우현 풍하 VMG 65% target</span>
    <span class="pdf-highlight__context">(개선 권장)</span>
  </li>
</ul>
```

```css
.pdf-highlights { list-style: none; padding: 0; margin: 24px 0; }
.pdf-highlight {
  display: flex; align-items: baseline; gap: 12px;
  padding: 12px 16px; margin-bottom: 8px;
  border-radius: 8px;
  border-left: 4px solid;
}
.pdf-highlight--good { border-color: var(--pdf-grade-A); background: var(--pdf-good-soft); }
.pdf-highlight--warn { border-color: var(--pdf-grade-C); background: var(--pdf-warn-soft); }
.pdf-highlight--bad { border-color: var(--pdf-grade-F); background: var(--pdf-bad-soft); }

.pdf-highlight__icon {
  flex: 0 0 20px;
  font-size: 18px; font-weight: 700;
  color: var(--pdf-grade-A);
}
.pdf-highlight--warn .pdf-highlight__icon { color: var(--pdf-grade-C); }
.pdf-highlight--bad .pdf-highlight__icon { color: var(--pdf-grade-F); }

.pdf-highlight__metric { font-size: 14px; font-weight: 700; color: var(--ink); }
.pdf-highlight__context { font-size: 12px; color: var(--ink-dim); }
```

#### 3-4-2. Top 3 metric 선택 logic

**티모 영역 (Sports Science) — Lead**. 본인은 시각 인코딩만.

**티모 권장 Top 3 metric set** (Pre-spec ping):
1. **평균 속도** (kt) — `state.analysis.summary.avgSpeedMs` + percentile vs season
2. **회전 효율** (%) — `state.analysis.maneuvers.efficiencyOverall` + delta vs season
3. **VMG % of target** — `state.analysis.polar.vmgVsTarget` + 풍상/풍하 worse side

**대안 metric pool** (티모 confirm 시):
- 최고 속도 (kt)
- 총 거리 (km)
- HR Z3+ 비중 (%)
- 회전 스무스함 (1-pass %)
- 윙 사이즈 적정도 (current vs whatif.optimumWingM2)

**Logic** — 3 metric 중 1 strong / 1 strong / 1 weak 권장 (긍정 2 + 개선 1 의 균형). 티모 학술 ref 필요 (positive vs constructive feedback ratio — sports psychology).

**Pseudo-code** (`pdf-export.js` 신규):

```js
function buildTop3Highlights(analysis, vps, history) {
  const candidates = [
    {
      metric: '평균 속도',
      value: (analysis.summary.avgSpeedMs * KT).toFixed(1) + ' kt',
      score: rankScore(history.map(h => h.avgSpeed), analysis.summary.avgSpeedMs),
      direction: 'higher'
    },
    {
      metric: '회전 효율',
      value: (analysis.maneuvers.efficiencyOverall * 100).toFixed(0) + '%',
      score: analysis.maneuvers.efficiencyOverall * 100,
      direction: 'higher'
    },
    {
      metric: 'VMG % of target',
      value: (vps.upwind.vmgPct * 100).toFixed(0) + '% target',
      score: vps.upwind.vmgPct * 100,
      direction: 'higher'
    },
    // ... more candidates
  ];

  // 정렬: score 높은 2 (good) + score 낮은 1 (improve)
  const goods = candidates.filter(c => c.score >= 70).sort((a, b) => b.score - a.score).slice(0, 2);
  const weak = candidates.filter(c => c.score < 70).sort((a, b) => a.score - b.score)[0];

  return [...goods, weak].filter(Boolean);
}
```

### 3-5. Zone 3 — Top 1 next-action

#### 3-5-1. 시각 spec

```html
<div class="pdf-next-action">
  <span class="pdf-next-action__label">★ 다음 세션</span>
  <p class="pdf-next-action__text">
    14kt 임계 5분 유지 + 우현 자이브 -2초 손실 목표
  </p>
</div>
```

```css
.pdf-next-action {
  margin-top: 24px;
  padding: 16px 20px;
  border-radius: 10px;
  background: var(--pdf-accent-soft);
  border: 1px solid rgba(31,143,255,0.30);
}
.pdf-next-action__label {
  display: block;
  font-size: 11px; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--sea);
  margin-bottom: 6px;
}
.pdf-next-action__text {
  margin: 0;
  font-size: 16px; font-weight: 600;
  color: var(--ink);
  line-height: 1.4;
}
```

#### 3-5-2. Next-action 생성 logic

**티모 영역 (Sports Science) — Lead**. 본인은 시각 인코딩만.

**티모 권장 next-action 카테고리** (Pre-spec ping):
- **Speed** — "{threshold}kt 임계 {duration}분 유지"
- **Maneuver** — "{side} {type} -{loss}초 손실 목표"
- **HR** — "Z3+ 비중 {pct}% 이상 유지"
- **Equipment** — "윙 {size}㎡ 시도 (What-if optimum)"

**Logic** — Top 3 highlights 의 weakest 가 next-action 직결. 예: highlight 3 = "우현 풍하 VMG 65%" → next-action = "우현 자이브 -2초 손실 목표".

**Pseudo-code**:

```js
function buildNextAction(highlights, whatif) {
  const weakest = highlights[highlights.length - 1];  // Top 3 의 마지막 = weak
  if (!weakest) return '풍향 확정 시 활성화';

  // Metric → action 매핑
  const actionMap = {
    '우현 풍하 VMG': `우현 자이브 -${calcLossTarget(weakest)}초 손실 목표`,
    '평균 속도': `${calcSpeedThreshold(weakest)}kt 임계 5분 유지`,
    '회전 효율': `1-pass 회전 비중 ${calcSmoothTarget(weakest)}% 이상`,
    // ...
  };
  return actionMap[weakest.metric] || `${weakest.metric} 개선`;
}
```

**티모 학술 ref 필요** — SMART goal 원칙 (Specific Measurable Achievable Relevant Time-bound) 적용 권장.

### 3-6. Phase 0 buildExecutiveSummary() pseudo code

```js
function buildExecutiveSummary(page) {
  const vps = state.vps;
  const analysis = state.analysis;
  const history = state.history || [];
  const whatif = state.whatif;

  if (!vps || !vps.overall) {
    // 풍향 미확정 fallback
    const ph = el('div', 'pdf-placeholder');
    ph.textContent = '풍향 확정 후 Executive Summary 활성화';
    page.appendChild(ph);
    return page;
  }

  const score = vps.overall.score;
  const grade = scoreToGrade(score);

  // Zone 1 — Grade chip + verdict
  const z1 = el('div', 'pdf-exec-zone1');
  z1.innerHTML =
    '<div class="pdf-grade-chip" data-grade="' + grade.letter + '">' +
      '<span class="pdf-grade-chip__letter">' + grade.letter + '</span>' +
      '<span class="pdf-grade-chip__score">' + score + ' / 100</span>' +
      '<span class="pdf-grade-chip__label">오늘 세션</span>' +
    '</div>' +
    '<p class="pdf-exec-verdict">' + esc(buildVerdict(vps, history)) + '</p>';
  page.appendChild(z1);

  // Zone 2 — Top 3 highlights
  const highlights = buildTop3Highlights(analysis, vps, history);
  const z2 = el('div', 'pdf-exec-zone2');
  z2.appendChild(el('h3', 'pdf-block__h', 'Top 3 Highlights'));
  const ul = el('ul', 'pdf-highlights');
  ul.innerHTML = highlights.map(h => {
    const tone = h.score >= 70 ? 'good' : (h.score >= 40 ? 'warn' : 'bad');
    const icon = tone === 'good' ? '✓' : (tone === 'warn' ? '⚠' : '✗');
    return '<li class="pdf-highlight pdf-highlight--' + tone + '">' +
      '<span class="pdf-highlight__icon">' + icon + '</span>' +
      '<span class="pdf-highlight__metric">' + esc(h.metric + ' ' + h.value) + '</span>' +
      '<span class="pdf-highlight__context">' + esc('(' + h.contextLabel + ')') + '</span>' +
    '</li>';
  }).join('');
  z2.appendChild(ul);
  page.appendChild(z2);

  // Zone 3 — Next action
  const z3 = el('div', 'pdf-exec-zone3');
  z3.innerHTML =
    '<div class="pdf-next-action">' +
      '<span class="pdf-next-action__label">★ 다음 세션</span>' +
      '<p class="pdf-next-action__text">' + esc(buildNextAction(highlights, whatif)) + '</p>' +
    '</div>';
  page.appendChild(z3);

  return page;
}
```

### 3-7. Phase 0 검증 — 30초 인지 테스트

본인 권장 — 메이 한 (#5 UX) 협업으로 다음 검증:
- 사용자 5명 (옥대표님 + 동급 라이더 4) 에게 Executive Summary 페이지 30초 시각 후 다음 답 가능 확인:
  - Q1: 오늘 세션 등급 (A~F) — 정답률 100% 목표
  - Q2: 강점 1개 — 정답률 80%+ 목표
  - Q3: 개선 1개 — 정답률 80%+ 목표
  - Q4: 다음 행동 1개 — 정답률 70%+ 목표

NN/g (Nielsen Norman Group) 30초 인지 임계 = 4 question 의 평균 답 시간 ≤ 30초 / 정답률 ≥ 80%.

---

## 4. ★ Phase 1 — Comparison context 전 페이지 도입 (P0)

### 4-1. 4 영역 적용

| 영역 | 시각 | 위치 |
|---|---|---|
| **VPS 카드 vs baseline delta chip** | "+12%" chip (색 = status ramp) | Executive Summary + p.7 Coach |
| **Sparkline 시즌 추세 12 세션** | inline SVG 120×20px | Executive Summary Zone 1 + KPI 카드 옆 |
| **폴라 dashed overlay (best polar)** | 점선 ramp (dim 색) | p.5 폴라 |
| **속도 시계열 시즌 평균 reference line** | dashed horizontal line | p.4 속도 시계열 |

### 4-2. vs baseline delta chip

#### 4-2-1. 시각 spec

```html
<span class="pdf-delta-chip" data-tone="good">
  <span class="pdf-delta-chip__arrow">↑</span>
  <span class="pdf-delta-chip__value">+12%</span>
  <span class="pdf-delta-chip__base">vs 시즌 평균</span>
</span>
```

```css
.pdf-delta-chip {
  display: inline-flex; align-items: baseline; gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px; font-weight: 700;
  vertical-align: middle;
}
.pdf-delta-chip[data-tone="good"] { background: var(--pdf-good-soft); color: var(--pdf-grade-A); }
.pdf-delta-chip[data-tone="mid"] { background: var(--pdf-warn-soft); color: var(--pdf-grade-C); }
.pdf-delta-chip[data-tone="bad"] { background: var(--pdf-bad-soft); color: var(--pdf-grade-F); }

.pdf-delta-chip__arrow { font-size: 9px; }
.pdf-delta-chip__base {
  font-weight: 500; opacity: 0.8;
  font-size: 10px;
  margin-left: 2px;
}
```

#### 4-2-2. Baseline 3 종류

| Baseline | 산출 | tone 결정 |
|---|---|---|
| 시즌 평균 | mean(history.vps) | delta > +10% = good · -10%~+10% = mid · < -10% = bad |
| 직전 세션 | history[-1].vps | delta > +5% = good · -5%~+5% = mid · < -5% = bad |
| 개인 best | max(history.vps) | always mid (best = 100% reference) |

**기본 = 시즌 평균** (가장 안정적 baseline). 옥대표님이 옵션으로 toggle 가능.

### 4-3. Sparkline 시즌 추세

#### 4-3-1. 시각 spec — Tufte sparkline 정통

```html
<svg class="pdf-sparkline" viewBox="0 0 120 20" xmlns="...">
  <polyline points="0,15 10,13 20,14 30,11 40,10 50,8 60,9 70,7 80,6 90,5 100,4 110,3 120,2"
            stroke="var(--accent-2)" stroke-width="1.5" fill="none"/>
  <circle cx="120" cy="2" r="2.5" fill="var(--sun)"/>  <!-- latest endpoint -->
  <circle cx="60" cy="9" r="1.8" fill="var(--ink-dim)"/>  <!-- median marker (optional) -->
</svg>
```

```css
.pdf-sparkline {
  display: inline-block;
  vertical-align: middle;
  width: 120px;
  height: 20px;
  margin-left: 6px;
}
```

#### 4-3-2. Sparkline build logic

```js
function buildSparkline(history, metricKey) {
  const SPAN_WEEKS = 12;
  const series = history.slice(-SPAN_WEEKS).map(h => h[metricKey]);
  if (series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const W = 120, H = 20;
  const pad = 2;
  const stepX = (W - pad * 2) / (series.length - 1);
  const range = (max - min) || 1;

  const pts = series.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');

  const latest = series[series.length - 1];
  const latestY = pad + (1 - (latest - min) / range) * (H - pad * 2);

  return `<svg class="pdf-sparkline" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<polyline points="${pts}" stroke="var(--accent-2)" stroke-width="1.5" fill="none"/>` +
    `<circle cx="${W - pad}" cy="${latestY.toFixed(1)}" r="2.5" fill="var(--sun)"/>` +
    `</svg>`;
}
```

#### 4-3-3. 위치 — KPI 카드 옆

p.2 Executive Summary 의 Zone 1 verdict 끝 + Zone 2 의 각 highlight metric 옆 inline.

### 4-4. 폴라 dashed overlay (best polar)

#### 4-4-1. 데이터 source

`state.target.bins` — `expert_dataviz_reference.md §4-2 Target Polar overlay` 권장. 본인이 5/27 권장 후 6/5 까지 implementation 0건. **v2 spec 에서 명시 적용**.

**Best polar 산출**:

```js
function computeBestPolar(allSessions, twaBin = 7.5) {
  const bins = [];
  for (let twa = 0; twa <= 180; twa += twaBin) {
    const speeds = [];
    allSessions.forEach(s => {
      const sample = s.polar.bins.find(b => Math.abs(b.twaCenter - twa) < twaBin / 2);
      if (sample && sample.count >= 5) speeds.push(sample.p95Ms);
    });
    if (speeds.length >= 3) {
      bins.push({ twaCenter: twa, speedMs: Math.max(...speeds), count: speeds.length });
    }
  }
  return { bins, source: 'season-best', generated_at: new Date().toISOString() };
}
```

#### 4-4-2. 시각 — 라이브 renderTargetPolar 와 동일 패턴

`charts.js:1818~2061` 의 `renderTargetPolar()` 이 이미 `target` slot 지원. data 만 공급하면 자동 렌더. **PDF 도 동일 — canvas capture 가 자동 cascade**.

PDF 추가 작업 = 0 (`canvasToDataURL('target-polar-canvas')` 가 이미 라이브 차트 캡처). 단 라이브 dashboard 의 `state.target.bins` 가 채워져야 — `app.js` 수정 필요 (알렉스 영역).

### 4-5. 속도 시계열 시즌 평균 reference line

#### 4-5-1. 시각

`charts.js renderSpeedChart()` 에 Chart.js annotation plugin reference line 추가:

```js
// renderSpeedChart options.plugins.annotation 추가
annotations: {
  seasonAvg: {
    type: 'line',
    yMin: avgSpeedSeasonKt,
    yMax: avgSpeedSeasonKt,
    borderColor: 'rgba(126,147,168,0.6)',
    borderWidth: 1,
    borderDash: [4, 3],
    label: {
      content: '시즌 평균 ' + avgSpeedSeasonKt.toFixed(1) + 'kt',
      display: true,
      position: 'end',
      color: '#7E93A8',
      font: { size: 10 }
    }
  }
}
```

#### 4-5-2. 라이브 dashboard 영향

알렉스 영역 cross-cut — 라이브에 reference line 추가 시 PDF 도 자동 cascade. **Pre-spec ping `messages.md`** 필요.

---

## 5. ★ Phase 2 — Recommendation callout box (P0)

### 5-1. 위치 + 형태

- **위치**: p.7 Coach 페이지 상단 (Coach narrative 위)
- **형태**: 3 chip 가로 grid

### 5-2. 3 chip 시각 spec

```html
<div class="pdf-rec-callouts">
  <div class="pdf-rec pdf-rec--good">
    <span class="pdf-rec__icon">✓</span>
    <span class="pdf-rec__label">강점</span>
    <p class="pdf-rec__text">평균 속도 18.7 kt · 시즌 top 15%</p>
  </div>
  <div class="pdf-rec pdf-rec--warn">
    <span class="pdf-rec__icon">⚠</span>
    <span class="pdf-rec__label">개선</span>
    <p class="pdf-rec__text">우현 자이브 -3초 손실 · 좌현 대비 +12%</p>
  </div>
  <div class="pdf-rec pdf-rec--accent">
    <span class="pdf-rec__icon">★</span>
    <span class="pdf-rec__label">다음 세션</span>
    <p class="pdf-rec__text">14kt 임계 5분 유지 + 우현 자이브 1-pass 비중 ↑</p>
  </div>
</div>
```

```css
.pdf-rec-callouts {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin: 16px 0 24px;
}
.pdf-rec {
  padding: 14px 16px;
  border-radius: 10px;
  border-left: 4px solid;
}
.pdf-rec--good { border-color: var(--pdf-grade-A); background: var(--pdf-good-soft); }
.pdf-rec--warn { border-color: var(--pdf-grade-C); background: var(--pdf-warn-soft); }
.pdf-rec--accent { border-color: var(--sea); background: var(--pdf-accent-soft); }

.pdf-rec__icon {
  font-size: 16px; font-weight: 700;
  display: inline-block;
  margin-right: 4px;
}
.pdf-rec--good .pdf-rec__icon { color: var(--pdf-grade-A); }
.pdf-rec--warn .pdf-rec__icon { color: var(--pdf-grade-C); }
.pdf-rec--accent .pdf-rec__icon { color: var(--sea); }

.pdf-rec__label {
  font-size: 11px; font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink-dim);
}
.pdf-rec__text {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  line-height: 1.4;
}
```

### 5-3. 3 chip content 생성 logic

**티모 영역 (Sports Science) — Lead**. 본인은 시각 인코딩 + 색 매핑만.

**티모 권장** (Pre-spec ping):
- **강점** = Top 3 highlights 의 strongest (Phase 0 Zone 2 의 1번째)
- **개선** = Top 3 highlights 의 weakest (Phase 0 Zone 2 의 3번째)
- **다음 세션** = Phase 0 Zone 3 의 next-action

→ Phase 0 의 결과 재사용 (data consistency).

### 5-4. Limitations footnote (Phase 2 P1)

Coach 페이지 끝에 작은 chip:

```html
<p class="pdf-coach-limitations">
  ⓘ <strong>제한점</strong> — 풍향 추정 신뢰도: 보통 (no-go zone 방식, reaching 일색 세션은 신뢰도 낮음 가능)
</p>
```

```css
.pdf-coach-limitations {
  margin-top: 20px;
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--pdf-text-soft);
  font-size: 11px;
  color: var(--ink-dim);
  line-height: 1.5;
}
.pdf-coach-limitations strong { color: var(--ink); }
```

---

## 6. Phase 3 — Caption + Limitations + estimate/measured flag (P1)

### 6-1. Caption — "이 차트가 말하는 것" 1줄

각 차트 (p.3~p.6, p.8) 아래에 dynamic caption.

#### 6-1-1. 시각

```html
<p class="pdf-chart-caption">
  <strong>오늘 60% 시간을 16~20kt 영역에서 유지</strong> — 시즌 평균 대비 +12%
</p>
```

```css
.pdf-chart-caption {
  margin: 8px 0 16px;
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--pdf-text-soft);
  font-size: 12px;
  color: var(--ink-dim);
  line-height: 1.5;
}
.pdf-chart-caption strong { color: var(--ink); }
```

#### 6-1-2. Caption template per chart

| 차트 | template |
|---|---|
| GPS map | "{distance}km · 풍향 {dir}° · {windConfidence}" |
| 속도 시계열 | "최고 {max}kt · 평균 {avg}kt · 시즌 평균 대비 {delta}%" |
| 속도 분포 pie | "{majorityRange}kt 영역 {pct}% — 시즌 평균 대비 {delta}%" |
| 폴라 | "좌현 {pPct}% target · 우현 {sPct}% — {weakerSide} 강화 권장" |
| 바이올린 | "포트 mean {pMean}{unit} · 스타보드 mean {sMean}{unit} — Δ {delta}" |
| HR trend | "Z{majorityZone} {majorityPct}% · 회복 지수 {recovery} bpm/분" |
| HR zone | "Z2~Z3 {aerobicPct}% — {tone}" |
| HR eff | "같은 속도 대비 HR {delta} bpm — {tone}" |
| What-if | "추천 윙 {opt}㎡ (+{delta}kt VMG) — {confidence}" |

### 6-2. estimate / measured flag — 시각 인코딩

#### 6-2-1. 데이터 모델 — 모든 metric 에 source flag

```js
const metricSchema = {
  value: 17.5,
  unit: 'kt',
  source: 'measured' | 'estimate' | 'computed',
  confidence: 'high' | 'medium' | 'low' | null,
  ci_95: [16.8, 18.2]  // optional CI bounds
};
```

#### 6-2-2. 시각 인코딩

| source | 시각 |
|---|---|
| **measured** | 실선 (Chart.js `borderDash: []`) · opacity 1.0 · solid dot |
| **estimate** | 점선 (`borderDash: [4, 3]`) · opacity 0.6 · open dot · CI ribbon (alpha 0.15) |
| **computed** | 실선 + (estimate) 라벨 chip · opacity 0.8 |

#### 6-2-3. PDF 각 영역 적용

| 페이지 | metric | source 표기 |
|---|---|---|
| p.2 Executive Summary | VPS score | computed (실선 + chip) |
| p.3 GPS map | 풍향 | estimate (점선 풍향 화살표) 또는 measured (사용자 입력) |
| p.4 속도 분포 pie | 속도 | measured (GPS 직접) |
| p.5 폴라 | target | estimate (개인 베스트 폴라) — 점선 |
| p.7 Coach narrative | recommendation | computed (chip) |
| p.8 What-if | VMG sweep | computed (라벨 명시) |

### 6-3. Per-chart limitation footnote

각 차트 아래 (caption 옆) 작은 limitation note (necessary 한 경우만):

```html
<p class="pdf-chart-limitation">
  ⓘ 풍향 추정 신뢰도 보통 — 리칭 위주 세션은 신뢰도 낮음 가능
</p>
```

```css
.pdf-chart-limitation {
  margin: 6px 0 0;
  font-size: 10px;
  color: var(--ink-soft);
  line-height: 1.4;
}
```

---

## 7. 페이지별 v2 구조 (12p)

### 7-1. p.1 Cover

- 라이딩 분석 보고서 (제목 큰)
- 세션 날짜 + 위치 + 라이더 이름
- 단무지 brand mark (한자 單 武 智 + SailTech logo) — 로즈 brand_color_spec reference

### 7-2. **p.2 Executive Summary** ★ Phase 0

§3 spec 그대로. Grade chip + Top 3 highlights + Top 1 next-action.

### 7-3. p.3 GPS map + 풍향

- GPS map (확대 — 풍향 박스 width 축소, map maxHeight 확대)
- 풍향 chip (sidebar)
- caption "이 트랙이 말하는 것"
- estimate flag (풍향 추정 시 점선)

### 7-4. p.4 속도 + 분포 + 고속 구간

- 속도 시계열 (라이브 fix + 시즌 평균 reference line)
- 속도 분포 pie (라이브 fix statusAt + caption)
- 고속 구간 표 (`dataviz_pdf_report_fix_spec.md §3-1` 적용)
- caption per chart

### 7-5. p.5 폴라 + 바이올린

- 폴라 (best polar dashed overlay — `expert_dataviz_reference.md §4-2` 적용)
- 바이올린 (포트/스타보드)
- caption per chart

### 7-6. p.6 HR (조건부)

- HR trend (LTTB 다운샘플 + zone label)
- HR zone (caption)
- HR eff (추세선 — `expert_dataviz_reference.md §2-11 P1`)

### 7-7. **p.7 Coach narrative + Recommendation callout** ★ Phase 2

§5 spec 그대로. 3-chip callout (강점·개선·다음 세션) + Coach narrative + limitations footnote.

### 7-8. **p.8 What-if** ★ CRITICAL

`dataviz_pdf_report_fix_spec.md §2` spec 그대로 (표 + line chart).

### 7-9. p.9 Appendix

- 알고리즘 방법론
- 데이터 소스
- 점수 체계
- **한계 (강화)** — 각 estimate 항목 + confidence

### 7-10. **p.10 Season trend** ★ Phase 1 신규

- 12 세션 sparkline grid (도메인 5종 — 평균 속도 / 최고 속도 / 회전 효율 / VMG % / VPS)
- 진도 % rank (라이더 본인 시즌 분포)
- caption

### 7-11. **p.11 Next sprint plan** ★ Phase 2 강화 신규

- 3 actionable goal (티모 학술 ref 기반 — SMART goal)
- 각 goal 의 metric · target value · 시간 frame · 측정 방법
- 다음 세션 체크리스트

### 7-12. p.12 Footer

- 보고서 ID + 생성 일자
- 단무지 brand mark + SailTech logo
- "본 보고서는 dmjgroup.kr 라이딩 분석 대시보드로 자동 생성되었습니다"

---

## 8. 알렉스 implementation path

### 8-1. Sprint 분배

| sprint | 작업 | ETA |
|---|---|---|
| **sprint 2-A** (P0 CRITICAL) | §3 Executive Summary 페이지 + §5 Recommendation callout + §7-p8 What-if (`fix_spec §2`) | 3-4h |
| sprint 2-B (P0 강화) | §4 Comparison context (delta chip + sparkline + best overlay + reference line) | 2-3h |
| sprint 2-C (P1) | §6 Caption + estimate/measured flag + limitations | 1-2h |
| sprint 2-D (구조) | §7 p.10 Season trend + p.11 Next sprint plan 신규 페이지 | 2h |

총 sprint 2 estimate = **8-11h**. 본인 spec 4-6h + 알렉스 implementation 5-7h.

### 8-2. 알렉스 확인 항목

- `state.history` 접근 — saved sessions 의 `storage.js` schema 확인
- `state.target.bins` 채우기 — `app.js` 에 `computeBestPolar(allSessions)` 추가 + state assign
- Chart.js annotation plugin 도입 — sprint 2-B 의 reference line
- Sparkline SVG 생성 helper — 본인 spec §4-3-2 pseudo-code 그대로
- self-test 갱신 — `selftest-pdf-render.js` 에 새 페이지 (p.2 Executive Summary + p.10 Season trend + p.11 Next sprint) 존재 확인

### 8-3. 신규 hex / 토큰 정책

- **신규 hex = 0건**.
- 신규 CSS 토큰 (--pdf-good-soft 등) = `pdf-export.js injectPdfStyle()` 안에 추가만. 라이브 dashboard CSS 영향 0.
- 로즈 윤 (#1) 영역 영향 — typography hierarchy 검증 협업.

---

## 9. 협업 chain prerequisites

### 9-1. 티모 강 (#3 Sports Science) — Lead 영역 spec 의존

**티모 confirm 필요 항목**:

1. **Top 3 highlight metric set** (§3-4-2) — 3 metric 선택 logic + 학술 ref (positive vs constructive feedback ratio)
2. **Score → Grade 임계값** (§2-3) — 85/70/55/40 적정성 (Sports Science 영역 점수 분포 normality)
3. **Verdict 템플릿** (§3-3-3) — percentile rank vs z-score 어느 게 코칭 정합?
4. **Next-action 카테고리** (§3-5-2) — SMART goal 원칙 적용
5. **Recommendation 3-chip 의 강점/개선/다음 세션 logic** (§5-3) — Phase 0 결과 재사용 OK 확인
6. **Limitations 학술 ref** (§5-4, §6-3) — 풍향 추정 신뢰도 표기 방법
7. **Sparkline metric 5종** (§7-10) — 평균 속도 / 최고 속도 / 회전 효율 / VMG % / VPS 적정 set?

→ Pre-spec ping `messages.md` 필요. 본 spec 작성 후 ping.

### 9-2. 메이 한 (#5 UX Research) — narrative arc + 30초 인지 검증

**메이 confirm 필요 항목**:

1. **narrative arc spec** — `_team/audits/may-pdf-report-eval-2026-06-05.md` 직접 참조 (본인 git access 시 확인)
2. **30초 인지 테스트 protocol** (§3-7) — 5명 사용자 NN/g 임계 검증 design
3. **Page-to-page transition chip** (§7) — narrative 연결 디자인
4. **Highlights 의 positive/constructive ratio** (§3-4-2) — UX 영역 합의

### 9-3. 로즈 윤 (#1 Visual Designer) — typography + brand identity

**로즈 confirm 필요 항목**:

1. **Grade chip typography** (§3-3-1) — letter 64px font weight 800 적정?
2. **Brand identity 적용** (§7-1 Cover, §7-12 Footer) — `brand_color_spec` 의 단무지 한자 + SailTech logo
3. **CSS 신규 토큰 (§2-2)** — `--pdf-*` prefix 가 시스템 일관성 OK? 또는 기존 `--color-*` 토큰 alias?
4. **3 chip color tone** (§5-2) — `pdf-good-soft` / `pdf-warn-soft` / `pdf-accent-soft` 적정?

### 9-4. 알렉스 박 (#4 Frontend) — implementation 후순위

**알렉스 영역 (impl)**:
- `pdf-export.js` 수정 (8-11h)
- `selftest-pdf-render.js` 갱신
- Chart.js annotation plugin 도입
- `app.js` state.target.bins 채우기 + state.history 접근
- `storage.js` schema 확인

Pre-spec ping 시점 = 본 spec push + 티모/메이/로즈 confirm 후 (~24-48h).

---

## 10. Sources

**프로젝트 내부**
- `site/_team/sam_pdf_report_evaluation_2026-06-05.md` (본인 평가서, 본 spec 의 trigger)
- `site/_experts/dataviz_pdf_report_fix_spec.md` (본인 6/5 1차 spec — 본 spec 의 §7-p8 What-if 부분 그대로 적용)
- `site/_experts/expert_dataviz_reference.md` §4-1 Replay Strip · §4-2 Target Polar overlay · §4-3 VPS radial gauge · §1-1 Tufte 원칙 · §1-5 color
- `site/_experts/visual_designer_brand_color_spec.md` (로즈 — brand identity reference)
- `site/_experts/expert_sports_science_reference.md` (티모 — Top 3 metric + 학술 ref · SMART goal)
- `site/_experts/expert_ux_researcher_reference.md` (메이 — narrative arc + NN/g 30초 인지)
- `site/riding-dashboard/js/charts.js` (라이브 fix `speedColor → statusAt` · `renderTargetPolar` `target` slot)
- `site/riding-dashboard/js/coach.js` (`computeVPS` 산출 schema · `computeWhatIf`)
- `site/riding-dashboard/js/app.js` (state · history · target)
- `site/riding-dashboard/js/pdf-export.js` (현재 pdf 구조 + buildXxx 함수)
- `site/riding-dashboard/js/chart-theme.js` (statusAt 5 앵커 + goodness)
- `site/admin/dashboard/styles.css` (시스템 A 다크 cockpit 토큰 — 본 PDF spec 은 라이트, 비교 reference)

**외부 reference**
- Tufte, *The Visual Display of Quantitative Information* — data-ink ratio, sparkline, lie factor
- Few, *Information Dashboard Design* (2판) ch.3 — "one screen, one decision"
- Nielsen Norman Group — 30초 인지 임계
- Locke & Latham (2002) — SMART goal 원칙 (티모 영역)
- WCAG 2.2 SC 1.4.1 (color), SC 1.4.3 (contrast), SC 1.4.11 (non-text contrast)

---

_Last updated: 2026-06-05_
_Phase 2 sprint 2 Lead spec — implementation-ready · 신규 hex 0건 · 협업 chain 필요 (티모 + 메이 + 로즈) · 알렉스 implementation 후순위 (8-11h)_
_본인 회복 path #2 산출 완료 — `sam_pdf_report_evaluation_2026-06-05.md` §7-6 약속._
