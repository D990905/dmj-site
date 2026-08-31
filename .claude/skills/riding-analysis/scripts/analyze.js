#!/usr/bin/env node
/* 라이딩 세션 분석 — 대시보드 엔진을 헤드리스로 실행한다.
 * 사용: node analyze.js <파일...> [--legs] [--json]
 *   --legs  풍상/풍하 지속 레그 상세(택별 평균·상위50·상위20)까지 출력
 *   --json  기계용 JSON 출력
 * 규칙은 ../SKILL.md 참조. 특히 티어는 VMG 기준, 레그는 25초 이상. */
'use strict';
var path = require('path'), fs = require('fs');
var ROOT = path.resolve(__dirname, '../../../../riding-dashboard');
global.window = global;
var Geo = require(path.join(ROOT, 'js/geo.js'));            global.RDGeo = Geo;
global.RDRaceboxCSV = require(path.join(ROOT, 'js/parsers/racebox-csv.js'));
global.RDWaterspeedCSV = require(path.join(ROOT, 'js/parsers/waterspeed-csv.js'));
global.RDImu = require(path.join(ROOT, 'js/analysis-imu.js'));
try { global.RDCsv = require(path.join(ROOT, 'js/csv-parser.js')); } catch (e) {}
var Merger = require(path.join(ROOT, 'js/session-merger.js'));
var An = require(path.join(ROOT, 'js/analysis.js'));
var Stab = null;
try { Stab = require(path.join(ROOT, 'js/analysis-stability.js')); } catch (e) {}

var KT = 1.94384;
var LEG_MIN_SEC = 25;      /* 지속 레그 최소 길이 — 짧은 조각 배제 */
var SEG_SEC = 10;          /* 레그 내부 통계 구간 */
var CRUISE_MIN_KT = 12;

function med(a) { if (!a.length) return null;
  var v = a.slice().sort(function (x, y) { return x - y; }); return v[v.length >> 1]; }
function avg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
function sd(a) { if (a.length < 2) return null; var m = avg(a);
  return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / a.length); }
function f1(v, u) { return v == null ? '—' : v.toFixed(1) + (u || ''); }
function f0(v, u) { return v == null ? '—' : v.toFixed(0) + (u || ''); }

function loadOne(file) {
  var text = fs.readFileSync(file, 'utf8');
  var res = Merger.mergeFiles([{ name: path.basename(file), text: text }]);
  var session = An.normalizeSession(res.parsed);
  var est = null;
  try { est = An.estimateWindFromTrack(session); } catch (e) {}
  var wd = est && est.windDir != null ? est.windDir : null;
  var analysis = An.analyzeSession(session, wd, est ? { windConfidence: est.confidence } : {});
  return { file: path.basename(file), session: session, analysis: analysis,
           est: est, fusion: res.fusion };
}

/* 지속 레그 → 레그 내부 10초 구간. zone: 'up' | 'down' */
function legSegments(session, windDir, zone) {
  var S = session.samples, span = S[S.length - 1].t - S[0].t;
  var hz = span > 0 ? S.length / span : 1;
  var W = Math.max(4, Math.round(hz * SEG_SEC));
  var ok = function (p) {
    if (!p || p.twa == null || p.speed == null || p.vmg == null) return false;
    if (p.speed * KT < CRUISE_MIN_KT) return false;
    var t = Math.abs(p.twa);
    return zone === 'up' ? t < 70 : t > 110;
  };
  var legs = [], cur = [];
  S.forEach(function (p) {
    if (ok(p)) cur.push(p);
    else { if (cur.length >= hz * LEG_MIN_SEC) legs.push(cur); cur = []; }
  });
  if (cur.length >= hz * LEG_MIN_SEC) legs.push(cur);

  var out = [];
  legs.forEach(function (l) {
    for (var i = 0; i + W <= l.length; i += W) {
      var w = l.slice(i, i + W);
      var hd = med(w.map(function (p) { return p.heading; })
                    .filter(function (v) { return v != null; }));
      var side = (windDir != null && hd != null && Geo.angleDiff(windDir, hd) >= 0) ? 'P' : 'S';
      var spd = w.map(function (p) { return p.speed * KT; });
      var heels = w.map(function (p) { return p.heel; }).filter(function (v) { return v != null; });
      var pits = w.map(function (p) { return p.pitch; }).filter(function (v) { return v != null; });
      out.push({
        side: side,
        vmg: Math.abs(med(w.map(function (p) { return p.vmg * KT; }))),
        spd: med(spd), twa: med(w.map(function (p) { return Math.abs(p.twa); })),
        heel: heels.length ? med(heels.map(Math.abs)) : null,
        pitch: pits.length ? med(pits) : null,
        heelSd: heels.length > 1 ? sd(heels) : null,
        pitchSd: pits.length > 1 ? sd(pits) : null
      });
    }
  });
  return { segments: out, legs: legs.length, hz: hz };
}

