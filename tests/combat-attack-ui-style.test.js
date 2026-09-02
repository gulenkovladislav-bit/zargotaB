'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function block(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `${startNeedle} must remain inspectable`);
  return source.slice(start, end);
}

const render = block(html, '  function renderCombatAttack(force){', '  w.zgCombatAttackToggle=');
const styles = block(html, '  .zg-combat-prepared-item{', '  .zg-combat-save-open{');
const weaponVisual = block(html, '  function combatAttackWeaponVisual(attacker,weapon){', '  function clearCombatTargetCandidates()');
const weaponChoices = block(html, '  function combatAttackWeapons(attacker){', '  function combatAttackWeaponVisual(attacker,weapon){');

assert.match(render, /class="zg-combat-attack-main"/, 'attack weapon and attacker summary keep their layout wrapper');
assert.match(render, /details class="zg-combat-attack-advanced"/, 'roll modifiers remain a deliberate expandable panel');
assert.match(render, /class="zg-combat-attack-warning"/, 'range and rules warnings keep their styled container');
assert.match(html, /className='zg-combat-request-sent'/, 'attack request feedback keeps a dedicated toast element');
assert.match(render, /class="zg-combat-confirm-actions '\+\(selectedTarget\?'has-target':'\'\)\+'"/, 'player confirmation exposes the three-action target state');
assert.match(weaponVisual, /character\.equipItems/, 'attack art resolves the equipped source item');
assert.match(weaponVisual, /character\.inventoryItems/, 'attack art can resolve a source item mirrored in the inventory');
assert.match(weaponVisual, /w\.charInventoryImage/, 'attack art reuses the optimized inventory image resolver');
assert.match(weaponChoices, /inventoryWeaponProjection\(source,attacker\.weaponProfiles\)/, 'attack choices recover equipped bag weapons from the current character or token');
assert.match(render, /weaponVisual\.image\?'<img src=/, 'a weapon sourced from an item displays its actual item art');
assert.match(render, /ЭКИПИРОВАННЫЙ ПРЕДМЕТ/, 'the attack card identifies an equipped item source');

assert.match(styles, /\.zg-combat-attack-main\{display:grid;grid-template-columns:minmax\(180px,1fr\) auto/, 'weapon selector cannot overlap the attacker summary');
assert.match(styles, /\.zg-combat-attack-main select\{height:36px;[^}]*background:#0a0705;[^}]*font:10px Georgia/, 'weapon selector keeps the themed compact control');
assert.match(styles, /\.zg-combat-attack-advanced\{margin-top:8px;border:1px solid #302216/, 'advanced roll settings keep the bordered panel');
assert.match(styles, /\.zg-combat-attack-advanced summary\{padding:8px 10px;[^}]*font:8px 'Cinzel'/, 'advanced settings summary cannot fall back to oversized browser text');
assert.match(styles, /\.zg-combat-attack-warning\{display:grid;[^}]*border:1px solid #b26a2d/, 'combat warnings remain visually distinct');
assert.match(styles, /\.zg-combat-request-sent\.show\{opacity:1;/, 'request feedback has an explicit visible state');
assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{\.zg-combat-request-sent/, 'request feedback respects reduced motion');
assert.match(styles, /\.zg-prepared-actions\{display:grid;grid-template-columns:1fr 1fr/, 'prepared action controls retain their compact layout');
assert.match(styles, /\.zg-combat-confirm-actions\.has-target\{grid-template-columns:\.75fr 1fr 1\.35fr/, 'desktop player confirmation keeps all target actions aligned');
assert.match(styles, /\.zg-combat-confirm-actions button\.target-pick\{border-color:#77602d/, 'target-pick action remains identifiable');
assert.match(styles, /\.zg-combat-attack-duel>span\.from-item\{border-color:#896127/, 'equipped item attacks get a distinct authored card treatment');
assert.match(styles, /\.zg-combat-attack-duel>span>img,[^}]*width:58px;height:58px/, 'the real weapon icon remains legible in the duel card');
assert.match(styles, /@media\(max-width:520px\)[\s\S]*\.zg-combat-confirm-actions\.has-target \.approve\{grid-column:1\/-1\}/, 'mobile confirmation gives approval its own full row');

console.log('combat attack UI style contracts passed');
