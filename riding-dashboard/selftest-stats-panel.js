/* ============================================================
 * selftest-stats-panel.js — 퍼포먼스 통계 패널 self-test
 *
 * Njord 벤치마크 후속 ③-3: 핵심 지표(SOG·VMG·풍각·힐·피치·심박)의
 * 평균·대표 최댓값·대표 최솟값을 한 표로 압축하는 통계 패널을 검증한다.
 * 의존성 0 — Node 내장 모듈만 사용한다.
 *
 *   실행:  node selftest-stats-panel.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 *
 * 검증 핵심:
 *  · statsBy 의 bot20(하위 20% 시간가중 평균)이 raw 최소가 아니라
 *    노이즈에 강한 구간 평균이다 (벤치마크 §3·§8: raw min/max 회피).
 *  · computeStatsPanel 은 analyzeSession 결과를 '재배치'만 한다 —
 *    표시값이 원본 분석값과 정확히 일치한다(중복 재계산 금지).
 *  · 데이터 없는 지표(풍향 미설정·GPX 의 힐/피치·심박 없음)는
 *    행 자체가 생성되지 않는다.
 *  · .vkx(자세 센서) 경로 — 합성 VKX 바이너리를 실제 vkx-parser 로
 *    파싱해 힐·피치 행이 통계값과 함께 산출되는지 end-to-end 확인.
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));
var Vkx = require(path.join(DIR, 'js', 'vkx-parser.js'));

/* --- 경량 GPX 파서 (trkpt lat/lon/time/hr) — selftest-hr.js 와 같은 규칙 --- */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3];
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    var hM = inner.match(/<[A-Za-z0-9]*:?hr>([^<]+)<\/[A-Za-z0-9]*:?hr>/);
    var hv = hM ? parseFloat(hM[1]) : null;
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]), ele: 0,
      time: tM ? Date.parse(tM[1]) : null, speed: null,
      hr: (hv != null && isFinite(hv) && hv >= 20 && hv <= 240)
        ? Math.round(hv) : null
    });
  }
  var withTime = pts.filter(function (p) { return p.time != null; }).length;
  var withHR = pts.filter(function (p) { return p.hr != null; }).length;
  return {
    tracks: [{ name: 'selftest', segments: [pts] }],
    pointCount: pts.length, trackName: 'selftest',
    hasTime: withTime >= pts.length * 0.5, speedSource: 'derived',
    hasHR: withHR >= pts.length * 0.5, hrPointCount: withHR,
    _points: pts
  };
}
function loadParsed(file) {
  return parseGPX(fs.readFileSync(path.join(DIR, 'sample', file), 'utf8'));
}

/* --- 미니 테스트 러너 — selftest-wind.js 와 동일 --- */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}
var EPS = 1e-9;

console.log('=== 퍼포먼스 통계 패널 self-test ===\n');

/* 풍향 — selftest-target-polar.js 와 같은 자동 추정값 */
var sjParsed = loadParsed('sample-songjeong-busan.gpx');
var gnParsed = loadParsed('sample-ride-gangneung.gpx');
var sj = An.normalizeSession(sjParsed);
var gn = An.normalizeSession(gnParsed);
var sjW = An.estimateWindFromTrack(sj).windDir;
var gnW = An.estimateWindFromManeuvers(gn).windDir;
console.log('풍향: 송정=' + sjW + '° · 강릉=' + gnW + '°');
console.log('송정 HR: ' + (sj.hasHR ? '있음(' + sj.hrPointCount + '점)' : '없음') + '\n');

/* ---------- 1) computeTierMeans — 상·하위 50%·20% 구간 평균의 단조 정렬 ---------- */
console.log('[1] 구간 평균 — bot20·bot50·avg·top50·top20 의 단조 정렬');
var aGn = An.analyzeSession(gn, gnW, {});
var ts = aGn.wind && aGn.wind.tackSplit;
check('analyzeSession.wind.tackSplit 가 산출된다', !!ts, 'tackSplit 없음');

