(function () {
  'use strict';
  var root = document.documentElement;
  var header = document.getElementById('header');
  var worldNav = document.getElementById('world-nav-bar');
  if (!header) return;
  var home = document.getElementById('page-home');
  var phoneLayout = window.matchMedia('(max-width: 700px), (max-width: 1000px) and (max-height: 500px) and (pointer: coarse)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var toolsToggle = document.createElement('button');
  toolsToggle.type = 'button';
  toolsToggle.className = 'zg-mobile-tools-toggle';
  toolsToggle.setAttribute('aria-controls', 'nav');
  toolsToggle.setAttribute('aria-expanded', 'false');
  toolsToggle.innerHTML = '<span>Заргота</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
  header.insertBefore(toolsToggle, header.firstChild);
  function labelTools() {
    var uk = window.ZargotaI18n && window.ZargotaI18n.getLocale() === 'uk';
    toolsToggle.setAttribute('aria-label', uk ? 'Заргота — меню та налаштування' : 'Заргота — меню и настройки');
  }
  labelTools();
  document.addEventListener('zargota:localechange', labelTools);
  function setSectionTools(open) {
    document.body.classList.toggle('zg-section-tools-open', open);
    toolsToggle.setAttribute('aria-expanded', String(open));
    if (!open && window.zgSessionMonitorToggle) window.zgSessionMonitorToggle(null, false);
  }
  toolsToggle.addEventListener('click', function (event) {
    var open = toolsToggle.getAttribute('aria-expanded') !== 'true';
    setSectionTools(open);
    if (open && !event.detail) {
      var first = Array.from(header.querySelectorAll('#nav button')).find(function (b) { return !b.disabled && b.getClientRects().length; });
      if (first) first.focus();
    }
  });
  function closeSectionTools(event) {
    if (toolsToggle.getAttribute('aria-expanded') === 'true' && !header.contains(event.target)) setSectionTools(false);
  }
  document.addEventListener('click', closeSectionTools);
  document.addEventListener('focusin', closeSectionTools);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && toolsToggle.getAttribute('aria-expanded') === 'true') {
      setSectionTools(false);
      toolsToggle.focus();
    }
  });
  var lastPage = document.querySelector('.page.active');
  function pageChanged() {
    var page = document.querySelector('.page.active');
    if (page === lastPage) return;
    lastPage = page;
    setSectionTools(false);
    var mapSplash = document.getElementById('world-map-splash');
    if (mapSplash && (!page || page.id !== 'page-world')) mapSplash.classList.add('hidden');
    // Opacity only: transforming a page would move its fixed dialogs and map controls.
    if (page && phoneLayout.matches && !reducedMotion.matches && page.animate) {
      page.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    }
  }
  var pageObserver = new MutationObserver(pageChanged);
  document.querySelectorAll('.page').forEach(function (page) { pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] }); });
  function layoutChanged() { if (!phoneLayout.matches) setSectionTools(false); }
  if (phoneLayout.addEventListener) phoneLayout.addEventListener('change', layoutChanged);
  else phoneLayout.addListener(layoutChanged);

  // Existing adventure steps replace their display state synchronously. Animate
  // only the newly visible step, and interpolate the dialog height on phones.
  var adventure = document.getElementById('zg-adv-overlay');
  var adventureDialog = adventure && adventure.querySelector('.zg-adv-dialog');
  var activeStep = '', previousDialogHeight = 0, stepAnimation = null, heightAnimation = null;
  function animateAdventureStep() {
    if (!adventure || !adventureDialog) return;
    if (!adventure.classList.contains('open')) { activeStep = ''; previousDialogHeight = 0; return; }
    var next = Array.from(adventure.querySelectorAll('.zg-adv-view')).find(function (view) { return view.style.display !== 'none'; });
    if (!next || next.id === activeStep) return;
    var wasOpen = !!activeStep;
    activeStep = next.id;
    if (stepAnimation) stepAnimation.cancel();
    if (heightAnimation) heightAnimation.cancel();
    var nextHeight = adventureDialog.getBoundingClientRect().height;
    if (phoneLayout.matches && !reducedMotion.matches && next.animate) {
      next.style.animation = 'none';
      stepAnimation = next.animate([{ opacity: 0, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.2,.75,.25,1)' });
      if (wasOpen && previousDialogHeight && Math.abs(nextHeight - previousDialogHeight) > 2) {
        heightAnimation = adventureDialog.animate([{ height: previousDialogHeight + 'px' }, { height: nextHeight + 'px' }], { duration: 280, easing: 'cubic-bezier(.2,.75,.25,1)' });
      }
    }
    previousDialogHeight = nextHeight;
  }
  if (adventure) {
    var modeMarks = adventure.querySelectorAll('#zg-adv-view-format .zg-adv-mode-mark');
    var modeIcons = [
      '<circle cx="12" cy="6" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="m10 9-3 6m7-6 3 6M8 18h8"/>',
      '<ellipse cx="12" cy="12" rx="8" ry="4"/><path d="M4 12v6m16-6v6M8 8V5m8 3V5"/><circle cx="8" cy="3" r="1"/><circle cx="16" cy="3" r="1"/>'
    ];
    modeMarks.forEach(function (mark, index) { mark.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + modeIcons[index] + '</svg>'; });
    var adventureObserver = new MutationObserver(animateAdventureStep);
    adventureObserver.observe(adventure, { attributes: true, attributeFilter: ['class'] });
    adventure.querySelectorAll('.zg-adv-view').forEach(function (view) { adventureObserver.observe(view, { attributes: true, attributeFilter: ['style'] }); });
  }
  var brand = home && home.querySelector('.home-mobile-wordmark');
  if (brand) {
    function setHomeTools(open) {
      document.body.classList.toggle('home-atlas-tools-open', open);
      brand.setAttribute('aria-expanded', String(open));
      if (!open && window.zgSessionMonitorToggle) window.zgSessionMonitorToggle(null, false);
    }
    function syncHomeTools() {
      var active = home.classList.contains('active');
      document.body.classList.toggle('home-atlas-active', active);
      if ((!active || !phoneLayout.matches) && brand.getAttribute('aria-expanded') === 'true') setHomeTools(false);
    }
    syncHomeTools();
    new MutationObserver(syncHomeTools).observe(home, { attributes: true, attributeFilter: ['class'] });
    if (phoneLayout.addEventListener) phoneLayout.addEventListener('change', syncHomeTools);
    else phoneLayout.addListener(syncHomeTools);
    brand.addEventListener('click', function (event) {
      var open = brand.getAttribute('aria-expanded') !== 'true';
      setHomeTools(open);
      if (open && !event.detail) {
        var first = Array.from(header.querySelectorAll('#nav button')).find(function (b) {
          return !b.disabled && b.getClientRects().length;
        });
        if (first) first.focus();
      }
    });
    function closeOutside(event) {
      if (brand.getAttribute('aria-expanded') === 'true' && !brand.contains(event.target) && !header.contains(event.target)) setHomeTools(false);
    }
    document.addEventListener('click', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && brand.getAttribute('aria-expanded') === 'true') {
        setHomeTools(false);
        brand.focus();
      }
    });
    home.querySelector('.home-own-sheet').addEventListener('click', function () {
      // A build without the persistent-sheet module still has the local roster.
      if (!window.ZargotaPersistentCharacters) {
        window.showPage('characters');
        window.showCharView('list');
      }
    });
  }
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
