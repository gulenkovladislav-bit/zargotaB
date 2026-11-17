/* Shared face-aware framing. Coordinates describe the source image, not a CSS crop. */
(function (w) {
  'use strict';
  const presets = Object.freeze({
    'evan-2026-11.png': [48, 29],
    'evan-classic.png': [61, 43],
    'melissa-2026-11.png': [49, 29],
    'melissa-classic.png': [52, 27],
    'esteros-2026-11.png': [43, 28],
    'esteros-classic.png': [49, 22],
    'vrotik-2026-11.png': [36, 28],
    'vrotik-classic.png': [34, 26],
    'lin-yin-2026-11.png': [49, 30],
    'lin-yin-classic.png': [50, 28],
    'Evan.png': [50, 32],
    'Melissa.png': [50, 32],
    'Esteros.png': [50, 32],
    'Vrotik.png': [50, 32],
    'LinIn.png': [50, 32],
    'char_1776627463516.png': [61, 43],
    'char_1776626039651.png': [52, 27],
    'char_1776463717210.png': [49, 22],
    'char_1778221131899.png': [34, 26],
    'char_1778221143711.png': [50, 28]
  });
  const targets = {sheet: .37, roster: .34, lore: .36, person: .42, detail: .42, thumb: .42};
  const selector = 'img[data-zg-portrait]';
  const tracked = new Set();
  const clamp = value => Math.max(0, Math.min(100, value));
  // Only immutable project portraits: uploaded images keep their own sources.
  function sources(person, context) {
    const path = String(person && (person.portrait || person.image) || '');
    if (!/^images\/portraits\/defaults\/(evan|melissa|esteros|vrotik|lin-yin)-(2026-11|classic)\.png$/.test(path)) return null;
    const base = path.slice(0, -4);
    return {srcset: base + '-thumb.jpg 384w, ' + base + '-display.jpg 1024w',
      sizes: context === 'thumb' ? '98px' : '(max-width: 899px) 100vw, 480px'};
  }
  function point(person) {
    const source = String(person.portrait || person.image || '').split(/[?#]/)[0].split('/').pop();
    const preset = presets[source] || [50, 35];
    return ['portraitFocusX', 'portraitFocusY'].map((key, i) =>
      typeof person[key] === 'number' && Number.isFinite(person[key]) ? clamp(person[key]) : preset[i]);
  }
  function attributes(person, context) {
    const [x, y] = point(person || {});
    return ' data-zg-portrait="' + (Object.hasOwn(targets, context) ? context : 'person') +
      '" data-portrait-x="' + x + '" data-portrait-y="' + y + '"' + sourceAttributes(person, context);
  }
  function sourceAttributes(person, context) {
    const source = sources(person, context);
    return source ? ' decoding="async" srcset="' + source.srcset + '" sizes="' + source.sizes + '"' : '';
  }
  function position(box, scaled, focal, target) {
    return Math.abs(box - scaled) < .1 ? 50 : clamp(100 * (box * target - scaled * focal / 100) / (box - scaled));
  }
  function fit(img) {
    if (!img.isConnected || !img.naturalWidth || !img.clientWidth || !img.clientHeight) return;
    const width = img.clientWidth, height = img.clientHeight;
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const x = Number(img.dataset.portraitX), y = Number(img.dataset.portraitY);
    const value = position(width, img.naturalWidth * scale, Number.isFinite(x) ? x : 50, .5).toFixed(2) + '% ' +
      position(height, img.naturalHeight * scale, Number.isFinite(y) ? y : 35, targets[img.dataset.zgPortrait] || .42).toFixed(2) + '%';
    if (img.style.objectPosition !== value) img.style.objectPosition = value;
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => entries.forEach(e => fit(e.target))) : null;
  function attach(img) {
    if (!tracked.has(img)) {
      tracked.add(img);
      img.addEventListener('load', onLoad);
      if (observer) observer.observe(img);
    }
    fit(img);
  }
  function onLoad(event) { fit(event.currentTarget); }
  function each(root, fn) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches(selector)) fn(root);
    root.querySelectorAll(selector).forEach(fn);
  }
  function refresh(root) { each(root || document.documentElement, attach); }
  function release(img) {
    if (img.isConnected) return;
    if (observer) observer.unobserve(img);
    img.removeEventListener('load', onLoad);
    tracked.delete(img);
  }
  function start() {
    refresh();
    new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes') { if (record.target.matches(selector)) attach(record.target); }
        else {
          record.addedNodes.forEach(node => each(node, attach));
          record.removedNodes.forEach(node => each(node, release));
        }
      });
    }).observe(document.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ['src', 'data-zg-portrait', 'data-portrait-x', 'data-portrait-y']});
    w.addEventListener('resize', () => tracked.forEach(fit), {passive: true});
  }
  w.ZargotaPortrait = Object.freeze({attributes, sources, sourceAttributes, point, position, refresh});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})(window);