var groupsChecked = 0, ordOk = true, keyOk = true, spreadSeen = false;
['upwind', 'downwind'].forEach(function (mode) {
  ['vmg', 'sog', 'twa'].forEach(function (metric) {
    var grp = ts && ts[mode] && ts[mode].all;
    if (!grp || !grp.count) return;
    var st = grp[metric];
    groupsChecked++;
    if (typeof st.bot20 !== 'number' || typeof st.bot50 !== 'number' ||
        typeof st.top50 !== 'number' || typeof st.top20 !== 'number' ||
        typeof st.avg !== 'number') keyOk = false;
    /* bot20 ≤ bot50 ≤ 전체 평균 ≤ top50 ≤ top20 — 같은 분포의
       구간 평균이라 항상 성립해야 한다(통계 패널 점층 표기의 단조성). */
    if (!(st.bot20 <= st.bot50 + EPS && st.bot50 <= st.avg + EPS &&
          st.avg <= st.top50 + EPS && st.top50 <= st.top20 + EPS)) {
      ordOk = false;
      console.log('      정렬 위반 ' + mode + '/' + metric +
        ' bot20=' + st.bot20.toFixed(3) + ' bot50=' + st.bot50.toFixed(3) +
        ' avg=' + st.avg.toFixed(3) + ' top50=' + st.top50.toFixed(3) +
        ' top20=' + st.top20.toFixed(3));
    }
    if (st.top20 - st.bot20 > 0.1) spreadSeen = true;
  });
});
check('vmg·sog·twa 통계에 bot20·bot50·avg·top50·top20 이 모두 수치다', keyOk);
check('모든 택 그룹에서 bot20 ≤ bot50 ≤ avg ≤ top50 ≤ top20 (구간 평균 단조)',
  ordOk, groupsChecked + '개 그룹 검사');
check('검사한 택 그룹이 1개 이상이다', groupsChecked >= 1,
  '그룹 수=' + groupsChecked);
check('지표에 실제 분포 폭이 있다 (bot20 < top20 인 그룹 존재)', spreadSeen);

/* ---------- 2) bot20·top20 은 raw 최소·최대가 아니다 (노이즈 강건성) ---------- */
console.log('\n[2] 노이즈 강건성 — bot20·top20 은 구간 평균이라 raw 극값 안쪽');
var robustOk = true, strictSeen = false;
['upwind', 'downwind'].forEach(function (mode) {
  ['vmg', 'sog'].forEach(function (metric) {
    var grp = ts && ts[mode] && ts[mode].all;
    if (!grp || !grp.count || !grp.samples || grp.samples.length < 10) return;
    var vals = grp.samples.map(function (s) { return s[metric]; });
    var rawMin = Math.min.apply(null, vals);
    var rawMax = Math.max.apply(null, vals);
    var st = grp[metric];
    /* 구간(시간가중) 평균은 raw 극값을 절대 넘지 않는다 */
    if (!(st.bot20 >= rawMin - EPS && st.top20 <= rawMax + EPS)) {
      robustOk = false;
      console.log('      극값 위반 ' + mode + '/' + metric);
    }
    /* 그리고 분포 폭이 있으면 raw 극값보다 '안쪽'이다 = 단일
       포인트 노이즈를 그대로 쓰지 않는다는 증거 */
    if (rawMax - rawMin > 0.5) {
      strictSeen = true;
      if (!(st.bot20 > rawMin + 1e-4 && st.top20 < rawMax - 1e-4)) {
        robustOk = false;
        console.log('      노이즈 미배제 ' + mode + '/' + metric +
          ' bot20=' + st.bot20.toFixed(3) + ' rawMin=' + rawMin.toFixed(3) +
          ' top20=' + st.top20.toFixed(3) + ' rawMax=' + rawMax.toFixed(3));
      }
    }
  });
});
check('bot20 ≥ raw 최소 · top20 ≤ raw 최대 (구간 평균 경계)', robustOk);
check('분포 폭이 있는 지표에서 bot20·top20 이 raw 극값보다 안쪽이다',
  strictSeen && robustOk, 'strictSeen=' + strictSeen);

