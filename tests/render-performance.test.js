'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html,/rel="icon" href="data:image\/svg\+xml/,'inline favicon must prevent a noisy missing favicon request');
var signatureStart = html.indexOf('  function drawerRenderSignature()');
var signatureEnd = html.indexOf('  function renderDrawer(force)', signatureStart);
assert.ok(signatureStart >= 0 && signatureEnd > signatureStart, 'drawer signature helper must exist');

var character = {
  id:'hero-1',hpCur:12,hpMax:20,tempHp:0,
  inventoryItems:[{itemId:'item-1',name:'Ключ',qty:1,image:'data:image/png;base64,heavy'}],
  equipItems:[]
};
var context = {
  activePanel:'inventory',
  inventoryFilter:'all',
  inventorySearch:'',
  inventorySort:'manual',
  inventoryOperationNotice:null,
  abilitiesFilter:'all',
  abilityRequestBusy:false,
  lastRoll:'',
  drawerMember:function(){return {uid:'player-1',characterId:'hero-1',character:character};},
  fullLocalCharacter:function(){return character;},
  drawerReadOnly:function(){return false;},
  heroMembers:function(){return [];},
  JSON:JSON,Date:Date
};
vm.runInNewContext(html.slice(signatureStart,signatureEnd),context);
var initial=context.drawerRenderSignature();
context.unrelatedScene={tokens:[{id:'token-1',x:10,y:20}]};
assert.strictEqual(context.drawerRenderSignature(),initial,'token movement must not invalidate inventory');
character.inventoryItems[0].qty=2;
assert.notStrictEqual(context.drawerRenderSignature(),initial,'inventory change must invalidate inventory');
assert.strictEqual(initial.indexOf('base64,heavy'),-1,'heavy image data must not enter render signature');
context.inventorySearch='ключ';
assert.notStrictEqual(context.drawerRenderSignature(),initial,'inventory search must invalidate only the drawer view');

var inventoryHelpersStart=html.indexOf('  function inventoryItemCategory(item)');
var inventoryHelpersEnd=html.indexOf('  function inventoryPanel()',inventoryHelpersStart);
assert.ok(inventoryHelpersStart>=0&&inventoryHelpersEnd>inventoryHelpersStart,'inventory view helpers must exist');
var inventoryContext={};
vm.runInNewContext(html.slice(inventoryHelpersStart,inventoryHelpersEnd),inventoryContext);
var inventorySource=[
  {itemId:'potion',name:'Зелье света',description:'Лечебный настой',category:'potion',qty:2},
  {itemId:'sword',name:'Меч',category:'weapon',qty:1},
  {itemId:'equipped',name:'Щит',category:'armor',equipped:true,qty:1}
];
assert.deepStrictEqual(
  Array.from(inventoryContext.inventoryRowsForView(inventorySource,'all','лечебный','manual')).map(function(row){return row.index;}),
  [0],
  'search must match item details without rewriting source indexes'
);
assert.deepStrictEqual(
  Array.from(inventoryContext.inventoryRowsForView(inventorySource,'weapon','','manual')).map(function(row){return row.index;}),
  [1],
  'category filter must preserve the original item index'
);
assert.deepStrictEqual(
  Array.from(inventoryContext.inventoryRowsForView(inventorySource,'all','','qty')).map(function(row){return row.index;}),
  [0,1],
  'quantity sort must affect only visible rows and exclude equipped items'
);
assert.deepStrictEqual(inventorySource.map(function(item){return item.itemId;}),['potion','sword','equipped'],'view sorting must not mutate inventoryItems');

var drawerStart=html.indexOf('  function renderDrawer(force)');
var drawerEnd=html.indexOf('  function render(snapshot)',drawerStart);
var drawerBlock=html.slice(drawerStart,drawerEnd);
assert.match(drawerBlock,/force===false&&signature===lastDrawerRenderSignature/);
assert.ok(drawerBlock.indexOf('force===false')<drawerBlock.indexOf("ZargotaPerformance.mark('renderDrawer')"),'skipped render must not increment profiler');

var renderStart=html.indexOf('  function render(snapshot)',drawerEnd);
var renderEnd=html.indexOf('  function combatNodeForKey',renderStart);
assert.match(html.slice(renderStart,renderEnd),/renderDrawer\(false\)/);
assert.match(html,/if\(window\.zgVttRefreshDrawer\)window\.zgVttRefreshDrawer\(\)/);

