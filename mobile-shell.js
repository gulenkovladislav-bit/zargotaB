(function () {
  'use strict';
  var root = document.documentElement;
  var header = document.getElementById('header');
  var worldNav = document.getElementById('world-nav-bar');
  if (!header) return;
  function syncViewport() {
    var viewport = window.visualViewport;
    root.style.setProperty('--zg-viewport-height', (viewport ? viewport.height : window.innerHeight) + 'px');
    root.style.setProperty('--zg-viewport-top', (viewport ? viewport.offsetTop : 0) + 'px');
    root.style.setProperty('--zg-app-header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
    if (worldNav && worldNav.offsetHeight) root.style.setProperty('--zg-world-nav-height', worldNav.offsetHeight + 'px');
  }
  syncViewport();
  if (typeof ResizeObserver === 'function') {
    var observer = new ResizeObserver(syncViewport);
    observer.observe(header);
    if (worldNav) observer.observe(worldNav);
  }
  window.addEventListener('resize', syncViewport);
  window.addEventListener('pageshow', syncViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewport);
    window.visualViewport.addEventListener('scroll', syncViewport);
  }
})();
