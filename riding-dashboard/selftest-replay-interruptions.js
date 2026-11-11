/* Synthetic, offline regression checks for replay OCR and excluded intervals.
 * Run: node riding-dashboard/selftest-replay-interruptions.js
 * The VM loads the complete production file. A test-only probe exposes private
 * functions without adding a production API; expensive DOM/media outputs are
 * stubbed only where the test is checking state, not their rendering.
 */
'use strict';
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Analysis = require('./js/analysis.js');
const source = fs.readFileSync(process.env.REPLAY_SOURCE || path.join(__dirname, 'js/replay.js'), 'utf8');
const probe = `global.__probe = {
  state: function () { return R; }, setState: function (s) { R = s; },
  ensureMap: ensureMap,
  prepareMapTest: function () {
    setReplayTiles = updateMapWindow = noop;
    drawBoardLines = function () { global.mapDraws++; };
  },
  ocr: ocrPlaceClip, setClipStart: setClipStart, removeClip: removeClip,
  buildSyncPanel: buildSyncPanel, updateRider: updateRider,
  autoPlaceAll: autoPlaceAll, bindTrack: bindTrack, seek: seek,
  updateMapPlayhead: updateMapPlayhead, drawBoardLines: drawBoardLines,
  drawMiniGraph: drawMiniGraph, rebuildTrack: rebuildTrack,
  jumpManeuver: jumpManeuver, miniColor: MINI_LINE,
  quiet: function () {
    buildSyncPanel = function () { global.panels++; };
    rebuildTrack = relayout = setLayout = drawTrackCursor = noop;
    seek = function (t) { global.seeks.push(t); };
  },
  observeSeek: function () {
    updateRider = function (t, st) { global.observed.rider = st; };
    drawMiniGraphs = updateMapPlayhead = updateGhostPlayhead = drawTrackCursor = noop;
    paintScrub = updateClockEl = drawBlur = noop;
    syncVideo = function (t) { global.observed.videoElapsed = t; };
  },
  quietOpen: function () {
    buildOverlay = function () { return document.getElementById('replay-view'); };
    buildChips = buildRider = renderReplayStats = buildGraphs = bindEvents = noop;
    restorePersistedClips = noop;
  }
};\n`;

function element() {
  return { style: {}, children: [], hidden: false, value: '', textContent: '',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, removeAttribute() {}, addEventListener() {},
    querySelectorAll() { return []; }, querySelector() { return null; },
    pause() {}, load() {}, focus() {} };
}
function session() {
  return { hasTime: true, startEpoch: 1700000000000, trackName: 'Synthetic',
    cfg: { gapThresholdSec: 60 }, legs: [{ start: 0, end: 6 }],
    samples: Array.from({ length: 7 }, (_, t) => ({ t, lat: 35 + t * 0.00001,
      lng: 129, speed: 5, heading: 0, segDist: 1, cumDist: t })) };
}
function legStarts(s) {
  const out = {};
  s.legs.forEach(leg => { out[leg.start] = true; });
  return out;
}
function state(s = session()) {
  return { session: s, sessionSig: 'synthetic-session', samples: s.samples,
    legStarts: legStarts(s), t0: 0, t1: 6, dur: 6, playT: 0,
    clips: [], playing: false, video: element(), trackSpan: 6,
    unit: 'kt', windDir: null, map: null, onClose() {},
    scrub: element(), scrubMax: 1000, graphs: [], shown: {}, analysis: {} };
}
function harness() {
  const timers = new Map(), elements = {}, requests = [], writes = [];
  let timerSeq = 0;
  const ctx = { console, Promise, panels: 0, seeks: [], observed: {},
    setTimeout(fn) { timers.set(++timerSeq, fn); return timerSeq; },
    clearTimeout(id) { timers.delete(id); },
    cancelAnimationFrame() {}, removeEventListener() {},
    URL: { revokeObjectURL() {} },
    document: { activeElement: null, body: element(), removeEventListener() {},
      getElementById(id) { return elements[id] || null; } },
    RDStorage: { loadVideoSync() { return null; },
      saveVideoSync(sig, value) { writes.push({ sig, value: JSON.parse(JSON.stringify(value)) }); } },
    VideoTimeDetect: {
      detectVideoStart(url, options) {
        let resolve, reject;
        const promise = new Promise((a, b) => { resolve = a; reject = b; });
        requests.push({ url, options, resolve, reject });
        return promise;
      },
      resolveStartElapsed(hit) { return { startElapsed: hit.offset, confidence: 'synthetic' }; }
    }
  };
  vm.createContext(ctx);
  assert(source.includes('  var RDReplay = {'));
  vm.runInContext(source.replace('  var RDReplay = {', probe + '  var RDReplay = {'), ctx);
  const p = ctx.__probe;
  p.quiet();
  p.setState(state());
  return { ctx, p, requests, writes, elements,
    flush() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); },
    addClip() {
      const clip = { id: 'clip1', name: 'synthetic.webm', url: 'blob:synthetic',
        startElapsed: 0, duration: 60, place: 'none' };
      p.state().clips.push(clip); return clip;
    } };
}
async function settle() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
function hit(offset) { return { offset, frameSec: 0, raw: 'synthetic', hasSeconds: true }; }
function button() { return { disabled: false, textContent: 'OCR' }; }
const tests = [];
function test(name, run) { tests.push({ name, run }); }

