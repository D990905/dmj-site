/* ============================================================
 * selftest-pdf-export.js — PDF 보고서 생성 모듈 정적 검증
 * (Danny 2026-05-26)
 *
 * 환경 제약: 헤드리스 브라우저(puppeteer)·jsdom 모두 디스크 부족으로
 * 설치 불가. 따라서 이 selftest 는 *소스 기반 정적 분석* 만 수행한다.
 *   - 모든 페이지 빌더 함수 (build* / pageWithHead) 존재 확인
 *   - PDF 모듈이 호출하는 모든 T('한국어') 키가 i18n.js 사전에 매핑돼 있는지
 *   - index.html 에 PDF 버튼·script 태그 wiring 완료 여부
 *   - app.js 에 클릭 핸들러 결선 완료 여부
 *   - 9 / 8 페이지 분기 로직 정확성 (HR 유무)
 *   - 한국어 폰트 임베드 CDN URL 유효 형식
 *   - Web Share API 분기 코드 존재 여부
 *
 * 실 렌더 검증은 __pdf-test.html 을 브라우저로 열면 자동으로 ko/en 각
 * PDF 1회씩 생성·검증한다. CI 대상은 이 정적 분석.
 *
 *   실행:  node selftest-pdf-export.js
 *   통과:  종료 코드 0 · 실패: 종료 코드 1
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var DIR = __dirname;
var ROOT = {
  pdfModule: fs.readFileSync(path.join(DIR, 'js', 'pdf-export.js'), 'utf8'),
  i18n: fs.readFileSync(path.join(DIR, 'js', 'i18n.js'), 'utf8'),
  index: fs.readFileSync(path.join(DIR, 'index.html'), 'utf8'),
  app: fs.readFileSync(path.join(DIR, 'js', 'app.js'), 'utf8')
};

var pass = 0, fail = 0;
var failures = [];

function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else      { fail++; failures.push(name + (detail ? ' — ' + detail : ''));
              console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

console.log('\n[1] pdf-export.js 모듈 구조');

/* 페이지 빌더 함수들 — 9개 섹션이 모두 정의돼 있어야 한다 */
var builders = [
  'buildCover', 'buildSummary', 'buildMapPage', 'buildSpeedPage',
  'buildManeuverPage', 'buildHrPage', 'buildCoachPage',
  'buildWhatIfPage', 'buildAppendixPage', 'pageWithHead'
];
builders.forEach(function (fn) {
  check('builder defined: ' + fn,
    new RegExp('function\\s+' + fn + '\\s*\\(').test(ROOT.pdfModule));
});

/* 공개 API */
check('global.RDPdfExport export',
  /global\.RDPdfExport\s*=/.test(ROOT.pdfModule));
check('RDPdfExport.generate API',
  /generate\s*:\s*generate/.test(ROOT.pdfModule));
check('RDPdfExport.canShareFiles API',
  /canShareFiles\s*:\s*canShareFiles/.test(ROOT.pdfModule));
check('RDPdfExport._selftest API',
  /_selftest\s*:\s*selftest/.test(ROOT.pdfModule));

/* Lazy load 패턴 */
check('html2pdf CDN URL valid',
  /cdnjs\.cloudflare\.com\/ajax\/libs\/html2pdf\.js\/0\.10\.1\/html2pdf\.bundle\.min\.js/
    .test(ROOT.pdfModule));
check('Pretendard CDN URL valid',
  /jsdelivr\.net\/gh\/orioncactus\/pretendard@v1\.3\.9/.test(ROOT.pdfModule));
