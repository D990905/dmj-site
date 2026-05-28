#### D1-Deep. Garmin Quatix 7 + Connect IQ — Tier 0 심층 audit (Danny 7-axis)

> **Scope** — 본 심층 카드는 master audit 의 "#### D1. Garmin Quatix / Quatix 7" 기본 카드 보강. Quatix 7 / 7 Pro / 7 Sapphire / 7X Solar 4종 (모델 코드 010-02540-60, 010-02803-80, 010-02582-60, 010-02541-60) + Connect IQ 생태계 동시. Garmin 공식 매뉴얼 (영문 — `webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717` v12, 2025-08) + Yachting World long-term review 가 1차 출처, Connect IQ 서드파티 앱은 store 페이지 직접 접근 차단되어 forum / 리뷰 / GitHub 등 2차 출처. 인용 불가 영역 "(공개 출처 미확인)".

---

##### §1. 풍향 재구성 (Tack Assist 알고리즘 — port/stbd COG 평균, 한계)

Garmin Quatix 7 시리즈가 내장 sail activity 의 핵심 기능으로 내세우는 것이 **Tack Assist**. 워치에 풍향 센서 없는 상태에서 "진풍(true wind direction)" 을 GPS 데이터만으로 역산해 lift/header 판정.

매뉴얼 본문 verbatim (EN-US, 2025-08 v12):

> "While cruising or racing into the wind, the tack assist feature can help you determine if your boat is being lifted or headed. When you calibrate tack assist, the watch captures your boat's port 1 and starboard 2 course over ground (COG) measurements, and uses the COG data to calculate the **mean true wind direction 3** and the boat's **tack angle 4**."
> — 출처: https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/EN-US/GUID-4BE4156E-A466-46F7-AEEA-F17EBFC109C0.html

알고리즘 수학적 구조 (callout 번호 + 본문 결합):

```
TWD_estimated  = (COG_port + COG_starboard) / 2  ± 180°   (upwind이면 +180°)
tack_angle     = |COG_starboard − COG_port|
```

→ **port COG 와 starboard COG 의 산술 평균 = 역풍 양현 close-hauled 정중앙** 가정. 정중앙을 180° 회전 → 바람이 불어오는 방향. 매뉴얼 **caution** 박스 직접 인용:

> "The watch uses GPS-based course over ground to determine your course in the tack assist feature, and does not account for other factors that can affect your boat's direction, such as currents and tides."

**7가지 한계 (PhD 검수 수준):**

1. **풍향 센서 부재** — 워치에 anemometer/wind vane 없음. "true wind" 는 실제로 GPS COG 기반 **"COG bisector"**, 진정한 TWD (boat speed vector 빼고 air mass 기준) 아님. Vakaros Atlas 2 와 SailMon Max 의 IMU + GPS Kalman 으로 SOG-leeway-current 분리하는 것과 1세대 다름.
2. **조류/표류 보정 불가** — Garmin 본인이 caution 박스에 인정. 동서 강한 조류 한국 인천만/통영 같은 해역에서는 COG ≠ HDG. 진풍 정북이라도 동향 조류 1.5kt 이면 양 tack COG 모두 동쪽 평행 이동, bisector 살아남지만 **lift/header 판정 거짓 양성** 양산.
3. **현재(instant) COG vs 평균 COG** — calibration 순간 COG 만 기록되는지 또는 슬라이딩 윈도우 평균인지 매뉴얼 명시 없음 (공개 출처 미확인). child topic "Calibrating the Tack Assist" 와 "Tips for Getting the Best Lift Estimate" 의 권고 ("Reset the tack angle, and calibrate both the port and starboard side." — https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/EN-US/GUID-0F725B26-39B3-477D-9475-474B4C6A01B0.html) 에서 추정컨대 **single-shot calibration 모델** — 사용자가 좋은 각도일 때 버튼 누르는 manual snapshot.
4. **Asymmetric polar 가정 불가** — 알고리즘 port·starboard tack angle 동일 가정 (symmetric polar). Asymmetric spinnaker / chine hull 비대칭 / wave bias 시 산술 평균 systematic bias.
5. **Heading vs COG 혼동** — 워치는 wrist 위, boat heading 자체 모름, GPS COG 만. lift/header 판정 baseline 이 boat heading 아닌 boat track. 정의상 "VMG-lift" 이지 "header (머리 위 바람 변화)" 가 아님.
6. **Fixed override 옵션 존재** — 매뉴얼 "Entering a Fixed Tack Angle" 과 "Entering a True Wind Direction" 두 manual override (https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/EN-US/GUID-1C0904E9-5642-4AF8-BAFC-B925ADD67D43.html, /GUID-96B0DB3C-A3F0-43FA-8E2C-D71CE4B214FE.html) — **사용자가 외부 데이터 (B&G chartplotter, RaceQs 분석) 에서 정확한 TWD 입수해 직접 입력하는 use case 전제**. Garmin 본인 알고리즘만으로 부족 인정.
7. **Cruising/racing into the wind 한정** — 매뉴얼 첫 문장 "while cruising or racing **into the wind**". **다운윈드에서는 작동 보장 안 함**. 다운윈드 폴라 분석은 Garmin 자체 기능 밖.

