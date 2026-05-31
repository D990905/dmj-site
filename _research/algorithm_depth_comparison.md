# §4. 알고리즘 깊이 비교 — Top 10 sailing analytics 의 6 축 reverse-engineer

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 작성일 | 2026-05-28 |
| 위치 | `sailtechco_moat_proposal.md` §2.W3 의 backbone — SailTechCo 4-channel wind inference 의 학술적 reference |
| 출처 | 10 Tier 0 deep-dive (Njord, ChartedSails, Vakaros, SAP, Expedition, Garmin, Vantage, Sailmon, Waterspeed, Velocitek, Deckman) + master audit §2 카드 |
| 검수 기준 | PhD 검수 통과 가능. 모든 알고리즘 claim 은 출처 (공식 docs / GitHub 코드 / blog) 명시. 추측 시 "(공개 출처 미확인)" 또는 "*추정*" 명시. |

> **읽는 방법.** §0 = 6 axis 의 한눈 비교 매트릭스. §1-§6 = 각 axis 의 깊은 reverse-engineer + 비교. §7 = SailTechCo 의 4-channel wind inference 의 알고리즘 spec. §8 = 결론 (algorithm 의 *공개*가 SailTechCo 의 W4 wedge 가 되는 이유).

---

## §0. 6 Axis 의 한눈 비교 매트릭스

> 범례: ✅ **공개 알고리즘** (수식 또는 코드 추출 가능) · 🟡 **메서드 명명 + 부분 description** · ❌ **메서드 명명만 또는 부재** · ⚪ **scope 외**

| 제품 | §1 Wind Inference | §2 Maneuver Detection | §3 Polar / Target | §4 VMG / Racing Metric | §5 Replay 시각 언어 | §6 Coaching |
|---|---|---|---|---|---|---|
| **SAP Sailing Analytics** | ✅ **RF50 → Viterbi HMM → Forward-Backward** (코드 직접) | ✅ Douglas-Peucker + 0.2/1 deg/s 임계값 (코드) | ✅ Cubic regression incremental LSQ (코드) | ✅ ORC PCS 2015 룰 (코드) | 🟡 GWT race replay + autoplay liveraceloop | ❌ |
| **Njord Analytics** | 🟡 "Inferred from typical TWA" — multi-boat constrained optimization 추정 | 🟡 TWA 4-type 분류 (Tack/Gybe/HeadUp/BearAway), 20s before/after window | 🟡 ORC DB + 자기 데이터 학습 (Smoothing 슬라이더) | 🟡 displacement vs instantaneous-VMG dual + "% of target" | ✅ Race-aware timeline + multi-window sync + GoPro GPMF 우선순위 5단계 | ❌ |
| **Vakaros Atlas 2** | ❌ "shift tracking angles 모드" 메서드 명명 + 사용자 1회 캡처 | 🟡 turn detection (sensor 미공개) + GPS reference projection | ❌ (없음) | 🟡 Tack Loss in meters (displacement-based 추정) | 🟡 Connect 앱 session map only | 🟡 LED 3색 + PB 추적 |
| **Vantage Sailing** | 🟡 ML wind + physical constraints + class polar guardrail (architecture 미공개) | 🟡 ML detected maneuvers | 🟡 class-specific polar 학습 | 🟡 segment-level VMG | 🟡 영상 sync 최대 10편 | ❌ |
| **Expedition** | 🟡 navigator manual + TWA × TWS 2D 보정 table (Calibration) | 🟡 Tack analysis tool (channel populated) | ✅ Multi-polar (port/stbd, night, sail-specific, wind-weight, air-density) | ✅ multi-model routing + 13 sensitivity dimension sweep | 🟡 Log replay + stripchart wand | ❌ |
| **Deckman** | 🟡 Dr. Graeme Winn AC 알고리즘 (motion correction + upwash table) | 🟡 datalog + Speed Tests + Polar Learning | 🟡 target vs navigation polar 이중화 + multi-polar swap | 🟡 Start Line Live View + WindPlot oscillation | 🟡 datalog grid + cursor | ❌ |
| **ChartedSails** | 🟡 track-shape wind detection (iOS 1.4.0+) | 🟡 GPS-only, 10s pre-tack average | 🟡 polar overlay (designer polar 로딩) | 🟡 leg-by-leg metrics + Sailing Report PDF | 🟡 web + iOS sync + wind compass rotation | ❌ |
| **Garmin Quatix 7** | ❌ `TWD = (COG_port + COG_stbd)/2 ± 180°` (manual verbatim) | ❌ (Tack Assist single-shot calibration) | ❌ (없음) | ❌ (없음) | 🟡 Garmin Connect activity replay (running/cycling 패러다임) | ❌ |
| **Waterspeed** | ❌ "GPS direction, speed, heading changes" 메서드 명명 (Ultra: forecast pull-in 또는 사용자 입력) | 🟡 GPS-only tack/jibe (Ultra 2025-12 부터) | 🟡 Ultra Polar Chart (personal envelope) | 🟡 Ultra VMG + Target Speeds | 🟡 GPS track + speed heatmap + section splits | ❌ |
| **Velocitek ProStart** | ⚪ (자체 분석 SW 없음, 외부 ecosystem 위탁) | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ |

**핵심 관찰:**
- ✅ **공개 알고리즘 = SAP 만** (Apache 2.0). 그 외 모든 sailing analytics 가 *메서드 명명 + 부분 description* 의 IP 보호 패턴.
- 🟡 **6 axis 모두 공개 깊이 있는 제품 = 없음**. Expedition (§3 + §4) 과 Njord (§5) 가 axis-specific 깊이 있는 정도.
- ❌ **Coaching (§6) 자연어 = 모든 제품 부재**. 이 axis 가 SailTechCo W5 의 white space.
- ⚪ **Velocitek 은 §1-§4 모두 N/A** — 자체 분석 SW 부재, 외부 ecosystem 위탁.

---

## §1. Wind Inference 알고리즘 비교

> **5 가지 알고리즘 family**: (A) 사용자 manual 입력, (B) 사용자 1회 라인업 캡처, (C) 회전 기하 자동 추정, (D) ML wind detection, (E) 외부 weather API 자동 fetch. 각 제품의 family 채택과 algorithm depth.

### §1.1 SAP Sailing Analytics — **가장 정교한 ML + HMM 파이프라인** ✅ 공개

**파이프라인 4단계 (master audit §A2-Deep §1 의 GitHub 코드 추출):**

1. **Preprocessing** — Raw GPS tracks → `RaceWithEstimationData<ManeuverForEstimation>` (`PreprocessingPipeline`)
2. **Per-maneuver classification** — 21개 feature vector → `ManeuverWithProbabilisticTypeClassification` (4가지 type 확률) (`ManeuverClassifiersCache`)
3. **Sequence aggregation** — HMM Viterbi → `ManeuverWithEstimatedType` (best path 추정)
4. **Wind track derivation** — maneuver+type → wind fix list (`WindTrackCalculator`)

**ML 모델 5 종 구현 (`com.sap.sailing.windestimation.model.classifier.smile`):**
- Random Forest (50 트리, **default**) — `RandomForestClassifier.java`
- Neural Network — `NeuralNetworkClassifier.java`
- SVM (Support Vector Machine) — `SVMClassifier.java`
- QDA (Quadratic Discriminant Analysis) — `QDAClassifier.java`
- LDA (Linear Discriminant Analysis) — `LDAClassifier.java`

**Feature vector (TWD-independent, ManeuverForEstimation.java):**
```java
public class ManeuverForEstimation {
    private final Bearing middleCourse;           // 진입↔진출 헤딩 이등분
    private final SpeedWithBearing speedWithBearingBefore;
    private final SpeedWithBearing speedWithBearingAfter;
    private final double courseChangeInDegrees;
    private final double courseChangeWithinMainCurveInDegrees;
    private final double maxTurningRateInDegreesPerSecond;
    private final double speedLossRatio;          // 가장 느린 속도 / 진입 속도
    private final double lowestSpeedVsExitingSpeedRatio;
    private final boolean clean;
    private final ManeuverCategory maneuverCategory;
    private final double scaledSpeedBefore;       // 폴라 대비 정규화된 속도
    private final boolean markPassing;
    private final BoatClass boatClass;
    // ... 총 21개 feature
}
```

**4-class 분류 (ManeuverTypeForClassification.java):**
- TACK (close-hauled 양쪽 전환, TWA ≈ middleCourse)
- JIBE (running 양쪽 전환, TWA ≈ middleCourse.reverse())
- HEAD_UP (풍하 → 풍상, TWA range 제한)
- BEAR_AWAY (풍상 → 풍하, TWA range 제한)

**HMM Transition Probability (IntersectedWindRangeBasedTransitionProbabilitiesCalculator.java) — 핵심 수식:**

