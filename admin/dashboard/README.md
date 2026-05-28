# SailTech Orchestrator Dashboard — Phase 1 (prototype)

8 expert fleet 의 작업 상태를 mindmap 으로 시각화하는 PWA 프로토타입.

## 라이브
- 프로토타입: https://dmjgroup.kr/admin/dashboard/
- 정식 (Phase 2 이후): https://admin.sailtechco.com (별도 호스팅·private)

## 파일
```
admin/dashboard/
├── index.html        # 셸 + topbar + canvas + side panel + bottom sheet
├── app.js            # Cytoscape.js 렌더 · 레이아웃 · 상호작용
├── data.sample.js    # Phase 1 sample fixture (8 expert + 22 task)
├── styles.css        # 다크 cockpit 테마 · 모바일+데스크탑 responsive
├── manifest.json     # PWA (standalone, theme #0a0e1a)
├── sw.js             # 서비스 워커 (app shell cache)
└── icons/
    ├── favicon.svg
    ├── icon-192.png
    └── icon-512.png
```

## Phase 1 범위
- [x] Cytoscape mindmap: 중앙 hub → 8 expert → 각 expert 의 task children
- [x] 색 인코딩: 🟢 done / 🟡 run / 🔴 block / ⚪ wait / 🔵 approve
- [x] 크기 인코딩: priority (P1~P4)
- [x] 간선 인코딩: spine (hub→expert) · branch (expert→task) · dep (점선, 차단 의존)
- [x] 모바일 (390px) / 데스크탑 (1440px) responsive
- [x] PWA installable (홈 화면 추가)
- [x] 승인 큐 bottom sheet (read-only)
- [x] 통계 status bar
- [x] 노드 탭 → side panel 상세
- [x] focus mode (선택 노드 이웃 강조)
- [x] filter / refresh / zoom / fit 컨트롤
- [ ] **읽기 전용** — 실 데이터 backend, 승인, 새 지시 dispatch 는 Phase 2/3

## 다음
- Phase 2: orchestrator daemon JSON 폴링 / Supabase realtime, Auth (Google SSO, Danny only), GitHub Issues 연동
- Phase 3: 승인 / 새 지시 dispatch, push notification
- Visual + UX 전문가 디자인 input 받으면 폴리시

## 로컬 테스트
```bash
cd site/admin/dashboard
python3 -m http.server 8080
# → http://localhost:8080
```
