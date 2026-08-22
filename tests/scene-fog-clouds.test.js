'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
const presets = ['soft', 'storm', 'serpent', 'dense', 'wisps', 'vortex'];

assert.match(html, /fogClouds:\[\]/, 'legacy scene defaults must include an empty fog cloud collection');
assert.match(html, /id="zg-fog-panel"/, 'fog must have its own compact GM tab');
assert.match(html, /data-scene-tools-tab="fog"/, 'scene tools must expose the fog tab');
assert.match(html, /id="zg-fog-cloud-layer"/, 'scene must render a dedicated cloud layer');
assert.match(html, /function placeFogCloud\(point\)/, 'a selected preset must be placeable on the map');
assert.match(html, /function beginFogCloudDrag\(/, 'placed cloud must be directly draggable');
assert.match(html, /id="zg-fog-cloud-rotation-input" type="range" min="-180" max="180" step="1"/, 'cloud editor must expose precise full-circle rotation');
assert.match(html, /zgFogCloudRotationSet/, 'cloud rotation slider must update the selected cloud');
assert.match(html, /zgFogCloudRotate\(-15\)/, 'cloud editor must keep a quick counter-clockwise step');
assert.match(html, /zgFogCloudRotate\(15\)/, 'cloud editor must keep a quick clockwise step');
assert.match(html, /onclick="zgFogCloudRotationSet\(0\)"/, 'cloud editor must expose a rotation reset');
assert.match(html, /rotate\('\+cloud\.rotation\+'deg\)'/, 'cloud rotation must be visible in the scene transform');
assert.match(html, /zgFogCloudDuplicate/, 'cloud editor must expose duplication');
assert.match(html, /fogCloudConceals\(cloud\)&&pointInFogCloud/, 'cloud fog must participate in token concealment');
assert.match(network, /fogClouds: fogClouds/, 'clouds must survive Firebase scene sanitization');

presets.forEach((preset) => {
  assert.match(html, new RegExp(`${preset}:\\{label:`), `preset ${preset} must be registered`);
  const file = path.join(root, 'images', 'vtt-fog', `fog-cloud-${preset}.png`);
  assert.ok(fs.existsSync(file), `missing generated fog texture: ${path.basename(file)}`);
  const png = fs.readFileSync(file);
  assert.strictEqual(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.ok(png.readUInt32BE(16) >= 1024 && png.readUInt32BE(20) >= 1024, `${preset} texture is too small`);
  assert.strictEqual(png[25], 6, `${preset} texture must be RGBA with an alpha channel`);
});

const sanitizeStart = network.indexOf('function sanitizeScene(scene)');
const sanitizeEnd = network.indexOf('var api =', sanitizeStart);
const context = { roomError:(message) => new Error(message), isFinite:isFinite };
vm.runInNewContext(network.slice(sanitizeStart, sanitizeEnd), context);

const legacy = context.sanitizeScene({});
assert.deepStrictEqual(Array.from(legacy.fogClouds), [], 'old scenes must remain compatible');

const incoming = Array.from({length:41}, (_, index) => ({
  id:`cloud-${index}`,
  preset:index === 0 ? 'foreign-preset' : presets[index % presets.length],
  x:index === 0 ? -20 : 48,
  y:index === 0 ? 140 : 52,
  size:index === 0 ? 999 : 24,
  rotation:index === 0 ? 900 : 12,
  opacity:index === 0 ? 9 : .7,
  visible:index !== 2
}));
const sanitized = context.sanitizeScene({fogClouds:incoming});
assert.strictEqual(sanitized.fogClouds.length, 40, 'network payload must cap cloud count');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanitized.fogClouds[0])), {
  id:'cloud-0', preset:'soft', x:0, y:100, size:55, rotation:180, opacity:1, visible:true
});
assert.strictEqual(sanitized.fogClouds[2].visible, false, 'hidden cloud state must survive publication');

console.log('scene fog cloud tests passed');
