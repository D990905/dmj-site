/* selftest-459 — 구간 제외가 시간에 정직하게 반영되는가
 *
 * 옥대표 지적: "드레그 한 곳은 아예 제거해버려야 데이터가 정확해진다."
 * 실제로 두 가지가 어긋나 있었다:
 *   1) applyEdits 가 원래의 기록 공백에서 레그를 안 나눠, 편집 후 레그가
 *      39개 → 2개로 뭉개졌다. 그러면 원래 공백 시간이 다시 분석 시간에
 *      들어간다.
 *   2) 비율·평균의 분모가 벽시계(totalDurationSec)라, 구간을 지울수록
 *      포일링 비율이 희석됐다.
 */
'use strict';
global.window = global;
global.RDGeo = require('./js/geo.js');
var An = require('./js/analysis.js');

var P = 0, F = 0;
function ok(c, m, x) { if (c) { P++; console.log('  PASS  ' + m); }
  else { F++; console.log('  FAIL  ' + m + (x != null ? ' · ' + x : '')); } }

var KT = 1.94384;
/* 합성 세션: 20분 주행, 단 10:00~12:00 에 2분 기록 공백이 있다.
   전 구간 15kt(활주)로 달렸다고 둔다. */
function build() {
  var pts = [], lat = 35, lng = 129, sp = 15 / KT;
  for (var t = 0; t <= 1200; t++) {
    if (t > 600 && t < 720) continue;          /* 2분 기록 공백 */
    pts.push({ lat: lat, lng: lng, ele: 0, time: new Date(1700000000000 + t * 1000),
               speed: sp });
    lat += (sp) / 111132;
  }
  return An.normalizeSession({
    tracks: [{ name: 's', segments: [pts] }], pointCount: pts.length,
    trackName: 's', hasTime: true, speedSource: 'device'
  });
}

var s = build();
console.log('\n[1] 원본 — 기록 공백은 분석 시간에서 빠진다');
var a0 = An.analyzeSession(s, null, {}).summary;
ok(s.legs.length === 2, '공백에서 레그가 나뉜다', s.legs.length);
ok(Math.abs(a0.totalDurationSec - 1200) < 3,
   '총 시간은 벽시계 20분', a0.totalDurationSec);
ok(Math.abs(a0.analyzedDurationSec - 1080) < 5,
   '분석 시간은 공백 2분을 뺀 18분', a0.analyzedDurationSec);
ok(Math.abs(a0.excludedSec - 120) < 5, '빠진 시간 2분으로 보고', a0.excludedSec);
ok(a0.activeRatio > 0.97,
   '전 구간 활주였으므로 포일링 비율은 100% 에 가깝다 — 공백이 분모에 '
   + '남으면 90% 로 떨어진다', (a0.activeRatio * 100).toFixed(1) + '%');

console.log('\n[2] 구간 제외 — 지운 만큼만 줄어든다');
var t0 = s.samples[0].t;
/* 4:00~7:00 (3분) 제외 */
var ed = An.applyEdits(s, { excludeRanges: [{ from: t0 + 240, to: t0 + 420 }] });
var a1 = An.analyzeSession(ed, null, {}).summary;
ok(ed.legs.length === 3,
   '제외로 레그가 하나 더 나뉜다(원래 공백 분할도 유지)', ed.legs.length);
ok(Math.abs((a0.analyzedDurationSec - a1.analyzedDurationSec) - 180) < 8,
   '분석 시간이 딱 3분 줄어든다',
   ((a0.analyzedDurationSec - a1.analyzedDurationSec)).toFixed(0) + 's');
ok(Math.abs((a0.activeTimeSec - a1.activeTimeSec) - 180) < 8,
   '활주 시간도 딱 3분 줄어든다',
   ((a0.activeTimeSec - a1.activeTimeSec)).toFixed(0) + 's');
ok(a1.activeRatio > 0.97,
   '전부 활주였으므로 비율은 그대로 100% 근처 — 지웠다고 나빠지지 않는다',
   (a1.activeRatio * 100).toFixed(1) + '%');

console.log('\n[3] 편집이 원래 공백 분할을 잃지 않는다');
/* 예전 버그: applyEdits 가 인덱스 연속성만 봐서, 공백을 사이에 둔
   샘플이 한 레그로 붙어 공백 시간이 되살아났다. */
var legSpans = ed.legs.map(function (lg) {
  return ed.samples[lg.end].t - ed.samples[lg.start].t;
});
var sumSpans = legSpans.reduce(function (x, y) { return x + y; }, 0);
ok(Math.abs(sumSpans - a1.analyzedDurationSec) < 8,
   '레그 길이 합 = 분석 시간',
   sumSpans.toFixed(0) + ' vs ' + a1.analyzedDurationSec.toFixed(0));
ok(legSpans.every(function (v) { return v < 700; }),
   '어떤 레그도 공백을 삼키지 않았다',
   legSpans.map(function (v) { return Math.round(v); }).join(','));

console.log('\n=== 결과: ' + P + ' PASS / ' + F + ' FAIL ===');
process.exit(F ? 1 : 0);
