(async function(){'use strict';const O=DMJOutlet;let openPopup=null,busy=false;let host=document.getElementById('outlet-home');if(!host)return;
const today=()=>new Date().toLocaleDateString('sv-SE');const storage={get:k=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};let sessionShown=false;
async function refresh(){if(busy)return;busy=true;try{const r=await O.listings(),eligible=r.items.filter(O.activePromo),chosen=eligible.filter(i=>i.featured).slice(0,4),pop=eligible.find(i=>i.popup),urls=await O.signed(r.client,[...chosen,...(pop?[pop]:[])].flatMap(i=>i.media));host.replaceChildren();host.hidden=!chosen.length;if(chosen.length){host.append(O.el('p','eyebrow','DMJ OUTLET'),O.el('h2','','아울렛 · 중고 장비'));const grid=O.el('div','outlet-grid');grid.append(...chosen.map(i=>O.card(i,urls)));const more=O.el('a','outlet-button','전체 상품 보기 ↗');more.href='outlet.html';host.append(grid,more)}
 if(openPopup&&!eligible.some(i=>i.id===openPopup.dataset.item)){openPopup.close();openPopup=null}
 if(document.getElementById('lisa-brochure-popup')||!pop||sessionShown||storage.get('dmj-outlet-hide')===today())return;
 if(document.querySelector('dialog[open]'))return;
 const dialog=O.el('dialog','outlet-popup');dialog.dataset.item=pop.id;dialog.setAttribute('aria-label','아울렛 추천 상품');const close=O.el('button','','닫기 ×'),hide=O.el('button','','오늘 하루 보지 않기');close.onclick=()=>dialog.close();hide.onclick=()=>{storage.set('dmj-outlet-hide',today());dialog.close()};dialog.addEventListener('close',()=>{dialog.remove();if(openPopup===dialog)openPopup=null});const bar=O.el('div','outlet-actions');bar.append(hide,close);dialog.append(O.card(pop,urls),bar);document.body.append(dialog);sessionShown=true;openPopup=dialog;dialog.showModal();close.focus();
}catch(e){host.hidden=true;console.warn('아울렛 추천을 불러오지 못했습니다.')}finally{busy=false}}
await refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
})();
