#### B8-Deep. Velocitek ProStart + SpeedPuck — Tier 0 심층 audit (Danny 7-axis, open .vtk standard)

> **Audit scope.** Velocitek (San Mateo, CA) 의 두 주력 — **ProStart** (distance-to-line race start computer, $895 → 2026년 3월부터 인하 발표) 와 **SpeedPuck** (GPS 속도계). 두 디바이스는 **공통적으로 .vtk 바이너리 프로토콜** 로 데이터 기록, Velocitek 은 자체 분석 SW 를 만들지 않고 **ChartedSails / Sail Njord / TackTracker 등 외부 ecosystem 에 위탁**. 본 audit 핵심 발견은 §6 (.vtk → 외부 analytics workflow) 과 §7 (오픈 표준 전략의 시사점) 에 집중. Danny SailTech 가 동일한 "센서·기록 + 외부 분석" 분리 모델을 채택할지, Vakaros 식 "hardware + cloud + 구독" 통합 모델을 택할지에 직결되는 case study.

#### §1. 풍향 재구성 — N/A (사유 명시)

**해당 없음.** Velocitek ProStart 와 SpeedPuck 의 어떤 SKU 도 **풍향 센서를 탑재하지 않는다**. GPS + IMU (ProStart 한정) 기반의 **kinematic-only** 측정 도구이며, true wind 또는 apparent wind 데이터를 디바이스 차원에서 산출하지 않음.

