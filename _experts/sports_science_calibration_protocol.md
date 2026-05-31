# Sports Science — Multi-rider Calibration Protocol (Phase 2)

| 항목 | 내용 |
|---|---|
| 문서 유형 | §181-C upwind polar 물리 모델의 multi-rider 일반화 검증 protocol |
| 작성 | Sports Science Researcher (#3) · 2026-05-28 |
| 대상 | `assets/js/lift-calculator.js` §181 upwind polar (LDWING_K · CL_WING_MAX · WING_AREA_REF_M2 · WING_HEEL_COUPLE_EXP · HEEL_DEG · TACK_ANGLE_DEG · ETA_BY_SKILL) |
| 범위 | Phase 2 — 데이터 수집·분석·publish. 코드 변경은 검증 후 ANCHOR 추가만 (§181-C lock 보존). |
| 근거 | `expert_sports_science_reference.md` §5 calibration plan · `sailtechco_moat_proposal.md` §2.W4 open methodology |
| 제약 | `DO_NOT_REVERT` §181-C·§181-D·§181-E·§181-F lock — 새 anchor 추가 시 기존 Danny anchor 무효화 X (overlay 방식). PhD 검수 가능 수준의 reproducibility document. |

> **목적.** 현재 §181 upwind polar 모델은 Danny 1인의 ground truth anchor 로 calibration 돼 있다. PhD 검수에서 단일 라이더 anchor 의 일반화 risk 는 1차 reject 사유. 본 protocol 은 n ≥ 5 라이더 데이터로 모델의 cross-rider transferability 를 검증하고, 결과를 학술 publish 한다 (SailTechCo Moat W4 의 실행).

---

## 1. 현재 calibration 상태 (Phase 1 baseline)

| Anchor | 출처 | 풍속 | 라이더 spec | 장비 spec | 결과 (관측) | 보정된 변수 |
|---|---|---|---|---|---|---|
| A1 | Danny | 11 kt | 80 kg · 상급-선수 (η=0.92) | foil R6 V1 (AR 13.7, 479 cm²) · wing 7 m² (AR 4.5) | V_boat ≈ 18 kt | LDWING_K 1.83 → 2.2 (§181-C) |
| A2 | Danny | 12 kt | 70 kg · 중급 (η=0.75) | foil AR 6.5 | optimum wing ≈ 6 m² | CL_WING_MAX 1.2 → 1.0 (§181-D) |
| A3 | Danny | 10 kt | 70 kg · 상급-선수 | foil R6 V1 (AR 13.7) | optimum wing ≈ 7.4 m² (단조 증가 표시구간) | CL_WING_MAX 1.2 → 1.0 (§181-D) |
| A4 | Danny | 10 kt | 70 kg · 선수 (η=0.95) | foil R6 V1 | optimum wing ≈ 7.5 m² | WING_AREA_REF_M2 5.5 → 7.5 (§181-E) |
| A5 | Danny | 8/12/14/16/18/20 kt | 70 kg · 선수 | foil R6 V1 | 풍속 sensitivity 지수 ≈ -0.9 | WING_HEEL_COUPLE_EXP 0 → -1.2 (§181-E) |

**한계 (PhD 검수 risk).**
- 모든 anchor 가 Danny (1 라이더) — 일반화 검증 부재
- 한 가지 wing brand 위주 (Levitaz 가정)
- 한 spot 위주 (송정/시화호 가정 — 실 location 미명시)
- ground truth 측정 method 가 standardize 안 됨

---

## 2. Phase 2 데이터 수집 protocol

### 2-1. Rider recruitment (n ≥ 5)

**Target population — 한국 윙포일 커뮤니티의 다양성 cover:**

| Rider profile | 목표 수 | 충원 source |
|---|---|---|
| 입문 (η=0.45) | 1 | 단무지공방 컨설팅 클라이언트 (송정 클럽) |
| 초급 (η=0.60) | 1 | 송정·다대포 커뮤니티 (네이버 카페) |
| 중급 (η=0.75) | 2 | Danny 코칭 네트워크 |
| 상급 (η=0.88) | 2 | 시화호·강릉 라이더 그룹 |
| 선수 / 상급-선수 (η=0.92~0.95) | 2 | 단무지공방·Levitaz 한국 ambassador |

**체중 분포 — minimum 60-90 kg cover:**
- 경량 (60-70 kg): 2 명
- 중간 (70-80 kg): 3 명
- 중대 (80-90 kg): 2 명

**Foil 다양성 — 4 brand minimum:**
- Levitaz R6 (race AR 13.7), FW 540 / 680 / 790 / 900 (freeride AR 6-9)
- Takoon X-Glide V2 / Glide HA / Flow / Flash
- PPC M1 / M2 / FDS
- WIP (Forward) — accessory만 (foil 없음 → 다른 brand 사용)

### 2-2. Equipment / sensor stack

**Required:**
- **RaceBox Mini** (25 Hz GPS) — primary V_b ground truth
- **Apple Watch / Garmin Forerunner / Whoop** — HR + IMU (heel/pitch via Core Motion)
- **GoPro Hero 11+** — 보드 마운트, 정면 + 측면 동기 영상 (라이더 자세 + 윙 angle 분석)
- **자체 라이더 instrument** — Vakaros Atlas 2 보유자는 .vkx 도 수집 (heel/pitch direct)

**Optional (Phase 3):**
- **Calypso wind sensor** (BLE) — 라이더 자체 풍속·풍향 측정 (외부 weather API 대체)
- **Polar H10** — RR-interval (HRV)
- **Movesense** — IMU ECG (HR + RR)

**Calibration before each session:**
- RaceBox firmware version 명시 (사용된 firmware)
- Apple Watch 자기 차폐 calibration (figure-8 ride, AN4246)
- GoPro 시간 동기 (라이더 손목 watch 와 ±100ms 안)

### 2-3. Test protocol — 표준 8-12 세션 / 라이더

**Wind sweep — 4 영역 × 2-3 세션:**

| 풍속 영역 | 측정 횟수 | session 길이 | 측정 내용 |
|---|---|---|---|
| 8-10 kt (light) | 2 | ≥ 30 분 | takeoff·downwind 위주, 풍상 가능 시 마지막 5분 close-hauled |
| 12-14 kt (medium) | 3 | ≥ 45 분 | upwind/downwind cycle 5+회 |
| 16-18 kt (strong) | 3 | ≥ 45 분 | upwind/downwind cycle 8+회, depower 영역 진입 |
| 20-22 kt (heavy) | 2 | ≥ 30 분 | 컨트롤 한계, 작은 윙 (라이더 안전 우선) |

**Per-session wing sweep — 같은 spot·같은 라이더·같은 풍속:**
- 라이더 1세션 = 1 wing size 만 (윙 교체 시 시간·노력 cost 높음)
- wing size 는 라이더 본인이 보유한 lineup 에서 선택 — 강제 안 함
- 같은 풍속 영역에서 다른 라이더가 다른 wing size = cross-rider 데이터

**Ground truth annotation (post-session, 비디오 review):**

| 항목 | 측정 방법 | 정확도 |
|---|---|---|
| V_boat (sustained upwind) | RaceBox 25 Hz, close-hauled 30초 윈도 평균 | ±0.5 kt |
| Tack angle (TWA) | 풍향 (외부 측정) + GPS heading 차이 | ±2° |
| Heel angle | Apple Watch IMU pitch + 비디오 cross-check | ±3° |
| Wing C_L (qualitative) | 비디오 — flag/luff 정도, sheet angle | qualitative 3-level |
| Rider self-rated effort | 라이더 본인 RPE (1-10) | qualitative |

### 2-4. Recording form (per session)

```yaml
# session_metadata.yml
session_id: sess_2026-07-15_danny_001
date: 2026-07-15
spot: songjeong  # songjeong | dadaepo | sihwaho | gangneung | gorebul
location:
  lat: 35.1786
  lng: 129.2002
weather:
  source: kma_rdaps  # or windguru / external
  wind_speed_kt: 12.5
  wind_direction_deg: 235
  gust_kt: 14.2
  air_temp_c: 22
  water_temp_c: 20
  wave_height_m: 0.5  # qualitative — knee / waist / chest
rider:
  id: danny  # anonymized
  weight_kg: 80
  height_cm: 180
  age: 38
  skill: 상급-선수
  eta_estimated: 0.92
  experience_years: 8
gear:
  foil:
    brand: Levitaz
    model: R6 FW V1
    front_wing_area_cm2: 479
    front_wing_ar: 13.7
    mast_cm: 90
    stab_cm2: 180
  wing:
    brand: Takoon
    model: Wing V4 Pro
    size_m2: 7.0
    ar_estimated: 4.5
  board:
    brand: Levitaz
    model: Boom FS 83
    volume_l: 83
session:
  duration_min: 47
  conditions: clean  # clean | light_gust | heavy_gust
  rider_rpe: 6  # 1-10 perceived effort
  notes: |
    Upwind cycle 6회. Last 10 min depower 진입 — wing felt overloaded.
recordings:
  racebox: data/sess_001/racebox.gpx
  apple_watch: data/sess_001/watch.fit
  gopro_front: data/sess_001/gopro_front.mp4
  gopro_side: data/sess_001/gopro_side.mp4
  vkx: null  # only if Vakaros equipped
ground_truth:
  v_boat_upwind_kt: 14.2  # 30s sustained close-hauled
  tack_angle_deg: 52
  heel_deg_avg: 38
  c_l_qualitative: full  # full | reduced | depowered
  reviewer: danny
  reviewed_at: 2026-07-15T20:00:00Z
```

---

## 3. Analysis protocol

### 3-1. Model prediction (current)

각 세션에 대해 `Lift.upwindSpeed()` 호출 — 입력 = rider + gear + wind, 출력 = V_b_predicted.

### 3-2. Validation metrics

**Per-rider MAE (라이더 본인 calibration 후):**
```
MAE_rider_i = (1/n_i) × Σ_j |V_b_predicted_ij − V_b_observed_ij|
target: MAE_rider < 1.0 kt
```

**Cross-rider transferability (라이더 i 의 데이터로 라이더 j 예측):**
```
MAE_cross_ij = (1/n_j) × Σ_k |V_b_predicted_ik_j − V_b_observed_jk|
target: MAE_cross < 2.0 kt
```

**Wind / skill marginal effect — monotonic + 정성적으로 정확:**
- 같은 라이더, 같은 wing, 풍속만 변화 → V_b 단조 증가
- 같은 라이더, 같은 wind, wing 사이즈만 변화 → V_b 역U 곡선 (정점 존재)
- 같은 풍속, 같은 wing, 스킬만 변화 → V_b + VMG 단조 증가

### 3-3. Statistical analysis (Hastie et al. 2009 ESL ch.7)

**Cross-validation — k-fold leave-one-rider-out:**
- 각 fold: 1 라이더 제외, 나머지 4-6 라이더 데이터로 calibration → 제외 라이더 예측
- MAE_cross 통계 (n=5 fold)

**Calibration parameter sensitivity — bootstrap (n=1000):**
- LDWING_K, CL_WING_MAX, WING_AREA_REF_M2, WING_HEEL_COUPLE_EXP 각각의 95% CI

**Residual analysis:**
- residual = V_b_observed − V_b_predicted
- 라이더 / 풍속 / wing size / spot 별 residual plot
- systematic bias detection (특정 그룹에서 over/under-predict)

---

## 4. Acceptance criteria — 모델 일반화 통과 기준

### 4-1. Primary (Phase 2 진입 조건)

| Metric | Target | Rationale |
|---|---|---|
| Per-rider MAE | < 1.0 kt (cruise 영역) | 단일 라이더 본인 예측 신뢰 |
| Cross-rider MAE | < 2.0 kt | 새 라이더 first-use 신뢰 (가입 후 첫 세션) |
| Wind marginal monotonicity | 100% (모든 라이더 fold) | 물리 기본 — 풍속 ↑ → V_b ↑ |
| Wing optimum 존재 | 모든 라이더에서 역U 곡선 | §181 핵심 가정 |
| Skill marginal monotonicity | 100% | η_skill ordering 검증 |

### 4-2. Stretch (Phase 3 publish 조건)

| Metric | Target | Rationale |
|---|---|---|
| Per-rider MAE | < 0.5 kt | PhD 검수 통과 기준 |
| Cross-rider MAE | < 1.5 kt | publish 가능 수준 |
| Foil brand transferability | 같은 AR 안에서 brand 차이 < 0.3 kt | foil-agnostic 모델 검증 |
| Wing brand transferability | 같은 size·AR 안에서 brand 차이 < 0.3 kt | wing-agnostic 모델 검증 |
| Calibration parameter CI | 95% CI width < 20% of point estimate | 모델 의미 있음 |

### 4-3. Fail-fast — calibration 재진행 트리거

| 발견 | 조치 |
|---|---|
| 어떤 라이더에서 V_b MAE > 3 kt | 그 라이더의 spec 재확인 (skill 등급·η 추정 오류 가능). 1차 — η_BY_SKILL 미세 보정. |
| 모든 라이더에서 systematic 방향성 bias (예: 모든 V_b 가 over-predict) | LDWING_K 재calibrate (현재 2.2 anchor 와 충돌 발견 — Danny anchor 우선 보존하면서 새 안 추가) |
| 풍속 marginal 비단조 | UPWIND_VB_CAP_KT 또는 CL_WING_MAX 재검토 |
| Wing optimum 부재 | WING_HEEL_COUPLE_EXP 재calibrate (Phase 1 의 §181-E pattern) |

---

## 5. Publish plan (SailTechCo Moat W4)

### 5-1. Internal validation report (Phase 2 종료 직후)

**`site/_research/calibration_validation_2026Q3.md`:**
- §1 Methods (본 protocol)
- §2 Recruited riders (n=5+, anonymized)
- §3 Recording summary (총 세션 수, 풍속 분포 cover)
- §4 Per-rider MAE table
- §5 Cross-rider MAE table
- §6 Residual plots (라이더 / 풍속 / wing size / spot 별)
- §7 Calibration parameter 95% CI (bootstrap n=1000)
- §8 Marginal effect curves (풍속 / wing / 스킬)
- §9 Pass/fail per §4 criteria
- §10 Recommended model updates (Danny anchor 보존 + 새 anchor overlay)

### 5-2. GitHub repo first publish

**`github.com/sailtechco/lift-calibration` (MIT License):**

```
lift-calibration/
├── README.md                      # protocol + reproducibility instructions
├── protocol/                       # 본 문서 + recording form template
├── data/                           # anonymized session data (CC-BY-4.0)
│   ├── sess_*/                     # per-session: yaml + gpx + fit
│   └── ground_truth/               # video annotations (manual)
├── analysis/                       # python notebook
│   ├── per_rider_mae.ipynb
│   ├── cross_rider_mae.ipynb
│   ├── parameter_sensitivity.ipynb
│   └── residual_plots.ipynb
├── tests/                          # automated regression tests
└── docs/
    ├── methodology.md              # full academic methodology
    └── results.md                   # current validation results
```

**Anonymization** — 라이더 id 는 sequential (rider_001, rider_002) · 정확한 spot 은 cluster (Korea_west / Korea_south) · GoPro 영상은 publish 안 함 (privacy) · 라이더 본인 동의 후만 (informed consent).

### 5-3. Academic paper draft (Phase 3)

**Target journal:** *Sports Engineering* (Springer, ISSN 1369-7072) — sports tech 표준 venue.

**Title:** "An Open Upwind Polar Model for Wingfoil Boards Calibrated to Multi-Rider In-Water Data".

**Sections:**
1. Introduction — sailing analytics market gap, wingfoil specific physics
2. Related Work — Larsson & Eliasson 2022, Faltinsen 2005, Folkersma et al. 2019, ORC IMS VPP
3. Methods
   - 3.1 Physics model (§181 polar equilibrium — apparent wind, β, heel-out cap, LD_wing, LD_foil)
   - 3.2 Calibration parameters (LDWING_K, CL_WING_MAX, WING_AREA_REF_M2, WING_HEEL_COUPLE_EXP)
   - 3.3 Data collection protocol (본 문서)
4. Validation — per-rider + cross-rider MAE, parameter CI, marginal effects
5. Discussion — limitations (wind-tunnel data 부재, race-foil cavitation 미모델링)
6. Open Source — github.com/sailtechco/lift-calibration (MIT/CC-BY-4.0)
7. Future Work — Phase 3 race foil + downwind polar + dynamic gust response

### 5-4. Korean Sport Science Society 발표 (Phase 3, Q4 2027)

KSSS 2027 학회 — 한국 윙포일 sport science 도메인 진입의 첫 academic publication.

---

## 6. Timeline (Phase 2)

| Week | Milestone |
|---|---|
| W1-2 | Rider recruitment (Danny coaching network + 송정/시화호/강릉 community outreach) |
| W3 | Equipment procurement (RaceBox 5대, GoPro 5대 — 단무지공방 자산 + 라이더 본인 보유) |
| W4-5 | Test protocol pilot — Danny + 1 라이더 (Danny replication 으로 protocol 검증) |
| W6-12 | Main data collection — 라이더 5-7명 × 8-12 세션 = 40-84 세션 |
| W13-14 | Ground truth annotation (비디오 review, post-session) |
| W15-16 | Analysis (Python notebook 작성, CV + MAE + bootstrap) |
| W17-18 | Internal validation report + Model update plan (Danny anchor 보존 + 새 anchor overlay) |
| W19-22 | GitHub repo publish + 학술 paper draft |
| W23-26 | Paper submit (Sports Engineering) |

**Total: 6 months Phase 2** (2026 여름~겨울 시즌 활용).

---

## 7. Risk register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | 라이더 5명 충원 실패 (한국 윙포일 인구 적음) | timeline +1-2 month | Levitaz Korean retail + Takoon dealer 네트워크 활용 |
| R2 | 풍속 영역 cover 불가 (8/16/20 kt 동시 보유 어려움) | partial validation | 시즌 sweep — 봄·여름·가을·겨울 각각 다른 풍속 영역 |
| R3 | GoPro 비디오 annotation 노동 부담 (per session 1-2시간) | timeline +2 weeks | semi-automated annotation tool (Python + OpenCV — Phase 3) |
| R4 | Calibration 실패 (current §181 model 이 multi-rider 에서 깨짐) | 모델 재설계 | Danny anchor 보존 protocol — 새 라이더 영역만 새 anchor 추가 (§181-* lock 유지) |
| R5 | 라이더 자기 평가 (skill 등급·η) 오류 | residual bias | post-hoc η 보정 — observed residual 로 라이더 η 재추정 가능 |
| R6 | RaceBox 정확도 한계 (1.5m CEP) | V_b 측정 ±0.5 kt | sustained 30초 윈도로 평균 — single point noise 거부 |
| R7 | 라이더 privacy 우려 | publish 지연 | informed consent + anonymization (rider_001 등) |

---

## 8. 협업 인터페이스

### 8-1. Hardware Engineer (#7)
- RaceBox 5대 procurement + firmware 표준화
- (Phase 3) 자체 SailTechMOTION 센서 EVT 1대 — calibration 데이터셋 입력 검증

### 8-2. Mobile App Engineer (#8)
- iOS SailTechHUB 앱이 Apple Watch IMU heel/pitch 자동 측정·저장 기능 추가 (Phase 2)
- Ground truth annotation 모바일 UI (라이더 본인이 라이딩 직후 5초 입력)

### 8-3. DataViz Specialist (#2)
- Per-rider / cross-rider MAE 시각화 — heatmap + box plot
- Residual plots — per-variable (라이더 / 풍속 / wing / spot)
- Marginal effect curves — Phase 2 internal report 의 시각화

### 8-4. UX Researcher (#5)
- Rider recruitment 의 communication 톤 (한국 윙포일 커뮤니티 — 네이버 카페 · 카카오톡)
- Informed consent form 작성 (한국어, plain language)
- Post-session ground truth annotation UI 의 5초 완료 가능성 검증

### 8-5. Backend Engineer (#10)
- Calibration 데이터 cloud storage (Supabase) — Phase 12 와 통합
- Anonymization pipeline (rider_id mapping)

---

## 9. 제약 준수

| 제약 | 준수 |
|---|---|
| `DO_NOT_REVERT` §181-C·D·E·F lock — Danny anchor 보존 | ✅ 새 anchor 는 overlay 방식 (기존 Danny anchor 무효화 X). 모델 재설계 시 Danny 가 사용한 spec 에서는 기존 결과 동일하게 산출 |
| `[[feedback_strict_fact_verification]]` 절대 fabrication 금지 | ✅ 모든 anchor 는 실 측정 라이더 데이터. Synthetic / inferred 0건 |
| Phase 1 production 코드 변경 X | ✅ 본 문서는 Phase 2 protocol — 데이터 수집 + 분석 + report. 코드 변경은 Phase 2 종료 직후 anchor overlay 추가만 |
| 학술 reference 명시 | ✅ §3 statistical methods · §5 publish — Hastie 2009 ESL, Springer Sports Engineering, Folkersma 2019, ORC IMS VPP |
| 라이더 privacy | ✅ anonymization (rider_001), informed consent, GoPro 영상 비공개 |

---

## 10. Sources

**프로젝트 내부:**
- `site/_experts/expert_sports_science_reference.md` §5 calibration plan
- `site/_research/sailtechco_moat_proposal.md` §2.W4 open methodology
- `site/assets/js/lift-calculator.js` §181-C·D·E·F (current Danny anchors)

**외부 학술 reference:**
- Hastie, T., Tibshirani, R., & Friedman, J. (2009). *The Elements of Statistical Learning* (2nd ed.). Springer. ISBN 978-0-387-84857-0. doi:[10.1007/978-0-387-84858-7](https://doi.org/10.1007/978-0-387-84858-7). [무료 PDF (Stanford)](https://hastie.su.domains/ElemStatLearn/) — Cross-validation, bootstrap, residual analysis 표준 교과서.
- Larsson, L., Eliasson, R., & Orych, M. (2022). *Principles of Yacht Design* (5th ed.). Bloomsbury. ISBN 978-1-3994-0301-6.
- Faltinsen, O.M. (2005). *Hydrodynamics of High-Speed Marine Vehicles*. Cambridge University Press. doi:[10.1017/CBO9780511546068](https://doi.org/10.1017/CBO9780511546068).
- Folkersma, M., Schmehl, R., & Viré, A. (2019). "Boundary layer transition modeling on leading edge inflatable kite airfoils". *Wind Energy*, 22(7), 908-921. doi:[10.1002/we.2329](https://doi.org/10.1002/we.2329).
- [ORC IMS VPP Documentation](https://www.orc.org/index.asp?id=37) (race-foil polar reference).
- [Sports Engineering (Springer)](https://link.springer.com/journal/12283) — target publication venue.

**외부 device / 표준:**
- [RaceBox Mini protocol documentation](https://www.racebox.pro/products/racebox-mini)
- [Vakaros VKX 1.4 spec](https://github.com/vakaros/vkx)
- [Apple Watch Core Motion API](https://developer.apple.com/documentation/coremotion)
- [NXP AN4246 — Hard/Soft Iron Magnetometer Calibration](https://www.nxp.com/docs/en/application-note/AN4246.pdf)

---

_Last updated: 2026-05-28_
_Phase 2 calibration protocol — 데이터 수집 + 분석 + publish + 모델 update plan._
_Production 코드 변경 0건 (Phase 1). Phase 2 진입 시 §181 anchor overlay 만 추가._
