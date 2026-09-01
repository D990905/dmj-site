# 스트럿 장착 디스플레이 조사 (2026-09-01)

옥대표: "디스플레이가 중요한데 스트럿에 부착할건데 방수되는 필름형
디스플레이 없을까? 충전되는걸로."

## 결론 먼저

**필름형(플렉시블) 방수 디스플레이는 완제품으로 살 수 있는 게 사실상
없다.** 유연 e-paper 패널은 존재하지만 (Plastic Logic 등) 모듈 단위로
팔리고, 방수·배터리·무선·마운트는 전부 직접 만들어야 한다.

대신 **이 용도로 이미 만들어진 물건이 있다** — 세일링/포일링용 계기.
Vakaros Atlas 2 가 현재 이 시장의 기준이고, 포일링 클래스에서 많이 쓴다.

## 왜 '필름형' 을 고집하면 손해인가

스트럿(핸드윙 중앙 스파)에 붙이는 목적은 **주행 중 흘깃 보는 것**이다.
그러면 화면 기술보다 이 셋이 먼저다:

1. **직사광 가독성** — 물 위는 최악의 조명 환경이다. OLED 는 밝지만
   태양 아래서 씻긴다. **transflective LCD** 나 **e-paper** 가 맞다.
2. **완전 밀폐** — 충전 포트가 방수의 최대 약점이다. 정답은 방수 커넥터가
   아니라 **포트를 아예 없애는 것** → Qi 무선충전. Atlas 2 가 그렇게 한다.
3. **무게** — 핸드윙에 붙는 무게는 팔로 계속 든다. 보드에 붙이는 것과
   완전히 다른 제약이다. 여기서 필름형의 장점(얇고 가벼움)이 진짜로
   의미가 생긴다 — 다만 배터리·방수 케이스 무게가 결국 지배한다.

## 기성품 — Vakaros Atlas 2

| 항목 | 사양 |
|---|---|
| 화면 | 4.4" **transflective LCD**, 고릴라 글래스 본딩, 91 ppi, 직사광 가독 |
| 코팅 | 발수(hydrophobic) — 물이 맺히지 않고 흘러내림 |
| 배터리 | 4600 mAh, **100시간 이상** |
| 충전 | **Qi 무선충전** — 충전 포트가 없다(방수의 핵심) |
| 백라이트 | 적응형 적색 백라이트(야간·새벽) |
| 마운트 | 퀵릴리즈 + 벨크로 스트랩 |
| 센서 | GNSS + 모션 센서, **힐·피치** 측정 |
| 방수등급 | 공식 IP 등급은 확인 못 함 (발수 코팅만 명시) |

참고: Sailmon 은 Vakaros 에 인수됐고 MAX 는 단종. Atlas 2 로 통합됐다.

**우리 프로젝트 관점에서 중요한 점**: Atlas 2 는 힐·피치를 이미 재고
있다. [[backlog]] B3(자세 해 + 리웨이)에 필요한 데이터를 자체적으로
갖고 있다는 뜻이라, RaceBox 를 대체하거나 보완할 수 있다.

## 직접 만든다면 — 기술 선택

| 기술 | 직사광 | 소비전력 | 유연 | 이 용도 적합성 |
|---|---|---|---|---|
| **e-paper (E Ink)** | 최상 (반사형) | 최저 (정지 시 0) | 유연 패널 있음 | 숫자 몇 개 흘깃 보기엔 최적. **갱신 느림**(수백 ms~수 초) — 실시간 코칭엔 부적합할 수 있음 |
| **transflective LCD** | 좋음 | 낮음 | 아니오 | Atlas 2 가 쓰는 방식. 갱신 빠름 |
| **Memory-in-pixel LCD** (Sharp) | 좋음 | 매우 낮음 | 아니오 | 소형 계기에 자주 쓰임 |
| **flexible OLED** | 나쁨 | 높음 | 예 | 얇지만 물 위에서 안 보인다. 부적합 |

E-paper 의 갱신 속도가 결정적 갈림길이다. **"속도 12.3kt" 를 1~2초마다
보여주는 것**이면 e-paper 로 충분하고 배터리가 몇 주 간다. **"당겨라/
열어라" 실시간 코칭**([[backlog]] B6)이면 갱신이 따라오지 못한다.

## 남은 확인 거리

- Atlas 2 의 공식 IP 등급 (침수 깊이·시간)
- Atlas 2 무게 — 핸드윙 스트럿 장착 가능성을 가르는 숫자인데 확인 못 함
- 유연 e-paper 모듈의 실제 조달 가능성·최소 주문 수량 (Plastic Logic,
  Good Display 등 — 모듈 단위 소량 판매 여부)
- 스트럿(인플레이터블) 위 진동·충격이 유리 본딩 화면에 주는 영향

## 출처
- Vakaros Atlas 2 — https://www.vakaros.com/products/atlas-2
- Sailmon MAX 단종·Vakaros 인수 — https://sailmon.com/max/
- 세일링 계기 개요(Velocitek·Sailmon·Vakaros) — https://www.upffront.com/blog/sailing-equipment-1/sailing-instruments-from-velocitek-sailmon-and-vakaros-introduction-from-upffront-36
- 유연 e-paper 패널 — https://www.good-display.com/product/82/
- E Ink 웨어러블 사례(878 Project One 세일링 재킷, Plastic Logic 유연 E Ink) — https://www.e-ink-info.com/e-ink-devices/wearables
