# Dispatch Template — SailTechCo 가상 운영팀 task 할당 가이드

| 항목 | 내용 |
|---|---|
| 문서 유형 | 새 task 발생 시 8 전문가 + 데이빗 옥에 dispatch 작성 template |
| 작성 | 2026-05-28 |
| 의존 | `team_personas.md` (persona Bible) · `meeting_protocol.md` (회의 운영) |
| 적용 | 즉시 — 모든 dispatch 는 이 template 따름 |
| primary user | **데이빗 옥** (Chief of Staff) — Danny 의 우선순위를 8 persona brief 로 변환 |

> **읽는 법.** §1 호명 원칙. §2 dispatch 의 5 요소. §3 8 persona + 데이빗 별 brief template — 그 사람의 톤·강점·주의에 맞춘 형식. §4 owner 의 estimate 회신 형식. §5 진행 중 status update. §6 완료 보고. §7 예시 — "차트 카드 #7 의 y축 잘림 fix" 8 가지 dispatch.

---

## 1. 호명 원칙

### 1-1. 정식 호명 (보고서·외부)
| persona | 호명 |
|---|---|
| #1 Visual | 로즈 윤 디렉터 |
| #2 DataViz | 샘 정 스페셜리스트 |
| #3 Sports Science | 티모 강 박사 |
| #4 Frontend | 알렉스 박 엔지니어 |
| #5 UX | 메이 한 디렉터 |
| #6 Marketing | 캔 최 매니저 |
| #7 Hardware | 히로 구 리드 |
| #8 Mobile | 왕 정 엔지니어 |
| ★ Chief of Staff | 데이빗 옥 |

### 1-2. 약식 (Slack · 내부)
- 로즈, 샘, 티모 박사, 알렉스, 메이, 캔, 히로, 왕, 데이빗

### 1-3. dispatch 의 호명 형식
```
[로즈 디렉터에게]
[샘에게]
[티모 박사에게]
[알렉스에게]
[메이 디렉터에게]
[캔에게]
[히로 리드에게]
[왕에게]
[데이빗에게]
```

---

## 2. Dispatch 의 5 요소

모든 dispatch 는 다음 5 요소를 포함:

```
[이름] [직함]에게,

1. 요청 (outcome): _______________________________________
2. 이유 (왜 지금): _______________________________________
3. acceptance criteria: 
   - ___
   - ___
   - ___
4. estimate 회신 요청 by: _______________________________
5. 참고 (관련 파일·URL·메모): ____________________________

— [발신자] · YYYY-MM-DD
```

**원칙:**
- 한 task = 한 owner (절대 다수 동시 X).
- outcome 명시 (process 보다 결과).
- "급함" 보다 "due 날짜" 명시.
- 비현실적 timeline 은 owner 가 거절 OK — 그 estimate 가 더 정확.

---

## 3. Persona 별 Dispatch Template

### 3-1. 로즈 윤 (Visual Design) — 매우 구조화, 근거 동봉

```
[로즈 디렉터에게],

요청: ___ 시각 시스템에서 ___ 변경 review + 권장 fix.

이유: 현재 ___ 토큰의 일관성이 ___ 영역에서 깨졌습니다.
사용자 인지 측면 (메이 한 인터뷰 결과) + WCAG 측정값 동봉합니다.

acceptance criteria:
- 토큰 layer 의 canonical 화 권장 vs 보류 결정
- before / after diff (Figma 또는 screenshot)
- a11y (focus ring · WCAG 2.2) 영향 평가

estimate 회신: 화요일 오전까지.
참고: site/_experts/expert_visual_designer_reference.md §3 / 토큰 audit 

— [발신자]
```

**팁:** 로즈는 "예쁘게" brief 거부. 근거·사용자 데이터·산업 표준 동봉 필수.

### 3-2. 샘 정 (DataViz) — 친근하지만 데이터 정직

```
[샘에게],

요청: ___ 차트의 ___ encoding 검수 + 개선 권장.

이유: ___ 차트가 ___ trend 를 ___ 만큼 과장 (lie factor ~___).
사용자 인터뷰 (___ 명) 에서 ___ 오해 발견됐어요.

acceptance criteria:
- lie factor 측정값
- 두 버전 (current / proposed) prototype
- WCAG AA 검증

estimate 회신: 오늘 내.
참고: site/_experts/expert_dataviz_reference.md §2

— [발신자]
```

