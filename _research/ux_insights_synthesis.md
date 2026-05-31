# §5. UX 인사이트 — 35 제품 audit 의 UX 패턴 종합

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 작성일 | 2026-05-28 |
| 위치 | `sailtechco_moat_proposal.md` §2.W1 + §2.W5 의 backbone — SailTechCo 의 한국어 UI + 자연어 코칭 모범 사례 |
| 출처 | 10 Tier 0 deep-dive + 35 제품 1차 audit |
| 검수 기준 | designer-handoff 가능. 모든 UX 패턴은 경쟁사 제품 직접 인용 (스크린샷·blog·App Store description) 또는 "(공개 출처 미확인)" 명시 |

> **읽는 방법.** §0 = 22 UX 패턴 한 표. §1-§6 = 6 axis 별 깊은 패턴 분석 + SailTechCo 차용 결정. §7 = SailTechCo MVP UX guide. §8 = 한국어 코치 톤 prompt engineering 가이드.

---

## §0. 22 UX 패턴 한눈 매트릭스

> 범례: ★★★ 즉시 차용 (MVP) · ★★ 부분 차용 (v1) · ★ 학습만 (v2+) · ⚪ 차용 불가 (구조적 충돌)

| # | UX 패턴 | 출처 제품 | SailTechCo 차용 우선순위 |
|---|---|---|---|
| **Information Architecture (§1)** | | | |
| 1 | Live / Forecast 2-탭 mental model | Surfline | ★★★ MVP |
| 2 | Opt-in training mode (일상 vs 분석 mode 분리) | Vakaros | ★★★ MVP |
| 3 | Page system + swipe navigation | Vakaros 4.4-inch + Apple Watch | ★★ v1 |
| 4 | Race-aware timeline (leg color + maneuver marker + comment marker) | Njord Player | ★★ v1 |
| 5 | 사용자 진보 단계 (초·중·고급) 인지 | (대부분 부재) + 옥코치 R1-R9 | ★★★ MVP |
| **Confidence + 정직성 (§2)** | | | |
| 6 | Dual-output + "i" tooltip (Method A vs Method B) | Njord | ★★★ MVP |
| 7 | Product line 분리 (정확도 정직 표기) | Vakaros Atlas 2 25cm vs HALO RTK 1cm | ★★ v1 |
| 8 | Confidence-aware UI ("Confirm wind direction when ML returns low confidence") | Vantage 1.4.0 | ★★★ MVP |
| 9 | 수치 정직성 — "공개 출처 미확인" 표기 | (대부분 부재) + 본 audit 패턴 | ★★★ MVP |
| 10 | Live wind dot (실측 vs 모델 분리) | Surfline | ★★ v1 |
| **시각언어 (§3)** | | | |
| 11 | Big-number KPI card | Waterspeed + Strava 표준 | ★★★ MVP |
| 12 | Speed-color heatmap on GPS track | Cluster C 표준 (Waterspeed/Hoolan/Bartz) | ★★★ MVP |
| 13 | Radial polar + Scatter (TWA × Boat Speed) | Njord + Waterspeed Ultra | ★★ v1 |
| 14 | Animated wind flow (WebGL particle) | Windy.com + Expedition v11 | ★ v2 |
| 15 | Strip timeline (legs & runs) | Njord + Vantage + Waterspeed Ultra | ★★ v1 |
| **Sync + Sharing (§4)** | | | |
| 16 | Single time master (scrub in one, everything follows) | Njord Player | ★★ v1 |
| 17 | GoPro GPMF timestamp 우선순위 5단계 | Njord Player | ★★ v2 (video sync 시) |
| 18 | OS native share sheet 기반 공유 | Vakaros iOS | ★★★ MVP |
| 19 | 그룹 코드 클로즈드 공유 (vs Strava public feed) | ChartedSails | ★★★ MVP |
| **Pricing + 진보 UX (§5)** | | | |
| 20 | 180일 이상 무료 (가격 정당화 메시지) | Njord | ★★ v1 |
| 21 | 사용자 정의 단위·소수점 metric per | Njord What's New | ★★★ MVP |
| 22 | 3-tier freemium gradient (Free / Pro / Ultra) | Waterspeed Pro+Ultra / ChartedSails 4-tier | ★★★ MVP |

→ **★★★ MVP 차용 = 10 패턴** (P1, P2, P5, P6, P8, P9, P11, P12, P18, P19, P21, P22 — 12개로 늘리는 게 정확).

---

## §1. Information Architecture — 사용자가 한 화면을 어떻게 navigate 하는가

### §1.1 Surfline Live / Forecast 2-탭 ★★★

**출처 (master audit §C3):**
- Surfline iOS / Android / Web 의 spot page = **Live 탭** (지금 탈 것인가) + **Forecast 탭** (언제 탈 것인가) 양분
- Live 탭 = 한 화면 안에 surf / swell / wind / tide / weather 카드 5개 + 24시간 연속 차트

**Mental model:**
```
사용자 의사결정 = 시간축 위 2 가지 질문
  ├── "지금 출조할 것인가?"  → Live 탭 (현재 실측 + 즉시 가능 forecast)
  └── "언제 출조할 것인가?"  → Forecast 탭 (10일 horizon + spot 별 history)
```

**SailTechCo 차용 결정:**

✅ **차용한다.** 그러나 mental model 을 *windfoil context* 로 적응:
```
SailTechCo 사용자 의사결정 = 출조 전 + 출조 후 의 dual axis
  ├── 출조 전 ("지금/언제 탈 것인가") → Forecast + Spot Live wind
  │   - KMA RDAPS 1.5km wind forecast
  │   - 한국 윙포일 spot 실시간 wind dot (사용자 공유 또는 spot mounted)
  │   - 윙 사이즈 추천 (라이더 무게 + 풍속)
  │
  └── 출조 후 ("이번 세션 어땠나") → Session Analysis
      - 4-channel wind inference 결과
      - 옥코치 R1-R9 코칭
      - KPI catalog (foiling time, jibe count, board cant 등)
```

**iOS Tab Bar 구조 (Phase 1 MVP):**
- Tab 1: **출조** (Live + Forecast + Spot 가이드)
- Tab 2: **세션** (개인 세션 목록 + 분석)
- Tab 3: **코치** (옥코치 R1-R9 코멘트 + 다음 세션 목표)
- Tab 4: **나** (프로필 + 설정 + 친구)

**Counter-position 미러:** Surfline 은 wingfoil 전용 뷰 없음 — wind 카드만 보고 surf 중심 wave 정보는 노이즈. SailTechCo 의 출조 탭은 *처음부터 wingfoil 위주* (wind + 윙 사이즈 추천 + foilable wave 기준).

### §1.2 Vakaros Opt-in Training Mode ★★★

**출처 (master audit §A1-Deep §4):**

> "**Tack and Gybe Loss** — This training feature is all about nailing the perfect maneuver. **Enable it under training modes on a page in your display layout**. Configure the time window to include enough time for acceleration at the end of a tack or gybe."

