'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
var start = html.indexOf("  var combatSaveTargetKey='");
var end = html.indexOf('  function renderCombatPrepare(', start);
var source = html.slice(start, end);

assert.ok(start >= 0 && end > start, 'saving-throw UI remains a bounded combat module');
assert.match(source, /combatSaveDraft=\{statKey:'con',dc:10,bonus:0,mode:'normal',removeStatus:''\}/, 'the visual controls have one persistent draft');
assert.match(source, /combatEntryPortrait\(entry\)/, 'targets are recognizable portrait cards');
assert.ok(source.includes(`onclick="zgCombatSaveTarget('+esc(JSON.stringify(entry.key))+')"`), 'saving-throw target ids are escaped before entering the inline handler');
assert.doesNotMatch(source, /onclick="zgCombatSaveTarget\('\+JSON\.stringify\(entry\.key\)\+/, 'raw JSON quotes must not truncate the target click handler');
assert.match(source, /w\.zgStatIcon\(key,'zg-combat-save-stat-icon'\)/, 'stat choices reuse the custom stat icon system');
assert.match(source, /zg-combat-save-stepper/, 'DC and bonus use visual steppers');
assert.match(source, /type="number" inputmode="numeric" min="1" max="40" step="1" value="'\+combatSaveDraft\.dc\+'"/, 'DC can be typed directly inside the existing stepper');
assert.match(source, /onchange="zgCombatSaveSetNumber\(\\'dc\\',this\.value\)"/, 'manual DC uses the same bounded draft setter as presets and stepper buttons');
assert.match(source, /zg-combat-save-modes/, 'roll modes are explicit visual choices');
assert.match(source, /Лучший из двух/);
assert.match(source, /Худший из двух/);
assert.match(source, /combatSaveStatuses\(target\)/, 'only active target statuses are offered for removal');
assert.match(source, /entry&&Array\.isArray\(entry\.tempEffects\)\?entry\.tempEffects\.filter/, 'legacy sheet tempEffects remain visible in the saving-throw removal list');
assert.match(source, /normalizeStatusDisplayKey\(raw\)/, 'saving-throw status keys use the same aliases as the character sheet and GM panel');
assert.match(source, /mergeStatusDisplaySources\(member\.character\|\|\{\},local\|\|\{\},entry\)/, 'active combat targets merge the current sheet state over a stale combat projection');
assert.match(source, /tempEffects:entry\.tempEffects/, 'an open saving-throw panel refreshes when legacy sheet effects change');
assert.match(source, /options=\{statKey:combatSaveDraft\.statKey,dc:combatSaveDraft\.dc,bonus:combatSaveDraft\.bonus,mode:combatSaveDraft\.mode,removeStatus:combatSaveDraft\.removeStatus\}/, 'submission reads the same visible draft');
assert.doesNotMatch(source, /zg-combat-save-grid/, 'the old spreadsheet-like form is gone');
assert.doesNotMatch(source, /<select id="zg-combat-save-/, 'the saving throw no longer hides key choices in select menus');

console.log('visual combat saving-throw contract passed');