/* VMG 기준 상위 f 비율의 평균 — 절대값 기준이 아니다 (SKILL.md 규칙 1) */
function tierByVmg(segs, f) {
  if (!segs.length) return null;
  var g = f >= 1 ? segs
    : segs.slice().sort(function (a, b) { return b.vmg - a.vmg; })
          .slice(0, Math.max(2, Math.floor(segs.length * f)));
  var pick = function (k) { return g.map(function (s) { return s[k]; })
                                    .filter(function (v) { return v != null; }); };
  return { n: g.length, vmg: avg(pick('vmg')), spd: avg(pick('spd')), twa: avg(pick('twa')),
           heel: avg(pick('heel')), pitch: avg(pick('pitch')),
           heelSd: avg(pick('heelSd')), pitchSd: avg(pick('pitchSd')) };
}

function report(r, opts) {
  var a = r.analysis, s = a.summary;
  var at = r.fusion && r.fusion.attitude;
  console.log('===== ' + r.file + ' =====');
  console.log('  거리 ' + f1(s.totalDistanceM / 1000, ' km') +
    '  포일링 ' + f0(s.activeDistRatio * 100, '%') +
    '  최고 ' + f1(s.maxSpeedMs * KT, ' kt') +
    '  평균 ' + f1(s.avgSpeedMovingMs * KT, ' kt') +
    '  회전 ' + ((a.maneuvers || []).length) + '회');
  console.log('  풍향 ' + (a.windDir != null ? Math.round(a.windDir) + '°' : '—') +
    (r.est ? ' (추정, 신뢰도 ' + r.est.confidence + ')' : ''));
  if (at) {
    console.log('  자세 ' + (at.ok ? '사용 가능 — 0점 힐 ' + f1(at.heelOffset, '°') +
      ' 피치 ' + f1(at.pitchOffset, '°') + ', IQR ' + f1(at.heelIqr, '°')
      : '사용 불가 [' + at.reason + ']'));
  }
  if (Stab) {
    var st = Stab.analyze(r.session);
    if (st.ok) console.log('  안정성 피치SD ' + f1(st.pitchSd, '°') +
      '  힐SD ' + f1(st.heelSd, '°') + '  속도변동 ' + f1(st.speedCv * 100, '%'));
  }
  if (!opts.legs) return;
  ['up', 'down'].forEach(function (zone) {
    var L = legSegments(r.session, a.windDir, zone);
    ['P', 'S'].forEach(function (side) {
      var segs = L.segments.filter(function (x) { return x.side === side; });
      var label = (zone === 'up' ? '풍상' : '풍하') + ' ' + (side === 'P' ? '포트' : '스타보드');
      if (segs.length < 4) { console.log('  [' + label + '] 표본 부족 (' + segs.length + ')'); return; }
      console.log('  [' + label + '] ' + segs.length + '구간 (레그 ' + L.legs + '개)');
      [[1, '평균    '], [0.5, '상위50% '], [0.2, '상위20% ']].forEach(function (t) {
        var b = tierByVmg(segs, t[0]);
        console.log('     ' + t[1] + ' VMG ' + f1(b.vmg) + '  속도 ' + f1(b.spd) +
          '  풍각 ' + f0(b.twa, '°') + '  힐 ' + f1(b.heel, '°') +
          '  피치 ' + f1(b.pitch, '°') + '  힐SD ' + f1(b.heelSd) + '  피치SD ' + f1(b.pitchSd));
      });
    });
  });
}

var args = process.argv.slice(2);
var opts = { legs: args.indexOf('--legs') >= 0, json: args.indexOf('--json') >= 0 };
var files = args.filter(function (x) { return x.charAt(0) !== '-'; });
if (!files.length) {
  console.error('사용: node analyze.js <파일...> [--legs] [--json]');
  process.exit(1);
}
var results = files.map(function (f) {
  try { return loadOne(f); }
  catch (e) { console.error('실패: ' + f + ' — ' + e.message); return null; }
}).filter(Boolean);
if (opts.json) {
  console.log(JSON.stringify(results.map(function (r) {
    return { file: r.file, summary: r.analysis.summary, windDir: r.analysis.windDir,
             attitude: r.fusion && r.fusion.attitude };
  }), null, 2));
} else {
  results.forEach(function (r) { report(r, opts); });
}
