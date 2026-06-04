# 리프팅 계산기 계산식 전수 재조사 보고서

- **작성**: 티모 강 (운동·라이딩 분석) · 2026-06-04
- **지시**: 옥대표님 — "계산식 전체를 면밀히 재조사하고 결과 보고서만 제출. 당장 고치지는 말고."
- **대상**: `assets/js/lift-calculator.js` (1826줄, primary) · `calculator.html` · `data/foil-presets.js` · `calculator-pwa/js/lift-calculator.js` · `_ci_site/assets/js/lift-calculator.js`
- **코드 수정**: 0건 (조사·보고만 — 본 md 1개 신규)
- **수치 검증**: node v22.22.0 실제 실행 (아래 §4 — 전부 실측 출력)

## 0. 사본 diverge 확인

| 파일 | md5 | 판정 |
|---|---|---|
| `assets/js/lift-calculator.js` | `631a405a…` | canonical |
| `_ci_site/assets/js/lift-calculator.js` | `631a405a…` | **동일** (byte-identical) |
| `calculator-pwa/js/lift-calculator.js` | `774eab44…` | **comment-only diverge** — §176 블록의 References 주석 19줄(Anderson/Faltinsen/Folkersma/Larsson/Garrett 인용 + "Calibration anchors §181-C·D·E" 메모)이 PWA 사본에 누락. **실행 코드는 100% 동일** (diff 잔여분 전수 확인). |

→ 기능 회귀 위험 없음. 단, 향후 수정 시 PWA 사본 동시 갱신 누락이 재발할 수 있는 구조 (3벌 수동 동기화).

`calculator.html` 은 `window.DMJLift` API 호출만 하고 인라인 수식 없음 (확인 완료). `data/foil-presets.js` 는 spec 데이터만 (수식 없음).

---

## 1. 구현된 수식 전체 추출

### 1-A. Takeoff 모델 — `calculate()` (L133-179) + `vMinMs()` (L89-96)

| 수식 | 코드 |
|---|---|
| 양력 방정식 $L = \tfrac{1}{2}\rho V^2 A C_L$, takeoff 임계 $L \ge M_{tot}\,g$ | 주석 L5-8 |
| $V_{min} = \sqrt{\dfrac{2 M_{tot}\, g}{\rho\, A\, C_L}}$, $M_{tot} = M_{rider} + M_{gear}$ | L95 |
| $V_{target} = V_{min} \cdot f_{pump} \cdot f_{surface}$ | L152 |
| feasible: $V_{target,kt} \le V_{wind,kt} + 3$ ("apparent wind 추정" 고정 +3kt) | L155 |
| $C_L(AR)$ step: AR<5→1.15 / 5≤AR≤8→1.00 / AR>8→0.85 | L63-68 |

### 1-B. windBoost / 추천 윙 역산 — §175/§177/§178

| 수식 | 코드 |
|---|---|
| $\text{boost}(W) = \max(0.5,\; W - 2)$ [kt] — 윙 면적 1m²당 +1kt 선형 | L449-452 |
| takeoff 최소 윙: $W_{min,takeoff} = \max(2.5,\; (V_{target} - V_{wind}) + 2)$ | L518, L615 |
| comfort floor: $W_{floor} = \max\!\big(2.5,\; \max(3.0,\, 9.0 - 0.3 V_{kt}) \cdot \tfrac{M_{tot}}{80} \cdot s_{pump}\big)$, $s_{pump} \in \{0.85, 1.00, 1.15\}$ | L469-481 |
| 최종: $W_{min} = \max(W_{min,takeoff},\, W_{floor})$ → 라인업 [3.0…7.4] sweep, 조건 $V_{target} \le V_{wind} + \text{boost}(W)$ AND $W \ge W_{min}$ | L520-536 |
| extreme 시: $V_{wind,min} = V_{target} - \text{boost}(7.4)$ · $A_{foil,min} = \dfrac{2 M_{tot} g}{\rho\, C_L\, v_{min,max}^2}$, $v_{min,max} = \dfrac{V_{wind}+\text{boost}(7.4)}{f_{pump} f_{surf}}$ | L556-569 |

### 1-C. 풍상 폴라 — `upwindSpeed()` / `stateAt()` (L972-1100)

| 수식 | 코드 |
|---|---|
| apparent wind: $V_a^2 = V_b^2 + V_t^2 + 2 V_t V_b \cos\theta_{tack}$ | L1014 |
| $\cos\beta = (V_b + V_t\cos\theta_{tack})/V_a$ | L1020 |
| heel cap: $L\cos\beta \le H_{max} \Rightarrow C_L \le \dfrac{2 H_{max}}{\rho_{air} V_a^2 A \cos\beta}$, $C_L = \min(C_{L,eff,max},\, C_{L,heel})$ | L1025-1028 |
| $C_{L,eff,max} = C_{L,max} \cdot \eta_{skill}$ ($C_{L,max}$=1.00, §181-D lock) | L1004 |
| **§181 옵션 C** 순추력: $C_T = C_L\!\left(\sin\beta - \dfrac{\cos\beta}{LD_{wing,eff}}\right) - C_{D0,par}\cos\beta$, $T = \tfrac{1}{2}\rho_{air} V_a^2 A \cdot C_T$ ($C_T>0$일 때만) | L1033-1035 |
| 포일 항력 (cruise, L=Mg): $D_{foil} = \dfrac{M_{tot}\, g}{LD_{foil} \cdot \eta}$ | L1005 |
| **§181-E** heel↔면적 결합: $H_{max} = M_{tot}\, g \tan\theta_{heel} \cdot \left(\dfrac{A}{7.5}\right)^{-1.2}$ | L1009-1011 |
| L/D 모델: $LD_{foil} = 9.13\sqrt{AR_{foil}}$ (L799) · $LD_{wing} = 2.2\sqrt{AR_{wing}}$ (§181-C, L808-809) · 둘 다 ×η | L999-1002 |
| 평형 탐색: $V_b \in [0, 35\text{kt}]$ 0.1kt sweep, $T \ge D_{foil}$ 인 **최대** $V_b$ | L1051-1063 |
| VMG: $V_{VMG} = V_{boat}\cos\theta_{tack}$ (tack = TWA 고정 — 입문65/초급60/중급55/상급50/선수45/상급-선수47°) | L1074, L787-790 |