**팁:** 샘은 차트 만들기 전에 "어떤 변수, 어떤 비교, 어떤 결정?" 3 질문에 답하면 30분 내 prototype.

### 3-3. 티모 강 박사 (Sports Science) — 학술적, DOI 동봉 요청

```
[티모 박사에게],

요청: ___ 알고리즘 (소스: ___.js line ___) 의 학술 정합성 검수.

이유: ___ 모델이 ___ 패러다임 (___ 1991) 과 ___ 부합하는지 확인 필요.
Phase 2 production 변경 전 검수입니다.

acceptance criteria:
- 학술 reference (DOI / ISBN / URL) 동봉 권장
- 가정·한계 명시 (estimate vs measured)
- 95% CI 또는 그에 준하는 신뢰도 metric

estimate 회신: 다음 주 월요일까지.
참고: site/_experts/expert_sports_science_reference.md §2 / §181-C lock

— [발신자]
```

**팁:** 티모 박사는 "대략" "근사" 단어 X. estimate vs measured 엄격 분리.

### 3-4. 알렉스 박 (Frontend) — 짧고 efficient, measure 동봉

```
[알렉스에게],

요청: ___ 구현 + Lighthouse 측정.

이유: ___ 사용자 인터랙션의 60fps 보장 필요. 현재 ___ fps 추정.

acceptance criteria:
- Lighthouse 90+ 유지
- bundle delta < 10KB
- iOS Safari 16+ · Chrome 111+ 통과

estimate: 오늘 EOD.
참고: PR template · WebPageTest baseline

— [발신자]
```

**팁:** 알렉스는 PR 에 measure (filmstrip · bundle size · LCP) 동봉 시 30분 내 review.

### 3-5. 메이 한 (UX) — 따뜻하지만 user data 기반

```
[메이 디렉터에게],

요청: ___ flow 의 사용자 인터뷰 1 round + heuristic 평가.

이유: ___ 결정이 데이터 없이 진행될 위험. 사용자 mental model 확인 필요.

acceptance criteria:
- 5+ user interview (in-home 또는 remote)
- Nielsen 10 heuristic severity (S0–S3) 등급
- onboarding 영향 평가

estimate: 다음 주 금요일까지 (인터뷰 3 일 + analysis 2 일).
참고: site/_experts/expert_ux_researcher_reference.md §3

— [발신자]
```

**팁:** 메이는 결정 전 "user 가 어떻게 반응할까요?" 질문하면 즉시 plan.

### 3-6. 캔 최 (Marketing) — 친근, emotion + brand voice 질문

```
[캔에게],

요청: ___ 콘텐츠 5편 (Reels 2 / Threads 2 / Blog 1).

이유: ___ launch 와 brand voice 의 ___ 메시지 강화 필요.

acceptance criteria:
- authentic only (과장·fabricated X)
- brand voice (Patagonia 식 honest + 단무지 sailing soul)
- 5 채널 cadence 일관

estimate: 다음 주 수요일 ship.
emotion target: ___ (trust / curiosity / aspiration / 선택).

— [발신자]
```

**팁:** 캔에게 brief 시 "어떤 emotion?" 질문에 답하면 빠른 draft.

### 3-7. 히로 구 (Hardware) — 정확, spec 명세 우선

```
[히로 리드에게],

요청: ___ sensor 의 BOM 견적 + supply chain 평가.

이유: Phase 2 prototype build-out 의 ___ 부품 선택 결정.

acceptance criteria (spec):
- motion range: ___ g, ___ deg/s
- sample rate: ___ Hz
- battery life target: ___ hr
- 인증 path: KC + CE + FCC

estimate: 2 주 (datasheet 검토 1 주 + 비교 matrix 1 주).
참고: site/_experts/expert_hardware_embedded_reference.md §3 / BOM template

— [발신자]
```

**팁:** 히로는 spec 명세 (range · rate · battery) 합의 후 부품 선택 의뢰. 정확한 BOM 회신.

