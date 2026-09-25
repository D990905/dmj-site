(function(){'use strict';
const button=document.getElementById('save-inquiry'),status=document.getElementById('inquiry-save-status'),form=document.getElementById('inquiry-form');
if(!button||!form)return;let requestId=null,lastPayload='';
button.addEventListener('click',async()=>{
 if(!document.getElementById('inquiry-consent').checked){status.textContent='상담 접수에 필요한 정보 수집·이용에 동의해 주세요.';return}
 button.disabled=true;status.textContent='로그인과 서버 연결을 확인하고 있습니다.';
 try{await DMJAuth._ensureClient();const sb=DMJAuth._supabase();const auth=await sb.auth.getUser();if(auth.error||!auth.data.user)throw Error('로그인 후 접수할 수 있습니다. 비회원은 카카오 상담을 이용해 주세요.');
 const owner=auth.data.user.id,e=form.elements;
 const payload={p_product:e.product.value,p_size:e.size.value,p_experience:e.experience.value,p_setup:e.setup.value,p_note:e.note.value,p_consent:'inquiry-2026-09-24'};
 let source={};if(document.getElementById('source-consent')?.checked){try{const stored=JSON.parse(sessionStorage.getItem('dmj_campaign_v1')||'{}');source={p_campaign:String(stored.utm_campaign||'').slice(0,80),p_channel:String(stored.utm_source||'').slice(0,80),p_source_consent:'attribution-2026-09-24'}}catch(e){}}Object.assign(payload,{p_campaign:'',p_channel:'',p_source_consent:''},source);
 const serial=JSON.stringify({owner,...payload});if(serial!==lastPayload){requestId=crypto.randomUUID();lastPayload=serial}
 const result=await sb.rpc('submit_attributed_inquiry',{p_id:requestId,...payload});if(result.error)throw Error('서버 접수가 완료되지 않았습니다. 입력 내용은 그대로 있습니다. 카카오 상담을 이용해 주세요.');
 const current=await sb.auth.getUser();if(current.data.user?.id!==owner){status.textContent='계정이 변경되었습니다. 접수 내역은 제출한 계정에서 확인해 주세요.';return}
 status.textContent='상담 접수 완료 · 접수번호 '+result.data+' · 주문·결제가 완료된 것은 아닙니다.';
 }catch(e){status.textContent=e.message}finally{button.disabled=false}
});})();
