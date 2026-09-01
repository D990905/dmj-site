/* §502 Tack bias — 배포되는 소스를 잘라내 그대로 검사한다. */
var fs = require('fs');
var src = fs.readFileSync(__dirname + '/js/v2-app.js', 'utf8');
function grab(name) {
  var i = src.indexOf('  function ' + name + '(');
  if (i < 0) throw new Error('못 찾음: ' + name);
  var j = src.indexOf('\n  }\n', i);
  return src.slice(i, j + 4);
}
var KT = 1.94384;
/* tbFmt 는 기본 모집단을 TACKBIAS.tier 에서 읽는다(§503) — 떼어낸
   함수만 실행하므로 그 상태를 여기서 만들어 준다. */
var F = new Function('KT', 'TACKBIAS',
  grab('tbFmt') + grab('tbPick') + grab('tbDiff') + grab('tbUpDownSanity').replace(/var box[\s\S]*?return box;/, 'return { ratio: ratio };') + grab('tbCauseNote') +
  '\nreturn { tbFmt: tbFmt, tbPick: tbPick, tbDiff: tbDiff, tbCauseNote: tbCauseNote,'
  + ' tbUpDownSanity: tbUpDownSanity, setTier: function (t) { TACKBIAS.tier = t; } };')(
  KT, { metric: 'sog', mode: 'upwind', tier: 'avg' });

var pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x ? '  ' + x : '')); } }

/* rows 만들기 — 속도는 m/s 로 담긴다(엔진 규약) */
function mk(spec) {
  var rows = [];
  Object.keys(spec).forEach(function (metric) {
    var unit = (metric === 'sog' || metric === 'vmg') ? 'speed'
             : (metric === 'hr' ? 'bpm' : 'deg');
    ['P', 'S'].forEach(function (side, k) {
      var v = spec[metric][k];
      if (v == null) return;
      rows.push({ metric: metric, mode: 'upwind', side: side, unit: unit,
                  avg: unit === 'speed' ? v / KT : v });
    });
  });
  return rows;
}

console.log('\n[1] tbDiff');
ok('+10%', Math.abs(F.tbDiff(10, 11) - 10) < 1e-9);
ok('−10%', Math.abs(F.tbDiff(10, 9) + 10) < 1e-9);
ok('0 나눗셈은 null', F.tbDiff(0, 5) === null);
ok('null 입력은 null', F.tbDiff(null, 5) === null);
/* 음수 기준값에서도 부호가 뒤집히지 않아야 한다 (|Port| 로 나눈다) */
ok('음수 기준에서 부호 보존', F.tbDiff(-10, -9) > 0);

console.log('\n[2] tbFmt — 단위 변환 (엔진은 m/s, 화면은 kt)');
var f = F.tbFmt({ avg: 10 / KT, unit: 'speed' });
ok('speed → kt', f && f.unit === 'kt' && Math.abs(f.v - 10) < 1e-6);
ok('deg 은 그대로', F.tbFmt({ avg: 47.8, unit: 'deg' }).unit === '°');
ok('bpm 은 반올림', F.tbFmt({ avg: 142.4, unit: 'bpm' }).txt === '142');
ok('null avg → null', F.tbFmt({ avg: null, unit: 'speed' }) === null);
ok('NaN → null', F.tbFmt({ avg: NaN, unit: 'speed' }) === null);

console.log('\n[3] ★ 회귀 — 옥대표 실측 (부호 반대). 이걸 놓쳤었다');
/* 속도 +2.8% (스타보드 빠름) · VMG −5.4% (포트 나음) · CWA 4.0° 벌어짐
   처음 로직은 |속도| < |VMG|/2 로만 봐서 2.8 < 2.7 이 거짓 → 놓쳤다.
   부호가 반대인 것이 각도 문제의 가장 확실한 신호다. */
var real = mk({ sog: [13.5, 13.9], vmg: [8.9, 8.4], twa: [47.8, 51.8] });
var note = F.tbCauseNote(real, 'upwind');
ok('해설이 나온다', !!note);
ok('각도 문제라고 말한다', note && /giving up angle/.test(note));
ok('벌어진 각도를 숫자로 준다', note && /4\.0/.test(note));
ok('어느 택이 넓은지 말한다', note && /wider on starboard/.test(note));

console.log('\n[4] 같은 방향 · VMG 가 훨씬 큼 → 여전히 각도');
var amp = mk({ sog: [15.0, 15.15], vmg: [9.0, 9.6], twa: [48, 45] });
var n2 = F.tbCauseNote(amp, 'upwind');
ok('각도 쪽으로 판정', n2 && /coming from angle/.test(n2), n2);

console.log('\n[5] 같은 방향 · 크기 비슷 → 속도 문제');
var spd = mk({ sog: [14.0, 15.0], vmg: [9.0, 9.65], twa: [50, 50] });
var n3 = F.tbCauseNote(spd, 'upwind');
ok('속도 차이로 판정', n3 && /speed difference/.test(n3), n3);
ok('각도라고 하지 않는다', n3 && !/angle problem|giving up angle/.test(n3));

