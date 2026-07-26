'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

var clickStart = html.indexOf('w.zgVttPartyClick = function');
var clickEnd = html.indexOf('function renderJournal', clickStart);
var clickBlock = html.slice(clickStart, clickEnd);
assert.match(clickBlock, /w\.zgSheetOpen\(uid\)/);
assert.strictEqual(clickBlock.indexOf('zgPossessPlayer') >= 0, false, 'portrait click must open the sheet, not possess immediately');
assert.match(html, /zgVttPartyClick\('\s*\+\s*esc\(JSON\.stringify\(member\.uid\)\)/);
assert.strictEqual(
  /zgVttPartyClick\('\s*\+\s*JSON\.stringify\(member\.uid\)/.test(html),
  false,
  'party uid quotes must be escaped inside inline onclick attributes'
);

var sheetStart = html.indexOf('//   ЛИСТ ПЕРСОНАЖА');
var sheetEnd = html.indexOf('//   КУБИК СНИЗУ', sheetStart);
var sheetBlock = html.slice(sheetStart, sheetEnd);
assert.match(sheetBlock, /session\.role==='player'/);
assert.match(sheetBlock, /return own\?\(localCharFor\(m\)\|\|m\.character\|\|null\):\(m\.character\|\|null\)/);
assert.match(sheetBlock, /zgSheetPossess/);
assert.match(sheetBlock, /zgSheetGmAddItem/);
assert.match(sheetBlock, /ZargotaRooms\.gmAddInventoryItem\(targetUid,item\)/);
assert.match(sheetBlock, /session\.role!=='master'/);
assert.match(sheetBlock, /addEventListener\('zargota-room-state'/);
assert.match(sheetBlock, /zgSheetOpen\(openedUid,\{tab:tab,silent:true\}\)/);
assert.match(sheetBlock, /session\.role==='player'&&isOwn&&localCharFor\(m\)/);
assert.match(sheetBlock, /zgSheetEditOwn/);
assert.match(sheetBlock, /String\(openedUid\)===String\(session\.uid\)/);
assert.match(sheetBlock, /String\(m\.characterId\)===sessionEditCharacterId/);
assert.match(sheetBlock, /zgGameClose\(true\)/);
assert.match(sheetBlock, /showPage\('characters'\)/);
assert.match(sheetBlock, /openCharSheet\(local\.id\)/);
assert.match(sheetBlock, /zgGameOpen\(false\)/);
assert.match(sheetBlock, /tempHp/);
assert.match(sheetBlock, /statusEffects/);
assert.match(sheetBlock, /inventoryItems/);
assert.match(sheetBlock, /equipItems/);
assert.match(sheetBlock, /item&&item\.equipped===true/);
assert.match(sheetBlock, /item\.equipped!==true/);
assert.match(sheetBlock, /spellRefs/);
assert.match(sheetBlock, /c\.notes\|\|c\.journal\|\|c\.quests/);
assert.match(sheetBlock, /Текущая цель/);
['abilities', 'items', 'journal', 'bio'].forEach(function (pane) {
  assert.ok(html.indexOf('id="zg-sheet-pane-' + pane + '"') >= 0, 'missing session sheet pane: ' + pane);
});

assert.match(html, /id="chars-btn-back" onclick="zgCharBack\(\)"/);
assert.match(html, /Вернуться в сессию/);
assert.match(html, /function openCharSheet\(id\) \{\s*if \(window\.zgSessionCharacterEditActive/);
assert.match(html, /function openCharEditor\(id\) \{\s*if \(window\.zgSessionCharacterEditActive/);
assert.match(html, /function deleteChar\(id\) \{\s*if \(window\.zgSessionCharacterEditActive/);
assert.match(html, /function charTransferMenu\(e, id\) \{\s*if \(window\.zgSessionCharacterEditActive/);

console.log('session character sheet contract passed');
