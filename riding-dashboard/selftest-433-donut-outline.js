/* ============================================================
 * selftest-433-donut-outline.js — §433 도넛·chip 음영·윤곽 강화 검증
 *
 * 배경(옥대표 2026-07-08): §432 v3.2 rainbow 라이브 후 실사용에서
 * "색깔에 음영을 넣어 윤곽이 보이게 — 잘 식별이 안 된다". 흰 배경 위
 * 순색 형광 링이 경계가 흐려 인접 티어(특히 Elite #00FF00 ↔ Advanced
 * #7FFF00 두 초록)가 붙어 보이고, 링 안 숫자(79/81/82)도 순색이라
 * 읽기 어려웠다. §433 = hex 5색은 그대로 두고(§432 lock) 윤곽/음영만 강화:
 *   - 도넛: 진행 호에 어두운 rim(테두리) + drop-shadow(3D)
 *   - 링 안 숫자·티어 라벨: 밴드색을 어둡게 한 톤(가독)
 *   - 회전효율 chip: 1px 다크 테두리 + inset 하이라이트
 *   - 속도 파이/HR 막대/HR 존 띠: 조각 간 갭·다크 아웃라인·dashed 경계
 *
 * 검증:
 *  1) §432 hex lock — coach VPS_BANDS · chart-theme SIGNAL5 5색 canonical 불변.
 *  2) rim(darken 0.55)이 밴드 fill 보다 뚜렷이 어둡다 (윤곽 대비 ≥ 1.6:1).
 *  3) 링 안 숫자색(darken 0.58)이 흰 배경 위 가독 (WCAG 대비 ≥ 3.0:1).
 *  4) darken 이 hue 를 뒤집지 않는다 (rim 이 fill 과 같은 계열 — 색 정합).
 *  5) darkenHex 출력이 유효한 '#rrggbb'.
 *
 *   실행:  node selftest-433-donut-outline.js
 * ============================================================ */
'use strict';
var path = require('path');
var DIR = __dirname;
var Coach = require(path.join(DIR, 'js', 'coach.js'));
require(path.join(DIR, 'js', 'chart-theme.js'));
var ChartTheme = global.RDChartTheme || globalThis.RDChartTheme;

var pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) pass++; else fail++;
  console.log(' ', ok ? 'PASS' : 'FAIL', '', name, info ? '· ' + info : '');
}

/* app.js / charts.js 의 darkenHex 와 동일 공식(factor 0~1, 채널 곱).
   selftest 는 브라우저 IIFE 를 require 할 수 없어 공식만 복제해 canonical
   밴드색에 적용, 불변식을 검증한다. 공식이 바뀌면 이 복제도 갱신할 것. */
function darkenHex(hex, factor) {
  var m = String(hex).replace('#', '');
  function ch(i) {
    var v = Math.round(parseInt(m.substr(i, 2), 16) * factor);
    return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
  }
  return '#' + ch(0) + ch(2) + ch(4);
}
function rgb(hex) {
  var m = String(hex).replace('#', '');
  return [parseInt(m.substr(0, 2), 16), parseInt(m.substr(2, 2), 16),
    parseInt(m.substr(4, 2), 16)];
}
/* WCAG 상대 휘도 + 대비비 */
function lum(hex) {
  var c = rgb(hex).map(function (v) {
    var s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  var la = lum(a), lb = lum(b), hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function hueOf(hex) {
  var c = rgb(hex).map(function (v) { return v / 255; });
  var mx = Math.max.apply(null, c), mn = Math.min.apply(null, c), d = mx - mn;
  if (d === 0) return 0;
  var h;
  if (mx === c[0]) h = ((c[1] - c[2]) / d) % 6;
  else if (mx === c[1]) h = (c[2] - c[0]) / d + 2;
  else h = (c[0] - c[1]) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return h;
}

/* --- canonical 팔레트 (§432 lock) --- */
var LOCK = ['#00FF00', '#7FFF00', '#FFCC00', '#FFA500', '#FF0000'];
var BANDS = Coach.VPS_BANDS || (Coach.RDCoach && Coach.RDCoach.VPS_BANDS);
var bandColors = BANDS.filter(function (b) { return b.min != null; })
  .sort(function (a, b) { return a.min - b.min; })   /* learning→elite */
  .map(function (b) { return b.color; });
/* learning→elite 순서를 elite→learning(LOCK 순)로 뒤집어 비교 */
var bandTop = bandColors.slice().reverse();

/* ---- 1) §432 hex lock ---- */
check('coach VPS_BANDS 5색 = §432 canonical',
  JSON.stringify(bandTop) === JSON.stringify(LOCK), bandTop.join(' '));
check('chart-theme SIGNAL5 = §432 canonical (learning→elite)',
  JSON.stringify(ChartTheme.signal5) === JSON.stringify(LOCK.slice().reverse()),
  (ChartTheme.signal5 || []).join(' '));

/* ---- 2) rim 이 fill 보다 뚜렷이 어둡다 (윤곽 대비) ---- */
LOCK.forEach(function (c) {
  var rim = darkenHex(c, 0.55);
  var cr = contrast(c, rim);
  check('rim 윤곽 대비 ≥ 1.6:1 — ' + c, cr >= 1.6,
    c + '→' + rim + ' (' + cr.toFixed(2) + ':1)');
});

/* ---- 3) 링 안 숫자 흰 배경 위 가독 (WCAG ≥ 3.0) ---- */
LOCK.forEach(function (c) {
  var num = darkenHex(c, 0.58);
  var cr = contrast(num, '#FFFFFF');
  check('숫자 가독(vs 흰배경) ≥ 3.0:1 — ' + c, cr >= 3.0,
    c + '→' + num + ' (' + cr.toFixed(2) + ':1)');
});

/* ---- 4) darken 이 hue 를 뒤집지 않음 (rim·숫자 = fill 계열) ---- */
LOCK.forEach(function (c) {
  if (c === '#FF0000') return;             /* 순수빨강 hue=0, 회귀 없음 */
  var dh = hueOf(darkenHex(c, 0.55)), oh = hueOf(c);
  var dd = Math.abs(dh - oh); if (dd > 180) dd = 360 - dd;
  check('darken hue 정합(≤12°) — ' + c, dd <= 12,
    'hue ' + oh.toFixed(0) + '°→' + dh.toFixed(0) + '° (Δ' + dd.toFixed(1) + '°)');
});

/* ---- 5) darkenHex 출력이 유효 hex ---- */
check('darkenHex 출력 = #rrggbb',
  LOCK.every(function (c) { return /^#[0-9a-f]{6}$/.test(darkenHex(c, 0.58)); }));

console.log('\n  §433 donut/chip outline —', pass, 'passed,', fail, 'failed');
if (fail) process.exit(1);
