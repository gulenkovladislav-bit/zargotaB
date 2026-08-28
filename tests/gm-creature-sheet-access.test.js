'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const selectionStart = html.indexOf('  function selectGmToken(');
const selectionEnd = html.indexOf('  function openTokenCharacterSheet(',selectionStart);
const selectionBlock = html.slice(selectionStart,selectionEnd);
assert.ok(selectionStart >= 0 && selectionEnd > selectionStart,'map token selection remains extractable');
assert.doesNotMatch(selectionBlock,/zgGmInterventionOpenToken|gmInterventionTokenId\s*=\s*token\.id/,'left selection cannot retarget or open the GM panel');
assert.match(selectionBlock,/zgVttRetargetOpenDrawerToken\(token\.id\)/,'non-hero selection retargets the state drawer bridge');
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

assert.match(html,/function drawerSceneEntity\(\)[\s\S]*?entry\.hpMax[\s\S]*?entry\.statuses[\s\S]*?entry\.statusEffects/,'the state drawer reads live creature vitals and statuses from the combat entry');
assert.match(html,/w\.zgVttRetargetOpenDrawerToken=function\(tokenId\)[\s\S]*?activePanel==='character'[\s\S]*?renderDrawer\(true\)/,'an open State tab redraws immediately for the selected creature');

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