### 1-D. 역U자 곡선·추천 — `upwindCurve()` (L1317) / `wingRecommendation()` (L1376)

- 면적 sweep (기본 2.0~9.5, 0.25 step) → VMG 최대점 = performance.
- practical = performance − gust offset {clean 0 / light 0.5 / heavy 1.0 m²}, 최소 feasible 윙으로 클램프 (§181-G).

### 1-E. heel 곡선 — `heelMaxWingCurve()` (L1424)

$$A_{max}(\theta) = \frac{2 M_{tot}\, g \tan\theta}{\rho_{air} V_a^2\, C_{L,eff,max} \cos\beta} = K \tan\theta$$

$V_a, \beta$ 는 기준윙 5.5m² 운항점에서 1회 추출 고정. 풍상 불가 시 $V_a = k_v \cdot V_t$ (스킬별 $k_v$ 1.10~1.70), $\beta$=35° fallback (L1451-1452).
⚠ **주의**: 이 곡선의 $H_{max}$ 에는 §181-E 결합 $(A/7.5)^{-1.2}$ 가 **미적용** — `upwindSpeed` 내부와 불일치 (이슈 I-6).

### 1-F. 경험식 옵티마이저 — `wingSizeOptimal()` (L1551, 진단 전용으로 강등됨)

$$A_{opt} = 25.124 \cdot \frac{M_{tot}}{75} \cdot \sqrt{\frac{33.79}{9.13\sqrt{AR_{foil}}}} \cdot \sqrt{\frac{0.92}{\eta}} \cdot f_{pref} \cdot V_{kt}^{-0.5683}$$

apparent wind 는 $V_{app} = k_v \cdot V_{true}$ 선형 (L1574-1575). $A_{min,drive} = \dfrac{2 F_{aero,min}}{\rho_{air} V_{app}^2 C_{eff}}$, $F_{aero,min} = \dfrac{M g / LD_{foil}}{\sin\alpha}$, $\alpha = \arctan(1/LD_{wing,eff})$ (L1597-1604). 윙팁 clearance: $A \le (2 \cdot \text{reach})^2/AR_{wing}$, reach = 신장/100 + 0.6 + 마스트/200 (L1607-1611).

### 1-G. 사용되지 않는 (dead) 수식 — §179 폴라

`ldWingAtCL(cl, ar)` (L833-838): $CD = 0.098 + \dfrac{C_L^2}{\pi \cdot 0.42 \cdot AR}$, `clOptWing(ar)` = $0.360\sqrt{AR}$ (L839). **두 함수 모두 어디서도 호출되지 않음** (전체 사이트 grep 확인 — 선언만 3벌 존재). §179 주석이 설명하는 "depower 시 L/D 폭락" 메커니즘은 실제 `stateAt()` 에 구현되어 있지 않다 (이슈 I-4).

---

## 2. 상수 전수 표

