'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helperStart = html.indexOf('  function openGmTokenSheetFromMap(');
const helperEnd = html.indexOf('  var sizeDrag = null;', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'GM map sheet opener remains extractable');

let opened = [];
const context = {
  isMaster:true,
  gmVision:'gm',
  movementMode:false,
  actionToolKind:'',
  abilityTargeting:null,
  tokenClickSuppressedUntil:0,
  Date:{now:()=>1000},
  w:{zgGmInterventionOpenToken:(tokenId,tab)=>{opened.push([tokenId,tab]);return true;}}
};
vm.createContext(context);
vm.runInContext(html.slice(helperStart, helperEnd), context);

assert.strictEqual(context.openGmTokenSheetFromMap('npc-1'),true);
assert.deepStrictEqual(opened,[['npc-1','entity']],'plain GM click opens the selected creature entity sheet once');

for(const blocked of [
  {isMaster:false},
  {gmVision:'players'},
  {movementMode:true},
  {actionToolKind:'attack'},
  {abilityTargeting:{}},
  {tokenClickSuppressedUntil:1100}
]){
  Object.assign(context,{isMaster:true,gmVision:'gm',movementMode:false,actionToolKind:'',abilityTargeting:null,tokenClickSuppressedUntil:0},blocked);
  assert.strictEqual(context.openGmTokenSheetFromMap('npc-blocked'),false,'tool, drag, player preview and non-GM paths cannot open the sheet');
}
assert.strictEqual(opened.length,1,'blocked paths never duplicate the opener');

const finishStart = html.indexOf('  function finishTokenDrag(');
const beginStart = html.indexOf('  function beginTokenDrag(', finishStart);
const dragBlock = html.slice(finishStart, helperStart);
assert.match(dragBlock, /if \(moved\) \{\s*tokenClickSuppressedUntil=Date\.now\(\)\+260/, 'a completed drag suppresses the synthetic click that follows pointerup');
assert.match(dragBlock, /if \(ev\.shiftKey\)\{ tokenClickSuppressedUntil=Date\.now\(\)\+260;toggleGroupSel\(token\)/, 'Shift selection cannot also open a creature sheet');
assert.match(html.slice(beginStart,helperStart), /token\.locked[\s\S]*zgGmInterventionOpenToken\(token\.id,'entity'\)/, 'locked creatures remain inspectable even though they cannot be dragged');

const renderTokensStart = html.indexOf('  function renderTokens()');
const renderTokensEnd = html.indexOf('  function patchTokenRuntime()',renderTokensStart);
const tokenRender = html.slice(renderTokensStart,renderTokensEnd);
assert.match(tokenRender, /token\.type==='custom'&&openGmTokenSheetFromMap\(token\.id\)/, 'plain creature-token click uses the guarded GM sheet opener');
assert.match(tokenRender, /zgCombatAttackToolActive[\s\S]*return;[\s\S]*openGmTokenSheetFromMap/, 'combat target selection wins over sheet opening');

const partyStart = html.indexOf('  function renderParty()');
const partyEnd = html.indexOf('  w.zgVttPartyClick',partyStart);
const partyRender = html.slice(partyStart,partyEnd);
assert.match(partyRender, /session&&session\.role==='master'&&entry\.tokenId\?' onclick="zgCombatCreatureSheetOpen\(/, 'GM can open a creature from its initiative portrait');

const combatSheetStart = html.indexOf('  w.zgCombatCreatureSheetOpen=function(');
const combatSheetEnd = html.indexOf('  function renderCombat()',combatSheetStart);
assert.match(html.slice(combatSheetStart,combatSheetEnd), /zgGmInterventionOpenToken\(tokenId,'entity'\)/, 'map, initiative and combat dock converge on the same existing creature sheet');

const contextStart = html.indexOf('  function combatToolbarSheetToken(');
const contextEnd = html.indexOf('  w.zgCombatCreatureSheetOpen=',contextStart);
assert.ok(contextStart >= 0 && contextEnd > contextStart, 'context-sensitive combat sheet resolver remains extractable');
assert.match(html.slice(contextStart,contextEnd), /typeof w\.zgGetSelectedTokenId==='function'\?w\.zgGetSelectedTokenId\(\):''/, 'the actually selected map token wins over the current combat turn through the public scene bridge');
assert.match(html, /var contextSheetButton=creatureSheet\?/, 'one combat slot switches between creature sheet and hero bag');
assert.doesNotMatch(html, /creatureSheetButton\+inventoryButton/, 'creature and hero controls are never rendered together');

console.log('GM creature sheet access passed');
