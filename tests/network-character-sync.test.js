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

var snapshotStart = network.indexOf('function characterSnapshot');
var snapshotEnd = network.indexOf('function campaignKeyFor', snapshotStart);
var snapshotSource = network.slice(snapshotStart, snapshotEnd);
var snapshotContext = {
  input: {
    id: 7,
    name: 'Герой',
    hpMax: 12,
    inventoryItems: [
      { itemId:'zg-item-7-i-stable', name:'Ключ', qty:2 },
      { itemId:'backpack-sword', name:'Меч в рюкзаке', category:'weapon', damageFormula:'9d9' },
      { itemId:'equipped-sword', name:'Надетый меч', category:'weapon', damageFormula:'1d8', equipped:true, slot:'weapon' }
    ],
    skills: [{ name:'Приём', description:'Описание', image:'data:image/png;base64,heavy' }],
    traits: ['Черта'],
    spellRefs: [101, '202', { bad:true }],
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
assert.deepStrictEqual(Array.from(snapshotContext.result.spellRefs), [101, '202']);
assert.strictEqual(snapshotContext.result.skills[0].name, 'Приём');
assert.strictEqual(snapshotContext.result.skills[0].description, 'Описание');
assert.strictEqual(snapshotContext.result.skills[0].image, undefined);
assert.strictEqual(snapshotContext.result.inventoryItems[0].itemId, 'zg-item-7-i-stable');
assert.strictEqual(snapshotContext.result.inventoryItems[0].qty, 2);
assert.strictEqual(snapshotContext.result.weaponProfiles.some(function(profile) { return profile.id === 'backpack-sword'; }), false);
assert.strictEqual(snapshotContext.result.weaponProfiles.some(function(profile) { return profile.id === 'equipped-sword'; }), true);
assert.strictEqual(snapshotContext.result.biography, 'История');
assert.strictEqual(snapshotContext.result.quote, 'Цитата');
assert.strictEqual(snapshotContext.result.portrait, '');
var applyStart = html.indexOf('function zgApplySessionCharacterToLocal');
var applyEnd = html.indexOf('window.zgPersistFinalSessionCharacter', applyStart);
var applyBlock = html.slice(applyStart, applyEnd);
assert.strictEqual(applyBlock.indexOf('skills:roomCharacter.skills') >= 0, false);
assert.strictEqual(applyBlock.indexOf('biography:roomCharacter.biography') >= 0, false);

console.log('network character sync contract passed');
