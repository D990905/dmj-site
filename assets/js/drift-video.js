/* Load the official player only after an explicit visitor click. */
(function () {
  'use strict';
  document.querySelectorAll('[data-drift-player]').forEach(function (player) {
    var button = player.querySelector('[data-drift-play]');
    if (!button) return;
    button.addEventListener('click', function () {
      if (player.dataset.loaded === 'true') return;
      player.dataset.loaded = 'true';
      var frame = document.createElement('iframe');
      frame.title = 'PPC Drift Wing — 공식 소개 영상';
      frame.src = 'https://www.youtube-nocookie.com/embed/89btxH-v94k?autoplay=1&controls=1&playsinline=1&rel=0';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      player.replaceChildren(frame);
      frame.focus();
    }, { once: true });
  });
}());
