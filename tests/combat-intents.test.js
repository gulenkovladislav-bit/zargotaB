'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /id="zg-combat-intent"/);
assert.match(html, /zgCombatIntentSubmit/);
assert.match(html, /zgCombatIntentKind/);
assert.match(html, /zg-combat-intent-kinds/);
assert.match(html, /Отправить заявку Мастеру/);
assert.match(html, /zgCombatIntentResolveOpen/);
assert.match(html, /zgCombatIntentDragStart/);
assert.match(html, /Назначить бросок/);
assert.match(html, /Принять результат/);
assert.match(html, /requestAction\(text,'combat-intent'/);
assert.match(html, /Без броска/);
assert.match(html, /Решение ГМа · без автоэффекта/);
assert.match(network, /actionKind === 'combat-intent'/);
assert.match(network, /configureCombatIntent: function/);
assert.match(network, /rollCombatIntent: function/);
assert.match(network, /finishCombatIntent: function/);
assert.match(network, /actionCost:'short'/);
assert.match(network, /resolutionOperationId:'combat-intent-' \+ currentRequest\.id/);
assert.match(network, /economy\.short = Math\.max\(0, Number\(economy\.short \|\| 0\) - 1\)/);
assert.match(network, /manualResolution:true/);
assert.match(network, /status:'roll-requested', stage:'waiting-roll'/);
assert.match(network, /status:'roll-result',stage:'roll-result'/);
assert.match(html, /renderCombatIntent\(false\)/, 'room snapshots must not rebuild the open intent form while the player is editing it');
assert.match(html, /Заявка на короткое действие отправлена/, 'the player must receive explicit submission feedback');
assert.match(network, /accepted && request\.status !== 'roll-result'/, 'GM cannot accept a check before the player actually rolls');

console.log('combat intent request contract passed');