check('Lazy script injection',
  /document\.createElement\(['"]script['"]\)/.test(ROOT.pdfModule));
check('@font-face injection',
  /@font-face/.test(ROOT.pdfModule) &&
  /Pretendard/.test(ROOT.pdfModule));
check('document.fonts.ready awaited',
  /document\.fonts\.ready/.test(ROOT.pdfModule));
check('html2canvas onclone hook',
  /onclone\s*:\s*function/.test(ROOT.pdfModule) &&
  /font-family/.test(ROOT.pdfModule));

/* Web Share API 분기 */
check('navigator.canShare detection',
  /navigator\.canShare/.test(ROOT.pdfModule));
check('navigator.share({files}) called',
  /navigator\.share\s*\(/.test(ROOT.pdfModule) &&
  /files\s*:\s*\[/.test(ROOT.pdfModule));
check('Share abort handled',
  /AbortError/.test(ROOT.pdfModule));

/* 페이지 분기 (HR 유무) */
check('HR-conditional page counting',
  /includeHr\s*\?\s*9\s*:\s*8/.test(ROOT.pdfModule));
check('hasHr() function',
  /function\s+hasHr\s*\(/.test(ROOT.pdfModule));

/* 파일명 i18n 분기 */
check('Korean filename branch (라이딩보고서)',
  /라이딩보고서/.test(ROOT.pdfModule));
check('English filename branch (riding-report)',
  /riding-report/.test(ROOT.pdfModule));

/* ============================================================
 * [2] i18n 사전: PDF 모듈이 사용하는 모든 T('한국어') 가 매핑돼 있나
 * ============================================================ */
console.log('\n[2] i18n 사전 매핑');

/* T('...') 패턴 추출. JS string concat ('a' + 'b' + 'c') 도 한 키로 합쳐서
   추출 — 줄바꿈으로 분리된 부록 페이지의 긴 문장 대응. */
var koCalls = [];
/* 정규화: T( 다음에 ' + ' / "\n   " 같은 concat 토큰을 제거해 단일 리터럴로 만든다 */
var normalized = ROOT.pdfModule.replace(
  /(['"])\s*\+\s*\n?\s*\1/g, '');  // 'a' + 'b' -> 'ab'
var re = /T\(\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
var m;
while ((m = re.exec(normalized))) {
  var s = m[2];
  // 한국어 글자 포함된 것만 (영문만 들어가는 T()도 있을 수 있음)
  if (/[가-힣]/.test(s)) koCalls.push(s);
}
/* 중복 제거 */
var seen = {};
koCalls = koCalls.filter(function (k) {
  if (seen[k]) return false; seen[k] = 1; return true;
});

console.log('  추출된 한국어 T() 키: ' + koCalls.length + '개');

/* i18n.js 의 MAP 키를 추출. 키 안에 다른 종류 따옴표가 들어갈 수 있어
   ('foo "bar"' 등) — outer 가 ' 일 땐 inner "" 허용 / outer 가 " 일 땐 ''. */
var i18nKeys = {};
// outer single quote: 'key:' (inner " ok)
var mapReS = /^\s*'((?:[^'\\]|\\.)+)'\s*:/gm;
while ((m = mapReS.exec(ROOT.i18n))) { i18nKeys[m[1]] = 1; }
// outer double quote: "key": (inner ' ok)
var mapReD = /^\s*"((?:[^"\\]|\\.)+)"\s*:/gm;
while ((m = mapReD.exec(ROOT.i18n))) { i18nKeys[m[1]] = 1; }

console.log('  i18n.js MAP 키 총: ' + Object.keys(i18nKeys).length + '개');

var missing = [];
koCalls.forEach(function (k) { if (!i18nKeys[k]) missing.push(k); });

check('모든 PDF 모듈 T() 키가 i18n MAP 에 매핑됨',
  missing.length === 0,
  missing.length ? 'missing: ' + missing.slice(0, 5).join(' | ') +
    (missing.length > 5 ? ' (+' + (missing.length - 5) + ')' : '') : '');

/* ============================================================
 * [3] index.html UI 통합
 * ============================================================ */
console.log('\n[3] index.html UI 통합');

check('PDF 버튼 ID 존재', /id="pdf-export-btn"/.test(ROOT.index));
check('PDF 버튼 aria-label', /aria-label="PDF 보고서 다운로드"/.test(ROOT.index));
check('pdf-export.js script 태그',
  /<script[^>]*src=['"]js\/pdf-export\.js['"]\s*>/.test(ROOT.index));
check('script load order (after i18n)',
  ROOT.index.indexOf('js/i18n.js') < ROOT.index.indexOf('js/pdf-export.js'));

/* ============================================================
 * [4] app.js 이벤트 결선
 * ============================================================ */
console.log('\n[4] app.js 이벤트 결선');

check('pdf-export-btn 결선', /pdf-export-btn/.test(ROOT.app));
check('RDPdfExport.generate 호출',
  /RDPdfExport\.generate\s*\(/.test(ROOT.app));
check('canShareFiles 감지',
  /canShareFiles\s*\(\s*\)/.test(ROOT.app));
check('share 옵션 전달',
  /share\s*:\s*canShare/.test(ROOT.app));

/* ============================================================
 * [5] 보고서 메타데이터 / 페이지 헤더 일관성
 * ============================================================ */
console.log('\n[5] 보고서 구조 일관성');

/* 페이지 개수 가산 — pageNo++가 8회 호출되면 cover 1 + page 8 = 9 페이지 */
var pageNoMatches = (ROOT.pdfModule.match(/pageNo\+\+/g) || []).length;
check('pageNo++ 8회 (8 non-cover 페이지)', pageNoMatches === 8,
  'actual=' + pageNoMatches);

/* totalPages 분기 */
check('totalPages 8 또는 9 분기',
  /includeHr\s*\?\s*9\s*:\s*8/.test(ROOT.pdfModule));

/* PDF root 정리 */
check('cleanup() 정의', /function\s+cleanup\s*\(/.test(ROOT.pdfModule));
check('cleanup 호출 (성공)', /cleanup\(built\.root\)/.test(ROOT.pdfModule));
check('cleanup 호출 (실패)', /cleanup\(\$\(['"]rd-pdf-root['"]\)\)/.test(ROOT.pdfModule));

/* ============================================================
 * 결과 요약
 * ============================================================ */
console.log('\n----------------------------------------');
console.log('PASS: ' + pass + '  FAIL: ' + fail);
if (fail > 0) {
  console.log('\n실패 항목:');
  failures.forEach(function (f) { console.log('  · ' + f); });
  process.exit(1);
} else {
  console.log('\n[OK] PDF export 정적 검증 통과 ✓');
  console.log('실 렌더 검증은 __pdf-test.html 을 브라우저로 열어 자동 실행됩니다.');
  process.exit(0);
}
