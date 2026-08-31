/* ============================================================
 * formula.js — 파생 지표를 위한 아주 작은 수식 언어 (§479)
 *
 * 대시보드가 미리 정해 둔 지표만 보여주면, 라이더가 궁금한 것 중
 * 절반은 영원히 못 본다. "속도 ÷ 심박", "VMG × 100 ÷ 목표", "각이
 * 50도를 넘을 때만 속도" — 이런 건 코드를 고칠 일이 아니라 한 줄
 * 적을 일이다.
 *
 * 왜 eval() 이 아닌가. eval 은 이 페이지의 모든 것에 닿는다. 저장된
 * 수식이 나중에 다른 기기로 동기화되면(§415) 그건 곧 원격 코드 실행이
 * 된다. 그래서 재귀하강 파서를 직접 쓴다 — 문법에 없는 건 아예 표현할
 * 수 없다. 속성 접근도, 함수 정의도, 전역도 없다.
 *
 * 변수 (표시 단위 그대로):
 *   speed  kt      vmg  kt      twa  °      hr  bpm
 *   heading °      t    경과 초  dist  m(누적)
 * 상수: pi, e
 * 함수: abs min max sqrt floor ceil round log exp
 *       sin cos tan (인자는 **도**)  rad deg
 *       clamp(x, lo, hi)   if(cond, a, b)
 * 연산: + - * / % ^   < <= > >= == !=   && || !   ? :
 *
 * 값이 없는 표본(예: HR 결측)은 null 을 내고, 집계에서 빠진다 —
 * 0 으로 치환하면 평균이 조용히 망가진다.
 *
 * 브라우저: RDFormula  ·  Node: require('./formula')
 * ============================================================ */