> "Whenever you're on the page you selected, the Atlas will detect tacks or gybes and display how many meters were lost ... LED array will light up Green if the maneuver is above average within your current session, red if it is below, and **purple when you achieve a new personal best**!"

**Mental model:**
- **일상 라이딩 화면**: 단순 readout (SOG, distance, time) — 코칭 노이즈 0
- **Training mode 화면**: 회전 손실 측정 + LED 3색 신호 + PB 추적 — 사용자 자발적 활성화

**왜 중요한가:** 윙포일러는 *모든 세션을 분석 mode 로 쓰지 않는다*. 친구와 cruise / 새 보드 테스트 / 그냥 fun ride 시 코칭 멘트가 *방해*. opt-in 토글이 핵심.

**SailTechCo 차용 결정:**

✅ **차용한다.** Phase 1 MVP 에서 다음 분리:
- **모드 1 — 라이드** (cruise / fun): 최소 readout (SOG, distance, time, foiling 시간)
- **모드 2 — 트레이닝** (분석 활성): 옥코치 R1-R9 + jibe loss + 4-channel wind confidence + PB 추적

세션 시작 시 사용자 1 탭 선택 → 결과 화면도 모드별로 다름.

**모드 전환 UX:**
```
세션 종료 시점에 모드 변경 가능 (분석 후처리):
  라이드 → 트레이닝 변환: "이 세션을 트레이닝 모드로 다시 보기"
  트레이닝 → 라이드 변환: "분석 코멘트 숨기기"

세션 중 모드 전환은 v1+ (앱 백그라운드 영향 minimize)
```

### §1.3 Page System + Swipe Navigation ★★ v1

**출처:**
- **Vakaros Atlas 2** (master audit §A1-Deep §5): 4.4-inch 320×240 디스플레이의 page 시스템 + 디바이스 버튼 swipe
- **Apple Watch** 표준 패턴: digital crown + swipe

**Mental model:** 한 화면 = 1-4 metric 큰 글자 표시 (직사광 가독), page 전환 = "다른 정보가 필요할 때"

**SailTechCo 차용 결정:**

★★ v1 차용. 모바일 화면이 Vakaros 4.4-inch 보다 크긴 하지만, *세션 중* 화면은 단순화 필요 (라이딩 중 폰 화면 응시 < 1 초):

```
세션 중 모바일 화면 page 구조:
  Page 1 — Speed (큰 SOG, 작은 avg/peak)
  Page 2 — Foiling (foiling time %, 윙 사이즈 추천)
  Page 3 — Wind (4-channel TWD + confidence)
  Page 4 — Coach (옥코치 라이브 코멘트, 트레이닝 모드만)

swipe 전환, 마지막 page 기억 (다음 세션 동일 page 부터)
```

### §1.4 Race-aware Timeline ★★ v1

**출처 (master audit §B2-Deep §6 — Njord Player):**

> "Upwind and downwind legs are colour-coded. Tacks and gybes are marked. Races and legs are labelled. Your own on-water comments appear as markers."

**시각 어휘 4 종 + 미디어 오버레이:**
1. Leg colour-coded (upwind 파란색, downwind 빨간색 추정)
2. Maneuver markers (tack/jibe icon)
3. Race/leg labels
4. Comment markers (사용자 작성)
5. Media available indicator (영상 sync 시)

**SailTechCo 차용 결정:**

★★ v1. 윙포일 freeride 는 race 라벨 없지만 다른 어휘 그대로 사용:

```
SailTechCo 세션 timeline 어휘 (v1):
  1. Run colour-coded (port tack 청록, starboard tack 노란색)
  2. Maneuver markers (jibe = ◯, tack = △, transition = ▽)
  3. Speed run labels (alpha 500m / sustained 10s / peak)
  4. Comment markers (사용자 작성, 옥코치 코멘트는 별도 색)
  5. Photo/video available indicator (v2 video sync 시)
```

### §1.5 사용자 진보 단계 인지 ★★★

**출처:**
- **선행 자산**: `스킬레벨_데이터주도_설계안_v2_2026-05-22.md` (10-axis 진단 시스템)
- **모든 35 제품**: 사용자 진보 단계 *알고리즘적* 인지 부재
- **옥코치 R1-R9 룰엔진**: 동일 룰을 *진보 단계별 다른 코멘트*

**Mental model:** 같은 회전 손실 결과 (예: 2.5m loss) 라도:
- **초급**: "괜찮아요. 자이브가 안정적이었어요. 다음에는 진입 직전 윙 트림 살짝만 풀어보세요." (격려 우선)
- **중급**: "2.5m 손실 — session 평균보다 0.3m 좋아요. 진입 cant 좌측 12° 가 살짝 큽니다." (수치 + 1 개선점)
- **고급**: "VMG loss 2.5m / target 1.8m — cant 12° L → 8° L 개선 시 0.5m 단축 예상." (분석가 톤)

**SailTechCo 차용 결정:**

✅ **MVP 차용 (선행 자산 활용).** 10-axis 진단 시스템 의 결과를 *LLM prompt 의 context* 로 전달:

```python
def coach_comment(rules: list[dict], rider_level: str) -> str:
    """rider_level: '초급' / '중급' / '고급'"""
    persona = {
        '초급': "격려 + 1 개의 구체 개선점 + 기술 어휘 minimal",
        '중급': "수치 + 비교 + 1-2 개 개선점 + 도메인 어휘 정확",
        '고급': "분석가 톤 + 수치 우선 + 인과 관계 + 다음 세션 목표"
    }
    # LLM prompt 에 persona[rider_level] 주입
    ...
```

---

## §2. Confidence + 정직성 UX — 사용자가 숫자를 어디까지 믿을 수 있는가

### §2.1 Njord Dual-Output + "i" Tooltip ★★★

**출처 (master audit §B2-Deep §4 — Njord User Guide Maneuvers verbatim):**

> "The maneuver analysis table shows various relevant metrics as averaged before and after the maneuver, as well **two different maneuver loss calculation approaches**. Click the **'i' symbol near the maneuver loss values to learn more about how those are calculated**."

**Mental model:**
- 같은 KPI (회전 손실) 의 *두 가지 측정 방식* (Method A displacement vs Method B instantaneous-VMG)
- "i" 툴팁 으로 *각 방식의 가정과 한계* 자세히 설명
- 사용자가 *수치 정직성* 을 직관적으로 인지

**왜 중요한가:** 옥코치 자연어 코멘트가 권위적으로 들릴 위험을 *수치 dual + i 툴팁* 으로 보완. 한 개 숫자가 *진실의 환상* 을 만드는 sailing analytics 표준 한계.

**SailTechCo 차용 결정:**

✅ **MVP 차용.** 다음 KPI 에 dual-output + i 툴팁 적용:

