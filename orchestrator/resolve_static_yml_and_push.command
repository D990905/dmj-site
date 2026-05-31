#!/bin/bash
# resolve_static_yml_and_push.command — 더블클릭 1회로 완료
#
# 시나리오: 로컬 commit + origin 의 .github/workflows/static.yml 추가 commit 이
# 갈라진 상태. 안전한 rebase 로 둘 다 보존하면서 origin 의 static.yml 채택.
#
# 안전 장치:
#   - force push 절대 X (--force / -f / +HEAD 어디에도 없음)
#   - static.yml 외의 충돌이 있으면 즉시 abort + 사용자 alert
#   - 매 단계 로그, 어디서 멈췄는지 명확
#   - HEAD broken / iCloud lock 자동 retry
#   - 동시 실행 차단

set -u

# --- repo root 찾기 ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "$SCRIPT_DIR/.git" ]; then REPO="$SCRIPT_DIR"
elif [ -d "$SCRIPT_DIR/../.git" ]; then REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
else echo "ERROR: .git 못 찾음"; read -n 1; exit 1; fi
cd "$REPO"
echo "==> Repo: $REPO"

# --- 동시 실행 방지 ---
LOCKFILE="/tmp/orchestrator-resolve-$(echo "$REPO" | md5 -q 2>/dev/null || echo X).lock"
if [ -f "$LOCKFILE" ] && kill -0 "$(cat "$LOCKFILE" 2>/dev/null)" 2>/dev/null; then
  echo "ERROR: 이미 실행 중 (pid $(cat "$LOCKFILE"))"; read -n 1; exit 1
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# --- iCloud 강제 다운로드 + lock 정리 ---
echo "==> iCloud .git download 트리거 (10초 대기)..."
if command -v brctl >/dev/null 2>&1; then
  brctl download .git 2>/dev/null || true
fi
sleep 10
echo "==> lock 정리..."
rm -f .git/index.lock .git/HEAD.lock .git/config.lock 2>/dev/null
find .git/refs -name '*.lock' -delete 2>/dev/null
find .git -maxdepth 1 -name '*.lock' -delete 2>/dev/null

# --- HEAD 무결성 ---
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "ERROR: HEAD 못 읽음. iCloud 가 .git/refs/heads/main 다운로드 안 끝남."
  echo "       Finder 에서 .git/refs/heads/ 열어서 cloud 아이콘 사라질 때까지 기다린 뒤 다시 더블클릭."
  read -n 1; exit 1
fi
LOCAL_BEFORE=$(git rev-parse --short HEAD)
echo "==> 로컬 HEAD: $LOCAL_BEFORE"

# --- 현재 rebase 진행 중인지 정리 (이전 실패 잔재) ---
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  echo "==> 이전 rebase 잔재 발견 — abort 후 깨끗한 상태로 시작..."
  git rebase --abort 2>/dev/null || true
fi

# --- working tree 가 dirty 면 stash ---
if [ -n "$(git status --porcelain)" ]; then
  echo "==> working tree 의 변경 임시 격리 (stash)..."
  git stash -u -m "auto-stash before resolve+push $(date -u +%FT%TZ)" || {
    echo "ERROR: stash 실패. 수동 정리 필요."; read -n 1; exit 1
  }
  STASHED=1
else
  STASHED=0
fi

# --- fetch origin ---
echo ""
echo "==> origin fetch..."
if ! git fetch origin main; then
  echo "ERROR: fetch 실패. 네트워크 확인."; read -n 1; exit 1
fi
ORIGIN_AFTER=$(git rev-parse --short origin/main)
echo "==> origin/main: $ORIGIN_AFTER"

# --- 사전 diff 보고 ---
LOCAL_ONLY=$(git log --oneline origin/main..HEAD | wc -l | tr -d ' ')
ORIGIN_ONLY=$(git log --oneline HEAD..origin/main | wc -l | tr -d ' ')
echo "==> 로컬에만: $LOCAL_ONLY commit, origin 에만: $ORIGIN_ONLY commit"

# --- pull --rebase ---
echo ""
echo "==> git pull --rebase origin main..."
if git pull --rebase origin main 2>&1 | tee /tmp/rebase.log; then
  echo "==> rebase 충돌 없이 끝남."
else
  # --- 충돌 발생 ---
  echo ""
  echo "==> rebase 충돌 감지. 분석 중..."

  # 충돌 파일 목록
  CONFLICTS=$(git diff --name-only --diff-filter=U)
  if [ -z "$CONFLICTS" ]; then
    echo "ERROR: rebase 가 실패했지만 충돌 파일 없음. 비정상 상태 — abort."
    git rebase --abort 2>/dev/null
    [ "$STASHED" = "1" ] && git stash pop 2>/dev/null
    read -n 1; exit 1
  fi
  echo "==> 충돌 파일:"
  echo "$CONFLICTS" | sed 's/^/    /'

  # static.yml 만 충돌이면 → origin 채택 (사전 합의)
  # 다른 파일이 끼어있으면 → abort + alert
  EXPECTED=".github/workflows/static.yml"
  OTHERS=$(echo "$CONFLICTS" | grep -v "^${EXPECTED}$" || true)

  if [ -n "$OTHERS" ]; then
    echo ""
    echo "ERROR: static.yml 외의 파일도 충돌 발생. 자동 처리 금지 — abort."
    echo "       추가 충돌:"; echo "$OTHERS" | sed 's/^/         /'
    git rebase --abort
    [ "$STASHED" = "1" ] && git stash pop 2>/dev/null
    echo "       Claude 에게 충돌 파일 목록 공유 후 권장안 받기."
    read -n 1; exit 1
  fi

  # static.yml 만 — origin 버전 채택
  # 주의: rebase 컨텍스트에서 --ours = base = origin/main, --theirs = replay 중인 로컬
  # → origin 버전 채택 = --ours
  echo "==> $EXPECTED — origin 버전 채택 (--ours)..."
  git checkout --ours -- "$EXPECTED" || {
    echo "ERROR: checkout --ours 실패"; git rebase --abort; read -n 1; exit 1
  }
  git add "$EXPECTED"

  echo "==> rebase --continue..."
  if ! git -c core.editor=true rebase --continue; then
    echo "ERROR: rebase --continue 실패. 추가 충돌 가능. 수동 처리 필요."
    git status; read -n 1; exit 1
  fi
fi

# --- push (force 절대 X) ---
echo ""
echo "==> git push origin main (force 없음)..."
if git push origin main 2>&1 | tee /tmp/push.log; then
  echo ""
  echo "==> push 성공!"
  git log --oneline -3
else
  PUSH_OUT=$(cat /tmp/push.log)
  case "$PUSH_OUT" in
    *"non-fast-forward"*|*"rejected"*)
      echo "ERROR: push 가 또 rejected. 누가 동시에 push 했을 수도. 다시 더블클릭하면 자동 재처리."
      ;;
    *)
      echo "ERROR: push 실패. 로그: $PUSH_OUT"
      ;;
  esac
  [ "$STASHED" = "1" ] && git stash pop 2>/dev/null
  read -n 1; exit 1
fi

# --- stash 복원 ---
if [ "$STASHED" = "1" ]; then
  echo ""
  echo "==> 격리했던 변경 복원 (stash pop)..."
  git stash pop 2>/dev/null || echo "    (충돌 없이 복원됨 또는 빈 stash)"
fi

echo ""
echo "==> 완료. GitHub Actions 빌드 시작됨 — 1–2분 후 사이트 갱신됨."
echo "    https://github.com/D990905/dmj-site/actions"
read -n 1 -p "Press any key..."
