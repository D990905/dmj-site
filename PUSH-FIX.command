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
git commit -m "§177 — PDF blank fix v4 — replace html2pdf bundle with standalone html2canvas + jsPDF

Root cause finally identified: html2pdf.js 0.10.1's bundled html2canvas
returns blank canvases in modern Chrome (PDF output always ~3KB regardless
of input — confirmed even with simple test div). Standalone html2canvas
1.4.1 loaded from same CDN captures the SAME element correctly. Library
bundle is broken, not our CSS/positioning.

Solution:
  - Remove html2pdf dependency entirely.
  - Lazy-load standalone html2canvas 1.4.1 + jsPDF 2.5.1 from cdnjs.
  - Capture each .pdf-page individually (scale: 1.5) — sequential
    Promise chain for memory safety.
  - Compose PDF via jsPDF.addImage + addPage per page.
  - onclone still applies Pretendard font for Korean rendering.

Also reverted #rd-pdf-root CSS to position:absolute + top:-99999px (clean
hide without opacity tricks). The new per-page renderer doesn't need any
position normalization in onclone." 2>&1 || echo "(maybe nothing to commit)"

echo ""
echo "==> Pushing to origin/main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done! Latest commit:"
git log --oneline -1

echo ""
echo "Press any key to close..."
read -n 1
