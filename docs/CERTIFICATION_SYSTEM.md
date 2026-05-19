# 단무지 라이더 인증 System — 명세

**작성일**: 2026-05-05
**참조**: PHASE12_ARCHITECTURE.md, supabase/migrations/0001_initial.sql (`certifications` 테이블)
**철학**: 인증은 자랑이 아니라 **"내가 어디까지 왔는지 정직하게 측정한다"** 이다. 재미·동기·안전 세 마리를 다 잡는 게 목표.

---

## 0. 설계 원칙

1. **Evidence-first**: 모든 인증은 GPS 데이터, 영상, 또는 코치 face-to-face 중 하나의 evidence가 있어야 함.
2. **Falsifiable**: 외부에서 reproduce 가능해야 함. "그날 잘했다"는 거 인증 X.
3. **Tiered automation**: Phase 12에는 self-declared + Danny manual review 위주. Phase 14부터 GPS·영상 자동 검증.
4. **Expiry**: 기술은 녹슬 수 있다. 일정 주기로 재인증 (skill 2년).
5. **Minor first**: 안전 관련 인증 (장비 점검, 응급처치)은 무료·필수.

---

## 1. 3 카테고리 구조

```
┌────────────────────────────────────────────────────────────┐
│                    라이더 인증 체계                           │
├────────────────┬───────────────────┬───────────────────────┤
│  Speed Grade   │   Skill Cert      │   Combination Cert    │
│  (5-tier)      │   (12 +α)         │   (3-tier 훈장)        │
├────────────────┼───────────────────┼───────────────────────┤
│  beginner      │  heel-tacker      │  pro-rider            │
│  cruise        │  toe-tacker       │  master-rider         │
│  performance   │  multi-tacker     │  nt-track             │
│  race          │  heel-jiber       │                       │
│  pro           │  toe-jiber        │                       │
│                │  multi-jiber      │                       │
│                │  perfect-tacker   │                       │
│                │  perfect-jiber    │                       │
│                │  perfect-speeder  │                       │
│                │  perfect-jumper   │                       │
│                │  starboard-jumper │                       │
│                │  port-jumper      │                       │
│                │  master-jumper    │                       │
└────────────────┴───────────────────┴───────────────────────┘
```

DB 매핑 (`certifications.cert_category`): `'speed' | 'skill' | 'combo'`.

---

## 2. Speed Grade (5-tier)

기준은 **GPS 측정 최고 속도 (max_speed_kn)**. KCC·GPS 시계 또는 GPS 트래킹 앱 (예: Speedseeker, Woo) 데이터로 검증.

| Grade            | cert_type           | 속도 기준        | 색상     | DB 매핑     |
|-----------------|---------------------|-----------------|---------|-------------|
| Beginner Speeder | `speed-beginner`    | 0 - 10 kn       | 회색     | `beginner`  |
| Cruise Speeder   | `speed-cruise`      | 10 - 15 kn      | 청록     | `cruise`    |
| Performance      | `speed-performance` | 15 - 20 kn      | 파랑     | `performance` |
| Race Speeder     | `speed-race`        | 20 - 30 kn      | 빨강     | `race`      |
| Pro Speeder      | `speed-pro`         | 30 kn 이상       | 금       | `pro`       |

### Speed Grade 인증 evidence

- **Auto-GPS** (Phase 14 이후 기본): 최근 90일 내 ride에서 max_speed_kn ≥ 기준 + GPS raw 파일 첨부.
- **Self-declared + 영상** (Phase 12-13 임시): GPS 시계 화면 + 라이딩 영상 동시 promote → Danny review.
- **Coach review** (워크샵 현장): 옥덕필 코치가 직접 측정 + 즉시 승인.

### Speed Grade expiry

**없음** (영구). 단, 한 번 받은 등급은 강등 안 됨. 더 높은 등급은 새로 신청.

### 자동 승급 (auto-grade)

Edge Function이 매일 새벽 ride 데이터를 스캔, 새 max_speed_kn이 다음 tier를 넘으면 인증 자동 신청 → Danny review 큐에 진입. Danny는 evidence (GPS file) 클릭 한 번으로 approve.

---

## 3. Skill Certifications (12+ 종)

Danny 제안 + 표준화. 모두 face-to-face 또는 영상 evidence 필요.

### 3.1 태커 (Tacker) — 풍상 방향 전환

| cert_type           | 한글            | 정의                                        |
|---------------------|----------------|--------------------------------------------|
| `heel-tacker`       | 힐 태커          | heel-side 태킹 5회 연속 성공 (체중 백 + 라인 stay) |
| `toe-tacker`        | 토 태커          | toe-side 태킹 5회 연속 성공                    |
| `multi-tacker`      | 멀티 태커        | 한 라이딩 세션에 양방향 태킹 각 5회 이상           |
| `perfect-tacker`    | 퍼팩트 태커      | 멀티 태커 + 속도 손실 < 30%, 라인 텐션 유지        |

### 3.2 자이버 (Jiber) — 풍하 방향 전환

