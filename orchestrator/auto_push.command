#!/bin/bash
# auto_push.command v0.5 — 페르소나 영역 일원화 (CoS 데이빗 옥 명령 #3, 2026-06-02 13:01 KST)
# v0.4 → v0.5: 모든 페르소나 영역 path 단일 DEFAULT_ALLOW. PUSH-mobile-app-spec.command 등 deprecate.
# owner check = commit message 자동 분류 (path-prefix → persona).
# 더블클릭 OK / 터미널 OK / launchd 호출 OK
#
# v0.3 변경 (의장 원칙: "페르소나 영역 무수정 + 페르소나 독립 진행 조력"):
#   - AUTO_PUSH_ALLOW_PATHS 환경변수 도입 (default: orchestrator/, _team/infra/)
#   - 인프라 자동 push 는 자기 영역만. 페르소나 영역 (riding-dashboard/, admin/,
#     _experts/, _team/dispatches/, 사이트 root html 등) 자동 push X.
#   - 페르소나는 자기 sandbox 에서 본인 영역 명시 push (또는 자기 auto_push helper).
#
# 기존 PUSH-FIX 대비 개선 (v0.1~v0.2):
#   1. iCloud placeholder (.icloud) 강제 다운로드 (brctl download)
#   2. .git/index.lock + .git/HEAD.lock + .git/refs/*.lock 모두 정리
#   3. 동시 실행 방지 lockfile (/tmp/orchestrator-push.lock)
#   4. EWOULDBLOCK / EBUSY / "Resource deadlock avoided" exponential backoff
#   5. push 실패 시 pull --rebase 자동 fallback
#   6. HEAD 무결성 사전 체크
#   7. Commit message 자동 생성 (변경 파일 요약 + 타임스탬프)

set -u

# --- Locate project root (script may be in orchestrator/ or repo root) ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$SCRIPT_DIR/.git" ]; then
  REPO="$SCRIPT_DIR"
elif [ -d "$SCRIPT_DIR/../.git" ]; then
  REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  echo "ERROR: cannot find .git anywhere near $SCRIPT_DIR" >&2
  read -n 1 -p "Press any key..."; exit 1
fi
cd "$REPO"
echo "==> Working in: $REPO"

# --- Concurrent-run guard ---
LOCKFILE="/tmp/orchestrator-push-$(echo "$REPO" | md5 -q 2>/dev/null || echo "$REPO" | shasum | cut -c1-8).lock"
exec 9>"$LOCKFILE"
if ! flock -n 9 2>/dev/null; then
  # macOS flock may not exist; fall back to PID file check
  if [ -f "${LOCKFILE}.pid" ] && kill -0 "$(cat "${LOCKFILE}.pid" 2>/dev/null)" 2>/dev/null; then
    echo "ERROR: another auto_push is running (pid $(cat "${LOCKFILE}.pid"))" >&2
    read -n 1 -p "Press any key..."; exit 1
  fi
fi
echo $$ > "${LOCKFILE}.pid"
trap 'rm -f "${LOCKFILE}.pid"' EXIT

# --- Clear all known git lock files ---
clear_git_locks() {
  rm -f .git/index.lock 2>/dev/null
  rm -f .git/HEAD.lock 2>/dev/null
  rm -f .git/config.lock 2>/dev/null
  find .git/refs -name '*.lock' -delete 2>/dev/null
  find .git -maxdepth 1 -name '*.lock' -delete 2>/dev/null
}

# --- Force-download any iCloud placeholders inside .git ---
icloud_download_git() {
  if ! command -v brctl >/dev/null 2>&1; then
    return 0
  fi
  # .icloud placeholder filenames look like .file.icloud — find and trigger download
  local placeholders
  placeholders=$(find .git -name '.*.icloud' -print 2>/dev/null | head -50)
  if [ -n "$placeholders" ]; then
    echo "==> iCloud placeholders found in .git, forcing download..."
    brctl download .git 2>/dev/null || true
    sleep 1
  fi
}

# --- Retry wrapper: detects iCloud / lock / deadlock and retries with backoff ---
retry_git() {
  local desc="$1"; shift
  local max=8
  local delay=1
  local attempt=1
  local out rc
  while [ $attempt -le $max ]; do
    clear_git_locks
    out=$("$@" 2>&1); rc=$?
    if [ $rc -eq 0 ]; then
      [ -n "$out" ] && echo "$out"
      return 0
    fi
    # Decide whether to retry based on error signature
    case "$out" in
      *"Resource deadlock avoided"*|\
      *"Resource temporarily unavailable"*|\
      *"Device or resource busy"*|\
      *"index.lock"*|\
      *"unable to create"*lock*|\
      *"Failed to resolve HEAD"*|\
      *"branch appears to be broken"*)
        echo "==> $desc attempt $attempt/$max: iCloud/lock issue, retrying in ${delay}s..."
        icloud_download_git
        sleep $delay
        delay=$(( delay * 2 ))
        [ $delay -gt 16 ] && delay=16
        attempt=$(( attempt + 1 ))
        ;;
      *)
        # Non-retriable — show error and bail
        echo "==> $desc failed (non-retriable):" >&2
        echo "$out" >&2
        return $rc
        ;;
    esac
  done
  echo "==> $desc: exhausted $max retries" >&2
  echo "$out" >&2
  return 1
}