/* ---------- 3) computeStatsPanel — 풍향 미설정 시 풍계열 행 없음 ---------- */
console.log('\n[3] computeStatsPanel — 풍향 미설정 → SOG·VMG·풍각 행 생략');
var aNoWind = An.analyzeSession(gn, null, {});
var panelNoWind = An.computeStatsPanel(aNoWind);
check('windAvailable 가 false', panelNoWind.windAvailable === false,
  'windAvailable=' + panelNoWind.windAvailable);
check('속도·각도 지표 행이 하나도 없다',
  panelNoWind.rows.every(function (r) { return r.metric === 'hr'; }),
  '행 수=' + panelNoWind.rows.length);
check('강릉(HR 없음)은 행이 전혀 없다 — UI 가 안내문으로 대체',
  panelNoWind.rows.length === 0, '행 수=' + panelNoWind.rows.length);
check('analysis 가 없어도 안전하게 빈 결과를 돌려준다',
  An.computeStatsPanel(null).rows.length === 0);

/* ---------- 4) computeStatsPanel — 풍향 확정 시 값이 원본과 정확히 일치 ---------- */
console.log('\n[4] computeStatsPanel — 풍향 확정 → 값이 분석 원본과 일치(재배치만)');
var panelGn = An.computeStatsPanel(aGn);
check('windAvailable 가 true', panelGn.windAvailable === true);
check('SOG·VMG·풍각 행이 산출된다', panelGn.rows.length >= 1,
  '행 수=' + panelGn.rows.length);

/* 패널 표시값이 tackSplit 의 풍상/풍하 × 포트(P)/스타보드(S) 버킷
   원본과 정확히 일치하는지 — 재배치만 하고 재계산은 없어야 한다. */
function tierHi(direction, avg) {
  if (direction === 'high') return true;
  if (direction === 'low') return false;
  return avg >= 0;                       // neutral — 0 에서 먼 쪽
}
var matchOk = true, countOk = true, basisOk = true, sideOk = true;
panelGn.rows.forEach(function (r) {
  if (r.metric === 'hr') return;
  var modeGrp = aGn.wind.tackSplit[r.mode];
  var src = modeGrp && modeGrp[r.side || 'all'];   // split 지표는 P/S 버킷
  var st = src && src[r.metric];
  if (!st) { matchOk = false; return; }
  var hi = tierHi(r.direction, st.avg);
  var exp50 = hi ? st.top50 : st.bot50;
  var exp20 = hi ? st.top20 : st.bot20;
  if (r.avg !== st.avg || r.tier50 !== exp50 || r.tier20 !== exp20) {
    matchOk = false;
    console.log('      값 불일치 ' + r.key);
  }
  if (!(src.count > 0)) countOk = false;          // 빈 버킷 행은 없어야
  if (r.tier50Basis !== (hi ? 'top50' : 'bot50') ||
      r.tier20Basis !== (hi ? 'top20' : 'bot20')) basisOk = false;
  /* SOG·VMG·풍각·힐·피치는 모두 P/S 로 쪼개진다 (Danny 2026-05-24 G —
     VMG '풍상 전체' 행 제거: 모든 속도·각도 행이 P/S). */
  if (r.side !== 'P' && r.side !== 'S') sideOk = false;
});
check('패널 표시값이 tackSplit 버킷 원본과 정확히 일치(재배치만)', matchOk);
check('count 0 인 버킷은 행을 만들지 않는다', countOk);
check('상위 50%/20% 근거 표기가 좋은 방향 기준(top/bot)과 일치', basisOk);
check('SOG·VMG·풍각 행이 모두 P/S 로 쪼개진다', sideOk);

check('VMG 에 양 택 합산 전체 행이 없다 (G — 풍상 전체 행 제거)',
  panelGn.rows.filter(function (r) {
    return r.metric === 'vmg' && r.side == null;
  }).length === 0);