var initiativeStart=html.indexOf('  function renderInitiativeStage(force)');
var initiativeEnd=html.indexOf('  function animateInitiativeRoll',initiativeStart);
var initiativeBlock=html.slice(initiativeStart,initiativeEnd);
assert.ok(initiativeStart>=0&&initiativeEnd>initiativeStart,'initiative render helper must exist');
assert.match(initiativeBlock,/initiativeRenderSignature===nextSignature/,'unchanged room snapshots must not rebuild initiative');
assert.ok(initiativeBlock.indexOf('initiativeRenderSignature===nextSignature')<initiativeBlock.indexOf("host.innerHTML='<div class=\"zg-initiative-title\""),'initiative signature guard must run before replacing its DOM');
var initiativeWrites=0,initiativeHtml='',initiativeClasses={};
var initiativeHost={
  classList:{toggle:function(name,on){initiativeClasses[name]=!!on;}},
  get innerHTML(){return initiativeHtml;},
  set innerHTML(value){initiativeWrites++;initiativeHtml=String(value);}
};
var initiativeContext={
  initiativeAnimating:false,initiativeDrag:null,initiativeRenderSignature:'',initiativeRanks:{},
  state:{session:{role:'player',uid:'hero-1'},room:{combat:{phase:'initiative',active:false,order:[{key:'hero-1',uid:'hero-1',name:'Еван',kind:'hero',rollMode:'normal',bonus:1,total:null,orderHint:0}]}}},
  el:function(id){return id==='zg-initiative-stage'?initiativeHost:null;},
  initiativeSorted:function(order){return order.slice();},
  combatEntryPortrait:function(){return'';},
  esc:function(value){return String(value==null?'':value);},
  JSON:JSON,Number:Number,String:String,Math:Math
};
vm.runInNewContext(initiativeBlock,initiativeContext);
initiativeContext.renderInitiativeStage();
initiativeContext.renderInitiativeStage();
assert.strictEqual(initiativeWrites,1,'identical snapshots must create initiative DOM only once');
assert.strictEqual(initiativeClasses.open,true,'guarded initiative stage must remain open');
initiativeContext.state.room.combat.order[0].total=14;
initiativeContext.renderInitiativeStage();
assert.strictEqual(initiativeWrites,2,'a real initiative result must still update the stage');
assert.match(initiativeBlock,/draggable="false"/,'initiative d20 image must not start native browser drag');
assert.match(html,/zgInitiativeDragStart=function\(ev\)\{[^}]*ev\.preventDefault\(\)/,'initiative pointer drag must suppress native image selection');

