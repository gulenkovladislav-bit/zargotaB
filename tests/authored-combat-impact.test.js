'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  var HIT_FX_ASSETS=');
const preset = html.indexOf('  function liveCombatCanvasPreset(event,hideResult)', start);
assert.ok(start >= 0 && preset > start, 'authored hit adapter must remain a narrow extractable block');
const block = html.slice(start, preset);

['cleave-a.png','cleave-b.png','cleave-c.png'].forEach(asset => assert.ok(block.includes(asset), asset + ' is routed'));
assert.match(block, /hitFxHash\(event\.id\+':'\+String\(event\.targetKey\|\|''\)\)/, 'both clients derive one art variant from the stable event id');
assert.match(block, /hitFxIncomingAngle\(attacker,target,hash\)/, 'slash direction follows attacker to target');
assert.match(block, /while\(active\.length>=6\)/, 'authored DOM impacts have a hard concurrency cap');
assert.match(block, /schedulePlaybackCleanup\(event,'authored-hit-fx'/, 'cleanup uses the shared playback scheduler');
assert.doesNotMatch(block, /setTimeout\(|setInterval\(|requestAnimationFrame\(/, 'authored impact creates no private timer or RAF');

const familyStart = html.indexOf('  function combatAuthoredImpactFamily(event)');
const familyEnd = html.indexOf('  function hitFxIncomingAngle(', familyStart);
const context = {String,Number};
vm.createContext(context);
vm.runInContext(html.slice(familyStart, familyEnd), context);
assert.strictEqual(context.combatAuthoredImpactFamily({weapon:'Длинный меч',damageType:'Рубящий',distanceCells:1,rangeCells:1}), 'melee');
assert.strictEqual(context.combatAuthoredImpactFamily({weapon:'Короткий лук',damageType:'Колющий',distanceCells:1,rangeCells:8}), '', 'bows never receive a melee slash');
assert.strictEqual(context.combatAuthoredImpactFamily({weapon:'Магический луч',damageType:'Огонь',distanceCells:1,rangeCells:1}), '', 'magic never receives a melee slash');
assert.strictEqual(context.combatAuthoredImpactFamily({weapon:'Метательный молот',damageType:'Дробящий',distanceCells:4,rangeCells:6}), '', 'distance prevents an uncertain ranged attack from receiving a melee slash');

const visualStart = html.indexOf('  function animateCombatVisual()');
const visualEnd = html.indexOf('  function liveGmAdjustmentPreset(', visualStart);
const visual = html.slice(visualStart, visualEnd);
assert.match(visual, /playHitFx=claimCombatPlaybackEvent\(event,'hitFx'\)/, 'the adapter is guarded by the stable hitFx claim');
assert.match(visual, /if\(playHitFx\).*playAuthoredMeleeImpact/s, 'the adapter only runs for the claimed hitFx lane');
assert.match(visual, /playCombatTokenStrike\(event,attackingToken,target\)/, 'a live melee hit moves its attacker through the shared strike adapter');

assert.match(html, /html\.zg-reduced-effects \.zg-authored-hit-fx img/, 'reduced effects shortens authored art');
console.log('authored combat impact routing passed');
