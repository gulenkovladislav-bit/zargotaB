(function(root,factory){
  var api=factory(typeof module==='object'&&module.exports?require('./character-special.js'):root.ZargotaCharacterSpecial);if(typeof module==='object'&&module.exports)module.exports=api;else root.ZargotaCharacterStatus=api;
})(typeof window==='object'?window:globalThis,function(special){
  'use strict';
  var lastId=0;
  function nextId(){lastId=Math.max(Date.now()*1000,lastId+1);return lastId;}
  var clone=function(value){return JSON.parse(JSON.stringify(value));};
  function create(def,options){
    options=options||{};
    if(!def||!def.key)throw Error('unknown-status');
    var unit=options.unit||'rounds',duration=Number(options.duration);
    if(!['rounds','minutes','hours','days','manual'].includes(unit))throw Error('invalid-duration');
    if(unit==='manual')duration=0;
    else if(!Number.isInteger(duration)||duration<1||duration>999)throw Error('invalid-duration');
    var tickType=options.tickType||'',tickValue=Number(options.tickValue)||0,tickDice='';
    if(def.startOfTurnEffect==='damage'||def.startOfTurnEffect==='heal'){
      tickType='hp';tickValue=(Number(def.startOfTurnValue)||0)*(def.startOfTurnEffect==='damage'?-1:1);tickDice=tickValue?'':String(def.startOfTurnDice||'');
    }
    // These are the same established defaults used by the character sheet.
    if(def.key==='burn'){tickType='hp';tickValue=0;tickDice='1d4';}
    if(def.key==='poison'||def.key==='bleed'){tickType='hp';tickValue=-1;tickDice='';}
    var effect={id:options.id||nextId(),type:'status',statusKey:def.key,label:def.label,value:def.label,icon:def.icon||'✦',iconKey:def.key,color:def.color||'#a88b55',bg:def.bg||'',unit:unit,duration:unit==='manual'?null:duration,remaining:unit==='manual'?null:duration,tickType:tickType,tickValue:tickValue,tickDice:tickDice,stacks:1};
    if(def.labelUk)effect.labelUk=def.labelUk;
    if(def.description)effect.description=def.description;
    if(def.descriptionUk)effect.descriptionUk=def.descriptionUk;
    if(unit!=='rounds'&&unit!=='manual')effect.remainingMins=duration*({minutes:1,hours:60,days:1440}[unit]);
    ['acMod','attackMod','damageMod','speedMod','cantAct','cantMove','cantReact','hasDisadvantage','attackDisadvantage','saveDisadvantage','dexSaveDisadvantage','abilityCheckDisadvantage','grantAdvantageToAttackers','autoRemove','saveDC','saveStat'].forEach(function(key){if(def[key]!=null)effect[key]=def[key];});
    return effect;
  }
  function apply(character,def,options){
    if(def._special)return special.grant(character,def);
    var effects=character.tempEffects||[],statuses=character.statuses||[],key=def.key;
    var matches=effects.filter(function(e){return e.type==='status'&&e.statusKey===key;}),before=matches[0];
    if(matches.length>1)return {changed:false,reason:'duplicate-existing'};
    if((before||statuses.includes(key))&&!['bleed','exhausted'].includes(key))return {changed:false,reason:'already-active'};
    var amount=key==='exhausted'?Number(options?.levels??1):1;
    if(!Number.isInteger(amount)||amount<1||amount>5)throw Error('invalid-levels');
    var limit=key==='exhausted'?5:20;
    if(before&&Number(before.stacks)>=limit)return {changed:false,reason:'stack-limit'};
    var effect=before?clone(before):create(def,key==='exhausted'?Object.assign({},options,{unit:'manual',duration:0}):options);
    if(key==='exhausted'){effect.unit='manual';effect.duration=null;effect.remaining=null;delete effect.remainingMins;}
    if(before)effect.stacks=Math.min(limit,Math.max(1,Number(before.stacks)||1)+amount);
    // A legacy bleed marker represents one existing stack too.
    else if(statuses.includes(key))effect.stacks=Math.min(limit,1+amount);
    else if(key==='exhausted')effect.stacks=amount;
    var receipt={key:key,before:before?clone(before):null,after:clone(effect),hadLegacy:statuses.includes(key),hadEffects:Array.isArray(character.tempEffects),hadStatuses:Array.isArray(character.statuses)};
    character.tempEffects=before?effects.map(function(e){return e===before?effect:e;}):effects.concat(effect);
    character.statuses=statuses.includes(key)?statuses.slice():statuses.concat(key);
    return {changed:true,reason:before?'stacked':'added',receipt:receipt};
  }
  function undo(character,receipt){
    if(receipt&&receipt.special)return special.undo(character,receipt);
    if(!receipt||!receipt.after)return {changed:false,reason:'changed-since'};
    var effects=character.tempEffects||[],matches=effects.filter(function(e){return e.type==='status'&&e.statusKey===receipt.key;});
    // Never undo a player's later duration/stack edit or a different application.
    if(matches.length!==1||JSON.stringify(matches[0])!==JSON.stringify(receipt.after))return {changed:false,reason:'changed-since'};
    character.tempEffects=effects.flatMap(function(e){return e===matches[0]?(receipt.before?[clone(receipt.before)]:[]):[e];});
    if(!receipt.hadLegacy)character.statuses=(character.statuses||[]).filter(function(k){return k!==receipt.key;});
    if(!receipt.hadEffects&&!character.tempEffects.length)delete character.tempEffects;
    if(!receipt.hadStatuses&&!(character.statuses||[]).length)delete character.statuses;
    return {changed:true,reason:'undone'};
  }
  return {create:create,apply:apply,undo:undo};
});
