/* §509 트랙 압축 저장 — 왕복 무손실·용량·하위호환 */
var S = require('./js/storage.js');
var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }

function track(n, dtSec) {
  var p = [];
  for (var i = 0; i < n; i++) {
    p.push({ lat: 37.7755399 + i * 1.1e-5, lng: 128.9351043 + i * 0.7e-5,
             t: 1747000000 + i * (dtSec || 1) });
  }
  return p;
}

console.log('\n[1] 왕복 — 점 수와 값이 그대로');
var pts = track(1419);
var enc = S.encodeTrack(pts), dec = S.decodeTrack(enc);
ok('점 수 보존', dec.length === pts.length);
var mLat = 0, mLng = 0, mT = 0;
dec.forEach(function (d, i) {
  mLat = Math.max(mLat, Math.abs(d.lat - pts[i].lat));
  mLng = Math.max(mLng, Math.abs(d.lng - pts[i].lng));
  mT = Math.max(mT, Math.abs(d.t - pts[i].t));
});
/* 1e-6 격자 = 적도에서 약 11cm. 반올림 오차는 그 절반 이하여야 한다. */
ok('위도 오차 < 6cm', mLat * 111000 < 0.06, (mLat * 111000).toFixed(3) + 'm');
ok('경도 오차 < 6cm', mLng * 88000 < 0.06, (mLng * 88000).toFixed(3) + 'm');
ok('시각 오차 0초', mT === 0);

console.log('\n[2] ★ 용량 — 이게 이 작업의 이유다');
/* GPX 는 점당 약 97 bytes. 압축 형식은 그 1/10 이어야 한다. */
var perPt = enc.length / pts.length;
ok('점당 15 bytes 이하', perPt <= 15, perPt.toFixed(1) + ' bytes');
ok('GPX(97B/점) 대비 6배 이상 작다', 97 / perPt >= 6, (97 / perPt).toFixed(1) + '배');
/* 옥대표 6세션(약 29,000점)이 localStorage UTF-16 기준 1MB 안에 들어와야 한다 */
var sixSessions = 29000 * perPt * 2;   /* UTF-16 */
ok('6세션이 1MB 이내 (UTF-16)', sixSessions < 1024 * 1024,
   (sixSessions / 1024 / 1024).toFixed(2) + ' MB');

console.log('\n[3] 하위호환 — 옛 GPX 기록을 압축본으로 오인하지 않는다');
ok('GPX 는 decode 가 null', S.decodeTrack('<?xml version="1.0"?><gpx>...</gpx>') === null);
ok('GPX 는 isCompactTrack false', S.isCompactTrack('<gpx></gpx>') === false);
ok('융합본(RDFUSED1)도 false', S.isCompactTrack('RDFUSED1{...}') === false);
ok('압축본은 true', S.isCompactTrack(enc) === true);

console.log('\n[4] 게이트 — 못 만들면 null 을 돌려준다(예전 경로로 빠지게)');
ok('빈 배열 null', S.encodeTrack([]) === null);
ok('null 입력 null', S.encodeTrack(null) === null);
ok('점 1개 null (선이 안 된다)', S.encodeTrack(track(1)) === null);
ok('좌표 없는 점은 걸러진다',
   S.encodeTrack([{ lat: null, lng: 1, t: 1 }, { lat: 1, lng: 1, t: 2 }, { lat: 1.1, lng: 1.1, t: 3 }])
   != null);
ok('깨진 문자열 decode 는 null', S.decodeTrack('RDTRK1|garbage') === null);
ok('빈 문자열 null', S.decodeTrack('') === null);

console.log('\n[5] __abs — 상대초를 절대 epoch 로 되돌린다');
/* normalizeSession 의 t 는 세션 시작 기준 상대초다. 그대로 저장하면
   다시 열 때 1970 년이 된다 — 호출부가 __abs 로 넘긴다. */
var rel = [{ lat: 37.1, lng: 128.1, t: 0, __abs: 1747000000 },
           { lat: 37.2, lng: 128.2, t: 60, __abs: 1747000060 }];
var d2 = S.decodeTrack(S.encodeTrack(rel));
ok('__abs 를 우선한다', d2[0].t === 1747000000 && d2[1].t === 1747000060);
var noAbs = [{ lat: 37.1, lng: 128.1, t: 0 }, { lat: 37.2, lng: 128.2, t: 60 }];
var d3 = S.decodeTrack(S.encodeTrack(noAbs));
ok('__abs 없으면 t 를 쓴다', d3[0].t === 0 && d3[1].t === 60);

console.log('\n[6] 불규칙 샘플링(기록 공백)도 견딘다');
var gappy = [{lat:37.1,lng:128.1,t:1000},{lat:37.11,lng:128.11,t:1001},
             {lat:37.2,lng:128.2,t:9000},{lat:37.21,lng:128.21,t:9001}];
var dg = S.decodeTrack(S.encodeTrack(gappy));
ok('공백 건너뛴 시각 보존', dg[2].t === 9000 && dg[3].t === 9001);
ok('점 수 보존', dg.length === 4);

console.log('\n[7] 음수 델타(되돌아오는 트랙)');
var back = [{lat:37.2,lng:128.2,t:100},{lat:37.1,lng:128.1,t:101},{lat:37.15,lng:128.15,t:102}];
var db = S.decodeTrack(S.encodeTrack(back));
ok('서쪽·남쪽으로 가도 복원', Math.abs(db[1].lat - 37.1) < 1e-6 && Math.abs(db[1].lng - 128.1) < 1e-6);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
