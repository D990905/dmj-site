# 티모 강 (#3 Sports Science Researcher) — 작업 요약

| 항목 | 내용 |
|---|---|
| 페르소나 | 티모 강 (Timo Kang) · Sports Science Researcher · Loughborough PhD |
| 시그니처 | §181 윙 폴라 model PhD 검증 owner |
| 작업 기간 | Phase 1 ~ v3 (2026-05-27 ~ 2026-05-31) |
| 자주 협업 | 샘 정 (지표 시각) · 히로 구 (IMU calibration) · 왕 정 (Apple Watch IMU) |
| 산출 총량 | 4 spec doc (233 KB) + 6 모듈 + 6 selftest (207/207 PASS) |
| 제약 준수 | `DO_NOT_REVERT` §181-* 전수 보존 · 기존 코드 0 revert · Fabrication 0 |

---

## 1. 산출물 — 4 spec 문서

| # | 파일 (`site/_experts/`) | 크기 | 내용 |
|---|---|---|---|
| 1 | `expert_sports_science_reference.md` | 125 KB | Phase 1 학습 + 알고리즘 audit + Phase 2 진행 + §12 athleteMonitoring·Firstbeat |
| 2 | `sports_science_calibration_protocol.md` | 19 KB | §181-C multi-rider anchor 수집 6-month protocol |
| 3 | `sports_science_cross_modal_training_system.md` | 51 KB | v2 — 세일링 + 육상 부하 융합 · gap-filling prescription engine |
| 4 | `sports_science_event_periodization_system.md` | 37 KB | v3 — race format baseline · 역공학 12-week periodization · 단무지 톤 알림 |

---

## 2. 산출물 — 6 코드 모듈 (모두 additive · 기존 0 revert)

### 2-1. 학술 reference 인라인 commit (Step 1)

`analysis.js` · `coach.js` · `vkx-parser.js` · `lift-calculator.js` 의 11 핵심 함수에 DOI/ISBN/URL 포함 reference 주석 추가. 코드 로직 변경 0건.

| 함수 | 추가된 reference |
|---|---|
| `countProminentPeaks` | Virtanen et al. 2020 SciPy 1.0 (doi:10.1038/s41592-019-0686-2) |
| `detectManeuvers` | Larsson & Eliasson 2022 · Vakaros · Njord · SAP OSS |
| `classifyManeuver` | Saw, Main, Gastin 2016 (doi:10.1136/bjsports-2015-094758) |
| `computeTierMeans` | Sands et al. 2017 (doi:10.1123/ijspp.2016-0405) |
| `estimateWindFromTrack` | Mardia & Jupp 2000 · Burch 2022 |
| `estimateWindFromManeuvers` | Mardia & Jupp 2000 · Berens 2009 CircStat |
| `computeWindMetrics` | Larsson & Eliasson 2022 · ORC IMS VPP |
| `quatToHeelPitch` | Diebel 2006 Stanford · Vakaros VKX spec |
| `computeVPS` | Vantage Sailing · Halson 2014 (doi:10.1007/s40279-014-0253-z) |
| `upwindSpeed` (§176/§181) | Anderson 2010 · Faltinsen 2005 · Folkersma 2019 · Larsson & Eliasson · Garrett 1996 |

### 2-2. TRIMP · CTL/ATL/TSB · HRV 모듈 (Phase 2 Steps 2-4)

| Module | 위치 | 학술 기반 |
|---|---|---|
| `An.computeTRIMP(session, profile)` | `analysis.js` | Banister 1991 (HRR × sex weighting) |
| `Storage.computeFitnessTrend(sessions)` + `interpretTSB` | `storage.js` | Coggan & Allen 2010 PMC (k=42 / k=7 EWMA) |
| `An.computeHRV(rrIntervals)` | `analysis.js` | Task Force ESC/NASPE 1996 (doi:10.1161/01.CIR.93.5.1043) |

