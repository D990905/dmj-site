// ============================================================================
// §180 (Danny 2026-05-27) — Phase 12 Supabase + Kakao OAuth Migration
//   기존 auth-shim.js (localStorage 임시 인증) 를 Supabase Auth 로 교체.
//   window.DMJAuth API 100% 호환 — 21개 사용처 코드 수정 없음.
//
// 아키텍처
//   - Auth: Supabase Auth + Kakao OAuth provider
//   - User Profile: public.profiles (auth.users 1:1 확장)
//   - Per-user 데이터:
//       cart → public.cart_items (별도 정형 테이블)
//       나머지 8종 (skill_assessment_v1, self_assessment_v1, fmg_history,
//                  land_phase, water_stage, consult_history, quotes_history,
//                  orders) → public.user_data (suffix + jsonb)
//   - Sync 정책: write-through (localStorage 캐시 + 백그라운드 Supabase upsert)
//                read = localStorage (sync), write = both
//                cross-device sync = login 시 pullUserDataFromCloud()
//
// 호환성
//   - currentUser()/isLoggedIn()/currentUserId() — sync 반환 (캐시)
//   - signup/login/logout/updateUser — async (기존 API 와 동일)
//   - getUserData/setUserData — sync (localStorage 캐시 layer)
//   - hashPassword — legacy stub (Supabase 가 서버측 hash)
//
// DO_NOT_REVERT §180 — auth-shim.js 폐기, 이 파일이 단일 진입점.
// ============================================================================

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────
  // 1) Supabase client bootstrap
  // ─────────────────────────────────────────────────────────────────────
  var SUPABASE_URL = 'https://uzwennkeoeihqyvnxech.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_Xt5qEA_0Ar1HWWuecR4AAQ_9qxooFY1';
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  // ── §427a: §426 B pivot revert (옥대표 2026-07-02 "마이페이지 필요") ─────────
  // §426 은 auto-pause(§425) 대응으로 페이지 로드마다의 client 자동 부팅을 막았으나,
  // 회원 기능 복원 결정에 따라 auto-boot 을 다시 켠다 (getSession → 세션 복원).
  // Supabase 가 paused 인 동안엔 network 실패 → graceful fallback(로그인 실패)이며,
  // 옥대표 dashboard Restore 후 정상 작동. auto-pause 재발 방지 = §427b keep-alive cron.
  var MEMBER_MODE_DISABLED = false;

  var USER_NS_PREFIX = 'dmj_user_';   // localStorage 캐시 prefix
  var ANON_NS_PREFIX = 'dmj_anon_';   // 비로그인 fallback
  var USER_CACHE_KEY = 'dmj_user_cache';  // currentUser sync access 용

  // user_data 테이블로 가는 suffix 목록 (cart 는 별도 cart_items)
  var USER_DATA_SUFFIXES = [
    'skill_assessment_v1',
    'self_assessment_v1',
    'fmg_history',
    'land_phase',
    'water_stage',
    'consult_history',
    'quotes_history',
    'orders',
    'gear',          // §184 — profiles 컬럼 없음 → user_data sync
    'profile_extra'  // §187 (인프라#10 2026-06-04) — stance/phone/address/favoriteSpots
  ];

  var sb = null;             // Supabase client (lazy init)
  var cachedSession = null;
  var cachedProfile = null;
  var clientReady = null;    // Promise

  function loadSDK() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve(window.supabase);
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = function () { resolve(window.supabase); };
      s.onerror = function () { reject(new Error('Supabase SDK load failed')); };
      document.head.appendChild(s);
    });
  }

  function ensureClient() {
    if (clientReady) return clientReady;
    clientReady = loadSDK().then(function (supabase) {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,   // OAuth callback 시 URL 파싱
          storageKey: 'dmj_sb_auth'
        }
      });

      // 세션 변경 listener — OAuth callback / token refresh / 다른 탭 로그인
      sb.auth.onAuthStateChange(function (event, session) {
        cachedSession = session;
        if (session) {
          refreshProfile().then(function () {
            if (event === 'SIGNED_IN') {
              // OAuth 로그인 또는 첫 진입 — cloud 데이터 pull
              // §187 — pull 후 refreshProfile 재실행: profile_extra (stance/phone/address/
              // favoriteSpots) 가 cloud → localStorage 로 내려온 뒤 cachedProfile 에 병합되도록.
              pullUserDataFromCloud().then(function () {
                return refreshProfile();
              }).catch(function () {});
            }
          });
        } else {
          cachedProfile = null;
          try { localStorage.removeItem(USER_CACHE_KEY); } catch (e) {}
        }
        // legacy nav-auth.js 등이 listen 가능
        try {
          window.dispatchEvent(new CustomEvent('dmj-auth-change', {
            detail: { event: event, isLoggedIn: !!session }
          }));
        } catch (e) {}
      });

      // boot — 기존 세션 복원
      return sb.auth.getSession().then(function (res) {
        cachedSession = res.data.session;
        if (cachedSession) return refreshProfile();
        return null;
      });
    });
    return clientReady;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2) Profile mapping — DB row ↔ legacy DMJAuth.currentUser() shape
  // ─────────────────────────────────────────────────────────────────────
  /* §184 (데이빗 2026-06-04) — gear 저장 경로.
     profiles 테이블에 gear 컬럼이 없어 Supabase 전환 때 gear:[] 하드코딩 →
     "+ 장비 추가" 가 저장 증발·기존 장비 소실되던 회귀. Phase 13 inventory
     테이블 전까지 user_data 'gear' suffix (JSON 배열 문자열) 를 SoT 로 쓴다.
     setUserData = 동기 localStorage + 백그라운드 Supabase user_data sync 라
     저장 직후 currentUser().gear 동기 읽기 호환 + 기기간 동기화 둘 다 충족.
     옛 auth-shim(dmj_users[email].gear) 잔존 장비는 1회 자동 이관. */
  function _readGearCache(uid, email) {
    try {
      var k = USER_NS_PREFIX + uid + '_gear';
      var raw = localStorage.getItem(k);
      if (raw != null) {
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      }
      // 레거시 dmj_users 1회 이관 — 옛 localStorage 회원 시스템에 등록했던 장비 복구
      if (email) {
        var usersRaw = localStorage.getItem('dmj_users');
        if (usersRaw) {
          var users = JSON.parse(usersRaw);
          var legacy = users && users[String(email).toLowerCase()];
          if (legacy && Array.isArray(legacy.gear) && legacy.gear.length) {
            localStorage.setItem(k, JSON.stringify(legacy.gear));
            return legacy.gear.slice();
          }
        }
      }
    } catch (e) {}
    return [];
  }

  /* §187 (인프라#10 2026-06-04) — 기본 정보 확장 필드 저장 경로.
     profiles 테이블에 stance/phone/address/favorite_spots 컬럼이 없어
     (a) mapLegacyPatchToDb 가 silently drop (쓰기 증발)
     (b) mapDbToLegacy 가 필드 자체를 안 만들어 항상 undefined (읽기 증발)
     → 마이페이지 기본 정보가 로그인할 때마다 비는 회귀. §184 gear 와 동일 패턴.
     Phase 13 컬럼 추가 전까지 user_data 'profile_extra' suffix (JSON object
     {stance, phone, address, favoriteSpots, favoriteSpot}) 를 SoT 로 쓴다.
     setUserData = 동기 localStorage + 백그라운드 Supabase user_data sync.
     옛 auth-shim(dmj_users[email]) 잔존 기본정보는 1회 자동 이관.
     DO_NOT_REVERT §187. */
  var EXTRA_PROFILE_FIELDS = ['stance', 'phone', 'address', 'favoriteSpots', 'favoriteSpot'];

  function _readProfileExtraCache(uid, email) {
    try {
      var k = USER_NS_PREFIX + uid + '_profile_extra';
      var raw = localStorage.getItem(k);
      if (raw != null) {
        var obj = JSON.parse(raw);
        return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
      }
      // 레거시 dmj_users 1회 이관 — 옛 localStorage 회원 시스템 기본정보 복구
      if (email) {
        var usersRaw = localStorage.getItem('dmj_users');
        if (usersRaw) {
          var users = JSON.parse(usersRaw);
          var legacy = users && users[String(email).toLowerCase()];
          if (legacy) {
            var mig = {};
            var found = false;
            for (var i = 0; i < EXTRA_PROFILE_FIELDS.length; i++) {
              var f = EXTRA_PROFILE_FIELDS[i];
              var v = legacy[f];
              if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
                mig[f] = v; found = true;
              }
            }
            if (found) {
              localStorage.setItem(k, JSON.stringify(mig));
              return mig;
            }
          }
        }
      }
    } catch (e) {}
    return {};
  }

  function mapDbToLegacy(profile, authUser) {
    if (!profile) return null;
    var extra = _readProfileExtraCache(profile.id, (authUser && authUser.email) || profile.email);  // §187
    return {
      id: profile.id,
      email: (authUser && authUser.email) || profile.email || '',
      name: profile.display_name || '',
      nickname: profile.nickname || '',
      gender: profile.gender || '',
      birthYear: profile.birth_year != null ? String(profile.birth_year) : '',
      ridingStart: profile.riding_start || '',
      mainSports: profile.main_sports || [],
      favoriteSpot: profile.favorite_spot_text || extra.favoriteSpot || '',
      // §187 — profiles 컬럼 없는 기본정보 확장 필드 (user_data 'profile_extra' SoT)
      favoriteSpots: Array.isArray(extra.favoriteSpots) ? extra.favoriteSpots : [],
      stance: extra.stance || '',
      phone: extra.phone || '',
      address: extra.address || '',
      avatarBase64: profile.avatar_url || '',  // legacy 필드명 보존
      avatar_url: profile.avatar_url || '',    // Kakao 프로필 사진 URL 직접 접근용
      tier: profile.tier || 'member',
      tierLabel: profile.tier_label || '회원',
      tierDiscount: profile.tier_discount || 0,
      tierSlug: profile.tier || 'member',      // §175 legacy
      gear: _readGearCache(profile.id, (authUser && authUser.email) || profile.email),  // §184 user_data 'gear' (Phase 13 inventory 전 임시 SoT)
      totalSpend: profile.total_spend_krw || 0,
      createdAt: profile.created_at ? new Date(profile.created_at).getTime() : Date.now(),
      passwordHash: ''                         // legacy stub
    };
  }

  function mapLegacyPatchToDb(patch) {
    var db = {};
    if ('name' in patch) db.display_name = patch.name;
    if ('nickname' in patch) db.nickname = patch.nickname;
    if ('gender' in patch) db.gender = patch.gender;
    if ('birthYear' in patch) db.birth_year = patch.birthYear ? Number(patch.birthYear) : null;
    if ('ridingStart' in patch) db.riding_start = patch.ridingStart;
    if ('mainSports' in patch) db.main_sports = patch.mainSports;
    if ('favoriteSpot' in patch) db.favorite_spot_text = patch.favoriteSpot;
    if ('avatarBase64' in patch) db.avatar_url = patch.avatarBase64;
    if ('avatar_url' in patch) db.avatar_url = patch.avatar_url;
    return db;
  }

  function refreshProfile() {
    if (!cachedSession || !sb) return Promise.resolve(null);
    return sb.from('profiles').select('*').eq('id', cachedSession.user.id).single()
      .then(function (res) {
        if (res.error) {
          console.warn('[DMJAuth §180] refreshProfile error', res.error);
          return null;
        }
        cachedProfile = mapDbToLegacy(res.data, cachedSession.user);
        try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cachedProfile)); } catch (e) {}
        return cachedProfile;
      });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3) localStorage 캐시 부트 — 새로고침 시 sync API 즉시 반응
  // ─────────────────────────────────────────────────────────────────────
  try {
    var raw = localStorage.getItem(USER_CACHE_KEY);
    if (raw) cachedProfile = JSON.parse(raw);
  } catch (e) {}

  // ─────────────────────────────────────────────────────────────────────
  // 4) Auth API
  // ─────────────────────────────────────────────────────────────────────
  function signup(email, password, name) {
    return ensureClient().then(function () {
      return sb.auth.signUp({
        email: String(email || '').trim(),
        password: String(password || ''),
        options: { data: { display_name: name || '', name: name || '' } }
      });
    }).then(function (res) {
      if (res.error) throw new Error(_translateAuthError(res.error.message));
      cachedSession = res.data.session;
      // signup 시 trigger 가 profile row 생성 → refresh
      return refreshProfile();
    });
  }

  function login(email, password) {
    return ensureClient().then(function () {
      return sb.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || '')
      });
    }).then(function (res) {
      if (res.error) throw new Error(_translateAuthError(res.error.message));
      cachedSession = res.data.session;
      return refreshProfile();
    });
  }

  // §180 — 카카오 OAuth 로그인. signInWithOAuth 는 카카오 페이지로 redirect.
  // redirectTo = 현재 페이지 — OAuth callback 후 자동으로 돌아옴.
  function signInWithKakao(opts) {
    opts = opts || {};
    return ensureClient().then(function () {
      return sb.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: opts.redirectTo || (window.location.origin + window.location.pathname),
          scopes: 'profile_nickname profile_image'  // account_email 은 비즈 인증 필요
        }
      });
    }).then(function (res) {
      if (res.error) throw new Error(_translateAuthError(res.error.message));
      return res.data;  // browser is now redirecting
    });
  }

  function logout() {
    return ensureClient().then(function () {
      return sb.auth.signOut();
    }).then(function () {
      cachedSession = null;
      cachedProfile = null;
      try { localStorage.removeItem(USER_CACHE_KEY); } catch (e) {}
    });
  }

  function currentUser() { return cachedProfile; }
  function isLoggedIn()  { return !!cachedProfile; }
  function currentUserId() { return cachedProfile ? cachedProfile.id : null; }

  function updateUser(patch) {
    if (!patch || typeof patch !== 'object') return Promise.resolve(cachedProfile);
    // §184 (데이빗 2026-06-04) — gear 는 profiles 컬럼이 없어 user_data 'gear' 로 저장.
    // 동기 반영 (저장 직후 currentUser().gear 를 읽는 기존 사용처 호환 — 옛 shim 과 동일 semantics).
    if ('gear' in patch) {
      var gearArr = Array.isArray(patch.gear) ? patch.gear : [];
      try { setUserData('gear', JSON.stringify(gearArr)); } catch (e) {}
      if (cachedProfile) {
        cachedProfile.gear = gearArr;
        try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cachedProfile)); } catch (e) {}
      }
      var rest = {}; var hasRest = false;
      for (var rk in patch) {
        if (rk !== 'gear' && Object.prototype.hasOwnProperty.call(patch, rk)) { rest[rk] = patch[rk]; hasRest = true; }
      }
      if (!hasRest) return Promise.resolve(cachedProfile);
      patch = rest;
    }
    // §187 (인프라#10 2026-06-04) — stance/phone/address/favoriteSpots(+favoriteSpot)
    // 는 profiles 컬럼이 없어 user_data 'profile_extra' 로 저장 (§184 gear 동일 패턴).
    // 동기 반영 — 저장 직후 currentUser() 를 읽는 사용처 (profile.html compact view 등) 호환.
    var hasExtra = false;
    for (var ei = 0; ei < EXTRA_PROFILE_FIELDS.length; ei++) {
      if (EXTRA_PROFILE_FIELDS[ei] in patch) { hasExtra = true; break; }
    }
    if (hasExtra) {
      var uid = currentUserId();
      var extraObj = uid ? _readProfileExtraCache(uid, cachedProfile && cachedProfile.email) : {};
      var rest2 = {}; var hasRest2 = false;
      for (var pk in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, pk)) continue;
        if (EXTRA_PROFILE_FIELDS.indexOf(pk) >= 0) {
          extraObj[pk] = patch[pk];
          if (cachedProfile) cachedProfile[pk] = patch[pk];
        } else {
          rest2[pk] = patch[pk]; hasRest2 = true;
          // favoriteSpot 은 profiles.favorite_spot_text 컬럼도 있어 양쪽 모두 기록
        }
      }
      // favoriteSpot 는 DB 컬럼도 존재 — DB patch 에도 유지 (extra 는 fallback 용)
      if ('favoriteSpot' in patch) { rest2.favoriteSpot = patch.favoriteSpot; hasRest2 = true; }
      try { setUserData('profile_extra', JSON.stringify(extraObj)); } catch (e) {}
      if (cachedProfile) {
        try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cachedProfile)); } catch (e) {}
      }
      if (!hasRest2) return Promise.resolve(cachedProfile);
      patch = rest2;
    }
    // §187 — DB 컬럼 매핑 필드도 동기 반영 (refreshProfile 완료 전 stale 읽기 방지)
    if (cachedProfile) {
      var SYNC_FIELDS = ['name', 'nickname', 'gender', 'birthYear', 'ridingStart', 'mainSports', 'favoriteSpot', 'avatarBase64'];
      var touched = false;
      for (var si = 0; si < SYNC_FIELDS.length; si++) {
        var sf = SYNC_FIELDS[si];
        if (sf in patch) { cachedProfile[sf] = patch[sf]; touched = true; }
      }
      if (touched) {
        try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cachedProfile)); } catch (e) {}
      }
    }
    return ensureClient().then(function () {
      if (!cachedSession) return null;
      var dbPatch = mapLegacyPatchToDb(patch);
      if (Object.keys(dbPatch).length === 0) return cachedProfile;
      return sb.from('profiles').update(dbPatch).eq('id', cachedSession.user.id)
        .then(function (res) {
          if (res.error) {
            console.warn('[DMJAuth §180] updateUser error', res.error);
            return cachedProfile;
          }
          return refreshProfile();
        });
    });
  }

  // legacy stub — Supabase 가 서버측 hash 처리
  function hashPassword(pw) {
    return Promise.resolve('');
  }

  // §179 — Supabase 이메일 기반 비밀번호 재설정
  // accountExists 는 client 측에서 확인 불가 (보안) → 항상 true 반환, 실제 검증은 서버측
  function accountExists(email) {
    return true;
  }

  function resetPassword(email, newPassword) {
    return ensureClient().then(function () {
      if (newPassword) {
        // 로그인 후 새 비밀번호로 변경
        if (!cachedSession) {
          return Promise.reject(new Error('비밀번호 변경은 로그인 상태에서만 가능합니다.'));
        }
        return sb.auth.updateUser({ password: String(newPassword) })
          .then(function (res) {
            if (res.error) throw new Error(_translateAuthError(res.error.message));
            return cachedProfile;
          });
      }
      // 이메일 reset 링크 발송
      return sb.auth.resetPasswordForEmail(String(email || '').trim(), {
        redirectTo: window.location.origin + '/password-reset.html'
      }).then(function (res) {
        if (res.error) throw new Error(_translateAuthError(res.error.message));
        return null;
      });
    });
  }

  function _translateAuthError(msg) {
    var m = String(msg || '').toLowerCase();
    if (m.indexOf('invalid login') >= 0 || m.indexOf('invalid credential') >= 0) return '이메일 또는 비밀번호가 일치하지 않습니다.';
    if (m.indexOf('user already registered') >= 0) return '이미 등록된 이메일입니다.';
    if (m.indexOf('email not confirmed') >= 0) return '이메일 인증을 먼저 완료해 주세요.';
    if (m.indexOf('rate limit') >= 0) return '잠시 후 다시 시도해 주세요. (요청이 너무 많습니다)';
    if (m.indexOf('weak password') >= 0 || m.indexOf('password') >= 0) return '비밀번호는 8자 이상이어야 합니다.';
    return msg;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 5) Per-user data API — localStorage 캐시 + Supabase sync
  // ─────────────────────────────────────────────────────────────────────
  function userKey(suffix) {
    var uid = currentUserId();
    return uid ? (USER_NS_PREFIX + uid + '_' + String(suffix)) : null;
  }

  // sync read — localStorage 캐시 (background sync 가 신선도 보장)
  function getUserData(suffix) {
    try {
      var k = userKey(suffix);
      if (k) return localStorage.getItem(k);
      return localStorage.getItem(ANON_NS_PREFIX + suffix);
    } catch (e) { return null; }
  }

  // sync write — localStorage + 백그라운드 Supabase sync
  function setUserData(suffix, value) {
    try {
      var v = String(value);
      var k = userKey(suffix);
      if (k) {
        localStorage.setItem(k, v);
        _scheduleCloudSync(suffix, v);
        return true;
      }
      localStorage.setItem(ANON_NS_PREFIX + suffix, v);
      return true;
    } catch (e) {
      console.warn('[DMJAuth §180] setUserData failed', suffix, e);
      return false;
    }
  }

  function removeUserData(suffix) {
    try {
      var k = userKey(suffix);
      if (k) {
        localStorage.removeItem(k);
        _scheduleCloudRemove(suffix);
      } else {
        localStorage.removeItem(ANON_NS_PREFIX + suffix);
      }
    } catch (e) {}
  }

  // 백그라운드 sync — 1초 debounce per suffix
  var _syncTimers = {};
  function _scheduleCloudSync(suffix, valueStr) {
    clearTimeout(_syncTimers[suffix]);
    _syncTimers[suffix] = setTimeout(function () {
      _cloudUpsert(suffix, valueStr).catch(function (e) {
        console.warn('[DMJAuth §180] cloud sync failed', suffix, e);
      });
    }, 1000);
  }
  function _scheduleCloudRemove(suffix) {
    clearTimeout(_syncTimers[suffix]);
    _syncTimers[suffix] = setTimeout(function () {
      _cloudRemove(suffix).catch(function () {});
    }, 1000);
  }

  function _cloudUpsert(suffix, valueStr) {
    return ensureClient().then(function () {
      if (!cachedSession) return;
      if (USER_DATA_SUFFIXES.indexOf(suffix) >= 0) {
        var data;
        try { data = JSON.parse(valueStr); } catch (e) { data = valueStr; }
        return sb.from('user_data').upsert({
          user_id: cachedSession.user.id,
          suffix: suffix,
          data: data
        }, { onConflict: 'user_id,suffix' });
      }
      // cart — special handling (별도 cart_items 테이블, Phase 12+ 에서 individual row 로 확장 예정)
      // Phase 1: 전체 cart 를 JSON 으로 user_data 처럼 저장 (cart_items 테이블은 향후 활용)
      if (suffix === 'cart') {
        var cartData;
        try { cartData = JSON.parse(valueStr); } catch (e) { cartData = []; }
        // cart_items 테이블에 sync — 기존 row 모두 삭제 후 재삽입 (단순화)
        return sb.from('cart_items').delete().eq('user_id', cachedSession.user.id)
          .then(function () {
            if (!Array.isArray(cartData) || cartData.length === 0) return;
            var rows = cartData.map(function (c) {
              return {
                user_id: cachedSession.user.id,
                product_id: String(c.productId || c.product_id || c.sku || 'unknown'),
                variant_size: c.size || c.variantSize || null,
                variant_color: c.color || c.variantColor || null,
                qty: Math.max(1, Math.min(99, Number(c.qty) || 1)),
                unit_price_krw: Math.max(0, Number(c.priceKRW || c.unitPriceKRW || c.price || 0)),
                notes: c.notes || null
              };
            });
            return sb.from('cart_items').insert(rows);
          });
      }
      // total_spend — profiles 테이블 컬럼으로 별도 처리
      if (suffix === 'total_spend') {
        return sb.from('profiles').update({
          total_spend_krw: Math.max(0, Number(valueStr) || 0)
        }).eq('id', cachedSession.user.id).then(function () { return refreshProfile(); });
      }
      // 기타 suffix — 무시 (legacy ad-hoc 데이터)
    });
  }

  function _cloudRemove(suffix) {
    return ensureClient().then(function () {
      if (!cachedSession) return;
      if (USER_DATA_SUFFIXES.indexOf(suffix) >= 0) {
        return sb.from('user_data').delete().match({
          user_id: cachedSession.user.id,
          suffix: suffix
        });
      }
      if (suffix === 'cart') {
        return sb.from('cart_items').delete().eq('user_id', cachedSession.user.id);
      }
    });
  }

  // 로그인 시 cloud → localStorage pull (다른 디바이스에서 변경된 데이터 동기화)
  function pullUserDataFromCloud() {
    return ensureClient().then(function () {
      if (!cachedSession) return;
      var uid = cachedSession.user.id;
      return Promise.all([
        sb.from('user_data').select('suffix, data').eq('user_id', uid),
        sb.from('cart_items').select('*').eq('user_id', uid)
      ]).then(function (results) {
        var udRes = results[0];
        var cartRes = results[1];
        // user_data 8종
        if (!udRes.error && Array.isArray(udRes.data)) {
          udRes.data.forEach(function (row) {
            var k = USER_NS_PREFIX + uid + '_' + row.suffix;
            var v = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
            try { localStorage.setItem(k, v); } catch (e) {}
          });
        }
        // cart_items → cart suffix 로 reconstruct
        if (!cartRes.error && Array.isArray(cartRes.data)) {
          var legacyCart = cartRes.data.map(function (row) {
            return {
              productId: row.product_id,
              size: row.variant_size,
              color: row.variant_color,
              qty: row.qty,
              priceKRW: row.unit_price_krw,
              unitPriceKRW: row.unit_price_krw,
              notes: row.notes,
              addedAt: row.added_at
            };
          });
          var ckey = USER_NS_PREFIX + uid + '_cart';
          try { localStorage.setItem(ckey, JSON.stringify(legacyCart)); } catch (e) {}
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 6) §175 누적 구매 자동 승급 — DB trigger 가 처리, 클라이언트는 trigger 발생
  // ─────────────────────────────────────────────────────────────────────
  var TIER_THRESHOLD_DANMUJI = 1000000;

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
        total += Number(o.totalKRW) || 0;
      }
      // 백엔드 profiles.total_spend_krw 업데이트 → DB trigger profiles_auto_tier 가 등급 자동 변경
      setUserData('total_spend', String(total));   // _cloudUpsert 가 'total_spend' branch 로 처리
      return total;
    } catch (e) {
      console.warn('[DMJAuth §180 §175] recomputeTotalSpend failed', e);
      return 0;
    }
  }

  function getTotalSpend() {
    return cachedProfile ? Number(cachedProfile.totalSpend || 0) : 0;
  }

  function autoUpgradeTier() {
    // DB trigger profiles_auto_tier 가 자동 처리. recompute → refresh.
    recomputeTotalSpend();
    return ensureClient().then(refreshProfile);
  }

  // ─────────────────────────────────────────────────────────────────────
  // 7) Public DMJAuth API — 기존 21개 사용처와 100% 호환
  // ─────────────────────────────────────────────────────────────────────
  window.DMJAuth = {
    // Core auth
    signup: signup,
    login: login,
    signInWithKakao: signInWithKakao,    // §180 신규
    logout: logout,
    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    updateUser: updateUser,
    hashPassword: hashPassword,
    // §179 password reset
    accountExists: accountExists,
    resetPassword: resetPassword,
    // §169-K per-user namespace
    currentUserId: currentUserId,
    userKey: userKey,
    getUserData: getUserData,
    setUserData: setUserData,
    removeUserData: removeUserData,
    // §175 tier
    recomputeTotalSpend: recomputeTotalSpend,
    getTotalSpend: getTotalSpend,
    autoUpgradeTier: autoUpgradeTier,
    TIER_THRESHOLD_DANMUJI: TIER_THRESHOLD_DANMUJI,
    // §169-K legacy stubs — Supabase 환경에서 no-op
    _readUsers: function () { return {}; },
    _writeUsers: function () {},
    _migrateGlobalToUser: function () {},
    _migrateAnonToUser: function () {},
    _clearStaleGlobals: function () {},
    anonOwnedByCurrentSession: function () { return true; },
    _clearAnonBucket: function () {},
    // §180 신규 — 고급 접근용
    _supabase: function () { return sb; },
    _refreshProfile: refreshProfile,
    _pullUserDataFromCloud: pullUserDataFromCloud,
    _ensureClient: ensureClient
  };

  // ─────────────────────────────────────────────────────────────────────
  // 8) Init — client 부팅 + OAuth callback 자동 감지
  // ─────────────────────────────────────────────────────────────────────
  // §426 — 회원 모드 비활성화 시 자동 부팅 스킵 (paused 프로젝트 network·콘솔 에러 방지).
  if (MEMBER_MODE_DISABLED) {
    // no-op: DMJAuth API 는 노출돼 있으나 자동으로 client 를 띄우지 않는다.
    return;
  }
  ensureClient().then(function () {
    if (cachedSession) {
      // §187 — pull 후 refreshProfile 재실행 (profile_extra 병합 + dmj-auth-change 재통지)
      return pullUserDataFromCloud().then(function () {
        return refreshProfile();
      }).then(function () {
        try {
          window.dispatchEvent(new CustomEvent('dmj-auth-change', {
            detail: { event: 'PROFILE_SYNCED', isLoggedIn: true }
          }));
        } catch (e) {}
      });
    }
  }).catch(function (e) {
    console.warn('[DMJAuth §180] init failed', e);
  });

})();
