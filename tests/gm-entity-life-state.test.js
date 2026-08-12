'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /class="zg-gm-life-state"/, 'GM entity tab exposes the life-state control');
assert.ok(html.includes("zgGmInterventionLifeState(\\'active\\')"), 'GM can return an entity to active play');
assert.ok(html.includes("zgGmInterventionLifeState(\\'defeated\\')"), 'GM can preserve a living defeated entity');
assert.ok(html.includes("zgGmInterventionLifeState(\\'dead\\')"), 'GM can confirm a corpse');
assert.match(html, /сохраняется после боя/, 'the control explains that the result survives combat');
assert.match(html, /token\.zeroHp=source\.zeroHp&&typeof source\.zeroHp==='object'/, 'the GM panel keeps the acknowledged corpse state selected after Firebase responds');
assert.match(html, /if\(node\.dataset\.healthPresentation===presentationKey\)return/, 'unchanged health labels are not rebuilt on every Firebase render');
assert.match(html, /html\.zg-reduced-effects \.zg-token-downed-state/, 'reduced effects mode simplifies the persistent state label');
const presentationStart = html.indexOf('function syncTokenHealthPresentation');
const presentationEnd = html.indexOf('function syncTokenHealthPresentation', presentationStart + 1);
const presentationBlock = html.slice(presentationStart, presentationEnd > presentationStart ? presentationEnd : presentationStart + 4000);
assert.ok(
  presentationBlock.indexOf('if(node.dataset.healthPresentation===presentationKey)return') < presentationBlock.indexOf('classes.forEach'),
  'the unchanged-state guard runs before any label class mutation'
);

const adjustStart = network.indexOf('    gmAdjustEntity: function');
const adjustEnd = network.indexOf('    gmAdvanceWorldTime: function', adjustStart);
const adjustment = network.slice(adjustStart, adjustEnd);
assert.match(adjustment, /kind==='life-state'/, 'network adjustment accepts the explicit life-state operation');
assert.match(adjustment, /zeroHp\.state=lifeState==='dead'\?'dead':'stabilized'/, 'dead and defeated remain distinct persisted states');
assert.match(adjustment, /hp=Math\.min\(hpMax\|\|1,Math\.max\(1,hp\)\);zeroHp=null/, 'returning to active play clears fate and restores at least one HP');
assert.match(adjustment, /updates\[path\+'\/zeroHp'\]=zeroHp/, 'the state is stored on scene and zone tokens');
assert.match(adjustment, /character\/deathSaves'\]=zeroHp/, 'the same state is stored on linked heroes');

const endStart = network.indexOf('    endCombat: function');
const endEnd = network.indexOf('    resetExploration: function', endStart);
const ending = network.slice(endStart, endEnd);
assert.match(ending, /firebase\.runTransaction\(roomRef\(session\.code\)/, 'combat ending is one atomic transaction');
assert.match(ending, /persistCombatOutcomeBeforeEnd\(room,stamp,user\.uid\)/, 'combat outcome is persisted before the combat record is removed');
assert.ok(ending.indexOf('persistCombatOutcomeBeforeEnd') < ending.indexOf('room.combat=null'), 'fate persistence precedes combat deletion');

console.log('GM entity life-state contract passed');
