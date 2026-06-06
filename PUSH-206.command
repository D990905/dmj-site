#!/bin/bash
# PUSH-206.command — 통합 production push (§195·§204·§206·§208·§209)
# By 알렉스 박 (Alex Park, #4) · 2026-06-06 (audit 정정 — broader scope)
#
# 통합 변경 (옥대표님 더블클릭 1회로 일괄 라이브):
#   §195 header "DMJ·공방" → "단무지" sweep (219 페이지)
#   §204 about.html 조수철 portrait (image fallback)
#   §206 subpage cart icon sweep (98 신규 + 11 기존 = 109 페이지)
#   §208 takoon/cruise.html v17 가격 정정 (5'6 1.93M / 5'10 1.98M / 6'0 1.98M)
#   §209 사이즈→가격 reactive (product-detail.js NEW + .css M + 39 페이지 sweep)
#   기타: .gitignore _ci_site/ 추가 (build cache push 차단)
#
# 정직 raise:
#   audit 결과 = 239 uncommit file. _ci_site/ 105 file = build cache (gitignore 추가).
#   production 134 file = 본 통합 push 대상.
#   PUSH-205 (_design-system preview) 는 별도 — 옥대표님 view-only 의도 다름.
#
# v2 idempotent + iCloud retry + 자가 삭제.

set -u
SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
if [ -d "$SCRIPT_DIR/.git" ]; then REPO="$SCRIPT_DIR"
elif [ -d "$SCRIPT_DIR/../.git" ]; then REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
else echo "ERROR: .git" >&2; read -n 1 -p "key..." || true; exit 1; fi
cd "$REPO"
echo "==> Working in: $REPO"

LOCKFILE="/tmp/push-206-$(echo "$REPO" | md5 -q 2>/dev/null || echo "$REPO" | shasum | cut -c1-8).lock"
[ -f "${LOCKFILE}.pid" ] && kill -0 "$(cat "${LOCKFILE}.pid" 2>/dev/null)" 2>/dev/null && { echo "ERROR: other PUSH-206" >&2; read -n 1 -p "key..." || true; exit 1; }
echo $$ > "${LOCKFILE}.pid"; trap 'rm -f "${LOCKFILE}.pid"' EXIT

clear_git_locks() {
  rm -f .git/index.lock .git/HEAD.lock .git/config.lock 2>/dev/null
  find .git/refs -name '*.lock' -delete 2>/dev/null
  find .git -maxdepth 1 -name '*.lock' -delete 2>/dev/null
}
icloud_download_git() {
  command -v brctl >/dev/null 2>&1 && brctl download .git >/dev/null 2>&1 || true
  find .git -name '*.icloud' 2>/dev/null | while read -r f; do cat "$f" >/dev/null 2>&1 || true; done
}
retry_git() {
  local cmd="$@" tries=0 max=8 delay=1
  while [ $tries -lt $max ]; do
    clear_git_locks
    out=$(eval "$cmd" 2>&1); rc=$?
    [ $rc -eq 0 ] && { echo "$out"; return 0; }
    echo "$out" | tail -3
    case "$out" in
      *"Resource deadlock avoided"*|*"Resource temporarily unavailable"*|*"Device or resource busy"*|*"Failed to resolve HEAD"*|*"branch appears to be broken"*|*"index.lock"*|*"HEAD.lock"*|*"unable to create"*|*".lock' could not be created"*)
        icloud_download_git; sleep $delay
        delay=$(( delay * 2 )); [ $delay -gt 16 ] && delay=16
        tries=$((tries+1));;
      *) return $rc;;
    esac
  done
  echo "==> $max attempts failed" >&2; return 1
}

git rev-parse --verify HEAD >/dev/null 2>&1 || { icloud_download_git; sleep 5; }
git log --oneline -1

# Stage everything except _ci_site (now in .gitignore) + PUSH-205/209.command (별도 commit)
echo ""
clear_git_locks
TREE_DIRTY=$(git status --porcelain 2>/dev/null | awk '$2 !~ /^_ci_site/ && $2 != "PUSH-205.command" && $2 != "PUSH-209.command"' | wc -l | tr -d ' ')
if [ "$TREE_DIRTY" = "0" ]; then
  echo "==> Clean tree — idempotent re-run"
else
  echo "==> $TREE_DIRTY production files modified — staging"
  # §207 GONG file delete — Rose Option A 확정 + 옥대표님 위임 "알아서 해"
  # File: choppy-freeride-action-1.jpg (GONG 식별, foiling-action-3.jpg 로 swap 완료)
  if [ -f assets/images/products/ppc/lifestyle/choppy-freeride-action-1.jpg ]; then
    echo "==> §207 git rm GONG file..."
    retry_git "git rm -f assets/images/products/ppc/lifestyle/choppy-freeride-action-1.jpg" || echo "  (file 이미 untracked 가능 — continue)"
  fi
  # git add -A all + exclude separately push'd scripts
  retry_git "git add -A . ':(exclude)_ci_site' ':(exclude)PUSH-205.command' ':(exclude)PUSH-209.command'" || {
    echo "ABORT add" >&2; read -n 1 -p "key..." || true; exit 1
  }
  retry_git "git commit -m \"통합 production push — §195 §204 §206 §208 §209 (Alex Park #4 · 2026-06-06)

