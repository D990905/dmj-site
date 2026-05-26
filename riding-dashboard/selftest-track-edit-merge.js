/* ============================================================
 * selftest-track-edit-merge.js
 *   '트랙 편집' 위젯을 '속도 시계열' 차트로 통합한 작업 검증.
 *
 * UI 코드(charts.js 트림 핸들·app.js 배선·index.html)는 변경했지만
 * 편집 의미론의 핵심인 analysis.js applyEdits 는 손대지 않았다.
 * 이 self-test 는 통합 위젯이 의존하는 편집 동작 — 양끝 트림 ·
 * 구간 제외 · 리스케일 — 이 부산 송정 GPX 에서 올바른지 확인한다.
 *
 *   실행:  node selftest-track-edit-merge.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var An = require(path.join(DIR, 'js', 'analysis.js'));

var pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}

/* --- 경량 GPX 파서 (trkpt lat/lon/time) — selftest-stats-panel.js 와 동일 규칙.
       브라우저 gpx-parser.js 는 DOMParser 가 필요해 Node 에선 못 쓴다. --- */
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

/* --- 부산 송정 GPX 로드 --- */
var gpxText = fs.readFileSync(path.join(DIR, 'sample', 'sample-songjeong-busan.gpx'), 'utf8');
var parsed = parseGPX(gpxText);
var full = An.normalizeSession(parsed);
check('부산 송정 GPX — 시각 정보 있음', full.hasTime);

var S = full.samples;
var fullDur = S[S.length - 1].t;
var fullPts = S.length;
check('원본 세션 t 는 0 에서 시작', Math.abs(S[0].t) < 1e-6, S[0].t);
console.log('  · 원본: ' + fullPts + ' 포인트 · ' + fullDur.toFixed(0) + ' s');

/* --- BEFORE: 편집 전 분석 --- */
var aFull = An.analyzeSession(full);
var distFull = aFull.summary.totalDistanceM;
var durFull = aFull.summary.totalDurationSec;
check('편집 전 analyzeSession 정상', distFull > 0 && durFull > 0);

/* --- 편집 정의: 앞 120s · 뒤 180s 트림 + 가운데 제외 1구간 ---
   샘플은 이산적이므로 트림 경계의 '실제' 첫·끝 kept 샘플을 미리 구한다. */
var trimStart = 120;
var trimEnd = fullDur - 180;
var firstKept = S.filter(function (s) { return s.t >= trimStart - 1e-6; })[0];
var lastKept = null;
for (var li = 0; li < S.length; li++) if (S[li].t <= trimEnd + 1e-6) lastKept = S[li];
var t0 = firstKept.t;                          // applyEdits 의 리베이스 기준
/* 포인트가 확실히 들어 있는 구간을 제외 대상으로 고른다 */
var exFrom = trimStart + (trimEnd - trimStart) * 0.45;
var exTo = exFrom + 120;
var ptsInEx = S.filter(function (s) {
  return s.t >= exFrom && s.t <= exTo;
}).length;
check('제외 대상 구간에 포인트가 있다', ptsInEx > 0, 'ptsInEx=' + ptsInEx);

var edit = {
  trimStart: trimStart, trimEnd: trimEnd,
  excludeRanges: [{ from: exFrom, to: exTo }]
};

/* --- AFTER: applyEdits → 편집된 세션 --- */
var ed = An.applyEdits(full, edit);
var eS = ed.samples;
var edTrimOnly2 = An.applyEdits(full, { trimStart: trimStart, trimEnd: trimEnd });

/* (1) 리스케일 — 남은 트랙이 0 에서 시작 */
check('[리스케일] 편집 세션 첫 샘플 t === 0', Math.abs(eS[0].t) < 1e-6, eS[0].t);

/* (2) 트림 — 잘린 시간의 데이터가 사라졌다 (원본 t 복원해 확인) */
var anyOutside = eS.some(function (s) {
  var ft = s.t + t0;                           // 원본 세션 기준 시각 복원
  return ft < trimStart - 1e-6 || ft > trimEnd + 1e-6;
});
check('[트림] 트림 구간 밖 데이터가 모두 사라짐', !anyOutside);
check('[트림] 편집 세션 길이 < 원본 길이',
  eS[eS.length - 1].t < fullDur - 250,
  eS[eS.length - 1].t.toFixed(0) + ' < ' + fullDur.toFixed(0));

/* (3) 리스케일 — 남은 t 폭이 실제 kept 샘플 범위와 정확히 일치
   (차트는 데이터 [min,max] 로 X축을 잡으므로 가로 폭을 꽉 채운다) */