| 상수 | 값 | 위치 | 출처 | Lock | 신뢰도 |
|---|---|---|---|---|---|
| ρ_sea / ρ_fresh | 1025 / 1000 kg/m³ | L38-39 | 표준 물성 | §103/§123 | **높음** (교과서 값) |
| g | 9.81 m/s² | L40 | 표준 | — | 높음 |
| GEAR_MASS (takeoff) | **10 kg** | L41 | 추정 | §117 | 중간 — 슈트+하네스 합으로는 다소 큼 |
| WING_OPT.GEAR_DEFAULT (풍상) | **5 kg** | L709 | Danny 보정 | §170 | ⚠ takeoff(10)와 **이중 default** (이슈 I-7) |
| C_L step 1.15/1.00/0.85 | AR<5 / 5-8 / >8 | L63-68 | 추정 (curated) | §103 | **낮음** — §170 v8 한계 기록 그대로. AR 8.0→8.01 에서 C_L 15% 점프 = v_min 8% 점프 (실측 확인, §4-1) |
| pump factor 1.15/1.05/0.95 | easy/mod/hard | L46-50 | 추정 | §103 | 중간 (방향 타당, 크기 미검증) |
| surface factor 1.00/1.05/0.95/1.00 | flat/choppy/swell/mixed | L55-60 | Danny 도메인 판단 | §123·§124 | 중간 |
| feasible 여유 +3 kt | 고정 | L155 | "apparent wind 추정" | §102 | 낮음 — windBoost(5.0m²)=3 과 일치하도록 후행 정당화됨 (§175 주석) |
| windBoost = max(0.5, W−2) | 선형 | L451 | **순수 휴리스틱** | §175 | **낮음** — 물리 차원 없음 (m²→kt 직접 변환) |
| comfort floor 9.0−0.3V, mass/80, pump 0.85/1.0/1.15 | — | L469-481 | 업계 사이즈차트 (Cabrinha/Duotone/Naish) linear fit | §178/§178b | 중간 — 80kg freeride 기준; **외삽 시 라인업 초과** (이슈 I-1) |
| ρ_air | 1.225 kg/m³ | L707 | 표준 (해수면 15°C) | — | 높음 |
| LD_foil 계수 9.13 | $9.13\sqrt{AR}$ | L799 | 이론 도출: $\tfrac{1}{2}\sqrt{\pi e AR/C_{D0}}$, e=0.85, CD0=0.008 → 9.14 (실검산 일치) | §170 v7 | 중간 — 식 자체는 표준이나 CD0=0.008 은 매우 clean한 가정 (실포일 0.01~0.015), AR13.7→L/D 33.8 은 윙포일 실전 대비 낙관적 |
| **LDWING_K 2.2** | $2.2\sqrt{AR}$ | L808 | **단일 anchor 재보정** (11kt→18.3kt). 이론값 1.83 ($\tfrac{1}{2}\sqrt{\pi\cdot0.42\cdot AR/0.098}$=1.83, 검산 일치) 을 +20% 상향 | **§181-C lock** | 낮음 — anchor 1점, 단일 라이더 |
| **UPWIND_VB_CAP_KT 35** | sweep 상한 | L815 | sanity guard | **§181-C lock** | 주석 "8-25kt 실사용역에서 binding 안 됨" → **실측 반증: 24-25kt 에서 binding** (§4-3, 이슈 I-3) |
| CL_WING_MAX 1.00 | 실효 지속 peak C_L | L791 | 2D peak 1.2 (Folkersma) → Danny anchor 재보정 | **§181-D lock** | 중간 — 물리 논거(3D·트위스트·디파워)는 타당 |
| **WING_CD0_PARASITIC 0.04** | 윙 형상 항력 | L911 | "윙포일 표준 baseline" — 문헌 인용 없음, 미보정 명시 | **§181 lock** | 낮음 — LD_wing(2.2√AR)에 이미 profile drag 포함 → **부분 이중계상** (이슈 I-4) |
| **WING_HEEL_COUPLE_EXP −1.2** | $(A/7.5)^{-1.2}$ | L941 | §181 v2 에서 0 → §181-E 에서 −1.2 (Danny anchor) | **§181-E lock** (※과제 지시문의 "지수 0"은 §181 v2 시점 — 현재 코드는 −1.2) | 낮음 — 부호는 물리(모멘트암), 크기는 1-rider fit. 2.5m² 윙에서 H_max ×3.74 (실측, §4-5) = 비물리적 |
| WING_AREA_REF_M2 7.5 | 결합 피벗 | L940 | §181-E anchor 고정용 | §181-E lock | 낮음 (anchor 종속) |
| WING_CD0 0.098 / WING_E 0.42 | §179 폴라 | L831-832 | Folkersma 2019 (LEI airfoil) | §179 | 높음(출처) — 단 **dead code** |
| η (skill) 0.45/0.60/0.75/0.88/0.95/0.92 | — | L745-752 | Danny 자기보정 (η_REF=0.92) | §170 v10 | 낮음~중간 — 1-rider. L/D·C_L·thrust 에 동일 η 곱하는 단일 스칼라 단순화 |
| HEEL_DEG 9/19/29/39/42/41 | — | L716-719 | Danny 실측 (§176-B sustained 한계) | §176-B | 중간 |
| TACK_ANGLE 65/60/55/50/45/47° | TWA | L787-790 | Danny 코칭 경험, 5° 균등 (iQFOiL 50-55° 는 reference 강등) | §176-E | 중간 — 선수 45° TWA 는 윙포일에선 공격적 (iQFOiL race 도 50° 내외) |
| KV_BY_SKILL 1.10~1.70 | $V_{app}=k_v V_t$ | L735-738 | 추정 | §170 | 낮음 — 보드속도 무관 고정 배수 (wingSizeOptimal·heel 곡선 fallback 에만 사용) |
| K_MASTER 25.124 / BETA 0.5683 / M_REF 75 / LD_FOIL_REF 33.79 | 경험식 | L702-711 | Danny 6-pt 매트릭스 log-log 회귀 | §170 v7 | 해당 매트릭스 내 높음 / 외삽 낮음 — 현재 진단 전용 |
| WING_LINEUP [3.0…7.4] | — | L446 | 사이트 SKU | §175 | — |
| GUST_OFFSET 0/0.5/1.0 m² | — | L1374 | Danny 결정 | §181-G | 중간 |
| 5.5 m² ref wing (heel 곡선) / β=35° fallback | — | L1438, L1449 | 추정 | §181-B | 낮음 |
| reach = h/100 + 0.6 + mast/200 | clearance | L1608 | 기하 추정 | §170 v7 | 중간 |

---

## 3. 물리적 타당성 평가

### 3-1. 핵심 골격 — **타당**
- 양력 방정식·$V_{min}$ 역산·ρ 분기·질량 합산: 교과서 그대로, 오류 없음.
- 풍상 폴라의 벡터 기하 ($V_a$ cosine rule, β 정의, thrust 계수 $\sin\beta - \cos\beta/LD$): Anderson·Garrett 표준과 일치. **이 부분은 잘 만들어진 모델이다.**
- heel 측면력 한계 $H_{max} = Mg\tan\theta$: Larsson (Principles of Yacht Design) 표준.
- 유도항력 기반 $LD_{max} = \tfrac{1}{2}\sqrt{\pi e AR / C_{D0}}$ 도출: 계수 9.13(포일)·1.83(윙 이론값) 모두 검산 일치 (9.14 / 1.83).
- VMG = $V_b\cos(\text{TWA})$: 정의 그대로.