**요약**: Tack Assist 는 "no-sensor cheap algorithm" 교과서 사례. 가격 대비 가치 높지만, SailTechCo Phase 3 Connect IQ 앱에서 **이보다 못한 알고리즘으로는 차별화 불가능**, **이보다 약간만 더 나은 알고리즘으로는 Garmin 매뉴얼 caution 박스로 사용자가 안심하지 않는 영역 (조류/leeway) 을 정확히 공략** 필요.

---

##### §2. 외부 날씨 데이터 통합 (Garmin Connect → MFD chartplotter ANT/Wi-Fi 연동)

Garmin Quatix 의 sailing watch 시장 1st-class 위치 이유는 §1 알고리즘이 아니라 **MFD (GPSMAP / ECHOMAP / Volvo Penta Glass Cockpit 등) 와의 wireless bridge**. Yachting World long-term review 와 no-frills-sailing.com 현장 데모 (Excess Catamarans 시연) 에서 검증.

no-frills-sailing.com (Lars Reisberg, 2023-04, https://no-frills-sailing.com/garmin-quatix-smartwatch-sailing-review/) 실제 demo 인용:

> "Thomas just went into the 'Setting'-section of the chart plotter and into the 'Connect Wireless Remotes'-submenu, enabled this function with a swipe, the plotter searched for a brief moment and had my watch found. ... Every time I near myself the boat now, my watch connects itself. ... as many as 10 Quatix could be connected, which of course is a ridiculous number for a boat ... but two or three is no problem at all."

→ **Garmin MFD (GPSMAP 8400xsv class 등) 는 동시에 최대 10대의 Quatix 와 wireless remote pairing**. 데이터 경로:

```
NMEA 2000 backbone (wind, depth, water temp, AIS, engine RPM, fuel level)
        │
   GPSMAP / ECHOMAP chartplotter (= gateway)
        │  Wi-Fi (Garmin Marine Network) or proprietary ANT
        ▼
   Quatix 7 watch (display + remote control)
```

Yachting World 2022 리뷰 통합 범위:
- **MFD display 화면을 워치 터치스크린에서 직접 제어** — "Use the touchscreen to control MFD displays, Fusion audio systems, and Garmin autopilots right from your wrist."
- **Fusion audio system 원격 제어**
- **Garmin autopilot (GHC 계열) 원격 engage/disengage 및 조타** — no-frills 리뷰 사진 caption "Garmin Quatix 7 auto pilot" 화면 입증.
- **Force trolling motor 원격 제어** (Quatix 7 Pro 전용, 2023-11 신규 앱 "Trolling Motor Remote")
- Receivable data: wind speed/direction, depth, SOG, COG, water temp, AIS targets (chartplotter 모델별 가변, 공개 출처 미확인)

**외부 (non-Garmin) MFD 통합 — 비공식 불가능**. B&G(Navico), Raymarine(FLIR), Furuno 와의 wireless bridge 공식 지원 없음. NMEA 2000 은 Garmin chartplotter 가 backbone 에서 끌어와 자기 wireless layer 로 재송출 → 워치는 항상 **Garmin MFD 게이트웨이 거쳐야** wind 데이터 수신. no-frills 리뷰에서 Excess Catamarans 가 "Raymarine → Garmin" OEM 전환한 사례가 락인의 방증.

**외부 wind 센서 (Calypso ULP Anemo) 직접 연결** 공식 매뉴얼에 없음 (공개 출처 미확인). Calypso ULP 는 NMEA 2000 또는 Bluetooth 송신하지만, Quatix 워치가 직접 BLE wind sensor profile receive 한다는 매뉴얼 항목 본 audit 에서 미확인.

**한계점**: Garmin 의 진풍 데이터를 워치가 보여주려면 (a) Garmin MFD 구매 + (b) MFD 가 NMEA 2000 wind 센서 연결. **워치 단독으로 풍향계 없음, 보트 인프라 full Garmin 생태계 필수**. 한국 시장에서 결정적 진입 장벽 — 한국 세일링 보트 NMEA 백본은 거제·창원에서 건조된 Hanwha/STX OEM 사양에 따라 B&G 또는 Raymarine 이 더 흔함 (공개 출처 미확인).

---

##### §3. 폴라 / target 곡선 — Garmin 자체엔 없음, Connect IQ 앱 중에도 미확인

**Garmin Quatix 7 자체 — 폴라 곡선 없음**.

Sailing 메뉴 child topic 은 manual 트리에 두 개뿐 — **"Tack Assist"** 와 **"Sail Racing"** (https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/EN-US/GUID-1A0C9B3C-37D8-4333-8844-DEFA2944B5BA.html). Sail Racing 페이지 (https://www8.garmin.com/manuals-apac/webhelp/quatix7series/EN-SG/GUID-C361E0E1-7614-4720-A3B6-194CB3C4E92F-9180.html) 는 regatta timer / start line ping / time-to-burn 만 다룸 — **target boat speed / target VMG / polar curve overlay 단어 매뉴얼 어디에도 등장 안 함**. 매우 의도적 제품 포지셔닝 — Garmin 은 Quatix 를 "cruising + light racing" 영역에 머무르게 하고, polar 계산은 chartplotter (GPSMAP 16x3/17x3) 쪽 "Sail Assist" 패키지의 일부로만 제공 (Garmin Marine 라인업 분리 일반론, 공개 출처 미확인).

**Connect IQ 서드파티 앱:**
- **Sail Racer** (Windward-IT) — 가장 많이 인용. Sailing Anarchy 의 "Garmin Sail Racer version 5.1 released" thread(https://forums.sailinganarchy.com/threads/garmin-sail-racer-version-5-1-released.244299/) v5.1 release 입증, thread 본문 fetch 빈 응답 (공개 출처 미확인). polar table 로딩 지원 여부 store 직접 확인 불가.
- **Sail2WIN** — "Sailing Instruments on your wrist" 슬로건. polar 지원 (공개 출처 미확인).
- **raceQs Connect IQ** — raceQs (웹 기반 3D race replay) Garmin companion. polar 기능은 raceQs 웹 서버 쪽 후처리가 본래 raceQs 모델 → 워치 앱 자체는 트랙 로그 송신 가능성 (공개 출처 미확인).
- **Sailing Race Timer** — ISAF compliant race timer. polar 미포함.
- **SailingTools / Yet Another Sailing App** — GitHub pintail105/SailingTools 오픈소스 Monkey C. polar overlay 기능 본 audit 에서 source 직접 미확인 (공개 출처 미확인).

**알고리즘 검토**: 워치가 polar 표시하려면 (a) polar table 또는 함수형 (ORC VPP polar 또는 Delft Series approximation) 을 워치 SDK 메모리 적재, (b) live TWS·TWA 를 외부 wind 센서에서 수신해 lookup. Connect IQ SDK 는 256-512 KB 메모리 한도 (앱 카테고리·디바이스 가변, 공개 출처 미확인) 내 동작 → **JSON 또는 binary 압축 polar table (8 TWS × 18 TWA = 144 cell × 2 byte = 288 byte) 적재 충분 가능**. 그러나 wind 데이터 수신이 §2 처럼 항상 Garmin MFD 거쳐야 하므로, Connect IQ 앱 직접 NMEA 2000 read 못 함 — chartplotter API 통해 derived data 수신 (공개 출처 미확인 — Connect IQ Marine API 문서 직접 확인 필요).

**결론**: Garmin 자체 polar/target 곡선 **없음**, Connect IQ 서드파티 앱 중에서도 **본 audit 에서 polar curve overlay 공개 확정 앱 없음**. **SailTechCo Connect IQ 차별화 가능 white space.**

---

##### §4. 회전 손실 측정 (Garmin 자체 N/A — 사유 명시)

**Garmin Quatix 7 자체 — 탭/자이브 후 속도 손실 (turn cost) 측정 N/A.**

사유:
1. §1 에서 Tack Assist 는 single-shot calibration, **tack 이벤트 자체를 자동 감지 안 함**. 매뉴얼은 tack 직전·직후 timestamp 캡처해 SOG 회복 시간 측정하는 메뉴 미노출 — sailing 트리 child topic 은 Tack Assist · Sail Racing 둘뿐 (§3).
2. Sail Racing 메뉴는 start line phase time-to-burn 만 — race 중 tactical loss 미다룸.
3. Connect 모바일 앱 activity replay (§6) 에서도 "tack loss" 또는 "speed recovery time" derived metric 매뉴얼 미확인 (공개 출처 미확인).

근본 원인: §1 알고리즘이 GPS COG 만 보고 풍향센서 없으므로 **"이 tack 은 lift 였는데도 회복이 늦었다"** 같은 판정 baseline 자체 구축 불가.

**Connect IQ 앱 중 회전 손실 — 공개 출처 미확인:**
- Sail Racer v5.1 (SA forum thread) 까지 release, tack analytics screen 있는지 store 직접 접근 불가.
- raceQs 는 **웹 후처리** 에서 3D race replay 와 함께 tack loss 분석으로 알려짐 (raceQs 본 사이트 marketing, 공개 출처 미확인). Connect IQ companion 자체는 데이터 송신 역할.
- **SailingTools (pintail105)** — GitHub Monkey C 소스 공개, tack 측정 기능 유무 본 audit 에서 코드 직접 미확인 (공개 출처 미확인).

**이 영역은 SailTechCo Phase 3 Connect IQ 앱 차별화 leverage point 매우 강력**. 단무지공방 본업 정체성 ("회전 손실의 시각화") 이 Garmin 과 그 위 Connect IQ 앱들 어디에도 1st-class 로 존재 안 하는 white space.

---

##### §5. 통계 패널 / 인스트루먼트 readout

**워치 자체 — 데이터 필드 system (Garmin fenix family 상속)**.

Quatix 7 은 fenix 7 base 위 marine activities 추가:
- **다중 data screen**: 한 activity profile 당 보통 2–6개 화면, 화면당 1–6개 data field. data field 100+개 (SOG, COG, time, distance, depth, water temp, wind speed/direction, AWA, TWA, VMG, time-to-burn, distance-to-start 등).
- **Sail Race activity** — "regatta timer 와 time-to-burn" prebuilt data screen (Garmin APAC 매뉴얼 verbatim).
- **Touchscreen** — Yachting World 리뷰어 "pointless" 평가하며 off — sailing 환경 wet finger + spray 에서 capacitive touch 거짓 입력 다수. **물리 버튼 5개가 핵심 UX** (YW 2022 리뷰).
- **AMOLED (Quatix 7 Pro)** — 1.3" AMOLED, sapphire lens. 햇빛 가독성 yachting world 리뷰 "easy to read, even in bright sunlight" (2025-11-25).
- **MIP (Quatix 7 Standard / 7 Solar)** — fenix 7 계열 MIP (sunlight readable, low power).

**Connect 모바일 앱 / Garmin Connect 웹 대시보드**:
- **Activity map** — GPS track overlay
- **Time series chart** — SOG, HR, cadence, altitude, depth (NMEA 수신 시), temperature
- **Lap breakdown** — start/finish, auto-lap split 별 통계
- **Stress / sleep / body battery** — sailing 무관하나 long-passage fatigue 추적 가능

**한계**: Connect 앱은 sailing-specific dashboard 별도 없음. 위 chart 들은 running/cycling 위해 설계, **tack-by-tack analysis, polar overlay, wind shift chart sailing-domain dashboard 부재**. raceQs 같은 별도 서비스로 데이터 export (FIT file) 해야 그런 분석 가능.

---

##### §6. 리플레이 시각 언어 (Garmin Connect activity replay)

**Garmin Connect 자체의 replay 비주얼**:

Garmin Connect 웹/앱 activity replay — GPS track 시간에 progressively 그려나가는 stroke animation 정도 표준 (공개 출처 미확인 — Connect 앱 직접 화면 캡처 본 audit 범위 밖). 핵심:
- 2D map overlay (Mapbox/Google Maps style 또는 BlueChart 코스털)
- Time slider — scrubbing 가능
- 동기화 metric chart (SOG, HR 등) 슬라이드 아래 동시 이동

이 시각언어는 **running/cycling 의 stroke-on-map 패러다임을 그대로 sailing 에 적용**:
- 다중 보트 합성 (fleet replay) 부재
- 풍향 화살표 overlay 부재
- Layline 표시 부재
- 시간을 wind shift 단위로 quantize 부재
- Tack 이벤트 punctuated marker 부재

→ **Garmin Connect 자체는 sailing replay 도구로 매우 약함**.

**Third-party 통합 — raceQs 매개**:

raceQs (웹 + 모바일) 는 3D race replay 서비스 (공개 출처 미확인 — raceQs 본 사이트 직접 fetch 불가). raceQs Connect IQ 앱이 Quatix 에서 트랙을 raceQs 서버 송출, 사용자가 raceQs 웹에서 3D 영상.

대안 흐름:
- FIT file 을 Garmin Connect 에서 **export** → Expedition / SailMon Bay 같은 후처리 도구로 import → polar/replay 가능
- TCX/GPX export → 사용자 custom 분석

**시각 언어 평가**: Garmin Connect 의 replay 는 SailTechCo 단무지공방 본업 ("회전 손실의 시각화") 에서 추구하는 **시간-tack 좌표계의 정성적 표현** 에 비해 현저히 빈약. 이 격차가 SailTechCo 가 라이벌이 될 수 없는 영역을 정의하면서 동시에 Phase 3 Connect IQ 앱이 노릴 white space 재확인 (§4 결론).

---

##### §7. 가격·구독·사용자 base·Garmin 마린 부서 + Connect IQ 생태계

**가격 (2025-11 기준, 다중 출처 cross-check):**

| 모델 | 모델 코드 | MSRP (USD) | UK price (GBP) | 비고 |
|------|-----------|----|----|----|
| Quatix 7 Standard | 010-02540-60 | (공개 출처 미확인) | £599.99 (YW 2022) | MIP display |
| Quatix 7 Sapphire | 010-02582-60 | (공개 출처 미확인) | up to £1,049.99 (YW 2022) | sapphire AMOLED |
| Quatix 7 Pro | 010-02803-80 | **$999.99** (Garmin 보도자료 2023-11-15) | £869 list → £465 sale (YW 2025-11-25 deal) | 1.3" AMOLED + LED flashlight + Trolling Motor Remote + Fish Forecast |
| Quatix 7X Solar | 010-02541-60 | (공개 출처 미확인) | (공개 출처 미확인) | Solar charging, 51 mm |
| Quatix 8 | (2025 신모델) | (공개 출처 미확인) | (공개 출처 미확인) | YW 2025-11-25 "differences are pretty small" |

**구독 — Quatix 자체는 구독 없음**. Garmin Connect, Connect IQ 앱 다운로드, ActiveCaptain 모두 무료. 별도 구매:
- BlueChart g3 coastal charts (선택)
- Navionics+ 또는 Boating App subscription
- LakeVü g3 inland maps

**배터리:**
- Quatix 7 Pro: **smartwatch mode 최대 16일 / GPS mode 최대 30시간** (Garmin 보도자료 2023-11-15, https://www.garmin.com/en-US/newsroom/press-release/marine/garmin-introduces-premium-quatix-7-pro-marine-smartwatch/)
- Quatix 7 (non-Pro): Yachting World 2022 실측 — "barely makes 6 days before I need to plug it in" (vs Quatix 6 의 10일). **마케팅 수치 (fenix 7 spec 18일 인용) 와 실측 격차 큼**.

**Apple Watch 차별점 재정리:**
- 배터리: Quatix 7 Pro 16일 vs Apple Watch Ultra 2 ≤36시간 — **10–20× 차이**
- 햇빛 가독성: Quatix 7 Standard MIP 매우 우수, 7 Pro AMOLED "easy to read, even in bright sunlight"
- MFD 연동: **Garmin 만 가능** (§2)
- 1st-class sailing mode: **Garmin 만 prebuilt activity** (Sail Race / Sail Cruising / Wakesurfing / Waterski — 2023-11-15 보도자료)
- ECG / Pulse Ox: Quatix 7 Pro 탑재 (regional)

**사용자 base — 공개 수치 없음.**

Garmin Ltd. (NYSE: GRMN) 전체 매출은 IR 공개되나 Quatix 단일 SKU unit volume 비공개. 정성 신호:
- **"9년 연속 NMEA Manufacturer of the Year"** — 2023 보도자료 명시.
- no-frills-sailing.com 2023-04 La Grande Motte Boat Show 현장 관찰: "*so many of my fellow colleagues at Excess and other brands wear a Garmin Quatix smart watch*" → **유럽 production catamaran 산업 인사이더들 사이 사실상 표준 wear**.
- Excess Catamarans OEM 전환 — "the shipyard of Excess Catamarans lately decided to switch their electronics supplier from Raymarine to Garmin" (no-frills 2023-04). **Garmin OEM 공급 차원에서 Raymarine 잠식 중**.

**Connect IQ 생태계 사이즈:**

Connect IQ store 직접 접근이 본 audit 차단되어 (URL not in provenance set) **현재 시점 sailing 카테고리 정확한 앱 수, 다운로드, 평점, 가격 공개 출처 미확인**. forum / GitHub / 리뷰에서 교차 확인 가능한 sailing 앱:

| 앱 | 개발자 | 형태 | Audit 확인 |
|------|--------|------|----|
| **Sail Racer** | Windward-IT | watch app | v5.1 release (SA forum URL 존재), 본문 fetch 빈 — 다운로드/평점 (공개 출처 미확인) |
| **Sail2WIN** | (공개 출처 미확인) | watch app | 슬로건 외 미확인 |
| **raceQs Connect IQ** | raceQs Inc | watch app | raceQs companion |
| **Sailing Race Timer** | (공개 출처 미확인) | watch app | ISAF compliance 자칭 |
| **SailingTools / Yet Another Sailing App** | pintail105 | watch app, 오픈소스 Monkey C | GitHub repo 존재, 코드 직접 미확인 |

전체 카탈로그 사이즈 (공개 출처 미확인). 일반 Connect IQ store 는 watch face / data field / widget / device app / audio content provider 카테고리, 전체 수만 개 추정 (Garmin developer 블로그 일반 인용, 공개 출처 미확인). Sailing niche.

**Connect IQ 개발 환경 — SailTechCo Phase 3:**

- **언어**: Monkey C (Garmin proprietary, Java/JavaScript 혼합)
- **IDE**: VS Code + Monkey C extension
- **SDK**: Connect IQ SDK 4.x (4.0.6+, 정확한 최신 공개 출처 미확인)
- **시뮬레이터**: SDK 동봉, 실기기 동작 차이 존재 — 특히 Bluetooth/ANT, GPS, sensor 시뮬레이션 제한 (Garmin developer forum 일반, 공개 출처 미확인)
- **서명**: RSA-4096 키 필수. **키 분실 시 향후 업데이트 (같은 app ID) 영구 불가** — SailTechCo 회사 자산 필수
- **Store review**: Garmin Connect IQ Store Review Guidelines 통과 필요 (공개 출처 미확인)
- **Garmin Connect Developer Program**: 워치 SDK 와 별개, Connect 서버 데이터 접근 시 별도 program 등록 (공개 출처 미확인 — 일반론)

**한국 시장 (Garmin Quatix in Korea):**

- Garmin Korea 공식 사이트: Quatix 7 한국 판매 라인업 본 audit 직접 미확인 (공개 출처 미확인). Garmin Korea 는 fenix / forerunner 중심 마케팅, Quatix marine niche 라 store 노출 빈도 낮음 (정성 관찰, 공개 출처 미확인).
- 다나와/네이버 쇼핑 가격 비교 본 audit 범위 밖.
- 한국어 매뉴얼: 본 audit 에서 직접 확인된 한국어 매뉴얼은 EN-SG (영어, 싱가포르 APAC) 와 EN-US. 한국어 webhelp (공개 출처 미확인). Garmin APAC 일반 정책상 한국어 owner's manual PDF 제공 (공개 출처 미확인).
- 한국 sailor 커뮤니티 후기 본 audit 범위 밖. 정성적으로 한국 보트 인구 적고 Quatix 적극 사용자 가시화 가능성 낮음.
- Connect IQ 앱의 한국어 지원 (공개 출처 미확인).

**Quatix 7 Pro (2024-2025) 신규 기능 — 보도자료 verbatim:**

Garmin 2023-11-15 보도자료 (https://www.garmin.com/en-US/newsroom/press-release/marine/garmin-introduces-premium-quatix-7-pro-marine-smartwatch/) Pro 차별화:
- "stunning 1.3" AMOLED display with a premium, scratch-resistant sapphire lens"
- "built-in LED flashlight with variable intensities and strobe modes, including a red-light mode to help preserve night vision"
- "Trolling Motor Remote app that gives anglers the ability to control their Force trolling motors"
- "Fish Forecast app, which tracks the solar and lunar movements during the day"
- "titanium bezel with a diamond-like carbon coating"
- "housing is made from recycled ocean-bound plastics"
- "ECG app ... comes preloaded on the watch" (regional)
- "VO2 max, endurance score and hill score"
- "Garmin Pay contactless payment"
- "multi-band GPS and SatIQ™ technology"
- "TopoActive maps ... BlueChart® g3 coastal charts and LakeVü g3 inland maps as well as weather map overlays"
- MSRP **$999.99**

**Wayfinder watch face** — 본 audit 검색에서 Garmin 공식 sources 에 명시적으로 "Wayfinder watch face" 단어로 등장 안 함 (공개 출처 미확인 — Garmin Marine blog 또는 별도 보도자료에서 명명되었을 수 있으나 본 audit fetch 범위 밖).

---

##### §8. 종합 한 줄

Garmin Quatix 7 은 **하드웨어와 OEM/MFD 게이트웨이를 독점하는 "marine 생태계의 닌텐도"** 이고, 알고리즘 깊이 (특히 §1 풍향 추정과 §4 회전 손실 측정의 부재) 는 의도적인 cruising/light-racing positioning 의 결과. SailTechCo 가 Phase 3 Garmin Connect IQ 위에서 차별화 가능한 white space 는 **polar overlay (§3)**, **회전 손실 분석 (§4)**, **sailing-domain replay 시각화 (§6)** 세 영역에 명확히 존재. 그러나 진풍·NMEA 데이터를 워치가 받기 위해 사용자가 Garmin 풀스택 보유해야 한다는 §2 의 생태계 락인이 Phase 3 앱 TAM 자체 제한 — 즉 **Connect IQ 앱 자체가 SailTechCo 의 메인 제품일 수는 없고, iOS·Android 메인 앱의 wearable companion** 으로 자리매김할 때 비용-효익 성립.

> **본 audit 의 출처 한계 명시**: Connect IQ store (apps.garmin.com), developer.garmin.com, Sailing Anarchy thread 본문, Garmin Korea 한국 페이지, 한국 세일러 커뮤니티는 본 audit 에서 직접 fetch 차단되거나 빈 응답. 각 영역 "(공개 출처 미확인)" 표기 사항은 후속 follow-up audit 에서 직접 화면 캡처 또는 store API 접근으로 보강 필요.
