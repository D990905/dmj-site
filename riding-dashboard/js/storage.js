/* ============================================================
 * storage.js — 다중 세션 저장 (localStorage)
 * 컴팩트 요약 레코드만 저장 (트랙 원본 X) — 시즌 progression·세션
 * 비교·개인 베스트용. 브라우저 로컬 전용, 서버 전송 없음.
 * ============================================================ */
(function (global) {
  'use strict';

  /* ============================================================
   * §412 (Alex Park #4 · 2026-06-11) — per-user namespace
   *   CRITICAL: 옥대표님 verbatim — "내계정이랑 지인 계정 두개따로 로긴해봤는데
   *   최근 라이딩 기록 4개가 같으네." 모든 rd_* 키가 브라우저 전역이라 같은
   *   브라우저에서 계정이 바뀌어도 데이터가 공유되던 격리 파탄.
   *
   *   해결: 키를 'rd_<uid>_*' 로 namespace. uid 는 DMJAuth.currentUserId()
   *   (supabase-auth.js). 비로그인(anon) = 'rd_anon_*'. DMJAuth 자체가
   *   없는 환경(node selftest)은 legacy bare 'rd_*' 그대로 — 회귀 방지.
   *
   *   suffix 표:  sessions_v1 · track_v1_<id> · edits_v1 · titles_v1 ·
   *               videosync_v1 · video_blobs_v1(IndexedDB) · rider_v1
   *   → nsPrefix() + suffix.  browser 로그인 시 'rd_<uid>_sessions_v1' 형태로,
   *     profile.html §413-3 reader 가 기대하는 포맷과 정확히 일치.
   * ============================================================ */
  function _authLayerPresent() {
    return !!(global.DMJAuth && typeof global.DMJAuth.currentUserId === 'function');
  }
  function _currentUid() {
    try {
      if (_authLayerPresent()) return global.DMJAuth.currentUserId() || null;
    } catch (e) {}
    return null;
  }
  /* namespace prefix. DMJAuth 부재(node) = legacy bare 'rd_' (selftest 무손상).
     로그인 = 'rd_<uid>_', 비로그인 = 'rd_anon_'. */
  function nsPrefix() {
    if (!_authLayerPresent()) return 'rd_';
    var uid = _currentUid();
    return 'rd_' + (uid || 'anon') + '_';
  }
  function K_SESSIONS()    { return nsPrefix() + 'sessions_v1'; }
  function K_TRACK_PREFIX(){ return nsPrefix() + 'track_v1_'; }
  function K_TRACK(id)     { return K_TRACK_PREFIX() + id; }
  function K_EDITS()       { return nsPrefix() + 'edits_v1'; }
  function K_TITLES()      { return nsPrefix() + 'titles_v1'; }
  function K_VIDEO()       { return nsPrefix() + 'videosync_v1'; }
  function K_RIDER()       { return nsPrefix() + 'rider_v1'; }
  /* §487 세션 문답 답변 — 트랙만 봐서는 갈리지 않는 것들(왜 느렸는지)의
     라이더 확인. 세션 시그니처 → { questionId: optionKey }. */
  function K_QA()          { return nsPrefix() + 'sessionqa_v1'; }
  /* §457 육상 운동 기록 — 세일링 아닌 활동(조깅·웨이트·요가…).
     세션(K_SESSIONS)과 분리해 둔다: 트랙도 분석도 없고, 부하만
     같은 원장에 합쳐 CTL/ATL/TSB 를 만든다. */
  function K_WORKOUTS()    { return nsPrefix() + 'workouts_v1'; }
  /* §463 라이딩 부하 자동 기록 — 파일을 열기만 해도 심박에서 부하가
     계산되면 원장에 남긴다. 세션을 '저장' 하지 않아도 훈련부하 추세가
     비지 않게 하려는 것. 세션 시그니처를 키로 써서 같은 파일을 여러 번
     열어도 한 번만 센다. */
  function K_RIDELOADS()   { return nsPrefix() + 'rideloads_v1'; }
  function videoDbName()   { return nsPrefix() + 'video_blobs_v1'; }

  /* §412 — legacy(전역) → uid namespace 1회 마이그레이션 플래그 (브라우저 전역).
     '옥대표님 verbatim a' 옵션: 기존 전역 데이터를 첫 로그인 사용자의
     namespace 로 옮긴다. 플래그 = uid@epoch. 한 번 set 되면 재실행 안 함. */
  var MIGRATION_FLAG = 'rd_legacy_migrated_v1';
  var _migrationTriedFor = {};   /* in-memory: uid 별 1회만 localStorage 프로빙 */

  var MAX_SESSIONS = 50;
  /* 트랙 1건 상한 — 공백 압축 후에도 이보다 크면 요약만 저장한다.
     realistic 세션(수 시간·1Hz GPS)은 압축 후 이 한도 안에 들어와
     전부 '다시 보기'가 가능하다. 전체 저장 용량은 아래
     storeTrackWithEviction 이 오래된 트랙을 비우며 따로 관리한다. */
  var MAX_TRACK_CHARS = 8000000;

  /* §412 — legacy 전역 데이터 → 로그인 사용자 namespace 마이그레이션.
     로그인(uid present) + 미마이그레이션(flag 없음) + 전역 bare 키 존재 시 1회 실행.
     verified-copy-then-remove: namespace 로 복사 → 읽기 검증 → bare 제거.
     bare 제거가 핵심 — profile.html dual-key reader / 스킬위젯이 bare 를
     무조건 읽어 다음 사용자에게 누수되던 경로를 끊는다. sessions 요약본은
     rd_legacybak_sessions_v1 로 백업(롤백용). track 은 namespace 복사본이 보존본.
     비로그인/DMJAuth 부재(node)/이미 마이그레이션 = no-op. */
  function migrateLegacyIfNeeded() {
    var ls; try { ls = global.localStorage; } catch (e) { ls = null; }
    if (!ls) return { migrated: false, reason: 'no-localStorage' };
    if (!_authLayerPresent()) return { migrated: false, reason: 'no-auth-layer' };
    var uid = _currentUid();
    if (!uid) return { migrated: false, reason: 'not-logged-in' };
    if (_migrationTriedFor[uid]) return { migrated: false, reason: 'checked' };
    try {
      if (ls.getItem(MIGRATION_FLAG)) {
        _migrationTriedFor[uid] = true;
        return { migrated: false, reason: 'already-migrated' };
      }
      var SIMPLE = ['rd_sessions_v1', 'rd_edits_v1', 'rd_titles_v1', 'rd_videosync_v1', 'rd_rider_v1'];
      var legacy = [];
      SIMPLE.forEach(function (k) { if (ls.getItem(k) != null) legacy.push(k); });
      for (var i = 0; i < ls.length; i++) {
        var lk = ls.key(i);
        if (lk && lk.indexOf('rd_track_v1_') === 0) legacy.push(lk);
      }
      if (!legacy.length) {
        _migrationTriedFor[uid] = true;
        return { migrated: false, reason: 'no-legacy-data' };
      }
      var prefix = 'rd_' + uid + '_';
      var moved = [], failed = [];
      for (var j = 0; j < legacy.length; j++) {
        var bare = legacy[j];
        var nk = prefix + bare.slice(3);     /* 'rd_sessions_v1' → 'rd_<uid>_sessions_v1' */
        var val = ls.getItem(bare);
        if (val == null) continue;
        if (ls.getItem(nk) == null) {        /* 기존 namespace 데이터 clobber 금지 */
          try { ls.setItem(nk, val); } catch (e) { failed.push(bare); continue; }
          if (ls.getItem(nk) !== val) { failed.push(bare); continue; }   /* 복사 검증 */
        }
        if (bare === 'rd_sessions_v1') {     /* 요약본 백업(롤백용·작음) */
          try { ls.setItem('rd_legacybak_sessions_v1', val); } catch (e) {}
        }
        try { ls.removeItem(bare); } catch (e) {}   /* verified copy 이후 bare 제거 */
        moved.push(bare);
      }
      if (!failed.length) {                  /* 부분 실패 시 flag 미설정 → 다음 진입 재시도 */
        try { ls.setItem(MIGRATION_FLAG, uid + '@' + (global.Date && Date.now ? Date.now() : 0)); } catch (e) {}
        _migrationTriedFor[uid] = true;
      }
      return { migrated: moved.length > 0, uid: uid, moved: moved, failed: failed };
    } catch (e) {
      return { migrated: false, reason: 'error', error: String(e) };
    }
  }

  function readAll() {
    migrateLegacyIfNeeded();   /* §412 — 첫 read 시 자동 마이그레이션 (in-memory guard 로 저비용) */
    try {
      var raw = global.localStorage ? global.localStorage.getItem(K_SESSIONS()) : null;
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeAll(arr) {
    try {
      global.localStorage.setItem(K_SESSIONS(), JSON.stringify(arr));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: '브라우저 저장 공간이 가득 찼습니다. 오래된 세션을 삭제해 주세요.' };
    }
  }

  /* ---------- 세션별 원본 GPX 트랙 (다시 보기용) ----------
   * 요약 레코드(rd_sessions_v1)와 분리해 세션마다 별도 키에 저장한다.
   * 큰 트랙 하나가 전체 목록 저장을 막지 않도록 분리한 것이다.
   * 다시 보기 = 저장된 GPX 를 분석 파이프라인에 그대로 재투입. */
  function trackKey(id) { return K_TRACK(id); }
  function storeTrackRaw(id, text) {
    global.localStorage.setItem(trackKey(id), text);
  }
  function removeTrack(id) {
    try { global.localStorage.removeItem(trackKey(id)); } catch (e) {}
  }
  function loadTrack(id) {
    try {
      var t = global.localStorage ? global.localStorage.getItem(trackKey(id)) : null;
      return (typeof t === 'string' && t) ? t : null;
    } catch (e) { return null; }
  }
  /* GPX 트랙을 저장 전 가볍게 압축한다 — 태그 사이의 들여쓰기·줄바꿈
   * 공백을 제거. 기기가 내보낸 GPX 는 들여쓰기가 용량의 20~40% 를
   * 차지하는데, 태그 사이 공백은 XML 에서 무의미하므로 제거해도
   * DOMParser 재분석 결과가 완전히 동일하다 ('다시 보기' 무손실 압축). */
  function compactGpx(text) {
    if (typeof text !== 'string') return text;
    /* §434 — 융합 세션은 XML 이 아니라 컴팩트 JSON(RDFUSED1) 으로 저장된다.
       XML 공백 압축을 적용하면 JSON 이 손상되므로 XML 일 때만 압축한다. */
    if (text.charAt(0) !== '<') return text.trim();
    return text.replace(/>\s+</g, '><').trim();
  }
  /* 트랙 저장 — 용량 초과 시 오래된 트랙부터 비우며 재시도한다.
   * arr: 현재 세션 목록(새 레코드 포함) — 비워진 레코드는 hasTrack=false 로 갱신. */
  function storeTrackWithEviction(id, text, arr) {
    try { storeTrackRaw(id, text); return true; }
    catch (e) { /* 용량 초과 — 아래에서 오래된 트랙 정리 */ }
    var evictable = arr.filter(function (r) { return r.id !== id && r.hasTrack; })
                       .sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
    for (var i = 0; i < evictable.length; i++) {
      removeTrack(evictable[i].id);
      evictable[i].hasTrack = false;
      try { storeTrackRaw(id, text); return true; }
      catch (e2) { /* 아직 부족 — 계속 비운다 */ }
    }
    return false;
  }

  /* v2 데이터 주도 스킬 평가용 추출 — skill-level.js evaluate() 가 소비.
     택킹/자이빙 상위50% 효율 × 진입 택(P/S). count 0 이면 null. */
  function extractSkillGroups(groups) {
    if (!groups) return null;
    function cell(t, side) {
      var c = groups[t] && groups[t][side];
      if (!c || !(c.count > 0) || c.effTop50 == null) return null;
      return { effTop50: c.effTop50, count: c.count };
    }
    return {
      tack: { P: cell('tack', 'P'), S: cell('tack', 'S') },
      gybe: { P: cell('gybe', 'P'), S: cell('gybe', 'S') }
    };
  }
  /* 타깃 폴라 누적용 — 세션의 빈별 컴팩트 폴라(택 합산 95퍼센타일 속도·
     표본수). analysis.js buildTargetPolar() 가 그대로 소비하는 포맷이다.
     풍향이 없으면 폴라 자체가 없어 null. 저장 용량 절약을 위해 속도는
     소수점 3자리로 반올림한다(약 0.5KB/세션). */
  function extractPolarProfile(analysis) {
    var polar = analysis && analysis.polar;
    if (!polar || !polar.combined) return null;
    return {
      binDeg: polar.binDeg,
      bins: polar.combined.map(function (bn) {
        return { count: bn.count,
                 p95Ms: Math.round(bn.p95Ms * 1000) / 1000,
                 /* §475 풍속대 폴라 격자용 — p95 는 표본이 얇으면 튄다 */
                 p90Ms: bn.p90Ms != null ? Math.round(bn.p90Ms * 1000) / 1000 : null };
      })
    };
  }

  /* 풍상 주행 평균 TWA(close-hauled 각 프록시) — 풍향 확정 시에만 존재 */
  function extractUpwindTwa(analysis) {
    var w = analysis.wind;
    if (w && w.tackSplit && w.tackSplit.upwind && w.tackSplit.upwind.all &&
        w.tackSplit.upwind.all.twa && w.tackSplit.upwind.all.twa.avg > 0) {
      return w.tackSplit.upwind.all.twa.avg;
    }
    return null;
  }

  /* 분석 결과에서 컴팩트 레코드 생성 */
  /* §490 — 히스토그램에서 시간가중 상위 X% 평균 속도.
     히스토그램은 **분석 대상 구간**(기록 공백·제외 구간을 뺀 레그)에서
     만들어지므로, 여기서 나오는 값은 자동으로 "널 구간 제외" 다.
     상위 50/20% 는 정지·표류 구간을 정의상 더 걸러낸다 —
     세션끼리 비교할 때 쉬는 시간 길이에 휘둘리지 않는 지표다. */
  function topPercentSpeedMs(analysis, pct) {
    var h = (analysis && analysis.histogram) || [];
    if (!h.length || !(pct > 0)) return null;
    var total = 0;
    h.forEach(function (b) { total += (b.seconds || 0); });
    if (!(total > 0)) return null;
    var want = total * (pct / 100);
    /* 빠른 쪽부터 채운다 */
    var bins = h.slice().sort(function (a, b) {
      return ((b.fromKt + b.toKt) / 2) - ((a.fromKt + a.toKt) / 2);
    });
    var acc = 0, sum = 0;
    for (var i = 0; i < bins.length && acc < want; i++) {
      var sec = bins[i].seconds || 0;
      if (sec <= 0) continue;
      var use = Math.min(sec, want - acc);
      var mid = (bins[i].fromKt + bins[i].toKt) / 2;
      sum += mid * use; acc += use;
    }
    if (!(acc > 0)) return null;
    return (sum / acc) / 1.94384;   /* kt → m/s (레코드는 m/s 규약) */
  }

  function buildRecord(meta, analysis) {
    var s = analysis.summary || {};
    var ms = analysis.maneuverStats || {};
    function pk(arr, w) {
      for (var i = 0; i < (arr || []).length; i++) if (arr[i].windowSec === w) return arr[i].speedMs;
      return 0;
    }
    function db(arr, d) {
      for (var i = 0; i < (arr || []).length; i++) if (arr[i].distanceM === d) return arr[i].speedMs;
      return 0;
    }
    return {
      id: 'rd_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      savedAt: Date.now(),
      name: meta.name || '라이딩 세션',
      /* 편집본 여부 — 제목 본문과 분리한 상태 플래그. 예전에는 이름 끝에
         ' · 편집본' 접미사를 붙여 저장했으나, 제목을 사용자가 직접
         편집하게 되면서 편집 상태는 별도 플래그로 분리한다(헤더 배지용). */
      edited: !!meta.edited,
      dateEpoch: meta.dateEpoch || Date.now(),
      sport: meta.sport || 'wingfoil',
      windDir: meta.windDir != null ? meta.windDir : null,
      windSpeedKt: meta.windSpeedKt != null ? meta.windSpeedKt : null,
      durationSec: s.totalDurationSec || 0,
      movingTimeSec: s.movingTimeSec || 0,
      distanceM: s.totalDistanceM || 0,
      maxSpeedMs: s.maxSpeedMs || 0,
      avgSpeedMovingMs: s.avgSpeedMovingMs || 0,
      /* §490 시즌 흐름용 — 상위 50/20% 평균 속도. 히스토그램(=분석 구간)에서
         뽑으므로 기록 공백·제외 구간이 이미 빠져 있고, 상위 X% 라서
         정지·표류가 정의상 더 걸러진다. */
      sogTop50Ms: topPercentSpeedMs(analysis, 50),
      sogTop20Ms: topPercentSpeedMs(analysis, 20),
      activeRatio: s.activeRatio || 0,
      /* §435 — 포일링(활주) 거리·시간 세션 트렌드 스파크라인용. */
      activeDistanceM: s.activeDistanceM != null ? s.activeDistanceM : null,
      activeTimeSec: s.activeTimeSec != null ? s.activeTimeSec : null,
      peak2sMs: pk(analysis.peaks, 2),
      peak10sMs: pk(analysis.peaks, 10),
      best500mMs: db(analysis.distanceBests, 500),
      best1nmMs: db(analysis.distanceBests, 1852),
      alphaMs: (analysis.alpha && analysis.alpha.speedMs) || 0,
      tackCount: ms.tack || 0,
      gybeCount: ms.gybe || 0,
      maneuverTotal: ms.total || 0,
      avgLossPct: ms.avgLossPct != null ? ms.avgLossPct : null,
      avgRecoverySec: ms.avgRecoverySec != null ? ms.avgRecoverySec : null,
      avgEfficiency: ms.avgEfficiency != null ? ms.avgEfficiency : null,
      avgTurnRateDegSec: ms.avgTurnRateDegSec != null ? ms.avgTurnRateDegSec : null,
      /* v2 데이터 주도 스킬 평가 입력 — skill-level.js evaluate() 가 소비 */
      skillGroups: extractSkillGroups(ms.groups),
      upwindTwaAvg: extractUpwindTwa(analysis),
      /* 타깃 폴라 누적용 빈별 폴라 프로파일 — 풍향 미설정 세션은 null.
         analysis.js buildTargetPolar() 가 이 레코드들을 누적해
         개인 베스트 타깃 곡선을 만든다. */
      polarProfile: extractPolarProfile(analysis),
      /* §474 타깃 창 — 상위 30% 만 저장한다(타깃 계산에 쓰이는 건 그것뿐).
         2시간 세션이 창 ~350개 → 저장 ~105개 × 3숫자 ≈ 2KB. */
      targetWindows: analysis.targetWindows || null,
      /* VPS — meta.vps 로 전달 (분석에는 없는 라이더 입력 기반 점수).
         산출 불가 시 null. SPS 카드 5장(풍상·풍하·종합·택킹·자이빙)의
         '동일 풍속 영역대 평균 대비' 델타 비교에 쓰인다 (windSpeedKt
         로 같은 풍속 밴드 세션을 골라 평균낸다 · 2026-05-23). */
      vpsOverall: (meta.vps && meta.vps.overall != null) ? meta.vps.overall : null,
      vpsUpwind: (meta.vps && meta.vps.upwind != null) ? meta.vps.upwind : null,
      vpsDownwind: (meta.vps && meta.vps.downwind != null) ? meta.vps.downwind : null,
      vpsTack: (meta.vps && meta.vps.tack != null) ? meta.vps.tack : null,
      vpsGybe: (meta.vps && meta.vps.gybe != null) ? meta.vps.gybe : null,
      /* 스킬-심박수 분석 — 세션 회복 지수(bpm/분). 회전 후 심박 회복
         속도로, 세션이 쌓이면 progression 그래프에서 장기 추세를
         본다 (심혈관 회복 능력 모니터링 · Danny 검토 2026-05-23).
         HR 미기록·회복 표본 부족 세션은 null. */
      hrRecoveryIndex: (meta.hrRecoveryIndex != null) ? meta.hrRecoveryIndex : null,
      /* TRIMP (Training Impulse — Banister 1991) — 세션의 운동 부하.
         An.computeTRIMP(session, riderProfile) 가 산출한 trimp 값을
         caller (app.js) 가 meta.trimp 로 전달. HR 미기록·rider profile
         부족 세션은 null. computeFitnessTrend (CTL/ATL/TSB) 가 이 필드를
         일별 합산해 EWMA 계산한다. */
      trimp: (meta.trimp != null) ? meta.trimp
           : (meta.workload && meta.workload.trimp != null) ? meta.workload.trimp
           : null,
      /* §448 — meta.workload = app.js sessionWorkload() 결과.
         AU 는 3-tier(심박 Banister / MET / 체감강도) 어느 쪽이든 같은
         Banister scale 로 정렬돼 있어 trimp 필드에 그대로 담는다.
         loadMethod 로 어떤 근거였는지 남겨 화면에서 구분해 표시한다.
         meta.trimp 를 직접 준 호출부(구경로)가 우선. */
      loadMethod: (meta.workload && meta.workload.method) || null,
      /* §463 — 세션 시그니처. 자동 기록된 부하와 저장된 세션이 같은
         라이딩인지 가리는 데 쓴다(중복 계상 방지). */
      sig: meta.sig ? String(meta.sig) : null
    };
  }

  function saveSession(meta, analysis) {
    var rec = buildRecord(meta, analysis);
    var arr = readAll();
    arr.push(rec);
    arr.sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
    if (arr.length > MAX_SESSIONS) {
      /* 상한 초과로 밀려나는 오래된 세션 — 트랙도 함께 정리 */
      arr.slice(0, arr.length - MAX_SESSIONS).forEach(function (d) { removeTrack(d.id); });
      arr = arr.slice(arr.length - MAX_SESSIONS);
    }
    /* 원본 GPX 저장 — '다시 보기' 재분석용. 공백 압축 후 저장하며,
       압축 후에도 상한을 넘거나 저장에 실패하면 요약만 저장된다. */
    rec.hasTrack = false;
    var gpx = (typeof meta.gpxText === 'string') ? compactGpx(meta.gpxText) : null;
    if (gpx && gpx.length <= MAX_TRACK_CHARS) {
      rec.hasTrack = storeTrackWithEviction(rec.id, gpx, arr);
    }
    var w = writeAll(arr);
    return w.ok ? { ok: true, record: rec } : w;
  }

  function listSessions() {
    return readAll().sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
  }
  function deleteSession(id) {
    removeTrack(id);
    var arr = readAll().filter(function (r) { return r.id !== id; });
    return writeAll(arr);
  }
  function clearAll() {
    /* 저장된 GPX 트랙 키도 전부 제거 */
    try {
      var ls = global.localStorage, kill = [], tp = K_TRACK_PREFIX();
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(tp) === 0) kill.push(k);
      }
      kill.forEach(function (k) { ls.removeItem(k); });
    } catch (e) {}
    return writeAll([]);
  }

  /* 개인 베스트 — 저장된 모든 세션 통틀어. 각 기록은 그 기록을 세운
     세션의 id·hasTrack 도 함께 담아, 대시보드에서 '최고 기록 타일
     클릭 → 그 세션 분석으로 이동'을 가능하게 한다 (Danny §A2). */
  function personalBests() {
    var arr = readAll();
    if (!arr.length) return null;
    var metrics = ['maxSpeedMs', 'peak2sMs', 'peak10sMs', 'best500mMs', 'best1nmMs',
                   'alphaMs', 'avgSpeedMovingMs', 'distanceM'];
    var best = {};
    metrics.forEach(function (m) {
      var top = null;
      arr.forEach(function (r) {
        if (r[m] != null && (top == null || r[m] > top.value)) {
          top = { value: r[m], sessionName: r.name, dateEpoch: r.dateEpoch,
                  sessionId: r.id, hasTrack: !!r.hasTrack };
        }
      });
      best[m] = top;
    });
    return best;
  }

  /* 커리어 누적 통계 — 저장된 모든 세션 통틀어 (Danny §A2).
     누적 합계(거리·시간·횟수)와 누적 데이터의 평균을 산출한다.
     평균 속도는 세션 평균의 단순평균이 아니라 누적 거리 ÷ 누적
     이동시간으로 — 짧은 세션이 과대대표되지 않게(과학적 집계). */
  function careerStats() {
    var arr = readAll();
    if (!arr.length) return null;
    var totDist = 0, totMoving = 0, totDuration = 0;
    arr.forEach(function (r) {
      totDist += r.distanceM || 0;
      totMoving += r.movingTimeSec || 0;
      totDuration += r.durationSec || 0;
    });
    var n = arr.length;
    return {
      sessionCount: n,
      totalDistanceM: totDist,
      totalMovingSec: totMoving,
      totalDurationSec: totDuration,
      avgSpeedMs: totMoving > 0 ? totDist / totMoving : 0,
      avgDistanceM: n > 0 ? totDist / n : 0,
      avgMovingSec: n > 0 ? totMoving / n : 0
    };
  }

  /* ---------- 트랙 편집 상태 (세션 시그니처별) ---------- */
  function readEdits() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(K_EDITS()) : null;
      var o = raw ? JSON.parse(raw) : {};
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }
  function isEmptyEdit(e) {
    if (!e) return true;
    return (e.trimStart == null) && (e.trimEnd == null) &&
           (!e.excludeRanges || !e.excludeRanges.length);
  }
  function saveEditState(sig, editState) {
    var all = readEdits();
    if (isEmptyEdit(editState)) delete all[sig];
    else all[sig] = editState;
    try { global.localStorage.setItem(K_EDITS(), JSON.stringify(all)); return { ok: true }; }
    catch (e) { return { ok: false }; }
  }
  function loadEditState(sig) {
    var e = readEdits()[sig];
    return isEmptyEdit(e) ? null : e;
  }

  /* ---------- 사용자 지정 세션 제목 (세션 시그니처별) ----------
   * 헤더의 세션 제목은 본래 파일명에서 자동 생성되지만(기술적·난해),
   * 사용자가 직접 다듬은 제목은 세션 시그니처별로 저장해 같은 트랙을
   * 다시 불러와도 유지한다. 편집 상태(rd_edits_v1)와 같은 패턴 —
   * 시그니처는 트랙 구조에서 나오므로 같은 GPX 는 항상 같은 키를 얻어,
   * 새로 업로드하든 '다시 보기' 하든 편집한 제목이 그대로 복원된다.
   * 빈 제목을 저장하면 항목을 지운다 = 파일명 기반 자동 제목으로 복귀. */
  function readTitles() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(K_TITLES()) : null;
      var o = raw ? JSON.parse(raw) : {};
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }
  function saveSessionTitle(sig, title) {
    if (!sig) return { ok: false };
    var all = readTitles();
    var t = (typeof title === 'string') ? title.trim() : '';
    if (!t) delete all[sig];          /* 빈 제목 = 자동 제목으로 복귀 */
    else all[sig] = t;
    try { global.localStorage.setItem(K_TITLES(), JSON.stringify(all)); return { ok: true }; }
    catch (e) { return { ok: false }; }
  }
  function loadSessionTitle(sig) {
    if (!sig) return null;
    var t = readTitles()[sig];
    return (typeof t === 'string' && t.trim()) ? t : null;
  }

  /* ---------- 영상 ↔ 데이터 동기 배치 (세션 시그니처별) ----------
   * 라이딩 리플레이의 영상 레이어용. 영상 파일 자체는 브라우저 보안상
   * 저장할 수 없으므로(로컬 object URL 은 휘발성) 클립별 수동 배치값만
   * 세션 시그니처별로 저장한다. 같은 세션에 같은 영상을 다시 올리면
   * 맞춰 둔 배치가 클립 파일명별로 복원된다 — "같은 작업 반복" 회피.
   *   data.clips    = { 파일명: 시작경과초, ... } (다중 클립, 2026-05-23)
   *   data.offsetSec = 단일 영상 오프셋 (구버전 호환 — 읽기만) */
  function readVideoSyncAll() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(K_VIDEO()) : null;
      var o = raw ? JSON.parse(raw) : {};
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }
  function saveVideoSync(sig, data) {
    if (!sig) return { ok: false };
    var all = readVideoSyncAll();
    if (data && data.clips && typeof data.clips === 'object' &&
        Object.keys(data.clips).length) {
      all[sig] = { clips: data.clips };
    } else if (data && data.offsetSec != null && isFinite(data.offsetSec)) {
      all[sig] = { offsetSec: data.offsetSec };          /* 구버전 호환 */
    } else {
      delete all[sig];                                   /* 빈 배치 = 항목 제거 */
    }
    try { global.localStorage.setItem(K_VIDEO(), JSON.stringify(all)); return { ok: true }; }
    catch (e) { return { ok: false }; }
  }
  function loadVideoSync(sig) {
    if (!sig) return null;
    var d = readVideoSyncAll()[sig];
    if (!d || typeof d !== 'object') return null;
    if (d.clips && typeof d.clips === 'object') return d;
    if (d.offsetSec != null && isFinite(d.offsetSec)) return d;
    return null;
  }

  /* ---------- 영상 클립 blob 영구 보존 (IndexedDB) — §189 (샘 2026-06-04) ----------
   * 리플레이에 올린 영상 파일 자체를 IndexedDB 에 보존한다. 기존
   * rd_videosync_v1 (localStorage) 은 "배치값"만 저장해, 재방문 시
   * 영상을 다시 올려야 했다 — blob 까지 저장해 "저장한 내용이 모두
   * 그대로" 남게 한다. localStorage 는 문자열 전용·~5MB 라 영상 blob
   * 에 부적합하므로 IndexedDB 를 쓴다.
   *   DB: rd_video_blobs_v1 / objectStore: clips
   *   key = sessionSig + '::' + 파일명 (keyPath 없음 — out-of-line key)
   *   value = { sig, name, type, lastModified, blob }
   * 전부 Promise 기반. IndexedDB 미지원·실패 시 reject — caller 가
   * try/catch(.catch) 로 흡수해 리플레이 본 기능은 절대 깨지 않는다. */
  var VIDEO_DB_STORE = 'clips';
  var videoDbPromise = null;
  var videoDbOpenName = null;   /* §412 — 현재 열린 DB 이름. uid 바뀌면 재오픈. */
  function openVideoDb() {
    /* §189 — DB 연결은 1회 열어 재사용. 실패 시 promise 캐시를 비워
       다음 호출에서 재시도할 수 있게 한다.
       §412 — DB 이름이 per-user namespace 라 로그인/로그아웃으로 uid 가
       바뀌면 캐시된 핸들이 옛 사용자 DB 를 가리킨다. 이름이 달라지면
       새로 연다 (옛 connection 은 GC 에 맡김). */
    var name = videoDbName();
    if (videoDbPromise && videoDbOpenName === name) return videoDbPromise;
    videoDbOpenName = name;
    videoDbPromise = new Promise(function (resolve, reject) {
      try {
        var idb = global.indexedDB;
        if (!idb) { reject(new Error('IndexedDB unavailable')); return; }
        var req = idb.open(name, 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(VIDEO_DB_STORE)) {
            db.createObjectStore(VIDEO_DB_STORE);
          }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('IndexedDB open failed')); };
        req.onblocked = function () { reject(new Error('IndexedDB open blocked')); };
      } catch (e) { reject(e); }
    });
    videoDbPromise['catch'](function () { videoDbPromise = null; videoDbOpenName = null; });
    return videoDbPromise;
  }
  function videoBlobKey(sig, name) { return String(sig) + '::' + String(name); }
  function videoTx(mode, fn) {
    /* §189 — 트랜잭션 보일러플레이트. fn(store, resolve, reject) */
    return openVideoDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          var tx = db.transaction(VIDEO_DB_STORE, mode);
          var store = tx.objectStore(VIDEO_DB_STORE);
          tx.onerror = function () { reject(tx.error || new Error('IndexedDB tx failed')); };
          tx.onabort = function () { reject(tx.error || new Error('IndexedDB tx aborted')); };
          fn(store, resolve, reject);
        } catch (e) { reject(e); }
      });
    });
  }
  /* 영상 blob 저장 — 같은 키(세션+파일명)면 덮어쓴다(put). */
  function saveVideoBlob(sig, name, file) {
    if (!sig || !name || !file) return Promise.reject(new Error('saveVideoBlob: bad args'));
    return videoTx('readwrite', function (store, resolve, reject) {
      var rec = {
        sig: String(sig),
        name: String(name),
        type: file.type || '',
        lastModified: file.lastModified || Date.now(),
        blob: file
      };
      var req = store.put(rec, videoBlobKey(sig, name));
      req.onsuccess = function () { resolve({ ok: true }); };
      req.onerror = function () { reject(req.error || new Error('saveVideoBlob put failed')); };
    });
  }
  /* 해당 세션(sig)의 저장된 영상 전체 목록 — [{name,type,lastModified,blob}] */
  function loadVideoBlobs(sig) {
    if (!sig) return Promise.resolve([]);
    return videoTx('readonly', function (store, resolve, reject) {
      var prefix = String(sig) + '::';
      var out = [];
      var range = null;
      try {
        /* prefix 범위 커서 — '::' 뒤 파일명은 임의이므로
           [prefix, prefix + '\uffff'] 로 잡는다. */
        range = global.IDBKeyRange
          ? global.IDBKeyRange.bound(prefix, prefix + '\uffff')
          : null;
      } catch (e) { range = null; }
      var req = store.openCursor(range);
      req.onsuccess = function () {
        var cur = req.result;
        if (!cur) { resolve(out); return; }
        var k = String(cur.key);
        if (k.indexOf(prefix) === 0 && cur.value && cur.value.blob) {
          out.push({
            name: cur.value.name || k.slice(prefix.length),
            type: cur.value.type || '',
            lastModified: cur.value.lastModified || Date.now(),
            blob: cur.value.blob
          });
        }
        cur['continue']();
      };
      req.onerror = function () { reject(req.error || new Error('loadVideoBlobs cursor failed')); };
    });
  }
  /* 클립 1개 blob 삭제 (사용자가 클립 Remove 시) */
  function removeVideoBlob(sig, name) {
    if (!sig || !name) return Promise.resolve({ ok: false });
    return videoTx('readwrite', function (store, resolve, reject) {
      var req = store['delete'](videoBlobKey(sig, name));
      req.onsuccess = function () { resolve({ ok: true }); };
      req.onerror = function () { reject(req.error || new Error('removeVideoBlob failed')); };
    });
  }
  /* 해당 세션(sig)의 blob 전체 삭제 (전체 영상 제거 시) */
  function clearVideoBlobs(sig) {
    if (!sig) return Promise.resolve({ ok: false });
    return videoTx('readwrite', function (store, resolve, reject) {
      var prefix = String(sig) + '::';
      var range = null;
      try {
        range = global.IDBKeyRange
          ? global.IDBKeyRange.bound(prefix, prefix + '\uffff')
          : null;
      } catch (e) { range = null; }
      var req = store.openCursor(range);
      req.onsuccess = function () {
        var cur = req.result;
        if (!cur) { resolve({ ok: true }); return; }
        if (String(cur.key).indexOf(prefix) === 0) cur['delete']();
        cur['continue']();
      };
      req.onerror = function () { reject(req.error || new Error('clearVideoBlobs failed')); };
    });
  }

  /* ---------- 라이더 · 장비 프로필 (전역, 마지막 입력값 유지) ---------- */
  /* 체중·스킬은 거의 안 바뀌고 윙·포일도 자주 안 바뀌므로, 한 번
     입력하면 다음 세션에 자동으로 채워지도록 브라우저에 저장한다.
     ("같은 입력 반복" 회피 — 코치가 매 세션 재입력하지 않게.) */
  /* ---------- §463 라이딩 부하 자동 기록 ---------- */
  var MAX_RIDELOADS = 400;

  function readRideLoads() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(K_RIDELOADS()) : null;
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  /* e = { sig, dateEpoch, name, AU, method }
     같은 sig 가 이미 있으면 덮어쓴다 — 라이더 프로필(최대심박 등)이
     바뀌어 부하가 다시 계산되면 최신 값이 맞다. */
  function recordRideLoad(e) {
    if (!e || !e.sig || e.AU == null || !isFinite(e.AU)) {
      return { ok: false, error: 'invalid' };
    }
    var arr = readRideLoads();
    var i = -1;
    for (var k = 0; k < arr.length; k++) {
      if (arr[k].sig === String(e.sig)) { i = k; break; }
    }
    var rec = {
      sig: String(e.sig),
      dateEpoch: e.dateEpoch || Date.now(),
      name: e.name || 'Ride',
      AU: Number(e.AU),
      method: e.method || null,
      savedAt: Date.now()
    };
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    arr.sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
    if (arr.length > MAX_RIDELOADS) arr = arr.slice(arr.length - MAX_RIDELOADS);
    try {
      global.localStorage.setItem(K_RIDELOADS(), JSON.stringify(arr));
      return { ok: true, count: arr.length, replaced: i >= 0 };
    } catch (err) {
      return { ok: false, error: (err && err.message) || 'save failed' };
    }
  }

  function listRideLoads() { return readRideLoads(); }

  function deleteRideLoad(sig) {
    var arr = readRideLoads().filter(function (r) { return r.sig !== String(sig); });
    try {
      global.localStorage.setItem(K_RIDELOADS(), JSON.stringify(arr));
      return { ok: true };
    } catch (e) { return { ok: false }; }
  }

  /* ---------- §457 육상 운동 ---------- */
  var MAX_WORKOUTS = 400;

  function readWorkouts() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(K_WORKOUTS()) : null;
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeWorkouts(arr) {
    try {
      global.localStorage.setItem(K_WORKOUTS(), JSON.stringify(arr || []));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'save failed' };
    }
  }

  /* w = { dateEpoch, sportKey, durationMin, rpe?, note?, AU, method }
     AU 는 caller 가 analysis.computeWorkload 로 산출해 넘긴다 — 저장소는
     계산하지 않는다(엔진과 저장을 섞지 않는다). */
  function saveWorkout(w) {
    if (!w || !w.sportKey || !(w.durationMin > 0)) {
      return { ok: false, error: 'invalid workout' };
    }
    var arr = readWorkouts();
    arr.push({
      id: 'wk_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      savedAt: Date.now(),
      dateEpoch: w.dateEpoch || Date.now(),
      sportKey: w.sportKey,
      durationMin: Number(w.durationMin),
      rpe: (w.rpe != null && w.rpe > 0) ? Number(w.rpe) : null,
      note: w.note || '',
      AU: (w.AU != null && isFinite(w.AU)) ? Number(w.AU) : null,
      method: w.method || null
    });
    arr.sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
    if (arr.length > MAX_WORKOUTS) arr = arr.slice(arr.length - MAX_WORKOUTS);
    var res = writeWorkouts(arr);
    return res.ok ? { ok: true, count: arr.length } : res;
  }

  function listWorkouts() { return readWorkouts(); }

  function deleteWorkout(id) {
    var arr = readWorkouts().filter(function (w) { return w.id !== id; });
    return writeWorkouts(arr);
  }

  /* 세션 + 육상 운동을 하나의 부하 원장으로 합친다.
     computeFitnessTrend 는 { dateEpoch, trimp } 만 보므로 그 모양으로
     맞춰 준다. 라이딩은 trimp, 육상은 AU — 둘 다 같은 Banister scale
     로 정렬돼 있다(analysis.computeWorkload 주석 참조). */
  function loadLedger() {
    var out = [], savedSigs = {};
    readAll().forEach(function (r) {
      if (r.sig) savedSigs[String(r.sig)] = true;
      if (r.trimp != null && isFinite(r.trimp)) {
        out.push({ dateEpoch: r.dateEpoch, trimp: r.trimp,
                   kind: 'ride', name: r.name, method: r.loadMethod || null,
                   saved: true });
      }
    });
    /* 자동 기록분 — 이미 '저장된 세션' 으로 들어온 것은 뺀다(중복 방지).
       저장 레코드에 sig 가 없던 옛 기록은 날짜로 한 번 더 거른다. */
    var savedDays = {};
    out.forEach(function (r) {
      savedDays[new Date(r.dateEpoch).toISOString().slice(0, 16)] = true;
    });
    readRideLoads().forEach(function (r) {
      if (savedSigs[r.sig]) return;
      if (savedDays[new Date(r.dateEpoch).toISOString().slice(0, 16)]) return;
      out.push({ dateEpoch: r.dateEpoch, trimp: r.AU, kind: 'ride',
                 name: r.name, method: r.method, sig: r.sig, saved: false });
    });
    readWorkouts().forEach(function (w) {
      if (w.AU != null && isFinite(w.AU)) {
        out.push({ dateEpoch: w.dateEpoch, trimp: w.AU,
                   kind: 'land', name: w.sportKey, method: w.method, id: w.id });
      }
    });
    out.sort(function (a, b) { return a.dateEpoch - b.dateEpoch; });
    return out;
  }

  /* 급성:만성 부하 비율. 7일 평균 ÷ 28일 평균.
     ⚠ '0.8~1.3 안전구간' 은 학계 논란 중이라 규칙이 아니라 신호로만
     쓴다 — 임계값 판정은 여기서 하지 않고 값만 돌려준다. */
  function computeACWR(ledger, endEpoch) {
    var end = endEpoch || Date.now();
    var DAY = 86400000;
    function sumWithin(days) {
      var from = end - days * DAY, s2 = 0;
      (ledger || []).forEach(function (x) {
        if (x.dateEpoch > from && x.dateEpoch <= end) s2 += x.trimp || 0;
      });
      return s2;
    }
    var acute = sumWithin(7) / 7;
    var chronic = sumWithin(28) / 28;
    if (!(chronic > 0)) return { acute: acute, chronic: chronic, ratio: null };
    return { acute: acute, chronic: chronic, ratio: acute / chronic };
  }

  /* §487 — 세션별 문답 답변. 답 하나가 성능 통계에서 구간을 빼기도 하므로
     세션 시그니처로 묶어 두고, 같은 파일을 다시 열면 그대로 살아난다. */
  function loadAllAnswers() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(K_QA()) : null;
      var o = raw ? JSON.parse(raw) : null;
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }
  function loadSessionAnswers(sig) {
    if (!sig) return {};
    var all = loadAllAnswers();
    return (all[sig] && typeof all[sig] === 'object') ? all[sig] : {};
  }
  /* rec = { key, effect, fromSec, toSec } — 구간까지 함께 담는다.
     제외를 적용하려고 매번 다시 탐지하면 이미 제외된 세션에서 탐지하게
     되어 질문이 사라지는 순환에 빠진다. 답은 '그 구간에 대한 사실'이다. */
  function saveSessionAnswer(sig, questionId, rec) {
    if (!sig || !questionId) return { ok: false };
    try {
      var all = loadAllAnswers();
      if (!all[sig]) all[sig] = {};
      if (rec == null) delete all[sig][questionId];
      else all[sig][questionId] = rec;
      if (!Object.keys(all[sig]).length) delete all[sig];
      global.localStorage.setItem(K_QA(), JSON.stringify(all));
      return { ok: true };
    } catch (e) { return { ok: false }; }
  }
  function clearSessionAnswers(sig) {
    if (!sig) return { ok: false };
    try {
      var all = loadAllAnswers();
      delete all[sig];
      global.localStorage.setItem(K_QA(), JSON.stringify(all));
      return { ok: true };
    } catch (e) { return { ok: false }; }
  }

  function saveRider(rider) {
    try {
      global.localStorage.setItem(K_RIDER(), JSON.stringify(rider || {}));
      return { ok: true };
    } catch (e) { return { ok: false }; }
  }
  function loadRider() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(K_RIDER()) : null;
      var o = raw ? JSON.parse(raw) : null;
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  /* ============================================================
   * Fitness Trend — CTL · ATL · TSB (Coggan PMC model)
   *
   * 저장된 세션들의 TRIMP 를 일별 합산해 두 가지 EWMA 시계열을 만든다:
   *   ATL_today = ATL_yesterday × exp(-1/7)  + Load_today × (1 − exp(-1/7))
   *   CTL_today = CTL_yesterday × exp(-1/42) + Load_today × (1 − exp(-1/42))
   *   TSB       = CTL − ATL
   *
   * - ATL (Acute Training Load) — k=7 day EWMA — "최근 피로"
   * - CTL (Chronic Training Load) — k=42 day EWMA — "장기 체력"
   * - TSB (Training Stress Balance) — "폼" — race readiness
   *
   * TSB 해석:
   *   · TSB > +25       : fresh / peaked (race ready)
   *   · +5 ≤ TSB ≤ +25  : moderately fresh
   *   · −10 ≤ TSB ≤ +5  : balanced training
   *   · −30 ≤ TSB ≤ −10 : productive training (fitness 증가 중)
   *   · TSB < −30        : overreaching / overtraining risk
   *
   * 입력:
   *   sessions — listSessions() 반환 (dateEpoch + trimp). trimp:null 세션은 0 부하.
   *   opts     — { startDate?, endDate?, ctlK?, atlK? }. 기본 7/42 일.
   *
   * 반환:
   *   { days: [{date, load, ATL, CTL, TSB}], current: {ATL, CTL, TSB, date} }
   *   sessions 비어있으면 { days: [], current: null }
   *
   * References — Performance Management Chart (PMC):
   *   · Coggan, A.R. & Allen, H. 2010. "Training and Racing with a Power Meter"
   *     2e. VeloPress. ISBN 978-1-934030-55-2.
   *   · Coggan, A.R. 2003. "Training and Racing Using a Power Meter: An
   *     Introduction". USA Cycling Coaching Education lecture
   *     (midweekclub.ca/articles/coggan.pdf) — PMC 도입.
   *   · Banister, E.W. 1991 — impulse-response fitness/fatigue model 의 기반.
   * ============================================================ */
  function computeFitnessTrend(sessions, opts) {
    opts = opts || {};
    var ctlK = (opts.ctlK > 0) ? Number(opts.ctlK) : 42;
    var atlK = (opts.atlK > 0) ? Number(opts.atlK) : 7;
    var ctlDecay = Math.exp(-1 / ctlK);
    var atlDecay = Math.exp(-1 / atlK);

    if (!Array.isArray(sessions) || !sessions.length) {
      return { days: [], current: null, ctlK: ctlK, atlK: atlK };
    }

    /* 1) 세션별 dateEpoch → YYYY-MM-DD (로컬 시간대 무관 — UTC 기준 day).
       Coggan 표준은 user local day 지만, 라이딩 세션은 보통 한낮이므로
       UTC day 와 local day 가 같은 경우가 대다수. 시간대 보정은 v2 후보. */
    function toDayKey(epoch) {
      var d = new Date(epoch);
      var y = d.getUTCFullYear();
      var m = ('0' + (d.getUTCMonth() + 1)).slice(-2);
      var dd = ('0' + d.getUTCDate()).slice(-2);
      return y + '-' + m + '-' + dd;
    }

    /* 2) 일별 TRIMP 합산 (한 날에 2세션 = 합산) */
    var dayLoad = {};
    var minEpoch = Infinity, maxEpoch = -Infinity;
    sessions.forEach(function (s) {
      var ep = Number(s.dateEpoch);
      if (!isFinite(ep) || ep <= 0) return;
      if (ep < minEpoch) minEpoch = ep;
      if (ep > maxEpoch) maxEpoch = ep;
      var k = toDayKey(ep);
      var load = (s.trimp != null && isFinite(s.trimp) && s.trimp >= 0)
        ? Number(s.trimp) : 0;
      dayLoad[k] = (dayLoad[k] || 0) + load;
    });
    if (!isFinite(minEpoch)) {
      return { days: [], current: null, ctlK: ctlK, atlK: atlK };
    }

    /* 3) 일별 시계열 (휴식일도 0 부하로 포함). 시작일 = 첫 세션,
       종료일 = 마지막 세션 또는 opts.endDate (오늘까지 연장 가능). */
    var startEpoch = (opts.startDate != null)
      ? Number(opts.startDate) : minEpoch;
    var endEpoch = (opts.endDate != null)
      ? Number(opts.endDate) : maxEpoch;
    /* startEpoch 의 UTC 자정으로 정규화 */
    var startDay = new Date(startEpoch);
    startDay = Date.UTC(startDay.getUTCFullYear(),
                        startDay.getUTCMonth(), startDay.getUTCDate());
    var endDay = new Date(endEpoch);
    endDay = Date.UTC(endDay.getUTCFullYear(),
                      endDay.getUTCMonth(), endDay.getUTCDate());
    if (endDay < startDay) endDay = startDay;

    /* 4) EWMA recursion. ATL/CTL 초기값 = 0 (= 훈련 기록 0 시작).
       라이더가 이미 훈련 중이었다면 첫 며칠은 ramp-up — Coggan 표준 권장. */
    var days = [];
    var atl = 0, ctl = 0;
    var ONE_DAY = 86400000;
    for (var t = startDay; t <= endDay; t += ONE_DAY) {
      var k = toDayKey(t);
      var load = dayLoad[k] || 0;
      atl = atl * atlDecay + load * (1 - atlDecay);
      ctl = ctl * ctlDecay + load * (1 - ctlDecay);
      days.push({
        date: k,
        epoch: t,
        load: Math.round(load * 10) / 10,
        ATL: Math.round(atl * 100) / 100,
        CTL: Math.round(ctl * 100) / 100,
        TSB: Math.round((ctl - atl) * 100) / 100
      });
    }

    var current = days.length ? days[days.length - 1] : null;
    return {
      days: days,
      current: current,
      ctlK: ctlK,
      atlK: atlK,
      sessionCount: sessions.length,
      sessionsWithTrimp: sessions.filter(function (s) {
        return s.trimp != null && s.trimp > 0;
      }).length
    };
  }

  /* TSB 해석 (Coggan PMC zone labels) — UI 가 자연어로 표시 */
  function interpretTSB(tsb) {
    if (tsb == null || !isFinite(tsb)) return { zone: 'unknown', label: '데이터 없음' };
    if (tsb > 25)   return { zone: 'peaked',     label: '피크 — 레이스 준비 완료' };
    if (tsb >= 5)   return { zone: 'fresh',      label: '컨디션 양호' };
    if (tsb >= -10) return { zone: 'balanced',   label: '훈련 균형' };
    if (tsb >= -30) return { zone: 'productive', label: '체력 향상 중 — 적정 부하' };
    return                 { zone: 'overreach',  label: '과훈련 risk — 회복 필요' };
  }

  /* ============================================================
   * EXERCISE_LIBRARY — Land workout 카탈로그 (Gap-Filling Engine 입력)
   *
   * 본 라이브러리는 Component B (suggestLandWorkout) 의 candidate pool.
   * 코치 (Danny) curate — Phase 2 라이더 feedback 으로 확장.
   *
   * Reference: sports_science_cross_modal_training_system.md §6-6
   * ============================================================ */
  var EXERCISE_LIBRARY = [
    /* === Running === */
    {
      id: 'run_easy_30', sportKey: 'run_easy', name: '30분 z2 easy run',
      durationMin: 30, intensity: 'LIT', equipment: ['running_shoes'],
      indoor_possible: true,
      step_by_step: ['5분 walk-jog warmup', '20분 easy z2 (nasal breathing)', '5분 walk cooldown'],
      notes: 'Recovery / aerobic base. Avoid race pace.'
    },
    {
      id: 'run_easy_45', sportKey: 'run_easy', name: '45분 z2 long easy',
      durationMin: 45, intensity: 'LIT', equipment: ['running_shoes'],
      step_by_step: ['5분 walk-jog warmup', '35분 easy z2', '5분 walk cooldown'],
      notes: 'Aerobic base building. Polarized 80% zone.'
    },
    {
      id: 'run_intervals_25', sportKey: 'run_intervals', name: '25분 인터벌',
      durationMin: 25, intensity: 'HIT', equipment: ['running_shoes', 'track_or_park'],
      step_by_step: ['8분 warmup', '6 × (90초 z5 / 90초 z1)', '5분 cooldown'],
      notes: 'VO2max 자극. 다음날 light 권장.'
    },

    /* === Rowing — windfoil carryover 최고 === */
    {
      id: 'row_easy_30', sportKey: 'row_moderate', name: '30분 z2 rowing',
      durationMin: 30, intensity: 'LIT', equipment: ['rower_concept2'],
      step_by_step: ['5분 18-20 spm warmup', '20분 22-24 spm steady', '5분 cooldown'],
      notes: '윙포일과 최고 carryover (upper body + core). 권장.'
    },
    {
      id: 'row_intervals_30', sportKey: 'row_vigorous', name: '30분 인터벌 rowing',
      durationMin: 30, intensity: 'HIT', equipment: ['rower_concept2'],
      step_by_step: ['10분 warmup', '5 × (500m hard / 2 min rest)', '5분 cooldown'],
      notes: 'Anaerobic threshold + race pace.'
    },

    /* === Cycling === */
    {
      id: 'cycle_endurance_60', sportKey: 'cycle_moderate', name: '60분 endurance ride',
      durationMin: 60, intensity: 'LIT', equipment: ['bike_road_or_trainer'],
      indoor_possible: true,
      notes: 'Aerobic foundation. 실외 또는 trainer 모두 OK.'
    },
    {
      id: 'cycle_hiit_20', sportKey: 'cycle_hiit', name: '20분 cycling HIIT',
      durationMin: 20, intensity: 'HIT', equipment: ['bike_trainer_or_spinning'],
      indoor_possible: true,
      step_by_step: ['5분 warmup', '10 × (30초 all-out / 30초 easy)', '5분 cooldown'],
      notes: 'Tabata-like. 짧고 강함.'
    },

    /* === Strength === */
    {
      id: 'strength_windfoil_45', sportKey: 'strength_barbell',
      name: '윙포일 specific strength',
      durationMin: 45, intensity: 'threshold',
      equipment: ['barbell', 'plates', 'pull_up_bar'],
      step_by_step: [
        '10분 dynamic warmup',
        '5×5 Deadlift @ 70% 1RM',
        '5×5 Bent-over Row @ 65% 1RM',
        '4×6 Pull-up (weighted if able)',
        '3×8 Front Squat @ 60% 1RM',
        '3×30s Plank + 3×15 hanging knee raise'
      ],
      notes: 'Posterior chain + grip + core — 윙 holding endurance 직접 strengthening.'
    },
    {
      id: 'strength_bodyweight_30', sportKey: 'strength_bodyweight',
      name: '30분 맨몸 강화',
      durationMin: 30, intensity: 'LIT', equipment: ['floor_space'],
      indoor_possible: true,
      step_by_step: [
        '5분 mobility warmup',
        '4 round circuit: 10 push-up · 15 squat · 10 walking lunge · 30s plank',
        '5분 stretch'
      ],
      notes: 'No equipment 대안. 트래블 / 호텔 친화.'
    },

    /* === HIIT === */
    {
      id: 'hiit_20', sportKey: 'hiit', name: '20분 metcon',
      durationMin: 20, intensity: 'HIT', equipment: ['minimal'],
      indoor_possible: true,
      step_by_step: [
        '5분 warmup',
        '4 round (3분 work + 1분 rest): kettlebell swing / burpee / row',
        '3분 cooldown'
      ],
      notes: '시간 효율 highest. 다음날 light recovery 필요.'
    },

    /* === Recovery === */
    {
      id: 'yoga_30', sportKey: 'yoga', name: '30분 윙포일 yoga',
      durationMin: 30, intensity: 'recovery', equipment: ['mat'],
      indoor_possible: true,
      notes: 'Hip flexor / thoracic mobility / shoulder. Active recovery 권장.'
    },
    {
      id: 'mobility_15', sportKey: 'mobility', name: '15분 mobility / foam roll',
      durationMin: 15, intensity: 'recovery', equipment: ['foam_roller'],
      indoor_possible: true,
      notes: 'Daily routine. 모든 session 직후 권장.'
    },

    /* === Walking (everyone has it) === */
    {
      id: 'walk_brisk_30', sportKey: 'walk_brisk', name: '30분 빠른 걷기',
      durationMin: 30, intensity: 'LIT', equipment: [],
      indoor_possible: true,
      notes: 'Equipment 없을 때 default. LIT 보충 가능.'
    }
  ];

  /* ============================================================
   * suggestLandWorkout — Gap-Filling Prescription Engine (Component B)
   *
   * 라이더 weekly target 의 부족분 (gap_AU) 을 land workout 으로 보충하는
   * 다양한 옵션 제안. EXERCISE_LIBRARY filter + AU 매칭 + carryover bonus
   * + variety bonus → top N options.
   *
   * 입력:
   *   gap = { gap_AU, gap_distribution? }     /* §3-2 출력 */
