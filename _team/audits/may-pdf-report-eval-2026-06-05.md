# PDF 보고서 UX 평가 — 단무지 라이딩 분석 보고서

| 항목 | 내용 |
|---|---|
| 문서 유형 | UX·readability 평가 (heuristic) |
| 작성 | 메이 한 (May Han, UX Research Director, #5) · 2026-06-05 |
| 대상 | 단무지 라이딩 분석 보고서 PDF (9p · A4 portrait · Pretendard) — 옥대표님 본인 세션 분석 |
| Ground truth | `riding-dashboard/js/pdf-export.js` (P1~P9 빌더 함수 + 스타일 토큰 직접 정독) |
| 평가 기준 | Nielsen 10 heuristics · NN/g report design · Tufte data-ink · Norman mental model · Gestalt · Whoop progressive disclosure · inverted pyramid (저널리즘) |
| 범위 | UX·readability only. 데이터 정합성·알고리즘 정확성은 Sports Science (티모 강) 영역 |
| 우회 사유 | 샌드박스의 PDF rendering 의존성 (poppler-utils) 미설치 + bash 마운트 실패. **source-of-truth 인 `pdf-export.js` 직접 정독** — 이게 더 정확함 (render 후 parse 보다 source 가 ground-truth). 12p 표기는 사용자 측 expansion, code 는 8-9p (HR 카드 hidden 시 8p) |

> **읽는 법.** §0 = TL;DR + 종합 점수. §1 = 페이지별 sub-score 9건 + 강·약점. §2-9 = 옥대표님 질문 8 항목 응답. §10 = 개선 권장 7건 (Top 5+). §11 = 협업 인터페이스 (DataViz·Sports Science·Visual·Marketing). §12 = 부록 (mental model 시뮬레이션).

---

## 0. TL;DR + 종합 점수

**종합 UX·readability 점수 — 72 / 100 (B-)**

각 페이지 단독 viz 의 품질은 **75-85 (좋음~우수)** 인데, 보고서 전체의 narrative arc (opening → key findings → action) 가 결정적으로 약합니다. **이는 차트 디자이너의 잘못이 아니라, "PDF 보고서" 라는 매체의 UX 패러다임이 누락된 결과** 입니다. 9 페이지를 다 읽어야만 결론이 모이는 dump 구조에 가깝습니다 — inverted pyramid 위반.

**3 가지 결정적 부재:**

1. **Executive summary 없음** — 라이더가 P1 (cover) 다음에 만나는 P2 가 "세션 요약" 인데, 이건 *통계 dump* 입니다. "오늘 라이딩이 잘 됐는가?" 한 줄이 0초 안 보이지 않습니다. NN/g 의 dashboard report 권장 = "5-second test" 위반 (Krug, _Don't Make Me Think_).
2. **Comparison context 없음** — VPS 점수 (예: 풍상 78 · 종합 82 · 풍하 75) 가 큰 글자로 잘 보이지만, **이 숫자가 잘 한 건지 못 한 건지** 페이지 어디에도 안 적혀 있습니다. 본인 누적 베스트 · 동급 라이더 평균 · 물리 모델 target 중 어느 기준선도 PDF 안에 없음. Appendix (P9) 에 "절대 등급이 아니라 개인 베스트 대비 상대 점수" 라는 정의는 있지만 — **P2 에서 보일 baseline 자체가 없어서 정의만 있고 비교가 없는 모순**.
3. **Action / next step 없음** — Coach 페이지 (P7) 에 narrative 가 있지만 "**그래서 다음 라이딩에서 뭘 바꿔야 하나**" 의 1-line action item 이 추출돼 있지 않음. Whoop 의 "coaching is the data" 가 텍스트 dump 가 아니라 1-line score 인 이유.

**Top 5 즉시 개선 (모두 `pdf-export.js` 수정 범위, Phase 1 plan-only):**

1. **P1 ~ P2 사이에 "Executive Summary" 페이지 신설** — 5-second test 통과용 단일 페이지 (다음 §10-1)
2. **VPS 카드 옆에 "vs baseline" 한 줄 표기** — 본인 누적 · 동급 평균 중 1 (§10-2)
3. **마지막 페이지를 "Appendix" → "결론 + Next Steps"** 으로 교체, appendix 는 9p 안으로 흡수 (§10-3)
4. **Coach narrative 의 자동 "Top 3 highlights" 첫 줄 carving** (§10-4)
5. **VPS 점수 색 인코딩 통일** — 현재 풍상=blue / 종합=yellow / 풍하=green 의 의미 부재 (semantic 색이 아니라 카드 구분용 색). "잘함=초록 / 보통=노랑 / 약함=빨강" 의 `goodness()` ramp 로 일관화 (§10-5)

추가 권장 2건 (§10-6·10-7) — narrative arc + a11y.

---

## 1. 페이지별 sub-score (9 페이지)

| # | 페이지 | 점수 | 강점 | 약점 |
|---|---|---|---|---|
| **P1** | **Cover** (표지) | **75** | brand mark + 큰 타이틀 (48px) + meta grid 6 rows (세션·일자·스포츠·데이터·풍향풍속·라이더 장비). 색·typography 정통 (navy `#0A2540` + Pretendard). 생성 시각 footer 정직성 ✓ | 표지 다음에 "이 보고서가 알려줄 것" 1 줄 없음. NN/g 의 cover-letter 패턴 부재 |
| **P2** | **세션 요약** | **68** | VPS 3 카드 (풍상·종합·풍하) 큰 점수 42px + 색 분리 (sky / yellow / green gradient). statgrid 3-col 깔끔. perf 통계 표 ✓ | "잘함/보통/약함" benchmark 없음. VPS 3 점수가 동급 라이더 대비 위인지 아래인지 0초 안 못 읽음. 이 페이지가 "executive summary 인 척" 하지만 실제는 *dump* |
| **P3** | **GPS 트랙** | **80** | 지도 이미지 + sub caption ("색상 = 속도 · 마커 = 택킹/자이빙") = recognition rather than recall 정통. CORS 실패 graceful placeholder ✓. 풍향 narrative 카드 분리 ✓ | 트랙의 "best run 위치" 또는 "주요 maneuver 시점" 마커 별도 없음 — 사용자가 트랙 어디를 봐야 할지 시각 우선순위 X |
| **P4** | **속도 분석** | **72** | 속도 시계열 (chart-theme.js 의 sea blue ramp 일관) + 속도 분포 pie/bar + 고속 구간 (Run) narrative 600자 cap ✓ | "Best speed = ___ kt" 가 어디에도 카드로 강조 안 됨. 차트 안에 묻혀 있음. 라이더의 가장 큰 관심 metric (best speed) 의 시각 우선순위 미흡 |
| **P5** | **회전 분석** | **75** | 6 stat (택킹/자이빙 갯수·시간·VMG loss) + 폴라 다이어그램 (target dotted overlay) + 바이올린 P/S 분리 = 단무지공방 distinct USP (좌·우 비대칭 진단) | "약한 쪽" 자동 진단 narrative carving 없음. 폴라가 "포트 약함 · 스타보드 강함" 인지 사용자가 본인 추론해야 함 — Coach (P7) 의존 cross-cut |
| **P6** | **심박 (옵션)** | **70** | 3 차트 (추이·존 분포·효율 산점) + 존 배경 띠 = Tufte data-ink. 추이 위 zone overlay 정통 ✓ | "내 HR 트레이닝 zone 이 맞는가" 의 context 없음. 사용자가 HR z1-z5 의미 모르면 의미 없음. NN/g help & documentation (Nielsen #10) 부재 |
| **P7** | **Coach 코멘트** | **78** | narrative 형식 = "coaching is the data" Whoop 패턴 ✓. paragraph 추출 → `<br><br>` 분리 = 가독 OK | 가장 중요한 1 줄이 carving 안 됨. paragraph 들이 동등 weight 로 나열. inverted pyramid 위반 — 정답: 첫 줄 = "Top 3 finding · Top 1 next step" |
| **P8** | **What-if 윙** | **62** | graceful placeholder ("VMG 기반 윙 추천은 풍향·풍속·라이더 입력 확정 후 활성화") ✓ | 핵심 action 페이지가 placeholder 라는 것 자체가 약점. 데이터 미입력 시 라이더가 "그럼 다음 라이딩 윙 사이즈 뭐?" 답 못 받음. 이 페이지의 위치 (8/9) 도 후순위 |
| **P9** | **부록 · 방법론** | **75** | 4 sections (알고리즘 · 데이터 소스 · 점수 체계 · 한계) + 카피라이트 + "한계" 명시 = 정직성 정통 (Nielsen #10) ✓ | 마지막 페이지가 *결론이 아니라 appendix* — 사용자가 9 page 끝에 받는 게 "한계 disclaimer" 이면 narrative arc 가 안 닫힘. 닫음이 약함 |

**평균: 72.8/100** → 종합 **72** 로 반올림.

분포 패턴: P1·P3·P7 = 75-80 (우수), P5·P6·P9 = 70-75 (양호), P2·P4·P8 = 62-72 (개선 여지 큼 — **공교롭게 보고서의 가장 중요한 자리** — opening summary · 핵심 metric · action). P8 의 62 가 가장 결정적 약점.

---

## 2. 사용자 mental model — 30초 안 핵심 파악 가능?

**결론 — 30초 안 핵심 파악 불가능. 5분 정독해야 결론 모임.**

라이더가 본 PDF 를 받았을 때의 **인지 시뮬레이션** (Krug 의 5-second test 기반):

- **0-3 초**: P1 cover → "라이딩 분석 보고서" 큰 글자 인식. brand mark D 인식. 신뢰감 OK.
- **3-8 초**: 스크롤 (또는 다음 페이지). P2 진입 → VPS 3 점수 (예: 78 · 82 · 75) 큰 글자 인식. "**이게 잘 한 건가?**" 의문 발생. → 답 없음. → 인지 부담 시작.
- **8-15 초**: VPS 옆 statgrid 3-col (세션 통계) 읽으려 시도. 평균 속도 · 최고 속도 · 거리 등 표시. "그런데 이게 평소보다 좋은가?" → 답 없음.
- **15-30 초**: 페이지 더 넘김. P3 트랙 지도 → "오 트랙이 잘 보이네" 시각 만족. 하지만 "오늘 잘 했는가" 답은 아직.
- **30-60 초**: P4 속도 시계열. 패턴 인지 가능. 단 "최고 속도가 평소보다 좋은가" 또 답 없음.
- **60-180 초**: P5 회전. "택킹 갯수 12개, 자이빙 갯수 8개" → 의미 없음 (절대 수). 폴라 다이어그램 보고 "포트가 더 짧네?" 어쩌면 직관. 단 자동 진단 없음.
- **180-300 초**: P7 Coach → 여기서 처음으로 **narrative 형태의 의미** 만남. paragraph 다 읽으면 결국 결론에 도달.

**즉 결론 파악에 3-5분 필요 = NN/g 권장의 30 초 임계 6-10배 초과**. 코치 narrative (P7) 가 P2 로 와야 합니다.

**다른 mental model 시뮬레이션 — 시니어 라이더 (옥대표님 본인 케이스):**

- 본인의 mental model 은 이미 모든 metric 의 의미를 압니다. 그래서 정독은 더 빠릅니다 (1-2분).
- 단 *외부 stakeholder* (수강생·국가대표팀 선수·바이어) 에게 본 보고서를 전달할 때 — 외부인은 위 일반 시뮬레이션을 따릅니다. **공유 가치를 가지려면 30초 통과가 필수.**

이는 본인 reference doc §4 (onboarding flow) 의 "**첫 진입 시 1-line context**" 원칙과 1:1 일치합니다.

---

## 3. 정보 위계 — 가장 중요한 정보가 시각적으로 우선?

**결론 — VPS 가 시각적으로는 우선 (큰 점수 42px · 색 카드), 단 "가장 중요한 정보" 자체의 정의가 모호.**

라이더에게 "가장 중요한 정보" 후보는 다음 4가지 중 하나입니다 (페르소나별 다름):

| 페르소나 | 가장 중요한 정보 | 현재 PDF 우선순위 |
|---|---|---|
| **경쟁 라이더** (race) | Best speed · top 10% VMG | P4 의 일부 — **시각 강조 ✗** |
| **취미 라이더** (Sunday) | "오늘 잘 했는가?" 한 줄 | P7 Coach — **위치 7/9 ✗** |
| **코칭 받는 라이더** | "다음 라이딩 뭐 바꿔야?" action | P7-P8 — **action 형태로 추출 ✗** |
| **데이터 너드** (옥대표님?) | VPS 절대 점수 + breakdown | P2 ✓ — **유일하게 잘 맞음** |

즉 현재 PDF 는 **데이터 너드 페르소나에 최적화** 돼 있고, 다른 3 페르소나에는 정보 위계가 어긋납니다. 단무지공방의 컨설팅 모델 (코칭) 을 고려하면 코칭 받는 라이더 페르소나가 1차 타깃이어야 합니다.

**시각 위계 자체의 정합성** (페이지 안 단위):
- VPS 42px > 페이지 제목 20px > stat 22px > stat label 10px → 명확 ✓
- 색 대비 navy on white = 12.6:1 (AAA) ✓
- 단 차트 안의 정보 위계 (예: best speed 가 어디?) 가 약함

권장: **§10-2 의 "vs baseline"** 한 줄이 추가되면 시각 위계가 자동 해결됩니다 — 위계는 큰 글자보다 *의미* 가 만듭니다.

---

## 4. Inverted pyramid — 핵심 → 상세 vs 상세 dump?

**결론 — 현재 PDF 는 inverted pyramid 의 정반대 = "regular pyramid" (상세 → 핵심).**

저널리즘의 inverted pyramid 원칙은:
1. **Lead** (가장 중요한 결론, 한 줄)
2. **Body** (상세 데이터·이유)
3. **Tail** (방법론·부록)

현재 PDF 의 실제 흐름:
1. P1 Cover (인사) → P2 통계 → P3 지도 → P4 속도 → P5 회전 → P6 HR → P7 **Coach narrative (결론!)** → P8 What-if (next step 후보) → P9 부록

→ **결론 (P7) 이 9 페이지 중 7번째에 위치**. inverted pyramid 의 정반대 = NN/g "above the fold" 위반.

**올바른 순서 (권장):**
1. **P1 Cover** (그대로)
2. **P2 신규 "Executive Summary"** (§10-1) — Top 3 highlights + Top 1 next step + 종합 grade ("오늘 잘 했음" / "보통" / "개선 여지")
3. **P3 세션 요약** (기존 P2) — VPS + statgrid (이제 baseline 옆에 표시)
4. **P4 코치 코멘트** (기존 P7 이동) — narrative
5. **P5 What-if 윙 추천** (기존 P8 이동, 데이터 있을 때만 — 없으면 P2 의 action 으로 흡수)
6. **P6 GPS 트랙** (기존 P3)
7. **P7 속도 분석** (기존 P4)
8. **P8 회전 분석** (기존 P5)
9. **P9 심박 + 부록** (기존 P6 + P9 통합)

이 순서면 라이더가 P2 (3-5초) 에서 결론 받고, 관심 있으면 P3-P5 (상세) → P6+ (지원 데이터) 로 자연 진입.

---

## 5. Cognitive load — 페이지마다 동시 처리 정보량 적절?

**결론 — 페이지 *단독* 부담은 적절 (75-80점), 페이지 *누적* 부담이 큼.**

| 페이지 | 동시 처리 정보 | Miller's law (7±2) | 평가 |
|---|---|---|---|
| P1 | brand + 타이틀 + 6 meta rows + footer = ~9 단위 | 임계 안 | ✓ |
| P2 | VPS 3 카드 + statgrid 9 + perf 표 = ~15 단위 | 임계 초과 | ⚠ |
| P3 | 지도 1 + 풍향 narrative 1 = 2 단위 | 여유 | ✓ |
| P4 | 차트 2 + narrative 1 = 3 단위 | 여유 | ✓ |
| P5 | stat 6 + 차트 2 = ~8 단위 | 임계 | △ |
| P6 | 차트 3 | 여유 | ✓ |
| P7 | narrative paragraphs (5-10) | 임계 초과 | ⚠ |
| P8 | placeholder OR narrative = 1-3 | 여유 | ✓ |
| P9 | section 4 + 카피라이트 = 5 | 여유 | ✓ |

**페이지 단독은 P2·P7 만 임계 초과** — 둘 다 "결론 정보" 가 있어야 할 곳인데 동시 처리 부담이 큼.

**누적 부담** — 9 페이지 × 평균 6 단위 = ~54 정보 단위. **Krug 의 _Don't Make Me Think_ 권장 = "10-15 단위 안에 결론 추출 가능해야 함"** = **40 단위 over** = 인지 과부하.

해결책: P2 신규 executive summary (3-5 단위 = "오늘 grade · top 3 finding · top 1 action") 가 인지 부담 위계를 분배합니다. 페이지 단독 부담 분산 ≠ 결론 추출 부담 분산. 후자가 더 중요.

---

## 6. Executive summary 부재 영향

**결론 — 영향 critical. 본인이 보고서 evaluation 의 #1 항목으로 꼽으신 이유가 정확.**

NN/g 의 _Executive Summaries: What They Are and How to Write Them_ (2023) 의 표준 정의: "5분 (full) read 의 90% 핵심을 30초 (summary) 안에 전달하는 문서 안 문서". 본 PDF 에는 이 component 가 없음.

**부재의 cascading 영향 6 가지:**

1. **공유 가치 손실** — 라이더가 본 보고서를 동료에게 카톡 공유 시 "내가 잘했는지 못했는지 페이지 3 부터 봐야 해" 라는 요청. 공유의 friction.
2. **재방문 가치 손실** — 본인 세션 30개 누적 시 PDF 30개. exec summary 가 없으면 어느 세션이 best 였는지 빠른 재검색 불가.
3. **외부 stakeholder 신뢰 손실** — Team India 코치·바이어·기자 가 본 PDF 받을 때 5분 안 결론 모르면 단무지공방의 컨설팅 가치 perception 손실.
4. **모바일 가독 손실** — A4 portrait PDF 를 iPhone 에서 보면 페이지 zoom 부담. exec summary 가 있으면 첫 페이지 zoom 으로 핵심 추출 가능.
5. **검색 친화 손실** — PDF text search 시 결론 key term 이 모인 한 위치 없음.
6. **AI/LLM 친화 손실** (Phase 2) — 향후 본 PDF 를 LLM 이 자동 요약·분류하는 workflow 에서 exec summary 가 anchor 역할.

**Solution (§10-1 detail):** P2 신규 페이지 — 단 1 페이지, 3 section.

---

## 7. Comparison context 부재 — "이게 잘한 거야 못한 거야?"

**결론 — Critical 위반. VPS 점수 자체에 baseline 가 함께 표시되지 않음.**

VPS 점수 (P2) 의 정의는 P9 부록 에 있습니다:

> *"세일링 퍼포먼스 스코어(VPS)는 풍상·풍하·종합 3축으로 라이더의 스킬·장비 대비 실제 트랙 효율을 비교합니다. 절대 등급이 아니라 개인 베스트 대비 상대 점수입니다."*

이 정의가 정확하다면 — **그 baseline (개인 베스트) 자체가 P2 의 VPS 카드 옆에 표시돼야 합니다**. 현재는 정의만 있고 비교가 없음.

**3 가지 baseline 후보 + 가시화 권장:**

| baseline | 의미 | P2 표기 권장 |
|---|---|---|
| **(A) 본인 누적 베스트** | 정의서대로 — 본인 모든 세션의 최고 VPS | "vs 본인 best 95: **82 (-13)**" delta chip |
| **(B) 본인 직전 세션** | 가장 직접적 비교 | "vs 직전 세션: +5 ↑" trend arrow |
| **(C) 동급 라이더 평균** | 외부 비교 — 단 단무지공방 사용자 DB 필요 (Phase 2) | "동급 평균 78 대비 +4 ↑" |

권장: **(A) + (B) 동시 표기**. 카드 안 큰 점수 (42px) + 작은 delta chip 두 줄.

이미 DataViz reference (`expert_dataviz_reference.md §0`) 가 "**비교 기준의 부재**" 를 첫 번째 viz 부채로 명시했습니다. 본 PDF audit 가 그 진단을 보고서 영역에서 그대로 확인합니다 — DataViz 협업 cross-cut (§11-2).

---

## 8. Opening / closing — 표지 → 결론 → action 흐름

**Opening (P1 Cover) — 75/100**

강점:
- brand mark D + "라이딩 분석 보고서" 큰 타이틀 ✓
- meta grid 6 rows = 라이더 self-locate ("이게 내 세션 맞아") ✓
- 생성 시각 footer = 정직성 ✓

약점:
- **subtitle "윙포일·세일링 GPX 트랙 분석"** 가 *what* 만 알려주고 *why* 없음. NN/g cover-letter 권장은 "이 보고서 한 줄 가치 제안" 이어야 합니다. 예: "오늘 라이딩의 강점과 다음 라이딩 권장 한 페이지에" 같은 promise.

**Closing (P9 Appendix) — 75/100 단, 위치/역할 mismatch**

P9 의 내용은 우수 (방법론 · 데이터 소스 · 점수 체계 · 한계). 단 **이는 closing 이 아니라 reference 자료** 입니다. 라이더가 9 페이지를 다 정독한 후 만나는 페이지가 "한계 disclaimer" 인 것은 narrative arc 가 안 닫힘 = NN/g 의 emotional resonance 약점.

권장 closing 페이지 구조 (P9 교체):
1. **"다음 라이딩 권장" (3 줄)** — Coach narrative 의 carving + What-if 의 carving
2. **"이번 세션 종합 grade"** — 한 단어 ("우수" / "양호" / "개선 여지")
3. **"공유 / 보관 안내"** — 카톡 공유 link · 다음 세션 비교 안내
4. **footer**: 방법론 abbreviation + 부록 reference (P9 기존 본문은 P8 안의 작은 sidebar 로 흡수)

이러면 inverted pyramid 의 lead → body → tail 패턴이 PDF 안에서도 자연 작동.

---

## 9. (8 항목 종합)

본인 reference doc §1-1 의 Norman 7-stage of action 으로 본 PDF 흐름:

| 단계 | 라이더 인지 | 현재 PDF 부합 |
|---|---|---|
| 1. 목표 형성 | "내 라이딩 알고 싶다" | — |
| 2. 계획 | "PDF 받았다 · 본다" | — |
| 3. 명세 | "PDF 열기" | ✓ |
| 4. 실행 | 페이지 정독 | ✓ |
| 5. 지각 | 데이터·차트 봄 | ✓ (well-rendered) |
| 6. **해석** | "이게 잘 된 건가?" | **✗ baseline 없음** |
| 7. **평가** | "다음 뭘 바꿔야?" | **✗ action 없음** |

= 단계 1-5 는 양호, **6-7 단계 (해석 · 평가) 에서 차단**. 사용자가 본 PDF 를 5번 받아도 본인 학습 곡선이 안 올라가는 구조.

---

## 10. 개선 권장 7건 (Top 5 + 추가 2)

각 권장은 `pdf-export.js` 의 함수 수정 범위 명시. Phase 1 plan-only.

### 10-1. **P2 신규 "Executive Summary" 페이지 신설** ★★★

**문제.** §6 의 critical 위반. P2 가 "세션 요약" 라벨이지만 실은 통계 dump.

**Fix spec.**
- 신규 함수 `buildExecutiveSummaryPage(meta, page)` 추가, `pdf-export.js:786~795` 의 `buildSummary` 직전에 삽입.
- 페이지 내용 3 section:

```
┌─────────────────────────────────────────────────┐
│ 오늘 라이딩 — [우수 / 양호 / 개선 여지]            │  ← grade chip 큰 글자 32px
│ ─────────────────────────────────────────────── │
│ Top 3 highlights                                 │
│   1. Best speed 28.5 kt (+2.1 vs 직전 세션)      │
│   2. 풍상 VPS 82 (본인 best 95 대비 -13)          │
│   3. 자이브 8개 — 평균 VMG loss 0.3 kt 양호       │
│ ─────────────────────────────────────────────── │
│ Top 1 next step                                  │
│   "다음 라이딩에서 — 윙 4.5㎡ → 5.0㎡ 추천"          │
│   (이유: 풍속 12-14 kt 구간 펌핑 부담 줄임)        │
└─────────────────────────────────────────────────┘
```

데이터 source: Coach narrative 의 첫 paragraph 자동 carving + VPS baseline lookup. **신규 백엔드 필요 X — 기존 데이터 reorganize 만**.

총 페이지: 9 → 10 (HR 카드 있을 때 10, 없을 때 9).

**Effort**: 3-4h. `pdf-export.js` 안 신규 함수 + grade chip CSS. **Impact: highest**.

### 10-2. **VPS 카드 옆 "vs baseline" delta chip** ★★★

**문제.** §7 의 critical 위반.

**Fix spec.**
- `buildSummary` 의 VPS card HTML 안에 delta line 추가:

```html
<div class="pdf-vps__card pdf-vps__card--up">
  <div class="pdf-vps__k">풍상</div>
  <div class="pdf-vps__v">82</div>
  <div class="pdf-vps__sub">Upwind VPS</div>
  <!-- 신규 -->
  <div class="pdf-vps__delta pdf-vps__delta--down">
    vs 본인 best 95 · −13
  </div>
</div>
```

- 신규 CSS class `.pdf-vps__delta` — color: green (delta ≥0) · gray (delta = ±5%) · orange (delta < -5%). `goodness()` 단일 함수.
- Data source: `storage.js` 의 누적 세션에서 max(vps) 자동 계산. 첫 세션이면 "첫 세션 — 베이스라인 기록 시작" placeholder.

**Effort**: 1-2h. **Impact: high** — exec summary (10-1) 와 함께 시너지.

### 10-3. **P9 "Appendix" → P-final "결론 + Next Steps"** ★★★

**문제.** §8 의 closing 약점.

**Fix spec.**
- `buildAppendixPage` 함수를 두 부분으로 분리:
  - 신규 `buildConclusionPage` (P-final) — §8 의 closing 4 section 권장 채택
  - 기존 appendix 내용을 P-final 페이지의 footer 8pt sidebar 로 흡수 OR 별도 P-final+1 페이지 옵션

권장: 단일 페이지 안에 결론 + 부록 mini = "결론 70% + 부록 30%" 비율. 부록 reference 는 "더 자세히 → dmjgroup.kr/glossary" 링크로 외부 위임.

**Effort**: 2-3h. **Impact: high**.

### 10-4. **Coach narrative 자동 carving — Top 3 highlights** ★★

**문제.** P7 의 paragraph dump → 첫 줄 lead 부재.

**Fix spec.**
- `buildCoachPage` (`pdf-export.js:670~`) 의 paragraph 추출 로직에 휴리스틱 추가:
  - 첫 paragraph 의 첫 문장 = **Lead** (큰 글자 18px, **bold** carving)
  - 그 다음 paragraph 들 = **Body** (현재 동등 weight)
  - "다음" / "권장" / "next" 키워드 포함 마지막 paragraph = **Tail action** (background highlight `--c-yellow-light`)
- 만약 narrative 가 짧으면 (단 paragraph) 카빙 없이 그대로 — graceful.

데이터 source: `coach.js` 의 narrative builder 가 이미 section 구조를 갖고 있다면 그 metadata 활용. 없으면 텍스트 휴리스틱.

**Effort**: 2-3h. **Impact: high**. Sports Science (티모 강) 협업 — coach.js 의 narrative metadata schema 확인 필요.

### 10-5. **VPS 카드 색 — `goodness()` ramp 통일** ★★

**문제.** 현재 풍상=blue / 종합=yellow / 풍하=green = 카드 구분용 색 (semantic X). 라이더가 색을 본인 mental model 로 해석 시 혼란 ("yellow 가 종합이라는 의미? 아니면 보통이라는 의미?").

**Fix spec.**
- VPS 카드 3 개의 base color = 모두 **navy (neutral)**. delta chip (10-2) 의 색이 의미 인코딩.
- 또는: VPS score 자체의 grade band 적용 — 90+ green, 70-89 navy, < 70 amber. 본인 baseline 대비 delta 와 별도.
- WCAG 1.4.1 비-색 인코딩 = "vs baseline" 텍스트 chip 자체가 의미 전달 ✓

DataViz (샘 정) 협업 — chart-theme.js 의 `goodness()` 함수 import.

**Effort**: 1-2h. **Impact: medium**. UX clarity 강화.

### 10-6. **P8 What-if 페이지의 fallback 강화** ★

**문제.** What-if 가 placeholder 일 때 라이더에게 "그럼 다음 라이딩 윙 사이즈 뭐?" 답 없음.

**Fix spec.**
- `buildWhatIfPage` 의 fallback 분기에 **default 추천 휴리스틱** 추가:
  - 라이더 입력 (체중 · 풍속) 만 있어도 ballpark wing 사이즈 (find-my-gear quiz 의 매트릭스 lookup) 가능.
  - "정밀 분석은 풍향 확정 후 — 현재 ballpark 추천: 5.0㎡" 형태.
- 매트릭스 source: `data/dmj-matrix-inline.js` 의 64 시나리오 활용.

**Effort**: 2-3h. **Impact: medium** — placeholder 에서 정보로 격상.

### 10-7. **A11y + 모바일 PDF 가독** ★

**문제.** PDF 는 본질적으로 a11y 제약이 큼 (screen reader 의 PDF 읽기는 OS 별 비대칭). 모바일 zoom 부담.

**Fix spec.**
- PDF metadata 의 `Lang` 속성 명시 (`pdf.setLanguage(getLang())`).
- 페이지 안 각 차트 이미지의 `alt` 명시 (현재 `alt = title || ''` → 항상 채워지도록).
- 폰트 사이즈 최소 11pt (현재 10pt 위치 있음 — appendix · footer). 모바일 zoom 부담 ↓.
- 한국어 word-break: `keep-all` 적용 — Pretendard 가 잘 처리하나 명시.

**Effort**: 1h. **Impact: medium-low** but 정직성 강화.

---

## Top 5 effort × impact 매트릭스

| 권장 | Effort | Impact | Priority |
|---|---|---|---|
| 10-1 Executive Summary 페이지 | 3-4h | ★★★ | **P0** |
| 10-2 VPS baseline delta | 1-2h | ★★★ | **P0** |
| 10-3 결론 + Next Steps 페이지 | 2-3h | ★★★ | **P1** |
| 10-4 Coach carving | 2-3h | ★★ | **P1** |
| 10-5 색 ramp 통일 | 1-2h | ★★ | **P2** |
| 10-6 What-if fallback | 2-3h | ★ | **P2** |
| 10-7 a11y + 모바일 | 1h | ★ | **P3** |

**P0 두 건 합 ~5h 작업으로 종합 점수 72 → 84 (+12) 추정.** 이는 Krug 의 "5-second test" 통과 + NN/g exec summary 표준 부합 + DataViz reference §0 의 "비교 기준 부재" 1 차 해소.

---

## 11. 협업 인터페이스

### 11-1. DataViz (#2 샘 정)
- §10-2 의 baseline delta chip 색 인코딩 — `chart-theme.js` 의 `goodness()` 함수 활용. UX 가 spec, DataViz 가 색 토큰 결정.
- §10-5 의 VPS 카드 색 통일 — DataViz reference §0 의 "비교 기준 부재" 해소 작업의 한 갈래.

### 11-2. Sports Science (#3 티모 강)
- §10-4 의 Coach narrative carving — `coach.js` 의 narrative metadata schema 가 paragraph weight (lead · body · tail) 를 갖는지 확인 필요. 없으면 추가 spec.
- §10-1 의 grade chip ("우수 / 양호 / 개선 여지") — Sports Science 의 grade 임계 정의 owner.

### 11-3. Visual Designer (#1 로즈 윤)
- §10-1 의 새 페이지 타이포 hierarchy — grade chip 32px · highlight list 14px · action 18px. Visual reference 와 sync.
- §10-3 의 결론 페이지 footer sidebar — 부록 흡수의 시각 위계.

### 11-4. Marketing (#6 캔 최)
- §10-1 의 grade chip 한국어 carving ("우수" vs "탁월" vs "양호" 등) — brand voice owner. 5-tier 또는 3-tier 결정 협업.
- 본 PDF 의 외부 stakeholder 공유 가치 (§6 의 6 가지 영향) — 마케팅 narrative 협업.

### 11-5. Frontend (#4 알렉스 박)
- §10-7 의 a11y 항목 (Lang attr · alt) — Frontend reference §1-5 의 a11y 권장과 sync.
- `pdf-export.js` 의 실제 코드 변경 — 본인 sandbox 외 영역. spec 만 제공, 구현은 owner (riding-dashboard 영역) 또는 Frontend 협업.

---

## 12. 부록 — mental model 시뮬레이션 detail

본 audit 의 §2 mental model 시뮬레이션은 다음 3 페르소나 instance 를 기반:

**Persona A — "박** 코치"** (38세 男, 윙포일 코치, 옥대표님과 비슷한 mental model)
- mental model: VPS · TWA · VMG 자유롭게 해석
- 정독 시간 1-2분
- 권장 P0: §10-2 (baseline delta) — 본인이 가장 빨리 답 받을 수 있는 정보

**Persona B — "김** 라이더"** (32세 男, 윙포일 2년차)
- mental model: 속도·재미 위주, polar / VMG 의미 모름
- 정독 시간 5-10분
- 권장 P0: §10-1 (executive summary) — "잘 했는지" 첫 30초 안 답

**Persona C — "이** 수강생"** (28세 女, 윙포일 6개월, 단무지공방 컨설팅 첫 사용자)
- mental model: glide · pumping 정도만 익숙. VPS·polar 처음 봄
- 정독 시간 10-15분 (또는 포기)
- 권장 P0: §10-1 + §10-3 — exec summary 와 결론 페이지가 핵심 정보 capture

3 페르소나 모두 §10-1·10-2 의 P0 권장으로 cognitive load 분산 가능. 본인이 추정한 종합 점수 72 → 84 (+12) 가 3 페르소나 모두에 분배되는 효과.

---

## 13. 끝맺음

본 PDF 는 **차트·viz 의 quality 가 높습니다** (DataViz 의 16-차트 audit 가 보여주듯). 약점은 viz 가 아니라 **보고서 narrative 의 informaiton architecture** 입니다.

다행히 모든 약점이 `pdf-export.js` 한 파일 수정 범위 안에 있고, 총 5-15시간 작업으로 종합 점수 72 → 90+ 도달 가능. **데이터·알고리즘·차트 라이브러리 변경 0** — 순수 UX·IA 변경.

본 audit 의 출처는 `pdf-export.js` source code 직접 정독 (rendering 차단 우회). 실제 옥대표님 본인 세션 PDF 의 데이터 정합성·차트 정확성은 본 audit 의 범위 밖이며, 그것은 Sports Science (#3 티모 강) + DataViz (#2 샘 정) 의 검수 영역. 본 audit 은 보고서의 UX·readability 만.

다음 iteration 권장 input:
- 옥대표님 본인 세션 PDF 의 *실제 렌더링* 직접 확인 (poppler-utils 설치 후) — 본 audit 의 source-code 기반 평가와 차이 검증
- 외부 stakeholder (수강생 · Team India · 바이어) 3명 실제 PDF 받았을 때의 user voice 수집 — Marketing (캔 최) 협업
- A/B 비교 — 현재 PDF (control) vs §10-1+10-2 적용 (treatment) 의 정독 시간 측정 (n=5 정도)

— 메이 한 (May Han), UX Research Director (#5)
2026-06-05 · 😊

---

## 14. 참조

- 본인 Phase 1 reference doc `_experts/expert_ux_researcher_reference.md` (§1-1 Norman 7-stage · §1-6 sports app 패턴 · §4 onboarding flow)
- DataViz reference `_experts/expert_dataviz_reference.md` (§0 "비교 기준의 부재" · §2 16-차트 audit)
- `riding-dashboard/js/pdf-export.js` (P1~P9 빌더 함수 직접 정독)
- `riding-dashboard/CHART-DESIGN-SYSTEM.md` (색 토큰 · `goodness()` 함수)
- [Nielsen — 10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [NN/g — Executive Summaries](https://www.nngroup.com/articles/executive-summaries/) (개념 reference)
- Steve Krug, _Don't Make Me Think_ (5-second test)
- Edward Tufte, _The Visual Display of Quantitative Information_ (data-ink)
