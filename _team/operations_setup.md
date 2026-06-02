# Operations Setup — 30 분 setup 가이드 (Danny 가 직접 실행)

| 항목 | 내용 |
|---|---|
| 문서 유형 | 외부 서비스 (Notion · Slack · Google Calendar) 의 가상 운영팀 setup 가이드 |
| 작성 | 데이빗 옥 · 2026-05-31 |
| 사용 시점 | 한 번 setup 후 매주 자동 반복 |
| 소요 시간 | 30 분 |
| 실행자 | 옥덕필 Danny (Notion · Slack · Calendar workspace 의 admin) |

> **읽는 법.** §1 setup 순서 (3 step). §2 Notion #decisions 페이지 구조 + paste-ready 콘텐츠. §3 Slack 채널 8 개 spec. §4 캘린더 invite 3 개 (월·수·금). §5 setup 후 routine 확인. §6 데이빗 옥의 매주 routine.

---

## 1. Setup 순서 (총 30 분)

| Step | 작업 | 도구 | 소요 |
|---|---|---|---|
| 1 | Notion `#decisions` 페이지 생성 | Notion | 8 분 |
| 2 | Slack 채널 8 개 생성 | Slack | 12 분 |
| 3 | Google Calendar 3 invite (월·수·금) | Calendar | 10 분 |

Danny 한 번 setup → 매주 자동 반복. 데이빗 옥이 운영 (매일 18:00 status post · 매주 금요일 closeout).

---

## 2. Notion `#decisions` 페이지

### 2-1. 페이지 구조

```
📁 SailTechCo 운영
  ├── 📄 README — 팀 소개 (가상 사무실 URL 임베드)
  ├── 📄 #decisions — 모든 결정 archive (이 페이지)
  ├── 📄 #priorities — 이번 주 priority 3 + 다음 주 priority 3
  ├── 📁 dispatches/ — D-YYYY-MM-DD-NNN-* 동기화
  └── 📁 weekly notes/ — 월·수·금 회의록
```

### 2-2. `#decisions` 페이지 paste-ready 내용

```
# #decisions — SailTechCo 운영 결정 archive

| 항목 | 내용 |
|---|---|
| 목적 | 모든 결정의 single source of truth — 같은 결정 두 번 방지 |
| 운영 | 데이빗 옥이 회의 직후 5 min 내 archive |
| 검색 | Notion search 또는 Cmd+/ |

## Decision schema

각 결정은 다음 형식의 toggle:

▸ [YYYY-MM-DD] [domain] 결정 한 줄
   ├── owner: ___
   ├── due: ___
   ├── context: ___ (왜 이 결정이 필요했나)
   ├── alternatives considered: A / B / C
   ├── chosen: ___ (이유 한 줄)
   ├── dispatch: D-YYYY-MM-DD-NNN (linked)
   └── status: open · in-progress · done · revisit

## 운영 routine

- 회의 직후 데이빗 옥이 결정 toggle 추가 (5 min).
- 매주 금요일 closeout 시 owner 별 grouping 으로 review.
- 분기말 archive 폴더로 이동 (검색은 유지).

## 도메인 태그 (filter)

- [visual] 시각·brand
- [dataviz] 차트·시각화
- [sports] 알고리즘·생체
- [frontend] 웹·a11y
- [ux] flow·사용자
- [marketing] 콘텐츠·brand voice
- [hardware] 센서·펌웨어
- [mobile] iOS·Android
- [strategy] 비전·priority·재정
- [team] 사람·운영
- [external] 4 브랜드 본사·partnership

## 첫 결정 예시 (2026-05-31)

▸ [2026-05-31] [team] SailTechCo 가상 운영팀 v1.0 launch — 11 persona + 가상 사무실 + portfolio + protocol
   ├── owner: 옥덕필 Danny · 데이빗 옥 (orchestrator)
   ├── due: 2026-05-31 (done)
   ├── context: 추상 "expert #N" 호명에서 → 이름·얼굴·성격이 있는 운영진으로 immersion 향상
   ├── alternatives: persona X · persona O · persona+portfolio O
   ├── chosen: persona + portfolio (full immersion + 향후 호명 기준)
   ├── dispatch: 메타 (이 결정 자체)
   └── status: done
   live: https://dmjgroup.kr/_team/

▸ [2026-05-31] [visual+frontend] Focus Ring 표준화 — WCAG 2.2 #2.4.13 통과
   ├── owner: 로즈 윤 (spec) + 알렉스 박 (구현) + 데이빗 옥 (tracking)
   ├── due: 2026-06-05 (Fri, ship)
   ├── context: site/_experts/visual_designer_reference.md §4-1 Top 1 P1 항목
   ├── alternatives: Phase 1 plan only · Phase 2 ship 둘 다
   ├── chosen: Phase 2 ship (effort 2-4h · impact 즉시 a11y 통과)
   ├── dispatch: D-2026-05-31-001 · D-002 · D-003
   └── status: in-progress
```

