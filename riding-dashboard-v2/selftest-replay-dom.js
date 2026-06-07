/* ============================================================
 * selftest-replay-dom.js — 라이딩 리플레이 뷰어 DOM 통합 self-test
 *                          (Video Viewer 재설계판)
 *
 * 경량 DOM 스텁 위에서 replay.js 의 실제 DOM 코드 경로를 그대로
 * 실행한다 — open() → 오버레이·칩·라이더 카드·미니그래프·스크러버·
 * 트랙 스트립 구성, 재생/정지, 스크럽, 지표 토글, 레이아웃 토글,
 * 영상 업로드·동기화 패널·오프셋 정렬, 트랙 줌, 나가기 버튼, close().
 * 브라우저 없이 DOM 배선 버그(요소 누락·핸들러 오류)를 잡는다.
 * 지도(Leaflet)는 미정의이므로 리플레이는 지도 없이도 정상 동작한다.
 *
 *   실행:  node selftest-replay-dom.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var DIR = __dirname;

/* ===================== 경량 DOM ===================== */
var idRegistry = {};

function El(tag) {
  this.tagName = String(tag).toLowerCase();
  this.id = '';
  this.className = '';
  this.children = [];
  this.childNodes = [];
  this.parentNode = null;
  this.style = {};
  this.attributes = {};
  this.dataset = {};
  this._hidden = false;
  this._listeners = {};
  this.textContent = '';
  this.value = '';
  this.files = null;
  this.disabled = false;
  this.width = 0; this.height = 0;
  this.clientWidth = 300; this.clientHeight = 80;
  var self = this;
  this.classList = {
    add: function (c) { if (!self._classes().includes(c)) self.className = (self.className + ' ' + c).trim(); },
    remove: function (c) { self.className = self._classes().filter(function (x) { return x !== c; }).join(' '); },
    toggle: function (c, on) {
      var has = self._classes().includes(c);
      if (on === undefined) on = !has;
      if (on) self.classList.add(c); else self.classList.remove(c);
      return on;
    },
    contains: function (c) { return self._classes().includes(c); }
  };
  if (this.tagName === 'video') {
    this.paused = true; this.currentTime = 0; this.duration = 0; this.playbackRate = 1;
  }
}
El.prototype._classes = function () {
  return String(this.className || '').split(/\s+/).filter(Boolean);
};
Object.defineProperty(El.prototype, 'hidden', {
  get: function () { return this._hidden; },
  set: function (v) { this._hidden = !!v; }
});
El.prototype.appendChild = function (c) {
  c.parentNode = this; this.children.push(c); this.childNodes.push(c);
  if (c.id) idRegistry[c.id] = c;
  return c;
};
El.prototype.removeChild = function (c) {
  this.children = this.children.filter(function (x) { return x !== c; });
  this.childNodes = this.childNodes.filter(function (x) { return x !== c; });
  c.parentNode = null;
  return c;
};
El.prototype.setAttribute = function (k, v) {
  this.attributes[k] = String(v);
  if (k === 'id') { this.id = String(v); idRegistry[this.id] = this; }
  if (k.indexOf('data-') === 0) this.dataset[k.slice(5).replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); })] = String(v);
};
El.prototype.getAttribute = function (k) {
  return (k in this.attributes) ? this.attributes[k] : null;
};
El.prototype.removeAttribute = function (k) { delete this.attributes[k]; if (k === 'src') this.src = ''; };
El.prototype.addEventListener = function (t, fn) {
  (this._listeners[t] = this._listeners[t] || []).push(fn);
};
El.prototype.removeEventListener = function (t, fn) {
  if (this._listeners[t]) this._listeners[t] = this._listeners[t].filter(function (f) { return f !== fn; });
};
El.prototype.getContext = function () { return makeCtx(); };
El.prototype.getBoundingClientRect = function () {
  return { left: 0, top: 0, width: this.clientWidth || 300,
           height: this.clientHeight || 80,
           right: this.clientWidth || 300, bottom: this.clientHeight || 80 };
};
El.prototype.setPointerCapture = function () {};
El.prototype.releasePointerCapture = function () {};
El.prototype.focus = function () {};
El.prototype.load = function () {};
El.prototype.play = function () { this.paused = false; return Promise.resolve(); };
El.prototype.pause = function () { this.paused = true; };
El.prototype.matchesSel = function (sel) {
  if (sel[0] === '#') return this.id === sel.slice(1);
  if (sel[0] === '.') return this.classList.contains(sel.slice(1));
  return this.tagName === sel.toLowerCase();
};
El.prototype.querySelector = function (sel) {
  var found = null;
  (function walk(node) {
    for (var i = 0; i < node.children.length && !found; i++) {
      if (node.children[i].matchesSel(sel)) { found = node.children[i]; return; }
      walk(node.children[i]);
    }
  })(this);
  return found;
};
El.prototype.querySelectorAll = function (sel) {
  var out = [];
  (function walk(node) {
    node.children.forEach(function (c) {
      if (c.matchesSel(sel)) out.push(c);
      walk(c);
    });
  })(this);
  return out;
};
El.prototype.closest = function (sel) {
  var n = this;
  while (n) { if (n.matchesSel && n.matchesSel(sel)) return n; n = n.parentNode; }
  return null;
};
El.prototype._fire = function (type, extra) {
  var evt = { type: type, target: this, preventDefault: function () {}, shiftKey: false };
  if (extra) for (var k in extra) evt[k] = extra[k];
  var n = this;
  while (n) {
    evt.currentTarget = n;
    var on = n['on' + type];
    if (typeof on === 'function') on.call(n, evt);
    if (n._listeners && n._listeners[type]) {
      n._listeners[type].slice().forEach(function (fn) { fn.call(n, evt); });
    }
    n = n.parentNode;
  }
};
Object.defineProperty(El.prototype, 'innerHTML', {
  get: function () { return ''; },
  set: function (html) {
    this.children = []; this.childNodes = [];
    if (!html) return;
    var nodes = parseHTML(String(html));
    var self = this;
    nodes.forEach(function (n) { self.appendChild(n); });
  }
});

