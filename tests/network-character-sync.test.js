'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var outbox = require(path.join(root, 'character-sync-outbox.js'));
var equipmentRules = require(path.join(root, 'equipment-rules.js'));

assert.match(html, /zargota-network\.js\?v=2026-08-15\.4/, 'network cache key must change with the GM journal mutation contract');
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
var characterSnapshotStart = network.indexOf('  function characterSnapshot(character)');
var characterSnapshotEnd = network.indexOf('  function campaignKeyFor(character)', characterSnapshotStart);
var characterSnapshotContext = {
  campaignKeyFor:function(character){ return String(character && character.campaignKey || ''); },
  mergeAppliedDeliveryIds:function(first, second){
    var result=[],seen={};
    [].concat(Array.isArray(first)?first:[],Array.isArray(second)?second:[]).forEach(function(rawId){
      var id=String(rawId||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,180);
      if(id&&!seen[id]){seen[id]=true;result.push(id);}
    });
    return result.slice(-120);
  },
  w:{}
};
vm.runInNewContext(network.slice(characterSnapshotStart, characterSnapshotEnd), characterSnapshotContext);
var vitalsSnapshot = characterSnapshotContext.characterSnapshot({
  id:'hero-vitals',
  hpCur:'11',
  hpMax:'14',
  ac:'10',
  initiative:'+2',
  speed:'7 м',
  stats:{},
  campaignKey:'hero-vitals',
  battleEcho:'Шрам после боя',
  family:[{id:'kin-1',name:'Сестра',relation:'сестра'}]
});
assert.strictEqual(vitalsSnapshot.hpCur, 11);
assert.strictEqual(vitalsSnapshot.hpMax, 14);
assert.strictEqual(vitalsSnapshot.ac, 10);
assert.strictEqual(vitalsSnapshot.initiative, 2);
assert.strictEqual(vitalsSnapshot.speed, 7, 'localized speed must remain numeric in Firebase');
assert.strictEqual(vitalsSnapshot.battleEcho, 'Шрам после боя');
assert.strictEqual(vitalsSnapshot.family.length, 1, 'family tree must be part of the bounded room snapshot');
assert.match(html, /saveChars\(vitalsField \? \{reason:'vitals-update'\} : undefined\)/);
assert.match(html, /saveChars\(\{reason:'stats-update'\}\)/);
assert.match(html, /if \(vitalsField && window\.zgVttRefreshDrawer\) window\.zgVttRefreshDrawer\(\)/);
assert.match(html, /GM_SHEET_SEEN_KEY='zargota_gm_sheet_seen_v1'/);
assert.match(html, /function gmSheetIsUnread\(member\)/);
assert.match(html, /РОАДМАПА ИГРОКА/);
assert.match(html, /Только просмотр — план ещё не применён к листу/);
assert.match(network, /gmProposeSkillUpdate:\s*function/);
assert.match(network, /resolveSkillUpdateProposal:\s*function/);
assert.match(network, /acknowledgeSkillUpdateProposal:\s*function/);
assert.match(network, /gmProposeCharacterPatch:\s*function/);
assert.match(network, /resolveCharacterPatchProposal:\s*function/);
assert.match(network, /kind:'field-patch'/);
assert.match(network, /spellRefs:240/, 'spellRefs is an explicitly bounded field patch');
assert.match(network, /skillUpdateSignature\(currentSkill\)!==String\(live\.baseSignature/);
assert.match(html, /function zgApplyApprovedSkillUpdate\(localCharacter,member\)/);
assert.match(html, /zgSkillUpdateSignature\(current\)!==zgSkillUpdateSignature\(base\)/);
assert.match(html, /Сначала дождитесь статуса «Синхронизировано»/);
assert.match(html, /Предложить улучшение/);
assert.match(html, /ПРЕДЛОЖЕНИЕ МАСТЕРА/);
assert.match(network, /if\s*\(!canApplyIncomingCharacter\(session,\s*member\.character,\s*\{\s*allowQueued:true\s*\}\)\)\s*return/);
assert.match(network, /String\(member\.characterId\s*\|\|\s*''\)\s*!==\s*String\(character\.id\)/);
assert.match(network, /if\s*\(heroTaken\)\s*throw roomError/);
assert.match(network, /customHeroApproval\s*=\s*characterKey\s*\?\s*null/);
assert.match(network, /resolveCustomHeroProposal:\s*function/);
assert.match(network, /member\.customHeroApproval && member\.customHeroApproval\.status === 'pending'/);
assert.match(html, /zgCharCustomHeroResolve/);
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
assert.match(tabCoordinationBlock, /resumePrimaryTab\(readSession\(\)\)/);
assert.match(network, /if \(!tabCanWrite\(\)\) return Promise\.reject\(roomError\(/);
assert.match(network, /function queueGameplayOperation[\s\S]*?!tabCanWrite\(\)\) return \{ok:false,skipped:true\}/);
assert.match(network, /\(actionKind === 'ability' \|\| actionKind === 'ability-resource'\) && !tabCanWrite\(\)/);
assert.match(network, /if\(!tabCanWrite\(\)\)return Promise\.reject\(roomError\('Эта вкладка работает только для просмотра\. Передайте управление ей перед выдачей\.'/);
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
assert.deepStrictEqual(Array.from(skillContext.normalizeCharacterFieldPatch('spellRefs',['spell-a',2,'spell-a',''])),['spell-a','2'],'network patch normalizes unique stable spell ids');
assert.strictEqual(skillContext.normalizeCharacterFieldPatch('hpCur',9),undefined,'runtime HP is not an allowed proposal field');
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
var localSkillContext = {
  Math:Math, Number:Number, String:String, JSON:JSON, Array:Array, Object:Object,
  zgCloneSessionValue:function(value){return JSON.parse(JSON.stringify(value));}
};
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
var fieldHero = { currentGoal:'Старая цель' };
var fieldMember = { characterUpdateProposal:{
  id:'field-update-test',kind:'field-patch',status:'approved',field:'currentGoal',
  baseSignature:JSON.stringify('Старая цель'),baseValue:'Старая цель',patchValue:'Новая цель'
} };
var firstFieldApply = localSkillContext.zgApplyApprovedCharacterFieldUpdate(fieldHero,fieldMember);
assert.strictEqual(firstFieldApply.changed,true);
assert.strictEqual(fieldHero.currentGoal,'Новая цель');
assert.strictEqual(localSkillContext.zgApplyApprovedCharacterFieldUpdate(fieldHero,fieldMember).already,true);
var conflictingFieldHero = { currentGoal:'Свежая локальная цель' };
var conflictingFieldApply = localSkillContext.zgApplyApprovedCharacterFieldUpdate(conflictingFieldHero,fieldMember);
assert.strictEqual(conflictingFieldApply.conflict,true);
assert.strictEqual(conflictingFieldHero.currentGoal,'Свежая локальная цель','field patch conflict must preserve local text');
var spellFieldHero = { spellRefs:['spell-a','spell-home'],hpCur:7,inventoryItems:[{itemId:'potion',qty:2}] };
var spellFieldMember = { characterUpdateProposal:{
  id:'field-update-spells',kind:'field-patch',status:'approved',field:'spellRefs',
  baseSignature:JSON.stringify(['spell-a','spell-home']),baseValue:['spell-a','spell-home'],patchValue:['spell-home','spell-b']
} };
var spellFieldApply = localSkillContext.zgApplyApprovedCharacterFieldUpdate(spellFieldHero,spellFieldMember);
assert.strictEqual(spellFieldApply.changed,true);
assert.deepStrictEqual(Array.from(spellFieldHero.spellRefs),['spell-home','spell-b']);
assert.strictEqual(spellFieldHero.hpCur,7,'spell proposal must not touch HP');
assert.deepStrictEqual(spellFieldHero.inventoryItems,[{itemId:'potion',qty:2}],'spell proposal must not touch inventory');
var conflictingSpellHero = { spellRefs:['spell-a','spell-new-home'] };
assert.strictEqual(localSkillContext.zgApplyApprovedCharacterFieldUpdate(conflictingSpellHero,spellFieldMember).conflict,true,'fresh local spell changes produce a conflict');
assert.deepStrictEqual(conflictingSpellHero.spellRefs,['spell-a','spell-new-home'],'conflict preserves the fresh local spell list');

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
    connected:true,
    characterFlushes:0,
    gameplayFlushes:0,
    Math:Math,Date:Date,JSON:JSON,Uint32Array:Uint32Array,Array:Array,
    now:function(){return Date.now();},
    w:tabWindow,
    clearPresenceDisconnectHandles:function(){return Promise.resolve();},
    setPresence:function(){return Promise.resolve();},
    flushCharacterOutbox:function(){context.characterFlushes++;return Promise.resolve();},
    flushGameplayOutbox:function(){context.gameplayFlushes++;return Promise.resolve();},
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
assert.strictEqual(secondSessionTab.characterFlushes,1,'new owner must immediately resume the character outbox');
assert.strictEqual(secondSessionTab.gameplayFlushes,1,'new owner must immediately resume the gameplay outbox');
secondSessionTab.saveSession(null);
assert.strictEqual(firstSessionTab.tabCoordinationState().active,1,'release must remove the duplicate immediately');
assert.strictEqual(firstSessionTab.tabCoordinationState().isSecondary,false,'remaining tab must regain ownership after release');
assert.strictEqual(firstSessionTab.characterFlushes,1,'remaining tab must resume the character outbox after release');
assert.strictEqual(firstSessionTab.gameplayFlushes,1,'remaining tab must resume the gameplay outbox after release');
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
assert.match(network, /discardCharacterOutbox:\s*function\s*\(characterId\)/);
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
assert.match(network, /firebase\.runTransaction\(scopedCharacterRef/);
assert.match(network, /next\[field\]\s*=\s*liveSnapshot\[field\]/);
assert.match(network, /next\s*=\s*applyEquipmentDerivedSnapshot\(next,\s*liveSnapshot\)/);
assert.match(network, /next\.syncOperationId\s*=\s*liveSnapshot\.syncOperationId/);
assert.match(network, /gmAddInventoryItem:\s*function/);
assert.match(network, /gmAddJournalEntry:\s*function/);
assert.match(network, /gmUpdateJournalEntry:\s*function\s*\(memberUid, journalId, patch\)/, 'GM can edit a selected player journal entry');
assert.match(network, /gmDeleteJournalEntry:\s*function\s*\(memberUid, journalId\)/, 'GM can remove a selected player journal entry');
assert.match(network, /source:'gm-journal-update'/, 'GM journal edits use a distinct synchronized operation');
assert.match(network, /source:'gm-journal-delete'/, 'GM journal removals use a distinct synchronized operation');
assert.match(network, /gmAdjustAbilityUsage:\s*function/);
assert.match(network, /adjustOwnAbilityUsage:\s*function/);
assert.match(network, /current\.source='player-ability-resource'/);
assert.match(network, /actionKind==='ability-resource'/);
assert.match(network, /request\.resourceAdjustment=\{resourceKey:adjustmentKey/);
assert.match(network, /character\.source='ability-resource-approved'/);
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
assert.match(network, /visibility:kind==='status'\?statusVisibility:'public'/, 'manual status events preserve GM-only visibility');
assert.match(network, /else if\(event\.visibility!==\'gm\'\)/, 'GM-only status events are not copied into player message inboxes');
assert.match(network, /gmBroadcastVisual:\s*function/);
assert.match(network, /particle:\['embers','frost','healing','shadow','poison','blood','arcane','lightning'\]/);
assert.match(network, /animation:\['shake','pulse','levitate','blink','impact','dissolve'\]/);
assert.match(network, /scene:\['flash','darkness','tremor','focus','storm','holy'\]/);
assert.match(network, /firebase\.update\(roomRef\(session\.code\),\{visualEvent:event,updatedAt:stamp\}\)/);
var gmVisualNetworkStart = network.indexOf('gmBroadcastVisual: function');
var gmVisualNetworkEnd = network.indexOf('resolveCombatAttack: function', gmVisualNetworkStart);
var gmVisualNetworkBlock = network.slice(gmVisualNetworkStart, gmVisualNetworkEnd);
assert.doesNotMatch(gmVisualNetworkBlock, /messages/, 'visual events must not pollute the session chat');
assert.match(html, /zgGmInterventionApply\(\\'temp-hp\\'\)/);
assert.match(html, /zgGmInterventionOpenHero\(\\'inventory\\'\)/);
assert.match(html, /zgGmInterventionOpenHero\(\\'abilities\\'\)/);
assert.match(html, /zgGmInterventionOpenHero\(\\'journal\\'\)/);
assert.match(html, /zgVttOpenPanelForMember\(panel,token\.memberUid,\{toggle:panel==='inventory'\}\)/, 'repeating the GM hero bag action closes the already-open bag');
assert.match(html, /heroBagPanels=\['character','inventory','abilities','journal'\]/, 'all four internal hero-bag tabs belong to the same toolbar toggle');
assert.match(html, /heroBagAlreadyOpen=inventoryDrawer&&inventoryDrawer\.classList\.contains\('open'\)[^;]*inventoryDrawer\.classList\.contains\('backpack-skin'\)[^;]*heroBagPanels\.indexOf\(activePanel\)>=0[^;]*inventoryBody\.dataset\.activePanel===activePanel/, 'the bag control detects every rendered hero-bag tab without treating unrelated drawers as the bag');
assert.match(html, /turningOn=!heroBagAlreadyOpen/, 'one repeated bag click closes Status, Items, Magic, or Journal immediately');
assert.match(html, /w\.zgGmInterventionMinimize=function/);
assert.match(html, /class="zg-gm-intervention-orb"/);
assert.match(html, /\.zg-gm-intervention\.minimized\{/);
assert.match(html, /id="zg-gm-intervention-resize"/, 'the GM panel exposes a dedicated resize handle');
assert.match(html, /width:saved\.width,height:saved\.height/, 'the GM panel persists its user-selected dimensions');
assert.match(html, /gmPanelResize\.panel\.style\.width/, 'dragging the resize handle updates panel width');
assert.match(html, /gmPanelResize\.panel\.style\.height/, 'dragging the resize handle updates panel height');
assert.match(html, /z-index:75/);
assert.match(html, /function combatEntryForToken\(token\)[\s\S]*if\(!token\|\|!combat\|\|!combat\.active\)return null;/, 'opening the GM panel without a selected token must stay safe');
var tokenDragStart = html.indexOf('function beginTokenDrag');
var tokenDragEnd = html.indexOf('function renderTokens', tokenDragStart);
var tokenDragBlock = html.slice(tokenDragStart, tokenDragEnd);
assert.doesNotMatch(tokenDragBlock, /classList\.add\('open'\)/, 'selecting a token must not open the GM panel');
var tokenSelectStart = html.indexOf('function selectGmToken');
var tokenSelectEnd = html.indexOf('function deleteTokenContextTargets', tokenSelectStart);
var tokenSelectBlock = html.slice(tokenSelectStart, tokenSelectEnd);
assert.match(tokenSelectBlock, /classList\.contains\('open'\)\|\|intervention\.classList\.contains\('minimized'\)/, 'selecting a token only refreshes a GM panel that is already visible');
assert.match(network, /increment:\s*databaseModule\.increment/);
assert.match(html, /class="zg-gm-target-card"/);
assert.match(html, /zgGmInterventionAmount\(10\)/);
assert.match(html, /class="zg-gm-primary-actions"/);
assert.match(html, /class="zg-gm-status-section"/);
assert.match(html, /@media\(max-width:700px\)\{\.zg-gm-intervention/);
assert.match(html, /function animateGmAdjustmentVisual/);
assert.match(html, /state&&state\.room&&state\.room\.manualEvent/);
assert.match(html, /event\.statusEnabled\?'gm-status-add':'gm-status-remove'/);
assert.match(html, /event\.visibility===\'gm\'.*adjustmentSession\.role!==\'master\'/, 'player clients skip hidden status labels, FX and sounds');
assert.match(html, /className='zg-gm-particles '/);
assert.match(html, /@keyframes zgGmDamageAvatar/);
assert.match(html, /@keyframes zgGmHealAvatar/);
assert.match(html, /zgGmInterventionTab\(\\'entity\\'\)/);
assert.match(html, /zgGmInterventionTab\(\\'statuses\\'\)/);
assert.match(html, /zgGmInterventionTab\(\\'visual\\'\)/);
assert.match(html, /zgGmInterventionTab\(\\'delivery\\'\)/);
assert.match(html, /class="zg-gm-tool-panes"/, 'the GM panel keeps persistent tab panes instead of rebuilding the entire window');
assert.match(html, /renderGmIntervention\(true\)/, 'tab changes reuse an already-rendered pane');
assert.doesNotMatch(html, /\.zg-gm-tool-content\{animation:/, 'tab content must not replay a fade animation on every click');
assert.match(html, /w\.zgGmVisualTrigger=function/);
assert.match(html, /state&&state\.room&&state\.room\.visualEvent/);
assert.match(html, /function animateGmVisualEvent/);
assert.match(html, /className='zg-gm-vfx-particles vfx-'/);
assert.match(html, /className='zg-gm-scene-vfx vfx-'/);
assert.match(html, /@keyframes zgGmVfxParticle/);
assert.match(html, /@keyframes zgGmSceneVeil/);
assert.match(html, /html\.zg-reduced-effects \.zg-game-overlay \.zg-gm-scene-vfx/);
var combatVisualStart = html.indexOf('function animateCombatVisual()');
var combatVisualEnd = html.indexOf('function animateGmAdjustmentVisual()', combatVisualStart);
var combatVisualBlock = html.slice(combatVisualStart, combatVisualEnd);
assert.match(combatVisualBlock, /kind==='combat-damage'/);
assert.match(combatVisualBlock, /critical\?'КРИТ':'ПОПАДАНИЕ'/);
assert.doesNotMatch(combatVisualBlock, /'⚔ '\+Math\.max\(0,Number\(event\.damage\)/, 'attack approval must not display fake zero damage');
assert.match(html, /zgDicePlanB/);
assert.match(html, /type==='free'\?'zgDicePlanB\(event\)'/);
assert.doesNotMatch(html, /data-dice-free-mode/);
assert.match(html, /Броски кубиков · ЛКМ добавить · ПКМ убрать/);
assert.match(html, /classList\.contains\('open'\)&&p\.classList\.contains\('plan-b'\)[\s\S]*?zgDiceClose\(\);return false;/);
assert.match(html, /zgVttGmAbilityUsage/);
assert.match(html, /function abilityChargeControl\(card, mode\)/);
assert.match(html, /class="zg-ability-resource-console/);
assert.match(html, /requestAction\(requestText,'ability-resource'/);
assert.doesNotMatch(html.slice(html.indexOf("var spellState=card.group==='spells'"),html.indexOf("var proposalLabels=",html.indexOf("var spellState=card.group==='spells'"))), /card\.learnText/, 'the top spell state must not duplicate the ritual learning text');
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
assert.match(network, /if\s*\(connected\)\s*\{\s*setPresence\(readSession\(\)\);\s*flushCharacterOutbox\(\);\s*flushGameplayOutbox\(\);/);
assert.match(network, /if\s*\(connected\)\s*\{\s*flushCharacterOutbox\(\);\s*flushGameplayOutbox\(\);/);
assert.match(network, /if\s*\(remaining\s*&&\s*connected\s*&&\s*shouldContinue\)\s*return\s*flushCharacterOutbox\(\);/);
assert.match(network, /gameplayOutbox:\s*gameplayOutbox\(\)/);
assert.match(network, /flushGameplayOutbox:\s*function/);

var domainStart = network.indexOf('function combatNumber');
var domainEnd = network.indexOf('function statusTurnTick', domainStart);
var domainContext = { result:null };
vm.runInNewContext(
  network.slice(domainStart, domainEnd) +
    '; result={' +
      'damage:applyVitalsDomainOperation({hp:12,hpMax:20,tempHp:4},{damage:7}),' +
      'localizedDamage:applyVitalsDomainOperation({hp:"11 / 14",hpMax:"14 HP",tempHp:"2"},{damage:"5 урона"}),' +
      'localizedFormula:rollFormula("1д8 + 2",false),' +
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
assert.strictEqual(domainContext.result.localizedDamage.hp, 8, 'localized HP and damage must not collapse to zero');
assert.strictEqual(domainContext.result.localizedDamage.tempHp, 0);
assert.strictEqual(domainContext.result.localizedDamage.damage, 5);
assert.strictEqual(domainContext.result.localizedFormula.formula, '1d8+2');
assert.ok(domainContext.result.localizedFormula.total >= 3 && domainContext.result.localizedFormula.total <= 10);
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
var combatDamageBlock = network.slice(combatDamageStart, combatDamageEnd);
assert.match(combatDamageBlock, /session\.role!=='master'/);
assert.match(combatDamageBlock, /applyVitalsDomainOperation\(target,\{damage:damage\}\)/);
assert.match(combatDamageBlock, /character\/revision'\]\s*=\s*firebase\.increment\(1\)/);
assert.match(combatDamageBlock, /character\/source'\]\s*=\s*'combat-damage'/);
assert.match(combatDamageBlock, /character\/syncOperationId'\]\s*=\s*damageOperationId/);
assert.match(html, /finishApprovedAttackRoll\(uid,request\.id,true,event&&event\.id\|\|'','',isHit,!!\(event&&event\.critical\)\)/);
var advanceCombatStart = network.indexOf('advanceCombat: function');
var advanceCombatEnd = network.indexOf('useCombatAction: function', advanceCombatStart);
var advanceCombatBlock = network.slice(advanceCombatStart, advanceCombatEnd);
assert.match(advanceCombatBlock, /session\.role !== 'master' && \(!activeEntry \|\| String\(activeEntry\.uid \|\| ''\) !== String\(user\.uid\)\)/);
assert.match(advanceCombatBlock, /beginCombatTurnOperation\(combat,operationId,stamp,user\.uid\)/);
assert.match(advanceCombatBlock, /if\(turnOperation\.duplicate\)/);
assert.match(advanceCombatBlock, /combat\/appliedTurnOperationIds/);
assert.match(advanceCombatBlock, /combat\/lastTurnOperation/);
assert.match(html, /playerOwnTurn[\s\S]+Завершить ход/);
assert.match(html, /\.zg-combat-bar-actions\.player\{grid-template-columns:1fr\}/);
assert.match(html, /combatAdvanceRetryId/);
assert.match(html, /advanceCombat\(\{operationId:combatAdvanceRetryId\}\)/);
assert.match(network, /session\.role !== 'player' \|\| session\.uid !== auth\.currentUser\.uid \|\| session\.code !== room\.code/);
var syncCharacterStart = network.indexOf('syncCharacter: function');
var syncCharacterEnd = network.indexOf('persistCampaignCharacter: function', syncCharacterStart);
var syncCharacterBlock = network.slice(syncCharacterStart, syncCharacterEnd);
assert.match(syncCharacterBlock, /liveSnapshot = result\.snapshot && result\.snapshot\.val \? result\.snapshot\.val\(\) : liveSnapshot/);
assert.match(syncCharacterBlock, /setCharacterSync\('synced', liveSnapshot, 'local→room', syncReason\)/);
assert.match(syncCharacterBlock, /return refreshRoom\(session\.code\)\.then\(function \(\) \{ return api\.getSnapshot\(\); \}\)/);
var combatAbilityStart = network.indexOf('resolveCombatAbility: function');
var combatAbilityEnd = network.indexOf('prepareCombatReaction: function', combatAbilityStart);
assert.match(network.slice(combatAbilityStart, combatAbilityEnd), /applyVitalsDomainOperation\(target,\{damage:damage,heal:heal,preserveOverMax:true\}\)/);
assert.match(network.slice(combatAbilityStart, combatAbilityEnd), /applyStatusDomainOperation\(target,/);
assert.match(network.slice(combatAbilityStart, combatAbilityEnd), /applyAbilityUsageDomainOperation\(member\.character&&member\.character\.abilityUsage[^;]+preserveExistingMax:false/);
assert.match(network.slice(combatAbilityStart, combatAbilityEnd), /actor\.hp==null\?actor\.hpMax:actor\.hp\)<=0/);
var requestMovementStart = network.indexOf('requestMovement: function');
var requestMovementEnd = network.indexOf('requestMovementAs: function', requestMovementStart);
assert.match(network.slice(requestMovementStart, requestMovementEnd), /combat-zero-hp/);
var requestActionStart = network.indexOf('requestAction: function');
var requestActionEnd = network.indexOf('resolveAction: function', requestActionStart);
assert.match(network.slice(requestActionStart, requestActionEnd), /actionKind === 'ability'[\s\S]+combat-zero-hp/);
assert.match(network, /statusTurnTick[\s\S]+applyVitalsDomainOperation\(\{hp:hp,hpMax:hpMax,tempHp:tempHp\}/);
assert.match(network, /outbox-remove-error/);
assert.match(network, /outbox:\s*syncOutbox\(\)/);
assert.match(network, /restoreCharacterInboundFromRoom/);
assert.match(network, /enableCharacterInbound\(session,\s*\{\s*uid:session\.uid\s*\},\s*member\.character\)/);
var journeySyncStart = html.indexOf('  function localCharacter(snapshot)');
var journeySyncEnd = html.indexOf('  // «Да» — закрепляем локальный лист', journeySyncStart);
var journeySyncBlock = html.slice(journeySyncStart, journeySyncEnd);
var beginJourneyStart = html.indexOf('  function beginJourney(c, waitsForParty)');
var beginJourneyEnd = html.indexOf('  function localCharacter(snapshot)', beginJourneyStart);
var beginJourneyBlock = html.slice(beginJourneyStart, beginJourneyEnd);
assert.match(beginJourneyBlock, /journeyPresentationKey === presentationKey && jo && jo\.classList\.contains\('open'\)/, 'the same Firebase journey snapshot must not recreate an already visible hero portrait');
assert.match(beginJourneyBlock, /journeyCharacter = c;\s*return false;/, 'a duplicate journey render refreshes its character reference without restarting the animation');
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
assert.match(html, /journeyPresentationKey = '';/, 'closing the journey clears its presentation identity for a future entry');
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
assert.match(addEquipmentBlock, /charOpenEquipModal\(id\)/);
assert.strictEqual(addEquipmentBlock.indexOf('inventoryItems.push') >= 0, false, 'the character sheet must select equipment from the Products catalog');
assert.strictEqual(addEquipmentBlock.indexOf('equipItems.push') >= 0, false, 'the character sheet must not recreate a second equipment store');
var arenaEquipmentStart = html.indexOf('function syncArmoryToCharacter');
var arenaEquipmentEnd = html.indexOf('function openArmoryEditor', arenaEquipmentStart);
var arenaEquipmentBlock = html.slice(arenaEquipmentStart, arenaEquipmentEnd);
assert.match(arenaEquipmentBlock, /character\.inventoryItems\.push/);
assert.strictEqual(arenaEquipmentBlock.indexOf('character.equipItems') >= 0, false, 'Arena equipment bridge must not recreate equipItems');
var inventoryDropStart = html.indexOf('w.zgVttInventoryDrop=function');
var inventoryDropEnd = html.indexOf('w.zgVttInventoryOpenItem=function', inventoryDropStart);
var inventoryDropBlock = html.slice(inventoryDropStart, inventoryDropEnd);
assert.strictEqual(inventoryDropBlock.indexOf('equipItems.push') >= 0, false, 'equipping must not copy an inventory item');
assert.match(inventoryDropBlock, /equipmentRules\.planHandEquip\(c\.inventoryItems,index,slotName\)/);
assert.match(inventoryDropBlock, /commitInventoryMutation\(member,c,before,'inventory-equip'/);
assert.match(html, /w\.zgVttInventoryUnequip=function\(source,index\)/);
assert.match(html, /source==='inventory'\?c\.inventoryItems:c\.equipItems/);
assert.match(html, /function unequipControl\(entry\)/, 'every occupied equipment slot must expose a direct unequip control');
assert.match(html, /class="zg-inv2-unequip"[^>]*zgVttInventoryUnequip/, 'direct unequip control must use the synchronized inventory mutation');
assert.match(html, /aria-label="'\+esc\(label\)\+'"/, 'direct unequip control must remain accessible without relying on its minus icon');
assert.match(html, /\.zg-inv2-unequip\{/, 'direct unequip control must have a visible dedicated style');
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
assert.match(html, /w\.zgVttOpenPanelForMember=function\(panel,uid(?:,options)?\)/);
assert.match(html, /drawerMemberUid = ''/);
assert.doesNotMatch(html, /Снимок комнаты|zg-drawer-readonly/);
assert.match(html, /class="zg-inv2"/);
assert.match(html, /--zg-drawer-text:clamp\(/);
assert.match(html, /--zg-drawer-secondary:clamp\(/);
assert.match(html, /--zg-drawer-heading:clamp\(/);
assert.match(html, /\.zg-inv2-item:hover,[\s\S]*?transform:scale\(1\.012\)/);
assert.match(html, /prefers-reduced-motion:reduce\)\{[\s\S]*?\.zg-inv2-item\{transition:none\}/);
assert.match(html, /class="zg-inv2-hand-pair/);
assert.match(html, /handSlot\('mainHand','Основная','I'/);
assert.match(html, /handSlot\('offHand','Вторая','II'/);
assert.match(html, /class="zg-inv2-hand-heading"/);
assert.match(html, /class="zg-inv2-hand-content"/);
assert.match(html, /Обе руки/);
assert.match(html, /class="zg-inv2-filters" aria-label="Фильтры инвентаря"/);
assert.match(html, /title="'\+filter\.label\+'" aria-label="'\+filter\.label\+'" aria-pressed="'\+active\+'"/);
assert.match(html, /aria-label="Быстрый предмет: '\+esc\(quickLabel\)\+'"/);
assert.match(html, /var pageSize=12,pageCount=/);
assert.match(html, /grid-template-rows:repeat\(8,minmax\(0,1fr\)\)/);
assert.match(html, /grid-template-rows:repeat\(12,minmax\(0,1fr\)\)/);
assert.match(html, /w\.zgVttInventoryPage=function\(delta\)/);
assert.match(html, /\.zg-vtt-drawer\.backpack-skin\[data-backpack-skin="items"\] \.zg-vtt-drawer-body\{\s*overflow:hidden!important/);
var drawerRenderStart = html.indexOf('function renderDrawer(force)');
var drawerRenderEnd = html.indexOf('function render(snapshot)', drawerRenderStart);
var drawerRenderBlock = html.slice(drawerRenderStart, drawerRenderEnd);
assert.ok(
  drawerRenderBlock.lastIndexOf('bagCalApply()') > drawerRenderBlock.indexOf("nextBodyHtml = inventoryPanel()"),
  'saved backpack calibration must be applied after inventory markup is rendered'
);
assert.match(html, /function bagCalCanEdit\(\)\{\s*var session=state&&state\.session;\s*return !session\|\|session\.role==='master';\s*\}/);
assert.match(html, /function bagCalSyncAccess\(\)[\s\S]*?panel\.hidden=!allowed;[\s\S]*?button\.hidden=!allowed;[\s\S]*?drawer\.classList\.remove\('calibrating'\)/);
assert.match(html, /w\.zgBagCalToggle=function\(ev,force\)\{[\s\S]*?if\(!bagCalSyncAccess\(\)\)return false;/);
assert.ok(
  drawerRenderBlock.indexOf('bagCalSyncAccess()') < drawerRenderBlock.indexOf('if (!activePanel) return'),
  'player-only bag calibration controls must be hidden even while the drawer is closed'
);
assert.match(html, /\.zg-bag-calibrator\[hidden\],\.zg-bag-cal-floating\[hidden\]\{display:none!important\}/);
assert.match(html, /w\.zgVttSetInventoryNotice=function\(uid,kind,text\)/);
assert.match(html, /function commitInventoryMutation\(member,character,before,reason,successText\)/);
assert.match(html, /'loading','Сохраняем…'/);
assert.match(html, /flushCharacterOutbox/);
assert.match(html, /discardCharacterOutbox\(character&&character\.id\)/);
assert.match(html, /saveChars\(\{sync:syncAttempted,reason:'inventory-rollback'\}\)/);
assert.match(html, /'offline','Нет связи — изменение сохранено и ждёт отправки\.'/);
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
assert.match(html, /class="zg-bag-tabs" data-bag-cal-key="tabbar" role="tablist" aria-label="Разделы сумки героя"/);
assert.strictEqual((html.match(/role="tab" aria-controls="zg-vtt-drawer-body"/g)||[]).length, 4);
assert.match(drawerRenderBlock, /button\.setAttribute\('aria-selected',String\(isActive\)\)/);
assert.match(drawerRenderBlock, /button\.tabIndex=isActive\?0:-1/);
assert.match(html, /closest\('\.zg-bag-tabs button\[role="tab"\]'\)/);
assert.match(html, /event\.key==='ArrowRight'/);
assert.match(html, /event\.key==='ArrowLeft'/);
assert.match(html, /event\.key==='Home'/);
assert.match(html, /event\.key==='End'/);
assert.match(html, /Backpack accessibility: visible keyboard focus/);
assert.match(html, /@media \(forced-colors:active\)/);
assert.match(html, /\.zg-journal3-paper\{[\s\S]*?background:Canvas!important;[\s\S]*?color:CanvasText/);
assert.match(html, /\.zg-token-status-info article,[\s\S]*?max-height:calc\(100dvh - 32px\)/);
assert.match(html, /\.zg-vtt-drawer\.open~\.zg-player-dock\{z-index:40\}/, 'the bottom toolbar must stay clickable above the enlarged backpack');
assert.match(html, /\.zg-vtt-party\.drawer-priority\{z-index:41\}/, 'the party strip must stay clickable above an open enlarged backpack');
assert.match(html, /party=el\('zg-vtt-party'\);if\(party\)party\.classList\.add\('drawer-priority'\)/, 'opening the backpack raises every party portrait');
assert.match(html, /party=el\('zg-vtt-party'\);if\(party\)party\.classList\.remove\('drawer-priority'\)/, 'closing the backpack restores the normal party layer');
assert.match(html, /w\.zgSelectedHeroMemberUid=token\.type==='hero'/);
assert.match(html, /zgVttRetargetOpenDrawer\(heroUid\)/, 'map-token selection delegates an open bag retarget across the VTT module boundary');
assert.match(html, /if\(keepPanel\)\{[\s\S]*?zgVttRetargetOpenDrawer\(uid\)[\s\S]*?zgVttOpenPanelForMember\(keepPanel,uid,\{toggle:false\}\)/, 'top party portraits retarget an already-open hero bag before falling back to a full panel reopen');
assert.match(html, /w\.zgVttRetargetOpenDrawer=function\(uid\)/, 'the canonical bag owns the cross-module retarget implementation');
assert.match(html, /drawerMemberUid=uid;lastDrawerRenderSignature='';renderDrawer\(true\)/, 'selecting a map hero immediately reroutes an already-open canonical bag to that hero');
assert.match(html, /body\.dataset\.memberUid=renderError\?'':String\(viewedMember&&viewedMember\.uid\|\|''\)/, 'the rendered bag records its actual owner instead of relying on mutable selection state alone');
assert.match(html, /String\(drawerMemberUid\|\|''\)===uid&&renderedUid===uid/, 'retarget skips rendering only when both the requested and visibly rendered hero already match');
assert.doesNotMatch(tokenSelectBlock, /\bactivePanel\b|\bdrawerMemberUid\b|\brenderDrawer\b/, 'scene-token selection must not reach into private drawer state owned by the VTT module');
assert.match(html, /selectedInventoryUid=state&&state\.session&&state\.session\.role==='master'/);
assert.doesNotMatch(drawerOpenBlock, /zg-gm-intervention/, 'opening the backpack must not hide the floating GM panel');
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
var combatEconomyLayer = Number((html.match(/\.zg-combat-economy\{position:absolute;z-index:(\d+)/)||[])[1]);
var backpackDrawerLayer = Number((html.match(/\.zg-vtt-drawer\.backpack-skin\.open\{z-index:(\d+)/)||[])[1]);
assert.ok(combatEconomyLayer > backpackDrawerLayer, 'the bottom combat toolbar must stay clickable above an open backpack drawer');
assert.match(html, /drawer\.classList\.add\('closing'\)/);
assert.match(html, /drawer\.classList\.remove\('open','closing'\)/);
assert.match(html, /playerDockAction==='inventory'\|\|playerDockAction==='abilities'/);
assert.match(html, /function combatToolbarSheetToken\(controlled,session\)/);
assert.match(html, /var contextSheetButton=creatureSheet\?/);
assert.match(html, /<b>Лист существа<\/b><small>HP, состояние, статусы<\/small>/);
assert.match(html, /<b>Сумка героя<\/b><small>'\+\(session&&session\.role==='master'\?'выбранный герой':'ваши вещи'\)/);
assert.match(html, /'\+contextSheetButton\+\(controlled&&controlled\.concentration\?/,
  'combat exposes one context-sensitive creature sheet or hero bag control');
assert.doesNotMatch(html, /creatureSheetButton\+inventoryButton/,
  'the combat toolbar must not render creature and hero sheets in parallel');
assert.match(html, /w\.zgSelectedHeroMemberUid\|\|drawerMemberUid\|\|selectedMemberUid/,
  'opening the combat bag must preserve the hero selected from the party portrait');
assert.match(html, /lastDrawerRenderSignature = ''/);
assert.match(html, /function syncBackpackArt\(drawer,skin\)/);
assert.match(html, /width:min\(670px,calc\(\(100vh - 32px\)\*\.72\),calc\(100vw - 18px\)\)/);
assert.match(html, /background:none/);
assert.match(html, /\.zg-vtt-drawer\.backpack-skin\{[^}]*pointer-events:none\}/, 'the decorative backpack frame must not intercept toolbar clicks');
assert.match(html, /\.zg-vtt-drawer\.backpack-skin \.zg-bag-interface\{pointer-events:auto\}/, 'backpack content must remain interactive without restoring the removed corner close button');
assert.match(html, /class="zg-state-board"/);
assert.match(html, /class="zg-state-hp"/);
assert.match(html, /class="zg-vital-emblem hp"/);
assert.match(html, /class="zg-temp-hp"/);
assert.match(html, /class="zg-state-vitals"/);
assert.match(html, /class="zg-state-vitals-top"/);
assert.match(html, /class="zg-state-armor"/);
assert.match(html, /class="zg-vital-emblem armor"/);
assert.match(html, /class="zg-state-hp-bar"/);
assert.match(html, /class="zg-state-combat-values"><div><small>Скорость<\/small>[\s\S]*?<div><small>Инициатива<\/small>/);
assert.doesNotMatch(html, /class="zg-state-combat-values"><div><small>Броня<\/small>/);
assert.match(html, /--zg-vitals-divider:64%/);
assert.match(html, /grid-template-rows:var\(--zg-vitals-top-row\) var\(--zg-vitals-bottom-row\)/);
assert.match(html, /\.zg-state-vitals-top,\s*\.zg-vtt-drawer[\s\S]*?\.zg-state-combat-values\{[\s\S]*?grid-template-columns:var\(--zg-vitals-divider\) minmax\(0,1fr\)/);
assert.match(html, /\.zg-state-vitals::after\{[\s\S]*?left:var\(--zg-vitals-divider\);[\s\S]*?top:var\(--zg-vitals-top-row\)/);
assert.match(html, /\.zg-state-combat-values\{[\s\S]*?border-top:1px solid #684526/);
assert.match(html, /\.zg-state-combat-values>div\+div\{[\s\S]*?border-left:1px solid #5d3d22/);
assert.match(html, /\.zg-state-hp-bar\{[\s\S]*?position:absolute;[\s\S]*?left:11px;[\s\S]*?right:11px;[\s\S]*?bottom:7px/);
assert.match(html, /var speedValue=c\.speed===undefined\|\|c\.speed===null\|\|c\.speed===''\?'—':c\.speed/);
assert.match(html, /if\(typeof w\.zgCollectDisplayStatuses==='function'\)/);
assert.match(html, /activeStatuses=w\.zgCollectDisplayStatuses\(/);
assert.doesNotMatch(html, /activeStatuses=collectDisplayStatuses\(/);
assert.match(html, /statuses:c\.statuses,[\s\S]*statusEffects:c\.statusEffects,[\s\S]*tempEffects:c\.tempEffects/);
assert.match(html, /class="zg-state-stat-list"/);
assert.match(html, /class="zg-bag-state-disclosure roadmap"/);
assert.match(html, /Мировой уровень славы/);
assert.match(html, /Уровень славы в Зарготе/);
assert.match(html, /class="zg-state-injuries"/);
assert.doesNotMatch(html, /РЕЖИМ БРОСКИ ЖИЗНИ/);
assert.match(html, /\.zg-vtt-drawer\.backpack-skin \.zg-bag-section-title\{display:none!important\}/);
assert.match(html, /grid-template-columns:repeat\(4,minmax\(0,82px\)\)/);
assert.match(html, /\.zg-state-portrait img\{filter:none\}/);
assert.match(html, /var equipmentSummary=c\._equipBonusCache&&typeof c\._equipBonusCache==='object'/);
assert.match(html, /function equipmentSourceTitle\(label,kind,statKey\)/);
assert.match(html, /class="zg-equip-bonus"/);
assert.match(html, /class="zg-equip-bonus"[^>]*onclick="event\.stopPropagation\(\);zgVttBonusInfo\(\\'equipment\\'/);
assert.match(html, /class="zg-equip-bonus"[^>]*><i aria-hidden="true">◆<\/i><em>/);
assert.match(html, /class="zg-temp-hp"[^>]*zgVttBonusInfo\(\\'temp-hp\\'/);
assert.match(html, /class="zg-temp-stat /);
assert.match(html, /zgVttBonusInfo\(\\'temporary-stat\\'/);
assert.match(html, /w\.zgVttBonusInfo=function\(mode,kind,statKey\)/);
assert.match(html, /Что даёт прибавку/);
assert.match(html, /Источники? экипировочного бонуса|Источник экипировочного бонуса/);
assert.match(html, /\.zg-vtt-drawer\.backpack-skin\[data-backpack-skin="hero"\] \.zg-vtt-drawer-body\{\s*overflow:hidden!important;/);
var vttShellStart = html.indexOf('//   КАРКАС VTT');
var vttShellEnd = html.indexOf('//   КУБИК СНИЗУ', vttShellStart);
var vttShellSource = html.slice(vttShellStart, vttShellEnd);
assert.match(vttShellSource, /function currentVttSceneView\(\)/);
var currentVttSceneStart = vttShellSource.indexOf('function currentVttScene(){');
var currentVttSceneEnd = vttShellSource.indexOf('var JOURNAL_ICON_VARIANTS', currentVttSceneStart);
assert.doesNotMatch(vttShellSource.slice(currentVttSceneStart,currentVttSceneEnd), /\bdraft\./, 'VTT scene reader must use the public scene snapshot instead of the editor-private draft');

var drawerMemberStart = html.indexOf('function drawerMember(){');
var drawerMemberEnd = html.indexOf('function drawerReadOnly(member){', drawerMemberStart);
var drawerMemberSource = html.slice(drawerMemberStart, drawerMemberEnd);
var roomHeroes = [
  {uid:'hero-a',characterId:'a',character:{name:'Первый герой'}},
  {uid:'hero-b',characterId:'b',character:{name:'Выбранный герой'}}
];
function resolveMasterDrawerMember(selectedUid) {
  var context = {
    result:null,
    state:{session:{role:'master',uid:'gm'}},
    drawerMemberUid:'',
    selectedMemberUid:'',
    w:{zgSelectedHeroMemberUid:selectedUid||''},
    draft:{view:{}},
    roomMembers:function(){ return [{uid:'gm',role:'master'}].concat(roomHeroes); },
    heroMembers:function(){ return roomHeroes; },
    ownMember:function(){ return {uid:'gm',role:'master'}; },
    String:String
  };
  vm.runInNewContext(drawerMemberSource + '; result=drawerMember();', context);
  return context.result;
}
assert.strictEqual(resolveMasterDrawerMember('').uid, 'hero-a', 'GM test bag should fall back to the first room hero');
assert.strictEqual(resolveMasterDrawerMember('hero-b').uid, 'hero-b', 'GM bag should prefer the selected room hero');

var characterStatsStart = html.indexOf('function characterStats(member){');
var characterStatsEnd = html.indexOf('function inventoryItemCategory(item){', characterStatsStart);
var characterStatsSource = html.slice(characterStatsStart, characterStatsEnd);
function renderCharacterStats(member, localCharacter, displayStatuses) {
  var context = {
    result:null,
    input:member,
    state:{session:{role:'player'}},
    draft:{view:{}},
    w:{
      STAT_LABEL_RU:{str:'Сила'},
      zgStatIcon:function(){ return '<i class="stat-icon"></i>'; },
      zgCollectDisplayStatuses:function(){ return displayStatuses || []; },
      zgInjuryIconMarkup:function(injury){ return '<img class="zg-injury-icon" src="'+injury.iconPath+'" alt="">'; }
    },
    fullLocalCharacter:function(){ return localCharacter || null; },
    drawerPublicViewer:function(){ return false; },
    currentVttSceneView:function(){ return {}; },
    combatBloodVariant:function(){ return 'blood-variant-a'; },
    collectDisplayStatuses:function(){ return []; },
    statusDurationText:function(){ return ''; },
    esc:function(value){
      return String(value == null ? '' : value)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },
    Array:Array, Object:Object, Number:Number, String:String, Math:Math, Date:Date
  };
  vm.runInNewContext(characterStatsSource + '; result=characterStats(input);', context);
  return context.result;
}
var equipmentSources = [{
  name:'Бригантина',
  bonuses:{ac:2,hp:4,speed:1,initiative:1,stats:{str:1}}
}];
var localEquipmentCharacter = {
  name:'Локальный герой',stats:{str:{base:2,cur:3,tmp:0}},
  hpCur:11,hpMax:18,ac:12,speed:8,initiative:2,
  _equipBonusCache:{
    acBonus:2,hpBonus:4,speedBonus:1,initiativeBonus:1,
    statBonuses:{str:1},sources:equipmentSources
  }
};
var localEquipmentHtml = renderCharacterStats({uid:'local',name:'Локальный герой'}, localEquipmentCharacter);
assert.match(localEquipmentHtml, /aria-label="Сила: \+1 от снаряжения · Бригантина \+1"/);
assert.match(localEquipmentHtml, /aria-label="Максимум HP: \+4 от снаряжения · Бригантина \+4"/);
assert.match(localEquipmentHtml, /aria-label="Броня: \+2 от снаряжения · Бригантина \+2"/);
assert.match(localEquipmentHtml, /aria-label="Скорость: \+1 от снаряжения · Бригантина \+1"/);
assert.match(localEquipmentHtml, /aria-label="Инициатива: \+1 от снаряжения · Бригантина \+1"/);
assert.match(localEquipmentHtml, /class="zg-equip-bonus"[^>]*><i aria-hidden="true">◆<\/i><em>\+2<\/em>/);
var remoteEquipmentCharacter = Object.assign({}, localEquipmentCharacter, {
  name:'Firebase герой',
  _equipBonusCache:null,
  equipmentBonuses:localEquipmentCharacter._equipBonusCache
});
var remoteEquipmentHtml = renderCharacterStats({uid:'remote',name:'Firebase герой',character:remoteEquipmentCharacter}, null);
assert.match(remoteEquipmentHtml, /aria-label="Броня: \+2 от снаряжения · Бригантина \+2"/);
assert.strictEqual((localEquipmentHtml.match(/class="zg-equip-bonus"/g)||[]).length, 5);
assert.strictEqual((remoteEquipmentHtml.match(/class="zg-equip-bonus"/g)||[]).length, 5);
var temporaryBonusHtml = renderCharacterStats(
  {uid:'temporary-bonus',name:'Герой с эффектом'},
  {name:'Герой с эффектом',stats:{str:{base:2,cur:2,tmp:9}},tempEffects:[{type:'str',label:'Благословение великана',value:2,remaining:3,unit:'rounds'}],tempHp:4,hpCur:8,hpMax:10,ac:10}
);
assert.match(temporaryBonusHtml, /class="zg-temp-stat positive"[^>]*aria-label="Показать временную поправку к Сила: \+2"/);
assert.match(temporaryBonusHtml, /<small>Врем\.<\/small><b>\+2<\/b>/);
assert.doesNotMatch(temporaryBonusHtml, /Показать временную поправку к Сила: \+9/, 'active effects must replace a stale legacy tmp value instead of being counted twice');
assert.match(temporaryBonusHtml, /class="zg-temp-hp"[^>]*aria-label="Показать временные HP: 4"/);
var missingSpeedHtml = renderCharacterStats({uid:'missing-speed',name:'Без скорости'}, {name:'Без скорости',stats:{},hpCur:1,hpMax:1,ac:10});
var zeroSpeedHtml = renderCharacterStats({uid:'zero-speed',name:'Неподвижный'}, {name:'Неподвижный',stats:{},hpCur:1,hpMax:1,ac:10,speed:0});
assert.match(missingSpeedHtml, /<small>Скорость<\/small><i class="zg-vital-emblem speed"><img src="images\/ui\/stats\/speed\.png" alt=""><\/i><b>—<\/b>/);
assert.match(zeroSpeedHtml, /<small>Скорость<\/small><i class="zg-vital-emblem speed"><img src="images\/ui\/stats\/speed\.png" alt=""><\/i><b>0<\/b>/);
var tolerantStatusHtml = renderCharacterStats(
  {uid:'status-test',name:'Статусный герой'},
  {name:'Статусный герой',stats:{str:2},hpCur:4,hpMax:8,ac:10,statuses:['Горит']},
  [null,'Горит',{key:'freeze',label:'Заморожен',icon:'❄'}]
);
assert.match(tolerantStatusHtml, /Открыть состояние: Горит/);
assert.match(tolerantStatusHtml, /Открыть состояние: Заморожен/);
var injuryHtml = renderCharacterStats(
  {uid:'injury-test',name:'Раненый герой'},
  {name:'Раненый герой',stats:{str:2},hpCur:7,hpMax:10,ac:10,injuries:[{name:'Сломанная рука',roll:1,iconPath:'images/vtt-injuries/broken-arm.png'}]}
);
assert.match(injuryHtml, /images\/vtt-injuries\/broken-arm\.png/, 'a hero with an injury must keep the first sheet page renderable');

var abilitiesStart = html.indexOf('function buildAbilityCards(');
var abilitiesEnd = html.indexOf('function dicePanel()', abilitiesStart);
var abilitiesBlock = html.slice(abilitiesStart, abilitiesEnd);
assert.match(abilitiesBlock, /localCharacter=fullLocalCharacter\(member\)/);
assert.match(abilitiesBlock, /Math\.max\(spellLimit\(spell\),Number\(profile\.resourceMax\)\|\|0,Number\(sessionUsage&&sessionUsage\.max\)\|\|0\)/, 'canonical spell automation may define the combat charge limit');
assert.match(abilitiesBlock, /cooldown\?1:0/, 'a spell with a cooldown label but no numeric count still gets one charge cell');
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
assert.match(abilitiesBlock, /skills\.forEach\(function\(raw,index\).*innate:true/);
assert.match(abilitiesBlock, /var catalogCards=spellCards\.filter/);
assert.match(abilitiesBlock, /<header><h3>Врождённые навыки<\/h3>/);
assert.match(abilitiesBlock, /<h3>Полученные заклинания<\/h3>/);
assert.match(abilitiesBlock, /aria-label="Поиск полученных заклинаний"/);
assert.match(abilitiesBlock, /aria-label="Фильтры полученных заклинаний"/);
assert.match(abilitiesBlock, /title="Боевые кодексы" aria-label="Боевые кодексы"/);
assert.match(abilitiesBlock, /title="Фолианты" aria-label="Фолианты"/);
assert.match(abilitiesBlock, /title="Обрядники" aria-label="Обрядники"/);
assert.doesNotMatch(abilitiesBlock, /<small>ПОЗИЦИИ И НАВЫКИ<\/small>|<small>ЛИМИТЫ ИЗ МАНУАЛА<\/small>/);
assert.match(abilitiesBlock, /function compactInnateName\(card\)/);
assert.match(abilitiesBlock, /function compactInnateType\(card\)/);
var innateCardStart = abilitiesBlock.indexOf('function innateCardHtml(card)');
var innateCardEnd = abilitiesBlock.indexOf('function pageButton', innateCardStart);
var innateCardBlock = abilitiesBlock.slice(innateCardStart, innateCardEnd);
assert.match(innateCardBlock, /compactInnateName\(card\)/);
assert.match(innateCardBlock, /compactInnateType\(card\)/);
assert.doesNotMatch(innateCardBlock, /card\.description|resourceHtml\(card\)|<p>/);
assert.match(abilitiesBlock, /function spellTypeCapacity\(type\)/);
assert.match(abilitiesBlock, /getPreparedSpellTypeLimitForCharacter\(c,type\)/);
assert.match(abilitiesBlock, /if\(card\.prepared\)grouped\[card\.spellType\]\.push\(card\)/);
assert.match(abilitiesBlock, /Полученные заклинания/);
assert.match(abilitiesBlock, /Подготовленные заклинания/);
assert.match(abilitiesBlock, /label:'Боевые кодексы'/);
assert.match(abilitiesBlock, /label:'Фолианты'/);
assert.match(abilitiesBlock, /label:'Обрядники'/);
assert.match(abilitiesBlock, /Math\.ceil\(maxSlotCount\/3\)/);
assert.match(html, /grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(html, /grid-template-rows:repeat\(8,minmax\(0,1fr\)\)/);
assert.match(html, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(html, /data-backpack-skin="magic"\] \.zg-vtt-drawer-body\{\s*overflow:hidden!important/);
assert.match(html, /data-backpack-skin="magic"\] \.zg-bag-interface \.zg-vtt-drawer-body\[data-bag-cal-key="content"\]\{\s*top:9\.4%!important;\s*height:90\.6%!important/);
assert.match(html, /\.zg-magic3-slot-group>header\{[\s\S]*?min-height:0!important;[\s\S]*?background:transparent!important;/);
assert.match(html, /Статус изучения не передан/);
assert.match(html, /aria-label="Доступно /);
assert.match(html, /КУЛДАУН · ЗАРЯДЫ/);
assert.match(html, /function abilityDetailSections\(card\)/);
assert.match(html, /class="zg-ability-detail-section"/);
assert.match(html, /w\.zgVttOwnAbilityUsage=function/);
assert.match(html, /w\.zgVttRequestLearning=function/);
assert.match(html, /function zgMergeSessionSpellsLearned/);

var snapshotStart = network.indexOf('function characterSnapshot');
var snapshotEnd = network.indexOf('function campaignKeyFor', snapshotStart);
var snapshotSource = network.slice(snapshotStart, snapshotEnd);
var snapshotContext = {
  mergeAppliedDeliveryIds:characterSnapshotContext.mergeAppliedDeliveryIds,
  input: {
    id: 7,
    name: 'Герой',
    hpMax: 12,
    inventoryItems: [
      { itemId:'zg-item-7-i-stable', name:'Ключ', qty:2, image:'data:image/png;base64,item' },
      { itemId:'backpack-sword', name:'Меч в рюкзаке', category:'weapon', damageFormula:'9d9' },
      { itemId:'equipped-sword', name:'Надетый меч', category:'weapon', damageFormula:'1d8', equipped:true, slot:'weapon' },
      { itemId:'offhand-dagger', name:'Кинжал', category:'weapon', damageFormula:'1d4', equipped:true, slot:'offHand', handsRequired:1 }
    ],
    equipItems: [
      { itemId:'equipped-sword', name:'Старая копия меча', category:'weapon', damageFormula:'1d8', equipped:true, slot:'weapon' }
    ],
    skills: [{ name:'Приём', description:'Описание', image:'data:image/png;base64,heavy' }],
    traits: ['Черта'],
    spellRefs: [101, '202', 'bad/key', { bad:true }],
    spellsLearned: { 101:true, 202:false, 'bad/key':true },
    preparedSpells: { kodex:[101, '202', 'missing'], folio:['bad/key'], obrad:[] },
    spellCD: { 101:{ used:2, max:3 } },
    biography: 'История',
    quote: 'Цитата',
    notes: [{ text:'Сохранить текст', attachment:'data:image/png;base64,nested' }],
    journalEntries: [
      { journalId:'journal-safe_1', questId:'ruins-main', title:'Запись', text:'Текст', icon:'⚔', image:'images/journal/ruins.webp', kind:'quest', status:'active', importance:'secondary', questUpdatedAt:175, createdAt:100, updatedAt:200, updatedBy:'player-1', deletedAt:250 },
      { journalId:'bad/key', title:'Плохой id', text:'Не попадёт', image:'data:image/webp;base64,AAAA', kind:'image', createdAt:300 },
      { journalId:'journal-data', title:'data:text/plain,hidden', text:'blob:hidden', image:'javascript:alert(1)', createdAt:-1, updatedAt:'oops', updatedBy:'data:text/plain,uid' }
    ],
    portrait: 'data:image/png;base64,portrait',
    _gmDeliveryIds:['gm-delivery-safe','bad/id','gm-delivery-safe']
  },
  result: null,
  equipmentRules:equipmentRules
};
vm.runInNewContext(
  'var w={ZargotaEquipmentRules:equipmentRules}; function campaignKeyFor(){return "hero-key";}' +
    snapshotSource +
    '; result=characterSnapshot(input);',
  snapshotContext
);
assert.deepStrictEqual(Array.from(snapshotContext.result.spellRefs), [101, '202', 'bad/key']);
assert.strictEqual(snapshotContext.result.spellsLearned['101'], true);
assert.strictEqual(snapshotContext.result.spellsLearned['202'], false);
assert.deepStrictEqual(Object.keys(snapshotContext.result.spellsLearned).sort(), ['101', '202']);
assert.deepStrictEqual(Array.from(snapshotContext.result.preparedSpells.kodex), ['101']);
assert.deepStrictEqual(Array.from(snapshotContext.result.preparedSpells.folio), []);
assert.strictEqual(snapshotContext.result.abilityUsage['spell-101'].used, 2);
assert.strictEqual(snapshotContext.result.abilityUsage['spell-101'].max, 3);
assert.strictEqual(snapshotContext.result.abilityUsage['spell-objectObject'], undefined);
assert.strictEqual(snapshotContext.result.skills[0].name, 'Приём');
assert.strictEqual(snapshotContext.result.skills[0].description, 'Описание');
assert.strictEqual(snapshotContext.result.skills[0].image, undefined);
assert.strictEqual(snapshotContext.result.inventoryItems[0].itemId, 'zg-item-7-i-stable');
assert.strictEqual(snapshotContext.result.inventoryItems[0].qty, 2);
assert.strictEqual(snapshotContext.result.inventoryItems[0].image, 'data:image/png;base64,item');
assert.strictEqual(snapshotContext.result.weaponProfiles.some(function(profile) { return profile.id === 'backpack-sword'; }), false);
assert.strictEqual(snapshotContext.result.weaponProfiles.some(function(profile) { return profile.id === 'equipped-sword'; }), true);
assert.strictEqual(snapshotContext.result.weaponProfiles.length, 2, 'main/offhand weapon profiles must stay unique');
assert.strictEqual(snapshotContext.result.weaponProfiles.filter(function(profile) { return profile.id === 'equipped-sword'; })[0].slot, 'mainHand');
assert.strictEqual(snapshotContext.result.weaponProfiles.filter(function(profile) { return profile.id === 'offhand-dagger'; })[0].slot, 'offHand');
assert.strictEqual(snapshotContext.result.weaponProfiles.filter(function(profile) { return profile.id === 'offhand-dagger'; })[0].handsRequired, 1);
assert.strictEqual(snapshotContext.result.biography, 'История');
assert.strictEqual(snapshotContext.result.quote, 'Цитата');
assert.strictEqual(snapshotContext.result.notes[0].text, 'Сохранить текст');
assert.strictEqual(snapshotContext.result.notes[0].attachment, '');
assert.strictEqual(snapshotContext.result.portrait, 'data:image/png;base64,portrait');
snapshotContext.input.portrait = 'images/portraits/local-only.png';
snapshotContext.input.portraitThumb = 'data:image/webp;base64,portableportrait';
vm.runInNewContext('result=characterSnapshot(input);', snapshotContext);
assert.strictEqual(snapshotContext.result.portrait, 'data:image/webp;base64,portableportrait', 'room snapshot must prefer the portable portrait over a browser-local path');
delete snapshotContext.input.portraitThumb;
snapshotContext.input.portrait = 'blob:https://zargota.example/local-only';
vm.runInNewContext('result=characterSnapshot(input);', snapshotContext);
assert.strictEqual(snapshotContext.result.portrait, '');
snapshotContext.input.portrait = 'images/portraits/hero.webp';
vm.runInNewContext('result=characterSnapshot(input);', snapshotContext);
assert.strictEqual(snapshotContext.result.portrait, 'images/portraits/hero.webp');
assert.strictEqual(snapshotContext.result.journalEntries.length, 3);
assert.strictEqual(snapshotContext.result.journalEntries[0].journalId, 'journal-safe_1');
assert.strictEqual(snapshotContext.result.journalEntries[0].text, 'Текст');
assert.strictEqual(snapshotContext.result.journalEntries[0].icon, '⚔');
assert.strictEqual(snapshotContext.result.journalEntries[0].image, 'images/journal/ruins.webp');
assert.strictEqual(snapshotContext.result.journalEntries[0].kind, 'quest');
assert.strictEqual(snapshotContext.result.journalEntries[0].questId, 'ruins-main');
assert.strictEqual(snapshotContext.result.journalEntries[0].status, 'active');
assert.strictEqual(snapshotContext.result.journalEntries[0].importance, 'secondary');
assert.strictEqual(snapshotContext.result.journalEntries[0].questUpdatedAt, 175);
assert.strictEqual(snapshotContext.result.journalEntries[0].deletedAt, 250);
assert.strictEqual(snapshotContext.result.journalEntries[1].journalId, 'badkey');
assert.strictEqual(snapshotContext.result.journalEntries[1].image, 'data:image/webp;base64,AAAA', 'portable GM covers remain visible on another session client');
assert.strictEqual(snapshotContext.result.journalEntries[2].title, '');
assert.strictEqual(snapshotContext.result.journalEntries[2].text, '');
assert.strictEqual(snapshotContext.result.journalEntries[2].image, '', 'dangerous journal image schemes must not enter the room snapshot');
assert.strictEqual(snapshotContext.result.journalEntries[2].createdAt, 0);
assert.strictEqual(snapshotContext.result.journalEntries[2].updatedBy, '');
assert.deepStrictEqual(Array.from(snapshotContext.result.appliedDeliveryIds), ['gm-delivery-safe','badid']);
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
var journalIconHelpersStart = html.indexOf('var JOURNAL_ICON_VARIANTS');
var journalIconHelpersEnd = html.indexOf('var abilitiesFilter', journalIconHelpersStart);
var journalIconHelpersBlock = html.slice(journalIconHelpersStart, journalIconHelpersEnd);
assert.match(journalIconHelpersBlock, /note:\[/);
assert.match(journalIconHelpersBlock, /quest:\[/);
assert.match(journalIconHelpersBlock, /place:\[/);
assert.match(journalPanelBlock, /c\.journalEntries/);
assert.match(journalPanelBlock, /fullLocalCharacter\(member\)/);
assert.match(journalPanelBlock, /zgVttJournalOpen/);
assert.match(journalPanelBlock, /<h3>Главные цели<\/h3>/);
assert.match(journalPanelBlock, /class="zg-journal3-manual"/);
assert.match(journalPanelBlock, /aria-label="Предыдущая страница журнала"/);
assert.match(journalPanelBlock, /aria-label="Следующая страница журнала"/);
assert.match(journalPanelBlock, /zgVttJournalOpenManual\(event\)/);
assert.match(journalPanelBlock, /<h3>Мои записи<\/h3>/);
assert.match(journalPanelBlock, /zg-journal3-preview/);
assert.match(journalPanelBlock, /zgVttJournalFilter/);
assert.match(journalPanelBlock, /zgVttJournalSelect/);
assert.doesNotMatch(journalPanelBlock, /<button[^>]*>\s*(?:Текст|Перо|Стереть|Закладка)/);
assert.match(html, /journal:'images\/vtt-ui\/backpack-v2\/open-journal\.webp'/);
assert.match(html, /data-backpack-skin="journal"\] \.zg-bag-interface \.zg-vtt-drawer-body\[data-bag-cal-key="content"\]\{\s*top:9\.4%!important;\s*height:90\.6%!important/);
var journalPanelContext = {
  result: '',
  journalFilter: 'all',
  journalPage: 0,
  journalSelectedId: '',
  state: { session:{ uid:'player-1', role:'player' } },
  drawerMember:function(){ return {uid:'player-1',character:{
    currentGoal:'Найти руины',
    goals:[{title:'Вернуть печать',status:'Новая'}],
    journalEntries:[
      {journalId:'quest-main',questId:'ruins-main',title:'Открыть древние руины',text:'Найти вход',icon:'⚔',kind:'quest',status:'active',importance:'main',createdAt:4},
      {journalId:'quest-side',questId:'herbs-side',title:'Собрать травы',text:'Для лекаря',kind:'quest',status:'new',importance:'secondary',createdAt:3},
      {journalId:'place-1',title:'Древние руины',text:'Следы старой цивилизации',icon:'♜',kind:'place',createdAt:2},
      {journalId:'note-1',title:'Символы',text:'Знак глаза',icon:'✒',kind:'note',createdAt:1},
      {journalId:'gm-note',title:'Послание мастера',text:'Нельзя удалить',kind:'note',updatedBy:'gm',createdAt:0}
    ]
  }}; },
  fullLocalCharacter:function(member){ return member.character; },
  esc:function(value){ return String(value == null ? '' : value); }
};
vm.runInNewContext(journalIconHelpersBlock + journalPanelBlock + '; result=journalPanel();', journalPanelContext);
assert.match(journalPanelContext.result, /Главные цели/);
assert.match(journalPanelContext.result, /Открыть Мануал/);
assert.match(journalPanelContext.result, /Древние руины/);
assert.match(journalPanelContext.result, /Открыть древние руины/);
assert.match(journalPanelContext.result, /Главная цель · Активное/);
assert.match(journalPanelContext.result, /Дополнительная цель · Новое/);
assert.match(journalPanelContext.result, /Место/);
assert.match(journalPanelContext.result, /zg-journal3-paper/);
assert.match(journalPanelContext.result, /zg-journal3-paper-delete/);
assert.match(journalPanelContext.result, /⚔/);
assert.strictEqual(journalPanelContext.journalSelectedId, 'quest-main');
journalPanelContext.journalFilter = 'quest';
journalPanelContext.journalSelectedId = '';
vm.runInNewContext('result=journalPanel();', journalPanelContext);
assert.match(journalPanelContext.result, /data-journal-id="quest-main"/);
assert.match(journalPanelContext.result, /data-journal-id="quest-side"/);
assert.doesNotMatch(journalPanelContext.result, /data-journal-id="place-1"/);
assert.doesNotMatch(journalPanelContext.result, /data-journal-id="note-1"/);
assert.match(html, /w\.zgVttJournalConfirmRemove=function\(journalId,event,memberUid\)/);
assert.match(html, /role="alertdialog"/);
assert.match(html, /class="danger"[^>]*data-journal-id/);
assert.doesNotMatch(html.slice(html.indexOf('w.zgVttJournalRemove=function(journalId,memberUid)'), html.indexOf('w.zgVttJournalSelect=', html.indexOf('w.zgVttJournalRemove=function(journalId,memberUid)'))), /w\.confirm/);
assert.match(html, /background-color:#d8bd84/);
assert.match(html, /\.zg-bag-notes\.zg-journal3 \.zg-journal3-paper\{[\s\S]*?opacity:1!important/);
assert.match(html, /\.zg-journal3-paper-text\{[\s\S]*?opacity:1!important/);
assert.match(html, /version:11/);
assert.match(html, /rawVersion<11&&\(key==='journal\.paper'\|\|key==='journal\.entry-text'\)/);
assert.match(html, /saveChars\(\{reason:reason\|\|'journal-update'\}\)/);
assert.match(html, /journalSave\('journal-remove',true\)/);
var journalDeleteStart = html.indexOf('w.zgVttJournalConfirmRemove=function(journalId,event,memberUid)');
var journalDeleteEnd = html.indexOf('w.zgVttJournalSelect=', journalDeleteStart);
var journalDeleteHolder = { current:null };
var journalDeleteCharacter = { journalEntries:[
  {journalId:'owned-entry',title:'Личная запись',kind:'note',icon:'✒',updatedBy:'player-1'},
  {journalId:'gm-entry',title:'Запись мастера',kind:'quest',updatedBy:'gm'}
] };
var journalDeleteCalls = [];
var journalDeleteContext = {
  w:{ showToast:function(message){ journalDeleteCalls.push(['toast',message]); } },
  state:{ session:{ uid:'player-1' } },
  journalSelectedId:'owned-entry',
  ownMember:function(){ return { uid:'player-1' }; },
  fullLocalCharacter:function(){ return journalDeleteCharacter; },
  journalEntryKind:function(entry){ return entry.kind || 'note'; },
  journalDisplayIcon:function(kind,icon){ return icon || (kind === 'quest' ? '✦' : '▤'); },
  esc:function(value){ return String(value == null ? '' : value); },
  el:function(id){ return id === 'zg-journal-delete-confirm' ? journalDeleteHolder.current : null; },
  journalSave:function(reason,immediate){ journalDeleteCalls.push(['save',reason,immediate]); },
  renderDrawer:function(){ journalDeleteCalls.push(['render']); },
  document:{
    createElement:function(){
      return {
        id:'',className:'',innerHTML:'',listeners:{},
        addEventListener:function(name,handler){ this.listeners[name]=handler; },
        querySelector:function(){ return { focus:function(){ journalDeleteCalls.push(['focus']); } }; },
        remove:function(){ journalDeleteHolder.current=null; }
      };
    },
    body:{ appendChild:function(node){ journalDeleteHolder.current=node; } }
  }
};
vm.runInNewContext(html.slice(journalDeleteStart, journalDeleteEnd), journalDeleteContext);
assert.strictEqual(journalDeleteContext.w.zgVttJournalConfirmRemove('owned-entry',{preventDefault:function(){},stopPropagation:function(){}}), true);
assert.match(journalDeleteHolder.current.innerHTML, /Личная запись/);
assert.match(journalDeleteHolder.current.innerHTML, /role="alertdialog"/);
assert.strictEqual(journalDeleteContext.w.zgVttJournalRemove('owned-entry'), true);
assert.ok(journalDeleteCharacter.journalEntries[0].deletedAt > 0);
assert.strictEqual(journalDeleteContext.journalSelectedId, '');
assert.strictEqual(journalDeleteHolder.current, null);
assert.deepStrictEqual(journalDeleteCalls.filter(function(call){return call[0]==='save';}), [['save','journal-remove',true]]);
assert.strictEqual(journalDeleteContext.w.zgVttJournalConfirmRemove('gm-entry'), false);
assert.strictEqual(journalDeleteHolder.current, null);
assert.match(html, /w\.zgVttJournalOpenManual=function\(event\)/);
assert.match(html, /w\.showPage\('manual'\)/);
var journalManualStart = html.indexOf('w.zgVttJournalOpenManual=function(event)');
var journalManualEnd = html.indexOf('w.zgVttJournalOpen=function(journalId)', journalManualStart);
var journalManualCalls = [];
var journalManualContext = { w:{
  zgVttCloseDrawer:function(options){ journalManualCalls.push(['close',options]); },
  showPage:function(page){ journalManualCalls.push(['page',page]); }
}};
vm.runInNewContext(html.slice(journalManualStart, journalManualEnd), journalManualContext);
journalManualContext.w.zgVttJournalOpenManual({
  preventDefault:function(){ journalManualCalls.push(['prevent']); },
  stopPropagation:function(){ journalManualCalls.push(['stop']); }
});
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(journalManualCalls)),
  [['prevent'],['stop'],['close',{immediate:true}],['page','manual']]
);

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
    '; var entry=normalizeJournalOperationEntry({journalId:"master-entry",title:"  След  ",text:"Описание",icon:"⚑",image:"javascript:alert(1)"},"fallback",{updatedAt:500,updatedBy:"gm"});' +
    'result=applyJournalDomainOperation({id:"hero",hpCur:7,revision:4,journalEntries:[{journalId:"player-entry",title:"Игрок"}]},{type:"add",entry:entry},{updatedAt:500,updatedBy:"gm",source:"gm-journal-add",operationId:"journal-op-1"});',
  journalHelperContext
);
assert.strictEqual(journalHelperContext.result.ok, true);
assert.strictEqual(journalHelperContext.result.character.hpCur, 7);
assert.strictEqual(journalHelperContext.result.character.journalEntries.length, 2);
assert.strictEqual(journalHelperContext.result.character.journalEntries[1].title, 'След');
assert.strictEqual(journalHelperContext.result.character.journalEntries[1].icon, '⚑');
assert.strictEqual(journalHelperContext.result.character.journalEntries[1].image, '');
assert.strictEqual(journalHelperContext.result.character.revision, 5);
assert.strictEqual(journalHelperContext.result.character.syncOperationId, 'journal-op-1');
var portableJournalImageContext = { result:null };
vm.runInNewContext(
  inventoryHelperSource +
    '; result=normalizeJournalOperationEntry({journalId:"gm-image",title:"Газета",image:"data:image/png;base64,AAAA"},"fallback",{updatedAt:501,updatedBy:"gm"});',
  portableJournalImageContext
);
assert.strictEqual(portableJournalImageContext.result.image, 'data:image/png;base64,AAAA', 'portable journal covers survive room synchronization');
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
assert.match(applyBlock, /zgBuildSessionCharacterRuntime\(localCharacter,roomCharacter\)/);
assert.match(html, /journalEntries:zgMergeSessionJournalEntries\(localCharacter\.journalEntries,roomCharacter\.journalEntries\)/);
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
assert.strictEqual(journalMergeContext.result[0].deletedAt, 30);
assert.strictEqual(journalMergeContext.result[1].title, 'Комната');
assert.strictEqual(journalMergeContext.result[2].title, 'Запись мастера');
assert.strictEqual(journalMergeContext.result.some(function(entry) { return entry.title === 'Локальная'; }), false);

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
assert.match(html, /spellCD:zgMergeSessionAbilityUsage\(localCharacter,roomCharacter\.abilityUsage\)/);
assert.match(html, /spellsLearned:zgMergeSessionSpellsLearned\(localCharacter,roomCharacter\.spellsLearned\)/);
assert.match(html, /preparedSpells:zgMergeSessionPreparedSpells\(localCharacter,roomCharacter\.preparedSpells,roomCharacter\.spellsLearned\)/);
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
var runtimeHelpersStart = html.indexOf('function zgMergeSessionInventoryItems');
var runtimeHelpersEnd = html.indexOf('function zgNormalizeSkillUpdateValue', runtimeHelpersStart);
var runtimeContext = { result:null, Math:Math, Number:Number, String:String, JSON:JSON, Array:Array, Object:Object };
vm.runInNewContext(
  html.slice(runtimeHelpersStart, runtimeHelpersEnd) +
    '; result=zgBuildSessionCharacterRuntime(' +
      '{spellRefs:[101],spellsLearned:{101:true},preparedSpells:{kodex:[],folio:[],obrad:[]},spellCD:{101:{used:0,max:3}},_gmDeliveryIds:["delivery-local"],journalEntries:[{journalId:"same",title:"Локальная",updatedAt:10}],inventoryItems:[{itemId:"keep-image",image:"data:image/png;base64,local"}]},' +
      '{level:2,hpCur:8,hpMax:14,tempHp:2,ac:12,initiative:3,speed:8,stats:{str:{base:2}},statuses:["burn"],abilityUsage:{"spell-101":{used:2,max:3}},spellsLearned:{"101":true},preparedSpells:{kodex:["101"],folio:[],obrad:[]},inventoryItems:[{itemId:"keep-image",name:"Ключ",image:""}],equipItems:[],arenaEquipSlots:{weapon:"sword"},journalEntries:[{journalId:"same",title:"Firebase",updatedAt:20}],currentGoal:"Вернуть печать",progressionPlan:{version:1},appliedDeliveryIds:["delivery-room"],revision:9}' +
    ');',
  runtimeContext
);
assert.strictEqual(runtimeContext.result.level,2);
assert.strictEqual(runtimeContext.result.ac,12);
assert.strictEqual(runtimeContext.result.initiative,3);
assert.strictEqual(runtimeContext.result.speed,8);
assert.strictEqual(runtimeContext.result.stats.str.base,2);
assert.strictEqual(runtimeContext.result.journalEntries[0].title,'Firebase');
assert.strictEqual(runtimeContext.result.inventoryItems[0].image,'data:image/png;base64,local');
assert.deepStrictEqual(Array.from(runtimeContext.result._gmDeliveryIds),['delivery-local','delivery-room']);
assert.strictEqual(runtimeContext.result.currentGoal,'Вернуть печать');
assert.strictEqual(runtimeContext.result.progressionPlan.version,1);
assert.deepStrictEqual(Array.from(runtimeContext.result.preparedSpells.kodex),['101']);
assert.strictEqual(runtimeContext.result.revision,9);
assert.match(network, /appliedDeliveryIds:\s*mergeAppliedDeliveryIds\(character\._gmDeliveryIds/);
assert.match(network, /applied\.character\.appliedDeliveryIds=mergeAppliedDeliveryIds/);
assert.match(html, /zgSheetTabAction\('journal'\)/);
assert.match(html, /zgVttJournalMasterAdd/);
assert.match(network, /function normalizeAbilityTargeting\(targeting\)/);
assert.match(network, /request\.target=normalizeAbilityTargeting\(details\.targeting\)/);
assert.match(html, /pendingAbilityCast=\{key:key,label:label,profile:profile\}/);
assert.match(html, /targeting:selection&&typeof selection==='object'\?selection:\{\}/);

console.log('network character sync contract passed');
