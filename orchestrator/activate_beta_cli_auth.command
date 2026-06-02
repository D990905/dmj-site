#!/bin/bash
# activate_beta_cli_auth.command v0.1 — CoS β path (2026-06-02 14:10 KST)
# Anthropic API key 매몰 회피, Claude Code CLI 인증 (claude login) 상속 시도.
#
# 활성화:
#   - ENABLE_STATE_PROJECTION=true (state JSON projection)
#   - ENABLE_DIRECTIVE_LOOP=true (자동 dispatch 시도)
#   - ANTHROPIC_API_KEY 미설정 → SDK 가 CLI subscription 인증 상속
#
# 사전 조건:
#   - Claude Code CLI 설치: curl -fsSL https://claude.ai/install.sh | bash (또는 brew)
#   - claude login (Pro/Max 구독 OAuth 인증 1회)
#   - GitHub PAT (orchestrator-github-token) Keychain (Issues 폴링)

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HOME/.config/orchestrator/.env"
LAUNCHAGENT="$HOME/Library/LaunchAgents/com.dmj.orchestrator.plist"
LOG_DIR="$HOME/Library/Logs/Orchestrator"

echo "════════════════════════════════════════════════════════"
echo "Orchestrator — β CLI Auth Activation v0.1"
echo "════════════════════════════════════════════════════════"
echo "Sent: $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')"
echo ""

# --- 사전 체크 ---
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ install_daemon.command 먼저 실행 필요."
  read -n 1; exit 1
fi

# --- lockfile ---
LOCKFILE="/tmp/orchestrator-activate-beta.lock"
[ -f "$LOCKFILE" ] && kill -0 "$(cat "$LOCKFILE" 2>/dev/null)" 2>/dev/null && {
  echo "❌ 이미 실행 중"; read -n 1; exit 1
}
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# --- 1. Claude Code CLI 설치 확인 ---
echo ""
echo "──── [1/5] Claude Code CLI 설치 확인 ────"
if command -v claude >/dev/null 2>&1; then
  CLAUDE_VERSION=$(claude --version 2>&1 | head -1)
  echo "✓ claude CLI 발견: $CLAUDE_VERSION"
else
  echo "❌ claude CLI 미설치."
  echo "   설치 명령:"
  echo "     curl -fsSL https://claude.ai/install.sh | bash"
  echo "   설치 후 다시 더블클릭."
  read -n 1; exit 1
fi

# --- 2. claude login 상태 확인 ---
echo ""
echo "──── [2/5] claude login 인증 확인 ────"
# claude --version 다음 단순 query 로 인증 검증
echo "  (인증 상태 검증 시도 — 미인증이면 'claude login' 실행 안내)"
if claude -p "test" --print 2>&1 | grep -qE "(login|unauthorized|authenticate)"; then
  echo "❌ claude 미인증."
  echo "   터미널에서 'claude login' 실행 후 브라우저 OAuth 완료 후 다시 더블클릭."
  read -n 1; exit 1
else
  echo "✓ claude 인증 확인 (또는 첫 query 작동)"
fi

# --- 3. GitHub PAT 확인 ---
echo ""
echo "──── [3/5] GitHub PAT 확인 ────"
GH_KC="orchestrator-github-token"
existing_gh=$(security find-generic-password -a "$USER" -s "$GH_KC" -w 2>/dev/null)
if [ -n "$existing_gh" ]; then
  echo "✓ Keychain GitHub PAT 발견"
else
  echo "  GitHub PAT 발급 + 입력:"
  echo "  https://github.com/settings/personal-access-tokens/new"
  echo "  Fine-grained · dmj-site only · Issues r/w + Contents r/w · 90d"
  echo ""
  printf "  GitHub PAT 입력 (화면 표시 X): "
  read -rs GH_TOKEN; echo
  [ -z "$GH_TOKEN" ] && { echo "❌ 빈 값. 중단."; exit 1; }
  security delete-generic-password -a "$USER" -s "$GH_KC" 2>/dev/null
  security add-generic-password -a "$USER" -s "$GH_KC" -w "$GH_TOKEN" && echo "✓ Keychain 저장"
fi

# --- 4. .env 활성화 ---
echo ""
echo "──── [4/5] .env activation ────"
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)" 2>/dev/null

set_env_flag() {
  if grep -qE "^$1=" "$ENV_FILE"; then
    sed -i.tmp "s|^$1=.*|$1=$2|" "$ENV_FILE"
    rm -f "${ENV_FILE}.tmp"
  else
    echo "$1=$2" >> "$ENV_FILE"
  fi
  echo "  ✓ $1=$2"
}

set_env_flag "ENABLE_STATE_PROJECTION" "true"
set_env_flag "ENABLE_DIRECTIVE_LOOP" "true"
# ANTHROPIC_API_KEY 명시 X (CLI 인증 상속)
grep -qE "^GITHUB_REPO=" "$ENV_FILE" || set_env_flag "GITHUB_REPO" "D990905/dmj-site"

chmod 600 "$ENV_FILE"

# --- 5. daemon 재시작 ---
echo ""
echo "──── [5/5] daemon 재시작 + 검증 ────"
if [ -f "$LAUNCHAGENT" ]; then
  launchctl unload "$LAUNCHAGENT" 2>/dev/null
  sleep 1
  launchctl load "$LAUNCHAGENT" 2>/dev/null && echo "✓ daemon 재시작"
fi

sleep 5
PID=$(launchctl list 2>/dev/null | grep com.dmj.orchestrator | awk '{print $1}')
echo "  PID: ${PID:-not-found}"

echo ""
echo "──── 첫 directive dispatch 시도 로그 (60초 안 확인) ────"
echo "  tail -f $LOG_DIR/orchestrator.log"
echo "  성공 신호: 'dispatch_done' event in log"
echo "  실패 신호: 'CLINotFoundError' / 'unauthorized' / 'AnthropicError'"
echo ""
echo "════════════════════════════════════════════════════════"
echo "β path 시도 완료. 60초 후 첫 dispatch 결과로 작동/미작동 판정."
echo "  • 작동 → ③ persona 자동 응답 활성, control loop 완성"
echo "  • 미작동 → γ fallback (6/15 SDK 크레딧 대기)"
echo "════════════════════════════════════════════════════════"
read -n 1 -p "Press any key to close..."