| KPI | Method A | Method B | i 툴팁 내용 |
|---|---|---|---|
| **회전 손실 (m)** | Displacement (TWD reference projection) | Instantaneous VMG integration (TWA × BoatSpeed) | "Method A 는 GPS 좌표만 사용 — 풍향 추정이 정확하면 신뢰 가능. Method B 는 매 1초 VMG 적분 — TWA 정확도 의존. 두 방법 결과가 크게 다르면 풍향 추정 신뢰도가 낮다는 신호." |
| **Foiling Time %** | Speed threshold (≥ 12kt for windfoil) | IMU pitch threshold (board angle ≥ 4°) | "Method A 는 GPS-only — 단순. Method B 는 Apple Watch pitch 센서 — '물리적으로 foil 위'. 두 값이 크게 다르면 wind chop / wave 가 큰 세션일 가능성." |
| **풍향 TWD** | (§W3 의 4 channel 출력 동시 표시) | — | (별도 — §2.3 참조) |

**i 툴팁 한국어 작성 가이드:**
- 1-2 문장 (길지 않게)
- "왜 두 방법이 있는가" + "결과 차이가 클 때 무엇을 의미하는가" 2 가지 명시
- 기술 어휘 절제 (예: "displacement" 대신 "위치 변화 기반")

### §2.2 Vakaros Product Line 분리 ★★ v1

**출처 (master audit §A1-Deep §4):**
- **Atlas 2 단독** = 25 cm Real-Time Differential GNSS (RaceSense 네트워크 내)
- **Atlas HALO RTK 별도 SKU $599** = 1 cm horizontal positional accuracy

**왜 중요한가:** Vakaros 가 Atlas 2 의 정확도 한계를 *덜 정확하다고 인정* 하고 *별도 라인업으로 분리* — 마케팅 차원의 수치 정직성. *"Atlas 2 자체가 1cm"* 라고 주장했으면 비판 받았을 것 (Sailing Anarchy 의 일부 마케팅 오독).

**SailTechCo 차용 결정:**

★★ v1 차용. SailTechCo Free vs Pro 의 정확도 차이를 *명시적으로 product line 분리*:

```
SailTechCo Free tier:
  - 2-channel wind (사용자 1회 캡처 + 외부 weather)
  - 정확도 표기: "MAE ±15° 추정"
  - 신뢰도 낮음 시 "Pro 업그레이드로 ±5° 정확도" 권유 (push 아닌 옵션)

SailTechCo Pro tier:
  - 4-channel wind (+ Apple Watch IMU + 다회전 기하)
  - 정확도 표기: "MAE ±5° (검증된 100 세션)"
```

→ "Pro tier 가 비싸서 정확도 더 좋다" 가 아니라 *"Pro tier 가 Apple Watch IMU + 다회전 기하 더 많은 채널 사용해서 정확도 더 좋다"* 의 정직 표기.

### §2.3 Vantage Confidence-aware UI ★★★

**출처 (master audit §B1-Deep §1):**
- Vantage 1.4.0 (2025-09): "Confirm wind direction when ML model returns low confidence"

**Mental model:**
- ML 모델이 자기 추정의 *불확실성* 을 사용자에게 명시
- 신뢰도 낮을 때 사용자 confirmation 요청 (passive 가 아니라 active)

**SailTechCo 차용 결정:**

✅ **MVP 차용.** 4-channel wind inference 의 confidence 출력을 다음 UI 로:

```
세션 종료 후 분석 화면:
┌─────────────────────────────────────────────┐
│  풍향 추정 결과                              │
│  ─────────────────────────                  │
│  235°   ●●●○○  보통 신뢰도                   │
│                                              │
│  ⓘ 4 채널 중 3 채널 일치 (235° 부근)         │
│     1 채널 (Apple Watch IMU) 250° 어긋남     │
│     → 라이더 body lean 이 wind shift 잡았을  │
│       가능성. 신뢰도 보통.                   │
│                                              │
│  [채널별 출력 보기] [내가 직접 입력하기]    │
└─────────────────────────────────────────────┘
```

3 단계 confidence:
- **높음** (●●●●●): variance < 10°, 자동 채택
- **보통** (●●●○○): variance 10-30°, 사용자 채택 또는 채널 확인
- **낮음** (●○○○○): variance > 30°, **사용자 confirmation 요구** + "직접 입력" 권유

### §2.4 "공개 출처 미확인" 정직 표기 ★★★

**출처:** 본 audit 의 핵심 원칙 (모든 deep-dive 에서 일관 적용)

**Mental model:** 데이터·메서드·수치를 검증하지 못한 경우 *조용히 건너뛰지 않고 명시*. PhD 검수의 표준 관행.

**SailTechCo 차용 결정:**

✅ **MVP 차용 (UX 패턴이라기보다 회사 정체성).**

SailTechCo 의 모든 KPI display 옆에:
```
ⓘ 측정 방법 → [Method docs → GitHub link]
```

특정 KPI 가 *추정 기반* (예: Foiling Time = speed threshold 추정) 인 경우 명시:

```
Foiling Time %: 64%   ⓘ 추정
                       └→ "현재 측정은 speed threshold (≥12kt) 기반.
                          Apple Watch pitch sensor (Pro) 시 IMU 기반 정확 측정."
```

→ **데이터 정직성 = SailTechCo brand의 핵심**. Vakaros 의 "10억+ 위젯 레이아웃" 같은 unverified marketing claim 회피.

### §2.5 Surfline Live Wind Dot ★★ v1

**출처 (master audit §C3):**
- Surfline 의 시그니처 = 지도 위 **실측 wind dot** (굵은 원) + **모델 wind dot** (옅은 원) 의 시각 구분

**왜 중요한가:** 사용자가 *지금 본 wind 가 실측인지 forecast 인지* 직관적으로 인지. PredictWind / Windy 같은 모델-only 와 다른 *정직성 시각언어*.

**SailTechCo 차용 결정:**

★★ v1 차용. Spot Live wind 화면에:

```
한국 윙포일 spot 지도 (예: 송정):
  ● 큰 원 = 실측 (라이더 공유 또는 spot mount 센서)
  ○ 작은 원 = KMA RDAPS 모델 (1.5km grid 인접 셀)

  Wind 화살표 + 풍속 숫자 + 시각 (HH:MM)

  "마지막 실측: 12분 전 (라이더 김** 공유)"
  vs
  "다음 모델 갱신: 18분 후"
```

→ 사용자가 *실측 vs 모델* 의 정확도 차이를 직관적으로 학습.

---

## §3. 시각언어 — 데이터를 어떻게 그리는가

### §3.1 Big-number KPI Card ★★★

**출처:**
- **Waterspeed home**: *"KPI main 2"* 이미지 — 큰 폰트 + 단위 + 작은 보조 라벨
- **Strava** 표준 (러닝/사이클링 ↔ 윙포일 transfer 가능)
- **Vakaros Atlas 2 hardware display**: 30mm digits, 120° viewing cone

**Mental model:**
```
┌─────────────────────────┐
│      28.4               │   ← 큰 숫자 (페이지의 70%)
│      kt                 │   ← 단위 (작게)
│                         │
│   peak / 2-second       │   ← 보조 라벨 (회색)
│   ▲ +1.2 vs last        │   ← 비교 (옵셔널)
└─────────────────────────┘
```