```java
private static final double LA_PLACE_TRANSITION_PROBABILITY = 0.001;
private static final double MAX_ABS_WIND_COURSE_DEVIATION_TOLERANCE_WITHIN_ANALYSIS_INTERVAL_IN_DEGREES = 40;

protected double getPenaltyFactorForTransition(TwdTransition twdTransition) {
    double violationRange = twdTransition.getTwdChange().getDegrees();
    double penaltyFactor;
    if (violationRange == 0) {
        penaltyFactor = 1.0;
    } else {
        if (violationRange <= MAX_ABS_WIND_COURSE_DEVIATION_TOLERANCE_WITHIN_ANALYSIS_INTERVAL_IN_DEGREES) {
            penaltyFactor = 1 / (1 + Math.pow(violationRange
                    / MAX_ABS_WIND_COURSE_DEVIATION_TOLERANCE_WITHIN_ANALYSIS_INTERVAL_IN_DEGREES * 2, 2));
        } else {
            penaltyFactor = 1 / (1 + (Math.pow(violationRange, 2)));
        }
    }
    return penaltyFactor + LA_PLACE_TRANSITION_PROBABILITY;
}
```

**해석:**
- **TWD 변화량 ≤ 40°**: quadratic decay `1 / (1 + (delta/20)²)` — 자연스러운 wind shift
- **TWD 변화량 > 40°**: steep decay `1 / (1 + delta²)` — phantom shift 로 간주
- **Laplace +0.001**: 0 분모 회피
- **임계값 40°** = 한 race 내 자연스러운 wind shift 한도

**Forward-Backward 로 confidence marginalize** — Viterbi 가 best path 만 주는 데 비해 Forward-Backward 는 각 노드 posterior marginal → 각 wind fix 의 confidence 산출.

**최종 TWD derivation (MiddleCourseBasedTwdCalculatorImpl.java):**
```java
public Bearing getTwd(ManeuverWithEstimatedType maneuverWithEstimatedType) {
    Bearing twd = null;
    if (maneuverWithEstimatedType.getManeuverType() == ManeuverTypeForClassification.TACK
            || maneuverWithEstimatedType.getManeuverType() == ManeuverTypeForClassification.JIBE) {
        ManeuverForEstimation maneuver = maneuverWithEstimatedType.getManeuver();
        twd = maneuver.getMiddleCourse();
        if (maneuverWithEstimatedType.getManeuverType() == ManeuverTypeForClassification.JIBE) {
            twd = twd.reverse();
        }
    }
    return twd;
}
```

→ **TACK/JIBE 의 middleCourse 가 곧 TWD** (JIBE 는 reverse). head-up/bear-away 는 wind fix 안 만들고 range 제약만.

**5 aggregator 변형 (ManeuverClassificationsAggregatorFactory):**
1. HMM (sequence) — default
2. MST-HMM (Minimum Spanning Tree)
3. Clustering (DBSCAN-style)
4. Outlier removal (Mean / Neighbor)
5. Polars-fitting (TWS/TWD 동시 추정)

→ SAP 의 wind inference 는 음성인식 표준 pipeline (acoustic → language model → decoding) 의 sailing 적용. **단일 알고리즘 자체로 PhD-grade 학술 성과**.

### §1.2 Njord Analytics — Multi-boat constrained optimization (추정)

**Njord 의 wind inference 공개 진술 (master audit §B2-Deep §1):**

> "Njord can reconstruct true wind direction from maneuver angles and upwind/downwind target angles."

> "With multiple boats: TWD inference is more reliable when several boats' data are loaded into the same event — the algorithm uses combined maneuver geometry across all boats to **better constrain the solution**."

**"Better constrain the solution"** = 제약 최적화 (constrained optimization) 의 표준 어휘. **추정 알고리즘:**

```
minimize  Σ_i ||twd_estimate - twd_from_maneuver_i||²
                + λ * boatspeed_residual_i
subject to:
    twd_estimate ∈ [twd_seed - δ, twd_seed + δ]  (seed 가 있을 때)
    Maneuver type ∈ {TACK, JIBE}  (sign disambiguation)
    boatspeed > 0 (paddlewheel preferred)
```

**4 channel 입력:**
1. **Inferred from typical TWA** (이 axis)
2. **Weather Data** (외부 provider 미공개 — master audit §B2-Deep §2)
3. **Constant Value** (사용자 manual)
4. **Interpolated over Time** (시간 보간)

**알고리즘 수식 = 공개 출처 미확인.** Njord 의 IP 보호 패턴.

**SAP 대비 Njord 의 algorithm depth:**
- SAP = ML + HMM + Forward-Backward (확률적, 5 aggregator)
- Njord = constrained optimization (추정, 1 메서드)
- *알고리즘 깊이는 SAP > Njord. Njord 의 강점은 UX/Player 통합.*

### §1.3 Vakaros Atlas 2 — 사용자 1회 캡처 (단순)

**Vakaros 의 공개 진술 (master audit §A1-Deep §1):**

> "Once on the water, run the shift tracking setup in 'angles' to capture your reference angles and the **inferred wind direction** — and that's it."

**메커니즘 (추정 — Vakaros 공식 수식 부재):**

```
세션 시작 시점 (라인업):
1. 사용자가 풍상 starboard tack 1회 → 헤딩_S 저장
2. 사용자가 풍상 port tack 1회 → 헤딩_P 저장
3. TWD = (헤딩_S + 헤딩_P) / 2 + 180°   (close-hauled 정중앙의 반대)
4. tack_angle = |헤딩_S - 헤딩_P|

세션 중:
5. 라이브 헤딩이 reference 와 어긋난 정도 = shift 표시
6. tack/jibe 검출 시 displacement-based loss 계산 (§4 참조)
```

**한계:**
- 라이브 wind shift 자동 추적 부재 (reference 가 stale)
- 사용자 재캡처 의존 (자동화 없음)
- IMU 자체 활용 안 함 (자사 IMU 만)

**향후 약속 (블로그 verbatim):**
> "Look for updates in the near future that will enable using **true wind direction when paired with a wind sensor**."

→ **Vakaros 가 inferred TWD 의 정확도가 measured TWD 보다 떨어진다는 사실을 인정**.

### §1.4 Vantage Sailing — ML wind detection 2.0

**Vantage 의 공개 진술 (master audit §B1-Deep §1, technology 페이지 verbatim):**

> "The algorithm computes true wind direction (TWD) and true wind speed (TWS) from your GPS and boat data using **physical constraints and class-specific polar diagrams**. Those polars act as a **guardrail**: the estimated wind is kept consistent with the expected performance of your boat, so the result is a **plausible, continuous time series** of TWD and TWS over the whole activity."

**알고리즘 architecture (추정):**
- **Input**: GPS lat/lng/speed/COG @ 1Hz + boat class
- **Physical constraints**: TWD 시간연속성 (large jumps during maneuvers ≠ real wind shifts)
- **Polar guardrail**: estimated wind 이 polar 의 expected performance 와 inconsistent 하면 reject
- **Output**: probabilistic TWD/TWS time series + confidence (1.4.0 부터 "Confirm wind direction when ML model returns low confidence")

**SAP HMM 과의 비교:**
- SAP = explicit HMM (Viterbi/Forward-Backward) + 5 ML 모델 옵션
- Vantage = ML black-box (architecture 미공개) + polar guardrail
- *공개 수준 SAP >> Vantage. 정확도 비교 불가 (Vantage validation 데이터 없음).*

### §1.5 Garmin Quatix 7 Tack Assist — 가장 단순한 산술 평균

**Manual verbatim (master audit §D1-Deep §1):**

> "While cruising or racing into the wind, the tack assist feature can help you determine if your boat is being lifted or headed. When you calibrate tack assist, the watch captures your boat's port 1 and starboard 2 course over ground (COG) measurements, and uses the COG data to calculate the **mean true wind direction 3** and the boat's **tack angle 4**."

**수식 추출 (Manual의 callout 번호 + 본문 결합):**

```
TWD_estimated  = (COG_port + COG_starboard) / 2 ± 180°
tack_angle     = |COG_starboard − COG_port|
```

**7가지 한계 (master audit §D1-Deep §1 발췌):**
1. 풍향 센서 부재 — COG bisector 만
2. 조류/표류 보정 불가 — Garmin caution 박스 인정
3. Single-shot calibration (manual snapshot)
4. Asymmetric polar 가정 불가
5. Heading vs COG 혼동 — "VMG-lift" 이지 "header" 아님
6. Fixed override 옵션 존재 (외부 입력 의존 인정)
7. "Into the wind" 한정 (downwind 미지원)

→ **"no-sensor cheap algorithm" 교과서 사례**. Bias 인정 + caution 박스 정직성.

### §1.6 Waterspeed — GPS-only "direction, speed, heading"

**공개 진술 (master audit §C4-Deep §1):**

> "Waterspeed uses GPS direction, speed, and heading changes to automatically identify when you change course through the wind. That means: No manual tagging · No button presses mid-session · No guessing afterward."

**한계 분석:**
- **IMU 부재** — GPS course-over-ground (CoG) 만. *heading* 표현은 casual 동의어 (실제 phone IMU 미활용 추정).
- **Ultra (2025-12 이후)**: forecast pull-in 또는 사용자 입력 풍향 옵션 추가
- **윙포일 라벨 역전 버그 가설** (master audit §C4-Deep §4(b)): broad-reach 패턴 = COG-bisector fallback → 풍축 inversion

### §1.7 Wind Inference 알고리즘 비교 한 테이블

