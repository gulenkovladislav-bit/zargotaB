'use strict';
const crypto=require('node:crypto');
const {Parser}=require('htmlparser2');
const META=new Set(['revision','_updatedAt','updatedAt','updatedBy','source','syncOperationId','_equipBonusCache']);
const mediaFields=new Set(['portrait','portraitUrl','portraitThumb','image','imageUrl','imageThumb','src','url','icon']);
const identifierField=/^(id|campaignKey|_syncId)$|Id$/;
const textFields=new Set(['name','label','title','notes','note','description','biography','currentGoal','battleEcho','relation','race','klasse','knownInfo','usages','region','relationshipLevel']);
const colorPattern=/^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|(?:rgb|hsl)a?\([\d.,%+\-\s]+\)|[a-z]{1,24})$/i;
const keyPattern=/^[-\p{L}\p{N}_:. ]{0,150}$/u;
const numericFields=['level','hpCur','hpMax','baseHpMax','hpDelta','tempHp','ac','baseAc','initiative','baseInitiative','unspentStatPoints','combatRound','fameMundo','fameZargoty'];
// The editor accepts descriptive movement (e.g. 'не ходит'), not just distances.
const speedPattern=/^[\p{L}\p{N}\s.,()+/—–-]{0,64}$/u;
const richTags=new Set(['p','br','b','strong','i','em','u','s','ul','ol','li','span','div','a','hr','h1','h2','h3','h4','blockquote']);
function fail(code){throw Object.assign(new Error(code),{code});}
function validateNumber(value){
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(typeof value==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())&&Number.isFinite(Number(value)))return;
  fail('invalid-character');
}
function safeText(value,key){
  // Existing sheet renderers contain inline handlers and image attributes.
  // Validate those contexts before accepting any remotely authored data.
  if(identifierField.test(key)&&!/^[-a-zA-Z0-9_.:/ ]*$/.test(value))fail('unsafe-character-content');
  if(mediaFields.has(key)&&value){
    if(key==='icon'&&/^art:[a-zA-Z0-9_-]+$/.test(value))return;
    if(/["'<>`\\\x00-\x1f]|&(?:#|[a-z][\da-z]{0,30};)/i.test(value))fail('unsafe-character-content');
    let url;try{url=new URL(value,'https://assets.invalid/');}catch(_){fail('unsafe-character-content');}
    if(!['https:','http:'].includes(url.protocol)&&!/^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value))fail('unsafe-character-content');
  }
  if(!value.includes('<'))return;
  // htmlparser2 omits unfinished tags. A renderer concatenating more HTML
  // could supply the closing ">" and turn an unfinished token into markup.
  const start=/<(?=[a-z/!?])/ig;
  const token=/<(\/?)([a-z][a-z0-9]*)(?:\s+[a-z][a-z-]*\s*=\s*(?:"[^"<>]*"|'[^'<>]*'|[^\s"'=<>`]+))*\s*\/?>/iy;
  let found;
  while((found=start.exec(value))){
    token.lastIndex=found.index;
    const match=token.exec(value);
    if(!match||!richTags.has(match[2].toLowerCase())||(match[1]&&!/^<\/[a-z0-9]+\s*>$/i.test(match[0])))fail('unsafe-character-content');
    start.lastIndex=token.lastIndex;
  }
  const parser=new Parser({onopentag(name,attrs){
    if(!richTags.has(name))fail('unsafe-character-content');
    for(const [attr,text] of Object.entries(attrs)){
      if(attr==='class'||attr==='title')continue;
      if(name==='a'&&attr==='href'&&/^(https?:\/\/|#)/i.test(text))continue;
      if(attr==='style'&&text.split(';').every(part=>!part.trim()||/^\s*(color|background-color|font-weight|font-style|text-decoration|text-align|white-space)\s*:\s*[#a-zA-Z0-9\s.,()%+-]+$/.test(part)))continue;
      fail('unsafe-character-content');
    }
  }},{decodeEntities:true});parser.end(value);
}
function isRecord(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
function validateFamily(family){
  const parents=new Map();
  for(const person of family){
    const id=String(person.id??'');
    if(!id||id==='root'||parents.has(id))fail('invalid-character');
    parents.set(id,String(person.parentId||'root'));
  }
  for(const id of parents.keys()){
    let current=id,depth=0;
    while(parents.has(current)){
      if(++depth>100)fail('invalid-character');
      current=parents.get(current);
    }
  }
}
function validateSheet(result){
  if(!['string','number'].includes(typeof result.id)||!/^\d+$/.test(String(result.id))||!Number.isSafeInteger(Number(result.id))||typeof result.name!=='string'||result.name.length>300)fail('invalid-character');
  for(const key of numericFields){if(result[key]!=null)validateNumber(result[key]);}
  for(const key of ['speed','baseSpeed']){
    const value=result[key];
    if(value!=null&&!(typeof value==='number'&&Number.isFinite(value))&&!(typeof value==='string'&&value.length<=64&&speedPattern.test(value)))fail('invalid-character');
  }
  for(const key of ['stats','coins','deathSaves','globalTime','arenaEquipSlots','preparedSpells','spellCD','abilityUsage','narrativePath','spellsLearned']){
    if(result[key]!=null&&!isRecord(result[key]))fail('invalid-character');
  }
  for(const key of ['coins','deathSaves','globalTime']){
    for(const value of Object.values(result[key]||{}))validateNumber(value);
  }
  for(const field of ['cur','tmp','base']){
    for(const stat of Object.values(result.stats||{})){
      if(isRecord(stat)){if(stat[field]!=null)validateNumber(stat[field]);}
      else validateNumber(stat); // Older saves have plain numbers.
    }
  }
  const legacyLists=['skills','mastery','inventoryItems','equipItems'];
  for(const key of [...legacyLists,'family','journalEntries','levelHistory','effectHistory','tempEffects','statuses','spellRefs']){
    const values=result[key];
    if(values==null)continue;
    if(!Array.isArray(values)||values.length>1000)fail('invalid-character');
    for(const entry of values){
      if(key==='spellRefs'||key==='statuses'){
        if((typeof entry!=='string'&&typeof entry!=='number')||!keyPattern.test(String(entry)))fail('invalid-character');
      }else if(!isRecord(entry)&&!(legacyLists.includes(key)&&typeof entry==='string'))fail('invalid-character');
    }
    if(key==='family')validateFamily(values);
    if(key==='journalEntries'){
      const seen=new Set();
      for(const entry of values){
        if(entry.journalId==null)continue;
        const id=String(entry.journalId);
        if(seen.has(id))fail('invalid-character');
        seen.add(id);
      }
    }
  }
  for(const effect of [...(result.tempEffects||[]),...(result.effectHistory||[])]){
    // The classic combat panel uses this local effect ID as a number in removeEffect().
    // Network effect identities are kept separately as effectId.
    if(effect.id!=null&&!/^\d+$/.test(String(effect.id)))fail('invalid-character');
    if(effect.value!=null&&typeof effect.value!=='string'&&typeof effect.value!=='number')fail('invalid-character');
    for(const key of ['tickValue','remaining','duration','remainingMins','stacks']){
      if(effect[key]!=null)validateNumber(effect[key]);
    }
    for(const key of ['unit','tickType','iconKey','type']){
      if(effect[key]!=null&&(typeof effect[key]!=='string'||!keyPattern.test(effect[key])))fail('unsafe-character-content');
    }
    if(effect.expiredAtRound!=null&&effect.expiredAtRound!=='—')validateNumber(effect.expiredAtRound);
  }
}
function clean(character){
  if(!character||typeof character!=='object'||Array.isArray(character))fail('invalid-character');
  const json=JSON.stringify(character);
  if(Buffer.byteLength(json)>1900000)fail('character-too-large');
  const result=JSON.parse(json);
  function inspect(value,depth,path=[]){
    if(depth>32)fail('invalid-character');
    if(value&&typeof value==='object')for(const key of Object.keys(value)){
      if(key==='prototype'||Object.hasOwn(Object.prototype,key)||/["'<>`\x00-\x1f]/.test(key))fail('invalid-character');
      const field=value[key];
      if(field==null)continue;
      const planNotes=key==='notes'&&path.length===3&&path[0]==='progressionPlan'&&path[1]==='levels'&&/^\d+$/.test(path[2]);
      if(planNotes){
        if(!Array.isArray(field)||field.length>1000||field.some(note=>typeof note!=='string'))fail('invalid-character');
        field.forEach(note=>safeText(note,'notes'));
      }else if(textFields.has(key)&&typeof field!=='string')fail('invalid-character');
      if(key==='statusKey'&&(typeof field!=='string'||!keyPattern.test(field)))fail('unsafe-character-content');
      if((key==='color'||key==='bg')&&(typeof field!=='string'||field!==''&&!colorPattern.test(field)))fail('unsafe-character-content');
      if(key==='cdMax'){
        validateNumber(field);
        if(!Number.isSafeInteger(Number(field))||Number(field)<0||Number(field)>100)fail('invalid-character');
      }
      if(mediaFields.has(key)&&typeof field!=='string')fail('invalid-character');
      if(identifierField.test(key)&&typeof field!=='string'&&typeof field!=='number')fail('invalid-character');
      if(typeof field==='string')safeText(field,key);
      inspect(field,depth+1,path.concat(key));
    }
  }
  inspect(result,0);for(const key of META)delete result[key];
  validateSheet(result);
  return result;
}
function equal(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
}
function changes(before,after){
  return [...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!META.has(k)&&!equal(before[k],after[k])).map(field=>({field,before:Object.hasOwn(before,field)?{value:before[field]}:{absent:true},after:Object.hasOwn(after,field)?{value:after[field]}:{absent:true}}));
}
function code(){return 'ZG-'+crypto.randomBytes(16).toString('hex').toUpperCase().match(/.{1,8}/g).join('-');}
function normalizeCode(value){return String(value||'').toUpperCase().replace(/[\s-]/g,'');}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function role(sheet,uid){return sheet&&sheet.meta.ownerUid===uid?'master':sheet&&sheet.meta.playerUid===uid?'player':null;}
function initial(character,ownerUid,playerUid,playerCode,now){return {meta:{ownerUid,playerUid,locked:true,createdAt:now},state:{revision:1,characterJson:JSON.stringify(clean(character)),updatedAt:now,updatedBy:ownerUid,writerRole:'master',operationId:'create'},private:{playerCode},history:{}};}
function masterEntries(character){
  return (character.journalEntries||[]).filter(entry=>entry.updatedBy==='gm');
}
function commit(sheet,uid,input,now){
  const actor=role(sheet,uid);if(!actor)fail('access-denied');
  if(typeof input.operationId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(input.operationId)||Object.hasOwn(Object.prototype,input.operationId))fail('invalid-operation');
  const next=clean(input.character),before=JSON.parse(sheet.state.characterJson);
  if(String(next.id)!==String(before.id)||String(next.campaignKey||'')!==String(before.campaignKey||''))fail('identity-change');
  const fingerprint=hash(JSON.stringify(next));
  const previous=sheet.receipts&&sheet.receipts[input.operationId];
  if(previous){if(previous.uid!==uid||previous.fingerprint!==fingerprint)fail('operation-reused');return sheet;}
  if(input.expectedRevision!==sheet.state.revision)fail('revision-conflict');
  if(actor==='player'&&(!equal(before.narrativePath,next.narrativePath)||!equal(masterEntries(before),masterEntries(next))))fail('access-denied');
  const delta=changes(before,next);if(!delta.length)return sheet;
  const revision=sheet.state.revision+1;
  const result=JSON.parse(JSON.stringify(sheet));
  result.state={revision,characterJson:JSON.stringify(next),updatedAt:now,updatedBy:uid,writerRole:actor,operationId:input.operationId};
  if(actor==='player')result.activity=Object.assign({},result.activity,{lastPlayerRevision:revision,lastPlayerAt:now});
  result.history=result.history||{};
  result.history[String(revision).padStart(12,'0')]={revision,at:now,actorUid:uid,actorRole:actor,source:input.source==='session'?'session':'sheet',changesJson:JSON.stringify(delta)};
  // Bound the transaction and retain exact old/new values, including removed items.
  let keys=Object.keys(result.history).sort();
  while(keys.length>100||Buffer.byteLength(JSON.stringify(result.history))>6000000){delete result.history[keys.shift()];}
  result.receipts=result.receipts||{};result.receipts[input.operationId]={uid,fingerprint,revision};
  Object.keys(result.receipts).sort((a,b)=>result.receipts[b].revision-result.receipts[a].revision).slice(150).forEach(k=>delete result.receipts[k]);
  return result;
}
module.exports={clean,equal,changes,code,normalizeCode,hash,role,initial,commit,fail};