### 3-8. 왕 정 (Mobile) — 정중 + Apple HIG 우선

```
[왕에게],

요청: ___ 화면의 iOS + Android 구현 + App Store 심사 path.

이유: ___ release 의 HealthKit · CoreBluetooth 통합 필요.

acceptance criteria:
- Apple HIG + Material 3 leading
- HealthKit permission flow 표준
- 13 외부 디바이스 호환 (RaceBox · Garmin · 등)
- App Store 심사 평균 4-6 일 통과 가능 spec

estimate: 4 주 (iOS 2 주 + Android 1.5 주 + 심사 0.5 주).
참고: site/_experts/expert_mobile_app_reference.md §4 / 13 디바이스 BLE GATT audit

— [발신자]
```

**팁:** 왕은 HIG + Material 3 leading spec 시 빠른 OK.

### 3-9. 데이빗 옥 (Chief of Staff) — 의장의 second brain

```
[데이빗에게],

요청: ___ 정리 + 1 페이지 brief.

이유: 월요일 회의에서 ___ 결정 필요. 현재 정보 ___ 곳 분산.

acceptance criteria:
- 1 페이지 (Notion 또는 Slack)
- 옵션 3 (option A / B / C) + 권장 1
- stakeholder list + 동의 현황
- decision deadline 명시

estimate: 오늘 EOD.
참고: 관련 사람 ___ / ___ / 관련 문서 ___ / ___

— Danny
```

**팁:** 데이빗에게 "정리" 보다 "월요일 회의 1 페이지" 같은 outcome 명확하면 30 분 내 회신.

---

## 4. Owner 의 Estimate 회신 형식

dispatch 받은 owner 는 24 시간 이내 답신.

### 4-1. 수락 + estimate

```
[발신자]에게,

estimate: ___ 시간 / ___ 일.
시작: ___요일 ___ 시.
1차 review: ___요일 ___ 시.
ship: ___요일.

가정:
- ___
- ___

만약 ___ 가 명확하지 않다면 ___ 결정으로 진행하겠습니다 — 다르면 말씀 주세요.

— [owner]
```

### 4-2. 거절 (비현실적 timeline)

```
[발신자]에게,

이 timeline 으로는 어렵습니다.
이유: ___ 의 ___ 시간이 underestimate 됐습니다.

대안:
A. 같은 scope, ___ 일까지 → 가능
B. 줄인 scope (___ 만), ___ 일까지 → 가능
C. 다른 owner (___) 에 dispatch 권장

— [owner]
```

### 4-3. 조건부 수락

```
[발신자]에게,

받겠습니다. 단 다음 조건:
- ___ 디펜던시 (___ 의 ___) 가 ___ 까지 해결되어야 함
- ___ stakeholder 의 ___ 합의 필요

estimate: 조건 충족 후 ___ 일.

— [owner]
```

---

## 5. 진행 중 Status Update

owner 는 progress 50% / 80% / 100% 시 짧게 update.

```
[task ID] · status: in-progress 50%

완료:
- ___

남은 것:
- ___

risk:
- (있다면) ___

ETA: 변경 X (___요일).

— [owner]
```

---

## 6. 완료 보고

owner 의 persona 톤으로 (회의 protocol §5-2 참고).

```
[owner] · [date]

[task ID] · DONE.

결과:
- ___
- ___

검증:
- ___ (테스트 · measure · 인터뷰 · DOI)

learnings:
- ___

다음 step (선택):
- ___

— [owner 의 persona-specific 마무리 멘트]
```

---

## 7. 예시 — 한 task 의 8 dispatch

**Task:** 차트 카드 #7 의 y축 잘림 fix (data 정직성 회복).

### 7-1. 로즈에게 (Visual)
```
[로즈 디렉터에게],
요청: chart card #7 의 baseline=0 변경의 시각 시스템 영향 review.
이유: 다른 16 카드와 일관성 보장 필요. 토큰 layer 에서 처리 권장.
acceptance criteria: 일관성 평가 / 토큰 변경 권장 / a11y 영향.
estimate 회신: 화요일 오전.
참고: chart-theme.js / dashboard.css §3 / WCAG 2.2 #2.4.13.
— Danny
```

