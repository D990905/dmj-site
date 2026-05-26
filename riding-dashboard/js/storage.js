/* ============================================================
 * storage.js — 다중 세션 저장 (localStorage)
 * 컴팩트 요약 레코드만 저장 (트랙 원본 X) — 시즌 progression·세션
 * 비교·개인 베스트용. 브라우저 로컬 전용, 서버 전송 없음.
 * ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'rd_sessions_v1';
  var TRACK_PREFIX = 'rd_track_v1_';   /* 세션별 원본 GPX — '다시 보기' 재분석용 */
  var MAX_SESSIONS = 50;
  /* 트랙 1건 상한 — 공백 압축 후에도 이보다 크면 요약만 저장한다.
     realistic 세션(수 시간·1Hz GPS)은 압축 후 이 한도 안에 들어와
     전부 '다시 보기'가 가능하다. 전체 저장 용량은 아래
     storeTrackWithEviction 이 오래된 트랙을 비우며 따로 관리한다. */
  var MAX_TRACK_CHARS = 8000000;

  function readAll() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(KEY) : null;
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeAll(arr) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(arr));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: '브라우저 저장 공간이 가득 찼습니다. 오래된 세션을 삭제해 주세요.' };
    }
  }

  /* ---------- 세션별 원본 GPX 트랙 (다시 보기용) ----------
   * 요약 레코드(rd_sessions_v1)와 분리해 세션마다 별도 키에 저장한다.
   * 큰 트랙 하나가 전체 목록 저장을 막지 않도록 분리한 것이다.
   * 다시 보기 = 저장된 GPX 를 분석 파이프라인에 그대로 재투입. */
  function trackKey(id) { return TRACK_PREFIX + id; }
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
        return { count: bn.count, p95Ms: Math.round(bn.p95Ms * 1000) / 1000 };
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
      activeRatio: s.activeRatio || 0,
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
      hrRecoveryIndex: (meta.hrRecoveryIndex != null) ? meta.hrRecoveryIndex : null
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
      var ls = global.localStorage, kill = [];
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(TRACK_PREFIX) === 0) kill.push(k);
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
  var EDIT_KEY = 'rd_edits_v1';
  function readEdits() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(EDIT_KEY) : null;
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
    try { global.localStorage.setItem(EDIT_KEY, JSON.stringify(all)); return { ok: true }; }
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
  var TITLE_KEY = 'rd_titles_v1';
  function readTitles() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(TITLE_KEY) : null;
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
    try { global.localStorage.setItem(TITLE_KEY, JSON.stringify(all)); return { ok: true }; }
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
  var VIDEO_KEY = 'rd_videosync_v1';
  function readVideoSyncAll() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(VIDEO_KEY) : null;
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
    try { global.localStorage.setItem(VIDEO_KEY, JSON.stringify(all)); return { ok: true }; }
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

  /* ---------- 라이더 · 장비 프로필 (전역, 마지막 입력값 유지) ---------- */
  /* 체중·스킬은 거의 안 바뀌고 윙·포일도 자주 안 바뀌므로, 한 번
     입력하면 다음 세션에 자동으로 채워지도록 브라우저에 저장한다.
     ("같은 입력 반복" 회피 — 코치가 매 세션 재입력하지 않게.) */
  var RIDER_KEY = 'rd_rider_v1';
  function saveRider(rider) {
    try {
      global.localStorage.setItem(RIDER_KEY, JSON.stringify(rider || {}));
      return { ok: true };
    } catch (e) { return { ok: false }; }
  }
  function loadRider() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(RIDER_KEY) : null;
      var o = raw ? JSON.parse(raw) : null;
      return (o && typeof o === 'object') ? o : null;
    } catch (e) { return null; }
  }

  var Storage = {
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
    saveRider: saveRider,
    loadRider: loadRider
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Storage;
  else global.RDStorage = Storage;
})(typeof window !== 'undefined' ? window : globalThis);
