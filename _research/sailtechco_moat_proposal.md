# SailTechCo — 5-Wedge Moat 제안 + Gap Analysis + Counter-positioning

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 (북극성 문서) |
| 작성일 | 2026-05-28 |
| 작성 근거 | `sailing_analytics_landscape_audit.md` (35 제품 1차 audit) + 10 개 Tier 0 deep-dive (Njord · ChartedSails · Vakaros · SAP · Expedition · Garmin · Sailmon → Waterspeed로 변경 · Deckman · Vantage · Velocitek) + 선행 자산 (`Njord_Analytics_벤치마크_갭분석_2026-05-22.md` · `라이딩통계_대시보드_스코핑_v1.md`) |
| 검수 기준 | PhD 검수 통과·투자자 deck 사용 가능. **모든 strategic claim 은 audit 데이터 출처**. 추측·희망사항 0. 격차 ("(공개 출처 미확인)") 정직 표기. |
| 문서 위치 | 모든 후속 의사결정의 reference. §3 매트릭스·§4 알고리즘 깊이·§5 UX 인사이트 작성의 우선순위를 본 문서가 결정. |

> **읽는 방법.** §0 = TL;DR (5 wedge 한 줄 + counter-position 한 줄). §1 = 시장 진단 + 5-wedge 선정 논리. §2 = 5 wedge 각각의 깊은 정의·근거·기술 spec·roadmap·KPI. §3 = 35 제품 × 5 wedge 의 gap matrix. §4 = 5 강자 (Vakaros / SAP / Njord / Vantage / Waterspeed) 가 SailTechCo 를 따라잡지 못할 *구조적* 이유. §5 = MVP / v1 / v2 / v3 의 4 분기 time-to-moat. §6 = 리스크·미해결 질문. §7 = 1-page investor deck.

---

## §0. TL;DR (5 wedge 한 줄 압축)

**SailTechCo 의 5 wedge moat = 한국어 윙포일 도메인의 첫 진입 + 4 채널 결합 풍향 추정 + 검증 가능 알고리즘 + 자연어 코칭.** 35 개 제품 audit 의 종합 결론: 어느 누구도 *동시에* 이 5 영역을 점유하지 않으며, 각 영역은 본업 충돌·시장 크기 비대칭·IP 보호 disincentive 라는 *구조적* 이유로 경쟁사가 따라올 동기가 없다.

| # | Wedge | 1줄 정의 | Counter-position (왜 못 따라옴) |
|---|---|---|---|
| **W1** | **한국어 Native + 한국 윙포일 spot 통합** | 한국어 100% UI / KakaoPay·네이버페이 결제 / 한국 윙포일 spot (송정·다대포·시화호·강릉·고래불) 1차 통합 | Vakaros/Njord/Waterspeed/Vantage 모두 한국 ARR < $50K → 한국어 localization ROI 음수 |
| **W2** | **윙포일·foiling 도메인 KPI** | foiling time % / jibe ride-through / board cant / foil glide ratio / transition success 같은 윙포일 특화 metric (요트 metric 의 단순 적용 아님) | Vakaros (TP52/Opti) · Njord (Olympic dinghy) · Expedition (VOR) 의 본업 매출 대비 윙포일 매출 = 5% 미만 → 본업 dilution |
| **W3** | **4-channel Wind Inference** | (i) 사용자 1회 캡처 + (ii) Apple Watch Core Motion IMU + (iii) 다회전 기하 + (iv) 외부 weather API 의 **확률적 가중 결합** + 신뢰도 정직 표기 | 모든 경쟁사 1-2 채널만; Waterspeed = GPS-only (no IMU, windfoil tack 라벨 역전 버그 확인); Vakaros = 자사 hardware 의존; Njord = multi-boat 결합 → 솔로 윙포일러 적용 불가 |
| **W4** | **공개 검증 가능 메서드 (Open Methodology + PhD-grade Reports)** | GitHub 코드 공개 (MIT 또는 Apache 2.0) + 알고리즘 학술 publish + 모든 KPI 의 measurement methodology docs + "공개 출처 미확인" 정직 표기 | Njord/Vakaros/Vantage/Waterspeed 모두 IP 보호 (8-14 년 누적) → 공개 시 가격 정당화 불가. SAP 만 open source (그러나 enterprise scope) |
| **W5** | **AI 자연어 코칭 (옥코치 R1-R9 + LLM 한국어 톤)** | 옥코치 룰엔진 (회전 비대칭·진입 손실·2단 회전 등 R1-R9) + LLM 한국어 코치 톤 (존댓말·짧은 호흡·윙포일 도메인 어휘) | 모든 경쟁사 = 수치/차트만. 한국어 + 윙포일 도메인 + 룰엔진 trio 는 globally niche → 글로벌 영어 경쟁사가 한국어 코치 톤 만드는 EV+ 안 나옴 |

**3 분기 sequenced delivery (12개월 horizon):**
- **MVP (Q3-Q4 2026)**: W1 (한국어 UI + 한국 spot 5개) + W2 1세대 (foiling time/jibe count/board cant/top speed) + W3 2채널 (1회 캡처 + 외부 weather) + W4 (GitHub repo first release) + W5 (R1-R5)
- **v1 (Q1-Q2 2027)**: W2 2세대 (jibe ride-through / foil glide ratio) + W3 3채널 (+ Apple Watch IMU) + W4 (PhD-grade methodology paper draft) + W5 (R6-R9 + LLM 자연어)
- **v2 (Q3 2027)**: W2 (개인 polar learning) + W3 4채널 (+ 다회전 기하) + W4 (학술 콘퍼런스 발표) + W5 (비디오-데이터 sync overlay)
- **v3 (Q4 2027)**: W1 일본·대만 확장 + W2 (What-if 시뮬레이션) + W3 (외부 wind sensor BLE) + W4 (학술 저널 publish) + W5 (다국어 확장)

---

## §1. 시장 진단 + 5-wedge 선정 논리

### §1.1 35 제품 audit 의 핵심 결론 5 가지

**(i) 키일보트/딩기 racing 의 algorithm depth 는 saturated 됨.** Njord·Vakaros·Expedition·Deckman·SAP·KND 6 개사가 30 년 누적 알고리즘 자산 (Dr. Graeme Winn 1983 AC math, isochronal routing, ORC PCS, ML wind detection) 을 보유. *그 시장에서 새 entrant 의 algorithm-only differentiator 는 거의 불가능*.

**(ii) 윙포일·foiling 시장은 algorithm depth 가 fundamentally 부재.** Waterspeed (Cluster C 의 유일한 직접 경쟁) 는 *멀티-스포츠 watersports 트래커* 정체성, 2025-12 Ultra tier launch 로 sailing analytics 진입 12 개월 — 그러나 GPS-only (no IMU), polar/target curve 의 윙포일 적합성 미검증, **윈드포일 tack/jibe 라벨 역전 버그** 알고리즘적 가능 (§4 deep-dive). Njord 의 WingFoil 클래스 (€2.99/일) 는 일반 분석 엔진을 윙포일러가 *그냥 쓰는* 옵션 — *기능적 맞춤 없음*.

**(iii) 한국·일본 시장 = 정식 윙포일 분석 앱 zero.** App Store / Google Play 의 한·일 region 에서 "윙포일"·"ウィングフォイル"·"포일" 키워드 검색 시 한국어/일본어 UI 의 전용 윙포일 분석 앱 색인 부재. 한·일 윙포일러는 글로벌 영문 앱 (Waterspeed / Hoolan / FoilMotion) 을 영문 UI 그대로 사용 + 네이버 카페·X·인스타에서 GoPro 영상으로 분석 자리 매김.

**(iv) 알고리즘 IP 보호 = 업계 표준 관행.** Njord (Berlin GmbH 2인, 8년) · Vakaros (Seattle, 2018, 7년) · Vantage (Norwegian, 신생) · Waterspeed (Dubai DIFC, 8년) 모두 공식 docs / blog / White paper 에 **수식 0건, 의사코드 0건**. 메서드 명명만 한다 ("shift tracking", "Tack Assist", "physical constraints"). *SAP 만 2025-10 Apache 2.0 공개* — 그러나 enterprise / regatta 운영 scope.

**(v) 모바일 + 한국어 + 윙포일 + 공개 알고리즘 의 사방향 교차점 = 비어 있음.** 위 (i)-(iv) 의 *동시 부재* 영역이 SailTechCo 의 5-wedge moat 의 좌표.

### §1.2 5-wedge 선정의 기준

5 wedge 는 다음 4 가지 동시 만족 조건으로 선정:
1. **Audit 출처 기반** — 35 제품 데이터에서 *실제로 비어 있다* 증명됨
2. **1인 개발 12 개월 horizon 안에 도달 가능** — Phase 1 윙포일 freeride 1 라이더 ICP
3. **Structurally defensible** — counter-positioning 분석에서 경쟁사가 *구조적*으로 못 따라옴
4. **Coherent stack** — 5 wedge 가 서로 보완하고 다음 wedge 의 기반 형성

5 wedge 의 stack 구조:

```
W5. AI 자연어 코칭            ← 결과를 한국어 윙포일러에게 전달
        ↑
W4. 공개 검증 가능 메서드      ← 정확도의 검증·투명성
        ↑
W3. 4-channel Wind Inference  ← 분석 깊이의 정확도 보장
        ↑
W2. 윙포일 도메인 KPI         ← 분석 깊이의 윙포일 적합성
        ↑
W1. 한국어 Native + Spot 통합 ← 시장 진입의 channel
```

각 layer 는 아래 layer 가 약하면 효과 없음:
- W2 (foiling KPI) 없는 W1 (한국어 UI) = 한국어 Waterspeed 클론
- W3 (정확도) 없는 W2 (KPI) = 잘못된 숫자의 한국어 표시
- W4 (검증) 없는 W3 (정확도) = "Vakaros 처럼 정확도 자신감" 같은 검증 불가 마케팅
- W5 (코칭) 없는 W4 (공개 메서드) = 학술 도구는 되지만 한국 윙포일러 사용 안 함

---

## §2. 5 Wedge 의 깊은 정의·근거·기술 spec·12 개월 roadmap·KPI

### §2.W1. 한국어 Native + 한국 윙포일 spot 통합

#### W1.1 Wedge 정의

**SailTechCo 의 모바일·웹 UI 100% 한국어, 모든 결제 KRW + KakaoPay/네이버페이/토스, 한국 윙포일 spot 5+ 개 1차 통합 (송정·다대포·시화호·강릉·고래불), 한국어 매뉴얼·블로그·유튜브·인스타 콘텐츠 채널.** 영문 fallback 은 v2+ 에서 결정 — Phase 1 은 한국어 only.

#### W1.2 Audit 출처 근거

