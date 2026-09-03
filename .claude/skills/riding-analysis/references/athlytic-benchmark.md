# Athlytic 벤치마킹 (2026-09-02)

옥대표: "우리 피트니스 트랙커 기능을 대부분 다 가지고 있어서. 벤치마킹해야해."

---

## 한 줄 요약

**Athlytic 은 우리가 이미 설계해 놓고 비워 둔 슬롯을 채운 앱이다.**
우리 `coach.js` 의 회복 판정은 **4인자(TSB · ACWR · HRV 편차 · Hooper)**
로 이미 짜여 있는데, 실제로 넘기는 건 **둘(TSB · ACWR)뿐**이다.
나머지 둘은 소스에 `— 향후` 라고 적혀 있고 그대로 비어 있다.
Athlytic 의 핵심 지표(Recovery)가 바로 그 빈 슬롯이다.

---

## Athlytic 이 하는 것

### 화면 구성
`Today` (회복·부하·수면 대시보드) · `Workouts`(진행도/기록) ·
`Trends`(주간 분석·심박 회복·체력 추이) · `Health`(5지표 + Athlytic Age) ·
`Sleep`(단계·회복력·수면 부채) · `More`

### 핵심 지표
| 지표 | 정의 |
|---|---|
| **Recovery** | HRV 를 **본인 60일 기준선**과 비교 + 안정시심박. 오늘 훈련 준비도 |
| **Exertion / Effort** | 24시간 심혈관 부하. **Target Exertion** = 회복 상태에 따른 권장 범위 |
| **Training Load** | 강도·빈도 누적, **급성/만성 비(ACWR)** 포함 |
| **Readiness** | 아침 심장 스트레스 + 운동 능력 |
| Athlytic Age | 습관·훈련이 노화 속도에 미치는 영향 |

### 입력
자동 — HRV · 안정시심박 · 혈중산소 · 호흡수 · **손목 온도** · 수면 단계 · 운동
수동 — **Journal 태그 40종+**(음주·카페인·항생제·불안·사우나·GLP-1 등) · 체중 · 식사 · 생리주기
연동 — Strava · Garmin · Wahoo · Peloton

### 알림·제안
아침 Daily Report · Target Exertion 하한 도달/상한 초과 알림 ·
비정상 생체지표 경고 · **회복 기반 운동 추천**(강도·시간 조절 가능) ·
Training Load Ratio 경고

### 가격
무료 = 기본 Recovery/Exertion + 컴플리케이션 5종
**Pro $29.99/년 (또는 $4.99/월)** = 전체 Trends · 위젯 11종 · Journal Insights(AI) ·
심화 수면 분석(부채·일관성·잠들기까지) · 심화 Training Load · Athlytic Age

---

## 🔴 우리와 대조 — 놀랍게도 엔진은 이미 있다

| | 우리 | Athlytic |
|---|---|---|
| CTL / ATL / TSB | ✅ Coggan PMC 구현 | ✅ |
| ACWR | ✅ Gabbett (21일 미만 산출 금지, §457) | ✅ |
| 심박 존 | ✅ (%HRmax, 실측 최대심박 필요) | ✅ |
| 운동 기록·RPE | ✅ | ✅ |
| 회복 판정 → 오늘의 제안 | ✅ 4-zone (full/moderate/active_recovery/rest) | ✅ |
| **HRV 편차** | 🔴 **설계만. `computeHRVTrend` 는 존재하지 않는다** | ✅ 핵심 지표 |
| **Hooper 주관 웰니스** | 🔴 **설계만. `computeWellnessTrend` 없음** | ✅ Journal 태그 |
| 수면 | ❌ | ✅ 단계·부채·일관성 |
| 안정시심박 추세 | ❌ (현재값만 입력받음) | ✅ |
| 저널·태그 | ❌ | ✅ 40종+ |
| 운동 후 심박 회복(HRR) | ❌ | ✅ |

