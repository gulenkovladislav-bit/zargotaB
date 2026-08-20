'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var automation = require('../spell-automation.js');

var profile = automation.resolve({ name: '✴\u202fЖар Пальцев' });
assert.ok(profile, 'Жар Пальцев has an automation profile');
assert.strictEqual(profile.automationKey, 'finger-heat-v1');
assert.strictEqual(profile.actionCost, 'long');
assert.strictEqual(profile.resolutionMode, 'attack');
assert.strictEqual(profile.usesAttackRoll, true);
assert.strictEqual(profile.attackStat, 'int');
assert.strictEqual(profile.targetRequired, true);
assert.strictEqual(profile.targetMode, 'target');
assert.strictEqual(profile.targetCount, 1);
assert.strictEqual(profile.rangeCells, 1);
assert.strictEqual(profile.damageFormula, '1d6');
assert.strictEqual(profile.damageType, 'fire');
assert.strictEqual(profile.maxUses, 1);
assert.strictEqual(profile.resourceScopeKind, 'battle');
assert.strictEqual(profile.animationKey, 'finger-heat-v1');
assert.strictEqual(profile.soundProfile, 'magic-fire');
assert.strictEqual(profile.iconAsset, 'images/ui/combat-generated/spell-finger-heat.png');
assert.deepStrictEqual(profile.nonCombat.targets, ['torch', 'oil', 'candle', 'campfire']);
assert.strictEqual(profile.nonCombat.manual, true, 'environment ignition remains explicit instead of silently mutating the scene');

assert.strictEqual(automation.resolve({ name: 'Искры' }), null, 'the removed Sparks prototype is not automated');
assert.strictEqual(automation.resolve({ name: 'Искры света' }), null, 'partial names must not accidentally inherit automation');
assert.strictEqual(automation.normalizeName(' ✴\u200BЖАР\u202fПАЛЬЦЕВ '), 'жар пальцев');

var untouched = automation.mergeMeta({ name: 'Неизвестное заклинание' }, { actionCost: 'short' });
assert.deepStrictEqual(untouched, { actionCost: 'short' }, 'unknown spells retain inferred catalog metadata');
var merged = automation.mergeMeta({ name: 'Жар Пальцев' }, { actionCost: 'short', damageFormula: '9d9' });
assert.strictEqual(merged.actionCost, 'long', 'the canonical automation profile wins over loose text inference');
assert.strictEqual(merged.damageFormula, '1d6');
assert.strictEqual(merged._source, 'automation:finger-heat-v1');

var rolls = [0.69, 0.49];
var preview = automation.buildPreview(profile, {
  actor:{ key:'hero', name:'Лин’Ин', stats:{ int:3 } },
  targets:[{ key:'rat', name:'QA Крыса', ac:12, hp:9, hpMax:9, tempHp:2 }]
}, function () { return rolls.shift(); });
assert.strictEqual(preview.results[0].roll, 14, 'preview rolls the attack once');
assert.strictEqual(preview.results[0].total, 17, 'preview adds the INT modifier');
assert.strictEqual(preview.results[0].success, true, 'preview compares the total with AC');
assert.strictEqual(preview.results[0].damage, 3, 'preview rolls 1d6 damage');
assert.strictEqual(preview.results[0].absorbed, 2, 'preview accounts for temporary HP');
assert.strictEqual(preview.results[0].hp, 8, 'preview projects HP without mutating the target');
assert.strictEqual(preview.results[0].tempHp, 0);

var resistantPreview = automation.buildPreview(profile, {
  actor:{ stats:{ int:0 } },
  targets:[{ key:'fire', ac:0, hp:10, resistances:['fire'] }]
}, function () { return .99; });
assert.strictEqual(resistantPreview.results[0].rawDamage, 12, 'critical attack doubles the damage dice');
assert.strictEqual(resistantPreview.results[0].damage, 6, 'fire resistance is reflected in the GM preview');

var missPreview = automation.buildPreview(profile, {
  actor:{ stats:{ int:0 } }, targets:[{ key:'miss', ac:20, hp:10 }]
}, function () { return 0; });
assert.strictEqual(missPreview.results[0].success, false);
assert.strictEqual(missPreview.results[0].damage, 0);
assert.strictEqual(missPreview.results[0].potentialDamage, 1, 'forcing a miss into a hit can restore the already rolled damage die');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
var network = fs.readFileSync(path.resolve(__dirname, '..', 'zargota-network.js'), 'utf8');
assert.match(html, /spell-automation\.js\?v=/, 'the browser loads the spell automation registry before combat adapters');
assert.match(html, /ZargotaSpellAutomation\.mergeMeta/, 'catalog parsing merges the canonical automation profile');
assert.match(html, /resourceScopeKind:meta\.resourceScopeKind==='battle'\?'battle':''/, 'only the supported battle resource scope reaches combat requests');
assert.match(network, /battleStartedAt>0\?'battle-'\+battleStartedAt:''/, 'battle-limited spell charges never collapse into battle-0');
assert.match(network, /animationKey:String\(details\.animationKey\|\|''\)/, 'requests preserve the automated visual key');
assert.match(network, /soundProfile:String\(details\.soundProfile\|\|''\)/, 'requests preserve the automated sound profile');
assert.match(network, /updates\.combatEvent\.animationKey=String\(effect\.animationKey\|\|''\)/, 'combat events preserve the automated visual key');
assert.match(network, /updates\.combatEvent\.soundProfile=String\(effect\.soundProfile\|\|''\)/, 'combat events preserve the automated sound profile');
assert.match(html, /automatedAbilityRequest\(request\)/, 'automated spells use the dedicated GM verdict instead of the generic builder');
assert.match(html, /Подтвердить и применить/, 'the GM receives an explicit apply boundary');
assert.doesNotMatch(html.slice(html.indexOf('w.zgAbilityResolveOpen=function'), html.indexOf('w.zgMovementRequestsToggle=function')), /openAbilityTargetEntity\(/, 'opening or selecting a spell target does not open the general GM panel');
assert.match(network, /approvedResults\[key\]/, 'the authoritative resolver accepts only the master-approved result map');
assert.match(network, /combat-ability-preview-invalid/, 'stale or incomplete approved previews are rejected');

console.log('Finger Heat spell automation contract passed');