| 제품 | 채널 | 알고리즘 family | 공개 깊이 | 입력 hardware |
|---|---|---|---|---|
| **SAP** | maneuver geometry + buoy wind + WindFinder API | **RF50 + HMM Viterbi/F-B + 5 aggregator** | ✅ 코드 전체 | Race tracking GPS + on-course buoys |
| **Njord** | typical TWA (회전기하) + weather + constant + interpolated | constrained optimization (추정) | 🟡 메서드 명명 | Logbook import (60+ 포맷) |
| **Vakaros** | 사용자 1회 캡처 (angles 모드) | 헤딩 이등분 + ±180° | 🟡 메서드 명명 | Atlas 2 자체 25Hz GPS + IMU |
| **Vantage** | ML (physical constraints + polar guardrail) | ML black-box (Bayesian state-space 추정) | 🟡 메서드 명명 | Phone GPS + Vakaros VKX import |
| **Expedition** | Navigator manual + 2D TWA × TWS calibration table | 외부 instrument fusion (B&G H5000/Ockam T1) | 🟡 PDF Manual | NMEA 2000/0183 외부 instrument |
| **Deckman** | Navigator manual + Dr. Winn motion correction | proprietary (B&G heritage) | 🟡 메서드 명명 | Hercules WTP3 외부 instrument |
| **ChartedSails** | track-shape (1.4.0+, iOS) + session location weather | GPS-based + automatic | 🟡 메서드 명명 | Phone GPS + .vtk/.vkx import |
| **Garmin Tack Assist** | port/stbd COG 평균 1회 | `(COG_p + COG_s)/2 ± 180°` 산술 | ✅ manual verbatim | Garmin Quatix 워치 GPS |
| **Waterspeed** | GPS-only + Ultra: forecast pull-in 또는 사용자 입력 | GPS course-bisector (추정) | 🟡 메서드 명명 | Phone GPS only |
| **Velocitek** | ⚪ (자체 분석 SW 부재) | ⚪ | ⚪ | ProStart 4Hz GPS + IMU (외부 분석 위탁) |

---

## §2. Maneuver Detection 알고리즘 비교

> 모든 sailing analytics 는 tack/gybe 자동 검출이 핵심. 알고리즘 family: (A) heading rate threshold, (B) Douglas-Peucker simplification, (C) ML detection, (D) TWA-based, (E) GPS-only fallback.

### §2.1 SAP Sailing Analytics — Douglas-Peucker + 임계값 ✅ 공개

**ManeuverDetectorImpl.java (lines 60-79):**

```java
public static final int DETECTOR_VERSION = 1;

/**
 * Defines the maximal absolute course change velocity in degrees per second that shall be regarded as a stable course.
 */
private static final double MAX_TURNING_RATE_IN_DEG_PER_SECOND_FOR_STABLE_COURSE_ANALYSIS = 1;

/**
 * Defines the absolute course change in degrees between bearing steps to ignore in order to shorten the
 * approximated span between start and end time of maneuver main curve.
 */
private static final double MIN_ANGULAR_VELOCITY_FOR_MAIN_CURVE_BOUNDARIES_IN_DEGREES_PER_SECOND = 0.2;
```

**해석:**
- **회전율 < 0.2 deg/s** → "stable" (직진 중)
- **0.2 ≤ 회전율 < 1 deg/s** → "in main curve" (회전 중)
- **회전율 ≥ 1 deg/s** → "active turn"

**5 단계 파이프라인 (ManeuverDetector.java javadoc):**
```
1. Douglas-Peucker-fixes set is determined for the GPS-track of competitor.
2. The bearings between DP-fixes are calculated.
3. Consecutive DP-fixes get grouped together if their sign of associated
   bearing is equal and the duration and distance limits between DP-fixes
   is satisfied.
4. For each DP-fixes group a CompleteManeuverCurve gets determined.
5. For each CompleteManeuverCurve-instance appropriate Maneuver-instance(s)
   are determined.
```

**Maneuver Category 5 분류 (ManeuverForEstimationTransformer.java):**

```java
public ManeuverCategory getManeuverCategory(double courseChangeWithinTurningSectionInDegrees, boolean markPassing) {
    double absCourseChangeInDegrees = Math.abs(courseChangeWithinTurningSectionInDegrees);
    if (absCourseChangeInDegrees < 30) return ManeuverCategory.SMALL;       // 무시
    if (absCourseChangeInDegrees <= 120) return markPassing ? ManeuverCategory.MARK_PASSING : ManeuverCategory.REGULAR;
    if (absCourseChangeInDegrees <= 150) return ManeuverCategory.WIDE;
    if (absCourseChangeInDegrees <= 310) return ManeuverCategory._180;
    return ManeuverCategory._360;
}
```

**Clean maneuver 추가 조건:**
1. REGULAR 범주 (30°~120°)
2. 양쪽 경계 안정 (course/speed)
3. 진입속도 vs 진출속도 차이 × 3 < min(진입, 진출) (속도 변화율 < 1/3)
4. 회전 구간 코스 변화 ≈ 전체 코스 변화 (오차 < min(절반, 40°))

**3 모드 detector (모두 별도 구현):**
- `ManeuverDetectorImpl.java` — batch (race 종료 후)
- `IncrementalManeuverDetector.java` — live (실시간)
- `LowGPSSamplingRateManeuverDetectorImpl.java` — 위성 트래커 저샘플링

**Two-boundary 모델 (Maneuver.java javadoc):**
```
The main curve is supposed to deliver information about the acceleration during continuous turning
in the direction of maneuver which can be used for boat class oriented investigations. On the other
side, the maneuver curve describes a section where the boat starts loosing speed and course
stability due to maneuvering preparations, followed by maneuver performance, acceleration and
realignment to the target course on new tack. Based on the maneuver curve, the maneuver loss is
computed which is regarded as an important measurement feature in order to compare performances
of competing racers.
```

→ **"보트 클래스 다이내믹스" (main curve) 와 "선수의 전략적 의사결정" (maneuver curve) 의 의도적 분리**. 14 년 운영의 분석적 abstraction.

### §2.2 Njord — TWA 4-type 분류 + 20s before/after window

**메서드 (master audit §B2-Deep §4):**

- **TWA 메트릭 필수** — 풍향 (자체 또는 계산) 없으면 maneuver 검출 자체 안 됨
- **4 type 자동 검출**: Tack (TWA→0°) · Gybe (TWA→180°) · Turn Up (풍하→풍상, TWA→90°) · Bear Away (풍상→풍하, TWA→90°)
- **Before window** = 20s, **After window** = 20s, **Exclude time** = 사용자 조정
- **Back-to-back maneuvers within ~30-40s will often be skipped** (FAQ 명시)

**한계:**
- TWA 없이는 작동 불가 → 풍향 추정 부정확하면 maneuver 검출도 부정확
- 윙포일 짧은 회전 (4-10초) → Njord default skip

### §2.3 Vakaros — turn detection + reference projection

**메서드 (master audit §A1-Deep §4):**
- "Atlas will detect tacks or gybes" — 50Hz motion fusion (자이로 + 자기 + 가속)
- 사용자 조정 time window (configurable)
- Reference TWD 위에 displacement projection

**SAP 와 비교:**
- SAP = batch + GPS only + Douglas-Peucker
- Vakaros = real-time + IMU 50Hz + reference projection
- *Vakaros 는 hardware 가 IMU 가 있어 SAP 보다 노이즈 저항성*

### §2.4 ChartedSails — GPS-only 10s pre-tack average

**메서드 (master audit §B9 §3):**
- IMU 옵셔널 (VTK/VKX 디바이스 한정), 일반 GPX/FIT 는 COG-only
- Entry 10s 평균 boat speed·VMG → tack 진입 baseline
- Exit 평균 → 회복 시간 + 가속 angle

### §2.5 Waterspeed — GPS-only "direction, speed, heading"

**메서드:**
- GPS course-over-ground (CoG) 변화만 트리거
- IMU 미활용 → 윙포일 라벨 역전 버그 가설 (master audit §C4-Deep §4)
- Ultra (2025-12) 부터 forecast TWD 기준 분류

### §2.6 Maneuver Detection 알고리즘 비교 한 테이블

| 제품 | Sensor input | Threshold / Algorithm | Before/After window | Back-to-back |
|---|---|---|---|---|
| **SAP** | GPS only (Douglas-Peucker) | 0.2 / 1 deg/s + 30°/120°/150°/310° 카테고리 | maneuver curve (2-boundary) | Clean 조건 (속도 변화율 < 1/3) |
| **Njord** | TWA 필수 + GPS | TWA → {0°/180°/90°} | 20s + 20s + Exclude time | ~30-40s skip |
| **Vakaros** | 50Hz IMU + 25Hz GPS | turn rate threshold (수치 미공개) | 사용자 조정 (configurable) | 즉시 detect (real-time) |
| **Vantage** | Phone GPS + ML | ML detected (모델 미공개) | ML model 의존 | ML model 의존 |
| **Expedition** | NMEA instrument data | Tack analysis tool (수치 미공개) | navigator manual range | manual |
| **ChartedSails** | GPS + VTK/VKX IMU 옵셔널 | COG threshold + 10s pre-tack avg | 10s pre + post | (공개 출처 미확인) |
| **Garmin** | 워치 GPS | (Tack Assist single-shot calibration) | N/A | N/A |
| **Waterspeed** | Phone GPS only | COG change threshold | (공개 출처 미확인) | (공개 출처 미확인) |

