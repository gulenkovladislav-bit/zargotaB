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
    id: entry[0], stem: entry[1], level: '1', folder: reviewFolders[index < 10 ? 0 : 1],
    file: String(index + 1).padStart(2, '0') + '-' + entry[1] + '.png'
  };
}).concat([
  {"id":1773702048611,"stem":"ray-of-rot","revision":3,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"21-ray-of-rot-v3.png"},
  {"id":1773835374611,"stem":"one-word-command","revision":3,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"22-one-word-command-v3.png"},
  {"id":1774547837394,"stem":"dead-mans-scream","revision":1,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"23-dead-mans-scream.png"},
  {"id":1774552085257,"stem":"false-life","revision":2,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"24-false-life-v2.png"},
  {"id":1774560299194,"stem":"grave-strength","revision":3,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"25-grave-strength-v3.png"},
  {"id":1774560449555,"stem":"drop-of-betrayal","revision":2,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"26-drop-of-betrayal-v2.png"},
  {"id":1774560615264,"stem":"blood-scorch","revision":1,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"27-blood-scorch.png"},
  {"id":1774699462737,"stem":"seeker-of-evil","revision":1,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"28-seeker-of-evil.png"},
  {"id":1775567449210,"stem":"evil-eye","revision":1,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"29-evil-eye.png"},
  {"id":1775567656257,"stem":"minor-curse","revision":1,"level":"1","folder":"output/obrad-level1-review-2026-11-15","file":"30-minor-curse.png"},
  {"id":1775568519798,"stem":"summon-undead","revision":1,"level":"1","folder":"output/spell-icons-31-40-review-2026-11-15","file":"31-summon-undead.png"},
  {"id":1773702698728,"stem":"circular-strike","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"32-circular-strike.png"},
  {"id":1773703580969,"stem":"through-shot","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"33-through-shot.png"},
  {"id":1773704142146,"stem":"multiple-volley","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"34-multiple-volley.png"},
  {"id":1774548621809,"stem":"tactical-control","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"35-tactical-control.png"},
  {"id":1774549041232,"stem":"disarm","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"36-disarm.png"},
  {"id":1774553565101,"stem":"blur","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"37-blur.png"},
  {"id":1774553719987,"stem":"counter-rush","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"38-counter-rush.png"},
  {"id":1774553876524,"stem":"cover-ally","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"39-cover-ally.png"},
  {"id":1774554059361,"stem":"living-barrier","revision":1,"level":"2","folder":"output/spell-icons-31-40-review-2026-11-15","file":"40-living-barrier.png"},
  {"id":1774560834956,"stem":"flame-charge","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"41-flame-charge.png"},
  {"id":1773704473098,"stem":"fire-projectile","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"42-fire-projectile.png"},
  {"id":1773704738759,"stem":"whirlwind-of-blades","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"43-whirlwind-of-blades.png"},
  {"id":1774549339231,"stem":"lightning-lasso","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"44-lightning-lasso.png"},
  {"id":1774556597370,"stem":"support","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"45-support.png"},
  {"id":1774566110687,"stem":"illusion","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"46-illusion.png"},
  {"id":1774566290057,"stem":"invisibility","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"47-invisibility.png"},
  {"id":1775558042161,"stem":"detect-thoughts","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"48-detect-thoughts.png"},
  {"id":1775558318136,"stem":"hypocrite","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"49-hypocrite.png"},
  {"id":1775565731791,"stem":"mending","revision":1,"level":"2","folder":"output/spell-icons-41-50-review-2026-11-15","file":"50-mending.png"}
]).concat([
  [1775565893506, 'spectral-hand'], [1774549524026, 'defile-mind'],
  [1774549676464, 'seal-of-silence'], [1774556923997, 'cleansing-ritual'],
  [1774561054506, 'absorb-elements'], [1774563690250, 'levitation'],
  [1774563873341, 'misty-passage'], [1775558603938, 'darkvision'],
  [1775558838524, 'see-invisible'], [1775560758891, 'animal-courier']
].map(function (entry, index) {
  return {
    id: entry[0], stem: entry[1], level: '2', folder: 'output/spell-icons-51-60-review-2026-11-15',
    file: String(index + 51) + '-' + entry[1] + '.png'
  };
}));
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const catalog = Array.isArray(data.catalog) ? data.catalog : data.catalog.entries;
const runtimeRecords = ['1', '2'].flatMap(function (level) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images/spells/level' + level + '/manifest.json'), 'utf8'));
  assert.strictEqual(manifest.status, 'approved');
  return manifest.assets.map(function (asset) {
    assert.ok(asset.nameRu && asset.nameUk, asset.id + ' has both localized names');
    assert.match(asset.sourceSha256, /^[a-f0-9]{64}$/);
    assert.match(asset.runtimeSha256, /^[a-f0-9]{64}$/);
    assert.strictEqual(art.defaults[String(asset.id)], 'images/spells/level' + level + '/' + asset.file);
    return asset;
  });
});
assert.deepStrictEqual(runtimeRecords.map(function (asset) { return String(asset.id); }).sort(), Object.keys(art.defaults).sort(), 'runtime manifests cover every default exactly once');

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

assert.strictEqual(reviewed.length, 60, 'the approved batches contain sixty reviewed spell images');
assert.strictEqual(reviewed.filter(function (asset) { return asset.level === '1'; }).length, 31, 'all thirty-one level-one images are included');
assert.strictEqual(reviewed.filter(function (asset) { return asset.level === '2'; }).length, 29, 'all twenty-nine reviewed level-two images are included');
assert.deepStrictEqual(Object.keys(art.defaults).sort(), reviewed.map(function (asset) { return String(asset.id); }).sort());
assert.strictEqual(new Set(Object.values(art.defaults)).size, 60, 'every spell has distinct artwork');
const flare = reviewed.find(function (asset) { return String(asset.id) === '1774697604591'; });
assert.strictEqual(flare.file, '18-source-flare-eye-v3.png', 'only the approved third eye composition is used');

[[1773702048611, 3], [1773835374611, 3], [1774552085257, 2], [1774560299194, 3], [1774560449555, 2]].forEach(function (entry) {
  const asset = reviewed.find(function (candidate) { return candidate.id === entry[0]; });
  assert.strictEqual(asset.revision, entry[1], asset.id + ' uses the latest corrected composition');
});

let runtimeBytes = 0;
let checkedOriginals = 0;
reviewed.forEach(function (asset) {
  const spell = catalog.find(function (entry) { return String(entry.id) === String(asset.id); });
  assert.ok(spell, asset.id + ' exists in the published catalog');
  assert.strictEqual(String(spell.level), asset.level, asset.id + ' retains its catalog level');
  const before = JSON.stringify(spell);
  const resolved = art.resolve(spell);
  assert.strictEqual(resolved, art.resolve({ id: String(asset.id) }), 'numeric and string IDs share artwork');
  assert.strictEqual(resolved, 'images/spells/level' + asset.level + '/' + asset.stem + '-v' + (asset.revision || 1) + '.webp');
  assert.match(resolved, /^images\/spells\/level[12]\/[a-z0-9-]+-v[123]\.webp$/);
  const runtime = fs.readFileSync(path.join(root, resolved));
  assert.deepStrictEqual(webpDimensions(runtime), [1254, 1254], resolved + ' preserves the complete source dimensions');
  const runtimeRecord = runtimeRecords.find(function (record) { return String(record.id) === String(asset.id); });
  assert.strictEqual(runtimeRecord.sourceFile, asset.file, resolved + ' records the selected source revision');
  assert.strictEqual(crypto.createHash('sha256').update(runtime).digest('hex'), runtimeRecord.runtimeSha256, resolved + ' matches its approved runtime hash');
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
    assert.strictEqual(runtimeRecord.sourceSha256, original.sha256, resolved + ' records the approved source hash');
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

console.log('spell art: sixty full-size WebP assets, stable IDs, custom priority and immutable data passed (' + runtimeBytes + ' runtime bytes; ' + checkedOriginals + ' local originals verified)');
