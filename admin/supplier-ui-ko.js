(function(root){'use strict';
const status={draft:'작성 중',ready:'작성 완료',planned:'주문 예정',undelivered:'미배송',shipped:'배송 중',received:'수령 완료',cancelled:'취소'};
const group={undelivered:'기존 주문·미배송',additional:'추가 주문'};
const notes={
 'Paid amount from source; currency and quantity not specified.':'원본의 금액은 이미 지불한 금액입니다. 통화와 수량은 미확인입니다.',
 'Quantity not specified in source.':'원본에 수량이 기재되지 않았습니다.',
 'Quantity explicitly stated in source.':'원본에 명시된 수량입니다.',
 'One unit requested. Size and supplier cost not specified; displayed retail price is not used as order cost.':'각 1개 추가 요청입니다. 규격과 공급가격은 미확인이며 화면의 소매가격은 주문 비용에 반영하지 않았습니다.'
};
function note(row){if(row.notes_ko)return row.notes_ko;const m=(row.notes||'').match(/^Selected screenshot options: Board (\d+), Front Wing (\d+), Mast (\d+)\. Units and quantity not specified\. Displayed retail price is not used as supplier order cost\.$/);if(m)return '이미지 선택 규격: 보드 '+m[1]+' / 프런트 윙 '+m[2]+' / 마스트 '+m[3]+'. 단위·수량은 미확인이며 소매가격은 주문 비용에 반영하지 않았습니다.';return notes[row.notes]||row.notes||''}
function name(list){if(list.name_ko)return list.name_ko;const m=list.name.match(/^Supplier order list - (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/);return m?'공급사 주문 목록 - '+m[2]+'년 '+(['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(m[1])+1)+'월':list.name}
function spec(value){return String(value||'').replace(/^Board (\d+) \/ Front wing (\d+) \/ Mast (\d+)$/,(_,b,w,m)=>'보드 '+b+' / 프런트 윙 '+w+' / 마스트 '+m)}
function needsReview(row){return !!row.notes_ko?.trim()&&(!row.notes?.trim()||row.notes_english_confirmed!==true)}
const api={status,group,note,name,spec,needsReview};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DMJSupplierUI=api;
})(typeof window==='undefined'?globalThis:window);
