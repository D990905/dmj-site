(function(){'use strict';
 const original=document.getElementById('detail-option'),inquiry=document.getElementById('detail-inquiry');
 if(!original||!inquiry)return;
 const id=new URL(inquiry.href,location.href).searchParams.get('product');
 const takoonParawing=['takoon-cloud-one','takoon-parawing-cloud','takoon-parawing-cloud-lw'].includes(id);
 if(!id?.startsWith('ppc-')&&!takoonParawing)return;
 const rows=Array.from(original.options).filter(o=>o.value).map(o=>({value:o.value,parts:o.value.split(' / '),price:Number(o.dataset.priceKrw)}));
 if(!rows.length||rows.some(r=>!r.price||r.parts.length!==rows[0].parts.length))return;
 const count=rows[0].parts.length,chosen=Array(count).fill('');
 let edition='26/27'; const splitEdition=id==='ppc-m2';
 if(count<1||count>3)return;
 const labels=count===3?['사이즈','색상','핸들 구성']:id==='ppc-r1'?['보드 사이즈','포일 연결 방식']:id==='ppc-orbit'||takoonParawing?['사이즈','색상']:['사이즈','핸들 구성'];
 function korean(s){return s.replace(/ \(2[56]\/2[67]\)/g,'').replaceAll('White/Grey','화이트 / 그레이').replaceAll('Green/Grey','그린 / 그레이').replaceAll('Dual Handles','듀얼 핸들').replaceAll('Single Boom','싱글 붐').replaceAll('(long bag incl)','(긴 가방 포함)').replaceAll('Leading Edge Handle','리딩엣지 핸들').replaceAll('Orange/Peacock','오렌지 / 피콕').replaceAll('Track','트랙').replaceAll('Tuttle','터틀');}
 const host=document.createElement('div');host.className='product-option-picker';host.setAttribute('aria-label','제품 옵션 선택');
 if(splitEdition){
  const editions=document.createElement('div');editions.className='model-editions';
  for(const [value,title,desc] of [['26/27','M2 26/27','그린 · 그레이'],['25/26','M2 25/26','특별할인 모델 · 화이트 / 그레이']]){
   const button=document.createElement('button');button.type='button';button.dataset.edition=value;button.innerHTML='<strong>'+title+'</strong><span>'+desc+'</span>';
   button.onclick=()=>{edition=value;chosen.fill('');render();};editions.append(button);
  }host.append(editions);
 }
 const groups=Array.from({length:count},(_,i)=>{const field=document.createElement('fieldset'),legend=document.createElement('legend'),list=document.createElement('div');legend.textContent=labels[i]||'구성';list.className='option-buttons';field.append(legend,list);host.append(field);return list});
 const result=document.createElement('p');result.className='option-selection-summary';result.setAttribute('role','status');host.append(result);
 const before=rows.find(r=>r.value===original.value);if(before){before.parts.forEach((v,i)=>chosen[i]=v);if(splitEdition)edition=before.value.includes('25/26')?'25/26':'26/27';}
 function candidates(i){return rows.filter(r=>(!splitEdition||r.value.includes(edition))&&r.parts.slice(0,i).every((v,j)=>v===chosen[j]));}
 function render(focus){
  host.querySelectorAll('[data-edition]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.edition===edition)));
  for(let i=0;i<count;i++){
   const eligible=candidates(i),values=[...new Set(eligible.map(r=>r.parts[i]))];
   if(!values.includes(chosen[i]))chosen[i]='';

   groups[i].replaceChildren();
   const select=document.createElement('select');select.className='option-select';select.setAttribute('aria-label',labels[i]||'구성');
   const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=values.length?(labels[i]+' 선택'):'앞 단계 옵션을 먼저 선택해 주세요';select.append(placeholder);
   select.disabled=!values.length;
   for(const value of values){const option=document.createElement('option');option.value=value;
    option.textContent=korean(value);select.append(option);
   }
   select.value=chosen[i];select.onchange=()=>{chosen[i]=select.value;for(let j=i+1;j<count;j++)chosen[j]='';render({axis:i})};groups[i].append(select);
  }
  const selected=chosen.every(Boolean)?rows.find(r=>r.parts.every((v,i)=>v===chosen[i])):null;
  original.value=selected?selected.value:'';original.dispatchEvent(new Event('change',{bubbles:true}));
  const price=document.querySelector('[data-detail-price]');
  if(price&&!selected)price.textContent='옵션을 선택해 주세요';
  result.textContent=selected?selected.parts.map(korean).join(' · '):labels.join(' · ')+'을 선택해 주세요.';
  const handleAxis=labels.findIndex(x=>x==='핸들 구성');
  if(handleAxis>=0){const matching=rows.filter(r=>(!splitEdition||r.value.includes(edition))&&r.parts.slice(0,handleAxis).every((v,j)=>!chosen[j]||chosen[j]===v));
   const groupsByBase=new Map();matching.forEach(r=>{const key=r.parts.slice(0,handleAxis).join('|');if(!groupsByBase.has(key))groupsByBase.set(key,new Set());groupsByBase.get(key).add(r.price)});
   if(matching.length&&[...groupsByBase.values()].every(x=>x.size===1)){const note=document.createElement('small');note.className='handle-note';note.textContent='카본 핸들 또는 붐 선택 가능 · 추가금 없음';groups[handleAxis].append(note);}
  }
  if(focus)groups[focus.axis].querySelector('select')?.focus({preventScroll:true});
 }
 const label=original.closest('label');(label||original).insertAdjacentElement('afterend',host);if(label)label.hidden=true;else original.hidden=true;
 render();
})();
