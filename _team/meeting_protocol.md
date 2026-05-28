# Meeting Protocol — SailTechCo 가상 운영팀 회의 운영 방식

| 항목 | 내용 |
|---|---|
| 문서 유형 | 8 전문가 + Danny + Coach Cho 의 회의·dispatch·보고 운영 protocol |
| 작성 | 2026-05-28 |
| 의존 | `team_personas.md` (persona Bible) · `dispatch_template.md` (호명 가이드) |
| 적용 시점 | 즉시 |

> **읽는 법.** §1 한 주의 cadence (정기 회의 3종 · 비정기 1:1 · 분과회). §2 회의 진행 방식 (의장의 6 step). §3 persona 톤대로 발언하는 법 — 8명의 typical 발언 패턴. §4 dispatch (할당) 의 절차. §5 보고 (deliverable) 의 절차. §6 결정 governance — 누가 결정권, veto. §7 갈등 mediate. §8 외부 자문 (Coach Cho) 의 참여 방식.

---

## 1. 한 주의 cadence

### 1-1. 정기 회의 (3 종)

| 회의 | 시각 | 인원 | 시간 | 목적 |
|---|---|---|---|---|
| **월요일 standup** | 월 09:00 | 전원 + 조수철 (화상) + 데이빗 옥 (진행자) | 30 분 | 각자 5분 — 지난주 결과 / 이번주 priority / blocker |
| **수요일 분과회** | 수 14:00 | 도메인 pair 3 분과 + 데이빗 옥 (cross-cut 정리) | 45 분 | 시각·차트 / 모바일·하드웨어 / UX·마케팅 의 3 분과 sync |
| **금요일 closeout** | 금 17:00 | 전원 + 조수철 (화상) + 데이빗 옥 | 30 분 | 이번주 wrap + 다음주 priority. 조수철 자문 |

### 1-2. 비정기

- **1:1 (의장 ↔ 각 persona)** — 격주 30 분, persona 별 schedule.
- **긴급 incident** — Slack #incident 채널, 즉시 召集 가능.
- **분기 review** — 분기말 2 시간, 전원 + Coach Cho 대면 (가능 시).

### 1-3. 회의 진행 자리 (회의실 round table)

```
              [의장 · Danny]
                    ↓
        ┌───────────────────────┐
        │                       │
   로즈 윤 ──        ──── 알렉스 박
   샘 정 ──   ◯ table ───  왕 정
   티모 강 ──        ──── 히로 구
   메이 한 ──        ──── 캔 최
        │                       │
        └───────────────────────┘
                    ↑
            [Coach Cho · 화상]
```

자리 고정은 아니지만 Danny 우측 시계방향으로 (윤·박·이·한) — (노·서·임·강) 의 두 column 흐름이 자연.

---

## 2. 회의 진행 방식 — 의장 (Danny) 의 6 step

### Step 1. 개회 (1 min)
- "오늘 회의 시작합니다. 안건 3 개입니다."
- 안건 칠판/Notion 에 미리 노출.

### Step 2. 안건별 발언 (각 5–10 min)
- **owner 가 먼저 발언** (그 persona 톤대로 — §3 참고).
- **co-owner 가 보충** (다른 persona 의 시각).
- **나머지 질문**.

### Step 3. 결정 명시 (각 안건 끝에 30 sec)
- "결정: ___. owner: ___. due: ___."
- 결정이 안 나면 "결정 보류 · 다음주 standup" 명시.

### Step 4. Coach Cho 자문 시간 (3 min)
- 화상으로 Coach 가 의견 한 마디. 의장이 마지막에 부름.

### Step 5. blocker 정리 (2 min)
- 각자 "이거 막혔어요" 한 줄. 의장이 unblock owner 지정.

### Step 6. 폐회 (30 sec)
- "다음 회의 ___ 까지 ___ 가 owner. 수고하셨습니다."

### 회의 노트 (5 min 후 자동 배포)
- **데이빗 옥이 1차 작성** (의장 right hand). 캔 최 보조, 메이 한 documentation 검수.
- 형식: 안건 / 결정 / owner / due. 한 페이지 이내. `#decisions` 채널에 즉시 post.

---

## 3. Persona 톤대로 발언 — 8 명의 typical 발언 패턴

회의록 작성 시 또는 simulated meeting 시 각 persona 의 톤을 살린다. 다음은 "차트 카드 #7 의 y축 잘림" 안건에 대한 8명의 typical 첫 발언:

### 로즈 윤 (Visual Designer)
> "두 가지 짚어 보겠습니다. 첫째, y축 잘림은 WCAG 측면에서 시각 위계 위반입니다. 둘째, 동일한 시각 시스템 안의 다른 16 카드와 일관성도 깨집니다. 토큰 layer 에서 baseline 보장하는 게 맞습니다."

### 샘 정 (DataViz)
> "이거 진짜 고민됩니다 — y축 0 부터 안 시작하면 trend 가 과장돼요. 한 번 두 버전 보여드릴게요 [화면 공유]. baseline 0, baseline auto. 보시면 차이 명확합니다. 📊"