**왜 중요한가:** 윙포일러가 *세션 종료 직후* 가장 먼저 보는 화면 = "오늘 얼마나 빨랐나" 의 즉각 답. 큰 숫자 + 작은 단위가 instinct UX.

**SailTechCo 차용 결정:**

✅ **MVP 차용.** 세션 결과 화면의 7-KPI grid:

```
세션 결과 화면 (Phase 1 KPI 7개):
  ┌──────────┬──────────┐
  │  28.4    │   12.3   │
  │  kt      │   km     │
  │  Top     │ Distance │
  ├──────────┼──────────┤
  │   64%    │   18     │
  │  foiling │   회전   │
  │   time   │  jibes   │
  ├──────────┼──────────┤
  │  1h 24m  │   235°   │
  │ duration │  wind    │
  │          │ ●●●○○    │  ← confidence dots (§2.3)
  └──────────┴──────────┘
```

### §3.2 Speed-color Heatmap on GPS Track ★★★

**출처 (Cluster C 표준):**
- Waterspeed home + activity replay (master audit §C4-Deep §6(c))
- Hoolan, Bartz Foiling app, Foil Sessions, FoilMotion 모두 동일 패턴

**Mental model:** GPS 트랙 line + 속도별 색상 (저속 파랑 → 고속 빨강) — *어디서 빨랐나* 시각 즉시 인식

**SailTechCo 차용 결정:**

✅ **MVP 차용 (이미 표준).** 추가 wedge: **윙포일 specific overlay**:

```
SailTechCo speed heatmap + 추가 layer (v1):
  - 기본 layer: 속도 색상 (모든 Cluster C 표준)
  - +Optional layer 1: 회전 marker (jibe = ◯, tack = △)
  - +Optional layer 2: foiling vs planing vs displacement 3 상태 색상
  - +Optional layer 3: 풍향 화살표 grid (4-channel TWD 결과)
  - +Optional layer 4: 옥코치 코멘트 marker (트레이닝 모드)
```

사용자 layer 토글 가능 — Strava 의 segment overlay 패턴 차용.

### §3.3 Radial Polar + Scatter ★★ v1

**출처 (Cluster A 표준 → Cluster C 진입 중):**
- **Njord** Polar Diagram (master audit §B2-Deep §3): radial diagram + TWS 라인 + best VMG 두 anchor
- **Waterspeed Ultra** (2025-12 신규): "Polar Charts visualize how your performance varies across wind angles and speeds in one overview"
- **TWA × Boat Speed scatter** (Vantage, Njord, Ultra)

**Mental model:**
```
     0° (head to wind)
     │
     │
   /─┼─\
  /  │  \
 /   │   \  ← 우측 = port tack
180° │     90° (beam reach)
     │
     │  ← scatter dot = 매 1초 sample
     │     색상 = TWS bucket
```

**왜 중요한가:** 윙포일러가 *어느 TWA 에서 best 성능* 인지 직관적 인식. 같은 윙·보드·foil 셋업의 *envelope* 시각화.

**SailTechCo 차용 결정:**

★★ v1 차용 (개인 polar learning § W2 와 결합).

**윙포일 specific 변형:**
- Njord 의 keelboat polar = TWA range 30-180° 모두 의미
- 윙포일 polar = TWA **40-150° 만 의미** (close-hauled 어려움, 풍하 dead-run 거의 안 함)
- 풍속 (TWS) 8-25kt range 가 주 활용 영역 (5kt 이하 = pump, 30kt+ = upper limit)

Phase 1 MVP 에서는 polar 표시 보류 (개인 표본 부족), v1 에서 *3+ 세션 동일 셋업* 시 활성화.

### §3.4 Animated Wind Flow ★ v2

**출처:**
- **Windy.com** 시그니처 (master audit §F2): "풀스크린 지도 위 애니메이션 wind particle flow" (Cameron Beccario earth/nullschool 코드 기반 WebGL)
- **Expedition v11** (2020): "Animated wind flow" — chart 위 wind streamline 애니메이션
- **PredictWind** 동일 패턴

**Mental model:** 정적 화살표 grid → *움직이는 wind particle* 로 사용자가 *바람의 흐름* 을 직관적 인식

**SailTechCo 차용 결정:**

★ v2+ 차용 (구현 부담 큼, MVP 의 핵심 가치 propositions 가 아님).

만약 v2+ 에서 추가하면:
- WebGL 기반 (모바일 PWA 호환)
- Phase 1 = 정적 화살표 grid (충분)
- 한국 KMA RDAPS wind field 시각화 시 효과적

### §3.5 Strip Timeline (Legs & Runs) ★★ v1

**출처:**
- **Vantage Sailing** "Strip timeline" (master audit §B1-Deep §6)
- **Waterspeed Ultra** "leg & run" 화면 (2025-12 신규)
- **Njord Player** "Race-aware timeline"

**Mental model:**
```
세션 timeline 시간축 strip:
0:00 ──────────────────────────────────── 1:24:00
  │  ▒▒▒  ░░░░░  ▒▒▒▒▒  ░░░  ▒▒▒▒▒▒  ░░░  │
     ↑    ↑      ↑                          ↑
     run1 run2   run3 (port/starboard 색상)  session end
     
     ▼     ▼      ▼          ▼ marker (jibe)
     ◯     ◯      ◯△         ◯
```

**SailTechCo 차용 결정:**

★★ v1 차용. 윙포일 freeride 의 run 단위 (cross-shore one-way reach) 가 키일보트 leg 와 다르므로 정의 명확:

```
SailTechCo "Run" 정의:
  - 같은 tack (port 또는 starboard) 의 연속 라이딩 (≥ 30초)
  - jibe 또는 tack 으로 종료
  - run 통계: 평균 SOG, max SOG, distance, foiling time %, duration
```

---

## §4. Sync + Sharing — 데이터를 어떻게 동기 + 공유하는가

### §4.1 Njord Single Time Master ★★ v1

**출처 (master audit §B2-Deep §6):**

> "Run any number of windows across any number of screens — all playing in perfect sync. **Every window stays locked to the same playback position. Scrub in one and everything follows.**"

**Mental model:** 다중 윈도 (video + chart + map + photo) 동기 — *어디서 스크럽해도 모든 창이 따라옴*. 단일 시간 마스터 (single time master) 패턴.

**SailTechCo 차용 결정:**

★★ v1 차용 (Phase 1 = 단일 화면이지만 hover sync 인프라 준비).

Phase 1 의 hover sync (선행 자산 `라이딩통계_대시보드_스코핑_v1.md` 의 `setChartCursorByTime`) 가 이미 같은 철학. v1 에서 multi-pane (map + speed chart + altitude/wind chart) 동기 재생 추가:

