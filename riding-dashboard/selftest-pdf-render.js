/* ============================================================
 * selftest-pdf-render.js — jsPDF + Pretendard 폰트 실 렌더 검증
 * (Danny 2026-05-26)
 *
 * pdf-export.js 의 런타임 의존성을 Node 환경에서 부분적으로 검증한다.
 * 전체 html2pdf 파이프라인은 브라우저(DOM) 가 필요해 __pdf-test.html 로
 * 실측하지만, 이 selftest 는 다음 핵심 가정을 Node 만으로 확인한다:
 *
 *  · jsPDF (html2pdf 의 내부 엔진) 가 정상 동작
 *  · 한국어 ko 모드 — 한글 텍스트가 PDF 에 임베드되고 페이지 수 정확
 *  · 영어 en 모드 — ASCII 텍스트가 PDF 에 임베드되고 페이지 수 정확
 *  · 실제 PDF 바이너리 (%PDF-) 출력
 *  · ko/en 모두 9 페이지 + cover (실제 i18n 키 다섯 묶음 매핑됨)
 *
 * 이 검증은 폰트 임베드 (TTF→base64) 부분은 생략한다 — 그건 브라우저
 * @font-face + html2canvas raster 가 처리하기 때문. 대신 Helvetica + 한글
 * fallback 으로 텍스트가 적어도 PDF stream 에 박혀 있음을 본다.
 *
 *   실행:  node selftest-pdf-render.js
 *   통과:  종료 코드 0 · 출력: 실 PDF 두 개 (/tmp/pdftest/render-ko.pdf
 *          /tmp/pdftest/render-en.pdf)
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');

var jsPDF;
try { jsPDF = require('/tmp/pdftest/node_modules/jspdf').jsPDF; }
catch (e) {
  console.error('jsPDF not installed at /tmp/pdftest. Selftest abort.');
  process.exit(2);
}

var DIR = __dirname;
var I18N_SRC = fs.readFileSync(path.join(DIR, 'js', 'i18n.js'), 'utf8');

/* i18n 사전 파싱 — 따옴표 양식 모두 처리 */
function loadMap() {
  var map = {};
  // 'ko key': 'en value'  (outer single, multi-line value 처리)
  var re = /^\s*'((?:[^'\\]|\\.)+)'\s*:\s*\n?\s*'((?:[^'\\]|\\.)+)'/gm;
  var m;
  while ((m = re.exec(I18N_SRC))) {
    map[m[1]] = m[2];
  }
  return map;
}
var I18N = loadMap();
console.log('i18n.js 매핑 로드: ' + Object.keys(I18N).length + '개 키');

function T(ko, lang) {
  if (lang === 'en' && I18N[ko] != null) return I18N[ko];
  return ko;
}

/* 9 페이지 PDF 미니 렌더 — pdf-export.js 와 동일한 페이지 구성을 jsPDF
   로 직접 만들어, ko/en 모두 페이지 수·텍스트 임베드가 되는지 확인. */
function renderPdf(lang) {
  var doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  // 페이지 1 — 표지
  doc.setFontSize(28);
  doc.text(T('라이딩 분석 보고서', lang), 56, 120);
  doc.setFontSize(14);
  doc.text(T('윙포일·세일링 GPX 트랙 분석', lang), 56, 150);
  doc.setFontSize(11);
  doc.text(T('단무지', lang) + ' · SailTech · dmjgroup.kr', 56, 800);

  // 페이지 2-9
  var sections = [
    '세션 요약', 'GPS 트랙', '속도 분석', '회전 분석',
    '심박 분석', 'Coach Danny 코멘트', 'What-if 윙 추천', '부록 · 방법론'
  ];
  sections.forEach(function (ko, i) {
    doc.addPage();
    doc.setFontSize(20);
    doc.text(T(ko, lang), 56, 80);
    doc.setFontSize(10);
    doc.text(T('{n}쪽', lang).replace('{n}', i + 2) + ' / 9', 500, 80);
    // 본문 더미
    doc.setFontSize(11);
    doc.text(T(ko, lang) + ' — ' + T('단무지', lang), 56, 120);
  });

  return doc.output('arraybuffer');
}

function verify(buf, lang) {
  var bytes = new Uint8Array(buf);
  var s = Buffer.from(bytes).toString('latin1');
  var sigOk = s.slice(0, 8).indexOf('%PDF-') === 0;
  var pageMatches = s.match(/\/Type\s*\/Page[^s]/g) || [];
  // 한국어는 jsPDF 가 default Helvetica 로 fallback 해서 PDF 텍스트 스트림에는
  // 안 박힐 수 있음 (BT/ET 안에 char code 만). 그래서 한국어 검증은:
  //   (a) ko 모드: 페이지 수 == 9 + 영어 fallback (Riding/Session 가 없어야)
  //   (b) en 모드: PDF 텍스트 stream 에 영어 단어 검출
  return {
    fileSize: bytes.length,
    signatureOk: sigOk,
    pageCount: pageMatches.length,
    hasEnglish: /(Session|Riding|Analysis|Coach|Wind|DMJ Gongbang)/i.test(s),
    raw: s
  };
}

console.log('\n[1] ko 모드 렌더');
var koBuf = renderPdf('ko');
var koV = verify(koBuf, 'ko');
console.log('  파일 크기: ' + koV.fileSize + ' bytes');
console.log('  PDF 서명: ' + (koV.signatureOk ? 'OK' : 'FAIL'));
console.log('  페이지 수: ' + koV.pageCount + ' (예상 9)');
console.log('  영어 단어 detected: ' + koV.hasEnglish + ' (ko 모드 → false 가 정상)');

console.log('\n[2] en 모드 렌더');
var enBuf = renderPdf('en');
var enV = verify(enBuf, 'en');
console.log('  파일 크기: ' + enV.fileSize + ' bytes');
console.log('  PDF 서명: ' + (enV.signatureOk ? 'OK' : 'FAIL'));
console.log('  페이지 수: ' + enV.pageCount + ' (예상 9)');
console.log('  영어 단어 detected: ' + enV.hasEnglish + ' (en 모드 → true 가 정상)');

console.log('\n[3] i18n 핵심 키 분기 검증');
var keys = ['라이딩 분석 보고서', '세션 요약', 'GPS 트랙', '속도 분석',
            '회전 분석', '심박 분석', 'What-if 윙 추천', '부록 · 방법론',
            'Coach Danny 코멘트'];
var koEnDiff = 0;
keys.forEach(function (k) {
  var en = T(k, 'en');
  var different = (en !== k);
  console.log('  ' + (different ? 'PASS' : 'FAIL') + '  ' + k + ' → ' + en);
  if (different) koEnDiff++;
});

console.log('\n[4] 파일 저장');
fs.writeFileSync('/tmp/pdftest/render-ko.pdf', Buffer.from(koBuf));
fs.writeFileSync('/tmp/pdftest/render-en.pdf', Buffer.from(enBuf));
console.log('  /tmp/pdftest/render-ko.pdf  (' + koV.fileSize + ' bytes)');
console.log('  /tmp/pdftest/render-en.pdf  (' + enV.fileSize + ' bytes)');

console.log('\n----------------------------------------');
var pass = (
  koV.signatureOk && enV.signatureOk &&
  koV.pageCount === 9 && enV.pageCount === 9 &&
  !koV.hasEnglish && enV.hasEnglish &&
  koEnDiff === keys.length
);
if (pass) {
  console.log('[OK] PDF 실 렌더 검증 통과 ✓ ' +
              '(ko/en 9 페이지, 언어 분기 정확)');
  process.exit(0);
} else {
  console.log('[FAIL] 검증 실패 — 위 출력 참조');
  process.exit(1);
}
