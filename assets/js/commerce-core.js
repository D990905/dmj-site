(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DMJCommerce=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function clean(value,max=80){return String(value||'').replace(/[^a-zA-Z0-9가-힣_. -]/g,'').slice(0,max)}
 function campaignFrom(search){const p=new URLSearchParams(search),out={};['utm_source','utm_medium','utm_campaign','utm_content'].forEach(k=>{const v=clean(p.get(k));if(v)out[k]=v});return out}
 function inquiryText(fields,campaign={}){
  const str=(v,n)=>String(v||'').trim().slice(0,n);
  const lines=['안녕하세요. DMJ 장비 구매 문의드립니다.','',`관심 제품: ${str(fields.product,180)||'아직 정하지 못했어요'}`,`희망 사이즈·볼륨: ${str(fields.size,80)||'상담 필요'}`];
  if(Number.isFinite(fields.price)&&fields.price>0)lines.push(`사이트 표시 판매가: ₩${Math.round(fields.price).toLocaleString('ko-KR')}`);
  if(fields.promotion){const sale=fields.promotion;lines.push(str(sale.title,80)+' · '+str(sale.deadlineLabel,100),str(sale.allocationLabel,80)+' · '+str(sale.deliveryLabel,80),str(sale.confirmationLabel,160));}
  if(fields.experience&&fields.experience!=='선택하지 않음')lines.push(`라이딩 경험: ${str(fields.experience,80)}`);
  if(str(fields.setup,180))lines.push(`타는 곳·현재 장비: ${str(fields.setup,180)}`);
  if(str(fields.note,600))lines.push('',`궁금한 점: ${str(fields.note,600)}`);
  lines.push('','가격, 구성, 입고·배송 일정을 알려주세요.');
  const source=clean(campaign.utm_source),name=clean(campaign.utm_campaign);
  if(source||name)lines.push('',`방문 경로: ${source} / ${name}`);
  return lines.join('\n');
 }
 function campaignUrl(path,source,campaign){
  const base=new URL('https://dmjgroup.kr/'),u=new URL(path,base);
  if(u.origin!==base.origin||!u.pathname.endsWith('.html'))throw new Error('DMJ 상품·브랜드 주소만 사용할 수 있습니다.');
  u.search='';u.hash='';u.searchParams.set('utm_source',clean(source));u.searchParams.set('utm_medium','social');u.searchParams.set('utm_campaign',clean(campaign)||'gear-collection');return u.href;
 }
 function matches(product,brand,category,query){const q=String(query||'').trim().toLocaleLowerCase();return(brand==='all'||product.brand===brand)&&(category==='all'||product.category===category)&&(!q||(product.name+' '+product.brand).toLocaleLowerCase().includes(q))}
 function activePromotion(product,now=Date.now()){
  const sale=product?.promotion,end=Date.parse(sale?.endsAt||'');return sale&&Number.isFinite(sale.priceKRW)&&sale.priceKRW>0&&Number.isFinite(end)&&Number(now)<end?sale:null;
 }
 function pricedProduct(product,now=Date.now()){
  const sale=activePromotion(product,now),regular=product.regularPriceKRW??product.price;
  return {...product,regularPriceKRW:regular,price:sale?sale.priceKRW:regular,retailVariants:(product.retailVariants||[]).map(v=>{const base=v.regularPriceKRW??v.priceKRW;return {...v,regularPriceKRW:base,priceKRW:sale?sale.priceKRW:base}})};
 }
 function inquiryReference(product,option,now=Date.now()){
  const price=selectedRetailPrice([product],product.id,option,now),sale=activePromotion(product,now);const lines=[];lines[0]='상품: '+String(product.name||'').slice(0,160);if(price)lines.push('접수 시 사이트 표시가: ₩'+Math.round(price).toLocaleString('ko-KR'));if(sale)lines.push(sale.title+' · '+sale.deadlineLabel,sale.allocationLabel+' · '+sale.deliveryLabel,sale.confirmationLabel);return lines.join('\n');
 }
 function selectedRetailPrice(products,id,option,now=Date.now()){
  const raw=products.find(p=>p.id===id);if(!raw)return null;const p=pricedProduct(raw,now);
  const match=(p.retailVariants||[]).find(v=>v.option===String(option||'').trim());
  return match&&Number.isFinite(match.priceKRW)&&match.priceKRW>0?match.priceKRW:null;
 }
 return{campaignFrom,inquiryText,campaignUrl,matches,selectedRetailPrice,activePromotion,pricedProduct,inquiryReference};
});