test('ordinary OCR completion still applies and saves the offset', async () => {
  const h = harness(), c = h.addClip();
  h.p.ocr(c, button()); h.requests[0].resolve(hit(15)); await settle(); h.flush();
  assert.equal(c.startElapsed, 15);
  assert.equal(h.writes.at(-1).value.clips[c.name], 15);
});
test('a later manual edit wins over pending OCR, including persistence', async () => {
  const h = harness(), c = h.addClip();
  h.p.ocr(c, button()); h.p.setClipStart(c, 42);
  h.requests[0].resolve(hit(15)); await settle(); h.flush();
  assert.equal(c.startElapsed, 42);
  assert.equal(h.writes.at(-1).value.clips[c.name], 42);
});
test('dragging a clip invalidates OCR before the drag completes', async () => {
  const h = harness(), c = h.addClip(), events = {};
  h.elements['replay-track'] = { style: {}, addEventListener(k, fn) { events[k] = fn; },
    getBoundingClientRect() { return { left: 0, top: 0 }; }, setPointerCapture() {} };
  Object.assign(h.p.state(), { clipBars: [{ id: c.id, x1: 0, x2: 20, y0: 0, y1: 10 }],
    trackPlot: { x: 0, w: 100 }, winStart: 0, winEnd: 100 });
  h.p.ocr(c, button()); h.p.bindTrack();
  events.pointerdown({ clientX: 10, clientY: 5, pointerId: 1 });
  events.pointermove({ clientX: 52, clientY: 5, pointerId: 1 });
  assert.equal(c.startElapsed, 42);
  h.requests[0].resolve(hit(15)); await settle(); h.flush();
  assert.equal(c.startElapsed, 42);
  assert.equal(h.writes.length, 0, 'unfinished drag must not be saved by old OCR');
});
test('removing a clip makes its old OCR result inert', async () => {
  const h = harness(), c = h.addClip();
  h.p.ocr(c, button()); h.p.removeClip(c.id);
  const panels = h.ctx.panels;
  h.requests[0].resolve(hit(15)); await settle(); h.flush();
  assert.equal(c.startElapsed, 0);
  assert.equal(h.ctx.panels, panels);
  assert.equal(h.writes.length, 0);
});
test('close and reopen with the same clip ID cannot accept a previous result', async () => {
  const h = harness(), old = h.addClip();
  h.p.ocr(old, button()); h.ctx.RDReplay.close();
  h.p.setState(state()); const current = h.addClip();
  current.startElapsed = 9;
  h.requests[0].resolve(hit(15)); await settle(); h.flush();
  assert.equal(old.startElapsed, 0);
  assert.equal(current.startElapsed, 9);
  assert.equal(h.writes.length, 0);
});
test('a rebuilt sync button does not start a duplicate OCR request', () => {
  const h = harness(), c = h.addClip();
  h.p.ocr(c, button()); h.p.ocr(c, button());
  assert.equal(h.requests.length, 1);
});
test('rebuilt sync UI retains pending status until a manual edit invalidates it', () => {
  const h = harness(), c = h.addClip();
  ['replay-sync', 'replay-sync-close', 'replay-video-remove', 'replay-sync-redo']
    .forEach(id => { h.elements[id] = element(); });
  h.p.ocr(c, button()); h.requests[0].options.onProgress('Reading synthetic frame');
  h.p.buildSyncPanel();
  let html = h.elements['replay-sync'].innerHTML;
  assert.match(html, /data-clip-ocr="clip1" disabled/);
  assert.match(html, /Reading synthetic frame/);
  h.p.setClipStart(c, 42); h.p.buildSyncPanel();
  html = h.elements['replay-sync'].innerHTML;
  assert.doesNotMatch(html, /data-clip-ocr="clip1" disabled/);
  assert.doesNotMatch(html, /Reading synthetic frame/);
});
test('a new attempt after manual placement wins even if the old one completes last', async () => {
  const h = harness(), c = h.addClip();
  h.p.ocr(c, button()); h.p.setClipStart(c, 42); h.p.ocr(c, button());
  h.requests[1].resolve(hit(23)); await settle();
  h.requests[0].resolve(hit(15)); await settle(); h.flush();
  assert.equal(c.startElapsed, 23);
  assert.equal(h.writes.at(-1).value.clips[c.name], 23);
});
test('old progress and failure cannot change the status of a newer attempt', async () => {
  const h = harness(), c = h.addClip(), status = { textContent: '' };
  let activeButton = button();
  h.elements['replay-sync'] = { querySelector(sel) { return sel.includes('ocrstatus') ? status : activeButton; } };
  h.p.ocr(c, activeButton); h.p.setClipStart(c, 42);
  activeButton = button(); h.p.ocr(c, activeButton);
  h.requests[1].options.onProgress('New attempt');
  h.requests[0].options.onProgress('Old attempt');
  h.requests[0].reject(new Error('old failure')); await settle();
  assert.equal(status.textContent, 'New attempt');
  assert.equal(activeButton.disabled, true);
  h.requests[1].resolve(hit(23)); await settle(); h.flush();
  assert.equal(c.startElapsed, 23);
});
test('rerunning auto-align invalidates the earlier OCR attempt', async () => {
  const h = harness(), c = h.addClip();
  h.p.ocr(c, button()); h.p.autoPlaceAll();
  h.requests[0].resolve(hit(15)); await settle(); h.flush();
  assert.equal(c.startElapsed, 0);
  assert.equal(h.writes.length, 0);
});
test('failed OCR can be retried', async () => {
  const h = harness(), c = h.addClip(), b = button();
  h.p.ocr(c, b); h.requests[0].reject(new Error('synthetic failure')); await settle();
  assert.equal(b.disabled, false);
  h.p.ocr(c, b); h.requests[1].resolve(hit(12)); await settle(); h.flush();
  assert.equal(c.startElapsed, 12);
});
test('a synchronous OCR-engine failure is contained and allows retry', () => {
  const h = harness(), c = h.addClip(), b = button();
  h.ctx.VideoTimeDetect.detectVideoStart = () => { throw new Error('not ready'); };
  assert.doesNotThrow(() => h.p.ocr(c, b));
  assert.equal(b.disabled, false);
});
test('short exclusions yield missing data, while retained endpoints remain valid', () => {
  const h = harness(), s = Analysis.applyEdits(session(), { excludeRanges: [{ from: 2, to: 2 }] });
  const t = h.ctx.RDReplay._test;
  assert.equal(t.interpAtTime(s.samples, 2, 4, legStarts(s)), null);
  assert.equal(t.interpAtTime(s.samples, 1, 4, legStarts(s)).speed, 5);
  assert.equal(t.interpAtTime(s.samples, 3, 4, legStarts(s)).speed, 5);
  assert.equal(t.interpAtTime(s.samples, 3.5, 4, legStarts(s)).speed, 5);
});
test('missing speed renders as an em dash rather than zero', () => {
  const h = harness(), s = Analysis.applyEdits(session(), { excludeRanges: [{ from: 2, to: 2 }] });
  const r = state(s), t = h.ctx.RDReplay._test;
  r.metricSlots = [{ state: 'data', def: t.METRICS.find(m => m.key === 'sog') }];
  h.elements['rider-num-sog'] = element(); h.p.setState(r);
  h.p.updateRider(2, t.interpAtTime(s.samples, 2, 4, r.legStarts));
  assert.equal(h.elements['rider-num-sog'].textContent, '—');
  h.p.updateRider(3, { speed: 0 });
  assert.equal(Number(h.elements['rider-num-sog'].textContent), 0);
});
test('ghost exclusions remain missing after clock offset mapping', () => {
  const h = harness(), t = h.ctx.RDReplay._test;
  const s = Analysis.applyEdits(session(), { excludeRanges: [{ from: 2, to: 2 }] });
  assert.equal(t.ghostStateAt(s, 12, 10), null);
  assert.equal(t.ghostStateAt(s, 13, 10).speed, 5);
  assert.equal(t.ghostStateAt(s, 9, 10), null);
});
test('normal interpolation, GPS outliers and long gaps preserve existing behavior', () => {
  const h = harness(), t = h.ctx.RDReplay._test, s = session();
  assert.equal(t.interpAtTime(s.samples, 2.5).speed, 5);
  s.samples[2].gpsOutlier = true;
  assert.equal(t.interpAtTime(s.samples, 2), null);
  assert.equal(t.interpAtTime(s.samples, 2.5), null);
  assert.equal(t.interpAtTime([s.samples[0], s.samples[6]], 3), null);
});
test('seek shows missing data without collapsing video elapsed time or turn indices', () => {
  const h = harness(), s = Analysis.applyEdits(session(), { excludeRanges: [{ from: 2, to: 2 }] });
  const r = state(s); r.analysis.maneuvers = [{ apexIdx: 2 }];
  h.p.setState(r); h.p.observeSeek(); h.p.seek(2, true);
  assert.equal(h.ctx.observed.rider, null);
  assert.equal(r.curState, null);
  assert.equal(h.ctx.observed.videoElapsed, 2);
  assert.equal(r.playT, 2);
  h.p.jumpManeuver(1);
  assert.equal(h.ctx.seeks.at(-1), 3);
});
test('open caches the actual session and ghost leg boundaries', () => {
  const h = harness(), s = Analysis.applyEdits(session(), { excludeRanges: [{ from: 2, to: 2 }] });
  ['replay-view', 'replay-scrub', 'replay-clock', 'replay-video', 'replay-speed', 'replay-close-x']
    .forEach(id => { h.elements[id] = element(); });
  h.p.quietOpen();
  h.ctx.RDReplay.open({ session: s, ghost: { session: s, mode: 'start' } });
  assert.equal(h.p.state().legStarts[2], true);
  assert.equal(h.p.state().ghost.legStarts[2], true);
});
test('primary map marker disappears for missing data and returns at a valid sample', () => {
  const h = harness(), r = h.p.state(), positions = [], opacities = [];
  r.map = {}; r.mapFollow = false;
  r.mapPlayhead = { setLatLng(ll) { positions.push(ll); }, getElement() { return null; },
    setOpacity(v) { opacities.push(v); } };
  h.p.updateMapPlayhead(null);
  assert.equal(opacities.at(-1), 0);
  h.p.updateMapPlayhead(r.samples[3]);
  assert.equal(opacities.at(-1), 1);
  assert.equal(positions.length, 1);
});
test('missing data clears stale board analysis lines without projecting the old position', () => {
  const h = harness(), r = h.p.state();
  let cleared = 0, projections = 0;
  const ctx = drawingContext(); ctx.clearRect = () => { cleared++; };
  h.elements['replay-ladder'] = { width: 200, height: 100, getContext() { return ctx; } };
  Object.assign(r, { curState: null, windDir: 180, showWindAxis: true,
    map: { latLngToContainerPoint() { projections++; return { x: 10, y: 10 }; } },
    mapPlayhead: { getLatLng() { return { lat: 35, lng: 129 }; } } });
  h.p.drawBoardLines();
  assert.equal(cleared, 1);
  assert.equal(projections, 0);
});

