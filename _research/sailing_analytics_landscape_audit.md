# Sailing Analytics Software — 시중 전수 Landscape Audit

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.1 (Phase 1 진행 중 — 클러스터 audit 누적 채움) |
| 작성 착수일 | 2026-05-27 |
| 목적 | "차원이 다른 서비스" (Danny 비전) 의 기준점 — 시중 sailing analytics SW 전수 audit, 기능·알고리즘·UX·약점 매핑 후 우리 차별화 moat 정의 |
| 범위 | 35 개 제품 (Pro racing 7 · 컨슈머 racing 8 · Foiling·Windfoil 6 · 범용 GPS·워치 6 · Sensor+SW 4 · Weather 4) |
| 검수 기준 | PhD 검수 통과·투자자 deck 사용 가능. **모든 claim 은 출처 명시** (공식 사이트·docs·App Store·논문·patent·리뷰). Fabrication 0. |
| 협업 | Sports Science Researcher (알고리즘) · DataViz Specialist (UX 패턴) · UX Researcher (리뷰·flow) 의 3관점 합성 |
| 선행 자산 | `Njord_Analytics_벤치마크_갭분석_2026-05-22.md` (Njord 심층 audit) · `라이딩통계_대시보드_스코핑_v1.md` (제품 스코핑) |

> **읽는 방법.** §1 은 시장 전체 지도와 분류, §2 는 35 개 제품 각각의 상세 카드 (10 항목 × 35 = 350 데이터 셀), §3 은 기능 비교 매트릭스 (CSV·xlsx 동봉), §4 는 알고리즘 깊이 비교, §5 는 UX 인사이트, §6 은 갭 분석 + moat 제안, §7 은 출처 모음. **모든 우선순위·평가는 출처 기반**. 사용자 리뷰·평점·시장 점유율 등 "느낌" 수치는 출처 없이 인용하지 않는다.

---

## 1. 시장 지도 (Market Map)

### 1.1 6 개 클러스터 분류 기준

분류는 **타깃 사용자 + 분석 깊이 + 가격 모델 + 하드웨어 결합도**의 4 축으로 한다.

| 클러스터 | 타깃 사용자 | 분석 깊이 | 가격대 (USD/년 기준 환산) | 하드웨어 결합도 |
|---|---|---|---|---|
| **A. Pro racing / Olympic** | TP52·SailGP·America's Cup·올림픽 코치·내비게이터 | 매우 깊음 — polar·VMG·tack 손실·target·tactical·weather 라우팅 통합 | $$$$ ($1,000–$10,000+, 일부 license-only) | 강결합 — B&G·NKE·Garmin·Vakaros 등 instrument suite 전제 |
| **B. 컨슈머·클럽 racing** | 클럽 racer·딩기·1인 racer·코치 | 중~높음 — race 단위 분석, 회전·VMG·기본 polar | $ ($0–$300) | 약결합 — GPS 워치/스마트폰 단독 가능 |
| **C. Foiling·Windfoil specific** | 윙포일·윈드포일·카이트포일 freerider, 일부 경기 | 얕음~중 — 속도·거리·jibe 카운트, 일부 GPS heatmap | $ ($0–$50, 일부 freemium) | 약결합 — 스마트폰/워치 단독 |
| **D. 범용 GPS·워치** | 일반 athlete + 부가 sailing mode | 얕음 — 속도·거리·route·heart rate. sailing 전용 분석 거의 없음 | $ (워치 비용에 포함) | 강결합 — 워치 OEM 종속 |
| **E. Sensor + SW combo** | 데이터-주도 racer·코치 | 중~높음 — IMU·GPS·바람 raw 데이터. 분석은 companion 앱 또는 export | $$ ($150–$1,500 하드웨어 + 구독) | 매우 강결합 — 자사 센서 전용 |
| **F. Weather·forecasting** | 모든 sailor — 라우팅·forecast | 분석 인접 — 본질은 forecast 이나 race routing 기능 일부 | $ ($0–$250) | 약결합 — 데이터 소비형 |

### 1.2 35 개 제품 클러스터 배치

**A. Pro racing (7)** — Vakaros Atlas / Atlas 2, SAP Sailing Analytics, Expedition, Deckman (B&G), Adrena, Sailing Performance Solutions (SPS), WTP3 (B&G Hercules).

**B. 컨슈머·클럽 racing (8)** — Vantage Sailing, Njord Analytics / Njord Player, TackTracker, RaceQs / Kattack, iRegatta, SailRacer, RegattaPro / Sail Now, Velocitek SC1 + companion.

**C. Foiling·Windfoil (6)** — Bartz Foiling app, PPC Foiling, Surfline, Waterspeed, WindSwell, Foil & Surf (Korean·Japanese 앱).

**D. 범용 GPS·워치 (6)** — Garmin Quatix / Quatix 7 + Connect IQ sailing apps, Suunto sailing modes, Strava sailing activity, Polar Beat sailing, Apple Watch Workout (sailing), Samsung Health (sailing).

**E. Sensor + SW combo (4)** — Movesense Sailing pack, RaceBox Mini + iOS app, Sailmon Max + companion, NKE Marine instruments.

**F. Weather·forecasting (4)** — PredictWind, Windy.com, Windyty, Sailflow.

### 1.3 분류 경계의 모호 사례 (정직한 표기)

- **Vakaros Atlas** — 하드웨어(GPS·IMU 디바이스) + companion 앱 + Cloud → Cluster A (pro racing) 와 E (sensor+SW) 양쪽 성격. 본 audit 은 분석 기능 비중이 큰 A 로 분류하고 E 와 cross-reference.
- **Njord Analytics** — pro 시장도 사용하지만 클럽 racer 비중이 커서 B. Njord Player 의 영상 통합은 pro 급.
- **Garmin Quatix** — 워치 자체는 D, 그러나 Connect IQ 상의 SailRacer·sailing app 들은 B 와 D 경계. 본 audit 은 워치 D, app 들은 별도 B 항목으로 둘 다 다룬다.
- **Windy / Windyty** — Windyty.com 은 Windy.com 의 옛 도메인 (현재는 windy.com 로 redirect). 별개 제품이 아니라 동일 제품임 — §2-F 에서 통합 카드로 처리.
- **Surfline** — 본질은 surf forecast 이고 sailing analytics 가 아니다. 윙포일러가 wind·tide·wave 정보로 활용하는 인접 도구로서 포함. UX 패턴은 참고하되 기능 매트릭스 비교는 제한적.

---

## 2. 제품별 상세 카드 (35 개)

> 각 카드는 다음 10 항목으로 구성된다 — ①포지셔닝·가격·타깃 ②기능 목록 ③알고리즘(공개 docs/논문/patent 기반 reverse-engineer) ④UX/UI ⑤데이터 source ⑥출력/공유 ⑦가격 모델 ⑧강점·약점 ⑨사용자 리뷰 ⑩장기 viability. **모든 항목은 출처 명시**. 정보 부재 시 "(공개 출처 미확인)" 명기.

### 2.A Pro racing / Olympic 클러스터

#### A1. Vakaros Atlas / Atlas 2

