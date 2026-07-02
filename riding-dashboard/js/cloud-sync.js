/* ============================================================
 * cloud-sync.js — 트랙·메타 Supabase 동기화 (§415 Sprint 1.1)
 *
 * 목표: "세션 저장하기" 시 트랙·분석 결과를 Supabase 에 올려
 *       cross-device 로 재현 가능하게 한다 (다른 기기 로그인 → 자동 fetch).
 *
 * 아키텍처 결정 (옥대표님 verbatim 2026-06-18):
 *   - 영상 파일은 Supabase 에 절대 업로드 X. 액션캠 용량이 커서 로컬
 *     (IndexedDB) 보관만. has_video 플래그만 metrics 에 기록한다.
 *   - GPX 트랙 + 분석 요약 + 점수 + 메타 = riding_sessions / riding_files
 *     테이블 + 'tracks' Storage 버킷에 저장 (migration 0004).
 *
 * 스키마 (supabase/migrations/0004_riding_sessions_storage.sql):
 *   riding_sessions  — rd_<uid>_sessions_v1 의 컴팩트 레코드 미러.
 *                      metrics jsonb 에 로컬 레코드 전체를 그대로 보관해
 *                      pull 시 무손실 복원한다. unique(user_id, client_session_id).
 *   riding_files     — 트랙(GPX) 파일 메타. storage_path =
 *                      '<uid>/<client_session_id>/track.gpx[.gz]'.
 *   tracks 버킷      — 본인 폴더(첫 segment=auth.uid())만 R/W (RLS).
 *
 * 설계 원칙:
 *   - localStorage-first. cloud 는 백업·동기 레이어. 오프라인/비로그인/
 *     실패 시 전부 로컬로 graceful fallback — 본 기능은 절대 저장을 막지 않는다.
 *   - storage.js 의 per-user namespace('rd_<uid>_*', §412) 와 동일 키에
 *     직접 쓰고 읽어, 기존 3개 렌더러(saved-table / profile §411 / intro §413)
 *     가 추가 작업 없이 cloud 데이터를 자기 로컬 경로로 표시한다.
 *   - DMJAuth(supabase-auth.js) 만 의존 — RDStorage 없이도 동작(profile.html).
 *
 * anon key 만 사용. service_role 절대 X. RLS 가 user_id 격리를 강제한다.
 * ============================================================ */
