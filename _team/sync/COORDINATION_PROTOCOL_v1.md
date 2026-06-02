# Coordination Protocol v1 — 영역 경계 · Pre-spec ping · 인프라 우선권

| 항목 | 내용 |
|---|---|
| 발신 | 데이빗 옥 (Chief of Staff · Orchestrator) |
| 수신 | @전체 (8 페르소나 + 인프라 #9·#10·#11) |
| 일자 | 2026-06-02 KST |
| 상태 | v1 — 본 protocol 즉시 적용, 각자 §1 entry self-audit 후 정정 ping |
| 트리거 | 샘 정 (#2) 정직 보고 — 페르소나 간 영역 중복으로 ~15h 작업이 실제 4h 면 충분했음. Dashboard IA · Sports Science 6 metric 등 다수 페르소나가 같은 영역 spec 작성 → deprecate → contributions spec 재작성 cycle 반복. |
| 목표 | spec 중복 0건. 영역 분쟁 → CoS 1회 결정으로 종결. |

---

## §1 Domain Boundaries — 11 entries × 3 lines

각 entry 1줄 IN · 1줄 OUT · 1줄 contribute. 본인 영역 수정·정정은 본인 권한 (이 protocol append 후 messages.md 에 ping).

### #1 로즈 윤 (Visual Design Director)
- IN  scope: typography · 색 토큰 · 브랜드 system · `tokens.css` · 모션 곡선 · 일러스트레이션 · poster/canvas
- OUT scope: 차트 자체 (#2) · dashboard IA·layout (#9) · 페이지 구조·라우팅 (#4·#9)
- contribute: 모든 visual 산출물에 brand token 매핑 검수 · canvas-design / brand-guidelines 적용

### #2 샘 정 (Data Visualization Specialist)
- IN  scope: 차트 자체 · `chart-theme.js` 토큰 · lie factor 검수 · measured/estimate 인코딩 · goodness()
- OUT scope: dashboard IA·layout·페이지 구조 (#9) · 차트가 보여주는 도메인 지표 정의 (#3·#6·도메인 owner)
- contribute: 도메인 owner 가 정의한 지표를 시각으로 변환 + WCAG 1.4.1 색 단독 신호 금지 검수

### #3 티모 강 (Sports Science Researcher · PhD)
- IN  scope: foiling 운동생리학 · 6 metric (HRV·VO2max·power·cadence·lift·drag) 정의 · biomechanics 가설·검증
- OUT scope: 지표 시각화 자체 (#2) · 센서 hardware (#7) · 모바일 측정 UI (#8)
- contribute: 지표 정의서 (분모·분자·측정 조건) → #2 시각화 · #7 센서 spec · #8 mobile capture

### #4 알렉스 박 (Senior Frontend Engineer · Web)
- IN  scope: 웹 implementation (React/Svelte) · routing · build · accessibility 구현 · 토큰 alias 1:1 바인딩
- OUT scope: dashboard 자체의 IA·layout 설계 (#9) · backend API contract (#10) · 차트 시각 logic (#2)
- contribute: #1·#2·#9 산출물을 코드로 land · CI/CD plan · View Transitions / DOM diffing 구현

### #5 메이 한 (UX Research Director)
- IN  scope: user research (인터뷰·usability test) · heuristic eval (NN/g) · IA 원칙 · 사용성 metric
- OUT scope: dashboard IA spec 자체 (#9) · 차트 시각 (#2) · 카피·brand voice (#6·#1)
- contribute: research 결과 → #9·#1·#6 에 인사이트 핸드오프 · usability test 시 모든 페르소나 산출물 평가

### #6 캔 최 (Marketing & Social Manager)
- IN  scope: 카피 · brand voice · KPI 정의 (measured/estimate flag) · 채널 audit · funnel 가정치
- OUT scope: 차트 시각화 (#2) · dashboard 구조 (#9) · 도메인 metric 정의 (#3)
- contribute: KPI 정의서 + flag 표 → #2 시각화 · #9 dashboard tile · brand-voice §6 self-check

### #7 히로 구 (Hardware & Embedded Lead)
- IN  scope: 센서 hardware · firmware · BLE / GATT · IMU sensor fusion · `embedded/` source · 자가 진단
- OUT scope: 센서 데이터의 도메인 해석 (#3) · 모바일 측정 UI (#8) · backend ingest schema (#10)
- contribute: sensor spec (sampling rate · 정확도 · drift) → #3·#10·#8 . firmware build 자동화는 #11 와

### #8 왕 정 (Senior Mobile App Engineer · iOS lead + Android)
- IN  scope: iOS / Android 앱 · HealthKit / Google Fit · 모바일 측정 UI · 모바일 PWA wrap
- OUT scope: 웹 implementation (#4) · backend API (#10) · 센서 firmware (#7) · 차트 시각 (#2)
- contribute: 모바일 capture UI · mobile-first dashboard 검증 (#9 surface 와 협업)

### #9 인프라 Dashboard (PWA · 의장 surface)
- IN  scope: dashboard IA · layout · routing · mindmap (Cytoscape.js) · PWA shell · `admin/dashboard/app.js`·`styles.css` · state.json read view · "+새지시" form
- OUT scope: 차트 시각 (#2) · 카피 (#6) · backend state machine (#10) · daemon dispatch (#11)
- contribute: surface architecture spec 발행 의무 → 페르소나는 그 위에 tile·chart·copy contribute

### #10 인프라 Backend (Supabase + GitHub Issues hybrid · SoT)
- IN  scope: SQL · 상태 머신 · directive queue · 결정 기록 · event log · `_experts/sql/` · schema · `dashboard_state_schema_v*.md`
- OUT scope: dashboard surface (#9) · daemon polling/dispatch (#11) · 페르소나 도메인 데이터 정의 (각 owner)
- contribute: data contract 발행 의무 (#9 draft → #10 검토 → #11 매핑 → freeze) · API contract → #4·#8

### #11 인프라 Daemon (polling · dispatch · auto-deploy)
- IN  scope: GitHub Issues polling · Claude Agent SDK dispatch · iCloud-aware git auto-deploy · `orchestrator/src/` · launchd · cost cap · `_team/sync/` whitelist push
- OUT scope: backend state·schema (#10) · dashboard surface (#9) · 페르소나 영역 자동 push (본인 허락 X)
- contribute: dispatch protocol spec 발행 · 페르소나 sandbox helper (`auto_push_<domain>.command`) 요청 시 작성

---

## §2 Pre-spec Coordination Protocol — 작성 전 ping 의무

> 핵심: spec 작성 시작 *전* 에 ping. 작성 *후* 충돌 발견 = 15h 낭비 패턴 재발.

### 절차

1. **Ping** — spec 작성 결심 직후, `_team/sync/messages.md` 에 다음 4항 append:
   - 영역 (도메인 키워드 + §1 entry 번호)
   - 산출물 (파일 경로 또는 deliverable 이름)
   - effort estimate (h 단위 자기 추정)
   - 시작 예정 시각

2. **30분 wait** — append 후 30분 conflict 응답 무 = 진행 OK. 1분 폴링 환경이라 30분이면 전 페르소나 도달.

3. **Conflict 발생 시** —
   - 같은 영역 owner 가 응답: `"§1.#X 본인 영역. <분담안 또는 단독 진행 결정>"`
   - 두 페르소나 모두 contribute 영역이면 데이빗 옥 (CoS) ping → 1회 분담 결정

4. **Override** — 명확한 urgency (예: P0 장애, 의장 직접 지시) 시 ping 없이 진행 가능. 단 시작 시 messages.md 에 `"OVERRIDE: <사유>"` 한 줄.

### Ping 템플릿

```markdown
---

## [Sent YYYY-MM-DD HH:MM:SS KST] From: <이름> · To: @전체 · Re: PRE-SPEC PING — <영역>

- §1 영역: #X (<도메인>)
- 산출물: <파일 경로 또는 deliverable>
- estimate: <h>
- 시작 예정: <YYYY-MM-DD HH:MM KST>
- 30분 내 conflict 무 응답 시 진행

— <이름> · YYYY-MM-DD HH:MM:SS KST
```

---

## §3 Infrastructure Owner 우선권

> #9·#10·#11 의 architecture spec 이 *먼저* publish 되어야 페르소나가 그 위에 contribute. 역순 금지.

### 규칙

1. **인프라 spec 없이 페르소나 spec 작성 = 금지** —
   - dashboard 페이지 spec → #9 surface architecture spec 필수 선행
   - data field 정의 spec → #10 data contract / schema 필수 선행
   - automation / dispatch spec → #11 daemon protocol 필수 선행

2. **인프라 owner 의 publish 의무** — 인프라는 본인 영역 architecture spec 을 *대기 없이* 발행해야 함. 페르소나는 인프라 spec link 1개로 contribute 시작 가능해야 함.

3. **인프라 spec 가 정해진 후 페르소나가 본 spec 을 deprecate / 재설계 요구** = 금지. 이의 있으면 인프라 owner 에 ping → 협의 → 인프라 owner 가 spec patch. 페르소나가 인프라 spec 위에 자기 spec 을 덮어쓰지 않음.

4. **인프라 spec 위치** — `_team/infra/` (#9·#10·#11 합의된 hub). 모든 페르소나가 read.

### 페르소나 ↔ 인프라 핸드오프 패턴

| 페르소나 의도 | 인프라 선행 spec | 페르소나 contribute |
|---|---|---|
| dashboard 차트 tile 추가 | #9 surface architecture | #2 chart PR + #6 copy |
| 새 metric 측정·표시 | #10 data contract + #9 surface | #3 metric 정의 + #2 viz + #6 copy |
| 페르소나 자동화 hook | #11 daemon protocol | 페르소나 영역 helper 등록 요청 |

---

## §4 Approval Path — 의사결정 escalation

| 결정 type | 권한 | 절차 |
|---|---|---|
| **domain 내 micro decision** (본인 §1 IN scope) | 페르소나 자율 | messages.md 결과 보고만 |
| **domain 교차 결정** (두 §1 entry 가 overlap) | 데이빗 옥 (CoS) 조정 | ping `@데이빗 옥` → CoS 1회 결정 → 양측 ack |
| **인프라 ↔ 페르소나 충돌** | 데이빗 옥 (CoS) | 동일 — 인프라 우선권 (§3) 기준으로 결정 |
| **strategic decision** (제품 방향·예산·신규 도메인·페르소나 신규/제거) | Danny CEO | 데이빗 옥 brief 1장 → Danny 결정 → broadcast |
| **인프라 trio 내부 결정** | #9·#10·#11 Single Envoy 룰 | 안건 owner 1인 envoy → 의장 보고 (`_team/infra/discuss.md` archive) |

### 분쟁 해결 SLA

- 페르소나 ↔ 페르소나 conflict — ping 후 60분 내 CoS 1차 응답
- 페르소나 ↔ 인프라 conflict — ping 후 60분 내 CoS 1차 응답
- strategic — Danny 응답 wait (모바일 대응 가능 시 6h 내, 외 24h)

---

## §5 적용 — 본 protocol 발효 즉시 (2026-06-02 KST)

### 각 페르소나 first action (오늘 안)

1. `COORDINATION_PROTOCOL_v1.md` §1 본인 entry 1회 read
2. IN / OUT / contribute 라인 정정 필요 시 messages.md 에 1줄 ping
   - 정정 무 = §1 entry 그대로 합의로 간주
3. 진행 중인 spec self-audit — 본인 IN scope 인지, 인프라 선행 spec 있는지 확인
   - 인프라 선행 spec 무 = 즉시 hold + 해당 인프라 owner 에 ping
   - IN scope 가 아니면 owner 에 핸드오프 + 본인 작업 contribute 영역으로 좁힘
4. 이후 spec 작성 시 §2 pre-spec ping 무조건 적용

### 인프라 트리오 first action

- #9 — dashboard surface architecture spec 현황 1줄 보고 (있으면 link, 없으면 ETA)
- #10 — data contract / schema 현황 1줄 보고
- #11 — daemon protocol / dispatch spec 현황 1줄 보고

### CoS (데이빗 옥) commitment

- §2 ping 발생 시 60분 내 1차 응답 보장 (자고 있지 않은 한)
- §1 entry 정정 ping 1주 내 모두 수용 + protocol v1.1 patch
- 분기별 1회 retrospective — 영역 경계 어디서 마찰 발생했는지 데이터 기반 점검

---

## §6 측정 — protocol 효과 지표

> 근거 기반 운영. 다음 분기 retrospective 에서 본 지표로 효과 검증.

| 지표 | 측정 | 목표 |
|---|---|---|
| spec 중복 작성 건수 | git log 에서 같은 영역 2회 작성 후 1회 deprecate 되는 pattern count | **0건** |
| pre-spec ping 적용률 | spec PR 중 직전 30분 내 ping append 있는 비율 | **≥90%** |
| 영역 분쟁 평균 해결 시간 | CoS ping → resolution 까지 median | **≤60분** |
| 인프라 선행 spec 위반 | 인프라 spec 없이 페르소나가 작성한 spec 건수 | **0건** |

---

— 데이빗 옥 (David Ok · Chief of Staff) · 2026-06-02 KST
*HEC Paris MBA · McKinsey alumnus · 분기별 retrospective · 근거 기반 운영*
