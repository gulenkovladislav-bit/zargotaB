'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
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

console.log('render performance tests passed');
