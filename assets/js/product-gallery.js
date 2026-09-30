(function () {
  'use strict';
  const hero = document.querySelector('.detail-photo img');
  if (!hero || typeof HTMLDialogElement === 'undefined') return;
  const gallery = hero.closest('.gallery');
  const thumbs = [...gallery.querySelectorAll('[data-product-photo]')];
  const absolute = src => new URL(src, location.href).href;
  const photos = [...new Map(thumbs.map(b => [absolute(b.dataset.productPhoto), {src:absolute(b.dataset.productPhoto),alt:b.querySelector('img')?.alt||hero.alt}])).values()];
  if (!photos.some(p => p.src === hero.src)) photos.unshift({src:hero.src,alt:hero.alt});
  let selected = Math.max(0, photos.findIndex(p => p.src === hero.src));
  let index = selected, previousOverflow = '', opener;
  const button = (text, cls) => { const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;return b; };
  const trigger=button('사진 확대','gallery-expand');hero.parentElement.append(trigger);
  hero.tabIndex=0;hero.setAttribute('role','button');hero.setAttribute('aria-label','선택한 제품 사진 확대');
  const bar=document.createElement('div');bar.className='gallery-navigation';
  const previous=button('← 이전 사진','gallery-step'),following=button('다음 사진 →','gallery-step');
  const counter=document.createElement('span');counter.setAttribute('role','status');
  bar.append(previous,counter,following);hero.parentElement.after(bar);
  function select(i){
    selected=(i+photos.length)%photos.length;
    hero.src=photos[selected].src;hero.alt=photos[selected].alt;
    thumbs.forEach(b=>b.setAttribute('aria-pressed',String(absolute(b.dataset.productPhoto)===hero.src)));
    counter.textContent='사진 '+(selected+1)+' / '+photos.length;
    previous.hidden=following.hidden=photos.length<2;
  }
  thumbs.forEach(b=>b.addEventListener('click',()=>select(photos.findIndex(p=>p.src===absolute(b.dataset.productPhoto)))));
  previous.addEventListener('click',()=>select(selected-1));following.addEventListener('click',()=>select(selected+1));
  select(selected);
  const modal=document.createElement('dialog');modal.className='product-lightbox';modal.setAttribute('aria-label','제품 사진 확대 보기');
  const close=button('닫기 ×','gallery-close');
  const frame=document.createElement('div');frame.className='gallery-frame';
  const image=document.createElement('img');image.className='gallery-large';image.draggable=false;frame.append(image);
  const status=document.createElement('p');status.setAttribute('role','status');
  const controls=document.createElement('div');controls.className='gallery-controls';
  const prev=button('← 이전',''),next=button('다음 →','');
  controls.append(prev,status,next);modal.append(close,frame,controls);document.body.append(modal);
  function fit(){
    const rotated=image.style.transform&&image.style.transform!=='none';
    image.style.width=image.style.height=rotated?Math.min(frame.clientWidth,frame.clientHeight)+'px':'100%';
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(fit).observe(frame);
  function show(i){
    index=(i+photos.length)%photos.length;
    image.alt=photos[index].alt;image.src=photos[index].src;
    const probe=hero.cloneNode(false);probe.src=image.src;probe.removeAttribute('tabindex');probe.style.visibility='hidden';probe.style.position='absolute';
    hero.parentElement.append(probe);const matrix=getComputedStyle(probe).transform;probe.remove();
    const angle=matrix.startsWith('matrix(')?(()=>{const v=matrix.slice(7,-1).split(',').map(Number);return Math.round(Math.atan2(v[1],v[0])*180/Math.PI)})():0;
    image.style.transform=angle?'rotate('+angle+'deg)':'none';
    status.textContent=(index+1)+' / '+photos.length;prev.hidden=next.hidden=photos.length<2;fit();
  }
  image.addEventListener('error',()=>{status.textContent='사진을 불러오지 못했습니다 · '+(index+1)+' / '+photos.length;});
  function open(){
    opener=document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    show(selected);modal.showModal();fit();close.focus();
  }
  trigger.addEventListener('click',open);hero.addEventListener('click',open);
  hero.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  close.addEventListener('click',()=>modal.close());
  modal.addEventListener('close',()=>{document.body.style.overflow=previousOverflow;select(index);(opener||trigger).focus();});
  prev.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));
  modal.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(index+(e.key==='ArrowLeft'?-1:1));}});
  let touchX=null,touchY=null;
  frame.addEventListener('touchstart',e=>{if(e.touches.length===1){touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;}else touchX=null;},{passive:true});
  frame.addEventListener('touchend',e=>{if(touchX===null||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)show(index+(dx<0?1:-1));touchX=null;},{passive:true});
})();