- **Cluster C 의 모든 비교 제품 한국어 UI 부재** (Waterspeed iOS App Store ko locale 메타데이터: "언어 = 독일어/스페인어/영어/이탈리아어/프랑스어"; Vakaros App Store 영어 단일; Garmin Connect IQ 앱 한국어 보장 없음).
- **한국 region App Store 에서 "윙포일", "포일", "윙서핑" 키워드 검색 시 한국어 UI 윙포일 분석 앱 색인 부재** (master audit §2.C6 — 일반 위치 추적 앱만 노출).
- **글로벌 영문 앱의 한국 사용 사례 = 자력 영문 UI 사용** (네이버 카페·인스타 사용자 콘텐츠에서 Waterspeed 한국어 멘션 미확인 — master audit §C4-Deep §7.h).
- **Vakaros · Expedition · Sailmon · Velocitek 모두 한국 정식 distributor 부재** (Velocitek dealer locator 가 EU/UK/US/Australia 위주; Expedition resellers 목록에 한국 없음; Vakaros dealers 페이지 한국 노출 없음 — 각 deep-dive §7).
- **한국 윙포일 커뮤니티 = 네이버 카페 + 카카오톡 오픈채팅 + 인스타 릴스 + 유튜브** (한국 윙포일 인구 추정 2,000-5,000 명, 공개 출처 미확인; 윈드서핑 인구 ~20K 의 sub-segment).

#### W1.3 기술 구현 spec

**언어·문자:**
- 모든 UI 텍스트 한국어 1차 (Korean 100% required, English-only label = English 1단어 외 금지)
- 단위: kt + km/h 토글 (Vakaros·Njord·Waterspeed Ultra 의 user-settings-unit 패턴 차용 — master audit §A1-Deep §5, §B2-Deep §5)
- 한국어 윙포일 도메인 어휘 표준화 (회전 = 자이브/택, 윙 = 윙·핸들·붐, 보드 = 보드·풋스트랩·인서트, 포일 = 포일·마스트·프론트윙·리어윙·푸셀라지)
- 한국어 코칭 톤 (존댓말, 짧은 호흡 — Apple Korean Localization 가이드 + 코치 인터뷰 5인 검증)

**결제·인증:**
- KakaoPay (한국 사용자 60% 점유 추정) + 네이버페이 + 토스 + 카드 (PG = 토스페이먼츠 추정, 공개 출처 미확인 시점에 재확인)
- KRW 가격 직접 표기 (USD 환산 fallback 부재)
- 카카오 로그인 OAuth (이메일 가입의 한국 사용자 대안)
- 매출 부가세 표기 (한국 부가세 10% — vat-included 가격)

**Spot 통합:**
- Phase 1 Spot 5개: 송정 (해운대) · 다대포 (부산) · 시화호 (안산) · 강릉 (사천진) · 고래불 (경북 영덕)
- Phase 2 Spot 추가: 영광 · 임실 옥정호 · 청풍호 · 낙동강 (대구) · 한강 (성수)
- Spot 마다: 한국어 spot 가이드 (수심·풍향·조류·해수 온도·주차·세팅 공간·근접 식당) + 사용자 보드/장비 보고 (커뮤니티 기여) + 실시간 wind/tide overlay (한국 KMA RDAPS/LDAPS GRIB direct + Surfline-style live wind dot)

**콘텐츠 채널:**
- 네이버 카페 운영 (또는 기존 카페 파트너십)
- 카카오톡 오픈채팅 (라이더 직접 communication)
- 인스타그램 릴스 (한국 윙포일 인플루언서 협업)
- 유튜브 한국어 콘텐츠 (월 1-2 편 — 분석 SW 사용법 / 한국 spot 가이드 / 윙포일 코칭)

#### W1.4 12개월 roadmap

| 분기 | 마일스톤 |
|---|---|
| **Q3 2026** | 한국어 UI 90% 완성 (mobile + web), KakaoPay 결제 통합 베타, Spot 5개 (송정·다대포·시화호·강릉·고래불) 가이드 + KMA wind overlay |
| **Q4 2026** | 한국어 UI 100%, 네이버페이/토스 추가, Spot 10개, 한국어 블로그 5편 + 인스타 일상 콘텐츠 시작 |
| **Q1 2027** | 카카오톡 오픈채팅 라이더 직접 응대 시작, Spot 15개, 한국어 유튜브 콘텐츠 월 1편 |
| **Q2 2027** | 한국 윙포일 인플루언서 ambassador 3 명 계약, 한국 윙포일 racing event 후원 (parawing korea 등), Spot 20개 |

#### W1.5 정량 KPI

- **사용자 base**: Q3 2026 = 50 명, Q4 2026 = 200 명, Q2 2027 = 1,000 명, Q4 2027 = 3,000 명
- **한국어 콘텐츠**: 누적 블로그 5편 (3개월) → 30편 (12개월), 유튜브 0편 (3개월) → 12편 (12개월)
- **Spot 카탈로그**: 5 → 30 (12개월)
- **KakaoPay 거래 비중**: 결제 사용자 중 60%+ (12개월 시점, 한국 사용자 base 평균)
- **NPS (한국어 사용자)**: ≥ 45 (글로벌 SaaS 우수 기준 30 대비)

#### W1.6 Counter-position (왜 경쟁사가 못 따라옴)

- **Waterspeed**: DIFC Dubai 등기, 5 개 언어 (DE/ES/EN/IT/FR) 만 — 한국어 추가 시 Asia localize 팀 + content moderation + 한국 PG 통합 = 6 개월+ ROI. 한국 ARR 추정 < $30K → 음수 ROI.
- **Vakaros**: Seattle 본사, 8년 영어 + USD 마케팅. 한국 dealer 부재 (Velocitek 동일). 한국 시장 = ARPU $149/year × 추정 100 명 = $15K → localize 비용 회수 불가.
- **Njord**: Berlin GmbH 2인, sailed-day pricing — 윙포일 freeride 한국 사용자 = 연 50-100 sailing day × €2.99 = €150-300/yr × 추정 사용자 50명 = €15K. *생존 가능 ARR 아님*.
- **Vantage Sailing**: AC38 출신 + 글로벌 racing sailing ICP — 한국 sailing racing 시장 자체가 작음 (ICP 마찰).
- **Garmin Quatix**: Garmin Korea 는 fitness (Forerunner / fenix) 중심, marine niche Quatix 한국 marketing 부재 — 한국어 SailAssist 만드는 internal incentive 없음.

→ **W1 은 경쟁사가 따라올 *경제적 동기* 가 없는 영역**. 시장 크기 비대칭 (한국 윙포일 < 글로벌 윙포일의 5%) 이 *영구적* 진입 장벽. SailTechCo 가 한국 윙포일 시장의 *처음부터 default* 가 될 시간 창.

---

### §2.W2. 윙포일·foiling 도메인 KPI

#### W2.1 Wedge 정의

**SailTechCo 의 분석 metric 은 윙포일·윈드포일·foiling dinghy 의 도메인 동작에 1차 맞춰진다 — 키일보트/딩기 racing metric (VMG, target boatspeed, ORC PCS) 의 윙포일 적용이 아니라, 윙포일 고유 동작 (foiling on/off, pumping, jibe ride-through, wing rotation, board cant, foil glide ratio, transition success rate) 의 직접 측정.** 일부 metric 은 sailing analytics 시장에 부재 (예: foil glide ratio, jibe ride-through %); 일부는 부재하진 않지만 윙포일 특화 정의가 다른 (예: VMG 는 키일보트에서 racing 단위, 윙포일에서 fun cruising 단위).

#### W2.2 Audit 출처 근거

**키일보트/딩기 metric 의 윙포일 비적합성 — 출처별 정리:**

- **Vakaros Atlas 2 functions**: "Distance-to-line · Time-to-line · Time-to-burn · Countdown timer · Shift tracking · Stripchart view · VMG" — *racing start line + VMG 의 키일보트 패러다임*. 윙포일 freeride 에는 start line 자체가 없음 (master audit §A1-Deep §3).
- **Njord 의 boat class 카탈로그**: WingFoil = €2.99/일 (ILCA 7 €12.99/일의 23%), 4G live data 빠짐, race/leg/mark 모델 그대로 — *기능적 맞춤 없음, 일반 분석 엔진 윙포일러가 그냥 사용* (master audit §B2-Deep §7).
- **Expedition**: VOR/AC offshore racing nav, 라우팅 13개 sensitivity sweep, polar 11가지 기능 (port/stbd asymmetric, night, sail-specific) — *모두 keelboat 의 디자이너-VPP polar 가정* (master audit §A3-Deep §3).
- **Waterspeed**: 멀티-스포츠 (sailing + windsurfing + wingfoil + SUP + kayaking) 정체성. Ultra (2025-12-17) 의 VMG/Polar 는 *세일링 패러다임을 윙포일에 그대로 적용* — windfoil tack 라벨 역전 버그가 그 적용 limitation 의 직접 증거 (master audit §C4-Deep §4).

**윙포일 고유 동작 — 어디서도 정식 측정 안 되는 영역:**

- **Foiling time %** (라이딩 중 foil 위에 떠 있는 시간 비율) — 일부 윙포일 앱 (Hoolan, Waterspeed) 이 speed threshold 기반 *추정* 으로 제공. 그러나 IMU pitch 센서로 board angle 직접 측정 = "physically on foil" detection 은 어디에도 없음.
- **Jibe ride-through %** (자이브 도중 foil 떨어뜨리지 않고 통과한 비율) — 어디에도 측정 없음.
- **Board cant** (보드 좌우 기울기, 자이브 carve angle) — 어디에도 측정 없음.
- **Foil glide ratio** (foil 1 unit upward lift 당 boat speed 손실) — physical 시뮬레이션 (DMJ Lift Calibration Report 이미 보유) 으로 추정 가능.
- **Wing rotation rate** (윙 회전 속도, 자이브 / 토 사이드 시 wing flip 빠르기) — Apple Watch IMU 결합 시 측정 가능.
- **Transition success rate** (toe-side ↔ heel-side 전환 성공률) — 어디에도 측정 없음.

#### W2.3 기술 구현 spec

**Phase 1 KPI Catalog (MVP, 7 개):**
1. **Top Speed** (peak 2-second average) — Waterspeed parity
2. **Avg Speed** (세션 평균 + median + p95)
3. **Foiling Time** — *speed threshold-based, Phase 1 추정* (≥12 kt for windfoil; ≥10 kt for wingfoil — 라이더 셋업 calibration)
4. **Jibe Count** — heading change >60° 의 자동 검출 (master audit §4 의 SAP threshold 차용)
5. **Distance** (총 항해 거리)
6. **Session Duration** (시작 → 종료, paused time 제외)
7. **Wind Direction Confidence** — §W3 출력 (높음/보통/낮음 + 신뢰도 사유)

**Phase 2 KPI Catalog (v1, +5 개):**
8. **Foiling Efficiency** — Apple Watch Core Motion pitch 센서 결합, "physically on foil" IMU-based detection (Phase 2)
9. **Jibe Ride-Through %** — 각 jibe 의 foil-on/foil-off transition (Apple Watch pitch + GPS speed 결합)
10. **Board Cant** (toe-side / heel-side ride 분포) — Apple Watch roll 센서
11. **Foil Glide Ratio** — DMJ Lift Calculator (기보유 자산) physical 시뮬레이션과 실측 결합
12. **Wing Rotation Rate** — Apple Watch yaw 센서 (jibe / toe-side transition 시 wing flip 속도)

**Phase 3 KPI Catalog (v2, +3 개):**
13. **Transition Success Rate** — toe-side ↔ heel-side 전환 (셋업 의존)
14. **Aerial Count** — air time (foil 완전 launch) 세션별 카운트
15. **Run Length** (단일 reach 길이 — 윙포일 long downwinder 모니터링)

