'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(html, /creatureHpDisplay:'approximate',heroHpDisplay:'bar'/, 'new scenes keep the non-spoiler HP defaults');
assert.match(html, /creatureHpDisplay:\['exact','approximate','hidden'\]/, 'scene persistence sanitizes creature HP visibility');
assert.match(html, /heroHpDisplay:\['bar','exact','hidden'\]/, 'scene persistence sanitizes hero HP visibility');
assert.match(html, /Здоровье существ для игроков/, 'GM settings expose creature HP visibility');
assert.match(html, /Состояние и раны/, 'GM settings expose approximate creature health');
assert.match(html, /zgVttRefreshPresentation\(\)/, 'master/player vision refreshes the surrounding VTT presentation');
assert.match(html, /typeof w\.zgInjuryIconMarkup==='function'\?w\.zgInjuryIconMarkup/, 'character injuries use the exported renderer');

var start = html.indexOf('  function combatHpPresentation(entry,isHero,session){');
var end = html.indexOf('  function combatBloodVariant(', start);
assert.ok(start >= 0 && end > start, 'HP presentation helper must remain extractable');
var source = html.slice(start, end);

function present(view, masterVision, isHero, entry) {
  var context = {
    result:null,
    input:entry,
    hero:isHero,
    session:{role:'master'},
    currentVttSceneView:function(){ return view; },
    w:{zgVttUsesMasterVision:function(){ return masterVision; }},
    Math:Math,
    Number:Number
  };
  vm.runInNewContext(source + '; result=combatHpPresentation(input,hero,session);', context);
  return context.result;
}

var wounded = {hp:6,hpMax:12};
assert.strictEqual(present({creatureHpDisplay:'approximate'}, true, false, wounded).mode, 'exact', 'real GM vision always keeps exact creature HP');
var playerPreview = present({creatureHpDisplay:'approximate'}, false, false, wounded);
assert.strictEqual(playerPreview.mode, 'approximate', 'GM player preview follows the published creature HP mode');
assert.strictEqual(playerPreview.label, 'Тяжело ранен');
assert.doesNotMatch(playerPreview.html, /6 \/ 12/, 'approximate mode does not leak numbers');
assert.strictEqual(present({creatureHpDisplay:'exact'}, false, false, wounded).mode, 'exact');
var hidden = present({creatureHpDisplay:'hidden'}, false, false, wounded);
assert.strictEqual(hidden.mode, 'hidden');
assert.strictEqual(hidden.html, '');
assert.strictEqual(present({heroHpDisplay:'bar'}, false, true, wounded).mode, 'bar');
assert.strictEqual(present({heroHpDisplay:'exact'}, false, true, wounded).mode, 'exact');

console.log('character sheet and HP visibility contract passed');
