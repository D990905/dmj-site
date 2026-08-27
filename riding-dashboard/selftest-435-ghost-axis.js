/* ============================================================
 * selftest-435-ghost-axis.js — 고스트 오버레이 Y축 정합 self-test
 *
 * 배경(§435): §434 고스트 오버레이는 기본 SOG 곡선이 [0, max*1.08] 축을
 *   쓰는데 고스트는 [0, max(둘)] 자체 축을 만들어, 같은 속도가 서로 다른
 *   높이에 그려졌다. 최악(고스트가 더 빠름) 13% 오차 — 더 빠른 쪽이 화면
 *   에서 더 느려 보였다. §434 테스트 24개는 순수 함수만 덮어 이를 놓쳤다.
 *
 * 이 테스트는 "두 곡선이 반드시 같은 축을 쓴다" 를 직접 검사한다.
 *
 *   실행:  node selftest-435-ghost-axis.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var RD = require('./js/replay.js');
var T = RD._test;

var pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 1e-9 : tol); }

var SOG = null, TWA = null;
T.METRICS.forEach(function (d) {
  if (d.key === 'sog') SOG = d;
  if (d.key === 'twa') TWA = d;
});

/* 속도 프로필 생성 — peak 노트로 정점을 맞춘다 */
function mkSamples(n, peak, t0) {
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push({ t: (t0 || 0) + i, speed: peak * (0.5 + 0.5 * Math.sin(i / 8)) });
  }
  out[Math.floor(n / 2)].speed = peak;   // 정점 보장
  return out;
}

/* 축(range)으로부터 y 를 구하는 공용 식 — replay.js 의 yFor 와 동일 */
function yOf(range, v, plotH) {
  var span = (range[1] - range[0]) || 1;
  return plotH - (Math.max(range[0], Math.min(range[1], v)) - range[0]) / span * plotH;
}

console.log('\n[1] mergeGhostRange — 축 병합 규칙');
var pri = mkSamples(60, 20);
var priRange = T.computeRange(SOG, T.buildSeries(pri, SOG.field));

var same = T.mergeGhostRange(SOG, priRange.slice(), mkSamples(60, 20));
check('고스트가 동일 최고속 → 축 불변',
  near(same[0], priRange[0]) && near(same[1], priRange[1]),
  JSON.stringify(same) + ' vs ' + JSON.stringify(priRange));

var slower = T.mergeGhostRange(SOG, priRange.slice(), mkSamples(60, 14));
check('고스트가 더 느림 → 축 불변 (기본이 이미 더 넓음)',
  near(slower[1], priRange[1]), JSON.stringify(slower));

var fasterG = mkSamples(60, 25);
var faster = T.mergeGhostRange(SOG, priRange.slice(), fasterG);
var ghostOwn = T.computeRange(SOG, T.buildSeries(fasterG, SOG.field));
check('고스트가 더 빠름 → 축 상단이 고스트를 포함하도록 확장',
  near(faster[1], ghostOwn[1]) && faster[1] > priRange[1],
  'merged=' + faster[1].toFixed(3) + ' ghostOwn=' + ghostOwn[1].toFixed(3));
check('확장돼도 하단은 유지', near(faster[0], priRange[0]));

check('고정축 지표(CWA)는 병합해도 불변',
  (function () {
    var fr = T.computeRange(TWA, T.buildSeries(pri, TWA.field));
    var mr = T.mergeGhostRange(TWA, fr.slice(), fasterG);
    return near(mr[0], fr[0]) && near(mr[1], fr[1]);
  })());

check('고스트 샘플 없음 → 축 불변',
  (function () { var r = T.mergeGhostRange(SOG, priRange.slice(), []); 
    return near(r[0], priRange[0]) && near(r[1], priRange[1]); })());

check('고스트에 유효 속도가 하나도 없음 → 축 불변',
  (function () {
    var junk = [{ t: 0, speed: null }, { t: 1, speed: NaN }];
    var r = T.mergeGhostRange(SOG, priRange.slice(), junk);
    return near(r[0], priRange[0]) && near(r[1], priRange[1]);
  })());

console.log('\n[2] 축 커버리지 — 두 주자 모두 잘리지 않고 들어간다');
var PLOT = 100;
[[20, 20, '실력 동일'], [20, 25, '고스트가 더 빠름'], [25, 18, '고스트가 더 느림']]
  .forEach(function (c) {
    var pMax = c[0], gMax = c[1], label = c[2];
    var pS = mkSamples(60, pMax), gS = mkSamples(60, gMax);
    var base = T.computeRange(SOG, T.buildSeries(pS, SOG.field));
    var axis = T.mergeGhostRange(SOG, base.slice(), gS);

    check(label + ' — 기본 최고속이 축 안에 들어감', pMax <= axis[1] + 1e-9,
      'pMax=' + pMax + ' axisTop=' + axis[1].toFixed(2));
    check(label + ' — 고스트 최고속이 축 안에 들어감', gMax <= axis[1] + 1e-9,
      'gMax=' + gMax + ' axisTop=' + axis[1].toFixed(2));

    /* 수정 전 고스트 자체 축 [0, max(둘)] 과 비교 — 같은 속도가 몇 px
       어긋났는지. 0 이면 수정이 무의미했다는 뜻이므로 실패 처리한다. */
    var oldAxis = [0, Math.max(pMax, gMax)];
    var probe = Math.min(pMax, gMax);
    var drift = Math.abs(yOf(axis, probe, PLOT) - yOf(oldAxis, probe, PLOT));
    check(label + ' — 수정 전 자체 축이었다면 ' + drift.toFixed(1) + 'px 어긋남',
      drift > 0.5, '차이 0 이면 축이 여전히 잘못된 것');
  });

console.log('\n[2b] 배선 검사 — 고스트가 자체 축을 만들지 않는다');
/* 순수 함수로는 "렌더가 같은 축을 쓴다" 를 증명할 수 없다. 소스 배선을
   직접 확인한다. 완전한 렌더 검증은 DOM 하네스 몫으로 남긴다. */
var srcTxt = require('fs').readFileSync(require('path').join(__dirname, 'js', 'replay.js'), 'utf8');
check('ghostTrackScale 이 sog 그래프 축(vmin/vmax)으로 만들어짐',
  /ghostTrackScale = \{ vmin: gvmin, vmax: gvmax \}/.test(srcTxt));
check('고스트 전용 maxSpeed 축이 제거됨',
  !/clamp\(speed, 0, maxSpeed\) \/ maxSpeed/.test(srcTxt));
check('buildGraphs 가 고스트 범위를 병합함',
  /if \(R\.ghost\) range = mergeGhostRange\(def, range, R\.ghost\.session\.samples\);/.test(srcTxt));

console.log('\n[3] 고스트 정렬 로직 회귀 (§434 유지 확인)');
var pA = mkSamples(30, 18, 100);      // 100~129초
var gB = mkSamples(30, 18, 120);      // 120~149초
var al = T.alignGhost({ samples: pA }, { samples: gB }, 'clock');
check('clock 정렬 offset = t0 차이', near(al.offsetSec, 20), String(al.offsetSec));
check('clock 정렬 겹침 = 9초', near(al.overlapSec, 9), String(al.overlapSec));
var al2 = T.alignGhost({ samples: pA }, { samples: gB }, 'start');
check('start 정렬 offset = 0', near(al2.offsetSec, 0));
check('고스트 범위 밖 → null',
  T.ghostStateAt({ samples: gB }, 0, 20) === null);
check('고스트 범위 안 → 값 반환',
  T.ghostStateAt({ samples: gB }, 25, 20) != null);

console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail ? 1 : 0);
