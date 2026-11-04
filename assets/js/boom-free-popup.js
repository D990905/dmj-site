(() => {
  'use strict';
  const dialog=document.getElementById('boom-free-launch');
  if(!dialog||typeof dialog.showModal!=='function')return;
  const campaign=dialog.dataset.popupCampaign==='three-news'?'three-news-20261104-all':'hybrid-sale-20261108',seenKey='dmj-'+campaign+'-seen',hideKey='dmj-'+campaign+'-hide-until';
  let opener,pendingManual=false;
  function open(manual=false){
    if(document.querySelector('[data-launch-price],[data-launch-summary]')&&document.documentElement.dataset.launchPricesReady!=='true'){pendingManual=manual;return;}
    if(!manual&&dialog.dataset.popupCampaign!=='three-news'&&document.documentElement.dataset.launchOfferActive==='false')return;
    if(dialog.open||document.querySelector('dialog[open]'))return;
    if(!manual){try{if(sessionStorage.getItem(seenKey)||Number(localStorage.getItem(hideKey))>Date.now())return}catch(_){}}
    opener=document.activeElement;
    dialog.showModal();document.documentElement.classList.add('boom-free-popup-open');
    try{sessionStorage.setItem(seenKey,'1')}catch(_){}
    dialog.querySelector('[data-boom-close]').focus();
  }
  dialog.querySelector('[data-boom-close]').addEventListener('click',()=>dialog.close());
  dialog.querySelector('[data-boom-hide]').addEventListener('click',()=>{try{localStorage.setItem(hideKey,String(Date.now()+7*86400000))}catch(_){}dialog.close()});
  dialog.addEventListener('close',()=>{document.documentElement.classList.remove('boom-free-popup-open');if(opener?.isConnected)opener.focus()});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
  document.querySelectorAll('[data-boom-open]').forEach(button=>button.addEventListener('click',()=>open(true)));
  window.addEventListener('dmj-launch-prices-ready',()=>open(pendingManual));
  open();
})();
