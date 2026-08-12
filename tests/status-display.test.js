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
    description:'Получает 1 урон и помеху по правилам состояния.',
    startOfTurnEffect:'damage',
    startOfTurnValue:1
  },
  {
    key:'bleed',
    icon:'🩸',
    color:'#cf4848',
    label:'Кровотечение',
    description:'Получает 1 урон за каждый стак.',
    startOfTurnEffect:'damage',
    startOfTurnValue:1
  }
];
var context = {
  Array:Array,
  Number:Number,
  Object:Object,
  String:String,
  Math:Math,
  TOKEN_STATUS_DEFS:{dead:['☠','#a85d57','Мёртв']},
  gmStatusCatalog:function(){ return mechanics; }
};
vm.runInNewContext(html.slice(start, end), context);

assert.strictEqual(context.normalizeStatusDisplayKey('STUN'), 'stun');
assert.strictEqual(context.normalizeStatusDisplayKey('Оглушён'), 'stun');
assert.strictEqual(context.normalizeStatusDisplayKey('Горит'), 'burn');
assert.strictEqual(context.normalizeStatusDisplayKey('Мёртв'), 'dead');

var deadDisplay = context.collectDisplayStatuses({
  deathSaves:{state:'dead',gmOutcome:'death'}
}, {isMaster:false});
assert.strictEqual(deadDisplay.length, 1, 'confirmed death must derive one public status without a Firebase schema change');
assert.strictEqual(deadDisplay[0].key, 'dead');
assert.strictEqual(deadDisplay[0].label, 'Мёртв');

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
assert.strictEqual(deduped[0].tickDice, '1d4', 'burning must follow the current Manual even when an old effect stores another die');
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
assert.strictEqual(localTemp[0].tickDice, '');
assert.strictEqual(localTemp[0].tickValue, 1);

assert.match(html, /w\.zgCollectActiveStatusEffects\(source,\{includeHidden:!!options\.isMaster\}\)/);
assert.match(html, /function statusSourceText\(status\)/);
assert.match(html, /Источников: /);
assert.match(html, /sourceText=statusSourceText\(status\)/);
context.w = {
  zgCollectActiveStatusEffects:function(){
    return {
      keys:['burn'],
      effects:[
        {type:'status',statusKey:'burn',sourceId:'spell:first',stacks:1},
        {type:'status',statusKey:'burn',sourceId:'item:torch',stacks:3}
      ],
      byKey:{burn:{type:'status',statusKey:'burn',sourceId:'spell:first',stacks:1}},
      rawByKey:{}
    };
  }
};
var unifiedDisplay = context.collectDisplayStatuses({}, {isMaster:false});
assert.strictEqual(unifiedDisplay.length, 1, 'one display row must represent multiple structured sources');
assert.strictEqual(unifiedDisplay[0].sourceCount, 2);
assert.strictEqual(unifiedDisplay[0].stacks, 3);
assert.strictEqual(context.statusSourceText(unifiedDisplay[0]), 'Источников: 2');
context.w = {};

context.w = {
  zgCollectActiveStatusEffects:function(){
    return {
      keys:['bleed'],
      effects:[
        {type:'status',statusKey:'bleed',sourceId:'weapon:first',stacks:1},
        {type:'status',statusKey:'bleed',sourceId:'weapon:second',stacks:2}
      ],
      byKey:{bleed:{type:'status',statusKey:'bleed',sourceId:'weapon:first',stacks:1}},
      rawByKey:{}
    };
  }
};
var bleedingDisplay = context.collectDisplayStatuses({}, {isMaster:false});
assert.strictEqual(bleedingDisplay[0].stacks, 3, 'bleeding display must show the sum of active stacks');
assert.strictEqual(
  context.statusTickText(bleedingDisplay[0]),
  'Урон: 1 × 3 стака в начале хода'
);
context.w = {};

var custom = context.collectDisplayStatuses({
  statuses:[{key:'custom_mist',label:'Туман',icon:'◌',description:'Скрывает силуэт.'}]
}, {isMaster:false});
assert.strictEqual(custom.length, 1);
assert.strictEqual(custom[0].key, 'custom_mist');
assert.strictEqual(custom[0].label, 'Туман');
assert.strictEqual(custom[0].description, 'Скрывает силуэт.');

