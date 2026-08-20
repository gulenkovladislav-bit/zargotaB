'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sources = fs.readFileSync(path.join(root, 'audio/vtt-actions/SOURCES.md'), 'utf8');

const assets = [
  'damage-impact.mp3',
  'target-hover-attack.ogg',
  'target-hover-spell.mp3',
  'combat-start-drums.mp3',
  'inventory-drag.ogg',
  'inventory-equip.ogg',
  'inventory-unequip.ogg',
  'inventory-tab.ogg',
  'bag-close.ogg'
];

assets.forEach(function (file) {
  const absolute = path.join(root, 'audio/vtt-actions', file);
  assert.ok(fs.existsSync(absolute), 'missing custom sound: ' + file);
  assert.ok(fs.statSync(absolute).size > 4000, 'custom sound is unexpectedly empty: ' + file);
  assert.match(sources, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'source registry names ' + file);
  assert.match(html, new RegExp('audio/vtt-actions/' + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'sound engine registers ' + file);
});

assert.match(html, /damage: function\(\) \{[\s\S]*?sampleSources\.damageImpact[\s\S]*?group:'impact'/, 'manual and magical damage use the recorded impact');
assert.match(html, /hit: function\(\) \{[\s\S]*?sampleSources\.damageImpact[\s\S]*?group:'impact'/, 'ordinary physical damage uses the replacement impact too');
assert.match(html, /combatStart: function\(\) \{[\s\S]*?sampleSources\.combatStart[\s\S]*?group:'turn-flow'/, 'combat activation uses a dedicated recorded stinger');
assert.match(html, /attackTargetHover: function\(\) \{[\s\S]*?sampleSources\.targetHoverAttack/, 'attack targeting has its own recorded lock cue');
assert.match(html, /spellTargetHover: function\(\) \{[\s\S]*?sampleSources\.targetHoverSpell/, 'spell targeting has its own recorded magic cue');
assert.match(html, /if\(nextId===attackHoverTokenId\)return;/, 'remaining over one attack target cannot replay hover audio');
assert.match(html, /syncAttackTargetHover\(hoveredTarget\)/, 'attack pointer routing reaches the target-specific cue');
assert.match(html, /pointerleave'[\s\S]*?syncAttackTargetHover\(null\)/, 'leaving the scene resets attack hover without crossing module boundaries');
assert.match(html, /syncAbilityTargetHover[\s\S]*?ZargotaSound\.spellTargetHover/, 'spell pointer routing reaches the magic-specific cue');
const clearCandidates = html.slice(html.indexOf('  function clearCombatTargetCandidates()'), html.indexOf('  function markCombatTargetCandidates()', html.indexOf('  function clearCombatTargetCandidates()')));
assert.doesNotMatch(clearCandidates, /syncAttackTargetHover/, 'combat module must not call the scene module private hover helper');

assert.match(html, /zgVttInventoryDrag=function[\s\S]*?ZargotaSound\.inventoryDrag/, 'starting an item drag has a recorded cue');
assert.match(html, /commitInventoryMutation\(member,c,before,'inventory-equip'[\s\S]*?if\(saved\)[\s\S]*?ZargotaSound\.inventoryEquip/, 'equip audio waits for a successful mutation');
assert.match(html, /commitInventoryMutation\(member,c,before,'inventory-unequip'[\s\S]*?if\(saved\)[\s\S]*?ZargotaSound\.inventoryUnequip/, 'unequip audio waits for a successful mutation');
assert.match(html, /if\(!drawerWasOpen&&w\.ZargotaSound\.bagOpen\)/, 'opening the backpack has a dedicated bag cue');
assert.match(html, /previousPanel!==panel&&w\.ZargotaSound\.inventoryTab/, 'switching backpack sections has a light tab cue');
assert.match(html, /wasBackpackOpen&&!options\.silent[\s\S]*?ZargotaSound\.bagClose/, 'closing the backpack has a complementary cue');
assert.match(html, /zgVttInventoryFilter=function[\s\S]*?next!==inventoryFilter[\s\S]*?ZargotaSound\.inventoryTab/, 'inventory category buttons use the tab cue only when selection changes');

assert.match(html, /claimCombatPlaybackEvent\(event,'damage-impact-sound'\)/, 'new damage sample keeps the existing exactly-once combat channel');

console.log('custom combat and inventory sounds passed');