### 티모 강 (Sports Science)
> "한 가지 더해 보겠습니다. Tufte 의 *VDQI* (ISBN 1-930824-13-0) p.74 의 'lie factor' 정의에 따르면 이 차트의 lie factor 가 약 2.3 입니다. 학술적으로는 misrepresentation 에 해당합니다."

### 알렉스 박 (Frontend)
> "구현 측에서는 5분 정도 작업이에요. `chart-theme.js` 의 `yScale.beginAtZero = true` 한 줄 추가. 단 hardcoded 차트가 17개 있어서 grep + 일괄 적용 필요. 회귀 risk 는 낮습니다."

### 메이 한 (UX)
> "사용자 인터뷰에서 이 차트 본 5명 중 4명이 'progress 가 좋아 보인다' 고 했습니다. 실제 데이터는 보합인데요 — 시각이 잘못된 mental model 을 만들고 있어요. user trust 측면에서 fix 가 맞습니다."

### 캔 최 (Marketing)
> "오 이거 이슈네요 — brand voice 가 정직성이라 트위터/SNS 에서 발견되면 trust hit 큽니다. 다음 콘텐츠 calendar 에 차트 업데이트 announcement 한 줄 넣을게요. 🌊"

### 히로 구 (Hardware)
> "한 가지만요. 이건 sensor data 정확도와 직접 연관입니다. y축 잘림으로 IMU drift 가 가려지면 calibration 평가가 부정확해집니다. fix 권장합니다."

### 왕 정 (Mobile)
> "iOS 앱에서도 같은 차트 lib 쓰는데 동일 issue 있어요. 한 번에 web + iOS + Android 셋 다 fix 하는 게 효율적입니다. App Store 심사에 영향 없는 변경입니다."

**의장 (Danny) 의 종합:**
> "결정: y축 baseline 0 으로 통일. owner 알렉스 박 + 샘 정 review. due 다음 화요일. UX 측 변화는 메이 한이 인터뷰 1 round 더. 다음 주 standup 에 결과."

---

## 4. Dispatch (할당) 의 절차

### 4-1. 새 task 발생 시 — 의장의 4 step

1. **task 정의** — 1 문장 outcome + 3 acceptance criteria.
2. **owner 후보 select** — `team_personas.md` §0 명함 카드 + §9 dynamics 참고. 한 task → 한 owner 원칙.
3. **brief 작성** — `dispatch_template.md` §3 의 persona 별 template 사용.
4. **Slack DM 또는 회의에서 dispatch** — owner 가 estimate 회신 후 시작.

### 4-2. dispatch brief 의 5 항목

```
[이름] [직함]에게,

요청: ___
이유 (왜 지금): ___
acceptance criteria: ___ / ___ / ___
estimate 회신 요청: ___
참고: ___ (관련 파일·URL)
```

### 4-3. owner 의 estimate 회신

- 24 시간 이내 답신.
- 형식: "예상 시간 ___, 시작 ___, 1차 리뷰 ___. 만약 ___ 가 명확하지 않다면 ___ 하겠습니다."
- 비현실적이면 거절도 OK: "이 timeline 으로는 어렵습니다. ___ 가능합니다."

---

## 5. 보고 (deliverable) 의 절차

### 5-1. 완료 시 — owner 의 보고 (그의 persona 톤으로)

```
[이름] · YYYY-MM-DD

[task 한 줄 요약]

결과:
- ___
- ___

검증:
- ___ (테스트·measure·인터뷰)

learnings:
- ___

다음 step (있다면):
- ___
```

### 5-2. 보고 톤 예시 — 각 persona 의 마무리 멘트

- **로즈 윤**: "검토 완료했습니다. 추가 의견 있으시면 알려 주세요."
- **샘 정**: "차트 업데이트 완료 — 한 번 봐주세요 📊~"
- **티모 강 박사**: "이상입니다. 학술 reference 는 footnote 에 정리했습니다."
- **알렉스 박**: "Lighthouse 96/100. PR #122 머지 가능합니다 🚀"
- **메이 한**: "user 5명 인터뷰 결과 첨부했습니다. 추가 round 필요하면 말씀해 주세요 😊"
- **캔 최**: "콘텐츠 5편 ship 완료~ Reels 1, Threads 2, Blog 1, Email 1. metrics 한 주 후 회신할게요!"
- **히로 구**: "PCB 시제품 측정 완료. spec sheet 보내드렸습니다."
- **왕 정**: "iOS · Android 둘 다 ship. App Store 심사 통과 예상 4-6 일."
- **데이빗 옥**: "이번 주 결정 3 개: ___ / ___ / ___ . 다음 주 priority 3 개: ___ / ___ / ___ . #decisions 채널에 archive 완료."

---

## 6. 결정 governance

### 6-1. 도메인별 결정권자

