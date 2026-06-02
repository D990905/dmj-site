#!/bin/bash
# activate_state_only.command v0.1 — CoS 명령 #2 (2026-06-02 13:01 KST)
# #9 12:32 spec 요청 처리: state projection only mode, Anthropic key 매몰 회피.
#
# 활성화되는 것:
#   - ENABLE_STATE_PROJECTION=true → state_projection_loop 활성
#   - GitHub PAT (orchestrator-github-token) Keychain 등록
#   - daemon 재시작 → 첫 polling cycle 안에 dashboard-state.json 생성·push
#   - PWA dashboard (admin/dashboard/) 의 sample fixture → 실데이터 hot-swap
#
# 활성화 X:
#   - ENABLE_DIRECTIVE_LOOP (Anthropic key 필요) — 6/15 Claude Max credit 시점 또는 별도 결정 시
#   - 비용 = 거의 0 (Anthropic API X, GitHub Issues 폴링만)

set -u

# --- repo root ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$SCRIPT_DIR/src" ]; then ORCH="$SCRIPT_DIR"
elif [ -d "$SCRIPT_DIR/orchestrator/src" ]; then ORCH="$SCRIPT_DIR/orchestrator"
else echo "ERROR: orchestrator/src 못 찾음"; read -n 1; exit 1; fi

echo "════════════════════════════════════════════════════════"
echo "Orchestrator — State Projection Only Activation v0.1"
echo "════════════════════════════════════════════════════════"
echo "Sent: $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')"
echo ""

ENV_FILE="$HOME/.config/orchestrator/.env"
LAUNCHAGENT="$HOME/Library/LaunchAgents/com.dmj.orchestrator.plist"
LOG_DIR="$HOME/Library/Logs/Orchestrator"

# --- 사전 체크 ---
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE 없음 — install_daemon.command 먼저 더블클릭."
  read -n 1; exit 1
fi
echo "✓ install_daemon.command 실행 흔적 발견."

# --- lockfile ---
LOCKFILE="/tmp/orchestrator-activate-state.lock"
if [ -f "$LOCKFILE" ] && kill -0 "$(cat "$LOCKFILE" 2>/dev/null)" 2>/dev/null; then
  echo "❌ 이미 실행 중 (pid $(cat "$LOCKFILE"))"; read -n 1; exit 1
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# --- 1. GitHub PAT 등록 ---
echo ""
echo "──── [1/4] GitHub Personal Access Token ────"

GH_KC="orchestrator-github-token"
existing_gh=$(security find-generic-password -a "$USER" -s "$GH_KC" -w 2>/dev/null)

if [ -n "$existing_gh" ]; then
  echo "✓ Keychain 기존 entry 발견 (${existing_gh:0:11}...)"
  read -r -p "  갱신하시겠습니까? [y/N] " yn
  case "$yn" in [yY]) GET_GH=1 ;; *) GET_GH=0 ;; esac
else
  echo "  Keychain entry 없음. 발급 후 입력 필요."
  echo "  발급 URL: https://github.com/settings/personal-access-tokens/new"
  echo "  • Fine-grained Personal access token"
  echo "  • Resource owner: D990905"
  echo "  • Repository access: Only select → dmj-site"
  echo "  • Permissions:"
  echo "      - Issues: Read and write"
  echo "      - Contents: Read and write"
  echo "  • Expiration: 90 days"
  GET_GH=1
fi

if [ "$GET_GH" = "1" ]; then
  echo ""
  echo "  ⌨️  GitHub PAT 입력 (github_pat_... · ghp_... 로 시작 · 화면 표시 X):"
  printf "     > "
  read -rs GH_TOKEN
  echo ""
  if [ -z "$GH_TOKEN" ]; then echo "❌ 빈 값. 중단."; exit 1; fi
  if ! echo "$GH_TOKEN" | head -c 11 | grep -qE "^(github_pat_|ghp_|gho_|ghs_)"; then
    echo "⚠️  GitHub PAT 형식 안 맞음. 계속하시겠습니까? [y/N]"
    read -r yn; case "$yn" in [yY]) ;; *) exit 1 ;; esac
  fi
  security delete-generic-password -a "$USER" -s "$GH_KC" 2>/dev/null
  if security add-generic-password -a "$USER" -s "$GH_KC" -w "$GH_TOKEN" 2>/dev/null; then
    echo "✓ Keychain 저장 완료."
  else
    echo "❌ Keychain 저장 실패."; exit 1
  fi
