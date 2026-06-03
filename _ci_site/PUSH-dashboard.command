#!/bin/bash
# Double-click me to commit + push the SailTech Orchestrator Dashboard (Phase 1 prototype).
# Includes iCloud-lock retry logic (mirrors PUSH-FIX.command pattern).

cd "$(dirname "$0")"
echo "==> Working in: $(pwd)"

retry_git() {
  local cmd="$@"
  local tries=0
  local max=8
  while [ $tries -lt $max ]; do
    rm -f .git/index.lock
    if eval "$cmd"; then
      return 0
    fi
    tries=$((tries+1))
    echo "==> attempt $tries/$max failed, waiting 3s and retrying..."
    sleep 3
    rm -f .git/index.lock
  done
  echo "==> all $max attempts failed"
  return 1
}

echo "==> Removing any stale .git/index.lock..."
rm -f .git/index.lock

echo ""
echo "==> Adding admin/dashboard/ ..."
retry_git "git add admin/dashboard/ PUSH-dashboard.command" || { echo "ABORT: git add failed"; read -n 1; exit 1; }

echo ""
echo "==> Committing..."
git commit -m "feat(admin/dashboard): SailTech Orchestrator Dashboard Phase 1 prototype

8 expert fleet 작업 가시화 PWA. Read-only Cytoscape.js mindmap.

Stack:
  - Vanilla JS + Cytoscape.js 3.28 (CDN)
  - PWA: manifest + service worker (app shell cache)
  - 모바일 (390px) + 데스크탑 (1440px) responsive
  - 다크 cockpit 테마 (#0a0e1a)

Features:
  - 중앙 hub → 8 expert (PM/FE/BE/Data/HW/UX/Visual/Ops) → task children
  - 색 인코딩: done/run/block/wait/approve
  - 크기 인코딩: priority P1-P4
  - 간선 인코딩: spine / branch / dep (점선)
  - 노드 탭 → side panel 상세 + focus mode
  - 승인 큐 bottom sheet (read-only)
  - 통계 status bar + filter / refresh / zoom / fit

Phase 1 scope:
  - 시각화 데모만, 실 데이터 없음 (data.sample.js fixture)
  - Auth 없음 (admin 디렉터리 직접 접근)
  - 승인 / 새 지시 dispatch 는 Phase 3

Files:
  admin/dashboard/
  ├── index.html        # shell
  ├── app.js            # Cytoscape 렌더 + 상호작용
  ├── data.sample.js    # 8 expert + 22 task fixture
  ├── styles.css        # dark theme · responsive
  ├── manifest.json     # PWA
  ├── sw.js             # service worker
  ├── README.md
  └── icons/ (favicon.svg + 192/512 png)

Next:
  Phase 2: orchestrator daemon JSON 폴링 / Supabase realtime,
           Google SSO auth (Danny only), GitHub Issues 연동
  Phase 3: 승인 + 새 지시 dispatch + push notification

Live: https://dmjgroup.kr/admin/dashboard/

Co-Authored-By: Orchestrator Dashboard MVP #9 <ai@anthropic>" 2>&1 || echo "(maybe nothing to commit)"

echo ""
echo "==> Pushing to origin/main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done! Latest commit:"
git log --oneline -1

echo ""
echo "==> Dashboard URL (GitHub Pages may take ~30s):"
echo "    https://dmjgroup.kr/admin/dashboard/"

echo ""
echo "Press any key to close..."
read -n 1
