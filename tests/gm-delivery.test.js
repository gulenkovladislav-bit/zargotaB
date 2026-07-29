'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var delivery = fs.readFileSync(path.join(root, 'gm-delivery.js'), 'utf8');
var styles = fs.readFileSync(path.join(root, 'gm-delivery.css'), 'utf8');
var todo = fs.readFileSync(path.join(root, 'GM_GAMEPLAY_SYSTEM_TODO.md'), 'utf8');

new vm.Script(delivery, {filename:'gm-delivery.js'});

assert.match(html, /gm-delivery\.css\?v=/);
assert.match(html, /gm-delivery\.js\?v=/);
assert.ok(html.indexOf('gameplay-operation-outbox.js') < html.indexOf('zargota-network.js'));
assert.match(html, /class="zg-scene-publish zg-gm-delivery-button"/);
assert.match(html, /onclick="zgGmDeliveryToggle\(\)"/);

assert.match(network, /gmSendDelivery:\s*function/);
assert.match(network, /gmSendDeliveries:\s*function/);
assert.match(network, /function appendOperationEvent\(operationType, operationId, phase, metadata, error\)/);
assert.match(network, /category:\s*'gameplay-operation'/);
assert.match(network, /rows\.slice\(-160\)/);
assert.match(network, /return api\.gmSendDeliveries\(\[memberUid\],value\)/);
assert.match(network, /acknowledgeGmDelivery:\s*function/);
assert.match(network, /\['item','quest','text','image'\]\.indexOf\(value\.kind\)/);
assert.match(network, /\['calm','solemn','ominous'\]\.indexOf\(value\.mood\)/);
assert.match(network, /value\.presentation==='cinematic'\?'cinematic':'card'/);
assert.match(network, /presentation:presentation/);
assert.match(network, /privateDelivery=kind==='text'&&value\.privateDelivery===true/);
assert.match(network, /privateDeliveries\/'\+session\.code\+'\/'\+members\[0\]\.uid/);
assert.match(network, /currentPrivateDeliveries&&currentPrivateDeliveries\[deliveryId\]/);
assert.match(network, /ownMember\.gmDeliveries = Object\.assign\(\{\}, ownMember\.gmDeliveries \|\| \{\}, currentPrivateDeliveries\)/);
assert.match(network, /status:'pending'/);
assert.match(network, /members\/'\+target\.uid\+'\/gmDeliveries\/'\+deliveryId/);
assert.match(network, /batchId:members\.length>1\?deliveryOperationId:''/);
assert.match(network, /memberUids=.*filter\(function\(uid,index,list\)\{return list\.indexOf\(uid\)===index;\}\)\.slice\(0,40\)/);
assert.match(network, /resolved\.slice\(30\)/);
assert.match(network, /delivery-image-large/);
assert.match(network, /Array\.isArray\(rawPayload\.items\)\?rawPayload\.items\.slice\(0,20\):\[\]/);
assert.match(network, /payload\.items=rawItems\.map/);
assert.match(network, /normalizeDeliveryItem/);
assert.match(network, /bundleImageSize>350000/);
assert.match(network, /questId:questId/);
assert.match(network, /status:questStatus/);
assert.match(network, /importance:questImportance/);
var batchStart = network.indexOf('gmSendDeliveries: function');
var batchEnd = network.indexOf('acknowledgeGmDelivery: function', batchStart);
var batchBlock = network.slice(batchStart, batchEnd);
assert.match(batchBlock, /firebase\.update\(roomRef\(session\.code\),updates\)/);
assert.match(batchBlock, /updates\['members\/'\+target\.uid\+'\/gmDeliveries\/'\+deliveryId\]=deliveryRecord/, 'shared group delivery must stay in one atomic room update');
assert.match(batchBlock, /queueGameplayOperation\('gm-delivery',deliveryOperationId/);
assert.match(batchBlock, /gameplayOperationSnapshot\('gm-delivery',deliveryOperationId\)/);
assert.match(batchBlock, /var deliveryId='gm-delivery-'\+deliveryOperationId\+'-'\+index/);
assert.match(batchBlock, /var targetDeliveries=privateDelivery\?privateExisting:target\.member\.gmDeliveries\|\|\{\}/);
assert.match(batchBlock, /appliedDeliveryIds\.indexOf\(deliveryId\)>=0/);
assert.match(batchBlock, /removeGameplayOperation\(deliveryOperationId\)/);
assert.match(batchBlock, /appendOperationEvent\('gm-delivery',deliveryId,'sending',diagnostic\)/);
assert.match(batchBlock, /appendOperationEvent\('gm-delivery',diagnostic\.id,'pending-player',diagnostic\)/);
assert.match(batchBlock, /deliveryWriteCommitted\?'send-refresh-failed':'send-failed'/);
var deliveryAckStart = network.indexOf('acknowledgeGmDelivery: function');
var deliveryAckEnd = network.indexOf('gmProposeSkillUpdate: function', deliveryAckStart);
var deliveryAckBlock = network.slice(deliveryAckStart, deliveryAckEnd);
assert.match(deliveryAckBlock, /appendOperationEvent\('gm-delivery',deliveryId,'acknowledging',deliveryDiagnostic\)/);
assert.match(deliveryAckBlock, /status==='applied'\?'applied':'player-failed'/);
assert.match(deliveryAckBlock, /deliveryAckWritten\?'ack-refresh-failed':'ack-failed'/);

assert.match(delivery, /STORAGE_KEY = 'zargota_gm_delivery_library_v1'/);
assert.match(delivery, /HISTORY_KEY = 'zargota_gm_delivery_history_v1'/);
assert.match(delivery, /MAX_IMAGE_BYTES = 250 \* 1024/);
assert.match(delivery, /var drafts = Object\.create\(null\)/);
assert.match(delivery, /function rememberPanelDraft\(\)/);
assert.match(delivery, /if \(!options\.skipRemember\) rememberPanelDraft\(\)/);
assert.match(delivery, /function safeQuestId\(value\)/);
assert.match(delivery, /function upsertQuestJournalEntry\(journal, delivery\)/);
assert.match(delivery, /id="zg-gm-delivery-quest-status"/);
assert.match(delivery, /id="zg-gm-delivery-quest-importance"/);
assert.match(delivery, /activeTemplateIds/);
assert.match(delivery, /Обновить заготовку/);
assert.match(delivery, /function requestAssetLibrary\(force\)/);
assert.match(delivery, /w\.zgImageStore\.listAll/);
assert.match(delivery, /w\.zgImageStore\.put\(file, 'deliveries'/);
assert.match(delivery, /zgGmDeliveryUseAsset/);
assert.match(delivery, /zgGmDeliveryRefreshAssets/);
assert.match(delivery, /published !== true/);
assert.match(delivery, /id="zg-gm-delivery-presentation"/);
assert.match(delivery, /presentation-cinematic/);
assert.match(delivery, /id="zg-gm-delivery-private"/);
assert.match(delivery, /Скрытый текст можно отправить только одному игроку/);
assert.match(delivery, /privateDelivery:activeKind === 'text'/);
assert.match(delivery, /function filteredTemplates\(\)/);
assert.match(delivery, /librarySort === 'title'/);
assert.match(delivery, /zgGmDeliveryLibrarySearch/);
assert.match(delivery, /zgGmDeliveryLibraryCategory/);
assert.match(delivery, /zgGmDeliveryLibrarySort/);
assert.match(delivery, /zgGmDeliveryShelf/);
assert.match(delivery, /zgGmDeliveryRepeat/);
assert.match(delivery, /activeTarget === '__all__' \? 'Выдать группе'/);
assert.match(delivery, /w\.ZargotaRooms\.gmSendDeliveries\(memberUids, value\)/);
assert.match(delivery, /snapshot\s*&&\s*snapshot\.queuedOperation/);
assert.match(delivery, /выдача сохранена и отправится автоматически/);
assert.match(delivery, /function appendHistory/);
assert.match(delivery, /function previewMarkup/);
assert.match(delivery, /id="zg-gm-delivery-preview"/);
assert.match(delivery, /imageOmittedFromHistory = true/);
assert.match(delivery, /zargota_armory_v1/);
assert.match(delivery, /zargota_shop_v1/);
assert.match(delivery, /function normalizeExternalItem/);
assert.match(delivery, /function bundledSendValue/);
assert.match(delivery, /function addBundleItem/);
assert.match(delivery, /zgGmDeliveryImportOpen/);
assert.match(delivery, /zgGmDeliveryImportOne/);
assert.match(delivery, /zgGmDeliveryImportBundle/);
assert.match(delivery, /zgGmDeliveryBundleAddCurrent/);
assert.match(delivery, /zgGmDeliveryBundleAddTemplate/);
assert.match(delivery, /zgGmDeliveryBundleRemove/);
assert.match(delivery, /zgGmDeliveryBundleClear/);
assert.match(delivery, /rawItems = delivery\.payload && Array\.isArray\(delivery\.payload\.items\)/);
assert.match(delivery, /inventory\.length \+ additions\.length > 80/);
assert.match(delivery, /character\.inventoryItems = inventory\.concat\(additions\)/);
assert.match(delivery, /journal\.push\(/);
assert.match(delivery, /character\._gmDeliveryIds = appliedIds\(character\)\.concat\(deliveryId\)/);
assert.match(delivery, /acknowledgeGmDelivery\(delivery\.id, 'applied'\)/);
assert.match(delivery, /saveChars\(\{reason:saveReason\}\)/);
assert.match(delivery, /questResult\.mode === 'updated' \? 'journal-update' : 'journal-add'/);
assert.match(delivery, /character\.inventoryItems = rollback\.inventoryItems/);
assert.match(delivery, /character\.journalEntries = rollback\.journalEntries/);
assert.match(delivery, /character\._gmDeliveryIds = rollback\.deliveryIds/);
assert.match(delivery, /inventory\.concat\(additions\)\.some\(function \(item\)/);
assert.match(delivery, /journal\.findIndex\(function \(entry\)/);
assert.match(delivery, /delivery\.showPopup !== false/);
assert.match(delivery, /mood-' \+ \(delivery\.mood \|\| 'calm'\)/);
assert.match(delivery, /receivedFromGm:true/);
assert.match(delivery, /equipped:false/);
assert.match(delivery, /attackStat:source\.attackStat/);
assert.match(delivery, /preferredSlot:source\.slot/);

var questHelperStart = delivery.indexOf('function safeQuestId(value)');
var questHelperEnd = delivery.indexOf('function emptyLibrary()', questHelperStart);
var questUpsertStart = delivery.indexOf('function upsertQuestJournalEntry(journal, delivery)');
var questUpsertEnd = delivery.indexOf('function applyDelivery(delivery, member)', questUpsertStart);
var questContext = { result:null };
vm.runInNewContext(
  delivery.slice(questHelperStart, questHelperEnd) +
    delivery.slice(questUpsertStart, questUpsertEnd) +
    '; result=upsertQuestJournalEntry([], {id:"delivery-1",createdAt:100,title:"Найти руины",text:"Первый след",image:"images/ruins.webp",payload:{quest:{questId:"ruins-main",status:"new",importance:"main",imageFit:"cover"}}});',
  questContext
);
var createdQuest = questContext.result;
assert.strictEqual(createdQuest.mode, 'created');
assert.strictEqual(createdQuest.journal.length, 1);
assert.strictEqual(createdQuest.journal[0].journalId, 'gm-quest-ruins-main');
assert.strictEqual(createdQuest.journal[0].questId, 'ruins-main');
assert.strictEqual(createdQuest.journal[0].status, 'new');
assert.strictEqual(createdQuest.journal[0].importance, 'main');
assert.strictEqual(createdQuest.journal[0].image, 'images/ruins.webp');
assert.strictEqual(createdQuest.journal[0].imageFit, 'cover');
questContext.currentJournal = createdQuest.journal;
vm.runInNewContext(
  'result=upsertQuestJournalEntry(currentJournal, {id:"delivery-2",createdAt:200,title:"Вернуться к руинам",text:"Вход открыт",payload:{quest:{questId:"ruins-main",status:"completed",importance:"secondary"}}});',
  questContext
);
var updatedQuest = questContext.result;
assert.strictEqual(updatedQuest.mode, 'updated');
assert.strictEqual(updatedQuest.journal.length, 1);
assert.strictEqual(updatedQuest.journal[0].title, 'Вернуться к руинам');
assert.strictEqual(updatedQuest.journal[0].status, 'completed');
assert.strictEqual(updatedQuest.journal[0].importance, 'secondary');
assert.strictEqual(updatedQuest.journal[0].createdAt, 100);
assert.strictEqual(createdQuest.journal[0].title, 'Найти руины', 'upsert must not mutate the rollback source entry');
questContext.currentJournal = updatedQuest.journal;
vm.runInNewContext(
  'result=upsertQuestJournalEntry(currentJournal, {id:"delivery-old",createdAt:150,title:"Устаревшая версия",payload:{quest:{questId:"ruins-main",status:"active",importance:"main"}}});',
  questContext
);
assert.strictEqual(questContext.result.mode, 'stale');
assert.strictEqual(questContext.result.journal[0].title, 'Вернуться к руинам');

assert.match(styles, /\.zg-player-delivery-popup\.mood-calm/);
assert.match(styles, /\.zg-player-delivery-popup\.mood-solemn/);
assert.match(styles, /\.zg-player-delivery-popup\.mood-ominous/);
assert.match(styles, /\.zg-game-overlay\.gm\.gm-edit-mode \.zg-gm-delivery-button\{display:none\}/);
assert.match(styles, /\.zg-gm-delivery-preview-card/);
assert.match(styles, /\.zg-gm-delivery-library-tools/);
assert.match(styles, /\.zg-gm-delivery-history/);
assert.match(styles, /\.zg-gm-delivery-shelves/);
assert.match(styles, /\.zg-gm-delivery-import/);
assert.match(styles, /\.zg-gm-delivery-bundle/);
assert.match(styles, /\.zg-delivery-popup-bundle/);
assert.match(styles, /\.zg-gm-delivery-assets/);
assert.match(styles, /\.zg-player-delivery-popup\.presentation-cinematic/);

assert.match(todo, /Этап 1\. Единый канал выдачи/);
assert.match(todo, /Этап 4\. Канонические статусы/);
assert.match(todo, /Этап 6\. Каст заклинаний на сцене/);

console.log('gm delivery contract passed');
