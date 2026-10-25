(function () {
  'use strict';
  var header = document.getElementById('header');
  if (!header) return;
  function syncHeaderHeight() {
    document.documentElement.style.setProperty('--zg-app-header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
  }
  syncHeaderHeight();
  if (typeof ResizeObserver === 'function') new ResizeObserver(syncHeaderHeight).observe(header);
  window.addEventListener('resize', syncHeaderHeight);
})();
