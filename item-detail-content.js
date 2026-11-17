/* Read-only item presentation. Instance edits outrank its saved definition. */
(function(root,factory){
  var api=factory(typeof module==='object'&&module.exports?require('./personal-item-presentation.js'):root.ZargotaPersonalItemPresentation);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ZargotaItemDetailContent=api;
})(typeof window!=='undefined'?window:globalThis,function(personalPresentation){
  'use strict';
  var own=function(object,key){return Object.prototype.hasOwnProperty.call(object,key);};
  var text=function(value){return typeof value==='string'||typeof value==='number'?String(value):'';};
  function firstOwned(layer,keys,stringsOnly){
    for(var i=0;i<keys.length;i++)if(own(layer,keys[i])&&(!stringsOnly||keys[i]!=='effects'||typeof layer[keys[i]]==='string'))return keys[i];
    return null;
  }
  function resolve(item,catalogItems){
    item=item&&typeof item==='object'?item:{};
    var id=item.definitionId||item.catalogItemId||item.id;
    var catalog=(Array.isArray(catalogItems)?catalogItems:[]).find(function(entry){return id&&entry&&String(entry.id)===String(id);})||{};
    var snapshot=item.definitionSnapshot&&typeof item.definitionSnapshot==='object'?item.definitionSnapshot:{};
    var layers=[catalog,snapshot,item],out=Object.assign({},catalog,snapshot,item);
    function alias(key,keys,ukKeys,stringsOnly){
      var value,translation,found=false;
      layers.forEach(function(layer){
        var source=firstOwned(layer,keys,stringsOnly),uk=firstOwned(layer,ukKeys||[],false);
        if(source!==null){if(found&&layer[source]!==value&&uk===null)translation=undefined;value=layer[source];found=true;}
        if(uk!==null)translation=layer[uk];
      });
      if(found)out[key]=value;
      (ukKeys||[]).forEach(function(k){delete out[k];});
      if(translation!==undefined)out[key+'Uk']=translation;
    }
    alias('name',['name','text'],['nameUk']);
    alias('description',['description','desc','text'],['descriptionUk','descUk']);
    alias('effectText',['effectText','effect','effects'],['effectTextUk','effectUk','effectsUk'],true);
    alias('damageFormula',['damageFormula','damage'],[]);
    alias('acBonus',['acBonus','defense'],[]);
    alias('damageType',['damageType'],['damageTypeUk']);
    alias('range',['range'],['rangeUk']);
    if(!own(out,'description'))out.description='';
    if(!own(out,'effectText'))out.effectText='';
    return personalPresentation?personalPresentation.enrich(out):out;
  }
  function choose(pair,locale){return pair[locale==='uk'?1:0];}
  function category(item){return String(item.category||item.cat||'').toLowerCase();}
  function tags(item){return Array.isArray(item.tags)?item.tags.join(' ').toLowerCase():String(item.tags||'').toLowerCase();}
  function kind(item,locale){
    item=item||{};if(item.displayType)return text(locale==='uk'&&item.displayTypeUk?item.displayTypeUk:item.displayType);var cat=category(item),slot=String(item.slot||item.preferredSlot||'').toLowerCase(),tag=tags(item);
    var slots={gloves:['Перчатки','Рукавички'],cloak:['Плащ','Плащ'],amulet:['Амулет','Амулет']};if(slots[slot])return choose(slots[slot],locale);
    if(slot==='ring'||/(?:^|\s)ring(?:\s|$)/.test(tag))return choose(['Кольцо','Кільце'],locale);
    if(cat==='potion'||/(?:^|\s)potion(?:\s|$)/.test(tag))return choose(['Зелье','Зілля'],locale);
    if(cat==='weapon'&&/sword/.test(tag))return choose(['Меч','Меч'],locale);
    if(cat==='weapon'&&/saber/.test(tag))return choose(['Сабля','Шабля'],locale);
    if(cat==='weapon'&&/rapier/.test(tag))return choose(['Рапира','Рапіра'],locale);
    var names={weapon:['Оружие','Зброя'],armor:['Броня','Броня'],shield:['Щит','Щит'],clothing:['Одежда','Одяг'],equipment:['Снаряжение','Спорядження'],tool:['Инструмент','Інструмент'],consumable:['Расходник','Витратний предмет'],potion:['Зелье','Зілля'],food:['Еда','Їжа'],material:['Материал','Матеріал'],accessory:['Аксессуар','Аксесуар'],artifact:['Артефакт','Артефакт'],magic:['Магический предмет','Магічний предмет'],jewelry:['Украшение','Прикраса'],prosthesis:['Протез','Протез'],horse:['Лошадь','Кінь'],wagon:['Повозка','Віз'],boat:['Лодка','Човен'],saddle:['Седло','Сідло'],'trained-animal':['Животное','Тварина'],currency:['Монеты','Монети'],service:['Услуга','Послуга']};
    return choose(names[cat]||['Предмет','Предмет'],locale);
  }
  var damageNames={'колющий':['Колющий','Колючий'],'piercing':['Колющий','Колючий'],'рубящий':['Рубящий','Рубальний'],'slashing':['Рубящий','Рубальний'],'дробящий':['Дробящий','Дробильний'],'bludgeoning':['Дробящий','Дробильний'],'огненный':['Огненный','Вогняний'],'fire':['Огонь','Вогонь'],'огонь':['Огонь','Вогонь'],'холодный':['Холодный','Холодний'],'cold':['Холод','Холод'],'электрический':['Электрический','Електричний'],'lightning':['Электрический','Електричний'],'звуковой':['Звуковой','Звуковий'],'некротический':['Некротический','Некротичний'],'кислотный':['Кислотный','Кислотний'],'яд':['Яд','Отрута'],'психический':['Психический','Психічний']};
  var statNames={str:['Сила','Сила'],dex:['Ловкость','Спритність'],int:['Интеллект','Інтелект'],con:['Выносливость','Витривалість'],per:['Восприятие','Сприйняття'],cha:['Харизма','Харизма']};
  var statKeys={strength:'str',dexterity:'dex',intelligence:'int',constitution:'con',endurance:'con',perception:'per',charisma:'cha'};
  function rangeText(value,locale){
    var source=text(value);if(locale!=='uk')return source;
    return source.replace(/Ближняя/g,'Ближня').replace(/Дальняя/g,'Дальня').replace(/клетки/g,'клітини').replace(/клетка/g,'клітина').replace(/клеток/g,'клітин');
  }
  function stats(item,locale){
    item=item||{};var result=[],damage=text(item.damageFormula),type=text(locale==='uk'&&own(item,'damageTypeUk')?item.damageTypeUk:item.damageType);
    if(damage){var pair=damageNames[type.toLowerCase()];result.push(damage+(type?' · '+(pair?choose(pair,locale):type):''));}
    if(Number.isFinite(Number(item.acBonus))&&Number(item.acBonus)!==0)result.push(choose(['Броня ','Броня '],locale)+(Number(item.acBonus)>0?'+':'')+Number(item.acBonus));
    var range=locale==='uk'&&own(item,'rangeUk')?text(item.rangeUk):rangeText(item.range,locale);if(range)result.push(range);
    if(Array.isArray(item.requirements))item.requirements.forEach(function(requirement){
      if(!requirement||typeof requirement!=='object')return;
      var key=statKeys[requirement.stat]||requirement.stat,pair=statNames[key];
      if(pair&&requirement.min!==null&&requirement.min!==''&&Number.isFinite(Number(requirement.min)))result.push(choose(pair,locale)+' '+Number(requirement.min)+'+');
    });
    return result;
  }
  function canEquip(item){
    item=item||{};var cat=category(item),mode=item.consumption&&item.consumption.mode,tag=tags(item);
    if(['consumable','potion','food','material','currency','service'].indexOf(cat)>=0||mode==='consume-on-use'||mode==='consume-on-cast'||/(?:^|\s)single-use(?:\s|$)/.test(tag))return false;
    if(['weapon','armor','shield','clothing','equipment','accessory','jewelry','prosthesis'].indexOf(cat)>=0)return true;
    return /^(?:mainhand|offhand|head|armor|body|chest|outfit|hands|legs|feet|cloak|ring|amulet|wrists|belt|face|accessory1|accessory2)$/.test(String(item.slot||item.preferredSlot||'').toLowerCase());
  }
  function useMode(item){
    item=item||{};var mode=item.consumption&&item.consumption.mode,cat=category(item),tag=tags(item);
    if(mode==='consume-on-cast'||mode==='service-on-purchase')return '';
    var charges=item.charges,max=item.maxCharges,definition=item.definitionSnapshot||{};
    if(Number(definition.maxCharges||definition.charges)>1)return '';
    if(charges!=null&&(!Number.isFinite(Number(charges))||Number(charges)!==1)||max!=null&&(!Number.isFinite(Number(max))||Number(max)>1))return '';
    if(item.recharge)return '';
    return mode==='consume-on-use'||/(?:^|\s)single-use(?:\s|$)/.test(tag)||cat==='consumable'&&Number(charges)===1?'unit':'';
  }
  return {resolve:resolve,kind:kind,stats:stats,canEquip:canEquip,useMode:useMode};
});