# --- HEAD sanity check ---
echo "==> HEAD sanity check..."
clear_git_locks
icloud_download_git
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "==> HEAD broken — attempting recovery via iCloud download + refs reset..."
  # Last resort: re-read HEAD ref from file (forces iCloud download via stat)
  cat .git/HEAD >/dev/null 2>&1 || true
  cat .git/refs/heads/main >/dev/null 2>&1 || true
  sleep 2
  if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    echo "ERROR: HEAD still broken. Likely cause: iCloud has not finished downloading .git/refs/heads/main." >&2
    echo "  Try: open Finder → navigate to .git/refs/heads/, wait for cloud icon to disappear, retry." >&2
    echo "  Or:  brctl download '.git'   then retry." >&2
    read -n 1 -p "Press any key..."; exit 1
  fi
fi
echo "==> HEAD OK: $(git rev-parse --short HEAD)"

# --- Auto-generate commit message from changes ---
generate_commit_message() {
  local file_count
  file_count=$(git diff --cached --name-only | wc -l | tr -d ' ')
  local files_short
  files_short=$(git diff --cached --name-only | head -3 | tr '\n' ' ' | sed 's/ $//')
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  if [ "$file_count" -eq 0 ]; then
    echo "auto-deploy: heartbeat $ts"
  elif [ "$file_count" -le 3 ]; then
    echo "auto-deploy: $files_short ($ts)"
  else
    local more=$(( file_count - 3 ))
    echo "auto-deploy: $files_short +$more more ($ts)"
  fi
}

# --- Stage changes (페르소나 영역 자동 보호 — v0.3) ---
echo ""
echo "==> Staging changes (인프라 영역만)..."

# AUTO_PUSH_ALLOW_PATHS 환경변수 또는 default (v0.5 — 모든 페르소나 영역 일원화)
DEFAULT_ALLOW="orchestrator/ _team/ _experts/ marketing/ admin/dashboard/ admin/team-live.html assets/ riding-dashboard/ .github/ .gitignore index.html find-my-gear.html levitaz.html cart.html quote.html consult.html calculator.html premium.html profile.html skill-assessment.html"
ALLOW_LIST="${AUTO_PUSH_ALLOW_PATHS:-$DEFAULT_ALLOW}"
# 공백 또는 콤마 분리
IFS=$', \n' read -r -a ALLOW_PATHS <<< "$ALLOW_LIST"
echo "    allow: ${ALLOW_PATHS[*]}"

# 각 path 별 add (-A 로 untracked 도 잡고 페르소나 영역은 자동 skip)
for p in "${ALLOW_PATHS[@]}"; do
  [ -z "$p" ] && continue
  if [ -e "$p" ]; then
    retry_git "git add $p" git add -A -- "$p"
  fi
done

STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')

# 페르소나 영역 변경이 있으면 알림 (자동 push X, 알림만)
PERSONA_CHANGES=$(git diff --name-only -- ':!orchestrator/' ':!_team/infra/' 2>/dev/null | wc -l | tr -d ' ')
if [ "$PERSONA_CHANGES" -gt 0 ]; then
  echo "    ℹ️  페르소나 영역 변경 $PERSONA_CHANGES 파일 (자동 push X — 페르소나 본인 책임)."
fi
if [ "$STAGED" -eq 0 ]; then
  echo "==> Nothing to commit. Checking if local is ahead of origin..."
  AHEAD=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
  if [ "$AHEAD" -eq 0 ]; then
    echo "==> Up to date. Nothing to push."
    rm -f "${LOCKFILE}.pid"
    [ -t 0 ] && read -n 1 -p "Press any key..."
    exit 0
  fi
  echo "==> Local is $AHEAD commit(s) ahead. Will attempt push."
else
  MSG=$(generate_commit_message)
  echo "==> Committing: $MSG"
  retry_git "git commit" git commit -m "$MSG" || {
    echo "ERROR: commit failed" >&2
    read -n 1 -p "Press any key..."; exit 1
  }
fi

# --- Push, with pull --rebase fallback on non-fast-forward ---
echo ""
echo "==> Pushing to origin/main..."
push_output=$(git push origin main 2>&1); push_rc=$?
if [ $push_rc -ne 0 ]; then
  case "$push_output" in
    *"non-fast-forward"*|*"fetch first"*|*"rejected"*)
      echo "==> push rejected (non-fast-forward). Trying pull --rebase --autostash..."
      retry_git "git pull --rebase --autostash" git pull --rebase --autostash origin main || {
        echo "ERROR: pull --rebase failed. Manual intervention needed." >&2
        echo "$push_output" >&2
        read -n 1 -p "Press any key..."; exit 1
      }
      retry_git "git push (after rebase)" git push origin main || {
        echo "ERROR: push still failed after rebase" >&2
        read -n 1 -p "Press any key..."; exit 1
      }
      ;;
    *"Resource deadlock"*|*"index.lock"*|*"locked"*)
      echo "==> push hit lock — retrying..."
      retry_git "git push (retry)" git push origin main || {
        echo "$push_output" >&2
        read -n 1 -p "Press any key..."; exit 1
      }
      ;;
    *)
      echo "ERROR: push failed (non-retriable):" >&2
      echo "$push_output" >&2
      read -n 1 -p "Press any key..."; exit 1
      ;;
  esac
else
  echo "$push_output"
fi

# --- Done ---
echo ""
echo "==> Done. Latest commit:"
git log --oneline -1
echo ""
# Interactive mode (double-click) waits; non-interactive (launchd) exits immediately
if [ -t 0 ]; then
  read -n 1 -p "Press any key to close..."
fi
exit 0