### 2-3. 4-channel wind Bayesian (Phase 2 Step 5)

| Module | 위치 | 학술 기반 |
|---|---|---|
| `An.combineWindSources(sources)` | `analysis.js` | Mardia & Jupp 2000 (circular statistics — 2θ doubled-angle 가중 원형 평균) |
| `An.buildWindSources` 확장 — 6 slot | `analysis.js` | (Channel A: lineup, B: IMU 신규) |

### 2-4. Cross-modal training (v2)

| Module | 위치 | 학술 기반 |
|---|---|---|
| `SPORT_MET_LIBRARY` (32 sports) + `WINDFOIL_CARRYOVER` | `js/sport-met.js` (10 KB 신규) | Ainsworth 2011 Compendium (doi:10.1249/MSS.0b013e31821ece12) · Tanaka 1994 |
| `An.computeWorkload(session, profile, opts)` | `analysis.js` | 3-tier (Banister → MET → sRPE Foster 2001) |
| `Coach.decideRecoveryAction(state)` | `coach.js` | 4-zone decision tree (Halson 2014 + Saw 2016) |
| `Storage.suggestLandWorkout(gap, profile, prefs, history)` + `EXERCISE_LIBRARY` | `storage.js` | Seiler 80/20 polarized · ACSM 12e FITT |

### 2-5. Event-aware periodization (v3)

| Module | 위치 | 학술 기반 |
|---|---|---|
| `RACE_FORMAT_LIBRARY` (12 formats) + `SKILL_MODIFIER` + `WIND_MODIFIER` | `js/race-formats.js` (7 KB 신규) | iQFOiL Paris 2024 · IWSA WingFoil rules · Vogiatzis 2002/2004 |
| `An.estimateRaceLoad(format, athlete, wind)` | `analysis.js` | 위 library lookup + modifier |
| `An.estimateCompetitionLoad(schedule, athlete)` | `analysis.js` | Multi-day TRIMP 합산 |
| `Storage.buildPeriodizationPlan(target, athlete, opts)` | `storage.js` | Issurin 2008 ATR block + Bosquet 2007 taper meta-analysis |
| `Storage.dailyPlanCheck(plan, actual)` | `storage.js` | Compliance traffic-light + 적응형 adjustment |
| `Coach.generateDailyNotification(plan, recovery, weather)` | `coach.js` | 단무지 톤 — 한국어, 1-2 문장, 이모지 0-1개 |

---

## 3. Selftest 결과 — 207/207 PASS

`site/riding-dashboard/selftest-*.js` 6 파일, 모두 Node 환경 직접 실행 가능.

| Selftest | Assertions | 핵심 검증 |
|---|---|---|
| `selftest-trimp.js` | 23/23 ✅ | Banister 표준 1hr·HRR=0.5·male → TRIMP 50.1 · 송정 부산 실측 GPX → TRIMP 100.5 |
| `selftest-fitness-trend.js` | 22/22 ✅ | EWMA 수학 직접 검증 · taper dynamics · zone label |
| `selftest-hrv.js` | 21/21 ✅ | RMSSD 정확 (alternating ±20ms → 40ms) · artifact + ectopic rejection |
| `selftest-wind-combine.js` | 22/22 ✅ | 4 채널 가중 통합 · circular wrap · 모든 입력 낮음 → 낮음 clamp |
| `selftest-cross-modal.js` | 59/59 ✅ | 3-tier 자동 분기 · 4-zone recovery · suggestLandWorkout filter/carryover/variety |
| `selftest-periodization.js` | 60/60 ✅ | race format lookup · 12-week reverse engineering · daily compliance · 단무지 알림 |
| **Total** | **207/207** | |

---

## 4. 학술 reference — 50+ (모두 DOI/PMID/ISBN/URL 검증)

