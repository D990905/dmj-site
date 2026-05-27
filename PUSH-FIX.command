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
git commit -m "§172+§173+§174 — SW cleanup + HR chart enhancements + PDF blank fix

§172 — Stale Service Worker auto-cleanup (DO_NOT_REVERT)
  Inline cleanup script injected into <head> of 124 HTML files. On page load,
  unregisters any leftover service workers (stale dmjgroup.kr/ind-script/sw.php
  from previous domain owner) and clears caches, then one-time reload guarded by
  sessionStorage flag. Fixes iOS Safari/Chrome dead-clicks / scroll-only bug.

§173 — riding-dashboard HR chart upgrades
  - HR trend chart now also exposes 경과/실제 시간 toggle directly in its card
    header (was previously only in trackedit card; both toggles stay in sync).
  - Right-axis speed overlay (y1) on HR trend chart — speed track in current
    unit (kt/km/h) rendered as background context behind HR curve.
  - Click on HR trend chart → map pans to that moment (jumpMapToTime).
  - Charts.panMapToLatLng helper exposed for cross-module jumps.

§174 — HR analysis %HRmax display + PDF blank report fix
  - HR summary tiles (avg/max/min) now show %HRmax against user-input max HR
    (or session-observed max if no input). %HRmax recomputes on input change.
  - PDF report 백지 fix: #rd-pdf-root switched from position:fixed;left:-10000px
    (eKoopmans/html2pdf.js#422 known blank-PDF issue) to position:absolute +
    opacity:0 with onclone restoration. html2canvas now captures populated
    canvas instead of empty viewport region." 2>&1 || echo "(maybe nothing to commit)"

echo ""
echo "==> Pushing to origin/main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done! Latest commit:"
git log --oneline -1

echo ""
echo "Press any key to close..."
read -n 1
