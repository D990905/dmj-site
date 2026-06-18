/* ============================================================
 * selftest-415-cloud-sync.js — §415 Sprint 1.1 트랙·메타 cloud sync 검증
 *
 * cloud-sync.js (window.RDCloud) 의 push/pull/ensureTrack/migrate 를
 * mock Supabase 클라이언트 + mock localStorage 로 오프라인 검증한다.
 * (live Supabase 검증은 백엔드 배포 후 — RUNBOOK_415_cloud_sync.md §G)
 *
 *   실행:  node selftest-415-cloud-sync.js
 * ============================================================ */
'use strict';

var pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(' ', ok ? 'PASS' : 'FAIL', '', name, info ? '· ' + info : '');
}

var UID = 'user-abc-123';

/* ---------- 전역 mock (require 전에 설치) ---------- */
delete globalThis.CompressionStream;     /* 평문 경로 강제 → 파일명 track.gpx 결정적 */
delete globalThis.DecompressionStream;

var events = [];
globalThis.CustomEvent = function (name, opts) { this.type = name; this.detail = opts && opts.detail; };
globalThis.dispatchEvent = function (ev) { events.push(ev); return true; };
globalThis.addEventListener = function () {};   /* cloud-sync 가 로드 시 리스너 등록 — no-op */