공식 ProStart 스펙은 `Lat, Long, Time, COG, SOG, magnetic heading, heel angle` 만을 4Hz 로 기록 ([sandiegomarine.com 스펙시트](https://store.sandiegomarine.com/products/velocitek-prostart---generation-2-18970.html); [vtk.proto schema](https://github.com/velocitek/vtk_protocol/blob/master/vtk.proto)). 풍향 추정은 전적으로 **외부 분석 도구의 책임 영역**으로 이관 — ChartedSails 의 "wind detection from the track shape" ([chartedsails.com/blog/sailing-with-a-velocitek-prostart](https://www.chartedsails.com/blog/sailing-with-a-velocitek-prostart)) 가 tack/gybe geometry 로부터 사후적으로 TWD 역산.

이 N/A 자체가 Velocitek 의 제품 정의를 드러낸다: **"풍향을 모르고도 race start 는 칠 수 있다"** — 라인까지의 거리·시간·SOG 만으로 dinghy start line 의 90% 의사결정 가능. 풍 추정은 사후 debrief 의 문제로 분리.

SpeedPuck 의 "Wind Shift Indicator" 화면 모드가 있지만, 이는 **GPS heading (COG) 의 자동 평균값에 대한 편차를 바 그래프로 보여주는** 단순 알고리즘 ([velocitek.com/pages/speedpuck](https://www.velocitek.com/pages/speedpuck) — "The SpeedPuck's shift tracking algorithm locks on to the mean heading and then shows deviations from that heading with an easy-to-read bar graph"). **wind sensor 가 아니라 heading-deviation indicator 의 마케팅 별칭**. tack/gybe 시 자동으로 새 mean heading 으로 리셋. 풍 추정으로서의 정확도 보장되지 않음.

#### §2. 외부 날씨 데이터 통합 — N/A

**해당 없음.** Velocitek 디바이스에는 **무선 연결 기능이 일체 없다.** WiFi/Bluetooth/LTE 모두 부재. 데이터 전송은 오로지 **micro-USB 유선** 으로만, 단방향 (디바이스 → 컴퓨터/폰; USB Mass Storage 마운트로 .vtk 파일 드래그) ([chartedsails.com](https://www.chartedsails.com/blog/sailing-with-a-velocitek-prostart) — "plug the Prostart into the phone, open the Files app, and the device shows up as an external drive").

따라서:
- **외부 weather API (NOAA, Predictwind) 통합 부재.** GRIB 다운로드, current/tide overlay, 일기예보 표시 일체 없음.
- **AIS/NMEA 입력 부재.** ProStart 는 폐쇄형 단일 디바이스 — B&G/Raymarine 등 외부 instrument bus 와 어떤 형태로도 통합 안 됨.
- **클라우드 자동 sync 부재.** Vakaros Atlas 가 WiFi 로 자동 백업하는 것과 정반대.

이는 의도된 디자인. Velocitek 75-시간 배터리 ("75 hour battery life with backlight off") + IPX8 방수 (3m) 는 **무선 모듈 제거로 얻은 결과**이며, Olympic dinghy fleet 일주일 regatta 무충전 시나리오를 정확히 겨냥.

날씨/조류 데이터를 결합하려면 워크플로: ProStart → .vtk → ChartedSails → ChartedSails 가 historical weather 를 별도 overlay. Velocitek 디바이스는 이 체인에서 **순수 kinematic logger** 역할만.

#### §3. 폴라 / target 곡선 — N/A

**해당 없음.** Velocitek 디바이스에 polar table 입력 기능, target boat speed 표시, VMG 계산 화면 일체 없음. 4-up 디스플레이는 distance/time/SOG/COG (또는 max speed/heading) 만 ([velocitek.com/pages/speedpuck](https://www.velocitek.com/pages/speedpuck) — Speed Mode / Heading Mode / Maximum Speed Mode 3 모드).

다시 **외부로 위탁** — ChartedSails 가 자동 maneuver detection 과 VMG loss 계산 ([chartedsails.com](https://www.chartedsails.com/blog/sailing-with-a-velocitek-prostart) — "every tack and gybe with entry / exit speeds and VMG loss"), Sail Njord 가 performance database 에서 wind range 별 boat speed scatter 누적. 단 **post-race debrief 만 의미**, **on-water target prompt** ("지금 0.2kt 느려") ProStart 디스플레이에 절대 안 보임.

Axis 부재는 Velocitek **dinghy 1-design 클래스 타겟팅**과 일치 — ILCA, 470, 49er, Optimist 의 polar 가 fleet-wide 동일, 선수 차이는 "target 대비 ±X%" 가 아닌 "fleet 평균 대비 boat handling". Polar/target 은 keelboat (TP52, J/70) 패러다임이며, Velocitek 은 의도적으로 keelboat 시장 포기.

#### §4. 회전 손실 측정 — N/A (자체 SW 부재 → 외부 위탁)

**해당 없음 (Velocitek 자체).** Velocitek 디바이스는 tack/gybe 의 entry/exit speed, turn time, VMG loss 를 디바이스에서 계산하지도, 디스플레이에 표시하지도 않음.

그러나 **.vtk 파일에 4Hz IMU + GPS 모두 기록 → ChartedSails / Sail Njord 가 사후 분석으로 산출할 수 있는 충분한 원시 데이터** 보존:

ProStart Trackpoint 메시지 ([vtk.proto](https://github.com/velocitek/vtk_protocol/blob/master/vtk.proto)):
- `sog_knotsE1` (deciknots) — entry/exit speed
- `cog` (도) — turn angle
- `q1E3, q2E3, q3E3, q4E3` (quaternion × 10³) — heading/heel/pitch (`euler_from_quaternion()` 변환)
- `seconds + centiseconds` — 4Hz (250ms) turn duration

ChartedSails 는 이로부터 "automatic maneuver detection — every tack and gybe with entry / exit speeds and VMG loss" 제공.

**핵심 관찰:** Velocitek 은 IMU 데이터를 **buffer 만 하고 해석 안 함**. ProStart 사양의 "high-precision 3-axis geomagnetic sensor" + "100Hz solid-state 6-axis IMU" 는 모든 raw 신호 캡처 가능하지만, **4Hz 의 통합 quaternion 만 .vtk 에 저장**. 100Hz raw IMU 는 디스플레이의 zero-latency heading lock 에만, 외부 노출 없음. **분석 정확도를 외부에 위탁하되 raw firehose 는 보유 안 함** — 8GB flash 의 1000-hour 기록 용량을 가능케.

#### §5. 통계 패널 / 디스플레이 — distance-to-line · countdown · SOG · COG

**Velocitek 의 본질이 디스플레이에 있다.** 분석 SW 없는 회사가 17년+ 시장 유지한 이유는 **on-water 화면 디자인의 압도적 우위**.

###### ProStart 디스플레이 (4개 큰 숫자, Gorilla Glass)

ProStart 화면 ([velocitek.com/products/prostart](https://www.velocitek.com/products/prostart); [sandiegomarine.com](https://store.sandiegomarine.com/products/velocitek-prostart---generation-2-18970.html)):
- **30mm tall digits**, 120° viewing cone → 6피트 거리 polarized 선글라스 너머 가독.
- **Bonded Gorilla Glass display**, 흰색 on 검정 (high contrast) — 직사광선 deck 최적.
- **User-selectable red / white LED backlight** — 야간 racing 가능.

핵심 UX = **3-버튼 race start workflow** ([chartedsails.com/blog/sailing-with-a-velocitek-prostart](https://www.chartedsails.com/blog/sailing-with-a-velocitek-prostart)):

1. **PIN button** — pin end 옆 지날 때 누르면 GPS 좌표 line endpoint 저장.
2. **RC (committee boat) button** — 반대편 end 저장. 두 점으로 start line 정의.
3. **GUN button** — 5분 (또는 임의) 카운트다운 시작. `+1` / `-1` 버튼으로 분 단위 조정.

이후 ProStart 가 **distance-to-line + burn time** 4Hz 실시간 산출. "Burn time" = 현재 SOG 로 그대로 가면 라인 도달 시간 — 카운트다운보다 작으면 OCS, 크면 늦게 도착. 두 숫자 같이 보면서 sailor 가 ease/trim 직접 결정. dinghy start line 의 **거의 모든 의사결정**.

추가: SOG (knot, 0.1 정확도), COG (degree), heading (magnetic, ±0.5° repeatability).

###### SpeedPuck 디스플레이 (간소화)

ProStart 의 1/3 가격대, 3 모드:
- **Speed Mode** — SOG + heading shift bar
- **Heading Mode** — COG + shift bar
- **Maximum Speed Mode** — 18Hz GPS 에서 샘플링한 1초 평균 max speed

27mm digits, 30-시간 배터리, 자동 shift tracking. **distance-to-line 기능 없음** — speed-only.

###### 디스플레이 철학의 시사점

Velocitek 디스플레이는 **"4-up grid + 큰 글자 + 직사광 가독성"** 의 dinghy 표준을 정의. Vakaros Atlas 2 의 컬러 LCD 와 달리 **monochrome reflective LCD** 고집 — 직사광에서 더 잘 보이고 (e-ink 비슷), 배터리 소모 1/10. 75-시간 vs Atlas 2 ~30시간 (일반 인용)의 차이는 디스플레이 기술 선택에서.

**Danny 시사점:** dinghy/foiling/youth racing 시장에서는 컬러 디스플레이가 advantage 가 아니라 단점일 수 있음. Reflective monochrome + 큰 digits + 단순 4-up grid 가 17년 검증된 패턴.

#### §6. 리플레이 시각 언어 — .vtk → ChartedSails / SailNjord workflow (핵심 axis)

**Velocitek 의 가장 흥미로운 결정은 "리플레이를 만들지 않는다"**. Velocitek Control Center (구형 SW, 단순 file downloader/converter) 만 유지, 실제 race replay 시각화는 **3-party app 에 100% 위탁**.

###### .vtk 바이너리 프로토콜 — open standard 구조

[2022년 블로그 포스트](https://www.velocitek.com/blogs/news/vtk-files) 에 따르면 .vtk 는 ChartedSails 와 SailNjord 개발자와 **공동 설계**:

> "When we were developing the data logging for the new ProStart and SpeedPuck, our initial plan was to log the data as GPX files (a universal standard for GPS data). The ProStart logs magnetic heading, heel, pitch, COG and SOG at 4Hz (four times a second). The SpeedPuck logs GPS data at 4Hz. At this sampling rate the GPX files ended up being so large that they were difficult to work with. After consulting with the developers of ChartedSails and Sail Njord (leading GPS replay and analytics apps), we decided to work with them to develop a much more compact, open binary format called the VTK Protocol."

**Protocol Buffer (Google protobuf) v3 기반 streaming binary format.** GitHub repo ([velocitek/vtk_protocol](https://github.com/velocitek/vtk_protocol)) 의 [vtk.proto](https://github.com/velocitek/vtk_protocol/blob/master/vtk.proto) schema:

```protobuf
syntax = "proto3";
package vtk;

// VTK files contain 0 or more Records where each record is:
//   - 2 bytes that encode the length of the protobuf encoded Record
//   - n bytes for the Protobuf serialized Record

message Record {
    oneof record {
        Trackpoint trackpoint = 1;
        TimerEvent timer_event = 2;
        ButtonEvent button_event = 16;
        HardwareDescription hardware_description = 17;
        MagneticDeclination magnetic_declination = 18;
    };
}

message Trackpoint {
    uint32 seconds = 1;
    uint32 centiseconds = 2;
    sint32 latitudeE7 = 3;      // Lat × 1E7
    sint32 longitudeE7 = 4;     // Lng × 1E7
    uint32 sog_knotsE1 = 5;     // SOG × 10 (deciknots)
    uint32 cog = 6;             // COG in degrees
    sint32 q1E3 = 7;            // Quaternion × 1E3
    sint32 q2E3 = 8;
    sint32 q3E3 = 9;
    sint32 q4E3 = 10;
}

message TimerEvent {
    enum TimerEventType {
        TIMER_NONE = 0; TIMER_STARTED = 1; TIMER_STOPPED = 2;
        TIMER_EXPIRED = 3; TIMER_TICK = 4;
    }
    TimerEventType type = 1;
    int32 seconds = 2;
}

message ButtonEvent {
    enum ButtonEventType {
        BUTTON_NONE = 0; BUTTON_RC = 1; BUTTON_PIN = 2;
        BUTTON_LINE_CLEARED = 3; BUTTON_MAX = 4;
    }
    ButtonEventType type = 1;
}
```

**스키마 분석 — SailTech 에 함의 큰 7가지 디자인 결정:**

1. **Streaming framing** — `(length-prefix uint16 LE) + (protobuf payload)` 단순 반복. 파일 끝까지 records concatenate → **부분 파일 (mid-write power loss) 도 가능한 만큼 디코딩**. Robustness-by-design.
2. **Frequent vs rare message id 분리** — `oneof record` 에서 1-15 (1-byte tag) vs 16+ (2-byte tag). **4Hz × 다중 메시지 → 파일 크기 1차 결정자가 Trackpoint** 이므로 의미 큼.
3. **정수 스케일링** — Lat/Lng `× 1E7` (8.3mm 분해능), SOG `× 10`, Quaternion `× 1E3`. 모두 **floating-point 대신 sint32/uint32** → varint 압축 + 부동소수 비트 안정성. 임베디드 STM32-class 펌웨어 친화적.
4. **Quaternion 으로 attitude 저장** — Euler angles 대신 unit quaternion 4 성분. Gimbal lock 회피 + 평균/보간 정밀도. 디코더 측 `euler_from_quaternion()` 변환. **dinghy 가 heeled 30°, pitched 15° 같은 큰 attitude 자주 갖기 때문**.
5. **Timer state + button events 가 in-stream events** — race start 의 5-min/4-min/1-min hack 시점, pin/RC mark 누른 순간이 별도 message 로 trackpoint stream inline. **.vtk 만 있으면 start line geometry 와 gun 시각이 완전 복원**.
6. **MagneticDeclination 메시지** — declination 을 stream 에 한 번 기록. 디코더 `true_heading = magnetic_heading + declination`. firmware (또는 컴퓨터) 가 lookup 해서 명시 기록.
7. **HardwareDescription** — model_id / hardware_id / firmware_id / serial_number. 분석 도구가 디바이스별 quirk 를 적용할 수 있게.

**파일 크기.** 1 trackpoint ≈ 20-30 bytes (protobuf varint 압축). 4Hz × 3600s × 4 (typical regatta day) ≈ 57,600 records × 25B ≈ **1.4MB/day** — 8GB flash 에서 **1000+ hours**. GPX (XML) 로 저장 시 10–15배 부피.

###### 외부 ecosystem 의 visual language

**실제 시각 언어는 ChartedSails 와 Sail Njord 가 정의:**

**ChartedSails ([chartedsails.com/prostart](https://www.chartedsails.com/prostart)):**
- **Free public uploader** — sign-up 불필요, 브라우저 .vtk → .gpx/.csv 변환 (no data leaves computer). **Velocitek 사용자를 자기 funnel 로 끌어들이는 무료 converter**.
- 정식 분석: race detection (start/beats/runs/mark roundings), automatic maneuver detection (tack/gybe entry/exit + VMG loss), wind detection from track shape, leg-by-leg numbers, shareable Sailing Report PDF.
- 다중 보트 overlay — 같은 fleet 의 여러 .vtk 를 한 session 에 모아 비교.
- ChartedSails 는 **San Mateo, California** 본사 — Velocitek 과 같은 도시. 지역 ecosystem 결속 시사.

**Sail Njord (Njord Analytics + Njord Player):**
- Olympic 코치들 (Bertrand Dumortier FRA, Oliver Freiheit GER, Emmet Lazich AUS 49er, Giulia Conti USA 49erFX) endorsement.
- .vtk 직접 import.
- **Njord Player** — 비디오 + 데이터 sync 디브리프 (TP52, RC44, ClubSwan 50 navigator endorsement).
- **Pay-per-sailing-day** 모델 — 항해한 날만 청구. Velocitek "디바이스만 사고 끝" 철학과 잘 맞는 가격 모델.

**TackTracker ([tacktracker.com/web/kb/velocitek](https://tacktracker.com/web/kb/velocitek)):** 구형 .vcc 포맷 (Velocitek Control Center export) 직접 import. .vtk = 새 디바이스, .vcc = 구형 (SC-1 등).

**QGIS Plugin `vtkimport` ([plugins.qgis.org/plugins/vtkimport/](https://plugins.qgis.org/plugins/vtkimport/)):**
- 2026년 4월 출시 (v1.0).
- "Reads binary .VTK files from Velocitek GPS devices (ProStart 2020+), converts them to CSV, GeoJSON, or loads them directly into a PostGIS database. Bundles the vtk_protocol library from github.com/velocitek/vtk_protocol."
- 저자 Thomas Brus, ETH Zurich (Institute of Cartography and Geoinformation) 후원. **학술 GIS 커뮤니티가 Velocitek .vtk 를 sailing GIS analysis 의 input format 으로 채택**.

이 ecosystem 의 시각 언어는 **"화면 안의 리플레이는 외부, 디바이스는 logger"** 라는 분리를 통해 Velocitek 이 SW 유지보수 부담 없이 17년 운영 가능했음을 보여준다.

#### §7. 가격·하드웨어·생태계·.vtk 오픈 표준 의의 (핵심 axis)

###### 가격 (2026년 3월 인하 발표 후)

[Velocitek 블로그 2026-03-01](https://www.velocitek.com/blogs/news/why-we-re-lowering-prices-on-prostart-speedpuck-prism) 이 "Why We're Lowering Prices on ProStart, SpeedPuck & Prism" 공지. 본 audit 시점 dealer 가격 — San Diego Marine Exchange — ProStart **$895 USD MSRP** ([sandiegomarine.com](https://store.sandiegomarine.com/products/velocitek-prostart---generation-2-18970.html)) 유지. 공식 product page JSON (`"price":79500`, USD cents) → **공식 사이트 직판 $795** vs **dealer MSRP $895**. 인하 발표는 직판가 먼저 반영 추정.

| 시장 | 가격 (audit 시점) | 출처 |
|------|------|------|
| US dealer MSRP | $895 USD | [sandiegomarine.com](https://store.sandiegomarine.com/products/velocitek-prostart---generation-2-18970.html) |
| US 직판 | $795 USD | velocitek.com product JSON |
| UK | £769 | (공개 출처 미확인) |
| EU | €999 | (공개 출처 미확인) |
| 한국 | (공개 출처 미확인) — 정식 distributor 없음 추정 |

SpeedPuck audit 시점 가격은 공개 페이지에 동적 로드 — 일반 $300–400 인용. (공개 출처 미확인).

###### 하드웨어 — Generation 2 (2020+) 스펙

ProStart Gen 2 ([sandiegomarine.com](https://store.sandiegomarine.com/products/velocitek-prostart---generation-2-18970.html), [velocitek.com/products/prostart](https://www.velocitek.com/products/prostart)):
- **GPS**: 72-channel, 25Hz multi-constellation
- **IMU**: 100Hz solid-state 6-axis (3-axis gyro + accel)
- **Magnetometer**: patented high-precision 3-axis, ±0.5° heading repeatability
- **Logging rate**: 4Hz (250ms) for Lat/Lng/COG/SOG/heading/heel
- **Storage**: 8GB onboard flash → 1000 hours
- **Battery**: 75-hour Li-Ion (backlight off)
- **Display**: bonded Gorilla Glass, 30mm digits, 120° viewing cone
- **Case**: 120 × 175 × 40mm, IPX8 (3m / 10ft waterproof)
- **Speed accuracy**: ±0.1 knots
- **Connectivity**: micro-USB only (mass-storage 마운트)

**Made in San Mateo, California** — product page 명시. **17년+ 자체 manufacturing**.

###### 생태계 — 17년 vs Vakaros 잠식

Velocitek 은 **2007년 SC-1** 부터 dinghy GPS 시장 표준. SC-1 단종 ([archive 페이지](https://www.velocitek.com/pages/archive), .vcc 포맷 시절). 현 라인업:
- **ProStart** — race start computer
- **SpeedPuck** — GPS 속도계
- **Prism** — ultralight non-GPS racing compass

Velocitek 사용 base 는 [Sail Njord testimonials](https://www.sailnjord.com/) 가 간접적으로 드러냄 — Olympic 49er/49erFX coaches (FRA/GER/AUS/USA) 가 모두 Njord 를 쓰는데, 그들의 sailors 대부분이 ProStart 사용 (정성 인식, 공식 통계 공개 출처 미확인).

**Vakaros 잠식 패턴 (2018 창업 이후):**
- ChartedSails [Vakaros guide](https://www.chartedsails.com/blog/sailing-with-a-vakaros-atlas) 시장 인식 명시: "The Vakaros Atlas has become the default high-end sailing instrument for one-design racers — Waszp, Melges, J/70, ILCA, Moth, Foiling Optimist programs."
- Vakaros 가 차지한 영역: **high-end one-design + foilers + 신생 클래스** (Waszp, Moth, Foiling Opti).
- Velocitek 이 여전히 강한 영역: **legacy Olympic dinghies** (ILCA 7, 470, 49er, Finn), **club racing**, **entry-level**, **multi-day regatta** (배터리 75h 압도).
- ChartedSails 양쪽 모두 지원 — **third-party 분석 ecosystem 은 vendor-neutral**.

**Velocitek 새 행보 — RTK race management (2026):**
[2026-03-09 CEO Jay Leon letter](https://www.velocitek.com/blogs/news/a-letter-from-velociteks-new-ceo) 와 [2025 NYYC Invitational Cup documentary](https://www.velocitek.com/blogs/news/beyond-the-finish-line-the-2025-invitational-cup-documentary) 새 방향 시사: **"the only RTK GPS automated race management system outside of the America's Cup and SailGP."** ProStart/SpeedPuck 의 sailor-facing 라인이 아니라 **race committee 용 RTK starting/finishing system** → B2B / event-services 시장 확장. Vakaros 가 sailor 시장 잠식하는 동안 Velocitek 은 race-management 인프라로 horizontal pivot.

###### .vtk 오픈 표준의 의의 — Danny 핵심 질문 4가지

**Q1: .vtk 오픈 프로토콜의 산업적 의의.**

**sailing tech 의 rare 한 vendor-neutral 표준**. Sailmon (자체 cloud), Vakaros (RaceSense closed), TackTracker (자체 .vcc) 등 대부분 closed/proprietary. Velocitek 만이 **GitHub 에 .proto 공개 + sample .vtk + Python parser + LICENSE.md 모두 노출**. 결과:
- ChartedSails / Sail Njord / TackTracker / QGIS plugin / Expedition / RaceQs / GPS Action Replay 등 **6+ 외부 분석 도구**가 무료로 ProStart 사용자를 자기 ecosystem 흡수.
- Velocitek 은 SW 엔지니어 0명 유지 (Charles Swanson 의 블로그 글이 사실상 single-author CTO-level activity 만) — 하드웨어 제조 + race-management RTK 에 집중.
- 17년 운영, San Mateo 자체 제조 유지의 비결.

Repo fork 4, star 5 — sailing tech 의 active developer 인구가 매우 작음을 감안하면 의미 있는 traction. QGIS plugin 의 ETH Zurich 후원이 sport-data → academic GIS 의 cross-pollination 까지 끌어내는 데 .vtk 가 reference 역할.

**시사점:** Danny SailTech 가 자체 SW 만들 capacity 제한적이라면, **하드웨어 + 오픈 표준 + 외부 ecosystem 위탁** 의 Velocitek 모델은 검증된 sustainable 패턴. 단 cloud sync / 자동 백업 / video sync 같은 modern 기대 기능 포기 trade-off.

**Q2: 하드웨어 vs SW 의 회사 정체성 분리.**

- **Velocitek**: 2026-03 가격 인하, 새 CEO Jay Leon, 17년 라인업 유지, RTK race management B2B pivot.
- **Vakaros**: "default high-end one-design instrument" — 시장 모멘텀 우위. cloud + subscription 운영 비용 / churn risk 가 long-term sustainable 인지 검증 미완.

**Velocitek 모델 = "lower velocity, lower burn", Vakaros 모델 = "higher velocity, higher burn".** 17년 검증된 sustainability vs 7년 검증된 momentum. 둘 다 정답 없음. **단, hardware-only 회사가 cloud-dependent 회사보다 dinghy/youth 시장 가격 sensitivity 에 더 잘 적응** (75h 배터리 + 무선 없음 → 단순함 + 신뢰성). Danny 가 한국 dinghy/youth 시장 타겟한다면 Velocitek 모델 권장.

**Q3: Olympic 표준 지위의 미래.**

ProStart 의 GPS 정확도 = **±0.1 knot SOG, ±0.5° heading**, 4Hz 샘플링. Vakaros Atlas 2 는 "race-quality GPS" + WiFi + cloud. HALO RTK (별도 audit) 는 cm-level RTK.

ProStart **distance-to-line 정확도는 GPS-only ±1.5–3m** (공식 spec 미공개, 일반 GPS 정확도 추정). RTK 의 cm-level 압도 열세. 그러나 **dinghy start line 의사결정은 ±3m 면 충분** — 라인 1초 burn time × 6kt boat speed = 3m → GPS-only 의 inherent noise floor 가 dinghy decision-making noise floor 와 일치.

**Velocitek dinghy 표준 위치는 단기 (3–5년) 유지**:
- 75-시간 배터리는 Vakaros 가 단기에 따라잡기 어려움 (WiFi/cloud 모듈이 본질적 power drain).
- Class-association 인증 / 합법성 — ILCA, Optimist 일부 class rule 이 onboard electronics 제한, ProStart historically grandfathered.
- 가격 sensitivity — $895 (인하 후 더 낮을 가능성) vs Atlas 2 typical $1500+ range.

**중장기 (5–10년) 잠식 가속:** RTK 가격 하락 + Vakaros 식 cloud workflow 표준화 + youth sailing 디지털 native 화 → ProStart SW-less 모델이 부담으로 인식될 가능성.

**Q4: 75h 배터리의 의미.**

75h 는 sailing 디바이스 카테고리에서 **압도적 outlier**. Vakaros Atlas 2 (정확한 spec 미인용, ChartedSails blog 가 30+h 시사) 대비 2.5×. Sailmon Max 대비 4–5×:
- **Multi-day offshore racing** (Sydney-Hobart, Newport-Bermuda) 의 dinghy/foil class 에서 ProStart 가 살아남는 이유.
- **Junior sailor / school program** — 학생이 매일 충전 잊어도 일주일 regatta 무사.
- **Cold-weather sailing** — Li-Ion 의 0°C 이하 capacity drop 감안해도 50h+ 보장.

Battery trade-off: WiFi/Bluetooth 제거 = 자동 cloud sync 불가 = manual USB workflow. §1, §2 의 N/A 들의 직접 원인.

###### 한국 시장 추정 — distributor 부재

- **공식 한국 distributor 부재** — velocitek.com store/dealer locator 가 EU/UK/US/Australia 위주.
- **한국 dinghy fleet (RS Aero, ILCA 7, 부산 요트 클럽)** 에서 개별 import 사용 사례 추정 (공개 출처 미확인).
- **한국어 매뉴얼 부재 확정** — velocitek.com/pages/manuals 가 영어 PDF only.
- **다나와 / 네이버쇼핑 entry 부재** 추정.

**Danny 시사점:** 한국 dinghy 시장의 Velocitek 채택은 100% 개인 import. **한국어 사용 가이드 / .vtk 분석 한국어 wrapper / ChartedSails 한국어 입문 자료를 만드는 것이 한국 sailor 들에게 매우 낮은 cost 로 high-value 한 기여** — SailTechCo 자체 디바이스 출시 전 시장 진입 전략 활용 가능.

#### §8. 7-axis 종합 결론

Velocitek 은 **"하드웨어 회사" 의 정의를 보여주는 reference case**. 7개 axis 중 4개 (§1 풍향, §2 외부 날씨, §3 폴라, §4 회전 손실) 가 **자체 디바이스에서 N/A** 이고 **외부 ecosystem 에 전적 위탁**. §5 (디스플레이) 와 §6–§7 (.vtk + 생태계) 이 회사의 전부.

이 분리 전략의 핵심 enabler 가 **.vtk Protocol Buffer 표준의 GitHub 오픈 공개** — Velocitek 은 SW 회사 되기를 거부하고 대신 분석 도구 회사들이 자기 디바이스 사용자 흡수할 수 있도록 데이터 포맷 공개. sailing tech 의 vendor-neutral 표준으로 작용.

**Danny 가 SailTechCo 디바이스 설계 시 .vtk 의 7개 패턴 직접 채택 가치:**
1. Protocol Buffer 기반 streaming framing.
2. Frequent / rare message 의 id 분리.
3. 정수 스케일링으로 부동소수 회피.
4. Quaternion 으로 attitude 저장.
5. Timer/Button event 를 trackpoint stream inline.
6. MagneticDeclination 을 stream 에 명시 기록.
7. HardwareDescription 을 stream 에 박아 분석 도구의 device-specific quirk handling.

**산업적 시사점.** Vakaros 가 "the future" 처럼 보이지만, **Velocitek 의 17년 sustainability 는 그 자체로 검증된 모델**. 한국 sailing tech 회사가 작은 팀으로 시작한다면, Velocitek 식 (HW + 오픈 표준 + 외부 위탁) 이 Vakaros 식 (HW + cloud + subscription) 보다 capital-efficient. 단, modern user 의 "자동 sync + 비디오 디브리프 + 모바일 앱" 기대치를 만족 못 하는 trade-off — 이를 ChartedSails / Sail Njord 같은 외부 파트너에게 위탁할 의향이 필수.

#### 출처 요약

**주요 1차:** [velocitek.com/products/prostart](https://www.velocitek.com/products/prostart), [velocitek.com/pages/speedpuck](https://www.velocitek.com/pages/speedpuck), [velocitek.com/pages/developer-resources](https://www.velocitek.com/pages/developer-resources), [velocitek.com/blogs/news/vtk-files](https://www.velocitek.com/blogs/news/vtk-files), [velocitek.com news 2026-03-01 가격 인하](https://www.velocitek.com/blogs/news/why-we-re-lowering-prices-on-prostart-speedpuck-prism), [velocitek.com news 2026-03-09 CEO letter](https://www.velocitek.com/blogs/news/a-letter-from-velociteks-new-ceo), [github.com/velocitek/vtk_protocol](https://github.com/velocitek/vtk_protocol) (vtk.proto + transformations.py + vtktool.py + LICENSE.md 직접 인용).

**2차:** [sandiegomarine.com $895 ProStart Gen 2](https://store.sandiegomarine.com/products/velocitek-prostart---generation-2-18970.html), [chartedsails.com/prostart](https://www.chartedsails.com/prostart) + [chartedsails.com/blog/sailing-with-a-velocitek-prostart](https://www.chartedsails.com/blog/sailing-with-a-velocitek-prostart) + [chartedsails.com/blog/sailing-with-a-vakaros-atlas](https://www.chartedsails.com/blog/sailing-with-a-vakaros-atlas), [sailnjord.com](https://www.sailnjord.com/), [tacktracker.com/web/kb/velocitek](https://tacktracker.com/web/kb/velocitek), [plugins.qgis.org/plugins/vtkimport/](https://plugins.qgis.org/plugins/vtkimport/).

**(공개 출처 미확인):** 한국 시장 데이터, UK/EU 가격 details, Sailing Anarchy 스레드 내용, 다나와/네이버쇼핑 entry.