check('SOG 가 풍상/풍하 × 포트/스타보드 4 버킷으로 산출된다',
  panelGn.rows.filter(function (r) { return r.metric === 'sog'; }).length === 4,
  'SOG 행 수=' + panelGn.rows.filter(function (r) {
    return r.metric === 'sog'; }).length);
check('GPX 세션 — 힐·피치 행이 없다 (자세 데이터 부재 → 행 숨김)',
  panelGn.rows.every(function (r) {
    return r.metric !== 'heel' && r.metric !== 'pitch';
  }));
check('upwindTimeSec 가 tackSplit 원본과 일치',
  Math.abs(panelGn.upwindTimeSec -
    aGn.wind.tackSplit.upwind.all.timeSec) < EPS);

/* ---------- 5) computeStatsPanel — 심박 행 풍상/풍하 분리 (송정 실측 HR) ----------
   심박을 옛 단독 '전체 세션' 한 줄 대신 풍상/풍하로 분리한다 —
   SOG 와 같은 풍상/풍하 구조라 '빠를 때 더 애쓰는지'를 나란히 본다.
   좌우 택과는 무관하므로 P/S 로는 쪼개지 않는다(풍상/풍하만). */
console.log('\n[5] computeStatsPanel — 심박 행이 풍상/풍하로 분리된다 (송정 실측 HR)');
var aSj = An.analyzeSession(sj, sjW, {});
check('송정 세션에 HR 분석이 있다', !!(aSj.hr && aSj.hr.hasHR));
var panelSj = An.computeStatsPanel(aSj);
var hrRows = panelSj.rows.filter(function (r) { return r.metric === 'hr'; });
check('심박 행이 풍상·풍하 2행으로 산출된다', hrRows.length === 2,
  '심박 행 수=' + hrRows.length);
check('옛 단독 "전체 세션" 심박 행이 없다 (모든 심박 행에 풍상/풍하 mode)',
  hrRows.length > 0 && hrRows.every(function (r) {
    return r.mode === 'upwind' || r.mode === 'downwind'; }));
check('심박은 좌우 택으로 쪼개지 않는다 (side 없음 — 풍상/풍하만)',
  hrRows.every(function (r) { return r.side == null; }));
var hrUp = hrRows.filter(function (r) { return r.mode === 'upwind'; })[0];
var hrDn = hrRows.filter(function (r) { return r.mode === 'downwind'; })[0];
check('풍상·풍하 심박 행이 둘 다 있다', !!hrUp && !!hrDn);
/* 값이 computeWindMetrics 의 풍상/풍하 all 버킷 hr 통계와 정확히 일치 —
   재배치만 하고 재계산은 없다. */
var tsHr = aSj.wind && aSj.wind.tackSplit;
var hrMatchOk = true;
hrRows.forEach(function (r) {
  var src = tsHr && tsHr[r.mode] && tsHr[r.mode].all && tsHr[r.mode].all.hr;
  if (!src || r.avg !== src.avg || r.tier50 !== src.top50 ||
      r.tier20 !== src.top20) {
    hrMatchOk = false;
    console.log('      심박 값 불일치 ' + r.key);
  }
});
check('심박 행 값이 tackSplit 풍상/풍하 hr 통계와 정확히 일치(재배치만)',
  hrMatchOk);
check('심박 행이 평균 ≤ 상위 50% ≤ 상위 20% (상위로 갈수록 높음)',
  hrRows.every(function (r) {
    return r.avg <= r.tier50 + EPS && r.tier50 <= r.tier20 + EPS; }));
check('심박 상위 20% 가 세션 관측 최고 이하 (구간 평균이라 raw 극값 안쪽)',
  hrRows.every(function (r) { return r.tier20 <= aSj.hr.maxBpm + EPS; }));
check('심박 행 근거 표기가 top50·top20',
  hrRows.every(function (r) {
    return r.tier50Basis === 'top50' && r.tier20Basis === 'top20'; }));