**(1) 포지셔닝·가격·타깃** — Atlas 2는 올인원 무선 세일링 인스트루먼트로, 풀 인스트루먼트 시스템(B&G 등)의 저비용 대안으로 포지셔닝됨. TP52부터 Opti까지 폭넓은 클래스에서 사용되며 가격은 **[$1,249](https://www.vakaros.com/products/atlas-2)** (2026-05-27 Shopify 직접 fetch; 2025-04 Practical Sailor 리뷰 시점의 $1,199 에서 ~4% 인상). 타깃은 원디자인·딩기·키일보트 레이서로, 전문 설치 없이 사용 가능. 본사 Seattle, WA, [2018년 Jake Keilman·Todd Wilson 창업](https://www.crunchbase.com/organization/vakaros) — 애틀랜타 캐터마란 세일러 출신.

**(2) 기능** — 25Hz L1+L5 듀얼밴드 GNSS (Atlas 2 단독 = 25 cm RaceSense 차분 정확도; **1 cm 는 [Atlas HALO RTK $599](https://www.vakaros.com/products/atlas-halo-rtk) 별도 SKU 결합 시**), 3축 자기·자이로·가속도 센서, 자기 컴퍼스, 힐/트림, RaceSense 스타트라인 핑(time-to-line, time-to-burn, OCS 자동 콜), 무선 풍속/수온 센서 연동, [VMG 분석 및 Tack Loss 측정(틱·자이브 후 잃은 거리 미터 단위 표시)](https://blog.vakaros.com/vmgtackloss), 시프트 트래킹, LED 바 신호. [Vakaros Connect 앱](https://apps.apple.com/us/app/vakaros-connect/id1481223437)에서 사용자 정의 위젯 layout builder 제공 (Atlas 2 의 4.4-inch 320×240 디스플레이 기준 page 당 1–4 metric 실용 — 기존 "10억+ 레이아웃" 주장은 공개 출처 미확인으로 격하).

**(3) 알고리즘** — 시프트 트래킹은 "각도(angles)" 모드에서 레퍼런스 헤딩을 캡처해 inferred wind direction을 산출; 윈드 센서 페어링 시 true wind direction 사용 예정. Tack/gybe 자동 감지 후 메뉴버 종료 시점에서 손실 거리(m) 계산. 알고리즘 상세 수식은 [공개 출처 미확인](https://www.vakaros.com/blogs/news/vmg-and-tack-loss-new-training-tools).

**(4) UX/UI** — 디바이스: 3.5×4.5in 트랜스플렉티브 디스플레이, 175g, 편광 선글라스 대응. 모바일 앱(iOS 15.6+/Android)이 컴패니언 — 위젯 레이아웃, LED·사운드 커스터마이즈, 데이터 다운로드, 펌웨어 업데이트.

**(5) 데이터 source** — 내장 GPS(25Hz dual-band) + IMU(3축 자이로·가속도·자력계) + 사용자 입력(레이스 셋업) + 외부 ANT/BLE 윈드/수온 센서. 심박은 미지원.

**(6) 출력·공유** — 디바이스 내부 텔레메트리 로깅(speed/position/heel/trim 등)을 Connect 앱으로 다운로드. 클라우드 대시보드는 제한적이며, 외부 분석 앱(예: SailFrames) 활용에 대한 [사용자 토론](https://www.facebook.com/groups/vakaros/posts/1578144277644514/) 존재. PDF/공유 링크 기능은 공개 출처 미확인.

**(7) 가격 모델** — 하드웨어 [$1,199 일회성](https://www.vakaros.com/products/atlas-2) + [RaceSense Annual Pass(시즌 무제한 스타트 콜) 별도 구독](https://www.vakaros.com/products/racesense-annual-pass). 일부 사용자가 "기존 무료 기능을 유료로 전환" 비판.

**(8) 강점·약점** — 강점: 듀얼밴드 GPS, 가시성, 100시간+ 배터리, RaceSense 자동화. 약점: [사용자들이 "1cm/2.5cm 정확도 주장이 실제와 다르다"고 보고](https://forums.sailinganarchy.com/threads/vakaros.250212/page-6), 일부 기능 유료화 불만, 공급망 지연.

**(9) 사용자 리뷰** — Sailing Anarchy 다수 스레드 — [긍정: "AC 세일러도 쓰니 나에게도 충분"](https://forums.sailinganarchy.com/threads/vakaros.206533/), 배터리·디스플레이 호평. [Practical Sailor 리뷰](https://www.practical-sailor.com/marine-electronics/vakaros-atlas-2-sailing-instrument-profile/)에서 "all-in-one" 표현.

**(10) 장기 viability** — 적극 개발 중. [2025년 3월 Sailmon Instruments 인수](https://www.vakaros.com/blogs/news/vakaros-acquires-sailmon)로 포지션 강화. PitchBook 기준 시드 단계지만 시장 점유율 확대 중.

> **★ A1-Deep companion**: 7-axis Tier 0 심층 audit → [`A1_Vakaros_deepdive.md`](./A1_Vakaros_deepdive.md). 가격 정정 ($1,199 → $1,249), "10억+ 위젯" 출처 미확인 격하, Atlas HALO RTK ($599 별도 SKU = 1cm vs Atlas 2 = 25cm 분리), 회전 손실 displacement-based 수식 reverse-engineer, RaceSense 150K+ start calls 14개월간 3배 성장, Sailmon 인수 후 12일 만에 widget 흡수.

#### A2. SAP Sailing Analytics

**(1) 포지셔닝·가격·타깃** — [올림픽·SailGP·World Sailing 이벤트를 위한 클라우드 기반 트래킹·분석 플랫폼](https://www.sapsailing.com/). 1,000+ 이벤트에서 사용. 타깃은 레이스 오거나이저, 방송사, 코치, 선수, 팬. [2024 Paris 올림픽 등 메이저 이벤트에서 사용](https://news.sap.com/2020/10/sap-syrf-launch-new-mobile-app-for-global-sailing-community-races-live-data-tracking/). 무료(오픈소스 전환 후).

**(2) 기능** — 실시간 위치 트래킹, 라이브 리더보드, 윈드 센서 통합, 마누버(틱/자이브) 카운팅, 거리 분석, "winning lanes" 분석, 핸디캡 라이브 스코어링, ORC PCS 스코어링, 방송용 위젯(boat speed, gap, ranking 등). 컴패니언 앱: Race Manager, Buoy Pinger, [Sail Insight](https://sail-insight.com/) (QR 체크인, GPS 트래킹, post-race 분석).

**(3) 알고리즘** — [GitHub 오픈소스 공개(2025년 10월 20일, Apache 2.0)](https://github.com/SAP/sailing-analytics) — **알고리즘이 공개 검증 가능**. 위성 트래킹+윈드센서+RC 결정을 결합하여 라이브 결과 산출. Data Mining 기능, RESTful API, 커넥터 아키텍처. 클라우드+인메모리 처리. Eclipse Foundation 으로 "Eclipse Azimuth Sailing Analytics" 이관 진행 중.

**(4) UX/UI** — 웹 기반 UI(레이스 뷰어, 트랙 리플레이) + 모바일 컴패니언 앱(iOS/Android). 방송사 임베드 위젯. 시각 언어는 데이터 시각화 중심(라인 트랙, heatmap, 리더보드).

**(5) 데이터 source** — 위성 트래킹 디바이스(보트당 장착), 코스 주변 윈드 센서, RC 입력(스코어링), Sail Insight 앱의 폰 GPS, 외부 트래킹 시스템 커넥터.

**(6) 출력·공유** — [sapsailing.com 아카이브](https://www.sapsailing.com/) 영구 호스팅, 방송 위젯, RESTful API, 라이브 스트림 데이터 피드.

**(7) 가격 모델** — [Apache 2.0 오픈소스, 무료](https://github.com/SAP/sailing-analytics). 클라우드 운영은 이벤트 오거나이저가 자체 호스팅 또는 SAP 협력.

**(8) 강점·약점** — 강점: 메이저 이벤트 실전 검증, 오픈소스 투명성, 확장 가능 아키텍처. 약점: 개인·소규모 팀 사용성 낮음(이벤트 인프라 필요), 일반 레이서를 위한 셀프서비스 부족.

**(9) 사용자 리뷰** — 전문가 사용자(이벤트 운영진) 대상이라 r/sailing·Sailing Anarchy 일반 리뷰는 드묾. 일반 사용자 리뷰 풀이 얕음.

**(10) 장기 viability** — SAP 모기업 — 매우 안정적. 2025년 오픈소스화 + Eclipse Foundation 이관으로 [장기 커뮤니티 거버넌스 확보](https://projects.eclipse.org/proposals/eclipse-azimuth-sailing-analytics). 단, SAP가 직접 상업 서비스로 가는 방향은 아니므로 미래 활성 개발은 커뮤니티 의존.

> **★★★ A2-Deep companion (가장 깊은 단일 audit)**: GitHub 코드 직접 분석 → [`A2_SAP_deepdive.md`](./A2_SAP_deepdive.md) (62KB, 6,300 단어). 8,182 Java 소스파일·219 OSGi 모듈·14년 운영. **풍향 추론 = Random Forest 50 트리 → Viterbi HMM → Forward-Backward** (수식·임계값 모두 코드에서 추출). Maneuver category 임계값 (<30/30-120/120-150/150-310/>310°), TWD penalty 함수 `1/(1+(delta/20)²)`, 27가지 ScoringSchemeType, ORC PCS 2015 룰까지 구현. **알고리즘 baseline 12개월 단축 가능 reference**.

#### A3. Expedition

**(1) 포지셔닝·가격·타깃** — [전문 레이싱 항해 소프트웨어, 1990년대 중반 Volvo Ocean Race 네비게이터·Whitbread 우승자 Nick White가 개발](https://www.expeditionmarine.com/). Volvo Ocean Race, America's Cup, Grand Prix 이벤트에서 광범위 사용. 가격: [라이선스 $1,295 (primary+backup PC), v5→현재 업그레이드 $250, 14일 무료 데모](https://diverseps.com/product/expedition-navigation-software/). 타깃: 오프쇼어 레이서, 프로 네비게이터, 부이 레이서.

**(2) 기능** — Optimal weather routing, polar analysis, instrument calibration, race strategy, performance analysis, [GRIB 1·2 지원·다중 GRIB 데이터셋 머징](https://www.expeditionmarine.com/), 라우팅(다중 알고리즘, ensemble multi-model, optimal fleet routing, route sensitivity reverse isochrones, wave correction), AIS/DSC/레이더/NMEA, [v12: tablet mode, Rainviewer radar, AC36 support, animated wind flow, asymmetric polars for routing](https://www.expeditionmarine.com/version_history).

**(3) 알고리즘** — 다중 라우팅 알고리즘(isochronal + grid optimisation, ensemble model routing, reverse isochrones for sensitivity, wave correction/avoidance). 폴라 기반 타깃 속도, 다중 weather model 가중치. 알고리즘 세부 수식은 [공개 출처 미확인](https://www.expeditionmarine.com/downloads/documents/Expedition.pdf)이지만 PDF 매뉴얼에서 라우팅 파라미터·옵션 상세 기술.

**(4) UX/UI** — Windows 데스크톱(Win 10/11, 16GB+ 권장, 멀티스레드). [iPad은 native 미지원 — Surface 또는 iPad+RDP로 사용](https://forums.sailinganarchy.com/threads/expedition-ported-for-ipad.144765/). v12에서 simple ribbon, 태블릿 모드 도입. 사용자 평: "가장 깔끔한 UI, 가장 직관적".

**(5) 데이터 source** — NMEA 0183/2000 인스트루먼트(B&G H5000/Hercules 등), AIS, GPS, 레이더, GRIB 파일(여러 소스: ECMWF·GFS·Arpège·NBM·UK Met Office), Tidetech currents, 셀룰러/Iridium 통신.

**(6) 출력·공유** — 인스트루먼트 시스템으로 직접 출력 가능, 로그 분석, 폴라 작업, 트랙 익스포트. 공유 링크/PDF 기본 기능은 공개 출처 미확인.

**(7) 가격 모델** — [일회성 $1,295](https://diverseps.com/product/expedition-navigation-software/), 메이저 버전(예: v11→v12, [€275](https://www.fieldyachting.com/product-page/expedition-navigation-software-upgrade-to-v12)) 업그레이드 유료, 마이너 업데이트 무료. 구독 모델 없음.

**(8) 강점·약점** — 강점: [업계 표준급 라우팅, 최고 수준 지원 포럼, Nick White 직접 응답](https://forums.sailinganarchy.com/threads/routing-software-expedition-v12.241985/), "best looking software". 약점: "garbage in, garbage out" — 폴라·인스트루먼트 캘리브레이션이 정확해야 효과; "거의 프로 테크니션이 되어야 풀 활용 가능".

**(9) 사용자 리뷰** — [Sailing Anarchy v12 스레드](https://forums.sailinganarchy.com/threads/routing-software-expedition-v12.241985/) — 압도적 긍정, 개발자 응답성·기능 폭 호평. [Cruisers Forum Deckman vs Expedition](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html) — Expedition을 사용 편의성 우위로 평가.

**(10) 장기 viability** — 30년+ 지속 개발, Nick White 1인 주도지만 대형 racing 프로그램들이 의존. 2024년 [v12 출시](https://www.fieldyachting.com/product-page/expedition-navigation-software-upgrade-to-v12)로 활발한 개발 입증. **1인 키맨 리스크는 유일한 우려점.**

> **★ A3-Deep companion**: 7-axis Tier 0 심층 audit → [`A3_Expedition_deepdive.md`](./A3_Expedition_deepdive.md). Calibration 매뉴얼 직접 인용 (TWA × TWS 2D table, leeway 보정, recalculated AWA/AWS), 22개 GRIB 모델 카탈로그 (ECMWF/GFS/UM/ICON/Arpège/HRRR + 자체 WRF China Sea/HK), polar 11가지 기능 (night/asymmetric/port-stbd/wind-weight/air-density), 라우팅 13개 sensitivity dimension sweep, tack analysis (loss time + loss metres 채널). 한국 reseller 부재.

#### A4. Deckman (B&G)

**(1) 포지셔닝·가격·타깃** — [B&G의 프로 택티컬 네비게이션 소프트웨어, Hydra/Hercules 시스템 확장용으로 개발](https://www.bandg.com/en-gb/deckman/). [Tactical PC 가격 $1,695](https://www.gps4us.com/BandG-Deckman-Tactical-PC-software-C-AP-USB--P7763.html). 타깃: 오프쇼어 레이싱 네비게이터, 프로 팀(Volvo Ocean·America's Cup 클래식 사용 이력).

**(2) 기능** — Optimum routing algorithm(웨이브 높이 회피 옵션), enhanced graphics(layline 옵션, shaded limit layline sectors), Start Line Live View(boat position, 바이어스, gain/loss, time to line), GRIB Weather & Tide, Datalog & Analysis, 인스트루먼트 시스템 양방향 출력, competitor handicap 추적, [.NET add-in 작성 가능](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html).

**(3) 알고리즘** — Dr. Stuart Winn의 [America's Cup 수학(1980년대 개발) — 모든 B&G 인스트루먼트 윈드 솔루션의 기반](https://www.bandg.com/en-gb/blog/racing/americas-cup/a-short-history-of-sailing-instruments---part-3/). Wave height avoidance routing은 사용자 설정 임계값으로 라우팅 제약. 구체 수식은 공개 출처 미확인 (proprietary).

**(4) UX/UI** — Windows 데스크톱(USB dongle 라이선스). UI는 "오래된 / 약간의 quirk", 평균 사용자 진입 장벽 높음. 강력하지만 가독성·현대성에서는 Expedition 대비 열위 평가.

**(5) 데이터 source** — B&G WTP3/Hercules/H5000 등 인스트루먼트, NMEA, GRIB(weather), Tide DB, 사용자 입력(competitor 시간), AIS.

**(6) 출력·공유** — 인스트루먼트 시스템에 직접 데이터 푸시(layline·target speed 등), 데이터로그 익스포트. 클라우드 대시보드/공유 링크는 공개 출처 미확인.

**(7) 가격 모델** — [일회성 라이선스 $1,695 (USB dongle 포함)](https://www.sailrace.com/en-us/products/bandg-deckman-usb), [업그레이드 +2 버전 step $754.05](https://www.tradeinn.com/waveinn/en/b-g-deckman-upgrade/589870/p). 구독 없음.

**(8) 강점·약점** — 강점: "가장 강력한 소프트웨어", .NET 익스텐션 가능, B&G 인스트루먼트와 완벽 통합, Dr. Winn 알고리즘 유산. 약점: UI 노후화, 학습 곡선, 평균 사용자에게 어려움 — [Cruisers Forum 평](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html).

**(9) 사용자 리뷰** — [Cruisers Forum "Deckman vs Expedition"](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html) — "Deckman은 더 강력하지만 Expedition이 더 사용하기 편함". [Sailing Anarchy 다수 스레드](https://forums.sailinganarchy.com/threads/best-tactical-software.17262/)에서도 비슷한 평가 반복.

**(10) 장기 viability** — Navico/B&G(현재 Brunswick Corporation 산하) 소속, 안정적. 적극적 개발은 인스트루먼트(H5000) 대비 상대적으로 느림. 메이저 업데이트 RacePanel 시리즈 블로그에서 [Mark Chisnell 주도로 계속 진행](https://www.bandg.com/blog/racepanel-1/).

> **★ A4-Deep companion**: 7-axis Tier 0 심층 audit → [`A4_Deckman_deepdive.md`](./A4_Deckman_deepdive.md). **창업자 이름 정정 Dr. Stuart → Dr. Graeme Winn** (Sailmath 창업자, Victory 1983 AC 챌린저). 1983 6kg hardware → 1987 상용 → 1988 isochronal routing → Blue Arrow AC 시 rate gyro+accel 적용 (motion correction 의 시작점). **.NET add-in extensibility + Hercules WTP3 Python scripting dual-layer**, Brunswick Corp 산하 ($1.05B Navico 인수 2021), Mark Chisnell RacePanel 5부 시리즈 = 알고리즘 transparency 의 publicly-readable source. **Polar = target/navigation 이중화** (이상치 + 실측 조정치). Korea distributor 부재.

#### A5. Adrena

**(1) 포지셔닝·가격·타깃** — [프랑스 Nantes 인근, 2003년 설립](https://www.adrena-software.com/en/who-are-we/). 프랑스 시장 리더. 3개 라인(First / Standard / Pro). 가격(EUR ex tax): [Adrena Pro Offshore €1,268.75 ~ €2,537.50](https://www.adrena-software.com/en/product/adrena-software-adrenapro-adrenapro-offshore/). 타깃: 아마추어 크루저(First), 키 레이서(Standard), 프로 네비게이터·오프쇼어(Pro — Vendée Globe 등).

**(2) 기능** — Weather routing, polar analysis, trajectory optimization, regatta management, [GRIB 16일 다운로드(온라인·이메일), 차트·tide chart 호환, MOB·AIS·알람](https://www.nauticexpo.com/prod/adrena/product-22548-218898.html), dual routing(sail+motor with fuel consumption), waypoint/route 관리, 인스트루먼트 연결, [Tidetech](https://www.tidetech.org/adrena/) currents 통합.

**(3) 알고리즘** — 라우팅 모듈은 출발일·장소·도착지·polar·풍황(GRIB)·해류를 입력받아 최적 경로 산출. Dual routing(범주+모터)에서 연료 소비 추정. 구체 알고리즘 수식 공개 출처 미확인.

**(4) UX/UI** — Windows 데스크톱 + 동글 라이선스. 프랑스어/영어 인터페이스. iOS/Android 컴패니언은 공개 출처 미확인 (주요 제품은 데스크톱).

**(5) 데이터 source** — NMEA 인스트루먼트(B&G·NKE·Furuno), GPS, AIS, GRIB(여러 소스), Tidetech 해류, 사용자 폴라.

**(6) 출력·공유** — 트랙 로그, 라우팅 시나리오 익스포트. 분석 리포트 출력. 클라우드/공유 링크는 공개 출처 미확인.

**(7) 가격 모델** — [일회성 라이선스 + 동글, 라인별 가격 차등](https://www.adrena-software.com/en/our-products/). [Adrena Pro Offshore: €1,268.75~€2,537.50 (ex tax)](https://www.adrena-software.com/en/product/adrena-software-adrenapro-adrenapro-offshore/). 차트는 별도. 구독 모델 없음.

**(8) 강점·약점** — 강점: 프랑스 오프쇼어 씬에서 [강한 시장 존재감](https://www.adrena-software.com/en/who-are-we/), Tidetech 통합, NKE 인스트루먼트와의 강한 통합. 약점: 영어권 사용자 인지도 낮음, UI는 전통적, 클라우드/모바일 통합은 경쟁사 대비 약함.

**(9) 사용자 리뷰** — 영어권 포럼 리뷰 풀 얕음 — 프랑스어 커뮤니티 중심. r/sailing·Sailing Anarchy에서 Expedition/Deckman 대비 언급 빈도 낮음.

**(10) 장기 viability** — [Crunchbase: 외부 펀딩 없음, 독립 유지](https://www.crunchbase.com/organization/adrena-ce57). [AdrenaShip 상선용 라인 분기](https://www.adrenaship.com/)로 사업 다각화. 20년+ 운영, 안정적이나 작은 회사.

#### A6. Sailing Performance Solutions / KND SailingPerformance

**(1) 포지셔닝·가격·타깃** — [스페인 Valencia 본사, 2012년 Cyrille Douillet 창업](https://www.sailingperformance.com/about-us/). **최근 5번의 Ocean Race 중 4번 우승팀의 퍼포먼스 분석 담당** (Abu Dhabi 2015, Dongfeng 2018, 11th Hour Racing 2023). 타깃: AC·올림픽·VOR·TP52 프로 팀. 가격(USB 키): [EU 내 €98, 외 €108](https://www.sailingperformance.com/products/). 풀 PRO/TEAM 팩은 별도(공개 출처 미확인).

**(2) 기능** — 7개 핵심 툴: [Calibrator(데이터 품질·캘리브레이션 감사), RaceReplay(로그 업로드 → 리플레이, 그래프/통계, 폴라·타깃 업데이트, 오디오·사진·비디오 트랙 동기), PerfQuery(시즌/레가타 리포트, 폴라·크로스오버·타깃 지속 업데이트, 세일·기어 수명 통계), OnboardAssistant, PolarManager, LogCleaner(GPX/NMEA/KML 머지·필터), CrossoverChart](https://www.sailingperformance.com/products/).

**(3) 알고리즘** — Cyrille Douillet 등이 20년+ 누적한 데이터 분석 방법론. RaceReplay 는 "advanced algorithms for identifying calibration issues" 라고 명시 — 자세한 수식 공개 출처 미확인. Performance Analysis Service에서 [매일 캘리·스타트 퍼포먼스·풀 이벤트 리포트 산출](https://www.sailingperformance.com/services/performance-analysis-services/).

**(4) UX/UI** — Windows 데스크톱 도구 모음(USB 동글). RaceReplay는 트랙·그래프·통계·미디어 싱크 뷰. 일반 소비자용 모던 UI 보다는 분석가용 dense data tool.

**(5) 데이터 source** — 보트 인스트루먼트 로그(B&G WTP3·NKE 등), GPS, IMU, NMEA, 사용자 페이즈 마킹(세일 체인지, 헬름 변경 등 폰 입력으로 클라우드 푸시), 오디오·사진·비디오.

**(6) 출력·공유** — [WebReports/SailReports](https://www.sailingperformance.com/products/) 웹 리포트 출력, 폴라 파일 익스포트, 클라우드 데이터 푸시(RaceReplay).

**(7) 가격 모델** — USB 키 €98/€108 (개별 툴) + PRO 팩 / TEAM 팩. 풀 패키지 가격은 공개 출처 미확인 — [Sailing Anarchy 사용자가 "very expensive"라 평가](https://forums.sailinganarchy.com/threads/performance-logging-polar-comparison.212841/). Service 자체는 컨설팅 별도 계약.

**(8) 강점·약점** — 강점: 우승 팀들이 실제 사용 — 트랙 레코드 압도적, 캘리브레이션 깊이가 경쟁사 대비 강함. 약점: 가격, 일반 사용자·아마추어용 진입성 낮음, UI는 분석가용.

**(9) 사용자 리뷰** — [Sailing Anarchy performance logging 스레드](https://forums.sailinganarchy.com/threads/performance-logging-polar-comparison.212841/)에서 "비싸지만 분석 깊이는 다르다" 평. 일반 사용자 풀 작음.

**(10) 장기 viability** — 작지만 매우 안정적 — 우승팀들과의 지속 계약, 적극 개발([Version History](https://www.sailingperformance.com/version-history/)). 1명(Cyrille) 의존도 리스크.

#### A7. WTP3 (B&G Hercules)

**(1) 포지셔닝·가격·타깃** — [Grand Prix 레이싱·슈퍼요트용 B&G 최상위 인스트루먼트 시스템](https://www.bandg.com/bg/series/wtp3/). 가격: [CPU Pack $13,090 USD / €11,300 ex VAT](https://www.gps4us.com/BandG-CPU-Pack-WTP3-Instrument-System--P7476.html); 전체 시스템(센서·디스플레이 포함)은 그 이상. 타깃: TP52 MedCup, VOR, AC급 팀, 슈퍼요트.

**(2) 기능** — 멀티프로세서 CPU + 3개 독립 CAN 네트워크(1Mbit 각)로 distributed data acquisition. 입출력: CAN, Ethernet, USB data offload, NMEA 0183, RS232, RS422, NMEA 2000. 풍속/풍향, 보트 스피드, heel/trim/pitch, heading 등 모든 핵심 변수 계산. 폴라 기반 타깃 출력. IP67 방수.

**(3) 알고리즘** — [Wave Technology — 항공기 등급 axial rate sensor 로 보트 모션 효과를 풍속 데이터에서 제거](https://www.bandg.com/bg/series/wtp3/). Dr. Stuart Winn의 AC 알고리즘이 모든 풍속/풍향 계산의 기반. 구체 수식은 proprietary — 공개 출처 미확인.

**(4) UX/UI** — 인스트루먼트 자체는 디스플레이(B&G Triton, H5000 디스플레이, ZG100 등)와 결합. Deckman / Expedition을 PC 프론트엔드로 사용. WTP3 자체는 "블랙박스" 프로세서.

**(5) 데이터 source** — 풍속/풍향 마스트헤드 센서, 보트 스피드 패들/소나, 자이로/IMU(avionics grade), 컴퍼스, GPS, NMEA 외부 디바이스, 사용자 캘리브레이션 데이터.

**(6) 출력·공유** — USB data offload, Ethernet 라이브 스트림, NMEA 0183/2000 출력으로 Deckman/Expedition·디스플레이로 분배. 클라우드 통합은 자체 기능보다는 외부 소프트웨어 의존.

**(7) 가격 모델** — [하드웨어 일회성 $13,090 (CPU Pack)](https://www.bandg.com/bg/type/instruments/cpu-pack-wtp3-inc.-cablesmanual/) + 인증 전문가에 의한 커스텀 설치 비용. 센서·디스플레이·소프트웨어(Deckman 별도 $1,695) 추가. 풀 시스템 $30k+ 일반적.

**(8) 강점·약점** — 강점: 모션 보정의 업계 표준, GP·VOR·MedCup·AC 실전 검증, 확장성. 약점: B&G 자체가 "AC 팀에게도 부족할 수 있다"고 인정 — 포일링 보트 시대에 일부 영역에서는 한계, 가격, 커스텀 설치 필수.

**(9) 사용자 리뷰** — [Sailing Anarchy "H5000 Hercules vs WTP3"](https://forums.sailinganarchy.com/threads/b-g-h5000-hercules-vs-wtp3.195224/) — WTP3 는 GP 급, H5000 은 그 아래 세그먼트로 명확히 구분. 일반 사용자 리뷰는 적고 프로 팀 사용 사례가 주.

**(10) 장기 viability** — Navico Group → Brunswick Corporation 산하 (2020년 인수), 매우 안정적. WTP3 자체는 2010년대 출시 후 펌웨어/구성 업데이트 지속 — H5000 Hercules WTP가 현재 주요 후속 라인. 포일링 AC75 팀들은 점점 커스텀 시스템으로 이동.

### 2.B 컨슈머·클럽 racing 클러스터

#### B1-Deep. Vantage Sailing — Tier 0 심층 audit (Danny 7-axis, ML wind + Vakaros 공식 파트너)

> **연구 메타데이터.** 본 심층 audit 은 Vantage Technologies AS 의 공식 웹사이트 (`vantage-sailing.com`), 기술 페이지 (`/technology`), 가격 페이지 (`/pricing`), Getting Started 가이드, Vantage 공식 블로그 3편 (2025 Year-in-Review, Vantage 2.0 February 2026 release notes, May 2026 spring update), Apple App Store 리스팅 (`id6544807723`, 2026-04 기준 버전 2.0.2), Practical Sailor 2025-04-21 자 Vakaros Atlas 2 리뷰, 그리고 Northeastern Khoury College 동문 기사를 1차 출처로 사용했다. 알고리즘 내부 구조 (ML 모델 아키텍처, 손실 함수, 학습 데이터) 는 백서·논문이 공개되지 않았으므로 본문에서 "(공개 출처 미확인)" 으로 명시한다. 비교 baseline 으로 #### B1 (Vantage Sailing baseline 카드) 의 내용을 가정한다.
>
> **task brief 와의 사실 수정 사항 (verified against `/about` 및 `/blog/2025-year-in-review`).** ① 창업자 Nicolai Jacobsen 의 38th America's Cup 소속 팀은 task brief 에서 "(어느 팀? Emirates Team New Zealand? American Magic? INEOS Britannia? Alinghi?)" 로 열거되었으나, 공식 About 페이지는 명확히 **"Italian America's Cup Team Luna Rossa, as a Performance Data Analyst for the 38th America's Cup"** 으로 기재한다 (출처: `vantage-sailing.com/about`). ② Product Manager 의 풀네임은 task brief 의 "Victoria Jurczok" 가 아니라 **Victoria Schultheis** 이며, Women's Moth World Champion 우승 연도는 **2025년 (Moth Worlds, 7월)** 이다 (출처: `/about`, `/blog/2025-year-in-review`). 단, 같은 블로그가 그녀의 49erFX·Waszp·Switch 경력 및 독일 SailGP 팀 멤버 신분을 명시하므로 task brief 의 "Women's Moth World Champion" 자체 식별은 정확하다.

##### §1. 풍향 재구성 — Vantage 2.0 ML wind detection (7개 axis 중 가장 중요한 알고리즘 axis)

Vantage 의 ML wind 알고리즘은 본 audit 전체 35개 제품군에서 가장 명시적으로 ML 기반임을 자체 마케팅에서 천명한 사례이다. Technology 페이지의 1차 진술을 verbatim 인용한다 (영문 원문 보존; 한국어 해설 병기):

> "The algorithm computes true wind direction (TWD) and true wind speed (TWS) from your GPS and boat data using **physical constraints and class-specific polar diagrams**. Those polars act as a **guardrail**: the estimated wind is kept consistent with the expected performance of your boat, so the result is a **plausible, continuous time series** of TWD and TWS over the whole activity. It detects both major and minor wind shifts without any wind sensor — so you can get meaningful performance analytics from a simple GPS device alone. The only inputs we need are the boat class and a general wind strength band (e.g. Very Light, Light, Medium, Strong, or Very Strong); no manual wind entry is required." (출처: `vantage-sailing.com/technology`)

App Store 리스팅의 별도 진술도 ML 자칭을 강화한다:

> "Our cutting-edge **wind detection algorithms**, capable of **detecting minor shifts throughout the session**, result in VMG and performance numbers you can trust." (출처: Apple App Store `id6544807723`)

그리고 2.0.0 (2026-02-08) 릴리스 노트는 Vantage 1.x 와의 단절을 명확히 한다:

> "**New wind algorithm: Enhanced physical constraints and improved shift detection capability**" (출처: App Store version history)

**§1.1. "physical constraints" 의 의미 — 검증 가능한 해석.** Vantage 의 자체 문구를 분해하면 physical constraints 는 적어도 두 층위로 작동한다:

1. **Class-specific polar 를 boundary constraint 로 사용.** "polars act as a guardrail … kept consistent with the expected performance of your boat" 는 곧, 추정 TWD/TWS 가 주어진 boat speed (SOG) 와 heading 으로부터 역산되는 TWA 가 해당 클래스의 polar 위에 머무르도록 강제됨을 의미한다. 즉 "GPS 가 관측한 boat performance" 와 "polar 가 예측하는 boat performance" 의 잔차를 최소화하는 latent TWD/TWS 시계열을 찾는 inverse problem 구조이다. 이는 Cyril Tasse 식 "infer TWD from polar consistency" 와 동일한 부류이나, Vantage 는 명시적으로 **time-series continuity** 조건도 부과한다 ("plausible, continuous time series").
2. **Time-continuity prior — maneuver artifact 억제.** Technology 페이지는 별도 박스에서 "We use a **probabilistic model with physical constraints** so large TWD jumps during maneuvers are not always treated as real wind shifts, reducing bias in the time series while preserving real shifts." 라고 적시한다. 즉 tack/gybe 전후의 raw heading 점프나 attitude 격변이 풍향 추정에 직접 전이되지 않도록 **smoothness / continuity regularization** 가 들어가 있다 — 이것이 task brief 가 짚은 "풍축이 시간에 따라 connected smooth path 라는 prior" 의 verbatim 근거다. *추정* 으로 덧붙이자면, 이는 베이지안 state-space (e.g. Kalman / particle filter) 또는 RNN/Transformer 위의 temporal regularizer 둘 다 가능한 형식이지만, **정확한 모델 클래스는 (공개 출처 미확인)**.

**§1.2. "Same state → same solution" — repeatability claim.** Technology 페이지의 §4 항목은 "Equal boat states produce equal wind estimates, which supports consistent comparison" 이라 주장한다. 이는 statistical/deterministic mapping (Boat state vector → Wind state vector) 의 함수성 (functional property) 을 함의한다. 모델이 stochastic 한 경우 (예: dropout posterior), 추론 시점에서 결정론적 mode 만을 노출하는 inference path 를 사용한다고 *추정* 된다 (공개 출처 미확인). 이 repeatability 는 Velocitek/Sailmon 의 anemometer 기반 raw 측정과의 차별 포인트 — anemometer 는 설치·heel·mast bend 에 따라 두 보트가 같은 바람에서 다른 값을 읽지만, Vantage 의 모델은 같은 polar 상태에서는 같은 wind 를 항상 inference 한다는 주장이다.

**§1.3. Maneuver artifact handling — probabilistic model 진술.** Technology §3 "Maneuver artifacts" 박스: "**a probabilistic model** with physical constraints so large TWD jumps during maneuvers are not always treated as real wind shifts." 이 진술은 Vantage 가 단순 deterministic smoother 가 아니라 (a) maneuver 구간을 likelihood-weighted observation 으로 down-weight 하거나 (b) latent state 의 posterior 를 maneuver 전·후 비교로 sharpen 하는 구조임을 시사한다 — Bayesian state-space 또는 HMM-style maneuver gating 가 자연스러운 후보이지만 **정확한 generative model 은 공개되지 않음**.

**§1.4. 사용자 입력 — 거의 zero (단 두 필드).** Technology 페이지: "The only inputs we need are **the boat class** and **a general wind strength band** (e.g. Very Light, Light, Medium, Strong, or Very Strong); no manual wind entry is required." 즉 사용자는 풍향 자체를 입력하지 않는다 — 클래스 (polar 매핑) + 풍속 대역 (5단계 categorical prior) 만 제공. Onboarding 시점 Boat Profile 의 클래스 선택이 활용된다 (`/getting-started` "Create Your First Boat" 단계). 이는 Sailmon 의 manual TWD/TWS calibration UX 와 정확히 대척점.

**§1.5. Low-confidence fallback — UI 차원의 사람-인-루프.** 1.4.0 (2025-09-01) 릴리스 노트:

> "**New 'Confirm wind direction' feature when ML model returns low confidence on wind direction predictions**" (출처: App Store version history)

이는 모델 output 에 **calibrated confidence/uncertainty quantification** 가 attach 되어 있고, threshold 미만일 때 사용자에게 confirmation UI 를 띄운다는 의미이다. 학습된 model 이 single point estimate 가 아니라 **conditional probability distribution** 을 산출함을 강하게 시사한다 — *추정*: ensemble, Bayesian NN, 또는 conformal prediction 위에 confidence band 가 부착된 구조. 정확한 mechanism (공개 출처 미확인).

**§1.6. Sensor + algorithm — hybrid replacement, not fallback.** Technology 페이지는 명확히 "Vantage supports wind sensors when you have them; the algorithm is **used only when no wind sensor data is available**, so you can get full analytics from GPS alone." 즉 외부 wind sensor (Cyclops Marine 의 load cell, Sailmon 의 IO Plus anemometer 등) 가 업로드되면 그 raw TWD/TWS 가 ML 추정값을 **완전 대체** 한다 (May 2026 blog: "this seamlessly replaces your Vantage Wind Algorithm data and is used to calculate your CWA, VMG, and TWA"). 즉 Vantage 는 ML 을 backup/sensor 의 cross-check 로 쓰지 않는다 — sensor first, ML second 의 strict priority. (Sailmon 의 "manual + sensor fusion" 과는 다른 철학.)

**§1.7. Polar 업데이트와 모델 재학습의 결합 신호.** May 2026 blog: "We've updated polars for **19 classes**: 29er, A Class, C420, Cape 31, Etchells, F18, FJ, J70, Kite Foil, Melges 15, Melges 24, Moth, Nacra 15, Nacra 17, Switch 8.5, VX One, Waszp, and Wing Foil. **This improves wind direction accuracy across all of these classes.**" 이 한 문장에서 두 가지가 추론된다: (i) wind 알고리즘 정확도가 polar 그래프 품질에 직접 종속한다는 인과 관계가 공식 확인되며, (ii) 이는 모델이 **per-class** 로 분리 학습/튜닝되었거나 polar 가 inference-time conditioning input 임을 의미. *추정*: 후자가 더 가능성이 높음 — 19개 클래스를 동시 업데이트할 때 backbone 재학습보다 polar lookup 만 swap 하는 architecture 가 운영상 합리적. (공개 출처 미확인).

**§1.8. Founder 의 ML/data science 도메인 깊이 — backstory.** About 페이지: Nicolai Jacobsen 은 Northeastern University 에서 **Data Science** 전공, 그 후 **Luna Rossa AC38 팀의 Performance Data Analyst**. 즉 알고리즘 개발자가 (a) 정식 data science 학위 보유 + (b) AC 급 raw sensor pipeline (foiling AC75/AC40) 을 직접 다룬 실무 경험을 결합한 케이스. 이는 **본 audit 의 35개 제품 founder 중 ML 자격증명이 가장 명확** 한 사례이다 — Sailmon 의 H&M 계열 OEM 엔지니어, Velocitek 의 GPS 펌웨어 전문가들과 종류가 다른 background. Khoury College (Northeastern) 의 동문 기사가 별도 PR 자료로 존재 (URL: `khoury.northeastern.edu/northeastern-alum-nicolai-jacobsen-brings-analytics-to-the-world-of-competitive-sailing/`; 본 audit 시점 fetch 불가 — provenance 제약).

**§1.9. R&D 보강 — Emanuele Collia, AC75/AC40 hydrofoil turbulence 논문.** About 페이지: R&D 담당 Emanuele Collia 는 **"topological methods for modeling turbulence in hydrofoils of AC75 and AC40 boats"** 로 Cambridge University 에서 prize-winning paper 를 작성한 학생이며, Italian Olympic 470 national team 의 data analyst 출신. 즉 Vantage 의 R&D 라인은 단순 ML 엔지니어가 아니라 **CFD/topological turbulence 모델링** 출신을 보유한다 — wind 알고리즘 보다는 향후 flow/foil 관련 metric 확장에 기여할 가능성이 높다 (*추정*).

##### §2. 외부 날씨 데이터 통합

**§2.1. 외부 weather API 호출 — 공개 진술 없음.** Technology 페이지, Getting Started, Pricing, 그리고 3편의 공식 블로그 어디에도 "기상청·NOAA·OpenWeather·Predictwind·Windy API" 와의 통합 진술은 없다. Vantage 의 wind 데이터는 두 가지 source 만 인정한다: (i) 사용자의 GPS+motion 데이터로부터 ML 모델이 inference 한 TWD/TWS, (ii) 외부 wind sensor 파일 업로드 (Cyclops, Sailmon 등). 즉 **third-party weather forecast/observation feed 의 자동 fetch 는 (공개 출처 미확인)**.

**§2.2. 외부 sensor 파일 업로드 — May 2026 신기능.** May 2026 blog:

> "you can now upload third party files, ranging from **wind sensor files, Cyclops Load Cell data, and sail shape files from Sailemetry**. … For wind data, this is seamlessly replaces your Vantage Wind Algorithm data and is used to calculate your CWA, VMG, and TWA."

업로드 경로: Activity Settings → Add External Data → Upload File. 파일 포맷 list 는 공개되지 않음 ("Support depends on the file type and structure, and we're adding new formats all the time"). 이는 weather data 통합과는 다른 갈래 — **sensor data** 통합이다.

**§2.3. 환경 데이터 부재의 의미.** 본 audit 의 weather data 관점에서 Vantage 는 "**pure GPS / sensor data driven**" 진영에 속한다 — current·tide·forecast 의 외부 layer 가 없다. 이는 (a) Vantage 의 핵심 user persona 인 **인쇼어 dinghy/foiler/Olympic-grade racer** 에게는 weather feed 가 in-app 핵심 가치가 아니라는 product 선택, (b) Sailmon Connect / Predictwind 와의 cross-integration 가능성이 *추정* 차원에서 열려 있으나 공식 진술 없음. (한국 윙포일 사용자 입장에서 외부 weather feed 는 별도 앱 — Windy, Windguru — 으로 보완해야 함.)

##### §3. 폴라 / target 곡선

**§3.1. 80+ 클래스 polar 라이브러리 (사이트 1차 진술).** 홈 페이지: "80+ classes · Olympic classes, J70, Wing Foil & more" (`/`). May 2026 blog 는 polar 업데이트 19개 클래스를 명시하고, 2025 Year-in-Review 는 "**Active boat classes: 64**" (2025 말 시점, 실 사용자 활동 기준) 로 보고. 즉 **80+ 는 polar 라이브러리, 64는 실사용 클래스** 의 차이로 *추정*.

**§3.2. Polar 의 inference-time 역할.** §1.1 에서 다룬 대로 polar 는 ML wind 추정의 **boundary constraint / guardrail** 로 직접 입력된다. 즉 Vantage 의 polar 는 단순 target VMG 표가 아니라 **모델 conditioning input** 이다 — 이 점이 본 audit 의 다른 polar-기반 제품 (Expedition, B&G H5000, Deckman) 과 가장 다르다. Expedition 은 polar 를 target/predicted boat speed lookup 으로만 쓰지만, Vantage 는 wind inverse problem 의 likelihood term 에 끼워 넣는다.

**§3.3. Polar customization UI — 공개 진술 없음.** Getting Started 의 "Creating a Boat Profile" 단계는 클래스 선택만 다룬다. 사용자가 자기 폴라 곡선을 import/edit/tune 할 수 있는지는 **(공개 출처 미확인)**. *추정*: organizational plan ("direct API access to team activities" 가 Pricing 페이지에 언급) 에서만 polar override 가 가능할 수 있음.

**§3.4. Target 곡선 시각화.** "Speed Analysis" feature card 진술: "Analyze straight-line speed, VMG, and boat state with curated performance metrics" — polar 와 비교한 % polar 표시 여부는 데모 스크린샷 (`desktop-speed-analysis.png`, `phone-speed-analysis-demo.webp`) 에서 텍스트로 확인되지 않음. *추정*: violin/box plot 의 distribution context 가 polar 대신 historical fleet performance 와의 비교를 더 강조하는 디자인 (May 2026 blog 의 Cyclops 통합 스크린샷 캡션이 "distribution violin by tack" 으로 적시).

##### §4. 회전 손실 / maneuver analysis

**§4.1. Maneuver Analysis — 일등 시민 기능.** Vantage 의 5개 핵심 feature 박스 중 두번째: "**Maneuver Analysis** — Break down tacks and gybes to find where you gain or lose in maneuvers." (`/`) 즉 회전 손실 분석이 product narrative 의 상위 1-2 axis 이다.

**§4.2. Vantage 2.0 의 maneuver 분석 확장 (verbatim 인용).** February 2026 blog:

> "With the new **Analysis Filters**, you can also be more specific about the types of maneuvers you're analyzing. … Box Plots to better visualize the range of metrics, **Timeseries charts to analyze all your maneuvers**, and have included lots of new metrics, including **Steering Stability, Heel Stability, SOG Stability, Pitch and CWA**."

이 다섯 가지 신규 metric — **Steering Stability** (조타 미세 진폭), **Heel Stability** (히일 안정성), **SOG Stability** (대지속도 안정성), **Pitch** (포일링 클래스의 핵심), **CWA** (Course Wind Angle — heading 대신 COG 기반 TWA, magnetic compass 의존성 제거) — 는 maneuver 단계에서 사용자가 진단할 수 있는 새로운 axis 이며, 본 audit 의 35개 제품 중 **CWA 라는 별도 메트릭을 명시 정의한 거의 유일한 사례** 다.

**§4.3. CWA 의 정의 (verbatim).** February 2026 blog:

> "CWA stands for **Course Wind Angle**. Course Wind Angle is the same as TWA, but uses COG instead of heading as the angle. This means that instead of relying on the device's magnetic compass, which is more at risk of misalignment and interference, **COG uses the device's GPS position**."

이 한 문단이 algorithmic 차원에서 시사하는 바: Vantage 는 magnetic compass calibration 오차를 회피하기 위해 GPS 기반 COG 를 primary heading proxy 로 채택한다 — 즉 in-app recording iPhone/Android 사용자에게도 magnetic compass 의 indoor calibration 부담을 transparent 하게 흡수한다. (Velocitek SpeedPuck 의 단점 — flush mount 후 deck steel 에 영향받는 compass calibration — 을 architectural 차원에서 우회.)

**§4.4. Performance percentile filtering — top 50% / top 20%.** February 2026 blog: "Filter by level of performance instead of analyzing your entire session. Vantage can now zone in on your **top 50% or top 20%** for speed and maneuver analysis." 이는 maneuver-level distribution 의 right-tail 만 추출해 best practice 학습을 가속하는 UX. 본 audit 의 다른 maneuver tool (Velocitek SpeedPuck 의 pure stopwatch, Sailmon 의 leg-aggregate) 과 차별.

**§4.5. Maneuver timeseries chart — Vantage 2.0 신규.** 동일 blog 의 "Maneuver analysis timeseries chart" 스크린샷 캡션. 이는 (a) 단일 tack/gybe 의 시간축 trajectory 를 fleet/self-historical mean 위에 overlay 하는 방식과 (b) 다수 maneuver 의 superimposed time-aligned trajectory 둘 중 하나로 *추정*. (공개 출처 미확인 — 스크린샷의 fine-print 미해독.)

##### §5. 통계 패널 / 시각화 — speed bias, tack bias, distribution

**§5.1. Speed Analysis 의 1차 metric set.** 홈 페이지 product 설명: "Get **speed analysis (VMG, tack bias, distribution)**, maneuver analysis, and automatic or custom segments." (`/`) "tack bias" 는 좌·우현 (port/starboard) 간 성능 비대칭, "distribution" 은 시간/거리에 대한 metric 분포로 *추정*.

**§5.2. Box plot / violin plot — Vantage 2.0 신규.** February 2026 blog: "Clearer visuals with improved charts and new plots for more insights. We have included **Box Plots** to better visualize the range of metrics … Maneuver analysis timeseries chart … SOG Stability and distribution box plots." May 2026 blog 의 Cyclops Load 통합 스크린샷 캡션은 "**Vantage Speed Analysis: Upwind, distribution violin by tack**" — 즉 violin plot 까지 지원.

**§5.3. Trend Analysis — long-term 시계열.** February 2026 blog:

> "Our revamped trend analysis will give you a clearer breakdown of your progress over the past weeks and months. Review what you have spent your time on during the past weeks, grouped by the type of conditions or the focus of your sessions. See how your **Vantage Performance Score** has improved over time in each category."

"Vantage Performance Score" 는 별도 metric 으로 Getting Started 의 "Performance Analysis → Vantage Performance Score" 챕터에서 다뤄지나, 정확한 공식은 본 audit 시점 페이지 텍스트로는 확인되지 않음 (in-app help 자료에 위치 추정).

**§5.4. Stats by wind strength — segmented aggregation.** 동일 blog 의 "Stats and total distance by wind strength" 스크린샷 — 즉 wind band (Very Light / Light / Medium / Strong / Very Strong, §1.4 의 입력 5단계와 동일 schema) 별로 distance·hours·performance breakdown.

**§5.5. Stability metric family — Vantage 2.0 의 메트릭 혁신.** §4.2 에서 인용한 Steering / Heel / SOG Stability 는 단순 분포가 아니라 **2nd-order statistic** (분산, 자기상관, 잔차의 RMS 등) 로 *추정* 된다. 정확한 정의는 (공개 출처 미확인) — in-app Performance Metrics Explained 챕터에 위치한다는 추정.

##### §6. 리플레이 시각 언어 — 영상-데이터 동기 + side-by-side connection 비교

**§6.1. Activity Replay — 1차 모드.** 5개 feature card 중 "**Activity Replay** — Replay sessions with data overlay, telemetry charts, and teammate tracks." (`/`) 즉 (a) GPS track + (b) telemetry chart + (c) 동료 트랙 overlay 가 한 화면.

**§6.2. Video Telemetry — 영상 overlay.** "Video Telemetry — Overlay real-time data on your sailing footage for deeper debriefs." 이는 video 위에 real-time numerical/graphical telemetry 를 superimpose 하는 방식. PRO 구독에서만 제공 (Pricing).

**§6.3. 10개 영상 동시 업로드 — 정확한 출처.** 1.2.2 (2025-04-22) 릴리스 노트:

> "New video player! Videos can now play locally, meaning you can instantly play videos and debrief straight away. Additionally, you can now **upload up to 10 videos at once**. Video time can easily be synchronized with telemetry using our new improved video edit UI." (출처: App Store version history)

즉 10개 동시 업로드는 2025-04 부터 제공. 시간 동기는 "**video time synchronization UI**" 로 사용자가 수동 조정 (자동 매칭은 명시되지 않음 — *추정*: GoPro/iPhone 의 EXIF/metadata 타임스탬프와 GPS 타임의 manual offset).

**§6.4. Sync Video Time — Getting Started 챕터.** Performance Analysis → "**Sync Video Time** (PRO)" 가 독립 챕터로 존재 — 즉 영상-데이터 동기는 manual sync UI 가 정식 워크플로우 ([Getting Started](https://www.vantage-sailing.com/getting-started)). 자동 audio fingerprinting, GoPro time sync, 또는 GPS timestamp 매칭 같은 자동화는 (공개 출처 미확인).

**§6.5. Connection 시스템의 mechanism.** App Store description:

> "Connect with your peers and coaches for seamless data sharing and comparison. **When you have sailed at the same time and location, Vantage will automatically allow you to share your data through a simple click.**" (App Store)

홈 페이지 Step 04: "When you've sailed at the same time and location as your connections, **compare data side-by-side** in visualizations and stats. See precisely where you gained or lost time and use it to improve together." (`/`)

즉 connection 시스템은 두 단계:
- (a) **Connection establishment** — user-to-user opt-in friend graph (Getting Started "Creating Connections (Sailor)" 챕터). Privacy: trim data 는 "private and remains private" (February 2026 blog), 활동 데이터는 connection 에게만 노출.
- (b) **Auto-prompt for sharing** — 같은 timestamp & GPS bounding box 안에서 두 user 가 sail 한 것이 detect 되면 in-app prompt 가 "share with X?" 로 노출 (one-click). 정확한 매칭 알고리즘 (timestamp window, GPS radius threshold) 은 (공개 출처 미확인).

**§6.6. Side-by-side 비교 — Vantage 2.0 의 확장.** February 2026 blog:

> "**Instead of comparing your track to only 2 connections at a time, you can now compare up to 3 connections on the mobile app and up to 8 connections on the Desktop version.**"

즉 데스크탑 (Mac) 에서 1+8=9개 동시 track overlay 가 가능. dinghy fleet (10인 안팎) training session 의 full-fleet comparison 에 근접한 수준.

**§6.7. Vakaros 의 start replay 통합.** 1.4.4 (2025-10-15) 릴리스 노트:

> "**Replay Vakaros starts**: For users with Vakaros devices, you can now replay starts from the session. Simply upload your **VKX file** to Vantage, and the starts will show up in activity replay."

즉 Vakaros Atlas 2 의 `.VKX` 파일 (Vakaros 의 native format) 을 직접 parsing — start line crossing replay 가 Vantage 안에서 재현된다. 본 audit 의 starting strategy 카테고리에서 Vantage 가 Vakaros 와 가장 깊은 데이터 통합을 가진 partner 임을 확인.

**§6.8. Practical Sailor 의 verbatim 3rd-party 검증.** Practical Sailor 2025-04-21 Vakaros Atlas 2 리뷰는 George Lee Rush (NZL Moth 선수, 49er Worlds 2026 우승) 의 워크플로우 기술을 인용한다:

> "You literally just upload your data to your phone from the Vakaros and then download that to a file, which you plug into the **Vantage app**. It gives you all your stats, like your speed and your VMG. It **calculates an expected wind angle**, analyzes your maneuvers, and it just does it all for you." (Practical Sailor, 2025-04-21)

이는 (a) Vakaros + Vantage 가 비공식 partnership 이 아니라 sailor 사용자 워크플로우에 정착된 사실상 표준 stack 임을 외부 매체가 확인했고, (b) "expected wind angle" 이라는 표현이 §1 의 ML wind inference 와 사용자 perception 으로 일치함을 확인한다. (Practical Sailor 본문 자체는 advertorial 톤이라 댓글에서 비판받지만, sailor quote 자체는 1차 source.)

##### §7. 가격·구독·사용자 base·운영

**§7.1. 법인.** Vantage Technologies AS — 노르웨이 법인 (AS = Aksjeselskap, joint-stock company). App Store seller/developer field 에서 명시 (`apps.apple.com/us/developer/vantage-technologies-as/id1757449643`). App Store copyright "© 2024 Vantage Technologies AS" — 즉 2024 년 등기·App Store 등록. 노르웨이 Brønnøysund Register (`brreg.no`) 의 직접 fetch 는 본 audit 시점 provenance 제약으로 미수행. Crunchbase 의 Vantage Technologies AS profile 도 동일 (URL provenance 제약). 자금 조달 라운드 (seed 등) 는 **(공개 출처 미확인)** — 자체 블로그·web site 에 funding 진술 없음.

**§7.2. 가격 구조 (`/pricing`).**

| 플랜 | 월 | 연 (월 환산) | 핵심 차이 |
|---|---|---|---|
| Starter | $0 | $0 | Basic session analysis, speed/maneuver analysis, **unlimited activity uploads** (놀랍게도 free 도 unlimited upload), connections, **mobile only** |
| PRO (Sailor) | $19.99 | $119.99/yr ($10.00/mo 환산) | 모든 PRO feature: 데스크탑 access, custom segments, video telemetry, trend analysis, connection 비교 |
| Coach | $29.99 | $179.99/yr ($15.00/mo 환산) | PRO + 무제한 team, 팀 멤버 활동 관리/편집, **priority support** |
| Organization (custom) | 문의 | 문의 | API access, volume licensing |

App Store IAP 와 동일 가격. **30-day free trial** 이 PRO·Coach 에 제공 (`/pricing` FAQ). 가격은 국가/통화/세금에 따라 변동 ("Pricing may vary based on your country").

**§7.3. 사용자 base 추이 (verbatim 공식 수치).**

- 홈 페이지 헤더 (현행, 2026-05): "**4.9 • 2k+ users • 12k+ activities**"
- 2025 Year-in-Review (2025-12): Hours 22,000+, Distance 335,000 km+, Sailors **1,600+**, Sessions 10,000+, Maneuvers 390,000+, Active classes 64, Peak speed 40.8 kts
- May 2026 blog: "We are so excited to have surpassed **2,000 Vantage users** towards the end of March."
- App Store: **10 ratings, 4.7 평균** (US store, 2026-05 기준)

즉 2025-12 1,600+ → 2026-03 2,000+ → 2026-05 2,000+ 추이로, Q1 2026 에 **+400 users (25%) 성장** 후 2.0 release 이후 momentum 유지. App Store rating 수 (US 10개) 는 절대 수치는 작으나 4.9 (홈) / 4.7 (App Store) 로 NPS-grade 점수.

**§7.4. 플랫폼 분포.** iOS (iPhone, iPad), macOS, Android — 3-platform. iOS 16.6+/macOS 12.4+ 요구. App Store 사이즈 139.4 MB. 데스크탑 (Mac) 은 PRO 이상에서만 access — 즉 paid tier 의 핵심 conversion driver.

**§7.5. 한국어 지원 — App Store metadata 한정.** Apple App Store 의 product page 에 **한국어 (ko) locale** 이 노출되어 있음 (`apps.apple.com/us/app/vantage-sailing/id6544807723?l=ko`). 단 App Store 의 "Languages" 필드는 **"English"** 만 표시 — 즉 store metadata 의 storefront localization 만 한국어이고, **앱 UI 는 영어 only** 로 *추정*. 한국 distributor 부재, 한국 윙포일/딩기 커뮤니티 (네이버 카페, 인스타그램, 유튜브) 에서의 Vantage 멘션은 본 audit 시점 검색 미수행 (provenance 제약) — 자체 검색에서 한국어 콘텐츠 멘션은 **(공개 출처 미확인)**. 한국 사용자는 모바일 IAP only 로 결제 (Vakaros Atlas 2 의 $1,199 hardware 와 결합 시 부담 큼).

**§7.6. Endorsement 및 ambassador.** 홈 페이지 testimonial:

| 이름 | 자격 |
|---|---|
| Dylan Fletcher-Scott | Olympic & SailGP Champion (GBR) |
| Diego Botin | Olympic Champion & SailGP Driver (ESP) |
| Chris Rashley | Olympic Coach & World Champion (GBR) |
| Alessandra Dubbini | 2026 470 European Silver Medalist (ITA) |
| Flying Jenny | Melges 24 Bacardi Winter Series #2 2026 winner |
| Hattie Rogers | Moth World Champion 2024 (GBR) |

May 2026 blog 추가 멘션: Pearl Lattanzi (USA Waszp), Gavin Ball, Martinius Hopstock (NOR), Richard Schultheis (GER 49er), Pia Dahl Andersen/Nora Edland (NOR 49erFX Worlds 2026 winners), Seb Menzies/George Lee Rush (NZL 49er Worlds 2026 winners), Enzo Balanger (FRA Moth Worlds 2025 winner).

즉 endorsement pool 이 (a) Olympic class 의 49erFX·49er·470·Moth, (b) foiling 의 Waszp·Switch, (c) 일부 keelboat (Melges 24, Flying Jenny) 로 distribution. 가장 약한 영역은 keelboat offshore — Vantage 의 인쇼어/Olympic foiling positioning 과 일치.

**§7.7. 자문단의 무게 — Russell Coutts 등.** About 페이지의 Board of Advisors:

| 이름 | 직함 | 핵심 자격 |
|---|---|---|
| Olav Aleksander Bu | Advisor of Science | Norwegian Olympic 코치 (Blummenfelt/Iden), Santara Tech 공동창업 |
| Knut Frostad | Advisor of Strategy | 전 Volvo Ocean Race CEO, Navico/B&G 사장, Henri Lloyd 회장 |
| Rune Jacobsen | Advisor of Strategy | 전 Olympic Soling 선수, BCG MD/Senior Partner |
| **Russell Coutts** | Advisor of Strategy and Sport | **5x America's Cup winner, 1984 Olympic gold, SailGP CEO** |
| Eirik Verås Larsen | Norwegian Sailing Team Representative | 4x Olympic kayak medalist, 노르웨이 Sailing Team 스포츠 디렉터 |

이 보드 구성은 **본 audit 의 35개 제품 중 가장 strong** — 특히 (a) Russell Coutts (SailGP CEO) 가 직접 strategy advisor 인 점, (b) Knut Frostad (전 Navico/B&G 사장) 가 strategy advisor 로 marine electronics 산업 internal 인맥, (c) 노르웨이 Olympic system 과의 공식 연결 — 신생 startup 의 weakness (App Store rating 수) 를 보드 의 lock-in 으로 보완.

**§7.8. 운영 인프라.** Technology 페이지의 "Security & Privacy" 박스: "Data is encrypted at rest (**AES-256**) and in transit (**TLS**), with **row-level data security** so your performance data stays isolated and protected." 즉 multi-tenant SaaS architecture (row-level security 는 PostgreSQL/Supabase 의 RLS 또는 동등 구조 *추정*). 데이터 보관·privacy 정책은 `/privacy` 와 `/privacy-policy` 두 페이지가 분리 운영. App Store privacy disclosure 는 Health & Fitness, Location (Precise + Coarse), Contact Info, User Content (Photos/Videos 포함), Identifiers (User ID), Other Data 가 "Linked to You" 로 collected — 즉 ID-linked telemetry 가 풍부 (Coach 플랜의 manage-sailor 기능 필수).

**§7.9. Partner 네트워크.** 홈 페이지 "Partners" 섹션: **Vakaros, Cyclops Marine**. Sailmon, Garmin, Polar, Suunto 는 "Integrates seamlessly with your favorite device" 의 logo bar 에 노출되나 별도 partner 표시는 아님. 즉 partnership 의 hierarchy:
- **Tier 1 (공식 partner)**: Vakaros (VKX file native parsing, start replay), Cyclops Marine (load cell raw data merging).
- **Tier 2 (integration only)**: Sailmon, Garmin (Garmin Connect 자동 sync), Polar, Suunto, GPX standard.

Sailemetry (sail shape) 는 May 2026 blog 의 "Add External Data" 통합 대상으로 별도 언급.

---

##### 종합 — Vantage Sailing 의 strategic positioning 과 Danny 7-axis 종합 평가

| Axis | Vantage 의 상대 위치 (35-product 비교) |
|---|---|
| §1. 풍향 재구성 | **본 audit 의 가장 ML-first 명시 사례** — physical constraint + probabilistic model + per-class polar conditioning + confidence-aware fallback UI. Cyril Tasse 식 polar-inverse 의 modernized 버전. 알고리즘 ML 진정성에서 #1 후보. |
| §2. 외부 날씨 통합 | **부재** — pure GPS/sensor only. weather feed integration 은 not on roadmap (공개 진술 기준). |
| §3. 폴라 | **80+ 클래스 + 19개 최근 업데이트**. inference-time conditioning 으로 사용 — Expedition 등 polar-as-target 보다 더 깊은 통합. customization 은 enterprise only *추정*. |
| §4. Maneuver | **Vantage 2.0 의 핵심 추가** — Stability metric family (Steering/Heel/SOG/Pitch) + CWA + timeseries chart + top-percentile filter. 본 audit 중 maneuver depth top-3. |
| §5. 통계 | Box/violin plot, distribution by tack, Vantage Performance Score, trend analysis by wind band — comprehensive. Stat 1st-order 보다 2nd-order (stability) 강조가 차별화 포인트. |
| §6. 리플레이 / 영상-데이터 동기 | **10개 영상 동시 업로드 + 9-track side-by-side desktop + Vakaros VKX start replay native parsing**. Connection 시스템의 auto-prompt 매칭 (timestamp + GPS bbox) 이 social layer 핵심. |
| §7. 가격·base | $0 free unlimited / $119.99 PRO yr / $179.99 Coach yr — Sailmon Connect ($359/yr) 의 1/3, Expedition ($1,300+) 의 1/10. 2,000+ users (2026-05), App Store 10 ratings 4.7. AC38 출신 founder + Russell Coutts 자문단 = strong narrative but small revenue base 초기 단계. |

**핵심 질문 4개에 대한 답.**

1. **"physical constraints" 가 ML 에서 어떤 의미인가?** — Vantage 의 공식 진술 기준 두 가지: (a) class-specific polar 가 estimated wind 의 boundary (boat performance consistency 강제) 로 작동, (b) maneuver 구간의 TWD jump 가 "real shift" 로 오인되지 않도록 time-continuity prior 와 probabilistic likelihood weighting 이 결합. 둘 다 task brief 의 "connected smooth path / polar boundary" 가설과 정확히 일치. 그러나 모델의 정확한 mathematical formulation 은 (공개 출처 미확인).

2. **AC 38 분석가 founder 의 도메인 깊이.** — Nicolai Jacobsen 은 (a) Northeastern University Data Science 정식 학위, (b) Luna Rossa AC38 팀 Performance Data Analyst 로 AC75/AC40 의 sensor pipeline 직접 다룸, (c) 동시에 Moth European Champion 2024 / Moth Junior World Champion 2021 — 즉 ML 엔지니어 + AC pro analyst + foiling racer 의 3중 자격. R&D 라인의 Emanuele Collia 가 Cambridge prize-winning AC75/AC40 hydrofoil turbulence 논문 — domain depth 가 paper-trail 로 검증되는 본 audit 의 거의 유일한 사례.

3. **"connection" 시스템의 mechanism.** — opt-in friend graph 위에서, 같은 timestamp window + GPS bounding box 안의 두 user 가 sail 한 것이 detect 되면 in-app share prompt (one-click) 가 노출. Trim data 는 private 유지, activity data 는 connection 에게만 노출. Vantage 2.0 부터 mobile 1+3, desktop 1+8 동시 비교. 정확한 매칭 thresholds 는 (공개 출처 미확인).

4. **신생 제품의 PMF 신호.** — App Store ratings 수 (US 10개) 는 작지만 (a) 2025-12 1,600 → 2026-03 2,000 user 25% 분기 성장, (b) 4.9 자체 / 4.7 App Store rating, (c) Pia Dahl Andersen/Nora Edland (49erFX Worlds 2026), Seb Menzies/George Lee Rush (49er Worlds 2026), Enzo Balanger (Moth Worlds 2025), Pearl Lattanzi (Waszp Games 2026), Richard Schultheis (Trofeo Princess Sofia 2026) 등 **2024-2026 시즌의 신규 chamions 가 Vantage user** — endorsement 의 freshness 가 high. PMF 는 "Olympic-grade dinghy/foiling community 안에서는 명확히 fit, 일반 keelboat/cruiser 시장 진출은 미증명" 으로 요약.

**한국 시장 implication for SailTechCo.** Vantage 의 가격 (free tier + $120/yr) 과 mobile-first architecture 는 한국 윙포일/딩기 커뮤니티에 직접 진입 가능한 stack. 그러나 (a) 앱 UI 영어 only (App Store metadata 만 ko), (b) 한국 distributor 부재, (c) 한국 윙포일 사용자가 가장 빈번히 쓰는 Garmin Fenix 시리즈와의 auto-upload 만 잘 동작하면 hardware lock-in 없이 도입 가능, (d) Vakaros Atlas 2 $1,199 의 한국 도입 부담은 Vantage 와 분리해서 평가해야 함. 단무지공방의 차별화 포인트: **한국어 UI / 한국 윙포일 spot 의 weather feed 통합 / 한국 sailing federation 등록 클래스 (Optimist, ILCA 7/6, 470, 49er) 의 polar lib** 가 Vantage 의 architectural gap 과 정확히 겹친다.

---

#### B1. Vantage Sailing

**(1) 포지셔닝·가격·타깃** — 노르웨이 [Vantage Technologies AS](https://www.vantage-sailing.com/about) 개발 iOS·Android·Mac 기반 [세일링 분석 앱](https://www.vantage-sailing.com/). "Built by sailors, for sailors" — 창업자 Nicolai 는 38th America's Cup Performance Data Analyst 출신, 공동창업자 Victoria 는 Women's Moth World Champion. 타깃은 야심 있는 경쟁 세일러(딩기 ~ 모스 등). 가격은 [App Store](https://apps.apple.com/us/app/vantage-sailing/id6544807723) 페이지에 PRO 구독제 명시, 정확한 금액은 (공개 출처 미확인).

**(2) 기능** — Speed analysis(VMG, tack bias, distribution), maneuver analysis, automatic/custom segments, 세션 후 즉시 메트릭 산출, **동일 시간·장소를 항해한 connection 들과 사이드바이사이드 비교**, **최대 10개 영상 업로드 후 텔레메트리와 시간 동기화** ([App Store description](https://apps.apple.com/us/app/vantage-sailing/id6544807723)).

**(3) 알고리즘** — Vantage 2.0에서 "physical constraints + improved shift detection capability"를 갖춘 새 wind algorithm 공개. **머신러닝 기반 wind detection 모델로 세션 중 minor shift 까지 검출** ([제품 페이지](https://www.vantage-sailing.com/)). 정확한 ML 아키텍처·polar 산출 수식은 (공개 출처 미확인).

**(4) UX·UI** — 모바일 우선(iOS/Android), Mac 도 지원. visualization 중심 대시보드 — 스피드 분포, tack bias, segment 별 비교. **영상-데이터 동기 플레이어가 핵심 시각요소.**

**(5) 데이터 source** — 폰 내장 GPS + 외부 계측기 import (Sailmon, Vakaros, Garmin, GPX). Vakaros 연동 시 start replay 지원.

**(6) 출력·공유** — connection 간 side-by-side 비교 시각화. 영상 + 데이터 오버레이 export. PDF/공유링크 명시 (공개 출처 미확인).

**(7) 가격 모델** — Freemium + PRO 구독. 정확한 금액 (공개 출처 미확인).

**(8) 강점·약점** — 강점: ML 기반 wind shift 검출, 다중 외부 디바이스 import, 영상-데이터 동기. 약점: 신생 제품이라 App Store 리뷰 부족, **connection 비교는 같은 시간·장소 세일러가 있어야만 작동(네트워크 효과 의존)**.

**(9) 사용자 리뷰** — [App Store US](https://apps.apple.com/us/app/vantage-sailing/id6544807723), [Google Play](https://play.google.com/store/apps/details?id=com.vantage.sailingapp), [AppBrain](https://www.appbrain.com/app/vantage-sailing/com.vantage.sailingapp): 리뷰 수 부족 "no ratings yet" (2026-05-27 기준).

**(10) 장기 viability** — America's Cup 38th 분석가 출신 창업으로 도메인 신뢰성 높음. 2.0 알고리즘 메이저 업데이트 — 활발한 개발. 단 사용자 베이스는 아직 작음.

#### B2. Njord Analytics / Njord Player (압축 — 원본은 `Njord_Analytics_벤치마크_갭분석_2026-05-22.md`)

**(1) 포지셔닝·가격·타깃** — [Njord Analytics](https://www.sailnjord.com/analytics/)는 올림픽 딩기부터 그랑프리 요트까지의 레이싱 세일러·코치·내비게이터용 브라우저 기반 분석 SW. [Njord Player](https://www.sailnjord.com/player/)는 데이터+영상 동기 디브리프 도구. 과금은 "실제로 세일링한 day" 단위.

**(2) 기능** — Maneuver Loss Analysis(택·자이브·Turn Up·Bear Away 4분류, 손실 순 랭크, 공통 타임라인 중첩), 통계 패널(Avg/Min/Max + % of target), 폴라/Scatter chart/Polar editor, race/leg 자동검출, Fleet race report, start line, gain/loss, [Performance Database](https://www.sailnjord.com/performance-database/), **50+ 로그 포맷** ([Maneuvers](https://app.sailnjord.com/help/analytics/maneuvers.html)).

**(3) 알고리즘** — **풍향 4 소스**: Inferred from typical TWA(회전 이등분 + target 각도), Weather Data, Constant, Interpolated over Time ([Adding Wind Data](https://app.sailnjord.com/help/analytics/adding-wind-data.html)). 회전 손실 계산 2종 선택. Before/After 20초 평균 베이스라인.

**(4) UX·UI** — 웹 브라우저 + 데스크톱 Player. 지도+미니차트+영상 다창 동기 재생, leg 브라우저 사이드바, race-aware 타임라인. iPad/안드로이드 태블릿 Web Player.

**(5) 데이터 source** — 외부 계측기 로그 (Expedition·B&G·NKE·Vakaros·NMEA 등 50+ 포맷). 코치보트·기상관측소 데이터 동시 로드.

**(6) 출력·공유** — 영상 baked-in export, 사진 일괄 export(타임스탬프 데이터 포함), 리포트 공유링크, 팀 접근 권한, 회전별 raw CSV.

**(7) 가격 모델** — "Sailed day" 기반 사용량 과금 (상세 단가는 [Pricing](https://www.sailnjord.com/) 직접 확인).

**(8) 강점·약점** — 강점: 풍향 추론 다원화, race/leg 자동분할, 영상 동기, polar editor, 시즌 DB, 50+ 포맷. 약점: TWA 메트릭 필수(없으면 maneuver 검출 불가), 1인 freeride 맥락엔 무거움, fleet/event/race 위계가 solo에 과함 ([FAQ](https://app.sailnjord.com/help/analytics/faq.html)).

**(9) 사용자 리뷰** — 웹 SW 라 App Store 리스팅 없음. Sailing Anarchy/Reddit 정성 평가 (공개 출처 미확인).

**(10) 장기 viability** — [What's New](https://app.sailnjord.com/help/analytics/whats-new.html) 페이지에 지속 업데이트 기록. 그랑프리·올림픽 코치 사용 사례로 도메인 lock-in. 안정적 운영.

> **§2.B2-Deep — Njord Analytics Tier 0 심층 audit (Danny 명시 — 본 audit 의 가장 깊은 단일 섹션)**

#### §0. 본 deep-dive 의 위치

이 섹션은 `Njord_Analytics_벤치마크_갭분석_2026-05-22.md` (이하 "기존 audit") 와 위 §B2 카드를 **대체하지 않고 확장**한다. 기존 audit 가 다루는 (a) 5대 영역 카탈로그, (b) 코드와의 기능별 갭, (c) 우선순위 종합, (d) 윙포일 제외 항목, (e) 우리가 앞선 지점은 그대로 유효. 본 deep-dive 는 Danny 가 지목한 **7개 축에서만 더 깊게** 들어간다 — 알고리즘 수식 레벨, 외부 의존성, 가격, 운영. 새 정보는 모두 2026-05-27 추가 웹리서치(sailnjord.com 직접 fetch + 회사등기·LinkedIn 메타데이터)에서. **공개 문서가 침묵하는 지점은 "(공개 출처 미확인)" 으로 명시** — 추정으로 채우지 않는다.

**본 deep-dive 가 새로 밝히는 5가지 핵심 사실:**
1. 운영사 = **Njord Analytics GmbH, Berlin, 대표 Jonas Witt, 2인 추정** (정확한 헤드카운트 공개 출처 미확인).
2. **WingFoil 이 Njord 의 정식 boat class** 로 존재 — €2.99/일 Analytics 가격 책정 (ILCA 7 €12.99/일의 23%). 단 윙포일 특화 분석 분기는 없음.
3. TracTrac 연동의 운영 모델 = **자동 API 가 아니라 이벤트별 `tractrac@sailnjord.com` 수동 권한 부여 → KML import**.
4. 풍향 추론에서 **여러 보트 데이터 결합 시 정확도 향상** → 알고리즘이 closed-form 이등분이 아닌 **제약 최적화(constrained optimization)** 임이 강하게 시사됨.
5. 회전 손실 **2가지 계산방식의 수식 자체는 공개 문서에 없음** — "Click the 'i' symbol near the maneuver loss values to learn more about how those are calculated" 라고만 가이드. 인앱 툴팁에만 있음.

#### §1. 풍향 재구성 알고리즘 — 수학적 깊이

**Njord 가 공개적으로 밝히는 6가지 사실.**

1. 입력은 **maneuver angles** + **upwind/downwind target angles** 두 가지. ([Njord Analytics 제품 페이지](https://www.sailnjord.com/analytics/) "Njord can reconstruct true wind direction from maneuver angles and upwind/downwind target angles.")

2. 잘 작동하는 조건: "clean straight upwind/downwind sailing, clear tacks and gybes, consistent wind direction, and **good boatspeed data (paddlewheel preferred over GPS SOG)**" ([Adding Wind Data](https://app.sailnjord.com/help/analytics/adding-wind-data.html)). **paddlewheel 선호는 boatspeed 가 알고리즘에 직접 들어간다는 강한 단서** — 단순 헤딩 이등분이 아니라 boatspeed 가중치가 있는 추정.

3. **여러 보트 데이터 결합 가능**: "With multiple boats: TWD inference is more reliable when several boats' data are loaded into the same event — the algorithm uses combined maneuver geometry across all boats to **better constrain the solution**." "Better constrain the solution" 은 **제약 최적화(constrained optimization)** 의 어휘. 한 보트의 회전 기하만으로는 under-determined 일 수 있고, 여러 보트의 회전을 동시에 풀면 풍향이 over-determined 가 되어 최소제곱식으로 풀린다는 추론이 자연스럽다. 단 수식 자체는 공개 출처 미확인.

4. **초기 시드(seed) 입력 가능**: "Enter an initial TWD seed value such as the bearing of the first start line." → 추정이 **비볼록(non-convex)** 이고 국지 최적해(예: 풍축은 정해졌으나 180° 반대로 푼 경우) 존재 → **반복 최적화(iterative)** 임이 시사.

5. **시간범위 분할** 권장 — 풍 시프트 있는 날엔 "re-run inference separately for each segment". 한 호출당 출력은 **상수 TWD 1개**, 시간가변 TWD 는 "Interpolated over Time" 별도 모드에서만.

6. **마크가 정의된 코스가 있으면 leg 경계가 mark rounding 으로 풀린다** — TWA 기반 leg 분할의 견고성 보강책. 윙포일·freeride 에는 mark 가 없어 해당 없음.

**"typical TWA" 의 의미가 어디서 오는가.** boat **Settings → Filters** 의 `Upwind TWA Range` / `Downwind TWA Range` 다 — 기본값 풍상 30–60°, 풍하 120–170° ([Maneuvers](https://app.sailnjord.com/help/analytics/maneuvers.html)). 즉 "typical TWA" 는 **클래스 폴라 DB 에서 자동 끌어오는 것이 아니라, 보트별 Settings 의 사용자 설정값**. 풍상 30–60°·풍하 120–170° 의 wedge 중심을 풍축 후보로 쓰면 풍축의 부호 모호성이 해소된다.

**솔직한 진술.** Njord 는 폐쇄형 SaaS, GmbH 다. **알고리즘의 수식 자체(목적함수, 잔차 정의, 최적화 방식, 초기화 전략) 는 공개 출처 미확인.** 진술들을 종합하면 `이등분선들을 관측치로 한 가중 최적화 + boat speed 잔차 추가 + seed 의 영향을 받는 반복 해법` 으로 *추정*되지만, 이는 우리의 정황 추론이고 Njord 의 공식 진술이 아니다.

**SailTechCo 함의 — 1인 윙포일에 적용 시.** Njord 가 **multiple-boat geometry 결합으로 정확도를 올린다는 점은 1인 윙포일에 적용 불가**. 그 측면에서 Njord 의 우위는 솔로 라이더 시나리오에서는 자동 사라진다. SailTechCo 입장에선 단일 데이터 한 벌 안에서의 신호(회전기하 + no-go + 외부 풍향)를 잘 결합하는 것이 본질.

#### §2. 외부 날씨 데이터 통합 (Weather provider 미공개)

**확인된 사실.**
- "Wind Direction Source" 4 옵션 중 하나가 **"Weather Data"**.
- "Wind Speed Source" 권장 옵션도 측정값 없을 때 "Weather Data" ([Adding Wind Data](https://app.sailnjord.com/help/analytics/adding-wind-data.html) Step 6).
- 코치 보트·고정 기상관측소 wind 파일도 함께 업로드 가능.
- [Data Sources](https://www.sailnjord.com/data-sources/) 의 "Log Files" 에 Gill MaxiMet, Calypso, Easywind, OpenWind, Anemomind 형식 — 사용자가 로컬 weather station 데이터를 *파일로 업로드*하는 경로, 클라우드 API 아님.

**가장 중요한 솔직한 진술.** **Njord 가 "Weather Data" 옵션의 백엔드에서 어떤 weather API 프로바이더를 쓰는지는 공개 문서·도움말·블로그·LinkedIn 어디에도 명시되어 있지 않다 — 공개 출처 미확인.** OpenWeather One Call History/Time Machine, meteoblue, MET Norway, ECMWF reanalysis 등은 모두 후보이지만 *Njord 의 선택을 단정할 근거는 없다*. 기존 audit §부록 의 주의문은 본 deep-dive 에서도 **그대로 유지**.

**spatio-temporal 그라뉼래리티 — 공개 출처 미확인.** Step 7 의 "wait for the orange Preview line to load" 는 *시간축으로 풍향이 따라간다*는 점만 알려준다. 공간 해상도·시간 해상도는 공개되지 않음.

**API 키.** 사용자가 API 키 별도 입력 가이드 없음 → **Njord 가 서버 사이드에서 자기 키로 호출하고 결과만 사용자에게 보여주는 구조로 추정** (확정 출처 미확인).

**Inferred from typical TWA 실패 시 폴백 — 공식 진술**: "Try 'Weather Data' or a manually entered constant TWD. Defining a full race course (all marks) also helps." 윙포일·freeride 엔 (c) 가 해당 없으므로 실질 폴백은 (a) Weather Data 자동 로딩 + (b) 수동 상수 TWD.

**SailTechCo 함의.** Njord 의 weather provider 미공개라는 사실 자체가 신호 — 상용 marine weather (PredictWind, meteoblue Marine, Stormglass) 를 쓰면서 정확도를 차별화 포인트로 숨기거나, 여러 provider 를 라우팅하며 단일 노출이 의미 없거나. 어느 쪽이든 SailTechCo Phase 1 의 단순 OpenWeather Time Machine 으로는 Njord 의 매끄러움에 못 미칠 가능성 있다. **다만 윙포일 freeride 1인 시장에서는 "있다 vs 없다" 의 차이가 더 크므로, 무료 등급으로도 95% 가치를 잡을 수 있다** — 기존 audit §5.3(B) 판단 유지.

#### §3. 폴라 / target 곡선 학습 메서드

**Polar 입력 경로.** [Data Sources — Polar Files](https://www.sailnjord.com/data-sources/) 에 7가지 폴라 파일 포맷: Adrena pol, B&G csv, CSV, Deckman d, Expedition txt, **ORC csv**, SailGrib csv/pol. 즉 1차 소스는 **외부 폴라 파일** 또는 **ORC 클래스 폴라 DB**.

**Polar from Data — 명시적 사실** ([Polar Diagram visualization](https://app.sailnjord.com/help/analytics/visualizations/polar-diagram.html)):
1. **TWS 버킷 단위 binning** (사용자가 표시할 TWS 버킷 선택).
2. **TWA × TWS 두 축 grouping** (radial 다이어그램 표준).
3. **Smoothing 파라미터** 사용자 조절 가능 — 표본 적을 때 곡선이 들쭉날쭉하면 smoothing 올리기.
4. **target boat speed = 각 TWS 라인에서 best VMG 가 되는 두 점** — *별도 fitted 곡선이 아니라 polar curve 자체에서 도출되는 두 anchor*.

**미공개 부분 (공개 출처 미확인):**
- bin 폭(TWA 7.5°? 5°? 가변?)
- aggregation 통계가 mean / p95 / p99 / max envelope 중 어느 것인지
- "Smoothing" 의 구체적 방법(Gaussian? LOESS? spline?)

**"% of target" 계산 — 미공개**. 합리적 추정은:
- 각 sample 의 `(BoatSpeed_observed) / (Polar 의 TWS·TWA lookup target) × 100`
- 통계 패널의 Avg "% of target" 은 그 비율의 산술평균
- Min/Max 는 raw 또는 5%/95%

이는 업계 표준 관행이지 Njord 의 공식 진술이 아니다 — *"Njord 가 이렇게 한다"고 인용은 못 함*.

**SailTechCo 함의 (윙포일 1인).** ORC DB 는 윙포일에 0의 가치 — ORC 가 윙포일 클래스 폴라를 발행하지 않음. 따라서 SailTechCo 의 폴라는 **개인 누적 세션 = personal polar** 외엔 출처가 없다. Njord 의 **"Smoothing" 슬라이더**와 **"Two anchor points per TWS line"** 의 UI 패턴은 그대로 학습 가치 있음.

#### §4. 회전 손실 측정 — COG vs heading (가장 중요한 axis)

**Njord 의 명시적 진술 (이 axis 의 핵심).**

[Maneuvers — User Guide](https://app.sailnjord.com/help/analytics/maneuvers.html) "Maneuver Analysis" 직접 인용:

> "The maneuver analysis table shows various relevant metrics as averaged before and after the maneuver, as well **two different maneuver loss calculation approaches**. Click the **'i' symbol near the maneuver loss values to learn more about how those are calculated**."

→ **수식은 인앱 툴팁에만 존재, 공개 페이지 어디에도 본문으로 적혀 있지 않다.** 이 단일 문장이 우리가 *공개적으로* 알 수 있는 한계.

**확인되는 시간 윈도 — 공식 수치:**
- **`Average Time Before Maneuvers` = 20초**, **`Average Time After Maneuvers` = 20초** (기본값, 보트별 변경은 Njord 측 사람의 손이 닿아야 함).
- **`Exclude Time Before / After Maneuvers`** — Settings → Filters 에서 사용자 조정.
- 구조: `[Average Before window] → [Exclude Before zero] → [maneuver = TWA hits 0/180/90] → [Exclude After zero] → [Average After window]`.

**Back-to-back 회전 처리 — 공식 진술** ([FAQ](https://app.sailnjord.com/help/analytics/faq.html) "Why are maneuvers detected but not analysed?"):
> "Too close to another maneuver. Analysis requires (Average Time Before + Exclude Time Before) seconds of clean sailing before the maneuver, and likewise after. **Back-to-back maneuvers within ~30–40 seconds will often be skipped.**"

→ **결정적**. 윙포일·foiling dinghy 처럼 회전 간격이 짧은 종목에서 Njord 의 default 윈도는 회전을 "분석 불가" 상태로 떨군다. 기존 audit §4.1 의 우리 `turnStableWin = 4초` 가 "갭이 아니라 설계 차이"라는 판단을 본 deep-dive 가 **강하게 재확인**. **SailTechCo 의 4초 윈도 = 윙포일 종목에 맞게 의도된 차별화**.

**COG vs Heading.** 공개 문서는 "두 방식 있다" 만 명시. **그러나 FAQ 두 곳의 단서로 강한 추론 가능:**

(a) **Heading 손상 시 처방** (FAQ "My heading data looks wrong"):
> "Drop Heading and use COG instead: Go to the uploaded data segment → *Process* → *Drop Metrics* → select Heading → Add a *Derived Metrics* step — Njord will recalculate TWA from TWD and COG"
> "For Vakaros specifically: if the device is mounted more than ~10° off the centreline, Njord will reject the Heading channel automatically … and fall back to COG."

(b) **VMG gain vs Average VMG 의 두 방식** (FAQ):
> "'VMG gain' is calculated from the **start & end position**, using the TWD (average TWD, from both boats) as the reference bearing. 'Average VMG' that you see in the table above is taking each boat's TWA & Boatspeed, **calculating the instantaneous VMG along the track**, and averaging that."

→ **Njord 의 일반 패턴**:
- **방식 A — 위치 기반 (displacement)**: 분석 윈도의 시작 위치와 끝 위치를 GPS 로 잡고, TWD 를 reference 로 VMG 방향에 투영 → m 단위 거리 손실. **본질적으로 COG/GPS 기반**(헤딩 불필요).
- **방식 B — 적분 기반 (instantaneous VMG)**: 각 sample 에서 TWA·BoatSpeed 로 순간 VMG 를 시간평균. **본질적으로 Heading + Wind instrument 기반**(TWA 정확도 의존).

**솔직히** — 이는 우리의 강한 추론이고, Njord 의 공식 명명이 정확히 매핑된다는 공개 진술은 발견 못함.

**기존 audit §4.1 의 우리 코드 진단 ("vmgLossPct = 진입↔탈출 GPS 변위를 골 방향에 투영")** 은 **Njord 방식 A 와 같은 계열의 displacement 기반**. 빠진 것은 방식 B — 정확한 TWA 시계열 요구. 풍향 자동추정 '낮음' 세션에서는 어차피 의미 없는 보강 → 우선순위 낮음.

**SailTechCo 함의:**
- "두 방식 + i 툴팁" UX 는 옥코치의 권위적 멘트를 보완하는 수치 정직성 장치. Phase 2+ 에서 옥코치 멘트 옆 dual 출력 검토.
- 4초 윈도 안의 displacement 는 GPS 노이즈에 취약, 4초 안의 instantaneous-VMG 적분은 표본 4개에 불과해 의미 약함. **Phase 1 에서는 방식 A 단일 유지 권장.**

#### §5. 퍼포먼스 통계 카드 — 정확한 계산 방식

**확인된 사실.** 기존 audit §3.2 의 Avg/Min/Max 패널 구조 정확. 본 deep-dive 추가:
- **자동 갱신**: "Highlight a section of the track and see statistics for just that segment. **The analysis follows your question.**" — 동적 패널.
- **컬럼 customization**: What's New 의 "Adds a filter option to the Table view type".
- **"Add user settings to configure fractional digits and units per metric"** (What's New) — 단위(노트/km/h, m/boat lengths) 와 소수점 사용자별 설정. **두 사용자가 같은 데이터를 봐도 표시 숫자가 다를 수 있다.**

**미공개 (공개 출처 미확인):**
- Min/Max 가 raw 인지 trimmed 인지, outlier 제거 방식.
- "% of target" 컬럼이 세그먼트 평균 % 인지 vs 세그먼트 평균 TWS 에서의 % 인지.

**SailTechCo 권장:**
- `Avg` 그대로.
- **`Min`·`Max` 대신 우리의 top50/top20 유지·병기** (기존 audit 가 정확히 언급한 GPS 노이즈 회피). Njord 의 raw min/max 를 맹목 추종하지 말 것.
- **단위·소수점 사용자 설정** 차용.
- **"% of target" 컬럼은 개인 누적 폴라 생기기 전까지 비활성 placeholder**. 거짓 % 보다 빈 칸이 정직.

#### §6. Njord Player 텔레메트리 리플레이 — 시각 언어

**(A) 멀티 윈도 동기 재생** ([Njord Player 페이지](https://www.sailnjord.com/player/)):
- "Run any number of windows across any number of screens — all playing in perfect sync."
- "Every window stays locked to the same playback position. **Scrub in one and everything follows.**"
- 윈도 종류: video · charts · map · photos — 각 resizable, 무제한.

→ 핵심 UX 원칙: **단일 시간 마스터**. 우리 대시보드의 hover 커서 동기화 인프라가 이미 같은 철학.

**(B) Live Strip Charts — 기본 채널:**
- "boatspeed, wind angle, VMG, and more" — default 채널 **BoatSpeed · TWA · VMG**.

**(C) Race-aware Timeline — 색 코딩:**
- Upwind/downwind legs **colour-coded**.
- Tacks/gybes **marked**.
- Races/legs **labelled**.
- On-water comments → **markers**.
- Media availability **overlaid on the same timeline**.

→ 시각 어휘 4종 + 미디어 가용 구간 오버레이. 윙포일 freeride 에서 race/leg 라벨은 무관하지만 **leg 색 + maneuver 마커 + 코멘트 마커는 그대로 유효**.

**(D) GoPro / 드론 통합 — 동기 메서드** ([Loading Media](https://app.sailnjord.com/help/player/loading-media.html) 매우 자세):

**타임스탬프 우선순위 (자동):**
1. **GoPro GPMF (GPS Time)** — 신형 GoPro GPS 켰을 때 자동. 가장 정확.
2. **QuickTime Time Code (start of video)** — GoPro GPS off 시.
3. 파일명 패턴 `YYYY-MM-DD_hh-mm-ss` 자동 추출.
4. 파일 capture date EXIF.
5. 파일 creation date (fallback).

추가: DJI 드론은 `.SRT 파일을 함께 두면 timestamp offset 정확 매핑`. SailGP 방송 영상은 "TV broadcast start time minus approximately 33 seconds" 마법 상수. 시각 큐: "boom and rudder visible in the video to synchronize with a turn up / tack visible in the boat's track".

**(E) Export 포맷:**
- **Baked-in 데이터 오버레이 비디오** — 메트릭 선택, prestart vs racing 별 다른 오버레이 구성.
- **Batch photo export** — 각 사진의 정확한 timestamp 에 해당하는 데이터 한 클릭으로 일괄 export.

**(F) 코덱·하드웨어**: HEVC/H.265 가속 GTX950+/RX460+/HD4400+/M1+. 데스크톱 native(Win/Mac) + Web Player (iPad/Android 태블릿 포함). 현 버전 v2.6.6, 2025-11-01 릴리스.

**SailTechCo 함의.**
- 영상 통합 시 **timestamp 위계 5단계는 그대로 카피 가치 있는 best practice**.
- **데스크톱 native + Web Player 분리는 SailTechCo 가 따라가지 말아야 할 길** — 1인 개발에서 두 코드베이스 유지 불가. **Web 단일**로 가되 multi-monitor 는 "여러 브라우저 창" 으로 대체.
- 재생 컨트롤 + timeline 어휘는 기존 hover sync 위에 비교적 가볍게 올라간다.

#### §7. 가격·구독·사용자 base·운영 (TracTrac 연동)

**운영사 — 확인 완료** ([Imprint](https://www.sailnjord.com/imprint/) 직접 인용):

> Njord Analytics GmbH
> Urbanstraße 71, 10967 Berlin, Germany
> Handelsregister: Amtsgericht Charlottenburg, HRB 201352 B
> Managing Director: **Jonas Witt**

**헤드카운트 (RocketReach/LinkedIn 메타데이터 종합):**
- Jonas Witt — Founder & CEO, Berlin. 전 Valsight GmbH·metaquark GmbH 공동창업자. Hasso Plattner Institut B.Sc. Engineering (2006-2009).
- Douglas Edwards — Intermediate Frontend Developer.
- **RocketReach 추정 employee count = 2**.

⚠ **출처 신뢰도** — 크롤링 메타는 LinkedIn-public 만 보이므로 freelance 누락. **정확한 헤드카운트 공개 출처 미확인**. 그러나 **"Njord = 십수명 스타트업이 아니라 사실상 1인 founder + 보조 개발의 마이크로 팀"** 결론은 충분히 도출 가능.

→ Danny 의 "1인 개발이 이걸 따라잡을 수 있나" 에 대한 가드레일: **Njord 자체가 본질적으로 1인+α 의 작품**. 차이는 (a) 8년+ 누적 시간, (b) 레이싱 세일러 네트워크 인사이드 채널, (c) GmbH 라는 기업 체계.

**가격 — 정확한 수치 확보** ([WingFoil Pricing](https://www.sailnjord.com/pricing/wingfoil/) fetch 2026-05-27):

| 제품 | WingFoil | ILCA 7 (Laser) 비교 |
|---|---|---|
| Njord Player | **€4.99/일** | €9.99/일 |
| Njord Analytics | **€2.99/일** | €12.99/일 |
| Bundle | **€5.99/일** | €17.99/일 |

→ **클래스별 가격 차별화 강함** — 윙포일은 ILCA 7 의 **23% 수준**으로 세팅. 윙포일은 가격민감성 인정 + 기능 일부 제외 (4G live data 등).

**무료 등급·트라이얼:**
- **30 day free trial** (모든 클래스 공통).
- **"180일 이상 오래된 데이터 로드는 영구 무료"** — *추억 가공 use case 영구 무료*. SailTechCo 가 *못 따라가도 되는* 영리한 가격 메시지.

**"sailing day" 정의** (FAQ): "logging date 단위, 같은 날 두 번 나가도 1일. 오프쇼어 멀티데이는 dock-out 1일만 카운트."

**할인/팀:**
- 팀 시트 무제한 — **계정 수가 아니라 보트 수가 과금 단위**. 1인 윙포일에 불리하지 않음.
- "Fleet pricing applies automatically when you select more than one boat."
- "Switch between pay-per-day, monthly, and yearly billing at any time."

**CO₂**: "2.5% of purchases to removing CO₂. [Stripe Climate](https://climate.stripe.com/76ovRv)".

**사용자 base — 솔직한 진술.**
- Njord 가 자기 사용자 수를 **수치로 공개한 곳은 발견되지 않음 — 공개 출처 미확인**.
- Cyclops Marine 파트너 페이지의 정성 진술: "customers that are professionals from America's Cup teams and Olympic coaches, down to competitive weekend racers".
- ⚠ **"수백" 이나 "수천" 같은 어떤 숫자도 본 deep-dive 는 단언하지 않음**. SailTechCo 시장 분석에서는 "Njord 는 작은 회사, 윙포일 freeride 시장 점유는 사실상 0" 의 정성 결론에서 멈춤이 정직.

**TracTrac 통합 — 운영 모델 확인** ([TracTrac Data Source](https://www.sailnjord.com/data-sources/tractrac/) 직접 인용):

> "To make tracking data from a sailing event recorded on the TracTrac tracking platform available in Njord Analytics, you typically require approval from the event organizers, and you need to request permission for Njord Analytics to the TracTrac API on your behalf. Please contact one of the following, ideally **a few days ahead of the event**:
> - The organizer of your sailing event
> - The person responsible for managing TracTrac trackers/tracking at the event
>
> To ensure that data can be accessed by Njord Analytics, please ask your contact to apply the following configuration on the management page of the event:
> - *KML Download* needs to be enabled for the TracTrac event in question
> - Permission needs to be granted to the **`tractrac@sailnjord.com`** user for the TracTrac event in question"

핵심 사실:
1. **연동 방향**: TracTrac → Njord (단방향 import). Njord 가 푸시하지 않음.
2. **자동 API 호출이 아닌 권한 기반 KML 다운로드** — Njord 측 단일 사용자 계정이 grant 받음.
3. **이벤트 단위 그랜팅** — 매 이벤트 따로.
4. **타이밍**: "ideally a few days ahead of the event" — *사전 설정*.
5. **수동 트리거**: "contact us referencing the event ID to have races imported".

→ TracTrac 연동은 **API 통합이 아닌 운영 워크플로** — Njord 가 자동화하지 않은(못 한) 영역. 다른 tracking 플랫폼(eStela, GeoRacing, Metasail, Virtual Eye) 도 같은 카테고리로 묶여 비슷한 운영 모델 추정.

**Njord 가 TracTrac 으로 데이터를 보내는가** — 발견되지 않음. import-only 임이 강하게 시사됨.

**Njord WingFoil 클래스 존재의 의미.** 기존 audit §2 의 "Njord 타깃 = 레이싱 세일러" 결론은 본질에서 유효. 그러나 **Njord 의 boat class 카탈로그에 "WingFoil" 정식 존재** (€2.99/일 가격)는:
1. 100% 무주공산은 아니다 — Njord 도 윙포일러를 *형식적*으로 받음.
2. 그러나 가격 23%, 4G live data 빠짐, race/leg/mark 모델 그대로 — *기능적 맞춤은 사실상 없음*. **WingFoil 클래스 = Njord 일반 분석 엔진을 윙포일 라이더가 그냥 쓰는 옵션** 일 뿐.
3. SailTechCo 차별화 ("윙포일 freeride 1인 라이더 특화") 여전히 유효 — **"있느냐 vs 없느냐"가 아니라 "윙포일에 맞춰 설계되었느냐 vs 요트 SW 를 그대로 쓰느냐"**.

#### §8. SailTechCo 의 함의 — 학습할 것 / 차별화할 것

**(1) 학습할 것 — 본 deep-dive 가 새로 밀어 올린 패턴:**
- **timestamp 우선순위 위계 5단계** (§6): 영상 통합 시 GoPro GPMF → QuickTime → 파일명 → EXIF → creation date 그대로 카피.
- **"두 가지 계산방식 + i 툴팁"** (§4): displacement vs instantaneous-VMG dual 출력 패턴 — 옥코치 권위 보완 수치 정직성 장치.
- **단위·소수점 사용자 설정** (§5): 노트/km/h 토글, 윙포일러 기본 요구.
- **180일 이상 무료** (§7): 향후 유료화 시 *과거 데이터 영구 무료* 메시지.
- **Polar Editor 의 Smoothing 슬라이더** (§3): 표본 적을 때 사용자 통제 하 부드럽게 만드는 UX.

**(2) 차별화할 것:**
- **윙포일 특화 분기** (§7 신규 사실): Njord WingFoil 클래스는 분석 엔진을 그대로 쓰는 것 일 뿐. 옥코치 R1~R9 + VPS + What-if 는 윙포일 도메인 특화 — 해자가 *깊다*.
- **back-to-back 회전 처리** (§4): Njord default 윈도가 ~30-40초 미만 회전을 skip. 윙포일 세션 다반사. **우리 4초 윈도 = 의도된 윙포일 적합 설계**.
- **추정 신뢰도 표기**: 우리는 자동 텍스트, Njord 는 Preview 라인 육안 검증.
- **단일 라이더 강건성** (§1): Njord multi-boat 결합은 1인 윙포일에 적용 불가 — Njord 의 솔로 시나리오에서는 SailTechCo 의 3중 결합(외부 날씨 + 회전기하 + no-go) 이 *더 강건* 가능.
- **자연어 코칭** + **VPS What-if**: 도메인 전문성 해자.

**(3) 정직한 결론.**

Njord = 2인 GmbH 가 8년 누적한 racing 요트·딩기 시장의 사실상 표준 SW. 윙포일은 부산물 클래스이고 특화는 없다. SailTechCo 는 **Njord 의 분석 방법론** 을 학습하되 **Njord 의 경기 데이터 모델(event/race/leg/mark/fleet)** 은 취하지 않으며, **윙포일 도메인 특화** 해자를 깊게 판다.

가장 큰 신호 — **Njord 알고리즘의 수식 자체가 공개 문서에 거의 없다**(§1·§4). 이는 Njord 가치가 알고리즘이 아니라 *시장 신뢰 + 운영 + UX + 누적 데이터셋* 에 있다는 뜻. **SailTechCo 가 따라잡을 수 없는 것은 알고리즘이 아니라 시장 신뢰·운영이고, 이는 1인 윙포일 시장에서는 처음부터 다시 짜는 게임이다. 그 점이 SailTechCo 의 기회.**

**부록 — 본 deep-dive 의 추가 출처:**
- [WingFoil Pricing](https://www.sailnjord.com/pricing/wingfoil/) · [ILCA 7 Pricing](https://www.sailnjord.com/pricing/ilca-7-laser/) · [Pricing 메인](https://www.sailnjord.com/pricing/)
- [Imprint](https://www.sailnjord.com/imprint/) — Njord Analytics GmbH, Berlin, Jonas Witt
- [Maneuvers](https://app.sailnjord.com/help/analytics/maneuvers.html) · [Polar Diagram](https://app.sailnjord.com/help/analytics/visualizations/polar-diagram.html) · [Adding Wind Data](https://app.sailnjord.com/help/analytics/adding-wind-data.html)
- [TracTrac Tracking Data](https://www.sailnjord.com/data-sources/tractrac/) · [Data Sources 카탈로그](https://www.sailnjord.com/data-sources/)
- [Njord Player](https://www.sailnjord.com/player/) · [Loading Media](https://app.sailnjord.com/help/player/loading-media.html)
- [What's New](https://app.sailnjord.com/help/analytics/whats-new.html) · [FAQ](https://app.sailnjord.com/help/analytics/faq.html) · [Aggregate Analysis](https://app.sailnjord.com/help/analytics/aggregate.html)

---

#### B9. ChartedSails (Danny 추가 — Tier-1 심층)

**(1) 포지셔닝·가격·타깃** — [chartedsails.com](https://www.chartedsails.com/) — "Easy to use sailing analytics". GPX/FIT/VTK/VKX 등 GPS 트랙을 races·legs·maneuvers·straight lines 로 자동 분해해주는 세일링 디브리프 툴. **RaceQs 후계자 포지션 명시** ([/raceqs](https://www.chartedsails.com/raceqs)). Solo founder **Thomas Sarlandie** (San Mateo, CA — Memfault Head of Product 본업, 전 Fitbit Director / Pebble Director / Backelite 공동창업). ChartedSails LLC 2020-01-29 설립.

**(2) 기능** — Auto race/leg/maneuver 검출, VMG·TWA·SOG·heel·pitch, **멀티-보트 fleet replay** (그룹 내 보트들을 동일 timeline 자동 정렬), GoPro/iPhone 비디오 동기화, 마크 ping, 레이스 타이머, **Sailing Report PDF**, AI 데이터 탐색(11장 코스), Live Coaching.

**(3) 알고리즘** — Track shape-based **자동 wind detection** (iOS 1.4.0 changelog 2025-05), 자동 maneuver detection, polar 비교(클래스별 designer polar 로딩 사례: Melges IC37 — "we are a little low and fast wth 7.2 knots of boat speed... 5.3 knots of VMG... 6.8 knots at 100% VMG"). 풍향 입력 3-way: (a) **ChartedSails automatically fetches weather data for your session location**, (b) Calypso 등 인스트루먼트, (c) **수동 회전 컴퍼스** ("rotate the map until the wind is coming from the top"). 알고리즘 내부 미공개 — GPX/FIT/CSV (SOG+COG only) 도 fully 지원하므로 **COG 미분 + SOG threshold 기반** (공개 출처 미확인, 추정). 마뉴버 분석은 **entry 10초 평균** ([learn-from-sailing-data-good-and-bad-tacks](https://www.chartedsails.com/blog/learn-from-sailing-data-good-and-bad-tacks)).

**(4) UX/UI** — 좌측 Instrument 패널 + 우측 맵 + 하단 Speed/VMG 그래프 + 상단 타임라인 + **회전 가능한 wind compass**. Tail selector (10min / Full / Speed heatmap), 드래그-선택 zoom, Quick Measurement. Web + iOS 동기화, **Android 는 beta 대기**.

**(5) 데이터 source** — **GPX, CSV, TCX, FIT, NMEA + VTK + VKX + Sailmon + Sailteck + Racebox** ([capturing-data](https://www.chartedsails.com/sailing-data-course/capturing-data)). **Garmin Connect OAuth 자동 sync** — activity 이름에 "sail/kite/foil/wing" 키워드 필터로 윙포일 1급 시민 수용. **Strava 연동 없음**.

**(6) 출력·공유** — 인터랙티브 web replay, iOS 모바일 앱 replay, **PDF Sailing Report** (start lineup 이미지 + leg-by-leg 테이블, "downloadable PDF you can share with your crew in one tap"), 비디오 동기화 export, 그룹 공유 (코드 기반 클로즈드).

**(7) 가격 모델** — **Freemium 4-tier**. Free ($0, 무제한 녹화·GPS trace·fleet replay) → **Racer Pro $349/yr** → Team $599/yr (6보트) → Club $999/yr (12보트) → Fleet $1,799/yr (30보트). 모바일 IAP HUF 149,990/yr ≈ €380. ([Pricing](https://www.chartedsails.com/pricing))

**(8) 강점/약점** — 강점: **Free tier 가 매우 강력** (replay/grouping/GPS trace 모두 무료), 6년차 production, 매월 업데이트, web+iOS 통합, Garmin OAuth, RaceQs 후계 흡수 중. **약점**: solo founder + Memfault 본업 → **bus factor 1 리스크**, **한국어 100% 미지원**, **Android 미출시**, **퍼블릭 리더보드 없음** (그룹 코드 클로즈드만).

**(9) 사용자 리뷰** — Sailing Anarchy 인용: "ChartedSails is also pretty slick for post-race analysis from GPX files." (The_Cunning_Ham 2025-11); "Right now I'm using ChartedSails for these kinds of analytics. Auto upload from my Garmin watch." (martin 'hoff 2025-11). 챔피언 ambassadors: Grant "Fuzz" Spanhake (J/70 코치), Leandro Spina (America One Racing 디렉터). 사용 사례: America One Racing, Waszp fleets in Hawaii, coaching programs in Florida/Lanzarote. iOS App Store "not received enough ratings" (소량 다운로드 시그널).

**(10) 장기 viability** — Crunchbase 펀딩 미공개, **self-funded/bootstrapped lifestyle business**. 2020 LLC, 6년차, 매월 changelog. **bus factor 1** (Thomas 1인 + Memfault 본업).

**한국 시장 가용성 — 솔직한 진술.** 언어 **English only** (App Store Languages 단일). 한국어 hreflang 없음. 한국에서 로딩 정상. **네이버 카페·클리앙·인스타에서 "chartedsails / 차티드세일즈" 한국어 멘션 발견 못함** — 한국 윙포일/딩기 racing 커뮤니티 인지도 사실상 **제로**.

**SailTechCo 함의:**
- **학습**: "Free to record. Pay for insights." 메시징 명료성 / 그룹 코드 클로즈드 공유 모델(한국 카톡 친화) / Sailing Report PDF 공유 마찰 0 / Garmin 키워드 필터(sail/kite/foil/wing) / 풍향 input 3-way / "매월 changelog + solo founder 응대" 모델.
- **차별화**: **한국어 UI 100%** (ChartedSails 영어-only) / **윙포일 specific 메트릭** (ChartedSails 는 dinghy/keelboat racing 메타포 중심) / **카카오 로그인 + 원화 결제** / **한국 윙포일 spot 풍향 fetch + Spot 커뮤니티** / **Strava 연동** (ChartedSails 미지원) / **퍼블릭 leaderboard 옵셔널** / **AI 디브리프 한국어 코칭 톤** / **bus factor 1 회피** (founder + 1 시니어 백엔드 구조).

#### B3. TackTracker

**(1) 포지셔닝·가격·타깃** — 호주 멜버른 소재 [TackTracker](https://tacktracker.com/web/) (2008년 창업, 창업자 Geoff Smith). 타깃은 클럽·플릿·세일링 스쿨·코치·레가타 주최자. 2009 Etchells Worlds 사용을 계기로 명성 확보.

**(2) 기능** — Live Tracking(모바일 네트워크로 수초마다 전송), Logged Tracking(저비용 GPS 로거, 권장 로거 QStarz BL-1000ST), Dynamic VMG Meter, leg-by-leg 분석, race 리포트, 라이브/리플레이 뷰. PC Player.

**(3) 알고리즘** — VMG meter 는 동적 계산되나 폴라·타깃 산출 방식·풍향 재구성 알고리즘 (공개 출처 미확인). 회전 자동검출 여부도 공개 문서에 명시되지 않음.

**(4) UX·UI** — 데스크톱 PC Player가 중심(레이스 뷰), 웹 [TackTracker Cloud](https://tacktracker.com/cloud/) 에서 race replay·라이브 뷰. UI는 yacht race tracking 클래식 — 코스 위 보트 마커 + 사이드바 리더보드.

**(5) 데이터 source** — 전용 GPS 로거 하드웨어(rugged, waterproof, 긴 배터리) + 모바일 폰 트래커. 외부 계측기 import (Velocitek ProStart 가이드 존재).

**(6) 출력·공유** — TackTracker Cloud 에서 race replay 무료 시청 ([Latest Races](https://tacktracker.com/cloud/home/public/races) 공개 리스트).

**(7) 가격 모델** — 하드웨어 구매 + 소프트웨어. "license + GPS logger 구매 후 ongoing cost 없음". 정확한 단가는 RFQ 기반 — 공개 가격표 (공개 출처 미확인). Cloud 시청은 무료.

**(8) 강점·약점** — 강점: 전용 하드웨어 + 클럽 인프라 통합, 15+년 역사, 무료 클라우드 시청. 약점: UI가 dated, 가격 비공개(B2B 모델), 1인 분석 깊이는 Njord/Vantage 보다 얕음 (공개 알고리즘 정보 부재).

**(9) 사용자 리뷰** — App Store/Play Store 별점 (공개 출처 미확인). [Sailing Anarchy 토론](https://forums.sailinganarchy.com/threads/gps-race-tracker.96633/) 에서 GPS race tracker 일반 논의 시 언급.

**(10) 장기 viability** — 2008년부터 단일 개발자 Geoff Smith 주도. 호주·세계 클럽들이 지속 사용 중. 활발한 업데이트 빈도는 (공개 출처 미확인).

#### B4. RaceQs / Kattack

**(1) 포지셔닝·가격·타깃** — [RaceQs](https://raceqs.com/)는 무료 폰 기반 3D race replay 앱, 클럽 세일러·취미 racer 타깃. [Kattack](https://wp.kattack.com/)은 yacht club·플릿·세일링 스쿨·대학팀·레가타용 GPS 트래킹/리플레이.

**(2) 기능** — RaceQs: 매초 GPS 트래킹, 자동 wind detection, 6개 게이지(VMG/COG/SOG/Drift/Compass/Heel), boat handling 분석, fleet 코스 오버레이 ([Race Analytics](https://raceqs.com/race-analytics/)). 폰 부착 시 pitch/yaw/heel 옵션 기록. Kattack Mobile은 폰으로 트래킹 + 셀 커버 없어도 저장 후 업로드.

**(3) 알고리즘** — RaceQs 는 "automatic wind detection algorithm + boat handling analysis"를 차별점으로 표기 ([홈](https://raceqs.com/)) — 정확한 풍향 재구성 수식은 (공개 출처 미확인). Kattack의 분석 알고리즘 상세 (공개 출처 미확인).

**(4) UX·UI** — RaceQs: 3D 애니메이션 리플레이(웹), 6개 게이지 대시보드. UI 는 2010년대 초 인터페이스. Kattack: 2D 지도 중심 race replay.

**(5) 데이터 source** — RaceQs: 폰 GPS + 폰 IMU(pitch/yaw/heel 선택). Kattack: 폰 GPS, 외부 GPS 로거. 외부 계측기 import는 두 제품 모두 제한적.

**(6) 출력·공유** — RaceQs: 자동 공개 race replay 링크, **크라우드소싱 트랙(같은 시간·장소 다른 세일러 트랙 액세스)**, crew 커뮤니케이션 통합. Kattack: race replay 동영상 export.

**(7) 가격 모델** — RaceQs: 완전 무료. Kattack: Kattack Mobile은 App Store, 클럽용 GPS 트래커는 [American Regatta](https://www.americanregatta.com/american-regatta-products-kattack-products.html) 등에서 별도 판매.

**(8) 강점·약점** — RaceQs 강점: 무료, 진입장벽 없음, fleet 크라우드소싱. **약점 (치명적): 2025년 초부터 critical decline — 앱 신규 사용자에게 더 이상 제공되지 않으며 regatta playback 배경이 검은 화면**, 수년간 미유지 ([Breakwaters 2026 가이드](https://www.breakwaters.org/1706-2/)). Kattack 약점: App Store 리뷰에 "hands down the worst race tracking software and app ever seen", 자기 보트만 트래킹·줌 제한 등 부정적 평가.

**(9) 사용자 리뷰** — Kattack Mobile App Store 다수 부정 리뷰. RaceQs 는 [내부 포럼](https://raceqs.com/forum/topic/tracking-stops-during-race-puzzled/) 에서 트래킹 중단·UI 버그 등 사용자 호소.

**(10) 장기 viability** — **RaceQs: 사실상 dying product**. Kattack: 20+년 운영하지만 모바일 전환 실패 평가 — viability 낮음~중. **둘 다 적극 추천 대상 아님 — 우리에게는 "교훈" 카드**.

#### B5. iRegatta (iOS)

**(1) 포지셔닝·가격·타깃** — 덴마크 [Zifigo](https://zifigo.com/node/279) 개발. 2010년 이전부터 운영 중인 장수 앱. 타깃은 iPhone·iPad 보유 세일러 — 크루징 내비게이션 + 택티컬 레가타 양쪽. iPhone·iPad·Apple Watch 지원.

**(2) 기능** — 메인 디스플레이에 Heading/Speed/VMG/Performance + lift indicator(풍 시프트) + speed·VMG 그래프, **스타트라인 마킹 후 "burn or gain bar"로 라인 도착 시간 계산**, 카운트다운 + audible alert, layline view(풍향·마크 방위·tack/gybe 각도), WiFi 통한 NMEA0183 계기 입력, WiFi AIS 레이더 뷰, watch app(스타트라인 조작, HealthKit activity 기록).

**(3) 알고리즘** — 풍향 입력: 풍상 starboard/port 헤딩 저장 또는 수동 입력. VMG·layline 계산은 폴라 기반(iPolar 통합). 정확한 polar curve 계산 수식 (공개 출처 미확인).

**(4) UX·UI** — 인스트루먼트 스타일 4-up readout, 스타트라인 burn/gain 바가 시각적 핵심. iPad·iPhone 가로/세로 모두. 다소 dated 한 native iOS UI ([Sail Magazine review](https://sailmagazine.com/gear/apps-for-sailors-iregatta/)).

**(5) 데이터 source** — 폰 내장 GPS, WiFi 통해 NMEA0183 외부 계측기(풍계·속도계·AIS) 입력, Apple Watch IMU.

**(6) 출력·공유** — HealthKit 으로 activity 기록. PDF/공유링크 명시 (공개 출처 미확인).

**(7) 가격 모델** — iRegatta(무료/평가판): 모든 기능 포함하나 4분 후 GPS·NMEA0183 입력 차단. **iRegatta Pro: $19.99 일회구매** ([App Store — Pro](https://apps.apple.com/us/app/iregatta-pro/id334632033)). 구독 아님 — 합리적 가격.

**(8) 강점·약점** — 강점: 저렴한 일회구매, NMEA0183 외부 계기 통합, Apple Watch 지원, 15+년 검증. 약점: dated UI, 1세대 기능 — Njord식 maneuver loss·polar editor·풍향 재구성 다원화 없음. 코칭/분석보다는 실시간 racing 인스트루먼트 성격.

**(9) 사용자 리뷰** — iRegatta Pro: [App Store US](https://apps.apple.com/us/app/iregatta-pro/id334632033) 4.5/5 (6 ratings — 표본 매우 작음). [data.ai 추정](https://www.data.ai/en/apps/ios/app/iregatta-pro/) 은 3.8/5, 10k+ 다운로드.

**(10) 장기 viability** — Zifigo가 iRegatta·iRegatta Pro·iRegatta Watch 라인업 유지 — 활발한 멀티플랫폼 확장. 2010년 이전부터 운영 — 안정적. 단 소형 1인 개발사로 추정.

#### B6. SailRacer

**(1) 포지셔닝·가격·타깃** — 리투아니아 UAB SailRacer 개발. [sailracer.net](https://sailracer.net/) (모바일 앱 + inkDisplay e-paper) 과 [sailracer.org](http://sailracer.org/resultsentry/Article/9434) (이벤트 트래킹 포털) 가 결합된 생태계. 타깃은 스키퍼·택티션·딩기~빅보트 + 클럽 이벤트 주최자.

**(2) 기능** — 택티컬: 현재·바람·layline·polar 기반 perfect start 계산, 회전 결정 제시, 코스 마크 ping 또는 fixed mark 라이브러리, 트랙 리플레이/분석/공유, 마크 위치 클럽 공유. 스펙테이터 모드(웹 라이브 뷰). **Garmin watch + inkDisplay e-paper 디스플레이 미러링**.

**(3) 알고리즘** — 폴라 + 풍향 + 조류 기반 layline·start 계산 — 구체적 수식 (공개 출처 미확인). 풍향 입력: 수동/계기 외 자동 추정 (공개 출처 미확인).

**(4) UX·UI** — 모바일 앱이 메인 계산 엔진, inkDisplay 는 미러. 지도 + 속도·방향 readout + 라인 카운트다운. **e-paper의 햇빛 가독성이 차별점** ([Panbo 리뷰](https://panbo.com/sailors-behold-sailracer-net-has-finally-released-inkdisplay/)).

**(5) 데이터 source** — 폰 GPS, Garmin watch, inkDisplay(외부 디스플레이). NMEA 등 외부 계기 입력 여부 (공개 출처 미확인).

**(6) 출력·공유** — 트랙 리플레이 공유, 이벤트 클럽 결과 ([sailracer.org 이벤트](https://enter.sailracer.org/Main/Tracking)), 스펙테이터 라이브 뷰.

**(7) 가격 모델** — **Optimist·Laser·딩기는 무료**, 킬보트 racer는 **Premium 35 EUR/년** ([sailracer.net](https://sailracer.net/)). inkDisplay 하드웨어 290 EUR. 합리적.

**(8) 강점·약점** — 강점: 합리적 연간 35 EUR, e-paper 햇빛 가독성, 클럽 이벤트 포털 통합, 다중 디바이스(폰+워치+e-paper). 약점: 분석 깊이는 Njord·Vantage 대비 얕음 — maneuver loss·% of target 등 명시 (공개 출처 미확인), 알고리즘 공개도 낮음.

**(9) 사용자 리뷰** — [App Store](https://apps.apple.com/us/app/sail-racer/id473901816), [Google Play](https://play.google.com/store/apps/details?id=sailracer.net) — 정확한 별점·리뷰수 (공개 출처 미확인). Panbo 리뷰에서 inkDisplay 긍정 평가.

**(10) 장기 viability** — UAB SailRacer 운영, sailracer.net/org 이중 인프라 유지, inkDisplay 라는 신규 하드웨어 출시 — 활발한 개발. 중간 규모 안정 viability.

#### B7. ⚠ RegattaPRO / "Sail Now" — 카테고리 정정 권고

**중대 발견: 원안의 B7 항목은 분석 SW 가 아님.** [RegattaPRO](https://regattapro.com/) 는 USSA 인증 Principal Race Officer 인력 파견 서비스(2002년 Jeff Zarwell 설립). 북·중미·캐리비안 yacht club 에 PRO 와 race staff 를 공급. America's Cup World Series 운영 경험. **SW 제품 아님 — 분석 SW 비교 대상이 아님.**

**"Sail Now"** 라는 별도 sailing analytics app 은 App Store 검색에서 정확한 매칭 없음 — **(공개 출처 미확인)**. Danny 측에서 원자료 (추천 링크·스크린샷·블로그 출처) 재확인 필요.

**관련 race-management SW 인접 카테고리 참조** (이 클러스터에 들어와야 할 가능성 있는 후보): [Sailwave](https://www.sailwave.com/) (scoring), [Yacht Scoring](https://yachtscoring.com/), [Regatta Toolbox](https://www.regattatoolbox.com/), [Nautical Cloud](https://www.nautical-cloud.com/).

**시사점.** B7 슬롯을 (a) 위 4개 race-management SW 중 1~2 개로 대체, 또는 (b) 슬롯 제거 후 35→34 로 카운트 조정 — Danny 결정 필요.

#### B8. Velocitek SC1 / ProStart + companion

**(1) 포지셔닝·가격·타깃** — [Velocitek](https://www.velocitek.com/) (San Mateo, California). SC-1 은 ProStart 의 직접 전신 — **현재 단종**, [Archive 페이지](https://www.velocitek.com/pages/archive) 참조. 현행 라인업은 [ProStart](https://www.velocitek.com/products/prostart) (start line + tracking) 과 [SpeedPuck](https://www.velocitek.com/pages/speedpuck) (GPS 스피드). 타깃: 올림픽·딩기·요트 racer.

**(2) 기능** — ProStart: distance-to-line, 카운트다운, magnetic heading·heel·pitch·COG·SOG 를 4Hz 로깅, 75시간 배터리, Gorilla Glass, multi-constellation GPS. Companion SW: [Velocitek Control Center](https://www.velocitek.com/pages/software) (구형 다운로드 도구, v3.0부터 ChartedSails 직접 업로드). 신형 ProStart(2020+)/SpeedPuck(2021+)은 USB mass storage 로 직접 파일 드래그.

**(3) 알고리즘** — Distance-to-line 은 GPS 기반 라인 ping + 실시간 거리 계산. **분석 알고리즘(폴라·풍향 재구성)은 Velocitek 자체 SW에 없음 — 외부 분석 도구([ChartedSails](https://www.chartedsails.com/), [SailNjord](https://www.sailnjord.com/)) 에 위임**. .vtk 파일은 [open binary protocol](https://github.com/velocitek/vtk_protocol) 로 공개 — Google Protocol Buffer 기반.

**(4) UX·UI** — 하드웨어 디바이스 UI 중심 — Gorilla Glass 디스플레이에 카운트다운·distance-to-line·SOG 표시. **Companion SW 는 minimal — 다운로드 + 외부 분석 도구로 익스포트**.

**(5) 데이터 source** — 자체 multi-constellation GNSS + IMU(magnetic heading·heel·pitch). 4Hz 샘플링.

**(6) 출력·공유** — .vtk 파일 → ChartedSails/SailNjord 직접 업로드 또는 .gpx/.csv 변환. QGIS plugin ([VTK Importer](https://plugins.qgis.org/plugins/vtkimport/)) 로 GIS 워크플로우.

**(7) 가격 모델** — ProStart MSRP **$895** ([San Diego Marine](https://store.sandiegomarine.com/products/velocitek-prostart---generation-2-18970.html)), UK £769, EU €999. 일회 구매, 구독 없음. Companion SW 는 무료.

**(8) 강점·약점** — 강점: rugged 전용 하드웨어, 75h 배터리, 4Hz heel/pitch 로깅, **open .vtk 프로토콜** — 외부 분석 도구와의 broad 호환. 약점: **자체 분석 기능 없음**(다운로드 + 외부 도구 의존), 가격 진입장벽, companion app 이 사실상 데이터 익스포트 도구 — 모바일 앱 없음.

**(9) 사용자 리뷰** — Sailing Anarchy 등에서 standard 도구로 폭넓게 언급. App Store 별점 N/A (앱 자체 없음). 하드웨어 리뷰: Vakaros Atlas 2 와 비교 — Atlas 2 가 IMU·디스플레이 면에서 추월했다는 평가.

**(10) 장기 viability** — 2007년경부터 운영, San Mateo 자체 제조, 2020년 ProStart V2 출시 — 활발한 하드웨어 갱신. 단, Vakaros Atlas 2 등 신예 경쟁자에 시장 점유율 잠식 추정.

> **★ B8-Deep companion**: 7-axis Tier 0 심층 audit → [`B8_Velocitek_deepdive.md`](./B8_Velocitek_deepdive.md). **§1-§4 모두 "N/A 사유 명시"** (자체 풍향/날씨/폴라/회전 손실 모두 외부 위탁 모델). **.vtk Protocol Buffer 스키마 7가지 디자인 결정** (streaming framing, frequent/rare id 분리, 정수 스케일링, quaternion attitude, in-stream timer/button events) — SailTechCo 디바이스 설계 시 직접 차용 가치. **2026-03 가격 인하 발표 + CEO Jay Leon 부임 + RTK race management B2B pivot**. SpeedPuck "Wind Shift Indicator" 는 wind sensor 가 아닌 heading-deviation indicator 의 마케팅 별칭. 75h 배터리 = 무선 모듈 제거의 trade-off. Korea distributor 부재.

### 2.C Foiling·Windfoil specific 클러스터

> **클러스터 C 리서치 메타** — 원안의 C1 (Bartz), C2 (PPC), C5 (WindSwell) 3 건은 **공개 출처에서 단일 분석 SW 제품으로 식별 불가**. Bartz/WindSwell 은 명칭 재확인 필요 — 가능성 있는 본명은 [Wind Tracker](https://windtracker.app/en/) (2026 봄 출시 beta) 또는 [WindsportTracker](https://www.windsporttracker.com/en/) (독일 sunbits GmbH). PPC 는 보드 브랜드일 뿐 앱 없음. **본 클러스터의 유일한 직접 경쟁 분석 앱은 C4 Waterspeed 가 유일하며**, C6 한·일 시장은 **전용 분석 앱 부재 — 명확한 시장 공백**. (§6 moat 제안 핵심 input)

#### C1. ⚠ "Bartz Foiling app" — 공개 출처에서 미식별

공개 출처에서 이 이름의 윙포일·윈드포일 GPS 분석 앱을 확인하지 못함. App Store / Google Play 검색 시 "Bartz" 는 브라질 주유소 앱(Postos Bartz), 헬스센터 앱(Bartz-Altadonna), 게임 디자이너 Jason Bartz 작품 등이 노출. 포일링 관련 제품 없음. Seabreeze [Wingfoiling Apps Tracker 스레드](https://www.seabreeze.com.au/forums/Wing-Foiling/Wind-Wings/Wingfoiling-Apps-Tracker?page=1) 에서도 "Bartz" 언급 없음.

**가능성**: (a) 단무지공방 측 호칭이 다른 앱의 별명, (b) 독일·동유럽 비공식 앱, (c) 본인이 만든 GPX 분석 스프레드시트/스크립트. **Danny 측 명칭·URL 재확인 필요**.

대안 가능: [gps-wingfoiling.com](https://www.gps-wingfoiling.com/), [WindsportAtlanta GPX Analysis](https://windsportatlanta.com/content/gpx-wing-foiling-analysis-4725) — 호빙 커뮤니티에서 자주 함께 언급되는 GPX 후처리 분석 도구.

#### C2. PPC Foiling apps — 보드 브랜드 only, 앱 없음

[PPC Foiling](https://ppcfoiling.com/) 은 뉴질랜드 기반의 윙·다운윈드 보드·윙 제조사이며, **자체 GPS 분석 앱은 공개적으로 제공하지 않음**. 회사 사이트는 보드(M1, M2, Soar, Link), 윙(Sonic) 라인업과 [기술 페이지](https://ppcfoiling.com/pages/technology) 및 [FAQ](https://ppcfoiling.com/pages/faqs) 만 존재. Apple/Google 스토어 검색에서도 PPC 브랜드 앱은 색인되지 않음.

**시사점.** 윙포일 사용자는 PPC 보드 위에서 Hoolan, Waterspeed, Foil Sessions, FoilMotion 등 서드파티 앱으로 세션을 기록함 ([Seabreeze 스레드](https://www.seabreeze.com.au/forums/Wing-Foiling/Wind-Wings/Wingfoiling-Apps-Tracker?page=1)). **보드 브랜드가 자체 SW 를 만들지 않는다는 사실은, SailTechCo 가 하드웨어 브랜드와 화이트라벨/제휴 채널을 노릴 수 있는 기회임** (§6 moat).

#### C3. Surfline (윙포일러용 인접 도구 — 분석 SW 아님)

**(1) 포지셔닝·가격·타깃** — [Surfline](https://www.surfline.com/) 은 글로벌 1위 서핑 예보·라이브캠 서비스. **분석 앱이 아니라 예보 + 카메라 SaaS**. 윙포일러가 출조 의사결정 시 사실상 표준. 가격은 무료 + Premium($69.99/년) + Premium+ 3-tier ([Surfline Upgrade](https://www.surfline.com/upgrade)).

**(2) 기능** — 1000+ 글로벌 라이브캠, 16일 풍·파·날씨 예보, 시간별 wind/wave/tide 차트, 부이 데이터, 자체 wave model, **Live Wind dot(모델 vs 실측 구분)**, Cam Rewind(세션 리플레이 — Premium), Pinch-to-Zoom on cam, 지도상 임의 지점 forecast pin, **Smart Cams·Wave Timeline·Crowd/Wave Distribution graphs(Premium+)** ([Feature Focus: Cameras](https://www.surfline.com/lp/feature-focus/surfline-cameras)).

**(3) 알고리즘** — 자체 in-house wave model(wind-wave generation 통합, nearshore wave transformation physics), **Smart Cam 은 AI 기반 자동 하이라이트 추출**.

**(4) UX/UI** — iOS / Android / Web 3-플랫폼. Spot 페이지가 **Live 탭(지금 탈 것인가) 과 Forecast 탭(언제 탈 것인가) 으로 양분** ([Live vs Forecast Tabs](https://support.surfline.com/hc/en-us/articles/25290157830811-Understanding-the-Live-and-Forecast-tabs-on-the-Surfline-Android-App)). Live 탭은 한 화면에서 surf/swell/wind/tide/weather 카드 5개 + 24시간 연속 차트. **Premium 은 cam 풀스크린·rewind 진입이 1탭이며, 무료층은 광고+예보 차단으로 의도적 funnel.**

**(5) 데이터 source** — 자체 wave model + NOAA 부이·기상 모델 + 자체 운영 HD 카메라 네트워크 + 실측 wind station 데이터. **사용자 IMU/GPS 입력 없음.**

**(6) 출력/공유** — Cam Rewind 클립 다운로드, Premium+ 에서 계정 셰어(최대 2명). Strava/Instagram 직접 sync 는 없음.

**(7) 가격 모델** — Freemium + 연간 구독. Premium $69.99/yr (광고 포함 US), Premium+ 더 높은 가격.

**(8) 강점/약점** — 강점: 글로벌 카메라 네트워크(경쟁 우위 자체), 16일 forecast 길이, wave model 품질, **mobile UX 의 정보 밀도(Live 탭 정보 5종을 한 스크롤에)**. 약점: **윙포일 전용 뷰가 없음** — 윙포일러는 wind 카드만 보고, 서핑 중심의 wave/period 정보가 노이즈가 됨. 또한 **세션 분석·로깅 0%**.

**(9) 사용자 리뷰** — [JustUseApp Surfline 리뷰](https://justuseapp.com/en/app/393782096/surfline/reviews) 혼재 — "the best surf app especially if Premium" 긍정 vs "too clunky, too many clicks to wind" 부정. 윙포일 포럼에선 "wind/tide 확인용으로 Surfline + Windy 조합" 멘션 정착.

**(10) 장기 viability** — 1999년 창업, WSL 자산, 2024–2026 Premium+ 도입·Smart Cam AI 등 적극 업데이트. 매우 안정적.

**시사점.** SailTechCo 가 학습할 점은 (a) **Live/Forecast 2-탭 mental model**, (b) **카메라가 만드는 데일리 retention loop**, (c) **광고 + 셰어링 + tier 3개의 monetization gradient**. 단, 분석 앱은 이 모델을 그대로 복제 불가(우리는 출조 후 데이터, Surfline 은 출조 전 데이터).

#### C4. Waterspeed (Danny 현재 GPS 워치 앱 — 핵심 벤치마크)

**(1) 포지셔닝·가격·타깃** — [Waterspeed](https://www.waterspeedapp.com/) 는 세일링·윈드서핑·윙포일·윈드포일·카이트·SUP·서프·패들·로잉을 망라하는 **멀티-디시플린 watersports GPS 트래커**. 정체성은 "한 앱으로 모든 윈드/워터 스포츠"이며, 윙·윈드포일은 그 중 한 카테고리. **프리라이드 중심이고 정식 레이스 인터페이스는 아님.**

**(2) 기능** — 실시간 speed / distance / heart rate / 칼로리, **top speed·avg speed·alpha speed(500m 더블 트랙)**, 세션 종료 후 speed 기반 히트맵, **포일링 시간(time on foil)·포일링 효율·planing time**, tacks & gybes 자동 카운트, 스트로크 카운트(패들), 라이브 트래킹 공유, GPX 익스포트, 세션 비교, 풍속·기상 메타데이터 자동 첨부.

**(3) 알고리즘** — 공식 문서는 알고리즘 디테일 미공개. **포일링 디텍션은 속도 임계치 기반으로 추정** — 사용자 리뷰에서 "longest segments and total time on foil" 표현, hardware-dependent 정확도 코멘트. **[Seabreeze 스레드](https://www.seabreeze.com.au/forums/Wing-Foiling/Wind-Wings/Waterspeed-app-for-Google-Watch?page=1) 에서 한 사용자는 "tacks and jibes are backward for wind foil" 이라고 보고** — 즉 윈드포일 시 라벨이 반대로 붙는 버그성 이슈가 있어 IMU·heading 기반 분류 로직에 한계. 공식 알고리즘 백서·논문은 (공개 출처 미확인).

**(4) UX/UI** — iOS + Android + Apple Watch + Garmin Connect IQ([Garmin 앱](https://apps.garmin.com/apps/8f5a5158-a85c-4617-b648-b0755a6beb70)) 모두 지원하는 다플랫폼 앱. **Apple Watch 에서 standalone 기록 → iPhone 자동 sync**. 메인 UX 는 (1) 빅 폰트 실시간 메트릭, (2) 세션 후 히트맵 + 통계 카드, (3) 사용자 보드/세션 디스커버 피드.

**(5) 데이터 source** — Phone GPS / Apple Watch(GPS+HR) / Garmin watch. 외부 보드 IMU·도플러 GPS 등 별도 하드웨어는 unofficial. [Seabreeze 사용자 코멘트](https://www.seabreeze.com.au/forums/Wing-Foiling/Wind-Wings/Wingfoiling-Apps-Tracker?page=1) "GoPro GPS 와 거의 동일하게 읽힘" 평가.

**(6) 출력/공유** — Strava 연동, GPX 익스포트, 라이브 트래킹 링크 셰어, 세션 SNS 공유 카드.

**(7) 가격 모델** — **3-tier 구독**. Free(기본 세션 + 기본 통계) / Pro(전체 히스토리 + 고급 분석, 포일링 데이터, alpha/top speed) / Ultra(엘리트 퍼포먼스 인사이트). 월·연 구독.

**(8) 강점·약점** — **강점**: 멀티-스포츠 카버리지·Apple Watch standalone·다플랫폼·라이브 트래킹·개발자 응대 활발(평점 [4.7/5 iOS](https://apps.apple.com/us/app/waterspeed-track-watersports/id1234093389), [4.47/5 Android, 76 ratings](https://www.appbrain.com/app/waterspeed-track-watersports/com.waterspeed.waterspeedapp))·GPX 표준 익스포트. **약점**: ① 윈드포일 tack/jibe 라벨링 정확도 이슈 보고, ② 포일링 디텍션 알고리즘 비공개·검증되지 않음, ③ 멀티-스포츠 앱이라 윙·윈드포일 전용 KPI(예: 라이딩 위에서의 풍하 각도, 포일 글라이드율, 보드 헤딩 vs 트랙 헤딩의 leeway 등) deep dive 부재, ④ **비디오 오버레이 없음**, ⑤ 리더보드·소셜 그래프 약함(Strava 만 위임), ⑥ IMU/pitch sensor 기반 "physically on foil" 검출이 아닌 speed-threshold 추정의 본질적 한계.

**(9) 사용자 리뷰** — [iOS App Store](https://apps.apple.com/us/app/waterspeed-track-watersports/id1234093389) 4.7/5, [AppBrain Android](https://www.appbrain.com/app/waterspeed-track-watersports/com.waterspeed.waterspeedapp) 4.47/5 (76 ratings). [Foiling Canada 리뷰](https://foiling.ca/2025/04/11/waterspeed-water-sports-performance-tracking-app/) 긍정. Seabreeze: "원하는 데이터 표시, GPX 익스포트, 라이브 트래킹 — Hoolan 대비 Waterspeed 선호." **윈드포일 tack/jibe 라벨 역전 버그 보고**.

**(10) 장기 viability** — 개발사 **Waterspeed Technologies Limited**. 2018년부터 [i-Marine Apps 블로그](http://i-marineapps.blogspot.com/2018/12/waterspeed-tracking-and-performance-app.html) 에 등장 — 약 7–8년 운영. 월 ~2,200 다운로드 ([appstor.io](https://appstor.io/app/water-speed)). Garmin Connect IQ·Apple Watch·Android 다플랫폼 모두 유지하는 점에서 viability 양호하나, **풀-소셜 그래프·비디오·하드웨어 IMU 통합으로 가는 다음 단계가 미흡**.

**시사점.** Danny 가 이미 쓰고 있는 앱 — **본인 페인포인트(특히 윈드포일 tack 라벨링·포일 디텍션 정확도·시각화 깊이)가 SailTechCo의 차별화 wedge** (§6 moat).

> **★★ C4-Deep companion (Danny benchmark + 윙포일 커뮤니티 표준)**: 7-axis Tier 0 심층 audit → [`C4_Waterspeed_deepdive.md`](./C4_Waterspeed_deepdive.md). **2025-12-17 Ultra tier launch = wingfoil tracker → sailing analytics 정체성 전환 변곡점** (VMG / Polar Chart / Performance vs Target / Legs & Runs / TWA / Gain-Loss 도입). **3-tier 정확 가격: Free / Pro $29.99/yr / Ultra $199/yr** (6.6× 격차, Vakaros RaceSense $149 보다 비쌈). 회사 = **Waterspeed Technologies Limited, Dubai DIFC 등기**, CEO Costantino Spagnoletti. **NorthStar SailGP Official Technology Supplier** (F50 101.3 km/h 기록). **Tack/gybe 라벨 역전 버그 reverse-engineer**: GPS-only (no IMU) → COG-bisector fallback → wingfoil broad-reach 패턴에서 풍축 inversion → label flip. **SailTechCo 5개 wedge** (IMU board-heading, 공개 알고리즘, 한국어 UI, 비디오 sync, 12개월 진입 시점). KPI 390K downloads / 100K yearly active / 200 countries. Wear OS 정식 지원. Vakaros VKX import (Android+Web only, iOS coming soon). 한국어 UI 부재.

#### C5. ⚠ "WindSwell" — 공개 출처에서 미식별

공개 출처에서 "WindSwell" 이라는 이름의 윙포일·윈드포일 분석 앱을 명확히 식별하지 못함. App Store / Google Play / Seabreeze / Foilzone / SROKA 비교 글 어느 곳에서도 "WindSwell" 을 단독 앱 이름으로 다루지 않음.

**유력 후보**:
- [Wind Tracker app](https://windtracker.app/en/) — 2026 spring 출시 beta, 윙포일·윈드포일·snowkite·parawing·pumpfoil 등 광범위 지원. 이름 유사로 혼동 가능.
- [WindsportTracker](https://www.windsporttracker.com/en/) — 독일 sunbits GmbH 앱, 독일·유럽 윙포일 커뮤니티에서 사용.
- [iWindsurf](https://apps.apple.com/us/app/iwindsurf-weather-and-waves/id564865754) — 예보 앱이라 분석은 아님.

**Danny 측 원자료 (URL·스크린샷) 재확인 필요**. 만약 본명이 Wind Tracker (windtracker.app) 라면: 강점은 매우 넓은 디시플린 커버리지(parawing/dockstart까지)·2026 spring 출시 — 약점은 beta·트랙 레코드 부족.

#### C6. Foil & Surf (한국·일본 카테고리 prompt) — **시장 공백 = SailTechCo 1순위 기회**

**결론: 공개 출처에서 한국·일본 전용 윙포일/포일링 GPS 분석 앱을 확인하지 못함.**

한국 App Store에서 "윙포일", "포일", "윙서핑" 키워드 검색 시 한국어 UI 를 가진 전용 윙포일 분석 앱은 색인되지 않음 — 일반 위치 추적·여행 트래커만 노출 ([클리앙 GPS 앱 추천 스레드](https://www.clien.net/service/board/cm_iphonien/12664667), [Polarsteps 한국어](https://apps.apple.com/us/app/polarsteps-travel-tracker/id947925763?l=ko)).

일본 App Store 에서도 "ウィングフォイル", "フォイル アプリ GPS" 검색 시 일반 GPS 로거(ウェイログ, ルートヒストリー, Geo Tracker)만 노출되고 윙포일 전용 앱은 없음 ([ウェイログ](https://apps.apple.com/jp/app/gps%E3%83%AD%E3%82%AC%E3%83%BC%E3%82%A2%E3%83%97%E3%83%AA-%E3%82%A6%E3%82%A7%E3%82%A4%E3%83%AD%E3%82%B0-%E3%82%AA%E3%83%B3%E3%83%87%E3%83%9E%E3%83%B3%E3%83%89%E7%A7%BB%E5%8B%95%E8%A8%98%E9%8C%B2/id1600437626), [Good!Apps GPS 로거 7선](https://good-apps.jp/media/column/18610)).

**관찰.** 한·일 윙포일러가 실제로 사용하는 앱은 글로벌 영문 앱(Waterspeed, Hoolan, Foil Sessions, FoilMotion)이며 **한국어/일본어 현지화는 부분적이거나 영문 UI 그대로** 사용되는 것으로 추정. 한국 커뮤니티는 네이버 카페/카카오톡 오픈채팅·인스타그램 릴스 중심, 일본은 X·인스타그램 중심으로 세션 비주얼이 공유되며 **분석 앱 스크린샷보다 GoPro 영상이 압도적**.

**기회·리스크 (§6 moat 입력)**:
- ① 한국어/일본어 1차 UI 를 갖춘 윙포일 분석 앱이 부재 → SailTechCo 의 명확한 진입 공백
- ② 한·일은 윙포일 도입기(2023–)에서 성장기(2025–) 진입 중 — 사용자 베이스가 커지는 시점
- ③ 단무지공방이 한국 윙포일 커뮤니티에 근접 — 첫 사용자 확보 경로 보유
- ⚠ 리스크: 한·일 윙포일 인구 자체가 글로벌 대비 작아 ARPU 모델 한계
- ⚠ 한·일 사용자도 결국 Strava·Waterspeed 같은 글로벌 앱에 다중 가입할 가능성
- ⚠ 영문 SEO·앱스토어 카테고리 진입 필요(글로벌 확장 시)

**전략적 시사점.** **글로벌 베스트(Waterspeed/Hoolan/FoilMotion)의 한국어 현지화가 본격화되기 전이 SailTechCo의 시간 창(window)**.

### 2.D 범용 GPS·워치 클러스터

> **클러스터 D 핵심 관찰** — Garmin Quatix 만이 sailing 을 1급(first-class) 모드로 다루며 SailAssist + Connect IQ 생태계로 SailTechCo 의 가장 강력한 경쟁 압력. Suunto / Strava / Polar / Apple Watch / Samsung Health 는 sailing 을 체크박스 sport type 으로만 처리 — 분석 깊이 0. 그러나 **Apple HealthKit 의 third-party fertile platform 성격은 SailTechCo 의 distribution channel 이 될 수 있음** (Waterspeed, iRegatta Watch, SailingWatch 등이 이미 활용).

#### D1. Garmin Quatix / Quatix 7 (+ Connect IQ 생태계)

**(1) 포지셔닝·가격·타깃** — Garmin Quatix 7 시리즈는 보트/세일링/낚시를 핵심 타깃으로 한 "마린 스마트워치" 로 명시적으로 포지셔닝되어 있으며, **세일링은 1급(first-class) 모드**. 가격은 Standard $699.99 ~ 7X Solar $1,199.99, 7 Pro $999.99 ([Garmin newsroom](https://www.garmin.com/en-US/newsroom/press-release/marine/garmin-quatix-7-smartwatch-fuels-the-active-boater-lifestyle/)). Yachting World 는 "Best Sailing Watch 2025" 로 선정 ([Yachting World](https://www.yachtingworld.com/uncategorized/price-drop-get-the-garmin-quatix-7-pro-out-best-sailing-watch-2025-for-under-500-160932)).

**(2) 기능** — Boating / Sailing / Sail Racing 액티비티 프로파일 내장. **SailAssist™** 패키지: (a) 가상 스타트 라인 (b) 레이스 카운트다운 타이머 (c) **Tack Assist** (포트/스타보드 COG 측정 → 평균 진풍향 산출, header/lift 표시) (d) 앵커 알람 ([Tack Assist manual](https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/EN-US/GUID-4BE4156E-A466-46F7-AEEA-F17EBFC109C0.html), [Sail Racing manual](https://www8.garmin.com/manuals-apac/webhelp/quatix7series/EN-SG/GUID-C361E0E1-7614-4720-A3B6-194CB3C4E92F-9180.html)). **VMG/폴라 다이어그램은 내장 없음** — Tack Assist 가 가장 진보된 분석.

**(3) 알고리즘** — Tack Assist 는 단일 알고리즘(포트/스타보드 COG 의 평균으로 진풍 방향 추정)에 가까움. 별도 풍속 센서가 없을 때는 보트 동선만으로 추정 → 정밀도 제한적. 폴라/딥러닝 기반 분석 없음.

**(4) UX / UI** — 47/51mm 둥근 워치, 10ATM 방수, 햇빛 가독 컬러 디스플레이(AMOLED on 7 Pro). 워치 페이스가 세일링 데이터(스타트 라인 거리/COG/SOG) 표시. 모바일은 Garmin Connect.

**(5) 데이터 source** — 내장 GPS(멀티 GNSS) + IMU + 광학 HR + 기압계. **외부 데이터로 Garmin MFD(chartplotter)와 ANT/Wi-Fi 연동하여 wind, depth, 엔진 RPM, water temp 스트리밍 가능**. 단 B&G/Raymarine 등 타사 NMEA 직접 통합은 공개 출처 미확인.

**(6) 출력 / 공유** — Garmin Connect 클라우드, GPX export, Strava 자동 동기화. **Connect IQ 통해 third-party 앱 설치 가능**.

**Connect IQ 세일링 앱 생태계** — (a) **Sail Racer / Sail Race**: 3-화면 구성, 노티컬 단위 ([Sail Race](https://apps.garmin.com/en-US/apps/9085efa1-786d-48e6-b8dd-076b84df5051)); (b) **Sail2WIN — "Sailing Instruments on your wrist"** ([Sail2WIN](https://apps.garmin.com/en-US/apps/791191d4-0593-426c-838d-ee71558a967d)); (c) **raceQs** — 가속도/자이로로 보트 모션 기록, 클라우드에 3D 레이스 리플레이 생성 ([raceqs Connect IQ](https://apps.garmin.com/en-US/apps/74c474f8-4140-4794-afb7-f56817083bd5)); (d) **Yet Another Sailing App / SailingTools (오픈소스)** ([GitHub pintail105](https://github.com/pintail105/SailingTools)); (e) **Sailing Race Timer** ISAF compliant. NavyRace 는 본 검색에서 공개 출처 미확인.

**(7) 가격 모델** — 워치 하드웨어 일회성 구매. SailAssist 무료 내장, Connect IQ 앱 대부분 무료. **별도 SaaS 없음**.

**(8) 강점 / 약점** — 강점: HR/배터리/MFD 연동/세일링 1급 모드/오픈 third-party 생태계. **약점: 폴라 다이어그램 미내장, 진풍 추정이 보트 COG 에만 의존, 워치 화면 작아 dinghy/wingfoil 에서 한 손으로 디테일한 분석 보기 어려움**, MOB 버튼 오작동 보고 ([no-frills-sailing review](https://no-frills-sailing.com/garmin-quatix-smartwatch-sailing-review/)).

**(9) 사용자 리뷰** — Yachting World 5-star ([Quatix 6 review](https://www.yachtingworld.com/reviews/gear-reviews/garmin-quatix-6-review-best-boating-and-sailing-smart-watch-tested)); [Sailing Anarchy Sail Racer 5.1](https://forums.sailinganarchy.com/threads/garmin-sail-racer-version-5-1-released.244299/); SailAssist UX 불만 (Quatix 6 에서 "사라졌다" 보고) ([Garmin forum](https://forums.garmin.com/outdoor-recreation/outdoor-recreation/f/fenix-6-series/307268/the-built-in-sailassist-race-start-app-in-my-quatix-6-has-disappeared-how-do-i-find-it-again)).

**(10) 장기 viability** — Garmin 은 마린 부서에 막대한 투자(Quatix → 매해 업데이트, MFD/Autopilot 라인업). **세일링은 핵심 마케팅 카테고리**이며 체크박스가 아님. **SailTechCo 입장에서 가장 강력한 경쟁 압력.**

> **★ D1-Deep companion**: 7-axis Tier 0 심층 audit → [`D1_Garmin_Quatix7_deepdive.md`](./D1_Garmin_Quatix7_deepdive.md). Tack Assist 알고리즘 매뉴얼 verbatim (`TWD = (COG_port + COG_stbd)/2 ± 180°`) + 7가지 한계 (조류 보정 부재, asymmetric polar 가정 불가, single-shot calibration, downwind 미지원), MFD 게이트웨이 락인 (B&G/Raymarine non-Garmin 비공식 불가), Quatix 7 Pro $999.99 / 7X Solar / 7 Sapphire 4종 라인업, Connect IQ 5개 sailing 앱 (Sail Racer / Sail2WIN / raceQs CIQ / Race Timer / SailingTools). **Phase 3 Connect IQ wedge = polar overlay + 회전 손실 + sailing replay** (모두 Garmin/CIQ white space).

#### D2. Suunto 9 / Suunto Vertical / Suunto Ocean

**(1) 포지셔닝·가격·타깃** — 아웃도어 멀티스포츠 GPS 워치. **세일링은 80+ 사전 정의 스포츠 모드 중 하나(체크박스), 1급 모드 아님** ([Suunto Vertical sport modes](https://www.suunto.com/Support/Product-support/suunto_vertical/suunto_vertical/recording-an-exercise/sport-modes/)). 예외는 클래식 **Suunto Regatta** (2007년 출시, 약 $150) 로 세일링 전용이지만 단종에 가까움. 최근 **Suunto Ocean** ($999) 이 다이빙+세일링을 겨냥 ([Yachting World Suunto Ocean review](https://www.yachtingworld.com/reviews/gear-reviews/suunto-ocean-smart-diving-and-sailing-watch-review)).

**(2) 기능** — 세일링 모드에서 속도/평균속도/거리(노티컬 마일) 표시. HR/GPS/방위. 레이스 카운트다운 타이머는 일반 timer widget. 클래식 Regatta 모델은 sequence 카운트다운 + 60개 시각 바 + 50 waypoints. **VMG/폴라/Tack Assist 미내장**.

**(3) 알고리즘** — 일반 GPS 액티비티 트래킹. 세일링 모드는 단순히 "라벨" — 다른 GPS 액티비티와 동일 알고리즘. **어떠한 세일링 특화 알고리즘도 없음**.

**(4) UX / UI** — 라운드 워치. 세일링 전용 워치 페이스 미제공. Suunto app 에서 data field 커스터마이즈 가능하지만 wind/heading 인텔리전스 없음.

**(5) 데이터 source** — GPS(멀티 GNSS) + IMU + 광학 HR + 기압계. 외부 풍속/NMEA 센서 통합 미공개.

**(6) 출력 / 공유** — Suunto Cloud, Strava/Komoot 동기화, GPX/FIT export.

**(7) 가격 모델** — 워치 하드웨어 일회성 (Vertical $629–839, Ocean ~$999). SaaS 없음.

**(8) 강점 / 약점** — 강점: 매우 긴 배터리(Vertical 60시간 GPS), 견고함. **약점: 세일링은 메뉴 옵션일 뿐 — 레이싱 워크플로(스타트 라인, Tack Assist, 폴라) 전혀 없음. Regatta 모델조차 2007년 디자인.**

**(9) 사용자 리뷰** — [Suunto forum: Sailing on Vertical](https://forum.suunto.com/topic/10795/sailing-activity-on-vertical) — 사용자가 어떤 데이터 필드가 나오는지 직접 물어봄(메뉴얼에 명시 없음). [Sail racer apps 스레드](https://forum.suunto.com/topic/9061/sports-apps-sail-racer) — Connect IQ 같은 third-party 세일링 앱 부재 불만.

**(10) 장기 viability** — Suunto 브랜드는 안정적이나 **세일링은 우선순위 아님**. 아웃도어/트레일러닝/다이빙이 메인. 체크박스 기능.

#### D3. Strava (Sailing activity)

**(1) 포지셔닝·가격·타깃** — Strava 는 러닝/사이클링 중심 소셜 피트니스 플랫폼. **세일링은 2024년경 추가된 신규 sport type** ([Strava community: Add sailing](https://communityhub.strava.com/t5/ideas/add-sailing-as-a-sport-type/idi-p/1060)). 무료 기본 / Subscription $11.99/월. 타깃은 sailor 아닌 일반 athlete.

**(2) 기능** — 시간, 거리, 속도, 루트(GPS polyline), HR(워치 연동 시). **VMG/Tack/풍속 분석 없음.** 세일링 액티비티는 자동 히트맵 폴리라인 사용.

**(3) 알고리즘** — Strava 는 GPS 트레이스에 드리프트 보정/클러스터링/이상치 필터링을 적용하지만 이는 사이클링/러닝 기준. **세일링은 단순 sport type 태그** — 별도 세일링 특화 알고리즘 없음.

**(4) UX / UI** — 모바일 앱/웹. 액티비티 페이지는 다른 sport 와 동일한 템플릿. **세일링 전용 위젯 없음.**

**(5) 데이터 source** — 모바일 GPS 또는 외부 워치(Garmin/Apple/Suunto/Coros) 에서 동기화. 풍속 등 sensor fusion 미지원.

**(6) 출력 / 공유** — GPX export, 소셜 피드, 클럽/세그먼트. **단 세그먼트는 사이클/러닝 위주로 sailing 세그먼트는 사실상 없음.**

**(7) 가격 모델** — Freemium. 세일링별 별도 과금 없음.

**(8) 강점 / 약점** — 강점: 친구/팔로워 공유, GPX 백업. **약점: 세일링 데이터 분석 0**. tack 자동 검출, 풍향 보정, 폴라 매칭 등 어떤 세일링 인사이트도 제공하지 않음.

**(9) 사용자 리뷰** — [SailingForums Strava](https://sailingforums.com/threads/strava.38291/): "Strava 는 sailing 데이터 표시는 가능하지만 분석 도구로는 무가치". [Sailing Anarchy Strava](https://forums.sailinganarchy.com/threads/strava-for-sailing.144611/) 유사 평. Garmin Connect 에서 자동 sync 시 sailing activity 가 다른 sport type 으로 잘못 태깅되는 문제 보고.

**(10) 장기 viability** — Strava 브랜드 매우 안정. **세일링은 sport type 추가 외 향후 어떠한 sailing 특화 기능 로드맵도 공개되지 않음**. 사이클링/러닝의 매출 비중이 압도적이므로 sailing 은 영구 체크박스로 남을 가능성 큼.

#### D4. Polar Beat / Polar Vantage (Sailing 사용)

**(1) 포지셔닝·가격·타깃** — Polar 는 HR 모니터링 1세대 브랜드. Polar Beat 는 무료 iOS/Android 앱으로 HR 센서+폰 GPS 로 운동 기록. Vantage V3/M3 워치는 멀티스포츠. **세일링은 공식 14개 기본 sport profile 에 없음** — 사용자가 Polar Flow 에서 커스텀 sport profile 로 추가해야 사용 가능 ([Polar Flow sport profiles](https://support.polar.com/en/polar-flow-sport-profiles)).

**(2) 기능** — HR 존, 칼로리, 거리/속도(GPS 워치 기반), 루트, Polar Running Index 등. **세일링 특화 metric 0**. VMG/Tack/wind 없음.

**(3) 알고리즘** — 세일링이 sport profile 에 추가되어도 알고리즘은 일반 GPS 액티비티와 동일. Polar 강점인 HR 분석은 적용되지만 sailing-aware 하지 않음.

**(4) UX / UI** — Polar Flow 모바일/웹. Sport profile 마다 training view 커스터마이즈 가능. 세일링 전용 워치 페이스/위젯 없음.

**(5) 데이터 source** — H9/H10/OH1 HR 센서, 폰/워치 GPS, IMU. 외부 wind/marine sensor 통합 미공개.

**(6) 출력 / 공유** — Polar Flow 클라우드, Strava/TrainingPeaks 동기화, GPX/TCX export.

**(7) 가격 모델** — Polar Beat 무료, 워치 하드웨어 일회성. SaaS 없음.

**(8) 강점 / 약점** — 강점: **HR 정확도 업계 표준 (chest strap H10)**. 약점: **세일링은 brand priority 가 아예 아님** — 검색 결과 Polar 공식 채널에서 sailing 언급 거의 없음. Sport profile 을 추가해도 워치는 "sailing 이 무엇인지 모른다".

**(9) 사용자 리뷰** — 검색에서 sailor 커뮤니티가 Polar 를 sailing 도구로 추천하는 사례 찾기 어려움. Two Get Lost "best sailing watches" 리스트에 Polar 부재.

**(10) 장기 viability** — Polar 브랜드는 안정하나 **세일링은 0순위 — 체크박스조차 안 됨**. HR 정확도라는 단일 강점에만 의존.

#### D5. Apple Watch — Sailing Workout

**(1) 포지셔닝·가격·타깃** — Apple Watch 는 일반 소비자 스마트워치. Sailing 은 HealthKit 워크아웃 타입 중 하나(`HKWorkoutActivityType.sailing`) 로 1순위 모드 아님 ([Apple Developer HKWorkoutActivityType](https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype)). Ultra($799) 는 마린/익스트림 마케팅이 있지만 sailing-specific UX 는 미내장.

**(2) 기능** — **네이티브 Sailing workout 은 시간과 칼로리만 기록 — 거리/속도 metric 없음** ([Apple Community](https://discussions.apple.com/thread/254237638)). Apple 측 sailing-specific tactic/start line/VMG 기능 미확인.

**(3) 알고리즘** — Workout 분류는 단순 타입 태그. 칼로리 추정은 HR/IMU 기반의 일반 알고리즘.

**(4) UX / UI** — Apple Watch + iPhone Health 앱. Sailing 워치 페이스 별도 없음(Ultra 의 Wayfinder face 는 컴퍼스/방위 표시 가능). Action Button(Ultra) 을 third-party 앱이 활용 가능.

**(5) 데이터 source** — GPS(dual-frequency on Ultra) + IMU + HR + barometer + 자이로. 외부 wind 센서 BLE 통합은 third-party app 책임.

**(6) 출력 / 공유** — Apple Health → third-party export. 네이티브 GPX export 없음, 앱이 처리.

**(7) 가격 모델** — 워치 하드웨어 일회성 ($399–$799). Apple 은 sailing 별도 SaaS 없음.

**(8) 강점 / 약점** — **강점**: **HealthKit 으로 third-party 앱(Waterspeed, iRegatta Watch, SailingWatch, SailTracks, Race Master) 이 sailing 워크아웃 타입을 올라타 풍부한 기능 추가 가능**. **약점**: Ultra 2 조차 dinghy/wing 환경에서 화면 가독성/wet finger 터치 문제 ([Sailing Anarchy Ultra dinghy](https://forums.sailinganarchy.com/threads/apple-watch-ultra-for-dinghy-sailing.244491/)). 배터리 1일 미만.

**(9) 사용자 리뷰** — Sailing Anarchy: "Apple Watch Ultra 는 dinghy 에 너무 작고 wet finger 에 touch 부정확. trap 자세에서는 사용 불가." Apple Community: "sailing workout 에 distance/speed 가 없는 게 큰 한계". Waterspeed/SailingWatch 같은 third-party 앱이 이 갭을 메우는 시장 형성.

**(10) 장기 viability** — Apple 은 sailing 을 brand priority 로 다루지 않음 — sailing 은 80+ workout type 중 하나. **그러나 HealthKit/WatchKit 이 third-party sailing 앱의 fertile platform 이라는 점이 SailTechCo 에 양면적 의미: 직접 경쟁이 아니라 distribution channel 이 될 수 있음.**

#### D6. Samsung Galaxy Watch / Samsung Health (Sailing)

**(1) 포지셔닝·가격·타깃** — Samsung Galaxy Watch 시리즈(Watch 6/7/Ultra, $299–$649). Wear OS + Samsung Health. **Sailing 은 자동 감지 액티비티에 포함 안 됨** (Running/Walking/Cycling/Elliptical/Rowing/Swimming 만 auto-detect). 사용자가 90+ 매뉴얼 운동 리스트에서 sailing 을 선택하거나 custom workout 생성해야 함 ([Samsung exercise tracking](https://www.samsung.com/us/support/answer/ANS10001351/)).

**(2) 기능** — 시간/HR/칼로리 + GPS 활성화 시 거리/속도/루트. **VMG/Tack/wind/start line 모두 없음.**

**(3) 알고리즘** — Sailing 은 라벨에 가깝고, GPS 트랙은 일반 액티비티 알고리즘으로 처리.

**(4) UX / UI** — Samsung Health 앱. Custom workout routine 기능(One UI 6) 로 카운트다운+세트 구성 가능하지만 ISAF race-start 워크플로 아님.

**(5) 데이터 source** — GPS + IMU + HR + 기압계. **Health Connect** 통해 다른 Android 앱에 데이터 공유 가능 — Samsung 은 third-party 직접 액세스를 중단하고 Health Connect 를 브리지로 권장. 단 Health Connect 에 sailing-specific 데이터 schema 는 미공개.

**(6) 출력 / 공유** — Samsung Health 클라우드, Strava 연동, Google Fit, Health Connect. GPX export 는 third-party 도구 필요.

**(7) 가격 모델** — 워치 하드웨어 일회성. SaaS 없음.

**(8) 강점 / 약점** — 강점: Android 시장 점유, 가격 합리적. **약점: 세일링 커뮤니티 평가 매우 낮음**. (a) GPS 사용 시 배터리 6–10시간(레이스 데이 부족), (b) 속도 refresh rate 가 windsurf/세일링 속도 추적에 부족, (c) 사용자가 직접 custom app 을 만들어야 하는 경우 다수, (d) Galaxy Watch 4 는 windsurfing 액티비티에서 GPS 활성화 불가 보고.

**(9) 사용자 리뷰** — Sailing Anarchy "Samsung watch app": "no sailing-specific apps available, 배터리 짧음" ([Sailing Anarchy Samsung](https://forums.sailinganarchy.com/threads/samsung-watch-app.210375/)). Samsung Community "Using Galaxy Watch for windsurfing": "물에는 견디지만 속도 새로고침 부족, Strava 연동 시 ~20% 기록 누락" ([Samsung windsurfing](https://eu.community.samsung.com/t5/wearables/using-galaxy-watch-for-windsurfing/td-p/1970340)). Seabreeze "Best app for galaxy watch (windsurfing)" — 사용자는 사실상 dedicated 앱 부재 호소.

**(10) 장기 viability** — Samsung 은 Health/Fitness 에 일관된 투자 중이나 **세일링은 사실상 무관심 영역**. Galaxy 생태계 sailor 점유율이 매우 낮아 SailTechCo 가 Wear OS 앱을 출시할 경우 경쟁자 부재가 곧 기회 + 시장 작음이라는 양면.

### 2.E Sensor + SW combos 클러스터

> **클러스터 E 핵심 관찰** — Sailmon Max 가 2025년 3월 Vakaros 에 인수 — 업계 재편 진행 중. NKE 는 오프쇼어 racing 의 디폴트로 30년+ 자리. Movesense·RaceBox 는 raw 데이터 fidelity 제공자로 SailTechCo 가 leveraging 할 수 있는 sensor 플랫폼.

#### E1. Movesense Sailing pack

**(1) 포지셔닝·가격·타깃** — Movesense 는 Suunto 에서 스핀오프한 핀란드 웨어러블 센서 플랫폼으로, **범용 IMU/ECG 센서 + 오픈 SDK** ([공식](https://www.movesense.com/)) 형태로 판매. **"Sailing pack" 이라는 명시적 SKU 는 공식 Shop 에서 확인되지 않음** — 세일링 활용은 Movesense Flash/HR+ 센서 + Showcase 앱 + 자체 개발(SDK) 조합에 가까운 "DIY 개발자 플랫폼". 가격은 개별 가격이 공개되지 않고 볼륨 견적제(sales@movesense.com 문의). 타깃은 연구자/스타트업/제조사이며, **일반 세일러 직접 구매 제품은 아님**.

**(2) 기능** — 하드웨어: 9축 IMU(가속도 ±2/4/8/16g, 자이로 ±125~2000dps, [샘플링 12.5~833Hz](https://www.movesense.com/specifications/)), 자력계, 심박/ECG, 온도. 9.4g 초경량, BLE 스트리밍 + 온보드 저장(Flash). SW: [Movesense Showcase 앱](https://apps.apple.com/us/app/movesense-showcase/id1439876677) 으로 raw IMU/HR/ECG 스트리밍·기록, CSV/JSON export. **세일링 특화 분석은 기본 제공 없음** — 개발자가 SDK 로 직접 구현해야 함.

**(3) 알고리즘** — [Movesense API](https://www.movesense.com/docs/esw/api_reference/) 는 raw 센서 데이터(LinearAcceleration, AngularVelocity, MagneticField, Orientation 쿼터니언) 를 노출. 세일링 전용 알고리즘(범 트림/heel 분석/리깅 텐션) 은 **공식 제공 없음** — 사용자/연구자가 ML 또는 룰 기반으로 직접 구현.

**(4) UX / UI** — Showcase 앱은 개발자 데모 수준 — 세일러용 대시보드 UX 아님. 웹 대시보드 없음.

**(5) 데이터 source** — 자체 센서 only. 외부 통합은 BLE/REST API 를 통해 개발자가 직접 구축. CSV/JSON raw export.

**(6) 출력 / 공유** — Showcase 앱에서 로그 파일 다운로드(CSV). 오픈 SDK 로 임의 포맷 변환 가능. Njord/ChartedSails 등 세일링 분석툴과의 즉시 통합은 공개 출처 미확인.

**(7) 가격 모델** — 하드웨어 일회성 + 구독 없음. 단가는 B2B 견적제.

**(8) 강점 / 약점** — 강점: **9축 IMU raw 데이터 풀 액세스, 오픈 API, 의료급 정확도(MD 모델), 10g 미만 초소형**. 약점: 세일링 분석/UI 0 에서 시작, 개인 세일러 구매 어려움, 마스트/리깅 텐션은 IMU 로 직접 측정 불가(별도 로드셀 필요).

**(9) 사용자 리뷰** — 세일링 커뮤니티 직접 리뷰는 검색되지 않음. 연구용 활용 사례 위주.

**(10) 장기 viability** — Suunto 모회사 백업, 의료(MDR Class IIa) 인증으로 메디컬 시장 진입 — 회사 안정성 높음. **그러나 세일링은 공식 타깃 도메인이 아니므로 "Sailing pack" 이라는 패키지를 단무지공방이 직접 빌드해야 함.**

#### E2. RaceBox Mini + iOS app

**(1) 포지셔닝·가격·타깃** — 모터스포츠/자동차 lap-timer 시장에서 출발한 25Hz GPS + IMU 하드웨어, 세일링·사이클·드래그까지 확장 사용. 가격: 약 **$199** ([RaceBox.pro](https://www.racebox.pro/products/racebox-mini)), 유럽 €199. 타깃: 자동차/모터바이크 레이서가 주력, **세일링은 부수 시장**.

**(2) 기능** — 하드웨어: **25Hz GPS** (GPS/GLONASS/Galileo/BeiDou multi-GNSS), 정확도 약 10cm, 통합 가속도계/자이로, 충격·스플래시 저항, BLE 5.2. 폰 연결 필수(스탠드얼론은 [Mini S](https://www.racebox.pro/products/racebox-mini-s) 모델). SW: [RaceBox 앱](https://www.racebox.pro/products/mobile-app) — lap timer, 드래그 측정, 트랙 저장, 가속도 그래프, 비교.

**(3) 알고리즘** — 25Hz raw GNSS + IMU 데이터로 lap split, 0-100/0-60mph, 슬립 보정, lean angle 계산. **세일링 특화 알고리즘(VMG, polar, layline) 은 RaceBox 앱 자체에는 없음** — 일반 lap/track 모드를 세일링 코스에 응용.

**(4) UX / UI** — 모바일 앱 위주. 자동차 친화 UI(드래그 스트립, 라이브 g-force 그래프). 세일러는 트랙/lap 모드 응용. 웹 대시보드 없음.

**(5) 데이터 source** — 자체 센서 only(BLE 연결). RaceChrono 같은 서드파티 모터스포츠 앱과 호환.

**(6) 출력 / 공유** — CSV export, RaceChrono 통합. 세일링 전용 툴(Njord/ChartedSails) 직접 통합은 공개 출처 미확인 — 다만 **raw GPS CSV 는 ChartedSails 가 지원하는 포맷**.

**(7) 가격 모델** — Hardware 일회성 $199, 앱 무료, 구독 없음.

**(8) 강점 / 약점** — 강점: **25Hz 는 클래스 최고 수준, 가격 대비 데이터 fidelity 압도적, 앱 무료/구독 없음**. 약점: 세일링 특화 분석 부재, Mini 는 폰 연결 필수(배터리 부담), 앱 UI 가 자동차 중심.

**(9) 사용자 리뷰** — Sailing Anarchy 에서 dinghy GPS tracker 토론 시 RaceBox 는 직접 언급되기보다 TRACE/Velocitek 대비 가성비 옵션으로 회자 ([Affordable GPS Speedometer](https://forums.sailinganarchy.com/threads/affordable-gps-speedometer.220166/)). 모터스포츠 측 리뷰는 매우 우호적.

**(10) 장기 viability** — RaceBox 는 Mini → Mini S → Micro 로 제품 라인 확장 중, 모터스포츠 시장에서 자리 잡음. 세일링은 부수 시장이지만 **하드웨어 자체는 신뢰도 높음 — SailTechCo 가 sensor input 으로 활용 가능**.

#### E3. Sailmon MAX + 컴패니언 앱 (2025 Vakaros 인수 후)

**(1) 포지셔닝·가격·타깃** — 4.4″ 햇빛 가독 디스플레이 + 클라우드 분석 앱 결합. **2025년 3월, [Vakaros 가 North Technology Group 으로부터 Sailmon Instruments(MAX 라인) 를 인수](https://www.vakaros.com/blogs/news/vakaros-acquires-sailmon)** — MAX/MAX mini 라인은 Vakaros 산하로 이전, ELEMENT 라인은 North Tech 의 Synapse(Future Fibres 브랜드) 에 잔류. 가격: MAX €899, MAX mini €399, 무선 초음파 윈드센서 €499. 타깃: 딩기/스포트보트/원디자인 레이서.

**(2) 기능** — 하드웨어: GPS, 9축 IMU(speed, heel, pitch, COG), 큰 햇빛 가독 디스플레이. SW: [Sailmon 앱](https://sailmon.com/max/) — 실시간 디스플레이 + 사후 분석(레그 자동 분할, 업윈드/다운윈드 성능, 헤딩 vs COG, **윈드 시프트 트렌드**, Header/Lift 표시).

**(3) 알고리즘** — 자동 레그 분할, 업윈드/다운윈드 분리, personal best top speed/500m, **Header/Lift detection, Wind Trends** ([Blog](https://blog.sailmon.com/header-lift-wind-trends-and-app-updates-for-max)). 알고리즘 상세 화이트페이퍼는 공개 출처 미확인.

**(4) UX / UI** — 디스플레이 UI 는 "직관적, 크루가 설명 없이도 이해" (Blur.se 리뷰). 앱: 맵 위 트립 재생 + 그래프, 다른 세일러와 데이터 비교.

**(5) 데이터 source** — 자체 센서 + 옵션 무선 윈드. NMEA 입력 통합도 가능. [Njord Analytics](https://www.sailnjord.com/data-sources/sailmon/), ChartedSails 같은 외부 분석툴이 Sailmon 로그를 import.

**(6) 출력 / 공유** — [GPX/CSV/Events 다운로드 지원](https://sailmon.com/support-articles/how-to-download-my-data/). Njord/ChartedSails/RaceQs/Kinetix 호환. **Telemetry Overlay 로 GoPro 영상에 오버레이 가능.**

**(7) 가격 모델** — 하드웨어 일회성 + **GOLD 구독 €9.99/월** ([Paid features](https://sailmon.com/paid-features/)). GOLD 에는 업/다운윈드 성능, 윈드 디렉션, 시프트 트래킹, GPX 다운로드 등 핵심 분석이 포함되어 **페이월 논란** ([Sailing Anarchy "Bait and Switch"](https://forums.sailinganarchy.com/threads/sailmon-max-bait-and-switch.243799/)).

**(8) 강점 / 약점** — 강점: 햇빛 가독 디스플레이, 통합 GPS/IMU/윈드, 폭넓은 서드파티 호환. **약점: GOLD 페이월(raw GPX 다운로드까지 유료화로 커뮤니티 반발), 인수 후 로드맵 불확실.**

**(9) 사용자 리뷰** — Sailing Anarchy: "raw .gpx 다운로드까지 페이월에 넣는 것은 부조리". [Blur.se](https://www.blur.se/2020/07/19/sailmon-max-test/): "디스플레이 햇빛에서 매우 잘 보임, UI 직관적, 다만 문서가 미흡".

**(10) 장기 viability** — 2025-03 Vakaros 인수 확정. MAX/MAX mini 고객 지원은 Vakaros 가 승계. 단기 viability 는 Vakaros 산하로 안정, **MAX 제품군이 Vakaros Atlas 라인과 통합/중단될 가능성에 대한 공식 로드맵은 공개 출처 미확인**.

#### E4. NKE Marine Electronics + 컴패니언 앱

**(1) 포지셔닝·가격·타깃** — 프랑스 35년+ 역사의 [오프쇼어 레이싱 표준](https://nke-marine-electronics.com/) 계기 시스템 — **Vendée Globe/Imoca 등 솔로/오션 레이싱 디폴트**. 가격: 풀 시스템 €3,000~€12,000 (NavXP 차트플로터 기준 [Yachting World](https://www.yachtingworld.com/reviews/gear-reviews/nke-navxp-chartplotter-first-look-nkes-first-chartplotter)). 타깃: 오프쇼어/퍼포먼스 크루저 & 프로 레이서.

**(2) 기능** — 하드웨어: 풍속/풍향, 보트 스피드, 뎁스, 자이로 컴퍼스, **오토파일럿(세계 레퍼런스급)**, TopLine 프로프라이어터리 버스. 프로세서: 트루 윈드 테이블, 폴라, 노이즈 감소. SW: [Display Pro 앱](https://nke-marine-electronics.com/project/nke-display-pro-smartphone-app/) (iOS/Android/Apple Watch), 자동조타 원격제어(GyroPilot), NMEA 0183 데이터로거.

**(3) 알고리즘** — 프로세서 내장 트루윈드 보정, 폴라 기반 타깃 스피드, 캘리브레이션 테이블. 화이트페이퍼는 카탈로그 PDF 수준 ([NKE 영문 카탈로그](https://www.nkeitalia.it/wp-content/uploads/2016/06/Catalogo_NKE_EN.pdf)). **Adrena/Expedition 같은 외부 라우팅 SW 가 데이터를 받아 라우팅 최적화.**

**(4) UX / UI** — Display Pro 앱은 보트 온보드 WiFi 네트워크를 통해 연결. 리뷰에서 [iPhone 크래시 보고, iPad 에서는 안정](http://i-marineapps.blogspot.com/2014/02/nke-marine-display.html). Android 프리미엄 인앱 결제로 파일럿 컨트롤 활성화.

**(5) 데이터 source** — 자체 TopLine 버스 + 외부 NMEA 0183 통합. WiFi Box / N2K Box / Ethernet Box 로 외부 SW 연동.

**(6) 출력 / 공유** — USB Datalog WiFi Box 로 항해 데이터 기록, NMEA 0183 포맷. Adrena Pro v13, Expedition, ScanNav 통합. [Sailmon 이 NKE 호환성 페이지 제공](https://sailmon.com/compatibility/nke/).

**(7) 가격 모델** — 하드웨어 일회성 (시스템 단위 수천 €). Display Pro 앱 기본 무료, Android 프리미엄 인앱 결제로 파일럿 컨트롤·고급 디스플레이 잠금 해제.

**(8) 강점 / 약점** — 강점: **오프쇼어 레이싱 시장 표준, 오토파일럿 신뢰성, Adrena/Expedition 등 라우팅 SW 와의 완성도 높은 연동, 견고한 하드웨어**. **약점**: TopLine 프로프라이어터리 버스 락인, 가격 진입장벽 매우 높음, **앱 UX 는 시대 뒤처짐(2014년 출시 후 큰 리뉴얼 부재), iPhone 크래시 리뷰**.

**(9) 사용자 리뷰** — Sailing Anarchy "NKE with non-proprietary sensors" — 프로프라이어터리 버스 우회 의지가 있으나 진입장벽. Upffront 'Cruise' 패키지 소개 — "오션 레이싱 외에 크루저로도 진출".

**(10) 장기 viability** — 35년+ 프랑스 독립 브랜드, 프로 오프쇼어 레이싱 디폴트 — **사업 안정성 최상**. 다만 디지털/앱 UX 혁신 속도는 Vakaros/Sailmon 대비 느림, 신세대 라우팅·분석 SW(Njord, Vantage) 와의 직접 통합은 공개 출처 미확인.

### 2.F Weather·forecasting 클러스터

> **클러스터 F 핵심 관찰** — 분석 SW 가 아니라 출조 의사결정 도구. 그러나 UX 패턴(모델 비교, 애니메이션 wind flow, alert 시스템) 은 SailTechCo 가 차용 가능. Windyty 는 windy.com 으로 리다이렉트 — 동일 제품. PredictWind 는 offshore passage 표준, Sailflow 는 US 연안 hyperlocal, Windy 는 글로벌 시각화 표준.

#### F1. PredictWind

**(1) 포지셔닝·가격·타깃** — 세일러·요트맨에 특화된 프리미엄 marine forecasting 서비스. **2010년 올림픽 출신·America's Cup 2회 우승자 Jon Bilger 가 창업해 America's Cup 급 weather tech 를 상용화**. 타깃은 cruising·offshore 세일러로, 무료 / Standard US$249/년 / Professional US$499/년 3티어 ([Pricing](https://www.predictwind.com/pricing), [Standard vs Professional](https://help.predictwind.com/en/articles/8563285-predictwind-subscriptions-differences-between-standard-and-professional)).

**(2) 기능** — Forecast horizon 최대 10일, 1km 해안 고해상도, **weather routing(조류·파도·보트 polar 반영)**, departure planning, AIS 실시간 선박 추적, Local Knowledge(유저 팁), GPS Tracking, **GMDSS hazard 경보**, **AI 보트 polar(2025년 도입)** ([AI 도입](https://www.bwsailing.com/cc/2025/12/predict-wind-adds-ai-to-forecast-and-routing-software/)).

**(3) 알고리즘** — 자체 모델 **PWG(PredictWind GFS 기반)·PWE(ECMWF 기반)·PW AI** 를 운용하고, 동시에 ECMWF·UKMO·AIFS·GFS·ICON 을 통합해 라우팅 계산에 모두 활용 ([Forecast Models](https://help.predictwind.com/en/articles/4685434-forecast-models-used-in-weather-routing)). 즉 수집·재계산 하이브리드.

**(4) UX/UI** — **4-up model comparison view (PWG/PWE/ECMWF/GFS 를 한 화면에 동시 표시) 가 시그니처**. 웹과 iOS/Android 앱 모두 동일 그리드 패턴을 차용, "모델이 일치하는가" 를 한눈에 보게 한다. 별도 Offshore 앱은 위성통신 환경 고려 저대역 패키지.

**(5) 데이터 source** — ECMWF, NOAA GFS, UK Met Office UKMO, DWD ICON, ECMWF AIFS 글로벌 모델 + 자체 PWG/PWE/PW AI 재해석 모델. 파도·조류·tide·CAPE·해수온 데이터 통합.

**(6) 출력·공유** — GPX 경로 임포트, weather routing 결과 공유 링크, GPS Tracking 공유 페이지(가족·팀 모니터링), **GMDSS 그래픽·텍스트 경보 export**.

**(7) 가격 모델** — Freemium → Standard US$249/년 → Professional US$499/년. Professional 만 GMDSS·고급 라우팅·DataHub 풀 기능.

**(8) 강점·약점** — 강점: **offshore passage planning 에서 사실상 표준, 멀티모델 비교, 위성 통신 통합**. 약점: 연안·단기 결정에는 과스펙·과가, **서브스크립션 billing·tech support 품질 저하 후기 다수** ([App Store reviews](https://apps.apple.com/us/app/predictwind-marine-forecasts/id477048487?see-all=reviews&platform=iphone)).

**(9) 사용자 리뷰** — iOS 4.80/5(32K 평가). [Trawler Forum](https://www.trawlerforum.com/threads/predict-wind.66231/) 사례: "Neah Bay 에서 NW 5–15kt 예보였는데 실측 S 25kt·gust 40kt — 권고 루트가 위험했을 것". Sailing Anarchy "PredictWind vs SailFlow" 스레드에서 multi-day passage 용으로 호평.

**(10) 장기 viability** — 100만 사용자 돌파, 2025년 AI 라우팅·extreme weather 알림 등 지속 출시, **GMDSS 통합 등 안전 인프라 파트너십 확대로 안정적** ([BoatTEST](https://boattest.com/article/predictwind-launches-world-first-extreme-weather-alerts-enhanced-safety-sea)).

#### F2. Windy.com (구 Windyty.com — 동일 제품, 리다이렉트 확정)

**(1) 포지셔닝·가격·타깃** — 범용 시각 weather 플랫폼. 세일러·카이터·파일럿·윙푸일러 등 wind 의존 활동가들이 무료로 가장 자주 여는 "1차 체크" 도구. **2014년 11월 체코 프라하에서 Ivo Lukačovič(Seznam.cz 창업자) 가 본인의 스노카이팅을 위해 만든 것이 시초이며, 초기 도메인 windyty.com 은 이후 windy.com 으로 통합·리다이렉트** ([Wikipedia](https://en.wikipedia.org/wiki/Windy_(weather_service))). 운영사는 여전히 Windyty, S.E.

**(2) 기능** — Forecast horizon 10일 이상, **50+ 레이어**(wind, gust, waves, CAPE, radar, satellite, air quality 등), **Compare Forecast(동일 지점에서 ECMWF/GFS/ICON 등 모델별 메테오그램 동시 표시)**, Route Planner(시간별 통과지점 weather), **애니메이션 wind/wave/current**. Premium 은 시간단위 step·하루 4회 업데이트·전체 layer 잠금해제.

**(3) 알고리즘** — **자체 모델 없음.** 글로벌·지역 모델을 수집·시각화하는 aggregator. 2020년 meteoblue 지분 인수로 데이터 파트너십 강화 ([Windyty acquires meteoblue](https://www.meteoblue.com/en/blog/article/show/40369_Windyty,+S.E.+Acquires+Majority+Stake+in+meteoblue,+A.G.)).

**(4) UX/UI** — **시그니처는 풀스크린 지도 위 애니메이션 wind particle flow**. Cameron Beccario 의 오픈소스 earth(nullschool) 코드를 기반으로 한 WebGL 파티클 렌더링이 핵심 시각언어. 우측 패널의 메테오그램·시간 슬라이더, 클릭 시 popup forecast 가 표준 패턴.

**(5) 데이터 source** — ECMWF(14km), GFS(22km), ICON, 지역 NEMS·AROME·UKV·ICON-EU·ICON-D2(유럽), NAM·HRRR(미국), ACCESS(호주). 부표·항만 관측소 데이터, **라이브 웹캠 통합**.

**(6) 출력·공유** — URL 공유 링크(지도 줌·layer·시점 보존), Route Planner 결과 공유, embed iframe API, 스크린샷 export. GPX route 를 forecast 와 오버레이하는 기능은 Premium.

**(7) 가격 모델** — **무료 사용 가능**. Premium 연 US$34.99 (2024.12.28부 US$25.99 → US$34.99 인상, UK 는 2025.7.4부 24.3% 인상). **가격 인상에 대한 커뮤니티 반발 큼**.

**(8) 강점·약점** — 강점: **시각화 미적·기능적 표준, 무료 base, 모든 메이저 모델 한자리, 글로벌**. 약점: forecast routing 은 PredictWind 대비 얕고, 보트 polar·해류 통합 약함, AIS·tracking 없음.

**(9) 사용자 리뷰** — Sailing Anarchy: "Windy is better and pretty much still free" ([SA Forum](https://forums.sailinganarchy.com/threads/sailflow-windy-what-you-got.240050/)). 항공 커뮤니티에서도 trip planning 에 보편적. 2024–2025 가격 인상에 대한 커뮤니티 반발이 컸음 ([Premium price hike](https://community.windy.com/topic/37832/new-subscription-pricing)).

**(10) 장기 viability** — Czech 본사 안정 운영, meteoblue 인수로 데이터 supply chain 내재화, 가격 인상으로 수익화 강화. **글로벌 사용자 베이스 압도적이라 viability 매우 높음.**

#### F3. Sailflow

**(1) 포지셔닝·가격·타깃** — **북미(특히 US 연안·호수) 세일러·딩기 레이서 중심의 hyperlocal wind forecast + 실시간 관측 네트워크**. 운영사는 Daytona Beach 소재 WeatherFlow-Tempest, Inc. 이며 SailFlow 는 동사의 iKitesurf·iWindsurf·WindAlert·FishWeather 와 함께 lifestyle 앱 라인업의 하나. **US Sailing 공식 파트너로 강사·레이스 위원회에 Pro 무료 제공** ([US Sailing 발표](https://www.ussailing.org/news/sailflow/)).

**(2) 기능** — **Live wind dot (실측 관측소 + 라이브 그래프)**, Flow Map(애니메이션 forecast wind), 시간단위 메테오그램, **wind alert (임계값·방향·gust 트리거 알림)**, **30년+ wind archive 그래프**, 해수면 current forecast(북미 일부 핵심 지역), pro 기상관측소·hurricane-proof station 접근.

**(3) 알고리즘** — 자체 hyperlocal forecast (Pro forecasts — 로컬 meteorologist 보정) + 표준 글로벌 모델 통합. WeatherFlow-Tempest 는 자사 Tempest 기상관측 하드웨어 네트워크를 운영하므로 **관측 자산도 자체 소유**.

**(4) UX/UI** — 지도 위 색상화된 wind dot(실측 관측소 = 굵은 원, 모델 = 옅은 원) 패턴이 시그니처. 클릭 시 historical wind graph + 현재 풍속·풍향·gust·기온 popup. 모바일 우선 디자인.

**(5) 데이터 source** — **WeatherFlow 자체 관측 네트워크 + Tempest 사용자 weather station 데이터**, 표준 NAM/HRRR/GFS, 일부 지역에서 자체 보정 Pro forecast.

**(6) 출력·공유** — 관측소 historic graph URL 공유, alert 이메일·푸시·SMS. GPX 기반 경로 forecast 오버레이 기능은 (공개 출처 미확인).

**(7) 가격 모델** — Free / Plus / Pro / Gold 4단계. Free 에도 무제한 alert 포함, Plus 는 고급 모델, Pro 는 hyper-accurate 자체 forecast + Pro/허리케인 강건 관측소 접근, Gold 는 1:1 expert 서포트 + WINDMeter 1대/년. 구체 가격은 (공개 출처 미확인).

**(8) 강점·약점** — 강점: **미 연안 관측소 밀도 최고, historical wind archive, alert 시스템, US Sailing 공식 파트너십**. 약점: **미국 외 커버리지 약함**, 시각언어가 Windy 대비 구식, offshore routing·라우팅 기능 부재.

**(9) 사용자 리뷰** — Sailing Anarchy: "Pro 가입자가 ≈3× 더 많은 관측소·고빈도 업데이트 접근, 의심스러운 날 보트장 가지 않아 절약한 휘발유로 본전 뽑음". "Sailflow 의 historical wind graph 는 다른 앱에 없는 장점". billing·구독 자동갱신 불만 다수.

**(10) 장기 viability** — 모회사 WeatherFlow-Tempest 가 2024년 본사 Daytona Beach 이전·growth capital 확보, StartEngine·Wefunder community round 진행 중으로 자본조달 활발. **단 단일 사업이 아닌 lifestyle 앱 포트폴리오 중 하나라 자원 우선순위는 변동 가능.**

---

## 3. 기능 비교 매트릭스

> 35 개 제품 × 50+ 기능. CSV·xlsx 동봉 (`site/_research/sailing_analytics_feature_matrix.csv` · `.xlsx`).

_[Cluster audit 완료 후 작성]_

---

## 4. 알고리즘 깊이 비교 (Sports Science Researcher 주도)

> 각 제품이 제공하는 분석 (wind reconstruction · VMG · polar · maneuver loss · target % · routing) 의 **수학적 정합성** 평가. 공개 docs/논문/patent 기반 reverse-engineer + 결과의 한계 인정.

_[Cluster audit 완료 후 작성]_

---

## 5. UX 인사이트 (DataViz + UX Researcher 주도)

> 시각 언어·인터랙션 패턴·온보딩 flow·리뷰·사용자 평점의 정량 정성 합성.

_[Cluster audit 완료 후 작성]_

---

## 6. 갭 분석 + Moat 제안 (종합)

> "아무도 안 하는 영역" + Danny 의 "차원이 다른 서비스" 비전에 맞는 moat 후보 5~10 개. Ambitious 하면서도 fact 기반.

_[Cluster audit 완료 후 작성]_

---

## 7. 출처 (References)

_[Cluster audit 진행 중 누적]_

---

## 부록 A. Audit 메서드론

### A.1 데이터 수집 출처 우선순위

1. **1차 출처** — 공식 제품 사이트, 공식 User Guide / docs, 공식 white paper, 공식 patent.
2. **2차 출처** — App Store / Google Play 의 공식 설명 + 사용자 평점, YouTube 공식 채널 시연.
3. **3차 출처** — 제3자 사용자 리뷰 (Sailing Anarchy forum, Reddit r/sailing, sailing magazine 리뷰 — 정량 데이터 우선).
4. **출처 미확인 항목** — "(공개 출처 미확인)" 명기 후 가능한 합리적 추론은 별도 표시 ("(추론 — 출처 부재)").

### A.2 Fabrication 회피 규칙 ([[feedback_strict_fact_verification]])

- 가격·시장 점유율·사용자 수 등 정량 수치는 **명시 출처 없으면 인용 금지**.
- 알고리즘 reverse-engineer 는 공개 docs 의 직접 인용 또는 patent 청구항 기반. "추정" 명기.
- 사용자 리뷰는 **정량 평점 (App Store stars · Reddit 게시글 수) 우선**, 정성 코멘트는 출처 URL.

### A.3 클러스터 분류 한계

분류 경계가 모호한 제품 (Vakaros·Njord·Quatix) 은 §1.3 에 명시. 매트릭스에서는 cross-reference.

### A.4 우리 제품 (라이딩 통계 대시보드) 의 위치

본 audit 은 *외부 시장* 만 다룬다. 우리 제품의 현 기능은 `Njord_Analytics_벤치마크_갭분석_2026-05-22.md` §4·§8 에 정리되어 있으며, §6 의 moat 제안에서만 비교 참조한다.

---

_(이 문서는 audit 진행에 따라 점진적으로 채워진다. 각 클러스터 완료 시 milestone 보고.)_
