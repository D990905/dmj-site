/* Progressive enhancement: no YouTube requests until the visitor clicks Play. */
(() => {
  'use strict';
  const root = document.querySelector('.ss-special');
  if (!root) return;
  const play = root.querySelector('[data-ss-play]');
  const intro = root.querySelector('[data-ss-video-intro]');
  const mount = root.querySelector('[data-ss-video-mount]');
  const stop = root.querySelector('[data-ss-stop]');
  play?.addEventListener('click', () => {
    if (mount.querySelector('iframe')) return;
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/N0ub_IeNiFw?rel=0&playsinline=1';
    frame.title = 'PPC SUPERSONIC - A new era in race wing performance';
    frame.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    mount.append(frame);
    intro.hidden = true;
    mount.hidden = false;
    stop.hidden = false;
    frame.focus();
  });
  stop?.addEventListener('click', () => {
    mount.replaceChildren();
    mount.hidden = true;
    intro.hidden = false;
    stop.hidden = true;
    play.focus();
  });
  const images = Array.from(root.querySelectorAll('[data-ss-image]'));
  if (!images.length || typeof HTMLDialogElement === 'undefined') return;
  const dialog = document.createElement('dialog');
  dialog.className = 'ss-lightbox';
  dialog.setAttribute('aria-label', 'SUPERSONIC 영상 프레임 크게 보기');
  dialog.innerHTML = '<div class="ss-lightbox-header"><span data-ss-caption></span><button type="button" data-ss-close autofocus aria-label="사진 닫기">닫기 ×</button></div><img class="ss-lightbox-image" alt=""><div class="ss-lightbox-footer"><span data-ss-count></span><a target="_blank" rel="noopener" data-ss-original>원본 이미지 ↗</a><div class="ss-lightbox-controls"><button type="button" data-ss-prev aria-label="이전 사진">←</button><button type="button" data-ss-next aria-label="다음 사진">→</button></div></div>';
  document.body.append(dialog);
  let index = 0, trigger = null;
  const large = dialog.querySelector('img');
  function show(next) {
    index = (next + images.length) % images.length;
    const source = images[index];
    large.src = source.href;
    large.alt = source.querySelector('img').alt;
    dialog.querySelector('[data-ss-caption]').textContent = source.dataset.caption || large.alt;
    dialog.querySelector('[data-ss-count]').textContent = String(index + 1).padStart(2, '0') + ' / ' + String(images.length).padStart(2, '0');
    dialog.querySelector('[data-ss-original]').href = source.href;
  }
  images.forEach((anchor, n) => anchor.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trigger = anchor;
    show(n);
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('ss-gallery-open');
  }));
  dialog.querySelector('[data-ss-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-ss-prev]').addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-ss-next]').addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('ss-gallery-open');
    large.removeAttribute('src');
    trigger?.focus();
  });
})();
