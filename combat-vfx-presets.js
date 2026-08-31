(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ZargotaCombatVfxPresets=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(){
  'use strict';

  var VERSION=4;
  var QUALITY_LEVELS=['high','balanced','low'];
  var PRESETS=[
    {key:'slash',id:'weapon.sword.light.v1',label:'Росчерк',group:'Ближний бой',family:'melee',renderer:'hybrid',durationMs:760,description:'Быстрый диагональный след клинка без движения жетона.',audioCue:'damage',budgets:{high:{particles:18,trails:5},balanced:{particles:12,trails:3},low:{particles:5,trails:0}}},
    {key:'critical',id:'weapon.sword.critical.v1',label:'Критический удар',group:'Ближний бой',family:'melee',renderer:'hybrid',durationMs:980,description:'Два пересекающихся росчерка и короткая ударная вспышка.',audioCue:'damage',budgets:{high:{particles:24,trails:7},balanced:{particles:12,trails:4},low:{particles:5,trails:0}}},
    {key:'projectile',id:'weapon.projectile.arrow.v1',label:'Снаряд',group:'Дальний бой',family:'ranged',renderer:'canvas',durationMs:1050,description:'Стрела или болт летит от атакующего к цели.',audioCue:'status',budgets:{high:{particles:14,trails:8,projectiles:1},balanced:{particles:8,trails:4,projectiles:1},low:{particles:3,trails:0,projectiles:1}}},
    {key:'fire-projectile',id:'spell.fire.projectile.v1',label:'Огненный снаряд',labelUk:'Вогняний снаряд',group:'Заклинание',groupUk:'Закляття',family:'spell',renderer:'canvas',durationMs:1120,description:'Огненное ядро летит от заклинателя и взрывается только после столкновения.',descriptionUk:'Вогняне ядро летить від заклинача й вибухає лише після зіткнення.',audioCue:'damage',budgets:{high:{particles:20,trails:10,projectiles:1},balanced:{particles:11,trails:6,projectiles:1},low:{particles:5,trails:0,projectiles:1}}},
    {key:'miss',id:'combat.attack.miss.v1',label:'Промах',group:'Проверка атаки',family:'melee',renderer:'hybrid',durationMs:900,description:'След проходит рядом с целью и растворяется.',audioCue:'',budgets:{high:{particles:8,trails:3},balanced:{particles:5,trails:2},low:{particles:2,trails:0}}},
    {key:'block',id:'combat.reaction.block.v1',label:'Блок',group:'Реакция',family:'reaction',renderer:'dom',durationMs:1250,description:'Защитное кольцо принимает удар перед жетоном.',audioCue:'status',budgets:{high:{particles:16,trails:2},balanced:{particles:9,trails:1},low:{particles:4,trails:0}}},
    {key:'arcane',id:'spell.arcane.impact.v1',label:'Магический импульс',group:'Заклинание',family:'spell',renderer:'hybrid',durationMs:1450,description:'Сходящиеся руны и импульс энергии вокруг цели.',audioCue:'status',budgets:{high:{particles:24,trails:6},balanced:{particles:12,trails:3},low:{particles:5,trails:0}}},
    {key:'fire',id:'spell.fire.burst.v1',label:'Огненный всплеск',group:'Заклинание',family:'spell',renderer:'hybrid',durationMs:1450,description:'Компактный взрыв с ограниченным числом искр.',audioCue:'damage',budgets:{high:{particles:24,trails:8},balanced:{particles:12,trails:4},low:{particles:5,trails:0}}},
    {key:'lightning',id:'spell.lightning.lasso.v1',label:'Лассо молнии',labelUk:'Ласо блискавки',group:'Заклинание',groupUk:'Закляття',family:'spell',renderer:'hybrid',durationMs:1350,description:'Холодный электрический разряд стягивается вокруг цели.',descriptionUk:'Холодний електричний розряд стягується навколо цілі.',audioCue:'status',budgets:{high:{particles:22,trails:7},balanced:{particles:12,trails:4},low:{particles:5,trails:0}}},
    {key:'psychic',id:'spell.psychic.screech.v1',label:'Психический разлом',labelUk:'Психічний розлом',group:'Заклинание',groupUk:'Закляття',family:'spell',renderer:'hybrid',durationMs:1320,description:'Фиолетовые осколки мысли сходятся к голове цели и резко расходятся.',descriptionUk:'Фіолетові уламки думки сходяться до голови цілі й різко розходяться.',audioCue:'status',budgets:{high:{particles:22,trails:5},balanced:{particles:12,trails:3},low:{particles:5,trails:0}}},
    {key:'hypnosis',id:'spell.hypnotic.pattern.v1',label:'Гипнотический узор',labelUk:'Гіпнотичний візерунок',group:'Заклинание',groupUk:'Закляття',family:'spell',renderer:'hybrid',durationMs:1780,description:'Медленные золотисто-лиловые лепестки складываются в пульсирующую мандалу.',descriptionUk:'Повільні золотаво-лілові пелюстки складаються у пульсівну мандалу.',audioCue:'status',budgets:{high:{particles:28,trails:7},balanced:{particles:15,trails:4},low:{particles:6,trails:0}}},
    {key:'curse-break',id:'spell.remove.curse.v1',label:'Разрыв проклятия',labelUk:'Розрив прокляття',group:'Заклинание',groupUk:'Закляття',family:'status',renderer:'hybrid',durationMs:1550,description:'Тёмные звенья трескаются и разлетаются в тёплом очищающем свете.',descriptionUk:'Темні ланки тріскаються й розлітаються у теплому очищувальному світлі.',audioCue:'cleanse',budgets:{high:{particles:24,trails:5},balanced:{particles:13,trails:3},low:{particles:5,trails:0}}},
    {key:'blood-transfer',id:'spell.life.transfer.v1',label:'Передача жизни',labelUk:'Передавання життя',group:'Заклинание',groupUk:'Закляття',family:'heal',renderer:'hybrid',durationMs:1750,description:'Красная нить пульсирует от заклинателя к союзнику и расцветает живым светом.',descriptionUk:'Червона нитка пульсує від заклинача до союзника й розквітає живим світлом.',audioCue:'heal',budgets:{high:{particles:26,trails:8},balanced:{particles:14,trails:5},low:{particles:6,trails:0}}},
    {key:'lightning-spear',id:'spell.lightning.spear.v1',label:'Небесное копьё',labelUk:'Небесний спис',group:'Заклинание',groupUk:'Закляття',family:'spell',renderer:'hybrid',durationMs:1680,description:'Тонкий ослепительный разряд прорезает всю линию и оставляет электрические короны на целях.',descriptionUk:'Тонкий сліпучий розряд прорізає всю лінію й залишає електричні корони на цілях.',audioCue:'damage',budgets:{high:{particles:30,trails:10},balanced:{particles:16,trails:6},low:{particles:6,trails:0}}},
    {key:'rot-ray',id:'spell.rot.ray.v1',label:'Луч гнили',labelUk:'Промінь гнилі',group:'Заклинание',groupUk:'Закляття',family:'spell',renderer:'hybrid',durationMs:1380,description:'Тонкий болотный луч прошивает цель и распадается на тяжёлые ядовитые капли.',descriptionUk:'Тонкий болотяний промінь прошиває ціль і розпадається на важкі отруйні краплі.',audioCue:'damage',budgets:{high:{particles:24,trails:8},balanced:{particles:13,trails:5},low:{particles:5,trails:0}}},
    {key:'necro',id:'spell.necro.summon.v1',label:'Подъём нежити',labelUk:'Підняття нежиті',group:'Заклинание',groupUk:'Закляття',family:'spell',renderer:'hybrid',durationMs:1650,description:'Фиолетово-зелёные осколки поднимаются из точки призыва.',descriptionUk:'Фіолетово-зелені уламки підіймаються з точки заклику.',audioCue:'status',budgets:{high:{particles:26,trails:5},balanced:{particles:13,trails:3},low:{particles:5,trails:0}}},
    {key:'heal',id:'support.heal.rise.v1',label:'Исцеление',group:'Поддержка',family:'heal',renderer:'hybrid',durationMs:1450,description:'Мягкие восходящие знаки и световое кольцо.',audioCue:'heal',budgets:{high:{particles:20,trails:4},balanced:{particles:12,trails:2},low:{particles:5,trails:0}}},
    {key:'cleanse',id:'support.cleanse.disperse.v1',label:'Очищение',group:'Поддержка',family:'status',renderer:'hybrid',durationMs:1450,description:'Состояние рассеивается наружу светлыми фрагментами.',audioCue:'cleanse',budgets:{high:{particles:20,trails:4},balanced:{particles:12,trails:2},low:{particles:5,trails:0}}},
    {key:'movement',id:'movement.path.footsteps.v1',label:'Путь движения',group:'Перемещение',family:'movement',renderer:'canvas',durationMs:1500,description:'Лёгкий маршрут и последовательные следы без тяжёлых частиц.',audioCue:'',budgets:{high:{particles:16,trails:10},balanced:{particles:10,trails:6},low:{particles:5,trails:0}}},
    {key:'mist-teleport',id:'movement.mist.teleport.v1',label:'Туманный переход',labelUk:'Туманний перехід',group:'Перемещение',groupUk:'Переміщення',family:'movement',renderer:'canvas',durationMs:920,description:'Туман собирается у исходной точки, тонким шлейфом уходит к цели и раскрывается там.',descriptionUk:'Туман збирається у вихідній точці, тонким шлейфом іде до цілі та розкривається там.',audioCue:'',budgets:{high:{particles:22,trails:8},balanced:{particles:13,trails:5},low:{particles:6,trails:0}}}
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
