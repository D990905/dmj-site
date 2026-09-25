(function () {
  'use strict';
  const hero = document.querySelector('.detail-photo img');
  if (!hero || typeof HTMLDialogElement === 'undefined') return;
  const thumbs = [...document.querySelectorAll('[data-product-photo]')];
  const photos = [...new Map([{src: hero.src, alt: hero.alt}, ...thumbs.map(b => ({src: new URL(b.dataset.productPhoto, location.href).href, alt: b.querySelector('img')?.alt || hero.alt}))].map(p => [p.src, p])).values()];
  let index = 0, previousOverflow = '';
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'gallery-expand'; trigger.textContent = '사진 확대';
  hero.parentElement.append(trigger);
  const modal = document.createElement('dialog');
  modal.className = 'product-lightbox'; modal.setAttribute('aria-label', '제품 사진 확대 보기');
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기 ×'; close.className = 'gallery-close';
  const frame = document.createElement('div'); frame.className = 'gallery-frame';
  const image = document.createElement('img'); image.className = 'gallery-large'; frame.append(image);
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const controls = document.createElement('div'); controls.className = 'gallery-controls';
  const prev = document.createElement('button'), next = document.createElement('button');
  prev.type = next.type = 'button'; prev.textContent = '← 이전'; next.textContent = '다음 →';
  controls.append(prev, status, next); modal.append(close, frame, controls); document.body.append(modal);
  function fit() {
    const rotated = image.style.transform && image.style.transform !== 'none';
    image.style.width = image.style.height = rotated ? Math.min(frame.clientWidth, frame.clientHeight) + 'px' : '100%';
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(frame);
  function show(i) {
    index = (i + photos.length) % photos.length;
    image.alt = photos[index].alt; image.src = photos[index].src;
    // Match the existing product framing without modifying source assets.
    const probe = hero.cloneNode(false); probe.src = image.src; probe.style.visibility = 'hidden';
    hero.parentElement.append(probe); image.style.transform = getComputedStyle(probe).transform; probe.remove();
    status.textContent = (index + 1) + ' / ' + photos.length;
    prev.hidden = next.hidden = photos.length < 2; fit();
  }
  image.addEventListener('error', () => { status.textContent = '사진을 불러오지 못했습니다'; });
  trigger.addEventListener('click', () => {
    show(Math.max(0, photos.findIndex(p => p.src === hero.src)));
    previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; modal.showModal(); fit(); close.focus();
  });
  close.addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => { document.body.style.overflow = previousOverflow; trigger.focus(); });
  prev.addEventListener('click', () => show(index - 1)); next.addEventListener('click', () => show(index + 1));
  modal.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(index + (e.key === 'ArrowLeft' ? -1 : 1)); }
  });
})();
