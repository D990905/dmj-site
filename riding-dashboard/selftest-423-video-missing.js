/* ============================================================
 * selftest-423-video-missing.js — §423 영상 없음 안내 (cross-device) 검증
 *
 * 실제 배포 코드를 그대로 로드해 검증한다 (replicate 아님):
 *   · replay.js   → RDReplay._test.videoMissingOnDevice  (배너 판정 predicate)
 *   · cloud-sync.js → RDCloud._recordToRow / _rowToRecord (_hasVideo 계약)
 *   · i18n.js     → RDI18n.T                              (KO/EN 키)
 *
 * node 미설치 env 라 JavaScriptCore(osascript -l JavaScript)로 구동한다.
 * 브라우저 전역(document/localStorage 등)은 로드에 필요한 최소만 shim.
 *
 *   실행:  cd riding-dashboard && osascript -l JavaScript selftest-423-video-missing.js
 * ============================================================ */
'use strict';
ObjC.import('Foundation');

function readFile(p) {
  var s = $.NSString.stringWithContentsOfFileEncodingError(p, $.NSUTF8StringEncoding, null);
  if (!s) throw new Error('read fail: ' + p);
  return ObjC.unwrap(s);
}

var pass = 0, fail = 0, lines = [];
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  lines.push((ok ? '  PASS  ' : '  FAIL  ') + name + (info ? '  · ' + info : ''));
}
function eq(name, got, want) {
  check(name, got === want, got === want ? '' : ('got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)));
}

/* ---------- 브라우저 전역 최소 shim ---------- */
var G = globalThis;
var _ls = {};
G.localStorage = {
  getItem: function (k) { return (k in _ls) ? _ls[k] : null; },
  setItem: function (k, v) { _ls[k] = String(v); },
  removeItem: function (k) { delete _ls[k]; }
};
G.CustomEvent = function (n, o) { this.type = n; this.detail = o && o.detail; };
G.dispatchEvent = function () { return true; };   /* setLang 의 rd:langchange 알림 */
G.window = G;                                      /* i18n setLang 이 window.dispatchEvent 사용 */
G.MutationObserver = function (cb) { this.observe = function () {}; this.disconnect = function () {}; };
G.NodeFilter = { SHOW_TEXT: 4 };
var _bodyStub = { nodeType: 1, querySelectorAll: function () { return []; } };
G.document = {
  readyState: 'complete',
  body: _bodyStub,
  documentElement: { setAttribute: function () {} },
  head: { appendChild: function () {} },
  getElementById: function () { return null; },
  createElement: function () { return { setAttribute: function () {}, appendChild: function () {} }; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {},
  createTreeWalker: function () { return { nextNode: function () { return null; } }; }
};
/* cloud-sync 는 로드 시 uid()=null(autoSync skip) · global.addEventListener 없음(skip) */

/* ---------- 배포 코드 로드 (indirect eval → 전역에 부착) ---------- */
var gEval = eval;
gEval(readFile('js/replay.js'));
gEval(readFile('js/cloud-sync.js'));
gEval(readFile('js/i18n.js'));

/* ============================================================
 * A. 배너 판정 predicate — RDReplay._test.videoMissingOnDevice
 *    spec 4 시나리오 + 경계.
 * ============================================================ */
var vm = G.RDReplay && G.RDReplay._test && G.RDReplay._test.videoMissingOnDevice;
check('replay.js 로드 + videoMissingOnDevice 노출', typeof vm === 'function');
if (typeof vm === 'function') {
  /* 시나리오 1 — cloud hasVideo=true, 이 기기 영상 0 → 배너 O */
  eq('S1 cloud 有·local 0 → 배너', vm(true, 0), true);
  /* 시나리오 2 — 원래 영상 없던 세션(hasVideo=false) → 배너 X */
  eq('S2 cloud 無 → 배너 X', vm(false, 0), false);
  /* 시나리오 3 — 이 기기에 영상 있음 → 배너 X (정상 재생) */
  eq('S3 local 有 → 배너 X', vm(true, 2), false);
  /* 시나리오 4 — 업로드 후(클립 1개 생김) → 배너 X */
  eq('S4 업로드 후 1클립 → 배너 X', vm(true, 1), false);
  /* 경계 — clipCount undefined(0 취급), flag undefined */
  eq('경계 flag=true·count=undefined → O', vm(true, undefined), true);
  eq('경계 flag=undefined·count=0 → X', vm(undefined, 0), false);
  eq('경계 flag=false·count=2 → X', vm(false, 2), false);
}

/* ============================================================
 * B. cloud-sync _hasVideo 계약 — recordToRow 기록 · rowToRecord 보존
 *    (app.js 가 rec._hasVideo 로 판정하므로 round-trip 무손실이 필수)
 * ============================================================ */
var RDC = G.RDCloud;
check('cloud-sync.js 로드 + RDCloud 노출', !!(RDC && RDC._recordToRow && RDC._rowToRecord));
if (RDC && RDC._recordToRow) {
  var rowT = RDC._recordToRow('u1', { id: 's1', name: 'x', sport: 'wingfoil' }, true);
  eq('recordToRow hasVideo=true → metrics._hasVideo', rowT.metrics._hasVideo, true);
  var rowF = RDC._recordToRow('u1', { id: 's1' }, false);
  eq('recordToRow hasVideo=false → metrics._hasVideo', rowF.metrics._hasVideo, false);

  var recT = RDC._rowToRecord({ client_session_id: 's1', metrics: { _hasVideo: true, foo: 7 } }, false);
  eq('rowToRecord _hasVideo 보존(true)', recT._hasVideo, true);
  eq('rowToRecord 기타 metrics 보존(foo)', recT.foo, 7);
  var recF = RDC._rowToRecord({ client_session_id: 's2', metrics: { _hasVideo: false } }, false);
  eq('rowToRecord _hasVideo 보존(false)', recF._hasVideo, false);
}

/* ============================================================
 * C. i18n 키 — RDI18n.T 로 EN/KO 양쪽 확인
 * ============================================================ */
var I = G.RDI18n;
check('i18n.js 로드 + RDI18n 노출', !!(I && I.T && I.setLang));
if (I && I.T) {
  I.setLang('en');
  eq('EN title', I.T('이 기기에 영상이 없습니다'), 'No video on this device');
  eq('EN uploadBtn', I.T('📤 영상 업로드'), '📤 Upload Video');
  eq('EN skipBtn', I.T('영상 없이 분석만 보기'), 'View analysis without video');
  eq('EN toast', I.T('✓ 영상이 동기화되었습니다'), '✓ Video synced');
  eq('EN uploadedAt(보간)',
    I.T('다른 기기에서 {date}에 저장한 세션입니다.', { date: '2026-06-11' }),
    'Saved on another device on 2026-06-11.');
  check('EN body 비어있지 않음 + 영문화',
    I.T('다른 기기에서 업로드한 영상은 클라우드에 저장되지 않아 이 기기에 없습니다. 영상을 보시려면 같은 영상 파일을 다시 업로드해 주세요.')
      .indexOf('re-upload') >= 0);
  /* KO 모드 — 원문(소스) 반환 */
  I.setLang('ko');
  eq('KO title 원문', I.T('이 기기에 영상이 없습니다'), '이 기기에 영상이 없습니다');
  eq('KO uploadedAt 원문 보간',
    I.T('다른 기기에서 {date}에 저장한 세션입니다.', { date: '2026-06-11' }),
    '다른 기기에서 2026-06-11에 저장한 세션입니다.');
}

/* ---------- 결과 ---------- */
lines.push('');
lines.push('§423 video-missing selftest — ' + pass + ' PASS / ' + fail + ' FAIL  ' +
  (fail === 0 ? '[ALL PASS]' : '[HAS FAIL]'));
lines.join('\n');
