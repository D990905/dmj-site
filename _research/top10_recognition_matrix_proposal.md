# Top 10 Deep-Learning 후보 — 인지도·정통성 매트릭스 + 전략 제안

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1 (Danny strategic confirm 대기) |
| 작성일 | 2026-05-27 |
| 목적 | 시중 36개 sailing analytics 제품 (35 + ChartedSails) 중 **시중 인지도 + 알고리즘 정통성 + 우리 moat 설계 input** 의 가중치로 Top 10 선정 |
| 검수 기준 | 모든 score 는 1차 audit 카드 (`sailing_analytics_landscape_audit.md` §2.A–F + §B2-Deep + §B9) 에서 도출된 출처 기반. 추측 0. |
| 본 문서 후속 | Danny confirm → 미선정 8개 (Njord·ChartedSails 제외) 에 대해 PhD 검수 수준 deep-dive 진행 |

---

## 1. 6 축 인지도·정통성 평가 기준 (Danny 명시)

| 축 | 가중치 | 측정 지표 |
|---|---|---|
| **G1. 분석 SW 정통성** | 높음 | 공개 알고리즘 docs/논문/patent 수, 인용 빈도, 학술적 신뢰성 |
| **G2. Pro racing 사용** | 높음 | SailGP·TP52·Olympic·America's Cup·VOR 사용 사례 |
| **G3. Sailing forum mentions** | 중 | Sailing Anarchy / Reddit r/sailing·r/foiling·r/wingfoil 멘션 빈도 |
| **G4. App store / install footprint** | 중 | iOS·Android 리뷰 수·평점, AppBrain·data.ai 다운로드 추정 |
| **G5. YouTube / media presence** | 중 | YouTube 시연 view count, Yachting World·Practical Sailor·Boat Test 리뷰 |
| **G6. 한국·글로벌 양쪽 인지도** | 중 | 한국어 검색·네이버·클리앙·인스타·유튜브 한국어 콘텐츠 빈도 |

추가 SailTechCo 전략 가중치 (Danny 의 "차원이 다른 서비스" moat 설계 input):
- **S1. 우리가 학습할 UX 패턴이 풍부한가**
- **S2. 우리가 차별화·outperform 할 명백한 wedge 가 있는가**
- **S3. 단무지공방의 윙포일 freeride 1인 타깃에 직접 비교 가능한가**

---

## 2. 36 개 제품 인지도 매트릭스 (요약, 1차 카드 기반)

> 정량 출처 부재 항목은 "(공개 출처 미확인)". 점수는 **상/중/하** 3등급 + 정량 인용. 추측 0.

### Cluster A — Pro racing / Olympic

