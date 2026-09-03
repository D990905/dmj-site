/* ============================================================
 * export.js — §525 W13 내보내기 (Waterspeed 벤치마킹)
 *
 * 그들은 여덟 갈래로 내보낸다: Health · CSV/Excel · GPX · Strava ·
 * GPS-Speedsurfing · 공유 링크 · 이미지 · iPad.
 * 우리는 PDF 하나뿐이었다.
 *
 * 여기서는 **서버 없이 되는 것만** 한다 — CSV · GPX · 이미지.
 * Strava·Health 는 OAuth 라 서버가 있어야 하고(웨어러블과 같은 벽),
 * 공유 링크는 Supabase(§415)가 붙어야 한다.
 *
 * ⚠ 브라우저 다운로드는 순수 함수로 만들 수 없다. 그래서 **문자열을
 * 만드는 부분과 내려받는 부분을 분리**한다 — 앞의 것만 테스트한다.
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* 파일 이름 — 세션 이름을 그대로 쓰면 경로 구분자·따옴표가 섞인다 */
  function safeName(name, ext) {
    var base = String(name || 'session')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '_')
      .replace(/^[.\-_]+|[.\-_]+$/g, '')
      .slice(0, 80);
    return (base || 'session') + '.' + ext;
  }

  function csvCell(v) {
    if (v == null) return '';
    var s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* ---- CSV — 표본 한 줄씩 ----
     단위를 **열 이름에 박는다**. "speed" 만 쓰면 m/s 인지 kt 인지 몰라
     받는 쪽에서 또 틀린다(§516 이 그 종류의 사고였다). */
  function toCsv(session, analysis) {
    var S = (session && session.samples) || [];
    var t0 = session && session.startEpoch;
    var wd = analysis && analysis.windDir;
    var head = ['time_iso', 'elapsed_s', 'lat', 'lon', 'speed_kt',
                'heading_deg', 'hr_bpm'];
    if (wd != null) head.push('twa_deg', 'vmg_kt');
    var rows = [head.join(',')];
    for (var i = 0; i < S.length; i++) {
      var p = S[i];
      var iso = (t0 != null && isFinite(t0))
        ? new Date(t0 + p.t * 1000).toISOString() : '';
      var r = [
        iso,
        p.t == null ? '' : p.t.toFixed(1),
        p.lat == null ? '' : p.lat.toFixed(6),
        p.lng == null ? '' : p.lng.toFixed(6),
        p.speed == null ? '' : (p.speed * KT).toFixed(2),
        p.heading == null ? '' : Math.round(p.heading),
        p.hr == null ? '' : Math.round(p.hr)
      ];
      if (wd != null) {
        if (p.heading == null || p.speed == null) { r.push('', ''); }
        else {
          var d = Math.abs(((p.heading - wd + 540) % 360) - 180);
          r.push(d.toFixed(1),
                 (p.speed * KT * Math.cos(d * Math.PI / 180)).toFixed(2));
        }
      }
      rows.push(r.map(csvCell).join(','));
    }
    return rows.join('\n') + '\n';
  }

  /* ---- GPX — 다른 도구로 가져갈 수 있게 ----
     시각이 없으면 <time> 을 아예 안 쓴다. 가짜 시각을 넣으면 받는 쪽이
     속도를 계산해 버려서, 없는 데이터가 있는 것처럼 퍼진다. */
  function xmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function toGpx(session, name) {
    var S = (session && session.samples) || [];
    var t0 = session && session.startEpoch;
    var hasTime = (t0 != null && isFinite(t0) && session.hasTime !== false);
    var out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push('<gpx version="1.1" creator="DMJ Riding Dashboard" '
      + 'xmlns="http://www.topografix.com/GPX/1/1" '
      + 'xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">');
    out.push('  <trk><name>' + xmlEsc(name || 'Session') + '</name><trkseg>');
    for (var i = 0; i < S.length; i++) {
      var p = S[i];
      if (p.lat == null || p.lng == null) continue;
      var line = '    <trkpt lat="' + p.lat.toFixed(7) + '" lon="' + p.lng.toFixed(7) + '">';
      if (p.ele != null) line += '<ele>' + p.ele.toFixed(1) + '</ele>';
      if (hasTime) line += '<time>' + new Date(t0 + p.t * 1000).toISOString() + '</time>';
      if (p.hr != null) {
        line += '<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>'
          + Math.round(p.hr) + '</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>';
      }
      line += '</trkpt>';
      out.push(line);
    }
    out.push('  </trkseg></trk>');
    out.push('</gpx>');
    return out.join('\n') + '\n';
  }

  /* ---- 내려받기 (부수효과) ---- */
  function download(text, filename, mime) {
    if (typeof document === 'undefined') return false;
    try {
      var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () {
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }, 0);
      return true;
    } catch (e) { return false; }
  }

  /* ---- 캔버스 → PNG ---- */
  function downloadCanvas(canvas, filename) {
    if (!canvas || !canvas.toDataURL) return false;
    try {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      return true;
    } catch (e) { return false; }
  }

  var API = { toCsv: toCsv, toGpx: toGpx, safeName: safeName,
              download: download, downloadCanvas: downloadCanvas,
              _test: { csvCell: csvCell, xmlEsc: xmlEsc, pad2: pad2 } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDExport = API;
})(typeof window !== 'undefined' ? window : globalThis);