```
SailTechCo v1 multi-pane 화면:
  ┌─────────────┬─────────────┐
  │             │  Speed      │
  │   Map +     │  chart      │
  │ track       ├─────────────┤
  │             │  Wind       │
  │             │  chart      │
  └─────────────┴─────────────┘
       │
       └→ 시간 슬라이더 (전체 너비)
         ↑ scrub 시 모든 pane 동시 hover
```

### §4.2 GoPro GPMF Timestamp 우선순위 5 단계 ★★ v2

**출처 (master audit §B2-Deep §6 — Njord Player Loading Media):**

**Timestamp 우선순위 (자동):**
1. **GoPro GPMF (GPS Time)** — 신형 GoPro GPS 켰을 때 자동, 가장 정확
2. **QuickTime Time Code (start of video)** — GoPro GPS off 시
3. 파일명 패턴 `YYYY-MM-DD_hh-mm-ss` 또는 `YYYYMMDD_hhmmss` 자동 추출 (소수초 1-3 자리 지원)
4. 파일 capture date EXIF
5. 파일 creation date (fallback)

**추가 패턴:**
- DJI 드론: `.SRT 파일을 함께 두면 timestamp offset 자동 매핑
- SailGP 방송 영상: "TV broadcast start time minus approximately 33 seconds" 마법 상수
- 카메라 시계 오프셋: "boom and rudder visible in the video to synchronize with a turn up / tack visible in the boat's track" 시각 큐

**SailTechCo 차용 결정:**

★★ v2 차용 (video sync 도입 시 Phase 3 wedge — `sailtechco_moat_proposal.md` §2.W2 의 v2-v3 일정).

윙포일 시 GoPro / Insta360 / 헬멧캠 보편화 — 한국 윙포일러 GoPro 보유율 매우 높음 (정성적 관찰, 공개 출처 미확인). v2 에서 GoPro GPMF 5-tier 우선순위 그대로 차용:

```python
def auto_sync_video_timestamp(video_file: str) -> datetime:
    # Priority 1: GoPro GPMF (GPS Time)
    if has_gpmf_gps(video_file):
        return parse_gpmf_gps_time(video_file)

    # Priority 2: QuickTime Time Code
    if has_quicktime_timecode(video_file):
        return parse_quicktime_timecode(video_file)

    # Priority 3: filename pattern
    timestamp = parse_filename_timestamp(video_file)
    if timestamp:
        return timestamp

    # Priority 4: EXIF capture date
    if has_exif_capture_date(video_file):
        return parse_exif_capture_date(video_file)

    # Priority 5: file creation date (fallback)
    return os.path.getctime(video_file)
```

**한국어 자막 + 윙포일 overlay 추가 (SailTechCo wedge):**
- 영상 위 한국어 KPI overlay (예: "28.4 kt | foiling | 자이브 #3")
- 옥코치 코멘트 자막 (LLM 한국어 톤)

### §4.3 OS Native Share Sheet ★★★

**출처 (master audit §A1-Deep §6):**
- Vakaros Connect v1.14.11 (2025-11-04): "fixed bug where share menu wouldn't appear when exporting sessions" — *공유 기능은 OS share menu 기반* (iOS native share sheet). 별도 web link 공유 인프라 *아님*.

**왜 중요한가:** 1인 개발 SailTechCo 는 **별도 web link 인프라 구축 비용 절감** 가능. iOS UIActivityViewController + Android ShareCompat 만 호출.

**SailTechCo 차용 결정:**

✅ **MVP 차용.** 세션 결과 공유 = iOS/Android 의 native share sheet 호출:

```
사용자 액션: [공유 버튼 탭]
  →
iOS native share sheet 자동 호출:
  - 카카오톡 (한국 1위)
  - 인스타 스토리
  - 메시지 (iMessage)
  - 메일
  - AirDrop
  - 사진 (이미지 저장)
  - PDF 저장
  - Strava 게시 (외부 sync)

공유 콘텐츠 = 자동 생성 PNG (KPI grid + speed heatmap + 옥코치 1 코멘트) +
              optional caption (한국어 자동 작성)
```

**자동 생성 PNG template (Korean 윙포일 라이더 카톡 공유 친화):**
```
┌────────────────────────────────────────┐
│  송정 윙포일 세션 · 5월 28일 (수)       │
│  ────────────────────────────────────  │
│                                        │
│  Top  28.4 kt          Foiling 64%     │
│  Dist 12.3 km          Jibes 18 회     │
│  Time 1h 24m                           │
│                                        │
│  [speed heatmap on GPS track]          │
│                                        │
│  옥코치: "3번째 자이브가 최고 ✨"      │
│                                        │
│  via SailTechCo · sailtech.kr          │
└────────────────────────────────────────┘
```

→ 카카오톡 공유 시 일관된 한국어 톤 + 시각언어. Strava 의 "share to Instagram Story" 패턴 차용.

### §4.4 그룹 코드 클로즈드 공유 (vs Strava Public Feed) ★★★

**출처 (master audit §B9 ChartedSails):**

> "Create a group, share a code, and everyone's data comes together automatically."

ChartedSails 의 그룹 모델:
- **클로즈드** (코드 기반) — Strava 같은 public feed *아님*
- **자동 데이터 풀링** — 같은 코드 그룹원의 세션이 자동 모임
- **공유 마찰 0** — Sailing Report PDF 한 탭으로 카톡 전송

**왜 중요한가:** 한국 윙포일 커뮤니티 = 네이버 카페 + 카카오톡 오픈채팅 + 인스타. *public feed 가 아닌 클로즈드 그룹* 문화. ChartedSails 모델이 한국에 완벽 적합.

**SailTechCo 차용 결정:**

✅ **MVP 차용.** 다음 공유 모델 적용:

```
SailTechCo 공유 mechanism:

  1. 개인 세션 (default 비공개)
     - 사용자만 볼 수 있음
     - OS share sheet 로 외부 공유 (§4.3)

  2. 그룹 (코드 기반)
     - 사용자가 그룹 생성 → 6자리 코드 부여
     - 카카오톡으로 코드 공유 → 친구 입장
     - 그룹 안에서 세션 자동 공유 + 비교
     - 그룹 leaderboard (옵셔널, opt-in)

  3. 옵셔널 public feed (Phase 3+)
     - 사용자 명시 옵트인
     - 익명 / 닉네임 선택
     - Strava-style discovery feed (한국 윙포일 default off)
```

→ **한국 카톡 친화 + 사적 데이터 보호 priority**. Vakaros / Waterspeed 의 public discover feed 가 한국 사용자에게 *반감* 일 수 있음.

---

## §5. Pricing + 진보 UX

### §5.1 Njord 180일 이상 무료 (가격 메시지) ★★ v1

**출처 (master audit §B2-Deep §7):**

> "**Loading data that is older than 180 days (from recording date to load date) is free of charge.**"

**Mental model:** *추억 가공 use case 는 영구 무료*. 신규 고객 LTV 가 핵심이고 과거 데이터 가공은 마케팅 비용이라는 발상.

**SailTechCo 차용 결정:**

★★ v1 차용 (Phase 1 MVP 는 *모두 무료*, v1 부터 freemium 도입 시 다음 패턴):

```
SailTechCo freemium 가격 메시지:

  Free tier:
    - 모든 세션 평생 저장 (Njord 의 "180일 이상 무료" 의 강화)
    - 최근 7개 세션 정밀 분석 (4-channel wind / 옥코치 R1-R9)
    - 7개 이전 세션은 KPI catalog 기본 (Top speed / distance / duration) 만

  Pro tier:
    - 모든 세션 정밀 분석 (시간 제약 없음)
    - 비디오 sync overlay
    - 다국어 (영어/일본어)

