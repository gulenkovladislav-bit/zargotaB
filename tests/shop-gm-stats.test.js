'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
var start = html.indexOf('function zgShopCatalogStats');
var end = html.indexOf('function renderShopPage()', start);
assert.ok(start >= 0 && end > start, 'GM shop stats helpers must exist before renderShopPage');

var context = {
  result:null,
  SHOP_CATS:[
    {key:'weapon',icon:'W',label:'Оружие',color:'#a00'},
    {key:'potion',icon:'P',label:'Зелья',color:'#0a0'},
    {key:'other',icon:'O',label:'Разное',color:'#888'}
  ],
  SHOP_RARITY:[
    {key:'common',label:'Обычное',color:'#888'},
    {key:'rare',label:'Редкое',color:'#08f'}
  ],
  _shopState:{filter:'',gmStatsOpen:false},
  escHTML:function(value){return String(value);},
  zgGmUnlocked:function(){return true;},
  Array:Array,
  Number:Number,
  Math:Math,
  String:String
};
vm.runInNewContext(html.slice(start, end), context);

var items = [
  {cat:'weapon',rarity:'common'},
  {cat:'weapon',rarity:'rare'},
  {cat:'potion',rarity:'common'},
  {cat:'unknown',rarity:'unknown'}
];
var stats = context.zgShopCatalogStats(items);
assert.strictEqual(stats.total, 4);
assert.strictEqual(stats.categories.weapon, 2);
assert.strictEqual(stats.categories.potion, 1);
assert.strictEqual(stats.categories.other, 1);
assert.strictEqual(stats.rarities.common, 3);
assert.strictEqual(stats.rarities.rare, 1);

assert.strictEqual(context.zgShopGmStatsHtml(items, 2), '');
var toggle = context.zgShopGmStatsToggleHtml();
assert.match(toggle, /zg-shop-gm-stats-toggle/);
assert.match(toggle, /aria-expanded="false"/);
context._shopState.gmStatsOpen = true;
var rendered = context.zgShopGmStatsHtml(items, 2);
assert.match(rendered, /СТАТИСТИКА ГМа/);
assert.match(rendered, /data-total="4"/);
assert.match(rendered, /Оружие/);
assert.match(rendered, />2<\/b>/);
context.zgGmUnlocked = function(){return false;};
assert.strictEqual(context.zgShopGmStatsHtml(items, 2), '');
assert.strictEqual(context.zgShopGmStatsToggleHtml(), '');

assert.match(html, /zgShopGmStatsHtml\(items, filtered\.length\)/);
assert.match(html, /SHOP_CATS\.map[\s\S]*?\.join\(''\)\+\s*zgShopGmStatsToggleHtml\(\)/);
assert.match(html, /zargota_shop_seeded_v15/);
assert.match(html, /canonicalIds\[id\]/);
console.log('shop GM stats tests passed');