fi

# --- 2. .env 활성화 flag ---
echo ""
echo "──── [2/4] .env activation ────"

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)" 2>/dev/null

set_env_flag() {
  local key="$1"; local val="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.tmp "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.tmp"
    echo "  ✓ ${key}=${val} (update)"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
    echo "  ✓ ${key}=${val} (append)"
  fi
}

set_env_flag "ENABLE_STATE_PROJECTION" "true"
# ENABLE_DIRECTIVE_LOOP 는 활성 안 함 (state-only mode)
# 기존 값 false 그대로 두기

if ! grep -qE "^GITHUB_REPO=" "$ENV_FILE"; then
  set_env_flag "GITHUB_REPO" "D990905/dmj-site"
fi
if ! grep -qE "^STATE_PUBLISH_PATH=" "$ENV_FILE"; then
  set_env_flag "STATE_PUBLISH_PATH" "admin/dashboard/dashboard-state.json"
fi

chmod 600 "$ENV_FILE"
echo "✓ .env 갱신 + 백업 보존"

# --- 3. daemon 재시작 ---
echo ""
echo "──── [3/4] daemon 재시작 ────"

if [ -f "$LAUNCHAGENT" ]; then
  launchctl unload "$LAUNCHAGENT" 2>/dev/null
  sleep 1
  if launchctl load "$LAUNCHAGENT" 2>/dev/null; then
    echo "✓ launchctl unload + load 완료."
  else
    echo "⚠️  launchctl load 실패. plist 경로 확인 필요."
  fi
else
  echo "⚠️  plist 없음 — daemon 재시작 skip. install_daemon.command 재실행 필요."
fi

# --- 4. 검증 ---
echo ""
echo "──── [4/4] 검증 ────"
sleep 5

PID=$(launchctl list 2>/dev/null | grep com.dmj.orchestrator | awk '{print $1}')
if [ -n "$PID" ] && [ "$PID" != "-" ]; then
  echo "✓ daemon PID: $PID — 실행 중"
else
  echo "⚠️  daemon PID 미확인 (아직 시작 중일 수도)"
fi

echo ""
echo "──── 최근 로그 (state_projection event 확인) ────"
if [ -f "$LOG_DIR/orchestrator.log" ]; then
  tail -15 "$LOG_DIR/orchestrator.log" | sed 's/^/  /'
else
  echo "  (로그 파일 미생성 — 30초 내 첫 polling cycle 시 생성)"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ State Projection 활성화 완료"
echo "════════════════════════════════════════════════════════"
echo ""
echo "다음 30-60초:"
echo "  • daemon 이 GitHub Issues + messages.md 폴링 시작 (매 30s)"
echo "  • dashboard-state.json 첫 빌드 + commit + push"
echo "  • PWA dashboard 의 mock fixture → 실데이터 hot-swap"
echo ""
echo "확인:"
echo "  실시간 로그:    tail -f $LOG_DIR/orchestrator.log"
echo "  상태:            cat $HOME/dev/orchestrator-workspace/.orchestrator/heartbeat.json"
echo "  PWA dashboard:  https://dmjgroup.kr/admin/dashboard/"
echo ""
echo "ENABLE_DIRECTIVE_LOOP 은 X (Anthropic key 매몰 회피)."
echo "directive 자동 dispatch 는 6/15 Claude Max SDK 크레딧 시점 또는 별도 결정 시 활성."
echo ""
read -n 1 -p "Press any key to close..."