check('심박 행 단위가 bpm', hrRows.every(function (r) { return r.unit === 'bpm'; }));
check('심박 행 direction = neutral (신체 부하 참고 지표)',
  hrRows.every(function (r) { return r.direction === 'neutral'; }));
check('hrAvailable 가 true', panelSj.hrAvailable === true);

/* ---------- 6) .vkx 경로 — 합성 VKX 로 힐·피치 행 end-to-end ---------- */
console.log('\n[6] .vkx — 합성 VKX(송정 트랙+자세) 로 힐·피치 통계 행 검증');

/* 오일러각(heel·pitch, yaw=0) → 단위 쿼터니언 (ZYX Tait-Bryan).
   vkx-parser.quatToHeelPitch 가 그대로 heel·pitch 를 복원한다. */
function eulerToQuat(heelDeg, pitchDeg) {
  var phi = heelDeg * Math.PI / 180, the = pitchDeg * Math.PI / 180;
  var cp = Math.cos(phi / 2), sp = Math.sin(phi / 2);
  var ct = Math.cos(the / 2), st = Math.sin(the / 2);
  return { w: ct * cp, x: ct * sp, y: st * cp, z: -st * sp };
}
/* 송정 GPX 좌표·시각 + 합성 자세로 VKX 1.4 바이너리를 만든다.
   행 구조: [1B key][payload]. 0xFF 페이지헤더(7B) + 0x02 위치행(44B). */
function buildVKX(points, attFn) {
  /* attFn(i) -> {heel,pitch} — 합성 자세 생성기. 기본값은 힐·피치를
     인덱스에 따라 천천히 흔드는 현실적 분포(둘 다 한 부호). §8 은
     택마다 부호가 갈리는 힐을 넣어 부호 상쇄 수정을 검증한다. */
  attFn = attFn || function (i) {
    return { heel: 6 + 5 * Math.sin(i * 0.04),
             pitch: -1 + 4 * Math.sin(i * 0.03 + 1) };
  };
  var n = points.length;
  var buf = Buffer.alloc(8 + n * 45);
  var o = 0;
  buf.writeUInt8(0xFF, o); buf.writeUInt8(0x05, o + 1); o += 8;  // 페이지 헤더
  for (var i = 0; i < n; i++) {
    var p = points[i];
    buf.writeUInt8(0x02, o); o++;
    var t = p.time;
    buf.writeUInt32LE(t % 4294967296, o);
    buf.writeUInt32LE(Math.floor(t / 4294967296), o + 4);
    buf.writeInt32LE(Math.round(p.lat * 1e7), o + 8);
    buf.writeInt32LE(Math.round(p.lng * 1e7), o + 12);
    buf.writeFloatLE(NaN, o + 16);          // SOG 없음 → 분석이 위치로 산출
    buf.writeFloatLE(0, o + 20);            // COG (미사용)
    buf.writeFloatLE(0, o + 24);            // 고도
    var att = attFn(i);
    var q = eulerToQuat(att.heel, att.pitch);
    buf.writeFloatLE(q.w, o + 28);
    buf.writeFloatLE(q.x, o + 32);
    buf.writeFloatLE(q.y, o + 36);
    buf.writeFloatLE(q.z, o + 40);
    o += 44;
  }
  return buf;
}

var sjPts = sjParsed._points.filter(function (p) { return p.time != null; });
var vkxBuf = buildVKX(sjPts);
var vkxParsed = Vkx.parseVKX(vkxBuf);
check('합성 VKX 가 파싱된다', !!vkxParsed && vkxParsed.pointCount > 100,
  'pointCount=' + (vkxParsed && vkxParsed.pointCount));
check('VKX 파서가 자세 데이터 보유를 인식 (hasAttitude)',
  vkxParsed.hasAttitude === true, 'hasAttitude=' + vkxParsed.hasAttitude);