### 3-2. (a) windBoost 선형화 — **휴리스틱, 물리 아님**
`boost(W) = max(0.5, W−2)` 는 윙 면적[m²]을 풍속[kt]로 직접 더하는 차원 불일치 식. "5.0m² 에서 +3kt = 기존 baseline 일치" 는 보정이 아니라 정의의 재서술이다. 실제 takeoff 가능 여부는 윙 추력 $T \propto \tfrac{1}{2}\rho_{air} V_a^2 A C_L$ 이 보드+포일 저항을 이기는가의 문제 → 면적에 선형이되 **풍속² 가중**이어야 하는데 풍속 독립 선형. §178 comfort floor 가 이 약점을 가리는 패치로 들어왔고, 실측 결과(§4-6) 27개 대표 케이스 **전부 comfort floor 가 binding** — 즉 추천 윙 산출에서 양력 방정식·windBoost 는 사실상 작동하지 않고 업계 사이즈차트 fit 만 작동한다. 모델 구조가 "물리 모델 + 보정"이 아니라 "차트 lookup 에 물리 모델이 장식"인 상태.

### 3-3. (b) C_L step function — §170 v8 한계 그대로 + 경계 불연속
- AR 8.00→8.01 에서 C_L 1.00→0.85 (−15%) → $V_{min}$ +8.5% 점프 (실측 §4-1). Levitaz FW680 (AR 8.7) 과 가상의 AR 7.9 포일이 면적 같아도 takeoff 속도가 8% 다르게 나옴 — 사용자에겐 설명 불가능한 절벽.
- AR>8 전부 0.85: FW790(10.3)·FW900(13.3)·R6 V3(14.3) 모두 동일 C_L → within-class 차별 0 (§170 v8 기록 그대로 유효).
- 물리적으로 takeoff C_L 은 받음각·캠버·플랩 효과의 함수이고 AR 과의 관계는 3D lift-slope $a = a_0/(1+a_0/(\pi e AR))$ 로 **연속** — step 이 아닌 smooth 함수가 표준. 예: $C_{L,TO}(AR) = C_{L,2D} \cdot \dfrac{AR}{AR+2}$ 같은 Helmbold 근사면 단조·연속으로 같은 경향 재현 가능.

### 3-4. (c) heel 지수 — 현재 코드는 0 이 아니라 **−1.2** (§181-E)
과제 지시문 맥락(§181 옵션 C "heel 지수 0")은 §181 v2 시점이고, 5/22 §181-E 에서 −1.2 로 재변경되어 있다 (둘 다 DO_NOT_REVERT 주석 존재 — **lock 이력이 서로 교체된 상태**, 최신 lock = §181-E).
- 지수 0 의 의미: heel↔면적 결합 비활성 = "$H_{max}$ 는 라이더 체중·기울임으로만 결정" — 1차 물리로는 맞는 논증.
- 지수 −1.2 의 의미: 큰 윙 = CE 높음 = 같은 측면력에도 전복 모멘트 큼 → 실을 수 있는 측면력 ↓. **부호(−)는 물리적으로 옳다.** 그러나 (i) 크기 −1.2 는 단일 라이더 anchor fit, (ii) 멱함수 형태 자체가 모멘트 물리 ($H_{max,eff} \propto 1/h_{CE}$, $h_{CE} \propto \sqrt{A}$ → 지수 ≈ −0.5)에서 도출되는 값(−0.5)의 2.4배, (iii) **소형 윙 쪽 발산**: 2.5m² 에서 $H_{max}$ ×3.74 (§4-5) — 작은 윙을 들면 라이더 측면력 한계가 4배가 된다는 뜻으로, 윙 면적이 라이더 신체 능력을 바꾼다는 비물리적 외삽. 강풍 소형윙 영역의 V_boat 과대예측 원천.
- 결합이 `heelMaxWingCurve()` 에는 미적용 (1-E) → 동일 화면의 두 그래프(역U자 vs heel 곡선)가 서로 다른 $H_{max}$ 물리를 사용.

### 3-5. (d) 단일 anchor 재보정 외삽 위험 — **확인됨**
- §181-C: LDWING_K 1.83→2.2 (+20%) 는 anchor 1점(11kt·80kg·상급-선수·7m²·AR13.7)에 맞춘 것. L/D 상향은 **모든 풍속·스킬·면적**에 일괄 적용되므로 anchor 에서 먼 영역(강풍·저스킬)일수록 검증 부재. 실측: 상급 18kt·5m²(AR8.7 freeride 포일)에서 V_boat 29.9kt / VMG 19.2kt (§4-2) — TWA 50° 풍상에서 풍속의 1.66배 보드속도. iQFOiL(전용 race 장비) 풍상 VMG 실측이 10-13kt 급임을 감안하면 **계통적 과대예측** 가능성 높음. anchor 자체(11kt→18kt 풍상)도 상급-선수 단일 사례.
- §181-C 가 1.83(이론·문헌)을 버리고 2.2 를 택한 대신, "cosβ/LD 항 과대" 의 진짜 원인일 수 있는 **CD0_PARASITIC 이중계상(아래 I-4)** 을 남겨둔 채 L/D 를 키워 상쇄한 구조 — 두 오차가 서로 가리는 형태라 한쪽만 고치면 anchor 가 깨진다 (§181-D 주석도 같은 종속성을 인정: "CD0 0.08 검증 시 anchor 18.1→15.9 회귀").
- §181-D(CL 1.2→1.00)·§181-E(지수 −1.2, 피벗 7.5)도 모두 anchor 보존을 명시적 제약으로 둔 연쇄 보정 → **상수 5개(2.2 / 35 / 1.00 / −1.2 / 7.5)가 한 라이더의 2~3개 관측점에 과적합(overfit)된 사슬**. 코드 주석 스스로 "Multi-rider 일반화 검증 plan" 을 인정함 (L970-971).

