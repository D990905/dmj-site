(() => {
  'use strict';
  const dialog = document.getElementById('lisa-brochure-popup');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const key = 'dmj-lisa-brochure-hide-20261008';
  const today = new Date().toLocaleDateString('sv-SE');
  try { if (localStorage.getItem(key) === today) return; } catch (_) {}
  dialog.querySelector('[data-lisa-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-lisa-hide]').addEventListener('click', () => {
    try { localStorage.setItem(key, today); } catch (_) {}
    dialog.close();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => document.documentElement.classList.remove('lisa-popup-open'));
  dialog.showModal();
  document.documentElement.classList.add('lisa-popup-open');
})();
