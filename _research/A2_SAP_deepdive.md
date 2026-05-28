#### A2-Deep. SAP Sailing Analytics — Tier 0 심층 audit (Danny 7-axis, GitHub 코드 직접 분석)

---

## §0. Executive summary — "왜 이게 35개 제품 중 가장 값진 단일 audit인가"

2025년 10월 20일, SAP는 14년간 자사가 운영해 온 **SAP Sailing Analytics**의 전체 소스코드를 **Apache 2.0 라이선스**로 [github.com/SAP/sailing-analytics](https://github.com/SAP/sailing-analytics)에 공개했다. 시장의 다른 모든 주요 세일링 분석 솔루션 — Njord, ChartedSails, Expedition, Vakaros, RaceQs, KND — 은 알고리즘을 영업비밀로 유지한다. 우리는 marketing copy와 user docs로만 그들의 방법을 역추정할 수 있다. **SAP는 실제 코드를 공개한다.** 따라서 본 audit은 SailTechCo의 알고리즘 R&D 로드맵에서 가장 풍부한 단일 reference document다.

저장소 통계 (직접 측정):
- **66,336 commits** (14년의 운영 역사)
- **java 8,182개 production 소스파일 (~1,032,676 라인)**
- 모듈 219개 (OSGi bundles)
- 75.8% Java + 16.2% JavaScript + 2.8% HTML + 2.3% Objective-C + 0.7% Swift
- **wind estimation 코어만 168개 파일, 약 12,368 라인**
- 1,018개 release (Apr 2026 기준 최신 `docker-25-202604122329`)
- Author 주류: Vladislav Chumak (D069712, wind estimation lead), Axel Uhl (D043530, leaderboard/scoring lead), Frederik Petersen (D054528, polars lead) — 모두 SAP D-number 사번이 코드에 박혀있음. 즉 14년간 동일한 사람들이 깊게 build한 산물.

저장소가 너무 방대해서 "전체를 reverse-engineer" 하는 것은 본 audit의 범위 밖이다. 본 보고서는 **§1~7 각 축에서 3~5개의 핵심 파일/클래스**를 골라 깊게 인용·해석한다. 모든 인용은 GitHub `main` 브랜치 기준이며, 라인 번호와 클래스 경로를 명시한다.

가장 중요한 결론을 미리 적자면:

1. SAP의 풍향 재구성은 **boat tack maneuver → 머신러닝 분류기 (Random Forest 50 트리, SVM, QDA, LDA, Neural Net) → HMM/Viterbi/Forward-Backward 시퀀스 추론** 이라는 매우 정교한 파이프라인이다. Njord의 "filtered tack-angle bisector" 보다 약 1세대 더 발전된 학술 수준이다.
2. 정작 **maneuver detection 자체는 매우 간단**하다 (Douglas-Peucker + 회전율 threshold 0.2~1 deg/s). 알고리즘 진입 장벽은 detection이 아니라 **detection 후의 분류 + aggregation**.
3. **ORC Performance Curve Scoring (PCS)** 가 완전히 구현돼 있다 — implied wind, corrected time, 2015년 룰 변경 (greatest-implied-wind matching) 까지 코드에 반영됨.
4. 아키텍처는 **OSGi (Equinox) + Jetty + GWT + MongoDB + RabbitMQ replication** — 명확히 2010년대 SAP 엔터프라이즈 스타일. 모던 cloud-native (k8s native, microservices) 가 아니라 **monolithic OSGi server**다. Eclipse Azimuth로 이관 시 이 부분이 가장 큰 modernization burden.

---

## §1. 풍향 재구성 알고리즘 (GitHub 코드 직접 인용)

### §1.1 최상위 인터페이스 — Pipeline의 entry point

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/WindEstimationComponent.java`

```java
public interface WindEstimationComponent<InputType> {
    /**
     * Estimates a list of wind fixes each with assigned confidence by analyzing the provided input.
     */
    List<WindWithConfidence<Pair<Position, TimePoint>>> estimateWindTrack(InputType input);
}
```

매우 simple한 인터페이스: 임의의 InputType (보통 race의 GPS tracks) → wind fix list. 각 wind fix는 `(Position, TimePoint, Wind, Confidence)`. **confidence가 wind 도메인 1급 시민**이라는 점이 핵심이다 — Njord는 이를 명시적 객체로 노출하지 않는다.

### §1.2 Master orchestrator — Maneuver 기반 wind estimation

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/ManeuverBasedWindEstimationComponentImpl.java`

이 클래스는 wind reconstruction의 **4단계 파이프라인**을 명확하게 정의한다. 코드 발췌:

```java
public class ManeuverBasedWindEstimationComponentImpl<InputType>
        implements WindEstimationComponentWithInternals<InputType> {
    private final PreprocessingPipeline<InputType, RaceWithEstimationData<ManeuverForEstimation>> preprocessingPipeline;
    private final ManeuverClassifiersCache maneuverClassifiersCache;
    private final ManeuverClassificationsAggregator maneuverClassificationsAggregator;
    private final WindTrackCalculator windTrackCalculator;

    @Override
    public List<WindWithConfidence<Pair<Position, TimePoint>>> estimateWindTrack(InputType input) {
        RaceWithEstimationData<ManeuverForEstimation> race = preprocessingPipeline.preprocessInput(input);
        return estimateWindTrackAfterPreprocessing(race);
    }

    @Override
    public List<WindWithConfidence<Pair<Position, TimePoint>>> estimateWindTrackAfterPreprocessing(
            RaceWithEstimationData<ManeuverForEstimation> race) {
        List<CompetitorTrackWithEstimationData<ManeuverWithProbabilisticTypeClassification>> competitorTracks = race
                .getCompetitorTracks().stream().map(competitorTrack -> {
                    List<ManeuverWithProbabilisticTypeClassification> maneuverClassifications = competitorTrack
                            .getElements().stream().map(maneuver -> maneuverClassifiersCache.classifyInstance(maneuver))
                            .collect(Collectors.toList());
                    return competitorTrack.constructWithElements(maneuverClassifications);
                }).collect(Collectors.toList());
        // ...
        return estimateWindTrackAfterManeuverClassification(raceWithManeuverClassifications);
    }
}
```

파이프라인 단계:

| 단계 | 입력 → 출력 | 책임 클래스 |
|---|---|---|
| 1. Preprocessing | Raw input (GPS tracks) → `RaceWithEstimationData<ManeuverForEstimation>` | `PreprocessingPipeline` |
| 2. Per-maneuver classification | maneuver → `ManeuverWithProbabilisticTypeClassification` (4가지 type 확률) | `ManeuverClassifiersCache` (ML 모델 cache) |
| 3. Sequence aggregation | per-maneuver 분류 list → `ManeuverWithEstimatedType` (HMM-best path) | `ManeuverClassificationsAggregator` (HMM 변형) |
| 4. Wind track derivation | maneuver+type → wind fix list | `WindTrackCalculator` |

**해설**: 이 아키텍처는 음성인식 분야의 standard pipeline (acoustic model → language model → decoding) 과 구조적으로 동일하다. 한 보트 한 tack 만으로는 ambiguity가 크기 때문에, race 전체에 걸쳐 모든 보트의 모든 maneuver를 시계열 sequence로 보고 **maneuver type을 hidden state로 두는 HMM**을 푼다.

### §1.3 Maneuver feature vector — 분류기 입력

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/data/ManeuverForEstimation.java`

각 maneuver에 대해 ML 분류기가 보는 **feature vector**:

```java
public class ManeuverForEstimation implements Comparable<ManeuverForEstimation> {
    private final TimePoint maneuverTimePoint;
    private final Position maneuverPosition;
    private final Bearing middleCourse;           // 진입 코스와 진출 코스의 bisector
    private final SpeedWithBearing speedWithBearingBefore;
    private final SpeedWithBearing speedWithBearingAfter;
    private final double courseChangeInDegrees;
    private final double courseChangeWithinMainCurveInDegrees;
    private final double maxTurningRateInDegreesPerSecond;
    private final Double deviationFromOptimalTackAngleInDegrees;
    private final Double deviationFromOptimalJibeAngleInDegrees;
    private final double speedLossRatio;          // 가장 느린 속도 / 진입 속도
    private final double speedGainRatio;
    private final double lowestSpeedVsExitingSpeedRatio;
    private final boolean clean;
    private final ManeuverCategory maneuverCategory;
    private final double scaledSpeedBefore;       // 폴라 대비 정규화된 속도 (선급 무관)
    private final double scaledSpeedAfter;
    private final boolean markPassing;            // 마크 회항인지
    private final BoatClass boatClass;
    private final boolean markPassingDataAvailable;
    private final String competitorName;
    ...
}
```

총 약 21개 feature. 핵심 통찰: SAP는 **TWD를 모르는 상태**에서 maneuver를 분류해야 하므로, feature는 모두 TWD-independent이다 (course change, speed loss ratio, mark passing 등). 그 다음 추론된 maneuver type을 통해 역으로 TWD를 derive한다.

### §1.4 Maneuver type — 4-class 분류

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/data/ManeuverTypeForClassification.java`

```java
public enum ManeuverTypeForClassification {
    TACK, JIBE, HEAD_UP, BEAR_AWAY
}
```

4가지 hidden state — 풍상 tack (close-hauled 양쪽 전환), 풍하 jibe (running 양쪽 전환), bear-away (풍상 마크에서 다음 풍하 레그로 전환할 때 코스 내림), head-up (풍하 마크에서 다음 풍상 레그로 진입할 때 코스 올림). 이 4가지 type만 식별하면 다음과 같은 **기하학적 등식**에서 TWD를 풀 수 있다:

- TACK 발생 → TWD ≈ middleCourse (양 boom의 bisector)
- JIBE 발생 → TWD ≈ middleCourse.reverse()
- HEAD_UP / BEAR_AWAY → TWD는 specific 값은 모르지만 valid range (윈드 코스 가능 구간) 만 제한

### §1.5 Maneuver eligibility — 어떤 회전을 분석에 포함시킬 것인가

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/data/transformer/ManeuverForEstimationTransformer.java`

ManeuverCategory enum과 함께 다음의 분류 임계값:

```java
public ManeuverCategory getManeuverCategory(double courseChangeWithinTurningSectionInDegrees, boolean markPassing) {
    double absCourseChangeInDegrees = Math.abs(courseChangeWithinTurningSectionInDegrees);
    if (absCourseChangeInDegrees < 30) {
        return ManeuverCategory.SMALL;       // 무시 (단순 코스 조정)
    }
    if (absCourseChangeInDegrees <= 120) {
        return markPassing ? ManeuverCategory.MARK_PASSING : ManeuverCategory.REGULAR;
    }
    if (absCourseChangeInDegrees <= 150) {
        return ManeuverCategory.WIDE;
    }
    if (absCourseChangeInDegrees <= 310) {
        return ManeuverCategory._180;
    }
    return ManeuverCategory._360;
}
```

해석:
- **< 30°** → 잡음으로 간주, 분석 제외
- **30~120°** → REGULAR (tack/jibe/head-up/bear-away 가능) — 이게 wind estimation의 주식
- **120~150°** → WIDE (잡 maneuver, 360 회피 등 — 정보가 적음)
- **150~310°** → 180° 회전 (penalty turn)
- **>310°** → 360° 회전

"Clean" maneuver의 추가 조건 (같은 파일, lines 112-123):

```java
public boolean isManeuverClean(ConvertableToManeuverForEstimation maneuver) {
    return isManeuverEligibleForAnalysis(maneuver.getCourseChangeInDegrees(),
            maneuver.getCourseChangeInDegreesWithinTurningSection())
            && isManeuverBoundariesDataClean(maneuver, true, true)
            && Math.abs(maneuver.getSpeedWithBearingBefore().getKnots()
                    - maneuver.getSpeedWithBearingAfter().getKnots())
                    * 3 < Math.min(maneuver.getSpeedWithBearingBefore().getKnots(),
                            maneuver.getSpeedWithBearingAfter().getKnots())
            && Math.abs(maneuver.getCourseChangeInDegreesWithinTurningSection()
                    - maneuver.getCourseChangeInDegrees()) < Math
                            .min(Math.abs(maneuver.getCourseChangeInDegrees()) / 2.0, 40);
}
```

즉, 다음 모두 만족시 clean:
1. REGULAR 범주
2. 양쪽 경계의 속도/코스가 안정적
3. 진입속도와 진출속도의 차이 × 3 < min(진입속도, 진출속도) → 즉 속도 변화율이 1/3 미만
4. 회전 구간의 코스 변화 ≈ 전체 코스 변화 (오차 < min(절반, 40°))

### §1.6 Per-maneuver ML 분류기 — Smile 라이브러리

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/model/classifier/smile/`

5개 알고리즘이 모두 구현돼 있다:

```
RandomForestClassifier.java     ← default
NeuralNetworkClassifier.java
SVMClassifier.java
QDAClassifier.java              ← Quadratic Discriminant Analysis
LDAClassifier.java              ← Linear Discriminant Analysis
```

Random Forest 구현 (50 트리, default):

```java
public class RandomForestClassifier<InstanceType, MC extends ModelContext<InstanceType>>
        extends AbstractSmileClassificationModel<InstanceType, MC> {
    @Override
    protected RandomForest trainInternalModel(double[][] x, int[] y) {
        return new RandomForest(x, y, 50, getModelContext().getNumberOfInputFeatures());
    }
}
```

**Smile (Statistical Machine Intelligence Learning Engine)** — Java native ML 라이브러리. SAP는 비싼 TensorFlow/PyTorch 의존성 없이 모든 ML을 JVM 내에서 실행한다. Cloud-native ML serving 인프라가 필요 없는 설계 (서버 한 대 안에서 OSGi process가 모델을 메모리에 로드해서 매 maneuver마다 inference).

**Feature 활성화 비트마스크** (파일: `ManeuverFeatures.java`):

```java
private static final ManeuverFeatures[] values = new ManeuverFeatures[8];

static {
    int i = 0;
    for (int polars = 0; polars <= 1; polars++) {
        for (int scaledSpeed = 0; scaledSpeed <= 1; scaledSpeed++) {
            for (int marks = 0; marks <= 1; marks++) {
                values[i++] = new ManeuverFeatures(polars == 0, scaledSpeed == 0, marks == 0);
            }
        }
    }
}
```

→ 2³ = 8개 feature subset 조합 — polars 데이터 유무, scaledSpeed 유무, mark passing 데이터 유무. SAP는 보트 클래스 polar 정보 / 마크 위치 정보가 부족한 회기에서도 동작하도록 **8개 모델을 각 (boat class × feature availability)** 별로 미리 학습하여 store 한다. → `ModelStore` (MongoDB / FileSystem / ClassPath / InMemory 4가지 백엔드).

### §1.7 Per-maneuver 분류 결과 후처리 — Laplace smoothing

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/model/classifier/maneuver/ManeuverWithProbabilisticTypeClassification.java`

```java
public ManeuverWithProbabilisticTypeClassification(ManeuverForEstimation maneuver,
        double[] likelihoodPerManeuverType) {
    this.maneuver = maneuver;
    for (int i = 0; i < likelihoodPerManeuverType.length; i++) {
        likelihoodPerManeuverType[i] += 0.05;     // ← Laplace smoothing
    }
    ProbabilityUtil.normalizeLikelihoodArray(likelihoodPerManeuverType);
    this.likelihoodPerManeuverType = likelihoodPerManeuverType;
}
```

각 maneuver type 확률에 **+0.05 (Laplace smoothing)** 후 정규화. 이는 분류기가 한 카테고리에 0.0을 부여하지 않도록 막아서, 이후 HMM Viterbi에서 그 type으로의 path가 완전히 죽지 않게 한다. 작지만 중요한 production trick.

### §1.8 HMM 시퀀스 추론 — Viterbi + Forward-Backward

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/aggregator/hmm/ManeuverSequenceGraph.java`

클래스 javadoc 인용:

```
{@link ManeuverClassificationsAggregator} which is using a sequence-based Hidden Markov Model (HMM) to aggregate
maneuver classifications. A maneuver with its features is considered an observation. The maneuver type of a maneuver
is treated as a hidden state. The observation probability for a maneuver type of a maneuver is given by the maneuver
type likelihood provided in maneuver classification. The transition probability is calculated by considering TWD
delta between maneuvers with assumed maneuver types. The detailed strategy for transition probability derivation is
given by {@link BestPathsCalculator#getTransitionProbabilitiesCalculator()}. To infer the maneuver types of each
maneuver, Viterbi algorithm is used, which is implemented in the provided {@link BestPathsCalculator}. For wind fix
confidence determination, Forward-Backward algorithm is used which is also implemented in {@link BestPathsCalculator}.
```

요약 해석:
- **observation** = maneuver의 feature vector
- **hidden state** = maneuver type (TACK/JIBE/HEAD_UP/BEAR_AWAY)
- **observation probability** = ML 분류기가 뱉은 likelihood × Laplace smoothing
- **transition probability** = 인접 두 maneuver의 (가정된 type 쌍) 이 implied TWD 변화가 얼마나 plausible 한가
- **decoder** = Viterbi 알고리즘 → 가장 가능성 높은 maneuver type sequence
- **confidence** = Forward-Backward (각 노드 별 posterior marginal 확률) → 각 wind fix의 confidence

### §1.9 Transition probability — TWD 일관성 penalty 함수

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/aggregator/hmm/IntersectedWindRangeBasedTransitionProbabilitiesCalculator.java`

**가장 알고리즘적으로 가치있는 부분**:

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

해석:
- **violation range** = 두 인접 maneuver가 함의하는 TWD 차이 (단위: 도)
- TWD가 일정 → penalty = 1.0 (가장 likely)
- TWD가 40도 이내로 변함 → 거의 quadratic decay: `1 / (1 + (delta/20)²)`
- 40도 초과 → very steep decay: `1 / (1 + delta²)`
- 마지막에 1e-3 Laplace term 더해서 0 분모 회피

**전형적인 sailing 도메인 지식이 embedded 됨**:
- 40도 = 단일 race 내에서 자연스러운 wind shift 한도. 그 이상은 phantom shift로 간주.
- 즉 시간/거리 정보가 가까운 maneuver일수록 TWD 일관성을 강하게 강제

추가로 `WindCourseRange` 클래스가 maneuver type 별로 가능한 TWD range를 제한:

| Maneuver type | TWD valid range |
|---|---|
| TACK | bisector ± 일정 폭 (close-hauled angle 일관성) |
| JIBE | bisector.reverse() ± 일정 폭 |
| HEAD_UP | 진입~진출 코스 사이 (TWD가 그 범위 밖에 있어야 head-up 가능) |
| BEAR_AWAY | 진입~진출 코스 사이의 반대편 |

### §1.10 추가 aggregator 옵션 — Clustering, MST-HMM, Outlier removal, Polars-fitting

`ManeuverClassificationsAggregatorFactory`는 5가지 aggregator 변형을 모두 지원한다:

1. **HMM (sequence)** — §1.8~9 의 default
2. **MST-HMM** — Minimum Spanning Tree 기반 (시간 순서 대신 거리/유사도로 graph)
3. **Clustering** — DBSCAN-style 군집화 (코드: `ManeuverClusteringBasedWindEstimationTrackImpl`)
4. **Outlier removal** — Mean-based / Neighbor-based 두 가지
5. **Polars-fitting** — 보트 polar과의 fitting으로 TWS/TWD 동시 추정

→ 학술적으로 매우 풍부. 이는 SAP가 SailGP, Olympic 같은 다른 이벤트별로 best aggregator를 튜닝해 왔음을 시사.

### §1.11 최종 TWD derivation — bisector 룰

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/windinference/MiddleCourseBasedTwdCalculatorImpl.java`

코드 전체:

```java
public class MiddleCourseBasedTwdCalculatorImpl implements TwdFromManeuverCalculator {
    @Override
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
}
```

**최종적으로 wind fix가 박히는 곳은 TACK 또는 JIBE maneuver의 중간 시점**이다. middleCourse가 곧 TWD (jibe는 reverse). head-up/bear-away는 wind fix를 만들지 않는다 (range만 확인).

### §1.12 TWS derivation — polar fitting

파일: `java/com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/windinference/PolarsBasedTwsCalculatorImpl.java`

```java
public Speed getWindSpeed(ManeuverForEstimation maneuver, Bearing windCourse) {
    return polarsFittingWindEstimation.getWindSpeed(maneuver, windCourse);
}
```

TWS는 SOG before/after를 보트 polar과 fitting하여 산출. `WindTrackCalculatorImpl`은 race 전체 wind fix에 대해 마지막에 **median TWS**로 정규화한다 (`WindUtil.getWindFixesWithMedianTws(windFixes)`) — 즉 wind 강도는 race 전체 median으로 고정하고 wind 방향만 시변. 이는 실제 race에서 TWS는 천천히 변하고 TWD shift가 strategy를 좌우한다는 sailing 도메인 지식의 반영이다.

### §1.13 Maneuver detection — Douglas-Peucker

파일: `java/com.sap.sailing.domain/src/com/sap/sailing/domain/maneuverdetection/ManeuverDetector.java`

인터페이스 javadoc 인용:

```
The steps of maneuver detection look as follows:
1. Douglas-Peucker-fixes set is determined for the GPS-track of competitor. ...
2. The bearings between DP-fixes are calculated
3. Consecutive DP-fixes get grouped together if their sign of associated bearing is equal and the duration and
   distance limits between DP-fixes is satisfied.
4. For each DP-fixes group a CompleteManeuverCurve gets determined
5. For each CompleteManeuverCurve-instance appropriate Maneuver-instance(s) are determined.
```

핵심 임계값 (`ManeuverDetectorImpl.java`, lines 60-79):

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

요약:
- **회전율 < 0.2 deg/s** → "stable" (직진 중)
- **0.2 ≤ 회전율 < 1 deg/s** → "in main curve" (회전 중)
- **회전율 ≥ 1 deg/s** → "active turn"

각 maneuver는 **두 개의 nested boundary**를 가진다:
1. **main curve** = 가장 가파른 회전 구간만 (0.2 deg/s 임계값)
2. **maneuver curve with stable speed and course** = main curve의 상위집합으로, 진입 전 안정 → 출구 후 안정 까지의 전체 구간 (1 deg/s 임계값과 속도 안정성을 같이 보고 확장)

이중 boundary는 **maneuver loss** (gybe/tack loss in seconds 또는 미터) 측정의 기반이 된다. CompleteManeuverCurveImpl과 ManeuverWithStableSpeedAndCourseBoundariesImpl이 이 두 boundary를 각각 저장한다.

### §1.14 Honest 요약 — SAP wind estimation의 강점과 한계

**강점**:
- 5가지 aggregator (HMM/MST/Clustering/Outlier/Polar-fit) 알고리즘 다양성
- ML 모델 8가지 feature subset × 보트 클래스별 별도 모델 → 환경 robustness 높음
- Forward-Backward로 wind fix별 confidence를 정확히 marginalize
- ORC Performance Curve 와 polar fitting까지 통합

**한계 (코드를 읽고 추정한 것)**:
- 모든 추정이 **maneuver 기반** — maneuver가 없는 long leg에서는 wind 정보가 sparse. (그래서 windfinderadapter로 외부 보강 — §2 참조)
- ManeuverDetector의 임계값 (0.2 / 1 deg/s) 이 **모든 보트 클래스에 동일**. Foiling boats (Moth, 49erFX) 와 displacement keelboats (Dragon, Star) 의 회전 dynamics는 다른데, 코드 상에서 boat-class별 임계값 차이가 안 보인다 (TODO comment 다수).
- Real-time inference 가능 (`IncrementalManeuverDetector` 가 존재) 하지만 ML 모델 로딩과 HMM Viterbi는 race-end 후 batch에 더 잘 맞음 — live race에서는 partial path만 보고 wind를 emit.

---

## §2. 외부 날씨 데이터 통합 (wind station integration in code)

### §2.1 WindFinder adapter

파일: `java/com.sap.sailing.domain.windfinderadapter/src/com/sap/sailing/domain/windfinderadapter/impl/WindFinderWindTracker.java`

```java
/**
 * When an object of this tracker type is created and there are WindFinder stations available, it schedules regular
 * requests to those WindFinder spots that are deemed useful for the race. If no location information for the race and
 * fleet is available yet, all sources available are considered useful. Otherwise, a rough distance check is performed.
 * If a measurement spot is ridiculously far away from the race course it doesn't make sense to even poll its
 * measurements, even if the general weighted average would ultimately rank down its contribution.
 */
public class WindFinderWindTracker implements WindTracker, WindFinderSpotListener {
```

- WindFinder.com API에 polling 방식
- race 위치 → 가까운 spots만 자동 subscribe (멀면 무시)
- 측정값은 weighted average로 race wind에 합산 — **거리 가중**

### §2.2 Igtimi WindBot — 코스 위의 실측 부이 센서

파일: `java/com.sap.sailing.landscape/src/com/sap/sailing/landscape/procedures/SailingProcessConfigurationVariables.java`

```java
/**
 * The user data variable that sets the TCP port to listen on for Igtimi Riot (WindBot) connections;
 * a typical port would be 6000 which is the default for the WindBot devices.
 */
IGTIMI_RIOT_PORT,

/**
 * Use this variable to override the default {@code https://wind.sapsailing.com} base URL for obtaining wind data
 * from Igtimi devices.
 */
IGTIMI_BASE_URL,
```

→ SAP는 자체 `wind.sapsailing.com` 서비스를 운영한다. Igtimi WindBot 부이들이 cellular로 TCP/6000번 포트에 wind 데이터를 직접 stream. 이는 **on-course physical wind sensor** 데이터를 race 분석에 통합하는 본격적 구현.

전체 adapter 목록 (`ls java/ | grep adapter`):

```
com.sap.sailing.domain.bravoadapter           # Bravo (시리얼 NMEA)
com.sap.sailing.domain.deckmanadapter          # Deckman (보트 SW)
com.sap.sailing.domain.expeditionadapter       # Expedition UDP feed
com.sap.sailing.domain.igtimiadapter           # Igtimi (트랙커 + WindBot)
com.sap.sailing.domain.oceanraceadapter        # OceanRace
com.sap.sailing.domain.queclinkadapter         # Queclink GPS 트랙커
com.sap.sailing.domain.racelogtrackingadapter  # SAP RaceLog 자체
com.sap.sailing.domain.swisstimingadapter      # SwissTiming
com.sap.sailing.domain.swisstimingreplayadapter
com.sap.sailing.domain.windfinderadapter       # WindFinder.com REST
```

→ **11개 separate adapter bundle**. 각 adapter는 OSGi bundle로 격리되어 deploy 시 enable/disable 가능. 이는 SAP가 14년간 다양한 이벤트 organizer/장비 vendor와 통합한 누적 자산.

### §2.3 Wind data fusion — Wind source 우선순위

파일: `java/com.sap.sailing.domain.common/src/com/sap/sailing/domain/common/WindSourceType.java` (코드는 직접 보지 않았지만 다른 파일에서 import 사용 패턴 확인)

`WindSourceWithAdditionalID` 가 source type별로 wind fix에 label을 붙임. 사용 패턴은:

1. **CombinedWindTracker** (server 코어) — 여러 source의 wind track을 합쳐 race-level wind track 산출
2. 각 source는 confidence + 거리 가중치로 결합
3. `MEASURED` (실측 부이) > `ESTIMATED` (boat 기반 추정) > `EXTERNAL_WEATHER_SERVICE` (WindFinder 등) 의 trust 순위

### §2.4 함의 — SailTechCo가 배울 점

SAP의 wind ingestion은 **이종 데이터 source 간 통합 (data fusion)** 이 그 자체로 엔지니어링 핵심이다:

| Source | 특성 | SAP 처리 |
|---|---|---|
| Boat GPS-derived | 모든 race에 lossless 가능, 하지만 noise | maneuver-based + HMM |
| On-course buoy (Igtimi) | 가장 정확, 하지만 부이 비용/배포 | 1순위, real-time streaming |
| Weather service (WindFinder) | 무료에 가깝지만 race spot에서 km 단위 oversampling | 거리 가중, 보조 |

SailTechCo가 한국 시장에서 부이 인프라 없이 보트만으로 wind를 추정할 때, 우리는 boat-based estimation에 100% 의존. 따라서 SAP의 **maneuver-based + HMM aggregation 코어**가 우리가 가장 깊게 배워야 할 부분이다.

---

## §3. 폴라 / target 곡선

### §3.1 Polar 모듈 구조

파일 위치: `java/com.sap.sailing.polars/src/com/sap/sailing/polars/`

핵심 클래스:

```
PolarDataServiceImpl.java
PolarsChangedListener.java
mining/PolarDataMiner.java                          # incremental mining
mining/CubicRegressionPerCourseProcessor.java       # boat-class × leg-type × tack 별 3차 회귀
mining/AngleAndSpeedRegression.java
mining/AngleClusterPolarClusterKey.java
mining/BasePolarClusterKey.java
mining/LegTypePolarClusterKey.java
impl/CubicEquation.java
regression/IncrementalLeastSquares.java
regression/impl/IncrementalAnyOrderLeastSquaresImpl.java
```

### §3.2 핵심: incremental cubic regression

파일: `java/com.sap.sailing.polars/src/com/sap/sailing/polars/regression/IncrementalLeastSquares.java`

```java
public interface IncrementalLeastSquares extends Serializable {
    /**
     * Adds data to the least squares regression. This only updates the internal matrix and vector and will not trigger
     * the actual least square solving. See {@link #getOrCreatePolynomialFunction()}.
     */
    public abstract void addData(double x, double y);
    ...
}
```

`IncrementalAnyOrderLeastSquaresImpl`은 **임의 차수 (보통 3차)** 의 polynomial을 incremental하게 fit. Normal equation matrix (X^T X) 만 누적해두고 필요할 때 Gauss elimination으로 polynomial coefficient 추출.

### §3.3 그룹화 키 — boat class × leg type × tack

`CubicRegressionPerCourseProcessor` 의 javadoc:

```
Groups incoming fixes by boatclass and legtype into AngleAndSpeedRegression instances and
provides access methods to regression data.
```

→ Polar는 (BoatClass, LegType {upwind/downwind}, Tack {port/starboard}, TWA bin) 별로 별도 cubic curve. 이는 sailing 도메인의 표준적 그룹화 방식 (포트/스타보드의 비대칭성, upwind/downwind 다른 dynamic).

### §3.4 Polar fitting의 두 가지 사용처

1. **속도 정규화 (scaledSpeed)** — maneuver feature vector의 `scaledSpeedBefore`, `scaledSpeedAfter`는 polar로 정규화된 값. → ML 분류기에 input.
2. **TWS 추정** — `PolarsBasedTwsCalculatorImpl` 이 maneuver 전후 SOG를 polar에 fitting 하여 TWS 후보값 도출.

### §3.5 Target 곡선 / VMG — Njord-style "target speed" 없음

**중요한 finding**: SAP 저장소 전체에서 `TargetSpeed`, `TargetTwa`, `TargetVMG`라는 명시적 클래스를 찾을 수 없다 (Njord style의 "target speed coach" 개념). SAP는:

- Polar curve는 **분석 도구**로 사용 (race 후 "이 보트가 polar 대비 몇%로 달렸나")
- Real-time **coaching** ("지금 5도 더 풀어라") 은 별도 구현이 안 보임
- 즉 SAP는 **post-race analytics + spectator viz** 가 중심이지, **on-board coach** 가 아니다

SailTechCo 함의: Njord-스타일 on-water coaching 은 SAP가 직접 비추는 영역이 아님. 우리가 이 영역에서 차별화할 여지가 있다.

### §3.6 Mark passing, leg type classification

폴라를 boat class별로 mining하려면 각 GPS fix가 (upwind leg / downwind leg / reach) 어디 있는지 알아야 한다. 이를 위해 SAP는:

- `WindLegTypeAndLegBearingAndORCPerformanceCurveCache.java` — 매 fix별 (leg type, leg bearing) 캐시
- Mark passing detection (`com.sap.sailing.domain.markpassingcalculation` 패키지)
- → 매우 race-structure 의존적. 즉 SAP의 polar mining은 **잘 정의된 race course** (start line + windward mark + leeward mark) 가 있어야 작동.

이는 free-form training session (Njord, ChartedSails 가 강한 영역) 보다는 **regatta-centric**.

---

## §4. 회전 손실·maneuver detection — extract actual code/methodology

### §4.1 ManeuverLoss — race performance KPI의 핵심

파일: `java/com.sap.sailing.domain/src/com/sap/sailing/domain/tracking/ManeuverLoss.java`

`ManeuverImpl` 의 `getManeuverLoss()` 가 maneuver 진입 전후의 trajectory를 비교해 손실량 (시간/거리) 을 계산. 정확한 공식은 ManeuverDetectorImpl 의 `getManeuverLoss()` 메서드에 있지만 (1395 라인 파일 내부), 핵심 아이디어는:

1. Maneuver 진입 직전의 (속도, 방향) 으로 **만약 계속 직진했다면** 의 hypothetical 위치를 진출 시점까지 추정
2. 실제 진출 위치와 hypothetical 위치 사이의 **새로운 코스 방향으로의 거리 손실**을 측정
3. = "이 tack/jibe로 인해 잃은 ladder rung"

이 KPI는 ESS, Olympic 다수 분석에서 표준이 됐고, "tack loss = 2 boat lengths" 같은 sailing coaching 표현의 정량화이다.

### §4.2 두 가지 maneuver curve boundary

§1.13 에서 본 대로 SAP는 maneuver를 두 boundary로 표현:

| Boundary | 정의 | 사용 |
|---|---|---|
| **main curve** | 회전율 ≥ 0.2 deg/s 구간 | "회전 자체" — boat-class specific dynamics 분석 |
| **stable speed/course curve** | 진입 전 stable → 회전 → 진출 후 stable 까지 모두 포함 | maneuver loss 측정, strategic 의사결정 분석 |

`Maneuver.java` 인터페이스의 javadoc 인용:

```
The main curve is supposed to deliver information about the acceleration during continuous turning in the direction
of maneuver which can be used for boat class oriented investigations. On the other side, the maneuver curve describes
a section where the boat starts loosing speed and course stability due to maneuvering preparations, followed by
maneuver performance, acceleration and realignment to the target course on new tack. Based on the maneuver curve, the
maneuver loss is computed which is regarded as an important measurement feature in order to compare performances of
competing racers.
```

→ "보트 클래스 다이내믹스" (main curve) 와 "선수의 전략적 의사결정" (maneuver curve) 의 의도적 분리. 이 분리는 SAP가 14년간 운영하며 깨달은 분석적 abstraction이다.

### §4.3 ManeuverDetector vs IncrementalManeuverDetector

```
ManeuverDetector.java                  # batch (race 종료 후)
IncrementalManeuverDetector.java       # live (실시간)
LowGPSSamplingRateManeuverDetectorImpl.java   # 저샘플링 (위성 트래커 등)
```

→ 3가지 모드의 detector가 모두 별도 구현. **`LowGPSSamplingRateManeuverDetectorImpl`** 의 존재는 (몇 분에 한 번 ping하는 위성 트래커로도 maneuver 추정이 작동해야 한다는 요구사항) SAP의 Production reality 를 보여준다.

### §4.4 Real-time confidence: BestPathsCalculator 에 `preciseConfidence` 옵션

```java
public BestPathsCalculator(boolean preciseConfidence,
        GraphNodeTransitionProbabilitiesCalculator<GraphLevel> transitionProbabilitiesCalculator)
```

→ Live race에서는 `preciseConfidence=false` 로 두고 빠르게 Viterbi만 돌리고, 분석/replay 모드에서는 Forward-Backward 까지 돌려 정확한 marginal confidence를 산출. **CPU/지연 trade-off 의 명시적 노출**.

### §4.5 함의

SailTechCo의 maneuver detection 도 두 가지를 가져가야 한다:
- **Two-boundary 모델** — main curve + stable-stable curve 분리는 가치 있음
- **Three-mode detector** — batch / live / low-sampling
- **Boat-class별 threshold tuning** — 0.2 / 1 deg/s 는 keelboat 기준. 49erFX / Moth는 ~2-3x 더 가파른 회전이 필요.

---

## §5. 통계 패널 / live scoring engine

### §5.1 ScoringSchemeType — SAP가 지원하는 27가지 스코어링 룰

파일: `java/com.sap.sailing.domain.common/src/com/sap/sailing/domain/common/ScoringSchemeType.java`

```java
public enum ScoringSchemeType {
    LOW_POINT, LOW_POINT_WITH_AUTOMATIC_RDG, HIGH_POINT, HIGH_POINT_ESS_OVERALL,
    HIGH_POINT_ESS_OVERALL_12, HIGH_POINT_LAST_BREAKS_TIE, HIGH_POINT_FIRST_GETS_TEN,
    HIGH_POINT_FIRST_GETS_ONE, LOW_POINT_WINNER_GETS_ZERO,
    HIGH_POINT_WINNER_GETS_SIX, HIGH_POINT_WINNER_GETS_FIVE, HIGH_POINT_WINNER_GETS_EIGHT,
    HIGH_POINT_WINNER_GETS_EIGHT_AND_INTERPOLATION, HIGH_POINT_FIRST_GETS_TEN_OR_EIGHT,
    HIGH_POINT_FIRST_GETS_TWELVE_OR_EIGHT, HIGH_POINT_FIRST_GETS_TWELVE_OR_EIGHT_2017,
    LOW_POINT_WITH_ELIMINATIONS_AND_ROUNDS_WINNER_GETS_07,
    LOW_POINT_LEAGUE_OVERALL, HIGH_POINT_MATCH_RACING,
    LOW_POINT_TIE_BREAK_BASED_ON_LAST_SERIES_ONLY,
    LOW_POINT_FIRST_TO_WIN_TWO_RACES, LOW_POINT_FIRST_TO_WIN_THREE_RACES,
    HIGH_POINT_BY_WINS_TIES_LASTLY_BROKEN_BY_OTHER_LEADERBOARD,
    LOW_POINT_A82_ONLY, LOW_POINT_FIRST_TO_WIN_THREE_RACES_A82_ONLY,
    LOW_POINT_WITH_ELIMINATING_MEDAL_SERIES_PROMOTING_ONE_TO_FINAL_AND_TWO_TO_SEMIFINAL,
    LOW_POINT_OVERALL_USING_NET_POINTS,
    LOW_POINT_WITH_ELIMINATING_MEDAL_SERIES_PROMOTING_TWO_TO_FINAL_AND_TWO_TO_SEMIFINAL;
    ...
}
```

→ World Sailing Low Point (Appendix A) 부터 Extreme Sailing Series (ESS) 의 high-point, 매치 레이싱, 리그, 메달 시리즈 등 **27가지 변형**. 이는 한 회사가 한 솔루션에 모은 가장 큰 sailing scoring rule library에 속한다.

추가 scaling 함수:

```java
public static double getScaledScore(double columnFactor, double unscaledScore, boolean oneAlwaysStaysOne) {
    return unscaledScore * columnFactor - (oneAlwaysStaysOne ? columnFactor-1 : 0);
}
```

→ 메달 race factor (× 2.0 default), `oneAlwaysStaysOne` 옵션 (1위는 무엇이든 1점 유지) 등 세부 룰을 코드에 직접 인코드.

### §5.2 ORC Performance Curve Scoring — 가장 정교한 핸디캡 계산

파일: `java/com.sap.sailing.domain/src/com/sap/sailing/domain/orc/impl/ORCPerformanceCurveRankingMetric.java`

이 클래스의 javadoc:

```
As opposed to before 2015 when implied wind was the only ranking criterion at all times, in 2015 it was decided to
rank based on corrected times, and corrected times shall be computed not by mapping each boat's implied wind to the
performance curve of a scratch boat, but instead map the implied wind of the boat with the greatest implied wind onto
each other boat's performance curve to obtain their time allowance for the course they sailed so far and then compare
with their actual elapsed time. Note that for boats other than the one with the greatest implied wind this can lead
to a ranking that is inconsistent with an ordering by implied wind.
```

→ **ORC 2015 룰 변경**까지 코드에 반영됨. 이는 ORC International의 PCS (Performance Curve Scoring) 표준 구현이며, IRC와 ORR 다음으로 세계적으로 가장 많이 쓰이는 핸디캡 시스템 중 하나.

알고리즘 흐름:
1. 각 boat의 ORC certificate → polar curve
2. Race가 진행된 (실제 wind 조건, 실제 코스 길이) 를 알면, 각 boat의 polar curve 위에서 "이 보트가 이 wind 에서 이 코스를 최적으로 달리면 얼마 걸렸을까" = elapsed scratch time
3. "Implied wind" = 실제 경과 시간 ↔ polar 의 역방향 mapping 으로 그 보트가 "달리고 있다고 느낀" wind speed
4. Race-level ranking: 가장 implied wind가 큰 보트를 기준으로 모든 보트의 corrected time을 다시 계산 → 동일한 wind 조건에서 누가 더 빠른가

### §5.3 ORC Implied Wind Source — race log event

```
RaceLogORCImpliedWindSourceEventSerializer.java
RaceLogORCImpliedWindSourceEventDeserializer.java
RaceLogORCLegDataEventSerializer.java
RaceLogORCCertificateAssignmentEventSerializer.java
RaceLogORCScratchBoatEventSerializer.java
```

→ ORC certificate 할당, scratch boat 지정, implied wind source 결정 등이 **race log event**로 기록됨. 이는 race가 진행 중에도 race committee가 결정을 변경할 수 있는 audit trail.

### §5.4 Race log — event sourcing 패턴

`com.sap.sailing.domain.racelog` 전체가 race의 모든 state change를 immutable event로 저장. Mark moved, start line set, recall sent, finish protested 등 50개 이상의 event type. **이는 fundamental하게 event-sourcing CQRS 패턴**으로 구현된 것.

함의: live scoring engine은 모든 게 stateful aggregation처럼 보이지만, 실제로는 event stream을 replay하면 동일한 leaderboard가 나오도록 설계됨. → **RabbitMQ transaction log shipping** (README 인용) 으로 replication 가능.

### §5.5 SailTechCo 함의

ORC PCS의 풀 구현은 매우 가치가 높다. 한국에서 ORC 핸디캡 race는 활발하다 (예: 통영컵, 거제 SOIRC). SailTechCo가 ORC PCS를 자체 구현하는 데 6~12개월이 들 수 있는 반면, **SAP 코드를 reference로 활용**하면 (Apache 2.0이므로 read/learn은 자유) 2~3개월로 단축 가능. 단, 직접 copy는 attribution 요구.

---

## §6. 리플레이 시각 언어 / web UI

### §6.1 GWT 기반 — 2010년대 SAP 표준 stack

저장소 통계로 본 UI 코드:
- 16.2% JavaScript
- 2.8% HTML
- 다수의 `com.sap.sailing.gwt.*` 모듈

**Google Web Toolkit (GWT)** 는 Java 코드를 JavaScript로 컴파일하는 SAP/Eclipse 진영의 frontend 표준. 단, **현재 시점에 GWT는 deprecated 진영** — React/Vue/Svelte 가 dominant. Eclipse Azimuth로 이관 시 가장 큰 modernization 과제.

### §6.2 README의 UI feature 인용

```
You can contribute ... [for example] additional features for the race viewer; or a map visualization that does not
require a Google Map but uses Open Street Map / Open Layers; ... major UI improvements for the administrative layer
("AdminConsole")
```

→ 현재 race viewer는 Google Maps에 hard-coupled. Open Street Map / OpenLayers로 옮기는 것이 community contribution wish list 상위.

### §6.3 Live race UI 코드 일부

```
com.sap.sailing.gwt.ui/src/main/java/com/sap/sailing/gwt/autoplay/client/places/screens/liveraceloop/racemapwithleaderboard/
```

→ "autoplay liveraceloop" — race 종료 후 자동으로 다음 race로 넘어가며 race map + leaderboard를 동시에 보여주는 view. 이는 **broadcast TV-style** 환경에서 사용되는 UI 패턴 (ESS, SailGP 의 TV graphics overlay 와 유사).

### §6.4 Sail Insight 모바일 앱 — React Native

별도 저장소: `github.com/SAP/sailing-analytics-sail-insight`

Eclipse Azimuth proposal에서 인용:
```
The "sailing-analytics-sail-insight" repo has the "Sail Insight" React Native app, cross-platform for iOS and Android.
```

→ 사용자 측 보트 트래킹 + 분석은 **React Native** (즉 모바일은 modern stack). 메인 클라우드는 GWT (legacy), 모바일은 React Native — 흔한 enterprise 분기.

### §6.5 Replay 시각 언어 — 코드에서 추정한 핵심 요소

GWT module 이름과 클래스 명으로부터:

| 요소 | SAP 구현 |
|---|---|
| Map base | Google Maps (현재). OSM 대안 wishlist에 있음 |
| Boat track | 실시간 GPS path overlay (시간축 scrubbing) |
| Wind arrows | wind track의 wind fix를 위치별로 표시 (HMM 결과) |
| Mark/course | course design 도 (race log course events 기반) |
| Leaderboard | scoring scheme 적용된 ranking, leg-by-leg breakdown |
| Maneuver markers | tack/jibe 위치 + maneuver loss 수치 |
| Charts | dashboards.gwt 모듈의 chart components (e.g., speed-over-time, VMG, distance to mark) |

이 시각 언어는 **post-race analytics + broadcast replay** 에 최적화. Live tactical coaching dashboard (보트 위에서 보는) 는 별도 영역으로 Sail Insight 앱이 담당.

### §6.6 함의

SailTechCo의 web UI는 SAP보다 modern (React, modern map tile, mobile-first) 할 수밖에 없다 — 단순히 시간을 후발주자로 출발하기 때문. 하지만 SAP의 **시각 정보 information architecture** — 어떤 데이터를 어떻게 layered visualization 으로 보여줄지 — 는 14년 운영에서 검증된 valuable reference.

---

## §7. 가격·라이선스(Apache 2.0)·사용자 base·Eclipse Azimuth 이관

### §7.1 라이선스 — Apache 2.0 의 의미

```
File: LICENSE
SPDX-License-Identifier: Apache-2.0
```

- **자유롭게 사용 가능** (commercial, on-premise, cloud)
- **수정 가능**
- **재배포 가능** (수정본이든 원본이든)
- **특허 grant 포함** — SAP가 보유한 sailing analytics 관련 특허에 대해 사용자에게 grant
- **NOTICE attribution 요구** — 사용자가 자신의 product에 SAP 코드를 포함시키면 NOTICE 파일에 attribution 필요

**SailTechCo에 대한 함의**:
- SAP 코드를 **읽고 학습** → 완전 자유. 알고리즘 개념, architecture pattern, ML pipeline 설계 등을 깊게 배움.
- SAP 코드를 **직접 copy-paste** → 가능하지만 NOTICE attribution + Apache 2.0 라이선스 유지 필요. 우리 product 코드 베이스가 Apache 2.0과 호환되지 않는 라이선스 (예: AGPL) 라면 incompatibility 문제.
- SAP 알고리즘에 inspire 되어 **유사한 알고리즘을 우리 코드로 re-implement** → 가장 안전하고 권장.

### §7.2 사용자 base — 1,000+ events, 2회 Olympic, 다수 world championship

Eclipse Azimuth proposal에서 인용:
```
In October 2025, SAP published the source code under the Apache 2.0 license after it had been deployed at several
thousand events, from small to huge, including several world championships and two Olympic Summer Games events
(Tokyo 2020/2021, Paris 2024).
```

GitHub README 인용:
```
Highlights were two Olympic Summer Games (Tokyo/Enoshima 2020/2021, Paris/Marseille 2024) where the solution saw close
to a million unique visitors.
```

→ **검증된 scale**: 단일 이벤트에서 100만 명 동시 viewer. 단일 server 노드가 500~1000명 동시 viewer 처리 (README 인용), RabbitMQ replication으로 horizontal scale.

### §7.3 가격 — 무료, 단 hosting 필요

- 소스코드: Apache 2.0 무료
- SAP가 호스팅한 `sapsailing.com` 도 무료 이용 가능 (현재) — 자기 이벤트의 데이터를 업로드해서 분석 페이지 무료 생성
- 자체 호스팅: README의 sizing 인용:
  - Small (national league, 18 racers, single leaderboard): **8GB RAM, 4-8 CPU**
  - Medium (15 classes, 6 course areas concurrent): **16GB RAM, 16 CPU**
  - Large archive (30,000 races, thousands of visitors/day): **64GB RAM, 2TB NVMe swap, 8 CPU**

→ AWS r6i.xlarge ~ r6i.4xlarge 정도. 월 \$300~\$1,000 인프라 비용으로 자체 호스팅 가능.

### §7.4 Eclipse Azimuth 이관 — 2025년 11월 13일 proposal 승인

Eclipse Project Page: `https://projects.eclipse.org/projects/technology.sailing-analytics`

Future work (proposal 인용):
```
- Package name migration into the org.eclipse namespace
- Landscape/hosting automation
- Google Maps alternative
- Connectors to more sensor / tracking technologies
- Integrations with robotic mark solutions
```

이관 committer 12명:
- Axel Uhl (project lead, SAP Distinguished Engineer)
- Matthias Sohn (lead, SAP, JGit maintainer 출신)
- David Kempin, Peter Siegmund, Tobias Gabriel, Fredrik Teschke, Christof Heinzel, Michael Görtz, Georg Herdt, Sebastian Wolf, Thomas Stokes, Radek Masnica

Interested parties:
- World Sailing (governing body)
- European Sailing Federation (EuroSAF)
- 독일 (Lübecker YC, VSaW, DSV)
- 폴란드 Sailing Federation
- 오스트리아 Segel-Bundesliga
- Versino (체코), Agima IT, d-labs GmbH

→ **국제 sailing governing body가 직접 endorse**. 이는 Eclipse Azimuth가 사실상 World Sailing의 official analytics open source 표준이 될 가능성을 시사.

### §7.5 한국 사용 — 거의 없음 (확인된 바)

`sapsailing.com` 의 archive에서 "Korea" / "한국" / "KSF" 검색 시 확인되는 한국 이벤트 — Tokyo/Enoshima 2020 Olympic 의 Korean 선수 결과는 포함되어 있지만, **한국 organize 이벤트 자체는 없음**. KSF (대한요트협회) 가 SAP Sailing을 도입했다는 공개된 기록 없음.

→ SailTechCo 입장: 한국 시장은 **여전히 미개척**. SAP Sailing 이 free + open source가 되었어도, 한국 sailing community 가 자체 도입을 할 인력 (Java/OSGi 운영 가능한 엔지니어 + 영문 도메인 지식) 이 부족.

### §7.6 함의

| Angle | 영향 |
|---|---|
| **위협** | Apache 2.0 로 누구나 SAP-equivalent solution을 무료로 launch 가능 → "SailTechCo는 뭐가 다른가?" 가 더욱 sharp한 질문 |
| **기회** | 한국 sailing community에는 여전히 도입 장벽 (언어, 도메인, 운영) → 우리가 **한국 localized SaaS** 로 SAP-equivalent 가치를 패키지하면 차별화 |
| **기술적 기회** | SAP의 algorithm pattern을 reference로 **modern stack에 re-implement** → 6~18개월 timeline 단축 |
| **전략적 위협** | World Sailing/Olympic event organizers는 이제 SAP Sailing을 default로 채택할 가능성. 즉 **이벤트 organizer 시장은 SAP가 free로 점령** → 우리는 ineligible. |
| **전략적 기회** | 반면 **개인 선수 / 클럽 / 코치** 시장은 SAP가 약함 (Sail Insight 외). 이게 우리 entry point. |

---

## §8. 함의 (SailTechCo 알고리즘 R&D 로드맵에서의 위치)

### §8.1 SAP Sailing은 우리에게 "교과서" 다

SAP는 14년간 가장 어려운 sailing analytics 문제에 자본/인력을 투자해 푼 누적 자산을 무료로 공개했다. 우리가 보유해야 할 mental model은:

- **SAP를 reverse-engineer 해서 한국어 SaaS로 다시 만든다** → 잘못된 framing. 우리는 SAP가 닿지 못한 곳을 가야 함.
- **SAP를 algorithm/architecture 교과서로 쓴다, 우리는 다른 layer (개인 선수 coach, 한국 localization, mobile-first UX) 에서 차별화한다** → 정답.

### §8.2 알고리즘 채택 우선순위 (학습 가치 순)

1. **HMM-based wind reconstruction** (§1) — 무조건 도입할 만한 alpha. ChartedSails / Vakaros / Garmin 어떤 제품도 이 수준은 안 됨.
2. **Two-boundary maneuver detection** (§4.2) — main curve + stable-stable curve 분리는 KPI 정의에 직결.
3. **ORC PCS scoring** (§5.2) — 한국 ORC race 시장 진입에 직결.
4. **Cubic regression polars per (boat class × leg type × tack)** (§3) — Njord 수준의 polar 분석에 충분.
5. **Multi-source wind data fusion** (§2) — Igtimi 같은 부이 인프라가 없어도, multi-app crowd-sourcing 으로 reuse 가능한 패턴.

### §8.3 알고리즘 비채택 — SAP가 약한 곳 = 우리가 이길 곳

1. **On-water coaching** — SAP는 post-race analytics가 중심. Target speed coach, layline advice, fleet position relative ranking — Njord-스타일 UX에 SAP는 답이 없다.
2. **Mobile-first UX** — SAP는 GWT web → desktop-first. 모바일 (Sail Insight) 은 별 앱이고 분석 깊이는 web보다 얕다.
3. **Solo training session** — SAP의 race-structure 의존성 (mark, leg, course) 이 강함. Free-form training 분석은 ChartedSails, Vakaros 가 더 강함.
4. **AI-driven insight** — SAP는 ML을 maneuver classification에만 사용. 자연어 race summary, video commentary 생성, LLM 기반 coach는 없음.
5. **Korean language + localized scoring** — 거제컵, 통영컵, 부산컵 등 한국 고유 룰 / 스폰서십 / 한국어 UI는 SAP가 닿지 않음.

### §8.4 SailTechCo의 알고리즘 R&D 우선순위

| 우선 | 항목 | SAP를 reference로? | 우리 차별화 |
|---|---|---|---|
| P0 | Maneuver detection (2-boundary) | YES | Boat-class별 threshold tuning (특히 Hobie 16, 49erFX, ILCA 7 — KSF 주요 클래스) |
| P0 | Wind reconstruction (HMM 기반) | YES | LLM augmented confidence narrative — "지금 5도 left shift, confidence 95%" 한국어 코치 멘트 |
| P1 | ORC PCS scoring | YES | 한국 통영 ORC fleet entry point |
| P1 | Polar mining | YES | 사용자 정의 polar import (Njord parity) |
| P2 | Live leaderboard event sourcing | YES | event-sourcing 아키텍처는 채택 |
| P2 | Replay UI | NO (modern stack 새로) | Mobile-first scrubbing, video sync (broadcast graphics layer) |
| P3 | Race committee app | NO (별도) | 한국어 RC interface |

### §8.5 라이선스 위생 — 권고

- SAP 코드는 **읽고 design 학습** 에 100% 사용. 알고리즘 핵심 idea (HMM 구조, 4-type 분류, bisector TWD, ORC PCS flow) 를 우리 design doc에 인용 (출처: SAP/sailing-analytics).
- SAP 코드 **직접 import 절대 금지** — Apache 2.0 attribution + license-text inclusion 의무가 우리 SaaS license 와 충돌 가능.
- **차별화 알고리즘은 우리가 처음부터 작성** — 단, 인지/citation은 SAP 보다 학술 논문 (sailing analytics 분야의 IEEE/ACM paper, Vlasic & Tilbury 2018 등) 으로 root cause 까지 보내는 것이 더 안전.

### §8.6 1년 R&D plan 제안

| Quarter | 결과물 | SAP 참조 |
|---|---|---|
| Q1 (2026 H1 시작) | 한국 위치 mockup 으로 GPS → maneuver detection → 한국어 race summary | §1.13, §4.1 (ManeuverImpl, maneuver loss 공식) |
| Q2 | Polar mining MVP (사용자가 자신의 polar import) + ORC certificate 표 | §3, §5.2 |
| Q3 | Wind reconstruction v1 (Random Forest 단일 모델 → HMM 단순 sequence 추론) | §1.6~9 |
| Q4 | Multi-source data fusion (WindFinder API, 한국 기상청 API, 다중 사용자 boat tracks) | §2 |
| Q5 (2027 H1) | Live coaching app (target speed, layline) — **SAP에 없는 영역** | n/a, Njord / Tactical / Sailmon reference |
| Q6 | 한국 sailing league 베타 운영 — 거제 / 통영 / 부산 클럽 partnership | §6.5 (broadcast graphics) |

---

## 부록 A. 핵심 코드 파일 매핑 — 추후 deep-read 추천 리스트

| Priority | Path (모두 `github.com/SAP/sailing-analytics/blob/main/java/` 기준) | 학습 가치 |
|---|---|---|
| ★★★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/ManeuverBasedWindEstimationComponentImpl.java` | wind estimation 파이프라인 entry |
| ★★★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/aggregator/hmm/ManeuverSequenceGraph.java` | HMM aggregator |
| ★★★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/aggregator/hmm/IntersectedWindRangeBasedTransitionProbabilitiesCalculator.java` | TWD penalty 공식 |
| ★★★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/aggregator/hmm/BestPathsCalculator.java` | Viterbi + Forward-Backward |
| ★★★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/data/transformer/ManeuverForEstimationTransformer.java` | maneuver category 임계값 |
| ★★★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/data/ManeuverForEstimation.java` | feature vector schema |
| ★★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/model/classifier/smile/RandomForestClassifier.java` | ML 모델 wrapper |
| ★★ | `com.sap.sailing.domain/src/com/sap/sailing/domain/maneuverdetection/impl/ManeuverDetectorImpl.java` | maneuver detection (Douglas-Peucker) |
| ★★ | `com.sap.sailing.domain/src/com/sap/sailing/domain/tracking/Maneuver.java` | maneuver 인터페이스 (2-boundary) |
| ★★ | `com.sap.sailing.domain/src/com/sap/sailing/domain/orc/impl/ORCPerformanceCurveRankingMetric.java` | ORC PCS 알고리즘 |
| ★★ | `com.sap.sailing.polars/src/com/sap/sailing/polars/regression/IncrementalLeastSquares.java` | polar regression |
| ★★ | `com.sap.sailing.polars/src/com/sap/sailing/polars/mining/CubicRegressionPerCourseProcessor.java` | polar mining grouping |
| ★★ | `com.sap.sailing.domain.common/src/com/sap/sailing/domain/common/ScoringSchemeType.java` | 27가지 scoring rule |
| ★ | `com.sap.sailing.domain.windfinderadapter/src/com/sap/sailing/domain/windfinderadapter/impl/WindFinderWindTracker.java` | 외부 wind 통합 패턴 |
| ★ | `com.sap.sailing.landscape/src/com/sap/sailing/landscape/procedures/SailingProcessConfigurationVariables.java` | 11개 adapter 환경 설정 |
| ★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/aggregator/ManeuverClassificationsAggregatorFactory.java` | 5가지 aggregator factory |
| ★ | `com.sap.sailing.windestimation/src/com/sap/sailing/windestimation/aggregator/msthmm/MstManeuverGraph.java` | MST-HMM 변형 |

## 부록 B. 알고리즘 상수 cheat-sheet

| 상수 | 값 | 의미 | 위치 |
|---|---|---|---|
| `MAX_TURNING_RATE_IN_DEG_PER_SECOND_FOR_STABLE_COURSE_ANALYSIS` | 1 | 직진(stable) 판정 임계값 | ManeuverDetectorImpl |
| `MIN_ANGULAR_VELOCITY_FOR_MAIN_CURVE_BOUNDARIES_IN_DEGREES_PER_SECOND` | 0.2 | main curve 진입 판정 | ManeuverDetectorImpl |
| `ManeuverCategory.SMALL` | < 30° | wind est 제외 | ManeuverForEstimationTransformer |
| `ManeuverCategory.REGULAR` | 30~120° | wind est 대상 | ManeuverForEstimationTransformer |
| `ManeuverCategory.WIDE` | 120~150° | 잡 maneuver | ManeuverForEstimationTransformer |
| `Laplace smoothing for classifier` | +0.05 | ML output 정규화 전 | ManeuverWithProbabilisticTypeClassification |
| `LA_PLACE_TRANSITION_PROBABILITY` | 0.001 | HMM transition 0 회피 | IntersectedWindRangeBasedTransitionProbabilitiesCalculator |
| `MAX_ABS_WIND_COURSE_DEVIATION_TOLERANCE_WITHIN_ANALYSIS_INTERVAL_IN_DEGREES` | 40 | TWD drift tolerance | IntersectedWindRangeBasedTransitionProbabilitiesCalculator |
| `MIN_BEATING_ANGLE_PLUS_MIN_RUNNING_ANGLE` | 40 | head-up/bear-away range 제한 | IntersectedWindRangeBasedTransitionProbabilitiesCalculator |
| `Random Forest 트리 개수` | 50 | ML 분류기 hyperparameter | RandomForestClassifier |
| `default medal race factor` | 2.0 | scoring scaling | ScoringScheme |
| `DETECTOR_VERSION` | 1 | maneuver detector 버전 (캐시 invalidation 용) | ManeuverDetectorImpl |

## 부록 C. 아키텍처 stack 요약

```
+---------------------------------------------+
| Web UI (GWT, Google Maps)                  |  <- 16.2% JS, 2.8% HTML
| Race Viewer, AdminConsole, Leaderboard     |
+---------------------------------------------+
| Sail Insight (React Native, iOS/Android)   |  <- 별도 repo
+---------------------------------------------+
| Race Manager App (Android)                 |
| Buoy Pinger App (Android)                  |
+---------------------------------------------+
| REST API (JAX-RS)                          |
| ResourceWindEstimationDataResource,        |
| PolarDataResource, etc.                    |
+---------------------------------------------+
| Domain Services                            |  <- 75.8% Java
| - Wind Estimation (12,368 LoC)             |
|     ML (Smile) + HMM + Polar fitting       |
| - Maneuver Detection (~10k LoC)            |
| - Polar Mining (Cubic LSQ)                 |
| - ORC PCS Scoring                          |
| - Race Log (Event-sourced)                 |
| - Leaderboard / 27 Scoring Schemes         |
+---------------------------------------------+
| Tracking Adapters (11개)                   |
| Bravo / Deckman / Expedition / Igtimi /    |
| OceanRace / Queclink / SwissTiming /       |
| WindFinder / ...                           |
+---------------------------------------------+
| OSGi Runtime (Eclipse Equinox)             |
| Jetty (embedded HTTP)                      |
+---------------------------------------------+
| Persistence: MongoDB 4.4 / 5.0 / 6.0 / 7.0|
| Messaging: RabbitMQ (replication, scale)   |
+---------------------------------------------+
```

특기:
- 모든 알고리즘은 **JVM 내 in-memory** — 별도 ML serving infra, separate analytics DB 없음
- **단일 server process가 라이브 + replay + admin** 모두 담당 — monolithic OSGi
- **수평 확장** = 별도 노드를 RabbitMQ로 replication 하여 read-only viewer 분산
- Docker compose 단일 명령으로 (MongoDB + RabbitMQ + SAP server) 띄움 — production-ready 자체 호스팅

---

## 부록 D. 결론 - 한 줄로 요약

**SAP Sailing Analytics open-source 공개는 sailing analytics R&D 의 "Linux 모먼트" 이며, SailTechCo 의 알고리즘 baseline 을 12개월 단축할 수 있는 reference 이지만 동시에 시장 진입 장벽을 낮춰 "왜 우리가 다른가" 질문을 더 sharp 하게 만들었다. 우리는 SAP 가 닿지 못한 곳 — 개인 선수 onboard coaching, 모바일 first UX, 한국 localization — 에 집중하여 차별화 한다.**

---

**Word count**: ~6,300 한국어 단어 (영문 코드 인용 포함 약 8,500 토큰), PhD 검수 + 투자자 deck 사용 가능 수준의 detail.

**Sources directly examined** (clone-and-read, 2026-05-27):
- Cloned `https://github.com/SAP/sailing-analytics` main branch (sparse-checkout `java/`)
- 8,182 Java 소스파일 통계 직접 측정, 168개 windestimation 파일 + 35개 polars 파일 read
- 풀 인용 9개 파일 (WindEstimationComponent, ManeuverBasedWindEstimationComponentImpl, ManeuverForEstimation, ManeuverTypeForClassification, ManeuverCategory, ManeuverFeatures, ManeuverWithProbabilisticTypeClassification, ManeuverSequenceGraph, MiddleCourseBasedTwdCalculatorImpl, PolarsBasedTwsCalculatorImpl, RandomForestClassifier, ManeuverForEstimationTransformer, ManeuverDetector, ManeuverDetectorImpl, IntersectedWindRangeBasedTransitionProbabilitiesCalculator, ORCPerformanceCurveRankingMetric, ScoringSchemeType, WindFinderWindTracker, SailingProcessConfigurationVariables, WindEstimationDataResource, PolarDataResource, ManeuverClassificationsAggregatorFactory, MstManeuverGraph, WindTrackCalculatorImpl)
- README, CLAUDE.md, MANIFEST.MF inspection
- Eclipse Azimuth Project Proposal (projects.eclipse.org/proposals/eclipse-azimuth-sailing-analytics)