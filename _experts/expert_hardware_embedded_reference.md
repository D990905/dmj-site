# Expert Reference — Hardware & Embedded Engineer

**Role:** Hardware & Embedded Engineer (#7)
**Owner of:** 단무지공방 자체 모션 센서 (kitefoil·wingfoil rider analytics, Vakaros Atlas 2 대항)
**Version:** v1.0 (Phase 1 — Research & Spec only, production 변경 X)
**Date:** 2026-05-27

> 본 문서는 부품·표준·알고리즘에 대한 검증 가능한 reference + Phase 1 spec + BOM + roadmap + 경쟁사 audit + prior work audit 을 통합한 expert handover. 모든 spec 은 datasheet/공식 standard 인용, 추정값은 "estimate" 명시. Phase 2 부터 실제 hardware 제작 진입.

---

## 0. Context & Reading Map

### 0.1 Why this exists (단무지공방 brand fit)

단무지공방의 핵심 고객은 kitefoil·wingfoil rider (Levitaz·PPC·Takoon·WIP brand). 라이딩 분석을 위한 motion sensor 시장은 **Vakaros Atlas 2** 가 현재 단일 leading product 이지만 다음 약점:

| Vakaros 약점 (user reports) | 단무지공방 차별화 가능 |
|---|---|
| $1,200 가격, fragile screen | 가격 $400–600 mid-market |
| Subscription paywall 도입 | No paywall, lifetime data ownership |
| 폐쇄 SDK | Open SDK + community ecosystem |
| Post-race replay 중심 | Real-time coaching (Sports Science 협업) |
| US·EU 중심, Asia-Pacific dealer 빈약 | Korea-first, 부산·제주·요코하마 hub |

→ **Phase 1 = research·spec only.** 실제 PCB·인클로저·인증 진입은 Phase 2.

### 0.2 Reading map

| Section | 무엇을 찾을 때 |
|---|---|
| §1 Prior Work Audit | Danny 이전 작업 trace |
| §2 IMU & Sensor Fusion | IMU 부품, Madgwick/Mahony, heading 추출 |
| §3 GPS & GNSS | 10/25Hz·RTK module, marine antenna |
| §4 BLE SoC, MCU, RTOS | nRF52/54, ESP32, Zephyr vs FreeRTOS |
| §5 PCB Design | 4-layer stackup, 50Ω, antenna keep-out, 자기 차폐 |
| §6 Enclosure & Materials | IP67, UV, 자석, 접착제, 사출 |
| §7 Certification | FCC / CE RED / KC / UN38.3 / IEC 62133 |
| §8 Sensor Spec v1 + BOM | architecture, BOM, power budget |
| §9 Competitor Audit | Vakaros·RaceBox·Velocitek·Sailmon·Movesense·Garmin |
| §10 Development Roadmap | Proto → EVT → DVT → PVT → MP |
| §11 Decision Frameworks | 의사결정 트리 |
| §12 Variables & Constants | 단위·상수 cheat-sheet |
| §13 Sources | 모든 인용 링크 |

---

## 1. Prior Work Audit (Danny handover)

### 1.1 Scope

| 위치 | 결과 |
|---|---|
| `site/_experts/` | 본 문서가 첫 expert doc (이전 expert 흔적 없음) |
| repo grep `IMU|Vakaros|nRF|magnetometer|sensor.*motion` | calculator-pwa 의 "optimum" 수식만 (false positive). **hardware product trace 없음** |
| `_archive/`, `_specs/`, `docs/` | site (kite/foil retail) 콘텐츠만, 센서 hardware doc 없음 |
| Cowork session 메모리 | `[[project_sailtech]]` indexed 흔적 없음 |
| 사용자 uploads | empty |

### 1.2 결론

**Danny 가 이전에 작업한 hardware 산출물 (PCB, schematic, BOM, vendor quote, EVT 발주 기록) 의 trace 는 `dmj-site` repo 또는 본 세션 환경 내에서 발견되지 않음.** 이는 다음 중 하나:

1. Hardware product 작업이 아직 시작되지 않음 (concept 단계로 새 시작)
2. 이전 작업이 다른 위치 (개인 노트북, Notion, Drive, GitHub private repo 등) 에 존재하나 현재 미연결
3. 메모리 indexed 되어 있으나 본 세션 prompt 에 expand 안 됨

### 1.3 보존 원칙

Phase 1 제약 "이전 결과물 보존, revert 금지" 준수:
- 본 산출물 = `_experts/` 폴더 **신규 파일** (어떤 기존 site 파일도 수정·삭제 안 됨)
- BOM·부품 선정은 모두 v1 "후보 lock" 표기, EVT 발주 전 confirm 단계 명시
- Decision rationale 모두 기록 → prior 결정 발견 시 비교 가능

### 1.4 Danny 에게 요청 (필요 시)

prior work reconcile 필요하면:
- [ ] 이전 산출물 폴더 별도 mount (예: `~/Documents/Hardware/Sensor/`)
- [ ] schematic (.kicad/.SchDoc), BOM (.csv/.xlsx), datasheet, vendor email upload
- [ ] `[[project_sailtech]]` 메모리 expand 또는 명시적 share
- [ ] GitHub/GitLab repo link + access (MCP 연동)

---

## 2. IMU & Sensor Fusion

### 2.1 IMU 후보 4종 핵심 spec (datasheet 검증)

| 항목 | BMI270 (6DOF) | LSM6DSO (6DOF) | ICM-42688-P (6DOF) | BNO086 (9DOF + fusion 내장) |
|---|---|---|---|---|
| Accel noise (μg/√Hz) | 160 | **70** (HP, ±2g) | **65** (XY) / 70 (Z) | n/a (fused output only) |
| Gyro noise (mdps/√Hz) | <7 | 3.8 | **2.8** | n/a |
| Max ODR | 6.4 kHz | 6.66 kHz | **32 kHz** | 1 kHz raw (est.) |
| Typ current (6DOF active) | **685 μA** | 0.55 mA | 0.88 mA | ~12 mA (est., 9DOF fusion) |
| Package (mm) | 2.5×3.0×0.8 | 2.5×3.0×0.83 | 2.5×3.0×0.91 | 5.2×3.8×1.1 |
| Interface | SPI/I²C | SPI/I²C/I3C | SPI(24MHz)/I²C/I3C | SPI/I²C/UART |
| Price @ qty 1 (DigiKey) | ~$3.88 | ~$4–5 (est.) | ~$4.91 | ~$13.93 |
| 한 줄 정리 | 저가·저전력 wearable | 균형형 + MLC (on-chip motion FSM) | **고성능 6-axis 표준** | Drop-in 9-DOF, fusion 내장 |

**Foiling 응용 우선순위:**
- **Gyro noise** 가 가장 중요 (foil 의 미세 oscillation·porpoising 캡처) → ICM-42688-P 가 최우수
- Magnetometer 위치 자유도 필요 (sailboat 자기 disturbance 대응) → **분리형 mag 권장** (MMC5983MA, BMM150)
- BNO086 = fastest time-to-prototype 이나 내장 mag 위치 고정·fusion black box → MVP·dev board 용으로만

### 2.2 Madgwick filter

Quaternion-based, **gradient descent** 기반. Gyro integration 으로 orientation 예측 → accel(+mag) reference vector 와의 cost 를 gradient 1 step downhill → **β (beta)** gain 으로 blend.

- β = accel/mag 보정 강도. 0.033–0.1 rad/s. β ≈ √(3/4) × gyro_drift(rad/s)
- IMU mode (6DOF) = gravity reference 만 → yaw drift
- MARG mode (9DOF) = mag 추가 → yaw anchor, magnetic distortion compensation 포함

### 2.3 Mahony filter

**PI controller in SO(3).** Accel/mag 와 예측 방향의 cross-product error → PI 제어 → 보정된 angular rate 를 integrate.

- Kp = 0.5–2.0 (즉시 보정), Ki = 0–0.1 (gyro bias 누적 보정)
- vs Madgwick: 약간 가벼움 (no Jacobian), 명시적 bias estimation → **long session 강점**

### 2.4 Quaternion math — 왜 Euler 가 아닌가

- **Gimbal lock 회피** — pitch ≈ ±90° 에서 Euler 의 yaw·roll 축이 collapse. **foiling 중 와이프아웃** / wing-foiler 의 극한 자세에서 실 risk.
- **Smooth composition** — quaternion 곱셈, 순서 모호성 없음, no trig
- **Normalization** — `q ← q/‖q‖` 매 step (inverse sqrt 한 번, 매우 저렴)
- 표시 layer 에서만 Euler (heel/pitch/heading) 로 변환

### 2.5 Kitefoil·wingfoil 응용 — 추출 데이터

| 추출값 | 어디서 | Foiling 의미 |
|---|---|---|
| **Heel (roll)** | accel gravity | board roll, edge engagement |
| **Pitch** | accel gravity | foil ride height, porpoising 감지, takeoff/landing |
| **Yaw (heading)** | tilt-comp mag + GPS COG 보조 | tack 각, course, layline |
| **Vertical accel (Z)** | accel | 점프 detection, airtime, landing impact |
| **Linear speed** | GPS + IMU fusion | top speed, average, VMG |
| **Foil oscillation** | gyro Y-axis FFT | 피치 진동 (porpoising) 진단 |

**Tilt-compensated compass:** accel 로 body→world DCM 구성 → mag 측정값을 horizontal plane project → atan2 = true heading. Heel 상태 raw mag 만 쓰면 어긋남.

### 2.6 자기 차폐 — Foiling 환경

Foiling 의 magnetic disturbance 원천:
1. **Steel foil mast components** — Mojo·Levitaz hydrofoil 의 stainless steel mast/fuselage → soft iron, board-mounted sensor 에 close 함
2. **Aluminum board (대부분 비자성)** — OK, but anodized hardware screws 는 자성 가능
3. **Kite line hardware** — bar 의 steel quick release, swivel → 거리상 영향 minor
4. **Boat·jetski (towed)** — 엔진/alternator, but towed 동안만

**Mitigation:**
- Sensor 를 board 의 **non-ferrous zone** 에 (foam pad center, hardware screw 에서 ≥25mm)
- 6-axis IMU + GPS COG (heading 대체) = magnetometer 헤더치 자체 회피 — Vakaros 가 실제로 이 방식
- On-water hard-iron + soft-iron cal (figure-8 ride)

---

## 3. GPS & GNSS

### 3.1 u-blox 모듈 비교

| 항목 | NEO-M9N | ZED-F9P | MAX-M10S |
|---|---|---|---|
| Band | L1 single | **L1+L2** dual | L1 single |
| GNSS 동시 | 4 (GPS/GLO/Gal/BDS) + QZSS+SBAS | 4 + QZSS + NavIC | 4 + QZSS+SBAS |
| Max update | 25 Hz | 20 Hz RTK / 25 Hz | 10 Hz default, 25 Hz HP profile |
| Autonomous accuracy | 1.5 m CEP | 1.5 m CEP | 1.5 m CEP |
| RTK | — | **0.01 m + 1 ppm CEP** | — |
| Tracking current | ~31 mA | **68 mA** | **~8 mA** |
| Package (mm) | 12.2×16.0×2.4 | 17×22×2.4 | 10.1×9.7×2.5 |
| Single-unit price (DigiKey) | ~$27 | ~$220–270 (est.) | **~$13** |

### 3.2 의사결정 가이드 — foiling GPS

- **Recreational/club**: NEO-M9N (25Hz, 1.5m, $27) — Atlas 2 의 sample rate 매치, sub-meter 못 따라가도 시장 가격 경쟁력
- **Pro/Olympic foil race**: ZED-F9P + Taoglas Neptune — cm-level RTK
- **Power-critical (multi-day)**: MAX-M10S — 8 mA tracking 압도적

### 3.3 안테나

| Antenna | Bands | Use |
|---|---|---|
| **Taoglas Neptune XAHP.30** | All multi-band | RTK Pro SKU, IP67, pole/deck mount |
| Taoglas FXP612 | L1/L2/L5 | Flexible polymer — 곡면 board mount enclosure |
| Taoglas AHP24510 Levity | L1+L2+L-Band | Embedded internal mount |
| Taoglas AP.10 / generic active L1 patch | L1 only | NEO-M9N / MAX-M10S 저가 옵션 |

---

## 4. BLE SoC, MCU, RTOS

### 4.1 SoC 후보 비교

| 항목 | nRF52840 | nRF54L15 | ESP32-C6 |
|---|---|---|---|
| Core | Cortex-M4F @ 64MHz | Cortex-M33 @ 128MHz + RISC-V coproc | RISC-V HP @ 160MHz + LP RISC-V @ 20MHz |
| Flash / RAM | 1MB / 256KB | 1.5MB RRAM / 256KB | external / 512KB SRAM |
| BLE | 5.0 (5.4 via stack) | **5.4 native** | 5.3 + Wi-Fi 6 + Thread |
| Max TX | +8 dBm | +8 dBm | **+20 dBm** |
| BLE TX current | 16.4 mA @ +8 | **10 mA @ +8 / 5 mA @ 0** | 130 mA @ +20 / ~20 mA @ 0 |
| BLE RX | 5.4 mA | **3.2 mA @ 1 Mbps** | ~20 mA |
| Sleep (System OFF) | ~0.4 μA | **0.6 μA** | ~7 μA |
| Pre-cert module | Raytac MDBT50Q (FCC/IC/CE/KC/Telec/SRRC/NCC/RCM) | Fanstel BM15 (early) | ESP32-C6-MINI-1 (FCC/CE/MIC/SRRC) |
| SDK | Zephyr (nRF Connect SDK) | **Zephyr only (Nordic 공식)** | ESP-IDF (FreeRTOS) |

### 4.2 OTA firmware update

- **Nordic + Zephyr**: MCUboot signed dual-bank A/B, SMP — day-1 nRF Connect SDK 예제로 가능
- **ESP32**: `esp_ota` native, A/B partition, rollback — ESP-IDF 표준, mature

### 4.3 RTOS 권고

**1순위: Nordic nRF54L15 + Zephyr / nRF Connect SDK**
- Nordic 이 nRF54 series 에 Zephyr 만 공식 지원 (FreeRTOS path = community-only, long-term risk)
- BLE host+controller 가 SoC 와 함께 versioned & tested → 통합 risk 최저
- MCUboot signed OTA day-1 가능
- Devicetree 로 GPS UART/IMU SPI/radio/GPIO 선언적 → HW revision portability
- Sleep 0.6μA + RX 3.2mA = 12시간 라이딩 세션 battery 압도적 유리

**2순위 조건부: ESP32-C6 + ESP-IDF**
- BLE +20 dBm 장거리 또는 Wi-Fi 6 telemetry 요구 시
- Active current 2–3× 높아 battery 불리

**비추천: FreeRTOS on nRF5x** — Nordic deprecated path

---

## 5. PCB Design

### 5.1 4-Layer stackup (표준)

```
L1 Signal + components       1 oz Cu
   prepreg ~0.2 mm
L2 GND plane (solid)         0.5 oz
   core ~1.07 mm
L3 Power plane               0.5 oz
   prepreg ~0.2 mm
L4 Signal + low-speed        1 oz
Total ~1.57 mm (0.063")
```

**왜 4-layer minimum:**
1. L2 GND 가 L1 신호 바로 아래 → low-impedance return → 2-layer 대비 EMI 6–10 dB 개선
2. 50Ω controlled impedance 만 가능
3. L2/L3 plane capacitance (수 nF/cm²) — BLE TX burst supply noise 억제
4. FCC/CE radiated emissions 통과율 ↑

### 5.2 50Ω microstrip (Hammerstad–Jensen, FR-4 εr≈4.3, 1oz Cu)

| L1↔L2 H | 50Ω W (근사) |
|---|---|
| 0.1 mm | 0.18 mm |
| **0.2 mm (표준)** | **0.36–0.40 mm** |
| 0.36 mm | 0.66 mm |
| 1.57 mm (2-layer full) | 2.9 mm (비현실) |

**Rule of thumb:** W/H ≈ 2 for 50Ω on FR-4 (EDN #27).

### 5.3 Antenna keep-out

| 종류 | Same-layer KO | Other-layer KO | GND min |
|---|---|---|---|
| PCB trace antenna (IFA/MIFA) | ≥15 mm | ≥6 mm | λ/4 = **31 mm @ 2.4 GHz** |
| Chip antenna | 10×10 mm | 10×10 mm | board 전체 |
| GPS passive patch | n/a | hemisphere 위 unobstructed | **70×70 mm** |
| External (u.FL/SMA) | 0 | n/a | n/a |

### 5.4 자기 차폐 (NXP AN4247)

**Hard vs soft iron:**
- **Hard iron** = 영구자석/spkr → DC bias offset (1회 calibration)
- **Soft iron** = ferrous (screw, μ-metal, ferrite, EMI can) → ellipsoid 왜곡 (3×3 matrix, AN4246)

**Layout rules:**
1. Magnetometer = PCB edge/corner, ferrous component ≥15–25 mm
2. 큰 DC current trace 를 magnetometer 직하 plane 통과 금지
3. 금지 부품: ferrite-core 인덕터, wire-wound, 자성 oscillator can, steel shield
4. μ-metal shielding 비추천 (자체가 soft iron → Earth field 왜곡 → compass 무력화)
5. Factory cal — figure-8 로 sphere fit → bias + 3×3 matrix 저장

**Magnet mount:** 자석이 PCB 와 함께 회전 fixed → hard-iron 일관 → factory cal 한 번에 해결. 분리되면 9DOF compass 포기 → GPS COG 로 heading 대체.

### 5.5 EMI/EMC 핵심

| 기법 | 구현 |
|---|---|
| Ground stitching via | edge / plane 경계 / antenna KO 둘레, ≤λ/20 (~6mm) → 10 dB↓ |
| Decoupling | IC VDD 마다 100nF + 10nF, pin 으로부터 <2mm; BLE VDD 에 10μF bulk |
| Ferrite bead | BLE/GPS LNA power, 600Ω@100MHz, 1A (BLK21BD601SN1) |
| Star ground | analog (IMU, GPS RF) ↔ digital (MCU, BLE digital) 한 점 결합 |
| Shielding can | BLE/GPS section, Cu/brass (steel = soft iron 회피); mag = can 바깥 |
| Trace 분리 | clock(≥10MHz) ↔ RF, ≥3W rule |
| GPS LNA 보호 | BLE 기본파 in-band blocking → GPS 앞단 SAW filter (Murata SAFEA1G57KB0F00) |

---

## 6. Enclosure & Materials

### 6.1 IP67 (IEC 60529)

- **6** = dust-tight (8h vacuum chamber, 0 침투)
- **7** = 1m depth, 30 min, 담수

**Foiling 추가:**
- **염수** → ASTM B117 salt spray 96–500h
- Wave splash + drag → IPX6 (high-pressure jet) 동시
- Foil 의 high-G impact (점프 착지, wipeout) → drop test 1.2m + vibration spec 추가
- O-ring EPDM (UV/오존), compression 15–25%, ISO 3601

### 6.2 UV-resistant plastic

| 재료 | UV | Marine | 사용 |
|---|---|---|---|
| **UV-stab PC** (HALS, Makrolon 2807) | **★ 우수** | 권장 | Main housing |
| ABS | 불충분 | 부적합 | 실내용 |
| PA66+GF | 보통 (carbon black) | 마운트 등 구조부품 | bracket |
| ASA | 우수 | OK, 저렴 | 자동차 외장 grade |
| PC+ASA blend (Bayblend marine) | 우수 | 권장 | 대안 |

### 6.3 자석 N52 (Foil board mount)

| Distance from 10mm Ø N52 | B field | vs Earth (~50μT) |
|---|---|---|
| 5 mm | ~50 mT | **1,000,000×** saturate |
| 20 mm | ~3 mT | 60,000× |
| 50 mm | ~200 μT | 4× |
| 100 mm | ~25 μT | 0.5× |

→ 자석을 PCB 와 fixed 시 hard-iron 일관 → factory cal. Steel cup magnet 으로 flux closure 추가 가능.

### 6.4 접착제 (Foil board / Kite board)

| 제품 | 유형 | Foiling 적합 |
|---|---|---|
| **3M VHB 5952** | acrylic foam | **표준** — board EVA pad·hard top OK |
| 3M 5200 / 4200 | polyurethane | 영구/semi-permanent |
| Sikaflex 291/295 | polyurethane | epoxy board 직접 |

VHB install: IPA cleaning, ≥10°C 권장, 72h cure for full strength.

### 6.5 사출 공정 / MOQ (estimate)

| 공정 | Tool cost | Per-part | 단계 |
|---|---|---|---|
| CNC | $0 | $50–500 | EVT 1–50 |
| SLA print | $0 | $20–100 | 형상검증 (방수 X) |
| Vacuum cast | $1.5–5k | $50–150 | Pilot 20–100 |
| **Al injection mold** | **$3–15k** | **$2–5** | PVT 1k–10k |
| Hardened steel mold | $20–100k+ | $1–3 | MP 100k+ |

Break-even: CNC vs injection ≈ 1k–2k. 한국 사출 = tooling 품질↑, 가격 1.5–2× 중국.

---

## 7. Certification (Korea founder, global sales)

### 7.1 통합 요약 (estimate, pre-cert module 사용)

| 인증 | 시간 | 비용 |
|---|---|---|
| **FCC** (US, Part 15 Subpart C) | 4–8주 | $3k–8k |
| **CE RED** (EU, 2014/53/EU + 3.3 cybersec) | 6–10주 | $5k–15k |
| **KC** (Korea, RRA 적합인증) | 4–8주 | $4k–12k |
| **UN 38.3** (battery transport) | 6–10주 | $5k–15k |
| **IEC 62133** (battery safety) | 8–12주 | $8k–20k |
| **TOTAL parallel** | **10–14주** | **$25k–70k** |
| Without pre-cert (full radiator) | +4–8주 | +$30k–50k |
| **+ Bluetooth SIG QDID** (BT 상표) | — | $8,000 + annual |

### 7.2 핵심 전략: Pre-cert module ★

Nordic / Espressif / u-blox / Raytac / MuRata 모듈 → FCC ID, IC, CE RED DoC, KC, Telec, SRRC, NCC, RCM 이미 보유.

**우리 해야 할 것:**
- 모듈 reference design 100% 준수 (keep-out, antenna, GND)
- Host 라벨 "Contains FCC ID: XXX"
- Host = **unintentional radiator** (Subpart B + EMC) 만 통과
- CE RED 도 EMC + safety + cybersec 만

**효과:** 시간 3–6× 절감, 비용 $30–80k → $10–25k, radio fail risk ≈ 0, 모듈당 +$2–5.

**추천:** Raytac MDBT50Q-1MV2 (nRF52840) 또는 Fanstel BM15 (nRF54L15) + u-blox MAX-M10S.

### 7.3 CE RED 3.3 사이버보안 (2025-08-01 의무)

- 3.3(d) network resilience
- 3.3(e) personal data
- 3.3(f) fraud

→ secure boot, signed firmware, key management, LESC pairing 의무.

### 7.4 UN 38.3 — T1-T8

T1 Altitude (11.6 kPa, 6h) · T2 Thermal (+72/-40°C, 10 cycle) · T3 Vibration (7–200 Hz, 3h/axis) · T4 Shock (150g, 6ms) · T5 External Short (<0.1Ω, 1h+) · T6 Impact/Crush · T7 Overcharge (2× V, 24h) · T8 Forced Discharge. 셀 제조사 이미 보유 (Samsung SDI, LG Chem, Panasonic) — 팩/제품 별도.

---

## 8. Sensor Spec v1 + BOM

### 8.1 Product concept

| SKU | Target user | Display | GPS | 가격대 (목표 retail) |
|---|---|---|---|---|
| **단무지공방 Foil Sensor (Standard)** | Amateur kitefoiler / wingfoiler | 없음 (phone-paired) | NEO-M9N 25 Hz, 1.5 m | **₩550,000–650,000** target |
| **단무지공방 Foil Sensor Pro** | Pro / Olympic / racer | 옵션 small e-paper | ZED-F9P RTK cm-level | ₩1,200,000–1,500,000 target |

BOM v1 = Standard SKU 기준. Pro = GPS 모듈 + antenna 만 swap.

### 8.2 System architecture

```
┌──────────────────────────────────────────────┐
│  Enclosure (UV-stab PC, IP67/IPX6)           │
│  ┌────────────────────────────────────────┐  │
│  │ PCB (4-layer, FR-4, 1.6 mm)            │  │
│  │  [GPS] NEO-M9N ─ UART ──┐              │  │
│  │  [IMU] ICM-42688-P ─ SPI 10MHz ──┤     │  │
│  │  [Mag] MMC5983MA ─ I²C ──┤             │  │
│  │                          ▼              │  │
│  │                 [MCU+BLE] Raytac        │  │
│  │                 MDBT50Q-1MV2 (nRF52840) │  │
│  │  [PMIC] BQ25180 charger ─┤              │  │
│  │  [Buck] TPS62840 3.3V ───┘              │  │
│  └────────────────────────────────────────┘  │
│     │                          │             │
│  [LiPo 603450 1100 mAh]   [USB-C charge]    │
│  [GPS active patch antenna (Taoglas AP.10)] │
│  [BLE: module-integrated chip antenna]      │
│  [N52 magnet bonded into board base]        │
└──────────────────────────────────────────────┘
```

### 8.3 BOM (qty 1k estimate, USD)

| # | Subsystem | Part | Mfr | 단가 (qty 1) | 단가 (qty 1k est.) |
|---|---|---|---|---|---|
| 1 | MCU + BLE module | MDBT50Q-1MV2 (nRF52840) | Raytac | ~$8.50 | $6.00 |
| 2 | IMU 6DOF | ICM-42688-P | TDK | $4.91 | $3.50 |
| 3 | Magnetometer | MMC5983MA | MEMSIC | ~$3.50 | $2.50 |
| 4 | GPS module | NEO-M9N-00B | u-blox | ~$27.00 | $20.00 |
| 5 | GPS active L1 patch antenna | AP.10 | Taoglas | ~$5.00 | $3.50 |
| 6 | Charger IC | BQ25180 | TI | ~$1.20 | $0.85 |
| 7 | Buck 3.3V | TPS62840 | TI | ~$1.40 | $1.00 |
| 8 | LDO analog | TLV70233 | TI | ~$0.40 | $0.25 |
| 9 | LiPo 1100 mAh | LP603450 | EEMB | ~$4.50 | $3.00 |
| 10 | USB-C connector | 6-pin charge | — | ~$0.30 | $0.18 |
| 11 | ESD protection | USBLC6-2SC6 | ST | ~$0.40 | $0.25 |
| 12 | Reset button + RGB LED | — | — | ~$0.35 | $0.22 |
| 13 | Passives (R/C/L ×80) | — | — | — | $1.50 |
| 14 | GPS SAW filter | SAFEA1G57KB0F00 | Murata | ~$0.60 | $0.40 |
| 15 | Ferrite beads ×4 | BLK21BD601SN1D | Murata | ~$0.10 | $0.28 |
| | **PCB 부품 subtotal** | | | | **~$43.43** |
| 16 | PCB 4-layer impedance-controlled | 50×40mm | JLCPCB/한국 EMS | — | $2.50 |
| 17 | SMT assembly | turn-key | — | — | $3.00 |
| 18 | Enclosure top + bottom (PC injection) | custom | — | — | $3.30 |
| 19 | N52 steel-cup magnet | Ø20×5mm | K&J / Korea | — | $1.20 |
| 20 | EPDM O-ring + VHB pad + labels + packaging | — | — | — | $2.10 |
| | **Per-unit total (qty 1k)** | | | | **~$55.53** |

### 8.4 Per-unit cost tier (estimate)

| Quantity | Landed cost |
|---|---|
| Prototype (qty 5–10) | ~$250 |
| EVT (qty 50) | ~$130 |
| DVT (qty 200) | ~$95 |
| **PVT (qty 1,000)** | **~$55–60** |
| MP (qty 10,000+) | ~$40–45 |

**Target retail ₩600,000** = 6.5× BOM markup (typical consumer hardware 5–8×).

### 8.5 Power budget

| Subsystem | Avg current |
|---|---|
| MCU (nRF52840) active+sleep mix | ~1.1 mA |
| IMU (ICM-42688 @ 200 Hz LN) | 0.88 mA |
| Magnetometer (MMC5983 @ 100 Hz) | 1.0 mA |
| GPS (NEO-M9N tracking 25 Hz, 4 GNSS) | 31.0 mA |
| BLE (1Hz adv + periodic notify) | 0.6 mA |
| LDO quiescent | ~0.2 mA |
| **Total avg** | **~34.8 mA** |

→ LP603450 1100 mAh × 12h × 35 mA = **38% DoD**, 500+ cycle life, 8°C 해상 cold derating 흡수. USB-C 5V / 1A → 70 min full charge.

### 8.6 Firmware spec v1

| 항목 | 선택 |
|---|---|
| RTOS | Zephyr (nRF Connect SDK) |
| BLE stack | Zephyr Bluetooth host+controller |
| BLE profile | Custom GATT — Mobile App #8 협업 |
| Sensor fusion | Mahony filter (long-session bias estimation) — Sports Science #3 협업 |
| Logging | Internal flash + BLE live stream (1MB on nRF52840 = ~6h @ 25Hz raw) |
| OTA | MCUboot signed A/B (slot ~440KB) |
| Calibration | Factory hard+soft iron, BLE-triggered re-cal |
| Time sync | GPS PPS pin → MCU TIMER capture (μs IMU timestamping) |
| Security | LESC pairing, signed firmware, anti-rollback, encrypted bond store |

---

## 9. Competitor Audit

### 9.1 At-a-glance 6 products

| Product | Price | GPS Hz | IMU | Battery | BLE | App | Sailing 기능 | SDK | 약점 핵심 |
|---|---|---|---|---|---|---|---|---|---|
| **Vakaros Atlas 2** | $1,200 | **25 Hz L1+L5** | 9DOF | 100h+ | Yes | Vakaros Connect | Full | Partial | Fragile screen, paywall, supply chain |
| **RaceBox Mini/S** | $199/$279 | 25 Hz | 6DOF | ~20h | Yes | RaceBox/3rd party | None | **Yes (public BLE)** | No display, no foil UX |
| **Velocitek ProStart** | $999 | 25 Hz | 6DOF+mag | n/a | **No** | None | Full | No | No BLE/app, closed |
| **Sailmon MAX** | ~$850 | 25 Hz | 9DOF | 16–17h | Yes+WiFi | Sailmon App | Full+polars | No | Subscription paywall |
| **Movesense HR+** | B2B | **No GPS** | 9DOF | months coin | Yes | None (dev) | None | **Yes (open)** | No GPS, B2B, DIY |
| **Garmin quatix 7** | $600 | ~1 Hz | consumer | 57h GPS | Yes+ANT+ | Garmin Connect | Sail profile | **Yes (Connect IQ)** | Watch form, 1 Hz |

### 9.2 Top user complaints (forums + reviews)

| Vakaros Atlas 2 | Sailmon MAX | Velocitek ProStart |
|---|---|---|
| Screen fragile + 비교환 | Subscription paywall (raw .gpx 도 유료) | BLE 없음 |
| Subscription paywall 도입 | community 강제 sharing | LCD fogging (구형) |
| 광고 정확도 vs 실측 차이 | docs 부족 (webinar 의존) | polarized sunglass 가독성 |
| Data download 안정성 issue | Vakaros 인수 후 support 혼선 | cloud sharing 약함 |
| 공급망 지연 | 기능 paywall 이동 경험 | $999 대비 connectivity 빈약 |

(Sources: Practical Sailor, Sailing Anarchy threads, Amazon reviews — §13)

### 9.3 차별화 5 angles

1. **Atlas-class sensor, mid-market price** — $400–600 → Vakaros·RaceBox 사이 빈틈
2. **No-paywall, lifetime data ownership** — raw .gpx/.fit 평생 무료, 모든 onboard 기능 영구 unlock
3. **True open SDK** — on-device firmware SDK + cloud API. Movesense 모델을 foil sport 에. → Moat (network effect)
4. **Real-time coaching layer** — Sports Science #3 알고리즘 (polar × heel × VMG × foil ride height) → BLE haptic cue
5. **Korea-first GTM** — 한국어 native UI, 부산·제주·요코하마 service hub, Asia-Pacific dealer 직접

**Strongest message:** Angle 1 + 2 ("Atlas-grade, ₩600k, lifetime data ownership"). Moat = Angle 3 + 4. Distribution = Angle 5.

---

## 10. Development Roadmap

### 10.1 Stage 정의

| Stage | 목표 | Qty | Duration | 통과 기준 |
|---|---|---|---|---|
| Concept | Architecture + BOM v1 | — | 2주 | 본 문서 |
| Proto | Dev kit 동작 검증 | 1–3 | 4주 | BLE/GPS/IMU stream OK, power ±20% |
| **EVT** | 첫 custom PCB·ID mockup | 5–10 | 8주 | fusion OK, OTA OK, drop test pass |
| **DVT** | 양산 spec lock | 50 | 8주 | IP67·12h battery·EMC pre-scan |
| Cert (parallel) | KC/FCC/CE/UN38.3/IEC | — | 12주 | 모든 인증 통과 |
| **PVT** | 양산 공정 검증 | 200–500 | 6주 | yield ≥85%, field test ≥80% NPS |
| MP | 양산·출하 | 1k+ | ongoing | FA workflow, RMA |

### 10.2 Timeline

```
2026         06   07   08   09   10   11   12 │ 2027  01   02   03   04   05
Concept     ███
Proto            ████
EVT                   ██████
DVT                          ██████
Cert (parallel)              ████████████
PVT                                          ██████
MP launch                                                      ▶ 2027 Q2
```

**Critical path:** EVT (8w) → DVT (8w) → Cert (12w, parallel) → PVT (6w) → MP. **~9-10개월** Concept→MP.

### 10.3 비용 추정 (Phase 1 → MP first batch)

| Stage | Cost (estimate) |
|---|---|
| Concept | $2,000 |
| Proto | $800 + eng time |
| EVT | $4,400 |
| DVT | $25,800 |
| Certification | $25,000 – $70,000 |
| PVT | $42,000 |
| MP first batch (1k unit) | $55,000 – $80,000 |
| **TOTAL (Concept → MP 1st batch)** | **~$155k – $225k** |

Vakaros 추정 $1–2M 대비 **70–80% reduction** (pre-cert 모듈 + 한국 EMS).

### 10.4 Risk Register (top 10)

| # | Risk | Impact | Prob | Mitigation |
|---|---|---|---|---|
| R1 | u-blox 모듈 lead time 폭증 | Schedule +4–8w | High | MAX-M10S second-source footprint 호환 |
| R2 | EVT RF tuning 실패 | EVT respin +3–4w | Med | Reference design strict + EMC pre-scan early |
| R3 | IP67 1차 실패 | DVT spin +3w | Med | EVT 단계 gasket compression 사전 검증 |
| R4 | 인증 1차 fail (FCC/CE EMC) | Cert delay +4–8w, $10k+ | Med | Pre-cert 모듈 + EMC pre-scan + 4-layer GND strict |
| R5 | 자석이 magnetometer 망가뜨림 | Heading 기능 dead | High → mitigated | 자석을 PCB 와 fixed = factory hard-iron cal |
| R6 | LiPo EOL / 안전 사고 | 회수, brand 위험 | Low | UN38.3 + IEC 62133 통과 셀 lock, BMS 보호 |
| R7 | 사출 tooling 지연 (4–6w) | DVT/PVT slip | Med | 한국·중국 동시 견적, soft-tooling backup |
| R8 | OTA brick risk | Field 회수 | Low | MCUboot dual-bank A/B + anti-rollback + USB-C recovery |
| R9 | Mobile App #8 misalign | Launch 지연 | Med | Weekly sync, BLE GATT spec Proto 단계 lock |
| R10 | CE RED 3.3 cybersec 미충족 | EU 진입 지연 | Med | DVT 부터 secure boot + signed FW + LESC 의무 구현 |

### 10.5 협업 timing

| 직무 | When | What |
|---|---|---|
| Mobile App #8 | Concept (지금) | BLE GATT spec, protocol |
| Sports Science #3 | EVT 시작 | calibration spec, coaching algo I/O |
| Visual Designer #1 | EVT 시작 (DVT 8w 전) | enclosure ID, packaging |
| Marketing #6 | DVT 시작 | launch sequence, 차별화 메시지 |

---

## 11. Decision Frameworks

### 11.1 IMU 선정 트리

```
시작
├─ 비용 minimize + low-power wearable? → BMI270
├─ on-chip motion classification 필요? → LSM6DSO (MLC)
├─ ★ 정밀 dynamic (gyro noise 최우수)? → ICM-42688-P
└─ Fastest time-to-prototype, fusion 작성 부담 회피? → BNO086 (dev board only)
```
**최종 채택: ICM-42688-P + 외부 MMC5983MA + host MCU 자체 fusion.** MVP = BNO086 dev board.

### 11.2 GPS 선정 트리

```
시작
├─ Power-critical (multi-day)? → MAX-M10S
├─ ★ 25 Hz · sub-meter · consumer price? → NEO-M9N
└─ Pro/Olympic · cm-level RTK? → ZED-F9P (Pro SKU)
```

### 11.3 SoC + RTOS 트리

```
시작
├─ BLE-only · 12h+ battery 우선 → ★ nRF54L15 + Zephyr
├─ Wi-Fi 6 telemetry / BLE +20 dBm 장거리 → ESP32-C6 + ESP-IDF
└─ Legacy nRF52 양산 transitional → nRF52840 + Zephyr
```

### 11.4 Magnetometer 배치 트리

```
시작
├─ 9DOF compass 유지
│   ├─ 자석이 PCB 와 fixed → factory hard-iron cal OK ★
│   └─ 자석이 분리 mount → user cal 매번 (UX bad)
└─ 9DOF compass 포기 (Vakaros 방식)
    └─ 6DOF IMU + GPS COG = heading
```

### 11.5 인증 순서 (Korea founder)

```
1) Pre-cert BLE/GPS module (radio risk 제거)
2) KC (베이스, 한국어 docs)
3) FCC (modular pass-through)
4) CE RED (EMC + 3.3 cybersec)
5) UN 38.3 (셀 cert 활용)
6) IEC 62133 (BMS 확정 후)
+) Bluetooth SIG QDID
```

---

## 12. Variables & Constants

```
Earth magnetic field (Korea): ~50 μT
BLE 2.4 GHz wavelength: ~125 mm free space, ~62 mm on FR-4 (εr 4.3)
GPS L1: 1575.42 MHz
GPS L5: 1176.45 MHz
FR-4 εr (typical): 4.3
Quaternion identity: q = [1, 0, 0, 0]
Madgwick β typical: 0.033–0.1 rad/s
Mahony Kp/Ki: 0.5–2.0 / 0–0.1
Gyro noise budget (foiling): < 5 mdps/√Hz
Accel noise budget: < 100 μg/√Hz
Heel target resolution: 0.1°
Heading target resolution: 0.5° (tilt-comp)
GPS update target: ≥ 10 Hz (25 Hz preferred)
Battery target: 12 h continuous active session
```

---

## 13. Sources

### IMU
- BMI270: https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf
- LSM6DSO: https://www.st.com/resource/en/datasheet/lsm6dso.pdf
- ICM-42688-P: https://invensense.tdk.com/wp-content/uploads/2022/12/DS-000347-ICM-42688-P-v1.7.pdf
- BNO08X: https://www.ceva-ip.com/wp-content/uploads/BNO080_085-Datasheet.pdf

### GPS
- NEO-M9N: https://content.u-blox.com/sites/default/files/NEO-M9N-00B_DataSheet_UBX-19014285.pdf
- ZED-F9P: https://content.u-blox.com/sites/default/files/ZED-F9P-04B_DataSheet_UBX-21044850.pdf
- MAX-M10S: https://content.u-blox.com/sites/default/files/MAX-M10S_DataSheet_UBX-20035208.pdf
- Taoglas Neptune: https://www.taoglas.com/product/neptune-multi-band-active-gnss-multi-mount-marine-antenna/

### BLE SoC
- nRF52840: https://docs.nordicsemi.com/bundle/ps_nrf52840/page/keyfeatures_html5.html
- nRF54L15: https://www.mouser.com/datasheet/2/297/nRF54L15_nRF54L10_nRF54L05_Datasheet_v0_8-3568773.pdf
- ESP32-C6: https://documentation.espressif.com/esp32-c6_datasheet_en.pdf
- Raytac MDBT50Q FCC: https://raytac.blog/2018/08/27/raytac-nrf52840-module-mdbt50q-fcc-id-granted/

### PCB / EMI
- Altium 4-layer 50Ω: https://resources.altium.com/p/designing-4-layer-pcb-stackup-50-ohm-impedance
- DigiKey impedance (IPC-2141): https://www.digikey.com/en/resources/conversion-calculators/conversion-calculator-pcb-trace-impedance
- NXP AN4247 (layout): https://www.nxp.com/docs/en/application-note/AN4247.pdf
- NXP AN4246 (hard/soft iron cal): https://www.nxp.com/docs/en/application-note/AN4246.pdf

### Certification
- FCC RF: https://www.fcc.gov/oet/ea/rfdevice
- CE RED (EC): https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/radio-equipment-directive-red_en
- RED 2014/53/EU: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014L0053
- RRA (Korea): https://www.rra.go.kr/en/cas/intro.do
- UN 38.3: https://unece.org/transport/dangerous-goods/un-manual-tests-and-criteria-rev7
- IEC 62133-2: https://webstore.iec.ch/publication/32662

### Material / Enclosure
- IEC IP ratings: https://www.iec.ch/ip-ratings
- 3M VHB design guide: https://multimedia.3m.com/mws/media/1400379O/3m-vhb-tape-design-guide.pdf
- Polycase UV plastic: https://www.polycase.com/techtalk/plastic-electronic-enclosures/uv-resistant-plastic.html
- K&J Magnetics N grades: https://www.kjmagnetics.com/blog/magnet-grade

### RTOS
- Ezurio Zephyr vs FreeRTOS: https://www.ezurio.com/resources/blog/zephyr-rtos-vs-freertos-a-comprehensive-comparison-for-iot-and-embedded-systems

### Competitors (audit)
- Vakaros Atlas 2: https://www.vakaros.com/products/atlas-2
- Practical Sailor — Atlas 2 profile: https://www.practical-sailor.com/marine-electronics/vakaros-atlas-2-sailing-instrument-profile/
- Sailing Anarchy Vakaros thread: https://forums.sailinganarchy.com/threads/vakaros.250212/
- RaceBox Mini: https://www.racebox.pro/products/racebox-mini
- Velocitek ProStart: https://www.velocitek.com/products/prostart
- Sailmon MAX: https://sailmon.com/max/
- Sailing Anarchy — Sailmon Bait and Switch: https://forums.sailinganarchy.com/threads/sailmon-max-bait-and-switch.243799/
- Movesense: https://www.movesense.com/specifications/
- Garmin quatix 7: https://www.garmin.com/en-US/p/818387/

---

## 14. v1 → v2 lock criteria

| 단계 | 조건 |
|---|---|
| v1 → v1.1 | Mobile App #8 BLE GATT spec lock |
| v1.1 → v1.2 | Sports Science #3 fusion algorithm I/O lock |
| v1.2 → v2 (EVT lock) | Visual Designer #1 ID lock + 부품 vendor quote freeze + Cert lab 견적 확보 |

---

**Document version:** v1.0 — 2026-05-27
**Owner:** Hardware & Embedded Engineer (#7)
**Next review:** Phase 2 EVT 발주 직전
