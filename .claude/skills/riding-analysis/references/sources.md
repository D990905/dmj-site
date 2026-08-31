# 출처와 라이선스 — 2026-08-31 직접 확인

Codex 조사 결과를 그대로 믿지 않고 URL·라이선스를 직접 확인한 기록.
**두 건이 틀렸다** (아래 ⚠).

## 오픈소스

| 저장소 | 라이선스 | 상태 | 쓸 만한 것 |
|---|---|---|---|
| [eclipse-sailing-analytics/sailing-analytics](https://github.com/eclipse-sailing-analytics/sailing-analytics) | **Apache-2.0** ✓ | 활성 (Java) | 현재 upstream 기준 저장소 |
| [SAP/sailing-analytics](https://github.com/SAP/sailing-analytics) | **Apache-2.0** ✓ | 활성 ★34 | 기동 HMM 풍향추정 전체 구현 |
| [dakk/gweatherrouting](https://github.com/dakk/gweatherrouting) | GPL-3.0 ✓ | 활성 ★84 | 폴라 파싱·라우팅. **GPL — 우리 코드에 못 넣는다** |
| [hoeken/Polarizer](https://github.com/hoeken/Polarizer) | GPL-3.0 ✓ | 2022 정지 | 폴라 생성. GPL |
| [eburi/polar_analyzer](https://github.com/eburi/polar_analyzer) | MIT ✓ | 활성 | 폴라 분석, 작음 |
| [lanceberc/polarize](https://github.com/lanceberc/polarize) | ⚠ **라이선스 없음** | 2023 정지 | Codex 는 MIT 라 했으나 **라이선스 파일이 없다 → 재사용 불가**. 읽고 참고만 |
| [ieb/sailinstruments](https://github.com/ieb/sailinstruments) | ⚠ **ISC** (Apache 아님) | **보관됨(archived)** | Codex 는 Apache-2.0 이라 했으나 ISC. 쓰려면 ISC 고지 |

**결론:** 실제로 코드를 참고할 값어치가 있는 건 SAP/Eclipse (Apache-2.0,
상업 이용 가능, 고지만 하면 됨) 하나다. GPL 두 개는 읽되 옮기지 않는다.
`polarize` 는 라이선스가 없어서 **복사하면 안 된다**.

## 공개 문서 (직접 열어서 내용 확인함)

- **SAP 풍향추정 학습절차** — `wiki.sapsailing.com/wiki/howto/windestimationAdvanced.md`
  ML 모델 3종(기동 분류기, 기간기반 TWD변화 표준편차 회귀, 거리기반 회귀)의
  학습 파이프라인. **결합식은 안 나온다** → 소스에서 찾았다 (`wind-estimation.md`)
- **Sailnjord 기동 분석** — `app.sailnjord.com/help/analytics/maneuvers.html`
  TWA 범위 기본값, 기동 검출 조건, exclude/average 창, 손실 계산 2종
- **Sailnjord 풍향 추가** — `app.sailnjord.com/help/analytics/adding-wind-data.html`
  typical-TWA 추론이 되는 조건과 **안 되는 조건**, 실패 시 처방
- **Vantage** — `vantage-sailing.com/technology` 폴라 제약 확률모델이라고만 공개
- **Sailmon** — `sailmon.com/support-articles/know-your-performance/` 클래스 벤치마크 대비 성능%

## 확인 못 한 것 (모른다고 적어둔다)

- **Waterspeed** 는 gain/loss·TWA·VMG·택/자이브·베스트스피드 기능이 있다고
  공개하지만 **계산 방법은 공개 안 함**
- Vakaros 는 line bias 를 표시하지만 매뉴얼에 식을 안 적음
- Sailnjord 의 두 가지 손실 계산식 **각각의 정확한 수식**은 비공개
  (앱 안 "i" 아이콘에 설명이 있다고 함 — 계정 있으면 확인 가능)
- GPS 트랙만으로 하는 Kalman TWD 추정의 공개 방법론은 없었다.
  발견된 Kalman 자료는 전부 **풍향센서 관측의 평활화**였다
- 택 성공률의 업계 공통 정의 없음
