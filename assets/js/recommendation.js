(async()=>{
 'use strict';
 const form=document.querySelector('#recommend-form');if(!form)return;
 const summary=document.querySelector('#recommend-summary'),results=document.querySelector('#recommend-results');
 const params=new URLSearchParams(location.search),initial=DMJRecommend.normalize(Object.fromEntries(params));
 for(const [k,v] of Object.entries(initial))if(form.elements[k])form.elements[k].value=v;
 let products;try{const r=await fetch('data/commerce.json',{cache:'no-cache'});if(!r.ok)throw Error();products=(await r.json()).products}catch(e){summary.textContent='추천 목록을 불러오지 못했습니다 새로고침해 주세요';return}
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
 const money=n=>'₩'+Number(n).toLocaleString('ko-KR');
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(event){event?.preventDefault();if(!form.reportValidity())return;
 const out=DMJRecommend.recommend(products,Object.fromEntries(new FormData(form))),s=out.selection;
 summary.replaceChildren();results.replaceChildren();results.classList.add('setup-results');
 summary.append(el('h2',s.category==='all'?'나에게 맞는 전체 셋업':'조건에 맞는 '+DMJRecommend.labels.category[s.category]),el('p',DMJRecommend.summary(s)));
 out.warnings.forEach(w=>summary.append(el('p',w,'recommend-note')));
 const categories=s.category==='all'?[s.purpose==='parawing'?'parawing':'wing','board','foil']:[s.category];
 const selections=new Map(), controls=[];
 for(const category of categories){
 const candidates=out.results.filter(r=>r.product.category===category),section=el('section',null,'setup-category');section.append(el('h3',DMJRecommend.labels.category[category]));results.append(section);
 if(!candidates.length){section.append(el('p','현재 조건에 맞는 검증된 후보가 없습니다 조건을 조정하거나 상담에서 구성을 확인해 주세요','recommend-note'));continue}
 const productLabel=el('label','제품'),productSelect=el('select');productSelect.setAttribute('aria-label',DMJRecommend.labels.category[category]+' 제품 선택');
 candidates.forEach(({product:p})=>{const o=el('option',p.name);o.value=p.id;productSelect.append(o)});productLabel.append(productSelect);section.append(productLabel);
 const body=el('div',null,'setup-product'), options=el('div',null,'setup-options'),price=el('p',null,'setup-line-price');section.append(body,options,price);
 function chooseProduct(){
  const {product:p,reasons}=candidates.find(r=>r.product.id===productSelect.value);body.replaceChildren();options.replaceChildren();selections.delete(category);
  const photo=el('a');photo.href=p.path;const image=el('img');image.src=p.image;image.alt=p.name;image.loading='lazy';photo.append(image);
  const intro=el('div'),link=el('a',p.name+' 상세 보기 ↗');link.href=p.path;intro.append(link,el('p',reasons.slice(0,2).join(' · ')));body.append(photo,intro);
  const variants=(p.retailVariants||[]).filter(v=>p.brand!=='takoon'||p.category!=='wing'||(p.options||[]).includes(v.option));
  const takoon=['takoon-v4','takoon-v4-pro','takoon-vx-pro-2'].includes(p.id);const axes=takoon?(p.id==='takoon-v4-pro'?['사이즈','색상','핸들 구성']:['사이즈','핸들 구성']):['사이즈·구성'];const chosen=axes.map(()=>''),selects=[];
  for(const name of axes){const label=el('label',name),select=el('select');select.setAttribute('aria-label',DMJRecommend.labels.category[category]+' '+name);label.append(select);options.append(label);selects.push(select)}
  function sync(start){
   for(let i=start;i<axes.length;i++){
    const eligible=variants.filter(v=>!takoon||v.option.split(' / ').slice(0,i).every((x,j)=>x===chosen[j]));const values=[...new Set(eligible.map(v=>takoon?v.option.split(' / ')[i]:v.option))];
    if(!values.includes(chosen[i]))chosen[i]=takoon&&i===axes.length-1&&values.includes('직물 핸들 (기본)')?'직물 핸들 (기본)':values.length===1?values[0]:'';
    const select=selects[i];select.replaceChildren();const placeholder=el('option',axes[i]+' 선택');placeholder.value='';select.append(placeholder);
    for(const value of values){let text=value;if(takoon){text=text.replace('Orange','오렌지').replace('White','화이트');if(i===0)text+='㎡';if(text.startsWith('싱글 붐'))text+=' (+226,000원)';if(text.startsWith('투바'))text+=' (+183,000원)'}const option=el('option',text);option.value=value;select.append(option)}select.value=chosen[i];select.disabled=!values.length;
   }
   const key=takoon?chosen.join(' / '):chosen[0],variant=variants.find(v=>v.option===key);
   if(variant){selections.set(category,{product:p,variant});price.textContent=Number(variant.priceKRW)>0?money(variant.priceKRW):'가격 확인 후 견적 안내'}else{selections.delete(category);price.textContent='옵션을 선택하면 금액이 표시됩니다'}
   if(typeof update==='function')update();
  }
  selects.forEach((select,i)=>select.addEventListener('change',()=>{chosen[i]=select.value;for(let j=i+1;j<chosen.length;j++)chosen[j]='';sync(i)}));sync(0);
 }
 productSelect.addEventListener('change',chooseProduct);controls.push(chooseProduct);
 }
 const basket=el('section',null,'setup-total'),heading=el('h3','선택한 구성'),lines=el('div'),total=el('strong'),status=el('p'),actions=el('div',null,'setup-actions');basket.append(heading,lines,total,status,actions);results.append(basket);
 const order=el('a','이대로 주문 요청','button dark'),consult=el('a','이대로 상담 신청','button dark'),quote=el('a','견적서 요청','text-link'),download=el('button','견적서 내려받기','button');download.type='button';actions.append(order,consult,download,quote);
 let current=[],sum=0,complete=false,priced=false;
 function update(){
  current=categories.flatMap(c=>selections.has(c)?[selections.get(c)]:[]);sum=current.reduce((n,x)=>n+Number(x.variant.priceKRW),0);complete=current.length===categories.length;priced=complete&&current.every(x=>Number(x.variant.priceKRW)>0);lines.replaceChildren();
  current.forEach(x=>lines.append(el('p',x.product.name+' · '+x.variant.option+' — '+(Number(x.variant.priceKRW)>0?money(x.variant.priceKRW):'가격 문의'))));total.textContent=(priced?'총 상품금액 ':'가격이 확인된 상품 합계 ')+money(sum);
  status.textContent=complete&&!priced?'가격 확인이 필요한 장비가 있습니다 구성 그대로 상담과 견적 요청이 가능합니다':complete?'부가세 포함 · 재고와 배송비, 호환성을 확인한 뒤 주문이 확정됩니다':'각 장비의 사이즈와 구성을 선택해 주세요';download.disabled=!priced;
  const detail=current.map(x=>x.product.name+' / '+x.variant.option+' / '+(Number(x.variant.priceKRW)>0?money(x.variant.priceKRW):'가격 문의')).join('\n')+'\n총 상품금액 '+money(sum);
  for(const [a,type] of [[order,'주문 요청'],[consult,'셋업 상담'],[quote,'견적서 요청']]){const ready=complete&&(a!==order||priced);a.setAttribute('aria-disabled',String(!ready));a.tabIndex=ready?0:-1;if(ready)a.href='inquiry.html?'+new URLSearchParams({note:'['+type+']\n'+detail+'\n'+DMJRecommend.summary(s)});else a.removeAttribute('href')}
 }
 download.addEventListener('click',()=>{if(!priced)return;const rows=current.map(x=>'<tr><td>'+esc(x.product.name)+'</td><td>'+esc(x.variant.option)+'</td><td>'+esc((Number(x.variant.priceKRW)>0?money(x.variant.priceKRW):'가격 문의'))+'</td></tr>').join('');const content='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DMJ 셋업 견적</title><style>body{font:16px sans-serif;max-width:900px;margin:40px auto;padding:20px;color:#202522}table{border-collapse:collapse;width:100%}td,th{padding:12px;border-bottom:1px solid #ccc;text-align:left} @media print{button{display:none}}</style><h1>DMJ 셋업 견적</h1><p>'+new Date().toLocaleDateString('ko-KR')+'</p><table><thead><tr><th>제품</th><th>선택 구성</th><th>금액</th></tr></thead><tbody>'+rows+'</tbody></table><h2>총 상품금액 '+money(sum)+'</h2><p>부가세 포함 · 재고와 배송비 및 부품 호환성을 확인하기 전의 참고 견적입니다</p><p>단무지상사 · 사업자등록번호 144-55-01008</p><p>문의: https://dmjgroup.kr/inquiry.html</p><button onclick="window.print()">인쇄 / PDF 저장</button></html>';const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'})),a=el('a');a.href=url;a.download='DMJ-셋업견적-'+new Date().toISOString().slice(0,10)+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)});
 controls.forEach(fn=>fn());update();
 const u=new URL(location.href);for(const [k,v] of Object.entries(s))if(k!=='weight')u.searchParams.set(k,v);u.searchParams.delete('weight');history.replaceState(null,'',u);
 if(event)summary.scrollIntoView({block:'start',behavior:'auto'});
 }
 form.addEventListener('submit',render);if(params.has('level')||params.has('priority'))render();
})();
