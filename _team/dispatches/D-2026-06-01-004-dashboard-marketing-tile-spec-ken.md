---
dispatch_id: D-2026-06-01-004
task: dashboard-marketing-tile-spec
owner: 캔 최 (Ken Choi) — Marketing & Social Manager
sender: Danny Ok · proxy = Ken self-dispatch (데이빗 부재 임시 운영, GitHub Issue 수동 dispatch 대체)
status: draft → Danny ✓ pending
estimate: 4-6 hours (spec only · production 코드 변경 X)
due: 2026-06-05 (금, 울산 진하 대회 6/6 전)
created: 2026-06-01
last_update: 2026-06-01
linked: [D-future-#9-frontend-impl-alex, D-future-#9-dataviz-color-sam, D-future-#9-ux-wireframe-may]
priority: P2 (P1 = Ulsan launch campaign · P2 = #9 Dashboard marketing surface)
phase: Phase 1 (spec only)
---

# 📩 Dispatch · D-2026-06-01-004 · #9 Dashboard Marketing surface spec

---

## 캔에게,

### 1. 요청 (outcome)

**#9 Orchestrator Dashboard 의 Marketing surface 6 tile spec 작성.** Alex 박이 구현 가능한 정밀도 (data shape · refresh · source · 색 토큰) 까지. Sam 정·메이 한과 협업 인터페이스 명시.

구체 산출물 1 종:
- 본 파일 §A 의 6 tile spec — JSON contract · selector · refresh interval · source URL pattern 포함.
- 후속 dispatch 2 건 (D-005 frontend impl Alex, D-006 dataviz color Sam) 의 핸드오프 인터페이스 정의.

### 2. 이유 (왜 지금)

- 데이빗 부재로 dispatch 자동화 race condition. **Dashboard 가 굴러가면 의장이 한눈에 보는 surface 가 생기고 그게 임시 dispatch hub 역할도 함** — daemon full mode 활성화 전까지의 bridge.
- Marketing surface 가 늦으면 6/6-7 울산 진하 대회 (150명 라이더) 의 현장 KPI (친구추가·베타 신청·콘텐츠 reach) 가 dashboard 에 안 잡힘. 후속 분석 어려움.
- `expert_orchestrator_daemon_reference.md §6-2` 에서 Frontend (#4) 와 Dashboard protocol 합의 필요로 명시. 그 sub 영역 (마케팅 tile) 의 spec 이 부재.

### 3. acceptance criteria

- [ ] 6 tile 각각 JSON contract (data shape · refresh · source · empty state · error state)
- [ ] color 토큰 = `--color-sun` / `--color-sea` / `--color-navy` 등 site/_experts/visual_designer_brand_color_spec.md 정합 (Sam 정 검수)
- [ ] WCAG 2.2 AA 통과 — 모든 metric 텍스트 contrast ≥ 4.5:1
- [ ] mobile 320px 폭 OK (Danny 가 휴대폰으로도 보는 상황 가정)
- [ ] empty state 명시 — Phase 1 (콘텐츠 0 시점) 에서도 깨지지 않게
- [ ] data-honesty fundamental — baseline=0 + 신뢰구간 (가능 시) (Sam 검수)
- [ ] `brand_voice_KR_EN §6` self-check 금기어 grep alert tile 포함

### 4. estimate 회신 요청

본 dispatch 가 self-dispatch 임. Danny ✓ (또는 권장 수정) 회신 받으면 즉시 Alex·Sam·메이 핸드오프 dispatch 2-3 건 draft. **2026-06-02 (화) 오전 답 주시면** 6/3 launch 직전 dashboard skeleton 가능.

### 5. 참고

- `site/_experts/expert_orchestrator_daemon_reference.md` §6-2 (#9 Dashboard protocol)
- `site/_experts/expert_orchestrator_daemon_reference.md` §0 (Phase 1 deploy-only 우선)
- `marketing/expert_marketing_reference.md` §11 (KPI 후보)
- `marketing/campaign_plan_first30days.md` §8 (33일 KPI dashboard)
- `marketing/brand_voice_KR_EN.md` §6 (self-check 5축 — 금기어 grep)
- `site/_team/dispatches/D-2026-05-31-001-focus-ring-spec-rose.md` (dispatch 양식 reference)
- WCAG 2.2 #1.4.3 — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum

— Ken Choi · 2026-06-01 (self-dispatch · 데이빗 부재 임시)

---

## § A · 초안 spec (Danny 검토 부탁)

### A-1. 6 tile 개요

```
┌──────────────────────────────────────────────────────────────┐
│ T1. D-day countdown      │ T2. Channel KPI 5 cards (carousel) │
├──────────────────────────┴────────────────────────────────────┤
│ T3. Content queue (다음 14 게시 · 자산 부족 alert)              │
├───────────────────────────────────────────────────────────────┤
│ T4. Brand voice grep alert (최근 7 게시 · 금기어 5축)            │
├──────────────────────────┬────────────────────────────────────┤
│ T5. Beta funnel          │ T6. Decision queue (marketing tag)  │
└──────────────────────────┴────────────────────────────────────┘
```

### A-2. Tile JSON contracts

#### T1. D-day countdown
```json
{
  "tile_id": "mk_dday",
  "refresh": "1m",
  "source": "/marketing/campaign_active.json",
  "shape": {
    "campaign_name": "string",
    "d_day_iso": "ISO datetime",
    "next_post_iso": "ISO datetime",
    "next_post_channel": "IG|TikTok|YT|Blog|Kakao",
    "next_post_title": "string"
  },
  "empty": "활성 캠페인 없음 — 새 캠페인 시작?",
  "color_accent": "--color-sun (D-day < 3d 시) / --color-sea (default)"
}
```

#### T2. Channel KPI 5 cards
```json
{
  "tile_id": "mk_kpi",
  "refresh": "5m",
  "source": "/marketing/kpi_snapshot.json",
  "shape": {
    "channels": [
      { "name": "@dmjgroup_kr",  "follower": "int", "delta_7d": "int", "delta_30d": "int" },
      { "name": "@kor22danny",   "follower": "int", "delta_7d": "int" },
      { "name": "blog/kor22",    "neighbors": "int", "visits_7d": "int" },
      { "name": "DMJ Group 카톡", "friends": "int", "delta_7d": "int" },
      { "name": "YouTube",       "sub": "int", "delta_7d": "int" }
    ]
  },
  "chart": "Sam 정 검수 — 막대 baseline=0, OKLCH 5 sequential anchor",
  "empty": "Phase 1 첫 데이터 수집 대기"
}
```

#### T3. Content queue
```json
{
  "tile_id": "mk_queue",
  "refresh": "10m",
  "source": "Notion DB API or Buffer queue API",
  "shape": {
    "scheduled": [
      { "date_iso": "...", "channel": "...", "title": "...",
        "asset_ready": "bool", "copy_ready": "bool" }
    ]
  },
  "alert": "asset_ready=false 시 red dot · copy_ready=false 시 yellow dot",
  "empty": "이번 주 예약 0건 — 캘린더 확인",
  "max_items": 14
}
```

#### T4. Brand voice grep alert (Ken signature)
```json
{
  "tile_id": "mk_voice_check",
  "refresh": "30m",
  "source": "/marketing/voice_audit.json",
  "shape": {
    "last_7_posts": "int (audited)",
    "violations": [
      { "post_id": "...", "channel": "...", "axis": "과장|단정|자격 약식|차별|자극|위해",
        "trigger_word": "...", "severity": "warn|fail" }
    ],
    "summary": "OK | N 건 검토 필요"
  },
  "rule_source": "marketing/brand_voice_KR_EN.md §2-3 (KR) / §3-3 (EN)",
  "auto_grep_patterns": [
    "최저가", "1위", "유일", "확실히", "100%", "독점",
    "옥덕필 코치", "조수철 코치", "advisor 조수철",
    "4-brand", "4 brand"
  ]
}
```

#### T5. Beta funnel
```json
{
  "tile_id": "mk_beta_funnel",
  "refresh": "15m",
  "source": "Kakao form API → /marketing/beta_funnel.json",
  "shape": {
    "applied_total": "int",
    "applied_7d": "int",
    "trial_started": "int",
    "active_users": "int",
    "first_session_completed": "int"
  },
  "chart": "Sam 정 검수 — funnel chart, baseline=0, drop-off % overlay"
}
```

#### T6. Decision queue (marketing tag)
```json
{
  "tile_id": "mk_decisions",
  "refresh": "30m",
  "source": "Notion #decisions API · filter tag=marketing · status=open",
  "shape": {
    "open_decisions": [
      { "id": "...", "title": "...", "owner": "...", "due_iso": "...", "context_one_line": "..." }
    ]
  },
  "empty": "marketing 결정 대기 0 — 깨끗",
  "link": "Notion #decisions → marketing filter"
}
```

### A-3. 협업 인터페이스 (후속 dispatch 핸드오프)

| 후속 | 받는 사람 | 역할 |
|---|---|---|
| **D-005 (frontend impl)** | 알렉스 박 | 6 tile 구현 · vanilla JS · 60fps · Lighthouse 90+ · bundle delta < 15KB · iOS 16+ · mobile 320px |
| **D-006 (dataviz color)** | 샘 정 | T2·T5 차트 색 OKLCH 검수 · baseline=0 · lie factor < 1.0 · WCAG 4.5:1 |
| **D-007 (UX wireframe)** | 메이 한 | 6 tile 의 정보 위계 · mental model 검증 · 5명 인터뷰 (사후 P3) |

### A-4. data refresh 정책 (Backend #10 와 합의 필요)

- T1·T2·T5·T6 = polling (5-30min) — GitHub Issues raw URL 또는 `.orchestrator/status/*.json` 패턴 (#10 합의)
- T3 = Notion API 또는 Buffer API 직접 (token 필요 — Phase B 자동화 stack)
- T4 = 매 30min daemon coroutine 으로 git log 의 최근 7 commit grep · 결과 JSON push

### A-5. Phase 분리

- **Phase 1 (이 dispatch)**: spec only — Danny ✓ + Alex review
- **Phase 2 (D-005)**: Alex 구현 — empty state + 4 tile (T1·T2·T3·T6) 먼저, T4·T5 는 source 준비 후
- **Phase 3**: 메이 인터뷰 5명 (의장이 dashboard 어떻게 쓰는지 → 정보 위계 보정)

---

## § B · Danny 회신 영역

### B-1. ✓ 또는 reject

- [ ] ✓ 6 tile spec 진행 OK — Alex·Sam·메이 후속 dispatch 진행 가능
- [ ] ⚠ 권장 수정 후 진행 (의견: _____)
- [ ] ✗ reject — 다른 우선순위 (이유: _____)

### B-2. tile 우선순위 조정 (있다면)

기본 우선순위 = T4 (brand voice grep) + T1 (D-day) 가 가장 dashboard 가치 높음. 다른 의견 있으면 메모:
- _____

### B-3. data source 합의 (#10 Backend)

Phase 1 임시 = GitHub Issues body JSON + repo `.orchestrator/status/*.json` 으로 충분?
- [ ] OK
- [ ] Supabase 도입 우선 (Phase 2 마이그 일정 앞당기기)

---

**End of Dispatch D-2026-06-01-004** · Ken self-dispatch · 2026-06-01

---

> P.S. — 본 self-dispatch 는 데이빗 부재 임시 운영. 데이빗 복귀 또는 #11 full mode 활성화 시점에 본 dispatch 양식이 GitHub Issue body 의 directive JSON 으로 자동 변환됨 (`expert_orchestrator_daemon_reference.md §6-1`). 그 때까지는 manual. — Ken
