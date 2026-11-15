'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const art = require('../spell-art.js');
const root = path.resolve(__dirname, '..');
const reviewFolders = [
  'output/kodex-level1-review-2026-11-15',
  'output/foliant-level1-review-2026-11-15'
];
const reviewed = [
  [1773672381766, 'counter-thorn'], [1773672646696, 'sweeping-strike'],
  [1773672863195, 'storm-arrow'], [1773832374199, 'heart-mark'],
  [1773834230927, 'provocation'], [1774551795426, 'oak-stance'],
  [1774560024154, 'rage-stance'], [1774562729748, 'ghost-step'],
  [1774562867258, 'boar-rush'], [1774563134067, 'shadow-round'],
  [1773673009471, 'finger-heat'], [1773834544336, 'psychic-screech'],
  [1774556074255, 'saving-touch'], [1774556222800, 'comfort-whisper'],
  [1774556376586, 'holy-washing'], [1774560154079, 'breath-control'],
  [1774697449889, 'memory-beacon'], [1774697604591, 'source-flare-eye-v3'],
  [1775565442524, 'dry-current'], [1775565586025, 'icy-whisper']
].map(function (entry, index) {
  return {
    id: entry[0], stem: entry[1], folder: reviewFolders[index < 10 ? 0 : 1],
    file: String(index + 1).padStart(2, '0') + '-' + entry[1] + '.png'
  };
});
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const catalog = Array.isArray(data.catalog) ? data.catalog : data.catalog.entries;

function webpDimensions(buffer) {
  assert.strictEqual(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(buffer.toString('ascii', 8, 12), 'WEBP');
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const kind = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (kind === 'VP8X') return [1 + buffer.readUIntLE(start + 4, 3), 1 + buffer.readUIntLE(start + 7, 3)];
    if (kind === 'VP8 ') return [buffer.readUInt16LE(start + 6) & 0x3fff, buffer.readUInt16LE(start + 8) & 0x3fff];
    if (kind === 'VP8L') {
      const bits = buffer.readUInt32LE(start + 1);
      return [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)];
    }
    offset = start + length + (length % 2);
  }
  throw new Error('WebP dimension chunk is missing');
}

assert.strictEqual(reviewed.length, 20, 'both reviewed level-one batches contain twenty images');
assert.deepStrictEqual(Object.keys(art.defaults).sort(), reviewed.map(function (asset) { return String(asset.id); }).sort());
assert.strictEqual(new Set(Object.values(art.defaults)).size, 20, 'every spell has distinct artwork');
const flare = reviewed.find(function (asset) { return String(asset.id) === '1774697604591'; });
assert.strictEqual(flare.file, '18-source-flare-eye-v3.png', 'only the approved third eye composition is used');

