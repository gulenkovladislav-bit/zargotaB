'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `source block ${startMarker} must remain extractable`);
  return html.slice(start, end);
}

const helpers = sourceBetween(
  '  var combatDicePublishRegistry=Object.create(null);',
  '  function combatAttackRollItems('
);
const attack = sourceBetween(
  '  function animateCombatAttackResult(',
  '  function animateCombatDamageResult('
);
const damage = sourceBetween(
  '  function animateCombatDamageResult(',
  '  function combatRollOptions('
);
const intent = sourceBetween(
  '  w.zgCombatIntentRoll=function(){',
  '  w.zgCombatApprovedDamageRoll=function(){'
);

assert.match(helpers, /function stageSyncedCombatDiceThrow/);
assert.match(helpers, /function publishCombatDiceOnce/);
assert.match(helpers, /if\(!rollId\|\|combatDicePublishRegistry\[rollId\]\)return Promise\.resolve\(false\)/);

assert.strictEqual(
  (attack.match(/zgRenderLocalDiceThrow/g) || []).length,
  2,
  'attack keeps only the QA renderer guard and its QA call; network playback is published once'
);
assert.match(attack, /stageSyncedCombatDiceThrow\(attackClientId,throwMotion\)/);
assert.match(attack, /publishCombatDiceOnce\(attackClientId/);
assert.match(attack, /stageSyncedCombatDiceThrow\(singleAttackClientId,throwMotion\)/);
assert.match(attack, /publishCombatDiceOnce\(singleAttackClientId/);
assert.doesNotMatch(attack, /renderedRollVisuals\[attackClientId\]/);
assert.doesNotMatch(attack, /renderedRollVisuals\[singleAttackClientId\]/);

assert.doesNotMatch(damage, /zgRenderLocalDiceThrow/);
assert.match(damage, /stageSyncedCombatDiceThrow\(damageClientId,throwMotion\)/);
assert.match(damage, /publishCombatDiceOnce\(damageClientId/);

assert.match(intent, /if\(combatQaActive\(\)\)/);
assert.match(intent, /else if\(rolls\.length&&intentApi\.beginRollBatch\)/);
assert.match(intent, /stageSyncedCombatDiceThrow\(rollId,motion\)/);
assert.match(intent, /publishCombatDiceOnce\(rollId/);
assert.match(intent, /else if\(rolls\.length&&w\.zgRenderLocalDiceThrow\)/);

const context = {
  Promise,
  Date,
  Object,
  localPhysicalRolls: Object.create(null),
  localThrowMotions: Object.create(null)
};
vm.createContext(context);
vm.runInContext(helpers, context);

(async function verifyExactlyOncePublisher() {
  let publications = 0;
  const motion = {x: 120, y: 30};
  context.stageSyncedCombatDiceThrow('combat-save-request-1', motion);
  assert.strictEqual(context.localThrowMotions['combat-save-request-1'], motion);
  assert.ok(context.localPhysicalRolls['combat-save-request-1'] > Date.now());

  const first = context.publishCombatDiceOnce('combat-save-request-1', () => {
    publications += 1;
    return Promise.resolve('published');
  });
  const repeated = context.publishCombatDiceOnce('combat-save-request-1', () => {
    publications += 1;
    return Promise.resolve('duplicate');
  });
  const results = await Promise.all([first, repeated]);
  assert.strictEqual(publications, 1, 'one combat roll id is published only once');
  assert.strictEqual(results[0], 'published');
  assert.strictEqual(results[1], false);
  console.log('combat dice single publish passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