### 세일링 물리 · yacht design
- Larsson, L., Eliasson, R., Orych, M. (2022). *Principles of Yacht Design* 5e. Bloomsbury. ISBN 978-1-3994-0301-6.
- Garrett, R. (1996). *The Symmetry of Sailing*. Sheridan House. ISBN 978-1-57409-000-5.
- ORC IMS VPP Documentation — https://www.orc.org/index.asp?id=37

### Foil hydrodynamics
- Anderson, J.D. (2010). *Fundamentals of Aerodynamics* 6e. McGraw-Hill. ISBN 978-1-259-12991-9.
- Faltinsen, O.M. (2005). *Hydrodynamics of High-Speed Marine Vehicles*. Cambridge. doi:10.1017/CBO9780511546068.
- Folkersma, M., Schmehl, R., Viré, A. (2019). "Boundary layer transition modeling on leading edge inflatable kite airfoils". *Wind Energy* 22(7):908-921. doi:10.1002/we.2329.

### 원형 통계 · 통계 기법
- Mardia, K.V., Jupp, P.E. (2000). *Directional Statistics*. Wiley. ISBN 978-0-471-95333-3. doi:10.1002/9780470316979.
- Silverman, B.W. (1986). *Density Estimation for Statistics and Data Analysis*. Chapman & Hall. ISBN 978-0-412-24620-3.
- Berens, P. (2009). "CircStat: A MATLAB Toolbox for Circular Statistics". *J Stat Softw* 31(10):1-21. doi:10.18637/jss.v031.i10.
- Virtanen, P. et al. (2020). "SciPy 1.0". *Nat Methods* 17:261-272. doi:10.1038/s41592-019-0686-2.

### 운동 생리 · 훈련 부하 · HRV
- Banister, E.W. (1991). "Modeling Elite Athletic Performance". In *Physiological Testing of the High-Performance Athlete* 2e. Human Kinetics. ISBN 978-0-87322-307-5.
- Morton, R.H., Fitz-Clarke, J.R., Banister, E.W. (1990). *J Appl Physiol* 69(3):1171-1177. doi:10.1152/jappl.1990.69.3.1171.
- Coggan, A.R., Allen, H. (2010). *Training and Racing with a Power Meter* 2e. VeloPress. ISBN 978-1-934030-55-2.
- Task Force ESC/NASPE (1996). "Heart rate variability: Standards of measurement". *Eur Heart J* 17(3):354-381; *Circulation* 93(5):1043-1065. doi:10.1161/01.CIR.93.5.1043. PMID 8598068.
- Karvonen, M.J., Kentala, E., Mustala, O. (1957). "The effects of training on heart rate". *Ann Med Exp Biol Fenn* 35(3):307-315. PMID 13470504.
- Tanaka, H., Monahan, K.D., Seals, D.R. (2001). "Age-predicted maximal heart rate revisited". *J Am Coll Cardiol* 37(1):153-156. doi:10.1016/S0735-1097(00)01054-8.
- Plews, D.J. et al. (2013). "Training adaptation and HRV in elite endurance athletes". *Sports Med* 43(9):773-781. doi:10.1007/s40279-013-0071-8.

### 회복 · 주관적 wellness
- Halson, S.L. (2014). "Monitoring training load to understand fatigue". *Sports Med* 44(Suppl 2):139-147. doi:10.1007/s40279-014-0253-z. PMID 25200666.
- Hooper, S.L. et al. (1995). "Markers for monitoring overtraining and recovery". *Med Sci Sports Exerc* 27(1):106-112. doi:10.1249/00005768-199501000-00019.
- Saw, A.E., Main, L.C., Gastin, P.B. (2016). "Subjective self-reported measures trump objective measures". *Br J Sports Med* 50(5):281-291. doi:10.1136/bjsports-2015-094758.
- Kellmann, M., Kallus, K.W. (2001). *Recovery-stress Questionnaire for Athletes*. Human Kinetics. ISBN 978-0-7360-3700-2.

