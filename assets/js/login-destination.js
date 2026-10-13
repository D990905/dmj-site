(function(){'use strict';let generation=0;
window.addEventListener('dmj-auth-change',e=>{if(e.detail?.accountChanged!==false||e.detail?.event==='SIGNED_OUT')generation++});
async function resolve(next,explicit){await DMJAuth._ensureClient();const run=generation,c=DMJAuth._supabase();if(!c)throw Error('로그인 연결을 확인해 주세요.');const first=await c.auth.getUser(),user=first.data?.user;if(first.error||!user)throw Error('로그인이 필요합니다.');const role=await c.rpc('is_ops_admin');const last=await c.auth.getUser();if(run!==generation||last.error||last.data?.user?.id!==user.id)throw Error('로그인 계정이 변경되었습니다. 다시 확인해 주세요.');const isAdmin=!role.error&&role.data===true;if(next.startsWith('admin/')&&!isAdmin)throw Error('이 계정에는 관리자 권한이 없습니다.');return isAdmin&&(!explicit||next==='profile.html')?'admin/operations.html#overview':next}
window.DMJLoginDestination={resolve};
})();
