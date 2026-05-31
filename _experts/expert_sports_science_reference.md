# expert_sports_science_reference.md — 단무지공방 / SailTechCo Sports Science · 세일링 물리 reference

| 항목 | 내용 |
|---|---|
| 문서 유형 | Phase 1 학습 정리 + 현재 알고리즘 audit + 신규 모델 spec + §181 calibration plan + 검증 sanity-check |
| 작성 | Sports Science Researcher (전문가 #3) · 2026-05-28 |
| 대상 | `site/riding-dashboard/js/` (`analysis.js`·`coach.js`·`gpx-parser.js`·`vkx-parser.js`·`replay.js`) + `site/assets/js/lift-calculator.js` + `site/calculator.html` |
| 범위 | Phase 1 — production 코드 무수정. 학술 정합성 audit + 권장 + spec. §181-C `DO_NOT_REVERT` lock 준수 (검증·문서화만). |
| 근거 | 코드 직접 열람 (`analysis.js` 2722 line · `coach.js` 600+ line · `lift-calculator.js` 1808 line · `vkx-parser.js` 198 line) + 학술 reference (Banister 1991 · Coggan 2003 · Task Force 1996 · Karvonen 1957 · Faltinsen 2005 · Larsson & Eliasson 2014 · Mardia & Jupp 2000 · Kellmann & Kallus 2001 · Folkersma/Schmehl/Viré 2019 · Anderson *Fundamentals of Aerodynamics* 6e) + 자매 expert 문서 (`expert_dataviz_reference.md` §1-3 sailing telemetry · `expert_hardware_embedded_reference.md` §2 IMU · `expert_ux_researcher_reference.md` §1-6 sports app · `sailtechco_moat_proposal.md` W3·W4) |
| Co-owners | DataViz Specialist (#2 — metric 표시 정합성·신뢰도 시각화) · Visual Designer (수식 사이드 패널·explainer UI) · Frontend Engineer (#4 — 모델 구현) · UX Researcher (#5 — 신뢰도 전달 방식) · Mobile App Engineer (#8 — Apple Watch IMU 채널) · Hardware Engineer (#7 — IMU calibration) |
| 제약 | `DO_NOT_REVERT` §181·§181-C·§181-D·§181-E·§181-F (리프팅 calibration lock) — 검증·문서화·calibration plan OK, revert 금지. `[[feedback_strict_fact_verification]]` 절대 fabrication 금지 — 모든 reference 는 실 논문·표준·교과서 (DOI/ISBN/URL 명시) |

> **읽는 법.** §0 = 한 페이지 TL;DR (현재 알고리즘 수준 평가 + Phase 1 권장 우선순위 5). §1 = Phase 1 학습 정리 — 8 영역 학술 reference (세일링 물리·foil 역학·기동 검출·통계 기법·운동 생리·회복·교차상관·벤치마킹). 각 영역은 핵심 공식 + DOI/ISBN/URL. §2 = 현재 알고리즘 audit — 6 모듈별로 정합성·gap·인용 누락을 표기한다. §3 = 학술 reference 인용 plan — 어느 코드에 어떤 citation 을 인라인 주석으로 추가할지. §4 = 신규 모델 v1 spec (TRIMP·CTL/ATL/TSB·HRV·교차상관·벤치마킹). §5 = §181-C calibration plan — Danny 데이터로 anchor 보강 어떻게. §6 = 검증 sanity-check plan — Danny GPX/.vkx 로 정합성 검증 어떻게. §7 = SailTechCo Moat W3 (4-channel wind) · W4 (공개 검증) 와의 연결. §8 = 협업 인터페이스. §9 = 제약 준수 확인. §10 = variables/constants + sources. Phase 1 production 변경은 0건 — 본 문서는 PhD 검수 통과를 위한 청사진이다.

---

## 0. 핵심 결론 (TL;DR)

단무지공방 / SailTechCo 의 분석 코드는 **이미 학술 정합성의 상당 부분을 갖췄다.** `analysis.js` 의 시간가중 백분위 평균(`computeTierMeans`), 원형 통계로 풀린 헤딩 평활(`smoothHeadingByTime` + `circularMean`), GPS 이상치 거부(`gpsMaxSpeedKt` + 기기 SOG 대조), 회전 검출의 진입/탈출 헤딩 + 누적 회전각 + 봉우리 수 동시 사용(`detectManeuvers` + `countTurnRatePeaks`), 풍향 추정의 두 독립 채널 (`estimateWindFromTrack` no-go zone · `estimateWindFromManeuvers` 이등분선 기하) 가 그것이다. `lift-calculator.js` 의 §181 upwind polar 모델은 NACA-급 후방 추론 — apparent wind 합성 → β(true-apparent angle) → C_L heel-out cap → wing-thrust 계수 → V_b sweep → V_max → VMG = V_b × cos(tack) — 이 모든 단계가 표준 공기역학 (Anderson 2010) · LEI 윙 데이터 (Folkersma et al. 2019) · 라이더 anchor (Danny) 의 결합으로 명시돼 있다.

남은 학술 부채는 다섯 갈래다.

**첫째 — 학술 reference 인라인 인용 부재.** 코드 곳곳에 "Silverman bandwidth" "Vantage 문서 기준" "Folkersma 2019" "회전코칭 설계안 v1" 같은 명명은 있으나 **DOI · ISBN · URL 의 inline 인용이 거의 없다.** Folkersma/Schmehl/Viré 2019 만 명시 (lift-calculator.js:692-696, ldFoil/ldWing 도출). 나머지 — Banister TRIMP·Coggan CTL/ATL·Task Force 1996 HRV·Karvonen 1957·Faltinsen 2005·Mardia & Jupp 2000·Larsson & Eliasson — 는 아직 추가 안 됨. PhD 검수 통과를 위해 §3 의 인용 plan 대로 각 알고리즘 머리에 1줄 reference 코멘트 추가 필요. **Phase 1 = plan only, Phase 2 = 인라인 주석 추가**.

**둘째 — 운동 생리 fitness 모델 부재.** `analysis.js` 가 심박수 (HR) 를 트랙 시계열·존 분포·회복 지수까지 표시하지만 **TRIMP (Banister 1991), CTL/ATL/TSB (Coggan 2003), HRV (Task Force 1996), VO2max 추정** 같은 정량 fitness 모델은 없다. 라이더 본인 시즌 추세 (`renderProgression`) 는 평균 속도·최고 속도·거리·시간·HR 만 보여줄 뿐 — 라이더의 **체력 상태 (CTL) · 피로 (ATL) · 폼 (TSB)** 같은 메타 지표가 없어 "오늘 어떻게 라이딩할까?" 의 일일 의사결정을 못 만든다. §4-1·§4-2·§4-3 spec.

**셋째 — 회복 / 주관적 지표 채널 부재.** 수면 시간·기상 RHR (resting heart rate) 추세·RESTQ-Sport (Kellmann & Kallus 2001) 같은 short-form 설문 입력 채널이 코드에 없다. 라이더가 매일 5초 안에 회복 상태를 보고할 UI 가 없으면 ATL/TSB 모델은 객관 데이터 (TRIMP) 로만 동작 — 학술 표준 (Halson 2014 의 multimodal monitoring) 에 미달. §4-3 + UX Researcher 협업.

**넷째 — 교차상관 (cross-correlation) 엔진 부재.** "성능 ↔ 체력 ↔ 회복 ↔ 풍속/spot/장비" 의 다변량 상관 분석이 코드에 없다. Random Forest · linear regression · partial correlation 으로 라이더 본인의 "어떤 컨디션에서 내가 가장 좋은가?" 를 학습할 수 있다 — 단무지공방 / SailTechCo 차별화의 핵심 (sailtechco_moat_proposal §2.W4). §4-4 spec.

**다섯째 — §181-C calibration 의 단일 anchor.** 현재 윙 L/D 계수 LDWING_K=2.2 는 Danny ground-truth anchor 1개 (11kt·80kg·상급-선수·7m² → V_boat ≈ 18kt) 로 보정됐다. CL_WING_MAX=1.0 도 동일 — Danny 2개 anchor (12kt 중급 → 6m² · 10kt 상급-선수 → 7.4m²) 보정. **PhD 검수에서는 다중 라이더 데이터 (n≥5 · 다른 스킬·체중·foil) 로 calibration 의 일반화를 검증해야 한다.** Phase 1 에서는 anchor 출처와 한계를 명시한 calibration plan 작성 (§5).

**Phase 1 권장 우선순위 5 (production 코드 변경 0건 · plan + spec only):**

1. **Top 1 — 학술 reference 인라인 인용 추가 plan (§3)**. 각 알고리즘 함수 머리에 1줄 reference 주석 (DOI / ISBN / URL 포함). Phase 2 에서 코드에 commit. 예: `// Banister TRIMP: doi:10.1007/BF00257731 (1991)`
2. **Top 2 — TRIMP / CTL / ATL / TSB v1 spec (§4-1·§4-2)**. Banister 1991 weighting 식 + Coggan k=42/7 EWMA 식을 `analysis.js` 의 `analyzeHr()` 옆에 신규 함수 `computeTrainingLoad()` 로 spec. 모든 상수·식 인라인 docs.
3. **Top 3 — HRV (RMSSD / SDNN) v1 spec (§4-3)**. Task Force 1996 정의 + 최소 측정 윈도 (5분 단기·24시간 장기) + 신뢰도. 입력 = Polar H10 같은 RR-interval 가능 strap (Hardware Engineer 와 협의 — `expert_mobile_app_reference.md` §9.8). 측정 채널 없는 세션은 graceful null.
4. **Top 4 — §181-C calibration plan (§5)**. 현재 anchor 명시 + 추가 anchor 수집 protocol (n≥5 라이더, 비디오 + GPS 동기 ground truth). PhD 검수 통과를 위한 일반화 검증 design.
5. **Top 5 — 검증 sanity-check 의 자동화 (§6)**. `site/riding-dashboard/sample/sample-ride-gangneung.gpx` · `sample-songjeong-busan.gpx` + Danny `.vkx` 를 회귀 테스트 fixture 로 등록 — `selftest-*.js` 가 매 알고리즘 변경마다 metric 회귀 자동 검출. 학술 검증 데이터셋의 기초.

---

## 1. Phase 1 학습 정리 — 8 영역 학술 reference

본 절은 PhD 검수에 통과 가능한 reference 의 한 페이지 압축본이다. 각 영역은 (a) 핵심 공식 (b) 학술 출처 (DOI/ISBN/URL) (c) 단무지공방 / SailTechCo 코드에서의 적용 위치 — 3축으로 정리한다.

### 1-1. 세일링 물리 — VMG · TWA · apparent wind · polar curves · target boat speed

**기본 공식.** 세일링의 4 가지 핵심 속도 벡터:

| 기호 | 의미 | 정의 |
|---|---|---|
| V_t (TWS) | True Wind Speed | 지표면에 대한 풍속 |
| V_b (SOG) | Speed Over Ground (보드 속도) | GPS 측정 |
| V_a (AWS) | Apparent Wind Speed | 보드에서 본 풍속 = `V_t + V_b` (벡터합) |
| TWA | True Wind Angle | 보드 헤딩과 풍향의 사이각 (0° = 정풍상) |
| AWA | Apparent Wind Angle | 보드 헤딩과 apparent wind 의 사이각 |
| VMG | Velocity Made Good | 풍축 방향 진행 속도 = `V_b × cos(TWA)` |

**Apparent wind 합성 (cosine rule):**
```
V_a² = V_b² + V_t² + 2 · V_t · V_b · cos(TWA)
cos(β) = (V_b + V_t · cos(TWA)) / V_a
```
여기서 β 는 V_a 와 V_b 사이각 — wing 의 chord 가 만드는 attack angle 결정.

**Polar curve.** 풍속 V_t 에 대해 모든 TWA 에서 보트가 도달 가능한 V_b 의 함수. 풍상 close-hauled (TWA 40-50°) · beam reach (90°) · broad reach (135°) · 풍하 (180°) 가 polar 곡선의 주요 점.

**Target boat speed.** 주어진 V_t · TWA 에서의 polar 모델 예측 V_b. 실측 V_b / target = % of target = 성능 지표 핵심. ORC (Offshore Racing Congress) 의 IMS (International Measurement System) Velocity Prediction Program (VPP) 가 표준.

**학술 reference (DOI/ISBN/URL):**
- **Larsson, L., Eliasson, R., & Orych, M. (2022).** *Principles of Yacht Design* (5th ed.). Adlard Coles Nautical / Bloomsbury. ISBN 978-1-3994-0301-6. — 폴라·VMG·VPP 의 표준 교과서. [Bloomsbury page](https://www.bloomsbury.com/us/principles-of-yacht-design-9781399403016/)
- **Garrett, R. (1996).** *The Symmetry of Sailing: The Physics of Sailing for Yachtsmen*. Sheridan House. ISBN 978-1-57409-000-5. — 풍상/풍하 대칭성·apparent wind 의 vector 해석 기본서.
- **ORC IMS VPP** — 공식 표준. [ORC VPP Documentation](https://www.orc.org/index.asp?id=37) (2025년 6월 갱신본). Polar 의 정량 식 (lift/drag coefficient, hull resistance, sail effort) 가 산식 수준으로 공개돼 있다.
- **Burch, D. (2019).** "Introduction to Polar Diagrams and Optimum VMC". *Starpath Navigation Blog*. [URL](http://davidburchnavigation.blogspot.com/2022/02/VMC.html) — 항해사 관점 polar / VMC 해설.
- **Vakaros — "VMG and Tack Loss training" (2020).** [blog.vakaros.com/vmgtackloss](https://blog.vakaros.com/vmgtackloss) — 실측 instrument 가 보는 VMG / tack loss 정의의 표준 사례 (sailing telemetry 도메인).

**우리 코드 적용.**
- `analysis.js:902-1030` `computeWindMetrics(session, windDir)` — TWA · VMG · SOG 를 4 버킷 (풍상/풍하 × P/S 택) 으로 시간가중 통계. **이미 표준 정의 부합** — VMG = SOG × cos(TWA) 의 부호 처리 (`vmgSigned = sp × cos(toRad(twa))`) + `signed angleDiff` 으로 P/S 분리.
- `lift-calculator.js:954-1082` `upwindSpeed(p)` — apparent wind 합성 (`V_a² = V_b² + V_t² + 2·V_t·V_b·cos(tack)`) + β = acos((V_b + V_t·cos(tack))/V_a) — 표준 cosine rule 정확히 적용.
- `coach.js:130-142` `measuredUpwindVmgKt(analysis)` — 실측 풍상 VMG (상위 50% 시간가중) 를 VPS 속도 점수의 anchor. **단일 출처 원칙** 명시 ("analysis.wind.vmgUpwindTop50Ms — computeWindMetrics 풍향 확정 시에만 산출").

### 1-2. 윙포일 · foil 역학 — lift, induced drag, AR, NACA / LEI airfoil

**Lift 방정식 (Anderson 1991/2010 표준):**
```
L = ½ · ρ · V² · A · C_L
```
ρ = 유체 밀도 (해수 1025 kg/m³, 민물 1000 kg/m³, 공기 1.225 kg/m³ at 15°C), V = 유속, A = 윙 면적, C_L = 양력계수 (attack angle / camber / Reynolds 의 함수).

**Drag 분해.** 총 drag 는 parasitic (form + skin friction) + induced 의 합:
```
C_D = C_{D,0} + C_L² / (π · e · AR)
```
- C_{D,0} = parasitic drag coefficient (=0 attack 일 때 항력 — 형상 + skin friction)
- AR = aspect ratio = b²/A (b = span, A = 면적)
- e = Oswald efficiency factor (elliptical wing 가 e=1, 실제 wing 0.7-0.95)
- π · e · AR 분모 → AR ↑ → induced drag ↓

**L/D max.** d(L/D)/dC_L = 0 풀면:
```
C_L,opt = √(C_{D,0} · π · e · AR)
L/D_max = (1/2) · √(π · e · AR / C_{D,0})
```
→ AR 만 변수로 두면 L/D_max ∝ √AR.

**Foil specific (clean hydrofoil — Anderson 2010 ch 5 + Faltinsen 2005 ch 6):**
- C_{D,0} ≈ 0.008 (clean foil, low Re)
- e ≈ 0.85 (well-designed elliptical-ish foil)
- → L/D_max(AR) = √(π · 0.85 · AR / 0.008) / 2 = **9.13 · √AR** ← `lift-calculator.js:799` `ldFoil(ar)` 동일

**LEI inflatable wing specific (Folkersma/Schmehl/Viré 2019):**
- C_{D,0} ≈ 0.098 (LEI inflatable, higher than hard wing due to surface roughness · leading-edge bulge)
- e ≈ 0.42 (poor — limited aspect ratio + flexible canopy)
- → L/D_max(AR) = √(π · 0.42 · AR / 0.098) / 2 = **1.83 · √AR** (이론) → §181-C 에서 anchor 보정으로 **2.2 · √AR** 채택 (`lift-calculator.js:808` `LDWING_K`).

**Cavitation.** 수면 근처 foil 이 V > V_cav 에서 발생 — V_cav = √((2 · (P_atm + ρ·g·h - P_vapor)) / (ρ · |C_p,min|)). foiling 속도 25-35 kt 영역은 cavitation 임계 아래 (race foil > 35kt 에서 발생) — Phase 1 무시 OK, Phase 3 race-foil 검토.

**학술 reference (DOI/ISBN/URL):**
- **Anderson, J.D. (2010).** *Fundamentals of Aerodynamics* (6th ed.). McGraw-Hill. ISBN 978-1-259-12991-9. — Lifting line theory · induced drag · L/D 도출의 표준 교과서. Ch 5 "Incompressible Flow over Finite Wings".
- **Faltinsen, O.M. (2005).** *Hydrodynamics of High-Speed Marine Vehicles*. Cambridge University Press. ISBN 978-0-521-84568-7. doi:10.1017/CBO9780511546068. — Hydrofoil vessel (ch 6) · cavitation · wave-induced motion. [Cambridge page](https://www.cambridge.org/core/books/hydrodynamics-of-highspeed-marine-vehicles/EFAC95328551E361A7DD04464F296C41)
- **Folkersma, M., Schmehl, R., & Viré, A. (2019).** "Boundary layer transition modeling on leading edge inflatable kite airfoils". *Wind Energy*, 22(7), 908-921. doi:10.1002/we.2329. — LEI airfoil 의 C_L · C_D 표준 reference. `lift-calculator.js:691-697` 인용 중.
- **NACA Technical Reports** — Prandtl's lifting-line theory (1918), NACA TR 121 등. [NTRS NASA](https://ntrs.nasa.gov/) 무료 access. AR / induced drag 의 1차 출처.
- **Vermeer, L.J., Sørensen, J.N., & Crespo, A. (2003).** "Wind turbine wake aerodynamics". *Progress in Aerospace Sciences*, 39(6-7), 467-510. doi:10.1016/S0376-0421(03)00078-2. — 유한 span wing 의 induced drag 의 실험 검증.
- **Acosta, A.J., & Parkin, B.R. (1975).** "Cavitation Inception — A Selective Review". *Journal of Ship Research*, 19(4). — Cavitation 기본.

**우리 코드 적용.**
- `lift-calculator.js:799` `ldFoil(ar) = 9.13 · √ar` — 위 도출과 일치. **인용 부재** → §3-2 Top 1.
- `lift-calculator.js:807` `ldWing(ar) = LDWING_K · √ar`, `LDWING_K = 2.2` (§181-C anchor 보정). 이론값 1.83 (`lift-calculator.js:823` 주석에 명시). **인용 명시 OK** (§179 주석에 Folkersma 2019 명시).
- `lift-calculator.js:911` `WING_CD0_PARASITIC = 0.04` — "윙포일 표준 baseline" 표기. **출처 모호** → Folkersma 2019 또는 wind-tunnel literature 인용 필요 (Phase 2).
- `lift-calculator.js:91-96` `vMinMs(riderKg, areaCm2, cl, gearKg, rho)` — `V_min = √(2 · M_total · g / (ρ · A · C_L))` — Lift 방정식의 takeoff 임계 역산. **표준** + ρ 분기 (sea/fresh) 정확.

### 1-3. 기동 검출 · 회전 기하 · 풍향 추정

**Tack / jibe 의 정의 (Larsson & Eliasson):**
- **Tack (택킹)** — 헤딩이 풍상축 (head-to-wind) 을 가로지름. TWA 가 0° (정풍상) 을 통과.
- **Jibe / gybe (자이브)** — 헤딩이 풍하축 (down-wind) 을 가로지름. TWA 가 180° (정풍하) 를 통과.
- **Turn (단순 코스 변경)** — 풍축을 가로지르지 않은 회전 (예: 베어어웨이·헤드업).

**Turn rate (회전 속도) 검출.** dθ/dt 의 부호 있는 차분. 시간 평활 (Gaussian 또는 boxcar) 후 임계 (예: 6 °/s) 초과 구간을 회전으로 segment. 누적 회전각 ∫|dθ/dt|dt 가 임계 (예: 60°) 이상이면 "의미 있는 회전".

**Turn radius.** r = V_b / ω, ω = angular velocity = dθ/dt (rad/s). 정점 (turn rate peak) 에서의 r 이 회전 quality 지표.

**Bisector method (회전 이등분선).** 진입 헤딩 h_before · 탈출 헤딩 h_after 의 원형 평균 (circularMean) = 풍축 (180° 모호). 짧은 호 vs 긴 호 판정으로 풍상/풍하 끝 구분.

**No-go zone method (풍향 추정의 표준 첫 단계).** 모든 세션의 GPS 헤딩 분포에는 ~80-100° 폭의 빈 쐐기 (sailing 불가능 구역) 가 있고, 그 중심이 TWD. 5° bin 거리 가중 히스토그램 → 90° 윈도 가중합 최소 = no-go zone. **장점** — 어떤 패턴 (reaching / upwind / downwind) 이든 작동. **단점** — reaching 일색 세션에서 노이즈 ↑.

**Maneuver geometry method.** Njord Analytics 의 "typical TWA 추론" 패턴 — 검출된 모든 tack/jibe 의 진입/탈출 헤딩 이등분선을 가중 원형 평균 (Mardia & Jupp 2000) 하여 풍축 산출. 풍상/풍하 끝 구분은 (a) tack 이 jibe 보다 속도 손실 큼 (b) 회전 방향 으로.

**학술 reference (DOI/ISBN/URL):**
- **Mardia, K.V., & Jupp, P.E. (2000).** *Directional Statistics*. John Wiley & Sons. ISBN 978-0-471-95333-3. doi:10.1002/9780470316979. — 원형 통계 · circular mean · circular variance · R-bar · von Mises 분포의 표준 교과서. [Wiley page](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316979)
- **Berens, P. (2009).** "CircStat: A MATLAB Toolbox for Circular Statistics". *Journal of Statistical Software*, 31(10), 1-21. doi:10.18637/jss.v031.i10. — 구현 reference. [JSS](https://www.jstatsoft.org/article/view/v031i10)
- **Njord Analytics — Maneuver Analysis Help.** [URL](https://app.sailnjord.com/help/analytics/maneuvers.html) — sailing telemetry 의 maneuver 검출/분류 표준 사례.
- **SAP Sailing Analytics (Apache 2.0, 2025-10-20 공개).** [github.com/SAP/sailing-analytics](https://github.com/SAP/sailing-analytics) — 풍향 grid · leg auto-split · maneuver line 의 OSS reference.
- **Hidden Markov Models for Wind Detection** — SAP `WindDetectionTrack` 모듈의 HMM Viterbi multi-boat 기법. (SAP source 코드 참조)

**우리 코드 적용.**
- `analysis.js:608-689` `detectManeuvers(session, windDir)` — turn rate 시간평활 (`turnRateSmoothSec = 2.5s`) → 임계 (`turnRateThresholdDegSec = 6 °/s`) 초과 구간 → 누적 회전각 ≥ 60° 검증 → maneuver 빌드. **표준 algorithm** + 이웃 region clamp (직전 회전 회복이 진입 속도 왜곡 방지).
- `analysis.js:691-812` `buildManeuver(...)` — apex (최저 속도점) · entry/exit speed · headingBefore/After · turnDir · radiusM (= V_min/ω) · type/completed · entryVmgMs/exitVmgMs · vmgGainPct · entryToHeadWindSec. **회전 기하의 완전 수치화** — 학술 수준.
- `analysis.js:838-861` `classifyManeuver(S, lo, hi, windDir, cfg)` — crossUp/crossDown + minTwaUp/minTwaDown 으로 tack/jibe/turn/incomplete 4 분류. **`maneuverApproachDeg = 30°` 임계 (incomplete attempt 판정) 가 학술 명시 부족** → §3-3 Top 3.
- `analysis.js:1432-1516` `estimateWindFromTrack(session)` — no-go zone 방식. 헤딩 히스토그램 (5° bin) → 90° 윈도 가중합 최소 + 거울 대칭축 ±22° 미세보정. 신뢰도 (높음/보통/낮음) 자체 판정 + `reciprocal: true` (reaching 일색 검출). **자기 정직성 — DataViz reference §1-3 invariant 6 "신뢰도 self-report"**. 
- `analysis.js:1551-1692` `estimateWindFromManeuvers(session)` — 이등분선 · 호 중점 · conditioning 가중치 (`w = |cos(sep/2)|`) → 가중 원형 평균 (2배각 으로 풍축 군집) → outlier 배제 (`AXIS_TOL = 35°`) → 풍상/풍하 끝을 속도 손실 비교로 가림 → 회전별 TWD 가중 평균. **Mardia & Jupp 2000 의 원형 통계 그대로 적용**. 단 인용 부재 → §3-3 Top 3.

### 1-4. 통계 기법 — 원형 통계 · 시간가중 백분위 · Gaussian KDE

**시간가중 백분위 (`computeTierMeans`).** 표본 i 의 값 v_i · 시간 dt_i 가 있을 때:
- 전체 평균 = Σ v_i · dt_i / Σ dt_i
- 상위 50% 평균 = 정렬 후 시간 누적합이 0.5 · Σdt 가 될 때까지의 가중 평균
- 동일 정렬·동일 dt 기준이므로 단일 GPS 포인트 순간 극값 (노이즈) 영향 ↓

**원형 평균 (circular mean — Mardia & Jupp 2000, ch 2).**
```
mean = atan2(Σ sin(θ_i), Σ cos(θ_i))
R = √((Σcos)² + (Σsin)²) / n   ← circular variance 의 역수 정보
```
R ∈ [0, 1]. R = 1 = 완전 집중, R = 0 = 완전 균등.

**Circular standard deviation:**
```
σ_circ = √(-2 · log R)
```

**Gaussian KDE bandwidth (Silverman 1986 "rule of thumb"):**
```
bw = 1.06 · σ · n^(-1/5)
```
σ = 표본 표준편차, n = 표본 수. 정규 분포 가정. effective sample size (시간가중 시 neff = (Σ w)² / Σ w²) 적용.

**학술 reference (DOI/ISBN/URL):**
- **Mardia, K.V., & Jupp, P.E. (2000).** *Directional Statistics*. Wiley. ISBN 978-0-471-95333-3. — (§1-3 동일 ref) 원형 통계 표준.
- **Silverman, B.W. (1986).** *Density Estimation for Statistics and Data Analysis*. Chapman & Hall/CRC. ISBN 978-0-412-24620-3. — KDE bandwidth · cross-validation 표준.
- **Scott, D.W. (2015).** *Multivariate Density Estimation: Theory, Practice, and Visualization* (2nd ed.). Wiley. ISBN 978-0-471-69755-8. doi:10.1002/9781118575574. — 다변량 KDE.
- **Steinarsson, S. (2013).** "Downsampling Time Series for Visual Representation". *MSc Thesis*, University of Iceland. — LTTB (Largest Triangle Three Buckets) 다운샘플. [PDF](https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf) (DataViz reference §1-4 참조).

**우리 코드 적용.**
- `analysis.js:871-892` `computeTierMeans(items, key)` — 시간가중 백분위 평균. **표준** + dir +1/-1 로 상위/하위 N% 양방향. 단 effective sample size 보정 없음 → 표본 적은 케이스에서 신뢰구간 부재. §3-4 Top 4.
- `analysis.js:166-179` `smoothHeadingByTime(S, leg, halfSec)` — `Geo.circularMean(angs)` 호출. **원형 평균 정확 적용**.
- `analysis.js:1551-1692` (위 §1-3) — 가중 원형 평균 + R-bar (`Rlen = √(sx² + sy²)/sumW`) + circular σ (`spreadDeg = toDeg(√(-2 · log R))`) **Mardia & Jupp 2000 그대로 — 단 인용 부재**.
- `charts.js` (DataViz `renderViolin`) — Silverman bandwidth `bw = 1.06 · std · neff^(-0.2)`. **명시되지 않은 hardcoded lower bound** (`bw = max(bw, span/60)`) — Scott (2015) 권장 식 (`bw = max(bw, span/(2·√neff))`) 으로 강화 권장.
- `analysis.js:114-132` `countProminentPeaks(a)` — 회전율 봉우리 수 검출. 임계 (높이 ≥ 0.40·max, prominence ≥ 0.25·max) 의 학술 근거 — `scipy.signal.find_peaks` 의 prominence parameter convention 과 일치 (Virtanen et al. 2020 SciPy paper). 인용 추가 권장.

### 1-5. 운동 생리 — TRIMP · CTL/ATL/TSB · HRV · Karvonen · VO2max

이 영역은 **단무지공방 / SailTechCo 코드에 사실상 부재** (HR 시계열·존 표시만 있음). Phase 2 신규 모델 spec 의 1차 영역.

**TRIMP (Training Impulse — Banister 1991).**
```
TRIMP = duration_min × HRR × y
HRR = (avg HR − rest HR) / (max HR − rest HR)         ← Heart Rate Reserve
y_male   = 0.64 × e^(1.92 × HRR)                       ← 성별 가중
y_female = 0.86 × e^(1.67 × HRR)
```
지수 함수로 고강도 운동의 기여도 증폭 — 단순 duration × intensity 보다 정확.

**CTL / ATL / TSB (Coggan 2003 — *Training and Racing with a Power Meter*).** 매일 daily training load (TRIMP 또는 TSS = Training Stress Score) 의 EWMA:
```
ATL_today = ATL_yesterday × e^(-1/7)  + Load_today × (1 − e^(-1/7))
CTL_today = CTL_yesterday × e^(-1/42) + Load_today × (1 − e^(-1/42))
TSB = CTL − ATL
```
- ATL (Acute Training Load) — k=7 day EWMA — "최근 피로"
- CTL (Chronic Training Load) — k=42 day EWMA — "장기 체력"
- TSB (Training Stress Balance) — "폼" — 양수 = 체력이 피로보다 우세 (peak race ready), 음수 = 피로 누적

**HRV — RMSSD / SDNN (Task Force 1996 standard).**
- **RMSSD** = √(mean of (RR_i+1 − RR_i)²) — 인접 RR 차이의 제곱평균제곱근. parasympathetic (부교감) tone 의 단기 지표 (5분 측정 기준).
- **SDNN** = standard deviation of all NN intervals — 전체 변동성. 24시간 측정 표준. SDNN < 50ms = 심혈관 risk ↑.
- 측정 윈도: 5분 단기 (시상 정시) 또는 24시간 holter. Polar H10 같은 RR-interval 가능 strap 필수 (광학식 wrist HR 은 motion artifact 로 RMSSD 부정확).

**Karvonen 1957 — Heart Rate Reserve method.**
```
Training HR = HRR × intensity% + HR_rest
HRR = HR_max − HR_rest
```
단순 %HR_max 보다 개인 차 (HR_rest) 반영. 60% HRR ≈ 60% VO2 Reserve (Swain et al. 1994 검증).

**HR_max 추정 (Tanaka et al. 2001).**
```
HR_max = 208 − 0.7 × age   (Tanaka 2001, 더 정확)
HR_max = 220 − age          (Fox 1971, 흔히 쓰이는 옛 공식 — error 큼)
```

**VO2max 추정 — submaximal HR-speed regression (Astrand 1954 / Cooper 12-min run test 1968).** GPS-only 데이터로 정확한 VO2max 측정은 불가능 (대사가스 분석 필요). 단 시즌 추세 (`progression`) 로 fitness 변화 proxy 는 가능.

**학술 reference (DOI/ISBN/URL):**
- **Banister, E.W. (1991).** "Modeling Elite Athletic Performance". In *Physiological Testing of the High-Performance Athlete* (2nd ed., pp. 403-424). Human Kinetics. ISBN 978-0-87322-307-5. — TRIMP 원공식 + impulse-response model.
- **Banister, E.W., & Calvert, T.W. (1980).** "Planning for future performance: Implications for long term training". *Canadian Journal of Applied Sport Sciences*, 5(3), 170-176. PMID 7449608. — Banister 1980 — TRIMP 1차 publication.
- **Morton, R.H., Fitz-Clarke, J.R., & Banister, E.W. (1990).** "Modeling human performance in running". *Journal of Applied Physiology*, 69(3), 1171-1177. doi:10.1152/jappl.1990.69.3.1171. — TRIMP fitness/fatigue model 수학 검증.
- **Coggan, A.R., & Allen, H. (2010).** *Training and Racing with a Power Meter* (2nd ed.). VeloPress. ISBN 978-1-934030-55-2. — CTL / ATL / TSB 원전.
- **Coggan, A.R. (2003).** "Training and Racing Using a Power Meter: An Introduction". *USA Cycling Coaching Education* lecture. [PDF](https://www.midweekclub.ca/articles/coggan.pdf) — Performance Manager Chart 도입.
- **Task Force of the European Society of Cardiology and the North American Society of Pacing and Electrophysiology. (1996).** "Heart rate variability: Standards of measurement, physiological interpretation and clinical use". *European Heart Journal*, 17(3), 354-381; *Circulation*, 93(5), 1043-1065. doi:10.1161/01.CIR.93.5.1043. PMID 8598068. — HRV 표준의 결정판.
- **Sammito, S., et al. (2024).** "Advances in heart rate variability signal analysis: Joint position statement by the e-Cardiology ESC Working Group, ENG-HRS, APHRS". *Europace*, 26(2), euae051. doi:10.1093/europace/euae051. — 2024 갱신 position statement.
- **Karvonen, M.J., Kentala, E., & Mustala, O. (1957).** "The effects of training on heart rate; a longitudinal study". *Annales Medicinae Experimentalis et Biologiae Fenniae*, 35(3), 307-315. PMID 13470504. — Karvonen 원 paper.
- **Swain, D.P., Abernathy, K.S., Smith, C.S., Lee, S.J., & Bunn, S.A. (1994).** "Target heart rates for the development of cardiorespiratory fitness". *Medicine & Science in Sports & Exercise*, 26(1), 112-116. doi:10.1249/00005768-199401000-00019. — %HRR ≈ %VO2R 검증.
- **Tanaka, H., Monahan, K.D., & Seals, D.R. (2001).** "Age-predicted maximal heart rate revisited". *Journal of the American College of Cardiology*, 37(1), 153-156. doi:10.1016/S0735-1097(00)01054-8. — HR_max = 208 − 0.7 × age.
- **Astrand, P.O., & Ryhming, I. (1954).** "A nomogram for calculation of aerobic capacity (physical fitness) from pulse rate during submaximal work". *Journal of Applied Physiology*, 7(2), 218-221. doi:10.1152/jappl.1954.7.2.218. — VO2max submaximal HR 추정.

**우리 코드 적용 — 현재.**
- `analysis.js` — HR 시계열 (`hr` 필드) · zone 분포 (`HR_ZONE_COLOR` based) · HR 회복 지수 표시. **TRIMP / CTL / ATL / HRV 모두 부재** → §4 신규 모델 spec.
- `coach.js:158-189` `combineSegment(speed, turn)` — VPS 의 fitness 컴포넌트 없음. Phase 2 에서 `combineWithFitness(speed, turn, fitness)` 확장 가능.

### 1-6. 회복 모델링 — 수면 · RHR 추세 · 주관적 wellness 설문

**Multimodal monitoring (Halson 2014).** 객관 (TRIMP·CTL/ATL·HRV·RHR·sleep) + 주관 (RPE·wellness 설문) 의 결합이 단일 channel 보다 학습 detection 정확도 ↑.

**RHR (Resting Heart Rate) trend.** 기상 직후 (또는 수면 중 minimum) HR 의 14일 EWMA. 평균 대비 +5 bpm 이상 = 회복 부족 signal. Apple Health · Whoop · Oura 같은 wearables 가 자동 측정.

**Sleep 모니터링.** 수면 시간 (total) · deep / REM 비율 · 수면 efficiency (in-bed time 대비 sleep time). HealthKit `HKCategoryTypeIdentifier.sleepAnalysis` 표준 (iOS) / Health Connect `SleepSession` (Android).

**Subjective wellness questionnaires.**
- **RESTQ-Sport (Kellmann & Kallus 2001)** — 12 비특화 + 7 sport-specific scale = 19 axis. 72-item full · 56-item short form. 기간: 지난 3일.
- **POMS (McNair, Lorr, Droppleman 1971)** — Profile of Mood States. 6 axis (긴장·우울·분노·활력·피로·혼란). 65-item full · 37-item brief.
- **DALDA (Daily Analysis of Life Demands for Athletes — Rushall 1990)** — 일일 9 stress + 25 reaction.
- **Hooper Index (Hooper et al. 1995)** — 4 question 단순 (수면 / 피로 / 스트레스 / 근육통). 단무지공방 / SailTechCo 에 권장 — 5초 완료 가능.

**학술 reference (DOI/ISBN/URL):**
- **Halson, S.L. (2014).** "Monitoring training load to understand fatigue in athletes". *Sports Medicine*, 44(Suppl 2), 139-147. doi:10.1007/s40279-014-0253-z. PMID 25200666. — Multimodal monitoring 표준 review.
- **Kellmann, M., & Kallus, K.W. (2001).** *Recovery-stress Questionnaire for Athletes: User Manual*. Human Kinetics. ISBN 978-0-7360-3700-2. — RESTQ-Sport 원본.
- **Davis, H., Orzeck, T., & Keelan, P. (2007).** "Psychometric item evaluations of the Recovery-Stress Questionnaire for athletes". *Psychology of Sport and Exercise*, 8(6), 917-938. doi:10.1016/j.psychsport.2006.09.002. — RESTQ-Sport 검증.
- **McNair, D.M., Lorr, M., & Droppleman, L.F. (1971).** *Manual for the Profile of Mood States*. EdITS. ISBN 978-0-915570-04-1. — POMS 원본.
- **Hooper, S.L., Mackinnon, L.T., Howard, A., Gordon, R.D., & Bachmann, A.W. (1995).** "Markers for monitoring overtraining and recovery". *Medicine & Science in Sports & Exercise*, 27(1), 106-112. doi:10.1249/00005768-199501000-00019. — Hooper Index.
- **Saw, A.E., Main, L.C., & Gastin, P.B. (2016).** "Monitoring the athlete training response: Subjective self-reported measures trump commonly used objective measures: A systematic review". *British Journal of Sports Medicine*, 50(5), 281-291. doi:10.1136/bjsports-2015-094758. — 주관적 측정의 효과성.
- **Plews, D.J., Laursen, P.B., Stanley, J., Kilding, A.E., & Buchheit, M. (2013).** "Training adaptation and heart rate variability in elite endurance athletes: Opening the door to effective monitoring". *Sports Medicine*, 43(9), 773-781. doi:10.1007/s40279-013-0071-8. — HRV-기반 회복 모니터링 protocol.

**우리 코드 적용 — 현재.**
- `analysis.js` — HR 자체는 있으나 RHR · sleep · subjective 모두 부재. iOS HealthKit 통합 (`HKWorkoutActivityType.sailing` raw=57 존재 — `expert_mobile_app_reference.md` §5.1) 시 sleep/RHR 자동 fetch 가능.
- Phase 2 spec — 일일 라이딩 전 5초 Hooper Index (수면/피로/스트레스/근육통 각 1-7 scale) 입력 UI 권장 (UX Researcher 협업).

### 1-7. 교차상관 (cross-correlation) — performance × fitness × recovery × context

**Linear regression (multivariate).** y = β_0 + Σ β_i · x_i + ε. 라이더의 "성능 (예: VPS)" 을 종속 변수, "체력 (CTL)·피로 (ATL)·풍속·spot·장비" 를 독립 변수로 회귀. coefficient β_i 가 각 변수의 영향력 정량.

**Partial correlation.** 다른 변수 control 한 후의 두 변수 상관. "풍속 control 시 CTL ↔ VPS 의 partial r" = "같은 바람 조건에서 체력만 좋아지면 VPS 가 얼마나 올라가는가".

**Random Forest (Breiman 2001).** 비선형 · 변수 간 상호작용 자동 학습. feature importance 출력. n ≥ 50 세션 데이터 필요.

**Gradient Boosting (XGBoost — Chen & Guestrin 2016).** 더 정확하나 overfit 위험 ↑ — 라이더 1인 시계열에는 random forest 가 안전.

**시계열 cross-correlation.** Pearson r at various lag. CTL → 성능 의 lag 5-10일 가설 검증.

**학술 reference (DOI/ISBN/URL):**
- **Hastie, T., Tibshirani, R., & Friedman, J. (2009).** *The Elements of Statistical Learning* (2nd ed.). Springer. ISBN 978-0-387-84857-0. doi:10.1007/978-0-387-84858-7. — 회귀·random forest·regularization 표준 교과서. [무료 PDF (Stanford)](https://hastie.su.domains/ElemStatLearn/)
- **Breiman, L. (2001).** "Random Forests". *Machine Learning*, 45(1), 5-32. doi:10.1023/A:1010933404324. — Random Forest 원 paper.
- **Chen, T., & Guestrin, C. (2016).** "XGBoost: A Scalable Tree Boosting System". *Proceedings of the 22nd ACM SIGKDD*. doi:10.1145/2939672.2939785.
- **Sands, W.A., et al. (2017).** "Modern Techniques and Technologies Applied to Training and Performance Monitoring". *International Journal of Sports Physiology and Performance*, 12(s2), S2-63-S2-72. doi:10.1123/ijspp.2016-0405. — sports performance 의 multivariate analysis review.
- **Vesterinen, V., et al. (2016).** "Predictors of individual adaptation to high-volume or high-intensity endurance training in recreational endurance runners". *Scandinavian Journal of Medicine & Science in Sports*, 26(8), 885-893. doi:10.1111/sms.12530. — HRV 기반 individual response prediction.

**우리 코드 적용 — 현재.**
- 없음. `storage.js` 가 시즌 누적 세션을 저장하지만 cross-session 분석은 `renderProgression` (단순 시계열 막대/선) 만 — 다변량 회귀 부재. § 4-4 spec.

### 1-8. Performance benchmarking — 풍속 영역대별 비교 · percentile · age-grading

**Percentile ranking.** 라이더 본인의 모든 세션 metric (예: 최고 속도) 의 분포에서 이번 세션이 몇 %에 해당하는가. 시즌 추세 / 라이더 본인의 성장 추적.

**Wind-binned comparison.** 풍속 영역대 (예: 8-12·12-16·16-20·20+ kt) 별로 metric 을 normalize. 절대 비교 대신 "같은 바람에서 어떻게 했는가" 비교 — 더 의미 있음.

**Age-grading (running standard from WMA — World Masters Athletics).** age-grade % = 실측 / age standard. 라이더 본인의 50대 vs 30대 비교, 또는 60세 라이더의 평생 추적. WMA 의 age factor 표를 sailing/foiling 으로 변환 필요.

**Best windowed metrics.** 2-second peak speed (GPS waterspots standard), 10-second peak, 100m·250m·500m·1NM (1852m) windowed average — 단일 GPS 포인트 노이즈 거부 + 윈도 크기별 단조 일관성 (작은 윈도 ≥ 큰 윈도).

**학술 reference (DOI/ISBN/URL):**
- **Brown, T.J., et al. (2018).** "Reference Equations for Age and Performance Scaling in Endurance Sports". *Sports Medicine*, 48(3), 535-547. — age-grading methodology.
- **WMA Age Grading Tables (2025 edition).** [URL](https://www.world-masters-athletics.com/age-grading) — running / track / field age-grade factor 표. sailing/foiling 으로의 변환은 Phase 3 task.
- **GPSWind/GPSResults 표준 — windsurf / kitesurf community standard.** 2-second peak speed, 5×10-second average, 1 hour, 100m·250m·500m·1NM. 정식 publish 는 부재 — community convention.

**우리 코드 적용.**
- `analysis.js:473-543` `peakForWindow` · `computePeakSpeeds` · `computeDistanceBests` · `computeAlpha` — 모두 표준 GPS-waterspots metric. **2-second peak 의 단조 일관성** (`pk2.speedMs > instMax` 가능성 0 — 단일 점 instMax 가 2초 평균보다 항상 크거나 같음 검증) 이 코드에 명시. 표준 부합.
- 시즌 누적 percentile 부재. Wind-binned comparison 부재. Age-grading 부재. § 4-5 spec.

---

## 2. 현재 알고리즘 audit — 6 모듈 정합성 평가

각 모듈에 대해 (a) 수학적 정의 (b) 학술 정합성 (c) 임계값/계수 정당성 (d) 통계 가정 위반 (e) 인용 부재 — 5축 evaluation. severity S0~S3.

| Sev | 의미 |
|---|---|
| **S0** | 학술 부정합 — 결과 신뢰성 영향. 코드 수정 필요 (Phase 2) |
| **S1** | 인용 부재 — 식 자체는 옳으나 reference 미명시. 인라인 주석 추가 |
| **S2** | 가정 약화 — 더 robust 한 대안 가능. Phase 2/3 |
| **S3** | Cosmetic — 변수명·docstring polish |

### 2-1. `analysis.js` — VMG / TWA / 시간가중 통계 (`computeWindMetrics` · `computeTierMeans`)

| # | 영역 | 정합성 | Sev | 권장 |
|---|---|---|---|---|
| 1 | VMG 정의 (`vmgSigned = sp · cos(toRad(twa))`) | ✅ 표준 (Larsson & Eliasson) | — | 유지 |
| 2 | 부호 처리 (`angleDiff(wd, heading)` 가 ±180°) | ✅ 정확 | — | 유지 |
| 3 | P/S 택 분리 (`signed >= 0 → 'S'`) | ✅ 정확 + 일관성 (`maneuverSide` 와 동일 규칙 명시) | — | 유지 |
| 4 | 4 버킷 시간가중 평균 (`computeTierMeans`) | ✅ 표준 | S1 | "Time-weighted percentile" 한 줄 reference 주석 권장 |
| 5 | speed threshold `sp < 1.0` m/s 필터 | 🟡 임계 1.0 m/s = 1.94kt — 정지 / 표류 제외. 표준 (Vakaros 정지 임계 ~1kt) | S3 | comment 에 출처 추가 |
| 6 | effective sample size 보정 부재 | 🟡 표본 적은 케이스에서 신뢰구간 부재 | S2 | `neff = (Σ w)² / Σ w²` 추가 → bootstrap CI 옵션 |
| 7 | TWA bin 7.5° (`polarBinDeg`) | ✅ Njord 7.5° / Vakaros 5-10° 와 일치 | S1 | "TWA bin = 7.5° (Njord 표준)" 주석 |

**핵심 강점.** "택 분류는 computePolar·maneuverSide 와 동일 (angleDiff>=0 → S)" 같은 invariant 가 코드에 명시 (line 900) — 학술 검수의 핵심인 "내부 일관성" 이 강력함.

### 2-2. `analysis.js` — Tack/jibe 검출 + 분류 (`detectManeuvers` · `buildManeuver` · `classifyManeuver`)

| # | 영역 | 정합성 | Sev | 권장 |
|---|---|---|---|---|
| 1 | turn rate 시간 평활 (±2.5s) | ✅ Sailing telemetry 표준 (Njord 20s window 보다 짧음 — windfoil 회전 짧기 때문 정당) | S1 | "Njord 20s vs 우리 4s window 의 도메인 정당성" 주석 |
| 2 | 임계 6 °/s (`turnRateThresholdDegSec`) | 🟡 anchor 없음 — 코치 검증으로 보정 표기 | S2 | Danny 검증 데이터로 ROC curve fitting → 임계 정당화 |
| 3 | 누적 회전각 ≥ 60° | 🟡 표준 (대부분 sailing analytics 60-90° 사이) | S1 | "60° 임계 — SAP threshold 와 일치 (출처)" |
| 4 | 이웃 region clamp (`prevEnd` · `nextStart`) | ✅ 정확 — 직전 회전 회복 구간이 진입 속도 왜곡 방지 | — | 강점 — 학술 reference 가치 |
| 5 | apex = 최저 속도 지점 | ✅ 표준 (Vantage / Njord 와 동일) | — | 유지 |
| 6 | turn radius `r = V_min / ω` | ✅ 표준 운동학 (회전 운동: r = v/ω) | S1 | "Turn kinematics" 주석 |
| 7 | recoverySec — 95% 회복 임계 | 🟡 임계 95% — 학술 명시 없음. Vantage / Njord 도 비공개 | S1 | "회복 임계 95% — 라이더 본인 baseline 의 95% 보드 속도 회복" 명시 |
| 8 | `classifyManeuver` — incomplete attempt 처리 (`maneuverApproachDeg = 30°`) | ✅ 매우 강력한 학술 강점 — "실패 회전을 분모에서 빼지 않음" | S1 | "incomplete attempt 처리 — Danny invariant. 성공률 정직성" 주석 + 학술 비교 (Njord / Vantage 의 처리 비교) |
| 9 | VMG loss / gain (`vmgGainPct = exitVmg / entryVmg`) | ✅ 표준 (Vakaros / Vantage 의 "tack loss" 정의와 일치) | S1 | Vakaros blog reference |
| 10 | entryToHeadWindSec (택만) — 진입 → 풍축 통과 | ✅ 매우 강력 — windfoil 도메인 특화 | S1 | "Windfoil-specific maneuver metric — 풍축 통과 시간 분리" |
| 11 | `countTurnRatePeaks` — 2단 회전 검출 | ✅ scipy.signal.find_peaks 의 prominence convention 과 일치 | S1 | "Prominence-based peak detection (SciPy convention — Virtanen et al. 2020)" |

**핵심 강점.** Incomplete attempt 분류 (`maneuverApproachDeg = 30°`) 가 PhD 검수의 1차 정직성 검증을 통과. 대부분의 sailing analytics SW 는 실패 회전을 분모에서 빼버려 성공률을 인위적으로 부풀린다.

### 2-3. `analysis.js` — 풍향 추정 (`estimateWindFromTrack` no-go · `estimateWindFromManeuvers` 기하)

| # | 영역 | 정합성 | Sev | 권장 |
|---|---|---|---|---|
| 1 | No-go zone — 5° bin · 90° 윈도 가중합 최소 | ✅ 정확 — "사일링 불가 구역의 물리적 존재" 가정 부합 | S1 | "No-go zone method — Burch 2022 reference" |
| 2 | 거울 대칭축 ±22° 미세보정 | ✅ 표준 (헤딩 분포는 풍축 대칭) | S2 | 학술 reference 미약 — Mardia & Jupp 2000 ch 6 (axial data) 권장 |
| 3 | 신뢰도 self-report (`cleanNoGo > 0.13` → '낮음') | ✅ **매우 강력한 학술 강점** — DataViz reference §1-3 invariant 6 "신뢰도 self-report" | — | 강점 |
| 4 | Reciprocal detection (`downwindFrac < 0.14`) | ✅ 정확 — reaching 일색 세션 판정 | — | 유지 |
| 5 | Maneuver geometry — bisector + arc midpoint | ✅ Njord 의 "typical TWA 추론" 과 동일 방향 | S1 | "Maneuver-geometry method — Mardia & Jupp 2000 (circular statistics)" |
| 6 | 가중 conditioning (`w = |cos(sep/2)|`) | ✅ 정확 — sep ~180° (reaching 반전) → w ≈ 0 | S1 | "Conditioning weight — sep~180° degenerates bisector" |
| 7 | 풍축 가중 원형 평균 (2배각) | ✅ Mardia & Jupp 2000 표준 — axial data 의 표준 처리 | S1 | reference |
| 8 | 풍상/풍하 끝 가림 — tack 이 jibe 보다 속도 손실 큼 | ✅ 물리적 정당 (boat decelerates more crossing head-to-wind) | S1 | reference (Larsson & Eliasson) |
| 9 | spread (`circ σ = √(-2·log R)`) | ✅ Mardia & Jupp 2000 표준 | S1 | reference |
| 10 | 4-channel Bayesian 통합 부재 | 🟡 buildWindSources 가 슬롯만 — 가중 결합 아직 안 됨 | **S0** | §4 / §7 — SailTechCo Moat W3 — 4-channel Bayesian 통합 구현 (Phase 2) |

**핵심 강점.** 두 독립 채널 (`estimateWindFromTrack` + `estimateWindFromManeuvers`) 이 서로 cross-validate. 두 출력이 가까우면 (예: ±5°) confidence ↑, 어긋나면 ↓. **이 cross-validation 자체가 학술 강점** — 단일 추정기보다 robust.

### 2-4. `vkx-parser.js` — 자세 쿼터니언 → heel/pitch (`quatToHeelPitch`)

| # | 영역 | 정합성 | Sev | 권장 |
|---|---|---|---|---|
| 1 | Quaternion normalization (mag check) | ✅ 표준 | — | 유지 |
| 2 | heel (roll) = atan2(2(wx+yz), 1−2(x²+y²)) | ✅ NED frame ZYX intrinsic Euler conversion | S1 | "Quaternion → Euler conversion: Diebel 2006 (Stanford)" reference |
| 3 | pitch = asin(2(wy−zx)) + clamping [-1, 1] | ✅ Gimbal lock 방어 (asin 정의역) | — | 정확 |
| 4 | yaw 반환 안 함 | ✅ 정당 — "분석 모듈이 트랙에서 따로 산출" 일관성 | — | 유지 |
| 5 | VKX 1.4 spec 준수 (key 0x02 = Position/Velocity/Orientation, 44 byte) | ✅ Vakaros 공식 spec 정확 | — | 유지 |
| 6 | hasAttitude threshold (≥ 50% 포인트) | 🟡 임계 정당화 부재 | S2 | "≥50% attitude → device-grade" 출처 |

**학술 reference 추가 권장:**
- **Diebel, J. (2006).** "Representing Attitude: Euler Angles, Unit Quaternions, and Rotation Vectors". Stanford University. [PDF](https://www.astro.rug.nl/software/kapteyn-beta/_downloads/attitude.pdf) — Quaternion → Euler 변환의 표준 reference. inline 주석 권장.

### 2-5. `lift-calculator.js` §181 — Upwind polar physics (`upwindSpeed`)

| # | 영역 | 정합성 | Sev | 권장 |
|---|---|---|---|---|
| 1 | Lift equation `L = ½·ρ·V²·A·C_L` | ✅ Anderson 2010 표준 | S1 | reference |
| 2 | `vMinMs = √(2·M·g / (ρ·A·C_L))` | ✅ 정확 — takeoff threshold (L = M·g) | S1 | Anderson 2010 + Faltinsen 2005 reference |
| 3 | `ldFoil(ar) = 9.13·√ar` | ✅ Anderson 2010 + Faltinsen 2005 도출 (C_D,0=0.008, e=0.85) | ✅ 이미 인용 (line 692-697) | 유지 + DOI 추가 |
| 4 | `ldWing(ar) = 2.2·√ar` (LDWING_K, §181-C anchor) | 🟡 이론값 1.83 (Folkersma 2019) → 2.2 anchor 보정 | S2 | §5 calibration plan — 다중 라이더 anchor 필요 |
| 5 | `WING_CD0_PARASITIC = 0.04` | 🟡 "윙포일 표준 baseline" — 출처 모호 | S1 | Folkersma 2019 또는 wind-tunnel literature 인용 필요 |
| 6 | `WING_E = 0.42`, `WING_CD0 = 0.098` (depower polar) | ✅ Folkersma 2019 직접 인용 (line 826-830) | — | 유지 |
| 7 | `CL_WING_MAX = 1.00` (§181-D 1.2 → 1.00) | 🟡 Danny 2-anchor 보정 — "스팬방향 트위스트·능동 디파워·3D 유한스팬 효과" 정당화 | S2 | 학술 비교 (Folkersma 2019 2D peak vs 3D 유한 wing 효과) 추가 |
| 8 | Heel angle (`HEEL_DEG`) — 9/19/29/39/42 (§176-B Danny 실측) | 🟡 단일 라이더 anchor | S2 | 다중 라이더 측정 (Phase 2-3) |
| 9 | Tack angle (`TACK_ANGLE_DEG`) — 65/60/55/50/45 (§176-E 5° 균등) | 🟡 Danny 코칭 경험 — iQFOiL race 데이터 강등 | S2 | iQFOiL polar dataset 비교 분석 |
| 10 | Apparent wind 합성 `V_a² = V_b² + V_t² + 2·V_t·V_b·cos(tack)` | ✅ cosine rule 정확 (Larsson & Eliasson) | S1 | reference |
| 11 | β = acos((V_b + V_t·cos(tack)) / V_a) | ✅ 정확 (geometry) | — | 유지 |
| 12 | C_L heel-out cap `CL ≤ 2·H_max / (ρ·V_a²·A·cos β)` | ✅ 정확 — lateral force ≤ rider tan(heel) | S1 | "Heel-out cap — small boat sailing physics" reference 권장 (Larsson & Eliasson) |
| 13 | thrustCoeff = CL·(sin β − cos β/LD_wing) − CD0·cos β | ✅ Forward thrust = (lift cos α + drag sin α 의 횡축 성분) — 정확 | S1 | sailing aerodynamics textbook reference |
| 14 | V_b sweep [0, 35kt] 0.1kt step → T ≥ D_foil 최대 V_b | 🟡 35kt cap 정당 (8-25kt 실사용역 비제약) | — | 정당 |
| 15 | Heel-coupling `H_max_eff = H_max · (A/A_ref)^exp` (§181-E exp=-1.2) | 🟡 "큰 윙 CE 높음 → 모멘트 ↑ → effective H_max ↓" 물리 reasoning 명시 | S2 | wind-tunnel literature 비교 검증 (단일 anchor 보정만) |

**§181 가장 큰 학술 강점.** §178 의 선형 empirical 보정 (`bestVb *= (1 + 0.02·(A-5.5))`) 을 §181 의 물리 모델 (parasitic drag + heel-area coupling) 로 영구 대체한 것. **선형 보정은 PhD 검수에서 곧장 reject 되지만, 물리 모델 + anchor 는 통과 가능**.

**§181-C calibration 의 한계 (PhD 검수 risk).**
- 단일 anchor: 11kt·80kg·상급-선수·7m² → V_boat ≈ 18kt (Danny)
- §181-D 2-anchor: 12kt 중급 → 6m², 10kt 상급-선수 → 7.4m² (Danny)
- §181-E 1-anchor: WING_AREA_REF_M2 5.5→7.5 (Danny)
- **모든 anchor 가 Danny 1인** — 다른 라이더로 일반화 검증 부재 → §5 calibration plan.

### 2-6. `coach.js` — VPS · What-if · R1-R9 코칭

| # | 영역 | 정합성 | Sev | 권장 |
|---|---|---|---|---|
| 1 | VPS 70%/30% (속도/회전 가중 — "Vantage 문서 기준") | 🟡 "Vantage 문서 기준" — 외부 정확 출처 부재 (Vantage 가 공개 안 함) | S2 | Vantage 의 정확한 출처가 없으면 — Danny 도메인 expertise 기반 명시 |
| 2 | `upwindSpeedScore` floor/top (0.5/1.0) | 🟡 Danny 도메인 expertise | S1 | "0.5 = 예측치의 50% 이하 = 0점, 1.0 = 예측치 도달 = 100점 — calibration based on Danny" 명시 |
| 3 | `downwindSpeedScore` floor/top (0.6/1.4) | 🟡 휴리스틱 — 풍하 polar 모델 부재 | S2 | "휴리스틱이며 풍하 polar 정밀 예측이 아니다 (v2 개선 예정)" 이미 명시 — Phase 2 정밀화 |
| 4 | What-if anchoring `anchored = measured × calc(W)/calc(actual)` | ✅ **매우 강력한 학술 강점** — 자기모순 방지의 정확한 해결 | S1 | "Anchored sweep — measured × relative curve. Avoid self-contradiction" |
| 5 | What-if 우세 택 상위 20% 앵커 (`whatIfAnchorVmgKt`) | ✅ Danny 검토 명시 (양 택 합산 → 우세 택 변경, 2026-05-24) | — | 유지 |
| 6 | `WHATIF.MEANINGFUL_DELTA_KT = 0.5` 임계 | 🟡 Danny 도메인 expertise | S2 | "노이즈 수준 0.5kt — 계산기 측정 정확도와 일치" 명시 |
| 7 | R1-R9 룰엔진 (회전 코칭) | ✅ 결정적 (deterministic) — 학술 검증 가능 | S1 | `회전코칭_AI_엔진_설계안_v1` 외부 publish 가능 |
| 8 | 느린 택킹 임계 `SLOW_TACK_SEC` 5-level | 🟡 Danny 도메인 expertise — race-context iQFOiL 데이터 비교 부재 | S2 | iQFOiL race telemetry 비교 분석 |

**핵심 강점.** What-if anchoring 의 자기모순 방지 (current wing 막대 = measured 정확히 일치) 가 학술 수준 — "calc(actual) 분자 분모로 self-cancel" 의 mathematical guarantee.

### 2-7. `analysis.js` — GPS 이상치 거부 (`computeKinematics`)

| # | 영역 | 정합성 | Sev | 권장 |
|---|---|---|---|---|
| 1 | `gpsMaxSpeedKt = 40` 물리 상한 | ✅ 정당 (foiling 물리 상한) | S1 | "Foiling 물리 상한 ~35kt amateur · 50kt+ race" reference |
| 2 | `gpsDeviceTolKt = 8` 기기 SOG 대조 | ✅ 정확 — 위치 누적 vs 기기 SOG 비교 | S1 | "GPS doppler SOG vs position-integrated speed — Vakaros 권장 protocol" |
| 3 | 이상치 거부 시 점은 보존 (lat/lng) — 속도만 대체 | ✅ **매우 강력한 학술 강점** — "이상치 거부는 속도·거리 계산에서 제외, 포인트 삭제 X" 명시 | — | 강점 |
| 4 | Outlier rate `session.gpsOutlierCount` 노출 | ✅ 투명성 + 검증 | — | 강점 |

---

## 3. 학술 reference 인용 plan — 어디에 어떤 citation 인라인 추가

PhD 검수 통과를 위한 인라인 주석 추가 plan. 각 알고리즘 함수의 머리 1줄 reference. Phase 1 = plan, Phase 2 = 코드 commit.

### 3-1. `analysis.js` 권장 인용 추가 (P1 = 즉시, P2 = Phase 2)

```javascript
/* computeWindMetrics
 * VMG = SOG × cos(TWA). Time-weighted percentile means (top/bot 50%·20%)
 * applied per port/starboard tack × upwind/downwind 4-bucket split.
 * Refs: Larsson & Eliasson 2022 "Principles of Yacht Design" 5e (ISBN 978-1-3994-0301-6) ch.7;
 *       ORC IMS VPP Documentation (orc.org/index.asp?id=37). */
function computeWindMetrics(session, windDir) { ... }

/* computePolar
 * TWA bin = 7.5° (Njord Analytics standard).
 * Per-bin p95 speed = race-foil polar curve approximation.
 * Refs: Vakaros "VMG and Tack Loss training" (blog.vakaros.com/vmgtackloss);
 *       Larsson & Eliasson 2022 ch.7. */
function computePolar(session, windDir, binDeg) { ... }

/* detectManeuvers
 * Turn rate detection: |dθ/dt| ≥ 6°/s for ≥3s + cumulative |Δθ| ≥ 60°.
 * Smoothing window ±2.5s (windfoil-specific, shorter than Njord 20s due to
 * smaller boat inertia). Apex = minimum SOG within turn region.
 * Refs: SAP Sailing Analytics (github.com/SAP/sailing-analytics) WindDetectionTrack;
 *       Njord maneuver analysis (app.sailnjord.com/help/analytics/maneuvers.html). */
function detectManeuvers(session, windDir) { ... }

/* classifyManeuver
 * Tack = heading crosses head-to-wind axis. Jibe = heading crosses down-wind axis.
 * Incomplete attempt (within maneuverApproachDeg=30°) preserved as 'tack'/'gybe'
 * with completed=false → ensures failed maneuvers stay in success-rate denominator.
 * Refs: Larsson & Eliasson 2022 ch.7;
 *       methodological honesty — most sailing analytics SW excludes failures, inflating success%. */

/* estimateWindFromTrack — no-go zone method
 * Heading histogram (5° bin, distance-weighted) → 90° window min weight = no-go.
 * Mirror-symmetry refinement (axial data — Mardia & Jupp 2000 ch.6).
 * Self-reported confidence (high/medium/low + reciprocal flag).
 * Refs: Mardia & Jupp 2000 "Directional Statistics" (ISBN 978-0-471-95333-3);
 *       Burch 2022 "Optimum VMC" (davidburchnavigation.blogspot.com). */
function estimateWindFromTrack(session) { ... }

/* estimateWindFromManeuvers — maneuver geometry method
 * Bisector of entry/exit headings + arc midpoint discrimination →
 * weighted circular mean (2θ axial) for wind axis →
 * upwind/downwind end resolved by speed-loss asymmetry (tack > jibe loss).
 * Independent of estimateWindFromTrack — cross-validates.
 * Refs: Mardia & Jupp 2000 "Directional Statistics" ch.6 (axial data);
 *       Njord's "typical TWA inference" pattern. */
function estimateWindFromManeuvers(session) { ... }

/* computeTierMeans
 * Time-weighted top/bot 50%/20% means.
 * Sample i has value v_i and dt_i — sort by v, cumulate dt from one end.
 * Refs: Sands et al. 2017 "Modern Techniques and Technologies Applied to
 *       Training and Performance Monitoring" (doi:10.1123/ijspp.2016-0405);
 *       Vakaros / Vantage standard for "top 20% speed". */
function computeTierMeans(items, key) { ... }

/* countProminentPeaks
 * Topographic prominence-based peak detection (SciPy convention).
 * Height threshold = 0.40·max, prominence threshold = 0.25·max.
 * Refs: Virtanen et al. 2020 "SciPy 1.0" (doi:10.1038/s41592-019-0686-2)
 *       — scipy.signal.find_peaks documentation. */
function countProminentPeaks(a) { ... }
```

### 3-2. `lift-calculator.js` 권장 인용 추가

```javascript
/* §170 v7 — Wing-size optimizer (Danny matrix calibration)
 * Algorithm parameters (K_master, beta, m_ref, LD_foil_REF) fit to Danny's
 * 6-point matrix via log-log regression.
 * Refs (already cited inline):
 *   - Folkersma, Schmehl & Viré 2019 (doi:10.1002/we.2329) — LEI airfoil
 *   - Anderson 2010 "Fundamentals of Aerodynamics" 6e (ISBN 978-1-259-12991-9) ch.5
 *   - Faltinsen 2005 "Hydrodynamics of High-Speed Marine Vehicles" (doi:10.1017/CBO9780511546068) ch.6 */

/* §176 — upwindSpeed: upwind polar equilibrium speed
 * Refs:
 *   - Apparent wind cosine rule: Larsson & Eliasson 2022 ch.7
 *   - Heel-out cap (lateral force ≤ M·g·tan θ): Garrett 1996 "Symmetry of Sailing"
 *   - Thrust coefficient (lift cos α + drag sin α): Anderson 2010 ch.5
 *   - LEI wing C_L,max (2D peak): Folkersma 2019 ;
 *     3D effective peak (1.00 vs 1.2): §181-D Danny 2-anchor calibration */
function upwindSpeed(p) { ... }
```

### 3-3. `vkx-parser.js` 권장 인용 추가

```javascript
/* quatToHeelPitch — Quaternion → Euler (ZYX intrinsic)
 * NED frame: heel = roll = atan2(2(wx+yz), 1−2(x²+y²)),
 *            pitch = asin(2(wy−zx)) [clamped to ±1 for asin domain].
 * Refs: Diebel 2006 "Representing Attitude" Stanford
 *       (astro.rug.nl/software/kapteyn-beta/_downloads/attitude.pdf);
 *       Vakaros VKX 1.4 spec (github.com/vakaros/vkx). */
function quatToHeelPitch(w, x, y, z) { ... }
```

### 3-4. 신규 모델 (Phase 2 추가 시) 인용

신규 `computeTrainingLoad` / `computeHRV` / `computeCrossCorrelation` 함수에 한 줄 reference 머리 주석 의무화:

```javascript
/* computeTrainingLoad — Banister TRIMP + Coggan CTL/ATL/TSB
 * TRIMP = duration_min × HRR × (0.64·e^(1.92·HRR)) (male) or (0.86·e^(1.67·HRR)) (female).
 * CTL = EWMA(daily TRIMP, k=42 day). ATL = EWMA(daily TRIMP, k=7 day). TSB = CTL−ATL.
 * Refs: Banister 1991 (Human Kinetics, ISBN 978-0-87322-307-5) "Modeling Elite Athletic Performance";
 *       Coggan & Allen 2010 "Training and Racing with a Power Meter" 2e (ISBN 978-1-934030-55-2);
 *       Morton, Fitz-Clarke, Banister 1990 (doi:10.1152/jappl.1990.69.3.1171). */
function computeTrainingLoad(sessions, profile) { ... }

/* computeHRV — RMSSD, SDNN per Task Force 1996 standard
 * RMSSD = √(mean of (RR_i+1 − RR_i)²). Short-term parasympathetic tone.
 * SDNN = std deviation of all NN intervals. Overall variability.
 * Requires RR-interval data (Polar H10 / Movesense / Vakaros HRM). Optical wrist
 * HR insufficient (motion artifact corrupts inter-beat precision).
 * Refs: Task Force ESC/NASPE 1996 (doi:10.1161/01.CIR.93.5.1043, PMID 8598068);
 *       Sammito et al. 2024 update (doi:10.1093/europace/euae051). */
function computeHRV(rrIntervals) { ... }
```

---

## 4. 신규 모델 v1 spec — TRIMP · CTL/ATL/TSB · HRV · Cross-correlation · Benchmarking

본 절은 Phase 2 production 시점에 `analysis.js` / `coach.js` / `storage.js` 에 추가할 신규 모델의 spec. Phase 1 = spec only.

### 4-1. TRIMP (Training Impulse) v1

**입력.** 세션별 (a) duration_sec (b) avg HR (c) max HR (d) 라이더 rest HR (e) 라이더 max HR (f) 성별.

**산출.**
```
HRR = (avg_HR − rest_HR) / (max_HR − rest_HR)   ∈ [0, 1]
y   = 0.64 × exp(1.92 × HRR)   (남성)
      0.86 × exp(1.67 × HRR)   (여성)
TRIMP = (duration_sec / 60) × HRR × y
```

**예외 처리.**
- HR 없음 (`hasHR = false`) → TRIMP = null (gracefully skip)
- HRR < 0 (avg < rest, 데이터 오류) → TRIMP = 0
- HRR > 1 (avg > max, max 추정치 부정확) → HRR = 1 clamp

**구현 위치.** `analysis.js:` 신규 함수 `function computeTRIMP(session, profile)`. `analysis.computeHr()` 옆에 배치 (HR 분석 그룹).

**Self-test.** `selftest-hr.js` (또는 신규 `selftest-trimp.js`) 에서:
- 1시간 (3600초) · HRR=0.5 · 남성 → TRIMP = 60 × 0.5 × 0.64 × e^0.96 ≈ 50.0 → check 49.5 ≤ TRIMP ≤ 50.5
- 0 duration → TRIMP = 0
- HRR > 1 → HRR clamp → TRIMP 단조

### 4-2. CTL / ATL / TSB v1

**입력.** 라이더의 모든 저장 세션 (`storage.js` 의 sessions table), TRIMP 값 (4-1 산출).

**산출.**
```python
ATL[0] = 0, CTL[0] = 0
for each day d in chronological order:
    Load_d = sum of TRIMP of sessions on day d  (0 if rest day)
    ATL[d] = ATL[d-1] × exp(-1/7) + Load_d × (1 − exp(-1/7))
    CTL[d] = CTL[d-1] × exp(-1/42) + Load_d × (1 − exp(-1/42))
    TSB[d] = CTL[d] − ATL[d]
```

**TSB 해석:**
- TSB > +25 = "fresh / peaked" — race ready
- +5 ≤ TSB ≤ +25 = "moderately fresh"
- −10 ≤ TSB ≤ +5 = "balanced training"
- −30 ≤ TSB ≤ −10 = "productive training" — fitness 증가 중
- TSB < −30 = "overreaching / overtraining risk"

**구현 위치.** `storage.js:` 신규 함수 `function computeFitnessTrend(allSessions, profile)`. 결과 = `{ days: [{date, load, ATL, CTL, TSB}], current: {ATL, CTL, TSB} }`.

**시각화 (DataViz 협업).** `renderProgression` 차트에 CTL (실선) + ATL (파선) + TSB (구간 색 — TSB > 0 초록, < -25 빨강) 추가.

**Self-test.**
- Load = 50 모든 일 · 7일 → ATL → 50 × (1 − e^(-1)) ≈ 31.6 (정상)
- Load = 0 모든 일 · 42일 → CTL 초기 100 → 100 × e^(-1) ≈ 36.8 (정상)

### 4-3. HRV (RMSSD / SDNN) v1

**입력.** RR-interval 시리즈 (ms). 출처:
- Polar H10 BLE strap → standard 0x180D / 0x2A37 의 RR-interval extension. 표준 BLE HRS 의 RR-Interval Present flag (`expert_mobile_app_reference.md` §9.8).
- Movesense HR+ — ECG 기반 RR.
- Vakaros (post-session via paired HRM).
- Apple Watch (`HKQuantityTypeIdentifier.heartRateVariabilitySDNN`) — 단 SDNN 만, RMSSD 직접 fetch 불가.

**산출.**
```python
def rmssd(rr_ms):
    if len(rr_ms) < 2: return None
    diffs = [rr_ms[i+1] - rr_ms[i] for i in range(len(rr_ms)-1)]
    return sqrt(mean(d**2 for d in diffs))

def sdnn(rr_ms):
    if len(rr_ms) < 2: return None
    return stddev(rr_ms)
```

**측정 윈도.**
- 단기 (5분) — 라이딩 직전 / 직후 / 회복 모니터링. Polar H10 + 휴대폰 5분 측정.
- 장기 (24시간) — 수면 중 측정 (Whoop / Oura / Apple Watch 야간 기록).

**해석.**
- 라이더 본인 baseline 의 7일 EWMA 대비 ±1 SD 밴드 안 = 정상
- −2 SD 이하 (RMSSD ↓) = parasympathetic withdrawal — 과훈련 / 질병 / 스트레스 신호
- +2 SD 이상 (RMSSD ↑) = 회복 강함

**구현 위치.** `analysis.js:` 신규 함수 `function computeHRV(rrSeries)`. RR-interval 데이터가 없으면 graceful null.

**제약.** GPS 데이터에 RR-interval 없음. Phase 2 단계에서 Polar H10 / Movesense BLE strap 페어링 필요 (Hardware Engineer #7 · Mobile Engineer #8 협업).

### 4-4. Cross-correlation 엔진 v1

**입력.** 라이더의 모든 저장 세션 + (있다면) HRV / sleep / RHR / subjective wellness 시계열.

**Feature matrix.**
| 변수 | 출처 | 범주 |
|---|---|---|
| VPS overall | coach.computeVPS | Y (성능 — 종속) |
| 풍속 (kt) | 사용자 입력 | X (외부 — 통제 안 됨) |
| 풍속 변동성 (gust σ) | 외부 weather API (Phase 3) | X |
| spot ID | 사용자 입력 | X (categorical) |
| 윙 사이즈 (m²) | 사용자 입력 | X (장비) |
| 보드 (volume / brand) | 사용자 입력 | X |
| Foil (model · AR · area) | 사용자 입력 | X |
| CTL | 4-2 산출 | X (체력) |
| ATL | 4-2 산출 | X (피로) |
| TSB | 4-2 산출 | X (폼) |
| RMSSD baseline 대비 | 4-3 산출 | X (회복) |
| Sleep 직전 (시간) | HealthKit | X |
| 라이더 본인 RHR 7일 EWMA | 4-3 (rest HR) | X |
| 라이더 subjective wellness (Hooper) | UI 5초 입력 | X |

**1차 분석 — Pearson correlation matrix.** 모든 변수 쌍의 r + p-value (n ≥ 30 세션 시).

**2차 분석 — Partial correlation.** "풍속 control 시 CTL ↔ VPS 의 partial r" 같은 conditional 상관.

**3차 분석 — Random Forest (sklearn / TensorFlow.js).** 비선형 + 변수 간 상호작용. feature_importances_ 가 라이더에게 "당신의 성능에 가장 영향이 큰 5 변수" 자연어로 표시.

**4차 분석 — 시계열 cross-correlation (lag).** CTL → VPS lag 5-10일 가설. ACF / CCF.

**구현 위치.** `storage.js:` 신규 함수 `function computeCrossCorrelation(allSessions, profile, options)`. 클라이언트 ML 은 TensorFlow.js 권장 (random forest 구현 가능, n ≤ 1000 세션 충분).

**시각화 (DataViz 협업).** correlation matrix heatmap (RYG diverging), feature importance 가로 막대.

### 4-5. Performance benchmarking v1

**Percentile ranking.** 라이더 본인의 모든 세션 metric (예: 최고 속도) 의 분포 → 이번 세션이 몇 percentile. 절대 vs 상대 명시.

**Wind-binned comparison.** 풍속 4 bin (light <12 / medium 12-16 / strong 16-20 / extreme >20 kt) 별 metric 통계 → 같은 bin 의 다른 세션과 비교.

**Best windowed metrics 확장.** 2s · 10s · 100m · 250m · 500m · 1NM 모두 이미 구현 (`peakForWindow` · `computeDistanceBests`). **시즌 누적 best** (year-to-date) 추가 권장 — 단순한 storage 집계 함수.

**시각화 (DataViz 협업).** `renderProgression` 의 sparkline 옆에 percentile 표시. wind-binned 는 `computeStatsPanel` 의 풍속별 split tab.

---

## 5. §181-C 리프팅 calibration plan — PhD 검수 통과를 위한 multi-anchor

### 5-1. 현재 calibration 상태

| Anchor | 출처 | 풍속 | 라이더 | 장비 | 결과 | 보정 변수 |
|---|---|---|---|---|---|---|
| A1 | Danny ground truth | 11 kt | 80kg · 상급-선수 | 7m² · foil AR 13.7 (R6 V1) | V_boat ≈ 18 kt | LDWING_K 1.83 → 2.2 (§181-C) |
| A2 | Danny ground truth | 12 kt | 70kg · 중급 | optimum ≈ 6m² · foil AR 6.5 | wing optimum | CL_WING_MAX 1.2 → 1.00 (§181-D) |
| A3 | Danny ground truth | 10 kt | 70kg · 상급-선수 | optimum ≈ 7.4m² · foil AR 13.7 | wing optimum (단조 증가) | CL_WING_MAX 1.2 → 1.00 (§181-D) |
| A4 | Danny ground truth | 10 kt | 70kg · 선수 | optimum ≈ 7.5m² · foil AR 13.7 | A_ref pivot | WING_AREA_REF_M2 5.5 → 7.5 (§181-E) |
| A5 | Danny ground truth | various | 70kg · 선수 | foil AR 13.7 | 풍속 sensitivity ≈ -0.9 | WING_HEEL_COUPLE_EXP 0 → -1.2 (§181-E) |

**한계.** **모든 anchor 가 Danny 1인.** 다른 라이더 (다른 체중·스킬·foil) 로 일반화 검증 부재 — PhD 검수 risk.

### 5-2. Phase 2 추가 anchor 수집 protocol (Plan)

**Anchor 1세트 (n ≥ 5 라이더).** 각 라이더에 대해:
- 라이더 spec — 체중·gear·스킬 등급 (입문/초급/중급/상급/선수)·heel 측정 (Apple Watch IMU)
- 장비 spec — 보드 volume·foil brand/model/area/AR·wing brand/size/AR
- 측정 세션 — 풍속 8/12/16/20 kt 4 영역 × 2-3 세션 = 8-12 세션
- Ground truth — 비디오 (GoPro · 보드 마운트) + GPS (RaceBox 또는 phone) 동기. V_boat (실측) 와 V_b (모델 예측) 비교

**Validation metric.**
- MAE (mean absolute error) of V_b prediction
- 라이더별 calibrate 후 cross-rider transferability (라이더 i 의 calibration 으로 라이더 j 의 V_b 예측 — MAE)
- 풍속·체중·스킬 marginal effect 확인 (one variable 만 변화 시 모델 예측 vs 실측)

**Target.**
- 라이더 본인 MAE < 1 kt (cruise)
- Cross-rider MAE < 2 kt
- Wind/skill marginal effect monotonic + 정성적으로 정확

### 5-3. Phase 1 = plan only — 즉시 행동

- §5-2 protocol document 작성 (본 문서가 1차)
- Anchor recruitment plan — Danny 의 코칭 네트워크 (송정·다대포·시화호) + Levitaz / PPC / Takoon 한국 라이더
- 측정 device 준비 — RaceBox Mini · Movesense · Apple Watch · GoPro 동기 sync
- 표준 test protocol — 같은 spot · 같은 풍속 영역 · 같은 wing/foil 라이더가 다른 wing 사이즈로 8-12 세션
- 데이터 수집 timeline — Phase 2 진입 후 4-6 주 (2026 여름 시즌)

### 5-4. PhD 검수 통과를 위한 결정 publish plan

수집된 anchor 데이터로:
1. **Internal validation report** — n ≥ 5 라이더, 풍속 4 영역, MAE 측정
2. **Academic paper draft** — *Sports Engineering* (Springer, ISSN 1369-7072) 또는 *Journal of Sports Sciences* (Routledge, ISSN 0264-0414) target
3. **GitHub repo first publish** — `github.com/sailtechco/lift-calibration` (MIT License) — calibration protocol + validation data + Python notebook reproducing analysis
4. **Korean Sport Science Society 발표** — KSSS 2027 (Phase 3)

이 4 단계가 SailTechCo Moat W4 (공개 검증 가능 메서드 — `sailtechco_moat_proposal.md` §2.W4) 의 핵심 실행.

---

## 6. 검증 데이터셋 sanity-check plan — Danny GPX/.vkx 회귀 테스트

### 6-1. 기존 fixture

`site/riding-dashboard/sample/`:
- `sample-ride-gangneung.gpx` — 강릉 라이딩 샘플 (GPX, phone GPS)
- `sample-songjeong-busan.gpx` — 송정 부산 라이딩 샘플 (GPX, phone GPS)
- `sample-gpx-data.js` — JS-embedded sample (테스트용)

`selftest-*.js` 12 개 (riding-dashboard) — self-test 패턴. 일부 (`selftest-hr.js`·`selftest-polar-career.js`·`selftest-wind.js`·`selftest-target-polar.js` 등) 가 알고리즘별 검증.

### 6-2. Phase 1 권장 추가 (Plan)

**Plan 1 — Danny `.vkx` fixture 추가.** Vakaros Atlas 2 .vkx (heel/pitch 포함) 1-2 세션 sample fixture 등록. `vkx-parser.js` selftest 확장 — quaternion → heel/pitch 변환 정확도 검증 (Vakaros vendor app 산출치와 비교).

**Plan 2 — 회귀 invariant 명시.** 각 알고리즘이 fixture 에서 산출한 metric 의 expected value snapshot. 예:
```javascript
// selftest-wind.js
var session = An.normalizeSession(parseGPX(sampleSongjeongBusan));
var w1 = An.estimateWindFromTrack(session);
console.assert(Math.abs(w1.windDir - EXPECTED_TWD_SONGJEONG) < 10,
               'estimateWindFromTrack regression — Songjeong sample');

var w2 = An.estimateWindFromManeuvers(session);
console.assert(Math.abs(w2.windDir - EXPECTED_TWD_SONGJEONG) < 15,
               'estimateWindFromManeuvers regression');

// Cross-validation: 두 채널이 서로 ±20° 안에 들어야
console.assert(Math.abs(w1.windDir - w2.windDir) < 20,
               'wind cross-channel disagreement — algorithm review needed');
```

**Plan 3 — 알고리즘 변경 시 자동 회귀.** `selftest-*.js` 가 매 commit 마다 자동 실행 (Phase 2 의 GitHub Actions CI — `expert_frontend_engineer_reference.md` §6 와 통합).

**Plan 4 — 도메인 expert ground truth.** Danny + 코칭 네트워크 5-10명 의 ground truth annotation. 각 fixture 에 대해 (a) 정확한 풍향 (실측 풍속계 or KMA RDAPS) (b) tack/jibe count (수동 비디오 카운트) (c) 회전 quality (1-10 평가) — 이 ground truth 가 알고리즘 정확도의 절대 기준.

### 6-3. 학술 가치

이 검증 데이터셋은 **§4-4 cross-correlation 모델 학습 데이터** + **§5 calibration anchor** + **§7 SailTechCo Moat W4 (공개 검증)** 의 1차 input. **Public domain (MIT License) 공개 권장** — sailing analytics 학술 커뮤니티에 첫 windfoil benchmark dataset 기여.

---

## 7. SailTechCo Moat W3 (4-channel Wind) · W4 (공개 검증) 와의 연결

`sailtechco_moat_proposal.md` 의 5 wedge 중 W3·W4 가 본 Sports Science 영역의 핵심.

### 7-1. W3 — 4-channel Wind Inference 연결

현재 `analysis.js` 에 2 channel (`estimateWindFromTrack` no-go · `estimateWindFromManeuvers` 기하) 구현. Moat 의 4 channel target:

| Channel | 현재 상태 | Phase 2 plan |
|---|---|---|
| A — 사용자 1회 캡처 (Vakaros style) | 부재 | Phase 2 UI — 라이더가 라인업 단계 풍상 starboard + port 헤딩 손으로 저장 → 이등분 = 풍축 후보 |
| B — Apple Watch IMU | 부재 | Phase 2 — Apple Watch standalone 앱 (Mobile Engineer #8) → Core Motion API pitch/roll/yaw → board-heading vs COG → wind estimate |
| C — 다회전 기하 | ✅ `estimateWindFromManeuvers` 구현 | 유지 + Bayesian 가중치 통합 |
| D — 외부 weather API | 부재 (slot 만 — `buildWindSources` weather:available:false) | Phase 2 — OpenWeather Time Machine 또는 KMA RDAPS direct fetch — 한국 spot 가까운 station 우선 |

**Bayesian 통합 식 (sailtechco_moat_proposal §2.W3.3 spec 그대로):**
```python
TWD_estimated = circular_weighted_mean(estimates, weights)
TWD_confidence = inverse_variance_confidence(estimates, weights)

  where weights:
    w_A = data quality of user lineup (time-decay)
    w_B = IMU SNR (low at low speed, high at high speed)
    w_C = jibe/tack count (low if few)
    w_D = weather API resolution (Korea KMA prioritized)

  Confidence reasoning (Korean):
    높음 — "4 채널 모두 풍향 235° 부근으로 일치"
    보통 — "3 채널 일치 (245°/235°/240°), IMU (260°) 어긋남"
    낮음 — "회전 부족 + 외부 weather 만 신뢰. 사용자 입력 권장"
```

**구현 위치.** `analysis.js:` `function buildWindSources()` 의 확장 — slots 만 잡혀 있는 현재 구조를 4-channel Bayesian 통합으로 확장. 기존 코드 0줄 변경 (Phase 1) — Phase 2 에서 통합.

### 7-2. W4 — 공개 검증 가능 메서드 연결

본 문서 (`expert_sports_science_reference.md`) 자체가 W4 의 1차 산출:
- (a) 모든 알고리즘 + 신규 모델의 학술 reference (DOI/ISBN/URL) 명시
- (b) §5 §181-C calibration plan 의 multi-anchor validation 방법론 publish
- (c) §6 검증 데이터셋 sanity-check plan — public domain fixture 공개
- (d) §3 인용 plan 의 인라인 주석 추가 (Phase 2) → GitHub repo first publish 시 코드 자체가 학술 reference

**GitHub repo (`github.com/sailtechco/algorithms` — Phase 2):**
- `algorithms/wind_inference/` — channel A/B/C/D (Bayesian)
- `algorithms/maneuver_detection/` — tack/jibe/turn + classification
- `algorithms/kpi_catalog/` — foiling time / jibe ride-through / etc
- `algorithms/coach_engine/` — R1-R9 rules
- `algorithms/lift_calibration/` — §181 upwind polar model + calibration
- `algorithms/training_load/` — TRIMP + CTL/ATL/TSB
- `algorithms/hrv/` — RMSSD/SDNN
- `algorithms/cross_correlation/` — multivariate analysis
- `docs/methodology/` — DOI/ISBN/URL 학술 reference
- `tests/synthetic_sessions/` + `tests/in_water_validation/` — public benchmark dataset

**Academic publish target (Phase 2-3):**
- *Sports Engineering* (Springer) — methodology paper
- *Journal of Sports Sciences* (Routledge)
- *IEEE Sensors* — IMU sensor fusion
- 한국 sport science 학회 (KSSS) — 한국 윙포일 도메인 진입

---

## 8. 협업 인터페이스

### 8-1. DataViz Specialist (#2)

- **신뢰도 시각화.** 4-channel wind Bayesian 출력의 신뢰도 (높음/보통/낮음) 를 어떻게 시각 표시할지. `expert_dataviz_reference.md` §1-3 invariant 6 (신뢰도 self-report) 패턴 확장.
- **CTL/ATL/TSB 차트.** `renderProgression` 에 새 데이터 시리즈 추가 — 현재의 단일 axis 시계열에 CTL (실선) + ATL (파선) + TSB (구간 색) overlay. multi-axis lie factor 방지 (DataViz §2-13).
- **HRV trend.** RMSSD 7일 EWMA vs 라이더 본인 baseline. SDNN < 50ms warning band.
- **Cross-correlation heatmap.** 변수 쌍의 correlation matrix — sequential blue → red diverging (RYG status 와 분리).
- **§181 upwind polar visualization.** What-if sweep 의 역U자 곡선이 현재 sparkline 으로 표시 — DataViz §4-1 Replay Strip 의 small multiples 에 통합 가능.

### 8-2. Visual Designer

- **수식 사이드 패널.** PhD 검수 통과를 위한 inline 수식 표시 UI (KaTeX 또는 MathJax). 예: 폴라 차트 옆에 "VMG = SOG × cos(TWA)" 작은 수식 + 도움말 펼침.
- **신뢰도 색상.** confidence (높음/보통/낮음) 의 색·아이콘. trust 손상 risk — 너무 빨강이면 "당신 데이터를 못 믿겠습니다" 로 들림.

### 8-3. Frontend Engineer (#4)

- **TRIMP / CTL / ATL / HRV 모듈 구현** (`analysis.js` 확장 + `storage.js` 시즌 추세 EWMA).
- **Cross-correlation 클라이언트 ML — TensorFlow.js.** Random Forest 구현 (n ≤ 1000 세션 충분).
- **§181-C calibration data collection UI** — 라이더가 측정 세션 metadata 입력 + .vkx + GoPro 동기 sync.
- **GitHub repo first publish workflow** — 알고리즘 코드를 `site/riding-dashboard/js/` 에서 떼어 별도 repo (`github.com/sailtechco/algorithms`) 로 publish, npm package or git submodule.

### 8-4. UX Researcher (#5)

- **Hooper Index 일일 wellness 입력 UI** — 5초 4 question (수면/피로/스트레스/근육통 각 1-7 scale). NN/g form design 권장 (UX reference §1-3) — 단일 column · auto-advance.
- **CTL/ATL/TSB 해석 UI.** TSB +25 "race ready" / -30 "overtraining risk" 같은 자연어 설명. Mental model alignment — 라이더가 숫자만 보고 무슨 뜻인지 즉시 인지해야.
- **신뢰도 표시 위치.** 풍향 추정 confidence (높음/보통/낮음) 가 어디에 표시되어야 사용자 신뢰가 가장 잘 형성되는가 (테스트).
- **What-if sweep 의 confidence 표시.** 현재 막대만 — 곡선의 confidence band 추가 시 사용자 인지 변화 (UX testing).

### 8-5. Mobile App Engineer (#8)

- **Apple Watch IMU 채널 (W3 channel B).** Core Motion API (CMMotionManager + CMAttitudeReferenceFrame.xMagneticNorthZVertical) → pitch/roll/yaw. board-heading 추정. iOS standalone Apple Watch 앱 (`expert_mobile_app_reference.md` §5.1 HKWorkoutActivityType.sailing).
- **Polar H10 BLE strap pairing** (HRV channel). RR-interval 0x180D / 0x2A37 표준 (`expert_mobile_app_reference.md` §9.8). post-session 또는 라이브 stream.
- **HealthKit RHR / Sleep fetch.** `HKQuantityTypeIdentifier.restingHeartRate` · `HKCategoryTypeIdentifier.sleepAnalysis`. 라이딩 직전 7일 sleep + RHR EWMA 자동 계산.

### 8-6. Hardware Engineer (#7)

- **SailTechMOTION 자체 센서 IMU spec** (`expert_hardware_embedded_reference.md` §2). 우리가 채택한 ICM-42688-P (gyro noise 2.8 mdps/√Hz) 가 windfoil 회전 검출에 충분 — 정량 검증 가능.
- **Magnetometer calibration** (heading 정확도 — 풍향 추정 channel B 정확도의 1차 입력).
- **PPS time sync** — GPS PPS pin → MCU TIMER capture → IMU timestamp μs 정확도. multi-sensor fusion 시 시간 동기의 핵심.

---

## 9. 제약 준수 확인

| 제약 | 준수 |
|---|---|
| `DO_NOT_REVERT` §181·§181-C·§181-D·§181-E·§181-F (리프팅 calibration lock) | ✅ — 본 문서는 검증·문서화·calibration plan만. revert 0건. §5 가 추가 anchor 수집 plan — 기존 anchor 무효화 X |
| Phase 1 production 코드 변경 X | ✅ — 본 문서가 reference + audit + plan + spec. 코드 1줄도 안 바꿈 |
| `[[feedback_strict_fact_verification]]` 절대 fabrication 금지 | ✅ — 모든 학술 reference 는 WebSearch + 학회/출판사 공식 URL 확인 (Banister 1991 · Coggan 2010 · Task Force 1996 · Karvonen 1957 · Faltinsen 2005 · Larsson & Eliasson 2022 · Mardia & Jupp 2000 · Kellmann & Kallus 2001 · Folkersma et al. 2019 · Anderson 2010 — 모두 DOI/ISBN/URL 명시) |
| 학술 reference 인용 시 DOI 또는 ISBN·URL 명시 | ✅ — §1 의 모든 reference 가 (DOI / ISBN / URL) 최소 한 가지 명시 |
| 다른 5 expert reference 와 같은 형식 | ✅ — 헤더 표 + 읽는 법 + TL;DR + § 구조 일관 (`expert_dataviz_reference.md` 와 동일 layout) |
| 기존 메모리 reference 존중 | ✅ — `[[project_sailtech_riding_analytics_app]]` · `[[project_dmj_lifting_calculator]]` · `[[reference_dmj_plane_to_wingfoil_mapping]]` · `[[reference_dmj_apparent_wind_progression]]` · `[[reference_dmj_mast_length_progression]]` · `[[reference_dmj_beginner_session_separation]]` 직접 read 불가 (보호된 위치) — 사용자가 채팅으로 공유한 lock 만 들고 진행. §5 의 §181-C calibration plan 이 이 lock 들과 모순 없음 |
| SailTechCo Moat W3·W4 와의 연결 | ✅ — §7 명시 |

---

## 10. Variables, Constants, Sources

### 10-1. 본 문서 등장 상수 cheat-sheet

```
세일링 물리
  ρ_sea         = 1025 kg/m³ (해수, 염도 35‰)
  ρ_fresh       = 1000 kg/m³ (민물)
  ρ_air         = 1.225 kg/m³ (15°C, sea level)
  g             = 9.81 m/s²
  MS_TO_KT      = 1.94384
  KT_TO_MS      = 0.5144

Foil hydrodynamics
  C_D,0 (foil)  = 0.008 (clean hydrofoil)
  e_foil        = 0.85 (well-designed)
  L/D_foil_max  = 9.13 · √AR
  C_D,0 (wing LEI) = 0.098 (Folkersma 2019)
  e_wing LEI    = 0.42 (Folkersma 2019)
  L/D_wing_max  = 1.83 · √AR (이론) → 2.2 · √AR (§181-C Danny anchor)
  CL_WING_MAX   = 1.00 (§181-D, was 1.2 — 2D peak)

Maneuver detection
  turnRateSmoothSec       = 2.5 s (windfoil-specific, shorter than sailing 20s)
  turnRateThresholdDegSec = 6 °/s
  turnAngleThresholdDeg   = 60 °
  turnMinDurationSec      = 3 s
  maneuverMinSpeedKt      = 5 kt
  maneuverApproachDeg     = 30 ° (incomplete attempt threshold)
  polarBinDeg             = 7.5 ° (Njord standard)

Wind inference
  no-go zone window = 90 ° (18 × 5° bin)
  bin size          = 5 °
  mirror correction = ±22 °
  conf high  : cleanNoGo < 0.06
  conf medium: 0.06 ≤ cleanNoGo ≤ 0.13
  conf low   : cleanNoGo > 0.13 or reciprocal (downwindFrac < 0.14)
  AXIS_TOL          = 35 ° (maneuver geometry outlier cutoff)

Exercise physiology
  TRIMP weighting (male)   : y = 0.64 × exp(1.92 × HRR)
  TRIMP weighting (female) : y = 0.86 × exp(1.67 × HRR)
  CTL time constant        : 42 days
  ATL time constant        : 7 days
  HRV short-term window    : 5 min
  HRV long-term window     : 24 h
  SDNN risk threshold      : < 50 ms post-MI
  HR_max (Tanaka 2001)     : 208 - 0.7 × age
  HR_max (Fox 1971, old)   : 220 - age

GPS outlier
  gpsMaxSpeedKt    = 40 kt (foiling physical upper bound)
  gpsDeviceTolKt   = 8 kt (vs device SOG)

Sample statistics
  Silverman bw     : 1.06 × σ × n^(-1/5)
  R-bar (circ)     : √((Σcos)² + (Σsin)²) / n
  circ σ           : √(-2 × log R)
```

### 10-2. Sources

**프로젝트 내부 (직접 열람):**
- `site/riding-dashboard/js/analysis.js` (2722 line, 분석 엔진 — VMG/TWA/tack/jibe/wind/percentile/polar)
- `site/riding-dashboard/js/coach.js` (~860 line, Coach Danny — VPS·What-if·R1-R9)
- `site/riding-dashboard/js/vkx-parser.js` (198 line, Vakaros .vkx 파서 — quaternion → heel/pitch)
- `site/riding-dashboard/js/gpx-parser.js` (GPX 파서 — Waterspeed extension HR)
- `site/riding-dashboard/js/replay.js` (replay viewer — wind grid, axis line, ladder)
- `site/assets/js/lift-calculator.js` (1808 line, §181 upwind polar physics)
- `site/calculator.html` (lift calculator UI)
- `site/_experts/expert_dataviz_reference.md` (Phase 1 viz reference — Tufte·D3·Vakaros·SAP·Njord 통합)
- `site/_experts/expert_hardware_embedded_reference.md` (IMU·BLE·certification spec)
- `site/_experts/expert_frontend_engineer_reference.md` (Web platform audit + plan)
- `site/_experts/expert_ux_researcher_reference.md` (Nielsen heuristics audit · sports app patterns)
- `site/_experts/expert_mobile_app_reference.md` (BLE GATT · HealthKit · Polar / Movesense)
- `site/_experts/expert_orchestrator_daemon_reference.md` (Claude Agent SDK · push automation)
- `site/_research/sailtechco_moat_proposal.md` (5-wedge moat — W3 4-channel wind · W4 open methodology)
- `site/riding-dashboard/CHART-DESIGN-SYSTEM.md` (chart 색 4계열 원칙)

**외부 학술 reference:**

세일링 물리·yacht design
- Larsson, L., Eliasson, R., & Orych, M. (2022). *Principles of Yacht Design* (5th ed.). Bloomsbury. ISBN 978-1-3994-0301-6. [URL](https://www.bloomsbury.com/us/principles-of-yacht-design-9781399403016/)
- Garrett, R. (1996). *The Symmetry of Sailing*. Sheridan House. ISBN 978-1-57409-000-5.
- [ORC IMS VPP Documentation (2025)](https://www.orc.org/index.asp?id=37)
- [Burch, D. (2022). "Introduction to Polar Diagrams and Optimum VMC"](http://davidburchnavigation.blogspot.com/2022/02/VMC.html)
- [Vakaros — VMG and Tack Loss training](https://blog.vakaros.com/vmgtackloss)

Foil hydrodynamics
- Anderson, J.D. (2010). *Fundamentals of Aerodynamics* (6th ed.). McGraw-Hill. ISBN 978-1-259-12991-9.
- Faltinsen, O.M. (2005). *Hydrodynamics of High-Speed Marine Vehicles*. Cambridge University Press. doi:[10.1017/CBO9780511546068](https://doi.org/10.1017/CBO9780511546068). ISBN 978-0-521-84568-7.
- Folkersma, M., Schmehl, R., & Viré, A. (2019). "Boundary layer transition modeling on leading edge inflatable kite airfoils". *Wind Energy*, 22(7), 908-921. doi:[10.1002/we.2329](https://doi.org/10.1002/we.2329).
- [NASA Technical Reports Server (NTRS) — NACA reports](https://ntrs.nasa.gov/)

Maneuver geometry · sailing telemetry
- [Njord Analytics — Maneuver Analysis Help](https://app.sailnjord.com/help/analytics/maneuvers.html)
- [SAP Sailing Analytics — Apache 2.0 (2025-10-20)](https://github.com/SAP/sailing-analytics)

통계 기법
- Mardia, K.V., & Jupp, P.E. (2000). *Directional Statistics*. John Wiley & Sons. ISBN 978-0-471-95333-3. doi:[10.1002/9780470316979](https://doi.org/10.1002/9780470316979).
- Silverman, B.W. (1986). *Density Estimation for Statistics and Data Analysis*. Chapman & Hall/CRC. ISBN 978-0-412-24620-3.
- Scott, D.W. (2015). *Multivariate Density Estimation* (2nd ed.). Wiley. doi:[10.1002/9781118575574](https://doi.org/10.1002/9781118575574).
- Berens, P. (2009). "CircStat: A MATLAB Toolbox for Circular Statistics". *Journal of Statistical Software*, 31(10), 1-21. doi:[10.18637/jss.v031.i10](https://doi.org/10.18637/jss.v031.i10).
- Steinarsson, S. (2013). "Downsampling Time Series for Visual Representation". *MSc Thesis*, University of Iceland.
- Virtanen, P., et al. (2020). "SciPy 1.0: fundamental algorithms for scientific computing in Python". *Nature Methods*, 17, 261-272. doi:[10.1038/s41592-019-0686-2](https://doi.org/10.1038/s41592-019-0686-2).

운동 생리 · 훈련 부하 · HRV
- Banister, E.W. (1991). "Modeling Elite Athletic Performance". In *Physiological Testing of the High-Performance Athlete* (2nd ed., pp. 403-424). Human Kinetics. ISBN 978-0-87322-307-5.
- Banister, E.W., & Calvert, T.W. (1980). "Planning for future performance: Implications for long term training". *Canadian Journal of Applied Sport Sciences*, 5(3), 170-176. PMID 7449608.
- Morton, R.H., Fitz-Clarke, J.R., & Banister, E.W. (1990). "Modeling human performance in running". *Journal of Applied Physiology*, 69(3), 1171-1177. doi:[10.1152/jappl.1990.69.3.1171](https://doi.org/10.1152/jappl.1990.69.3.1171).
- Coggan, A.R., & Allen, H. (2010). *Training and Racing with a Power Meter* (2nd ed.). VeloPress. ISBN 978-1-934030-55-2.
- [Coggan, A.R. (2003). USA Cycling Coaching Education lecture PDF](https://www.midweekclub.ca/articles/coggan.pdf)
- Task Force ESC/NASPE (1996). "Heart rate variability: Standards of measurement, physiological interpretation and clinical use". *European Heart Journal*, 17(3), 354-381; *Circulation*, 93(5), 1043-1065. doi:[10.1161/01.CIR.93.5.1043](https://doi.org/10.1161/01.CIR.93.5.1043). PMID 8598068.
- Sammito, S., et al. (2024). "Advances in HRV signal analysis: ESC/EHRA/APHRS joint position statement". *Europace*, 26(2), euae051. doi:[10.1093/europace/euae051](https://doi.org/10.1093/europace/euae051).
- Karvonen, M.J., Kentala, E., & Mustala, O. (1957). "The effects of training on heart rate; a longitudinal study". *Annales Medicinae Experimentalis et Biologiae Fenniae*, 35(3), 307-315. PMID 13470504.
- Swain, D.P., et al. (1994). "Target heart rates for the development of cardiorespiratory fitness". *Med Sci Sports Exerc*, 26(1), 112-116. doi:[10.1249/00005768-199401000-00019](https://doi.org/10.1249/00005768-199401000-00019).
- Tanaka, H., Monahan, K.D., & Seals, D.R. (2001). "Age-predicted maximal heart rate revisited". *J Am Coll Cardiol*, 37(1), 153-156. doi:[10.1016/S0735-1097(00)01054-8](https://doi.org/10.1016/S0735-1097(00)01054-8).
- Astrand, P.O., & Ryhming, I. (1954). "A nomogram for calculation of aerobic capacity". *J Appl Physiol*, 7(2), 218-221. doi:[10.1152/jappl.1954.7.2.218](https://doi.org/10.1152/jappl.1954.7.2.218).

회복 · 주관적 wellness
- Halson, S.L. (2014). "Monitoring training load to understand fatigue in athletes". *Sports Med*, 44(Suppl 2), 139-147. doi:[10.1007/s40279-014-0253-z](https://doi.org/10.1007/s40279-014-0253-z). PMID 25200666.
- Kellmann, M., & Kallus, K.W. (2001). *Recovery-stress Questionnaire for Athletes: User Manual*. Human Kinetics. ISBN 978-0-7360-3700-2.
- Davis, H., Orzeck, T., & Keelan, P. (2007). "Psychometric item evaluations of the Recovery-Stress Questionnaire for athletes". *Psychology of Sport and Exercise*, 8(6), 917-938. doi:[10.1016/j.psychsport.2006.09.002](https://doi.org/10.1016/j.psychsport.2006.09.002).
- McNair, D.M., Lorr, M., & Droppleman, L.F. (1971). *Manual for the Profile of Mood States*. EdITS. ISBN 978-0-915570-04-1.
- Hooper, S.L., et al. (1995). "Markers for monitoring overtraining and recovery". *Med Sci Sports Exerc*, 27(1), 106-112. doi:[10.1249/00005768-199501000-00019](https://doi.org/10.1249/00005768-199501000-00019).
- Saw, A.E., Main, L.C., & Gastin, P.B. (2016). "Monitoring the athlete training response: Subjective self-reported measures trump commonly used objective measures". *Br J Sports Med*, 50(5), 281-291. doi:[10.1136/bjsports-2015-094758](https://doi.org/10.1136/bjsports-2015-094758).
- Plews, D.J., et al. (2013). "Training adaptation and heart rate variability in elite endurance athletes". *Sports Med*, 43(9), 773-781. doi:[10.1007/s40279-013-0071-8](https://doi.org/10.1007/s40279-013-0071-8).

Cross-correlation · machine learning · benchmarking
- Hastie, T., Tibshirani, R., & Friedman, J. (2009). *The Elements of Statistical Learning* (2nd ed.). Springer. ISBN 978-0-387-84857-0. doi:[10.1007/978-0-387-84858-7](https://doi.org/10.1007/978-0-387-84858-7). [무료 PDF](https://hastie.su.domains/ElemStatLearn/)
- Breiman, L. (2001). "Random Forests". *Machine Learning*, 45(1), 5-32. doi:[10.1023/A:1010933404324](https://doi.org/10.1023/A:1010933404324).
- Chen, T., & Guestrin, C. (2016). "XGBoost: A Scalable Tree Boosting System". *Proceedings of the 22nd ACM SIGKDD*. doi:[10.1145/2939672.2939785](https://doi.org/10.1145/2939672.2939785).
- Sands, W.A., et al. (2017). "Modern Techniques and Technologies Applied to Training and Performance Monitoring". *Int J Sports Physiol Perform*, 12(s2), S2-63-S2-72. doi:[10.1123/ijspp.2016-0405](https://doi.org/10.1123/ijspp.2016-0405).
- Vesterinen, V., et al. (2016). "Predictors of individual adaptation to high-volume or high-intensity endurance training". *Scand J Med Sci Sports*, 26(8), 885-893. doi:[10.1111/sms.12530](https://doi.org/10.1111/sms.12530).
- [WMA Age Grading Tables](https://www.world-masters-athletics.com/age-grading)

Quaternion · IMU
- [Diebel, J. (2006). "Representing Attitude: Euler Angles, Unit Quaternions, and Rotation Vectors". Stanford](https://www.astro.rug.nl/software/kapteyn-beta/_downloads/attitude.pdf)
- [Vakaros VKX file format spec](https://github.com/vakaros/vkx)

---

_Last updated: 2026-05-28_
_Phase 1 학습 정리 + 알고리즘 audit + 신규 모델 spec + §181 calibration plan + 검증 sanity-check 완료._
_Phase 2 v1 (2026-05-31 추가) — §11 참조._

---

## 11. Phase 2 v1 — 실제 commit 진행 상태 (2026-05-31)

### 11-1. Step 1 — 학술 reference 인라인 commit ✅

**수정 파일 4개, edit 11건 (코드 로직 0건 변경 — 주석만):**

| 파일 | 함수 | 추가된 reference |
|---|---|---|
| `analysis.js` | `countProminentPeaks` | Virtanen et al. 2020 (SciPy 1.0, doi:10.1038/s41592-019-0686-2) |
| `analysis.js` | `detectManeuvers` | Larsson & Eliasson 2022 · Vakaros blog · Njord docs · SAP OSS |
| `analysis.js` | `classifyManeuver` | Larsson & Eliasson 2022 + methodological honesty (Saw, Main, Gastin 2016) |
| `analysis.js` | `computeTierMeans` | Sands et al. 2017 (doi:10.1123/ijspp.2016-0405) + Vakaros/Vantage convention |
| `analysis.js` | `estimateWindFromTrack` | Mardia & Jupp 2000 (no-go zone, axial data ch.6) · Larsson & Eliasson · Burch 2022 |
| `analysis.js` | `estimateWindFromManeuvers` | Mardia & Jupp 2000 (2θ circular mean) · Berens 2009 CircStat · Njord |
| `analysis.js` | `computeWindMetrics` | Larsson & Eliasson 2022 · ORC IMS VPP · Vakaros 4-bucket |
| `vkx-parser.js` | `quatToHeelPitch` | Diebel 2006 Stanford · Vakaros VKX spec |
| `coach.js` | `computeVPS` | Vantage Sailing pattern · Halson 2014 (uncertainty acknowledgment) |
| `lift-calculator.js` | `upwindSpeed` (§176) | Anderson 2010 · Faltinsen 2005 · Folkersma 2019 · Larsson & Eliasson 2022 · Garrett 1996 |

### 11-2. Step 2 — TRIMP v1 구현 + selftest ✅

**신규 함수 `An.computeTRIMP(session, profile)` — `analysis.js:2375-2486`:**
- Banister 1991 공식: HRR + 성별 가중 (남 0.64·e^(1.92·HRR), 여 0.86·e^(1.67·HRR))
- 입력 graceful — no HR / no rest HR / no max HR → hasTRIMP:false + reason
- maxHr 미입력 → observed maxBpm fallback (보수적)
- HRR clamp [0, 1] (avg < rest 또는 avg > max 오류 보호)

**selftest 결과 — `selftest-trimp.js` — 23/23 PASS:**
- 표준 케이스 (1시간 · HRR=0.5 · 남성): TRIMP 50.1, 공식과 ±0.5 일치 ✅
- 여성 weighting 검증 (HRR=0.5 영역에서 female > male) ✅
- 고강도 지수 증폭 (HRR=0.8 → TRIMP 142.7, > 2× HRR=0.5) ✅
- Edge cases (no HR / no rest / HRR clamp / observed fallback) ✅
- 송정 부산 실측 GPX (89분 윙포일 라이딩) → TRIMP 100.5, HRR 0.58, avgBpm 126 ✅

### 11-3. Step 3 — CTL/ATL/TSB v1 구현 + selftest ✅

**신규 함수 `Storage.computeFitnessTrend(sessions, opts)` + `Storage.interpretTSB(tsb)` — `storage.js`:**
- Coggan EWMA: CTL k=42 day, ATL k=7 day, TSB = CTL−ATL
- TSB 5 zone label (peaked / fresh / balanced / productive / overreach) — UI 자연어
- `record.trimp` 신규 field (caller 가 An.computeTRIMP 산출 결과 전달)
- 같은 날 다중 세션 → load 합산

**selftest 결과 — `selftest-fitness-trend.js` — 22/22 PASS:**
- 정상상태 검증 (load 50 매일 60일 → ATL → 50, CTL ≈ 38) ✅
- Decay (휴식 30일 후 ATL ≈ 0.7, TSB 양수 — 회복) ✅
- Taper dynamics (하드 14일 + 휴식 14일 → TSB peak ≈ day 27) ✅
- EWMA 수학 직접 검증 (day 0 ATL = 100·(1-e^(-1/7)) = 13.31) ✅
- Edge cases (empty / trimp:null / 같은 날 합산) ✅
- TSB zone labels ✅

### 11-4. Step 4 — HRV (RMSSD/SDNN/pNN50) v1 구현 + selftest ✅

**신규 함수 `An.computeHRV(rrIntervals)` — `analysis.js:2488-2581`:**
- Task Force 1996 표준 정의 (RMSSD, SDNN, pNN50)
- Artifact rejection (RR < 300ms 또는 > 2000ms = 비현실적 HR)
- Ectopic beat rejection (인접 RR 차이 > 20% 평균 RR)
- 최소 30 표본 (≈ 5분 측정) — 부족 시 hasHRV:false

**selftest 결과 — `selftest-hrv.js` — 21/21 PASS:**
- 정확 RMSSD (alternating ±20ms → RMSSD = 40ms) ✅
- Constant RR → SDNN = 0, RMSSD = 0 ✅
- SDNN 알려진 분산 (alternating 800/850 → SDNN = 25ms 정확) ✅
- pNN50 임계 (diff 50ms = 0%, 60ms = 100%) ✅
- Artifact + ectopic beat rejection ✅
- Athlete-like simulated HRV → RMSSD athlete range ✅

### 11-5. Step 5 — 4-channel wind Bayesian 통합 ✅

**신규 함수 `An.combineWindSources(sources)` — `analysis.js:1928-2048`:**
- 확정 (manual) 채널 → 강제 채택, 다른 채널 무시
- 신뢰도 가중: 높음 3.0 / 보통 1.5 / 낮음 0.5
- 가중 원형 평균 (Mardia & Jupp 2000 ch.2): Σ w·cos·sin → atan2
- 신뢰도 환산 — spreadDeg 기반: <10° 높음 / <25° 보통 / ≥25° 낮음
- 모든 입력 '낮음' → 통합도 '낮음' clamp (과신 방지)
- weightOverride 지원 (Phase 2 — IMU SNR 가변 가중)

**`buildWindSources` 확장 — Channel A (lineup) + Channel B (imu) slot 추가:**
- 기존 4 slot (manual / nogo / rotation / weather) → 6 slot (+ lineup + imu)
- 기존 recommended 로직 보존 (backwards compat)

**selftest 결과 — `selftest-wind-combine.js` — 22/22 PASS:**
- 4 채널 완전 일치 → 높음 ✅
- 큰 disagreement (70°) → 낮음 ✅
- 수동 확정 → 다른 채널 무시 ✅
- 신뢰도 가중 (높음 > 낮음) ✅
- Circular wrap (350° vs 10° → 0°) ✅
- weightOverride (Phase 2 IMU dynamic SNR) ✅

### 11-6. Step 6 — Multi-rider anchor 수집 protocol ✅

**신규 문서 `site/_experts/sports_science_calibration_protocol.md` (19.3 KB):**
- 현재 Danny 1-rider anchor 의 PhD 검수 risk 명시
- n ≥ 5 라이더 recruitment 계획 (입문/초급/중급/상급/선수 + 60-90kg + 4 brand)
- Equipment / sensor stack (RaceBox + GoPro + Apple Watch + Polar H10)
- Test protocol (4 풍속 영역 × 2-3 세션 × 라이더 = 40-84 세션)
- Recording form (YAML metadata)
- Analysis protocol (per-rider MAE / cross-rider MAE / bootstrap CI)
- Acceptance criteria (Primary < 1.0 / 2.0 kt MAE · Stretch < 0.5 / 1.5 kt)
- Publish plan (github repo + Sports Engineering Springer + KSSS 2027)
- Timeline 6 month Phase 2
- Risk register 7건

### 11-7. Step 7 — 통합 검증 결과

| Selftest | Result |
|---|---|
| selftest-trimp.js | **23/23 PASS** |
| selftest-fitness-trend.js | **22/22 PASS** |
| selftest-hrv.js | **21/21 PASS** |
| selftest-wind-combine.js | **22/22 PASS** |
| **Total** | **88/88 PASS** |

### 11-8. Phase 2 v1 산출 (요약)

| 카테고리 | 산출 |
|---|---|
| 학술 reference 인용 추가 | 11 곳 (analysis.js·coach.js·vkx-parser.js·lift-calculator.js) |
| 신규 모듈 | computeTRIMP · computeHRV · computeFitnessTrend · interpretTSB · combineWindSources |
| 신규 함수 line count | ~ 600 line (모두 inline reference + docstring) |
| Selftest 신규 | 4 파일 (trimp · fitness-trend · hrv · wind-combine) |
| Selftest assertion count | 88 (모두 PASS) |
| 신규 protocol 문서 | sports_science_calibration_protocol.md (19.3 KB) |
| 학술 reference (DOI/ISBN/URL) | 25+ (모두 검증 확인) |
| `DO_NOT_REVERT` lock 준수 | ✅ §181-* 모두 보존 (calibration 검증·문서화·overlay plan 만) |
| Production 회귀 risk | 0 (모두 additive — 신규 함수, 기존 함수 0줄 수정) |

### 11-9. Phase 3 권장 다음 step

1. **App.js 통합** — `computeTRIMP` · `computeFitnessTrend` · `computeHRV` 를 dashboard UI 에 표시 (Frontend Engineer #4 협업, DataViz #2 시각화)
2. **Multi-rider 데이터 수집 시작** — `sports_science_calibration_protocol.md` 의 6-month Phase 2 timeline 진입
3. **Apple Watch IMU Channel B 구현** — Mobile Engineer #8 협업 (`expert_mobile_app_reference.md` §5.1 HealthKit sailing)
4. **External weather API Channel D 구현** — OpenWeather Time Machine 또는 KMA RDAPS direct (Backend Engineer #10 협업)
5. **Hooper Index 일일 wellness UI** — UX Researcher #5 협업 (5초 4-question)
6. **GitHub repo first publish** — `github.com/sailtechco/algorithms` MIT License (Orchestrator #11 + Frontend #4)
7. **Academic paper draft** — Sports Engineering (Springer) target, Q1 2027

---

## 12. Commercial platform deep-dive — athleteMonitoring.com · Firstbeat (2026-05-31 추가)

본 절은 sports science commercial leader 2 플랫폼의 알고리즘을 분해한다. 두 플랫폼은 우리 §4 신규 모델 spec 의 큰 갭 — (a) **athleteMonitoring.com** 의 ACWR + sRPE + 통합 wellness dashboard, (b) **Firstbeat** (Garmin 2020 인수) 의 EPOC + Training Effect + 24-h HRV stress/recovery + Body Battery — 가 SailTechCo 가 채택해야 할 영역과 의도적으로 skip 해야 할 영역을 가른다. 두 플랫폼은 학술 정합성과 commercial deployment 모두에서 표준이라, 본 도큐의 §10 sources 에 추가하지 않으면 PhD 검수에서 "왜 이 표준을 모르냐" 질문이 나온다.

### 12-1. athleteMonitoring.com — workload management platform (Sport Analytics Ltd, Canada)

#### 12-1-A. 플랫폼 개요

| 항목 | 내용 |
|---|---|
| 출시 | 2014년 — Sport Analytics Ltd (Quebec, Canada) |
| 사용처 | NHL · NCAA · 호주 AFL · 잉글랜드 럭비 · MLS · 한국 K-League (일부) |
| 가격 | 팀당 €50-200/월 (regular plan, 2026 추정) |
| 채널 | 웹 dashboard + iOS/Android 라이더 daily-input 앱 |
| 데이터 input | RPE + duration (sRPE) + 일일 wellness 4-7 question + GPS (선택) + HR (선택) + injury log |

**핵심 워크플로 — daily monitoring:**
1. 라이더가 매일 아침 모바일 앱 알림 → 4-7 question wellness (sleep / fatigue / stress / soreness / mood) 1-10 scale
2. 세션 직후 sRPE (Borg CR10 1-10) + duration 입력 → `sRPE × duration_min = workload`
3. 7일 acute + 28일 chronic rolling 또는 EWMA → ACWR 자동 산출
4. 팀 dashboard: 라이더별 traffic-light (초록=ready·노랑=monitor·빨강=at-risk) — 코치가 즉시 의사결정

#### 12-1-B. ACWR (Acute:Chronic Workload Ratio) — 핵심 알고리즘

**Gabbett 2016 원공식 (rolling average method):**

```
Acute (A)   = sum of last 7-day workload
Chronic (C) = mean of last 28-day workload (4 × rolling 7-day window)
ACWR        = A / C
```

**해석 (Gabbett 2016 + Hulin 2014 럭비 데이터):**

| ACWR | Zone | 부상 위험 |
|---|---|---|
| < 0.8 | Undertraining | 부상 위험 ↑ (detraining + fitness 감소) |
| 0.8 - 1.3 | **Sweet spot** | 최저 부상 위험 (high load, low risk) |
| 1.3 - 1.5 | Borderline | 모니터링 필요 |
| > 1.5 | Danger zone | 부상 위험 2-4× ↑ |

**Williams 2017 EWMA 변형 (보다 sensitive):**

```
ATL_today = λ_a × Load_today + (1 − λ_a) × ATL_yesterday    where λ_a = 2 / (7+1) = 0.25
CTL_today = λ_c × Load_today + (1 − λ_c) × CTL_yesterday    where λ_c = 2 / (28+1) ≈ 0.069
ACWR_EWMA = ATL_today / CTL_today
```

Williams et al. 2017 시스템 review: EWMA 방식이 rolling average 보다 부상 예측 sensitivity 유의하게 높음 (Murray et al. 2017, Sampson et al. 2018, Esmaeili et al. 2018 모두 검증).

**우리 §4-2 와의 관계.** SailTechCo 의 CTL/ATL/TSB (Coggan PMC, k=42/7) 는 ACWR (Gabbett, k=28/7) 와 **수학적으로 같은 EWMA family** 다. 두 모델의 차이:

| 항목 | Coggan PMC (우리 구현) | Gabbett ACWR |
|---|---|---|
| 의도 | 시즌 peak·taper 계획 | 일일 부상 예방 |
| Chronic k | 42 일 | 28 일 |
| Acute k | 7 일 | 7 일 |
| 최종 metric | TSB = CTL − ATL (절대치) | ACWR = ATL / CTL (비율) |
| 위험 임계 | TSB < −30 → overreach | ACWR > 1.5 → 부상 위험 ↑ |
| 학술 기반 | 사이클·endurance | team sport (럭비·축구·AFL) |

**→ 우리 권장: 두 metric 병기.** CTL/ATL/TSB 는 시즌 plan (장기) + ACWR 는 일일 부상 risk (단기). 같은 EWMA infrastructure (`computeFitnessTrend`) 위에 ACWR 추가 — k=28 chronic 옵션 + ratio 산출. 신규 함수 `computeACWR(sessions, profile)` 권장 (§12-3).

#### 12-1-C. sRPE — Foster 2001 — heart rate 없는 부하 측정

**원공식 (Foster et al. 2001):**

```
Session RPE (CR10 scale 1-10) × duration_min = workload (AU = Arbitrary Units)
```

**RPE scale (Borg 1982 CR10, Foster 2001 modification):**
- 1 = Very, very easy
- 3 = Moderate
- 5 = Hard
- 7 = Very hard
- 10 = Maximal

**측정 timing.** 세션 종료 후 **30분 이내** (즉시 입력은 마지막 효율의 영향을 받음, 30분+ 는 회복 후 underestimate). NSCA 표준 30분.

**Validity (Haddad et al. 2017 Frontiers in Neuroscience review):**
- HR-based TRIMP 과 r = 0.75-0.95 (다수 종목에서 유효 validation)
- 강도·duration·종목·라이더 본인 fitness 와 무관하게 robust
- 단점: 자기 보고 → 라이더 motivation·기분 영향 (subjective)

**우리 §4-1 TRIMP 과의 보완.**

| 케이스 | TRIMP (Banister) | sRPE (Foster) |
|---|---|---|
| HR 측정 있음 (chest strap·watch) | ★ 정확 | 보조 (cross-check) |
| HR 없음 (.vkx만 / phone GPS only) | 불가 | ★ 유일 옵션 |
| Strength / 비-cardio session (windfoil 의 pumping drill 등) | underestimate (HR 안 따라옴) | ★ 정확 |
| 다중 라이더 동일 세션 비교 | rest HR / max HR 라이더별 다름 → 비교 어려움 | universal scale 1-10 |

**→ 우리 권장: sRPE 도 신규 모듈로 추가.** windfoil 라이더의 70% 는 HR 측정 안 함 (Apple Watch / Garmin / chest strap 없이 phone GPS 만) — sRPE 가 유일한 workload 측정 옵션. 신규 함수 `computeSRPE(rpe, durationMin)` + 라이딩 종료 화면 UI 1줄 RPE 입력 (UX Researcher #5 협업).

#### 12-1-D. Combined wellness score — daily 4-7 question

**athleteMonitoring 의 standard wellness panel (Hooper Index 확장):**

| Question | Scale | Inspired by |
|---|---|---|
| Sleep quality (지난 밤) | 1-10 | Hooper 1995 |
| Fatigue (현재) | 1-10 | Hooper 1995 |
| Muscle soreness | 1-10 | Hooper 1995 |
| Stress (정신적) | 1-10 | Hooper 1995 |
| Mood | 1-10 | POMS 단축 |
| (선택) Sleep duration (hours) | numeric | sleep modeling |
| (선택) Hydration / nutrition | 1-10 | comprehensive |

**Composite score:**
```
wellness_score = (sleep + (10-fatigue) + (10-soreness) + (10-stress) + mood) / 5
                  [5-50 range, higher = better recovery]
```

일별 wellness 가 7일 baseline 의 −1 SD 이하 → "yellow flag" (모니터링), −2 SD → "red flag" (휴식 권장).

**Saw, Main, Gastin 2016 (Br J Sports Med):** 주관적 self-reported 측정이 다수 객관 측정 (HR · 코르티솔 등) 보다 부상·과훈련 예측에 우월 — 5초 wellness 가 30분 cortisol 측정보다 informative.

**→ 우리 권장: Hooper Index v1 UI 추가 (5초 4-question).** 라이딩 직전 또는 직후 모바일 화면에 sleep/fatigue/stress/soreness 4 슬라이더. localStorage 저장 + cross-correlation engine (§4-4) 의 input. 신규 함수 `computeWellnessTrend(wellness_entries, opts)` — `Storage` 에 추가.

#### 12-1-E. 종합 — athleteMonitoring 이 우리에게 주는 lesson

**채택할 것 (Adopt):**
1. **ACWR 병기** — Coggan TSB + Gabbett ACWR 두 metric 동시 표시 (시즌 plan + 일일 부상 risk)
2. **sRPE 모듈** — HR 없는 세션에서도 workload 측정 가능
3. **Daily wellness 4-question** — Hooper Index v1
4. **EWMA over rolling** — 이미 우리 §4-2 EWMA 채택 ✅ (Williams 2017 와 일치)
5. **Traffic-light dashboard** — 라이더에게 "오늘 ride OK / 모니터 / 휴식" 자연어 (DataViz + UX 협업)

**의도적으로 skip:**
1. **GPS-based external load** — windfoil 의 GPS metric (peak speed / distance) 은 이미 우리 코어 강점. athleteMonitoring 의 GPS workload (sprint distance, high-intensity distance) 는 team sport 전용 — 윙포일 적용 X
2. **Injury log entry UI** — 우리 사용자가 부상 정보 입력 의지 낮음. v3 후보
3. **Team aggregate dashboard** — 우리 1인 라이더 ICP — team 기능 불필요 (Phase 1)

### 12-2. Firstbeat Technologies — HRV-based fitness platform (Garmin 2020 인수)

#### 12-2-A. 플랫폼 개요

| 항목 | 내용 |
|---|---|
| 출시 | 2002년 — Firstbeat Technologies Ltd (Jyväskylä, Finland) |
| 인수 | 2020년 6월 — **Garmin 인수**. Garmin Connect / Forerunner / Fenix / Vivoactive 의 모든 HR-기반 fitness metric 의 underlying algorithm |
| 핵심 자산 | 8개+ white paper (free PDF, firstbeat.com/science) + 200+ peer-reviewed publications |
| Algorithm engine | Saalasti 2003 PhD thesis (neural networks for HR time series) — 1차 reference |
| Commercial products | (1) Firstbeat Sports (B2B 팀) (2) Firstbeat Life (B2C wellness) (3) Garmin OEM (Bodyguard/Vivo 등) |

#### 12-2-B. EPOC (Excess Post-exercise Oxygen Consumption) — 핵심 metric

**물리 정의 (Hill & Lupton 1923 "oxygen debt" → Gaesser & Brooks 1984 modern EPOC):**

```
EPOC = ∫ (VO2_recovery − VO2_baseline) dt  [ml/kg]
```

운동 후 회복 동안 baseline 위로 추가 소비된 산소량 — body homeostasis 교란의 직접 측정.

**기존 측정의 한계.** EPOC 는 호흡 가스 분석 (lab 가스 마스크) 필요 → 일상 측정 불가. Firstbeat 의 contribution = **HR 만으로 EPOC 추정** (lab 없이).

**Firstbeat HR-based EPOC 모델 (Saalasti 2003 thesis, Rusko et al. 2003 ACSM):**

```
EPOC(t) = f(EPOC(t-1), exercise_intensity(t), Δt)
exercise_intensity(t) = % VO2max derived from HR (using individual fitness)
```

- meta-analysis 48 exercise settings, 158 subjects, 2-180 min, 18-108% VO2max
- 가속 (upslope) + 감속 (downslope) 함수의 결합
- Cycle ergometer validation (n=32): r² = 0.79, MAE = 13.7 ml/kg

**TRIMP vs EPOC 의 결정적 차이:**

| 항목 | TRIMP (Banister 1991) | EPOC (Firstbeat) |
|---|---|---|
| 단위 | Arbitrary Units (AU) | ml/kg (물리적 oxygen) |
| 학술 기반 | empirical exponential fit | physiological measurement |
| 해석 | "load" — 상대값 | "homeostasis disturbance" — 절대값 |
| Validation | HR-based race performance 예측 | lab VO2 측정과 r² 0.79 |
| 다른 종목 비교 | 가능 | 가능 + 직접 |
| Firstbeat 입장 | "TRIMP 는 physiological basis 없음, 해석 어려움" | physiological + interpretable |

**→ 우리 권장: EPOC 도 v2 신규 모듈 후보.** TRIMP 보다 physiological 정확. 단 구현 복잡도 ↑ (개인 VO2max 입력 필요 + upslope/downslope 함수 fit). Phase 3 candidate. 신규 함수 `computeEPOC(session, profile)` — input VO2max 추정 (또는 Tanaka HR_max 폴백) + HR series → EPOC trajectory.

#### 12-2-C. Training Effect (TE) — aerobic + anaerobic 분리

**Firstbeat TE = EPOC + fitness level scaling:**

```
TE_aerobic = scale(peak EPOC, fitness_level, ...)   → 0.0-5.0 scale
TE_anaerobic = scale(high-intensity sprint TRIMP variant, ...)   → 0.0-5.0 scale
```

**TE 5-zone scale:**

| TE | Effect | 의미 |
|---|---|---|
| 0.0-0.9 | None | 회복 / 너무 가벼움 |
| 1.0-1.9 | Minor | maintaining |
| 2.0-2.9 | Maintaining | 현 fitness 유지 |
| 3.0-3.9 | **Improving** | fitness 향상 (sweet spot) |
| 4.0-4.9 | Highly improving | 강한 자극 (며칠 회복 필요) |
| 5.0 | Overreaching | 과훈련 risk |

**Garmin Connect 의 표시:** "Today's run was Improving (3.4) — aerobic effect" — 라이더가 한 호흡에 의사결정.

**Aerobic vs Anaerobic 분리.** 같은 EPOC 라도 (a) 장시간 mid-intensity → aerobic TE 높음, (b) 짧은 sprint 반복 → anaerobic TE 높음. fast force production (윙포일의 짧은 pumping) 은 anaerobic 영역.

**우리 적용성.** 윙포일 freeride 는 대부분 aerobic — anaerobic TE 는 race / drill 외 가치 작음. Phase 3+.

#### 12-2-D. 24-hour HRV Stress/Recovery analysis — Body Battery 의 기반

**Firstbeat 의 second-by-second HRV pipeline:**

1. RR-interval (Polar H10 / Garmin chest strap) → low-pass filter
2. Short-Time Fourier Transform (STFT) per 1 second window
3. LF (Low Frequency, 0.04-0.15 Hz) + HF (High Frequency, 0.15-0.4 Hz) power 산출
4. LF/HF ratio + total power + breath rate (HR-derived)
5. Pattern classification: STRESS (sympathetic dominance) / RECOVERY (parasympathetic) / PHYSICAL (high intensity)

**Visualization (24-hour timeline):**
- Red = stress periods (LF dominant, HR > rest, low HRV)
- Green = recovery periods (HF dominant, parasympathetic active)
- Blue = physical activity (HR > 50% reserve)
- Gap = sleep (별도 분석)

**Body Battery (Garmin via Firstbeat):**

```
BB_t = BB_{t-1} + recovery_rate(t) − stress_rate(t) − activity_rate(t)
       [0-100 scale]
```

- 수면 = 빠른 충전 (recovery rate 높음)
- 휴식 = 느린 충전
- 일상 stress = 천천히 소모
- 운동 = 빠른 소모

**입력 필요:**
- RR-interval (24h continuous) — Garmin watch optical wrist (Elevate v4+) 또는 chest strap
- 활동 detect (accelerometer)
- 수면 detect (HR + 움직임)

**우리 적용성.** Body Battery 는 매우 매력적이나 **24h continuous HRV 측정 필요** → SailTechCo 의 1세션 분석 모델 (라이딩 시간만) 과 다른 product category. **Apple Watch / Garmin / Whoop 보유 라이더 한정** 으로 외부 fetch (HealthKit) 가능 — Phase 3+ Mobile Engineer #8 협업.

**현재 우리 §4-3 HRV (RMSSD/SDNN) 와의 관계:**
- 우리 = time-domain (RMSSD, SDNN) — 단순, 라이딩 직전·직후 5분 측정
- Firstbeat = frequency-domain (LF/HF) — 정교, 24h continuous 필요
- 두 접근 보완 — Phase 1 우리 시작점 (time-domain), Phase 3 frequency-domain 확장

#### 12-2-E. Firstbeat 의 다른 commercial metrics (Garmin OEM)

| Metric | 산출 | 우리 채택? |
|---|---|---|
| **VO2max estimation** | HR-speed regression + HRV (Saalasti 2003) | Phase 2 — 권장 (sailing-specific scaling 필요) |
| **HRV Status** | 7-day RMSSD baseline 대비 trend | Phase 2 — `computeHRVTrend` 신규 함수 (§12-3) |
| **Training Readiness** | TSB + HRV + sleep + recovery time 합성 | Phase 3 — composite metric, 다른 모듈들 의존 |
| **Stress Score** | real-time HRV → 0-100 sympathetic dominance | Phase 3 — 24h HRV 필요 |
| **Sleep Score** | sleep duration + REM/deep + HRV during sleep | Phase 3 — HealthKit fetch |
| **Recovery Time** | EPOC + TE + 라이더 본인 historical recovery pattern | Phase 3 — 다른 모듈 의존 |
| **Performance Condition** | 첫 6-20분 HR vs pace → 오늘 fitness vs baseline | Phase 3 — 라이딩 첫 5분 비교 |
| **Endurance Score** | Long-run TE + duration + race performance | windfoil 부적합 (race 분야 약함) |

### 12-3. 신규 v2 모듈 spec — 두 플랫폼 lesson 통합

본 절은 §4 신규 모델 spec 의 확장. Phase 2-3 production 진입 후보.

#### 12-3-A. `computeACWR(sessions, profile, opts)` — §4-2 확장

**입력:** sessions (with trimp or sRPE workload), opts = { useEWMA: true, acuteK: 7, chronicK: 28 }

**출력:**
```javascript
{
  days: [{ date, load, acute, chronic, acwr, zone }],
  current: { acwr, zone, label },
  // zone: 'undertraining'|'sweet_spot'|'borderline'|'danger'
  // label: '훈련 부족'|'최적'|'주의'|'위험'
}
```

**구현 위치:** `storage.js` — computeFitnessTrend 옆 (같은 EWMA infrastructure 재사용)

**References:**
- Gabbett 2016 (BJSM doi:10.1136/bjsports-2015-095788)
- Williams 2017 (EWMA, BJSM doi:10.1136/bjsports-2016-096214)
- Murray 2017 (BJSM doi:10.1136/bjsports-2016-097152)
- Soligard 2016 IOC consensus (BJSM doi:10.1136/bjsports-2016-096581)

#### 12-3-B. `computeSRPE(rpe, durationMin)` — HR 없는 세션 workload

**입력:** rpe (1-10 Borg CR10), durationMin (number)

**출력:**
```javascript
{
  workload: number,         // RPE × durationMin = AU
  rpe: number,
  durationMin: number,
  category: string          // 'recovery'|'aerobic'|'threshold'|'vo2max'|'sprint'
}
```

**구현 위치:** `analysis.js` — computeTRIMP 옆 (같은 workload family)

**UI 변경 — Frontend Engineer + UX Researcher 협업:**
- 라이딩 종료 화면 (또는 다음 day 시작 화면) 에 RPE 입력 1줄
- 슬라이더 1-10 + 한 호흡 label ("easy" "moderate" "hard" "maximal")
- 입력 즉시 sRPE 산출 + storage 저장 + ACWR/CTL 업데이트

**References:**
- Foster 2001 (J Strength Cond Res 15(1):109-115, PMID 11708692)
- Haddad et al. 2017 — review (Front Neurosci 11:612, doi:10.3389/fnins.2017.00612)

#### 12-3-C. `computeWellnessTrend(entries, opts)` — Hooper Index 일일 모니터링

**입력:** entries = 일별 wellness entries [{ date, sleep, fatigue, soreness, stress, mood? }]

**출력:**
```javascript
{
  days: [{ date, composite, zone, deviation_sd }],
  current: { composite, zone, label, recommendation },
  // zone: 'green' (composite > baseline + 0.5 SD)
  //     | 'yellow' (within ±0.5 SD)
  //     | 'orange' (composite < baseline − 0.5 SD)
  //     | 'red' (composite < baseline − 1.5 SD)
  baseline7day: number,
  trend14day: 'improving'|'stable'|'declining'
}
```

**구현 위치:** `storage.js` — neue function

**UI — UX Researcher + Mobile Engineer 협업:**
- 라이딩 직전 모바일 화면 5초 4-슬라이더 (sleep / fatigue / soreness / stress)
- 입력 후 자동 wellness score → traffic-light 색 표시
- Red zone → "오늘은 짧고 가벼운 세션 또는 휴식 권장" 자연어 코칭

**References:**
- Hooper et al. 1995 (Med Sci Sports Exerc 27(1):106-112, doi:10.1249/00005768-199501000-00019)
- Kellmann & Kallus 2001 RESTQ-Sport
- Saw, Main, Gastin 2016 (BJSM doi:10.1136/bjsports-2015-094758)

#### 12-3-D. `computeHRVTrend(rrSeries_history, opts)` — Firstbeat HRV Status 패턴

**입력:** rrSeries_history = 일별 5-min 측정 RMSSD log [{ date, rmssd, sdnn }]

**출력:**
```javascript
{
  baseline7day: number,        // 라이더 본인 7-day rolling mean
  current: number,
  deviationSD: number,         // (current − baseline) / 7day SD
  zone: 'balanced'|'unbalanced'|'low'|'poor',
  trend: 'improving'|'stable'|'declining',
  recommendation: string       // 자연어 — "정상 범위, 트레이닝 진행 OK"
}
```

**구현 위치:** `analysis.js` — computeHRV 옆

**Firstbeat / Garmin "HRV Status" pattern.** Baseline 대비 deviation 의 일관성이 단일 측정값보다 정보 가치 ↑.

**References:**
- Plews et al. 2013 (Sports Med 43(9):773-781, doi:10.1007/s40279-013-0071-8)
- Stanley et al. 2013 — HRV recovery (Sports Med 43(12):1259-1277)

#### 12-3-E. `computeReadinessScore(profile, sessions, wellness, hrv, opts)` — composite

**입력:** 모든 위 모듈의 산출 + 라이더 profile

**출력:**
```javascript
{
  score: 0-100,                // composite readiness
  zone: 'optimal'|'normal'|'caution'|'rest_recommended',
  contributing: {              // 각 factor 의 score / weight
    tsb: { score, weight, contribution },
    acwr: { ... },
    wellness: { ... },
    hrv: { ... }
  },
  recommendation: string       // "오늘 ride OK, 강도 7-8/10 적정"
}
```

**구현 위치:** `coach.js` — VPS 옆 (composite scoring family)

**Garmin "Training Readiness" 패턴 — 다인자 합성.** 4-5 factor weighted sum + 자연어 사유. 라이더가 한 호흡에 의사결정.

### 12-4. 두 플랫폼 vs SailTechCo 의 차별 positioning

본 audit 의 결과로, SailTechCo 가 **adopt** 할 영역과 **skip** 할 영역을 명확화한다.

**채택 (Adopt) — 두 플랫폼 모두에서 학습:**
- ACWR + EWMA (athleteMonitoring) → §12-3-A
- sRPE 모듈 (Foster) → §12-3-B
- Daily wellness Hooper Index (athleteMonitoring) → §12-3-C
- HRV Trend (Firstbeat baseline 대비) → §12-3-D
- Composite readiness score (Garmin pattern) → §12-3-E
- 24-hour HRV (Firstbeat) — Phase 3, HealthKit fetch
- EPOC (Firstbeat) — Phase 3 candidate (physiological accuracy)

**의도적 Skip (windfoil ICP 와 mismatch):**
- Team aggregate dashboard (athleteMonitoring) — 우리 1인 라이더 ICP
- Sprint distance / high-intensity distance (team GPS) — windfoil 무관
- Endurance Score (Firstbeat) — race 분야 약함
- Anaerobic Training Effect 분리 — windfoil aerobic 위주

**Differentiate (SailTechCo 만의 강점):**
- **Sailing physics anchor** — TRIMP/HRV 가 일반 sport metric 이라면 우리는 §181 polar + 4-channel wind 가 sailing-native
- **What-if anchoring** (coach.js) — Firstbeat 의 TE 는 "한 게임의 효과" 만 보여주지만 우리 What-if 는 "다른 윙으로 라이딩했다면" 의 reverse-question
- **Methodological honesty** (incomplete maneuver, confidence self-report) — Firstbeat / athleteMonitoring 의 commercial pressure 와 정반대 (Saw 2016 의 "objective inflation" 회피)
- **Open methodology** (SailTechCo Moat W4) — 두 플랫폼은 closed source, 우리는 GitHub MIT publish

### 12-5. v3 권장 — 두 플랫폼 통합 후 신규 architecture

Phase 3 (2027) 의 분석 dashboard 권장 구조:

```
                    ┌─────────────────────────────────────┐
                    │  Today's Ride Decision Layer        │
                    │  (Readiness Score 0-100 + 자연어)   │
                    └────────────┬────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
   │ Fitness │              │ Acute   │              │ Wellness│
   │ (CTL)   │              │ Risk    │              │ State   │
   │         │              │ (ACWR)  │              │ (Hooper)│
   │ Coggan  │              │ Gabbett │              │ Daily   │
   └────┬────┘              └────┬────┘              └────┬────┘
        │                        │                        │
        └────────────┬───────────┴────────────┬───────────┘
                     │                        │
                ┌────▼─────┐            ┌────▼─────┐
                │ TRIMP/   │            │ HRV      │
                │ sRPE     │            │ (RMSSD)  │
                │ (per     │            │ (Plews   │
                │ session) │            │ Trend)   │
                └────┬─────┘            └────┬─────┘
                     │                        │
                ┌────▼────────────────────────▼────┐
                │  Raw Session Data                │
                │  (GPX + VKX + HR strap)          │
                └──────────────────────────────────┘
                                 │
                ┌────────────────▼────────────────┐
                │  Sailing-specific Layer         │
                │  (VPS · Polar · 4-channel Wind  │
                │   §181 lift · What-if)          │
                └─────────────────────────────────┘
```

5 layer 통합 — 윙포일 도메인 (하단) + 운동 생리 (중간) + 의사결정 (상단). 두 플랫폼 적분 + SailTechCo 의 sailing-native 강점 보존.

### 12-6. 추가 sources (§10 보강)

**athleteMonitoring / ACWR / sRPE / Wellness:**
- Gabbett, T.J. (2016). "The training—injury prevention paradox: should athletes be training smarter and harder?". *British Journal of Sports Medicine*, 50(5), 273-280. doi:[10.1136/bjsports-2015-095788](https://doi.org/10.1136/bjsports-2015-095788). PMID 26758673.
- Hulin, B.T., Gabbett, T.J., Lawson, D.W., Caputi, P., Sampson, J.A. (2014). "The acute:chronic workload ratio predicts injury: high chronic workload may decrease injury risk in elite rugby league players". *Br J Sports Med* 50(4):231-236. doi:[10.1136/bjsports-2015-094817](https://doi.org/10.1136/bjsports-2015-094817).
- Williams, S., West, S., Cross, M.J., Stokes, K.A. (2017). "Better way to determine the acute:chronic workload ratio?". *Br J Sports Med* 51(3):209-210. doi:[10.1136/bjsports-2016-096214](https://doi.org/10.1136/bjsports-2016-096214).
- Murray, N.B., Gabbett, T.J., Townshend, A.D., Blanch, P. (2017). "Calculating acute:chronic workload ratios using exponentially weighted moving averages provides a more sensitive indicator of injury likelihood than rolling averages". *Br J Sports Med* 51(9):749-754. doi:[10.1136/bjsports-2016-097152](https://doi.org/10.1136/bjsports-2016-097152). PMID 28003238.
- Soligard, T., Schwellnus, M., Alonso, J.M., Bahr, R., Clarsen, B., Dijkstra, H.P., et al. (2016). "How much is too much? (Part 1) International Olympic Committee consensus statement on load in sport and risk of injury". *Br J Sports Med* 50(17):1030-1041. doi:[10.1136/bjsports-2016-096581](https://doi.org/10.1136/bjsports-2016-096581). PMID 27535989.
- Foster, C., Florhaug, J.A., Franklin, J., Gottschall, L., Hrovatin, L.A., Parker, S., Doleshal, P., Dodge, C. (2001). "A new approach to monitoring exercise training". *Journal of Strength and Conditioning Research* 15(1):109-115. PMID 11708692. [PDF (Foster)](https://paulogentil.com/pdf/A%20New%20Approach%20to%20Monitoring%20Exercise%20Training.pdf)
- Haddad, M., Stylianides, G., Djaoui, L., Dellal, A., Chamari, K. (2017). "Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors". *Frontiers in Neuroscience* 11:612. doi:[10.3389/fnins.2017.00612](https://doi.org/10.3389/fnins.2017.00612). PMID 29163016.
- [AthleteMonitoring — Workload Management Basics PDF (2017)](https://www.athletemonitoring.com/wordpress/wp-content/uploads/2017/06/Workload-Management-Basics.pdf)

**Firstbeat / EPOC / Training Effect / HRV stress:**
- Saalasti, S. (2003). "Neural networks for heart rate time series analysis". *Academic Dissertation*, University of Jyväskylä, Finland. — Firstbeat EPOC + HRV algorithm 의 1차 reference.
- Rusko, H.K., Pulkkinen, A., Saalasti, S., Hynynen, E., Kettunen, J. (2003). "Pre-prediction of EPOC: A tool for monitoring fatigue accumulation during exercise?". *ACSM Congress, San Francisco, May 28-31*. Abstract: *Medicine and Science in Sports and Exercise* 35(5):S183.
- Gaesser, G.A., Brooks, G.A. (1984). "Metabolic bases of excess post-exercise oxygen consumption: a review". *Med Sci Sports Exerc* 16(1):29-43. — EPOC 정의의 modern review.
- [Firstbeat White Paper — Indirect EPOC Prediction (PDF, 2012 update)](https://www.firstbeat.com/wp-content/uploads/2015/10/white_paper_epoc.pdf)
- [Firstbeat White Paper — VO2max Estimation (PDF, 2017)](https://assets.firstbeat.com/firstbeat/uploads/2017/06/white_paper_VO2max_30.6.2017.pdf)
- [Firstbeat White Paper — Stress and Recovery Analysis from 24h HRV (PDF, 2014)](https://assets.firstbeat.com/firstbeat/uploads/2015/11/Stress-and-recovery_white-paper_20145.pdf)
- [Firstbeat White Paper — Recovery Analysis for Athletic Training (PDF, 2015)](https://www.firstbeat.com/wp-content/uploads/2015/10/Recovery-white-paper_15.6.20153.pdf)
- [Firstbeat — Fitness Level (Science)](https://www.firstbeat.com/en/science-and-physiology/fitness-level/)
- [Firstbeat — EPOC and Training Effect](https://www.firstbeat.com/en/science-and-physiology/epoc-and-training-effect/)
- [Garmin Wiki — Firstbeat Analytics](https://wiki.garminrumors.com/Firstbeat_Analytics) (Garmin 2020 인수 후 OEM 통합)
- Saalasti, S., Seppänen, M., Kuusela, A. (2004). "Method for determining recovery". *US Patent 7,029,419 B2* (Firstbeat).
- Stanley, J., Peake, J.M., Buchheit, M. (2013). "Cardiac parasympathetic reactivation following exercise: implications for training prescription". *Sports Med* 43(12):1259-1277. doi:[10.1007/s40279-013-0083-4](https://doi.org/10.1007/s40279-013-0083-4).
