const fs=require('fs'),assert=require('node:assert/strict'),K=require('../admin/supplier-ui-ko.js'),X=require('../admin/supplier-export.js');
const list={name:'Supplier order list - November 2026',status:'draft'},row={list_group:'additional',model:'QA Model',size:'90',quantity:1,amount_paid:null,currency:null,planned_unit_cost:null,status:'planned',notes_ko:'수량과 통화 확인 필요',notes:'Quantity and currency require confirmation.',notes_english_confirmed:false};
assert.equal(K.status.planned,'주문 예정');assert.equal(K.group.additional,'추가 주문');assert.equal(K.name(list),'공급사 주문 목록 - 2026년 11월');assert.equal(K.note(row),row.notes_ko);assert(K.needsReview(row));
for(const f of ['xlsx','pdf','email'])assert.throws(()=>X[f](list,[row]),/English notes need review/);
row.notes_english_confirmed=true;assert(!K.needsReview(row));
const email=X.email(list,[row]);assert(email.includes('Quantity and currency require confirmation.'));assert(!/[\uac00-\ud7a3]/.test(email));assert(email.includes('QA Model'));
fs.mkdirSync('/tmp/dmj-order-qa',{recursive:true});fs.writeFileSync('/tmp/dmj-order-qa/localized.xlsx',X.xlsx(list,[row]));fs.writeFileSync('/tmp/dmj-order-qa/localized.pdf',X.pdf(list,[row]));
const html=fs.readFileSync('admin/supplier-orders.html','utf8');assert(html.includes('lang="ko"'));for(const s of ['품목 추가','이미 지불한 금액','이메일 미리보기','영문 메모'])assert(html.includes(s));
console.log('PASS Korean UI labels/status/notes; English-only XLSX/PDF/email; unreviewed translation blocked; model preserved');