### Cross-modal · MET · sRPE
- Ainsworth, B.E. et al. (2011). "2011 Compendium of Physical Activities". *Med Sci Sports Exerc* 43(8):1575-1581. doi:10.1249/MSS.0b013e31821ece12.
- Herrmann, S.D. et al. (2024). "2024 Adult Compendium of Physical Activities". *J Sport Health Sci* 13(1):6-12. doi:10.1016/j.jshs.2023.10.010.
- Foster, C. et al. (2001). "A new approach to monitoring exercise training" (sRPE). *J Strength Cond Res* 15(1):109-115. PMID 11708692.
- Haddad, M. et al. (2017). "Session-RPE Method for Training Load Monitoring: Validity Review". *Front Neurosci* 11:612. doi:10.3389/fnins.2017.00612.
- Tanaka, H. (1994). "Effects of cross-training: VO2max transfer". *Sports Med* 18(5):330-339. doi:10.2165/00007256-199418050-00005.

### ACWR · 부상 예방
- Gabbett, T.J. (2016). "The training—injury prevention paradox". *Br J Sports Med* 50(5):273-280. doi:10.1136/bjsports-2015-095788.
- Hulin, B.T. et al. (2014). "ACWR predicts injury: elite rugby". *Br J Sports Med* 50(4):231-236. doi:10.1136/bjsports-2015-094817.
- Williams, S. et al. (2017). "EWMA superior to rolling average for ACWR". *Br J Sports Med* 51(3):209-210. doi:10.1136/bjsports-2016-096214.
- Murray, N.B. et al. (2017). "EWMA more sensitive injury indicator". *Br J Sports Med* 51(9):749-754. doi:10.1136/bjsports-2016-097152. PMID 28003238.
- Soligard, T. et al. (2016). "IOC consensus on load — Part 1 injury". *Br J Sports Med* 50(17):1030-1041. doi:10.1136/bjsports-2016-096581.

### Polarized training · periodization · tapering
- Seiler, K.S., Kjerland, G.Ø. (2006). "Polarized 80/20 distribution in elite endurance". *Scand J Med Sci Sports* 16(1):49-56. doi:10.1111/j.1600-0838.2004.00418.x.
- Stöggl, T., Sperlich, B. (2014). "Polarized training has greater impact". *Front Physiol* 5:33. doi:10.3389/fphys.2014.00033.
- Esteve-Lanao, J. et al. (2007). "Impact of TID on performance". *J Strength Cond Res* 21(3):943-949. doi:10.1519/R-19725.1.
- Issurin, V.B. (2008). *Block Periodization: Breakthrough in Sport Training*. ISBN 978-0-9817180-0-2.
- Issurin, V.B. (2010). "New horizons for periodization". *Sports Med* 40(3):189-206. doi:10.2165/11319770-000000000-00000.
- Bompa, T.O., Buzzichelli, C. (2018). *Periodization* 6e. Human Kinetics. ISBN 978-1-4925-4480-2.
- Mujika, I., Padilla, S. (2003). "Scientific Bases for Precompetition Tapering". *Med Sci Sports Exerc* 35(7):1182-1187. doi:10.1249/01.MSS.0000074448.73931.11.
- Bosquet, L. et al. (2007). "Tapering meta-analysis". *Med Sci Sports Exerc* 39(8):1358-1365. doi:10.1249/mss.0b013e31806010e0. PMID 17762369.

### Windsurfing 물리 · race format (v3)
- Vogiatzis, I. et al. (2002). "Physiological demands of sail pumping in Olympic windsurfers". *Eur J Appl Physiol* 86(5):450-454. doi:10.1007/s00421-001-0571-3. PMID 11882931.
- Vogiatzis, I. et al. (2004). "HR and performance correlation in Olympic windsurfing". *Eur J Appl Physiol* 92(1-2):91-98. doi:10.1007/s00421-003-0808-4.
- iQFOiL Class Official Paris 2024 — https://www.iqfoilclassofficial.org/ofallinfoparis2024
- IWSA WingFoil Racing Rules — https://wingfoilracing.com/competition-additional-rules-and-docs

