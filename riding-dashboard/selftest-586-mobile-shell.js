/* §586 모바일 셸 (옥대표 "우선 모바일 버전으로 앱 느낌으로 현재버젼을 재구성")

   이 테스트가 지키는 두 가지:
   (1) 데스크톱은 한 픽셀도 안 변한다 — mobile.css 의 모든 규칙이 정말
       미디어쿼리 안에 있는지 파서로 센다. "문자열이 있더라" 가 아니라
       중괄호 깊이를 세서 밖으로 샌 규칙을 잡는다.
   (2) 실제로 접히는가 — §586b 에서 최상위 카드 판정이 전부 실패해
       접힌 카드가 0개였다. 그 판정 로직을 가짜 트리에 돌려 본다.
*/
var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(n, c, e) { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? '  ' + e : '')); } }

var css = fs.readFileSync(path.join(__dirname, 'css/mobile.css'), 'utf8');
var js  = fs.readFileSync(path.join(__dirname, 'js/mobile-shell.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, 'v2.html'), 'utf8');

/* ── [1] 데스크톱 불가침 ─────────────────────────────────── */
console.log('[1] 데스크톱은 한 줄도 안 바뀐다');

/* 주석을 지우고 중괄호 깊이를 세면서, 깊이 0 에서 시작하는 선택자가
   @media 가 아니면 그건 전역 규칙이다 = 데스크톱 오염. */
function strayGlobalRules(src) {
  var s = src.replace(/\/\*[\s\S]*?\*\//g, '');
  var stray = [], depth = 0, buf = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (ch === '{') {
      if (depth === 0) {
        var sel = buf.trim().replace(/\s+/g, ' ');
        if (sel && !/^@media/.test(sel)) stray.push(sel.slice(0, 60));
      }
      depth++; buf = '';
    } else if (ch === '}') { depth--; buf = ''; }
    else buf += ch;
  }
  return { stray: stray, balanced: depth === 0 };
}
var sg = strayGlobalRules(css);
ok('★★ 미디어쿼리 밖에 있는 규칙이 하나도 없다', sg.stray.length === 0, sg.stray.join(' | '));
ok('★ 중괄호가 맞는다 (파서가 신뢰할 만하다)', sg.balanced);

/* 미디어쿼리 자체도 제한 범위여야 한다 */
var medias = (css.match(/@media[^{]+/g) || []).map(function (m) { return m.replace(/@media\s*/, '').trim(); });
ok('★★ 미디어쿼리는 max-width:768px 와 min-width:769px 둘뿐',
   medias.length > 0 && medias.every(function (m) {
     return /max-width:\s*768px/.test(m) || /min-width:\s*769px/.test(m);
   }), medias.join(' | '));
ok('★ 769px 이상에서는 셸 요소를 아예 숨긴다',
   /min-width:\s*769px[\s\S]{0,600}\.rdm-appbar[\s\S]{0,300}display:\s*none/.test(css));

/* JS 쪽도: 모든 변형이 body.rdm / MQ 뒤에 있어야 한다 */
ok('★★ 셸은 matchMedia 로만 켜진다',
   /matchMedia\('\(max-width: 768px\)'\)/.test(js));
ok('★★ 넓어지면 되돌린다 (change 를 듣는다)',
   /MQ\.addEventListener\('change', apply\)/.test(js) && /MQ\.addListener\(apply\)/.test(js));

/* deactivate 가 activate 의 흔적을 전부 지우는가 — 짝 맞추기 */
var act = js.slice(js.indexOf('function activate()'), js.indexOf('function onShown'));
var deact = js.slice(js.indexOf('function deactivate()'), js.indexOf('function apply()'));
[['body.rdm 클래스', "classList.add('rdm')", "classList.remove('rdm')"],
 ['MutationObserver', 'mo.observe(', 'mo.disconnect()']].forEach(function (t) {
  ok('★ ' + t[0] + ' 은 켤 때와 끌 때가 짝이다',
     act.indexOf(t[1]) >= 0 && deact.indexOf(t[2]) >= 0);
});
['appbar', 'tabbar', 'sheet', 'back'].forEach(function (k) {
  ok('★ 만든 노드 ' + k + ' 를 끌 때 지운다', /\['appbar', 'tabbar', 'sheet', 'back'\]/.test(deact));
});
ok('★★ 접기 장식(.rdm-fold)도 끌 때 벗긴다',
   /\$\$\('\.rdm-fold'\)[\s\S]{0,220}classList\.remove\('rdm-fold'\)/.test(deact));
ok('★ 옮겨 온 원본 노드를 제자리로 되돌린다 (select · 계정칩)',
   /restoreMoved\(\)/.test(deact) && /insertBefore\(m\[0\], m\[2\]\)/.test(js));

/* ── [2] 최상위 카드 판정 (§586b 의 진짜 버그) ───────────── */
console.log('\n[2] 최상위 카드 판정 — 탭 자체가 .card 안에 있다');

ok('★★ closest(".card") 를 그대로 쓰지 않는다 (전부 중첩으로 잡힌다)',
   !/return !c\.parentElement\.closest\('\.card'\)/.test(js));
ok('★★ 판정이 pane 에서 멈춘다', /while \(p && p !== pane\)/.test(js));

/* 실제로 돌려 본다 — 가짜 트리 */
function node(cls, parent) {
  var n = { classList: { contains: function (c) { return (cls || '').split(' ').indexOf(c) >= 0; } },
            parentElement: parent || null };
  return n;
}
var isTopCard = (function () {
  /* 소스에서 그대로 떼어 와 실행한다 — 설명이 아니라 코드를 검사한다 */
  var m = js.match(/function isTopCard\(card, pane\) \{[\s\S]*?\n  \}/);
  if (!m) return null;
  return eval('(' + m[0] + ')');
})();
ok('★ isTopCard 를 소스에서 떼어 낼 수 있다', !!isTopCard);
if (isTopCard) {
  var pane = node('tab-pane');
  var tabWrapCard = node('card', null);        // 탭을 감싼 .card.mt-3 — pane 의 조상
  pane.parentElement = node('card-body', tabWrapCard);
  var top = node('card', node('col-12', node('row', pane)));
  var nested = node('card', node('card-body', top));
  ok('★★ pane 위의 탭 카드는 중첩으로 치지 않는다', isTopCard(top, pane) === true);
  ok('★★ 카드 안의 카드는 중첩이다', isTopCard(nested, pane) === false);
  ok('★ pane 직계 카드도 최상위다', isTopCard(node('card', pane), pane) === true);
}

/* ── [3] 첫 카드 펼침 (§586c) ────────────────────────────── */
console.log('\n[3] 펼쳐진 카드가 0개이던 것');
ok('★★ 순번을 접을 수 있는 카드로만 센다', /var ord = nFold\+\+;/.test(js));
ok('★★ 펼침 판정에 전체 인덱스 i 를 쓰지 않는다',
   /remembered === undefined\) \? \(ord === 0\)/.test(js) && !/\? \(i === 0\)/.test(js));
ok('★ 사용자가 접고 편 상태는 재렌더 후에도 기억한다',
   /foldState\[card\.getAttribute\('data-foldkey'\)\] = nowOpen/.test(js)
   && /var remembered = foldState\[key\]/.test(js));

/* ── [4] 차트가 폭 0 으로 태어나지 않게 ──────────────────── */
console.log('\n[4] 접힌 카드 안의 차트·지도');
ok('★★ 카드를 display:none 으로 접지 않는다 (폭이 죽으면 uPlot 이 0px)',
   /\.rdm-fold\[data-open="0"\] > \.card-body,/.test(css)
   && !/\.rdm-fold\[data-open="0"\] \{[^}]*display:\s*none/.test(css));
ok('★★ 펼칠 때 resize 를 쏜다 (Leaflet 이 높이를 다시 잰다)',
   /if \(nowOpen\) setTimeout\(function \(\) \{ window\.dispatchEvent\(new Event\('resize'\)\); \}/.test(js));
ok('★ 탭을 바꿀 때도 쏜다', /gotoTab[\s\S]{0,400}dispatchEvent\(new Event\('resize'\)\)/.test(js));

/* ── [5] 가로 스크롤 (§586c·d 실측 원인 세 가지) ─────────── */
console.log('\n[5] 폰에서 옆으로 밀리던 것');
ok('★★ 카드 머리의 필터 단추를 아랫줄로 내린다 (헤더 564·612px)',
   /\.rdm-fold > \.card-header > \.card-actions \{[\s\S]{0,160}flex:\s*1 1 100%/.test(css));
ok('★★ .row 의 음수 가로 여백을 없앤다 (355 vs 351)',
   /body\.rdm \.tab-pane \.row \{[^}]*--tblr-gutter-x:\s*0/.test(css));
ok('★★ 카드 직계 자식에 min-width:0 (폴라 flex 아이템 405px)',
   /body\.rdm \.tab-pane \.card-body > \*,[\s\S]{0,80}min-width:\s*0/.test(css));

/* ── [6] 손가락 · 안전영역 ───────────────────────────────── */
console.log('\n[6] 손으로 쓸 수 있는가');
ok('★★ 아이콘 버튼이 44px (애플 최소 권장)',
   /\.rdm-iconbtn \{[\s\S]{0,140}width:\s*44px;\s*height:\s*44px/.test(css));
ok('★ 하단 탭바 항목 56px', /\.rdm-tabbar__item \{[\s\S]{0,300}height:\s*56px/.test(css));
ok('★ 시트 항목 48px', /\.rdm-sheet__row \{[\s\S]{0,200}min-height:\s*48px/.test(css));
ok('★ 접힌 입력줄 44px', /\.rdm-inputs__sum \{[\s\S]{0,140}min-height:\s*44px/.test(css));
ok('★★ 홈 인디케이터를 피한다 (safe-area, 세 곳)',
   (css.match(/env\(safe-area-inset-bottom/g) || []).length >= 3);
ok('★★ 하단 탭바가 내용을 가리지 않는다',
   /body\.rdm \.page-body \{[\s\S]{0,120}padding-bottom:\s*calc\(72px \+ env\(safe-area-inset-bottom/.test(css));
ok('★ 노치를 피한다 (상단 safe-area)', /padding-top:\s*env\(safe-area-inset-top/.test(css));

/* ── [7] 배선 ────────────────────────────────────────────── */
console.log('\n[7] 배선 — 엔진 있고 소비자 없음을 막는다');
ok('★★ v2.html 이 CSS 를 읽는다', /css\/mobile\.css\?v=/.test(html));
ok('★★ v2.html 이 셸을 읽는다', /js\/mobile-shell\.js\?v=/.test(html));
ok('★★ 셸이 v2-app 보다 뒤에 온다 (v2-app 이 그린 걸 장식한다)',
   html.indexOf('js/mobile-shell.js') > html.indexOf('js/v2-app.js'));
ok('★ 캐시버스트가 붙어 있다 (재방문자가 옛 파일을 안 받게)',
   /mobile\.css\?v=v586[a-z]?/.test(html) && /mobile-shell\.js\?v=v586[a-z]?/.test(html));

/* 하단 탭바에 없는 탭은 More 시트에서 반드시 닿아야 한다 */
var tabsInHtml = (html.match(/href="(#tab-[a-z]+)"/g) || [])
  .map(function (m) { return m.slice(6, -1); })
  .filter(function (v, i, a) { return a.indexOf(v) === i; });
var meta = (js.match(/'(#tab-[a-z]+)':\s*\{/g) || []).map(function (m) { return m.slice(1, m.indexOf("'", 1)); });
ok('★★ 탭 9개가 모두 TABMETA 에 있다 (하나라도 빠지면 More 에서 이름이 깨진다)',
   tabsInHtml.length > 0 && tabsInHtml.every(function (t) { return meta.indexOf(t) >= 0; }),
   'html=' + tabsInHtml.length + ' meta=' + meta.length + ' missing=' +
   tabsInHtml.filter(function (t) { return meta.indexOf(t) < 0; }).join(','));
ok('★★ More 시트는 TABMETA 가 아니라 실제 탭 링크를 훑는다 (탭이 늘어도 샌다)',
   /function sheetTabs\(\)[\s\S]{0,400}tabLinks\(\)\.forEach/.test(js));
ok('★ 하단바 5칸: 주요 4 + More', /grid-template-columns:\s*repeat\(5, 1fr\)/.test(css)
   && (js.match(/var PRIMARY = \[[^\]]*\]/) || [''])[0].split('#tab-').length - 1 === 4);

/* 동작은 원본 버튼을 눌러야 한다 — 복제하면 배선이 갈라진다 */
console.log('\n[8] 동작 버튼은 원본을 대신 누른다');
var actSel = (js.match(/var ACT_SEL = \{[\s\S]*?\};/) || [''])[0];
['#v2-file', '#btn-replay', '#btn-save', '#btn-pdf', '#btn-export-csv', '#btn-export-gpx'].forEach(function (s) {
  ok('★ ' + s + ' 가 v2.html 에 실제로 있다', html.indexOf('id="' + s.slice(1) + '"') >= 0);
  ok('★ ' + s + ' 를 시트가 가리킨다', actSel.indexOf(s) >= 0);
});
ok('★★ 로직을 복제하지 않고 click() 으로 넘긴다', /closeSheet\(\);\s*\n\s*el\.click\(\);/.test(js));
ok('★ 대상이 없으면 조용히 죽지 않고 알린다 (§546 교훈)',
   /console\.warn\('\[RDMobile\] action target missing:'/.test(js));
ok('★ 탭 링크가 없을 때도 알린다', /console\.warn\('\[RDMobile\] no tab link for'/.test(js));

/* ── [9] 눈금 겹침 (§586g) — 실제로 돌려 본다 ─────────────── */
console.log('\n[9] Best speed by duration 가로축 — 30 s1 min2 min');
var mm = fs.readFileSync(path.join(__dirname, 'js/chart-meanmax.js'), 'utf8');
var tl = mm.match(/function tickLabel\(t\) \{[\s\S]*?\n  \}/);
var fl = mm.match(/filter: function \(self, splits\) \{[\s\S]*?\n          \},/);
ok('★ tickLabel · filter 를 소스에서 떼어 낼 수 있다', !!(tl && fl));
if (tl && fl) {
  var tickLabel = eval('(' + tl[0] + ')');
  var filterFn = eval('({' + fl[0].replace(/,\s*$/, '') + '})').filter;
  /* 로그축 px 흉내: 실측 세션 범위 2 s … 120 s, 0.8 / 1.25 패딩 */
  function fakeSelf(plotW) {
    var lo = Math.log10(2 * 0.8), hi = Math.log10(120 * 1.25);
    return { valToPos: function (t) { return (Math.log10(t) - lo) / (hi - lo) * plotW; } };
  }
  var SPL = [2, 5, 10, 30, 60, 120];
  function labelsAt(w) {
    var f = filterFn.call(null, fakeSelf(w), SPL);
    return f.filter(function (t) { return t != null; });
  }
  function gaps(w, kept) {
    var s = fakeSelf(w), out = [];
    for (var i = 1; i < kept.length; i++) {
      var a = kept[i - 1], b = kept[i];
      out.push(s.valToPos(b) - s.valToPos(a) - (tickLabel(a).length + tickLabel(b).length) * 6.8 / 2);
    }
    return out;
  }
  var phone = labelsAt(235), desk = labelsAt(620);
  ok('★★ 폰 폭(235px)에서 남은 라벨끼리 겹치지 않는다',
     gaps(235, phone).every(function (g) { return g >= 8; }),
     'kept=' + phone.join(',') + ' gaps=' + gaps(235, phone).map(function (g) { return g.toFixed(0); }).join(','));
  ok('★★ 폰에서 1 min 은 살아남는다 (가장 읽히는 기준)', phone.indexOf(60) >= 0, phone.join(','));
  ok('★ 폰에서 10 s 도 살아남는다', phone.indexOf(10) >= 0, phone.join(','));
  ok('★★ 데스크톱 폭(620px)에서는 하나도 빠지지 않는다 (데스크톱 불변)',
     desk.length === SPL.length, desk.join(','));
  ok('★ 이전 동작 재현: 필터 없이 폰 폭이면 실제로 겹쳤다 (테스트가 헛돌지 않는다)',
     gaps(235, SPL).some(function (g) { return g < 8; }));
}

/* ── [10] 끄기 실패에 대한 이중 안전장치 (§586h) ─────────── */
console.log('\n[10] 넓혔는데 셸이 남던 것 (1280px 에서 on=true)');
ok('★★ resize 에서도 breakpoint 를 다시 본다',
   /window\.addEventListener\('resize', function \(\) \{[\s\S]{0,80}setTimeout\(apply, 150\)/.test(js));
ok('★ apply 는 같은 상태면 아무것도 안 한다 (여러 번 불려도 무해)',
   /function activate\(\) \{\s*\n\s*if \(on\) return;/.test(js)
   && /function deactivate\(\) \{\s*\n\s*if \(!on\) return;/.test(js));
var desk = (css.match(/@media \(min-width: 769px\) \{([\s\S]*?)\n\}/) || ['', ''])[1];
['.rdm-appbar', '.rdm-tabbar', '.rdm-sheet', '.rdm-sheet-back', '.rdm-chev', '.rdm-inputs__sum', '.rdm-scrollhint']
  .forEach(function (c) {
    ok('★★ 데스크톱에서 ' + c + ' 는 CSS 로도 숨는다 (JS 가 못 꺼도)',
       desk.indexOf(c) >= 0 && /display:\s*none !important/.test(desk));
  });
/* 셸이 만드는 클래스는 전부 위 목록이나 body.rdm 범위 안에 있어야 한다 */
var made = (js.match(/className = '(rdm-[a-z_-]+)'/g) || [])
  .map(function (m) { return m.slice(13, -1); })
  .filter(function (v, i, a) { return a.indexOf(v) === i; });
ok('★★ 셸이 만드는 요소 클래스는 전부 데스크톱에서 숨는다',
   made.length > 0 && made.every(function (c) { return desk.indexOf('.' + c) >= 0; }),
   'made=' + made.join(',') + ' 누락=' + made.filter(function (c) { return desk.indexOf('.' + c) < 0; }).join(','));
ok('★★ 크기 없는 SVG 가 부풀지 않게 화살표에 기본 크기 (1086px 실측)',
   /\.rdm-chev svg \{ width: 18px; height: 18px; \}/.test(css));

/* ── [11] 로그인 (§586k 옥대표 "로그인창이 없는듯") ────────── */
console.log('\n[11] 폰에서 로그인이 보이는가');
var app2 = fs.readFileSync(path.join(__dirname, 'js/v2-app.js'), 'utf8');
ok('★★ 앱바에 계정 버튼이 있다', /id="rdm-account"/.test(js) && /#rdm-account', bar\)\.addEventListener\('click', onAccount\)/.test(js));
ok('★★ 로그인 전이면 v2-app 이 만든 로그인 링크로 곧장 간다 (주소를 따로 만들지 않음)',
   /var a = \$\('#auth-chip a\[href\]'\);\s*\n\s*if \(a\) \{ location\.href = a\.getAttribute\('href'\); return; \}/.test(js)
   && !/login\.html/.test(js));
ok('★ 링크가 없으면(서버 멈춤) 시트를 열어 이유를 보여 준다', /function onAccount\(\) \{[\s\S]{0,260}openSheet\('actions'\);/.test(js));
ok('★ 로그인 상태가 바뀌면 점을 갱신한다 (#auth-chip 관찰)', /els\.chipObs\.observe\(chip/.test(js));
ok('★ 끌 때 관찰도 끊는다', /if \(els\.chipObs\) els\.chipObs\.disconnect\(\);/.test(js));
ok('★★ 시트에서 계정이 맨 위에, 이름표를 달고', (function () {
  var i = js.indexOf('function sheetActions()'); var seg = js.slice(i, i + 700);
  return seg.indexOf("ACCOUNT") > 0 && seg.indexOf('rdm-slot-auth') < seg.indexOf('SESSION'); })());
ok('★ 계정 슬롯은 한 번만 만든다 (예전 APP 아래 슬롯 제거)', (js.match(/id="rdm-slot-auth"/g) || []).length === 1);
ok('★ 계정 버튼도 44px (rdm-iconbtn)', /class="rdm-iconbtn rdm-acct"/.test(js));

console.log('\n[12] 거짓말 하지 않기 — v2 는 기기 간 동기화를 안 한다');
ok('★★ 전제 확인: v2.html 은 cloud-sync.js 를 싣지 않는다 (싣게 되면 이 문구들을 바꿀 것)',
   html.indexOf('cloud-sync.js') < 0);
ok('★★ "follow you to another browser or phone" 문구가 사라졌다',
   !/follow you to\s*'\s*\+\s*'another browser or phone|they follow you/.test(app2.replace(/\/\*[\s\S]*?\*\//g, '')));
ok('★★ 시트에 "이 기기에만 있다" 고 적는다', /Rides are kept on this device\./.test(js));

console.log('\n' + (fail ? 'FAIL' : 'PASS') + '  ' + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
