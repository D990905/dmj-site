# 로그인 설정 런북 (§527-528, 2026-09-04)

옥대표 요청: "로그인 기능을 넣자. 그래야 데이터가 보존되지.
카카오톡 구글 네이버 애플 로그인 또는 커스텀 로그인으로"

**코드는 다 됐습니다. 남은 건 계정 설정 세 가지이고, 그건 옥대표님만 할 수
있습니다.** 아래 순서대로 하시면 됩니다.

---

## 0. 먼저 — Supabase 프로젝트가 잠들어 있습니다 🔴

지금 `uzwennkeoeihqyvnxech.supabase.co` 가 **DNS 부터 사라진 상태**(NXDOMAIN)
입니다. 무료티어는 **7일 무활동이면 프로젝트를 재웁니다**(§425 때와 같은 일).

로그인이 안 되는 진짜 이유가 이것입니다. 코드를 아무리 붙여도 서버가 자면
못 합니다.

**할 일**: supabase.com 대시보드 → 해당 프로젝트 → **Restore / Resume**
(보통 프로젝트 열면 큰 버튼으로 뜹니다). 몇 분 걸립니다.

### 재발 방지 (중요)

`.github/workflows/supabase-keepalive.yml` 을 만들어 뒀는데 **push 가 막힙니다** —
지금 토큰에 `workflow` 권한이 없습니다. 둘 중 하나 해주세요.

- **(쉬움)** GitHub 웹 → repo → Add file → Create new file →
  경로에 `.github/workflows/supabase-keepalive.yml` → 로컬 파일 내용 붙여넣기 → commit
- **(근본)** GitHub Settings → Developer settings → PAT → `workflow` 스코프 추가

이걸 안 하면 **일주일 안 쓰면 또 잠듭니다.**

---

## 1. 각 제공자 개발자 콘솔에 앱 등록

Supabase 콜백 주소는 넷 다 같습니다:

```
https://uzwennkeoeihqyvnxech.supabase.co/auth/v1/callback
```

| 제공자 | 콘솔 | 받아올 것 | 비용·조건 |
|---|---|---|---|
| **카카오** | developers.kakao.com | REST API 키 · Client Secret | 무료. 이메일 받으려면 비즈 인증 필요(없으면 닉네임만) |
| **Google** | console.cloud.google.com → OAuth 동의 화면 + 사용자 인증 정보 | 클라이언트 ID · 보안 비밀 | 무료 |
| **Apple** | developer.apple.com | Services ID · Team ID · Key ID · .p8 키 | **유료 멤버십 연 $99 필요** |
| **네이버** | developers.naver.com | Client ID · Secret | 무료. 단 아래 ⚠ |

각 콘솔의 **Redirect URI / 콜백 URL** 칸에 위 주소를 꼭 넣으셔야 합니다.
이게 빠지면 제공자가 로그인을 거부합니다.

### ⚠ 네이버는 사정이 다릅니다

**Supabase 기본 제공자 목록에 네이버가 없습니다.** 카카오는 있는데 네이버는
없어요. 그래서 셋 중 하나가 필요합니다.

1. **커스텀 OIDC 제공자로 등록** — Supabase 최신 프로젝트에서 지원. 대시보드
   Authentication → Providers 에 "Custom OIDC" 가 보이면 그걸로 됩니다.
2. **Edge Function 으로 직접 처리** — 네이버 OAuth 를 받아서 Supabase 세션을
   발급. 제일 확실하지만 함수를 하나 써야 합니다.
3. **일단 빼기** — 카카오가 국내 커버리지를 대부분 가져갑니다.

화면에서는 네이버 버튼을 눌러도 **"아직 켜져 있지 않습니다" 라고 말하도록**
해놨습니다. 되는 척하지 않습니다.

---

## 2. Supabase 대시보드에서 켜기

Authentication → **Providers** → 제공자별로 토글 켜고 위에서 받은
Client ID / Secret 붙여넣기 → Save.

Authentication → **URL Configuration**:
- Site URL: `https://dmjgroup.kr`
- Redirect URLs 에 추가:
  - `https://dmjgroup.kr/**`
  - `http://127.0.0.1:8899/**` (로컬 테스트용, 원하시면)

---

## 3. 확인

1. `https://dmjgroup.kr/login.html` 에서 각 버튼을 눌러 봅니다.
2. 안 켜진 제공자는 **"○○ 로그인이 아직 켜져 있지 않습니다"** 가 뜹니다 —
   그러면 1·2 번 중 뭔가 빠진 겁니다.
3. 켜진 제공자는 그 회사 로그인 화면으로 넘어갔다가 돌아옵니다.
4. 라이딩 대시보드(`/riding-dashboard/v2.html`) 우측 상단 칩이
   **"this browser only" → 이름/이메일** 로 바뀌면 성공입니다.

---

## 코드 쪽에서 이미 된 것

- `assets/js/supabase-auth.js`
  - `signInWithProvider('kakao'|'google'|'apple'|'naver')`
  - `backendHealth()` — 잠든 프로젝트를 6초 타임아웃으로 감지
  - 안 켜진 제공자는 `provider_not_enabled` 로 **이유를 말한다**
- `login.html` · `signup.html` — 버튼 4개, 실패 사유 표시
- `riding-dashboard/v2.html` — 우측 상단 계정 칩
  - 로그인함 → 이름 + sign out
  - 안 함 → "this browser only" + sign in
  - 백엔드 죽음 → **"sign-in unavailable"** + 왜인지 툴팁
- `riding-dashboard/js/storage.js` — 네임스페이스 사일로 합치기
  - v2 는 `rd_*`, 구 대시보드 비로그인은 `rd_anon_*` 로 갈려 있었다.
    로그인을 붙이면 v2 데이터가 **화면에서 사라질** 참이었다.
  - bare→anon(비로그인), bare+anon→uid(로그인). 복사→검증→원본제거,
    **대상에 이미 있으면 안 덮음**. selftest-527 23/23.

## 아직 안 한 것

- **클라우드 동기화 자체**(C2). 로그인이 되면 기록이 계정에 묶이지만,
  세션 데이터를 서버로 올리는 건 §415 스키마를 다시 붙여야 합니다.
  지금은 로그인해도 **기기별 로컬 저장**입니다 — 칩이 그렇게 말합니다.
- 삭제 sync (§415 부터 남아 있던 갭)