### Multi-day competition recovery
- Ranchordas, M.K., Dawson, J.T., Russell, M. (2017). "Nutritional recovery strategies for repeated matches". *J Int Soc Sports Nutr* 14:35. doi:10.1186/s12970-017-0193-8.
- Dupuy, O. et al. (2018). "Evidence-based recovery techniques review". *Front Physiol* 9:403. doi:10.3389/fphys.2018.00403.

### Machine learning · benchmarking (Phase 2 후보)
- Hastie, T., Tibshirani, R., Friedman, J. (2009). *The Elements of Statistical Learning* 2e. Springer. ISBN 978-0-387-84857-0.
- Breiman, L. (2001). "Random Forests". *Machine Learning* 45(1):5-32. doi:10.1023/A:1010933404324.

### Commercial 플랫폼 (학습 reference)
- Firstbeat — Indirect EPOC Prediction (Saalasti 2003 thesis + Rusko 2003) — https://www.firstbeat.com/wp-content/uploads/2015/10/white_paper_epoc.pdf
- AthleteMonitoring — Workload Management Basics — https://www.athletemonitoring.com/wordpress/wp-content/uploads/2017/06/Workload-Management-Basics.pdf
- Diebel, J. (2006). "Representing Attitude" Stanford — https://www.astro.rug.nl/software/kapteyn-beta/_downloads/attitude.pdf

---

## 5. 핵심 정량 baseline (v3 산출)

### Race format → TRIMP 베이스라인 (중급, 13-18kt)

| Format | Duration | Avg HR | Z4-Z5 % | TRIMP/race |
|---|---|---|---|---|
| Sprint Slalom | 4-5 min | 165-175 bpm | 65-75% | 18-25 |
| Course race | 10-20 min | 152-158 bpm | 40-50% | 38-65 |
| Distance | 25 min | 150 bpm | 35% | 80 |
| Marathon | 60-90 min | 142-148 bpm | 25-30% | 145-270 |
| Medal series (3 races) | 36 min | 170+ bpm | 80%+ | 145 |

### 5-day Olympic-style 대회 total TRIMP (mid-skill)

```
Day 1: 4 races (slalom×2 + course×2)  → 144 AU
Day 2: 4 races (slalom×2 + dist + course) → 174 AU
Day 3: 1 race (marathon 60min)        → 190 AU
Day 4: 4 races (course×2 + slalom×2)  → 144 AU
Day 5: 3 medal races                  → 150 AU
─────────────────────────────────────────────
TOTAL                                 → 802 AU
```

Elite 선수 ×0.85 = 682 AU · 입문 ×1.5 = 1203 AU.

### 12-week 역공학 periodization (event_TRIMP 900 가정)

```
Week  Phase            Daily AU avg    Weekly AU   Notes
─────────────────────────────────────────────────────────
-12   A1               14              101         Aerobic base
-11   A2               17              121         Volume build
-10   A3               20              139         Volume peak
-9    Recovery 1       11              76          Deload (-40%)
-8    T1               20              139         Race-specific intro
-7    T2               22              157         Slalom + course focus
-6    T3 (peak)        25              176         Maximum load week
-5    Recovery 2       13              88          Deload + tune-up
-4    R1               23              164         Peak specificity
-3    R2               20              139         Volume ↓ 시작
-2    Taper 1          13              88          Bosquet 2-week taper start
-1    Taper 2          8               56          Volume -55% (intensity 유지)
0     COMPETITION      ~180/day        900         Event execution
```

---

## 6. 단무지 design — 5 layer 학술 모델, 1 화면 결정

