# 3D 프린터 · DIY 장비 조사 (2026-09-01)

옥대표 지시로 코웍 에이전트가 조사. **원문 전체는 이 문서**이고, 못 채운
항목은 맨 아래 재조사 목록에 남겼다.

---

## 결론 3줄

1. **FDM 이다. 레진 아니다.** 레진은 밀폐는 좋지만 자외선에 황변·취성화되고
   TPU 를 못 뽑는다. 케이스+스트랩+하네스 부품을 한 대로 하려면 FDM.
2. **프린트만으로 방수는 안 된다.** O링 홈 설계 + 규격 O링이 필수.
   현실적 목표 IP65~67(무보증).
3. **"풋스트랩 재질로 하네스"는 하지 말 것.** 하중이 아니라 **카테고리가
   다르다** — 윙 하네스 라인은 웨빙이 아니라 **Dyneema 로프 + PU 튜브**다.

## 🎯 가장 중요한 발견 — RaceBox 공식 CAD 무료 배포

RaceBox 가 `RaceBox Mini Defeaturized.step` 을 공식 배포하고, 페이지에
"다운로드해서 커스텀 케이스·슬리브·클램프를 설계하라"고 직접 적어 놨다.
치수 실측이 필요 없다.
→ https://www.racebox.pro/products/racebox-mini/cad-download

## 프린터

| 기종 | 챔버 | 국내 최저가 | 판정 |
|---|---|---|---|
| **Bambu Lab P2S** | 밀폐(수동), 베드 110°C | **799,000원** | **🥇 1순위** |
| Bambu Lab P1S | 밀폐(수동) | 629,000원 | 예산 빠듯하면. ASA 워핑 감수 |
| Bambu Lab X2D | **능동 가열 65°C** | 1,099,000원 | ASA 를 크게·자주 뽑으면 |
| Elegoo Centauri Carbon | 밀폐(비가열) | 확인 못 함 | — |
| Prusa CORE One | 능동 55°C | 국내가·A/S 확인 못 함 | — |

- 국내 공식총판 **3D몬**(02-546-2617), 해외직구가 오히려 **더 비쌈**(P1S 직구 72만 vs 국내정품 62.9만)
- **AMS 콤보 사지 말 것** — TPU 는 AMS(PTFE 튜브)로 못 돌린다. 좌굴·잼. 외부 스풀 직결 필수
- 빌드볼륨은 선택 기준이 아니다(케이스 100×80×40, 버클 50mm 이하 → 256³ 과잉 충분)
- ⚠ P1S 챔버 능동/수동 표기가 자료마다 충돌. bambulab.com 이 크롤링 차단이라 1차 확인 못 함 → **수동으로 간주**
- X1C 는 2026-03-31 단종, 후속이 X2D

## 소재

**케이스 본체: ASA 1순위 / PETG 2순위. PLA 절대 금지.**

| 소재 | 자외선 | 해수·흡습 | 내열 | 판정 |
|---|---|---|---|---|
| ASA | 최상 (ABS 대비 10배) | 흡수 안 함 | HDT 85~102°C | ✅ 1순위 |
| PETG | 중간 | 우수 | 연화 ~70°C | ✅ 2순위 (마운트엔 충분) |
| PA(나일론) | 약함 | **PA6 흡수 9~10%** | 좋음 | ❌ 해수 부적합 |
| PLA | ❌ | **가수분해** | **Tg 55~65°C** | ❌ **금지** |

PLA 배제 근거: 직사광 아래 어두운 표면 실측 77°C 에서 1시간 내 변형 사례.
보드 데크 위 검은 케이스가 그 범위다.
실사용 근거: 카이트보드 트래커 마운트(TrackFin)가 **PETG 프린트**로 시판 중.

**유연 부품: TPU 95A 부터.** 85A 는 다이렉트 드라이브 필수에 세팅이 까다롭고,
패딩은 어차피 EVA 폼이 담당한다.
⚠ **TPU 는 자외선에 취약** — 상시 햇볕 노출 부품은 TPU 말고 ASA.

**국내 가격(다나와 최저가)**: ASA 24,200 / TPU 95A 29,500~33,000 /
PETG 17,900 / 필라멘트 건조기 58,910 (TPU·ASA 흡습성이라 건조기 사실상 필수)

## 방수 실링 — O링이 답

| 방식 | 현실 등급 |
|---|---|
| 프린트만 (벽 3~5겹, 압출 105~110%) | IPX4 |
| + 아세톤 스무딩 / 에폭시 코팅 | 개선되나 단독 불충분 |
| **+ 규격 O링 페이스 씰 + 볼트 다수** | **IP65 안정, IP67 목표 가능** |