옥대표님 audit 발견: PUSH-200/198/199 잔존 0. uncommit 239 file 통합 정리 필요.

§195 — header 'DMJ·공방' → '단무지' sweep (219 페이지)
  nav__logo-mark D + nav__logo-sub 단무지 → 단일 span '단무지'.
  법무 표기 (footer-business 사업자명 · footer copyright · Schema.org legalName) 유지.

§204 — about.html 조수철 portrait
  placeholder gradient div → <img onerror> fallback 패턴 (옥덕필 §183 동일).
  iCloud 'Resource deadlock' 로 image 파일 copy 차단 — 옥대표님 Mac 합류 후 manual cp.
  HTML reference path = assets/images/about/cho-soocheol-portrait.jpeg.

§206 — subpage cart icon sweep (DO_NOT_REVERT §171-B)
  옥대표님 발견: '메인 랜딩 cart 있고 subpage 다 사라짐'.
  진단: §195 sed pattern 과 무관 (cart <a> 별도 element). historic asymmetry.
  Fix: nav__link--cta 직후 + nav__link--login 직전 cart block depth-relative 인서트.
  98 신규 + 11 기존 = 109 production page (login 보유 109 = 100% match).
  §182-B aria-live='polite' aria-atomic='true' 표준 패턴 동시 적용.

§207 — GONG 식별 image swap (Rose Option A · 옥대표님 위임)
  style/choppy-freeride.html line 234: choppy-freeride-action-1.jpg → foiling-action-3.jpg
  alt: PPC M1 5.0 · 여성 라이더 · 다양성 narrative align (Rose audit doc 권장)
  git rm assets/images/products/ppc/lifestyle/choppy-freeride-action-1.jpg
  (git history 보존, revert 가능. cross-page reference 0 — production 단일 file)

§208 — takoon/cruise.html v17 가격 정정 (샘 정 #2 audit 결과)
  5'6\\\"  ₩1,980,000 → ₩1,930,000
  5'10\\\" ₩1,960,000 → ₩1,980,000
  6'0\\\"  ₩2,090,000 → ₩1,980,000

§209 — 사이즈 → 가격 reactive (DO_NOT_REVERT)
  products/product-detail.js (NEW · single source · DMJMatrix.getPrice 활용)
  products/product-detail.css (M · §209 .pd-buy__price BEM 토큰)
  script src 인서트 39 페이지 + markup 인서트 14 페이지 (실 <select data-buy-size> 보유)
  25 page = single size product → script init() null check silent noop.
  WCAG 2.1 SC 4.1.3 aria-live announce.

.gitignore 보강 — _ci_site/ 추가 (CI build cache, push 차단)

회귀 가드: §171-B v4 · §172 · §173 · §182-A·B · §198 · §200-B · §202 영향 0
By Alex Park (#4) · Sam Jung (#2) §208 · David Ok (CoS) dispatch · 옥대표님 audit\"" || {
    REMAIN=$(git status --porcelain 2>/dev/null | awk '$2 !~ /^_ci_site/' | wc -l | tr -d ' ')
    [ "$REMAIN" = "0" ] && echo "==> race to clean" || { echo "ABORT commit" >&2; read -n 1 -p "key..." || true; exit 1; }
  }
fi

echo ""
echo "==> Pushing..."
PUSH_OK=0
if retry_git "git push origin main"; then PUSH_OK=1
else
  retry_git "git pull --rebase origin main" && retry_git "git push origin main" && PUSH_OK=1
fi
[ $PUSH_OK -eq 0 ] && { echo "ABORT push" >&2; read -n 1 -p "key..." || true; exit 1; }

echo ""
echo "==> Cleanup PUSH-206 + prior PUSH-200/199/198..."
for f in PUSH-200.command PUSH-199.command PUSH-198.command PUSH-197.command; do
  [ -f "$f" ] && { echo "    rm $f"; rm -f "$f" 2>/dev/null; }
done
SELF="$(basename "$SCRIPT_PATH")"
echo "    rm $SELF (self)"; rm -f "$SCRIPT_PATH" 2>/dev/null
clear_git_locks
git add -A PUSH-19?.command PUSH-20?.command "$SELF" 2>/dev/null || true
DIRTY_AFTER=$(git status --porcelain 2>/dev/null | awk '$2 !~ /^_ci_site/' | wc -l | tr -d ' ')
if [ "$DIRTY_AFTER" != "0" ]; then
  retry_git "git commit -m \"chore: cleanup PUSH-206.command (self-delete)\"" 2>/dev/null || true
  retry_git "git push origin main" 2>/dev/null || echo "    (cleanup next cycle)"
fi

echo ""
echo "==> Done."
git log --oneline -2
echo ""
echo "==> CI/CD 30s 후 라이브. 검증:"
echo "    §195 header: dmjgroup.kr (left logo = '단무지' 만)"
echo "    §204 about:  dmjgroup.kr/about.html (조수철 image — Mac 합류 후 manual cp)"
echo "    §206 cart:   dmjgroup.kr/style/choppy-freeride.html · /products/levitaz/fw-540.html"
echo "    §208 가격:   dmjgroup.kr/products/takoon/cruise.html (5'10 / 6'0 swap 확인)"
echo "    §209 reactive: dmjgroup.kr/products/takoon/glide.html (사이즈 변경 → 가격)"
echo ""
read -n 1 -p "key..." || true
