'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const art = require('../spell-art.js');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const catalog = Array.isArray(data.catalog) ? data.catalog : data.catalog.entries;
const levels = [...new Set(catalog.map(entry => String(entry.level)))];
const runtimeRecords = levels.flatMap(function (level) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images/spells/level' + level + '/manifest.json'), 'utf8'));
  assert.strictEqual(manifest.status, 'approved');
  return manifest.assets.map(function (asset) {
    assert.ok(asset.nameRu && asset.nameUk, asset.id + ' has both localized names');
    assert.match(asset.sourceSha256, /^[a-f0-9]{64}$/);
    assert.match(asset.runtimeSha256, /^[a-f0-9]{64}$/);
    assert.strictEqual(art.defaults[String(asset.id)], 'images/spells/level' + level + '/' + asset.file);
    return { ...asset, level };
  });
});
const reviewed = runtimeRecords;
assert.deepStrictEqual(runtimeRecords.map(asset => String(asset.id)).sort(), catalog.map(entry => String(entry.id)).sort(), 'every catalog spell has exactly one runtime record');

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

assert.strictEqual(reviewed.length, 116, 'all catalog illustrations are integrated');
assert.deepStrictEqual(Object.keys(art.defaults).sort(), catalog.map(entry => String(entry.id)).sort());
assert.strictEqual(new Set(Object.values(art.defaults)).size, catalog.length, 'every spell has distinct artwork');
assert.ok(art.defaults['1774560299194'].endsWith('/grave-strength-v11.webp'), 'approved two-layer spectral hands are retained');
assert.ok(art.defaults['1774559839673'].endsWith('/seal-of-patience-v3.webp'), 'latest repaired anatomy is retained');
assert.ok(art.defaults['1774697604591'].endsWith('/source-flare-eye-v3-v1.webp'), 'approved eye composition is retained');

let runtimeBytes = 0;
let checkedOriginals = 0;
reviewed.forEach(function (asset) {
  const spell = catalog.find(function (entry) { return String(entry.id) === String(asset.id); });
  assert.ok(spell, asset.id + ' exists in the published catalog');
  assert.strictEqual(String(spell.level), asset.level, asset.id + ' retains its catalog level');
  const before = JSON.stringify(spell);
  const resolved = art.resolve(spell);
  assert.strictEqual(resolved, art.resolve({ id: String(asset.id) }), 'numeric and string IDs share artwork');
  assert.strictEqual(resolved, 'images/spells/level' + asset.level + '/' + asset.file);
  assert.match(resolved, /^images\/spells\/level[1-5]\/[a-z0-9-]+-v\d+\.webp$/);
  const runtime = fs.readFileSync(path.join(root, resolved));
  assert.deepStrictEqual(webpDimensions(runtime), [1254, 1254], resolved + ' preserves the complete source dimensions');
  const runtimeRecord = runtimeRecords.find(function (record) { return String(record.id) === String(asset.id); });
  assert.ok(runtimeRecord.sourceFile, resolved + ' records the selected source revision');
  assert.strictEqual(crypto.createHash('sha256').update(runtime).digest('hex'), runtimeRecord.runtimeSha256, resolved + ' matches its approved runtime hash');
  // Review originals need not ship, but when present they must match provenance.
  if (asset.sourcePath && fs.existsSync(path.join(root, asset.sourcePath))) {
    const source = fs.readFileSync(path.join(root, asset.sourcePath));
    assert.strictEqual(crypto.createHash('sha256').update(source).digest('hex'), asset.sourceSha256, asset.sourceFile + ' matches selected original');
    assert.deepStrictEqual([source.readUInt32BE(16), source.readUInt32BE(20)], [1254, 1254]);
    assert.ok(runtime.length < source.length, resolved + ' is smaller than source PNG');
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
[
  'images/custom.png', 'images/spells/level1/unknown-v1.webp',
  'images/abilities/lin-in/existential-veil-v1.png',
  art.defaults[String(knownId)] + '?v=2#art',
  './' + art.defaults[String(knownId)],
  'https://example.com/custom.png', 'data:image/png;base64,YQ==', 'blob:https://example.com/custom'
].forEach(function (source) { assert.strictEqual(art.isScene(source), true, source + ' fills the illustration frame'); });
[
  'images/ui/combat-generated/folio.png',
  'images/ui/combat-generated/innate.png?v=2',
  './images/ui/mobile-skills/source-folio-v2.png'
].forEach(function (source) { assert.strictEqual(art.isScene(source), false, source + ' remains an inset symbol'); });
assert.strictEqual(art.resolveCustom({ iconAsset: '⚔', image: 'images/custom.png' }), 'images/custom.png');
assert.strictEqual(art.resolveCustom({ iconAsset: 'images/ui/combat-generated/folio.png' }), 'images/ui/combat-generated/folio.png');
assert.strictEqual(art.resolve({ id: knownId, iconAsset: 'images/ui/combat-generated/codex.png?v=old' }), art.defaults[String(knownId)], 'old application fallback does not hide approved art');
assert.strictEqual(art.resolve({ id: knownId, iconAsset: 'images/ui/combat-generated/codex.png', image: 'images/custom.png' }), 'images/custom.png', 'custom art still wins over a stored generic glyph');
assert.strictEqual(art.resolve({ id: knownId, iconAsset: 'images/ui/mobile-skills/thorn-v1.png' }), art.defaults[String(knownId)]);
assert.strictEqual(art.resolve({ id: 'unknown', iconAsset: 'images/ui/combat-generated/codex.png' }), 'images/ui/combat-generated/codex.png', 'unmapped abilities retain their fallback');
assert.strictEqual(art.isScene(null), false);
assert.ok(Object.isFrozen(art.defaults));
assert.ok(Object.isFrozen(art));
assert.throws(function () { art.defaults[String(knownId)] = 'images/changed.png'; }, TypeError);
const frozen = Object.freeze({ id: knownId, image: 'images/custom.png', effect: 'unchanged', level: '1' });
assert.strictEqual(art.resolve(frozen), 'images/custom.png');

const browser = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'spell-art.js'), 'utf8'), browser);
assert.strictEqual(browser.window.ZargotaSpellArt.resolve({ id: knownId }), art.defaults[String(knownId)], 'the browser and CommonJS APIs agree');

console.log('spell art: 116 full-size WebP assets, stable IDs, custom priority and immutable data passed (' + runtimeBytes + ' runtime bytes; ' + checkedOriginals + ' local originals verified)');

const revisedId = '1774560299194';
const oldArt = 'images/spells/level1/grave-strength-v3.webp';
['', '?v=old', '#art'].forEach(suffix => {
  assert.strictEqual(art.resolve({ id: revisedId, image: './' + oldArt + suffix }), art.defaults[revisedId], 'cached old built-in art follows revision');
});
assert.strictEqual(art.resolve({ id: revisedId, iconAsset: oldArt, image: 'images/custom/player.png' }), 'images/custom/player.png', 'uploaded art wins even after an outdated built-in field');
assert.strictEqual(art.resolve({ id: '1773672381766', image: oldArt }), oldArt, 'revision does not steal another spell custom selection');
assert.strictEqual(art.resolveCustom({ image: oldArt }), oldArt, 'personal abilities preserve explicit art');
