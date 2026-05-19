// §169 Sprint shim — localStorage 기반 임시 인증. Phase 12 Supabase 백엔드 연동 시 교체. 비밀번호 hash 는 클라이언트 SHA-256 — production-grade 아님. 실제 결제·민감 정보 처리 X.
// DO_NOT_REVERT §169-K — per-user localStorage namespace (privacy fix). 회원별 데이터 leak 방지: dmj_user_<userId>_<suffix> 패턴.
// DO_NOT_REVERT §169-K v3 (Danny 2026-05-16) — 사용자별 결과 격리: dmj_anon_* 버킷에 세션 소유권 토큰(dmj_anon_owner) 부여.
//   현재 브라우저 세션이 만든 익명 데이터만 read/migrate. 다른 사용자가 남긴 익명 진단결과 흡수 회귀 영구 X.
// 글로벌 키 = dmj_session / dmj_users (영구). per-user 키 = 무조건 namespace. 익명 사용 = dmj_anon_<suffix> (소유 세션만 접근).
(function () {
  'use strict';

  var USERS_KEY = 'dmj_users';
  var SESSION_KEY = 'dmj_session';
  var SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

  // §169-K — per-user namespace prefix. 회원별 데이터 분리. 글로벌 키와 충돌 방지.
  var USER_NS_PREFIX = 'dmj_user_';
  var ANON_NS_PREFIX = 'dmj_anon_';
  // §169-K v3 — dmj_anon_* 버킷 세션 소유권. dmj_anon_<suffix> 는 단일 공유 키이므로
  // "어느 브라우저 세션이 이 익명 데이터를 만들었는지" 를 토큰으로 표시해야 cross-user leak 차단 가능.
  var ANON_SID_KEY = 'dmj_anon_sid';     // sessionStorage — 브라우저 세션 1개당 1 토큰 (탭 닫으면 소멸)
  var ANON_OWNER_KEY = 'dmj_anon_owner'; // localStorage — 현재 dmj_anon_* 버킷의 소유 세션 토큰
  // §169-K — per-user 마이그레이션 대상 suffix list. 회원별 격리 필요. 추가 시 여기 등록.
  // 글로벌 (영구 namespace 제외): dmj_session / dmj_users.
  var USER_DATA_SUFFIXES = [
    'skill_assessment_v1',  // skill-assessment.html — 10축 진단 결과
    'self_assessment_v1',   // §166 8 동작 자가진단 (미구현이지만 등록)
    'fmg_history',          // find-my-gear.html — 추천 기록 archive
    'land_phase',           // 트레이닝 육상 stage (profile §I, ex-§H)
    'water_stage',          // 트레이닝 해상 stage (profile §I, ex-§H)
    'cart',                 // §171-B — 장바구니 (per-user 격리, 비로그인 = anon)
    'consult_history',      // §171 v2 — 1:1 구매 상담 신청 history
    'quotes_history',       // §171-B — 견적요청 history (quote.html 저장)
    'orders'                // §174 — 주문 진행 timeline (profile §H + admin tool)
  ];

  function readUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function writeUsers(map) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.expiresAt || Date.now() > s.expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function writeSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    // RFC4122 v4 fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0; var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function emailValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  async function hashPassword(pw) {
    var enc = new TextEncoder().encode(String(pw));
    var buf = await window.crypto.subtle.digest('SHA-256', enc);
    var bytes = new Uint8Array(buf);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      hex += h.length === 1 ? '0' + h : h;
    }
    return hex;
  }

  async function signup(email, password, name) {
    email = String(email || '').trim();
    if (!emailValid(email)) throw new Error('이메일 형식이 올바르지 않습니다.');
    if (!password || String(password).length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.');
    var key = email.toLowerCase();
    var users = readUsers();
    if (users[key]) throw new Error('이미 등록된 이메일입니다.');
    var hash = await hashPassword(password);
    var now = Date.now();
    var user = {
      id: uuid(),
      email: email,
      name: name || '',
      nickname: '',
      gender: '',
      birthYear: '',
      ridingStart: '',  // "YYYY-MM"
      mainSports: [],
      favoriteSpot: '',
      avatarBase64: '',
      tier: 'member',      // §162 회원 (0% discount)
      tierLabel: '회원',
      tierDiscount: 0,
      gear: [],
      createdAt: now,
      passwordHash: hash
    };
    users[key] = user;
    writeUsers(users);
    writeSession({ userId: user.id, email: email, expiresAt: now + SESSION_TTL_MS });
    return user;
  }

  async function login(email, password) {
    email = String(email || '').trim();
    if (!emailValid(email)) throw new Error('이메일 형식이 올바르지 않습니다.');
    var key = email.toLowerCase();
    var users = readUsers();
    var user = users[key];
    if (!user) throw new Error('등록되지 않은 이메일입니다.');
    var hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error('비밀번호가 일치하지 않습니다.');
    writeSession({ userId: user.id, email: user.email, expiresAt: Date.now() + SESSION_TTL_MS });
    return user;
  }

  function logout() {
    clearSession();
  }

  function currentUser() {
    var s = readSession();
    if (!s) return null;
    var users = readUsers();
    return users[s.email.toLowerCase()] || null;
  }

  function isLoggedIn() {
    return !!currentUser();
  }

  function updateUser(patch) {
    var s = readSession();
    if (!s) return null;
    var users = readUsers();
    var key = s.email.toLowerCase();
    if (!users[key]) return null;
    // protect critical fields
    var safe = Object.assign({}, patch);
    delete safe.passwordHash;
    delete safe.id;
    delete safe.email;
    delete safe.createdAt;
    users[key] = Object.assign({}, users[key], safe);
    writeUsers(users);
    return users[key];
  }

  // ===== §169-K — per-user localStorage namespace =====
  // 회원별 데이터 leak 방지: User A 의 skill assessment 가 User B 의 profile 에 보이는 critical bug 해결.
  // 글로벌 키 (dmj_session/dmj_users) 는 namespace X. per-user 데이터는 모두 dmj_user_<userId>_<suffix>.

  // 익명 (로그인 X) 상태 sentinel — getUserData/setUserData 가 dmj_anon_<suffix> 로 fallback.
  function currentUserId() {
    var s = readSession();
    return s && s.userId ? String(s.userId) : null;
  }

  // §169-K — userKey: 로그인 시 dmj_user_<userId>_<suffix>, 비로그인 시 null.
  // suffix = dmj_ 접두어 제거된 부분 (e.g. 'skill_assessment_v1', 'fmg_history').
  function userKey(suffix) {
    var uid = currentUserId();
    if (!uid) return null;
    return USER_NS_PREFIX + uid + '_' + String(suffix);
  }

  function anonKey(suffix) {
    return ANON_NS_PREFIX + String(suffix);
  }

  // ===== §169-K v3 — dmj_anon_* 버킷 세션 소유권 =====
  // 문제: dmj_anon_<suffix> 는 비로그인 사용자 전원이 공유하는 단일 키. 소유권 추적이 없어서
  //       User A 가 익명으로 진단 → User B 가 로그인/가입 시 _migrateAnonToUser() 가 A 의 데이터를 B 에게 흡수.
  // 해결: 익명 데이터 작성 시 현재 브라우저 세션 토큰(sessionStorage)을 localStorage 에 소유자로 stamp.
  //       read / migrate 는 "현재 세션이 소유자일 때만" 허용. 다른 세션·다른 사람이 남긴 익명 버킷은 절대 노출/이관 X.

  // 현재 브라우저 세션의 토큰. 없으면 lazy 생성. sessionStorage 사용 불가 환경 = null (안전 측: 익명 데이터 격리 불가 → 노출 안 함).
  function currentAnonSid() {
    try {
      var sid = sessionStorage.getItem(ANON_SID_KEY);
      if (!sid) {
        sid = uuid();
        sessionStorage.setItem(ANON_SID_KEY, sid);
      }
      return sid;
    } catch (e) { return null; }
  }

  // dmj_anon_* 버킷의 현재 소유 세션 토큰 (localStorage).
  function anonOwnerSid() {
    try { return localStorage.getItem(ANON_OWNER_KEY); } catch (e) { return null; }
  }

  // dmj_anon_* 버킷의 모든 suffix 키 제거 (소유권 인계·이관 후 cleanup. account namespace 데이터는 건드리지 않음).
  function _clearAnonBucket() {
    try {
      for (var i = 0; i < USER_DATA_SUFFIXES.length; i++) {
        localStorage.removeItem(ANON_NS_PREFIX + USER_DATA_SUFFIXES[i]);
      }
      localStorage.removeItem(ANON_OWNER_KEY);
    } catch (e) {}
  }

  // 현재 세션이 dmj_anon_* 버킷을 소유함을 stamp. 다른 세션이 소유 중이었다면 그 잔여물을 먼저 purge
  // (이전 사용자의 익명 데이터가 새 세션에 섞여 보이는 것 차단).
  function _stampAnonOwner() {
    try {
      var sid = currentAnonSid();
      if (!sid) return;
      var prev = anonOwnerSid();
      if (prev && prev !== sid) _clearAnonBucket();
      localStorage.setItem(ANON_OWNER_KEY, sid);
    } catch (e) {}
  }

  // 현재 세션이 dmj_anon_* 버킷의 소유자인지. sessionStorage 토큰 ↔ localStorage owner 일치 시 true.
  function anonOwnedByCurrentSession() {
    var sid = null;
    try { sid = sessionStorage.getItem(ANON_SID_KEY); } catch (e) { sid = null; }
    if (!sid) return false;          // 이 세션은 익명 데이터를 만든 적 없음 → 공유 버킷 비소유
    return anonOwnerSid() === sid;
  }

  // §169-K v3 — getUserData: 로그인 시 user namespace, 비로그인 시 "현재 세션이 소유한" anon namespace 만.
  // 다른 세션/다른 사용자가 남긴 dmj_anon_* 는 노출 X (null 반환). null-safe.
  function getUserData(suffix) {
    try {
      var k = userKey(suffix);
      if (k) return localStorage.getItem(k);
      // 익명 read — 현재 브라우저 세션이 소유한 익명 데이터일 때만 반환.
      if (!anonOwnedByCurrentSession()) return null;
      return localStorage.getItem(anonKey(suffix));
    } catch (e) { return null; }
  }

  // §169-K v3 — setUserData: 로그인 시 user namespace. 비로그인 시 anon namespace + 현재 세션을 소유자로 stamp.
  // production-grade backend (Phase 12) 에서는 비로그인 = 저장 거부 + 로그인 prompt 가 정석.
  function setUserData(suffix, value) {
    try {
      var k = userKey(suffix);
      if (k) {
        localStorage.setItem(k, String(value));
        return true;
      }
      // 익명 저장 — 현재 세션을 dmj_anon_* 버킷 소유자로 stamp (이전 세션 잔여물은 _stampAnonOwner 가 purge).
      // 로그인/가입 시 _migrateAnonToUser() 가 "소유 세션 일치" 조건으로만 user namespace 이관.
      _stampAnonOwner();
      localStorage.setItem(anonKey(suffix), String(value));
      console.warn('[DMJAuth] setUserData("' + suffix + '") — 비로그인 상태, dmj_anon_ namespace 에 저장됨 (세션 소유).');
      return true;
    } catch (e) {
      console.warn('[DMJAuth] setUserData failed for "' + suffix + '"', e);
      return false;
    }
  }

  function removeUserData(suffix) {
    try {
      var k = userKey(suffix);
      if (k) localStorage.removeItem(k);
      else localStorage.removeItem(anonKey(suffix));
    } catch (e) {}
  }

  // §169-K — 마이그레이션: 글로벌 dmj_<suffix> → dmj_user_<userId>_<suffix>.
  // 1회 per user (sentinel `migrated` flag). 재실행 = 멱등.
  // 호출: login/signup 성공 직후 (signup 은 글로벌 키 없는 신규 user 라 noop, login 은 첫 user 에게 본인 데이터 매핑).
  function _migrateGlobalToUser() {
    var uid = currentUserId();
    if (!uid) return;
    var sentinelKey = USER_NS_PREFIX + uid + '_migrated';
    try {
      if (localStorage.getItem(sentinelKey)) return; // 이미 마이그레이션 완료
    } catch (e) { return; }
    var migrated = 0;
    for (var i = 0; i < USER_DATA_SUFFIXES.length; i++) {
      var suffix = USER_DATA_SUFFIXES[i];
      var globalKey = 'dmj_' + suffix;
      try {
        var val = localStorage.getItem(globalKey);
        if (val !== null) {
          // 사용자 namespace 에 이미 값이 있으면 덮어쓰기 X (재로그인 안전).
          var userK = USER_NS_PREFIX + uid + '_' + suffix;
          if (localStorage.getItem(userK) === null) {
            localStorage.setItem(userK, val);
            migrated++;
          }
          // 글로벌 키 제거 — 다른 user 에게 leak 방지 (§169-K 핵심).
          localStorage.removeItem(globalKey);
        }
      } catch (e) {}
    }
    try { localStorage.setItem(sentinelKey, String(Date.now())); } catch (e) {}
    if (migrated > 0) {
      console.info('[DMJAuth] §169-K migrated ' + migrated + ' global key(s) → user namespace (uid=' + uid + ').');
    }
  }

  // §169-K v3 — 익명 → user 마이그레이션. 게스트가 skill-assessment 진행 후 회원가입/로그인 시 데이터 이관.
  // ⚠ dmj_anon_* 는 공유 버킷이므로, "현재 브라우저 세션이 소유한" 익명 데이터만 이관한다.
  //   (예: 게스트가 진단 → 같은 세션에서 바로 가입 = 본인 데이터 → 이관 O.
  //        User A 가 익명으로 남긴 데이터를 나중에 User B 가 로그인 = 소유 세션 불일치 → 이관 X.)
  // 이전 정책(무조건 이관) = CRITICAL leak: User A 의 진단결과가 User B 계정으로 흡수됨. 회귀 영구 금지.
  function _migrateAnonToUser() {
    var uid = currentUserId();
    if (!uid) return;
    // 소유 세션 불일치 = 이 익명 버킷은 현재 로그인 사용자의 것이 아님 → 이관 절대 X (leak 차단).
    if (!anonOwnedByCurrentSession()) return;
    var migrated = 0;
    for (var i = 0; i < USER_DATA_SUFFIXES.length; i++) {
      var suffix = USER_DATA_SUFFIXES[i];
      var anonK = ANON_NS_PREFIX + suffix;
      try {
        var val = localStorage.getItem(anonK);
        if (val !== null) {
          var userK = USER_NS_PREFIX + uid + '_' + suffix;
          // user namespace 비어있을 때만 이관 (재로그인 시 기존 데이터 보호).
          if (localStorage.getItem(userK) === null) {
            localStorage.setItem(userK, val);
            migrated++;
          }
          localStorage.removeItem(anonK);
        }
      } catch (e) {}
    }
    // 이관 완료 — 소유권 stamp 제거. 버킷이 비었으므로 다음 세션이 깨끗하게 시작.
    try { localStorage.removeItem(ANON_OWNER_KEY); } catch (e) {}
    if (migrated > 0) {
      console.info('[DMJAuth] §169-K v3 migrated ' + migrated + ' anon key(s) → user namespace (uid=' + uid + ').');
    }
  }

  // §169-K v2 — Danny 2026-05-13: leak fix.
  // 이전 정책 ( _signupWithMigration 가 _migrateGlobalToUser 호출) = CRITICAL leak.
  // 시나리오: User A 가 pre-§169-K 시점에 global 에 데이터 저장 → A 로그인 안 함 → User B 신규 signup → B 의 migration 이
  //          orphan global 데이터를 B 의 namespace 로 흡수 → B 가 A 의 진단 결과를 본인 것으로 봄.
  // 정정 정책:
  //   1. signup = blank slate. global migration 영구 X (신규 user 가 이전 데이터 흡수 X).
  //   2. login = 같은 user 가 pre-§169-K 시점부터 사용해온 경우만 global → user namespace 이관 가능 (sentinel 로 1회).
  //   3. script load auto-migrate 폐기. 대신 _clearStaleGlobals() 호출 — orphan global key 영구 제거.
  function _clearStaleGlobals() {
    for (var i = 0; i < USER_DATA_SUFFIXES.length; i++) {
      try { localStorage.removeItem('dmj_' + USER_DATA_SUFFIXES[i]); } catch (e) {}
    }
  }

  async function _loginWithMigration(email, password) {
    var u = await login(email, password);
    _migrateGlobalToUser();  // 기존 user 가 pre-§169-K global 데이터 보유 시 본인 namespace 로 1회 이관 (sentinel 멱등)
    _migrateAnonToUser();    // 본인이 익명으로 사용한 데이터 이관
    _clearStaleGlobals();    // 이관 후 잔존 global 제거 — 다음 user 에게 leak 방지
    return u;
  }
  async function _signupWithMigration(email, password, name) {
    var u = await signup(email, password, name);
    // §169-K v2 — 신규 user 는 _migrateGlobalToUser 호출 X. global 데이터 흡수 = leak.
    // §169-K v3 — _migrateAnonToUser 는 "현재 세션이 소유한" anon 데이터만 이관 (anonOwnedByCurrentSession 게이트).
    //   다른 사용자가 남긴 익명 버킷은 흡수 X. (이전 v2 주석의 "anon = 1 user 데이터 보장" 가정은 오류였음.)
    _migrateAnonToUser();    // 본인이 같은 브라우저 세션에서 가입 전 사용한 anon 키만 이관
    _clearStaleGlobals();    // 신규 user signup 시 orphan global 영구 제거 — privacy 핵심
    return u;
  }

  // §175 (Danny 2026-05-17) — 누적 구매 100만원 → 단무지 회원(10%) 자동 승급.
  // Phase 1 = localStorage stub. Phase 12 backend = Supabase Function (TODO).
  // DO_NOT_REVERT §175 — "첫 구매" → "누적 구매" 정책 영구 lock.
  var TIER_THRESHOLD_DANMUJI = 1000000;  // ₩1,000,000 누적 구매 시 단무지 회원
  function recomputeTotalSpend() {
    try {
      var raw = getUserData('orders');
      if (!raw) return 0;
      var orders = JSON.parse(raw);
      if (!Array.isArray(orders)) return 0;
      var total = 0;
      for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        if (!o) continue;
        // Phase 1: all orders count (even at stage 1). Phase 12 will filter stage >= 4.
        var amt = Number(o.totalKRW) || 0;
        total += amt;
      }
      setUserData('total_spend', String(total));
      return total;
    } catch (e) {
      console.warn('[DMJAuth §175] recomputeTotalSpend failed', e);
      return 0;
    }
  }
  function getTotalSpend() {
    try {
      var raw = getUserData('total_spend');
      return raw ? Number(raw) || 0 : 0;
    } catch (e) { return 0; }
  }
  function autoUpgradeTier() {
    try {
      var u = currentUser();
      if (!u || !u.id) return null;
      var total = recomputeTotalSpend();
      var curDisc = Number(u.tierDiscount) || 0;
      // Auto-upgrade: 회원(0%) → 단무지 회원(10%) when total >= 1,000,000
      if (curDisc === 0 && total >= TIER_THRESHOLD_DANMUJI) {
        u.tierLabel = '단무지 회원';
        u.tierDiscount = 10;
        u.tierSlug = 'danmuji';
        u.tierUpgradedAt = new Date().toISOString();
        updateUser(u);
        console.info('[DMJAuth §175] auto-upgraded to 단무지 회원 (10%) — total_spend ₩' + total.toLocaleString());
        return u;
      }
      return null;
    } catch (e) {
      console.warn('[DMJAuth §175] autoUpgradeTier failed', e);
      return null;
    }
  }

  window.DMJAuth = {
    signup: _signupWithMigration,
    login: _loginWithMigration,
    logout: logout,
    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    updateUser: updateUser,
    hashPassword: hashPassword,
    // §169-K — per-user namespace helpers (skill-assessment / profile / find-my-gear 등에서 사용)
    currentUserId: currentUserId,
    userKey: userKey,
    getUserData: getUserData,
    setUserData: setUserData,
    removeUserData: removeUserData,
    // §175 — 누적 구매 tier 자동 승급 (Phase 1 stub, Phase 12 Supabase 예정)
    recomputeTotalSpend: recomputeTotalSpend,
    getTotalSpend: getTotalSpend,
    autoUpgradeTier: autoUpgradeTier,
    TIER_THRESHOLD_DANMUJI: TIER_THRESHOLD_DANMUJI,
    // exposed for §D My Gear / §B avatar etc.
    _readUsers: readUsers,
    _writeUsers: writeUsers,
    // §169-K — 마이그레이션 manual trigger (테스트용)
    _migrateGlobalToUser: _migrateGlobalToUser,
    _migrateAnonToUser: _migrateAnonToUser,
    // §169-K v2 — orphan global 제거 (script load 시 자동 호출, 테스트 시 수동 호출 가능)
    _clearStaleGlobals: _clearStaleGlobals,
    // §169-K v3 — anon 버킷 세션 소유권 helpers (테스트/디버그용)
    anonOwnedByCurrentSession: anonOwnedByCurrentSession,
    _clearAnonBucket: _clearAnonBucket
  };

  // §169-K v2 (Danny 2026-05-13) — auto-migrate 폐기. 대신 _clearStaleGlobals() 호출.
  // 이전 정책 (`_migrateGlobalToUser()` on script load) = leak 가능성: 로그인 한 user 가 페이지 열 때
  // orphan global 데이터를 본인 namespace 로 흡수. 이 user 가 다른 user 의 데이터를 보게 됨.
  // 새 정책: script load 시 stale global 키 무조건 제거. global 데이터는 login 시점에만 본인 namespace 로 복원.
  try { _clearStaleGlobals(); } catch (e) {}
})();
