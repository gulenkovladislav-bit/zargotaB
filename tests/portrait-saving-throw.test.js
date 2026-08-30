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
assert.match(html, /function combatSaveEntryKey\(entry\)/, 'combat heroes receive a stable saving-throw key even when initiative data omitted one');
assert.match(html, /function combatSaveEntryUid\(entry,members\)/, 'saving throws recover a player uid from legacy initiative entries');
assert.match(html, /if\(!uid&&key\.indexOf\('member:'\)===0\)uid=key\.slice\(7\)/, 'a persistent member key still assigns the save to the real player');
assert.match(html, /w\.zgGmStatusCatalog=gmStatusCatalog/, 'the status catalog is explicitly shared with the saving-throw module');
assert.match(html, /typeof w\.zgGmStatusCatalog==='function'\?w\.zgGmStatusCatalog\(\):\[\]/, 'saving throws do not reach into another module closure');
assert.match(html, /key:combatSaveEntryKey\(entry\)/, 'active combat saving throws normalize missing initiative keys');
assert.match(html, /return roomMembers\(\)\.filter\(function\(member\)\{return !!\(member&&member\.character&&String\(member\.uid\|\|''\)\);\}\)\.map/, 'outside combat all current room heroes remain eligible even without a characterId');
assert.doesNotMatch(html, /if\(!combat\|\|!combat\.active\|\|!session\|\|session\.role!==\'master\'\)/, 'the saving-throw panel is no longer hard-closed outside combat');
assert.match(html, /saveApi\.requestCombatSavingThrow\(combatSaveTargetKey,options\)/, 'the GM assigns a saving throw instead of resolving it immediately');
assert.match(html, /Выберите игрока для спасброска/, 'a missing target produces a visible error instead of a dead button');
assert.match(html, /Назначение спасброска недоступно: переподключите сессию/, 'a missing session adapter produces a visible recovery hint');
assert.match(html, /Спасбросок назначен · '[+]\(combatQaActive\(\)\?'перетащите D20':'игрок должен перетащить D20'\)/, 'local Workshop saves instruct the GM to drag, while live saves instruct the player');
assert.match(html, /actionKind==='saving-throw'/, 'assigned saving throws use their own player prompt');
assert.match(html, /rollMethod=isSavingThrow\?'rollCombatSavingThrow':'rollCombatIntent'/, 'dragging the assigned die selects the saving-throw roller');
assert.match(html, /onpointerdown="zgCombatIntentDragStart\(event\)" onclick="zgCombatIntentRoll\(\)"/, 'the assigned d20 supports both drag and direct click without a dead control');
assert.match(html, /МАСТЕР НАЗНАЧИЛ СПАСБРОСОК/, 'the player sees an explicit saving-throw drag prompt');
assert.match(html, /function combatLabIsPlayer\(\)\{\s*return !!combatLabPlayerUid\(\);\s*\}/, 'Workshop follows an assigned off-turn saving throw instead of remaining locked to the current NPC turn');

assert.match(network, /requestCombatSavingThrow: function \(targetKey, options\)/, 'the network API stores a GM saving-throw request');
assert.match(network, /actionKind:'saving-throw',status:'roll-requested',stage:'waiting-roll'/, 'the request waits for the player roll');
assert.match(network, /rollCombatSavingThrow: function \(requestId, simulatedPlayerUid\)/, 'the player has a dedicated saving-throw roll endpoint');
assert.match(network, /session\.role==='master'\?simulatedPlayerUid:user\.uid/, 'the live player can only roll their own assigned saving throw');
assert.match(network, /request\.status!=='roll-requested'/, 'an assigned saving throw is consumed only once');
assert.match(network, /activeCombat=!!\(combat&&combat\.active\)/, 'the resolver distinguishes combat from free-session saves');
assert.match(network, /targetKey\.indexOf\('member:'\)===0/, 'the resolver accepts a persistent hero portrait key');
assert.match(network, /room\.members&&room\.members\[targetKey\]/, 'the resolver also accepts a direct player uid from older initiative snapshots');
assert.match(network, /if\(activeCombat\)\{updates\['combat\/order'\] = order;/, 'initiative is only rewritten during active combat');
assert.match(network, /queueCombatEntryState\(room, updates, target, false\)/, 'successful status removal still synchronizes the character sheet');

console.log('portrait saving-throw contract passed');
