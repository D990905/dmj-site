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
git commit -m "§176 — PDF blank fix v3 (opacity:0 → top:-99999px)

Previous §174 fix (position:absolute + opacity:0 + z-index:-9999 + onclone
opacity:1 restoration) still produced 876-byte (essentially blank) PDFs.
html2canvas's clone-and-render pipeline doesn't reliably override opacity
even with onclone setProperty(opacity, 1, important).

Switching to top:-99999px keeps element fully visible (opacity:1, no z-index
trick) with proper layout, but positioned far above the viewport so the user
can't see it. Unlike negative LEFT (which breaks html2canvas#422), negative
TOP is well-supported by html2canvas. onclone callback now only normalizes
position to static for clean capture, no opacity restoration needed." 2>&1 || echo "(maybe nothing to commit)"

echo ""
echo "==> Pushing to origin/main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done! Latest commit:"
git log --oneline -1

echo ""
echo "Press any key to close..."
read -n 1
