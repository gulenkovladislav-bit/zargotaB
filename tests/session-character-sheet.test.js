'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

var clickStart = html.indexOf('w.zgVttPartyClick = function');
var clickEnd = html.indexOf('function renderJournal', clickStart);
var clickBlock = html.slice(clickStart, clickEnd);
assert.match(clickBlock, /session&&session\.role==='master'/);
assert.match(clickBlock, /gmPanel\.classList\.contains\('open'\).*gmPanel\.classList\.contains\('minimized'\)/, 'an open GM intervention panel gives party portraits a targeting context');
assert.match(clickBlock, /token\.type==='hero'.*String\(token\.memberUid\|\|''\)===String\(uid\|\|''\)/, 'GM targeting resolves the hidden run-mode hero token by member uid');
assert.match(clickBlock, /zgGmInterventionOpenToken\(heroToken\.id,'entity'\)/, 'party targeting enters the existing GM entity panel');
assert.match(clickBlock, /zgVttOpenPanelForMember\('character',uid,\{toggle:true\}\)/);
assert.match(clickBlock, /session&&session\.role==='player'&&String\(session\.uid\)===String\(uid\)/);
assert.match(clickBlock, /zgVttOpenPanel\('character',\{toggle:true,resetMember:true\}\)/);
assert.ok(
  clickBlock.indexOf("zgVttOpenPanelForMember('character',uid,{toggle:true})") >= 0,
  'master portrait click must choose the canonical character drawer'
);
assert.ok(
  clickBlock.indexOf("zgVttOpenPanel('character',{toggle:true,resetMember:true})") >= 0,
  'own player portrait click must choose the canonical character drawer'
);
assert.match(clickBlock, /allowPlayerInspectAllies===false/);
assert.match(clickBlock, /zgVttOpenPublicMember\(uid\)/);
assert.match(clickBlock, /if\(w\.zgSheetClose\)w\.zgSheetClose\(\)/);
assert.strictEqual(clickBlock.indexOf('zgPossessPlayer') >= 0, false, 'portrait click must open the sheet, not possess immediately');
assert.match(html, /w\.zgGmInterventionOpenToken=function\(tokenId,tab\)/, 'the GM panel exposes its token targeting bridge');
assert.match(html, /gmInterventionTokenId=token\.id/, 'the targeting bridge stores the resolved scene token');
assert.match(html, /zgVttPartyClick\('\s*\+\s*esc\(JSON\.stringify\(member\.uid\)\)/);
assert.strictEqual(
  /zgVttPartyClick\('\s*\+\s*JSON\.stringify\(member\.uid\)/.test(html),
  false,
  'party uid quotes must be escaped inside inline onclick attributes'
);

var journalStart = html.indexOf('function renderJournal');
var journalEnd = html.indexOf('w.zgVttLogOpen=', journalStart);
var journalBlock = html.slice(journalStart, journalEnd);
assert.match(journalBlock, /seenJournalEventIds/, 'journal keeps an exactly-once registry for replicated room messages');
assert.match(journalBlock, /if\(seenJournalEventIds\[eventId\]\)return false/, 'the same Firebase event id renders only once even when copied to every member inbox');
assert.match(journalBlock, /room\.manualEvent && room\.manualEvent\.ts/, 'manual events remain available to the GM journal without player inbox replication');
assert.match(journalBlock, /event\.visibility==='gm'.*session\.role!=='master'/, 'GM-only journal events never render for a player client');

var sheetStart = html.indexOf('//   ЛИСТ ПЕРСОНАЖА');
var sheetEnd = html.indexOf('//   КУБИК СНИЗУ', sheetStart);
var sheetBlock = html.slice(sheetStart, sheetEnd);
assert.match(sheetBlock, /session\.role==='player'/);
assert.match(sheetBlock, /return own\?\(localCharFor\(m\)\|\|m\.character\|\|null\):\(m\.character\|\|null\)/);
assert.doesNotMatch(sheetBlock, /zgSheetPossess|Играть за героя|вернуться к ГМ/, 'character sheets do not add player-control buttons');
assert.match(sheetBlock, /zgSheetGmAddItem/);
assert.match(sheetBlock, /zgSheetOpenCanonical/);
assert.match(sheetBlock, /zgSheetTabAction/);
assert.match(sheetBlock, /session\.role==='player'&&String\(session\.uid\)===String\(targetUid\)/);
assert.match(sheetBlock, /session\.role==='master'&&String\(w\.zgPossessedPlayerUid\|\|''\)===String\(targetUid\)/);
assert.match(sheetBlock, /zgVttOpenPanel\(panel,\{forceOpen:true,resetMember:true\}\)/);
assert.match(sheetBlock, /zgVttOpenPanelForMember\(panel,targetUid\)/);
assert.strictEqual(sheetBlock.indexOf('function renderItems') >= 0, false, 'portrait sheet must not render a second inventory');
assert.strictEqual(sheetBlock.indexOf('zgSheetItemOpen') >= 0, false, 'portrait sheet must not own a second item detail');
assert.strictEqual(sheetBlock.indexOf('saveChars(') >= 0, false, 'portrait sheet must not create a local inventory/spell write path');
assert.strictEqual(sheetBlock.indexOf("requestAction(") >= 0, false, 'portrait sheet must not create an ability write path');
assert.match(sheetBlock, /zgVttSetInventoryNotice\(targetUid,'loading'/);
assert.match(sheetBlock, /zgVttSetInventoryNotice\(targetUid,'success'/);
assert.match(sheetBlock, /zgVttSetInventoryNotice\(targetUid,'error'/);
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
assert.match(sheetBlock, /c\.notes\|\|c\.journal\|\|c\.quests/);
assert.match(sheetBlock, /Текущая цель/);
['journal', 'bio'].forEach(function (pane) {
  assert.ok(html.indexOf('id="zg-sheet-pane-' + pane + '"') >= 0, 'missing session sheet pane: ' + pane);
});
['abilities', 'items'].forEach(function (pane) {
  assert.strictEqual(html.indexOf('id="zg-sheet-pane-' + pane + '"') >= 0, false, 'duplicate session sheet pane remains: ' + pane);
});
assert.match(html, /id="zg-sheet-tab-abilities" onclick="zgSheetTabAction\('abilities'\)"/);
assert.match(html, /id="zg-sheet-tab-items" onclick="zgSheetTabAction\('items'\)"/);
assert.match(html, /w\.zgVttOpenPanel = function\(panel,options\)/);
assert.match(html, /if \(!options\.forceOpen && activePanel === panel/);
assert.match(html, /currentBody\.dataset\.activePanel === panel/);
assert.match(html, /body\.dataset\.activePanel=renderError\?'':activePanel/);
assert.ok(
  html.indexOf('body.innerHTML=nextBodyHtml') < html.indexOf("lastDrawerRenderSignature=renderError?'':signature"),
  'drawer render signature must be acknowledged only after the new panel body is committed'
);
assert.match(html, /Не удалось отрисовать раздел сумки/);
assert.match(html, /Не удалось подготовить состояния героя/);
assert.match(html, /function journalEntryKind\(entry\)/);
assert.match(html, /\['quest','note','place'\]\.indexOf\(explicit\)/);
assert.match(html, /zgVttJournalFilter\(\\'quest\\'\)/);
assert.match(html, /journalFilter=\['all','quest','note','place'\]/);
assert.match(html, /class="zg-journal3-paper-art /);
assert.match(html, /object-fit:contain/);
assert.match(html, /data:image\\\/\(\?:png\|jpe\?g\|webp\);base64/, 'portable GM illustrations are accepted by the player journal renderer');
assert.match(html, /zg-journal3-newspaper-head/, 'saved GM illustrations use the newspaper-cover journal layout');
assert.match(html, /Вестник Зарготы/);
assert.match(html, /id="zg-journal-editor-kind"/);
assert.match(html, /id="zg-journal-editor-icons"/);
assert.match(html, /zgVttJournalConfirmRemove/);
assert.match(html, /zg-journal-delete-backdrop/);
assert.match(html, /selected\.editable\|\|selected\.playerCanDelete/, 'players may delete GM journal records only when the GM permits it');
assert.match(html, /zgVttJournalMasterEdit/, 'the GM can edit delivered journal records');
assert.match(html, /gmUpdateJournalEntry/, 'journal permission edits use the synchronized room API');
assert.match(html, /appendLegacyGoalRecord\(c\.currentGoal,'current'\)/);
assert.match(html, /zgVttJournalOpenGoal/);
assert.match(html, /data-journal-id="'\+esc\(goal\.id\)/);
assert.match(html, /zgCharJournalTransfer/);
assert.match(html, /zgVttFamilyOpen/);
assert.match(html, /zgVttCharacterPatchOpen/);
assert.match(html, /resolveCharacterPatchProposal/);
assert.match(html, /w\.zgCollectDisplayStatuses=collectDisplayStatuses/);
assert.match(html, /w\.zgStatusDurationText=statusDurationText/);
assert.match(html, /if\(typeof w\.zgCollectDisplayStatuses==='function'\)/);
assert.match(html, /activeStatuses=w\.zgCollectDisplayStatuses\(/);
assert.match(html, /typeof w\.zgStatusDurationText==='function'\?w\.zgStatusDurationText/);
assert.strictEqual(
  /var activeStatuses=collectDisplayStatuses\(/.test(html),
  false,
  'character drawer must not call a status helper hidden inside another IIFE'
);

assert.match(html, /id="chars-btn-back" onclick="zgCharBack\(\)"/);
assert.match(html, /Вернуться в сессию/);
assert.match(html, /function openCharSheet\(id\) \{\s*if \(window\.zgSessionCharacterEditActive/);
assert.match(html, /function openCharEditor\(id\) \{\s*if \(window\.zgSessionCharacterEditActive/);
assert.match(html, /function deleteChar\(id\) \{\s*if \(window\.zgSessionCharacterEditActive/);
assert.match(html, /function charTransferMenu\(e, id\) \{\s*if \(window\.zgSessionCharacterEditActive/);
assert.match(html, /function itemEditorDirty\(\)/, 'the item editor tracks unsaved changes');
assert.match(html, /Закрыть без сохранения изменений\?/, 'closing a dirty item editor requires confirmation');
assert.doesNotMatch(html, /backdrop\.onclick\s*=\s*function/, 'clicking outside the item editor must not discard the draft');

console.log('session character sheet contract passed');
