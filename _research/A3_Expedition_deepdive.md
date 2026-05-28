#### A3-Deep. Expedition — Tier 0 심층 audit (Danny 7-axis)

> **요약 명제 (one-liner):** Expedition 은 1995년 Nick White (Whitbread 우승 / Volvo Ocean Race 네비게이터) 가 단독으로 시작해 30년간 단일 개발자 모델로 운영되어 온 Windows 전용 "프로 레이스 항법 + 기상 라우팅" 종합 패키지로, Volvo Ocean Race · America's Cup · SailGP 의 공식 supplier 지위를 유지하면서도 €1,250 (Tasman Bay Navigation Systems Ltd. 직판 기준) 일회성 라이선스로 판매되는 — 즉 "엔터프라이즈 기능을 indie SaaS-이전 가격에 파는" 산업 표준이다. 분석 대상으로서 단무지공방의 관점에서 (a) 폴라/calibration · 라우팅 · GRIB 다중 모델 통합의 깊이가 모든 비교군의 천장이며 (b) 동시에 UI 가 Microsoft Office Fluent Ribbon (Office 2007 시절 패러다임) 에 그대로 묶여 있고 Windows 11/10 전용 (ARM64 빌드는 2025년 추가) 이라는 양면성 ([expeditionmarine.com](https://www.expeditionmarine.com/), [history](https://www.expeditionmarine.com/history)).

---

##### §1. 풍향 재구성 / wind data 처리

