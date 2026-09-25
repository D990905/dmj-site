(function(){'use strict';
document.querySelectorAll('[data-product-photo]').forEach((button,index)=>{button.setAttribute('aria-pressed',String(index===0));button.addEventListener('click',()=>{const image=document.querySelector('.detail-photo img');if(image){image.src=button.dataset.productPhoto;image.alt=button.querySelector('img')?.alt||image.alt;document.querySelectorAll('[data-product-photo]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));}})});
const option=document.getElementById('detail-option'),link=document.getElementById('detail-inquiry'),price=document.querySelector('[data-detail-price]');
function updateSelection(){
 if(!option)return;
 if(link){const url=new URL(link.href);if(option.value)url.searchParams.set('size',option.value);else url.searchParams.delete('size');link.href=url.href}
 if(price){const amount=Number(option.selectedOptions[0]?.dataset.priceKrw);price.textContent=Number.isFinite(amount)&&amount>0?(price.dataset.pricePrefix||'')+'₩'+amount.toLocaleString('ko-KR'):(option.value?'가격·구성 확인 후 안내':'옵션을 선택해 주세요')}
}
if(option){const requested=new URLSearchParams(location.search).get('size');if(requested&&Array.from(option.options).some(x=>x.value===requested))option.value=requested;option.addEventListener('change',updateSelection);updateSelection()}
const size=document.querySelector('[name="size"]');if(size){const value=new URLSearchParams(location.search).get('size');if(value)size.value=value.slice(0,80)}
})();