→ "오래된 세션의 정밀 분석" 이 *Pro 의 차별점* 이지 *Free 의 제약* 이 아니다.
  사용자가 "정밀 분석이 필요하다" 인식 시점에 자연스럽게 upgrade.
```

→ **Njord의 영리한 가격 메시지** — *제약을 sell 하지 않고 가치를 sell*.

### §5.2 단위·소수점 사용자 설정 ★★★

**출처 (master audit §B2-Deep §5):**
- Njord What's New: "Add user settings to configure fractional digits and units per metric"

**왜 중요한가:** 같은 데이터를 *두 사용자가 다른 단위로 표시* 가능. 윙포일러 = 노트 (kt), 일부 사용자 = km/h, 유럽 일부 = m/s, 항해 = 노트.

**SailTechCo 차용 결정:**

✅ **MVP 차용 (한국 사용자 default 가 무엇인가가 중요).**

Phase 1 default 한국 윙포일 단위:
| Metric | Default | 사용자 옵션 |
|---|---|---|
| 속도 | **kt (노트)** | km/h, m/s, mph |
| 거리 | **km** | nm (해리), mi |
| 풍속 | **kt** | km/h, m/s, mph, Beaufort |
| 풍각 | **° (자북)** | ° (진북 with declination) |
| 소수점 | **1 자리** (속도/풍속) | 0/1/2 자리 |

→ 한국 윙포일러 인터뷰 (k=20, Phase 1 사전 조사) 로 default 검증.

### §5.3 3-tier Freemium Gradient ★★★

**출처:**
- **Waterspeed** Free / Pro $29.99 / Ultra $199 (master audit §C4-Deep §7)
- **ChartedSails** Free / Racer Pro $349 / Team $599 / Club $999 / Fleet $1,799 (master audit §B9)

**Mental model:** 가격 spectrum 의 양 끝 (무료 vs 고가) 사이에 *진보 단계* 가격 옵션. 각 tier 의 *명확한 가치 차별화*.

**SailTechCo 차용 결정 (Phase 1 + v1):**

```
SailTechCo Phase 1 (Q3 2026 MVP):
  Free only — 모든 사용자

SailTechCo v1 (Q1-Q2 2027 freemium 도입):
  Free                  ₩0
    - 모든 세션 저장 (평생)
    - 최근 7 세션 정밀 분석 (4-channel wind / R1-R9)
    - 한국어 UI / Spot 통합 / OS share sheet
    - 그룹 코드 클로즈드 공유

  Pro                   ₩5,000/월 또는 ₩50,000/년
    - 모든 세션 정밀 분석 (시간 제약 없음)
    - 비디오 sync (Phase 3 wedge)
    - PB 추적 + 진보 단계 자동 인지
    - 다국어 (영어/일본어 — v2+)
    - 외부 wind sensor BLE 연동 (v3+)

  Coach (v2+)           ₩15,000/월 또는 ₩150,000/년
    - Pro 의 모든 기능
    - 다중 라이더 관리 (코치 → 학생)
    - LLM 코치 persona customization
    - 다국어 라이더 지원
    - 학술 publish 자료 우선 액세스
```

**가격 격차 비교:**
| 제품 | Free | Pro/mid | High |
|---|---|---|---|
| Waterspeed | ✅ | $29.99/yr | $199/yr (6.6×) |
| ChartedSails | ✅ | $349/yr | $1,799/yr (5.1×) |
| Vakaros | ❌ | $149/yr + hardware | $599 HALO RTK |
| **SailTechCo** | ✅ | ₩50,000/yr ≈ $35 | ₩150,000/yr ≈ $105 (3×) |

→ **SailTechCo Pro 가 Waterspeed Pro 와 동등 ($35 vs $30)**, Coach 가 Pro 의 3 배 (Waterspeed Ultra 의 6.6× 보다 완만한 gradient).

---

## §6. 한국어 코치 톤 — W5 의 prompt engineering 가이드

### §6.1 한국 윙포일 코치 인터뷰 데이터 (k=20 계획)

**Phase 1 사전 조사 (Q3 2026 시작):**
- **인터뷰 대상**: 송정 / 다대포 / 시화호 / 강릉 / 고래불 spot 의 active 코치 + 라이더 (k=20)
- **수집 데이터**:
  - 평소 자신의 코칭 톤 (음성 녹음 + 한국어 transcript)
  - 진보 단계별 (초·중·고급) 코멘트 차이
  - 윙포일 도메인 어휘 표준화 (재밀·재용·풋스트랩·인서트·핸들·붐·푸셀라지·프론트윙·리어윙)
  - 격려 vs 정직의 균형 (어느 비율?)
  - 이모지 사용 (한국 카톡 문화)

**예상 결과:**

```
한국 윙포일 코치 톤 5 가지 특징 (가설):
1. 존댓말 default (사용자 → 사용자 동등)
2. 짧은 호흡 (1 코멘트 = 1-2 문장)
3. 도메인 어휘 정확 (윙포일 specific terminology)
4. 격려 + 정직 결합 (예: "이번 자이브 좋네요. 진입 cant 가 살짝 왼쪽으로 기울었는데...")
5. 이모지 0-1 개 (절제)
```

### §6.2 LLM Prompt Engineering (Phase 2 v1)

**핵심 prompt 구조:**

```python
SYSTEM_PROMPT_KR = """
당신은 한국의 윙포일 코치입니다. 다음 원칙을 따라 라이더에게 자이브/택 분석 결과를 자연어로 전달하세요.

## 코칭 톤
- 존댓말 (라이더 동등 친근감, "~요" 어조)
- 1-2 문장 (짧은 호흡)
- 윙포일 도메인 어휘 정확:
  - 보드: 풋스트랩, 인서트, 핀, cant
  - 윙: 핸들, 붐, 캔트
  - 포일: 마스트, 푸셀라지, 프론트윙, 리어윙, 글라이드
  - 동작: 자이브, 택, 토 사이드, 힐 사이드, 트랜지션, 펌프, 글라이드
- 격려 + 정직 결합 (자이브가 좋았다 + 1 개선점)
- 이모지 0-1 개

## 라이더 진보 단계 (context)
- 초급: 격려 우선, 1 개 개선점, 기술 어휘 minimal
- 중급: 수치 + 비교 + 1-2 개 개선점, 도메인 어휘 정확
- 고급: 분석가 톤, 수치 우선, 인과 관계, 다음 세션 목표

## 출력 형식
1-2 문장 한국어. JSON 형식 아닌 plain 한국어.
"""

