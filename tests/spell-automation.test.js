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

console.log('Finger Heat spell automation contract passed');