### 3-6. 기타 평가
- **η 단일 스칼라**: L/D_foil·L/D_wing·C_L_max 에 같은 η 를 곱함 → 입문 라이더는 포일 L/D 도 45%로 폭락 ($D_{foil}$ 2.2배). 방향은 맞으나 스킬이 항력을 2배로 만든다는 크기는 과격 — 입문이 8~15kt 전 구간 풍상 불가(§4-2)로 나오는 주 원인. 직관적으론 그럴듯하나 검증 근거 없음.
- **takeoff +3kt 고정 여유** vs **windBoost(size)**: `calculate().feasible` 은 윙 사이즈 무관 +3kt, `recommendMinFeasibleWingSize` 는 size-aware — 같은 입력에서 "feasible=true" 인데 추천 엔진은 "EXTREME(어떤 윙도 불가)" 을 내는 모순 가능 (실측: 90kg·FW680·9kt → feasible=true / rec=null, §4-6).
- **upwind 평형 선택**: sweep 에서 $T \ge D$ 인 **최대** $V_b$ 선택 — $T-D$ 곡선이 단봉이면 안정 평형점으로 옳다. 면적 0.1m² 간격 fine sweep 에서 1.5kt 초과 점프 0건 (실측) → 수치적 병리는 미관측. 다만 다중 근 보장 로직은 없음 (현재 데이터 범위에선 문제 미발현).
- **보드 부력·보드 항력 무시** (cruise): 의도된 단순화 (Danny 5/19 명시) — cruise 영역 한정으론 수용 가능.

---

## 4. 수치 검증 (node v22.22.0 실행 — 추측 아님)

### 4-0. 내장 테스트
```
runSelfTest:        62/62 ALL PASS
runDannyMatrixTest: PASS (max |Δraw| = 0.131 m² ≤ 0.30)
```

### 4-1. Takeoff $V_{min}$/$V_{target}$ (kt) — sea·flat·moderate·gear 10kg

| 포일 (AR) | 60kg | 75kg | 90kg | feasible @10/15/20kt |
|---|---|---|---|---|
| FW900 (13.3) | 8.1 / 8.5 | 9.0 / 9.4 | 9.7 / 10.2 | 전부 true |
| FW790 (10.3) | 8.7 / 9.1 | 9.6 / 10.0 | 10.4 / 10.9 | 전부 true |
| FW680 (8.7) | 9.4 / 9.8 | 10.3 / 10.8 | 11.2 / 11.7 | 전부 true |

단조성 ✓ (면적↑→v_min↓, 체중↑→v_min↑). 절대값도 윙포일 takeoff 체감(8~12kt 보드속도)과 합리적.
**단, 세 포일 모두 AR>8 → C_L 0.85 동일** — 차이는 순수 면적비뿐. C_L step 경계 실측: `getCL(8.0)=1.00, getCL(8.01)=0.85` → $V_{min}$ ×√(1.00/0.85) = **+8.5% 불연속**.

### 4-2. 풍상 V_boat/VMG (kt) — 70+10kg, 윙 5.0m² AR4.5, 포일 AR8.7

| 스킬 | 8kt | 10kt | 12kt | 15kt | 18kt | 20kt | 25kt |
|---|---|---|---|---|---|---|---|
| 입문 | X | X | X | X | 6.8/2.9 | 12.0/5.1 | 13.8/5.8 |
| 초급 | X | X | X | 13.6/6.8 | 19.9/9.9 | 21.4/10.7 | 24.5/12.2 |
| 중급 | X | X | 13.9/8.0 | 21.9/12.6 | 26.0/14.9 | 27.8/15.9 | 31.5/18.1 |
| 상급 | X | 12.0/7.7 | 18.2/11.7 | 25.8/16.6 | 29.9/19.2 | 31.9/20.5 | **35.0**/22.5 |
| 선수 | X | 12.0/8.5 | 17.8/12.6 | 25.0/17.7 | 29.1/20.6 | 31.0/21.9 | **35.0**/24.7 |

- 풍속·스킬 단조성 ✓ (wind 6→30kt fine sweep 비단조 0건).
- **이상 1**: 25kt 셀의 35.0 = cap 정확히 binding (아래 4-3).
- **이상 2 (물리)**: 상급 18kt → 보드 29.9kt (풍속의 1.66배, TWA 50° 풍상) — 과대예측 의심 (§3-5).
- **이상 3**: 입문은 15kt 까지 풍상 전면 불가 — η=0.45 의 과격함 (방향성은 교육적으로 수용 가능하나 크기 근거 없음).

### 4-3. V_b cap 35kt binding 스캔 (상급·5.0m²·AR8.7·70+10kg)
```
wind 24~30kt 전 구간에서 V_boat = 35.0 (cap binding)
```
→ §181-C 주석 "35 = 8-25kt 실사용역에서 binding 되지 않는 guard" 는 **24-25kt 에서 이미 반증됨**. cap binding 은 "포화 평탄" 그래프로 노출됨.

