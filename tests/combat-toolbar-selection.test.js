'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function classList(initial) {
  const values = new Set(initial || []);
  return {
    contains:value => values.has(value),
    toggle:(value,on) => { if(on) values.add(value); else values.delete(value); },
    values
  };
}

function button(kind) {
  const attributes = {'data-combat-tool':kind};
  return {
    classList:classList(),
    getAttribute:name => attributes[name] || '',
    setAttribute:(name,value) => { attributes[name] = String(value); },
    attributes
  };
}

const buttons = ['movement','long','short','free','prepare','sheet','inventory'].map(button);
const nodes = {
  'zg-combat-economy':{querySelectorAll:selector => selector === '[data-combat-tool]' ? buttons : []},
  'zg-combat-attack':{classList:classList()},
  'zg-combat-intent':{classList:classList(['open'])},
  'zg-dice-pop':{classList:classList(['open','plan-b'])},
  'zg-combat-prepare':{classList:classList()},
  'zg-gm-intervention':{classList:classList(['minimized'])},
  'zg-vtt-drawer':{classList:classList()}
};
const context = {
  w:{zgMovementActive:()=>true},
  el:id => nodes[id] || null,
  combatLongActionMode:'',
  combatAttackTool:false,
  playerDockAction:''
};
vm.createContext(context);
const start = html.indexOf('  function syncCombatToolbarSelection(){');
const end = html.indexOf('  w.zgCombatCreatureSheetOpen=', start);
assert.ok(start >= 0 && end > start, 'combat toolbar state helper remains extractable');
vm.runInContext(html.slice(start, end), context);

context.w.zgCombatToolbarSync();
for(const kind of ['movement','short','free','sheet']) {
  const current = buttons.find(item => item.attributes['data-combat-tool'] === kind);
  assert.ok(current.classList.values.has('tool-selected'), `${kind} reflects its real open state`);
  assert.strictEqual(current.attributes['aria-pressed'],'true',`${kind} exposes its selected state`);
}

for(const kind of ['long','prepare','inventory']) {
  const current = buttons.find(item => item.attributes['data-combat-tool'] === kind);
  assert.ok(!current.classList.values.has('tool-selected'), `${kind} stays inactive while closed`);
  assert.strictEqual(current.attributes['aria-pressed'],'false',`${kind} exposes its inactive state`);
}

context.combatLongActionMode='spells';
context.combatAttackTool=false;
context.w.zgCombatToolbarSync();
assert.ok(buttons.find(item => item.attributes['data-combat-tool'] === 'long').classList.values.has('tool-selected'), 'spell palette keeps the long action selected');

context.w.zgMovementActive=()=>false;
context.combatAttackTool=true;
context.playerDockAction='inventory';
nodes['zg-combat-intent'].classList.values.delete('open');
nodes['zg-dice-pop'].classList.values.delete('open');
nodes['zg-combat-prepare'].classList.values.add('open');
nodes['zg-gm-intervention'].classList.values.delete('minimized');
nodes['zg-vtt-drawer'].classList.values.add('open');
context.w.zgCombatToolbarSync();
for(const kind of ['long','prepare','inventory']) {
  const current = buttons.find(item => item.attributes['data-combat-tool'] === kind);
  assert.ok(current.classList.values.has('tool-selected'), `${kind} updates without rebuilding the toolbar`);
  assert.strictEqual(current.attributes['aria-pressed'],'true');
}

