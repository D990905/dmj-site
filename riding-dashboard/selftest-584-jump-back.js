/* §584 구간을 지도에서 보고 돌아오기 (옥대표)
   "어딘지 알 수 있게 링크를 주면 클릭해서 해당 트랙으로 이동했다가
    돌아가기 버튼으로 다시 즉시 원위치로 돌아올 수 있게."

   문답은 "33:55–41:12 구간" 이라고만 말하고 그게 어디였는지는 안 보여 준다. */
var fs=require('fs'), path=require('path');
var pass=0, fail=0;
function ok(n,c,e){ if(c){pass++;console.log('  ok   '+n);} else {fail++;console.log('  FAIL '+n+(e?'  '+e:''));} }
var app=fs.readFileSync(path.join(__dirname,'js/v2-app.js'),'utf8');
var code=app.replace(/\/\*[\s\S]*?\*\//g,'');

console.log('[1] 시각 → 표본 인덱스');
ok('★ idxAtSec 가 있다', /function idxAtSec\(sec\)/.test(code));
ok('★★ 이진 탐색으로 실제 t 를 찾는다 (비율 계산이 아니다)',
   /while \(lo < hi\) \{[\s\S]{0,120}if \(S\[mid\]\.t < sec\) lo = mid \+ 1; else hi = mid;/.test(code));
ok('★ 범위 밖은 양 끝으로 물린다',
   /if \(sec <= S\[0\]\.t\) return 0;/.test(code) && /if \(sec >= S\[hi\]\.t\) return hi;/.test(code));
/* 로직 재현 — 기록 공백이 있는 불규칙 표본에서 맞는가 */
function idxAtSec(S, sec){ if(!S.length) return -1;
  var lo=0, hi=S.length-1;
  if(sec<=S[0].t) return 0; if(sec>=S[hi].t) return hi;
  while(lo<hi){ var mid=(lo+hi)>>1; if(S[mid].t<sec) lo=mid+1; else hi=mid; } return lo; }
var S=[0,1,2,3,10,11,12,50,51,52,120].map(function(t){return {t:t};});
ok('★★ 첫 번째 "그 시각 이상" 표본을 준다', idxAtSec(S,2.5)===3, String(idxAtSec(S,2.5)));
ok('★ 공백 뒤 값도 정확 (t=50 → 7)', idxAtSec(S,50)===7, String(idxAtSec(S,50)));
ok('★ 앞뒤 범위 밖', idxAtSec(S,-5)===0 && idxAtSec(S,999)===10);
ok('★★ 비율로 계산했다면 어긋났다 (t=50 → 4 ≠ 7)',
   Math.round(50/120*(S.length-1))!==7);
ok('빈 표본은 -1', idxAtSec([],10)===-1);

console.log('\n[2] 이동');
ok('★ showRangeOnTrack 가 있다', /function showRangeOnTrack\(fromSec, toSec, label\)/.test(code));
ok('★★ 떠나기 전에 돌아올 자리를 기억한다',
   /TRACK_RETURN = \{ tabHref: currentTabHref\(\), scrollY: window\.scrollY \|\| 0 \}/.test(code));
ok('★ Track 탭으로 전환', /nav-link\[href="#tab-track"\]/.test(code));
ok('★★ 탭이 보이게 된 뒤에 그린다 (숨은 채로 그리면 지도 좌표가 어긋난다)',
   /setTimeout\(function \(\) \{\s*try \{\s*highlightSegment\(\{ startIdx: a, endIdx: b \}\)/.test(code));
ok('★ 그 구간이 화면에 들어오게 지도를 맞춘다',
   /fitBounds\(L\.latLngBounds\(pts\), \{ padding: \[30, 30\] \}\)/.test(code));
ok('★ 구간이 뒤집혀 있으면 아무것도 안 한다',
   /if \(a < 0 \|\| b < 0 \|\| b <= a\) \{ TRACK_RETURN = null; return; \}/.test(code));
ok('★ 실패해도 스택을 남긴다', /\[v2 §584\] show range on track/.test(code));

console.log('\n[3] 돌아가기');
ok('★ 지도 위에 막대를 띄운다', /bar\.id = 'track-return'/.test(code));
ok('★ 어느 구간인지 적는다', /'Showing ' \+ label \+ ' on the map\.'/.test(code));
ok('★★ 왔던 탭으로 되돌린다', /nav-link\[href="' \+ r\.tabHref \+ '"\]/.test(code));
ok('★★ 스크롤 위치도 되돌린다', /window\.scrollTo\(\{ top: r\.scrollY/.test(code));
ok('★ 탭 전환 뒤에 스크롤한다 (먼저 하면 좌표가 안 맞는다)',
   /if \(link\) link\.click\(\);[\s\S]{0,220}setTimeout\(function \(\) \{ window\.scrollTo/.test(code));
ok('★ 돌아가면 강조를 지운다', /highlightSegment\(null\);/.test(code));
ok('★ 막대를 두 번 만들지 않는다',
   /var old = document\.getElementById\('track-return'\);[\s\S]{0,120}removeChild\(old\)/.test(code));

console.log('\n[4] 링크는 시각을 아는 질문에만');
ok('★ 버튼이 붙는다', /'Show on map'/.test(code));
ok('★★ fromSec·toSec 이 있고 순서가 맞을 때만',
   /if \(q\.fromSec != null && q\.toSec != null && q\.toSec > q\.fromSec\)/.test(code));
ok('★ 라벨에 구간을 적는다', /RDSessionQA\.fmtClock\(q\.fromSec\)/.test(code));
/* 배선 위치 */
function enclosing(needle){ var i=code.indexOf(needle); if(i<0) return null;
  var re=/\n  function (\w+)\(/g,m,last=null,head=code.slice(0,i);
  while((m=re.exec(head))) last=m[1]; return last; }
ok('★★ 문답 카드 안에서 부른다', enclosing('showRangeOnTrack(q.fromSec')==='renderSessionQA',
   String(enclosing('showRangeOnTrack(q.fromSec')));

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass+fail));
process.exit(fail ? 1 : 0);
