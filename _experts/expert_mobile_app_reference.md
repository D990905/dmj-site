# Expert Reference — Mobile App & Integration Engineer

**Role:** Mobile App & Integration Engineer (#8)
**Owner of:** iOS·Android 동반 앱 (SailTechHUB) + 다중 외부 디바이스 통합 (RaceBox · Movesense · Garmin · 표준 BLE HR · Vakaros · Whoop · Oura · Polar · Wahoo · Coros · Suunto · Samsung Health · 자체 SailTechMOTION 센서)
**Version:** v1.0 (Phase 1 — Research + Plan only, production 변경 X)
**Date:** 2026-05-27

> 본 문서는 모바일 플랫폼 선택·BLE GATT·HealthKit·Garmin 3종 프로그램·Store 심사·OTA·13개 외부 디바이스 API audit 을 통합한 expert handover. Phase 1 은 학습 + 결정 framework + Prior Work audit + MVP spec. 모든 spec 은 공식 docs/SDK reference 인용, 추정값은 "estimate" 명시. 모바일 앱은 SailTechCo 의 SailTechMOTION 하드웨어 (#7) 가 데이터를 만들고, 본 앱이 그것을 소비·시각화·동기화하는 cross-cutting 통합 계층.

---

## 0. Context & Reading Map

### 0.1 Why this exists (SailTech 통합 fit)

`02_SailTechHUB/` 에 **Phase 0 SwiftUI iOS 앱 10 파일** 이 이미 작성돼 BLE 3-sensor (RaceBox + Movesense + Garmin) 동시 연결·JSON 세션 기록까지 동작한다. Phase 1 의 본 문서는 그 위에 다음을 얹는다:

| 채워야 할 갭 | 본 문서 §  |
|---|---|
| Android 동반 (현재 iOS only) | §3 플랫폼 결정 |
| 백그라운드 BLE 안정성 (4시간 세션) | §4 BLE GATT |
| 표준 헬스 플랫폼 통합 (HealthKit/Samsung Health) | §5 |
| 자체 SailTechMOTION 센서 OTA | §8 |
| 13 개 외부 디바이스 자동 sync 가용성 | §9 |
| 웹 대시보드 (`site/riding-dashboard/`) 와의 데이터 sync | §11 협업 + §10 MVP |
| Connect IQ 워치 앱 가능성 | §6 |
| Phase 2 Store 출시 (KR + global) | §7 |

→ **Phase 1 = research + plan only.** 실제 Android 코드·Store 제출·Connect IQ 앱 개발은 Phase 2.

### 0.2 Reading map

| Section | 무엇을 찾을 때 |
|---|---|
| §1 핵심 결론 (TL;DR) | 한 페이지 요약 — 플랫폼·디바이스·MVP·블로커 |
| §2 Prior Work Audit | Danny 이전 SailTechHUB 코드 + Garmin 상태 verify |
| §3 Native vs Cross-platform | Swift/Kotlin vs RN/Flutter/Capacitor vs KMP. 우리 use case 결정 |
| §4 BLE GATT essentials | iOS CoreBluetooth + Android BLE API, MTU·permission·background |
| §5 Health platforms | HealthKit · Samsung Health Data SDK · Health Connect · sailing type 매핑 |
| §6 Garmin 3 programs | Connect IQ SDK · Connect Developer API · Health SDK 구분 |
| §7 Store submission 2026 | App Store privacy label · Play Store data safety · KC mark |
| §8 BLE OTA | Nordic DFU · MCUboot/SMP · mobile lib |
| §9 외부 디바이스 audit (13) | RaceBox · Movesense · Garmin · Apple HealthKit · Samsung · Whoop · Oura · Polar · Wahoo · Coros · Suunto · Vakaros · Sailmon |
| §10 Priority matrix + MVP spec | 사용자 수 vs 통합 난이도 + MVP 기능 lock |
| §11 협업 인터페이스 | #7 Hardware · #4 Frontend · #5 UX · #3 Sports Science |
| §12 Decision frameworks | 의사결정 트리 |
| §13 Variables & constants | UUID·상수 cheat-sheet |
| §14 Sources | 모든 인용 링크 |

---

## 1. 핵심 결론 (TL;DR)

**플랫폼 결정.** Phase 0 의 **native iOS (Swift/SwiftUI)** 를 유지·확장하고, Phase 2 에서 **native Android (Kotlin/Compose)** 를 추가하는 **dual-native** 가 1순위 권장이다. 4-sensor 동시 BLE × 25 Hz × 4 시간 백그라운드 + HealthKit/Samsung Health 통합 + 자체 센서 OTA 라는 우리 stack 은 산업 표준(Strava·Wahoo·Garmin·Whoop 모두 native)과 일치하며, Capacitor 는 WebView 백그라운드 정지로 **disqualified** (§3.4), React Native + ble-plx 는 다중 디바이스 multi-device pain points 가 GitHub issue 다수로 검증돼 있다 (§3.2). 단일 코드베이스가 절대 제약이 되는 시나리오만 **Flutter (`flutter_reactive_ble`)** 를 2순위로 고려. 코드 공유가 필요한 경우 **KMP (Kotlin Multiplatform)** 를 데이터 모델·파서·sync 레이어에만 적용 — Philips·Netflix·Cash App 의 production 패턴.

**Prior Work — Garmin status verify (중요).** Danny 가 "이전에 Garmin 개발자 등록·앱 만들었다" 라고 한 것은 **SailTechHUB iOS 앱이 Garmin 시계의 HR 을 표준 BLE HRS (0x180D/0x2A37) 로 읽는 코드** 를 가리킨 것으로 보인다 (§2). 본 repo 내에서 **Garmin Connect IQ 워치 앱 (Monkey C) · Garmin Connect Developer Program OAuth client · webhook endpoint** 의 흔적은 발견되지 않는다. → Danny confirm 필요 § 2.4.

**외부 디바이스 통합 우선순위 매트릭스 (§10 상세).**

| Tier | 디바이스 | 이유 |
|---|---|---|
| **T1 (MVP)** | RaceBox · Movesense · 표준 BLE HRS · Polar H10 · Apple HealthKit · Vakaros (.vkx 업로드) | 개방형 + Korean 가용 + 우리 메인 sensor |
| **T2 (Phase 2)** | Garmin Connect Developer (Activity API) · Samsung Health Data SDK · Whoop API · Oura API · Health Connect (Android) | OAuth/partner 승인 사이클 필요 |
| **T3 (Phase 3+)** | Wahoo (현재 신규 partner 제한) · Coros (private docs, 한국 공식 retail O) · Suunto Cloud · Sailmon (Vakaros 인수 후 API 미공개) · Connect IQ 워치 앱 | 비용/접근/시장 우선순위 후순위 |
| **out** | Garmin Health SDK | medical/clinical partner 전용. 우리 use case 부적합 |

**MVP 모바일 앱 spec (§10.3).** Phase 0 SwiftUI 위에 ① Android native 동등 구현 ② BLE 백그라운드 안정화 (iOS state preservation + Android Foreground Service) ③ HealthKit 워크아웃 세션 (`HKWorkoutActivityType.sailing` 존재 ★) + Samsung Health Data SDK ④ 클라우드 sync (`site/riding-dashboard/` 와 동일 schema) ⑤ Vakaros `.vkx` 업로드 ⑥ Polar AccessLink OAuth (post-session). Out-of-scope: Connect IQ 워치 앱, Whoop/Oura 실시간 sync, 라이브 영상 동기화.

**가장 큰 블로커 3 가지.**

1. **iOS State Preservation & Restoration** 미구현 시 4 시간 라이딩 중 앱이 시스템 종료되면 세션 손실. 현재 `BLEManager` 가 `CBCentralManagerOptionRestoreIdentifierKey` 를 안 씀 → MVP 진입 전 필수.
2. **Android 12+ BLE permission 모델** (`BLUETOOTH_SCAN`/`CONNECT` + `neverForLocation` flag) — Phase 0 iOS-only 라 미경험 영역. Foreground Service `connectedDevice` type 필수.
3. **Samsung Health 의 partner approval cycle** — Korean market 의 Galaxy 사용자 비중을 고려하면 Phase 2 진입 전 partnership 신청 시작 권장 (승인 estimate 4–8 주).

---

## 2. Prior Work Audit (Danny handover)

### 2.1 Scope

| 위치 | 결과 |
|---|---|
| `02_SailTechHUB/src/` (Swift 10 파일) | **iOS Phase 0 거의 완료** — Phase 0.1 "프로덕션 준비 완료" 명시 (`docs/README.md`) |
| `02_SailTechHUB/docs/` (README/SETUP_GUIDE/INFO_PLIST_REFERENCE/CODE_ARCHITECTURE/QUICK_START) | 문서화 완비 — 새로 시작이 아니라 이어받기 |
| `세일링 코칭시스템 개발/CLAUDE.md` | 브랜드 아키텍처 + Phase 0 완료/진행 항목 정리 (2026-04-20 기준) |
| `99_backup_20260420/` | 4월 20일 재구조화 전 백업 — 의미있는 신규 파일 없음, 동일 트리 복사 |
| `site/_experts/expert_hardware_embedded_reference.md` | 자체 센서 (SailTechMOTION) BOM·BLE GATT spec lock 대기 명시 |
| `site/riding-dashboard/js/vkx-parser.js` | Vakaros VKX 1.4 binary parser 완비 (10Hz heel/pitch quaternion 변환 포함) — 웹 측 |
| `site/_research/sailing_analytics_landscape_audit.md` | 35 개 sailing analytics SW landscape 카드 진행 중 — 본 모바일 doc 의 sister 문서 |

### 2.2 SailTechHUB Phase 0 — 실제 무엇이 동작하나

`02_SailTechHUB/src/BLEManager.swift` 직접 audit 결과:

| 항목 | 상태 | 근거 (코드 라인) |
|---|---|---|
| **BLE Central Manager** | 동작 | `CBCentralManager(delegate:queue:.main)` (line 91), state machine 5 상태 (poweredOn/Off/unauthorized/unsupported/resetting) |
| **RaceBox Micro** | **연결 + Sea Mode 명령 + 80-byte payload 파싱 완비** | `BLEUUIDs.raceboxServiceUUID = 6E400001-…CCA9E` (Nordic UART), Sea Mode bytes `[0xB5, 0x62, 0xFF, 0x27, 0x03, 0x00, 0x05, 0x00, 0x1E, 0x4A, 0x1A]` (line 170), `RaceBoxParser` FIFO + Fletcher checksum |
| **Movesense HR** | 표준 BLE HRS 로 동작 | `0x180D` / `0x2A37` (line 22), HR Format flag (8/16-bit) 처리 |
| **Garmin HR** | **표준 BLE HRS 로만 동작** | `0x180D` / `0x2A37` 동일, name 매칭 `"Forerunner"` / `"Garmin"` 으로 타입 라벨링만 분리 (line 249). **Connect IQ 통신·ANT+·확장 characteristic 없음.** |
| **세션 기록 + JSON 저장** | 동작 | `SessionRecorder.endAndSave()` → `Documents/SailCoach/sailcoach_YYYYMMDD_HHMMSS.json` (line 56–88), iso8601 인코딩 + pretty-printed |
| **세션 schema** | 정의됨 | RaceBoxData (lat/lng/alt/speedKnots/heading/gforceXYZ/roll/pitch/yaw/inputVoltage), MovesenseData (HR/RR), GarminData (HR only) |
| **UI** | SwiftUI 3 tab (대시보드/센서/세션) | `ContentView` 진입 → `DashboardView` (실시간 속도/heading/heel/HR/G-force/GPS quality) + `SensorStatusView` (스캔/연결) + `SessionView` (보드 길이 입력·기록·share) |

### 2.3 무엇이 없나 (Phase 1 의 갭)

| 항목 | 상태 |
|---|---|
| Android (Kotlin/Compose) | **없음** — iOS-only |
| iOS State Preservation & Restoration | **없음** — `CBCentralManagerOptionRestoreIdentifierKey` 미사용 |
| `bluetooth-central` UIBackgroundMode | docs/INFO_PLIST_REFERENCE.md 에 plan 만 있고 실제 Info.plist 적용 verify 미확인 |
| HealthKit 통합 | 없음 — `HKHealthStore` import 없음, `HKWorkoutSession` 없음 |
| Samsung Health / Health Connect | 없음 (iOS-only 이므로 당연) |
| Vakaros `.vkx` import | iOS 측 없음 (웹 측만 있음) |
| Polar AccessLink / Whoop / Oura / Garmin Connect Developer | 없음 |
| Cloud sync (서버 측) | 없음 — Documents 폴더 로컬 JSON 만 |
| 자체 센서 (SailTechMOTION) OTA | 없음 — SailTechMOTION 자체가 EVT 전이라 자연스러움 |
| OAuth client (Garmin/Whoop/Oura/Polar/Wahoo/Suunto) | 없음 |
| Connect IQ 워치 앱 (Monkey C) | 없음 |
| Garmin Connect Developer Program 등록 | **추정: 없음** — webhook endpoint·OAuth callback URL·client_id 흔적 없음 |
| 단위 테스트 / UI 테스트 | docs 에 "Future" 로 명시 |

### 2.4 Danny 의 "Garmin 개발자 등록·앱" 발언 — 정합성 분석

**관찰 사실:**

1. `BLEManager.swift` 의 Garmin 처리는 **표준 BLE HRS (0x180D/0x2A37) 단일 경로 만** 존재 (line 22–26).
2. Garmin Connect Developer Program 의 흔적 (OAuth 1.0a client, callback URL, HMAC-SHA1 서명 코드, webhook endpoint) 은 SailTechHUB · `세일링 코칭시스템 개발` · `단무지공방 홈페이지 만들기/site` 어디에도 없음 (`Grep`: `garmin|connect.iq|developer|api.*key|client.*id` → 6 파일 매치, 모두 단순 description·BLE UUID 언급).
3. Connect IQ (Monkey C) 파일 (`.mc`·`.iq`·`manifest.xml`) 부재.

**가능 시나리오 (3):**

| 시나리오 | 가능성 | 근거 |
|---|---|---|
| **(A) "앱" = SailTechHUB iOS 앱**. Garmin Forerunner 935 를 표준 BLE HR sensor 로 인식·이름 매칭·HR 표시 — 이걸 Danny 가 "Garmin 앱 만들었다" 라고 회상 | **가장 높음** | 코드 fact 와 일치. `BLEManager.swift` line 249 의 `"Forerunner"`/`"Garmin"` 분기 |
| (B) Connect Developer Program 에 client 만 등록하고 코드는 안 만듦 (대시보드 등록 상태) | 중 | repo 검증 불가. Danny 본인 confirm 필요 |
| (C) Connect IQ 워치 앱을 별도 repo 에서 개발 | 낮음 | `세일링 코칭시스템 개발/` 어디에도 Monkey C 파일 없음. 시간상으로도 Phase 0 우선 |

**권장 verify 항목 (Danny 에게):**

- [ ] developer.garmin.com 의 본인 계정 dashboard 캡처 — Connect IQ 앱 / Connect Developer Program 등록 상태
- [ ] Connect IQ Store 의 본인 publisher 페이지 URL (있다면)
- [ ] Garmin Connect Developer Program 의 OAuth 1.0a consumer_key / consumer_secret 발급 여부
- [ ] webhook endpoint URL 등록 여부

**Phase 1 진행 가정:** (A) 가정 — 즉 Garmin = 표준 BLE HR consumer 로 처리. Connect IQ 워치 앱·Connect Developer Program 은 §6 에서 Phase 2/3 옵션으로 다룸. Danny 가 (B)·(C) confirm 시 본 문서 §6.5 의 timeline 단축 가능.

### 2.5 보존 원칙

Phase 1 제약 "이전 결과물 보존, revert 금지" 준수:

- 본 산출물 = `_experts/` 폴더 신규 파일. `02_SailTechHUB/src/*.swift` 어떤 파일도 수정·삭제 없음
- Phase 0 의 SwiftUI MVVM + Combine 아키텍처를 **decision lock** 으로 간주 → Android 도 동등 패턴 (Kotlin Compose + ViewModel + Flow) 으로 권장 (§3)
- `세일링 코칭시스템 개발/02_SailTechHUB/` 브랜딩 `SailCoach` → `SailTech` 치환은 docs 의 "대기" 항목 — 본 문서는 신규이므로 처음부터 `SailTech` 표기 (CLAUDE.md naming 규칙 준수)

---

## 3. Native vs Cross-platform — 결정 framework

### 3.1 5 후보 한 줄 정리

| 후보 | 한 줄 |
|---|---|
| **Native dual** (Swift/SwiftUI iOS + Kotlin/Compose Android) | 두 platform 의 BLE·백그라운드·HealthKit 을 각자 OS-native 로. 가장 안전·최고 성능, 두 codebase 유지 비용 |
| **Native + KMP shared logic** (Compose Multiplatform 으로 UI 까지 공유 옵션) | 위와 같으나 데이터 모델·파서·sync·분석 알고리즘만 Kotlin 으로 한 번 작성. Philips·Cash App 패턴 |
| **Flutter** (`flutter_reactive_ble` + Dart AOT) | 단일 codebase, Reactive BLE 가 multi-device 명시 설계 |
| **React Native** (Hermes V1 + `react-native-ble-plx`) | JS 생태계, JSI 로 bridge 비용 ↓. ble-plx 의 multi-device pain points |
| **Capacitor / Ionic** | 웹 기술 (Cordova 후예). WebView 백그라운드 정지 — **우리 use case 부적합** |

### 3.2 우리 use case 평가 매트릭스

평가 축 7개. 5점 척도 (5 = 최고).

| 축 | Native dual | Native+KMP | Flutter | React Native | Capacitor |
|---|---|---|---|---|---|
| **Multi-device 동시 BLE** (4 sensors × 4 시간) | 5 | 5 | 4 (Reactive BLE 다중 명시) | **2** (`react-native-ble-plx` GitHub issue #540·#611·#721·#747·#1247 다중 디바이스 이슈) | **1** (WebView pause) |
| **백그라운드 BLE 안정성** | 5 (iOS preservation, Android FGS) | 5 | 4 (plugin 의존, 매뉴얼 wiring) | 3 (RN 측 wrapper 부족) | **0** (WebView 백그라운드 ~5 분 후 정지) |
| **HealthKit / Samsung Health / Health Connect** | 5 (직접 SDK) | 5 | 3 (`health` package, native bridging) | 3 (`react-native-health`, 유지보수 불균일) | 2 (plugin 부족) |
| **25 Hz raw byte 파싱 + Fletcher checksum** | 5 (compiled native) | 5 | 4 (Dart AOT, FFI) | 3 (Hermes V1 JIT, JSI 개선) | 2 (JS in WebView) |
| **Connect IQ 워치 앱 가능성** | 5 (Garmin Companion App SDK 둘 다 지원) | 5 | 3 (community wrapper) | 3 (동일) | 2 |
| **개발 인력 비용** | 2 (2 platform 코드) | 3 (UI 따로, logic 공유) | **5** (1 codebase) | **5** | **5** |
| **장기 유지보수 risk** | 5 (Apple/Google 직지원, 영구) | 5 | 3 (Google 의지 의존, 단 production 광범위) | 3 (Meta 의지 의존, Hermes V1 같은 큰 변화) | 4 (Ionic 기업 안정) |
| **가중 평균** (각 5 → multiply) | **32 / 35** | **33 / 35** | 26 / 35 | 21 / 35 | 16 / 35 |

→ **1순위 = Native + KMP shared logic.** UI 와 OS-native 통합은 platform 별 native, 비-UI 비즈니스 로직 (RaceBox 파서·세션 schema·sync·분석 알고리즘) 만 Kotlin Multiplatform 으로 단일화.
→ **2순위 = Native dual (no KMP)** — KMP 도입 학습 곡선이 우려되면.
→ **3순위 = Flutter** — 1 인 개발자 강제 단일 codebase 시.
→ **out: React Native + Capacitor.**

### 3.3 산업 패턴 (검증)

| 앱 | Stack | 출처 |
|---|---|---|
| **Strava** | Swift (iOS) + Kotlin (Android) — native dual | labs.strava.com 의 framework 태그 + GitHub 공개 repos |
| **Wahoo** (ELEMNT companion · SYSTM) | Swift + Kotlin native — 54 public repos | wahoofitness.com/careers Swift/Kotlin engineer 모집 |
| **Garmin Connect mobile** | Swift + Kotlin native — 워치는 Monkey C 별도 | developer.garmin.com structure |
| **Whoop / Oura 모바일** | Native | Native iOS/Android job postings (themomentum.ai healthtech 가이드) |
| **Philips connected health** (toothbrush·air purifier 동반 앱) | **KMP for logic, native BLE per platform** | "There was so much difference in the BLE interfaces that you cannot come up with a design that matches them both" — STRV Medium |

→ **multi-sensor sports 도메인의 production 패턴은 거의 100% native (logic 공유 옵션 KMP).** Cross-platform 단독 사례는 보이지 않음.

### 3.4 Capacitor disqualifier (구체 근거)

`capacitor-community/bluetooth-le` Discussion #679: Android JS 실행 ~5 분 백그라운드 후 정지. iOS Core Bluetooth state restoration 미지원. cap-go `bluetooth-low-energy` 는 Android Foreground Service 우회만 제공 (iOS 백그라운드 X). **4 시간 라이딩 세션 = 1 회 사용 시 매번 백그라운드 데이터 손실 risk.** → 우리 use case 의 hard fail.

### 3.5 React Native pain points (구체 근거)

`dotintent/react-native-ble-plx` 검증된 다중 디바이스 issue: #540, #611, #721, #747, #1247 — "Device is already connected", "Operation was cancelled" 가 2–3 디바이스 이상에서 반복 보고. Writes-without-response 가 iOS 의 ~10-entry 내부 큐를 넘으면 silent drop. iOS 에서 notify vs indicate 선택 불가. Negotiated MTU 조회 불안정. base64 인코딩 강제 → 25 Hz × 4 sensor 시 CPU 부담. (`Wiki: Characteristic Notifying`, Issue #1291)

### 3.6 Flutter 강점 (2순위 후보)

`flutter_reactive_ble` (Philips Hue 유지보수) 의 라이브러리 모토가 "handles BLE operations for **multiple devices**" 임. `connectToDevice` 가 device 마다 독립 stream subscription. Device ID 는 iOS UUID / Android MAC (random address caveat 명시). Dart AOT 컴파일 → bridge 없음. Compose Multiplatform 도 stable (2025 년 5월) — UI 공유까지 가능하나, 우리 use case 에서 UI 는 platform-native 가 더 자연스러움.

---

## 4. BLE GATT essentials

### 4.1 Service / Characteristic discovery flow

```
연결 후:
1. discoverServices()
2. for service in services: discoverCharacteristics(for: service)
3. for char in characteristics:
   - char.properties 확인 (.read .write .writeWithoutResponse .notify .indicate)
   - .notify 라면: setNotifyValue(true) → CCCD 0x2902 write
4. (필요시) requestMtu(247)  ← Android only
```

iOS 는 `setNotifyValue:` 가 CCCD write 를 내부 처리. Android 는 `BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE` 를 명시 write 필요.

### 4.2 Notify vs Indicate

| | Notify (0x10) | Indicate (0x20) |
|---|---|---|
| ACK | 없음 | 있음 — peer 가 confirm 보낼 때까지 server 차단 |
| 속도 | 빠름 | 느림 |
| 손실 | 가능 | 없음 |
| 우리 use case | **25 Hz sensor stream → notify** | DFU progress·alarm 같은 rare critical 만 |

### 4.3 MTU negotiation

- Default ATT MTU = **23 bytes** (20 payload + 3 ATT header)
- BLE 5.0 max = **247 bytes**
- **iOS** 자동 negotiate, 대부분 **185 bytes** 로 landing. iOS 앱은 MTU 를 programmatically 요청 불가
- **Android** API 21+ 에서 `BluetoothGatt.requestMtu(int)` — `onServicesDiscovered` 후 1 회 호출. ~15% throughput ↑, power ↓

### 4.4 Connection interval (Apple Accessory Design Guidelines)

| 용도 | Interval |
|---|---|
| HID over GATT | 11.25 ms (특례) |
| 일반 low-latency | **15–30 ms** (15 ms 의 정수배만 허용) |
| 우리 25 Hz sensor | 15–30 ms 충분 (40 ms 샘플 주기) |

Apple 은 L2CAP 의 Connection Parameter Update Procedure 로 non-conforming peripheral 요청 거부. Peripheral 펌웨어 (자체 센서 + Sea Mode 의 RaceBox) 는 15 ms multiples 준수 필수.

### 4.5 iOS permissions

| Key | 의무 시점 |
|---|---|
| `NSBluetoothAlwaysUsageDescription` | **iOS 13+ 의무.** 모호한 문구 ("앱이 BLE 를 사용합니다") = App Store 반려. **어느 디바이스·어느 데이터** 를 구체 명시 |
| `UIBackgroundModes` + `bluetooth-central` | 백그라운드 BLE 필수 |

### 4.6 Android 12+ permissions (API 31+)

Legacy `BLUETOOTH` + `BLUETOOTH_ADMIN` + `ACCESS_FINE_LOCATION` 폐기되고 **3 개 runtime permission** 으로 재설계:

| Permission | 의무 |
|---|---|
| `BLUETOOTH_SCAN` | 스캔. `android:usesPermissionFlags="neverForLocation"` 시 location 권한 면제 |
| `BLUETOOTH_CONNECT` | 연결 |
| `BLUETOOTH_ADVERTISE` | (peripheral 역할 시) |

→ Foreground Service 시작 순간 `BLUETOOTH_CONNECT` 보유 필수. Legacy 들은 `maxSdkVersion="30"` 으로 명시 제한.

### 4.7 백그라운드 BLE (두 OS 의 모델 차이)

**iOS — State Preservation & Restoration.**

```swift
let opts: [String: Any] = [CBCentralManagerOptionRestoreIdentifierKey: "com.sailtechco.hub.central"]
self.centralManager = CBCentralManager(delegate: self, queue: .main, options: opts)
```

- 재시작 시 `centralManager(_:willRestoreState:)` 와 `application:didFinishLaunchingWithOptions:` 의 `UIApplicationLaunchOptionsBluetoothCentralsKey` 로 복원
- User force-quit / BT toggle off 에는 복원 X
- 백그라운드 스캔: **service-UUID filter 필수** (`scanForPeripherals(withServices:)`). `CBCentralManagerScanOptionAllowDuplicatesKey` 백그라운드 무시. Non-connectable advertisement 무시

**Android — Foreground Service (FGS).**

```xml
<service
    android:name=".BleService"
    android:foregroundServiceType="connectedDevice"/>

<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE"/>  <!-- API 34+ -->
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
```

- API 34 (Android 14)+ : `FOREGROUND_SERVICE_CONNECTED_DEVICE` 동시 의무
- Persistent notification 필수 (sailing 세션 중 "라이딩 기록 중" notification)

### 4.8 흔한 함정 (sub-bullet)

- iOS 백그라운드 스캔: service-UUID filter 없으면 callback 0 회. duplicates 무시. 비-connectable adv 무시. 시스템 sampling interval undocumented → peripheral 광고 빈도 낮으면 miss
- Android: 모든 GATT op (read·write·subscribe·MTU·RSSI) 직렬 큐 필요. Library 없이 직접 호출 시 silent drop
- 잃어버린 notification: CCCD write 누락·재페어 후 bond 잃음·queue 없음
- iOS 의 writes-without-response 내부 큐 limit (10) — 25 Hz × 다수 sensor 의 명령 write 시 주의

### 4.9 우리 Phase 0 코드 — gap fix 권장 (P1)

```swift
// 현재 (BLEManager.swift line 91):
self.centralManager = CBCentralManager(delegate: self, queue: .main)

// Phase 2 권장:
let opts: [String: Any] = [
    CBCentralManagerOptionRestoreIdentifierKey: "com.sailtechco.hub.central"
]
self.centralManager = CBCentralManager(delegate: self, queue: .main, options: opts)
// + AppDelegate 의 application:didFinishLaunchingWithOptions: 에서
//   UIApplicationLaunchOptionsBluetoothCentralsKey 처리
// + centralManager(_:willRestoreState:) 구현
```

---

## 5. HealthKit · Samsung Health · Health Connect

### 5.1 HealthKit (iOS)

**Permission keys (Info.plist 의무):**

- `NSHealthShareUsageDescription` — read
- `NSHealthUpdateUsageDescription` — write

**Sailing 워크아웃 타입 — 존재 ★:**

```swift
HKWorkoutActivityType.sailing  // raw value = 57, iOS 8+/watchOS 2+
```

→ Phase 0 의 `SessionRecorder` 는 자체 JSON 만 저장 — HealthKit 미연동. Phase 2 에서 `HKWorkoutConfiguration(activityType: .sailing, locationType: .outdoor)` + `HKWorkoutSession` + `HKLiveWorkoutBuilder` 로 wrapping 시 Apple Watch 에서 standalone 세션 + iPhone 동기화 가능.

**관련 sample types:**

| 우리 데이터 | HealthKit |
|---|---|
| 심박 | `HKQuantityTypeIdentifier.heartRate` |
| HRV | `heartRateVariabilitySDNN` |
| 활동 칼로리 | `activeEnergyBurned` |
| 라이딩 경로 | `HKWorkoutRoute` (CLLocation 기반) |
| 라이딩 거리 | (Sailing 전용 distance type 없음 — `HKWorkout.totalDistance` 자체에 저장) |

**Background delivery 한계:**

- `enableBackgroundDelivery(for:frequency:)` — 대부분 type 은 ~hourly throttle. `.immediate` 가능한 type 일부 한정
- **watchOS** 의 `WKApplicationRefreshBackgroundTask` 예산 = **약 4 회/hour** + 활성 complication 필요
- Completion handler 3 회 miss = 시스템이 exponential backoff
- Device locked 동안 read block (write 는 queue)
- → **실시간 텔레메트리는 `HKWorkoutSession` 으로 foreground 우선** (watchOS standalone 시), iPhone-only 면 본 앱이 foreground 또는 BLE FGS 가 prime path

### 5.2 Samsung Health (Galaxy 사용자 — KR 핵심)

**Legacy Samsung Health SDK for Android = 2025-07-31 deprecated.**

새 stack (3 SDK, partner 승인 모델):

| SDK | 역할 | 승인 |
|---|---|---|
| **Samsung Health Data SDK** (phone) | Android 폰에서 Samsung Health 의 user data read/write | Partner 신청 + package name + release SHA-256 등록 |
| **Samsung Health Sensor SDK** (Wear OS) | Galaxy Watch4+ 의 raw accel / ECG / PPG / **IBI (inter-beat interval)** | 동일 partner 승인 + signature |
| **Samsung Health Accessory SDK** | 3rd-party BLE peripheral 을 Samsung Health 에 연결 (peripheral side, 우리 SailTechMOTION 향후) | 동일 |

요구:
- Samsung Health 앱 **v6.30.2+**
- Android **10 (API 29)+**
- 비-Samsung Android 폰에도 동작

**Approval cycle estimate.** Samsung dev 포털 partner 신청 → review → SDK_POLICY ERROR 면 미승인. 신청 시점 → 운영 권한 estimate **4–8 주** (공식 SLA 미공개, dev forum 보고 기반).

**Galaxy Watch ↔ 3rd-party iPhone 앱 직결:**

| 가능성 | 결과 |
|---|---|
| iPhone 앱이 Galaxy Watch 를 표준 BLE HRS 로 직접 페어 | **불가능** — Galaxy Watch 는 0x180D 를 non-Samsung-Health-paired 폰에 advertise 안 함 |
| Wear OS 에 own app 설치 (Sensor SDK 사용) → BLE re-broadcast | 가능, 하지만 Samsung 파트너십 필요 |
| Android 폰 + Samsung Health Data SDK → 클라우드 sync → iOS 앱 사용 | 표준 경로 |

→ **결론: 한국 Galaxy 사용자 지원하려면 Samsung Health Data SDK + Phase 2 Android 앱 필수.**

### 5.3 Health Connect (Android)

**Google Fit 종료** — 새 signup 2024-05-01 종료, mobile API 종료 estimate **late 2026**.

**Health Connect** 대체:

| Android 버전 | 형태 |
|---|---|
| Android 14+ | OS framework 내장 |
| Android 13- | Play Store APK 별도 |

- 단말 내 store + 공통 schema + 중앙화 permission UX
- 서버 측: Google Health API (구 Fitbit Web API) 가 Fit REST 대체

**ExerciseSessionType 의 sailing.** Health Connect 공식 reference 의 80+ exercise code 중 **sailing 전용 없음**. 인접: `EXERCISE_TYPE_OTHER_WORKOUT` / `EXERCISE_TYPE_PADDLING` / `EXERCISE_TYPE_WATER_POLO`. → **`OTHER_WORKOUT` + custom title/description 으로 저장**, sailing/foiling/kiteboarding subtype 는 우리 backend 에 별도 저장.

### 5.4 우리 결정 (lock)

| Platform | 라이브러리 | sailing 매핑 |
|---|---|---|
| iOS | HealthKit | `HKWorkoutActivityType.sailing` ★ |
| Android (Galaxy) | Samsung Health Data SDK + Sensor SDK | `OTHER_WORKOUT` + 자체 subtype |
| Android (일반) | Health Connect | `OTHER_WORKOUT` + 자체 subtype |

→ iOS sailing 매핑이 native first-class 라는 비대칭은 데이터 query·watchOS 표시·시각화에서 iOS 가 약간 유리한 결과.

---

## 6. Garmin — 3 distinct programs (혼동 주의)

Garmin 의 "developer" 는 **3 개 program** 이 분리돼 있다. 흔한 confusion.

### 6.1 Connect IQ SDK — on-device 워치 앱

- 언어: **Monkey C** (Garmin proprietary, 2014 도입)
- 빌드: VS Code extension (SDK Manager). **무료**, partner approval 불필요
- 산출물: 워치 face / data field / widget / 전체 app — 워치 자체에서 동작
- BLE 능력 (Connect IQ 8, 2025 rollout): `Sensors.SensorDelegate` / `BluetoothLowEnergy` API 로 워치가 **BLE central** 역할 → 우리 자체 SailTechMOTION 센서를 워치가 직접 페어 가능
- **워치가 peripheral 로 custom characteristic advertise 불가** — "Garmin 워치를 우리 iPhone 앱이 custom BLE 로 직결" 불가능. ANT 는 plain master 가능 (ANT+ master 는 금지)
- 워치 ↔ 폰 통신: Connect IQ Companion App SDK for iOS/Android + Monkey C `Communications` module

**Connect IQ Store 출시:**

- **연 fee USD $100** — paid app 출시 시만 필요한 merchant 등록. 무료 app 은 friction 낮음
- **Revenue share 15%** (Apple/Google 30/15% 대비 낮음)
- 수동 review (Connect IQ App Review Guidelines)
- 한국 storefront 지원

**참고: 출시된 sailing Connect IQ 앱 (시장 검증):**

- **Sail Racer** by SailRacer.net — 60,000+ users, full tactical (current·wind·layline·polar)
- **Sail2WIN**, **Yet Another Sailing App**, **Sailing** (knots tracker), **Sailing waypoints with maps**
- 오픈소스 ref: github.com/dmrrlc/connectiq-sailing

→ 시장은 형성돼 있음. 우리 SailTechCOACH (실시간 AI 코칭) 일부를 워치에서 표시하는 Phase 3 옵션은 매력적 (HUD-like).

### 6.2 Garmin Connect Developer Program — 서버측 (Activity API + Health API)

- **Auth: OAuth 1.0a + HMAC-SHA1** (현재 Garmin 만 1.0a 유지 — 다른 모든 sports/wearable API 는 OAuth 2.0)
- **Push 모델: webhook** — 사용자가 Garmin Connect 에 sync 하면 Garmin 이 our callback URL 에 POST
- **Activity API:** `.FIT` / `.GPX` / `.TCX` 전체 활동 파일
- **Health API:** daily summaries / epochs / sleep / HRV / stress / pulse-ox / respiration (JSON)
- **승인 모델: partner 신청 + Garmin 심사**
- **비용:**
  - 플랫폼 platform fee 없음
  - **Health API 상용 사용 = 별도 license fee 또는 device MOQ commitment** (case-by-case)
  - Activity API evaluation 무료

→ 우리 사용 우선순위: **Activity API** 가 1순위 (sailing/foiling 의 .FIT 파일 가져오기). Health API 는 비용 risk → Phase 3 고려.

### 6.3 Garmin Health SDK — embedded medical/clinical partner

별도 SDK, medical/clinical partner 전용 gating. **우리 use case 부적합** — skip.

### 6.4 우리 BLE 측 Garmin = 표준 BLE HRS 만

- 0x180D / 0x2A37 / 0x2A38 (Body Sensor Location). HRM-Pro/HRM-Run 의 Running Dynamics·swim 메트릭은 **ANT+ 또는 Garmin proprietary BLE characteristic** 사용 → 표준 2A37 만 읽는 3rd-party app 은 **HR + (RR present flag 시) RR interval** 만 획득
- Phase 0 의 `BLEManager.swift` 가 이미 정확히 이 경로

### 6.5 Connect Developer / Connect IQ — 우리 timeline 옵션

| Phase | 항목 | 비용·승인 |
|---|---|---|
| **Phase 2 (MVP+1)** | Connect Developer Activity API partner 신청 | 무료 (Activity API), 승인 estimate 2–6 주 |
| Phase 3 | Connect IQ Store 워치 앱 (SailTechHUB Companion) — 표시·실시간 cue | dev 무료, 출시 $100/yr (paid 시), 시장 검증된 (Sail Racer) |
| **out** | Garmin Health API 상용 | 비용·MOQ 모호, skip |

**Danny verify 항목 (재게재):** 본인 developer.garmin.com 계정 dashboard 의 현재 등록 상태. (B) 시나리오 (등록만 됨) 라면 Phase 2 진입이 즉시 가능.

---

## 7. App Store + Play Store submission (2026)

### 7.1 iOS App Store — Privacy Nutrition Label

- iOS 14.3+ 의무 (2020-12). 3rd-party SDK 가 수집하는 데이터까지 declare
- HealthKit + motion/sensor → "Health & Fitness" + "Sensitive Info"
- **2024+ 추가:** Privacy Manifest + SDK signatures. RN ble-plx · `flutter_reactive_ble` 모두 현재 매니페스트 publish (native swift 는 우리가 직접 작성)
- Opt-out 면제 = 4 조건 동시 (no tracking + infrequent + not primary + user-volunteered)

### 7.2 iOS HealthKit + Bluetooth disclosure

Info.plist 3 키 동시 필요:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>SailTechHUB은 라이딩 세션 동안 RaceBox·Movesense·심박 센서·SailTechMOTION 자체 센서와 연결하기 위해 블루투스를 사용합니다.</string>
<key>NSHealthShareUsageDescription</key>
<string>심박·라이딩 세션 데이터를 읽어 코칭 분석에 활용합니다.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>라이딩 세션을 Apple 건강의 '세일링' 워크아웃으로 저장합니다.</string>
```

App Store Connect 에 privacy policy URL 의무.

### 7.3 Play Store — Data Safety form

- 모든 앱 의무. data type · sharing · security practices declare
- **2025-04 정책 업데이트:** Android ID 재분류, "sharing" 정의 강화 (SDK 가 자기 목적으로 사용 시도 sharing)
- Health & medical 앱은 **Health Apps Declaration form** 추가 + 정책 URL. 트리거: `ACTIVITY_RECOGNITION`, `BODY_SENSORS`, Health Connect, Google Fit
- 2025 enforcement: 255,000+ 앱 block, 80,000+ 계정 ban

### 7.4 첫 제출 timeline

| 플랫폼 | Estimate |
|---|---|
| iOS App Store | 90% 24 hr 이내 review. **첫 제출 + health 앱 = 48–72 hr.** iOS launch week (Sep) 시 3–5 일. 최적 window = 화–목 US 영업시간 |
| Google Play | **첫 제출 = 7+ 일** (2023-11 부터 새 dev 계정은 closed testing 20 명 × 14 일 → production 권한 의무) |

### 7.5 KC mark (Korea)

- KC mark = **물리 디바이스의 무선 인증.** 소프트웨어 앱 자체는 KC 인증 불요
- **SailTechMOTION 자체 센서 = KC 의무** (RRA, Radio Research Agency 인증). KS (Korean Testing Standards) 적용 — EN/FCC report 미인정. 한국어 매뉴얼 필수. → `expert_hardware_embedded_reference.md` §7.1 의 KC 4–8주 / $4k–12k estimate 와 일치
- **앱은 별도. App Store/Play Store 심사로 충분**

### 7.6 우리 Phase 2 출시 sequence (권장)

```
Week -2: Privacy policy URL 작성·게재 (단무지공방 사이트 /privacy-mobile.html)
Week -1: Info.plist + Manifest finalize, App Store Connect/Play Console 앱 등록
Week 0:  iOS TestFlight 내부 테스트 (Danny + 코칭 선수 ~5 명)
Week 0:  Android Closed testing 시작 (20 인 14 일 카운트 시작)
Week 2:  iOS production 제출
Week 3:  iOS 통과 → 한국·일본·미국·EU 동시 release (대만·홍콩 제외)
Week 4:  Android production 권한 획득 → 제출
Week 5:  Android 통과 → release
```

---

## 8. BLE OTA — DFU vs MCUboot/SMP

### 8.1 Nordic Legacy DFU (nRF5 SDK)

- **Secure DFU** (SDK 12.0+): signed firmware images
- **Buttonless DFU:**
  - SDK 12 experimental
  - SDK 13 다른 UUID
  - SDK 14 stable + bonded 디바이스 신규 char
  - SDK 15 high MTU 지원
- Mobile lib:
  - iOS: `NordicDFU` SwiftPM / CocoaPods
  - Android: Maven (Nordic)
  - RN: `react-native-nordic-dfu` (community)
  - Capacitor: `nordic-dfu` by robsonos

### 8.2 MCUboot + SMP (nRF Connect SDK + Zephyr — 우리 자체 센서)

`expert_hardware_embedded_reference.md` §4.2 가 이미 lock: **nRF54L15 + Zephyr + MCUboot signed dual-bank A/B + SMP.**

- MCUboot partition: `mcuboot_primary` (slot-0) + `mcuboot_secondary` (slot-1)
- 새 image 를 slot-1 업로드 → MCUboot signature validate → 다음 boot 시 swap. Fallback = confirm 실패 시 이전 image 복원
- Mobile lib:
  - iOS: `mcumgr-ios` (JuulLabs-OSS) — Apache Mynewt / Zephyr 호환
  - Android: `mcumgr-android` (Nordic)
  - Ref app: **nRF Connect Device Manager** (iOS 1.4+, Android 1.8+) — direct-xip FOTA 지원

→ **우리 SailTechMOTION = MCUboot + SMP path.** Phase 2 의 EVT 직후 OTA UI 구현. Library lock = `mcumgr-ios` + `mcumgr-android`.

### 8.3 Background DFU 가능성

- 가능하나 권장 X. 앱이 active (foreground 또는 active background mode) 동안만 동작, 전용 DFU 모드보다 훨씬 느림, 동시 앱 활동 의 corruption risk
- **UX 권장:** 명시 firmware-update 화면, foreground 유지, 진행률 표시, DFU 중 백그라운드 차단

### 8.4 OTA 체크리스트 (Phase 2 implementation)

- [ ] mcumgr-ios SwiftPM 의존성 추가
- [ ] mcumgr-android Gradle 의존성 추가
- [ ] firmware update 전용 UI (foreground 유지, progress bar, 취소 비활성)
- [ ] signed image (.bin + manifest.yml) 다운로드 endpoint (CDN — Phase 3)
- [ ] anti-rollback version check
- [ ] DFU 중 다른 BLE 작업 일시 정지 (queue serialize)

---

## 9. 외부 디바이스 audit — 13 카테고리

각 카드 = API/SDK 가용성 · 인증 · 데이터 포맷 · rate limit · 한국 가용성 · real-time vs post-session · notable · 출처.

### 9.1 RaceBox (Micro / Mini / Mini S)

- **API/SDK:** 비공개-공유. racebox.pro 폼 신청 → BLE protocol spec 송부. GPS+IMU 데이터 access 가능
- **Auth:** BLE 페어링 only (cloud API 없음). UART-over-BLE, UBX-like custom protocol
- **데이터 포맷:** Custom binary "RaceBox Data Message" frame (GPS speed/lat/lon, 3-axis accel, heading, date/time, battery, fix). Fletcher checksum + 메시지 ID. 25 Hz (Mini S/Micro). Vendor 앱 export = .vbo / .csv
- **Rate limit:** 없음 (서버 없음). BLE MTU 가 throughput 상한
- **한국:** 공식 distributor·KC 인증 미확인. 글로벌 webshop / 배송대행
- **Real-time/post-session:** 둘 다 — live BLE stream + on-device 세션 storage BLE download
- **Notable:** Protocol doc gated 이나 strict X — open-source decoder 다수 (ESP32-RaceBox emulator·RaceBoxTest Swift). **Phase 0 SailTechHUB 가 이미 동작**
- **출처:** racebox.pro/products/mini-micro-protocol-documentation · github.com/lademeister/ESP32-RaceBox · github.com/peytoncchen/RaceBoxTest

### 9.2 Movesense (independent of Suunto)

- **API/SDK:** **완전 open.** Bitbucket/GitHub 소스, "Movesense Showcase" reference apps for iOS/Android. **2021-10-01 MBO 로 Suunto 와 독립** (Jussi Kaasinen, ex-Sports Tracker CEO). Suunto 가 여전히 supply chain · 제조 협력
- **Auth:** BLE 페어링 only. cloud auth 없음 (Movesense 는 consumer cloud 없음)
- **데이터 포맷:** Custom BLE "whiteboard" REST-over-BLE; client 가 JSON 으로 MDS 라이브러리 통해 상호작용. Sensor firmware (Movesense ESW) C++ customizable. HR + IMU (accel/gyro/mag) + temperature + ECG (HR+ kit)
- **Mobile lib:** **Movesense-Mobile-Lib (MDSLIB)** iOS·Android 동기. Community .NET/Xamarin wrapper
- **Rate limit:** 없음 (peer-to-peer BLE)
- **한국:** 공식 retailer 미확인. 글로벌 Movesense webshop. 개발자 kit 국제배송
- **Real-time/post-session:** 둘 다 — live subscribe + on-sensor logbook
- **Whoop 관계:** **무관계** — 별 ecosystem
- **출처:** movesense.com/docs/mobile/mobile_sw_overview · movesense.com/news/2021/09/movesense-grows-independent-from-suunto/

### 9.3 Garmin — 3 program (§6 상세)

- 요약: Connect IQ SDK (Monkey C 워치 앱, 무료) + Connect Developer Program (Activity/Health API, partner) + Health SDK (medical 전용)
- **BLE HR:** 표준 0x180D / 0x2A37 (Garmin 시계 + 가슴벨트). Extended (Running Dynamics·swim) 은 ANT+/Garmin proprietary BLE
- **한국:** Garmin Korea 공식 subsidiary. Connect IQ Store 한국 storefront

### 9.4 Apple HealthKit (§5.1 상세)

- 요약: 모든 Apple Developer Program 회원에게 open, HealthKit entitlement 필요
- **Sailing 매핑:** **`HKWorkoutActivityType.sailing` raw=57 존재** (iOS 8+/watchOS 2+) ★
- **한국:** Korean App Store 완전 지원

### 9.5 Samsung Health (§5.2 상세) — KR 핵심

- 3 SDK (Data·Sensor·Accessory). Partner 승인 + signature 등록 의무. Samsung Health 6.30.2+ / Android 10+
- **Galaxy Watch ↔ iPhone 직결:** 불가능. Wear OS Sensor SDK 매개 또는 Android 폰+Data SDK→cloud→iOS
- **한국:** **native** — Samsung 본사, 광범위 retail

### 9.6 Whoop API

- **API/SDK:** Open self-serve. developer.whoop.com 자율 가입
- **Auth:** OAuth 2.0 Authorization Code. Auth URL `api.prod.whoop.com/oauth/oauth2/auth`, Token URL `api.prod.whoop.com/oauth/oauth2/token`. Bearer + refresh (`offline` scope)
- **데이터:** REST `api.prod.whoop.com`. Cycle / Recovery / Sleep / Workout / User Profile / Body Measurement. JSON. **파일 export 없음.**
- **Rate limit:** **100 req/min per client, 10,000 req/24h.** Headers `X-RateLimit-{Limit,Remaining,Reset}`. 429 on exceed
- **한국:** **공식 Whoop Korea 없음.** 2025-05 의 Whoop 5.0/MG 글로벌 launch 에 KR 정식 retail 미포함. Geo-restriction → 멤버십·firmware feature 일부 제한
- **Real-time/post-session:** **post-session only.** Live BLE stream 3rd-party 미공개. 일일 cycle 처리
- **출처:** developer.whoop.com/docs/developing/oauth · developer.whoop.com/docs/developing/rate-limiting · comgateway.com/blogs/risking-your-2026-health-data-by-accepting-the-delayed-south-korean-whoop-5-0-release

### 9.7 Oura Ring API

- **API/SDK:** Open self-serve via Oura Cloud developer console
- **Auth:** **OAuth 2.0 only.** Personal Access Token (PAT) V1 deprecated; V2 = OAuth2 only. Client ID + Secret
- **엔드포인트 (V2):** daily activity / readiness / sleep / SpO2 / stress / heart rate (time series) / sleep / workout / session / tag / ring config / personal info / rest mode. JSON
- **Rate limit:** 5000 req/5 min per user token (V2 estimate, current docs 재확인 필요)
- **한국:** **공식 정식 retail 없음** (2026 기준). 150+ 국가 가용이나 KR 미진입. comGateway 등 forwarder 사용. 앱·API 는 글로벌 동작
- **Real-time/post-session:** post-session only (밤 sync)
- **출처:** cloud.ouraring.com/docs · support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API

### 9.8 Polar (AccessLink API + H10 BLE) — KR 가용

- **API/SDK:** Open (Polar AccessLink Dynamic API v4). Self-serve at admin.polaraccesslink.com
- **Auth:** **OAuth 2.0** Authorization Code
- **엔드포인트:** Workouts / Sleep / Daily Activity / Continuous HR / Nightly Recharge / Cardio Load / Training Load Pro. JSON + 원본 운동 파일 FIT/TCX/GPX
- **Webhook:** Push on new data. Ping handshake (200 OK 응답). HMAC-SHA256 with `signature_secret_key` (생성 시 1회 반환 — 영구 보관 필수). Headers `webhook-{id,timestamp,signature}`. 7 일 실패 → 자동 비활성, 재활성 가능
- **Rate limit:** per client_id, 15-min + 24-h 윈도우, dynamic (user 수 비례). Headers `RateLimit-{Usage,Limit,Reset}`
- **Polar H10 BLE:** 표준 **0x180D / 0x2A37** advertising. **RR-Interval Present flag 설정** → 2A37 notification 으로 RR 전달. **H10 이 HRV de-facto 표준인 이유.** 별도 Polar Measurement Data (PMD) service (raw ECG / accel) 도 Polar UUID 로 제공
- **한국:** **Polar Korea 공식.** polarkorea.co.kr / polar.co.kr. H10 KRW ~170,000 retail
- **Real-time/post-session:** AccessLink = post. H10 BLE = real-time
- **출처:** polar.com/polar-api-v4 · github.com/polarofficial/accesslink-example-python · polarkorea.co.kr

→ **Polar H10 = MVP 의 HR/HRV 권장 strap** (Korean 가용 + RR via 표준 2A37).

### 9.9 Wahoo Fitness

- **API/SDK:** Wahoo Cloud API only. **iOS/Android device SDK = no longer publicly maintained.** Cloud API 는 partner-gated, **신규 신청 제한 중** (purpose/scopes review)
- **Auth:** OAuth 2.0 Authorization Code
- **엔드포인트:** User profile / HR-power zones / workout upload-download / planned workouts / routes. .FIT 파일
- **Rate limit:** 공개 X (per-app 할당)
- **2026 변경:** **2026-01-01 부터 user 당 unrevoked access token 10 개 제한.** stale token revoke 필요
- **BLE:** Wahoo TICKR / TICKR X = 표준 0x180D / 0x2A37. KICKR trainer = FTMS + Wahoo proprietary characteristic (ERG/SIM). HR strap 직접 BLE = 어느 앱이든 가능
- **한국:** Wahoo Korea 없음. **Distributor = Nanux Networks (NNX Sports, nnxsports.com, +82-1644-2022)**
- **Real-time/post-session:** Cloud post / BLE real-time
- **출처:** developers.wahooligan.com/cloud · support.wahoofitness.com/hc/en-us/articles/23022859474962-Wahoo-App-Partners

### 9.10 Coros

- **API/SDK:** Partner-only. **Docs private** — Coros support form 으로 API application 제출 → 승인 시 docs + credentials 공유
- **Auth:** OAuth-style application registration (scope list public 없음). Server-to-server
- **데이터:** Webhook push → callback URL. .FIT activity. End-user manual export 도 가능 (앱 → email/AirDrop)
- **Rate limit:** 공개 X
- **Sandbox:** prod / sandbox 분리
- **한국:** **Coros Korea 공식** — Joy Works Co. Ltd (coroskorea.co.kr), Seoul Seongdong-gu, +82-31-524-9858
- **Real-time/post-session:** post-session only. **Public BLE SDK 없음** — Pace 3 / Apex 2 직 BLE 미공개
- **출처:** support.coros.com/hc/en-us/articles/17085887816340-Submitting-an-API-Application · coroskorea.co.kr

### 9.11 Suunto

- **2 surface:**
  - **Suunto Cloud API** (apizone.suunto.com, Azure API Management) — partner registration via portal, OAuth 2.0. Activity / GPS routes / HR / training sessions
  - **Open SuuntoPlus** — 2026-03 major launch. SuuntoPlus Editor VS Code extension 으로 on-watch Sports App 빌드, partner 계정 불필요. Strava·TrainingPeaks 등 published partner
- **Movesense 관계:** 2021-10 spin-off (별도 회사)
- **데이터 포맷:** FIT export · JSON via API
- **한국:** Suunto Korea subsidiary 미확인. 글로벌 webshop · APAC dealer (apac.suunto.com)
- **Real-time/post-session:** Cloud = post. SuuntoPlus = watch real-time 이나 폰으로 live push 불가

### 9.12 Vakaros (Atlas 2)

- **API/SDK:** 부분 — **public cloud API 없음.** VKX file format = **완전 open**
- **VKX spec:** github.com/vakaros/vkx — binary serialization, U8 row keys + fixed-size payload. 모든 row type (GPS·IMU·race event·line mark·button press) 문서화
- **Auth:** 없음 (file-based)
- **BLE to Atlas 2:** 디바이스 우측 상단 버튼 클릭 → BLE transfer service → 세션 다운로드 **가능.** **단 protocol 미공개** — 3rd-party live-data 연결 = reverse engineering (공식 미지원)
- **데이터 포맷:** .vkx (native) + GPX/CSV (companion 앱 export)
- **Vakaros Cloud:** companion sync 존재, public endpoint 미문서화
- **한국:** distributor 없음. 글로벌 e-commerce
- **Real-time/post-session:** post-session BLE download + cloud sync. on-device 디스플레이로 real-time
- **우리 측 기존 자산:** `site/riding-dashboard/js/vkx-parser.js` 가 VKX 1.4 binary 완비 — heel/pitch quaternion 변환 포함, 10 Hz 전량
- **출처:** github.com/vakaros/vkx · blog.vakaros.com/blog/telemetry-logging-its-here

### 9.13 Sailmon (현 Vakaros 산하)

- **Acquisition:** 2025-03-13 Vakaros 가 Sailmon Instruments (from North Technology Group) 인수. Sailmon MAX 사용자는 Vakaros 산하 지원 유지; Sailmon Element 는 North Technology Group 의 Synapse / Future Fibres 잔류
- **API/SDK:** **공개 API/SDK 없음.** Sailmon docs site = 사용자/troubleshooting only. 인수 후 통합 dev program 미발표
- **Auth:** N/A
- **BLE:** Sailmon MAX 는 central 역할 (Calypso/OpenWind 바람센서·Cyclops loadcell·Airmar DST-810·BLE HR strap 페어). **표준 BLE peripheral advertise X.** vendor 비교: "no third-party instrument addition"
- **데이터:** cloud-tracked sessions via Sailmon App/website. export endpoint 미문서화. VKX-format unification 미발표
- **한국:** 없음
- **Real-time/post-session:** on-device 디스플레이 real-time + cloud sync post
- **출처:** vakaros.com/blogs/news/vakaros-acquires-sailmon · sailmon.com/support · sailmon.com/compare

---

## 10. 통합 priority matrix + MVP 모바일 앱 spec

### 10.1 외부 디바이스 priority matrix (사용자 수 × 통합 난이도)

축 = **(X) 한국 사용자 수 추정** (높음/중/낮음) × **(Y) 통합 난이도** (낮음/중/높음)

```
  통합 난이도 ↑
       │
  높음 │                          [Sailmon]  [Vakaros live]
       │                                     [Suunto Cloud]
       │           [Whoop·Oura]              [Wahoo·Coros]
   중  │           [Garmin Connect]
       │                          [Samsung Health]
       │   [Vakaros .vkx]
   낮음│  [Polar H10 BLE]  [HealthKit]      [Health Connect]
       │  [RaceBox]  [Movesense]
       │  [표준 BLE HRS]
       └────────────────────────────────────────────────→
         낮은 KR 사용자        중간            높은 KR 사용자
```

**우선순위 Tier 분류:**

| Tier | 디바이스 | 통합 path | Phase |
|---|---|---|---|
| **T1 (MVP)** | RaceBox · Movesense · 표준 BLE HRS (Garmin·Wahoo TICKR 등) · Polar H10 · Apple HealthKit · Vakaros .vkx upload | 직 BLE 또는 file import | **Phase 2 MVP** |
| **T2 (Phase 2+1)** | Garmin Connect Developer (Activity API) · Samsung Health Data SDK · Whoop API · Oura API · Health Connect (Android) · Polar AccessLink | OAuth + partner 승인 사이클 | **Phase 2 H2** |
| **T3 (Phase 3+)** | Wahoo (partner 제한 풀리면) · Coros private API · Suunto Cloud · Sailmon (Vakaros 산하 API 공개 시) · Connect IQ 워치 앱 | 비용·접근·시장 우선순위 후순위 | **Phase 3** |
| **out** | Garmin Health SDK · Vakaros direct live BLE | medical-only / reverse engineering | — |

### 10.2 우선순위 결정 근거 (rule)

- **T1 = 한국 사용자 + 우리 메인 sensor + open path.** RaceBox·Movesense (Phase 0 lock) + Polar H10 (한국 정식·표준 RR) + HealthKit (iOS native sailing 타입) + Vakaros (open VKX, 우리 웹 측 파서 재사용)
- **T2 = 한국 갤럭시 + OAuth-based wearable 양대.** Samsung Health (KR Galaxy share) + Garmin Activity (KR 정식 Garmin) + Whoop/Oura (글로벌 user, KR 사용자 forwarder 다수)
- **T3 = 우선순위 후순위 또는 미공개.** Wahoo·Coros·Suunto·Sailmon — KR 사용자 수 vs ROI

### 10.3 MVP 모바일 앱 spec (lock — Phase 2 진입 spec)

#### 10.3.1 Scope

| 카테고리 | In-scope | Out-of-scope |
|---|---|---|
| Platform | iOS 17+ · Android 10+ (API 29+) | watchOS standalone · Wear OS · Connect IQ 워치 앱 |
| Sensor | RaceBox · Movesense · 표준 BLE HRS · Polar H10 · 자체 SailTechMOTION (EVT 시점) | Whoop/Oura/Garmin Connect/Samsung Health real-time |
| 세션 | BLE 4 시간 백그라운드 안정 · 로컬 JSON · cloud sync | 라이브 영상 동기 · 다중 세션 동시 |
| HealthKit | iOS `HKWorkoutActivityType.sailing` · HR sample read · 세션 write | Apple Watch standalone · live sample stream |
| Samsung/HC | Android Samsung Health Data SDK (KR Galaxy) · Health Connect | Galaxy Watch standalone · Sensor SDK 직접 |
| 외부 import | Vakaros .vkx upload | live Vakaros / Sailmon |
| OTA | 자체 SailTechMOTION (mcumgr) | 3rd-party sensor OTA |
| 웹 연동 | `site/riding-dashboard/` 와 동일 JSON schema · cloud → 웹 url 공유 | 웹↔모바일 양방향 실시간 sync |

#### 10.3.2 기능 8 개 (lock)

1. **Sensor pairing UI** — Phase 0 의 `SensorStatusView` 등가. 자동 reconnect (preservation/restoration). 다중 동시 페어 (RaceBox + Movesense + Polar H10 + 표준 HRS) 4 개 동시 floor
2. **세션 기록** — Phase 0 의 `SessionRecorder.swift` 등가. boardLength·notes·foilingType (kite/wing/windfoil 선택). Foreground service Android, state preservation iOS
3. **실시간 대시보드** — Phase 0 의 `DashboardView` 등가. 속도(kt/kmh)·heading·heel/pitch·HR·G-force·GPS quality
4. **로컬 + cloud sync** — JSON 로컬 저장 (Phase 0 등가) + cloud (auth 미정 — supabase 활용 가능 — `site/assets/js/supabase-auth.js` 흔적 있음). `site/riding-dashboard/` 와 동일 schema
5. **HealthKit (iOS) / Samsung Health Data SDK / Health Connect (Android)** — 세션 종료 시 write
6. **Vakaros .vkx import** — File picker → 웹 측 파서 (`vkx-parser.js`) 동일 로직 native 포팅 또는 WebView 임시 호출 (Phase 2 결정)
7. **OTA UI** — SailTechMOTION EVT 시점부터. mcumgr 라이브러리 wrap
8. **세션 share / 웹 dashboard link** — JSON share + `riding-dashboard.html?session=...` URL 생성

#### 10.3.3 데이터 schema (web ↔ mobile 통일)

Phase 0 의 `SessionRecorder` JSON 구조를 baseline 으로, web 측 (`site/riding-dashboard/`) 의 GPX/VKX 입력과 통일 schema 로 확장:

```json
{
  "sessionID": "F47AC10B-58CC-4372-A567-0E02B2C3D479",
  "version": "1.0",
  "source": "sailtechhub-ios" | "sailtechhub-android" | "vkx-import" | "gpx-import",
  "startTime": "2026-04-13T10:30:01Z",
  "endTime": "2026-04-13T11:45:30Z",
  "rider": { "userID": "...", "boardLength": 4.5, "boardType": "windfoil" },
  "metadata": {
    "device": "iPhone 15 Pro / Galaxy S24",
    "sensors": ["racebox", "movesense", "polar-h10", "sailtechmotion-1"],
    "location": { "lat": 37.0, "lng": 127.0, "spot": "강원도 양양" }
  },
  "telemetry": {
    "racebox": [ { "t": "...", "speedKnots": 12.5, ... } ],
    "movesense": [ { "t": "...", "heartRate": 140, "rrInterval": 420.5 } ],
    "polar": [ ... ],
    "sailtechmotion": [ ... ]
  },
  "imports": { "vkx": null, "gpx": null }
}
```

→ web 측 `app.js` 가 본 schema 를 직접 소비할 수 있도록 #4 Frontend Engineer 와 합의 필요.

#### 10.3.4 Phase 0 → Phase 2 gap fix 체크리스트

| 항목 | 현재 | 필요 |
|---|---|---|
| iOS State Preservation | 없음 | `CBCentralManagerOptionRestoreIdentifierKey` + restore handler |
| Info.plist `bluetooth-central` UIBackgroundMode | docs only | 실제 적용 verify |
| `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` | 없음 | 추가 + HKHealthStore wrap |
| HKWorkoutSession + HKLiveWorkoutBuilder | 없음 | `.sailing` activity, locationType `.outdoor` |
| Android Kotlin/Compose 동등 코드 | 없음 | 신규 |
| Android 12+ runtime permission flow | n/a | `BLUETOOTH_SCAN`/`CONNECT` + `neverForLocation` |
| Android Foreground Service `connectedDevice` | n/a | 신규 + persistent notification |
| Samsung Health Data SDK partner 신청 | n/a | Phase 2 진입 4–8 주 전 신청 |
| Cloud backend | n/a | Phase 2 architect (#4 Frontend 협업) |
| mcumgr OTA | n/a | EVT 후 추가 |

---

## 11. 협업 인터페이스

### 11.1 #7 Hardware & Embedded (자체 SailTechMOTION 센서)

| 시기 | 항목 | 의존 |
|---|---|---|
| Concept (지금) | BLE GATT spec lock — service UUID, characteristic UUID, packet schema, MTU 요청값, advertising interval | `expert_hardware_embedded_reference.md` §8.6 firmware spec lock |
| Proto | Mobile 측 mock characteristic emulator (테스트용) | mobile mock 작성 |
| EVT | 첫 실 BLE 연결 테스트, MTU negotiation, packet 손실율 측정 | Hardware Proto 인수 |
| EVT/DVT | mcumgr OTA path 검증 | signed image · `mcumgr-{ios,android}` integration |

권장 GATT spec template (Hardware #7 와 lock 필요):

```
Service:              SailTechMOTION Custom Service  (128-bit UUID, TBD)
  Characteristic:     Telemetry Notify  (notify, 25 Hz, ~80-byte packet)
  Characteristic:     Config R/W        (read/write, sample rate·calibration trigger)
  Characteristic:     OTA Trigger       (write, SMP characteristic)
Service:              SMP (Simple Management Protocol)
  Characteristic:     8D53DC1D-... (Zephyr 표준 SMP UUID)
```

### 11.2 #4 Frontend Engineer (`site/riding-dashboard/`)

| 항목 | 인터페이스 |
|---|---|
| **데이터 schema 통일** | §10.3.3 JSON v1.0 |
| **session URL share** | mobile → cloud session ID → `riding-dashboard.html?session=...` 로 deep link |
| **Vakaros .vkx 파서 reuse** | `site/riding-dashboard/js/vkx-parser.js` 의 로직을 mobile 측 (Swift/Kotlin port 또는 WebView 임시 호출) 으로 |
| **인증** | Supabase auth (`site/assets/js/supabase-auth.js` 흔적) 와 mobile auth flow 통일 |

### 11.3 #5 UX Researcher

| 영역 | 모바일 특화 |
|---|---|
| Pairing flow | 4 sensor 동시 페어 UX — 가시성·재시도·실패 라벨 |
| 백그라운드 인지 | "라이딩 기록 중" persistent notification 의 톤 |
| 권한 onboard | iOS Bluetooth + HealthKit + Android 12 새 permission 의 단계 |
| One-handed | 라이딩 중 wet 손가락·sun glare 대응 — large hit area (≥44–48px), high contrast 톤 |
| Wear UX (Phase 3) | Connect IQ data field 의 1-glance 메트릭 선정 |

### 11.4 #3 Sports Science Researcher

| 항목 | 협업 |
|---|---|
| 표시 메트릭 정의 | 속도·VMG·heel·pitch·HR zone — 모바일에서 어느 우선 |
| 실시간 cue 알고리즘 | SailTechCOACH 알고리즘 (polar × heel × VMG) → mobile haptic 또는 audible cue |
| HRV (RR interval) | Polar H10 의 RR 을 모바일에서 어떻게 즉시 표시 vs post-process |
| 펌핑 감지 (3축 acc) | EVT 시점에 mobile 측 FFT/pattern matching 구현 위치 (앱 vs cloud) |

### 11.5 #1 Visual Designer

| 항목 | 협업 |
|---|---|
| iOS·Android Design System | iOS HIG vs Material 3 의 양립 — SailTechHUB 의 brand tone (Visual Designer #1 의 site theme 와 일치) |
| App Icon / Splash | iOS 1024 / Android adaptive icon |
| Connect IQ 워치 (Phase 3) | data field layout — small/medium/large 워치 face |

---

## 12. Decision frameworks

### 12.1 플랫폼 선택 트리

```
시작 (modal Q)
├─ Cap budget = 1 인 개발자 + 단일 codebase 강제?
│   └─ → Flutter (`flutter_reactive_ble`) — 2순위
├─ 4+ sensor × 4 시간 background BLE × HealthKit/Samsung Health 필요?
│   ├─ → Native dual (Swift + Kotlin), KMP for shared logic ★
│   └─ (no — light BLE only) → Flutter / KMP+Compose Multiplatform OK
├─ WebView 기반? → ★ Capacitor — disqualified, skip
└─ JS 생태계 강제? → React Native — 3순위, multi-device pain check 필수
```

### 12.2 외부 디바이스 통합 우선순위 트리

```
디바이스 X 통합 결정
├─ open BLE protocol or open SDK?
│   ├─ Yes + 한국 사용자 수 High → ★ T1 (MVP)
│   ├─ Yes + 한국 사용자 수 Med  → T2 (Phase 2+1)
│   └─ Yes + Low → T3 (Phase 3)
├─ OAuth partner-gated?
│   ├─ 한국 가용 + 메이저 wearable → T2
│   └─ 한국 미가용 + niche → T3 또는 out
└─ private/closed?
    ├─ 인접 가치 큰 (Vakaros .vkx file) → file import only
    └─ 작은 → out
```

### 12.3 BLE notify vs indicate 선택

```
데이터 rate
├─ ≥10 Hz streaming sensor → notify
├─ Discrete event (alarm, DFU progress) + 손실 X 의무 → indicate
└─ One-shot read → read (notify/indicate 불요)
```

### 12.4 백그라운드 안정성 패턴

```
iOS
├─ State Preservation & Restoration ON (CBCentralManagerOptionRestoreIdentifierKey)
├─ scanForPeripherals(withServices: <UUID 필수>)
└─ peripheral.delegate 유지 (centralManager:willRestoreState: 의 peripherals)

Android (API 31+)
├─ BLUETOOTH_SCAN (neverForLocation flag) + BLUETOOTH_CONNECT
├─ Foreground Service type=connectedDevice + FOREGROUND_SERVICE_CONNECTED_DEVICE (API 34+)
├─ Persistent notification (sailing 세션 ID + 진행 시간)
└─ GATT op queue (one-at-a-time)
```

### 12.5 Connect IQ 워치 앱 가치 평가

```
질문: SailTechHUB 의 Connect IQ data field 가 Phase 3 에서 가치 있나?
├─ Yes if (1)+(2):
│   (1) Garmin 시계 사용자가 KR foilers/sailors 의 ≥20% (verify needed)
│   (2) 실시간 1-glance 메트릭 (속도·VMG·heel·HR zone) 이 라이딩 중 진짜 필요
├─ Cost: $100/yr + Monkey C 학습 + 1 인 추가 effort (~3–6 주)
└─ 시장 검증: Sail Racer 60k user — 시장 있음
→ Phase 3 후보, Phase 2 MVP 외
```

---

## 13. Variables & constants

```
BLE
─────────────────────────────────────────────
HR Service (표준)              0x180D
HR Measurement                 0x2A37
Body Sensor Location           0x2A38
CCCD                           0x2902
Default ATT MTU                23 bytes (20 payload)
BLE 5.0 max ATT MTU            247 bytes
iOS 일반 negotiated MTU        ~185 bytes
Apple connection interval      15 ms multiples (15–30 ms typical)

RaceBox (Nordic UART)
─────────────────────────────────────────────
Service UUID                   6E400001-B5A3-F393-E0A9-E50E24DCCA9E
TX (notify)                    6E400003-B5A3-F393-E0A9-E50E24DCCA9E
RX (write)                     6E400002-B5A3-F393-E0A9-E50E24DCCA9E
Sea Mode bytes                 B5 62 FF 27 03 00 05 00 1E 4A 1A
Payload length                 80 bytes
Sample rate                    25 Hz (Mini S / Micro)

iOS Info.plist (의무)
─────────────────────────────────────────────
NSBluetoothAlwaysUsageDescription
NSHealthShareUsageDescription
NSHealthUpdateUsageDescription
UIBackgroundModes  → bluetooth-central

Android Manifest (API 31+)
─────────────────────────────────────────────
BLUETOOTH_SCAN  (neverForLocation flag 권장)
BLUETOOTH_CONNECT
BLUETOOTH_ADVERTISE  (peripheral 시)
FOREGROUND_SERVICE
FOREGROUND_SERVICE_CONNECTED_DEVICE  (API 34+)

HealthKit (iOS)
─────────────────────────────────────────────
HKWorkoutActivityType.sailing      raw=57, iOS 8+/watchOS 2+ ★
HKQuantityTypeIdentifier.heartRate
HKQuantityTypeIdentifier.heartRateVariabilitySDNN
HKWorkoutSession + HKLiveWorkoutBuilder

OAuth (외부 wearable)
─────────────────────────────────────────────
Garmin Connect Developer      OAuth 1.0a + HMAC-SHA1  (유일 1.0a)
Whoop                         OAuth 2.0 Auth Code (refresh: offline scope)
Oura V2                       OAuth 2.0 Auth Code
Polar AccessLink              OAuth 2.0 Auth Code + Webhook HMAC-SHA256
Wahoo Cloud                   OAuth 2.0 Auth Code
Suunto Cloud                  OAuth 2.0 (Azure APIM)

Whoop rate limit              100 req/min · 10,000 req/24h
Wahoo 2026-01-01              10 unrevoked token per user

Connect IQ Store
─────────────────────────────────────────────
Annual merchant fee           USD $100
Revenue share                 15%

Background DFU                discouraged — foreground UX 권장
MCUboot                       dual-bank A/B, signed, anti-rollback
Zephyr SMP                    char UUID = 8D53DC1D-...

KC mark (KR)
─────────────────────────────────────────────
RRA approval                  4–8 주, $4k–12k (Hardware #7 §7.1)
SW 앱 자체                    KC 불요
```

---

## 14. Sources

### Mobile platform / BLE
- Apple CoreBluetooth — https://developer.apple.com/documentation/corebluetooth
- Apple TN QA1931 (connection interval) — https://developer.apple.com/library/archive/qa/qa1931/_index.html
- Apple CoreBluetooth background — https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html
- Android BLE permissions — https://developer.android.com/develop/connectivity/bluetooth/bt-permissions
- Android Foreground Service types — https://developer.android.com/develop/background-work/services/fgs/service-types
- Android 14 FGS changes — https://developer.android.com/about/versions/14/changes/fgs-types-required
- Punch Through iOS scan — https://punchthrough.com/ios-ble-scanning-guide/
- Punch Through Android permissions — https://punchthrough.com/mastering-permissions-for-bluetooth-low-energy-android/
- Nordic DevZone notify vs indicate — https://devzone.nordicsemi.com/f/nordic-q-a/99/notification-indication-difference
- DeepWiki Android MTU — https://deepwiki.com/justdying/Android-BLE/6.2-mtu-configuration
- Silicon Labs mobile suitable conn params — https://docs.silabs.com/bluetooth/9.1.1/mobile-apps-suitable-connection-parameters/

### Cross-platform frameworks
- React Native Hermes — https://reactnative.dev/docs/hermes
- RN ble-plx wiki notify — https://github.com/dotintent/react-native-ble-plx/wiki/Characteristic-Notifying
- RN ble-plx multi-device issues — https://github.com/dotintent/react-native-ble-plx/issues/540 · /611 · /721 · /747 · /1247
- Flutter Reactive BLE — https://pub.dev/packages/flutter_reactive_ble · https://github.com/PhilipsHue/flutter_reactive_ble
- Capacitor BLE community — https://github.com/capacitor-community/bluetooth-le · Discussion #679
- Kotlin Multiplatform — https://kotlinlang.org/multiplatform/
- Volpis KMP production — https://volpis.com/blog/is-kotlin-multiplatform-production-ready/
- STRV KMP Philips — https://medium.com/@strv/kotlin-multiplatform-in-production-7963b9f2dab2
- Vibe Studio Flutter vs RN — https://vibe-studio.ai/insights/benchmarking-flutter-vs-react-native-performance-deep-dive-2025

### HealthKit / Samsung / Health Connect
- Apple HKWorkoutActivityType — https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
- Apple HKWorkoutActivityType.sailing — https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype/hkworkoutactivitytypesailing
- Apple HKObserverQuery — https://developer.apple.com/documentation/healthkit/hkobserverquery
- Apple enableBackgroundDelivery — https://developer.apple.com/documentation/HealthKit/HKHealthStore/enableBackgroundDelivery(for:frequency:withCompletion:)
- BrightDigit HKLiveWorkoutBuilder — https://brightdigit.com/tutorials/hkliveworkoutbuilder-healthkit-workout-session/
- Samsung Health Data SDK — https://developer.samsung.com/health/data
- Samsung Health Sensor SDK — https://developer.samsung.com/health/sensor
- Samsung Health Accessory SDK — https://developer.samsung.com/health/accessory
- Samsung Dev Insight Oct 2025 (deprecation) — https://developer.samsung.com/sdp/news/en/2025/10/30/dev-insight-oct-2025
- Android Health Connect migration — https://developer.android.com/health-and-fitness/health-connect/migration/fit
- Android ExerciseSessionType — https://developer.android.com/reference/android/health/connect/datatypes/ExerciseSessionType
- Spike API Google Fit shutdown — https://www.spikeapi.com/blog/google-fit-shutdown-what-developers-need-to-know-and-how-to-prepare

### Garmin
- Connect IQ SDK — https://developer.garmin.com/connect-iq/sdk/
- Connect IQ Companion App SDK iOS — https://github.com/garmin/connectiq-companion-app-sdk-ios
- Connect IQ publishing — https://developer.garmin.com/connect-iq/core-topics/publishing-to-the-store/
- Connect IQ pricing — https://support.garmin.com/en-US/?faq=i0SOSmHg2mAAyCoKiV0f2A
- the5krunner Connect IQ 8 — https://the5krunner.com/2025/01/07/connect-iq-8-what-we-know-so-far-about-system-8/
- Garmin Connect Developer FAQ — https://developer.garmin.com/gc-developer-program/program-faq/
- Garmin Activity API — https://developer.garmin.com/gc-developer-program/activity-api/
- Garmin Health API — https://developer.garmin.com/gc-developer-program/health-api/
- Garmin Health SDK — https://developer.garmin.com/health-sdk/
- Garmin Forums Broadcast HR BLE — https://forums.garmin.com/developer/connect-iq/f/app-ideas/224447/broadcast-heart-rate-by-ble
- Spike API why integrate Garmin — https://www.spikeapi.com/blog/why-integrate-garmin-api-directly
- Sail Racer Connect IQ — https://apps.garmin.com/en-US/apps/1980c826-844a-47f7-9ca8-ffc0e09ba2ba
- SailRacer.net — https://sailracer.net/
- connectiq-sailing OSS — https://github.com/dmrrlc/connectiq-sailing

### Store submission
- Apple App Privacy Details — https://developer.apple.com/app-store/app-privacy-details/
- iOS Submission Guide 2025 — https://iossubmissionguide.com/app-store-review-time-2025
- Apple NSBluetoothAlwaysUsageDescription — https://developer.apple.com/documentation/bundleresources/information-property-list/nsbluetoothalwaysusagedescription
- Apple NSHealthShareUsageDescription — https://developer.apple.com/documentation/BundleResources/Information-Property-List/NSHealthShareUsageDescription
- Play Console Data safety — https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- Play Health Apps Declaration — https://support.google.com/googleplay/android-developer/answer/16555673?hl=en
- Android publish health app — https://developer.android.com/health-and-fitness/health-connect/publish
- App Lander Data Safety 2026 — https://applander.io/blog/google-play-data-safety-form-complete-guide
- ECQA KC mark — https://ecqa.com/kc-mark-requirements-korea/
- TÜV SÜD KC — https://www.tuvsud.com/en/services/product-certification/kc-certification-services
- MPR Korea Certification — https://www.korea-certification.com/en/kc/what-is-kc-certification/

### OTA
- Zephyr MCUmgr — https://docs.zephyrproject.org/latest/services/device_mgmt/mcumgr.html
- MCUboot Zephyr — https://docs.mcuboot.com/readme-zephyr.html
- Nordic Academy MCUboot — https://academy.nordicsemi.com/courses/nrf-connect-sdk-intermediate/lessons/lesson-9-bootloaders-and-dfu-fota/topic/mcuboot-mcumgr-and-dfu-target/
- iOS mcumgr — https://github.com/JuulLabs-OSS/mcumgr-ios
- Android DFU Library — https://github.com/NordicSemiconductor/Android-DFU-Library
- iOS DFU Library — https://github.com/NordicSemiconductor/IOS-DFU-Library
- Punch Through DFU UX — https://punchthrough.com/dfu-experience-on-mobile/

### External sensor / wearable APIs
- RaceBox protocol — https://www.racebox.pro/products/mini-micro-protocol-documentation
- ESP32-RaceBox emulator — https://github.com/anchit92/ESP32-RaceBox-mini-Emulator/
- Movesense docs mobile — https://www.movesense.com/docs/mobile/mobile_sw_overview/
- Movesense GSP — https://www.movesense.com/docs/esw/gatt_sensordata_protocol/
- Movesense Suunto spin-off — https://www.movesense.com/news/2021/09/movesense-grows-independent-from-suunto/
- Whoop developer — https://developer.whoop.com/
- Whoop OAuth — https://developer.whoop.com/docs/developing/oauth/
- Whoop rate limit — https://developer.whoop.com/docs/developing/rate-limiting/
- comGateway Whoop KR — https://www.comgateway.com/blogs/risking-your-2026-health-data-by-accepting-the-delayed-south-korean-whoop-5-0-release/
- Oura cloud docs — https://cloud.ouraring.com/docs/
- Oura API article — https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API
- Polar AccessLink v4 — https://www.polar.com/polar-api-v4/
- Polar Korea — https://polarkorea.co.kr/
- accesslink-example-python — https://github.com/polarofficial/accesslink-example-python
- Wahoo developers cloud — https://developers.wahooligan.com/cloud
- Wahoo App Partners 2026 — https://support.wahoofitness.com/hc/en-us/articles/23022859474962-Wahoo-App-Partners
- Wahoo dealers Korea (Nanux) — https://www.wahoofitness.com/international-dealers
- Coros API application — https://support.coros.com/hc/en-us/articles/17085887816340-Submitting-an-API-Application
- Coros Korea — https://coroskorea.co.kr/
- Suunto Apizone — https://apizone.suunto.com/
- Open SuuntoPlus 2026 — https://www.suunto.com/sports/News-Articles-container-page/open-suuntoplus-built-by-the-community.-powered-by-suunto
- DCRainmaker SuuntoPlus account — https://www.dcrainmaker.com/2026/03/suunto-app-store-creation-account-required.html
- Vakaros VKX spec — https://github.com/vakaros/vkx
- Vakaros telemetry logging blog — https://blog.vakaros.com/blog/telemetry-logging-its-here
- Vakaros Atlas 2 FAQ — https://www.vakaros.com/pages/atlas-2-faq
- Vakaros acquires Sailmon — https://www.vakaros.com/blogs/news/vakaros-acquires-sailmon
- Sailmon support — https://sailmon.com/support/
- Sailmon compare — https://sailmon.com/compare/

### Prior Work (Danny handover)
- `세일링 코칭시스템 개발/CLAUDE.md` — SailTech 브랜드 + Phase 0 상태 (2026-04-20)
- `02_SailTechHUB/src/BLEManager.swift` — RaceBox/Movesense/Garmin 3-sensor BLE manager
- `02_SailTechHUB/src/RaceBoxParser.swift` — UBX FIFO Fletcher checksum
- `02_SailTechHUB/src/SessionRecorder.swift` — JSON 세션 save
- `02_SailTechHUB/docs/README.md` — Phase 0.1 production-ready 명시
- `02_SailTechHUB/docs/CODE_ARCHITECTURE.md` — MVVM + Combine
- `site/riding-dashboard/js/vkx-parser.js` — VKX 1.4 binary 파서 (10Hz quaternion → heel/pitch)
- `site/_experts/expert_hardware_embedded_reference.md` — Hardware #7 BOM·BLE GATT spec lock 대기
- `site/_research/sailing_analytics_landscape_audit.md` — 35-제품 sister 문서

---

## 15. v1 → v2 lock criteria

| 단계 | 조건 |
|---|---|
| v1 → v1.1 | Danny 의 Garmin Connect Developer / Connect IQ 등록 상태 confirm (§2.4 verify 항목) |
| v1.1 → v1.2 | Hardware #7 의 SailTechMOTION BLE GATT spec lock (Service/Characteristic UUID + packet schema) |
| v1.2 → v1.3 | Cloud backend 결정 (Supabase vs custom) + sync schema agreement (§10.3.3 + Frontend #4) |
| v1.3 → v2 (Phase 2 lock) | Samsung Health Data SDK partner 승인 결과 + iOS Android 양 platform native repo skeleton 생성 + 첫 Closed Testing 진입 |

---

**Document version:** v1.0 — 2026-05-27
**Owner:** Mobile App & Integration Engineer (#8)
**Next review:** Phase 2 first Android skeleton 빌드 + iOS TestFlight 첫 배포 직전