assert.match(html, /data-combat-tool="movement" aria-pressed="false"/, 'movement button participates in the shared selection contract');
assert.match(html, /w\.zgMovementActive&&w\.zgMovementActive\(\)/, 'session toolbar reads movement state through the public scene bridge');
assert.match(html, /action==='movement'\?!\(w\.zgMovementActive&&w\.zgMovementActive\(\)\):playerDockAction !== action/, 'movement toggles from its real state after Escape or workshop mode changes');
assert.doesNotMatch(html.slice(start,end), /\bmovementMode\b/, 'session toolbar never reads scene-private movement state');
assert.match(html, /data-combat-tool="'\+type\+'" aria-pressed="false"/, 'long, short and free actions participate in the shared selection contract');
assert.match(html, /data-combat-tool="prepare" aria-pressed="false"/, 'prepare button participates in the shared selection contract');
assert.match(html, /data-combat-tool="sheet" aria-pressed="false"/, 'creature sheet participates in the shared selection contract');
assert.match(html, /combatToolbarVisible=!!\(active&&controlled\)/, 'combat toolbar is considered visible only when it can render a controlled participant');
assert.match(html, /if\(active&&masterSurface\)\{controlled=simulatedPlayer&&own&&w\.zgPlayerCombatEntry\?w\.zgPlayerCombatEntry\(order,session,true,combat&&combat\.turnIndex\)\|\|turn:turn;/, 'master combat controls fall back to the current participant if simulated-player lookup is temporarily unavailable');
assert.doesNotMatch(html, /if\(active&&session&&session\.role==='master'\)\{controlled=/, 'player preview cannot regain master combat controls through the underlying session role');
assert.match(html, /if\(w\.zgCombatAttackToolActive\)\{\s*if\(ev\.button!==0\)return;\s*ev\.preventDefault\(\);ev\.stopPropagation\(\);/, 'only the primary mouse button can select a combat target token');
assert.match(html, /tokenClickSuppressedUntil=Date\.now\(\)\+1200;[\s\S]*?node\.__zgCombatTargetClick=true/, 'target selection suppresses the pointer-up click-through after the attack panel reflows');
assert.match(html, /node\.setPointerCapture&&ev\.pointerId!=null\)node\.setPointerCapture\(ev\.pointerId\)/, 'combat targeting retains the original token through pointer-up even if the panel reflows');
assert.match(html, /classList\.add\('zg-combat-target-click-lock'\)[\s\S]*?classList\.remove\('zg-combat-target-click-lock'\)/, 'status hit targets stay locked until the target click fully settles');
assert.match(html, /combatOwnsDock=!!\(active\|\|initiative\);if\(dock\)dock\.classList\.toggle\('combat-mode',combatOwnsDock\)/, 'the ordinary free-room toolbar can never leak into active combat or initiative');
assert.match(html, /\.zg-combat-economy button\.tool-selected:not\(:disabled\)\{[^}]*box-shadow:/, 'selected tool receives a visible gold surface and outline');
assert.match(html, /\.zg-action-cursor-glyph\{[^}]*width:56px;[^}]*height:56px/, 'free-scene actions use a legible approved cursor glyph');
assert.match(html, /\.zg-action-cursor\.open\.scene-hover\{display:block\}/, 'the custom cursor is visible only while the pointer is actually over the scene');
assert.match(html, /attack:'images\/vtt-actions\/cursors\/attack-corners\.png'/, 'combat targeting uses the selected four-corner attack cursor');
assert.match(html, /\.zg-tool-range-vector\[data-tool="attack"\] \.range-vortex\{display:none\}/, 'combat targeting removes the scene-derived duplicate reticle');
assert.match(html, /\.zg-tool-range-vector \.range-vortex::before\{display:none\}/, 'combat targeting shares the background-free action cursor treatment');
assert.match(html, /\.zg-tool-range-vector\[data-tool="attack"\] \.range-vortex img\{mix-blend-mode:normal\}/, 'the transparent attack image renders without a nested blend layer');
assert.match(html, /\.zg-game-overlay\.combat-targeting \.zg-vtt-scene[^}]*cursor:none!important/, 'native crosshair cannot overlap the scene-anchored combat reticle');
assert.doesNotMatch(html, /\.zg-game-overlay\.combat-targeting \.zg-vtt-token\{cursor:crosshair!important\}/, 'the superseded native token crosshair cannot reappear over the new target cursor');
assert.match(html, /\.zg-game-overlay\.combat-targeting \.zg-vtt-journal,\.zg-game-overlay\.combat-targeting \.zg-vtt-journal \*\{pointer-events:none!important\}/, 'the open journal cannot intercept token clicks while an attack target is being selected');
assert.match(html, /cursor\.classList\.toggle\('open',combatAttackTool\)/, 'combat targeting keeps the viewport cursor active while selecting a target');
assert.match(html, /w\.zgPlaceActionCursor\)w\.zgPlaceActionCursor\(\)/, 'combat targeting restores the exact last pointer position when it opens');
assert.match(html, /\.zg-action-cursor\[data-tool="combat-attack"\]\.range-active \.zg-action-cursor-glyph\{opacity:1\}/, 'the viewport-anchored combat reticle remains visible beside the range line');
assert.match(html, /attackPreview\.tool='attack';attackPreview\.targetHovered=!!hoveredTarget;scheduleToolRangeVector\(attackPreview\)/, 'combat targeting drives the shared grid-aware range renderer with its target-hover state');
assert.match(html, /@media\(prefers-reduced-motion:reduce\)\{\.zg-combat-economy button\{transition:none\}/, 'selected-state motion respects reduced-motion');

console.log('combat toolbar selection and cursor contract passed');
