# Phase 12 — Supabase Setup Runbook (옥대표님용)

**작성일:** 2026-06-10
**소요:** 약 10–20분
**전제 정정:** Supabase 프로젝트는 **이미 존재**합니다 (`https://uzwennkeoeihqyvnxech.supabase.co`). 따라서 본 runbook 은 *"새 프로젝트 만들기"* 가 아니라 **(A) 기존 프로젝트 접근 권한 확인 → (B) 0004 SQL 적용 → (C) Storage 버킷 생성** 입니다. 자세한 배경은 `phase12_supabase_backend_spec.md` §0 참조.

---

## ⚠️ 먼저 — anon 키는 이미 공유돼 있습니다

dispatch 는 "옥대표님이 anon key 를 chat 으로 paste 부탁" 이라고 했지만, **그럴 필요 없습니다.** 클라이언트가 쓰는 publishable(=anon) 키는 이미 `assets/js/supabase-auth.js` 에 들어 있고 (publishable 키는 공개 안전), git 에도 이미 있습니다. **service_role 키는 절대 chat·git 에 올리지 마세요 — Day 1 기준 우리는 service_role 을 전혀 쓰지 않습니다.**

옥대표님께 실제로 필요한 단 하나의 액션 = **§A 의 프로젝트 접근 확인** 입니다.

---

## A. 🔴 [최우선] 기존 프로젝트 접근 권한 확인

> 이게 본 sprint 의 진짜 blocker 입니다. 아래 SQL·버킷 작업은 모두 이 프로젝트 Dashboard 접근이 있어야 가능합니다.

1. 브라우저에서 https://supabase.com/dashboard 접속 → 로그인.
   - 옥대표님이 이 프로젝트를 만들 때 쓴 계정(GitHub 또는 이메일)으로 로그인.
2. 프로젝트 목록에 **`uzwennkeoeihqyvnxech`** (또는 단무지/dmj 관련 이름) 이 보이는지 확인.
3. **결과를 chat 으로 1줄 알려주세요:**
   - ✅ **"보임 + 접근됨"** → §B 로 진행.
   - ❌ **"안 보임 / 로그인 계정 모름 / 접근 불가"** → 멈추고 알려주세요. 이 경우 선택지:
     - (a) 프로젝트를 만든 계정 복구 (이메일/비번 또는 GitHub 찾기), 또는
     - (b) **신규 프로젝트 생성 + 기존 schema 0001–0004 재적용 + 클라이언트 URL/키 교체** (= 사실상 백엔드 이사. Day 2 에 별도 처리).

> 메모: 2026-05-25 계정·장비 소실 사건([[project_dmj_mypage_no_backend]])과 이 프로젝트가 연결돼 있을 수 있습니다. 만약 그 사건이 "이 Supabase 프로젝트 접근을 잃은 것"이라면 (b) 경로가 됩니다. 일단 §A 결과부터 확인 부탁드립니다.

---

## B. 0004 SQL migration 적용

> §A 가 ✅ 인 경우에만 진행.

1. Dashboard → 좌측 **SQL Editor** → **New query**.
2. 리포의 `supabase/migrations/0004_riding_sessions_storage.sql` 전체를 복사해 붙여넣기.
3. **Run** (Ctrl/Cmd+Enter).
4. 에러 없이 "Success" 나오면 완료. (0004 는 순수 additive — 기존 데이터 영향 없음.)

### B-1. (권장) gear 버그 확정 — 적용 *전* 1분 진단
0004 의 핵심 hotfix 가 정말 필요한지 확인하려면:
- Dashboard → **Logs** → **Postgres** (또는 **API/PostgREST** 로그) → 최근 로그에서
  `user_data_suffix_check` 또는 `violates check constraint` 검색.
- 이게 보이면 = 그동안 gear/profile_extra 가 서버 저장에 실패해 왔다는 확정 증거 (spec §2.1).
- 안 보여도 0004 적용은 무해하니 그대로 진행하세요.

---

## C. Storage 버킷 생성

> §B 에서 0004 전체를 실행하면 Storage 정책도 이미 만들어집니다 (정책은 버킷 존재와
> 무관하게 생성됨). 여기서는 **버킷 2개만** 만들면 됩니다. SQL 재실행 불필요
> (재실행하면 "policy already exists" 에러가 나므로 하지 마세요).

1. Dashboard → 좌측 **Storage** → **New bucket**.
2. 버킷 2개 생성 (둘 다 **Private** — Public 토글 OFF). 이름은 정확히:
   | 이름 | Public | 용도 |
   |---|---|---|
   | `tracks` | OFF | GPX 트랙 파일 |
   | `videos` | OFF | 라이딩 영상 |
   (이름이 0004 정책의 `bucket_id` 와 정확히 일치해야 RLS 가 작동합니다.)
3. (Day 5 전까지 선택) **Pro plan 결제** — 영상 용량 때문에 Free(1GB)로는 부족. spec §4.4 참조. Dashboard → Settings → Billing.

---

## D. 키 확인 위치 (참고용 — 액션 불필요)

| 키 | 위치 | 용도 | 노출 |
|---|---|---|---|
| Project URL | Settings → API → Project URL | 클라이언트 | 공개 안전 (이미 코드에 있음) |
| **publishable / anon** | Settings → API → Project API keys → `anon`/`publishable` | 클라이언트 | 공개 안전 (이미 코드에 있음) |
| **service_role** | Settings → API → `service_role` (`Reveal` 눌러야 보임) | **server-side 전용** | 🔴 **절대 chat·git·클라이언트 X** |

> service_role 키를 실수로 어디든 노출했다면 즉시 알려주세요 — Dashboard 에서 즉시 rotate(재발급) 합니다.

---

## E. 완료 체크리스트

- [ ] §A — 기존 프로젝트 `uzwennkeoeihqyvnxech` 접근 확인 → chat 1줄 회신
- [ ] §B — `0004_riding_sessions_storage.sql` 적용 (Success)
- [ ] §B-1 — (선택) gear CHECK 위반 로그 확인
- [ ] §C — `tracks`·`videos` 버킷 생성 (Private) + Storage 정책 Run
- [ ] §C-4 — (Day 5 전) Pro plan 결제 여부 결정
- [ ] → Day 2 sprint dispatch (gear hotfix 검증)

작업 막히면 어느 단계에서 멈췄는지 1줄만 주시면 이어서 도와드립니다.
