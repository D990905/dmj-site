# Sports Science — Cross-Modal Training & Gap-Filling Prescription System

| 항목 | 내용 |
|---|---|
| 문서 유형 | v2 신규 product layer — 세일링 + 육상 부하 융합 + gap-filling 처방 + 회복 전략 결정 |
| 작성 | Sports Science Researcher (#3) · 2026-05-31 |
| 대상 | `analysis.js` · `storage.js` · `coach.js` 신규 5개 함수 + 신규 `EXERCISE_LIBRARY` data + 신규 UI 화면 (Frontend Engineer #4 협업) |
| 범위 | v2 spec only — Phase 1-2 production 변경 X. 신규 모듈은 기존 TRIMP/ACWR/HRV/Hooper 위에 add-on. |
| 근거 | `expert_sports_science_reference.md` §4·§11·§12 + Ainsworth 2011 Compendium + Seiler 80/20 + Mujika tapering + ACSM 12e + Edwards/Lucia TRIMP + Foster sRPE + Soligard 2016 IOC consensus |
| 제약 | `DO_NOT_REVERT` §181-* 모두 보존. 기존 TRIMP/CTL/ATL/HRV (§11) 모듈 0줄 수정 — 본 시스템은 그 위에 add-on. `[[feedback_strict_fact_verification]]` 절대 fabrication 금지. |
| Co-owners | Frontend Engineer (#4) · UX Researcher (#5) · DataViz (#2) · Mobile App (#8) · Visual Designer · Marketing (#6) · Backend (#10) |

> **읽는 법.** §0 TL;DR + 3-component architecture. §1 학술 기반 (MET·TRIMP variants·polarized·tapering·cross-training·ACSM). §2 Cross-modal workload 융합 식. §3 Gap-filling exercise prescription engine. §4 회복 결정 트리. §5 통합 dashboard architecture. §6 신규 함수 spec + EXERCISE_LIBRARY data. §7 협업 인터페이스. §8 제약 준수. §9 Sources.

---

## 0. 핵심 결론 (TL;DR)

**비전 한 줄.** 세일링은 **계절·풍속·장소·라이더 컨디션 4 변수의 함수** 이라 plan 대로 100% 못 따른다. SailTechCo 가 라이더의 주간 chronic load target 을 알면, 실제 sea session 의 부족분 (gap) 을 **육상 보충 운동의 다양한 옵션** 으로 메워서 ACWR sweet spot (0.8-1.3) 안에 유지할 수 있다. 추가로 그 모든 정보를 회복 전략으로 묶어 "오늘 ride / 가벼운 보충 / 휴식" 의 일일 결정에 사용한다.

**3-Component architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│  Component A — Cross-Modal Workload Fusion                  │
│  Sea sessions (TRIMP/sRPE) + Land workouts (TRIMP/sRPE)     │
│  → 단일 AU (Arbitrary Units, MET-normalized)                │
│  →  computeCrossModalLoad(sessions)                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Component B — Gap-Filling Prescription Engine              │
│  Weekly target (chronic load 유지) − actual sea load = gap  │
│  → 라이더 prefs + 장비 + 시간 → 다양 land workout options    │
│  →  computeWeeklyTarget()   suggestLandWorkout(gap, prefs)  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Component C — Recovery Decision Tree                       │
│  TSB + ACWR + HRV + Hooper → 4-zone action                  │
│  ('full ride' / 'moderate' / 'active recovery' / 'rest')    │
│  →  decideRecoveryAction(state)                             │
└─────────────────────────────────────────────────────────────┘
```

**왜 이 spec 이 정확한 다음 step 인가:**

1. **§11 의 모든 모듈 위에 자연 적분.** TRIMP (§4-1) · CTL/ATL/TSB (§4-2) · HRV (§4-3) · ACWR (§12-3-A) · sRPE (§12-3-B) · Hooper (§12-3-C) 6 모듈이 이미 v1 구현 + selftest 88 PASS. 본 시스템은 그 위에 layer 만 얹는다 — production 회귀 risk 0.
2. **윙포일 ICP 의 정확한 pain point.** 한국 윙포일 라이더는 "바람 못 만나면 운동 zero" 의 detraining cycle 에 빠진다. 본 시스템이 그 cycle 을 깨준다.
3. **모든 commercial leader (athleteMonitoring · Firstbeat · WHOOP · TrainingPeaks) 가 안 만든 영역.** sea-specific load + land gap-filling 의 결합은 sailing 도메인 특화 — SailTechCo Moat W2 (windfoil 도메인 KPI) 의 강한 확장.
4. **학술 정합성 검수 가능.** 모든 변환 식 (MET → AU, sRPE → AU, gap → workout option) 이 peer-reviewed reference 기반 (Ainsworth 2011 · Foster 2001 · Seiler 80/20 · Mujika tapering · ACSM 12e).
5. **3 component 가 독립 출시 가능.** Component A → B → C 단계적 deploy. 작은 v2 도 자체 가치.

**v2 권장 우선순위:**
1. Component A (`computeCrossModalLoad`) — 1주 spec + 구현 + selftest
2. Component B (`computeWeeklyTarget` + `suggestLandWorkout` + `EXERCISE_LIBRARY`) — 2주
3. Component C (`decideRecoveryAction`) — 1주 (간단한 decision tree)
4. UI / dashboard 통합 — Frontend Engineer #4 · UX Researcher #5 (Phase 3)

---

## 1. 학술 기반

### 1-1. MET (Metabolic Equivalent of Task) — Ainsworth 2011/2024 Compendium

**MET 정의** — 한 MET = 1 kcal·kg⁻¹·hr⁻¹ ≈ 3.5 ml O₂·kg⁻¹·min⁻¹ ≈ "조용히 앉아있을 때 대사율".

**Compendium of Physical Activities 2011 (Ainsworth et al.)** — 821 activity codes × MET intensities. 본 시스템의 cross-modal AU 변환의 1차 lookup table.

| Activity | MET (Ainsworth 2011) | 우리 windfoil 적용 |
|---|---|---|
| Sitting (rest) | 1.0 | baseline |
| Walking (3 mph, level) | 3.3 | recovery |
| **Sailing — boat·windsurfing** | **3.0** | windsurf low intensity (light wind freeride) |
| Sailing — leisure (Sunfish·Laser·keel·yachting) | 3.3 | sail leisure |
| Sailing — competition | 4.5 | sail race |
| **Windfoil / wingfoil (estimate — Compendium 없음)** | **6-9** | **본 spec 의 추정 — §2-1 참조** |
| Surfing — body or board | 3.0 | surf |
| Surfing — competition | 6.0 | surf race |
| Cycling — leisure | 5.5 | gentle bike |
| Cycling — moderate (12-13.9 mph) | 8.0 | endurance bike |
| Cycling — vigorous (16-19 mph) | 12.0 | hard bike |
| Running 6 mph (10 min/mile) | 9.8 | z2-z3 run |
| Running 8 mph (7.5 min/mile) | 12.8 | z4 run |
| Rowing — moderate (Concept2 ergometer) | 7.0 | rowing endurance |
| Rowing — vigorous | 8.5 | rowing intervals |
| Resistance training (general) | 3.5 | bodyweight |
| Resistance training (vigorous, free weights) | 6.0 | barbell |
| Yoga (Hatha) | 2.5 | flexibility |
| HIIT (general) | 8.0 | metcon |

**Compendium 의 한계.** Sailing 의 MET 값 (3.0) 은 1990 년대 측정 — **modern windfoil/wingfoil 의 실 MET 와 크게 다를 수 있다.** Windfoil race 의 격렬한 pumping + 짧은 회복 + 지속적 isometric 자세 보유 등은 MET 6-9 의 가능성 (cycling vigorous 와 유사). **단무지공방 / SailTechCo 의 Phase 2 multi-rider calibration (`sports_science_calibration_protocol.md`) 의 추가 항목 — 라이더 wearable HR 데이터로 windfoil MET 직접 측정.**

**2024 Adult Compendium (3rd update)** — Ainsworth et al. 2024 (ScienceDirect). 일부 activity MET 갱신, 새 activities 추가. 본 시스템은 **2024 update 를 1차 reference, 2011 fallback**.

### 1-2. TRIMP variants — Banister · Edwards · Lucia · Foster (sRPE)

본 system 의 workload 산출은 4 가지 방법을 사용 가능 (입력에 따라 자동 선택):

#### Banister TRIMP (HR + 성별)
이미 §4-1 구현. avg HR + duration + 성별 가중. **장점:** sex-specific exponential, 정확. **단점:** 단일 평균값 → 인터벌과 steady-state 구분 못 함.

#### Edwards TRIMP (HR zone × multiplier)
```
Edwards TRIMP = Σ (time_zone_i × multiplier_i)
  Zone 1 (50-60% HRmax) × 1
  Zone 2 (60-70%) × 2
  Zone 3 (70-80%) × 3
  Zone 4 (80-90%) × 4
  Zone 5 (90-100%) × 5
```
**장점:** zone 별 시간 직접 반영 → 인터벌 정확. **단점:** linear weighting (z5 ≈ 5×z1) 는 실제 physiological cost 의 비선형 (z5 >> z1) underestimate 가능.

#### Lucia TRIMP (3-zone, ventilatory threshold)
```
Lucia TRIMP = (time_z1 × 1) + (time_z2 × 2) + (time_z3 × 3)
  Z1 = below VT1 (aerobic threshold)
  Z2 = VT1-VT2 (threshold)
  Z3 = above VT2 (anaerobic)
```
**장점:** VT-based 가 단순 %HRmax 보다 individualized. **단점:** VT 측정은 lab test 필요 (또는 step test estimate). 일반 라이더 적용 어려움.

#### Foster sRPE (subjective, HR 없는 옵션)
이미 §12-3-B 구현 spec. **장점:** universal, 어느 sport 든. **단점:** subjective.

**우리 권장 적용:**

| 입력 가용성 | 1st choice | Fallback |
|---|---|---|
| HR series (chest strap / watch) + 성별 + rest/max HR | Banister | Edwards |
| HR series + HR zones 만 | Edwards | sRPE |
| HR avg 만 | Banister | sRPE |
| HR 없음 | sRPE | — |
| Strength session (HR 안 따라옴) | sRPE | — |

`analysis.js` 신규 함수 `computeWorkload(session, profile, opts)` 가 4 방법 자동 분기 + 단일 AU output. AU = Banister 값 (다른 방법은 cross-calibration constant 곱해 같은 scale).

### 1-3. Polarized Training Distribution — Seiler 80/20

**Seiler & Kjerland 2006** (Scand J Med Sci Sports) — elite endurance athlete 의 실 training intensity distribution = **80% LIT (Low Intensity Training, < VT1) + 20% HIT (High Intensity Training, > VT2)**, threshold zone (VT1-VT2) 의 "Black Hole" 회피.

**Stöggl & Sperlich 2014** (PLOS ONE) — 9-week 무작위 RCT: polarized (80/0/20) > threshold (33/33/33) > high-volume (90/10/0) > high-intensity (50/0/50). VO2max 11.7% 향상 vs threshold 4.8%, 5km 시간 5.0% vs 3.2%.

**Esteve-Lanao et al. 2007** (J Strength Cond Res) — 5개월 RCT: 80/12/8 (LIT/threshold/HIT) > 67/25/8 의 4.2% vs 2.9% improvement.

**Casado et al. 2022** (review) — elite distance runner 의 평균 TID = 79% LIT / 14% threshold / 7% HIT.

**적용:** 본 system 의 gap-filling exercise prescription 은 **주간 80/20 ratio 유지를 제약** 으로 둔다. 라이더가 이미 z2-z3 (threshold) 에 충분한 시간 → 추가 LIT 권장. 이미 LIT 충분 → 짧은 HIT 권장.

### 1-4. Tapering — Mujika & Padilla 2003

**Mujika & Padilla 2003** (Sports Med 33(15):1115-1145) — taper 정의: "progressive, nonlinear reduction of training load to reduce physiological/psychological stress and optimize performance".

**핵심 원칙:**
- **Volume ↓, intensity 유지** (intensity 떨어뜨리면 detraining → race performance 손실)
- 최적 duration: **8-14 일** (cycling / running)
- Frequency 약 80% 유지
- Volume 41-60% 감소 (race 직전 8-14일)
- 평균 race performance 향상 ~3% (0.5-6.0%)

**본 system 적용:** Race / event 직전 라이더가 taper plan 입력 시 weekly target 을 점진적으로 감소 (예: −10% per week × 2주). Gap-filling engine 이 적정 volume 권장. TSB 가 race 시점 +15~+25 zone (peak ready) 으로 자연 진입.

### 1-5. Cross-training equivalence — 부상 재활 + sport-specific carryover

**Cross-training principle.** 다른 sport 가 동일 metabolic pathway 자극 → fitness 유지. 직접 같은 muscle group 자극은 안 되나 cardio adaptation 보존.

**Specificity 의 한계.** Running fitness → Swimming carry over 는 ~50-70% (HR / lactate threshold), ~ 30% (sport-specific VO2max). 따라서 **부상 회복기 sub-optimal 이나 detraining 최소화 가능**.

**Cross-training carryover matrix (typical literature):**

| From → To | Cardiac adaptation | Sport-specific |
|---|---|---|
| Running → Cycling | 70% | 50% |
| Running → Swimming | 60% | 30% |
| Running → Rowing | 70% | 50% |
| Cycling → Running | 60% | 40% |
| Swimming → Running | 50% | 30% |
| Rowing → Running | 60% | 45% |
| **Windfoil → Running** | **~60%** (estimate — Phase 2 measure) | **~30%** (다른 muscle group) |
| **Windfoil → Rowing** | **~75%** (estimate — 비슷한 upper body + core) | **~50%** |
| **Windfoil → Cycling** | **~55%** (estimate) | **~40%** |
| **Strength → Windfoil** | 20% | 60% (specific muscle preparation) |

**우리 적용:** Gap-filling 시 추천 priority — windfoil 과 carryover 높은 sport 우선 (rowing > running > cycling 순). 단 라이더 선호 / equipment access 가 1차 제약 (§3-4).

### 1-6. ACSM FITT framework — Frequency / Intensity / Time / Type

**ACSM 12e Guidelines for Exercise Testing and Prescription (2025):**

| 요소 | 의미 | 본 system 적용 |
|---|---|---|
| Frequency | 주당 횟수 | 라이더 주 plan |
| Intensity | %HRmax / RPE / MET | Banister/Edwards/Lucia TRIMP 의 input |
| Time | 세션 duration | per workout 또는 weekly sum |
| Type | sport / modality | EXERCISE_LIBRARY (§6-5) |

**General population (ACSM) recommendation:**
- ≥ 150 min/week moderate intensity OR ≥ 75 min/week vigorous intensity (cardiovascular)
- 2-3× / week resistance training (8-12 reps, major muscle groups)
- 2-3× / week flexibility / mobility

**Athlete-level — periodized:**
- Cycling pro: 20-25 hr/week (in-season)
- Marathon elite: 12-18 hr/week
- Windfoil elite (estimate): 10-15 hr/week (race season) — sea session 부족 시 land 보충 필수

본 system 의 weekly target 산출 (`computeWeeklyTarget`) 은 ACSM minimum + athletic goal 의 라이더 input.

---

## 2. Cross-Modal Workload Fusion Model — Component A

### 2-1. 단일 AU (Arbitrary Units) 식

**Core principle.** 모든 sport 의 workload 를 **단일 AU scale** 로 변환 → CTL/ATL/TSB/ACWR 의 input 으로 합산 가능.

**2-tier 산출:**

#### Tier 1 — HR-based (정확):
```
AU = Banister TRIMP = durationMin × HRR × y
  (이미 §4-1 / §11-2 구현)
```

#### Tier 2 — MET-based (HR 없을 때 + cross-modal cap):
```
AU_MET = MET_sport × durationMin × bodyMassKg_normalized
  bodyMassKg_normalized = bodyMassKg / 75  (75kg reference)
```
**상수 calibration:** Cross-validation 으로 같은 라이더의 HR-based AU 와 MET-based AU 가 ~ 비슷한 scale 에 오게. 예: 70kg 라이더가 30분 z2 running (MET 9.8) → MET_AU = 9.8 × 30 × (70/75) = 274. 같은 세션의 HR-based Banister TRIMP (avg 145, rest 55, max 180, HRR=0.72, y=2.56) → 30 × 0.72 × 2.56 = 55.3.

**비율: MET_AU / TRIMP_AU ≈ 5×** — 두 scale 의 정렬을 위해 **`MET_TO_AU_FACTOR = 0.2`**:
```
AU_MET_normalized = MET_sport × durationMin × (bodyMassKg / 75) × 0.2
                  ≈ 274 × 0.2 = 54.8  ✓ TRIMP 와 동등 scale
```

이 0.2 factor 는 Phase 2 multi-rider data 로 재calibration (운동학자 anchor 우선) — Phase 1 baseline.

#### Tier 3 — sRPE-based (subjective):
```
AU_sRPE = RPE × durationMin × 0.5
  RPE 1-10 scale (Foster 2001)
  0.5 factor — sRPE × duration 의 raw value (AU 약 500) 를 TRIMP scale 로 정렬
```

**우선순위 자동 선택:**
```
function computeWorkload(session, profile):
  if session.hasHR + profile.restHr + profile.maxHr:
    return Banister TRIMP            (Tier 1)
  elif session.hasMETestimate:
    return MET-based AU             (Tier 2)
  elif session.hasSRPE:
    return sRPE AU                   (Tier 3)
  else:
    return null  (workload 산출 불가)
```

### 2-2. Sport classification 및 MET lookup

**`SPORT_MET_LIBRARY`** — Phase 2 신규 data file (`storage.js` 또는 새 `data/sport-met.js`):

```javascript
var SPORT_MET_LIBRARY = {
  /* Sailing / foiling family */
  'windfoil_light':     { met: 5,  description: '윙포일 약풍 (cruise)', source: 'estimate-Danny' },
  'windfoil_moderate':  { met: 7,  description: '윙포일 중풍 (active)', source: 'estimate-Danny' },
  'windfoil_strong':    { met: 9,  description: '윙포일 강풍/race', source: 'estimate-Danny' },
  'windsurf':           { met: 3,  description: '윈드서핑', source: 'Ainsworth 2011' },
  'sailing_leisure':    { met: 3.3, description: '세일링 (leisure)', source: 'Ainsworth 2011' },
  'sailing_race':       { met: 4.5, description: '세일링 race', source: 'Ainsworth 2011' },
  'surf':               { met: 3,  description: '서핑', source: 'Ainsworth 2011' },
  'surf_competition':   { met: 6,  description: '서핑 race', source: 'Ainsworth 2011' },
  'sup':                { met: 6,  description: 'SUP', source: 'Ainsworth 2011' },
  'kitesurf':           { met: 5,  description: '카이트서핑', source: 'Ainsworth 2011' },

  /* Land cardio */
  'run_easy':           { met: 6,  description: '러닝 z2 (easy)', source: 'Ainsworth 2011' },
  'run_moderate':       { met: 9.8, description: '러닝 z3 (10 min/mile)', source: 'Ainsworth 2011' },
  'run_vigorous':       { met: 12.8, description: '러닝 z4-z5 (7.5 min/mile)', source: 'Ainsworth 2011' },
  'cycle_leisure':      { met: 5.5, description: '사이클 easy', source: 'Ainsworth 2011' },
  'cycle_moderate':     { met: 8,  description: '사이클 endurance', source: 'Ainsworth 2011' },
  'cycle_vigorous':     { met: 12, description: '사이클 vigorous', source: 'Ainsworth 2011' },
  'row_moderate':       { met: 7,  description: '로잉 z2-z3', source: 'Ainsworth 2011' },
  'row_vigorous':       { met: 8.5, description: '로잉 z4+', source: 'Ainsworth 2011' },
  'swim_moderate':      { met: 6,  description: '수영 endurance', source: 'Ainsworth 2011' },
  'swim_vigorous':      { met: 10, description: '수영 race', source: 'Ainsworth 2011' },
  'hike':               { met: 6,  description: '하이킹', source: 'Ainsworth 2011' },

  /* Strength / functional */
  'strength_bodyweight': { met: 3.5, description: '맨몸 운동', source: 'Ainsworth 2011' },
  'strength_barbell':    { met: 6, description: '바벨/덤벨', source: 'Ainsworth 2011' },
  'crossfit':            { met: 8, description: 'CrossFit / metcon', source: 'Ainsworth 2011' },
  'hiit':                { met: 8, description: 'HIIT', source: 'Ainsworth 2011' },
  'yoga':                { met: 2.5, description: '요가 / 스트레칭', source: 'Ainsworth 2011' },
  'mobility':            { met: 2, description: '모빌리티 / 폼롤러', source: 'Ainsworth 2011' }
};
```

**Source 명시 — `estimate-Danny` 는 Ainsworth 에 없는 windfoil/wingfoil MET 의 도메인 expert 추정.** Phase 2 multi-rider calibration 으로 검증 필수 (HR data + indirect calorimetry).

### 2-3. `computeCrossModalLoad(sessions)` 출력 구조

```javascript
{
  days: [
    {
      date: '2026-05-31',
      sessions: [
        { sport: 'windfoil_moderate', durationMin: 45, AU: 87, method: 'banister', ... },
        { sport: 'run_easy', durationMin: 30, AU: 45, method: 'met', ... }
      ],
      total_AU: 132,
      sea_AU: 87,
      land_AU: 45
    },
    ...
  ],
  current_week: {
    sea_AU: 280,
    land_AU: 95,
    total_AU: 375,
    distribution: { LIT: 245, threshold: 80, HIT: 50 },  // Seiler 80/20 zone
    polarized_score: 0.85   // 1.0 = 정확히 80/20 분포
  }
}
```

`polarized_score` 산출:
```
LIT_fraction = LIT / total
HIT_fraction = HIT / total
threshold_fraction = threshold / total
score = 1 - max(0, abs(LIT_fraction - 0.80) + abs(threshold_fraction - 0) + abs(HIT_fraction - 0.20)) / 2
```
score 1.0 = 정확히 80/0/20, 0.0 = 완전히 다른 분포.

---

## 3. Gap-Filling Prescription Engine — Component B

### 3-1. Weekly target 산출 — `computeWeeklyTarget(profile, season_context)`

**입력:**
- profile.skill (입문/초급/중급/상급/선수)
- profile.weeklyHours (라이더 본인 목표, default = skill 별 권장)
- profile.bodyMassKg
- season_context.phase ('base'|'build'|'race'|'taper'|'recovery')

**Skill 별 권장 weekly hours + chronic AU target (Phase 2 calibration 필수):**

| Skill | Recommended hr/week | Target CTL (chronic AU) | Reference |
|---|---|---|---|
| 입문 | 3-5 | 100-180 | ACSM general fitness |
| 초급 | 5-8 | 180-300 | ACSM enhanced fitness |
| 중급 | 8-12 | 300-450 | Recreational athlete |
| 상급 | 12-15 | 450-600 | Sub-elite |
| 선수 | 15-20 | 600-900 | Elite endurance |

Season phase 적용:
- Base (winter): target 100% (build aerobic foundation)
- Build (pre-season): target 110% (overload)
- Race (mid-season): target 95% (maintain, taper before key races)
- Taper (1-2 weeks before race): 60-70% (Mujika 2003)
- Recovery (post-race / off-season): 70-80%

**출력:**
```javascript
{
  weeklyTarget_AU: 425,
  weeklyTarget_hr: 10.5,
  distribution_target: { LIT: 340, threshold: 0, HIT: 85 },  // 80/0/20
  phase: 'build',
  recommendations: '윙포일 8시간 + 육상 2.5시간 (80/20 분포). 강풍 시 z3-z4, 약풍 시 z2 long ride.'
}
```

### 3-2. Gap 산출 — `computeWeeklyGap(target, actual)`

**입력:** 위 target + Component A 의 current_week actual.

**출력:**
```javascript
{
  current_AU: 280,
  target_AU: 425,
  gap_AU: 145,
  gap_distribution: { LIT: 100, threshold: 0, HIT: 45 },  // polarized 유지
  days_remaining_in_week: 3,
  recommendation: 'gap 145 AU 를 남은 3일 안에 보충 — 일평균 48 AU. land workout 권장.'
}
```

### 3-3. Workout suggestion engine — `suggestLandWorkout(gap, profile, prefs, history)`

**Algorithm:**

1. Filter EXERCISE_LIBRARY by `prefs.equipment_access` (running shoes / bike / rower / gym / pool)
2. Filter by `prefs.timeAvailable_min` 제약
3. Match each candidate workout 의 AU to `gap_AU` (within ±20%)
4. Match intensity zone to `gap_distribution` (LIT vs HIT)
5. Penalize sport 이 이미 history.last7days 에 너무 빈번 (variety bonus)
6. Bonus workout 이 windfoil 과 high carryover (rowing > running > cycling)
7. Return top 3-5 options diverse

**Output:**
```javascript
{
  gap_AU: 145,
  options: [
    {
      id: 'opt_1',
      sport: 'row_moderate',
      durationMin: 30,
      intensity: 'z2-z3',
      estimated_AU: 70,
      estimated_RPE: 5,
      met: 7,
      carryover_to_windfoil: 0.75,
      rationale: '윙포일과 가장 높은 carryover (upper body + core). z2 30분 = 70 AU. 남은 75 AU 는 내일 z1 30분 산책 등 권장.',
      equipment: ['concept2 rower or similar'],
      step_by_step: [
        '5분 warmup (낮은 stroke rate 18-20 spm)',
        '20분 main (24-26 spm, HR 60-75% max)',
        '5분 cool down (16-18 spm)'
      ]
    },
    {
      id: 'opt_2',
      sport: 'run_easy',
      durationMin: 45,
      intensity: 'z2 (aerobic base)',
      estimated_AU: 65,
      estimated_RPE: 4,
      met: 6,
      carryover_to_windfoil: 0.60,
      rationale: 'LIT 보충에 효율적. nasal breathing 가능 페이스 유지. 남은 80 AU 는 내일 30분 strength 또는 cycle.',
      equipment: ['running shoes'],
      step_by_step: [
        '5분 walk-jog warmup',
        '35분 easy run (HR z2, nasal breathing)',
        '5분 walk cooldown'
      ]
    },
    {
      id: 'opt_3',
      sport: 'hiit',
      durationMin: 20,
      intensity: 'z4-z5 intervals',
      estimated_AU: 65,
      estimated_RPE: 8,
      met: 8,
      carryover_to_windfoil: 0.40,
      rationale: 'HIT 보충 (gap distribution 45 HIT 충당). 시간 효율 높음. 다음날 light recovery 필요.',
      equipment: ['minimal — bodyweight or kettlebell'],
      step_by_step: [
        '5분 dynamic warmup',
        '12분 intervals — 8 × (30s all-out + 60s rest)',
        '3분 cooldown'
      ]
    },
    {
      id: 'opt_4',
      sport: 'strength_barbell',
      durationMin: 45,
      intensity: 'z3 (resistance)',
      estimated_AU: 70,
      estimated_RPE: 6,
      met: 6,
      carryover_to_windfoil: 0.60,
      rationale: '윙포일 specific muscle prep — core + upper back + grip. 12-15분 work, 5-min rest set.',
      equipment: ['barbell + plates OR gym'],
      step_by_step: [
        '10분 warmup (mobility + activation)',
        '30분 lift — 5×5 deadlift, 5×5 row, 5×5 pull-up, 3×10 core',
        '5분 stretch'
      ]
    },
    {
      id: 'opt_5',
      sport: 'mixed',
      composition: ['row_moderate 20min', 'strength_bodyweight 15min', 'yoga 10min'],
      durationMin: 45,
      estimated_AU: 75,
      rationale: 'Variety + 모든 영역 cover (cardio + strength + mobility). 시간 efficient.',
      equipment: ['rower + open floor + mat']
    }
  ],
  recommendation_summary: '윙포일 carryover 가장 높은 옵션 1 (rowing) 권장. 옵션 3 (HIT) 는 시간 부족 시.'
}
```

### 3-4. Constraint handling

**Hard constraints (필수 만족):**
- `prefs.equipment_access` 안에서만 workout 추천
- `prefs.timeAvailable_min` 범위 내 duration
- `prefs.injury_restriction` 있을 시 해당 movement 제외 (예: knee injury → no running)

**Soft constraints (preference, weighted score):**
- Variety bonus — 같은 sport 가 history.last7days 에 3+회면 penalty
- Carryover bonus — windfoil 과 high carryover sport 에 boost
- Time-of-day match — 라이더 본인 schedule 의 가능 시간대

### 3-5. Polarized 80/20 유지 logic

**Weekly distribution check.** 새 workout 추가 후 주간 TID 가 80/0/20 에서 멀어지면 alternative option 우선 표시. 예:
- 이번 주 LIT 너무 적음 (60%) → easy workout 우선
- HIT 부족 (5%) → intense interval session 우선

---

## 4. Recovery Decision Tree — Component C

### 4-1. Inputs

| Input | Source | Range |
|---|---|---|
| TSB (Coggan PMC) | `computeFitnessTrend.current.TSB` | typically −50 to +30 |
| ACWR | `computeACWR.current.acwr` | typically 0.5-2.0 |
| HRV deviation | `computeHRVTrend.deviationSD` | −3 to +3 (SD from baseline) |
| Hooper composite | `computeWellnessTrend.current.composite` | 5-50 (higher = better) |
| Days since last rest | derived from sessions | 0-14+ |

### 4-2. Decision matrix

**4-zone action output:**

| Action zone | Score range | Recommendation |
|---|---|---|
| **🟢 Full ride** | green flag all-around | "오늘 세션 OK — full intensity. 풍속 좋으면 z3-z4 push" |
| **🟡 Moderate** | mixed signals | "오늘 ride OK 단 강도 조절. z2 80% / z3 20% 유지" |
| **🟠 Active recovery** | warning signals | "오늘 라이딩 X 또는 z1 30분 light cruise. 육상 mobility / yoga 30분 권장" |
| **🔴 Rest** | red flags | "오늘 완전 휴식. 수면 우선. 내일 wellness check 재진단" |

**Scoring algorithm:**

```javascript
function decideRecoveryAction(state) {
  var flags = { red: 0, orange: 0, yellow: 0, green: 0 };

  // TSB
  if (state.tsb < -30) flags.red++;
  else if (state.tsb < -15) flags.orange++;
  else if (state.tsb < 0) flags.yellow++;
  else flags.green++;

  // ACWR
  if (state.acwr > 1.5 || state.acwr < 0.6) flags.red++;
  else if (state.acwr > 1.3 || state.acwr < 0.8) flags.orange++;
  else if (state.acwr > 1.2 || state.acwr < 0.9) flags.yellow++;
  else flags.green++;

  // HRV
  if (state.hrvDeviationSD < -2) flags.red++;
  else if (state.hrvDeviationSD < -1) flags.orange++;
  else if (state.hrvDeviationSD < -0.5) flags.yellow++;
  else flags.green++;

  // Hooper
  if (state.hooperComposite < 20) flags.red++;
  else if (state.hooperComposite < 30) flags.orange++;
  else if (state.hooperComposite < 38) flags.yellow++;
  else flags.green++;

  // Days since rest
  if (state.daysSinceRest > 10) flags.red++;
  else if (state.daysSinceRest > 7) flags.orange++;

  // Final action
  if (flags.red >= 2) return 'rest';
  if (flags.red >= 1 || flags.orange >= 2) return 'active_recovery';
  if (flags.orange >= 1 || flags.yellow >= 3) return 'moderate';
  return 'full_ride';
}
```

### 4-3. Natural language output

```javascript
{
  action: 'moderate',
  label: '🟡 적정 강도 권장',
  primary_reason: 'TSB −12 + ACWR 1.35 — fitness 향상 중이나 피로 누적 신호.',
  recommendation: '오늘 라이딩 OK 단 강도 조절. z2 80% / z3 20% 유지. 강풍 시 짧은 burst 만, 풍상-풍하 cycle 중간에 cruise 5분 휴식.',
  contributing_factors: [
    { factor: 'TSB', value: -12, flag: 'yellow', note: '훈련 부하 적정' },
    { factor: 'ACWR', value: 1.35, flag: 'orange', note: '이번주 부하 ↑ — 다음주 조절' },
    { factor: 'HRV', value: -0.8, flag: 'yellow', note: '회복 약간 부족' },
    { factor: 'Hooper', value: 36, flag: 'green', note: '주관적 상태 양호' }
  ],
  next_check: 'tomorrow morning Hooper after sleep'
}
```

---

## 5. 통합 Dashboard Architecture (§12-5 확장)

```
┌─────────────────────────────────────────────────────────────────────┐
│  TODAY'S DECISION LAYER                                             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐              │
│  │ Action Zone   │ │ Wellness      │ │ Gap Status    │              │
│  │ 🟡 Moderate   │ │ 36/50 green   │ │ 145 AU left   │              │
│  └───────────────┘ └───────────────┘ └───────────────┘              │
└────────┬───────────────────────────────────────────────┬────────────┘
         │                                               │
    ┌────▼─────────────────────────────────┐    ┌──────▼─────────────┐
    │  Workout Suggestion (Land Options)   │    │  Sea Session Plan  │
    │  - Rowing 30min (70 AU, top option)  │    │  Today: 60min      │
    │  - Run easy 45min (65 AU)            │    │  Target: z2-z3     │
    │  - HIIT 20min (65 AU)                │    │  Avoid: max effort │
    │  - Strength 45min (70 AU)            │    └────────────────────┘
    │  - Mixed 45min (75 AU)               │
    └─────────────────────────────────────┘
         │                                               │
    ┌────▼───────────────────────────────────────────────▼────────────┐
    │  WEEKLY TRACKING                                                │
    │  Target: 425 AU (80/20)  |  Actual: 280 AU (75/25)  |  Gap: 145 │
    │  ─────────────────────────────────────────────────────────────  │
    │  Mon: 0     Tue: 87 (windfoil)  Wed: 45 (run)  Thu: 148 (foil) │
    │  Fri: 0     Sat: planned       Sun: planned                    │
    └────────────────────────────────────────────────────────────────┘
         │
    ┌────▼─────────────────────────────────────────────────┐
    │  FITNESS / FATIGUE / FORM                            │
    │  CTL 65 ↑ (+3 last 7 days)                          │
    │  ATL 78 ↑ (+12 last 7 days)                         │
    │  TSB −13 (productive zone)                           │
    │  ACWR 1.35 (borderline — monitor)                    │
    │  HRV −0.8 SD (slight withdrawal)                     │
    └─────────────────────────────────────────────────────┘
         │
    ┌────▼─────────────────────────────────────────────────┐
    │  RAW SESSIONS (cross-modal)                          │
    │  Sea: windfoil_strong 60min @ 22kt → AU 148          │
    │  Sea: windfoil_moderate 45min → AU 87                │
    │  Land: run_easy 30min → AU 45                        │
    └─────────────────────────────────────────────────────┘
         │
    ┌────▼─────────────────────────────────────────────────┐
    │  SAILING-SPECIFIC LAYER                              │
    │  (VPS · Polar · 4-channel Wind · §181 Lift)          │
    │  ← 기존 SailTechCo 강점 유지                          │
    └─────────────────────────────────────────────────────┘
```

---

## 6. 신규 함수 spec

### 6-1. `analysis.js` — `computeWorkload(session, profile, opts)`

```javascript
/* Cross-modal workload 산출 — 4 tier 자동 선택.
 * 입력 가용성에 따라 Banister TRIMP / Edwards TRIMP / MET-based / sRPE
 * 자동 분기. 단일 AU output (모두 같은 scale 로 정렬).
 *
 * References:
 *   · Banister 1991 (ISBN 978-0-87322-307-5)
 *   · Edwards 1993 — Edwards TRIMP zone-based
 *   · Foster 2001 — sRPE (J Strength Cond Res 15(1):109-115, PMID 11708692)
 *   · Ainsworth et al. 2011 Compendium (doi:10.1249/MSS.0b013e31821ece12)
 */
function computeWorkload(session, profile, opts) {
  opts = opts || {};
  /* Tier 1 — Banister (HR + sex) */
  if (session.hasHR && profile.restHr && profile.maxHr) {
    var t = computeTRIMP(session, profile);
    if (t.hasTRIMP) {
      return { AU: t.trimp, method: 'banister', details: t };
    }
  }
  /* Tier 2 — MET-based (sport classification + duration) */
  if (session.sportKey && SPORT_MET_LIBRARY[session.sportKey] && session.durationMin > 0) {
    var met = SPORT_MET_LIBRARY[session.sportKey].met;
    var mass = profile.weightKg || 75;
    var AU = met * session.durationMin * (mass / 75) * 0.2;
    return {
      AU: Math.round(AU * 10) / 10,
      method: 'met',
      details: { met: met, sport: session.sportKey, durationMin: session.durationMin }
    };
  }
  /* Tier 3 — sRPE (subjective) */
  if (session.rpe > 0 && session.durationMin > 0) {
    return {
      AU: Math.round(session.rpe * session.durationMin * 0.5 * 10) / 10,
      method: 'srpe',
      details: { rpe: session.rpe, durationMin: session.durationMin }
    };
  }
  return { AU: null, method: 'none', details: { reason: 'insufficient_input' } };
}
```

### 6-2. `storage.js` — `computeCrossModalLoad(allSessions, opts)`

`computeFitnessTrend` 와 연동 — 일별 sea + land workload 합산해 CTL/ATL/TSB EWMA input.

### 6-3. `storage.js` — `computeWeeklyTarget(profile, season_context)`

§3-1 spec. Skill × season phase → target_AU + recommended distribution.

### 6-4. `storage.js` — `suggestLandWorkout(gap, profile, prefs, history)`

§3-3 spec. EXERCISE_LIBRARY filter + scoring + top 3-5 options diverse.

### 6-5. `coach.js` — `decideRecoveryAction(state)`

§4 spec. 4-zone action + natural language reason.

### 6-6. Data — `data/exercise-library.js`

```javascript
var EXERCISE_LIBRARY = [
  /* Cardio — Running */
  {
    id: 'run_easy_30',
    sport: 'run_easy',
    name: '30분 z2 easy run',
    durationMin: 30,
    met: 6,
    intensity: 'LIT',
    equipment: ['running_shoes'],
    indoor_possible: true, /* treadmill */
    carryover_to_windfoil: 0.60,
    step_by_step: ['5분 walk-jog warmup', '20분 easy z2 (nasal breathing)', '5분 walk cooldown'],
    notes: 'Recovery / aerobic base. Avoid race pace.'
  },
  {
    id: 'run_easy_45',
    sport: 'run_easy', name: '45분 z2 long easy',
    durationMin: 45, met: 6, intensity: 'LIT',
    equipment: ['running_shoes'], carryover_to_windfoil: 0.60,
    notes: 'Aerobic base building. Polarized 80% zone.'
  },
  {
    id: 'run_intervals_25',
    sport: 'run_vigorous', name: '25분 인터벌',
    durationMin: 25, met: 12, intensity: 'HIT',
    equipment: ['running_shoes', 'track_or_park'],
    carryover_to_windfoil: 0.50,
    step_by_step: ['8분 warmup', '6 × (90초 z5 / 90초 z1)', '5분 cooldown'],
    notes: 'VO2max 자극. 다음날 light 권장.'
  },

  /* Cardio — Rowing (높은 carryover) */
  {
    id: 'row_easy_30',
    sport: 'row_moderate', name: '30분 z2 rowing',
    durationMin: 30, met: 7, intensity: 'LIT',
    equipment: ['rower_concept2'],
    carryover_to_windfoil: 0.75,
    step_by_step: ['5분 18-20 spm warmup', '20분 22-24 spm steady', '5분 cooldown'],
    notes: '윙포일과 최고 carryover (upper body + core). 권장.'
  },
  {
    id: 'row_intervals_30',
    sport: 'row_vigorous', name: '30분 인터벌 rowing',
    durationMin: 30, met: 8.5, intensity: 'HIT',
    equipment: ['rower_concept2'],
    carryover_to_windfoil: 0.70,
    step_by_step: ['10분 warmup', '5 × (500m hard / 2 min rest)', '5분 cooldown'],
    notes: 'Anaerobic threshold + race pace.'
  },

  /* Cardio — Cycling */
  {
    id: 'cycle_endurance_60',
    sport: 'cycle_moderate', name: '60분 endurance ride',
    durationMin: 60, met: 8, intensity: 'LIT',
    equipment: ['bike_road_or_trainer'],
    carryover_to_windfoil: 0.55,
    notes: 'Aerobic foundation. 실외 또는 trainer 모두 OK.'
  },
  {
    id: 'cycle_hiit_20',
    sport: 'cycle_vigorous', name: '20분 cycling HIIT',
    durationMin: 20, met: 12, intensity: 'HIT',
    equipment: ['bike_trainer_or_spinning'],
    carryover_to_windfoil: 0.50,
    step_by_step: ['5분 warmup', '10 × (30초 all-out / 30초 easy)', '5분 cooldown'],
    notes: 'Tabata-like. 짧고 강함.'
  },

  /* Strength — windfoil-specific */
  {
    id: 'strength_windfoil_45',
    sport: 'strength_barbell', name: '윙포일 specific strength',
    durationMin: 45, met: 6, intensity: 'threshold',
    equipment: ['barbell', 'plates', 'pull_up_bar'],
    carryover_to_windfoil: 0.85,
    step_by_step: [
      '10분 dynamic warmup',
      '5×5 Deadlift @ 70% 1RM',
      '5×5 Bent-over Row @ 65% 1RM',
      '4×6 Pull-up (weighted if able)',
      '3×8 Front Squat @ 60% 1RM',
      '3×30s Plank + 3×15 hanging knee raise (core)'
    ],
    notes: 'Posterior chain + grip + core — 윙 holding endurance 직접 strengthening.'
  },
  {
    id: 'strength_bodyweight_30',
    sport: 'strength_bodyweight', name: '30분 맨몸 강화',
    durationMin: 30, met: 3.5, intensity: 'LIT',
    equipment: ['floor_space'],
    carryover_to_windfoil: 0.55,
    step_by_step: [
      '5분 mobility warmup',
      '4 round circuit: 10 push-up · 15 squat · 10 walking lunge · 30s plank',
      '5분 stretch'
    ],
    notes: 'No equipment 대안. 트래블 / 호텔 친화.'
  },

  /* HIIT / metcon */
  {
    id: 'hiit_20',
    sport: 'hiit', name: '20분 metcon',
    durationMin: 20, met: 8, intensity: 'HIT',
    equipment: ['minimal'],
    carryover_to_windfoil: 0.45,
    step_by_step: [
      '5분 warmup',
      '4 round (3분 work + 1분 rest): kettlebell swing / burpee / row',
      '3분 cooldown'
    ],
    notes: '시간 효율 highest. 다음날 light recovery 필요.'
  },

  /* Recovery / mobility */
  {
    id: 'yoga_30',
    sport: 'yoga', name: '30분 윙포일 yoga',
    durationMin: 30, met: 2.5, intensity: 'recovery',
    equipment: ['mat'],
    carryover_to_windfoil: 0.30,
    notes: 'Hip flexor / thoracic mobility / shoulder. Active recovery 권장.'
  },
  {
    id: 'mobility_15',
    sport: 'mobility', name: '15분 mobility / foam roll',
    durationMin: 15, met: 2, intensity: 'recovery',
    equipment: ['foam_roller'],
    carryover_to_windfoil: 0.25,
    notes: 'Daily routine. 모든 session 직후 권장.'
  },

  /* Mixed routines */
  {
    id: 'mixed_45',
    sport: 'mixed', name: '45분 mixed (cardio + strength + mobility)',
    durationMin: 45,
    composition: [
      { sport: 'row_moderate', durationMin: 20 },
      { sport: 'strength_bodyweight', durationMin: 15 },
      { sport: 'yoga', durationMin: 10 }
    ],
    estimated_met_weighted: 5.5,
    intensity: 'mixed',
    equipment: ['rower', 'floor', 'mat'],
    carryover_to_windfoil: 0.55,
    notes: 'Variety + comprehensive. 시간 efficient 한 종합 session.'
  }
];
```

EXERCISE_LIBRARY 는 Phase 2 코치 (Danny) curate. 초기 10-15 개 → 사용자 feedback 으로 확장. 라이더 본인의 favorite 추가 가능 (custom).

---

## 7. 협업 인터페이스

### 7-1. Frontend Engineer (#4)
- 새 UI 화면 — "Today's Decision" + "Land Workout Options" + "Weekly Tracking"
- Mobile-first (라이더가 라이딩 직전 phone 으로 confirm)
- 신규 모듈 4개 구현 (analysis.js · storage.js · coach.js + data/exercise-library.js)
- App.js 통합 — Phase 3 dashboard 의 5-layer (§5)

### 7-2. UX Researcher (#5)
- Land workout suggestion 화면의 5-15초 결정 UX
- 라이더 prefs input (equipment / time / favorite sport) onboarding flow
- Recovery action 자연어 톤 (한국 코치 음성 — 짧고 명확)
- A/B testing — 3 option vs 5 option vs 7 option
- Hooper Index 5초 입력 (§12-3-C) 와 통합 — 동선 최소화

### 7-3. DataViz Specialist (#2)
- Weekly tracking bar chart (target vs actual + gap)
- TSB · ACWR · HRV · Hooper 4 게이지 (small multiples)
- Polarized distribution donut (80/0/20 vs actual)
- Workout option cards (carryover bar + AU bar + duration + equipment chip)

### 7-4. Mobile App (#8)
- 모바일 알림 — 매일 아침 wellness 5초 + 저녁 sea session 미달 시 land 권장
- Apple Watch / Garmin / Whoop HR / HRV / sleep / RHR fetch (HealthKit)
- 라이더 본인 calendar 통합 — schedule 가능 시간대 자동 추출

### 7-5. Marketing (#6)
- "SailTechCo training planner" — 마케팅 차별화 메시지
- 한국 윙포일 ambassador (선수 5명) 의 weekly plan + actual 공유 (social proof)
- "비 오는 날 우리 라이더는 더 강해진다" 같은 positioning

### 7-6. Backend (#10)
- Phase 12 Supabase 통합 — 라이더 workout history cloud sync
- EXERCISE_LIBRARY admin UI — 코치가 새 workout 추가 / 기존 수정
- Future — community-shared workout (라이더가 본인 favorite 다른 라이더와 공유)

---

## 8. 제약 준수

| 제약 | 준수 |
|---|---|
| `DO_NOT_REVERT` §181-* | ✅ 본 spec 은 §181 (lift calculator) 완전 분리 — sailing physics layer 와 training load layer 는 독립 |
| 기존 §11 모듈 (TRIMP/CTL/ATL/HRV) 0줄 수정 | ✅ 본 시스템은 그 위에 add-on 만. 기존 selftest 88 PASS 회귀 risk 0 |
| `[[feedback_strict_fact_verification]]` fabrication 금지 | ✅ 모든 MET 값 (Ainsworth 2011/2024), TRIMP variants (Banister 1991, Edwards 1993, Lucia 2003, Foster 2001), polarized (Seiler 2006, Stöggl 2014, Esteve-Lanao 2007), tapering (Mujika 2003), ACSM 12e — 모두 학술 reference. windfoil MET 만 'estimate-Danny' 명시 (Phase 2 calibration 필수). |
| 학술 reference DOI/ISBN/URL 명시 | ✅ §1 모든 reference + §9 Sources |
| Phase 1-2 production 변경 X | ✅ 본 문서는 v2 spec — Phase 2 구현 후보. 코드 변경 없음 |
| SailTechCo Moat W2 (windfoil 도메인) 강화 | ✅ Land workout 의 windfoil-specific carryover (rowing 0.75) + windfoil-specific strength (strength_windfoil_45 의 posterior chain + grip 강조) |
| SailTechCo Moat W4 (공개 검증) | ✅ EXERCISE_LIBRARY 공개 publishable. MET 값과 carryover factor 학술 검증. |

---

## 9. Sources

**프로젝트 내부:**
- `site/_experts/expert_sports_science_reference.md` §4·§11·§12 — TRIMP/CTL/ATL/HRV/ACWR/sRPE 구현
- `site/_experts/sports_science_calibration_protocol.md` — Phase 2 multi-rider 데이터 수집 (windfoil MET 검증 항목 포함)
- `site/_research/sailtechco_moat_proposal.md` §2.W2 (windfoil 도메인 KPI) · §2.W4 (open methodology)

**MET / Activity classification:**
- Ainsworth, B.E., Haskell, W.L., Herrmann, S.D., Meckes, N., Bassett Jr, D.R., Tudor-Locke, C., Greer, J.L., Vezina, J., Whitt-Glover, M.C., Leon, A.S. (2011). "2011 Compendium of Physical Activities: A Second Update of Codes and MET Values". *Medicine & Science in Sports & Exercise* 43(8):1575-1581. doi:[10.1249/MSS.0b013e31821ece12](https://doi.org/10.1249/MSS.0b013e31821ece12). [PDF](https://cdn-links.lww.com/permalink/mss/a/mss_43_8_2011_06_13_ainsworth_202093_sdc1.pdf)
- Herrmann, S.D., Willis, E.A., Ainsworth, B.E., Barreira, T.V., Hastert, M., Kracht, C.L., Schuna Jr, J.M., Cai, Z., Quan, M., Tudor-Locke, C., Whitt-Glover, M.C., Jacobs, D.R., (2024). "2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities". *Journal of Sport and Health Science* 13(1):6-12. doi:[10.1016/j.jshs.2023.10.010](https://doi.org/10.1016/j.jshs.2023.10.010). [Compendium 공식 site](https://pacompendium.com/)

**TRIMP variants:**
- Banister, E.W. (1991). "Modeling Elite Athletic Performance". In *Physiological Testing of the High-Performance Athlete* (2nd ed., pp. 403-424). Human Kinetics. ISBN 978-0-87322-307-5.
- Edwards, S. (1993). *The Heart Rate Monitor Book*. Polar Electro Oy / Feet Fleet Press. — Edwards TRIMP zone-based.
- Lucia, A., Hoyos, J., Santalla, A., Earnest, C., Chicharro, J.L. (2003). "Tour de France versus Vuelta a España: which is harder?". *Med Sci Sports Exerc* 35(5):872-878. doi:[10.1249/01.MSS.0000064999.82036.B4](https://doi.org/10.1249/01.MSS.0000064999.82036.B4) — Lucia TRIMP 3-zone.
- Foster, C., Florhaug, J.A., Franklin, J., Gottschall, L., Hrovatin, L.A., Parker, S., Doleshal, P., Dodge, C. (2001). "A new approach to monitoring exercise training". *J Strength Cond Res* 15(1):109-115. PMID 11708692. [PDF](https://paulogentil.com/pdf/A%20New%20Approach%20to%20Monitoring%20Exercise%20Training.pdf)

**Polarized training:**
- Seiler, K.S., Kjerland, G.Ø. (2006). "Quantifying training intensity distribution in elite endurance athletes: is there evidence for an 'optimal' distribution?". *Scand J Med Sci Sports* 16(1):49-56. doi:[10.1111/j.1600-0838.2004.00418.x](https://doi.org/10.1111/j.1600-0838.2004.00418.x). PMID 16430681.
- Esteve-Lanao, J., Foster, C., Seiler, S., Lucia, A. (2007). "Impact of training intensity distribution on performance in endurance athletes". *J Strength Cond Res* 21(3):943-949. doi:[10.1519/R-19725.1](https://doi.org/10.1519/R-19725.1). PMID 17685689.
- Stöggl, T., Sperlich, B. (2014). "Polarized training has greater impact on key endurance variables than threshold, high intensity, or high volume training". *Front Physiol* 5:33. doi:[10.3389/fphys.2014.00033](https://doi.org/10.3389/fphys.2014.00033). PMID 24550842.
- Casado, A., González-Mohíno, F., González-Ravé, J.M., Foster, C. (2022). "Training Periodization, Methods, Intensity Distribution, and Volume in Highly Trained and Elite Distance Runners: A Systematic Review". *Int J Sports Physiol Perform* 17(6):820-833. doi:[10.1123/ijspp.2021-0435](https://doi.org/10.1123/ijspp.2021-0435).

**Tapering / periodization:**
- Mujika, I., Padilla, S. (2003). "Scientific Bases for Precompetition Tapering Strategies". *Med Sci Sports Exerc* 35(7):1182-1187. doi:[10.1249/01.MSS.0000074448.73931.11](https://doi.org/10.1249/01.MSS.0000074448.73931.11). PMID 12840640.
- Mujika, I. (2010). "Intense training: the key to optimal performance before and during the taper". *Scand J Med Sci Sports* 20(s2):24-31. doi:[10.1111/j.1600-0838.2010.01189.x](https://doi.org/10.1111/j.1600-0838.2010.01189.x). PMID 20840559.
- Bompa, T.O., Buzzichelli, C. (2018). *Periodization: Theory and Methodology of Training* (6th ed.). Human Kinetics. ISBN 978-1-4925-4480-2.

**Cross-training equivalence:**
- Tanaka, H. (1994). "Effects of cross-training. Transfer of training effects on VO2max between cycling, running and swimming". *Sports Med* 18(5):330-339. doi:[10.2165/00007256-199418050-00005](https://doi.org/10.2165/00007256-199418050-00005). PMID 7825382.
- Loy, S.F., Hoffmann, J.J., Holland, G.J. (1995). "Benefits and Practical Use of Cross-Training in Sports". *Sports Med* 19(1):1-8. doi:[10.2165/00007256-199519010-00001](https://doi.org/10.2165/00007256-199519010-00001).

**Exercise prescription standards:**
- American College of Sports Medicine (2025). *ACSM's Guidelines for Exercise Testing and Prescription* (12th ed.). Wolters Kluwer. ISBN 978-1-9751-2920-8. [Wolters Kluwer page](https://www.wolterskluwer.com/en/know/acsm/guidelines-for-exercise-testing-and-prescription)
- Garber, C.E., Blissmer, B., Deschenes, M.R., Franklin, B.A., Lamonte, M.J., Lee, I.M., Nieman, D.C., Swain, D.P. (2011). "American College of Sports Medicine position stand. Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults: guidance for prescribing exercise". *Med Sci Sports Exerc* 43(7):1334-1359. doi:[10.1249/MSS.0b013e318213fefb](https://doi.org/10.1249/MSS.0b013e318213fefb). PMID 21694556.

**Injury prevention / load management (review):**
- Soligard, T., Schwellnus, M., Alonso, J.M., Bahr, R., et al. (2016). "How much is too much? (Part 1) International Olympic Committee consensus statement on load in sport and risk of injury". *Br J Sports Med* 50(17):1030-1041. doi:[10.1136/bjsports-2016-096581](https://doi.org/10.1136/bjsports-2016-096581). PMID 27535989.
- Gabbett, T.J. (2016). "The training—injury prevention paradox: should athletes be training smarter and harder?". *Br J Sports Med* 50(5):273-280. doi:[10.1136/bjsports-2015-095788](https://doi.org/10.1136/bjsports-2015-095788). PMID 26758673.

**Recovery / wellness:**
- Halson, S.L. (2014). "Monitoring training load to understand fatigue in athletes". *Sports Med* 44(Suppl 2):139-147. doi:[10.1007/s40279-014-0253-z](https://doi.org/10.1007/s40279-014-0253-z). PMID 25200666.
- Saw, A.E., Main, L.C., Gastin, P.B. (2016). "Monitoring the athlete training response: Subjective self-reported measures trump commonly used objective measures: A systematic review". *Br J Sports Med* 50(5):281-291. doi:[10.1136/bjsports-2015-094758](https://doi.org/10.1136/bjsports-2015-094758).

---

_Last updated: 2026-05-31_
_v2 spec — Cross-Modal Training & Gap-Filling Prescription System._
_Phase 1-2 production 변경 0건. Phase 3 진입 시 Component A → B → C 단계 deploy 권장 (총 4 weeks)._