### 2-3. Notion template 단축키

Notion 의 `/template button` 으로 위 schema 를 toggle 1 클릭 으로 만들 수 있게 setup. 데이빗 옥이 매번 paste 안 해도 됨.

---

## 3. Slack 채널 8 개 spec

### 3-1. 채널 list

| 채널 | 목적 | 멤버 | privacy |
|---|---|---|---|
| `#general` | 공지·잡담·생일 | 전원 | public |
| `#decisions` | 모든 결정 archive + bot post | 전원 read · 데이빗 write | public |
| `#standup` | 매일 09:00 자동 prompt | 전원 | public |
| `#design` | 시각·UX 협업 | 로즈 · 샘 · 메이 + Danny · 데이빗 | private |
| `#engineering` | 구현 · 펌웨어 | 알렉스 · 왕 · 히로 + Danny · 데이빗 | private |
| `#data-science` | 알고리즘 · 차트 | 티모 박사 · 샘 + Danny · 데이빗 | private |
| `#marketing` | 콘텐츠 · brand | 캔 · 메이 · 로즈 + Danny · 데이빗 | private |
| `#cafe` | 점심 메뉴 · 생일 · 비공식 | 전원 | public |
| `#incident` | 긴급 상황 만 | 전원 + 알림 ON | private |

### 3-2. 채널 description (paste-ready)

- `#general` — SailTechCo 전체 공지 및 잡담. 결정 archive 는 #decisions, 긴급은 #incident.
- `#decisions` — 모든 운영 결정 archive. 데이빗 옥이 회의 직후 post. 검색용 채널 — chitchat 금지. Notion `#decisions` 페이지 동기화.
- `#standup` — 매일 09:00 자동 prompt (Geekbot 또는 단순 bot). 형식: 어제 했음 / 오늘 할 것 / blocker.
- `#design` — 시각·UX·brand visual 협업. 토큰 · WCAG · 인터뷰 결과.
- `#engineering` — 웹·iOS·Android·펌웨어 구현. PR · LCP · BLE GATT · App Store.
- `#data-science` — 차트·알고리즘. lie factor · OKLCH · TRIMP.
- `#marketing` — 콘텐츠 calendar · brand voice · photography.
- `#cafe` — 점심·생일·여가. 가벼운 분위기.
- `#incident` — 긴급. 사이트 다운·App Store reject·hardware fail.

### 3-3. Channel topic 예시

```
#decisions
"결정 archive · 검색용 · chitchat 금지 · 데이빗 옥이 운영"

#design
"로즈·샘·메이 + Danny·데이빗 · 시각·UX 협업 · WCAG AA 준수"

#standup
"매일 09:00 — 어제 / 오늘 / blocker · 5분 안에"
```

---

## 4. Google Calendar invite 3 개

### 4-1. 월요일 standup (매주 반복)

```
Title: 🌅 SailTechCo 월요일 standup
Time: 매주 월 09:00–09:30 (KST)
Repeat: 매주 월요일
Participants: 전원 (8 + Danny + 데이빗) + 조수철 (화상)
Location: 회의실 (성수동) + Google Meet (조수철용)
Description:

각자 5 분 — 지난주 결과 / 이번주 priority / blocker.
의장: 옥덕필 Danny.
진행: 데이빗 옥 (회의록 + 결정 archive).
자문: 조수철 (마지막 5 min 화상).

agenda:
1. 개회 (1 min)
2. 각자 5 min × 8 — 지난주 · 이번주 · blocker
3. 결정 명시 (2 min)
4. 조수철 자문 (5 min)
5. 폐회 (1 min)

링크:
- 가상 사무실: https://dmjgroup.kr/_team/virtual_office.html
- 회의록 template: ../_team/meeting_protocol.md §2
- 결정 archive: Notion #decisions
```

### 4-2. 수요일 분과회 (매주 반복)

```
Title: 🔬 SailTechCo 수요일 분과회
Time: 매주 수 14:00–14:45 (KST)
Repeat: 매주 수요일
Participants: 도메인 pair 별 분과 (3 분과 병렬 또는 sequential)
Location: 분과 별 다른 공간

3 분과:
A. 시각·차트 — 로즈 + 샘 + 메이
B. 모바일·하드웨어 — 왕 + 히로
C. UX·마케팅 — 메이 + 캔

진행: 분과 별 자체 (데이빗 옥은 cross-cut 만 참여).
산출: 분과별 1 페이지 회의록 → Notion.

agenda:
1. 지난 분과 후 결과 review (10 min)
2. 도메인 deep-dive 안건 (25 min)
3. 다음 분과 priority (10 min)
```

