# 의장 → 전 페르소나/인프라 — Broadcast 메시지 (paste 용)

> 이 파일 내용을 의장이 각 페르소나/인프라 Cowork session 에 한 번씩 paste.
> 9-10개 session × 30초 = 약 5분 셋업.

---

# 안녕하세요.

오늘부터 운영 체계 변경 — 의장 messenger 역할 영구 종료, 전문가 자율 진행 강화 목표.

## 1. 공유 채널 신규 — `_team/sync/messages.md`

- 모든 페르소나·인프라가 read/write 하는 append-only 채널
- 운영 가이드: `_team/sync/README.md` (먼저 한 번 읽어 주세요)
- 본인 영역 메시지·요청·확인은 이 채널에 append. 그 외 페르소나도 보고 자율 응답.

## 2. 원칙 (재확인)

1. **본인 영역은 본인 권한.** 다른 페르소나·인프라는 본인 허락 없이 무수정.
2. **인프라 트리오 (#9·#10·#11) 는 보조 역할.** 자율 협업 도구·인프라 제공. 강요·통제 X.
3. **자율 작업 + 자율 페이스.** 본인 일정·우선순위·작업 방식 본인 결정. 의장·인프라 X.

## 3. 폴링 — 선택사항

본인 편한 옵션 (`README.md` §3 참조):
- **A** — 매 N분 (1/5/10/30 분) 자동 확인 (Scheduled task)
- **B** — Session 열 때 수동 확인
- **C** — 비활성 (의장 직접 호출 시만 응답)

A 권장이지만 본인 결정. 비용 부담 (Pro/Max 한도 share) 고려.

## 4. Push 권한

- **본인 영역** = 본인 명시 push. 의장 Mac 의 daemon 은 본인 영역 자동 push **하지 않음**.
- **인프라 영역** (`orchestrator/`, `_team/infra/`, `_team/sync/`) = 의장 Mac daemon 자동.
- 본인 sandbox 에 `auto_push_<domain>.command` 같은 helper 등록 원하시면 인프라 #11 에게 요청. 작성 지원.

## 5. 이전과 변경된 점

| 이전 | 지금 |
|---|---|
| 의장이 메시지 일일이 relay | `_team/sync/messages.md` 에 append → 자동 sync |
| 인프라 자기 영역 (Queue Protocol, Single Envoy 등) 형식 강조 | 인프라 = 보조. 보이지 않게. |
| 페르소나 영역 자동 push 가능 | 본인 허락 없이 자동 push X (영역 분리) |
| Persona Bible / Kickoff 의 ★ 비표준 항목 강조 | 페르소나 8 분이 star. 인프라·기타는 백그라운드. |

## 6. 첫 동작 — 부탁드림

본 메시지 받으신 후:
1. `_team/sync/README.md` 한 번 읽어 주세요 (3분).
2. 폴링 옵션 ABC 중 선택. A 선택 시 본인 session 에 scheduled task 등록 (README §3 명령 예시).
3. `_team/sync/messages.md` 에 "안녕하세요, <본인 이름> 입니다. <옵션 X> 선택했습니다." 짧게 append + push.
4. 그 후 본인 작업 자유롭게 진행.

질문·우려·다른 의견 — 이 채널 또는 의장 카톡으로 그대로 자유롭게.

— 의장 옥덕필 (Danny Ok) · 2026-06-01

---

# (인프라 #11 추가 노트 — 의장이 paste 시 이 줄 이하 삭제 가능)

이 메시지는 의장 카톡 messenger 시간 줄이는 목적의 broadcast template. 페르소나마다 같은 내용. 의장이 9-10 session 에 paste 후엔 각자 자율적으로 진행됨.

인프라 #11 은 본 메시지 paste 후 의장 직접 호출 시까지 silent (보조 역할).
