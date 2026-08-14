'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
var network = fs.readFileSync(path.resolve(__dirname, '..', 'zargota-network.js'), 'utf8');

assert.match(html, /function drawerMasterCanEdit\(member\)/, 'the live bag exposes an explicit GM edit capability');
assert.match(html, /function editableDrawerCharacter\(member\)/, 'GM mutations work on a detached character copy');
assert.match(html, /ZargotaRooms\.gmUpdateCharacterSections\(member\.uid/, 'the bag persists GM changes through a section-scoped network API');
assert.match(html, /w\.zgVttGmSpellLibraryOpen=function\(\)/, 'GM can open the spell catalog from a player bag');
assert.match(html, /w\.zgVttGmSpellLearn=function\(spellId,learned,event\)/, 'GM can change learned spell state');
assert.match(html, /w\.zgVttSpellPreparation=function\(spellId,shouldPrepare,event\)/, 'GM and owner share the canonical preparation control');

var start = network.indexOf('gmUpdateCharacterSections: function');
var end = network.indexOf('gmAddJournalEntry: function', start);
assert.ok(start >= 0 && end > start, 'network exposes the scoped GM character mutation');
var block = network.slice(start, end);
assert.match(block, /members\/['"]? \+ memberUid \+ ['"]?\/character/, 'transaction targets only the selected character');
assert.match(block, /character-revision-conflict/, 'concurrent player changes are protected by a revision check');
assert.match(block, /next\.inventoryItems/);
assert.match(block, /next\.equipItems/);
assert.match(block, /next\.spellRefs/);
assert.match(block, /next\.spellsLearned/);
assert.match(block, /next\.preparedSpells/);
assert.doesNotMatch(block, /next\.(?:hp|hpCur|hpMax|tempHp|statuses|statusEffects|combat|resources)\s*=/, 'GM bag edits must not overwrite health, statuses or combat resources');

console.log('GM live character section editing contract passed');