### 4-3. 금요일 closeout (매주 반복)

```
Title: 🍻 SailTechCo 금요일 closeout
Time: 매주 금 17:00–17:30 (KST)
Repeat: 매주 금요일
Participants: 전원 + 조수철 (화상)
Location: 회의실 + Google Meet

데이빗 옥 1 페이지 status:
- 이번 주 결정 3 개 (요약)
- 이번 주 ship 한 것
- 다음 주 priority 3 개
- 조수철 자문 (10 min — 큰 그림)

agenda:
1. 데이빗 1 페이지 status (5 min)
2. 각자 한 줄 wrap (5 min × 8 = 5 min compressed — 한 명당 30 sec)
3. 다음주 priority 합의 (5 min)
4. 조수철 자문 (10 min)
5. 폐회 (5 min)
```

### 4-4. 격주 1:1 (Danny ↔ 각 persona)

```
Title: 🤝 [persona] ↔ Danny 1:1
Time: 격주 30 분
Participants: Danny + 그 persona
Location: CEO 사무실 또는 walking lunch
스케줄: 데이빗 옥이 격주 단위로 9 명 (8 persona + 조수철) rotate.
```

---

## 5. Setup 후 routine 확인

### 5-1. 첫 주 (2026-06-01 ~ 06-05)

| 일자 | 시각 | 이벤트 | 확인 |
|---|---|---|---|
| 월 06-01 | 09:00 | 월요일 standup (첫 실전) | 8 + Danny + 데이빗 + 조수철 화상 |
| 월 06-01 | 18:00 | 데이빗 status post (#decisions) | dispatch D-001/002/003 update |
| 화 06-02 | EOD | 로즈 spec ✓ 또는 권장 수정 (D-001) | dispatch update |
| 수 06-03 | 14:00 | 분과회 첫 실전 | A·B·C 분과 |
| 수 06-03 | EOD | 알렉스 estimate (D-002) | dispatch update |
| 목 06-04 | EOD | 알렉스 PR ready | merge review |
| 금 06-05 | 17:00 | closeout 첫 실전 + ship | 데이빗 1 페이지 status |
| 금 06-05 | EOD | dispatch archive | dispatches/archive/2026-Q2/ |

### 5-2. 성공 지표 (data-driven · 1 분기 후 review)

| metric | baseline | target (Q2 후) |
|---|---|---|
| 같은 결정 두 번 발생 | (unknown) | 0 회 |
| dispatch 평균 ship 일수 | (baseline TBD) | 5 일 이내 |
| 회의 30 분 초과 비율 | (baseline TBD) | 10% 이내 |
| Danny 의 deep work 시간 | (baseline TBD) | 주 20 시간 이상 |
| `#decisions` archive 검색 빈도 | 0 | 주 5+ |

---

## 6. 데이빗 옥의 매주 routine

```
월요일
├── 08:30 출근 (Danny 보다 30 분 먼저)
├── 09:00 standup 진행
├── 09:30 회의록 → Notion
├── 10:00–12:00 Danny deep work block (방해 차단)
├── 18:00 status post #decisions
└── 19:30 퇴근

화요일
├── 1:1 rotate (Danny ↔ 1 persona)
├── 18:00 status post
└── 19:30 퇴근

수요일
├── 14:00 분과회 cross-cut 참여
├── 18:00 status post
└── 19:30 퇴근

목요일
├── 18:00 status post
└── 19:30 퇴근

금요일
├── 16:00 1 페이지 status 작성 시작
├── 17:00 closeout 진행
├── 17:30 다음주 priority Notion update
├── 18:00 dispatch archive
└── 19:30 퇴근

토·일
├── 토 09:00 짧은 status check (Slack only)
└── 일 휴식
```

---

## 7. 안전 가드

- `#incident` 채널은 알림 ON · 24 시간 모니터링.
- 외부 stakeholder (4 브랜드 본사 · 조수철 · 잠재 partners) 의 1차 응대는 데이빗 옥 — Danny 까지 가는 요청 filtering.
- 데이빗 옥 휴가 시 백업 owner: 메이 한 (documentation 익숙) + 캔 최 (외부 응대 가능).

---

**End of Operations Setup v1.0** — 2026-05-31.
다음 update: 첫 주 후 retrospective (2026-06-06 토).
