'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.strictEqual(
  network.indexOf("'campaigns/") >= 0 || network.indexOf('"campaigns/') >= 0,
  false,
  'network code must not write or subscribe to shared campaign paths'
);
assert.match(network, /characterId:\s*String\(character\.id\),character:entrySnapshot/);
assert.match(network, /snapshot\.source\s*=\s*source\s*\|\|\s*'edit'/);
assert.match(network, /snapshot\.revision\s*=\s*Math\.max\(localRevision,\s*roomRevision\)\s*\+\s*1/);
assert.match(network, /snapshot\.updatedBy\s*=\s*String\(user\s*&&\s*user\.uid/);
assert.match(network, /if\s*\(!canApplyIncomingCharacter\(session,\s*member\.character,\s*\{\s*allowQueued:true\s*\}\)\)\s*return/);
assert.match(network, /String\(member\.characterId\s*\|\|\s*''\)\s*!==\s*String\(character\.id\)/);
assert.match(network, /if\s*\(heroTaken\)\s*throw roomError/);

var attachStart = network.indexOf('attachCharacter: function');
var syncStart = network.indexOf('syncCharacter: function');
var attachBlock = network.slice(attachStart, syncStart);
assert.ok(attachBlock.indexOf("nextCharacterSnapshot(character, member, user, 'entry')") >= 0);
assert.ok(attachBlock.indexOf('enableCharacterInbound') > attachBlock.indexOf('firebase.update'));

var mergeStart = html.indexOf('function zgApplySessionCharacterToLocal');
var mergeEnd = html.indexOf('// ═══════════════════════════════════════════════════════════════════', mergeStart);
var mergeBlock = html.slice(mergeStart, mergeEnd);
assert.strictEqual(mergeBlock.indexOf('snapshot.campaign') >= 0, false);
assert.strictEqual(mergeBlock.indexOf('persistCampaignCharacter') >= 0, false);
assert.ok(mergeBlock.indexOf('canApplyIncomingCharacter') >= 0);
assert.ok(mergeBlock.indexOf('incomingRevision<localRevision') >= 0);
assert.match(network, /firebase\.get\(memberRef\)/);
assert.match(network, /zgPersistFinalSessionCharacter/);
assert.ok(network.indexOf('onDisconnect(roomRef(session.code)).remove()') < 0);
assert.match(network, /masterOnline:false/);
assert.match(network, /SYNC_LOG_KEY/);
assert.match(html, /Скопировать sync-диагностику/);
assert.match(network, /leaveRoomWithLocalCopy/);
assert.match(html, /Скачать аварийный JSON/);
assert.match(html, /Выйти с локальной копией/);
assert.match(html, /addEventListener\('pagehide'/);
assert.match(html, /persistCollectionBestEffort/);
assert.ok(html.indexOf('character-sync-outbox.js') < html.indexOf('zargota-network.js'));
assert.match(network, /queueCharacterSync/);
assert.match(network, /flushCharacterOutbox/);
assert.match(network, /changedFields\s*=\s*\/\^inventory-/);
assert.match(network, /baseFieldSignatures\[field\]\s*=\s*store\.fieldSignature/);
assert.match(network, /baseFieldValues\[field\]\s*=\s*value/);
assert.match(network, /store\.mergeChangedFields\(entry\.id,\s*member\.character\)/);
assert.match(network, /'field-merge'/);
assert.match(network, /changedFields:Array\.isArray\(entry\.changedFields\)/);
assert.match(network, /inventoryOperations:hasItemOperations/);
assert.match(network, /store\.applyInventoryOperations\(current,\s*itemOperations/);
assert.match(network, /firebase\.runTransaction\(characterRef/);
assert.match(network, /store\.recordConflict\(options\.outboxEntry,\s*operationConflict\)/);
assert.match(network, /memberUpdates\['character\/'\s*\+\s*field\]/);
assert.match(network, /memberUpdates\['character\/syncOperationId'\]/);
assert.match(network, /gmAddInventoryItem:\s*function/);
assert.match(network, /firebase\.runTransaction\(characterRef/);
assert.match(network, /applyInventoryAddOperation\(current,\s*normalizedItem/);
assert.match(network, /next\.source\s*=\s*'gm-inventory-add'/);
assert.match(network, /next\.inventoryItems\s*=\s*inventory/);
assert.match(network, /runTransaction:\s*databaseModule\.runTransaction/);
assert.match(network, /Room character changed while local edits were queued/);
assert.match(network, /store\.recordConflict\(entry,\s*member\.character\)/);
assert.match(network, /conflicts:\s*syncOutbox\(\)/);
assert.match(network, /store\.matchesApplied\(entry,\s*member\.character\)/);
assert.match(network, /outbox-already-acked/);
assert.match(network, /pending\s*&&\s*!\(store\.matchesApplied/);
assert.match(network, /localUnsynced\s*\|\|\s*pending/);
assert.match(network, /canApplyIncomingCharacter\(session,\s*member\.character,\s*\{\s*allowQueued:true\s*\}\)/);
assert.match(network, /clearLocalUnsynced\(entry\.characterId\)/);
assert.match(network, /outbox-remove-error/);
assert.match(network, /outbox:\s*syncOutbox\(\)/);
assert.match(network, /restoreCharacterInboundFromRoom/);
assert.match(network, /enableCharacterInbound\(session,\s*\{\s*uid:session\.uid\s*\},\s*member\.character\)/);
assert.strictEqual(network.indexOf("navigationEntry.type!=='reload'"), -1);

var queueCall = html.indexOf('window.ZargotaRooms.queueCharacterSync(character');
var localSavedCall = html.indexOf('window.ZargotaRooms.markLocalCharacterSaved(character');
assert.ok(queueCall >= 0 && localSavedCall > queueCall, 'selected hero must enter outbox before sync-state emit');
assert.match(html, /queued\s*&&\s*queued\.ok/);
assert.match(html, /id="zg-char-sync-state"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(html, /local:'Сохранено на устройстве'/);
assert.match(html, /sending:'Отправляем в сессию…'/);
assert.match(html, /synced:'Синхронизировано'/);
assert.match(html, /offline:'Нет связи — сохранено локально'/);
assert.match(html, /conflict:'Конфликт изменений'/);
assert.match(html, /'storage-error':'Ошибка хранения — скачать резерв'/);
assert.match(html, /session\.role==='player'&&member&&member\.characterId/);
assert.match(html, /saveChars\(\{\s*sync:false,\s*reason:'entry'\s*\}\)/);
assert.match(html, /store\.readConfirmedCharacter\(character\.id,\s*character\.campaignKey\)/);
var journeyStart = html.indexOf('w.zgJourneyStart = function');
var journeyStartEnd = html.indexOf('w.zgEnterAsGameMaster', journeyStart);
var journeyStartBlock = html.slice(journeyStart, journeyStartEnd);
assert.ok(
  journeyStartBlock.indexOf('confirmLocalCharacterForEntry(c)') <
    journeyStartBlock.indexOf('attachCharacter(confirmedCharacter)'),
  'confirmed local character must be read before Firebase attach'
);
assert.match(journeyStartBlock, /journeyStartPromise/);
assert.match(html, /Локальный лист изменился во время подготовки входа/);
assert.match(html, /savePlan\.changedIds\.length===1/);
assert.match(html, /savePlan\.removedIds&&savePlan\.removedIds\.length/);
assert.match(html, /ZargotaCharacterStore\.saveCharacter\(savePlan\.changedIds\[0\]/);
assert.match(html, /markCollectionSaveFailed\(savePlan\.changedIds\)/);
assert.strictEqual(
  /catch\(e3\)\s*\{\s*try\s*\{\s*localStorage\.removeItem\('grimoire_chars'\)/.test(html),
  false,
  'a failed cache refresh must not delete the previous character cache'
);
assert.match(html, /character cache refresh failed; previous cache preserved/);
assert.match(html, /function applyCharsMigrations[\s\S]*normalizeCharacterInventory\(c\)/);
assert.match(html, /function saveChars\(options\)[\s\S]*normalizeCharacterInventory\(c\)/);
var inventoryDropStart = html.indexOf('w.zgVttInventoryDrop=function');
var inventoryDropEnd = html.indexOf('w.zgVttInventoryOpenItem=function', inventoryDropStart);
var inventoryDropBlock = html.slice(inventoryDropStart, inventoryDropEnd);
assert.strictEqual(inventoryDropBlock.indexOf('equipItems.push') >= 0, false, 'equipping must not copy an inventory item');
assert.match(inventoryDropBlock, /item\.slot=slotName;item\.equipped=true/);
assert.match(html, /w\.zgVttInventoryUnequip=function\(source,index\)/);
assert.match(html, /source==='inventory'\?c\.inventoryItems:c\.equipItems/);
assert.match(html, /saveChars\(\{reason:'inventory-add'\}\)/);
assert.match(html, /saveChars\(\{reason:'inventory-remove'\}\)/);
assert.match(html, /saveChars\(\{reason:'inventory-quantity'\}\)/);
assert.match(html, /saveChars\(\{reason:'inventory-equip'\}\)/);

var abilitiesStart = html.indexOf('function abilitiesPanel()');
var abilitiesEnd = html.indexOf('function dicePanel()', abilitiesStart);
var abilitiesBlock = html.slice(abilitiesStart, abilitiesEnd);
assert.match(abilitiesBlock, /localCharacter=fullLocalCharacter\(member\)/);
assert.match(abilitiesBlock, /Math\.max\(spellLimit\(spell\),Number\(sessionUsage&&sessionUsage\.max\)\|\|0\)/);
assert.match(abilitiesBlock, /sessionUsage\?Number\(sessionUsage\.used\|\|0\)/);
assert.match(abilitiesBlock, /card\.learned===false/);
assert.match(abilitiesBlock, /card\.learned==null/);
assert.match(abilitiesBlock, /Статус не передан/);
assert.match(abilitiesBlock, /learnType:spell\.learnType/);
assert.match(abilitiesBlock, /learnText:spell\.learnText/);
assert.match(html, /Статус изучения не передан/);
assert.match(html, /Доступно зарядов:/);
assert.match(html, /Кулдаун:/);

var snapshotStart = network.indexOf('function characterSnapshot');
var snapshotEnd = network.indexOf('function campaignKeyFor', snapshotStart);
var snapshotSource = network.slice(snapshotStart, snapshotEnd);
var snapshotContext = {
  input: {
    id: 7,
    name: 'Герой',
    hpMax: 12,
    inventoryItems: [
      { itemId:'zg-item-7-i-stable', name:'Ключ', qty:2, image:'data:image/png;base64,item' },
      { itemId:'backpack-sword', name:'Меч в рюкзаке', category:'weapon', damageFormula:'9d9' },
      { itemId:'equipped-sword', name:'Надетый меч', category:'weapon', damageFormula:'1d8', equipped:true, slot:'weapon' }
    ],
    skills: [{ name:'Приём', description:'Описание', image:'data:image/png;base64,heavy' }],
    traits: ['Черта'],
    spellRefs: [101, '202', 'bad/key', { bad:true }],
    spellsLearned: { 101:true, 202:false, 'bad/key':true },
    spellCD: { 101:{ used:2, max:3 } },
    biography: 'История',
    quote: 'Цитата',
    portrait: 'data:image/png;base64,portrait'
  },
  result: null
};
vm.runInNewContext(
  'var w={}; function campaignKeyFor(){return "hero-key";}' +
    snapshotSource +
    '; result=characterSnapshot(input);',
  snapshotContext
);
assert.deepStrictEqual(Array.from(snapshotContext.result.spellRefs), [101, '202', 'bad/key']);
assert.strictEqual(snapshotContext.result.spellsLearned['101'], true);
assert.strictEqual(snapshotContext.result.spellsLearned['202'], false);
assert.deepStrictEqual(Object.keys(snapshotContext.result.spellsLearned).sort(), ['101', '202']);
assert.strictEqual(snapshotContext.result.abilityUsage['spell-101'].used, 2);
assert.strictEqual(snapshotContext.result.abilityUsage['spell-101'].max, 3);
assert.strictEqual(snapshotContext.result.abilityUsage['spell-objectObject'], undefined);
assert.strictEqual(snapshotContext.result.skills[0].name, 'Приём');
assert.strictEqual(snapshotContext.result.skills[0].description, 'Описание');
assert.strictEqual(snapshotContext.result.skills[0].image, undefined);
assert.strictEqual(snapshotContext.result.inventoryItems[0].itemId, 'zg-item-7-i-stable');
assert.strictEqual(snapshotContext.result.inventoryItems[0].qty, 2);
assert.strictEqual(snapshotContext.result.inventoryItems[0].image, '');
assert.strictEqual(snapshotContext.result.weaponProfiles.some(function(profile) { return profile.id === 'backpack-sword'; }), false);
assert.strictEqual(snapshotContext.result.weaponProfiles.some(function(profile) { return profile.id === 'equipped-sword'; }), true);
assert.strictEqual(snapshotContext.result.biography, 'История');
assert.strictEqual(snapshotContext.result.quote, 'Цитата');
assert.strictEqual(snapshotContext.result.portrait, '');

var inventoryHelperStart = network.indexOf('function normalizeInventoryOperationItem');
var inventoryHelperEnd = network.indexOf('function emit', inventoryHelperStart);
var inventoryHelperSource = network.slice(inventoryHelperStart, inventoryHelperEnd);
var inventoryHelperContext = { result:null };
vm.runInNewContext(
  inventoryHelperSource +
    '; var item=normalizeInventoryOperationItem({itemId:"safe id!",name:"  Дар мастера  ",qty:5000,description:"Описание"},"fallback");' +
    'result=applyInventoryAddOperation({id:"hero",hpCur:7,statuses:["poison"],revision:4,inventoryItems:[]},item,{updatedAt:123,updatedBy:"gm",operationId:"op-1"});',
  inventoryHelperContext
);
assert.strictEqual(inventoryHelperContext.result.ok, true);
assert.strictEqual(inventoryHelperContext.result.character.inventoryItems[0].itemId, 'safeid');
assert.strictEqual(inventoryHelperContext.result.character.inventoryItems[0].name, 'Дар мастера');
assert.strictEqual(inventoryHelperContext.result.character.inventoryItems[0].qty, 999);
assert.strictEqual(inventoryHelperContext.result.character.hpCur, 7);
assert.strictEqual(inventoryHelperContext.result.character.statuses[0], 'poison');
assert.strictEqual(inventoryHelperContext.result.character.revision, 5);
assert.strictEqual(inventoryHelperContext.result.character.syncOperationId, 'op-1');

var duplicateHelperContext = { result:null };
vm.runInNewContext(
  inventoryHelperSource +
    '; var item=normalizeInventoryOperationItem({itemId:"same",name:"Дар"},"fallback");' +
    'result=applyInventoryAddOperation({revision:2,inventoryItems:[{itemId:"same",name:"Дар"}]},item,{updatedAt:124,updatedBy:"gm",operationId:"op-2"});',
  duplicateHelperContext
);
assert.strictEqual(duplicateHelperContext.result.ok, true);
assert.strictEqual(duplicateHelperContext.result.duplicate, true);
assert.strictEqual(duplicateHelperContext.result.character.inventoryItems.length, 1);
var fallbackItemContext = { result:null };
vm.runInNewContext(
  inventoryHelperSource +
    '; result=normalizeInventoryOperationItem({itemId:"!!!",name:"Дар"},"safe-fallback");',
  fallbackItemContext
);
assert.strictEqual(fallbackItemContext.result.itemId, 'safe-fallback');
var applyStart = html.indexOf('function zgApplySessionCharacterToLocal');
var applyEnd = html.indexOf('window.zgPersistFinalSessionCharacter', applyStart);
var applyBlock = html.slice(applyStart, applyEnd);
assert.strictEqual(applyBlock.indexOf('skills:roomCharacter.skills') >= 0, false);
assert.strictEqual(applyBlock.indexOf('biography:roomCharacter.biography') >= 0, false);

var inventoryMergeStart = html.indexOf('function zgMergeSessionInventoryItems');
var inventoryMergeEnd = html.indexOf('function zgApplySessionCharacterToLocal', inventoryMergeStart);
var inventoryMergeContext = { result:null };
vm.runInNewContext(
  html.slice(inventoryMergeStart, inventoryMergeEnd) +
    '; result=zgMergeSessionInventoryItems([{itemId:"a",name:"Ключ",image:"data:image/png;base64,local"},{itemId:"deleted",image:"keep-only-local"}],[{itemId:"a",name:"Ключ",image:""},{itemId:"b",name:"Дар мастера"}]);',
  inventoryMergeContext
);
assert.strictEqual(inventoryMergeContext.result.length, 2);
assert.strictEqual(inventoryMergeContext.result[0].image, 'data:image/png;base64,local');
assert.strictEqual(inventoryMergeContext.result[1].name, 'Дар мастера');
assert.strictEqual(inventoryMergeContext.result.some(function(item) { return item.itemId === 'deleted'; }), false);

console.log('network character sync contract passed');