var vkxSess = An.normalizeSession(vkxParsed);
/* 자세 쿼터니언 → heel·pitch 왕복 정확도 (파서 quatToHeelPitch 검증) */
var rtOk = true;
for (var k = 0; k < vkxSess.samples.length; k += 400) {
  var s = vkxSess.samples[k];
  if (s.heel == null || s.pitch == null) { rtOk = false; break; }
}
check('정규화된 표본에 heel·pitch 가 보존된다', rtOk);

var vkxW = An.estimateWindFromTrack(vkxSess).windDir;
var aVkx = An.analyzeSession(vkxSess, vkxW, {});
var panelVkx = An.computeStatsPanel(aVkx);
var heelRows = panelVkx.rows.filter(function (r) { return r.metric === 'heel'; });
var pitchRows = panelVkx.rows.filter(function (r) { return r.metric === 'pitch'; });
check('.vkx — 힐(Heel) 행이 산출된다', heelRows.length >= 1,
  '힐 행 수=' + heelRows.length);
check('.vkx — 피치(Pitch) 행이 산출된다', pitchRows.length >= 1,
  '피치 행 수=' + pitchRows.length);

var vkxMatchOk = true, vkxOrdOk = true;
heelRows.concat(pitchRows).forEach(function (r) {
  /* 힐·피치 모두 포트(P)·스타보드(S) 버킷 (Danny 2026-05-23). */
  var src = aVkx.wind.tackSplit[r.mode][r.side || 'all'][r.metric];
  if (!src) { vkxMatchOk = false; return; }
  /* 힐·피치는 중립 → '상위'는 0 에서 먼 쪽(평균 부호로 결정). */
  var hi = (src.avg >= 0);
  var e50 = hi ? src.top50 : src.bot50, e20 = hi ? src.top20 : src.bot20;
  if (r.avg !== src.avg || r.tier50 !== e50 || r.tier20 !== e20) {
    vkxMatchOk = false;
  }
  /* 단조: 평균 → 상위로 갈수록 0 에서 멀어진다 */
  var mono = hi
    ? (r.avg <= r.tier50 + EPS && r.tier50 <= r.tier20 + EPS)
    : (r.avg >= r.tier50 - EPS && r.tier50 >= r.tier20 - EPS);
  if (!mono) vkxOrdOk = false;
});
check('.vkx — 힐·피치 행 값이 tackSplit 원본 구간 평균과 일치', vkxMatchOk);
check('.vkx — 힐·피치 행도 평균→상위 구간 단조', vkxOrdOk);
check('.vkx — 힐 단위가 도(°)', heelRows[0] && heelRows[0].unit === 'deg');
check('.vkx — 힐이 포트/스타보드로 쪼개진다 (side = P·S)',
  heelRows.length >= 2 && heelRows.every(function (r) {
    return r.side === 'P' || r.side === 'S'; }));
check('.vkx — 피치도 포트/스타보드로 쪼개진다 (side = P·S · Danny 2026-05-23)',
  pitchRows.length >= 2 && pitchRows.every(function (r) {
    return r.side === 'P' || r.side === 'S'; }));

/* ---------- 7) 회귀 — 기존 분석 파이프라인 무손상 ---------- */
console.log('\n[7] 회귀 — bot20 추가가 기존 통계·분석을 깨지 않는다');
check('computeWindMetrics 후방호환 키(vmgUpwindAvgMs) 유지',
  typeof aGn.wind.vmgUpwindAvgMs === 'number');
check('top50·top20 이 기존대로 산출된다',
  typeof aGn.wind.vmgUpwindTop50Ms === 'number' &&
  typeof aGn.wind.vmgUpwindTop20Ms === 'number');
check('vmgUpwindTop20Ms = tackSplit.upwind.all.vmg.top20 (회귀 일관)',
  aGn.wind.vmgUpwindTop20Ms === aGn.wind.tackSplit.upwind.all.vmg.top20);
