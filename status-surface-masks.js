(function (global) {
  'use strict';

  var VIEW_BOX = Object.freeze({ x: 0, y: 0, width: 100, height: 100 });
  var PROFILES = Object.freeze({
    token: Object.freeze({
      key: 'token',
      selector: '.zg-vtt-token',
      targetSelector: 'img,.zg-vtt-token-ph',
      shape: 'circle',
      logicalMin: 24,
      logicalMax: 240,
      detailTiers: Object.freeze([
        Object.freeze({ max: 32, name: 'coarse' }),
        Object.freeze({ max: 64, name: 'normal' }),
        Object.freeze({ max: 240, name: 'full' })
      ]),
      observeResize: false
    }),
    party: Object.freeze({
      key: 'party',
      selector: '.zg-party-card',
      targetSelector: 'img,.zg-party-ph',
      shape: 'rounded-rect',
      knownSizes: Object.freeze([
        Object.freeze({ width: 82, height: 76, name: 'desktop' }),
        Object.freeze({ width: 70, height: 66, name: 'compact' })
      ]),
      observeResize: true
    }),
    state: Object.freeze({
      key: 'state',
      selector: '.zg-state-portrait',
      targetSelector: 'img,span',
      shape: 'rounded-rect',
      observeResize: true
    }),
    character: Object.freeze({
      key: 'character',
      selector: '.portrait-box',
      targetSelector: '.portrait-img,img',
      shape: 'rounded-rect',
      knownSizes: Object.freeze([
        Object.freeze({ width: 110, height: 140, name: 'editor' })
      ]),
      observeResize: true
    }),
    sheet: Object.freeze({
      key: 'sheet',
      selector: '#zg-sheet-portrait-host',
      targetSelector: '.zg-sheet-portrait,img',
      shape: 'rounded-rect',
      observeResize: true
    })
  });

  var registrations = typeof WeakMap === 'function' ? new WeakMap() : null;
  var resizeObserver = null;

  function number(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, number(value, min)));
  }

  function profileFor(key) {
    return PROFILES[key] || null;
  }

  function rectOf(element) {
    var rect = element && typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : null;
    return {
      left: number(rect && rect.left, 0),
      top: number(rect && rect.top, 0),
      width: Math.max(0, number(rect && rect.width, 0)),
      height: Math.max(0, number(rect && rect.height, 0))
    };
  }

  function targetFor(element, profile) {
    if (!element || !profile || !profile.targetSelector || typeof element.querySelector !== 'function') return element;
    return element.querySelector(profile.targetSelector) || element;
  }

  function tokenDetail(size, profile) {
    var tiers = profile && profile.detailTiers || [];
    for (var i = 0; i < tiers.length; i += 1) {
      if (size <= tiers[i].max) return tiers[i].name;
    }
    return tiers.length ? tiers[tiers.length - 1].name : 'full';
  }

  function measure(element, key) {
    var profile = profileFor(key);
    if (!element || !profile) return null;
    var host = rectOf(element);
    var target = targetFor(element, profile);
    var image = rectOf(target);
    var logicalSize = profile.key === 'token'
      ? clamp(Math.min(image.width || host.width, image.height || host.height), profile.logicalMin, profile.logicalMax)
      : null;
    return Object.freeze({
      key: profile.key,
      shape: profile.shape,
      viewBox: VIEW_BOX,
      host: Object.freeze(host),
      image: Object.freeze({
        left: image.left - host.left,
        top: image.top - host.top,
        width: image.width,
        height: image.height
      }),
      aspect: image.height > 0 ? image.width / image.height : 0,
      dpr: Math.max(1, number(global.devicePixelRatio, 1)),
      logicalSize: logicalSize,
      detail: logicalSize == null ? 'full' : tokenDetail(logicalSize, profile)
    });
  }

  function applyMeasurement(element, key) {
    var result = measure(element, key);
    if (!result) return null;
    if (element.dataset) element.dataset.statusSurface = key;
    if (element.style && typeof element.style.setProperty === 'function') {
      element.style.setProperty('--zg-status-host-w', result.host.width + 'px');
      element.style.setProperty('--zg-status-host-h', result.host.height + 'px');
      element.style.setProperty('--zg-status-image-x', result.image.left + 'px');
      element.style.setProperty('--zg-status-image-y', result.image.top + 'px');
      element.style.setProperty('--zg-status-image-w', result.image.width + 'px');
      element.style.setProperty('--zg-status-image-h', result.image.height + 'px');
      element.style.setProperty('--zg-status-aspect', String(result.aspect || 0));
    }
    return result;
  }

  function pointToPixels(measurement, point) {
    if (!measurement || !point) return null;
    return {
      x: measurement.image.left + measurement.image.width * clamp(point.x, 0, 100) / 100,
      y: measurement.image.top + measurement.image.height * clamp(point.y, 0, 100) / 100
    };
  }

  function pointToNormalized(measurement, point) {
    if (!measurement || !point || !measurement.image.width || !measurement.image.height) return null;
    return {
      x: clamp((number(point.x, 0) - measurement.image.left) * 100 / measurement.image.width, 0, 100),
      y: clamp((number(point.y, 0) - measurement.image.top) * 100 / measurement.image.height, 0, 100)
    };
  }

  function ensureObserver() {
    if (resizeObserver || typeof global.ResizeObserver !== 'function') return resizeObserver;
    resizeObserver = new global.ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i += 1) {
        var element = entries[i].target;
        var key = registrations && registrations.get(element);
        if (key) applyMeasurement(element, key);
      }
    });
    return resizeObserver;
  }

  function observe(element, key) {
    var profile = profileFor(key);
    if (!element || !profile) return function () {};
    applyMeasurement(element, key);
    if (!profile.observeResize) return function () {};
    var observer = ensureObserver();
    if (!observer || !registrations) return function () {};
    registrations.set(element, key);
    observer.observe(element);
    return function () {
      registrations.delete(element);
      observer.unobserve(element);
    };
  }

  function surfaceGeometry(key) {
    var profile = profileFor(key);
    if (!profile) return null;
    return profile.shape === 'circle'
      ? Object.freeze({ type: 'circle', cx: 50, cy: 50, r: 50 })
      : Object.freeze({ type: 'rounded-rect', x: 0, y: 0, width: 100, height: 100, rx: 4, ry: 4 });
  }

  global.ZargotaStatusMasks = Object.freeze({
    version: 1,
    viewBox: VIEW_BOX,
    profiles: PROFILES,
    measure: measure,
    applyMeasurement: applyMeasurement,
    observe: observe,
    pointToPixels: pointToPixels,
    pointToNormalized: pointToNormalized,
    surfaceGeometry: surfaceGeometry
  });
})(window);