function drawingContext() {
  const strokes = [], fills = [];
  let current = [];
  const c = { strokes, fills, setTransform() {}, clearRect() {}, save() {}, restore() {},
    fillRect() {}, strokeRect() {}, fillText() {}, setLineDash() {}, arc() {},
    arcTo() {}, quadraticCurveTo() {},
    beginPath() { current = []; }, moveTo(x, y) { current.push(['M', x, y]); },
    lineTo(x, y) { current.push(['L', x, y]); }, closePath() { current.push(['Z']); },
    stroke() { strokes.push({ color: this.strokeStyle, path: current.slice() }); },
    fill() { fills.push({ color: this.fillStyle, path: current.slice() }); } };
  return c;
}
test('mini-graphs break both rider lines at excluded boundaries', () => {
  const h = harness(), s = Analysis.applyEdits(session(), { excludeRanges: [{ from: 2, to: 2 }] });
  const r = state(s), ctx = drawingContext();
  r.ghost = { session: s, legStarts: legStarts(s), mt: s.samples.map(p => p.t), color: '#abcdef' };
  h.p.setState(r);
  const g = { state: 'data', w: 300, h: 80, dpr: 1, canvas: { getContext() { return ctx; } },
    def: { key: 'sog', field: 'speed' }, series: h.ctx.RDReplay._test.buildSeries(s.samples, 'speed'), vmin: 0, vmax: 10 };
  h.p.drawMiniGraph(g, 2, null);
  for (const color of [h.p.miniColor, '#abcdef']) {
    const line = ctx.strokes.find(p => p.color === color);
    assert(line);
    assert.equal(line.path.filter(p => p[0] === 'M').length, 2);
  }
});
test('track curves and speed fill do not bridge excluded boundaries', () => {
  const h = harness(), s = Analysis.applyEdits(session(), { excludeRanges: [{ from: 2, to: 2 }] });
  const r = state(s), ctx = drawingContext();
  Object.assign(r, { trackOff: { getContext() { return ctx; } }, trackW: 300, trackH: 84,
    trackDpr: 1, winStart: 0, winEnd: 6, shown: { sog: true },
    graphs: [{ state: 'data', def: { key: 'sog', field: 'speed', color: '#123456' }, vmin: 0, vmax: 10 }],
    ghost: { session: s, legStarts: legStarts(s), color: '#abcdef', align: { offsetSec: 0 } } });
  h.p.setState(r); h.p.rebuildTrack();
  for (const color of ['#123456', '#abcdef']) {
    const line = ctx.strokes.find(p => p.color === color);
    assert.equal(line.path.filter(p => p[0] === 'M').length, 2);
  }
  const fill = ctx.fills.find(p => p.color === 'rgba(51,161,255,0.16)');
  assert.equal(fill.path.filter(p => p[0] === 'M').length, 2);
  assert.equal(fill.path.filter(p => p[0] === 'Z').length, 2);
});

