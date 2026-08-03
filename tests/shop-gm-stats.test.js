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
  SHOP_REGIONS:[
    {id:'zargota-all',label:'Вся Заргота',includes:['zargota-all','upperland','root-valley','levoshlak']},
    {id:'root-valley',label:'Корневая Долина',includes:['root-valley']}
  ],
  SHOP_MARKETS:[{id:'glupishche-last-rest',region:'root-valley',location:'Глупище',name:'Последний Привал'}],
  _shopState:{filter:'',gmStatsOpen:false,rarity:'',priceBand:'',priceMin:'',priceMax:'',region:'',market:'',sort:'name',page:1,pageSize:24,search:''},
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
assert.match(html, /zargota_shop_seeded_v41/);
assert.match(html, /key:'common',\s+label:'Простое'/);
assert.match(html, /key:'epic',\s+label:'Реликтовое'/);
assert.doesNotMatch(html.slice(html.indexOf('var SHOP_RARITY ='), html.indexOf('var SHOP_REGIONS =')), /Обычное|Эпическое/);
assert.match(html, /var _ecoCurrency = 'zl'/);
assert.match(html, /canonicalIds\[id\]/);
assert.strictEqual(context.zgShopPriceInGold({price:{pl:1,zl:2,sr:5,md:4}}),12.54);
context._shopState.region = 'zargota-all';
assert.strictEqual(context.zgShopItemMatchesBrowseFilters({cat:'tool',rarity:'common',baseRegion:'root-valley',marketIds:['glupishche-last-rest'],price:{zl:8},name:'Верёвка'}),true);
context._shopState.market = '';
context._shopState.priceBand = 'custom';
context._shopState.priceMin = 7;
context._shopState.priceMax = 9;
assert.strictEqual(context.zgShopItemMatchesBrowseFilters({cat:'tool',rarity:'common',baseRegion:'root-valley',marketIds:['glupishche-last-rest'],price:{zl:8},name:'Верёвка'}),true);
assert.strictEqual(context.zgShopItemMatchesBrowseFilters({cat:'tool',rarity:'common',baseRegion:'root-valley',marketIds:['glupishche-last-rest'],price:{zl:12},name:'Верёвка'}),false);
context._shopState.region = '';
context._shopState.market = 'glupishche-last-rest';
assert.strictEqual(context.zgShopItemMatchesBrowseFilters({cat:'tool',rarity:'common',baseRegion:'root-valley',marketIds:['glupishche-last-rest'],price:{zl:8},name:'Верёвка'}),true);
assert.match(html, /pageSize:24/);
assert.match(html, /zgShopPaginationHtml\(_shopState\.page, pageCount, filtered\.length, 'top'\)/);
assert.match(html, /aria-label="Книга мастеров"/);
assert.match(html, /window\.zgShopSetBrowseFilter = zgShopSetBrowseFilter/);
assert.match(html, /window\.zgShopOpenMarketGuide = zgShopOpenMarketGuide/);
assert.match(html, /window\.zgShopRenderMarketGuideRows = zgShopRenderMarketGuideRows/);
assert.match(html, /window\.zgShopSelectMarketGuide = zgShopSelectMarketGuide/);
assert.match(html, /var _ecoPageSize = 36/);
assert.match(html, /function zgEcoPaginationHtml/);
assert.match(html, /window\.zgEcoSetPage = zgEcoSetPage/);
assert.match(html, /entries\.slice\(\(_ecoPage-1\)\*_ecoPageSize,_ecoPage\*_ecoPageSize\)/);
['arena','trade','battle','armory','statuses','showcase','economy'].forEach(function(icon){
  assert.match(html,new RegExp('images/ui/arena-shop/' + icon + '\\.webp'));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..','images','ui','arena-shop',icon + '.webp')),'missing optimized UI icon: ' + icon);
});
['copper','silver','gold','platinum'].forEach(function(coin){
  var coinPath = path.resolve(__dirname,'..','images','ui','coins',coin + '-sm.webp');
  assert.ok(fs.existsSync(coinPath),'missing optimized coin icon: ' + coin);
  assert.ok(fs.statSync(coinPath).size < 5000,'coin icon must stay lightweight: ' + coin);
});
var coinWidget = html.slice(html.indexOf('function buildCoinsWidget'),html.indexOf('function setCoin'));
['pl','zl','sr','md'].forEach(function(coin){
  assert.match(coinWidget,new RegExp("coin: '" + coin + "'"));
});
assert.doesNotMatch(coinWidget,/[💰🪙]/u);
assert.match(html,/window\.zgCurrencyTextHtml/);
assert.match(html,/value === '\\uD83D\\uDCB0'.*value === '\\uD83E\\uDE99'/);
assert.doesNotMatch(html,/[💰🪙]/u);
var progression = fs.readFileSync(path.resolve(__dirname,'..','zargota-progression.js'),'utf8');
assert.match(progression,/coinIcon\('zl',16\)/);
assert.match(progression,/priceHtml\(item\.price\)/);
assert.doesNotMatch(progression,/[💰🪙]/u);
assert.doesNotMatch(html.slice(html.indexOf('global.renderArenaHub'),html.indexOf('global.arenaShowTab')), /⚔️|💰|🛒|📊|🛡️|💫/);
assert.match(html, /class="zg-shop-guide-layout"/);
assert.match(html, /data-guide-market=/);
assert.match(html, /class="zg-shop-market-detail-crest"/);
assert.doesNotMatch(html, /id="arena-tab-armory"/, 'Armory must not remain a separate Arena tab');
assert.match(html, /if \(tab === 'armory'\) \{\s*_shopState\.tab = 'loadouts';\s*tab = 'shop';/, 'legacy Armory navigation must redirect into Shop loadouts');
assert.match(html, /zgShopSetTab\(\\'loadouts\\'\)/, 'Shop must expose the loadouts subtab');
assert.match(html, /id="shop-loadouts-inner"/);
assert.match(html, /function renderArmoryLoadouts\(\)/);
assert.match(html, /global\.renderArmoryLoadouts = renderArmoryLoadouts/);
assert.match(html, /window\.loadShopItems = loadShopItems/);
assert.match(html, /window\.saveShopItems = saveShopItems/);
console.log('shop GM stats tests passed');
