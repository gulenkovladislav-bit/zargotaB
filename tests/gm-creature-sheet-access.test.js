'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const selectionStart = html.indexOf('  function selectGmToken(');
const selectionEnd = html.indexOf('  function openTokenCharacterSheet(',selectionStart);
const selectionBlock = html.slice(selectionStart,selectionEnd);
assert.ok(selectionStart >= 0 && selectionEnd > selectionStart,'map token selection remains extractable');
assert.doesNotMatch(selectionBlock,/zgGmInterventionOpenToken|gmInterventionTokenId\s*=\s*token\.id/,'left selection cannot retarget or open the GM panel');
assert.match(selectionBlock,/zgVttRetargetOpenDrawerToken\(token\.id\)/,'non-hero selection retargets the shared bag owner');
assert.match(selectionBlock,/if\(typeof w\.zgVttRetargetOpenDrawer==='function'\)w\.zgVttRetargetOpenDrawer\(heroUid\)/,'hero selection clears a previously selected creature even while the bag is closed');
assert.match(selectionBlock,/selectedMemberUid=''/,'non-hero selection clears the stale last-hero fallback');
assert.match(selectionBlock,/zgVttPartySelectionRefresh/,'map selection refreshes the matching initiative portrait without opening another surface');

const finishStart = html.indexOf('  function finishTokenDrag(');
const beginStart = html.indexOf('  function beginTokenDrag(', finishStart);
const sizeStart = html.indexOf('  var sizeDrag = null;',beginStart);
const dragBlock = html.slice(finishStart, sizeStart);
assert.match(dragBlock, /if \(moved\) \{\s*tokenClickSuppressedUntil=Date\.now\(\)\+260/, 'a completed drag suppresses the synthetic click that follows pointerup');
assert.match(dragBlock, /if \(ev\.shiftKey&&gmWorkspaceMode==='edit'\)\{ tokenClickSuppressedUntil=Date\.now\(\)\+260;toggleGroupSel\(token\)/, 'legacy Shift+left selection remains confined to explicit edit mode');
assert.match(html, /node\.addEventListener\('contextmenu'[\s\S]*if\(ev\.shiftKey\)\{toggleGroupSel\(token\)/, 'Shift+right click owns multi-token selection without opening the creature sheet');
assert.match(html.slice(beginStart,sizeStart), /if \(token\.locked\) \{ renderTokens\(\);return; \}/, 'a locked creature remains selectable but cannot open the GM panel through left click');
assert.doesNotMatch(html.slice(beginStart,sizeStart),/zgGmInterventionOpenToken/,'drag and selection code contains no hidden GM-panel opener');

const renderTokensStart = html.indexOf('  function renderTokens()');
const renderTokensEnd = html.indexOf('  function patchTokenRuntime()',renderTokensStart);
const tokenRender = html.slice(renderTokensStart,renderTokensEnd);
assert.doesNotMatch(tokenRender,/openGmTokenSheetFromMap|zgGmInterventionOpenToken/,'plain left click on a rendered map token never opens the GM panel');
assert.match(tokenRender,/node\.addEventListener\('contextmenu'[\s\S]*openGmTokenContextMenu\(ev,token\)/,'right click retains the explicit token action menu');

const partyStart = html.indexOf('  function renderParty()');
const partyEnd = html.indexOf('  w.zgVttPartyClick',partyStart);
const partyRender = html.slice(partyStart,partyEnd);
assert.match(partyRender,/onclick="zgVttPartyTokenClick\(/,'initiative creature portraits use a selection-only left click');
assert.match(partyRender,/oncontextmenu="return zgVttPartyTokenContextMenu\(event,/,'initiative creature portraits reserve the GM panel for right click');
assert.match(partyRender,/data-token-id=/,'creature portraits expose stable selection identity');

const partyTokenClickStart=html.indexOf('  w.zgVttPartyTokenClick=function(');
const partyTokenClickEnd=html.indexOf('  w.zgVttPartyContextMenu=',partyTokenClickStart);
const partyTokenClickBlock=html.slice(partyTokenClickStart,partyTokenClickEnd);
assert.match(partyTokenClickBlock,/zgSelectSceneTokenById/,'creature portrait left click selects its actual scene token');
assert.doesNotMatch(partyTokenClickBlock,/zgVttRetargetOpenDrawerToken/,'the portrait delegates drawer retargeting to the shared scene selection exactly once');
assert.doesNotMatch(partyTokenClickBlock,/zgGmInterventionOpenToken/,'creature portrait left click cannot open the GM panel');
assert.match(partyTokenClickBlock,/zgVttPartyTokenContextMenu[\s\S]*zgCombatCreatureSheetOpen/,'creature portrait right click alone reaches the GM sheet opener');

assert.match(html,/function drawerSceneEntity\(\)[\s\S]*?entry\.hpMax[\s\S]*?entry\.statuses[\s\S]*?entry\.statusEffects[\s\S]*?entry\.inventoryItems[\s\S]*?entry\.spellRefs[\s\S]*?entry\.journalEntries/,'the shared creature bag reads live vitals plus every available bag section from the selected entity');
assert.match(html,/function drawerMember\(\)[\s\S]*?var sceneEntity=drawerSceneEntity\(\);if\(sceneEntity\)return sceneEntity/,'the selected scene entity owns every canonical bag tab, not State alone');
assert.match(html,/w\.zgVttRetargetOpenDrawerToken=function\(tokenId\)[\s\S]*?bagPanels\.indexOf\(activePanel\)>=0[\s\S]*?lastDrawerRenderSignature=''[\s\S]*?renderDrawer\(true\)/,'an open bag preserves its current tab while switching its owner to the selected creature');
assert.doesNotMatch(html.slice(html.indexOf('w.zgVttRetargetOpenDrawerToken=function'),html.indexOf('w.zgVttOpenPublicMember=function')),/activePanel='character'/,'creature selection must not force the State tab');
assert.match(html,/selectedSceneEntity[\s\S]*?zgVttOpenPanel\('inventory',\{forceOpen:true\}\)/,'opening the bag after selecting a creature opens that creature inventory');
assert.match(html,/vttLocaleText\('Состояние существа','Стан істоти'\)/,'the creature sheet title is bilingual');
assert.match(html,/isMasterTarget=!!\(presentationIsMaster\(session\)&&member&&member\.role==='player'&&member\.character\)/,'creature journals do not expose player-sheet patch or entry controls, including in player preview');

const sceneEntityStart=html.indexOf('  function drawerSceneEntity(){');
const sceneEntityEnd=html.indexOf('  var JOURNAL_ICON_VARIANTS=',sceneEntityStart);
const drawerMemberStart=html.indexOf('  function drawerMember(){');
const drawerMemberEnd=html.indexOf('  function drawerReadOnly(member){',drawerMemberStart);
const creatureToken={id:'rat-1',type:'custom',name:'QA Крыса',hp:7,hpMax:12,inventoryItems:[{name:'Ключ крысы'}],mastery:[{name:'Укус'}],spellRefs:['rat-spell'],journalEntries:[{title:'Запись крысы'}]};
const creatureEntry={tokenId:'rat-1',name:'QA Крыса',hp:6,hpMax:12,inventoryItems:creatureToken.inventoryItems,mastery:creatureToken.mastery,spellRefs:creatureToken.spellRefs,journalEntries:creatureToken.journalEntries};
['character','inventory','abilities','journal'].forEach(function(panel){
  const context={
    result:null,activePanel:panel,drawerTokenId:'rat-1',drawerMemberUid:'',selectedMemberUid:'',
    state:{session:{role:'master',uid:'gm'},room:{combat:{order:[creatureEntry]}}},
    w:{zgSelectedHeroMemberUid:''},
    presentationSession:function(session){return session;},
    currentVttScene:function(){return{tokens:[creatureToken]};},vttLocaleText:function(ru){return ru;},
    roomMembers:function(){return[];},heroMembers:function(){return[];},ownMember:function(){return null;},currentVttSceneView:function(){return{};}
  };
  vm.runInNewContext(html.slice(sceneEntityStart,sceneEntityEnd)+html.slice(drawerMemberStart,drawerMemberEnd)+';result=drawerMember();',context);
  assert.strictEqual(context.result.uid,'token:rat-1',panel+' must keep the creature as the whole bag owner');
  assert.strictEqual(context.result.character.inventoryItems[0].name,'Ключ крысы');
  assert.strictEqual(context.result.character.mastery[0].name,'Укус');
  assert.strictEqual(context.result.character.spellRefs[0],'rat-spell');
  assert.strictEqual(context.result.character.journalEntries[0].title,'Запись крысы');
});
assert.match(html,/onclick="zgCombatCreatureSheetOpen\('\+esc\(JSON\.stringify\(String\(sheetToken\.id\|\|''\)\)\)\+'\)"/,'the combat creature-sheet button escapes the quoted token id before inserting it into inline markup');

const combatSheetStart = html.indexOf('  w.zgCombatCreatureSheetOpen=function(');
const combatSheetEnd = html.indexOf('  function renderCombat()',combatSheetStart);
assert.match(html.slice(combatSheetStart,combatSheetEnd), /zgGmInterventionOpenToken\(tokenId,'entity'\)/, 'explicit right-click and combat toolbar actions converge on the existing creature sheet');

const contextStart = html.indexOf('  function combatToolbarSheetToken(');
const contextEnd = html.indexOf('  w.zgCombatCreatureSheetOpen=',contextStart);
assert.ok(contextStart >= 0 && contextEnd > contextStart, 'context-sensitive combat sheet resolver remains extractable');
assert.match(html.slice(contextStart,contextEnd), /typeof w\.zgGetSelectedTokenId==='function'\?w\.zgGetSelectedTokenId\(\):''/, 'the actually selected map token wins over the current combat turn through the public scene bridge');
assert.match(html, /var contextSheetButton=creatureSheet\?/, 'one combat slot switches between creature sheet and hero bag');
assert.doesNotMatch(html, /creatureSheetButton\+inventoryButton/, 'creature and hero controls are never rendered together');

console.log('GM creature sheet access passed');
