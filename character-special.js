/* Shared sheet resources. No network writes here; callers use the sheet transaction. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ZargotaCharacterSpecial=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 var copy=function(v){return JSON.parse(JSON.stringify(v));};
 function count(c){return Math.max(0,Math.min(999,Math.floor(Number(c.inspiration)||0)));}
 function injuries(c){return Array.isArray(c.injuries)?c.injuries:Array.isArray(c.traumas)?c.traumas:Array.isArray(c.wounds)?c.wounds:[];}
 function maximum(c){var base=Math.max(1,Number(c.baseHpMax)||Number(c.hpMax)||1),bonus=Number(c._equipAppliedHpBonus)||0;return Math.max(1,Math.floor((base+bonus)*(1-Math.min(3,injuries(c).length)*.1)));}
 function health(c){if(c.baseHpMax==null)c.baseHpMax=Math.max(1,(Number(c.hpMax)||1)-(Number(c._equipAppliedHpBonus)||0));c.hpMax=maximum(c);c.hpCur=Math.max(0,Math.min(c.hpMax,Number(c.hpCur)||0));}
 function catalog(table){return [{key:'inspiration',_special:'inspiration',label:'Вдохновение',labelUk:'Натхнення',iconPath:'images/ui/character-mobile/inspiration-candle-v1.png',description:'Одно очко вдохновения. Герой может израсходовать его в своём листе.',descriptionUk:'Одне очко натхнення. Герой може витратити його у своєму аркуші.'}].concat((table||[]).map(function(d){return {key:'injury:'+d.key,_special:'injury',label:d.name,iconPath:d.iconPath,description:d.effect+'\n'+d.treatment,injury:copy(d)};}));}
 function snapshot(c,fields){var out={};fields.forEach(function(k){out[k]=c[k]===undefined?null:copy(c[k]);});return out;}
 function grant(c,def,options){
  var fields=def._special==='person'?['family']:def._special==='document'?['journalEntries']:def._special==='spell'?['spellRefs','spellsLearned','spellGrantCatalog','preparedSpells']:['trait','mastery'].includes(def._special)?['mastery']:def._special==='inspiration'?['inspiration','inspirationEvent']:['injuries','baseHpMax','hpMax','hpCur'];
  var before=snapshot(c,fields);
  if(def._special==='person'&&def.ability){
    var a=def.ability,existing=(c.family||[]).find(function(p){return p.grantTemplateId===def.key;});
    if(options?.updateOnly&&!existing)return {changed:false,reason:'not-known'};
    var shared={name:a.name||'',nameUk:a.nameUk||a.name||'',knownInfo:a.description||'',knownInfoUk:a.descriptionUk||a.description||'',portrait:a.iconAsset||''};
    ['relation','lastKnownPlace'].forEach(function(k){if(Object.prototype.hasOwnProperty.call(a,k))shared[k]=a[k];if(Object.prototype.hasOwnProperty.call(a,k+'Uk'))shared[k+'Uk']=a[k+'Uk'];});
    if(existing){if(Object.keys(shared).every(function(k){return (existing[k]||'')===shared[k];}))return {changed:false,reason:'already-active'};c.family=c.family.map(function(p){return p===existing?Object.assign({},p,shared):p;});}
    else c.family=(c.family||[]).concat(Object.assign({id:'person-'+Date.now()+'-'+Math.random().toString(36).slice(2),grantTemplateId:def.key,parentId:'root'},shared));
  }
  else if(def._special==='document'&&def.document){if((c.journalEntries||[]).some(function(e){return e.grantTemplateId===def.key&&!e.deletedAt;}))return {changed:false,reason:'already-active'};var entry=copy(def.document);entry.journalId='doc-'+Date.now()+'-'+Math.random().toString(36).slice(2);entry.grantTemplateId=def.key;entry.updatedBy='gm';entry.createdAt=Date.now();entry.updatedAt=entry.createdAt;c.journalEntries=(c.journalEntries||[]).concat(entry);}
  else if(def._special==='spell'&&def.spell){var sid=String(def.spell.id);if((c.spellRefs||[]).some(function(id){return String(id)===sid;}))return {changed:false,reason:'already-active'};c.spellRefs=(c.spellRefs||[]).slice();if(!c.spellRefs.some(function(id){return String(id)===sid;}))c.spellRefs.push(def.spell.id);c.spellGrantCatalog=Object.assign({},c.spellGrantCatalog,{[sid]:copy(def.spell)});}
  else if(['trait','mastery'].includes(def._special)&&def.ability){if((c.mastery||[]).some(function(a){return a.grantTemplateId===def.key;}))return {changed:false,reason:'already-active'};var ability=copy(def.ability);ability.grantTemplateId=def.key;ability.type=def._special==='trait'?'Черта':'Мастерство';ability.typeUk=def._special==='trait'?'Риса':'Майстерність';ability.cdUsed=0;c.mastery=(c.mastery||[]).concat(ability);}
  else if(def._special==='inspiration'){if(count(c)>=999)return {changed:false,reason:'stack-limit'};c.inspiration=count(c)+1;c.inspirationEvent={id:'inspiration-'+Date.now()+'-'+Math.random().toString(36).slice(2),kind:'granted'};}
  else if(def._special==='injury'&&def.injury){if(injuries(c).length>=4)return {changed:false,reason:'stack-limit'};var injury=copy(def.injury);injury.id='injury-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);injury.createdAt=Date.now();injury.source='gm-table';injury.penaltyPercent=10;c.injuries=injuries(c).concat(injury);health(c);}
  else return {changed:false,reason:'unknown-status'};
  return {changed:true,reason:'added',receipt:{special:true,key:def.key,before:before,after:snapshot(c,fields)}};
 }
 function undo(c,r){if(!r||!r.special||JSON.stringify(snapshot(c,Object.keys(r.after)))!==JSON.stringify(r.after))return {changed:false,reason:'changed-since'};Object.keys(r.before).forEach(function(k){if(r.before[k]===null)delete c[k];else c[k]=copy(r.before[k]);});return {changed:true,reason:'undone'};}
 function spend(c){if(!count(c))return {changed:false,reason:'empty'};c.inspiration=count(c)-1;c.inspirationEvent={id:'inspiration-'+Date.now()+'-'+Math.random().toString(36).slice(2),kind:'spent'};return {changed:true,reason:'spent'};}
 function remove(c,id){var list=injuries(c);if(!id||!list.some(function(i){return i&&i.id===id;}))return {changed:false,reason:'changed-since'};c.injuries=list.filter(function(i){return !i||i.id!==id;});health(c);return {changed:true,reason:'removed'};}
 function removeStatus(c,key,one){
  var matches=(c.tempEffects||[]).filter(function(f){return f.type==='status'&&f.statusKey===key;}),level=Math.max((c.statuses||[]).includes(key)?1:0,...matches.map(function(f){return Math.max(1,Number(f.stacks)||1);}));
  if(!level)return {changed:false,reason:'empty'};
  var left=one?Math.max(0,Math.min(5,level)-1):0;
  c.tempEffects=(c.tempEffects||[]).filter(function(f){return !(f.type==='status'&&f.statusKey===key);});
  c.statuses=(c.statuses||[]).filter(function(k){return k!==key;});
  if(left){var f=Object.assign({},matches[0],{type:'status',statusKey:key,stacks:left});c.tempEffects.push(f);c.statuses.push(key);}
  return {changed:true,reason:'removed'};
 }
 return {removeStatus:removeStatus,count:count,injuries:injuries,maximum:maximum,catalog:catalog,grant:grant,undo:undo,spend:spend,remove:remove};
});