let runtimeBytes = 0;
let checkedOriginals = 0;
reviewed.forEach(function (asset) {
  const spell = catalog.find(function (entry) { return String(entry.id) === String(asset.id); });
  assert.ok(spell, asset.id + ' exists in the published catalog');
  assert.strictEqual(String(spell.level), '1', asset.id + ' remains level one');
  const before = JSON.stringify(spell);
  const resolved = art.resolve(spell);
  assert.strictEqual(resolved, art.resolve({ id: String(asset.id) }), 'numeric and string IDs share artwork');
  assert.strictEqual(resolved, 'images/spells/level1/' + asset.stem + '-v1.webp');
  assert.match(resolved, /^images\/spells\/level1\/[a-z0-9-]+-v1\.webp$/);
  const runtime = fs.readFileSync(path.join(root, resolved));
  assert.deepStrictEqual(webpDimensions(runtime), [1254, 1254], resolved + ' preserves the complete source dimensions');
  // The deployable asset test also works without local image-review originals.
  const manifestPath = path.join(root, asset.folder, 'manifest.json');
  const sourcePath = path.join(root, asset.folder, asset.file);
  if (fs.existsSync(manifestPath) && fs.existsSync(sourcePath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const original = manifest.assets.find(function (entry) { return String(entry.id) === String(asset.id); });
    assert.ok(original, asset.id + ' is recorded in the review manifest');
    assert.strictEqual(original.file, asset.file, asset.id + ' uses the approved source revision');
    const source = fs.readFileSync(sourcePath);
    assert.strictEqual(crypto.createHash('sha256').update(source).digest('hex'), original.sha256, asset.file + ' retains its reviewed original');
    assert.deepStrictEqual([source.readUInt32BE(16), source.readUInt32BE(20)], [1254, 1254]);
    assert.ok(runtime.length < source.length, resolved + ' is smaller than the source PNG');
    checkedOriginals++;
  }
  assert.ok(art.isScene(resolved));
  assert.strictEqual(JSON.stringify(spell), before, 'resolving art leaves all mechanics and source fields unchanged');
  runtimeBytes += runtime.length;
});

const knownId = reviewed[0].id;
const fields = ['iconAsset', 'abilityIcon', 'iconImage', 'image', 'icon'];
fields.forEach(function (field, index) {
  const item = { id: knownId };
  fields.forEach(function (candidate, candidateIndex) {
    item[candidate] = candidateIndex < index ? 'javascript:alert(1)' : 'images/custom/' + candidate + '.webp';
  });
  assert.strictEqual(art.resolve(item), 'images/custom/' + field + '.webp', 'invalid higher-priority fields cannot hide ' + field);
});
[
  'images/custom.png', 'assets/custom.webp', './local.png', '../local.png',
  'https://example.com/custom.png', 'http://example.com/custom.png',
  'data:image/png;base64,YQ==', 'blob:https://example.com/custom'
].forEach(function (source) {
  assert.strictEqual(art.resolve({ id: knownId, image: '  ' + source + '  ' }), source, source + ' remains a supported custom source');
});
['javascript:alert(1)', 'data:text/html,test', 'file:///secret.png', '⚔', 'https:\n//example.com/art.png', '', null, 123, {}].forEach(function (source) {
  assert.strictEqual(art.resolve({ id: knownId, iconAsset: source }), art.defaults[String(knownId)]);
});
assert.strictEqual(art.resolve({ id: 'unknown', image: 'images/custom.png' }), 'images/custom.png');
assert.strictEqual(art.resolve({ id: 'unknown', name: 'Ответный Шип' }), '', 'unknown IDs never borrow a name match');
assert.strictEqual(art.resolve({ name: 'Жар Пальцев', automationKey: 'finger-heat-v1' }), '', 'names and battle profiles cannot select default art');
['__proto__', 'constructor', 'toString'].forEach(function (id) { assert.strictEqual(art.resolve({ id: id }), ''); });
[null, undefined, 1, '1773672381766'].forEach(function (item) { assert.strictEqual(art.resolve(item), ''); });
assert.strictEqual(art.isScene('images/custom.png'), false);
assert.strictEqual(art.isScene('images/spells/level1/unknown-v1.webp'), false);
assert.strictEqual(art.isScene(null), false);
assert.ok(Object.isFrozen(art.defaults));
assert.ok(Object.isFrozen(art));
assert.throws(function () { art.defaults[String(knownId)] = 'images/changed.png'; }, TypeError);
const frozen = Object.freeze({ id: knownId, image: 'images/custom.png', effect: 'unchanged', level: '1' });
assert.strictEqual(art.resolve(frozen), 'images/custom.png');

const browser = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'spell-art.js'), 'utf8'), browser);
assert.strictEqual(browser.window.ZargotaSpellArt.resolve({ id: knownId }), art.defaults[String(knownId)], 'the browser and CommonJS APIs agree');

console.log('spell art: twenty full-size WebP assets, stable IDs, custom priority and immutable data passed (' + runtimeBytes + ' runtime bytes; ' + checkedOriginals + ' local originals verified)');
