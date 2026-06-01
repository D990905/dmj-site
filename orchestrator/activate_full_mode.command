#!/bin/bash
# activate_full_mode.command v0.2 — install_daemon 자동 호출 추가 (의장 부하 ↓)
# (v0.1 → v0.2: .env 미존재 시 install_daemon.command 자동 invoke)
#
# 흐름:
#   0. install_daemon.command 가 이미 실행됐는지 사전 체크
#   1. Anthropic API key 입력 (이미 있으면 skip 또는 갱신 선택)
#   2. GitHub Personal Access Token 입력 (동일)
#   3. ~/.config/orchestrator/.env 에 ENABLE_STATE_PROJECTION=true + ENABLE_DIRECTIVE_LOOP=true append/update
#   4. daemon 재시작 (launchctl unload + load)
#   5. 검증 — PID 확인 + 첫 로그 표시 + heartbeat 확인
#
# 보안: API key 는 stdin 으로 입력 (화면 표시 X), macOS Keychain 저장.
# .env 는 영구 gitignored, repo 와 무관.

set -u

# ─── 0. 사전 체크 ────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════"
echo "Orchestrator Daemon — Full Mode Activation v0.1"
echo "════════════════════════════════════════════════════════"
echo "Sent: $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')"
echo ""

ENV_FILE="$HOME/.config/orchestrator/.env"
LAUNCHAGENT="$HOME/Library/LaunchAgents/com.dmj.orchestrator.plist"
LOG_DIR="$HOME/Library/Logs/Orchestrator"

if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  install_daemon.command 가 아직 실행 안 됨 ($ENV_FILE 없음)."
  echo "   자동으로 install_daemon.command 호출합니다..."
  echo ""
  INSTALL_SCRIPT="$(cd "$(dirname "$0")" && pwd)/install_daemon.command"
  if [ ! -x "$INSTALL_SCRIPT" ]; then
    echo "❌ $INSTALL_SCRIPT 없음 또는 실행 권한 X."
    echo "   ls -la site/orchestrator/install_daemon.command 확인."
    read -n 1; exit 1
  fi
  echo "──── install_daemon.command 실행 시작 ────"
  # install 의 stdin = terminal — read prompt 들 정상 처리
  bash "$INSTALL_SCRIPT" < /dev/tty
  INSTALL_RC=$?
  echo "──── install_daemon.command 종료 (rc=$INSTALL_RC) ────"
  echo ""
  if [ ! -f "$ENV_FILE" ]; then
    echo "❌ install 했지만 $ENV_FILE 생성 안 됨."
    echo "   install_daemon.command 출력 확인 — Python 3.9+ 없거나 다른 에러."
    read -n 1; exit 1
  fi
  echo "✓ install 완료. activate 계속 진행."
  echo ""
fi
echo "✓ install_daemon.command 실행 흔적 발견: $ENV_FILE"

if [ ! -f "$LAUNCHAGENT" ]; then
  echo "⚠️  launchd plist 미발견. install_daemon.command 가 plist 설치 단계까지 못 갔을 수도."
  echo "   재실행 권장. 그래도 진행하시면 daemon 재시작 step 만 skip 됩니다."
fi

# ─── lockfile (동시 실행 방지) ──────────────────────────────────
LOCKFILE="/tmp/orchestrator-activate.lock"
if [ -f "$LOCKFILE" ] && kill -0 "$(cat "$LOCKFILE" 2>/dev/null)" 2>/dev/null; then
  echo "❌ 이미 실행 중 (pid $(cat "$LOCKFILE"))"; read -n 1; exit 1
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# ─── 1. Anthropic API key ────────────────────────────────────────
echo ""
echo "──── [1/5] Anthropic API key ────"

ANTHROPIC_KC_NAME="orchestrator-anthropic-api-key"
existing_anthropic=$(security find-generic-password -a "$USER" -s "$ANTHROPIC_KC_NAME" -w 2>/dev/null)