| # | 제품 | G1 정통성 | G2 Pro 사용 | G3 Forum | G4 App | G5 YouTube | G6 한국 | **종합** |
|---|---|---|---|---|---|---|---|---|
| A1 | **Vakaros Atlas 2** | 상 (공개 [VMG/Tack Loss blog](https://blog.vakaros.com/vmgtackloss)) | 상 (TP52→Opti, Sailmon 인수 2025-03) | 상 ([SA Vakaros 스레드 page 6+](https://forums.sailinganarchy.com/threads/vakaros.250212/page-6)) | 중 (companion app) | 상 ([Practical Sailor 리뷰](https://www.practical-sailor.com/marine-electronics/vakaros-atlas-2-sailing-instrument-profile/)) | 하 | **TOP 10 ★** |
| A2 | SAP Sailing Analytics | 상 ([GitHub open source 2025-10](https://github.com/SAP/sailing-analytics)) | 상 (Paris Olympic·SailGP·AC) | 하 (운영자 대상) | N/A (이벤트 SW) | 중 | 하 | **TOP 10 ★** (open source 가치 절대적) |
| A3 | Expedition | 상 (30년+, [Nick White 직접 응답](https://forums.sailinganarchy.com/threads/routing-software-expedition-v12.241985/)) | 상 (VOR·AC·GP 디폴트) | 상 | N/A (Win desktop) | 중 | 하 | **TOP 10 ★** |
| A4 | Deckman | 상 (Dr. Stuart Winn AC 알고리즘 1980s 유산) | 상 (VOR 클래식) | 중 | N/A | 하 | 하 | **honorable mention** |
| A5 | Adrena | 중 (프랑스 오프쇼어 표준, Vendée Globe) | 중 | 하 (영어권 인지도 낮음) | N/A | 하 | 하 | 11위권 |
| A6 | KND SailingPerformance (SPS) | 상 (Ocean Race 5중 4우승 분석) | 상 | 중 | N/A | 하 | 하 | 11위권 |
| A7 | WTP3 (B&G Hercules) | 상 (Wave Tech 모션 보정) | 상 (GP/AC급) | 중 | N/A | 하 | 하 | 11위권 |

### Cluster B — 컨슈머·클럽 racing

| # | 제품 | G1 | G2 | G3 | G4 | G5 | G6 | 종합 |
|---|---|---|---|---|---|---|---|---|
| B1 | Vantage Sailing | 중 (ML wind 2.0, AC 38 분석가 창업) | 상 (AC 38 출신) | 하 (신생) | 하 ("no ratings yet") | 하 | 하 | 11위권 (너무 신생) |
| **B2** | **Njord Analytics** | 상 (User Guide 광범위) | 상 (Olympic·GP) | 상 | N/A (web) | 중 | 하 | **TIER 0 (이미 deep-dive 완료)** |
| B3 | TackTracker | 중 (15년+) | 중 (Etchells Worlds) | 중 | (공개 출처 미확인) | 하 | 하 | 외 |
| B4 | RaceQs / Kattack | 하 ([2025 dying](https://www.breakwaters.org/1706-2/), Kattack "worst app ever") | 하 | 하 | 부정 다수 | 하 | 하 | 외 (교훈용) |
| B5 | iRegatta Pro | 중 (15년+, $19.99 one-time) | 중 | 중 | 중 ([4.5/5, 6 ratings 작음](https://apps.apple.com/us/app/iregatta-pro/id334632033)) | 하 | 하 | 외 |
| B6 | SailRacer + inkDisplay | 중 (e-paper 하드웨어) | 중 (딩기 35 EUR/yr) | 중 ([Panbo 리뷰](https://panbo.com/sailors-behold-sailracer-net-has-finally-released-inkdisplay/)) | (공개 출처 미확인) | 하 | 하 | 외 |
| B7 | ⚠ RegattaPRO | N/A (SW 아님, PRO 인력 파견) | — | — | — | — | — | **제외 — 카테고리 정정** |
| B8 | Velocitek ProStart | 중 (open .vtk protocol) | 상 (Olympic 딩기) | 상 ([SA 표준](https://forums.sailinganarchy.com/threads/gps-race-tracker.96633/)) | N/A (companion 없음) | 중 | 하 | honorable mention |
| **B9** | **ChartedSails** | 중 (track-shape wind, 11ch 코스) | 중 (America One, Waszp Hawaii) | 상 ([SA 2025-11 다수](https://www.chartedsails.com/raceqs)) | 하 (니치) | 중 ([YouTube 데모](https://www.youtube.com/watch?v=0bVWqm7VJGA)) | 하 | **TIER 1 (이미 deep-dive 완료)** |

### Cluster C — Foiling·Windfoil

| # | 제품 | G1 | G2 | G3 | G4 | G5 | G6 | 종합 |
|---|---|---|---|---|---|---|---|---|
| C1 | ⚠ Bartz Foiling | (공개 출처 미확인) | — | — | — | — | — | **제외 — 명칭 재확인 필요** |
| C2 | ⚠ PPC Foiling | (앱 없음 — 보드 브랜드) | — | — | — | — | — | **제외** |
| C3 | Surfline (인접) | 상 (자체 wave model + AI) | — (분석 아님) | 상 (모든 surfer) | 상 (millions) | 상 | 중 | 인접 — Top 10 외 |
| **C4** | **Waterspeed** | 중 (speed-threshold 추정) | 중 (윙포일 커뮤니티 표준) | 중 ([Seabreeze 다수](https://www.seabreeze.com.au/forums/Wing-Foiling/Wind-Wings/Wingfoiling-Apps-Tracker?page=1)) | **상** ([iOS 4.7/5](https://apps.apple.com/us/app/waterspeed-track-watersports/id1234093389), [Android 4.47/5 76 ratings](https://www.appbrain.com/app/waterspeed-track-watersports/com.waterspeed.waterspeedapp)) | 중 ([Foiling.ca 리뷰](https://foiling.ca/2025/04/11/waterspeed-water-sports-performance-tracking-app/)) | 중 (윙포일 커뮤니티) | **TOP 10 ★** (Danny benchmark + foiling mass) |
| C5 | ⚠ WindSwell | (공개 출처 미확인) | — | — | — | — | — | **제외 — 명칭 재확인** |
| C6 | ⚠ Foil & Surf (한·일) | (전용 앱 부재 = 시장 공백) | — | — | — | — | — | **제외 (moat 입력으로만 활용)** |

### Cluster D — 범용 GPS·워치

| # | 제품 | G1 | G2 | G3 | G4 | G5 | G6 | 종합 |
|---|---|---|---|---|---|---|---|---|
| **D1** | **Garmin Quatix 7 + Connect IQ** | 중 (Tack Assist + 5+ Connect IQ 세일링 앱) | 중 (consumer mass) | 상 ([SA 다수](https://forums.sailinganarchy.com/threads/garmin-sail-racer-version-5-1-released.244299/)) | **상** (Garmin global) | **상** ([Yachting World "Best 2025"](https://www.yachtingworld.com/uncategorized/price-drop-get-the-garmin-quatix-7-pro-out-best-sailing-watch-2025-for-under-500-160932)) | **상** (Garmin 한국 폭넓음) | **TOP 10 ★** (consumer mass standard) |
| D2 | Suunto Vertical/Ocean | 하 (체크박스) | 하 | 중 | 중 | 중 | 중 | 외 |
| D3 | Strava sailing | 하 (단순 태그) | 하 | 중 ("dying for sailing") | **상** (millions) | 상 | 상 (한국 mass) | **honorable mention** (mass channel) |
| D4 | Polar | 하 (sailing 비공식) | 하 | 하 | 중 | 하 | 하 | 외 |
| D5 | Apple Watch native | 하 (workout type only) | 하 (Ultra+third-party) | 중 ([SA Ultra dinghy 스레드](https://forums.sailinganarchy.com/threads/apple-watch-ultra-for-dinghy-sailing.244491/)) | **상** (millions) | 상 | **상** (한국 mass) | **honorable mention** (platform) |
| D6 | Samsung Health sailing | 하 | 하 | 하 ([SA 비판](https://forums.sailinganarchy.com/threads/samsung-watch-app.210375/)) | 중 | 하 | 중 | 외 |

### Cluster E — Sensor + SW combo

| # | 제품 | G1 | G2 | G3 | G4 | G5 | G6 | 종합 |
|---|---|---|---|---|---|---|---|---|
| E1 | Movesense | 중 (오픈 SDK, 의료 MDR) | 하 (DIY) | 하 | 하 | 하 | 하 | 외 |
| E2 | RaceBox Mini | 중 (25Hz GPS) | 하 (모터스포츠 위주) | 중 | 중 | 중 | 하 | 외 |
| **E3** | **Sailmon MAX** | 중 (Header/Lift Wind Trends) | 상 (딩기 표준, **Vakaros 2025-03 인수**) | 상 ([SA "Bait and Switch"](https://forums.sailinganarchy.com/threads/sailmon-max-bait-and-switch.243799/) + "What's the deal with SAILMON?") | 중 ([Blur.se 리뷰](https://www.blur.se/2020/07/19/sailmon-max-test/)) | 중 | 하 | **TOP 10 ★** (industry consolidation event) |
| E4 | NKE Marine | 상 (35년+ 오프쇼어 표준) | 상 (Vendée Globe 디폴트) | 중 (영어권 약함) | 하 (앱 dated) | 하 | 하 | 외 (앱 UX 노후) |

### Cluster F — Weather·forecasting

| # | 제품 | G1 | G2 | G3 | G4 | G5 | G6 | 종합 |
|---|---|---|---|---|---|---|---|---|
| **F1** | **PredictWind** | 상 (자체 PWG/PWE/PW AI + 4-model 통합) | 상 (Jon Bilger AC 2 우승, GMDSS 표준) | 상 ([SA multi-day passage 표준](https://forums.sailinganarchy.com/threads/predictwind-vs-sail-flow-vs-whoever-the-sequel.198588/)) | **상** ([iOS 4.80/5, 32K ratings](https://apps.apple.com/us/app/predictwind-marine-forecasts/id477048487)) | 상 | 중 | **TOP 10 ★** |
| **F2** | **Windy.com** | 중 (aggregator + WebGL 시각화) | 중 (모든 sailor 일상) | **상** ("Windy is better and still free") | **상** (millions, [Premium 가격 인상](https://community.windy.com/topic/37725/35-premium-subscription-price-hike)) | 상 | **상** (한국 mass) | **TOP 10 ★** (visualization 표준) |
| F3 | Sailflow | 중 (hyperlocal, US 표준) | 중 (US Sailing 파트너) | 중 | 중 | 중 | 하 | 외 (US-only) |

---

## 3. Top 10 선정 결과 — 근거 압축

> 36개 중 10개. **포지셔닝 다양성** (pro/consumer/sensor/weather) + **알고리즘 깊이** + **인지도** 의 균형 선택.

| Rank | 제품 | 선정 사유 (한 줄) | Danny 명시 |
|---|---|---|---|
| **1** | **Njord Analytics** | 분석 SW 의 사실상 표준, Olympic·GP 코치 사용, User Guide 광범위, WingFoil 클래스 보유, **Tier 0 already done** | ✓ "거의 확실히 포함" |
| **2** | **ChartedSails** | Free tier 가 강력한 mass-market 분석, RaceQs 후계, Garmin OAuth, **Tier 1 already done** | ✓ "거의 확실히 포함" |
| **3** | **Vakaros Atlas 2** | 하드웨어+분석 통합 프리미엄, **2025-03 Sailmon Instruments 인수 = 업계 재편 이벤트**, 공개 VMG/Tack Loss 알고리즘 blog, SA "Vakaros" 단일 스레드 page 6+, Practical Sailor 리뷰 | — (제안) |
| **4** | **Expedition** | **30년+ 프로 racing nav 표준**, Nick White (Whitbread 우승자) 1인 운영, VOR/AC/GP 디폴트, $1,295 one-time, public PDF manual | — (제안) |
| **5** | **SAP Sailing Analytics** | **2025-10 Apache 2.0 오픈소스화** ★ — *알고리즘 reverse-engineer 가능*, Paris Olympic/SailGP/AC 사용, Eclipse Azimuth 이관 | — (제안 — 학술 가치 최상) |
| **6** | **Garmin Quatix 7 + Connect IQ 생태계** | **Yachting World "Best Sailing Watch 2025"**, SailAssist 1급 모드, 5+ Connect IQ 세일링 앱 (raceQs/Sail2WIN/Sailing Race Timer 등), 한국 인지도 최상 | — (제안 — consumer mass) |
| **7** | **Sailmon MAX (+ Vakaros 인수)** | 딩기 racing 시장 표준, **2025-03 Vakaros 인수로 업계 재편 진행**, Header/Lift Wind Trends 분석, SA "Bait and Switch" GOLD 페이월 논란 | — (제안 — industry consolidation) |
| **8** | **Waterspeed** | Danny 본인 GPS 워치 앱 + **윙포일 커뮤니티 사실상 표준**, iOS 4.7/5 · Android 4.47/5 (76+ ratings), 윈드포일 tack/jibe 라벨 역전 버그 등 알려진 약점, 멀티-스포츠 카버리지 | — (제안 — 윙포일 mass + Danny 직접 benchmark) |
| **9** | **PredictWind** | Jon Bilger (AC 2 우승) 창업, **자체 PWG/PWE/PW AI 하이브리드 모델**, GMDSS 안전 인프라 통합, 100만 사용자, iOS 32K ratings, $249/$499 구독 | — (제안 — weather analytics 표준) |
| **10** | **Windy.com** | **글로벌 wind visualization 사실상 표준**, 50+ 레이어, 애니메이션 wind flow (Cameron Beccario earth 기반 WebGL), $34.99/yr Premium, 한국 인지도 매우 높음 | — (제안 — visualization 표준) |

---

## 4. Honorable mentions — Top 10 외이지만 deep-dive 가치 있는 후보

> Danny 가 위 10개 중 일부 교체를 원할 경우 후보 풀.

| 후보 | 강점 | 약점 (왜 Top 10 외) |
|---|---|---|
| **Deckman by B&G** | Dr. Winn AC 알고리즘 1980s 유산, $1,695 industry pro standard | Expedition 과 포지션 겹침. 둘 다 넣을지 vs 하나만 |
| **Velocitek ProStart** | Open .vtk protocol, 75h 배터리, 17년+ 표준 | 자체 분석 SW 없음 — 외부 도구 의존 |
| **Vantage Sailing** | ML wind 2.0, AC 38 분석가 founder | 신생 (no ratings yet) — 정성 평가만 가능 |
| **Apple Watch sailing (native)** | iOS HealthKit 플랫폼, Waterspeed/iRegatta Watch/SailingWatch 의 기반 | 자체 분석 없음 (third-party 플랫폼) |
| **Strava sailing** | 매우 큰 사용자 base | sailing 분석 깊이 0 — 단순 태그 |
| **KND SailingPerformance** | Ocean Race 5중 4우승팀 분석 | 가격 비공개·아마추어 진입 불가 |
| **Sailflow** | US 연안 관측소 표준, hyperlocal | 미국 외 커버리지 약함 |

---

## 5. Top 10 deep-dive 의 구조 (per 제품 — PhD 검수 수준)

각 제품마다 다음 7-axis 로 진행. (Njord 의 §2.B2-Deep 와 동일한 구조 + Danny 5가지 추가 영역):

1. **알고리즘 수학적 모델 추출** — VMG/target/polar/wind reconstruction. 공개 docs·논문·patent 모두 reverse-engineer
2. **UX 시각 언어 deep dive** — 스크린샷·UI patterns·인터랙션 종합
3. **가격·구독·사용자 base** — 정확한 수치 (App Store reviews · 회사 employee count · 매출 추정 시 가능한 경우)
4. **강점·약점·우리가 outperform 가능한 영역** — 구체 wedge 도출
5. **운영·viability** — 회사 안정성·로드맵·industry positioning
6. **데이터 ingest/export 호환성** — 우리 GPX/VKX/FIT 와의 호환 가능성
7. **SailTechCo 학습 / 차별화 함의** — moat 설계 input 으로 정리

**예상 분량**: 제품당 3,000–5,000 단어 × 8개 신규 = 24,000–40,000 단어 추가. 기존 §2 카드는 압축 보존.

---

## 6. Danny 의 strategic confirm 요청 항목

진행 전 다음 3 가지 결정 필요:

### Q1. Top 10 명단 — 그대로 진행 vs 교체

위 10개 명단 OK? 또는:
- **Deckman 을 Top 10 에 추가** (Expedition 과 함께 Pro racing nav 양대산맥) → Sailmon 또는 Waterspeed 강등?
- **Vantage Sailing 을 Top 10 에 추가** (ML wind, AC 38 founder) → 어느 것 강등?
- **Velocitek 을 Top 10 에 추가** (open .vtk standard) → 어느 것 강등?

### Q2. Deep-dive 형식 — Njord 식 7-axis 동일 적용 vs 제품별 강조점 조정

Njord §2.B2-Deep 의 7개 axis (§1 풍향·§2 외부 날씨·§3 폴라·§4 회전 손실·§5 통계 패널·§6 리플레이·§7 가격/운영) 를 그대로 8개 신규 제품에 적용?
- ✓ pros: 일관성, 비교 가능
- ✗ cons: 일부 제품엔 부적합한 axis 가 있음 (예: Windy 엔 회전 손실이 N/A)

→ **권장: 7-axis 골격 유지 + 제품 특성에 맞게 일부 axis 를 "N/A 사유 명시" 처리** 후 진행.

### Q3. 진행 속도 — 8개 병렬 vs 순차

- **A안**: Wave 1 (Vakaros·Expedition·SAP·Garmin) 병렬 4 + Wave 2 (Sailmon·Waterspeed·PredictWind·Windy) 병렬 4 — 빠르지만 컨텍스트 부담
- **B안**: 2개씩 4 waves — 깊이 보장, 시간 느림
- **C안**: 1개씩 8 waves — 가장 깊지만 시간 가장 느림

→ **권장: A안 (병렬 4×2 wave)**. Phase 1 의 milestone 보고 패턴 유지.

---

## 7. 35→34 카운트 정정 + 미식별 항목 처리

본 audit 진행 중 다음 4 개는 **공개 출처에서 단일 제품으로 식별 불가**, Danny 의 추가 원자료 (URL·스크린샷·블로그 출처) 가 필요:

| 원안 슬롯 | 발견 사실 | 조치 |
|---|---|---|
| B7. RegattaPro / Sail Now | RegattaPro 는 PRO 인력 파견 서비스(SW 아님). Sail Now 미식별. | **35→34 로 카운트 조정** 또는 race-management SW (Sailwave / Yacht Scoring / Regatta Toolbox / Nautical Cloud) 중 1~2개로 대체 |
| C1. Bartz Foiling app | App Store / Seabreeze / Foilzone 어디에도 없음 | Danny 측 원자료 재확인 — 가능성: 별명·비공식·자체 도구 |
| C5. WindSwell | 공개 출처 미식별. 유력 후보: [Wind Tracker](https://windtracker.app/en/) (2026 spring beta) 또는 [WindsportTracker](https://www.windsporttracker.com/en/) (독일 sunbits GmbH) | Danny 측 명칭 재확인 |
| C6. Foil & Surf (한·일) | 한국·일본 전용 윙포일 분석 앱 부재 — *시장 공백 = SailTechCo moat 기회* | 슬롯을 제거하고 §6 갭분석으로 흡수 권고 |

→ Windyty 도 Windy.com 의 옛 도메인 리다이렉트로 확정 (별개 제품 아님). 총 카운트 36→35→**34 (or 35 with 1 replacement)**.

---

## 8. 결론 — Danny confirm 대기

**Top 10 명단 (정렬: 권장 deep-dive 순서):**

1. Njord Analytics ✓ (완료)
2. ChartedSails ✓ (완료)
3. **Vakaros Atlas 2** (이미 부분 audit, 추가 deep-dive 필요)
4. **Expedition** (이미 부분 audit, 추가 deep-dive 필요)
5. **SAP Sailing Analytics** (이미 부분 audit, GitHub 코드 직접 reverse-engineer 가능)
6. **Garmin Quatix 7 + Connect IQ** (이미 부분 audit, 추가 deep-dive 필요)
7. **Sailmon MAX (+ Vakaros 인수)** (이미 부분 audit, 추가 deep-dive 필요)
8. **Waterspeed** (이미 부분 audit, 추가 deep-dive 필요 — Danny 본인 benchmark)
9. **PredictWind** (이미 부분 audit, 추가 deep-dive 필요)
10. **Windy.com** (이미 부분 audit, 추가 deep-dive 필요)

**8개 신규 deep-dive 예상 분량**: 24,000–40,000 단어 (제품당 3–5K). PhD 검수·투자자 deck 가능 수준.

**Danny 결정 사항** (위 §6):
- Q1: 명단 OK 또는 교체?
- Q2: 7-axis 골격 유지?
- Q3: 진행 속도 (A/B/C안)?
- Q4 (추가): C1·C5 의 원자료, B7 의 "Sail Now" 정체?

→ Confirm 후 즉시 Wave 1 (Vakaros·Expedition·SAP·Garmin) 4 병렬 dispatch.
