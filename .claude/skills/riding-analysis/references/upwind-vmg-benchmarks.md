# 풍상 VMG 실측 벤치마크 (§483)

옥대표 2026-09-01: "바람이 아무리 세다고 해도 VMG가 14노트 이상 나오는걸
윙포일에서는 거의 못본것 같애. 프로선수라도."

찾아본 결과 **맞다**. 우리 모델이 틀렸다. 이 문서는 다시 이 논쟁이 생길 때
근거로 쓸 실측 숫자를 모아 둔 것이다.

## 실측 기준선

| 클래스 | 풍속 | 풍상 VMG | 배 속도 | 풍상 TWA | VMG/풍속 | 출처 |
|---|---|---|---|---|---|---|
| **Formula Kite** 상위(T1) | 11–15 kt | **12.2 ± 1.4 kt** | 19.2 ± 1.2 | ~50° | ~0.94 | 동료심사 GPS 연구 |
| Formula Kite 중위(T2) | 11–15 kt | 11.2 ± 1.4 | 18.3 ± 1.1 | ~52° | ~0.86 | 같은 연구 |
| Formula Kite 하위(T3) | 11–15 kt | 9.3 ± 1.5 | 16.1 ± 1.8 | ~54° | ~0.72 | 같은 연구 |
| Moth | (미상) | 공표값 없음 | 15–20 kt | 40–45° | — | North Sails 가이드 |
| AC75 | 6.5–23 kt | ~19–29 (40° 가정 환산) | 25–38 kt | ~40° | — | Sailing World |
| **옥대표 8/31** | 10–14 kt | **9.3 kt** (20초창 p95) | 17.7 | 58° | ~0.77 | 본인 GPS |
| 옥대표 8/31 | 10–14 kt | 7.8 (상위 50%) | — | — | ~0.65 | 본인 GPS |

가장 중요한 한 줄: **올림픽 Formula Kite 최상위 선수가 11–15노트에서
풍상 VMG 12.2노트.** Formula Kite 는 현존 최속 포일 클래스다. 윙포일은
그보다 느리다 — 손으로 든 윙은 레이스 카이트보다 유효 면적이 작고,
라이더 몸 자체가 큰 항력원이다.

Moth 는 공표 VMG 가 없다. 배 속도 15–20kt 에 40–45° 를 넣으면 11–15kt
범위가 나오지만 이건 환산이지 실측이 아니다. AC75 도 마찬가지로
VMG 직접 수치는 못 찾았고 배 속도만 공표돼 있다 — 다만 8명이 타는
75피트 배에 강체 윙 25㎡+ 라 윙포일 비교 대상은 아니다.

### 신뢰하면 안 되는 숫자
Nicolas Parlier(카이트포일 세계챔피언)가 KiteFoil Gold Cup 멕시코전 후
"8–10노트 바람에서 풍상 VMG 15.5노트, 풍하 23.5노트" 라고 말한 보도가
있다. VMG/풍속 = **1.7** 로, 같은 클래스 동료심사 GPS 연구(0.94)와
정면으로 어긋난다. 언론 인용이고 VMG 가 아니라 배 속도를 말했을
가능성이 크다. 근거로 쓰지 말 것.

## 우리 모델은 어디에 있나

`lift-calculator.js upwindSpeed()` — 72kg · 윙 5.5㎡ · 포일 AR 13.7:

| 풍속 | 중급 | 상급 | 선수 | 상급 VMG/풍속 |
|---|---|---|---|---|
| 10 kt | 6.6 | 9.7 | 10.5 | 0.97 |
| 12 kt | 9.7 | **13.0** | 13.9 | **1.08** |
| 14 kt | 12.3 | **15.7** | 16.9 | **1.12** |
| 16 kt | 13.4 | 17.2 | 18.5 | 1.07 |
| 18 kt | 14.5 | 18.5 | 19.8 | 1.03 |
| 22 kt | 16.1 | 20.6 | 22.1 | 0.94 |

즉 모델은 **취미 윙포일러를 올림픽 Formula Kite 최상위보다 빠르게**
놓고 있다(12kt 13.0 vs 실측 12.2). 12~16kt 구간의 VMG/풍속 1.07–1.12 는
Formula Kite 실측 0.94 를 넘는다. 물리적으로 풍상 VMG 가 풍속을 넘는
것 자체는 가능하지만(AC75 는 실제로 그렇다) 손윙이 레이스 카이트를
이길 수는 없다. **이 비율이 1을 넘는 순간이 오류 신호다.**

과대 예측 폭은 옥대표 조건에서 대략 **40~70%**.

## SPS 에 미치는 영향 (중요)

`coach.js`: `upRatio = measUpVmgKt / predUpVmgKt` — 속도 점수의 분모가
이 예측값이다. 예측이 부풀면 점수가 그만큼 깎인다.

8/31 실측 상위50% 7.8kt 기준:

| 예측 기준 | 예측 VMG | 실측/예측 |
|---|---|---|
| 12kt·중급·AR6.5 | 8.4 | 0.93 |
| 12kt·상급·AR13.7 | 13.2 | 0.59 |
| 14kt·상급·AR13.7 | 15.1 | 0.52 |
| **Formula Kite 엘리트 실측(12.2)** | 12.2 | 0.64 |

[[sps-calibration-424]] 가 점수 밴드를 60~80 으로 맞춘 방식은
`RATIO_FLOOR` 압축을 제거한 것이었다 — 즉 **깨진 예측기를 점수 쪽에서
보정한 것**이지 예측을 고친 게 아니다. 예측을 고치면 §424 를 다시
봐야 한다. 순서를 거꾸로 하면 안 된다.

## 다음에 할 일 (옥대표 결정 필요)

예측기를 고치는 게 근본이다. 후보:
1. `UPWIND_VB_CAP_KT = 35` 는 AC75 급 상한이다. 윙포일 상한은 그보다
   훨씬 낮아야 한다.
2. `ETA_BY_SKILL` · `CL_WING_MAX` · L/D 가정이 손윙에 비해 낙관적이다.
   라이더 몸 항력이 모델에 없다.
3. 검증 게이트: **풍상 VMG/풍속 이 0.95 를 넘으면 경고**. Formula Kite
   실측 상한이 그 근처다.

고치면 SPS 가 크게 움직이므로 §424 재보정과 한 묶음으로 가야 한다.

## 출처
- Pérez-Turpin J.A. 외. "Performance Analysis in Olympic Sailors of the
  Formula Kite Class Using GPS." *Int J Environ Res Public Health* (PMC7830054).
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7830054/
- North Sails, "International Moth Speed Guide."
  https://www.northsails.com/blogs/north-sails-blog/north-sails-international-moth-speed-guide
- Sailing World, "The Foiling AC75." https://www.sailingworld.com/the-foiling-ac75/
- Scuttlebutt, "Kite Racing: Increasing the Altitude" (Parlier 인용 — 신뢰 낮음).
  https://www.sailingscuttlebutt.com/2015/05/19/kite-racing-increasing-the-altitude/
