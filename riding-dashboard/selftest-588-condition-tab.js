/* §588 컨디션 탭 (옥대표)
   "좌측 첫 페이지를 윈드라고 하지말고 컨디션이라고 하고. 그 안에 바람 방향설정.
    그날의 트랙선택(불필요한곳 제거기능), 장비선택, 해상컨디션, 신체컨디션(수면포함)
    을 넣어줘. 그리고 다른곳에서는 해당 항목을 제거해줘. 그리고 보드를 선택하는게
    없던데? 보드는 현재 ppc r1 83l 를 타고 있어."

   지키는 것: (1) 다섯 가지가 컨디션에 순서대로 있다 (2) 원래 자리에서는 빠졌다
   — 두 곳에 있으면 어디서 고친 게 반영되는지 헷갈린다 (3) 보드 사양은 출처 있는
   값만, 모르는 두께는 가정이라고 표시. */
var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }
var app = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, 'v2.html'), 'utf8');
var shell = fs.readFileSync(path.join(__dirname, 'js/mobile-shell.js'), 'utf8');
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

console.log('[1] 이름');
ok('★★ 첫 탭 이름이 Condition', /href="#tab-env" class="nav-link active"[^>]*>Condition</.test(html));
ok('★ 폰 하단바도 Condition', /'#tab-env':\s*\{ icon: 'cond',\s*label: 'Condition' \}/.test(shell));
ok('★ 탭 id 는 그대로 (#tab-env — 링크·되돌아가기 호환)', /id="tab-env"/.test(html));

console.log('\n[2] ★★ 다섯 가지가 컨디션에, 이 순서로');
var env = fnBody('renderEnvironment'), setup = fnBody('renderConditionSetup');
ok('★ renderEnvironment · renderConditionSetup 이 있다', !!env && !!setup);
var order = [
  ['Wind',  env.indexOf("condSection(host, 'Wind'")],
  ['setup', env.indexOf('renderConditionSetup(host)')]
];
ok('★★ 바람이 먼저, 그다음 나머지', order[0][1] > 0 && order[1][1] > order[0][1]);
ok('★★ 바람 안: 풍향 입력 → 풍향 확인 지도',
   env.indexOf("'Wind direction (°)'") > 0 && env.indexOf('renderWindConfirm(host') > env.indexOf("'Wind direction (°)'"));
var secs = ['Track', 'Gear', 'Sea', 'Body'].map(function (t) { return setup.indexOf("condSection(host, '" + t + "'"); });
ok('★★ 트랙 → 장비 → 바다 → 몸', secs.every(function (v, i) { return v > 0 && (i === 0 || v > secs[i - 1]); }),
   secs.join(','));
ok('★★ 트랙: 제거 차트 + 제거 목록(edit-bar)', /renderTrimChart\(\);\s*renderEditBar\(\);/.test(setup)
   && /eb\.id = 'edit-bar'/.test(setup));
ok('★★ 장비: 선택기', /gh\.id = 'cond-gear'/.test(setup) && /renderGearPicker\(gh\)/.test(setup));
ok('★★ 바다: 해상 상태 카드', /sh\.id = 'cond-sea'/.test(setup) && /renderSeaState\(sh\)/.test(setup));
ok('★★ 몸: 웰니스(수면 포함)를 세션 날짜로', /var day = sessionYmd\(\);/.test(setup) && /renderWellness\(bh, day\)/.test(setup));
ok('★ 수면 칸이 웰니스 안에 있다', /\['sleepH', 'Sleep', 'h', 0, 14\]/.test(code));
ok('★★ 풍향이 안 풀려도 트랙·장비·바다·몸은 그린다 (return 보다 앞)',
   env.indexOf('renderConditionSetup(host)') < env.indexOf('if (!w) { renderWindAnalysis(a); return; }'));

