#### A4-Deep. Deckman by B&G — Tier 0 심층 audit (Danny 7-axis)

> **사전 정정.** Danny 의 브리핑에서 "Dr. Stuart Winn" 으로 명명되어 있으나, B&G 공식 블로그(["A short history of Sailing Instruments – Part 3"](https://www.bandg.com/en-gb/blog/racing/americas-cup/a-short-history-of-sailing-instruments---part-3/)) 및 [The Daily Sail 인수 기사](http://www.thedailysail.com/general/04/33574/graeme-winns-wave-technology-processor-and-deckman-for-windows-acquired) 에 따르면 정확한 인물명은 **Dr. Graeme Winn** (Sailmath 창업자, Victory 1983 신디케이트 instrument SW 개발). 본 audit 에서는 이후 "Dr. Winn" 표기. "Stuart" 표기는 baseline card 인용에만 보존. 학술 papers 는 공개 출처 미확인 — Winn 은 statistician/programmer 백그라운드이지 academic publication 트랙은 아닌 것으로 추정.

#### §1. 풍향 재구성 / wind 처리 (Dr. Winn AC 알고리즘 유산)

Deckman 의 가장 깊은 differentiator 는 알고리즘 자체보다 **계보 (lineage)** 에 있다. B&G 공식 블로그 [Part 3 — A short history of Sailing Instruments](https://www.bandg.com/en-gb/blog/racing/americas-cup/a-short-history-of-sailing-instruments---part-3/) 와 [Part 2](https://www.bandg.com/en-gb/blog/racing/americas-cup/a-short-history-of-sailing-instruments-part-2/) 가 명시한 핵심:

- **1983 — Victory syndicate (영국 AC 챌린저)** instrument 시스템 개발 과정에서 Dr. Graeme Winn (당시 통계학자/프로그래머) 이 **Sailmath Deckman** 이라는 6kg 의 "custom built tactical racing computer" 제작. **처음부터 PC 소프트웨어가 아니라 전용 하드웨어**.
- **1987** — Winn 이 Deckman 상용 라인 시작. **1988** 에 이미 isochronal weather routing (wind + current + tide 입력) 을 HP 6800 기반 휴대 디바이스에서 동작 — 동시대 plotter + 종이 차트 routing 대비 압도적 advance.
- **1988 — Blue Arrow America's Cup challenge** — Winn 의 Sailmath 가 **rate gyro + accelerometer 를 sailing instrument 에 처음 적용**. motion correction 의 시작점, 1995 AC Spanish 팀의 초기 WTP (Wave Technology Processor) 기반.
- **2000년대 초** — Winn 이 다른 사업으로 옮기면서 Sailmath 제품군이 B&G 로 인수. [The Daily Sail 인수 기사](http://www.thedailysail.com/general/04/33574/graeme-winns-wave-technology-processor-and-deckman-for-windows-acquired).

블로그 단호하게 명시: *"Dr Winn's maths – with its America's Cup algorithms and formulations – is at the heart of every wind direction and wind speed presented by a B&G sailboat instrument system."* → **B&G 전체 인스트루먼트 라인의 풍향 처리는 Winn 의 수학을 상속**받았고, Deckman 은 그 수학을 직접 set-and-tune 하는 navigator-facing layer.

**기술적 핵심 — 무엇이 "Winn 수학" 인가:**

1. **Motion correction (heel + pitch + yaw rate)** — 마스트 끝 wind wand 는 boat 의 회전 운동만큼 apparent wind 를 왜곡. Sailmath 1988년 혁신은 rate gyro 가 측정한 angular velocity 를 wind vector 에서 subtract. [Cruisers Forum Deckman vs Expedition](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html) 다수 포스트: *"Deckman is the bottom-up approach engineered from data to user; Expedition is top-down from UI to instrument"* — 이 bottom-up = raw sensor → motion-corrected true wind chain 을 navigator 가 calibration 가능.

2. **Upwash + mast twist correction tables** — masthead 풍속계는 (a) sail tip vortex (upwash) 와 (b) mast lateral twist (rigging load) 로 왜곡. [Sailing Anarchy B&G upwash calibration](https://forums.sailinganarchy.com/threads/b-and-g-upwash-calibration.22831/) 가 정리: **aerodynamics 효과는 light air 에서, mast twist 는 heavy air 에서 dominant, 보통 12–15 kn 부근에서 cancel-out**. Deckman 은 두 효과를 **TWA 와 TWS 함수의 multi-dimensional correction table 로 보정** ([B&G Deckman User Manual p. 25, p. 111](https://www.manualsdir.com/manuals/599961/bg-deckman.html)).

3. **TWD/TWS damping** — 단순 vector 차이로 계산한 true wind 는 boat motion 때문에 매우 noisy. Hercules / WTP3 와 결합된 Deckman 은 **속도와 wind angle 변화율 기반 adaptive damping** 적용 (알려진 사실), 정확한 filter family (Kalman, Butterworth, exponential moving average) — 공개 출처 미확인.

4. **CAN-bus 기반 sensor fusion** — [B&G WTP3 spec](https://www.bandg.com/bg/series/wtp3/): WTP3 는 **3개 독립 CAN 채널 (각 1 Mbit/s)** 에서 dozens of sensors (multiple wind wands, multiple speedos, multiple compasses) 입력 → fusion 결과를 LAN 으로 Deckman 송신. Deckman 은 fusion 결과 받는 동시에 **자신의 calibration table 을 instrument 시스템에 역방향 push** (Deckman 화면에서 calibration 변경 → WTP3 가 다음 frame 부터 계산).

**Hercules WTP 의 Python scripting** — [B&G Hercules WTP](https://www.bandg.com/bg/type/instruments/hercules-wtp/) 명시: "Python scripting allowing users to script custom variables and calibration routines". wind 처리의 user-customisation layer 가 두 곳:
- Hercules WTP / WTP3 안: **Python** custom variable / calibration routine
- Deckman 안: **.NET (C#/VB.NET)** add-in

이중 customisation 이 Deckman 생태계의 가장 큰 강점이자, 평균 사용자가 setup 을 포기하게 만드는 장애.

**한 줄.** Deckman wind layer = 1980년대 AC 의 motion-corrected true wind 알고리즘을 그대로 상속한 instrument-level 수학 + navigator 가 .NET / Python 으로 후처리를 끼울 수 있는 dual-layer 아키텍처. 수식 자체는 proprietary.

#### §2. 외부 날씨 데이터 통합 (GRIB · tide · current)

[B&G Deckman 제품 페이지](https://www.bandg.com/en-gb/deckman/) + [Sail-World Deckman 9 announcement](https://www.sail-world.com/-48313/) 종합:

- **GRIB 멀티-모델 애니메이션** — wind, pressure, precipitation, wave height 의 GRIB 함께 로드하고 시간 슬라이더로 animate. PredictWind / NOAA GFS / ECMWF 등 다중 모델 동시 로드.
- **Tide / Current** — 별도 [Tides SHOM Vendée Gironde](https://www.tradeinn.com/waveinn/en/b-g-deckman-tides-shom-vendee-gironde/589867/p) 같은 **국가별 / 지역별 tide database 모듈** 옵션 구매. base Deckman 은 전 세계 tide 기본 포함 안 함 — 지역 module BGP-style 라이선싱.
- **Weather Routing 모듈** — [제품 페이지](https://www.bandg.com/en-gb/deckman/): *"online weather routing service, powered by PredictWind"*. **routing input 으로 PredictWind 가 1st-party 통합**.
- **Wave height avoidance routing** — Optimum Routing 모듈은 **사용자 정의 max wave height threshold** 입력받아 그 임계값 이상 cell 을 routing 그래프에서 제외 또는 큰 cost penalty. [Sail-World](https://www.sail-world.com/-48313/): *"increasing speed and reducing the risk of damage to the boat offshore."* 단순 "rough water avoidance" 가 아니라 폴라가 가정한 flat-water 성능이 무너지는 zone 을 routing 단계에서 가지치기.
- **AIS 오버레이 (v9 부터)** — Class A/B transceiver position/course/speed 를 chart layer 에 overlay.
- **C-MAP 차트** — USB 패키지에 라이선스 포함 + raster + vector 표시.

**Routing 알고리즘.** 1987–88 시점부터 Winn 의 Deckman 은 **isochronal routing** (등시선법) — 매 시간 step 마다 모든 가능한 heading 으로 sail 한 후 같은 시간에 도달 가능한 점들을 연결해 "isochrone wavefront" 만들고, wavefront 외곽 점들을 다음 step 출발점으로. 현 버전이 isochrone 만 사용하는지, 아니면 dynamic programming / Dijkstra-on-graph hybrid 인지 — 공개 출처 미확인. 단 wave-cell exclusion 가능 → **graph-based variant** 추정.

**한계** — Deckman cloud-side weather 처리는 PredictWind subscription 의존. 자체 ensemble 처리나 nowcast 보정 (assimilation) 없음. weather "본체" 는 외부 vendor, Deckman 은 그것을 polar 와 결합해 라우팅하는 정밀 엔진.

#### §3. 폴라 / target 곡선

Deckman 폴라 처리는 **multi-polar architecture** 가 핵심:

- **Target polar vs Navigation polar 이중화** — [Cruisers Forum](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html) + manual: *"Deckman allows the use of multiple polar tables, one for performance targets and one for navigation."*
  - **Performance target polar**: 크루가 "100% 성능 목표로 hit 해야 할 이상치". 보트 디자이너 / VPP 가 만들어준 이론치 그대로 유지.
  - **Navigation polar**: routing 알고리즘이 실제 사용하는 실측 조정된 polar. Navigator 가 race 중 boat 의 실제 폴라 부진 (sail 마모, 크루 피로, 트림 비최적) 을 반영해 dial-down 가능.
  - 분리 덕에 routing 결과는 "현실적", 표적 표시는 "이상적" → 크루는 항상 좀 더 높은 목표를 보면서 sail.
- **저장 polar 멀티 — 환경별 swap** — 같은 보트에서 *"choppy vs flat water"*, *"light vs medium vs heavy air"*, *"#1 vs #2 jib"* 등 환경별 polar 디스크 저장 + race 직전 swap.
- **Polar 표 내부 구조** — [manualsdir Deckman 매뉴얼 p. 101](https://www.manualsdir.com/manuals/599961/bg-deckman.html?page=101): *"wind speeds in a column going down the left of the table, and five pairs of data points going across defined as v1, a1 ... v5, a5; where v1 is the boat speed at point 1 and a1 is the wind angle."* → **한 줄에 TWS 1개 + (boat speed, TWA) 5 페어** — 5개 sail mode 별 polar curve 를 sparse 하게 정의 후 spline interpolation 하는 표준 yacht-design VPP 출력 포맷.
- **Polar Learning (자동 학습)** — [Sailing Anarchy Polar Learning](https://forums.sailinganarchy.com/threads/deckman-polar-learning.89715/) 가 Deckman 이 실측 운항 데이터로부터 polar 일부 cell 을 자동 update 할 수 있음 시사. 알고리즘 (median filter? percentile envelope?) 공개 출처 미확인.
- **Speed Tests (sail comparison)** — [B&G 페이지](https://www.bandg.com/en-gb/deckman/): *"single boat testing, such as a comparison of headsails, is accomplished by running Speed Tests to allow statistical comparison of one sail versus another, with a polar table overlay."* → 같은 조건 두 sail 의 boat speed 분포를 polar overlay 위에 통계 비교 모듈.

**한계** — polar 의 **physics-based source (VPP / RANS CFD)** 자체는 Deckman 외부 도구 (WinDesign VPP, ORC VPP) 에서 만들어 import. Deckman 은 polar **창고이자 학습기**이지 **계산기 아님**. polar 변동을 sail trim / heel / leeway 함수로 분해하는 multi-dimensional polar — 공개 출처 미확인.

#### §4. 회전 손실 / tack analysis

Deckman tack analysis 는 직접 명명된 단일 모듈이 아니라 **Datalog & Analysis + Speed Tests + Polar Learning** 결합으로 구현.

- **Datalog & Analysis** — [Owen Clarke Design](https://www.owenclarkedesign.com/Racing-yacht-performance-data-logging-analysis) 가 racing yacht 분석에서 Deckman 이 KND Sailing Performance / Expedition 과 함께 표준 도구로 사용 명시. WTP3 내장 **on-board datalogger** ([B&G WTP3](https://www.bandg.com/bg/series/wtp3/) — *"operates an on-board datalogger for post-sail data analysis"*) 가 1차 raw data 저장소, Deckman 이 후처리/시각화.
- **Tack/Gybe 손실 측정** — tack 직전 t-30s 평균 boat speed → tack 후 boat speed 가 target polar 의 (1 − ε)% 까지 회복하는 시간 t_recovery → 그 사이 distance loss against TWD-aligned reference course. 자동 detection 으로 동작하는지 manual range 잡는지 공개 출처 미확인. 단 datalog time-series 위에 cursor 두 개 놓고 "between cursors" 평균 보는 워크플로우는 [Sailing Anarchy](https://forums.sailinganarchy.com/threads/best-tactical-software.17262/) confirm.
- **What If? 모듈** — RacePanel Part 4 ([B&G blog](https://www.bandg.com/blog/racepanel-series-with-mark-chisnell-part-4-what-if/)): 단순한 wind shift / tide 가정만이 아니라 **"current leg 위에서 만약 wind 가 N도 shift 했다면 layline 까지 시간은?"** 형태 leg-level scenario simulation. tack 손실은 직접 input 이 아니지만, *몇 도 shift 까지 그 leg 에서 추가 tack 없이 mark 도달 가능한가* 형태로 우회 분석. 단순 회전 손실 계산보다 한 차원 위의 **decision support**.
- **Tack timing 사전 추천** — Deckman enhanced graphics 의 **shaded limit layline sectors** ([B&G 페이지](https://www.bandg.com/en-gb/deckman/)) 는 wind shift 통계적 envelope 안에서 가능한 layline 부채꼴 그려, navigator 가 어떤 shift 가 와도 lay over-stand 하지 않는 안전 tack point 시각으로 잡게 한다.

**핵심 차별** — Deckman tack analysis = *post-mortem (사후 분석)* 보다 *real-time decision support* — Expedition / KND 가 매 tack 손실 metrics 를 numerical 자동 산출하는 데 비해, Deckman 은 *navigator 가 datalog 직접 끊어 보는* manual analysis 의 강력함 + *limit layline + What If* forward-looking 지원.

#### §5. 통계 패널 / 인스트루먼트 readout (Start Line Live View 등)

**Start Line Live View** — Deckman most-cited 인터랙티브 모듈. RacePanel Part 2 ([B&G blog](https://www.bandg.com/blog/racepanel-2/)) + [Navico Start Line Advantage](https://navico.com/2015/08/10/start-line-advantage-for-sailors-with-bg-racepanel/):

1. **Line bias 계산** — 두 ping (pin end + boat/RC end) 으로 line 정의 → 현재 TWD 와의 각도 차로 어느 끝이 favored 인지 → **Bias Advantage in meters** ("favored end 가 windward mark 에 22.9 m 더 가깝다") 표시.
2. **Time-to-line** — boat 현재 position + polar + TWS·TWA 로 *현재 heading 으로 sail 했을 때 line 닿는 시각* micro-simulation. **Zero Burn Line** = *"if you are sailing at full speed and keep going flat out, you will be right on time at the line with no more time to waste"*.
3. **Polar 의존성 명시** — *"to work out sailing time to the start line, the software needs to know the boat's polars."*
4. **Gain/loss against favored end** — favored end 와 currently-projected line crossing 의 거리 차이 실시간 표시.

**Advanced WindPlot** — RacePanel Part 3 ([B&G blog](https://www.bandg.com/blog/racepanel-series-with-mark-chisnell--part-3/)) — **time-series TWD 와 그 통계적 mean / oscillation envelope 함께 표시** → navigator 가 *"지금 우리는 phase 의 lifted 쪽인가 headed 쪽인가"* 즉시 판단. shift periodicity (oscillation vs persistent) 시각 진단.

**SailSteer** — RacePanel Part 5 ([B&G blog](https://www.bandg.com/en-gb/blog/racepanel-series-with-mark-chisnell-part-5-sailsteer/)) — *"Magnetic or True reference beside the time on port (P) and starboard (S) tacks to the waypoint; total sailing time (TTW-S); total sailing distance (DTW-S); waypoint bearing (WPT BRG); and depth."* 한 화면 *"양 tack 비교"* 가 시간/거리/베어링으로 — short-handed sailor helm 에서 즉시 활용.

**What If? Predictive Display** — RacePanel Part 4 — 단일 화면에 *Heading / COG / Boat Speed / SOG / TWA / AWA / AWS / Distance / Time left on leg* + user-overrideable 입력값. *"엄지 손가락으로 wind 를 8도 shift 시켰을 때의 TWA 가 무엇이 되는가?"* 즉시 보임.

**인스트루먼트 시스템과의 양방향** — Deckman 이 chartplotter / mast display / steering pedestal display 로 layline angle, target speed, distance to mark, optimal heading 직접 push. **양방향성 (LAN over WTP3) 이 Expedition 과의 가장 큰 architectural 차이** — Expedition 은 일반적으로 NMEA 0183/2000 receive-only, Deckman 은 B&G 인스트루먼트의 *"제어 콘솔"* 로 동시 동작.

#### §6. 리플레이 시각 언어 (race replay + data analysis)

여기가 Deckman 의 **상대적 weak spot**.

- **Post-sail data analysis** — WTP3 의 on-board datalogger 가 raw 데이터 저장소. Deckman 이 reload 해 chart 위 trail 로 표시, 시간 cursor 로 임의 구간 통계 — 단 UI 는 "Windows 시대 초기의 차분한 grid+table".
- **Race replay 의 modern animation** — RaceQs / SAP Sailing Analytics / Velocitek 의 web-based playback 같은 *"애니메이션된 multi-boat replay + 텔레스트레이션"* Deckman 에 **없다**. (공개 출처 미확인 — marketing material 에 미언급).
- **Competitor handicap 트래킹** — [B&G 페이지](https://www.bandg.com/en-gb/deckman/): *"competitor handicap"* 모듈. AIS / VHF / 무선으로 경쟁 보트 시간 받아 handicap-corrected gap 실시간 표시. replay 단계 함께 plot 가능.
- **Chart drafter / sail chart drafter** — [3rd-party *Sail Chart Drafter for Deckman v.2*](https://www.sailingperformer.com/public/dwnld/sp_scd/sailchartguide.pdf) 별도 존재. Deckman 본체 chart drafting 부족 → community 보완.
- **시각 언어 미학** — [Cruisers Forum](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html): *"Expedition is the best looking software with a fully developed Windows 7 feel and good user interface."* Deckman 시각 언어는 기능보다 *심미적으로 dated*.

**총평.** Deckman DNA = *"navigator 가 race 중에 보는 도구"*, *"코치 / 선수단이 race 후에 회고 학습하는 도구"* 영역에는 KND Sailing Performance / Cosworth Performance Tool / 별도 datalog visualization SW 가 들어선다. *during-race* 의 grand prix navigator 워크플로우 최적화 trade-off → *after-race* 의 video-grade replay 와 storytelling 도구는 의도적으로 외부 ecosystem 위탁.

#### §7. 가격·라이선스·사용자 base·운영

**가격 구조:**

| 항목 | 가격 | 출처 |
|---|---|---|
| **Base Tactical PC** (USB dongle + C-MAP 차트 라이선스 포함) | **US $1,695** | [gps4us SKU](https://www.gps4us.com/BandG-Deckman-Tactical-PC-software-C-AP-USB--P7763.html), [SailRACE](https://www.sailrace.com/en-us/products/bandg-deckman-usb) |
| **Upgrade — +2 version step** | **€754.05** | [Tradeinn waveinn](https://www.tradeinn.com/waveinn/en/b-g-deckman-upgrade/589870/p) |
| **Upgrade — +3 version step** | (공개 출처 미확인) | [SailRACE](https://www.sailrace.com/b-and-g-deckman-upgrade-3-version-step/) |
| **C-MAP USB 옵션** | (정확 가격 미명시) | [Tradeinn](https://www.tradeinn.com/waveinn/en/b-g-deckman-c-map-usb/589864/p) |
| **지역별 Tide DB add-on** | 예: Tides SHOM Vendée Gironde | [Tradeinn SHOM](https://www.tradeinn.com/waveinn/en/b-g-deckman-tides-shom-vendee-gironde/589867/p) |
| **구독** | **없음** | 일회성 라이선스 + 메이저 버전 업그레이드 결제 |

**라이선스 방식** — USB dongle (하드웨어 키). PC 망가져도 dongle 있으면 다른 PC 에서 동작 — navigator 가 race PC + backup PC 동시 운영 grand prix 워크플로우 호환. dongle 분실 = 라이선스 분실.

**운영 / 모기업:**
- **B&G** — 1955년 영국 Brookes & Gatehouse 출발. 2007년 이후 **Navico** 의 일부. **2021년 Brunswick Corporation 이 Navico Group 을 $1.05B 인수** ([Boat Industry](https://www.boatindustry.com/news/37377/brunswick-group-pays-1-05-billion-for-marine-electronics-major)). 모기업 체인: Sailmath (Winn) → B&G → Navico → Brunswick.
- **상품 상태** — [Sailing Anarchy](https://forums.sailinganarchy.com/threads/alternatives-to-expedition-for-b-g-comms.193672/) 의 한 user: *"Deckman is a dead product"* 단정. 단 [B&G 공식 페이지](https://www.bandg.com/en-gb/deckman/) 는 여전히 active SKU 노출 + RacePanel 블로그 시리즈 2015–2020 지속 게시 → "공식적으로 maintained, 그러나 메이저 신규 기능은 H5000 인스트루먼트의 firmware level 에 집중되어 상대적으로 stale".
- **OEM 통합** — [Brunswick Navico OEM 재편](https://www.boatindustry.com/news/41109/brunswick-puts-navico-brand-back-at-the-heart-of-its-oem-strategy) — Navico 를 OEM 핵심으로 가져갔고, 결과적으로 Deckman 같은 niche pro tactical SW 는 *consumer chartplotter (Zeus / Vulcan)* mass-market 라인보다 우선순위 낮아진 것으로 추정 (공개 출처 미확인).

**.NET 확장성 — Deckman 의 가장 독특한 architectural moat:**

[Cruisers Forum](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html) 핵심 평가: *"Deckman is described as the most powerful software, as the user can write his own .Net add-ins for the code."*

- Deckman 은 **own application 안에 user-written .NET assembly 를 plug-in 으로 로드**. 사용자 (또는 sailing-team in-house developer/consultant) 가 C# 또는 VB.NET 으로 모듈 작성 → boat 데이터 접근·계산·결과 Deckman UI 표시.
- .NET API 의 공식 문서가 **B&G developer portal 등에서 공개되어 있는지** — 공개 출처 미확인. 일반 retail 사용자는 접근 어렵고, B&G grand prix 지원 엔지니어 또는 navigator-developer 비공식 커뮤니티에서 share 추정.
- Hook 가능 영역: 데이터 stream (boat speed / TWS / TWD / GPS / heading), polar table, layline / target curve 계산, chart overlay drawing, custom event triggers. 정확한 hook 인터페이스 카탈로그 공개 출처 미확인.

**비교축으로서의 Expedition** — Cruisers Forum: *"Deckman was created by B&G to extend the capabilities of the Hydra/Hercules system. Expedition was created to support navigation of race boats. Deckman is a bottom up approach engineered from the data to the end-user; Expedition is a top down approach from the user interface down to instrumentation."*

- Deckman = **데이터 layer 가 먼저 만들어지고, navigator 가 그 위에 자신의 UI / 분석을 .NET 으로 쌓는** "엔진 + SDK" 형 제품.
- Expedition = **UI / 워크플로우가 먼저 만들어지고, 그 안에서 가능한 분석을 강력하게 제공하는** "완성된 application" 형 제품.

**사용자 base 추정 (공개 출처 미확인 부분 큼):**
- **Volvo Ocean Race / The Ocean Race**: 다수 boats Deckman 사용 — [Sailing Gadgets](https://sailinggadgets.wordpress.com/2009/07/29/there-is-marine-navigation-software-and-sailing-software/) 등.
- **America's Cup** (특히 2007 이전): IACC 보트 다수 B&G WTP + Deckman.
- **현대 (2024–2026)**: IMOCA 60 / Mini Transat / Ultim 는 Adrena 우세, AC75 는 자체 SW, Deckman active grand prix 점유율은 줄어든 것으로 추정.
- **Korea 정식 distributor**: B&G 한국 distributor 는 cruising 라인 (Vulcan/Zeus, 트랜스듀서) 위주. **Deckman 전용 한국 정식 distributor 공개 출처 미확인** — international reseller (Tradeinn / SailRACE / gps4us) cross-border 구매 또는 B&G European/HK distributor indirect 채널이 현실.

**Mark Chisnell 위치** — Chisnell 은 다수 sailing 책 ([*Sail Smart*](https://www.amazon.com/Sail-Smart-Understand-Instruments-Faster/dp/1119942373), [*Mastering Data to Win*](https://us.amazon.com/Mastering-Data-Win-Understand-instruments/dp/1912621665)) 저자 + B&G *de facto* navigator 교육 콘텐츠 책임자. RacePanel 시리즈 5부 ([Part 1](https://www.bandg.com/blog/racepanel-1/) / [Part 2 Start Line](https://www.bandg.com/blog/racepanel-2/) / [Part 3 WindPlot](https://www.bandg.com/blog/racepanel-series-with-mark-chisnell--part-3/) / [Part 4 What If](https://www.bandg.com/blog/racepanel-series-with-mark-chisnell-part-4-what-if/) / [Part 5 SailSteer](https://www.bandg.com/en-gb/blog/racepanel-series-with-mark-chisnell-part-5-sailsteer/)) = *사실상 RacePanel 모듈의 user manual + algorithmic explainer hybrid* — **Deckman 의 algorithmic transparency 의 1차 publicly-readable source**.

#### Cross-axis 종합 — Deckman 정체성과 SailTechCo 의 함의

1. **유산성 (Heritage)**: Dr. Graeme Winn 1983 AC 수학이 B&G 인스트루먼트 전체 wind 솔루션에 그대로 살아있고, Deckman 은 그 수학을 가장 가까이서 만질 수 있는 navigator 도구. **lineage 가 곧 marketing moat** — 신규 SaaS 가 단기 복제 불가.
2. **개방성 (Extensibility)**: 알고리즘은 닫혀있지만 **.NET add-in + Hercules Python script** 의 dual extensibility 가 grand prix 팀이 Deckman 을 떠나지 못하게 만든다. Expedition 의 LUA scripting 보다 깊은 통합.
3. **UX 부채**: Windows 7/8 시대 dense grid + table UI 가 그대로 남아 진입 장벽 점점 높아짐. Cruisers Forum 의 *"가장 강력하지만 Expedition 이 사용하기 편함"* 평가 본질.
4. **운영 위상**: Brunswick 산하 Navico OEM 전략 재편에서 Deckman 은 pro niche 로 남되, 메이저 신규 기능은 H5000 / Zeus 라인 RacePanel 모듈로 옮겨가는 동향. *standalone Deckman SW 의 미래* 는 *B&G 인스트루먼트 위 RacePanel 동향* 과 분리 불가.
5. **SailTechCo 시사**:
   - 한국 시장에 Deckman 풀세트 (USD $1,695 + 인스트루먼트 시스템) 권유는 *grand prix offshore (Sydney Hobart, Korea Cup IRC) 출전 보트* 가 아니면 over-spec.
   - 단무지공방 자체 분석 도구 (VanaWaters 알고리즘 + 단무지 컨버터) 가 ***Deckman 의 "데이터 layer + 후처리 .NET" 의 정신을 lighter-weight cloud 로 옮기는*** 형태 — "Deckman architectural 정신을 SaaS 로 번역" 포지셔닝 가능.
   - Reseller 채널 가격대 일관성 ($1,695 / £1,200 / €754 upgrade) → 단무지공방이 *국내 fleet Deckman 사용자 surveying* 의 baseline 활용.

#### 부록. 출처 일람

- **§1 Wind / Winn 유산**: [B&G Blog Part 3](https://www.bandg.com/en-gb/blog/racing/americas-cup/a-short-history-of-sailing-instruments---part-3/) / [Part 2](https://www.bandg.com/en-gb/blog/racing/americas-cup/a-short-history-of-sailing-instruments-part-2/) / [Daily Sail Acquisition](http://www.thedailysail.com/general/04/33574/graeme-winns-wave-technology-processor-and-deckman-for-windows-acquired) / [SA upwash calibration](https://forums.sailinganarchy.com/threads/b-and-g-upwash-calibration.22831/) / [B&G WTP3](https://www.bandg.com/bg/series/wtp3/) / [B&G Hercules WTP](https://www.bandg.com/bg/type/instruments/hercules-wtp/) / [Deckman User Manual via manualsdir](https://www.manualsdir.com/manuals/599961/bg-deckman.html)
- **§2 Weather/GRIB/Tide**: [B&G Deckman](https://www.bandg.com/en-gb/deckman/) / [Sail-World Deckman v9](https://www.sail-world.com/-48313/) / [Tradeinn SHOM SKU](https://www.tradeinn.com/waveinn/en/b-g-deckman-tides-shom-vendee-gironde/589867/p)
- **§3 폴라**: [Cruisers Forum vs Expedition](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html) / [SA Polar Learning](https://forums.sailinganarchy.com/threads/deckman-polar-learning.89715/) / [manualsdir p.101](https://www.manualsdir.com/manuals/599961/bg-deckman.html?page=101)
- **§4 Tack analysis**: [Owen Clarke Design data logging](https://www.owenclarkedesign.com/Racing-yacht-performance-data-logging-analysis) / [B&G WTP3 datalogger](https://www.bandg.com/bg/series/wtp3/) / [RacePanel Part 4 What If](https://www.bandg.com/blog/racepanel-series-with-mark-chisnell-part-4-what-if/) / [SA Best Tactical Software](https://forums.sailinganarchy.com/threads/best-tactical-software.17262/)
- **§5 통계 패널**: [RacePanel Part 2 Start Line](https://www.bandg.com/blog/racepanel-2/) / [Navico Start Line](https://navico.com/2015/08/10/start-line-advantage-for-sailors-with-bg-racepanel/) / [Part 3 WindPlot](https://www.bandg.com/blog/racepanel-series-with-mark-chisnell--part-3/) / [Part 5 SailSteer](https://www.bandg.com/en-gb/blog/racepanel-series-with-mark-chisnell-part-5-sailsteer/)
- **§6 Replay**: [B&G WTP3](https://www.bandg.com/bg/series/wtp3/) / [Cruisers Forum 평](https://www.cruisersforum.com/forums/f13/deckman-vs-expedition-275694.html) / [3rd-party Sail Chart Drafter](https://www.sailingperformer.com/public/dwnld/sp_scd/sailchartguide.pdf)
- **§7 가격/운영/.NET**: [gps4us $1,695](https://www.gps4us.com/BandG-Deckman-Tactical-PC-software-C-AP-USB--P7763.html) / [SailRACE](https://www.sailrace.com/en-us/products/bandg-deckman-usb) / [Tradeinn Upgrade €754](https://www.tradeinn.com/waveinn/en/b-g-deckman-upgrade/589870/p) / [Boat Industry Brunswick 인수](https://www.boatindustry.com/news/37377/brunswick-group-pays-1-05-billion-for-marine-electronics-major) / [Boat Industry Navico OEM](https://www.boatindustry.com/news/41109/brunswick-puts-navico-brand-back-at-the-heart-of-its-oem-strategy) / [SA alternatives](https://forums.sailinganarchy.com/threads/alternatives-to-expedition-for-b-g-comms.193672/) / [Chisnell *Sail Smart*](https://www.amazon.com/Sail-Smart-Understand-Instruments-Faster/dp/1119942373) / [Chisnell *Mastering Data to Win*](https://us.amazon.com/Mastering-Data-Win-Understand-instruments/dp/1912621665) / [RacePanel Part 1](https://www.bandg.com/blog/racepanel-1/)

**공개 출처 미확인 항목 (요약):** Deckman 정확한 true-wind damping filter family (Kalman vs EMA), .NET API 공식 reference 문서 (public/private 여부), polar learning 의 정확한 통계 알고리즘, Korea 정식 distributor, race replay animation 모듈 존재 여부, optimum routing internal graph 구조.