설계 수치: 압축률 **15~25%**, 홈 충진율 **60~85%**(100% 절대 금지 —
열팽창 여유). 소형 케이스 실전 예: 홈 2mm 폭 × 1.5mm 깊이 + CS 1.5mm O링.
볼트는 촘촘·균등(씰 실패는 거의 항상 접합면에서 시작).

**O링 재질: EPDM.** 해수·자외선 모두 우수, 보트 가스켓 표준.
NBR 은 오존/UV 취약이라 비추. FKM(바이톤)은 대안이나 비쌈.

## GNSS 제약 (확인된 사실)

- **탄소섬유 함유 필라멘트 절대 금지** (PLA-CF/PETG-CF/PA-CF) — 전도성이라
  패러데이 케이지로 작동해 위성 신호 차단
- 금속 도장·금속 플레이크 페인트도 금지
- 비전도성 플라스틱(ASA·PETG·PC·나일론)은 RF 투과 OK → **ASA/PETG 그대로**

## 충전 — 포트를 만들지 말 것

배터리 20시간+ 이므로 **충전할 때만 케이스를 여는 게 가장 현실적**이다.
Qi 무선충전 내장은 가능하나 제약이 있다 — 공극 4mm 초과 또는 정렬 ±3mm
벗어나면 효율 급락 → 코일 위 벽두께 1.5~2mm 로 얇게 설계해야 함.
방수 자석 커넥터의 해수 내구성은 확인 못 함.

## RaceBox 기종 — Mini vs Mini S

| | Mini | Mini S |
|---|---|---|
| 내부 저장 | **없음 — 폰 BT 상시 연결 필수** | **있음** (25Hz 130분 / 10Hz 325분) |
| 배터리 | 1100mAh, 20시간+ | 동일 |
| 방수 | **"Splash Resistant"** — IP 등급 없음 | 동일 |
| 충전 | USB-C + 방수/방진 커버 동봉 | 동일 |
| 마운트 | 1/4"-20 UNC, 실리콘 패드, 벨크로 | 동일 |
| 무게 | 106 g | 동일 |
| 치수(mm) | **공식 미기재** (CAD 로 해결) | 미기재 |

⚠ **본인 기기가 어느 쪽인지 확인할 것.** 25Hz CSV 를 폰 없이 뽑았다면 Mini S.
⚠ 검색 요약에 나오는 "integrated magnets" 는 공식 페이지에 없음(상위 모델과 혼동)

**기성 방수 케이스는 시중에 없다** — 직접 만드는 게 맞다.
(MakerWorld/Thingiverse 의 RaceBox 커버들은 전부 방수 아님)

## 하네스 — 사서 쓸 것

윙 하네스 라인 상용품 구조: **Gottifredi Maffioli Dyneema 코어 + Festo PU
튜브 + 50mm 벨크로 웨빙 + Inox 오벌 링**. 표준 길이 70~90cm. €30~99.
흥미롭게도 여기에도 3D 프린트 부품이 들어가는데, **로프가 하중을 받고
프린트 부품은 형상 유지** 역할이다 — 우리도 그 선을 지켜야 한다.

**자작 금지 사유 3가지**
1. 카테고리가 다르다 (웨빙 ≠ Dyneema 로프)
2. 웨빙보다 **봉제가 먼저 터진다** — 무거운 웨빙 3~4겹 바텍은 가정용
   재봉틀로 불가능. 공업용 클래스 필요
3. 쿠팡·알리 웨빙은 **인장강도 미표기**가 대부분 — 계산 자체가 불가능

**⚠ 상용 하네스·스프레더바 제조사는 파단강도를 공개하지 않는다**(제품
페이지 직접 확인). "상용품 대비 얼마나 약한가"를 정량 비교할 근거가 없다.

### 하중 계산 — 두 갈래가 같은 자릿수로 수렴

| 출처 | 지속 | 설계(돌풍) | ×5 안전율 |
|---|---|---|---|
| **우리 물리 모델** (83kg 일직선 균형, 22kt·4.5㎡) | **1.21 kN** | 2.8 kN | **14 kN** |
| 코웍 독립 추정 (78kg, 분담률 가정) | 0.5~0.8 kN | 1.5~2.3 kN | 7.5~11.5 kN |

우리 모델 값이 더 크고 근거가 낫다(실측 보정된 옆힘 계산). **1차 하중경로
목표 14 kN 을 쓴다.** 25mm 폴리에스터 웨빙이 8~12 kN 대라 **단일 경로로는
빠듯** → 폭 확대 또는 경로 분할.
독립 추정이 같은 자릿수로 떨어진 건 위생 검사로 의미가 있다.

