/* ============================================================
 * gpx-parser.js — GPX 1.0/1.1 파서 (라이딩 통계 대시보드 Phase 1)
 * DOMParser 로 XML 파싱. trkpt(lat/lon) + time + ele + extensions speed.
 * 다중 <trk>/<trkseg> 지원, <rte> fallback, 손상 파일 에러 핸들링.
 * 브라우저: parseGPX(xmlString). Node 테스트: parseGPX(xml, {DOMParser}).
 * ============================================================ */
(function (global) {
  'use strict';

  /* --- DOM 헬퍼 (네임스페이스 무관: localName 기준) --- */
  function localOf(el) {
    return el.localName || String(el.nodeName).replace(/^.*:/, '');
  }
  function textOf(el) { return el.textContent != null ? el.textContent : ''; }

  function firstChildByLocal(parent, name) {
    var c = parent.childNodes;
    for (var i = 0; i < c.length; i++) {
      if (c[i].nodeType === 1 && localOf(c[i]) === name) return c[i];
    }
    return null;
  }
  function childText(parent, name) {
    var el = firstChildByLocal(parent, name);
    return el ? textOf(el).trim() : null;
  }
  function findDescendantByLocal(parent, name) {
    var c = parent.childNodes;
    for (var i = 0; i < c.length; i++) {
      if (c[i].nodeType !== 1) continue;
      if (localOf(c[i]) === name) return c[i];
      var deep = findDescendantByLocal(c[i], name);
      if (deep) return deep;
    }
    return null;
  }

  /* extensions 안 어딘가의 <speed> (m/s). Garmin/그 외 앱 변종 대응 */
  function extractSpeed(trkpt) {
    var ext = firstChildByLocal(trkpt, 'extensions');
    if (!ext) return null;
    var sp = findDescendantByLocal(ext, 'speed');
    if (sp) {
      var v = parseFloat(textOf(sp));
      if (isFinite(v) && v >= 0 && v < 100) return v; // 합리적 범위(m/s)만 수용
    }
    return null;
  }

  /* extensions 안 어딘가의 <hr> (심박수, bpm).
     Garmin TrackPointExtension 의 심박 필드는 앱마다 네임스페이스
     접두사가 다르다 — Waterspeed 는 <ns3:hr>, Garmin Connect 는
     <gpxtpx:hr>, 일부는 접두사 없는 <hr>. localName 기준으로 찾으므로
     접두사와 무관하게 모두 잡는다. 심박 데이터는 전량 읽으며
     다운샘플·캡을 하지 않는다. 생리적으로 불가능한 값(20 bpm 미만·
     240 bpm 초과 — 센서 워밍업·접촉 불량 노이즈)은 결측(null)으로
     처리해 분석을 오염시키지 않는다. */
  function extractHR(trkpt) {
    var ext = firstChildByLocal(trkpt, 'extensions');
    if (!ext) return null;
    var hrEl = findDescendantByLocal(ext, 'hr');
    if (hrEl) {
      var v = parseFloat(textOf(hrEl));
      if (isFinite(v) && v >= 20 && v <= 240) return Math.round(v);
    }
    return null;
  }

  function parsePoints(nodeList) {
    var out = [];
    for (var i = 0; i < nodeList.length; i++) {
      var n = nodeList[i];
      var lat = parseFloat(n.getAttribute('lat'));
      var lng = parseFloat(n.getAttribute('lon'));
      if (!isFinite(lat) || !isFinite(lng)) continue;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

      var eleTxt = childText(n, 'ele');
      var ele = eleTxt != null ? parseFloat(eleTxt) : null;
      if (!isFinite(ele)) ele = null;

      var timeTxt = childText(n, 'time');
      var time = null;
      if (timeTxt) {
        var ms = Date.parse(timeTxt);
        if (isFinite(ms)) time = ms;
      }
      out.push({ lat: lat, lng: lng, ele: ele, time: time,
                 speed: extractSpeed(n), hr: extractHR(n) });
    }
    return out;
  }

  /* 이미 파싱된 XML Document 를 받아 구조화 (코어) */
  function parseDocument(doc) {
    if (!doc) throw new Error('GPX 파일을 읽을 수 없습니다.');

    // 브라우저 DOMParser 는 오류 시 <parsererror> 를 넣는다
    var perr = doc.getElementsByTagName('parsererror');
    if (perr && perr.length) {
      throw new Error('GPX 파일이 올바른 XML 형식이 아닙니다. 파일이 손상되었을 수 있습니다.');
    }
    var root = doc.documentElement;
    if (!root) throw new Error('GPX 파일이 비어 있거나 형식이 잘못되었습니다.');
    if (localOf(root) !== 'gpx') {
      throw new Error('GPX 파일이 아닙니다 (<gpx> 루트 요소를 찾을 수 없습니다).');
    }

    var tracks = [];
    var trks = doc.getElementsByTagName('trk');
    for (var t = 0; t < trks.length; t++) {
      var trk = trks[t];
      var name = childText(trk, 'name');
      var segs = trk.getElementsByTagName('trkseg');
      var segments = [];
      for (var s = 0; s < segs.length; s++) {
        var pts = parsePoints(segs[s].getElementsByTagName('trkpt'));
        if (pts.length) segments.push(pts);
      }
      if (segments.length) {
        tracks.push({ name: name || ('트랙 ' + (t + 1)), segments: segments });
      }
    }

    // 트랙이 없으면 <rte>/<rtept> 경로를 fallback 으로 사용
    if (!tracks.length) {
      var rtepts = doc.getElementsByTagName('rtept');
      if (rtepts.length) {
        var rp = parsePoints(rtepts);
        if (rp.length) tracks.push({ name: '경로(route)', segments: [rp] });
      }
    }
    if (!tracks.length) {
      throw new Error('트랙 포인트(<trkpt>)를 찾을 수 없습니다. 빈 트랙이거나 GPX 형식이 아닙니다.');
    }

    var total = 0, withTime = 0, withSpeed = 0, withHR = 0;
    var metaName = childText(root, 'name') || null;
    tracks.forEach(function (tr) {
      tr.segments.forEach(function (seg) {
        seg.forEach(function (p) {
          total++;
          if (p.time != null) withTime++;
          if (p.speed != null) withSpeed++;
          if (p.hr != null) withHR++;
        });
      });
    });
    if (total < 2) {
      throw new Error('트랙에 포인트가 너무 적습니다 (' + total + '개). 최소 2개가 필요합니다.');
    }

    return {
      tracks: tracks,
      pointCount: total,
      trackName: (tracks[0] && tracks[0].name) || metaName || '라이딩 세션',
      hasTime: withTime >= total * 0.5,            // 절반 이상이 시각을 가지면 시각 기반 분석 가능
      speedSource: withSpeed >= total * 0.5 ? 'device' : 'derived',
      /* 심박수(HR) 포함 여부 — 절반 이상의 포인트가 심박을 가지면 true.
         Waterspeed 등 일부 GPX 만 HR 을 담는다. .vkx 등 HR 이 없는
         파일은 false → 대시보드가 심박수 섹션을 숨긴다. */
      hasHR: withHR >= total * 0.5,
      hrPointCount: withHR
    };
  }

  /* 브라우저 진입점: XML 문자열을 받아 파싱 */
  function parseGPX(xmlString, opts) {
    opts = opts || {};
    if (typeof xmlString !== 'string' || !xmlString.trim()) {
      throw new Error('빈 파일이거나 내용을 읽을 수 없습니다.');
    }
    if (xmlString.indexOf('<gpx') === -1 && xmlString.indexOf('<trkpt') === -1) {
      throw new Error('GPX 파일이 아닌 것 같습니다 (<gpx> 태그가 없습니다).');
    }
    var DP = opts.DOMParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    if (!DP) throw new Error('이 환경에서는 XML 파서를 사용할 수 없습니다.');

    var doc;
    try {
      doc = new DP().parseFromString(xmlString, 'application/xml');
    } catch (e) {
      throw new Error('GPX 파일을 파싱하지 못했습니다: ' + (e && e.message ? e.message : e));
    }
    return parseDocument(doc);
  }

  var Gpx = { parseGPX: parseGPX, parseDocument: parseDocument };
  if (typeof module !== 'undefined' && module.exports) module.exports = Gpx;
  else global.RDGpx = Gpx;
})(typeof window !== 'undefined' ? window : globalThis);