var sheetEffect={type:'status',statusKey:'stun',sourceId:'sheet:stun',label:'Оглушён'};
context.w = {};
context.combatEntryForToken=function(){return{statuses:[],statusEffects:[]};};
context.memberForToken=function(){return{character:{statuses:['stun'],statusEffects:[sheetEffect]}};};
context.storedCombatEntryForToken=function(){return null;};
context.isMaster=true;
var projectedHeroStatuses=context.tokenCombatStatuses({type:'hero',memberUid:'player-1',statuses:[],statusEffects:[]});
assert.strictEqual(projectedHeroStatuses.length,1,'empty combat arrays must not hide a state already present in the hero sheet');
assert.strictEqual(projectedHeroStatuses[0].key,'stun');
assert.strictEqual(context.tokenStatusEffect({type:'hero',memberUid:'player-1'},'stun').sourceId,'sheet:stun','GM status controls must resolve the sheet effect while combat projection catches up');
var mergedDisplay=context.mergeStatusDisplaySources(
  {statuses:['stun'],statusEffects:[sheetEffect]},
  {statuses:['stun'],statusEffects:[sheetEffect]}
);
assert.strictEqual(context.collectDisplayStatuses(mergedDisplay,{isMaster:true}).length,1,'merged Firebase surfaces must deduplicate one state');
context.w = {};

