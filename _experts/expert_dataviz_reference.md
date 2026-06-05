# expert_dataviz_reference.md — 단무지공방 라이딩 대시보드 데이터 시각화 reference

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 1 학습 정리 + 현재 viz audit + 시각 시스템 v2 권장 |
| 작성 | Data Visualization Specialist (전문가 #2) · 2026-05-27 |
| 대상 | `site/riding-dashboard/` (`js/charts.js`·`js/chart-theme.js`·`js/app.js`·`js/coach.js`·`index.html`) |
| 범위 | Phase 1 — production 코드 무수정. audit + 권장만 |
| 근거 | 코드 직접 열람 + 메모리 .md (CHART-DESIGN-SYSTEM·Njord 벤치마크·디자인 일관성·검토배치) + 외부 reference (Tufte·D3·Observable Plot·Vakaros·SAP·Grafana·deck.gl·perceptual color) |
| Co-owners | Visual Designer (색·타이포 협업) · Sports Science (지표 정합성) · Frontend Engineer (구현) · UX Researcher (인터랙션) |

> **읽는 법.** §1 은 제품 viz 원칙(Tufte·세일링 viz·color·real-time·mobile)을 압축 정리한 결정 기준이다. §2 는 현재 16개 차트를 카드별로 audit 한다 — 각 카드는 정합성·data-ink·인터랙션·개선 우선순위 4축으로 평가한다. §3 은 라이브러리 선택 framework (Chart.js vs canvas vs D3 vs deck.gl). §4 는 신규 viz 후보 5종. §5 는 협업 인터페이스. Phase 1 은 §2·§4 까지 — production 변경은 Phase 2 부터.

---

## 0. 핵심 결론 (TL;DR)

대시보드 viz 는 **이미 상당히 정제돼 있다.** `chart-theme.js` 가 색 4계열을 분리해 토큰화했고, `CHART-DESIGN-SYSTEM.md` 가 "한 차트에서 색은 좌우 또는 상태 중 하나만 인코딩한다" 라는 강력한 원칙을 명문화했다. 5월 23 일 디자인 일관성 sweep 으로 스케일 토큰까지 도입됐다. 코드는 자체 발견(send help — `analysis.js` 의 풍향 추정 신뢰도 self-report 등)·자기 정직성에서 Njord 같은 상용보다 오히려 앞선다.

남은 viz 부채는 세 갈래다.

**첫째 — 비교 기준의 부재.** 현재 모든 분석은 "이 세션 내부" 에서만 비교한다 (포트 vs 스타보드, 상위 50% vs 상위 20%, 회전 전 vs 회전 후). 라이더 본인의 누적 베스트 / 동급 라이더 / 물리 모델 target 같은 **외부 기준선** 이 없다 — Njord 의 "% of target" 이 가지는 코칭 가치를 우리는 못 만든다. **개인 베스트 폴라(target polar) 인프라가 이미 `renderTargetPolar` 에 들어와 있지만 데이터 공급선이 비어 있다.** (`taegetPolar.bins` 가 채워질 곳이 없음 — Phase 2 데이터 작업)

**둘째 — 정적 hover 동기화의 한계.** `setChartCursorByTime` 으로 속도·심박 차트 ↔ 지도 사이 hover 커서는 동기화돼 있지만 **재생/스크럽이 없다.** Njord Player 처럼 "두 번째 풍상의 나쁜 택" 으로 시간 점프할 수 없다. 이미 인프라(타임 인덱스·동기화 함수)는 있으므로 **재생 컨트롤만 얹는 quick win**.

**셋째 — 차트당 information density 의 미세 부족.** 속도 시계열은 1차원(속도 y vs 시간 x) 만 보여준다. Heel/Pitch/HR/풍각 같은 보조 시리즈가 같은 화면에 없다. Tufte 가 강조한 "small multiples" — 같은 시간축 위에 작은 미니차트 여러 개를 쌓아 한눈에 비교 — 가 이 영역에 정확히 맞는다.

**Phase 1 권장 우선순위 3 (production 코드 변경 없는 plan):**

1. **신규 — "Replay Strip"** : 속도·VMG·TWA·HR·Heel 5종 small multiples + 동기 재생 컨트롤 (§4-1). Njord Player 의 코칭 가치 + 우리 hover sync 인프라 재사용.
2. **신규 — "Target Polar overlay"** : 개인 누적 베스트 폴라 (모든 저장 세션 합산 → 7.5° bin × 풍속 구간) 를 `renderTargetPolar` 의 `target` slot 에 공급. `% of target` 지표 신규 산출(§4-2). 데이터 단순 — 신규 차트 코드 0줄, storage 집계 함수만 추가.
3. **현존 차트 미세 개선 5건** (§2 audit 권장 P1) : KDE bandwidth 하한 명시화·속도 시계열 fill 그라디언트 일관·hr-eff scatter 의 추세선·progression 차트의 multi-axis 시각 분리·What-if sweep 의 sparkline 변형.

---

## 1. Phase 1 학습 정리 — 결정 기준

### 1-1. Tufte 원칙 — data-ink ratio · chartjunk · small multiples · sparklines

Tufte 의 핵심 4 원칙을 우리 대시보드 맥락으로 번역한다.

**Data-ink ratio (= data ink / total ink).** "지울 수 있는 ink 는 지운다." 우리 대시보드에서 `chart-theme.js` 가 이미 잘 따른다 — grid `rgba(10,37,64,0.07)` 의 alpha 7% 가 그 증거다. 격자가 데이터를 잡아먹지 않는다. 단, 폴라 차트의 방사선 + ring 라벨 + TWA 라벨 + P/S 라벨 + 범례 + 단위 hint 가 한 작은 캔버스에 동시에 있어 약간 과부하 — 호버 시 dim 처리는 좋은 패턴이나 정적 상태에서도 chrome 의 단계적 약화가 필요하다.

**Chartjunk (정보가 없는 장식) 회피.** 단무지공방 대시보드는 비교적 깨끗하다. 단 hero summary 의 4 KPI 타일에 Lucide 아이콘이 있는데 — 정보 가치가 라벨과 중복(trophy = "퍼포먼스", timer = "시간", gauge = "속도", route = "거리"). 아이콘은 인지 가속 효과가 있어 hero 같은 1회성 환영 화면에서는 OK 지만, 대시보드 본체 의 KPI 카드에는 두지 말 것 — 이미 본체는 아이콘 없이 깨끗하다.

**Small multiples.** 같은 디자인의 작은 차트를 격자로 나열해 시리즈 간 비교를 한눈에. 우리 대시보드의 **회전 상세 ±10초 P/S 분할 (`renderManeuverDetail`)** 이 정확히 small multiples 다 — 같은 ±10초 시간축에 포트 / 스타보드 두 곡선을 나란히 + 다중 선택 시 곡선 stacking. 이 패턴을 **Replay Strip (§4-1)** 으로 확장 권장 — 속도·VMG·TWA·HR·Heel 5종을 같은 시간축에 작게 쌓기.

**Sparklines.** 문장 안에 인라인으로 박는 워드사이즈 차트. 우리 KPI 타일에 "최고 속도 32.4 kt" 다음에 미니 추세선을 박으면, 이 세션이 시즌 추세 어디에 있는지 한 호흡에 보인다. **What-if Wing sweep 도 sparkline 변형 후보** — 현재의 `sweep-row__bar` 가로 막대는 좋으나 시즌 추세 sparkline 을 인접 셀에 추가하면 결정 가치가 올라간다.

**그래픽 무결성 (graphical integrity).** Tufte 의 lie factor = 그래프에 표시된 효과 / 데이터의 실제 효과. 비율이 1 에서 멀수록 거짓말. 우리 대시보드의 **세션 비교 progression 차트는 multi-axis (속도 좌·거리·시간 우)** 라 구조적 lie factor 위험이 있다. 같은 가로 위치에서 좌측 막대와 우측 막대를 시각적으로 비교하면 잘못 읽을 수 있다 — `i === 0` 일 때만 격자 표시로 부분 완화돼 있으나, 더 강한 시각 구분(좌·우 축 색을 데이터셋 색과 결합) 또는 multi-line 으로 강제 전환이 필요할 수 있다 (§2-13 audit).

### 1-2. D3.js · Observable Plot · Chart.js — 라이브러리 선택 framework

세 라이브러리는 **다른 추상화 레벨**이다. 한 라이브러리만 골라 모든 viz 를 만들면 어느 쪽도 잘 안 된다.

| 라이브러리 | 추상화 | 강점 | 약점 | 적합 |
|---|---|---|---|---|
| **Chart.js** | 고수준 declarative | 표준 차트 (line·bar·pie·scatter) 가 30줄로 끝. 호환 좋음. animation·tooltip·legend 빌트인 | bespoke 차트(폴라·바이올린·트랙맵) 는 plugin 으로 우회해야 — 결국 ctx 직접 호출 | 표준 X-Y 차트 (속도 시계열·HR·progression·zone bar·histogram pie) |
| **Custom Canvas (ctx 직접)** | 저수준 명령형 | 모든 ctx API 가능. 외부 lib 0 byte. 우리 폴라·바이올린·track edit 핸들 모두 여기 | 좌표·축·범례·인터랙션 모두 수작업. 코드량 증가. 테스트 어려움 | 도메인 특화 viz (폴라 다이어그램·바이올린·track edit·트림 핸들·crosshair overlay) |
| **D3.js** | 저수준 데이터 결합 | 데이터 → DOM 결합의 끝판왕. scale/axis/shape generator 의 표준. transitions 풍부 | SVG 가 기본 — 수천 포인트에서 느려질 수 있음. 학습 곡선 가파름 | 신규 인터랙션이 많은 bespoke viz (force layout·tree·hierarchical). 우리는 사실상 불필요 |
| **Observable Plot** | 고수준 declarative (D3 위) | "한 줄 히스토그램" — D3 50 줄을 1줄로. exploratory 빠름 | bundle 추가. 우리 대시보드의 polished 차트엔 customization 한계 | 신규 차트 prototype·내부 탐색. production 출시는 Chart.js 또는 canvas 로 다시 만드는 게 맞음 |
| **deck.gl** | 고수준 WebGL | 수십만 포인트 지도. heatmap·hexbin·arc 빌트인. WebGL2/WebGPU | 외부 의존성 큼. 모바일 성능·배터리. 학습 곡선 | 시즌 누적 트랙 heatmap (모든 세션 GPS 를 1 장에 — Phase 3 가능성). 1 세션 분석은 과함 |
| **Three.js** | 저수준 3D | 풍장(wind field) 3D, 폴라 3D 회전 | 모바일 부담. 학습 곡선. 정보 전달 효율은 2D 가 보통 더 높음 | Wave 라이딩 시각화 (3D heel + pitch) 같은 specialized — Phase 2+ |

**결정 framework — "어느 라이브러리?"**

1. 데이터가 **{x, y} 시계열**이고 표준 차트 형태로 충분하면 → **Chart.js**.
2. **방사형 좌표·KDE·overlay·custom hit test** 가 필요하면 → **Custom Canvas (ctx)**. 우리 폴라·바이올린은 정답.
3. 신규 prototype 을 빠르게 만들고 싶으면 → **Observable Plot** (production 전환 가능성 평가).
4. **>100k 포인트 지도** 또는 다세션 누적 GIS 면 → **deck.gl** 검토.
5. 3D 가 정보 가치를 정말로 더하면 → **Three.js**. 그렇지 않으면 2D 가 옳다 (대부분의 경우).

**현재 대시보드는 (1) + (2) 의 hybrid 가 적절히 채택돼 있다.** Chart.js 가 표준 차트를 맡고, custom canvas 가 폴라·바이올린·트림 핸들·crosshair·hero track SVG 를 맡는다. 이 구조를 유지·강화하는 것이 v2 권장 (§3).

### 1-3. 세일링 / 모터스포츠 telemetry viz — Vakaros · Vantage · Njord · SAP · F1

**Vakaros Atlas 2 + Vantage app.** 작은 GPS 인스트루먼트가 본체에서 VMG · time-to-burn · time-to-line 위젯 (페이지당 4개 위젯, 최대 10페이지) 을 보여준다. **Vantage app** 이 후처리: 14kt true wind 에서 polar 대비 % · maneuver 분석 · 풍각 추정. 디스플레이 철학은 "한 페이지 하나의 결정 (one screen, one decision)" — Tufte 의 small multiples 와 일치.

**Njord Analytics + Njord Player.** §2 의 갭 분석 그대로다 — 4개 풍향 소스 · % of target · 회전을 헤드-투-윈드 기준 정렬 + 중첩 · Player 의 동기 재생 (영상 + 데이터 + 지도). 우리가 채택 가능한 패턴: **타깃 폴라 % · 동기 재생 strip · TWA 기반 leg 자동 라벨**.

**SAP Sailing Analytics (2025-10-20 GitHub Apache 2.0 오픈소스 공개).** Fleet 단위 race tracking, wind grid 오버레이, leg 자동 분할 + leg metrics. 우리 영역(단일 라이더 freeride) 에는 fleet 부분이 무관하나 — **wind grid (`map` 위에 풍향 화살표 격자)** 와 **leg-aware coloring** 는 채택 가능. 우리 대시보드의 풍향 그리드 (`renderMap` 의 wind grid) 가 이미 SAP 방향을 따라가고 있다.

**F1 telemetry dashboards (OpenF1 / SAP-McLaren).** 핵심은 **multi-driver 비교 라인차트** + **gear/throttle/brake 채널을 같은 시간축에 multi-row stacking**. 두 lap 을 lap-distance 축으로 align 해 corner 별 손실을 정확히 본다. 우리에게는 **회전을 정점 기준 align (이미 함)** + **두 세션을 거리·시간 축으로 align 한 비교** (Phase 2) 가 동일 패턴.

**공통 패턴 추출 — production 도메인 viz 의 6 가지 invariant:**

1. **동기 재생** (지도 + 차트 + 영상이 한 timeline 으로). 우리 hover 동기까지는 됨, 재생은 안 됨.
2. **% of target / 차이 표시** (절대값보다 차이가 코칭 가치). 우리 진행 중.
3. **여러 채널을 같은 시간축에 small multiples**. 우리는 아직 속도 + HR 두 채널만 동기.
4. **정점 기준 align 후 중첩** (회전·corner·lap). 우리 `renderManeuverDetail` 이 이미 구현.
5. **방향성 색 (좋은 방향 반영)**. 우리 `goodness(value, direction, opts)` 가 5 방향 (higher/lower/heel/twaDown/neutral) 으로 가장 정교 — Njord 보다 앞선다.
6. **신뢰도 self-report** (모델 추정의 한계 명시). 우리 풍향 추정이 '낮음' 을 인정 — 이게 코칭 도구의 정직성. 강점.

### 1-4. 실시간 시계열 — Grafana 패턴 · LTTB downsampling

우리 대시보드는 post-session 분석이므로 strict realtime 은 아니지만, 1 세션의 30 만 GPS 포인트 (10Hz × 1시간) 를 화면에 그리는 것은 동일한 문제다. 현재 `renderMap` 은 모든 GPS 포인트 (다운샘플링 없음) 를 Leaflet `preferCanvas: true` 로 그린다 — 50,000 polyline segment 까지 견딘다. 속도 시계열도 `data.push({x, y})` 로 전량을 Chart.js 에 넣는다.

**LTTB (Largest Triangle Three Buckets).** Sveinn Steinarsson 2013. n 개 포인트를 m 버킷으로 나누고, 각 버킷에서 "직전 선택점 + 다음 버킷 평균" 과 만드는 삼각형의 면적이 최대인 점을 고른다. **시각적 유사성을 거의 잃지 않으면서 데이터를 10× ~ 100× 축소.** TimescaleDB 가 hyperfunction 으로 제공, Grafana 와 통합.

**우리 적용 가능성.** 현재 50k 포인트가 모바일에서 살짝 느릴 수 있다 (특히 트림 드래그 중 원본 전체 미리보기 — `drawTrimPreview`). LTTB 로 **시각 전용 다운샘플** 을 통과시키면 (분석은 원본 그대로) UX 가 매끈해진다. 단, 회전 정점·고속 구간 같은 **국지 극값 보존이 핵심** 이라 LTTB 가 적합 (vs 단순 stride sampling 은 극값 미보존). **Phase 2 의 모바일 성능 sprint 에 포함 권장.**

**Sliding window vs full-session.** 실시간 (라이브 텔레메트리) 가 아닌 우리는 sliding window 가 필요 없다. 단, **트림 드래그 중 미리보기 — 원본 전체를 그리는 ms 마다** 가 사실상 sliding window 와 같은 부담이다. raf-throttle (`renderSoon`) 로 이미 fps 제한돼 있어 OK.

### 1-5. Color encoding — viridis · OKLCH · colorblind · 우리 5단계 토큰

**Perceptually uniform colormap.** Viridis 가 표준 (purple → blue → green → yellow). 같은 데이터 차이가 같은 색 차이로 보이게 설계됨. 흑백 인쇄 OK, 색맹 친화 (deuteranopia·protanopia 둘 다). 단 viridis 는 **연속 sequential** 색 — 우리 대시보드의 5 단계 status (veryGood·good·mid·bad·veryBad) 는 **diverging discrete** 라 다른 종류다.

**우리 5단계 토큰 평가.** `chart-theme.js` 의 5 앵커 (#1FA055 · #7FC241 · #F2C20E · #EC8A2E · #D6453A) 는 **빨강 ↔ 초록 diverging** 으로, 노란색을 중앙에 둔 RYG 변형이다. 강점: 즉시 인지 (빨강=나쁨 / 초록=좋음 의 cultural prior). 약점: **deuteranopia / protanopia (남성 약 8%)** 에게 노랑·녹색 구간이 비슷해 보일 수 있다. **권장: 라이트 모드 5 앵커는 유지 (cultural prior 가 너무 강함) 하되, 옵션으로 colorblind-safe alt palette 추가 (예: Okabe-Ito 변형, 5 단계 — Phase 2+).**

**OKLCH.** 2023 도입된 CSS color space — perceptually uniform L (lightness), C (chroma), H (hue). 같은 L 의 두 색은 같은 밝기로 보인다. **CSS 변수로 status 색 보간** 이나 **dynamic palette 생성** 시 매우 유용. 단 우리 chart-theme 의 보간 (`statusAt`) 은 sRGB 공간 lerp 이라 약간 muddy 한 중간색 발생 가능 — OKLCH 보간으로 바꾸면 perceptually smooth 해진다. **권장: `statusAt` 의 보간을 OKLCH 로 업그레이드 (Phase 2 — 토큰 외관 살짝 바뀌므로 Visual Designer 와 합의).**

**Sequential (속도 분포 파이) vs Diverging (status) 분리.** 5월 26 일 변경 — Danny 가 속도 분포 파이의 5단계 빨강↔초록을 **단일 hue (sea blue) 옅음→짙음** 로 바꿨다. **이건 정확히 옳은 결정**이다 — 속도 분포는 sequential (값 자체의 분포) 이지 diverging (좋은 방향) 이 아니다. status 색을 분포에 쓰면 사용자가 "느린 속도 = 나쁘다" 로 오독한다. `CHART-DESIGN-SYSTEM §1` 의 "상태색 = 성과 잘함/못함 전용" 원칙과 일치.

**지도 트랙 색 (`mapSpeedColor`) 의 빨강→주황→초록.** 5월 24일 변경 — 빠름 = 초록, 느림 = 빨강. status 색 5 앵커와는 다른 ramp (밝은 OSM 타일 위에서 또렷하려고 채도 높음). **이중 ramp 가 약간 혼란 — 디자인 시스템에 "지도 트랙 = 속도 (sequential) · status 색 (diverging) 과는 다른 ramp" 를 명시 권장.** 또는 지도 트랙도 sea blue sequential 로 통일 (단 OSM 위 가독성 trade-off 필요 — Visual Designer 협업 항목).

### 1-6. 모바일 viz — 정보 밀도 유지의 5 원칙

세션 1회 분석 → 휴대폰에서 즉시 확인이 우리 핵심 사용 시나리오. 다음 5 원칙으로 모바일에서도 desktop 의 정보 가치를 유지한다.

1. **"한 화면 한 결정 (one screen, one thought)".** Hero summary 의 4 KPI 가 정답 — VPS·이동시간·최고속도·총거리. 본체로 들어가면 카드별 한 차트.
2. **5 초 이내 핵심 파악.** Hero 의 큰 숫자 + KPI 라벨. 모바일에서 thumb 가 닿기 전 눈으로 끝나야.
3. **Touch target ≥ 44–48px.** 우리 토글 (`time-toggle`·`mv-filter`·`violin-toggle`) 모두 충족. 회전 마커 (지도) 의 7px radius → 14px hit area 는 적절.
4. **Progressive disclosure.** 본 카드 안의 상세 (회전 ±10초 P/S, 바이올린 indicator 토글) 는 클릭 후 노출 — 좋은 패턴.
5. **Critical path 우선 로드.** Hero + 본 KPI 카드 먼저, polar·violin 같은 무거운 canvas 차트는 lazy 권장. 현재는 일괄 렌더 — Phase 2 의 IntersectionObserver 기반 lazy 권장.

---

## 2. 현재 viz audit — 차트별 평가

전 16 개 viz unit. 각 unit 은 4 축 평가 + 권장 우선순위 (P1 = 즉시 / P2 = Phase 2 / P3 = 백로그).

### 2-1. Hero Summary 오버레이 (Layer 2 — 2026-05-26)

- **위치** `index.html` `#hero-summary` + `app.js:691~860` `showHeroSummary()`
- **구성** 트랙 GPS SVG path 배경 (`buildHeroTrackPath`) + 4 KPI 타일 (VPS·이동시간·최고속도·총거리) + Lucide line icons + 5초 auto-dismiss
- **정합성** ✅ — VPS · sum.movingTimeSec · sum.maxSpeedMs · sum.totalDistanceM/1000 모두 검증된 산출치. `state.vps.overall.score` 결측 시 KPI 3개로 graceful degradation.
- **Data-ink ratio** 🟡 — 트랙 path 가 옅게 깔린 것은 미적이고 정보 가치도 있음 (이 세션이 어떤 모양이었나). 4 KPI 의 Lucide 아이콘은 라벨과 정보 중복 → 정보 밀도 손실 0.05 정도 (큰 문제 아님, 1회성 환영이라 OK).
- **인터랙션** ✅ — Esc / Enter / Space / click 어디든 dismiss · 5초 auto · skip 버튼.
- **개선 후보** (P2) — KPI 옆에 **mini sparkline (시즌 추세)** 박기. "최고속도 32.4 kt"  + 최근 10세션 sparkline. Tufte sparkline 의 정통 사용처. 단 시즌 데이터 합산 storage 함수 필요 — 같은 비용으로 §4-2 (target polar) 도 같이 만들 수 있어 묶음 권장.
- **개선 후보** (P3) — 트랙 path 그라데이션 (`stroke` 가 sea blue → sun) 이 현재 정적 — 시간에 따라 색 변화 (시작=초록·종료=빨강 또는 속도 기반) 시도 가치. 단 KPI 가 우선이라 P3.

### 2-2. 지도 GPS 트랙 (Leaflet) — `renderMap`

- **위치** `charts.js:124~201`
- **구성** OSM 타일 + 속도 그라데이션 polyline (`mapSpeedColor` 빨→주→초) + 시작/종료 마커 + 택/자이브 마커 (4가지 색 — tack=sea·gybe=sun·turn=slate) + 풍향 그리드 (옵션) + hover cursor + run 강조 layer
- **정합성** ✅ — leg 단위 polyline 분리로 제외 구간이 끊겨 보임. 다운샘플링 없이 전 GPS 포인트 (`preferCanvas: true` 로 50k 견딤).
- **Data-ink ratio** ✅ — 줄두께 2.5px (5월 24일 굵음→가늠 조정), opacity 0.95. 마커가 4가지 색 — 의미가 명확 (택·자이브·turn·start/end).
- **인터랙션** ✅ — hover sync · 회전 마커 클릭 · run 강조 fit bounds.
- **개선 후보** (P1) — **풍향 그리드 시각 위계 약화**. 현재 풍향 그리드가 옵션이지만 활성 시 트랙 위에서 다소 두드러져 트랙 자체를 약간 가린다. opacity 0.4 → 0.3 또는 stroke-width 축소 권장 (Visual Designer 협업).
- **개선 후보** (P2) — `mapSpeedColor` 의 빨→주→초 ramp 와 속도 분포 파이의 sea blue ramp 가 **다른 ramp** 이라 사용자가 인지 부담. CHART-DESIGN-SYSTEM 에 "지도 트랙 ramp 는 별도 (OSM 위 가독성 우선)" 를 명시 권장 — 또는 OSM 타일 darkness 와 합의된 sequential ramp 로 통일 검토.
- **개선 후보** (P3) — Heatmap layer (한 세션의 시간 누적 위치 밀도). deck.gl HeatmapLayer 이식. 단 단일 세션엔 정보 가치 제한적 — 시즌 누적에서 의미.

### 2-3. 속도 시계열 (Chart.js line) — `renderSpeedChart`

- **위치** `charts.js:290~504`
- **구성** Y = 속도 (kt/kmh), X = 경과 시간. fill = sea blue 세로 그라데이션 (5월 26일 — Layer 1.5). 택/자이브 음영 + 제외 구간 회색 음영 + 트림 핸들 + crosshair overlay. 다운샘플링 없음.
- **정합성** ✅ — `bounds: 'data'` 로 트림 후 X축 빈 여백 제거 (좋은 디테일). `spanGaps: false` 로 leg 사이 NaN 끊김.
- **Data-ink ratio** 🟡 — fill 그라데이션이 미적으로 좋고 속도 영역을 강조하나, 데이터 의미 추가는 0 (시각 garnish). Tufte 엄격 적용이면 fill 자체를 빼는 게 옳지만 — 현재 톤이 차분해서 큰 손실은 아님. **유지 권장.**
- **인터랙션** ✅ — 트림 핸들 드래그·구간 제외 드래그·크로스헤어·회전 음영 클릭. **이건 우리 대시보드의 viz 최고 봉우리**다. Chart.js plugin 으로 우회 구현했으나 매끈하게 동작.
- **개선 후보** (P1) — **multi-channel small multiples 로 확장 (§4-1).** 현재 속도 차트 한 줄. 같은 시간축에 VMG·TWA·HR·Heel 작은 strip 을 쌓으면 코칭 가치 급상승.
- **개선 후보** (P2) — LTTB 다운샘플 옵션. 모바일에서 50k 포인트 트림 드래그 시 살짝 끊김 가능 — `drawTrimPreview` 부분만 LTTB 통과시켜도 시각 동일·성능 개선.

### 2-4. 트림 핸들 + 제외 구간 (canvas overlay) — `drawTrimPreview·drawTrimHandles`

- **위치** `charts.js:546~620`
- **구성** 트림 드래그 시 원본 전체 속도 프로파일 + 잘릴 구간 어둡게 + 노란색 핸들 (그립 + tick 라벨) + 제외 구간 빨간 박스
- **정합성** ✅ — 좌표 변환 (`trimTtoX`·`trimXtoT`) 의 클램프 + 최소 keep 10초 + 최소 exclude 5초 + 핸들 hit area 14px 모두 깔끔.
- **Data-ink ratio** ✅ — 핸들 디자인 (세로 막대 + 그립 + 두 세로선) 이 효율적.
- **인터랙션** ✅ — pointer capture + raf throttle + 트림 / 드래그 / 클릭 분기.
- **개선 후보** 없음. 이미 production-grade.

### 2-5. 크로스헤어 overlay (canvas) — `drawCrosshairGeneric`

- **위치** `charts.js:759~810`
- **구성** 세로 점선 + 데이터 점 (흰 외곽선 + 색 채움) + navy 패널 라벨 (mm:ss · 값 + 단위)
- **정합성** ✅ — DPR 보정, scale.getPixelForValue 사용, 차트 영역 클리핑.
- **Data-ink ratio** ✅ — 점선 alpha 0.38, 라벨 박스 navy 0.92. 최소한의 ink 로 최대 정보.
- **인터랙션** ✅ — 속도 / 심박 두 차트 + 지도 + 편집 타임라인 4개 cursor sync (`setChartCursorByTime`).
- **개선 후보** (P1) — **§4-1 Replay Strip** 에 그대로 재사용. 5종 차트로 확장 시 한 줄의 cursor 가 모두 동기화. 인프라 이미 있음.

### 2-6. 회전 상세 ±10초 P/S 분할 — `renderManeuverDetail`

- **위치** `charts.js:862~1130`
- **구성** 두 캔버스 (포트 / 스타보드) + ±10초 시간축 + 다중 회전 선택 시 중첩 + 평균선. 회전 정점 align 후 stacking — **Tufte small multiples 정통**.
- **정합성** ✅ — 정점 기준 align 이 코어 분석 패턴 (Njord 와 같은 방향, 단 Njord 의 head-to-wind 기반과는 다름 — 우리는 turn rate 정점).
- **Data-ink ratio** ✅
- **인터랙션** ✅ — 다중 선택 가능 (지도 마커 / 표 / 차트 음영 클릭)
- **개선 후보** (P2) — **임의 채널 overlay** (Njord 의 "any metric overlay"). 현재 속도 중심. heel / pitch / HR 도 같은 ±10초 위에 overlay 옵션 추가. 데이터는 이미 있음 (vkx 면 heel·pitch, HR 차트가 있으면 HR).
- **개선 후보** (P3) — **Turn Up / Bear Away 회전 분리** (Njord). 현재 'turn' 으로 묶음. 코칭 가치는 택·자이브 대비 작아 P3.

### 2-7. 바이올린 — 좌우 분포 (KDE) — `renderViolin`

- **위치** `charts.js:1132~1288`
- **구성** 가우시안 KDE (가중) + 좌우 (P 빨강·S 초록) + 평균선 (실선) + 상위 50% (회색 파선) + 상위 20% (곤색 점선) + P/S 라벨 상단 + 밀도 hint 하단
- **정합성** ✅ — bandwidth = 1.06 × std × neff^(-0.2) (Silverman's rule of thumb). 너무 뾰족하지 않게 하한 (`bw = max(bw, span / 60)`). neff 시간가중 보정.
- **Data-ink ratio** ✅ — 격자선 alpha 0.07, KDE fill alpha 0.20.
- **인터랙션** 🟡 — hover 없음. 토글 (풍상 / 지표 / 모집단) 만. 정적.
- **개선 후보** (P1) — **bandwidth 하한 명시화**. 현재 `span / 60` 으로 hardcode. neff 가 작은 (회전 적은 세션) 경우 더 부드러운 곡선이 필요. `bw = max(bw, span/60, span/(2*sqrt(neff)))` 권장 — 표본 신뢰도 반영. 단 큰 시각 변화는 없음, 안전 hedge.
- **개선 후보** (P2) — **호버 → 값·신뢰도**. KDE 곡선 위 hover 시 "TWA 40°, 밀도 0.12, n=15" 표시. 폴라의 hover 패턴 재사용.
- **개선 후보** (P3) — **violin 위에 box plot overlay**. Tufte 의 box plot variant (without box, with mean dot + IQR line). 단 현재 평균·top50·top20 라인이 이미 IQR 대안이라 정보 가치 작음.

### 2-8. 속도 분포 파이 (Chart.js pie) — `renderHistogram`

- **위치** `charts.js:1290~1450`
- **구성** 체류 시간 비율 (≥7% 슬라이스에 % 직접 표기) + **status 5단계 ramp (statusAt 위임)** + '기타' 자동 병합 (<3%) + 범례에 구간·% 동반
- **정합성** ✅ — 작은 구간 OTHER_PCT_THRESHOLD 병합으로 범례가 0% 줄줄이 안 됨 (5월 25일).
- **Data-ink ratio** ✅ — **6/5 옥대표님 결정** — `speedColor()` 를 `statusAt(f)` 위임으로 변경. 다른 차트 (VPS donut · 효율 셀) 와 색감 통일.
- **인터랙션** 🟡 — Chart.js 기본 tooltip + 범례 토글. legend item 클릭으로 슬라이스 hide 가능.
- **개선 후보** (P2) — **파이 vs 도넛 vs 가로 막대** 검토. Tufte 는 파이를 싫어한다 (각도 비교가 길이 비교보다 어려움). 우리 케이스는 슬라이스 수가 5~8 개라 파이가 OK 지만, **가로 막대 (sorted by %)** 가 더 정확. 단 파이의 친숙도 이점이 있어 trade-off — Visual Designer / UX Researcher 협업 결정.

**자기 정정 (2026-06-05)** — 5/27 본 entry 의 "5월 26일 Layer 2.0 변경 (status 5단계 → sea blue 단일 hue) 이 정확히 옳다" 평가는 Tufte sequential vs diverging 원칙만 우선한 학술 결론. 사용자 (옥대표님) 인지 검증 안 함. 실제로는 "빠를수록 좋음" 직관 매핑이 자연 → status 5단계 sequential 인코딩이 정합. 다른 차트와 색감 통일이 인지 효율 ↑. 6/5 옥대표님 verbatim 피드백 받아 `speedColor()` → `statusAt(f)` 위임으로 정정.

### 2-9. 심박 추이 (Chart.js line + zone 배경) — `renderHrChart`

- **위치** `charts.js:1451~1670`
- **구성** HR line (`#C0392B` 단일 시리즈) + 5존 가로 배경 띠 + 시간축 + crosshair sync
- **정합성** ✅ — 존색 동일 색 (`HR_ZONE_COLOR`) 으로 분포 막대와 일치.
- **Data-ink ratio** 🟡 — 5존 배경 띠가 화면을 가로지르나, 라벨이 없어 정보 가치 약간 떨어짐. 우측에 Z1~Z5 라벨 권장.
- **인터랙션** ✅ — crosshair sync
- **개선 후보** (P1) — **존 배경에 Z1~Z5 라벨 우측 인라인**. 작은 6px 글자로 띠 우측 끝. 데이터-ink 증가.

### 2-10. 심박 존 분포 막대 (Chart.js bar) — `renderHrZoneBars`

- **위치** `charts.js:1672~1730`
- **구성** Z1~Z5 가로 막대, 존색
- **정합성** ✅ · **Data-ink ratio** ✅ · **인터랙션** 🟡 (정적)
- **개선 후보** 없음. 단순·정확.

### 2-11. 심박 효율 산점 (Chart.js scatter) — `renderHrEff`

- **위치** `charts.js:1733~1815`
- **구성** X = 속도 (kt), Y = 심박 (bpm). 2 시리즈 (택·자이브 별) 범주색.
- **정합성** ✅ — 시간가중 산점
- **Data-ink ratio** 🟡 — 추세선 없음. 산점만 보면 패턴 인지가 어렵다.
- **인터랙션** 🟡 — Chart.js 기본
- **개선 후보** (P1) — **시리즈별 선형 회귀 추세선 overlay**. R² 작아도 시각적 패턴 (효율 좋아지면 같은 속도에서 HR 낮음 — 추세 기울기 하강) 인지 돕는다. 단 회귀 line 이 너무 강하면 산점이 묻히므로 alpha 0.5, dashed.

### 2-12. What-if 윙 sweep — `vpsTile + sweep` (app.js)

- **위치** `app.js:4400~4500` (~`render` 함수들). 실제 가로 막대 (sweep-row__bar) + 추천 / 편안함 태그
- **구성** 윙 사이즈 X 축, 풍상 VMG Y 축. 막대 길이 = 예측 VMG. 현재 윙 (실측 anchor) · 최적 윙 (추천) · 편안함 윙 (정점 -0.5㎡) 강조 태그.
- **정합성** ✅ — `measVmgKt` 가 우세 택 풍상 VMG 상위 20% 앵커. 자기모순 검증 invariant 코드에 명시.
- **Data-ink ratio** ✅ — 막대 + 단일 태그.
- **인터랙션** 🟡 — 막대 hover 시 hover state 없음 (정적)
- **개선 후보** (P1) — **추세선 (선 vs 막대)**. 현재 막대인데, sweep 의 본질은 연속 함수다. 매끄러운 곡선 + 정점 (`optimumWingM2`) 에 dot — Tufte 가 권하는 "데이터를 잇는 곡선이 데이터를 분리하는 막대보다 좋다 (연속 함수면)" 와 일치. 단 sweep step 이 이산 (`SWEEP_STEP_M2`) 이라 현재 막대도 valid — line + dot overlay 가 추가 정보 (정점 위치) 를 명확히 한다.

### 2-13. 시즌 progression (multi-axis) — `renderProgression`

- **위치** `charts.js:2071~2156`
- **구성** Line / Bar 토글, 4 지표 (평균 속도·최고 속도·거리·라이딩 시간) + HR 회복 지수, multi-axis (속도 좌·거리/시간/hr 우)
- **정합성** 🟡 — multi-axis 그래프의 lie factor 리스크. 같은 가로 위치의 좌·우 막대를 시각 비교하면 잘못 읽을 수 있음.
- **Data-ink ratio** ✅
- **인터랙션** ✅ — 지표 토글, 차트 타입 토글, tooltip index mode
- **개선 후보** (P1) — **multi-axis 시각 분리**. 좌 (속도) 축 색 = navy, 우 (dist/time/hr) 축 색 = sea blue 또는 무채색. tick / title 색을 데이터셋 색과 일치시켜 사용자가 "이 막대는 어느 축?" 인지 한 호흡에 인지. 단 카테고리 색 (navy/blue/teal/slate) 의미와 충돌하지 않게 조심.
- **개선 후보** (P2) — **single-axis multi-line 변형 옵션 (z-score 정규화)**. 각 지표를 평균·표준편차로 normalize. 단 해석 부담이 늘어 toggle 로만.

### 2-14. 폴라 + 타깃 (canvas) — `renderTargetPolar`

- **위치** `charts.js:1818~2061`
- **구성** 방사 좌표 (반지름 = 속도) + ring 라벨 + TWA 라벨 (30·60·90·120·150°) + 풍상 / 풍하 라벨 + P 곡선 (좌·홍) + S 곡선 (우·녹) + target 곡선 (점선·중립) + hover → 곡선 강조 / dim + tooltip
- **정합성** ✅ — count ≥ 2 만 그림 (표본 부족 제외), p95Ms 기준
- **Data-ink ratio** 🟡 — chrome 이 다소 많음 (방사선 5 개 × 2 + ring 4~5 개 + 라벨 + 범례 4 개). 호버 시 dim 처리는 좋은 패턴이나 정적 상태가 조금 빡빡.
- **인터랙션** ✅ — hover 동기 동일 인스턴스 (`inst.tpState`) 로 재바인딩 방지. mouseleave 정리.
- **개선 후보** (P1) — **target slot 채우기 (§4-2)**. 현재 데이터 없음. 라이더 누적 베스트 폴라 함수 구현하면 즉시 그려짐.
- **개선 후보** (P2) — **% of target 텍스트 인라인**. 폴라 옆에 "풍상 평균 % of target: 87%" 같은 small numeric. Njord 의 코어 가치.

### 2-15. 세션 비교 표 (HTML) — `compareTable` (app.js)

- **위치** `app.js` 의 saved-table / mvc-table 등
- **구성** 행 = 세션, 열 = 4 지표 + 좋은 방향 화살표 + 효율 셀 (eff--hi/mid/lo)
- **정합성** ✅ — 5월 23일 sweep 으로 표 5종 통일 (`--fs-th` 등). 색은 status 토큰 베이스 + 알파 (5월 23일 §2-4 통일).
- **Data-ink ratio** ✅
- **인터랙션** 🟡 — 정렬 X. 행 클릭 시 디테일 X.
- **개선 후보** (P2) — **표 sort by column** (모든 column).
- **개선 후보** (P3) — **inline sparkline** in 각 셀 (이 세션의 추세 mini). Tufte 정통 사용 — 단 표가 좁아질 위험.

### 2-16. Replay viewer mini-charts (다크 테마)

- **위치** `js/replay.js`. `.replay` CSS scope 의 `--rp-*` 토큰
- **구성** 전체화면 다크 + 영상 + 지도 + 미니차트들 (속도·HR 등)
- **정합성** ✅
- **Data-ink ratio** ✅ — 다크에서 자연스러운 contrast
- **인터랙션** ✅ — 시간 동기
- **개선 후보** (P1) — **§4-1 Replay Strip 의 다크 버전과 통합**. 현재 replay viewer 가 별개 컴포넌트로 발전 중. small multiples 패턴을 두 곳에 공유 (라이트 = 대시보드 본체, 다크 = replay viewer).

---

### Audit 우선순위 종합표

| # | 차트 | P1 (즉시) | P2 (Phase 2) | P3 (백로그) |
|---|---|---|---|---|
| 1 | Hero Summary | — | KPI 옆 sparkline | 트랙 path 동적 색 |
| 2 | 지도 트랙 | 풍향 그리드 시각 위계 약화 | 지도/파이 ramp 통일 명시 | 시즌 누적 heatmap |
| 3 | 속도 시계열 | Replay Strip 확장 (§4-1) | LTTB 다운샘플 옵션 | — |
| 4 | 트림 핸들 | — | — | — |
| 5 | 크로스헤어 | Replay Strip 재사용 | — | — |
| 6 | 회전 ±10초 P/S | — | 임의 채널 overlay (heel/HR) | Turn Up/Bear Away 분리 |
| 7 | 바이올린 KDE | bandwidth 하한 명시화 | hover → 값 + 신뢰도 | box plot variant |
| 8 | 속도 분포 파이 | — | 가로 막대 변형 검토 | — |
| 9 | 심박 추이 | Z1~Z5 라벨 인라인 | — | — |
| 10 | 심박 존 막대 | — | — | — |
| 11 | 심박 효율 산점 | 시리즈별 추세선 | — | — |
| 12 | What-if sweep | line + dot variant | — | — |
| 13 | Progression multi-axis | 축 색 데이터셋 결합 | z-score normalize 옵션 | — |
| 14 | 폴라 + 타깃 | target slot 채우기 (§4-2) | % of target 인라인 | — |
| 15 | 세션 비교 표 | — | sort by column | inline sparkline |
| 16 | Replay mini-charts | Replay Strip 통합 | — | — |

**P1 항목 9 건** — 모두 production code 변경이 작거나 (인라인 추가) plan 수준. Phase 1 의 "audit + plan" 범위에 부합.

---

## 3. 시각 시스템 v2 — 라이브러리 / 구현 framework

### 3-1. 결정 매트릭스

대시보드 viz 한 unit 을 추가하거나 다시 만들 때, 다음 매트릭스로 라이브러리를 고른다.

| 데이터·인터랙션 특성 | 권장 | 비고 |
|---|---|---|
| {x, y} 시계열, 표준 line/bar/scatter, hover tooltip 충분 | **Chart.js** | 빠른 prototype + 표준 인터랙션 빌트인 |
| 방사형 / 다축 / KDE / overlay / custom hit test | **Custom Canvas (ctx)** | chart-theme.js 토큰 직접 사용. `cvFont` 헬퍼 활용 |
| 지도 (단일 세션, < 100k 포인트) | **Leaflet + preferCanvas** | 현재 정답. 유지 |
| 지도 (시즌 누적, > 100k 포인트) | **deck.gl HeatmapLayer** | Phase 3 후보. 모바일 성능 사전 평가 필요 |
| 빠른 내부 prototype | **Observable Plot** | production 전환 시 Chart.js / canvas 로 다시 |
| 3D (heel + pitch + 시간) | **Three.js** | Phase 2+. 2D 가 더 효율적인지 평가 후 |

### 3-2. Custom canvas viz 의 표준 패턴 (재사용 인프라)

`charts.js` 가 이미 다음 표준을 만들었다. 신규 canvas viz 는 이걸 따른다.

1. **DPR 보정 + 부모 폭 기반 사이징** (`size = Math.min(el.clientWidth || N, MAX)`).
2. **`cvFont(weight, px)`** — chart-theme `T.font.css` 헬퍼.
3. **`hexA(hex, a)`** — 색 토큰을 alpha 와 결합.
4. **`THEME` / `SIDE` / `CAT`** — 토큰 직접 import.
5. **인스턴스 보관** (`inst.<name>` 객체) + 재렌더 시 정리. 호버 리스너 한 번만 바인딩 (`el._rdXxxHoverBound`).
6. **호버 → `dim` / `hi` / `normal` 3 상태** (`renderTargetPolar` 패턴).
7. **`setChartCursorByTime(t)`** — 시간 기반 cross-component cursor sync.

### 3-3. Chart.js 표준 패턴

1. **`applyChartDefaults(Chart)`** — 격자·범례·폰트·색 전역 적용. 신규 차트는 자동 일관.
2. **`bounds: 'data'`** — X축이 데이터 범위에 정확히 맞도록 (트림 / 줌 후 빈 여백 방지).
3. **`parsing: false` + `normalized: true`** — `{x, y}` raw 데이터 시 성능.
4. **`animation: false`** — analytics 대시보드의 reload 시 시각적 안정.
5. **Plugin 으로 음영 / 핸들 / crosshair 그리기** (Chart.js native 가 안 되면). `beforeDatasetsDraw` / `afterDraw` 훅.

### 3-4. v2 권장 인프라 추가 (Phase 2 후보)

1. **`RDChartTheme.statusAt` 의 OKLCH 보간** — perceptually uniform 으로 업그레이드. 시각 변화 미세 — Visual Designer 합의 후.
2. **LTTB 다운샘플 유틸** — `RDCharts.lttb(data, threshold)`. 50k → 1k 포인트, 시각 동일. `drawTrimPreview` 우선 적용.
3. **Colorblind-safe alt palette 토글** — `RDChartTheme.cb = true` 면 status 5 앵커가 Okabe-Ito 변형으로 교체. 설정 페이지 옵션.
4. **Lazy 차트 로드** — IntersectionObserver 로 viewport 진입 시에만 render. 폴라 / 바이올린 같은 무거운 canvas 우선.
5. **공통 sparkline 함수** — `RDCharts.sparkline(el, values, {color, dotMax: true})`. KPI 타일 / 표 셀 인라인 사용.

---

## 4. 신규 viz 후보 5 종 — 우선순위 + 구현 plan

### 4-1. Replay Strip — 동기 small multiples + 재생 컨트롤 ★★★

**무엇** — 속도·VMG·TWA·HR·Heel 5종 small multiples 를 같은 시간축에 세로 stacking. 한 줄의 crosshair 가 모두 동기. 상단에 재생 / 일시정지 / 스크럽 슬라이더.

**왜 (코칭 가치)** — Njord Player 의 코어 가치. F1 telemetry 의 multi-channel stacking 과 동일 패턴. 두 번째 풍상의 나쁜 택을 0.5 초 만에 점프. 우리 hover sync 인프라 (`setChartCursorByTime`) 가 이미 4 컴포넌트에 적용돼 있어 5 → 6 컴포넌트로 확장만 하면 됨.

**구현 (Phase 2 plan, production 코드 변경)**
- 신규 `js/replay-strip.js` 모듈. `RDCharts.renderReplayStrip(elId, session, analysis, opts)`.
- 5 개 Chart.js line chart 를 세로 grid (CSS Grid 또는 flex column).
- 각 line chart 가 `setChartCursorByTime` 의 callback 등록.
- 재생 컨트롤 → 100ms 마다 `t += 1`, `setChartCursorByTime(t)` + 지도 marker pan + (있다면) replay viewer 영상 seek.
- 시간 슬라이더 (HTML5 `<input type="range">`) → 직접 t 설정.

**난이도** 중. Chart.js 5 인스턴스 = 모바일 메모리 부담 가능 → LTTB 다운샘플과 함께 (`§3-4`).

**선행 결정** — Replay viewer (다크) 와 본 대시보드 (라이트) 어디에 둘지. 권장 = **본 대시보드에 라이트로**, replay viewer 는 영상 통합 시 다크 본 (Phase 3).

### 4-2. Target Polar overlay + % of target ★★★

**무엇** — `renderTargetPolar` 의 비어 있는 `target.bins` slot 을 채운다. 라이더 누적 베스트 폴라 (모든 저장 세션 합산, 7.5° TWA bin × 풍속 구간) 를 점선 곡선으로 overlay. 폴라 옆에 "풍상 평균 % of target: 87%" 같은 numeric 표시.

**왜 (코칭 가치)** — Njord 의 코어 가치 ("% of target") 직접 구현. 절대 속도 < 차이 (target 대비). 우리 VPS 의 물리 모델 의존도를 낮추는 부수 효과.

**구현**
- `storage.js` 에 `computeBestPolar(allSessions)` 추가 — 모든 세션 폴라 bins 를 풍속 구간별 합산, p95Ms / 평균 산출.
- `app.js` 가 폴라 렌더 시 `target.bins` 슬롯에 공급.
- `analysis.js` 에 `computePercentOfTarget(polar, target)` 추가 — 각 풍각에서 (이번 세션 p95Ms / target speedMs) × 100.
- UI 표시 — 폴라 카드 부제에 "풍상 % of target: 87%" 형태.

**난이도** 낮 ~ 중. 신규 차트 코드 0 줄. storage 함수 + 통계 함수만.

**선행 결정** — 풍속 구간 정의. 단순화 (전 풍속 합산 단일 곡선) vs 풍속 분리 (10·14·18 노트 3 곡선). 권장 = **Phase 2-A 단일 곡선 (단순) → Phase 2-B 풍속 분리 (정교)**.

### 4-3. Radial gauge for VPS — Njord-style polar comparison ★★

**무엇** — 현재 VPS 도넛 (`vps-tile__donut`) 을 **radial gauge** 로 업그레이드. 0~100 호 위에 현재 점수 + (개인 베스트 / 시즌 평균 / target 90) 의 reference 마커.

**왜** — 단순 점수 (62/100) → 맥락이 있는 점수 (62, 시즌 평균 58 위, 베스트 73 미만). Tufte 의 "context 가 숫자를 의미있게 한다" 원칙.

**구현**
- `app.js:vpsTile` 의 donut 렌더 부분에 reference 마커 호 추가.
- storage 에서 시즌 평균 / 베스트 가져오기.

**난이도** 낮. 시즌 통계가 이미 progression 차트에 있음.

### 4-4. Wind field grid overlay — SAP Sailing Analytics 패턴 ★

**무엇** — 지도 위 풍 시프트·돌풍을 격자 색 (트랙 색=시프트, 폭=압력) 으로 오버레이. 우리 풍향 그리드 (현재 정적 단일 풍향) 의 시간·공간 변형.

**왜** — 풍 시프트가 코칭 가치 있는 케이스 (Njord 의 시간가변 풍향과 같은 가치). 단 윙포일 1세션은 보통 1~2시간이라 시프트 영향 제한적 → 우선순위 ★ (낮음).

**구현** — Phase 3 이상. 외부 날씨 데이터 (OpenWeather Time Machine) 연동 후 권장.

### 4-5. Geo heatmap — 시즌 누적 라이딩 영역 ★

**무엇** — 시즌의 모든 세션 GPS 를 한 장의 지도 위에 heatmap (deck.gl HeatmapLayer 또는 단순 cell binning).

**왜** — 라이더 본인이 "어디를 주로 탔나" 한 호흡에. 또는 새 스팟 추천 시 시각 reference.

**구현** — Phase 3+. 단일 세션 분석에선 의미 없음.

---

## 5. 협업 인터페이스

### 5-1. Visual Designer

- **Chart 색·타이포 시스템.** §1-5 의 OKLCH 보간 / colorblind-safe alt palette 결정.
- **지도 트랙 ramp vs 속도 분포 ramp 통일 검토** (§2-2). OSM 타일 가독성 vs 시스템 일관성 trade-off.
- **Hero Summary 의 트랙 path 색 / 그라데이션 톤 (§2-1).**
- **VPS radial gauge 의 호 색·reference 마커 시각 위계 (§4-3).**

### 5-2. Sports Science

- **표시 metric 정합성.** VMG·SOG·TWA·heel·pitch·HR·target polar 의 산식 / 단위 / "좋은 방향" 검증.
- **What-if sweep 의 물리 모델 anchoring** (`whatIfAnchorVmgKt` = 우세 택 상위 20%) 적정성.
- **Target polar 산출 — 베스트 폴라의 합산 정책** (p95 vs mean, 풍속 binning) (§4-2).

### 5-3. Frontend Engineer

- **Replay Strip 구현** (§4-1). 5 인스턴스 메모리·성능, LTTB 다운샘플, 재생 컨트롤 UX.
- **Lazy 차트 로드 (IntersectionObserver) 인프라 추가** (§3-4).
- **OKLCH 보간 코드 — `RDChartTheme.statusAt` 업그레이드** (§3-4).

### 5-4. UX Researcher

- **속도 분포 파이 vs 가로 막대** 사용자 인지 비교 (§2-8).
- **Multi-axis progression vs z-score multi-line** 어느 쪽이 코칭 의사결정에 효과적인가 (§2-13).
- **Target polar % of target** 의 표시 위치·형식 (§4-2 의 numeric vs 도넛 vs 호).

---

## 6. 제약 준수 확인

| 제약 | 준수 |
|---|---|
| `chart-theme.js` 5단계 status / P/S / category / HR zone 색 토큰 의미 유지 | ✅ — §1-5 에서 분리 원칙 명시·강화. v2 권장도 토큰 위에 쌓는 방향 |
| 다크 강요 X (라이트, 리플레이 뷰어 예외) | ✅ — §2-16 에서 라이트 본체 / 다크 replay 분리 유지 |
| Phase 1 production 코드 변경 X | ✅ — 본 문서가 reference + audit + plan. 코드 1줄도 안 바꿈 |
| `feedback_dashboard_metric_direction` 준수 (좋은 방향) | ✅ — `goodness(value, direction, opts)` 의 5 방향 (higher / lower / heel / twaDown / neutral) 그대로 |
| `feedback_dashboard_viz_chart_over_table` 준수 (차트 > 표) | ✅ — 신규 viz 후보 5 종 모두 차트. 표 개선은 P2 / P3 |

---

## 7. 부록 — 출처

**프로젝트 내부**
- `site/riding-dashboard/CHART-DESIGN-SYSTEM.md` — 차트 색 4계열 분리 원칙
- `site/riding-dashboard/js/chart-theme.js` — 색·폰트 토큰 단일 소스
- `site/riding-dashboard/js/charts.js` — 16 차트 구현 (renderMap·renderSpeedChart·renderManeuverDetail·renderViolin·renderHistogram·renderHrChart·renderHrZoneBars·renderHrEff·renderTargetPolar·renderProgression)
- `site/riding-dashboard/js/app.js` — Hero Summary · vpsTile · What-if sweep
- `site/riding-dashboard/js/coach.js` — computeVPS · computeWhatIf · whatIfAnchorVmgKt
- `reference_dmjgroup_site_rules.md` — 사이트 정책 reference
- `Njord_Analytics_벤치마크_갭분석_2026-05-22.md` — 세일링 viz 벤치마크 + 갭 분석
- `대시보드_디자인일관성_정리_report_2026-05-23.md` — 스케일 토큰 도입 sweep
- `라이딩대시보드_검토배치_report_2026-05-23.md` — 5월 23일 통합 변경 (색 규칙·표 통일·SPS 점수 등)
- `퍼포먼스시각화_audit_2026-05-21.md` — (참고) 마케팅 사이트 퍼포먼스 viz audit
- `라이딩통계_대시보드_스코핑_v1.md` — 대시보드 product 스코핑 (참고)

**외부 reference**
- Edward Tufte — *The Visual Display of Quantitative Information* (data-ink ratio · chartjunk · small multiples · sparklines · graphical integrity)
- [Tufte's Principles — Community contributions for EDAV](https://jtr13.github.io/cc19/tuftes-principles-of-data-ink.html)
- [Tufte-isms — IEEE Spectrum](https://spectrum.ieee.org/tufteisms)
- [D3 by Observable — what-is-d3](https://d3js.org/what-is-d3) · [Plot for D3 Users](https://observablehq.com/@observablehq/plot-for-d3-users) · [Chart.js vs D3 — G2](https://www.g2.com/compare/chart-js-vs-observable-d3-js)
- [deck.gl — HeatmapLayer](https://deck.gl/docs/api-reference/aggregation-layers/heatmap-layer) · [What's New](https://deck.gl/docs/whats-new)
- [Vakaros Atlas 2 — Sailing Instrument](https://www.vakaros.com/products/atlas2) · [VMG and Tack Loss training](https://blog.vakaros.com/vmgtackloss)
- [SAP Sailing Analytics — GitHub (Apache 2.0, 2025-10-20 공개)](https://github.com/SAP/sailing-analytics)
- [SAP-McLaren F1 Telemetry Dashboard — Naimagon](http://naimagon.com/sap-mclaren-race-dashboard/) · [OpenF1 API](https://openf1.org/)
- [Njord Analytics — 제품 페이지](https://www.sailnjord.com/analytics/) · [Adding Wind Data](https://app.sailnjord.com/help/analytics/adding-wind-data.html) · [Maneuver Analysis](https://app.sailnjord.com/help/analytics/maneuvers.html)
- [LTTB Downsampling — Sift](https://www.siftstack.com/mission-critical/lttb-downsampling) · [TimescaleDB Toolkit Downsampling Discussion](https://github.com/timescale/timescaledb-toolkit/discussions/30)
- [Grafana Time Series visualization](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/time-series/)
- [Viridis — Colorblind-Friendly Color Maps (R)](https://sjmgarnier.github.io/viridis/) · [Sequential / Diverging / Categorical — CleanChart](https://www.cleanchart.app/blog/color-palette-types-data-visualization)
- [CET Perceptually Uniform Colour Maps](https://colorcet.com/)
- [Mobile Data Visualization — Bound](https://www.boundev.com/blog/mobile-data-visualization-design-guide) · [Adapting Data Visualization for Mobile — Data Sense](https://datasense.to/2025/05/07/best-practices-for-adapting-data-visualization-for-the-mobile-devices/)
- [Polar Curves for Performance — Evolution](https://evolution-tactic.com/en/polar-curves-for-performance/) · [Boat Polars Database](https://www.boatpolars.com/)
- [Sailing World — Get Your Performance On Target](https://www.sailingworld.com/how-to/get-your-performance-on-target/)

---

_Last updated: 2026-05-27_
_Phase 1 audit·plan 완료 — production 코드 변경 0건. Phase 2 채택 시 [§4-1, §4-2] 우선 권장._

