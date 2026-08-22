'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
var network = fs.readFileSync(path.resolve(__dirname, '..', 'zargota-network.js'), 'utf8');

assert.match(html, /function drawerMasterCanEdit\(member\)/, 'the live bag exposes an explicit GM edit capability');
assert.match(html, /var workshop=common&&state&&state\.room&&state\.room\.code==='TEST'/, 'Workshop grants the local GM the same scoped bag editing capability');
assert.match(html, /function editableDrawerCharacter\(member\)/, 'GM mutations work on a detached character copy');
assert.match(html, /ZargotaRooms\.gmUpdateCharacterSections\(member\.uid/, 'the bag persists GM changes through a section-scoped network API');
assert.match(html, /if\(combatQaActive\(\)\)[\s\S]{0,400}?combatQaApply\(function\(snapshot\)/, 'Workshop inventory edits remain local instead of requiring a Firebase room');
assert.match(html, /updatedBy:'workshop-master'/, 'Workshop inventory edits keep an explicit local GM audit marker');
assert.match(html, /w\.zgVttInventoryDeleteItem=function\(\)/, 'GM and owner can explicitly delete an inventory item');
assert.match(html, /class="danger" onclick="zgVttInventoryDeleteItem\(\)"/, 'the item detail exposes a visible destructive action');
var addInventoryStart = html.indexOf('w.zgVttAddInventoryItem=function()');
var addInventoryEnd = html.indexOf('w.zgVttInventoryFilter=function', addInventoryStart);
assert.ok(addInventoryStart >= 0 && addInventoryEnd > addInventoryStart, 'the drawer add-item implementation is present');
var addInventoryBlock = html.slice(addInventoryStart, addInventoryEnd);
assert.match(addInventoryBlock, /commitInventoryMutation\(member,remoteCharacter,before,'gm-inventory-add'/, 'GM add-item uses the same local-or-network persistence path');
assert.doesNotMatch(addInventoryBlock, /gmAddInventoryItem/, 'Workshop add-item must not unconditionally call Firebase');
assert.match(html, /w\.zgVttGmSpellLibraryOpen=function\(\)/, 'GM can open the spell catalog from a player bag');
assert.match(html, /\['kodex','folio','obrad'\]\.indexOf\(type\)>=0/, 'the GM picker only lists the three canonical spell families');
assert.match(html, /function gmSpellLibrarySearchText\(value\)/, 'the GM picker normalizes Unicode catalog text before searching');
assert.match(html, /function applyGmSpellLibraryFilters\(\)/, 'search and dropdown filters share one filtering pass');
assert.match(html, /zgVttGmSpellLibrarySetFilter\(\\'type\\'/, 'the GM picker exposes a spell-family dropdown');
assert.match(html, /zgVttGmSpellLibrarySetFilter\(\\'level\\'/, 'the GM picker exposes a level dropdown');
assert.match(html, /zgVttGmSpellLibrarySetFilter\(\\'category\\'/, 'the GM picker exposes a category dropdown');
var spellLibraryStart = html.indexOf('w.zgVttGmSpellLibraryOpen=function()');
var spellLibraryEnd = html.indexOf('w.zgVttGmSpellLibraryAdd=function', spellLibraryStart);
assert.ok(spellLibraryStart >= 0 && spellLibraryEnd > spellLibraryStart, 'the GM spell picker implementation is present');
assert.doesNotMatch(html.slice(spellLibraryStart, spellLibraryEnd), /\.slice\(0,\s*160\)/, 'the GM picker must not silently truncate the catalog');
assert.match(html, /w\.zgVttGmSpellLearn=function\(spellId,learned,event\)/, 'GM can change learned spell state');
assert.match(html, /zgVttSpellCardAction\([^\n]+event\)/, 'custom spell menu actions pass the real click event into the shared router');
assert.match(html, /if\(action==='learn'\|\|action==='unlearn'\)return w\.zgVttGmSpellLearn\(spellId,action==='learn',event\)/, 'the custom menu routes learn actions with the real click event');
assert.match(html, /var shouldLearn=learned===true/, 'learn and unlearn use an explicit boolean state');
assert.match(html, /Заклинание разучено/, 'the GM receives explicit unlearn feedback');
assert.match(html, /'Разучить'/, 'a learned spell exposes the unlearn action');
assert.match(html, /Не изучено/, 'an unlearned spell has a visible state marker');
assert.match(html, /w\.zgVttSpellPreparation=function\(spellId,shouldPrepare,event\)/, 'GM and owner share the canonical preparation control');
assert.match(html, /zargota-network\.js\?v=2026-08-21\.1/, 'the page loads the current scoped Firebase character editor instead of a cached network client');

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
