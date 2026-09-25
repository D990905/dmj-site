(async()=>{
 const form=document.querySelector('#recommend-form');if(!form)return;
 const summary=document.querySelector('#recommend-summary'),results=document.querySelector('#recommend-results');
 const params=new URLSearchParams(location.search),initial=DMJRecommend.normalize(Object.fromEntries(params));
 for(const [k,v] of Object.entries(initial))if(form.elements[k])form.elements[k].value=v;
 // Old matrix links used style and weight bands; preserve recognized environment intent only.
 if(!params.has('environment')&&params.has('style'))form.elements.environment.value=({'flat-speed':'flat','choppy-freeride':'chop',wave:'wave',hybrid:'chop'})[params.get('style')]||'flat';
 let products;
 try{const r=await fetch('data/commerce.json');if(!r.ok)throw Error();products=(await r.json()).products}catch(e){summary.textContent='추천 목록을 불러오지 못했습니다. 새로고침하거나 구매 상담을 이용해 주세요.';const a=document.createElement('a');a.href='inquiry.html';a.textContent='구매 상담 ↗';summary.append(a);return}
 function element(tag,text,className){const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el}
 function render(e){e?.preventDefault();if(!form.reportValidity())return;
 const result=DMJRecommend.recommend(products,Object.fromEntries(new FormData(form))),s=result.selection;summary.replaceChildren();results.replaceChildren();
 summary.append(element('span','YOUR MATCH / '+result.results.length+'개 후보','eyebrow'),element('h2','선택한 이유가 있는 장비.'),element('p',DMJRecommend.summary(s)));
 for(const warning of result.warnings)summary.append(element('p',warning,'recommend-note'));
 summary.append(element('p','DMJ 매장 구성 기준에 따른 비교 후보입니다. 최종 사이즈·재고·부품 호환성은 상담으로 확인합니다.','small'));
 const context=DMJRecommend.summary(s),consult=element('a','이 조건으로 셋업 상담 ↗','button dark');consult.href='inquiry.html?'+new URLSearchParams({recommendation:context});summary.append(consult);
 for(const {product:p,reasons} of result.results){const c=element('article',null,'product-card'),a=element('a',null,'product-image');c.dataset.brand=p.brand;c.dataset.category=p.category;c.dataset.product=p.id;a.href=p.path;
 if(p.image){const img=element('img');img.src=p.image;img.alt=p.name;img.loading='lazy';a.append(img)}else a.append(element('span','BOOM RS · 이미지 준비 중','image-pending'));
 const info=element('div',null,'product-info');info.append(element('span',p.brand.toUpperCase(),'eyebrow'));const title=element('h3'),link=element('a',p.name);link.href=p.path;title.append(link);info.append(title,element('p',reasons.slice(0,2).join(' · ')),element('p',p.price?(p.priceStatus==='estimate'?'예상 ':'')+Number(p.price).toLocaleString('ko-KR')+'원'+(p.priceMax>p.price?'부터':'')+' · 부가세 포함'+(p.priceStatus==='estimate'?' · 상담 시 확정':''):'가격·입고 문의'));
 if(p.id==='takoon-cruise'&&s.level==='beginner')info.prepend(element('span','입문·초급 우선 추천','recommend-tag'));
 const ask=element('a','이 조건으로 제품 문의 ↗','text-link');ask.href='inquiry.html?'+new URLSearchParams({product:p.id,recommendation:context});info.append(ask);c.append(a,info);results.append(c)}
 // Keep body weight out of shared URLs and analytics; only transfer on an explicit inquiry link.
 const u=new URL(location.href);for(const [k,v] of Object.entries(s))if(k!=='weight')u.searchParams.set(k,v);u.searchParams.delete('weight');history.replaceState(null,'',u);
 if(e){summary.setAttribute('tabindex','-1');summary.focus({preventScroll:true});summary.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});}
 }
 form.addEventListener('submit',render);
 if(params.has('level')||params.has('priority'))render();
})();
