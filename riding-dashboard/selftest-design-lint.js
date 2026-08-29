/* ============================================================
 * selftest-design-lint.js — 디자인 시스템 준수 검사 (§437)
 *
 * 왜 있나: dashboard.css 에 font-size 56종·하드코딩 hex 54종·radius 16종·
 *   shadow 17종이 쌓였다. 문서(CHART-DESIGN-SYSTEM.md)와 토큰(:root 55개)이
 *   있었는데도 어긋났다 — 문서는 다음 패치를 막지 못하기 때문이다.
 *   이 검사기는 실패한다. 그래서 막는다.
 *
 * 방식 = 래칫(ratchet). 위반 '등장 횟수' 가 기준선보다 늘어나면 FAIL, 줄면 PASS 하고
 *   기준선을 낮추라고 알린다. 한 번에 다 고칠 수 없는 코드베이스에
 *   검사기를 들이는 유일하게 현실적인 방법이다. 숫자는 내려가기만 한다.
 *
 *   실행:  node selftest-design-lint.js
 *          node selftest-design-lint.js --update    (기준선 갱신)
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var DIR = __dirname;
var CSS = path.join(DIR, 'css', 'dashboard.css');
var BASE = path.join(DIR, '.design-baseline.json');
var UPDATE = process.argv.indexOf('--update') !== -1;

/* ---------- 확정 토큰 (A · Instrument 방향) ---------- */
/* 타입 스케일 8단 — px 기준. rem 은 16px root 로 환산해 비교한다. */
var TYPE_SCALE_PX = [11, 12, 14, 16, 20, 26, 34, 48];
var RADIUS_PX     = [0, 4, 8, 999];
/* shadow 는 값 나열 대신 "var() 로만 쓴다" 가 규칙 */

var src = fs.readFileSync(CSS, 'utf8');
/* :root 블록은 토큰 정의부라 hex 검사에서 제외한다 */
var rootBlock = (src.match(/:root\s*\{[\s\S]*?\n\}/) || [''])[0];
var body = src.replace(rootBlock, '');

function uniq(a) { return Array.from(new Set(a)); }

/* ---------- 1) 타입 스케일 ---------- */
var fsDecls = src.match(/font-size:\s*[0-9.]+(rem|px|em)/g) || [];
var fsVals = uniq(fsDecls.map(function (d) { return d.replace(/font-size:\s*/, ''); }));
var offScale = fsVals.filter(function (v) {
  var n = parseFloat(v);
  if (/em$/.test(v) && !/rem$/.test(v)) return true;      /* em = 문맥 의존, 스케일 밖 */
  var px = /rem$/.test(v) ? n * 16 : n;
  return !TYPE_SCALE_PX.some(function (t) { return Math.abs(t - px) < 0.2; });
});

/* ---------- 2) 하드코딩 색 ---------- */
var hexes = uniq((body.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(function (h) { return h.toLowerCase(); }));

/* ---------- 3) radius ---------- */
var radDecls = src.match(/border-radius:\s*[0-9.]+(rem|px)/g) || [];
var radVals = uniq(radDecls.map(function (d) { return d.replace(/border-radius:\s*/, ''); }));
var offRadius = radVals.filter(function (v) {
  var n = parseFloat(v), px = /rem$/.test(v) ? n * 16 : n;
  return !RADIUS_PX.some(function (t) { return Math.abs(t - px) < 0.2; });
});

/* ---------- 4) shadow 는 토큰만 ---------- */
var shadowLits = uniq((src.match(/box-shadow:\s*(?!var\()[^;]+/g) || [])
  .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
  .filter(function (s) { return !/box-shadow:\s*(none|inherit|initial)/.test(s); }));

/* 래칫은 '등장 횟수' 로 센다 — 종류로 세면 이미 있는 위반값을 100번 더
   복사해도 숫자가 안 늘어 검사기가 무력해진다 (실측으로 확인된 구멍). */
function countOccur(list, all) {
  var set = {}; list.forEach(function (v) { set[v] = true; });
  var n = 0; all.forEach(function (v) { if (set[v]) n++; });
  return n;
}
var fsAll = fsDecls.map(function (d) { return d.replace(/font-size:\s*/, ''); });
var radAll = radDecls.map(function (d) { return d.replace(/border-radius:\s*/, ''); });
var hexAll = (body.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(function (h) { return h.toLowerCase(); });
var shadowAll = (src.match(/box-shadow:\s*(?!var\()[^;]+/g) || [])
  .map(function (x) { return x.replace(/\s+/g, ' ').trim(); })
  .filter(function (x) { return !/box-shadow:\s*(none|inherit|initial)/.test(x); });

var metrics = {
  offScaleFontSizes: countOccur(offScale, fsAll),
  hardcodedHex: hexAll.length,
  offScaleRadius: countOccur(offRadius, radAll),
  literalShadows: shadowAll.length
};
var samples = {
  offScaleFontSizes: offScale.slice(0, 12),
  hardcodedHex: hexes.slice(0, 12),
  offScaleRadius: offRadius.slice(0, 12),
  literalShadows: shadowLits.slice(0, 3).map(function (s) { return s.slice(0, 60); })
};

if (UPDATE || !fs.existsSync(BASE)) {
  fs.writeFileSync(BASE, JSON.stringify(metrics, null, 2) + '\n');
  console.log('기준선 기록 → .design-baseline.json');
  Object.keys(metrics).forEach(function (k) { console.log('  ' + k + ': ' + metrics[k]); });
  process.exit(0);
}

var base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
var fail = 0, improved = 0;
var LABEL = {
  offScaleFontSizes: '타입 스케일 밖 font-size',
  hardcodedHex:      '하드코딩 hex (토큰 우회)',
  offScaleRadius:    '허용 밖 border-radius',
  literalShadows:    'var() 아닌 box-shadow'
};

console.log('\n=== 디자인 시스템 준수 검사 (§437) ===\n');
Object.keys(metrics).forEach(function (k) {
  var now = metrics[k], was = base[k] == null ? now : base[k];
  var mark, note = '';
  if (now > was) { mark = 'FAIL'; fail++; note = '  ← ' + (now - was) + '개 늘었다'; }
  else if (now < was) { mark = 'PASS'; improved++; note = '  ← ' + (was - now) + '개 줄었다'; }
  else { mark = 'PASS'; }
  console.log('  ' + mark + '  ' + LABEL[k] + ': ' + now + ' (기준선 ' + was + ')' + note);
  if (now > was && samples[k].length) console.log('        예: ' + samples[k].join(', '));
});

console.log('\n  허용 타입 스케일: ' + TYPE_SCALE_PX.join(', ') + ' px');
console.log('  허용 radius     : ' + RADIUS_PX.join(', ') + ' px');

if (fail) {
  console.log('\n=== 결과: FAIL — 위반이 늘었다. 토큰을 쓰거나 스케일 안에서 골라라. ===\n');
  process.exit(1);
}
if (improved) console.log('\n  개선됨 — `node selftest-design-lint.js --update` 로 기준선을 낮춰라.');
console.log('\n=== 결과: PASS ===\n');
process.exit(0);