var combatRenderStart=html.indexOf('  function renderCombat()');
var combatRenderEnd=html.indexOf('  var deathSaveRolling=',combatRenderStart);
var combatRenderBlock=html.slice(combatRenderStart,combatRenderEnd);
var combatHtmlHelperStart=html.indexOf('  function syncCombatHtml(node,html)');
assert.ok(combatHtmlHelperStart>=0&&combatHtmlHelperStart<combatRenderStart,'combat DOM deduplication helper must exist');
assert.doesNotMatch(combatRenderBlock,/(?:bar|notice|rollPrompt|economyHost)\.innerHTML\s*=/,'unchanged room snapshots must not replace stable combat chrome');
assert.match(combatRenderBlock,/syncCombatHtml\(bar,/);
assert.match(combatRenderBlock,/syncCombatHtml\(notice,/);
assert.match(combatRenderBlock,/syncCombatHtml\(rollPrompt,/);
assert.match(combatRenderBlock,/syncCombatHtml\(economyHost,/);
assert.match(combatRenderBlock,/renderCombatPrepare\(false\)/,'background combat sync must use guarded prepare render');
assert.match(combatRenderBlock,/renderCombatAttack\(false\)/,'background combat sync must use guarded attack render');
assert.match(combatRenderBlock,/renderCombatSave\(false\)/,'background combat sync must use guarded saving-throw render');

var attackRenderStart=html.indexOf('  function renderCombatAttack(force)');
var attackRenderEnd=html.indexOf('  w.zgCombatAttackToggle=',attackRenderStart);
var attackRenderBlock=html.slice(attackRenderStart,attackRenderEnd);
assert.ok(attackRenderStart>=0&&attackRenderEnd>attackRenderStart,'guarded combat attack render must exist');
assert.match(attackRenderBlock,/force===false&&body\.__zgCombatSignature===signature/,'unchanged combat snapshots must preserve open attack controls');
assert.ok(attackRenderBlock.indexOf('force===false&&body.__zgCombatSignature===signature')<attackRenderBlock.indexOf("body.innerHTML='<div class=\"zg-combat-attack-confirm\""),'attack signature guard must run before replacing controls');
assert.match(attackRenderBlock,/restoreCombatFormValues\(formValues\)/,'a real combat change must preserve still-valid dropdown choices');

var sceneSignatureStart=html.indexOf('  function compactSceneVisualValue(value)');
var sceneSignatureEnd=html.indexOf('  function updateDirtyUi()',sceneSignatureStart);
assert.ok(sceneSignatureStart>=0&&sceneSignatureEnd>sceneSignatureStart,'scene visual signature helper must exist');
var sceneContext={JSON:JSON};
vm.runInNewContext(html.slice(sceneSignatureStart,sceneSignatureEnd),sceneContext);
var scene={
  revision:3,
  layers:[{id:'layer-1',image:'data:image/png;base64,very-heavy-background',visible:true}],
  tokens:[{id:'hero-player-1',type:'hero',memberUid:'player-1',x:10,y:20,statuses:[]}],
  regions:[],
  view:{fog:true},
  grid:true,gridSize:64,boardWidth:32,boardHeight:20,x:0,y:0,zoom:1
};
var room={
  members:{
    'player-1':{
      zone:'',
      online:true,
      presence:{lastSeen:1},
      character:{
        name:'Еван',portrait:'data:image/png;base64,very-heavy-portrait',
        hpCur:12,hpMax:20,tempHp:0,statuses:[],statusEffects:[],
        journalEntries:[{journalId:'journal-1',text:'Первая запись'}]
      }
    }
  },
  exploredRegions:{},
  combat:{active:false,turnIndex:0,order:[]},
  ping:{id:'ping-1',x:40,y:50},
  journal:{text:'room text'}
};
var sceneInitial=sceneContext.sceneVisualSignature(scene,'',room);
var structureInitial=sceneContext.sceneStructureSignature(scene,'',room);
room.members['player-1'].character.journalEntries[0].text='Изменённый текст';
room.members['player-1'].online=false;
room.members['player-1'].presence.lastSeen=2;
room.ping={id:'ping-2',x:60,y:70};
assert.strictEqual(sceneContext.sceneVisualSignature(scene,'',room),sceneInitial,'journal, presence and ping must not invalidate the map');
assert.strictEqual(sceneContext.sceneStructureSignature(scene,'',room),structureInitial,'journal, presence and ping must not rebuild the map');
room.members['player-1'].character.hpCur=11;
var memberHpSignature=sceneContext.sceneVisualSignature(scene,'',room);
assert.notStrictEqual(memberHpSignature,sceneInitial,'member HP must invalidate token visuals');
assert.strictEqual(sceneContext.sceneStructureSignature(scene,'',room),structureInitial,'member HP must not rebuild the token layer');
room.members['player-1'].character.hpCur=12;
scene.tokens[0].x=11;
assert.notStrictEqual(sceneContext.sceneVisualSignature(scene,'',room),sceneInitial,'token movement must invalidate the map');
assert.notStrictEqual(sceneContext.sceneStructureSignature(scene,'',room),structureInitial,'token movement must rebuild map structure');
scene.tokens[0].x=10;
room.combat={active:true,turnIndex:0,order:[{key:'player-1',uid:'player-1',hp:10,hpMax:20,statuses:['burn']}]};
assert.notStrictEqual(sceneContext.sceneVisualSignature(scene,'',room),sceneInitial,'combat HP and statuses must invalidate token visuals');
var combatStructure=sceneContext.sceneStructureSignature(scene,'',room);
room.combat.order[0].hp=9;
room.combat.order[0].statuses=['fear'];
assert.strictEqual(sceneContext.sceneStructureSignature(scene,'',room),combatStructure,'combat HP and statuses must patch existing tokens');
room.combat.turnIndex=1;
assert.notStrictEqual(sceneContext.sceneStructureSignature(scene,'',room),combatStructure,'combat turn must rebuild token control state');
assert.strictEqual(sceneInitial.indexOf('very-heavy-background'),-1,'heavy scene media must not enter visual signature');
assert.strictEqual(sceneInitial.indexOf('very-heavy-portrait'),-1,'heavy portrait media must not enter visual signature');

var roomStateStart=html.indexOf('  function roomState(snapshot)');
var roomStateEnd=html.indexOf('  w.zgSceneRefresh = function()',roomStateStart);
var roomStateBlock=html.slice(roomStateStart,roomStateEnd);
assert.match(roomStateBlock,/visualSceneChanged=roomChanged\|\|visualSignature!==lastAppliedSceneSignature/);
assert.match(roomStateBlock,/roomChanged \|\| \(!isMaster && sceneStructureChanged\)/);
assert.match(roomStateBlock,/if\(visualSceneChanged&&!sceneStructureChanged\)patchTokenRuntime\(\)/);
assert.match(roomStateBlock,/if\(sceneStructureChanged&&!roomChanged\)renderTokens\(\)/);

var tokenPatchStart=html.indexOf('  function patchTokenRuntime()');
var tokenPatchEnd=html.indexOf('  var sceneImageMetricsCache',tokenPatchStart);
var tokenPatchBlock=html.slice(tokenPatchStart,tokenPatchEnd);
assert.ok(tokenPatchStart>=0&&tokenPatchEnd>tokenPatchStart,'token runtime patch helper must exist');
assert.ok(tokenPatchBlock.indexOf("querySelector('.zg-vtt-token-hp')")>=0,'HP bar must be patched in place');
assert.match(tokenPatchBlock,/appendTokenCombatStatuses\(node,token\)/);
assert.doesNotMatch(tokenPatchBlock,/layer\\.innerHTML\\s*=\\s*''/);
assert.doesNotMatch(tokenPatchBlock,/renderDrawer\(/,'token status and HP patches must not rerender the character drawer');

var statusVfxStart=html.indexOf('  var TOKEN_STATUS_VISUAL_PRIORITY=');
var statusVfxEnd=html.indexOf('  w.zgTokenStatusInfo=',statusVfxStart);
var statusVfxBlock=html.slice(statusVfxStart,statusVfxEnd);
assert.ok(statusVfxStart>=0&&statusVfxEnd>statusVfxStart,'token status VFX helper must exist');
assert.match(statusVfxBlock,/\.slice\(0,2\)/,'status VFX must be capped at two animated layers per token');
assert.match(statusVfxBlock,/new w\.IntersectionObserver/,'status VFX must pause outside the visible area');
assert.match(statusVfxBlock,/visibilitychange/,'status VFX must react to hidden documents');
assert.match(statusVfxBlock,/setAttribute\('aria-hidden','true'\)/,'decorative status VFX must be hidden from assistive technology');
assert.doesNotMatch(statusVfxBlock,/setInterval\(/,'status VFX must not create permanent timers');
assert.doesNotMatch(statusVfxBlock,/setTimeout\(/,'status VFX must not create delayed particle loops');
assert.doesNotMatch(statusVfxBlock,/requestAnimationFrame\(/,'status VFX must rely on bounded CSS animation, not a frame scheduler');
assert.doesNotMatch(statusVfxBlock,/ZargotaRooms|Firebase|markDirty/,'visual-only status effects must not write network state');

var worldClockStart=html.indexOf('  function renderWorldClock()');
var worldClockEnd=html.indexOf('  function gmWorldTimePanel()',worldClockStart);
var worldClockBlock=html.slice(worldClockStart,worldClockEnd);
assert.ok(worldClockStart>=0&&worldClockEnd>worldClockStart,'world clock render helper must exist');
assert.doesNotMatch(worldClockBlock,/ZargotaRooms|Firebase|markDirty/,'clock rendering must not write network state');
assert.doesNotMatch(worldClockBlock,/setInterval\(|setTimeout\(|requestAnimationFrame\(/,'clock rendering must not start a scheduler');
assert.match(html,/\.zg-world-clock-dial b,[^{]*\{[^}]*transition:transform \.65s/,'clock hand movement must remain a CSS transition');
assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{\.zg-world-clock-dial b,[^{]*\{transition:none!important\}\}/,'clock transition must respect reduced motion');

var advanceWorldTimeStart=html.indexOf('  w.zgGmAdvanceWorldTime=function(minutes)');
var advanceWorldTimeEnd=html.indexOf('  w.zgGmVisualIntensity=',advanceWorldTimeStart);
var advanceWorldTimeBlock=html.slice(advanceWorldTimeStart,advanceWorldTimeEnd);
assert.ok(advanceWorldTimeStart>=0&&advanceWorldTimeEnd>advanceWorldTimeStart,'explicit GM world-time action must exist');
assert.match(advanceWorldTimeBlock,/ZargotaRooms&&w\.ZargotaRooms\.gmAdvanceWorldTime/,'world time writes must stay behind the explicit GM action');

var movementStart=html.indexOf('  function animateLastMovement(movementOverride)');
var movementEnd=html.indexOf('  function applyCamera()',movementStart);
var movementBlock=html.slice(movementStart,movementEnd);
assert.ok(movementStart>=0&&movementEnd>movementStart,'movement animation helper must exist');
assert.match(movementBlock,/requestAnimationFrame\(frame\)/);
assert.doesNotMatch(movementBlock,/setInterval\(/);

var effectsStart=html.indexOf('  var reducedEffectsMedia=');
var effectsEnd=html.indexOf('  var lastCombatVisual',effectsStart);
assert.ok(effectsStart>=0&&effectsEnd>effectsStart,'reduced effects controller must exist');
var effectsClass=false,storedEffects={};
var effectsContext={
  w:{matchMedia:function(){return{matches:false,addEventListener:function(){}};}},
  navigator:{hardwareConcurrency:2,deviceMemory:8},
  localStorage:{
    getItem:function(key){return storedEffects[key]||null;},
    setItem:function(key,value){storedEffects[key]=value;}
  },
  document:{
    documentElement:{classList:{toggle:function(name,on){if(name==='zg-reduced-effects')effectsClass=on;}}},
    getElementById:function(){return null;}
  }
};
vm.runInNewContext(html.slice(effectsStart,effectsEnd),effectsContext);
assert.strictEqual(effectsContext.w.zgReducedEffectsState().enabled,true,'weak device must enable reduced effects in auto mode');
assert.strictEqual(effectsClass,true,'reduced effects class must be applied');
effectsContext.w.zgReducedEffectsToggle();
assert.strictEqual(effectsContext.w.zgReducedEffectsState().preference,'on','first toggle must select explicit on');
effectsContext.w.zgReducedEffectsToggle();
assert.strictEqual(effectsContext.w.zgReducedEffectsState().enabled,false,'explicit off must override automatic weak-device mode');
assert.match(html,/html\.zg-reduced-effects \.zg-game-overlay \.zg-vtt-token/);
assert.match(html,/backdrop-filter:none!important/);
assert.match(
  html,
  /@media\(max-width:560px\)\{[\s\S]*?\.zg-vtt-drawer\.backpack-skin\{[^}]*width:min\(calc\(100vw - 8px\)/,
  'mobile backpack frame must stay inside the viewport instead of adding width'
);
assert.match(
  html,
  /@media\(max-width:560px\)\{[\s\S]*?\.zg-game-overlay\.gm \.zg-gm-actions\{[^}]*overflow:hidden/,
  'mobile GM controls must remain in one bounded compact row'
);
assert.match(
  html,
  /\.zg-session-connection\{[^}]*left:8px;[^}]*top:48px;[^}]*max-width:calc\(100vw - 16px\)/,
  'mobile reconnect notice must not cover the GM controls'
);
assert.match(
  html,
  /\.zg-game-overlay\.gm\.gm-vision \.zg-scene-quick\{[^}]*width:min\(210px,calc\(100vw - 70px\)\)/,
  'mobile scene rail must stay compact'
);
assert.match(
  html,
  /\.zg-scene-quick \.zg-scene-dirty,[\s\S]*?\.zg-scene-quick \.zg-scene-published-state\{display:none\}/,
  'mobile scene rail must hide technical publication labels'
);

console.log('render performance tests passed');
