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

  // Older WebViews ignore overscroll-behavior. Cancel only outward drags at a
  // scroll boundary; native scrolling, taps, text editing and map gestures stay native.
  if (window.CSS && CSS.supports && CSS.supports('overscroll-behavior', 'none')) return;
  var gesture = null;
  document.addEventListener('touchstart', function (event) {
    gesture = null;
    if (event.touches.length !== 1) return;
    var target = event.target;
    if (!target.closest || !target.closest('.page') || target.closest('input, textarea, [contenteditable="true"]')) return;
    for (var node = target; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).touchAction === 'none') return;
    }
    gesture = { target: target, x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true, capture: true });
  document.addEventListener('touchmove', function (event) {
    if (event.touches.length !== 1) { gesture = null; return; }
    if (!gesture || event.defaultPrevented) return;
    var touch = event.touches[0], dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 3) return;
    gesture.x = touch.clientX; gesture.y = touch.clientY;
    var vertical = Math.abs(dy) >= Math.abs(dx), delta = vertical ? dy : dx;
    for (var node = gesture.target; node && node !== document.body; node = node.parentElement) {
      var style = getComputedStyle(node);
      var overflow = vertical ? style.overflowY : style.overflowX;
      var extent = vertical ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth;
      if (/^(auto|scroll)$/.test(overflow) && extent > 1) {
        var offset = vertical ? node.scrollTop : node.scrollLeft;
        if ((delta > 0 && offset > 0) || (delta < 0 && offset < extent - 1)) return;
        // The nearest scrollable region owns the drag, including at its edge.
        break;
      }
    }
    if (event.cancelable) event.preventDefault();
  }, { passive: false, capture: true });
  function endGesture() { gesture = null; }
  document.addEventListener('touchend', endGesture, { passive: true });
  document.addEventListener('touchcancel', endGesture, { passive: true });
})();