var aGnNoWind = An.analyzeSession(gn, null, {});
check('풍향 미설정 analyzeSession 통과 (wind=null)',
  aGnNoWind && aGnNoWind.wind == null);
check('analyzeSession.summary·polar 가 그대로 산출된다',
  !!aGn.summary && !!aGn.polar);

/* ---------- 8) 지표별 좋은 방향 · 풍상/풍하 × 포트/스타보드 분할 ---------- */
console.log('\n[8] 지표별 좋은 방향(direction) · 좌우(P/S) 분할 검증');

/* 8-1) direction 필드 — 지표·방향별 '좋은 방향'이 옳게 붙는다. */
function expectDir(metric, mode) {
  if (metric === 'sog' || metric === 'vmg') return 'high';
  if (metric === 'twa') return (mode === 'upwind') ? 'low' : 'neutral';
  return 'neutral';                       // heel · pitch · hr
}
var dirOk = true, dirSeen = 0;
panelVkx.rows.forEach(function (r) {
  var exp = (r.metric === 'hr') ? 'neutral' : expectDir(r.metric, r.mode);
  dirSeen++;
  if (r.direction !== exp) {
    dirOk = false;
    console.log('      direction 불일치 ' + r.key + ' = ' +
      r.direction + ' (기대 ' + exp + ')');
  }
});
check('모든 행에 direction 이 있고 지표·방향별로 옳다',
  dirOk && dirSeen >= 8, 'dirSeen=' + dirSeen);
check('풍상 TWA direction = low (작을수록 바람에 가깝게 포인팅)',
  panelVkx.rows.some(function (r) {
    return r.metric === 'twa' && r.mode === 'upwind' && r.direction === 'low';
  }));
check('풍하 TWA direction = neutral (비단조 — 클수록 좋음 아님)',
  panelVkx.rows.some(function (r) {
    return r.metric === 'twa' && r.mode === 'downwind' &&
      r.direction === 'neutral';
  }));
check('SOG·VMG direction = high (클수록 좋음)',
  panelVkx.rows.filter(function (r) {
    return r.metric === 'sog' || r.metric === 'vmg';
  }).every(function (r) { return r.direction === 'high'; }));
check('힐·피치 direction = neutral (트림·자세 특성)',
  heelRows.concat(pitchRows).every(function (r) {
    return r.direction === 'neutral';
  }));

/* 8-2) 힐 좌우(P/S) 분할 — 택마다 부호가 갈리는 합성 자세로 검증.
   택과 상관된 힐(스타보드 +, 포트 −)을 넣어, 포트 버킷 평균은 음수·
   스타보드 버킷 평균은 양수로 나오고 좌우 크기가 대칭이어야 한다.
   택 분류는 분석 엔진과 같은 식(§421: angleDiff>=0 → P)으로 맞춘다 —
   포트(angleDiff>=0)에 음수 힐, 스타보드(angleDiff<0)에 양수 힐을 넣는다. */
var HEEL_MAG = 33;
var heelByIdx = [];
for (var hx = 0; hx < sjPts.length; hx++) {
  var pa = sjPts[hx > 0 ? hx - 1 : 0];
  var pb = sjPts[hx > 0 ? hx : 1];
  var hdg = Geo.bearing(pa, pb);
  var sgn = Geo.angleDiff(vkxW, hdg);     // §421: >=0 → 포트(P)
  heelByIdx.push((sgn >= 0 ? -1 : 1) * (HEEL_MAG + 3 * Math.sin(hx * 0.05)));
}
var vkxPSBuf = buildVKX(sjPts, function (i) {
  return { heel: heelByIdx[i], pitch: 9 };
});
var aVkxPS = An.analyzeSession(
  An.normalizeSession(Vkx.parseVKX(vkxPSBuf)), vkxW, {});
var panelPS = An.computeStatsPanel(aVkxPS);
var heelPS = panelPS.rows.filter(function (r) { return r.metric === 'heel'; });
check('힐이 풍상/풍하 × 포트/스타보드 버킷으로 산출된다',
  heelPS.length >= 2 && heelPS.every(function (r) { return r.side; }),
  '힐 행 수=' + heelPS.length);

