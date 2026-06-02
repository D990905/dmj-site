/* SailTech Orchestrator — sample fixture
   Shape: dashboard_state_schema_v0.1-locked (same shape the daemon publishes to
     - /admin/dashboard/dashboard-state.json (Pages, mobile)
     - http://localhost:8765/state           (daemon dev hot-loop)
   Slugs match #10 의 0006_seed_agents.sql (15-row roster) — Thread 002 t5.
   Display names map to Persona Bible §0 where applicable; remainder = generic.
   Used as fallback when fetch fails. Adapter `adaptState()` in app.js
   transforms this into renderer internal shape — same code path as real data.
*/
window.SAILTECH_SAMPLE = {
  "schema_version": "v0.1",
  "last_updated_at": "2026-05-31T14:23:45+00:00",

  "directives": [
    { "directive_id": "d-001", "title": "Phase 2 백로그 정리",         "prompt_excerpt": "Phase 2 백로그…",
      "status": "in_progress", "priority": "p2", "target_agent_slug": "01-pm",
      "created_at": "2026-05-30T10:00:00Z", "updated_at": "2026-05-31T13:50:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/101", "cost_usd": 0.18, "turns": 3 },
    { "directive_id": "d-002", "title": "주간 리포트 #21",             "prompt_excerpt": "주간 리포트…",
      "status": "done", "priority": "p1", "target_agent_slug": "01-pm",
      "created_at": "2026-05-29T09:00:00Z", "updated_at": "2026-05-31T09:00:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/102", "cost_usd": 0.08, "turns": 1 },
    { "directive_id": "d-003", "title": "도메인 론칭 PLAN 승인",       "prompt_excerpt": "5/27 admin.sailtechco.com 컷오버…",
      "status": "awaiting_approval", "priority": "p3", "target_agent_slug": "01-pm",
      "created_at": "2026-05-31T12:00:00Z", "updated_at": "2026-05-31T13:55:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/103", "cost_usd": 0.04, "turns": 2 },
    { "directive_id": "d-101", "title": "라이딩 리플레이 뷰어 폴리시", "prompt_excerpt": "뷰어 UX 폴리시…",
      "status": "in_progress", "priority": "p2", "target_agent_slug": "04-frontend",
      "created_at": "2026-05-28T11:30:00Z", "updated_at": "2026-05-31T13:40:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/110", "cost_usd": 0.51, "turns": 8 },
    { "directive_id": "d-102", "title": "마이페이지 로그인 버그 수정", "prompt_excerpt": "로그인 토큰 만료…",
      "status": "blocked", "priority": "p3", "target_agent_slug": "04-frontend",
      "created_at": "2026-05-27T10:00:00Z", "updated_at": "2026-05-30T18:00:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/111", "cost_usd": 0.32, "turns": 5 },
    { "directive_id": "d-201", "title": "Supabase Auth shim 통합",     "prompt_excerpt": "auth shim 통합…",
      "status": "in_progress", "priority": "p3", "target_agent_slug": "10-backend",
      "created_at": "2026-05-26T08:00:00Z", "updated_at": "2026-05-31T13:30:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/120", "cost_usd": 1.05, "turns": 14 },
    { "directive_id": "d-202", "title": "Session API 토큰 갱신 수정",  "prompt_excerpt": "토큰 갱신…",
      "status": "in_progress", "priority": "p3", "target_agent_slug": "10-backend",
      "created_at": "2026-05-29T15:00:00Z", "updated_at": "2026-05-31T13:20:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/121", "cost_usd": 0.44, "turns": 6 },
    { "directive_id": "d-301", "title": "라이딩 통계 패널 v2 검증",     "prompt_excerpt": "통계 검증…",
      "status": "done", "priority": "p2", "target_agent_slug": "06-data-science",
      "created_at": "2026-05-28T09:00:00Z", "updated_at": "2026-05-30T17:00:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/130", "cost_usd": 0.27, "turns": 4 },
    { "directive_id": "d-302", "title": "회전코칭 AI 엔진 평가",        "prompt_excerpt": "AI 엔진 평가…",
      "status": "in_progress", "priority": "p2", "target_agent_slug": "06-data-science",
      "created_at": "2026-05-29T13:00:00Z", "updated_at": "2026-05-31T13:10:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/131", "cost_usd": 0.62, "turns": 9 },
    { "directive_id": "d-303", "title": "스킬레벨 v2 통합 테스트",      "prompt_excerpt": "회귀 4 / 신규 12 통과…",
      "status": "awaiting_approval", "priority": "p2", "target_agent_slug": "12-riding-analytics",
      "created_at": "2026-05-31T11:00:00Z", "updated_at": "2026-05-31T13:00:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/132", "cost_usd": 0.09, "turns": 2 },
    { "directive_id": "d-501", "title": "Orchestrator UX 인터뷰",       "prompt_excerpt": "UX 인터뷰 설계…",
      "status": "pending", "priority": "p2", "target_agent_slug": "02-research",
      "created_at": "2026-05-31T10:00:00Z", "updated_at": "2026-05-31T10:00:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/150", "cost_usd": 0, "turns": 0 },
    { "directive_id": "d-601", "title": "GitHub Pages admin subroute", "prompt_excerpt": "GitHub Pages 서브경로 셋업…",
      "status": "in_progress", "priority": "p2", "target_agent_slug": "09-devops",
      "created_at": "2026-05-30T08:00:00Z", "updated_at": "2026-05-31T13:00:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/160", "cost_usd": 0.12, "turns": 2 },
    { "directive_id": "d-602", "title": "CI iCloud-lock 재시도 패치",   "prompt_excerpt": "iCloud lock 재시도…",
      "status": "awaiting_approval", "priority": "p1", "target_agent_slug": "11-orchestrator",
      "created_at": "2026-05-31T08:00:00Z", "updated_at": "2026-05-31T12:30:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/161", "cost_usd": 0.07, "turns": 1 },
    { "directive_id": "d-701", "title": "Brand voice 5채널 콘텐츠 캘",  "prompt_excerpt": "Reels·Threads·Shorts·Blog·Email 캘…",
      "status": "in_progress", "priority": "p2", "target_agent_slug": "15-marketing",
      "created_at": "2026-05-30T11:00:00Z", "updated_at": "2026-05-31T12:00:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/170", "cost_usd": 0.22, "turns": 4 },
    { "directive_id": "d-801", "title": "Visual 디자인 시안 v1",        "prompt_excerpt": "Dashboard 디자인 시안…",
      "status": "pending", "priority": "p2", "target_agent_slug": "03-design",
      "created_at": "2026-05-31T11:30:00Z", "updated_at": "2026-05-31T11:30:00Z",
      "issue_url": "https://github.com/D990905/dmj-site/issues/180", "cost_usd": 0, "turns": 0 }
  ],

  // key = agents.slug (0006_seed_agents.sql 의 15-row roster)
  "personas": {
    "01-pm":              { "display_name": "PM",        "role": "pm",                 "domain": "Product Management",     "status": "active",  "last_active_at": "2026-05-31T13:50:00Z", "idle_minutes": 0,
                            "current_task": { "id": "d-001", "title": "Phase 2 백로그 정리", "status": "in_progress", "directive_id": "d-001" } },
    "02-research":        { "display_name": "메이 한",   "role": "research",           "domain": "UX Research",            "status": "idle",    "last_active_at": "2026-05-31T11:00:00Z", "idle_minutes": 195, "current_task": null },
    "03-design":          { "display_name": "로즈 윤",   "role": "design",             "domain": "Visual Design",          "status": "idle",    "last_active_at": "2026-05-31T10:00:00Z", "idle_minutes": 255, "current_task": null },
    "04-frontend":        { "display_name": "알렉스 박", "role": "frontend",           "domain": "Frontend Engineering",   "status": "active",  "last_active_at": "2026-05-31T13:40:00Z", "idle_minutes": 14,
                            "current_task": { "id": "d-101", "title": "라이딩 리플레이 뷰어 폴리시", "status": "in_progress", "directive_id": "d-101" } },
    "05-mobile-ux":       { "display_name": "Mobile UX", "role": "mobile_ux",          "domain": "Mobile UX",              "status": "idle",    "last_active_at": "2026-05-30T17:00:00Z", "idle_minutes": 1290, "current_task": null },
    "06-data-science":    { "display_name": "샘 정",     "role": "data_science",       "domain": "DataViz / Analytics",    "status": "active",  "last_active_at": "2026-05-31T13:10:00Z", "idle_minutes": 5,
                            "current_task": { "id": "d-302", "title": "회전코칭 AI 엔진 평가", "status": "in_progress", "directive_id": "d-302" } },
    "07-content":         { "display_name": "Content",   "role": "content",            "domain": "Content",                "status": "idle",    "last_active_at": "2026-05-30T16:00:00Z", "idle_minutes": 1350, "current_task": null },
    "08-mobile-eng":      { "display_name": "왕 정",     "role": "mobile_eng",         "domain": "Mobile App & Integration","status": "offline","last_active_at": "2026-05-29T19:00:00Z", "idle_minutes": 2603, "current_task": null },
    "09-devops":          { "display_name": "DevOps",    "role": "devops",             "domain": "DevOps / Infra",         "status": "active",  "last_active_at": "2026-05-31T13:00:00Z", "idle_minutes": 35,
                            "current_task": { "id": "d-601", "title": "GitHub Pages admin subroute", "status": "in_progress", "directive_id": "d-601" } },
    "10-backend":         { "display_name": "Backend",   "role": "backend",            "domain": "Backend Engineering",    "status": "active",  "last_active_at": "2026-05-31T13:30:00Z", "idle_minutes": 25,
                            "current_task": { "id": "d-201", "title": "Supabase Auth shim 통합", "status": "in_progress", "directive_id": "d-201" } },
    "11-orchestrator":    { "display_name": "Orchestrator", "role": "orchestrator",    "domain": "Orchestration",          "status": "active",  "last_active_at": "2026-05-31T13:55:00Z", "idle_minutes": 0,
                            "current_task": { "id": "d-602", "title": "CI iCloud-lock 재시도 패치", "status": "awaiting_approval", "directive_id": "d-602" } },
    "12-riding-analytics":{ "display_name": "티모 강",   "role": "riding_analytics",   "domain": "Sports Science / Riding","status": "active",  "last_active_at": "2026-05-31T13:00:00Z", "idle_minutes": 35,
                            "current_task": { "id": "d-303", "title": "스킬레벨 v2 통합 테스트", "status": "awaiting_approval", "directive_id": "d-303" } },
    "13-business":        { "display_name": "Business",  "role": "business",           "domain": "Business",               "status": "idle",    "last_active_at": "2026-05-29T15:00:00Z", "idle_minutes": 2843, "current_task": null },
    "14-legal":           { "display_name": "Legal",     "role": "legal",              "domain": "Legal",                  "status": "idle",    "last_active_at": "2026-05-27T15:00:00Z", "idle_minutes": 6723, "current_task": null },
    "15-marketing":       { "display_name": "캔 최",     "role": "marketing",          "domain": "Marketing & Social",     "status": "active",  "last_active_at": "2026-05-31T12:00:00Z", "idle_minutes": 113,
                            "current_task": { "id": "d-701", "title": "Brand voice 5채널 콘텐츠 캘", "status": "in_progress", "directive_id": "d-701" } }
  },

  "pending_approvals": [
    { "approval_id": "ap-001", "scope": "directive", "task_id": null, "directive_id": "d-003",
      "asked_by_slug": "01-pm", "question": "도메인 론칭 PLAN 승인 — 5/27 컷오버 안",
      "options": [{ "label": "Approve", "value": "approve" }, { "label": "Hold", "value": "hold" }],
      "created_at": "2026-05-31T13:55:00Z", "age_minutes": 28 },
    { "approval_id": "ap-002", "scope": "directive", "task_id": null, "directive_id": "d-303",
      "asked_by_slug": "12-riding-analytics", "question": "스킬레벨 v2 통합 테스트 통과 — 프로덕션 반영?",
      "options": [{ "label": "Approve", "value": "approve" }, { "label": "Reject", "value": "reject" }],
      "created_at": "2026-05-31T13:00:00Z", "age_minutes": 83 },
    { "approval_id": "ap-003", "scope": "directive", "task_id": null, "directive_id": "d-602",
      "asked_by_slug": "11-orchestrator", "question": "iCloud-lock 재시도 패치 (max 8→12, sleep 3s→5s)",
      "options": [{ "label": "Approve", "value": "approve" }, { "label": "Reject", "value": "reject" }],
      "created_at": "2026-05-31T12:30:00Z", "age_minutes": 113 }
  ],

  "recent_decisions": [
    { "approval_id": "ap-099", "question": "Phase 1 dashboard 라이브 URL 노출",
      "decision": "approve", "decided_at": "2026-05-31T09:30:00Z", "decided_by_email": "kor22@me.com",
      "source": { "directive_id": "d-000", "task_id": null } }
  ],

  "cost": {
    "day_total_usd":       4.39,
    "month_total_usd":    18.45,
    "month_cap_usd":      50.00,
    "month_remaining_usd": 31.55,
    "last_dispatch_usd":   0.18
  },

  "heartbeat": {
    "daemon_alive": true,
    "last_heartbeat_at": "2026-05-31T14:23:30Z",
    "stale_seconds": 15,
    "mode": "full"
  }
};
