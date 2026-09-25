(function(){
window.addEventListener('dmj-data-sync',function(e){
 if(!window.DMJAuth||e.detail.owner!==DMJAuth.currentUserId())return;
 let box=document.getElementById('account-sync-status');
 if(!box){box=document.createElement('div');box.id='account-sync-status';box.setAttribute('role','status');box.style.cssText='position:fixed;bottom:20px;left:20px;z-index:9999;max-width:360px;background:#202522;color:#f9f9f5;padding:14px 20px;border:1px solid #92995a;border-radius:8px';document.body.appendChild(box)}
 box.textContent=e.detail.ok?'계정에 저장되었습니다.':'서버 저장에 실패했습니다. 이 기기에는 남아 있습니다. 연결을 확인하고 다시 저장해 주세요.';
 if(e.detail.ok)setTimeout(()=>box.remove(),4000);
});
})();