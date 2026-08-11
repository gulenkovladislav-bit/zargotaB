const assert = require('assert');
const presets = require('../combat-vfx-presets.js');

const catalog = presets.list();
assert.strictEqual(catalog.length, 10);
assert.strictEqual(new Set(catalog.map(preset => preset.id)).size, catalog.length, 'preset IDs are unique');
catalog.forEach(preset => {
  assert.strictEqual(presets.validate(preset).valid, true, preset.id + ' is valid');
  assert.strictEqual(preset.version, presets.VERSION);
  assert.ok(preset.hash, preset.id + ' has a compatibility hash');
  assert.ok(preset.budgets.high.particles >= preset.budgets.balanced.particles);
  assert.ok(preset.budgets.balanced.particles >= preset.budgets.low.particles);
  assert.ok((preset.budgets.high.trails || 0) >= (preset.budgets.balanced.trails || 0), preset.id + ' reduces trails before adding work');
  assert.strictEqual(preset.budgets.low.trails || 0, 0, preset.id + ' removes secondary trails in low quality');
  assert.ok(preset.budgets.low.particles >= 2, preset.id + ' keeps a readable primary impact silhouette');
  if(preset.key === 'projectile')assert.deepStrictEqual(
    [preset.budgets.high.projectiles, preset.budgets.balanced.projectiles, preset.budgets.low.projectiles],
    [1, 1, 1],
    'quality reduction never removes the gameplay-readable projectile'
  );
});

const event = {id:'shared-event-42',family:'spell'};
const high = presets.buildComposition('fire', event, 'high');
const balanced = presets.buildComposition('fire', event, 'balanced');
const low = presets.buildComposition('fire', event, 'low');
assert.deepStrictEqual(high.particles.slice(0, balanced.particles.length), balanced.particles, 'balanced is a deterministic subset of high');
assert.deepStrictEqual(high.particles.slice(0, low.particles.length), low.particles, 'low is a deterministic subset of high');
assert.deepStrictEqual(presets.buildComposition('fire', event, 'high'), high, 'same event reproduces the same composition');
assert.notDeepStrictEqual(presets.buildComposition('fire', {id:'other-event',family:'spell'}, 'high').particles, high.particles, 'a different event receives another composition');

const fallback = presets.resolve('future.unknown.v9', 'ranged');
assert.strictEqual(fallback.key, 'projectile');
assert.strictEqual(fallback.fallback, true);
assert.strictEqual(presets.resolve('projectile', 'ranged').fallback, false);

console.log('combat VFX presets passed');