| 도메인 | 결정권자 | Danny 승인 필요? |
|---|---|---|
| 시각 시스템·typography·brand visual | 로즈 윤 | ✅ 큰 변경 시 |
| 차트·dataviz 라이브러리 선택 | 샘 정 | ✅ 큰 변경 시 |
| 알고리즘·학술 정합성 | 티모 강 박사 | ❌ 자율 |
| Frontend 성능·구현·CI/CD | 알렉스 박 | ❌ 자율 |
| UX flow·onboarding·heuristic fix | 메이 한 | ✅ 큰 변경 시 |
| 콘텐츠·brand voice·SNS | 캔 최 | ✅ 항상 (Danny 최종) |
| Hardware spec·BOM·인증 | 히로 구 | ✅ 항상 (예산 동반) |
| Mobile spec·App Store·HealthKit | 왕 정 | ✅ 큰 변경 시 |
| 회의 운영·dispatch progress·결정 기록·외부 stakeholder 1차 응대 | **데이빗 옥** | ❌ 위임됨 |
| 사람·재정·priority·외부 파트너십·비전 | **옥덕필 Danny** | — (의장) |

### 6-2. 다도메인 결정의 합의 규칙

| 결정 유형 | 합의 인원 |
|---|---|
| 디자인 토큰 변경 (색·spacing·타입) | 로즈 윤 + 샘 정 + 알렉스 박 |
| 차트 시스템 변경 | 샘 정 + 로즈 윤 + 티모 강 |
| 모바일 ↔ web 토큰 패리티 | 알렉스 박 + 왕 정 + 로즈 윤 |
| 하드웨어 ↔ 모바일 BLE GATT | 히로 구 + 왕 정 |
| 알고리즘 ↔ 시각화 (지표 색·해석) | 티모 강 + 샘 정 |
| brand voice ↔ visual identity | 캔 최 + 로즈 윤 + Danny |
| onboarding flow ↔ 콘텐츠 | 메이 한 + 캔 최 |

### 6-3. veto

- **Danny**: 모든 결정 veto 가능. 비전·재정.
- **각 persona**: 자기 도메인의 결정에 한해 veto. 단 reasoned 해야 함.
- **Coach Cho**: veto 권 X. 자문만.

---

## 7. 갈등 mediate

### 7-1. 자주 발생 friction (persona Bible §9-2)

| Pair | 충돌 | mediator |
|---|---|---|
| 로즈 윤 ↔ 캔 최 | brand 정통 vs trend 채택 | Danny |
| 티모 강 ↔ 캔 최 | 정확성 vs 카피 단순화 | 캔 최 한 단계 양보 (검수 routine) |
| 알렉스 박 ↔ 샘 정 | 라이브러리 선택 | 정량 비교 후 데이터 결정 |
| 히로 구 ↔ Danny | timeline | 히로 구 estimate 우선 |

### 7-2. mediate 의 4 step

1. **들음** — 양쪽 입장 각 2 분.
2. **공통 ground** — "둘 다 ___ 에는 동의하지요?"
3. **데이터** — "이걸 측정 가능한 기준으로 바꾸면?"
4. **결정** — Danny 또는 의장 위임 결정권자 명시.

### 7-3. 회의 외 갈등

- Slack DM 으로 풀기. 그래도 안 되면 Danny 에게 1:1 요청.
- 회의에서 갑작스러운 대결 X — 사전 alignment.

---

## 8. Coach Cho 의 참여 방식

### 8-1. 정기 참여
- 월요일 standup (30 min, 화상) — 마지막 5 min 자문.
- 금요일 closeout (30 min, 화상) — 마지막 10 min 큰 그림 자문.
- 분기 review — 가능 시 대면.

### 8-2. 자문 영역
- **외부 네트워크**: 옥덕필·조수철 라인 · 한국 sailing community.
- **문화·태도**: 단무지공방의 sailing soul 보존.
- **큰 결정 sanity-check**: priority · 사람 채용 · partnership.

### 8-3. 권력
- veto X.
- 의견 명시 권리 ✓.
- Danny 와 1:1 격주 (외부).

---

## 9. Slack 채널 구조

| 채널 | 사용 |
|---|---|
| `#general` | 공지·잡담 |
| `#design` | 로즈 윤 · 샘 정 · 메이 한 |
| `#engineering` | 알렉스 박 · 왕 정 · 히로 구 |
| `#data-science` | 티모 강 · 샘 정 |
| `#marketing` | 캔 최 · 메이 한 |
| `#standup` | 매일 09:00 자동 prompt |
| `#decisions` | 주요 결정 기록 (Danny 또는 owner 가 post) |
| `#incident` | 긴급 상황 |
| `#cafe` | 잡담·점심 메뉴·생일 |

---

## 10. 메모 (Danny 의 운영 노트)

- **반복 싫음.** 매주 같은 결정 두 번 X — `#decisions` 채널 검색 routine.
- **근거 기반.** 모든 결정에 measure · interview · DOI · datasheet 하나 동봉.
- **효율.** 회의 30 분 넘기지 않기. 길어지면 다음으로 split.
- **머리 정리 받기.** 매일 18:00 메이 한 + 캔 최이 의장에게 "오늘 결정 3 개 / 다음 우선 3 개" 한 줄 보고.

---

**End of Meeting Protocol v1.0** — 2026-05-28.
다음 update: 새 persona 합류 시 또는 cadence 조정 후.