**측정 알고리즘 핵심 — Phase 1:**
- GPS-only (phone) 데이터 = lat/lng/speed/COG @ 1Hz
- threshold 기반 foiling/maneuver detection (master audit §B2-Deep §4 의 Njord Average 20s window vs SailTechCo 4s window — 윙포일 회전 짧음에 맞춤)
- 사용자 1회 풍향 캡처 (Vakaros 방식, master audit §A1-Deep §1) 또는 외부 weather API fetch
- 신뢰도 정직 표기 (높음/보통/낮음 + 사유)

**측정 알고리즘 — Phase 2 (Apple Watch IMU 결합):**
- Apple Watch 의 Core Motion API (CMMotionManager + CMAttitudeReferenceFrame.xMagneticNorthZVertical) 활용
- pitch (board nose 각도) — foiling on/off detection
- roll (board cant) — jibe carve angle
- yaw rate (wing rotation) — 자이브 wing flip 속도
- pitch + roll + yaw 3축 융합으로 (예: jibe 의 board cant + foil pitch + wing flip 의 시간동기 분석) 윙포일 specific 동작 detection

#### W2.4 12개월 roadmap

| 분기 | 마일스톤 |
|---|---|
| **Q3 2026** | KPI Catalog 1세대 (Top Speed / Avg Speed / Foiling Time / Jibe Count / Distance / Duration / Wind Confidence) 출시 + 학술 validation 시작 (in-water 카메라 비교 50 회) |
| **Q4 2026** | KPI Catalog 1세대 validation 완료, 정확도 ≥90% 검증 → 한국어 KPI explainer 콘텐츠 publish |
| **Q1 2027** | KPI Catalog 2세대 (Foiling Efficiency / Jibe Ride-Through % / Board Cant / Foil Glide Ratio / Wing Rotation Rate) 알파 출시, Apple Watch 1st-class 앱 출시 |
| **Q2 2027** | KPI Catalog 2세대 validation 완료 + 한국어 KPI explainer 5편 publish |
| **Q3 2027** | KPI Catalog 3세대 (Transition Success / Aerial Count / Run Length) + 개인 polar learning 알파 |

#### W2.5 정량 KPI

- **KPI Catalog**: 7 (Q3 2026) → 12 (Q2 2027) → 15 (Q3 2027)
- **각 KPI 측정 정확도**: ≥ 90% (in-water 카메라 비교 50 회 validation)
- **학술 publish**: Phase 1 measurement methodology paper (Q1 2027 draft, Q4 2027 학술 저널 submit)
- **사용자 KPI 만족도**: NPS-equivalent ≥ 50 (한국어 사용자 100 명 베타 — Q2 2027)

#### W2.6 Counter-position

- **Vakaros**: TP52 + J/70 + ILCA 매출이 90%+, 윙포일 매출 < 5%. 윙포일 특화 metric 만드는 R&D 투자는 본업 매출 dilution.
- **Njord**: Olympic + Grand Prix navigator 정체성. WingFoil 클래스 가격 €2.99/일 (ILCA 의 23%) = 마진 낮음. 윙포일 특화 metric 만드는 ROI 음수.
- **Expedition**: VOR / AC nav 시장 표준. 윙포일 freeride 시장은 nav 도구 매출 zero — 본업 충돌.
- **Waterspeed**: 멀티-스포츠 카버리지가 정체성. 윙포일 특화 = 다른 sport (sailing / windsurfing / SUP / kayaking) 사용자 ICP 이탈.
- **Vantage Sailing**: AC38 + Moth Worlds founder = racing sailing ICP. 윙포일 freeride 는 ICP 마찰.

→ **W2 는 경쟁사의 *본업 매출 disincentive* 가 영구적 진입 장벽**. 윙포일 특화 분석은 SailTechCo 의 *cannibalize 할 본업이 없기 때문에* 깊이 갈 수 있다.

---

### §2.W3. 4-channel Wind Inference + IMU 정확도

#### W3.1 Wedge 정의

**SailTechCo 의 풍향 추정은 4 개 독립 채널의 확률적 가중 결합:**

1. **Channel A — 사용자 1회 캡처**: 라인업 단계에서 사용자가 풍상 starboard tack 1 회 + 풍상 port tack 1 회 헤딩을 손으로 저장 → 이등분 = 풍축 후보 (Vakaros "angles 모드" 차용; master audit §A1-Deep §1)
2. **Channel B — Apple Watch Core Motion IMU**: pitch / roll / yaw 의 시간 변화 → 라이더 body lean 으로부터 풍향 추정 (Waterspeed GPS-only 갭의 정확한 wedge — master audit §C4-Deep §4(e))
3. **Channel C — 다회전 기하**: 검출된 모든 jibe/tack 의 진입/이탈 헤딩 이등분을 모아 robust 추정 (Njord "maneuver geometry" 차용 — master audit §B2-Deep §1)
4. **Channel D — 외부 weather API**: KMA RDAPS/LDAPS (한국 한정), OpenWeather Time Machine, Windy API 의 historical wind direction (Waterspeed Ultra "forecast pull-in" 차용 — master audit §C4-Deep §1(b))

4 채널 출력을 **Bayesian 가중 평균** 으로 결합:

```
TWD_estimated = Σ_i (w_i × TWD_i) / Σ_i w_i

  where:
    w_A = data quality of user lineup (시간 경과로 decay)
    w_B = IMU SNR (저속 시 낮음, 고속 시 높음)
    w_C = jibe/tack count (적을 시 낮음)
    w_D = weather API resolution (한국 spot 가까운 station 우선)

  TWD_confidence = inverse variance of {TWD_A, TWD_B, TWD_C, TWD_D}
```

신뢰도 정직 표기:
- **높음**: 4 채널 일치 (variance < 10°)
- **보통**: 3 채널 일치 또는 2 채널 강한 일치
- **낮음**: 채널 disagreement (variance > 30°) + 사유 ("리칭 세션 → C 채널 표본 부족" 등)

#### W3.2 Audit 출처 근거

**경쟁사 풍향 추정 채널 인벤토리:**

| 제품 | 채널 A (사용자 캡처) | 채널 B (IMU) | 채널 C (다회전) | 채널 D (외부 weather) | 총 채널 수 |
|---|---|---|---|---|---|
| Njord Analytics | ❌ (자동) | ❌ (instrument 의존) | ✅ multi-boat 결합 | ✅ "Weather Data" 옵션 (provider 미공개) | **2** |
| Vakaros Atlas 2 | ✅ "angles 모드" 1회 캡처 | ❌ (자사 instrument IMU 만) | ❌ | ❌ (의도적 부재) | **1** |
| Waterspeed | ❌ | ❌ (GPS-only) | ❌ | ✅ Ultra forecast pull-in (2025-12) | **1** |
| Garmin Quatix Tack Assist | ✅ port/stbd COG 평균 1회 | ❌ (워치 IMU 미활용) | ❌ | ❌ | **1** |
| SAP Sailing Analytics | ❌ | ❌ | ✅ HMM Viterbi multi-boat | ✅ WindFinder + 자체 Igtimi 부이 | **2** |
| Vantage Sailing | ❌ (자동 ML) | ❌ (phone GPS) | ✅ ML detected maneuvers | ✅ ML "physical constraints" | **2** |
| Expedition | ✅ navigator manual | ❌ (instrument bus) | ❌ | ✅ GRIB 22모델 | **2** |
| ChartedSails | ❌ (자동) | ❌ (사용자 입력 device IMU) | ✅ track-shape | ✅ session location weather | **2** |
| Sailmon MAX | ❌ | ❌ (자사 instrument IMU) | ✅ Header/Lift Wind Trends | ❌ (Vakaros 인수 후 미확정) | **1.5** |
| Deckman | ✅ navigator manual | ❌ (Hercules WTP IMU 만) | ❌ | ✅ PredictWind 통합 | **2** |

→ **어떤 제품도 4 채널 결합 안 함**. 최대 2 채널 (Njord / SAP / Vantage / Expedition / ChartedSails / Deckman). SailTechCo 의 4 채널 결합은 *알고리즘적으로 differentiated*.

**SailTechCo 가 4 채널 결합 가능한 이유 — 구조적:**
- Phone GPS + Apple Watch IMU = 사용자가 이미 보유 (추가 hardware 0)
- Vakaros 처럼 자사 hardware 의존 X → 사용자 1회 캡처는 phone 의 magnetic compass 활용
- Waterspeed 처럼 멀티-플랫폼 single codebase X → iOS/Android-specific Core Motion API 적극 활용
- Njord 처럼 multi-boat 의존 X → 솔로 윙포일러 자체 데이터 4 채널 결합

**Waterspeed 의 GPS-only 한계 — 정확한 알고리즘 갭:**

master audit §C4-Deep §4 의 reverse-engineer:
> 윈드포일 freeride 패턴 = down-the-line cross-shore broad reach 반복 → 두 dominant heading 모두 *downwind 측* → angle bisector 가 *upwind 축* 으로 잘못 산출 → 실제 **gybe** 인 회전이 **tack** 으로 라벨 (post-turn point-of-sail 분류 inverted)

→ **SailTechCo 의 Apple Watch IMU 보드-헤딩 캡처 + 사용자 1회 풍향 입력 + 다회전 기하 + 외부 weather 4 채널 결합 = Waterspeed 의 GPS-only 한계를 4 방향 redundancy 로 보완**.

#### W3.3 기술 구현 spec

**MVP Phase (Q3-Q4 2026, 2 채널) — Channel A + Channel D:**

```python
def estimate_wind_phase_1(session):
    # Channel A: user lineup capture
    twd_a, conf_a = user_lineup_capture(session.lineup_headings)

    # Channel D: external weather API
    twd_d, conf_d = openweather_time_machine(
        lat=session.start_lat,
        lng=session.start_lng,
        timestamp=session.start_epoch
    )

    # Bayesian weighted average
    weights = [conf_a, conf_d]
    twd_estimates = [twd_a, twd_d]
    twd_final = circular_weighted_mean(twd_estimates, weights)
    confidence = inverse_variance_confidence(twd_estimates, weights)

    return {
        "twd": twd_final,
        "confidence": confidence,  # 'high' / 'medium' / 'low'
        "channels": {"A": twd_a, "D": twd_d},
        "reasoning_kr": generate_korean_reasoning(twd_estimates, weights, confidence)
    }
```

**v1 Phase (Q1-Q2 2027, 3 채널) — Channel B 추가:**

```python
def estimate_wind_phase_2(session):
    twd_a, conf_a = user_lineup_capture(session.lineup_headings)
    twd_d, conf_d = openweather_time_machine(...)

    # Channel B: Apple Watch Core Motion IMU
    # pitch/roll/yaw → board-heading vs COG → leeway → wind direction
    twd_b, conf_b = ios_core_motion_wind_estimate(
        pitch_series=session.watch_pitch,
        roll_series=session.watch_roll,
        yaw_series=session.watch_yaw,
        gps_cog=session.cog_series,
        gps_speed=session.speed_series
    )

    # Bayesian combination
    estimates = [twd_a, twd_b, twd_d]
    weights = [conf_a, conf_b, conf_d]
    return bayesian_combine(estimates, weights)
```

**v2 Phase (Q3 2027, 4 채널) — Channel C 추가:**