### 4-4. §181-C/D/E anchor 재현 + 역U자 정점
```
§181-C anchor (11kt·80kg+5·상급-선수·7m²·AR13.7): V_boat 18.1 kt  → 문서값 18.1 일치 ✓
역U 정점 — 10kt/70+5/상급-선수/AR13.7: 7.5 m² ✓ (§181-D 문서 일치)
역U 정점 — 12kt/70+5/중급/AR6.5: 6.75 m² (§181-D 문서값 6.25 와 0.5m² 상이 — §181-E 후 재기록 안 됨)
선수/70+5/AR13.7 풍속별 정점: 8kt 9.5 / 10kt 7.5 / 12kt 6.25 / 14kt 5.25 / 16kt 4.5 / 18kt 4.0 / 20kt 3.0  → §181-E 문서표와 일치 ✓
12kt 중급 곡선 형태: 4.0:4.1 → 6.5:9.0 (정점) → 9.5:7.1  — 깨끗한 역U ✓
```

### 4-5. heel 결합 인자 실측 $(A/7.5)^{-1.2}$
```
2.5m²→×3.74  3.0→×3.00  4.0→×2.13  5.0→×1.63  6.0→×1.31  7.5→×1.00  9.0→×0.80
```
→ 소형 윙에서 라이더 측면력 한계 최대 3.7배 — 비물리적 외삽 (§3-4).

### 4-6. 추천 윙 (recommendMinFeasibleWingSize) — 27 케이스 매트릭스

| 포일 | 체중 | 10kt | 15kt | 20kt |
|---|---|---|---|---|
| FW900 | 60 | 5.5 | 4.0 | 3.0 |
| FW900 | 75 | 6.5 | 5.0 | 3.5 |
| FW900 | 90 | **EXTREME** | 6.0 | 4.0 |
| FW790 | 60/75/90 | 5.5 / 6.5 / **EXTREME** | 4.0 / 5.0 / 6.0 | 3.0 / 3.5 / 4.0 |
| FW680 | 60/75/90 | 5.5 / 6.5 / **EXTREME** | 4.0 / 5.0 / 6.0 | 3.0 / 3.5 / 4.0 |

- **27/27 전부 binding='comfort'** — takeoff 물리(양력 방정식·windBoost)가 추천을 결정한 케이스 0건.
- **버그 실측 — 90kg @10kt EXTREME 케이스 출력**:
```json
{ "recommended_size_m2": null, "extreme": true, "binding": "comfort",
  "precise_comfort_floor_m2": 7.5, "precise_takeoff_min_m2": 2.5,
  "min_wind_kt": 4.9, "min_foil_area_cm2": 400 }
```
  floor 7.5 > 라인업 max 7.4 (0.1m² 차)로 extreme 인데, 안내값이 "**최소 풍속 4.9kt**" (이미 10kt인데!) + "**최소 포일 400cm²**" (현재 900cm² 보다 **작은** 포일로 바꾸라는 역방향 안내). 원인: extreme 분기(L556-569)가 takeoff-deficit 만 역산하고 comfort-floor binding 을 모름. floor 는 풍속↑일수록 줄어드므로 올바른 안내는 "풍속 ≥ ~10.3kt" 또는 "체중 기준 라인업 초과 — 7.4m² + 주의" 여야 함.
- **모순 실측**: 90kg·FW680·9kt → `calculate().feasible = true` (v_target 11.7 ≤ 9+3 는 false인데… 정확히는 10kt 케이스에서, 같은 입력으로 calculate 는 feasible=true / 추천 엔진은 EXTREME) — UI 가 "부상 가능" 과 "어떤 윙도 불가" 를 동시에 표시할 수 있는 구조.

### 4-7. 이중계상 정량 (모델 CD = CL/LD_eff + 0.04 vs §179 참조 폴라, 상급 η0.88·AR4.5)

| C_L | 모델 합성 CD | §179 폴라 CD | 모델 L/D | 폴라 L/D |
|---|---|---|---|---|
| 0.88 | 0.254 | 0.228 | 3.46 | 3.85 |
| 0.60 | 0.186 | 0.159 | 3.22 | 3.78 |
| 0.30 | 0.113 | 0.113 | 2.65 | 2.65 |

→ LD_wing(=2.2√AR)에 이미 CD0 가 들어있는데 0.04 를 또 더해 고CL 영역에서 항력 +11% 초과. LDWING_K 1.83→2.2 상향이 이를 부분 상쇄 — **두 오차의 상호 은폐 구조** 정량 확인.

### 4-8. 추천 시스템 간 발산
같은 입력 (12kt·70kg·중급·AR6.5): `wingSizeOptimal` optimal = **7.0 m²** vs `wingRecommendation` performance = **6.75 m²** vs `recommendMinFeasibleWingSize`(15kt 환산 별개) — 3개 추천 엔진이 서로 다른 물리·보정으로 공존. §181-F 가 wingSizeOptimal 을 "진단 전용" 으로 강등해 두긴 했으나 export·UI 잔존.

---

## 5. 이슈 목록 (심각도순)

