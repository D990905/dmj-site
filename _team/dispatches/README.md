# Dispatches — 진행 중 + archive

`site/_team/dispatches/` 폴더는 모든 dispatch 의 source-of-truth.

## 파일 명명 규칙

```
D-YYYY-MM-DD-NNN-<slug>-<owner-short>.md
```

- `YYYY-MM-DD` — dispatch 발신 일자
- `NNN` — 일자별 일련번호 (001, 002...)
- `slug` — task 의 짧은 영어 식별자
- `owner-short` — owner persona 단축 (rose / sam / timo / alex / may / ken / hiro / wang / david)

예시:
- `D-2026-05-31-001-focus-ring-spec-rose.md`
- `D-2026-05-31-002-focus-ring-impl-alex.md`
- `D-2026-05-31-003-focus-ring-tracking-david.md`

## status frontmatter

각 dispatch 상단에 YAML frontmatter:

```yaml
---
dispatch_id: D-2026-05-31-001
task: focus-ring-spec
owner: 로즈 윤 (Rose Yoon)
sender: 데이빗 옥 (proxy for Danny)
status: sent | accepted | in-progress | review | done | rejected
estimate: 2-4 hours
due: 2026-06-03 (Wed)
created: 2026-05-31
last_update: 2026-05-31
linked: [D-2026-05-31-002, D-2026-05-31-003]
---
```

## 운영
- 새 dispatch 발신 → 이 폴더에 신규 파일.
- status 변경 시 frontmatter 수정.
- `done` 상태가 되면 `dispatches/archive/YYYY-QQ/` 로 이동 (분기별).
- 데이빗 옥이 매주 금요일 closeout 에서 status 종합.

## 운영 트래커 (현재 진행 중)

| ID | task | owner | status | due |
|---|---|---|---|---|
| D-2026-05-31-001 | focus-ring-spec | 로즈 윤 | sent | 2026-06-03 |
| D-2026-05-31-002 | focus-ring-impl | 알렉스 박 | sent (blocked by 001) | 2026-06-05 |
| D-2026-05-31-003 | focus-ring-tracking | 데이빗 옥 | in-progress | 2026-06-05 |
