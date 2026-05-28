#### A1-Deep. Vakaros Atlas 2 — Tier 0 심층 audit (Danny 7-axis)

#### §0. 본 deep-dive 의 위치

이 섹션은 master audit 의 §A1 카드를 **대체하지 않고 확장**한다. 기존 §A1 가 다루는 (1) 포지셔닝·가격, (2) 기능 목록, (3) 알고리즘 일행, (10) Sailmon 인수 한 줄 — 이 모두 그대로 유효. 본 deep-dive 는 Danny 가 지목한 **7개 축에서만 더 깊게** 들어간다 — 공개 알고리즘 블로그(VMG/Tack Loss)의 직접 인용·역공학, 외부 날씨 데이터 통합 부재, Sailmon 인수 후 통합 로드맵의 공식 진술, Connect 앱 위젯 빌더의 "10억+" 주장 검증, 한국 시장 가용성. 모든 새 정보는 2026-05-27 추가 웹리서치([blog.vakaros.com/vmgtackloss](https://blog.vakaros.com/vmgtackloss), Shopify product pages, Practical Sailor, App Store 직접 fetch, Sailing Anarchy 외부 검색)에서. **공개 문서가 침묵하는 지점은 "(공개 출처 미확인)" 으로 명시** — 추정으로 채우지 않는다.

**본 deep-dive 가 새로 밝히는 7가지 핵심 사실:**

1. Vakaros 의 알고리즘 공개 수준은 **"메서드는 명명하지만 수식은 공개하지 않는다"** — Njord 와 정확히 동일한 패턴. VMG/Tack Loss 블로그(2022-11-11 게재)는 **수식 0건, 의사코드 0건, 윈도 수치 0건**, 단지 "shift tracking → inferred wind direction → VMG/Loss" 의 데이터 흐름만 진술 ([blog.vakaros.com/vmgtackloss](https://blog.vakaros.com/vmgtackloss)).
2. **Atlas 2 가격은 기존 audit 의 $1,199 가 아니라 현재 $1,249** ([Shopify product page](https://www.vakaros.com/products/atlas-2) 2026-05-27 fetch, SKU `vk-atlas2`, JSON 가격 124900 cent). 2025-04 Practical Sailor 리뷰 시점의 $1,199 에서 ~4% 인상.
3. **RaceSense Annual Pass = $149/년/디바이스 1대 등록** ([공식 product page](https://www.vakaros.com/products/racesense-annual-pass) — Shopify selling_plan_id 5139824854, "deferred, subscription, or recurring purchase"). 패스는 디바이스 간 양도 불가, 디바이스 자체는 양도 가능.
4. **Atlas HALO RTK = $599 사전주문 별도 제품**, Atlas 2 와 별개의 외장 RTK 센서 — 1cm 정확도는 **HALO + RaceSense RTK 결합 시에만** 보장 ([Atlas HALO RTK product page](https://www.vakaros.com/products/atlas-halo-rtk)). 기존 audit 의 "Atlas 2 가 1cm 정확도 주장" 진술은 **부정확** — Atlas 2 단독은 "25 cm Real-Time Differential GNSS positioning (when operating in a RaceSense network)" 이고, 1cm 는 HALO RTK 사전주문 라인업의 별도 SKU.
5. **Sailmon 인수 후 공식 로드맵 진술 = "MAX 고객 지원 승계, ELEMENT 는 NTG/Synapse 보유"** ([2025-03-13 공식 발표](https://www.vakaros.com/blogs/news/vakaros-acquires-sailmon)). Sailmon MAX 와 Atlas 2 의 통합/병합/단종에 관한 **공식 로드맵 진술은 발표문에 없음** — "ensuring they're well taken care of for the foreseeable future" 라는 유지보수 약속만.
6. **Vakaros Connect 앱 = iOS 전용, Android 미지원, 8개 리뷰 / 5.0 평점, 영어 단일 언어** ([App Store fetch](https://apps.apple.com/us/app/vakaros-connect/id1481223437) 2026-05-27). 한국어 미지원. 사용자 한 명이 "Watch version" 을 명시적으로 요청 (Dougo92, 2024-07).
7. **"10억+ 위젯 레이아웃"은 공식 출처에서 직접 확인되지 않음** — Vakaros 사이트의 layout builder 설명은 "Build any combination of widgets using our Layout Builder to fully customize your Atlas 2 experience" 일 뿐 (Atlas 2 product page). 10억+ 라는 구체 수치는 master audit §A1 카드 안에 인용되어 있으나 **본 deep-dive 가 그 출처를 재확인하지 못함 — 공개 출처 미확인** 으로 격하 권고.

#### §1. 풍향 재구성 알고리즘 — "shift tracking" 의 메서드

**공개 블로그의 직접 인용 — 1차 사실 (이 axis 의 핵심).**

[blog.vakaros.com/vmgtackloss](https://blog.vakaros.com/vmgtackloss) (Jake Keilman, 공동창업자 겸 EE Master Georgia Tech, 2022-11-11 게재):

> "Once on the water, run the shift tracking setup in **'angles'** to capture your reference angles and the **inferred wind direction** — and that's it. Experiment with different modes, sail shapes and heel angles, and see the instant impact on your actual performance, upwind or down."

→ **메서드 명명**: `shift tracking` 의 `angles` 모드 = **레퍼런스 헤딩 캡처 → inferred TWD 산출**. 사용자가 풍상 starboard tack, 풍상 port tack 두 헤딩을 라인업 단계에서 디바이스에 저장하면 두 헤딩의 **각 이등분(angle bisector)** 이 풍축 후보가 된다는 추론이 자연스럽다 — 이는 업계 표준 관행과 일치. 단 **Vakaros 가 "이등분이다" 라고 명시한 공개 진술은 없다** — 공개 출처 미확인.

**Vakaros 의 "각도" 모드 vs Njord 의 "maneuver angles" — 비교.** Njord 는 **레퍼런스 헤딩이 아니라 회전 자체의 진입/이탈 헤딩 시계열** 을 입력으로 받는다. Vakaros 는 *세션 시작 시점에 한 번* 풍상 starboard/port 두 헤딩을 사용자 손으로 캡처. 그 결과:

- Njord = **다(多) 회전 기하 기반 추정** (회전마다 갱신 가능)
- Vakaros = **세션 시작 1회 라인업** (실시간 즉각 산출 가능, 단 풍축이 바뀌면 재실행 필요)

→ Vakaros 가 *real-time on-water* 인스트루먼트라는 정체성 때문에 단순화한 메서드를 채택. 블로그 말미 명시:

> "And we're not done yet. Look for updates in the near future that will enable using **true wind direction when paired with a wind sensor**, for even more accurate measurements."

→ Vakaros 본인이 *inferred TWD 의 정확도가 measured TWD 보다 떨어진다는 사실을 인정* — 드문 정직성.

**"reference angles" 단어의 의미 — 추가 정황.** Atlas 2 product page 의 "magnetic compass" 섹션:

> "**Reference angles so you never miss a shift**" ([Atlas 2 product](https://www.vakaros.com/products/atlas-2))

→ "reference angles" 는 **사용자가 라인업에서 손으로 저장한 풍상 두 tack 의 magnetic heading** 임이 더 명확해진다. 그 후 실시간 헤딩이 reference 에서 벗어나는 정도를 "shift" 로 표시 → 사용자에게 lift/header 신호 제공. 풍 시프트 자체는 **압솔루트 TWD 변화** 가 아니라 **레퍼런스 대비 상대 변화** 로 표시되는 구조.

**Tack Assist 풍향 추정 — 별도 메서드 존재?** Vakaros 공식 페이지·블로그·App Store 메타데이터 어디에도 "Tack Assist" 라는 명명된 기능은 발견되지 않음 — **공개 출처 미확인**. 가장 인접한 기능 = `Distance-to-line` + `Time-to-line` + `Time-to-burn` 의 starting 군. Danny 가 가리킨 "Tack Assist" 는 **(a)** Vakaros 의 비공식 별칭일 가능성, **(b)** 타사(예: Garmin SailAssist 의 Tack Assist) 와 혼동 — Danny 측 원자료 재확인 권고.

**Tack/Gybe 자동 감지 메서드 — 블로그 직접 인용:**

> "Whenever you're on the page you selected, the Atlas will **detect tacks or gybes** and display how many meters were lost (or maybe gained, for those with a really good roll tack) after the maneuver is completed."

→ **감지 sensor 가 IMU 인지 GPS heading rate 인지 명시 없음** — 공개 출처 미확인. 다만 Atlas 2 의 센서 슈트가 (a) 25 Hz dual-band GNSS, (b) 3축 자기, (c) 3축 자이로 (0.1° heading resolution, motion fusion at 50 Hz), (d) 3축 가속도계 임을 고려할 때, 회전 감지는 **자이로 + 자기 융합 (50Hz motion fusion)** 으로 *추정* — 정황 추론, Vakaros 의 공식 진술 아님.

**솔직한 진술.** Njord 와 동일한 패턴 — **수식은 인앱 또는 코드 안에 있고 공개 페이지에는 메서드만 진술**. Vakaros 의 IP 보호 자세는 racing instrumentation 업계 표준이고, 공개적으로 reverse-engineer 가능한 한계는 "shift tracking (angles 모드) = 사용자가 라인업 단계에서 reference 헤딩 캡처 → 풍축 추론" 의 자료 흐름까지.

#### §2. 외부 날씨 데이터 통합 — **결정적 부재**

**확인된 사실.** Atlas 2 의 데이터 입력 채널 ([Atlas 2 Tech Specs](https://www.vakaros.com/products/atlas-2)):
- 내장 25Hz L1+L5 GNSS
- 내장 3축 자기·자이로·가속도
- 외부 wind sensor (BLE/ANT — Calypso, Sailmon, B&G mast-top, NK Race)
- 외부 transducer (paddlewheel speed/depth/water temp)
- 외부 NMEA 2000 (2025-04 NavLink Blue gateway 출시 후)
- Cyclops load 센서 (forestay/shroud 장력)

**공식 사이트·블로그·user-resources 어디에서도 "weather forecast API 통합" 진술 없음** — 공개 출처 미확인.

**결정적 사실 — Vakaros 는 weather forecast 통합 자체를 안 한다.** Atlas 2 의 정체성은 **on-water 실시간 인스트루먼트** 이고, *forecast 라우팅 시장은 PredictWind·Expedition·Deckman 영역으로 의도적으로 양보*. Connect 앱 의 "What's New" 23개 버전 변경 로그(2024-12 ~ 2026-05) 어디에도 weather/forecast 키워드 없음.

**Calypso wind sensor 통합 = "외부 measured wind" 의 유일한 경로.** [Calypso Ultrasonic Portable](https://www.vakaros.com/collections/wind-sensing) 가 공식 호환 wind 센서로 판매. Calypso 가 측정한 true wind 가 들어오면 **inferred TWD 대신 measured TWD 가 사용**.

**Sailmon 인수 후 변화?** [공식 발표](https://www.vakaros.com/blogs/news/vakaros-acquires-sailmon) 어디에도 "Sailmon 의 weather/wind API 통합을 Atlas 2 에 가져온다" 라는 진술 없음.

**SailTechCo 함의 — 중요한 갭.** Vakaros 는 *외부 weather forecast 통합 부재* 가 시장에서 약점이 아니다. **사용자 가치 = "instrument + race management"**, forecast 는 PredictWind/Windy 별도 앱이 racing 문화. SailTechCo 의 윙포일 freeride 시장은 반대 — **forecast (spot weather) + 분석이 한 화면에 합쳐져야 의미**. 따라서 Vakaros 의 forecast 부재는 우리에게 차별화 포인트가 *아니라* 시장 정체성이 다른 증거.

#### §3. 폴라 / target 곡선 학습 — **공식 폴라 입력 경로 없음**

Atlas 2 의 functions 목록 ([공식 product page](https://www.vakaros.com/products/atlas-2)):

> "Distance-to-line · Time-to-line · Time-to-burn · Countdown timer · **Shift tracking** · Stripchart view · **VMG**"

→ **`Polar` · `Target Speed` · `Target TWA` · `% of target` 단어 자체가 functions 목록에 없음**. 블로그 [vmgtackloss](https://blog.vakaros.com/vmgtackloss) — VMG 산출은 "Velocity Made Good" 진술만, **폴라 곡선에 대비한 % 표시 기능 없음**.

**Vakaros 는 폴라 학습/관리 기능을 의도적으로 안 만든다.** 추론:
1. **온수상 인스트루먼트의 화면 공간**: 4.4-inch 320×240 디스플레이는 폴라 다이어그램에 좁다.
2. **Vakaros 차별점 = simplicity** — Practical Sailor 인용 (Doug Wake): "Our whole message is, it's simple. You could get a better instrument setup if you spent four times as much and 20 times the time."
3. **외부 분석 도구에 위임** — Practical Sailor 가 명시한 워크플로: "*upload your data to your phone from the Vakaros and then download that to a file, which you plug into the [Vantage Sailing app](https://www.vantage-sailing.com/). It gives you all your stats... It calculates an expected wind angle, analyzes your maneuvers, and it just does it all for you.*"

→ **폴라·target·post-race 분석 = Vantage Sailing 또는 SailFrames/Njord 위임**. Vakaros 자체는 **raw telemetry 로그** 만 제공.

**SailTechCo 함의.**
- (a) 윙포일에서 폴라/target 곡선이 의미 있다면 SailTechCo 가 **Vakaros 가 차지하지 않은 영역**을 차지 — personal polar 자동학습은 Vakaros·Vantage 도 윙포일 클래스에 대해 *전혀* 안 한다.
- (b) 윙포일에서 폴라가 의미 약하다면 (윙·foil 셋업 변화 빈도 높아 stable polar 부재 가설), Vakaros 의 의도적 부재가 *경고 신호*. Phase 1 에서는 polar 출시 전 "TWS bucket 별 best run" 정도로 시작 권고.

#### §4. 회전 손실 측정 — **가장 중요한 axis, 블로그 직접 reverse-engineer**

**Vakaros 의 공개 블로그 — 회전 손실 메서드의 전체 진술.** [blog.vakaros.com/vmgtackloss](https://blog.vakaros.com/vmgtackloss) 직접 인용:

> "**Tack and Gybe Loss** — This training feature is all about nailing the perfect maneuver. **Enable it under training modes on a page in your display layout. Configure the time window** to include enough time for acceleration at the end of a tack or gybe, and then head out on the water. Run shift tracking to capture reference angles and an inferred wind direction. Whenever you're on the page you selected, the **Atlas will detect tacks or gybes and display how many meters were lost (or maybe gained, for those with a really good roll tack) after the maneuver is completed**."

→ 이 단일 문단이 회전 손실 메서드에 관해 공개된 *모든* 정보. 추출 가능한 사실:

1. **출력 = 미터 단위 거리** ("display how many meters were lost"). Njord 와 같은 단위 (m). 거리 *손실* 부호 — 음수도 가능 ("or maybe gained" — roll tack 으로 거리를 *벌었을* 때).
2. **사용자 조정 가능한 time window** — "Configure the time window to include enough time for acceleration at the end of a tack or gybe":
   - **윈도 길이가 사용자 파라미터** (Njord 의 20 sec 하드코드 default 와 대조적).
   - **윈도 의미 = "end of a tack/gybe + acceleration phase"** — *회전 종료 후* 의 가속 구간을 포함.
   - Njord 의 5단 구조 (`[Before]→[Exclude]→[maneuver]→[Exclude]→[After]`) vs Vakaros 는 더 단순한 **2단** (회전 시작 → 회전 후 가속 종료) — *추정*.
3. **트리거 = 사용자가 해당 페이지 보고 있을 때만** — "Whenever you're on the page you selected". UX 결정 — *opt-in training mode*.
4. **풍향 입력 = inferred 또는 measured (wind sensor)** — 회전 손실 산출은 *TWD reference 위에서* 정의 — 단순 GPS 변위가 아닌 **TWD 에 투영된 거리**.
5. **즉시 출력 = LED + 숫자** — "the LED array will light up Green if the maneuver is above average within your current session, red if it is below, and **purple when you achieve a new personal best**":
   - **세션 내 평균 갱신** — 동적 baseline.
   - **PB (personal best) 추적** — 펌웨어 안에 세션 누적 통계.
   - **3색 LED** (green/red/purple) — Olympic 트레이닝 컨텍스트의 인지 부담 최소화 UI.

**Vakaros 회전 손실 수식 reverse-engineer (Njord §4 displacement 방식 A 와의 비교).**

블로그는 수식을 적지 않았다. 그러나 다음 4개 사실 — (a) 단위가 미터, (b) "lost or gained", (c) TWD reference 캡처, (d) 측정은 회전 종료 후 acceleration phase 까지 — 의 결합은 **다음 displacement-based 수식과 유일하게 정합**:

```
loss_m = D_no_maneuver - D_actual

  where:
    D_no_maneuver = (boat speed averaged over window) × (window time)
                     × cos(target TWA)
                   ≈ "expected VMG progress if no tack/gybe occurred"

    D_actual = projection onto reference TWD direction of:
               (position at end of window) - (position at start of window)
```

이는 displacement 기반 (Njord 의 방식 A), GPS 좌표만 있으면 풍향 reference 위에서 풀린다. **이 수식이 Vakaros 의 공식 진술이라는 증거는 없다** — 정황 추론. 단 위 4개 사실의 결합은 다른 방식과 정합하지 않는다 — heading-rate 기반 instantaneous-VMG 적분은 *짧은* 가속 윈도 안에서 통계적 의미 약함, IMU-yaw 적분은 누적 drift 때문에 m 단위 안정적 출력 불가.

**Njord 의 dual approach (displacement vs instantaneous-VMG) 와 비교.** Njord 는 **두 방식 모두 출력**, "i" 툴팁으로 정직성 보강. Vakaros 는 **단일 출력 + LED 색 + PB 추적** — *real-time 인지 단순화* 가 가치 명제. 두 SW 의 가치 명제가 회전 손실 출력 방식에서도 일관.

**TWD reference 가 잘못 캡처되면? — 솔직한 진술.**
- Atlas 2 의 `Reference angles` 는 *사용자가 라인업 단계에서 수동 캡처*.
- 풍축이 세션 중 시프트되면 reference 가 stale 됨.
- 사용자가 풍축 시프트를 인지하면 `Run shift tracking` *재실행*.
- 자동 재캡처 메서드 (공개 출처 미확인).

**SailTechCo 함의 — 가장 큰 학습 포인트.**
1. **`time window 가 사용자 파라미터` UX** 차용 가치 — 윙포일과 키일보트 회전 가속 phase 길이 본질 차이, 같은 윙포일러도 light wind ↔ strong wind 가속 시간 다름.
2. **`PB tracking + 세션 평균 baseline + 3색 LED`** — 옥코치 멘트 + 모바일 화면에서 색·icon·micro-animation 으로 같은 효과.
3. **`opt-in training mode`** 패턴 — 일상 세션 분석 노이즈 회피 토글.
4. **단일 displacement 출력 vs Njord dual** — SailTechCo Phase 1 은 *Vakaros 식 단일 출력으로 시작* 후 Phase 2+ 에서 Njord 식 dual 확장 권고. displacement 4초 윈도 약점은 *윙포일 회전 자체가 짧기 때문* — 의도된 설계 차이.

**GPS 정확도 주장 vs 사용자 실측 — Sailing Anarchy 추론.**
- 결정적: **Atlas 2 단독으로 1cm 는 처음부터 주장된 적이 없다**. Vakaros 공식 product page 정확한 표현:
  - "**Unprecedented 25 cm positional accuracy**" (Atlas 2 의 멀티-콘스텔레이션 L1+L5 GNSS *post-processed* 한계)
  - "**Real-Time Differential GNSS positioning when using RaceSense**" — 25 cm 는 RaceSense 네트워크 안에서만.
  - "1 centimeter horizontal positional accuracy" 는 **Atlas HALO RTK 의 별도 product page** 안에서만 등장.
- 즉 **"1cm 주장이 거짓이다" 라는 Sailing Anarchy 비판은 일부 마케팅 오독**. 단 *수치 정직성* 의 한 사례로 SailTechCo 가 반면교사로 가져갈 학습.

#### §5. 통계 패널 / 디스플레이 위젯 빌더 — "10억+ 레이아웃" 의 사실 확인

[Atlas 2 product page](https://www.vakaros.com/products/atlas-2) 의 layout builder 섹션:
> "**CUSTOMIZE YOUR UI** — Build any combination of widgets using our Layout Builder to fully customize your Atlas 2 experience"

→ **"10억+" 라는 구체 수치는 공식 product page 에 없다**. Connect 앱 App Store 메타데이터에도 없음. 본 deep-dive 가 추가로 fetch 한 어떤 페이지에도 "billion" / "10억" / 위젯 조합 수 명시 없음.

→ **master audit §A1 카드의 "10억+" 주장은 공개 출처 미확인 — 격하 또는 출처 보강 권고.** 가능성 (a) 마케팅 이벤트 발언, (b) 사용자 fora 비공식 추정. **Danny 측 원자료 재확인 필요**.

**위젯 빌더의 *실제* 알려진 사실 — Connect 앱 changelog 기반.**
- **v1.13.7 (2025-03-25)**: "Support for Max Speed widgets · Support for metric depth widgets" — Sailmon MAX 인수(2025-03-13) 직후 추가. *Sailmon 자산 일부가 Vakaros 위젯으로 통합되기 시작했다는 첫 공개 신호*.
- **v1.14.0 (2025-05-05)**: "Support for NavLink Blue NMEA Bridges" — 외부 NMEA 2000 위젯 입력 확장.
- 14개월간 (2024-12 ~ 2026-05) 24개 버전 — **약 3주에 1버전 cadence**.

**위젯 종류 — 공식 product page + blog 종합:** Position · Velocity · Heading · Heel · Pitch (core) · Distance-to-line · Time-to-line · Time-to-burn · Countdown timer (starting) · Shift tracking · Stripchart · VMG · Tack/Gybe Loss (training) · Max Speed · Depth (post-2025-03) · Wind (with paired sensor) → 대략 **15–20 위젯 종류**.

**4.4-inch 디스플레이의 실제 표시 능력.** Atlas 2 specs: "Digits up to 90 mm height (landscape), 40 mm height (2 metrics, portrait mode)". → **한 화면당 1~4 metric 이 실용적**. "layout builder" 의 가치는 *조합 수 자체가 아니라 layout 별 page 전환의 유연성*.

**SailTechCo 함의.**
- 출처 미확인 "10억+" 격하 권고.
- **page 시스템** 차용: SailTechCo 모바일 대시보드도 *연습 모드 · 스타트 모드 · 리뷰 모드* 의 page 컨셉. swipe gesture 자연스러운 매핑.
- **opt-in training widget** 패턴 차용.

#### §6. 리플레이 시각 언어 — Connect 앱 + Vantage Sailing + SailFrames

**Vakaros Connect 앱의 리플레이 — 공식 확인.**

[Vakaros Connect App Store](https://apps.apple.com/us/app/vakaros-connect/id1481223437) description 전체:
> "Vakaros Connect allows you to configure and update your Vakaros wireless products right from your iPhone!"

→ **앱의 *primary* 가치 명제 = "configure + update"**. 분석/리플레이는 부수적.

Version history 의 관련 변경:
- **v1.13.3 (2024-12-14): "Replaced the map tile provider"** — 지도 타일 변경.
- **v1.14.6 (2025-07-01): "changes to session map"** — session map UI 개선.

→ **Connect 앱은 리플레이 분석 SW 가 아니다**. 텔레메트리 다운로드, 위젯 설정, 펌웨어 업데이트, RaceSense pass 관리, 단순 session map. *Njord Player 와 비교할 영역이 아님*.

**post-race 분석은 외부 도구.** Practical Sailor 리뷰 [George Lee Rush 인용](https://www.practical-sailor.com/marine-electronics/vakaros-atlas-2-sailing-instrument-profile/):
> "You literally just upload your data to your phone from the Vakaros and then download that to a file, which you plug into the [Vantage app](https://www.vantage-sailing.com/). It gives you all your stats, like your speed and your VMG. It calculates an expected wind angle, analyzes your maneuvers, and it just does it all for you."

→ **Atlas 2 → Connect 앱 → Vantage Sailing** 이 *공식 권장 후속 분석 워크플로*. Vantage Sailing 자체는 별도 사업체 (Norwegian sailor Nicolai Jacobsen) — Vakaros 와는 *별개 회사이나 호환 파트너*.

**기존 §A1 카드 검증 + 보강:**
- Atlas 2 의 내부 저장 = "**256 MB integrated storage, 100+ hours, depending on logging rate**" ([공식 specs](https://www.vakaros.com/products/atlas-2))
- 로깅 rate = **2, 5, or 10Hz 사용자 선택**.
- v1.14.11 (2025-11-04) "fixed bug where share menu wouldn't appear when exporting sessions" — **공유 기능은 OS share menu 기반** (iOS native share sheet). 별도 web link 공유 인프라 *아님*.

**SailTechCo 함의.**
- **Vakaros 의 리플레이 시각 언어 부재 = SailTechCo 의 명확한 차별화 영역**. Njord Player 와 ChartedSails 가 표준이고, 윙포일에 특화된 시각 언어 (윙 사이즈 색 코딩, 보드 cant overlay, foil ride height strip chart) 는 **공개된 어디에도 없다** — SailTechCo 가 첫 진입자.
- **2/5/10 Hz 로깅 옵션** 차용: 사용자 토글로 절전 모드 vs 정밀 모드 옵션.
- **iOS share sheet 기반 공유** = 모바일 native 마찰 0.

#### §7. 가격·구독·사용자 base·Sailmon 인수 후 운영

**현재 가격 (2026-05-27 직접 fetch):**

| SKU | 가격 (USD) | 출처 |
|---|---|---|
| Atlas 2 | **$1,249** (인상 — 기존 audit $1,199) | [product page Shopify JSON, vk-atlas2, price 124900](https://www.vakaros.com/products/atlas-2) |
| RaceSense Annual Pass | **$149/년/디바이스** | [공식 product page](https://www.vakaros.com/products/racesense-annual-pass) |
| Atlas HALO RTK | **$599** (PREORDER) | [공식 product page](https://www.vakaros.com/products/atlas-halo-rtk) |
| Atlas Edge | 별도 제품 | [Atlas Edge](https://www.vakaros.com/products/atlas-edge) |

**RaceSense 구독 모델 핵심:**
- **디바이스에 등록** (one device per pass). 디바이스 간 양도 불가, 디바이스 자체는 양도 가능.
- 활성화 = "수동 등록 절차" (자동화 안 됨).
- **365 days unlimited use**.
- 비교: **Atlas 2 본체 $1,249 + 첫해 RaceSense $149 = $1,398 진입가**.

**RaceSense 의 시장 침투 — 공식 통계** ([RaceSense 페이지](https://www.vakaros.com/pages/racesense) 2026-05-27):
> "**85+ Classes** · **150K+ Start line calls** · **> 99.5% Accuracy**"

→ 기존 audit 의 "50,000+ start line determinations" ([Sailmon 인수 발표](https://www.vakaros.com/blogs/news/vakaros-acquires-sailmon) 2025-03-13) → **2025-03 의 50K 가 2026-05 에 150K 로 3배 증가** — **약 14개월간 100K start 추가** — 가속하는 채택. 활성 클래스: ILCA, 49er, Melges 24, Etchells, WASZP, Dragon, Star, J/70, M32 — Olympic + GP 1-design.

**Atlas HALO RTK (2025-03 출시 preorder):**
- **별도 외장 RTK 센서 ($599)**. Atlas 2/Edge 와 mesh network 동기.
- **1cm horizontal positional accuracy** — 진정한 RTK (carrier phase correction).
- **America's Cup LiveLine 모델 + 비용 절감** ("RaceSense was inspired by and closely modeled on the America's Cup LiveLine system").
- **B2B (이벤트 organizers + class associations) 모델** — Atlas 2/Edge 는 B2C + 클럽 racer.

**Sailmon 인수 — 공식 발표 직접 인용** ([2025-03-13](https://www.vakaros.com/blogs/news/vakaros-acquires-sailmon)):
1. **인수 대상**: "Sailmon Instruments" — **MAX 라인**.
2. **인수 주체**: Vakaros, **from North Technology Group (NTG)**.
3. **고객 지원 승계**: "Under Vakaros, Sailmon's existing MAX customers will continue to receive the same world-class customer support".
4. **ELEMENT 라인 별도**: "North Technology Group will continue to support all Sailmon ELEMENT products under **Synapse, a Future Fibres brand**."
5. **NTG 의도**: "elevate the Sailmon brand and use data to drive sailing forward".

→ **Sailmon MAX 의 Vakaros 산하 통합 로드맵 *구체적 진술 없음***. "고객 지원 승계" 가 약속의 전부 — *제품 라인의 통합/병합/단종 일정은 공개되지 않음*.

**Connect 앱 changelog 가 보여주는 통합 진행:**
- **2025-03-13 인수 발표**
- **v1.13.7 (2025-03-25, 인수 12일 후)**: "Support for Max Speed widgets · Support for metric depth widgets" — **Sailmon MAX 사용자가 익숙한 widget 유형이 Vakaros Connect 에 흡수**.

→ 인수 후 **12일 만에 widget 흡수 첫 신호**. *제품 통합 속도가 매우 빠르다* 는 정황.

**팀 규모.** 기존 §A1 카드의 "Seattle, WA, 2018년 Jake Keilman·Todd Wilson 창업" 추가 확인 — Practical Sailor 직접 인용: "Founded in 2018 by Todd Wilson and Jake Keilman, two **catamaran sailors from Atlanta**, the pair worked together to bring the Atlas instrument to life." → **본사 시애틀, 창업자는 애틀랜타 캐터마란 세일러 출신**.

**한국 시장 가용성 — 솔직한 진술:**
- [Dealers page](https://www.vakaros.com/pages/dealers) = Shopify Store Locator widget (JS 렌더). **한국 dealer 존재 여부 공개 fetch 로 확인 불가**.
- 외부 검색 → **한국 dealer 매칭 결과 없음**.
- 통화 selector — 한국 원(KRW) 옵션 없음, "South Korea (USD $)" 만 — **USD 청구**.
- Vakaros Connect 앱 — **언어 = English 단일**. 한국어 미지원.
- 한국어 manual, 한국어 community, 한국어 ambassador — 공식 사이트에 **없음**.

→ **한국 윙포일/딩기 racing 커뮤니티에서 Vakaros 진입 = 사실상 zero**.

**SailTechCo 함의:**
- **한국어 UI 100% + 원화 결제** 는 단순 차별화가 아니라 *시장 진입 자체*.
- **150K+ start calls / 85+ classes** = Vakaros 의 누적 차지. SailTechCo 가 따라잡을 수 없는 *역사적 자산*. **윙포일 freeride 1인 시장에서는 0부터 시작** — moat 는 sailing class 가 아니라 *spot (한강·여수·강릉) + 한국어 코칭 톤* 위에서.
- **RaceSense $149/년 구독 모델** = ARR 엔진. SailTechCo Phase 1 (무료) → Phase 2 (pro tier) 의 가격 정당화 모범.
- **HALO RTK 별도 SKU 패턴** = "기본 제품의 정확도 한계를 *덜 정확하다 인정하고 별도 라인업으로 분리*" 라는 *수치 정직성* 학습.

#### §8. SailTechCo 의 함의 — 학습할 것 / 차별화할 것

**(1) 학습할 것:**
- **`Time window 가 사용자 파라미터` UX** (§4): SailTechCo `turnStableWin = 4초` 사용자 설정 가능 확장.
- **`opt-in training mode` 패턴** (§4, §5): 옥코치 멘트 토글의 정확한 모범.
- **`session 내 평균 baseline + PB 추적 + 3색 신호`** (§4): icon + micro-animation + haptic 대체.
- **수치 정직성 = product line 분리** (§7): "추정 신뢰도" 를 FREE tier (낮은 신뢰도 허용) vs PRO tier (외부 wind sensor) 의 가격 dimension 으로.
- **OS share sheet 기반 공유** (§6): 1인 개발에서 인프라 비용 최소화.
- **개발 cadence: 3주 1버전** (§5): 사용자가 "활발하다" 라고 느끼는 임계.

**(2) 차별화할 것:**
- **외부 weather forecast 통합** (§2): Vakaros 의도적 부재 → SailTechCo *spot weather + 분석 = 한 화면*.
- **폴라 학습** (§3): 빈 공간 차지. 단 윙포일 stable polar 가설 검증 필요.
- **리플레이 시각 언어** (§6): Vakaros 외부 파트너 위탁 → SailTechCo 처음부터 분석 + 리플레이 + 코칭 한 곳.
- **윙포일 도메인 특화 위젯** (§5): 키일보트/딩기 중심 vs 윙포일 (foil ride height, 윙 사이즈, board cant, jibe ride-through).
- **한국어 UI + 원화 결제 + 카톡 공유** (§7).
- **소형/모바일/구독 only** (§7): 하드웨어 의존 우회.

**(3) 정직한 결론.**

Vakaros = **Olympic + Grand Prix + 클럽 racing 의 "all-in-one wireless instrument" 시장 표준**. 시애틀 본사, 2018년 창업 후 8년차, 2025-03 Sailmon 인수로 *consolidation 단계 진입*. 매출 = 하드웨어 ($1,249) + 구독 ($149/년) + B2B RTK ($599+ HALO). 누적 150K+ start line calls, 85+ classes.

SailTechCo 의 게임은 **Vakaros 와 정면 충돌하지 않는다**:
- **시장**: Vakaros = 키일보트·딩기 racing, SailTechCo = 윙포일 freeride.
- **하드웨어 의존**: Vakaros 필수, SailTechCo 모바일 only.
- **시장 진입**: Vakaros 영어/USD/dealers, SailTechCo 한국어/원/카톡.
- **알고리즘 깊이**: Vakaros *real-time 단순화*, SailTechCo *post-session 깊이*.

가장 큰 신호 — **Vakaros 가 공개 블로그를 가졌음에도 알고리즘 수식은 0건이다** (§1, §4). Njord 와 동일한 패턴. *알고리즘 자체가 IP 가치의 핵심이 아니라* 시장 신뢰 + 운영 + 누적 데이터셋의 결합이 가치. **SailTechCo 가 따라잡을 수 없는 것은 알고리즘이 아니라 시장 신뢰·운영이고, 윙포일 freeride 1인 시장에서는 처음부터 다시 짜는 게임이다**.

**부록 — 본 deep-dive 의 추가 출처:**

- 핵심 블로그: [VMG and Tack Loss: New Training Tools (blog.vakaros.com)](https://blog.vakaros.com/vmgtackloss)
- 제품 페이지: [Atlas 2 ($1,249)](https://www.vakaros.com/products/atlas-2) · [RaceSense Annual Pass ($149/yr)](https://www.vakaros.com/products/racesense-annual-pass) · [Atlas HALO RTK ($599)](https://www.vakaros.com/products/atlas-halo-rtk) · [Atlas Edge](https://www.vakaros.com/products/atlas-edge) · [Wind sensors](https://www.vakaros.com/collections/wind-sensing)
- 회사 운영: [Sailmon 인수 발표 (2025-03-13)](https://www.vakaros.com/blogs/news/vakaros-acquires-sailmon) · [RaceSense (150K+ start calls)](https://www.vakaros.com/pages/racesense) · [Dealers](https://www.vakaros.com/pages/dealers)
- 외부 리뷰: [Practical Sailor 2025-04-21 (Kathy Young)](https://www.practical-sailor.com/marine-electronics/vakaros-atlas-2-sailing-instrument-profile/) · [Vantage Sailing 파트너](https://www.vantage-sailing.com/)
- 컴패니언 앱: [Vakaros Connect App Store (24 versions, English-only, 8 reviews 5.0)](https://apps.apple.com/us/app/vakaros-connect/id1481223437)
- Sailing Anarchy: [vakaros.250212](https://forums.sailinganarchy.com/threads/vakaros.250212/) · [vakaros.206533](https://forums.sailinganarchy.com/threads/vakaros.206533/)
- 회사 정보: Founders = Todd Wilson · Jake Keilman (Atlanta catamaran sailors); HQ = Seattle, WA; Founded 2018; Director of Marketing = Doug Wake.

---

**문서 정정 권고 (master audit §A1 카드):**
- "$1,199" → **$1,249** 로 수정 (가격 인상 확인)
- "위젯 빌더(10억+ 레이아웃)" 부분 — **공개 출처 미확인 → 격하 또는 출처 보강** 필요