USER_PROMPT_TEMPLATE = """
다음 자이브 분석 결과를 한국어 자연어 코멘트로 변환해 주세요.

[라이더 정보]
- 진보 단계: {rider_level}
- 이번 세션 자이브 카운트: {jibe_count}/{total_jibes}
- session 평균 자이브 손실: {session_avg_loss}m
- 라이더 personal best: {personal_best}m

[현재 자이브 (R1-R9 룰 출력)]
- R1 진입 비대칭: severity={r1_severity}, 좌측 cant {r1_value}°
- R2 회복 시간: severity={r2_severity}, {r2_seconds}초
- R3 2단 회전: severity={r3_severity}, 봉우리 {r3_peaks}개
- R4 진입 손실: severity={r4_severity}, {r4_dip}kt dip
- R5 출구 가속: severity={r5_severity}, {r5_angle}° 정상
- R6 토 사이드 전환: severity={r6_severity}
- R7 풍축 어긋남: severity={r7_severity}, {r7_deviation}° deviation
- R8 보드 cant 과도: severity={r8_severity}
- R9 윙 회전 늦음: severity={r9_severity}

[지금 자이브 손실] {current_loss}m
[Session 평균 대비] {current_loss_vs_avg} (better / worse)
[Personal best 대비] {current_loss_vs_pb} (better / worse)

자연어 코멘트:
"""
```

### §6.3 예상 출력 예시 (Phase 2 v1 베타)

**예시 1 — 초급 라이더, 평균 대비 좋은 자이브:**

Input:
- rider_level: 초급
- R1 severity: medium (좌측 cant 12°)
- R2 severity: low (회복 2.5초)
- R4 severity: none
- current_loss: 1.8m
- session_avg: 2.5m
- pb: 1.2m

**LLM 출력 (예상):**
> "오늘 자이브 중에서 가장 좋은 자이브였어요! 회복도 2.5초로 빨랐어요. 진입에서 보드가 살짝 왼쪽으로 기울었는데, 다음에는 오른쪽 풋에 살짝 더 무게 실어보세요."

**예시 2 — 중급, 평균 정도:**

Input:
- rider_level: 중급
- R1 severity: low
- R3 severity: medium (봉우리 2개)
- R7 severity: medium (풍축 deviation 18°)
- current_loss: 2.3m
- session_avg: 2.1m
- pb: 1.5m

**LLM 출력:**
> "회전이 약간 2단으로 끊긴 것 같아요 (봉우리 2개). 풍축 deviation 도 18° 로 좀 있어서, 출구 시 코스 정렬에 신경 써 보세요. 손실 2.3m — session 평균 (2.1m) 과 비슷한 수준."

**예시 3 — 고급, PB 갱신:**

Input:
- rider_level: 고급
- R1 severity: none
- R2 severity: low (1.9초)
- R5 severity: low (출구 12°)
- current_loss: 1.1m
- session_avg: 1.6m
- pb: 1.2m (이전 PB)

**LLM 출력:**
> "PB 갱신 ✨. Loss 1.1m / 회복 1.9s / 출구 12°. R1-R9 모두 clean — entry cant 0°, exit 가속 angle 12° 가 핵심 driver. 다음 세션 목표는 회복 < 1.8s 와 entry pump 추가로 PB < 1.0m."

### §6.4 LLM 출력 검증 (k=5 한국 코치 blind review)

**검증 프로토콜:**

```
검증 단계:
1. SailTechCo 가 50 자이브 분석 결과 생성 → LLM 코멘트 50 개
2. 같은 50 자이브 분석 결과 → 한국 윙포일 코치 (k=5) 가 직접 코멘트 작성
3. Blind review (LLM vs 인간 코치 출처 가림):
   - Naturalness (자연스러움) Likert 5 점
   - Accuracy (정확도) Likert 5 점
   - Coaching value (코칭 가치) Likert 5 점
4. 결과:
   - LLM Naturalness ≥ 4.2 / Accuracy ≥ 4.0 / Coaching ≥ 4.0 = MVP 통과
   - 미달 시 prompt iteration 또는 fine-tune
```

### §6.5 LLM 비용 분석

```
가정:
- 평균 세션 = 18 자이브 (한국 윙포일 freeride 평균)
- 자이브당 LLM call = 1
- Claude Sonnet 4.5 API 비용 = $3 per 1M input tokens, $15 per 1M output tokens
- 자이브당 input = 500 tokens (system prompt + rule context)
- 자이브당 output = 100 tokens (1-2 문장 한국어)

비용 per session:
  input: 500 × 18 = 9,000 tokens × $3/1M = $0.027
  output: 100 × 18 = 1,800 tokens × $15/1M = $0.027
  total: ~$0.054 per session

월간 활성 사용자 1,000 명 × 평균 8 세션/월 = 8,000 sessions/month
  월 비용: 8,000 × $0.054 = $432/month