function makeLS() {
  var m = {};
  return {
    getItem: function (k) { return (k in m) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
    _dump: function () { return m; }
  };
}
globalThis.localStorage = makeLS();

var currentUid = null;     /* require 시점엔 null → 로드-타임 autoSync 스킵 */
var currentSb = null;
globalThis.DMJAuth = {
  currentUserId: function () { return currentUid; },
  _ensureClient: function () { return Promise.resolve(); },
  _supabase: function () { return currentSb; }
};

/* mock supabase 클라이언트 — upsert/select/eq/single 체인 + storage upload/download */
function makeSb(captures, data) {
  function tableBuilder(table) {
    var b = {
      _table: table, _upsert: null,
      select: function () { return b; },
      eq: function () { return b; },
      single: function () { return resolveQuery(); },
      upsert: function (row, opts) {
        captures.push({ op: 'upsert', table: table, row: row, opts: opts });
        b._upsert = { row: row, opts: opts };
        return b;
      },
      then: function (res, rej) { return resolveQuery().then(res, rej); }
    };
    function resolveQuery() {
      if (b._upsert) {
        if (table === 'riding_sessions') {
          return Promise.resolve({ data: { id: 'srow-' + b._upsert.row.client_session_id }, error: null });
        }
        return Promise.resolve({ data: null, error: null });   /* riding_files */
      }
      if (table === 'riding_sessions') return Promise.resolve({ data: data.sessions || [], error: null });
      if (table === 'riding_files')    return Promise.resolve({ data: data.files || [], error: null });
      return Promise.resolve({ data: [], error: null });
    }
    return b;
  }
  var storage = {
    from: function (bucket) {
      return {
        upload: function (path, blob, opts) {
          captures.push({ op: 'upload', bucket: bucket, path: path, opts: opts, size: blob && blob.size });
          return Promise.resolve({ data: { path: path }, error: null });
        },
        download: function (path) {
          captures.push({ op: 'download', bucket: bucket, path: path });
          if (/\.gz$/.test(path)) return Promise.resolve({ data: null, error: { message: 'not found' } });
          var text = (data.trackText != null) ? data.trackText : '<gpx/>';
          return Promise.resolve({ data: new globalThis.Blob([text]), error: null });
        }
      };
    }
  };
  return { from: tableBuilder, storage: storage };
}

var RDCloud = require('./js/cloud-sync.js');

/* 컴팩트 레코드 샘플 (storage.js buildRecord 형태 일부) */
function sampleRecord(id, over) {
  var r = {
    id: id, name: '테스트 세션', sport: 'wingfoil', dateEpoch: 1718000000000,
    windDir: 211.4, windSpeedKt: 14.2, durationSec: 3600, movingTimeSec: 3000,
    distanceM: 25000.7, maxSpeedMs: 18.3, avgSpeedMovingMs: 9.1,
    tackCount: 12, gybeCount: 8, hasTrack: true, vpsOverall: 72
  };
  for (var k in (over || {})) r[k] = over[k];
  return r;
}

(async function run() {
  /* ---------- 1) pushSession ---------- */
  {
    currentUid = UID;
    globalThis.localStorage = makeLS();
    var caps = [];
    currentSb = makeSb(caps, {});
    var rec = sampleRecord('rd_1_111');
    var res = await RDCloud.pushSession(rec, '<gpx>  <trk/>  </gpx>', { hasVideo: true });

    check('pushSession ok', res && res.ok === true, JSON.stringify(res));

    var sessUpsert = caps.filter(function (c) { return c.op === 'upsert' && c.table === 'riding_sessions'; })[0];
    check('riding_sessions upsert 발생', !!sessUpsert);
    check('client_session_id = record.id', sessUpsert && sessUpsert.row.client_session_id === 'rd_1_111');
    check('onConflict = user_id,client_session_id (멱등 upsert)',
      sessUpsert && sessUpsert.opts && sessUpsert.opts.onConflict === 'user_id,client_session_id');
    check('user_id 태깅', sessUpsert && sessUpsert.row.user_id === UID);
    check('정형 컬럼 매핑 (distance_m·max_speed_ms·wind_dir_deg)',
      sessUpsert && sessUpsert.row.distance_m === 25000.7 &&
      sessUpsert.row.max_speed_ms === 18.3 && sessUpsert.row.wind_dir_deg === 211.4);
    check('metrics 에 레코드 전체 보존 (무손실 round-trip)',
      sessUpsert && sessUpsert.row.metrics && sessUpsert.row.metrics.vpsOverall === 72 &&
      sessUpsert.row.metrics.id === 'rd_1_111');
    check('metrics._hasVideo = true (영상 로컬 보유 플래그)',
      sessUpsert && sessUpsert.row.metrics._hasVideo === true);

    var upload = caps.filter(function (c) { return c.op === 'upload'; })[0];
    check('tracks 버킷 업로드 발생', !!upload && upload.bucket === 'tracks');
    check('Storage 경로 = <uid>/<sessid>/track.gpx (RLS 첫 segment=uid)',
      upload && upload.path === UID + '/rd_1_111/track.gpx', upload && upload.path);

    var fileUpsert = caps.filter(function (c) { return c.op === 'upsert' && c.table === 'riding_files'; })[0];
    check('riding_files 행 생성 (kind=track)', !!fileUpsert && fileUpsert.row.kind === 'track');
    check('riding_files onConflict = storage_bucket,storage_path',
      fileUpsert && fileUpsert.opts && fileUpsert.opts.onConflict === 'storage_bucket,storage_path');
  }

  /* ---------- 2) sport CHECK 안전 변환 ---------- */
  {
    currentUid = UID;
    globalThis.localStorage = makeLS();
    var caps2 = [];
    currentSb = makeSb(caps2, {});
    await RDCloud.pushSession(sampleRecord('rd_2', { sport: 'jetski', hasTrack: false }), null, {});
    var up = caps2.filter(function (c) { return c.op === 'upsert' && c.table === 'riding_sessions'; })[0];
    check('미허용 sport → other 로 안전 변환 (CHECK 위반 방지)', up && up.row.sport === 'other');
    check('hasTrack=false → 트랙 업로드 안 함', caps2.filter(function (c) { return c.op === 'upload'; }).length === 0);
  }

  /* ---------- 3) pullSessions cloud-first 병합 ---------- */
  {
    currentUid = UID;
    globalThis.localStorage = makeLS();
    /* 로컬에 1건 (id=rd_local), cloud 에 2건 (rd_local 갱신본 + rd_cloud 신규) */
    var localKey = 'rd_' + UID + '_sessions_v1';
    globalThis.localStorage.setItem(localKey, JSON.stringify([
      { id: 'rd_local', name: '로컬 옛버전', dateEpoch: 100, hasTrack: true }
    ]));
    var caps3 = [];
    currentSb = makeSb(caps3, {
      sessions: [
        { id: 'srowA', client_session_id: 'rd_local', name: '클라우드 갱신본', session_date: '2024-06-10T00:00:00Z',
          metrics: { id: 'rd_local', name: '클라우드 갱신본', dateEpoch: 200, distanceM: 999 } },
        { id: 'srowB', client_session_id: 'rd_cloud', name: '다른 기기 세션', session_date: '2024-06-11T00:00:00Z',
          metrics: { id: 'rd_cloud', name: '다른 기기 세션', dateEpoch: 300 } }
      ],
      files: [{ session_id: 'srowB', storage_path: UID + '/rd_cloud/track.gpx.gz', file_name: 'track.gpx.gz' }]
    });
    var res3 = await RDCloud.pullSessions();
    check('pullSessions ok, count=2', res3 && res3.ok && res3.count === 2, JSON.stringify(res3));

    var merged = JSON.parse(globalThis.localStorage.getItem(localKey));
    var byId = {}; merged.forEach(function (r) { byId[r.id] = r; });
    check('병합 = 합집합 2건 (rd_local + rd_cloud)', merged.length === 2 && byId.rd_local && byId.rd_cloud);
    check('cloud-first: rd_local 이 클라우드 갱신본으로 덮임',
      byId.rd_local && byId.rd_local.name === '클라우드 갱신본' && byId.rd_local.distanceM === 999);
    check('cloud 트랙 있는 세션 hasTrack=true (rd_cloud)', byId.rd_cloud && byId.rd_cloud.hasTrack === true);
    check('cloud 트랙 없는 세션 hasTrack=false (rd_local)', byId.rd_local && byId.rd_local.hasTrack === false);
    check('rd:cloud-synced 이벤트 dispatch', events.some(function (e) { return e.type === 'rd:cloud-synced'; }));
  }

  /* ---------- 4) ensureTrack 다운로드 round-trip (gz→평문 fallback) ---------- */
  {
    currentUid = UID;
    globalThis.localStorage = makeLS();
    var caps4 = [];
    currentSb = makeSb(caps4, { trackText: '<gpx><trk>round-trip</trk></gpx>' });
    var res4 = await RDCloud.ensureTrack('rd_dl');
    check('ensureTrack ok, source=cloud', res4 && res4.ok && res4.source === 'cloud', JSON.stringify(res4));
    var dls = caps4.filter(function (c) { return c.op === 'download'; });
    check('.gz 먼저 시도 후 평문 fallback (2회 download)', dls.length === 2 &&
      /\.gz$/.test(dls[0].path) && !/\.gz$/.test(dls[1].path));
    var stored = globalThis.localStorage.getItem('rd_' + UID + '_track_v1_rd_dl');
    check('다운로드 GPX 가 로컬 트랙 키에 저장됨', stored === '<gpx><trk>round-trip</trk></gpx>');

    /* 로컬에 이미 있으면 네트워크 없이 즉시 */
    var caps4b = []; currentSb = makeSb(caps4b, {});
    var res4b = await RDCloud.ensureTrack('rd_dl');
    check('로컬 트랙 있으면 download 없이 source=local',
      res4b && res4b.ok && res4b.source === 'local' && caps4b.length === 0);
  }

  /* ---------- 5) migrateLocalToCloud + flag ---------- */
  {
    currentUid = UID;
    globalThis.localStorage = makeLS();
    var localKey5 = 'rd_' + UID + '_sessions_v1';
    globalThis.localStorage.setItem(localKey5, JSON.stringify([
      sampleRecord('rd_m1', { hasTrack: false }), sampleRecord('rd_m2', { hasTrack: false })
    ]));
    var caps5 = []; currentSb = makeSb(caps5, {});
    var res5 = await RDCloud.migrateLocalToCloud();
    check('migrate ok, pushed=2', res5 && res5.ok && res5.pushed === 2, JSON.stringify(res5));
    check('마이그레이션 완료 flag 설정 (rd_<uid>_cloud_migrated_v1)',
      !!globalThis.localStorage.getItem('rd_' + UID + '_cloud_migrated_v1'));

    /* 재호출 시 skip */
    var caps5b = []; currentSb = makeSb(caps5b, {});
    var res5b = await RDCloud.migrateLocalToCloud();
    check('재호출 시 flag 로 skip (중복 업로드 방지)',
      res5b && res5b.skipped === 'already' && caps5b.length === 0);
  }

  /* ---------- 6) 비로그인 graceful fallback ---------- */
  {
    currentUid = null;
    globalThis.localStorage = makeLS();
    var rP = await RDCloud.pushSession(sampleRecord('rd_x'), '<gpx/>', {});
    var rL = await RDCloud.pullSessions();
    var rE = await RDCloud.ensureTrack('rd_x');
    check('비로그인: push/pull/ensureTrack 모두 reject 없이 {ok:false}',
      rP.ok === false && rL.ok === false && rE.ok === false, 'graceful — 로컬 저장 무영향');
  }

  console.log('\n' + '-'.repeat(44));
  console.log('PASS:', pass, ' FAIL:', fail);
  process.exit(fail > 0 ? 1 : 0);
})().catch(function (e) {
  console.error('selftest crashed:', e);
  process.exit(2);
});