---

## §3. Polar / Target 곡선 알고리즘 비교

### §3.1 SAP — Incremental cubic regression ✅ 공개

**IncrementalLeastSquares.java 인터페이스:**
```java
public interface IncrementalLeastSquares extends Serializable {
    public abstract void addData(double x, double y);
    // Normal equation matrix (X^T X) 누적, 임의 차수 polynomial fit
}
```

**`IncrementalAnyOrderLeastSquaresImpl`** = 3차 polynomial incremental fit. Gauss elimination 으로 coefficient 추출.

**그룹화 키 (CubicRegressionPerCourseProcessor):**
- BoatClass × LegType {upwind/downwind} × Tack {port/starboard} × TWA bin

→ **포트/스타보드 비대칭 + upwind/downwind 분리** 의 표준 그룹화.

**한계:**
- Real-time on-water coaching 부재 (post-race 분석만)
- Target Speed / Target TWA / Target VMG 클래스 부재 — *SAP 는 Njord-style coach 가 아니다* (master audit §A2-Deep §3.5)

### §3.2 Njord — ORC DB + 자기 데이터 학습

**메서드 (master audit §B2-Deep §3):**

1. **TWS 버킷 단위 binning**
2. **TWA × TWS 2축 grouping** (radial diagram)
3. **Smoothing 파라미터** 사용자 조절 가능 (표본 부족 시 곡선 부드럽게)
4. **Target boat speed = 각 TWS 라인에서 best VMG 가 되는 두 점** (별도 fitted 곡선이 아니라 polar curve 자체에서 도출)

**Polar 소스 7 종:** Adrena pol, B&G csv, CSV, Deckman d, Expedition txt, ORC csv, SailGrib csv/pol

**Polar Editor 기능:**
- 외부 폴라 파일 import
- ORC DB 에서 클래스 폴라 검색
- 자기 누적 데이터로 polar 구축

### §3.3 Vakaros — 의도적 부재 ❌

**Vakaros 의 폴라 부재 (master audit §A1-Deep §3):**

> "Distance-to-line · Time-to-line · Time-to-burn · Countdown timer · Shift tracking · Stripchart view · VMG"

→ **`Polar` · `Target Speed` · `% of target` 단어 functions 목록에 없음**.

**이유 (Practical Sailor 리뷰 Doug Wake 인용):**
> "Our whole message is, it's simple. ... they want something they can stick on, that wirelessly connects, so they can just go sailing."

→ **폴라는 명시적으로 *복잡성* 영역. Vakaros ICP 와 맞지 않음**. *post-race 분석은 Vantage Sailing 에 위탁* — Practical Sailor George Lee Rush 인용.

### §3.4 Expedition — Multi-polar 최강 ✅ 부분 공개

**Polar 11 가지 기능 (master audit §A3-Deep §3):**

1. **기본 폴라** = TWA × TWS 2D 테이블 (7 포맷 호환)
2. **Multiple sail polars** (main + J1/J2/Code 0/A2 spinnaker 별)
3. **Night and port/starboard polars** (v11, 2020) — Expedition 만의 unique
4. **Asymmetric polars for routing** (v11→v12) — port/starboard 분리
5. **Polar % scaling** — 90/95/100/105/110% × 5-route sweep
6. **Table → polar 변환** + target 자동 계산
7. **Polar performance metrics** = polar bsp · polar bsp %
8. **Wind weight** + **air density** (v12, 2024) — 라우팅 엔진 직접 입력
9. **Polar edit window** (Ctrl-P) + **log data overlay** (2016)
10. **Sail test analysis** (반자동 polar 학습)
11. **External tool integration** (KND/ChartedSails/Njord 외부 회귀)

→ **35 제품 중 polar 깊이 1위** (Adrena/Deckman 동률).

### §3.5 Vantage — class-specific polar guardrail

**메서드:**
- ML wind 의 polar guardrail layer (master audit §B1-Deep §3)
- Polar 가 *ML 결과의 sanity check* 역할
- 정확한 polar 학습 메서드 미공개

### §3.6 Waterspeed Ultra (2025-12) — Personal envelope

**Ultra 진술 (master audit §C4-Deep §3):**

> "Ultra introduces Polar Charts that visualize how your performance varies across wind angles and speeds in one overview."

→ **사용자 personal performance envelope** (Njord 의 "learned polar" 패러다임과 동일). 정확한 학습 알고리즘 미공개.

### §3.7 Polar / Target 알고리즘 비교 한 테이블

| 제품 | Polar 입력 | 학습 메서드 | Target 정의 | Multi-polar |
|---|---|---|---|---|
| **SAP** | (관련 모듈은 부수적, 분석 도구로만 사용) | Incremental cubic regression (BoatClass × LegType × Tack × TWA bin) | ❌ (analysis only) | ❌ |
| **Njord** | 7 포맷 (Adrena/B&G/Deckman/Expedition/ORC 등) | ORC DB + 자기 누적 데이터 + Smoothing 슬라이더 | TWS 라인의 best VMG 두 anchor | 🟡 |
| **Vakaros** | ❌ (의도적 부재) | ❌ | ❌ | ❌ |
| **Vantage** | (공개 출처 미확인) | class-specific guardrail | ML guardrail | (공개 출처 미확인) |
| **Expedition** | 7 포맷 + sail-specific × 5 sail | log overlay + sail test analysis (반자동) | Multi-polar architecture | ✅ port/stbd, night, sail |
| **Deckman** | 7 포맷 + multi-polar swap | Polar Learning (자동, 메서드 미공개) | target vs navigation 이중화 | ✅ environment swap |
| **ChartedSails** | designer polar 로딩 (예: Melges IC37) | ML wind detection + polar 대비 % VMG | polar boatspeed 대비 % | 🟡 |
| **Waterspeed Ultra** | (Ultra 2025-12+) | personal envelope (메서드 미공개) | "Performance vs Target Speeds" | ❌ |
| **Garmin** | ❌ | ❌ | ❌ | ❌ |

---

## §4. VMG / Racing Metric 알고리즘 비교

### §4.1 SAP — ORC PCS 2015 룰 ✅ 공개

**ORCPerformanceCurveRankingMetric.java javadoc:**

```
As opposed to before 2015 when implied wind was the only ranking criterion at all times, in 2015 it
was decided to rank based on corrected times, and corrected times shall be computed not by mapping
each boat's implied wind to the performance curve of a scratch boat, but instead map the implied
wind of the boat with the greatest implied wind onto each other boat's performance curve to obtain
their time allowance for the course they sailed so far and then compare with their actual elapsed
time.
```

**알고리즘 흐름:**
1. 각 boat 의 ORC certificate → polar curve
2. Race 실제 wind 조건 + 코스 길이 → 각 boat 의 polar 위에서 "최적 elapsed time" 산출
3. **Implied wind** = 실제 경과 시간 ↔ polar 의 역방향 mapping
4. Race-level ranking: 가장 implied wind 큰 boat 기준으로 corrected time 재계산

**27 가지 ScoringSchemeType:**
```java
public enum ScoringSchemeType {
    LOW_POINT, LOW_POINT_WITH_AUTOMATIC_RDG, HIGH_POINT, HIGH_POINT_ESS_OVERALL,
    HIGH_POINT_LAST_BREAKS_TIE, HIGH_POINT_FIRST_GETS_TEN, LOW_POINT_WINNER_GETS_ZERO,
    HIGH_POINT_MATCH_RACING, LOW_POINT_FIRST_TO_WIN_TWO_RACES, ...
}
```

→ World Sailing Low Point (Appendix A) 부터 ESS high-point, 매치 레이싱, 리그, 메달 시리즈 — **한 회사가 한 솔루션에 모은 가장 큰 sailing scoring library**.

### §4.2 Njord — Dual VMG (displacement vs instantaneous)

**Njord FAQ verbatim (master audit §B2-Deep §4):**

> "'VMG gain' is calculated from the **start & end position**, using the TWD (average TWD, from both boats) as the reference bearing.
> 'Average VMG' that you see in the table above is taking each boat's TWA & Boatspeed, **calculating the instantaneous VMG along the track**, and averaging that."

**두 방식 의도적 출력:**
- **Method A — displacement (위치 기반)**: 분석 윈도 시작/끝 GPS 위치 → TWD 방향 투영. *COG/GPS 기반*.
- **Method B — instantaneous-VMG (적분)**: 각 sample TWA·BoatSpeed → 순간 VMG → 시간평균. *Heading + Wind instrument 기반*.

**"% of target" 계산 (master audit §B2-Deep §3 추정):**
```
% of target = (BoatSpeed_observed) / (Polar_lookup(TWS, TWA)) × 100
Avg % of target = mean(% of target across segment)
```

### §4.3 Vakaros — Tack Loss in meters (displacement)

**메서드 (블로그 verbatim):**

> "the Atlas will detect tacks or gybes and display how many meters were lost (or maybe gained, for those with a really good roll tack) after the maneuver is completed."

**SailTechCo reverse-engineer 수식 (master audit §A1-Deep §4):**