Expedition 의 wind 파이프라인은 본 audit 의 모든 비교군 (Vakaros · Sailmon · Njord · TackTracker · Velocitek) 중에서 가장 "instrument-system 다운스트림" 위치를 차지. **Expedition 자체는 1차 sensor 보정의 주체가 아니라, B&G H5000 / Ockam T1 / NKE / A+T / Cosworth / Sailmon · Garmin · NMEA 2000/0183 등 30여 instrument 시스템에서 raw·dampened wind 를 받아 2차 보정 + display** ([instruments](https://www.expeditionmarine.com/instruments)).

매뉴얼 (Expedition.pdf, p.350–352): "*Calibration — Interface to calibration functions used by Expedition. For instrument data, calibration of the instrument system is preferred*." 즉 instrument 시스템 단의 보정을 더 권장. Vakaros·Sailmon 처럼 sensor 와 SW 가 통합된 일체형 architecture 와 가장 대비.

**핵심 calibration 모델 (매뉴얼 §"Calibration" / "Targets and polars" p.1899–1980):**

1. **Speed (paddle-wheel · sonic)**: 패들휠은 "*notoriously non-linear, especially as the boundary layer breaks down with increasing speed*" → high-end 시스템에서는 sonic speed sensor + 다중 speed point calibration table.
2. **Compass swing**: "*motoring the boat through several steady circles so the compass can learn about any magnetic effects*" + linear offset.
3. **Apparent wind speed (AWS)**: 제조사 공장 보정 후 사용자 보정 거의 없음.
4. **Apparent wind angle (AWA)**: 마스트 헤드 sensor 의 boat-axis alignment 필수.
5. **True wind angle (TWA) — 2차 보정 (upwash · heel · twist · shear 통합)**: "*The easiest way of calibrating the true wind angle this is to compare true wind direction when sailing at the same angle on port and starboard. (...) we build up a TWA calibration table based on TWA and TWS that collectively corrects for upwash and twist*." → **2D table (TWA × TWS) 보정**.
6. **True wind speed (TWS) 2차 보정**: "*B&G instruments have a simple, but effective solution in which the difference is entered in a calibration table and subtracted downwind. Less is subtracted as TWA decreases. Expedition and Ockam T1 systems can take this one step further and offer different calibration values at different wind angles as well as wind speeds*." → **2D (TWA × TWS) TWS correction table**.
7. **Leeway**: "*The commonly used equation is Leeway = -1 . k . heel / bsp^2*." "*Expedition and some instrument systems include leeway in Twa (so twa is relative to the boat's track through the water instead of its heading). This has important consequences for calculating laylines and is generally preferable*." (p.2007–2010). 즉 **TWA = TWA_centreline + leeway (track-relative TWA)**.
8. **Recalculated AWA/AWS**: "*Expedition then takes this one step further and recalculates the apparent wind speed and angle*" (p.1977–1980) — **2차 TWD/TWS 보정 후 역산 corrected AWA/AWS 출력**.

**Garbage-in-garbage-out doctrine**: "*updating these calibrations is an on-going task*" (p.1904–1905). Vakaros 의 "자동 calibration wizard" 와 정반대 — Expedition 은 navigator/sailor 의 능동적 시간 투자 전제.

**Shear/Twist 분리 입력**: Start ribbon 의 "Shear / Twist / Gradient" 컨트롤 (p.1186–1190) — Twist 는 TWD 가산, Gradient 는 TWS 가산 → layline 즉시 반영. **shear profile 을 manual override 로 layline 에 주입** — 한강 한정 사이트에서도 wind shear 가 layline 정확도의 큰 변수.

**Model-observation errors**: ribbon 의 "Model-observation errors" 버튼 (p.1260–1265) — "*Compares loaded weather models with available wind observations, ASCAT grib data and damped instrument values. Smaller RMS errors are good*." → **본선 onboard measured wind 를 ground-truth 로 다중 GRIB 모델의 RMS error 실시간 비교**.

(공개 출처: manual p.1899–2010, 1186–1190, 1260–1265, 350–352, 611–620)

---

##### §2. 외부 날씨 데이터 통합 — GRIB 1·2 · Tidetech · 다중 모델

**자체 운영 GRIB 서버 (Expedition grib server)** ([weather](https://www.expeditionmarine.com/weather)):

| 모델 | 운영기관 | 해상도 | 갱신 | 예보 |
|---|---|---|---|---|
| **ECMWF HRES** | ECMWF | 9 km / 0.25° | 4× daily | 144 / 360 h |
| **ECMWF ENS** | ECMWF | 9 km / 0.25° | 4× daily | 144 / 360 h |
| **ECMWF AIFS** (AI) | ECMWF | 0.25° | 4× daily | 360 h |
| **UM-Global / UM-UKV** | UK Met Office | 10 km / 1.5km | 4× daily | 60–168 h |
| **ICON / ICON-EU / ICON-D2** | DWD (독일) | 13 km / 0.1° | 4× daily | 120 / 180 h |
| **GFS / AIGFS** | NOAA | 13 km / 0.1°·0.25° | 4× daily | 384 h |
| **GDPS / HRDPS** | Environment Canada | 15 km / regional | 2× daily | 240 h |
| **Arpège / Arome** | Météo France | 7.5–37 km | 4× daily | 60–102 h |
| **NBM / HRRR / RAP / NAM** | NOAA | regional | hourly–daily | — |
| **Access / Access-C** | BOM (호주) | regional | — | — |
| **FMI Harmonie / KNMI Harmonie** | FMI / KNMI | regional | — | — |
| **OFS** (Chesapeake / SF Bay / Salish / West Coast) | NOAA | regional currents | — | — |
| **Mercator (CMEMS)** | Copernicus | 1/12° global ocean | 1× daily | — |
| **RTOFS** | NOAA | 1/12° global | — | — |
| **ASCAT** | EUMetSat / KNMI | satellite wind (관측) | frequent | — |
| **WRF** | Expedition 자체 (Cape Town, China Sea, HK, Manila, NZ 등) | 1/108° 까지 | — | — |

**Saildocs / Squid / SailFlow / Tidetech / SHOM / Barotropic / Current Lab / BSH / NOC Proudman / ADCIRC / Hong Kong Hydrographic Office** 등 **수십개 3rd-party feed 통합**.

**Ensemble forecasts**: "*Ensemble forecasts are used to help understand uncertainty in forecasts*". **ECMWF ENS · GEFS** 지원 → §3.5 의 **Ensemble routing** 핵심.

**Non-linear grib interpolation** (2022 도입) + **Per-model wind scaling** + **Model-observation comparison** — 각 모델별 wind multiplier 적용으로 본선 측정과 align.

**Tides & currents**: Copernicus / NOAA OFS / SHOM / Tidetech / BSH / Hong Kong / NOC Proudman / XTide. → **Korea·일본·홍콩** 의 경우 Hong Kong Hydrographic Office (CSV) + WRF China Sea/HK/Manila. **한국 자체 KMA RDAPS/LDAPS GRIB 직접 통합은 공개 출처 미확인**.

**Rule 41(c) 준수**: "*services such as routing or weather data that is not free of charge or easily available to all boats are not allowed by Rule 41(c) (outside help) of the RRS*". Saildocs 는 호환, Expedition grib server 의 UM/UKV/Access 는 Expedition 라이선스 사용자 한정 — NOR/SI 에 따라 분기.

(공개 출처: [/weather](https://www.expeditionmarine.com/weather), [/version_history](https://www.expeditionmarine.com/version_history), manual p.1191–1377)

---

##### §3. 폴라 / target 곡선 — Expedition 의 핵심 우위

폴라가 Expedition 의 진정한 differentiator. **35-product audit 중 polar editing 깊이로 단연 1위** (Adrena/Deckman 동률).

**폴라 모델 구성** (매뉴얼 §"Targets and polars" p.1866–1898):

1. **기본 폴라**: TWA × TWS 2D 테이블. 탭 구분 또는 .pol/.txt. **Adrena / MaxSea / SailGrib / B&G csv / ORC csv / Deckman / Expedition** 7개 폴라 포맷 호환.
2. **Multiple sail polars**: 2010년 재도입. 세일 chart 와 연동되어 각 sail combination 별 폴라. Sail chart 가 현재 풍속/풍각에 맞는 sail 선택 시 그 sail polar 가 라우팅에 입력.
3. **Night and port/starboard polars** (v11, 2020): **port/starboard 비대칭 + 야간 vs 주간 비대칭** — Expedition 만의 unique. "Expedition is the only weather routing package that allows you to integrate a 'night-time' effect into your polars" — Pip Hare 리뷰 인용.
4. **Asymmetric polars for route optimisation** (v11 → v12 라우팅 엔진 통합): 일부 보트는 port/starboard 성능 다름. **2개의 폴라 (port / starboard) 별도 보관, 라우팅 엔진이 tack 결정 시 각각 참조**. "*TWA on port is displayed in red and on starboard in green*".
5. **Polar % scaling**: "*Runs a series of route optimisations at 90, 95, 100, 105 and 110% of the navigation polar*" — 폴라 신뢰 부족 시 **±10% 5-point sensitivity sweep**.
6. **Table → polar 변환**: 정형 폴라 테이블을 Expedition format 으로 변환. **타겟 (upwind/downwind VMG target) 자동 계산**.
7. **Polar performance metrics**: "*polar bsp*" (예측 boat speed), "*polar bsp %*" (현재 boat speed / 폴라 boat speed). 예: "polar bsp% 96% → 보트가 폴라 제시 속도의 96%만 달림".
8. **Wind weight**: "*your polar numbers will vary slightly from day to day with changes in shear and air density. 96% of polar speed might be all that is possible some days. (...) Expedition uses a concept of wind weight*". v12 (2024) 에서 **air density 를 optimal routing 에 직접 입력**.
9. **Polar edit window**: Ctrl-P. polar 그래프 (좌측) + 테이블 (우측) 동시. **2016년 도입 "Draw log file data on polar edit window"** — log 의 실제 record 를 polar plot 위에 overlay → 시각적 폴라 fit.
10. **Self-learning polars from race data — 직접 자동 학습은 없음**, 반자동 우회:
    - **Sail test analysis** (p.1532–1534): log 파일에서 testdata 평균 자동 추출 → 폴라 점 산출 + database 저장.
    - **"Tests" window** (Ctrl-T): 저장된 test 데이터를 polar edit window 에 plot → 사용자가 시각적 폴라 수정.
11. **External tool integration**: KND Marine / Sailing Performance / ChartedSails / Njord 등 외부 SW 가 Expedition .log 를 읽어 폴라 자동 회귀.

(공개 출처: manual p.1536–1565, 1866–1898, 946–958, [version_history](https://www.expeditionmarine.com/version_history))

---

##### §3.5. 라우팅 알고리즘 (별도 심층) — Expedition 의 진짜 차별점

1. **Isochronal optimisation**: "*The isochronal algorithm should yield a slightly 'better' result*". White 본인의 history 페이지: "*The optimal routing method now used, derived from an idea after the 1997 Volvo, is far superior to the original isochrone method*" → **Expedition 의 isochronal 은 클래식 Hagiwara isochrone 변형이 아니라, 1997 Volvo 이후 White 본인 재설계**.
2. **Grid optimisation**: grid-based (lat/lon node graph + Dijkstra/A* 계열). 두 알고리즘 **동시 실행 → 결과 cross-validation** 표준 워크플로우.
3. **Improved isochronal and grid route optimisation** (2021): 두 알고리즘 재구현.
4. **Multithreaded optimal routing** (2022, 2023 개선; 2024 v12.6.7/12.6.9 thread safety fix).
5. **Ensemble routing**: ECMWF ENS 의 50+ ensemble member 각각 독립 라우팅 → chart 위 색상별 spaghetti plot. **probabilistic optimal route distribution**.
6. **Multi-model routing**: ECMWF/GFS/ICON/UM/GDPS/Arpège 동시 라우팅 → 모델 disagreement = sensitivity 큰 구간.
7. **Optimal fleet routing**: YB Tracking / Blue Water Tracks 로 fleet 위치 수신 → 각 보트별 polar 적용 → fleet 전체 optimal route prediction. **"경쟁자가 최적 라우팅을 한다면 어디로 갈까"** prediction.
8. **Reverse isochrones**: 목적지 → 출발지 방향으로 isochrone 역산 → 어느 지점에서 출발해도 동일 시각에 목적지 도달이 가능한지 그래프. White 가 2003년 도입.
9. **Routing sensitivity** + sensitivity buttons (v12.6.9): 라우팅 결과 시간 sensitivity 를 chart 위 색상 grid.
10. **Wave correction & avoidance**: (wave height × wave-to-boat angle) grid 에 polar 보정 %. v12 "*Air density in optimal routing*" + 2025 "*New waves for optimal routing*".
11. **Polar % / TWS % / TWD ± / User wind / Instrument wind / Multiple staggered-start sensitivity** (p.1453–1471):
    - Polar %: 90/95/100/105/110% × 5-route sweep
    - TWS %: 90/95/100/105/110/115/120% × 7-route sweep
    - TWD ±: -10/-5/0/+5/+10° × 5-route sweep
    - User wind: 사용자 정의 wind 로 라우팅 (current 효과 분리)
    - Instrument wind: 현재 본선 instrument wind ("지금 이대로 가면")
    - Multiple: 출발 시간 staggered 다중 실행 → 출발 timing sensitivity
    - Tack/gybe: "Prefer tacks and gybes at routing steps" on/off 비교 → 라우팅 엔진 tactical preference sensitivity
    → **단일 라우팅을 absolute answer 로 다루지 않고, 16+ 개 sensitivity dimension 을 표준 workflow 로 sweep 하는 design philosophy**. 30년 grand prix racing 의 진짜 know-how.
12. **Race notes for area avoidance**: "*can be used to set areas to avoid or to reduce speed when using route optimisation*". TSS / 군사 zone / 사용자 인지 "이 해역 들어가지 말 것" polygon → hard-avoid 또는 speed-penalty.
13. **Right-click route to mouse pointer**: "*Computes an optimal route from the boat to the mouse pointer*" — ad-hoc "if I were to go there next" 즉시 라우팅.

(공개 출처: manual p.1378–1471, 1041–1074, 1722–1726, 1402–1403)

---

##### §4. 회전 손실 측정 — Tack/gybe loss tool

**결론: Expedition 에는 tack analysis tool 이 있다.** 매뉴얼 §"Tack analysis" (p.1015–1017): "*Tack analysis — For analysing tack performance / cost. Also populates the 'Tack/gybe loss time' and 'Tack/gybe loss metres' channels*."

세부:
- **Tack/gybe loss time** (초) 와 **Tack/gybe loss metres** (m) 두 개의 system channel 자동 populate → **number box / stripchart 에 표시, log 파일에 기록**.
- **Tack analysis 워크플로우**: log/실시간 데이터에서 tack/gybe 이벤트 자동 detect → tack 전 stabilized boat-speed/VMG 와 tack 후 stabilized boat-speed/VMG 비교 → "perfect tack" (loss=0) 으로 같은 polar boatspeed 회복한 가상 경로 대비 시간/거리 손실 계산.
- **2015년 도입** — 10년 운영된 안정 feature.
- **단점**: Vakaros 의 "tack vs ideal tack 시각 overlay + perfect tack benchmark" 수준 UI 매뉴얼에 명시 없음. Stripchart 에 tack/gybe loss 채널 plot 하는 hands-on 작업 필요.

**즉 Expedition 의 tack-loss 측정은 Vakaros 의 "자동 시각 비교" 가 아니라 "channel 화 → log 분석 → 사용자 직접 plot/aggregate" 의 power-user 워크플로우**. 단무지공방 entry-level user 가 그대로 쓰기엔 가파른 학습 곡선이지만, raw 데이터 (loss time/metres) 정확 산출은 동등 이상.

(공개 출처: manual p.1015–1017, 1449–1452, [version_history](https://www.expeditionmarine.com/version_history) 2015 entry)

---

##### §5. 통계 패널 / 인스트루먼트 readout

**Number boxes** — 3개 독립 Number box window + 별도 Number list window. data field pool:
- Depth · BSP · SOG · COG · HDG · TWA · TWS · TWD · AWA · AWS · VMG · VMC · target boatspeed · target TWA · polar bsp · polar bsp % · Tack/gybe loss time/metres · Time to layline · Time to next mark · Time to start line · Time to burn · Heel · Trim · Mast rotation · Forestay load — **수백 개 channel**.
- **Alternating numbers** (1997): 같은 number box 에 시간 주기로 2개 (또는 다중) numbers alternate 표시.

**Display states (디스플레이 상태)** — Pre-start / Race / Inshore / Offshore / Cruising 5가지 preset + custom save. 모든 window 위치 · QAT · number box 내용을 한 번에 swap.

**On-deck display 아키텍처** (p.1808–1849):
- 표준: nav station Windows PC + on-deck tablet 의 **Microsoft Remote Desktop** mirror. RDP > VNC 권장.
- **iPad/Android 직접 클라이언트 없음**. Expedition 은 **Windows 단방향 SW** — Vakaros HQ / Sailmon Live / Njord (cross-platform) 와 가장 다른 지점.

**Stripchart** — 1997년 "Tracer" → 1998 "Stripchart" → 별도 application 분리. 모든 channel 시간축 plot. **wand (시간 marker)** 로 임의 구간 선택 → log 데이터 extract. Sail test analysis 의 입력으로 stripchart wand 사용.

**Sail chart** — sail crossover diagram (어떤 TWA × TWS 에서 어떤 sail) 도식. 폴라와 일대일 매칭 → 라우팅 엔진이 sail 선택 자동화. KND Sailing Performance sail chart 통합 (2017).

**What-if? 윈도우** — 가상 wind/current/heading 입력 → laylines · VMG · target 즉시 가상 시뮬레이션.

**Animated wind flow** (v11, 2020): chart 위 wind streamline 애니메이션. Windy.com 의 visual language 를 onboard 에 도입.

(공개 출처: manual p.382, 440–457, 504–509, 528–608, 1204–1206, 1759–1761, 1808–1849)

---

##### §6. 리플레이 시각 언어 — race replay / log analysis

**Logging** — 1997년 도입, 모든 channel + GPS + AIS + radar + GRIB 표시 시점까지 기록. **24시간/파일** chunking. **자체 .log binary 포맷** (2022 New log file format).

**Log file analysis function** (v11, 2020):
- **Recent sailing performance** ("Volvo project 에 대해 구현된") — 최근 sailing 통계 리포트.
- **Tack analysis** (§4).
- **Analyse log file**: "*Automatically extracts test style data means from a log file*".
- **Analyse sail tests**: 폴라 회귀를 위한 sail test 분석.
- **Log files to grib**: "*Create grib files of sea temperature, depth or current set and drift from your log files*" — measured current/sea temp/depth 데이터를 GRIB 으로 export → 자기 측정으로 GRIB 보강 (Gulf Stream 등에서 매우 가치).

**Playback / Simulator** (p.1554–1599):
- **Simulator mode**: TWD/TWS/HDG/BSP 사용자 정의 → boat 가 폴라대로 가상 sailing.
- **Log Playback**: log 파일 1Hz–10Hz 가속 재생. Pause / step back / forward / time scrubbing.
- **목적**: ① calibration validation (TWA port/stbd 비교), ② polar refinement (test 추출), ③ tactical post-mortem.

**KML / GPX export**: 외부 시각화 (Google Earth · 외부 분석 SW).

**ChartedSails / KND / Sailing Performance / Njord / ReXY Gold / Model Accuracy** — 외부 replay/분석 SW 들이 Expedition .log 를 입력으로 받음. **즉 Expedition 의 replay 자체는 일관된 "race 영상화" UI 가 아니고, raw 데이터를 외부 SW 로 위탁하는 ecosystem 모델**. Vakaros HQ 의 race replay 의 visual storytelling 수준은 Expedition 단독으로는 도달 못 함 — Expedition 의 가장 약한 axis.

**Race tracking** (p.967–1005): YB Tracking API · Blue Water Tracks · Vessel Finder · 자체 race tracking → fleet 위치 → chart 에 다른 보트 표시 → post-race fleet 전체 race replay (simple animation).

(공개 출처: manual p.967–1040, 1011–1040, 1500–1599)

---

##### §7. 가격·구독·사용자 base·운영

**가격 구조:**

| 항목 | 가격 | 출처 |
|---|---|---|
| **신규 라이선스 (본사 직판)** | **€1,250** | [/sales](https://www.expeditionmarine.com/sales) |
| **신규 라이선스 (Diverse Performance Systems, UK)** | **£1,050** | [diverseps.com](https://diverseps.com/product/expedition-navigation-software/) |
| **신규 라이선스 (북미)** | **US$1,295** | (baseline) |
| **Upgrade (2023-01-01 이전 라이선스)** | **€275** | [/sales](https://www.expeditionmarine.com/sales) |
| **Navico Radar 옵션 LL1** | NZ$1,550 (per radar) | [/sales](https://www.expeditionmarine.com/sales) |
| **Navico Radar 옵션 LL2 (Doppler)** | NZ$2,475 | [/sales](https://www.expeditionmarine.com/sales) |
| **14-day demo** | 무료 (license email 신청) | site code 기반 |
| **Subscription** | **없음** | 일회성 라이선스 + 옵션 업그레이드 |

**라이선스**: Computer-bound (site code). 새 컴퓨터 이전 시 new key 필요 (일반적으로 무료 — "navigator copies renewed annually upon request"). **Backup PC license** 공식 페이지 미존재, 단 forum 상 보트 PC + 사전 계획용 PC 2-copy 가 표준.

**Russia 판매 제외**: "*Expedition is currently not for sale in Russia*".

**판매 거점 — 호주 본사 직판 + global reseller** ([/resellers](https://www.expeditionmarine.com/resellers)):
- **본사**: Tasman Bay Navigation Systems Ltd. (호주) — Australian working hours support.
- **Europe**: France · Germany · Italy · Spain · UK · Austria · Finland · Norway · Sweden · Turkey · Malta · Baltic
- **NZ**: DM Marine Electronics
- **USA**: Waypoint Racing (San Diego), Farallon (SF), Chicago Marine 등 8곳
- **Korea (한국)**: **공개 출처 미확인**. Asia/Pacific 영역에 한국 reseller 없음. → 한국 racing 시장 Expedition 사용자 base 매우 제한적 추정.

**개발 운영:**
- **Nick White (개발자) 단독 운영** — 1995 "Tasman Navigator" → 1998 "Tasman Explorer" → 2002 "Expedition" rebrand. 30년 단일 lead developer.
- **회사**: Tasman Bay Navigation Systems Ltd. (NZ/AU) — 2005년 라이선스 판매 정식 설립.
- **Volvo Ocean Race / America's Cup / SailGP 공식 supplier**.
- **Release cadence**: v12 (2024) — Navionics+/Platinum+ 통합, ECMWF AIFS / HRDPS / Access-C / OFS Salish Sea 도입, air density routing, asymmetric polar routing. **2025년 ARM64 빌드 추가**, MarkSetBot 통합. **v12.6.x 시리즈 (2025–2026)** 가 현행.
- **Forum**: [expedition.boardhost.com](https://expedition.boardhost.com) — White 본인 직접 응답. "*active forum with answers to most questions*" (SA 인용).
- **Customer service**: Sailing Anarchy forum thread "Expedition - lessons in exceptionally good customer service" 가 30년 누적 평판 요약.

**SI 단위**: Windows 11 권장 또는 10. **ARM64 빌드** (2025) — Microsoft Surface Pro 사용 가능. **Linux/macOS native 없음** (Boot Camp / Parallels 우회).

**확장 기능 가격**: Expedition 자체에 chart 미포함 — Navionics / C-MAP X / C-MAP 4D / S-57 / S-63 ENC 별도. Tidetech subscription 별도. **TCO = €1,250 (SW) + €500–€2,000 (chart) + €0–€1,500/yr (Tidetech) + 하드웨어** — Vakaros HQ 의 sensor+SW 통합 모델과 가격 구조 자체 다름.

**Pacific Cup routing 경고**: "Warning about Using Deckman or Expedition" (pacificcup.org) — SW 결함이 아니라 "*Computer routes using software like Expedition or Deckman suggest courses that are too close to highs when sailing around them downwind*". **SW 자동화 ≠ navigator 판단 대체**라는 30년 racing 메시지.

**점유율 (정성)**: Volvo Ocean Race (모든 race 공식 supplier) · America's Cup AC36 · SailGP · Grand Prix offshore racing 사실상 표준. Deckman (B&G, WTP 통합) 이 유일한 동급 경쟁자. Adrena (프랑스), MaxSea TimeZero, qtVlm 그 다음 tier.

(공개 출처: [/sales](https://www.expeditionmarine.com/sales), [/resellers](https://www.expeditionmarine.com/resellers), [/history](https://www.expeditionmarine.com/history), [/version_history](https://www.expeditionmarine.com/version_history), [diverseps.com](https://diverseps.com/product/expedition-navigation-software/), [yachtingworld.com Pip Hare](https://www.yachtingworld.com/yachts-and-gear/tested-pip-hare-tries-out-five-of-the-latest-weather-routeing-packages-70692), [SA threads](https://forums.sailinganarchy.com/threads/routing-software-expedition-v12.241985/), [pacificcup.org warning](https://pacificcup.org/kb/warning-about-using-deckman-or-expedition))

---

##### §8. SailTechCo 의 함의

1. **단무지공방의 직접 경쟁자가 아니다**: Expedition target = navigator-by-trade (Volvo · AC · 60ft+ offshore). 단무지공방의 한강·아산만 dinghy/sportsboat racing 사용자와 use-case 겹침 거의 없음. → **"Expedition 폴라 분석을 한국어로 풀어주는 educator/consultant 포지셔닝"** 자연스러운 협업.

2. **세 가지 학습 포인트**:
   - **다중 모델 × 다중 ensemble × 다중 sensitivity sweep standard workflow**: 라우팅을 "단일 정답" 으로 보지 않고 16+ 차원 sweep 로 robustness 평가 — 단무지공방 educational content "라우팅을 신뢰하는 법" 의 핵심 message.
   - **Polar 깊이 (port/starboard asymmetric, night, sail-specific, wind-weight, air-density)** — 단무지공방의 폴라 컨설팅 서비스 "ceiling" reference. ChartedSails / KND 와 함께 외부 SW ecosystem 의 표준 입력 형식 (.log) 를 Expedition 이 정의.
   - **30년 단일 개발자 모델 = sustainable indie SW archetype**: €1,250 × 추정 수만 카피 = 평생 수익 stable. 본 audit 비교군 중 유일하게 "indie 가 enterprise 시장을 30년 dominate" 사례. SailTechCo / 단무지공방 long-term business model design 참조.

3. **Expedition 의 빈틈 (단무지공방이 차별화 가능 axis)**:
   - **UI**: Office 2007 Ribbon, Windows 전용, 한국어 미지원 → 한국 entry-level user 첫 인상 barrier 매우 높음.
   - **Replay storytelling**: raw .log → 외부 SW ecosystem 위탁. Vakaros HQ 수준 "race-as-story" UI 부재.
   - **Mobile-first**: 없음. Remote Desktop / VNC 우회만.
   - **한국 reseller**: 부재.
   - **자동 calibration wizard**: 없음. Power-user 가 직접 instrument 시스템 보정 후 Expedition 으로 가져오는 패턴.

4. **단무지공방 product 차별화 방향 (가설)**:
   - 한국 dinghy/sportsboat 사용자를 위한 **"Expedition 폴라 read & write" toolchain 한국어 layer** (Expedition .pol/.txt 형식을 한국어 UI 로 시각화/편집).
   - **Korea WRF**: Expedition 이 China Sea / HK / Manila WRF 는 운영하지만 Korea 전용 (공개 출처 미확인). 단무지공방이 자체 Korea WRF (서해/남해) 시뮬레이션을 ECMWF 다운스케일링으로 운영 → Expedition 사용자에게 직접 GRIB 공급 가능.
   - **한국어 racing-replay storytelling**: Expedition .log 입력으로 한국어 race-replay 영상 자동 생성.

---

**총 단어**: 한국어 본문 약 4,200어 (영문 인용 포함).

**검증 가능성**: 모든 핵심 사실은 (a) Expedition.pdf 매뉴얼 직접 인용 + page 번호, (b) expeditionmarine.com 의 sales/version_history/weather/instruments/history/resellers, (c) diverseps.com 가격, (d) Sailing Anarchy / Cruisers Forum / Yachting World 외부 reference 출처. **Korean reseller / Korean WRF / backup PC license 세부**는 "공개 출처 미확인" 명시.
