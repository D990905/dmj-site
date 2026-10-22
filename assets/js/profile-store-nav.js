// Profile-only shopping navigation. Authentication and member data stay unchanged.
(() => {
 'use strict';
 const header=document.getElementById('profile-store-header');
 const toggle=document.getElementById('profile-store-toggle');
 const nav=document.getElementById('profile-store-nav');
 if(!header||!toggle||!nav)return;
 const close=()=>{header.removeAttribute('data-menu-open');toggle.setAttribute('aria-expanded','false');};
 toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));if(open)header.setAttribute('data-menu-open','true');else close();});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))close();});
 document.addEventListener('click',e=>{if(!header.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){close();toggle.focus();}});
 window.addEventListener('pagehide',close);
})();
