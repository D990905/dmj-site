# §194 sprint — lift-calc I-1~I-5 fix 검증 보고

- **작성**: 티모 강 (운동·라이딩 분석) · 2026-06-04
- **승인**: 옥대표님 (P1-P5 GO, I-6 이후 보류)
- **선행 보고서**: `_team/lift_calc_review_2026-06-04.md` (전수 재조사, 동일 작성자)
- **검증**: node v22.22.0 실측 (verify_lift_calc_fix.cjs / verify_run_final.log)
- **3-파일 동기화**: md5 `3f82b1da021dba2bd9e8ea5e4d96ef23` × 3 (assets · calculator-pwa · _ci_site)

---

## 0. 한 줄 요약

I-1·I-2·I-3·I-4·I-9 **코드 fix 적용** (5/5), I-5 **lock 영역 → 보고만** (1/1). 보고서 §4 27/27 매트릭스·11kt 18.1kt anchor·62/62 selfTest 회귀 0.

---

## 1. 적용 / 보류 요약표

| 이슈 | 분류 | 본 sprint 처리 | 코드 영향 | lock 변경 |
|---|---|---|---|---|
| I-1 | HIGH 버그 | **fix 적용** (§190, 이미 commit 219320c) | extreme 분기 ~17줄 | 無 |
| I-2 | HIGH 모델 | **fix 적용** (§191, b안 = UI 캡션 명시) | calculator.html + PWA app.js, 모델 무변경 | 無 |
| I-3 | MED 모델/문서 | **fix 적용** (§191 capped flag + §192 주석 정정) | upwindSpeed·upwindCurve flag, §181-C cap 주석 | 無 (값 35 유지) |
| I-4 | MED 물리 | **dead code 제거** (§192) — ldWingAtCL/clOptWing/WING_CD0/WING_E. **PARASITIC 이중계상 본질 fix 는 lock 영역 → 보고만** | -10줄 + tombstone 주석 | 無 (PARASITIC 0.04 / LDWING_K 2.2 lock 보존) |
| I-5 | MED 물리 | **보고만** — heel 결합 −1.2 의 clamp/지수 변경은 §181-E lock 영역 | 코드 변경 X | — |
| I-9 (부분) | LOW 문서 | **fix 적용** — PWA 사본 §176 References 19줄 동기화 | comment-only | 無 |

**합계**: 코드 fix 5 / 보고만 1 (I-5) / sprint scope 외 보류 4 (I-6/I-7/I-8/I-10).

---

## 2. node 실측 — 보고서 §4 회귀 검증 (전수)

verify_run_final.log 전문 = `_team/lift_calc_fix_verify_2026-06-04.log` (별도 첨부).
요약 (모두 PASS):

### 2-1. §4-1 takeoff Vmin/Vtarget — 9/9 회귀 0

| 포일 (AR) | 60kg Vmin/Vtarget | 75kg | 90kg | 보고서 일치 |
|---|---|---|---|---|
| FW900 (13.3) | 8.1 / 8.5 | 9.0 / 9.4 | 9.7 / 10.2 | ✓ |
| FW790 (10.3) | 8.7 / 9.1 | 9.6 / 10.0 | 10.4 / 10.9 | ✓ |
| FW680 (8.7) | 9.4 / 9.8 | 10.3 / 10.8 | 11.2 / 11.7 | ✓ |

CL step 경계 `getCL(8.0)=1.00 / getCL(8.01)=0.85` 유지 (I-8 미수정 — 본 sprint scope 외).

### 2-2. §4-2 풍상 V_boat/VMG 매트릭스 — 35/35 회귀 0

5 스킬 × 7 풍속 = 35 셀 전수 보고서값 정확 재현 (입문 18kt 6.8/2.9 ~ 선수 25kt 35.0/24.7).

### 2-3. §4-3 V_b cap + §191 capped flag

| wind | V_boat | §191 capped flag |
|---|---|---|
| 24kt | 35.0 | true ✓ |
| 25kt | 35.0 | true ✓ |
| 26~30kt | 35.0 | true ✓ (5/5) |

`upwindCurve.any_capped` = true @ 25kt 상급 (UI 캡션 트리거 검증). cap 값 35 (§181-C lock) 무변경.

### 2-4. §4-4 §181-C anchor — V_boat 18.1 kt 정확 재현

