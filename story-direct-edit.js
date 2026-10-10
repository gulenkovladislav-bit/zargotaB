(function(w){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v)),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),t=(r,u)=>w.ZargotaI18n?.getLocale()==='uk'?u:r;
 const allowed=new Set(['title','titleUk','nodes','scenes','scene','speakers','player','storyItems','interactions','minigames','quests','presentation','intro','timelines']);
 function valid(e){return e&&e.scene&&Array.isArray(e.nodes)&&new Set(e.nodes.map(n=>n.id)).size===e.nodes.length&&e.nodes.every(n=>typeof n.id==='string'&&Array.isArray(n.links))&&(!e.scenes||Array.isArray(e.scenes)&&new Set(e.scenes.map(s=>s.id)).size===e.scenes.length);}
 function create(port){
  let snapshot=null;const backupKey='zargota_story_direct_backup_v1';
  function read(id){if(port.busy())return {ok:false,error:'busy'};const projectId=id||port.active(),episode=port.load()[projectId];if(!episode)return {ok:false,error:'missing'};snapshot={projectId,episode:copy(episode),snapshotId:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};return {ok:true,...copy(snapshot)};}
  function apply(request, diskBackup){
   if(port.busy())return {ok:false,error:'busy'};
   if(!snapshot||request.snapshotId!==snapshot.snapshotId||request.projectId!==snapshot.projectId)return {ok:false,error:'wrong-snapshot'};
   const all=port.load(),before=all[snapshot.projectId];if(!equal(before,snapshot.episode))return {ok:false,error:'conflict'};
   const next=copy(before);try{
    if(!Array.isArray(request.changes)||!request.changes.length||request.changes.length>200)throw Error('invalid');
    let sceneEdited=false,scenesEdited=false;
    for(const change of request.changes){const path=change.path;if(!Array.isArray(path)||!path.length||!allowed.has(path[0])||path.some(k=>!['string','number'].includes(typeof k)||['__proto__','prototype','constructor'].includes(String(k)))||!['set','remove'].includes(change.op))throw Error('path');
     sceneEdited ||= path[0]==='scene';scenesEdited ||= path[0]==='scenes';let obj=next;for(const key of path.slice(0,-1)){if(!obj||!Object.prototype.hasOwnProperty.call(obj,key))throw Error('path');obj=obj[key];}const key=path.at(-1);if(!obj||typeof obj!=='object')throw Error('path');if(Array.isArray(obj)&&(!Number.isInteger(Number(key))||Number(key)<0||Number(key)>=obj.length))throw Error('path');
     if(change.op==='remove'){if(Array.isArray(obj))throw Error('array-remove');delete obj[key];}else{if(change.value===undefined)throw Error('value');obj[key]=copy(change.value);}
    }
    if(sceneEdited&&scenesEdited)throw Error('scene-alias');const current=next.scenes?.find(s=>s.id===next.activeSceneId);if(current){if(sceneEdited){current.scene=copy(next.scene);current.name=next.scene.name||current.name;}if(scenesEdited)next.scene=copy(current.scene);}
    if(!valid(next))throw Error('invalid');
   }catch(e){return {ok:false,error:'invalid-patch'};}
   if(equal(before,next))return {ok:true,changed:false};
   // Manual edits retain browser rollback. Authenticated exchange supplies a disk receipt.
   try{if(!diskBackup||diskBackup.projectId!==snapshot.projectId||diskBackup.snapshotId!==snapshot.snapshotId||typeof diskBackup.file!=='string'||!diskBackup.file)port.storage.setItem(backupKey,JSON.stringify({projectId:snapshot.projectId,before,after:next}));}catch(e){return {ok:false,error:'backup-storage'};}
   const fresh=port.load();if(!equal(fresh[snapshot.projectId],before))return {ok:false,error:'conflict'};
   fresh[snapshot.projectId]=next;if(!port.save(fresh))return {ok:false,error:'storage'};
   const id=snapshot.projectId;snapshot=null;if(port.active()===id)port.refresh(id);return {ok:true,changed:true,projectId:id};
  }
  function undo(){if(port.busy())return {ok:false,error:'busy'};let b;try{b=JSON.parse(port.storage.getItem(backupKey));}catch(e){}if(!b||b.projectId!==port.active())return {ok:false,error:'no-backup'};const all=port.load();if(!equal(all[b.projectId],b.after))return {ok:false,error:'conflict'};all[b.projectId]=b.before;if(!port.save(all))return {ok:false,error:'storage'};try{port.storage.removeItem(backupKey);}catch(e){}snapshot=null;port.refresh(b.projectId);return {ok:true};}
  return {read,apply,undo,backup:()=>port.busy()?{ok:false,error:'busy'}:{ok:true,episodes:Object.fromEntries(Object.entries(port.load()).filter(([id,e])=>e&&!e._deleted))},list:()=>({ok:true,episodes:Object.entries(port.load()).filter(([id,e])=>e&&!e._deleted).map(([id,e])=>({id,title:e.title,titleUk:e.titleUk,active:id===port.active()}))})};
 }
 function chunks(value){const text=JSON.stringify(value),parts=[];for(let i=0;i<text.length;i+=6000)parts.push(text.slice(i,i+6000));return parts;}
 function panel(api){
  const dialog=document.createElement('dialog');dialog.className='zg-direct-edit';
  const title=document.createElement('h2');title.textContent=t('Прямые правки эпизода','Прямі правки епізоду');
  const note=document.createElement('p');note.textContent=t('Правки применяются к открытому эпизоду. При конфликте с вашими изменениями сохранение остановится. Последнюю прямую правку можно отменить, пока эпизод не изменён снова.','Правки застосовуються до відкритого епізоду. За конфлікту з вашими змінами збереження зупиниться. Останню пряму правку можна скасувати, доки епізод не змінено знову.');
  const area=document.createElement('textarea');area.setAttribute('aria-label',t('Снимок или точечные правки','Знімок або точкові правки'));area.spellcheck=false;
  let parts=[],part=0;
  const paging=document.createElement('div'),position=document.createElement('span');
  function showPart(){area.value=parts[part];position.textContent=t('Часть ','Частина ')+(part+1)+' / '+parts.length;previous.disabled=part===0;next.disabled=part===parts.length-1;}
  const previous=document.createElement('button'),next=document.createElement('button');previous.type=next.type='button';previous.textContent=t('← Предыдущая часть','← Попередня частина');next.textContent=t('Следующая часть →','Наступна частина →');previous.onclick=()=>{if(part>0){part--;showPart();}};next.onclick=()=>{if(part+1<parts.length){part++;showPart();}};paging.append(previous,position,next);paging.hidden=true;
  const status=document.createElement('p');status.setAttribute('role','status');
  function result(r){status.textContent=r.ok?t('Готово.','Готово.'):t('Изменения не применены: ','Зміни не застосовано: ')+(({busy:t('завершите редактирование поля или выйдите из теста.','завершіть редагування поля або вийдіть із тесту.'),conflict:t('эпизод изменился — нужен свежий снимок.','епізод змінився — потрібен свіжий знімок.'),'backup-storage':t('не хватает места для резервной копии.','бракує місця для резервної копії.'),'wrong-snapshot':t('не тот эпизод или устаревший снимок.','не той епізод або застарілий знімок.'),'no-backup':t('нет копии для этого эпизода.','немає копії для цього епізоду.')})[r.error]||t('Проверьте формат правки и доступность хранилища.','Перевірте формат правки й доступність сховища.'));}
  if(w.ZargotaStoryExchange)dialog.append(w.ZargotaStoryExchange.controls(api));
  const actions=document.createElement('div');function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;actions.append(b);}
  button(t('Получить снимок','Отримати знімок'),()=>{const r=api.read();result(r);if(r.ok){parts=chunks(r);part=0;paging.hidden=false;showPart();status.textContent=t('Эпизод: ','Епізод: ')+(r.episode.titleUk||r.episode.title||r.projectId);}});
  button(t('Применить правку','Застосувати правку'),()=>{try{result(api.apply(JSON.parse(area.value)));}catch(e){result({ok:false,error:'invalid-patch'});}});
  button(t('Отменить последнюю правку','Скасувати останню правку'),()=>result(api.undo()));button(t('Закрыть','Закрити'),()=>dialog.close());dialog.append(title,note,paging,area,actions,status);dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
 }
 w.ZargotaStoryDirectEdit={create,panel,chunks};
})(window);