| cert_type           | 한글            | 정의                                        |
|---------------------|----------------|--------------------------------------------|
| `heel-jiber`        | 힐 자이버        | heel-side 자이브 5회 연속 성공                  |
| `toe-jiber`         | 토 자이버        | toe-side 자이브 5회 연속 성공                   |
| `multi-jiber`       | 멀티 자이버      | 양방향 자이브 각 5회 이상                        |
| `perfect-jiber`     | 퍼팩트 자이버    | 멀티 자이버 + 속도 손실 < 25%, swing 부드러움      |

### 3.3 점퍼 (Jumper) — 점프

| cert_type           | 한글            | 정의                                        |
|---------------------|----------------|--------------------------------------------|
| `starboard-jumper`  | 스타보드 점퍼    | 스타보드 택 점프 1m+ 5회                        |
| `port-jumper`       | 포트 점퍼        | 포트 택 점프 1m+ 5회                           |
| `master-jumper`     | 마스터 점퍼      | 양쪽 점프 + 회전 (180° 이상) + 안전 착지           |
| `perfect-jumper`    | 퍼팩트 점퍼      | 마스터 점퍼 + 2m+ 높이 + 깨끗한 착지               |

### 3.4 종합 스피드 기술

| cert_type           | 한글            | 정의                                        |
|---------------------|----------------|--------------------------------------------|
| `perfect-speeder`   | 퍼팩트 스피더    | speed-pro 등급 + 다양한 풍속 (15/20/30kn) 안정 라이딩 |

### 3.5 Skill Cert evidence 요건

| 인증 method      | 요건                                                  | 누구           |
|----------------|------------------------------------------------------|---------------|
| auto-video     | 30초+ 연속 영상 + GPS 트랙 동기화                        | Phase 14+ ML  |
| coach-review   | 워크샵 현장 옥덕필 코치 평가지                              | Danny         |
| peer-review    | 커뮤니티 인증된 라이더 3명이 영상 보고 verify (3/3 approve) | 동료 라이더      |
| self-declared  | 영상 + Danny manual review                            | Sprint 2 default |

### 3.6 Skill Cert expiry

**2년**. 만료 30일 전 알림. 만료 시 다시 evidence 제출하면 자동 갱신.

근거: 윙포일 기술은 비활동 기간이 길면 명백히 감퇴함. 활동 라이더만 인증 유지하는 게 신호 가치 보존.

---

## 4. Combination Cert (훈장)

3종. 아무나 가질 수 없는 명예 칭호.

### 4.1 Pro Rider (`pro-rider`)

| 항목       | 요건                                                |
|-----------|----------------------------------------------------|
| 전제 조건  | speed-pro 인증 (30kn+) + skill cert ≥ 5종          |
| evidence  | 자동 검증 (전제 인증 충족 시 자동 부여)                  |
| expiry    | 영구 (단 전제 인증 만료 시 자동 revoke)                |
| 시각화    | 실버 메달 + 라이더 이름                              |

### 4.2 Master Rider (`master-rider`)

| 항목       | 요건                                                  |
|-----------|------------------------------------------------------|
| 전제 조건  | pro-rider + 모든 skill cert (12종) + 영상 review 통과  |
| evidence  | 모든 skill 영상이 한 worksheet에서 검증 완료              |
| expiry    | 영구 (skill cert 1개 만료 시 자동 강등 → pro-rider)      |
| 시각화    | 골드 메달 + "Master" 타이틀                            |

### 4.3 NT Track (`nt-track`)

옥덕필 코치 face-to-face 평가만 가능. 한국에서 윙포일 코치로 공식 활동할 수 있는 자격.

| 항목       | 요건                                                 |
|-----------|-----------------------------------------------------|
| 전제 조건  | master-rider + 응급처치 자격증 + 옥덕필 코치 평가 통과    |
| evidence  | 코치 직접 발급 (offline)                              |
| expiry    | 3년 (재교육 필수)                                     |
| 시각화    | NT 엠블럼 + 코치 라이센스 번호                          |

---

## 5. 안전 관련 인증 (필수·무료)

별도 카테고리로 분리. 모든 라이더에게 권장 (사실상 필수).

| cert_type           | 정의                                            | 발급                  |
|---------------------|------------------------------------------------|----------------------|
| `safety-gear-check` | 헬멧·임팩트베스트·하네스 점검 매뉴얼 숙지            | 온라인 quiz, 무료     |
| `safety-rescue`     | 자가 구조 + 동료 구조 절차 숙지                    | 온라인 quiz + 영상    |
| `safety-cpr`        | CPR/응급처치 자격증 (대한적십자사 등)               | 외부 자격증 등록       |

**Phase 12 권장 정책**: 회원 가입 후 30일 내 `safety-gear-check` 미완료 시 inventory 외 기능 일부 제한.
*Sprint 2까지는 강제 X, 안내만.*

---

## 6. cert_type enum 전체 (DB 참조용)

