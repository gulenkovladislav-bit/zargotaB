'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /<h3>Полученные заклинания<\/h3>/);
assert.match(html, /<h3>Подготовленные заклинания<\/h3>/);
assert.match(html, /if\(card\.prepared\)grouped\[card\.spellType\]\.push\(card\)/);
assert.match(html, /w\.zgVttSpellPreparation=function/);
assert.match(html, /w\.zgVttSpellDragStart=function/);
assert.match(html, /w\.zgVttPreparedSpellDrop=function/);
assert.match(html, /data-spell-drop-type=/);
assert.match(html, /var prepared=w\.zgVttSpellPreparation\(spellId,true,null\)/);
assert.match(html, /Сначала изучите это заклинание/);
assert.match(html, /Можно подготовить только изученное заклинание/);
assert.match(html, /Перетащите сюда изученное заклинание/);
assert.match(html, /Все слоты этого типа заняты/);
assert.match(html, /var catalogPageSize=6/);
assert.match(html, /grid-template-rows:repeat\(6,minmax\(0,1fr\)\)/);
assert.match(html, /class="zg-spell-card-menu"/, 'spell card actions must collapse into one compact menu');
assert.match(html, /w\.zgVttSpellCardAction=function/, 'the compact menu must route preparation and GM actions');
assert.doesNotMatch(html, /class="zg-gm-spell-actions"/, 'large always-visible GM action buttons must not cover spell copy');
assert.match(html, /createPreparedSpellDragGhost\(card,event\)/, 'spell preparation drag must create a dedicated visual ghost');
assert.match(html, /event\.dataTransfer\.setDragImage\(transparent,0,0\)/, 'the browser duplicate drag bitmap must be hidden');
assert.doesNotMatch(html, /zg-spell-drag-particles|zgSpellDragParticle/, 'spell preparation drag must stay free of particle DOM and animations');
assert.match(html, /Ability detail readability v2: about 130% copy/, 'spell detail typography must keep the requested readability contract');
assert.match(html, /\.zg-ability-detail-section>div\{[^}]*font-size:18px/, 'spell detail body copy must grow by about 30 percent');
assert.match(html, /ensurePreparedSpellsForCharacter\(c\)/);
assert.doesNotMatch(
  html.slice(html.indexOf('function pickSpell('), html.indexOf('var combatModeActive', html.indexOf('function pickSpell('))),
  /Лимит .*заклинаний|counts\[spell\.spellType\]/,
  'received spell collection must not be constrained by preparation slots'
);

var helperStart = html.indexOf('function getPreparedSpellTypeLimitForCharacter(');
var helperEnd = html.indexOf('function getSpellTypeCountsForCharacter(', helperStart);
var catalog = [
  {id:'k1',spellType:'kodex'}, {id:'k2',spellType:'kodex'},
  {id:'f1',spellType:'folio'}, {id:'r1',spellType:'obrad'}
];
var context = {
  entries:catalog,
  window:{},
  localStorage:{getItem:function(){return null;}},
  ZARGOTA_RACES:{'Уродец':{}},
  ZARGOTA_RACE_ALIASES:{},
  getRaceData:function(){return {};},
  getSpellTypeLimitForCharacter:function(){return 3;},
  Math:Math, Number:Number, String:String, Array:Array, Object:Object, JSON:JSON
};
vm.runInNewContext(html.slice(helperStart, helperEnd), context);
var legacy = {
  level:1,
  spellRefs:['k1','k2','f1','r1'],
  spellsLearned:{k1:true,k2:false,f1:true,r1:true}
};
var migrated = context.normalizePreparedSpellsForCharacter(legacy, {bootstrapLegacy:true});
assert.deepStrictEqual(Array.from(migrated.kodex), ['k1']);
assert.deepStrictEqual(Array.from(migrated.folio), ['f1']);
assert.deepStrictEqual(Array.from(migrated.obrad), ['r1']);
var invalid = context.normalizePreparedSpellsForCharacter({
  spellRefs:['k1','f1'],
  spellsLearned:{k1:true,f1:false},
  preparedSpells:{kodex:['k1','k1','f1','missing'],folio:['f1'],obrad:[]}
}, {bootstrapLegacy:false});
assert.deepStrictEqual(Array.from(invalid.kodex), ['k1']);
assert.deepStrictEqual(Array.from(invalid.folio), []);

assert.match(network, /preparedSpells:\s*clean\(preparedSpells/);
assert.match(network, /spellsLearned\[id\]!==true/);

console.log('prepared spells model contract passed');
