#### C4-Deep. Waterspeed — Tier 0 심층 audit (Danny 7-axis, 본인 benchmark + 윙포일 커뮤니티 표준)

#### §0. 본 deep-dive 의 위치

master audit §C4 카드를 **대체하지 않고 확장**. Danny 본인 사용 + 윙포일 커뮤니티 표준 이라는 dual 위치 때문에 본 deep-dive 의 산출은 SailTechCo 윙포일 wedge 의 직접 입력이다. 모든 새 정보는 2026-05-27 추가 웹리서치 ([waterspeedapp.com](https://www.waterspeedapp.com/), 공식 blog `/blog/waterspeed-ultra`·`/how-to-track-tacks-and-gybes-in-waterspeed`·`/northstar-hits-1013-kmh-captured-on-waterspeed`, App Store iOS 직접 fetch + KR locale 분리, integrations 페이지 6 종 (Garmin / Apple Watch / Wear OS / Coros / Vakaros / Suunto), foiling.ca 리뷰) 에서. **공개 문서가 침묵하는 지점은 "(공개 출처 미확인)"**.

**본 deep-dive 가 새로 밝히는 8가지 핵심 사실:**

1. **3-tier 구조는 2025년 12월 17일 "Ultra" 도입으로 정식화** — Ultra tier 는 master audit 작성 시점에는 존재하지 않았다 ([waterspeedapp.com/blog/waterspeed-ultra](https://www.waterspeedapp.com/blog/waterspeed-ultra), Matt Sproson, 2025-12-17). Ultra 가 처음으로 **VMG / Polar Chart / Performance vs Target Speeds / Gain·Loss Analysis / Legs & Runs / True Wind Angle** 를 Waterspeed 안에 가져온 사건 — **Waterspeed 가 wingfoil freeride app 에서 sailing analytics app 으로 정체성 전환을 시도하는 변곡점**.

2. **회사 등기는 Dubai International Financial Centre (DIFC)** — UK·Cyprus 가 아님. 정확한 등기 주소: `Unit GV-00-10-07-OF-02, Level 7, Gate Village Building 10, Dubai International Financial Centre, Dubai, UAE`. DIFC 는 영국 common law 기반 free zone. CEO = **Costantino Spagnoletti** ([NorthStar SailGP 페이지](https://www.waterspeedapp.com/northstar-sailgp) verbatim quote).

3. **iOS App Store 평점 4.6/5, 1.1K ratings** — master audit 의 "4.7/5" 는 약간 오차. 1.1K ratings = 약 7년 운영 앱치고 *결코 큰 숫자가 아니다* — 비교: Strava iOS = 수십만. 평점은 높지만 review-mass 는 niche.

4. **공식 자랑 KPI = 390K downloads / 730K activities / 100K yearly active users / 200 countries** ([waterspeedapp.com](https://www.waterspeedapp.com/) 직접 fetch). 100K yearly active = 글로벌 watersports app 의 de facto leader 정체성 정당화하는 critical mass. *self-reported, third-party 감사 없음*.

5. **NorthStar SailGP Team "Official Technology Supplier"** — 2026 SailGP Season 6 부터 Mubadala Abu Dhabi Sail Grand Prix 에서 NorthStar F50 에 Waterspeed 로고 게재 ([northstar-sailgp 페이지](https://www.waterspeedapp.com/northstar-sailgp)). NorthStar Wing Trimmer Paul Campbell-James ('CJ') 가 Waterspeed 기록 **F50 in-race top speed 101.3 km/h** ([blog/northstar-hits-1013-kmh-captured-on-waterspeed](https://www.waterspeedapp.com/blog/northstar-hits-1013-kmh-captured-on-waterspeed), 2026-02-27). **레이스용 인스트루먼트로서의 marketing 영토 진출 사건**.

6. **Vakaros × Waterspeed 통합 (2025-11-18 launch)** — 단 manual VKX export → web 임포트 흐름, iOS 미지원 (Android·Web only) ([integrations/vakaros](https://www.waterspeedapp.com/integrations/vakaros)). Vakaros 의 25Hz dual-band GNSS raw 데이터가 Waterspeed 분석 엔진 안에서 처리되는 *uplift* path 생성 — Cluster A 의 Vakaros 가 Cluster C 의 Waterspeed 에 자사 데이터 위탁하는 *수직 위계 inversion*. **분석 IP 의 무게중심이 Vakaros 의 자체 cloud 가 아니라 Waterspeed 로 이동했다는 신호**.

7. **Wear OS 정식 지원 (2025 도입, OS 3.0+)** ([integrations/wear-os](https://www.waterspeedapp.com/integrations/wear-os)). 안드로이드 사용자는 phone 없이 Wear OS 시계 단독 기록 가능. Wear OS app 화면 set 은 iOS Apple Watch app 보다 단순.

8. **한국어 UI 미지원** ([apps.apple.com/us/app/...?l=ko](https://apps.apple.com/us/app/waterspeed-track-watersports/id1234093389?l=ko) 메타데이터 "언어: 독일어, 스페인어, 영어, 이탈리아어, 프랑스어"). 한국 region 동일 앱 다운로드 가능하나 **인터페이스·앱설명·리뷰 답변·고객지원 모두 영문**. KRW 가격 표기 미확인.

#### §1. 풍향 재구성 / Wind 처리

**3개 분리된 wind 입력 channel:**

**(a) Forecast 자동 fetch** — App Store description verbatim: *"PLAN BETTER SESSIONS. Know when and where to go. Use integrated wind, weather, and tide forecasts."* + *"Wind history & spot conditions (Explore+)"* ([App Store iOS](https://apps.apple.com/us/app/waterspeed-track-watersports/id1234093389)). Pro tier 가 *"Wind history & spot conditions"* unlock. 세션 시작 *전* forecast 는 자동 fetch. 데이터 source 는 공개 출처 미확인 (블로그·docs 어디에도 weather provider 명시 없음 — *추정*: Open-Meteo·Stormglass·NOAA·Windy API 중 하나, *공식 confirm 없음*).

**(b) Ultra tier 의 "Set or pull in from the forecast"** — Ultra blog verbatim: *"Ultra introduces True Wind Angle analysis based on the wind direction you set or pull in from the forecast, rather than just your heading"* ([blog/waterspeed-ultra](https://www.waterspeedapp.com/blog/waterspeed-ultra), 2025-12-17). **TWD 입력은 (1) 사용자 수동 입력 또는 (2) forecast API 의 풍향 값을 가져옴** — 두 모드 중 하나. **GPS 회전 기하 기반 inferred TWD 메서드 (Njord·Vakaros 채택) 는 명시되지 않음**. Waterspeed 의 wind 정확도가 *forecast 의 정확도에 직결* — local mesoscale·gust·shift 는 잡지 못한다.

**(c) Tack & Gybe 자동감지 메서드는 GPS만 사용** — *"Waterspeed uses GPS direction, speed, and heading changes to automatically identify when you change course through the wind"* ([blog/how-to-track-tacks-and-gybes-in-waterspeed](https://www.waterspeedapp.com/blog/how-to-track-tacks-and-gybes-in-waterspeed), 2026-01-19, Matt Sproson). **IMU·자이로·자기 센서 언급 없음** — phone GPS course-over-ground 의 변화만으로 분류. 이는 §4 의 윈드포일 tack/jibe 라벨 역전 버그의 직접적 원인 가설을 뒷받침.

**솔직한 평가.** Vakaros 의 *"angles 모드 + reference 헤딩 캡처"*, Njord 의 *"maneuver geometry 다회전 추정"*, SAP 의 *"코스 주변 anemometer 직접 측정"*, Garmin 의 *"port/stbd COG 평균"* 과 비교하면 — **Waterspeed 는 GPS-only 의 가장 단순한 inference 만 가진다**. TWD 자체는 추론하지 않고 forecast/사용자 입력에 의존. *공개 출처 미확인*: smoothing window, course change threshold, upwind/downwind 분류 기준.

#### §2. 외부 날씨 데이터 통합

**(a) Pre-session forecast (Explore+)** — Pro tier 의 핵심 가치 proposition. Home 페이지: *"aggregated community data that recommends the best times and conditions to get on the water"* — **forecast + crowdsourced historical 사용자 활동 데이터의 mash-up**. PredictWind·Windy 처럼 forecast 만 보여주는 것이 아니라, *"여기에서 다른 사람들이 이런 조건에 언제 나왔는가"* 를 layer 추가.

**(b) Per-session metadata** — 세션 종료 후 풍속·풍향·온도 메타데이터가 자동 활동 카드에 attach (App Store 리뷰 'nuebar' 2021-05-20). 데이터 source 공개 출처 미확인.

**(c) Ultra: forecast-derived TWD overlay** — Ultra tier 에서 forecast 풍향이 TWA 분석의 *axis 기준*. *"This provides a stable reference for tactical analysis — helping explain why performance shifts from one run to the next"* ([blog/waterspeed-ultra](https://www.waterspeedapp.com/blog/waterspeed-ultra)).

**결정적 갭.** Waterspeed 는 **실측 풍속·풍향 hardware 통합 부재**. Vakaros Calypso·SAP 코스 anemometer·B&G/NKE mast-top wind 같은 *on-water measured* TWD/TWS 채널 없음. Wing-foil 의 경우 사용자 본인이 곧 풍센서이므로 freeride 시장에선 critical 아니지만, 정식 racing 에서는 *forecast 풍향 = ±30° 오차 가능* fundamental limitation.

**Tide/Current** — App Store: *"wind, weather, and **tide** forecasts"*. Tide chart 자동 첨부 확인. Current/조류 vector overlay 공개 출처 미확인.

#### §3. 폴라 / target 곡선 — Ultra tier 의 핵심 (2025-12-17 launch)

**master audit 의 "alpha speed 500m 더블 트랙" 진술은 공개 출처에서 직접 confirm 안됨.** Waterspeed 공식 자료 어디에도 "alpha speed" 또는 "500m double track" 표현이 *명시적으로 나오지 않는다*. 가장 가까운 공식 표현 (App Store iOS description): *"Best speed splits"*. App Store 사용자 리뷰 ('Bad Dolphin' 2025-04-12) 알려주는 split 종류:
- "highest speed pinned on it exactly down to the second"
- "average speed"
- "peak 2 second speed"
- "highest sustained 10 second speed"

→ **공식 confirm 된 best-speed splits = peak 2s, sustained 10s, plus session avg/max**. 500m 더블 트랙 GPS-Speedsurfing 표준 (alpha α 500) 은 *"Sync and share with GPS-Speedsurfing.com"* 라는 *외부 platform 위탁*. **alpha 500 native 계산 있는지 — 공개 출처 미확인**. Master audit 의 "alpha speed (500m 더블 트랙)" 진술은 추정 격하 권고.

**Ultra tier 의 폴라 — 2025-12-17 신규.** Ultra blog verbatim:

> "Ultra introduces Polar Charts that visualize how your performance varies across wind angles and speeds in one overview. Polars help you understand your personal or setup-specific performance envelope, identify strong and weak angles, and track improvement as technique or equipment changes."

→ **개념 = 사용자 personal performance envelope** (cf. theoretical hull polar). Njord 의 *"learned polar from your own GPS tracks"* 패러다임과 동일. 알고리즘 수식 공개 출처 미확인. *추정* (NOT confirmed): TWA × Boat Speed 의 2D 히스토그램에 percentile envelope 를 fit — Njord/Vantage 의 표준 메서드.

> "Performance vs Target Speeds — With Ultra, you can measure your actual performance against target or expected speeds instead of relying on gut feel."

→ "target speed" 의 origin (사용자 입력? class polar? forecast 기반?) 공개 출처 미확인. **Vakaros 와 동일한 IP 보호 패턴**.

**Legs & Runs — 새로운 segmentation:**
> "Ultra breaks your session into clearly defined upwind and downwind legs, allowing you to analyze performance segment by segment rather than relying on a single session average."

→ Vantage·Vakaros 의 legs-and-runs 표준에 합류. *공개 출처 미확인*: leg 분리 기준 (heading change threshold? wind axis crossing?).

**핵심 함의.** Waterspeed Ultra 는 **2025-12-17 부터 sailing analytics 시장에 정식 진입**. 그러나 Ultra 의 폴라·target·VMG 알고리즘은 *Pro tier 이하 사용자에게는 비가시* — Free/Pro 사용자 (대다수) 경험에서는 여전히 *speed-distance tracker* 정체성. **Danny 가 현재 쓰는 tier 가 무엇인지가 Waterspeed 실제 분석 깊이 evaluation 의 분수령**.

#### §4. 회전 손실 측정 — 윈드포일 tack/jibe 라벨 역전 버그 추적

**§4 가 본 deep-dive 의 핵심 axis.**

**(a) 공식 메서드 진술 — 본격적 reverse-engineer 입력값.** Blog [/how-to-track-tacks-and-gybes-in-waterspeed](https://www.waterspeedapp.com/blog/how-to-track-tacks-and-gybes-in-waterspeed) (2026-01-19, Matt Sproson) verbatim:

> "**Tack**: Turning the bow through the wind (upwind turn)  
> **Gybe**: Turning the stern through the wind (downwind turn)"

→ **공식 정의 = 정통 sailing 정의**.

> "Waterspeed uses GPS direction, speed, and heading changes to automatically identify when you change course through the wind. That means: No manual tagging · No button presses mid-session · No guessing afterward."

→ **감지 sensor = GPS 만**. IMU 언급 없음.

**(b) 버그 가설 — 알고리즘 로직 reverse-engineer.**

윈드포일 tack/jibe 분류는 *근본적으로 "보트가 풍축에서 어느 쪽에 있었는가"* 의 결정에 의존. 의사코드:

```
1. detect heading change (dHDG > threshold over dT)
2. determine pre-turn point of sail (upwind / downwind)
   = compare pre-turn COG vs assumed wind direction
3. if pre-turn upwind  AND post-turn upwind  → TACK
   if pre-turn downwind AND post-turn downwind → GYBE
```

**Step 2 의 *"assumed wind direction"* 이 critical 분기.** Free/Pro tier 에서 forecast 풍향 fetch 또는 사용자 입력 풍향이 없을 수 있음 — fallback 으로 *세션의 두 dominant heading 의 angle bisector* 또는 *세션 평균 heading 직각* 으로 풍축 *추정* (공개 출처 미확인 — 표준 휴리스틱).

**윈드포일 라벨 역전 가설적 메커니즘:**

- **윈드서핑·세일링** *upwind* = sailer COG 가 풍원점에 *접근*. heading 변화 + 풍축 분류 정상.
- **윈드포일** freeride = 사용자가 *down-the-line* long broad reach 반복 (cross-shore broad reach × 2). 두 dominant heading 모두 *downwind 측*, angle bisector 가 *upwind 축* 으로 잘못 산출 가능. → 결과: 실제 **gybe** 인 회전이 **tack** 라벨 (post-turn point-of-sail 분류 inverted).
- 추가 가설: **윈드포일 보드 진행방향 ≠ 보드 점프/터닝 중 GPS course-over-ground**. tack/jibe transient 구간에서 GPS COG 가 보드 nose 와 무관하게 lateral drift → state machine pre/post turn heading 추정이 흔들림.

**(c) 버그 보고 reproducibility.** Master audit 의 인용 ("tacks and jibes are backward for wind foil") 의 정확한 출처 URL — Seabreeze 윙포일 forum — 본 deep-dive 시도 시 직접 fetch 성공 못함. **본 deep-dive 는 master audit 인용을 1차 source 로 직접 verify 못함** — Danny 측 원자료 스크린샷 재확인 권고. 단 알고리즘 reverse-engineer 는 *"GPS direction, speed, heading changes 만 사용"* 공식 진술과 일관 — 라벨 역전 버그는 알고리즘적으로 *가능*, *기댓값*에 부합.

**(d) 공식 진술의 함정 — "direction" vs "heading".**

GPS 가 직접 측정하는 것은 *course over ground (CoG)*. *Heading* 은 보트 nose 가 가리키는 방향 — 별도 IMU·자기 센서 필요. **Phone GPS standalone 으로는 heading 을 직접 측정 못 한다 — 단지 CoG 만 측정** (phone IMU 자기계 보조 시 phone-orientation heading 가능, 그러나 wingfoil 에서 phone 은 보드 위가 아님). **실제 알고리즘 입력은 거의 확실히 CoG 만**, blog 의 "heading" 표현은 *casual* 동의어 — 공개 출처 미확인, 단 강한 추정.

**(e) 가능한 fix 방향 (SailTechCo wedge).**
- Apple Watch *Core Motion* IMU (자이로·자기) 로 실제 board heading 별도 채널 캡처 → CoG 대비 leeway/side-slip 직접 측정
- 회전 *전후* pre-turn dominant heading window 를 *5–10초 평균* 으로 extend
- *사용자 측 풍향 1회 캡처* (라인업 모드) 옵션 노출 → Vakaros 의 "angles" reference 헤딩 캡처 동등
- 윈드포일 사용자가 *수동 라벨 flip* 가능한 UI affordance — current Waterspeed *"No manual tagging"* 자랑은 자동화 우선이고 *manual override 부재* 가 약점.

**메서드 명명 vs 수식 — 정직한 격차.** Waterspeed 는 *"GPS, speed, heading changes"* 변수만 명명, *threshold·window·state machine* 수치 비공개. Vakaros·Njord 동일 IP 보호 패턴.

#### §5. 통계 패널 / 통계 카드 — 세션 종료 후 시각 언어

**Free/Pro tier — Activity Details 화면 (tack/gybe blog 스크린샷):**
- 상단: 큰 폰트 *Best Speeds* (peak / 2s / 10s split)
- 중단: GPS 트랙 + speed-color heatmap (*"speed 기반 히트맵"* confirm)
- 하단: tacks/gybes counter, foiling efficiency, planning time *KPI card* (홈 페이지 *"KPI main 2"* 이미지)
- *"Duration, max speed and splits, tacks and jibes"* 4-KPI grid

**Ultra tier — 신규 시각 화면 ([blog/waterspeed-ultra](https://www.waterspeedapp.com/blog/waterspeed-ultra)):**
- **VMG.png** — 큰 폰트 VMG number + heading vs wind 도식
- **TWA_s-c.png** — True Wind Angle scatter (port/starboard 컬러 분리, 추정)
- **leg & run.jpg** — upwind leg / downwind run timeline strip
- **Polar chart** — radial polar (TWA radial × boat speed distance)
- **Performance vs Target Speed** — bar/gauge

**시각 언어 패밀리:**
1. **Big-number KPI card** — Free/Pro 가장 강한 시각 패턴. Strava 동등.
2. **Speed-color heatmap on GPS track** — Cluster C 표준.
3. **Radial polar (Ultra 신규)** — Cluster A polar diagram 을 Cluster C 화면에 도입.
4. **Scatter (TWA × Speed)** — Ultra polar 와 동거.
5. **Strip timeline (legs & runs)** — Vantage·Vakaros 동등.

**Foiling efficiency** — 홈: *"Measure glide, control, and lift in every foil ride"*. IMU 기반인지 GPS 속도-임계 추정인지 — *공식 출처 미확인*. App Store description *"Foiling efficiency"* 만 명시, 수식 비공개.

**Stroke count (beta)** — 패들/로잉 sport mode 에서 *(beta)* 표기 — *공식적으로 알고리즘 stable 하지 않다고 인정*. 윙포일·sailing 무관.

#### §6. 리플레이 시각 언어 + 라이브 트래킹

**(a) Live Tracking — 명시적 safety 위치.** Apple Watch integration 페이지 verbatim:

> "Share your live position with friends or family directly from your wrist. Perfect for longer downwinders, solo sessions, or offshore training days. Live tracking lets others follow your exact location in real time. Stay visible. Stay safe. Ride with confidence."

→ **포지셔닝 = "performance metric" 이 아니라 "safety feature"**. 가족·친구·코치 가 보는 trackable 링크. Garmin LiveTrack·Strava Beacon 동일 카테고리.

**(b) 공유 정책.** 공식 docs 의 [waterspeed.crunch.help/en/live-tracking](https://waterspeed.crunch.help/en/live-tracking) 직접 fetch 실패. Apple Watch 페이지 진술은 *"Share your live position with friends or family"* 만 — *공개 link vs invite-only 권한 모델* 공개 출처 미확인. 추정: 표준 URL token + 옵션 expiry.

**(c) Replay — NorthStar SailGP 케이스.** [Waterspeed Web App 의 NorthStar 101.3 km/h 세션](https://waterspeedapp.web.app/activity/YhLcjkolA2hFDY7HYM3Z4GXpKMC3/5b22263a-8f68-4a9e-8d94-6270f597d553) 이 공식 *flagship demo*. Blog:

> "Inside the activity, you can see: The exact moment the boat peaked · The speed build-up leading into the run · GPS track replay across the course · Section splits and heatmaps · Performance data that shows how the speed was achieved"

→ Replay 구성: (1) GPS 트랙 line replay (시간 슬라이더), (2) speed-color heatmap, (3) peak moment marker, (4) section splits, (5) performance build-up timeline. **3D 보트 모델·다선 비교·tactical 카메라 angle 부재** — SAP 의 3D Sailing Viewer 또는 Vantage 의 multi-boat replay 같은 *tactical 3D replay* 부재.

**(d) 비디오 동기·overlay — 공식 부재 confirm.** Master audit § C4 의 *"비디오 오버레이 없음"* 약점 재확인. App Store description·blog·integrations 어디에도 "video sync"·"overlay"·"GoPro"·"Insta360" 키워드 없음.

**(e) Web App.** [waterspeedapp.web.app](https://waterspeedapp.web.app/) — desktop browser 로 세션 review·share. NorthStar 케이스 shareable activity URL 이 *publicly readable*.

**(f) Discover/Explore+ feed.** 홈 페이지:

> "Join challenges to push your limits, connect with groups that share your passion, and stay inspired through a feed that highlights the latest sessions, milestones, and leaderboards"

→ **Feed = activity stream + leaderboard + challenges + groups**. Strava social model 의 *수직 watersports 버전*. App Store *"What's New 8.17"*: *"Meet the Waterspeed community! Discover and follow other water sports athletes, explore dedicated user profiles, and send follow requests to private accounts."* (2026-05-20) → **private 프로필 + follow request 권한 모델**. social 그래프 active 발전 중.

#### §7. 가격·구독·사용자 base·운영 (Waterspeed Technologies Limited)

**(a) 가격 — App Store IAP verbatim (2026-05-27 fetch).** 활성 IAP 10종:

| SKU | 가격 (USD) |
|---|---|
| WS Monthly | $2.99 |
| Monthly | $2.99 |
| WS Quarterly | $7.99 |
| Monthly Subscription | $3.99 |
| **Waterspeed PRO Yearly** | **$29.99** |
| WS Yearly | $29.99 |
| Yearly Subscription | $29.99 |
| **Yearly Plan** | **$59.99** |
| **Waterspeed Ultra Monthly** | **$19.99** |
| **Waterspeed Ultra Yearly** | **$199.00** |

→ **3-tier 표준 가격 (2026-05-27)**:
- **Free** — $0
- **Pro** — **$29.99 / year** (또는 $2.99 / month)
- **Ultra** — **$199.00 / year** (또는 $19.99 / month)

→ Pro→Ultra **6.6배 가격 격차** — Ultra 가 정식 sailing 분석 tier 임을 가격으로 신호. Vakaros RaceSense Annual Pass ($149/year) 와 비교 시 Ultra ($199) 가 *software-only* 로 *RaceSense 보다 비싸짐* — software-only sailing analytics 시장 가격 ceiling 진입.

**(b) 사용자 base.** [홈 페이지 self-reported](https://www.waterspeedapp.com/):
- **390K downloads** · **730K activities** · **100K yearly active** · **200 countries**

→ DAU/MAU/yearly ratio: 100K yearly / 390K total = *~26% retention*. Watersports 의 seasonal pattern 고려 시 26% 는 *건강한 수치*. third-party 검증 없음.

**(c) 리뷰·평점.**
- **iOS US:** [App Store](https://apps.apple.com/us/app/waterspeed-track-watersports/id1234093389) — **4.6/5, 1.1K ratings** (2026-05-27)
- **Android:** [AppBrain](https://www.appbrain.com/app/waterspeed-track-watersports/com.waterspeed.waterspeedapp) — 4.47/5, 76 ratings (master audit 인용)
- **Foiling.ca (Goran Bajic·2025-04-11):** *"App tracks and collects key stats with valuable insights about your water sport session... detailed heatmap based on your speed and all the key stats"*

**(d) 회사 정보.**
- **법인:** Waterspeed Technologies Limited
- **등기:** `Unit GV-00-10-07-OF-02, Level 7, Gate Village Building 10, Dubai International Financial Centre, Dubai, UAE`
- **CEO:** Costantino Spagnoletti ([northstar-sailgp](https://www.waterspeedapp.com/northstar-sailgp))
- **PM/콘텐츠:** Matt Sproson (blog 모든 글 author)
- **첫 출시:** 2017–2018 (App Store mk1727 리뷰 2018-06-02 + i-Marine Apps blog 2018-12). 약 8년 운영.
- **헤드카운트·자금:** Crunchbase / PitchBook 직접 verify 못함 — **공개 출처 미확인**. DIFC 등기 + 다중 SKU/locale 운영 규모 → *seed 또는 series A 단계 추정*.

**(e) 멀티-플랫폼 분포:**

| 플랫폼 | 상태 |
|---|---|
| iOS iPhone/iPad | 정식 (iOS 15.0+) |
| Apple Watch | 정식 standalone (watchOS 8.0+) |
| Apple Vision | 정식 (visionOS 1.0+) |
| Android | 정식 |
| **Wear OS** | **정식 (3.0+)** |
| Garmin Connect IQ | 정식 |
| Coros | 정식 |
| Suunto | 정식 sync |
| **Vakaros Atlas / Atlas 2** | **VKX manual, Web+Android, iOS coming soon** |
| Web App | 모든 사용자 무료 |

→ **iOS-Android feature parity 갭**: (1) Vakaros 임포트는 Android·Web 만 (iOS 미지원), (2) Apple Watch standalone 의 *dual-frequency GPS* 는 Ultra 모델 전용. 그 외 핵심 metric 동등.

**(f) Strava + GPS-Speedsurfing sync** — 두 외부 platform push.

**(g) Waterspeed for Business — B2B 진출.** [business.waterspeedapp.com](https://business.waterspeedapp.com/) (홈 메뉴 confirm). 클럽·코치·이벤트 organizer 용 별도 SaaS. Vakaros RaceSense Annual Pass 와 동일 카테고리.

**(h) 한국 시장.**
- App Store KO locale: **언어 = DE/ES/EN/IT/FR — 한국어 부재**
- App Store description, IAP, 리뷰 모두 영문 또는 USD
- 한국 윙포일 커뮤니티 (네이버·인스타·유튜브) 의 Waterspeed 멘션 — 별도 한국어 search 필요
- **시사점:** *한국어 UI 부재 = SailTechCo 1차 진입 wedge*. master audit § 2.C6 진단과 일치.

#### §8. SailTechCo 함의 — Waterspeed 갭의 wedge

**5개 critical 갭:**

1. **윈드포일 tack/jibe 라벨 정확도 (§4)** — GPS-only 분류의 한계. **SailTechCo IMU 기반 board-heading 캡처 + 사용자 풍향 1회 입력 옵션 = 가장 빠른 정확도 우위**. Apple Watch Core Motion API 무료, hardware cost 0.

2. **알고리즘 비공개 + Ultra $199/year ceiling** — Waterspeed 도 수식 비공개. SailTechCo 가 *공개 수식 + 검증 가능 metric + open methodology* 로 차별화. PhD 검수 가능 보고서가 *그 자체로 IP*.

3. **한국어 UI / KRW 가격 부재** — Cluster C 공통 갭. SailTechCo 한국어 1차 UI 진입 장벽 0. KakaoPay·네이버페이 결제 wedge.

4. **비디오 sync overlay 부재** — Waterspeed/Hoolan/Foil Sessions 공통. GoPro 보편화 시점에서 SailTechCo 가 비디오-데이터 sync 제공하면 *iOS 시장 공백*. (Phase 3 wedge).

5. **Waterspeed 분석 정체성 변곡점 (Ultra 2025-12)** — Waterspeed 가 polar·VMG·target 시장 진입 중. **SailTechCo 진입 시점 = "Waterspeed Ultra 가 글로벌 default 가 되기 전"** = 향후 12개월. 늦으면 Ultra 가 *de facto wingfoil VMG 표준*.

**Waterspeed 가 SailTechCo 보다 무조건 강한 영역:**
- 멀티-플랫폼 distribution (iOS+Android+Apple Watch+Wear OS+Garmin CIQ+Coros+Suunto+Vakaros)
- 390K download + 100K yearly active social 그래프
- NorthStar SailGP partnership marketing 자산
- 8년 운영 stability
- GPS-Speedsurfing·Strava 양방향 sync

**전략 한 줄.** SailTechCo 는 *Waterspeed sailor-base 를 directly 빼앗는 전략이 아니라*, **(1) 한국·일본 한국어/일본어 1차 UI + (2) 윈드포일 정확도 (tack/jibe label, leeway, board-heading) + (3) 공개 검증 가능 알고리즘 + (4) Phase 3 비디오-데이터 sync = 4가지 wedge** 로 *Waterspeed 가 못 가는 niche+precision 시장* 진입. Waterspeed 멀티-플랫폼 distribution 은 *우리의 venn 다이어그램 밖*.

#### 부록. 출처 + verify 못한 항목

**핵심 출처:**
- [waterspeedapp.com](https://www.waterspeedapp.com/) (홈, KPI 4종, integrations, footer 등기)
- [waterspeedapp.com/about-us](https://www.waterspeedapp.com/about-us)
- [waterspeedapp.com/integrations](https://www.waterspeedapp.com/integrations) (6 종)
- [integrations/apple-watch](https://www.waterspeedapp.com/integrations/apple-watch), [wear-os](https://www.waterspeedapp.com/integrations/wear-os), [coros](https://www.waterspeedapp.com/integrations/coros), [vakaros](https://www.waterspeedapp.com/integrations/vakaros)
- [blog/waterspeed-ultra](https://www.waterspeedapp.com/blog/waterspeed-ultra) (2025-12-17 Ultra launch)
- [blog/how-to-track-tacks-and-gybes-in-waterspeed](https://www.waterspeedapp.com/blog/how-to-track-tacks-and-gybes-in-waterspeed) (2026-01-19)
- [blog/northstar-hits-1013-kmh](https://www.waterspeedapp.com/blog/northstar-hits-1013-kmh-captured-on-waterspeed) (2026-02-27)
- [northstar-sailgp](https://www.waterspeedapp.com/northstar-sailgp)
- [App Store US](https://apps.apple.com/us/app/waterspeed-track-watersports/id1234093389) (4.6/5, 1.1K, IAP 10종)
- [App Store KO locale](https://apps.apple.com/us/app/waterspeed-track-watersports/id1234093389?l=ko) (한국어 부재)
- [Garmin CIQ](https://apps.garmin.com/apps/8f5a5158-a85c-4617-b648-b0755a6beb70)
- [Web App](https://waterspeedapp.web.app/)
- [Foiling.ca 리뷰](https://foiling.ca/2025/04/11/waterspeed-water-sports-performance-tracking-app/)
- [Google Play](https://play.google.com/store/apps/details?id=com.waterspeed.waterspeedapp), [AppBrain](https://www.appbrain.com/app/waterspeed-track-watersports/com.waterspeed.waterspeedapp) (master audit value 유지)

**verify 못한 항목 (Danny / 후속 리서처 follow-up):**
1. **Seabreeze 윙포일 forum 의 정확한 윈드포일 tack/jibe 라벨 역전 버그 URL** — 1차 source 직접 fetch 못함. Danny 본인 사용 경험 + 스크린샷이 가장 신뢰 가능.
2. **한국 region App Store 의 KRW 가격 표기 실제 노출 여부** — 결제 페이지까지 navigate 필요.
3. **AppBrain Android stats 2026-05 시점 최신값** — 직접 fetch 실패.
4. **GPS-Speedsurfing alpha 500 의 Waterspeed native vs 외부 위탁** — 약한 추정.
5. **Crunchbase / PitchBook funding + LinkedIn 헤드카운트** — verify 못함.
6. **Foiling efficiency 의 정확한 측정 메서드** — GPS speed-threshold vs IMU pitch 추정.
7. **한국 윙포일 커뮤니티 (네이버·인스타·유튜브) Waterspeed 멘션 빈도** — 별도 한국어 search 필요.
8. **Vakaros × Waterspeed 통합의 iOS launch 시점** — 공식 "coming soon" 만.