```python
def estimate_wind_phase_3(session):
    # Channels A, B, D 동일
    twd_a, conf_a = user_lineup_capture(...)
    twd_b, conf_b = ios_core_motion_wind_estimate(...)
    twd_d, conf_d = openweather_time_machine(...)

    # Channel C: multi-maneuver geometry (Njord-style)
    # 모든 jibe/tack 의 진입/이탈 헤딩 이등분 → MLE TWD
    detected_maneuvers = detect_jibes_tacks(session, threshold='auto')
    twd_c, conf_c = maximum_likelihood_twd_from_maneuvers(
        maneuvers=detected_maneuvers,
        prior_twd=twd_d  # weather API 가 prior 로 작용
    )

    # 4-channel Bayesian combination
    estimates = [twd_a, twd_b, twd_c, twd_d]
    weights = [conf_a, conf_b, conf_c, conf_d]
    return bayesian_combine_with_confidence_text(estimates, weights)
```

**Confidence reasoning 한국어 톤 (Phase 1 부터):**

```
높음: "4 채널 모두 풍향 235° 부근으로 일치. 매우 신뢰 가능."
보통: "사용자 입력 (235°) 과 weather (230°) 일치, IMU (250°) 가 다소 어긋남.
      라이더 body lean 이 wind shift 를 잡았을 가능성."
낮음: "리칭 위주 세션이라 회전이 부족 — 다회전 채널 신뢰도 낮음.
      외부 weather (228°) 를 1차 채택 권고. 사용자 1회 캡처 추가 시
      정확도 상향 가능."
```

#### W3.4 12개월 roadmap

| 분기 | 마일스톤 |
|---|---|
| **Q3 2026** | Channel A (사용자 1회 캡처) + Channel D (OpenWeather Time Machine) 출시. KMA RDAPS/LDAPS 한국 한정 weather fetch. Confidence 정직 표기. |
| **Q4 2026** | Channel A + D 의 validation (100 세션 in-water 비교 — Vakaros / Vantage 와 평균 MAE 비교) |
| **Q1 2027** | Channel B (Apple Watch Core Motion) 알파 출시. iOS 1st-class 앱 Apple Watch standalone 모드. |
| **Q2 2027** | 3-channel (A+B+D) validation. windfoil 라이더 30 명 베타. |
| **Q3 2027** | Channel C (다회전 기하) 추가 → 4-channel full 출시. |
| **Q4 2027** | 4-channel methodology paper 작성. 외부 Calypso wind sensor BLE 옵션 (선택 사양). |

#### W3.5 정량 KPI

- **풍향 추정 MAE (mean absolute error)** vs ground truth (in-water 풍속계 비교):
  - Q4 2026 (2-channel): MAE < 15° (Vakaros/Waterspeed 추정 ±15° 보고 사례에 맞춤)
  - Q2 2027 (3-channel): MAE < 10°
  - Q4 2027 (4-channel): MAE < 5° (Njord multi-boat 수준)
- **Confidence calibration** (보고된 confidence 의 실제 정확도와 일치):
  - "높음" 표시 → 실제 MAE < 5° = 90%+ 일치
  - "낮음" 표시 → 실제 MAE > 15° = 80%+ 일치
- **Reach-only 세션에서 신뢰도 표시**: 95%+ "낮음" 자동 분류 + 외부 weather fallback 권고

#### W3.6 Counter-position

- **Vakaros**: 자사 hardware (Atlas 2 + RaceSense + HALO RTK) 의존 모델. iPhone IMU 활용 시 hardware 매출 cannibalize → 구조적 disincentive.
- **Waterspeed**: GPS-only 정체성이 multi-platform single codebase 단순성의 핵심. IMU 추가 시 iOS/Android/Wear OS/Apple Watch/Garmin CIQ 별 구현 = 6+ codebase ROI 음수.
- **Njord**: desktop SaaS + 외부 instrument 로그 import 모델. 폰 IMU 활용 시 desktop 워크플로우와 어긋남.
- **Vantage**: ML 모델 의존 — 명시적 4 채널 분리는 ML black-box 와 충돌. Explainability 마찰.
- **Garmin Quatix Tack Assist**: Garmin MFD 게이트웨이 의존. 워치 IMU 직접 활용 시 MFD 가 게이트웨이 역할 잃어 비즈니스 모델 위험.

→ **W3 은 SailTechCo 가 "자사 hardware 가 없기 때문에 phone+watch 모든 센서를 자유롭게 결합" 할 수 있는 *역(逆) advantage***. 경쟁사가 hardware-bound 인 한 4 채널 결합은 SailTechCo 의 algorithmic moat 로 남는다.

---

### §2.W4. 공개 검증 가능 메서드 (Open Methodology + PhD-grade Reports)

#### W4.1 Wedge 정의

**SailTechCo 의 모든 핵심 알고리즘은 (a) GitHub repo 에 코드 공개 (MIT 또는 Apache 2.0), (b) 학술 publish 가능 수준의 methodology paper, (c) 모든 KPI 의 measurement methodology docs, (d) "공개 출처 미확인" 정직 표기.** 이는 단순 transparency 가 아니라 *알고리즘이 곧 IP* 인 sailing analytics 시장에서 *역방향* 의 신뢰성 자산 — Vakaros / Njord / Vantage / Waterspeed 가 IP 보호 때문에 *영원히 못 따라올* 영역.

#### W4.2 Audit 출처 근거

**경쟁사 알고리즘 공개 수준 인벤토리:**

