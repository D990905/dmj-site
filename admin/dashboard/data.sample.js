/* SailTech Orchestrator — Phase 1 sample data
   Static fixture so the mindmap renders without backend.
   Real data feed lands in Phase 2 (orchestrator daemon → JSON polling / Supabase realtime).

   Status legend: done | run | block | wait | approve
*/
window.SAILTECH_SAMPLE = {
  generatedAt: "2026-05-27T12:50:00+09:00",
  hub: {
    id: "hub",
    label: "SailTech\n· dmjgroup ·",
    kind: "hub"
  },
  experts: [
    { id: "e_pm",      label: "PM",                short: "PM",  icon: "🧭" },
    { id: "e_fe",      label: "Frontend",          short: "FE",  icon: "🎨" },
    { id: "e_be",      label: "Backend",           short: "BE",  icon: "⚙️" },
    { id: "e_data",    label: "Data Analytics",    short: "DATA",icon: "📊" },
    { id: "e_hw",      label: "Hardware / Embed",  short: "HW",  icon: "🔌" },
    { id: "e_ux",      label: "UX Research",       short: "UX",  icon: "🔬" },
    { id: "e_vis",     label: "Visual Design",     short: "VIS", icon: "✨" },
    { id: "e_ops",     label: "DevOps / Infra",    short: "OPS", icon: "🛡️" }
  ],
  // status colors map → look up in app.js
  tasks: [
    // PM
    { id: "t_pm_1", parent: "e_pm",   label: "Phase 2 백로그 정리",          status: "run",    priority: 3 },
    { id: "t_pm_2", parent: "e_pm",   label: "주간 리포트 #21",              status: "done",   priority: 1 },
    { id: "t_pm_3", parent: "e_pm",   label: "도메인 론칭 PLAN 승인",        status: "approve",priority: 4 },

    // Frontend
    { id: "t_fe_1", parent: "e_fe",   label: "라이딩 리플레이 뷰어 폴리시",   status: "run",    priority: 3 },
    { id: "t_fe_2", parent: "e_fe",   label: "마이페이지 로그인 버그 수정",    status: "block",  priority: 4, dependsOn: "t_be_2" },
    { id: "t_fe_3", parent: "e_fe",   label: "스킬 어세스먼트 UI v2",         status: "wait",   priority: 2 },

    // Backend
    { id: "t_be_1", parent: "e_be",   label: "Supabase Auth shim 통합",      status: "run",    priority: 4 },
    { id: "t_be_2", parent: "e_be",   label: "Session API 토큰 갱신 수정",   status: "run",    priority: 4 },
    { id: "t_be_3", parent: "e_be",   label: "Realtime 채널 spec",           status: "wait",   priority: 2 },

    // Data Analytics
    { id: "t_da_1", parent: "e_data", label: "라이딩 통계 패널 v2 검증",      status: "done",   priority: 3 },
    { id: "t_da_2", parent: "e_data", label: "회전코칭 AI 엔진 평가",         status: "run",    priority: 3 },
    { id: "t_da_3", parent: "e_data", label: "스킬레벨 v2 통합 테스트",       status: "approve",priority: 3 },

    // Hardware
    { id: "t_hw_1", parent: "e_hw",   label: "Atlas2 벤치마크 갭 분석",       status: "done",   priority: 2 },
    { id: "t_hw_2", parent: "e_hw",   label: "센서 BOM 견적 1차",            status: "run",    priority: 3 },

    // UX
    { id: "t_ux_1", parent: "e_ux",   label: "Orchestrator 대시보드 UX 인터뷰", status: "wait",  priority: 3 },
    { id: "t_ux_2", parent: "e_ux",   label: "라이딩 대시보드 사용성 테스트",  status: "run",    priority: 2 },

    // Visual
    { id: "t_vi_1", parent: "e_vis",  label: "Dashboard 디자인 시안 v1",     status: "wait",   priority: 3 },
    { id: "t_vi_2", parent: "e_vis",  label: "Brand 컬러 가이드 정리",        status: "done",   priority: 1 },

    // Ops
    { id: "t_op_1", parent: "e_ops",  label: "GitHub Pages → admin subroute",status: "run",   priority: 3 },
    { id: "t_op_2", parent: "e_ops",  label: "CI iCloud-lock 재시도 패치",   status: "approve",priority: 2 },
    { id: "t_op_3", parent: "e_ops",  label: "Sentry 알람 임계 조정",         status: "wait",   priority: 1 }
  ],
  approvalQueue: [
    { id: "t_pm_3", expert: "PM",   title: "도메인 론칭 PLAN 승인",      summary: "5/27 admin.sailtechco.com 컷오버 안. 1주 모니터링 후 정식." },
    { id: "t_da_3", expert: "DATA", title: "스킬레벨 v2 통합 테스트 결과", summary: "회귀 4건 / 신규 12건 통과. 프로덕션 반영 권장." },
    { id: "t_op_2", expert: "OPS",  title: "CI iCloud-lock 재시도 패치",  summary: "max=8 → 12, sleep 3s→5s. 야간 실패율 -78%." }
  ]
};