## 안전 — 놓치기 쉬움

ASA/ABS 는 가열 시 **스티렌·아크릴로니트릴 VOC + 초미세입자** 방출
(스티렌 실측 0.29~113.10 μg/min). **밀폐 챔버 + HEPA + 활성탄 2단 + 환기**
필요. 활성탄은 포화되면 재방출하므로 주기 교체. **거주공간 무필터 ASA 금지.**

## 총 견적 (2026-09, 원)

| 항목 | 금액 |
|---|---|
| Bambu Lab P2S 정품 단품 | 799,000 |
| ASA 1kg | 24,200 |
| TPU 95A 1kg | 33,000 |
| PETG 1kg | 17,900 |
| 필라멘트 건조기 | 58,910 |
| EPDM O링 세트 | ~15,000 (추정) |
| **소계** | **약 948,000** |
| 웨빙·EVA·실·316SUS | 확인 못 함 (추정 5~15만) |
| 하네스 라인 **완제품** | 5~15만 |
| **총합** | **약 110만~130만원** |

## 재조사 필요 (웹검색 예산 소진으로 못 채움)

1. 쿠팡 직링크·정확한 쿠팡가 (쿠팡 403 차단)
2. bambulab.com 1차 사양 (403) — P1S 챔버 표기 충돌
3. **웨빙 인장강도 규격표**(MIL-SPEC/EN 566), 국내 MBS 표기 웨빙 판매처
4. 316 vs 304 해수 부식 1차 출처, 국내 마린 하드웨어
5. 마린 스레드(V-69/V-92, Tenara) 국내 판매처
6. 하네스 돌풍 동하중 배수(×2~3) 실측 출처 — 현재는 추정
7. 공업용 재봉틀 요구 등급
8. GNSS 안테나 위 플라스틱 두께 가이드
9. 방수 자석 커넥터 해수 내구성
10. Elegoo Centauri Carbon 현재 국내가, Prusa CORE One 국내 A/S
11. 국내 EPDM 규격 O링 소매처
12. **engineered knit / 가변밀도 TPU 격자** — 추가 지시가 예산 소진 뒤 도착해
    반영 못 됨. 별건으로 재조사 필요

## 주요 출처
- RaceBox: [Mini](https://www.racebox.pro/products/racebox-mini) · [Mini S](https://www.racebox.pro/products/racebox-mini-s) · [기술사양](https://www.racebox.pro/products/racebox-mini/tech-specs) · [CAD](https://www.racebox.pro/products/racebox-mini/cad-download)
- 소재: [MatterHackers 옥외용](https://www.matterhackers.com/articles/the-best-3d-printing-filament-for-outdoor-use) · [Sovol ASA vs PETG](https://www.sovol3d.com/blogs/news/best-filament-for-outdoor-3d-prints-asa-vs-petg-vs-abs) · [3D Printerly PLA 내열](https://3dprinterly.com/will-pla-petg-or-abs-melt-in-a-car-or-the-sun/)
- 실링: [Global O-Ring 홈 설계](https://www.globaloring.com/o-ring-groove-design/) · [Fictiv 방수 설계 101](https://www.fictiv.com/articles/nothing-gets-in-waterproof-enclosure-design-101-and-ip68)
- GNSS: [ARK Electronics GPS 배치](https://docs.arkelectron.com/knowledge-base/knowledge-base/gps-placement) · [탄소섬유와 GPS](https://www.supreemcarbon.com/article/does-carbon-fiber-block-gps-supreem-carbon-1.html)
- 하네스: [ION Wing Harness Line](https://www.ion-products.com/en/us/products/wing-harness-line-48220-7070) · [Wingman Loop v2](https://www.wingman-products.com/product/wing-foil-harness-line-mono/)
- FDM vs 레진: [Formlabs 수밀 3D프린팅](https://formlabs.com/blog/watertight-3d-printing/) · [FacFox TPU vs 플렉시블 레진](https://facfox.com/docs/kb/comparison-of-3d-printed-tpu-rubber-and-other-flexible-resins)
- 국내: [3D몬 총판](https://www.3dmon.co.kr/) · [덕유항공](https://dyairkorea.com/) · 다나와 [P1S](https://prod.danawa.com/info/?pcode=75723509) · [P2S](https://prod.danawa.com/info/?pcode=99839798)
- 안전: [NIH 3D프린터 배출](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8915804/)
