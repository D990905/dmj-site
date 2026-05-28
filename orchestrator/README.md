# Orchestrator Daemon — Phase 1 Prototype

**Phase 1 production 변경 X.** 이 폴더는 spec + prototype 만. 실제 배포는 별도 install location (`~/dev/orchestrator/`) 권장.

## 무엇을 해결하나

| 현재 | After |
|---|---|
| 변경 → PUSH-FIX.command 더블클릭 → iCloud lock 충돌 시 수동 retry | 변경 → 자동 감지 → iCloud-aware retry → push |
| Dashboard directive → Danny 가 수동 dispatch → 결과 수동 보고 | Dashboard → daemon picks up → agent dispatch → 자동 status |
| 수동 commit 메시지 매번 작성 | 변경 요약 + 타임스탬프 자동 |

## 즉시 효과 1순위 — `auto_push.command`

기존 `PUSH-FIX.command` 의 진화. 더블클릭 1회로 동작.

**개선점 vs 기존**:
- iCloud lock 종류별 정확한 감지 (`EWOULDBLOCK`, `EBUSY`, "Resource deadlock avoided")
- `.icloud` placeholder 강제 다운로드 (`brctl download`)
- `.git/index.lock` 뿐 아니라 `.git/HEAD.lock`, `.git/refs/heads/*.lock` 정리
- 동시 실행 방지 lockfile (`/tmp/orchestrator-push.lock`)
- Non-fast-forward push 실패 시 `git pull --rebase` 자동 fallback
- HEAD 무결성 사전 체크 (현재 site/ 가 겪고 있는 broken HEAD 진단)
- Commit 메시지 = 변경 요약 자동 생성 (수동 입력 불필요)

[`auto_push.command`](auto_push.command) — 더블클릭 또는 터미널에서 `./auto_push.command`

## 폴더 구조

```
orchestrator/
├── README.md                 ← 이 파일
├── auto_push.command         ← PUSH-FIX 진화 버전 (즉시 사용)
├── src/                      ← 풀 daemon (Python, Phase 1 후반 적용)
│   ├── __main__.py
│   ├── daemon.py             ← asyncio loop 3개
│   ├── config.py             ← Keychain → .env → env
│   ├── queue.py              ← GitHubIssuesQueue
│   ├── status.py             ← Status + GitCommitSink
│   ├── dispatcher.py         ← Claude Agent SDK 래퍼
│   ├── git_deploy.py         ← iCloud-aware auto-deploy 코어
│   ├── icloud.py             ← iCloud placeholder + lock 처리 utilities
│   ├── cost.py
│   ├── notify.py
│   └── log.py
├── launchd/
│   ├── com.sailtech.orchestrator.plist
│   └── install.sh
├── docs/
│   └── SETUP.md
├── tests/
│   └── test_dry_run.py
├── requirements.txt
└── .env.example
```

## 사용 단계

| 시점 | 행동 |
|---|---|
| 지금 (1분) | `./auto_push.command` 더블클릭 — PUSH-FIX 대체, 매번 사용 |
| 셋업 후 (15분) | `docs/SETUP.md` 따라 launchd daemon 설치 — push 자동화 |
| 그 다음 | GitHub Issue 만들면 자동 dispatch — 진정한 orchestration |

## 설계 ADR

`../  _experts/expert_orchestrator_daemon_reference.md` — Python vs Node, 보안, 비용, Phase 2 마이그 경로 등 결정 근거 전체.