### 결정적 발견
`coach.js:1329` 의 `decideRecoveryAction(state)` 는 이렇게 받도록 짜여 있다:
```
tsb              ← storage.computeFitnessTrend   ✅ 넘긴다
acwr             ← storage.computeACWR           ✅ 넘긴다
hrvDeviationSD   ← storage.computeHRVTrend       🔴 함수 자체가 없다
hooperComposite  ← storage.computeWellnessTrend  🔴 함수 자체가 없다
daysSinceRest    ← storage 누적                  🔴 안 넘긴다
```
그리고 `v2-app.js:1428` 은 **tsb 와 acwr 둘만** 넘긴다.
판정 로직(red≥2→rest 등)은 4인자를 세도록 돼 있는데 **둘로만 세고 있다.**
→ **§498(AWS)·§482(포일)·§511(경계)과 같은 종류.** 값이 없어서가 아니라
   **읽고 넘기는 쪽이 없어서** 기능이 절반만 돈다.

---

## 가져올 것 (우선순위)

| | 항목 | 왜 |
|---|---|---|
| **A1** | **`daysSinceRest` 배선** | 이미 원장에 있는 데이터다. 함수도 받게 돼 있다. **오늘 바로 됨** |
| **A2** | **Hooper 주관 웰니스 입력** (피로·스트레스·근육통·수면질 4항목 5점) | 센서 없이 **입력칸 4개**면 된다. 판정이 2인자 → 3인자가 된다. Athlytic 의 Journal 보다 훨씬 가볍고 스포츠과학 표준 |
| **A3** | **안정시심박 추세** | 지금은 프로필에 고정값 하나. **세션마다 기록**하면 추세가 생기고, HRV 없이도 회복 신호가 된다 |
| B1 | HRV 편차 (Plews 2013, ln rMSSD 7일 이동평균 vs 개인 기준선) | 🔴 **HRV 원천이 없다.** Apple Watch·Movesense 연동이 선행 |
| B2 | 운동 후 심박 회복(HRR) — 1분 후 심박 하강폭 | 우리 세션 데이터로 **계산 가능**. 회전 후 회복과 별개로 세션 종료 후 |
| B3 | Target Exertion 밴드 | 우리 '오늘의 제안' 에 **목표 심박**은 있으나 상·하한 밴드는 없다 |
| C1 | 수면 | 원천 없음. 웨어러블 연동 선행 |
| C2 | Athlytic Age 류 종합 점수 | 재미 요소. 근거가 얇아 후순위 |

## 가져오지 말 것
 · **Athlytic Age** — 근거가 불투명한 단일 숫자. 우리 SPS 도 이미 그 위험을 안고 있다
 · 40종 태그 — 대부분 윙포일과 무관. **Hooper 4항목이 같은 일을 더 정확히** 한다
 · Instagram Share Card — 우리 범위 밖

---

## ⚠ 우리가 더 나은 점 (지키기)
 · **ACWR 21일 미만 산출 금지**(§457) — 5일치에서 4.00 이 튀어 오경고가 났던 걸 막았다.
   Athlytic 이 이 가드를 두는지는 확인 못 했다
 · **최대심박 실측 요구** — 비워 두면 관측 최대를 쓰는데 그러면 존이 통째로
   위로 밀린다고 화면이 경고한다(실측 174 vs 194 에서 Z5 가 54.5% ↔ 0%)
 · 판정 근거를 **자연어로** 설명한다(primary_reason · contributing_factors)

## 출처
- [Athlytic App Store](https://apps.apple.com/us/app/athlytic-fitness-recovery/id1543571755)
- [Athlytic 공식](https://www.athlyticapp.com/getting-started)
- [90일 사용 리뷰](https://fitnesstoolsreviewed.com/app-reviews/athlytic-review-the-unfiltered-truth-after-90-days/)
- [기능·가격 비교](https://www.corahealth.app/compare/athlytic)
- 우리 쪽 근거: `riding-dashboard/js/coach.js:1325-1450` · `js/v2-app.js:1418-1435` · `js/storage.js:908,978`
