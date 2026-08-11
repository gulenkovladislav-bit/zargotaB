(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ZargotaCombatVfxPresets=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(){
  'use strict';

  var VERSION=1;
  var QUALITY_LEVELS=['high','balanced','low'];
  var PRESETS=[
    {key:'slash',id:'weapon.sword.light.v1',label:'Росчерк',group:'Ближний бой',family:'melee',renderer:'hybrid',durationMs:760,description:'Быстрый диагональный след клинка без движения жетона.',audioCue:'damage',budgets:{high:{particles:18,trails:5},balanced:{particles:12,trails:3},low:{particles:5,trails:0}}},
    {key:'critical',id:'weapon.sword.critical.v1',label:'Критический удар',group:'Ближний бой',family:'melee',renderer:'hybrid',durationMs:980,description:'Два пересекающихся росчерка и короткая ударная вспышка.',audioCue:'damage',budgets:{high:{particles:24,trails:7},balanced:{particles:12,trails:4},low:{particles:5,trails:0}}},
    {key:'projectile',id:'weapon.projectile.arrow.v1',label:'Снаряд',group:'Дальний бой',family:'ranged',renderer:'canvas',durationMs:1050,description:'Стрела или болт летит от атакующего к цели.',audioCue:'status',budgets:{high:{particles:14,trails:8,projectiles:1},balanced:{particles:8,trails:4,projectiles:1},low:{particles:3,trails:0,projectiles:1}}},
    {key:'miss',id:'combat.attack.miss.v1',label:'Промах',group:'Проверка атаки',family:'melee',renderer:'hybrid',durationMs:900,description:'След проходит рядом с целью и растворяется.',audioCue:'',budgets:{high:{particles:8,trails:3},balanced:{particles:5,trails:2},low:{particles:2,trails:0}}},
    {key:'block',id:'combat.reaction.block.v1',label:'Блок',group:'Реакция',family:'reaction',renderer:'dom',durationMs:1250,description:'Защитное кольцо принимает удар перед жетоном.',audioCue:'status',budgets:{high:{particles:16,trails:2},balanced:{particles:9,trails:1},low:{particles:4,trails:0}}},
    {key:'arcane',id:'spell.arcane.impact.v1',label:'Магический импульс',group:'Заклинание',family:'spell',renderer:'hybrid',durationMs:1450,description:'Сходящиеся руны и импульс энергии вокруг цели.',audioCue:'status',budgets:{high:{particles:24,trails:6},balanced:{particles:12,trails:3},low:{particles:5,trails:0}}},
    {key:'fire',id:'spell.fire.burst.v1',label:'Огненный всплеск',group:'Заклинание',family:'spell',renderer:'hybrid',durationMs:1450,description:'Компактный взрыв с ограниченным числом искр.',audioCue:'damage',budgets:{high:{particles:24,trails:8},balanced:{particles:12,trails:4},low:{particles:5,trails:0}}},
    {key:'heal',id:'support.heal.rise.v1',label:'Исцеление',group:'Поддержка',family:'heal',renderer:'hybrid',durationMs:1450,description:'Мягкие восходящие знаки и световое кольцо.',audioCue:'heal',budgets:{high:{particles:20,trails:4},balanced:{particles:12,trails:2},low:{particles:5,trails:0}}},
    {key:'cleanse',id:'support.cleanse.disperse.v1',label:'Очищение',group:'Поддержка',family:'status',renderer:'hybrid',durationMs:1450,description:'Состояние рассеивается наружу светлыми фрагментами.',audioCue:'cleanse',budgets:{high:{particles:20,trails:4},balanced:{particles:12,trails:2},low:{particles:5,trails:0}}},
    {key:'movement',id:'movement.path.footsteps.v1',label:'Путь движения',group:'Перемещение',family:'movement',renderer:'canvas',durationMs:1500,description:'Лёгкий маршрут и последовательные следы без тяжёлых частиц.',audioCue:'',budgets:{high:{particles:16,trails:10},balanced:{particles:10,trails:6},low:{particles:5,trails:0}}}
  ];
  var FALLBACKS={melee:'slash',ranged:'projectile',reaction:'block',spell:'arcane',heal:'heal',status:'cleanse',movement:'movement',damage:'slash',direct:'arcane',system:'arcane'};

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function hashString(value){
    var hash=2166136261,text=String(value||'');
    for(var index=0;index<text.length;index++){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619);}
    return hash>>>0;
  }
  function presetHash(preset){
    if(!preset)return'';
    return hashString([preset.id,preset.family,preset.renderer,preset.durationMs,JSON.stringify(preset.budgets)].join('|')).toString(36);
  }
  function normalizeQuality(value){return QUALITY_LEVELS.indexOf(String(value||''))>=0?String(value):'balanced';}
  function byIdentity(value){value=String(value||'');return PRESETS.filter(function(preset){return preset.id===value||preset.key===value;})[0]||null;}
  function resolve(value,family){
    var preset=byIdentity(value),fallback=false;
    if(!preset){preset=byIdentity(FALLBACKS[String(family||'system')]||FALLBACKS.system);fallback=true;}
    var output=clone(preset);output.version=VERSION;output.hash=presetHash(preset);output.sound=output.audioCue;output.fallback=fallback;return output;
  }
  function seededRandom(seed){
    var state=hashString(seed)||0x6d2b79f5;
    return function(){state+=0x6d2b79f5;var value=state;value=Math.imul(value^value>>>15,value|1);value^=value+Math.imul(value^value>>>7,value|61);return((value^value>>>14)>>>0)/4294967296;};
  }
  function buildComposition(presetOrId,event,quality){
    var preset=typeof presetOrId==='object'&&presetOrId?resolve(presetOrId.id||presetOrId.key,presetOrId.family):resolve(presetOrId,event&&event.family);
    quality=normalizeQuality(quality);
    var high=preset.budgets.high||{},budget=preset.budgets[quality]||preset.budgets.balanced||high,maxParticles=Math.max(0,Number(high.particles)||0),random=seededRandom(String(event&&event.id||'preview')+'|'+preset.id+'|'+preset.version),particles=[];
    for(var index=0;index<maxParticles;index++)particles.push({index:index,angle:Math.round(random()*359),distance:Number((.35+random()*.65).toFixed(4)),scale:Number((.45+random()*.75).toFixed(4)),delayMs:Math.round(random()*120)});
    return{seed:hashString(String(event&&event.id||'preview')+'|'+preset.id+'|'+preset.version),quality:quality,particles:particles.slice(0,Math.max(0,Number(budget.particles)||0)),trails:Math.max(0,Number(budget.trails)||0),projectiles:Math.max(0,Number(budget.projectiles)||0)};
  }
  function validate(preset){
    var errors=[];
    if(!preset||typeof preset!=='object')return{valid:false,errors:['preset-required']};
    if(!String(preset.id||''))errors.push('id-required');
    if(!String(preset.key||''))errors.push('key-required');
    if(!String(preset.family||''))errors.push('family-required');
    if(!preset.budgets||!preset.budgets.high||!preset.budgets.balanced||!preset.budgets.low)errors.push('budgets-required');
    if(Number(preset.durationMs)<=0)errors.push('duration-required');
    return{valid:errors.length===0,errors:errors};
  }
  function list(){return PRESETS.map(function(preset){return resolve(preset.id,preset.family);});}

  return{VERSION:VERSION,QUALITY_LEVELS:QUALITY_LEVELS.slice(),list:list,resolve:resolve,validate:validate,normalizeQuality:normalizeQuality,hashString:hashString,presetHash:presetHash,seededRandom:seededRandom,buildComposition:buildComposition};
});
