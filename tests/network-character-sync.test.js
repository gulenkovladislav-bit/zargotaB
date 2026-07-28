'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var outbox = require(path.join(root, 'character-sync-outbox.js'));

assert.strictEqual(
  network.indexOf("'campaigns/") >= 0 || network.indexOf('"campaigns/') >= 0,
  false,
  'network code must not write or subscribe to shared campaign paths'
);
assert.match(network, /characterId:\s*String\(character\.id\),character:entrySnapshot/);
assert.match(network, /snapshot\.source\s*=\s*source\s*\|\|\s*'edit'/);
assert.match(network, /snapshot\.revision\s*=\s*Math\.max\(localRevision,\s*roomRevision\)\s*\+\s*1/);
assert.match(network, /snapshot\.updatedBy\s*=\s*String\(user\s*&&\s*user\.uid/);
assert.match(network, /function sessionProgressionPlan\(value\)/);
assert.match(network, /progressionPlan:\s*sessionProgressionPlan\(character\.progressionPlan\)/);
assert.match(html, /GM_SHEET_SEEN_KEY='zargota_gm_sheet_seen_v1'/);
assert.match(html, /function gmSheetIsUnread\(member\)/);
assert.match(html, /РОАДМАПА ИГРОКА/);
assert.match(html, /Только просмотр — план ещё не применён к листу/);
assert.match(network, /gmProposeSkillUpdate:\s*function/);
assert.match(network, /resolveSkillUpdateProposal:\s*function/);
assert.match(network, /acknowledgeSkillUpdateProposal:\s*function/);
assert.match(network, /skillUpdateSignature\(currentSkill\)!==String\(live\.baseSignature/);
assert.match(html, /function zgApplyApprovedSkillUpdate\(localCharacter,member\)/);
assert.match(html, /zgSkillUpdateSignature\(current\)!==zgSkillUpdateSignature\(base\)/);
assert.match(html, /Сначала дождитесь статуса «Синхронизировано»/);
assert.match(html, /Предложить улучшение/);
assert.match(html, /ПРЕДЛОЖЕНИЕ МАСТЕРА/);
assert.match(network, /if\s*\(!canApplyIncomingCharacter\(session,\s*member\.character,\s*\{\s*allowQueued:true\s*\}\)\)\s*return/);
assert.match(network, /String\(member\.characterId\s*\|\|\s*''\)\s*!==\s*String\(character\.id\)/);
assert.match(network, /if\s*\(heroTaken\)\s*throw roomError/);
assert.match(network, /var TAB_ID_KEY = 'zargota_vtt_tab_id_v1'/);
assert.match(network, /var TAB_CHANNEL_NAME = 'zargota-session-tabs-v1'/);
assert.match(network, /session\.tabId = sessionTabId\(\)/);
assert.match(network, /tabCoordination:\s*tabCoordinationState\(\)/);
var tabCoordinationStart = network.indexOf('  function tabCoordinationMessage(');
var tabCoordinationEnd = network.indexOf('  function readSession()', tabCoordinationStart);
var tabCoordinationBlock = network.slice(tabCoordinationStart, tabCoordinationEnd);
assert.match(tabCoordinationBlock, /new w\.BroadcastChannel\(TAB_CHANNEL_NAME\)/);
assert.match(tabCoordinationBlock, /data\.type === 'release'/);
assert.match(tabCoordinationBlock, /data\.type !== 'heartbeat' && data\.type !== 'probe'/);
assert.match(tabCoordinationBlock, /data\.type !== 'takeover'/);
assert.match(tabCoordinationBlock, /String\(peer\.uid \|\| ''\) === uid/);
assert.match(tabCoordinationBlock, /isSecondary:/);
assert.match(network, /if \(!tabCanWrite\(\)\) return Promise\.reject\(roomError\(/);
assert.match(network, /clearPresenceDisconnectHandles/);
assert.strictEqual(tabCoordinationBlock.indexOf('stopWatchingRoom') >= 0, false, 'detection must not stop an active room');
assert.strictEqual(tabCoordinationBlock.indexOf('firebase.') >= 0, false, 'detection must remain local');
assert.match(html, /id="zg-tab-session-warning"/);
assert.match(html, /id="zg-tab-session-takeover"/);
assert.match(html, /ZargotaRooms\.takeOverTab\(\)/);
assert.match(html, /tabCoordination\.isSecondary/);
assert.match(network, /setPersistence\(auth,\s*authModule\.browserLocalPersistence\)/);
assert.strictEqual(network.indexOf('authModule.browserSessionPersistence') >= 0, false, 'anonymous uid must survive a closed tab');
assert.strictEqual(network.indexOf('authModule.signOut(auth)') >= 0, false, 'missing tab-session must not rotate the reconnect identity');
assert.match(network, /\['pairing','character-select'\]\.indexOf\(String\(room\.phase \|\| ''\)\)/);
assert.match(network, /if \(room\.masterUid === user\.uid\)/);
assert.match(network, /pending\.uid === room\.masterUid/);
assert.match(network, /'identity-conflict'/);
assert.match(network, /String\(pending\.uid \|\| ''\) !== String\(room && room\.masterUid \|\| ''\)/);
assert.match(html, /snapshot\.session\.role==='master'\)w\.zgAdvShowHost\(\)/);

var sessionHelpersStart = network.indexOf('  function sessionTabId()');
var sessionHelpersEnd = network.indexOf('  function generatedCode(', sessionHelpersStart);
var sessionValues = {};
var sessionContext = {
  SESSION_KEY:'test-session',
  TAB_ID_KEY:'test-tab',
  TAB_STARTED_KEY:'test-tab-started',
  TAB_CHANNEL_NAME:'test-channel',
  tabChannel:null,
  tabPeers:{},
  tabHeartbeatTimer:0,
  Math:Math,
  Date:Date,
  JSON:JSON,
  Uint32Array:Uint32Array,
  Array:Array,
  now:function(){return Date.now();},
  w:{crypto:{randomUUID:function(){return '12345678-1234-1234-1234-123456789abc';}}},
  sessionStorage:{
    getItem:function(key){return Object.prototype.hasOwnProperty.call(sessionValues,key)?sessionValues[key]:null;},
    setItem:function(key,value){sessionValues[key]=String(value);},
    removeItem:function(key){delete sessionValues[key];}
  }
};
vm.runInNewContext(network.slice(sessionHelpersStart,sessionHelpersEnd),sessionContext);
sessionContext.saveSession({code:'ROOM',uid:'user',role:'player'});
var storedTabId=JSON.parse(sessionValues['test-session']).tabId;
assert.match(storedTabId,/^tab-/);
assert.strictEqual(sessionContext.readSession().tabId,storedTabId,'reload in the same tab must keep tabId');
sessionContext.saveSession(null);
assert.strictEqual(sessionContext.sessionTabId(),storedTabId,'leaving a room must not change the tab identity');

var skillHelpersStart = network.indexOf('  function normalizeSkillUpdateValue(');
var skillHelpersEnd = network.indexOf('  function normalizeInventoryOperationItem(', skillHelpersStart);
var skillContext = { Math:Math, Number:Number, String:String, JSON:JSON };
vm.runInNewContext(network.slice(skillHelpersStart, skillHelpersEnd), skillContext);
var baseSkill = { name:'Навык', type:'Активный', description:'Старая версия', usages:'1 раз', cdMax:1, cdUsed:1, custom:'keep' };
var sameIdentity = { name:'Навык', type:'Активный', description:'Новая версия', usages:'2 раза', cdMax:2 };
assert.strictEqual(skillContext.stableSkillId(baseSkill,2),skillContext.stableSkillId(sameIdentity,2),'generated skill id must survive description changes');
var patchedSkill = skillContext.applySkillUpdatePatch(baseSkill,sameIdentity,skillContext.stableSkillId(baseSkill,2));
assert.strictEqual(patchedSkill.description,'Новая версия');
assert.strictEqual(patchedSkill.cdMax,2);
assert.strictEqual(patchedSkill.cdUsed,1);
assert.strictEqual(patchedSkill.custom,'keep','skill patch must preserve unrelated fields');
assert.notStrictEqual(skillContext.skillUpdateSignature(baseSkill),skillContext.skillUpdateSignature(sameIdentity));

var localSkillHelpersStart = html.indexOf('function zgNormalizeSkillUpdateValue(');
var localSkillHelpersEnd = html.indexOf('function zgApplySessionCharacterToLocal(', localSkillHelpersStart);
var localSkillContext = { Math:Math, Number:Number, String:String, JSON:JSON, Array:Array, Object:Object };
vm.runInNewContext(html.slice(localSkillHelpersStart, localSkillHelpersEnd), localSkillContext);
var localHero = { skills:[Object.assign({},baseSkill)] };
var approvedMember = { characterUpdateProposal:{
  id:'skill-update-test',kind:'skill-update',status:'approved',skillId:'skill-test',skillIndex:0,
  baseSkill:skillContext.normalizeSkillUpdateValue(baseSkill),
  patch:skillContext.normalizeSkillUpdateValue(sameIdentity)
} };
var firstLocalApply = localSkillContext.zgApplyApprovedSkillUpdate(localHero,approvedMember);
assert.strictEqual(firstLocalApply.changed,true);
assert.strictEqual(localHero.skills[0].description,'Новая версия');
assert.deepStrictEqual(Array.from(localHero._appliedCharacterUpdateIds),['skill-update-test']);
var repeatedLocalApply = localSkillContext.zgApplyApprovedSkillUpdate(localHero,approvedMember);
assert.strictEqual(repeatedLocalApply.already,true,'accepted operation must be idempotent locally');
var changedLocalHero = { skills:[Object.assign({},baseSkill,{description:'Локальная новая правка'})] };
var conflictingLocalApply = localSkillContext.zgApplyApprovedSkillUpdate(changedLocalHero,approvedMember);
assert.strictEqual(conflictingLocalApply.conflict,true);
assert.strictEqual(changedLocalHero.skills[0].description,'Локальная новая правка','conflict must preserve fresh local skill');

var tabChannels=[];
function FakeSessionChannel(name){this.name=name;this.onmessage=null;tabChannels.push(this);}
FakeSessionChannel.prototype.postMessage=function(data){
  var own=this;
  tabChannels.slice().forEach(function(channel){
    if(channel!==own&&channel.name===own.name&&channel.onmessage)channel.onmessage({data:data});
  });
};
FakeSessionChannel.prototype.close=function(){var own=this;tabChannels=tabChannels.filter(function(channel){return channel!==own;});};
function coordinatedTab(tabId,startedAt,uid){
  var values={
    'test-tab':tabId,
    'test-tab-started':String(startedAt)
  };
  var tabWindow={
    crypto:{},
    BroadcastChannel:FakeSessionChannel,
    addEventListener:function(){}
  };
  var context={
    SESSION_KEY:'test-session',
    TAB_ID_KEY:'test-tab',
    TAB_STARTED_KEY:'test-tab-started',
    TAB_CHANNEL_NAME:'test-channel',
    tabChannel:null,
    tabPeers:{},
    tabHeartbeatTimer:0,
    tabWasSecondary:false,
    connected:false,
    Math:Math,Date:Date,JSON:JSON,Uint32Array:Uint32Array,Array:Array,
    now:function(){return Date.now();},
    w:tabWindow,
    clearPresenceDisconnectHandles:function(){return Promise.resolve();},
    setPresence:function(){return Promise.resolve();},
    emit:function(){},
    setInterval:function(){return 1;},
    clearInterval:function(){},
    sessionStorage:{
      getItem:function(key){return Object.prototype.hasOwnProperty.call(values,key)?values[key]:null;},
      setItem:function(key,value){values[key]=String(value);},
      removeItem:function(key){delete values[key];}
    }
  };
  context.api={getSnapshot:function(){return {tabCoordination:context.tabCoordinationState()};}};
  vm.runInNewContext(network.slice(sessionHelpersStart,sessionHelpersEnd),context);
  context.saveSession({code:'ROOM',uid:uid||'same-user',role:'player'});
  context.initTabCoordination();
  return context;
}
var firstSessionTab=coordinatedTab('tab-first-tab',1000,'same-user');
var secondSessionTab=coordinatedTab('tab-second-tab',2000,'same-user');
assert.strictEqual(firstSessionTab.tabCoordinationState().active,2);
assert.strictEqual(firstSessionTab.tabCoordinationState().isSecondary,false);
assert.strictEqual(secondSessionTab.tabCoordinationState().active,2);
assert.strictEqual(secondSessionTab.tabCoordinationState().isSecondary,true,'newer tab must show the duplicate-session warning');
secondSessionTab.takeOverTab();
assert.strictEqual(secondSessionTab.tabCoordinationState().isSecondary,false,'explicit takeover must give the newer tab ownership');
assert.strictEqual(firstSessionTab.tabCoordinationState().isSecondary,true,'previous owner must become read-only');
assert.strictEqual(firstSessionTab.tabCanWrite(),false,'previous owner must reject Firebase writes after takeover');
assert.strictEqual(secondSessionTab.tabCanWrite(),true);
secondSessionTab.saveSession(null);
assert.strictEqual(firstSessionTab.tabCoordinationState().active,1,'release must remove the duplicate immediately');
assert.strictEqual(firstSessionTab.tabCoordinationState().isSecondary,false,'remaining tab must regain ownership after release');
var differentIdentityTab=coordinatedTab('tab-different-user',3000,'different-user');
assert.strictEqual(firstSessionTab.tabCoordinationState().active,1,'a different uid in the same room is not a duplicate identity');
assert.strictEqual(differentIdentityTab.tabCoordinationState().active,1);
assert.strictEqual(differentIdentityTab.tabCoordinationState().isSecondary,false);

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
var leaveStart = network.indexOf('leaveRoom: function');
var leaveEnd = network.indexOf('leaveRoomWithLocalCopy: function', leaveStart);
var leaveBlock = network.slice(leaveStart, leaveEnd);
assert.ok(leaveBlock.indexOf('if (!tabCanWrite())') < leaveBlock.indexOf('firebase.get(memberRef)'), 'secondary tab must exit locally before final pull');
var secondaryExitBlock = leaveBlock.slice(leaveBlock.indexOf('if (!tabCanWrite())'), leaveBlock.indexOf('var finalPull'));
assert.strictEqual(secondaryExitBlock.indexOf('clearCharacterOutbox') >= 0, false, 'secondary exit must preserve the shared character outbox');
assert.strictEqual(secondaryExitBlock.indexOf('firebase.remove') >= 0, false, 'secondary exit must not delete room data');
assert.ok(network.indexOf('onDisconnect(roomRef(session.code)).remove()') < 0);
assert.match(network, /masterOnline:false/);
assert.match(network, /SYNC_LOG_KEY/);
assert.match(html, /Скопировать sync-диагностику/);
assert.match(network, /leaveRoomWithLocalCopy/);
var releaseStart=network.indexOf('releasePlayer: function');
var releaseEnd=network.indexOf('startCharacterSelection: function',releaseStart);
var releaseBlock=network.slice(releaseStart,releaseEnd);
assert.match(releaseBlock, /releasedMembers\/'\s*\+\s*memberUid/);
assert.match(releaseBlock, /updates\['members\/'\s*\+\s*memberUid\]\s*=\s*null/);
assert.match(releaseBlock, /\['pairing','character-select'\]/);
assert.match(releaseBlock, /member\.online\s*!==\s*false/);
assert.match(html, /ZargotaRooms\.releasePlayer\(uid\)/);
assert.match(html, /Снимок его room-листа останется в резерве комнаты/);
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
assert.match(network, /gmAddJournalEntry:\s*function/);
assert.match(network, /gmAdjustAbilityUsage:\s*function/);
assert.match(network, /adjustOwnAbilityUsage:\s*function/);
assert.match(network, /current\.source='player-ability-resource'/);
assert.match(network, /request\.actionKind === 'ability'[^]*applyAbilityUsageDomainOperation\(character\.abilityUsage/);
assert.match(network, /actionKind==='spell-learning'/);
assert.match(network, /character\.source='spell-learning-approved'/);
assert.match(network, /firebase\.runTransaction\(firebase\.ref\(db,'rooms\/'\+session\.code\+'\/members\/'\+memberUid\+'\/character'\)/);
assert.match(network, /current\.abilityUsage=usageResult\.usage/);
assert.match(network, /current\.source='gm-ability-resource'/);
assert.match(network, /current\.revision=Math\.max\(0,Number\(current\.revision\)\|\|0\)\+1/);
assert.match(network, /atBoundary=!usageResult\.changed/);
assert.match(network, /applyJournalDomainOperation\(current,\s*\{type:'add',entry:normalizedEntry\}/);
assert.match(network, /source:'gm-journal-add'/);
assert.match(network, /applyJournalDomainOperation\(current,\{type:'replace',entries:liveSnapshot\.journalEntries\}/);
assert.match(network, /journalBaseSignature/);
assert.match(network, /store\.fieldSignature\(current\.journalEntries\)\s*!==\s*journalBaseSignature/);
assert.match(network, /Journal changed in room while local edits were queued/);
assert.match(network, /gmAdjustEntity:\s*function/);
assert.match(network, /kind==='temp-hp'/);
assert.match(network, /applyVitalsDomainOperation\(\{hp:hp,hpMax:hpMax,tempHp:tempHp\},\{damage:amount\}\)/);
assert.match(network, /applyStatusDomainOperation\(\{statuses:statuses,statusEffects:statusEffects\}/);
assert.match(network, /character\/revision'\]\s*=\s*firebase\.increment\(1\)/);
assert.match(network, /character\/syncOperationId'\]\s*=\s*eventId/);
assert.match(network, /kind==='temp-hp'\?'gm-temp-hp'/);
assert.match(network, /updates\.manualEvent=event/);
assert.match(network, /statusEnabled:statusEnabled/);
assert.match(html, /zgGmInterventionApply\(\\'temp-hp\\'\)/);
assert.match(html, /zgGmInterventionOpenHero\(\\'inventory\\'\)/);
assert.match(html, /zgGmInterventionOpenHero\(\\'abilities\\'\)/);
assert.match(html, /zgGmInterventionOpenHero\(\\'journal\\'\)/);
assert.match(html, /intervention\.classList\.add\('open'\)/);
assert.match(network, /increment:\s*databaseModule\.increment/);
assert.match(html, /class="zg-gm-target-card"/);
assert.match(html, /zgGmInterventionAmount\(10\)/);
assert.match(html, /class="zg-gm-primary-actions"/);
assert.match(html, /class="zg-gm-status-section"/);
assert.match(html, /@media\(max-width:700px\)\{\.zg-gm-intervention/);
assert.match(html, /function animateGmAdjustmentVisual/);
assert.match(html, /state&&state\.room&&state\.room\.manualEvent/);
assert.match(html, /event\.statusEnabled\?'gm-status-add':'gm-status-remove'/);
assert.match(html, /className='zg-gm-particles '/);
assert.match(html, /@keyframes zgGmDamageAvatar/);
assert.match(html, /@keyframes zgGmHealAvatar/);
assert.match(html, /zgDicePlanB/);
assert.match(html, /type==='free'\?'zgDicePlanB\(event\)'/);
assert.doesNotMatch(html, /data-dice-free-mode/);
assert.match(html, /План Б · свободный бросок без расхода действия/);
assert.match(html, /zgVttGmAbilityUsage/);
assert.match(html, /class="zg-ability-gm-resource"/);
assert.match(html, /ZargotaSound\.heal/);
assert.match(html, /@keyframes zgGmStatusArrive/);
assert.match(html, /@keyframes zgGmStatusLeave/);
assert.match(network, /firebase\.runTransaction\(characterRef/);
assert.match(network, /store\.applyInventoryOperations\(current,\s*\[\{type:'add',field:'inventoryItems',itemId:normalizedItem\.itemId,item:normalizedItem\}\]/);
assert.match(network, /source:'gm-inventory-add'/);
assert.match(network, /runTransaction:\s*trackedFirebaseWrite\('transaction',\s*databaseModule\.runTransaction,\s*-1\)/);
assert.match(network, /Room character changed while local edits were queued/);
assert.match(network, /store\.recordConflict\(entry,\s*member\.character\)/);
assert.match(network, /conflicts:\s*syncOutbox\(\)/);
assert.match(network, /store\.matchesApplied\(entry,\s*member\.character\)/);
assert.match(network, /outbox-already-acked/);
assert.match(network, /pending\s*&&\s*!\(store\.matchesApplied/);
assert.match(network, /localUnsynced\s*\|\|\s*pending/);
assert.match(network, /canApplyIncomingCharacter\(session,\s*member\.character,\s*\{\s*allowQueued:true\s*\}\)/);
assert.match(network, /clearLocalUnsynced\(entry\.characterId\)/);
assert.match(network, /firebase\.ref\(db,\s*'\.info\/connected'\)/);
assert.match(network, /if\s*\(connected\)\s*\{\s*setPresence\(readSession\(\)\);\s*flushCharacterOutbox\(\);/);
assert.match(network, /if\s*\(connected\)\s*flushCharacterOutbox\(\);/);
assert.match(network, /if\s*\(remaining\s*&&\s*connected\s*&&\s*shouldContinue\)\s*return\s*flushCharacterOutbox\(\);/);

var domainStart = network.indexOf('function applyVitalsDomainOperation');
var domainEnd = network.indexOf('function combatHeroEntry', domainStart);
var domainContext = { result:null };
vm.runInNewContext(
  network.slice(domainStart, domainEnd) +
    '; result={' +
      'damage:applyVitalsDomainOperation({hp:12,hpMax:20,tempHp:4},{damage:7}),' +
      'heal:applyVitalsDomainOperation({hp:18,hpMax:20,tempHp:0},{heal:7}),' +
      'temp:applyVitalsDomainOperation({hp:10,hpMax:20,tempHp:0},{setTempHp:50}),' +
      'statusAdd:applyStatusDomainOperation({statuses:[],statusEffects:[]},{statusKey:"burn",enable:true,effect:{type:"status",sourceId:"spell-1"}}),' +
      'statusRemove:applyStatusDomainOperation({statuses:["burn"],statusEffects:[{statusKey:"burn"}]},{statusKey:"burn",enable:false}),' +
      'usage:applyAbilityUsageDomainOperation({"spell-1":{used:1,max:3}},"spell-1",{delta:1,max:3}),' +
      'authoritativeUsage:applyAbilityUsageDomainOperation({"spell-2":{used:2,max:5}},"spell-2",{delta:1,max:3,preserveExistingMax:false})' +
    '};',
  domainContext
);
assert.strictEqual(domainContext.result.damage.hp, 9);
assert.strictEqual(domainContext.result.damage.tempHp, 0);
assert.strictEqual(domainContext.result.damage.absorbed, 4);
assert.strictEqual(domainContext.result.heal.hp, 20);
assert.strictEqual(domainContext.result.temp.tempHp, 10);
assert.deepStrictEqual(Array.from(domainContext.result.statusAdd.statuses), ['burn']);
assert.strictEqual(domainContext.result.statusAdd.statusEffects[0].sourceId, 'spell-1');
assert.strictEqual(domainContext.result.statusRemove.statuses.length, 0);
assert.strictEqual(domainContext.result.statusRemove.statusEffects.length, 0);
assert.strictEqual(domainContext.result.usage.used, 2);
assert.strictEqual(domainContext.result.usage.changed, true);
assert.strictEqual(domainContext.result.authoritativeUsage.used, 3);
assert.strictEqual(domainContext.result.authoritativeUsage.max, 3);

var combatDamageStart = network.indexOf('resolveCombatDamage: function');
var combatDamageEnd = network.indexOf('finishApprovedDamageRoll: function', combatDamageStart);
assert.match(network.slice(combatDamageStart, combatDamageEnd), /applyVitalsDomainOperation\(target,\{damage:damage\}\)/);
var combatAbilityStart = network.indexOf('resolveCombatAbility: function');
var combatAbilityEnd = network.indexOf('prepareCombatReaction: function', combatAbilityStart);
assert.match(network.slice(combatAbilityStart, combatAbilityEnd), /applyVitalsDomainOperation\(target,\{damage:damage,heal:heal,preserveOverMax:true\}\)/);
assert.match(network.slice(combatAbilityStart, combatAbilityEnd), /applyStatusDomainOperation\(target,/);
assert.match(network.slice(combatAbilityStart, combatAbilityEnd), /applyAbilityUsageDomainOperation\(member\.character&&member\.character\.abilityUsage[^;]+preserveExistingMax:false/);
assert.match(network, /statusTurnTick[\s\S]+applyVitalsDomainOperation\(\{hp:hp,hpMax:hpMax,tempHp:tempHp\}/);
assert.match(network, /outbox-remove-error/);
assert.match(network, /outbox:\s*syncOutbox\(\)/);
assert.match(network, /restoreCharacterInboundFromRoom/);
assert.match(network, /enableCharacterInbound\(session,\s*\{\s*uid:session\.uid\s*\},\s*member\.character\)/);
var journeySyncStart = html.indexOf('  function localCharacter(snapshot)');
var journeySyncEnd = html.indexOf('  // «Да» — закрепляем локальный лист', journeySyncStart);
var journeySyncBlock = html.slice(journeySyncStart, journeySyncEnd);
assert.match(journeySyncBlock, /var id = member && member\.characterId/);
assert.match(journeySyncBlock, /String\(chars\[i\]\.id\) === String\(id\)/);
assert.match(journeySyncBlock, /room\.phase === 'character-select'/);
assert.match(journeySyncBlock, /room\.phase === 'journey' \|\| room\.phase === 'playing'/);
assert.match(journeySyncBlock, /beginJourney\(c,\s*true\)/);
assert.match(journeySyncBlock, /finishJourney\(\)/);
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
assert.match(html, /function applyCharsMigrations[\s\S]*normalizeCharacterInventory\(c,/);
assert.match(html, /function saveChars\(options\)[\s\S]*normalizeCharacterInventory\(c,/);
assert.match(html, /applyCharsMigrations\(characters,\{consolidateEquipment:false\}\)/);
assert.match(html, /characterEquipmentMigrationReady=!!\(result\.equipmentBackup&&result\.equipmentBackup\.ok\)/);
assert.match(html, /normalizeCharacterInventory\(c,\{consolidateEquipment:characterEquipmentMigrationReady\}\)/);
assert.match(html, /function zgRestoreBeforeEquipmentMigration\(\)/);
assert.match(html, /store\.restoreEquipmentMigrationBackup\(\)/);
assert.match(html, /До объединения снаряжения/);
var addEquipmentStart = html.indexOf('function addEquipItem(id)');
var addEquipmentEnd = html.indexOf('function removeEquipItem', addEquipmentStart);
var addEquipmentBlock = html.slice(addEquipmentStart, addEquipmentEnd);
assert.match(addEquipmentBlock, /c\.inventoryItems\.push/);
assert.strictEqual(addEquipmentBlock.indexOf('c.equipItems.push') >= 0, false, 'new equipment must use canonical inventoryItems');
assert.match(addEquipmentBlock, /openItemConstructor\(id, 'inventory-equip', newIdx\)/);
var arenaEquipmentStart = html.indexOf('function syncArmoryToCharacter');
var arenaEquipmentEnd = html.indexOf('function openArmoryEditor', arenaEquipmentStart);
var arenaEquipmentBlock = html.slice(arenaEquipmentStart, arenaEquipmentEnd);
assert.match(arenaEquipmentBlock, /character\.inventoryItems\.push/);
assert.strictEqual(arenaEquipmentBlock.indexOf('character.equipItems') >= 0, false, 'Arena equipment bridge must not recreate equipItems');
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
assert.match(html, /session\.role!=='player'/);
assert.match(html, /String\(member\.uid\)!==String\(session\.uid\)/);
assert.match(html, /function drawerMember\(\)/);
assert.match(html, /function drawerReadOnly\(member\)/);
assert.match(html, /var member=drawerMember\(\), localCharacter=fullLocalCharacter\(member\)/);
assert.match(html, /canEdit&&source==='inventory'/);
assert.match(html, /w\.zgVttInventoryOpenItem=function\(source,index\)\{\s*var member=drawerMember\(\)/);
assert.match(html, /w\.zgVttOpenPanelForMember=function\(panel,uid\)/);
assert.match(html, /drawerMemberUid = ''/);
assert.match(html, /Просмотр снимка комнаты · без редактирования и заявок/);
assert.match(html, /w\.zgVttSetInventoryNotice=function\(uid,kind,text\)/);
assert.match(html, /class="zg-bag-operation-state/);
assert.match(html, /role="status" aria-live="polite"/);
assert.match(html, /viewOnly\?'Только просмотр'/);
assert.match(html, /drawerReadOnly\(drawerMember\(\)\)\)\{if\(w\.showToast\)w\.showToast\('Чужой герой открыт только для просмотра'\)/);
var drawerOpenStart = html.indexOf('w.zgVttOpenPanel = function');
var drawerOpenEnd = html.indexOf('w.zgVttOpenPanelForMember', drawerOpenStart);
var drawerOpenBlock = html.slice(drawerOpenStart, drawerOpenEnd);
assert.strictEqual(drawerOpenBlock.indexOf('combat') >= 0, false, 'canonical drawer opening must not depend on combat mode');
var combatRenderStart = html.indexOf('function renderCombat()');
var combatRenderEnd = html.indexOf('function combatBusy', combatRenderStart);
var combatRenderBlock = html.slice(combatRenderStart, combatRenderEnd);
assert.match(combatRenderBlock, /zg-combat-inventory-button[^]*zgPlayerDockSelect\(\\'inventory\\'\)/);
assert.strictEqual(combatRenderBlock.indexOf('zgVttCloseDrawer') >= 0, false, 'combat rerenders must not close the canonical drawer');
assert.match(html, /onclick="zgVttOpenPanel\('character'\)" aria-label="Состояние Героя"/);
assert.match(html, /onclick="zgVttOpenPanel\('inventory'\)" aria-label="Вещи"/);
assert.match(html, /onclick="zgVttOpenPanel\('abilities'\)" aria-label="Магия"/);
assert.match(html, /onclick="zgVttOpenPanel\('journal'\)" aria-label="Личный журнал"/);
assert.match(html, /w\.zgSelectedHeroMemberUid=token\.type==='hero'/);
assert.match(html, /selectedInventoryUid=state&&state\.session&&state\.session\.role==='master'/);
assert.match(drawerOpenBlock, /zg-gm-intervention/);
assert.match(drawerOpenBlock, /activePanel === panel[^]*classList\.contains\('open'\)\) return;/);
assert.doesNotMatch(drawerOpenBlock, /activePanel === panel[^]*zgVttCloseDrawer/, 'repeated tab click must not close the backpack');
assert.match(html, /var backpackPanels=\{character:'hero',inventory:'items',abilities:'magic',journal:'journal'\}/);
assert.match(html, /backpack-v2\/open-status\.webp/);
assert.doesNotMatch(html, /src="images\/vtt-ui\/backpack-v2\/closed\.webp"/);
assert.doesNotMatch(html, /backpack-v2\/opening-1\.webp/);
assert.doesNotMatch(html, /backpack-v2\/opening-2\.webp/);
assert.doesNotMatch(html, /bag-page-switch|backpackMotionFrames/);
assert.doesNotMatch(html, /backpack-v2\/opening-0[1-6]\.webp/);
assert.doesNotMatch(html, /open-base-v2\.webp|clearBackpackSequence/);
assert.match(html, /@keyframes zgBagSlideIn/);
assert.match(html, /@keyframes zgBagSlideOut/);
assert.match(html, /--bag-entry-transform/);
assert.match(html, /if\(action==='inventory'\)\s*\{\s*if\(!turningOn\)\{\s*if\(w\.zgVttCloseDrawer\)w\.zgVttCloseDrawer\(\)/);
assert.match(html, /drawer\.classList\.add\('closing'\)/);
assert.match(html, /drawer\.classList\.remove\('open','closing'\)/);
assert.match(html, /playerDockAction==='inventory'\|\|playerDockAction==='abilities'/);
assert.match(html, /lastDrawerRenderSignature = ''/);
assert.match(html, /function syncBackpackArt\(drawer,skin\)/);
assert.match(html, /width:min\(670px,calc\(\(100vh - 32px\)\*\.72\),calc\(100vw - 18px\)\)/);
assert.match(html, /background:none/);
assert.match(html, /class="zg-state-board"/);
assert.match(html, /class="zg-state-hp"/);
assert.match(html, /activeStatuses=\[\]\.concat/);
assert.match(html, /class="zg-state-stat-list"/);
assert.match(html, /class="zg-bag-state-disclosure roadmap"/);
assert.match(html, /Мировой уровень славы/);
assert.match(html, /Уровень славы в Зарготе/);
assert.match(html, /class="zg-state-injuries"/);
assert.doesNotMatch(html, /РЕЖИМ БРОСКИ ЖИЗНИ/);
assert.match(html, /\.zg-vtt-drawer\.backpack-skin \.zg-bag-section-title\{display:none!important\}/);
assert.match(html, /grid-template-columns:repeat\(4,minmax\(0,82px\)\)/);
assert.match(html, /\.zg-state-portrait img\{filter:none\}/);

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
assert.match(html, /function abilityChargePips\(card, extraClass\)/);
assert.match(abilitiesBlock, /abilityChargePips\(card,'compact'\)/);
assert.match(abilitiesBlock, /class="zg-ability-eyebrow"/);
assert.match(abilitiesBlock, /Исчерпано/);
assert.match(html, /Статус изучения не передан/);
assert.match(html, /aria-label="Доступно /);
assert.match(html, /Кулдаун:/);
assert.match(html, /function abilityDetailSections\(card\)/);
assert.match(html, /class="zg-ability-detail-section"/);
assert.match(html, /w\.zgVttOwnAbilityUsage=function/);
assert.match(html, /w\.zgVttRequestLearning=function/);
assert.match(html, /function zgMergeSessionSpellsLearned/);

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
    notes: [{ text:'Сохранить текст', attachment:'data:image/png;base64,nested' }],
    journalEntries: [
      { journalId:'journal-safe_1', title:'Запись', text:'Текст', createdAt:100, updatedAt:200, updatedBy:'player-1', deletedAt:250 },
      { journalId:'bad/key', title:'Плохой id', text:'Не попадёт', createdAt:300 },
      { journalId:'journal-data', title:'data:text/plain,hidden', text:'blob:hidden', createdAt:-1, updatedAt:'oops', updatedBy:'data:text/plain,uid' }
    ],
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
assert.strictEqual(snapshotContext.result.notes[0].text, 'Сохранить текст');
assert.strictEqual(snapshotContext.result.notes[0].attachment, '');
assert.strictEqual(snapshotContext.result.portrait, '');
snapshotContext.input.portrait = 'blob:https://zargota.example/local-only';
vm.runInNewContext('result=characterSnapshot(input);', snapshotContext);
assert.strictEqual(snapshotContext.result.portrait, '');
snapshotContext.input.portrait = 'images/portraits/hero.webp';
vm.runInNewContext('result=characterSnapshot(input);', snapshotContext);
assert.strictEqual(snapshotContext.result.portrait, 'images/portraits/hero.webp');
assert.strictEqual(snapshotContext.result.journalEntries.length, 3);
assert.strictEqual(snapshotContext.result.journalEntries[0].journalId, 'journal-safe_1');
assert.strictEqual(snapshotContext.result.journalEntries[0].text, 'Текст');
assert.strictEqual(snapshotContext.result.journalEntries[0].deletedAt, 250);
assert.strictEqual(snapshotContext.result.journalEntries[1].journalId, 'badkey');
assert.strictEqual(snapshotContext.result.journalEntries[2].title, '');
assert.strictEqual(snapshotContext.result.journalEntries[2].text, '');
assert.strictEqual(snapshotContext.result.journalEntries[2].createdAt, 0);
assert.strictEqual(snapshotContext.result.journalEntries[2].updatedBy, '');
snapshotContext.input.journalEntries = Array.from({length:82}, function(_, index) {
  return { journalId:'journal-'+index, title:'Запись '+index, text:'Текст '+index, createdAt:index };
});
vm.runInNewContext('result=characterSnapshot(input);', snapshotContext);
assert.strictEqual(snapshotContext.result.journalEntries.length, 80);
assert.strictEqual(snapshotContext.result.journalEntries[0].journalId, 'journal-2');
assert.strictEqual(snapshotContext.result.journalEntries[79].journalId, 'journal-81');

var journalPanelStart = html.indexOf('function journalPanel');
var journalPanelEnd = html.indexOf('function vttAbilityProfile', journalPanelStart);
var journalPanelBlock = html.slice(journalPanelStart, journalPanelEnd);
assert.match(journalPanelBlock, /c\.journalEntries/);
assert.match(journalPanelBlock, /fullLocalCharacter\(member\)/);
assert.match(journalPanelBlock, /zgVttJournalOpen/);
assert.match(html, /saveChars\(\{reason:reason\|\|'journal-update'\}\)/);
assert.match(html, /journalSave\('journal-remove',true\)/);

var inventoryHelperStart = network.indexOf('function normalizeInventoryOperationItem');
var inventoryHelperEnd = network.indexOf('function emit', inventoryHelperStart);
var inventoryHelperSource = network.slice(inventoryHelperStart, inventoryHelperEnd);
var inventoryHelperContext = { result:null };
vm.runInNewContext(
  inventoryHelperSource +
    '; var item=normalizeInventoryOperationItem({itemId:"safe id!",name:"  Дар мастера  ",qty:5000,description:"Описание"},"fallback");' +
    'result=item;',
  inventoryHelperContext
);
var gmInventoryResult = outbox.applyInventoryOperations(
  {id:'hero',hpCur:7,statuses:['poison'],revision:4,inventoryItems:[]},
  [{type:'add',field:'inventoryItems',itemId:inventoryHelperContext.result.itemId,item:inventoryHelperContext.result}],
  {updatedAt:123,updatedBy:'gm',source:'gm-inventory-add',operationId:'op-1'}
);
assert.strictEqual(gmInventoryResult.ok, true);
assert.strictEqual(gmInventoryResult.character.inventoryItems[0].itemId, 'safeid');
assert.strictEqual(gmInventoryResult.character.inventoryItems[0].name, 'Дар мастера');
assert.strictEqual(gmInventoryResult.character.inventoryItems[0].qty, 999);
assert.strictEqual(gmInventoryResult.character.hpCur, 7);
assert.strictEqual(gmInventoryResult.character.statuses[0], 'poison');
assert.strictEqual(gmInventoryResult.character.revision, 5);
assert.strictEqual(gmInventoryResult.character.syncOperationId, 'op-1');

var fallbackItemContext = { result:null };
vm.runInNewContext(
  inventoryHelperSource +
    '; result=normalizeInventoryOperationItem({itemId:"!!!",name:"Дар"},"safe-fallback");',
  fallbackItemContext
);
assert.strictEqual(fallbackItemContext.result.itemId, 'safe-fallback');

var journalHelperContext = { result:null };
vm.runInNewContext(
  inventoryHelperSource +
    '; var entry=normalizeJournalOperationEntry({journalId:"master-entry",title:"  След  ",text:"Описание"},"fallback",{updatedAt:500,updatedBy:"gm"});' +
    'result=applyJournalDomainOperation({id:"hero",hpCur:7,revision:4,journalEntries:[{journalId:"player-entry",title:"Игрок"}]},{type:"add",entry:entry},{updatedAt:500,updatedBy:"gm",source:"gm-journal-add",operationId:"journal-op-1"});',
  journalHelperContext
);
assert.strictEqual(journalHelperContext.result.ok, true);
assert.strictEqual(journalHelperContext.result.character.hpCur, 7);
assert.strictEqual(journalHelperContext.result.character.journalEntries.length, 2);
assert.strictEqual(journalHelperContext.result.character.journalEntries[1].title, 'След');
assert.strictEqual(journalHelperContext.result.character.revision, 5);
assert.strictEqual(journalHelperContext.result.character.syncOperationId, 'journal-op-1');
var journalReplaceContext = { result:null };
vm.runInNewContext(
  inventoryHelperSource +
    '; result=applyJournalDomainOperation({hpCur:9,revision:8,journalEntries:[{journalId:"old"}]},{type:"replace",entries:[{journalId:"new",title:"Игрок"}]},{revision:10,updatedAt:600,updatedBy:"player",source:"journal-update",operationId:"journal-op-2"});',
  journalReplaceContext
);
assert.strictEqual(journalReplaceContext.result.ok, true);
assert.strictEqual(journalReplaceContext.result.character.hpCur, 9);
assert.strictEqual(journalReplaceContext.result.character.journalEntries[0].journalId, 'new');
assert.strictEqual(journalReplaceContext.result.character.revision, 10);
assert.strictEqual(journalReplaceContext.result.character.source, 'journal-update');

var applyStart = html.indexOf('function zgApplySessionCharacterToLocal');
var applyEnd = html.indexOf('window.zgPersistFinalSessionCharacter', applyStart);
var applyBlock = html.slice(applyStart, applyEnd);
assert.strictEqual(applyBlock.indexOf('skills:roomCharacter.skills') >= 0, false);
assert.strictEqual(applyBlock.indexOf('biography:roomCharacter.biography') >= 0, false);
assert.strictEqual(applyBlock.indexOf('notes:roomCharacter.notes') >= 0, false, 'legacy local notes must not be overwritten by a forced room snapshot');
assert.match(applyBlock, /journalEntries:zgMergeSessionJournalEntries\(localCharacter\.journalEntries,roomCharacter\.journalEntries\)/);
assert.match(snapshotSource, /notes:\s*clean\(character\.notes\s*\|\|\s*character\.journal\s*\|\|\s*character\.quests/);

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

var journalMergeStart = html.indexOf('function zgMergeSessionJournalEntries');
var journalMergeEnd = html.indexOf('function zgApplySessionCharacterToLocal', journalMergeStart);
var journalMergeContext = { result:null };
vm.runInNewContext(
  html.slice(journalMergeStart, journalMergeEnd) +
    '; result=zgMergeSessionJournalEntries([{journalId:"same",title:"Локальная",updatedAt:20},{journalId:"deleted",title:"Удалённая",deletedAt:30}], [{journalId:"same",title:"Комната",updatedAt:40},{journalId:"master",title:"Запись мастера",updatedAt:50}]);',
  journalMergeContext
);
assert.strictEqual(journalMergeContext.result.length, 3);
assert.strictEqual(journalMergeContext.result[0].title, 'Локальная');
assert.strictEqual(journalMergeContext.result[1].deletedAt, 30);
assert.strictEqual(journalMergeContext.result[2].title, 'Запись мастера');

var abilityMergeStart = html.indexOf('function zgMergeSessionAbilityUsage');
var abilityMergeEnd = html.indexOf('function zgApplySessionCharacterToLocal', abilityMergeStart);
var abilityMergeContext = { result:null };
vm.runInNewContext(
  html.slice(abilityMergeStart, abilityMergeEnd) +
    '; result=zgMergeSessionAbilityUsage({spellRefs:[101,202],spellCD:{101:{used:0,max:3,note:"keep"},202:{used:1,max:2}}},{"spell-101":{used:2,max:3},"skill-0":{used:5,max:5}});',
  abilityMergeContext
);
assert.strictEqual(abilityMergeContext.result['101'].used, 2);
assert.strictEqual(abilityMergeContext.result['101'].max, 3);
assert.strictEqual(abilityMergeContext.result['101'].note, 'keep');
assert.strictEqual(abilityMergeContext.result['202'].used, 1);
assert.strictEqual(abilityMergeContext.result['202'].max, 2);
assert.match(applyBlock, /spellCD:zgMergeSessionAbilityUsage\(localCharacter,roomCharacter\.abilityUsage\)/);
assert.match(applyBlock, /spellsLearned:zgMergeSessionSpellsLearned\(localCharacter,roomCharacter\.spellsLearned\)/);
var learnedMergeStart = html.indexOf('function zgMergeSessionSpellsLearned');
var learnedMergeEnd = html.indexOf('function zgApplySessionCharacterToLocal', learnedMergeStart);
var learnedMergeContext = { result:null };
vm.runInNewContext(
  html.slice(learnedMergeStart, learnedMergeEnd) +
    '; result=zgMergeSessionSpellsLearned({spellRefs:[101,202],spellsLearned:{101:true,202:false}},{"101":false,"202":true,"999":true});',
  learnedMergeContext
);
assert.strictEqual(learnedMergeContext.result['101'], true, 'stale room false must not forget a locally learned spell');
assert.strictEqual(learnedMergeContext.result['202'], true, 'approved room learning must merge into the local sheet');
assert.strictEqual(learnedMergeContext.result['999'], undefined, 'room learning outside local spellRefs must be ignored');
assert.match(html, /zgSheetTabAction\('journal'\)/);
assert.match(html, /zgVttJournalMasterAdd/);

console.log('network character sync contract passed');
