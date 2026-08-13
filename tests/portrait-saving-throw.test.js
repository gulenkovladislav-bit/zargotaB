'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /ДЕЙСТВИЯ С ПОРТРЕТОМ/, 'the portrait gear is a general action menu');
assert.match(html, /Назначить спасбросок/, 'the portrait gear exposes saving throws directly');
assert.match(html, /zgPortraitSavingThrow\(event,/, 'the portrait action preselects its target');
assert.match(html, /var portraitMenuKey='member:'\+String\(member\.uid\|\|''\)/, 'non-combat hero portraits receive stable saving-throw keys');
assert.match(html, /function combatSaveTargets\(\)/, 'saving-throw targets are available outside initiative');
assert.match(html, /w\.zgGmStatusCatalog=gmStatusCatalog/, 'the status catalog is explicitly shared with the saving-throw module');
assert.match(html, /typeof w\.zgGmStatusCatalog==='function'\?w\.zgGmStatusCatalog\(\):\[\]/, 'saving throws do not reach into another module closure');
assert.match(html, /if\(order\.length\)return order;/, 'active combat keeps using the synchronized initiative entries');
assert.match(html, /return heroMembers\(\)\.map/, 'outside combat the same menu uses current room heroes');
assert.doesNotMatch(html, /if\(!combat\|\|!combat\.active\|\|!session\|\|session\.role!==\'master\'\)/, 'the saving-throw panel is no longer hard-closed outside combat');

assert.match(network, /activeCombat=!!\(combat&&combat\.active\)/, 'the resolver distinguishes combat from free-session saves');
assert.match(network, /targetKey\.indexOf\('member:'\)===0/, 'the resolver accepts a persistent hero portrait key');
assert.match(network, /if\(activeCombat\)\{updates\['combat\/order'\] = order;/, 'initiative is only rewritten during active combat');
assert.match(network, /queueCombatEntryState\(room, updates, target, false\)/, 'successful status removal still synchronizes the character sheet');

console.log('portrait saving-throw contract passed');
