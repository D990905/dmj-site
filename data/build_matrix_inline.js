#!/usr/bin/env node
/* ==========================================================================
   단무지 — Matrix inline generator
   /site/data/build_matrix_inline.js
   사용법:  node site/data/build_matrix_inline.js
   입력  :  data/products.json + data/equipment_matrix.json (canonical SoT)
   출력  :  data/dmj-matrix-inline.js (file:// fallback bundle)

   매트릭스 페이지 (style/* level/* find-my-gear) 가 file:// 로 열렸을 때
   CORS 로 fetch 가 실패하면 matrix.js 가 dmj-matrix-inline.js 에서 데이터
   를 가져온다. products.json 또는 equipment_matrix.json 이 변경되면
   반드시 이 스크립트를 다시 실행해 dmj-matrix-inline.js 를 재생성할 것.
   정책 lock: DO_NOT_REVERT §175-B.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const dataDir = __dirname;
const productsPath = path.join(dataDir, 'products.json');
const matrixPath   = path.join(dataDir, 'equipment_matrix.json');
const outPath      = path.join(dataDir, 'dmj-matrix-inline.js');

const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
const matrix   = JSON.parse(fs.readFileSync(matrixPath,   'utf8'));
const today    = new Date().toISOString().slice(0, 10);

const body = `/* ==========================================================================
   단무지 — Matrix data inline fallback
   /site/data/dmj-matrix-inline.js
   GENERATED ${today} — DO NOT EDIT BY HAND.
   Single source of truth = data/products.json + data/equipment_matrix.json.
   매트릭스 페이지 (style/* level/* find-my-gear) 가 file:// 로 열렸을 때
   CORS 차단 으로 fetch 가 실패하면 matrix.js 가 이 파일의 내용으로 fallback.
   재생성 = node site/data/build_matrix_inline.js — products.json 또는
   equipment_matrix.json 변경 시 반드시 재생성.
   호환: window.DMJ_DATA_INLINE 도 동시에 노출 (agent-deny.js / 기존 콜러).
   정책 lock: DO_NOT_REVERT §175-B (matrix data file:// fallback 일원화).
   ========================================================================== */
(function () {
  "use strict";
  var PAYLOAD = {
    products: ${JSON.stringify(products)},
    matrix: ${JSON.stringify(matrix)},
    _meta: {
      generated: "${today}",
      source: "data/products.json + data/equipment_matrix.json",
      note: "Single source for file:// fallback + http(s) consistency check. Regenerate via node site/data/build_matrix_inline.js."
    }
  };
  window.DMJ_MATRIX_INLINE = PAYLOAD;
  // Backward-compat alias: agent-deny.js + matrix.js fallback historically
  // read window.DMJ_DATA_INLINE. Keep both names pointing at the same payload.
  if (!window.DMJ_DATA_INLINE) {
    window.DMJ_DATA_INLINE = { products: PAYLOAD.products, matrix: PAYLOAD.matrix };
  } else {
    if (!window.DMJ_DATA_INLINE.products) window.DMJ_DATA_INLINE.products = PAYLOAD.products;
    if (!window.DMJ_DATA_INLINE.matrix)   window.DMJ_DATA_INLINE.matrix   = PAYLOAD.matrix;
  }
})();
`;

fs.writeFileSync(outPath, body);
const sz = fs.statSync(outPath).size;
console.log(`WROTE ${path.relative(process.cwd(), outPath)}  size=${sz} bytes (${(sz/1024).toFixed(1)} KB)`);