```typescript
type CertType =
  // Speed
  | 'speed-beginner' | 'speed-cruise' | 'speed-performance'
  | 'speed-race' | 'speed-pro'
  // Tacker
  | 'heel-tacker' | 'toe-tacker' | 'multi-tacker' | 'perfect-tacker'
  // Jiber
  | 'heel-jiber' | 'toe-jiber' | 'multi-jiber' | 'perfect-jiber'
  // Jumper
  | 'starboard-jumper' | 'port-jumper' | 'master-jumper' | 'perfect-jumper'
  // Combo speed
  | 'perfect-speeder'
  // Combination
  | 'pro-rider' | 'master-rider' | 'nt-track'
  // Safety
  | 'safety-gear-check' | 'safety-rescue' | 'safety-cpr';

type CertCategory = 'speed' | 'skill' | 'combo' | 'safety';
type CertMethod = 'auto-gps' | 'auto-video' | 'coach-review' | 'peer-review' | 'self-declared';
```

DB 마이그레이션의 `cert_category` check constraint에 `'safety'` 추가 필요. 0001_initial.sql 다음 update에 반영:

```sql
alter table public.certifications
  drop constraint certifications_cert_category_check,
  add constraint certifications_cert_category_check
    check (cert_category in ('speed','skill','combo','safety'));
```

---

## 7. State machine (인증 신청 → 승인)

```
[user submits]
       │
       ▼
   pending ──── auto-rule met ───→ approved
       │                              │
       │ Danny rejects                │
       ├─→ rejected                   │
       │                              │
       │ user cancels                 │ time passes (skill 2년)
       └─→ deleted              expires_at < now
                                      │
                                      ▼
                                   expired (별도 status 신설 검토)
                                      │
                                      │ user re-submits evidence
                                      ▼
                                   pending (renewal)

revoked: admin이 수동으로 (부정 사용 적발 시)
```

현재 schema의 `status` enum: `pending / approved / rejected / revoked`. **`expired`는 Phase 13에 추가 검토** (현재는 expires_at 지난 cert를 application code에서 expired로 표시).

---

## 8. UI 시각화 가이드

### 8.1 대시보드 hero

```
┌─────────────────────────────────────────────┐
│  [avatar]  Danny                            │
│            Performance Speeder              │
│            Pro Rider 🥈                     │
│                                             │
│  Skills: 🏷️ 멀티자이버 🏷️ 퍼팩태커  + 3 more │
│                                             │
│  Total: 47 rides · 38h · max 23.4 kn       │
└─────────────────────────────────────────────┘
```

### 8.2 인증 페이지 구조

- **My Certs** 탭: approved cert 카드 그리드 (속도 / 기술 / 훈장 섹션 분리)
- **Pending** 탭: 신청 진행 중 cert
- **Apply** 탭: 가능한 다음 cert (자격 만족하는 것은 highlight)

### 8.3 색상 토큰

```css
--cert-speed-beginner: #9ca3af;
--cert-speed-cruise: #14b8a6;
--cert-speed-performance: #3b82f6;
--cert-speed-race: #ef4444;
--cert-speed-pro: #f59e0b;

--cert-skill: #6366f1;          /* 인디고 — 모든 skill 공통 */
--cert-combo-pro: #94a3b8;       /* silver */
--cert-combo-master: #fbbf24;    /* gold */
--cert-combo-nt: #1f2937;        /* black with NT logo */
```

---

## 9. 향후 자동화 로드맵

| Phase | 자동화 항목                       | 기술                          |
|-------|---------------------------------|------------------------------|
| 12    | (manual review 위주)              | Danny dashboard               |
| 13    | GPS 자동 분석 (max_speed)         | GPX parser + edge function    |
| 14    | 영상 자동 분석 (태킹/자이브 detect) | YOLO + pose estimation 또는 외부 API |
| 15    | Peer review 시스템                | 3-of-3 verify workflow        |
| 16    | NT-track offline cert 동기화       | 옥덕필 코치 dashboard           |

---

## 10. 결정 필요 (Danny)

| #  | 결정사항                                                | 추천             |
|----|--------------------------------------------------------|-----------------|
| C1 | safety cert 가입 후 30일 강제? 권장만?                    | Sprint 2까지 권장 |
| C2 | speed-pro 자동 자격 부여 (GPS evidence 자동 인식)?         | 자동 부여 (Phase 13) |
| C3 | skill cert expiry 2년 vs 영구?                          | 2년 (활성 라이더만 신호 가치) |
| C4 | Master Rider revoke 시 noti?                            | yes (강등 + 사유 알림) |
| C5 | NT Track 발급 권한 옥덕필 코치만? 추가 운영진?              | 옥덕필 only (Sprint 2) |
| C6 | peer-review 시 본인 동의 필요?                            | yes (양방향 동의) |
| C7 | cert 신청에 cool-down 둠 (예: rejected 후 30일)?          | yes, 14일 default |

---

**다음 step**: C1-C7 답변 → cert_type enum 확정 → Sprint 2 인증 UI 구현.
