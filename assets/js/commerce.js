(() => {
 'use strict';
 const script=document.currentScript,root=script?.dataset.root||'';
 const params=new URLSearchParams(location.search);
 const campaign=DMJCommerce.campaignFrom(location.search);
 if(Object.keys(campaign).length){try{sessionStorage.setItem('dmj_campaign_v1',JSON.stringify(campaign))}catch(e){}}
 const toast=text=>{const el=document.querySelector('.toast');if(el){el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4000)}};
 async function copy(text){try{await navigator.clipboard.writeText(text);toast('복사했습니다. 원하는 곳에 붙여넣어 주세요.');return true}catch(e){toast('자동 복사가 제한되어 있습니다. 문의 내용을 직접 선택해 복사해 주세요.');return false}}
 const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('#store-nav');
 toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'닫기':'메뉴';nav.classList.toggle('is-open',open)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){toggle.click();toggle.focus()}});
 document.querySelector('[data-share]')?.addEventListener('click',async()=>{const url=document.querySelector('link[rel=canonical]').href;try{if(navigator.share)await navigator.share({title:document.title,url});else await copy(url)}catch(e){if(e.name!=='AbortError')await copy(url)}});
 const filters=document.querySelector('.catalog-filters');
 if(filters){
  const controls=filters.elements;
  if(matchMedia('(max-width:600px)').matches){const panel=document.querySelector('.catalog-filter-panel');if(panel)panel.open=false;}
  document.querySelectorAll('[data-category-filter]').forEach(button=>button.addEventListener('click',()=>{controls.category.value=button.dataset.categoryFilter;filter();}));
  ['brand','category','q','priority'].forEach(k=>{if(params.has(k)){const val=params.get(k);if(k==='q'||Array.from(controls[k].options).some(o=>o.value===val))controls[k].value=val}});
  function filter(){const priority=controls.priority?.value||'all',brand=controls.brand.value,category=controls.category.value,q=controls.q.value.trim().toLocaleLowerCase();let count=0;
   document.querySelectorAll('.product-card').forEach(c=>{const show=(priority==='all'||priority===c.dataset.priority)&&(brand==='all'||brand===c.dataset.brand)&&(category==='all'||category===c.dataset.category)&&(!q||(c.dataset.search+' '+c.dataset.brand).includes(q));c.hidden=!show;if(show)count++});
   document.querySelector('.result-count').textContent=`${count}개 모델`;
   document.querySelectorAll('[data-category-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categoryFilter===category)));
   document.querySelector('.empty-state').hidden=count>0;
   const u=new URL(location.href);[['priority',priority],['brand',brand],['category',category],['q',q]].forEach(([k,v])=>{if(v&&v!=='all')u.searchParams.set(k,v);else u.searchParams.delete(k)});history.replaceState(null,'',u);
  }
  filters.addEventListener('submit',e=>e.preventDefault());filters.addEventListener('input',filter);filters.addEventListener('change',filter);filters.addEventListener('reset',()=>setTimeout(filter,0));document.querySelector('[data-reset]')?.addEventListener('click',()=>filters.reset());filter();
 }
 const inquiry=document.querySelector('#inquiry-form');
 if(inquiry){
  const product=inquiry.elements.product;
  if(params.has('product')&&Array.from(product.options).some(o=>o.value===params.get('product')))product.value=params.get('product');
  if(params.has('size'))inquiry.elements.size.value=params.get('size').slice(0,80);
  const message=document.querySelector('#inquiry-message');
  const recommendation=params.get('recommendation');if(recommendation)inquiry.elements.note.value='추천 조건: '+recommendation.slice(0,400);else if(params.has('note'))inquiry.elements.note.value=params.get('note').slice(0,600);
  function compose(){const e=inquiry.elements;let attribution={};try{attribution=JSON.parse(sessionStorage.getItem('dmj_campaign_v1')||'{}')}catch(error){}
   message.textContent=DMJCommerce.inquiryText({product:product.options[product.selectedIndex].text,size:e.size.value,experience:e.experience.value,setup:e.setup.value,note:e.note.value},attribution);
  }
  inquiry.addEventListener('submit',e=>e.preventDefault());inquiry.addEventListener('input',compose);inquiry.addEventListener('change',compose);document.querySelector('#copy-inquiry').addEventListener('click',()=>copy(message.textContent));compose();
 }
 if(document.querySelector('#channel-links'))fetch(root+'data/channels.json').then(r=>{if(!r.ok)throw new Error('channel config');return r.json()}).then(c=>{const list=c.channels.filter(x=>x.url&&x.id!=='kakao'&&/^https:\/\//.test(x.url));if(!list.length)return;const area=document.querySelector('#channel-links');list.forEach(x=>{const a=document.createElement('a');a.href=x.url;a.textContent=x.label+' ↗';a.target='_blank';a.rel='noopener';area.append(a)});document.querySelector('.connected-channels').hidden=false}).catch(e=>console.warn('채널 목록을 불러오지 못했습니다.',e));
})();
