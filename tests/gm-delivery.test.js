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
assert.match(network, /rarity:\['common','uncommon','rare','epic','legendary'\]/, 'rarity styling survives the Firebase normalization boundary');
assert.match(network, /presentationFx:\['none','dust','embers','arcane'\]/, 'the selected receipt particles survive the Firebase normalization boundary');
assert.match(network, /bundleImageSize>350000/);
assert.match(network, /questId:questId/);
assert.match(network, /icon:String\(rawQuest\.icon\|\|'✦'\)/);
assert.match(network, /status:questStatus/);
assert.match(network, /importance:questImportance/);
assert.match(network, /payload\.journalMode=journalMode/, 'text delivery destination survives the Firebase normalization boundary');
assert.match(network, /payload\.saveToJournal=journalMode!==\'message\'/, 'transient messages cannot accidentally become journal records');
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
assert.match(delivery, /MAX_SOURCE_IMAGE_BYTES = 12 \* 1024 \* 1024/);
assert.match(delivery, /var drafts = Object\.create\(null\)/);
assert.match(delivery, /var activeView = 'home'/);
assert.match(delivery, /function renderHome\(host, members\)/);
assert.match(delivery, /function composeRoute\(kind, payload\)/, 'each home choice resolves to its own delivery route');
assert.match(delivery, /function composeIdentityMarkup\(route\)/, 'the active route has a distinct visual identity and explanation');
assert.match(delivery, /function renderStorageHub\(host\)/, 'prepared cards open in a dedicated storage screen');
assert.match(delivery, /function renderHistoryHub\(host\)/, 'delivery history opens in a dedicated history screen');
assert.match(delivery, /w\.zgGmDeliveryOpenStorage = function/, 'storage is a first-class route instead of a composer drawer');
assert.match(delivery, /w\.zgGmDeliveryStorageFilter = function/, 'the storage route filters all card kinds directly');
assert.doesNotMatch(delivery, /zg-gm-delivery-tabs/, 'the specialized composer does not repeat the four-way type selector');
assert.match(delivery, /В инвентарь героя/);
assert.match(delivery, /В раздел заданий/);
assert.match(delivery, /Сообщение, письмо или место/);
assert.match(delivery, /Отдельный сценарий выдачи/);
assert.match(styles, /\.zg-gm-delivery-route\{/);
assert.match(styles, /\.zg-gm-delivery-storage-hub/);
assert.match(styles, /\.zg-gm-delivery-history-hub/);
assert.match(delivery, /ХРАНИЛИЩЕ СЕССИИ/);
assert.match(delivery, /function allPreparedArtifacts\(\)/);
assert.match(delivery, /zgGmDeliveryOpenHistory/);
assert.match(delivery, /zgGmDeliveryArchive/);
assert.match(delivery, /function historyShelfMarkup\(\)/, 'history renders its own cleanup toolbar and confirmation state');
assert.match(delivery, /zgGmDeliveryHistoryDeleteRequest/, 'individual history entries can be removed');
assert.match(delivery, /zgGmDeliveryHistoryClearRequest/, 'the full local delivery log can be cleared');
assert.match(delivery, /zgGmDeliveryHistoryCleanupConfirm/, 'history cleanup requires explicit confirmation');
assert.match(delivery, /Заготовки в хранилище и уже выданные игрокам/, 'cleanup explains that delivered data and saved cards are preserved');
assert.match(delivery, /w\.zgImageStore\.makePortable\(file/);
assert.match(delivery, /w\.zgGmDeliveryStart = function \(kind\)/);
assert.match(delivery, /activeView = 'compose'/);
assert.match(delivery, /w\.zgGmDeliveryHome = function \(\)/);
assert.match(delivery, /function rememberPanelDraft\(\)/);
assert.match(delivery, /function showGmSentNotice\(value, members, queued\)/, 'successful sends have a dedicated top confirmation notice');
assert.match(delivery, /setTimeout\(function \(\) \{ notice\.classList\.remove\('open'\); \}, queued \? 3000 : 2400\)/, 'the GM notice remains visible between one and three seconds');
assert.match(delivery, /function claimDeliveryPresentation\(deliveryId\)/, 'player card presentation is claimed by stable delivery id');
assert.match(delivery, /sessionStorage\.setItem\(PRESENTED_KEY/, 'receipt claims survive repeated Firebase renders in the current client tab');
assert.match(delivery, /if \(!options\.skipRemember\) rememberPanelDraft\(\)/);
assert.match(delivery, /function deliveryEditorActive\(\)/, 'delivery form detects when the GM is actively editing a field');
assert.match(delivery, /if \(deliveryEditorActive\(\)\) pendingMasterPanelRefresh = true;/, 'room snapshots must not replace an active delivery field');
assert.match(delivery, /if \(!pendingMasterPanelRefresh \|\| deliveryEditorActive\(\)\) return;/, 'the deferred refresh waits until text editing really ends');
assert.match(delivery, /function safeQuestId\(value\)/);
assert.match(delivery, /function upsertQuestJournalEntry\(journal, delivery\)/);
assert.match(delivery, /id="zg-gm-delivery-quest-status"/);
assert.match(delivery, /id="zg-gm-delivery-quest-importance"/);
assert.match(delivery, /id="zg-gm-delivery-quest-icon"/);
assert.match(delivery, /function questIconOptions\(value\)/);
assert.match(delivery, /w\.zgGmDeliveryOpenForMember = function \(memberUid, kind\)/);
assert.match(delivery, /activeTemplateIds/);
assert.match(delivery, /Обновить заготовку/);
assert.match(delivery, /function requestAssetLibrary\(force\)/);
assert.match(delivery, /w\.zgImageStore\.listMetadata \|\| w\.zgImageStore\.listAll/, 'the library prefers lightweight IndexedDB metadata instead of retaining every Blob');
assert.match(delivery, /w\.zgImageStore\.put\(file, 'deliveries'/);
assert.match(delivery, /zgGmDeliveryUseAsset/);
assert.match(delivery, /zgGmDeliveryRefreshAssets/);
assert.match(delivery, /published !== true/);
assert.match(delivery, /var assetVisibleLimit = 24/, 'the image library renders in bounded batches');
assert.match(delivery, /loading="lazy" decoding="async"/, 'library thumbnails load lazily');
assert.match(delivery, /id="zg-gm-delivery-assets-search"/, 'the image library has an instant search');
assert.match(delivery, /function refreshAssetListDom\(\)/, 'search and filters update only the asset list instead of rebuilding the editor');
assert.match(delivery, /function assetReferenced\(path\)/, 'cleanup checks active and saved delivery references');
assert.match(delivery, /function assetCleanupCandidates\(mode\)/, 'cleanup separates cache files from unused local originals');
assert.match(delivery, /asset\.published === true && String\(asset\.path \|\| ''\)\.indexOf\('images\/deliveries\/'\) === 0/, 'bulk cleanup cannot remove portraits, shop art or assets owned by another section');
assert.match(delivery, /w\.zgGmDeliveryAssetCleanupConfirm/, 'asset deletion requires a custom confirmation step');
assert.match(delivery, /w\.zgImageStore\.remove/, 'confirmed cleanup removes records through the shared image store');
assert.match(html, /function listMetadata\(cb\)/, 'the shared image store exposes a metadata-only listing for large libraries');
assert.match(html, /size: Number\(value\.blob && value\.blob\.size\)/, 'metadata retains file size without retaining the Blob in UI state');
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
assert.match(delivery, /Изображение уже очищено из локальной истории/);
assert.match(delivery, /var activeTargets = \[\]/, 'recipient selection supports more than one player');
assert.match(delivery, /var itemDeliveryMode = 'single'/, 'single-item delivery is the default explicit flow');
assert.match(delivery, /var itemEditorOpen = false/, 'the custom item constructor starts collapsed');
assert.match(delivery, /w\.zgGmDeliveryItemMode = function/, 'the GM can deliberately switch between one item and a bundle');
assert.match(delivery, /w\.zgGmDeliveryOpenItemEditor = function/, 'the custom constructor opens only from a dedicated action');
assert.match(delivery, /w\.zgGmDeliveryCloseItemEditor = function/, 'the custom constructor can be collapsed without losing its draft');
assert.match(delivery, /ТАК УВИДИТ ИГРОК/, 'the preview is described in player-facing language');
assert.match(delivery, /Карточка одного предмета/, 'single-item presentation is visually separate from bundle summary');
assert.match(delivery, /Сводка набора/, 'bundle presentation has its own clear preview');
assert.match(delivery, /id="zg-gm-delivery-rarity"/, 'single-item receipt rarity is configurable');
assert.match(delivery, /id="zg-gm-delivery-fx"/, 'single-item receipt particles are configurable');
assert.match(delivery, /function targetCardsMarkup\(members\)/, 'recipients render as visual cards instead of a select');
assert.match(delivery, /zgGmDeliveryTargetToggle/, 'each player has an independent check toggle');
assert.match(delivery, /zgGmDeliveryTargetAll/, 'the whole group can be selected in one action');
assert.match(delivery, /targetMembers\(activeTargets\)/, 'the selected recipient set is passed to the existing atomic batch send');
assert.match(delivery, /ХРАНИЛИЩЕ СЕССИИ/, 'prepared session cards are exposed as the top-level storage action');
assert.match(delivery, /ДОБАВИТЬ ИЗ ДРУГИХ РАЗДЕЛОВ/, 'external sources stay in a separate bottom section');
assert.match(delivery, /String\(raw\.imageThumb \|\| raw\.image \|\| ''\)/, 'shop imports prefer the compressed catalog thumbnail');
assert.match(delivery, /loading="lazy" decoding="async"/, 'item thumbnails are decoded lazily');
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
assert.match(delivery, /<b>Товары<\/b>/);
assert.doesNotMatch(delivery, /<b>Оружейная<\/b>/);
assert.match(delivery, /zgGmDeliveryImportCategory/);
assert.match(delivery, /zgGmDeliveryImportEquip/);
assert.match(delivery, /function folderTabsMarkup/);
assert.match(delivery, /zgGmDeliveryFolderAdd/);
assert.match(delivery, /zgGmDeliveryTemplateFolder/);
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
assert.match(delivery, /rarity:source\.rarity \|\| 'common'/, 'received inventory keeps the presentation rarity');
assert.match(delivery, /equipped:false/);
assert.match(delivery, /attackStat:source\.attackStat/);
assert.match(delivery, /preferredSlot:source\.slot/);
assert.match(delivery, /deliveredItems\[0\] && deliveredItems\[0\]\.image/);

var questHelperStart = delivery.indexOf('function safeQuestId(value)');
var questHelperEnd = delivery.indexOf('function emptyLibrary()', questHelperStart);
var questUpsertStart = delivery.indexOf('function upsertQuestJournalEntry(journal, delivery)');
var questUpsertEnd = delivery.indexOf('function applyDelivery(delivery, member)', questUpsertStart);
var questContext = { result:null };
vm.runInNewContext(
  delivery.slice(questHelperStart, questHelperEnd) +
    delivery.slice(questUpsertStart, questUpsertEnd) +
    '; result=upsertQuestJournalEntry([], {id:"delivery-1",createdAt:100,title:"Найти руины",text:"Первый след",image:"images/ruins.webp",payload:{quest:{questId:"ruins-main",icon:"⚑",status:"new",importance:"main",imageFit:"cover"}}});',
  questContext
);
var createdQuest = questContext.result;
assert.strictEqual(createdQuest.mode, 'created');
assert.strictEqual(createdQuest.journal.length, 1);
assert.strictEqual(createdQuest.journal[0].journalId, 'gm-quest-ruins-main');
assert.strictEqual(createdQuest.journal[0].questId, 'ruins-main');
assert.strictEqual(createdQuest.journal[0].status, 'new');
assert.strictEqual(createdQuest.journal[0].importance, 'main');
assert.strictEqual(createdQuest.journal[0].icon, '⚑');
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

var imageJournalContext = { result:null };
vm.runInNewContext(
  delivery.slice(questHelperStart, questHelperEnd) +
    delivery.slice(questUpsertStart, questUpsertEnd) +
    '; result=upsertImageJournalEntry([], {id:"delivery-image-1",createdAt:300,title:"Сводка",text:"Подпись под фото",image:"data:image/webp;base64,AAAA"});',
  imageJournalContext
);
assert.strictEqual(imageJournalContext.result.mode, 'created');
assert.strictEqual(imageJournalContext.result.journal[0].kind, 'image');
assert.strictEqual(imageJournalContext.result.journal[0].image, 'data:image/webp;base64,AAAA');
assert.strictEqual(imageJournalContext.result.journal[0].text, 'Подпись под фото');
assert.match(delivery, /Сообщение, письмо или место/, 'the text entry point explains every supported journal destination');
assert.match(delivery, /Журнал героя → Заметки/, 'letters state their exact player journal destination');
assert.match(delivery, /Журнал героя → Места/, 'places state their exact player journal destination');
assert.match(delivery, /w\.zgGmDeliveryTextMode = function/, 'GM can switch the destination without a parallel delivery type');
assert.match(delivery, /function upsertTextJournalEntry\(journal, delivery\)/, 'letters use a stable journal upsert path');
assert.match(delivery, /persistText = delivery\.kind === 'text'/, 'text persistence is explicit and does not affect transient notices');

assert.match(styles, /\.zg-player-delivery-popup\.mood-calm/);
assert.match(styles, /\.zg-player-delivery-popup\.mood-solemn/);
assert.match(styles, /\.zg-player-delivery-popup\.mood-ominous/);
assert.match(styles, /\.zg-game-overlay\.gm\.gm-edit-mode \.zg-gm-delivery-button\{display:none\}/);
assert.match(styles, /\.zg-gm-delivery-preview-card/);
assert.match(styles, /\.zg-gm-delivery-item-mode/, 'single and bundle flows use a visual segmented control');
assert.match(styles, /\.zg-gm-delivery-text-mode/, 'messages, letters and places use visual destination cards');
assert.match(styles, /\.zg-gm-delivery-editor-launch/, 'the collapsed custom constructor has a compact launch card');
assert.match(styles, /\.zg-player-delivery-popup\.item-single\.rarity-legendary/, 'single item receipts have rarity-specific glow');
assert.match(styles, /\.zg-delivery-popup-particles/, 'single item receipts can render selected particles');
assert.match(styles, /\.zg-gm-delivery-sent-notice/);
assert.match(styles, /\.zg-gm-delivery-target-card\.selected/, 'selected recipients have a visible checked card state');
assert.match(styles, /\.zg-gm-delivery-template-grid/, 'prepared cards use a compact grid');
assert.match(styles, /\.zg-gm-delivery-sources>div\{display:grid;grid-template-columns:repeat\(3/, 'item sources use square visual cards');
assert.match(styles, /z-index:16080/, 'the GM confirmation stays above the session map layers');
assert.match(styles, /\.zg-gm-delivery-library-tools/);
assert.match(styles, /\.zg-gm-delivery-history/);
assert.match(styles, /\.zg-gm-delivery-history-confirm/);
assert.match(styles, /\.zg-gm-delivery-history article>footer button\.remove/);
assert.match(styles, /\.zg-gm-delivery-shelves/);
assert.match(styles, /\.zg-gm-delivery-import/);
assert.match(styles, /\.zg-gm-delivery-bundle/);
assert.match(styles, /\.zg-delivery-popup-bundle/);
assert.match(styles, /\.zg-gm-delivery-assets/);
assert.match(styles, /\.zg-gm-delivery-assets-list/);
assert.match(styles, /content-visibility:auto/, 'offscreen asset cards skip browser rendering work');
assert.match(styles, /\.zg-gm-delivery-cleanup/);
assert.match(styles, /\.zg-gm-delivery-home-actions/);
assert.match(styles, /\.zg-gm-delivery-home-library>div/);
assert.match(styles, /\.zg-gm-delivery-back/);
assert.match(styles, /user-select:text;-webkit-user-select:text;touch-action:auto/, 'delivery fields explicitly allow holding, selecting and editing text');
assert.match(styles, /\.zg-player-delivery-popup\.presentation-cinematic/);

assert.match(todo, /Этап 1\. Единый канал выдачи/);
assert.match(todo, /Этап 4\. Канонические статусы/);
assert.match(todo, /Этап 6\. Каст заклинаний на сцене/);

var applyHelperStart = delivery.indexOf('function safeQuestId(value)');
var applyHelperEnd = delivery.indexOf('function questIconOptions(value)', applyHelperStart);
var applyDeliveryStart = delivery.indexOf('function localCharacter(member)');
var applyDeliveryEnd = delivery.indexOf('function popupTitle(delivery)', applyDeliveryStart);
assert.ok(applyHelperStart >= 0 && applyHelperEnd > applyHelperStart);
assert.ok(applyDeliveryStart >= 0 && applyDeliveryEnd > applyDeliveryStart);

(async function testPlayerDeliveryApplication() {
  var acknowledged = [];
  var saveReasons = [];
  var deliveryCharacter = {id:'hero-delivery',inventoryItems:[],journalEntries:[]};
  var applyContext = {
    Promise:Promise,
    Date:Date,
    Math:Math,
    result:null,
    w:{
      characters:[deliveryCharacter],
      saveChars:function(options){saveReasons.push(options&&options.reason);return Promise.resolve({ok:true});},
      ZargotaRooms:{
        acknowledgeGmDelivery:function(id,status){acknowledged.push({id:id,status:status});return Promise.resolve({ok:true});}
      }
    }
  };
  vm.runInNewContext(
    delivery.slice(applyHelperStart, applyHelperEnd) +
      delivery.slice(applyDeliveryStart, applyDeliveryEnd) +
      '; result={applyDelivery:applyDelivery};',
    applyContext
  );
  var member = {characterId:'hero-delivery'};
  var itemDelivery = {
    id:'delivery-item-live',
    kind:'item',
    title:'Походный набор',
    text:'Выдан мастером',
    createdAt:500,
    payload:{items:[
      {name:'Зелье',icon:'🧪',category:'consumable',qty:2},
      {name:'Кинжал',icon:'🗡',category:'weapon',damageFormula:'1d4',attackStat:'dex',slot:'weapon'}
    ]}
  };
  await applyContext.result.applyDelivery(itemDelivery, member);
  assert.strictEqual(deliveryCharacter.inventoryItems.length, 2, 'player delivery handler must add every bundled item');
  assert.strictEqual(deliveryCharacter.inventoryItems[0].receivedFromGm, true);
  assert.strictEqual(deliveryCharacter.inventoryItems[1].preferredSlot, 'weapon');
  assert.deepStrictEqual(saveReasons, ['inventory-add']);
  assert.deepStrictEqual(acknowledged, [{id:'delivery-item-live',status:'applied'}]);

  await applyContext.result.applyDelivery(itemDelivery, member);
  assert.strictEqual(deliveryCharacter.inventoryItems.length, 2, 'repeated delivery handling must not duplicate items');
  assert.deepStrictEqual(saveReasons, ['inventory-add'], 'already applied delivery must not save again');
  assert.strictEqual(acknowledged.length, 2, 'an idempotent retry may safely acknowledge the same delivery');

  var singleItemDelivery = {
    id:'delivery-single-item-live',
    kind:'item',
    title:'Клинок рассвета',
    text:'Редкая награда.',
    image:'images/shop/dawn-blade.webp',
    createdAt:600,
    payload:{item:{name:'Клинок рассвета',icon:'⚔',category:'weapon',image:'images/shop/dawn-blade.webp',rarity:'rare',presentationFx:'dust',qty:1}}
  };
  await applyContext.result.applyDelivery(singleItemDelivery, member);
  assert.strictEqual(deliveryCharacter.inventoryItems.length, 3, 'a single item receipt must remain separate from bundle delivery');
  assert.strictEqual(deliveryCharacter.inventoryItems[2].image, 'images/shop/dawn-blade.webp');
  assert.strictEqual(deliveryCharacter.inventoryItems[2].rarity, 'rare', 'the received item keeps its rarity styling metadata');

  var questDelivery = {
    id:'delivery-quest-live',
    kind:'quest',
    title:'Найти старый колодец',
    text:'Осмотреть руины у тракта.',
    image:'images/journal/well.webp',
    createdAt:700,
    payload:{quest:{questId:'old-well',icon:'⚑',status:'active',importance:'main',imageFit:'cover'}}
  };
  await applyContext.result.applyDelivery(questDelivery, member);
  assert.strictEqual(deliveryCharacter.journalEntries.length, 1, 'quest delivery must create a journal entry');
  assert.strictEqual(deliveryCharacter.journalEntries[0].questId, 'old-well');
  assert.strictEqual(deliveryCharacter.journalEntries[0].image, 'images/journal/well.webp');
  assert.strictEqual(saveReasons[2], 'journal-add');
  assert.deepStrictEqual(acknowledged[3], {id:'delivery-quest-live',status:'applied'});

  var letterDelivery = {
    id:'delivery-letter-live',
    kind:'text',
    title:'Письмо из обители',
    text:'Приходи до заката.',
    image:'images/journal/seal.webp',
    createdAt:800,
    payload:{saveToJournal:true,playerCanDelete:true}
  };
  await applyContext.result.applyDelivery(letterDelivery, member);
  assert.strictEqual(deliveryCharacter.journalEntries.length, 2, 'persistent text delivery must create a journal letter');
  assert.strictEqual(deliveryCharacter.journalEntries[1].kind, 'note');
  assert.strictEqual(deliveryCharacter.journalEntries[1].playerCanDelete, true);
  assert.strictEqual(deliveryCharacter.journalEntries[1].image, 'images/journal/seal.webp');
  assert.strictEqual(saveReasons[3], 'journal-add');

  var placeDelivery = {
    id:'delivery-place-live',
    kind:'text',
    title:'Старый мост у тракта',
    text:'Под третьей опорой спрятан знак проводника.',
    image:'images/journal/old-bridge.webp',
    createdAt:900,
    payload:{journalMode:'place',saveToJournal:true,playerCanDelete:false}
  };
  await applyContext.result.applyDelivery(placeDelivery, member);
  assert.strictEqual(deliveryCharacter.journalEntries.length, 3, 'place delivery must create a persistent journal entry');
  assert.strictEqual(deliveryCharacter.journalEntries[2].kind, 'place');
  assert.strictEqual(deliveryCharacter.journalEntries[2].icon, '⌖');
  assert.strictEqual(deliveryCharacter.journalEntries[2].playerCanDelete, false);
  assert.strictEqual(saveReasons[4], 'journal-add');

  var transientDelivery = {
    id:'delivery-message-live',
    kind:'text',
    title:'Шёпот из темноты',
    text:'Обернись.',
    createdAt:950,
    payload:{journalMode:'message',saveToJournal:false}
  };
  await applyContext.result.applyDelivery(transientDelivery, member);
  assert.strictEqual(deliveryCharacter.journalEntries.length, 3, 'transient messages must not clutter the journal');
  assert.strictEqual(saveReasons.length, 5, 'transient messages require no character save');
  console.log('gm delivery contract passed');
})().catch(function(error){
  console.error(error);
  process.exitCode=1;
});
