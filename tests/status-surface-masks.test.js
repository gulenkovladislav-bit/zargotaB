'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var source = fs.readFileSync(path.resolve(__dirname, '..', 'status-surface-masks.js'), 'utf8');
var observed = [];
var unobserved = [];
var observerCount = 0;
function FakeResizeObserver(callback) {
  observerCount += 1;
  this.callback = callback;
  this.observe = function (element) { observed.push(element); };
  this.unobserve = function (element) { unobserved.push(element); };
}
var context = {
  window: {
    devicePixelRatio: 2,
    ResizeObserver: FakeResizeObserver
  },
  WeakMap: WeakMap,
  Object: Object,
  Number: Number,
  Math: Math
};
vm.runInNewContext(source, context);

var api = context.window.ZargotaStatusMasks;
assert.ok(api, 'mask measurement API must be exported');
assert.deepStrictEqual(Object.keys(api.profiles), ['token', 'party', 'state', 'character', 'sheet']);
assert.strictEqual(api.profiles.token.logicalMin, 24);
assert.strictEqual(api.profiles.token.logicalMax, 240);
assert.strictEqual(api.profiles.token.observeResize, false, 'tokens must not allocate ResizeObserver work');
assert.strictEqual(api.profiles.party.knownSizes[0].width, 82);
assert.strictEqual(api.profiles.party.knownSizes[1].width, 70);

function fakeElement(hostRect, imageRect) {
  var properties = {};
  var image = { getBoundingClientRect: function () { return imageRect || hostRect; } };
  return {
    dataset: {},
    style: {
      setProperty: function (name, value) { properties[name] = value; }
    },
    properties: properties,
    getBoundingClientRect: function () { return hostRect; },
    querySelector: function () { return image; }
  };
}

var token = fakeElement(
  { left: 100, top: 50, width: 24, height: 24 },
  { left: 100, top: 50, width: 24, height: 24 }
);
var tokenMeasurement = api.applyMeasurement(token, 'token');
assert.strictEqual(tokenMeasurement.logicalSize, 24);
assert.strictEqual(tokenMeasurement.detail, 'coarse');
assert.strictEqual(tokenMeasurement.dpr, 2);
assert.strictEqual(token.dataset.statusSurface, 'token');
assert.strictEqual(token.properties['--zg-status-image-w'], '24px');
var stopToken = api.observe(token, 'token');
assert.strictEqual(observed.length, 0, 'token observation must remain measurement-only');
stopToken();

var party = fakeElement(
  { left: 10, top: 20, width: 82, height: 105 },
  { left: 10, top: 20, width: 82, height: 76 }
);
var partyMeasurement = api.measure(party, 'party');
assert.strictEqual(partyMeasurement.host.height, 105);
assert.strictEqual(partyMeasurement.image.height, 76, 'image area must be separate from card labels and HP bar');
assert.strictEqual(api.pointToPixels(partyMeasurement, { x: 50, y: 50 }).x, 41);
assert.strictEqual(api.pointToPixels(partyMeasurement, { x: 50, y: 50 }).y, 38);
var normalized = api.pointToNormalized(partyMeasurement, { x: 41, y: 38 });
assert.strictEqual(normalized.x, 50);
assert.strictEqual(normalized.y, 50);

var stopParty = api.observe(party, 'party');
assert.strictEqual(observerCount, 1, 'all responsive surfaces must share one ResizeObserver');
assert.strictEqual(observed.length, 1);
stopParty();
assert.strictEqual(unobserved.length, 1);

var state = fakeElement(
  { left: 0, top: 0, width: 260, height: 205 },
  { left: 5, top: 5, width: 250, height: 195 }
);
api.observe(state, 'state');
assert.strictEqual(observerCount, 1, 'a second surface must reuse the observer');
assert.strictEqual(observed.length, 2);

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(api.surfaceGeometry('token'))),
  { type: 'circle', cx: 50, cy: 50, r: 50 }
);
assert.strictEqual(api.surfaceGeometry('state').type, 'rounded-rect');
assert.strictEqual(api.surfaceGeometry('missing'), null);

assert.ok(!/firebase|localStorage|setInterval|requestAnimationFrame/i.test(source), 'measurement layer must stay local and event-driven');
console.log('status surface mask tests passed');
