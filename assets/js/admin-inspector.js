(function(){'use strict';
 const root=document.currentScript.dataset.adminRoot||'', state={admin:false,inventory:[],costs:[],estimates:[],products:[],client:null};let generation=0;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
 const money=(v)=>Number(v).toLocaleString('ko-KR');

 const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const range=values=>{const lo=Math.min(...values),hi=Math.max(...values);return money(lo)+(lo!==hi?'–'+money(hi):'')+'원'};
 function comparison(product,estimate){
  const box=el('div',null,'admin-price-comparison'),variants=estimate?.variants||[],retail=product?.retailVariants||[];
  const prices=retail.filter(v=>amount(v.priceKRW)).map(v=>v.priceKRW);
  if(!retail.length&&amount(product?.price))prices.push(product.price);
  const entries=retail.map(r=>{
   // A handle add-on shares the wing SKU but its purchase cost is not included.
   const matches=Number(r.handleAdditionalKRW)>0?[]:variants.filter(v=>(r.sku&&v.sku===r.sku)||v.option===r.option||v.option===r.baseOption);
   const costs=[...new Set(matches.filter(v=>amount(v.unit_cost_krw)).map(v=>v.unit_cost_krw))];
   return {option:r.label||r.option,retail:r.priceKRW,cost:costs.length===1?costs[0]:null};
  });
  if(!retail.length)for(const v of variants)entries.push({option:v.option,cost:v.unit_cost_krw,retail:product?.price});
  const diffs=entries.filter(v=>amount(v.cost)&&amount(v.retail)).map(v=>v.retail-v.cost);
  box.append(el('strong','매입·판매 비교'),el('p','예상 매입가: '+(variants.length?range(variants.map(v=>v.unit_cost_krw)):'미등록')),el('p','사이트 공시 소비자가: '+(prices.length?range(prices):'미등록 · 상담')),el('p','차액: '+(diffs.length?range(diffs)+(entries.length>1?' (비교 가능한 옵션 기준)':''):'산정 불가')));
  const details=el('details'),summary=el('summary','옵션별 판매가·차액');details.append(summary);
  for(const v of entries){const row=el('div',null,'admin-price-option');row.append(el('strong',v.option),el('p','예상 매입가 '+(amount(v.cost)?money(v.cost)+'원':'해당 구성 미등록')),el('p','공시 소비자가 '+(amount(v.retail)?money(v.retail)+'원':'미등록 · 상담')),el('p','차액 '+(amount(v.cost)&&amount(v.retail)?money(v.retail-v.cost)+'원':'산정 불가')));details.append(row);}
  box.append(details,el('small','차액 = 공시 소비자가 − 예상 매입가. 운송료·관부가세·수수료 차감 전 금액이며 순이익이 아닙니다.'));
  return box;
 }
 function clear(){state.admin=false;state.inventory=[];state.costs=[];state.estimates=[];state.products=[];state.client=null;document.querySelectorAll('.admin-inspect,.admin-toolbar').forEach(e=>e.remove());document.querySelectorAll('[data-admin-entry]').forEach(e=>{e.textContent='관리자 로그인';e.href=root+'login.html?next=/admin/index.html'});window.dispatchEvent(new Event('dmj-admin-ready'));}
 function decorate(){if(!state.admin)return;document.querySelectorAll('.product-card[data-product]').forEach(card=>{
  card.querySelector('.admin-inspect')?.remove();const host=el('div',null,'admin-inspect'),button=el('a','매입·재고'),panel=el('div',null,'admin-inspect-panel');button.href=root+'admin/operations.html?product='+encodeURIComponent(card.dataset.product)+'#stock';button.setAttribute('aria-label','이 제품 매입·재고 관리');panel.setAttribute('aria-label','예상 매입가, 공시 소비자가, 차액과 실재고');
  const rows=state.inventory.filter(x=>x.product_id===card.dataset.product),estimate=state.estimates.find(x=>x.product_id===card.dataset.product);
  panel.append(comparison(state.products.find(p=>p.id===card.dataset.product),estimate));
  if(!rows.length)panel.append(el('p','실재고 미등록'));
  for(const row of rows){const cost=state.costs.find(x=>x.sku===row.sku);panel.append(el('strong',row.variant||row.sku),el('p','실재고 '+row.on_hand+'개 · 예약 '+row.reserved+'개 · 판매 가능 '+Math.max(0,row.on_hand-row.reserved)+'개'));
   if(cost){panel.append(el('p','등록 매입 단가 '+cost.currency+' '+money(cost.unit_cost)));const krw=cost.unit_cost_krw??(estimate?.currency===cost.currency?Math.round(cost.unit_cost*estimate.fx_krw):null);if(krw!=null)panel.append(el('small','원화 '+money(krw)+'원 ('+(cost.unit_cost_krw!=null&&cost.krw_basis==='actual'?'실제 매입액':'환산 추정액')+')'));if(cost.source_reference)panel.append(el('small',cost.source_reference));}
   else panel.append(el('p',estimate?'해당 옵션 인보이스 미등록 · 아래 예상가 참고':'매입가 미등록'));
  }
  if(estimate){const values=estimate.variants.map(v=>v.unit_cost_krw),low=Math.min(...values),high=Math.max(...values);panel.append(el('strong','예상 매입가 '+money(low)+(high!==low?'–'+money(high):'')+'원'),el('p',estimate.basis));const details=el('details'),summary=el('summary','옵션별 매입가 참고 ('+values.length+'개)');details.append(summary);for(const v of estimate.variants){details.append(el('p',v.option+' · '+estimate.currency+' '+money(v.unit_cost)+' / 약 '+money(v.unit_cost_krw)+'원'));}panel.append(details,el('small',estimate.fx_date+' 기준환율 · 1 '+estimate.currency+' = '+money(Math.round(estimate.fx_krw*100)/100)+'원'),el('small',estimate.source_reference));}
  else if(!rows.length)panel.append(el('p','매입가 미등록'));
  host.append(button,panel);card.append(host);
 });}
 async function refresh(){const run=++generation;clear();try{await window.DMJAuth._ensureClient();const c=window.DMJAuth._supabase();const {data,error}=await c.auth.getUser();if(error||!data.user)return;const role=await c.rpc('is_ops_admin');if(role.error||!role.data||run!==generation)return;const [inv,cost,estimate,catalog]=await Promise.all([c.from('ops_inventory').select('*'),c.from('ops_unit_costs').select('*'),c.from('ops_product_cost_estimates').select('*'),fetch(root+'data/commerce.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('catalog');return r.json()})]);if(inv.error||cost.error||estimate.error)throw inv.error||cost.error||estimate.error;if(run!==generation)return;Object.assign(state,{admin:true,client:c,inventory:inv.data,costs:cost.data,estimates:estimate.data,products:catalog.products});document.querySelectorAll('[data-admin-entry]').forEach(e=>{e.textContent='관리자';e.href=root+'admin/index.html'});const bar=el('nav',null,'admin-toolbar');for(const [name,path] of [['관리자','admin/index.html'],['재고 관리','admin/operations.html#stock'],['이월·중고 등록','admin/outlet.html']]){const a=el('a',name);a.href=root+path;bar.append(a)}document.body.append(bar);decorate();window.dispatchEvent(new Event('dmj-admin-ready'));}catch(e){if(run===generation)clear();console.warn('관리자 정보를 불러오지 못했습니다.');}}
 window.DMJAdmin={state,refresh,decorate};window.addEventListener('dmj-auth-change',e=>{generation++;clear();setTimeout(refresh,0)});refresh();document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;clear()}else refresh()});
 window.addEventListener('pagehide',()=>{generation++;clear()});window.addEventListener('pageshow',e=>{if(e.persisted)refresh()});
})();


