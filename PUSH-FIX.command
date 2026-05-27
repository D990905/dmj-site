#!/bin/bash
# Double-click me to push pending changes to dmj-site GitHub repo
# Includes iCloud-lock retry logic

cd "$(dirname "$0")"
echo "==> Working in: $(pwd)"

# Retry wrapper for iCloud lock timeouts
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
echo "==> Adding all changes (with retry)..."
retry_git "git add -A" || { echo "ABORT: git add failed"; read -n 1; exit 1; }

echo ""
echo "==> Committing..."
git commit -m "§175 — 라이딩 오버랩 toggle + click-to-map UX fix

- HR trend chart speed overlay now OFF by default (clean HR-only view).
  Added '심박만 | 라이딩 오버랩' toggle next to elapsed/clock toggle.
  state.hrShowSpeed drives renderHrChart includeSpeed option.
  Card hint text adapts to mode ('우측 축 = 속도' only when overlay on).

- Click-to-map jump now also smooth-scrolls the map card into view when
  it's less than 35% visible in the viewport. Function was already wired
  correctly (verified: panMapToLatLng received correct lat/lng) but user
  couldn't see map change because it was scrolled out above the chart.
  Now clicking the chart deterministically brings the map into view." 2>&1 || echo "(maybe nothing to commit)"

echo ""
echo "==> Pushing to origin/main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done! Latest commit:"
git log --oneline -1

echo ""
echo "Press any key to close..."
read -n 1
