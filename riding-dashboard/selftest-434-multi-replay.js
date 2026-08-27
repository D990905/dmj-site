/* ============================================================
 * selftest-434-multi-replay.js — 두 트랙 고스트 오버레이 self-test
 *
 * replay.js 의 순수 정렬/보간 함수와 경량 DOM 위 open() 무고스트
 * 회귀 경로를 검증한다.
 *
 *   실행: node selftest-434-multi-replay.js
 *   통과: 종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';

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
  this.disabled = false;
  this.width = 0; this.height = 0;
  this.clientWidth = 300; this.clientHeight = 80;
  var self = this;
  this.classList = {
    add: function (c) {
      if (!self._classes().includes(c)) {
        self.className = (self.className + ' ' + c).trim();
      }
    },
    remove: function (c) {
      self.className = self._classes().filter(function (x) { return x !== c; }).join(' ');
    },
    toggle: function (c, on) {
      if (on === undefined) on = !self.classList.contains(c);
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
  if (k === 'class') this.className = String(v);
  if (k === 'value') this.value = String(v);
  if (k === 'hidden') this._hidden = true;
};
El.prototype.getAttribute = function (k) {
  return (k in this.attributes) ? this.attributes[k] : null;
};
El.prototype.removeAttribute = function (k) { delete this.attributes[k]; };
El.prototype.addEventListener = function (t, fn) {
  (this._listeners[t] = this._listeners[t] || []).push(fn);
};
El.prototype.removeEventListener = function (t, fn) {
  if (this._listeners[t]) {
    this._listeners[t] = this._listeners[t].filter(function (f) { return f !== fn; });
  }
};
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
El.prototype.getContext = function () {
  var ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
    textBaseline: '', lineJoin: '', lineCap: '', globalAlpha: 1
  };
  ['scale', 'fillRect', 'strokeRect', 'fillText', 'beginPath', 'moveTo', 'lineTo',
   'stroke', 'closePath', 'fill', 'arc', 'arcTo', 'setLineDash', 'drawImage',
   'clearRect', 'setTransform', 'save', 'restore', 'rect',
   'quadraticCurveTo'].forEach(function (m) { ctx[m] = function () {}; });
  ctx.measureText = function (s) { return { width: String(s).length * 6 }; };
  return ctx;
};
El.prototype.getBoundingClientRect = function () {
  return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight,
    right: this.clientWidth, bottom: this.clientHeight };
};
El.prototype.load = function () {};
El.prototype.play = function () { this.paused = false; return Promise.resolve(); };
El.prototype.pause = function () { this.paused = true; };

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

function parseHTML(html) {
  var root = new El('#frag');
  var stack = [root];
  var re = /<\/([a-zA-Z][\w-]*)>|<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)(\/?)>|([^<]+)/g;
  var m;
  var VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
  while ((m = re.exec(html))) {
    var top = stack[stack.length - 1];
    if (m[5] != null) { top.textContent += m[5]; continue; }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    var node = new El(m[2].toLowerCase());
    parseAttrs(node, m[3] || '');
    top.appendChild(node);
    if (!m[4] && !VOID[node.tagName]) stack.push(node);
  }
  return root.children.slice();
}
function parseAttrs(node, str) {
  var re = /([\w:-]+)(?:\s*=\s*("[^"]*"|'[^']*'))?/g;
  var m;
  while ((m = re.exec(str))) {
    var val = m[2] ? m[2].slice(1, -1) : '';
    node.setAttribute(m[1], val);
  }
}

var bodyEl = new El('body');
global.document = {
  body: bodyEl,
  createElement: function (tag) { return new El(tag); },
  getElementById: function (id) { return idRegistry[id] || null; },
  addEventListener: function () {},
  removeEventListener: function () {}
};
global.requestAnimationFrame = function () { return 1; };
global.cancelAnimationFrame = function () {};
global.devicePixelRatio = 1;
global.innerWidth = 1280; global.innerHeight = 720;
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.alert = function () {};
global.localStorage = {
  getItem: function () { return null; },
  setItem: function () {},
  removeItem: function () {}
};
if (!global.URL) global.URL = {};
global.URL.revokeObjectURL = function () {};

/* ===================== 테스트 러너 ===================== */
var RDReplay = require('./js/replay.js');
var T = RDReplay._test;
var pass = 0, fail = 0;

