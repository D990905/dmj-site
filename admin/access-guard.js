(function(){'use strict';
let generation=0;
const html=document.documentElement;
function lock(text){html.removeAttribute('data-admin-authorized');const message=document.getElementById('admin-access-message');if(message)message.textContent=text||'관리자 권한을 확인하고 있습니다.';}
async function verify(){const run=++generation;lock();try{await window.DMJAuth._ensureClient();const c=window.DMJAuth._supabase(),u=await c.auth.getUser();if(run!==generation)return;if(u.error||!u.data.user){lock('로그인이 필요합니다. 관리자 계정으로 로그인해 주세요.');return;}const r=await c.rpc('is_ops_admin');if(run!==generation)return;if(r.error||r.data!==true){lock('이 계정에는 관리자 권한이 없습니다. 일반 회원은 관리자 화면에 접근할 수 없습니다.');return;}html.setAttribute('data-admin-authorized','true');}catch(e){if(run===generation)lock('관리자 권한을 확인하지 못했습니다. 다시 로그인해 주세요.');}}
function init(){const notice=document.createElement('div');notice.id='admin-access-notice';const title=document.createElement('h1');title.textContent='관리자 전용';const message=document.createElement('p');message.id='admin-access-message';const login=document.createElement('a');login.textContent='관리자 로그인';login.href='../login.html?next='+encodeURIComponent(location.pathname+location.search+location.hash);const home=document.createElement('a');home.textContent='홈으로';home.href='../index.html';notice.append(title,message,login,home);document.body.prepend(notice);verify();}
window.addEventListener('dmj-auth-change',e=>{if(e.detail?.event==='TOKEN_REFRESHED'||e.detail?.event==='PROFILE_SYNCED')return;generation++;lock('로그인 상태가 변경되었습니다.');if(e.detail?.event!=='SIGNED_OUT')setTimeout(verify,0);});
window.addEventListener('pagehide',()=>{generation++;lock();});window.addEventListener('pageshow',e=>{if(e.persisted)verify();});document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;lock();}else verify();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