function makeCtx() {
  var ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
    textBaseline: '', lineJoin: '', lineCap: '', globalAlpha: 1
  };
  ['scale', 'fillRect', 'strokeRect', 'fillText', 'beginPath', 'moveTo', 'lineTo',
   'stroke', 'closePath', 'fill', 'arc', 'arcTo', 'setLineDash', 'drawImage',
   'clearRect', 'setTransform', 'save', 'restore', 'rect',
   'quadraticCurveTo'].forEach(function (m) {
    ctx[m] = function () {};
  });
  ctx.measureText = function (s) { return { width: String(s).length * 6 }; };
  return ctx;
}

/* --- 아주 작은 HTML 파서 (replay.js 템플릿 부분집합 전용) --- */
function parseHTML(html) {
  var root = new El('#frag');
  var stack = [root];
  var re = /<\/([a-zA-Z][\w-]*)>|<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)(\/?)>|([^<]+)/g;
  var m;
  var VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
  while ((m = re.exec(html))) {
    var top = stack[stack.length - 1];
    if (m[5] != null) {
      top.textContent = (top.textContent || '') + m[5];
      continue;
    }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    var tag = m[2].toLowerCase();
    var node = new El(tag);
    parseAttrs(node, m[3] || '');
    top.appendChild(node);
    if (!m[4] && !VOID[tag]) stack.push(node);
  }
  return root.children.slice();
}
function parseAttrs(node, str) {
  var re = /([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'))?/g;
  var m;
  while ((m = re.exec(str))) {
    var name = m[1];
    var val = (m[3] != null) ? m[3] : (m[4] != null ? m[4] : '');
    node.setAttribute(name, val);
    if (name === 'class') node.className = val;
    if (name === 'hidden') node._hidden = true;
    /* 실제 브라우저처럼 value 속성을 프로퍼티에 반영(초기값) */
    if (name === 'value') node.value = val;
  }
}

/* --- document / window 스텁 --- */
var rafQueue = [];
var bodyEl = new El('body');
var docEl = {
  body: bodyEl,
  activeElement: null,
  createElement: function (t) { return new El(t); },
  getElementById: function (id) {
    var e = idRegistry[id];
    return (e && isAttached(e)) ? e : (idRegistry[id] || null);
  },
  _listeners: {},
  addEventListener: function (t, fn) { (docEl._listeners[t] = docEl._listeners[t] || []).push(fn); },
  removeEventListener: function (t, fn) {
    if (docEl._listeners[t]) docEl._listeners[t] = docEl._listeners[t].filter(function (f) { return f !== fn; });
  },
  _fire: function (t, extra) {
    var evt = { type: t, preventDefault: function () {}, shiftKey: false };
    if (extra) for (var k in extra) evt[k] = extra[k];
    (docEl._listeners[t] || []).slice().forEach(function (fn) { fn(evt); });
  }
};
function isAttached(e) { while (e) { if (e === bodyEl) return true; e = e.parentNode; } return false; }

global.document = docEl;
global.requestAnimationFrame = function (cb) { rafQueue.push(cb); return rafQueue.length; };
global.cancelAnimationFrame = function () {};
global.devicePixelRatio = 2;
global.innerWidth = 1280; global.innerHeight = 720;
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.alert = function () {};
if (!global.URL) global.URL = {};
global.URL.createObjectURL = function () { return 'blob:domtest'; };
global.URL.revokeObjectURL = function () {};

var lsData = {};
global.localStorage = {
  getItem: function (k) { return (k in lsData) ? lsData[k] : null; },
  setItem: function (k, v) { lsData[k] = String(v); },
  removeItem: function (k) { delete lsData[k]; }
};

/* ===================== 모듈 로드 ===================== */
var Geo = require(path.join(DIR, 'js', 'geo.js'));
global.RDGeo = Geo;
var An = require(path.join(DIR, 'js', 'analysis.js'));
global.RDAnalysis = An;
global.RDStorage = require(path.join(DIR, 'js', 'storage.js'));
var RDReplay = require(path.join(DIR, 'js', 'replay.js'));

/* --- 경량 GPX 파서 (HR 포함) --- */
function parseGPX(xml) {
  var pts = [];
  var re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  var m;
  while ((m = re.exec(xml))) {
    var inner = m[3];
    var tM = inner.match(/<time>([^<]+)<\/time>/);
    var sM = inner.match(/<speed>([^<]+)<\/speed>/);
    var hM = inner.match(/<(?:\w+:)?hr>\s*([\d.]+)\s*<\/(?:\w+:)?hr>/);
    pts.push({
      lat: parseFloat(m[1]), lng: parseFloat(m[2]), ele: null,
      time: tM ? Date.parse(tM[1]) : null,
      speed: sM ? parseFloat(sM[1]) : null,
      hr: hM ? Math.round(parseFloat(hM[1])) : null
    });
  }
  var wt = pts.filter(function (p) { return p.time != null; }).length;
  var ws = pts.filter(function (p) { return p.speed != null; }).length;
  var wh = pts.filter(function (p) { return p.hr != null; }).length;
  return {
    tracks: [{ name: 'domtest', segments: [pts] }], pointCount: pts.length,
    trackName: 'domtest', hasTime: wt >= pts.length * 0.5,
    speedSource: ws >= pts.length * 0.5 ? 'device' : 'derived',
    hasHR: wh >= pts.length * 0.5, hrPointCount: wh
  };
}

/* ===================== 테스트 러너 ===================== */
var pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  — ' + extra : '')); }
}
function $(id) { return docEl.getElementById(id); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function collectText(node) {
  var out = [];
  (function walk(n) {
    if (n.textContent) out.push(n.textContent);
    n.children.forEach(walk);
  })(node);
  return out;
}

(async function run() {
  console.log('=== 라이딩 리플레이 뷰어 DOM 통합 self-test (재설계판) ===\n');

  var xml = fs.readFileSync(path.join(DIR, 'sample', 'sample-songjeong-busan.gpx'), 'utf8');
  var session = An.normalizeSession(parseGPX(xml));
  var analysis = An.analyzeSession(session, 200, {});

  /* ---------- 1) open() — 오버레이 구성 ---------- */
  console.log('[1] open() — 오버레이·배경·트랜스포트·트랙 구성');
  var ok = RDReplay.open({
    session: session, analysis: analysis, windDir: 200,
    unit: 'kt', sessionSig: 'domtest-sig', title: '송정 리플레이',
    riderName: 'Danny O'
  });
  check('open() 이 true 를 반환(시각 세션)', ok === true);
  check('#replay-view 오버레이가 body 에 추가됨', !!$('replay-view'));
  check('오버레이가 표시 상태(hidden=false)', $('replay-view') && $('replay-view').hidden === false);
  check('배경 영상 블러 캔버스(#replay-blur) 존재', !!$('replay-blur'));
  check('영상 전 — 지도 레이아웃으로 시작(replay--map)',
    $('replay-view').classList.contains('replay--map') &&
    !$('replay-view').classList.contains('replay--video'));
  check('재생/정지/스크러버/시계 모두 존재',
    !!$('replay-play') && !!$('replay-stop') && !!$('replay-scrub') && !!$('replay-clock'));
  check('나가기 — 좌상단 ‹ 버튼과 우상단 ✕ 버튼 모두 존재',
    !!$('replay-exit') && !!$('replay-close-x'));
  check('하단 메인 트랙 스트립 캔버스 존재', !!$('replay-track'));
  check('재생 속도 버튼 5개(0.5~8x)', $('replay-speed') && $('replay-speed').children.length === 5);
  check('1x 속도가 기본 활성', (function () {
    var b = $('replay-speed').children.filter(function (x) { return x.getAttribute('data-s') === '1'; })[0];
    return b && b.classList.contains('is-active');
  })());

  /* ---------- 2) 칩·라이더 카드·미니그래프 — HR 포함 ---------- */
  console.log('\n[2] 지표 칩 · 라이더 카드 · 미니그래프 — HR 포함');
  check('지표 토글 칩 4개(SOG·VMG·TWA·HR — GPX 는 Heel·Pitch 없음)',
    $('replay-chips').children.length === 4, '개수=' + $('replay-chips').children.length);
  check('칩이 모두 켜진 상태로 시작', $('replay-chips').children.every(function (c) {
    return c.classList.contains('is-on');
  }));
  check('HR 칩이 존재', $('replay-chips').children.some(function (c) {
    return c.getAttribute('data-metric') === 'hr';
  }));
  var graphs = $('replay-graphs').children;
  check('미니그래프 4종 생성(SOG·VMG·TWA·HR)', graphs.length === 4,
    '개수=' + graphs.length);
  var rider = $('replay-rider');
  check('좌상단 라이더 카드 표시', rider && rider.hidden === false);
  check('라이더 카드에 이름(Danny O) 표시',
    collectText(rider).join(' ').indexOf('Danny O') >= 0);
  check('라이더 카드에 HR 지표 행 존재', !!$('rider-num-hr'));

  await sleep(160);   // open() 의 relayout setTimeout(80ms) 완료 대기
  check('레이아웃 후 미니그래프 캔버스에 크기 부여(width>0)',
    graphs[0].querySelector('canvas').width > 0);
  check('레이아웃 후 트랙 캔버스에 크기 부여(width>0)',
    $('replay-track').width > 0);

  /* ---------- 3) 시킹 — 스크러버·시계·라이더·트랙 ---------- */
  console.log('\n[3] 시킹 — 스크러버·시계·라이더 카드 동기');
  var scrub = $('replay-scrub');
  scrub.value = '500';
  scrub._fire('input');
  check('스크러버 입력 → 시계가 중간 지점으로 갱신',
    $('replay-clock').textContent !== '0:00 / 0:00',
    '시계=' + $('replay-clock').textContent);
  check('라이더 카드 SOG 값이 갱신됨(— 아님)',
    $('rider-num-sog') && $('rider-num-sog').textContent !== '—',
    'SOG=' + ($('rider-num-sog') && $('rider-num-sog').textContent));
  check('미니그래프 헤더 현재값 갱신됨',
    graphs[0].querySelector('.replay-graph__val').textContent !== '—');

  /* ---------- 4) 재생 / 정지 ---------- */
  console.log('\n[4] 재생 엔진 — 재생 / rAF 진행 / 정지');
  scrub.value = '0'; scrub._fire('input');
  $('replay-play')._fire('click');
  check('재생 버튼 → 일시정지 아이콘(⏸)', $('replay-play').textContent === '⏸');
  var ts = 1000;
  for (var f = 0; f < 6 && rafQueue.length; f++) {
    var cb = rafQueue.shift(); ts += 400; cb(ts);
  }
  check('rAF 진행 → 재생 위치가 0:00 에서 전진',
    $('replay-clock').textContent.indexOf('0:00 /') !== 0,
    '시계=' + $('replay-clock').textContent);
  $('replay-stop')._fire('click');
  check('정지 → 재생 아이콘(▶) 복귀', $('replay-play').textContent === '▶');
  check('정지 → 재생 위치 0:00 복귀',
    $('replay-clock').textContent.indexOf('0:00 /') === 0);

  /* ---------- 5) 지표 토글 칩 ---------- */
  console.log('\n[5] 지표 토글 칩 — 미니그래프 표시/숨김');
  var hrChip = $('replay-chips').children.filter(function (c) {
    return c.getAttribute('data-metric') === 'hr';
  })[0];
  hrChip._fire('click');
  check('HR 칩 해제 → 칩 off', !hrChip.classList.contains('is-on'));
  var hrCard = graphs.filter(function (g) {
    var lbl = g.querySelector('.replay-graph__label');
    return lbl && lbl.textContent === 'HR';
  })[0];
  check('HR 칩 해제 → HR 미니그래프 카드 숨김', hrCard && hrCard.hidden === true);
  hrChip._fire('click');
  check('HR 칩 재선택 → 카드 다시 표시', hrCard && hrCard.hidden === false);

  /* ---------- 6) 레이아웃 토글 ---------- */
  console.log('\n[6] 레이아웃 토글 — 영상/지도/나란히');
  var layVideo = $('replay-layout').children.filter(function (b) {
    return b.getAttribute('data-lay') === 'video';
  })[0];
  check('영상 없을 때 — 영상 레이아웃 버튼 비활성', layVideo.disabled === true);
  var layMap = $('replay-layout').children.filter(function (b) {
    return b.getAttribute('data-lay') === 'map';
  })[0];
  check('지도 레이아웃 버튼은 활성·선택 상태',
    layMap.disabled === false && layMap.classList.contains('is-on'));

  /* ---------- 7) 트랙 줌 + 지도연동 토글 ---------- */
  console.log('\n[7] 하단 트랙 — 줌 + 지도연동 토글');
  check('트랙 범위 라벨 기본 "Full"', $('replay-tspan').textContent === 'Full');
  $('replay-zoomin')._fire('click');
  check('트랙 확대 → 범위 라벨이 "Full" 아님',
    $('replay-tspan').textContent !== 'Full', '라벨=' + $('replay-tspan').textContent);
  $('replay-zoomout')._fire('click');
  $('replay-zoomout')._fire('click');
  check('트랙 축소 반복 → 다시 전체 범위',
    $('replay-tspan').textContent === 'Full');
  var link = $('replay-link');
  check('지도 연동 토글 기본 켜짐', link.classList.contains('is-on'));
  link._fire('click');
  check('지도 연동 토글 해제 가능', !link.classList.contains('is-on'));
  link._fire('click');

  /* 트랙 클릭 → 그 시각으로 시킹 */
  var track = $('replay-track');
  track._fire('pointerdown', { clientX: 150, pointerId: 1 });
  check('트랙 클릭 → 재생 위치 이동',
    $('replay-clock').textContent.indexOf('0:00 /') !== 0,
    '시계=' + $('replay-clock').textContent);
  track._fire('pointerup', { clientX: 150, pointerId: 1 });

  /* ---------- 8) 다중 영상 클립 — 업로드 → 자동 배치 → 동기화 ---------- */
  console.log('\n[8] 영상 클립 — 다중 업로드 → 영상 레이아웃 → 클립별 동기화');
  var input = $('replay-video-input');
  check('업로드 전: 영상 업로드 입력 존재', !!input);
  check('업로드 입력이 다중 선택 허용(multiple)',
    input.getAttribute('multiple') != null);
  input.files = [{ name: 'clip-A.mp4' }];
  input._fire('change', { target: input });
  var video = $('replay-video');
  check('영상 파일 선택 → <video> src 설정(object URL)',
    video && /blob:/.test(video.src || ''));
  video.duration = 14; video.paused = true;
  if (typeof video.onloadedmetadata === 'function') video.onloadedmetadata();
  check('메타데이터 로드 → 영상 레이아웃 전환(replay--video)',
    $('replay-view').classList.contains('replay--video'));
  check('영상 로드 후 — 영상/나란히 레이아웃 버튼 활성', layVideo.disabled === false);

  $('replay-sync-btn')._fire('click');     // 동기화 패널 열기
  check('동기화 패널이 열린다', $('replay-sync').hidden === false);
  var syncText = collectText($('replay-sync')).join(' ');
  check('데이터 시작 시각이 패널에 표시', syncText.indexOf('Data start') >= 0);
  check('녹화 시각 정보 없는 클립 → 정직하게 "No recording time info" 표기',
    syncText.indexOf('No recording time info') >= 0, syncText);
  check('자동정렬 불가 클립 → 수동 정렬 안내', syncText.indexOf('manual alignment') >= 0);
  var cnums = $('replay-sync').querySelectorAll('.replay-sync__cnum');
  check('클립별 배치 미세조정 입력 존재', cnums.length === 1, 'n=' + cnums.length);

  var nudgePlus1 = $('replay-sync').querySelectorAll('.replay__nudge').filter(function (b) {
    return b.getAttribute('data-d') === '1' && b.getAttribute('data-clip');
  })[0];
  check('클립 미세조정 +1초 버튼 존재', !!nudgePlus1);
  nudgePlus1._fire('click');
  var cnumA = $('replay-sync').querySelectorAll('.replay-sync__cnum')[0];
  check('+1초 미세조정 → 클립 시작 1.0초',
    parseFloat(cnumA.value) === 1, 'val=' + cnumA.value);
  await sleep(480);
  var saved = global.RDStorage.loadVideoSync('domtest-sig');
  check('클립 수동 배치가 세션 시그니처별로 저장됨',
    saved && saved.clips && saved.clips['clip-A.mp4'] === 1,
    'saved=' + JSON.stringify(saved));

  /* C1 — 클립 시작 시각 HH:MM:SS 직접 입력 필드 */
  var ctimeInp = $('replay-sync').querySelectorAll('.replay-sync__ctime')[0];
  check('클립 시작 시각 HH:MM:SS 입력 필드 존재(§C1)', !!ctimeInp);
  check('시작 시각 필드가 HH:MM:SS 형식',
    ctimeInp && /^\d{1,2}:\d{2}:\d{2}$/.test(ctimeInp.value),
    ctimeInp && ctimeInp.value);

  /* C2 — 하단 트랙 클립 블록 드래그 이동 */
  scrub.value = '0'; scrub._fire('input');          // 재생 헤드를 트랙 앞으로
  for (var zi = 0; zi < 12; zi++) $('replay-zoomin')._fire('click');  // 최대 확대
  var beforeStart = parseFloat(
    $('replay-sync').querySelectorAll('.replay-sync__cnum')[0].value);
  track._fire('pointerdown', { clientX: 60, clientY: 6, pointerId: 9 });
  track._fire('pointermove', { clientX: 150, clientY: 6, pointerId: 9 });
  track._fire('pointerup', { clientX: 150, clientY: 6, pointerId: 9 });
  var afterStart = parseFloat(
    $('replay-sync').querySelectorAll('.replay-sync__cnum')[0].value);
  check('트랙에서 클립 블록을 드래그해 시작 시각 이동(§C2)',
    isFinite(afterStart) && afterStart !== beforeStart,
    'before=' + beforeStart + ' after=' + afterStart);

  /* 두 번째 클립을 따로 추가 — 다중 클립 */
  input.files = [{ name: 'clip-B.mp4' }];
  input._fire('change', { target: input });
  check('두 번째 클립 추가 → 패널에 클립 2개 표기',
    collectText($('replay-sync')).join(' ').indexOf('Video clips: 2') >= 0);
  check('두 번째 클립 추가 → 미세조정 입력 2개',
    $('replay-sync').querySelectorAll('.replay-sync__cnum').length === 2);

  /* 전체 영상 제거 → 지도 레이아웃 복귀 */
  $('replay-video-remove')._fire('click');
  check('전체 영상 제거 → 지도 레이아웃 복귀(replay--map)',
    $('replay-view').classList.contains('replay--map') &&
    !$('replay-view').classList.contains('replay--video'));
  check('전체 영상 제거 → 업로드 입력 다시 표시', !!$('replay-video-input'));

  /* ---------- 9) 닫기 — 정리 + onClose ---------- */
  console.log('\n[9] close() — 정리 및 onClose 콜백');
  var closed = false;
  RDReplay.open({
    session: session, analysis: analysis, windDir: 200, unit: 'kt',
    sessionSig: 'domtest-sig2', title: '닫기 검증',
    onClose: function () { closed = true; }
  });
  check('재오픈 시 isOpen()=true', RDReplay.isOpen() === true);
  RDReplay.close();
  check('close() → isOpen()=false', RDReplay.isOpen() === false);
  check('close() → onClose 콜백 호출', closed === true);
  check('close() → 오버레이 hidden 처리', $('replay-view') && $('replay-view').hidden === true);

  /* ---------- 10) open/close 반복 안정성 ---------- */
  console.log('\n[10] 회귀 — open/close 반복 안정성');
  var stable = true;
  try {
    for (var r = 0; r < 3; r++) {
      RDReplay.open({ session: session, analysis: analysis, windDir: 200,
        unit: 'kt', sessionSig: 'rep' + r });
      RDReplay.close();
    }
  } catch (e) { stable = false; console.log('      예외: ' + (e && e.stack ? e.stack : e)); }
  check('open/close 3회 반복에도 예외 없음', stable === true);

  /* ---------- 11) 풍향 미설정 — VMG·TWA 안내 슬롯 ---------- */
  console.log('\n[11] 풍향 미설정 — VMG·TWA 가 사라지지 않고 안내 슬롯으로');
  var nwSession = An.normalizeSession(parseGPX(xml));
  var nwAnalysis = An.analyzeSession(nwSession, null, {});
  RDReplay.open({
    session: nwSession, analysis: nwAnalysis, windDir: null,
    unit: 'kt', sessionSig: 'nowind-sig', title: '풍향 미설정 검증'
  });
  var nwGraphs = $('replay-graphs').children;
  check('풍향 미설정에도 미니그래프 슬롯 4개(SOG·VMG·TWA·HR)',
    nwGraphs.length === 4, '개수=' + nwGraphs.length);
  var nwCards = nwGraphs.filter(function (c) {
    return c.classList.contains('replay-graph--nowind');
  });
  check('VMG·TWA 가 needwind 안내 카드로 남는다', nwCards.length === 2,
    '안내카드=' + nwCards.length);
  check('needwind 카드에 풍향 설정 안내문 있음',
    nwCards.length === 2 && nwCards.every(function (c) {
      return !!c.querySelector('.replay-graph__note');
    }));
  check('HR 칩은 정상(nowind 아님)',
    $('replay-chips').children.filter(function (c) {
      return c.getAttribute('data-metric') === 'hr';
    }).length === 1 &&
    !$('replay-chips').children.filter(function (c) {
      return c.getAttribute('data-metric') === 'hr';
    })[0].classList.contains('replay__chip--nowind'));
  RDReplay.close();

  console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) {
  console.error('\n테스트 하니스 예외: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