function check(label, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else {
    fail++;
    console.log('  FAIL  ' + label + (extra ? '  — ' + extra : ''));
  }
}
function near(a, b) { return Math.abs(a - b) < 1e-9; }
function session(t0, t1, a, b) {
  return {
    hasTime: true,
    trackName: 'track-' + t0,
    samples: [
      { t: t0, lat: a == null ? 35 : a, lng: a == null ? 129 : a, speed: 2 },
      { t: t1, lat: b == null ? 36 : b, lng: b == null ? 130 : b, speed: 4 }
    ]
  };
}

console.log('=== 두 트랙 고스트 오버레이 self-test ===\n');

console.log('[1] alignGhost — 정렬 모드와 overlap');
var primary = session(100, 200);
var same = session(100, 200);
var partial = session(150, 250);
var separate = session(250, 300);

var clock = T.alignGhost(primary, partial, 'clock');
check('clock offset = ghost t0 - primary t0', clock.offsetSec === 50,
  JSON.stringify(clock));
var start = T.alignGhost(primary, partial, 'start');
check('start offset = 0', start.offsetSec === 0, JSON.stringify(start));
check('완전 겹침 overlapSec = 100', T.alignGhost(primary, same, 'clock').overlapSec === 100);
check('부분 겹침 overlapSec = 50', clock.overlapSec === 50, JSON.stringify(clock));
check('겹침 없음 overlapSec = 0',
  T.alignGhost(primary, separate, 'clock').overlapSec === 0);

console.log('\n[2] ghostStateAt — 범위와 보간');
var ghost = session(110, 120, 0, 10);
var before, after, noThrow = true;
try {
  before = T.ghostStateAt(ghost, 9.999, 10);
  after = T.ghostStateAt(ghost, 20.001, 10);
} catch (e) {
  noThrow = false;
}
check('범위 밖 조회가 예외를 던지지 않음', noThrow);
check('시작 전 → null', before === null, String(before));
check('종료 후 → null', after === null, String(after));
var middle = T.ghostStateAt(ghost, 15, 10);
check('범위 안 → 상태 반환', !!middle);
check('위도 두 샘플 사이 선형 보간', middle && near(middle.lat, 5),
  middle && String(middle.lat));
check('경도 두 샘플 사이 선형 보간', middle && near(middle.lng, 5),
  middle && String(middle.lng));
check('속도 두 샘플 사이 선형 보간', middle && near(middle.speed, 3),
  middle && String(middle.speed));

console.log('\n[3] open() — opts.ghost 없는 기존 경로 회귀');
var opened = false, openError = null;
try {
  opened = RDReplay.open({ session: primary, title: 'Primary Rider' });
} catch (e) {
  openError = e;
}
check('opts.ghost 없이 open() 예외 없음', openError === null,
  openError && openError.stack);
check('opts.ghost 없이 open() === true', opened === true);
check('기존 replay-track 캔버스 생성', !!global.document.getElementById('replay-track'));
check('무고스트 경로에는 고스트 라벨 DOM 없음',
  global.document.getElementById('replay-track-labels') == null);
check('open 후 isOpen() === true', RDReplay.isOpen() === true);
RDReplay.close();
check('close 후 isOpen() === false', RDReplay.isOpen() === false);

console.log('\n[4] open() — 고스트 라벨·렌더 경로');
var ghostOpened = false, ghostOpenError = null;
try {
  ghostOpened = RDReplay.open({
    session: primary,
    title: 'Primary Rider',
    ghost: { session: partial, label: 'Ghost Rider', color: '#A855F7' }
  });
} catch (e) {
  ghostOpenError = e;
}
check('opts.ghost 포함 open() 예외 없음', ghostOpenError === null,
  ghostOpenError && ghostOpenError.stack);
check('opts.ghost 포함 open() === true', ghostOpened === true);
check('두 트랙 라벨 컨테이너 생성',
  !!global.document.getElementById('replay-track-labels'));
check('primary 이름 표시',
  global.document.getElementById('replay-primary-label') &&
  global.document.getElementById('replay-primary-label').textContent.indexOf('Primary Rider') >= 0);
check('ghost 이름 표시',
  global.document.getElementById('replay-ghost-label') &&
  global.document.getElementById('replay-ghost-label').textContent.indexOf('Ghost Rider') >= 0);

/* open() 의 80ms relayout 뒤 실제 고스트 캔버스 렌더 경로까지 실행한다. */
setTimeout(function () {
  check('relayout 뒤 replay-track 렌더 완료(width > 0)',
    global.document.getElementById('replay-track').width > 0);
  RDReplay.close();
  console.log('\n=== 결과: ' + pass + ' PASS · ' + fail + ' FAIL ===');
  process.exit(fail === 0 ? 0 : 1);
}, 120);