console.log('\n[3] ★★ 원래 자리에서는 빠졌다');
ok('★★ 코치 탭에 장비 선택기 없음', fnBody('renderCoach').indexOf('renderGearPicker(') < 0);
ok('★★ 장비 선택기 호출은 컨디션 한 곳뿐', (code.match(/renderGearPicker\(/g) || []).length === 3,   /* 정의 + setup + refresh */
   String((code.match(/renderGearPicker\(/g) || []).length));
ok('★★ Training load 에 웰니스 입력 없음', fnBody('renderTraining').indexOf('renderWellness(') < 0);
ok('★ …대신 어디로 갔는지 알려 준다', /entered in the Condition '\s*\+\s*'tab/.test(code));
ok('★★ 퍼포먼스 타임라인에 구간 제거 없음', fnBody('renderTimeline').indexOf('onExclude') < 0);
ok('★★ onExclude 는 트랙 카드 한 곳뿐', (code.match(/onExclude:/g) || []).length === 1);
ok('★★ 퍼포먼스 탭 HTML 에 edit-bar 없음', html.indexOf('id="edit-bar"') < 0);
ok('★★ 장비 선택기 안에 Water state 없음', fnBody('renderGearPicker').indexOf("'Water state'") < 0);
ok('★ Bin table · 회전 손실은 퍼포먼스로', /id="wind-analysis-host"/.test(html)
   && env.indexOf('renderBinTable(') < 0 && env.indexOf('renderGainLoss(') < 0);

console.log('\n[4] 옮긴 뒤에도 연결이 살아 있다');
ok('★★ 장비를 바꾸면 컨디션 두 카드 + 코치를 다시 그린다',
   /refreshGearViews\(\);/.test(fnBody('renderGearPicker'))
   && /renderGearPicker\(gh\)/.test(fnBody('refreshGearViews')) && /renderSeaState\(sh\)/.test(fnBody('refreshGearViews'))
   && /renderCoach\(CUR\.analysis, CUR\.vps, CUR\.whatIf\)/.test(fnBody('refreshGearViews')));
ok('★★ 해상 상태는 예전과 같은 자리(gear.surface)에 쓴다',
   /CUR\.sessionGear\.surface = o\.id; CUR\.gearDirty = true;/.test(fnBody('renderSeaState'))
   && /saveGear\(\{ surface: o\.id \}\)/.test(fnBody('renderSeaState')));
ok('★ 해상 카드에도 세션 저장 버튼 (같은 저장 경로)', /saveInputsToSession\(sv\)/.test(fnBody('renderSeaState')));
ok('★★ Bin table 접기는 그 호스트만 다시 그린다 (컨디션 탭 통째로 X)',
   (code.match(/BINTABLE_OPEN = (true|false); renderWindAnalysis\(a\);/g) || []).length === 2
   && !/BINTABLE_OPEN = (true|false); renderEnvironment/.test(code));
ok('★ 트랙 차트는 속도 한 줄, 타임라인과 커서를 섞지 않는다',
   /channels: \['speed'\],\s*syncId: 'trim'/.test(fnBody('renderTrimChart')));
ok('★ 실패는 삼키지 않는다', ['condition setup', 'trim chart', 'coach refresh', 'bin table', 'gain/loss', 'wind variation']
   .every(function (k) { return app.indexOf("[v2 §588] " + k) >= 0; }));

console.log('\n[5] 몸 — 세션 날짜');
var sy = fnBody('sessionYmd'), ty = fnBody('todayYmd');
if (sy && ty) {
  var f = new Function('CUR', ty + '\n' + sy + '\nreturn sessionYmd();');
  var d = new Date(2026, 8, 3, 14, 5);
  ok('★★ 9/03 세션을 열면 9/03 로 쓴다', f({ session: { startEpoch: d.getTime() } }) === '2026-09-03');
  ok('★ 세션이 없으면 오늘', f({ session: null }) === f({}));
}
ok('★★ 웰니스는 받은 날짜로 저장한다 (todayYmd 고정 아님)',
   /function renderWellness\(host, ymd\)/.test(code) && /var today = ymd \|\| todayYmd\(\);/.test(code));
ok('★ 지난 날짜면 제목도 그 날짜', /'How you felt on ' \+ today/.test(code));

console.log('\n[6] 보드 — PPC R1 83L');
var G = require('./js/gear-levitaz.js');
var r1 = G.byId(G.BOARDS, 'ppc_r1_83');
ok('★★ 목록에 PPC R1 83L', !!r1 && r1.label === 'PPC R1 83L');
ok('★★ 제조사 공개값: 83 L · 3.95 kg · 5\'3" x 21"', r1 && r1.volumeL === 83 && r1.weightKg === 3.95
   && r1.lengthCm === 160 && r1.widthCm === 53);
ok('★★ 두께는 미공개 → 가정이라고 표시', r1 && r1.thicknessAssumed === true);
ok('★ 옥대표 상용 세팅 기본값이 R1', G.DEFAULT.board === 'ppc_r1_83');
ok('★ 예전 기록의 board_default 도 여전히 풀린다', !!G.byId(G.BOARDS, 'board_default'));
var sel = Object.assign({}, G.DEFAULT);
var withR1 = G.rigMassKg(sel), withOld = G.rigMassKg(Object.assign({}, sel, { board: 'board_default' }));
ok('★★ 전체 무게 계산에 실제 보드 무게가 들어간다 (4.8 → 3.95 kg)', Math.abs((withOld - withR1) - 0.85) < 1e-9,
   (withOld - withR1).toFixed(3));
ok('★★ 장비 선택기에 Board 칸', /pick\('Board', 'board', RDGear\.BOARDS/.test(code));
ok('★ 가정 두께는 선택기에도 적는다', /thicknessAssumed \? '  \(thickness est\.\)'/.test(code));

console.log('\n[7] 배포');
ok('★ v2-app v588 이상', (function () { var m = html.match(/v2-app\.js\?v=v(\d+)/); return m && +m[1] >= 588; })());
ok('★ gear-levitaz 캐시버스트 갱신', /gear-levitaz\.js\?v=gear-588/.test(html));

console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
