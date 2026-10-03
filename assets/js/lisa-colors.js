(function(){
 'use strict';
 const select=document.getElementById('detail-option');
 if(!select)return;
 const colors={'레드':'red','블루':'blue','블랙':'black','투명':'transparent'};
 function sync(){
  const color=colors[select.value];if(!color)return;
  const thumb=[...document.querySelectorAll('.gallery [data-product-photo]')].find(b=>b.dataset.productPhoto.endsWith('/duo-'+color+'.jpg'));
  thumb?.click();
 }
 select.addEventListener('change',sync);window.addEventListener('pageshow',sync);sync();
})();
