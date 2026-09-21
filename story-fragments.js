(function(w){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const t=(ru,uk)=>w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;
 const error=(ru,uk)=>{throw Error(t(ru,uk));};
 function stable(x){return JSON.stringify(x,function(k,v){return v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((r,k)=>(r[k]=v[k],r),{}):v;});}
 function voices(data,pages){const names=data.speakers||{};pages.forEach(p=>{const id=p.speaker==='@player'?data.playerSpeakerId:p.speaker;const a=names[id];if(!a)return;const name=(a.name||'')+' '+(a.nameUk||'');if(a.mimicOnly||/врот[иі]к|ск[иі]ф/i.test(name))for(const k of ['text','textUk'])if(p[k]&&(!/^\s*\[[^\]]*(?:голос|voice)[^\]]*\]/i.test(p[k])||/сво[иїіє]м\s+голос|собственн.{0,6}голос|власн.{0,6}голос/i.test(p[k])))error('Укажите чужой голос в начале реплики: '+id,'Вкажіть чужий голос на початку репліки: '+id);});}
 function compile(data,raw){
  if(typeof raw!=='string'||raw.length>2000000)error('Лимит фрагмента — 2 МБ.','Ліміт фрагмента — 2 МБ.');
  let f;try{f=JSON.parse(raw.trim().replace(/^```json\s*/i,'').replace(/\s*```$/,''));}catch(e){error('Некорректный JSON.','Некоректний JSON.');}
  function safe(o){if(!o||typeof o!=='object')return;for(const k of Object.keys(o)){if(['__proto__','constructor','prototype'].includes(k))error('Недопустимый ключ.','Неприпустимий ключ.');safe(o[k]);}}safe(f);
  if(f.format!=='zargota-fragment'||f.version!==1)error('Нужен zargota-fragment, version 1.','Потрібен zargota-fragment, version 1.');
  for(const k of Object.keys(f))if(!['format','version','nodes','quests','zones','connections','replaceNodes','replaceQuests'].includes(k))error('Неизвестное поле: '+k,'Невідоме поле: '+k);
  for(const k of ['nodes','quests','zones','connections','replaceNodes','replaceQuests'])if(f[k]!=null&&(!Array.isArray(f[k])||f[k].length>100))error('Ожидается массив до 100 элементов: '+k,'Очікується масив до 100 елементів: '+k);
  const next=clone(data),scenes=next.scenes||[],sceneId=id=>id==='@location'?next.activeSceneId:id;
  function scene(id){const r=scenes.find(r=>r.id===sceneId(id));if(!r)error('Локация не найдена: '+id,'Локацію не знайдено: '+id);return r.id===next.activeSceneId?next.scene:r.scene;}
  function add(group,items){for(const item of items||[]){if(!item||typeof item.id!=='string'||!item.id||group.some(x=>x.id===item.id))error('Повторный или пустой ID: '+(item&&item.id),'Повторний або порожній ID: '+(item&&item.id));group.push(clone(item));}}
  next.nodes=next.nodes||[];next.quests=next.quests||[];
  add(next.nodes,f.nodes);add(next.quests,f.quests);
  const changed=[];
  for(const r of f.replaceQuests||[]){
   if(!r?.before||!r.after||r.before.id!==r.after.id)error('Неверная замена задания.','Невірна заміна завдання.');
   const current=next.quests.find(q=>q.id===r.before.id);
   if(!current)error('Задание не найдено.','Завдання не знайдено.');
   const keys=[...new Set([...Object.keys(r.before),...Object.keys(r.after)])].filter(k=>stable(r.before[k])!==stable(r.after[k]));
   for(const k of keys)if(stable(current[k])!==stable(r.before[k]))error('Конфликт задания: '+k+'. Нужен свежий фрагмент.','Конфлікт завдання: '+k+'. Потрібен свіжий фрагмент.');
   for(const k of keys){if(Object.hasOwn(r.after,k))current[k]=clone(r.after[k]);else delete current[k];}
  }
  for(const r of f.replaceNodes||[]){
   if(!r||!r.before||!r.after||r.before.id!==r.after.id)error('Замена требует before и after с одинаковым ID.','Заміна потребує before та after з однаковим ID.');
   const current=next.nodes.find(n=>n.id===r.before.id);
   if(!current)error('Блок не найден: '+r.before.id,'Блок не знайдено: '+r.before.id);
   // Three-way, field-scoped replacement: layout and unrelated authored settings survive.
   const keys=[...new Set([...Object.keys(r.before),...Object.keys(r.after)])].filter(k=>stable(r.before[k])!==stable(r.after[k]));
   for(const k of keys){if(stable(current[k])!==stable(r.before[k]))error('Конфликт в блоке '+r.before.id+', поле '+k+'. Ваши изменения сохранены. Нужен свежий фрагмент.','Конфлікт у блоці '+r.before.id+', поле '+k+'. Ваші зміни збережено. Потрібен свіжий фрагмент.');}
   for(const k of keys){if(Object.hasOwn(r.after,k))current[k]=clone(r.after[k]);else delete current[k];}
   changed.push(current);
  }
  for(const n of (f.nodes||[]).concat(changed)){const actual=next.nodes.find(x=>x.id===n.id);actual.editorSceneId=sceneId(actual.editorSceneId||'@location');scene(actual.editorSceneId);if(!['dialogue','choice','image'].includes(actual.kind)||!Array.isArray(actual.links)||actual.slides!=null&&!Array.isArray(actual.slides))error('Неверный блок: '+n.id,'Невірний блок: '+n.id);voices(next,[actual,...actual.slides||[]]);for(const p of [actual,...actual.slides||[]]){if(p.speaker&&!next.speakers?.[p.speaker])error('Неизвестный персонаж: '+p.speaker,'Невідомий персонаж: '+p.speaker);if(p.text&&!p.textUk||p.textUk&&!p.text)error('Нужны тексты RU и UK: '+n.id,'Потрібні тексти RU та UK: '+n.id);}}
  for(const z of f.zones||[]){const s=scene(z.sceneId);if(!z.zone||!Number.isFinite(z.zone.x)||!Number.isFinite(z.zone.y)||z.zone.x<0||z.zone.x>100||z.zone.y<0||z.zone.y>100)error('Неверные координаты зоны.','Невірні координати зони.');s.story=s.story||{};s.story.zones=s.story.zones||[];add(s.story.zones,[z.zone]);}
  for(const c of f.connections||[]){const n=next.nodes.find(n=>n.id===c.from);if(!n||!c.link||!c.link.label||!c.link.labelUk)error('Проверьте подключение и подписи RU/UK.','Перевірте підключення та підписи RU/UK.');add(n.links,[c.link]);}
  const ids=new Set(next.nodes.map(n=>n.id)),qid=new Set(next.quests.map(q=>q.id));
  const touched=new Set([...(f.nodes||[]).map(n=>n.id),...changed.map(n=>n.id),...(f.connections||[]).map(c=>c.from)]);
  for(const n of next.nodes.filter(n=>touched.has(n.id)))for(const l of n.links||[]){if(l.to&&!ids.has(l.to))error('Не найдена цель связи: '+l.to,'Не знайдено ціль зв’язку: '+l.to);if(l.sceneId)scene(l.sceneId);}
  for(const q of f.quests||[]){if(!q.title||!q.titleUk)error('Нужно название задания RU/UK.','Потрібна назва завдання RU/UK.');for(const id of [q.dialogueId,...q.dialogueIds||[]].filter(Boolean))if(!ids.has(id))error('Не найдена концовка: '+id,'Не знайдено кінцівку: '+id);if(q.nextId&&!qid.has(q.nextId))error('Не найдено следующее задание.','Не знайдено наступне завдання.');}
  for(const z of f.zones||[]){if(z.zone.entryId&&!ids.has(z.zone.entryId))error('Не найден диалог зоны.','Не знайдено діалог зони.');if(z.zone.sceneId)scene(z.zone.sceneId);}
  const active=scenes.find(r=>r.id===next.activeSceneId);if(active)active.scene=clone(next.scene);
  return {next,counts:[(f.nodes||[]).length,(f.quests||[]).length,(f.zones||[]).length,(f.connections||[]).length,changed.length+(f.replaceQuests||[]).length],changes:changed.map(n=>n.titleUk||n.title||n.id).concat((f.replaceQuests||[]).map(r=>r.after.titleUk||r.after.title||r.after.id))};
 }
 function install(root,api){const bar=root.querySelector('.zg-story-workspace-tabs');if(!bar||bar.querySelector('[data-fragment]'))return;let undo=null;
  const button=document.createElement('button');button.type='button';button.dataset.fragment='1';button.textContent=t('＋ JSON-фрагмент','＋ JSON-фрагмент');bar.appendChild(button);
  button.onclick=()=>{const d=document.createElement('dialog');d.className='zg-fragment-dialog';d.style.cssText='width:min(850px,92vw);max-height:88vh;overflow:auto;padding:24px;border:1px solid #b7a467;border-radius:14px;background:#11231e;color:#eee0bc;font:16px system-ui';
   const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;d.appendChild(e);return e;};el('h2',t('Вставить JSON-фрагмент','Вставити JSON-фрагмент'));el('p',t('Добавляет блоки, задания и зоны. Замены перечисляются отдельно.','Додає блоки, завдання й зони. Заміни перелічуються окремо.'));const area=el('textarea');area.setAttribute('aria-label','JSON');area.style.cssText='box-sizing:border-box;width:100%;height:35vh;background:#08130f;color:#ece3ca;border:1px solid #657c6e;border-radius:8px;padding:12px;font:14px monospace';const status=el('p');status.setAttribute('role','status');let base=null,plan=null;
   function action(label,fn){const b=el('button',label);b.type='button';b.style.cssText='padding:10px 14px;margin:6px;border:1px solid #738775;border-radius:8px;background:#243c30;color:#eee0bc;font:inherit';b.onclick=fn;return b;}
   status.style.cssText='display:block;min-height:24px;white-space:pre-wrap;color:#eee0bc';
   status.textContent=t('Выберите файл или вставьте JSON, затем нажмите «Проверить».','Оберіть файл або вставте JSON, потім натисніть «Перевірити».');
   const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.onchange=async()=>{try{if(file.files[0]){area.value=await file.files[0].text();validate();}}catch(e){status.textContent=t('Не удалось прочитать файл.','Не вдалося прочитати файл.');}finally{file.value='';}};action(t('Из файла…','Із файлу…'),()=>file.click());
   const apply=action(t('Применить','Застосувати'),()=>{try{if(!plan||stable(api.get())!==base)throw Error(t('Данные изменились — проверьте заново.','Дані змінилися — перевірте знову.'));const before=clone(api.get());api.update(data=>{Object.assign(data,clone(plan.next));});if(stable(api.get().nodes)!==stable(plan.next.nodes))throw Error(t('Не удалось сохранить.','Не вдалося зберегти.'));undo={before,after:stable(api.get())};d.close();d.remove();}catch(e){status.textContent=e.message;}});apply.disabled=true;
   function validate(){apply.disabled=true;try{const data=api.get();base=stable(data);plan=compile(data,area.value);status.textContent=t('Готово к применению. Блоки / задания / зоны / связи / замены: ','Готово до застосування. Блоки / завдання / зони / зв’язки / заміни: ')+plan.counts.join(' / ')+(plan.changes.length?' — '+plan.changes.join(', '):'');apply.disabled=false;}catch(e){plan=null;status.textContent=e.message;}}
   const check=action(t('Проверить','Перевірити'),validate);d.insertBefore(check,apply);
   action(t('Отменить последнее применение','Скасувати останнє застосування'),()=>{if(!undo||stable(api.get())!==undo.after){status.textContent=t('Отмена недоступна: после импорта были изменения или редактор перезагружен.','Скасування недоступне: після імпорту були зміни або редактор перезавантажено.');return;}api.update(data=>Object.assign(data,clone(undo.before)));undo=null;d.close();d.remove();});action(t('Закрыть','Закрити'),()=>{d.close();d.remove();});area.oninput=()=>{plan=null;apply.disabled=true;};d.oncancel=()=>d.remove();document.body.appendChild(d);d.showModal();area.focus();
  };
 }
 w.ZargotaStoryFragments={compile,install,voices,stable};
})(window);