= 사용자당 평균 $0.43/month → Pro tier ₩5,000/월 의 9% (gross margin 안전)
```

→ **LLM 코칭 비용은 Pro tier 수익 모델 안에서 충분히 마진**. 단 대량 free tier 사용자에게 무제한 LLM 코칭 제공 시 비용 risk → Free tier = "최근 7 세션의 LLM 코칭" 제약 정당화.

---

## §7. SailTechCo MVP UX Guide — Phase 1 즉시 차용 리스트

### §7.1 12 UX 패턴 채택 (MVP Q3-Q4 2026)

**Information Architecture (4):**
1. ✅ **Live / Forecast 2-탭 + Session + Coach + Me 4-tab 모바일 nav** (Surfline mental model 적응)
2. ✅ **Opt-in Training Mode** (Vakaros) — 라이드 mode vs 트레이닝 mode 분리
3. ✅ **사용자 진보 단계 (초·중·고급) 자동 인지** (선행 자산 활용)
4. ✅ **세션 종료 후 모드 변환 옵션** (라이드 → 트레이닝)

**Confidence + 정직성 (3):**
5. ✅ **Confidence-aware UI** (Vantage) — 4-channel wind 출력에 ●●●○○ 신뢰도 표시
6. ✅ **"공개 출처 미확인" / "추정" 정직 표기** — 모든 KPI 옆 ⓘ 측정 방법 link
7. ✅ **Dual-output + i 툴팁** — 회전 손실 dual method, Foiling Time dual method

**시각언어 (2):**
8. ✅ **Big-number KPI card** (Waterspeed/Strava)
9. ✅ **Speed-color heatmap on GPS track** (Cluster C 표준) + 윙포일 specific layer

**Sync + Sharing (2):**
10. ✅ **OS Native Share Sheet** (Vakaros) — 별도 web link 인프라 없이 카카오톡 공유
11. ✅ **그룹 코드 클로즈드 공유** (ChartedSails) — 한국 카톡 친화

**Pricing + 진보 (2):**
12. ✅ **사용자 정의 단위·소수점 per metric** (Njord) — 한국 윙포일 default = kt/km
13. ✅ **자동 PNG 공유 카드 한국어 template** (카톡 친화)

### §7.2 v1 추가 차용 (Q1-Q2 2027)

**다음 6 패턴:**
14. ★★ Page system + swipe navigation (Vakaros) — 세션 중 4-page 분리
15. ★★ Race-aware timeline (Njord Player) — run color + maneuver marker
16. ★★ Radial polar + Scatter (Njord, Waterspeed Ultra) — 개인 polar learning 결합
17. ★★ Strip timeline (legs & runs) (Vantage)
18. ★★ Product line 분리 (Vakaros) — Free vs Pro 의 정확도 차이 명시
19. ★★ 180일 이상 무료 (Njord) — Pro tier 의 가치 sell 메시지

### §7.3 v2+ 학습만 (Q3 2027+)

20. ★ Animated wind flow (Windy/Expedition) — WebGL particle, MVP 의 핵심 가치 아님
21. ★ GoPro GPMF timestamp 우선순위 5단계 (Njord Player) — Video sync 도입 시 (v2)
22. ★ Single time master multi-pane sync (Njord Player) — v2+ multi-pane 도입 시

### §7.4 ⚪ 차용 불가 (구조적 충돌)

- **Public discovery feed** (Strava 패턴) — 한국 사용자 default 비공개 priority
- **Multi-boat fleet replay** (SAP/Njord) — 윙포일 freeride solo ICP
- **Race start line analytics** (Vakaros/Garmin) — 윙포일 freeride race 없음
- **B&G Hercules / NMEA 2000 hardware lock-in** (Expedition/Deckman) — phone-only ICP

---

## §8. 결론 — UX 모범 사례의 종합

### §8.1 핵심 한 줄

**SailTechCo MVP 의 UX = Surfline 의 Live/Forecast mental model + Vakaros 의 opt-in training + Njord 의 dual-output + ChartedSails 의 그룹 코드 공유 + 한국어 코치 톤** — 12 패턴의 coherent stack.

### §8.2 6 axis × 22 패턴 매트릭스 위치

```
                  Industry standard 차용 →
                          │
       Live/Forecast 2-탭 ●
              Big-number ●
       Heatmap on track ●
                  Page system ●
                                ●  Race-aware timeline
                              ●  Single time master
                            ●  Radial polar
                          ●  Strip timeline
        ─────────────────┼─────────────────────────
                          │
                ●  Opt-in training mode    ← SailTechCo unique
              ●  Dual-output + i tooltip
            ●  Confidence-aware UI
          ●  Group code closed sharing
        ●  Korean coach tone (R1-R9 + LLM)
      ●  사용자 진보 단계 인지
                          │
                  ↓ Customize for SailTechCo
```

→ **18 패턴 차용 + 4 패턴 SailTechCo unique 발전** = MVP UX의 완성형.

### §8.3 다음 단계 (§3 매트릭스 → MVP sprint)

본 §5 UX 인사이트 는 §3 (feature 매트릭스 CSV) 의 시각언어 + 사용자 flow 정의 + Phase 1 MVP sprint backlog (마지막) 의 reference. 다음 우선순위:

- **§3 매트릭스**: 35 제품 × 50+ feature, CSV·xlsx — *mechanical reference*
- **Phase 1 MVP sprint plan**: 위 §4 알고리즘 + §5 UX 의 합 → 12 주 backlog

---

## §9. 출처 인덱스

본 §5 UX 인사이트의 모든 UX 패턴 출처:

**1차 UX 패턴 출처 (제품별):**

- **Surfline** (Live/Forecast 2-탭): [Surfline.com](https://www.surfline.com/), [Live vs Forecast Tabs Support](https://support.surfline.com/hc/en-us/articles/25290157830811-Understanding-the-Live-and-Forecast-tabs-on-the-Surfline-Android-App)
- **Vakaros** (Opt-in training + LED 3색 + product line 분리): [blog.vakaros.com/vmgtackloss](https://blog.vakaros.com/vmgtackloss), [Atlas 2 product](https://www.vakaros.com/products/atlas-2), [Vakaros Connect App Store](https://apps.apple.com/us/app/vakaros-connect/id1481223437)
- **Njord** (Dual-output + i 툴팁 + 180일 무료 + 사용자 단위 설정): [Maneuvers User Guide](https://app.sailnjord.com/help/analytics/maneuvers.html), [Adding Wind Data](https://app.sailnjord.com/help/analytics/adding-wind-data.html), [What's New](https://app.sailnjord.com/help/analytics/whats-new.html), [WingFoil Pricing](https://www.sailnjord.com/pricing/wingfoil/)
- **Njord Player** (Race-aware timeline + GoPro GPMF + Single time master): [Njord Player](https://www.sailnjord.com/player/), [Loading Media](https://app.sailnjord.com/help/player/loading-media.html)
- **Vantage** (Confidence-aware UI): [vantage-sailing.com/technology](https://www.vantage-sailing.com/technology)
- **ChartedSails** (그룹 코드 클로즈드 공유 + Sailing Report PDF): [chartedsails.com](https://www.chartedsails.com/), [Pricing](https://www.chartedsails.com/pricing)
- **Waterspeed** (Big-number KPI + Speed heatmap + Ultra Polar Chart): [waterspeedapp.com](https://www.waterspeedapp.com/), [blog/waterspeed-ultra](https://www.waterspeedapp.com/blog/waterspeed-ultra)
- **Windy** (Animated wind flow): [Wikipedia — Windy](https://en.wikipedia.org/wiki/Windy_(weather_service)), [Mapbox WebGL Wind blog](https://blog.mapbox.com/how-i-built-a-wind-map-with-webgl-b63022b5537f)
- **Expedition** (Animated wind flow v11): [version_history](https://www.expeditionmarine.com/version_history)
- **Velocitek** (.vtk Protocol Buffer streaming framing): [github.com/velocitek/vtk_protocol](https://github.com/velocitek/vtk_protocol)

**SailTechCo 선행 자산:**
- `회전코칭_AI_엔진_설계안_v1_2026-05-22.md` (옥코치 R1-R9 룰엔진)
- `스킬레벨_데이터주도_설계안_v2_2026-05-22.md` (10-axis 사용자 진보 단계 진단)
- `라이딩통계_대시보드_스코핑_v1.md` (Phase 1 product scoping + hover sync 인프라)
- `sailtechco_moat_proposal.md` (5-wedge 북극성 문서)
- `algorithm_depth_comparison.md` (§4 algorithm reference)

**deep-dive 카드:**
- 모든 10 Tier 0 deep-dive (§§A1-A4, B1, B2, B8, B9, C4, D1)

**Phase 1 사전 조사 (계획 — 미수행):**
- 한국 윙포일 코치 인터뷰 k=20 (Q3 2026)
- LLM 출력 blind review k=5 (Q2 2027)

---

_§5 UX 인사이트 완료. 다음: §3 기능 비교 매트릭스 (CSV·xlsx)._
