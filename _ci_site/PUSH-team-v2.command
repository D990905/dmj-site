#!/bin/bash
# Double-click me to push v1.1 — dispatches + operations_setup + persona Bible sync
# v1.0 → v1.1: 첫 실전 dispatch · 운영 routine · Danny + Coach Cho 풀 persona

cd "$(dirname "$0")"
echo "==> Working in: $(pwd)"

retry_git() {
  local cmd="$@"
  local tries=0
  local max=8
  while [ $tries -lt $max ]; do
    rm -f .git/index.lock
    if eval "$cmd"; then return 0; fi
    tries=$((tries+1))
    echo "==> attempt $tries/$max failed, waiting 3s..."
    sleep 3
    rm -f .git/index.lock
  done
  return 1
}

rm -f .git/index.lock

echo ""
echo "==> Adding _team/ changes..."
retry_git "git add -A _team/" || { echo "ABORT: git add failed"; read -n 1; exit 1; }

echo ""
echo "==> Status:"
git status -s _team/ | head -30

echo ""
echo "==> Committing v1.1..."
git commit -m "feat(_team): v1.1 — 첫 실전 dispatch + 운영 routine + Danny/Cho persona sync

A. 라이브 검증 완료 (모바일 viewport · index · virtual_office · profile/rose-yoon).
B. 첫 실전 dispatch — Focus Ring 표준화 (WCAG 2.2 #2.4.13):
   - D-2026-05-31-001 (로즈 윤 · spec, due 2026-06-03)
   - D-2026-05-31-002 (알렉스 박 · impl, due 2026-06-05, blocked by D-001)
   - D-2026-05-31-003 (데이빗 옥 · tracking, daily 18:00 status)
C. 운영 routine setup spec — Notion #decisions + Slack 8 채널 + Google Cal 3 invite (월·수·금).
D. Persona Bible v1.1 sync — §12 옥덕필 Danny + §13 조수철 Coach Cho 풀 persona
   (학력·경력·자격증·강점·톤). profile 페이지와 sync.

신규 파일:
- _team/dispatches/README.md
- _team/dispatches/D-2026-05-31-001-focus-ring-spec-rose.md
- _team/dispatches/D-2026-05-31-002-focus-ring-impl-alex.md
- _team/dispatches/D-2026-05-31-003-focus-ring-tracking-david.md
- _team/operations_setup.md
- _team/team_personas.md (v1.1 — Danny + Cho 추가)"

if [ $? -ne 0 ]; then echo "==> nothing to commit, continuing..."; fi

echo ""
echo "==> Pushing..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done. CI rebuilds in 60s."
echo "==> Live: https://dmjgroup.kr/_team/"
echo "==> Dispatches: https://dmjgroup.kr/_team/dispatches/"
echo ""
read -p "Press any key..." -n 1