```
loss_m = D_no_maneuver - D_actual

  where:
    D_no_maneuver = (boat speed averaged over window) × (window time) × cos(target TWA)
    D_actual = projection onto reference TWD direction of:
               (position at end of window) - (position at start of window)
```

→ Njord 의 **Method A (displacement)** 와 동등 계열.

### §4.4 Expedition — 16+ Sensitivity sweep workflow

**라우팅 sensitivity dimension (master audit §A3-Deep §3.5):**
1. Polar % (90/95/100/105/110%)
2. TWS % (90~120%)
3. TWD ± (-10/-5/0/+5/+10°)
4. User wind (current 효과 분리)
5. Instrument wind (deterministic)
6. Multiple staggered-start
7. Tack/gybe preference on/off
8. Wave correction
9. Air density (v12)
10. Race notes (area avoidance)
11-13. Ensemble routing (ECMWF 50+ members)
14-16. Multi-model routing (ECMWF/GFS/ICON/UM)

→ **라우팅을 "단일 정답" 으로 보지 않고 16+ 차원 sweep 로 robustness 평가** — 30년 grand prix 의 design philosophy.

### §4.5 VMG/Racing Metric 비교 한 테이블

| 제품 | VMG 정의 | 회전 손실 측정 | Racing metric 깊이 |
|---|---|---|---|
| **SAP** | (analysis only) | ManeuverLoss (2-boundary trajectory comparison) | **ORC PCS 2015 + 27 ScoringSchemeType** ✅ |
| **Njord** | Dual (displacement + instantaneous) | Average 20s before/after window | TWS/TWD/BoatSpeed/VMG/% target/Heel/Trim/Rudder |
| **Vakaros** | Displacement only (reference projection) | meters 단위, LED 3색 신호 | Distance-to-line/Time-to-line/Time-to-burn |
| **Vantage** | segment-level VMG (ML 의존) | ML detected | speed bias, tack bias, distribution |
| **Expedition** | polar bsp % + VMG/VMC | Tack/gybe loss time + meters 채널 | **16+ sensitivity sweep + Multi-polar** ✅ |
| **Deckman** | layline + Start Line Live View | datalog manual cursor | RacePanel (WindPlot, SailSteer, What If) |
| **ChartedSails** | leg-by-leg metrics + polar 대비 % | 10s pre/post automatic | 자동 maneuver detection |
| **Garmin** | ❌ | ❌ | ❌ |
| **Waterspeed Ultra** | VMG + "Performance vs Target" | Gain·Loss analysis | personal polar envelope |

---

## §5. Replay 시각 언어 비교

### §5.1 Njord Player — Multi-window sync + GoPro GPMF 우선순위 5단계 ✅ 가장 정교

**메서드 (master audit §B2-Deep §6):**

**(A) 멀티-윈도 sync 원칙:**
> "Run any number of windows across any number of screens — all playing in perfect sync. Every window stays locked to the same playback position. Scrub in one and everything follows."

**(B) Live strip charts default:** BoatSpeed · TWA · VMG (+ user customize)

**(C) Race-aware timeline 시각 어휘 4종:**
1. Upwind/downwind legs colour-coded
2. Tacks/gybes marked
3. Races/legs labelled
4. On-water comments markers

**(D) GoPro/드론 timestamp 우선순위 5단계** (Loading Media 도움말):
1. **GoPro GPMF (GPS Time)** — 신형 GoPro GPS 켰을 때 자동, 가장 정확
2. **QuickTime Time Code (start of video)** — GoPro GPS off 시
3. 파일명 패턴 `YYYY-MM-DD_hh-mm-ss` 자동 추출
4. 파일 capture date EXIF
5. 파일 creation date (fallback)

