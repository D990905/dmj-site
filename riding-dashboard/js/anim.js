/* 시각 폴리시 모션 헬퍼 — 비활성 (Danny 2026-05-27 revert).
   원복 후에도 index.html 이 이 파일을 참조하는 경우 404 방지용 빈 스텁. */
(function (global) {
  'use strict';
  global.RDAnim = {
    countUp: function () {},
    countAll: function () {},
    resetCounted: function () {},
    stagger: function () {},
    markRendered: function () {}
  };
})(typeof window !== 'undefined' ? window : globalThis);