### I-1 [HIGH · 버그] extreme 분기의 역방향 안내 (comfort-floor binding 미인지)
- **현상**: 90kg @10kt → "최소 풍속 4.9kt / 최소 포일 400cm²" — 현재 풍속(10kt)보다 낮은 풍속, 현재 포일(900cm²)보다 작은 포일을 안내. 사용자에게 그대로 노출되는 visible 수치.
- **원인 식**: L556-569 — extreme 시 `min_wind = v_target − boost(7.4)`, `min_foil = 2Mg/(ρ·CL·v²)` 만 계산. binding='comfort' 인 경우를 분기하지 않음.
- **영향**: 체중 ≥ ~88kg(gear 포함 98kg) + 풍속 ≤ ~10.5kt 전 조합. moderate 기준 floor>7.4 조건 = $M_{tot} > 7.4\cdot80/(9-0.3V)$.
- **권장 수정안** (승인 전 적용 금지):
```js
if (extreme) {
  if (binding === 'comfort') {
    // floor(V) ≤ maxWing 이 되는 최소 풍속: 9.0 − 0.3V ≤ maxWing·80/(mTotal·pumpScale)
    var vFloor = (9.0 - (maxWing * 80) / (mTotal * pumpScale)) / 0.3;
    result.min_wind_kt = Math.max(result.min_wind_kt || 0, Math.ceil(vFloor * 10) / 10);
    result.extreme_reason = 'comfort_floor';   // UI 문구 분기용
    result.min_foil_area_cm2 = null;           // 포일 안내는 takeoff binding 시에만 유효
  } else { /* 기존 takeoff 역산 유지 */ }
}
```

### I-2 [HIGH · 모델] 추천 윙에서 물리 모델 무력화 — comfort floor 27/27 binding
- **현상**: 대표 매트릭스 전 케이스에서 binding='comfort' → 추천값이 양력 방정식·포일 spec(AR/면적/C_L)·수질·수면 입력과 **무관**해짐 (포일을 FW680↔FW900 으로 바꿔도 추천 윙 동일 — §4-6 표에서 확인).
- **원인 식**: floor = (9.0−0.3V)·M/80·s 가 takeoff_min = deficit+2 를 거의 항상 지배 (windBoost 가 너무 후하게 deficit 을 깎는 구조와 결합).
- **영향**: "포일 입력이 추천에 반영된다"는 사용자 기대와 실제 동작 불일치. takeoff 물리 파트는 v_min 표시에만 기여.
- **권장 방향**: (a) windBoost 를 풍속² 가중 물리식으로 교체해 takeoff 경로를 복권하거나, (b) UI 에 "이 추천은 컨트롤 안정 기준(업계 차트)" 을 명시 + binding 사유 노출 (현재 binding 필드는 산출되나 UI 미노출 여부 확인 필요).

### I-3 [MEDIUM · 모델/문서] V_b cap 35kt 가 24-25kt 풍속에서 binding (§181-C lock)
- **현상**: 상급·5m²·AR8.7 기준 wind ≥24kt 에서 V_boat = 35.0 고정 — 주석의 "8-25kt 에서 binding 안 됨" 반증. 그래프 포화 평탄 발생.
- **원인**: cap 자체보다, cap 에 닿을 만큼 V_boat 가 과대예측되는 모델 (LDWING_K 2.2 + η + heel couple 소형윙 부스트 합성).
- **권장 방향**: cap 상향은 미봉 — 근본은 I-4·I-5 와 함께 강풍역 재보정. 단기로는 binding 시 `capped: true` 플래그 산출 + UI 표기.

### I-4 [MEDIUM · 물리] 윙 항력 부분 이중계상 + §179 폴라 dead code
- **현상**: `stateAt()` 추력식이 (CL·cosβ/LD_eff) — LD 에 CD0 0.098 내재 — 에 CD0_PARASITIC 0.04 를 추가 차감 (고CL 에서 항력 +11%, §4-7). 한편 §179 의 CL-가변 폴라 `ldWingAtCL`/`clOptWing` 은 선언만 되고 **호출 0건** (3벌 동일).
- **원인 식**: L1033-1034 + L911. §181-C 의 K 2.2 상향이 이 초과 항력을 anchor 점에서만 상쇄.
- **영향**: anchor 에서 먼 영역(고CL = 약풍 powered / 저CL = 강풍 depowered)에서 오차 부호가 반대로 갈라짐. 상수 lock 사슬이 서로 종속 (한 개만 수정 불가).
- **권장 방향** (대수술 — 옥대표님 승인 필수): 추력식을 단일 폴라로 통일
```js
// CD(CL) = CD0 + CL²/(π·e·AR) 직접 사용 (§179 함수 활용), 별도 PARASITIC 제거
var cd = WING_CD0 + CL*CL/(Math.PI*WING_E*wingAR);
var thrustCoeff = CL*sin_b - cd*cos_b;   // η 는 CL_eff_max·tack 에만
```
  적용 시 §181-C/D/E anchor 전부 재보정 필요 — anchor 데이터 추가 확보(멀티 라이더·멀티 풍속) 후 일괄 진행 권장.

### I-5 [MEDIUM · 물리] heel 결합 지수 −1.2 의 소형 윙 발산 (§181-E lock)
- **현상**: 2.5m² 윙에서 H_max ×3.74 — 윙이 작을수록 라이더 측면력 한계가 커진다는 외삽이 강풍·소형윙 V_boat 과대의 한 축.
- **원인 식**: L1010 `pow(A/7.5, −1.2)` — 모멘트 물리 도출값(≈ −0.5)의 2.4배 + 상한 없음.
- **권장 방향**: 결합 인자에 clamp (예: `Math.min(1.6, heelCouple)`) 또는 지수를 −0.5 로 낮추고 다른 상수로 anchor 재흡수. lock 이므로 Danny 추가 anchor (강풍·소형윙 실측) 확보가 선행 조건.

