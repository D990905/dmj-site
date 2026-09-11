/* §589 (옥대표 "비교기능은 대체 뭐를 하는거냐... 전혀 비교되는게 없는데?")

   원인: 헤더의 비교 선택기는 리플레이 고스트 전용이었다. 골라도 대시보드는
   아무것도 안 바뀌고, ▶ Replay 를 눌러야 보라색 보드로만 보였다. 설명은
   마우스를 올려야 뜨는 툴팁뿐(폰에서는 영영 안 뜸).

   지키는 것: (1) 고르는 순간 요약 아래에 두 세션이 나란히 뜬다
   (2) 점수는 그 세션을 저장할 때 그 세션의 입력으로 매긴 값 — 지금 폼
       값으로 다시 매기면 §547 결함이 재발한다
   (3) 속도·VMG·회전은 저장 트랙을 그 세션의 풍속으로 같은 코드로 재분석
   (4) 방향이 있는 줄만 색칠 (회전 손실은 작을수록 좋다), 조건 차이를 밝힌다 */
var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }
var app = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, 'v2.html'), 'utf8');
var code = app.replace(/\/\*[\s\S]*?\*\//g, '');
function fnBody(name) {
  var i = code.indexOf('function ' + name + '(');
  if (i < 0) return '';
  var depth = 0, j = code.indexOf('{', i);
  for (var k = j; k < code.length; k++) {
    if (code[k] === '{') depth++;
    else if (code[k] === '}') { depth--; if (!depth) return code.slice(i, k + 1); }
  }
  return '';
}
var rc = fnBody('renderCompare'), ca = fnBody('compareAnalysis'), pg = fnBody('populateReplayGhost');

console.log('[1] 고르면 바로 보인다');
ok('★★ 요약(KPI) 바로 아래에 자리가 있다',
   html.indexOf('id="compare-host"') > html.indexOf('id="kpi-row"')
   && html.indexOf('id="compare-host"') < html.indexOf('card-header-tabs'));
ok('★★ 선택을 바꾸면 그린다', /sel\.addEventListener\('change', function \(\) \{\s*try \{ renderCompare\(\); \}/.test(pg));
ok('★ 리스너는 한 번만 단다 (목록을 다시 채울 때마다 쌓이지 않게)', /if \(!sel\._rdCmp\) \{\s*sel\._rdCmp = true;/.test(pg));
ok('★★ 세션을 바꿔도 비교는 유지 (show 에서 다시 그린다)', /renderKpis\(analysis, vps\);\s*try \{ renderCompare\(\); \}/.test(code));
ok('★ 이름표가 하는 일을 말한다', /none\.textContent = 'Compare with\\u2026'/.test(pg));
ok('★★ "숫자는 안 바뀐다" 옛 안내 문구가 사라졌다', !/This does not change any of the numbers/.test(code));
ok('★ 리플레이는 그대로 — 카드에서 바로 부를 수 있다', /Race it in Replay/.test(rc) && /\$\('btn-replay'\)/.test(rc));
ok('★ 비교 끄기', /sel\.value = ''; renderCompare\(\);/.test(rc));
ok('★ 자기 자신을 고르면 그렇다고 말한다', /CUR\.openedRecId === rec\.id/.test(rc));

console.log('\n[2] ★★ 공정한 비교 — 각자 자기 조건으로');
ok('★★ 비교 세션 점수 = 저장 당시 값 (지금 폼으로 재채점 X)',
   /rec\.vpsOverall/.test(rc) && /rec\.vpsUpwind/.test(rc) && /rec\.vpsDownwind/.test(rc));
ok('★★ 재분석은 그 세션의 풍속으로 (지금 폼 풍속 X)',
   /o\.windSpeedKt = rec\.windSpeedKt/.test(ca) && ca.indexOf('analysisOpts(') < 0 && ca.indexOf('windSpeedFromForm') < 0);
ok('★ 풍향도 그 세션에 저장된 값 먼저', /var wd = rec\.windDir != null \? rec\.windDir/.test(ca));
ok('★ 같은 분석 코드', /An\.analyzeSession\(gs, wd, o\)/.test(ca) && /sessionFromStoredTrack\(gpx\)/.test(ca));
ok('★ 한 번 계산하면 담아 둔다 (id + savedAt)', /var key = rec\.id \+ '\|' \+ \(rec\.savedAt \|\| ''\);/.test(ca));
ok('★ 트랙을 못 읽으면 점수만 보여 주고 그렇다고 말한다', /could not be re-read, so only its saved scores are shown/.test(code));

console.log('\n[3] 줄과 색');
['Performance score', 'Top speed (2 s)', 'Average speed, moving', 'Upwind VMG, best 20%',
 'Downwind VMG, best 20%', 'Time on foil', 'Tack success', 'Gybe success',
 'Speed lost in tacks', 'Speed lost in gybes', 'Distance', 'Tacks · gybes'].forEach(function (n) {
  ok('줄: ' + n, rc.indexOf("'" + n + "'") >= 0);
});
ok('★★ 회전 손실은 작을수록 좋다 (-1)', /\['Speed lost in tacks', [^\]]*'%', 0, -1\]/.test(rc)
   && /\['Speed lost in gybes', [^\]]*'%', 0, -1\]/.test(rc));
ok('★★ 거리는 칠하지 않는다 (탄 시간에 달림)', /'km', 2, 0\]/.test(rc));
ok('★ 차이가 반올림 아래면 "same"', /dc\.textContent = 'same'/.test(rc));

/* 색 판정 로직을 떼어 돌린다 */
var m = rc.match(/var better = \(diff > 0\) === \(r\[5\] > 0\);/);
ok('★ 색 판정 식이 있다', !!m);
function better(diff, dir) { return (diff > 0) === (dir > 0); }
ok('★★ 속도 +1.2 kt 이면 이 세션이 낫다', better(1.2, 1) === true);
ok('★★ 회전 손실 +5% 이면 이 세션이 나쁘다', better(5, -1) === false);
ok('★★ 회전 손실 −5% 이면 이 세션이 낫다', better(-5, -1) === true);

console.log('\n[4] 조건 차이를 밝힌다');
ok('★★ 풍속 차 3 kt 이상이면 "대부분 바람 탓" 이라고', /Math\.abs\(wsA - wsB\) >= 3/.test(rc) && /mostly the wind, not you/.test(rc));
ok('★ 장비도 나란히', /'Gear: ' \+ \(ga \|\| 'not recorded'\) \+ ' vs ' \+ \(gb \|\| 'not recorded'\)/.test(rc));
ok('★ 실패는 삼키지 않는다', /\[v2 §589\] compare analysis/.test(app) && /\[v2 §589\] compare'/.test(app));

console.log('\n[5] 배포');
ok('★ v2-app v589 이상', (function () { var mm = html.match(/v2-app\.js\?v=v(\d+)/); return mm && +mm[1] >= 589; })());

console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
