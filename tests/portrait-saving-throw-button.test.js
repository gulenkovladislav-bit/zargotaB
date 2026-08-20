'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /var mergeStatusDisplaySources=typeof w\.zgMergeStatusDisplaySources==='function'\?w\.zgMergeStatusDisplaySources/, 'saving-throw UI binds the exported status helper inside its own closure');
assert.match(html, /statuses=mergeStatusDisplaySources\(member\.character\|\|\{\},local\|\|\{\},entry\)/, 'combat targets use the safe local binding');
assert.match(html, /return order\.filter\(function\(entry\)\{return !!combatSaveEntryKey\(entry\);\}\)/, 'every combat portrait with a stable key remains selectable');
assert.match(html, /savingThrowAssignedToPlayer:!!\(uid&&member\.character\)/, 'the panel distinguishes player-assigned saves from GM creature saves');
assert.match(html, /saveMethod=assignToPlayer\?'requestCombatSavingThrow':'resolveCombatSavingThrow'/, 'player heroes receive a request while creatures are resolved by the GM');
assert.match(html, /assignToPlayer\?saveApi\.requestCombatSavingThrow\(combatSaveTargetKey,options\):saveApi\.resolveCombatSavingThrow\(combatSaveTargetKey,options\)/, 'the working adapter method is invoked for the selected portrait');
assert.match(html, /saveSubmit\.textContent='Бросить за существо'/, 'the creature action is labelled honestly');
assert.match(html, /Спасбросок существа выполнен/, 'the GM receives confirmation after a creature save');

console.log('portrait saving-throw button contract passed');
