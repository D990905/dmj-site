(() => {
 'use strict';
 const data = document.getElementById('levitaz-media'), select = document.getElementById('levitaz-photo-group');
 if (!data || !select) return;
 const groups = JSON.parse(data.textContent), hero = document.querySelector('.detail-photo img');
 const caption = document.getElementById('levitaz-photo-caption'), note = document.getElementById('levitaz-photo-note');
 const buttons = [...document.querySelectorAll('[data-photo-group]')];
 function display(id) {
  const group = groups.find(g => g.id === id); if (!group) return;
  select.value = id;
  buttons.forEach(b => { b.hidden = b.dataset.photoGroup !== id; b.setAttribute('aria-pressed','false'); });
  const first = buttons.find(b => !b.hidden); if (first) first.click();
  note.textContent = group.note || '사진 미리보기 · 주문 구성은 구매 옵션에서 선택';
 }
 buttons.forEach(b => b.addEventListener('click', () => { caption.textContent = b.querySelector('img').alt; }));
 select.addEventListener('change', () => display(select.value));
 document.getElementById('detail-option')?.addEventListener('change', e => {
  const g = groups.find(g => g.option === e.target.value); if (g) display(g.id);
 });
 document.querySelectorAll('[data-show-photo-group]').forEach(b => b.addEventListener('click', () => {
  display(b.dataset.showPhotoGroup); select.scrollIntoView({block:'center',behavior:'auto'}); select.focus();
 }));
 const chosen = document.getElementById('detail-option')?.value;
 display(groups.find(g => g.option === chosen)?.id || groups[0].id);
})();
