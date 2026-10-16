(function(){'use strict';
const button=document.getElementById('save-inquiry'),status=document.getElementById('inquiry-save-status'),form=document.getElementById('inquiry-form');
if(!button||!form)return;let requestId=null,lastPayload='';
const draftKey='dmj_inquiry_draft_v1';
try{const draft=JSON.parse(sessionStorage.getItem(draftKey)||'null');if(draft&&Date.now()-draft.at<3600000){window.DMJInquiryDraftProduct={product:draft.product||'',size:draft.size||''};for(const name of ['product','size','experience','setup','note'])if(form.elements[name]&&(name!=='product'||[...form.elements.product.options].some(o=>o.value===(draft[name]||''))))form.elements[name].value=draft[name]||'';form.dispatchEvent(new Event('input',{bubbles:true}))}sessionStorage.removeItem(draftKey)}catch(e){}
// Contact values stay in memory; never overwrite the member profile or persist them in drafts.
const contactFields=['callback_name','callback_phone'];let contactOwner=null,contactGeneration=0;
const edited=new Set();for(const name of contactFields)form.elements[name].addEventListener('input',()=>edited.add(name));
async function prefillContact(){const generation=++contactGeneration;
 try{await DMJAuth._ensureClient();const sb=DMJAuth._supabase(),auth=await sb.auth.getUser();
 if(generation!==contactGeneration)return;if(auth.error&&auth.error.name!=='AuthSessionMissingError'&&auth.error.status!==401)return;const owner=auth.error?null:auth.data.user?.id;
 if(contactOwner&&contactOwner!==owner){for(const name of contactFields)form.elements[name].value='';edited.clear();requestId=null;lastPayload=''}
 contactOwner=owner||null;for(const name of contactFields)form.elements[name].disabled=!owner;document.getElementById('inquiry-login').hidden=!!owner;if(!owner)return;
 const profile=await DMJAuth._refreshProfile();const current=await sb.auth.getUser();
 if(generation!==contactGeneration||current.data.user?.id!==owner||profile?.id!==owner)return;
 for(const [name,value] of [['callback_name',profile.name],['callback_phone',profile.phone]])if(!edited.has(name)&&!form.elements[name].value)form.elements[name].value=String(value||'').slice(0,name==='callback_name'?80:24);
 }catch(_){} }
window.addEventListener('dmj-auth-change',prefillContact);prefillContact();
document.getElementById('inquiry-login')?.addEventListener('click',()=>{try{const draft={at:Date.now()};for(const name of ['product','size','experience','setup','note'])draft[name]=form.elements[name].value;sessionStorage.setItem(draftKey,JSON.stringify(draft))}catch(e){}});

button.addEventListener('click',async()=>{
 const fields=form.elements;
 fields.callback_name.setCustomValidity(fields.callback_name.value.trim()?'':'이름을 입력해 주세요.');
 fields.note.setCustomValidity(fields.note.value.trim()?'':'요청 내용을 입력해 주세요.');
 const phone=fields.callback_phone.value.trim(),digits=phone.replace(/[^0-9]/g,'');
 fields.callback_phone.setCustomValidity(/^\+?[0-9() .-]+$/.test(phone)&&digits.length>=8&&digits.length<=15?'':'회신받을 전화번호를 확인해 주세요.');
 if(!form.reportValidity())return;
 // Approved private contact capture uses the v2 RPC; never copy contacts into notes or analytics.


 if(window.DMJInquiryProductPending){status.textContent='선택한 상품을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.';return}
 if(!document.getElementById('inquiry-consent').checked){status.textContent='상담 접수에 필요한 정보 수집·이용에 동의해 주세요.';return}
 const contactBackendReady=true;
 if(!contactBackendReady){status.textContent='문의 접수 기능을 준비 중입니다. 지금은 카카오톡으로 상담해 주세요.';return}
 button.disabled=true;status.textContent='로그인과 서버 연결을 확인하고 있습니다.';
 try{await DMJAuth._ensureClient();const sb=DMJAuth._supabase();const auth=await sb.auth.getUser();if(auth.error&&auth.error.name!=='AuthSessionMissingError'&&auth.error.status!==401)throw Error('로그인 연결을 확인하지 못했습니다. 입력 내용은 그대로 있습니다. 다시 시도해 주세요.');if(auth.error||!auth.data.user){document.getElementById('inquiry-login').hidden=false;throw Error('로그인 후 문의를 접수해 주세요. 작성한 내용은 로그인 후 이어집니다.');}
 if(contactOwner&&contactOwner!==auth.data.user.id){prefillContact();throw Error('계정이 변경되었습니다. 상담 연락처를 다시 확인해 주세요.')}
 const owner=auth.data.user.id,e=form.elements;
 const payload={p_contact_consent:'inquiry-contact-2026-10-16',p_callback_name:e.callback_name.value.trim(),p_callback_phone:e.callback_phone.value.trim(),p_product:e.product.value,p_size:e.size.value,p_experience:e.experience.value,p_setup:e.setup.value,p_note:[window.DMJInquiryProduct?'상품: '+String(window.DMJInquiryProduct.name).slice(0,160):'',e.note.value].filter(Boolean).join('\n'),p_consent:'inquiry-2026-09-24'};
 let source={};if(document.getElementById('source-consent')?.checked){try{const stored=JSON.parse(sessionStorage.getItem('dmj_campaign_v1')||'{}');source={p_campaign:String(stored.utm_campaign||'').slice(0,80),p_channel:String(stored.utm_source||'').slice(0,80),p_source_consent:'attribution-2026-09-24'}}catch(e){}}Object.assign(payload,{p_campaign:'',p_channel:'',p_source_consent:''},source);
 const serial=JSON.stringify({owner,...payload});if(serial!==lastPayload){requestId=crypto.randomUUID();lastPayload=serial}
 const result=await sb.rpc('submit_contact_inquiry_v2',{p_id:requestId,...payload});if(result.error||result.data!==requestId)throw Error('서버 접수가 완료되지 않았습니다. 입력 내용은 그대로 있습니다. 잠시 후 다시 시도해 주세요.');
 const current=await sb.auth.getUser();if(current.data.user?.id!==owner){status.textContent='계정이 변경되었습니다. 접수 내역은 제출한 계정에서 확인해 주세요.';return}
 status.textContent='상담 접수 완료 · 접수번호 '+result.data+' · 주문·결제가 완료된 것은 아닙니다.';
 }catch(e){status.textContent=e.message}finally{button.disabled=false}
});})();
