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
assert.doesNotMatch(html, /catalogPageSize|catalogPageCards|zgVttAbilityCatalogPage/, 'received spells must not be split between a scroll area and separate pages');
assert.match(html, /var catalogHtml=catalogCards\.map\(catalogCardHtml\)\.join\(''\)/, 'every filtered spell is rendered into the one scrollable list');
assert.match(html, /Показано '\+catalogCards\.length\+' из '\+spellCount/, 'the list reports the exact filtered and total spell counts');
assert.match(html, /spellTypeCounts=\{kodex:0,folio:0,obrad:0\}/, 'each spell type filter exposes its real count');
assert.match(html, /\.zg-magic3 \.zg-spellbook-list\{[\s\S]*?display:block;[\s\S]*?overflow-y:auto!important;/, 'the received spell catalog uses one scrolling surface');
assert.match(html, /\.zg-magic3-pages\.zg-magic3-result-count\{grid-template-columns:minmax\(0,1fr\)\}/, 'the filtered count spans and centres across the retired pager rail');
assert.match(html, /class="zg-spell-card-menu"/, 'spell card actions must collapse into one compact menu');
assert.match(html, /w\.zgVttSpellCardAction=function/, 'the compact menu must route preparation and GM actions');
assert.match(html, /actionItems\.push\(\{key:'study',label:vttSpellPlaybackText\('Начать изучение','Почати вивчення'\)\}\)/, 'an unlearned own spell exposes its bilingual study request in the compact menu');
assert.match(html, /if\(action==='study'\)return w\.zgVttRequestLearning\('spell-'\+spellId\)/, 'the compact study action reuses the canonical Firebase learning request');
assert.match(html, /onchange="zgVttSpellRequirementsChange\(this\.checked\)"/, 'the summon confirmation controls target-button availability');
assert.match(html, /w\.zgVttSpellRequirementsChange=function\(confirmed\)[\s\S]*?button\.disabled=!confirmed[\s\S]*?hint\.hidden=!!confirmed/, 'summon targeting stays visibly blocked until remains and consumables are confirmed');
assert.match(html, /pointTargeting=!!\(request\.target&&request\.target\.mode==='point'/, 'the GM workflow recognizes an already selected scene point');
assert.match(html, /pointTargeting\?'<div class="zg-spell-verdict-empty"><b>'\+spellPlaybackText\('Точка выбрана','Точку обрано'\)/, 'point spells do not ask the GM to choose an unrelated creature target');
assert.match(html, /w\.zgVttSpellCardMenuToggle=function/, 'spell card actions use a controlled in-game popover');
assert.match(html, /className='zg-spell-card-action-popover'/, 'the custom menu is portaled above the scrolling spell list');
assert.doesNotMatch(html, /zg-spell-card-menu[^\n]*<select|zg-spell-card-menu select/, 'spell card actions must never use a native select interface');
assert.match(html, /event\.key==='Escape'[\s\S]*?zgVttSpellCardMenuClose\(true\)/, 'Escape closes the custom spell action menu and restores focus');
assert.doesNotMatch(html, /class="zg-gm-spell-actions"/, 'large always-visible GM action buttons must not cover spell copy');
assert.match(html, /createPreparedSpellDragGhost\(card,event\)/, 'spell preparation drag must create a dedicated visual ghost');
assert.match(html, /event\.dataTransfer\.setDragImage\(transparent,0,0\)/, 'the browser duplicate drag bitmap must be hidden');
assert.match(html, /requestAnimationFrame[\s\S]*?--drag-x[\s\S]*?--drag-y/, 'spell drag movement must be batched into a single transform update per frame');
assert.match(html, /document\.addEventListener\('dragover',[\s\S]*?movePreparedSpellDragGhost\(event\)/, 'the drag ghost follows high-frequency document dragover coordinates');
assert.match(html, /will-change:transform,opacity/, 'the spell drag ghost must stay on its own compositor layer');
var spellDragBlock = html.slice(html.indexOf('function movePreparedSpellDragGhost('), html.indexOf('w.zgVttAbilitiesSearch=', html.indexOf('function movePreparedSpellDragGhost(')));
assert.doesNotMatch(spellDragBlock, /ghost\.style\.left=|ghost\.style\.top=/, 'spell drag must not mutate layout coordinates');
assert.doesNotMatch(html, /left \.045s|top \.045s/, 'spell drag must not animate layout coordinates');
assert.doesNotMatch(html, /@keyframes zgSpellDropReady|@keyframes zgSpellDragGlyph/, 'spell drag must not animate costly shadows or filters continuously');
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