if [ -n "$existing_anthropic" ]; then
  echo "✓ Keychain 에 Anthropic API key 기존 entry 발견 (sk-ant-${existing_anthropic:7:6}...)"
  read -r -p "  갱신하시겠습니까? [y/N] " yn
  case "$yn" in
    [yY])  GET_ANTHROPIC=1 ;;
    *)     GET_ANTHROPIC=0 ;;
  esac
else
  echo "  Keychain 에 entry 없음. 발급 후 입력 필요."
  echo "  발급 URL: https://console.anthropic.com/settings/keys"
  echo "  (월 \$50 cap 콘솔에서 별도 설정 강력 권장 — 이중 안전망)"
  GET_ANTHROPIC=1
fi

if [ "$GET_ANTHROPIC" = "1" ]; then
  echo ""
  echo "  ⌨️  Anthropic API key 입력 (sk-ant-... 로 시작, 화면 표시 X):"
  printf "     > "
  read -rs ANTHROPIC_KEY
  echo ""
  if [ -z "$ANTHROPIC_KEY" ]; then
    echo "❌ 빈 값. 중단."; read -n 1; exit 1
  fi
  if ! echo "$ANTHROPIC_KEY" | head -c 7 | grep -q "^sk-ant-"; then
    echo "⚠️  'sk-ant-' 로 시작 안 함. 잘못된 키 의심. 계속하시겠습니까? [y/N]"
    read -r yn
    case "$yn" in [yY]) ;; *) echo "중단."; read -n 1; exit 1 ;; esac
  fi
  # 기존 entry 삭제 후 신규 저장
  security delete-generic-password -a "$USER" -s "$ANTHROPIC_KC_NAME" 2>/dev/null
  if security add-generic-password -a "$USER" -s "$ANTHROPIC_KC_NAME" -w "$ANTHROPIC_KEY" 2>/dev/null; then
    echo "✓ Keychain 저장 완료."
  else
    echo "❌ Keychain 저장 실패."; read -n 1; exit 1
  fi
fi

# ─── 2. GitHub Personal Access Token ─────────────────────────────
echo ""
echo "──── [2/5] GitHub Personal Access Token ────"

GITHUB_KC_NAME="orchestrator-github-token"
existing_gh=$(security find-generic-password -a "$USER" -s "$GITHUB_KC_NAME" -w 2>/dev/null)

if [ -n "$existing_gh" ]; then
  echo "✓ Keychain 에 GitHub PAT 기존 entry 발견 (${existing_gh:0:11}...)"
  read -r -p "  갱신하시겠습니까? [y/N] " yn
  case "$yn" in
    [yY])  GET_GH=1 ;;
    *)     GET_GH=0 ;;
  esac
else
  echo "  Keychain 에 entry 없음. 발급 후 입력 필요."
  echo "  발급 URL: https://github.com/settings/personal-access-tokens/new"
  echo "  Fine-grained, dmj-site repo only, Issues r/w + Contents r/w, 90일 expiration"
  GET_GH=1
fi

if [ "$GET_GH" = "1" ]; then
  echo ""
  echo "  ⌨️  GitHub PAT 입력 (github_pat_... 로 시작, 화면 표시 X):"
  printf "     > "
  read -rs GH_TOKEN
  echo ""
  if [ -z "$GH_TOKEN" ]; then
    echo "❌ 빈 값. 중단."; read -n 1; exit 1
  fi
  if ! echo "$GH_TOKEN" | head -c 11 | grep -qE "^(github_pat_|ghp_|gho_|ghs_)"; then
    echo "⚠️  GitHub PAT 형식 안 맞음 (github_pat_/ghp_/...). 계속하시겠습니까? [y/N]"
    read -r yn
    case "$yn" in [yY]) ;; *) echo "중단."; read -n 1; exit 1 ;; esac
  fi
  security delete-generic-password -a "$USER" -s "$GITHUB_KC_NAME" 2>/dev/null
  if security add-generic-password -a "$USER" -s "$GITHUB_KC_NAME" -w "$GH_TOKEN" 2>/dev/null; then
    echo "✓ Keychain 저장 완료."
  else
    echo "❌ Keychain 저장 실패."; read -n 1; exit 1
  fi