console.log('\n[6] 둘 다 미미 → 비대칭 없음도 결론이다');
var flat = mk({ sog: [15.0, 15.1], vmg: [10.0, 10.1], twa: [50, 50.2] });
var n4 = F.tbCauseNote(flat, 'upwind');
ok('없다고 말해 준다', n4 && /no meaningful bias/.test(n4), n4);

console.log('\n[7] 데이터가 모자라면 조용히 빠진다');
ok('VMG 없으면 null', F.tbCauseNote(mk({ sog: [14, 15] }), 'upwind') === null);
ok('빈 rows 는 null', F.tbCauseNote([], 'upwind') === null);
ok('다른 mode 는 null', F.tbCauseNote(real, 'downwind') === null);

console.log('\n[8] 부호 반대여도 너무 작으면 단정하지 않는다');
var tiny = mk({ sog: [15.0, 15.05], vmg: [10.0, 9.98], twa: [50, 50.1] });
var n5 = F.tbCauseNote(tiny, 'upwind');
ok('미미하면 "없음" 으로', n5 && /no meaningful bias/.test(n5), n5);

console.log('\n[9] ★ §503 모집단 스위치 — 평균 vs 상위');
/* tier 를 바꾸면 같은 rows 에서 다른 값이 나와야 한다.
   옥대표 질문("이게 오류일까")을 가르는 도구가 이것이다. */
var tiered = [
  { metric: 'vmg', mode: 'upwind', side: 'P', unit: 'speed',
    avg: 5.7 / KT, tier50: 7.0 / KT, tier20: 8.2 / KT },
  { metric: 'vmg', mode: 'upwind', side: 'S', unit: 'speed',
    avg: 4.9 / KT, tier50: 6.2 / KT, tier20: 7.4 / KT }
];
F.setTier('avg');
ok('기본은 평균', Math.abs(F.tbFmt(tiered[0]).v - 5.7) < 0.01);
F.setTier('tier50');
ok('Best 50% 로 바뀐다', Math.abs(F.tbFmt(tiered[0]).v - 7.0) < 0.01);
F.setTier('tier20');
ok('Best 20% 로 바뀐다', Math.abs(F.tbFmt(tiered[0]).v - 8.2) < 0.01);
F.setTier('tier20');
ok('명시 인자가 상태를 이긴다', Math.abs(F.tbFmt(tiered[0], 'avg').v - 5.7) < 0.01);
F.setTier('avg');
ok('tier 값이 없으면 null (조용히 빠진다)',
   F.tbFmt({ avg: null, tier50: 3, unit: 'speed' }) === null);

console.log('\n[10] ★ §503 위생 검사 — 풍하 VMG 가 풍상보다 큰가');
/* 옥대표 세션: 풍하 5.9 ≈ 풍상 5.7 → 비율 1.03. 경고가 떠야 한다. */
function vmgRows(upP, upS, dnP, dnS) {
  return [
    { metric: 'vmg', mode: 'upwind',   side: 'P', unit: 'speed', avg: upP / KT },
    { metric: 'vmg', mode: 'upwind',   side: 'S', unit: 'speed', avg: upS / KT },
    { metric: 'vmg', mode: 'downwind', side: 'P', unit: 'speed', avg: dnP / KT },
    { metric: 'vmg', mode: 'downwind', side: 'S', unit: 'speed', avg: dnS / KT }
  ];
}
var flagged = F.tbUpDownSanity(vmgRows(5.7, 4.9, 5.9, 5.6));
ok('옥대표 세션은 경고 대상', flagged != null,
   flagged ? '(비율 ' + flagged.ratio.toFixed(2) + ')' : '');
ok('그 비율이 1.3 미만', flagged && flagged.ratio < 1.3);
/* 제 테스트 세션: 풍상 8.9/8.4, 풍하 15.4/15.9 → 비율 1.8. 정상. */
ok('정상 세션은 경고 없음', F.tbUpDownSanity(vmgRows(8.9, 8.4, 15.4, 15.9)) === null);
ok('풍하가 없으면 조용히 빠진다',
   F.tbUpDownSanity([{ metric: 'vmg', mode: 'upwind', side: 'P', unit: 'speed', avg: 5 }]) === null);

console.log('\n[11] 풍향 오차 산술 — 차이 D° 는 풍향 D/2° 로 설명된다');
/* 풍향을 δ 만큼 틀리면 한쪽 +δ, 반대쪽 −δ → 측정 차이 = 진짜 + 2δ.
   즉 관측된 4.0° 는 δ=2.0° 면 통째로 설명된다. 카드가 이 숫자를 쓴다. */
var gap = 51.8 - 47.8;
ok('4.0° 차이 → 풍향 2.0°', Math.abs(gap / 2 - 2.0) < 1e-9);

console.log('\n' + pass + '/' + (pass + fail) + ' 통과');
process.exit(fail ? 1 : 0);
