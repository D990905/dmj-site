/* ============================================================
 * selftest-session-title.js — 세션 제목 편집·저장·재로드 self-test
 *
 * 헤더의 세션 제목은 파일명에서 자동 생성된다(기술적·난해). 사용자가
 * 직접 다듬은 제목을 세션 시그니처별로 저장해(Storage.saveSessionTitle)
 * 같은 트랙을 다시 불러와도 유지되는지, 그리고 ' · 편집본' 상태가
 * 제목 본문이 아니라 별도 레코드 플래그(edited)로 분리됐는지 검증한다.
 *
 *   실행:  node selftest-session-title.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * 검증 핵심:
 *  · saveSessionTitle / loadSessionTitle 시그니처별 저장 라운드트립.
 *  · 부산 송정 GPX 를 두 번 독립 파싱해도 시그니처가 동일 →
 *    편집한 제목이 '재로드' 후에도 유지된다.
 *  · 빈/공백 제목 저장 = 항목 삭제 = 파일명 기반 자동 제목으로 복귀.
 *  · buildRecord 가 제목 본문(name)과 편집본 여부(edited)를 분리.
 *  · stripEditedSuffix 가 구버전 ' · 편집본' 접미사를 정규화(앱과 동일).
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var DIR = __dirname;

/* --- localStorage 셰임 — storage.js 는 global.localStorage 를 쓴다.
       storage.js 를 require 하기 전에 설치해야 한다. --- */
var mem = {};
global.localStorage = {
  getItem: function (k) {
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
  },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; },
  key: function (i) { return Object.keys(mem)[i]; },
  get length() { return Object.keys(mem).length; }
};

var Storage = require(path.join(DIR, 'js', 'storage.js'));
var An = require(path.join(DIR, 'js', 'analysis.js'));

var pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}

/* --- sessionSignature — app.js 의 비공개 정의를 그대로 복제한다.
       (트랙 구조 → 키. 같은 GPX 는 항상 같은 시그니처) --- */
function sessionSignature(s) {
  return (s.pointCount || 0) + '_' + Math.round(s.totalDistanceM || 0) +
         '_' + (s.startEpoch || 0);
}

/* --- stripEditedSuffix — app.js 의 정의와 동일 정규식 --- */
function stripEditedSuffix(name) {
  return String(name == null ? '' : name).replace(/\s*·\s*편집본\s*$/, '').trim();
}

/* --- 경량 GPX 파서 — selftest-track-edit-merge.js 와 동일 규칙 --- */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var tM = m[3].match(/<time>([^<]+)<\/time>/);
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]), ele: 0,
      time: tM ? Date.parse(tM[1]) : null, speed: null, hr: null
    });
  }
  var withTime = pts.filter(function (p) { return p.time != null; }).length;
  return {
    tracks: [{ name: 'busan', segments: [pts] }],
    pointCount: pts.length, trackName: '부산 송정',
    hasTime: withTime >= pts.length * 0.5, speedSource: 'derived'
  };
}

/* --- 부산 송정 GPX 로드 (재로드 시뮬레이션 위해 매번 독립 파싱) --- */
var gpxText = fs.readFileSync(
  path.join(DIR, 'sample', 'sample-songjeong-busan.gpx'), 'utf8');
function loadSession() { return An.normalizeSession(parseGPX(gpxText)); }

var s1 = loadSession();
var sig1 = sessionSignature(s1);
check('부산 송정 GPX — 시각 정보 있음', s1.hasTime);
check('세션 시그니처 생성됨', !!sig1, sig1);

/* === (1) 편집 전 — 사용자 지정 제목 없음 → 자동 제목이 기본값 === */
check('초기엔 저장된 제목 없음 (자동 제목 사용)',
  Storage.loadSessionTitle(sig1) === null);

/* === (2) 제목 편집 → 저장 === */
var customTitle = '부산 송정 — 아침 라이딩';
var sv = Storage.saveSessionTitle(sig1, customTitle);
check('편집한 제목 저장 ok', sv && sv.ok === true);
check('저장 직후 제목 조회', Storage.loadSessionTitle(sig1) === customTitle);

/* === (3) 재로드 — GPX 를 다시 파싱해도 시그니처 동일 → 제목 유지 === */
var s2 = loadSession();
var sig2 = sessionSignature(s2);
check('재파싱 시그니처가 동일', sig2 === sig1, sig1 + ' vs ' + sig2);
check('재로드 후 편집한 제목 유지', Storage.loadSessionTitle(sig2) === customTitle);

/* === (4) 앞뒤 공백 정리 후 저장 === */
Storage.saveSessionTitle(sig1, '   공백 트림 테스트   ');
check('제목 앞뒤 공백 트림', Storage.loadSessionTitle(sig1) === '공백 트림 테스트');

/* === (5) 빈/공백 제목 저장 = 항목 삭제 = 자동 제목으로 복귀 === */
Storage.saveSessionTitle(sig1, '    ');
check('공백만 입력 시 항목 삭제 (자동 제목 복귀)',
  Storage.loadSessionTitle(sig1) === null);
Storage.saveSessionTitle(sig1, customTitle);
Storage.saveSessionTitle(sig1, '');
check('빈 문자열 저장 시 항목 삭제', Storage.loadSessionTitle(sig1) === null);

/* === (6) 세션별 제목 독립 — 키 충돌 없음 === */
Storage.saveSessionTitle(sig1, customTitle);
Storage.saveSessionTitle('99_8888_7777', '다른 세션 제목');
check('세션별 제목 독립 보관',
  Storage.loadSessionTitle(sig1) === customTitle &&
  Storage.loadSessionTitle('99_8888_7777') === '다른 세션 제목');

/* === (7) 세션 레코드 — 제목 본문(name)과 편집본 여부(edited) 분리 === */
var analysis = An.analyzeSession(s1);
var rEd = Storage.saveSession({
  name: customTitle, edited: true,
  dateEpoch: s1.startEpoch || Date.now(), sport: 'wingfoil', gpxText: gpxText
}, analysis);
check('편집본 세션 저장 ok', rEd && rEd.ok === true);
check('레코드 name 에 " · 편집본" 접미사 없음',
  rEd.record.name === customTitle && rEd.record.name.indexOf('편집본') === -1,
  rEd.record.name);
check('편집 상태는 edited 플래그로 분리 저장', rEd.record.edited === true);

var rPlain = Storage.saveSession({
  name: customTitle, edited: false,
  dateEpoch: (s1.startEpoch || Date.now()) + 1000, sport: 'wingfoil', gpxText: gpxText
}, analysis);
check('비편집 세션 edited=false', rPlain.record.edited === false);

/* listSessions 로 다시 조회해도 name·edited 유지 */
var listed = Storage.listSessions();
var editedRecs = listed.filter(function (r) { return r.edited === true; });
check('listSessions 가 edited 레코드 반환',
  editedRecs.length >= 1 && editedRecs[0].name === customTitle,
  editedRecs.length + '건');

/* === (8) stripEditedSuffix — 구버전 ' · 편집본' 접미사 정규화 === */
check('구버전 이름의 " · 편집본" 접미사 제거',
  stripEditedSuffix('Waterspeed 2026-05-18T06.17.44.000Z · 편집본')
    === 'Waterspeed 2026-05-18T06.17.44.000Z');
check('접미사 없는 이름은 그대로 유지',
  stripEditedSuffix('송정 아침 라이딩') === '송정 아침 라이딩');
check('null/undefined 이름도 안전', stripEditedSuffix(null) === '' &&
  stripEditedSuffix(undefined) === '');

/* --- 결과 --- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