var portOk = true, stbdOk = true, symOk = true, seenP = 0, seenS = 0;
['upwind', 'downwind'].forEach(function (mode) {
  var pRow = heelPS.filter(function (r) {
    return r.mode === mode && r.side === 'P'; })[0];
  var sRow = heelPS.filter(function (r) {
    return r.mode === mode && r.side === 'S'; })[0];
  if (pRow) { seenP++; if (!(pRow.avg < 0)) portOk = false; }
  if (sRow) { seenS++; if (!(sRow.avg > 0)) stbdOk = false; }
  if (pRow && sRow) {
    if (Math.abs(Math.abs(pRow.avg) - Math.abs(sRow.avg)) > 8) symOk = false;
    console.log('      ' + mode + ' — 포트 ' + pRow.avg.toFixed(1) +
      '° · 스타보드 ' + sRow.avg.toFixed(1) + '°');
  }
});
check('힐 포트(P) 버킷 평균이 음수 (한 택은 −)', portOk && seenP >= 1);
check('힐 스타보드(S) 버킷 평균이 양수 (반대 택은 +)', stbdOk && seenS >= 1);
check('힐 좌우 크기가 대칭 (|포트| ≈ |스타보드|, 8° 이내)', symOk);
/* 좌우를 합치면(옛 방식) 부호가 상쇄돼 ≈0 — P/S 분할이 필요한 이유 */
var combinedUp = aVkxPS.wind.tackSplit.upwind.all.heel;
check('좌우 합산(all) 힐 평균은 ≈0 으로 상쇄된다 — P/S 분할이 필요한 이유',
  combinedUp && Math.abs(combinedUp.avg) < 12,
  '합산 평균=' + (combinedUp ? combinedUp.avg.toFixed(1) : 'n/a') + '°');
/* 힐 P 버킷 단조 — 평균 → 상위로 갈수록 더 음수(0 에서 멀어짐) */
check('힐 포트 버킷 단조 — 평균 ≥ 상위 50% ≥ 상위 20% (더 음수)',
  heelPS.filter(function (r) { return r.side === 'P'; })
    .every(function (r) {
      return r.avg >= r.tier50 - EPS && r.tier50 >= r.tier20 - EPS;
    }));

/* 8-3) 컬럼 구조 — 평균/상위50%/상위20%, side 필드, 옛 잔재 없음 */
console.log('\n   컬럼 구조 — 평균 / 상위 50% / 상위 20% · side(P/S)');
var colOk = true;
panelGn.rows.concat(panelVkx.rows).concat(panelSj.rows)
  .concat(panelPS.rows).forEach(function (r) {
  if (typeof r.tier50 !== 'number' || typeof r.tier20 !== 'number' ||
      typeof r.avg !== 'number') colOk = false;
  if (!('side' in r)) colOk = false;
  if ('max' in r || 'min' in r || 'heelAbs' in r) colOk = false;  // 옛 잔재
});
check('모든 행에 avg·tier50·tier20·side 가 있고 옛 잔재(max/min)가 없다',
  colOk);
check('풍상 풍각은 \'상위\'가 작은 각 쪽 — tier20 ≤ tier50 ≤ 평균',
  panelGn.rows.filter(function (r) {
    return r.metric === 'twa' && r.mode === 'upwind';
  }).every(function (r) {
    return r.tier20 <= r.tier50 + EPS && r.tier50 <= r.avg + EPS;
  }));
check('SOG 는 \'상위\'가 큰 값 쪽 — 평균 ≤ tier50 ≤ tier20',
  panelGn.rows.filter(function (r) {
    return r.metric === 'sog';
  }).every(function (r) {
    return r.avg <= r.tier50 + EPS && r.tier50 <= r.tier20 + EPS;
  }));

/* ---------- 결과 ---------- */
console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
process.exit(fail === 0 ? 0 : 1);