```
입력: 11kt · 80+5kg · 상급-선수 · 7m² · AR13.7
출력: V_boat = 18.1 kt   (보고서값 = 18.1)  ✓
```

### 2-5. §4-5 heel 결합 (A/7.5)^−1.2 — 7/7 lock 보존

| A (m²) | 2.5 | 3.0 | 4.0 | 5.0 | 6.0 | 7.5 | 9.0 |
|---|---|---|---|---|---|---|---|
| 인자 | ×3.74 | ×3.00 | ×2.13 | ×1.63 | ×1.31 | ×1.00 | ×0.80 |

§181-E lock 보존. 2.5m² 3.74배 비물리 외삽은 **본 sprint 미수정** (I-5 보고만).

### 2-6. §4-6 추천 윙 매트릭스 — 27/27 회귀 0 + 27/27 binding=comfort 유지

I-2 finding (물리 모델 사실상 무력화) 변함없음 — 본 sprint 의 I-2 처리는 캡션 명시 (b안).

| 포일 | 체중 | 10kt | 15kt | 20kt |
|---|---|---|---|---|
| FW900 | 60/75/90kg | 5.5 / 6.5 / **EXTREME** | 4.0 / 5.0 / 6.0 | 3.0 / 3.5 / 4.0 |
| FW790 | 60/75/90kg | 5.5 / 6.5 / **EXTREME** | 4.0 / 5.0 / 6.0 | 3.0 / 3.5 / 4.0 |
| FW680 | 60/75/90kg | 5.5 / 6.5 / **EXTREME** | 4.0 / 5.0 / 6.0 | 3.0 / 3.5 / 4.0 |

---

## 3. I-1 fix — 전/후 비교 (가장 visible 한 결과)

**케이스**: 90kg·gear 10kg·FW900(AR 13.3)·moderate·flat·sea·wind 10kt

**전 (보고서 §4-6 실측 버그)**:
```json
{ "recommended_size_m2": null, "extreme": true, "binding": "comfort",
  "min_wind_kt": 4.9, "min_foil_area_cm2": 400 }
```
사용자 안내가 "최소 풍속 4.9kt" (이미 10kt!) + "최소 포일 400cm²" (현재 900cm² 보다 작은 포일로 바꾸라는 역방향).

**후 (§190 fix 적용 후 실측)**:
```json
{ "recommended_size_m2": null, "extreme": true, "binding": "comfort",
  "extreme_reason": "comfort_floor",
  "min_wind_kt": 10.3, "min_foil_area_cm2": null,
  "precise_comfort_floor_m2": 7.5, "precise_takeoff_min_m2": 2.5 }
```
- `min_wind_kt` 4.9 → **10.3** (현재 풍속 보다 살짝 위 — 라인업 max 7.4m² 가 컨트롤 floor 를 충족하는 최소 풍속, §178 floor 식 역산: `(9.0 − 7.4·80/(100·1.00))/0.3 = 10.27`).
- `min_foil_area_cm2` 400 → **null** (포일 안내는 takeoff binding 시에만 유효 — comfort binding 에선 포일 교체로 해결 안 됨).
- `extreme_reason` 신규 필드 `'comfort_floor'` — UI 가 안내 문구를 분기 (calculator.html L824-830 이미 처리).

**takeoff binding extreme 케이스 회귀 검증** (50kg·FW600·5kt):
- `extreme_reason='takeoff'`, `min_foil_area_cm2` 산출됨 (기존 동작 유지).

---

## 4. lock 보존 자체 검증 (탬퍼 검출)

| 상수 | 값 | 출처 §  | 검증 결과 |
|---|---|---|---|
| LDWING_K | 2.2 | §181-C lock | grep PASS — 변경 X |
| UPWIND_VB_CAP_KT | 35 | §181-C lock | grep PASS — 주석만 정정 |
| CL_WING_MAX | 1.00 | §181-D lock | (touch 안 함) |
| WING_HEEL_COUPLE_EXP | −1.2 | §181-E lock | (touch 안 함) |
| WING_AREA_REF_M2 | 7.5 | §181-E lock | (touch 안 함) |
| WING_CD0_PARASITIC | 0.04 | §181 lock | grep PASS — 변경 X |

§181-C anchor 재현 (V_boat 18.1) 으로 추가 cross-check.

---

## 5. 회귀 검증