**추가:**
- **DJI 드론**: `.SRT 파일 함께 두면 timestamp offset 정확 매핑
- **SailGP 방송 영상**: "TV broadcast start time minus approximately 33 seconds" 마법 상수
- 시각 큐: "boom and rudder visible in the video to synchronize with a turn up / tack visible in the boat's track"

**(E) Export:**
- Baked-in 데이터 오버레이 비디오 (메트릭 선택)
- Batch photo export (각 사진 timestamp 데이터 동기)

→ **35 제품 중 Replay 시각 언어 1위**.

### §5.2 SAP — GWT race replay + autoplay liveraceloop

**메서드 (master audit §A2-Deep §6):**

- **Map base**: Google Maps (현재). OSM 대안 wishlist
- **Boat track**: 실시간 GPS path overlay + 시간축 scrubbing
- **Wind arrows**: HMM 결과의 wind fix 를 위치별 표시
- **Mark/course**: race log course events 기반
- **Leaderboard**: 27 ScoringSchemeType 의 ranking, leg-by-leg
- **Maneuver markers**: tack/gybe 위치 + loss 수치
- **Charts**: dashboards.gwt 모듈 (speed-over-time, VMG, distance to mark)

**한계:**
- GWT 코드베이스 deprecated → modernization 부담
- Live tactical coaching dashboard 부재 (Sail Insight 별 앱이 담당)

### §5.3 Expedition — Log replay + stripchart wand

**메서드 (master audit §A3-Deep §6):**

- **Log file analysis** (v11, 2020): Recent performance, Tack analysis, Analyse sail tests, Log files to grib
- **Playback / Simulator** (p.1554–1599): TWD/TWS/HDG/BSP 사용자 정의, log 1Hz–10Hz 가속 재생, Pause/step back/forward
- **Stripchart wand**: 임의 시간 cursor → log 데이터 extract
- **KML / GPX export**: 외부 시각화
- **Race tracking** (YB / Blue Water): fleet 위치 → post-race fleet replay (simple animation)

→ "raw 데이터 → 외부 SW (ChartedSails/KND/Sailing Performance/Njord/ReXY Gold/Model Accuracy) ecosystem 위탁" 모델.

### §5.4 Vakaros Connect — Configure + update primary

**메서드 (master audit §A1-Deep §6):**

- App Store description verbatim: "Vakaros Connect allows you to **configure and update** your Vakaros wireless products right from your iPhone!"
- v1.13.3 (2024-12): "Replaced the map tile provider"
- v1.14.6 (2025-07): "changes to session map"
- v1.14.11 (2025-11): "fixed bug where share menu wouldn't appear"

→ **Connect 앱은 리플레이 분석 SW 가 아니다**. 텔레메트리 다운로드 + 위젯 설정 + 펌웨어 업데이트 + 단순 session map. *Njord Player 수준 영역 아님*.

→ **post-race 분석 = Atlas 2 → Connect → Vantage Sailing 외부 파트너 워크플로**.

### §5.5 Vantage — 영상 sync 10편

**메서드 (master audit §B1-Deep §6):**
- 영상 sync 최대 10편 업로드
- 텔레메트리와 시간 동기
- side-by-side connection 비교 (같은 시간·장소)

### §5.6 Waterspeed — GPS track + speed heatmap

**메서드 (master audit §C4-Deep §6):**
- (1) GPS 트랙 line replay (시간 슬라이더)
- (2) Speed-color heatmap
- (3) Peak moment marker
- (4) Section splits
- (5) Performance build-up timeline

**한계:**
- 3D 보트 모델 부재
- 다중 보트 비교 부재 (NorthStar 같은 single-boat demo)
- Tactical 카메라 angle 부재
- 비디오 sync overlay 부재 (master audit §C4-Deep §6(d))

### §5.7 Replay 시각 언어 비교 한 테이블

| 제품 | Replay platform | 시각 어휘 | Multi-window sync | GoPro/Video sync | Multi-boat overlay |
|---|---|---|---|---|---|
| **Njord Player** | Desktop + Web (iPad/Android tablet) | leg color + maneuver marker + race label + comment marker | ✅ "scrub in one, everything follows" | ✅ 5-tier 우선순위 (GPMF/QuickTime/filename/EXIF/creation) | ✅ multi-boat sync |
| **SAP** | GWT (Web only, deprecated) | wind arrows + maneuver markers + GPS path | 🟡 single window | ❌ | ✅ fleet replay |
| **Expedition** | Windows desktop | log + stripchart wand | ❌ | 🟡 KML export | 🟡 fleet tracking |
| **Vakaros Connect** | iOS app | session map (단순) | ❌ | ❌ | ❌ |
| **Vantage** | iOS / Android / Mac | side-by-side connection 비교 | 🟡 single screen | ✅ 최대 10 영상 sync | ✅ connection 비교 |
| **Waterspeed** | iOS / Android / Web | GPS track + speed heatmap + section splits | 🟡 single screen | ❌ (video sync 부재) | 🟡 NorthStar demo (single boat) |
| **ChartedSails** | Web + iOS | wind compass rotation + tail selector | 🟡 single screen | 🟡 video sync (GoPro/iPhone) | ✅ multi-boat fleet overlay |
| **Garmin Connect** | Web + iOS / Android | running/cycling stroke animation 패러다임 | ❌ | ❌ | ❌ |
| **Deckman** | Windows desktop | datalog grid + cursor | ❌ | ❌ | 🟡 competitor handicap |
| **Velocitek** | ⚪ (외부 위탁) | ⚪ | ⚪ | ⚪ | ⚪ |

---

## §6. Coaching / Decision Support 비교 — ❌ Universal Gap

> 35 제품 중 *진정한 자연어 코칭* 을 제공하는 제품은 zero. 이 axis 가 SailTechCo W5 의 white space.

### §6.1 Vakaros — LED 3색 + PB 추적 🟡

**메서드 (블로그 verbatim):**

> "the LED array will light up Green if the maneuver is above average within your current session, red if it is below, and **purple when you achieve a new personal best**!"

→ **세션 내 평균 baseline + PB tracking + 3색 LED** — 가장 가벼운 수준의 즉시 피드백.

### §6.2 Expedition — Race notes + What-if predictive

**메서드 (master audit §A3-Deep §6):**

- **Race notes**: 사용자가 "이 해역 들어가지 말 것" polygon 정의 → routing 엔진이 hard-avoid
- **What-if 모듈** (RacePanel Part 4): "current leg 위에서 만약 wind 가 N도 shift 했다면 layline 까지 시간은?"
- **Limit layline sectors**: wind shift 통계적 envelope 안 가능한 layline 부채꼴

→ **Decision support 는 있으나 자연어 코칭 아님**. Navigator 가 직접 해석.

### §6.3 Deckman — RacePanel WindPlot + SailSteer

**메서드 (master audit §A4-Deep §5):**

- **WindPlot**: TWD 시계열 + 통계적 mean / oscillation envelope → "phase 의 lifted vs headed" 직관 진단
- **SailSteer**: 양 tack 의 비교 (time / distance / bearing) — 한 화면

→ **수치 시각화 의 가장 정련된 형태이지만 자연어 코칭은 아님**.

### §6.4 옥코치 R1-R9 (SailTechCo 기보유 자산) ✅ 알고리즘 + LLM 결합

**기보유 자산 (`회전코칭_AI_엔진_설계안_v1_2026-05-22.md` 인용):**

- R1 진입 비대칭 (jibe 진입 시 보드 cant 좌우 비대칭)
- R2 회전 회복 시간 (정상 라이딩 속도 회복까지 초)
- R3 2단 회전 (heading rate 봉우리 2개)
- R4 진입 손실 (jibe 진입 직전 속도 dip)
- R5 출구 가속 (jibe 출구 후 가속 angle)
- R6 토 사이드 전환 (toe-side 진입 안정성)
- R7 풍축 어긋남 (jibe 후 풍축 대비 deviation)
- R8 보드 cant 과도 (carve angle 과대 / 과소)
- R9 윙 회전 늦음 (wing flip 타이밍)

**LLM 자연어 변환:**
- 한국어 코치 톤 (존댓말·짧은 호흡·도메인 어휘)
- 격려 + 정직 결합
- 사용자 진보 단계 인지 (초·중·고급)

→ **SailTechCo 가 35 제품 중 유일한 자연어 코칭 SW 가 될 것**.

### §6.5 Coaching 비교 한 테이블

| 제품 | Decision Support | 자연어 코칭 | 게이미피케이션 |
|---|---|---|---|
| **모든 35 제품** | ❌ 부재 | ❌ 부재 | 🟡 Vakaros LED 3색 만 |
| **Vakaros** | start line guide | ❌ | ✅ LED + PB |
| **Expedition** | What-if + Race notes + Limit layline | ❌ | ❌ |
| **Deckman** | WindPlot + SailSteer + Limit sectors | ❌ | ❌ |
| **Njord** | static docs (User Guide) | ❌ | ❌ |
| **SAP** | scoring + leaderboard | ❌ | ❌ |
| **Waterspeed** | Discover/Explore+ feed + leaderboard | ❌ | 🟡 challenges |
| **SailTechCo (계획)** | 룰엔진 deterministic | ✅ R1-R9 + LLM 한국어 | ✅ NPS, retention 추적 |

---

## §7. SailTechCo 4-Channel Wind Inference 의 알고리즘 spec (W3 구체화)

> §1 의 9 제품 알고리즘 reverse-engineer 결과를 기반으로, SailTechCo 의 4-channel wind inference 의 정확한 알고리즘 spec.

### §7.1 알고리즘 전체 architecture

```
                          ┌─────────────────────────────────────┐
                          │   SailTechCo 4-Channel Wind Engine  │
                          └─────────────────────────────────────┘
                                          │
        ┌─────────────────┬───────────────┼───────────────┬──────────────────┐
        │                 │               │               │                  │
   Channel A           Channel B       Channel C       Channel D        Confidence
   사용자 1회 캡처      Apple Watch     다회전 기하     외부 weather    출력 (높음/보통/낮음)
   (Vakaros-style)     Core Motion     (Njord-style)   API
        │                IMU             │               │
   헤딩_S, 헤딩_P      pitch/roll/yaw    jibe ensemble   KMA/OpenWeather/
   1회 lineup          시계열            of bisectors    Windy
        │                │               │               │
        ▼                ▼               ▼               ▼
   ╔══════════════════════════════════════════════════════════════╗
   ║         Bayesian weighted circular mean + variance           ║
   ║                                                              ║
   ║  TWD_estimated = circular_weighted_mean({A, B, C, D},       ║
   ║                                          {w_A, w_B, w_C, w_D})║
   ║                                                              ║
   ║  TWD_confidence = inverse_variance(estimates, weights)       ║
   ╚══════════════════════════════════════════════════════════════╝
                                          │
                                          ▼
                            ┌──────────────────────────────┐
                            │  Korean reasoning (LLM):     │
                            │  "4 채널 모두 235° 부근 일치.│
                            │   매우 신뢰 가능."           │
                            └──────────────────────────────┘
```

### §7.2 Channel A — 사용자 1회 라인업 캡처 (Vakaros-style + 확장)

**Spec:**
- 세션 시작 라인업 단계
- 사용자가 풍상 starboard tack 1회 + 풍상 port tack 1회 헤딩을 손으로 저장
- iPhone magnetometer (Apple `CMMotionManager.deviceMotion.heading`) 또는 Apple Watch 자기 컴퍼스
- 이등분 = 풍축 후보

**수식:**
```python
def channel_a_user_lineup(heading_S: float, heading_P: float) -> tuple[float, float]:
    """
    Args:
        heading_S: 풍상 starboard tack 헤딩 (자북 기준, degrees)
        heading_P: 풍상 port tack 헤딩 (자북 기준, degrees)
    Returns:
        (twd_estimate, confidence)
    """
    # 원형 평균 (circular mean)
    avg_heading = circular_mean([heading_S, heading_P])
    twd_estimate = (avg_heading + 180) % 360  # close-hauled 정중앙의 반대

    # Confidence = tack angle 의 reasonableness
    tack_angle = circular_difference(heading_S, heading_P)
    if 70 <= abs(tack_angle) <= 110:  # 윙포일 close-hauled 약 80-100°
        confidence = 0.9
    elif 50 <= abs(tack_angle) <= 130:
        confidence = 0.6
    else:
        confidence = 0.3  # 의심스러운 tack angle

    # Time decay: 캡처 후 30분 이상 경과 시 confidence 감소
    minutes_since_capture = (now() - capture_time).total_seconds() / 60
    time_decay = max(0.3, 1.0 - minutes_since_capture / 120)  # 2시간 후 0.3
    return twd_estimate, confidence * time_decay
```

**한계:**
- 사용자가 라인업 단계에서 실수 시 systematic error (예: 헤딩_S = 헤딩_P 입력 → tack_angle=0 → 의미 없는 추정)
- 풍축이 세션 중 시프트되면 reference stale → time_decay 로 confidence 감소

### §7.3 Channel B — Apple Watch Core Motion IMU (SailTechCo 의 unique wedge)

**Spec:**
- iOS / watchOS `CMMotionManager` + `CMAttitudeReferenceFrame.xMagneticNorthZVertical`
- pitch (board nose 각도) — foiling on/off detection 보조
- roll (board cant) — port/starboard lean
- yaw rate (회전 속도) — jibe 감지
- 50 Hz 샘플링 (Apple Watch standalone)

**알고리즘 (윙포일 leeway 추정 → 풍향 보정):**

```python
def channel_b_imu_wind_estimate(
    pitch_series: list[float],
    roll_series: list[float],
    yaw_series: list[float],
    cog_series: list[float],
    speed_series: list[float]
) -> tuple[float, float]:
    """
    Args:
        pitch/roll/yaw_series: Apple Watch Core Motion 50Hz
        cog/speed_series: GPS 1Hz (interpolated to 50Hz)
    Returns:
        (twd_estimate, confidence)
    """
    # 라이딩 중 (foiling-time threshold 위) 의 board heading 추정
    # board heading ≈ yaw - heading_offset (라이더 wrist 가 보드와 평행이라 가정)
    foiling_segments = [i for i, s in enumerate(speed_series) if s >= 10]  # 윙포일 10kt+

    if len(foiling_segments) < 100:  # 표본 부족
        return None, 0.0

    # 라이딩 중 yaw - cog 차이 = leeway 추정
    leeway_estimates = []
    for i in foiling_segments:
        if abs(roll_series[i]) > 5:  # board cant 5° 이상 (윙포일 정상 라이딩)
            leeway = (yaw_series[i] - cog_series[i] + 540) % 360 - 180
            leeway_estimates.append(leeway)

    median_leeway = np.median(leeway_estimates)

    # 라이딩 보드 heading 의 중심 분포 ≈ 풍축 ± 90° (close-hauled 가정)
    # 양 tack 의 보드 heading 의 이등분이 풍축의 반대 (Vakaros 와 동일 논리)
    board_headings = [yaw_series[i] for i in foiling_segments]

    # KMeans 또는 GMM 으로 2 cluster (port/starboard tack)
    from sklearn.cluster import KMeans
    if len(board_headings) >= 200:
        clusters = KMeans(n_clusters=2).fit_predict([[h] for h in board_headings])
        port_headings = [board_headings[i] for i, c in enumerate(clusters) if c == 0]
        stbd_headings = [board_headings[i] for i, c in enumerate(clusters) if c == 1]

        if len(port_headings) > 50 and len(stbd_headings) > 50:
            twd_estimate = (circular_mean(port_headings) + circular_mean(stbd_headings)) / 2 + 180
            twd_estimate = twd_estimate % 360

            # Confidence = cluster separation + sample size
            cluster_sep = abs(circular_difference(
                circular_mean(port_headings),
                circular_mean(stbd_headings)
            ))
            confidence = min(0.85, 0.5 + 0.3 * (cluster_sep / 90))  # 90° separation = max conf

            return twd_estimate, confidence

    return None, 0.0
