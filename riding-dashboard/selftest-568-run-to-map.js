/* §568 Fast runs 표에서 지도로 잇기
   옥대표: "이건 뭐를 보여주기 위한걸까? … 해당 레그의 트랙을 지도에서 선택해서
           볼 수 있다면 좋을것 같기는한데 그냥 숫자만 있는건 큰 의미가 없어보여.
           track 에 가보니 40개의 트랙으로 구분해뒀던데 그 중의 일부이면 그쪽으로
           옮기는건 어떨까?"

   확인 결과 목적지는 이미 있었다 — SEG_KINDS 에 'Runs' 가 들어 있고
   buildSegs('run') 이 읽는 것이 이 표와 **같은 배열**(a.runs.runs)이다.
   다만 옮기지 않고 잇는다: 표는 순위(빠른 순), 스테퍼는 위치(시간순)로
   서로 다른 일을 한다. */
var fs=require('fs'), path=require('path'), vm=require('vm');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');
var seg=fs.readFileSync(path.join(__dirname,'js/segments.js'),'utf8');
var segc=seg.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] ★★ 정말 같은 데이터인가 (잇기 전에 확인할 것)');
ok('★ 스테퍼에 Runs 모드가 이미 있다', /\['run', 'Runs'\]/.test(code));
ok('★★ buildSegs(run) 이 a.runs.runs 를 읽는다',
   /var runs = \(a\.runs && a\.runs\.runs\) \|\| a\.runs \|\| \[\]/.test(segc));
ok('★★ 표도 같은 배열을 읽는다', /var rw = a\.runs \|\| \{\}, runs = rw\.runs \|\| \[\]/.test(code));
ok('★★ 인덱스가 1:1 (스테퍼가 no = i+1 로 그대로 센다)',
   /return \{ kind: 'run', no: i \+ 1, startIdx: r\.startIdx, endIdx: r\.endIdx \}/.test(segc));

console.log('\n[2] 잇기 — 옮기지 않는다');
ok('★ 이동 헬퍼가 있다', /function goToSegment\(kind, idx\)/.test(code));
ok('★ 행을 누를 수 있다', /tr\.addEventListener\('click', function \(\) \{ goToSegment\('run', i\); \}\)/.test(code));
ok('커서·툴팁으로 누를 수 있음을 알린다',
   /tr\.style\.cursor = 'pointer'/.test(code) && /Show this run on the map/.test(code));
ok('★ 표는 그대로 남는다 (순위를 잃지 않는다)',
   /'#', 'Duration', 'Distance', 'Avg', 'Max', 'Heading', 'Avg HR'/.test(code));

console.log('\n[3] 이동 동작');
ok('★ 종류와 번호를 함께 세팅', /SEGSTEP\.kind = kind;\s*\n\s*SEGSTEP\.idx = idx;/.test(code));
ok('★ Track 탭 링크를 눌러 전환한다 (지도 크기 보정을 그 핸들러가 한다)',
   /querySelector\('\.nav-tabs \.nav-link\[href="#tab-track"\]'\)/.test(code));
ok('★★ 탭이 보이게 된 뒤에 그린다 (숨은 상태로 그리면 지도 좌표가 어긋난다)',
   /setTimeout\(function \(\) \{\s*try \{ renderSegmentStepper/.test(code));
ok('★ 실패해도 스택을 남긴다', /\[v2 §568\] segment jump/.test(code));
ok('★ 그 자리로 스크롤한다', /scrollIntoView\(\{ block: 'center'/.test(code));
ok('스테퍼 호스트 id 가 실제로 존재한다',
   fs.readFileSync(path.join(__dirname,'v2.html'),'utf8').indexOf('id="segment-stepper"')>=0);

console.log('\n[4] ★ 임계가 무엇인지 밝힌다 (포일링과 같은 걸 두 번 보여주는 것처럼 보인다)');
ok('★ 누를 수 있음을 본문에도 적는다', /click a row to see that stretch on the map/.test(code));
ok('★★ 이 임계가 상대 기준임을 밝힌다', /90th-percentile speed/.test(code));
ok('★★ 포일링 임계는 고정값임을 대비시킨다',
   /cut\s*'\s*\+\s*'at a fixed speed/.test(code) || /at a fixed speed/.test(code));
ok('오늘의 실제 임계값을 적는다', /thrKtRun\.toFixed\(1\) \+ ' kt today'/.test(code));

console.log('\n[5] 실제 정의 확인 — 상대 기준이 맞는가');
var an=fs.readFileSync(path.join(__dirname,'js/analysis.js'),'utf8');
ok('★★ runs 임계 = p90 × ratio 와 하한 중 큰 값',
   /var p90 = Geo\.percentile\(speeds, 90\)/.test(an)
   && /var thrMs = Math\.max\(p90 \* cfg\.runThresholdRatio/.test(an));
ok('★ 포일링 임계는 고정 (cfg 값 또는 11)',
   /cfg\.activeSpeedKt \|\| cfg\.foilingSpeedKt \|\| 11/.test(code));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
