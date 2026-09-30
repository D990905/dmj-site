(()=>{
  'use strict';
  document.querySelectorAll('[data-product-youtube]').forEach(button=>{
    const id=button.dataset.productYoutube;
    if(!/^[\w-]{11}$/.test(id))return;
    const preview=document.createElement('img');
    preview.src='https://i.ytimg.com/vi/'+id+'/maxresdefault.jpg';
    preview.alt='';
    preview.loading='lazy';
    const fallback=()=>{
      if(preview.src.includes('/maxresdefault.jpg'))preview.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
      else preview.remove();
    };
    preview.addEventListener('error',fallback);
    preview.addEventListener('load',()=>{if(preview.naturalWidth<=120)fallback();});
    button.prepend(preview);
    button.addEventListener('click',()=>{
      const frame=document.createElement('iframe');
      frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1';
      frame.title=button.dataset.videoTitle||'제품 소개 영상';
      frame.allow='autoplay; encrypted-media; picture-in-picture';
      frame.allowFullscreen=true;
      button.parentElement.replaceChildren(frame);
      frame.focus();
    });
  });
  const productImage=document.querySelector('.detail-photo img');
  document.querySelectorAll('.product-motion video,.official-feature-grid>video').forEach(video=>{
    if(!video.poster&&productImage)video.poster=productImage.currentSrc||productImage.src;
  });
})();