```

**Counter-position vs Waterspeed (windfoil tack 라벨 역전 버그):**
- Waterspeed = GPS only (CoG 만 사용) → broad-reach 패턴에서 풍축 inversion
- SailTechCo = **Apple Watch IMU 의 board heading 직접 캡처** → CoG vs board heading 의 leeway 직접 측정 가능 → broad-reach 패턴에서도 정상 분류

### §7.4 Channel C — 다회전 기하 (Njord-style)

**Spec:**
- 검출된 모든 jibe/tack 의 (heading_before, heading_after) 이등분
- 풍축 후보의 ensemble → MLE (maximum likelihood) 또는 Bayesian posterior
- 표본 부족 (jibe < 5) 시 confidence 낮음

**알고리즘:**

```python
def channel_c_maneuver_geometry(
    maneuvers: list[Maneuver],
    prior_twd: float = None,
    prior_strength: float = 0.0
) -> tuple[float, float]:
    """
    Args:
        maneuvers: 검출된 jibe/tack list (heading_before, heading_after)
        prior_twd: 외부 weather API 의 풍향 (옵셔널 prior)
        prior_strength: prior 강도 (0-1)
    Returns:
        (twd_estimate, confidence)
    """
    if len(maneuvers) < 5:
        return None, 0.2  # 표본 부족

    # 각 maneuver 의 이등분 = 풍축 후보 ± 180°
    bisectors = []
    for m in maneuvers:
        bisector = (circular_mean([m.heading_before, m.heading_after]) + 180) % 360
        bisectors.append(bisector)

    # MLE: 이등분의 circular mean
    twd_mle = circular_mean(bisectors)

    # Prior 결합 (Bayesian)
    if prior_twd is not None and prior_strength > 0:
        # 원형 prior 와 결합 — von Mises distribution 가정
        kappa_prior = prior_strength * 10
        kappa_likelihood = len(maneuvers) * 0.5
        kappa_total = kappa_prior + kappa_likelihood

        twd_estimate = circular_combine(prior_twd, twd_mle, kappa_prior, kappa_likelihood)
        confidence = min(0.95, kappa_total / 50)
    else:
        twd_estimate = twd_mle
        # Confidence = inverse variance of bisectors
        variance = circular_variance(bisectors)
        confidence = min(0.9, 0.5 + 0.4 * (1 - variance / 90))

    return twd_estimate, confidence
```

**Njord 와의 차이:**
- Njord = multi-boat 결합 (보트 수 ≥ 2 시 정확도 상승) → 1인 윙포일 적용 불가
- SailTechCo = **단일 라이더의 다회전 ensemble** + 외부 weather 의 prior 결합 → 솔로 시나리오 적합

### §7.5 Channel D — 외부 Weather API

**Spec:**
- **한국 한정**: KMA (기상청) RDAPS (1.5km 해상도) / LDAPS (3km)
- **글로벌 fallback**: OpenWeather Time Machine / Windy API / Stormglass
- 세션 시작 시각 + 트랙 중심 좌표로 historical wind direction fetch

**알고리즘:**

```python
def channel_d_weather_api(
    lat: float,
    lng: float,
    timestamp: datetime,
    region: str = "KR"
) -> tuple[float, float]:
    """
    Args:
        lat/lng: 세션 트랙 중심
        timestamp: 세션 시작 epoch
        region: 한국 'KR' = KMA, 그 외 = OpenWeather
    Returns:
        (twd_estimate, confidence)
    """
    if region == "KR":
        # KMA RDAPS 1.5km 해상도
        result = kma_rdaps_fetch(lat, lng, timestamp)
        confidence = 0.7  # 1.5km 해상도 — micro-spot 정확도 limited
    else:
        # OpenWeather One Call History
        result = openweather_time_machine(lat, lng, timestamp)
        confidence = 0.6  # global model 정확도 lower

    if result is None:
        return None, 0.0

    twd_estimate = result.wind_direction
    # 시간차 (세션 시작 vs API 시점) 가 30분 초과 시 confidence 감소
    time_diff_minutes = abs((timestamp - result.api_timestamp).total_seconds() / 60)
    time_penalty = max(0.4, 1.0 - time_diff_minutes / 120)
    return twd_estimate, confidence * time_penalty
```

**한계:**
- 1.5km 해상도 = 해안 micro-mesoscale (송정 vs 시화호 차이) 잡지 못함
- Time-machine API 가 historical 시점 정확도 inconsistent

### §7.6 Bayesian weighted combination

**Spec:**

```python
def combine_4_channels(
    channel_outputs: dict[str, tuple[float, float]]
) -> dict:
    """
    Args:
        channel_outputs: {
            'A': (twd_a, conf_a),
            'B': (twd_b, conf_b),
            'C': (twd_c, conf_c),
            'D': (twd_d, conf_d),
        }
    Returns:
        {
            'twd': float,
            'confidence': 'high' / 'medium' / 'low',
            'channels': dict,
            'reasoning_kr': str
        }
    """
    valid_channels = {k: v for k, v in channel_outputs.items() if v[0] is not None}

    if len(valid_channels) == 0:
        return {
            'twd': None,
            'confidence': 'unknown',
            'reasoning_kr': "모든 채널 추정 실패. 수동 풍향 입력 권장."
        }

    estimates = [v[0] for v in valid_channels.values()]
    weights = [v[1] for v in valid_channels.values()]

    # Circular weighted mean
    twd_final = circular_weighted_mean(estimates, weights)

    # Variance (channel agreement)
    variance = circular_weighted_variance(estimates, weights, twd_final)

    # Confidence categorize
    if variance < 10:  # 채널 일치 < 10°
        confidence = 'high'
    elif variance < 30:
        confidence = 'medium'
    else:
        confidence = 'low'

    # Korean reasoning (LLM 호출 또는 template)
    reasoning_kr = generate_korean_reasoning(valid_channels, twd_final, variance, confidence)

    return {
        'twd': twd_final,
        'confidence': confidence,
        'variance_degrees': variance,
        'channels': {k: {'twd': v[0], 'weight': v[1]} for k, v in valid_channels.items()},
        'reasoning_kr': reasoning_kr
    }


def generate_korean_reasoning(channels: dict, twd: float, variance: float, conf: str) -> str:
    """한국어 자연어 reasoning. Phase 1 = template, Phase 2 = LLM."""
    if conf == 'high':
        channel_names = ", ".join(channels.keys())
        return f"{len(channels)} 채널 ({channel_names}) 모두 풍향 {twd:.0f}° 부근으로 일치. 매우 신뢰 가능."

    elif conf == 'medium':
        # 어느 채널이 어긋났나
        max_dev_channel = max(channels.items(), key=lambda x: abs(circular_difference(x[1][0], twd)))
        return (
            f"{len(channels)} 채널 중 {max_dev_channel[0]} 채널 ({max_dev_channel[1][0]:.0f}°) 이 평균 ({twd:.0f}°) 에서 다소 어긋남. "
            f"라이더 body lean 이 wind shift 를 잡았을 가능성. 풍향 신뢰도 보통."
        )

    else:  # low
        return (
            f"채널 disagreement 큼 (variance {variance:.0f}°). "
            f"리칭 위주 세션이라 회전이 부족할 가능성. "
            f"외부 weather ({channels.get('D', (None, 0))[0]:.0f}°) 를 1차 채택 권고. "
            f"사용자 1회 캡처 추가 시 정확도 상향 가능."
        )
```

### §7.7 알고리즘 validation 프로토콜

**In-water 카메라 비교 (Phase 1 MVP validation):**

```
Setup:
- 시화호 / 송정 / 다대포 spot 50 세션
- 라이더 + Apple Watch + iPhone
- 1m anemometer (Calypso Ultrasonic Portable) on shore 또는 boat-mounted
- GoPro Hero on boat with GPS GPMF
- 라이더 1회 lineup capture + 세션 진행