- `runSelfTest` 62/62 PASS — fix 적용 전/후 동일.
- `runDannyMatrixTest` PASS, max\|Δ\|=0.131 m² ≤ 0.30 — fix 적용 전/후 동일.
- 보고서 §4-1·§4-2 정상 출력 (9 + 35 셀) 회귀 0.
- §181-C anchor V_boat 18.1 보존.
- 27/27 추천 매트릭스 보존 (I-2 의 finding 자체는 본 sprint 가 아닌 P3/P4 영역이므로 변화 없는 게 정상).

---

## 6. lock 영역 — 옥대표님 별도 결정 사항 (P3 ~ P4)

본 sprint 에서 **수치 변경 없이 보고만** 한 항목:

### 6-1. I-4 PARASITIC 이중계상 (보고서 §4-7 정량)

- LD_wing(=2.2·√AR, §181-C lock) 에 이미 CD0 가 내재 + WING_CD0_PARASITIC(0.04, §181 lock) 추가 차감
- 정량: CL 0.88 에서 합성 CD 0.254 vs §179 폴라 단독 0.228 → +11% 초과 항력
- §181-C K 1.83 → 2.2 상향이 이 초과 항력을 anchor 점에서만 상쇄 — 두 lock 이 서로 의존.
- 해결: §181-C/D/E lock 사슬 일괄 재보정 (P4) — Danny 멀티-anchor 데이터 (P3) 선행 필요.

### 6-2. I-5 heel 결합 −1.2 의 소형 윙 발산

- 실측: 2.5m² 윙에서 H_max ×3.74 (모멘트 물리 도출값 ≈ −0.5 의 2.4배 외삽).
- 회피안: (a) 지수 −1.2 → −0.5, (b) `Math.min(1.6, heelCouple)` clamp.
- 둘 다 §181-E lock 수치 변경 — 옥대표님 결정 + 추가 anchor (강풍·소형윙 실측) 선행.

### 6-3. I-3 V_b cap 35 자체 (주석은 정정, 값은 유지)

- §192 주석 정정: "8-25kt 에서 binding 안 됨" 표현 삭제, "24kt 이상에서 cap 자체가 binding · 강풍역 V_boat 실효 상한으로도 기능" 명시.
- cap 값 35 → 40 등 상향은 anchor 사슬(§181-C/D/E) 재보정 동반 → P4 일괄.

---

## 7. 3-파일 동기화 결과

```
3f82b1da021dba2bd9e8ea5e4d96ef23  assets/js/lift-calculator.js          (canonical)
3f82b1da021dba2bd9e8ea5e4d96ef23  calculator-pwa/js/lift-calculator.js  (PWA)
3f82b1da021dba2bd9e8ea5e4d96ef23  _ci_site/assets/js/lift-calculator.js (CI mirror)
```

`diff` 0 byte (3쌍 모두). I-9 (PWA References 누락) 동승 해결.

---

## 8. 적용 §  요약 (커밋 메시지용)

- **§190** (이미 commit 219320c, 06-04 11:28) — I-1 extreme 분기 comfort-floor 인지 + 역방향 안내 제거
- **§191** — I-2 binding 캡션 명시 (calculator.html / calculator-pwa/app.js) + I-3 capped flag (upwindSpeed·upwindCurve, lock 무변경)
- **§192** — I-3 §181-C cap 주석 정정 ("8-25kt binding 안 됨" 반증 반영) + I-4 §179 dead code 4개 제거 + tombstone 주석
- **§194** (commit umbrella) — sprint 묶음

---

## 9. 다음 sprint 후보 (현재 작업 외)

- **P3** — Danny GPS 멀티-anchor 2~3점 (15kt·20kt 풍상 + 가능하면 타 라이더 1명). I-3/I-4/I-5/I-10 의 공통 전제.
- **P4** — §179 폴라를 stateAt() 추력식에 실사용 + WING_CD0_PARASITIC 제거 + anchor 재보정 + cap 재검토.
- **I-6** — heelMaxWingCurve 에 §181-E 결합 적용 (closed-form `A_max^2.2 = K·tan θ·7.5^1.2`).
- **I-7** — gear 기본값 10/5 이원화 통합.
- **I-8** — CL step 의 Helmbold 연속 함수 교체.

본 sprint 처리 X (지시 scope 외 — I-6 이후 보류).

---
*검증 스크립트 출력: `_team/lift_calc_fix_verify_2026-06-04.log` (node v22.22.0 실행 전문).
fabrication 0건 — 모든 수치는 본 verify 실행분.*