/*   profile = { weightKg, skill? }
 *   prefs = {
 *     equipment_access: ['running_shoes', 'rower_concept2', ...] (필수)
 *     timeAvailable_min: 60 (선택, 기본 90)
 *     injury_restriction: ['knee', 'shoulder', ...] (선택)
 *     preferred_intensity: 'LIT'|'HIT'|'any' (선택)
 *   }
 *   history = [{sportKey, date, AU}, ...] (지난 7일 — variety penalty)
 *   opts = { topN: 5, metFactor: 0.2 }
 *
 * 반환:
 *   {
 *     gap_AU,
 *     options: [{ id, name, sportKey, durationMin, AU_est, carryover, score, ...}]
 *     recommendation_summary: string
 *   }
 *
 * Algorithm:
 *   1. Filter EXERCISE_LIBRARY by equipment + duration + intensity
 *   2. 각 workout AU 추정 (analysis.computeWorkload via MET tier)
 *   3. 매칭 점수:
 *      - AU match: 1 - |gap - AU|/gap (가까울수록 ↑)
 *      - Carryover bonus: WINDFOIL_CARRYOVER[sportKey]
 *      - Variety penalty: 같은 sport last 7days 횟수 × 0.15
 *      - Intensity match: gap_distribution 와 일치 시 ↑
 *   4. Sort by score, return top N
 * ============================================================ */