Measurements per session:
1. Anemometer ground truth TWD (1Hz, 1 min averaged)
2. SailTechCo 4-channel TWD estimate (per channel + combined)
3. MAE (mean absolute error) = |truth - estimate|

Acceptance criteria (Phase 1 Q4 2026):
- 2-channel (A+D) MAE < 15°
- 3-channel (A+B+D) MAE < 10° (Q2 2027 v1)
- 4-channel full MAE < 5° (Q4 2027 v3)

Comparison baselines:
- Vakaros Atlas 2 (raceer 1회 캡처) → 사용자 보고 MAE ±15°
- Waterspeed (GPS only) → windfoil 라벨 역전 사례
- Njord (multi-boat) → 솔로 적용 불가
```

---

## §8. 결론 — 알고리즘 공개 가 W4 wedge 가 되는 이유

### §8.1 Top 10 알고리즘 공개 수준 인벤토리

| 제품 | 공개 수준 | 출처 |
|---|---|---|
| **SAP Sailing Analytics** | ✅ 코드 전체 (Apache 2.0) | GitHub |
| Velocitek | ✅ 파일 포맷만 (.vtk Protocol Buffer) | GitHub |
| Expedition | 🟡 PDF Manual 1900+ 페이지 (calibration / routing 수치 일부) | 공식 PDF |
| Deckman | 🟡 B&G Blog Mark Chisnell RacePanel 5부 | 공식 blog |
| ChartedSails | 🟡 Sailing Data Course 11장 (algorithm 명명) | 공식 blog |
| Garmin Tack Assist | 🟡 manual verbatim 산술 평균 | 공식 manual |
| Njord | ❌ 메서드 명명, 수식 0건 | 공식 User Guide |
| Vakaros | ❌ 메서드 명명, 수식 0건 | 공식 blog |
| Vantage | ❌ 메서드 명명, ML black-box | 공식 technology 페이지 |
| Waterspeed | ❌ 메서드 명명, 수식 0건 | 공식 blog |

→ **SAP 만이 코드 수준 공개**. *모바일 윙포일 시장의 분석 알고리즘 자체 공개는 zero*.

### §8.2 SailTechCo 의 알고리즘 공개 — 전략적 의미

**5 가지 효과:**

1. **First-mover lock-in**: SailTechCo 가 *지금* 공개 시작 시 향후 5년+ "the open methodology sailing analytics company" brand positioning.
2. **경쟁사 추격 불가**: Njord (14년 IP) / Vakaros (8년) / Vantage / Waterspeed 가 공개 시 가격 정당화 불가 → 영원히 first-mover 안 됨.
3. **학술 신뢰**: PhD 검수 + 학술 publish + GitHub repo = sailing science 학회 (KSSS) + 윙포일 코치 + 투자자 의 reference asset.
4. **개발자 채용**: Open source = 기술 인재 attraction.
5. **PMF 가속**: 코드 공개 → external contribution + bug report → algorithm improvement velocity 가속.

**리스크:**
- SAP 처럼 enterprise scope 면 *경쟁자에게 무료 reference* 위험 — 하지만 SailTechCo 의 *한국어 + 윙포일 + 자연어 코칭* trio 는 *알고리즘 카피 가 아니라 product carrier 가 차별화* — 그 모델은 알고리즘 공개의 risk 낮음.
- 학술 publish 의 peer review 시간 (6-12 개월) — Phase 4 v3 일정 위험.

### §8.3 SailTechCo 의 6-axis algorithm depth 위치

```
                      Algorithm depth
                            ▲
                            │
            SAP ●●●●●●●●●●  │ (코드 공개, 모든 axis ≥ 🟡)
                            │
            Njord ●●●●●●●   │
            Expedition ●●●●●│
            Deckman ●●●●●●  │
            Vakaros ●●●     │
            ChartedSails ●●●│
            Vantage ●●●●    │
            Waterspeed ●●   │
            Garmin ●        │
            Velocitek (외부)│
        ────────────────────┼─────────────────────► Openness
                            │                      (closed → open)
            SailTechCo ●●●●●● ★ (모든 axis ≥ 🟡 + 코드 공개 + 한국어 + 윙포일 특화)
                            │
                            ▼
```

→ **SailTechCo 의 위치 = Openness 축에서 SAP 와 동등, Algorithm depth 축에서 Njord/Expedition/Deckman 의 6-7 axis 수준, 그러나 윙포일 + 한국어 + 자연어 코칭 의 특화 dimensions 추가**.

### §8.4 다음 단계 (§5 → §3 → MVP)

본 §4 algorithm depth comparison 은 SailTechCo W3 (4-channel wind) 의 학술적 backbone. 다음 우선순위:

- **§5 UX 인사이트**: W5 (자연어 코칭) + W1 (한국어 UI) 의 모범 사례 — Vakaros opt-in training mode + Surfline Live/Forecast 2-탭 + Njord dual-output i-tooltip + .vtk Protocol Buffer pattern.
- **§3 매트릭스**: 35 제품 × 50+ feature 의 reference table. CSV·xlsx 형식.
- **Phase 1 MVP sprint plan**: 위 셋의 합 → 12 주 (Q3 2026) implementation backlog.

---

## §9. 출처 인덱스

본 §4 algorithm depth comparison 의 모든 알고리즘 claim 출처:

**SAP (코드 직접):**
- [github.com/SAP/sailing-analytics](https://github.com/SAP/sailing-analytics)
- 핵심 파일: ManeuverBasedWindEstimationComponentImpl.java, ManeuverSequenceGraph.java, IntersectedWindRangeBasedTransitionProbabilitiesCalculator.java, ManeuverForEstimationTransformer.java, ManeuverDetectorImpl.java, ORCPerformanceCurveRankingMetric.java, ScoringSchemeType.java, IncrementalLeastSquares.java

**Njord:**
- [Adding Wind Data — User Guide](https://app.sailnjord.com/help/analytics/adding-wind-data.html)
- [Maneuvers — User Guide](https://app.sailnjord.com/help/analytics/maneuvers.html)
- [Polar Diagram visualization](https://app.sailnjord.com/help/analytics/visualizations/polar-diagram.html)
- [FAQ](https://app.sailnjord.com/help/analytics/faq.html)
- [Njord Player](https://www.sailnjord.com/player/) + [Loading Media](https://app.sailnjord.com/help/player/loading-media.html)

**Vakaros:**
- [blog.vakaros.com/vmgtackloss](https://blog.vakaros.com/vmgtackloss)
- [Atlas 2 product](https://www.vakaros.com/products/atlas-2)

**Vantage:**
- [vantage-sailing.com/technology](https://vantage-sailing.com/technology)
- [vantage-sailing.com/about](https://www.vantage-sailing.com/about)

**Expedition:**
- [Expedition.pdf Manual](https://www.expeditionmarine.com/downloads/documents/Expedition.pdf) (calibration p.1899-2010, routing p.1378-1471, tack analysis p.1015-1017)
- [version_history](https://www.expeditionmarine.com/version_history)

**Deckman:**
- [B&G Deckman](https://www.bandg.com/en-gb/deckman/)
- [Part 3 — Dr. Winn lineage](https://www.bandg.com/en-gb/blog/racing/americas-cup/a-short-history-of-sailing-instruments---part-3/)
- [RacePanel 5 부](https://www.bandg.com/blog/racepanel-1/) (Part 2 Start Line, Part 3 WindPlot, Part 4 What If, Part 5 SailSteer)

**ChartedSails:**
- [Sailing Data Course 11장](https://www.chartedsails.com/sailing-data-course/)
- [Velocitek ProStart guide](https://www.chartedsails.com/blog/sailing-with-a-velocitek-prostart)

**Garmin:**
- [Quatix 7 manual — Tack Assist](https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/EN-US/GUID-4BE4156E-A466-46F7-AEEA-F17EBFC109C0.html)
- [Sail Racing manual](https://www8.garmin.com/manuals-apac/webhelp/quatix7series/EN-SG/GUID-C361E0E1-7614-4720-A3B6-194CB3C4E92F-9180.html)

**Waterspeed:**
- [blog/how-to-track-tacks-and-gybes](https://www.waterspeedapp.com/blog/how-to-track-tacks-and-gybes-in-waterspeed)
- [blog/waterspeed-ultra](https://www.waterspeedapp.com/blog/waterspeed-ultra)

**Velocitek:**
- [github.com/velocitek/vtk_protocol](https://github.com/velocitek/vtk_protocol) (vtk.proto schema)
- [velocitek.com/blogs/news/vtk-files](https://www.velocitek.com/blogs/news/vtk-files)

**SailTechCo 자산:**
- `회전코칭_AI_엔진_설계안_v1_2026-05-22.md` (옥코치 R1-R9 룰엔진)
- `Njord_Analytics_벤치마크_갭분석_2026-05-22.md` (Njord 심층)
- `sailing_analytics_landscape_audit.md` 의 §A1-Deep / §A2-Deep / §A3-Deep / §A4-Deep / §B1-Deep / §B2-Deep / §B8-Deep / §B9 / §C4-Deep / §D1-Deep

---

_§4 algorithm depth comparison 완료. 다음: §5 UX 인사이트._