(function (global) {
  'use strict';

  var BUCKET = 'tracks';
  var SESS_SUFFIX  = 'sessions_v1';
  var TRACK_SUFFIX = 'track_v1_';
  var MIGR_SUFFIX  = 'cloud_migrated_v1';
  var TOMB_SUFFIX  = 'cloud_deleted_v1';   /* §415-del 삭제 tombstone */

  /* riding_sessions.sport CHECK 허용값 (0004). 벗어나면 insert 실패하므로
     매핑되지 않는 스포츠는 'other' 로 안전 변환. */
  var SPORT_OK = {
    wingfoil: 1, foilboarding: 1, kitefoil: 1, windfoil: 1,
    sup: 1, surf: 1, windsurf: 1, kite: 1, other: 1
  };

  /* ---------- auth / client ---------- */
  function auth() { return global.DMJAuth; }
  function uid() {
    try { return (auth() && auth().currentUserId()) || null; }
    catch (e) { return null; }
  }
  function ns() { var u = uid(); return u ? ('rd_' + u + '_') : null; }
  function sessKey()    { var p = ns(); return p ? p + SESS_SUFFIX : null; }
  function trackKey(id) { var p = ns(); return p ? p + TRACK_SUFFIX + id : null; }
  function migrKey()    { var p = ns(); return p ? p + MIGR_SUFFIX : null; }
  function tombKey()    { var p = ns(); return p ? p + TOMB_SUFFIX : null; }

  /* supabase 클라이언트 — DMJAuth._ensureClient() 로 부팅 보장 후 핸들 반환 */
  function client() {
    var a = auth();
    if (!a || typeof a._ensureClient !== 'function') {
      return Promise.reject(new Error('cloud-sync: DMJAuth unavailable'));
    }
    return a._ensureClient().then(function () {
      var sb = (typeof a._supabase === 'function') ? a._supabase() : null;
      if (!sb) throw new Error('cloud-sync: supabase client not ready');
      return sb;
    });
  }

  /* ---------- localStorage 헬퍼 (storage.js 와 동일 키) ---------- */
  function readSessions() {
    try {
      var k = sessKey(); if (!k) return [];
      var raw = global.localStorage ? global.localStorage.getItem(k) : null;
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeSessions(arr) {
    try {
      var k = sessKey(); if (!k) return false;
      global.localStorage.setItem(k, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }
  }
  function readLocalTrack(id) {
    try {
      var k = trackKey(id); if (!k) return null;
      var t = global.localStorage ? global.localStorage.getItem(k) : null;
      return (typeof t === 'string' && t) ? t : null;
    } catch (e) { return null; }
  }
  function writeLocalTrack(id, text) {
    try {
      var k = trackKey(id); if (!k) return false;
      global.localStorage.setItem(k, text);
      return true;
    } catch (e) { return false; }
  }

  /* ---------- 삭제 tombstone (§415-del) ----------
     로컬에서 삭제한 세션 id 를 기록한다. cloud 삭제가 오프라인/실패로 끝나도
     다음 pull 이 그 세션을 로컬에 부활시키지 않게 하고, pull 이 cloud 재삭제를
     재시도한다. cloud 에서 실제로 사라진 것이 확인되면 tombstone 을 지운다.
     형태 = { <client_session_id>: <epoch ms> }. */
  function readTomb() {
    try {
      var k = tombKey(); if (!k) return {};
      var raw = global.localStorage ? global.localStorage.getItem(k) : null;
      var o = raw ? JSON.parse(raw) : {};
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }
  function writeTomb(o) {
    try {
      var k = tombKey(); if (!k) return false;
      global.localStorage.setItem(k, JSON.stringify(o || {}));
      return true;
    } catch (e) { return false; }
  }
  function markDeleted(id)   { var o = readTomb(); o[id] = Date.now(); writeTomb(o); }
  function unmarkDeleted(id) { var o = readTomb(); if (o[id] != null) { delete o[id]; writeTomb(o); } }

  /* ---------- 값 정규화 (DB 컬럼 타입 안전) ---------- */
  function numOrNull(v) { return (v != null && isFinite(v)) ? Number(v) : null; }
  function intOrNull(v) { return (v != null && isFinite(v)) ? Math.round(Number(v)) : null; }
  function sportOrOther(s) { return (s && SPORT_OK[s]) ? s : 'other'; }
  /* GPX 압축 — storage.js compactGpx 와 동일 (태그 사이 공백 제거, 무손실) */
  function compactGpx(text) {
    return (typeof text === 'string') ? text.replace(/>\s+</g, '><').trim() : text;
  }

  /* ---------- gzip / gunzip (CompressionStream, 미지원 시 평문) ---------- */
  function gzip(str) {
    if (typeof global.CompressionStream === 'undefined' ||
        typeof global.Response === 'undefined') {
      return Promise.resolve({ blob: new global.Blob([str]), gz: false });
    }
    try {
      var cs = new global.CompressionStream('gzip');
      var stream = new global.Blob([str]).stream().pipeThrough(cs);
      return new global.Response(stream).blob().then(function (b) {
        return { blob: b, gz: true };
      });
    } catch (e) {
      return Promise.resolve({ blob: new global.Blob([str]), gz: false });
    }
  }
  function gunzip(blob, isGz) {
    if (!isGz || typeof global.DecompressionStream === 'undefined' ||
        typeof global.Response === 'undefined') {
      return blob.text();
    }
    try {
      var ds = new global.DecompressionStream('gzip');
      var stream = blob.stream().pipeThrough(ds);
      return new global.Response(stream).text();
    } catch (e) { return blob.text(); }
  }

  /* ---------- 레코드 ↔ DB row 매핑 ---------- */
  /* 로컬 컴팩트 레코드 → riding_sessions row. metrics 에 레코드 전체를
     담아 무손실 round-trip 을 보장한다 (정형 컬럼은 쿼리/정렬용 중복). */
  function recordToRow(u, rec, hasVideo) {
    var metrics = {};
    for (var k in rec) { if (rec.hasOwnProperty(k)) metrics[k] = rec[k]; }
    metrics._hasVideo = !!hasVideo;     /* 로컬에 영상 있음 표시 (Sprint 1.3 안내용) */
    return {
      user_id: u,
      client_session_id: rec.id,
      name: rec.name || null,
      sport: sportOrOther(rec.sport),
      session_date: rec.dateEpoch ? new Date(rec.dateEpoch).toISOString() : null,
      wind_dir_deg: numOrNull(rec.windDir),
      wind_speed_kt: numOrNull(rec.windSpeedKt),
      duration_sec: intOrNull(rec.durationSec),
      moving_time_sec: intOrNull(rec.movingTimeSec),
      distance_m: numOrNull(rec.distanceM),
      max_speed_ms: numOrNull(rec.maxSpeedMs),
      avg_speed_moving_ms: numOrNull(rec.avgSpeedMovingMs),
      metrics: metrics
    };
  }
  /* riding_sessions row → 로컬 컴팩트 레코드. metrics(레코드 전체) 를 베이스로
     쓰되 id/날짜는 정형 컬럼을 신뢰하고, hasTrack 은 cloud 트랙 존재로 덮는다. */
  function rowToRecord(row, hasCloudTrack) {
    var base = (row.metrics && typeof row.metrics === 'object') ? row.metrics : {};
    var rec = {};
    for (var k in base) { if (base.hasOwnProperty(k)) rec[k] = base[k]; }
    rec.id = row.client_session_id || rec.id;
    if (rec.name == null) rec.name = row.name || '라이딩 세션';
    if (rec.sport == null) rec.sport = row.sport || 'wingfoil';
    if (rec.dateEpoch == null && row.session_date) {
      rec.dateEpoch = new Date(row.session_date).getTime();
    }
    rec.hasTrack = !!hasCloudTrack;     /* cloud 에 트랙 파일 있으면 '다시 보기' 가능 */
    rec._cloud = true;
    return rec;
  }

  /* 트랙 storage 경로 — RLS 가 첫 segment=auth.uid() 를 요구한다 */
  function trackPath(u, sessId, gz) {
    return u + '/' + sessId + '/track.gpx' + (gz ? '.gz' : '');
  }

  /* ============================================================
   * pushSession — 1개 세션을 cloud 에 올린다 (저장 시 호출).
   *   record : Storage.saveSession() 가 반환한 컴팩트 레코드(res.record)
   *   gpxText: 원본 GPX (state.gpxText). record.hasTrack 이면 업로드.
   *   opts   : { hasVideo:boolean }
   * 반환 Promise<{ok, ...}>. 실패해도 reject 하지 않고 {ok:false} — 로컬은 유지.
   * ============================================================ */
  function pushSession(record, gpxText, opts) {
    opts = opts || {};
    var u = uid();
    if (!u) return Promise.resolve({ ok: false, reason: 'not-logged-in' });
    if (!record || !record.id) return Promise.resolve({ ok: false, reason: 'no-record' });

    var sessId = record.id;
    var hasGpx = !!(gpxText && record.hasTrack);

    return client().then(function (sb) {
      var row = recordToRow(u, record, opts.hasVideo);
      return sb.from('riding_sessions')
        .upsert(row, { onConflict: 'user_id,client_session_id' })
        .select('id').single()
        .then(function (res) {
          if (res.error) throw res.error;
          var sessionRowId = res.data && res.data.id;
          if (!hasGpx || !sessionRowId) {
            return { ok: true, sessionRowId: sessionRowId, track: false };
          }
          /* GPX → gzip → tracks 버킷 업로드 → riding_files upsert */
          return gzip(compactGpx(gpxText)).then(function (g) {
            var path = trackPath(u, sessId, g.gz);
            var ctype = g.gz ? 'application/gzip' : 'application/gpx+xml';
            return sb.storage.from(BUCKET)
              .upload(path, g.blob, { upsert: true, contentType: ctype })
              .then(function (up) {
                if (up.error) throw up.error;
                var frow = {
                  session_id: sessionRowId,
                  user_id: u,
                  kind: 'track',
                  storage_bucket: BUCKET,
                  storage_path: path,
                  file_name: g.gz ? 'track.gpx.gz' : 'track.gpx',
                  mime_type: ctype,
                  size_bytes: (g.blob && g.blob.size != null) ? g.blob.size : null
                };
                return sb.from('riding_files')
                  .upsert(frow, { onConflict: 'storage_bucket,storage_path' });
              })
              .then(function (fr) {
                if (fr.error) throw fr.error;
                return { ok: true, sessionRowId: sessionRowId, track: true, path: path };
              });
          });
        });
    }).catch(function (e) {
      console.warn('[RDCloud §415] pushSession failed', e);
      return { ok: false, error: String((e && e.message) || e) };
    });
  }

  /* ============================================================
   * pullSessions — cloud 의 모든 세션을 로컬 namespace 로 병합한다.
   *   cloud-first: 같은 client_session_id 는 cloud 가 로컬을 덮는다.
   *   트랙 GPX 는 여기서 받지 않는다(용량) — hasTrack 만 세팅, 실제
   *   다운로드는 ensureTrack 이 클릭 시점에 lazy 로 한다.
   * 완료 시 'rd:cloud-synced' 이벤트 → 기존 렌더러가 재렌더.
   * ============================================================ */
  function pullSessions() {
    var u = uid();
    if (!u) return Promise.resolve({ ok: false, reason: 'not-logged-in' });

    return client().then(function (sb) {
      return Promise.all([
        sb.from('riding_sessions').select('*').eq('user_id', u),
        sb.from('riding_files')
          .select('session_id, storage_path, file_name')
          .eq('user_id', u).eq('kind', 'track')
      ]);
    }).then(function (r) {
      var sRes = r[0], fRes = r[1];
      if (sRes.error) throw sRes.error;
      /* session row id → track file (존재 여부) */
      var trackBySessionRow = {};
      if (!fRes.error && Array.isArray(fRes.data)) {
        fRes.data.forEach(function (f) { trackBySessionRow[f.session_id] = f; });
      }
      var cloudRecs = (sRes.data || []).map(function (row) {
        return rowToRecord(row, !!trackBySessionRow[row.id]);
      });
      /* §415-del tombstone 반영: 삭제된 세션은 병합에서 제외(부활 차단).
         아직 cloud 에 남아 있으면 cloud 재삭제를 재시도(비동기), cloud 에서
         이미 사라졌으면 tombstone 을 정리한다. */
      var tomb = readTomb();
      var cloudIds = {};
      cloudRecs.forEach(function (rec) { if (rec && rec.id) cloudIds[rec.id] = 1; });
      var tombChanged = false;
      for (var tid in tomb) {
        if (!tomb.hasOwnProperty(tid)) continue;
        if (cloudIds[tid]) { deleteSession(tid); }        /* 아직 cloud 에 있음 → 재삭제 */
        else { delete tomb[tid]; tombChanged = true; }    /* cloud 에 없음 → tombstone 불필요 */
      }
      if (tombChanged) writeTomb(tomb);

      /* 병합: 로컬 → cloud 덮어쓰기 (cloud-first), id 기준 합집합. tombstone 제외. */
      var byId = {};
      readSessions().forEach(function (rec) { if (rec && rec.id) byId[rec.id] = rec; });
      cloudRecs.forEach(function (rec) { if (rec && rec.id) byId[rec.id] = rec; });
      var merged = [];
      for (var id in byId) { if (byId.hasOwnProperty(id) && !tomb[id]) merged.push(byId[id]); }
      merged.sort(function (a, b) { return (a.dateEpoch || 0) - (b.dateEpoch || 0); });
      writeSessions(merged);
      dispatch('rd:cloud-synced', { count: cloudRecs.length, total: merged.length });
      return { ok: true, count: cloudRecs.length, total: merged.length };
    }).catch(function (e) {
      console.warn('[RDCloud §415] pullSessions failed', e);
      return { ok: false, error: String((e && e.message) || e) };
    });
  }

  /* ============================================================
   * ensureTrack — 세션 GPX 가 로컬에 없으면 cloud 에서 받아 로컬에 저장.
   *   '다시 보기'/?session 진입 직전에 호출. 로컬에 있으면 즉시 resolve.
   *   파일 메타 조회 없이 RLS 경로 규약으로 직접 다운로드(.gz → 평문 순).
   * 반환 Promise<{ok, source}>. 실패해도 reject 안 함.
   * ============================================================ */
  function ensureTrack(id) {
    if (!id) return Promise.resolve({ ok: false, reason: 'no-id' });
    if (readLocalTrack(id)) return Promise.resolve({ ok: true, source: 'local' });

    /* uid 는 client() 안에서 읽는다 — ?session 딥링크는 auth 해소 전에
       호출될 수 있어, _ensureClient() 가 끝난 뒤라야 uid 가 확정된다. */
    return client().then(function (sb) {
      var u = uid();
      if (!u) throw new Error('not-logged-in');
      function tryDownload(gz) {
        return sb.storage.from(BUCKET).download(trackPath(u, id, gz)).then(function (res) {
          if (res.error || !res.data) throw (res.error || new Error('no-data'));
          return gunzip(res.data, gz);
        });
      }
      /* 압축본 우선, 없으면 평문(구버전/CompressionStream 미지원 업로드) */
      return tryDownload(true).catch(function () { return tryDownload(false); });
    }).then(function (text) {
      if (typeof text !== 'string' || !text) return { ok: false, reason: 'empty' };
      return writeLocalTrack(id, text)
        ? { ok: true, source: 'cloud' }
        : { ok: false, reason: 'local-write-failed' };
    }).catch(function (e) {
      console.warn('[RDCloud §415] ensureTrack failed', id, e);
      return { ok: false, error: String((e && e.message) || e) };
    });
  }

  /* ============================================================
   * deleteSession — 세션 1개를 cloud 에서 삭제한다 (로컬 삭제 시 호출).
   *   1) tracks 버킷의 트랙 파일 제거 (.gz·평문 둘 다, best-effort)
   *   2) riding_sessions row 삭제 → riding_files 는 FK on delete cascade 로 함께
   *      삭제된다 (0004: riding_files.session_id references riding_sessions(id)).
   *   삭제 id 를 먼저 tombstone 에 기록해, 오프라인/실패로 cloud 가 남아도 다음
   *   pull 이 로컬에 부활시키지 않게 한다. cloud 삭제가 확정되면 tombstone 제거.
   * 반환 Promise<{ok,...}>. 실패해도 reject 안 함 (로컬 삭제는 이미 완료됨).
   * ============================================================ */
  function deleteSession(id) {
    if (!id) return Promise.resolve({ ok: false, reason: 'no-id' });
    markDeleted(id);                              /* 먼저 기록 — pull 부활 차단 */
    var u = uid();
    if (!u) return Promise.resolve({ ok: false, reason: 'not-logged-in', tombstoned: true });
    return client().then(function (sb) {
      /* 스토리지 오브젝트 제거 — 없는 경로여도 무해(best-effort, 실패 무시) */
      return sb.storage.from(BUCKET)
        .remove([trackPath(u, id, true), trackPath(u, id, false)])
        .catch(function () { /* best-effort */ })
        .then(function () {
          return sb.from('riding_sessions').delete()
            .eq('user_id', u).eq('client_session_id', id);   /* 본인 세션만 (RLS 도 강제) */
        })
        .then(function (res) {
          if (res && res.error) throw res.error;
          unmarkDeleted(id);                      /* cloud 삭제 확정 → tombstone 제거 */
          return { ok: true };
        });
    }).catch(function (e) {
      console.warn('[RDCloud §415] deleteSession failed', id, e);
      return { ok: false, error: String((e && e.message) || e), tombstoned: true };
    });
  }

  /* ============================================================
   * migrateLocalToCloud — 기존 로컬 전용 세션을 cloud 로 1회 올린다.
   *   업로드는 멱등(upsert)이라 이미 있는 세션은 갱신만 된다. 완료 후
   *   per-user 플래그(rd_<uid>_cloud_migrated_v1) 로 재실행을 막는다.
   *   영상 has_video 는 마이그레이션 시점엔 false (현재 세션만 정확 판정).
   * 충돌 시 cloud 우선 정책은 이후 pullSessions 가 보장한다.
   * ============================================================ */
  function migrateLocalToCloud() {
    var u = uid();
    if (!u) return Promise.resolve({ ok: false, reason: 'not-logged-in' });
    var fk = migrKey();
    try { if (fk && global.localStorage.getItem(fk)) return Promise.resolve({ ok: true, skipped: 'already' }); }
    catch (e) {}

    var local = readSessions();
    if (!local.length) {
      try { if (fk) global.localStorage.setItem(fk, '1'); } catch (e) {}
      return Promise.resolve({ ok: true, pushed: 0 });
    }
    /* 순차 업로드 — Storage rate/용량 부담 완화. 일부 실패해도 flag 미설정 →
       다음 로그인에 재시도. */
    var pushed = 0, failed = 0;
    var chain = Promise.resolve();
    local.forEach(function (rec) {
      chain = chain.then(function () {
        var gpx = readLocalTrack(rec.id);
        return pushSession(rec, gpx, { hasVideo: false }).then(function (r) {
          if (r && r.ok) pushed++; else failed++;
        });
      });
    });
    return chain.then(function () {
      if (!failed) { try { if (fk) global.localStorage.setItem(fk, u + '@1'); } catch (e) {} }
      return { ok: failed === 0, pushed: pushed, failed: failed };
    });
  }

  /* ============================================================
   * autoSync — 로그인 해소 시 migrate → pull 을 1회 실행.
   *   per-uid 가드로 중복 실행 방지. dmj-auth-change(SIGNED_IN/PROFILE_SYNCED)
   *   에서 호출되고, 스크립트 로드 시 이미 로그인 상태면 즉시 한 번 시도.
   * ============================================================ */
  var _syncedUid = null;
  var _syncing = false;
  function autoSync(force) {
    var u = uid();
    if (!u) return Promise.resolve({ ok: false, reason: 'not-logged-in' });
    if (_syncing) return Promise.resolve({ ok: false, reason: 'in-progress' });
    if (!force && _syncedUid === u) return Promise.resolve({ ok: true, skipped: 'done' });
    _syncing = true;
    return migrateLocalToCloud().then(pullSessions).then(function (res) {
      _syncedUid = u; _syncing = false;
      return res;
    }).catch(function (e) {
      _syncing = false;
      console.warn('[RDCloud §415] autoSync failed', e);
      return { ok: false, error: String((e && e.message) || e) };
    });
  }

  /* ---------- 이벤트 ---------- */
  function dispatch(name, detail) {
    try { global.dispatchEvent(new global.CustomEvent(name, { detail: detail || {} })); }
    catch (e) {}
  }

  /* 로그인 해소/전환 시 자동 동기화. 로그아웃(isLoggedIn=false)은 no-op —
     로컬 격리는 storage.js namespace 가 담당. uid 가 바뀌면 가드 리셋. */
  if (global.addEventListener) {
    global.addEventListener('dmj-auth-change', function (ev) {
      var d = ev && ev.detail;
      if (d && d.isLoggedIn) {
        if (_syncedUid && _syncedUid !== uid()) _syncedUid = null;
        autoSync();
      } else {
        _syncedUid = null;
      }
    });
  }
  /* 스크립트가 DMJAuth 부팅 이후 로드된 경우(이미 로그인) 즉시 1회 */
  if (uid()) { try { autoSync(); } catch (e) {} }

  var RDCloud = {
    pushSession: pushSession,
    pullSessions: pullSessions,
    ensureTrack: ensureTrack,
    migrateLocalToCloud: migrateLocalToCloud,
    autoSync: autoSync,
    /* 내부 노출 (테스트/디버그용) */
    _ns: ns,
    _recordToRow: recordToRow,
    _rowToRecord: rowToRecord,
    _trackPath: trackPath
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RDCloud;
  else global.RDCloud = RDCloud;

})(typeof window !== 'undefined' ? window : globalThis);
