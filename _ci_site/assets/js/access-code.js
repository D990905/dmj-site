/* ==========================================================================
   단무지공방 — Premium Access Code Module v1
   DO_NOT_REVERT §100 / §104 / §175 (Danny 2026-05-16 FREE_MODE)

   모델: 회원가입 + 장비 등록 → 액세스 코드 발급 (Phase 1 임시 구현)
   - 임시 backend: localStorage. 정식 backend = Phase 12 Supabase Auth + DB.
   - 코드 = 6자리 alphanumeric + 12시간 expiry.
   - 발급: window.DMJAccess.issueCode(profile, gear)
   - 검증: window.DMJAccess.checkCode(code) → boolean
   - 잠금 해제: window.DMJAccess.applyUnlock() (currently active code 있으면 .premium-locked → unlocked)

   §175 (Danny 2026-05-16): FREE_MODE = true → applyUnlock 코드 없어도 무조건 해제.
   "현재 무료 운영 중" 정책 일관 적용. 유료 전환 시 FREE_MODE = false 로 토글.
   ========================================================================== */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'dmj.premium.access';     // {code, exp, profile, gear, ts}
  var TTL_MS = 12 * 60 * 60 * 1000;            // 12시간
  var FREE_MODE = true;                        // §175 — "현재 무료 운영 중" 정책. 유료 전환 시 false.

  // ── 6자리 alphanumeric (혼동 글자 0/O/1/I 제외) ──
  function generateCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 6; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  // ── localStorage safe wrapper (private mode 등 대비) ──
  function safeGet() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function safeSet(obj) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      return true;
    } catch (e) { return false; }
  }
  function safeClear() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // ── 발급 (회원가입 + 장비 등록 후 호출) ──
  function issueCode(profile, gear) {
    var code = generateCode();
    var record = {
      code: code,
      exp: Date.now() + TTL_MS,
      profile: profile || {},
      gear: gear || [],
      ts: Date.now()
    };
    safeSet(record);
    return record;
  }

  // ── 현재 코드 (만료 X) ──
  function currentCode() {
    var rec = safeGet();
    if (!rec) return null;
    if (rec.exp && rec.exp < Date.now()) {
      safeClear();
      return null;
    }
    return rec;
  }

  // ── 입력 코드 검증 ──
  function checkCode(input) {
    if (!input) return false;
    var rec = currentCode();
    if (!rec) return false;
    return String(input).trim().toUpperCase() === String(rec.code).toUpperCase();
  }

  // ── 잠금 해제 적용 (페이지 load 시 호출) ──
  // §175 — FREE_MODE = true 면 코드 없어도 무조건 해제 ("현재 무료 운영 중" 정책).
  function applyUnlock() {
    var rec = currentCode();
    if (!rec && !FREE_MODE) return false;
    var locked = document.querySelectorAll('.premium-locked');
    for (var i = 0; i < locked.length; i++) {
      var el = locked[i];
      el.classList.remove('premium-locked');
      el.classList.add('premium-unlocked');
      // body의 흐림 처리 해제
      var body = el.querySelector('.premium-locked__body');
      if (body) {
        body.style.filter = 'none';
        body.style.opacity = '1';
        body.style.pointerEvents = 'auto';
      }
      // gate 제거
      var gates = el.querySelectorAll('.premium-gate');
      for (var j = 0; j < gates.length; j++) {
        gates[j].style.display = 'none';
      }
    }
    return true;
  }

  // ── 코드 폐기 ──
  function clearCode() { safeClear(); }

  // ── Public API ──
  global.DMJAccess = {
    issueCode: issueCode,
    currentCode: currentCode,
    checkCode: checkCode,
    applyUnlock: applyUnlock,
    clearCode: clearCode,
    _ttlMs: TTL_MS,
    _storageKey: STORAGE_KEY
  };
})(window);