function suggestLandWorkout(gap, profile, prefs, history, opts) {
  opts = opts || {};
  prefs = prefs || {};
  history = history || [];
  profile = profile || {};
  var topN = opts.topN || 5;
  var gap_AU = (gap && gap.gap_AU > 0) ? Number(gap.gap_AU) : 100;
  var timeMax = prefs.timeAvailable_min || 90;
  var equipAccess = prefs.equipment_access || ['minimal', 'floor_space'];
  var injuryList = prefs.injury_restriction || [];
  var preferredIntensity = prefs.preferred_intensity || 'any';

  /* SportMET module 로드 (MET + carryover lookup) */
  var SportMET = (typeof require !== 'undefined' && typeof module !== 'undefined')
    ? require('./sport-met.js')
    : global.RDSportMET;
  if (!SportMET || !SportMET.getMET) {
    return { gap_AU: gap_AU, options: [], reason: 'sport_met_unavailable' };
  }

  /* Helper — equipment 사용 가능한가? (필요 equipment 의 1개라도 access 면 OK
     단 'minimal' 또는 'floor_space' 는 항상 OK assume) */
  function hasEquipment(workout) {
    if (!workout.equipment || workout.equipment.length === 0) return true;
    return workout.equipment.some(function (eq) {
      if (eq === 'minimal' || eq === 'floor_space') return true;
      return equipAccess.indexOf(eq) >= 0;
    });
  }

  /* History — 지난 7일 sport 별 빈도 (variety penalty) */
  var now = Date.now();
  var sevenDaysAgo = now - 7 * 86400000;
  var sportFreq = {};
  history.forEach(function (h) {
    var ep = Number(h.date) || (h.dateEpoch || 0);
    if (ep >= sevenDaysAgo) {
      sportFreq[h.sportKey] = (sportFreq[h.sportKey] || 0) + 1;
    }
  });

  /* Body mass for MET → AU 변환 */
  var weightKg = (profile.weightKg > 0) ? Number(profile.weightKg) : 75;
  var metFactor = (opts.metFactor > 0) ? Number(opts.metFactor) : 0.2;

  /* Candidate filter + scoring */
  var candidates = EXERCISE_LIBRARY.filter(function (w) {
    if (w.durationMin > timeMax) return false;
    if (!hasEquipment(w)) return false;
    /* Injury filter — Phase 2 expand (현재 단순 keyword match) */
    if (injuryList.length) {
      var conflict = injuryList.some(function (inj) {
        if (inj === 'knee' && (w.sportKey.indexOf('run') === 0 ||
                                w.sportKey === 'cycle_hiit')) return true;
        if (inj === 'shoulder' && w.sportKey.indexOf('row') === 0) return true;
        if (inj === 'back' && w.sportKey === 'strength_barbell') return true;
        return false;
      });
      if (conflict) return false;
    }
    return true;
  }).map(function (w) {
    var met = SportMET.getMET(w.sportKey) || 5;
    var au = met * w.durationMin * (weightKg / 75) * metFactor;
    var carryover = SportMET.getCarryover(w.sportKey);
    /* AU match score (0-1, 1 = perfect match) — Gaussian-like */
    var auMatch = Math.max(0, 1 - Math.abs(au - gap_AU) / Math.max(gap_AU, 30));
    /* Variety penalty */
    var freq = sportFreq[w.sportKey] || 0;
    var varietyPenalty = Math.min(0.5, freq * 0.15);
    /* Intensity match bonus */
    var intensityBonus = 0;
    if (preferredIntensity !== 'any' && w.intensity === preferredIntensity) {
      intensityBonus = 0.2;
    }
    /* Composite score */
    var score = auMatch * 0.5 + carryover * 0.3 + intensityBonus - varietyPenalty;
    return {
      id: w.id,
      sportKey: w.sportKey,
      name: w.name,
      durationMin: w.durationMin,
      intensity: w.intensity,
      equipment: w.equipment,
      step_by_step: w.step_by_step,
      notes: w.notes,
      AU_estimate: Math.round(au * 10) / 10,
      met: met,
      carryover: carryover,
      auMatchScore: Math.round(auMatch * 100) / 100,
      varietyPenalty: Math.round(varietyPenalty * 100) / 100,
      intensityMatch: intensityBonus > 0,
      score: Math.round(score * 1000) / 1000
    };
  });

  /* Sort by score descending */
  candidates.sort(function (a, b) { return b.score - a.score; });

  /* Diverse selection — 같은 sport 최대 2개만 top N 에 */
  var options = [];
  var sportCount = {};
  for (var i = 0; i < candidates.length && options.length < topN; i++) {
    var c = candidates[i];
    if ((sportCount[c.sportKey] || 0) < 2) {
      options.push(c);
      sportCount[c.sportKey] = (sportCount[c.sportKey] || 0) + 1;
    }
  }

  /* Recommendation summary (자연어) */
  var top = options[0];
  var summary;
  if (!top) {
    summary = 'Equipment / 시간 제약으로 매칭 workout 없음 — 30분 빠른 걷기 권장.';
  } else {
    var rounded_AU = Math.round(top.AU_estimate);
    summary = '추천: ' + top.name + ' (' + rounded_AU + ' AU). ' +
              'Windfoil carryover ' + Math.round(top.carryover * 100) + '%.';
    if (top.AU_estimate < gap_AU * 0.7) {
      summary += ' Gap 충당 부족 — 다음날 추가 ' +
                 Math.round(gap_AU - top.AU_estimate) + ' AU 권장.';
    }
  }

  return {
    gap_AU: gap_AU,
    options: options,
    recommendation_summary: summary,
    candidate_count: candidates.length
  };
}

  /* ============================================================
   * buildPeriodizationPlan — 역공학 12-week build-up plan
   *
   * Event-Aware Periodization (Component B) 핵심 entry.
   * Race date + event_total_TRIMP + athlete → daily target AU list.
   *
   * Algorithm (Issurin ATR + Bompa volume curve + Bosquet taper):
   *   1. 12-week (or weeks_to_event) plan with phases:
   *      A1·A2·A3 (Accumulation, 3 weeks) → Recovery 1 (-40%)
   *      → T1·T2·T3 (Transformation, 3 weeks) → Recovery 2 (-40%)
   *      → R1·R2 (Realization, 2 weeks) → Taper 1·2 (2 weeks, -40~-60%)
   *      → Competition week
   *   2. Weekly AU = event_total × phase_percent_table
   *   3. Daily AU = weekly × Bompa micro-cycle distribution (Mon-Sun)
   *   4. Taper micro-cycle 별도 (Tue/Wed/Fri intensity 유지)
   *
   * 입력:
   *   target = {
   *     event_total_TRIMP: 900 (Number — estimateCompetitionLoad 결과),
   *     race_date: 'YYYY-MM-DD',
   *     athlete_skill: '중급'
   *   }
   *   athlete = { weightKg }
   *   opts = { weeks_to_event?: 12, start_date?: today }
   *
   * 출력:
   *   {
   *     weeks: [{ week_offset, phase, label, weekly_AU, daily_avg, days: [{date, day_of_week, target_AU, phase_note}] }, ...],
   *     summary: { total_AU, weeks_count, taper_start, race_date },
   *     rationale: string (한국어)
   *   }
   *
   * References:
   *   · Issurin 2008 — Block Periodization (ATR)
   *   · Bosquet 2007 — Tapering meta-analysis (doi:10.1249/mss.0b013e31806010e0)
   *   · Bompa 2018 — Periodization 6e (ISBN 978-1-4925-4480-2)
   *   · sports_science_event_periodization_system.md §4
   * ============================================================ */

  /* Phase 별 weekly AU 가중치 (event 평균일 부하 = 1.0 reference).
     Sum 0.144 = 12-week total ≈ event 대비 1.44× (전체 chronic 형성 + race).
     하지만 individual phase 는 event_avg 보다 작음 (race 가 peak). */
  var PERIODIZATION_PHASES = [
    /* week_offset: −12 ~ −1, then 0 = race week */
    { week_offset: -12, phase: 'A1',       label: 'Accumulation 1 — 베이스 aerobic',          weekly_pct: 0.112, intensity: 'LIT 80%' },
    { week_offset: -11, phase: 'A2',       label: 'Accumulation 2 — 볼륨 build',              weekly_pct: 0.134, intensity: 'LIT 80%' },
    { week_offset: -10, phase: 'A3',       label: 'Accumulation 3 — 볼륨 peak',               weekly_pct: 0.154, intensity: 'LIT 75%' },
    { week_offset:  -9, phase: 'Recovery1', label: 'Deload 1 (-40%) — super-compensation',    weekly_pct: 0.084, intensity: 'LIT 90%' },
    { week_offset:  -8, phase: 'T1',       label: 'Transformation 1 — race-specific intro',  weekly_pct: 0.154, intensity: 'mixed' },
    { week_offset:  -7, phase: 'T2',       label: 'Transformation 2 — slalom + course',      weekly_pct: 0.174, intensity: 'mixed' },
    { week_offset:  -6, phase: 'T3',       label: 'Transformation 3 — peak load',             weekly_pct: 0.196, intensity: 'mixed' },
    { week_offset:  -5, phase: 'Recovery2', label: 'Deload 2 (-40%) + tune-up race',         weekly_pct: 0.098, intensity: 'mixed' },
    { week_offset:  -4, phase: 'R1',       label: 'Realization 1 — peak specificity',        weekly_pct: 0.182, intensity: 'HIT 25%' },
    { week_offset:  -3, phase: 'R2',       label: 'Realization 2 — volume ↓ 시작',            weekly_pct: 0.154, intensity: 'HIT 25%' },
    { week_offset:  -2, phase: 'Taper1',   label: 'Taper 1 (-40% volume, intensity 유지)',   weekly_pct: 0.098, intensity: 'race-pace short' },
    { week_offset:  -1, phase: 'Taper2',   label: 'Taper 2 (-55%, peak ready)',              weekly_pct: 0.062, intensity: 'short sharp' },
    { week_offset:   0, phase: 'Race',     label: 'COMPETITION — execute',                    weekly_pct: 1.000, intensity: 'race' }
  ];

  /* Bompa weekly micro-cycle (Mon=0 ~ Sun=6) — daily AU 분배.
     평균 chronic block 적용. Taper week 는 별도 pattern. */
  var WEEKLY_MICROCYCLE = {
    standard: [0.08, 0.15, 0.21, 0.11, 0.15, 0.22, 0.08],  /* Mon-Sun */
    taper1:   [0.00, 0.20, 0.30, 0.10, 0.25, 0.15, 0.00],  /* race-pace Tue/Wed/Fri */
    taper2:   [0.00, 0.25, 0.25, 0.00, 0.30, 0.20, 0.00],  /* shorter, race-day Sat */
    recovery: [0.10, 0.15, 0.18, 0.10, 0.15, 0.20, 0.12],  /* deload — more even */
    race:     [0.20, 0.20, 0.20, 0.20, 0.20, 0.00, 0.00]   /* 5-day comp, weekend off */
  };

  function buildPeriodizationPlan(target, athlete, opts) {
    opts = opts || {};
    target = target || {};
    var totalAU = Number(target.event_total_TRIMP) || 0;
    if (totalAU <= 0) return { error: 'invalid_event_TRIMP' };
    var raceDate = new Date(target.race_date);
    if (isNaN(raceDate.getTime())) return { error: 'invalid_race_date' };

    var weeksToEvent = (opts.weeks_to_event > 0) ? Number(opts.weeks_to_event) : 12;
    /* 12 주 미만이면 phase 압축 (taper 는 무조건 보존, accumulation 단축) */
    var phases = PERIODIZATION_PHASES.filter(function (p) {
      return p.week_offset >= -weeksToEvent;
    });

    var weeks = phases.map(function (p) {
      var weekStart = new Date(raceDate);
      weekStart.setUTCDate(weekStart.getUTCDate() + p.week_offset * 7);
      /* Sunday of that week = race day for week 0, otherwise Mon */
      var dayOfWeekRace = raceDate.getUTCDay();  /* 0 (Sun) ~ 6 (Sat) */
      /* Align week start to Monday */
      var raceDOW_mondayBased = (dayOfWeekRace + 6) % 7;  /* 0 (Mon) ~ 6 (Sun) */
      var weekStartMon = new Date(weekStart);
      weekStartMon.setUTCDate(weekStartMon.getUTCDate() - raceDOW_mondayBased);

      var weeklyAU = totalAU * p.weekly_pct;
      var microcycle = (p.phase === 'Taper1') ? WEEKLY_MICROCYCLE.taper1
                     : (p.phase === 'Taper2') ? WEEKLY_MICROCYCLE.taper2
                     : (p.phase === 'Race')   ? WEEKLY_MICROCYCLE.race
                     : (p.phase === 'Recovery1' || p.phase === 'Recovery2')
                     ? WEEKLY_MICROCYCLE.recovery
                     : WEEKLY_MICROCYCLE.standard;
      var dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      var days = microcycle.map(function (frac, i) {
        var dayDate = new Date(weekStartMon);
        dayDate.setUTCDate(dayDate.getUTCDate() + i);
        var au = weeklyAU * frac;
        return {
          date: dayDate.toISOString().slice(0, 10),
          day_of_week: dayLabels[i],
          target_AU: Math.round(au * 10) / 10,
          /* type 추천 — sea uses skill_weighted weeks_offset */
          type: (au < 5) ? 'rest'
              : (p.phase === 'Race') ? 'race'
              : (p.phase === 'Recovery1' || p.phase === 'Recovery2') ? 'recovery_or_easy'
              : (p.intensity.indexOf('HIT') >= 0 && (i === 2 || i === 5)) ? 'high_intensity'
              : 'moderate'
        };
      });

      return {
        week_offset: p.week_offset,
        phase: p.phase,
        label: p.label,
        intensity: p.intensity,
        weekly_AU: Math.round(weeklyAU * 10) / 10,
        daily_avg: Math.round((weeklyAU / 7) * 10) / 10,
        days: days,
        week_start: weekStartMon.toISOString().slice(0, 10)
      };
    });

    /* Summary */
    var taperStart = (phases.find(function (p) { return p.phase === 'Taper1'; }) || {}).week_offset;
    var sumAU = weeks.reduce(function (s, w) { return s + w.weekly_AU; }, 0);

    var rationale =
      '목표 race ' + target.race_date + ' (' + (target.athlete_skill || '중급') + ' 등급, ' +
      'event total ' + totalAU.toFixed(0) + ' AU). ' +
      weeksToEvent + '-week plan: A1-A3 (3wk accumulation) → Recovery → T1-T3 (3wk transformation) ' +
      '→ Recovery → R1-R2 (2wk realization) → Taper (2wk, Bosquet 2007 protocol).';

    return {
      weeks: weeks,
      summary: {
        race_date: target.race_date,
        weeks_count: weeksToEvent,
        total_planned_AU: Math.round(sumAU * 10) / 10,
        event_TRIMP: totalAU,
        taper_start_week_offset: taperStart,
        athlete_skill: target.athlete_skill || '중급'
      },
      rationale: rationale
    };
  }

  /* ============================================================
   * dailyPlanCheck — actual vs planned + adjustment 추천
   *
   * 입력:
   *   plan_today  = { target_AU, day_of_week, phase, type }
   *   actual_AU   = number (오늘 누적 실 AU)
   *
   * 출력:
   *   { planned_AU, actual_AU, compliance_pct, flag, zone, adjustment_recommendation, message }
   *
   * Compliance zones:
   *   green:  0.80-1.20 (정상 이행)
   *   yellow: 0.60-0.80 or 1.20-1.50 (under or over)
   *   red:    <0.60 or >1.50 (큰 deviation)
   * ============================================================ */
  function dailyPlanCheck(plan_today, actual_AU) {
    plan_today = plan_today || {};
    var planned = Number(plan_today.target_AU) || 0;
    var actual = Number(actual_AU) || 0;
    var ratio = (planned > 0) ? (actual / planned) : 0;

    var flag, zone, msg, adj;
    if (planned <= 0) {
      flag = 'green'; zone = 'rest_day';
      msg = '오늘 rest day plan — 휴식 우선.';
      adj = null;
    } else if (ratio >= 0.80 && ratio <= 1.20) {
      flag = 'green'; zone = 'on_track';
      msg = '오늘 ' + Math.round(ratio * 100) + '% 이행 ✓ 잘 하셨습니다.';
      adj = null;
    } else if (ratio < 0.60) {
      flag = 'red'; zone = 'under';
      msg = '오늘 ' + Math.round(ratio * 100) + '% 만 이행. 부족 ' +
            Math.round(planned - actual) + ' AU.';
      adj = 'tomorrow +15% (catch-up)';
    } else if (ratio < 0.80) {
      flag = 'yellow'; zone = 'slight_under';
      msg = '오늘 ' + Math.round(ratio * 100) + '% 이행 — 약간 부족.';
      adj = 'tomorrow +5-10%';
    } else if (ratio > 1.50) {
      flag = 'red'; zone = 'over';
      msg = '오늘 ' + Math.round(ratio * 100) + '% 이행 — 과부하. 피로 누적 risk.';
      adj = 'tomorrow -20% (회복 우선)';
    } else if (ratio > 1.20) {
      flag = 'yellow'; zone = 'slight_over';
      msg = '오늘 ' + Math.round(ratio * 100) + '% 이행 — 약간 over.';
      adj = 'tomorrow -10%';
    }

    return {
      planned_AU: planned,
      actual_AU: actual,
      compliance_pct: Math.round(ratio * 100),
      compliance_ratio: Math.round(ratio * 1000) / 1000,
      flag: flag,
      zone: zone,
      message: msg,
      adjustment_recommendation: adj,
      phase: plan_today.phase || null,
      day_of_week: plan_today.day_of_week || null
    };
  }

  var Storage = {
    /* §412 — per-user namespace 격리 + legacy 마이그레이션 */
    migrateLegacyIfNeeded: migrateLegacyIfNeeded,
    nsPrefix: nsPrefix,
    sessionsKey: K_SESSIONS,
    currentUid: _currentUid,
    saveSession: saveSession,
    listSessions: listSessions,
    deleteSession: deleteSession,
    clearAll: clearAll,
    loadTrack: loadTrack,
    personalBests: personalBests,
    careerStats: careerStats,
    saveEditState: saveEditState,
    loadEditState: loadEditState,
    saveSessionTitle: saveSessionTitle,
    loadSessionTitle: loadSessionTitle,
    saveVideoSync: saveVideoSync,
    loadVideoSync: loadVideoSync,
    /* §189 (샘 2026-06-04) — 영상 클립 blob 영구 보존 (IndexedDB) */
    saveVideoBlob: saveVideoBlob,
    loadVideoBlobs: loadVideoBlobs,
    removeVideoBlob: removeVideoBlob,
    clearVideoBlobs: clearVideoBlobs,
    recordRideLoad: recordRideLoad,
    listRideLoads: listRideLoads,
    deleteRideLoad: deleteRideLoad,
    saveWorkout: saveWorkout,
    listWorkouts: listWorkouts,
    deleteWorkout: deleteWorkout,
    loadLedger: loadLedger,
    computeACWR: computeACWR,
    saveRider: saveRider,
    loadRider: loadRider,
    loadSessionAnswers: loadSessionAnswers,
    saveSessionAnswer: saveSessionAnswer,
    clearSessionAnswers: clearSessionAnswers,
    computeFitnessTrend: computeFitnessTrend,
    interpretTSB: interpretTSB,
    suggestLandWorkout: suggestLandWorkout,
    EXERCISE_LIBRARY: EXERCISE_LIBRARY,
    buildPeriodizationPlan: buildPeriodizationPlan,
    dailyPlanCheck: dailyPlanCheck,
    PERIODIZATION_PHASES: PERIODIZATION_PHASES,
    WEEKLY_MICROCYCLE: WEEKLY_MICROCYCLE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Storage;
  else global.RDStorage = Storage;
})(typeof window !== 'undefined' ? window : globalThis);