var keptSpan = eS[eS.length - 1].t;
var expectedSpan = lastKept.t - firstKept.t;
check('[리스케일] 남은 트랙 t 폭 = 실제 kept 범위',
  Math.abs(keptSpan - expectedSpan) < 1e-6,
  keptSpan.toFixed(1) + ' vs ' + expectedSpan.toFixed(1));
check('[리스케일] 남은 t 폭이 트림 창(' +
  (trimEnd - trimStart).toFixed(0) + 's) 이내', keptSpan <= (trimEnd - trimStart) + 1);

/* (4) 구간 제외 — 제외 구간 안 포인트 수만큼 정확히 빠졌다
   (트림만 적용 vs 트림+제외 의 포인트 수 차이 = 제외 구간 포인트 수) */
var removedByExclude = edTrimOnly2.samples.length - eS.length;
check('[제외] 제외 구간 포인트만큼 정확히 제거됨',
  removedByExclude === ptsInEx,
  removedByExclude + ' 제거 vs ' + ptsInEx + ' 기대');
check('[제외] 편집 세션에 제외 구간 안 데이터가 없다',
  eS.every(function (s) {
    var ft = s.t + t0;
    return ft < exFrom - 1e-6 || ft > exTo + 1e-6;
  }));
check('[제외] 제외로 leg 가 더 분리됨',
  ed.legs.length > edTrimOnly2.legs.length,
  ed.legs.length + ' > ' + edTrimOnly2.legs.length);

/* (5) 포인트 수가 줄었다 (데이터 일부 사라짐) */
check('[트림+제외] 편집 세션 포인트 수 < 원본', eS.length < fullPts,
  eS.length + ' < ' + fullPts);

/* (6) 편집이 즉시 분석에 반영 — 거리·시간 감소 */
var aEd = An.analyzeSession(ed);
check('[분석 반영] 편집 후 analyzeSession 정상',
  aEd.summary.totalDistanceM > 0 && aEd.summary.totalDurationSec > 0);
check('[분석 반영] 편집 후 이동 시간 < 편집 전',
  aEd.summary.totalDurationSec < durFull,
  aEd.summary.totalDurationSec.toFixed(0) + ' < ' + durFull.toFixed(0));
check('[분석 반영] 편집 후 거리 < 편집 전',
  aEd.summary.totalDistanceM < distFull,
  aEd.summary.totalDistanceM.toFixed(0) + ' < ' + distFull.toFixed(0));
check('[분석 반영] editApplied 메타에 트림·제외 기록',
  ed.editApplied && ed.editApplied.trimStart === trimStart &&
  ed.editApplied.excludeRanges.length === 1);

/* (7) 원본 복원 — 빈 편집은 원본과 동일 길이 */
var edNone = An.applyEdits(full, { trimStart: null, trimEnd: null, excludeRanges: [] });
check('[원본 복원] 빈 편집 = 원본 포인트 수 유지', edNone.samples.length === fullPts,
  edNone.samples.length + ' vs ' + fullPts);
check('[원본 복원] 빈 편집 edited 플래그 false', edNone.edited === false);

/* (8) 트림만 — 제외 없이도 동작 */
var edTrimOnly = An.applyEdits(full, { trimStart: 60, trimEnd: fullDur - 60 });
check('[트림 단독] 제외 없는 트림도 리스케일 (첫 t=0)',
  Math.abs(edTrimOnly.samples[0].t) < 1e-6);

/* (9) 차트 X축 리스케일 회귀 가드 — charts.js 속도/심박 차트 X축.
   applyEdits 가 데이터를 [0, 남은구간] 으로 리베이스해도, 속도 차트의
   Chart.js linear X축이 bounds:'data' 가 아니면 축 끝이 눈금의 '깔끔한
   수'까지 올림돼(기본값 'ticks') 트림으로 잘린 구간이 빈 여백으로 남는다
   — 위 (1)~(8) 의 데이터 계층 검증만으로는 못 잡는 렌더 계층 버그.
   '트랙 편집' 차트(speed chart)와 같은 시간축을 쓰는 심박 차트 모두
   bounds:'data' 가 박혀 있는지 소스로 확인한다. */
var chartsSrc = fs.readFileSync(path.join(DIR, 'js', 'charts.js'), 'utf8');
var rscFrom = chartsSrc.indexOf('function renderSpeedChart');
var rscRegion = chartsSrc.slice(rscFrom, rscFrom + 9000);
check('[차트 리스케일] 속도 차트 X축에 bounds:\'data\' (트림 후 빈 여백 제거)',
  rscFrom >= 0 && /bounds:\s*'data'/.test(rscRegion));
check('[차트 리스케일] charts.js 전체에 bounds:\'data\' 2곳+ (속도+심박 시간축 일치)',
  (chartsSrc.match(/bounds:\s*'data'/g) || []).length >= 2);

/* --- 결과 --- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail > 0 ? 1 : 0);
