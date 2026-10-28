(() => {
'use strict';
const dialog=document.getElementById('outlet-closeout-popup');
if(!dialog||typeof dialog.showModal!=='function')return;
const key='dmj-closeout-hide-20261015',today=new Date().toLocaleDateString('sv-SE');
dialog.querySelector('[data-closeout-close]').onclick=()=>dialog.close();
dialog.querySelector('[data-closeout-hide]').onclick=()=>{try{localStorage.setItem(key,today)}catch(_){}dialog.close()};
dialog.addEventListener('close',()=>document.documentElement.classList.remove('closeout-popup-open'));
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
// Let the Supersonic homepage campaign lead; retain the existing modal elsewhere.
if(document.body.dataset.campaign==='ppc-supersonic')return;
try{if(localStorage.getItem(key)===today)return}catch(_){}
if(document.querySelector('dialog[open]'))return;
dialog.showModal();document.documentElement.classList.add('closeout-popup-open');
})();