assert.strictEqual(context.statusDurationText({remaining:2,unit:'rounds'}), '2 раунд.');
assert.strictEqual(context.statusDurationText({remaining:null,unit:'manual'}), 'до снятия');
assert.strictEqual(context.statusDurationLongText({remaining:1,unit:'rounds'}), '1 раунд');
assert.strictEqual(context.statusDurationLongText({remaining:3,unit:'rounds'}), '3 раунда');
assert.strictEqual(context.statusDurationLongText({remaining:12,unit:'rounds'}), '12 раундов');
assert.strictEqual(context.statusDurationLongText({remainingMinutes:1500,unit:'days'}), '1 день 1 час');
assert.strictEqual(context.statusDurationLongText({remaining:null,unit:'manual'}), 'До ручного снятия');
assert.strictEqual(
  context.statusTickText({tickType:'damage',tickDice:'1d4'}),
  'Урон: 1d4 в начале хода'
);
assert.strictEqual(
  context.statusTickText({key:'poison',tickType:'damage',tickValue:1}),
  'Урон: 1 в начале хода'
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
[
  'burn','freeze','poison','bleed','stun','shield','invisible','fear',
  'blind','silence','anchor','charm','dominate','paralyze','restrain',
  'slow','curse','exhausted','regen','rage','fly','confusion','prone'
].forEach(function(key){
  assert.notStrictEqual(
    context.selectTokenStatusVisuals([{key:key}])[0].kind,
    'ring',
    key + ' must have a semantic portrait overlay'
  );
});

assert.doesNotMatch(
  html,
  /tickValue>0\?\+'\':|к '\+esc\(status\.tickType\)\+' каждый раун/,
  'token status modal must not render the legacy broken tick sentence'
);
assert.match(html, /Отравлен'[^]*startOfTurnValue:1/);
assert.match(html, /Кровотечение'[^]*startOfTurnValue:1/);
assert.match(html, /1 урон Ядом в начале хода/);
assert.match(html, /Каждое последующее наложение добавляет 1 стак/);
assert.match(html, /description:definition&&definition\.description/);
assert.match(html, /if\(typeof w\.zgCollectDisplayStatuses==='function'\)/);
assert.match(html, /activeStatuses=w\.zgCollectDisplayStatuses\(/);
assert.doesNotMatch(html, /activeStatuses=collectDisplayStatuses\(/);
assert.match(html, /class="zg-state-effect-row"[^>]*onclick="zgVttStatusInfo/);
assert.match(html, /w\.zgVttStatusInfo=function\(index\)/);
assert.match(html, /className='zg-vtt-status-info'/);
assert.match(html, /badge=document\.createElement\('span'\)/, 'map status controls must not nest a button inside the token button');
assert.match(html, /badge\.setAttribute\('aria-haspopup','dialog'\)/, 'map status controls must expose their details dialog');
assert.match(html, /badge\.addEventListener\('pointerdown',function\(ev\)\{ev\.preventDefault\(\);ev\.stopPropagation\(\);\}\)/, 'status interaction must not start token movement');
assert.match(html, /badge\.addEventListener\('pointerup',function\(ev\)\{ev\.preventDefault\(\);ev\.stopPropagation\(\);openStatus\(ev\);\}\)/, 'status interaction must open reliably for the owning player before the token click handler');
assert.match(html, /node\.style\.zIndex = String\(ownToken\?100000:token\.z\)/, 'the owning player token must stay above neighboring scene tokens');
assert.match(html, /isMaster&&gmVision==='gm'\?el\('zg-vtt-token-layer'\):null/, 'GM status badges must leave the token stacking context');
assert.match(html, /className='zg-vtt-token-status-portal'/, 'GM status badges must use a dedicated scene portal');
assert.match(html, /if\(visuals\)portal\.appendChild\(visuals\)/, 'GM status artwork must share the portal above neighboring tokens');
assert.match(html, /\.zg-vtt-token-status-portal\{position:absolute;z-index:200000/, 'GM status portals must stay above every scene token');
assert.match(html, /function syncTokenStatusPortal\(node\)/, 'status portals must remain attached to moving and resized tokens');
assert.match(html, /String\(token\.memberUid\|\|''\)===String\(ownSession\.uid\|\|''\)/, 'own-token elevation must survive numeric or string identity snapshots');
assert.match(html, /ev\.key==='Enter'\|\|ev\.key===' '/, 'map status controls must open from the keyboard');
assert.doesNotMatch(
  html.slice(html.indexOf('var effectsHtml=activeStatuses.map'),html.indexOf('var injurySource=',html.indexOf('var effectsHtml=activeStatuses.map'))),
  /status\.description|zgStatusDurationText|zgStatusSourceText/,
  'compact status rows must render names only; full details belong in the dialog'
);
assert.match(html, /className='zg-vtt-token-status-visuals'/);
assert.match(html, /function statusSurfaceMarkup\(statuses,surface\)/, 'one renderer must serve all portrait status surfaces');
assert.match(html, /zgStatusSurfaceMarkup=statusSurfaceMarkup/, 'portrait modules must use the public read-only visual adapter');
assert.match(html, /w\.zgStatusSurfaceMarkup\?w\.zgStatusSurfaceMarkup\(activeStatuses,'state'\):''/, 'the large State portrait must show active status art');
assert.match(html, /portraitStatusMarkup\(c,entry,'party'\)/, 'initiative portraits must prefer the durable hero sheet while merging the combat projection');
assert.match(html, /zgStatusSurfaceMarkup\(w\.zgCollectDisplayStatuses\(c,\{isMaster:isMaster\}\),'sheet'\)/, 'the character sheet portrait must show active status art');
assert.match(html, /if\(w\.zgSyncTokenEffectSize\)w\.zgSyncTokenEffectSize\(node\)/, 'token status art must follow the actual token size');
assert.match(html, /aria-label="Уменьшить стаки"/);
assert.match(html, /aria-label="Увеличить длительность"/);
assert.match(html, /zgGmInterventionStatusRemoveConfirm/);
assert.match(html, /zgGmInterventionStatusRemoveApply/);
assert.match(html, /Удалить состояние/);
assert.match(html, /field==='duration'/);
assert.match(html, /remainingMinutes=Math\.max\(factor/);
assert.match(html, /\.zg-vtt-status-vfx-freeze\{overflow:hidden[^}]*background:/);
assert.match(html, /\.zg-vtt-status-vfx-freeze::before\{[^}]*clip-path:/);
assert.match(html, /\.zg-vtt-status-vfx-burn::before\{[^}]*radial-gradient/);
assert.match(html, /\.zg-vtt-status-vfx-poison::before\{[^}]*radial-gradient/);
assert.match(html, /\.zg-vtt-token-status-visuals\{position:absolute;z-index:4/);
assert.match(html, /new w\.IntersectionObserver/);
assert.match(html, /tokenStatusVisualObserver\.disconnect\(\)/);
assert.match(html, /prefers-reduced-motion:reduce\)\{\.zg-vtt-status-vfx/);
assert.match(html, /html\.zg-reduced-effects \.zg-vtt-status-vfx/);
assert.doesNotMatch(
  html.slice(html.indexOf('  function appendTokenStatusVisuals('), html.indexOf('  w.zgTokenStatusInfo=function')),
  /setInterval|setTimeout|firebase|markDirty/,
  'token status visuals must not create timer loops or network writes'
);

var statusAtlases = {control:[1280,512],dot:[768,256],debuff:[1280,256],buff:[1280,256]};
Object.keys(statusAtlases).forEach(function(name){
  var assetPath=path.resolve(__dirname,'..','images','vtt-effects','status-v2',name+'.png');
  assert.ok(fs.existsSync(assetPath),name+' status atlas must exist');
  var png=fs.readFileSync(assetPath),expected=statusAtlases[name];
  assert.strictEqual(png.toString('ascii',1,4),'PNG',name+' status atlas must be a PNG');
  assert.strictEqual(png.readUInt32BE(16),expected[0],name+' atlas width must stay bounded');
  assert.strictEqual(png.readUInt32BE(20),expected[1],name+' atlas height must stay bounded');
  assert.match(html,new RegExp('images/vtt-effects/status-v2/'+name+'\\.png'));
});
assert.match(html,/layer\.style\.animationDelay='-'\+phase\+'s'/,'status animations must not pulse in lockstep');
assert.match(html, /function syncTokenHealthPresentation\(node,token,combatEntry,member\)/, 'one adapter must own token blood and death classes');
assert.match(html, /syncTokenHealthPresentation\(node,token,combatEntry,tokenMember\)/, 'full token render must restore blood and death classes');
assert.match(html, /function patchTokenRuntime\(\)[^]*syncTokenHealthPresentation\(node,token,combatEntry,member\)/, 'Firebase runtime patches must restore blood and death classes');
assert.match(html, /mark\.textContent=health\.dead\?'☠ ПОГИБ':'СРАЖЁН'/, 'dead and downed tokens must keep distinct marks');

console.log('status display tests passed');
