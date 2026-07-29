'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
var start = html.indexOf('  var STATUS_DISPLAY_ALIASES=');
var end = html.indexOf('  w.zgTokenStatusInfo=function', start);
assert.ok(start >= 0 && end > start, 'status display helper block must remain extractable');

var mechanics = [
  {
    key:'stun',
    icon:'✦',
    color:'#d4bd36',
    label:'Оглушён',
    description:'Не может действовать и реагировать.'
  },
  {
    key:'burn',
    icon:'♨',
    color:'#e05b2d',
    label:'Горит',
    description:'Получает урон огнём в начале хода.',
    startOfTurnEffect:'damage',
    startOfTurnDice:'1d4'
  },
  {
    key:'poison',
    icon:'☠',
    color:'#5fbd55',
    label:'Отравлен',
    description:'Получает помеху по правилам состояния.'
  }
];
var context = {
  Array:Array,
  Number:Number,
  Object:Object,
  String:String,
  Math:Math,
  TOKEN_STATUS_DEFS:{},
  gmStatusCatalog:function(){ return mechanics; }
};
vm.runInNewContext(html.slice(start, end), context);

assert.strictEqual(context.normalizeStatusDisplayKey('STUN'), 'stun');
assert.strictEqual(context.normalizeStatusDisplayKey('Оглушён'), 'stun');
assert.strictEqual(context.normalizeStatusDisplayKey('Горит'), 'burn');

var deduped = context.collectDisplayStatuses({
  statuses:['STUN', 'burn'],
  statusEffects:[{
    type:'status',
    statusKey:'BURN',
    label:'BURN',
    unit:'rounds',
    remaining:2,
    tickType:'damage',
    tickDice:'1d6'
  }]
}, {isMaster:false});
assert.strictEqual(deduped.length, 2, 'legacy and structured statuses must collapse by canonical key');
assert.strictEqual(deduped[0].key, 'burn');
assert.strictEqual(deduped[0].label, 'Горит', 'Manual label must replace raw technical label');
assert.strictEqual(deduped[0].description, mechanics[1].description);
assert.strictEqual(deduped[0].tickDice, '1d6', 'persisted tick dice must override the Manual default');
assert.strictEqual(deduped[1].key, 'stun');
assert.strictEqual(deduped[1].label, 'Оглушён');

var hidden = context.collectDisplayStatuses({
  statuses:['STUN'],
  statusEffects:[{
    type:'status',
    statusKey:'stun',
    visibility:'gm'
  }]
}, {isMaster:false});
assert.strictEqual(hidden.length, 0, 'hidden structured status must not leak through its legacy string');
var hiddenForMaster = context.collectDisplayStatuses({
  statuses:['STUN'],
  statusEffects:[{
    type:'status',
    statusKey:'stun',
    visibility:'gm'
  }]
}, {isMaster:true});
assert.strictEqual(hiddenForMaster.length, 1);
assert.strictEqual(hiddenForMaster[0].visibility, 'gm');

var localTemp = context.collectDisplayStatuses({
  statuses:['Отравление'],
  tempEffects:[{
    type:'status',
    statusKey:'poison',
    remaining:3,
    unit:'hours'
  }]
}, {isMaster:false});
assert.strictEqual(localTemp.length, 1);
assert.strictEqual(localTemp[0].key, 'poison');
assert.strictEqual(localTemp[0].label, 'Отравлен');
assert.strictEqual(localTemp[0].remaining, 3);
assert.strictEqual(localTemp[0].unit, 'hours');

var custom = context.collectDisplayStatuses({
  statuses:[{key:'custom_mist',label:'Туман',icon:'◌',description:'Скрывает силуэт.'}]
}, {isMaster:false});
assert.strictEqual(custom.length, 1);
assert.strictEqual(custom[0].key, 'custom_mist');
assert.strictEqual(custom[0].label, 'Туман');
assert.strictEqual(custom[0].description, 'Скрывает силуэт.');

assert.strictEqual(context.statusDurationText({remaining:2,unit:'rounds'}), '2 раунд.');
assert.strictEqual(context.statusDurationText({remaining:null,unit:'manual'}), 'до снятия');
assert.strictEqual(
  context.statusTickText({tickType:'damage',tickDice:'1d4'}),
  'Урон: 1d4 в начале хода'
);
assert.strictEqual(
  context.statusTickText({tickType:'heal',tickDice:'1d6'}),
  'Лечение: 1d6 в начале хода'
);

var selectedVisuals = context.selectTokenStatusVisuals([
  {key:'custom_mist',color:'#aaaaaa'},
  {key:'fear',color:'#9060c0'},
  {key:'burn',color:'#e05020'},
  {key:'shield',color:'#4070c0'}
]);
assert.deepStrictEqual(
  Array.from(selectedVisuals).map(function(status){return status.key;}),
  ['burn','shield'],
  'token visual host must select at most two highest-priority animated statuses'
);
assert.strictEqual(selectedVisuals.length, 2);
var fallbackVisual = context.selectTokenStatusVisuals([{key:'custom_mist',color:'#aaaaaa'}]);
assert.strictEqual(fallbackVisual[0].kind, 'ring', 'unknown statuses must use the calm fallback ring');

assert.doesNotMatch(
  html,
  /tickValue>0\?\+'\':|к '\+esc\(status\.tickType\)\+' каждый раун/,
  'token status modal must not render the legacy broken tick sentence'
);
assert.match(html, /description:definition&&definition\.description/);
assert.match(html, /activeStatuses=collectDisplayStatuses\(/);
assert.match(html, /className='zg-vtt-token-status-visuals'/);
assert.match(html, /new w\.IntersectionObserver/);
assert.match(html, /tokenStatusVisualObserver\.disconnect\(\)/);
assert.match(html, /prefers-reduced-motion:reduce\)\{\.zg-vtt-status-vfx/);
assert.match(html, /html\.zg-reduced-effects \.zg-vtt-status-vfx/);
assert.doesNotMatch(
  html.slice(html.indexOf('  function appendTokenStatusVisuals('), html.indexOf('  w.zgTokenStatusInfo=function')),
  /setInterval|setTimeout|firebase|markDirty/,
  'token status visuals must not create timer loops or network writes'
);

console.log('status display tests passed');
