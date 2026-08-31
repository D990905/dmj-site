/* ============================================================
 * session-merger.js — 다중 파일 자동 융합 오케스트레이터 (§430)
 *
 * 옥대표님이 세션 파일 여러 개(RaceBox GPX·RaceBox CSV·Waterspeed GPX·
 * Garmin GPX/TCX 등)를 한꺼번에 드롭하면, 자동으로:
 *   1) 형식 감지 → 각 파일 파싱 (표준 내부 스키마)
 *   2) 가장 고품질 항적(primary trajectory) 자동 선택
 *   3) IMU(heel/pitch) 를 RaceBox CSV 에서 병합
 *   4) HR(심박) 을 Garmin/Waterspeed 에서 병합
 *   5) 시간축 선형 보간 정합 + GPS 스파이크 필터
 * 후 GPX/CSV 파서와 동일한 parsed 객체 + fusion 리포트를 돌려준다.
 * 그대로 An.normalizeSession() 에 넣으면 대시보드 분석이 돌아간다.
 *
 * ── 설계 결정 (문서화 의무 §430) ────────────────────────────
 *  · GPX 계열(RaceBox/Waterspeed/Garmin/generic)은 이미 gpx-parser.js
 *    가 네임스페이스 무관 localName 기반으로 speed·hr 을 전부 뽑으므로,
 *    변종마다 별도 파일을 복제하지 않고 여기서 creator 로 소스만 라벨링
 *    한다(중복 코드 회피·회귀 위험 최소화). 실제로 새로 필요한 파서는
 *    RaceBox CSV(js/parsers/racebox-csv.js) 하나뿐이라 그것만 신설.
 *  · TCX(Garmin) 는 경량 인라인 파서로 Trackpoint(Time/lat/lon/alt/hr/
 *    speed)만 뽑는다.
 *
 *  · Primary 자동 선택 규칙(우선순위):
 *      (1) 샘플레이트가 뚜렷이(>15%) 높으면 우선 — RaceBox 25Hz >
 *          Garmin 1Hz > Waterspeed 0.6Hz.
 *      (2) 샘플레이트 비슷하면 GPS 항적 품질이 나은 GPX 계열을 우선
 *          (같은 RaceBox 세션의 GPX vs CSV → GPX). 위치 기반 track 이
 *          IMU 로그(CSV)보다 트랙으로 적합.
 *      (3) 그래도 동률이면 포인트 수 많은 쪽.
 *
 *  · GPS 스파이크 필터: 인접 포인트로의 순간 점프가 200m 이상이면서
 *    시간차 0.2s 미만(즉 >1000 m/s, 물리적으로 불가능한 GPS 글리치)인
 *    '고립 텔레포트' 포인트만 제거하고 개수를 리포트한다. 그 외의
 *    미세 노이즈·과속 구간은 삭제하지 않고 normalizeSession 의 검증된
 *    이상치 거부(SOG 교차검증)에 맡긴다 — 포인트 전량 보존 철학 유지.
 *
 *  · 시간축 정합: primary 각 포인트 시각 t 에 대해, 도너 소스의 채널
 *    (heel/pitch/hr/speed)을 시간 선형 보간(bracket lerp)으로 채운다.
 *    t 가 도너 범위 밖이면 결측(null) — 분석 로직이 skip.
 *
 *  · IMU 축 매핑 가정은 analysis-imu.js 에 명시(옥대표님 검증 필요).
 *
 * 브라우저: RDSessionMerger.mergeFiles([{name,text}...])
 * Node:     require('./session-merger') (RDGpx/RDRaceboxCSV/RDCsv/RDImu 주입)
 * ============================================================ */
