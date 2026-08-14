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
assert.match(html, /dock\.classList\.toggle\('combat-mode',combatToolbarVisible\)/, 'the regular toolbar stays visible when combat has no controlled participant');
assert.match(html, /\.zg-combat-economy button\.tool-selected:not\(:disabled\)\{[^}]*box-shadow:/, 'selected tool receives a visible gold surface and outline');
assert.match(html, /\.zg-action-cursor-glyph\{[^}]*width:56px;[^}]*height:56px/, 'free-scene actions use a legible approved cursor glyph');
assert.match(html, /\.zg-tool-range-vector\[data-tool="attack"\] \.range-vortex\{width:72px;height:72px/, 'combat targeting uses the approved rapier at the actual target point');
assert.match(html, /\.range-vortex img\{[^}]*mix-blend-mode:screen/, 'cursor art loses its black source plate over the scene');
assert.match(html, /\.zg-game-overlay\.combat-targeting \.zg-vtt-scene[^}]*cursor:none!important/, 'native crosshair cannot overlap the scene-anchored combat reticle');
assert.match(html, /cursor\.classList\.remove\('open','over-range'\)/, 'combat targeting removes the detached sword cursor before showing its range reticle');
assert.match(html, /attackPreview\.tool='attack';scheduleToolRangeVector\(attackPreview\)/, 'combat targeting drives the shared grid-aware range renderer');
assert.match(html, /@media\(prefers-reduced-motion:reduce\)\{\.zg-combat-economy button\{transition:none\}/, 'selected-state motion respects reduced-motion');

console.log('combat toolbar selection and cursor contract passed');