fi

# ─── 3. .env update ──────────────────────────────────────────────
echo ""
echo "──── [3/5] .env 활성화 flag update ────"

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)" 2>/dev/null

set_env_flag() {
  local key="$1"; local val="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # macOS sed -i 는 .ext arg 필요
    sed -i.tmp "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.tmp"
    echo "  ✓ ${key}=${val} (update)"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
    echo "  ✓ ${key}=${val} (append)"
  fi
}

set_env_flag "ENABLE_STATE_PROJECTION" "true"
set_env_flag "ENABLE_DIRECTIVE_LOOP" "true"

# GITHUB_REPO 가 있는지 확인 (없으면 default D990905/dmj-site append)
if ! grep -qE "^GITHUB_REPO=" "$ENV_FILE"; then
  set_env_flag "GITHUB_REPO" "D990905/dmj-site"
fi

chmod 600 "$ENV_FILE"
echo "✓ .env 갱신 + 백업 보존 (${ENV_FILE}.bak.*)"

# ─── 4. daemon 재시작 ────────────────────────────────────────────
echo ""
echo "──── [4/5] daemon 재시작 ────"

if [ -f "$LAUNCHAGENT" ]; then
  launchctl unload "$LAUNCHAGENT" 2>/dev/null
  sleep 1
  if launchctl load "$LAUNCHAGENT" 2>/dev/null; then
    echo "✓ launchctl unload + load 완료."
  else
    echo "⚠️  launchctl load 실패. plist 경로 확인:"
    echo "    $LAUNCHAGENT"
  fi
else
  echo "⚠️  plist 없음 — daemon 재시작 skip. install_daemon.command 재실행 필요."
fi

# ─── 5. 검증 ─────────────────────────────────────────────────────
echo ""
echo "──── [5/5] 검증 ────"
sleep 5

PID=$(launchctl list 2>/dev/null | grep com.dmj.orchestrator | awk '{print $1}')
if [ -n "$PID" ] && [ "$PID" != "-" ]; then
  echo "✓ daemon PID: $PID — 실행 중"
else
  echo "⚠️  daemon PID 미확인 (아직 시작 중일 수도)"
  echo "    잠시 후: launchctl list | grep com.dmj.orchestrator"
fi

echo ""
echo "──── 최근 로그 ────"
if [ -f "$LOG_DIR/orchestrator.log" ]; then
  tail -10 "$LOG_DIR/orchestrator.log" | sed 's/^/  /'
else
  echo "  (로그 파일 미생성 — 30초 내 첫 polling cycle 시 생성)"
fi

echo ""
echo "──── 하트비트 ────"
HB_FILE="$HOME/dev/orchestrator-workspace/.orchestrator/heartbeat.json"
if [ -f "$HB_FILE" ]; then
  echo "  $(cat "$HB_FILE")"
else
  echo "  (heartbeat 미생성 — 60초 후 자동 생성)"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Full mode 활성화 완료 — $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S KST')"
echo "════════════════════════════════════════════════════════"
echo ""
echo "다음 30초:"
echo "  • daemon 이 GitHub Issues 첫 polling 시작"
echo "  • dashboard-state.json 첫 빌드 + commit + push"
echo "  • dashboard 가 ~30-60초 후 사이트 갱신 반영"
echo ""
echo "운영 명령:"
echo "  실시간 로그:    tail -f $LOG_DIR/orchestrator.log"
echo "  비용 확인:      cat ~/.config/orchestrator/usage.json"
echo "  하트비트:        cat $HB_FILE"
echo "  daemon 중지:    launchctl unload $LAUNCHAGENT"
echo "  daemon 시작:    launchctl load   $LAUNCHAGENT"
echo ""
read -n 1 -p "Press any key to close..."
