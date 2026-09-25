(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DMJCommerce=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function clean(value,max=80){return String(value||'').replace(/[^a-zA-Z0-9가-힣_. -]/g,'').slice(0,max)}
 function campaignFrom(search){const p=new URLSearchParams(search),out={};['utm_source','utm_medium','utm_campaign','utm_content'].forEach(k=>{const v=clean(p.get(k));if(v)out[k]=v});return out}
 function inquiryText(fields,campaign={}){
  const str=(v,n)=>String(v||'').trim().slice(0,n);
  const lines=['안녕하세요. DMJ 장비 구매 문의드립니다.','',`관심 제품: ${str(fields.product,180)||'아직 정하지 못했어요'}`,`희망 사이즈·볼륨: ${str(fields.size,80)||'상담 필요'}`];
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
 return{campaignFrom,inquiryText,campaignUrl,matches};
});
