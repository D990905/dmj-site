(() => {
'use strict';
const host=document.getElementById('inquiry-contact-panel');if(!host)return;
const select=host.querySelector('select'),name=host.querySelector('[data-contact-name]'),phone=host.querySelector('[data-contact-phone]'),reply=host.querySelector('textarea'),status=host.querySelector('[role=status]'),view=host.querySelector('[data-contact-view]'),save=host.querySelector('[data-contact-save]');
let client=null,owner=null,generation=0,loaded=null;
const backendReady=true; // Approved private contact API; server verifies ops administrator for every request.
function clear(){generation++;loaded=null;name.textContent=phone.textContent='';reply.value='';status.textContent='';save.disabled=true}
function invalidate(){clear();client=null;owner=null;select.replaceChildren(new Option('관리자 연결 후 선택',''))}
window.addEventListener('dmj-auth-change',invalidate);window.addEventListener('dmj-ops-unavailable',invalidate);
window.addEventListener('dmj-ops-data',event=>{const d=event.detail;if(owner!==d.owner)clear();client=d.client;owner=d.owner;const previous=select.value;select.replaceChildren(new Option('상담 선택',''));for(const i of d.inquiries||[])select.add(new Option((i.product_id||'일반 상담')+' · '+i.id,i.id));select.value=previous;if(!select.value)clear()});
select.addEventListener('change',clear);
async function sameAccount(capturedOwner){const r=await client.auth.getUser();return !r.error&&r.data.user?.id===capturedOwner}
view.onclick=async()=>{clear();if(!client||!select.value)return;const id=select.value,g=generation,account=owner;
if(!backendReady){status.textContent='연락처 API 연결 준비 중입니다.';return}
view.disabled=true;try{if(!await sameAccount(account))throw Error();const r=await client.rpc('ops_inquiry_contact',{p_id:id});if(g!==generation)return;if(r.error||!await sameAccount(account))throw Error();if(g!==generation)return;const c=r.data?.[0];if(!c){status.textContent='별도 연락처가 저장되기 전의 문의입니다. 기존 문의는 그대로 보존됩니다.';return}name.textContent=c.callback_name;phone.textContent=c.callback_phone;reply.value=c.reply_note||'';loaded=id;save.disabled=false;status.textContent='관리자에게만 표시되는 상담 연락처입니다.'}catch(_){if(g===generation)status.textContent='연락처를 확인하지 못했습니다. 관리자 로그인을 확인해 주세요.'}finally{view.disabled=false}};
save.onclick=async()=>{if(!client||!loaded||loaded!==select.value||!reply.value.trim()||reply.value.length>2000)return;const g=generation,account=owner;save.disabled=true;try{if(!await sameAccount(account))throw Error();const r=await client.rpc('ops_record_inquiry_reply',{p_id:loaded,p_reply:reply.value.trim()});if(g!==generation)return;if(r.error||!await sameAccount(account))throw Error();if(g===generation)status.textContent='회신 내용을 기록했습니다. 외부 메시지는 발송하지 않았습니다.'}catch(_){if(g===generation)status.textContent='회신 기록을 저장하지 못했습니다. 내용을 확인하고 다시 시도해 주세요.'}finally{if(g===generation)save.disabled=!loaded}};
})();