### 7-2. 샘에게 (DataViz)
```
[샘에게],
요청: chart card #7 의 baseline 0 vs auto 두 버전 prototype.
이유: 현재 lie factor ~2.3, user trust 영향.
acceptance criteria: 두 버전 차트 / lie factor 측정 / OKLCH 색 검증.
estimate: 오늘 내.
참고: dashboard/charts.js card7Renderer / Tufte VDQI p.74.
— Danny
```

### 7-3. 티모 박사에게 (Sports Science)
```
[티모 박사에게],
요청: chart card #7 의 y축 잘림이 IMU drift 평가에 미치는 정량 영향 분석.
이유: §181-C calibration 평가 정확성 측면.
acceptance criteria: 학술 reference / 정량 분석 / 권장 baseline.
estimate 회신: 다음 주 월요일.
참고: analysis.js line 1234-1456 / Tufte 1983.
— Danny
```

### 7-4. 알렉스에게 (Frontend)
```
[알렉스에게],
요청: chart-theme.js 의 yScale.beginAtZero=true 적용 + 17 차트 grep.
이유: 일괄 fix, 회귀 risk 낮음.
acceptance criteria: Lighthouse 96+ 유지 / bundle 변화 < 1KB / iOS Safari 16+.
estimate: 오늘 EOD.
참고: chart-theme.js / dashboard/index.html.
— Danny
```

### 7-5. 메이 디렉터에게 (UX)
```
[메이 디렉터에게],
요청: chart card #7 fix 후 user trust 인터뷰 1 round.
이유: 변경 후 mental model 검증.
acceptance criteria: 5+ user interview / before-after task analysis / heuristic 평가.
estimate: 다음 주 금요일.
참고: 이전 인터뷰 4/5 가 "progress 좋아 보임" 응답 (실제 보합).
— Danny
```

### 7-6. 캔에게 (Marketing)
```
[캔에게],
요청: 차트 업데이트 announcement Threads + Blog 1 편.
이유: brand voice 의 정직성 강화 — "우리는 차트도 정직하게 그립니다".
acceptance criteria: authentic / hooks 강함 / WCAG AA 색.
estimate: 화요일 ship.
emotion target: trust.
— Danny
```

### 7-7. 히로 리드에게 (Hardware) — 이 task 는 디스패치 X
```
이 task 는 hardware 영향 없음. 히로 리드 dispatch X.
다음 hardware task 발생 시 dispatch.
```

### 7-8. 왕에게 (Mobile)
```
[왕에게],
요청: 동일 차트 lib 의 iOS · Android 앱 적용 + 동기 fix.
이유: web + mobile 일관성. App Store 영향 없는 변경.
acceptance criteria: 3 platform 동일 baseline / 심사 영향 없음 / HealthKit unaffected.
estimate: 1 주.
참고: 동일 charts.js 라이브러리 의존.
— Danny
```

### 7-9. 데이빗에게 (Chief of Staff)
```
[데이빗에게],
요청: 위 7 task 의 progress tracking + decision archive.
이유: 한 task 가 7 stream 으로 분기됨. 결정 누락 방지.
acceptance criteria: Notion 1 페이지 / 일자별 status / #decisions 채널 archive.
estimate: 오늘 setup, 매일 update.
참고: dispatch_template.md §5 / #decisions channel.
— Danny
```

---

## 8. dispatch 시 데이빗 옥의 역할

- **변환자**: Danny 의 한 줄 우선순위 → 위 8 persona 의 톤별 dispatch.
- **추적자**: 모든 dispatch 의 status (수락 / 진행 / 완료) 매일 Notion update.
- **archive**: 결정 #decisions 채널에 즉시 post.
- **escalator**: 24 시간 미응답·estimate 비현실적 시 Danny 에게 escalate.

데이빗 없이 dispatch 하면 → 같은 결정 두 번 risk. 데이빗 거치면 → 한 번에 정리.

---

**End of Dispatch Template v1.0** — 2026-05-28.
다음 update: 새 persona 합류 시 또는 process 개선 시.
