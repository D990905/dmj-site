# Orchestrator — Setup Guide

## 즉시 사용 — `auto_push.command` (0분 셋업)

```
site/orchestrator/auto_push.command  ← 더블클릭
```

기존 `PUSH-FIX.command` 자리에 그대로 대체 가능. 별도 셋업 필요 없음. **지금 바로 한 번 돌려보고 push 동작 확인 권장.**

기존 PUSH-FIX 대비 새로 처리하는 케이스:
- iCloud 가 `.git/refs/heads/main` 을 아직 다운로드 안 한 상태 → `brctl download` 트리거 후 재시도
- 원격에 새 commit 이 있어 push 가 rejected → `pull --rebase` 후 자동 재push
- 동시 실행 (2개 더블클릭) → lockfile 로 차단
- Commit message 자동 생성 (변경 파일 + 타임스탬프)
- 로컬 ahead 인데 working tree 가 clean 인 경우도 push 함 (기존은 commit 없으면 push 안 함)

---

## Daemon mode — 매번 더블클릭도 귀찮을 때 (15분 셋업)

### 0. 사전 요구
```bash
python3 --version    # 3.10 이상
git --version
```

### 1. 코드 설치 — site/ 와 분리된 install location 권장
```bash
mkdir -p ~/dev
# orchestrator/ 폴더만 site/ 에서 복사해서 분리:
cp -r "/Users/dannyok/Documents/Claude/Projects/단무지공방 홈페이지 만들기/site/orchestrator" ~/dev/

cd ~/dev/orchestrator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> **왜 분리?** `~/dev/orchestrator/` 는 iCloud 동기화가 안 되는 경로. daemon 이 매분 자기 폴더에 로그/state 를 쓰는데, iCloud 와 충돌하면 본인이 만든 retry 로직이 자기를 retry 하는 코미디. **`orchestrator/` 폴더는 iCloud 밖으로.**

### 2. 설정 — `~/.config/orchestrator/.env`
```bash
mkdir -p ~/.config/orchestrator
cp ~/dev/orchestrator/.env.example ~/.config/orchestrator/.env
chmod 600 ~/.config/orchestrator/.env
```

`.env` 의 `AUTO_DEPLOY_REPOS` 만 확인하면 됨 (기본값이 site/ 절대경로로 들어있음). `ENABLE_DIRECTIVE_LOOP=false` 그대로 → API key 없이 deploy-only mode 로 시작.

### 3. launchd 설치 (Mac 부팅 시 자동 시작)
```bash
cd ~/dev/orchestrator/launchd
chmod +x install.sh
./install.sh
```

확인:
```bash
launchctl list | grep com.dmj.orchestrator
tail -f ~/Library/Logs/Orchestrator/orchestrator.log
```

이 시점에서 daemon 은 30초마다 site/ 폴더를 보고 변경이 있으면 자동 push.

### 4. Smoke test
```bash
cd "/Users/dannyok/Documents/Claude/Projects/단무지공방 홈페이지 만들기/site"
echo "test" > test_smoke.txt
git add test_smoke.txt   # 새 파일은 daemon 이 안 잡음 (untracked 는 의도적으로 무시)
# 30초 내 push 됨. log 에서 확인:
tail -5 ~/Library/Logs/Orchestrator/orchestrator.log
# 정리
git rm test_smoke.txt && rm -f test_smoke.txt
```

---

## Full mode 활성화 (Phase 1 후반, 선택)

Directive 폴링 + agent dispatch 까지 켜기:

1. https://console.anthropic.com → API key 발급, **콘솔에서 월 $50 cap 설정**
2. https://github.com/settings/personal-access-tokens/new → Fine-grained, dmj-site repo only, Issues r/w + Contents r/w
3. Keychain 에 저장 (`.env` 보다 안전):
   ```bash
   security add-generic-password -a "$USER" -s orchestrator-anthropic-api-key -w "sk-ant-..."
   security add-generic-password -a "$USER" -s orchestrator-github-token   -w "github_pat_..."
   ```
4. `.env` 에서 `ENABLE_DIRECTIVE_LOOP=true`
5. `launchctl unload ... && launchctl load ...` 로 daemon 재시작

---

## Troubleshooting

**`auto_push.command` 가 "HEAD broken" 으로 멈춤**
→ iCloud 가 `.git/refs/heads/main` 을 아직 안 내림. Finder 에서 site/.git 열어 cloud icon 사라질 때까지 기다린 뒤 재시도. 또는:
```bash
cd "site"; brctl download .git; sleep 5; ./orchestrator/auto_push.command
```

**daemon 로그에 "ModuleNotFoundError: claude_agent_sdk"**
→ `ENABLE_DIRECTIVE_LOOP=true` 인데 SDK 미설치. `cd ~/dev/orchestrator && source .venv/bin/activate && pip install -r requirements.txt`.

**launchctl list 에 PID 가 "-" (실패 상태)**
→ `cat ~/Library/Logs/Orchestrator/launchd.err.log` 첫 줄 확인. 대부분 plist 의 python 경로 오타. `which python` 결과를 plist 의 `ProgramArguments` 첫 항목에 넣기.

**비용이 예상보다 큼**
→ `cat ~/.config/orchestrator/usage.json`. 한 directive 가 $1.50 넘으면 prompt 가 너무 광범위. directive JSON 의 `max_budget_usd` 를 낮추거나 `max_turns` 줄이기.

---

## 운영 명령

| 목적 | 명령 |
|---|---|
| daemon 상태 | `launchctl list \| grep com.dmj.orchestrator` |
| 중지 | `launchctl unload ~/Library/LaunchAgents/com.dmj.orchestrator.plist` |
| 시작 | `launchctl load   ~/Library/LaunchAgents/com.dmj.orchestrator.plist` |
| 실시간 로그 | `tail -f ~/Library/Logs/Orchestrator/orchestrator.log` |
| 비용 | `cat ~/.config/orchestrator/usage.json` |
| 하트비트 | `cat ~/dev/orchestrator-workspace/.orchestrator/heartbeat.json` |