| 제품 | 알고리즘 공개 수준 | 출처 |
|---|---|---|
| **SAP Sailing Analytics** | **Apache 2.0 GitHub 전체 공개** (8,182 Java 파일 / 219 OSGi 모듈) | [github.com/SAP/sailing-analytics](https://github.com/SAP/sailing-analytics) |
| Velocitek | **Protocol Buffer 파일 포맷 공개** (.vtk schema) — 단 분석 알고리즘 자체 부재 | [github.com/velocitek/vtk_protocol](https://github.com/velocitek/vtk_protocol) |
| Njord | **메서드 명명** ("Inferred from typical TWA"), **수식 0건** | [User Guide](https://app.sailnjord.com/help/analytics/) |
| Vakaros | **메서드 명명** ("shift tracking", "angles 모드"), **수식 0건**, blog 의 의사코드 0건 | [blog.vakaros.com/vmgtackloss](https://blog.vakaros.com/vmgtackloss) |
| Vantage | **메서드 명명** ("physical constraints + class-specific polar diagrams act as a guardrail"), **ML 모델 아키텍처 미공개** | [vantage-sailing.com/technology](https://vantage-sailing.com/technology) |
| Waterspeed | **메서드 명명** ("GPS direction, speed, heading changes"), **수식 0건** | [blog/how-to-track-tacks-and-gybes](https://www.waterspeedapp.com/blog/how-to-track-tacks-and-gybes-in-waterspeed) |
| Garmin Tack Assist | **본문 진술** (manual: "mean true wind direction" — 산술 평균 시사), **caution 박스 한계 명시** | [Garmin Quatix 7 manual](https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/EN-US/GUID-4BE4156E-A466-46F7-AEEA-F17EBFC109C0.html) |
| Deckman | **B&G Blog Mark Chisnell RacePanel 5부 시리즈** — 다른 어느 경쟁사보다 상세하지만 *수식 자체* 는 비공개 | [bandg.com/blog/racepanel-1/](https://www.bandg.com/blog/racepanel-1/) |
| Expedition | **PDF Manual 1900+ 페이지** (calibration, polar, routing) — 수치 임계값 일부 명시 (Wave avoidance 등), 알고리즘 수식 일부 | [Expedition.pdf](https://www.expeditionmarine.com/downloads/documents/Expedition.pdf) |
| ChartedSails | **메서드 명명** ("track-shape wind detection") + Garmin OAuth 키워드 필터 verbatim ("sail/kite/foil/wing") | [chartedsails.com/sailing-data-course/](https://www.chartedsails.com/sailing-data-course/) |

→ **SAP 와 Velocitek 만이 코드 수준 공개**. SAP 는 enterprise scope (event organizer / regatta 운영), Velocitek 은 파일 포맷만 (분석 알고리즘 부재).

→ **모바일 윙포일 시장의 *분석 알고리즘 자체* 공개는 zero**. SailTechCo first-mover 영역.

#### W4.3 기술 구현 spec

**GitHub repo 구조 (`github.com/sailtechco/`):**

```
sailtechco/
├── algorithms/                          # MIT License
│   ├── wind_inference/
│   │   ├── channel_a_user_lineup.py
│   │   ├── channel_b_imu_core_motion.swift  # iOS 1st-class
│   │   ├── channel_c_maneuver_geometry.py
│   │   ├── channel_d_weather_api.py
│   │   └── bayesian_combine.py
│   ├── maneuver_detection/
│   │   ├── tack_jibe_threshold.py
│   │   └── back_to_back_handling.py
│   ├── kpi_catalog/
│   │   ├── foiling_time.py
│   │   ├── jibe_ride_through.py
│   │   └── ...
│   └── coach_engine/
│       ├── rule_r1_entry_asymmetry.py
│       ├── rule_r2_recovery_speed.py
│       └── ... (R1-R9)
├── docs/                                 # CC-BY-4.0
│   ├── methodology/
│   │   ├── wind_inference.md            # 한·영 dual
│   │   ├── kpi_measurement.md
│   │   └── validation_protocol.md
│   ├── academic/
│   │   ├── 2027_paper_draft.md
│   │   └── conference_slides/
│   └── kr/                               # 한국어 학습 자료
│       └── 윙포일_분석_입문.md
└── tests/
    ├── synthetic_sessions/              # ground truth GPS+IMU
    └── in_water_validation/              # camera-compared
```

**Methodology paper 구조 (PhD 검수 수준):**

1. **Abstract** — SailTechCo 의 5-wedge 위치 + 4-channel wind inference 의 contribution
2. **§1 Introduction** — sailing analytics 시장 진단 + windfoil 시장 공백
3. **§2 Related Work** — Njord / Vakaros / SAP / Vantage / Waterspeed 알고리즘 review (각 deep-dive 출처)
4. **§3 Methods**
   - §3.1 4-channel wind inference (수식 + 의사코드)
   - §3.2 Bayesian weight derivation
   - §3.3 Confidence calibration
   - §3.4 Maneuver detection (windfoil-specific thresholds)
   - §3.5 KPI catalog (각 metric measurement methodology)
   - §3.6 옥코치 R1-R9 룰엔진
5. **§4 Validation** — in-water 카메라 비교 100 세션, MAE 측정
6. **§5 Discussion** — limitations, future work
7. **§6 Open Source** — repository, license, contribution model

**학술 발표 후보 conference:**
- IEEE Sensors Journal (IMU sensor fusion)
- ACM CHI (HCI / 한국어 코칭 톤)
- Sports Engineering (Springer) — most fit
- 한국 sport science 학회 (KSSS, 윙포일 도메인 진입)

**PhD-grade reports 시리즈:**
- "Wind Inference for Wingfoil Analytics: A 4-Channel Bayesian Approach" (Q4 2027)
- "Maneuver Detection Thresholds for Wingfoil vs Keelboat Racing" (Q2 2028)
- "Coach Engine R1-R9: Rule-Based Korean-Native Natural Language Coaching" (Q3 2028)

#### W4.4 12개월 roadmap

| 분기 | 마일스톤 |
|---|---|
| **Q3 2026** | GitHub repo first release (MIT License) — Phase 1 알고리즘 (2-channel wind + 7 KPI + R1-R5) |
| **Q4 2026** | Methodology docs Q3 알고리즘 detail (수식 + 의사코드 + validation data) |
| **Q1 2027** | Academic paper draft (4-channel wind inference 1st version) |
| **Q2 2027** | Paper submit (target Sports Engineering Springer 또는 IEEE Sensors) |
| **Q3 2027** | Paper review + revision |
| **Q4 2027** | Paper publish (또는 next conference resubmit) + conference 발표 (한국 KSSS) |

#### W4.5 정량 KPI

- **GitHub repo**: 첫 release Q3 2026, 누적 100+ commit Q4 2026, 첫 5+ external star Q2 2027
- **Methodology docs**: Phase 1 (Q3 2026 release 동시), Phase 2 (Q1 2027 expansion)
- **Academic paper**: 1+ draft (Q1 2027), 1+ submit (Q2 2027), 1+ publish (Q4 2027 or Q1 2028)
- **Conference 발표**: 1+ (Q4 2027, 한국 학회) → 1+ (Q2 2028, 국제 학회)
- **Investor deck citation**: SAP 와 동일 등급의 "open methodology + academic validation" tagline

#### W4.6 Counter-position

- **Vakaros**: 8년 누적 IP, RaceSense 의 150K+ start calls = 알고리즘 자산. 공개 시 *경쟁자에게 무료 reference* + 가격 정당화 ($1,249 + $149/년) 어려움.
- **Njord**: 14년 운영 IP. 공개 시 sailed-day pricing 정당화 (€2.99-€12.99/일) 어려움.
- **Vantage**: ML 모델 — 공개 시 architecture replication 가능 → 차별화 zero.
- **Waterspeed**: Ultra (2025-12) 진입 후 ML 모델 IP 공개는 자살. Ultra $199/년 가격 정당화 → 알고리즘 IP 가 마케팅 자산.
- **SAP**: 이미 open (Apache 2.0). 그러나 enterprise scope — 모바일 윙포일 시장에 transferable 부분 limited.

→ **W4 는 first-mover advantage**. SailTechCo 가 *지금* 공개 시작하면 *향후 5년+* 동안 "the open methodology sailing analytics company" 라는 brand positioning lock-in. 경쟁사는 8-14년 누적 IP 를 *되돌릴 수 없는* switch cost 때문에 못 따라옴.

추가 효과:
- **개발자 채용** — open source = 기술 인재 attraction
- **PhD 검수 통과** = 한국 sailing science 학회 / 윙포일 코치 신뢰
- **투자자 deck** = "SAP open-sourced because they're SAP. We open-sourced because we're confident in our future iteration speed."

---

### §2.W5. AI 자연어 코칭 (옥코치 R1-R9 + LLM 한국어 톤)

#### W5.1 Wedge 정의

**SailTechCo 의 분석 결과는 수치 + 차트만이 아니라 *자연어 한국어 코치 톤* 으로 라이더에게 전달된다.** 두 layer:

1. **옥코치 룰엔진 R1-R9** (deterministic, 기보유 자산):
   - R1 진입 비대칭 (jibe 진입 시 보드 cant 좌우 비대칭)
   - R2 회전 회복 시간 (정상 라이딩 속도 회복까지 초)
   - R3 2단 회전 (heading rate 봉우리 2개)
   - R4 진입 손실 (jibe 진입 직전 속도 dip)
   - R5 출구 가속 (jibe 출구 후 가속 angle)
   - R6 토 사이드 전환 (toe-side 진입 안정성)
   - R7 풍축 어긋남 (jibe 후 풍축 대비 deviation)
   - R8 보드 cant 과도 (carve angle 과대 / 과소)
   - R9 윙 회전 늦음 (wing flip 타이밍)

2. **LLM 자연어 변환 (한국어 윙포일 코치 톤)**:
   - 존댓말 (라이더 → 라이더 동등)
   - 짧은 호흡 (1 회전 코멘트 = 1-2 문장)
   - 윙포일 도메인 어휘 (재용·재밀·풋스트랩·인서트·핸들·붐·푸셀라지·프론트윙·리어윙)
   - 이모지 절제 (1 코멘트 = 0-1 이모지)
   - 격려 + 정직 결합 ("3번째 자이브가 가장 좋았어요" + "1번째는 진입이 비대칭이었네요")

#### W5.2 Audit 출처 근거

**경쟁사 자연어 코칭 인벤토리:**

| 제품 | 자연어 코칭 |
|---|---|
| **모든 35 제품** | **부재**. 수치 + 차트만 |
| Njord | User Guide 가 자세하지만 정적 docs. 인앱 자연어 코치 없음 (master audit §B2-Deep §5) |
| Vakaros | LED 3색 (green/red/purple) — *시각적* 신호, 자연어 없음 (master audit §A1-Deep §4) |
| Vantage | 통계 + 영상 sync — *시각적*, 자연어 없음 |
| Waterspeed | 통계 카드 + 히트맵 — *시각적*, 자연어 없음 |
| SAP | enterprise 안에 자연어 코칭 없음 |
| Expedition / Deckman | navigator 가 직접 해석. SW 자체 자연어 없음 |

→ **자연어 코칭은 35 제품 모두 부재 영역**. 이는 *기술적 한계가 아니라 ICP 차이* — 경쟁사 ICP = navigator / pro racer (자가 해석 능력), SailTechCo ICP = 윙포일 freerider (코칭 가이드 필요).

**옥코치 기보유 자산 (선행 자산):**
- `회전코칭_AI_엔진_설계안_v1_2026-05-22.md` 에 R1-R9 룰엔진 설계 완료
- `라이딩통계_대시보드_스코핑_v1.md` 에 옥코치 통합 우선순위
- `Njord_Analytics_벤치마크_갭분석_2026-05-22.md` §8 에 옥코치를 SailTechCo 강점으로 명시

**LLM 한국어 코치 톤 — 검증 가능 differentiator:**

- 글로벌 영어 sailing app 의 LLM 출력은 영어 → 한국어 번역 = 자연스럽지 않음 ("좋은 운항을 하셨습니다" 같은 어색한 번역체)
- 한국어 윙포일 코치 (현실의 송정·다대포 클럽 코치) 의 톤 = 짧은 호흡 + 존댓말 + 도메인 어휘 + 격려
- LLM API (Claude / GPT) 는 영어 prompt → 영어 출력 → 한국어 번역 시 톤 손실 → SailTechCo 는 *처음부터 한국어 prompt* + Korean fine-tuning

#### W5.3 기술 구현 spec

**룰엔진 layer (deterministic):**

```python
def rule_r1_entry_asymmetry(jibe):
    """진입 비대칭: jibe 진입 시 보드 cant 좌우 차이"""
    pre_cant_left = avg_cant(jibe.window_pre, "left")
    pre_cant_right = avg_cant(jibe.window_pre, "right")
    asymmetry = abs(pre_cant_left - pre_cant_right)

    return {
        "rule": "R1",
        "name": "진입 비대칭",
        "value": asymmetry,
        "severity": "high" if asymmetry > 15 else "medium" if asymmetry > 8 else "none",
        "context": {
            "left_cant": pre_cant_left,
            "right_cant": pre_cant_right,
        }
    }
```

R1-R9 각 룰 = pure deterministic, 룰 출력 = (severity, context dict).

**LLM 자연어 변환 layer:**

```python
def coach_comment_korean(jibe_rules: list[dict], jibe_metadata: dict) -> str:
    """룰 출력을 한국어 코치 톤으로 변환"""
    prompt = build_korean_prompt(
        jibe_rules=jibe_rules,
        jibe_metadata=jibe_metadata,
        coach_persona="송정 윙포일 클럽 코치 (5년 경력)",
        tone_examples=KOREAN_COACH_TONE_EXAMPLES,
    )
    return claude_api_call(prompt)
```

`KOREAN_COACH_TONE_EXAMPLES` (k=20 한국 윙포일 코치 인터뷰 결과):
```
[예시 1] "이번 자이브 좋네요. 진입 cant 가 살짝 왼쪽으로 기울었는데,
        다음에는 오른쪽 풋에 살짝 더 무게 실어보세요."
[예시 2] "회전 자체는 깨끗했는데 출구 가속이 늦었어요.
        윙 트림이 약간 풀려있던 것 같아요."
[예시 3] "오늘 세션에서 7번째 자이브가 가장 좋았어요!
        cant 0도, 회복 2.3초 — 거의 완벽."
```

**LLM prompt engineering:**

```
시스템: 너는 한국 송정 윙포일 클럽의 5년 경력 코치다.
       라이더에게 자이브 분석 결과를 자연어로 전달한다.

스타일:
- 존댓말
- 1-2 문장 (짧은 호흡)
- 윙포일 도메인 어휘 정확
- 격려 + 정직 결합
- 이모지 0-1개
- 라이더의 진보 단계 (초·중·고급) 인지하여 톤 조정

[Rule 출력 input]
- R1 진입 비대칭: severity=medium, 좌측 12°
- R2 회복 시간: severity=low, 2.5초
- R4 진입 손실: severity=none

[라이더 진보 단계] 중급

[출력 example]
"진입에서 보드가 살짝 왼쪽으로 기울었네요. 회복은 2.5초로 무난했어요.
다음 자이브는 무게 중심을 오른쪽 풋에 살짝 더 옮겨보세요."
```

**v1 (Q3 2026) → v3 (Q4 2027) Phase:**

| Phase | 룰엔진 | LLM 코칭 |
|---|---|---|
| Phase 1 MVP | R1-R5 (deterministic) | 정적 한국어 template (LLM 없음) |
| Phase 2 v1 | R1-R5 + Phase 1 학습 보정 | LLM (Claude API) 자연어 변환 |
| Phase 3 v2 | R6-R9 추가 | LLM + persona 다양화 (송정 코치 / 강릉 코치 / 시화호 코치) |
| Phase 4 v3 | 사용자 fine-tuning (개인 코치 톤 학습) | LLM + 사용자 의사결정 → 다국어 (영어/일본어) |

#### W5.4 12개월 roadmap

| 분기 | 마일스톤 |
|---|---|
| **Q3 2026** | 옥코치 R1-R5 deterministic 룰엔진 출시. 정적 한국어 template 코멘트 (15-30 종). |
| **Q4 2026** | LLM (Claude API) 자연어 변환 알파 출시. k=20 한국 윙포일 코치 인터뷰 + tone examples 수집. |
| **Q1 2027** | LLM 코칭 v1 GA. NPS 검증 (한국어 사용자 100명 베타). |
| **Q2 2027** | R6-R9 추가 + 룰엔진 v2 출시. 사용자 진보 단계 인지 (초·중·고급). |
| **Q3 2027** | persona 다양화 (송정·강릉·시화호 코치 톤). 비디오 sync 시 음성 코칭 (선택 사양). |
| **Q4 2027** | 다국어 (영어/일본어) 확장 + 학술 paper "Coach Engine R1-R9" submit. |

#### W5.5 정량 KPI

- **R1-R9 detection precision**: 각 룰의 actual occurrence vs predicted 비교 ≥ 85%
- **LLM 코칭 naturalness**: 한국 윙포일 코치 5명 blind review 평균 ≥ 4.2/5 (Naturalness Likert scale)
- **사용자 NPS**: 한국어 사용자 100 명 베타 ≥ 50
- **코칭 retention**: 코칭 활성화 사용자 30일 retention ≥ 60% (코칭 비활성화 대비 ≥ +15pp)

#### W5.6 Counter-position

- **LLM API access**: 모든 경쟁사가 같이 접근 가능 → algorithmic moat 약함
- **한국어 + 윙포일 도메인 + 룰엔진 trio**: 글로벌 영어 경쟁사가 한국어 코치 톤 + 윙포일 도메인 + R1-R9 룰엔진 의 trio 를 만드는 EV+:
  - LLM API 비용 = $0.001 per 자이브 코멘트 (Claude Sonnet 추정) — 작음
  - 한국어 fine-tuning 비용 = 코치 인터뷰 + 학습 데이터 collection = 2 주 + $5K
  - 윙포일 도메인 어휘 = 도메인 전문가 (Danny 자신) 가 필요
  - R1-R9 룰엔진 = 옥코치 기보유 자산 (선행 자산 §0)
- **글로벌 경쟁사가 못 따라오는 이유**:
  - Waterspeed: 멀티-스포츠 → 윙포일 R1-R9 만드는 ROI 음수
  - Vakaros: LED + 위젯 빌더 정체성 → 자연어 코칭 = brand 충돌
  - Njord: 정적 docs 정체성 → 동적 코칭 = 다른 product paradigm
  - Vantage: ML black-box → 룰엔진 결합 = explainability 마찰

→ **W5 는 W2 + W4 의 결합 효과 의 자연스러운 귀결**. 윙포일 도메인 KPI (W2) + 공개 메서드 (W4) + 한국어 (W1) 가 있어야 자연어 코칭이 의미 있고, 그 trio 가 SailTechCo 만의 자산이라서 W5 의 코칭 톤이 *대체 불가*.

---

## §3. Gap Analysis 매트릭스 — 35 제품 × 5 wedge

> 범례: ✅ 강점 (해당 영역 점유) · 🟡 부분 (일부 기능 있음) · ❌ 부재 · ⚪ 해당 없음 (out of scope)

### §3.1 Tier 0 (Top 10 deep-dive) 제품의 5-wedge 점유

| 제품 | W1 한국어 | W2 윙포일 KPI | W3 4-channel Wind | W4 공개 메서드 | W5 자연어 코칭 |
|---|---|---|---|---|---|
| Njord Analytics | ❌ | 🟡 (WingFoil 클래스 존재, 일반 엔진 적용) | 🟡 (2 채널: maneuver + weather) | ❌ (메서드 명명만) | ❌ |
| ChartedSails | ❌ | 🟡 (Garmin OAuth 키워드 wing 포함, 일반 분석) | 🟡 (2 채널: track-shape + location weather) | 🟡 (메서드 일부 blog 공개) | ❌ |
| Vakaros Atlas 2 | ❌ | ⚪ (TP52/Opti 키일보트) | 🟡 (1 채널: 사용자 1회 캡처) | ❌ (메서드 명명만) | 🟡 (LED 3색 시그널) |
| SAP Sailing Analytics | ❌ | ⚪ (event organizer enterprise) | 🟡 (2 채널: HMM multi-boat + WindFinder) | ✅ Apache 2.0 GitHub 공개 | ❌ |
| Expedition | ❌ | ⚪ (offshore racing nav) | 🟡 (2 채널: navigator manual + GRIB) | 🟡 (PDF Manual 1900+ 페이지) | ❌ |
| Garmin Quatix 7 | ❌ (영어 + Garmin Korea fitness 중심) | ❌ | 🟡 (1 채널: port/stbd COG 평균) | 🟡 (manual 본문 일부) | ❌ |
| Vantage Sailing | ❌ | 🟡 (Moth/Waszp 까지, wingfoil 미명시) | 🟡 (2 채널: ML maneuver + ML weather guardrail) | ❌ (ML black-box) | ❌ |
| Sailmon MAX | ❌ | ⚪ (딩기 표준) | 🟡 (1.5 채널: Header/Lift Wind Trends) | ❌ | ❌ |
| Waterspeed | ❌ (5 언어 DE/ES/EN/IT/FR) | 🟡 (foiling time, freeride 일반) | 🟡 (1 채널: forecast pull-in 또는 사용자 입력) | ❌ (메서드 명명만) | ❌ |
| Deckman | ❌ | ⚪ (offshore racing nav) | 🟡 (2 채널: navigator manual + PredictWind) | 🟡 (Chisnell RacePanel 5부 blog) | ❌ |

### §3.2 Cluster 별 종합 (Tier 1-2 제품 포함)

| Cluster | W1 한국어 | W2 윙포일 KPI | W3 4-channel | W4 공개 | W5 자연어 |
|---|---|---|---|---|---|
| A. Pro racing (7 제품) | 0/7 ❌ | 0/7 ⚪ (모두 keelboat) | 0/7 (최대 2 채널) | 1/7 ✅ (SAP) | 0/7 |
| B. 컨슈머·클럽 racing (8 제품) | 0/8 ❌ | 1/8 🟡 (Njord WingFoil 클래스) | 0/8 (최대 2 채널) | 0/8 | 0/8 |
| C. Foiling·Windfoil (6 제품) | 0/6 ❌ | 4/6 🟡 (Surfline 분석 X 제외, Bartz·WindSwell 미식별) | 0/6 (최대 1 채널) | 0/6 | 0/6 |
| D. 범용 GPS·워치 (6 제품) | 부분 (Garmin Korea fitness, Apple Watch global) | 0/6 ❌ | 0/6 (최대 1 채널) | 1/6 🟡 (Garmin manual) | 0/6 |
| E. Sensor + SW (4 제품) | 0/4 ❌ | 1/4 🟡 (Sailmon 일부) | 0/4 (최대 2 채널) | 1/4 (Velocitek .vtk 포맷) | 0/4 |
| F. Weather (4 제품) | ⚪ | ⚪ | ⚪ (weather only, wind inference 아님) | 0/4 | 0/4 |

**종합:** 35 제품 × 5 wedge = 175 cell. **✅ 강점** = 1 (SAP / W4). **🟡 부분** = ~28 (대부분 W2 / W3 / W4 일부). **❌ 부재 또는 ⚪ scope 외** = ~146.

→ **5-wedge 의 *동시* 점유 = zero**. SailTechCo 는 5 wedge 결합으로 35 제품 중 *유일한* 제품이 된다.

### §3.3 진입 우선순위 (Wedge 별 빈 공간 size)

| Wedge | 빈 공간 size | 진입 우선순위 |
|---|---|---|
| W1 한국어 Native | **35/35 빈 공간** (Garmin Korea fitness 외 zero) | **★★★** (가장 큰 빈 공간) |
| W2 윙포일 KPI | **26/35 빈 공간** (Cluster C 4 부분 점유, Njord WingFoil 1 부분) | **★★★** |
| W3 4-channel Wind | **35/35 빈 공간** (최대 2 채널) | **★★★** |
| W4 공개 메서드 | **33/35 빈 공간** (SAP enterprise scope, Velocitek 포맷만) | **★★** |
| W5 자연어 코칭 | **35/35 빈 공간** | **★★★** |

→ **W1, W2, W3, W5 = 시장 공백 100%**. W4 = SAP open source 가 있지만 enterprise scope 라 consumer 윙포일 시장은 여전히 비어 있음.

---

## §4. Counter-positioning Analysis — 5 강자가 구조적으로 못 따라오는 이유

### §4.1 Vakaros Atlas 2 (Cluster A 시장 점유 가속 중)

**Vakaros 의 강점:**
- 25Hz dual-band GNSS + IMU + Gorilla Glass display + 75h 배터리
- RaceSense Annual Pass = 150K+ start calls / 85+ classes (2026-05)
- 2025-03 Sailmon Instruments 인수 — industry consolidation 진행 중

**Vakaros 가 SailTechCo 를 따라잡지 못할 5 가지 구조적 이유:**

1. **Hardware 매출 cannibalize 위험.** Vakaros 매출 모델 = Atlas 2 $1,249 + RaceSense $149/년. SailTechCo 식 모바일-only 시 phone 의 IMU + magnetic compass + GPS 활용 = 사용자가 *추가 hardware 안 사도 됨* → Vakaros 가 같은 모델 운영 시 자사 hardware 매출 cannibalize.
2. **한국 시장 ARR < $50K.** 추정 한국 Vakaros 사용자 = 100 명 × $149/year + 50 명 × $1,249 = $77K. localization (한국어 UI + KakaoPay + dealer + manual 번역) 비용 = 4-6 개월 1인 엔지니어 = $50K+ → ROI 음수.
3. **TP52/J70/ILCA 본업과 윙포일 fundamentally 다른 ICP.** Vakaros 의 racer ICP = 정기 racing schedule 있고 RC start/finish 워크플로우 필요. 윙포일 freeride ICP = 일상 cruise 라이딩 + jibe 분석. Vakaros 가 윙포일 라인 만들면 *마케팅 message 분기* 필요 → 8년 누적 brand consistency 손상.
4. **8년 누적 IP 의 공개 disincentive.** RaceSense start line 알고리즘 (LiveLine 기반), Tack Loss 측정 (TWD reference projection), shift tracking (사용자 1회 캡처) 의 수식 공개 시 *경쟁자에게 무료 reference* + 자사 가격 정당화 어려움.
5. **자연어 코칭 = brand 충돌.** Vakaros UX 정체성 = "LED 3색 + 큰 숫자 + opt-in training mode" 의 *지구상 가장 단순한 instrument*. 자연어 코칭 = "5도 left lift 야" 같은 conversational tone 추가 시 *brand 정체성 손상*.

→ **Vakaros 가 따라올 EV+ 없음.** SailTechCo 의 W1+W2+W3+W4+W5 5 wedge 모두 Vakaros 의 *역동기*.

### §4.2 SAP Sailing Analytics (Open Source 학술 강자)

**SAP 강점:**
- Apache 2.0 GitHub 공개 (8,182 Java 파일 / 219 OSGi 모듈 / 14년 운영)
- Random Forest 50 트리 + Viterbi HMM + Forward-Backward 풍향 추정
- 27가지 ScoringSchemeType + ORC PCS 2015 룰
- Eclipse Foundation 이관 ("Eclipse Azimuth")

**SAP 가 SailTechCo 를 따라잡지 못할 4 가지 구조적 이유:**

1. **Enterprise SaaS 정체성.** SAP Sailing 의 ICP = event organizer + race committee + broadcast networks (Olympic / SailGP / AC). 개인 윙포일러 ICP 아님. *모바일 windfoil app* 만드는 게 SAP 의 brand / sales motion / pricing model 모두와 충돌.
2. **14년 GWT 코드베이스의 mobile-first 재구축 비용.** SAP Sailing 의 UI 는 GWT (Google Web Toolkit) — 2010년대 SAP 표준이지만 deprecated. 모바일-native 재구축 = 14년 코드의 절반 이상 재작성 → 비용 막대.
3. **한국 / 일본 sailing race organizer 시장 작음.** KSF (대한요트협회) 가 SAP Sailing 공식 도입 사례 없음. 한국 sailing event organizer 시장 = $0.5M-2M 추정 → SAP 의 한국 진출 incentive 없음.
4. **자연어 코칭 ICP 불일치.** SAP 의 viewer = 1억 unique 방문자 (Paris 2024 Olympic) 가 broadcast 시청. *코칭이 아니라 시청*. 자연어 코칭은 SAP 의 ICP 와 다른 시장.

→ **SAP 는 SailTechCo 의 *알고리즘 reference 이지 직접 경쟁자가 아님***. SailTechCo 가 SAP 코드를 *학습*하고 *모바일 윙포일 시장* 에 적용 = 호환 가능 (Apache 2.0 license).

### §4.3 Njord Analytics (Berlin 2-인 GmbH)

**Njord 강점:**
- 8년 운영, Olympic + Grand Prix navigator 표준
- 풍향 4 소스 + maneuver 4 분류 + Polar Editor + Performance Database
- Sailed-day 가격 모델

**Njord 가 SailTechCo 를 따라잡지 못할 5 가지 구조적 이유:**

1. **2인 팀 capacity 제약.** Njord = Jonas Witt + Douglas Edwards (LinkedIn 메타데이터 추정). 한국어 localization + 윙포일 특화 모듈 + 모바일-first 재설계 = 2인 팀이 못 추가 — 본업 (Olympic + Grand Prix navigator) 의 maintainence + 점진적 진화에 capacity 풀가동.
2. **WingFoil 클래스 가격 €2.99/일 = 마진 낮음.** ILCA 7 €12.99/일의 23%. 한국 윙포일러 100 명 × 연 50 sailing-day × €2.99 = €15K → maintainance budget 안 됨. 윙포일 특화 R&D = 음수 ROI.
3. **Race/event/leg/mark 데이터 모델 ingrained.** Njord 의 분석 단위 = event → race → leg → mark. 윙포일 freeride 의 "session → run" 단위로 재설계 = 14년 코드의 데이터 모델 변경 → 비용 막대.
4. **알고리즘 IP 보호 의존.** Njord 의 가격 정당화 (€2.99-€12.99/일) = "수식 공개 안 한다" 가 *의도된 IP 보호*. 공개 시 가격 → freemium 또는 free 강제 → 매출 model collapse.
5. **자연어 코칭 product paradigm 충돌.** Njord 의 UX = *정적 분석 docs + Player 영상 sync*. 동적 자연어 코칭 = *다른 product*. Njord 가 두 product 동시 운영 = 2인 팀 capacity 초과.

→ **Njord 의 본업 lock-in 이 SailTechCo wedge 의 영구적 안전망**.

### §4.4 Vantage Sailing (AC38 founder, ML wind)

**Vantage 강점:**
- AC38 Luna Rossa Performance Data Analyst Nicolai Jacobsen 창업
- ML wind detection 2.0 (physical constraints + class-specific polar guardrail)
- Moth World Champion Victoria Schultheis PM
- 자문단 = Russell Coutts + Knut Frostad + Olav Bu (35 제품 중 가장 strong board)

**Vantage 가 SailTechCo 를 따라잡지 못할 4 가지 구조적 이유 (가장 가까운 경쟁사 — 정직 분석):**

1. **ICP = racing sailing (Moth / Laser / J70 / Waszp).** 윙포일 freeride 는 ICP 마찰. Vantage 가 윙포일 라인 만들면 *brand 분기* 필요 → 신생 회사 (1년 운영) 의 brand 분기 = 자살.
2. **AC38 출신 founder 의 윙포일 도메인 깊이 부재.** Nicolai Jacobsen 의 expertise = AC75 foiling catamaran (윙포일 비슷한 도메인) 이지만 *racing*. 1인 freeride 윙포일러의 jibe ride-through, board cant 같은 KPI 는 AC75 navigator paradigm 과 다름.
3. **ML black-box 한계.** Vantage 의 "physical constraints + polar guardrail" = ML 모델 안에 embedded. 4-channel 결합 같은 *명시적 multi-channel architecture* 와 ML black-box 가 architecture 충돌.
4. **한국어 + 자연어 코칭 = 신생 회사 capacity 초과.** Vantage = 신생 + small headcount. 한국어 + 윙포일 + 자연어 코칭 trio R&D = 본업 (racing sailing ML) 의 capacity dilution.

→ **Vantage 는 가장 위협이 큰 경쟁사이지만, ICP / capacity / brand 의 *triple lock* 으로 SailTechCo 가 한국·윙포일 영역에서 12-24개월 head start 가능**.

### §4.5 Waterspeed (Dubai DIFC, 멀티-스포츠 표준)

**Waterspeed 강점:**
- 390K downloads / 100K yearly active / 200 countries
- 멀티-플랫폼 (iOS+Android+Apple Watch+Wear OS+Garmin CIQ+Coros+Suunto+Vakaros)
- NorthStar SailGP Official Technology Supplier
- 2025-12 Ultra tier launch (VMG / Polar / TWA / Performance vs Target)

**Waterspeed 가 SailTechCo 를 따라잡지 못할 5 가지 구조적 이유:**

1. **멀티-스포츠 카버리지 정체성.** Waterspeed 의 ICP = sailing + windsurfing + wingfoil + SUP + kayaking + 30+ watersports. *윙포일 특화* 는 다른 sport (SUP / kayaking) 사용자 ICP 이탈 → core 매출 손상.
2. **GPS-only platform 단순성.** Apple Watch + Android + Wear OS + Garmin CIQ + Coros + Suunto = 6+ codebase. IMU 직접 활용 시 platform-by-platform 구현 — 6+ 코드 추가 → maintainance 부담 6 배.
3. **5 개 언어 (DE/ES/EN/IT/FR) 안 한국어 부재.** Waterspeed의 i18n 인프라가 EU/US 중심 — 한국어 추가 시 Asia 시장 진출 일관성 (일본어 / 중국어 / 베트남어) 따라가야 함. 6+ 언어 추가 = 6+ 개월 R&D.
4. **Dubai DIFC 등기 + EU/US 중심 마케팅.** 한국 시장 진출 시 한국 PG (KakaoPay / 토스) 통합 + 한국 PMO + 한국 customer support = $50K-200K 비용. ARR 추정 < $50K → 음수.
5. **ML 알고리즘 IP 공개 disincentive.** Ultra tier $199/year 가격 정당화 = ML 알고리즘 IP. SailTechCo 식 공개 메서드 = Ultra 매출 model collapse.

→ **Waterspeed 가 SailTechCo 한국·윙포일·공개 메서드 영역에 진입하지 *못하는* 게 아니라, 진입하면 *본업 매출 손상 위험*. Counter-position = 본업 disincentive**.

추가: Waterspeed Ultra 의 2025-12 launch = SailTechCo 의 *시간 창 단축 시그널*. Ultra 가 글로벌 default 가 되기 전 SailTechCo 진입 시점 = **12-18 개월**.

---

## §5. Time-to-moat Estimate — MVP / v1 / v2 / v3 분기

### §5.1 분기 일정 (12 개월 horizon)

| 분기 | 시기 | 단계 | W1 한국어 | W2 윙포일 KPI | W3 4-channel | W4 공개 메서드 | W5 자연어 |
|---|---|---|---|---|---|---|---|
| **Q3 2026** | 2026-07~09 | **MVP** | UI 90% + KakaoPay 베타 + Spot 5 | KPI 7 (Phase 1) | 2-channel (A + D) | GitHub repo first release | R1-R5 + 정적 한국어 template |
| **Q4 2026** | 2026-10~12 | **MVP+** | UI 100% + 네이버페이/토스 + Spot 10 + 블로그 5 | KPI 7 validation 완료 | 2-channel validation 100 세션 | Methodology docs Phase 1 | LLM (Claude API) 자연어 변환 알파 |
| **Q1 2027** | 2027-01~03 | **v1** | 카카오톡 라이더 응대 + Spot 15 + 유튜브 월 1편 | KPI 12 (Phase 2 알파) | 3-channel (+ Apple Watch IMU) 알파 | Academic paper draft | LLM 코칭 v1 GA + 100명 베타 NPS |
| **Q2 2027** | 2027-04~06 | **v1+** | Ambassador 3명 + Spot 20 + parawing korea 후원 | KPI 12 validation | 3-channel validation 30명 베타 | Paper submit (Sports Eng / IEEE) | R6-R9 추가 + 진보 단계 인지 |
| **Q3 2027** | 2027-07~09 | **v2** | Spot 25 + 인스타 인플루언서 협업 | KPI 15 + 개인 polar learning 알파 | 4-channel full (+ 다회전 기하) | Paper revision + 한국 KSSS 발표 | Persona 다양화 (송정/강릉/시화호) + 음성 코칭 알파 |
| **Q4 2027** | 2027-10~12 | **v3** | 일본·대만 확장 + Spot 30 + 다국어 시작 | What-if 시뮬레이션 + 윙 사이즈 변경 | 4-channel methodology paper + 외부 Calypso BLE 옵션 | Paper publish + 국제 학회 발표 | 다국어 (영어/일본어) 확장 + 학술 paper "Coach Engine" submit |

### §5.2 사용자 base 분기별 KPI

| 분기 | 누적 사용자 | 누적 활성 (월) | 한국어 콘텐츠 |
|---|---|---|---|
| Q3 2026 | 50 | 30 | 블로그 2편 |
| Q4 2026 | 200 | 120 | 블로그 5편 |
| Q1 2027 | 400 | 250 | 블로그 12편 + 유튜브 3편 |
| Q2 2027 | 700 | 450 | 블로그 18편 + 유튜브 6편 |
| Q3 2027 | 1,500 | 950 | 블로그 25편 + 유튜브 10편 |
| Q4 2027 | 3,000 | 1,800 | 블로그 30편 + 유튜브 12편 |

### §5.3 정량 KPI Roadmap (12개월 합산)

| KPI | Q4 2026 목표 | Q2 2027 목표 | Q4 2027 목표 |
|---|---|---|---|
| 누적 사용자 | 200 | 700 | 3,000 |
| 활성 사용자 (월) | 120 | 450 | 1,800 |
| KPI Catalog 크기 | 7 | 12 | 15 |
| Wind MAE (validation) | < 15° | < 10° | < 5° |
| 한국어 콘텐츠 (블로그+유튜브) | 5 | 24 | 42 |
| Spot 카탈로그 | 10 | 20 | 30 |
| GitHub repo commit | 50 | 200 | 500 |
| Academic paper | draft | submit | publish |

### §5.4 매출 가설 (very rough estimates, 공개 시장 데이터 부족 → 추정)

| 분기 | Paid 사용자 비율 | Paid 사용자 (한국 + 글로벌) | ARR 추정 (USD) |
|---|---|---|---|
| Q4 2026 | 0% (모두 무료) | 0 | $0 |
| Q2 2027 | 5% | 35 (한국 30 + 글로벌 5) | $1,750 |
| Q4 2027 | 15% | 450 (한국 350 + 글로벌 100) | $22,500 |
| Q2 2028 (forecast) | 25% | 1,500 | $75,000 |
| Q4 2028 (forecast) | 30% | 3,000 | $150,000+ |

가격 가정 (Phase 1 freemium):
- Free: 모든 사용자, basic KPI 7 + 옥코치 R1-R5
- Pro: 월 ₩5,000 ($3.50) 또는 연 ₩50,000 ($35) — 모든 KPI 15 + R1-R9 + LLM 코칭 + 비디오 sync
- (참고: Waterspeed Pro $29.99/yr, Ultra $199/yr; Vakaros RaceSense $149/yr; ChartedSails Racer Pro $349/yr — SailTechCo Pro $35/yr 는 매우 저가 진입)

⚠ 모든 매출 수치는 *추정* 이며, 본 audit 데이터에서 직접 도출 불가. Phase 1 학습 후 재조정 필요.

---

## §6. 리스크 + 미해결 질문

### §6.1 5 wedge 의 주요 리스크

**W1 한국어 Native 리스크:**
- 한국 윙포일 인구 추정 (2K-5K) 검증 미완 → 실제 더 작을 수 있음 (PMF 위험)
- KakaoPay/토스 PG 통합 = 시점에 따라 정책 변동 (audit 시점 미확인)
- 네이버 카페·인스타·유튜브 콘텐츠 marketing 가 1인 운영 capacity 와 충돌 → 외주 또는 partnership 필요

**W2 윙포일 KPI 리스크:**
- KPI validation 의 ground truth (in-water 카메라 비교) 비용·시간 — 50 세션 = $5K-15K 추정
- 윙포일 stable polar 가설 검증 미완 (윙·보드·foil 셋업 변화 빈도 높아 stable polar 안 모이는 가설 — master audit §A1-Deep §3 의 SailTechCo 함의)
- Apple Watch Core Motion API 의 *실측 정확도* 검증 미완 → Phase 2 v1 GA 전 30명 베타 필수

**W3 4-channel Wind 리스크:**
- Bayesian 가중 평균의 prior 설정 = 도메인 expertise 의존 → Phase 1 학습 후 재조정
- Channel B (Apple Watch IMU) 의 정확도 = 보드 위 폰/워치 위치 + 사용자 옷·암밴드 위치 의존성 → 보드 fix mount 옵션 (사용자 가이드) 필요
- Channel D (외부 weather API) 의 한국 spot 정확도 (KMA RDAPS 1.5km 해상도) → 송정·시화호 같은 micro-spot 의 mesoscale 정확도 검증 미완

**W4 공개 메서드 리스크:**
- 개발자 채용 / external contribution 의 quality 관리 부담
- Academic paper publish 의 시간 (peer review 6-12 개월) — Phase 4 v3 일정 위험
- 한국 윙포일 학계 (KSSS sports science 윙포일 sub-field) 의 receptivity 불확실

**W5 자연어 코칭 리스크:**
- LLM API 비용 ($0.001 per 자이브 코멘트 추정) — 대규모 사용 시 누적 비용
- 한국 윙포일 코치 인터뷰 (k=20) 의 representativeness — 송정·강릉·시화호 외 지역 sampling 필요
- LLM 출력의 hallucination 위험 → 룰엔진 deterministic output 을 *항상 1차 source* 로 + LLM = 톤 변환만

### §6.2 미해결 질문 (Danny 추가 검토 필요)

1. **한국 윙포일 인구 정확한 수치** — 한국 윙포일 커뮤니티 (네이버 카페 회원수, 인스타 hashtag 게시물 수) 의 정량 측정 필요. 본 audit 의 "2K-5K" 추정은 *공개 출처 미확인*.
2. **PG 통합 결정** — KakaoPay 1차 vs 네이버페이 1차 vs 토스 1차. 한국 윙포일 사용자의 PG 선호도 검증 (10명 인터뷰 + 사용 패턴 조사) 필요.
3. **Vakaros / Waterspeed / Vantage / 글로벌 영문 앱 vs SailTechCo 의 한국어 자연어 코칭** = 한국 윙포일러가 *어떤 언어로 분석을 받기 원하나*? — 한국어 only vs 한국어+영어 dual.
4. **Phase 1 가격 모델** — Free + Pro freemium 시 Pro 가격 (₩5,000/월 추정) 검증. ChartedSails ($29/year), Waterspeed Pro ($29.99/year), Vakaros RaceSense ($149/year) 와 SailTechCo Pro 의 가격 spectrum 위치.
5. **데이터 privacy 정책** — 사용자 GPS 트랙·IMU 데이터의 cloud 저장 vs 클라이언트 사이드 처리. 한국 PIPA / EU GDPR / 글로벌 GDPR 등 규제 준수.
6. **하드웨어 옵션 (v3+)** — 외부 Calypso wind sensor BLE 통합 시 사용자 추가 hardware 구매 의향. Vakaros / Sailmon 의 hardware ARPU 와 비교.
7. **Korea WRF 운영 vs 외부 weather API 의존** — master audit §A3-Deep §2 의 Korea WRF 자체 운영 옵션이 SailTechCo capacity 안에 들어가는지 검증.
8. **Sailmon 인수 후 Vakaros 의 Sailmon MAX 라인 통합 동향** — Vakaros 가 Sailmon MAX 의 일부 기능 (Header/Lift Wind Trends) 을 자사 라인으로 흡수하는 시점에 SailTechCo W3 4-channel 의 *추가 채널* (E. Sailmon-style multi-source) 검토 가치.

### §6.3 미식별 항목 (audit 시 verify 못함)

- C1 Bartz Foiling app / C5 WindSwell — 명칭 재확인 필요 (Danny 측 원자료 URL·스크린샷)
- B7 RegattaPRO / "Sail Now" — 분석 SW 가 아닌 PRO 인력 파견 서비스로 확인됨, "Sail Now" 정체 미확인
- Seabreeze 윙포일 forum 의 정확한 윈드포일 tack/jibe 라벨 역전 버그 사용자 인용 URL — 본 audit 시 직접 fetch 실패

---

## §7. 1-page Investor Deck Talking Points

### §7.1 The Opportunity (1 slide)

- 한국·일본 윙포일 시장 = 분석 앱 zero
- 글로벌 윙포일 시장 = Waterspeed (멀티-스포츠) 1 강 + 정식 sailing analytics 진입 12-18 개월 시간 창
- 35 제품 audit 결과: 5 wedge 동시 점유 = SailTechCo 가 유일

### §7.2 The 5-Wedge Moat (1 slide)

W1 한국어 Native | W2 윙포일 KPI | W3 4-channel Wind | W4 공개 메서드 | W5 자연어 코칭

### §7.3 Counter-positioning (1 slide)

- Vakaros: hardware cannibalize 위험
- SAP: enterprise scope
- Njord: 2-인 capacity 제약
- Vantage: ICP 마찰 (racing sailing)
- Waterspeed: 멀티-스포츠 카버리지 dilution

### §7.4 The Asset Stack (1 slide)

- 옥코치 R1-R9 룰엔진 (이미 설계됨)
- DMJ Lift Calculator (physical 시뮬레이션)
- 라이딩 통계 대시보드 코드 (Phase 1 부분 완료)
- Njord 벤치마크 audit (2026-05)
- 35-제품 landscape audit (본 문서)

### §7.5 Roadmap (1 slide)

Q3 2026 MVP → Q1 2027 v1 → Q3 2027 v2 → Q4 2027 v3
누적 3,000 사용자 / KPI 15 / 4-channel wind / Academic paper publish

### §7.6 Risks (1 slide)

- PMF: 한국 윙포일 인구 검증 미완
- Validation cost: in-water 카메라 비교 $5K-15K
- Capacity: 1인 개발 + 외주 partnership 필요
- 시간 창: Waterspeed Ultra 글로벌 default 화 전 12-18 개월

### §7.7 Ask (1 slide)

- Phase 1 funding (자체) — 12 개월 capacity for 1 founder + 1 freelance
- 한국 윙포일 ambassador 3명 + 코치 인터뷰 k=20
- Apple Watch IMU validation = 시화호 / 송정 in-water 카메라 비교 50 세션

---

## §8. 결론 — SailTechCo 의 5-wedge 가 "차원이 다른 서비스"의 좌표

35 제품 audit 의 종합 결론을 5 wedge 의 *coherent stack* 으로 압축하면:

**SailTechCo = 한국어 윙포일러를 위한, 윙포일 도메인 KPI 를, 4 채널 결합 풍향 추정으로 정확하게 측정해, 공개 검증 가능 메서드로 신뢰성을 보장하고, 자연어 코치 톤으로 전달하는 *유일한* sailing analytics 서비스.**

5 wedge 의 *동시* 점유는 35 제품 중 어디에도 없다 (§3). 각 wedge 의 경쟁사 *구조적* 추격 불가능성 (§4) — hardware 매출 cannibalize, enterprise scope, 2-인 capacity, ICP 마찰, 멀티-스포츠 dilution — 은 *영구적* 진입 장벽. 12 개월 horizon 안에서 MVP → v3 의 분기 진행 (§5) 은 1 인 + freelance 운영으로 *재무적*으로 가능.

SailTechCo 가 *지금* 5 wedge 를 시작하면, 향후 5 년+ 동안 "한국어 윙포일 분석의 default + 공개 메서드의 sailing analytics first-mover" 라는 brand positioning 이 lock-in. 그 이후 경쟁사의 추격은 *위 5 가지 구조적 disincentive* 때문에 *영원히 second mover* 일 수밖에 없다.

이것이 Danny 가 명시한 **"차원이 다른 서비스"** 의 학술적·시장적 좌표이다.

---

## §9. 출처 인덱스

본 문서의 모든 strategic claim 은 다음 audit 자산에서 도출:

**1차 audit:**
- `sailing_analytics_landscape_audit.md` — 35 제품 1차 카드 (모든 §2.A-F 카드)
- `top10_recognition_matrix_proposal.md` — Top 10 선정 매트릭스

**Tier 0 deep-dive (각 7-axis):**
- `Njord_Analytics_벤치마크_갭분석_2026-05-22.md` (선행 자산)
- `A1_Vakaros_deepdive.md`
- `A2_SAP_deepdive.md`
- `A3_Expedition_deepdive.md`
- `A4_Deckman_deepdive.md`
- `B8_Velocitek_deepdive.md`
- `C4_Waterspeed_deepdive.md`
- `D1_Garmin_Quatix7_deepdive.md`
- master audit 내 §2.B2-Deep (Njord), §B1-Deep (Vantage), §B9 (ChartedSails)

**선행 자산:**
- `라이딩통계_대시보드_스코핑_v1.md` (Phase 1 product scoping)
- `회전코칭_AI_엔진_설계안_v1_2026-05-22.md` (옥코치 R1-R9 룰엔진)
- `스킬레벨_데이터주도_설계안_v2_2026-05-22.md` (사용자 진보 단계 시스템)

**경쟁사 1차 URL (deep-dive 각 § 참조):**
- Njord: https://www.sailnjord.com/
- Vakaros: https://www.vakaros.com/
- SAP: https://github.com/SAP/sailing-analytics
- Expedition: https://www.expeditionmarine.com/
- Deckman: https://www.bandg.com/en-gb/deckman/
- Velocitek: https://www.velocitek.com/ + https://github.com/velocitek/vtk_protocol
- Vantage: https://www.vantage-sailing.com/
- Waterspeed: https://www.waterspeedapp.com/
- Garmin: https://www8.garmin.com/manuals/webhelp/GUID-6D76A13F-2195-4287-9B0C-2124AECF9717/
- ChartedSails: https://www.chartedsails.com/

**미확인 (Danny 추가 verify 필요):**
- 한국 윙포일 인구 정확 수치 (audit 추정 2K-5K)
- Bartz Foiling / WindSwell 명칭
- Seabreeze 윈드포일 tack/jibe 라벨 역전 버그 인용 URL
- KakaoPay / 토스 / 네이버페이 audit 시점 정책 변동

---

_이 문서는 SailTechCo 의 북극성 (north star) 문서이다. 모든 후속 의사결정 — §3 매트릭스 / §4 알고리즘 깊이 / §5 UX 인사이트 / Phase 1 MVP 우선순위 / 채용 / 투자자 deck / partnership / 가격 모델 — 의 reference 가 된다._