(function (global) {
  'use strict';

  /* 의존 모듈 — 브라우저는 전역, Node 는 require 주입(setDeps) */
  var Gpx, RaceboxCSV, WaterspeedCSV, Csv, Imu;
  function resolveDeps() {
    Gpx        = Gpx        || global.RDGpx;
    RaceboxCSV = RaceboxCSV || global.RDRaceboxCSV;
    WaterspeedCSV = WaterspeedCSV || global.RDWaterspeedCSV;
    Csv        = Csv        || global.RDCsv;
    Imu        = Imu        || global.RDImu;
  }
  function setDeps(d) {
    if (d.Gpx) Gpx = d.Gpx;
    if (d.RaceboxCSV) RaceboxCSV = d.RaceboxCSV;
    if (d.WaterspeedCSV) WaterspeedCSV = d.WaterspeedCSV;
    if (d.Csv) Csv = d.Csv;
    if (d.Imu) Imu = d.Imu;
  }

  /* ---------- 형식 감지 ---------- */
  /* name·text 시그니처로 포맷/소스를 판정. 반환:
     { format:'gpx'|'racebox-csv'|'sailtech-csv'|'tcx', source, creator } */
  function detectFormat(name, text) {
    var lower = (name || '').toLowerCase();
    var head = (text || '').slice(0, 1200);

    /* CSV 계열 — 확장자 또는 내용 */
    var raceboxCsv = (RaceboxCSV && RaceboxCSV.looksLike && RaceboxCSV.looksLike(text));
    if (raceboxCsv) {
      return { format: 'racebox-csv', source: 'racebox-csv', creator: 'RaceBox' };
    }
    /* §448 Waterspeed 앱 CSV — 1Hz 심박이 실려 있어 훈련부하·HR 도너로
       쓴다. RaceBox 는 Latitude/Longitude, Waterspeed 는 Lat/Long 이라
       헤더가 겹치지 않는다. */
    if (WaterspeedCSV && WaterspeedCSV.looksLike && WaterspeedCSV.looksLike(text)) {
      return { format: 'waterspeed-csv', source: 'waterspeed-csv', creator: 'Waterspeed' };
    }
    if (/\.csv$/.test(lower) || (Csv && Csv.looksLikeCSV && Csv.looksLikeCSV(text))) {
      if (/^#\s*SailTech/i.test(head) || (Csv && Csv.looksLikeCSV && Csv.looksLikeCSV(text))) {
        return { format: 'sailtech-csv', source: 'sailtech-csv', creator: 'SailTech' };
      }
    }

    /* TCX — Garmin 트레이닝 센터 */
    if (/<TrainingCenterDatabase/i.test(head)) {
      return { format: 'tcx', source: 'garmin-tcx', creator: 'Garmin' };
    }

    /* GPX 계열 — creator 속성으로 변종 라벨 */
    if (/<gpx/i.test(head) || /<trkpt/i.test(head)) {
      var m = head.match(/creator\s*=\s*"([^"]*)"/i);
      var creator = m ? m[1] : '';
      var lc = creator.toLowerCase();
      var source = 'generic-gpx';
      if (/racebox/.test(lc)) source = 'racebox-gpx';
      else if (/waterspeed/.test(lc)) source = 'waterspeed-gpx';
      else if (/garmin/.test(lc)) source = 'garmin-gpx';
      return { format: 'gpx', source: source, creator: creator || 'GPX' };
    }

    return { format: 'unknown', source: 'unknown', creator: '' };
  }

  /* ---------- 경량 TCX 파서 ---------- */
  function parseTCX(text, DP) {
    var doc = new DP().parseFromString(text, 'application/xml');
    var perr = doc.getElementsByTagName('parsererror');
    if (perr && perr.length) throw new Error('TCX 파일이 올바른 XML 형식이 아닙니다.');
    var tps = doc.getElementsByTagName('Trackpoint');
    var points = [];
    for (var i = 0; i < tps.length; i++) {
      var tp = tps[i];
      function firstText(el, tag) {
        var n = el.getElementsByTagName(tag);
        return (n && n.length) ? (n[0].textContent || '').trim() : null;
      }
      var timeTxt = firstText(tp, 'Time');
      var time = timeTxt ? Date.parse(timeTxt) : null;
      var latTxt = firstText(tp, 'LatitudeDegrees');
      var lonTxt = firstText(tp, 'LongitudeDegrees');
      if (latTxt == null || lonTxt == null) continue;
      var lat = parseFloat(latTxt), lng = parseFloat(lonTxt);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      var altTxt = firstText(tp, 'AltitudeMeters');
      var ele = altTxt != null ? parseFloat(altTxt) : null;
      if (!isFinite(ele)) ele = null;
      var hrTxt = firstText(tp, 'HeartRateBpm') || firstText(tp, 'Value');
      var hr = null;
      if (hrTxt != null) { var hv = parseFloat(hrTxt); if (isFinite(hv) && hv >= 20 && hv <= 240) hr = Math.round(hv); }
      var spTxt = firstText(tp, 'Speed');
      var speed = null;
      if (spTxt != null) { var sv = parseFloat(spTxt); if (isFinite(sv) && sv >= 0 && sv < 100) speed = sv; }
      points.push({ lat: lat, lng: lng, ele: ele, time: isFinite(time) ? time : null, speed: speed, hr: hr });
    }
    if (points.length < 2) throw new Error('TCX 에서 Trackpoint 를 충분히 찾지 못했습니다.');
    var withTime = 0, withSpeed = 0, withHR = 0;
    points.forEach(function (p) { if (p.time != null) withTime++; if (p.speed != null) withSpeed++; if (p.hr != null) withHR++; });
    return {
      source: 'garmin-tcx',
      tracks: [{ name: 'Garmin TCX 세션', segments: [points] }],
      pointCount: points.length, trackName: 'Garmin TCX 세션',
      hasTime: withTime >= points.length * 0.5,
      speedSource: withSpeed >= points.length * 0.5 ? 'device' : 'derived',
      hasHR: withHR >= points.length * 0.5, hrPointCount: withHR
    };
  }

  /* ---------- 단일 파일 파싱 → 표준 스키마 + 메타 ---------- */
  function parseOne(file, opts) {
    opts = opts || {};
    resolveDeps();
    var DP = opts.DOMParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    var det = detectFormat(file.name, file.text);
    var parsed;
    if (det.format === 'racebox-csv') {
      if (!RaceboxCSV) throw new Error('RaceBox CSV 파서를 사용할 수 없습니다.');
      parsed = RaceboxCSV.parse(file.text);
    } else if (det.format === 'waterspeed-csv') {
      if (!WaterspeedCSV) throw new Error('Waterspeed CSV 파서를 사용할 수 없습니다.');
      parsed = WaterspeedCSV.parse(file.text);
    } else if (det.format === 'sailtech-csv') {
      if (!Csv) throw new Error('CSV 파서를 사용할 수 없습니다.');
      parsed = Csv.parseCSV(file.text);
    } else if (det.format === 'tcx') {
      if (!DP) throw new Error('이 환경에서는 XML 파서를 사용할 수 없습니다.');
      parsed = parseTCX(file.text, DP);
    } else if (det.format === 'gpx') {
      if (!Gpx) throw new Error('GPX 파서를 사용할 수 없습니다.');
      parsed = Gpx.parseGPX(file.text, { DOMParser: DP });
    } else {
      throw new Error('지원하지 않는 파일 형식입니다: ' + file.name);
    }

    return wrapParsed(parsed, det, file.name);
  }

  /* 이미 파싱된 parsed 객체 + 감지결과 → 소스 메타(샘플레이트·시간범위·
     채널 보유 플래그) 부착. 브라우저 parseOne 과 Node 셀프테스트(정규식
     GPX 파싱)가 공유하는 래퍼 — DOMParser 의존 없이 재사용 가능. */
  function wrapParsed(parsed, det, fileName) {
    var pts = flatten(parsed);
    var span = timeSpan(pts);
    var rate = (span.durationSec > 0 && pts.length > 1)
      ? (pts.length - 1) / span.durationSec : 0;
    return {
      det: det,
      source: (det && det.source) || parsed.source || 'unknown',
      creator: parsed.creator || (det && det.creator) || '',
      parsed: parsed,
      points: pts,
      pointCount: pts.length,
      sampleRateHz: rate,
      startEpoch: span.start,
      endEpoch: span.end,
      hasPosition: pts.length >= 2,
      hasSpeed: countField(pts, 'speed') >= pts.length * 0.5,
      hasHR: countField(pts, 'hr') >= 1,
      hasImu: countField(pts, 'gforceZ') >= 1 || countField(pts, 'heel') >= 1,
      fileName: fileName || parsed.trackName || 'file'
    };
  }

  /* 트랙→세그먼트→포인트 평탄화 (시각 있는 것만, 정렬) */
  function flatten(parsed) {
    var out = [];
    (parsed.tracks || []).forEach(function (tr) {
      (tr.segments || []).forEach(function (seg) {
        seg.forEach(function (p) { out.push(p); });
      });
    });
    out = out.filter(function (p) { return p && p.time != null; })
             .sort(function (a, b) { return a.time - b.time; });
    return out;
  }

  function timeSpan(pts) {
    if (!pts.length) return { start: null, end: null, durationSec: 0 };
    var s = pts[0].time, e = pts[pts.length - 1].time;
    return { start: s, end: e, durationSec: (e - s) / 1000 };
  }

  function countField(pts, key) {
    var n = 0;
    for (var i = 0; i < pts.length; i++) if (pts[i] && pts[i][key] != null) n++;
    return n;
  }

  /* ---------- Primary trajectory 자동 선택 ---------- */
  var GPX_FAMILY = { 'racebox-gpx': 1, 'waterspeed-gpx': 1, 'garmin-gpx': 1,
                     'garmin-tcx': 1, 'generic-gpx': 1 };
  function pickPrimary(srcs) {
    var cand = srcs.filter(function (s) { return s.hasPosition; });
    if (!cand.length) return null;
    cand = cand.slice().sort(function (a, b) {
      var ra = a.sampleRateHz, rb = b.sampleRateHz;
      var hi = Math.max(ra, rb) || 1;
      if (Math.abs(ra - rb) / hi > 0.15) return rb - ra;    // (1) 뚜렷한 샘플레이트 우선
      var ga = GPX_FAMILY[a.source] ? 1 : 0, gb = GPX_FAMILY[b.source] ? 1 : 0;
      if (ga !== gb) return gb - ga;                         // (2) GPX 계열 우선
      return b.pointCount - a.pointCount;                    // (3) 포인트 수
    });
    return cand[0];
  }

  /* ---------- GPS 스파이크 필터 (고립 텔레포트) ---------- */
  function filterSpikes(points) {
    if (points.length < 3) return { points: points, removed: 0 };
    var kept = [points[0]];
    var removed = 0;
    for (var i = 1; i < points.length - 1; i++) {
      var prev = kept[kept.length - 1], cur = points[i], next = points[i + 1];
      var dIn = haversine(prev, cur), dOut = haversine(cur, next);
      var dtIn = (cur.time - prev.time) / 1000;
      /* 200m 이상 점프를 0.2s 미만에 하고(→>1000 m/s) 곧바로 되돌아오면
         (dOut 도 큼) 고립 글리치로 판단해 제거 */
      if (dIn > 200 && dtIn >= 0 && dtIn < 0.2 && dOut > 200) { removed++; continue; }
      kept.push(cur);
    }
    kept.push(points[points.length - 1]);
    return { points: kept, removed: removed };
  }

  var R = 6371000;
  function haversine(a, b) {
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLon = (b.lng - a.lng) * Math.PI / 180;
    var la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* ---------- 시간축 선형 보간 ---------- */
  /* channel = [{t, v}] (t 오름차순). t 에 대한 보간값 or null. */
  function makeChannel(pts, key) {
    var ch = [];
    for (var i = 0; i < pts.length; i++) {
      var v = pts[i][key];
      if (v != null && isFinite(v)) ch.push({ t: pts[i].time, v: v });
    }
    return ch;
  }
  function interp(ch, t, maxGapMs) {
    var gap = maxGapMs || 15000;   // 15s 이상 벌어진 구간은 결측
    if (!ch.length) return null;
    if (t <= ch[0].t) return (ch[0].t - t <= gap) ? ch[0].v : null;
    if (t >= ch[ch.length - 1].t) {
      return (t - ch[ch.length - 1].t <= gap) ? ch[ch.length - 1].v : null;
    }
    /* 이진 탐색 bracket */
    var lo = 0, hi = ch.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (ch[mid].t <= t) lo = mid; else hi = mid;
    }
    var a = ch[lo], b = ch[hi];
    if (b.t - a.t > gap) return null;
    var f = (t - a.t) / (b.t - a.t);
    return a.v + (b.v - a.v) * f;
  }

  /* ---------- 병합 오케스트레이션 ---------- */
  function merge(srcs) {
    resolveDeps();
    if (!srcs || !srcs.length) throw new Error('융합할 소스가 없습니다.');
    var primary = pickPrimary(srcs);
    if (!primary) throw new Error('위치 데이터를 가진 파일이 없습니다.');

    /* primary 포인트 복제(원본 불변) */
    var pts = primary.points.map(function (p) {
      var q = { lat: p.lat, lng: p.lng, ele: p.ele, time: p.time };
      if (p.speed != null) q.speed = p.speed;
      if (p.hr != null) q.hr = p.hr;
      if (p.heel != null) q.heel = p.heel;
      if (p.pitch != null) q.pitch = p.pitch;
      if (p.gforceX != null) { q.gforceX = p.gforceX; q.gforceY = p.gforceY; q.gforceZ = p.gforceZ; }
      /* LeanAngle 은 옮기지 않는다 — RaceBox Bike Mode 의 LeanAngle 은
         오토바이 코너링 기울기라 보드 힐이 아니다(실측 r=0.378 vs yaw
         rate, analysis-imu.js 참조). 대신 bikeMode 플래그를 결과에
         실어 화면이 "왜 자세가 없는지" 를 정확히 말하게 한다. */
      if (p.gyroX != null) q.gyroX = p.gyroX;
      if (p.gyroY != null) q.gyroY = p.gyroY;
      if (p.gyroZ != null) q.gyroZ = p.gyroZ;
      return q;
    });

    /* GPS 스파이크 필터 */
    var sf = filterSpikes(pts);
    pts = sf.points;

    /* primary 자체 IMU → heel/pitch (자이로 있으면 상보필터 보정) */
    if (Imu) Imu.computeAttitude(pts);


    /* ── 도너 선택 ─────────────────────────────────────────── */
    var others = srcs.filter(function (s) { return s !== primary; });

    /* IMU 도너 — heel 미보유 시 gforce/heel 가진 소스에서 */
    var imuInfo = null;
    if (countField(pts, 'heel') < pts.length * 0.5) {
      var imuDonor = pickDonor(srcs, primary, function (s) { return s.hasImu; });
      if (imuDonor) {
        var dpts = imuDonor.points.slice();
        /* 도너 원본(등간격 IMU 타임라인)에서 상보필터 보정 후, 매끈해진
           heel/pitch 를 primary 시각으로 선형보간 정합 */
        if (Imu) Imu.computeAttitude(dpts);
        var heelCh = makeChannel(dpts, 'heel');
        var pitchCh = makeChannel(dpts, 'pitch');
        var mHeel = 0;
        for (var i = 0; i < pts.length; i++) {
          if (pts[i].heel == null) {
            var h = interp(heelCh, pts[i].time);
            var pch = interp(pitchCh, pts[i].time);
            if (h != null) { pts[i].heel = h; mHeel++; }
            if (pch != null) pts[i].pitch = pch;
          }
        }
        imuInfo = { merged: true, source: imuDonor.source, creator: imuDonor.creator,
                    pointCount: mHeel, fileName: imuDonor.fileName };
      }
    } else {
      imuInfo = { merged: false, source: primary.source, pointCount: countField(pts, 'heel'), own: true };
    }

    /* HR 도너 — hr 미보유 시 hr 가진 소스에서 */
    var hrInfo = null;
    if (countField(pts, 'hr') < 1) {
      var hrDonor = pickDonor(srcs, primary, function (s) { return s.hasHR; });
      if (hrDonor) {
        var hrCh = makeChannel(hrDonor.points, 'hr');
        var mHr = 0;
        for (var j = 0; j < pts.length; j++) {
          if (pts[j].hr == null) {
            var hv = interp(hrCh, pts[j].time);
            if (hv != null) { pts[j].hr = Math.round(hv); mHr++; }
          }
        }
        hrInfo = { merged: true, source: hrDonor.source, creator: hrDonor.creator,
                   pointCount: mHr, fileName: hrDonor.fileName };
      }
    } else {
      hrInfo = { merged: false, source: primary.source, pointCount: countField(pts, 'hr'), own: true };
    }

    /* Speed 도너 — primary 가 속도 부족하면 device speed 가진 소스에서 */
    var speedInfo = null;
    var primSpeedCov = countField(pts, 'speed');
    if (primSpeedCov < pts.length * 0.5) {
      var spDonor = pickDonor(srcs, primary, function (s) { return s.hasSpeed; });
      if (spDonor) {
        var spCh = makeChannel(spDonor.points, 'speed');
        var mSp = 0;
        for (var k = 0; k < pts.length; k++) {
          if (pts[k].speed == null) {
            var sv = interp(spCh, pts[k].time);
            if (sv != null) { pts[k].speed = sv; mSp++; }
          }
        }
        speedInfo = { source: spDonor.source, pointCount: mSp, device: true };
      }
    } else {
      speedInfo = { source: primary.source, pointCount: primSpeedCov, device: primary.hasSpeed, own: true };
    }

    /* 최종 플래그 */
    var withSpeed = countField(pts, 'speed');
    /* §444 — 센서를 붙이는 면·각도가 세션마다 달라지므로 0점을 잡는다.
       추락 직후 보드만 떠 있는 구간을 찾아 그때를 0° 로 본다.
       ⚠ 반드시 도너 병합이 끝난 뒤에 한다. 앞에서 하면 보정이 heel 을
       지웠을 때 아래 'heel 미보유 → 도너에서 채움' 경로가 발동해
       보정 안 된 값으로 되살아난다 (실제로 겪은 버그). */
    var attitudeCal = null;
    if (Imu && Imu.calibrateAttitude) attitudeCal = Imu.calibrateAttitude(pts);

    var withHeel = countField(pts, 'heel');
    var withHR = countField(pts, 'hr');
    var speedSource = (withSpeed >= pts.length * 0.5) ? 'device' : 'derived';

    var name = primary.parsed.trackName || 'RaceBox 세션';
    var parsed = {
      tracks: [{ name: name, segments: [pts] }],
      pointCount: pts.length,
      trackName: name,
      hasTime: true,
      speedSource: speedSource,
      hasHR: withHR >= 1,
      hrPointCount: withHR,
      hasAttitude: withHeel >= pts.length * 0.5,
      /* §451 — 어느 소스든 Bike Mode 로 내보낸 게 있으면 표시한다.
         Bike Mode 는 가로 G(GForceY)를 LeanAngle 로 대체하므로 힐을
         복원할 수 없다. 이 플래그가 없으면 화면이 "자세 없음" 이라고만
         하고 사용자는 다음에 뭘 바꿔야 할지 알 수 없다. */
      bikeMode: srcs.some(function (x) {
        return x && x.parsed && x.parsed.bikeMode === true;
      }),
      _fusion: buildFusion(srcs, primary, imuInfo, hrInfo, speedInfo, sf, pts.length, withHeel, withHR)
    };
    /* 자세 보정 결과를 융합 정보에 실어 화면이 사유를 표시할 수 있게 한다.
       보정이 자세를 폐기했으면 hasAttitude 도 내려야 한다 — withHeel 은
       폐기 전에 센 값이라 그대로 두면 '자세 있음' 으로 남는다. */
    if (parsed._fusion) parsed._fusion.attitude = attitudeCal;
    if (attitudeCal && !attitudeCal.ok) {
      parsed.hasAttitude = false;
      if (parsed._fusion) parsed._fusion.attitudeRejected = attitudeCal.reason;
    }
    /* §451 — Bike Mode 라면 사유를 그것으로 덮어쓴다. 보정기는 '정지
       구간을 못 찾음(no-rest-window)' 이라고 보고하지만, 정지 구간이
       있었더라도 가로 G 가 없어 힐은 어차피 안 나온다. 사용자에게는
       "다음엔 Bike Mode 를 끄고 내보내라" 가 실제로 필요한 안내다. */
    if (parsed.bikeMode && !parsed.hasAttitude && parsed._fusion) {
      parsed._fusion.attitudeRejected = 'bike-mode';
    }
    return { parsed: parsed, fusion: parsed._fusion, points: pts };
  }

  function pickDonor(srcs, primary, pred) {
    var cand = srcs.filter(function (s) { return s !== primary && pred(s); });
    if (!cand.length) {
      /* primary 자신이 조건 충족하면 primary 사용 (단독 파일 케이스) */
      return pred(primary) ? primary : null;
    }
    /* 시간 겹침이 있는 것 우선, 그다음 포인트 많은 것 */
    cand.sort(function (a, b) { return b.pointCount - a.pointCount; });
    return cand[0];
  }

  function buildFusion(srcs, primary, imuInfo, hrInfo, speedInfo, sf, finalCount, withHeel, withHR) {
    return {
      primary: {
        source: primary.source, creator: primary.creator,
        sampleRateHz: Math.round(primary.sampleRateHz * 10) / 10,
        pointCount: primary.pointCount, fileName: primary.fileName
      },
      imu: imuInfo,
      hr: hrInfo,
      speed: speedInfo,
      spikes: {
        removed: sf.removed,
        rate: primary.pointCount ? sf.removed / primary.pointCount : 0
      },
      finalPointCount: finalCount,
      heelCoverage: finalCount ? withHeel / finalCount : 0,
      hrCoverage: finalCount ? withHR / finalCount : 0,
      sources: srcs.map(function (s) {
        return {
          source: s.source, creator: s.creator, fileName: s.fileName,
          sampleRateHz: Math.round(s.sampleRateHz * 10) / 10,
          pointCount: s.pointCount,
          role: s === primary ? 'primary' : 'donor'
        };
      })
    };
  }

  /* ---------- 공개 진입점 ---------- */
  /* files = [{ name, text }].  반환 { parsed, fusion, sources, warnings } */
  function mergeFiles(files, opts) {
    opts = opts || {};
    resolveDeps();
    var srcs = [], warnings = [];
    files.forEach(function (f) {
      try { srcs.push(parseOne(f, opts)); }
      catch (e) { warnings.push({ file: f.name, error: (e && e.message) || String(e) }); }
    });
    if (!srcs.length) {
      var msg = warnings.length ? warnings[0].error : '분석 가능한 파일이 없습니다.';
      throw new Error(msg);
    }
    var res = merge(srcs);
    res.warnings = warnings;
    res.sourceCount = srcs.length;
    return res;
  }

  var M = {
    detectFormat: detectFormat,
    parseOne: parseOne,
    wrapParsed: wrapParsed,
    parseTCX: parseTCX,
    pickPrimary: pickPrimary,
    filterSpikes: filterSpikes,
    interp: interp, makeChannel: makeChannel,
    merge: merge,
    mergeFiles: mergeFiles,
    setDeps: setDeps,
    _haversine: haversine
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else global.RDSessionMerger = M;
})(typeof window !== 'undefined' ? window : globalThis);