function mapHarness() {
  const h = harness(), callbacks = {};
  h.ctx.mapDraws = 0;
  const map = { on(event, fn) { callbacks[event] = fn; }, remove() {} };
  const control = () => ({ addTo() { return this; } });
  control.scale = control;
  h.ctx.L = { map() { return map; }, control, divIcon() { return {}; },
    marker() { return { addTo() { return this; } }; } };
  h.elements['replay-map'] = element();
  h.p.prepareMapTest(); h.p.ensureMap();
  return { ...h, map, callbacks };
}
test('active map events update only their current replay', () => {
  const h = mapHarness(), r = h.p.state();
  r._mapProg = true; h.callbacks.moveend();
  assert.equal(r._mapProg, false); assert.equal(h.ctx.mapDraws, 1);
  h.callbacks.dragstart(); assert.equal(r.mapUserMoved, true);
  h.callbacks.zoomend(); assert.equal(h.ctx.mapDraws, 2);
});
test('map animation callbacks are harmless after replay closes', () => {
  const h = mapHarness(); h.ctx.RDReplay.close();
  for (const callback of Object.values(h.callbacks)) assert.doesNotThrow(callback);
  assert.equal(h.p.state(), null); assert.equal(h.ctx.mapDraws, 0);
});
test('old map callbacks cannot change a newer replay', () => {
  const h = mapHarness(), next = state();
  next.map = {}; next._mapProg = true; next.mapUserMoved = false;
  h.p.setState(next);
  for (const callback of Object.values(h.callbacks)) callback();
  assert.equal(next._mapProg, true); assert.equal(next.mapUserMoved, false);
  assert.equal(h.ctx.mapDraws, 0);
});
test('replaced map callbacks cannot change their original replay', () => {
  const h = mapHarness(), r = h.p.state();
  r.map = {}; r._mapProg = true; r.mapUserMoved = false;
  for (const callback of Object.values(h.callbacks)) callback();
  assert.equal(r._mapProg, true); assert.equal(r.mapUserMoved, false);
  assert.equal(h.ctx.mapDraws, 0);
});

(async () => {
  let failures = 0;
  for (const t of tests) {
    try { await t.run(); console.log('PASS ' + t.name); }
    catch (e) { failures++; console.error('FAIL ' + t.name + '\n  ' + e.message); }
  }
  console.log(`${tests.length - failures}/${tests.length} passed`);
  if (failures) process.exitCode = 1;
})();
