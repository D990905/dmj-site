/* ============================================================
 * selftest-433-donut-outline.js — §433 도넛·chip 음영·윤곽 강화 + v4 팔레트
 *
 * 배경(옥대표 2026-07-08): §432 rainbow 라이브 후 "색깔에 음영을 넣어
 * 윤곽이 보이게 — 잘 식별이 안된다". 이후 "이 색깔로 그대로"(11:15) — Apple
 * 이모지 픽셀 샘플색으로 팔레트 override(v4). §433 = v4 팔레트 적용 + 윤곽/
 * 음영 강화(도넛 rim·drop-shadow, 숫자 dark grey, chip 테두리, 파이 갭 등).
 *
 * v4 팔레트(옥대표 verbatim, elite→learning):
 *   Elite #50AE33 · Advanced #50AE33(동일) · Intermediate #F9DA4A ·
 *   Foundational #D78A32 · Learning #C23328
 * ⚠ Elite=Advanced 동일 hex 는 옥대표 지시 — 색 구분은 도넛 shape(rim/shadow)
 *   로 보완. 이 selftest 는 그 결정을 명시적으로 encode(우발적 divergence 감지).
 *
 * 검증:
 *  1) v4 팔레트 정합 — coach VPS_BANDS · chart-theme SIGNAL5 = canonical.
 *  2) Elite=Advanced 동일 hex (옥대표 지시 encode).
 *  3) rim(darken 0.55)이 밴드 fill 보다 뚜렷이 어둡다 (윤곽 대비 ≥ 1.6:1).
 *  4) 링 안 숫자 dark grey(#374151)가 흰 배경 위 고가독 (WCAG ≥ 4.5:1).
 *  5) darken 이 hue 를 뒤집지 않는다 (rim = fill 계열).
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

/* app.js / charts.js 의 darkenHex 와 동일 공식(factor 0~1, 채널 곱). */
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

/* --- v4 canonical 팔레트 (옥대표 "그대로", elite→learning) --- */
var V4 = ['#50AE33', '#50AE33', '#F9DA4A', '#D78A32', '#C23328'];
var NUM_GREY = '#374151';                 /* 링 안 숫자 (app.js vpsTile) */
var BANDS = Coach.VPS_BANDS || (Coach.RDCoach && Coach.RDCoach.VPS_BANDS);
var bandTop = BANDS.filter(function (b) { return b.min != null; })
  .sort(function (a, b) { return b.min - a.min; })   /* elite→learning */
  .map(function (b) { return b.color; });

/* ---- 1) v4 팔레트 정합 ---- */
check('coach VPS_BANDS = v4 이모지 팔레트',
  JSON.stringify(bandTop) === JSON.stringify(V4), bandTop.join(' '));
check('chart-theme SIGNAL5 = v4 (learning→elite)',
  JSON.stringify(ChartTheme.signal5) === JSON.stringify(V4.slice().reverse()),
  (ChartTheme.signal5 || []).join(' '));

/* ---- 2) Elite=Advanced 동일 hex (옥대표 지시 encode) ---- */
check('Elite = Advanced 동일 hex (옥대표 "그대로")',
  bandTop[0] === bandTop[1] && bandTop[0] === '#50AE33', bandTop[0]);

/* ---- 3) rim 이 fill 보다 뚜렷이 어둡다 (윤곽 대비) ---- */
V4.forEach(function (c, i) {
  if (i === 1) return;                      /* Advanced = Elite 중복, 1회만 */
  var rim = darkenHex(c, 0.55);
  var cr = contrast(c, rim);
  check('rim 윤곽 대비 ≥ 1.6:1 — ' + c, cr >= 1.6,
    c + '→' + rim + ' (' + cr.toFixed(2) + ':1)');
});

/* ---- 4) 링 안 숫자(dark grey) 흰 배경 위 고가독 ---- */
check('숫자 #374151 가독(vs 흰배경) ≥ 4.5:1',
  contrast(NUM_GREY, '#FFFFFF') >= 4.5,
  NUM_GREY + ' (' + contrast(NUM_GREY, '#FFFFFF').toFixed(2) + ':1)');

/* ---- 5) darken 이 hue 를 뒤집지 않음 (rim = fill 계열) ---- */
V4.forEach(function (c, i) {
  if (i === 1) return;
  var oh = hueOf(c);
  if (Math.max.apply(null, rgb(c)) === Math.min.apply(null, rgb(c))) return;
  var dh = hueOf(darkenHex(c, 0.55));
  var dd = Math.abs(dh - oh); if (dd > 180) dd = 360 - dd;
  check('darken hue 정합(≤12°) — ' + c, dd <= 12,
    'hue ' + oh.toFixed(0) + '°→' + dh.toFixed(0) + '° (Δ' + dd.toFixed(1) + '°)');
});

console.log('\n  §433 v4 donut/chip outline —', pass, 'passed,', fail, 'failed');
if (fail) process.exit(1);