### I-6 [MEDIUM · 일관성] `heelMaxWingCurve` 에 §181-E 결합 미적용
- **현상**: 같은 결과 화면의 heel 곡선은 $H_{max} = Mg\tan\theta$ (결합 無), 역U 곡선은 결합 有 — 두 그래프의 "한계 윙" 이 서로 모순될 수 있음.
- **원인**: L1457-1459 K 계산에 heelCouple 부재 (A_max 가 미지수라 결합 적용 시 음함수가 되는 구조적 사정은 있음 — $A^{1+1.2} = K'\tan\theta$ 로 풀면 closed-form 가능).
- **권장 방향**: $A_{max} = (K\tan\theta \cdot 7.5^{-1.2})^{1/(1+1.2)}$ ... 정확히는 $A_{max}^{2.2} = K\tan\theta\cdot7.5^{1.2}$ 역산으로 일관화, 또는 그래프 캡션에 "결합 미반영 단순 곡선" 명시.

### I-7 [LOW · 일관성] gear 기본값 이원화 (takeoff 10kg vs upwind 5kg)
- **현상**: `calculate` 기본 10kg(§117), `upwindSpeed`/`wingSizeOptimal` 기본 5kg(§170). calculator.html 이 사용자 입력을 양쪽에 넘기면 무해하나, 한쪽만 기본값 타면 동일 화면에서 총질량 5kg 차.
- **권장 방향**: 단일 CONST 로 통합하거나 호출부에서 항상 명시 전달 보장 (calculator.html 전달 경로 audit 1건).

### I-8 [LOW · UX/모델] C_L step 의 AR=5·8 경계 불연속 (§170 v8 기지 한계 — 재확인)
- **현상**: AR 8.0↔8.01 에서 v_min ±8.5% 절벽. AR>8 포일 7종(Levitaz 전체) C_L 동일.
- **권장 방향**: Helmbold 형 연속 함수 `CL(AR) = CL2D·AR/(AR+2)` (CL2D ≈ 1.35 로 기존 3 class 평균 재현) 또는 구간 선형 보간. takeoff v_min 만 영향 — 추천 엔진은 I-2 상태라 영향 적음.

### I-9 [LOW · 문서] PWA 사본 주석 diverge + §181-D 문서 정점값 진부화
- PWA 사본 References 주석 19줄 누락 (코드 동일). §181-D 주석의 "12kt 중급 정점 6.25" 는 §181-E 적용 후 실측 6.75 — 주석 갱신 누락.
- **권장 방향**: 3벌 동기화 스크립트(또는 빌드 단일 소스화) + 주석 정정.

### I-10 [INFO] 풍상 절대값의 계통적 낙관 의심
상급 18kt → V_boat 29.9 / VMG 19.2kt (TWA 50°). 전용 race 장비 iQFOiL 의 풍상 VMG 실측(10-13kt 급) 대비 +50% 이상. 단일 anchor (11kt→18.3kt) 자체가 참이어도, 멱함수 외삽으로 강풍역이 함께 끌려 올라간 것으로 보임. **lock (§181-C) 이므로 판단은 옥대표님 몫** — 멀티-포인트 anchor (예: 15kt·20kt 에서 Danny GPS 실측 2점) 확보가 가장 값싼 검증.

---

## 6. 권장 사항 요약 (승인 시 우선순위)

1. **P1 — I-1 버그 수정**: extreme 분기 comfort-floor 인지 + 역방향 안내 제거. 코드 ~15줄, lock 상수 무변경, 회귀 위험 최소. **즉시 가치**.
2. **P2 — binding 사유 UI 노출 (I-2 단기)**: "추천 근거 = 컨트롤 안정 차트 / takeoff 물리" 표시. 모델 무변경.
3. **P3 — Danny GPS anchor 2~3점 추가 확보** (15kt·20kt 풍상 + 가능하면 타 라이더 1명): I-3/I-4/I-5/I-10 의 공통 선행 조건. 데이터 없이는 lock 상수 재논의 불가.
4. **P4 — 항력 모델 통일 (I-4)**: §179 폴라를 stateAt 에 실사용 + PARASITIC 제거 + 전 anchor 재보정. P3 완료 후 일괄.
5. **P5 — C_L 연속화 (I-8)** + heel 곡선 일관화 (I-6) + gear 기본값 통합 (I-7) + 사본 동기화 (I-9): 정리성 작업 묶음.

### Lock 현황 정리
- §181 (PARASITIC 0.04) · §181-C (K 2.2, cap 35) · §181-D (CL_MAX 1.00) · §181-E (지수 −1.2, 피벗 7.5) — 전부 DO_NOT_REVERT. **과제 지시문의 "heel 지수 0" 은 §181 v2 시점이며 현재 코드 최신 lock 은 §181-E(−1.2)** 임을 명시한다.
- 본 보고서의 모든 평가는 lock 존중 하의 분석이며, 수정은 일절 하지 않았다.

---
*검증 스크립트: node 즉석 실행 (파일 미생성). runSelfTest 62/62 · DannyMatrix PASS 상태에서 조사 — 기존 가드 전부 green 인 채로 위 이슈가 공존함 = 테스트 커버리지 사각지대(extreme-comfort 분기, 강풍 cap, 소형윙 heelCouple) 존재.*
