/* ============================================================
 * geo.js — 지오·수학 유틸 (라이딩 통계 대시보드 Phase 1)
 * 순수 함수만. 브라우저 + Node 양쪽에서 동작 (UMD 패턴).
 * 거리=미터, 각도=도(0~360), 속도 내부 단위=m/s.
 * ============================================================ */
(function (global) {
  'use strict';

  var R_EARTH = 6371000;              // 지구 평균 반지름 (m)
  var MS_TO_KNOTS = 1.9438444924406;  // m/s -> 노트
  var MS_TO_KMH = 3.6;                // m/s -> km/h
  var NM_IN_M = 1852;                 // 1 해리(nautical mile)

  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }

  /* 두 {lat,lng} 지점 사이 대권거리 (Haversine), 미터 */
  function haversine(a, b) {
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var la1 = toRad(a.lat), la2 = toRad(b.lat);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /* a -> b 초기 방위각 (도, 0~360. 0=북, 90=동) */
  function bearing(a, b) {
    var la1 = toRad(a.lat), la2 = toRad(b.lat);
    var dLng = toRad(b.lng - a.lng);
    var y = Math.sin(dLng) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) -
            Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  /* 부호 있는 최소 각도차 (target - ref), (-180, 180] */
  function angleDiff(ref, target) {
    var d = (target - ref) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  }
  /* 절대 최소 각도차 [0, 180] */
  function absAngleDiff(a, b) { return Math.abs(angleDiff(a, b)); }

  /* 각도(도) 배열의 원형 평균. weights 선택. */
  function circularMean(angles, weights) {
    var sx = 0, sy = 0;
    for (var i = 0; i < angles.length; i++) {
      if (angles[i] == null) continue;
      var w = weights ? weights[i] : 1;
      sx += w * Math.cos(toRad(angles[i]));
      sy += w * Math.sin(toRad(angles[i]));
    }
    if (sx === 0 && sy === 0) return 0;
    return (toDeg(Math.atan2(sy, sx)) + 360) % 360;
  }

  /* 두 지점 선형 보간 (lat/lng/ele), frac 0~1 */
  function lerpPoint(p1, p2, frac) {
    var ele = null;
    if (p1.ele != null && p2.ele != null) ele = p1.ele + (p2.ele - p1.ele) * frac;
    else if (p1.ele != null) ele = p1.ele;
    else if (p2.ele != null) ele = p2.ele;
    return {
      lat: p1.lat + (p2.lat - p1.lat) * frac,
      lng: p1.lng + (p2.lng - p1.lng) * frac,
      ele: ele
    };
  }

  /* 시작점에서 방위각·거리로 도착점 계산 (샘플 생성용) */
  function destination(lat, lng, brngDeg, distM) {
    var d = distM / R_EARTH;
    var brng = toRad(brngDeg);
    var la1 = toRad(lat), lo1 = toRad(lng);
    var la2 = Math.asin(Math.sin(la1) * Math.cos(d) +
                        Math.cos(la1) * Math.sin(d) * Math.cos(brng));
    var lo2 = lo1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(la1),
                               Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return { lat: toDeg(la2), lng: toDeg(lo2) };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* 정렬된 배열의 백분위수 (선형 보간) */
  function percentile(sortedArr, p) {
    if (!sortedArr.length) return 0;
    var idx = clamp((p / 100) * (sortedArr.length - 1), 0, sortedArr.length - 1);
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sortedArr[lo];
    return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
  }

  var Geo = {
    R_EARTH: R_EARTH, MS_TO_KNOTS: MS_TO_KNOTS, MS_TO_KMH: MS_TO_KMH, NM_IN_M: NM_IN_M,
    toRad: toRad, toDeg: toDeg,
    haversine: haversine, bearing: bearing,
    angleDiff: angleDiff, absAngleDiff: absAngleDiff, circularMean: circularMean,
    lerpPoint: lerpPoint, destination: destination,
    clamp: clamp, percentile: percentile
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Geo;
  else global.RDGeo = Geo;
})(typeof window !== 'undefined' ? window : globalThis);
