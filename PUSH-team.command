#!/bin/bash
# Double-click me to push the SailTechCo team folder to dmj-site
# Adds site/_team/ (Persona Bible · 11 profiles · virtual office · protocols)

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
echo "==> Adding _team/ folder (with retry)..."
retry_git "git add -A _team/" || { echo "ABORT: git add failed"; read -n 1; exit 1; }

echo ""
echo "==> Status:"
git status -s _team/ | head -30

echo ""
echo "==> Committing..."
git commit -m "feat(_team): SailTechCo 가상 운영팀 v1.0 — 11명 persona + 가상 사무실 + 11 portfolio + protocols

11명 운영진 (옥덕필 Danny CEO + 데이빗 옥 Chief of Staff + 조수철 자문 + 8 전문가):
#1 로즈 윤 (Rose Yoon) — Visual Design Director · KAIST + RISD
#2 샘 정 (Sam Jung) — DataViz Specialist · SNU + CMU HCI
#3 티모 강 박사 (Timo Kang, PhD) — Sports Science · Loughborough PhD
#4 알렉스 박 (Alex Park) — Senior Frontend Eng · KAIST · ex-Linear
#5 메이 한 (May Han) — UX Research Director · Ewha + CMU HCI
#6 캔 최 (Ken Choi) — Marketing & Social · Yonsei · ex-Patagonia
#7 히로 구 (Hiro Goo) — Hardware Lead · POSTECH + ETH Zürich
#8 왕 정 (Wang Jung) — Senior Mobile App · KAIST + Stanford

산출물:
- _team/team_personas.md (Persona Bible, 11명 학력·경력·자격증·강점·톤·주의)
- _team/team_avatars/*.svg (9 flat-geometric portrait, mobile-friendly 160×160)
- _team/virtual_office.html (모바일 평면도 — CEO·CoS·Advisor 3-room + 8 desks + 회의실 + 카페)
- _team/profiles/*.html (11 mini-portfolio 4-slide: Cover · Background · Case Study · Specialization)
- _team/profiles/profile-style.css (shared Linear·Stripe·Geist tone)
- _team/index.html (전체 팀 navigation)
- _team/meeting_protocol.md (회의·dispatch·보고 운영)
- _team/dispatch_template.md (8 persona 톤별 brief template)

향후 dispatch 시 expert #N → [이름 직함]에게 호명. 추상에서 사람으로." 2>&1 | tail -5

if [ $? -ne 0 ]; then
  echo "==> Commit may have had nothing to commit, continuing..."
fi

echo ""
echo "==> Pushing to origin main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: git push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done. GitHub Pages will rebuild within 60 seconds."
echo "==> Live: https://dmjgroup.kr/_team/ (or /site/_team/)"
echo ""
read -p "Press any key to close..." -n 1