| Layer | 학술 model | 라이더가 보는 것 |
|---|---|---|
| Layer 5 — Race format library | iQFOiL/IWSA + Vogiatzis HR | 안 보임 |
| Layer 4 — Periodization | Issurin ATR + Bosquet taper | "T2 주" 텍스트 1줄 |
| Layer 3 — Daily plan | Bompa micro-cycle + cross-modal | "Target 100 AU" |
| Layer 2 — Recovery state | TSB + ACWR + HRV + Hooper | 🟢 + 한 줄 |
| Layer 1 — Action | decideRecoveryAction + 알림 | "탭해서 시작" |

### Daily notification 예시 (실 selftest output)

> 🎯 **오늘 100 AU**
> T2 phase, target 100 AU. 컨디션 양호 — 계획대로 진행하세요.

> 🏁 **오늘 경기**
> 경기일입니다. 30분 전 warm-up, 경기 후 30분 안에 CHO + 단백질, 자기 전 카제인 40g.

> 🌙 **오늘 휴식일**
> 계획된 휴식일입니다. 충분한 수면과 회복 우선해 주세요.

> 🟠 **active recovery** — 회복 부족 detected
> 회복 신호 — 라이딩 X 또는 z1 30분 light. 계획 80 AU 중 30-40% 정도만.

> (풍속 5kt 자동 대체)
> 풍속 5kt — 라이딩 어려움. Land workout 29 AU 로 보충 권장.

---

## 7. SailTechCo Moat 연결

| Moat wedge | 본 작업의 contribution |
|---|---|
| **W2** — Windfoil 도메인 KPI | windfoil-specific TRIMP · race format library · windfoil carryover matrix · §181 polar |
| **W3** — 4-channel Wind Inference | `combineWindSources` Bayesian 통합 (2 channel 기존 + 2 channel slot) |
| **W4** — 공개 검증 가능 메서드 | 모든 함수 inline reference · 학술 publishable · `sports_science_calibration_protocol.md` GitHub publish plan |

---

## 8. Phase 3 대기 항목 (Frontend/UX 협업 진입 필요)

1. **Multi-rider §181 calibration kickoff** — 6-month protocol 진입 (Danny coaching network)
2. **App.js 통합** — 신규 6 모듈을 dashboard UI 에 표시 (알렉스 박)
3. **Hooper Index 일일 5초 wellness UI** (메이 한)
4. **Apple Watch IMU Channel B 실구현** (왕 정)
5. **External weather API Channel D** (Backend #10)
6. **GitHub repo first publish** — `github.com/sailtechco/algorithms` MIT License
7. **Academic paper draft** — *Sports Engineering* Springer target

---

## 9. 제약 준수 확인

| 제약 | 상태 |
|---|---|
| `DO_NOT_REVERT` §181·§181-C·§181-D·§181-E·§181-F (lift calculator lock) | ✓ 모두 보존, revert 0건 |
| 기존 Phase 1 코드 0줄 수정 | ✓ 모든 신규 모듈 additive |
| `[[feedback_strict_fact_verification]]` fabrication 금지 | ✓ 0건 — windfoil MET (5/7/9) 만 `estimate-Danny` 명시 |
| 학술 reference DOI/ISBN/URL 명시 | ✓ 50+ reference 전수 검증 |
| 운영 원칙 1 (근거 기반) | ✓ 모든 함수에 inline reference |
| 운영 원칙 2 (반복 혐오) | ✓ 결정 spec 한 곳 (`_experts/`) 만 |
| 운영 원칙 3 (사실대로) | ✓ 추정값/측정값 분리 표기 |
| 운영 원칙 5 (구조화 회신) | ✓ ① ② ③ + 결정 요청 |
| 운영 원칙 7 (자가 검증) | ✓ 207/207 selftest PASS |

---

_작성: 티모 강 (#3, Sports Science Researcher)_
_2026-05-31 KST_
_Loughborough PhD · §181 윙 폴라 model owner_
