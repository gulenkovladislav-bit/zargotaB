'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const settingsStart = html.indexOf("  var combatMotionPreference='anchored'");
const settingsEnd = html.indexOf('  var COMBAT_FX_PRESETS=', settingsStart);
const settings = html.slice(settingsStart, settingsEnd);
const qualitySetterStart = settings.indexOf('  w.zgCombatQualitySet=function(mode)');
const qualitySetterEnd = settings.indexOf('  };', qualitySetterStart) + 4;
const qualitySetter = settings.slice(qualitySetterStart, qualitySetterEnd);

assert.ok(settingsStart >= 0 && settingsEnd > settingsStart, 'quality settings remain extractable');
assert.match(settings, /localStorage\.getItem\('zg_combat_quality_v1'\)\|\|'auto'/, 'quality defaults safely to auto');
assert.match(settings, /\['auto','high','balanced','low'\]\.indexOf\(combatQualityPreference\)<0/, 'stored values are allowlist-normalized');
assert.match(settings, /if\(combatMotionMode==='minimal'\|\|reducedEffects\)return'low'/, 'reduced motion always wins over visual detail');
assert.match(settings, /return combatQualityPreference==='auto'\?base:combatQualityPreference/, 'auto preserves the runtime-requested quality');
assert.match(qualitySetter, /localStorage\.setItem\('zg_combat_quality_v1',mode\)/, 'choice is client-local and persistent');
assert.doesNotMatch(qualitySetter, /Firebase|ZargotaRooms|combatVisual|hpCur|gmBroadcast|commit/i, 'quality setter cannot mutate combat or Firebase state');

['auto', 'high', 'balanced', 'low'].forEach(mode => {
  assert.match(html, new RegExp(`data-combat-quality="${mode}"`), `${mode} is available in settings`);
});
assert.match(html, /function sessionCombatQuality\(base\).*w\.zgCombatQualityResolve\(base\)/, 'live VFX reads the client policy through a narrow bridge');
assert.match(html, /function sessionCombatBudget\(base,high,balanced,low\).*sessionCombatQuality\(base\)/, 'DOM-only effects share the same client quality policy');
assert.strictEqual((html.match(/quality=sessionCombatQuality\('balanced'\)/g) || []).length, 5, 'all five live Canvas entry points use the same quality policy');
assert.match(html, /var count=sessionCombatBudget\(intensity==='strong'\?'high':intensity==='soft'\?'low':'balanced',34,24,8\)/, 'broadcast token particles degrade per client');
assert.match(html, /sparkCount=sessionCombatBudget\(intensity==='strong'\?'high':intensity==='soft'\?'low':'balanced',30,18,6\)/, 'broadcast scene particles degrade per client');
assert.doesNotMatch(html, /sessionCombatMotionMode\(\)==='minimal'\?6:\(intensity===/, 'GM visual budgets no longer bypass the quality setting');

console.log('combat quality settings contract passed');