(function (global) {
  'use strict';
  var KT = 1.94384;

  var VARIABLES = [
    { key: 'speed', label: 'Speed (kt)' },
    { key: 'vmg', label: 'VMG (kt, signed: + upwind)' },
    { key: 'twa', label: 'CWA (deg, 0-180)' },
    { key: 'hr', label: 'Heart rate (bpm)' },
    { key: 'heading', label: 'Heading (deg)' },
    { key: 't', label: 'Elapsed seconds' },
    { key: 'dist', label: 'Cumulative distance (m)' }
  ];

  var D2R = Math.PI / 180;
  var FUNCS = {
    abs: [1, Math.abs], sqrt: [1, Math.sqrt], floor: [1, Math.floor],
    ceil: [1, Math.ceil], round: [1, Math.round], log: [1, Math.log],
    exp: [1, Math.exp],
    sin: [1, function (x) { return Math.sin(x * D2R); }],
    cos: [1, function (x) { return Math.cos(x * D2R); }],
    tan: [1, function (x) { return Math.tan(x * D2R); }],
    rad: [1, function (x) { return x * D2R; }],
    deg: [1, function (x) { return x / D2R; }],
    min: [-1, function () { return Math.min.apply(null, arguments); }],
    max: [-1, function () { return Math.max.apply(null, arguments); }],
    clamp: [3, function (x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }],
    'if': [3, function (c, a, b) { return c ? a : b; }]
  };
  var CONSTS = { pi: Math.PI, e: Math.E };

  /* 사전 조회는 반드시 자기 속성만 본다. FUNCS['constructor'] 는
     Object.prototype 을 타고 진짜 함수를 돌려주므로, 대괄호 조회를
     그대로 쓰면 "constructor" 가 유효한 이름으로 통과한다(실제로
     selftest-479 가 이걸 잡았다). */
  function own(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  /* ---------- 토크나이저 ---------- */
  function tokenize(src) {
    var out = [], i = 0, n = src.length;
    var two = { '<=': 1, '>=': 1, '==': 1, '!=': 1, '&&': 1, '||': 1 };
    while (i < n) {
      var c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      if (/[0-9.]/.test(c)) {
        var j = i;
        while (j < n && /[0-9.]/.test(src[j])) j++;
        var num = src.slice(i, j);
        if (!/^\d*\.?\d+$/.test(num)) throw new Error('Bad number "' + num + '"');
        out.push({ t: 'num', v: parseFloat(num), at: i });
        i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var k = i;
        while (k < n && /[A-Za-z0-9_]/.test(src[k])) k++;
        out.push({ t: 'id', v: src.slice(i, k).toLowerCase(), at: i });
        i = k; continue;
      }
      if (i + 1 < n && two[src.slice(i, i + 2)]) {
        out.push({ t: 'op', v: src.slice(i, i + 2), at: i }); i += 2; continue;
      }
      if ('+-*/%^()<>!?:,'.indexOf(c) >= 0) {
        out.push({ t: 'op', v: c, at: i }); i++; continue;
      }
      throw new Error('Unexpected character "' + c + '" at ' + (i + 1));
    }
    out.push({ t: 'end', v: null, at: n });
    return out;
  }

  /* ---------- 파서 (재귀하강) → AST ---------- */
  function parse(src) {
    var toks = tokenize(src), pos = 0;
    function peek() { return toks[pos]; }
    function next() { return toks[pos++]; }
    function isOp(v) { var t = peek(); return t.t === 'op' && t.v === v; }
    function eat(v) {
      if (!isOp(v)) throw new Error('Expected "' + v + '" at position ' + (peek().at + 1));
      return next();
    }

    function primary() {
      var t = peek();
      if (t.t === 'num') { next(); return { k: 'num', v: t.v }; }
      if (t.t === 'id') {
        next();
        if (isOp('(')) {
          if (!own(FUNCS, t.v)) throw new Error('Unknown function "' + t.v + '"');
          var f = FUNCS[t.v];
          eat('(');
          var args = [];
          if (!isOp(')')) {
            args.push(expr());
            while (isOp(',')) { next(); args.push(expr()); }
          }
          eat(')');
          if (f[0] >= 0 && args.length !== f[0]) {
            throw new Error(t.v + '() takes ' + f[0] + ' argument'
              + (f[0] > 1 ? 's' : '') + ', got ' + args.length);
          }
          if (f[0] < 0 && !args.length) throw new Error(t.v + '() needs at least one argument');
          return { k: 'call', name: t.v, args: args };
        }
        if (own(CONSTS, t.v)) return { k: 'num', v: CONSTS[t.v] };
        for (var i = 0; i < VARIABLES.length; i++) {
          if (VARIABLES[i].key === t.v) return { k: 'var', name: t.v };
        }
        throw new Error('Unknown name "' + t.v + '"');
      }
      if (isOp('(')) { next(); var e = expr(); eat(')'); return e; }
      throw new Error('Unexpected end of formula at position ' + (t.at + 1));
    }
    function unary() {
      if (isOp('-')) { next(); return { k: 'neg', a: unary() }; }
      if (isOp('+')) { next(); return unary(); }
      if (isOp('!')) { next(); return { k: 'not', a: unary() }; }
      return power();
    }
    function power() {
      var a = primary();
      if (isOp('^')) { next(); return { k: 'bin', op: '^', a: a, b: unary() }; }
      return a;
    }
    function mul() {
      var a = unary();
      while (isOp('*') || isOp('/') || isOp('%')) {
        var op = next().v; a = { k: 'bin', op: op, a: a, b: unary() };
      }
      return a;
    }
    function add() {
      var a = mul();
      while (isOp('+') || isOp('-')) {
        var op = next().v; a = { k: 'bin', op: op, a: a, b: mul() };
      }
      return a;
    }
    function cmp() {
      var a = add();
      while (isOp('<') || isOp('>') || isOp('<=') || isOp('>=') ||
             isOp('==') || isOp('!=')) {
        var op = next().v; a = { k: 'bin', op: op, a: a, b: add() };
      }
      return a;
    }
    function and() {
      var a = cmp();
      while (isOp('&&')) { next(); a = { k: 'bin', op: '&&', a: a, b: cmp() }; }
      return a;
    }
    function or() {
      var a = and();
      while (isOp('||')) { next(); a = { k: 'bin', op: '||', a: a, b: and() }; }
      return a;
    }
    function expr() {
      var c = or();
      if (isOp('?')) {
        next();
        var a = expr(); eat(':');
        return { k: 'cond', c: c, a: a, b: expr() };
      }
      return c;
    }

    var ast = expr();
    if (peek().t !== 'end') {
      throw new Error('Unexpected "' + peek().v + '" at position ' + (peek().at + 1));
    }
    return ast;
  }

  /* ---------- 평가 ---------- */
  function evalNode(node, vars) {
    switch (node.k) {
      case 'num': return node.v;
      case 'var': {
        var v = own(vars, node.name) ? vars[node.name] : null;
        return (v == null || !isFinite(v)) ? null : v;
      }
      case 'neg': { var a = evalNode(node.a, vars); return a == null ? null : -a; }
      case 'not': { var b = evalNode(node.a, vars); return b == null ? null : (b ? 0 : 1); }
      case 'cond': {
        var c = evalNode(node.c, vars);
        if (c == null) return null;
        return evalNode(c ? node.a : node.b, vars);
      }
      case 'call': {
        if (!own(FUNCS, node.name)) return null;
        var f = FUNCS[node.name];
        var args = [];
        for (var i = 0; i < node.args.length; i++) {
          var x = evalNode(node.args[i], vars);
          /* if() 는 쓰이지 않는 가지가 null 이어도 괜찮아야 한다 —
             "HR 이 있으면 A, 없으면 B" 를 쓸 수 있어야 하기 때문이다. */
          if (x == null && !(node.name === 'if')) return null;
          args.push(x);
        }
        if (node.name === 'if') {
          if (args[0] == null) return null;
          return args[0] ? args[1] : args[2];
        }
        var r = f[1].apply(null, args);
        return (r == null || !isFinite(r)) ? null : r;
      }
      case 'bin': {
        var l = evalNode(node.a, vars);
        if (l == null) return null;
        /* 단락 평가 — 오른쪽이 null 이어도 왼쪽으로 결론이 나면 그걸 쓴다 */
        if (node.op === '&&' && !l) return 0;
        if (node.op === '||' && l) return 1;
        var rr = evalNode(node.b, vars);
        if (rr == null) return null;
        var out;
        switch (node.op) {
          case '+': out = l + rr; break;
          case '-': out = l - rr; break;
          case '*': out = l * rr; break;
          case '/': out = rr === 0 ? null : l / rr; break;
          case '%': out = rr === 0 ? null : l % rr; break;
          case '^': out = Math.pow(l, rr); break;
          case '<': return l < rr ? 1 : 0;
          case '>': return l > rr ? 1 : 0;
          case '<=': return l <= rr ? 1 : 0;
          case '>=': return l >= rr ? 1 : 0;
          case '==': return l === rr ? 1 : 0;
          case '!=': return l !== rr ? 1 : 0;
          case '&&': return rr ? 1 : 0;
          case '||': return rr ? 1 : 0;
          default: return null;
        }
        return (out == null || !isFinite(out)) ? null : out;
      }
      default: return null;
    }
  }

  /* 표본 → 변수. 여기서 단위를 표시 단위로 바꾼다(속도는 kt) — 수식을
     적는 사람이 m/s 를 외우고 있을 이유가 없다. */
  function varsFor(sample, ctx) {
    return {
      speed: sample.speed == null ? null : sample.speed * KT,
      vmg: sample.vmg == null ? null : sample.vmg * KT,
      twa: sample.twa == null ? null : sample.twa,
      hr: (sample.hr == null || sample.hr <= 0) ? null : sample.hr,
      heading: sample.heading == null ? null : sample.heading,
      t: (ctx && ctx.t0 != null && sample.t != null) ? sample.t - ctx.t0 : null,
      dist: sample.cumDist == null ? null : sample.cumDist
    };
  }

  /* compile(src) → { ok, value(sample, ctx), uses:[변수명], error } */
  function compile(src) {
    if (src == null || !String(src).trim()) {
      return { ok: false, error: 'Empty formula' };
    }
    var ast;
    try { ast = parse(String(src)); }
    catch (e) { return { ok: false, error: e.message }; }
    var uses = {};
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (n.k === 'var') uses[n.name] = 1;
      ['a', 'b', 'c'].forEach(function (k) { if (n[k]) walk(n[k]); });
      if (n.args) n.args.forEach(walk);
    })(ast);
    return {
      ok: true, ast: ast, uses: Object.keys(uses),
      value: function (sample, ctx) { return evalNode(ast, varsFor(sample, ctx)); }
    };
  }

  /* 세션 전체에 적용한 시간가중 요약 — 수식을 저장하기 전에 "값이
     나오기는 하는지" 를 확인시켜 주는 용도. */
  function summarize(session, compiled, opts) {
    opts = opts || {};
    if (!compiled || !compiled.ok) return null;
    var S = (session && session.samples) || [];
    if (S.length < 2) return null;
    var gapSec = (session.cfg && session.cfg.gapThresholdSec) || 8;
    var ctx = { t0: S[0].t };
    var dt = 0, vDt = 0, vN = 0, mn = null, mx = null;
    var legs = (session.legs && session.legs.length)
      ? session.legs : [{ start: 0, end: S.length - 1 }];
    legs.forEach(function (leg) {
      for (var i = leg.start + 1; i <= leg.end; i++) {
        var step = S[i].t - S[i - 1].t;
        if (!(step > 0) || step > gapSec) continue;
        dt += step;
        var v = compiled.value(S[i], ctx);
        if (v == null || !isFinite(v)) continue;
        vDt += v * step; vN += step;
        if (mn == null || v < mn) mn = v;
        if (mx == null || v > mx) mx = v;
      }
    });
    if (!dt) return null;
    return { mean: vN > 0 ? vDt / vN : null, min: mn, max: mx,
             seconds: dt, coverage: dt > 0 ? vN / dt : 0 };
  }

  var API = { compile: compile, summarize: summarize, parse: parse,
              tokenize: tokenize, VARIABLES: VARIABLES,
              FUNCTION_NAMES: Object.keys(FUNCS) };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.RDFormula = API;
})(typeof window !== 'undefined' ? window : globalThis);
