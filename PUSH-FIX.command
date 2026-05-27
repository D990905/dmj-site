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
git commit -m "§172 — Stale Service Worker auto-cleanup injected into all site HTML (DO_NOT_REVERT)

Adds inline cleanup script to <head> of 124 HTML files (4 fragments without <head>
correctly skipped). On page load, unregisters any leftover service workers (e.g. the
stale dmjgroup.kr/ind-script/sw.php from the previous domain owner) and clears caches,
then does a one-time reload guarded by sessionStorage flag to avoid infinite loops.
Fixes iOS Safari/Chrome users seeing scroll-only / dead-clicks behaviour." 2>&1 || echo "(maybe nothing to commit)"

echo ""
echo "==> Pushing to origin/main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done! Latest commit:"
git log --oneline -1

echo ""
echo "Press any key to close..."
read -n 1
